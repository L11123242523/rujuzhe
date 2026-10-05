/* assets/decision.js —— 【机制级重写·批次1】"玩家正在决策"的唯一权威
 *
 *  为什么重写（实测证据）：旧实现 `battleState._awaitingDecision` 有**两种互不兼容的类型** ✗
 *    · __decideEnter：`= (旧值 || 0) + 1`                        ← 数字（计数器）
 *    · 时点窗口(7065)：`= 候选数 ? {seat,label,since} : null`    ← 对象 ✗
 *    ⇒ 对象再进 `(旧值||0)+1` ⇒ 变字符串 "[object Object]1" ⇒ `n > 0` 失效 ⇒ **永不归零**
 *    ⇒ 尊重它 = 卡死；无视它 = 抢跑（作者两个症状同源）✓
 *
 *  本模块的设计（单一职责、可独立测试）：
 *    · **唯一存储**在自己内部（count + tags{tag: 心跳时间}）✓ 判据只读它 ✓
 *      ⇒ 任何地方再"直接赋值 battleState._awaitingDecision"都**不再影响判据** ✓（这是止血的关键 ✓）
 *    · `enter(tag)` / `leave(tag)` 成对；`touch(tag)` 续心跳（给"确实开着的窗口"用 ✓）
 *    · **自愈看门狗**（每 500ms）：某 tag 心跳超过 STALE_MS 没续 ⇒ 判为泄漏 ⇒ 摘掉它 + 写日志 ✓
 *    · `isOpen()` = count > 0（唯一判据，供 __playerDeciding / __decideWaitGate / __phaseWaitBusy / __aiGuard 用）
 *    · 兼容镜像：进入/离开时把 `battleState._awaitingDecision` 写成数字（**只写不读** ✓），
 *      便于旧日志/调试观察；判据一律不看它 ✓
 *
 *  自检：node assets/decision.js        # Node 下直接跑 6 条用例（不依赖浏览器）
 *  在页面里：<script src="assets/decision.js?v=N"></script> 先于 engine.js 加载 ✓
 */
(function (root) {
  'use strict';
  var STALE_MS = 8000;      /* 心跳超过 8 秒没续 ⇒ 判为泄漏 */
  var TICK_MS = 500;

  var S = { count: 0, tags: {}, timer: null };

  function now() { return Date.now(); }
  function keys() { var a = [], k; for (k in S.tags) if (S.tags[k]) a.push(k); return a; }
  function log(msg) { try { if (typeof addBattleLog === 'function') addBattleLog('system', msg); } catch (e) {} }
  function mirror() {
    try { if (typeof battleState !== 'undefined' && battleState) battleState._awaitingDecision = S.count > 0 ? S.count : null; } catch (e) {}
  }
  function startWatch() { if (S.timer || typeof setInterval !== 'function') return; S.timer = setInterval(tick, TICK_MS); }
  function stopWatch() { if (S.timer) { try { clearInterval(S.timer); } catch (e) {} S.timer = null; } }

  /** 自愈：摘掉心跳过期的 tag（真开着的窗口会持续 touch ⇒ 不会被摘 ✓） */
  function tick() {
    var t = now(), stale = [], k;
    for (k in S.tags) { if (S.tags[k] && (t - S.tags[k]) > STALE_MS) stale.push(k); }
    if (!stale.length) return;
    stale.forEach(function (tag) { delete S.tags[tag]; S.count = Math.max(0, S.count - 1); });
    log('【自愈】清掉泄漏的"玩家正在决策"标记：' + stale.join('、') + '（心跳超时 ' + Math.round(STALE_MS / 1000) + 's）');
    if (S.count <= 0) { S.count = 0; S.tags = {}; stopWatch(); }
    mirror();
    try { if (typeof updateBattleUI === 'function') updateBattleUI(); } catch (e) {}
  }

  var Decision = {
    STALE_MS: STALE_MS,
    enter: function (tag) {
      tag = String(tag || '?');
      S.tags[tag] = now();
      S.count++;
      startWatch();
      mirror();
      return S.count;
    },
    leave: function (tag) {
      tag = String(tag || '?');
      if (S.tags[tag]) delete S.tags[tag];
      S.count = Math.max(0, S.count - 1);
      if (!S.count) { S.tags = {}; stopWatch(); }
      mirror();
      return S.count;
    },
    /** 续心跳：给"确实开着的窗口/正在等待的弹窗"用 ✓ */
    touch: function (tag) { if (tag != null) { if (S.tags[String(tag)]) S.tags[String(tag)] = now(); } else { Object.keys(S.tags).forEach(function (k) { S.tags[k] = now(); }); } },
    /** 唯一判据 ✓ */
    isOpen: function () { return S.count > 0; },
    /** 全清（异常收尾/回主界面用 ✓） */
    reset: function (why) {
      if (!S.count && !keys().length) return;
      S.count = 0; S.tags = {}; stopWatch(); mirror();
      log('【决策·复位】' + (why || '异常收尾') + ' ⇒ 清空全部决策标记');
    },
    snapshot: function () { return { count: S.count, tags: keys(), alive: JSON.parse(JSON.stringify(S.tags)) }; },
    /** 仅测试用：把某 tag 的心跳拨回 ms 毫秒前（用于验证自愈 ✓） */
    _backdate: function (tag, ms) { if (S.tags[String(tag)]) S.tags[String(tag)] = now() - (ms || 0); },
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
  console.log('   —— ① 成对进出 ⇒ 必须归零 ——');
  D.enter('a'); D.enter('b');
  chk(D.isOpen() === true, '进入后 isOpen() = true');
  D.leave('a'); D.leave('b');
  chk(D.isOpen() === false, '成对离开后 isOpen() = false', 'count=' + D.snapshot().count);

  console.log('   —— ② 泄漏（只进不出）⇒ 看门狗必须自愈 ——');
  D.enter('leak');
  chk(D.isOpen() === true, '泄漏期间 isOpen() = true');
  D._tick();
  chk(D.isOpen() === true, '未超时 ⇒ 不自愈（**不许误清真窗口**）');
  D._backdate('leak', D.STALE_MS + 1000);        /* 把心跳拨回 9 秒前 */
  D._tick();                                      /* 看门狗出手 */
  chk(D.isOpen() === false, '**心跳超时 ⇒ 自愈清掉泄漏标记**', JSON.stringify(D.snapshot()));

  console.log('   —— ②b 真窗口（持续 touch）不许被误清 ——');
  D.enter('win');
  for (let i = 0; i < 3; i++) { D._backdate('win', D.STALE_MS + 1000); D.touch('win'); D._tick(); }
  chk(D.isOpen() === true, '**持续续心跳 ⇒ 一直不被清**（真窗口安全）');
  D.reset('自检收尾');
  chk(D.isOpen() === false, 'reset 后 isOpen() = false');

  console.log('   —— ③ 旧字段不再影响判据（止血的关键）——');
  try { globalThis.battleState = {}; } catch (e) {}
  try { battleState._awaitingDecision = { seat: 'p1', since: Date.now() }; } catch (e) {}
  chk(D.isOpen() === false, '**外部直接赋值 battleState._awaitingDecision 不再让判据为真**', String(D.isOpen()));

  console.log(bad ? '   ❌ 失败 ' + bad + ' 项' : '   ✅ 全部通过');
  process.exit(bad ? 1 : 0);
}
