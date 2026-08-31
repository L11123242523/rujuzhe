/* =====================================================================
 * 入局者 · 纯对战引擎核心（阶段 0：联机 PvP 地基）
 * ---------------------------------------------------------------------
 * 本文件【不依赖 DOM / window / document / Math.random / setTimeout】。
 *  - 浏览器：挂到 window.RJEngine（由 sync_engine.py 内联进 game.html）
 *  - Node  ：module.exports = require('./js/engine_core.js')，可直接单测
 *
 * 阶段 0 目标：把“与界面无关、必须双方一致”的规则抽成纯函数，做到
 *   同一份 state + 同一个注入随机种子 + 同一串 action => 同一结果，
 *   为方案 A（权威服务器 + WebSocket）做准备。UI 层只负责渲染与回传意图。
 *
 * 当前已抽取：可注入随机源 RNG、回合阶段机、响应/连锁窗口机、连锁卡分类。
 * 后续阶段继续把卡牌效果结算、移动、伤害等迁入，逐步替代 game.html 内的散落实现。
 * ===================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RJEngine = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ============================ 可注入随机源 ============================
   * mulberry32：确定性 PRNG。联机时由权威服务器下发种子，双方据此得到
   * 完全一致的骰子/硬币/洗牌序列，从根上避免“两边随机结果不同导致分叉”。
   * 单机不注入种子时，用时间做种子，行为与 Math.random 同样不可预测。 */
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function nowSeed() {
    var t = (typeof Date !== 'undefined' ? Date.now() : 0) >>> 0;
    var p = (typeof performance !== 'undefined' && performance.now ? Math.floor(performance.now() * 1000) : 0) >>> 0;
    return (t ^ p) >>> 0;
  }
  function createRNG(seed) {
    var _r = (seed === undefined || seed === null) ? mulberry32(nowSeed()) : mulberry32(seed);
    return {
      seed: (seed === undefined || seed === null) ? null : (seed >>> 0),
      next: function () { return _r(); },                              // [0,1)
      int: function (n) { return Math.floor(_r() * n); },              // 整数 [0,n)
      range: function (a, b) { return a + Math.floor(_r() * (b - a + 1)); }, // 整数 [a,b]
      dice: function (sides) { return 1 + Math.floor(_r() * (sides || 6)); }, // 骰点 [1,sides]
      coin: function () { return _r() < 0.5; },                        // 布尔正反
      pick: function (arr) { return (arr && arr.length) ? arr[Math.floor(_r() * arr.length)] : null; },
      // Fisher–Yates：返回打乱后的新数组（不改原数组）
      shuffled: function (arr) {
        var out = arr.slice();
        for (var i = out.length - 1; i > 0; i--) {
          var j = Math.floor(_r() * (i + 1)), tmp = out[i]; out[i] = out[j]; out[j] = tmp;
        }
        return out;
      },
      // 原地打乱（兼容旧 shuffleArray 的就地语义）
      shuffleInPlace: function (arr) {
        for (var i = arr.length - 1; i > 0; i--) {
          var j = Math.floor(_r() * (i + 1)), tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
      },
      reseed: function (s) { _r = mulberry32(s); this.seed = s >>> 0; return this; }
    };
  }

  /* ============================== 回合阶段机 ==============================
   * 正常阶段顺序；连锁/响应窗口【不改变阶段】，只在当前阶段上叠加一个待响应窗口。 */
  var PHASES = { PREPARE: 'prepare', MAIN1: 'main1', ROLL: 'roll', MAIN2: 'main2', END: 'end' };
  var PHASE_ORDER = ['prepare', 'main1', 'roll', 'main2', 'end'];
  function nextPhase(cur) {
    var i = PHASE_ORDER.indexOf(cur);
    if (i < 0) return null;
    return PHASE_ORDER[(i + 1) % PHASE_ORDER.length];
  }
  // 纯阶段可发动性（不含费用/对象，那些在合法性层）：技能卡=全时点(投掷阶段除外)，
  // 盖伏翻开任意阶段，普通卡仅主要阶段。
  function canPlayCardInPhase(phase, opts) {
    opts = opts || {};
    if (opts.fromFaceDown) return { ok: true };
    if (opts.isSkill && phase !== 'roll') return { ok: true };
    if (phase === 'main1' || phase === 'main2') return { ok: true };
    return { ok: false, reason: '当前阶段不能手动发动' };
  }

  /* ============================ 响应/连锁窗口机 ============================
   * 四类“结果已出现、但尚未适用”的窗口，双方可在此连锁，连续两方放弃才适用。 */
  var WINDOWS = { DICE: 'dice_result', MOVE: 'move', DAMAGE: 'damage', RAND: 'rand' };
  // 连锁卡分类（纯文本判定，唯一事实源，UI 的 isChainOnlyCard/__matchStage 都委托到这里）
  //   dice_set     修改骰子点数（遥控骰子/特制手套）
  //   reverse      改变移动方向（颠倒骰子）
  //   move_adjust  位移量增减 / 打断移动（侦探放大镜/猎手爪链）
  //   negate_damage 抵消即将受到的伤害（幸运护符等）
  function classifyChainCard(card) {
    var name = (card && card.name) || '';
    var eff = (card && (card.effect || card.text)) || '';
    var isReverse = name.indexOf('颠倒骰子') >= 0 || /改变[^。；]*方向/.test(eff);
    var isDiceSet = name.indexOf('遥控骰子') >= 0 || name.indexOf('特制手套') >= 0 ||
      eff.indexOf('修改一次掷骰结果') >= 0 || eff.indexOf('修改骰子点数') >= 0;
    // 必须是作用于“一次/一名玩家 即将发生的移动”的响应连锁短语；
    // 不能只凭“位移量/打断”单词匹配，否则会把“自己之后移动/打断自己再前往”的主动卡误判为连锁卡
    var isMoveAdjust = /让一次移动|一次移动的位移量|位移量增减|打断一名玩家的移动|打断一次移动/.test(eff) ||
      name.indexOf('侦探放大镜') >= 0 || name.indexOf('猎手爪链') >= 0;
    var isNegate = eff.indexOf('抵消') >= 0 && eff.indexOf('伤害') >= 0;
    if (isReverse) return 'reverse';
    if (isDiceSet) return 'dice_set';
    if (isMoveAdjust) return 'move_adjust';
    if (isNegate) return 'negate_damage';
    return null;
  }
  function isChainCard(card) { return classifyChainCard(card) !== null; }
  // 某窗口下该类连锁卡能否介入（纯规则）
  function chainableAt(windowStage, cardKind) {
    switch (windowStage) {
      case 'dice_result': return cardKind === 'dice_set' || cardKind === 'reverse';
      case 'move':        // 移动将执行：纯改点已无原始骰子对象；改方向/增减/打断仍可
        return cardKind === 'reverse' || cardKind === 'move_adjust';
      case 'damage':      return cardKind === 'negate_damage';
      case 'rand':        return cardKind === 'dice_set';
      default: return false;
    }
  }
  // 对方先响应，轮流询问；turnIdx 为已询问次数
  function nextResponder(initiator, turnIdx) {
    var order = [initiator === 'p1' ? 'p2' : 'p1', initiator];
    return order[turnIdx % 2];
  }
  function shouldResolve(passStreak) { return passStreak >= 2; } // 连续两方 pass 才结算

  return {
    version: '0.1.0-stage0',
    // rng
    mulberry32: mulberry32, createRNG: createRNG,
    // phase
    PHASES: PHASES, PHASE_ORDER: PHASE_ORDER, nextPhase: nextPhase,
    canPlayCardInPhase: canPlayCardInPhase,
    // chain / response window
    WINDOWS: WINDOWS, classifyChainCard: classifyChainCard, isChainCard: isChainCard,
    chainableAt: chainableAt, nextResponder: nextResponder, shouldResolve: shouldResolve
  };
}));
