/**
 * 入局者 v2 · 整局驱动（P5）
 * ---------------------------------------------------------------------------
 * 把"一局游戏"需要的设置与推进集中在一处，AI 与将来的 UI **共用**它：
 *   · `createGame()`：按内容建两个座位（队长 + 队员 + 卡组 + 起手 + 公共牌堆）
 *   · `playGame()`：AI 对 AI 打到分出胜负或到回合上限，并返回**完整审计**（每回合出了什么牌、
 *     有没有卡死、引擎有没有内部异常）
 *
 * 与 `engine/selftest.js` 的区别：selftest 只要求"引擎不卡死"，这里要求"**AI 能真的玩完一局**"。
 */

import { createState, validateState, busyReason, othersOf } from '../engine/state.js';
import { createRNG } from '../engine/rng.js';
import { startTurn, advancePhase, endTurn } from '../engine/flow.js';
import { playCard, driveToIdle } from '../engine/play.js';
import { legality } from '../engine/offer.js';
import { setupPublicDecks } from '../engine/rules/tiles.js';
import { RULES } from '../engine/rules/constants.js';
import { applyStartOfGame } from '../engine/abilities.js';
import { createAI } from './index.js';

const START = { sync: 30, maxSync: 38, cost: 5, maxCost: 12, gold: 5000, motivation: 0, level: 1 };

/** 这张卡能不能造成伤害（看编译好的 ops；没有 ops 就看文本里有没有"伤害/击碎"） */
function dealsDamage(card) {
  const ops = card.ops && card.ops.main ? card.ops.main.flatMap((s) => s.ops || []) : [];
  if (ops.some((o) => o && (o.op === 'damage' || o.op === 'damage_multi' || o.op === 'damage_by_removed'))) return true;
  return /造成|伤害|击碎/.test(String(card.effect || ''));
}

/**
 * 按规则书 §2.1 组卡组：**8 张道具卡 + 4 张角色携带卡**
 *   · 道具：优先单次道具；§2.3 的配额（2 张无序 + 每名非混沌角色 2 张同属性）这里是"尽量满足"，
 *     牌池不够时就按可用牌补齐并**如实记录缺口**（不假装满足）
 *   · 携带卡：只放**队里角色**的攻击卡/技能卡（角色绑定由 legality 再拦一道）
 */
export function buildDeck(cards, roster) {  const notes = [];
  const itemsAll = cards.filter((c) => ['item_single', 'item_permanent'].includes(String(c.category)));
  const carriesAll = cards.filter((c) => ['attack_cards', 'skill_cards'].includes(String(c.category)));
  const ownCarries = carriesAll.filter((c) => {
    const owner = c.character_full || c.character || '';
    if (!owner || !roster.length) return !owner;
    return roster.some((n) => String(owner).includes(n.replace(/[（）()]/g, '')) || n.includes(String(owner).replace(/[（）()]/g, '')));
  });
  const damage = itemsAll.filter(dealsDamage);
  const wantDamage = Math.min(4, Math.max(2, Math.floor(RULES.deck.items / 2)));
  const pickedDamage = damage.slice(0, wantDamage);
  const rest = itemsAll.filter((c) => !pickedDamage.includes(c));
  // 先放伤害牌，**再用剩下的道具（含没被选中的伤害牌）填满 8 张**
  const items = [...pickedDamage, ...rest].slice(0, RULES.deck.items);
  if (damage.length < wantDamage) notes.push(`能造成伤害的道具只有 ${damage.length} 张（想要 ${wantDamage} 张）`);
  const carries = (ownCarries.length >= RULES.deck.carries ? ownCarries : carriesAll).slice(0, RULES.deck.carries);
  if (items.length < RULES.deck.items) notes.push(`道具不足：只有 ${items.length}/${RULES.deck.items} 张`);
  if (carries.length < RULES.deck.carries) notes.push(`携带卡不足：只有 ${carries.length}/${RULES.deck.carries} 张`);
  return { deck: [...items, ...carries].map((c) => ({ ...c })), notes };
}

/**
 * 建一局。
 * @param {object} opts { cards, seed, teams: [[队长, 队员...], [...] ] }
 */
export function createGame(opts = {}) {
  const cards = (opts.cards || []).filter((c) => c && c.category !== 'emojis');
  const seed = opts.seed ?? 20260926;
  const teams = opts.teams || [['现实间冬马', '入间予', '小野葵'], ['入间予', '枫(水着)', '小野伊织']];
  const state = createState({ seed });
  const rng = createRNG(seed);
  setupPublicDecks(state, cards, rng);
  const deckNotes = [];

  state.seatIds.forEach((id, i) => {
    const seat = state.seats[id];
    Object.assign(seat, { ...START });
    const team = teams[i % teams.length].filter(Boolean);
    const chars = team.map((n) => cards.find((c) => c.category === 'characters' && c.name === n)).filter(Boolean);
    seat.captain = chars[0] ? { name: chars[0].name } : (team[0] ? { name: team[0] } : null);
    seat.teamNames = chars.slice(1).map((c) => c.name);
    seat.teamAttribute = (chars[0] && chars[0].attribute) || '无序';
    const roster = [...new Set([seat.captain && seat.captain.name, ...seat.teamNames].filter(Boolean))];
    const built = buildDeck(cards, roster);
    seat.deck = built.deck;
    deckNotes.push(...built.notes.map((n) => `${id}：${n}`));
    // 起手按 §2.5 = 4 张（随后每回合准备阶段抽 1 ⇒ 第一回合手牌 5 张）
    const initial = RULES.deck.initialHand || 4;
    for (let k = 0; k < initial; k++) { const c = seat.deck.shift(); if (c) seat.hand.push(c); }
    applyStartOfGame(state, id);
  });

  const api = {
    state,
    startTurn,
    advancePhase,
    endTurn,
    playCard,
    driveToIdle,
    legality,
    otherSeat: (st, id) => othersOf(st, id)[0],
  };
  const ais = state.seatIds.map((id) => createAI({ seat: id, chainPolicy: 'aggressive' }));
  return { state, api, ais, rng, deckNotes };
}

/**
 * 让两个 AI 打完一局。
 * @returns {{ok, turns, winner, log, problems, final}}
 */
export function playGame(opts = {}) {
  const maxTurns = opts.maxTurns ?? 30;
  const { state, api, ais } = createGame(opts);
  const problems = [];
  const log = [];
  let turns = 0;
  let winner = null;

  try {
    while (turns < maxTurns) {
      const seatId = state.currentPlayer;
      const ai = ais[state.seatIds.indexOf(seatId)];
      const r = ai.takeTurn(api);
      turns++;
      log.push(`回合 ${turns}：${seatId} 出了 ${r.played.length ? r.played.join('、') : '（无）'}`);
      // 每回合都检查"有没有卡死/状态是否合法"——不是等到最后才检查
      if (state.window) problems.push(`回合 ${turns}：${seatId} 结束时窗口未关闭`);
      const busy = busyReason(state);
      if (busy) problems.push(`回合 ${turns}：引擎仍忙（${busy}）`);
      const inv = validateState(state);
      if (inv.length) problems.push(`回合 ${turns}：状态不合法 —— ${inv.slice(0, 2).join('；')}`);
      for (const e of state.log.filter((x) => x.type === 'chainError')) problems.push(`回合 ${turns}：内部异常被吞 —— ${e.text}`);
      const dead = state.seatIds.find((id) => (state.seats[id].sync || 0) <= 0);
      if (dead) { winner = state.seatIds.find((id) => id !== dead) || null; log.push(`${dead} 同步值归零 ⇒ ${winner} 获胜`); break; }
    }
  } catch (e) {
    problems.push('对局抛错：' + e.message);
  }

  return {
    ok: problems.length === 0,
    turns,
    winner,
    log,
    problems,
    final: Object.fromEntries(state.seatIds.map((id) => [id, {
      sync: state.seats[id].sync, cost: state.seats[id].cost, hand: state.seats[id].hand.length,
      grave: state.seats[id].grave.length, permanent: state.seats[id].permanent.length, position: state.seats[id].position,
    }])),
  };
}
