/* =====================================================================
 * online_server.js —— 入局者联机【中继服务器】（方案B：确定性双机推演）
 * ---------------------------------------------------------------------
 * 与 game.html 内的前端 Online 层（原生 WebSocket）严格配对，只做三件事：
 *   1) 房间：create / join / ready / leave，生成 4 位房号；
 *   2) 开局：两人都准备后下发同一权威随机种子 seed 与先手 first；
 *   3) 中继：把一方的 relay 消息原样转发给同房间另一方（意图/答案/卡组/emote）。
 * 服务器【不做任何规则结算】：双方浏览器用同一份引擎 + 同一颗种子做确定性
 * 双机推演，保证洗牌/骰子/判定一致。
 *
 * 运行：node online_server.js        （默认端口 2567，前端本地默认连此端口）
 * 部署：Render/Railway 等会注入 process.env.PORT；本地可用 wss 由反代负责。
 * ===================================================================== */
const http = require('http');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 2567;
const MAX_PER_ROOM = 2;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 去掉易混 0/O 1/I

/** @type {Map<string, Room>} key=房号 */
const rooms = new Map();

function genRoomId() {
  let id;
  do {
    id = '';
    for (let i = 0; i < 4; i++) id += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
  } while (rooms.has(id));
  return id;
}

function nowSeed() {
  return process.env.FIXED_SEED ? (parseInt(process.env.FIXED_SEED, 10) >>> 0) : ((Date.now() >>> 0) ^ (Math.floor(Math.random() * 4294967296) >>> 0)) >>> 0;
}

class Room {
  constructor(id) {
    this.id = id;
    /** @type {Map<string,{name:string,ready:boolean,ws:any}>} key=sessionId */
    this.players = new Map();
    this.hostSid = '';
    this.started = false;
  }
  size() { return this.players.size; }
  send(sid, obj) {
    const p = this.players.get(sid);
    if (p && p.ws && p.ws.readyState === 1) { try { p.ws.send(JSON.stringify(obj)); } catch (e) {} }
  }
  broadcast(obj, exceptSid) {
    for (const [sid, p] of this.players) {
      if (sid === exceptSid) continue;
      if (p.ws.readyState === 1) { try { p.ws.send(JSON.stringify(obj)); } catch (e) {} }
    }
  }
  snapshot() {
    const players = [];
    for (const [sid, p] of this.players) players.push({ sid: sid, name: p.name, ready: p.ready });
    return { t: 'room', players: players };
  }
  // 双方都准备 -> 下发同一颗种子与先手（只发一次）
  tryStart() {
    if (this.started || this.size() < MAX_PER_ROOM) return;
    for (const p of this.players.values()) if (!p.ready) return;
    this.started = true;
    const seed = nowSeed();
    for (const sid of this.players.keys()) {
      this.send(sid, { t: 'start', seed: seed, first: this.hostSid });
    }
    console.log(`[room ${this.id}] 对局开始 seed=${seed} host=${this.hostSid}`);
  }
}

const server = http.createServer((req, res) => {
  if (req.url === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ ok: true, rooms: rooms.size })); }
  res.writeHead(404); res.end('rujuzhe relay server');
});
const wss = new WebSocketServer({ server });
let sidSeq = 0;

wss.on('connection', (ws) => {
  const sid = 's' + (++sidSeq) + '_' + Date.now().toString(36);
  ws.sid = sid; ws.roomId = null;
  const send = (obj) => { if (ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); } catch (e) {} } };

  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }
    const room = ws.roomId ? rooms.get(ws.roomId) : null;

    switch (m.t) {
      case 'create': {
        if (ws.roomId) return;
        const id = genRoomId();
        const r = new Room(id);
        rooms.set(id, r);
        ws.roomId = id; r.hostSid = sid;
        r.players.set(sid, { name: String(m.name || '玩家').slice(0, 16), ready: false, ws: ws });
        send({ t: 'joined', id: id, sid: sid, isHost: true });
        r.broadcast(r.snapshot());
        console.log(`[room ${id}] 创建，房主 ${sid}`);
        break;
      }
      case 'join': {
        if (ws.roomId) return;
        const id = String(m.id || '').toUpperCase();
        const r = rooms.get(id);
        if (!r) { send({ t: 'error', msg: '房间不存在，请核对房号' }); return; }
        if (r.started) { send({ t: 'error', msg: '对局已经开始，无法加入' }); return; }
        if (r.size() >= MAX_PER_ROOM) { send({ t: 'error', msg: '房间已满（2 人）' }); return; }
        ws.roomId = id;
        r.players.set(sid, { name: String(m.name || '玩家').slice(0, 16), ready: false, ws: ws });
        send({ t: 'joined', id: id, sid: sid, isHost: false });
        r.broadcast(r.snapshot());
        console.log(`[room ${id}] 加入 ${sid}，现 ${r.size()} 人`);
        break;
      }
      case 'ready': {
        if (!room) return;
        const p = room.players.get(sid); if (!p) return;
        p.ready = true;
        room.broadcast(room.snapshot());
        room.tryStart();
        break;
      }
      case 'relay': {
        // 原样转发给同房间另一方（意图 intent / 答案 answer / 卡组 deck / emote）
        if (!room) return;
        room.broadcast({ t: 'relay', m: m.m }, sid);
        break;
      }
      case 'leave': {
        ws.close(); break;
      }
      default: break;
    }
  });

  ws.on('close', () => {
    const id = ws.roomId;
    if (!id) return;
    const r = rooms.get(id);
    if (!r) { ws.roomId = null; return; }
    r.players.delete(sid);
    r.broadcast({ t: 'oppLeft' });
    if (r.size() === 0) { rooms.delete(id); console.log(`[room ${id}] 已空，销毁`); }
    else { r.broadcast(r.snapshot()); console.log(`[room ${id}] ${sid} 离开，剩 ${r.size()} 人`); }
    ws.roomId = null;
  });
});

server.listen(PORT, () => {
  console.log(`[rujuzhe] 中继服务器已启动：ws 端口 ${PORT}（健康检查 /health，当前房间 0）`);
});
