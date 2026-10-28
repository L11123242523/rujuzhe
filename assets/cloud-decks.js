/* v565：独立云卡组；保存仅来自明确的保存或导入操作。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else{root.RJCloudDecks=factory();if(root.document&&root.document.defaultView&&root.document.defaultView.document===root.document)document.addEventListener('DOMContentLoaded',function(){root.RJCloudDecks.boot().catch(function(e){console.error('云卡组初始化失败',e);});},{once:true});}})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var slots=[['chars',3,['characters']],['items',8,['item_single','item_permanent']],['carries',4,['attack_cards','skill_cards']]];
  function issue(code,message){var e=Error(message);e.code=code;return e;}
  function copy(value){return JSON.parse(JSON.stringify(value));}
  function empty(){return {revision:0,data:null,updatedAt:null};}
  function createCodec(catalog){
    var cards=catalog.cards,byId=new Map(cards.map(function(c){return [c.id,c];}));
    function validate(data){
      if(!data||Array.isArray(data)||Object.keys(data).sort().join(',')!=='carries,chars,items,version'||data.version!==1)throw issue('DECKS_INVALID','卡组字段或版本无效');
      slots.forEach(function(s){var seen=new Set(),arr=data[s[0]];if(!Array.isArray(arr)||arr.length!==s[1])throw issue('DECKS_INVALID','卡组槽位必须为3角色、8道具、4携带');arr.forEach(function(id){if(id===null)return;var c=byId.get(id);if(typeof id!=='string'||!c||!c.collectible||c.public||s[2].indexOf(c.category)<0)throw issue('DECKS_INVALID','卡ID或槽位类别无效');if(seen.has(c.name))throw issue('DECKS_INVALID','同类槽位不能重复同名卡');seen.add(c.name);});});
      if(data.items.filter(function(id){return id!==null&&byId.get(id).category==='item_permanent';}).length>2)throw issue('DECKS_INVALID','永续道具最多2张');
      return copy(data);
    }
    function encode(cfg){var out={version:1};slots.forEach(function(s){out[s[0]]=Array.from({length:s[1]},function(_,i){var card=cfg&&cfg[s[0]]&&cfg[s[0]][i];if(!card)return null;var found=cards.filter(function(c){return c.name===card.name&&c.category===card._category;});if(found.length!==1||(card.collectionId&&found[0].id!==card.collectionId))throw issue('DECKS_INVALID','卡片与稳定ID未精确对应');return found[0].id;});});return validate(out);}
    function decode(data,allCards){data=validate(data||{version:1,chars:Array(3).fill(null),items:Array(8).fill(null),carries:Array(4).fill(null)});var out={};slots.forEach(function(s){out[s[0]]=data[s[0]].map(function(id){if(id===null)return null;var c=byId.get(id),found=allCards.filter(function(card){return card.name===c.name&&card._category===c.category;});if(found.length!==1)throw issue('DECKS_INVALID','云卡组卡ID在当前卡库无法精确对应');return Object.assign({},found[0],{collectionId:id});});});return out;}
    return Object.freeze({validate:validate,encode:encode,decode:decode});
  }
  function create(options){
    var store=options.economy,codec=createCodec(store.getCatalog()),owner=null,phase='loading',mode='casual',rows={casual:empty(),match:empty()},drafts={},epoch=0,job=null,busy=false,notice='',importAvailable=false;
    function connected(){return options.online();}
    function state(){return {accountId:owner,phase:phase,mode:mode,busy:busy,notice:notice,importAvailable:importAvailable,revision:rows[mode].revision,readOnly:!!owner&&(phase!=='ready'||busy||!connected()||store.getState().phase!=='ready')};}
    function changed(){if(options.changed)options.changed(state());}
    function key(){return 'rujuzhe_account_decks_'+owner;}
    function check(token,id){if(token!==epoch||owner!==id||store.getState().accountId!==id||store.getState().phase!=='ready')throw issue('DECKS_SESSION_CHANGED','账号已改变或失效，旧卡组结果已丢弃');}
    function validateRows(value){if(!value||Object.keys(value).sort().join(',')!=='casual,match')throw issue('DECKS_RESPONSE','云卡组响应无效');['casual','match'].forEach(function(m){var r=value[m];if(!r||!Number.isSafeInteger(r.revision)||r.revision<0||(r.revision===0?(r.data!==null||r.updatedAt!==null):(!Number.isSafeInteger(r.updatedAt)||r.data===null)))throw issue('DECKS_RESPONSE','云卡组版本无效');if(r.data)codec.validate(r.data);});return copy(value);}
    function apply(){if(options.apply)options.apply(copy(drafts[mode]||rows[mode].data));}
    function writable(){if(!owner)throw issue('DECKS_LOGIN','请先登录账号');if(state().readOnly)throw issue('DECKS_READ_ONLY','云卡组当前只读，请联网并重新读取');}
    function failure(e){phase=e.status===401?'expired':'offline';drafts={};notice=e.message;apply();changed();}
    function sync(){
      var s=store.getState(),next=s.mode==='account'?s.accountId:null;
      if(next!==owner){epoch++;owner=next;job=null;busy=false;drafts={};mode='casual';rows={casual:empty(),match:empty()};importAvailable=false;notice='';phase=owner?'loading':'guest';if(owner){try{var raw=options.storage.getItem(key());if(raw)rows=validateRows(JSON.parse(raw));}catch(e){notice='卡组缓存无效：'+e.message;}apply();}else if(options.guest)options.guest();}
      if(!owner){phase='guest';changed();return Promise.resolve(state());}
      if(s.phase!=='ready'||!connected()){phase=s.phase==='expired'?'expired':connected()?'loading':'offline';drafts={};apply();changed();return Promise.resolve(state());}
      if(phase==='ready'){changed();return Promise.resolve(state());}
      return refresh();
    }
    function refresh(){
      if(busy)return Promise.reject(issue('DECKS_BUSY','正在保存云卡组，请等待结果'));
      if(job)return job;if(!owner||store.getState().phase!=='ready'||!connected()){changed();return Promise.reject(issue('DECKS_READ_ONLY','请先联网并使账号云档就绪'));}
      var token=epoch,id=owner;phase='loading';changed();
      var pending=(async function(){try{var value=await options.account.request('/decks');check(token,id);rows=validateRows(value.decks);drafts={};options.storage.setItem(key(),JSON.stringify(rows));phase='ready';importAvailable=rows.casual.revision===0&&rows.match.revision===0;notice=importAvailable?'云端还没有卡组，可导入本机卡组，也可重新编组后保存':'已读取云卡组';apply();changed();return state();}catch(e){if(token===epoch&&id===owner)failure(e);throw e;}finally{if(job===pending)job=null;}})();job=pending;return pending;
    }
    function capture(cfg){if(!owner)return false;if(!state().readOnly)drafts[mode]=codec.encode(cfg);changed();return true;}
    function select(next){if(busy)throw issue('DECKS_BUSY','正在保存云卡组，请等待结果');if(!['casual','match'].includes(next))throw issue('DECKS_INPUT','卡组模式无效');mode=next;apply();changed();}
    async function save(data,target){
      writable();target=target||mode;if(!['casual','match'].includes(target))throw issue('DECKS_INPUT','卡组模式无效');data=codec.validate(data||drafts[target]||rows[target].data||{version:1,chars:Array(3).fill(null),items:Array(8).fill(null),carries:Array(4).fill(null)});
      var token=epoch,id=owner,revision=rows[target].revision;busy=true;changed();
      try{var result=await options.account.request('/decks/'+target,'PUT',{data:data,expectedRevision:revision});check(token,id);var next=copy(rows);next[target]={revision:result.revision,data:result.data,updatedAt:result.updatedAt};rows=validateRows(next);options.storage.setItem(key(),JSON.stringify(rows));delete drafts[target];importAvailable=false;notice='云卡组已保存';return result;}
      catch(e){if(token===epoch&&id===owner){if(e.status===409){phase='conflict';drafts={};notice='云卡组已变化，请重新读取后再修改';apply();}else failure(e);}throw e;}
      finally{if(token===epoch&&id===owner){busy=false;changed();}}
    }
    async function importLocal(values){writable();if(!importAvailable)throw issue('DECKS_IMPORT','已有云卡组，不允许首次导入覆盖');var done=[];try{for(var m of ['casual','match']){await save(values[m],m);done.push(m);}return done;}catch(e){notice='已导入 '+(done.join('、')||'0 套')+'；其余未完成：'+e.message;changed();throw e;}}
    function offline(){if(owner){phase='offline';drafts={};notice='离线只读；未保存修改已丢弃，不会排队上传';apply();changed();}}
    function current(){return copy(drafts[mode]||rows[mode].data);}
    return Object.freeze({sync:sync,refresh:refresh,capture:capture,select:select,save:save,importLocal:importLocal,offline:offline,state:state,current:current,codec:codec});
  }
  var instance=null,booting=null,loading=true;
  function boot(){if(booting)return booting;booting=(async function(){var store=await RJPackApp.getEconomy();
    await import('./deck-editor.js?v=567');RJDeckEditor.init(store);
    function apply(data){if(typeof allCards==='undefined'||!allCards.length)return;deckConfig.p1=instance.codec.decode(data,allCards);if(typeof renderDeckBuilder==='function'&&document.getElementById('deckBuilder').classList.contains('active'))renderDeckBuilder();}
    instance=create({economy:store,account:RJAccount.client(),storage:localStorage,online:function(){return navigator.onLine!==false;},apply:apply,changed:render,guest:function(){if(typeof tryLoadDeckConfig==='function')tryLoadDeckConfig();}});
    store.subscribe(function(){instance.sync().catch(report);});addEventListener('offline',function(){instance.offline();});addEventListener('online',function(){instance.sync().catch(report);});addEventListener('storage',function(e){if(e.key==='rujuzhe_account_decks_'+instance.state().accountId)instance.refresh().catch(report);});
    await instance.sync();loading=false;await store.initialize();await instance.sync();return instance;
  })().catch(function(e){loading=false;report(e);throw e;});return booting;}
  function report(e){var n=typeof document!=='undefined'&&document.getElementById('cloudDeckStatus');if(n)n.textContent=e.message;if(typeof showToast==='function')showToast(e.message,'warn');}
  function render(){if(!instance||typeof document==='undefined')return;var s=instance.state(),bar=document.getElementById('cloudDeckBar');if(!bar)return;bar.hidden=!s.accountId;var select=document.getElementById('cloudDeckMode'),save=document.getElementById('cloudDeckSave'),imp=document.getElementById('cloudDeckImport'),status=document.getElementById('cloudDeckStatus');select.value=s.mode;select.disabled=s.busy;save.disabled=s.readOnly;imp.hidden=!s.importAvailable;imp.disabled=s.readOnly;status.textContent=(s.readOnly?'只读 · ':'')+s.notice;if(typeof RJDeckEditor!=='undefined'&&document.getElementById('deckBuilder').classList.contains('active'))RJDeckEditor.render();}
  function blocked(){return loading||!!(instance&&instance.state().readOnly);}
  function accountMode(){return !!(instance&&instance.state().accountId);}
  function capture(cfg){return instance?instance.capture(cfg):loading;}
  function roomBlocked(){return typeof RJOnlineAccess!=='undefined'&&typeof Online!=='undefined'&&RJOnlineAccess.blockEdit(Online);}
  function select(mode){if(!instance||roomBlocked())return;try{instance.capture(deckConfig.p1);instance.select(mode);deckSetMode=mode==='casual'?'pve':'online';__deckModeUI();renderDeckBuilder();}catch(e){report(e);}}
  function useMode(mode){if(accountMode()){instance.capture(deckConfig.p1);instance.select(mode);}}
  function useCasual(){useMode('casual');}
  function state(){return instance?instance.state():{accountId:null,phase:'loading',readOnly:true};}
  async function save(){try{await boot();if(roomBlocked())return;instance.capture(deckConfig.p1);await instance.save();}catch(e){report(e);}}
  async function importLocal(){try{await boot();if(blocked()||roomBlocked())throw issue('DECKS_READ_ONLY','云卡组当前只读');if(!confirm('将本机对应卡组导入当前模式的草稿？仅点击保存云卡组才上传，游客原存档保留。'))return;var local=JSON.parse(localStorage.getItem('rujuzhe_decks_v2')||'null'),mode=instance.state().mode,key=mode==='casual'?'pve':'online',cfg=local&&local[key]&&local[key].p1;if(!cfg)throw issue('DECKS_IMPORT','本机缺少 '+key+' 卡组');var data=RJDeckEditor.migrate(cfg);deckConfig.p1=instance.codec.decode(data,allCards);instance.capture(deckConfig.p1);renderDeckBuilder();showToast('已导入草稿，请点击保存云卡组上传','info');}catch(e){report(e);}}
  async function startPve(sandbox){try{await boot();var s=instance.state();if(s.accountId){if(s.phase!=='ready'&&s.phase!=='offline')throw issue('DECKS_READ_ONLY','请先读取云卡组');useCasual();if(!instance.current())throw issue('DECKS_EMPTY','请先编组并保存云卡组');}startBattle(sandbox);}catch(e){report(e);}}
  return Object.freeze({createCodec:createCodec,create:create,boot:boot,blocked:blocked,accountMode:accountMode,capture:capture,select:select,useMode:useMode,state:state,useCasual:useCasual,render:render,save:save,importLocal:importLocal,startPve:startPve});
});
