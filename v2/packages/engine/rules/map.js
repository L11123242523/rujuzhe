/**
 * 入局者 v2 · 地图（规则书 §6.4 / 第七章 / 附录B）
 * ---------------------------------------------------------------------------
 * 布局 42 格逐格取自旧引擎 `MAP_TILES`（game.html:3880-3923），只保留**规则字段**
 * （id/type/name）；x/y 是 3D 渲染坐标，属表现层，不进引擎。
 * `tools/diff-harness/diff-rules.mjs` 会把这份布局与 game.html 文本逐格比对。
 */

import { RULES } from './constants.js';

export const TILE_COUNT = RULES.movement.tiles;

/** 42 格布局（顺序即 id）：[type, name] */
const RAW = [
  ['start', '起点'], ['gift', '馈赠格'], ['item', '易物'], ['again', 'Again'], ['gift', '馈赠格'],
  ['bus', '公交站'], ['card', '卡牌格'], ['subway', '地铁'], ['story', 'Story'], ['power', '配电室'],
  ['inspire', '灵感'], ['gift', '馈赠格'], ['card', '卡牌格'], ['read', '阅览室'],
  ['gift', '馈赠格'], ['card', '卡牌格'], ['bus', '公交站'], ['story', 'Story'], ['subway', '地铁'],
  ['card', '卡牌格'], ['gift', '馈赠格'], ['shrine', '神社'], ['inspire', '灵感'], ['gift', '馈赠格'],
  ['card', '卡牌格'], ['game', 'GAME'], ['again', 'Again'], ['subway', '地铁'], ['gift', '馈赠格'],
  ['story', 'Story'], ['bus', '公交站'], ['power', '配电室'], ['gift', '馈赠格'], ['card', '卡牌格'],
  ['airport', '机场'], ['gift', '馈赠格'], ['card', '卡牌格'], ['subway', '地铁'], ['story', 'Story'],
  ['card', '卡牌格'], ['bus', '公交站'], ['gift', '馈赠格'],
];

export const LAYOUT = Object.freeze(RAW.map(([type, name], id) => Object.freeze({ id, type, name })));

/** 位置归一到 0..41（环形地图） */
export function wrap(pos) {
  const n = ((pos % TILE_COUNT) + TILE_COUNT) % TILE_COUNT;
  return n;
}

/** 单次位移上限 20 格（§6.4）：超过按 20 计（符号保留） */
export function clampMove(steps) {
  const cap = RULES.movement.cap;
  return Math.max(-cap, Math.min(cap, steps | 0));
}

export function tileAt(pos) {
  return LAYOUT[wrap(pos)];
}

/* ── 环形几何（与旧引擎逐字等价：game.html:4826-4850） ──────────────────────
 * RING_EDGES 把 42 格分成四条"边"（下 0→13 / 左 13→21 / 上 21→34 / 右 34→0），
 * `TILE_EDGE_MASK` 记录每格属于哪几条边 —— "同一行"就是**共享至少一条边**。
 * 这是**规则**（决定谁能打到谁），不是渲染数据，所以必须进引擎。
 */
export const RING_EDGES = Object.freeze([[0, 13], [13, 21], [21, 34], [34, 0]]);

export const TILE_EDGE_MASK = (() => {
  const N = TILE_COUNT;
  const masks = new Array(N).fill(0);
  RING_EDGES.forEach(([a, b], e) => {
    const span = ((b - a) % N + N) % N;
    for (let i = 0; i <= span; i++) masks[(a + i) % N] |= (1 << e);
  });
  return Object.freeze(masks);
})();

/** 从 a 沿前进方向的步数 */
export function ringForward(a, b) {
  const N = TILE_COUNT;
  return ((b - a) % N + N) % N;
}

/** a、b 沿环的最短步数 */
export function ringMinDist(a, b) {
  const N = TILE_COUNT, d = ringForward(a, b);
  return Math.min(d, N - d);
}

/** 同一行（共享至少一条边） */
export function isSameRow(pos1, pos2) {
  const m1 = TILE_EDGE_MASK[wrap(pos1)], m2 = TILE_EDGE_MASK[wrap(pos2)];
  return (m1 & m2) !== 0;
}

/**
 * 射程判定（把编译出来的 `range/aoe` 数据翻译成"打不打得到"）。
 * 与旧引擎 `__rangeOk`（game.html:4877）同口径：
 *   · 前方 N  → 前进方向 1..N 格
 *   · 前后 N  → 环最短距离 ≤ N（N=0 表示同格）
 *   · row     → 同一行（共享边）
 * 规则书 §6.4.1：范围**包含自身所在格**（前后 0），但"其他玩家"类描述仍排除自己。
 */
export function inRange(fromPos, toPos, spec) {
  if (!spec) return true;
  const dir = spec.dir;
  const n = spec.range ?? 0;
  if (dir === '前方') { const d = ringForward(fromPos, toPos); return d >= 1 && d <= n; }
  if (dir === '前后') return ringMinDist(fromPos, toPos) <= n;
  if (dir === 'row') return isSameRow(fromPos, toPos);
  if (dir === 'global') return true;
  return true;
}

/** 该格是否"到达后可选择不执行"（规则书 §7.5.1 交互格 / §7.5.2 非交互格） */
export function isInteractive(type) {
  return !!RULES.tiles[type]?.interactive;
}

export function tileRule(type) {
  return RULES.tiles[type] ?? null;
}

/**
 * 走格：位移量先按 §6.4 截断，再环形推进。
 * @returns {{from:number,to:number,steps:number,capped:boolean,passedStart:boolean,landed:object,
 *            events:Array<{type:string, ...}>}}
 * 起点：经过 +400 金币 +1 音韵；到达双倍（附录B）
 */
export function moveSeat(seat, steps) {
  const from = wrap(seat.position || 0);
  const capped = clampMove(steps);
  const to = wrap(from + capped);
  const events = [];
  const forward = capped > 0;
  // 经过起点：正向走且路径包含 0，但**落点不是 0**（落点是 0 时按"到达"双倍算）
  let passedStart = false;
  if (forward && capped > 0) {
    for (let i = 1; i <= capped; i++) {
      if (wrap(from + i) === 0) passedStart = true;
    }
  }
  if (passedStart && to !== 0) {
    events.push({ type: 'passStart', gold: RULES.tiles.start.passGold, cost: RULES.tiles.start.passCost });
  }
  seat.position = to;
  const landed = tileAt(to);
  if (to === 0) {
    events.push({ type: 'landStart', gold: RULES.tiles.start.landGold, cost: RULES.tiles.start.landCost });
  }
  events.push({ type: 'move', from, to, steps: capped, capped: steps !== capped, tile: landed });
  return { from, to, steps: capped, capped: steps !== capped, passedStart, landed, events };
}
