/* =====================================================================
 * online_server.js —— 入局者联机【中继服务器】（确定性双机推演，单跳协议）
 * ---------------------------------------------------------------------
 * 与 game.html 内的前端 Online 层（原生 WebSocket）严格配对，只做三件事：
 *   1) 房号：HTTP GET /newroom 生成 4 位房号并预占房间；
 *   2) 开局：WS 连接 /?r=房号，首条 hello{role:'host'|'guest',name}，
 *      两人都 ready 后下发同一权威随机种子 seed 与先手 first；
 *   3) 中继：把一方的 relay 消息原样转发给同房间另一方。
 * 服务器【不做任何规则结算】：双方浏览器用同一份引擎 + 同一颗种子做确定性
 * 双机推演，保证洗牌/骰子/判定一致。协议与 cloudflare/worker.mjs 完全对齐。
 *
 * 运行：node online_server.js   （默认端口 2567；云端注入 process.env.PORT）
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
    for (const [sid, p] of this.players) players.push({ sid, name: p.name, ready: p.ready });
    return { t: 'room', players };
  }
  tryStart() {
    if (this.started || this.size() < MAX_PER_ROOM) return;
    for (const p of this.players.values()) if (!p.ready) return;
    this.started = true;
    const seed = nowSeed();
    for (const sid of this.players.keys()) this.send(sid, { t: 'start', seed, first: this.hostSid });
    console.log(`[room ${this.id}] 对局开始 seed=${seed} host=${this.hostSid}`);
  }
}

const JSON_CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': '*'
};
const server = http.createServer((req, res) => {
  const u = req.url || '';
  if (req.method === 'OPTIONS') { res.writeHead(204, JSON_CORS); return res.end(); }
  if (u.split('?')[0] === '/health') {
    res.writeHead(200, JSON_CORS);
    return res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
  }
  if (u.split('?')[0] === '/newroom') {
    const r = new Room(genRoomId());
    rooms.set(r.id, r); // 预占房号，host 凭此房号连入成为房主
    res.writeHead(200, JSON_CORS);
    return res.end(JSON.stringify({ code: r.id }));
  }
  res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }); res.end('rujuzhe relay server');
});

const wss = new WebSocketServer({ server });
let sidSeq = 0;

wss.on('connection', (ws, req) => {
  const code = (new URL(req.url, 'http://x').searchParams.get('r') || '').toUpperCase();
  const room = rooms.get(code);
  if (!room) { try { ws.send(JSON.stringify({ t: 'error', msg: '房间不存在，请先创建或核对房号' })); ws.close(); } catch (e) {} return; }
  ws.roomId = code;
  const sid = 's' + (++sidSeq) + '_' + Date.now().toString(36);
  ws.sid = sid; ws.greeted = false;
  const send = (obj) => { if (ws.readyState === 1) { try { ws.send(JSON.stringify(obj)); } catch (e) {} } };

  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch (e) { return; }

    if (m.t === 'hello' && !ws.greeted) {
      ws.greeted = true;
      const name = String(m.name || '玩家').slice(0, 16);
      if (m.role === 'host') {
        if (room.hostSid) { send({ t: 'error', code: 'ROOM_TAKEN', msg: '房间号已被占用，请重新创建' }); try { ws.close(); } catch (e) {} return; }
        room.hostSid = sid;
        room.players.set(sid, { name, ready: false, ws });
        send({ t: 'joined', id: code, sid, isHost: true });
      } else {
        if (room.started) { send({ t: 'error', msg: '对局已经开始，无法加入' }); try { ws.close(); } catch (e) {} return; }
        if (room.size() >= MAX_PER_ROOM) { send({ t: 'error', msg: '房间已满（2 人）' }); try { ws.close(); } catch (e) {} return; }
        room.players.set(sid, { name, ready: false, ws });
        send({ t: 'joined', id: code, sid, isHost: false });
      }
      room.broadcast(room.snapshot());
      send(room.snapshot());
      console.log(`[room ${code}] ${m.role === 'host' ? '房主' : '客人'} ${sid} 加入，现 ${room.size()} 人`);
      return;
    }

    if (!room.players.has(sid)) return;
    switch (m.t) {
      case 'ready': {
        const p = room.players.get(sid); if (!p) return;
        p.ready = true;
        room.broadcast(room.snapshot());
        room.tryStart();
        break;
      }
      case 'relay':
        room.broadcast({ t: 'relay', m: m.m }, sid);
        break;
      case 'leave':
        try { ws.close(); } catch (e) {}
        break;
      default: break;
    }
  });

  ws.on('close', () => {
    const id = ws.roomId;
    if (!id) return;
    const r = rooms.get(id);
    if (!r) { ws.roomId = null; return; }
    r.players.delete(sid);
    if (r.hostSid === sid) r.hostSid = '';
    if (r.size() === 0) { rooms.delete(id); console.log(`[room ${id}] 已空，销毁`); }
    else { r.broadcast({ t: 'oppLeft' }); r.broadcast(r.snapshot()); console.log(`[room ${id}] ${sid} 离开，剩 ${r.size()} 人`); }
    ws.roomId = null;
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[rujuzhe] 中继服务器已启动：ws 端口 ${PORT}（绑定 0.0.0.0，/health、/newroom，当前房间 0）`);
});
