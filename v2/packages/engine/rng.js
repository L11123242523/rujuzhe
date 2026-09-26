/**
 * 入局者 v2 · 可注入随机源
 * ---------------------------------------------------------------------------
 * 从旧引擎 `RJEngine.createRNG`（game.html:3641-3668）**逐字移植**，
 * 只做两处收紧（见《重做方案.md》§三 硬约束）：
 *   ① 引擎内**禁止时间种子**：`createRNG()` 不传种子即抛错，随机必须显式可复现；
 *      需要"随便来一手"的调用方（UI 开新局）自己用 `seedFromTime()`。
 *   ② 只保留纯粹的方法，不挂任何模块级可变状态。
 * 同一份 state + 同一个种子 + 同一串动作 ⇒ 同一结果。
 */

/** mulberry32：确定性 PRNG（与旧引擎逐字一致） */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 只在"开局、且明确不需要复现"的调用方使用（如 UI 新开一局） */
export function seedFromTime() {
  const t = (typeof Date !== 'undefined' ? Date.now() : 0) >>> 0;
  const p = (typeof performance !== 'undefined' && performance.now
    ? Math.floor(performance.now() * 1000) : 0) >>> 0;
  return (t ^ p) >>> 0;
}

/**
 * @param {number} seed 必须显式给出（0 也是合法种子）
 */
export function createRNG(seed) {
  if (seed === undefined || seed === null) {
    throw new Error('[engine.rng] createRNG 必须显式传入种子（引擎内禁止时间种子；开局请用 seedFromTime()）');
  }
  if (!Number.isInteger(seed)) throw new Error('[engine.rng] 种子必须是整数，收到：' + JSON.stringify(seed));
  let r = mulberry32(seed);
  return {
    seed: seed >>> 0,
    next() { return r(); },
    int(n) { return Math.floor(r() * n); },
    range(a, b) { return a + Math.floor(r() * (b - a + 1)); },
    dice(sides) { return 1 + Math.floor(r() * (sides || 6)); },
    coin() { return r() < 0.5; },
    pick(arr) { return (arr && arr.length) ? arr[Math.floor(r() * arr.length)] : null; },
    /** Fisher–Yates：返回打乱后的新数组（不改原数组） */
    shuffled(arr) {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const tmp = out[i]; out[i] = out[j]; out[j] = tmp;
      }
      return out;
    },
    /** 原地打乱（兼容旧 shuffleArray 的就地语义） */
    shuffleInPlace(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    },
    reseed(s) { r = mulberry32(s); this.seed = s >>> 0; return this; },
  };
}
