/**
 * 入局者 v2 · 出牌入口（唯一路径）
 * ---------------------------------------------------------------------------
 * 旧引擎这条流程被拆成三处、且有历史补丁互相覆盖（`useCard` → `useCardComplete` → `settleCardExecution`
 * → `runSingleCardSteps`；文件末尾还有 `useCard = useCardComplete` 这种"带广播的版本被替换"的事故，
 * 见《联机失步排查记录》根因 1）。
 *
 * 新引擎只有这一条，顺序固定、每步都是数据可查：
 *   ① 合法性（阶段 / 费用 / 窗口 / 对象 / 队员 SP 许可）
 *   ② 报价 + 落账（`rules/cost.js`：报价纯函数、落账唯一，一次性减免付款后才消耗）
 *   ③ 离开原区域（手牌 / 盖伏区）
 *   ④ 开 `effect_activate` 窗口，**C1 = 这张卡的效果**（可被反制整效取消）
 *   ⑤ 结算（逆序、丢失对象、异常隔离都由窗口负责）
 *   ⑥ 去向（永续 → 效果处理区；其余 → 墓地；§10.2 整条链结算完才入墓）
 *   ⑦ 收尾时点（`on_effect_done`）：**只有当该时点确实登记了能力时才开窗**，不空开
 */

import { othersOf } from './state.js';
import { legality } from './offer.js';
import { payCardCost } from './rules/cost.js';
import { openWindow, runWindow, flattenCardOps, NeedsAnswer } from './window.js';
import { opsOverrideFor, musicSequenceCheck, fervorFollowUpOffer, registerNextDamagePlus } from './abilities.js';
import { answerDecision } from './decision.js';
import { executeOps } from './ops/index.js';
import { openTimingIfAny } from './timing/bus.js';

/** 永续卡留在效果处理区，其余进墓（§3.1.4/§10.2） */
export function placeAfterUse(state, seatId, card) {
  const seat = state.seats[seatId];
  const events = [];
  // "发动后直接销毁不进墓"（【底牌】这类卡自己的 ops 会标 `_consumeOnUse`）：
  // 卡**不进任何区**（销毁），只如实记一条事件
  if (card && card._consumeOnUse) {
    events.push({ type: 'cardConsumed', seat: seatId, card });
    return events;
  }
  // "以此法加入的那张卡使用后放回牌组最下方"（【小野葵】福音雅颂回收的卡）
  if (card && card._returnBottomAfterUse) {
    delete card._returnBottomAfterUse;
    seat.deck.push(card);
    events.push({ type: 'toDeckBottom', seat: seatId, card, reason: 'gospel' });
    return events;
  }
  if (card && card._category === 'item_permanent') {
    seat.permanent.push(card);
    events.push({ type: 'toPermanent', seat: seatId, card });
  } else {
    seat.grave.push(card);
    events.push({ type: 'toGrave', seat: seatId, card, reason: 'use' });
  }
  return events;
}

/**
 * 出一张牌。
 * @param {object} opts { target, from='hand', answer, rng, windowKind, hasTarget, ignoreCost }
 * @returns {{ok:boolean, reason?:string, paid?:number, pending?:object, events:Array}}
 */
export function playCard(state, seatId, card, opts = {}) {
  const seat = state.seats[seatId];
  if (!seat) return { ok: false, reason: '未知座位：' + seatId, events: [] };
  if (!card) return { ok: false, reason: '没有卡', events: [] };

  // ① 合法性（含射程校验：目标由调用方给出，缺省取对手）
  const targetSeat = opts.target ?? othersOf(state, seatId)[0] ?? seatId;
  const verdict = legality(state, seatId, card, {
    windowKind: opts.windowKind,
    hasTarget: opts.hasTarget,
    ignoreCost: opts.ignoreCost,
    target: targetSeat,
    checkRange: opts.checkRange,
  });
  if (!verdict.ok) return { ok: false, reason: verdict.reason, events: [] };

  // ② 报价 + 落账（唯一）
  const paid = payCardCost(state, seatId, card);
  if (!paid.ok) return { ok: false, reason: paid.reason, events: [] };

  // ③ 离开原区域
  const from = opts.from || 'hand';
  const zone = seat[from] || seat.hand;
  const ix = zone.indexOf(card);
  if (ix >= 0) zone.splice(ix, 1);

  const events = [{ type: 'useCard', seat: seatId, card, paid: paid.paid, from }];
  const target = targetSeat;
  const ops = (opsOverrideFor(card) || {}).main || flattenCardOps(card);
  // 永续卡"使用即发动"：**结算期间它就算在场**（作者口径；旧引擎 computeDamageValue 注释
  // 明写"C1 在结算期间就算在场，可以吃到光环增益"）。所以先入场，收尾时不再重复放置。
  const isPermanent = card._category === 'item_permanent';
  if (isPermanent) { seat.permanent.push(card); events.push({ type: 'toPermanent', seat: seatId, card, reason: 'use' }); }

  // ④ 开窗：C1 = 这张卡的效果
  openWindow(state, {
    kind: 'effect_activate',
    point: 'on_activate',
    ctx: { seat: seatId, target, card, rng: opts.rng, hasTarget: opts.hasTarget !== false, source: 'card' },
    c1: {
      id: 'c1:' + (card.name || 'card'),
      owner: seatId,
      label: card.name || '卡的效果',
      mandatory: true,
      card,
      ops,
      fire: (st, win) => {
        if (!ops.length) { st.log.push({ type: 'emptyEffect', text: `【${card.name}】没有可执行的 ops（空效果）` }); return; }
        const r = executeOps(st, { seat: seatId, target: win.ctx.target, card, rng: opts.rng, answer: opts.answer }, ops);
        if (r.pending) throw new NeedsAnswer(r.pending);   // 抛给调用方，不被"异常只跳节点"吞掉
        for (const e of r.events) st.log.push({ type: 'opEvent', text: JSON.stringify(e).slice(0, 400) });
      },
    },
  });

  // ⑤ 结算（窗口驱动；没人能连锁时自动放行，所以常见情况是同步完成）
  const driven = runWindow(state, opts);
  events.push(...driven.events);
  if (!driven.done) return { ok: true, paid: paid.paid, pending: driven.pending, events };

  // ⑥ 去向（整条链结算完才入墓；永续卡已在开窗前入场）
  if (!isPermanent) events.push(...placeAfterUse(state, seatId, card));

  // ⑦ 收尾时点（只在真有登记能力时开窗）
  const tail = openTimingIfAny(state, 'on_effect_done', { seat: seatId, target, card, rng: opts.rng });
  if (tail) {
    const r2 = runWindow(state, opts);
    events.push(...r2.events);
    if (!r2.done) return { ok: true, paid: paid.paid, pending: r2.pending, events };
  }

  // ⑧ 使用之后的角色被动（惠的音律编排、琉璃(水着)的热忱后续）——都在内容层声明、按卡面实现
  events.push(...afterCardUsedPassives(state, seatId, card, { ...opts, target }));

  return { ok: true, paid: paid.paid, events };
}

/**
 * "使用一张牌之后"的角色被动（2026-09-26 重做角色）：
 *   · 松山惠：音律感应 —— 记录最近 3 张牌的音韵值，满足编排则执行对应乐曲
 *   · 琉璃(水着)：使用热忱属性的卡后的效果（造 1 点热忱伤害 + 回 1 同步；攻击/技能卡后再抽 1 并让下次热忱最终伤害 +1，一回合一次）
 */
function afterCardUsedPassives(state, seatId, card, opts = {}) {
  const events = [];
  // 【入间予】理智分支："使用单次种类的卡后抽一张，然后选手卡或区域内一张卡送入墓地"
  // （回合级待消费标记，用掉即清）
  const seat = state.seats[seatId];
  const mech = seat && seat.statuses['mech:afterSingleItem'];
  if (mech && mech.turn === state.turn && card && String(card._category || '').includes('item_single')) {
    delete seat.statuses['mech:afterSingleItem'];
    const r = executeOps(state, { seat: seatId, target: opts.target, card, rng: opts.rng, answer: opts.answer },
      [{ op: 'draw', n: mech.draw || 1 }, { op: 'discard', n: mech.discard || 1, reason: '解构与求索：送墓 1 张' }]);
    if (!r.pending) events.push(...r.events);
  }
  const cost = Number(card && card.cost);
  if (Number.isFinite(cost)) {
    const seq = musicSequenceCheck(state, seatId, cost);
    if (seq) {
      state.log.push({ type: 'musicSequence', text: `【音律感应】音韵值 ${seq.seq.join('/')} → 执行[乐曲${seq.piece}]` });
      const r = executeOps(state, { seat: seatId, target: opts.target, card, rng: opts.rng, answer: opts.answer }, seq.ops);
      if (!r.pending) events.push(...r.events);
    }
  }
  const offer = fervorFollowUpOffer(state, seatId, { card });
  if (offer) {
    const yes = typeof opts.answer === 'function'
      ? opts.answer({ kind: 'choice', seat: seatId, options: ['适用效果', '不适用'], title: '为君绽放的微笑', reason: offer.label })
      : 0;
    const taken = (Number(Array.isArray(yes) ? yes[0] : yes) || 0) === 0;
    state.log.push({ type: 'fervorFollowUp', text: `【为君绽放的微笑】${taken ? '适用' : '不适用'}` });
    if (taken) {
      const target = opts.target || othersOf(state, seatId)[0] || seatId;
      const r = executeOps(state, { seat: seatId, target, card, rng: opts.rng, answer: opts.answer },
        [{ op: 'damage', base: offer.damage || 1, kind: offer.kind || '热忱' },
          { op: 'heal_sync', amount: offer.heal || 1 }]);
      if (!r.pending) events.push(...r.events);
      // "使用攻击卡和技能卡之后立刻抽一张并让下次造成的热忱属性的最终伤害+1（一回合一次）"
      const isAttackSkill = card && ['attack_cards', 'skill_cards'].includes(card._category);
      if (isAttackSkill && !offer.oncePerTurnUsed) {
        state.seats[seatId].statuses['fervorFollowUsed:' + offer.id] = state.turn;
        const r2 = executeOps(state, { seat: seatId, target, card, rng: opts.rng, answer: opts.answer },
          [{ op: 'draw', n: offer.drawAfterAttack || 1 }]);
        if (!r2.pending) events.push(...r2.events);
        registerNextDamagePlus(state, seatId, '热忱', offer.nextFervorPlus || 1, offer.id);
        events.push({ type: 'nextDamagePlusRegistered', seat: seatId, attr: '热忱', amount: offer.nextFervorPlus || 1 });
      }
    }
  }
  return events;
}

/**
 * 驱动到空闲：把所有挂起的窗口用 `answer(decision)` 源答完。
 * 测试与 selftest 用它把"需要人答"的局面跑完（正式断点续跑见 P4b）。
 */
export function driveToIdle(state, opts = {}, maxSteps = 500) {
  const events = [];
  for (let i = 0; i < maxSteps; i++) {
    if (!state.window) return { done: true, events };
    const r = runWindow(state, opts);
    events.push(...r.events);
    if (r.done) return { done: true, events };
    if (typeof opts.answer !== 'function') return { done: false, pending: r.pending, events };
    const value = opts.answer(r.pending);
    if (value === undefined) return { done: false, pending: r.pending, events };
    answerDecision(state, r.pending.id, value);
  }
  throw new Error('[engine.play] driveToIdle 步数超限（可能存在自触发）');
}
