/**
 * 入局者 v2 · ops 解释器（唯一的效果执行路径）
 * ---------------------------------------------------------------------------
 * 输入是**构建期编译好的数据**（`content/cards/*.json` 的 `ops`），运行时**不解析中文**。
 * 与旧引擎的根本区别（《重做方案.md》D1）：
 *   · 旧引擎编译失败会静默回退到 `processSingleEffect` 文本正则引擎（`game.html:18022`）——
 *     同一张卡可能走两套语义，且没有任何测试知道走的哪套；
 *   · 新引擎**只有这一条路**：没实现的 op 会**抛错点名**，并且必须登记在 `DECLARED_GAPS` 里
 *     （门禁会检查"卡里用到的 op 必须已实现或已登记"）。
 *
 * 决策：需要人选择的地方产出**可序列化的 decision 对象**，交给 `ctx.answer(decision)` 取答案。
 * 没有 answer 源时**抛错**（不猜、不默认、不随机 —— 规则书 §10.3 禁止随机替代玩家选择）。
 * 正式窗口/断点续跑在 P3（TimingWindow）里接管。
 */

import { RULES } from '../rules/constants.js';
import { gainCost, payCost, takeTopCard, gainGold, refillDeckIfEmpty } from '../rules/resources.js';
import { resolveTile, drawGift } from '../rules/tiles.js';
import { computeDamage } from '../rules/damage.js';
import { gainMotivation } from '../rules/levels.js';
import { moveSeat, wrap, TILE_COUNT, LAYOUT, isInteractive } from '../rules/map.js';
import { beats, kindOf } from '../rules/attributes.js';
import { collectModifiers } from '../abilities.js';
import { movePassiveEffects, motivationBonus } from '../abilities.js';
import {
  afterRollEffects, diceChoiceOptions, drawTwoBonus, sanityFollowUp,
  consumeNextDamagePlus, secondRollGiftOffer,
} from '../abilities.js';
import { inRange } from '../rules/map.js';

// ── 注册表 ────────────────────────────────────────────────────────────────
export const OPS = new Map();
export const DECLARED_GAPS = new Map();

function op(name, fn) { OPS.set(name, fn); }
/** 登记"尚未实现"的 op：必须写明理由与计划阶段，门禁才放行 */
function gap(name, reason, phase = 'P2b') { DECLARED_GAPS.set(name, { reason, phase }); }

class PendingDecision extends Error {
  constructor(decision) { super('需要决策：' + decision.kind); this.decision = decision; }
}

// ── 执行器 ────────────────────────────────────────────────────────────────
/**
 * @param {object} state
 * @param {object} ctx  { seat, target, card, source, rng, answer?(decision) }
 * @param {Array} ops  编译好的 op 数组
 * @returns {{events:Array, pending:object|null}}
 */
export function executeOps(state, ctx, ops) {
  const events = [];
  const api = {
    emit(e) { events.push(e); return e; },
    seat(id) { return state.seats[id ?? ctx.seat]; },
    run(inner) { const r = executeOps(state, ctx, inner || []); events.push(...r.events); if (r.pending) throw new PendingDecision(r.pending); },
    ask(decision) {
      if (typeof ctx.answer !== 'function') throw new PendingDecision(decision);
      const a = ctx.answer(decision);
      if (a === undefined) throw new PendingDecision(decision);
      return a;
    },
    damage(target, amount, opts = {}) {
      // 常驻修正来自**内容声明**（content/abilities.json），不再靠卡名 indexOf（旧引擎那种写法）
      const contentMods = collectModifiers(state, ctx.seat, { card: ctx.card, judge: !!opts.judge });
      const armed = computeDamage({
        base: amount,
        attackPower: (opts.attackPower ?? 0),
        defense: (state.seats[target].defense || 0),
        attackerAttr: opts.attr ?? null,
        defenderAttr: state.seats[target].teamAttribute ?? null,
        judge: !!opts.judge,
        selfInflicted: target === ctx.seat,
        modifiers: [...(opts.modifiers || []), ...contentMods],
        crit: opts.crit,
      });
      const seat = state.seats[target];
      let value = armed.value;
      const prevented = seat.counters.preventDamage || 0;
      if (prevented > 0) {
        const used = Math.min(prevented, value);
        value -= used;
        seat.counters.preventDamage = prevented - used;
        events.push({ type: 'damagePrevented', target, amount: used });
      }
      const shielded = Math.min(seat.shield || 0, value);
      if (shielded > 0) { seat.shield -= shielded; value -= shielded; }
      if (value > 0) seat.sync = Math.max(0, (seat.sync || 0) - value);
      events.push({ type: 'damage', target, amount: armed.value, dealt: value, shielded, judge: !!opts.judge, core: armed.core, steps: armed.steps });
      if ((seat.sync || 0) <= 0) events.push({ type: 'defeated', seat: target });
      return armed.value;
    },
  };

  try {
    for (const o of ops || []) {
      if (!o || !o.op) continue;
      const fn = OPS.get(o.op);
      if (fn) { fn(state, ctx, o, api); continue; }
      const declared = DECLARED_GAPS.get(o.op);
      throw new Error('[engine.ops] 未实现的 op "' + o.op + '"'
        + (declared ? `（已登记：${declared.reason}；计划 ${declared.phase}）` : '（**未登记** —— 必须实现或写进 DECLARED_GAPS）'));
    }
  } catch (e) {
    if (e instanceof PendingDecision) return { events, pending: e.decision };
    throw e;
  }
  return { events, pending: null };
}

/**
 * 把"玩家的选择"解释成候选对象。接受三种写法（都来自真实调用方）：
 *   · 候选对象 {card, zone, index}
 *   · 下标数字（AI 桩、简化 UI）
 *   · 上面两者的数组
 * 早期实现只认第一种，AI 桩给下标时会在 `p.index` 上抛错 —— 而窗口的"异常只跳当前节点"
 * 会把它吞成"效果不适用"，表现成**静默跳过**（被逐卡对拍抓到）。
 */
function pickFromPool(pool, answer, need = 1) {
  const arr = Array.isArray(answer) ? answer : [answer];
  const out = [];
  for (const x of arr) {
    if (x === undefined || x === null) continue;
    const hit = (x && typeof x === 'object' && x.card) ? x : pool[typeof x === 'number' ? x : Number(x)];
    if (hit && hit.card) out.push(hit);
    if (out.length >= need) break;
  }
  return out;
}

/** 这张卡 SP 里的固定伤害值（无护盾时的"固定造成 N 点"），没有则 null */
function spFixedDamage(card) {
  const walk = (arr) => {
    for (const o of arr || []) {
      if (!o) continue;
      if (o.op === 'damage' && typeof o.base === 'number') return o.base;
      const nested = walk(o.thenOps) ?? walk(o.elseOps) ?? walk(o.inner);
      if (nested != null) return nested;
    }
    return null;
  };
  for (const step of (card && card.ops && card.ops.sp) || []) {
    const v = walk(step.ops);
    if (v != null) return v;
  }
  return null;
}

// ── 资源 / 同步值 ─────────────────────────────────────────────────────────
op('gain_cost', (s, c, o, a) => { const n = gainCost(a.seat(), o.amount || 0); a.emit({ type: 'gainCost', seat: c.seat, amount: n }); });
op('lose_cost', (s, c, o, a) => {
  const seat = a.seat(); const before = seat.cost || 0;
  seat.cost = Math.max(0, before - (o.amount || 0));
  a.emit({ type: 'loseCost', seat: c.seat, amount: before - seat.cost });
});
op('heal_sync', (s, c, o, a) => {
  const seat = a.seat(); const before = seat.sync || 0;
  seat.sync = Math.min((seat.maxSync || before) , before + (o.amount || 0));
  a.emit({ type: 'healSync', seat: c.seat, amount: seat.sync - before });
});
op('loss_sync', (s, c, o, a) => {
  const who = o.targetWho === 'self' ? c.seat : (c.target || c.seat);
  const seat = a.seat(who); const before = seat.sync || 0;
  seat.sync = Math.max(0, before - (o.amount || 0));
  a.emit({ type: 'lossSync', seat: who, amount: before - seat.sync });
  if (seat.sync <= 0) a.emit({ type: 'defeated', seat: who });
});
op('self_alt_sync', (s, c, o, a) => {
  // 卡面（镇定药片）："**回/扣**自身2同步，**扣同步的场合此卡不耗音韵**" ⇒ 两者可选，且**先列的是"回"**。
  // 我原来无条件扣（旧引擎是回 +2），单向实现把这张卡的语义写反了。
  const seat = a.seat();
  const amount = o.amount || 2;
  const picked = a.ask({ kind: 'choice', seat: c.seat, options: ['回复' + amount + '同步值', '扣除' + amount + '同步值（此卡不耗音韵）'], title: '回复还是扣除', reason: '回/扣自身同步值' });
  const idx = Number(Array.isArray(picked) ? picked[0] : picked) || 0;
  const before = seat.sync || 0;
  if (idx === 0) {
    seat.sync = Math.min(seat.maxSync || 999, before + amount);
    a.emit({ type: 'healSync', seat: c.seat, amount: seat.sync - before });
  } else {
    seat.sync = Math.max(0, before - amount);
    a.emit({ type: 'selfAltSync', seat: c.seat, amount: before - seat.sync, freeOfCost: true });
  }
});
op('gain_gold', (s, c, o, a) => { const seat = a.seat(); seat.gold = (seat.gold || 0) + (o.amount || 0); a.emit({ type: 'gainGold', seat: c.seat, amount: o.amount || 0 }); });
op('gain_shield', (s, c, o, a) => { const seat = a.seat(); seat.shield = (seat.shield || 0) + (o.amount || 0); a.emit({ type: 'gainShield', seat: c.seat, amount: o.amount || 0 }); });
op('break_shield', (s, c, o, a) => {
  // 卡面语义（旧引擎 17501-17513）：**造成"足以击碎其当前护盾"的伤害**，不是"把护盾减掉"。
  // 没有护盾时按 0 点（"无护盾固定造成 N 点"是部分卡的 SP 条款，见卡面声明）。
  const who = o.targetWho === 'self' ? c.seat : (c.target || c.seat);
  const seat = a.seat(who);
  const shield = seat.shield || 0;
  const atkPower = (a.seat().attackBuff || 0) + (a.seat().counters.tempAttack || 0);
  if (shield > 0) {
    a.emit({ type: 'breakShield', seat: who, shield });
    a.damage(who, shield, { attackPower: atkPower, attr: o.attr || (c.card && c.card.attribute) || null });
    return;
  }
  // 没有护盾时用**这张卡 SP 里编译好的固定伤害**（如【该结束了！】SP"对没有护盾的单位固定造成5点"）——
  // 旧引擎靠正则读卡面文本，新引擎直接读它自己的 SP ops（数据驱动，不再解析中文）
  const fixed = spFixedDamage(c.card);
  if (fixed != null) {
    a.emit({ type: 'breakShieldNoShield', seat: who, fixedDamage: fixed });
    a.damage(who, fixed, { attackPower: atkPower, attr: o.attr || (c.card && c.card.attribute) || null });
    return;
  }
  a.emit({ type: 'breakShieldNoShield', seat: who, fixedDamage: 0, note: '目标没有护盾，且该卡无"无护盾固定伤害"条款' });
});
op('gain_motivation', (s, c, o, a) => {
  const seat = a.seat();
  const extra = motivationBonus(s, c.seat);              // 里尔亚斯被动：额外 +1
  const total = (o.amount || o.n || 0) + extra;
  const ev = gainMotivation(seat, total);
  ev.forEach((e) => a.emit(e));
  a.emit({ type: 'gainMotivation', seat: c.seat, amount: total, bonus: extra });
});
op('gain_core', (s, c, o, a) => { const seat = a.seat(); seat.counters.guideCore = (seat.counters.guideCore || 0) + (o.n || o.amount || 1); a.emit({ type: 'gainCore', seat: c.seat, amount: o.n || o.amount || 1 }); });
op('regen_sync', (s, c, o, a) => { const seat = a.seat(); seat.counters.regenBonus = (seat.counters.regenBonus || 0) + (o.amount || 1); a.emit({ type: 'regenBonus', seat: c.seat, amount: o.amount || 1 }); });
op('reduce_fascination', (s, c, o, a) => { const seat = a.seat(); const before = seat.fascination || 0; seat.fascination = Math.max(0, before - (o.amount || 1)); a.emit({ type: 'reduceFascination', seat: c.seat, amount: before - seat.fascination }); });

// ── 增益 / 减益 ───────────────────────────────────────────────────────────
op('attack_buff', (s, c, o, a) => { const seat = a.seat(); seat.attackBuff = (seat.attackBuff || 0) + (o.amount || 0); a.emit({ type: 'attackBuff', seat: c.seat, amount: o.amount || 0 }); });
op('attack_buff_temp', (s, c, o, a) => { const seat = a.seat(); seat.counters.tempAttack = (seat.counters.tempAttack || 0) + (o.amount || 0); a.emit({ type: 'attackBuffTemp', seat: c.seat, amount: o.amount || 0 }); });
op('def_up', (s, c, o, a) => { const seat = a.seat(); seat.defenseBase = (seat.defenseBase || 0) + (o.amount || 0); seat.defense = (seat.defense || 0) + (o.amount || 0); a.emit({ type: 'defUp', seat: c.seat, amount: o.amount || 0 }); });
op('def_down', (s, c, o, a) => {
  const who = o.targetWho === 'self' ? c.seat : (c.target || c.seat);
  const seat = a.seat(who);
  seat.defense = (seat.defense || 0) - (o.amount || 0);
  a.emit({ type: 'defDown', seat: who, amount: o.amount || 0, actions: o.actions || 2 });
});
op('apply_status', (s, c, o, a) => { const seat = a.seat(); const key = o.status || o.statusName || o.name; seat.statuses[key] = (seat.statuses[key] || 0) + (o.value ?? o.amount ?? 1); a.emit({ type: 'applyStatus', seat: c.seat, status: key, value: seat.statuses[key] }); });
op('cleanse', (s, c, o, a) => { const seat = a.seat(); const keys = o.status ? [o.status] : Object.keys(seat.statuses); keys.forEach((k) => delete seat.statuses[k]); a.emit({ type: 'cleanse', seat: c.seat, statuses: keys }); });
op('prevent_next_damage', (s, c, o, a) => { const seat = a.seat(); seat.counters.preventDamage = (seat.counters.preventDamage || 0) + (o.amount || 1); a.emit({ type: 'preventNextDamage', seat: c.seat, amount: o.amount || 1 }); });
op('next_attack_pierce', (s, c, o, a) => { const seat = a.seat(); seat.counters.nextAttackPierce = (seat.counters.nextAttackPierce || 0) + (o.n || o.amount || 1); a.emit({ type: 'nextAttackPierce', seat: c.seat }); });
op('next_cost_down', (s, c, o, a) => { const seat = a.seat(); seat.counters.nextCostDown = (seat.counters.nextCostDown || 0) + (o.amount || 1); a.emit({ type: 'nextCostDown', seat: c.seat, amount: o.amount || 1 }); });
op('buff_next_judge', (s, c, o, a) => { const seat = a.seat(); seat.counters.nextJudgeBonus = (seat.counters.nextJudgeBonus || 0) + (o.amount || 1); a.emit({ type: 'buffNextJudge', seat: c.seat, amount: o.amount || 1 }); });
op('add_roll_phase', (s, c, o, a) => { s.mechanics.extraRollPhase = true; a.emit({ type: 'addRollPhase', seat: c.seat }); });

// ── 抽卡 / 区域 ───────────────────────────────────────────────────────────
op('draw', (s, c, o, a) => {
  const seat = a.seat();
  const n = o.n || o.amount || 1;
  for (let i = 0; i < n; i++) {
    const r = takeTopCard(seat);
    if (!r) { a.emit({ type: 'drawFailed', seat: c.seat, reason: '牌组与墓地皆空' }); break; }
    seat.hand.push(r.card);
    a.emit({ type: 'draw', seat: c.seat, card: r.card });
    r.events.forEach((e) => a.emit(e));
  }
  // 【小野伊织】"一次性抽取两张卡的场合可以发动，抽一张并回复自身1点音韵值"
  const bonus = drawTwoBonus(s, c.seat, n);
  if (bonus) {
    a.emit({ type: 'drawTwoBonus', seat: c.seat, id: bonus.id });
    for (let i = 0; i < (bonus.draw || 1); i++) {
      const r = takeTopCard(seat);
      if (!r) break;
      seat.hand.push(r.card);
      a.emit({ type: 'draw', seat: c.seat, card: r.card, reason: bonus.id });
    }
    if (bonus.gainCost) {
      const got = gainCost(seat, bonus.gainCost);
      a.emit({ type: 'gainCost', seat: c.seat, amount: got, reason: bonus.id });
    }
  }
});
op('draw_gift', (s, c, o, a) => {
  // 真抽卡 + 真结算（**这里以前是个只发事件的存根**：编译通过、覆盖率为"已实现"，
  // 但什么都不做 —— 【共鸣者】因此在逐卡对拍里毫无反应）。
  // 馈赠卡池的过滤（如【共鸣者】"卡池中不会出现[200$]"）来自角色/卡的能力声明。
  const n = o.n || 1;
  for (let i = 0; i < n; i++) {
    const r = drawGift(s, c.seat, c.rng, { rng: c.rng, answer: c.answer });
    if (!r) { a.emit({ type: 'giftEmpty', seat: c.seat }); break; }
    for (const e of r.events) a.emit(e);
  }
});
op('discard', (s, c, o, a) => {
  const seat = a.seat();
  const n = o.n || o.amount || 1;
  if (!seat.hand.length) return;
  const picked = a.ask({ kind: 'pickCards', seat: c.seat, from: 'hand', need: n, allowLess: false, reason: o.reason || '弃牌' });
  const idxs = Array.isArray(picked) ? picked : [picked];
  const cards = [];
  idxs.sort((x, y) => y - x).forEach((i) => { const card = seat.hand.splice(i, 1)[0]; if (card) { seat.grave.push(card); cards.push(card); } });
  a.emit({ type: 'discard', seat: c.seat, cards });
});
op('sacrifice_now', (s, c, o, a) => {
  const seat = a.seat();
  // §11.1「每回合 1 次献祭」+【松山惠】乐曲δ"本回合献祭次数+1" ⇒ 上限 = 1 + sacrificeBonus
  const limit = 1 + (seat.counters.sacrificeBonus || 0);
  const used = seat.counters.sacrificeUsed || 0;
  if (used >= limit) {
    a.emit({ type: 'sacrificeRefused', seat: c.seat, used, limit, note: '本回合献祭次数已用完' });
    return;
  }
  if (!seat.hand.length) return;
  const picked = a.ask({ kind: 'pickCards', seat: c.seat, from: 'hand', need: o.n || 1, allowLess: true, reason: '献祭' });
  const idxs = Array.isArray(picked) ? picked : [picked];
  const cards = [];
  idxs.sort((x, y) => y - x).forEach((i) => {
    const card = seat.hand.splice(i, 1)[0];
    if (!card) return;
    // 卡面【巧匠之手】"被献祭的那张卡不去墓地而是移出游戏" ⇒ `toRemoved`
    if (o.toRemoved) seat.removed.push(card); else seat.grave.push(card);
    cards.push(card);
  });
  if (cards.length) seat.counters.sacrificeUsed = used + cards.length;
  a.emit({ type: 'sacrificeNow', seat: c.seat, cards });
  // 卡面【松山惠】乐曲β"且那次献祭回复的音韵值+2" ⇒ `costBack`
  if (o.costBack) {
    const got = gainCost(seat, o.costBack);
    a.emit({ type: 'gainCost', seat: c.seat, amount: got, reason: 'sacrificeCostBack' });
  }
});
op('search', (s, c, o, a) => {
  // 旧引擎 17760-17772 的口径：`who:'target'` 搜的是**目标**的区域；加入手卡要标 `_addedByEffect`
  // （宁雨清SP 的"因效果加入手卡 −1 费"读的就是这个标记）；放回牌组要洗切
  const ownerId = o.who === 'target' ? (c.target || c.seat) : c.seat;
  const seat = a.seat(ownerId);
  const zones = (o.sources && o.sources.length ? o.sources : ['deck']);
  if (zones.includes('deck')) refillDeckIfEmpty(seat);
  const cats = o.cats || [];
  const tags = o.tags || [];
  const matches = (card) => {
    if (!card) return false;
    if (cats.length && !cats.includes(card._category)) return false;
    if (tags.length) {
      const have = [...(card.tags || []), card.type || '', card.attribute || '', ...(card.archetypes || [])].map(String);
      if (!tags.some((t) => have.some((v) => v.includes(t)))) return false;
    }
    if (o.excludeAttr && card.attribute === o.excludeAttr) return false;
    if (o.excludeSelf && card === c.card) return false;
    return true;
  };
  const pool = zones.flatMap((z) => (seat[z] || []).map((card, index) => ({ card, zone: z, index }))).filter((p) => matches(p.card));
  if (!pool.length) { a.emit({ type: 'searchEmpty', seat: ownerId, zones }); return; }
  const picked = a.ask({ kind: 'pickList', seat: c.seat, need: o.need || 1, allowLess: !!o.allowLess, candidates: pool, reason: '选择' + (o.need || 1) + '张卡' + (o.to === 'deck' ? '放回牌组' : '加入手卡') });
  const wants = pickFromPool(pool, picked, o.need || 1);
  // 答案源给少了就**按池内顺序补齐**到 `need` 张（旧引擎自己就是这么做的：
  // 宁雨清"不足 5 张时，用剩下的按原顺序补齐到 5 张"，game.html:19678）。
  // 不补齐的话，"一次选 2 张"的检索（如【来自地狱的盒子】）在简化答案源下只会取 1 张。
  if (!o.allowLess && wants.length < (o.need || 1)) {
    for (const cand of pool) {
      if (wants.length >= (o.need || 1)) break;
      if (!wants.includes(cand)) wants.push(cand);
    }
    a.emit({ type: 'searchFilled', seat: c.seat, need: o.need || 1, got: wants.length, note: '答案源给的张数不足，按池内顺序补齐' });
  }
  const got = [];
  for (const p of wants) {   // ← 必须用**补齐后**的 wants（这里以前又重算了一遍未补齐的池，补齐等于白做）
    const arr = seat[p.zone];
    const ix = arr.indexOf(p.card);
    if (ix >= 0) arr.splice(ix, 1);
    if (o.to === 'hand' || !o.to) {
      p.card._addedByEffect = true;
      seat.hand.push(p.card);
      a.emit({ type: 'addHand', seat: ownerId, card: p.card, fromZone: p.zone });
    } else {
      seat.deck.push(p.card);
    }
    if (ownerId === c.seat) s.book.lastSearchCard = p.card;
    got.push(p.card);
  }
  if (o.to === 'deck' && c.rng) c.rng.shuffleInPlace(seat.deck);
  a.emit({ type: 'search', seat: ownerId, cards: got, to: o.to || 'hand' });
});
op('recycle_last', (s, c, o, a) => {
  // 旧引擎 17789：回收**墓地最上方**（最近送墓）那张进手牌，并标 `_addedByEffect`
  const seat = a.seat();
  const card = seat.grave.pop();
  if (!card) { a.emit({ type: 'recycleNothing', seat: c.seat }); return; }
  card._addedByEffect = true;
  seat.hand.push(card);
  a.emit({ type: 'recycleLast', seat: c.seat, card });
  a.emit({ type: 'addHand', seat: c.seat, card, fromZone: 'grave' });
});
op('return_pick_bottom', (s, c, o, a) => {
  // 区域要听 `o.zone`（【音叉】失败分支是"选 1 张**手卡**放回牌组最下方"）；
  // 以前这里把区域写死成墓地，于是手卡版本静默什么都没做
  const seat = a.seat();
  const zone = o.zone || 'grave';
  const need = o.need || 1;
  if (!(seat[zone] || []).length) { a.emit({ type: 'returnBottomNothing', seat: c.seat, zone }); return; }
  const picked = a.ask({ kind: 'pickCards', seat: c.seat, from: zone, need, allowLess: false, reason: '放回牌组最下方' });
  const arr = Array.isArray(picked) ? picked : [picked];
  for (const raw of arr.slice(0, need)) {
    const idx = Number(raw) || 0;
    const card = (seat[zone] || []).splice(idx, 1)[0];
    if (card) { seat.deck.push(card); a.emit({ type: 'returnBottom', seat: c.seat, card, zone }); }
  }
});
op('return_all_deck', (s, c, o, a) => {
  // 旧引擎 17773 的逐字口径：**墓地 / 移出区**全部返回牌组并**洗切**（不是手牌！）
  const seat = a.seat();
  const zones = ['grave', 'removed'];
  const moved = [];
  for (const z of zones) {
    if (!Array.isArray(seat[z])) continue;
    moved.push(...seat[z]);
    seat[z] = [];
  }
  seat.deck.push(...moved);
  if (c.rng && typeof c.rng.shuffleInPlace === 'function') c.rng.shuffleInPlace(seat.deck);
  a.emit({ type: 'returnAllDeck', seat: c.seat, count: moved.length });
});

// ── 伤害 ──────────────────────────────────────────────────────────────────
op('damage', (s, c, o, a) => {
  const who = o.targetWho === 'self' ? c.seat : (o.targetWho === 'target' ? (c.target || c.seat) : (o.targetWho || c.target || c.seat));
  // C17 单目标距离限定 + AOE 范围过滤（旧引擎 17414-17418）：
  // **结算时再判一次**——目标不在范围内则本次造伤不适用。
  // AOE 卡同样要判：实证【清凉时间！】"前进3格后对前方2格内所有玩家造成伤害"，
  // 移动后对手落在范围外 ⇒ 旧引擎造成 0 点伤害（我原来照打不误）。
  const rangeSpec = o.range || o.aoe;
  if (rangeSpec && who !== c.seat) {
    const from = s.seats[c.seat] ? s.seats[c.seat].position : 0;
    const to = s.seats[who] ? s.seats[who].position : 0;
    if (!inRange(from, to, rangeSpec)) {
      a.emit({
        type: 'damageOutOfRange', seat: c.seat, target: who, range: rangeSpec,
        note: '目标不在' + (rangeSpec.range === 0 ? '同一个格子' : (rangeSpec.dir === '前后' ? '前后' : rangeSpec.dir) + rangeSpec.range + '格内') + '，该造伤不适用',
      });
      return;
    }
  }
  if (o.judge) {
    // 判定伤害（旧引擎 17312-17323 逐字口径）：
    //   · 骰子判定：base = **骰点**（卡面的 base 被忽略）
    //   · 固定判定（dice:'fixed'）：base = op.base || 1（不掷骰、无波动）
    //   · 硬币判定：正面 base = op.base || 2，反面 0
    // 判定伤害照走 §8.1 括号内公式（+ 攻击力加成 − 防御），但**不吃属性克制/暴击**，吃"判定伤害 +N"。
    const isFixed = o.dice === 'fixed';
    const isCoin = o.dice === 'coin';
    const sides = (isCoin || isFixed) ? null : (Number(String(o.dice || '').replace(/\D/g, '')) || o.sides || 6);
    const roll = isFixed ? 0 : (isCoin ? (c.rng ? (c.rng.coin() ? 1 : 0) : 0) : (c.rng ? c.rng.dice(sides) : 1));
    const base = isFixed ? (o.base || 1) : (isCoin ? (roll ? (o.base || 2) : 0) : roll);
    a.emit({ type: 'judge', seat: c.seat, dice: isFixed ? 'fixed' : (isCoin ? 'coin' : 'd' + sides), roll, base });
    // 判定伤害照样走 §8.1 的括号内公式（基础 + 攻击力加成 − 防御），只是不吃克制与暴击
    const atkPower = (a.seat().attackBuff || 0) + (a.seat().counters.tempAttack || 0);
    a.damage(who, base, { judge: true, attackPower: atkPower, attr: null, modifiers: o.modifiers });
    return;
  }
  const atkPower = (a.seat().attackBuff || 0) + (a.seat().counters.tempAttack || 0);
  // 进攻属性回退链（旧引擎 computeDamageValue 的口径）：显式 > 卡牌属性 > 队伍属性
  const attr = o.attr || (c.card && c.card.attribute) || a.seat().teamAttribute || null;
  // 【琉璃(水着)／同类】"下次造成的某属性最终伤害 +N"：本次命中该属性时消费掉
  const nextPlus = attr ? consumeNextDamagePlus(s, c.seat, attr) : 0;
  if (nextPlus) a.emit({ type: 'nextDamagePlusApplied', seat: c.seat, attr, amount: nextPlus });
  a.damage(who, (o.base || 0) + nextPlus, { attackPower: atkPower, attr, modifiers: o.modifiers });
  afterDamageFollowUps(s, c, a, who, attr);
});

/**
 * 造伤之后的角色被动（重做角色）：
 *   枫(水着)：使用**理智**属性的卡造成伤害后追加 1 段 1 点理智伤害，那之后可以前进 1-3 格
 */
function afterDamageFollowUps(s, c, a, who, attr) {
  const seat = s.seats[c.seat];
  // 【入间予】热忱分支："本回合造成属性伤害后再对**相同目标**造成 1 点判定伤害"（回合级待消费标记）
  const fu = seat && seat.statuses['mech:followUpJudge'];
  if (fu && fu.turn === s.turn && attr) {
    delete seat.statuses['mech:followUpJudge'];
    a.emit({ type: 'followUpJudge', seat: c.seat, target: who, amount: fu.amount || 1 });
    a.damage(who, fu.amount || 1, { judge: true, dice: 'fixed' });
  }
  // 追加伤害**不能再触发追加**（否则自己套自己，越打越多）——用 ctx 上的标记做单次闸门
  if (c.__inFollowUp) return;
  const ctxCard = c.card || null;
  const follow = sanityFollowUp(s, c.seat, { card: ctxCard, attr });
  if (!follow) return;
  a.emit({ type: 'sanityFollowUp', seat: c.seat, id: follow.id, target: who });
  c.__inFollowUp = true;
  try {
    a.damage(who, follow.damage || 1, { attr: follow.kind || '理智' });
  } finally {
    delete c.__inFollowUp;
  }
  if (follow.moveMin) {
    const asked = a.ask({ kind: 'choice', seat: c.seat, options: ['前进', '不前进'], title: '少女的连续攻势', reason: `可以前进 ${follow.moveMin}-${follow.moveMax} 格` });
    const take = (Number(Array.isArray(asked) ? asked[0] : asked) || 0) === 0;
    a.emit({ type: 'sanityFollowMove', seat: c.seat, taken: take });
    if (take) a.run([{ op: 'move', n: follow.moveMax || 3 }]);
  }
}
op('damage_multi', (s, c, o, a) => {
  const who = o.targetWho === 'self' ? c.seat : (c.target || c.seat);
  const hits = o.hits || [];
  // AOE 范围过滤（同 single damage 的口径）：目标不在范围内则整段都不适用
  const rangeSpec = o.range || o.aoe;
  if (rangeSpec && who !== c.seat) {
    const from = s.seats[c.seat] ? s.seats[c.seat].position : 0;
    const to = s.seats[who] ? s.seats[who].position : 0;
    if (!inRange(from, to, rangeSpec)) {
      a.emit({ type: 'damageOutOfRange', seat: c.seat, target: who, range: rangeSpec, note: '多段伤害：目标不在范围内，整段不适用' });
      return;
    }
  }
  for (const h of hits) {
    if (h.judge) {
      // `dice:'fixed'` = 不掷骰，直接取 base（卡面写"1点判定伤害"这类**固定判定伤害**，
      // 如【清凉时间！】"造成2段伤害：1点判定伤害和1点理智属性伤害"——之前被我当成 d6 掷骰）
      const isFixedHit = h.dice === 'fixed';
      const isCoinHit = h.dice === 'coin';
      const sides = (isCoinHit || isFixedHit) ? null : (Number(String(h.dice || '').replace(/\D/g, '')) || h.sides || 6);
      const roll = isFixedHit ? 0 : (isCoinHit ? (c.rng && c.rng.coin() ? 1 : 0) : (c.rng ? c.rng.dice(sides) : 1));
      a.emit({ type: 'judge', seat: c.seat, dice: isFixedHit ? 'fixed' : (isCoinHit ? 'coin' : 'd' + sides), roll });
      // 与单段判定同口径（17312-17323）：骰子=骰点、fixed=base||1、硬币=正面 base||2
      const hitBase = isFixedHit ? (h.base || 1) : (isCoinHit ? (roll ? (h.base || 2) : 0) : (sides ? roll : 0));
      a.damage(who, hitBase, { judge: true, attr: h.kind || null });
    } else {
      const atkPower = (a.seat().attackBuff || 0) + (a.seat().counters.tempAttack || 0);
      a.damage(who, h.base || 0, { attackPower: atkPower, attr: h.kind || null });
    }
  }
});
op('pay_n_deal_n', (s, c, o, a) => {
  // 卡面（红宝之杖·运）："自己回合**付 1-10 音韵**发动，对一名其他玩家造**与支付音韵相同数值**的热忱伤害"
  // 两处以前都错了：① 付的是**音韵值**（seat.cost）不是同步值；② 没读 `min/max`（于是支付 0、伤害 0）
  const seat = a.seat();
  const min = o.min ?? o.pay ?? o.n ?? 1;
  const max = o.max ?? min;
  const options = [];
  for (let v = min; v <= max; v++) options.push(String(v));
  const picked = options.length > 1
    ? a.ask({ kind: 'choice', seat: c.seat, options, title: '支付多少音韵', reason: `付 ${min}-${max} 音韵，造成等量伤害` })
    : 0;
  const idx = Number(Array.isArray(picked) ? picked[0] : picked) || 0;
  const want = Math.min(min + idx, max, seat.cost || 0);
  seat.cost = Math.max(0, (seat.cost || 0) - want);
  a.emit({ type: 'payCostForDamage', seat: c.seat, amount: want });
  a.damage(c.target || c.seat, want, { attr: o.kind || null });
});

// ── 移动 ──────────────────────────────────────────────────────────────────
/**
 * 唯一位移出口：把"位移修饰符族"（固定/增减/翻倍/追加）一次性算清再走格。
 * 旧引擎这套修饰符散在 `_nextMoveAdjust` / `_fixedNextMove` / `moveBuff.*` 三处、重置点各不相同；
 * 新引擎全部走这里，消费即清（生存期由 flags.js 声明）。
 */
function apiMove(a, s, c, rawSteps) {
  const seat = a.seat();
  let steps = rawSteps;
  if (seat.counters.fixedNextMove != null) {
    steps = seat.counters.fixedNextMove;
    delete seat.counters.fixedNextMove;
    a.emit({ type: 'fixedMoveApplied', seat: c.seat, steps });
  } else if (seat.counters.nextMoveAdjust) {
    steps += seat.counters.nextMoveAdjust;
    a.emit({ type: 'moveAdjusted', seat: c.seat, delta: seat.counters.nextMoveAdjust });
    delete seat.counters.nextMoveAdjust;
  }
  if (seat.counters.doubleMove) { steps *= 2; a.emit({ type: 'moveDoubled', seat: c.seat }); }
  const r = moveSeat(seat, steps);
  r.events.forEach((e) => a.emit(e));
  seat.counters.moveTotal = (seat.counters.moveTotal || 0) + Math.abs(r.steps);
  s.book.lastMoveFrom = r.from;
  s.book.lastMoveSteps = r.steps;
  const bonus = seat.counters.bonusMoveAfter || 0;
  if (bonus) {
    const r2 = moveSeat(seat, bonus);
    r2.events.forEach((e) => a.emit(e));
    s.book.lastMoveFrom = r2.from;
    s.book.lastMoveSteps = r2.steps;
  }
  // 经过/到达起点的奖励（规则书附录B：经过 +400 金币 +1 音韵；到达双倍）
  for (const e of r.events) {
    if (e.type === 'passStart' || e.type === 'landStart') {
      gainGold(seat, e.gold);
      gainCost(seat, e.cost);
      a.emit({ type: 'startTileReward', seat: c.seat, gold: e.gold, cost: e.cost, landed: e.type === 'landStart' });
    }
  }
  // 落点格结算（规则书 §7.5.3：因任何效果移动而落到某格，都要立即结算该格效果）
  for (const e of resolveTile(s, c.seat, { rng: c.rng, answer: c.answer }).events) a.emit(e);
  // 移动完成后的角色被动（旧引擎 accumulateMovePassives：冬马累计伤害 / 星奈水着单次位移伤害…）
  for (const eff of movePassiveEffects(s, c.seat, r.steps, r.from)) {
    const foe = (c.target && c.target !== c.seat) ? c.target : (s.seatIds.find((x) => x !== c.seat) || c.seat);
    a.emit({ type: 'passiveTrigger', label: eff.label });
    a.damage(eff.target || foe, eff.amount, { attackPower: 0, attr: eff.kind || null });
  }
  return r;
}

op('move', (s, c, o, a) => {
  const seat = a.seat();
  const dir = (seat.flags.directionReversed ? -1 : 1) * (o.dir === -1 ? -1 : 1);
  apiMove(a, s, c, (o.n || o.amount || 0) * dir);
});
op('move_range', (s, c, o, a) => {
  const seat = a.seat();
  const min = o.min ?? 1, max = o.max ?? min;
  const both = !!o.both;
  const options = [];
  if (both) for (let i = min; i <= max; i++) { options.push('前进' + i + '格'); options.push('后退' + i + '格'); }
  else for (let i = min; i <= max; i++) options.push(((o.dir || 1) < 0 ? '后退' : '前进') + i + '格');
  const pick = min === max && !both ? 0 : a.ask({ kind: 'choice', seat: c.seat, options, reason: '在 ' + min + '-' + max + ' 格内选择' });
  const idx = Number(Array.isArray(pick) ? pick[0] : pick) || 0;
  const steps = both ? (idx % 2 === 1 ? -1 : 1) * (min + Math.floor(idx / 2)) : (min + idx) * (o.dir || 1);
  apiMove(a, s, c, steps * (seat.flags.directionReversed ? -1 : 1));
});
op('move_by_roll', (s, c, o, a) => {
  const sides = o.sides || a.seat().counters.nextDiceSides || 6;
  const raw = c.rng ? c.rng.dice(sides) : 1;
  a.emit({ type: 'roll', seat: c.seat, sides, roll: raw });
  const roll = afterRoll(s, c, a, raw);            // 予回音韵 / 伊织二选一
  offerGospelOrNull(s, c, a, c.seat);              // 葵的福音雅颂
  apiMove(a, s, c, roll);
});

// ── 判定 / 流程控制 ───────────────────────────────────────────────────────
op('roll_dice', (s, c, o, a) => {
  const sides = o.sides || 6;
  const raw = c.rng ? c.rng.dice(sides) : 1;
  a.emit({ type: 'roll', seat: c.seat, sides, roll: raw });
  const roll = afterRoll(s, c, a, raw);
  s.book.lastRoll = roll;
  offerGospelOrNull(s, c, a, c.seat);
  a.emit({ type: 'rollFinal', seat: c.seat, roll });
});
op('judge_branch', (s, c, o, a) => {
  const sides = o.sides || 6;
  const raw = c.rng ? c.rng.dice(sides) : 1;
  const roll = afterRoll(s, c, a, raw);            // 判定也是一次投掷
  a.emit({ type: 'judge', seat: c.seat, sides, roll, cmp: o.cmp, rhs: o.rhs });
  offerGospelOrNull(s, c, a, c.seat);
  const pass = compare(roll, o.cmp, o.rhs);
  a.run(pass ? o.thenOps : o.elseOps);
});
op('choice', (s, c, o, a) => {
  const picked = a.ask({ kind: 'choice', seat: c.seat, options: o.labels || [], title: o.title, subtitle: o.subtitle, reason: '从以下效果中选择一项' });
  const idx = Number(Array.isArray(picked) ? picked[0] : picked) || 0;
  a.emit({ type: 'choice', seat: c.seat, index: idx, label: (o.labels || [])[idx] });
  a.run((o.branches || [])[idx] || []);
});
op('optional', (s, c, o, a) => {
  const yes = a.ask({ kind: 'choice', seat: c.seat, options: ['发动', '不发动'], title: o.label || '可选效果', reason: '可以发动' });
  const idx = Number(Array.isArray(yes) ? yes[0] : yes) || 0;
  a.emit({ type: 'optional', seat: c.seat, taken: idx === 0 });
  if (idx === 0) a.run(o.inner || []);
});

// ── 方向 / 打断（响应类窗口的载荷；窗口本身在 P3） ────────────────────────
op('change_direction', (s, c, o, a) => { a.seat().flags.directionReversed = true; a.emit({ type: 'changeDirection', seat: c.seat }); });
op('interrupt_move', (s, c, o, a) => { s.pending.moveInterrupted = true; a.emit({ type: 'interruptMove', seat: c.seat }); });

// ── 位移修饰符族（旧引擎散落为 `_nextMoveAdjust` / `_fixedNextMove` / `moveBuff.*`） ──
op('adjust_next_move', (s, c, o, a) => { const seat = a.seat(); seat.counters.nextMoveAdjust = (seat.counters.nextMoveAdjust || 0) + (o.delta || 0); a.emit({ type: 'adjustNextMove', seat: c.seat, delta: o.delta || 0 }); });
op('adjust_next_move_all', (s, c, o, a) => {
  for (const id of s.seatIds) {
    const seat = s.seats[id];
    seat.counters.nextMoveAdjust = (seat.counters.nextMoveAdjust || 0) + (o.delta || 0);
  }
  a.emit({ type: 'adjustNextMoveAll', delta: o.delta || 0 });
});
op('fix_next_move', (s, c, o, a) => { a.seat().counters.fixedNextMove = o.n; a.emit({ type: 'fixNextMove', seat: c.seat, n: o.n }); });
op('buff_double_move', (s, c, o, a) => { a.seat().counters.doubleMove = 1; a.emit({ type: 'buffDoubleMove', seat: c.seat }); });
op('buff_bonus_move_after', (s, c, o, a) => { a.seat().counters.bonusMoveAfter = o.amount || 1; a.emit({ type: 'buffBonusMoveAfter', seat: c.seat, amount: o.amount || 1 }); });

// ── 位移变体 ──────────────────────────────────────────────────────────────
op('move_choice', (s, c, o, a) => {
  const steps = o.steps || o.n || 1;
  const picked = a.ask({ kind: 'choice', seat: c.seat, options: ['前进' + steps + '格', '后退' + steps + '格'], reason: '选择移动方向' });
  const back = Number(Array.isArray(picked) ? picked[0] : picked) === 1;
  apiMove(a, s, c, back ? -steps : steps);
});
op('move_pay_extra', (s, c, o, a) => {
  const seat = a.seat();
  const dirPick = a.ask({ kind: 'choice', seat: c.seat, options: ['前进', '后退'], reason: '选择移动方向' });
  const dir = Number(Array.isArray(dirPick) ? dirPick[0] : dirPick) === 1 ? -1 : 1;
  const maxExtra = Math.min(seat.cost || 0, o.max || 8);
  const perStep = o.perStep || 1;
  const opts = [];
  for (let k = 0; k <= maxExtra; k++) opts.push(k === 0 ? `不额外投入（${o.base}格）` : `投入${k}音韵，多移${k * perStep}格`);
  const pick = maxExtra > 0 ? a.ask({ kind: 'choice', seat: c.seat, options: opts, reason: '额外消耗音韵' }) : 0;
  const extra = Number(Array.isArray(pick) ? pick[0] : pick) || 0;
  if (extra > 0) { const r = payCost(seat, extra); if (!r.ok) a.emit({ type: 'payFailed', reason: r.reason }); }
  a.emit({ type: 'movePayExtra', seat: c.seat, extra, perStep });
  apiMove(a, s, c, (o.base + extra * perStep) * dir);
});
op('move_to_player', (s, c, o, a) => {
  const seat = a.seat();
  const target = a.seat(c.target || c.seat);
  const from = seat.position;
  seat.position = target.position;
  a.emit({ type: 'move', from, to: seat.position, steps: 0, reason: 'moveToPlayer', tile: null });
});
op('move_to_tile', (s, c, o, a) => {
  const seat = a.seat();
  const from = seat.position;
  let to = from;
  if (o.kind === 'opposite') to = wrap(from + Math.floor(TILE_COUNT / 2));
  else if (o.kind === 'game' || o.kind === 'nearest_interactive') {
    const want = o.kind === 'game' ? 'game' : null;
    for (let d = 1; d <= TILE_COUNT; d++) {
      const t = LAYOUT[wrap(from + d)];
      if (want ? t.type === want : isInteractive(t.type)) { to = t.id; break; }
    }
  } else if (typeof o.tile === 'number') to = wrap(o.tile);
  seat.position = to;
  a.emit({ type: 'move', from, to, steps: 0, reason: 'moveToTile:' + (o.kind || 'fixed'), tile: LAYOUT[to] });
});

// ── 骰点操作（判定/投掷窗口在 P3 接管，这里只登记"下一次"的意图） ──────────
op('set_dice_sides', (s, c, o, a) => { a.seat().counters.nextDiceSides = o.sides || o.n || 6; a.emit({ type: 'setDiceSides', seat: c.seat, sides: o.sides || o.n || 6 }); });
op('modify_dice', (s, c, o, a) => { a.seat().flags.modifyDiceNext = true; a.emit({ type: 'modifyDice', seat: c.seat }); });

// ── 破坏族（统一出口：破坏 = 离区 → 进墓/移出，并记 lastDestroyed） ─────────
function destroyCard(s, a, ownerId, card, to, byId) {
  const seat = a.seat(ownerId);
  for (const zone of ['permanent', 'faceDownCards', 'hand']) {
    const ix = (seat[zone] || []).indexOf(card);
    if (ix >= 0) { seat[zone].splice(ix, 1); break; }
  }
  if (to === 'removed') { seat.removed.push(card); a.emit({ type: 'destroy', seat: ownerId, card, to: 'removed', by: byId }); }
  else { seat.grave.push(card); seat.lastDestroyed = card; a.emit({ type: 'destroy', seat: ownerId, card, to: 'grave', by: byId }); }
}

op('destroy_pick', (s, c, o, a) => {
  const owner = o.who === 'self' ? c.seat : (c.target || c.seat);
  const seat = a.seat(owner);
  const zone = o.zone || 'permanent';
  // 候选池**排除正在结算的这张卡本身**：永续卡"使用即发动"会先入场（作者口径：C1 在结算期间就算在场），
  // 不过滤的话 AI 桩取第一张就会把**它自己**破坏掉 ——【妖刀五月雨】在逐卡对拍里就是这么"自杀"的
  const pool = (seat[zone] || []).map((card, index) => ({ card, zone, index })).filter((p) => p.card !== c.card);
  if (!pool.length) { a.emit({ type: 'destroyNothing', seat: owner, zone }); return; }
  const pick = a.ask({ kind: 'pickList', seat: c.seat, need: 1, allowLess: o.allowLess === true, candidates: pool, reason: '选择要破坏的卡' });
  for (const p of pickFromPool(pool, pick, 1)) {
    if (p.card) destroyCard(s, a, owner, p.card, o.to || 'grave', c.seat);
  }
});
op('destroy_route', (s, c, o, a) => {
  const seat = a.seat(c.target || c.seat);
  const last = seat.lastDestroyed;
  if (!last) { a.emit({ type: 'destroyRouteNothing', seat: seat.id }); return; }
  const ok = !o.when || String(last.attribute || '').includes(o.when) || String(last.type || '').includes(o.when);
  const ix = seat.grave.indexOf(last);
  if (ok && ix >= 0) {
    seat.grave.splice(ix, 1);
    seat.removed.push(last);
    a.emit({ type: 'destroyRouteExiled', seat: seat.id, card: last, when: o.when || '任意' });
  } else a.emit({ type: 'destroyRouteSkipped', seat: seat.id, card: last, when: o.when || '任意' });
});
op('fengji_destroy', (s, c, o, a) => {
  const seat = a.seat();
  const level = seat.level || 1;
  const onRoute = (pos) => {
    const from = s.book.lastMoveFrom;
    const steps = s.book.lastMoveSteps;
    if (level < 7 || from == null || steps == null) return pos === seat.position;
    for (let i = 1; i <= Math.max(1, Math.abs(steps)); i++) {
      if (wrap(from + (steps >= 0 ? i : -i)) === pos) return true;
    }
    return pos === seat.position;
  };
  const candidates = s.seatIds.filter((id) => id !== c.seat && (s.seats[id].sync || 0) > 0 && onRoute(s.seats[id].position));
  if (!candidates.length) { a.emit({ type: 'fengjiNothing', mode: level >= 7 ? '路径' : '终点' }); return; }
  const who = candidates.length === 1 ? candidates[0]
    : candidates[Number(a.ask({ kind: 'choice', seat: c.seat, options: candidates.map((id) => id === c.seat ? '我方' : '对手' + id.slice(1)), reason: '选择破坏谁的一张卡' })) || 0];
  const victim = a.seat(who);
  const pool = [...(victim.permanent || []).map((card, index) => ({ card, zone: 'permanent', index })),
    ...(victim.faceDownCards || []).map((card, index) => ({ card, zone: 'faceDownCards', index }))];
  if (!pool.length) { a.emit({ type: 'fengjiNothing', mode: '目标场上无卡', seat: who }); return; }
  const pick = pool.length === 1 ? pool[0] : a.ask({ kind: 'pickList', seat: c.seat, need: 1, candidates: pool, reason: '选择要破坏的一张卡（每次移动仅一张）' });
  const chosen = pickFromPool(pool, pick, 1)[0];
  if (chosen && chosen.card) destroyCard(s, a, who, chosen.card, 'grave', c.seat);
});
op('knock_off', (s, c, o, a) => {
  const seat = a.seat(c.target || c.seat);
  if (!seat.hand.length) { a.emit({ type: 'knockOffNothing', seat: seat.id }); return; }
  // 卡面写"随机打落"才随机（规则书 §10.3）；随机源只用引擎 RNG 里**确实存在**的方法。
  // （这里以前调用了不存在的 `rng.int` → 抛错 → 被"单节点异常只跳该节点"吞掉 → 整段效果静默失效）
  let card;
  if (c.rng && typeof c.rng.pick === 'function') card = c.rng.pick(seat.hand);
  if (!card) card = seat.hand[0];
  const idx = seat.hand.indexOf(card);
  seat.hand.splice(idx >= 0 ? idx : 0, 1);
  seat.grave.push(card);
  const lose = o.loseCost || 3;
  const before = seat.cost || 0;
  seat.cost = Math.max(0, before - lose);
  a.emit({ type: 'knockOff', seat: seat.id, card, loseCost: before - seat.cost });
});
op('disarm_target', (s, c, o, a) => {
  const seat = a.seat(c.target || c.seat);
  const attacks = seat.hand.filter((card) => card && (card._category === 'attack_cards' || /攻击/.test(card.type || '')));
  if (!attacks.length) { a.emit({ type: 'disarmNothing', seat: seat.id }); return; }
  const pick = attacks.length === 1 ? attacks[0]
    : (() => {
      const pool = attacks.map((card) => ({ card, zone: 'hand', index: seat.hand.indexOf(card) }));
      const p = a.ask({ kind: 'pickList', seat: c.seat, need: 1, candidates: pool, reason: '选择要送入墓地的攻击卡' });
      return p && p.card ? p.card : pool[Number(p) || 0].card;
    })();
  seat.hand.splice(seat.hand.indexOf(pick), 1);
  seat.grave.push(pick);
  seat.statuses['缴械'] = (seat.statuses['缴械'] || 0) + (o.rounds || 1);
  a.emit({ type: 'disarm', seat: seat.id, card: pick, rounds: o.rounds || 1 });
});
op('exile_pick', (s, c, o, a) => {
  const seat = a.seat(c.target || c.seat);
  if (!seat.hand.length) { a.emit({ type: 'exileNothing', seat: seat.id }); return; }
  const pool = seat.hand.map((card, index) => ({ card, zone: 'hand', index }));
  const pick = a.ask({ kind: 'pickList', seat: c.seat, need: 1, candidates: pool, reason: `选 1 张在 ${o.actions || 2} 次行动内移出游戏` });
  const chosen = pick && pick.card ? pick : pool[Number(pick) || 0];
  if (!chosen || !chosen.card) return;
  seat.hand.splice(seat.hand.indexOf(chosen.card), 1);
  seat.exilePending.push({ card: chosen.card, in: o.actions || 2 });
  a.emit({ type: 'exilePending', seat: seat.id, card: chosen.card, in: o.actions || 2 });
});
op('damage_by_removed', (s, c, o, a) => {
  // 卡面写"根据**其**（=目标）被移出游戏的卡数量造伤害" ⇒ 数**目标**的移出区，不是自己的
  // （【惊吓礼盒】/【搜查令】以前都多打/少打了 1 点，就是数错了人）
  const who = o.who === 'self' ? c.seat : (c.target || c.seat);
  const seat = a.seat(who);
  const count = (seat.removed || []).length + (seat.removedFromGame || []).length;
  a.damage(who, count + (o.plus || 0), { attr: o.kind || null });
  a.emit({ type: 'damageByRemoved', seat: who, count, base: count + (o.plus || 0) });
});
op('threat_sacrifice', (s, c, o, a) => {
  const seat = a.seat(c.target || c.seat);
  const match = seat.hand.find((card) => card && (card.attribute === o.attr
    || (card.tags || []).includes(o.attr) || String(card.type || '').includes(o.attr)));
  if (match) {
    seat.hand.splice(seat.hand.indexOf(match), 1);
    seat.grave.push(match);
    const before = seat.cost || 0;
    seat.cost = Math.min(before + 2, seat.maxCost || 12);
    a.emit({ type: 'threatSacrifice', seat: seat.id, card: match, regained: seat.cost - before });
    return;
  }
  const atkPower = (a.seat().attackBuff || 0) + (a.seat().counters.tempAttack || 0);
  a.damage(seat.id, o.elseDamage || 0, { attackPower: atkPower, attr: o.kind || null });
});
op('swim_ring', (s, c, o, a) => {
  const seat = a.seat();
  const picked = a.ask({ kind: 'choice', seat: c.seat, options: ['向前飞掷', '向后飞掷'], reason: '泳圈飞掷方向' });
  const dir = Number(Array.isArray(picked) ? picked[0] : picked) === 1 ? -1 : 1;
  const hits = [];
  for (const id of s.seatIds) {
    if (id === c.seat) continue;
    const other = s.seats[id];
    if ((other.sync || 0) <= 0) continue;
    const dd = wrap(other.position - seat.position);
    const dist = dir > 0 ? dd : (dd === 0 ? 0 : TILE_COUNT - dd);
    if (dist >= 1 && dist <= (o.range || 3)) hits.push({ id, dist });
  }
  hits.sort((x, y) => x.dist - y.dist);
  if (!hits.length) { a.emit({ type: 'swimRingMiss', range: o.range || 3 }); return; }
  for (const h of hits) {
    const other = a.seat(h.id);
    a.damage(h.id, o.damage || 1, { attackPower: 0, attr: '理智' });
    other.defense = (other.defense || 0) - (o.def || 1);
    a.emit({ type: 'swimRingHit', seat: h.id, dist: h.dist, damage: o.damage || 1, def: o.def || 1, dir });
  }
});
op('consume_self', (s, c, o, a) => {
  if (c.card) c.card._consumeOnUse = true;
  a.emit({ type: 'consumeSelf', card: c.card ? c.card.name : null });
});
op('register_mechanic', (s, c, o, a) => {
  const kind = o.kind;
  // ── 回合级"待消费"标记（2026-09-26 重做角色）─────────────────────────────
  // 这类登记的语义是"本回合内，下一次满足条件时生效" ⇒ 存成**带回合戳**的标记，
  // 由消费点读取（回合数不同即自动失效，不需要清理）。
  if (kind === 'extraRollPhases') {
    const seat = a.seat();
    seat.statuses['mech:extraRollPhases'] = { amount: o.n || o.amount || 1, turn: s.turn };
    a.emit({ type: 'mechanic', kind, seat: c.seat, amount: o.n || o.amount || 1, note: '本回合投掷阶段可额外投掷' });
    return;
  }
  if (kind === 'followUpJudgeOnDamage') {
    const seat = a.seat();
    seat.statuses['mech:followUpJudge'] = { amount: o.amount || 1, turn: s.turn };
    a.emit({ type: 'mechanic', kind, seat: c.seat, amount: o.amount || 1, note: '本回合造成属性伤害后，对相同目标追加判定伤害' });
    return;
  }
  if (kind === 'afterSingleItem') {
    const seat = a.seat();
    seat.statuses['mech:afterSingleItem'] = { draw: o.draw || 1, discard: o.discard || 1, turn: s.turn };
    a.emit({ type: 'mechanic', kind, seat: c.seat, note: '本回合使用单次卡后抽 1 并送墓 1' });
    return;
  }
  if (kind === 'stop_all_move') { s.mechanics.stopAllMove = true; a.emit({ type: 'mechanic', kind, note: '终止所有进行中的移动动作' }); return; }
  if (kind === 'barrier') {
    const forward = o.forward || 3;
    const pos = wrap(a.seat().position + forward);
    s.mechanics.barriers = s.mechanics.barriers || [];
    s.mechanics.barriers.push({ pos, by: c.seat });
    a.emit({ type: 'mechanic', kind, pos, forward });
    return;
  }
  if (kind === 'domain') {
    const seat = a.seat();
    delete seat.statuses.domain;              // 新领域覆盖旧领域
    seat.statuses.domain = { range: o.range, actions: o.actions, addedBy: c.seat };
    a.emit({ type: 'mechanic', kind, range: o.range, actions: o.actions, buffPending: true,
      note: '领域增益的卡面解析（旧 parseDomainBuff）在 P4 随卡面实现' });
    return;
  }
  if (kind === 'duel') { s.mechanics.duel = { by: c.seat, target: c.target || null }; a.emit({ type: 'mechanic', kind, pending: true }); return; }
  if (kind === 'copy') { a.emit({ type: 'mechanic', kind, pending: true, note: '蓝图复制需要卡实例与"变回原貌"机制，P4 实现' }); return; }
  if (kind === 'swap_tile') { s.mechanics.swapTile = { by: c.seat }; a.emit({ type: 'mechanic', kind, pending: true }); return; }
  a.emit({ type: 'mechanic', kind, note: '已登记，等待对应子系统结算' });
});

/** 仍登记为缺口的 op（用到即抛错点名；门禁要求"卡里用到的 op 必须已实现或已登记"） */
gap('gain_cost_if_last_match', '按"上一张检索卡/弃牌同色或同费"回费：需要卡级记账（_lastSearchCard/_lastDiscardCard），P4 随卡面实现');
export function compare(value, cmp, rhs) {
  switch (cmp) {
    case '>': return value > rhs;
    case '<': return value < rhs;
    case '>=': return value >= rhs;
    case '<=': return value <= rhs;
    case '==': return value === rhs;
    default: return false;
  }
}

/** 覆盖率：卡里用到的 op 里，已实现/已登记各多少（门禁用） */
// ── 2026-09-26 作者重做角色所需的 op ──────────────────────────────────────
op('team_attack_buff', (s, c, o, a) => {
  const n = o.amount || 1;
  for (const id of s.seatIds) s.seats[id].attackBuff = (s.seats[id].attackBuff || 0) + n;
  a.emit({ type: 'teamAttackBuff', seat: c.seat, amount: n, note: '增加队伍攻击力' });
});
op('sacrifice_count_plus', (s, c, o, a) => {
  const seat = a.seat();
  const n = o.amount || 1;
  seat.counters.sacrificeBonus = (seat.counters.sacrificeBonus || 0) + n;
  a.emit({ type: 'sacrificeCountPlus', seat: c.seat, amount: n });
});
op('recover_own_permanent', (s, c, o, a) => {
  // 【琉璃(万圣祭)】"支付3点同步值来回收自己效果处理区的永续种类的卡"（同步值的支付在能力发动处完成）
  const seat = a.seat();
  const pool = (seat.permanent || []).map((card, index) => ({ card, zone: 'permanent', index }));
  if (!pool.length) { a.emit({ type: 'recoverNothing', seat: c.seat }); return; }
  const pick = a.ask({ kind: 'pickList', seat: c.seat, need: 1, candidates: pool, reason: '回收自己效果处理区的一张永续卡' });
  const chosen = pickFromPool(pool, pick, 1)[0];
  if (!chosen) return;
  const ix = seat.permanent.indexOf(chosen.card);
  if (ix >= 0) seat.permanent.splice(ix, 1);
  seat.hand.push(chosen.card);
  a.emit({ type: 'recoverPermanent', seat: c.seat, card: chosen.card });
});

// ── 投掷后的统一出口（重做角色：予的回音韵、伊织的二选一、葵的福音雅颂）────────
/**
 * 任何"掷骰/判定"结算后都该走这里 —— 保证三件事**只有一处实现**：
 *   ① 记本回合投掷次数（伊织/葵的被动都要看它）
 *   ② 入间予"每进行一次投掷后回复自身 1 音韵值"
 *   ③ 小野伊织"可以在其和 2 中选一项作为最终结果"（返回最终点数）
 * 葵的福音雅颂（同回合第二次投掷后）由调用方在拿到 roll 后另行询问。
 */
function afterRoll(s, c, a, roll) {
  const seat = s.seats[c.seat];
  if (seat) seat.statuses.rollCountTurn = (seat.statuses.rollCountTurn || 0) + 1;
  for (const e of afterRollEffects(s, c.seat)) {
    if (e.type === 'gainCost') {
      const got = gainCost(seat, e.amount);
      a.emit({ type: 'gainCost', seat: c.seat, amount: got, reason: e.reason, label: e.label });
    }
  }
  const opts = diceChoiceOptions(s, c.seat);
  if (opts.length && roll != null) {
    const picked = a.ask({ kind: 'choice', seat: c.seat, options: ['保留本次结果 ' + roll, ...opts.map((v) => '改为 ' + v)], title: '投掷结果', reason: '可以在其和 2 中选一项作为最终结果' });
    const idx = Number(Array.isArray(picked) ? picked[0] : picked) || 0;
    if (idx > 0) {
      const final = opts[idx - 1];
      a.emit({ type: 'diceChoice', seat: c.seat, from: roll, to: final });
      return final;
    }
  }
  return roll;
}

/** 葵的福音雅颂：有玩家同回合第二次投掷后（一轮内每名玩家限一次） */
function offerGospelOrNull(s, c, a, rollerId) {
  for (const id of s.seatIds) {
    const offer = secondRollGiftOffer(s, id, rollerId);
    if (!offer) continue;
    const yes = a.ask({ kind: 'choice', seat: id, options: ['发动福音雅颂', '不发动'], title: '小野葵·福音雅颂', reason: offer.label });
    const taken = (Number(Array.isArray(yes) ? yes[0] : yes) || 0) === 0;
    a.emit({ type: 'gospelOffered', seat: id, roller: rollerId, taken });
    if (!taken) continue;
    s.seats[id].statuses['gospelRound:' + rollerId] = true;   // 一轮内每名玩家限一次
    // 卡面效果：① 触发者可从**自己墓地**选一张**单次种类**的卡加入手卡（用后放回牌组最下方）
    //           ② 那之后 葵 与其各回复 2 点音韵值
    const roller = s.seats[rollerId];
    if (roller) {
      const pool = (roller.grave || [])
        .filter((card) => card && String(card._category || '').includes('item_single'))
        .map((card, index) => ({ card, zone: 'grave', index }));
      if (pool.length) {
        const pick = a.ask({ kind: 'pickList', seat: rollerId, need: 1, allowLess: true, candidates: pool, reason: '福音雅颂：选自己墓地的一张单次卡加入手卡' });
        const chosen = pickFromPool(pool, pick, 1)[0];
        if (chosen) {
          const ix = roller.grave.indexOf(chosen.card);
          if (ix >= 0) roller.grave.splice(ix, 1);
          chosen.card._addedByEffect = true;
          chosen.card._returnBottomAfterUse = true;   // 用后放回牌组最下方（placeAfterUse 兑现）
          roller.hand.push(chosen.card);
          a.emit({ type: 'gospelRecover', seat: rollerId, card: chosen.card });
        }
      } else {
        a.emit({ type: 'gospelNoCard', seat: rollerId, note: '墓地没有单次种类的卡' });
      }
    }
    for (const who of [id, rollerId]) {
      const got = gainCost(s.seats[who], offer.gainCost || 2);
      a.emit({ type: 'gainCost', seat: who, amount: got, reason: 'aoi.gospel' });
    }
    return { seat: id, roller: rollerId };
  }
  return null;
}

op('pay_sync', (s, c, o, a) => {
  // 支付**同步值**（内容声明里的主动能力用；与 pay_n_deal_n 的"付音韵"区分开）
  const seat = a.seat();
  const want = o.amount || 0;
  const paid = Math.min(seat.sync || 0, want);
  if (paid < want) { a.emit({ type: 'paySyncRefused', seat: c.seat, want, have: seat.sync || 0 }); return; }
  seat.sync = (seat.sync || 0) - paid;
  a.emit({ type: 'paySync', seat: c.seat, amount: paid });
});
op('pay_cost_move', (s, c, o, a) => {
  // 【设计师的直尺】主动能力："每支付 1 点音韵值来前进 1 格" ⇒ 问支付多少（默认 1），随后前进等量格
  const seat = a.seat();
  const max = Math.min(o.max || seat.cost || 0, seat.cost || 0);
  if (max < 1) { a.emit({ type: 'payCostMoveRefused', seat: c.seat, note: '音韵不足，无法支付' }); return; }
  const options = [];
  for (let v = 1; v <= max; v++) options.push(String(v));
  const picked = options.length > 1
    ? a.ask({ kind: 'choice', seat: c.seat, options, title: '支付多少音韵前进', reason: '每支付 1 点音韵值前进 1 格' })
    : 0;
  const idx = Number(Array.isArray(picked) ? picked[0] : picked) || 0;
  const pay = Math.min(1 + idx, max);
  seat.cost = Math.max(0, (seat.cost || 0) - pay);
  a.emit({ type: 'payCostMove', seat: c.seat, paid: pay, tiles: pay * (o.perTile || 1) });
  a.run([{ op: 'move', n: pay * (o.perTile || 1) }]);
});

export function opsCoverage(usedOpTypes) {
  const used = usedOpTypes || {};
  const implemented = [], gaps = [], unknown = [];
  for (const name of Object.keys(used)) {
    if (name === 'undefined') { unknown.push(name); continue; }
    if (OPS.has(name)) implemented.push(name);
    else if (DECLARED_GAPS.has(name)) gaps.push(name);
    else unknown.push(name);
  }
  return { implemented: implemented.sort(), gaps: gaps.sort(), unknown: unknown.sort(), total: Object.keys(used).length };
}
