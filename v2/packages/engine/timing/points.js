/**
 * 入局者 v2 · 时点表（16 时点）
 * ---------------------------------------------------------------------------
 * 唯一来源：`_时点规格.txt`（作者提供的权威时点列表）+ 旧引擎 `TIMING`
 * （game.html:16665-16682）——两者逐条对应，本项目实测确认。
 *
 * 与旧引擎的**唯一区别**（《重做方案.md》D2/D3）：旧引擎的时点只是"广播"
 * （`runTiming` 顺序调订阅者，覆盖 7/16），新引擎的每个时点都必须有一个
 * **扫描器**：`SCANNERS[point](state, ctx) -> candidates`。没有扫描器的时点
 * 视为"尚未实现"，门禁会红——不允许"有总线就等于接上了"。
 */

/** 16 个时点（顺序即《_时点规格》的编号顺序，第 6 条一分为二） */
export const TIMING = Object.freeze({
  ON_DRAW: 'on_draw',
  ON_ADD_HAND: 'on_add_hand',
  ON_TO_GRAVE: 'on_to_grave',
  ON_REMOVE: 'on_remove',
  ON_REMOVE_TO_HAND: 'on_remove_to_hand',
  ON_ACTIVATE: 'on_activate',
  ON_APPLY: 'on_apply',
  ON_EFFECT_DONE: 'on_effect_done',
  ON_MOVE_PENDING: 'on_move_pending',
  BEFORE_DAMAGE: 'before_damage',
  ON_DAMAGE: 'on_damage',
  AFTER_DAMAGE: 'after_damage',
  BEFORE_HURT: 'before_hurt',
  ON_HURT: 'on_hurt',
  AFTER_HURT: 'after_hurt',
  ON_RECOVER_COST: 'on_recover_cost',
});

export const TIMING_ORDER = Object.freeze([
  TIMING.ON_DRAW,
  TIMING.ON_ADD_HAND,
  TIMING.ON_TO_GRAVE,
  TIMING.ON_REMOVE,
  TIMING.ON_REMOVE_TO_HAND,
  TIMING.ON_ACTIVATE,
  TIMING.ON_APPLY,
  TIMING.ON_EFFECT_DONE,
  TIMING.ON_MOVE_PENDING,
  TIMING.BEFORE_DAMAGE,
  TIMING.ON_DAMAGE,
  TIMING.AFTER_DAMAGE,
  TIMING.BEFORE_HURT,
  TIMING.ON_HURT,
  TIMING.AFTER_HURT,
  TIMING.ON_RECOVER_COST,
]);

/** 每个时点的中文名与"谁在此刻会被问"的一句话说明（UI/日志/报错都用它，禁止各处自造措辞） */
export const TIMING_INFO = Object.freeze({
  on_draw: { label: '玩家抽卡时', spec: '_时点规格 1' },
  on_add_hand: { label: '玩家将卡加入手卡（检索）', spec: '_时点规格 2' },
  on_to_grave: { label: '玩家将卡送入墓地', spec: '_时点规格 3' },
  on_remove: { label: '玩家将卡移出游戏', spec: '_时点规格 4' },
  on_remove_to_hand: { label: '玩家将移出游戏的卡加入手卡', spec: '_时点规格 5' },
  on_activate: { label: '玩家发动效果', spec: '_时点规格 6' },
  on_apply: { label: '玩家发动的效果进入适用时点（无连锁）', spec: '_时点规格 6（括号内）' },
  on_effect_done: { label: '玩家适用的效果结算完成后', spec: '_时点规格 7' },
  on_move_pending: { label: '玩家的移动产生但还未适用', spec: '_时点规格 8' },
  before_damage: { label: '玩家造成伤害前', spec: '_时点规格 9' },
  on_damage: { label: '玩家造成伤害时', spec: '_时点规格 10' },
  after_damage: { label: '玩家造成伤害后', spec: '_时点规格 11' },
  before_hurt: { label: '玩家受到伤害前', spec: '_时点规格 12' },
  on_hurt: { label: '玩家受到伤害时', spec: '_时点规格 13' },
  after_hurt: { label: '玩家受到伤害后', spec: '_时点规格 14' },
  on_recover_cost: { label: '玩家回复音韵值', spec: '_时点规格 15' },
});

/**
 * 时点扫描器注册表在 **window.js**（`SCANNERS` / `registerScanner`）——
 * 窗口只存 `scanKind` 字符串，扫描器按名字查表，这是"窗口可序列化"的前提。
 * `timing/bus.js` 负责为 16 个时点各注册一个扫描器（名字 `timing:<point>`），
 * 并提供 `timingScannerCoverage()` 如实报告覆盖率。
 */
