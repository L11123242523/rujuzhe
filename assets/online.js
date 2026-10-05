
/* ============================================================
 * NetSync —— 权威式联机的状态同步层
 * ------------------------------------------------------------
 * 为什么要有这一层：
 *   旧的"镜像锁步"要求两台浏览器各自跑完整引擎、各自把对手的手牌和牌库都算出来，
 *   再靠一个共享计数器把决策点配对。这带来三个结构性问题：
 *     ① 失步是必然的（任何一处镜像写得不一致，此后所有答案都配错决策点）
 *     ② 信息不公平（本机内存里就有对手的手牌和牌库顺序，开控制台即可看穿）
 *     ③ 断了就无法恢复
 *   新架构：**只有房主跑规则**。房主把"该给对面看的状态"打包发过去，
 *   客人不推进任何规则，收到就覆盖自己的 battleState 再重绘。
 *   => 失步在结构上不可能发生；对手的隐藏信息在客人客户端里根本不存在。
 *
 * 本模块只负责两件事（阶段0）：
 *   buildSnapshot(viewerIsGuest)  房主侧：把 battleState 编码成可传的快照（遮蔽 + 换位 + 卡注册表）
 *   applySnapshot(snap)           客人侧：把快照解回 battleState 并原地覆盖，然后重绘
 * ============================================================ */
var NetSync = {
  VERSION: 1,
  _defs: {},        // 当前正在编码时用的那份"已发送"记账（见 _defsByView）
  _defsByView: {},  // 每个收件人各自一份：'view:p1' / 'view:p2' / 'self'
  _cache: {},       // 客人侧缓存：uid -> 本地卡对象（必须复用同一实例，引擎靠引用比较）
  _uidSeq: 0,

  // 对手视角下必须遮蔽的区域（只发张数）
  HIDDEN_ZONES: ['hand', 'deck', 'faceDownCards', 'eventCards', 'musicCards'],

  /* ---------- 卡牌识别 ---------- */
  /* 换新客人 / 重连时调用：让卡定义重新发一遍。
     【绝不重置 _uidSeq】卡对象上的 __u 是"终身身份"，而卡对象本身不在 battleState 里、
     不会被快照重建 —— 一旦把计数器归零，新卡就会拿到已被占用的 uid，
     客人侧缓存会把卡解析成完全不同的另一张（实测踩过：墓地里的卡变成了别的卡）。 */
  resetRegistry: function () {
    NetSync._defs = {};       // 只清"已发送"记账，让下一份快照重发全部定义
    NetSync._defsByView = {}; // 每个收件人各自那份记账也一起清（否则重连后某些座位会缺定义）
    NetSync._pending = null;
    NetSync._lastPlayable = [];
    // _cache 也不清：uid 稳定，缓存依然有效
  },
  isCard: function (v) {
    return !!v && typeof v === 'object' && !Array.isArray(v) && typeof v.name === 'string' &&
      (v.cost !== undefined || v.effect !== undefined || v._category !== undefined ||
       v.attribute !== undefined || v.score !== undefined || v.type !== undefined);
  },
  uidOf: function (card) {
    if (!card.__u) card.__u = 'u' + (++NetSync._uidSeq);
    return card.__u;
  },
  // 客人的占位卡（对手隐藏区域的"一张未知卡"）
  _unknownCard: function () {
    return { __unknown: true, name: '？？？', cost: '?', effect: '', _category: 'unknown' };
  },
  _missingCard: function (uid) {
    return { __u: uid, __missing: true, name: '未知卡', cost: 0, effect: '', _category: 'unknown' };
  },
  /* 卡上"每局标记"的签名：下划线开头的字段就是每局状态（_usedThisTurn / _skillUsedThisTurn / _faceUp /
     _zhichiPaidThisTurn / _skillUsedThisTurn …）。定义正文（名称/费用/效果）不会变，但**这些标记会变**。
     为什么要签名：旧实现 "一张卡的定义只发一次"，于是
       ① 标记变更后再也不下发（客人那份永远是旧的）；
       ② 重连时房主 resetRegistry 重发定义，客人侧还会 `if (_cache[u]) continue` 直接丢掉 → 标记照样是旧的。
     现在：签名变了就重发这一张的定义（只重发变化的那张，正文不会重复占用带宽）。 */
  _markSig: function (card) {
    try {
      var s = '';
      for (var k in card) {
        if (!Object.prototype.hasOwnProperty.call(card, k)) continue;
        if (k === '__u' || k.charAt(0) !== '_') continue;
        var v = card[k], t = typeof v;
        if (v === undefined) continue;
        if (t === 'object' && v !== null) continue;      // 嵌套对象不进签名（避免循环引用与噪音）
        if (t === 'function' || t === 'symbol') continue;
        s += k + '=' + (t === 'boolean' ? (v ? 1 : 0) : String(v)) + ';';
      }
      return s;
    } catch (e) { return ''; }
  },

  /* ---------- 编码：卡对象只发身份（新卡才带定义） ---------- */
  encode: function (v, out) {
    if (v === null || v === undefined) return v;
    var t = typeof v;
    if (t === 'function' || t === 'symbol' || t === 'bigint') return undefined;
    if (t !== 'object') return v;
    if (Array.isArray(v)) {
      var arr = [];
      for (var i = 0; i < v.length; i++) { var e0 = NetSync.encode(v[i], out); if (e0 !== undefined) arr.push(e0); }
      return arr;
    }
    if (NetSync.isCard(v)) {
      var uid = NetSync.uidOf(v);
      // 定义只在"没发过"或"每局标记变了"时下发（见 _markSig 的说明）
      var __sig = NetSync._markSig(v);
      if (NetSync._defs[uid] !== __sig) {
        NetSync._defs[uid] = __sig;           // 先占位，防止卡互相引用时无限递归
        var def = {};
        for (var k in v) {
          if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
          if (k === '__u') continue;
          var e1 = NetSync.encode(v[k], out);
          if (e1 !== undefined) def[k] = e1;
        }
        out.cards[uid] = def;
      }
      return { __u: uid };
    }
    var o = {};
    for (var k2 in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k2)) continue;
      var e2 = NetSync.encode(v[k2], out);
      if (e2 !== undefined) o[k2] = e2;
    }
    return o;
  },

  /* ---------- 座位换位：把 'p1'/'p2' 同时作为【值】和【键】互换 ----------
     客人侧引擎槽固定为 p1=客人本人、p2=对手（沿用其现有 UI），
     而房主引擎里 p2 才是客人，所以发快照前必须整体换位。 */
  swapSeats: function (v) {
    if (v === null || v === undefined) return v;
    if (typeof v === 'string') return v === 'p1' ? 'p2' : (v === 'p2' ? 'p1' : v);
    if (typeof v !== 'object') return v;
    if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) v[i] = NetSync.swapSeats(v[i]); return v; }
    var out = {};
    for (var k in v) {
      if (!Object.prototype.hasOwnProperty.call(v, k)) continue;
      var nk = (k === 'p1') ? 'p2' : (k === 'p2' ? 'p1' : k);
      out[nk] = NetSync.swapSeats(v[k]);
    }
    return out;
  },

  /* ---------- 房主侧：构建快照 ----------
     opts.mode:   'guest'（默认）给某个座位看 —— 隐藏区域遮蔽 + 必要时换位
                  'self'          权威自存 —— 不换位、不遮蔽、完整，供重连恢复用
     opts.viewer: 这份快照给**引擎槽位**里的哪个座位看，默认 'p2'（＝原来的"给客人看"）。
                  'p2'：客人占引擎槽 p2，所以整体换位，让它在视图里变成 p1（沿用客人现有 UI）；
                  'p1'：不换位（它在视图里本来就是 p1）。
                  两种情形产物形状**完全一致**：视图里永远是 p1=我、p2=对手。
                  （C 阶段第 4 步批次 2：权威搬进 Durable Object 后，服务器要**同时**给两个座位
                    各出一份视图，所以这里必须按座位参数化，而不是写死"给客人"。）
     opts.full:   强制带上全部卡定义（客人/房主重连时本地缓存已丢，必须重发） */
  buildSnapshot: function (opts) {
    if (!battleState) return null;
    opts = opts || {};
    var mode = opts.mode || 'guest';
    var viewer = opts.viewer || 'p2';                       // 引擎槽位名
    var foe = (viewer === 'p2') ? 'p1' : 'p2';              // 对手的引擎槽位名
    var out = { v: NetSync.VERSION, cards: {}, t: Date.now() };
    /* 每个"收件人"各自一份"已发送定义"记账。
       为什么不能共用一份：视图是按座位遮蔽的 —— 一个座位收到过的定义，另一个座位未必该收到；
       共用会让"该收的没收到"或者"把某人的隐藏卡定义发给了别人"。 */
    var viewKey = (mode === 'guest') ? ('view:' + viewer) : 'self';
    if (!NetSync._defsByView[viewKey]) NetSync._defsByView[viewKey] = {};
    var savedDefs = NetSync._defs;
    NetSync._defs = opts.full ? {} : NetSync._defsByView[viewKey];
    var raw;
    try {
      raw = NetSync.encode(battleState, out);
    } finally {
      NetSync._defsByView[viewKey] = NetSync._defs;
      NetSync._defs = savedDefs;
    }
    var snap = (mode === 'guest' && viewer !== 'p1') ? NetSync.swapSeats(raw) : raw;
    if (mode === 'guest') {
      // 视图里 p1 恒为"我"、p2 恒为对手，所以要遮蔽的永远是 snap.p2
      var opp = snap.p2;
      if (opp && typeof opp === 'object') {
        for (var i = 0; i < NetSync.HIDDEN_ZONES.length; i++) {
          var z = NetSync.HIDDEN_ZONES[i];
          if (Array.isArray(opp[z])) opp[z] = { __hidden: true, n: opp[z].length };
        }
      }
      // "我"手牌的"能不能出"由权威判定（引擎槽位是 viewer），玩家侧不跑规则
      out.playable = [];
      try {
        var myHand = (battleState[viewer] && battleState[viewer].hand) || [];
        for (var h = 0; h < myHand.length; h++) {
          var pv = (typeof evaluatePlayable === 'function') ? evaluatePlayable(myHand[h], viewer) : { ok: true };
          out.playable.push({ ok: !!pv.ok, reason: pv.reason || '' });
        }
      } catch (e) { out.playable = []; }
    }
    out.viewer = viewer;      // 让接收端能自证"这份视图是给我的"（服务端每座位一份时必须可断言）
    out.state = snap;
    out.grave = (typeof publicGraveyard !== 'undefined' && publicGraveyard) ? NetSync.encode(publicGraveyard, out) : null;
    try {
      var dc = (typeof deckConfig !== 'undefined') ? deckConfig : null;
      out.oppChars = (dc && dc[foe] && dc[foe].chars) ? dc[foe].chars.filter(Boolean).map(function (c) { return NetSync.encode(c, out); }) : [];
    } catch (e) { out.oppChars = []; }
    /* 遮蔽之后**再剪一次卡定义**：只留"这份视图真的引用到"的定义。
       不剪的后果（2026-09-15 实测抓到的真缺陷）：房主手牌的完整定义（名字/费用/效果）会随
       out.cards 一起发给客人 —— 客人的 battleState 里明明只有占位卡，字典里却躺着"对手手牌是什么"，
       等于把隐藏信息明码送过去（信息不公平）。实测：一份 20,320 字节的客人快照里，
       25 条定义中有 11 条是客人视图根本没引用的（正是房主那 5 张手牌那类）。
       剪掉的 uid 必须**从该收件人的"已发送"里撤回**，否则它以后变公开时不会再发 → 客人显示"未知卡"。 */
    if (mode === 'guest') {
      var keepDefs = {};
      var collectUids = function (v) {
        if (!v || typeof v !== 'object') return;
        if (Array.isArray(v)) { for (var i2 = 0; i2 < v.length; i2++) collectUids(v[i2]); return; }
        if (v.__u) { keepDefs[v.__u] = 1; return; }
        for (var k3 in v) if (Object.prototype.hasOwnProperty.call(v, k3)) collectUids(v[k3]);
      };
      collectUids(snap);
      collectUids(out.grave);
      collectUids(out.oppChars);
      var pruned = 0;
      for (var u2 in out.cards) {
        if (!Object.prototype.hasOwnProperty.call(out.cards, u2)) continue;
        if (!keepDefs[u2]) {
          delete out.cards[u2];
          delete NetSync._defsByView[viewKey][u2];     // 撤回记账：将来公开时会重新发
          pruned++;
        }
      }
      out._pruned = pruned;                            // 自检用：这份快照剪掉了几条"不该给"的定义
    }
    return out;
  },

  /* ---------- 客人侧：解回并原地覆盖 ---------- */
  decode: function (v) {
    if (v === null || v === undefined) return v;
    if (typeof v !== 'object') return v;
    if (Array.isArray(v)) { var a = []; for (var i = 0; i < v.length; i++) a.push(NetSync.decode(v[i])); return a; }
    if (v.__u) {
      var u = v.__u;
      if (!NetSync._cache[u]) {
        var def = NetSync._pending && NetSync._pending[u];
        NetSync._cache[u] = def ? NetSync.decode(def) : NetSync._missingCard(u);
      }
      return NetSync._cache[u];
    }
    if (v.__hidden) {
      var n = v.n || 0, arr = [];
      for (var k = 0; k < n; k++) arr.push(NetSync._unknownCard());
      return arr;
    }
    var o = {};
    for (var kk in v) { if (!Object.prototype.hasOwnProperty.call(v, kk)) continue; o[kk] = NetSync.decode(v[kk]); }
    return o;
  },

  // 原地覆盖：保持 battleState 对象身份不变（引擎里到处持有它的引用）
  _overwrite: function (target, src) {
    for (var k in target) { if (Object.prototype.hasOwnProperty.call(target, k) && !(k in src)) { try { delete target[k]; } catch (e) {} } }
    for (var k2 in src) { if (Object.prototype.hasOwnProperty.call(src, k2)) target[k2] = src[k2]; }
    return target;
  },

  applySnapshot: function (snap) {
    if (!snap || !snap.state) return false;
    NetSync._pending = snap.cards || {};
    /* 预先把本批新卡定义解进缓存。
       否则会踩这个坑：一张卡若一直处在【被遮蔽的区域】（例如对手手牌），
       客人侧从没遇到过对它的引用，也就不会建缓存；等它后来进墓地/被公开时，
       定义早已记在"已发送"里不再重发 → 永远解析成"未知卡"。
       holder 先占位是为了防自引用（卡里引用卡）导致的无限递归。 */
    for (var u in NetSync._pending) {
      if (!Object.prototype.hasOwnProperty.call(NetSync._pending, u)) continue;
      var __def = NetSync._pending[u];
      var __cached = NetSync._cache[u];
      /* 【不能跳过已缓存的 uid】（2026-09-16 收口遗留：卡上每局标记只在首次下发）
         房主会重发"标记变了"的卡定义、重连时也会重发全部定义；旧实现这里 `continue`
         把重发的定义直接丢掉 → 客人那份标记永远是旧的，重连后也补不回来。
         现在：把定义**原地合并**进已缓存的那个对象（保持对象身份 —— 引擎靠引用比较，
         且 battleState 里各处都持有这个引用），顺带把 __missing/__unknown 占位卡换成真卡。 */
      if (__cached && !__cached.__unknown) {
        var __keepU = __cached.__u;                 // 定义里没有 __u（编码时剥掉了），合并后必须补回，否则卡身份会变
        var __full0 = NetSync.decode(__def);
        NetSync._overwrite(__cached, __full0);
        __cached.__u = __keepU;
        continue;
      }
      var holder = {};
      NetSync._cache[u] = holder;
      var full = NetSync.decode(__def);
      for (var fk in full) { if (Object.prototype.hasOwnProperty.call(full, fk)) holder[fk] = full[fk]; }
      /* 补回卡身份：定义里没有 __u（编码时剥掉了），但客人侧这份缓存对象必须带 uid ——
         否则将来对它调用 uidOf() 会**新铸一个 uid**，同一张卡在两个客户端就是两个身份。 */
      holder.__u = u;
    }
    var st = NetSync.decode(snap.state);
    if (!battleState) { try { battleState = st; } catch (e) { return false; } }
    else NetSync._overwrite(battleState, st);
    NetSync._lastPlayable = snap.playable || [];
    try {
      if (snap.grave && typeof publicGraveyard !== 'undefined') NetSync._overwrite(publicGraveyard, NetSync.decode(snap.grave));
    } catch (e) {}
    try { if (typeof updateBattleUI === 'function') updateBattleUI(); } catch (e) { console.error('NetSync 重绘失败', e); }
    // 联机反馈①：把权威战斗日志补画进面板（客人侧唯一能看到"对手干了什么"的通道）
    try { if (typeof __renderBattleLogFromState === 'function') __renderBattleLogFromState(); } catch (e) {}
    try { if (typeof NetSync.onApplied === 'function') NetSync.onApplied(snap); } catch (e) {}
    return true;
  },

  // 客人侧只读查询：房主给的"这张手牌能不能出"
  playableOf: function (i) {
    var a = NetSync._lastPlayable || [];
    return a[i] || { ok: true, reason: '' };
  },

  // 调试/自检用：统计当前快照里有多少张"未知卡"（应当只出现在对手的隐藏区域）
  countUnknown: function () {
    var n = 0;
    (function walk(v) {
      if (!v || typeof v !== 'object') return;
      if (v.__unknown) { n++; return; }
      if (Array.isArray(v)) { v.forEach(walk); return; }
      for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) walk(v[k]);
    })(battleState);
    return n;
  }
};

/* ============================================================
 * 接入点：房主的状态变化自动推快照
 * ------------------------------------------------------------
 * 不逐个去改"每次状态变化"的地方（那样必漏），而是挂在 updateBattleUI 上——
 * 引擎在任何状态变化后都会调它来刷新界面，这里顺手把权威状态推给客人。
 * pushSnapshot 内部有 90ms 去抖，一次动作触发的多次重绘会合并成一次推送。
 * ============================================================ */
(function () {
  if (typeof updateBattleUI !== 'function') return;
  var __origUpdateBattleUI = updateBattleUI;
  updateBattleUI = function () {
    var r = __origUpdateBattleUI.apply(this, arguments);
    try {
      if (typeof Online !== 'undefined' && Online.active && !Online.isGuest) Online.pushSnapshot();
    } catch (e) {}
    return r;
  };
})();

/* ============================================================
 * 接入点：客人侧"只发操作、不执行规则"
 * ------------------------------------------------------------
 * 不逐个去改那十几个操作入口（那样必漏一两个，而漏掉的那个就是下一个失步源），
 * 在这里统一包裹，一处声明式、可审计：
 *   客人点任何操作 → 只把【操作名 + 参数】发给房主；规则由房主执行，
 *   客人随后收到的权威快照会把它该看到的样子画出来。
 * 房主侧这些函数完全不受影响（包装器直接放行）。
 * ============================================================ */
(function () {
  function hand() { return (typeof battleState !== 'undefined' && battleState && battleState.p1 && battleState.p1.hand) || []; }
  function nmHand(i) { var c = hand()[i]; return c ? (c.name || '') : ''; }
  function nmZone(zone, i) {
    var p = (typeof battleState !== 'undefined' && battleState) ? battleState.p1 : null;
    var arr = (p && p[zone]) || [];
    var c = arr[i];
    return c ? (c.name || '') : '';
  }
  var ACTS = {
    useCardComplete:       function (i) { return { type: 'card', idx: i, name: nmHand(i) }; },
    rollDice:              function () { return { type: 'roll' }; },
    nextPhase:             function () { return { type: 'phase' }; },
    endTurn:               function () { return { type: 'end' }; },
    drawByCost:            function () { return { type: 'drawCost' }; },
    doSacrifice:           function () { return { type: 'sacrifice' }; },
    useCharacterPassive:   function () { return { type: 'skill' }; },
    useEventCard:          function (i) { return { type: 'event', idx: i, name: nmZone('eventCards', i) }; },
    useMusicCard:          function (i) { return { type: 'music', idx: i, name: nmZone('eventCards', i) }; },
    faceDownFromHand:      function (i) { return { type: 'fdPlace', idx: i, name: nmHand(i) }; },
    uiActivateFaceDown:    function (i) { return { type: 'fd', idx: i, name: nmZone('faceDownCards', i) }; },
    activatePermanentCard: function (i) { return { type: 'perm', idx: i, name: nmZone('permanent', i) }; }
  };
  /* 需要"客人先在本机把选择做好、再把结果随意图发过去"的入口。
     返回 true = 已接管（异步进行中）；返回 false = 交回普通意图路径。
     这样做客人在自己机器上点了立刻有反馈，而不是等房主回问一个没有选项的空白输入框。 */
  var LOCAL_PICK_ACTS = {
    doSacrifice: function () {
      var h = hand();
      if (!h.length || typeof showCardPickerMulti !== 'function') return false;
      showCardPickerMulti(h.slice(), '选择要献祭的手卡（送入墓地并回复音韵值）', function (idx) {
        if (idx === null || idx === undefined || idx < 0) return;
        var c = h[idx];
        Online.sendAct({ type: 'sacrifice', idx: idx, name: c ? (c.name || '') : '' });
      }, 1, false, true);   // 【2026-10-01】客人侧也要能取消（取消＝不发意图，见上面的 null 分支）
      return true;
    }
  };
  /* C 阶段批次 3：判定"本机要不要只发意图"统一交给 Online.interceptsAct()：
       · 服务器权威模式 → **双方都拦截**（没有房主，两台机器都只是客户端）；
       · 旧协议         → 只有客人拦截（房主照旧本地执行，行为一字不变）。 */
  Object.keys(ACTS).forEach(function (fn) {
    var orig = window[fn];
    if (typeof orig !== 'function') return;
    var wrapped = function () {
      try {
        if (typeof Online !== 'undefined' && Online.active && Online.interceptsAct()) {
          if (LOCAL_PICK_ACTS[fn] && LOCAL_PICK_ACTS[fn].apply(null, arguments)) return;
          var a = ACTS[fn].apply(null, arguments);
          if (a) { Online.sendAct(a); return; }
        }
      } catch (e) {}
      return orig.apply(this, arguments);
    };
    window[fn] = wrapped;
    // 主块末尾执行过 useCard = useCardComplete，它指向的是【旧函数对象】，必须一起换掉
    if (fn === 'useCardComplete') { try { window.useCard = wrapped; } catch (e) {} }
  });
})();

/* 不跑 startTurn（那是"推进回合"的引擎入口）：
   旧协议只拦客人；服务器权威模式下**双方都不能跑**（回合推进是服务器的事）。 */
(function () {
  if (typeof startTurn !== 'function') return;
  var __origStartTurn = startTurn;
  startTurn = function () {
    if (typeof Online !== 'undefined' && Online.active && Online.interceptsAct()) return;
    return __origStartTurn.apply(this, arguments);
  };
})();

/* ================= __UI_PHASE2B · 资源数字滚动（2026-09-30，不承重） =================
   作者要求：MD 风、动画克制（0.2~0.4s）、不挡操作。这里只做"数字滚动 + 涨/降高亮"，
   整体吞异常、可一键关（window.__UI_ANIM=false）、尊重 prefers-reduced-motion。 */
(function () {
  if (typeof window === 'undefined' || window.__UI_PHASE2B) return;
  window.__UI_PHASE2B = 1;
  var IDS = ['p1Cost', 'p1Sync', 'p1MaxCost', 'p1Fascination', 'p2Cost', 'p2Sync', 'p2MaxCost', 'p2Fascination',
    'p1CostCenter', 'p1MaxCostCenter', 'p1SyncCenter', 'p1FascinationCenter', 'p1GoldCenter', 'p1LevelCenter', 'p1MotivationCenter',
    'p2CostCenter', 'p2MaxCostCenter', 'p2SyncCenter', 'p2FascinationCenter'];
  function on() {
    try {
      if (window.__UI_ANIM === false) return false;
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      return true;
    } catch (e) { return true; }
  }
  function snap() {
    var o = {};
    try {
      for (var i = 0; i < IDS.length; i++) {
        var el = document.getElementById(IDS[i]);
        if (el) o[IDS[i]] = String(el.textContent == null ? '' : el.textContent);
      }
    } catch (e) { console.error('数字快照失败（忽略）', e); }
    return o;
  }
  function roll(el, from, to, up) {
    try {
      /* 【2026-10-01 修·队列②】原来"已在滚就直接 return" ⇒ 后一次刷新的新值被丢掉，
         而先那次动画收尾时又把自己的旧目标写回 DOM ⇒ **数字停在旧值**（作者实测"音韵值显示与实际不符"）。
         现在：已在滚 → 只把目标更新为最新值，动画自己会收敛到它。 */
      if (el.__rolling) { el.__rollTo = to; return; }
      el.__rolling = 1; el.__rollTo = to;
      /* 【2026-10-01 修·作者实测"音韵值显示与实际不符"的真凶】给本次滚动一个代号：
         rAF 循环与兜底定时器**只能对自己那一代生效** —— 否则兜底结束后循环仍按最初的 to 继续跑，
         把界面数字一路写回旧值（实测序列 7→11→…→11→179ms 起 →7，界面停在 7 而实际 11）。 */
      var __rollGen = (el.__rollGen = (el.__rollGen || 0) + 1);
      var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      var dur = 260;
      el.style.transition = 'color .18s ease, text-shadow .18s ease';
      el.style.color = up ? '#b8f5c8' : '#ffb0bd';
      el.style.textShadow = up ? '0 0 10px rgba(120,255,170,.55)' : '0 0 10px rgba(255,110,140,.55)';
      var step = function () {
        try {
          /* 本代滚动已被兜底/新一轮结束 ⇒ 立即停（绝不写回旧目标） */
          if (!el.__rolling || el.__rollGen !== __rollGen) return;
          var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          var p = Math.min(1, (now - t0) / dur);
          var e = 1 - Math.pow(1 - p, 3);                    // easeOutCubic
          var __to = (el.__rollTo == null) ? to : el.__rollTo;   // 滚动途中若又刷新，目标以最新值为准
          var v = Math.round(from + (__to - from) * e);
          el.textContent = String(v);
          if (p < 1) requestAnimationFrame(step);
          else {
            el.textContent = String(__to);
            el.__rolling = 0; el.__rollTo = null;
            setTimeout(function () { try { el.style.color = ''; el.style.textShadow = ''; } catch (e2) { } }, 220);
          }
        } catch (e2) { try { el.textContent = String(to); el.__rolling = 0; el.__rollTo = null; } catch (e3) { } }
      };
      requestAnimationFrame(step);
      /* 兜底：requestAnimationFrame 被隐藏标签页/节流拖住时，时间到就强制落到真值
         （动画层**绝不承重**：宁可不动画，也不能让显示停在与实际不同的数字上）。 */
      setTimeout(function () {
        try {
          if (!el.__rolling || el.__rollGen !== __rollGen) return;   // 新一轮已经开始 ⇒ 本次兜底作废
          el.textContent = String(el.__rollTo == null ? to : el.__rollTo);
          el.__rolling = 0; el.__rollTo = null;
        } catch (e3) { }
      }, dur + 150);
    } catch (e) { console.error('数字滚动失败（忽略）', e); }
  }
  function wrap() {
    try {
      if (typeof updateBattleUI !== 'function' || updateBattleUI.__rollWrapped) return false;
      var orig = updateBattleUI;
      var wrapped = function () {
        var before = on() ? snap() : null;
        var r = orig.apply(this, arguments);
        try {
          if (before) {
            for (var i = 0; i < IDS.length; i++) {
              var id = IDS[i], el = document.getElementById(id);
              if (!el || !(id in before)) continue;
              var after = String(el.textContent == null ? '' : el.textContent);
              var b = before[id];
              if (after === b) continue;
              var nb = parseInt(b.replace(/[^0-9-]/g, ''), 10), na = parseInt(after.replace(/[^0-9-]/g, ''), 10);
              if (isNaN(nb) || isNaN(na) || nb === na) continue;
              roll(el, nb, na, na > nb);
            }
          }
        } catch (e) { console.error('数字滚动收尾失败（忽略）', e); }
        return r;
      };
      wrapped.__rollWrapped = 1;
      updateBattleUI = wrapped;
      return true;
    } catch (e) { console.error('包装 updateBattleUI 失败（忽略）', e); return false; }
  }
  if (!wrap()) {
    /* updateBattleUI 可能后定义 ⇒ 稍后重试两次，仍失败就放弃（绝不影响功能） */
    var tries = 0;
    var t = setInterval(function () { tries++; if (wrap() || tries >= 20) clearInterval(t); }, 500);
  }
})();
