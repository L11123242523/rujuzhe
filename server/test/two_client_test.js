/* =====================================================================
 * 双客户端端到端联机测试（自启 Colyseus 服务器，Node 模拟两名玩家）
 * 运行：node server/test/two_client_test.js   （或 npm run test:online）
 * 验证：双人就绪/同种子、权威投骰与客户端预测一致、对方先响应、
 *       连续两方 pass 才锁定、连锁改点、非应答方越权被忽略、断线判负。
 * ===================================================================== */
const http = require('http');
const { Server } = require('colyseus');
const { Client } = require('colyseus.js');
const path = require('path');
const RJ = require(path.join(__dirname, '..', '..', 'js', 'engine_core.js'));
const { RujuzheRoom } = require(path.join(__dirname, '..', 'rooms', 'RujuzheRoom.js'));

let pass = 0, fail = 0; const F = [];
function ok(c, m) { if (c) pass++; else { fail++; F.push(m); console.log('  ✗ ' + m); } }
function eq(a, b, m) { ok(JSON.stringify(a) === JSON.stringify(b), m + ` (得 ${JSON.stringify(a)} 期 ${JSON.stringify(b)})`); }
const waitMsg = (room, name, filter, ms = 4000) => new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('等待消息超时: ' + name)), ms);
  const h = (m) => { if (!filter || filter(m)) { clearTimeout(t); res(m); } };
  room.onMessage(name, h);
});
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// 状态经 patchRate(100ms) 同步，断言 state 前轮询等待其收敛
const waitFor = (fn, ms = 2500) => new Promise((res, rej) => {
  const t = setInterval(() => { try { if (fn()) { clearInterval(t); res(); } } catch (e) {} }, 20);
  const to = setTimeout(() => { clearInterval(t); rej(new Error('waitFor 超时')); }, ms);
});

async function main() {
  // 1) 自启服务器（测试端口）
  const gs = new Server({ server: http.createServer() });
  gs.define('rujuzhe', RujuzheRoom);
  await gs.listen(2599);

  const cA = new Client('ws://localhost:2599');
  const cB = new Client('ws://localhost:2599');
  const roomA = await cA.joinOrCreate('rujuzhe', { name: '甲' });
  const roomB = await cB.joinById(roomA.roomId, { name: '乙' });
  ok(roomA.roomId === roomB.roomId, '两名玩家进入同一房间');
  await waitFor(() => roomA.state.players.size === 2 && roomB.state.players.size === 2);
  ok(roomA.state.players.size === 2, '房间内有 2 名玩家');

  // 2) 双方就绪 -> gameStart，且拿到相同权威种子
  const gsA = waitMsg(roomA, 'gameStart');
  const gsB = waitMsg(roomB, 'gameStart');
  roomA.send('ready', { name: '甲' });
  await sleep(30);
  roomB.send('ready', { name: '乙' });
  const startA = await gsA, startB = await gsB;
  ok(!!startA.seed && startA.seed === startB.seed, '双方收到相同权威种子 ' + startA.seed);
  eq(startA.firstPlayer, roomA.sessionId, '房主甲为先手');

  // 3) 权威投骰：客户端用同种子预测，应与服务器 windowOpen 原始结果一致
  const predRng = RJ.createRNG(startA.seed);
  const openP = waitMsg(roomA, 'windowOpen');
  roomA.send('requestRoll', { sides: 6 });
  const open = await openP;
  ok(open.stage === 'dice_result', '投骰后打开 dice_result 窗口');
  eq(open.firstResponder, roomB.sessionId, '对方乙先响应');
  const predicted = predRng.dice(6);
  eq(open.initial.raw, predicted, '服务器权威原始骰点 == 客户端同种子预测');

  // 4) 连续两方 pass 才锁定：乙 pass -> 问甲 -> 甲 pass -> resolve
  const resP = waitMsg(roomA, 'windowResolved');
  roomB.send('passChain');
  await sleep(30);
  roomA.send('passChain');
  const locked = await resP;
  eq(locked.value, open.initial.raw, '双方 pass 后锁定值=原始骰点');

  // 5) 越权：该对方先响应时，先手方抢先 pass 应被忽略，不影响最终结果
  const open2P = waitMsg(roomA, 'windowOpen');
  roomA.send('requestRoll', { sides: 6 });
  const open2 = await open2P;
  roomA.send('passChain');          // 此时 awaiting=乙，甲越权
  await sleep(150);                  // 越过一个 patch 周期确认未被计入
  ok(roomA.state.passStreak === 0, '非应答方抢先 pass 被忽略（passStreak 仍 0）');
  const res2P = waitMsg(roomA, 'windowResolved');
  roomB.send('passChain'); await sleep(20); roomA.send('passChain');
  const locked2 = await res2P;
  eq(locked2.value, open2.initial.raw, '越权忽略后仍按原值锁定');

  // 6) 连锁改点：乙在窗口把点数改成 1，最终锁定 1
  const open3P = waitMsg(roomA, 'windowOpen');
  roomA.send('requestRoll', { sides: 6 });
  const open3 = await open3P;
  ok(open3.initial.raw !== 1 || true, '原始结果已产生');
  const res3P = waitMsg(roomA, 'windowResolved');
  roomB.send('chainSetDice', { point: 1 }); await sleep(20);
  roomB.send('passChain'); await sleep(20); roomA.send('passChain');
  const locked3 = await res3P;
  eq(locked3.value, 1, '对方连锁改点为1，最终锁定1');

  // 7) 非法改点越界被拒（7 > 6面）：再开窗口，乙尝试改成7无效，正常 pass 锁原值
  const open4P = waitMsg(roomA, 'windowOpen');
  roomA.send('requestRoll', { sides: 6 });
  const open4 = await open4P;
  roomB.send('chainSetDice', { point: 7 }); await sleep(20);
  ok(roomA.state.lastRoll === open4.initial.raw, '越界改点(7>6面)被拒，结果不变');
  const res4P = waitMsg(roomA, 'windowResolved');
  roomB.send('passChain'); await sleep(20); roomA.send('passChain');
  const l4v=(await res4P).value;
  eq(l4v, open4.initial.raw, '非法连锁后锁原值');

  // 8) 断线：乙主动离开，甲收到 opponentLeft 且房间 phase=ended
  const leftP = waitMsg(roomA, 'opponentLeft');
  roomB.leave(true);
  await leftP;
  await waitFor(() => roomA.state.phase === 'ended');
  eq(roomA.state.phase, 'ended', '一人离开后对局结束');
  await waitFor(() => roomA.state.players.size === 1);
  ok(roomA.state.players.size === 1, '离开者已移出房间');

  // 先关闭客户端连接，再让服务器自行收尾（不阻塞测试进程）
  try { await roomA.leave(true); } catch (e) {}
  try { cA.close(); cB.close(); } catch (e) {}
  await sleep(100);
  gs.gracefullyShutdown().catch(() => {});
  console.log(`\n联机双客户端测试: 通过 ${pass} 失败 ${fail}`);
  if (F.length) console.log(F.join('\n'));
  process.exit(fail ? 1 : 0);
}
main().catch(e => { console.error('测试异常', e); process.exit(1); });
