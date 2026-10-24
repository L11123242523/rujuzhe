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
   if(pending){var all=cache.requests();for(var signature of Object.keys(all)){var entry=all[signature];if(entry.path==='/pack/open'&&entry.data.poolId===pending.packId)await cache.finishRequest(signature,entry.requestId);}}
   return {profile:snapshot(),pending:pending};
  }
  async function initialize(){if(initialized)return initialized;if(!hint&&!identity)return Promise.resolve(state());initialized=(async function(){try{var me=await account.me();connect(me.account);if(hint===me.account.id){phase='ready';await refreshPending();}}catch(e){if(e.status===401)connect(null);else{phase='offline';emit();}}return state();})();return initialized;}
  async function syncSelection(){var selected=guest.getAccountHint();if(selected===(identity?identity.id:null))return state();epoch++;hint=selected;identity=selected?{id:selected}:null;cache=selected?guest.createAccountCache(selected):null;phase=selected?'loading':'guest';initialized=null;emit();return selected?initialize():state();}
  function state(){return {mode:identity?'account':'guest',phase:phase,accountId:identity?identity.id:null};}
  async function mutate(path,data,hasRequest){
   ready();var token=epoch,owner=identity.id;
   return exclusive(async function(){
    ready();var me=await account.me();if(me.account.id!==owner||token!==epoch)throw issue('ECONOMY_SESSION_CHANGED','登录账号已改变，请重新读取云档案');
    var signature=JSON.stringify([path,data]),command=hasRequest?await cache.claimRequest(signature,{path:path,data:data}):null;
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
  var api={
   initialize:initialize,connect:connect,getState:state,syncSelection:syncSelection,getGuestProfile:function(){return guest;},getAccountCache:function(){if(!cache)throw issue('ECONOMY_LOGIN','请先登录');return cache;},
   activateCloud:activate,refreshPending:refreshPending,subscribe:function(fn){listeners.add(fn);return function(){listeners.delete(fn);};},
   getSnapshot:snapshot,getCatalog:function(){return guest.getCatalog();},getRules:function(){return guest.getRules();},getCardCount:function(id){return snapshot().owned[id]||0;},resumeReveal:function(){return snapshot().pendingReveal;},
   openPack:async function(poolId,revision){if(!connected())return guestCall('openPack',arguments);ready();await refreshPending();if(snapshot().pendingReveal)throw issue('PACK_PENDING','请先确认上一包结果');return mutate('/pack/open',{poolId:poolId},true);},
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
