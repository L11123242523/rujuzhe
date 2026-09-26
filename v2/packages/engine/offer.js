/**
 * 入局者 v2 · 候选生成（"谁能在这个窗口里发动"）
 * ---------------------------------------------------------------------------
 * 旧引擎靠**卡名/文本 `indexOf`** 判连锁种类（`RJEngine.classifyChainCard`：
 * `name.indexOf('遥控骰子') >= 0 || eff.indexOf('修改骰子点数') >= 0` …），因此
 * 卡面改一个字就会掉出分类，且形态串味（"枫" vs "枫(水舞)"）。
 *
 * 新引擎**从编译好的 ops 判定**（数据驱动，D1/D7）：`change_direction` → 反向、
 * `modify_dice` → 改点、`interrupt_move` → 改位移… 卡面文本改了会重新编译，分类跟着走。
 * 保留一条**显式覆盖**通道（`fields.chainKind`），给"编译不出 ops 但确有连锁语义"的卡用
 * （实例：【崩塌之乌托邦】反制整效 —— 旧引擎靠 SPECIAL 硬编）。
 */

import { RULES } from './rules/constants.js';
import { quoteCost } from './rules/cost.js';
import { canPlayCardInPhase } from './phases.js';
import { chainKindOverride, nameMatches } from './abilities.js';
import { ringMinDist } from './rules/map.js';
import { parseAttackRange, canReachByRange, attackNeedsEnemy } from './rules/range.js';

export const CHAIN_KINDS = Object.freeze(['dice_set', 'reverse', 'move_adjust', 'stop_move', 'reroll_judge', 'negate_damage', 'negate_effect']);
export const WINDOW_KINDS = Object.freeze(['simultaneous', 'effect_activate', 'dice_result', 'move', 'damage', 'rand']);

/** op → 连锁种类（按优先级排列：越靠前越"专项"） */
const OP_TO_KIND = [
  ['change_direction', 'reverse'],
  ['reroll_judge', 'reroll_judge'],
  ['modify_dice', 'dice_set'],
  ['set_dice_sides', 'dice_set'],
  ['interrupt_move', 'move_adjust'],
  ['adjust_next_move', 'move_adjust'],
  ['adjust_next_move_all', 'move_adjust'],
  ['prevent_next_damage', 'negate_damage'],
];

/** 递归取出一张卡编译出的全部 op 名 */
export function opsOf(card) {
  const out = [];
  const walk = (arr) => {
    for (const o of arr || []) {
      if (!o || !o.op) continue;
      out.push(o);
      if (o.branches) o.branches.forEach(walk);
      walk(o.inner);
      walk(o.thenOps);
      walk(o.elseOps);
    }
  };
  const ops = card?.ops;
  if (ops) { (ops.main || []).forEach((s) => walk(s.ops)); (ops.sp || []).forEach((s) => walk(s.ops)); }
  return out;
}

/** 一张卡的连锁种类（数据驱动；显式覆盖优先） */
export function chainKindOf(card) {
  const explicit = card?.chainKind || card?.fields?.chainKind;
  if (explicit) return explicit;
  // 内容声明里的覆盖（content/abilities.json：如【崩塌之乌托邦】的反制整效）
  const declared = card?.name ? chainKindOverride(card.name) : null;
  if (declared) return declared;
  const ops = opsOf(card);
  for (const [opName, kind] of OP_TO_KIND) if (ops.some((o) => o.op === opName)) return kind;
  if (ops.some((o) => o.op === 'register_mechanic' && o.kind === 'stop_all_move')) return 'stop_move';
  return null;
}

/** 窗口类型 × 连锁种类的许可矩阵（旧 `RJEngine.chainableAt` 的数据版，逐条对齐） */
export function chainableAt(windowKind, chainKind) {
  switch (windowKind) {
    case 'dice_result': return chainKind === 'dice_set' || chainKind === 'reverse' || chainKind === 'reroll_judge';
    case 'move': return chainKind === 'reverse' || chainKind === 'move_adjust' || chainKind === 'stop_move';
    case 'damage': return chainKind === 'negate_damage';
    case 'rand': return chainKind === 'dice_set' || chainKind === 'reroll_judge';
    case 'effect_activate': return chainKind === 'negate_effect';
    case 'simultaneous': return true;      // 同时诱发：必发/选发都可入链（§13.3）
    default: return false;
  }
}

/**
 * 射程规格：优先用**权威解析器**（`rules/range.js`，逐字移植自旧引擎 `parseAttackRange`），
 * 它认 `moveThenAround` / `forwardBack` / `pathBack` / `movetorow` 等旧引擎已有的范围种类；
 * ops 里附带的 `{dir,range}` 只是执行侧的粗略标注，不能当合法性判据
 * （【钢筋铁肘】就是被它误判成"前后 3 格"而拒绝出牌的）。
 */
export function rangeSpecOf(card) {
  if (card && (card.attack_range || (card.fields && card.fields.attack_range))) {
    return parseAttackRange(card.attack_range || card.fields.attack_range);
  }
  for (const o of opsOf(card)) if (o.range || o.aoe) return o.range || o.aoe;
  return null;
}

/**
 * 目标是否在射程内。按作者确认的两条口径（旧 `attackNeedsEnemy`）：
 * 特殊范围 / 非造伤卡 / 前端是移动或飞掷的 → **发动时不要求射程**。
 */
export function targetOk(state, seatId, targetId, card) {
  if (!attackNeedsEnemy(card)) return { ok: true };
  const spec = parseAttackRange(card.attack_range || (card.fields && card.fields.attack_range) || '');
  const from = state.seats[seatId]?.position ?? 0;
  const to = state.seats[targetId]?.position ?? 0;
  if (canReachByRange(spec, from, to)) return { ok: true };
  const dist = ringMinDist(from, to);
  return { ok: false, reason: `目标不在射程内（${spec.kind}${spec.n !== undefined ? spec.n : ''}，当前相距 ${dist} 格）` };
}

/**
 * 合法性（不含"有没有对象"—— 那由窗口的 `hasTarget` 提供）。
 * @param {object} opts { phase, windowKind, chainKind, targetOk, memberAllowed, ignoreCost, target, checkRange }
 */
export function legality(state, seatId, card, opts = {}) {
  const seat = state.seats[seatId];
  if (!seat) return { ok: false, reason: '未知座位' };
  const phaseOk = canPlayCardInPhase(opts.phase ?? state.phase, {
    isSkill: card._category === 'skill_cards',
    fromFaceDown: !!opts.fromFaceDown,
  });
  if (!phaseOk.ok) return phaseOk;
  if (opts.windowKind) {
    const kind = opts.chainKind ?? chainKindOf(card);
    if (!kind) return { ok: false, reason: '这张卡不在连锁响应面上（没有可响应的效果）' };
    if (!chainableAt(opts.windowKind, kind)) return { ok: false, reason: `本窗口（${opts.windowKind}）不能发动「${kind}」类卡` };
    if (opts.hasTarget === false) return { ok: false, reason: '当前窗口没有明确对象，该卡应变灰、不可发动（§13.2）' };
  }
  if (opts.memberAllowed === false) return { ok: false, reason: '队员位 SP 未写明"作为队员编组也生效"，不能发动' };
  // 技能卡的**角色绑定**（旧引擎原话："队伍未编入【现实间冬马】，不能使用其技能卡【弱点分析】
  // （同名不同形态不通用，需编入对应形态）"）：技能卡必须队中有对应角色才能出。
  // 注：攻击卡（如【清凉时间！】）没有这条限制 —— 旧引擎允许它出场（只是效果落空）
  if (card && (card._category === 'skill_cards' || card.category === 'skill_cards')) {
    const need = card.character_full || card.character;
    if (need) {
      const seat = state.seats[seatId] || {};
      const team = [seat.captain && seat.captain.name, ...(seat.teamNames || [])].filter(Boolean);
      if (!team.some((n) => nameMatches(need, n) || nameMatches(card.character, n))) {
        return { ok: false, reason: `队伍未编入【${need}】，不能使用其技能卡【${card.name}】（同名不同形态不通用，需编入对应形态）` };
      }
    }
  }
  // 射程校验（有射程数据的卡 + 指定了目标）
  if (opts.target && opts.checkRange !== false) {
    const r = targetOk(state, seatId, opts.target, card);
    if (!r.ok) return r;
  }
  if (!opts.ignoreCost) {
    const quote = quoteCost(state, seatId, card, opts);
    if (quote.value > (seat.cost || 0)) return { ok: false, reason: `音韵值不足（需 ${quote.value}，有 ${seat.cost || 0}）` };
  }
  return { ok: true };
}

/**
 * 为某个窗口生成"可发动候选"。
 * @param {object} win 窗口（含 kind 与 ctx）
 * @param {object} opts { hasTarget, sources:['hand','faceDownCards','permanent'], extraCards }
 * @returns {{candidates:Array, rejected:Array}}
 */
export function offerChain(state, seatId, win, opts = {}) {
  const seat = state.seats[seatId];
  const candidates = [];
  const rejected = [];
  const sources = opts.sources || ['hand', 'faceDownCards'];

  const consider = (card, from, index) => {
    const verdict = legality(state, seatId, card, {
      windowKind: win.kind,
      chainKind: chainKindOf(card),
      hasTarget: opts.hasTarget !== false,
      memberAllowed: opts.memberAllowed,
      fromFaceDown: from === 'faceDownCards',
    });
    if (!verdict.ok) { rejected.push({ card: card?.name ?? card, from, index, reason: verdict.reason }); return; }
    const quote = quoteCost(state, seatId, card);
    candidates.push({
      id: `${seatId}:${from}:${index}`,
      owner: seatId,
      label: card.name || String(card),
      card,
      from,
      index,
      chainKind: chainKindOf(card),
      // §12.2：盖伏卡**发动时才付费**；手牌发动即时付费
      payAtActivation: from === 'faceDownCards',
      cost: quote.value,
      mandatory: false,
      meta: { from },
    });
  };

  for (const source of sources) {
    const zone = seat[source] || [];
    zone.forEach((card, index) => consider(card, source, index));
  }
  for (const extra of opts.extraCards || []) consider(extra.card, extra.from || 'hand', extra.index ?? -1);

  return { candidates, rejected };
}

export { RULES };
