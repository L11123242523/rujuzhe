/**
 * 入局者 v2 · 资源（规则书 §2.5 / §5 / §11 + §10 牌组重置）
 * ---------------------------------------------------------------------------
 * 与旧引擎对应实现行为等价：
 *   · 牌组重置 = `__refillDeckIfEmpty`（game.html:9329-9340）：墓地整体按序翻面为新牌组、**不洗切**、墓地清空
 *   · 抽卡     = `takeTopCard`（9342-9356）：牌顶 = deck[0]；抽完最后一张即补
 *   · 献祭     = §11.1 每回合 1 次、送 1 手牌回 2 音韵
 */

import { RULES } from './constants.js';

/** 队伍同步值 = ⌊Σ 角色同步值 × 2.5⌋ 向上取整（§5.1） */
export function syncFromCharacters(chars) {
  const sum = (chars || []).reduce((a, c) => a + (Number(c?.sync) || 0), 0);
  return Math.ceil(sum * RULES.sync.multiplier);
}

export function maxCost() { return RULES.cost.max; }

/**
 * 自然回复（§5.2）：基础 5；`multiplier` 传卡面带来的倍率（如葵/枫(水着) 的 +50% 向下取整）。
 * 注意"每名成员各 +50%"的口径由调用方把倍率算好传入（卡面差异属 P4）。
 */
export function regenAmount(multiplier = 1) {
  return Math.floor(RULES.cost.baseRegen * multiplier);
}

/** 回复音韵值，受上限约束；返回实际回复量（§5.2） */
export function gainCost(seat, amount) {
  const before = seat.cost || 0;
  seat.cost = Math.min(before + (amount || 0), seat.maxCost || RULES.cost.max);
  return seat.cost - before;
}

/** 支付音韵值；不足则拒绝（返回 ok:false，不改状态） */
export function payCost(seat, amount) {
  if (!(amount >= 0)) return { ok: false, reason: '费用非法：' + amount };
  if ((seat.cost || 0) < amount) return { ok: false, reason: '音韵值不足（需 ' + amount + '，有 ' + (seat.cost || 0) + '）' };
  seat.cost -= amount;
  return { ok: true, paid: amount };
}

/** 牌组一空就立即把墓地整体翻面为新牌组（§2.6/§10.5；不洗切） */
export function refillDeckIfEmpty(seat) {
  if (seat.deck && seat.deck.length > 0) return null;
  if (!seat.grave || seat.grave.length === 0) return null;
  const n = seat.grave.length;
  seat.deck = seat.grave.splice(0, n);
  return { type: 'deckRefilled', count: n };
}

/** 从牌顶抽一张（牌顶 = deck[0]）；牌组与墓地皆空返回 null */
export function takeTopCard(seat) {
  if (!seat.deck || seat.deck.length === 0) refillDeckIfEmpty(seat);
  if (!seat.deck || seat.deck.length === 0) return null;
  const card = seat.deck.shift();
  const events = [];
  const refill = refillDeckIfEmpty(seat); // §2.6：牌组剩余为 0 就立即补，不等时点
  if (refill) events.push(refill);
  return { card, events };
}

/** 音韵抽卡（§5.3）：自己回合内支付 3 点抽 1 张，每回合不限次数 */
export function drawByCost(seat) {
  const paid = payCost(seat, RULES.cost.drawByCost);
  if (!paid.ok) return { ok: false, reason: paid.reason, events: [] };
  const drawn = takeTopCard(seat);
  if (!drawn) {
    gainCost(seat, RULES.cost.drawByCost); // 无卡可抽：退回费用，不吞资源
    return { ok: false, reason: '牌组与墓地均已空，无卡可抽', events: [] };
  }
  seat.hand.push(drawn.card);
  seat.counters.costDraws = (seat.counters.costDraws || 0) + 1;
  return { ok: true, card: drawn.card, events: [{ type: 'drawByCost', card: drawn.card }].concat(drawn.events) };
}

/** 送一张手牌入墓（牌组/墓地顺序承载"墓地最上方 = 最近进墓"的语义：push 到末尾） */
export function toGrave(seat, card, reason) {
  seat.grave.push(card);
  return { type: 'toGrave', card, reason: reason || 'effect' };
}

/**
 * 献祭（§11.1）：每回合 1 次，把 1 张手牌送入墓地，回复 2 点音韵。
 * §11.2.1：献祭**不算**"因效果送墓"，不触发效果送墓类时点（故 reason 单独标 'sacrifice'）。
 */
export function sacrifice(seat, handIndex) {
  if ((seat.counters.sacrificeUsed || 0) >= RULES.sacrifice.perTurn) {
    return { ok: false, reason: '本回合已经献祭过了', events: [] };
  }
  const card = seat.hand[handIndex];
  if (!card) return { ok: false, reason: '手牌位置非法：' + handIndex, events: [] };
  seat.hand.splice(handIndex, 1);
  const ev = toGrave(seat, card, 'sacrifice');
  const healed = gainCost(seat, RULES.sacrifice.regain);
  seat.counters.sacrificeUsed = (seat.counters.sacrificeUsed || 0) + 1;
  return { ok: true, card, healed, events: [ev, { type: 'sacrifice', regained: healed }] };
}

/** 金币收支（允许负数表示支出；不会低于 0，调用方负责判断是否付得起） */
export function gainGold(seat, amount) {
  const before = seat.gold || 0;
  seat.gold = Math.max(0, before + (amount || 0));
  return seat.gold - before;
}

/** 手牌上限截断（§2.5 上限 5）：返回需要弃掉的数量（不替玩家选择，§10.3 禁止随机替代） */
export function discardToLimit(seat) {
  const over = (seat.hand.length || 0) - RULES.deck.handLimit;
  return over > 0 ? over : 0;
}
