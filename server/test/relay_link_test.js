/* 中继服链路测试（单跳协议：/newroom 取号 -> ws /?r=房号 -> hello host/guest）。
   用法：先启动 node online_server.js，再 node server/test/relay_link_test.js */
const WebSocket = require('ws');
const P = process.env.RELAY_PORT || '2567';
const HTTP = 'http://localhost:' + P, URL = 'ws://localhost:' + P;
let pass = 0, fail = 0; const F = [];
const ok = (c, m) => { if (c) { pass++; } else { fail++; F.push(m); console.log('  ✗ ' + m); } };
const wait = (ws, cond, ms = 3000) => new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('等消息超时')), ms); ws.on('message', b => { const m = JSON.parse(b); if (cond(m)) { clearTimeout(t); res(m); } }); });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const nr = await (await fetch(HTTP + '/newroom')).json();
  ok(/^[A-Z0-9]{4}$/.test(nr.code), 'GET /newroom 返回4位房号 ' + nr.code);
  const code = nr.code;

  const A = new WebSocket(`${URL}/?r=${code}`), B = new WebSocket(`${URL}/?r=${code}`);
  await new Promise(r => A.on('open', r)), await new Promise(r => B.on('open', r));

  let pA = wait(A, m => m.t === 'joined');
  A.send(JSON.stringify({ t: 'hello', role: 'host', name: '甲' }));
  const jA = await pA; ok(jA.isHost === true && jA.id === code && jA.sid, 'A 成为房主并拿到房号 ' + jA.id);

  let pB = wait(B, m => m.t === 'joined');
  B.send(JSON.stringify({ t: 'hello', role: 'guest', name: '乙' }));
  const jB = await pB; ok(jB.id === code && jB.isHost === false && jB.sid !== jA.sid, 'B 凭房号加入同一房间');

  let sA = wait(A, m => m.t === 'start'), sB = wait(B, m => m.t === 'start');
  A.send(JSON.stringify({ t: 'ready' })); await sleep(20); B.send(JSON.stringify({ t: 'ready' }));
  const stA = await sA, stB = await sB;
  ok(!!stA.seed && stA.seed === stB.seed, '双方收到相同种子 ' + stA.seed);
  ok(stA.first === jA.sid, '先手=房主A');

  let got = false; B.on('message', b => { const m = JSON.parse(b); if (m.t === 'relay' && m.m && m.m.k === 'intent') got = m.m; });
  A.send(JSON.stringify({ t: 'relay', m: { k: 'intent', a: { type: 'roll' } } }));
  await sleep(100);
  ok(got && got.a.type === 'roll', 'A 的意图被中继到 B');

  // 错误房号：连接一个从未 /newroom 预占的房号，服务端立即 error 并关闭
  const C = new WebSocket(`${URL}/?r=ZZZZ`);
  await new Promise(r => C.on('open', r));
  const e = await wait(C, m => m.t === 'error'); ok(!!e.msg, '不存在房号返回 error'); C.close();

  let pL = wait(A, m => m.t === 'oppLeft'); B.close(); await pL;
  ok(true, '一方掉线，另一方收到 oppLeft');
  A.close();
  await sleep(80);
  console.log(`\n中继服链路测试[端口${P}]: 通过 ${pass} 失败 ${fail}`);
  if (F.length) console.log(F.join('\n'));
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('测试异常', e); process.exit(1); });
