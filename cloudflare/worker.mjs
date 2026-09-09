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

export class RoomObject {
  constructor(state, env) {
    this.state = state;
    /** @type {{ws:WebSocket,sid:string,name:string,ready:boolean,isHost:boolean}[]} */
    this.players = [];
    this.hostSid = '';
    this.started = false;
    this.seq = 0;
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

    server.addEventListener('message', (ev) => {
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
            this._send(server, { t: 'joined', id: this.code, sid, isHost: true });
          } else {
            if (this.started) { this._send(server, { t: 'error', msg: '对局已经开始，无法加入' }); try { server.close(); } catch (e) {} return; }
            if (this.players.filter((p) => p.greeted).length > MAX) {
              this._send(server, { t: 'error', msg: '房间已满（2 人）' }); try { server.close(); } catch (e) {} return;
            }
            this._send(server, { t: 'joined', id: this.code, sid, isHost: false });
          }
          this._broadcast(this._snapshot());
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
          this._broadcast({ t: 'relay', m: m.m }, server);
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
      if (me.isHost && this.hostSid === sid) this.hostSid = '';
      this._broadcast({ t: 'oppLeft' });
      this._broadcast(this._snapshot());
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
