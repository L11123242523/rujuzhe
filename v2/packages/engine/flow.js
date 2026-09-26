/**
 * 入局者 v2 · 回合与阶段流（规则书 §4）
 * ---------------------------------------------------------------------------
 * 与旧引擎的差别（有意，且是对旧病根的直接修正）：
 *   · 旧 `startTurn`/`endTurn`（game.html:9457/11847）各自手写一份"每回合复位"，
 *     共三处（人类侧 L9208-9219、AI 侧 L11896-11903、座位级 L9231-9257）——
 *     "改一处必漏一处"。新引擎的复位只有一处：`resetLifetime(state, seat, 'turn'|'action')`，
 *     清哪些字段由 `flags.js` 的**声明**决定。
 *   · 旧 `nextPhase` 把阶段推进与回合推进混在一个 if 链里；新引擎分开：
 *     `advancePhase` 只推阶段，`endTurn` 才换人。
 *   · 所有函数返回**事件清单**（纯数据），UI 订阅播放；引擎不碰 DOM、不用 setTimeout。
 */

import { PHASES, PHASE_ORDER, nextPhase, PHASE_LABEL } from './phases.js';
import { createRNG } from './rng.js';
import { RULES } from './rules/constants.js';
import { gainCost, regenAmount, takeTopCard } from './rules/resources.js';
import { declaredFlags } from './state.js';
import { collectRegenBonus, collectMaxCostBonus, prepareMajority } from './abilities.js';
import { executeOps } from './ops/index.js';

/** 清掉某座位在指定生存期内的 flag / counter（声明制：见 flags.js） */
export function resetLifetime(seat, lifetime) {
  const cleared = [];
  for (const key of declaredFlags(lifetime)) {
    const [kind, name] = key.split(':');
    if (seat[kind] && seat[kind][name] !== undefined) {
      delete seat[kind][name];
      cleared.push(key);
    }
  }
  return cleared;
}

/** 回合开始（准备阶段）：复位本回合声明项 → 自然回复 → 抽 1 张（§4.2.1 与 §2.5） */
export function startTurn(state, seatId = state.currentPlayer) {
  const seat = state.seats[seatId];
  if (!seat) throw new Error('[engine.flow] 未知座位：' + seatId);
  const events = [];
  resetLifetime(seat, 'turn');
  // 单回合累计类记账（角色被动的"累计移动 N 格"家族）：按前缀清空，等价旧引擎"回合结束归零"
  for (const key of Object.keys(seat.statuses || {})) {
    if (key.startsWith('moveAcc:')) delete seat.statuses[key];
  }
  state.phase = PHASES.PREPARE;

  // 音韵上限的常驻加成（内容声明）在回合开始对齐一次
  seat.maxCost = RULES.cost.max + collectMaxCostBonus(state, seatId);

  const healed = gainCost(seat, regenAmount(1) + collectRegenBonus(state, seatId)); // 回复加成来自在场的永续卡声明
  if (healed) events.push({ type: 'regen', seat: seatId, amount: healed, cost: seat.cost });

  const drawn = takeTopCard(seat);
  if (drawn) {
    seat.hand.push(drawn.card);
    seat.flags.normalDrawDone = true;
    events.push({ type: 'draw', seat: seatId, card: drawn.card, reason: 'turn' });
    events.push(...drawn.events);
  }
  return events;
}

/** 推进一步阶段；到结束阶段再推进 ⇒ 交回合（返回 endedTurn:true，不自行换人） */
export function advancePhase(state, opts = {}) {
  const cur = state.phase;
  const nx = nextPhase(cur);
  if (nx === null) return { endedTurn: true, phase: cur, events: [{ type: 'phaseEnd', phase: cur }] };
  // 准备阶段**结束时**的角色被动（【入间予】"准备阶段结束时可以发动，公开自己的所有手卡…"）
  const before = cur === PHASES.PREPARE ? prepareEndPassives(state) : [];
  state.phase = nx;
  const events = [...before, { type: 'phase', from: cur, to: nx, label: PHASE_LABEL[nx] }];
  // 进入**投掷阶段**就投掷并移动；【入间予】无序分支"本回合投掷阶段可以额外投掷 2 次"在此消费
  if (nx === PHASES.ROLL) events.push(...runRollPhase(state, opts));
  return { endedTurn: false, phase: nx, events };
}

/**
 * 投掷阶段：投一次骰并按点数移动；额外投掷次数来自回合级标记 `mech:extraRollPhases`
 * （【入间予】准备阶段四选一的"无序"分支）。用完即清，且**逐个记事件**（可审计）。
 */
function runRollPhase(state, opts = {}) {
  const seatId = state.currentPlayer;
  const seat = state.seats[seatId];
  const rng = opts.rng || createRNG((state.seed || 1) + state.turn * 1000 + (seat.statuses.rollCountTurn || 0));
  const extra = seat.statuses['mech:extraRollPhases'];
  const extraN = extra && extra.turn === state.turn ? (extra.amount || 0) : 0;
  if (extra) delete seat.statuses['mech:extraRollPhases'];
  const events = [{ type: 'rollPhase', seat: seatId, rolls: 1 + extraN, extra: extraN }];
  for (let i = 0; i < 1 + extraN; i++) {
    const r = executeOps(state, { seat: seatId, target: otherSeat(state, seatId), rng, answer: opts.answer }, [{ op: 'move_by_roll', sides: 6 }]);
    events.push(...r.events);
    if (r.pending) { events.push({ type: 'rollPhasePending', pending: r.pending }); break; }
  }
  return events;
}

function otherSeat(state, id) {
  return state.seatIds.find((x) => x !== id) || id;
}

/**
 * 准备阶段结束时的角色被动（2026-09-26 重做角色）：
 *   入间予：可以发动 → 公开手卡 → 按**数量最多的属性**执行对应效果（四分支见 content/abilities.json）
 * 没有答案源时按"不发动"处理，但**如实记录**（不静默）。
 */
function prepareEndPassives(state) {
  const seatId = state.currentPlayer;
  const offer = prepareMajority(state, seatId);
  if (!offer) return [];
  const events = [{ type: 'prepareMajorityOffer', seat: seatId, attr: offer.attr, count: offer.count, counts: offer.counts, label: offer.label }];
  return events;
}

/** 执行"准备阶段四选一"（由调用方在拿到 offer 后、带答案源时调用） */
export function applyPrepareMajority(state, seatId, ctx = {}) {
  const offer = prepareMajority(state, seatId);
  if (!offer) return { ok: false, reason: '没有可发动的准备阶段被动（或手卡没有属性）', events: [] };
  const r = executeOps(state, { seat: seatId, target: ctx.target, rng: ctx.rng, answer: ctx.answer }, offer.ops);
  return { ok: true, offer, events: r.events, pending: r.pending || null };
}

/** 结束回合：清 action 生存期 → **手牌上限结算** → 换人（回到第一个座位则 round+1）→ turn+1 → 开始下一回合 */
export function endTurn(state, opts = {}) {
  const seat = state.seats[state.currentPlayer];
  const events = [];
  for (const key of resetLifetime(seat, 'action')) events.push({ type: 'flagCleared', seat: seat.id, key });
  events.push(...enforceHandLimit(state, seat, opts));

  const idx = state.seatIds.indexOf(state.currentPlayer);
  const nextIdx = (idx + 1) % state.seatIds.length;
  if (nextIdx === 0) state.round += 1;
  state.turn += 1;
  state.currentPlayer = state.seatIds[nextIdx];
  events.push({ type: 'turnStart', seat: state.currentPlayer, turn: state.turn, round: state.round });
  events.push(...startTurn(state));
  return events;
}

/**
 * 手牌上限（§2.5 上限 5）：回合结束时多出来的要弃掉。
 * 有答案源 ⇒ 逐张问（AI/UI 都走这里）；**没有答案源就只记事件，绝不替玩家随机弃牌**
 * （规则书 §10.3：禁止用随机替代玩家选择）。
 */
export function enforceHandLimit(state, seat, opts = {}) {
  const events = [];
  const limit = RULES.deck.handLimit ?? 5;   // §2.5 手牌上限 5（常量在 RULES.deck 下）
  let guard = 0;
  while (seat.hand.length > limit && guard++ < 20) {
    const excess = seat.hand.length - limit;
    if (typeof opts.answer !== 'function') {
      events.push({ type: 'handLimitExceeded', seat: seat.id, hand: seat.hand.length, limit, note: '超出上限且没有答案源 ⇒ 不擅自弃牌' });
      break;
    }
    const picked = opts.answer({ kind: 'pickCards', seat: seat.id, from: 'hand', need: excess, allowLess: false, candidates: seat.hand.slice(), reason: `手牌上限 ${limit}：弃 ${excess} 张` });
    const idxs = (Array.isArray(picked) ? picked : [picked]).map((x) => Number(x) || 0).sort((a, b) => b - a);
    const cards = [];
    for (const i of idxs) { const c = seat.hand.splice(i, 1)[0]; if (c) { seat.grave.push(c); cards.push(c); } }
    if (!cards.length) { events.push({ type: 'handLimitNoPick', seat: seat.id }); break; }
    events.push({ type: 'handLimitDiscard', seat: seat.id, cards, limit });
  }
  return events;
}

/** 该座位当前回合是否可以进行"主要阶段动作"（§4.3.1/§4.3.2 由 phases.canPlayCardInPhase 细化） */
export function isMainPhase(state) {
  return state.phase === PHASES.MAIN1 || state.phase === PHASES.MAIN2;
}

export function phaseOrder() { return [...PHASE_ORDER]; }

/** 规则书 §4.4「一次行动」：从自己本回合到下个自己回合开始前 —— 判据是 turn 差 */
export function isSameAction(state, seatId, markTurn) {
  return state.currentPlayer === seatId && state.turn === markTurn;
}

export { RULES };
