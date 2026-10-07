/* assets/decision.js —— "玩家正在决策"的唯一权威（2026-10-07 结构重写：账按窗口独立记）
 *
 *  ============================================================
 *  上一版为什么错（作者实测"AI 抢跑一直存在"，七轮都没修掉）：
 *    上一版用「**一个全局计数** + 一张 tag 表」表示"多个并存的窗口"，但两者不同步：
 *      · `leave(tag)` **不管这个 tag 存不存在，都减计数**（当时的理由：防"漏减 ⇒ 永久泄漏"）
 *      · 计数一到 0 就 `S.tags = {}` —— **整张表清空**
 *    ⇒ 一个"没有人类候选"的时点窗口开一次关一次，净减 2~3 次
 *    ⇒ 计数被推向 0 ⇒ **另一个还开着的人类窗口，标记被连带抹掉**
 *    ⇒ `__aiGuard` 读到"没有人类在决策" ⇒ **AI 抢跑**（实测 153ms 就发生，根本不用等 8 秒）
 *    实测证据：`enter A,B → count=2`；再 `leave('A')` 一次错配 ⇒ `count=0, tags=[]`，B 被连带清空。
 *    这就是"把漏减的补丁"换成"多减 + 连带清空"的典型 —— 补丁引出了反方向的症状。
 *
 *  这一版的规矩（每条都是为了"结构上不可能再错"）：
 *    ① **没有全局计数**：`count` 一律从表里派生（`Object.keys`）⇒ "计数与表不同步"这件事写不出来。
 *    ② `leave(tag)` **只删自己那个键**：tag 不存在 ⇒ **什么都不做**（只写一条诊断日志），绝不减别人的账。
 *    ③ **永不做整表清空**（只有显式 `reset()` 才清，且带原因）。
 *    ④ `enter` 幂等：同一个 tag 重复进只刷新，不叠加。
 *    ⑤ **不按时间摘账**：心跳只用来"写一条可见日志"（`WARN_MS`），**不改任何状态**。
 *       ——"靠时间猜"正是抢跑与卡死的共同来源（猜早了抢跑、猜晚了卡死），这里一律不猜。
 *    ⑥ tag 必须**按窗口唯一**（调用方负责，见 TW.open/close）⇒ 窗口 A 关闭不可能影响窗口 B。
 *
 *  自检：node assets/decision.js        # Node 下直接跑（不依赖浏览器）
 *  在页面里：<script src="assets/decision.js?v=N"></script> 先于 engine.js 加载 ✓
 */
(function (root) {
  'use strict';
  /* 只用于"写一条日志"的观测阈值：活过这么久还没 leave ⇒ 提示可能泄漏。
     ⚠ 它**不摘账、不改状态** —— 只让泄漏看得见，不替它做决定。 */
  var WARN_MS = 30000;
  var TICK_MS = 5000;

  /* 唯一存储：tag -> { seat, at }。没有第二个计数器。 */
  var S = { tags: {}, timer: null, warned: {} };

  function now() { return Date.now(); }
  function keys() { return Object.keys(S.tags); }
  function count() { return keys().length; }
  function log(msg) { try { if (typeof addBattleLog === 'function') addBattleLog('system', msg); } catch (e) {} }
  function mirror() {
    try { if (typeof battleState !== 'undefined' && battleState) battleState._awaitingDecision = count() > 0 ? count() : null; } catch (e) {}
  }
  function startWatch() { if (S.timer || typeof setInterval !== 'function') return; S.timer = setInterval(tick, TICK_MS); }
  function stopWatch() { if (S.timer) { try { clearInterval(S.timer); } catch (e) {} S.timer = null; } }

  /** 观测：只把"活得异常久"的 tag 写进日志，**不动账** ✓ */
  function tick() {
    var t = now();
    keys().forEach(function (k) {
      var rec = S.tags[k];
      if (!rec) return;
      if ((t - (rec.at || 0)) > WARN_MS && !S.warned[k]) {
        S.warned[k] = 1;
        log('【决策·存活提示】窗口「' + k + '」已开 ' + Math.round((t - rec.at) / 1000) + 's 还没关（座位=' +
          (rec.seat == null ? '未记录' : rec.seat) + '）—— 只提示，不摘账；若确属泄漏请查它的关闭出口');
      }
    });
  }

  var Decision = {
    WARN_MS: WARN_MS,
    STALE_MS: WARN_MS,          /* 兼容旧名：现在只用于日志，**不再摘账** */
    enter: function (tag, seat) {
      tag = String(tag || '?');
      var existed = !!S.tags[tag];
      S.tags[tag] = { seat: (seat == null) ? null : seat, at: now() };
      delete S.warned[tag];
      if (!existed) startWatch();
      mirror();
      return count();
    },
    leave: function (tag) {
      tag = String(tag || '?');
      /* 【2026-10-07】账一释放就**唤醒 AI 闸门**（它改用事件唤醒，不再靠 200ms 轮询）。
         放在这里是因为**所有**释放路径最终都走这一处（窗口关闭、精确按类释放、对账收账…），
         一处接住就全覆盖，不用在每个调用点各写一次（那正是"同一件事多份实现"的老毛病）。 */
      var __wake = function () { try { if (typeof __aiWake === 'function') __aiWake(); } catch (e) {} };
      if (!S.tags[tag]) {
        /* 关键：错配**什么都不做**。绝不再"不管存不存在都减" —— 那会把别人的账一起抹掉。
           只在"确实还有别的窗口开着"时才提醒（这时错配才可能有影响；否则纯噪声）。 */
        if (count() > 0) {
          try { log('【决策·配对提醒】leave("' + tag + '") 没有对应的 enter ⇒ 不动作（当前开着：' + keys().join('、') + '）'); } catch (e) {}
        }
        return count();
      }
      delete S.tags[tag];
      delete S.warned[tag];
      if (!count()) stopWatch();
      mirror();
      __wake();
      return count();
    },
    /** 续心跳：保留给"确实还开着"的窗口用（现在它只影响日志，不影响生死 ✓） */
    touch: function (tag) {
      if (tag == null) { keys().forEach(function (k) { if (S.tags[k]) S.tags[k].at = now(); }); return count(); }
      tag = String(tag);
      if (S.tags[tag]) S.tags[tag].at = now();
      return count();
    },
    /** 唯一判据 ✓ */
    isOpen: function () { return count() > 0; },
    /** 只统计"**人类**正在决策" ⇒ 供 AI 闸门用 ✓
     *  seat 未知的按"人类"处理（保守，防抢跑 ✓）。 */
    isHumanOpen: function (isAISeatFn) {
      var k, n = 0;
      for (k in S.tags) {
        if (!Object.prototype.hasOwnProperty.call(S.tags, k)) continue;
        var rec = S.tags[k]; if (!rec) continue;
        var seat = rec.seat;
        var isAI = false;
        try { isAI = (seat != null && typeof isAISeatFn === 'function') ? !!isAISeatFn(seat) : false; } catch (e) { isAI = false; }
        if (!isAI) n++;
      }
      return n > 0;
    },
    /** 全清（**只**用于异常收尾/回主界面等显式场合 ✓） */
    reset: function (why) {
      if (!count()) return 0;
      var had = keys().join('、');
      S.tags = {}; S.warned = {}; stopWatch(); mirror();
      log('【决策·复位】' + (why || '异常收尾') + ' ⇒ 清空全部决策标记（原有：' + had + '）');
      return 0;
    },
    snapshot: function () { return { count: count(), tags: keys(), alive: JSON.parse(JSON.stringify(S.tags)) }; },
    /** 仅测试用：把某 tag 的时间拨回 ms 毫秒前（用于验证"观测提示"✓） */
    _backdate: function (tag, ms) { if (S.tags[String(tag)]) S.tags[String(tag)].at = now() - (ms || 0); },
    _tick: tick        /* 供探针手动触发，不依赖真实定时器 ✓ */
  };

  try { root.Decision = Decision; } catch (e) {}
  try { if (typeof window !== 'undefined') window.Decision = Decision; } catch (e) {}
  if (typeof module !== 'undefined' && module.exports) module.exports = Decision;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));

/* ================= 自检（Node 直接跑：node assets/decision.js）================= */
if (typeof module !== 'undefined' && require.main === module) {
  const D = module.exports;
  let bad = 0;
  const chk = (ok, label, extra) => { if (!ok) bad++; console.log('   ' + (ok ? '✅' : '❌') + ' ' + label + (extra ? ' —— ' + extra : '')); };

  console.log('   —— ① 成对进出 ⇒ 归零 ——');
  D.enter('a'); D.enter('b');
  chk(D.isOpen() === true, '进入后 isOpen() = true', 'count=' + D.snapshot().count);
  D.leave('a'); D.leave('b');
  chk(D.isOpen() === false, '成对离开后 isOpen() = false', 'count=' + D.snapshot().count);

  console.log('   —— ② 幂等：重复 enter 不叠加 ——');
  D.enter('x'); D.enter('x'); D.enter('x');
  chk(D.snapshot().count === 1, 'enter 三次 ⇒ count 仍为 1', 'count=' + D.snapshot().count);
  D.leave('x');
  chk(D.isOpen() === false, 'leave 一次即归零', 'count=' + D.snapshot().count);

  console.log('   —— ③ ★核心保证：错配 leave **不许**影响别的账 ——');
  D.enter('A'); D.enter('B');
  D.leave('A');
  chk(D.isOpen() === true && D.snapshot().tags.join() === 'B', 'leave(A) 后 B 仍在', JSON.stringify(D.snapshot().tags));
  D.leave('A'); D.leave('A'); D.leave('压根没开过');
  chk(D.isOpen() === true && D.snapshot().tags.join() === 'B',
    '**再错配 leave 三次 ⇒ B 依然在**（上一版这里会被整表清空 ✗）', JSON.stringify(D.snapshot().tags));
  D.leave('B');
  chk(D.isOpen() === false, 'B 自己 leave 后才归零', 'count=' + D.snapshot().count);

  console.log('   —— ④ 不按时间摘账：超时只写日志 ——');
  D.enter('long');
  D._backdate('long', D.WARN_MS + 1000);
  D._tick();
  chk(D.isOpen() === true, '**心跳超时后账仍在**（不再自动摘除 ⇒ 不会再因此抢跑 ✓）', JSON.stringify(D.snapshot().tags));
  D.leave('long');
  chk(D.isOpen() === false, '仍然由 leave 结束');

  console.log('   —— ⑤ 旧字段不再影响判据 ——');
  try { globalThis.battleState = {}; } catch (e) {}
  try { battleState._awaitingDecision = { seat: 'p1', since: Date.now() }; } catch (e) {}
  chk(D.isOpen() === false, '外部直接赋值 battleState._awaitingDecision 不再让判据为真', String(D.isOpen()));

  console.log('   —— ⑥ reset 显式全清 ——');
  D.enter('p'); D.enter('q'); D.reset('自检');
  chk(D.isOpen() === false, 'reset 后归零');

  console.log(bad ? '   ❌ 失败 ' + bad + ' 项' : '   ✅ 全部通过');
  process.exit(bad ? 1 : 0);
}
