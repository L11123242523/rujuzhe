// 中继单跳协议通用自测（Node 版 / Cloudflare 版均可），RELAY_PORT 指定端口
const WebSocket = require('ws');
const P = process.env.RELAY_PORT || '2567';
const BASE = 'http://127.0.0.1:' + P;
const WS = 'ws://127.0.0.1:' + P;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✅', m); } else { fail++; console.log('  ❌', m); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function open(u) { return new Promise((res, rej) => { const s = new WebSocket(u); s.inbox = []; s.on('message', d => { const m = JSON.parse(d.toString()); s.inbox.push(m); }); s.on('open', () => res(s)); s.on('error', rej); }); }
const waitFor = async (s, pred, ms = 3000) => new Promise((res) => { const t0 = Date.now(); (function t() { const h = s.inbox.find(pred); if (h) return res(h); if (Date.now() - t0 > ms) return res(null); setTimeout(t, 30); })(); });
const send = (s, o) => s.send(JSON.stringify(o));

(async () => {
  const nr = await (await fetch(BASE + '/newroom')).json();
  ok(/^[A-Z0-9]{4}$/.test(nr.code), '[' + P + '] /newroom 房号 ' + nr.code);
  const code = nr.code;
  const host = await open(`${WS}/?r=${code}`);
  send(host, { t: 'hello', role: 'host', name: '甲' });
  const jh = await waitFor(host, m => m.t === 'joined');
  ok(!!jh && jh.isHost === true && jh.id === code && !!jh.sid, '[' + P + '] 房主 joined');
  const hostSid = jh.sid;
  const guest = await open(`${WS}/?r=${code}`);
  send(guest, { t: 'hello', role: 'guest', name: '乙' });
  const jg = await waitFor(guest, m => m.t === 'joined');
  ok(!!jg && jg.isHost === false && jg.sid !== hostSid, '[' + P + '] 客人 joined，sid 不同');
  await sleep(120);
  ok(host.inbox.filter(m => m.t === 'room').pop().players.length === 2, '[' + P + '] 2人 room 快照');
  send(host, { t: 'ready' }); await sleep(60); send(guest, { t: 'ready' });
  const sh = await waitFor(host, m => m.t === 'start');
  const sg = await waitFor(guest, m => m.t === 'start');
  ok(!!sh && !!sg && sh.seed === sg.seed && sh.first === hostSid, '[' + P + '] 双方同 seed 且 first=房主');
  send(host, { t: 'relay', m: { k: 'intent', a: 1 } });
  const rg = await waitFor(guest, m => m.t === 'relay' && m.m && m.m.k === 'intent');
  ok(!!rg && rg.m.a === 1, '[' + P + '] host->guest 转发');
  await sleep(100);
  ok(!host.inbox.some(m => m.t === 'relay' && m.m && m.m.k === 'intent'), '[' + P + '] 不收自发');
  send(guest, { t: 'relay', m: { k: 'answer', v: 7 } });
  const rh = await waitFor(host, m => m.t === 'relay' && m.m && m.m.k === 'answer');
  ok(!!rh && rh.m.v === 7, '[' + P + '] guest->host 转发');
  host.close();
  ok(!!(await waitFor(guest, m => m.t === 'oppLeft')), '[' + P + '] oppLeft');
  host.close(); guest.close();
  console.log(`\n端口${P} 自测: 通过 ${pass} 失败 ${fail}\n`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
