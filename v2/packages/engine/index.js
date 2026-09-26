/**
 * 入局者 v2 · 引擎入口
 * ---------------------------------------------------------------------------
 * 硬约束（《重做方案.md》§三，CI 强制）：
 *   engine 内禁止出现 document / window / setTimeout / Math.random /
 *   名字子串判身份 / 裸 catch {}。随机只走 rng.js 的显式种子源。
 */

export { mulberry32, createRNG, seedFromTime } from './rng.js';
export {
  PHASES, PHASE_ORDER, PHASE_LABEL, nextPhase, canPlayCardInPhase,
} from './phases.js';
export { TIMING, TIMING_ORDER, TIMING_INFO } from './timing/points.js';
export {
  SEAT_SCHEMA, SEAT_FIELDS, LIFETIMES, declareFlag, declaredFlags,
  createSeat, createState, seatOf, playerIds, othersOf, foeOf, busyReason, validateState,
} from './state.js';
export { ENGINE_FLAGS } from './flags.js';   // 导入即完成引擎自有 flag 的生存期登记
export {
  resetLifetime, startTurn, advancePhase, endTurn, isMainPhase, phaseOrder, isSameAction,
} from './flow.js';

// 规则层
export {
  RULES, levelUpCost, motivationCap,
} from './rules/constants.js';
export { ATTRS, COUNTER, normalizeAttr, beats, kindOf, teamAttributeFromChars } from './rules/attributes.js';
export { attackBonus, computeDamage } from './rules/damage.js';
export {
  syncFromCharacters, maxCost, regenAmount, gainCost, payCost,
  refillDeckIfEmpty, takeTopCard, drawByCost, toGrave, sacrifice, discardToLimit,
} from './rules/resources.js';
export { applyLevelUps, gainMotivation, useGuideCore, motivationToNext } from './rules/levels.js';
export {
  TILE_COUNT, LAYOUT, wrap, clampMove, tileAt, isInteractive, tileRule, moveSeat,
} from './rules/map.js';
export { executeOps, OPS, DECLARED_GAPS, opsCoverage, compare } from './ops/index.js';
export { quoteCost, payCardCost, baseCostOf, costModifiers } from './rules/cost.js';

// P3：时点与连锁
export {
  SCANNERS, registerScanner, openWindow, runWindow, queueTrigger, abandonWindow,
  windowActive, windowSnapshot, flattenCardOps,
} from './window.js';
export { makeDecision, answerDecision, takeAnswer, consumeAnswer, pendingOf } from './decision.js';
export {
  CHAIN_KINDS, WINDOW_KINDS, opsOf, chainKindOf, chainableAt, legality, offerChain,
} from './offer.js';
export {
  registerAbility, unregisterAbility, clearAbilities, registeredAbilities,
  abilitiesAt, scanAt, timingsWithoutAbilities, timingScannerCoverage, openTiming, openTimingIfAny,
} from './timing/bus.js';

// P4：出牌入口 + 逐卡能力 + 对局自跑
export { playCard, placeAfterUse, driveToIdle } from './play.js';
export {
  ABILITY_STATS, ABILITY_SOURCE, abilityById, abilitiesForCard, allAbilities,
  collectModifiers, collectRegenBonus, collectMaxCostBonus, chainKindOverride,
  isNegateEffectCard, scriptForCard, damagePayOffers, commitDamagePay,
} from './abilities.js';
export { runSelfTest, stubAnswer, fireTiming } from './selftest.js';
export { NeedsAnswer } from './window.js';

export const ENGINE_VERSION = '2.0.0-p4';
