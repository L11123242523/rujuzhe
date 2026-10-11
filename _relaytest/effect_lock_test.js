/* 效果锁回归（用户报的"有概率卡死"）—— 第二轮：扫组合
 * ------------------------------------------------------------
 * 现象：发动【先哲之"馈赠"】把【来自地狱的盒子】送墓 → 盒子的SP（因卡效果送墓时触发）之后
 *       **结算锁没释放** → 所有手卡都提示"效果/连锁结算中，无法插入发动"，实际早已结算完。
 * 用户口径：只要文字描述因满足发动条件而被发动，就属于"效果产生"，并应开启连锁
 *          （道具卡 / 角色被动 / 角色SP / 角色携带卡 …… 一律如此）。
 * 第一版只测了"全接受 + SP选① + 只扔1张"，6 个种子都没残留 → 说明触发点在别的分支。
 * 这一版扫组合：SP 选项 ①② × 连锁接受/拒绝 × 送墓 1/2 张 × 多个种子。
 * 断言：跑完后 ①_resolveDepth==0 ②_chainLock==false ③效果栈为空 ④手中每张牌都能用。
 * 运行：node effect_lock_test.js
 */
'use strict';
const L = require('./lib/cardlab');
const H = require('./lib/harness');
const C = H.makeChecker('效果结算锁');

const BOX = '来自地狱的盒子';
const GIFT = '先哲之"馈赠"';

function lockState(S) {
  const e = S.effectEngine || {};
  return { depth: e._resolveDepth || 0, chainLock: !!e._chainLock,
    stack: (S.battleState && S.battleState.effectStack) ? S.battleState.effectStack.length : -1 };
}
/* 手里有多少张牌"因为效果结算中"而不能用 */
function blockedByResolve(S, who) {
  const p = S.battleState[who]; if (!p) return { n: -1, total: 0, sample: '' };
  let n = 0, sample = '';
  (p.hand || []).forEach(function (c) {
    let pv = null; try { pv = S.evaluatePlayable(c, who); } catch (e) { return; }
    if (pv && pv.ok === false && /效果\/连锁结算中/.test(String(pv.reason || ''))) { n++; if (!sample) sample = c.name + '：' + pv.reason; }
  });
  return { n: n, total: (p.hand || []).length, sample: sample };
}

async function runCase(opts) {
  const inst = L.bootCard({
    pickCards: (title, arr, n) => {
      const idx = (arr || []).findIndex(c => c && c.name === BOX);
      if (/送入墓地|至多两张|弃/.test(String(title)) && idx >= 0) {
        return opts.discardTwo ? (n >= 2 ? (idx === 0 ? [idx, idx + 1] : [idx]) : idx) : idx;
      }
      return n >= 2 ? (arr || []).map((c, i) => i).slice(0, n) : 0;
    },
    pickChoice: (title, arr) => {
      // 盒子SP 的选项：①回音韵 ②造判定伤害
      if (/来自地狱的盒子/.test(String(title))) return opts.spOption;
      return undefined;      // 交给默认策略
    },
    pickChain: (title, arr) => {
      if (opts.declineChain) { const i = (arr || []).findIndex(x => /不连锁|放弃|不发动/.test(String(x))); if (i >= 0) return i; }
      return undefined;
    }
  });
  L.startMatchWith(inst, { seed: opts.seed });
  await L.quiesce(inst, 9000);
  const S = inst.S, bs = S.battleState;
  if (!bs) return { err: '开局失败' };
  const gift = inst.g.card(GIFT), box = inst.g.card(BOX);
  const filler = (bs.p1.deck || []).slice(0, 4);
  // 手牌里**必须有盒子**（第一版我漏了这一步，于是"送墓"送的是别的牌、盒子SP根本没触发，
  // 16 个组合全部"通过"却没有测到要测的路径）
  bs.p1.hand = [gift, box].concat(filler); bs.p1.deck = (bs.p1.deck || []).slice(filler.length);
  bs.p1.cost = 12; bs.phase = 'main1'; bs.currentPlayer = 'p1';
  const logBefore = L.logsOf(bs).length;
  try { S.useCard(0); } catch (e) { return { err: '出牌抛错 ' + e.message }; }
  const q = await L.quiesce(inst, 15000);
  const logs = L.logsOf(S.battleState).slice(logBefore).join(' | ');
  return { st: lockState(S), blk: blockedByResolve(S, 'p1'), logs: logs, quiet: q, aa: inst.aa.log.slice(-6) };
}

(async () => {
  const combos = [];
  for (const spOption of [0, 1])
    for (const declineChain of [false, true])
      for (const discardTwo of [false, true])
        for (const seed of [1, 4])
          combos.push({ spOption, declineChain, discardTwo, seed });

  let leaked = 0, ran = 0;
  for (const c of combos) {
    const r = await runCase(c);
    const tag = 'SP选项' + (c.spOption === 0 ? '①' : '②') + (c.declineChain ? '+拒绝连锁' : '+接受连锁') +
      (c.discardTwo ? '+送墓2张' : '+送墓1张') + ' seed' + c.seed;
    if (r.err) { console.log('  ⚠ ' + tag + ' → ' + r.err); continue; }
    ran++;
    const ok = r.st.depth === 0 && !r.st.chainLock && r.blk.n === 0;
    if (!ok) leaked++;
    const boxFired = /来自地狱的盒子/.test(r.logs);
    console.log('  ' + (ok ? '✅' : '❌') + ' ' + tag.padEnd(34) +
      ' 深度=' + r.st.depth + ' 连锁锁=' + r.st.chainLock + ' 栈=' + r.st.stack +
      ' 卡住=' + (r.blk.n === 0 ? 0 : r.blk.n + '/' + r.blk.total) + ' 盒子SP=' + (boxFired ? '触发' : '未触发'));
    if (!ok) {
      console.log('      样例理由：' + String(r.blk.sample).slice(0, 130));
      console.log('      日志尾部：' + r.logs.split(' | ').slice(-10).join(' | ').slice(0, 500));
      console.log('      自动应答：' + (r.aa || []).join(' | ').slice(0, 300));
    }
    await L.sleep(60);
  }
  C.truthy('至少跑了 8 个组合', ran >= 8, ran + ' 个');
  C.eq('出现"结算锁残留"的组合数（必须是 0）', leaked, 0);

  // ---- 看门狗本身：正常流程绝不能触发 ----
  console.log('\n[看门狗] 正常流程不应触发');
  {
    const inst = L.bootCard({ pickCards: (t, arr, n) => (n >= 2 ? (arr || []).map((c, i) => i).slice(0, n) : 0) });
    L.startMatchWith(inst, { seed: 3 });
    await L.quiesce(inst, 9000);
    const S = inst.S, bs = S.battleState;
    const gift = inst.g.card(GIFT), box = inst.g.card(BOX);
    bs.p1.hand = [gift, box]; bs.p1.cost = 12; bs.phase = 'main1'; bs.currentPlayer = 'p1';
    try { S.useCard(0); } catch (e) {}
    await L.quiesce(inst, 15000);
    await L.sleep(12000);                       // 静置 12 秒：看门狗在跑，但没有残留锁就不该出声
    const logs = L.logsOf(S.battleState).join(' ');
    C.truthy('正常流程静置 12 秒后没有出现"结算锁残留"日志', !/【效果锁】/.test(logs),
      (/【效果锁】/.test(logs) ? '❌ 误报：' + (logs.match(/【效果锁】[^|]*/) || [''])[0] : '无'));
  }

  // ---- 看门狗本身：人为造出残留锁，必须自动复位（可见地） ----
  console.log('\n[看门狗] 残留锁必须自动复位');
  {
    const inst = L.bootCard();
    L.startMatchWith(inst, { seed: 5 });
    await L.quiesce(inst, 9000);
    const S = inst.S, bs = S.battleState;
    bs.p1.cost = 12; bs.phase = 'main1'; bs.currentPlayer = 'p1';
    const before = L.logsOf(bs).length;
    // 人为制造"有锁但没人在等"的残留（模拟漏掉的释放路径）
    S.effectEngine._resolveDepth = 2;
    S.effectEngine._chainLock = true;
    if (bs.effectStack) bs.effectStack.push({ description: '（人工造的假效果）' });
    const t0 = Date.now();
    let cleared = false;
    for (let i = 0; i < 16; i++) {
      await L.sleep(1000);
      const e = S.effectEngine;
      if ((e._resolveDepth || 0) === 0 && !e._chainLock) { cleared = true; break; }
    }
    const st = lockState(S);
    const newLogs = L.logsOf(S.battleState).slice(before).join(' ');
    C.truthy('残留锁在 ~15 秒内被自动复位', cleared, '用时约 ' + Math.round((Date.now() - t0) / 1000) + ' 秒，深度=' + st.depth + ' 连锁锁=' + st.chainLock);
    C.truthy('复位时写了可见日志（不静默）', /【效果锁】/.test(newLogs), (newLogs.match(/【效果锁】[^|]*/) || ['（无）'])[0].slice(0, 90));
    C.eq('效果栈也被清空', st.stack, 0);
    const blk = blockedByResolve(S, 'p1');
    C.eq('复位后手牌不再因"结算中"而不能用', blk.n, 0);
  }

  // ---- 泄漏定位标记：复位日志必须指出"最后一次上锁位置" ----
  console.log('\n[泄漏定位] 复位日志必须带上最后一次上锁位置');
  {
    // 静态：5 个"上锁入口"前面都要有 __eeMarkInc(...)，且标记必须紧邻
    // 【2026-10-07】v78 把 5 处裸 `+1` 收敛成了 `__eeDepthAdd(...)` 助手 ⇒ 断言改为**同时认两种形态**。
    //   期望值仍是 5（没改数字迁就）；改的只是"识别写法"，否则套件会把一次正确的重构判成红。
    const fs = require('fs');
    const path = require('path');
    const src = require('./lib/appsrc').appSource();
    const RAW = /_resolveDepth\s*=\s*\(?[A-Za-z_$][\w$]*\._resolveDepth\s*\|\|\s*0\)\s*\+\s*1/;
    const HELPER = /__eeDepthAdd\(/;          // 注意：其中一处写在行中间（与别的语句同行）⇒ 不能用行首锚点
    const isDef = (l) => /function\s+__eeDepthAdd\(/.test(l);   // 定义行不算入口
    const lines = src.split('\n');
    /* 【2026-10-07】标记的实参可以是**变量**（runOps 现在带上卡名，便于线上认出是哪张卡的链没跑完），
       所以匹配不能再要求字符串字面量 —— 断言的本意是"每个上锁入口前面必须有 __eeMarkInc"，保持不变。
       计数时剔掉定义行 `function __eeMarkInc(`。 */
    const MARK = /__eeMarkInc\(/;
    const isMarkDef = (l) => /function\s+__eeMarkInc\s*\(/.test(l);
    let markCount = 0;
    for (let i = 0; i < lines.length; i++) { if (!isMarkDef(lines[i]) && MARK.test(lines[i])) markCount++; }
    let incSites = 0, unmarked = 0;
    for (let i = 0; i < lines.length; i++) {
      if (isDef(lines[i])) continue;
      if (!(RAW.test(lines[i]) || HELPER.test(lines[i]))) continue;
      incSites++;
      if (!MARK.test(lines[i - 1] || '')) unmarked++;
    }
    const marks = markCount;
    C.eq('源码中的结算深度上锁入口数量', incSites, 5);
    C.eq('每个上锁入口前都有 __eeMarkInc 标记（未标记数）', unmarked, 0);
    C.eq('标记数量与上锁入口一致', marks, incSites);
    C.truthy('标记用的位置名可读（不是匿名行号）', /__eeMarkInc\('dealDamageWithResponse/.test(src),
      (src.match(/__eeMarkInc\('[^']+'\)/g) || []).join(' , ').slice(0, 160));
    C.truthy('__eeMarkInc 已定义在源码中', /function __eeMarkInc\(site\)/.test(src), /function __eeMarkInc/.test(src) ? '已定义' : '缺失');

    const inst = L.bootCard();
    L.startMatchWith(inst, { seed: 5 });
    await L.quiesce(inst, 9000);
    const S = inst.S, bs = S.battleState;
    bs.p1.cost = 12; bs.phase = 'main1'; bs.currentPlayer = 'p1';
    C.truthy('__eeMarkInc 可从全局调用', typeof S.__eeMarkInc === 'function', typeof S.__eeMarkInc);
    S.__eeMarkInc('L99001');
    C.eq('标记写入了最后一次上锁位置', (S.effectEngine._lastInc || {}).site, 'L99001');
    const before = L.logsOf(bs).length;
    S.effectEngine._resolveDepth = 1;
    S.effectEngine._chainLock = true;
    let cleared = false;
    for (let i = 0; i < 16; i++) {
      await L.sleep(1000);
      if ((S.effectEngine._resolveDepth || 0) === 0 && !S.effectEngine._chainLock) { cleared = true; break; }
    }
    const newLogs = L.logsOf(S.battleState).slice(before).join(' | ');
    C.truthy('残留锁被复位', cleared, '深度=' + S.effectEngine._resolveDepth);
    C.truthy('复位日志指出了上锁位置 L99001', /最后一次上锁位置：L99001/.test(newLogs),
      (newLogs.match(/【效果锁】[^|]*/) || ['（无）'])[0].slice(0, 110));
    C.truthy('复位后会立刻给客人补推快照（联机时客人的可用性来自房主快照）',
      /Online\.active && !Online\.isGuest[\s\S]{0,160}_sendSnapshotNow/.test(src),
      /_sendSnapshotNow/.test(src) ? '已接入' : '缺失');
  }

  // ---- 根因加固：连锁逆结算内抛错绝不能留下 _chainLock ----
  console.log('\n[加固] 逆结算内抛错必须释放连锁锁');
  {
    const inst = L.bootCard();
    L.startMatchWith(inst, { seed: 7 });
    await L.quiesce(inst, 9000);
    const S = inst.S, bs = S.battleState;
    const box = inst.g.card(BOX);

    // (1) 送墓触发送墓时点（checkGraveTrigger）抛错：逐张隔离，连锁必须继续走完
    let done1 = false, err1 = null;
    const origCGT = S.checkGraveTrigger;
    S.checkGraveTrigger = function () { throw new Error('人工注入：送墓触发异常'); };
    try {
      S.resolveChainStack({
        _chain: [{ kind: 'set', by: 'p1', name: '（人工）连锁环1', from: 3, to: 5 }],
        _pendingGrave: [{ player: 'p1', card: box, name: box.name }],
        moveAmount: 3, player: 'p1', description: '（人工）测试逆结算'
      }, function () { done1 = true; });
    } catch (e) { err1 = e; }
    await L.sleep(1500);
    S.checkGraveTrigger = origCGT;
    const logs1 = L.logsOf(S.battleState).join(' | ');
    C.eq('注入送墓异常后调用方未被抛出打断', err1, null);
    C.truthy('逆结算仍然收尾（onDone 被调用）', done1, done1 ? '已收尾' : '❌ 未收尾');
    C.eq('连锁锁已释放', !!S.effectEngine._chainLock, false);
    C.truthy('异常被明确写进战斗日志（不静默）', /送墓触发【来自地狱的盒子】异常，已跳过并继续结算/.test(logs1),
      (logs1.match(/【连锁】送墓触发[^|]*/) || ['（无）'])[0].slice(0, 100));

    // (2) 逆结算中另一处抛错（动画层）：外层 try/catch 兜底收尾
    let done2 = false;
    const CA = S.ChainAnim;
    let origFlash = null;
    if (CA && typeof CA.flash === 'function') { origFlash = CA.flash; CA.flash = function () { throw new Error('人工注入：动画异常'); }; }
    const depthBefore = S.effectEngine._resolveDepth || 0;
    try {
      S.resolveChainStack({
        _chain: [{ kind: 'set', by: 'p1', name: '（人工）连锁环2', from: 3, to: 6 }],
        _pendingGrave: [], moveAmount: 3, player: 'p1', description: '（人工）测试逆结算2'
      }, function () { done2 = true; });
    } catch (e) { /* 外层应自行兜底 */ }
    await L.sleep(1500);
    if (CA && origFlash) CA.flash = origFlash;
    C.truthy('动画层抛错时逆结算仍被强制收尾', done2, done2 ? '已收尾' : '❌ 未收尾');
    C.eq('动画层抛错后连锁锁已释放', !!S.effectEngine._chainLock, false);
    C.eq('动画层抛错后结算深度回到注入前的值', S.effectEngine._resolveDepth || 0, depthBefore);
  }

  // ---- 高风险真实路径：琉璃被动"判定伤害后"在累计阈值处抽2选1弃（弹窗内插弹窗） ----
  /* 这条路径是"弹窗里再开弹窗 + 连锁逆结算"，是用户报的盒子场景最像的高危路线。
     第一版我**从整条馈赠链**驱动它，结果在满载跑批里偶发失败（实测：单跑 1 次通过、随后 4 次失败），
     原因是长链里夹着判定动画/连锁窗口，负载下轮询窗口不够，而且我的"到达判据"用的是宽正则
     `/判定伤害/`，会命中卡面回显等无关行 → 误判成"已到达"、于是不重试，接着严格断言就红。
     现在改成**直接命中风险点本身**：设好累计计数后调用 `dealDamageWithResponse(..., {judge:true})`
     （这正是 `__finish → resolveSimultaneous → 抽2选1弃` 的入口），判据收紧成只认 `累计4次`，
     轮询窗口 40 秒，最多重试 3 次。这样测的仍然是同一条高危路径，但不再受长链时序影响。 */
  console.log('\n[高风险路径] 琉璃被动累计阈值（抽2选1弃）后锁必须释放');
  {
    async function attempt(no) {
      const inst = L.bootCard({
        pickCards: (title, arr, n) => (n >= 2 ? (arr || []).map((c, i) => i).slice(0, n) : 0)
      });
      L.startMatchWith(inst, { team: ['小沙香琉璃'], seed: 6 });
      await L.quiesce(inst, 14000);
      const S = inst.S, bs = S.battleState;
      if (!bs || bs.p1._ruriPassive !== true) {
        return { inst, S, bs, reached: false, why: '琉璃被动未注册（队伍=' + ((bs && (bs.p1.deck_chars || bs.p1.chars) || []).map(c => c && c.name).join('/') || '?') + '）', logs: '' };
      }
      bs.p1._ruriJudgeCount = 3;          // 本次判定后 = 4 → 触发"抽2选1弃 + 全队判定伤害+1"【2026-10-11 第二次平衡性调整：首档 3→4】
      bs.p1._judgeDamageBonus = 0;
      bs.p2.sync = 30; bs.p1.sync = 30;
      const logBefore = L.logsOf(bs).length;
      try {
        S.dealDamageWithResponse('p2', 3, '（自测）判定伤害', null, null, 'p1', { judge: true });
      } catch (e) { console.log('      第' + no + '次造伤抛错：' + e.message); }
      /* 【S-c】本套件里有几条用例是**专门验"自愈/复位"**的 ⇒ 在这里显式把阈值调小（6 秒）。
         这样两件事可以同时成立：**线上绝不抢跑**（5 分钟异常兜底），**自愈机制仍被真实测到**。
         （不再像以前那样"因为线上 6 秒就抢跑，所以测试碰巧过了"。） */
      try {
        /* 【S-c】用**引擎实例字段**（effectEngine._staleMsOverride）—— 沙箱的 window 不是这里设的那个对象，
           我第一版设 window.__EE_STALE_MS_OVERRIDE 完全没生效（6 条测自愈的用例全红）。 */
        if (S.effectEngine) S.effectEngine._staleMsOverride = 6000;
      } catch (e) {}
      let reached = false;
      for (let i = 0; i < 40 && !reached; i++) {   // 只认阈值日志（最多 40 秒）
        await L.sleep(1000);
        /* 【S-a】每拍采样相位；并**诊断**：深度>0 时记下"当时最后一条日志" ⇒ 用来定位是谁加了深度没减 */
        try {
          if (typeof S.__phaseSnapshot === 'function') {
            const __p = S.__phaseSnapshot();
            if (__p.resolveDepth > 0 && i < 14) {
              const __lg = String(L.logsOf(S.battleState).slice(-1)[0] || '');
              console.log('        [深度诊断] 第' + i + '拍 depth=' + __p.resolveDepth + ' phase=' + __p.phase + ' @ ' + __lg.slice(0, 72));
            }
          }
        } catch (e) {}
        if (/累计4次/.test(L.logsOf(S.battleState).slice(logBefore).join(' | '))) reached = true;
      }
      await L.quiesce(inst, 8000);
      /* 【2026-10-06】琉璃的"谈窗"改走统一决策通道 ENV.ask 之后，答案回调比原来直接调 showChoiceModal
         多一跳异步 ⇒ 再等一小会，让"抽2选1弃"整段收尾（否则结算深度还停在 1，会被误判成泄漏）。
         注意：这是**等正确的时机**，不是放宽期望 —— 下面的期望值一个字没改。 */
      await L.quiesce(inst, 4000);
      return { inst, S, bs, reached, logs: L.logsOf(S.battleState).slice(logBefore).join(' | '),
        why: '未到达阈值（40 秒内没有"累计4次"；说明判定伤害→琉璃被动这条链没走完）' };
    }

    let r = null;
    for (let n = 1; n <= 3; n++) {
      r = await attempt(n);
      console.log('      第' + n + '次：到达阈值=' + (r.reached ? '是' : '否（' + r.why + '）'));
      if (r.reached) break;
      await L.sleep(500);
    }
    if (!r.reached) {
      console.log('      三次都没到达阈值，完整日志如下（不静默跳过）：');
      console.log('        ' + String(r.logs || '（无新增日志）').split(' | ').join('\n        ').slice(0, 2200));
    }
    C.truthy('琉璃当队长后被动 _ruriPassive 已注册（前提条件）', r.bs && r.bs.p1._ruriPassive === true, r.why || '已注册');
    C.truthy('用例确实走到了"判定伤害→琉璃被动累计阈值"（最多重试 3 次）', r.reached, r.reached ? '已到达' : r.why);
    if (r.reached) {
      const st = lockState(r.S), blk = blockedByResolve(r.S, 'p1');
      console.log('      深度=' + st.depth + ' 连锁锁=' + st.chainLock + ' 栈=' + st.stack + ' 卡住=' + blk.n + '/' + blk.total +
        ' 被动触发=' + (/琉璃被动/.test(r.logs) ? '是' : '否') + ' 阈值抽弃=' + (/累计4次/.test(r.logs) ? '是' : '否') +
        ' 判定增伤=' + (r.S.battleState.p1._judgeDamageBonus || 0));
      C.eq('阈值路径后结算深度归零', st.depth, 0);
      C.eq('阈值路径后连锁锁已释放', st.chainLock, false);
      C.eq('阈值路径后没有手卡被判为"结算中不能用"', blk.n, 0);
      /* 【S-a 验收 2026-10-06】演出期状态机：本用例本来就会跑到"判定→琉璃阈值"的真实结算，
         正好用它来验证"迁移成对、跑完回 idle"（不必另造对局）。 */
      try {
        const ph = (typeof r.S.__phaseSnapshot === 'function') ? r.S.__phaseSnapshot() : null;
        /* 【S-a 诊断】若最终仍卡着深度 ⇒ 把迁移留痕与最后几条日志打出来定位泄漏点 */
        if (ph && ph.resolveDepth > 0) {
          console.log('      [泄漏定位] depth=' + ph.resolveDepth + ' phase=' + ph.phase + ' trail=' + JSON.stringify(ph.trail));
          /* 【现场快照】把"谁还在等/谁还锁着"一次打全，别一轮一轮猜 */
          try {
            const D = r.S.Decision;
            let wins = '';
            try { wins = (D && typeof D.keys === 'function') ? JSON.stringify(D.keys()) : (D && D._open ? JSON.stringify(Object.keys(D._open)) : '(无法列举)'); } catch (e) { wins = '(列举失败)'; }
            console.log('      [现场] Decision窗口=' + wins +
              ' ｜ _awaitingDecision=' + JSON.stringify(r.S.battleState && r.S.battleState._awaitingDecision));
          } catch (e) { console.log('      [现场] Decision 读取失败：' + e.message); }
          try {
            const ee = r.S.effectEngine || {};
            console.log('      [现场] chainLock=' + !!ee._chainLock + ' inNewChain=' + !!ee._inNewChain +
              ' pendingTriggers=' + ((ee._pendingTriggers || []).length) +
              ' isProcessing=' + !!ee.isProcessing +
              ' 等待原因=' + (typeof r.S.__eeWaitReason === 'function' ? JSON.stringify(r.S.__eeWaitReason()) : '?'));
          } catch (e) { console.log('      [现场] effectEngine 读取失败：' + e.message); }
          try { console.log('      [现场] TW.active=' + (r.S.TW && r.S.TW.active ? ('#' + r.S.TW.active.id + '/' + r.S.TW.active.state + '/' + r.S.TW.active.type + ' 环=' + (r.S.TW.active.chain || []).length) : 'null')); } catch (e) {}
          console.log('      [泄漏定位] 最后 5 条日志：');
          String(r.logs || '').split(' | ').slice(-5).forEach(function (s) { console.log('        · ' + String(s).slice(0, 92)); });
        }
        C.truthy('S-a：状态机可用（__phaseSnapshot）', !!ph, ph ? ('phase=' + ph.phase) : '不可用');
        if (ph) {
          C.truthy('S-a：过程中**确实进入过结算相位**（状态机不是死字段）', ph.enter > 0, 'enter=' + ph.enter + ' leave=' + ph.leave);
          C.eq('S-a：迁移成对（enter 次数 === leave 次数）', ph.enter, ph.leave);
          C.eq('S-a：跑完后 _phase 回到 idle（唯一可操作的时刻）', ph.phase, 'idle');
        }
      } catch (e) { C.truthy('S-a 断言执行', false, String(e && e.message)); }
      C.truthy('阈值效果确实执行了（不仅没卡死，还要真的生效）', /累计4次/.test(r.logs),
        (r.logs.match(/【琉璃被动】[^|]*/g) || ['（无琉璃被动日志）']).join(' ; ').slice(0, 220));
      C.eq('阈值还给全队判定伤害+1（卡面：全队造成的判定伤害+1）', r.S.battleState.p1._judgeDamageBonus || 0, 1);
    }
  }

  process.exit(C.summary());
})().catch(e => { console.log('❌ 异常：' + (e && e.stack || e)); process.exit(1); });
