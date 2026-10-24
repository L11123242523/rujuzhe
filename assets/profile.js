/* 收藏档案底座：只在显式创建仓库后读写独立档案，不加载页面或战斗逻辑。
 * 回退互斥使用 IndexedDB 同一对象仓库的读写事务；临界区全为同步存储操作。
 * 依据：https://www.w3.org/TR/IndexedDB/#transaction-scheduling
 */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RJProfile = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var KEYS = Object.freeze({ main: 'rujuzhe_profile', backup: 'rujuzhe_profile_backup', corrupt: 'rujuzhe_profile_corrupt_' });
  var RARITIES = ['UR', 'SR', 'R', 'N'];
  function fail(code, text) { var e = new Error(text); e.code = code; throw e; }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function object(o) { return !!o && typeof o === 'object' && !Array.isArray(o) && (Object.getPrototypeOf(o) === Object.prototype || Object.getPrototypeOf(o) === null); }
  function need(ok, text) { if (!ok) fail('PROFILE_SCHEMA', text); }
  function integer(n) { return Number.isSafeInteger(n) && n >= 0; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function freeze(o) { if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); } return o; }
  function canonical(o) { if (Array.isArray(o)) return '[' + o.map(canonical).join(',') + ']'; if (object(o)) return '{' + Object.keys(o).sort().map(function (k) { return JSON.stringify(k) + ':' + canonical(o[k]); }).join(',') + '}'; return JSON.stringify(o); }
  function validId(s) { return typeof s === 'string' && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(s) && !['constructor', 'prototype', '__proto__'].includes(s); }
  function validateCatalog(catalog) {
    need(object(catalog) && catalog.version === 1 && Array.isArray(catalog.cards), '收藏目录格式不支持');
    var ids = new Set(), names = new Set(), counts = { UR: 0, SR: 0, R: 0, N: 0 }, publics = 0;
    catalog.cards.forEach(function (c) {
      need(object(c) && /^c\d{6}$/.test(c.id) && !ids.has(c.id), '稳定ID缺失或重复'); ids.add(c.id);
      need(typeof c.name === 'string' && c.name.length && typeof c.category === 'string' && !names.has(c.category + '\0' + c.name), '类别与卡名必须唯一'); names.add(c.category + '\0' + c.name);
      need(Array.isArray(c.aliases) && c.aliases.every(function (x) { return typeof x === 'string'; }), '别名格式错误');
      need(typeof c.public === 'boolean' && c.collectible === !c.public, '公共/收藏标记冲突');
      if (c.public) { need(c.rarity === null, '公共卡不能有稀有度'); publics++; }
      else { need(RARITIES.includes(c.rarity), '可抽卡稀有度缺失'); counts[c.rarity]++; }
    });
    need(catalog.cards.length === 165 && publics === 29 && Object.values(counts).reduce(function (a, b) { return a + b; }, 0) === 136, '首版目录必须为136张可抽卡和29张公共卡');
    need(canonical(counts) === canonical({ UR: 46, SR: 28, R: 37, N: 25 }), '首版稀有度数量不符');
    need(object(catalog.counts) && catalog.counts.collectible === 136 && catalog.counts.public === 29 && canonical(catalog.counts.rarities) === canonical(counts), '目录统计与记录不符');
    return true;
  }
  function validateRules(rules) {
    need(object(rules) && rules.version === 1 && rules.collectionOnly === true && object(rules.pools) && object(rules.pools.standard), '卡包配置格式不支持');
    var p = rules.pools.standard, e = rules.economy;
    need(p.version === 1 && p.cardsPerPack === 5 && p.ticketCost === 1 && p.ordinarySlots === 4, '首版卡包张数/费用不符');
    need(canonical(p.ordinaryWeights) === canonical({ UR: 5, SR: 15, R: 35, N: 45 }), '普通槽概率不符');
    need(p.guaranteedSlot.position === 5 && canonical(p.guaranteedSlot.weights) === canonical({ UR: 25, SR: 75, R: 0, N: 0 }), '保证槽概率不符');
    need(p.pity.rarity === 'UR' && p.pity.afterMisses === 9 && p.pity.replacementSlot === 5 && p.pity.resetOnAnyUR === true, '保底配置不符');
    need(p.selectionWithinRarity === 'uniform' && p.allowDuplicates === true, '卡池选择方式不符');
    need(object(e) && e.initialTickets === 5 && e.dailyTickets === 1 && e.participationTickets === 1 && e.participationDailyCap === 3 && e.firstWinTickets === 1 && e.dayTimeZone === 'Asia/Shanghai', '首版券配置不符');
    need(canonical(e.eligibleModes) === canonical(['pve', 'online']) && canonical(e.excludedModes) === canonical(['sandbox']), '领奖模式配置不符');
    need(canonical(rules.dust) === canonical({ N: { disassemble: 5, craft: 20 }, R: { disassemble: 20, craft: 80 }, SR: { disassemble: 100, craft: 400 }, UR: { disassemble: 400, craft: 1600 } }), '首版星尘配置不符');
    need(rules.duplicates.automaticDisassembly === false && rules.duplicates.keepAtLeast === 1, '重复卡配置不符'); return true;
  }
  async function createStore(options) {
    options = options || {};
    var env = typeof globalThis !== 'undefined' ? globalThis : {}, catalog = clone(options.catalog), rules = clone(options.rules);
    validateCatalog(catalog); validateRules(rules); freeze(catalog); freeze(rules);
    var storage = options.storage || env.localStorage, crypt = options.crypto || env.crypto, now = options.now || Date.now;
    var locks = own(options, 'locks') ? options.locks : (env.navigator && env.navigator.locks);
    var idb = own(options, 'indexedDB') ? options.indexedDB : env.indexedDB;
    var BC = own(options, 'BroadcastChannel') ? options.BroadcastChannel : env.BroadcastChannel;
    need(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function', '存储不可用');
    need(crypt && typeof crypt.randomUUID === 'function' && crypt.subtle, '安全标识与校验能力不可用');
    var byId = new Map(catalog.cards.map(function (c) { return [c.id, c]; })), db = null, channel = null, closed = false, observedRevision = 0;
    var previews = new Map(), lockName = KEYS.main + ':write', localQueue = Promise.resolve();
    function uuid() { return crypt.randomUUID(); }
    function timestamp() { var value = now(); need(integer(value), '时钟值无效'); return value; }
    function fresh() {
      var at = timestamp(); return { version: 1, profileId: uuid(), catalogVersion: catalog.version, revision: 0, owned: {}, tickets: rules.economy.initialTickets, dust: 0,
        pity: { standard: { packsWithoutUR: 0 } }, packsOpened: 0, createdAt: at, updatedAt: at, rewards: { days: {} }, pendingMatches: {}, matchReceipts: {}, pendingReveal: null, lastImportDigest: null };
    }
    function validate(p, accountCache) {
      if (object(p) && Number.isInteger(p.version) && p.version > 1) fail('PROFILE_FUTURE_VERSION', '档案来自更高版本，保留原文并停止写入');
      need(object(p) && p.version === 1, '档案版本不支持');
      var fields = ['version','profileId','catalogVersion','revision','owned','tickets','dust','pity','packsOpened','createdAt','updatedAt','rewards','pendingMatches','matchReceipts','pendingReveal','lastImportDigest'];
      need(Object.keys(p).length === fields.length && fields.every(function (k) { return own(p, k); }), '档案字段缺失或含未知字段');
      need(validId(p.profileId) && p.catalogVersion === catalog.version, '档案标识或目录版本不支持');
      ['revision','tickets','dust','packsOpened','createdAt','updatedAt'].forEach(function (k) { need(integer(p[k]), '档案整数无效：' + k); });
      need(object(p.owned), '收藏数量格式错误');
      Object.keys(p.owned).forEach(function (id) { var c = byId.get(id); need(c && c.collectible && integer(p.owned[id]), '未知卡ID、公共卡或数量无效：' + id); });
      need(object(p.pity) && Object.keys(p.pity).length === 1 && object(p.pity.standard) && Object.keys(p.pity.standard).length === 1 && integer(p.pity.standard.packsWithoutUR), '保底记录无效');
      need(object(p.rewards) && Object.keys(p.rewards).length === 1 && object(p.rewards.days), '奖励记录无效');
      Object.entries(p.rewards.days).forEach(function (pair) { var d = pair[1]; need(/^\d{4}-\d{2}-\d{2}$/.test(pair[0]) && object(d) && Object.keys(d).length === 3 && typeof d.dailyClaimed === 'boolean' && typeof d.firstWinClaimed === 'boolean' && integer(d.participationCount), '每日奖励记录无效'); });
      need(object(p.pendingMatches) && object(p.matchReceipts), '对局凭证格式错误');
      Object.entries(p.pendingMatches).forEach(function (pair) { var m = pair[1]; need(validId(pair[0]) && object(m) && Object.keys(m).length === 3 && m.matchId === pair[0] && ['pve','online','sandbox'].includes(m.mode) && integer(m.startedAt), '待结算对局无效'); need(!own(p.matchReceipts, pair[0]), '同一对局不能同时待结算和已领奖'); });
      Object.entries(p.matchReceipts).forEach(function (pair) { var m = pair[1]; need(validId(pair[0]) && object(m) && Object.keys(m).length === 6 && m.matchId === pair[0] && ['pve','online','sandbox'].includes(m.mode) && ['win','loss','abandoned'].includes(m.outcome) && integer(m.awardedTickets) && integer(m.settledAt) && /^\d{4}-\d{2}-\d{2}$/.test(m.day), '已结算对局凭证无效'); });
      if (p.pendingReveal !== null) {
        var reveal = p.pendingReveal, fields = ['version','resultId','packId','createdAt','cards','ticketsSpent','pityBefore','pityAfter'];
        need(object(reveal) && reveal.version === 1 && Object.keys(reveal).length === fields.length && fields.every(function(k){return own(reveal,k);}), '待展示结果字段或版本无效');
        var serverResult = accountCache && typeof reveal.resultId === 'string' && /^srvpack:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(reveal.resultId);
        need(reveal.packId === 'standard' && p.packsOpened > 0 && (reveal.resultId === 'pack:' + p.profileId + ':' + p.packsOpened || serverResult), '待展示resultId非法或与包序号重复冲突');
        need(integer(reveal.createdAt) && reveal.ticketsSpent === rules.pools.standard.ticketCost && integer(reveal.pityBefore) && integer(reveal.pityAfter), '待展示结果数值无效');
        need(Array.isArray(reveal.cards) && reveal.cards.length === rules.pools.standard.cardsPerPack, '待展示卡数无效');
        reveal.cards.forEach(function(card){var entry=card&&byId.get(card.cardId);need(object(card)&&Object.keys(card).length===3&&entry&&entry.collectible&&!entry.public&&card.rarity===entry.rarity&&typeof card.duplicate==='boolean','待展示卡ID、稀有度或重复标记无效');});
        var hasUR=reveal.cards.some(function(card){return card.rarity===rules.pools.standard.pity.rarity;});
        need(reveal.pityAfter === (hasUR ? 0 : reveal.pityBefore + 1) && reveal.pityAfter === p.pity.standard.packsWithoutUR && (reveal.pityBefore < rules.pools.standard.pity.afterMisses || hasUR), '待展示保底记录冲突');
      }
      need(p.lastImportDigest === null || /^[a-f0-9]{64}$/.test(p.lastImportDigest), '导入幂等标识无效'); return p;
    }
    function decode(raw) {
      var p; try { p = JSON.parse(raw); } catch (e) { fail('PROFILE_SCHEMA', '档案不是有效JSON'); }
      if (object(p) && p.version === 0) {
        var legacyFields = ['version','owned','tickets','dust','pity','packsOpened','updatedAt'];
        need(Object.keys(p).length === legacyFields.length && legacyFields.every(function (k) { return own(p, k); }), 'v0档案字段无效');
        var migrated = fresh(); migrated.tickets = p.tickets; migrated.dust = p.dust; migrated.owned = p.owned; migrated.pity = p.pity; migrated.packsOpened = p.packsOpened; migrated.updatedAt = p.updatedAt; migrated.createdAt = p.updatedAt;
        return { profile: validate(migrated), migrated: true };
      }
      // P1旧档可能缺少预留字段：只补null，资产保持原值，load在写回前备份原文。
      if (object(p) && p.version === 1 && !own(p, 'pendingReveal')) { p.pendingReveal = null; return { profile: validate(p), migrated: true }; }
      return { profile: validate(p), migrated: false };
    }
    function read(key) { try { return storage.getItem(key); } catch (e) { fail('PROFILE_STORAGE', '读取档案失败：' + e.message); } }
    function write(key, raw) { try { storage.setItem(key, raw); } catch (e) { fail('PROFILE_STORAGE', '保存档案失败：' + e.message); } }
    function checkOpen() { if (closed) fail('PROFILE_CLOSED', '档案仓库已关闭'); }
    function notify(revision) {
      observedRevision = revision;
      if (channel) { try { channel.postMessage({ type: 'revision', revision: revision }); } catch (e) { console.error('收藏档案通知失败，已保存内容仍有效', e); } }
    }
    function commit(previous, draft, previousRaw) {
      draft.revision = previous ? previous.revision + 1 : 1; draft.updatedAt = timestamp(); validate(draft);
      var raw = JSON.stringify(draft); write(KEYS.backup, previousRaw === null ? raw : previousRaw); write(KEYS.main, raw);
      if (read(KEYS.main) !== raw) fail('PROFILE_STORAGE', '档案写入后读回不一致，未报告成功');
      notify(draft.revision); return freeze(clone(draft));
    }
    function quarantine(key, raw) { if (raw !== null) write(KEYS.corrupt + key + '_' + uuid(), raw); }
    function load() {
      checkOpen(); var main = read(KEYS.main), backup = read(KEYS.backup), decoded;
      if (main !== null) {
        try { decoded = decode(main); } catch (e) { if (e.code === 'PROFILE_FUTURE_VERSION') throw e; if (e.code !== 'PROFILE_SCHEMA') throw e; }
        if (decoded) { if (decoded.migrated) return commit(decoded.profile, clone(decoded.profile), main); return freeze(clone(decoded.profile)); }
      }
      if (backup !== null) {
        try { decoded = decode(backup); } catch (e) { if (e.code === 'PROFILE_FUTURE_VERSION') throw e; if (e.code !== 'PROFILE_SCHEMA') throw e; }
        if (decoded) { quarantine('main', main); return commit(decoded.profile, clone(decoded.profile), backup); }
      }
      if (main !== null || backup !== null) { quarantine('main', main); quarantine('backup', backup); fail('PROFILE_RECOVERY_REQUIRED', '主档和备份均无效，原文已隔离，未创建空档'); }
      return commit(null, fresh(), null);
    }
    function idbExclusive(fn) {
      return new Promise(function (resolve, reject) {
        var tx, result, error;
        try { tx = db.transaction('mutex', 'readwrite'); var req = tx.objectStore('mutex').get(KEYS.main);
          req.onsuccess = function () { try { checkOpen(); result = fn(); if (result && typeof result.then === 'function') fail('PROFILE_LOCK', '档案临界区不得包含异步操作'); } catch (e) { error = e; tx.abort(); } };
          req.onerror = function () { error = req.error; };
          tx.oncomplete = function () { resolve(result); };
          tx.onabort = tx.onerror = function () { reject(error || tx.error || new Error('档案事务锁失败')); };
        } catch (e) { reject(e); }
      });
    }
    function exclusive(fn) {
      checkOpen();
      var run = function () { checkOpen(); return db ? idbExclusive(fn) : Promise.resolve().then(function () { checkOpen(); return fn(); }); };
      var job = function () { if (locks && typeof locks.request === 'function') return locks.request(lockName, { mode: 'exclusive' }, run); if (db) return run(); fail('PROFILE_LOCK_UNAVAILABLE', '无可用跨标签页互斥机制，停止写入'); };
      var next = localQueue.then(job, job); localQueue = next.then(function () {}, function () {}); return next;
    }
    if (idb) {
      db = await new Promise(function (resolve, reject) { var request = idb.open('rujuzhe_profile_mutex_v1', 1), blocked = false;
        request.onupgradeneeded = function () { request.result.createObjectStore('mutex'); };
        request.onsuccess = function () { if (blocked) { request.result.close(); return; } resolve(request.result); };
        request.onerror = function () { reject(request.error); };
        request.onblocked = function () { blocked = true; var e = new Error('档案锁数据库升级被其他标签页阻止'); e.code = 'PROFILE_LOCK_UNAVAILABLE'; reject(e); };
      });
    } else if (!locks || typeof locks.request !== 'function') fail('PROFILE_LOCK_UNAVAILABLE', '无可用跨标签页互斥机制，停止写入');
    if (BC) { channel = new BC('rujuzhe_profile_changes'); channel.onmessage = function (event) { var m = event.data; if (m && m.type === 'revision' && integer(m.revision)) observedRevision = Math.max(observedRevision, m.revision); }; }
    try { await exclusive(load); } catch (e) { if (channel) channel.close(); if (db) db.close(); throw e; }
    function snapshot() { checkOpen(); var raw = read(KEYS.main); if (raw === null) fail('PROFILE_RECOVERY_REQUIRED', '主档缺失，请显式重新加载恢复'); var d = decode(raw); if (d.migrated) fail('PROFILE_MIGRATION_REQUIRED', '需要在互斥写入中迁移档案'); return freeze(clone(d.profile)); }
    function change(mutator) { return exclusive(function () { var current = load(), raw = read(KEYS.main), draft = clone(current), result = mutator(draft, current); if (result && result.noChange) return freeze(clone(result.value)); var saved = commit(current, draft, raw); return freeze({ profile: saved, result: result === undefined ? null : clone(result) }); }); }
    async function digest(value) { var bytes = new TextEncoder().encode(canonical(value)); var hash = await crypt.subtle.digest('SHA-256', bytes); return Array.from(new Uint8Array(hash), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
    function day(at) { return new Date(at + 8 * 3600000).toISOString().slice(0, 10); }
    function dayRecord(p, key) { if (!own(p.rewards.days, key)) p.rewards.days[key] = { dailyClaimed: false, participationCount: 0, firstWinClaimed: false }; return p.rewards.days[key]; }
    function checkMatchId(id) { if (!validId(id)) fail('PROFILE_MATCH_ID', '对局ID无效'); }
    // 账号缓存与命令凭证使用独立键；所有写入仍经过档案仓库的跨标签页互斥。
    function accountCache(accountId) {
      need(validId(accountId), '账号ID无效');
      var key = 'rujuzhe_account_cache_' + accountId, intentKey = key + '_requests', selections = new Map();
      function checked(value) {
        need(object(value) && integer(value.profileRevision) && value.profileRevision > 0, '云版本无效');
        var p = clone(value.profile); if (!own(p, 'pendingReveal')) p.pendingReveal = null;
        return { profileRevision: value.profileRevision, profile: validate(p, true) };
      }
      function current() { var raw = read(key); return raw === null ? null : freeze(checked(JSON.parse(raw))); }
      function save(value) {
        var next = checked(value), previous = current();
        if (previous && previous.profileRevision > next.profileRevision) return previous;
        if (previous && previous.profileRevision === next.profileRevision && canonical(previous.profile) !== canonical(next.profile)) fail('ACCOUNT_CACHE_CONFLICT', '同一云版本出现不同内容，请重新读取');
        var raw = JSON.stringify(next), old = read(key); if (old !== null) write(key + '_backup', old);
        write(key, raw); if (read(key) !== raw) fail('PROFILE_STORAGE', '账号缓存写回校验失败'); return freeze(clone(next));
      }
      function intents() { var raw = read(intentKey), value = raw === null ? {} : JSON.parse(raw); need(object(value), '命令凭证格式无效'); return value; }
      return freeze({
        key: key, get: current, validate: checked,
        accept: function (value) { return exclusive(function () { return save(value); }); },
        preview: function (value) { var next = checked(value), token = uuid(), p = snapshot(); selections.set(token, { value: next, guestRaw: read(KEYS.main), cacheRaw: read(key) }); return freeze({previewId: token, before: {tickets:p.tickets,dust:p.dust,owned:clone(p.owned)}, after:{tickets:next.profile.tickets,dust:next.profile.dust,owned:clone(next.profile.owned)}, operation:'account-cache'}); },
        download: function (token) { return exclusive(function () {
          var selected = selections.get(token); if (!selected) fail('PROFILE_PREVIEW_REQUIRED', '请先预览云档案');
          if (read(KEYS.main) !== selected.guestRaw) fail('PROFILE_PREVIEW_STALE', '预览后游客档已变化，请重新读取');
          if (read(key) !== selected.cacheRaw) fail('PROFILE_PREVIEW_STALE', '预览后账号缓存版本已变化，请重新读取');
          var backupKey = 'rujuzhe_profile_cloud_backup_' + timestamp() + '_' + uuid(); write(backupKey, selected.guestRaw);
          if (read(backupKey) !== selected.guestRaw) fail('PROFILE_STORAGE', '云下载前备份校验失败');
          var saved = save(selected.value); return freeze({imported:true,backupKey:backupKey,profile:saved.profile,profileRevision:saved.profileRevision});
        }); },
        claimRequest: function (signature, command) { return exclusive(function () { var all = intents(); if (!own(all, signature)) { all[signature] = Object.assign({requestId:uuid()}, clone(command)); write(intentKey, JSON.stringify(all)); if (read(intentKey) !== JSON.stringify(all)) fail('PROFILE_STORAGE', '请求编号保存失败，未发送操作'); } return freeze(clone(all[signature])); }); },
        finishRequest: function (signature, requestId) { return exclusive(function () { var all = intents(); if (own(all,signature) && all[signature].requestId === requestId) { delete all[signature]; write(intentKey, JSON.stringify(all)); } }); },
        requests: function () { return freeze(clone(intents())); },
        activate: function () { return exclusive(function () { write('rujuzhe_account_active', accountId); }); }
      });
    }
    var api = {
      createAccountCache: accountCache,
      getAccountHint: function () { var value = read('rujuzhe_account_active'); if (value !== null) need(validId(value), '账号缓存标识无效'); return value; },
      clearAccountHint: function () { return exclusive(function () { try { storage.removeItem('rujuzhe_account_active'); } catch (e) { fail('PROFILE_STORAGE', '清除账号选择失败'); } }); },
      getSnapshot: snapshot,
      getCardCount: function (id) { need(byId.has(id), '未知卡ID'); var p = snapshot(); return own(p.owned, id) ? p.owned[id] : 0; },
      getCatalog: function () { return catalog; }, getRules: function () { return rules; },
      // 收藏资产只允许这两种操作，价格取同一配置；检查与扣加在既有互斥提交内完成。
      collectionAction: function (action, id, count) {
        return change(function (p) {
          var c = byId.get(id), amount = own(p.owned, id) ? p.owned[id] : 0;
          if (!c || !c.collectible) fail('COLLECTION_CARD', '只能操作可收藏卡');
          if (!Number.isSafeInteger(count) || count < 1) fail('COLLECTION_COUNT', '数量必须是正整数');
          var price = rules.dust[c.rarity], delta;
          if (action === 'disassemble') {
            if (amount - count < rules.duplicates.keepAtLeast) fail('COLLECTION_KEEP_ONE', '分解后必须至少保留1张');
            delta = price.disassemble * count;
            if (!integer(delta) || !integer(p.dust + delta)) fail('COLLECTION_OVERFLOW', '星尘数量超出范围');
            p.owned[id] = amount - count;
          } else if (action === 'craft' && count === 1) {
            if (p.dust < price.craft) fail('COLLECTION_DUST', '星尘不足');
            if (!integer(amount + 1)) fail('COLLECTION_OVERFLOW', '持有数量超出范围');
            delta = -price.craft; p.owned[id] = amount + 1;
          } else fail('COLLECTION_ACTION', '不支持的收藏操作');
          p.dust += delta;
          return { action: action, cardId: id, count: count, ownedCount: p.owned[id], dustDelta: delta, dustBalance: p.dust };
        });
      },
      openPack: function (packId, expectedRevision) {
        return change(function(p){
          if (p.pendingReveal !== null) fail('PACK_PENDING', '请先恢复并确认上一包结果');
          if (packId !== 'standard') fail('PACK_POOL', '未知卡包');
          if (!integer(expectedRevision) || expectedRevision !== p.revision) fail('PACK_STALE', '档案已变化，请刷新卡包页再操作');
          var pool=rules.pools[packId]; if(p.tickets < pool.ticketCost) fail('PACK_TICKETS', '抽卡券不足');
          var library=env.RJPacks||(typeof require==='function'?require('./packs.js'):null);
          if(!library) fail('PACK_SETUP', '卡包抽样模块未加载');
          var sampled=library.createSampler(catalog,rules,{crypto:crypt,random:options.packRandom}).sample(p.pity.standard.packsWithoutUR,p.owned);
          p.tickets-=pool.ticketCost;p.packsOpened++;p.pity.standard.packsWithoutUR=sampled.pityAfter;
          sampled.cards.forEach(function(card){p.owned[card.cardId]=(p.owned[card.cardId]||0)+1;});
          p.pendingReveal={version:1,resultId:'pack:'+p.profileId+':'+p.packsOpened,packId:packId,createdAt:timestamp(),cards:sampled.cards,ticketsSpent:pool.ticketCost,pityBefore:sampled.pityBefore,pityAfter:sampled.pityAfter};
          return p.pendingReveal;
        });
      },
      resumeReveal: function () { return snapshot().pendingReveal; },
      confirmReveal: function (resultId) {
        return change(function(p){
          if(p.pendingReveal!==null){if(p.pendingReveal.resultId!==resultId)fail('PACK_RESULT_MISMATCH','resultId不匹配，未清除待展示结果');p.pendingReveal=null;return {confirmed:true,resultId:resultId};}
          var prefix='pack:'+p.profileId+':',seq=typeof resultId==='string'&&resultId.startsWith(prefix)?resultId.slice(prefix.length):'';
          if(!/^[1-9][0-9]*$/.test(seq)||!Number.isSafeInteger(Number(seq))||Number(seq)>p.packsOpened)fail('PACK_RESULT_MISMATCH','未知resultId');
          return {noChange:true,value:{confirmed:false,duplicate:true,resultId:resultId}};
        });
      },
      getLockInfo: function () { return freeze({ mode: locks && typeof locks.request === 'function' ? (db ? 'navigator.locks+indexeddb' : 'navigator.locks') : 'indexeddb', broadcast: !!channel, observedRevision: observedRevision }); },
      reload: function () { return exclusive(load); },
      exportProfile: async function () { var p = snapshot(); return JSON.stringify({ format: 'rujuzhe-profile', version: 1, exportedAt: timestamp(), catalogVersion: catalog.version, profile: p, checksum: await digest(p) }, null, 2); },
      previewImport: async function (text) {
        checkOpen(); var envelope; try { envelope = JSON.parse(text); } catch (e) { fail('PROFILE_IMPORT', '导入文件不是有效JSON'); }
        need(object(envelope) && envelope.format === 'rujuzhe-profile' && envelope.version === 1 && envelope.catalogVersion === catalog.version && typeof envelope.checksum === 'string', '导入封装格式不支持');
        if (await digest(envelope.profile) !== envelope.checksum) fail('PROFILE_CHECKSUM', '导入文件校验摘要不符');
        var imported = decode(JSON.stringify(envelope.profile)).profile, raw = read(KEYS.main), current = decode(raw).profile, token = uuid();
        var summary = { previewId: token, sourceProfileId: imported.profileId, baseRevision: current.revision, duplicate: current.lastImportDigest === envelope.checksum,
          before: { tickets: current.tickets, dust: current.dust, owned: clone(current.owned) }, after: { tickets: imported.tickets, dust: imported.dust, owned: clone(imported.owned) }, operation: 'replace' };
        previews.set(token, { baseRaw: raw, imported: clone(imported), digest: envelope.checksum }); return freeze(summary);
      },
      importProfile: function (previewId, importOptions) {
        if (!previews.has(previewId)) fail('PROFILE_PREVIEW_REQUIRED', '必须先在本仓库预览导入'); var preview = previews.get(previewId);
        return exclusive(function () { var current = load(), raw = read(KEYS.main);
          if (current.lastImportDigest === preview.digest && !(importOptions && importOptions.cloudBackup === true)) return freeze({ imported: false, duplicate: true, profile: current });
          if (raw !== preview.baseRaw) fail('PROFILE_PREVIEW_STALE', '预览后档案已变化，请重新预览');
          var backupKey = null;
          if (importOptions && importOptions.cloudBackup === true) {
            backupKey = 'rujuzhe_profile_cloud_backup_' + timestamp() + '_' + uuid(); write(backupKey, raw);
            if (read(backupKey) !== raw) fail('PROFILE_STORAGE', '云下载前备份校验失败，未覆盖本机档案');
          }
          var next = clone(preview.imported); next.lastImportDigest = preview.digest;
          var result = { imported: true, duplicate: false, profile: commit(current, next, raw) }; if (backupKey) result.backupKey = backupKey; return freeze(result);
        });
      },
      claimDaily: function () { return change(function (p) { var key = day(timestamp()), rec = dayRecord(p, key); if (rec.dailyClaimed) return { noChange: true, value: { duplicate: true, awardedTickets: 0 } }; rec.dailyClaimed = true; p.tickets += rules.economy.dailyTickets; return { duplicate: false, awardedTickets: rules.economy.dailyTickets, day: key }; }); },
      beginMatch: function (matchId, mode) {
        checkMatchId(matchId); need(['pve','online','sandbox'].includes(mode), '对局模式无效');
        return change(function (p) { var existing = own(p.pendingMatches, matchId) ? p.pendingMatches[matchId] : (own(p.matchReceipts, matchId) ? p.matchReceipts[matchId] : null);
          if (existing) { if (existing.mode !== mode) fail('PROFILE_RECEIPT_CONFLICT', '同一对局ID的模式冲突'); return { noChange: true, value: { duplicate: true, match: clone(existing) } }; }
          p.pendingMatches[matchId] = { matchId: matchId, mode: mode, startedAt: timestamp() }; return { duplicate: false, matchId: matchId };
        });
      },
      settleMatch: function (matchId, outcome) {
        checkMatchId(matchId); need(['win','loss','abandoned'].includes(outcome), '对局结果无效');
        return change(function (p) {
          if (own(p.matchReceipts, matchId)) { var old = p.matchReceipts[matchId]; if (old.outcome !== outcome) fail('PROFILE_RECEIPT_CONFLICT', '同一对局ID的结果冲突'); return { noChange: true, value: { duplicate: true, awardedTickets: 0, receipt: clone(old) } }; }
          if (!own(p.pendingMatches, matchId)) fail('PROFILE_MATCH_UNKNOWN', '对局未登记，不能领奖');
          var match = p.pendingMatches[matchId], at = timestamp(), key = day(at), awarded = 0;
          if (rules.economy.eligibleModes.includes(match.mode) && outcome !== 'abandoned') { var rec = dayRecord(p, key); if (rec.participationCount < rules.economy.participationDailyCap) { rec.participationCount++; awarded += rules.economy.participationTickets; } if (outcome === 'win' && !rec.firstWinClaimed) { rec.firstWinClaimed = true; awarded += rules.economy.firstWinTickets; } }
          var receipt = { matchId: matchId, mode: match.mode, outcome: outcome, awardedTickets: awarded, settledAt: at, day: key }; p.tickets += awarded; delete p.pendingMatches[matchId]; p.matchReceipts[matchId] = receipt; return { duplicate: false, awardedTickets: awarded, receipt: receipt };
        });
      },
      close: function () { closed = true; previews.clear(); if (channel) channel.close(); if (db) db.close(); }
    };
    if (options.development === true) api.dev = freeze({
      addCard: function (id, count) { return change(function (p) { var c = byId.get(id); need(c && c.collectible && Number.isSafeInteger(count) && count > 0, '只能增加有效可收藏卡的正整数数量'); p.owned[id] = (own(p.owned, id) ? p.owned[id] : 0) + count; return { id: id, count: p.owned[id] }; }); },
      removeCard: function (id, count) { return change(function (p) { need(byId.has(id) && Number.isSafeInteger(count) && count > 0 && own(p.owned, id) && p.owned[id] >= count, '移除数量不足或卡ID无效'); p.owned[id] -= count; if (!p.owned[id]) delete p.owned[id]; return { id: id, count: p.owned[id] || 0 }; }); }
    });
    return Object.freeze(api);
  }
  return Object.freeze({ createStore: createStore, validateCatalog: validateCatalog, validateRules: validateRules, keys: KEYS });
});
