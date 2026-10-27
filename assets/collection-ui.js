/* 收藏专用界面：显式挂载、独立详情，不调用或改写战斗 UI。 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RJCollectionUI = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var categories = { characters:'角色卡', attack_cards:'攻击卡', skill_cards:'技能卡', item_single:'单次道具', item_permanent:'永续道具', gift_cards:'馈赠卡', music_cards:'乐谱卡', event_cards:'事件卡', omikuji:'御神签' };
  function mount(options) {
    var host = options && options.container, collection = options && options.collection;
    if (!host || host.nodeType !== 1 || !collection) throw new Error('需要独立收藏容器和收藏业务层');
    if (host.closest('#battleScreen, #cardDetailModal, #cardListModal, #cardModal, #targetSelectModal')) throw new Error('收藏不能挂载在战斗或通用卡牌详情内');
    if (host.querySelector('.rjc-root')) throw new Error('容器已经挂载收藏界面');
    var doc = host.ownerDocument, win = doc.defaultView, view = 'warehouse', category = '', rarity = '', owned = 'yes', busy = false, closed = false, previousFocus = null;
    function el(tag, cls, text) { var node = doc.createElement(tag); if (cls) node.className = cls; if (text !== undefined) node.textContent = text; return node; }
    function button(text, callback, cls) { var b = el('button', cls, text); b.type = 'button'; b.addEventListener('click', callback); return b; }
    var root = el('section', 'rjc-root'); root.setAttribute('aria-label', '收藏'); root.hidden = true; host.appendChild(root);
    var header = el('header', 'rjc-header'), title = el('h2', '', '收藏仓库'), balance = el('p', 'rjc-balance');
    header.append(title, balance, button('关闭收藏', hide));
    var tabs = el('nav', 'rjc-tabs'); tabs.setAttribute('aria-label', '收藏页面');
    var tabButtons = {};
    [['warehouse','仓库'],['catalog','图鉴'],['public','公共卡'],['craft','合成']].forEach(function (item) {
      var b = button(item[1], function () { show(item[0]); }); b.dataset.view = item[0]; tabButtons[item[0]] = b; tabs.appendChild(b);
    });
    var note = el('p', 'rjc-note', '收藏仅用于收集，所有卡仍可编组。公共卡不计收藏数量。');
    var filters = el('div', 'rjc-filters');
    function select(label, values, onChange) { var wrap = el('label', 'rjc-filter', label), s = el('select'); s.setAttribute('aria-label', label); values.forEach(function (pair) { var o = el('option', '', pair[1]); o.value = pair[0]; s.appendChild(o); }); s.addEventListener('change', function () { onChange(s.value); refresh(); }); wrap.appendChild(s); filters.appendChild(wrap); return s; }
    var categorySelect = select('类别', [['','全部类别']], function (value) { category = value; });
    var raritySelect = select('稀有度', [['','全部稀有度'],['UR','UR'],['SR','SR'],['R','R'],['N','N']], function (value) { rarity = value; });
    var ownedSelect = select('收藏状态', [['','全部'],['yes','已收藏'],['no','未收藏']], function (value) { owned = value; });
    var status = el('p', 'rjc-status'); status.setAttribute('role','status'); status.setAttribute('aria-live','polite');
    var bulk = button('一键分解多余卡',confirmAll); bulk.dataset.action = 'disassemble-all';
    var grid = el('div', 'rjc-grid'); root.append(header, note, tabs, filters, bulk, status, grid);
    var backdrop = el('div', 'rjc-backdrop'); backdrop.hidden = true;
    var dialog = el('section', 'rjc-dialog'); dialog.setAttribute('role','dialog'); dialog.setAttribute('aria-modal','true'); dialog.tabIndex = -1; backdrop.appendChild(dialog); root.appendChild(backdrop);
    function battleActive() { var b = doc.getElementById('battleScreen'); return !!(b && b.classList.contains('active')); }
    function closeDialog() { if (busy) return; backdrop.hidden = true; dialog.replaceChildren(); if (previousFocus && previousFocus.isConnected) previousFocus.focus(); }
    function openDialog(name) { previousFocus = doc.activeElement; dialog.replaceChildren(el('h3','',name)); dialog.setAttribute('aria-label',name); backdrop.hidden = false; dialog.focus(); }
    backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeDialog(); });
    root.addEventListener('keydown', function (e) {
      if (backdrop.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeDialog(); }
      if (e.key === 'Tab') { var items = Array.from(dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled)')); if (!items.length) { e.preventDefault(); return; } var first = items[0], last = items[items.length-1]; if (e.shiftKey && (doc.activeElement === first || doc.activeElement === dialog)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && (doc.activeElement === last || doc.activeElement === dialog)) { e.preventDefault(); first.focus(); } }
    });
    function picture(card, parent) { var src = card.source.image_url || card.source.avatar_url; if (src) { var image = el('img'); image.src = src; image.alt = card.name; image.loading = 'lazy'; parent.appendChild(image); } }
    function metadata(card, parent) {
      var m = el('div', 'rjc-meta');
      if (card.collectible) { var badge = el('span', 'rjc-rarity', card.rarity); badge.dataset.rarity = card.rarity; m.appendChild(badge); }
      m.appendChild(el('span','',categories[card.category]));
      if (card.source.cost !== undefined && card.source.cost !== '') m.appendChild(el('span','rjc-cost','费用：' + card.source.cost));
      parent.appendChild(m);
    }
    function detail(id) {
      var card = collection.getCard(id); openDialog(card.name); picture(card, dialog); metadata(card, dialog);
      var s = card.source, parts = [];
      if (s.attribute) parts.push('属性：' + s.attribute);
      if (s.passive) parts.push('被动：' + s.passive);
      if (s.effect || s.text || s.desc) parts.push(s.effect || s.text || s.desc);
      if (s.sp) parts.push('SP：' + s.sp);
      dialog.append(el('p','rjc-effect',parts.join(String.fromCharCode(10,10))),button('关闭详情',closeDialog));
    }
    function confirm(action, id) {
      if (busy || battleActive()) return;
      var card = collection.getCard(id); openDialog((action === 'craft' ? '合成：' : '分解：') + card.name);
      var amount = 1, quantity, explanation = el('p'), error = el('p','rjc-dialog-error'); error.setAttribute('role','alert');
      function quote() { explanation.textContent = action === 'craft' ? '合成1张需要 ' + card.craftCost + ' 星尘，当前持有 ' + card.count + ' 张。' : '分解 ' + amount + ' 张可获得 ' + (amount * card.disassembleValue) + ' 星尘；至少保留1张。'; }
      dialog.appendChild(explanation);
      if (action === 'disassemble') { var label = el('label','','分解数量'); quantity = el('input','rjc-quantity'); quantity.type = 'number'; quantity.min = '1'; quantity.max = String(Math.max(0,card.count-1)); quantity.step = '1'; quantity.value = '1'; quantity.setAttribute('aria-label','分解数量'); quantity.addEventListener('input',function () { amount = Number(quantity.value); quote(); }); label.appendChild(quantity); dialog.appendChild(label); }
      quote(); var actions = el('div','rjc-actions'), cancel = button('取消',closeDialog), submit = button('确认' + (action === 'craft' ? '合成' : '分解'), async function () {
        if (busy || battleActive()) return;
        if (!Number.isSafeInteger(amount) || amount < 1 || (action === 'disassemble' && amount > card.count-1)) { error.textContent = '分解数量无效，必须至少保留1张。'; return; }
        busy = true; submit.disabled = true; cancel.disabled = true; if (quantity) quantity.disabled = true; error.textContent = '';
        try {
          var result = action === 'craft' ? await collection.craft(id) : await collection.disassemble(id,amount);
          busy = false; closeDialog(); refresh(); status.textContent = (action === 'craft' ? '合成成功：' : '分解成功：') + card.name + '，持有 ' + result.ownedCount + ' 张，星尘 ' + result.dustBalance + '。';
        } catch (e) { busy = false; error.textContent = e.message; submit.disabled = false; cancel.disabled = false; if (quantity) quantity.disabled = false; }
      },'rjc-primary');
      actions.append(cancel,submit); dialog.append(error,actions);
    }
    function confirmAll() {
      if (busy || battleActive()) return;
      var quote = collection.previewDisassembleAll(); if (!quote.disassembled) return;
      openDialog('一键分解多余卡');
      dialog.appendChild(el('p','','将分解 ' + quote.disassembled + ' 张，涉及 ' + quote.cards.length + ' 种卡，获得 ' + quote.dustAdded + ' 星尘。每种保留1张，公共卡不参与。'));
      var list = el('details'), rows = el('ul'); list.appendChild(el('summary','','查看全部卡种'));
      quote.cards.forEach(function (c) { rows.appendChild(el('li','',c.name + ' ×' + c.count + '，获得 ' + c.dust + ' 星尘')); }); list.appendChild(rows); dialog.appendChild(list);
      var error = el('p','rjc-dialog-error'); error.setAttribute('role','alert');
      var cancel = button('取消',closeDialog), submit = button('确认分解全部多余卡',async function () {
        if (busy || battleActive()) return;
        busy = true; submit.disabled = true; cancel.disabled = true; bulk.disabled = true; error.textContent = '';
        try {
          if (collection.previewDisassembleAll().revision !== quote.revision) throw new Error('预览后档案已变化，请取消并重新预览');
          var result = await collection.disassembleAll(quote.revision);
          busy = false; closeDialog(); refresh(); status.textContent = '已分解 ' + result.disassembled + ' 张，涉及 ' + result.cards.length + ' 种卡，获得 ' + result.dustAdded + ' 星尘。';
        } catch (e) { busy = false; error.textContent = e.message; submit.disabled = false; cancel.disabled = false; bulk.disabled = false; }
      },'rjc-primary');
      var actions = el('div','rjc-actions'); actions.append(cancel,submit); dialog.append(error,actions);
    }
    function refresh() {
      if (closed) throw new Error('收藏界面已经销毁');
      var isPublic = view === 'public', filter = {public:isPublic,category:category};
      if (!isPublic && rarity) filter.rarity = rarity;
      if (!isPublic && owned) filter.owned = owned === 'yes';
      var cards = collection.listAll(filter);
      bulk.hidden = view !== 'warehouse';
      if (bulk.hidden) bulk.removeAttribute('data-action'); else bulk.dataset.action = 'disassemble-all';
      bulk.disabled = busy || !collection.previewDisassembleAll().disassembled;
      balance.textContent = '星尘：' + collection.dustBalance();
      title.textContent = {warehouse:'收藏仓库',catalog:'收藏图鉴',public:'公共卡',craft:'指定卡合成'}[view];
      Object.keys(tabButtons).forEach(function (key) { tabButtons[key].setAttribute('aria-pressed',String(key === view)); });
      raritySelect.parentElement.hidden = isPublic; ownedSelect.parentElement.hidden = isPublic;
      status.textContent = '共 ' + cards.length + ' 张' + (isPublic ? '公共卡' : '卡牌'); grid.replaceChildren();
      cards.forEach(function (card) {
        var cell = el('article','rjc-card'); cell.dataset.cardId = card.id;
        var imageButton = button('',function () { detail(card.id); },'rjc-picture'); imageButton.setAttribute('aria-label','查看' + card.name); picture(card,imageButton); cell.appendChild(imageButton);
        cell.appendChild(el('h3','rjc-card-name',card.name)); metadata(card,cell);
        cell.appendChild(el('span','rjc-count',isPublic ? '公共卡' : (card.collected ? '已收藏 · 持有 ' + card.count + ' 张' : '未收藏 · 持有 0 张')));
        var actions = el('div','rjc-actions');
        actions.appendChild(button('查看详情',function () { detail(card.id); }));
        if (card.collectible && view === 'craft') { var craft = button('合成 · ' + card.craftCost + ' 星尘',function () { confirm('craft',card.id); }); craft.dataset.action = 'craft'; craft.disabled = collection.dustBalance() < card.craftCost; actions.appendChild(craft); }
        if (card.collectible && view === 'warehouse') { var disassemble = button('分解多余卡 · +' + card.disassembleValue + ' 星尘/张',function () { confirm('disassemble',card.id); }); disassemble.dataset.action = 'disassemble'; disassemble.disabled = card.count < 2; actions.appendChild(disassemble); }
        cell.appendChild(actions); grid.appendChild(cell);
      });
      if (!cards.length) grid.appendChild(el('p','rjc-note','暂无符合条件的卡牌。'));
    }
    function show(next) {
      if (closed) throw new Error('收藏界面已经销毁');
      if (battleActive()) throw new Error('战斗期间不能打开收藏');
      if (busy) return;
      next = next || view; if (!Object.prototype.hasOwnProperty.call(tabButtons,next)) throw new Error('未知收藏页面');
      closeDialog(); var wasPublic = view === 'public'; if (next !== view) { owned = next === 'warehouse' ? 'yes' : ''; ownedSelect.value = owned; } view = next;
      if (wasPublic !== (view === 'public')) category = '';
      categorySelect.replaceChildren(); [['','全部类别']].concat(Object.entries(categories).filter(function (pair) { return (view === 'public') === ['gift_cards','music_cards','event_cards','omikuji'].includes(pair[0]); })).forEach(function (pair) { var option = el('option','',pair[1]); option.value = pair[0]; categorySelect.appendChild(option); });
      categorySelect.value = category; ownedSelect.value = owned; root.hidden = false; refresh();
    }
    function hide() { root.hidden = true; backdrop.hidden = true; if (!busy) dialog.replaceChildren(); if (options.onClose) options.onClose(); }
    var observer = new win.MutationObserver(function () { if (battleActive() && !root.hidden) hide(); });
    observer.observe(doc.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
    function storageChanged(event) { if (!root.hidden && !busy && (!event.key || event.key === 'rujuzhe_profile')) { try { refresh(); } catch (e) { status.textContent = e.message; } } }
    win.addEventListener('storage',storageChanged);
    return Object.freeze({ element:root, show:show, hide:hide, refresh:refresh,
      destroy:function () { if (busy) throw new Error('保存完成后才能销毁收藏界面'); observer.disconnect(); win.removeEventListener('storage',storageChanged); root.remove(); closed = true; }
    });
  }
  return Object.freeze({ mount:mount });
});
