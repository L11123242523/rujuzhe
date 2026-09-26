/**
 * 入局者 v2 · 时点总线（16 时点的扫描器）
 * ---------------------------------------------------------------------------
 * 旧引擎的"总线"只是**广播**：`runTiming` 顺序调订阅者，而全工程只有 7/16 个时点有人订阅，
 * 且"需要双方连锁的时点**不走** runTiming"（`game.html:16660-16663` 注释）——
 * 于是"有总线"被误当成"接上了"。
 *
 * 新引擎的每个时点都要有**扫描器**：`SCANNERS['timing:<point>'](state, win)` 返回该时点的候选
 * （必发/选发分列）。能力（角色被动、SP、卡在场效果）通过 `registerAbility` 登记为**数据**，
 * 扫描时按 `when()` 过滤 → 这就是规格 §二·2 说的"引擎在时点暂停 → 全场统一扫描"。
 * `missingTimingScanners()` 会如实报告还有几个时点没接（门禁用），不允许"有总线=接上了"。
 */

import { TIMING_ORDER } from './points.js';
import { registerScanner, openWindow, SCANNERS } from '../window.js';

/** 已登记的能力：id → spec */
const ABILITIES = new Map();

/**
 * @param {object} spec
 *   id          唯一 id（含卡/角色来源，便于追踪）
 *   point       时点名（16 时点之一）
 *   owner(ctx)  归属座位
 *   mandatory   必发（无条件）还是选发
 *   when(state, ctx) 条件（默认恒真）
 *   label       显示名
 *   card        来源卡（可为 null）
 *   ops         编译好的 ops（数据）；或
 *   fire(state, win) 专用实现（少量机制）
 */
export function registerAbility(spec) {
  if (!spec || !spec.id) throw new Error('[engine.timing] registerAbility 需要 id');
  if (!TIMING_ORDER.includes(spec.point)) throw new Error('[engine.timing] 未知时点：' + spec.point);
  ABILITIES.set(spec.id, spec);
  return spec.id;
}

export function unregisterAbility(id) { ABILITIES.delete(id); }
export function clearAbilities() { ABILITIES.clear(); }
export function registeredAbilities() { return [...ABILITIES.values()]; }

/** 某时点上"条件成立"的全部能力（全场扫描：不做归属过滤，过滤交给调用方/内容层） */
export function abilitiesAt(state, point, ctx) {
  const out = [];
  for (const a of ABILITIES.values()) {
    if (a.point !== point) continue;
    let ok = true;
    try { ok = a.when ? !!a.when(state, ctx) : true; } catch { ok = false; }
    if (ok) out.push(a);
  }
  return out;
}

/** 时点扫描器：把能力变成窗口候选 */
export function scanAt(state, point, ctx) {
  return abilitiesAt(state, point, ctx).map((a) => ({
    id: 'ab:' + a.id,
    owner: typeof a.owner === 'function' ? a.owner(ctx) : (a.owner || ctx.seat || state.currentPlayer),
    label: a.label || a.id,
    mandatory: !!a.mandatory,
    card: a.card || null,
    chainKind: a.chainKind || null,
    ops: a.ops || null,
    fire: a.fire || null,
    alive: a.alive || null,
    meta: { abilityId: a.id, point },
  }));
}

// 为 16 个时点各注册一个扫描器（名字即 'timing:<point>'，与 openWindow 的默认 scanKind 一致）
for (const p of TIMING_ORDER) {
  registerScanner('timing:' + p, (state, win) => scanAt(state, win.point, win.ctx || {}));
}

/** 还有哪些时点"没有登记任何能力"（框架层 16 个时点都有扫描器；这里看的是内容层覆盖） */
export function timingsWithoutAbilities() {
  const used = new Set([...ABILITIES.values()].map((a) => a.point));
  return TIMING_ORDER.filter((p) => !used.has(p));
}

/** 扫描器覆盖率（框架层）：16 个时点是否都注册了扫描器 */
export function timingScannerCoverage() {
  const registered = TIMING_ORDER.filter((p) => typeof SCANNERS.get('timing:' + p) === 'function');
  return { registered: registered.length, of: TIMING_ORDER.length };
}

/**
 * 在某个时点开窗（唯一入口）。能力扫描 + 手牌/盖伏连锁候选由窗口驱动时合并。
 */
export function openTiming(state, point, ctx = {}, opts = {}) {
  if (!TIMING_ORDER.includes(point)) throw new Error('[engine.timing] 未知时点：' + point);
  return openWindow(state, {
    kind: opts.kind || 'simultaneous',
    point,
    ctx,
    scanKind: 'timing:' + point,
    c1: opts.c1 || null,
    firstSeat: opts.firstSeat || ctx.seat || state.currentPlayer,
    parent: opts.parent || null,
  });
}

/**
 * 只在"该时点确实登记了能力"时才开窗，否则返回 null。
 * 目的：不让每个时点都空开一个需要人答的窗口（否则单机每步都要人点"不发动"）。
 */
export function openTimingIfAny(state, point, ctx = {}, opts = {}) {
  const ability = abilitiesAt(state, point, ctx);
  if (!ability.length) return null;
  return openTiming(state, point, ctx, opts);
}

export { SCANNERS };
