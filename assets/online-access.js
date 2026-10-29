/* v556：仅联机使用的账号准入、云档持有视图与内存凭证。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.RJOnlineAccess=factory().create({economy:function(){return root.RJPackApp.getEconomy();},account:function(){return root.RJAccount.client();},openAccount:function(o){if(o&&o.requireName){root.showScreen('mainMenu');return root.RJCloud.open(o);}return root.openAccountDialog();},confirm:function(text){return root.confirm(text);},cloud:function(o){return root.RJCloud.create(o);},changed:function(){if(typeof root.renderDeckBuilder==='function'&&typeof root.deckSetMode!=='undefined'&&root.deckSetMode==='online')root.renderDeckBuilder();}});})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function issue(code,message){var e=new Error(message);e.code=code;return e;}
  function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
  function create(options){
    var store=null,library=null,session=null,generation=0,loading=null,player=null;
    function account(){return options.account();}
    async function inspect(){
      if(loading)return loading;
      loading=(async function(){store=await options.economy();library=(options.deck||globalThis.RJOnlineDeck).create(store.getCatalog());if(store.subscribe)store.subscribe(function(){if(options.changed)options.changed();});if(store.initialize)await store.initialize();return store;})().catch(function(e){loading=null;throw e;});
      return loading;
    }
    async function gate(){
      var p=await inspect(),state=p.getState();
      if(state.mode!=='account'||state.phase==='expired'){options.openAccount();throw issue('ONLINE_LOGIN_REQUIRED','请先登录账号');}
      var me;
      try{me=await account().me();}catch(e){if(e.status===401)options.openAccount();throw e;}
      if(me.account.id!==state.accountId){options.openAccount();throw issue('ONLINE_SESSION_CHANGED','登录账号已切换，请先重新读取云档案');}
      if(typeof me.account.displayName!=='string'||!me.account.displayName.trim()){player=null;options.openAccount({requireName:true});throw issue('ONLINE_NAME_REQUIRED','请先设置玩家名，再进入联机');}
      player={id:me.account.id,displayName:me.account.displayName,accountNo:me.account.accountNo};
      if(state.phase!=='ready'){
        var remote=await account().request('/profile');
        if(remote.revision===0||remote.data===null){
          if(!await options.confirm('你还没把本机档案迁入云端。选择“确定”即“上传本机并继续”；取消则停止联机。'))throw issue('CLOUD_EMPTY','请先上传本机档案');
          var controller=options.cloud({account:account(),profile:p});
          try{await controller.pull();await controller.upload();}finally{controller.dispose();}
        }else{options.openAccount();throw issue('ONLINE_ACCOUNT_NOT_READY','请先在账号界面读取并下载云档案，再进入联机');}
      }
      if(p.getState().mode!=='account'||p.getState().phase!=='ready'||p.getState().accountId!==state.accountId)throw issue('ONLINE_ACCOUNT_NOT_READY','账号云档尚未就绪或登录身份已改变');
      p.getSnapshot();var field=globalThis.document&&globalThis.document.getElementById('olName');if(field)field.value=player.displayName;return p;
    }
    async function friendlyGate(){
      var p=await inspect(),s=p.getState();if(s.mode!=='account'||s.phase==='expired'){options.openAccount();throw issue('ONLINE_LOGIN_REQUIRED','好友战需要登录账号');}
      var me=(await account().me()).account;if(me.id!==s.accountId||p.getState().accountId!==s.accountId)throw issue('ONLINE_SESSION_CHANGED','登录账号已切换');
      if(!me.displayName.trim()){options.openAccount({requireName:true});throw issue('ONLINE_NAME_REQUIRED','请先设置玩家名，再进入好友战');}
      player={id:me.id,displayName:me.displayName,accountNo:me.accountNo};return p;
    }
    async function friendlyDeck(){
      await friendlyGate();var id=player.id,cloud=await globalThis.RJCloudDecks.boot();if(cloud.state().accountId!==id)throw issue('ONLINE_SESSION_CHANGED','登录账号已切换');
      if(cloud.state().phase!=='ready')throw issue('FRIENDS_DECK_EMPTY','请先读取并保存休闲卡组');
      globalThis.RJCloudDecks.useCasual();globalThis.deckSetMode='pve';globalThis.__deckModeUI();
      var errors=globalThis.validateDeck('p1');if(errors.length)throw issue('ONLINE_DECK_INVALID','休闲卡组不合法：'+errors.join('、'));
      var cfg=library.bind(globalThis.deckConfig.p1),saved=(await account().request('/decks')).decks.casual.data;
      if(store.getState().accountId!==id)throw issue('ONLINE_SESSION_CHANGED','登录账号已切换');
      if(!saved||await library.hash([].concat(saved.chars,saved.items,saved.carries))!==await library.hash(library.fromCfg(cfg,true)))throw issue('FRIENDS_DECK_UNSAVED','休闲草稿尚未保存，请先保存云卡组再邀请或接受');
      return cfg;
    }
    async function enterFriendly(online,room,role){
      if(globalThis.RJMatchmaking&&globalThis.RJMatchmaking.locked())throw issue('MATCH_LOCKED','请先取消或结束当前匹配');
      if(online.serverAuthoritative||online.connected||online.active||online._entryPending||(online.ws&&online.ws.readyState<2))throw issue('ONLINE_BUSY','请先退出当前房间');
      var token=++generation;session=null;online._entryPending=true;online._authRejected=false;
      try{
        var cfg=await friendlyDeck();if(token!==generation)throw issue('ONLINE_SESSION_CHANGED','进入好友房间已取消');
        session={friendly:true,cfg:freeze(cfg),cards:freeze(library.fromCfg(cfg,true)),owner:store.getState().accountId,displayName:player.displayName,accountNo:player.accountNo,role:role,room:room,pass:null};
        await pass(room,role);if(token!==generation)throw issue('ONLINE_SESSION_CHANGED','进入好友房间已取消');
        online.mode='friendly';online.role=role;online.isGuest=role==='guest';online.isHost=role==='host';online.authority='host';online.mySeat='';online.roomId=room;
        online.relayBase=online._wsUrl(online._serverInput());online.endpoint=online.relayBase;online._connect(function(){online._send(online._hello(role));},room);
      }catch(e){if(token===generation){session=null;online.mode='online';online.status(e.message);}throw e;}finally{if(token===generation)online._entryPending=false;}
    }
    function unowned(card){
      if(!card)return false;
      if(!store||!library||store.getState().mode!=='account'||store.getState().phase!=='ready')return true;
      try{return !(store.getSnapshot().owned[library.record(card).id]>=1);}catch(e){return true;}
    }
    async function enter(online,role){
      if(globalThis.RJMatchmaking&&globalThis.RJMatchmaking.locked())throw issue('MATCH_LOCKED','请先取消或结束当前匹配');
      if(online.serverAuthoritative){online.status('正式联机仅支持房主权威模式，请关闭服务器权威后重试');return;}
      if(online.connected||online.active||online._entryPending||(online.ws&&online.ws.readyState<2)){online.status('已在房间或正在进入，请先退出房间');return;}
      var token=++generation;session=null;online._entryPending=true;online._authRejected=false;
      try{
        await gate();if(token!==generation)return;
        globalThis.enterOnlineDeckMode();
        var errors=globalThis.validateDeck('p1');if(errors.length)throw issue('ONLINE_DECK_INVALID','联机卡组不合法：\n'+errors.join('\n'));
        var cfg=library.bind(online._myDeckCfg());
        session={cfg:freeze(cfg),cards:freeze(library.fromCfg(cfg,true)),owner:store.getState().accountId,displayName:player.displayName,accountNo:player.accountNo,role:role,room:null,pass:null};
        await (role==='host'?online._createRoom():online._joinRoom());
      }catch(e){
        if(token!==generation)return;
        session=null;
        var missing=e.detail&&e.detail.missing,message=missing?'联机卡组有未持有卡：\n'+missing.map(function(c){return c.name;}).join('、'):e.message;
        online.status(message);if(typeof globalThis.showToast==='function')globalThis.showToast(message,'warn');
      }finally{if(token===generation)online._entryPending=false;}
    }
    async function pass(room,role){
      if(!session||session.role!==role)throw issue('ONLINE_PASS_INVALID','请重新进入房间');
      var token=generation,current=session;
      await (current.friendly?friendlyGate():gate());
      if(current.owner!==store.getState().accountId)throw issue('ONLINE_SESSION_CHANGED','登录账号已切换，请退出房间重新进入');
      var result=await account().request(current.friendly?'/online/friendly-pass':'/online/pass','POST',current.friendly?{roomCode:room,role:role}:{roomCode:room,role:role,cards:current.cards.slice()});
      if(typeof result.pass!=='string'||result.expiresAt<=Date.now()||result.deckHash!==await library.hash(current.cards))throw issue('ONLINE_PASS_INVALID','联机凭证响应无效');
      if(token!==generation||current!==session||store.getState().accountId!==current.owner||(!current.friendly&&store.getState().phase!=='ready'))throw issue('ONLINE_SESSION_CHANGED','进入房间已取消或账号已切换');
      session=Object.assign({},current,{pass:result.pass,expiresAt:result.expiresAt,deckHash:result.deckHash,room:room});return result.pass;
    }
    async function accept(cfg){var current=session,token=generation;if(!current||await library.hash(library.fromCfg(cfg,true))!==current.deckHash)throw issue('ONLINE_DECK_MISMATCH','服务器确认的实际卡组不一致');if(token!==generation||current!==session)throw issue('ONLINE_SESSION_CHANGED','已退出原房间');session=Object.assign({},current,{approved:freeze(JSON.parse(JSON.stringify(cfg)))});return session.approved;}
    function clear(){generation++;session=null;player=null;}
    async function enterMatched(online,matched,cfg){
      if(online.connected||online.active||online._entryPending)throw issue('ONLINE_BUSY','请先退出当前房间');
      var token=++generation;online._entryPending=true;
      try{await gate();var bound=library.bind(cfg);session={matched:true,cfg:freeze(bound),cards:freeze(library.fromCfg(bound,true)),owner:store.getState().accountId,displayName:player.displayName,accountNo:player.accountNo,role:matched.role,room:matched.roomCode,pass:null};
        if(await library.hash(session.cards)!==matched.deckHash)throw issue('ONLINE_DECK_MISMATCH','实际卡组与锁定卡组不一致');
        await pass(matched.roomCode,matched.role);if(token!==generation)throw issue('ONLINE_SESSION_CHANGED','匹配进房已取消');
        online.mode='matched';online.role=matched.role;online.isGuest=matched.role==='guest';online.isHost=!online.isGuest;online.authority='host';online.mySeat='';online.roomId=matched.roomCode;online._authRejected=false;
        online.relayBase=online._wsUrl(online._serverInput());online.endpoint=online.relayBase;online._connect(function(){online._send(online._hello(matched.role));},matched.roomCode);
      }catch(e){if(token===generation)session=null;throw e;}finally{if(token===generation)online._entryPending=false;}
    }
    function blockEdit(online){var blocked=!!(globalThis.RJMatchmaking&&globalThis.RJMatchmaking.locked())||!!(online&&(online.connected||online.active||online._entryPending||(online.ws&&online.ws.readyState<2)));if(blocked&&typeof globalThis.showToast==='function')globalThis.showToast('进入房间后不能编辑联机卡组，要改请先退出房间','warn');return blocked;}
    return Object.freeze({inspect:inspect,gate:gate,friendlyGate:friendlyGate,friendlyDeck:friendlyDeck,enterFriendly:enterFriendly,enterMatched:enterMatched,enter:enter,pass:pass,accept:accept,unowned:unowned,blockEdit:blockEdit,get:function(){return session;},identity:function(){return player?Object.assign({},player):null;},clear:clear});
  }
  return Object.freeze({create:create});
});
if(typeof document!=='undefined'&&document.currentScript){
  var friendModuleURL=new URL('friends.js',document.currentScript.src);friendModuleURL.search=new URL(document.currentScript.src).search;
  import(friendModuleURL.href).catch(function(e){console.error('好友模块加载失败',e);});
  var matchmakingURL=new URL('matchmaking.js',document.currentScript.src);matchmakingURL.search=new URL(document.currentScript.src).search;
  import(matchmakingURL.href).catch(function(e){console.error('匹配模块加载失败',e);});
}
