/**
 * 入局者 v2 · 对局自跑（引擎侧，无 fs / 无 DOM）
 * ---------------------------------------------------------------------------
 * 作用有两个：
 *   ① **证明引擎能打完一局**（P4 的验收：不再是"只能跑规则函数"）
 *   ② 给 P5 的 AI 一个可替换的决策源（这里先用最朴素的桩：能出就出、能连锁就放弃）
 *
 * 卡数据由调用方传入（工具层从 content 读），所以引擎保持零 fs。
 */

import { createState, validateState, busyReason, othersOf } from './state.js';
import { createRNG } from './rng.js';
import { startTurn, advancePhase, endTurn } from './flow.js';
import { playCard, driveToIdle } from './play.js';
import { legality } from './offer.js';
import { TIMING } from './timing/points.js';
import { openTimingIfAny } from './timing/bus.js';
import { setupPublicDecks } from './rules/tiles.js';
import { runWindow } from './window.js';
import { answerDecision } from './decision.js';

/**
 * 朴素决策桩（P5 会换成真正的 AI）：连锁一律 PASS，**选择取第一项**。
 * 注：我曾据两处案例（【智能手机】【结晶碎弧】旧 AI 都选了②）推断"旧 AI 取最后一个选项"并据此改桩，
 * 结果宽样本 65→56、默认样本 23→20 —— **两次观测不足以概括策略**，已回滚。
 * 这类"两个引擎选了不同选项"的差异归入"答案源策略"，不当作引擎 bug（见 DIFF_NOTES）。
 */
export function stubAnswer(decision) {
  switch (decision.kind) {
    case 'chain': return 'pass';
    case 'choice': return 0;
    case 'pickCards': return [0];
    case 'pickList': return [0];
    default: return 0;
  }
}

function pickPlayable(state, seatId, pool) {
  for (const card of pool) {
    if (!(state.seats[seatId].hand || []).includes(card)) continue;
    const v = legality(state, seatId, card, {});
    if (v.ok) return card;
  }
  return null;
}

/**
 * @param {object} opts
 *   cards       卡池（content 里读出来的卡对象数组）
 *   seed        随机种子（必填，保证可复现）
 *   turns       最多几个回合
 *   answer      决策源（默认 stubAnswer）
 */
export function runSelfTest(opts = {}) {
  const seed = opts.seed ?? 20260926;
  const maxTurns = opts.turns ?? 6;
  const cards = (opts.cards || []).filter((c) => c && c.category !== 'emojis');
  // 卡对象在内容层里同时有 `category`（导入器）与 `_category`（旧引擎遗留）；两种都认
  const byCat = (cat) => cards.filter((c) => (c.category || c._category) === cat);
  const answer = opts.answer || stubAnswer;

  const state = createState({ seed });
  const rng = createRNG(seed);
  // 公共牌堆（馈赠/乐谱/事件/御神签）：地图格效果要用（§7）
  setupPublicDecks(state, cards, rng);
  for (const id of state.seatIds) {
    const seat = state.seats[id];
    seat.maxSync = 30; seat.sync = 30; seat.maxCost = 12; seat.cost = 5;
    seat.teamAttribute = '无序';
    // 简易卡组：单次道具 + 一张永续 + 一张技能（内容来自 content/cards）
    seat.deck = [
      ...byCat('item_single').slice(0, 8),
      ...byCat('item_permanent').slice(0, 2),
      ...byCat('skill_cards').slice(0, 2),
    ].map((c) => ({ ...c }));
    for (let i = 0; i < 4 && seat.deck.length; i++) seat.hand.push(seat.deck.shift());
  }

  const report = { seed, turns: 0, played: [], decisions: 0, events: 0, timings: [], problems: [] };
  const driveOpts = {
    answer: (d) => {
      report.decisions += 1;
      return answer(d);
    },
  };

  try {
    for (let turn = 1; turn <= maxTurns; turn++) {
      const seatId = state.currentPlayer;
      report.events += startTurn(state).length;
      report.timings.push(TIMING.ON_DRAW);

      // 准备 → 主要1：出一张能出的牌（没有就跳过）
      advancePhase(state);
      const seat = state.seats[seatId];
      const card = pickPlayable(state, seatId, seat.hand.slice());
      if (card) {
        const r = playCard(state, seatId, card, { ...driveOpts, rng, target: othersOf(state, seatId)[0] });
        if (r.ok) report.played.push(card.name);
        else report.problems.push(`出牌被拒：${card.name} —— ${r.reason}`);
        if (r.pending) {
          const d = driveToIdle(state, driveOpts);
          if (!d.done) report.problems.push(`出牌后窗口未关闭：${d.pending && d.pending.kind}`);
        }
      }

      // 主要1 → 投掷 → 主要2 → 结束
      advancePhase(state);
      const rollOp = [{ op: 'move_by_roll', sides: 6 }];
      const { executeOps } = opts.__ops || {};
      // 投掷阶段：直接用 ops 里的 move_by_roll（引擎内唯一位移出口）
      const opsMod = opts.__opsModule;
      if (opsMod) {
        const r = opsMod.executeOps(state, { seat: seatId, rng }, rollOp);
        report.events += r.events.length;
      }
      advancePhase(state);
      report.events += endTurn(state).length;
      report.turns = turn;

      if (state.seats[seatId].sync <= 0) break;
    }

    // 收尾：任何还开着的窗口都要么关掉、要么明确作废
    const idle = driveToIdle(state, driveOpts);
    if (!idle.done) report.problems.push('收尾时窗口仍未关闭');
    const busy = busyReason(state);
    if (busy) report.problems.push('收尾时引擎仍忙：' + busy);
    // 引擎内部异常**必须报红**：窗口的"单节点异常只跳该节点"是给"卡牌数据有问题"用的兜底，
    // 但它会把**引擎自己的 op bug** 也吞成"效果不适用"（本批就抓到 `knock_off` 调了不存在的 rng.int）。
    // 自跑里出现 chainError 就是 bug，不许静默。
    for (const e of state.log.filter((x) => x.type === 'chainError')) report.problems.push('引擎内部异常被吞掉：' + e.text);
    const invalid = validateState(state);
    if (invalid.length) report.problems.push(...invalid.map((p) => '状态不合法：' + p));
  } catch (e) {
    report.problems.push('自跑抛错：' + e.message);
  }

  report.ok = report.problems.length === 0;
  report.final = {
    p1: { sync: state.seats.p1.sync, cost: state.seats.p1.cost, position: state.seats.p1.position, hand: state.seats.p1.hand.length, grave: state.seats.p1.grave.length },
    p2: { sync: state.seats.p2.sync, cost: state.seats.p2.cost, position: state.seats.p2.position, hand: state.seats.p2.hand.length, grave: state.seats.p2.grave.length },
  };
  report.state = state;
  return report;
}

/** 打开一个时点窗口并把它的候选跑完（给"事件驱动的时点"用；P5 的 AI 也走这里） */
export function fireTiming(state, point, ctx, opts = {}) {
  const win = openTimingIfAny(state, point, ctx);
  if (!win) return { opened: false, events: [] };
  const r = runWindow(state, opts);
  if (!r.done && typeof opts.answer === 'function') {
    answerDecision(state, r.pending.id, opts.answer(r.pending));
    const r2 = runWindow(state, opts);
    return { opened: true, events: [...r.events, ...r2.events] };
  }
  return { opened: true, events: r.events };
}
