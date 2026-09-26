/**
 * 入局者 v2 · AI（P5）
 * ---------------------------------------------------------------------------
 * 架构约束（《重做方案》E1）：**AI 只能用引擎的公开接口**，与将来的 UI 走同一套调用方式 ——
 * 这样"AI 能打完一局"就等于"UI 也能把一局打完"，不需要两套驱动。
 *
 * 它只做三件事：
 *   ① `answerDecision`：应答引擎抛出的**决策**（连锁询问 / 选择 / 选卡）
 *   ② `chooseCard`：在可出的牌里挑一张（或不出）
 *   ③ `takeTurn`：把一个回合从头走到尾（准备→主要1→投掷→主要2→结束）
 *
 * 策略是**启发式 + 确定性**（同样的局面永远给同样的答案）：不引入随机，便于测试与复现；
 * 真正的"聪明"留给以后调权重，接口不变。
 */

import { PHASES } from '../engine/phases.js';

/* ── 卡牌价值（用于弃牌/检索/选卡）────────────────────────────────────────── */
/** 越大越"舍不得丢"：费用高、有 ops、是攻击/技能卡、是永续卡 */
export function cardValue(card) {
  if (!card) return -1;
  let v = Number(card.cost) || 0;
  const cat = String(card._category || card.category || '');
  if (cat.includes('permanent')) v += 3;
  if (cat.includes('attack')) v += 2;
  if (cat.includes('skill')) v += 2;
  const ops = card.ops && card.ops.main ? card.ops.main.flatMap((s) => s.ops || []) : [];
  v += Math.min(ops.length, 3);
  return v;
}

/** 选项价值（用于 `choice`）：按关键词打分，得分相同取靠前的选项 */
export function optionScore(label) {
  const s = String(label || '');
  let v = 0;
  if (/造成|伤害|击碎/.test(s)) v += 4;
  if (/回复|治疗|回\d/.test(s)) v += 3;
  if (/抽|检索|加入手卡/.test(s)) v += 3;
  if (/引导核心|激励/.test(s)) v += 2;
  if (/前进|移动/.test(s)) v += 1;
  if (/不发动|放弃|取消/.test(s)) v -= 5;
  return v;
}

/** 这张卡能不能造成伤害（看 ops，其次看文本）—— 决策要"有威胁优先" */
export function dealsDamage(card) {
  if (!card) return false;
  const flat = (steps) => (steps || []).flatMap((s) => (s && s.ops) || []);
  const ops = card.ops ? [...flat(card.ops.main), ...flat(card.ops.sp)] : [];
  if (ops.some((o) => o && ['damage', 'damage_multi', 'damage_by_removed'].includes(o.op))) return true;
  return /造成|击碎|判定伤害/.test(String(card.effect || ''));
}

/**
 * 创建 AI。
 * @param {object} opts { seat, seed, chainPolicy:'pass'|'aggressive', maxPlaysPerTurn, log }
 */
export function createAI(opts = {}) {
  const policy = {
    seat: opts.seat || null,
    chainPolicy: opts.chainPolicy || 'pass',
    maxPlaysPerTurn: opts.maxPlaysPerTurn ?? 4,
    ...opts,
  };
  const trace = [];
  const log = (s) => { trace.push(s); if (policy.log) policy.log(s); };

  /** 应答一个决策（引擎的 `decision` 是纯数据） */
  function answerDecision(decision) {
    if (!decision) return 0;
    switch (decision.kind) {
      case 'chain': {
        const cands = decision.candidates || [];
        if (!cands.length) return 'pass';
        if (policy.chainPolicy !== 'aggressive') { log('连锁：保守策略 → PASS'); return 'pass'; }
        // 激进策略：能付得起、且是伤害类才入链
        const usable = cands.filter((c) => !c.chainKind || /damage|negate/.test(JSON.stringify(c.card || {})));
        if (!usable.length) return 'pass';
        log('连锁：入链 ' + usable[0].label);
        return usable[0].id;
      }
      case 'choice': {
        const list = decision.options || decision.labels || [];
        let best = 0, bestScore = -Infinity;
        list.forEach((l, i) => { const sc = optionScore(l); if (sc > bestScore) { bestScore = sc; best = i; } });
        log(`选择：第 ${best + 1} 项（${String(list[best] || '').slice(0, 24)}）`);
        return best;
      }
      case 'pickCards': {
        // 弃牌/送墓/献祭：丢**价值最低**的；从手牌里挑（`from` 指明区域）
        const pool = decision.candidates || decision.cards || [];
        if (!pool.length) return [0];
        let worst = 0, worstV = Infinity;
        pool.forEach((c, i) => { const v = cardValue(c.card || c); if (v < worstV) { worstV = v; worst = i; } });
        return [worst];
      }
      case 'pickList': {
        // 检索/回收：拿**价值最高**的
        const pool = decision.candidates || [];
        if (!pool.length) return [0];
        let best = 0, bestV = -Infinity;
        pool.forEach((c, i) => { const v = cardValue(c.card || c); if (v > bestV) { bestV = v; best = i; } });
        log('检索：取 ' + ((pool[best] || {}).card || {}).name);
        return [best];
      }
      default:
        return 0;
    }
  }

  /** 在"可出的牌"里挑一张；返回 null 表示不出 */
  function chooseCard(playable) {
    const list = (playable || []).filter(Boolean);
    if (!list.length) return null;
    let best = null, bestV = -Infinity;
    for (const c of list) {
      const card = c.card || c;
      // 基础价值 + **有威胁优先**：不加这一条，AI 会一直打功能牌，
      // 40 回合只造成 8 点伤害、分不出胜负（浸泡测试实测）
      const v = cardValue(card) + (dealsDamage(card) ? 6 : 0);
      if (v > bestV) { bestV = v; best = c; }
    }
    log('出牌：' + (((best || {}).card || best || {}).name || '?'));
    return best;
  }

  /**
   * 走完当前玩家的一个回合。
   * 每一步都通过引擎公开接口：startTurn / advancePhase / playCard / endTurn。
   * @param {object} api { state, startTurn, advancePhase, playCard, endTurn, legality, driveToIdle }
   */
  function takeTurn(api) {
    const { state } = api;
    const seatId = state.currentPlayer;
    const played = [];
    const events = [];
    const drive = { answer: answerDecision };

    events.push(...api.startTurn(state));
    // 准备 → 主要1
    events.push(...api.advancePhase(state, drive).events);
    for (let i = 0; i < policy.maxPlaysPerTurn; i++) {
      const hand = (state.seats[seatId].hand || []).slice();
      const target = api.otherSeat(state, seatId);
      const legal = [];
      for (const card of hand) {
        // **带射程判定**：射程外的攻击卡打出去也只会"不适用"，AI 不该浪费它（浸泡测试实测过：
        // 不带射程判定时双方会一直空打，40 回合也分不出胜负）
        const v = api.legality(state, seatId, card, { checkRange: true, target });
        if (v.ok) legal.push({ card, verdict: v });
      }
      const pick = chooseCard(legal);
      if (!pick) break;
      const r = api.playCard(state, seatId, pick.card, { ...drive, target });
      if (!r.ok) { log('出牌被拒：' + r.reason); break; }
      played.push(pick.card.name);
      events.push(...r.events);
      if (r.pending) {
        const idle = api.driveToIdle(state, drive);
        events.push(...idle.events);
        if (!idle.done) { log('⚠ 出牌后窗口未关净'); break; }
      }
    }
    // 主要1 → 投掷（advancePhase 进入投掷阶段会真的投掷并移动）→ 主要2 → 结束
    events.push(...api.advancePhase(state, drive).events);
    if (state.window) events.push(...api.driveToIdle(state, drive).events);
    events.push(...api.advancePhase(state, drive).events);
    if (state.window) events.push(...api.driveToIdle(state, drive).events);
    events.push(...api.endTurn(state, drive));   // 手牌上限结算也要答案源
    return { seat: seatId, played, events, trace: trace.slice(-12) };
  }

  return { answerDecision, chooseCard, takeTurn, policy, trace };
}

/** 引擎阶段常量透出（AI 内部判断用） */
export { PHASES };
