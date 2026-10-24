/* assets/ui.js —— 由 game.html 的 UI 类顶层函数**原样外移**而成（只搬位置、不改函数体/函数名）
   导出：文件末尾用 window.<name> 挂回全局，供 game.html 内联代码继续直接调用。 */
/* 主菜单专属动效：首图随机2/3/4，统一可见性生命周期；不消耗战斗中的随机数。 */
var __mmBgPicked = false;
function __mmPickBg() {
  if (__mmBgPicked) return; __mmBgPicked = true;
  try {
    var n = [2, 3, 4][Math.floor(Math.random() * 3)];
    /* 绝对路径（以 / 开头）：自定义属性里的相对 url 会按**引用它的样式表**（/assets/app.css）解析，
       写 assets/images/... 会变成 /assets/assets/images/...（实测 404、背景整层消失）✗ */
    document.documentElement.style.setProperty('--mm-bg', "url('/assets/images/mainmenu-bg-" + n + ".webp?v=2')");
    const ZOOM_MS = 26000, SWITCH_MS = 32000, FADE_MS = 1800, MAX_SHIFT = 8;
    var menu = document.getElementById('mainMenu'), bg = menu && menu.querySelector('.mm-bg');
    if (!bg || bg.children.length !== 2 || typeof requestAnimationFrame !== 'function') return;
    var layers = Array.from(bg.children), reduced = matchMedia('(prefers-reduced-motion: reduce)');
    var mouse = matchMedia('(min-width: 769px) and (hover: hover) and (pointer: fine)');
    var running = false, raf = 0, last = null, clock = 0, switchAt = SWITCH_MS, front = 0, current = n, loading = null, fade = null, x = 0, y = 0;
    function imageUrl(index) { return '/assets/images/mainmenu-bg-' + index + '.webp?v=2'; }
    layers[front].style.backgroundImage = 'url("' + imageUrl(current) + '")';
    layers[front].style.opacity = '1';
    function mmFrame(at) {
      raf = 0; if (!running) return;
      clock += last === null ? 0 : at - last; last = at;
      var scale = 1.06 + .06 * (1 - Math.cos(2 * Math.PI * clock / ZOOM_MS)) / 2;
      layers.forEach(function (layer) { layer.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + scale + ')'; });
      if (!fade && clock >= switchAt) {
        if (!loading) {
          var candidate = { index: 2 + (current - 1) % 3, ready: false, failed: false }, image = new Image(); loading = candidate;
          image.onload = function () { image.decode().then(function () { candidate.ready = true; }, function () { candidate.failed = true; }); };
          image.onerror = function () { candidate.failed = true; }; image.src = imageUrl(candidate.index);
        }
        if (loading.failed) { loading = null; switchAt = clock + SWITCH_MS; }
        else if (loading.ready) {
          var next = 1 - front; layers[next].style.backgroundImage = 'url("' + imageUrl(loading.index) + '")';
          fade = { from: front, to: next, started: clock }; front = next; current = loading.index; loading = null; switchAt = clock + SWITCH_MS;
        }
      }
      if (fade) {
        var progress = Math.min(1, (clock - fade.started) / FADE_MS), blend = (1 - Math.cos(Math.PI * progress)) / 2;
        layers[0].style.opacity = '1'; layers[1].style.opacity = String(fade.to === 1 ? blend : 1 - blend);
        if (progress === 1) { layers[fade.from].style.opacity = '0'; layers[front].style.opacity = '1'; fade = null; }
      }
      raf = requestAnimationFrame(mmFrame);
    }
    function syncMotion() {
      running = menu.classList.contains('active') && !document.hidden && !reduced.matches;
      if (!running || !mouse.matches || navigator.maxTouchPoints) x = y = 0;
      if (!running) { if (raf) cancelAnimationFrame(raf); raf = 0; last = null; }
      if (reduced.matches) { fade = null; layers.forEach(function (layer, i) { layer.style.transform = 'none'; layer.style.opacity = i === front ? '1' : '0'; }); }
      if (running && !raf) raf = requestAnimationFrame(mmFrame);
    }
    menu.addEventListener('pointermove', function (event) {
      if (!running || !mouse.matches || navigator.maxTouchPoints || event.pointerType !== 'mouse') return;
      x = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, (event.clientX / innerWidth - .5) * 2 * MAX_SHIFT));
      y = Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, (event.clientY / innerHeight - .5) * 2 * MAX_SHIFT));
    }, { passive: true });
    menu.addEventListener('pointerleave', function () { x = y = 0; }, { passive: true });
    new MutationObserver(syncMotion).observe(menu, { attributes: true, attributeFilter: ['class'] });
    document.addEventListener('visibilitychange', syncMotion); reduced.addEventListener('change', syncMotion); mouse.addEventListener('change', syncMotion);
    syncMotion();
  } catch (e) {}
}
/* 【2026-10-20 修】主界面是 HTML 里默认 active 的（首屏并不经过 showScreen）⇒ 必须**加载即选一次**，
   否则变量永远为空、CSS 回落旧图（打包版实测 picked=false）。 */
try {
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { try { __mmPickBg(); } catch (e) {} }, { once: true });
    else __mmPickBg();
  }
} catch (e) {}
function openAccountDialog() { if (typeof RJCloud !== 'undefined') return RJCloud.open(); }
function closeAccountDialog() { if (typeof RJCloud !== 'undefined') RJCloud.close(); }
function showScreen(id) {
  closeAccountDialog();
  if ((id === 'mainMenu' || id === 'onlineLobby') && typeof RJPackApp !== 'undefined' && typeof battleState !== 'undefined' && battleState && !battleState._over && document.getElementById('battleScreen') && document.getElementById('battleScreen').classList.contains('active')) RJPackApp.abandonBattle();
  try { __mmPickBg(); } catch (e) {}
  /* 【批次3·状态权威】把"当前界面"记成状态（BGM 等判据都读它 ⇒ 不依赖 DOM 查询 ✓ 真假 DOM 都稳 ✓） */
  try { if (typeof window !== 'undefined') window.__screenId = id; } catch (e) { try { console.error('[catch] assets/ui.js:5', e); } catch (e2) {} }
  var screens = document.querySelectorAll('.screen');
  for (var i = 0; i < screens.length; i++) {
    screens[i].classList.remove('active');
  }
  var target = document.getElementById(id);
  if (target) {
    target.classList.add('active');
  }
  if (id === 'battleScreen' && typeof RJPackApp !== 'undefined') RJPackApp.enterBattle(function () {
    return { state: typeof battleState !== 'undefined' ? battleState : null, meta: { online: typeof Online !== 'undefined' && Online.active, roomId: typeof Online !== 'undefined' ? Online.roomId : '', seed: typeof Online !== 'undefined' ? Online.seed : undefined, sandbox: typeof battleState !== 'undefined' && battleState && (battleState._sandbox || (typeof __pendingSandbox !== 'undefined' && __pendingSandbox)), over: typeof battleState !== 'undefined' && battleState && battleState._over, winner: typeof battleState !== 'undefined' && battleState ? battleState._winner : null } };
  });
  if (id === 'cardViewer') renderCardGrid();
  if (id === 'deckBuilder') { renderDeckBuilder(); try { __deckModeUI(); } catch (e) { try { console.error('[catch] assets/ui.js:15', e); } catch (e2) {} } }
  /* 回到主菜单/联机大厅 = 明确已经不在战斗里了 → 把战斗残留的浮层与临时状态清干净。
     （线上实测：对局结束后回主界面，效果框/结算框还挂在上面。）
     刻意**只在这两个界面**清：查卡器（cardViewer）等界面可能在对局中打开，那时清掉
     正在结算的窗口反而会把结算弄坏。 */
  if (id === 'mainMenu' || id === 'onlineLobby') {
    try { __clearTransientBattleState('离开战斗界面'); } catch (e) { try { console.error('[catch] assets/ui.js:21', e); } catch (e2) {} }
    /* 【2026-10-03】离开战斗 ⇒ 立刻停掉 BGM（作者实测：退到主界面还在放） */
    try { if (typeof __sfx !== 'undefined' && __sfx.bgmSync) __sfx.bgmSync(); } catch (e) { try { console.error('[catch] assets/ui.js:23', e); } catch (e2) {} }
    /* BGM 双保险【批次3】：上方判据已改状态权威 ⇒ bgmSync 会正确判"不在战斗"并停 ✓；
       这里再直接暂停当前元素（模块内引用丢了也不怕 ✓） */
    try { if (typeof window !== 'undefined' && window.__bgmEl && window.__bgmEl.pause && !window.__bgmEl.paused) window.__bgmEl.pause(); } catch (e) { try { console.error('[catch] assets/ui.js:26', e); } catch (e2) {} }
  }
  // 进入对战界面时初始化 3D 地图（WebGL 不可用则自动回退 2D 地图）
  if (id === 'battleScreen' && typeof Map3D !== 'undefined') {
    setTimeout(function () {
      try {
        if (!Map3D.isReady() && !Map3D.isFailed()) Map3D.init();
        else Map3D.resize();
        if (Map3D.isReady()) Map3D.syncFromGame();
      } catch (e) { console.error('Map3D init error', e); }
    }, 30);
  }
}

function showToast(msg, kind, dur) {
  if (typeof RJPackApp !== 'undefined' && typeof battleState !== 'undefined' && battleState && battleState._over && (battleState._winner === 'p1' || battleState._winner === 'p2')) RJPackApp.finishBattle(battleState._winner === 'p1');
  var wrap = document.getElementById('uiToastWrap');
  if (!wrap) { console.warn('[toast]', msg); return; }
  var t = document.createElement('div');
  t.className = 'ui-toast' + (kind ? ' toast-' + kind : '');
  t.textContent = String(msg == null ? '' : msg);
  wrap.appendChild(t);
  while (wrap.children.length > 3) wrap.removeChild(wrap.firstChild);
  var ms = dur || (String(msg).length > 60 ? 3800 : 2600);
  setTimeout(function () {
    t.classList.add('leaving');
    setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 340);
  }, ms);
}

function showBattleResult(win, title, desc, stats) {
  if (typeof RJPackApp !== 'undefined') RJPackApp.finishBattle(!!win);
  var ov = document.getElementById('resultOverlay');
  if (!ov) { alert(title + (desc ? ('\n' + desc) : '')); return; }
  var box = document.getElementById('resultBox');
  box.className = 'result-box ' + (win ? 'win' : 'lose');
  document.getElementById('rbEmoji').textContent = win ? '🏆' : '💔';
  document.getElementById('rbTitle').textContent = title;
  document.getElementById('rbDesc').textContent = desc || '';
  var statsEl = document.getElementById('rbStats');
  statsEl.innerHTML = (stats || []).map(function (s) {
    return '<div class="rb-stat"><b>' + s.v + '</b><i>' + s.k + '</i></div>';
  }).join('');
  ov.classList.add('active');
}

function flashStat(id, val) {
  var el = document.getElementById(id);
  if (!el) return;
  var prev = __uiPrevVals[id];
  if (prev !== undefined && prev !== val) {
    var cls = val > prev ? 'stat-flash-up' : 'stat-flash-down';
    el.classList.remove('stat-flash-up', 'stat-flash-down');
    void el.offsetWidth; // 重启动画
    el.classList.add(cls);
  }
  __uiPrevVals[id] = val;
}

function renderFilters() {
  var container = document.getElementById('cardFilters');
  if (!container) return;
  var html = '';
  for (var i = 0; i < cardCategories.length; i++) {
    var cat = cardCategories[i];
    var active = currentFilter === cat.key ? 'active' : '';
    html += '<button class="filter-btn ' + active + '" onclick="filterCards(\'' + cat.key + '\')">' + cat.name + '</button>';
  }
  container.innerHTML = html;
}

function renderCardGrid() {
  renderFilters();
  var grid = document.getElementById('cardGrid');
  if (!grid) return;
  
  var cards = currentFilter === 'all' ? allCards : allCards.filter(function(c) { return c._category === currentFilter; });
  
  // 搜索过滤：卡名 / 效果 / 被动 / SP / 属性 / 分类
  if (cardSearchText) {
    var q = cardSearchText.toLowerCase();
    cards = cards.filter(function(c) {
      var hay = ((c.name || '') + ' ' + (c.effect || '') + ' ' + (c.text || '') + ' ' + (c.attribute || '') + ' ' +
                  (c.passive || '') + ' ' + (c.sp || '') + ' ' + getCategoryName(c._category)).toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  
  if (cards.length === 0) {
    grid.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,0.5);padding:40px;">' +
      (cardSearchText ? '没有找到匹配「' + cardSearchText + '」的卡牌' : '暂无卡牌') + '</div>';
    return;
  }
  
  var html = '';
  for (var i = 0; i < cards.length; i++) {
    var card = cards[i];
    var idx = allCards.indexOf(card);
    html += '<div class="card-item" onclick="showViewerCardDetail(' + idx + ')">';
    if (card.cost !== undefined) {
      html += '<div class="card-item-cost">' + card.cost + '</div>';
    }
    if (card.image_url) {
      html += '<img loading="lazy" decoding="async" onerror="imgRetry(this)" src="' + card.image_url + '" alt="' + card.name + '" >';
    }
    html += '<div class="card-item-name">' + card.name + '</div>';
    html += '<div class="card-item-type">' + getCategoryName(card._category) + '</div>';
    html += '</div>';
  }
  grid.innerHTML = html;
}

function showViewerCardDetail(idx) {
  var card = allCards[idx];
  if (!card) return;
  
  var modal = document.getElementById('cardModal');
  var content = document.getElementById('cardModalContent');
  
  var html = '<h3>' + card.name + '</h3>';
  if (card.image_url) {
    html += '<img loading="lazy" decoding="async" onerror="imgRetry(this)" src="' + card.image_url + '" alt="' + card.name + '">';
  }
  html += '<div class="card-modal-info"><label>类型</label><p>' + getCategoryName(card._category) + '</p></div>';
  if (card.attribute) html += '<div class="card-modal-info"><label>属性</label><p>' + card.attribute + '</p></div>';
  if (card.cost !== undefined) html += '<div class="card-modal-info"><label>费用</label><p>' + card.cost + '</p></div>';
  if (card.passive) html += '<div class="card-modal-info"><label>被动</label><p>' + card.passive + '</p></div>';
  if (card.sp) html += '<div class="card-modal-info"><label>SP</label><p>' + card.sp + '</p></div>';
  if (card.effect) html += '<div class="card-modal-info"><label>效果</label><p>' + card.effect + '</p></div>';
  if (card.grade) html += '<div class="card-modal-info"><label>评级</label><p>' + card.grade + ' (' + (card.score || '?') + '分)</p></div>';
  if (card.brief) html += '<div class="card-modal-info"><label>点评</label><p>' + card.brief + '</p></div>';
  
  content.innerHTML = html;
  modal.classList.add('active');
}

function renderDeckBuilder() {
  renderDeckSide('p1');
  renderDeckSide('p2');
}

/* 【2026-10-09 作者目标第6项·卡组编辑】一键清空：把该玩家的 3 名角色 / 8 张道具 / 4 张携带全部置空。
   与"删除单张"同一套数据口径（deckConfig[player][type][index] = null）✓，清完立即重绘并落盘 ✓。 */
function deckClear(player) {
  try {
    var cfg = deckConfig[player]; if (!cfg) return;
    if (typeof closeCardPicker === 'function') { try { closeCardPicker(); } catch (e) { try { console.error('[catch] assets/ui.js:170', e); } catch (e2) {} } }
    ['chars', 'items', 'carries'].forEach(function (k) {
      var arr = cfg[k] || [];
      var len = arr.length || ({ chars: 3, items: 8, carries: 4 }[k] || 0);
      cfg[k] = new Array(len).fill(null);
    });
    if (typeof renderDeckSide === 'function') renderDeckSide(player);
    if (typeof saveDeckConfig === 'function') saveDeckConfig();
    if (typeof updateBattleUI === 'function') { try { updateBattleUI(); } catch (e) { try { console.error('[catch] assets/ui.js:178', e); } catch (e2) {} } }
    if (typeof showToast === 'function') showToast('已清空该卡组（可重新编组）', 'warn');
  } catch (e) { console.error('deckClear 出错', e); }
}

function renderAttrBar(player) {
  var itemContainer = document.getElementById(player + 'Items');
  if (!itemContainer) return;
  var bar = document.getElementById(player + 'AttrBar');
  if (!bar) {
    bar = document.createElement('div'); bar.id = player + 'AttrBar';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 10px;font-size:12px;';
    itemContainer.parentNode.insertBefore(bar, itemContainer.nextSibling);
  }
  var cfg = deckConfig[player], chars = (cfg.chars || []).filter(Boolean);
  if (chars.length < 3) { bar.innerHTML = '<span style="color:#9fb0d0">选满3名角色后显示道具属性需求</span>'; return; }
  var info = computeAttrRequirement(chars), have = {};
  (cfg.items || []).forEach(function (c) { if (c && c.attribute) have[c.attribute] = (have[c.attribute] || 0) + 1; });
  var h = '<span style="color:#cdd7f0;font-weight:600">道具属性配额：</span>';
  Object.keys(info.req).forEach(function (a) {
    var n = info.req[a], v = have[a] || 0, ok = v >= n;
    var col = DECK_ATTR_COLOR[a] || '#cdd7f0';
    h += '<span style="background:rgba(255,255,255,.08);border:1px solid ' + col + ';border-radius:10px;padding:1px 8px;color:' + (ok ? '#7dffb0' : '#ff8a8a') + '">' + a + ' ' + v + '/' + n + (ok ? ' ✓' : ' ✗') + '</span>';
  });
  if (info.flexSlots > 0) h += '<span style="background:rgba(183,139,255,.15);border:1px solid #b78bff;border-radius:10px;padding:1px 8px;color:#d3b8ff">灵活位×' + info.flexSlots + '（混沌角色，任意属性）</span>';
  var filled = (cfg.items || []).filter(Boolean).length;
  h += '<button onclick="deckAutoFill(\'' + player + '\')" style="margin-left:auto;background:linear-gradient(135deg,#5b8cff,#8a6bff);color:#fff;border:0;border-radius:10px;padding:3px 10px;font-size:12px;cursor:pointer">一键补全空缺（' + filled + '/8）</button>';
  /* 【2026-10-09 作者目标第6项】在这条信息栏里补：**费用曲线** + **一键清空** */
  try {
    var __costs = [];
    (cfg.items || []).concat(cfg.carries || []).forEach(function (c) {
      if (!c) return;
      var k = (c.cost === undefined || c.cost === null || c.cost === '') ? '?' : String(c.cost);
      __costs.push(k);
    });
    var __hist = {};
    __costs.forEach(function (k) { __hist[k] = (__hist[k] || 0) + 1; });
    var __keys = Object.keys(__hist).sort(function (x, y) {
      if (x === '?') return 1; if (y === '?') return -1; return (+x) - (+y);
    });
    var __curve = __keys.map(function (k) { return k + '费×' + __hist[k]; }).join('  ');
    h += '<span style="margin-left:12px;color:#9fb0d0">费用曲线：</span><span style="color:#fff">' +
         (__curve || '（空）') + '</span>';
    h += '<span style="margin-left:12px;color:#9fb0d0">共 ' + __costs.length + ' 张</span>';
    h += '<button onclick="deckClear(\'' + player + '\')" style="margin-left:12px;padding:4px 10px;font-size:12px;' +
         'background:rgba(255,90,90,.85);color:#fff;border:none;border-radius:6px;cursor:pointer;">🧹 一键清空</button>';
  } catch (e) { try { console.error('[catch] assets/ui.js:224', e); } catch (e2) {} }
  bar.innerHTML = h;
}

function renderDeckSide(player) {
  var config = deckConfig[player];
  
  // 角色
  var charContainer = document.getElementById(player + 'Chars');
  if (charContainer) {
    var html = '';
    for (var i = 0; i < 3; i++) {
      html += createDeckSlot(config.chars[i], player, 'chars', i);
    }
    charContainer.innerHTML = html;
  }
  
  // 道具
  var itemContainer = document.getElementById(player + 'Items');
  if (itemContainer) {
    var html = '';
    for (var i = 0; i < 8; i++) {
      html += createDeckSlot(config.items[i], player, 'items', i);
    }
    itemContainer.innerHTML = html;
  }
  renderAttrBar(player);
  
  // 携带
  var carryContainer = document.getElementById(player + 'Carries');
  if (carryContainer) {
    var html = '';
    for (var i = 0; i < 4; i++) {
      html += createDeckSlot(config.carries[i], player, 'carries', i);
    }
    carryContainer.innerHTML = html;
  }
  // 每次渲染即持久化（所有修改路径最终都会经过这里）
  if (typeof saveDeckConfig === 'function') saveDeckConfig();
}

function showPickerTip(msg) { showToast(msg, 'warn'); }

function renderRogueDeck() {
  var el = document.getElementById('rogueDeckScreen');
  if (!el || !roguelikeState) return;
  var bag = document.getElementById('rlBagCol'), bat = document.getElementById('rlBattleCol');
  if (!bag || !bat) return;
  var htmlB = '', htmlG = '';
  ['chars', 'items', 'carries'].forEach(function (kind) {
    htmlG += '<div class="rl-group">' + RL_DECK_LABEL[kind] + '（' +
             (roguelikeState.battleDeck[kind] || []).length + '/' + RL_DECK_CAP[kind] + '）</div>';
    (roguelikeState.battleDeck[kind] || []).forEach(function (c) { htmlG += rlCardChip(kind, c, true); });
    htmlB += '<div class="rl-group">' + RL_DECK_LABEL[kind] + '</div>';
    (roguelikeState.deck[kind] || []).forEach(function (c) {
      if (!rlInBattle(kind, c)) htmlB += rlCardChip(kind, c, false);
    });
  });
  bat.innerHTML = htmlG;
  bag.innerHTML = htmlB;
}

function renderRoguelikeMap() {
  if (!roguelikeState) return;
  // 左下角常驻：卡组编组 / 背包（作者 2026-10 设想）
  rlRenderDeckBar();
  document.getElementById('rlFloor').textContent = roguelikeState.floor;
  document.getElementById('rlGold').textContent = roguelikeState.gold;
  document.getElementById('rlLevel').textContent = roguelikeState.level;
  var deckSize = roguelikeState.deck.chars.length + roguelikeState.deck.items.length + roguelikeState.deck.carries.length;
  document.getElementById('rlDeckSize').textContent = deckSize;
  
  var container = document.getElementById('mapNodes');
  container.innerHTML = '';
  
  var typeInfo = {
    battle: { icon: '⚔️', label: '战斗', class: 'node-battle' },
    shop: { icon: '🏪', label: '商店', class: 'node-shop' },
    event: { icon: '❓', label: '事件', class: 'node-event' },
    rest: { icon: '🏕️', label: '休息', class: 'node-rest' },
    boss: { icon: '👹', label: 'BOSS', class: 'node-boss' }
  };
  
  for (var layer = roguelikeState.map.length - 1; layer >= 0; layer--) {
    var layerDiv = document.createElement('div');
    layerDiv.className = 'map-layer';
    
    var isCurrentLayer = (layer === roguelikeState.currentLayer);
    var isPastLayer = (layer < roguelikeState.currentLayer);
    
    for (var n = 0; n < roguelikeState.map[layer].length; n++) {
      var node = roguelikeState.map[layer][n];
      var info = typeInfo[node.type];
      var nodeDiv = document.createElement('div');
      nodeDiv.className = 'map-node ' + info.class;
      
      if (node.completed || isPastLayer) {
        nodeDiv.classList.add('completed');
      } else if (isCurrentLayer) {
        nodeDiv.classList.add('current');
        nodeDiv.onclick = (function(l, idx) { return function() { selectRoguelikeNode(l, idx); }; })(layer, n);
      } else {
        nodeDiv.classList.add('locked');
      }
      
      nodeDiv.innerHTML = '<div class="node-icon">' + info.icon + '</div><div class="node-label">' + info.label + '</div>';
      layerDiv.appendChild(nodeDiv);
    }
    container.appendChild(layerDiv);
  }
}

function showRoguelikeReward(type) {
  showScreen('roguelikeReward');
  
  var title = document.getElementById('rewardTitle');
  var subtitle = document.getElementById('rewardSubtitle');
  var cardsContainer = document.getElementById('rewardCards');
  var skipBtn = document.getElementById('rewardSkipBtn');
  
  cardsContainer.innerHTML = '';
  
  if (type === 'char') {
    title.textContent = '🎴 角色卡奖励';
    subtitle.textContent = '选择一张角色卡加入卡组（三选一）';
    var allChars = (window.cardData && window.cardData.characters) ? window.cardData.characters.slice() : [];
    shuffleArray(allChars);
    var choices = allChars.slice(0, 3);
    
    choices.forEach(function(card, idx) {
      var cardDiv = document.createElement('div');
      cardDiv.className = 'reward-card';
      cardDiv.innerHTML = (card.image_url ? '<img loading="lazy" decoding="async" onerror="imgRetry(this)" src="' + card.image_url + '" alt="' + card.name + '">' : '') +
        '<div class="reward-card-name">' + card.name + '</div>' +
        '<div class="reward-card-effect">同步:' + (card.sync||5) + ' ' + (card.type||'') + '</div>';
      cardDiv.onclick = function() { selectRewardCard('char', card); };
      cardsContainer.appendChild(cardDiv);
    });
    skipBtn.style.display = 'inline-block';
    skipBtn.textContent = '跳过角色卡';
  } else if (type === 'item') {
    title.textContent = '🎁 道具卡奖励';
    subtitle.textContent = '选择一张道具卡加入卡组（三选一）';
    var allItemsRaw = (window.cardData && window.cardData.item_single) ? window.cardData.item_single.concat(window.cardData.item_permanent || []).slice() : [];
    var allItems = allItemsRaw.filter(function(c) {
      var eff = (c.effect || '') + (c.name || '');
      var keywords = ['移动', '位移', '投掷', '掷骰', '骰子', '前进', '后退', '格', '打断', '方向', 'Again'];
      for (var k = 0; k < keywords.length; k++) {
        if (eff.indexOf(keywords[k]) >= 0) return false;
      }
      return true;
    });
    if (allItems.length < 3) allItems = allItemsRaw;
    shuffleArray(allItems);
    var itemChoices = allItems.slice(0, 3);
    
    itemChoices.forEach(function(card, idx) {
      var cardDiv = document.createElement('div');
      cardDiv.className = 'reward-card';
      cardDiv.innerHTML = (card.image_url ? '<img loading="lazy" decoding="async" onerror="imgRetry(this)" src="' + card.image_url + '" alt="' + card.name + '">' : '') +
        '<div class="reward-card-name">' + card.name + '</div>' +
        '<div class="reward-card-effect">' + (card.cost||0) + '费 ' + (card.type||'') + '</div>';
      cardDiv.onclick = function() { selectRewardCard('item', card); };
      cardsContainer.appendChild(cardDiv);
    });
    skipBtn.style.display = 'inline-block';
    skipBtn.textContent = '跳过道具卡';
  }
}

function __renderDeckPile() {
  try {
    if (typeof document === 'undefined') return;
    playerIds().forEach(function (who) {
      var top = document.getElementById(who + 'DeckTop');
      if (!top) return;   // 对方牌组堆在某些布局下可能没有（例如窄屏隐藏），不是错误
      var img = document.getElementById(who + 'DeckTopImg');
      var label = document.getElementById(who + 'DeckTopLabel');
      var card = deckTopReveal ? deckTopReveal[who] : null;
      if (card) {
        top.classList.add('revealed');
        top.title = (who === 'p1' ? '你的牌组最上方（已公开）：' : '对手牌组最上方（已公开）：') + (card.name || '');
        if (img) { img.src = card.image_url || ''; img.alt = card.name || ''; }
        if (label) label.textContent = '';
      } else {
        top.classList.remove('revealed');
        top.title = who === 'p1' ? '牌组（点击查看）' : '对手牌组（张数可见）';
        if (img) { img.removeAttribute('src'); img.alt = ''; }
        if (label) label.textContent = '牌组';
      }
    });
  } catch (e) { try { console.error('[catch] assets/ui.js:415', e); } catch (e2) {} }
}

/* 发动前选目标的兼容标记；显示权和排队只由 DecisionHub 决定。 */
var __chainTargetPhase = { active: false, pending: [] };

function showChainChoice(title, cardName, effectText, choices, onPick) {
  try { if (typeof __modalShadowNote === 'function') __modalShadowNote('chainChoice', title); } catch (e) {}
  return DecisionHub.submit('chainChoice', { title: title, cardName: cardName, effect: effectText, choices: choices }, onPick);
}

function __showChainChoiceNow(title, cardName, effectText, choices, onPick, req) {
  /* 【2026-10-05】连锁窗本来就会设置 _awaitingDecision；这里再包一层保证"应答即清" */
  try { onPick = __decideWrapped(onPick, 'chainChoice'); } catch (e) { try { console.error('[catch] assets/ui.js:420', e); } catch (e2) {} }
  if (__chainNeverAsk) {
    /* 【2026-10-03】这个开关很容易误点，一旦打开所有连锁问都瞬间自动放弃 ⇒ 每次留一条日志，
       玩家在战斗日志里能看到"是因为本会话关闭了连锁询问"，而不是以为"AI 抢跑不让我连锁"。
       恢复：控制台 setChainNeverAsk(false)。 */
    try { addBattleLog('system', '【连锁】本会话已关闭连锁询问 ⇒ 自动放弃：「' + (title || '') + '」（恢复：setChainNeverAsk(false)）'); } catch (e) { try { console.error('[catch] assets/ui.js:425', e); } catch (e2) {} }
    onPick(choices.length - 1); return;
  }
  var modal = document.getElementById('choiceModal');
  if (!modal) { onPick(choices.length - 1); return; }
  // 复用现有弹窗 DOM，但加一行倒计时与快捷按钮
  document.getElementById('choiceTitle').textContent = title;
  document.getElementById('choiceCardName').textContent = cardName || '';
  document.getElementById('choiceCardEffect').textContent = effectText || '';
  var buttonsDiv = document.getElementById('choiceButtons');
  buttonsDiv.innerHTML = '';
  var settled = false, timer = null, left = __chainAutoPassSec;
  /* 【2026-10-03 作者实测"实战根本就没弹窗询问"】窗口里若有**你自己的触发**（选项形如"↧ 连锁发动：【X】…"），
     就不启动自动放弃 —— 否则倒计时到点会静默替你把这张卡的触发丢掉（盒子SP 这类就是这样丢的）。 */
  var __hasOwnTriggerInWindow = (choices || []).some(function (c) { return /连锁发动|发动【|置于效果处理区/.test(String(c)); });
  if (__hasOwnTriggerInWindow) left = 0;   // 0 = 不自动放弃
  var targetCallback = null;
  req.cleanup = function () {
    settled = true;
    if (timer) { clearInterval(timer); timer = null; }
    if (pendingChoiceCallback === finish || pendingChoiceCallback === targetCallback) pendingChoiceCallback = null;
    __chainTargetPhase.active = false;
    __decideLeaveKind('chainChoice');
  };
  function finish(idx) {
    if (settled || DecisionHub.active !== req) return;
    settled = true;
    if (timer) { clearInterval(timer); timer = null; }
    pendingChoiceCallback = null;
    __chainTargetPhase.active = false;
    closeChoiceModal(true);
    onPick(idx);
  }
  finish.__decideTag = onPick.__decideTag;
  pendingChoiceCallback = finish; // 保持与全局单槽回调一致（其他入口不会覆盖）
  /* 【2026-10-13 S4 ✓】"发动前收目标"并入**本窗自己的决策序列**（不另开第二个框 ✗）
     —— 另开框会被"下一个连锁窗"顶掉（单槽冲突），实测回调永不回 ⇒ 卡不上链 ✗。 */
  function __pickTargetThenFinish(idx) {
    var c = choices[idx];
    /* 【2026-10-14 随 engine 8187 的结构修一起改 ✓】`c.pick` 现在放的是**真 pick**（原来错放了候选节点 ✗）。
       `c.pick.pick` 是引擎候选（collectChainable 的 pick，带 owner ✓）——优先用它来判"给自己/给对手"；
       读不到就逐级回落（兼容旧形状 / 座位能力等没有 pick 的候选 ✓），**绝不猜座位** ✗。 */
    var pick = (c && typeof c === 'object') ? ((c.pick && c.pick.pick) || c.pick || c) : null;
    var mine = (c && c.owner) || (pick && pick.owner) || 'p1';
    var other = (typeof foeOf === 'function') ? foeOf(mine) : ((mine === 'p1') ? 'p2' : 'p1');
    var __nm = (typeof playerDisplayName === 'function') ? playerDisplayName(mine) : '自己';
    var __fn = (typeof playerDisplayName === 'function') ? playerDisplayName(other) : '对手';
    __chainTargetPhase.active = true;
    req.step = 'target';
    /* 目标是同一请求的第二步，不向 Hub 队尾另交请求。 */
    if (timer) { clearInterval(timer); timer = null; }
    targetCallback = function (i) {
      if (settled || DecisionHub.active !== req || req.step !== 'target') return;
      if (pick) pick.target = (i === null || i === undefined || i < 0) ? null : ((i === 0) ? mine : other);
      finish(idx);
    };
    targetCallback.__decideTag = onPick.__decideTag;
    pendingChoiceCallback = targetCallback;
    buttonsDiv.innerHTML = '';
    [__nm, __fn].forEach(function (label, i) {
      var btn = document.createElement('button');
      btn.className = 'modal-btn modal-btn-confirm';
      btn.style.width = '100%';
      btn.textContent = (i === 0) ? ('给自己（' + label + '）') : ('给对手（' + label + '）');
      btn.onclick = function () { targetCallback(i); };
      buttonsDiv.appendChild(btn);
    });
    try { addBattleLog(mine, '【连锁】「' + ((pick && pick.card && pick.card.name) || '?') + '」发动前先选目标（选完再进连锁）'); } catch (e) {}
  }
  choices.forEach(function (choice, index) {
    var btn = document.createElement('button');
    btn.className = 'modal-btn modal-btn-confirm';
    btn.style.width = '100%';
    if (choice && typeof choice === 'object') {
      btn.textContent = choice.label || (choice.card && choice.card.name) || '连锁';
      btn.onclick = (choice.needTarget === true)
        ? function () { if (settled || DecisionHub.active !== req || req.step !== 'choice') return; __pickTargetThenFinish(index); }
        : function () { finish(index); };
    } else {
      btn.textContent = choice;
      btn.onclick = function () { finish(index); };
    }
    buttonsDiv.appendChild(btn);
  });
  // 倒计时行
  var bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:8px;justify-content:center;align-items:center;margin-top:8px;flex-wrap:wrap;font-size:12px;color:#9fb0d0;';
  var cd = document.createElement('span');
  cd.textContent = (left > 0) ? ('自动放弃：' + left + 's') : (__hasOwnTriggerInWindow ? '（等你决定：这是你自己的触发，不会自动放弃）' : '（自动放弃已关闭）');
  bar.appendChild(cd);
  var never = document.createElement('button');
  never.className = 'modal-btn';
  never.style.cssText = 'padding:5px 10px;font-size:12px;';
  never.textContent = '本会话不再询问';
  never.onclick = function (ev) {
    ev.stopPropagation();
    /* 【2026-10-03】二次确认：一点就静默关掉所有连锁询问，很容易误触成"AI 抢跑"。 */
    try {
      if (typeof confirm === 'function' && !confirm('确定本会话内不再弹出连锁询问？\n（此后所有连锁都会自动放弃；可随时用 setChainNeverAsk(false) 恢复）')) return;
    } catch (e) { try { console.error('[catch] assets/ui.js:473', e); } catch (e2) {} }
    __chainNeverAsk = true; finish(choices.length - 1);
  };
  bar.appendChild(never);
  buttonsDiv.appendChild(bar);
  if (left > 0) {
    timer = setInterval(function () {
      left--;
      if (left <= 0) { finish(choices.length - 1); return; }
      cd.textContent = '自动放弃：' + left + 's';
    }, 1000);
  }
  modal.classList.add('active');
}

function showBlockedReason(el) {
  if (!el) return;
  var r = el.getAttribute('data-block-reason') || '';
  showToast('这张卡当前不可用：' + r, 'warn');
}

function showCardDetail(card) {
  if (!card) return;
  var modal = document.getElementById('cardDetailModal');
  if (!modal) return;

  var __isChar = (card._category === 'characters') || (!!card.passive && !card.effect);
  document.getElementById('cardDetailTitle').textContent = __isChar ? '角色卡详情' : '卡牌详情';
  document.getElementById('cardDetailName').textContent = card.name || '未知卡牌';

  var metaHtml = '';
  if (__isChar) {
    if (card.sync !== undefined && card.sync !== '') metaHtml += '<span>同步值：' + card.sync + '</span>';
    if (card.attribute) metaHtml += '<span>属性：' + card.attribute + '</span>';
    metaHtml += '<span>角色卡</span>';
    if (card.cost !== undefined && card.cost !== '') metaHtml += '<span>费用：' + card.cost + '</span>';
  } else {
    if (card.cost !== undefined) metaHtml += '<span>费用：' + card.cost + '</span>';
    if (card.attribute) metaHtml += '<span>属性：' + card.attribute + '</span>';
    if (card.type) metaHtml += '<span>类型：' + card.type + '</span>';
    if (card._category) {
      var catMap = {
        'characters': '角色卡', 'attack_cards': '攻击卡', 'skill_cards': '技能卡',
        'item_permanent': '永续道具', 'item_single': '单次道具', 'gift_cards': '馈赠卡',
        'music_cards': '乐谱卡', 'event_cards': '事件卡', 'omikuji': '御神签'
      };
      metaHtml += '<span>' + (catMap[card._category] || card._category) + '</span>';
    }
    if (card.baseDamage) metaHtml += '<span>基础伤害：' + card.baseDamage + '</span>';
    if (card.range) metaHtml += '<span>攻击距离：' + card.range + '</span>';
  }
  document.getElementById('cardDetailMeta').innerHTML = metaHtml;

  /* 【2026-09-30 作者要求】对战中也必须能查角色卡的**完整信息** ⇒ 角色卡显示：卡图 + 被动全文 + SP 全文。
     （普通卡沿用原来的"主效果 + SP"口径） */
  var effectText;
  if (__isChar) {
    var __parts = [];
    if (card.passive) __parts.push('【被动】\n' + card.passive);
    if (card.sp) __parts.push('【SP】\n' + card.sp);
    effectText = __parts.length ? __parts.join('\n\n') : '（该角色卡没有被动/SP文本）';
  } else {
    effectText = card._fullEffect || ((card.effect || card.text || card.desc || '') + (card.sp ? ('\nSP：' + card.sp) : '')) || '暂无效果描述';
  }
  document.getElementById('cardDetailEffect').textContent = effectText;

  /* 卡图：动态插入（弹窗原本没有图片位，用内联样式，避免再改 CSS） */
  try {
    var body = modal.querySelector('.card-detail-body');
    var img = document.getElementById('cardDetailImg');
    var src = card.image_url || card.avatar_url || '';
    if (src) {
      if (!img) {
        img = document.createElement('img');
        img.id = 'cardDetailImg';
        img.style.cssText = 'display:block;width:100%;max-width:340px;margin:0 auto 10px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.5);';
        body.insertBefore(img, body.firstChild);
      }
      img.src = src;
      img.alt = card.name || '';
      img.style.display = '';
    } else if (img) { img.style.display = 'none'; }
  } catch (e) { console.error('角色卡详情插图出错', e); }

  modal.classList.add('active');
}

function showCardModal(card, inputType, label, min, max, canFaceDown) {
  var modal = document.getElementById('cardModal');
  var title = document.getElementById('modalTitle');
  var cardName = document.getElementById('modalCardName');
  var cardEffect = document.getElementById('modalCardEffect');
  var inputArea = document.getElementById('modalInputArea');
  
  title.textContent = '使用【' + (card.name || '未知卡牌') + '】';
  cardName.textContent = card.name || '未知卡牌';
  cardEffect.textContent = card.effect || card.text || '暂无效果描述';
  
  var inputHtml = '';
  if (inputType === 'slider') {
    inputHtml = '<div class="modal-input-group">' +
      '<label class="modal-label">' + label + '</label>' +
      '<div class="modal-slider-value" id="sliderValue">' + min + '</div>' +
      '<input type="range" class="modal-slider" id="modalSlider" min="' + min + '" max="' + max + '" value="' + min + '" oninput="document.getElementById(\'sliderValue\').textContent=this.value">' +
      '</div>';
  } else if (inputType === 'number') {
    inputHtml = '<div class="modal-input-group">' +
      '<label class="modal-label">' + label + '</label>' +
      '<input type="number" class="modal-input" id="modalNumber" min="' + min + '" max="' + max + '" value="' + min + '">' +
      '</div>';
  } else if (inputType === 'target') {
    inputHtml = '<div class="modal-input-group">' +
      '<label class="modal-label">' + label + '</label>' +
      '<div style="display:flex;gap:10px;margin-top:10px;">' +
      '<button class="modal-btn" onclick="selectTarget(\'p2\')" style="flex:1;padding:15px;background:rgba(231,76,60,0.3);border:2px solid #e74c3c;border-radius:8px;cursor:pointer;color:#fff;">对手（玩家2）</button>' +
      '</div></div>';
  } else if (inputType === 'permanent') {
    var faceDownBtn = canFaceDown ? '<button class="modal-btn" onclick="confirmPermanentUse(true)" style="flex:1;padding:15px;background:rgba(52,73,94,0.8);border:2px solid #34495e;border-radius:8px;cursor:pointer;color:#feca57;">盖伏放置（不耗费，翻开时付费；本回合不可发）</button>' : '';
    inputHtml = '<div class="modal-input-group">' +
      '<label class="modal-label">' + label + '</label>' +
      '<div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap;">' +
      '<button class="modal-btn" onclick="confirmPermanentUse(false)" style="flex:1;padding:15px;background:rgba(46,204,113,0.3);border:2px solid #2ecc71;border-radius:8px;cursor:pointer;color:#fff;">正面放置（可立即发动效果）</button>' +
      faceDownBtn +
      '</div></div>';
  }
  
  inputArea.innerHTML = inputHtml;
  modal.classList.add('active');
}

function showChoiceModal(title, cardName, effect, choices, callback) {
  /* 决策账在真正渲染时建立，排队期间由 Hub 保管请求。 */
  return ENV.ask('p1', { kind: 'choice', label: title, cardName: cardName, effect: effect, choices: choices }, callback);
}

function renderBuffBar(user) {
  var el = document.getElementById(user==='p1'?'p1BuffBar':'p2BuffBar'); if (!el || !battleState) return;
  var buffs = getActiveBuffs(user);
  if (!buffs.length) { el.classList.remove('has'); el.innerHTML = '<span class="buff-empty">暂无生效增益 / 效果</span>'; return; }
  el.classList.add('has');
  var order = ['passive','stat','pending','progress','debuff'], html = '';
  order.forEach(function (cat) {
    var grp = buffs.filter(function(b){return b.cat===cat;}); if (!grp.length) return;
    html += '<span class="buff-group">';
    grp.forEach(function (b) {
      var tt = (b.title||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
      var prog = b.prog ? ('<span class="buff-prog"><i style="width:'+Math.min(100,Math.round(100*b.prog.v/b.prog.thr))+'%"></i></span>') : '';
      var val = (b.val!=='' ? '<span class="buff-val">'+b.val+'</span>' : '');
      html += '<span class="buff-chip tone-'+b.tone+'" title="'+tt+'"><span class="buff-ico">'+b.icon+'</span><span class="buff-name">'+b.name+'</span>'+val+prog+'</span>';
    });
    html += '</span>';
  });
  el.innerHTML = html;
}

function __updateBattleUI_impl() {
  if (!battleState) return;
  // 牌组堆模型：把"是否公开了牌组最上方那张卡"画出来（模型本身在 .deck-zone 里）
  try { if (typeof __renderDeckPile === 'function') __renderDeckPile(); } catch (e) { try { console.error('[catch] assets/ui.js:632', e); } catch (e2) {} }
  // 回音韵时点兜底（补齐绕过 recoverCost 的直接改费路径）
  try { if (typeof __syncRecoverTiming === 'function') __syncRecoverTiming(); } catch (e) { try { console.error('[catch] assets/ui.js:634', e); } catch (e2) {} }
  
  // 宫樱子被动：队伍同步降至阈值(20/15/10/5)时各+1次免费用卡（各阈值仅触发一次）
  try {
    var __skp = battleState.p1;
    if (__skp && __skp._sakuraPassive && __skp._sakuraThr) {
      var __skSync = __skp.sync || 0;
      [20, 15, 10, 5].forEach(function (t) {
        if (__skSync <= t && !__skp._sakuraThr[t]) {
          __skp._sakuraThr[t] = true;
          __skp._sakuraFreeUse = (__skp._sakuraFreeUse || 0) + 1;
          addBattleLog('p1', '【宫樱子被动】同步降至' + t + '以下，免费用卡次数+1（当前' + __skp._sakuraFreeUse + '次）');
        }
      });
    }
  } catch (e) { try { console.error('[catch] assets/ui.js:649', e); } catch (e2) {} }
  
  try {
    // 状态显示
    var p1SyncEl = document.getElementById('p1Sync');
    var p1CostEl = document.getElementById('p1Cost');
    var p2SyncEl = document.getElementById('p2Sync');
    var p2CostEl = document.getElementById('p2Cost');
    if (p1SyncEl) p1SyncEl.textContent = battleState.p1.sync;
    if (p1CostEl) p1CostEl.textContent = battleState.p1.cost;
    if (p2SyncEl) p2SyncEl.textContent = battleState.p2.sync;
    if (p2CostEl) p2CostEl.textContent = battleState.p2.cost;
    // 对手区域可见计数：手牌张数 / 效果处理区（含盖伏）张数 / 牌组余量 / 激励进度
    var __p2zc = document.getElementById('p2ZoneCounts');
    if (__p2zc) {
      var __p2h = battleState.p2.hand.length;
      var __p2perm = (battleState.p2.permanent || []).length;
      var __p2fd = (battleState.p2.faceDownCards || []).length;
      var __p2deck = (battleState.p2.deck || []).length;
      var __p2lv = battleState.p2.level || 1;
      var __p2need = (__p2lv >= 6) ? 7 : Math.max(1, __p2lv - 1);
      /* 【2026-10-14 作者要求「单机和联机都无法知道对手有几张事件卡（这个应该可以互相知道数量）」】
         事件卡不占手牌上限、平时只在自己那一行显示（见本文件 845 行），对手张数玩家完全看不到。
         这里把**张数**补进对手信息行。为什么读 `.length` 就够了（实测 `port-old/_tmp-hidden-shape.cjs`）：
           · 单机：`battleState.p2.eventCards` 是真实数组 ⇒ 取到真张数 ✓
           · 联机：对手的 eventCards 在 `online.js:27 HIDDEN_ZONES` 里 ⇒ 随快照遮蔽成 `{__hidden:true,n:张数}`，
             客人侧 decode 后是**长度 = 张数的数组**（元素全是"？？？"占位）⇒ `.length` 同样正确 ✓
             —— 只露数量、不露卡面，符合联机信息口径 ✓ */
      var __p2ev = (battleState.p2.eventCards || []).length;
      __p2zc.textContent = '对手 手牌×' + __p2h + ' · 区域×' + (__p2perm + __p2fd) + (__p2fd ? '（含盖伏×' + __p2fd + '）' : '') +
        ' · 事件×' + __p2ev +
        ' · 牌组×' + __p2deck + ' · 激励' + (battleState.p2.motivation || 0) + '/' + __p2need;
    }
    var __p2g = document.getElementById('p2GraveN');
    if (__p2g) __p2g.textContent = battleState.p2.grave.length;
    // 对手牌组堆的数量角标（与 p1 的 #deckCount 同构；可见的只有张数，卡面只在被公开时显示）
    var __p2dc = document.getElementById('p2DeckCount');
    if (__p2dc) __p2dc.textContent = (battleState.p2.deck || []).length;
    var __p2r = document.getElementById('p2RemovedN');
    if (__p2r) __p2r.textContent = ((battleState.p2.removed || []).length + (battleState.p2.removedFromGame || []).length);
    flashStat('p1Sync', battleState.p1.sync);
    flashStat('p2Sync', battleState.p2.sync);
    
    // 入迷值显示
    var p1Fas = document.getElementById('p1Fascination');
    var p2Fas = document.getElementById('p2Fascination');
    if (p1Fas) p1Fas.textContent = battleState.p1.fascination;
    if (p2Fas) p2Fas.textContent = battleState.p2.fascination;
    flashStat('p1Fascination', battleState.p1.fascination);
    flashStat('p2Fascination', battleState.p2.fascination);
    
    // UI5.0 对决头：头像/血条/名字/属性/金币/等级
    try {
      function __fillDuel(pl) {
        var P = battleState[pl];
        var cap = P.captain || null;
        var img = document.getElementById(pl + 'PortraitImg');
        /* 【2026-09-30 作者要求】对战页（对决头）名字旁改用**角色头像**（assets/avatars/av_N.jpg），
           没有头像的角色自动回落到卡图。上一版我改错了地方（改成了肉鸽页 rlPlayerPortrait）⇒ 界面没变化。 */
        var __face = cap ? (cap.avatar_url || cap.image_url) : null;
        if (img && __face && img.getAttribute('data-src') !== __face) {
          img.setAttribute('data-src', __face);
          img.style.display = '';
          img.src = __face;
        }
        var nm = document.getElementById(pl + 'Name');
        if (nm && cap) nm.textContent = cap.name;
        var at = document.getElementById(pl + 'Attr');
        if (at && cap) { at.textContent = cap.attribute || ''; at.setAttribute('data-a', cap.attribute || ''); }
        var bar = document.getElementById(pl + 'HpBar');
        if (bar) {
          var max = P.maxSync || P.sync || 1;
          bar.style.width = Math.max(0, Math.min(100, 100 * ((P.sync || 0) / max))) + '%';
        }
        var g = document.getElementById(pl + 'GoldTop');
        if (g) g.textContent = P.gold || 0;
        var lv = document.getElementById(pl + 'LvBadge');
        if (lv) lv.textContent = 'Lv' + (P.level || 1);
        // 护盾：>0 才显示徽标（对手护盾此前完全不可见，玩家无法判断斩杀线）
        var __sh = P.shield || 0;
        var __shWrap = document.getElementById(pl + 'ShieldWrap');
        var __shVal = document.getElementById(pl + 'ShieldTop');
        if (__shWrap) __shWrap.style.display = __sh > 0 ? '' : 'none';
        if (__shVal) __shVal.textContent = __sh;
        // 激励点数：显示"当前/升级需求"（Lv1-5 需求=当前等级-1，Lv6 起每级 7）
        var __mv = document.getElementById(pl + 'MotivationTop');
        if (__mv) {
          var __lvN = P.level || 1;
          var __need = (__lvN >= 6) ? 7 : Math.max(1, __lvN - 1);
          __mv.textContent = (P.motivation || 0) + '/' + __need;
        }
      }
      __fillDuel('p1'); __fillDuel('p2');
    } catch (e3) { /* 对决头渲染失败不影响流程 */ }
    
    // 中间状态信息栏更新
    var p1SyncCenter = document.getElementById('p1SyncCenter');
    var p1FasCenter = document.getElementById('p1FascinationCenter');
    var p1CostCenter = document.getElementById('p1CostCenter');
    var p1MaxCostCenter = document.getElementById('p1MaxCostCenter');
    var p1GoldCenter = document.getElementById('p1GoldCenter');
    var p1LevelCenter = document.getElementById('p1LevelCenter');
    var p1MotivationCenter = document.getElementById('p1MotivationCenter');
    if (p1SyncCenter) p1SyncCenter.textContent = battleState.p1.sync;
    if (p1FasCenter) p1FasCenter.textContent = battleState.p1.fascination;
    if (p1CostCenter) p1CostCenter.textContent = battleState.p1.cost;
    if (p1MaxCostCenter) p1MaxCostCenter.textContent = battleState.p1.maxCost || 12;
    if (p1GoldCenter) p1GoldCenter.textContent = battleState.p1.gold || 0;
    if (p1LevelCenter) p1LevelCenter.textContent = battleState.p1.level || 1;
    if (p1MotivationCenter) p1MotivationCenter.textContent = battleState.p1.motivation || 0;
    var p1ShieldCenter = document.getElementById('p1ShieldCenter');
    if (p1ShieldCenter) p1ShieldCenter.textContent = battleState.p1.shield || 0;
    flashStat('p1SyncCenter', battleState.p1.sync);
    flashStat('p1FascinationCenter', battleState.p1.fascination);
    flashStat('p1CostCenter', battleState.p1.cost);
    flashStat('p1GoldCenter', battleState.p1.gold || 0);
    flashStat('p1ShieldCenter', battleState.p1.shield || 0);
    // 增益/效果栏刷新
    renderBuffBar('p1'); renderBuffBar('p2');
    try { if (typeof __sfx !== 'undefined' && __sfx.bgmSync) __sfx.bgmSync(); } catch (e) { try { console.error('[catch] assets/ui.js:759', e); } catch (e2) {} }   /* 【2026-10-03】残血自动切 BGM */
    
    var turnInfoEl = document.getElementById('turnInfo');
    if (turnInfoEl) turnInfoEl.textContent = '回合 ' + battleState.turn;
    
    var phaseNames = { prepare: '准备阶段', main1: '主要阶段1', roll: '投骰阶段', main2: '主要阶段2', end: '结束阶段' };
    var phaseInfoEl = document.getElementById('phaseInfo');
    // 阶段保护（设计口径）：投掷阶段由玩家主动点击“进入下个阶段”结算推进到主要阶段2，不做任何自动推进
    try {
      battleState._moveResolved = !!battleState._moveResolved; // 仅规范化，不推进
    } catch (e) { try { console.error('[catch] assets/ui.js:769', e); } catch (e2) {} }
    if (phaseInfoEl) phaseInfoEl.textContent = phaseNames[battleState.phase] || battleState.phase;
    
    // 回合切换横幅（currentPlayer 或回合数变化时）
    if (typeof checkTurnBanner === 'function') checkTurnBanner();
    
    var deckCountEl = document.getElementById('deckCount');
    var graveCountEl = document.getElementById('graveCount');
    var handCountEl = document.getElementById('handCount');
    if (deckCountEl) deckCountEl.textContent = battleState.p1.deck.length;
    if (graveCountEl) graveCountEl.textContent = battleState.p1.grave.length;
    /* 【2026-10-11】公共墓地入口的张数 = 事件卡 + 乐谱卡（打出后进这里 ✓） */
    var publicGraveEl = document.getElementById('publicGraveCount');
    if (publicGraveEl) {
      try {
        var __pg = (typeof publicGraveyard !== 'undefined' && publicGraveyard) ? publicGraveyard : null;
        publicGraveEl.textContent = __pg ? (((__pg.event_cards || []).length) + ((__pg.music_cards || []).length)) : 0;
      } catch (e) { publicGraveEl.textContent = 0; }
    }
    // 手牌计数只算普通手牌，不算事件卡（事件卡不占用手牌上限）
    var normalHandCount = battleState.p1.hand.length;
    var eventCardCount = (battleState.p1.eventCards || []).length;
    if (handCountEl) handCountEl.textContent = normalHandCount + (eventCardCount > 0 ? ' + ' + eventCardCount + '事件' : '');
    
    // 渲染手牌（最重要，优先执行）
    var hand = document.getElementById('battleHand');
    if (hand) {
      var isPlayerTurn = battleState.currentPlayer === 'p1';
      var isActionPhase = battleState.phase === 'main1' || battleState.phase === 'main2';
      var isSkillPhase = isPlayerTurn && battleState.phase !== 'roll'; // 技能卡在非投掷阶段都可用
      if (true) { // 手牌始终渲染；能否点击/是否灰化完全由 evaluatePlayable 决定（角色技能卡全时点）
        // 渲染签名：内容/可点性/阶段/回合/局ID 未变则跳过整段 DOM 重建（高频调用下的性能与悬停状态保护）
        /* 【2026-10-15 作者报「手牌会有 1~2 张卡图消失然后很快刷新出来（每次结算/出牌后都会）」⇒ 结构修 ✓】
           根因：签名里含 `battleState.p1.cost`（音韵值），而**音韵值在每次结算/出牌后都会变**
             ⇒ 签名每次都不同 ⇒ **每次都整段 `hand.innerHTML` 重建** ⇒ `<img>` 被销毁再新建
             ⇒ 新元素要重新准备解码位图（每张卡图解码后约 2.5MB，缓存有限）⇒ 少数几张空白一瞬 ✗
           修法（结构层，不是加 if 压症状）：
             把签名拆成**两部分** ——
               · 构成签名（哪些卡、什么费）：**只有它变了**才需要重建 DOM（图片随之刷新是对的）
               · 状态签名（回合/阶段/音韵/可点性）：构成没变时**只做"灰化与可点性"的原地更新**，
                 复用已有 DOM 节点 ⇒ `<img>` 元素自始至终存活、**不会再闪** ✓
             行为等价性：可点性/灰化/提示本来就只取决于状态签名，原地更新与重建得到同样结果 ✓ */
        var __handComp = (battleState._sessionId || 0) + '|' +
          battleState.p1.hand.map(function (c) { return c.name + '#' + (c.cost === undefined ? '-' : c.cost); }).join(',') + '||' +
          (battleState.p1.eventCards || []).map(function (c) { return c.name + '#' + ((c._isMusic || c._category === 'music_cards') ? 'M' : 'E'); }).join(',');
        var __handState = __handComp + '|' + battleState.turn + '|' + battleState.phase + '|' + battleState.currentPlayer + '|' + battleState.p1.cost + '|' +
          battleState.p1.hand.map(function(c, i) {
            var pv = evaluatePlayable(c, 'p1');
            return c.name + '#' + (c.cost === undefined ? '-' : c.cost) + '#' + __handCostLabel(c) + '#' + (pv.ok ? '1' : '0') + '#' + (pv.reason || '');
          }).join(',') + '||' +
          (battleState.p1.eventCards || []).map(function(c) { return c.name + '#' + ((c._isMusic || c._category === 'music_cards') ? 'M' : 'E'); }).join(',');
        var __handSig = __handState;                   /* 沿用旧变量名，别处引用不受影响 ✓ */
        if (__handSig !== window.__lastHandSig) {
          window.__lastHandSig = __handSig;
          var __needRebuild = (__handComp !== window.__lastHandComp);
          window.__lastHandComp = __handComp;
          /* —— 构成未变 ⇒ 原地更新可点性/灰化，**不碰 <img>** ⇒ 卡图不再闪 ✓ —— */
          if (!__needRebuild && hand.querySelectorAll('.hand-card').length === (battleState.p1.hand.length + (battleState.p1.eventCards || []).length)) {
            try { __softUpdateHand(hand, isActionPhase, isPlayerTurn); } catch (e) { __needRebuild = true; }
          } else {
            __needRebuild = true;
          }
          if (__needRebuild) {
          // 诊断：主要阶段内手牌全部不可用时，把各卡原因写入战斗日志（玩家可复制反馈）。
          // 注意（2026-09-16）：**结算进行中不写这条**。收尾路径是"先渲染、后释放锁"，渲染时整副手牌
          // 都因为"效果/连锁结算中"而不可用 —— 这时写进日志的提示会永久留在日志里，
          // 玩家回传后看起来就像"卡死了"，而实际上那一瞬间是正常的（作者反复报的正是这条）。
          // 真正的"全部不可用"（耐久理由）才值得记账。
          var __eeBusyNow = (typeof __eeLocked === 'function') ? __eeLocked() : false;
          if (isPlayerTurn && isActionPhase && !__eeBusyNow && battleState.p1.hand.length > 0 &&
              battleState.p1.hand.every(function (c) { return !evaluatePlayable(c, 'p1').ok; })) {
            addBattleLog('system', '【提示】当前阶段手牌全部不可用：' + battleState.p1.hand.map(function (c) { var __pv2 = evaluatePlayable(c, 'p1'); return c.name + '（' + (__pv2.reason || '未知') + '）'; }).join('；') + '。也可点击灰色卡查看具体原因。');
          }
          var handHtml = battleState.p1.hand.map(function(card, i) {
            // 可用性统一走 evaluatePlayable：灰态/禁用与点击后拦截同一套规则，杜绝割裂。
            // 联机客人侧：客人不跑规则，改用房主（权威）在快照里给出的判定结果 —— 但要剔除**瞬时**理由，
            // 见 __guestPlayVerdict 的说明。
            var pv = (typeof Online !== 'undefined' && Online.active && Online.isGuest)
              ? __guestPlayVerdict(i, card) : evaluatePlayable(card, 'p1');
            var canClick = pv.ok;
            // 灰色卡点击时弹出具体不可用原因（便于诊断），可用卡正常使用
            var clickHandler = canClick ? 'useCard(' + i + ')' : 'showBlockedReason(this)';
            var cardStyle = canClick ? '' : 'opacity:0.4;cursor:not-allowed;filter:grayscale(0.55);';
            var phaseHint = canClick ? '' : '（不可用：' + pv.reason + '）';
            var typeBadge = (card._category === 'characters') ? '角色' : (card._category === 'attack_cards' ? '攻击' : (card._category === 'skill_cards' ? '技能' : (card._category === 'gift_cards' ? '馈赠' : (card._category === 'item_permanent' ? '永续道具' : (card._category === 'item_single' ? '道具' : '')))));
            if (card._blueprintCopy) typeBadge = '📐 蓝图复制';
            /* 【2026-10-09 作者要求】手牌：**鼠标悬停即浮出放大的原图**（通用浮层 __cardPeekShow；卡名编码后传参） */
            var __peek1 = ' onmouseenter="__cardPeekShow(this, \'' + encodeURIComponent(card.name || '') + '\')" onmouseleave="__cardPeekHide()"';
            return '<div class="hand-card' + (canClick ? ' playable' : '') + '"' + __peek1 + ' onclick="' + clickHandler + '" oncontextmenu="handCardContextMenu(' + i + ');return false;" style="' + cardStyle + '" data-block-reason="' + (canClick ? '' : __escHtml(pv.reason || '未知原因')) + '" title="左键使用，右键查看效果：' + card.name + phaseHint + '">' +
              (card.cost !== undefined ? '<div class="hand-card-cost">' + __handCostLabel(card) + '</div>' : '') +
              (card.image_url ? '<img loading="lazy" decoding="async" onerror="imgRetry(this)" src="' + card.image_url + '" class="hand-card-img" alt="' + card.name + '" >' : '') +
              '<div class="hand-card-name">' + card.name + '</div>' +
              (typeBadge ? '<div class="card-type-badge">' + typeBadge + '</div>' : '') + '</div>';
          }).join('');
          // 渲染事件卡和乐谱卡（不占用手牌上限，有特殊标记）
          if (battleState.p1.eventCards && battleState.p1.eventCards.length > 0) {
            handHtml += battleState.p1.eventCards.map(function(card, i) {
              var isMusic = card._isMusic || card._category === 'music_cards';
              var clickHandler = isMusic ? 'useMusicCard(' + i + ')' : 'useEventCard(' + i + ')';
              var badge = isMusic ? '乐' : '事';
              var badgeColor = isMusic ? '#fd79a8' : '#a29bfe';
              var bgGradient = isMusic ? 'linear-gradient(135deg,#fd79a8,#e84393)' : 'linear-gradient(135deg,#a29bfe,#6c5ce7)';
              var cardType = isMusic ? '乐谱卡' : '事件卡';
              var icon = isMusic ? '🎵' : '📜';
              // 事件卡全时点：自己回合主要阶段 / 对手回合任意阶段可点；乐谱卡仅自己回合主要阶段
              var evCanClick = isMusic ? (isActionPhase && isPlayerTurn) : ((isActionPhase && isPlayerTurn) || !isPlayerTurn);
              var evStyle = evCanClick ? '' : 'opacity:0.4;cursor:not-allowed;';
              var evClick = evCanClick ? clickHandler : '';
              /* 【2026-10-09 作者要求】事件卡/乐谱卡同样悬停看放大原图 */
              var __peek2 = ' onmouseenter="__cardPeekShow(this, \'' + encodeURIComponent(card.name || '') + '\')" onmouseleave="__cardPeekHide()"';
              return '<div class="hand-card event-card"' + __peek2 + ' onclick="' + evClick + '" style="' + evStyle + '" title="【' + cardType + '】' + card.name + ' - ' + (card.effect||'').substring(0,80) + '（' + cardType + '不占用手牌上限）">' +
                '<div class="hand-card-cost" style="background:' + badgeColor + ';">' + badge + '</div>' +
                '<div class="hand-card-img" style="background:' + bgGradient + ';display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;">' + icon + '</div>' +
                '<div class="hand-card-name">' + card.name + '</div></div>';
            }).join('');
          }
          hand.innerHTML = handHtml;
          }      /* 【2026-10-15】闭合 if (__needRebuild)（漏补过一次 ⇒ 语法错，见本次修复说明）✓ */
        }
      } else {
        hand.innerHTML = '<div style="color:rgba(255,255,255,0.4);font-size:12px;">' + 
          (battleState.currentPlayer === 'p2' ? '对手回合中...' : '当前阶段：' + (phaseNames[battleState.phase] || battleState.phase) + '，点击"进入下个阶段"继续') + '</div>';
      }
    }
  } catch(e) {
    console.error('updateBattleUI core error:', e);
  }
  
  try {
    // 渲染双方效果处理区（永续+盖伏，各3格）：p1 可操作，p2 只读可查看（盖伏不泄露卡面）
    renderZoneSlots('p1');
    renderZoneSlots('p2');
  } catch(e) {
    console.error('updateBattleUI permanent error:', e);
  }
  
  try {
    // 根据阶段控制按钮显示
    var btnNext = document.getElementById('btnNextPhase');
    var btnRoll = document.getElementById('btnRoll');
    var btnEnd = document.getElementById('btnEndTurn');
    
    var btnDrawCost = document.getElementById('btnDrawByCost');
    if (battleState.currentPlayer !== 'p1') {
      if (btnNext) btnNext.style.display = 'none';
      if (btnRoll) btnRoll.style.display = 'none';
      if (btnEnd) btnEnd.style.display = 'none';
      if (btnDrawCost) btnDrawCost.style.display = 'none';
    } else if (battleState.phase === 'main1') {
      if (btnNext) btnNext.style.display = 'inline-block';
      if (btnNext) btnNext.textContent = '进入投骰阶段';
      if (btnRoll) btnRoll.style.display = 'none';
      if (btnEnd) btnEnd.style.display = 'none';
      if (btnDrawCost) btnDrawCost.style.display = 'inline-block';
      var btnSac = document.getElementById('btnSacrifice');
      if (btnSac) btnSac.style.display = 'inline-block';
      var btnPassive = document.getElementById('btnPassive');
      if (btnPassive) btnPassive.style.display = 'inline-block';
    } else if (battleState.phase === 'roll') {
      // 设计口径：投掷阶段由玩家主动结算——已投骰且移动收尾后显示“进入主要阶段2”按钮，否则显示投骰按钮
      if (battleState._diceRolledThisPhase && battleState._moveResolved) {
        if (btnNext) { btnNext.style.display = 'inline-block'; btnNext.textContent = '进入主要阶段2'; }
        if (btnRoll) btnRoll.style.display = 'none';
      } else {
        if (btnNext) btnNext.style.display = 'none';
        if (btnRoll) btnRoll.style.display = 'inline-block';
      }
      if (btnEnd) btnEnd.style.display = 'none';
      if (btnDrawCost) btnDrawCost.style.display = 'none';
    } else if (battleState.phase === 'main2') {
      if (btnNext) btnNext.style.display = 'inline-block';
      if (btnNext) btnNext.textContent = '进入结束阶段';
      if (btnRoll) btnRoll.style.display = 'none';
      if (btnEnd) btnEnd.style.display = 'none';
      if (btnDrawCost) btnDrawCost.style.display = 'inline-block';
      var btnSac = document.getElementById('btnSacrifice');
      if (btnSac) btnSac.style.display = 'inline-block';
      var btnPassive = document.getElementById('btnPassive');
      if (btnPassive) btnPassive.style.display = 'inline-block';
    } else if (battleState.phase === 'prepare') {
      if (btnNext) btnNext.style.display = 'inline-block';
      if (btnNext) btnNext.textContent = '进入主要阶段1';
      if (btnRoll) btnRoll.style.display = 'none';
      if (btnEnd) btnEnd.style.display = 'none';
      var btnSac = document.getElementById('btnSacrifice');
      if (btnSac) btnSac.style.display = 'inline-block';
      var btnPassive = document.getElementById('btnPassive');
      if (btnPassive) btnPassive.style.display = 'inline-block';
    } else if (battleState.phase === 'end') {
      if (btnNext) btnNext.style.display = 'none';
      if (btnRoll) btnRoll.style.display = 'none';
      if (btnEnd) btnEnd.style.display = 'inline-block';
      if (btnDrawCost) btnDrawCost.style.display = 'none';
      var btnSac = document.getElementById('btnSacrifice');
      if (btnSac) btnSac.style.display = 'inline-block';
      var btnPassive = document.getElementById('btnPassive');
      if (btnPassive) btnPassive.style.display = 'inline-block';
    } else {
      if (btnNext) btnNext.style.display = 'none';
      if (btnRoll) btnRoll.style.display = 'none';
      if (btnEnd) btnEnd.style.display = 'none';
    }
  } catch(e) {
    console.error('updateBattleUI buttons error:', e);
  }
  
  try {
    // 更新地图
    renderBattleMap();
  } catch(e) {
    console.error('updateBattleUI map error:', e);
  }
}

/* 【2026-10-19 作者点名】逃脱/执勤证明的地图选格：可点击格盘（合法格高亮、非法格禁用）。
   不依赖 3D 地图是否就绪；42 格按 7 列排列，点击合法格回调 tile id。 */
function showTilePicker(allTiles, legalTiles, title, hint, cb) {
  try {
    var old = document.getElementById('tilePickerOverlay'); if (old) old.remove();
    var legal = {}; (legalTiles || []).forEach(function (x) { legal[x] = 1; });
    var ov = document.createElement('div');
    ov.id = 'tilePickerOverlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:3000;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px;';
    var panel = document.createElement('div');
    panel.style.cssText = 'width:min(94vw,760px);max-height:88vh;overflow:auto;background:#141a24;border:1px solid rgba(254,202,87,.45);border-radius:12px;padding:14px;box-shadow:0 18px 50px rgba(0,0,0,.55);';
    var h = document.createElement('div');
    h.style.cssText = 'color:#feca57;font-weight:700;font-size:16px;margin-bottom:4px;';
    h.textContent = title || '选择目标格';
    panel.appendChild(h);
    var sub = document.createElement('div');
    sub.style.cssText = 'color:#9fb0c7;font-size:12px;margin-bottom:10px;';
    sub.textContent = hint || '点击高亮格子移动';
    panel.appendChild(sub);
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;';
    (allTiles || []).forEach(function (id) {
      var t = (typeof MAP_TILES !== 'undefined' && MAP_TILES[id]) || null;
      var ok = !!legal[id];
      var b = document.createElement('button');
      b.type = 'button';
      b.disabled = !ok;
      b.style.cssText = 'min-height:56px;padding:5px 3px;border-radius:8px;border:1px solid ' + (ok ? 'rgba(254,202,87,.55)' : 'rgba(255,255,255,.12)') + ';'
        + 'background:' + (ok ? 'linear-gradient(135deg,#2b3a2b,#1e2a1e)' : '#1b222d') + ';color:' + (ok ? '#f5e6b8' : '#5f6b7a') + ';'
        + 'cursor:' + (ok ? 'pointer' : 'not-allowed') + ';font-size:11px;line-height:1.25;text-align:center;';
      b.textContent = '#' + id + ' ' + ((t && t.name) || '');
      if (ok) b.onclick = function () { try { ov.remove(); } catch (e) {} if (typeof Map3D !== 'undefined' && Map3D && Map3D.clearPreview) { try { Map3D.clearPreview(); } catch (e) {} } cb(id); };
      grid.appendChild(b);
    });
    panel.appendChild(grid);
    var close = document.createElement('button');
    close.type = 'button'; close.textContent = '取消';
    close.style.cssText = 'margin-top:10px;padding:6px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:#222c3a;color:#cbd5e1;cursor:pointer;';
    close.onclick = function () { try { ov.remove(); } catch (e) {} };
    panel.appendChild(close);
    ov.appendChild(panel);
    (document.body || document.documentElement).appendChild(ov);
    if (typeof Map3D !== 'undefined' && Map3D && Map3D.previewTiles) {
      try { Map3D.previewTiles((legalTiles || []).map(function (id) { return { id: id, color: 0xffd166 }; })); } catch (e) {}
    }
  } catch (e) { try { console.error('showTilePicker 出错', e); } catch (e2) {} }
}

function renderZoneSlots(pl) {
  if (!battleState || !battleState[pl]) return;
  var box = document.getElementById(pl + 'PermanentSlots');
  if (!box) return;
  var P = battleState[pl];
  var mine = (pl === 'p1');
  var list = [];
  (P.permanent || []).forEach(function (c, i) { if (c && !c._chainC1) list.push({ card: c, type: 'permanent', index: i }); });
  (P.faceDownCards || []).forEach(function (c, i) { if (c) list.push({ card: c, type: 'facedown', index: i }); });
  // 作者口径：C1 卡**占用效果处理区的格子**（计入 3 格上限）→ 它排进这 3 格里，
  // 而不是"3 个空位 + 额外第 4 格"（我第一版就是这么渲染的，看起来等于没占格）
  var __c1entries = [];
  (P.permanent || []).forEach(function (c, i) { if (c && c._chainC1) __c1entries.push({ card: c, type: 'chainC1', index: i }); });
  var __all = list.concat(__c1entries);   // 常驻/盖伏在前，C1 进队尾 → 有空位就先占空位
  var html = '';
  /* 【2026-10-17 作者点第 10 项·**效果处理区也标位置**】空位本来写着「空位N」，但**占用的格子没有编号** ⇒
     玩家看不出哪张卡在第几格（而"从效果处理区取一张"这类效果是按格位来的）。
     这里给每个占用格加一个"第N格"小标签（与牌组/墓地的短标签同一套观感 ✓，9px、不折行） */
  var __slotIdx = function (k, over) {
    return '<div style="font-size:9px;font-weight:600;color:rgba(254,202,87,.82);line-height:1.1;margin-bottom:2px;white-space:nowrap;">' +
      (over ? '超出3格' : ('第' + k + '格')) + '</div>';
  };
  for (var i = 0; i < 3; i++) {
    var it = __all[i];
    if (!it) { html += '<div class="permanent-slot empty">空位' + (i + 1) + '</div>'; continue; }
    if (it.type === 'chainC1') {
      html += '<div class="permanent-slot permanent-card chain-c1" title="连锁 C1（结算中）：' + (it.card.name || '') + ' — 结算完毕后按种类送墓">' +
        __slotIdx(i + 1) +
        (it.card.image_url ? '<img loading="lazy" decoding="async" onerror="imgRetry(this)" src="' + it.card.image_url + '" class="slot-img" alt="' + it.card.name + '">' : '') +
        '<div class="slot-name">' + (it.card.name || '') + '</div><div class="slot-type">C1 结算中</div></div>';
      continue;
    }
    if (it.type === 'facedown') {
      /* 【2026-10-19 冬马被动②】属性相同后卡主选择“留在原区正面” ⇒ 卡仍在 faceDownCards，
         但 _faceUp=true；不能继续画成「盖伏」，否则双方看到的和实际处理不一致。 */
      if (it.card._faceUp === true) {
        html += '<div class="permanent-slot permanent-card face-up" title="正面留在原区：' + (it.card.name || '') + '">' +
          __slotIdx(i + 1) +
          (it.card.image_url ? '<img loading="lazy" decoding="async" onerror="imgRetry(this)" src="' + it.card.image_url + '" class="slot-img" alt="' + it.card.name + '">' : '') +
          '<div class="slot-name">' + (it.card.name || '') + '</div><div class="slot-type">正面</div></div>';
        continue;
      }
      var canAct = mine && !(it.card._faceDownTurn === battleState.turn && it.card._faceDownPlayer === pl && battleState.currentPlayer === pl);
      var fdTitle = mine ? (canAct ? '盖伏卡 - 点击发动（鼠标悬停可查看卡面）' : '盖伏卡 - 本回合无法发动（鼠标悬停可查看卡面）') : '对手的盖伏卡';
      var fdOnclick = mine ? (canAct ? ("uiActivateFaceDown(" + it.index + ")") : "showToast('盖伏当回合无法发动！', 'warn')") : '';
      var fdType = mine ? (canAct ? '可发动' : '本回合禁用') : '对手·盖伏';
      /* 【2026-10-09 作者要求·盖卡可查询】鼠标**悬停**即显示卡面浮层（只对**自己的**盖卡生效；
         对手的盖卡不加这两个处理器 ⇒ 不泄露）。点击行为保持不变（发动 / 本回合无法发动提示）。 */
      var fdHover = mine ? (' onmouseenter="__fdPeekShow(this, ' + it.index + ')" onmouseleave="__fdPeekHide()"') : '';
      html += '<div class="permanent-slot permanent-card face-down" title="' + fdTitle + '"' +
        (mine ? ' onclick="' + fdOnclick + '"' : '') + fdHover +
        ' style="background:linear-gradient(135deg,#2c3e50,#34495e);' + (mine ? 'cursor:pointer;' : 'cursor:default;') + '">' +
        __slotIdx(i + 1) +
        '<div class="slot-name" style="color:#feca57;">盖伏</div><div class="slot-type">' + fdType + '</div></div>';
    } else {
      /* 【2026-10-14 新卡·雷閃·SP ⇒ 结构修 ✓】卡面写「这个效果在其他玩家回合也能发动」的永续卡（雷閃），
      /* 【2026-10-14 作者报「能先单独发一次、再连锁又发一次」⇒ 结构修 ✓】
         雷閃 SP 已改为**只走全时点连锁候选**一条路径 ⇒ 这里恢复原条件（点场上的卡仅自己主要回合 ✓），
         不再给它开 anyTurn 的口子（否则两条路径各自判次数 ⇒ 一回合发两次 ✗）。 */
      var permCanAct = mine && battleState.currentPlayer === pl && (battleState.phase === 'main1' || battleState.phase === 'main2');
      var permTitle = it.card.name + (mine ? (permCanAct ? ' - 点击发动效果' : ' - 仅自己主要阶段可发动主动效果') : '（对手场上·点击查看卡面）');
      var permStyle = mine ? (permCanAct ? 'cursor:pointer;' : 'cursor:not-allowed;opacity:0.45;filter:grayscale(0.5);') : 'cursor:help;';
      // 对手永续卡点击只做只读查看，避免误触发 p1 的发动入口
      var permOnclick = mine ? (permCanAct ? ('activatePermanentCard(' + it.index + ')') : '') : ('showCardDetail(battleState.' + pl + '.permanent[' + it.index + '])');
      /* 【2026-10-09 作者目标第4项】场上永续卡：**鼠标悬停即浮出放大的原图**（通用浮层） */
      var permPeek = ' onmouseenter="__cardPeekShow(this, \'' + encodeURIComponent(it.card.name || '') + '\')" onmouseleave="__cardPeekHide()"';
      html += '<div class="permanent-slot permanent-card"' + permPeek + ' title="' + permTitle + '"' +
        (permOnclick ? ' onclick="' + permOnclick + '"' : '') + ' style="' + permStyle + '">' +
        __slotIdx(i + 1) +
        (it.card.image_url ? '<img loading="lazy" decoding="async" onerror="imgRetry(this)" src="' + it.card.image_url + '" class="slot-img" alt="' + it.card.name + '">' : '') +
        '<div class="slot-name">' + it.card.name + '</div><div class="slot-type">永续' +
        (mine ? (permCanAct ? '(点击发动)' : '(不可主动发动)') : '（对手）') + '</div></div>';
    }
  }
  // 超出 3 格的 C1 卡（场上常驻已满 3 格时使用卡）：仍然显示出来，但明确标注"超出上限"，
  // 让玩家看得见"这一下已经超格了"，而不是悄悄消失
  for (var __k = 3; __k < __all.length; __k++) {
    var __x = __all[__k];
    if (!__x || __x.type !== 'chainC1') continue;
    html += '<div class="permanent-slot permanent-card chain-c1 chain-c1-over" title="连锁 C1（结算中，**超出效果处理区 3 格上限**）：' + (__x.card.name || '') + '">' +
      __slotIdx(0, true) +
      (__x.card.image_url ? '<img loading="lazy" decoding="async" onerror="imgRetry(this)" src="' + __x.card.image_url + '" class="slot-img" alt="' + __x.card.name + '">' : '') +
      '<div class="slot-name">' + (__x.card.name || '') + '</div><div class="slot-type">C1·超出上限</div></div>';
  }
  box.innerHTML = html;
}

function renderBattleMap() {
  if (!battleState) return;
  // 3D 地图就绪时：只同步棋子位置，不再重建 2D 横向地图（2D 仅作为 WebGL 不可用时的回退）
  if (typeof Map3D !== 'undefined' && Map3D.isReady()) {
    try { Map3D.syncFromGame(); } catch (e) { console.error('Map3D sync error', e); }
    var __p1t = MAP_TILES[battleState.p1.position], __p2t = MAP_TILES[battleState.p2.position];
    var __n1 = document.getElementById('p1PosNum'); if (__n1) __n1.textContent = battleState.p1.position;
    var __nm1 = document.getElementById('p1PosName'); if (__nm1 && __p1t) __nm1.textContent = __p1t.name;
    var __n2 = document.getElementById('p2PosNum'); if (__n2) __n2.textContent = battleState.p2.position;
    var __nm2 = document.getElementById('p2PosName'); if (__nm2 && __p2t) __nm2.textContent = __p2t.name;
    renderMinimap();
    return;
  }
  
  var p1Tile = MAP_TILES[battleState.p1.position];
  var p2Tile = MAP_TILES[battleState.p2.position];
  
  // 确定玩家1所在行的格子范围
  var p1Pos = battleState.p1.position;
  var rowTiles = [];
  if (p1Pos >= 0 && p1Pos <= 13) {
    // 底部行 0-13
    for (var i = 0; i <= 13; i++) rowTiles.push(MAP_TILES[i]);
  } else if (p1Pos >= 14 && p1Pos <= 21) {
    // 左侧列 14-21（从下到上显示）
    for (var i = 14; i <= 21; i++) rowTiles.push(MAP_TILES[i]);
  } else if (p1Pos >= 22 && p1Pos <= 34) {
    // 顶部行 22-34
    for (var i = 22; i <= 34; i++) rowTiles.push(MAP_TILES[i]);
  } else {
    // 右侧列 35-41（从上到下显示）
    for (var i = 35; i <= 41; i++) rowTiles.push(MAP_TILES[i]);
  }
  
  // 格子图标映射
  var tileIcons = {
    start: '🏁', gift: '🎁', item: '🔄', again: '↩️',
    bus: '🚌', card: '🃏', subway: '🚇', story: '📖',
    power: '⚡', inspire: '💡', read: '📚', shrine: '⛩️',
    game: '🎮', airport: '✈️'
  };
  
  // 渲染横向地图
  var compactMap = document.getElementById('compactMap');
  if (compactMap) {
    var html = '';
    for (var i = 0; i < rowTiles.length; i++) {
      var tile = rowTiles[i];
      var icon = tileIcons[tile.type] || '❓';
      var classes = 'compact-tile tile-' + tile.type;
      if (battleState.p1.position === tile.id) classes += ' current-p1';
      if (battleState.p2.position === tile.id) classes += ' current-p2';
      /* 【2026-10-21】配电室关闭的格子（全局）加醒目标记 + 悬浮提示 */
      var __closedNames = [];
      try { playerIds().forEach(function(w){ var q=battleState[w]; if(q && q.closedTile===tile.id) __closedNames.push(playerDisplayName(w)); }); } catch(e){}
      var __closed = __closedNames.length > 0;
      if (__closed) classes += ' tile-closed';
      
      var dots = '';
      if (battleState.p1.position === tile.id) dots += '<div class="player-dot dot-p1">1</div>';
      if (battleState.p2.position === tile.id) dots += '<div class="player-dot dot-p2">2</div>';
      if (__closed) dots += '<div class="tile-closed-badge">⛔ 关闭</div>';
      
      html += '<div class="' + classes + '" title="第' + tile.id + '格 - ' + tile.name + (__closed ? ('（已被配电室关闭；关闭者：' + __closedNames.join('、') + '）') : '') + '">' +
        dots +
        '<span class="tile-icon">' + icon + '</span>' +
        '<span class="tile-num">#' + tile.id + '</span>' +
        '<span class="tile-name">' + tile.name + '</span></div>';
    }
    compactMap.innerHTML = html;
  }
  
  // 更新位置信息
  var p1Num = document.getElementById('p1PosNum');
  var p1Name = document.getElementById('p1PosName');
  var p2Num = document.getElementById('p2PosNum');
  var p2Name = document.getElementById('p2PosName');
  if (p1Num) p1Num.textContent = battleState.p1.position;
  if (p1Name && p1Tile) p1Name.textContent = p1Tile.name;
  if (p2Num) p2Num.textContent = battleState.p2.position;
  if (p2Name && p2Tile) p2Name.textContent = p2Tile.name;
  
  // 同时渲染小地图
  renderMinimap();
}

function renderMinimap() {
  if (!battleState) return;
  
  var expandP1 = document.getElementById('expandP1Pos');
  var expandP2 = document.getElementById('expandP2Pos');
  
  // 小地图（使用真实地图图片，显示玩家位置标记）
  var p1Tile = MAP_TILES[battleState.p1.position];
  var p2Tile = MAP_TILES[battleState.p2.position];
  var miniP1 = document.getElementById('minimapP1Marker');
  var miniP2 = document.getElementById('minimapP2Marker');
  
  if (miniP1 && p1Tile) {
    miniP1.style.left = p1Tile.x + '%';
    miniP1.style.top = p1Tile.y + '%';
    miniP1.title = '玩家1：第' + battleState.p1.position + '格 - ' + p1Tile.name;
  }
  if (miniP2 && p2Tile) {
    miniP2.style.left = p2Tile.x + '%';
    miniP2.style.top = p2Tile.y + '%';
    miniP2.title = '对手：第' + battleState.p2.position + '格 - ' + p2Tile.name;
  }
  
  // 放大地图（真实图片，只更新标记）
  var p1Marker = document.getElementById('expandP1Marker');
  var p2Marker = document.getElementById('expandP2Marker');
  if (p1Marker && p1Tile) {
    p1Marker.style.left = p1Tile.x + '%';
    p1Marker.style.top = p1Tile.y + '%';
  }
  if (p2Marker && p2Tile) {
    p2Marker.style.left = p2Tile.x + '%';
    p2Marker.style.top = p2Tile.y + '%';
  }
  
  if (expandP1) expandP1.textContent = battleState.p1.position;
  if (expandP2) expandP2.textContent = battleState.p2.position;
}

function __renderBattleLogFromState() {
  try {
    if (typeof battleState === 'undefined' || !battleState || !battleState._logs) return 0;
    var all = battleState._logs;
    var log = document.getElementById('battleLog');
    if (!log) return 0;
    // 本地新日志可能让计数超过权威长度（快照覆盖后）→ 重建，避免少画/错画
    if (all.length < __logRenderedCount) { log.innerHTML = ''; __logRenderedCount = 0; }
    if (all.length === __logRenderedCount) return 0;
    var added = 0;
    for (var i = __logRenderedCount; i < all.length; i++) {
      var rec = all[i];
      if (!rec) continue;
      if (__appendLogEntry(rec)) added++;
      // 客人的 battleLogs（导出/复制用）也要跟上，否则"复制日志"拿到的是空的
      if (battleLogs[battleLogs.length - 1] !== rec) battleLogs.push(rec);
    }
    __logRenderedCount = all.length;
    var __nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 70;
    if (__nearBottom) log.scrollTop = log.scrollHeight;
    return added;
  } catch (e) { return 0; }
}

function showCardPickerMulti(cards, title, callback, needCount, allowLess, allowCancel) {
  /* 显示与决策账由 Hub 的实际选卡渲染步骤管理。 */
  /* allowCancel（2026-10-01）：允许玩家点"取消"放弃这次选卡（如献祭，防止误触浪费每回合次数）。
     默认 false ⇒ 其它"必须选卡"的效果流程完全不受影响。 */
  return ENV.ask('p1', { kind: 'pickCards', cards: cards, label: title, need: needCount, allowLess: allowLess, allowCancel: !!allowCancel }, callback);
}

function showTargetSelect(card, effectText, callback) {
  // C 阶段·第 2 步收尾：目标选择也走决策出口（调用点不改）
  return ENV.ask('p1', { kind: 'targetPlayer', card: card, effectText: effectText }, callback);
}

function showTimingQuestion(effectName, effectDesc, question, callback) {
  // 双方都没有真正可连锁的卡时，不弹询问，直接执行
  if (!hasAnyDeclareChain()) { if (callback) callback(false); return; }
  var modal = document.getElementById('timingModal');
  document.getElementById('timingTitle').textContent = '时点询问';
  document.getElementById('timingEffectName').textContent = effectName || '';
  document.getElementById('timingEffectDesc').textContent = effectDesc || '';
  document.getElementById('timingQuestion').textContent = question || '是否要连锁发动效果？';
  
  var optionsDiv = document.getElementById('timingOptions');
  optionsDiv.innerHTML = '';
  
  effectEngine.pendingTimingCallback = callback;
  
  var noBtn = document.createElement('button');
  noBtn.className = 'timing-option no';
  noBtn.textContent = '不连锁';
  noBtn.onclick = function() { answerTiming(false); };
  optionsDiv.appendChild(noBtn);
  
  // 简化版：PvE中玩家可以选择连锁，AI自动判断
  var yesBtn = document.createElement('button');
  yesBtn.className = 'timing-option yes';
  yesBtn.textContent = '连锁发动';
  yesBtn.onclick = function() { answerTiming(true); };
  optionsDiv.appendChild(yesBtn);
  
  modal.classList.add('active');
}

function showEffectLog() {
  var box = document.getElementById('resolveTimeline');
  if (!box || !effectEngine.effectLog.length) return;
  var body = document.getElementById('resolveTimelineBody');
  body.innerHTML = '';
  for (var i = 0; i < effectEngine.effectLog.length; i++) {
    var log = effectEngine.effectLog[i];
    var div = document.createElement('div');
    var cls = 'rt-item';
    if ((log.class || '').indexOf('step-then') >= 0) cls += ' rt-then';
    else if ((log.class || '').indexOf('step-after') >= 0) cls += ' rt-after';
    div.className = cls;
    div.innerHTML = '<span class="rt-tag">' + (log.label || '').replace(/[【】]/g, '') + '</span>' + log.text;
    body.appendChild(div);
  }
  box.classList.add('show'); box.classList.remove('collapsed');
  __rtShownAt = Date.now();
  body.scrollTop = body.scrollHeight;
  if (__rtCollapseTimer) clearTimeout(__rtCollapseTimer);
  __rtCollapseTimer = setTimeout(function () { box.classList.add('collapsed'); }, 12000);
}

function renderChainBar(effect, opt) {
  opt = opt || {};
  var bar = document.getElementById('chainBar'); if (!bar || !effect) return;
  var links = document.getElementById('chainLinks');
  var stack = effect._chain || [];
  var html = '<div class="chain-link chain-origin">CHAIN 1：' + (effect.description || '待结算效果') + '</div>';
  for (var i = 0; i < stack.length; i++) {
    var cls = 'chain-link';
    if (opt.resolving === i) cls += ' chain-resolving';
    else if (opt.lost && opt.lost[i]) cls += ' chain-lost';
    else if (opt.done && opt.done[i]) cls += ' chain-done';
    html += '<span class="chain-arrow">⇄</span><div class="' + cls + '">CHAIN ' + (i + 2) + ' ' + (stack[i].by === 'p1' ? '我方' : '对方') + '·' + stack[i].name + '</div>';
  }
  links.innerHTML = html;
  bar.classList.add('show');
}

/* 【2026-10-17 作者点名·"查看牌组和墓地时无法确认顺序"】唯一真相 = 下面这三个：
     · `__zoneOrderBadge(zone, idx, total)` → 卡上的**短**位置标签（`#1 · 最上方`）
     · `__zoneOrderHint(zone)`             → 列表顶部那行**方向说明**（详细口径写在这里）
     · `__ZONE_BADGE_CSS` / `__ZONE_HINT_INLINE_CSS` → 这两处的**唯一**样式（三处查看口共用）
   口径（与引擎内部约定一致，代码里的注释已互证）：
     · 牌组：`deck[0]` = **最上方** = 下一张会抽到的卡（`takeTopCard` 走 `shift`）；末位 = **最下方**（回收卡回这里）
     · 墓地：`grave[0]` = **最下方** = 最早进墓；末位 = **最上方** = 最近进墓（`moveCardToGrave` 走 push）
     · 移出区 / 公共墓地：顺序不敏感 ⇒ 只给序号
   ⚠ 三处查看口都调它（本机牌组列表 / 本机墓地列表 / 通用查看列表）⇒ 以后只有一份口径 ✓
   为什么原来看不出顺序：牌组列表进来先 `sort(按名字)` 把顺序抹掉了 ✗（本次一并去掉排序）
   【2026-10-17 作者三轮反馈 ⇒ 最终形态】
     ① 卡上写 `#1 · 牌组最上方（下一抽）` ⇒ 作者「这字有点影响观感了」（120px 卡宽里折成两行、把卡图挤下去 ✗）；
     ② 我收紧到 `#1 · 最上方` + 禁止换行时，作者先说「放在牌组那行就好」；
     ③ 随即作者定「**可以加标签**」⇒ 最终 = **顶部一行说明 + 卡上短标签**（9px、`nowrap`、超出省略号）✓ */
function __zoneOrderBadge(zone, idx, total) {
  if (!(total > 0) || idx < 0 || idx >= total) return '';
  var n = idx + 1;
  if (total === 1) return '#' + n + ' · 唯一一张';
  if (zone === 'deck') {
    if (idx === 0) return '#' + n + ' · 最上方';
    if (idx === total - 1) return '#' + n + ' · 最下方';
    return '#' + n;
  }
  if (zone === 'grave') {
    if (idx === 0) return '#' + n + ' · 最下方';
    if (idx === total - 1) return '#' + n + ' · 最上方';
    return '#' + n;
  }
  if (zone === 'removed' || zone === 'public_grave') return '#' + n;
  return '';
}
function __zoneOrderHint(zone) {
  if (zone === 'deck') return '顺序：左＝最上方（下一张会抽到的卡） → 右＝最下方';
  if (zone === 'grave') return '顺序：左＝最下方（最早进墓） → 右＝最上方（最近进墓）';
  if (zone === 'removed') return '按移出游戏的先后排列（顺序不敏感）';
  if (zone === 'public_grave') return '按进入公共墓地的先后排列';
  return '';
}
/* 卡上短标签的**唯一**样式：9px、不加粗、低对比、**禁止换行**（超出省略号）—— 绝不再把卡图挤下去 ✓ */
var __ZONE_BADGE_CSS = 'font-size:9px;font-weight:600;color:rgba(254,202,87,.82);margin-bottom:2px;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
/* 说明的**行内**形态：拼在标题「牌组（N张）」旁边（作者 2026-10-17 定稿：「把说明放到牌组（6张）旁边」✓）
   返回 HTML 片段（带前导"·"分隔）；该区域没有说明时返回 ''（不占位）✓ */
var __ZONE_HINT_INLINE_CSS = 'font-size:11px;font-weight:400;color:rgba(255,255,255,.52);margin-left:10px;';
function __zoneOrderHintSpan(zone) {
  var t = __zoneOrderHint(zone);
  if (!t) return '';
  return '<span style="' + __ZONE_HINT_INLINE_CSS + '">· ' + t + '</span>';
}
try { window.__zoneOrderBadge = __zoneOrderBadge; } catch (e) {}
try { window.__zoneOrderHint = __zoneOrderHint; } catch (e) {}
try { window.__zoneOrderHintSpan = __zoneOrderHintSpan; } catch (e) {}
try { window.__ZONE_BADGE_CSS = __ZONE_BADGE_CSS; } catch (e) {}
try { window.__ZONE_HINT_INLINE_CSS = __ZONE_HINT_INLINE_CSS; } catch (e) {}

function showDeckList() {
  if (!battleState) return;
  var modal = document.getElementById('cardListModal');
  var title = document.getElementById('cardListTitle');
  var content = document.getElementById('cardListContent');
  
  /* 【2026-10-17 作者定稿·**说明放在「牌组（N张）」这一行旁边**】不另起一行（省一行高度、更干净 ✓） */
  title.innerHTML = '牌组（' + battleState.p1.deck.length + '张）' + __zoneOrderHintSpan('deck');
  content.innerHTML = '';
  
  if (battleState.p1.deck.length === 0) {
    content.innerHTML = '<div style="color:rgba(255,255,255,0.5);padding:20px;">牌组为空</div>';
  } else {
    /* 【2026-10-17 作者点名·"查看牌组无法确认顺序"】
       原来这里**先按卡名排序**再显示 ⇒ 牌组顺序信息被抹掉、玩家根本看不出哪张是最上/最下 ✗
       ⇒ 改成**按牌组真实顺序**显示，每张卡上标出它在牌组里的位置（唯一真相 `__zoneOrderBadge` ✓）
       说明那行**不在这里**：作者定稿是放在标题「牌组（N张）」旁边（见上面 `__zoneOrderHintSpan` ✓） */
    var deckArr = battleState.p1.deck;
    for (var i = 0; i < deckArr.length; i++) {
      var card = deckArr[i];
      var div = document.createElement('div');
      div.className = 'card-list-item';
      div.setAttribute('data-list-card', card.name || '');
      div.style.cssText = 'width:120px;padding:8px;background:rgba(0,0,0,0.3);border:2px solid rgba(255,255,255,0.2);border-radius:6px;cursor:pointer;transition:all 0.2s;';
      div.onmouseover = function() { this.style.borderColor = '#feca57'; };
      /* 【2026-10-11 作者视频 bug.mp4 证实】客机打开「牌组（5张）」列表，悬停**任意一项**浮出的都是
         **最后一张**（视频里是"弱点分析"）✗ 根因：当时那个 `var card = sortedDeck[i]` 是函数级作用域，
         所有迭代共用它，而悬停闭包在**悬停那一刻**才读 ⇒ 读到的永远是循环结束后的最后一张。
         修法：给这两个闭包各自绑定"当时的这张卡"（不动循环结构；与同文件墓地列表那处的 IIFE 同款思路）。
         【2026-10-17 补】v422 起本列表**不再按卡名排序**（改为真实牌组顺序）、遍历变量是 `deckArr[i]`
         ⇒ 上面那句引用的 `sortedDeck` 已不存在，此处一并订正免得后来人误以为排序还在 ✓ */
      div.onmouseenter = (function(c){ return function() { try { __cardPeekShow(this, encodeURIComponent(c.name || '')); } catch (e) { try { console.error('[catch] assets/ui.js:1274', e); } catch (e2) {} } }; })(card);
      div.onmouseleave = function() { try { __cardPeekHide(); } catch (e) { try { console.error('[catch] assets/ui.js:1275', e); } catch (e2) {} } };
      div.onmouseout = function() { this.style.borderColor = 'rgba(255,255,255,0.2)'; };
      /* 【2026-10-03 作者实测】牌组列表也能点开看这张卡（原来只有名字/费用/效果前 50 字，点不开） */
      div.onclick = (function(c){ return function() { __openGraveCardDetail(c); }; })(card);
      var __dbadge = (typeof __zoneOrderBadge === 'function') ? __zoneOrderBadge('deck', i, deckArr.length) : '';
      div.innerHTML = (__dbadge ? '<div style="' + ((typeof __ZONE_BADGE_CSS === 'string') ? __ZONE_BADGE_CSS : '') + '">' + __dbadge + '</div>' : '') +
        '<img src="' + (card.image_url || '') + '" style="width:100%;border-radius:4px;display:block;margin-bottom:4px;" onerror="this.style.display=&quot;none&quot;">' +
        '<div style="font-size:12px;font-weight:bold;color:#fff;margin-bottom:4px;">' + (card.name || '未知') + '</div>' +
        '<div style="font-size:10px;color:rgba(255,255,255,0.6);">费用:' + (card.cost || 0) + '</div>' +
        '<div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:4px;line-height:1.3;">' + (card.effect || '').substring(0, 50) + '...</div>';
      div.title = (__dbadge ? __dbadge + '\n' : '') + card.name + '\n费用:' + (card.cost || 0) + '\n' + (card.effect || '') + '\n（点击查看完整效果）';
      content.appendChild(div);
    }
  }
  
  modal.classList.add('active');
}

function showGraveList(zone) {
  if (!battleState) return;
  if (zone) __graveZoneTab = zone;
  var zcur = __graveZoneTab;
  var modal = document.getElementById('cardListModal');
  var title = document.getElementById('cardListTitle');
  var content = document.getElementById('cardListContent');
  var p = battleState.p1;
  var removed = (p.removed || []).concat(p.removedFromGame || []);
  var list = zcur === 'removed' ? removed : p.grave;
  /* 【2026-10-17 作者定稿】说明放在标题行旁边（与牌组列表同一形态 ✓），不另起一行 */
  title.innerHTML = (zcur === 'removed' ? '移出游戏区' : '墓地') + '（' + list.length + '张）' + __zoneOrderHintSpan(zcur);
  content.innerHTML = '';
  // 区切换 Tab
  var tabBar = document.createElement('div');
  tabBar.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;position:sticky;top:0;background:#1a1a2e;padding:6px 0;z-index:2;';
  [['grave','墓地('+p.grave.length+')'],['removed','移出区('+removed.length+')']].forEach(function(t){
    var b=document.createElement('button');
    b.textContent=t[1];
    b.className='modal-btn';
    b.style.cssText='flex:1;padding:8px;'+(zcur===t[0]?'background:#feca57;color:#2d3436;font-weight:bold;':'background:rgba(255,255,255,0.1);color:#fff;');
    b.onclick=function(){showGraveList(t[0]);};
    tabBar.appendChild(b);
  });
  content.appendChild(tabBar);
  if (!list.length) {
    var empty=document.createElement('div');empty.style.cssText='color:rgba(255,255,255,0.5);padding:20px;text-align:center;';
    empty.textContent=(zcur==='removed'?'移出游戏区为空':'墓地为空');content.appendChild(empty);
  } else {
    var grid=document.createElement('div');grid.style.cssText='display:flex;flex-wrap:wrap;gap:10px;';
    for (var i = 0; i < list.length; i++) {
      (function(card, idx){
        var realArr = zcur==='removed' ? removed : p.grave;
        var def = __graveSPDef(card), canSP = def && zcur==='grave' && __graveSPAllowed() && def.ok(p);
        var div=document.createElement('div');
        div.className='card-list-item';
        div.setAttribute('data-list-card', card.name || '');   /* 【2026-10-03】标记"这是卡片项"，与标签按钮区分 */
        div.style.cssText='width:130px;padding:8px;background:rgba(0,0,0,0.3);border:2px solid '+(def?'#feca57':'rgba(255,255,255,0.2)')+';border-radius:6px;';
        var __spTxt = '';
        if (def) { __spTxt = canSP ? ('⚡ '+def.label) : (zcur!=='grave' ? '◇ 已移出游戏，无法再发动' : ('SP：'+def.label+'（需自己主要阶段'+(def.ok(p)?'':'，'+def.reason)+'）')); }
        var spBtn = def ? ('<button data-sp="1" style="width:100%;margin-top:6px;padding:5px;font-size:11px;border:none;border-radius:4px;cursor:'+(canSP?'pointer':'not-allowed')+';'+(canSP?'background:#feca57;color:#2d3436;font-weight:bold;':'background:#555;color:#aaa;')+'">'+__spTxt+'</button>') : '';
        /* 【2026-10-03 作者实测】墓地和移出区的卡原来点不开、也看不到卡图 ⇒ 显示卡图 + 点击看详情 */
        div.style.cursor='pointer';
        div.onclick=function(ev){ try { ev.stopPropagation(); } catch (e) { try { console.error('[catch] assets/ui.js:1333', e); } catch (e2) {} } __openGraveCardDetail(card); };
        /* 【2026-10-09 作者目标第4项】墓地/移出区的卡：**悬停即浮出放大的原图**（闭包里有 card ⇒ 直接取名字） */
        div.onmouseenter = function() { try { __cardPeekShow(this, encodeURIComponent(card.name || '')); } catch (e) { try { console.error('[catch] assets/ui.js:1335', e); } catch (e2) {} } };
        div.onmouseleave = function() { try { __cardPeekHide(); } catch (e) { try { console.error('[catch] assets/ui.js:1336', e); } catch (e2) {} } };
        var __gbadge = (typeof __zoneOrderBadge === 'function') ? __zoneOrderBadge(zcur, idx, list.length) : '';
        div.innerHTML=(__gbadge?'<div style="'+((typeof __ZONE_BADGE_CSS === 'string')?__ZONE_BADGE_CSS:'')+'">'+__gbadge+'</div>':'')+
          '<img src="'+(card.image_url||'')+'" style="width:100%;border-radius:4px;display:block;margin-bottom:4px;" onerror="this.style.display=&quot;none&quot;">'+
          '<div style="font-size:12px;font-weight:bold;color:#fff;margin-bottom:4px;">'+(card.name||'未知')+'</div>'+
          '<div style="font-size:10px;color:rgba(255,255,255,0.6);">费用:'+(card.cost||0)+'</div>'+
          '<div style="font-size:10px;color:rgba(255,255,255,0.5);margin-top:4px;line-height:1.3;">'+(card.effect||'').substring(0,50)+'...</div>'+spBtn;
        div.title=(__gbadge?__gbadge+'\n':'')+card.name+'\n费用:'+(card.cost||0)+'\n'+(card.effect||'');
        if (canSP) { var btn=div.querySelector('[data-sp]'); btn.onclick=function(ev){
          ev.stopPropagation();
          /* 【2026-10-12 作者报："墓地移出还是会留在墓地而不是手牌区"，且是**所有**墓地移出卡的通病 ✓】
             根因（读码确认 ✓）：这个 ⚡ 的处理**只发动 SP、从不关闭列表弹窗** ✗；
             列表的显示 = 上面那句 `modal.classList.add('active')`（同一个 `#cardListModal` ✓）。
             旧代码只在【小恶魔的投喂】那一张卡的结算末尾去关 ✗ ⇒ 覆盖面根本不对 ✓
             ⇒ 在**唯一入口**收口：按下 ⚡ 就关闭列表 ✓（所有墓地/移出区发动的卡一次性都对 ✓），
               后续的检索/选择弹窗才不会被它盖住 ✓，视角也回到手牌区 ✓
             ⚠ 只remove('active') 并把内联 display 复位成 '' ✓ —— 绝不写死 display:none ✗（那会让该弹窗此后**再也弹不出来** ✗） */
          try {
            var __mm = document.getElementById('cardListModal');
            if (__mm) { try { __mm.classList.remove('active'); } catch (e1) {} __mm.style.display = ''; }
          } catch (e2) {}
          activateGraveSP(zcur, idx);
        }; }
        grid.appendChild(div);
      })(list[i],i);
    }
    content.appendChild(grid);
  }
  modal.classList.add('active');
}

function showOppZone(zone) {
  if (!battleState || !battleState.p2) return;
  if (zone !== 'grave' && zone !== 'removed') return;
  var title = '对手' + (zone === 'grave' ? '墓地' : '移出游戏区');
  if (typeof showTargetCards === 'function') showTargetCards('p2', zone, title, false, null);
}
/* 【2026-10-11 作者要求】公共墓地入口：事件卡 + 乐谱卡（打出后放这里，原来玩家完全看不到 ✗）
   —— 纯查看（selectable=false ⇒ 本机直接渲染 ✓ 不发问 ✓），复用现成的只读列表弹窗与悬停浮层 ✓ */
function showPublicGraveList() {
  if (typeof showTargetCards === 'function') showTargetCards('p1', 'public_grave', '公共墓地（事件卡 / 乐谱卡）', false, null);
}

function showTargetCards(player, zone, title, selectable, callback, decider) {
  // C 阶段·第 2 步收尾：同样走决策出口（选卡决策；纯查看时 selectable=false，实现里只画不选）
  /* 【2026-10-07 修·联机客人"要选的卡点了没反应、弹窗不出现"】
     原来这里是 `ENV.ask('p1', …)` —— 座位**硬编码 p1**：在房主那一端 p1 = 房主自己
     ⇒ 房主**问自己**，客人那边什么也收不到（作者实测症状）。
     现在把两件事分开、写清楚：
       · `player`  = **从谁的区域里选**（读哪一份数据）；
       · `decider` = **谁来决定**（询问发给谁；缺省 = player）。
     联机时 ENV.ask 会把"非本机座位"转发给对端 ⇒ 客人自己那边画弹窗、自己作答。
     调用点要传 decider（出手的人）：例如【善意面具】是"从自己手牌选"⇒ decider=出手者；
     【妖刀五月雨】是"破坏对方场上1张"⇒ 区域是对方的、但决策人仍是出手者。 */
  var __askSeat = decider || player;
  /* 【2026-10-08 修·**查看对手墓地/移出区**（作者实测：单机点了没反应；联机弹在对方屏幕上）】
     纯查看（selectable === false）不是"要谁做决定"，**绝不能发问**：
     原来它照样走 ENV.ask(座位)，座位不是本机时就被当成决策发给对端 ⇒ 界面弹在对手那边，本机什么都没有。
     这里在唯一入口收口：纯查看 ⇒ 本机直接渲染（墓地/移出区是公开信息，本机已有同步数据）。 __GRAVE_VIEW_LOCAL__ */
  if (selectable === false && typeof __askTargetCardsLocal === 'function') {
    try { return __askTargetCardsLocal(player, zone, title, false, callback); } catch (e) { console.error('本地渲染查看列表失败，回退到原路径', e); }
  }
  /* 【2026-10-07 目标①·**询问带上候选**（含 indices 映射）】
     原来只发 `player/zone`，客人必须靠自己本地同步状态去"就地取材"才画得出来 ——
     一旦两端状态有偏差（或客人那份区域为空），就会画不出来。
     现在把**候选名单随问题一起发**：客人侧走通用的 `cards` 渲染分支，`indices` 保证回传的
     下标是**出题方视角**（锁步同序，但显式映射更稳）。 */
  var __cands = [];
  try {
    var __arr = (typeof battleState !== 'undefined' && battleState && battleState[player] && battleState[player][zone]) || [];
    __cands = __arr.map(function (c) { return (c && c.name) || '（未知卡）'; });
  } catch (e) { __cands = []; }
  return ENV.ask(__askSeat, {
    kind: 'targetCards', player: player, zone: zone, label: title, selectable: selectable,
    cards: __cands, indices: __cands.map(function (_, i) { return i; })
  }, callback);
}

function showAttackCardSelect(attackCards, callback) {
  return DecisionHub.submit('targetPlayer', {attackCards:attackCards}, callback);
}
function __showAttackCardSelectNow(attackCards, callback, req) {
  _targetSelectOpen = true;
  var modal = document.getElementById('targetSelectModal');
  document.getElementById('targetSelectTitle').textContent = '善意面具效果 - 选择要打出的攻击卡';
  document.getElementById('targetSelectCardName').textContent = '不耗音韵且无视距离打出，最终伤害+1';
  document.getElementById('targetSelectDesc').textContent = '选择一张攻击卡立即打出，或点击取消不打出';
  
  var optionsDiv = document.getElementById('targetSelectOptions');
  optionsDiv.innerHTML = '';
  
  effectEngine.pendingTargetCallback = callback;
  
  for (var i = 0; i < attackCards.length; i++) {
    (function(card) {
      var option = document.createElement('div');
      option.className = 'target-option';
      option.innerHTML = '<div class="target-name">' + card.name + '</div>' +
        '<div class="target-info">费用: ' + (card.cost || 0) + ' | 基础伤害: ' + (card.baseDamage || 2) + ' | 效果: ' + (card.effect || '').substring(0, 50) + '</div>';
      option.onclick = function() {
        if (DecisionHub.active !== req) return;
        __tsFinish(card);
      };
      optionsDiv.appendChild(option);
    })(attackCards[i]);
  }
  
  // 修改取消按钮为"不打出"
  var cancelBtn = modal.querySelector('.modal-btn-cancel');
  if (cancelBtn) {
    cancelBtn.textContent = '不打出';
    cancelBtn.onclick = function() {
      __tsFinish(null);
      // 恢复按钮文本
      setTimeout(function() {
        if (cancelBtn) cancelBtn.textContent = '取消';
      }, 100);
    };
  }
  
  modal.classList.add('active');
}

/* ==== 导出垫片（不改函数名，仅供跨文件可见）==== */
try { window.showScreen = showScreen; } catch (e) {}
try { window.showToast = showToast; } catch (e) {}
try { window.showBattleResult = showBattleResult; } catch (e) {}
try { window.flashStat = flashStat; } catch (e) {}
try { window.renderFilters = renderFilters; } catch (e) {}
try { window.renderCardGrid = renderCardGrid; } catch (e) {}
try { window.showViewerCardDetail = showViewerCardDetail; } catch (e) {}
try { window.renderDeckBuilder = renderDeckBuilder; } catch (e) {}
try { window.renderAttrBar = renderAttrBar; } catch (e) {}
try { window.renderDeckSide = renderDeckSide; } catch (e) {}
try { window.deckClear = deckClear; } catch (e) {}
try { window.showPickerTip = showPickerTip; } catch (e) {}
try { window.renderRogueDeck = renderRogueDeck; } catch (e) {}
try { window.renderRoguelikeMap = renderRoguelikeMap; } catch (e) {}
try { window.showRoguelikeReward = showRoguelikeReward; } catch (e) {}
try { window.__renderDeckPile = __renderDeckPile; } catch (e) {}
try { window.showChainChoice = showChainChoice; } catch (e) {}
try { window.showBlockedReason = showBlockedReason; } catch (e) {}
try { window.showCardDetail = showCardDetail; } catch (e) {}
try { window.showCardModal = showCardModal; } catch (e) {}
try { window.showChoiceModal = showChoiceModal; } catch (e) {}
try { window.renderBuffBar = renderBuffBar; } catch (e) {}
try { window.__updateBattleUI_impl = __updateBattleUI_impl; } catch (e) {}
try { window.renderZoneSlots = renderZoneSlots; } catch (e) {}
try { window.showTilePicker = showTilePicker; } catch (e) {}
try { window.renderBattleMap = renderBattleMap; } catch (e) {}
try { window.renderMinimap = renderMinimap; } catch (e) {}
try { window.__renderBattleLogFromState = __renderBattleLogFromState; } catch (e) {}
try { window.showCardPickerMulti = showCardPickerMulti; } catch (e) {}
try { window.showTargetSelect = showTargetSelect; } catch (e) {}
try { window.showTimingQuestion = showTimingQuestion; } catch (e) {}
try { window.showEffectLog = showEffectLog; } catch (e) {}
try { window.renderChainBar = renderChainBar; } catch (e) {}
try { window.showDeckList = showDeckList; } catch (e) {}
try { window.showGraveList = showGraveList; } catch (e) {}
try { window.showOppZone = showOppZone; } catch (e) {}
try { window.showTargetCards = showTargetCards; } catch (e) {}
try { window.showAttackCardSelect = showAttackCardSelect; } catch (e) {}

/* 【2026-10-09 作者要求·盖卡可查询（悬停版）】
   鼠标**悬停**在自己的盖伏卡上 ⇒ 显示卡面浮层；移开即隐藏。
   数据取自 battleState.p1.faceDownCards[index]（与点击发动 uiActivateFaceDown(index) 同一索引口径）。
   只对**自己的**盖卡挂 onmouseenter/onmouseleave（见盖卡渲染处）⇒ 对手的盖卡不泄露。 */
/* 【2026-10-15 作者报「悬停查看的卡牌底部会被挡住 / 图片要等一下才刷新」⇒ 结构修 ✓】
   根因（实测复现 port-old/probe-peek-geom.cjs）：
     · 定位那一刻图片常**还没加载完** ⇒ `box.offsetHeight` 只量到兜底值 300，
       而卡图实际渲染高约 529（1326×1948 比例）⇒ top 算小约 229px ⇒ 图加载完把浮层撑高、**底部溢出屏幕** ✗
     · 换卡时 `img.src=新地址`，新图下载+解码完之前**旧图仍显示** ⇒ 像「要等一下」✗
   修法：① 图片加 max-height（按视口算）⇒ 高度上限可预期
         ② 定位改为按「图片实际高 + 卡名行高」并把浮层夹进视口
         ③ 换图走 `__peekSetImg`（先解码、再上屏）
   ⚠ 两个预览实现（本函数用于**场上盖伏卡**；`__cardPeekShow` 用于**手牌/选卡弹窗/编组/墓地**）
     共用同一个浮层元素 ⇒ **两处都改**，否则谁先跑谁创建浮层、行为不一致 ✗ */
function __peekSetImg(img, url) {
  try {
    if (!img) return;
    if (!url) { try { img.removeAttribute('src'); } catch (e) {} img.style.display = 'none'; return; }
    img.style.display = 'block';
    if (img.getAttribute('src') === url) return;      /* 同一张：不动，避免闪一下 ✓ */
    var __box = document.getElementById('__fdPeekBox');
    function __place() {
      try {
        if (!__box) return;
        var __nm = document.getElementById('__fdPeekName');
        var __h = (img.naturalWidth > 0 ? Math.round(360 * (img.naturalHeight / img.naturalWidth)) : 0)
          + (__nm ? (__nm.getBoundingClientRect().height || 0) : 0) + 10;
        if (__h <= 0) return;
        var __t = parseFloat(__box.style.top) || 0;
        if (__t + __h > window.innerHeight - 8) __box.style.top = Math.max(8, window.innerHeight - __h - 8) + 'px';
      } catch (e) {}
    }
    var pre = new Image();
    try { pre.decoding = 'async'; } catch (e) {}
    pre.onload = function () { try { img.src = url; } catch (e) {} __place(); };
    pre.onerror = function () { try { img.src = url; } catch (e) {} };
    pre.src = url;
    if (pre.complete && pre.naturalWidth > 0) { try { img.src = url; } catch (e) {} __place(); }
  } catch (e) { try { if (img) img.src = url; } catch (e2) {} }
}
/* 【2026-10-15 作者报「手牌卡图会消失然后很快刷新出来（每次结算/出牌后都会）」⇒ 结构修 ✓】
   用途：**手牌构成没变**时，只更新"灰化 / 可点性 / 提示"这些**状态类**信息，
         **完全不重建 DOM** ⇒ `<img>` 元素自始至终存活 ⇒ 卡图不会再闪 ✓
   为什么不能靠整段重建：重建会销毁并新建 <img>，新元素要重新准备解码位图
     （每张卡图解码后约 2.5MB，浏览器解码缓存有限）⇒ 少数几张空白一瞬 ✗
   行为等价性：灰化/可点性/提示本来就只由状态决定，原地更新与重建结果一致 ✓
   ⚠ 只用 `.hand-card` 定位（不碰卡图等其它元素）✓ */
/* 手牌左上角费用：显示"当前实际需要的音韵"（不含一次性 _nextCostReduction，避免每张都显示-1） */
function __handCostLabel(card, user) {
  try {
    if (!card || card.cost === undefined || card.cost === null) return '';
    if (typeof card.cost === 'string' && /^\s*\d+\s*[-–~至到]\s*\d+\s*$/.test(card.cost)) return card.cost;
    var ec = (typeof computeRequiredCost === 'function') ? computeRequiredCost(card, user || 'p1') : card.cost;
    return (ec === undefined || ec === null) ? card.cost : ec;
  } catch (e) { return card && card.cost !== undefined ? card.cost : ''; }
}
function __softUpdateHand(hand, isActionPhase, isPlayerTurn) {
  try {
    if (!hand || !battleState || !battleState.p1) return;
    var nodes = Array.prototype.slice.call(hand.querySelectorAll('.hand-card'));
    var handCards = (battleState.p1.hand || []);
    var evCards = (battleState.p1.eventCards || []);
    if (nodes.length !== (handCards.length + evCards.length)) return;   /* 对不上 ⇒ 交给整段重建兜底 ✓ */
    var idx = 0, i;
    for (i = 0; i < handCards.length; i++) {
      var el = nodes[idx++], card = handCards[i];
      var pv = null; try { pv = evaluatePlayable(card, 'p1'); } catch (e) { pv = { ok: false, reason: '' }; }
      var canClick = !!(pv && pv.ok);
      try {
        el.className = 'hand-card' + (canClick ? ' playable' : '');
        el.style.cssText = canClick ? '' : 'opacity:0.4;cursor:not-allowed;filter:grayscale(0.55);';
        el.setAttribute('onclick', canClick ? ('useCard(' + i + ')') : 'showBlockedReason(this)');
        el.setAttribute('data-block-reason', canClick ? '' : String((pv && pv.reason) || '未知原因'));
        el.setAttribute('title', '左键使用，右键查看效果：' + (card.name || '') + (canClick ? '' : ('（不可用：' + ((pv && pv.reason) || '') + '）')));
        try { var __cb = el.querySelector('.hand-card-cost'); if (__cb && card.cost !== undefined) __cb.textContent = String(__handCostLabel(card)); } catch (e) {}
      } catch (e) {}
    }
    for (i = 0; i < evCards.length; i++) {
      var el2 = nodes[idx++], c2 = evCards[i];
      if (!el2) continue;
      var isMusic = !!(c2._isMusic || c2._category === 'music_cards');
      var evCanClick = isMusic ? (isActionPhase && isPlayerTurn) : ((isActionPhase && isPlayerTurn) || !isPlayerTurn);
      try {
        el2.style.cssText = evCanClick ? '' : 'opacity:0.4;cursor:not-allowed;';
        el2.setAttribute('onclick', evCanClick ? (isMusic ? ('useMusicCard(' + i + ')') : ('useEventCard(' + i + ')')) : '');
      } catch (e) {}
    }
  } catch (e) {}
}
function __fdPeekShow(el, index) {
  try {
    var p = battleState && battleState.p1;
    var card = p && (p.faceDownCards || [])[index];
    if (!card) return;
    var box = document.getElementById('__fdPeekBox');
    if (!box) {
      box = document.createElement('div');
      box.id = '__fdPeekBox';
      box.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;display:none;' +
        'border:2px solid #feca57;border-radius:8px;overflow:hidden;' +
        'box-shadow:0 6px 24px rgba(0,0,0,.6);background:#111;';
      box.innerHTML = '<img id="__fdPeekImg" style="display:block;width:360px;height:auto;max-height:min(60vh,calc(100vh - 90px));object-fit:contain;">' +
        '<div id="__fdPeekName" style="color:#feca57;font-size:13px;text-align:center;padding:5px 6px;"></div>';
      document.body.appendChild(box);
    }
    var img = document.getElementById('__fdPeekImg');
    var nm = document.getElementById('__fdPeekName');
    __peekSetImg(img, card.image_url || '');   /* 【2026-10-15】先解码再上屏，避免"旧图停一下" ✓ */
    if (nm) nm.textContent = String(card.name || '') + (card.cost !== undefined && card.cost !== null ? '（' + card.cost + '费）' : '');
    box.style.display = 'block';
    var r = el.getBoundingClientRect();
    /* 【2026-10-15 结构修】高度**不再依赖 box.offsetHeight**（图片没加载完时它是兜底值 300 ⇒ 算小 ⇒ 底部溢出）✗
       改为：图片实际渲染高（或按 360 宽 × 图比例推算）+ 卡名行高；再把浮层高度**夹进视口**（双保险）✓ */
    var bw = box.offsetWidth || 214;
    var __nmRow = 0; try { __nmRow = nm ? (nm.getBoundingClientRect().height || 0) : 0; } catch (e) { __nmRow = 0; }
    var __imgH = 0;
    try {
      if (img) {
        __imgH = Math.round(img.getBoundingClientRect().height || 0);
        if (!__imgH && img.naturalWidth > 0) __imgH = Math.round(360 * (img.naturalHeight / img.naturalWidth));
      }
    } catch (e) { __imgH = 0; }
    var bh = (__imgH + __nmRow + 10) || (box.offsetHeight || 300);
    if (bh > window.innerHeight - 16) bh = window.innerHeight - 16;   /* 夹进视口 ✓ */
    var left = r.left - bw - 10;
    if (left < 8) left = Math.min(r.right + 10, Math.max(8, window.innerWidth - bw - 8));
    var top = r.top;
    if (top + bh > window.innerHeight - 8) top = Math.max(8, window.innerHeight - bh - 8);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  } catch (e) { /* 预览失败不影响任何流程 */ }
}
function __fdPeekHide() {
  try { var b = document.getElementById('__fdPeekBox'); if (b) b.style.display = 'none'; } catch (e) { try { console.error('[catch] assets/ui.js:1520', e); } catch (e2) {} }
}
try { window.__fdPeekShow = __fdPeekShow; } catch (e) {}
try { window.__fdPeekHide = __fdPeekHide; } catch (e) {}
/* 【2026-10-09 作者要求】**通用**卡面悬停浮层：鼠标放到卡上即显示其原图（编组/背包等界面用）。
   卡名经 encodeURIComponent 传入并在此解码（卡名可能含引号，直接内联会截断）。 */
function __cardPeekShow(el, nameEnc) {
  try {
    var name = '';
    try { name = decodeURIComponent(String(nameEnc || '')); } catch (e) { name = String(nameEnc || ''); }
    var list = (typeof allCards !== 'undefined' && allCards) ? allCards : [];
    var card = null;
    for (var i = 0; i < list.length; i++) { if (list[i] && list[i].name === name) { card = list[i]; break; } }
    /* 【2026-10-11 同类 bug 一并修】查不到卡（联机里客人侧持有的是**遮蔽占位**：对手手牌 `{name:'？？？',__unknown:true}`）
       时原来直接 `return` ⇒ 浮层里**留着上一张的图** ✗：既显示错卡、又等于**偷看对手手牌**。
       浮层内容必须永远对应"当前悬停的这一张" ⇒ 查不到就**清掉并隐藏**（图 + 文字一起清，不留残影、不泄露）。 */
    if (!card) {
      try {
        var __box0 = document.getElementById('__fdPeekBox');
        var __img0 = document.getElementById('__fdPeekImg');
        var __nm0 = document.getElementById('__fdPeekName');
        if (__img0) { try { __img0.removeAttribute('src'); } catch (e) { try { console.error('[catch] assets/ui.js:1541', e); } catch (e2) {} } __img0.style.display = 'none'; }
        if (__nm0) __nm0.textContent = '';
        if (__box0) __box0.style.display = 'none';
      } catch (e) { try { console.error('[catch] assets/ui.js:1544', e); } catch (e2) {} }
      return;
    }
    var box = document.getElementById('__fdPeekBox');
    if (!box) {
      box = document.createElement('div');
      box.id = '__fdPeekBox';
      box.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;display:none;' +
        'border:2px solid #feca57;border-radius:8px;overflow:hidden;' +
        'box-shadow:0 6px 24px rgba(0,0,0,.6);background:#111;';
      box.innerHTML = '<img id="__fdPeekImg" style="display:block;width:360px;height:auto;max-height:min(60vh,calc(100vh - 90px));object-fit:contain;">' +
        '<div id="__fdPeekName" style="color:#feca57;font-size:13px;text-align:center;padding:5px 6px;"></div>';
      document.body.appendChild(box);
    }
    var img = document.getElementById('__fdPeekImg');
    var nm = document.getElementById('__fdPeekName');
    __peekSetImg(img, card.image_url || '');   /* 【2026-10-15】先解码再上屏，避免"旧图停一下" ✓ */
    if (nm) nm.textContent = String(card.name || '') + (card.cost !== undefined && card.cost !== null && card.cost !== '' ? '（' + card.cost + '费）' : '');
    box.style.display = 'block';
    var r = el.getBoundingClientRect();
    /* 【2026-10-15 结构修】高度**不再依赖 box.offsetHeight**（图片没加载完时它是兜底值 300 ⇒ 算小 ⇒ 底部溢出）✗
       改为：图片实际渲染高（或按 360 宽 × 图比例推算）+ 卡名行高；再把浮层高度**夹进视口**（双保险）✓ */
    var bw = box.offsetWidth || 214;
    var __nmRow = 0; try { __nmRow = nm ? (nm.getBoundingClientRect().height || 0) : 0; } catch (e) { __nmRow = 0; }
    var __imgH = 0;
    try {
      if (img) {
        __imgH = Math.round(img.getBoundingClientRect().height || 0);
        if (!__imgH && img.naturalWidth > 0) __imgH = Math.round(360 * (img.naturalHeight / img.naturalWidth));
      }
    } catch (e) { __imgH = 0; }
    var bh = (__imgH + __nmRow + 10) || (box.offsetHeight || 300);
    if (bh > window.innerHeight - 16) bh = window.innerHeight - 16;   /* 夹进视口 ✓ */
    var left = r.left - bw - 10;
    if (left < 8) left = Math.min(r.right + 10, Math.max(8, window.innerWidth - bw - 8));
    var top = r.top;
    if (top + bh > window.innerHeight - 8) top = Math.max(8, window.innerHeight - bh - 8);
    box.style.left = left + 'px';
    box.style.top = top + 'px';
  } catch (e) { try { console.error('[catch] assets/ui.js:1571', e); } catch (e2) {} }
}
function __cardPeekHide() { try { var b = document.getElementById('__fdPeekBox'); if (b) b.style.display = 'none'; } catch (e) { try { console.error('[catch] assets/ui.js:1573', e); } catch (e2) {} } }
try { window.__cardPeekShow = __cardPeekShow; } catch (e) {}
try { window.__cardPeekHide = __cardPeekHide; } catch (e) {}

/* 【2026-10-09 作者目标第5项·触屏】长按 = 查看放大原图。
   全局委托：任何"带 onmouseenter 里含 __cardPeekShow 的元素"被长按 450ms ⇒ 执行那段处理器（显示浮层）；
   抬手/滑动即隐藏。这样**已加悬停的所有位置自动支持触屏** ✓，无需逐处再改 ✗。 */
(function () {
  if (typeof window === 'undefined' || window.__touchLongPressInstalled) return;
  window.__touchLongPressInstalled = true;
  var timer = null, target = null;
  function clearTimer() { if (timer) { clearTimeout(timer); timer = null; } }
  function hide() { try { if (typeof __cardPeekHide === 'function') __cardPeekHide(); } catch (e) { try { console.error('[catch] assets/ui.js:1585', e); } catch (e2) {} } target = null; }
  function findHandlerAttr(el) {
    /* 往上找最近的、带 onmouseenter 且含 __cardPeekShow 的元素 */
    var n = 0;
    while (el && n < 6) {
      var attr = el.getAttribute && el.getAttribute('onmouseenter');
      if (attr && attr.indexOf('__cardPeekShow') >= 0) return attr;
      el = el.parentElement; n++;
    }
    return null;
  }
  document.addEventListener('touchstart', function (ev) {
    try {
      var el = ev.target;
      var attr = findHandlerAttr(el);
      if (!attr) return;
      target = el;
      clearTimer();
      timer = setTimeout(function () {
        try { new Function(attr).call(el); } catch (e) { try { console.error('[catch] assets/ui.js:1604', e); } catch (e2) {} }
      }, 450);
    } catch (e) { try { console.error('[catch] assets/ui.js:1606', e); } catch (e2) {} }
  }, { passive: true });
  ['touchend', 'touchmove', 'touchcancel'].forEach(function (k) {
    document.addEventListener(k, function () { clearTimer(); hide(); }, { passive: true });
  });
  /* 触屏上点一下（短按）也要把浮层收掉，避免残留 */
  document.addEventListener('click', function () { hide(); }, { passive: true });
})();

