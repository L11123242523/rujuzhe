/* =====================================================================
 * worker.mjs —— 入局者联机中继服（Cloudflare Workers + Durable Objects）
 * ---------------------------------------------------------------------
 * 一个 4 位房号 = 一个 Durable Object 实例，DO 单线程天然持有该房间全部连接与状态，
 * 只做房间 / 权威种子 / 转发 / 快照暂存。**不做任何规则结算** —— 规则只跑在房主浏览器里。
 *
 * 2026-09-16 收口：**服务器权威引擎（方案 C）已整条删除**。
 *   原因：cloudflare/engine-runtime.js 是 game.html 的生成副本，但已双向漂移
 *   （game.html 有 106 行不在副本里、副本有 25 行不在 game.html 里），
 *   例如 __cloneDeckCard/__cloneDeckSlots 在副本里 0 命中 —— 服务端跑的是旧规则；
 *   而所有离线测试读的是 game.html 本体（lib/harness.js:364），
 *   于是长期处于"测试全绿、线上跑另一份代码"的状态。
 *   已删除：engine-room.js / engine-runtime.js / engine-dom.js / engine-host.js / card-data.js，
 *   以及客户端进入该路径的唯一入口（?engine=1 已不再生效）。
 *   详见仓库根目录《收口记录.md》。
 *
 * 对前端呈现的协议（与 Node 版 online_server.js 一致的“单跳”版）：
 *   HTTP  GET /health           -> {ok:true}
 *   HTTP  GET /newroom          -> {code:"ABCD"}
 *   WS    /?r=CODE              建立后首条发 {t:'hello',role:'host'|'guest',name}
 *     server -> joined{id,sid,isHost} / room{players:[{sid,name,ready}]}
 *               start{seed,first:hostSid} / relay{m} / oppLeft / peerLost / peerBack
 *               resync{s} / error{msg,code}
 *     client -> hello / ready / relay{m} / resync / leave
 * ===================================================================== */

const ROOM_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混 0/O 1/I

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

export class RoomObject {
  constructor(state, env) {
    this.state = state;
    /** @type {{ws:WebSocket,sid:string,name:string,ready:boolean,isHost:boolean}[]} */
    this.players = [];
    this.hostSid = '';
    this.started = false;
    this.seq = 0;
    /* 房主权威式联机：这里存一份"权威自存快照"，供任意一方重连时恢复。
       放进 DO storage 是为了即使两端都断开、DO 被回收后再拉起，快照依然在。
       this.defs 是累积的卡定义字典（房主每份快照只带新增定义）。 */
    this.lastSnap = null;
    /* 收口·第 2 步：**引擎空闲时刻的检查点**。
       为什么单独留一份：房主的快照是"每 30ms 去抖 + 每 1.5 秒巡检"推的，很可能正好拍在一次
       结算中途；而 `effectEngine._resolveDepth` / `_chainLock` / 各种待应答队列**不进快照**
       （里面的回调是闭包，存不进去）。用"结算中途"的快照恢复房主，就会恢复出一个
       "结算到一半但没人知道"的局面 —— 这就是"重连后卡死"这一族。
       所以：客户端在每份快照上标 `idle`，这里只把 idle 的那份留作 safeSnap，恢复时优先用它。 */
    this.safeSnap = null;
    this.defs = {};
    this.lost = { host: false, guest: false };
    this.lostTok = { host: 0, guest: 0 };
    this.ready = state.blockConcurrencyWhile(async () => {
      try {
        this.lastSnap = (await state.storage.get('snap')) || null;
        if (this.lastSnap && this.lastSnap.cards) this.defs = this.lastSnap.cards;
      } catch (e) { this.lastSnap = null; }
      try { this.safeSnap = (await state.storage.get('safeSnap')) || null; } catch (e) { this.safeSnap = null; }
    });
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

    const pair = new WebSocketPair();
    const server = pair[1];
    server.accept();
    const sid = 's' + (++this.seq) + '_' + Math.random().toString(36).slice(2, 7);
    const me = { ws: server, sid, name: '玩家', ready: false, isHost: false, greeted: false };
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
          break;
        }
        case 'ready': {
          me.ready = true;
          this._broadcast(this._snapshot());
          this._tryStart();
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
              /* 只把"引擎空闲时刻"的那一份留作安全恢复点（收口·第 2 步）。
                 注意**不能**用后一份非空闲快照覆盖它 —— 否则一次长结算就会把仅有的检查点冲掉。 */
              if (s.idle) {
                this.safeSnap = stored;
                try { this.state.storage.put('safeSnap', stored); } catch (e) {}
              }
            }
            break;
          }
          this._broadcast({ t: 'relay', m: mm }, server);
          break;
        }
        case 'resync': {
          /* 重连方索要最近一份权威快照（房主专用：客人走 resyncReq 让房主现生成客人视角视图）。
             收口·第 2 步：**优先给引擎空闲检查点**；没有检查点时才退回最近一份，
             并用 safe:false + idleWhy 明确告诉房主"这次恢复取自结算中途"，由它提示玩家。 */
          let s = this.safeSnap || this.lastSnap;
          if (!s) { try { s = (await this.state.storage.get('safeSnap')) || (await this.state.storage.get('snap')) || null; } catch (e) {} }
          this._send(server, { t: 'resync', s: s || null, safe: !!this.safeSnap, idleWhy: (this.safeSnap ? '' : (s && s.idleWhy) || '') });
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

/* 收集快照 state 里引用到的所有卡 uid（仅用于上面那次"紧急剪枝"）。 */
function collectUids(v, out) {
  if (!v || typeof v !== 'object') return out;
  if (Array.isArray(v)) { for (const x of v) collectUids(x, out); return out; }
  if (v.__u) { out[v.__u] = 1; return out; }
  for (const k in v) collectUids(v[k], out);
  return out;
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
      return new Response(JSON.stringify({ ok: true, ts: Date.now(), authority: 'host' }), { headers: CORS });
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
