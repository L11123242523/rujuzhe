/* 角色卡被动/SP 期望值回归（阶段③第三层）
 * ------------------------------------------------------------
 * 角色卡没有主效果文本，它们走的是另一条代码路径：
 *   · 队长被动：在 startBattle 时按卡面文本注册（所以必须在开局**前**把队伍换成该角色）
 *   · SP：随"作为队长/队员编组"生效，多数在特定时点触发
 * 期望值同样逐条从卡面的 passive/sp 文本推导。
 * 用法：node char_effect_expect.js [角色名]
 */
'use strict';
const L = require('./lib/cardlab');
const H = require('./lib/harness');
const C = H.makeChecker('角色被动/SP 期望值');
const sleep = L.sleep;

/* SP 用例里挑卡：必须"可出"，且**排除已知例外**（见文件末尾的 skip 用例说明）。
   盲选 carries[0] 会让不可出的卡静默失败，从而把"没测到"误记成"SP 有冲突"。 */
async function playPlayableAttackSkill(inst) {
  const S = inst.S;
  const pool = inst.g.cards().filter(c => c && (c._category === 'attack_cards' || c._category === 'skill_cards')
    && c.cost > 0 && c.name !== '闲暇时光');
  let picked = null;
  for (const c of pool) {
    S.battleState.p1.hand = [c]; S.battleState.p1.cost = 12;
    let pv = null; try { pv = S.evaluatePlayable(c, 'p1'); } catch (e) {}
    if (pv && pv.ok) { picked = c; break; }
  }
  if (!picked) throw new Error('找不到可出的攻击/技能卡，无法测这条 SP');
  S.battleState.p1.hand = [picked]; S.battleState.p1.cost = 12;
  inst.__spCard = picked;
  S.useCard(0);
}

/* 按条件挑一张"可出"的卡并打出（卡名不写死：属性/标签类被动要用满足条件的卡去验） */
async function playPicked(inst, pred, note) {
  const S = inst.S;
  const pool = inst.g.cards().filter(c => c && c.name && c.cost > 0 && c._category !== 'characters' && c._category !== 'emojis' && pred(c));
  let picked = null;
  for (const c of pool) {
    S.battleState.p1.hand = [c]; S.battleState.p1.cost = 12;
    let pv = null; try { pv = S.evaluatePlayable(c, 'p1'); } catch (e) {}
    if (pv && pv.ok) { picked = c; break; }
  }
  if (!picked) throw new Error('没有满足条件的可出卡（' + (note || '') + '）');
  S.battleState.p1.hand = [picked]; S.battleState.p1.cost = 12;
  inst.__picked = picked;
  S.useCard(0);
}

/* 规则：混沌属性受所有属性攻击「多1伤害」。这条已经坑了我三次期望值
   （冬马被动、琉璃(水着)被动…），统一抽成函数，别再各写一遍。 */
function foeDamageBonus(inst) {
  const a = inst && inst.S && inst.S.battleState && inst.S.battleState.p2 && inst.S.battleState.p2.teamAttribute;
  return a === '混沌' ? 1 : 0;
}

/* 每条：{
 *   char, why(卡面依据), team:[角色名]（默认 [char] 让他当队长）,
 *   tweak(S,bs), act:async(inst)=>{},  exact/range/mustLog
 * } */
const CASES = [
  {
    char: '现实间冬马',
    why: '被动·分析大师的游刃有余（**2026-09-26 作者重做后的卡面**）：自己的回合主要阶段可发动一次，'
      + '声明一种属性并公开一名玩家的一张**暗置卡**：属性相同 → 放回持有者牌组最下方 + 对其造成4点无序伤害；不同 → 该卡持有者必须使用它，不能使用则弃舍。',
    skip: '本条原为**旧卡面**的期望（"自己回合内每累计移动5格对一名玩家造成1点无序伤害"，随等级成长）。'
      + '作者重做后旧设计已作废 ⇒ 期望值不再成立，**标为未验证而不是改数字**（改数字＝拿引擎反推期望值，违反本目录纪律）。'
      + '新行为的断言已落在 `port-old/verify-offline.mjs`（"冬马：被动 __tomaDeclare（AI 路径）能声明并公开暗置卡"），'
      + '该套件已由 `_relaytest/old_site_offline_test.js` 挂进门禁。待把逐卡期望模型补上后，再按新卡面把这条写成精确断言。'
  },
  {
    char: '现实间冬马',
    why: 'SP（**重做后**）：当有玩家的卡不因使用而离开其原本所在的区域时可以发动 —— 对其造成4点无序属性伤害；'
      + '如果自己因此受到伤害则回复自身4点音韵值；如果自己墓地的无序属性卡最多还能再抽一张。',
    skip: '本条原为**旧卡面**的期望（"使用攻击卡或技能卡之后前进1-3格"）。作者重做后该 SP 已不存在 ⇒ 标记为未验证，'
      + '不改成"位置 0→0"之类的假断言。新 SP 需要"卡不因使用离场"的触发场景，待与新的期望模型一起补。'
  },
  {
    char: '现实间冬马',
    why: 'SP 的"作为队员编组也生效"范围维度（重做后仍保留这一条范围说明）。',
    skip: '与上一条同因：旧 SP 文本作废（旧文为"前进1-3格"），范围维度的断言要等新 SP 的触发场景建好后再补。'
  },
  {
    char: '现实间冬马',
    why: 'SP 在"多段效果+抽卡动画"的整链（约2秒）里同样触发（这条记录的是当年"忙判定"踩过的坑，仍有价值）。',
    skip: '与上两条同因：旧 SP（前进1-3格）已随重做作废。**但这条记录的坑仍然有效** ——'
      + '"静默判定要把抽卡动画算进忙碌"，该口径已由 effect_lock_test.js 的看门狗用例守住。'
  },
  {
    char: '木原光太郎', why: '被动：每回合的首次献祭可以额外回复1点音韵值 → 首次献祭共回3（基础2+额外1）【2026-10-11 第二次平衡性调整：2→1】',
    tweak: (S, bs) => { bs.p1.cost = 5; },               // 压低费用，避免被 maxCost 封顶看不见回复量
    act: async (inst) => { inst.S.doSacrifice(); },
    exact: [['自己.cost', 3]], mustLog: /献祭/
  },
  {
    char: '椎名小春', why: '被动：自己的回合内每累计位移4格可以获得1点[先机]（存在 p._xianji，上限6）',
    act: async (inst) => { inst.S.applyMove('p1', 4); },
    exact: [['自己._xianji', 1]], mustLog: /侦探直觉|先机/
  },
  // "初始手牌+N"这类被动**暂时无法可靠验证**：换队长会连卡组一起换（携带卡/道具构成都不同），
  // 初始手牌张数因此不可比；而绝对值又受准备阶段补牌逻辑影响（实测 小野葵 8 张 / 对照 5 张）。
  // 要真验证需要"同一副卡组 + 只换队长"的能力，那是卡组构筑器的事，先记为未验证。
  {
    char: '小野葵', why: '被动：初始手牌+1',
    skip: '初始手牌张数受准备阶段补牌与卡组构成影响，当前无法做"同卡组对照"，待补齐构筑能力后再验证'
  },
  {
    char: '木原光太郎', why: '被动：初始手牌+1',
    skip: '同上（该角色的另一条被动"首次献祭额外回2音韵"已精确验证通过）'
  },
  {
    char: '宁雨清', why: '被动：开局抽7张，从中选5张作为初始手卡，其余送入墓地 → 墓地恰好2张（7−5）',
    raw: true, abs: [['自己.墓地', 2]]
  },
  // ---- 触发类 ----
  {
    char: '小沙香琉璃', why: '被动：每次造成判定伤害后回复自身1点音韵值 → 打一张2费的判定伤害卡，净变化 −2+1 = −1',
    card: '破损电子设备',
    act: async (inst) => { inst.S.useCard(0); },
    exact: [['自己.cost', -1]], mustLog: /判定伤害骰点/
  },
  // 小野葵的被动口径（用户确认）："携带卡"= 整副牌组 12 张（8道具 + 4角色携带卡），
  // 不是只有那 4 张攻击/技能卡。所以两个来源都要测：携带卡 + 道具卡。
  ...['carries', 'items'].map(src => ({
    char: '小野葵',
    why: src === 'carries'
      ? '被动：携带卡首次使用费用−1（来源：4张角色携带卡）'
      : '被动：携带卡首次使用费用−1（来源：8张道具卡 —— 用户口径："携带卡"是整副12张）',
    act: async (inst) => {
      const S = inst.S;
      /* 装置口径（2026-09-15 修）：小野葵被动的判定是 `(card._isCarry || card._fromDeck) && !_aoiDiscountUsed`，
         而 `_isCarry/_fromDeck/_aoiDiscountUsed` 都是**开局建牌库时打在牌库那张卡上**的标志。
         原来这里从 `S.deckConfig.p1[src]` 取"配置卡"塞进手牌 —— 那不是牌库里的那张，
         有没有标志全看残留（实测两条分支一个有一个没有，于是期望怎么改都对不上）。
         改成从**牌库/手牌里的实战卡**里挑，语义才成立。 */
      const wantCarry = (src === 'carries');
      const pool = (S.battleState.p1.hand || []).concat(S.battleState.p1.deck || []);
      let picked = null;
      for (const c of pool) {
        if (!c || !c.cost || c._category === 'characters') continue;
        if (wantCarry ? !c._isCarry : !(c._fromDeck && !c._isCarry)) continue;
        /* 排除"有专用处理器的特殊卡"（【底牌】【制裁之刃】这类）：它们的付款走自己的路径、
           不经过通用减费分支，拿它们测"首次使用−1"只会测出"被动没生效"（实测抽到【底牌】就是这么红的）。
           注意（2026-09-16 收口）：上一版**以为**这道闸会挡住【底牌】，实测没挡住 ——
           `isSpecialInteractiveCard` 存在（game.html 里 `return !!getSpecialHandler(card)`），
           但它只认 getSpecialHandler 那套表，而【底牌】走的是另一套 `_dipaiOnly` 专用路径。
           所以下面再加一道**按卡面文字**的排除，不依赖"某张卡是否已被登记进某张表"。 */
        try { if (typeof S.isSpecialInteractiveCard === 'function' && S.isSpecialInteractiveCard(c)) continue; } catch (e) {}
        var _txt = String(c.name || '') + '|' + String(c.effect || '') + '|' + String(c.sp || '');
        if (/底牌|制裁之刃/.test(_txt)) continue;                                 // 已知特例（点名）
        if (/回复\s*\d+\s*点?\s*音韵|获得\s*\d+\s*点?\s*音韵|音韵值\s*\+\s*\d+|销毁/.test(_txt)) continue;  // 自带回费/销毁机制
        /* 排除**自带费用机制**的卡（实测抽到【惊吓礼盒】：原费4 实付1，它自己就减费）。
           这条用例要测的是"小野葵被动减 1"，所以必须挑卡面与费用无关的卡，否则测的是别人。 */
        if (/费用|减费|音韵值\s*[-−]|少\s*\d+\s*点音韵/.test(String(c.effect || '') + String(c.sp || ''))) continue;
        S.battleState.p1.hand = [c]; S.battleState.p1.cost = 12;
        let pv = null; try { pv = S.evaluatePlayable(c, 'p1'); } catch (e) {}
        if (pv && pv.ok) { picked = c; break; }
      }
      /* 2026-09-16 收口：这里原来直接 throw。但"本局牌序没给出可测样本"是**测试环境的随机性**，
         不是引擎缺陷 —— throw 会让整个套件崩掉（实测同一份代码两次跑：一次崩、一次报断言）。
         崩溃的测试比失败的测试更糟：它让人分不清"代码有问题"还是"这次没抽到"。改成记"未验证"。 */
      if (!picked) { inst.__unverified = '本局牌库/手牌里没有可出的【' + src + '】样本（牌序随机）'; return; }
      S.battleState.p1.hand = [picked]; S.battleState.p1.cost = 12;
      inst.__picked = picked;
      S.useCard(0);
    },
    dyn: (res, inst) => {
      const c = inst.__picked;
      if (!c) return [];                  // act 没跑成（上面已记"未验证"）：别在这里崩
      /* 期望值口径（2026-09-16 收口修正，推翻 9/15 那次"修"）：
         这里比的是 `自己.cost` 的**差值 = 本次实际支付的音韵值**，不是"减免了多少"。
         小野葵被动是"整副牌组每张的首次使用费用 −1" ⇒ 实付 = max(0, 原费 − 1)，
         所以差值必须是 `-Math.max(0, c.cost - 1)`：
           原费 4 → −3、原费 3 → −2、原费 1 → 0（付 0，就是"减 1 但不越过 0"，本来就对）。
         9/15 那次改成 `-Math.min(1, c.cost)`（恒 −1），是把"减免量"当成了"支付量"：
         费 1 的卡实付 0 本来正确（max(0,1−1)=0），却被当成"没减免"而"修"错，
         于是所有原费 >1 的卡一律判红（实测【惊吓礼盒】原费4 实得−3、【来自地狱的盒子】原费3 实得−2，
         二者恰好都等于 max(0, 原费−1) —— **引擎是对的，错的是这条期望**）。
         引擎侧口径见 game.html 的 computeActualCost：actual = Math.max(0, cost - 1)。 */
      const pay = -Math.max(0, c.cost - 1);
      return [['自己.cost', pay, '（' + (src === 'items' ? '道具' : '携带') + '卡【' + c.name + '】原费' + c.cost + '，首次使用−1 → 实付' + (-pay) + '）']];
    }
  })),
  {
    char: '宫樱子', why: '被动：消耗次数让使用的卡不消耗音韵（初始1次）→ 第一张卡应不扣费用',
    act: async (inst) => { inst.S.useCard(0); },
    card: '破损电子设备',
    // 若引擎把"免费一次"做成询问而不是自动，这条会以实际结果暴露出来（先看实得再定）
    dyn: (res) => [['自己.cost', 0, '（本次应免音韵）']]
  },
  {
    /* 【2026-09-28 新卡面②】初始音韵值与音韵上限+2。引擎侧两处都会发放：
       ①座席工厂 __makeSeatState（队长已知，maxCost 最终初值处）②首次回合开始的基础归位重算。
       本夹具的引导回路会在引擎重算**之前**把 p1.maxCost 打回 12（cardlab 的 boot 硬置 12 且此时角色标记尚未登记），
       所以这里不钉死数值，改为验"角色被动已登记"；数值口径由 port-old/probe-lilith-init.mjs 实测守（实测：回合开始后 14）。 */
    char: '里尔亚斯·斯塔芙莉娅斯特', why: '被动（2026-09-28 新卡面②）：初始音韵值与音韵上限+2（引擎在座席工厂与首次回合开始发放；数值口径见 probe-lilith-init.mjs）',
    raw: true, dyn: (res, inst) => {
      const q = inst.S.battleState.p1;
      return [
        ['_lilithPassive 已登记', !!q._lilithPassive],
        ['工程值不低于基础上限（12）', q.maxCost >= 12],
      ];
    }
  },
  {
    char: '予(水着)', why: '被动：每使用1张理智属性卡回1音韵 → 打一张理智卡，费用只扣（原费−1）',
    act: async (inst) => { await playPicked(inst, c => c.attribute === '理智' && (c._category === 'item_single' || c._category === 'item_permanent'), '理智道具卡'); },
    dyn: (res, inst) => {
      const c = inst.__picked;
      if (!c) return [];                  // act 没跑成（已记"未验证"）：不要在这里崩
      return [['自己.cost', -(c.cost - 1), '（理智卡【' + c.name + '】原费' + c.cost + '−1）']];
    }
  },
  {
    char: '琉璃(水着)', why: '被动：使用热忱属性的卡后对一名其他玩家造1点热忱伤害并回自身1同步（打一张不涉及同步/伤害的热忱卡以隔离）',
    act: async (inst) => {
      await playPicked(inst,
        c => c.attribute === '热忱' && !/同步|伤害|音韵|护盾/.test((c.effect || '') + (c.text || '')),
        '不涉及同步/伤害的热忱卡');
    },
    // 伤害只断言"下限"：出牌过程中抽到的其它手牌可能带"造成伤害时+N"的 SP
    // （实测撞到过【镇定药片·SP】+2，把 2 点抬成 4 点）——写死数值会变成"随机手牌决定成败"
    dyn: (res, inst) => [['自己.sync', 1, '（被动回自身1同步）'],
      ['对手.sync', -(1 + foeDamageBonus(inst)), -12, '（被动造1点热忱伤害；下限含混沌克制，上限留给其它手牌 SP 的增伤）']]
  },
  {
    char: '星奈(水着)', why: '被动：单次移动位移量大于5格时，对一名其他玩家造成2段1点理智属性伤害',
    act: async (inst) => { inst.S.applyMove('p1', 6); },
    // 每段1点，混沌目标每段各+1 → 用 dyn 按属性推导，不写死
    dyn: (res, inst) => [['对手.sync', -(2 * (1 + foeDamageBonus(inst))), '（2段 × (1点+混沌克制)）']],
    mustLog: /星奈|戏水|2段|理智/
  },
  {
    char: '木原光太郎', why: 'SP：队伍每回合献祭次数+1 → 一回合内可以献祭第二次',
    // 手牌只有"目标卡"一张时，第一次献祭后手牌就空了 → 第二次会因"没有手卡"而失败
    // （我第一版就是这么误判的：看起来像"SP 的献祭次数+1没生效"）
    tweak: (S, bs) => {
      bs.p1.cost = 2;
      const extra = (bs.p1.deck || []).slice(0, 3);
      bs.p1.hand = (bs.p1.hand || []).concat(extra);
      bs.p1.deck = (bs.p1.deck || []).slice(extra.length);
    },
    act: async (inst) => {
      inst.S.doSacrifice();                                    // 第一次（弹窗自动选第1张）
      // 等第一次真正结算完（还要过"首次献祭后三选一"的弹窗），否则第二次会被排队/丢掉 —— 我第一版就是 400ms 硬等
      for (let i = 0; i < 12; i++) { await L.sleep(200); if ((inst.S.battleState.p1._sacrificeUsedThisTurn || 0) >= 1) break; }
      await L.sleep(500);
      inst.S.doSacrifice();                                    // 第二次：没有 SP 的话会被"本回合次数已用完"挡下
    },
    exact: [['自己._sacrificeUsedThisTurn', 2]], mustLog: /献祭/
  },
  {
    char: '里绪(水着)', why: 'SP：首次投掷后回复与骰子点数相同的音韵值',
    // 必须把费用压低：引擎是 Math.min(cost + 点数, maxCost)，费用拉满时回复会被上限吃掉，差值恒为0
    tweak: (S, bs) => { bs.p1.cost = 4; },
    act: async (inst) => {
      const S = inst.S, bs = S.battleState;
      bs.phase = 'roll'; bs.currentPlayer = 'p1'; bs._diceRolledThisPhase = false; bs._moveResolved = false;
      S.rollDice();
    },
    // 点数从日志里读（有固定种子，稳定），期望值随之推导 —— 不写死某个点数
    dyn: (res) => {
      const m = res.logs.join(' ').match(/投出\s*(\d+)\s*点/);
      const n = m ? Number(m[1]) : null;
      if (n === null) return [['自己.cost', 0, '（日志里没找到投掷点数，期望无法推导）']];
      return [['自己.cost', n, '（首次投掷 ' + n + ' 点 → 回' + n + '音韵）']];
    },
    mustLog: /投出\d+点/
  }
];

function delta(res, field) {
  const a = res.before[field], b = res.after[field];
  if (typeof a === 'number' && typeof b === 'number') return b - a;
  if (typeof a === 'string' || a === undefined) {
    const na = !a ? 0 : String(a).split(',').filter(Boolean).length;
    const nb = !b ? 0 : String(b).split(',').filter(Boolean).length;
    return nb - na;
  }
  return NaN;
}

(async () => {
  const only = process.argv[2] || null;
  const cases = only ? CASES.filter(c => c.char === only) : CASES;
  for (const cs of cases) {
    const inst = L.bootCard();
    const card = inst.g.card(cs.card || cs.char);
    const pool = inst.g.cards().filter(c => c && c.name && c._category !== 'emojis' && c._category !== 'characters' && c._category !== 'omikuji');
    // raw 用例：开局瞬间就断言（不覆盖手牌、不做动作）—— 用于"初始手牌+N""开局7选5"这类被动。
    // 注意必须在 setupBoard 之前走，否则手牌会被 setupBoard 换成 [目标卡]
    if (cs.raw) {
      L.startMatchWith(inst, { team: cs.team || [cs.char], tweak: cs.tweak });
      await L.quiesce(inst, 9000);
      if (!inst.S.battleState) { C.bad(cs.char + '：开局失败 —— ' + (inst.g.notes.join(' | ') || '（无）')); continue; }
      const problems = [], detail = [];
      const fm = L.fieldMap(inst.S);
      // 注意：手牌/墓地这类字段在 fieldMap 里是"逗号拼接的卡名字符串"，
      // 直接跟数字比会永远是 false（我第一版就这么错了），要数条目数
      const asNum = v => (typeof v === 'number') ? v : (!v ? 0 : String(v).split(',').filter(Boolean).length);
      for (const [f, want] of (cs.abs || [])) {
        const got = asNum(fm[f]);
        detail.push(f + ' 期望' + want + ' 实得' + got);
        if (got !== want) problems.push(f + ' 期望 ' + want + '，实得 ' + got);
      }
      const line = (cs.char + ' · ' + cs.why.slice(0, 26)).padEnd(34) + ' ' + detail.join('；');
      if (problems.length) C.bad(line + '  ← ' + problems.join(' / ')); else C.ok(line);
      console.log('     开局态: 手牌=' + (inst.S.battleState.p1.hand || []).length + ' 墓地=' + (inst.S.battleState.p1.grave || []).length +
        ' 牌库=' + (inst.S.battleState.p1.deck || []).length + ' 备注=' + (inst.g.notes.join(' | ') || '（无）').slice(0, 120));
      await sleep(50);
      continue;
    }
    // rawDiff 用例：对照实验 —— 同一流程跑两次（目标角色当队长 / 不编入他），比差值。
    // "初始手牌+N"这类只能这样测：绝对张数受准备阶段补牌影响，不是稳定值。
    if (cs.rawDiff) {
      const run = async (team) => {
        const i2 = L.bootCard();
        L.startMatchWith(i2, { team: team, tweak: cs.tweak });
        await L.quiesce(i2, 9000);
        return i2.S.battleState ? L.fieldMap(i2.S)[cs.rawDiff.field] : null;
      };
      const withChar = await run(cs.team || [cs.char]);
      const without = await run(['现实间里绪']);            // 对照组：一个不在本用例里的角色当队长
      const num = v => (!v ? 0 : String(v).split(',').filter(Boolean).length);
      const got = num(withChar) - num(without);
      const line = (cs.char + ' · ' + cs.why.slice(0, 26)).padEnd(34) +
        ' 差值 期望+' + cs.rawDiff.expect + ' 实得' + (got > 0 ? '+' : '') + got +
        '（有他' + num(withChar) + '张 / 无他' + num(without) + '张）';
      if (got === cs.rawDiff.expect) C.ok(line);
      else C.bad(line + '  ← 差值不符');
      await sleep(50);
      continue;
    }
    const bs = await L.setupBoard(inst, card, pool, { team: cs.team || [cs.char], tweak: cs.tweak });
    if (!bs) { C.bad(cs.char + '：开局失败 —— 备注: ' + (inst.g.notes.join(' | ') || '（无）').slice(0, 150) + ' toast: ' + (inst.g.toasts.join(' | ') || '（无）').slice(0, 100)); continue; }
    if (cs.skip) {                          // 明确标注"这条没验证"，不算通过也不算失败
      console.log('  ⏭ 未验证 ' + cs.char.padEnd(13) + ' ' + cs.skip);
      continue;
    }
    if (inst.badDeck) {                     // 凑不出合法卡组 = 这条没测到，明确记为未验证而不是失败
      console.log('  ⏭ 未验证 ' + cs.char.padEnd(13) + ' 无法凑出合法卡组：' + inst.badDeck.slice(0, 90));
      console.log('     备注: ' + (inst.g.notes.join(' | ') || '（无）').slice(0, 240));
      continue;
    }
    const problems = [];
    const before = L.fieldMap(inst.S), logsBefore = L.logsOf(bs).length;
    let threw = null;
    try { await cs.act(inst); } catch (e) { threw = e; }
    const q = await L.quiesce(inst, 12000);
    if (inst.__unverified) {                // 本局没凑出可测样本 → 明确记"未验证"，不判红、更不许崩
      console.log('  ⏭ 未验证 ' + cs.char.padEnd(13) + ' ' + inst.__unverified);
      continue;
    }
    const after = L.fieldMap(inst.S);
    const logs = L.logsOf(inst.S.battleState).slice(logsBefore);
    const diffs = L.diffFields(before, after);
    const res = { before, after, diffs, logs, quiet: q };

    if (threw) problems.push('动作抛错：' + threw.message);
    if (!q.ok) problems.push('流程未静默：' + (q.busy || '超时'));
    const detail = [];
    for (const [f, want] of (cs.exact || [])) {
      const got = delta(res, f);
      detail.push(f + ' 期望' + (want > 0 ? '+' : '') + want + ' 实得' + (got > 0 ? '+' : '') + got);
      if (got !== want) problems.push(f + ' 期望 ' + want + '，实得 ' + got);
    }
    for (const [f, a, b, note] of (cs.dyn ? cs.dyn(res, inst) : [])) {
      const got = delta(res, f);
      // 三元 = 精确期望（第3个是说明文字）；四元 = 区间（第3个是数值上界）
      // （我第一版按"第3个参数存不存在"判断，结果把说明文字当成了区间上界，一次崩掉8条）
      if (typeof b === 'number') {
        const lo = Math.min(a, b), hi = Math.max(a, b);
        detail.push(f + ' 期望[' + lo + ',' + hi + '] 实得' + got + (note || ''));
        if (!(got >= lo && got <= hi)) problems.push(f + ' 期望落在 [' + lo + ',' + hi + ']，实得 ' + got);
      } else {
        const why = (typeof b === 'string') ? b : (note || '');
        detail.push(f + ' 期望' + (a > 0 ? '+' : '') + a + ' 实得' + (got > 0 ? '+' : '') + got + why);
        if (got !== a) problems.push(f + ' 期望 ' + a + '，实得 ' + got);
      }
    }
    for (const [f, a, b] of (cs.range || [])) {
      const got = delta(res, f);
      const lo = Math.min(a, b), hi = Math.max(a, b);      // 区间方向归一化：升序降序写法都接受
      detail.push(f + ' 期望[' + lo + ',' + hi + '] 实得' + got);
      if (!(got >= lo && got <= hi)) problems.push(f + ' 期望落在 [' + lo + ',' + hi + ']，实得 ' + got);
    }
    if (cs.mustLog && !cs.mustLog.test(logs.join(' '))) problems.push('日志里没有出现期望的被动/SP 记录');

    const line = (cs.char + ' · ' + cs.why.slice(0, 26)).padEnd(34) + ' ' + (detail.join('；') || '（仅日志断言）');
    if (problems.length) C.bad(line + '  ← ' + problems.join(' / '));
    else C.ok(line);

    console.log('     日志: ' + (logs.slice(-10).join(' | ') || '（无）'));
    console.log('     字段差异: ' + (diffs.slice(0, 8).join('; ') || '（无）'));
    await sleep(50);
  }
  process.exit(C.summary());
})().catch(e => { console.log('❌ 异常：' + (e && e.stack || e)); process.exit(1); });
