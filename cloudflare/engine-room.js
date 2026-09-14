/* engine-room.js —— 每个房间一份「权威引擎」（C 阶段第 4 步 · 批次 2）
 * ===========================================================================
 * 目标形态（= 大师决斗 / 三国杀那一套）：**没有房主浏览器当权威**，权威在服务器里。
 *   一个 4 位房号 = 一个 Durable Object = 一份 `createEngineHost()` 运行时；
 *   两个座位都是客户端：只发**意图**、只收**自己该看的视图**。
 *
 * 本模块只做"房间"，不碰传输（不 import WebSocket）：调用方给一个 `send(seat, msg)`，
 *   这样它既能被 worker.mjs 的 Durable Object 用，也能在 Node 测试里被假 DO 驱动。
 *
 * 关键设计（每条都是踩过坑换来的，改之前先读）：
 *  ① **座位就是引擎槽位**：p1/p2 与引擎里的槽位一一对应，引擎内部**不换位**；
 *     换位/遮蔽只发生在"出视图"这一步（`NetSync.buildSnapshot({viewer})`）。
 *     视图里永远是"p1=我、p2=对手"，两座位各自一份 —— 隐藏信息在客户端根本不存在。
 *  ② **p1 走本机入口、p2 走已有的 online*P2 入口**：引擎里本来就写好了一套"p2 由远端人类操作"
 *     的流程（onlineUseCardP2 / onlineNextPhaseP2 / …），服务器上正好复用，不重写规则。
 *  ③ **决策（ENV.ask）走"问那个座位并等回答"**，超时按默认项继续（绝不永久锁死）；
 *     回答用 id 点对点匹配，不需要两端对齐任何序号（旧的 _decSeq 配对机制在服务端不存在）。
 *  ④ **掉线有宽限期**，期间对手看到"对手重连中"，回来就补一份**全量**视图（带全部卡定义）。
 *  ⑤ 服务器没有 DOM：`ENV.render` 空转、日志进事件流，由调用方推给客户端。
 */
import { createEngineHost } from './engine-host.js';

export const ASK_TIMEOUT_MS = 20000;    // 等玩家回答的上限（与浏览器侧 20 秒同口径）
export const GRACE_MS = 90000;          // 掉线宽限期（与 worker.mjs 的旧路径一致）
const VIEW_DEBOUNCE_MS = 0;             // 视图推送去抖（0 = 立刻；留给批次 3 做增量）

/** 座位 p1 的动作 → 引擎入口（就是"本机人类玩家"那套入口，引擎里本来就有）。 */
const P1_ENTRY = {
  card: 'useCardComplete', roll: 'rollDice', phase: 'nextPhase', end: 'endTurn',
  drawCost: 'drawByCost', sacrifice: 'doSacrifice', skill: 'useCharacterPassive',
  event: 'useEventCard', music: 'useMusicCard', fdPlace: 'faceDownFromHand',
  fd: 'uiActivateFaceDown', perm: 'activatePermanentCard'
};
/** 座位 p2 的动作**不另写一套**：直接复用引擎里已有的"远端意图套用器" `onlineApplyIntent`，
 *  它内部把 12 种意图映射到 onlineUseCardP2 / useEventCardFor('p2') / rollDiceForPlayer('p2') /
 *  aiEndTurn('p2') / onlineNextPhaseP2 / onlineSacrificeP2 / … 这套**已经写好并验证过**的流程。
 *  也就是说：服务器只是换了个"谁来调用它"的人，规则一行没重写。 */
const P2_ACTIONS = ['card', 'roll', 'phase', 'end', 'drawCost', 'sacrifice', 'skill',
  'event', 'music', 'fdPlace', 'fd', 'perm'];
/** 只有这些动作**必须**轮到该座位（出牌/事件/乐谱/盖伏在对手回合也能发动，与 p1 入口同规则） */
const STRICT_TURN_ACTIONS = { phase: 1, roll: 1, end: 1, drawCost: 1, sacrifice: 1, skill: 1 };

function nowMs() { return Date.now(); }

export function createEngineRoom(opts) {
  opts = opts || {};
  const code = opts.code || '';
  const send = opts.send || function () {};
  const clock = opts.now || nowMs;
  const cardDataJson = opts.cardDataJson || '';

  const seats = {
    p1: { joined: false, conn: false, ready: false, deck: null, name: '玩家1' },
    p2: { joined: false, conn: false, ready: false, deck: null, name: '玩家2' }
  };
  let host = null, S = null, started = false, finished = null, seed = 0;
  let dirty = false, lastFlushAt = 0, viewSeq = 0, askSeq = 0, evSeq = 0, connSeq = 0;
  const pendingAsks = new Map();     // askId -> { seat, cb, timer }
  const events = [];                 // 事件流（日志/fx）：断线重连可补齐
  const graceTimers = {};
  const log = opts.onLog || function () {};

  /* ---------------- 引擎 ---------------- */
  function serverEnv() {
    return {
      kind: 'server',
      log: function (rec) {
        evSeq++;
        events.push({ i: evSeq, k: 'log', rec: rec });
        if (events.length > 600) events.splice(0, events.length - 600);
        dirty = true;
      },
      render: function () { /* 服务器无 DOM：不重绘任何东西 */ },
      anim: function (name, payload) {
        evSeq++;
        events.push({ i: evSeq, k: 'fx', name: name, payload: safePayload(payload) });
        dirty = true;                  // 纯视觉，但对手视图里的日志顺序要对齐
      },
      now: function () { return clock(); },
      rng: function () { return (S && S.GameRNG && typeof S.GameRNG.next === 'function') ? S.GameRNG.next() : 0.5; },
      /* 要问某个座位：发问题、等回答；超时按"放弃/默认"继续（引擎侧回调收到 null）。
         注意：浏览器 ENV.ask 的回调契约就是 cb(value|​null)，这里保持一致。 */
      ask: function (seat, spec, cb) { askSeat(seat, spec, cb); }
    };
  }

  function ensureEngine() {
    if (host) return host;
    const t0 = clock();
    host = createEngineHost({ cardDataJson: cardDataJson, ENV: serverEnv() });
    host.load();                        // DOMContentLoaded → load（里面 initCards）
    S = host.sandbox;
    if (!S || !S.battleState) { /* battleState 开局前是 null，正常 */ }
    log('engine-ready code=' + code + ' in ' + (clock() - t0) + 'ms cards=' +
      ((S && S.allCards && S.allCards.length) || 0) + ' rj=' + !!(host.selfCheck && host.selfCheck.rjEngine));
    return host;
  }

  /* ---------------- 出视图 ---------------- */
  /** 某个座位该看到的视图（隐藏信息只发张数、卡只发身份；视图里恒为 p1=我） */
  function viewFor(seat, o) {
    o = o || {};
    if (!S || !S.battleState || !S.NetSync) return null;
    const snap = S.NetSync.buildSnapshot({ mode: 'guest', viewer: seat, full: !!o.full });
    return snap;
  }
  function selfSnapshot() {
    if (!S || !S.battleState || !S.NetSync) return null;
    return S.NetSync.buildSnapshot({ mode: 'self' });
  }

  function takeEvents() {
    if (!events.length) return [];
    const out = events.slice();
    events.length = 0;
    return out;
  }

  /** 把"该推的东西"推给两个座位。调用方在每次处理完一条入站消息后调它。 */
  function flush(o) {
    o = o || {};
    if (VIEW_DEBOUNCE_MS && !o.force && clock() - lastFlushAt < VIEW_DEBOUNCE_MS) return 0;
    lastFlushAt = clock();
    const evs = takeEvents();
    let n = 0;
    for (const seat of ['p1', 'p2']) {
      if (!seats[seat].conn) continue;
      if (evs.length) send(seat, { k: 'ev', seat: seat, events: evs });
      if (dirty || o.force || o.full) {
        const v = viewFor(seat, { full: !!o.full });
        if (v) { v.seq = ++viewSeq; send(seat, { k: 'view', seat: seat, snap: v }); n++; }
      }
    }
    dirty = false;
    if (n && o.persist !== false) persist();
    return n;
  }

  /** 权威自存快照（不带遮蔽），供 DO 被回收后恢复用。调用方给 storage 钩子。 */
  let persistFn = opts.persist || null;
  function persist() {
    if (!persistFn) return;
    const s = selfSnapshot();
    if (s) { try { persistFn(s); } catch (e) { log('persist 失败：' + (e && e.message)); } }
  }

  /* ---------------- 决策问答 ---------------- */
  function askSeat(seat, spec, cb) {
    const id = 'q' + (++askSeq);
    const st = seats[seat];
    /* 那个座位不在线：不要干等 —— 直接按"默认/放弃"继续（链路后面还有看门狗兜底）。 */
    if (!st || !st.conn) {
      log('座位 ' + seat + ' 不在线，问题按默认继续：' + (spec && spec.label));
      if (typeof cb === 'function') cb(null);
      return;
    }
    const timer = setTimeout(function () {
      const p = pendingAsks.get(id);
      if (!p) return;
      pendingAsks.delete(id);
      evSeq++;
      events.push({ i: evSeq, k: 'log', rec: { type: 'system', msg: '【联机】等待 ' + seat + ' 选择「' +
        ((spec && (spec.label || spec.title)) || '') + '」超过 ' + Math.round((opts.askTimeoutMs || ASK_TIMEOUT_MS) / 1000) +
        ' 秒未回答 → 按默认继续', t: clock() } });
      dirty = true;
      if (typeof p.cb === 'function') p.cb(null);
      flush({ force: true });
    }, opts.askTimeoutMs || ASK_TIMEOUT_MS);
    pendingAsks.set(id, { seat: seat, cb: cb, timer: timer });
    send(seat, { k: 'ask', id: id, seat: seat, spec: publicSpec(spec) });
  }

  function answerAsk(id, v) {
    const p = pendingAsks.get(id);
    if (!p) return false;                    // 迟到的回答：安全丢弃
    pendingAsks.delete(id);
    clearTimeout(p.timer);
    if (typeof p.cb === 'function') p.cb(v);
    dirty = true;
    return true;
  }

  /* ---------------- 开局 ---------------- */
  function applyDeck(seat, cfg) {
    if (!cfg) return false;
    if (typeof cfg === 'string' || (cfg && cfg.arch)) {
      const arch = typeof cfg === 'string' ? cfg : cfg.arch;
      if (typeof S.buildSmartDeck === 'function') { S.applySmartDeck(seat, S.buildSmartDeck(arch), false); return true; }
      return false;
    }
    // 客户端直接交 deckConfig 形状：{chars:[3], items:[8], carries:[4]}
    S.deckConfig[seat] = {
      chars: (cfg.chars || [null, null, null]).slice(0, 3),
      items: (cfg.items || []).slice(0, 8),
      carries: (cfg.carries || []).slice(0, 4)
    };
    return true;
  }

  function bothReady() { return seats.p1.ready && seats.p2.ready; }

  function startMatch() {
    ensureEngine();
    if (started) return { ok: false, reason: '已经开局' };
    if (!bothReady()) return { ok: false, reason: '还有座位没准备' };
    if (!seats.p1.deck || !seats.p2.deck) return { ok: false, reason: '还有座位没交卡组' };
    applyDeck('p1', seats.p1.deck);
    applyDeck('p2', seats.p2.deck);
    seed = (opts.seed ? opts.seed() : Math.floor(Math.random() * 0xffffffff)) >>> 0;
    S.setGameSeed(seed);                 // 服务器就是权威随机源：种子由服务器定，可复现
    try { S.startBattle(); } catch (e) {
      log('startBattle 抛错：' + (e && e.message));
      return { ok: false, reason: 'startBattle 失败：' + (e && e.message) };
    }
    if (!S.battleState) return { ok: false, reason: 'startBattle 后没有 battleState' };
    started = true;
    dirty = true;
    for (const seat of ['p1', 'p2']) if (seats[seat].conn) send(seat, { k: 'start', seat: seat, seed: seed });
    flush({ force: true, full: true });
    log('开局 code=' + code + ' seed=' + seed + ' 手牌 p1=' + (S.battleState.p1.hand || []).length +
      ' p2=' + (S.battleState.p2.hand || []).length);
    return { ok: true, seed: seed };
  }

  /* ---------------- 动作 ---------------- */
  function act(seat, a, args) {
    if (!started) return { ok: false, reason: '对局还没开始' };
    if (finished) return { ok: false, reason: '对局已结束' };
    const st = S.battleState;
    if (STRICT_TURN_ACTIONS[a] && st && st.currentPlayer !== seat) {
      return { ok: false, reason: '还没轮到你（当前：' + st.currentPlayer + '）' };
    }
    /* 出牌：先用引擎自己的合法性引擎判一次（费用/阶段/目标/耐久），把乱发的意图挡在门外 */
    if (a === 'card') {
      const hand = (st && st[seat] && st[seat].hand) || [];
      const idx0 = Number(args && args.idx);
      const card = hand[idx0];
      if (!card) return { ok: false, reason: '手牌里没有第 ' + idx0 + ' 张' };
      const pv = (typeof S.evaluatePlayable === 'function') ? S.evaluatePlayable(card, seat) : { ok: true };
      if (!pv || pv.ok === false) return { ok: false, reason: (pv && pv.reason) || '这张卡现在不能出' };
    }
    const idx = Number(args && args.idx);
    const name = (args && args.name) || '';
    try {
      if (seat === 'p2') {
        /* 复用"远端意图套用器"：动作名与意图类型同名（card/phase/roll/end/…） */
        if (P2_ACTIONS.indexOf(a) < 0) return { ok: false, reason: '未知动作：' + a };
        S.onlineApplyIntent({ type: a, idx: idx, name: name }, function () { dirty = true; });
      } else {
        const fnName = P1_ENTRY[a];
        if (!fnName) return { ok: false, reason: '未知动作：' + a };
        const fn = S[fnName];
        if (typeof fn !== 'function') return { ok: false, reason: '引擎里没有入口 ' + fnName };
        if (a === 'card' || a === 'event' || a === 'music' || a === 'fdPlace' || a === 'fd' || a === 'perm') fn(idx, name);
        else fn();
      }
    } catch (e) {
      log('执行动作 ' + a + '（' + seat + '）抛错：' + (e && e.message));
      return { ok: false, reason: '执行失败：' + (e && e.message) };
    }
    dirty = true;
    flush();
    return { ok: true };
  }

  function surrender(seat) {
    if (finished) return { ok: false, reason: '对局已结束' };
    const winner = (seat === 'p1') ? 'p2' : 'p1';
    finished = { winner: winner, loser: seat, why: 'surrender' };
    /* **把结束态写进权威状态**（不只是发一条 over）：随后 flush 的视图里带着 _over/_winner，
       客户端照常套用视图就能进结束界面；否则客户端刚设的结束态会被下一份视图覆盖掉
       （实测线上表现："投降后界面没进结束态"）。口径与旧路径 onlineSurrender 一致。 */
    try {
      if (S && S.battleState) { S.battleState._over = true; S.battleState._winner = winner; }
    } catch (e) {}
    evSeq++;
    events.push({ i: evSeq, k: 'log', rec: { type: 'system', msg: '【联机】' + seat + ' 投降，' + winner + ' 获胜', t: clock() } });
    for (const s of ['p1', 'p2']) if (seats[s].conn) send(s, { k: 'over', winner: winner, loser: seat, why: 'surrender' });
    dirty = true;
    flush({ force: true });
    return { ok: true, winner: winner };
  }

  /* ---------------- 连接/断线 ---------------- */
  function attach(seat, info) {
    info = info || {};
    ensureEngine();
    const st = seats[seat];
    const wasOffline = st.joined && !st.conn;          // 之前掉线过 → 这次是"回来了"
    const resumed = !!(st.joined && started);
    /* **连接身份**：重连是"新连接 + 旧连接稍后才 close"，所以座位在线与否必须认令牌，
       不能只看"有人断开就置离线" —— 否则旧连接的 close 会把刚接回来的座位又标成离线
       （实测线上：重连方明明回来了，对手那边却收不到 peerBack、状态停在"等待对手加入"）。 */
    st.conn = info.conn || ('c' + (++connSeq));
    st.joined = true;
    if (info.name) st.name = String(info.name).slice(0, 16);
    if (graceTimers[seat]) { clearTimeout(graceTimers[seat]); graceTimers[seat] = null; }
    const other = (seat === 'p1') ? 'p2' : 'p1';
    /* 之前掉线、现在回来了：告诉**还连着的**对手"他回来了"（对手那边会撤掉"对手重连中"）。 */
    if (wasOffline && seats[other].conn) send(other, { k: 'peerBack', seat: seat });
    send(seat, { k: 'joined', seat: seat, code: code, started: started, resumed: resumed, seed: seed,
      selfCheck: host ? host.selfCheck : null });
    if (started) { dirty = true; flush({ force: true, full: true }); }   // 重连：给全量视图（带全部卡定义）
    log('座位 ' + seat + ' 接入（' + (resumed ? '重连' : '新加入') + '）');
    return { ok: true, seat: seat, resumed: resumed, started: started };
  }

  function detach(seat, token) {
    const st = seats[seat];
    if (!st.joined) return;
    /* 过期连接的断开要**忽略**（重连时旧连接常常晚一步 close）；只有"当前这条连接"断了才算离线。 */
    if (token && st.conn && st.conn !== token) {
      log('忽略过期连接的断开（座位 ' + seat + ' 已换新连接）');
      return;
    }
    st.conn = false;
    const other = (seat === 'p1') ? 'p2' : 'p1';
    if (graceTimers[seat]) clearTimeout(graceTimers[seat]);
    graceTimers[seat] = setTimeout(function () {
      graceTimers[seat] = null;
      if (seats[seat].conn) return;                 // 期间回来了
      evSeq++;
      events.push({ i: evSeq, k: 'log', rec: { type: 'system', msg: '【联机】' + seat + ' 掉线超过宽限期', t: clock() } });
      if (seats[other].conn) send(other, { k: 'peerLost', seat: seat, gaveUp: true });
      dirty = true;
      flush({ force: true });
    }, opts.graceMs || GRACE_MS);
    if (seats[other].conn) send(other, { k: 'peerLost', seat: seat, grace: Math.round((opts.graceMs || GRACE_MS) / 1000) });
    log('座位 ' + seat + ' 断开（' + Math.round((opts.graceMs || GRACE_MS) / 1000) + ' 秒宽限期）');
  }

  /* ---------------- 入站消息 ---------------- */
  function handle(seat, m) {
    if (!m || typeof m !== 'object') return { ok: false, reason: '空消息' };
    switch (m.k) {
      case 'join': return attach(seat, m);
      case 'deck': {
        seats[seat].deck = m.cfg || null;
        log('座位 ' + seat + ' 交卡组：' + (m.cfg ? (m.cfg.chars ? '自定义卡组' : String(m.cfg)) : '空'));
        // 两边都交了卡组、且都 ready → 由 ready 流程开局；这里只记账
        return { ok: true };
      }
      case 'ready': {
        ensureEngine();
        seats[seat].ready = true;
        log('座位 ' + seat + ' 已准备');
        if (bothReady()) {
          const r = startMatch();
          if (!r.ok) { send(seat, { k: 'error', reason: r.reason }); return { ok: false, reason: r.reason }; }
          return { ok: true, started: true, seed: r.seed };
        }
        send(seat, { k: 'waiting', reason: '等待对手准备' });
        return { ok: true, started: false };
      }
      case 'act': {
        const r = act(seat, m.a, m.args);
        if (!r.ok) {
          send(seat, { k: 'reject', a: m.a, reason: r.reason });
          evSeq++;
          events.push({ i: evSeq, k: 'log', rec: { type: 'system', msg: '【联机】' + seat + ' 的动作被拒：' + r.reason, t: clock() } });
          flush({ force: true });
        }
        return r;
      }
      case 'ans': return { ok: answerAsk(m.id, m.v) };
      case 'resyncReq': { dirty = true; flush({ force: true, full: true }); return { ok: true }; }
      /* 排障命令：把房间自己怎么看这一局回给提问者（谁在线、是否开局、几个待答问题…）。
         真机排障时最缺的就是"服务器此刻认为发生了什么" —— 有了它不用再靠猜（host 对象不发，含循环引用）。 */
      case 'diag': {
        const d = diag();
        const safe = Object.assign({}, d);
        delete safe.host;
        if (m.want === 'events') safe.events = events.slice(-40);
        send(seat, { k: 'diag', diag: safe });
        return { ok: true, diag: safe };
      }
      case 'surrender': return surrender(seat);
      case 'events': return { ok: true, events: takeEvents() };
      default: return { ok: false, reason: '未知消息 k=' + m.k };
    }
  }

  /* ---------------- 恢复（DO 被回收后） ---------------- */
  /** 把"权威自存快照"（`NetSync.buildSnapshot({mode:'self'})`）套回引擎，对局不丢。
   *  这是"权威在服务器"才可能做到的事：旧架构里房主一刷新页面，这局就没了。 */
  function restore(selfSnap) {
    if (!selfSnap || !selfSnap.state) return false;
    ensureEngine();
    try {
      S.NetSync._pending = selfSnap.cards || {};
      S.NetSync.applySnapshot(selfSnap);
    } catch (e) {
      log('restore 失败：' + (e && e.message));
      return false;
    }
    started = true;
    dirty = true;
    log('从服务器自存快照恢复权威状态（turn=' + ((S.battleState && S.battleState.turn) || '?') +
      ' phase=' + ((S.battleState && S.battleState.phase) || '?') + '）');
    return true;
  }

  /* ---------------- 诊断（给测试与排障用） ---------------- */
  function diag() {
    const st = S && S.battleState;
    return {
      code: code, started: started, finished: finished, seed: seed,
      engineReady: !!host, host: host,
      scopeNames: (host && host.scopeNames.length) || 0,
      selfCheck: host ? host.selfCheck : null,
      seats: { p1: { joined: seats.p1.joined, conn: !!seats.p1.conn, ready: seats.p1.ready, deck: !!seats.p1.deck },
               p2: { joined: seats.p2.joined, conn: !!seats.p2.conn, ready: seats.p2.ready, deck: !!seats.p2.deck } },
      pendingAsks: pendingAsks.size,
      turn: st ? { turn: st.turn, phase: st.phase, currentPlayer: st.currentPlayer,
        p1Hand: (st.p1.hand || []).length, p2Hand: (st.p2.hand || []).length } : null
    };
  }

  return {
    code: code,
    handle: handle, act: act, attach: attach, detach: detach,
    startMatch: startMatch, flush: flush, viewFor: viewFor, selfSnapshot: selfSnapshot,
    surrender: surrender, restore: restore, diag: diag,
    seats: seats,
    get sandbox() { return S; },
    get host() { return host; },
    get started() { return started; },
    get finished() { return finished; }
  };
}

/* ---------------- 工具 ---------------- */
/** 把问题的"候选内容"变成可发的东西：只带客户端画界面要用的字段（不带函数/不带引擎对象） */
function publicSpec(spec) {
  spec = spec || {};
  const out = { kind: spec.kind || 'choice' };
  ['label', 'title', 'need', 'allowLess', 'defVal', 'cardName', 'effect', 'zone', 'player', 'indices', 'text'].forEach(function (k) {
    if (spec[k] !== undefined) out[k] = spec[k];
  });
  if (Array.isArray(spec.choices)) out.choices = spec.choices.map(function (c) { return (typeof c === 'string') ? c : (c && c.label) || String(c); });
  if (Array.isArray(spec.cards)) {
    out.cards = spec.cards.map(function (c) {
      if (typeof c === 'string') return c;
      if (!c || typeof c !== 'object') return String(c);
      return { name: c.name || '？？？', cost: c.cost, effect: c.effect, _category: c._category };
    });
  }
  if (spec.card && typeof spec.card === 'object') out.card = { name: spec.card.name || '' };
  return out;
}
function safePayload(p) {
  try { return JSON.parse(JSON.stringify(p === undefined ? null : p)); } catch (e) { return null; }
}
