/**
 * 入局者 v2 · 唯一状态根
 * ---------------------------------------------------------------------------
 * 这一层要治的是旧引擎最贵的病（《重做方案.md》D5）：
 *   旧引擎有 **662 处 `._xxx = …` 赋值 / 368 个散落隐藏字段**，其中
 *   "同一概念多份存储"10 组、"只写不读"一整批（连 `_eliminated` 都没人读）。
 *
 * 新引擎的规矩（写进 CI，违反即门禁红）：
 *   ① **座位字段是固定 schema**：`createSeat()` 里没有的键，一律不许出现在 seat 上；
 *   ② **flag / counter 必须声明**：`declareFlag(kind, name, lifetime)` 登记后才能用，
 *      且 lifetime 决定它在哪个边界被清（旧引擎"重置点各不相同"由此结构性消失）；
 *   ③ 引擎的**进行中状态也是数据**（`window` / `pendingDecisions`），不是闭包 —— 
 *      所以可序列化、可快照、可重连；
 *   ④ 每局开始**重建所有可变对象**，跨局残留从设计上不可能（旧引擎踩过 `publicGraveyard`、
 *      `_escalateCount`、`_huginnUsedGame` 等跨局残留）。
 */

/** 座位 schema：字段名 → 默认值工厂（唯一真源；旧 __makeSeatState 的 25 个公开字段 + 4 个懒创建字段） */
export const SEAT_SCHEMA = Object.freeze({
  // 身份
  id: null,
  captain: null,
  /** 队员名单（角色名）：队员位被动是否生效要看它（§6.1 编组） */
  teamNames: [],
  teamAttribute: null,
  // 资源
  sync: 0,
  maxSync: 0,
  fascination: 0,
  cost: 0,
  maxCost: 12,
  gold: 0,
  // 等级与激励
  level: 1,
  motivation: 0,
  // 区域（顺序即"牌组顶=索引 0"以外，牌组顶在 deck[0]，与旧引擎一致）
  deck: () => [],
  hand: () => [],
  grave: () => [],
  removed: () => [],
  removedFromGame: () => [],
  permanent: () => [],
  faceDownCards: () => [],
  eventCards: () => [],
  musicCards: () => [],
  // 战斗数值
  defense: 0,
  defenseBase: 0,
  shield: 0,
  attackBuff: 0,
  moveBuff: 0,
  moveDebuff: 0,
  negativeEffects: () => [],
  /** 状态/增益（crit_rate / overclock / 护盾强化…）：结构化，不再是散落的 `_xxxBonus` */
  statuses: () => ({}),
  /** 最近被破坏的卡（destroy_route 要用：把符合条件的破坏结果改为移出游戏） */
  lastDestroyed: null,
  /** 延迟移出登记（exile_pick："N 次行动内移出游戏"） */
  exilePending: () => [],
  // 地图
  position: 0,
  closedTile: () => [],
  passedStart: false,
  // 声明式 flag / counter（见 LIFETIMES）
  flags: () => ({}),
  counters: () => ({}),
});

export const SEAT_FIELDS = Object.freeze(Object.keys(SEAT_SCHEMA));

/**
 * flag 的生存期：决定它在哪个边界被清空。旧引擎的"重置点各不相同"就是缺这一列。
 *  - game   : 一局一次（旧 `_huginnUsedGame` / `_aoiDiscountUsed` 一族）
 *  - turn   : 每个自己回合开始清（旧 `usedSkillsThisTurn` / `_skillUsedThisTurn` 一族）
 *  - action : 每次行动清（旧"下一次"修饰符一族）
 *  - card   : 跟随卡对象生命周期（离区/进墓即清）
 */
export const LIFETIMES = Object.freeze(['game', 'turn', 'action', 'card']);

const DECLARED = { game: new Set(), turn: new Set(), action: new Set(), card: new Set() };

/** 登记一个 flag / counter —— 未登记就写进 state 的，`validateState()` 会报错 */
export function declareFlag(kind, name, lifetime) {
  if (kind !== 'flags' && kind !== 'counters') throw new Error('[engine.state] kind 只能是 flags/counters');
  if (!LIFETIMES.includes(lifetime)) throw new Error('[engine.state] 未知 lifetime：' + lifetime);
  DECLARED[lifetime].add(kind + ':' + name);
  return name;
}

export function declaredFlags(lifetime) {
  if (lifetime) return [...DECLARED[lifetime]];
  return LIFETIMES.flatMap((l) => [...DECLARED[l]].map((x) => l + ':' + x));
}

export function createSeat(id) {
  const seat = {};
  for (const [k, def] of Object.entries(SEAT_SCHEMA)) {
    seat[k] = (typeof def === 'function') ? def() : def;
  }
  seat.id = id;
  return seat;
}

/**
 * @param {{seatIds?: string[], seed: number, rules?: object}} opts
 *   seatIds 默认为 1v1 的 ['p1','p2']；**座位模型按 N 座设计**（2v2 暂不做，但结构支持）。
 */
export function createState(opts = {}) {
  const seatIds = opts.seatIds ?? ['p1', 'p2'];
  if (!Array.isArray(seatIds) || seatIds.length < 2) {
    throw new Error('[engine.state] 至少两名座位');
  }
  const seats = {};
  for (const id of seatIds) {
    if (seats[id]) throw new Error('[engine.state] 座位 id 重复：' + id);
    seats[id] = createSeat(id);
  }
  return {
    version: 2,
    seed: opts.seed >>> 0,
    seatIds: seatIds.slice(),
    seats,
    turn: 1,
    round: 1,
    currentPlayer: seatIds[0],
    phase: 'prepare',
    /** 当前时点窗口（数据，不是闭包）；关窗后必须回到 null */
    window: null,
    windowSeq: 0,
    /** 待决策队列（可序列化）；空 = 引擎空闲 */
    pendingDecisions: [],
    /** 已答未消费的答案：决策 id → 值（窗口 resume 用） */
    answers: {},
    /** 结算中新触发的必发（窗口会就地开子窗口处理，见 window.js） */
    pendingTriggers: [],
    /** 待开的"新连锁"队列：结算中产生的新效果，等本连锁全部处理完再依次开链（作者口径） */
    chainQueue: [],
    /** 待结算的瞬态意图（**真的还没结算**的动作：追加投掷阶段、被打断的移动…）—— 参与"引擎忙不忙"的判据 */
    pending: {},
    /** 引擎簿记（最近的骰值、最近移动来源…）：**不参与**忙碌判据，纯记录 */
    book: {},
    /** 已登记的机制（路障/终止移动/领域/决斗…）：是**状态**不是待结算动作，不参与忙碌判据 */
    mechanics: { barriers: [], stopAllMove: false, extraRollPhase: false, duel: null, swapTile: null },
    /** 公共牌堆（馈赠/乐谱/事件/御神签）：由 setupPublicDecks 填充（§7） */
    publicDecks: { gift: [], music: [], event: [], omikuji: [] },
    log: [],
    diagnostics: [],
    rules: { ...(opts.rules ?? {}) },
  };
}

export function seatOf(state, id) {
  const s = state.seats[id];
  if (!s) throw new Error('[engine.state] 未知座位：' + id);
  return s;
}

export function playerIds(state) {
  return state.seatIds.slice();
}

export function othersOf(state, id) {
  return state.seatIds.filter((x) => x !== id);
}

export function foeOf(state, id) {
  return othersOf(state, id)[0] ?? null;
}

/** 从任意路径取出的"进行中状态"是否为空 —— 快照检查点判据（取代旧 `__eeIdleForSnapshot`） */
export function busyReason(state) {
  if (state.window) return '时点窗口未关闭（' + state.window.point + '/' + state.window.state + '）';
  if (state.pendingDecisions.length) return '有 ' + state.pendingDecisions.length + ' 个待决策未应答';
  for (const [k, v] of Object.entries(state.pending)) {
    if (v) return '有待结算动作：' + k;
  }
  return '';
}

/**
 * 不变量检查（单测与门禁调用）。返回问题清单，空 = 合法。
 * 这里**故意做得很严**：出现未声明字段就是 bug，而不是"以后再清理"。
 */
export function validateState(state) {
  const problems = [];
  if (!state || typeof state !== 'object') return ['state 不是对象'];
  if (!Array.isArray(state.seatIds) || state.seatIds.length < 2) problems.push('seatIds 至少两名');
  if (!(state.currentPlayer in (state.seats || {}))) problems.push('currentPlayer 不在座位上：' + state.currentPlayer);
  if (!['prepare', 'main1', 'roll', 'main2', 'end'].includes(state.phase)) problems.push('未知阶段：' + state.phase);
  if (state.window && !state.window.point && !state.window.kind) problems.push('window 缺 point/kind');
  if (!Array.isArray(state.pendingDecisions)) problems.push('pendingDecisions 必须是数组');
  if (!state.answers || typeof state.answers !== 'object') problems.push('answers 必须是对象');
  if (!Array.isArray(state.pendingTriggers)) problems.push('pendingTriggers 必须是数组');
  if (!state.book || typeof state.book !== 'object') problems.push('book 必须是对象');
  if (!state.mechanics || typeof state.mechanics !== 'object') problems.push('mechanics 必须是对象');
  if (!Array.isArray(state.log)) problems.push('log 必须是数组');

  for (const id of state.seatIds) {
    const seat = state.seats[id];
    if (!seat) { problems.push('缺座位对象：' + id); continue; }
    const extra = Object.keys(seat).filter((k) => !SEAT_FIELDS.includes(k));
    if (extra.length) problems.push(`座位 ${id} 有未声明字段：${extra.join(', ')}`);
    if (seat.id !== id) problems.push(`座位 ${id} 的 id 字段不一致：${seat.id}`);
    for (const kind of ['flags', 'counters']) {
      for (const name of Object.keys(seat[kind] || {})) {
        const owner = LIFETIMES.find((l) => DECLARED[l].has(kind + ':' + name));
        if (!owner) {
          problems.push(`座位 ${id} 的 ${kind}.${name} 未声明（请先 declareFlag('${kind}','${name}','game|turn|action|card')）`);
        }
      }
    }
  }
  return problems;
}

/* ============================================================================
 * 引擎自有 flag / counter 的**声明**（唯一处）
 * ----------------------------------------------------------------------------
 * 旧引擎"重置点各不相同"（有的消费处清、有的每回合清、有的从不清）在这里变成一列声明：
 * 每个 flag 属于哪个生存期，由 `flow.resetLifetime` 按声明边界统一清。
 *
 * **声明放在 state.js，而不是单独的 flags.js**：任何创建 state 的入口都必然 import 本模块，
 * 于是"忘了 import 声明表 ⇒ 所有 flag 都判未声明"这种隐式耦合不会再发生
 * （P4 对局自跑第一次就跑出 11 条"未声明"问题，正是这个原因）。
 * ========================================================================== */
declareFlag('counters', 'guideCore', 'game');        // §7.2.5 引导核心持有数
declareFlag('flags', 'guideCoreUsed', 'game');
declareFlag('counters', 'regenBonus', 'game');       // 自然回复加成（内容声明之外的即时累加）
declareFlag('flags', 'aoiPassive', 'game');          // 小野葵：携带卡首用 −1
declareFlag('flags', 'ningSP', 'game');              // 宁雨清SP：因效果加入手卡 −1

declareFlag('counters', 'sacrificeUsed', 'turn');    // §11.1 每回合 1 次献祭
declareFlag('counters', 'sacrificeBonus', 'turn');   // 【松山惠】乐曲δ"本回合献祭次数+1"
declareFlag('counters', 'costDraws', 'turn');        // §5.3 音韵抽卡次数
declareFlag('counters', 'moveTotal', 'turn');        // §4.2.1 单回合累计移动格数
declareFlag('counters', 'skillsUsed', 'turn');       // 每回合一次类技能
declareFlag('flags', 'normalDrawDone', 'turn');      // §2.5 每回合准备阶段抽 1
declareFlag('counters', 'tempAttack', 'turn');       // attack_buff_temp
declareFlag('counters', 'nextAttackPierce', 'turn'); // next_attack_pierce
declareFlag('counters', 'doubleMove', 'turn');       // buff_double_move
declareFlag('counters', 'nextDiceSides', 'turn');    // 指定下次骰种
declareFlag('flags', 'modifyDiceNext', 'turn');      // 下次可改点
declareFlag('counters', 'lastPaidCost', 'turn');     // 本次实际支付额
declareFlag('counters', 'giftStreak', 'game');       // §7.1.3 馈赠卡保底计数（每 6 次必出和声）

declareFlag('counters', 'overloadLeft', 'action');   // §7.2.4 过载持续次数
declareFlag('counters', 'preventDamage', 'action');  // prevent_next_damage
declareFlag('counters', 'nextJudgeBonus', 'action'); // buff_next_judge
declareFlag('flags', 'directionReversed', 'action'); // change_direction
declareFlag('flags', 'moveInterrupted', 'action');   // interrupt_move
declareFlag('counters', 'bonusMoveAfter', 'action'); // buff_bonus_move_after
declareFlag('counters', 'nextCostDown', 'action');   // next_cost_down
declareFlag('counters', 'nextMoveAdjust', 'action'); // 位移增减
declareFlag('counters', 'fixedNextMove', 'action');  // 固定位移

/** 引擎自有 flag 的生存期总表（供文档/门禁打印） */
export const ENGINE_FLAGS = Object.freeze({
  game: ['counters:guideCore', 'flags:guideCoreUsed', 'counters:regenBonus', 'flags:aoiPassive', 'flags:ningSP'],
  turn: [
    'counters:sacrificeUsed', 'counters:costDraws', 'counters:moveTotal', 'counters:skillsUsed',
    'flags:normalDrawDone', 'counters:tempAttack', 'counters:nextAttackPierce', 'counters:doubleMove',
    'counters:nextDiceSides', 'flags:modifyDiceNext', 'counters:lastPaidCost',
  ],
  action: [
    'counters:overloadLeft', 'counters:preventDamage', 'counters:nextJudgeBonus',
    'flags:directionReversed', 'flags:moveInterrupted', 'counters:bonusMoveAfter', 'counters:nextCostDown',
    'counters:nextMoveAdjust', 'counters:fixedNextMove',
  ],
});
