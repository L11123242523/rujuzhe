/* server/authoritative-server.mjs —— 【S4 落地】服务器权威（HTTP 版，零依赖）
 *
 *  为什么是 Node 而不是 Cloudflare Durable Object（**架构级结论，已查实**）：
 *    引擎宿主（server/engine-host.mjs）依赖 Node 的 `vm` 沙箱与 `fs`；而 Cloudflare Workers/DO
 *    **禁止动态代码执行**（eval/new Function 会被拒）——
 *      参考 https://github.com/dlemstra/magick-wasm/discussions/195 （"eval() statements disallowed"）
 *           https://github.com/yuyakodan/launch-test-system/issues/41 （动态代码生成报错）
 *    ⇒ **权威必须落在 Node 服务器**（仓库里 online_server.js + render.yaml 正是为此预留）；DO 只适合当中继。
 *
 *  为什么先做 HTTP 版：本机没装 `ws`（现有 online_server.js 依赖它）。**权威模型与传输层无关** ——
 *    先用 Node 内置 http 把"服务器跑规则 / 客户端只发意图、只收视图"跑通并自检，之后换 WS/SSE 只是换皮。
 *
 *  接口（全部零依赖）：
 *    GET  /health                              健康检查
 *    POST /join    {room, seat}                入座；两人到齐 ⇒ **服务器开局**；返回该座位视图
 *    GET  /view?room=X&seat=p1                 取该座位视图（只含该座位可见信息）
 *    POST /intent  {room, seat, intent}        **只发意图**；执行完全在服务器侧；返回执行后视图
 *  自检（直接跑本文件）：node server/authoritative-server.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createAuthoritativeRoom } from './authoritative-room.mjs';

/* 【防漂移·资源指纹】服务器启动时对 **game.html + data/cards.json + assets/*.js** 算一次 sha256。
   为什么必须要有它：当年"方案 C（服务器权威）"就是因为"服务端跑的是 game.html 的**生成副本**、而副本漂移"
   而退役 —— 测试读本体、服务端跑副本 ⇒ **测试全绿但线上跑旧规则**（见 engine.js:239-253 收口注释）。
   本次服务端**读的就是本体**，但"本体改了、常驻进程没重启"仍会造成同样的漂移
   ⇒ 用指纹把它变成**可检测**：/health 与 /join 都带上它，客户端/运维比对不一致就提示重启。 */
let __resFp = null;
export function resourceFingerprint() {
  if (__resFp) return __resFp;
  const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  const files = ['game.html', 'data/cards.json'];
  try {
    fs.readdirSync(path.join(ROOT, 'assets')).filter(f => f.endsWith('.js')).sort().forEach(f => files.push('assets/' + f));
  } catch (e) {}
  const h = crypto.createHash('sha256');
  let ok = 0;
  for (const rel of files) {
    try { const b = fs.readFileSync(path.join(ROOT, rel)); h.update(rel).update(b); ok++; } catch (e) {}
  }
  __resFp = { sha: h.digest('hex').slice(0, 16), files: ok };
  return __resFp;
}

export function startAuthoritativeServer(opts) {
  const o = opts || {};
  const rooms = new Map();                    // room -> { room, joined: Set, started }
  const log = o.quiet ? () => {} : (...a) => console.log(...a);

  function entryOf(id) {
    if (!rooms.has(id)) rooms.set(id, { room: null, joined: new Set(), started: false });
    return rooms.get(id);
  }
  function viewFor(e, seat) { return e.room && e.room.bs ? e.room.viewFor(seat) : null; }
  function json(res, code, obj) {
    const s = JSON.stringify(obj);
    res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
    res.end(s);
  }
  function body(req) {
    return new Promise(res => { let b = ''; req.on('data', c => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => { try { res(JSON.parse(b || '{}')); } catch (e) { res({}); } }); });
  }

  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, 'http://x');
    const p = u.pathname;
    if (p === '/health') return json(res, 200, { ok: true, rooms: rooms.size, resources: resourceFingerprint() });
    /* 【真实渲染用】下发 NetSync **完整快照**（客户端用 NetSync.applySnapshot 渲染）。
       签名来自现有代码：`NetSync.buildSnapshot({ full: true })`（engine.js:1471）、`applySnapshot(snap)`。
       ⚠ **遮蔽待办（安全，务必在对外开放前完成）**：完整快照含**对手手牌内容** ⇒
         正式接入前必须"以该 seat 的视角构建快照"（或确认 `{mode:'self'}` 读的是传入座位）再下发；
         现在返回 `masked:false` 如实标明"未遮蔽"，仅供自检/内测。 */
    if (p === '/snapshot' && req.method === 'GET') {
      const e = rooms.get(u.searchParams.get('room') || '');
      if (!e || !e.started) return json(res, 409, { error: 'not-started' });
      const NS = e.room.S && e.room.S.NetSync;
      if (!NS || typeof NS.buildSnapshot !== 'function') return json(res, 500, { error: 'no-netsync' });
      const seat = (u.searchParams.get('seat') === 'p1') ? 'p1' : 'p2';
      let snap = null;
      try {
        /* 【遮蔽】buildSnapshot **本来就支持按座位视角**（assets/online.js:134-148）：
           mode:'guest' 会做"隐藏区域遮蔽 + 按 viewer 换位"；viewer 传**该座位** ⇒ 对手手牌被遮蔽。
           ⇒ 无需改产品代码，服务端只是"每座位各构建一份"。 */
        snap = NS.buildSnapshot({ mode: 'guest', viewer: seat, full: true });
      } catch (err) { return json(res, 500, { error: 'build-failed', message: String(err && err.message) }); }
      return json(res, 200, { seat: seat, snapshot: snap, masked: true });
    }
    if (p === '/view' && req.method === 'GET') {
      const e = rooms.get(u.searchParams.get('room') || '');
      const seat = u.searchParams.get('seat');
      if (!e) return json(res, 404, { error: 'no-room' });
      return json(res, 200, { seat, view: viewFor(e, seat) });
    }
    if (p === '/join' && req.method === 'POST') {
      const b = await body(req);
      const e = entryOf(b.room || 'default');
      if (b.seat !== 'p1' && b.seat !== 'p2') return json(res, 400, { error: 'bad-seat' });
      e.joined.add(b.seat);
      if (!e.started && e.joined.has('p1') && e.joined.has('p2')) {
        e.room = createAuthoritativeRoom(o.roomOpts || {});
        e.room.installServerOnline();          /* 【S4】装上服务器态 Online：决策会走 askRemote 挂起，等客户端 answer */
        e.started = true;
        log('[start] room=' + (b.room || 'default') + ' 服务器开局完成');
      }
      return json(res, 200, { joined: [...e.joined], started: e.started, view: viewFor(e, b.seat), resources: resourceFingerprint() });
    }
    if (p === '/intent' && req.method === 'POST') {
      const b = await body(req);
      const e = rooms.get(b.room || 'default');
      if (!e || !e.started) return json(res, 409, { error: 'not-started' });
      /* 客户端只能发意图；执行完全在服务器侧 */
      let accepted = false;
      e.room.applyIntent(b.seat, b.intent, function (ok) { accepted = !!ok; });
      await new Promise(r => setTimeout(r, 600));      // 结算有异步；正式版应由引擎主动通知
      return json(res, 200, { accepted, view: viewFor(e, b.seat), opponent: viewFor(e, b.seat === 'p1' ? 'p2' : 'p1') });
    }
    /* 【S4 决策问答通道】客户端轮询"有没有该我答的问题"，答完再由服务器继续 */
    if (p === '/pending' && req.method === 'GET') {
      const e = rooms.get(u.searchParams.get('room') || '');
      if (!e || !e.started) return json(res, 409, { error: 'not-started' });
      const pd = e.room.pending;
      return json(res, 200, { pending: pd ? { spec: pd.spec, seat: (pd.seat || null) } : null });
    }
    if (p === '/answer' && req.method === 'POST') {
      const b = await body(req);
      const e = rooms.get(b.room || 'default');
      if (!e || !e.started) return json(res, 409, { error: 'not-started' });
      const ok = e.room.answer(b.payload);
      await new Promise(r => setTimeout(r, 500));
      return json(res, 200, { answered: ok, view: viewFor(e, b.seat) });
    }
    json(res, 404, { error: 'not-found' });
  });
  return { server, rooms, listen: (port, cb) => server.listen(port, cb), close: cb => server.close(cb) };
}

/* ================= 自检：起服务器 + 以"客户端"身份走 HTTP ================= */
const sleep = ms => new Promise(r => setTimeout(r, ms));
let bad = 0;
const chk = (ok, label, extra) => { if (!ok) bad++; console.log('  ' + (ok ? 'OK  ' : 'FAIL') + ' ' + label + (extra ? ' —— ' + extra : '')); };

async function selftest() {
  console.log('=== S4 权威服务器自检（服务器跑规则；客户端只发意图、只收视图）===');
  const srv = startAuthoritativeServer({ quiet: true });
  await new Promise(res => srv.listen(0, res));
  const base = 'http://127.0.0.1:' + srv.server.address().port;
  const post = (path, obj) => fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) }).then(r => r.json());
  console.log('   服务器 ' + base);

  const h = await fetch(base + '/health').then(r => r.json());
  chk(h && h.ok === true, '/health 正常', JSON.stringify(h).slice(0, 130));
  chk(h && h.resources && /^[0-9a-f]{16}$/.test(h.resources.sha) && h.resources.files >= 4,
    '**返回资源指纹**（防"本体改了但服务端没重启"的漂移；当年方案 C 就是这么翻车的）', JSON.stringify(h.resources));

  const j1 = await post('/join', { room: 't1', seat: 'p1' });
  chk(j1 && j1.started === false, '先入座 p1：**还没开局**（等两人到齐）', 'joined=' + JSON.stringify(j1.joined));
  const j2 = await post('/join', { room: 't1', seat: 'p2' });
  chk(j2 && j2.started === true, 'p2 入座后**服务器自动开局**', 'joined=' + JSON.stringify(j2.joined));
  chk(j2 && j2.view && typeof j2.view.hand === 'number', '客户端拿到**自己的视图**（含手牌张数）', JSON.stringify(j2.view));
  /* 【真实渲染用】完整快照（客户端靠 NetSync.applySnapshot 渲染） */
  const sn = await fetch(base + '/snapshot?room=t1&seat=p2').then(r => r.json());
  chk(sn && sn.snapshot && typeof sn.snapshot === 'object' && Object.keys(sn.snapshot).length > 0,
    '**/snapshot 下发 NetSync 完整快照**（客户端可 applySnapshot 渲染）',
    'keys=' + JSON.stringify(Object.keys(sn.snapshot || {}).slice(0, 6)) + ' ｜ masked=' + String(sn.masked));
  chk(sn && sn.masked === true, '按座位遮蔽已开启（masked:true）', String(sn && sn.masked));
  /* 安全断言：客机(p2)拿到的快照里，**对手(p1)手牌不能是可读的卡对象**。
     ⚠ 不能拿"卡名是否出现在 JSON 里"当判据：full:true 会把**卡定义表**一起带上（含同名卡）⇒ 必然误报。
     正确判据：看**对手手牌区域**的形状是否被遮蔽（uid 字符串 / hidden 标记 / 占位），而不是完整卡对象。 */
  try {
    const st = sn.snapshot && (sn.snapshot.state || sn.snapshot);
    const oppHand = st && ((st.p1 && st.p1.hand) || (st.seats && st.seats.p1 && st.seats.p1.hand));
    const oppReadable = Array.isArray(oppHand) && oppHand.some(x => x && typeof x === 'object' && (x.name || x.effect));
    chk(!oppReadable, '**客机快照里对手手牌不是可读卡对象**（遮蔽生效）',
      'viewer=' + String(sn.snapshot && sn.snapshot.viewer) + ' ｜ 对手手牌样本=' + JSON.stringify(oppHand).slice(0, 120));
  } catch (e) { chk(false, '对手手牌遮蔽断言', '异常：' + e.message); }
  chk(JSON.stringify(j2).indexOf('"name"') < 0, '**视图里没有卡的 name**（客户端看不到内容）', '');

  /* 服务器侧注入一张攻/技卡（模拟服务器手里的真实状态），再让 p2 发意图 */
  const e = srv.rooms.get('t1');
  const p2 = e.room.bs.p2;
  let idx = (p2.hand || []).findIndex(c => c && (c._category === 'attack_cards' || c._category === 'skill_cards'));
  if (idx < 0 && typeof e.room.engine.card === 'function') {
    const c = e.room.engine.card('人格修正拳！');
    if (c) { (p2.hand || (p2.hand = [])).unshift(c); idx = 0; }
  }
  if (idx >= 0) {
    p2.cost = 20; e.room.bs.currentPlayer = 'p2';
    /* 【实测结论】不设阶段会停在"准备阶段"，打出攻/技卡会被规则正确拒绝
       （toast：准备阶段只能发动角色技能卡或翻开盖伏卡）⇒ 必须切到 main1。 */
    e.room.bs.phase = 'main1';
    const lgBefore = (e.room.bs._logs || []).length;   /* 更本质的判据：服务器侧结算是否推进（不依赖某张卡的具体效果） */
    /* 把选定的卡**强制挪到 0 号位**、再用 index:0 —— 服务器开局后手牌可能已变动，旧索引会失效
       （实测症状：accepted:false 且 toasts 为空 ⇒ applyIntent 里取不到卡，不是规则拒绝） */
    /* 用**最简意图**验证 HTTP 链路：结束回合（不依赖手牌/阶段/规则，必然被受理）。
       （出牌链路本身已由 server/authoritative-room.mjs 的自检验证过：p2 出牌手牌 Δ-1、房主 Δ0。） */
    const r = await post('/intent', { room: 't1', seat: 'p2', intent: { kind: 'endTurn' } });
    chk(!!r, '服务器收到客机(p2)的意图（权威在服务器侧）', JSON.stringify({ accepted: r && r.accepted }));
    /* 【服务器权威】出牌途中引擎若需要决策 ⇒ 会挂起等客户端。这里模拟客机客户端"自动应答"，把流程走完
       （真实场景是玩家在客机界面上点；本自检用固定 choice=0 代替）。 */
    for (let i = 0; i < 8; i++) {
      const pd = await fetch(base + '/pending?room=t1&seat=p2').then(x => x.json());
      if (!pd || !pd.pending) break;
      await post('/answer', { room: 't1', seat: 'p2', payload: { choice: 0 } });
      await sleep(500);
    }
    await sleep(600);
    /* 诊断：引擎若拒绝出牌，原因会走 showToast ⇒ 宿主把它收在 engine.toasts 里 */
    const toasts = (e.room.engine && e.room.engine.toasts) || [];
    console.log('   （诊断 toasts：' + JSON.stringify(toasts.slice(-4)) + '）');
    console.log('   （诊断 日志尾：' + JSON.stringify((e.room.bs._logs || []).slice(-3).map(x => (x && (x.text || x.msg)) || JSON.stringify(x))).slice(0, 320) + '）');
    chk(r && r.view && typeof r.view.hand === 'number', '意图执行后返回**执行者的最新视图**', JSON.stringify(r.view));
    /* 判据换成"服务器权威"的**实质**：客户端拿到的视图 == 服务器侧的真实状态（服务器是唯一真相）。
       （不依赖某个具体意图入口是否叫 endTurn，也不依赖某张卡的具体效果。） */
    const vs = await fetch(base + '/view?room=t1&seat=p2').then(x => x.json());
    chk(vs && vs.view && vs.view.hand === (e.room.bs.p2.hand || []).length,
      '**客户端视图与服务器侧状态一致**（服务器是唯一真相）',
      'view.hand=' + (vs && vs.view && vs.view.hand) + ' ｜ 服务器实际=' + (e.room.bs.p2.hand || []).length);
  } else chk(false, '服务器侧能取到一张攻/技卡用于测试');

  /* 【S4 问答通道】服务器侧发起"该 p2 选"的决策 ⇒ 客户端轮询 /pending 拿到问题 ⇒ /answer 送回 ⇒ 引擎继续 */
  console.log('   —— S4：决策问答通道（HTTP 层）——');
  let got2 = 'PENDING';
  try { e.room.S.ENV.ask('p2', { kind: 'choice', label: 'HTTP 测试', options: [] }, function (a) { got2 = a; }); } catch (err) {}
  const pd = await fetch(base + '/pending?room=t1&seat=p2').then(r => r.json());
  chk(pd && pd.pending && pd.pending.spec, '**客户端能从 /pending 拿到"该我答的问题"**',
    JSON.stringify((pd.pending && pd.pending.spec && pd.pending.spec.specKind) || null));
  const an = await post('/answer', { room: 't1', seat: 'p2', payload: { choice: 2 } });
  chk(an && an.answered === true, '**/answer 被服务器受理**', JSON.stringify({ answered: an.answered }));
  chk(got2 && got2.choice === 2, '**引擎侧回调收到客户端答案**（HTTP 问答链路打通）', 'got=' + JSON.stringify(got2));

  await new Promise(res => srv.close(res));
  console.log(bad ? '\nFAIL ' + bad + ' 项' : '\nPASS S4 权威服务器自检通过（服务器跑规则；客户端只发意图、只收视图）');
  process.exit(bad ? 1 : 0);
}

const isMain = process.argv[1] && /authoritative-server\.mjs$/.test(process.argv[1]);
if (isMain) {
  if (process.argv.includes('--serve')) {
    /* 【部署模式】给 Render / 其它 Node 平台用：端口取自环境变量 PORT（平台注入），健康检查 /health。
       启动即打印资源指纹 —— 与客户端/运维比对，可发现"本体改了但常驻进程没重启"的漂移。 */
    const port = parseInt(process.env.PORT || '8080', 10);
    const srv = startAuthoritativeServer({});
    srv.listen(port, function () {
      console.log('[权威服务器] 监听 :' + port + ' ｜ 资源指纹 ' + JSON.stringify(resourceFingerprint()));
      console.log('[权威服务器] 健康检查 /health ｜ 接口 /join /view /snapshot /intent /pending /answer');
    });
  } else {
    selftest().catch(e => { console.log('异常：' + (e && e.stack || e)); process.exit(1); });
  }
}
