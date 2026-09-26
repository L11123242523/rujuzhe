/**
 * 入局者 v2 · 回合阶段机（纯函数）
 * ---------------------------------------------------------------------------
 * 依据《入局者规则书》第四章：准备 → 主要1 → 投掷 → 主要2 → 结束。
 * 移植自旧引擎 `RJEngine`（game.html:3672-3687）——注意：旧引擎里这份纯实现
 * **从未被接线**（活的是一份手写 if 链），新引擎只保留这一份。
 */

export const PHASES = Object.freeze({
  PREPARE: 'prepare',
  MAIN1: 'main1',
  ROLL: 'roll',
  MAIN2: 'main2',
  END: 'end',
});

export const PHASE_ORDER = Object.freeze(['prepare', 'main1', 'roll', 'main2', 'end']);

export const PHASE_LABEL = Object.freeze({
  prepare: '准备阶段', main1: '主要阶段1', roll: '投掷阶段', main2: '主要阶段2', end: '结束阶段',
});

/** 下一阶段；已是 end 时返回 null（由调用方决定是否推进到下一回合） */
export function nextPhase(cur) {
  const i = PHASE_ORDER.indexOf(cur);
  if (i < 0) return null;
  if (i === PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[i + 1];
}

/**
 * 阶段层面的可发动性（不含费用/对象，那些属于合法性层 offer/legality）。
 * 规则书第四章：技能卡"全时点"（自己投掷阶段除外）；盖伏翻开任意阶段；普通卡仅主要阶段。
 * @returns {{ok: boolean, reason?: string}}
 */
export function canPlayCardInPhase(phase, opts = {}) {
  if (opts.fromFaceDown) return { ok: true };
  if (opts.isSkill && phase !== PHASES.ROLL) return { ok: true };
  if (phase === PHASES.MAIN1 || phase === PHASES.MAIN2) return { ok: true };
  return { ok: false, reason: '当前阶段不能手动发动' };
}
