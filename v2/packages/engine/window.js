/**
 * 入局者 v2 · 唯一时点窗口（TimingWindow）
 * ---------------------------------------------------------------------------
 * 这一层是作者最初抱怨的那件事的正解（《给DSH的连锁机制重构规格》§二）：
 *   旧引擎有三套并存的组链实现 + 一条"候选由调用方一次性传入"的固定池（链长被封顶在 2），
 *   且结算中新触发的必发被拖到整链结束（`__tryDrainTriggers`）或直接丢。
 *
 * 新引擎只有这一个窗口。状态机每个状态**唯一出口**：
 *
 *   collect  → 扫描候选（扫描器按 scanKind 从注册表取，窗口本身只存**数据**）
 *   arrange  → 必发按「回合方 → 对方」入链（§13.3.2 必发优先于选发）
 *   priority → 优先权轮转；每轮**重新扫描**（链长不设上限）；双方连续 PASS 才关窗（§13.3.3）
 *   closed   → 转入结算
 *   settling → **逆序**逐节点结算；节点 `alive()` 为假 → 丢失对象不处理；
 *              单节点异常只跳该节点；**结算中产生的新效果 → 等本连锁全部处理完再另开一条连锁**（作者口径）
 *   done     → 关窗、回调收尾
 *
 * 窗口整体是**可序列化的数据**（`state.window`），因为答案是 `state.answers` 里的数据、
 * 扫描器按名字查表 —— 所以"断线重连后窗口状态可恢复或明确作废"（用例 8）是结构性的，不是补丁。
 * 引擎里**没有** `_chainLock` / `_resolveDepth` 这种承重锁，也没有看门狗。
 */

import { makeDecision, takeAnswer, consumeAnswer, pendingOf } from './decision.js';
import { offerChain } from './offer.js';
import { executeOps } from './ops/index.js';
import { payCardCost } from './rules/cost.js';
import { isNegateEffectCard } from './abilities.js';

/** 扫描器注册表：名字 → (state, win) => candidate[]（窗口只存名字，保证可序列化） */
export const SCANNERS = new Map();
export function registerScanner(name, fn) {
  if (typeof name !== 'string' || typeof fn !== 'function') throw new Error('[engine.window] registerScanner(name, fn)');
  SCANNERS.set(name, fn);
}

const SEAT_ORDER = (state) => state.seatIds;

function log(state, win, text, kind = 'chain') {
  const entry = { type: kind, text, windowId: win.id, point: win.point, state: win.state };
  win.events.push(entry);
  state.log.push(entry);
  return entry;
}

/**
 * 开窗。
 * @param {object} opts
 *   kind        窗口类型（见 offer.WINDOW_KINDS）
 *   point       时点名（16 时点之一；同时诱发/响应窗口可为 null）
 *   ctx         窗口上下文（**必须是数据**：座位、卡、判定结果…）
 *   scanKind    扫描器名（数据；默认 `timing:<point>`）
 *   c1          本次被响应的效果节点（进 chain[0]；可被 negate_effect 取消）
 *   firstSeat   首次优先权（默认回合玩家，§13.3.3）
 *   parent      父窗口 id（子窗口）
 */
export function openWindow(state, opts = {}) {
  if (state.window && state.window.state !== 'done') {
    throw new Error('[engine.window] 已有打开的窗口（id=' + state.window.id + '）—— 唯一窗口不许重入');
  }
  state.windowSeq = (state.windowSeq || 0) + 1;
  const win = {
    id: state.windowSeq,
    kind: opts.kind || 'simultaneous',
    point: opts.point || null,
    ctx: opts.ctx || {},
    scanKind: opts.scanKind || (opts.point ? 'timing:' + opts.point : null),
    state: 'collect',
    chain: [],
    staged: { mandatory: [], optional: [] },
    priority: opts.firstSeat || state.currentPlayer,
    passStreak: 0,
    parent: opts.parent || null,
    settleIndex: -1,
    events: [],
    reopenCount: 0,
  };
  if (opts.c1) win.chain.push(nodeOf(state, opts.c1, win));
  state.window = win;
  log(state, win, `【开窗】${win.kind}${win.point ? '（' + win.point + '）' : ''}${opts.c1 ? '，C1=' + (opts.c1.label || '') : ''}`, 'windowOpen');
  return win;
}

/** 把"候选/效果"规整成节点。
 *  `fire`/`alive`/`ops` **只存在于内存**（函数不参与序列化）；窗口从快照恢复后，
 *  节点按 id 从扫描器重建，或退回 `card.ops` 执行 —— 这是"窗口可序列化"的代价与约定。 */
function nodeOf(state, cand, win) {
  return {
    id: cand.id || ('n' + (win.chain.length + 1)),
    owner: cand.owner || state.currentPlayer,
    label: cand.label || '',
    mandatory: !!cand.mandatory,
    card: cand.card || null,
    from: cand.from || null,
    chainKind: cand.chainKind || null,
    payAtActivation: !!cand.payAtActivation,
    cancelled: false,
    meta: cand.meta || {},
    // 仅内存（不序列化）
    fire: typeof cand.fire === 'function' ? cand.fire : null,
    alive: typeof cand.alive === 'function' ? cand.alive : null,
    ops: cand.ops || null,
  };
}

function scanCandidates(state, win) {
  const fn = win.scanKind ? SCANNERS.get(win.scanKind) : null;
  if (!fn) return [];
  return fn(state, win) || [];
}

/** 收集 → 排列 */
function collectAndArrange(state, win) {
  const cands = scanCandidates(state, win);
  const mandatory = cands.filter((c) => c.mandatory);
  const optional = cands.filter((c) => !c.mandatory);
  // 必发按「回合方 → 对方」入链（§13.3.2），同一方内部保持扫描顺序
  const order = [state.currentPlayer, ...SEAT_ORDER(state).filter((s) => s !== state.currentPlayer)];
  mandatory.sort((a, b) => order.indexOf(a.owner) - order.indexOf(b.owner));
  for (const c of mandatory) {
    const n = nodeOf(state, c, win);
    if (!win.chain.some((x) => x.id === n.id)) {
      win.chain.push(n);
      log(state, win, `【必发入链】C${win.chain.length} ${n.label}（${n.owner}）`);
    }
  }
  win.staged = { mandatory: [], optional };
  win.state = 'priority';
}

/** 优先权阶段：给当前优先权方一个决策（候选每轮重扫） */
function offersFor(state, win, seatId) {
  const fresh = scanCandidates(state, win);
  const freshOptional = fresh.filter((c) => !c.mandatory && !win.chain.some((x) => x.id === c.id));
  const { candidates, rejected } = offerChain(state, seatId, win, {
    hasTarget: win.ctx.hasTarget !== false,
    sources: ['hand', 'faceDownCards'],
  });
  return { freshOptional, candidates, rejected };
}

function askPriority(state, win, offers) {
  const seatId = win.priority;
  const { freshOptional, candidates, rejected } = offers;
  const options = [
    ...freshOptional.map((c) => ({ id: c.id, label: c.label, kind: 'effect', chainKind: c.chainKind || null })),
    ...candidates.map((c) => ({ id: c.id, label: `${c.label}（${c.cost} 费${c.payAtActivation ? '，发动时支付' : ''}）`, kind: 'card', chainKind: c.chainKind })),
    { id: 'pass', label: '不发动（PASS）', kind: 'pass' },
  ];
  return makeDecision(state, {
    kind: 'chain',
    seat: seatId,
    reason: `连锁窗口：${win.kind}${win.point ? '（' + win.point + '）' : ''}`,
    title: '是否连锁？',
    subtitle: `当前链 ${win.chain.length} 环`,
    options,
    meta: { windowId: win.id, rejected: rejected.map((r) => ({ card: r.card, reason: r.reason })) },
  });
}

/** 结算一个节点（含"发动时付费"与"盖伏翻开"） */
function fireNode(state, win, node) {
  const cands = scanCandidates(state, win).concat(win.staged.optional || []);
  const cand = cands.find((c) => c.id === node.id);
  const seat = state.seats[node.owner];
  if (!seat) throw new Error('未知座位：' + node.owner);

  // §12.2 盖伏卡：发动时才付费，且**翻开使用后仍是原来那张卡**（离场去向在 P4 的 placeAfterUse 细化）
  if (node.card && node.payAtActivation && !node.paid) {
    const r = payCardCost(state, node.owner, node.card);
    if (!r.ok) throw new Error('发动时付费失败：' + r.reason);
    node.paid = true;
    const zone = seat.faceDownCards || [];
    const ix = zone.indexOf(node.card);
    if (ix >= 0) zone.splice(ix, 1);
    seat.grave.push(node.card);
    log(state, win, `【盖伏翻开】${node.label} 支付 ${r.paid} 音韵后发动`, 'chainResolve');
  }
  log(state, win, `【结算】C${win.chain.indexOf(node) + 1} ${node.label}（${node.owner}）`, 'chainResolve');

  // 反制整效（如【崩塌之乌托邦】）：把 C1 标记为取消，自己不执行效果
  if (isNegateEffectCard(node.card)) {
    const c1 = win.chain[0];
    if (c1 && c1.id !== node.id) {
      c1.cancelled = true;
      log(state, win, `【整效无效】${node.label} 取消了 C1（${c1.label}）的结算`, 'chainNegate');
    } else {
      log(state, win, `（${node.label} 是 C1，不能取消自己）`, 'chainWarn');
    }
    return;
  }

  if (typeof node.fire === 'function') { node.fire(state, win); return; }   // c1 / 扫描器给的节点自带实现
  if (cand && typeof cand.fire === 'function') { cand.fire(state, win); return; }
  if (cand && cand.ops) { executeOps(state, { seat: node.owner, target: win.ctx.target, card: node.card, rng: win.ctx.rng }, cand.ops); return; }
  if (node.ops) { executeOps(state, { seat: node.owner, target: win.ctx.target, card: node.card, rng: win.ctx.rng }, node.ops); return; }
  // 手牌/盖伏卡：直接跑它编译好的 ops（main + sp，按步骤顺序）
  const cardOps = flattenCardOps(node.card);
  if (cardOps.length) { executeOps(state, { seat: node.owner, target: win.ctx.target, card: node.card, rng: win.ctx.rng }, cardOps); return; }
  log(state, win, `（节点 ${node.label} 没有可执行内容：候选已消失，按"效果不适用"处理）`, 'chainSkip');
}

/**
 * 把一张卡的编译产物摊平成一条 op 序列。
 * **默认只取主效果（main）**：旧引擎"出牌"只跑主效果，SP 是**主动发动**的另一条路
 * （《重做方案》§14.5：主效果全部处理完才轮到 SP）。第一版把 main+sp 一起摊平，
 * 于是【最佳化】一打出就白拿了它 SP 的"攻击力+1" —— 被逐卡对拍当场抓住。
 */
export function flattenCardOps(card, opts = {}) {
  const out = [];
  const ops = card && card.ops;
  if (!ops) return out;
  const groups = opts.includeSp ? [ops.main || [], ops.sp || []] : [ops.main || []];
  for (const group of groups) {
    for (const step of group) if (Array.isArray(step.ops)) out.push(...step.ops);
  }
  return out;
}

/** 只取 SP 部分（主动发动 SP 用） */
export function flattenSpOps(card) {
  const out = [];
  for (const step of (card && card.ops && card.ops.sp) || []) if (Array.isArray(step.ops)) out.push(...step.ops);
  return out;
}

/**
 * "效果中途需要决策但没有答案源"专用异常。
 * 必须与普通节点异常**区分开**：普通异常按用例 7 只跳当前节点（不中断整链），
 * 而"缺答案源"是调用方的错，吞掉它就会变成"效果被静默跳过" —— 那是本项目最忌讳的失败模式。
 */
export class NeedsAnswer extends Error {
  constructor(pending) {
    super('效果需要决策（' + (pending && pending.kind) + '）但没有答案源');
    this.name = 'NeedsAnswer';
    this.pending = pending;
    this.needsAnswer = true;
  }
}

/** 节点是否还有对象（§13.5 丢失对象：不处理、不报错、不中断整链） */
function nodeAlive(state, win, node) {
  if (typeof node.alive === 'function') return !!node.alive(state, win);   // 内存路径（c1 / 扫描器给的）
  const cands = scanCandidates(state, win);
  const cand = cands.find((c) => c.id === node.id);
  if (cand && typeof cand.alive === 'function') return !!cand.alive(state, win);
  if (node.cancelled) return false;
  return true;
}

/**
 * 状态机本体：驱动**一个**窗口直到"关窗"或"需要人答"。
 * 结算中产生的新效果只入队（`state.chainQueue`），由外层 `runWindow` 另开连锁处理。
 * @returns {{done:boolean, pending:object|null, events:Array}}
 */
function drive(state, opts = {}) {
  const win = state.window;
  if (!win) return { done: true, pending: null, events: [] };
  if (win.state === 'done') { state.window = null; return { done: true, pending: null, events: [] }; }

  let guard = 0;
  while (win.state !== 'done') {
    if (++guard > 5000) throw new Error('[engine.window] 状态机步数超限（可能存在自触发死循环）：' + win.kind);

    if (win.state === 'collect') { collectAndArrange(state, win); continue; }

    if (win.state === 'priority') {
      // 每轮重扫：新出现的必发必须补入（链长不设上限）
      const fresh = scanCandidates(state, win);
      const newMand = fresh.filter((c) => c.mandatory && !win.chain.some((x) => x.id === c.id));
      if (newMand.length) {
        for (const c of newMand) { win.chain.push(nodeOf(state, c, win)); log(state, win, `【重扫补入必发】C${win.chain.length} ${c.label}`); }
        continue;
      }
      const offers = offersFor(state, win, win.priority);
      // 没人能连锁就**自动放行**，不弹问（旧引擎同款："无可连锁卡时静默放行"）；
      // 否则每出一张牌都要人答一次，单机根本跑不动。
      if (!offers.freshOptional.length && !offers.candidates.length) {
        win.passStreak += 1;
        log(state, win, `【自动 PASS】${win.priority} 没有可发动的候选`);
        if (win.passStreak >= SEAT_ORDER(state).length) { win.state = 'closed'; log(state, win, '【关窗】双方无可连锁'); continue; }
        const i0 = SEAT_ORDER(state).indexOf(win.priority);
        win.priority = SEAT_ORDER(state)[(i0 + 1) % SEAT_ORDER(state).length];
        continue;
      }
      const d = pendingOf(state);
      if (!d) { askPriority(state, win, offers); return { done: false, pending: pendingOf(state), events: win.events }; }
      const value = consumeAnswer(state, d.id);
      if (value === undefined) return { done: false, pending: d, events: win.events };
      if (value === 'pass') {
        win.passStreak += 1;
        log(state, win, `【PASS】${d.seat}（连续 ${win.passStreak}）`);
        if (win.passStreak >= SEAT_ORDER(state).length) { win.state = 'closed'; log(state, win, '【关窗】双方连续放弃'); continue; }
        const idx = SEAT_ORDER(state).indexOf(win.priority);
        win.priority = SEAT_ORDER(state)[(idx + 1) % SEAT_ORDER(state).length];
        continue;
      }
      // 发动：找到候选
      const all = scanCandidates(state, win).concat(win.staged.optional || []);
      const { candidates } = offerChain(state, d.seat, win, { hasTarget: win.ctx.hasTarget !== false });
      const pick = all.find((c) => c.id === value) || candidates.find((c) => c.id === value);
      if (!pick) { log(state, win, `⚠ 决策指向的候选已失效（${value}），按 PASS 处理`, 'chainWarn'); win.passStreak += 1; continue; }
      const node = nodeOf(state, { ...pick, owner: d.seat }, win);
      // 手牌/场上发动：付费 + 移出手牌（盖伏在 fireNode 里付费）
      if (pick.card && pick.from !== 'faceDownCards') {
        const r = payCardCost(state, d.seat, pick.card);
        if (!r.ok) { log(state, win, `⚠ 付费失败（${r.reason}），不入链`, 'chainWarn'); continue; }
        const zone = state.seats[d.seat][pick.from];
        if (zone) { const ix = zone.indexOf(pick.card); if (ix >= 0) zone.splice(ix, 1); }
        node.meta = { ...node.meta, paid: r.paid };
      }
      win.chain.push(node);
      log(state, win, `【发动】C${win.chain.length} ${node.label}（${d.seat}）`);
      win.passStreak = 0;
      const idx = SEAT_ORDER(state).indexOf(d.seat);
      win.priority = SEAT_ORDER(state)[(idx + 1) % SEAT_ORDER(state).length];
      continue;
    }

    if (win.state === 'closed') {
      win.state = 'settling';
      win.settleIndex = win.chain.length - 1;
      log(state, win, `【逆序结算开始】共 ${win.chain.length} 环`);
      continue;
    }

    if (win.state === 'settling') {
      if (win.settleIndex < 0) { win.state = 'done'; continue; }
      const node = win.chain[win.settleIndex];
      try {
        if (!nodeAlive(state, win, node)) log(state, win, `【丢失对象】C${win.settleIndex + 1} ${node.label} 不处理`, 'chainLost');
        else fireNode(state, win, node);
      } catch (e) {
        if (e && e.needsAnswer) throw e;   // 缺答案源：抛给调用方，绝不当成"跳过这个节点"
        // 单节点异常只跳当前节点，绝不破坏状态机（旧引擎在这里会整链停摆并留锁）
        log(state, win, `⚠ 节点异常已跳过：C${win.settleIndex + 1} ${node.label} —— ${e.message}`, 'chainError');
      }
      // 结算中**新产生**的效果：只入队，不在这里开窗 ——
      // 作者口径（2026-09-26）："连锁结算中产生的新效果，会在当前连锁**全部处理完毕后**
      // 新开一个连锁用于处理新产生的效果"。原地开子窗口是错的（会把新效果插到原链中间结算）。
      stashTriggersToQueue(state, win);
      win.settleIndex -= 1;
      continue;
    }

    throw new Error('[engine.window] 未知状态：' + win.state);
  }

  const events = win.events.slice();
  const closedId = win.id;
  state.window = null;
  state.log.push({ type: 'windowClosed', text: `【关窗】窗口 ${closedId} 结束（${win.chain.length} 环）`, windowId: closedId });
  return { done: true, pending: null, events };
}

/**
 * 运行窗口直到"整条连锁 + 它产生的新连锁"全部处理完。
 * 规则（作者口径）：当前连锁**全部处理完毕**后，若结算过程中产生了新效果，
 * 才**新开一条连锁**去处理它们；新连锁里再产生效果 → 再开一条，直到清空。
 */
export function runWindow(state, opts = {}) {
  const events = [];
  for (let guard = 0; guard < 64; guard++) {
    const r = drive(state, opts);    events.push(...(r.events || []));
    if (!r.done) return { done: false, pending: r.pending, events };
    const batch = (state.chainQueue || []).shift();
    if (!batch) return { done: true, pending: null, events };
    openFollowUpWindow(state, batch);
  }
  throw new Error('[engine.window] 新连锁队列疑似死循环（超过 64 条）');
}

/** 把"本次结算中新产生的效果"整批入队（等当前连锁全部处理完再开新链） */
function stashTriggersToQueue(state, win) {
  const triggers = state.pendingTriggers || [];
  if (!triggers.length) return false;
  const batch = triggers.splice(0, triggers.length);
  state.chainQueue = state.chainQueue || [];
  state.chainQueue.push({
    triggers: batch,
    parentId: win.id,
    parentKind: win.kind,
    point: batch[0].point || win.point,
    ctx: { ...win.ctx },
    scanKind: win.scanKind,
    firstSeat: win.ctx.target || win.priority,
  });
  log(state, win, `【产生新效果】C${win.settleIndex + 1} 结算中产生 ${batch.length} 个效果 → 待本连锁全部处理完另开连锁`, 'followUpQueued');
  return true;
}

/** 为上一连锁产生的新效果**新开一条连锁**（已确定触发，不再询问优先权） */
function openFollowUpWindow(state, batch) {
  const win = openWindow(state, {
    kind: batch.parentKind === 'effect_activate' ? 'effect_activate' : (batch.parentKind || 'chain'),
    point: batch.point,
    ctx: { ...batch.ctx, fromFollowUpChain: true },
    scanKind: batch.scanKind,
    firstSeat: batch.firstSeat,
    parent: batch.parentId,
  });
  log(state, win, `【新连锁】上一连锁结算中产生的 ${batch.triggers.length} 个效果，另开一条连锁处理`, 'followUpChain');
  for (const t of batch.triggers) win.chain.push(nodeOf(state, t, win));
  win.state = 'closed';   // 已经是"确定触发"，不再走优先权询问
  return win;
}

/** 触发队列：节点/ops 在结算中"新触发必发"时调用（用例 2 的入口） */
export function queueTrigger(state, node, point) {
  state.pendingTriggers = state.pendingTriggers || [];
  state.pendingTriggers.push({ ...node, point: point || (state.window && state.window.point) || null });
}

/** 明确作废窗口（用例 8：重连恢复不了就明说，且**不残留任何锁**） */
export function abandonWindow(state, reason) {
  const win = state.window;
  if (!win) return null;
  state.pendingDecisions.length = 0;
  state.answers = {};
  state.pendingTriggers = [];
  state.window = null;
  const entry = { type: 'windowAbandoned', text: `【窗口作废】${reason}（原窗口 ${win.id}/${win.kind}，链 ${win.chain.length} 环）`, windowId: win.id };
  state.log.push(entry);
  state.diagnostics.push(entry.text);
  return entry;
}

/** 窗口是否需要进行中判定（取代旧引擎的 `_chainLock`/`_resolveDepth`） */
export function windowActive(state) { return !!(state.window && state.window.state !== 'done'); }

/** 窗口快照（可序列化 + 可恢复；恢复后按 scanKind 重建扫描器） */
export function windowSnapshot(state) {
  return state.window ? JSON.parse(JSON.stringify(state.window)) : null;
}
