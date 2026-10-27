/* 收藏业务层：只通过 P1 档案读写资产，不持有第二份存档，不改变编组资格。 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RJCollection = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function fail(code, message) { var e = new Error(message); e.code = code; throw e; }
  function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
  function create(options) {
    var profile = options && options.profile, cards = options && options.cards;
    if (!profile || typeof profile.collectionAction !== 'function' || !cards) fail('COLLECTION_SETUP', '需要 P1 档案与卡片数据');
    var catalog = profile.getCatalog(), rules = profile.getRules();
    var records = catalog.cards.map(function (entry) {
      var matches = (cards[entry.category] || []).filter(function (c) { return c.name === entry.name; });
      if (matches.length !== 1) fail('COLLECTION_BINDING', '卡名与类别未精确绑定：' + entry.category + '/' + entry.name);
      return freeze({ id: entry.id, category: entry.category, name: entry.name, rarity: entry.rarity, public: entry.public,
        collectible: entry.collectible, source: JSON.parse(JSON.stringify(matches[0])),
        craftCost: entry.collectible ? rules.dust[entry.rarity].craft : null,
        disassembleValue: entry.collectible ? rules.dust[entry.rarity].disassemble : null });
    });
    var byId = new Map(records.map(function (c) { return [c.id, c]; }));
    function known(id) { var c = byId.get(id); if (!c) fail('COLLECTION_CARD', '未知卡ID'); return c; }
    function view(c, p) { var count = p.owned[c.id] || 0; return freeze(Object.assign({}, c, { count: count, collected: count > 0 })); }
    function listAll(filter) {
      filter = filter || {}; var p = profile.getSnapshot();
      return freeze(records.filter(function (c) {
        var count = p.owned[c.id] || 0;
        return c.public === (filter.public === true) && (!filter.category || c.category === filter.category) &&
          (!filter.rarity || c.rarity === filter.rarity) && (filter.owned === undefined || (count > 0) === filter.owned);
      }).map(function (c) { return view(c, p); }));
    }
    function operate(action, id, count) {
      known(id);
      return profile.collectionAction(action, id, count).then(function (saved) {
        return freeze(Object.assign({ revision: saved.profile.revision }, saved.result));
      });
    }
    function previewDisassembleAll() {
      var p = profile.getSnapshot(), result = {revision:p.revision,disassembled:0,dustAdded:0,cards:[]};
      records.forEach(function (c) {
        var count = (p.owned[c.id] || 0) - rules.duplicates.keepAtLeast;
        if (!c.collectible || c.public || count <= 0) return;
        var dust = count * c.disassembleValue;
        result.cards.push({cardId:c.id,name:c.name,count:count,dust:dust}); result.disassembled += count; result.dustAdded += dust;
      });
      return freeze(result);
    }
    return Object.freeze({
      previewDisassembleAll: previewDisassembleAll,
      disassembleAll: function (revision) { return profile.disassembleAll(revision).then(function (saved) { return freeze(Object.assign({revision:saved.profile.revision},saved.result)); }); },
      ownedCount: function (id) { known(id); return profile.getCardCount(id); },
      listOwned: function (filter) { return listAll(Object.assign({}, filter, { public: false, owned: true })); },
      listAll: listAll,
      getCard: function (id) { return view(known(id), profile.getSnapshot()); },
      disassemble: function (id, count) { return operate('disassemble', id, count); },
      craft: function (id) { return operate('craft', id, 1); },
      dustBalance: function () { return profile.getSnapshot().dust; }
    });
  }
  return Object.freeze({ create: create });
});
