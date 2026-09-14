/* =====================================================================
 * worker.mjs —— 入局者联机中继服（Cloudflare Workers + Durable Objects）
 * ---------------------------------------------------------------------
 * 永久免费额度、无需信用卡。一个 4 位房号 = 一个 Durable Object 实例，
 * DO 单线程天然持有该房间全部连接与状态，只做房间/种子/转发，不做规则结算。
 *
 * 对前端呈现的协议（与 Node 版 online_server.js 完全一致的“单跳”版）：
 *   HTTP  GET /health           -> {ok:true}
 *   HTTP  GET /newroom          -> {code:"ABCD"}
 *   WS    /?r=CODE              建立后首条发 {t:'hello',role:'host'|'guest',name}
 *     server -> joined{id,sid,isHost} / room{players:[{sid,name,ready}]}
 *               start{seed,first:hostSid} / relay{m} / oppLeft / error{msg,code}
 *     client -> ready / relay{m} / leave
 * ===================================================================== */

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混 0/O 1/I

/* =====================================================================
 * C 阶段第 4 步 · 批次 2：**权威引擎搬进 Durable Object**（可选路径）
 * ---------------------------------------------------------------------
 * 默认仍然是那套"房主浏览器跑规则、中继只转发"的旧协议 —— 旧客户端行为一个字节都不变。
 * 只有当客户端明确要求时（WS 连接带 `?engine=1`，或 hello 里带 `engine:true`），本房间才额外
 * 创建一份**服务器权威引擎**（`engine-room.js`）：两个座位都只是客户端，只发意图、只收自己该看的视图；
 * 隐藏信息在客户端里根本不存在（对手手牌只发张数）。
 * 新路径可独立验证、随时撤回，线上旧路径不受影响。
 * ===================================================================== */
import { createEngineRoom } from './engine-room.js';
import { CARD_DATA_JSON } from './card-data.js';

const ENGINE_PERSIST_MS = 1500;   // 权威自存快照的落盘节流（重连/DO 回收后恢复用）
function genCode() {
  let s = '';
  for (let i = 0; i < 4; i++) s += ROOM_CHARS[Math.floor(Math.random() * ROOM_CHARS.length)];
  return s;
}
function u32seed() {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0] >>> 0;
}
const MAX = 2;
const GRACE_MS = 90000;   // 掉线宽限期：期间只通知"对手掉线"，超时才算真的离开

/* 收集快照 state 里引用到的所有卡 uid。
   服务器累积卡定义时会用它做剪枝：只保留"当前还在局中"的卡定义，
   避免一局下来定义字典无限膨胀（Durable Object 单个存储值上限 128KB）。 */
function collectUids(v, out) {
  if (!v || typeof v !== 'object') return out;
  if (Array.isArray(v)) { for (const x of v) collectUids(x, out); return out; }
  if (v.__u) { out[v.__u] = 1; return out; }
  for (const k in v) collectUids(v[k], out);
  return out;
}

export class RoomObject {
  constructor(state, env) {
    this.state = state;
    /** @type {{ws:WebSocket,sid:string,name:string,ready:boolean,isHost:boolean}[]} */
    this.players = [];
    this.hostSid = '';
    this.started = false;
    this.seq = 0;
    /* 权威式联机：这里存一份"权威自存快照"，供任意一方重连时恢复。
       放进 DO storage 是为了即使两端都断开、DO 被回收后再拉起，快照依然在。
       this.defs 是累积的卡定义字典（房主每份快照只带新增定义）。 */
    this.lastSnap = null;
    this.defs = {};
    this.lost = { host: false, guest: false };
    this.lostTok = { host: 0, guest: 0 };
    /* 服务器权威引擎（批次 2，可选路径）：只在客户端要求时才建，省掉不用的房间的冷启动开销 */
    this.engineRoom = null;
    this.engineWanted = false;
    this.engineSnap = null;
    this.engineSavedAt = 0;
    this.ready = state.blockConcurrencyWhile(async () => {
      try {
        this.lastSnap = (await state.storage.get('snap')) || null;
        if (this.lastSnap && this.lastSnap.cards) this.defs = this.lastSnap.cards;
      } catch (e) { this.lastSnap = null; }
      try { this.engineSnap = (await state.storage.get('engineSnap')) || null; } catch (e) { this.engineSnap = null; }
    });
  }

  /* ---------------- 服务器权威引擎（批次 2） ----------------
     每房间一份引擎运行时；两个座位都只是客户端。传输与规则分开：
     engine-room.js 只管房间与规则，这里只负责"把消息送到那个座位的连接上"。 */
  _seatOf(p) { return p && p.isHost ? 'p1' : 'p2'; }
  _wsOfSeat(seat) {
    for (const p of this.players) if (p.greeted && this._seatOf(p) === seat) return p.ws;
    return null;
  }
  _ensureEngineRoom() {
    if (this.engineRoom) return this.engineRoom;
    this.engineRoom = createEngineRoom({
      code: this.code || '',
      cardDataJson: CARD_DATA_JSON,
      send: (seat, msg) => { this._send(this._wsOfSeat(seat), { t: 'engine', m: msg }); },
      now: () => Date.now(),
      onLog: (s) => { try { console.log(`[room ${this.code}][engine] ${s}`); } catch (e) {} },
      persist: (snap) => {
        /* 节流落盘：权威状态在内存里，落盘是为了 DO 被回收/两端都断开后还能恢复这一局 */
        const t = Date.now();
        if (t - this.engineSavedAt < ENGINE_PERSIST_MS) return;
        this.engineSavedAt = t;
        this.engineSnap = snap;
        try { this.state.storage.put('engineSnap', snap); } catch (e) {}
      }
    });
    if (this.engineSnap) {
      try { this.engineRoom.restore(this.engineSnap); } catch (e) { console.log('[engine] restore 失败：' + e.message); }
    }
    return this.engineRoom;
  }

  _markBack(role) {
    if (!this.lost[role]) return;
    this.lost[role] = false;
    this.lostTok[role]++;          // 作废掉那个"宽限期到点就判离开"的定时器
    this._broadcast({ t: 'peerBack', role });
  }

  _send(ws, obj) {
    try { if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch (e) {}
  }
  _broadcast(obj, exceptWs) {
    for (const p of this.players) {
      if (p.ws === exceptWs) continue;
      this._send(p.ws, obj);
    }
  }
  _snapshot() {
    return { t: 'room', players: this.players.map((p) => ({ sid: p.sid, name: p.name, ready: p.ready })) };
  }
  _tryStart() {
    if (this.started || this.players.length < MAX) return;
    if (this.players.some((p) => !p.ready)) return;
    this.started = true;
    const seed = u32seed();
    for (const p of this.players) this._send(p.ws, { t: 'start', seed, first: this.hostSid });
    console.log(`[room ${this.code}] start seed=${seed} host=${this.hostSid}`);
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/state') {
      return new Response(JSON.stringify({ n: this.players.length, started: this.started, hasHost: !!this.hostSid }),
        { headers: { 'content-type': 'application/json' } });
    }
    if (url.pathname !== '/room') return new Response('not found', { status: 404 });
    this.code = url.searchParams.get('r') || this.code || '';
    const wantEngine = url.searchParams.get('engine') === '1';   // 批次 2：明确要求才启用服务器权威引擎

    const pair = new WebSocketPair();
    const server = pair[1];
    server.accept();
    const sid = 's' + (++this.seq) + '_' + Math.random().toString(36).slice(2, 7);
    const me = { ws: server, sid, name: '玩家', ready: false, isHost: false, greeted: false, engine: wantEngine, seat: '' };
    this.players.push(me);

    server.addEventListener('message', async (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      switch (m.t) {
        case 'hello': {
          if (me.greeted) return;
          me.greeted = true;
          me.name = String(m.name || '玩家').slice(0, 16);
          if (m.role === 'host') {
            if (this.hostSid) { // 极端房号碰撞：该房已有房主
              this._send(server, { t: 'error', code: 'ROOM_TAKEN', msg: '房间号已被占用，请重新创建' });
              try { server.close(); } catch (e) {}
              return;
            }
            me.isHost = true; this.hostSid = sid;
            const resumedH = !!(this.started && m.resume);
            this._send(server, { t: 'joined', id: this.code, sid, isHost: true, resumed: resumedH });
            if (resumedH) this._markBack('host');
          } else {
            // 与 Node 版 online_server.js 行为保持一致：没有房主的房间视为「不存在」。
            // DO 是按房号按需创建的，不这样挡的话，房号打错一位就会静默建出一个没有房主的
            // 房间，双方都算客人、start.first 为空，开局直接卡死。
            if (!this.hostSid) {
              this._send(server, { t: 'error', msg: '房间不存在，请先创建或核对房号' });
              try { server.close(); } catch (e) {}
              return;
            }
            // 对局已开始时：只接受"原客人自动重连"（带 resume），不接受新人插入空位
            if (this.started && !m.resume) { this._send(server, { t: 'error', msg: '对局已经开始，无法加入' }); try { server.close(); } catch (e) {} return; }
            // 只数「别人」：me.greeted 在上面已经置 true，直接数全部会把正常加入的第 2 人误挡。
            if (this.players.filter((p) => p.greeted && p !== me).length >= MAX) {
              this._send(server, { t: 'error', msg: '房间已满（2 人）' }); try { server.close(); } catch (e) {} return;
            }
            const resumedG = !!(this.started && m.resume);
            this._send(server, { t: 'joined', id: this.code, sid, isHost: false, resumed: resumedG });
            if (resumedG) this._markBack('guest');
          }
          // 先把快照推给房里其他人，再单独发给刚进来的这位（避免他收到两遍）
          this._broadcast(this._snapshot(), server);
          this._send(server, this._snapshot());
          /* 批次 2：要求了服务器权威引擎的客户端，这一条连接就接上对应座位。
             注意这里**不影响**上面那套旧协议 —— 旧客户端（没带 ?engine=1）走的还是原路。 */
          if (this.engineWanted || me.engine || m.engine === true) {
            this.engineWanted = true;
            const seat = me.isHost ? 'p1' : 'p2';
            me.seat = seat;
            try {
              /* 用 sid 当"连接身份"：重连换来新连接时，旧连接的 close 会晚到，
                 引擎房间据此忽略过期断开（否则会把刚回来的座位又标成离线）。 */
              this._ensureEngineRoom().attach(seat, { name: me.name, conn: sid });
            } catch (e) {
              console.log('[engine] attach 失败：' + (e && e.message));
              this._send(server, { t: 'error', msg: '服务器权威引擎启动失败：' + (e && e.message) });
            }
          }
          break;
        }
        case 'ready': {
          me.ready = true;
          this._broadcast(this._snapshot());
          this._tryStart();
          break;
        }
        /* 批次 2：服务器权威引擎的入站消息（意图 / 回答 / 准备 / 卡组 / 投降 / 重连要视图）。
           与旧协议并列存在，互不干扰；旧客户端永远不会发 t:'engine'。 */
        case 'engine': {
          if (!this.engineWanted) {
            this._send(server, { t: 'error', msg: '本房间没有启用服务器权威引擎（连接时请带 ?engine=1）' });
            break;
          }
          const seat = me.seat || (me.isHost ? 'p1' : 'p2');
          me.seat = seat;
          const room = this._ensureEngineRoom();
          try {
            room.handle(seat, m.m || {});
            room.flush();
          } catch (e) {
            console.log('[engine] handle 失败：' + (e && e.message));
            this._send(server, { t: 'engine', m: { k: 'error', reason: '服务器处理失败：' + (e && e.message) } });
          }
          break;
        }
        case 'relay': {
          const mm = m.m || {};
          // 房主存权威快照：服务器自己留着，不转发给对手（对手不需要权威视角）
          if (mm.k === 'snapSave') {
            const s = mm.s;
            if (s && s.state) {
              /* 累积卡定义（房主每份只带新增的那几张）。
                 【不要每份都剪枝】卡在结算过程中会短暂处于"既不在手牌也不在墓地"的中间态，
                 那一刻按"当前状态引用到的 uid"剪枝会把它的定义丢掉，
                 之后重连恢复就会显示成"未知卡"（实测踩过）。
                 只在体积接近 Durable Object 单值上限时才做一次紧急剪枝。 */
              if (s.cards) for (const k in s.cards) this.defs[k] = s.cards[k];
              let stored = Object.assign({}, s, { cards: this.defs });
              if (JSON.stringify(stored).length > 110000) {
                const used = collectUids(s.state, {});
                collectUids(s.grave, used);
                for (const k in this.defs) if (!used[k]) delete this.defs[k];
                stored = Object.assign({}, s, { cards: this.defs });
                console.log(`[room ${this.code}] defs pruned to ${Object.keys(this.defs).length}`);
              }
              this.lastSnap = stored;
              try { this.state.storage.put('snap', stored); } catch (e) {}
            }
            break;
          }
          this._broadcast({ t: 'relay', m: mm }, server);
          break;
        }
        case 'resync': {
          // 重连方索要最近一份权威快照
          let s = this.lastSnap;
          if (!s) { try { s = (await this.state.storage.get('snap')) || null; } catch (e) {} }
          this._send(server, { t: 'resync', s: s || null });
          break;
        }
        case 'leave': {
          try { server.close(); } catch (e) {}
          break;
        }
        default: break;
      }
    });

    server.addEventListener('close', () => {
      const i = this.players.indexOf(me);
      if (i >= 0) this.players.splice(i, 1);
      const role = me.isHost ? 'host' : 'guest';
      if (me.isHost && this.hostSid === sid) this.hostSid = '';
      /* 批次 2：权威引擎路径下，断开只标记该座位离线（宽限期内可重连，权威状态留在服务器）。
         带 sid = 这条连接的"身份"：过期连接的 close 会被引擎房间忽略。 */
      if (this.engineRoom && me.seat) {
        try { this.engineRoom.detach(me.seat, sid); } catch (e) {}
      }
      if (!this.started) {
        // 还没开局：直接算离开
        this._broadcast({ t: 'oppLeft' });
        this._broadcast(this._snapshot());
        return;
      }
      // 对局中掉线：先给宽限期，让对方看到"对手掉线了，等待重连"而不是直接结束对局
      this.lost[role] = true;
      const tok = ++this.lostTok[role];
      this._broadcast({ t: 'peerLost', role, grace: Math.round(GRACE_MS / 1000) });
      this._broadcast(this._snapshot());
      setTimeout(() => {
        if (this.lostTok[role] !== tok || !this.lost[role]) return;   // 期间已经回来了
        this.lost[role] = false;
        this._broadcast({ t: 'oppLeft' });                            // 宽限期过完仍未回来
      }, GRACE_MS);
    });
    server.addEventListener('error', () => { try { server.close(); } catch (e) {} });

    return new Response(null, { status: 101, webSocket: pair[0] });
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const CORS = {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,OPTIONS',
      'access-control-allow-headers': '*'
    };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ ok: true, ts: Date.now() }), { headers: CORS });
    }
    if (url.pathname === '/newroom') {
      return new Response(JSON.stringify({ code: genCode() }), { headers: CORS });
    }
    if (url.pathname === '/' && req.headers.get('Upgrade') === 'websocket') {
      const code = (url.searchParams.get('r') || '').toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(code)) {
        return new Response('bad room code', { status: 400 });
      }
      const id = env.ROOMS.idFromName(code);
      const stub = env.ROOMS.get(id);
      return stub.fetch(new URL(`/room?r=${code}`, req.url).toString(), req);
    }
    return new Response('rujuzhe relay (cloudflare worker) — use /health /newroom or ws /?r=CODE', { status: 200 });
  }
};
