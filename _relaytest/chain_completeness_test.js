/* 连锁完整性回归（作者 2026-09-13 报的三条）
 * ------------------------------------------------------------
 * ①结算中产生的新效果，等本次连锁处理完**另开新连锁**（不再就地结算）
 * ②技能卡是**全时点卡**：任何效果发动前都能作为连锁响应发动（走 kind:'skill'，逆结算时执行效果本体）
 * ③"只要是效果发动就进连锁，然后等结算再逆执行"（C1 组成 → 逆结算）
 * 运行：node chain_completeness_test.js
 */
'use strict';
const L = require('./lib/cardlab');
const H = require('./lib/harness');
const C = H.makeChecker('连锁完整性');

(async () => {
  // ---------- ① 永奏进行曲丢盒子 → 另开新连锁 ----------
  {
    const inst = L.bootCard({
      pickCards: (t, arr, n) => { const i = (arr || []).findIndex(c => c && c.name === '来自地狱的盒子'); if (/送入墓地|弃|送墓/.test(String(t)) && i >= 0) return i; return n >= 2 ? (arr || []).map((c, k) => k).slice(0, n) : 0; }
    });
    const S = inst.S;
    L.startMatchWith(inst, { seed: 71 });
    await L.quiesce(inst, 12000);
    const bs = S.battleState;
    bs.phase = 'main1'; bs.currentPlayer = 'p1'; bs.p1.cost = 12;
    const yz = inst.g.card('永奏进行曲'), box = inst.g.card('来自地狱的盒子');
    bs.p1.hand = [yz, box, inst.g.card('经文')].filter(Boolean);
    const before = L.logsOf(bs).length;
    const pv = S.evaluatePlayable(yz, 'p1');
    C.truthy('【永奏进行曲】在本场景可出（前提条件）', pv && pv.ok === true, JSON.stringify(pv));
    if (pv && pv.ok) S.useCard(bs.p1.hand.indexOf(yz));
    await L.quiesce(inst, 16000);
    const logs = L.logsOf(S.battleState).slice(before);
    const joined = logs.join(' | ');
    console.log('  · 永奏丢盒子：日志 ' + logs.length + ' 条');
    C.truthy('结算中产生的新效果被识别为"等本次连锁处理完另开新连锁"',
      /【连锁】结算中产生新效果：/.test(joined), (logs.find(l => /结算中产生新效果/.test(l)) || '（无）').slice(0, 80));
    C.truthy('本次连锁处理完后**确实另开了一轮新连锁**',
      /本次连锁处理完毕 → 其中产生的新效果另开新连锁/.test(joined), (logs.find(l => /另开新连锁/.test(l)) || '（无）').slice(0, 80));
    // 【2026-09-27 口径修正】盒子SP 卡面写"送墓时**可选**" ⇒ 按作者判据属**选发**：
    // 它只作为窗口里的候选出现，玩家选了才上链（不再自动执行）。这里断言"被列为候选"，
    // 而不是"自动结算"——旧断言编码的是"一律必发"的错误行为。
    C.truthy('新连锁把盒子的送墓触发**列为候选**（选发：选它才上链）',
      /另开新连锁（共 \d+ 个：[^）]*来自地狱的盒子/.test(joined),
      (logs.find(l => /另开新连锁（共/.test(l)) || '（无候选清单）').slice(0, 120));
    C.truthy('盒子SP 作为**窗口候选**出现（卡面"送墓时可选" ⇒ 不自动结算）',
      /共 \d+ 个：[^）]*来自地狱的盒子/.test(joined),
      (logs.find(l => /来自地狱的盒子/.test(l)) || '（无）').slice(0, 90));
    C.truthy('没有出现"自我入队的死循环"（同一张卡只入队一次）',
      (logs.filter(l => /结算中产生新效果：.*来自地狱的盒子/.test(l)).length) <= 1,
      '入队次数=' + logs.filter(l => /结算中产生新效果：.*来自地狱的盒子/.test(l)).length);
  }

  // ---------- ② 技能卡可连锁 ----------
  {
    const inst = L.bootCard();
    const S = inst.S;
    L.startMatchWith(inst, { team: ['木原光太郎'], seed: 72 });
    await L.quiesce(inst, 12000);
    const bs = S.battleState;
    bs.phase = 'main1'; bs.currentPlayer = 'p1'; bs.p1.cost = 12;
    const skill = inst.g.card('集中');
    bs.p1.hand = [skill];
    const fakeEffect = { player: 'p1', card: inst.g.card('得分！'), description: '（用例）假效果', _stage: 'effect_activate' };
    const list = S.collectChainable('p1', fakeEffect) || [];
    const names = list.map(x => (x.card && x.card.name) + '|' + (x.card && x.card._category));
    console.log('  · collectChainable(p1) = ' + JSON.stringify(names));
    C.truthy('技能卡出现在连锁候选里（作者验收点：技能卡是全时点卡）',
      list.some(x => x.card && x.card._category === 'skill_cards'), names.join(','));

    // 本回合已用过 → 不该再出现
    skill._skillUsedThisTurn = true;
    const list2 = S.collectChainable('p1', fakeEffect) || [];
    C.eq('本回合已用过的技能卡不再进候选（每回合一次）',
      list2.some(x => x.card === skill), false);
    skill._skillUsedThisTurn = false;

    // 费用不足 → 不该出现
    const savedCost = bs.p1.cost; bs.p1.cost = 0;
    const list3 = S.collectChainable('p1', fakeEffect) || [];
    C.eq('费用不足的技能卡不进候选', list3.some(x => x.card === skill), false);
    bs.p1.cost = savedCost;

    // 对手回合：技能卡是全时点，仍应可连锁（不受"手牌只能连锁明记卡"的限制）
    bs.currentPlayer = 'p2';
    const list4 = S.collectChainable('p1', fakeEffect) || [];
    C.truthy('对手回合技能卡仍可作为连锁响应（全时点，不受手牌明记限制）',
      list4.some(x => x.card === skill), JSON.stringify(list4.map(x => x.card && x.card.name)));
    bs.currentPlayer = 'p1';
  }

  // ---------- ③ 技能卡连锁发动后：逆结算执行效果本体 ----------
  {
    const inst = L.bootCard();
    const S = inst.S;
    L.startMatchWith(inst, { team: ['木原光太郎'], seed: 73 });
    await L.quiesce(inst, 12000);
    const bs = S.battleState;
    bs.phase = 'main1'; bs.currentPlayer = 'p1'; bs.p1.cost = 12; bs.p2.sync = 30;
    const skill = inst.g.card('集中');        // 卡面：选一名玩家，其+1攻击并获得500金币
    const item = inst.g.card('经文');
    bs.p1.hand = [skill, item].filter(Boolean);
    bs.p1.sync = 20;
    const atkBefore = bs.p1.attackBuff || 0, goldBefore = bs.p1.gold || 0;
    // 直接构造一个"效果将要执行前"的链：用一个假 effect，把技能卡挂上链再逆结算
    const eff = { player: 'p1', card: item, description: '（用例）连锁源', _stage: 'effect_activate', _chain: [] };
    const pick = { card: skill, from: 'hand', index: bs.p1.hand.indexOf(skill), isSkill: true };
    let doneCalled = false;
    S.applyChainCard('p1', pick, eff, function () { doneCalled = true; });
    await L.quiesce(inst, 8000);
    C.truthy('技能卡已上链（kind=skill）', (eff._chain || []).some(n => n.kind === 'skill'),
      JSON.stringify((eff._chain || []).map(n => n.kind)));
    C.eq('连锁发动时已支付费用并记录"每回合一次"', !!skill._skillUsedThisTurn, true);
    const before2 = L.logsOf(bs).length;
    S.resolveChainStack(eff, function () {});
    await L.quiesce(inst, 10000);
    const logs = L.logsOf(bs).slice(before2).join(' | ');
    console.log('  · 逆结算日志：' + logs.slice(0, 200));
    C.truthy('逆结算里写了"执行技能卡"', /逆结算执行技能卡/.test(logs), (logs.match(/▸ 逆结算执行技能卡[^|]*/) || ['（无）'])[0].slice(0, 60));
    C.truthy('技能卡效果本体真的生效了（攻击力或金币有变化）',
      (bs.p1.attackBuff || 0) !== atkBefore || (bs.p1.gold || 0) !== goldBefore,
      '攻击 +' + atkBefore + '→+' + (bs.p1.attackBuff || 0) + '，金币 ' + goldBefore + '→' + (bs.p1.gold || 0));
  }

  /* ---------- ④ 座位级连锁效果（作者 2026-09-27 裁决；2026-10-09 作者裁决 A 修订）----------
     · 露璐缇雅·破坏：对手回合不能主动发动，但**可以作为连锁响应跟上**（游戏王式）。
     · 莉莉·回收：**2026-10-09 作者裁决 A** —— 卡面写的是「每个自己回合可以发动」⇒
       它**只能自己回合主动发动**（入口＝"角色技能"菜单），**对手回合不出现**连锁候选。
       本用例的期望已按 A 同步（作者明确授权改这条期望）。 */
  {
    const inst2 = L.bootCard();
    const S2 = inst2.S, g2 = inst2.g;
    await L.startMatchWith(inst2, { team: ['莉莉·缇雅菲洛', '现实间冬马', '入间枫'] });
    await L.quiesce(inst2, 9000);
    const bs2 = S2.battleState, me = bs2.p1;
    me._lilySP = true; me._lilySPTurn = 0;
    me.grave = [g2.card('遥控骰子') || g2.cards()[0]];
    me.cost = 5;
    const effS = { player: 'p2', description: '对手效果将要执行前（用例）', _stage: 'effect_activate', _chain: [] };

    bs2.currentPlayer = 'p2';                     // 对手回合
    const cands = S2.collectChainable('p1', effS) || [];
    C.truthy('★ A：莉莉·回收 在**对手回合不出现**连锁候选（卡面只允许自己回合主动发动）',
      !cands.some(x => x.seatEffect === 'lily'),
      '候选=' + JSON.stringify(cands.map(x => x.card && x.card.name)));
    // 露璐缇雅·破坏 同样应作为座位级连锁候选（条件是"破坏者≥3"，这里把计数桩成 3）
    {
      const origBC = S2.__breakerCount;
      S2.__breakerCount = function () { return 3; };
      me._edwardSP = true; me._edwardSPTurn = 0;
      bs2.currentPlayer = 'p2';
      const cands3 = S2.collectChainable('p1', effS) || [];
      C.truthy('★ 露璐缇雅·破坏 也能作为座位级连锁候选（对手回合跟连锁）',
        cands3.some(x => x.seatEffect === 'edward'),
        '候选=' + JSON.stringify(cands3.map(x => x.card && x.card.name)));
      S2.__breakerCount = origBC;
      me._edwardSP = false;
    }
    bs2.currentPlayer = 'p1';                     // 自己回合
    const cands2 = S2.collectChainable('p1', effS) || [];
    C.truthy('★ 自己回合：该能力**不**作为连锁候选（自己回合走主动弹窗）',
      !cands2.some(x => x.from === 'seatEffect'), '候选=' + JSON.stringify(cands2.map(x => x.card && x.card.name)));
  }

  /* ---------- ⑤ 同一次"卡离场"事件的多个触发必须**同批入队**（作者 2026-09-27 实测反馈） ----------
     他实测：盒子送墓那一刻，进行曲的"本回合进墓计数造伤"与琉璃(万圣祭)SP 的"不因使用离场抽卡"
     没有跟盒子进同一个链（窗口只有 1 个候选），且琉璃/冬马SP 是"就地弹窗排队"到窗口外才结算。 */
  {
    const inst3 = L.bootCard();
    const S3 = inst3.S, g3 = inst3.g;
    await L.startMatchWith(inst3, { team: ['莉莉·缇雅菲洛', '现实间冬马', '入间枫'] });
    await L.quiesce(inst3, 9000);
    const bs3 = S3.battleState, ee3 = S3.effectEngine;
    bs3.p1._liuliHWSP = true; bs3.p1._liuliHWSPTurn = 0;      // 琉璃(万圣祭)SP 在 p1
    bs3.p1._tomaSP = true;                                    // 冬马SP 也在 p1
    const yz = g3.card('永奏进行曲') || { name: '永奏进行曲' };
    bs3.p2.permanent = [Object.assign({}, yz)];               // 进行曲挂在当前回合方（AI）
    bs3.currentPlayer = 'p2';
    ee3._chainLock = true;                                    // 制造"连锁忙"（真实场景是结算中）
    const before = (ee3._pendingTriggers || []).length;
    S3.checkGraveTrigger('p1', g3.card('遥控骰子') || g3.cards()[0], 'effect');
    const added = (ee3._pendingTriggers || []).length - before;
    const labels = (ee3._pendingTriggers || []).slice(before).map(x => String(x.label || ''));
    ee3._chainLock = false; if (ee3._pendingTriggers) ee3._pendingTriggers.length = 0;
    C.truthy('★ 同一次卡离场的多个触发**同批入队**（进行曲 + 琉璃SP + 冬马SP；该卡自身无送墓效果故不入链）',
      added >= 3, '新增 ' + added + ' 条：' + JSON.stringify(labels.map(s => s.slice(0, 22))));
    C.truthy('★ "不因使用离场"的两条以**选发**身份入批（窗口里问，不就地弹窗）',
      labels.some(l => /琉璃\(万圣祭\)/.test(l)) && labels.some(l => /冬马/.test(l)) && labels.some(l => /永奏进行曲/.test(l)),
      JSON.stringify(labels.map(s => s.slice(0, 26))));
  }

  /* ---------- ⑥ 端到端：真实入口 moveCardToGrave + 真实排空 ⇒ 窗口候选数应 ≥3 ----------
     对照作者日志：他看到的窗口写着"初始候选 1"（只有盒子），期望是三条触发同窗可选。 */
  {
    const inst4 = L.bootCard();
    const S4 = inst4.S, g4 = inst4.g;
    await L.startMatchWith(inst4, { team: ['小沙香琉璃', '现实间冬马', '入间枫'] });   // 琉璃当队长：其 SP 才合法生效（编组规则：队员位需卡面写明"作为队员也生效"）
    await L.quiesce(inst4, 9000);
    const bs4 = S4.battleState, ee4 = S4.effectEngine;
    if (typeof S4.__chainOnceReset === 'function') S4.__chainOnceReset();   // 【2026-09-30】清掉前面用例可能留下的"本连锁已排过"集合（P1）
    if (typeof S4.__missTiming === 'function') delete S4.battleState._missTimingLoggedFor;
    bs4.p1._liuliHWSP = true; bs4.p1._liuliHWSPTurn = -1;   // -1：本回合尚未用过（turn 初值可能是 0，写 0 会被当成"已用过"）
    bs4.p1._liuliHWQueuedFor = null;                        // 清掉上一次用例可能留下的"本事件已排过"标记
    /* 【2026-09-30 确定性化】原来这里把回合方设成 p2、进行曲也放 p2 ⇒ 而 **p2 是 AI**，
       AI 会在 quiesce 期间真的行动（predation 的进墓计数、手牌、费用都在变）⇒ 同一用例一次绿一次红。
       现在固定在 **p1（人类）**：AI 不会行动，候选数确定；进行曲也随之放在 p1（卡面「自己回合内」）。 */
    bs4.p1.permanent = [Object.assign({}, g4.card('永奏进行曲') || { name: '永奏进行曲' })];
    /* 【2026-10-12 作者口径修正】进行曲改为「每 **3** 张卡进墓才开一次连锁」✓
       ⇒ 本用例只送 1 张 ⇒ 需把计数**预置为 2**，本次进墓正好到 3 ⇒ 候选照常出现 ✓（可继续验证"多候选同窗" ✓） */
    bs4.p1._yongzouCount = 2;
    bs4.currentPlayer = 'p1';
    bs4.phase = 'main1';                                    // 【2026-09-30】时点扫描对阶段敏感：不设就会停在别的阶段 ⇒ 候选变少（探针对比后确认）
    const victim = g4.card('遥控骰子') || g4.cards()[0];
    ee4._chainLock = true;                                  // 结算中（真实场景）
    const n0 = L.logsOf(bs4).length;
    S4.moveCardToGrave('p1', victim, 'effect');             // 真实入口
    ee4._chainLock = false;
    if (typeof ee4.__tryDrainTriggers === 'function') ee4.__tryDrainTriggers();
    else if (typeof S4.__tryDrainTriggers === 'function') S4.__tryDrainTriggers();
    await L.quiesce(inst4, 12000);
    const lg = L.logsOf(bs4).slice(n0).join(' | ');
    const m = lg.match(/【时点窗口】打开（[^）]*初始候选\s*(\d+)/);
    const cand = m ? Number(m[1]) : -1;
    const members = (lg.match(/【连锁组成】[^|]*/g) || []).map(s => s.trim());
    /* 【2026-09-28 口径校正】本用例的"受害者"是遥控骰子（不是来自地狱的盒子）⇒ 合法的同窗候选是
       **进行曲（p2 的永久卡）+ 琉璃(万圣祭)SP（p1）** 两条；盒子SP 不涉及，故期望 ≥2（原来写 ≥3 是把盒子算进去了）。 */
    C.truthy('★ 端到端：离场事件开的窗口**候选数 ≥ 2**（进行曲 + 琉璃SP 同窗可选）', cand >= 2,
      '初始候选=' + cand + '｜' + lg.slice(0, 150));
    C.truthy('★ 端到端：链上成员包含三条触发', /永奏进行曲/.test(lg) && /琉璃\(万圣祭\)/.test(lg) && /送入墓地|送墓/.test(lg),
      JSON.stringify(members.slice(0, 4)));
  }

  /* ---------- ⑦ 非结算中的同事件多触发：一个窗口 + **不得卡死**（2026-09-27 事故回归） ----------
     事故：为了把"献祭时琉璃SP与进行曲同窗"做出来，曾在非结算中也调用排空 ⇒
     "排空 → fire → 再收集 → 再排空"重入死循环 ⇒ **献祭选卡即网页卡死**（已上线过一次，作者踩到）。
     本用例同时钉两件事：①窗口候选 ≥3（同窗）②调用在 3 秒内返回（不重入）。 */
  {
    const inst5 = L.bootCard();
    const S5 = inst5.S, g5 = inst5.g;
    await L.startMatchWith(inst5, { team: ['小沙香琉璃', '现实间冬马', '入间枫'] });   // 同上：琉璃当队长
    await L.quiesce(inst5, 9000);
    const bs5 = S5.battleState;
    bs5.currentPlayer = 'p1'; bs5.phase = 'main1';
    bs5.p1._liuliHWSP = true; bs5.p1._liuliHWSPTurn = -1;   // -1：本回合尚未用过（同 ⑥）
    bs5.p1._liuliHWQueuedFor = null;                        // 清掉上一次用例可能留下的"本事件已排过"标记
    /* 【摆正用例】进行曲的卡面是"**自己回合内**每有1张卡进入墓地" ⇒ 引擎只在**持有者的回合**生效。
       本用例把回合玩家设成 p1，所以进行曲必须放在 **p1**（原来放在 p2 ⇒ 引擎正确地判定"不适用"，
       于是窗口只有 1 个候选，被误读成 bug）。 */
    bs5.p1.permanent = [Object.assign({}, g5.card('永奏进行曲') || { name: '永奏进行曲' })];
    bs5.p1._yongzouCount = 2;   // 【2026-10-12】同上：每 3 张才开窗 ⇒ 预置 2，本次进墓到 3 ⇒ 候选出现 ✓
    const victim5 = (g5.cards() || []).find(c => c && c._category === 'item_single');
    const n5 = L.logsOf(bs5).length;
    const t5 = Date.now();
    /* 【2026-09-30 跟随 P4 口径】原来用 'sacrifice'（代价献祭）⇒ 而 P4 规定：「～时可以发动」的选发
       在**代价送墓**时会**错过时点**（代价之后该效果还要继续结算）⇒ 琉璃(万圣祭)SP 不再产出、窗口只剩进行曲(=1)，
       这不是 bug。本用例的意图是"同事件多触发同窗" ⇒ 改用 **效果送墓**（P4 下照常触发）。 */
    S5.checkGraveTrigger('p1', victim5, 'effect');            // 非结算中的离场（效果送墓）
    const elapsed = Date.now() - t5;
    await L.quiesce(inst5, 10000);
    const lg5 = L.logsOf(bs5).slice(n5).join(' | ');
    const m5 = lg5.match(/【时点窗口】打开（[^）]*初始候选\s*(\d+)/);
    C.truthy('★ 非结算中的同事件多触发：一个窗口且候选 ≥2（进行曲 + 琉璃SP；无送墓效果的卡不再入链）',
      !!m5 && Number(m5[1]) >= 2, '初始候选=' + (m5 ? m5[1] : '(没开窗口)'));
    C.truthy('★ 该调用 3 秒内返回（不再重入排空导致卡死）', elapsed < 3000, elapsed + 'ms');
    /* 【P4 回归】代价送墓（献祭）⇒ 被点名的"～时可以发动"必须**错过时点**、不产出 */
    bs5.p1._liuliHWQueuedFor = null; bs5.p1._liuliHWSPTurn = -1;
    const n5b = L.logsOf(bs5).length;
    S5.checkGraveTrigger('p1', victim5, 'sacrifice');
    await L.quiesce(inst5, 8000);
    const lg5b = L.logsOf(bs5).slice(n5b).join(' | ');
    C.truthy('★ P4 错过时点：代价送墓时琉璃(万圣祭)SP 不产出（MD 口径）',
      !/琉璃\(万圣祭\)/.test(lg5b), '日志：' + lg5b.slice(0, 120));
  }

  /* ---------- ⑧ 进行曲：每次满足各占**一条链环**（作者 2026-09-27 口径：c1进行曲 c2进行曲） ----------
     事故对照：原来伤害在 __graveBody 里就地打 ⇒ 链上只 1 条却打了 2 次（"不是打多少次的问题"）。 */
  {
    const inst6 = L.bootCard();
    const S6 = inst6.S, g6 = inst6.g;
    await L.startMatchWith(inst6, { team: ['莉莉·缇雅菲洛', '现实间冬马', '入间枫'] });
    await L.quiesce(inst6, 9000);
    const bs6 = S6.battleState, ee6 = S6.effectEngine;
    bs6.currentPlayer = 'p1'; bs6.phase = 'main1';
    bs6.p1.permanent = [Object.assign({}, g6.card('永奏进行曲') || { name: '永奏进行曲' })];
    bs6.p1._yongzouCount = 0;
    /* 【2026-10-12 作者口径修正】进行曲改为「每 **3** 张卡进墓才开一次连锁」✓
       ⇒ 要得到"两条链环"，需要 **6** 张送墓（第 3 张、第 6 张各产生一次候选 ✓）
       ⇒ 用 6 张**不同**的 item_single 触发（同一张连发会被 `_graveEventCard` 防重入守卫当成同一次事件 ✗） */
    const __pool6 = (g6.cards() || []).filter(c => c && c._category === 'item_single');
    const __use6 = __pool6.slice(0, 6);
    ee6._chainLock = true;                                  // 结算中：六次送墓都应入队
    const before = (ee6._pendingTriggers || []).length;
    if (__use6.length === 6) __use6.forEach(c => S6.checkGraveTrigger('p1', c, 'effect'));
    const labels = (ee6._pendingTriggers || []).slice(before).map(x => String(x.label || ''));
    const yz = labels.filter(s => /永奏进行曲/.test(s)).length;
    ee6._chainLock = false; if (ee6._pendingTriggers) ee6._pendingTriggers.length = 0;
    bs6.p1._yongzouCount = 0;
    C.truthy('（前提）item_single 池里至少有 6 张', __use6.length === 6, '实得 ' + __use6.length);
    C.eq('★ 六次送墓 ⇒ 进行曲占**两条**链环（第3张、第6张各一条；不是合并成一条打两次）', yz, 2);
  }

  process.exit(C.summary());
})().catch(e => { console.log('❌ 异常：' + (e && e.stack || e)); process.exit(1); });
