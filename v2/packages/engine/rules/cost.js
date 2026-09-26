/**
 * 入局者 v2 · 费用（"最终费用"的唯一真源）
 * ---------------------------------------------------------------------------
 * 这一层直接对着旧引擎最贵的一条病（《重做方案.md》D5，`状态字段清单.md` P3-1(c)）：
 * 旧 `computeActualCost(card, user)`（game.html:22100-22133）**会修改状态** ——
 * 它一边算钱一边消耗 `card._aoiDiscountUsed`、把 `p._nextCostReduction` 归零。
 * 于是"凡是在真正付款之外还有一次调用，就会白烧一次减费"，这正是
 * `联机失步排查记录.md` 里那条**至今未修**的"两端可见状态一致、某一方音韵值差 1"。
 *
 * 新引擎把两件事彻底分开：
 *   · `quoteCost()`  —— **纯函数**：问"现在要付多少"，不改任何状态，可随便调（UI 高亮、AI 估价、校验）
 *   · `payCardCost()` —— **唯一落账点**：报价 → 消耗一次性减免 → 扣音韵 → 记录实际支付额
 * 减费来源全部是**数据**（`costModifiers()` 返回数组），不再散落在函数体里。
 */

import { RULES } from './constants.js';
import { payCost } from './resources.js';

/** 费用数值化（旧引擎口径：`"1+"` 取 1；区间费用 `"1-10"` 使用时不扣，支付在效果内完成） */
export function baseCostOf(card) {
  if (!card) return 0;
  const raw = card.cost;
  if (typeof raw === 'string' && /^\s*\d+\s*[-–~至到]\s*\d+\s*$/.test(raw)) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * 减费来源（数据化）。每条：{ id, delta, consume?(seat, card) }
 * `consume` 只由 `payCardCost()` 调用 —— 这是"报价纯、落账唯一"的关键。
 */
export function costModifiers(state, seatId, card, opts = {}) {
  const seat = state.seats[seatId];
  const mods = [];
  // 1) 等级费用缩放（COST 随等级降低）
  if (card && card.lv && /lv/i.test(String(card.lv)) && typeof opts.lvCost === 'function') {
    const lv = opts.lvCost(card, seat.level || 1);
    if (lv != null) mods.push({ id: 'lvCost', delta: lv - baseCostOf(card), note: 'Lv' + seat.level + ' 费用缩放' });
  }
  // 2) 费用随使用次数增加（幸运护符/怪怪幽灵吊坠）
  if (card && /费用随使用次数增加|每用一次\+1/.test((card.sp || '') + (card.effect || ''))) {
    mods.push({ id: 'escalate', delta: card._escalateCount || 0 });
  }
  // 3) 小野葵被动：整副牌组每张的"首次使用"费用 −1（一次性 —— 报价时**只看标记**，落账时才消费）
  if (seat.flags.aoiPassive && card && (card._isCarry || card._fromDeck) && !card._aoiDiscountUsed) {
    mods.push({
      id: 'aoiFirstUse',
      delta: -1,
      note: '小野葵被动：携带卡首次使用 −1',
      consume: () => { card._aoiDiscountUsed = true; },
    });
  }
  // 4) 宁雨清SP：因效果加入手卡的卡 −1
  if (seat.flags.ningSP && card && card._addedByEffect) mods.push({ id: 'ningSP', delta: -1, note: '宁雨清SP：因效果加入手卡 −1' });
  // 5) 钢笔：攻击卡/技能卡 −1
  if ((seat.permanent || []).some((c) => c && typeof c.name === 'string' && c.name.includes('钢笔'))
      && card && (card._category === 'attack_cards' || card._category === 'skill_cards')) {
    mods.push({ id: 'pen', delta: -1, note: '钢笔：攻击/技能卡 −1' });
  }
  // 6) next_cost_down（"下次费用 −N"；旧引擎是 `_nextCostReduction`，且**报价时就归零**）
  const ncd = seat.counters.nextCostDown || 0;
  if (ncd > 0) {
    mods.push({
      id: 'nextCostDown',
      delta: -ncd,
      note: '减费效果 −' + ncd,
      consume: (s) => { s.counters.nextCostDown = 0; },
    });
  }
  return mods;
}

/**
 * 报价（纯函数，可任意次调用）。返回 { base, value, steps }。
 * 语义与旧 `computeActualCost` 对齐：所有减免按顺序叠加，最终不小于 0。
 */
export function quoteCost(state, seatId, card, opts = {}) {
  const base = baseCostOf(card);
  let value = base;
  const steps = [];
  for (const m of costModifiers(state, seatId, card, opts)) {
    const before = value;
    value = Math.max(0, value + m.delta);
    if (value !== before) steps.push({ id: m.id, delta: value - before, note: m.note });
  }
  return { base, value, steps };
}

/**
 * 落账（唯一）：报价 → 消耗一次性减免 → 扣音韵 → 记录实际支付额。
 * @returns {{ok:boolean, paid?:number, value?:number, steps?:Array, reason?:string}}
 */
export function payCardCost(state, seatId, card, opts = {}) {
  const seat = state.seats[seatId];
  const mods = costModifiers(state, seatId, card, opts);
  const quote = quoteCost(state, seatId, card, opts);
  if ((seat.cost || 0) < quote.value) {
    return { ok: false, reason: `音韵值不足（需 ${quote.value}，有 ${seat.cost || 0}）` };
  }
  const paid = payCost(seat, quote.value);
  if (!paid.ok) return { ok: false, reason: paid.reason };
  // 一次性减免在**真正付款成功后**才消耗（旧引擎在报价时消耗，是"白烧减费"的根因）
  for (const m of mods) if (typeof m.consume === 'function') m.consume(seat, card);
  seat.counters.lastPaidCost = quote.value;
  return { ok: true, paid: quote.value, value: quote.value, steps: quote.steps };
}

/** 献祭/回收等"非卡面费用"的展示口径（规则书 §11.1） */
export function sacrificeRegain() { return RULES.sacrifice.regain; }
