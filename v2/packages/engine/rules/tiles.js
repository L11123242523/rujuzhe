/**
 * 入局者 v2 · 地图格结算（规则书 §7.5 与附录B）
 * ---------------------------------------------------------------------------
 * 规则书 §7.5.3 原文：**"因任何效果移动/后退而落到某格，都要立即结算该格效果。"**
 * 这一整块此前在新引擎里是缺的 —— 直到 P4c 做逐卡取证时才发现它就是挡住多张卡的东西：
 *   【钢筋铁肘】的旧 delta 里那些 gold/level/motivation 变化，其实是
 *   "前进5格 → 落在公交站 → 付200金币、投四面骰前进3格 → 落在 Story → 抽乐谱卡 → +2激励 → 连升3级"。
 *
 * 设计：**公共牌堆是状态**（`state.publicDecks`），格子结算在唯一位移出口 `apiMove` 之后调用；
 * 交互格（可选择不执行）走决策源，非交互格必须执行。连锁位移有深度上限（防自触发）。
 */

import { RULES } from './constants.js';
import { tileAt, moveSeat } from './map.js';
import { gainCost, gainGold } from './resources.js';
import { gainMotivation } from './levels.js';
import { executeOps } from '../ops/index.js';
import { flattenCardOps } from '../window.js';
import { tileBonusPassives, giftPoolFilters, motivationBonus } from '../abilities.js';

const MAX_CHAIN = 4;   // 一次位移引发的连续格子结算上限（公交站→Story→…）

/** 初始化公共牌堆（构建期内容 → 运行期状态） */
export function setupPublicDecks(state, cards, rng) {
  const byCat = (cat) => (cards || []).filter((c) => (c.category || c._category) === cat);
  state.publicDecks = {
    // 馈赠卡池顺序**照旧引擎的硬编数组**（13556-13563）：200$ / 500$ / 1000$ / Noise(>10) / Noise(≤10) / 和声
    // —— 顺序会影响"取第 N 张"的可复现性（对拍时尤其重要）
    gift: ['200$', '500$', '1000$', 'Noise(>10)', 'Noise(≤10)', '和声']
      .map((n) => byCat('gift_cards').find((c) => c.name === n || c.name.includes(n.replace(/[()$]/g, ''))))
      .filter(Boolean)
      .map((c) => ({ ...c })),
    music: RULES.music.order
      .map((n) => byCat('music_cards').find((c) => c.name.includes(n)))
      .filter(Boolean)
      .map((c) => ({ ...c })),
    event: rng ? rng.shuffled(byCat('event_cards').map((c) => ({ ...c }))) : byCat('event_cards').map((c) => ({ ...c })),
    omikuji: [],
  };
  // 御神签 12 张堆：按 §7.4.2 的构成
  for (const [face, count] of Object.entries(RULES.omikuji.composition)) {
    const card = byCat('omikuji').find((c) => c.name.includes(face));
    for (let i = 0; i < count; i++) if (card) state.publicDecks.omikuji.push({ ...card });
  }
  if (rng) state.publicDecks.omikuji = rng.shuffled(state.publicDecks.omikuji);
  return state.publicDecks;
}

/**
 * 公共卡结算：**走同一条 ops 路径**（P2 的单路径在这里直接兑现）——
 * 馈赠/乐谱/事件/御神签四类卡在构建期都编译出了 ops（实测：200$→gain_gold、
 * 序幕→gain_motivation+choice、大吉→judge_branch…），所以不需要在引擎里再写一遍它们的语义。
 *
 * 需要人作答时用 `opts.answer`；**没有答案源**就如实发一个 `publicCardPending` 事件（不静默、不猜）。
 */
export function resolvePublicCard(state, seatId, card, opts = {}) {
  if (!card) return [];
  const ops = flattenCardOps(card);
  const events = [{ type: 'publicCard', seat: seatId, card, opCount: ops.length }];
  if (!ops.length) {
    events.push({ type: 'publicCardEmpty', seat: seatId, card: card.name, note: '这张公共卡没有可执行的 ops（需人工裁决）' });
    return events;
  }
  const target = opts.target || state.seatIds.find((id) => id !== seatId) || seatId;
  const r = executeOps(state, { seat: seatId, target, card, rng: opts.rng, answer: opts.answer }, ops);
  if (r.pending) {
    events.push({ type: 'publicCardPending', seat: seatId, card: card.name, kind: r.pending.kind, note: '需要决策但没有答案源：本张公共卡未结算' });
    return events;
  }
  events.push(...r.events);
  // 获得时的激励点数（卡面右上角数字 = `inspire` 字段）：
  //   · 乐谱/御神签的激励**已经编在它自己的 ops 里**（"获得时立即给予2点激励点数"是卡面文本的一部分）；
  //   · 馈赠卡不是（它的 ops 只有"获得200金币"这类**效果**），所以要在**获得时**另给。
  // 判据：本卡 ops 里没有 gain_motivation 时才补发 —— 避免与 ops 重复计算。
  const opsHaveMotivation = ops.some((o) => o.op === 'gain_motivation' || (o.branches || []).some((b) => (b || []).some((x) => x.op === 'gain_motivation')));
  if (card.inspire && !opsHaveMotivation) {
    const seat = state.seats[seatId];
    const bonus = motivationBonus(state, seatId);        // 里尔亚斯被动：获取激励额外 +1
    events.push(...gainMotivation(seat, card.inspire + bonus));
    events.push({ type: 'gainMotivation', seat: seatId, amount: card.inspire + bonus, bonus, reason: 'publicCardAcquire:' + card.name });
  }
  return events;
}

function takeFrom(deck, pick) {
  if (!deck || !deck.length) return null;
  if (typeof pick === 'number') return deck.splice(pick, 1)[0];
  return deck.shift();
}

/** 抽一张馈赠卡（§7.1.3：每 6 次必出 1 张「和声」）并**立即结算**其效果 */
export function drawGift(state, seatId, rng, opts = {}) {
  const seat = state.seats[seatId];
  const decks = state.publicDecks;
  // 卡池过滤（【共鸣者】"只要此卡以正面形式存在区域内…卡池中不会出现[200$]"等）：由能力声明提供
  const excluded = giftPoolFilters(state, seatId);
  const pool = decks.gift.filter((c) => !excluded.some((x) => c.name.includes(x)));
  // 卡池为空（未配置公共牌堆 / 全被过滤）⇒ 如实记事件并返回，**不抛错**（踩过一次：落地到馈赠格时抛 TypeError）
  if (!pool.length) return { card: null, events: [{ type: 'giftEmpty', seat: seatId, excluded }] };
  // 保底（旧引擎 13588-13593 的逐字口径）：**连续 6 次未中和声 → 第 6 次"附赠"一张和声**（不是替换！），
  //   · 中途抽到和声 ⇒ 计数清零
  //   · 触发附赠 ⇒ 计数清零
  seat.counters.giftStreak = (seat.counters.giftStreak || 0) + 1;
  const card = rng ? rng.pick(pool) : pool[0];
  if (!card) return null;
  const isHarmony = card.name.includes('和声');
  const guaranteed = !isHarmony && seat.counters.giftStreak >= RULES.gift.pityEvery;
  if (isHarmony || guaranteed) seat.counters.giftStreak = 0;
  const events = [{ type: 'gift', seat: seatId, card }];
  events.push(...resolvePublicCard(state, seatId, card, { ...opts, rng }));
  if (guaranteed) {
    const bonusCard = pool.find((c) => c.name.includes('和声'));
    if (bonusCard) {
      events.push({ type: 'giftPity', seat: seatId, card: bonusCard, note: '连续 6 次未中和声 ⇒ 第 6 次附赠' });
      events.push(...resolvePublicCard(state, seatId, bonusCard, { ...opts, rng }));
    }
  }
  return { card, events };
}

function drawEvent(state, seatId, opts = {}) {
  const seat = state.seats[seatId];
  const card = takeFrom(state.publicDecks.event);
  if (!card) return null;
  seat.eventCards.push(card);
  return { card, events: [{ type: 'eventCard', seat: seatId, card }].concat(resolvePublicCard(state, seatId, card, opts)) };
}

function drawMusic(state, seatId, opts = {}) {
  const seat = state.seats[seatId];
  const card = takeFrom(state.publicDecks.music);
  if (!card) return null;
  seat.musicCards.push(card);
  return { card, events: [{ type: 'musicCard', seat: seatId, card }].concat(resolvePublicCard(state, seatId, card, opts)) };
}

function drawOmikuji(state, seatId, rng, opts = {}) {
  const card = rng ? rng.pick(state.publicDecks.omikuji) : takeFrom(state.publicDecks.omikuji);
  if (!card) return null;
  return { card, events: [{ type: 'omikuji', seat: seatId, card }].concat(resolvePublicCard(state, seatId, card, { ...opts, rng })) };
}

/**
 * 结算落点格（§7.5.3）。返回事件清单；交互格若没有答案源则"不执行"并如实记录。
 * @param {object} opts { rng, answer, depth }
 */
export function resolveTile(state, seatId, opts = {}) {
  const depth = opts.depth || 0;
  if (depth > MAX_CHAIN) return { events: [{ type: 'tileChainLimit', seat: seatId }] };
  const seat = state.seats[seatId];
  const tile = tileAt(seat.position);
  const rule = RULES.tiles[tile.type] || {};
  const events = [{ type: 'tile', seat: seatId, tile: tile.type, label: tile.name, depth }];
  const push = (r) => { if (r) events.push(...r); };

  // 交互格：可选择不执行（没有答案源时按"不执行"处理，但**如实记录**）
  if (rule.interactive) {
    const want = typeof opts.answer === 'function'
      ? opts.answer({ kind: 'choice', seat: seatId, options: ['执行格效果', '不执行'], reason: `到达【${tile.name}】：${rule.note || ''}` }) === 0
      : false;
    events.push({ type: 'tileChoice', seat: seatId, tile: tile.type, taken: want });
    if (!want) return { events };
  }

  switch (tile.type) {
    case 'start':
      break; // 经过/到达的奖励由位移出口按 moveSeat 的事件发放
    case 'gift':
      push(drawGift(state, seatId, opts.rng, opts)?.events);
      break;
    case 'card':
      push(drawEvent(state, seatId, opts)?.events);
      break;
    case 'read':
      push(drawEvent(state, seatId, opts)?.events);
      push(drawEvent(state, seatId, opts)?.events);
      break;
    case 'story':
      push(drawMusic(state, seatId, opts)?.events);
      break;
    case 'inspire': {
      const gained = gainCost(seat, rule.gainCost || 3);
      events.push({ type: 'gainCost', seat: seatId, amount: gained, reason: 'inspire' });
      events.push(...gainMotivation(seat, rule.gainMotivation || 1));
      break;
    }
    case 'bus':
    case 'subway': {
      const cost = rule.cost || 200;
      if ((seat.gold || 0) < cost) { events.push({ type: 'tileSkip', seat: seatId, reason: '金币不足，无法乘车' }); break; }
      gainGold(seat, -cost);
      const roll = opts.rng ? opts.rng.dice(4) : 1;
      events.push({ type: 'tilePay', seat: seatId, gold: cost, roll, reason: tile.type });
      const mv = moveSeat(seat, roll);
      events.push(...mv.events);
      const inner = resolveTile(state, seatId, { ...opts, depth: depth + 1 });
      events.push(...inner.events);
      break;
    }
    case 'shrine': {
      const cost = rule.cost || 2000;
      if ((seat.gold || 0) < cost) { events.push({ type: 'tileSkip', seat: seatId, reason: '金币不足，无法参拜' }); break; }
      gainGold(seat, -cost);
      events.push({ type: 'tilePay', seat: seatId, gold: cost, reason: 'shrine' });
      push(drawOmikuji(state, seatId, opts.rng, opts)?.events);
      // 角色被动对格子的加成（【小野伊织】SP：到达神社回 5 音韵并抽 1 张馈赠卡）
      for (const p of tileBonusPassives(state, seatId, 'shrine')) {
        if (p.params.gainCost) {
          const got = gainCost(seat, p.params.gainCost);
          events.push({ type: 'gainCost', seat: seatId, amount: got, reason: p.id });
        }
        for (let i = 0; i < (p.params.drawGift || 0); i++) push(drawGift(state, seatId, opts.rng, opts)?.events);
        events.push({ type: 'passiveTrigger', label: p.params.label || p.id });
      }
      break;
    }
    case 'game': {
      const cost = rule.cost || 500;
      if ((seat.gold || 0) < cost) { events.push({ type: 'tileSkip', seat: seatId, reason: '金币不足，无法游玩' }); break; }
      gainGold(seat, -cost);
      const face = opts.rng ? (opts.rng.coin() ? '正' : '反') : '正';
      events.push({ type: 'tilePay', seat: seatId, gold: cost, coin: face, reason: 'game' });
      if (face === '正') { push(drawEvent(state, seatId, opts)?.events); push(drawEvent(state, seatId, opts)?.events); }
      break;
    }
    case 'item':
      events.push({ type: 'tilePending', seat: seatId, tile: 'item', note: '易物：送 1 张卡入墓抽 1 / 付 500 金币抽 1（待 P4c 实现）' });
      break;
    case 'power':
      events.push({ type: 'tilePending', seat: seatId, tile: 'power', note: '配电室：关闭/开启 1 格（待 P4c 实现）' });
      break;
    case 'airport':
      events.push({ type: 'tilePending', seat: seatId, tile: 'airport', note: '机场：下个主要阶段开始时可前进到任意 1 格（待 P4c 实现）' });
      break;
    case 'again':
      events.push({ type: 'tilePending', seat: seatId, tile: 'again', note: 'Again：以 1/3/5 点到达可再投一次（待投掷阶段实现）' });
      break;
    default:
      events.push({ type: 'tileUnknown', seat: seatId, tile: tile.type });
  }
  return { events };
}
