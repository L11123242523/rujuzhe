/**
 * 入局者 v2 · 逐卡能力（内容驱动）
 * ---------------------------------------------------------------------------
 * 旧引擎把"这张卡常驻改变什么"写在引擎代码里，靠卡名 `indexOf` 判断：
 *   `computeDamageValue` 里 `hasPerm('善意面具')`、`hasPerm('风纪委员')`、`hasPerm('钢笔')` …
 *   `runOneOp` 里 6 处 `name.indexOf('血之佑戒')`、`history` 里的 `__isCounterText`
 * 这些在新引擎里全部变成 **content/abilities.json 的声明**（构建期编译成 ESM 常量）。
 *
 * 本模块只做三件事：
 *   ① 把声明索引起来（按卡名 / 按机制）
 *   ② 提供"这张卡在场时给伤害/回复带来什么修正"的查询（数据 → 修正数组）
 *   ③ 提供显式 `chainKind` 覆盖与 `negate_effect` 判定
 * 它**不**碰 DOM、**不**碰 fs（内容是构建期烘进来的）。
 */

import { CARD_ABILITIES, CHARACTER_PASSIVES, CHARACTERS, ABILITY_STATS, ABILITY_SOURCE } from './generated/abilities.js';

const BY_CARD = new Map();
const BY_ID = new Map();
for (const a of CARD_ABILITIES) {
  BY_ID.set(a.id, a);
  if (a.card) {
    if (!BY_CARD.has(a.card)) BY_CARD.set(a.card, []);
    BY_CARD.get(a.card).push(a);
  }
}

export { ABILITY_STATS, ABILITY_SOURCE };

export function abilityById(id) { return BY_ID.get(id) || null; }
export function abilitiesForCard(cardName) { return BY_CARD.get(cardName) || []; }
export function allAbilities() { return CARD_ABILITIES; }

/** 卡是否在指定区域里（内容声明里的"来源在场"判据） */
function cardInZone(state, seatId, cardName, zones) {
  const seat = state.seats[seatId];
  if (!seat) return false;
  return zones.some((z) => (seat[z] || []).some((c) => c && c.name === cardName));
}

/**
 * 收集"常驻修正"（用于伤害出口）。取代旧引擎按卡名硬编的那一堆 `hasPerm(...)`。
 * @returns {Array<{id:string, when:string, add:number}>}
 */
export function collectModifiers(state, seatId, ctx = {}) {
  const seat = state.seats[seatId];
  if (!seat) return [];
  const out = [];
  const cardCategory = ctx.card && ctx.card._category;
  // ① 内容声明的常驻修正（来源在效果处理区即生效）
  for (const ab of CARD_ABILITIES) {
    if (!ab.modifiers || !ab.card) continue;
    if (!cardInZone(state, seatId, ab.card, ['permanent'])) continue;
    for (const m of ab.modifiers) {
      if (m.onlyIf && m.onlyIf.cardCategory && m.onlyIf.cardCategory !== cardCategory) continue;
      out.push({ id: ab.id + ':' + (m.label || m.when), when: m.when || 'always', add: m.add || 0 });
    }
  }
  // ② 角色被动/SP 声明的伤害加成（旧引擎散落的 `_intellectBonus` / `_judgeDamageBonus` /
  //    `_critDamageBonus` / `_attrBonus` 计数器 —— 那些计数器只由角色名硬编写入，从没有"谁写的"记录）
  for (const p of activePassives(state, seatId)) {
    if (p.status !== 'implemented' || p.mechanism !== 'damageModifier') continue;
    const w = p.params.when || 'always';
    const cost = ctx.card ? Number(ctx.card.cost) : null;
    if (w === 'attackSkill' && !(ctx.card && ['attack_cards', 'skill_cards'].includes(ctx.card._category))) continue;
    if (w === 'aggressionItem' && !(ctx.card && ctx.card._category === 'item_single' && (ctx.card.archetypes || []).some((x) => String(x).includes('侵略')))) continue;
    // 【琉璃(万圣祭)】"使用费用小于等于 3 的卡造成的最终伤害 +1"：按卡面用**费用**做条件
    if (w === 'cheapCard' && !(cost != null && cost <= (p.params.maxCost || 3))) continue;
    if (p.params.onlyIfMaxCost != null && !(cost != null && cost <= p.params.onlyIfMaxCost)) continue;
    // 条件已经在上面判过 ⇒ 交给伤害核心时一律是 `always`（核心只认 always/counter/judge/sanity）
    const core = (w === 'attackSkill' || w === 'aggressionItem' || w === 'cheapCard') ? 'always' : w;
    out.push({ id: p.id, when: core, add: p.params.add || 0, label: p.params.label });
  }
  // ③ 通用修正（由 ops 写在 status 上的，如 _attrBonus 的结构化版本）
  const s = seat.statuses || {};
  if (s.attrBonus) out.push({ id: 'status:attrBonus', when: 'counter', add: s.attrBonus });
  if (s.intellectBonus) out.push({ id: 'status:intellectBonus', when: 'sanity', add: s.intellectBonus });
  if (s.judgeBonus) out.push({ id: 'status:judgeBonus', when: 'judge', add: s.judgeBonus });
  return out;
}

/** 自然回复加成（§5.2，来自在场的永续卡；取代旧引擎 `__reg` 里的卡名判断） */
export function collectRegenBonus(state, seatId) {
  const seat = state.seats[seatId];
  if (!seat) return 0;
  let bonus = 0;
  for (const ab of CARD_ABILITIES) {
    if (!ab.regen) continue;
    if (cardInZone(state, seatId, ab.card, ['permanent'])) bonus += ab.regen;
  }
  return bonus + (seat.counters.regenBonus || 0);
}

/** 音韵上限加成（§5.2） */
export function collectMaxCostBonus(state, seatId) {
  const seat = state.seats[seatId];
  if (!seat) return 0;
  let bonus = 0;
  for (const ab of CARD_ABILITIES) {
    if (!ab.maxCost) continue;
    if (cardInZone(state, seatId, ab.card, ['permanent'])) bonus += ab.maxCost;
  }
  return bonus;
}

/** 显式连锁种类覆盖（用例：崩塌之乌托邦的反制整效） */
export function chainKindOverride(cardName) {
  const list = BY_CARD.get(cardName) || [];
  for (const a of list) if (a.chainKind) return a.chainKind;
  return null;
}

/** 这张卡是否能反制整效（把 C1 标记取消） */
export function isNegateEffectCard(card) {
  if (!card) return false;
  const list = BY_CARD.get(card.name) || [];
  return list.some((a) => a.negateEffect);
}

/** 专用卡脚本（ops 表达不了的流程）：返回脚本 id 或 null */
export function scriptForCard(card) {
  if (!card) return null;
  const list = BY_CARD.get(card.name) || [];
  for (const a of list) if (a.script) return a.script;
  return null;
}

/**
 * 造伤时可付同步值换增伤（内容声明的 damagePay）：返回候选决策或 null。
 * 旧引擎把这类窗口散在伤害出口里（如血戒的 `showChoiceModal('…造成伤害时…')`）。
 */
export function damagePayOffers(state, seatId, ctx = {}) {
  const seat = state.seats[seatId];
  if (!seat) return [];
  const out = [];
  for (const ab of CARD_ABILITIES) {
    if (!ab.damagePay || !ab.card) continue;
    if (!cardInZone(state, seatId, ab.card, ['permanent'])) continue;
    if (ab.damagePay.oncePerTurn && seat.statuses['dmgPayUsed:' + ab.id + ':' + state.turn]) continue;
    if ((seat.sync || 0) < (ab.damagePay.sync || 0)) continue;
    out.push({ abilityId: ab.id, card: ab.card, sync: ab.damagePay.sync || 0, add: ab.damagePay.add || 0, oncePerTurn: !!ab.damagePay.oncePerTurn });
  }
  return out;
}

/** 兑现一次 damagePay（扣同步值 + 标记一回合一次） */
export function commitDamagePay(state, seatId, offer) {
  const seat = state.seats[seatId];
  if (!seat) return { ok: false, reason: '未知座位' };
  if ((seat.sync || 0) < offer.sync) return { ok: false, reason: '同步值不足' };
  seat.sync -= offer.sync;
  if (offer.oncePerTurn) seat.statuses['dmgPayUsed:' + offer.abilityId + ':' + state.turn] = true;
  return { ok: true, paid: offer.sync, add: offer.add };
}

/** 馈赠卡池过滤：**在场卡**与**角色被动**两种来源（【共鸣者】卡、【小野伊织】被动·恩典） */
export function giftPoolFilters(state, seatId) {
  const out = [];
  for (const ab of CARD_ABILITIES) {
    if (!ab.giftPoolFilter || !ab.card) continue;
    if (!cardInZone(state, seatId, ab.card, ['permanent'])) continue;
    out.push(...(ab.giftPoolFilter.exclude || []));
  }
  for (const p of activePassives(state, seatId)) {
    if (p.status !== 'implemented' || p.mechanism !== 'giftPoolFilter') continue;
    out.push(...(p.params.exclude || []));
  }
  return out;
}

/**
 * 内容层的 ops 覆盖（**内容真源优先于编译产物**）。
 * 用途：编译器把卡面里"属于另一个时点"的段落编进了主效果（如【核心的供给者】把
 * "每次提升等级后三选一"编进了发动效果），这时在内容层显式覆盖 main/activated/triggers，
 * 而**不去改编译产物**（编译产物保持可审计，覆盖点明确可查）。
 */
export function opsOverrideFor(card) {
  if (!card) return null;
  for (const ab of CARD_ABILITIES) {
    if (ab.mechanism !== 'opsOverride' || ab.status !== 'implemented') continue;
    if (ab.card === card.name) return ab.params || null;
  }
  return null;
}

/**
 * 开局一次性属性加成（旧引擎在被动注册时直接改座位字段，如
 * 【樱】SP `p.attackBuff += 2`、`p._attrBonus += 1`）—— 新引擎用声明表达，开局由
 * `applyStartOfGame` 施加，**不散落在注册代码里**。
 */
export function applyStatPassives(state, seatId) {
  const seat = state.seats[seatId];
  const applied = [];
  for (const p of activePassives(state, seatId)) {
    if (p.status !== 'implemented' || p.mechanism !== 'startOfGameStat') continue;
    for (const [k, v] of Object.entries(p.params.stats || {})) {
      if (k === 'attackBuff') seat.attackBuff = (seat.attackBuff || 0) + v;
      else if (k === 'status') continue;
      else if (v) seat.statuses[k] = (seat.statuses[k] || 0) + v;
    }
    for (const [k, v] of Object.entries(p.params.statuses || {})) seat.statuses[k] = (seat.statuses[k] || 0) + v;
    applied.push(p.id);
  }
  return applied;
}

/* ============================================================================
 * 角色被动 / SP（内容声明驱动）
 * ----------------------------------------------------------------------------
 * 旧引擎 `processCharacterPassives`（game.html:19634）是一条约 300 行的 `charName.indexOf` 巨型 if 链，
 * 把 24 组 `_xxxPassive` 标志写进座位，再把具体效果散落在各自的钩子函数里。
 * 新引擎：角色被动在**内容层**声明机制，引擎只认机制类型（与 ops 的做法一致）。
 * ========================================================================== */

export function characterPassives() { return CHARACTER_PASSIVES; }

/**
 * 角色名匹配：**子串匹配**（与旧引擎 `charName.indexOf('里绪') >= 0` 同口径）。
 * 内容声明里写的是短名（"里绪"），而实际队长名常是全名（"现实间里绪"）——
 * 用全等比较会让整条被动**静默失效**（P4c 第七批就是这么被抓出来的：
 * 里绪SP 的"判定伤害+1"没生效，导致【夏日海滩踢击】少 1 点）。
 */
export function nameMatches(declared, actual) {
  if (!declared || !actual) return false;
  return declared === actual || actual.includes(declared) || declared.includes(actual);
}

/**
 * 某座位当前生效的角色被动。
 * - **队长位**：无论 role 怎么写都生效（旧引擎 `if (isCaptain)`）。
 * - **队员位**：只有角色卡的 `sp_member === true` 才生效 —— 这是**数据**，不是我手写的判断
 *   （P4c 第七批：我手写 `memberAllowed: true` 让【入间予】在队员位也生效，
 *   而其 `sp_member=false`，于是判定伤害多了一层 +1，对拍从 21 掉到 18）。
 */
export function activePassives(state, seatId) {
  const seat = state.seats[seatId];
  if (!seat) return [];
  const captainName = seat.captain && seat.captain.name;
  const teamNames = (seat.teamNames || []).filter(Boolean);
  const passivesOf = (name) => CHARACTER_PASSIVES.filter((p) => nameMatches(p.card, name));
  const out = [];

  // ① 队长位：全部生效 —— **队长有 SP 也生效**（作者口径 2026-09-26）
  if (captainName) out.push(...passivesOf(captainName));

  // ② 队员位：按**队伍顺序**遍历；只有角色卡 `sp_member === true` 才生效；
  //    编组类 SP **只在队员之间**冲突（"只生效第一个"）—— **队长不参与这个冲突**
  //    （作者口径：作为队长位的 SP 不会和队员位 SP 冲突。我上一版让"队长是编组类就压制全部队员编组类"，
  //      那是改过头了）
  let memberGroupTaken = false;
  for (const name of teamNames) {
    if (captainName && nameMatches(captainName, name)) continue;   // 队长已在 ① 里
    for (const p of passivesOf(name)) {
      if (p.role === 'captain') continue;                          // 只在队长位生效的，队员位不生效
      if (p.spMember !== true) continue;
      if (p.groupSP) {
        if (memberGroupTaken) continue;                            // 被**前面的队员**编组类 SP 压制
        memberGroupTaken = true;
      }
      out.push(p);
    }
  }
  return out;
}

/**
 * 开局应用：把"只体现为一个标志"的被动写进座位（如小野葵的首用减费、宁雨清的加入手卡减费）。
 * 旧引擎在 `processCharacterPassives` 里一次性写 24 个标志；新引擎只写**声明过的**。
 * @returns {{applied:string[], events:Array}}
 */
export function applyStartOfGame(state, seatId) {
  const seat = state.seats[seatId];
  const applied = [];
  const events = [];
  for (const p of activePassives(state, seatId)) {
    if (p.status !== 'implemented') continue;
    if (p.mechanism === 'costFlag' && p.params && p.params.flag) {
      seat.flags[p.params.flag] = true;
      applied.push(p.params.flag);
      events.push({ type: 'passiveFlag', seat: seatId, flag: p.params.flag, label: p.params.label });
    }
  }
  const stats = applyStatPassives(state, seatId);
  for (const id of stats) { applied.push(id); events.push({ type: 'passiveStat', seat: seatId, id }); }
  return { applied, events };
}

/**
 * 移动完成后触发"移动累计"族被动（旧引擎 `accumulateMovePassives`，game.html:10971-11021）。
 * @returns {Array<{type:'damage', target:string, amount:number, kind:string, label:string}>}
 */
export function movePassiveEffects(state, seatId, steps, fromPos) {
  const seat = state.seats[seatId];
  const out = [];
  if (!seat) return out;
  const amt = Math.abs(steps || 0);
  for (const p of activePassives(state, seatId)) {
    if (p.status !== 'implemented') continue;
    if (p.mechanism === 'moveAccumulateDamage') {
      const lv = seat.level || 1;
      const tier = [...(p.params.tiers || [])].reverse().find((t) => lv >= t.minLevel) || p.params.tiers[0];
      if (!tier) continue;
      // 单回合累计：存在 statuses 里（键名由内容决定，故不走 counters 的"必须逐个声明"），
      // 由 flow.startTurn 按 `moveAcc:` 前缀清空（与旧引擎"回合结束归零"同语义）
      const key = 'moveAcc:' + p.id;
      seat.statuses[key] = (seat.statuses[key] || 0) + amt;
      let guard = 0;
      while (seat.statuses[key] >= tier.every && guard++ < 20) {
        seat.statuses[key] -= tier.every;
        out.push({ type: 'damage', target: null, amount: tier.damage, kind: p.params.kind, label: p.params.label + '（累计 ' + tier.every + ' 格）' });
      }
    }
    if (p.mechanism === 'singleMoveDamage' && amt >= (p.params.minSteps || 6)) {
      for (let i = 0; i < (p.params.segments || 1); i++) {
        out.push({ type: 'damage', target: null, amount: p.params.damage || 1, kind: p.params.kind, label: p.params.label + '（单次移动 ' + amt + ' 格）' });
      }
    }
  }
  return out;
}

/** 对某个地图格有加成的角色被动（如【小野伊织】SP 的神社加成） */
export function tileBonusPassives(state, seatId, tileType) {
  return activePassives(state, seatId).filter((p) => p.status === 'implemented'
    && p.mechanism === 'tileBonus' && (p.params.tile === tileType || (p.params.tiles || []).includes(tileType)));
}

/** 获得激励点数时的额外加成（里尔亚斯：+1） */
export function motivationBonus(state, seatId) {
  let bonus = 0;
  for (const p of activePassives(state, seatId)) {
    if (p.status !== 'implemented') continue;
    if (p.mechanism === 'motivationBonus') bonus += p.params.amount || 0;
  }
  return bonus;
}

/* ============================================================================
 * 2026-09-26 作者重做的 8 位角色的机制（**卡面即内容真源**）
 * ----------------------------------------------------------------------------
 * 这些机制原先散落在旧引擎的 `processCharacterPassives` / `runOneOp` 里按角色名硬编；
 * 重做后卡面文本变了，这里按**卡面**重新落成可测的纯函数（内容层声明见 content/abilities.json）。
 * ========================================================================== */

/** 入间予：每进行一次投掷后回复自身 1 点音韵值 */
export function afterRollEffects(state, seatId) {
  const out = [];
  for (const p of activePassives(state, seatId)) {
    if (p.status === 'implemented' && p.mechanism === 'afterRollGainCost') {
      out.push({ type: 'gainCost', seat: seatId, amount: p.params.amount || 1, reason: p.id, label: p.params.label });
    }
  }
  return out;
}

/** 小野伊织：每次投掷结果出现时可以在其和 2 中选一项作为最终结果 */
export function diceChoiceOptions(state, seatId) {
  const opts = [];
  for (const p of activePassives(state, seatId)) {
    if (p.status === 'implemented' && p.mechanism === 'diceChoice') opts.push(...(p.params.options || []));
  }
  return [...new Set(opts)];
}

/** 小野伊织：一次性抽取两张卡的场合可以发动，抽一张并回复自身 1 点音韵值 */
export function drawTwoBonus(state, seatId, n) {
  if (!n || n < 2) return null;
  for (const p of activePassives(state, seatId)) {
    if (p.status === 'implemented' && p.mechanism === 'drawTwoBonus') return { ...p.params, id: p.id };
  }
  return null;
}

/** 枫(水着)：使用理智属性的卡造成伤害后追加 1 段 1 点理智伤害，那之后可以前进 1-3 格 */
export function sanityFollowUp(state, seatId, ctx = {}) {
  const attr = (ctx.card && ctx.card.attribute) || ctx.attr || null;
  if (attr !== '理智') return null;
  for (const p of activePassives(state, seatId)) {
    if (p.status === 'implemented' && p.mechanism === 'sanityFollowUp') return { ...p.params, id: p.id };
  }
  return null;
}

/** 松山惠：音律感应 —— 记录最近使用的 3 张牌的音韵值并按编排执行乐曲 */
export function musicSequenceCheck(state, seatId, cost) {
  const seat = state.seats[seatId];
  if (!seat) return null;
  const p = activePassives(state, seatId).find((x) => x.status === 'implemented' && x.mechanism === 'musicSequence');
  if (!p) return null;
  const seq = Array.isArray(seat.statuses.musicSeq) ? seat.statuses.musicSeq.slice() : [];
  seq.push(Number(cost) || 0);
  const win = seq.slice(-3);
  if (win.length < 3) { seat.statuses.musicSeq = win; return null; }
  const [a, b, c] = win;
  const special = p.params.special || [];
  const piece = (special.length === 3 && a === special[0] && b === special[1] && c === special[2]) ? 'γ'
    : (a === b && b === c) ? 'δ'
      : (a < b && b < c) ? 'α'
        : (a > b && b > c) ? 'β' : null;
  // 卡面：「那之后保留最后一张牌的音韵值并重新编排旋律」
  seat.statuses.musicSeq = [c];
  if (!piece) return null;
  return { piece, ops: (p.params.pieces || {})[piece] || [], id: p.id, seq: win };
}

/** 入间予：准备阶段结束时公开手卡，按数量最多的属性执行对应效果 */
export function prepareMajority(state, seatId) {
  const seat = state.seats[seatId];
  if (!seat) return null;
  const p = activePassives(state, seatId).find((x) => x.status === 'implemented' && x.mechanism === 'prepareMajority');
  if (!p) return null;
  const counts = {};
  for (const card of seat.hand || []) {
    const a = (card && (card.attribute || (card.fields && card.fields.attribute))) || null;
    if (a) counts[a] = (counts[a] || 0) + 1;
  }
  const order = Object.keys(p.params.branches || {});
  let best = null, bestN = 0;
  for (const a of order) if ((counts[a] || 0) > bestN) { best = a; bestN = counts[a] || 0; }
  if (!best) return null;                       // 手卡没有带属性的卡 ⇒ 无从"按属性"判定
  return { attr: best, count: bestN, counts, ops: p.params.branches[best] || [], id: p.id, label: p.params.label };
}

/** 小野葵：福音雅颂 —— 有玩家同回合第二次投掷后（一轮内每名玩家限一次） */
export function secondRollGiftOffer(state, seatId, rollerId) {
  const p = activePassives(state, seatId).find((x) => x.status === 'implemented' && x.mechanism === 'secondRollGift');
  if (!p) return null;
  const seat = state.seats[seatId];
  const key = 'gospelRound:' + rollerId;
  if (seat.statuses[key]) return null;
  const rolls = state.seats[rollerId] ? (state.seats[rollerId].statuses.rollCountTurn || 0) : 0;
  if (rolls < 2) return null;
  return { ...p.params, id: p.id, roller: rollerId };
}

/** 琉璃(水着)：使用热忱属性的卡后的效果（含"一回合一次"的抽 1 + 下次热忱最终伤害 +1） */
export function fervorFollowUpOffer(state, seatId, ctx = {}) {
  const attr = (ctx.card && ctx.card.attribute) || null;
  if (attr !== '热忱') return null;
  for (const p of activePassives(state, seatId)) {
    if (p.status === 'implemented' && p.mechanism === 'fervorFollowUp') {
      const seat = state.seats[seatId];
      const key = 'fervorFollowUsed:' + p.id;
      const used = !!p.params.oncePerTurn && seat.statuses[key] === state.turn;
      return { ...p.params, id: p.id, oncePerTurnUsed: used };
    }
  }
  return null;
}

/** "下次造成的某属性最终伤害 +N"：登记 */
export function registerNextDamagePlus(state, seatId, attr, amount, id) {
  const seat = state.seats[seatId];
  seat.statuses['nextDmgPlus:' + attr] = (seat.statuses['nextDmgPlus:' + attr] || 0) + (amount || 0);
  if (id) seat.statuses['nextDmgPlusUsed:' + id] = state.turn;
}

/** "下次造成的某属性最终伤害 +N"：消费（返回加值并清零） */
export function consumeNextDamagePlus(state, seatId, attr) {
  const seat = state.seats[seatId];
  const key = 'nextDmgPlus:' + attr;
  const v = seat.statuses[key] || 0;
  if (v) delete seat.statuses[key];
  return v;
}

/** 可发动能力（琉璃(万圣祭)：支付 3 同步回收自己效果处理区的一张永续卡） */
export function activatedAbilitiesFor(state, seatId) {
  return activePassives(state, seatId)
    .filter((p) => p.status === 'implemented' && p.mechanism === 'activatedAbility')
    .map((p) => ({ id: p.id, card: p.card, cost: p.params.cost || {}, ops: p.params.ops || [], label: p.params.label }));
}
