/* 唯一经济适配器：游客调用原档案；账号只接收服务端已提交结果，绝不回退本地。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.RJEconomy=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function issue(code,message){var e=new Error(message);e.code=code;return e;}
 function create(options){
  var guest=options.guest,account=options.account,crypt=options.crypto||globalThis.crypto,locks=options.locks||(globalThis.navigator&&navigator.locks),online=options.online||function(){return !globalThis.navigator||navigator.onLine!==false;};
  var hint=guest.getAccountHint(),identity=hint?{id:hint}:null,cache=hint?guest.createAccountCache(hint):null,phase=hint?'loading':'guest',epoch=0,initialized=null,listeners=new Set(),matches=new Map();
  function emit(){listeners.forEach(function(fn){fn();});}
  function connected(){return !!identity;}
  function snapshot(){var saved=cache&&cache.get();return saved?saved.profile:guest.getSnapshot();}
  function network(){if(!online())throw issue('ECONOMY_OFFLINE','需要联网，未扣券、未发卡；联网后可用原请求重试');}
  function exclusive(fn){if(!locks||typeof locks.request!=='function')return Promise.reject(issue('ECONOMY_LOCK','当前环境缺少账号跨标签页互斥，停止账号经济操作'));return locks.request('rujuzhe-account-session',{mode:'exclusive'},fn);}
  function connect(a){if(a){if(!identity||identity.id!==a.id){epoch++;identity={id:a.id};cache=guest.createAccountCache(a.id);phase='choice';}else if(phase==='loading'||phase==='expired')phase='choice';}else if(identity){phase='expired';}else phase='guest';emit();}
  function ready(){network();if(!identity||phase!=='ready')throw issue('ECONOMY_CHOICE',phase==='expired'?'账号登录已失效，请重新登录或明确登出继续游客':'请先在账号界面读取并下载云档案，或首次上传本机档案');}
  async function accept(value,token){if(token!==epoch)throw issue('ECONOMY_SESSION_CHANGED','账号已切换，请重新读取结果');var saved=await cache.accept(value);if(token!==epoch)throw issue('ECONOMY_SESSION_CHANGED','账号已切换');emit();return saved;}
  async function activate(value){var token=epoch;await accept(value,token);await cache.activate();phase='ready';emit();return refreshPending();}
  async function refreshPending(){
   if(!identity)return {profile:guest.getSnapshot(),pending:guest.resumeReveal()};network();var token=epoch,value=await account.request('/pack/pending');await accept(value,token);
   if(phase==='offline'&&hint===identity.id){phase='ready';emit();}var pending=snapshot().pendingReveal;
   if(pending){var all=cache.requests();for(var signature of Object.keys(all)){var entry=all[signature];if(entry.path==='/pack/open'&&entry.data.poolId===pending.packId&&(entry.data.count||1)===pending.ticketsSpent)await cache.finishRequest(signature,entry.requestId);}}
   return {profile:snapshot(),pending:pending};
  }
  async function initialize(){if(initialized)return initialized;if(!hint&&!identity)return Promise.resolve(state());initialized=(async function(){try{var me=await account.me();connect(me.account);if(hint===me.account.id){phase='ready';await refreshPending();}}catch(e){if(e.status===401)connect(null);else{phase='offline';emit();}}return state();})();return initialized;}
  async function syncSelection(){var selected=guest.getAccountHint();if(selected===(identity?identity.id:null))return state();epoch++;hint=selected;identity=selected?{id:selected}:null;cache=selected?guest.createAccountCache(selected):null;phase=selected?'loading':'guest';initialized=null;emit();return selected?initialize():state();}
  function state(){return {mode:identity?'account':'guest',phase:phase,accountId:identity?identity.id:null};}
  async function mutate(path,data,hasRequest){
   ready();var token=epoch,owner=identity.id;
   return exclusive(async function(){
    ready();var me=await account.me();if(me.account.id!==owner||token!==epoch)throw issue('ECONOMY_SESSION_CHANGED','登录账号已改变，请重新读取云档案');
    var signature=JSON.stringify([path,data]);
    if(path==='/pack/open'&&Object.entries(cache.requests()).some(function(pair){return pair[0]!==signature&&pair[1].path==='/pack/open'&&['character','item'].includes(pair[1].data.poolId);}))throw issue('PACK_REQUEST_UNCERTAIN','上一批开包结果待查询；请恢复结果或按原池和数量重试');
    var command=hasRequest?await cache.claimRequest(signature,{path:path,data:data}):null;
    try{
     var value=await account.request(path,'POST',Object.assign({},data,command?{requestId:command.requestId}:{}));
     await accept(value,token);if(command)await cache.finishRequest(signature,command.requestId);if(value.duplicate&&value.result)value.result=Object.assign({},value.result,{duplicate:true});return Object.assign({},value,{profile:snapshot()});
    }catch(e){
     if(e.code==='PENDING_REVEAL'&&e.detail&&e.detail.profile){await accept(e.detail,token);if(command)await cache.finishRequest(signature,command.requestId);var pending=issue('PACK_PENDING','已有已保存结果，请先展示并确认');pending.detail=e.detail;throw pending;}
     if(e.status===401){phase='expired';emit();}throw e;
    }
   });
  }
  function guestCall(name,args){return guest[name].apply(guest,args);}
  // C3管理操作共享账号会话锁；未知提交结果固定原快照，只读查询后才恢复。
  async function managed(fn){network();if(!identity)throw issue('ECONOMY_LOGIN','请先登录');var owner=identity.id,token=epoch;return exclusive(async function(){var me=await account.me();if(token!==epoch||owner!==me.account.id)throw issue('ECONOMY_SESSION_CHANGED','账号已切换');return fn(token,owner);});}
  async function mergeState(){
   var intent=cache.requests()['c3-guest-merge'],local=intent?intent.data.localProfile:guest.getSnapshot();
   var value=await account.request('/account/merge-status?sourceProfileId='+encodeURIComponent(local.profileId));
   if(typeof value.enabled!=='boolean'||typeof value.merged!=='boolean'||typeof value.sourceMerged!=='boolean')throw issue('ACCOUNT_RESPONSE','合并状态无效');
   return Object.assign({},value,{localMark:guest.getGuestMergeMark(local.profileId),pendingMerge:intent?intent.data:null});
  }
  async function completeMerge(value,token,owner){await accept(value,token);await guest.markGuestMerged(value.mergeSummary.sourceProfileId,owner,value.mergeSummary);await cache.activate();phase='ready';await cache.finishRequest('c3-guest-merge',cache.requests()['c3-guest-merge'].requestId);emit();return value;}
  async function mergeDigest(data){function canonical(v){return Array.isArray(v)?'['+v.map(canonical).join(',')+']':v&&typeof v==='object'?'{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}':JSON.stringify(v);}var b=await crypt.subtle.digest('SHA-256',new TextEncoder().encode(canonical({localProfile:data.localProfile,expectedRevision:data.expectedRevision})));return Array.from(new Uint8Array(b),function(x){return x.toString(16).padStart(2,'0');}).join('');}
  async function mergeGuest(local,revision){return managed(async function(token,owner){
   var intent=cache.requests()['c3-guest-merge'];
   if(intent){if(JSON.stringify(intent.data.localProfile)!==JSON.stringify(local)||intent.data.expectedRevision!==revision)throw issue('MERGE_UNCERTAIN','已有待查询的合并请求，不允许换参数提交');}
   else{var status=await mergeState();if(!status.enabled)throw issue('MERGE_DISABLED','游客合并入口已关闭');if(status.merged||status.sourceMerged||status.localMark)throw issue('ALREADY_MERGED','账号或这份游客档已经合并过');
    if(status.profile&&status.profile.pendingReveal!==null||local.pendingReveal!==null)throw issue('PENDING_REVEAL','请先展示并确认双方开包结果');
    var backed=await guest.backupGuestForMerge(local);intent=await cache.claimRequest('c3-guest-merge',{path:'/account/merge-guest',data:{localProfile:backed.localProfile,expectedRevision:revision,confirm:true}});
   }
   var value;
   try{value=await account.request('/account/merge-guest','POST',intent.data);}
   catch(e){if(e.status>=400&&e.status<500)await cache.finishRequest('c3-guest-merge',intent.requestId);else e.message='合并结果待查询：'+e.message+'；请查询合并状态，不会换参数重发';throw e;}
   return completeMerge(value,token,owner);
  });}
  async function recoverMerge(){return managed(async function(token,owner){var status=await mergeState(),intent=cache.requests()['c3-guest-merge'];if(!intent)return status;
   if(status.merged){if(status.mergeSummary.sourceDigest!==await mergeDigest(intent.data))throw issue('MERGE_DIFFERENT','云端已提交另一份合并，请读取云档；不会重复提交');await completeMerge(status,token,owner);return mergeState();}
   return status;
  });}
  var api={
   initialize:initialize,connect:connect,getState:state,syncSelection:syncSelection,getGuestProfile:function(){return guest;},getAccountCache:function(){if(!cache)throw issue('ECONOMY_LOGIN','请先登录');return cache;},
   getMergeState:function(){return managed(mergeState);},mergeGuest:mergeGuest,recoverGuestMerge:recoverMerge,
   updateDisplayName:function(value){return managed(function(){return account.request('/account/display-name','POST',{displayName:value});});},
   exportAccount:function(){return managed(function(){return account.request('/account/export');});},
   deleteAccount:function(word){if(word!=='删除账号')return Promise.reject(issue('DELETE_CONFIRM','请输入确认词“删除账号”'));return managed(async function(){await cache.backupForDelete();var token=await account.request('/account/delete-token','POST',{});await account.request('/account','DELETE',{confirmationToken:token.confirmationToken});await guest.clearAccountHint();epoch++;identity=null;cache=null;phase='guest';emit();return {deleted:true};});},
   activateCloud:activate,refreshPending:refreshPending,subscribe:function(fn){listeners.add(fn);return function(){listeners.delete(fn);};},
   getSnapshot:snapshot,getCatalog:function(){return guest.getCatalog();},getRules:function(){return guest.getRules();},getCardCount:function(id){return snapshot().owned[id]||0;},resumeReveal:function(){return snapshot().pendingReveal;},
   openPack:async function(poolId,revision,count){if(count===undefined)count=1;if(!connected())return guest.openPack(poolId,revision,count);ready();await refreshPending();if(snapshot().pendingReveal)throw issue('PACK_PENDING','请先确认上一包结果');return mutate('/pack/open',{poolId:poolId,count:count},true);},
   getPools:async function(){if(connected()){network();return account.request('/pack/pools');}var rules=guest.getRules();return {version:1,allowedCounts:rules.allowedCounts,pools:Object.fromEntries(Object.entries(rules.pools).filter(function(pair){return pair[1].legacyOnly===false;}))};},
   confirmReveal:function(resultId){return connected()?mutate('/pack/confirm',{resultId:resultId},false):guestCall('confirmReveal',arguments);},
   collectionAction:function(action,cardId,count){return connected()?mutate('/collection/'+action,Object.assign({cardId:cardId},action==='disassemble'?{count:count}:{}),true):guestCall('collectionAction',arguments);},
   claimDaily:function(){return connected()?mutate('/reward/daily',{},false):guestCall('claimDaily',arguments);},
   beginMatch:function(matchId,mode){var owner=identity?identity.id:null,old=matches.get(matchId);if(old&&(old.owner!==owner||old.epoch!==epoch))return Promise.reject(issue('ECONOMY_MATCH','账号切换后不能使用原对局领奖'));matches.set(matchId,{mode:mode,owner:owner,epoch:epoch});if(!connected())return guestCall('beginMatch',arguments);return Promise.resolve({begun:true,matchId:matchId});},
   settleMatch:function(matchId,outcome){var match=matches.get(matchId),owner=identity?identity.id:null;if(!match||match.owner!==owner||match.epoch!==epoch)return Promise.reject(issue('ECONOMY_MATCH','账号切换后不能用原对局领奖'));if(!connected())return guestCall('settleMatch',arguments);return mutate('/reward/match',{matchId:matchId,mode:match.mode,result:outcome},false);},
   verifyLogin:function(email,code){network();return exclusive(async function(){await account.verify(email,code);var me=await account.me();connect(me.account);return me;});},
   logout:function(){network();return exclusive(async function(){try{await account.logout();}catch(e){if(e.status!==401)throw e;}await guest.clearAccountHint();epoch++;identity=null;cache=null;phase='guest';emit();return {notice:'本地缓存与云端可能不同；已恢复原游客档，未自动合并'};});}
  };
  return Object.freeze(api);
 }
 return Object.freeze({create:create});
});
