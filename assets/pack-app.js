/* 卡包页面与只读对局桥接：资产只交给P1，战斗状态及随机源只读。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else{root.RJPackApp=factory();if(root.document){var boot=function(){if(root.RJPackApp.isPageReady())root.RJPackApp.boot().catch(function(e){console.error('卡包初始化失败',e);});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();}}})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 var moduleURL=typeof document!=='undefined'&&document.currentScript&&document.currentScript.src;
 async function dependencies(doc){
  for(var entry of [['RJAccount','account.js'],['RJEconomy','economy.js']]){
   if(typeof globalThis[entry[0]]==='object')continue;
   if(!moduleURL)throw Error('卡包模块依赖地址缺失，未启动经济操作');
   var url=new URL(entry[1],moduleURL);url.search=new URL(moduleURL).search;
   await new Promise(function(resolve,reject){var script=doc.createElement('script');script.src=url.href;script.onload=resolve;script.onerror=function(){reject(Error('卡包依赖加载失败：'+url.pathname));};doc.head.appendChild(script);});
   if(typeof globalThis[entry[0]]!=='object')throw Error('卡包依赖未就绪：'+entry[0]);
  }
 }
 // 活动界面独立加载，不能成为经济启动或纯引擎环境的前置条件。
 var eventsLoading=null;
 function loadEvents(doc){
  if(globalThis.RJEventsMail)return Promise.resolve(globalThis.RJEventsMail);if(eventsLoading)return eventsLoading;
  if(!moduleURL)return Promise.reject(Error('活动界面脚本地址缺失'));
  var url=new URL('events-mail.js',moduleURL);url.search=new URL(moduleURL).search;
  eventsLoading=new Promise(function(resolve,reject){var script=doc.createElement('script');script.src=url.href;script.onload=function(){resolve(globalThis.RJEventsMail);};script.onerror=function(){reject(Error('活动邮件界面加载失败，请重新打开'));};doc.head.appendChild(script);}).catch(function(e){eventsLoading=null;throw e;});return eventsLoading;
 }
 function createController(profile){var busy=false;return Object.freeze({
  async openPack(poolId,count){if(poolId===undefined)poolId='character';if(count===undefined)count=1;if(busy){var e=new Error('正在保存上一包');e.code='PACK_BUSY';throw e;}busy=true;try{var p=profile.getSnapshot(),saved=await profile.openPack(poolId,p.revision,count);return saved.result;}finally{busy=false;}},
  resume:function(){return profile.resumeReveal();},confirm:function(id){return profile.confirmReveal(id);},snapshot:function(){return profile.getSnapshot();}
 });}
 var shopLoading=null;
 function loadShop(doc){
  if(globalThis.RJShop)return Promise.resolve(globalThis.RJShop);if(shopLoading)return shopLoading;if(!moduleURL)return Promise.reject(Error('商店界面脚本地址缺失'));
  var url=new URL('shop.js',moduleURL);url.search=new URL(moduleURL).search;
  shopLoading=new Promise(function(resolve,reject){var script=doc.createElement('script');script.src=url.href;script.onload=function(){resolve(globalThis.RJShop);};script.onerror=function(){reject(Error('商店界面加载失败，请重新打开'));};doc.head.appendChild(script);}).catch(function(e){shopLoading=null;throw e;});return shopLoading;
 }
 function displayGoldReward(doc,value){
  var overlay=doc.getElementById('resultOverlay'),box=doc.getElementById('resultBox');if(!overlay||!box||!overlay.classList.contains('active')||!value||!value.result||!value.result.receipt)return;
  var node=doc.getElementById('accountGoldReward'),result=value.result;if(result.receipt.mode!=='online'||!Number.isSafeInteger(result.goldAwarded)||result.goldAwarded<=0){if(node)node.remove();return;}
  if(!node){node=doc.createElement('p');node.id='accountGoldReward';node.className='rb-desc';box.insertBefore(node,box.querySelector('.rb-btn'));}node.textContent='金币 +'+result.goldAwarded;node.dataset.matchId=result.receipt.matchId;
 }
 function createMatchBridge(options){
  var crypt=options.crypto,profile=Promise.resolve(options.profile),local=new WeakMap(),remote=new Map(),active=null;
  function onlineId(meta){if(!meta.roomId||meta.seed===undefined)throw Error('联机开局信息缺失，未发券');return crypt.subtle.digest('SHA-256',new TextEncoder().encode('rujuzhe-match-v1:'+meta.roomId+':'+meta.seed)).then(function(b){return 'online:'+Array.from(new Uint8Array(b),function(x){return x.toString(16).padStart(2,'0');}).join('');});}
  function schedule(ctx){var run=function(){return ctx.id.then(function(id){return profile.then(async function(store){await store.beginMatch(id,ctx.mode);if(ctx.outcome&&ctx.matchEnd)await ctx.matchEnd();return ctx.outcome?store.settleMatch(id,ctx.outcome):{begun:true,matchId:id};});});};var job=ctx.queue.then(run,run);ctx.queue=job.then(function(){},function(){});return job;}
  function complete(outcome){if(!active)return Promise.resolve({ignored:true});if(active.outcome&&active.outcome!==outcome)return Promise.reject(Error('同一局的领奖结果冲突'));active.outcome=outcome;return schedule(active);}
  return Object.freeze({
   observe:function(state,meta){if(!state||typeof state!=='object')return Promise.resolve({ignored:true});meta=meta||{};if(meta.friendly){active=null;return Promise.resolve({ignored:true,mode:'friendly',awardedTickets:0,goldAwarded:0});}var key=meta.matchId||(meta.online?meta.roomId+':'+meta.seed:null),ctx=(meta.online||meta.matchId)?remote.get(key):local.get(state),created=false;
    if(!ctx){ctx={id:meta.matchId?Promise.resolve(meta.matchId):meta.online?onlineId(meta):Promise.resolve('match:'+crypt.randomUUID()),mode:meta.sandbox?'sandbox':(meta.online||meta.matchId)?'online':'pve',queue:Promise.resolve(),outcome:null,matchEnd:meta.matchEnd};if(meta.online||meta.matchId)remote.set(key,ctx);else local.set(state,ctx);created=true;}active=ctx;
    if(meta.over&&(meta.winner==='p1'||meta.winner==='p2'))return complete(meta.winner==='p1'?'win':'loss');return created?schedule(ctx):ctx.queue;
   },finish:function(win){return complete(win?'win':'loss');},abandon:function(){if(active&&active.outcome)return active.queue;return complete('abandoned');},retry:function(){return active?schedule(active):Promise.resolve({ignored:true});}
  });
 }
 // 页面模块的环境契约：需要真实Document所属window及已安装的卡包容器；纯引擎运行时不启动页面I/O。
 function isPageReady(){return typeof document!=='undefined'&&!!document.defaultView&&document.defaultView.document===document&&!!document.getElementById('packScreen');}
 var instance=null,booting=null,foundation=null;
 function getFoundation(options){
  if(foundation)return foundation;options=options||{};
  foundation=(async function(){var load=async function(url){var r=await fetch(url);if(!r.ok)throw Error('收藏数据加载失败：'+url);return r.json();};var data=await Promise.all([load('data/collection-catalog.json'),load('data/pack-rules.json'),load('data/cards.json?v=40')]);if(!options.economy)await dependencies(options.document||document);var guest=options.profile||await RJProfile.createStore({catalog:data[0],rules:data[1]});return {data:data,profile:options.economy||RJEconomy.create({guest:guest,account:RJAccount.client()})};})().catch(function(e){foundation=null;throw e;});return foundation;
 }
 function getEconomy(options){return getFoundation(options).then(function(value){return value.profile;});}
 function boot(options){
  if(booting)return booting;options=options||{};var cleanup=null;
  booting=(async function(){
   var doc=options.document||document,host=doc.getElementById('packScreen'),collectionHost=doc.getElementById('collectionScreen');if(!host||!collectionHost)throw Error('卡包与收藏容器未就绪');
   var base=await getFoundation(options),data=base.data,profile=base.profile,starting=profile.initialize().catch(function(e){return {error:e};});
   if(!profile.getState||profile.getState().mode==='guest')await starting;
   var collection=RJCollection.create({profile:Object.assign({},profile,{collectionAction:function(){if(readOnly())return Promise.reject(Error('当前为只读收藏，请重试连接'));return profile.collectionAction.apply(profile,arguments);}}),cards:data[2]}),controller=createController(profile),rules=profile.getRules(),poolConfig={version:1,allowedCounts:rules.allowedCounts,pools:Object.fromEntries(['character','item'].map(function(id){return [id,rules.pools[id]];}))},poolsLoading=!!(profile.getState&&profile.getState().mode==='account'),selectedPool='character';
   function readOnly(){var state=profile.getState&&profile.getState();return !!(state&&state.mode==='account'&&(state.phase!=='ready'||poolsLoading||poolConfig.error));}
   function el(tag,cls,text){var n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
   function button(text,fn,cls){var n=el('button',cls,text);n.type='button';n.addEventListener('click',fn);return n;}
   var root=el('section','rjc-root'),header=el('header','rjc-header'),title=el('h2','','卡包与收藏'),balance=el('p','rjc-balance'),body=el('div','rjc-pack-body'),status=el('p','rjc-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   header.append(title,balance,button('返回主菜单',function(){showScreen('mainMenu');}));root.append(header,status,body);var skeleton=doc.getElementById('packBootstrapSkeleton');if(skeleton)skeleton.remove();host.appendChild(root);
   var busy=false,animationTimer=null,preloadFrame=null,preloadImages=[],destroyed=false,unsubscribe=null,hadCollection=collectionHost.querySelector('.rjc-root');
   cleanup=function(){destroyed=true;stopAnimation();if(unsubscribe)unsubscribe();globalThis.removeEventListener('storage',storageChanged);if(collectionUI)collectionUI.destroy();else if(!hadCollection){var partial=collectionHost.querySelector('.rjc-root');if(partial)partial.remove();}root.remove();};
   var collectionUI=RJCollectionUI.mount({container:collectionHost,collection:collection,onClose:function(){showScreen('packScreen');render();}});
   function updateBalance(){var menu=doc.getElementById('packTicketCount'),p;try{p=profile.getSnapshot();}catch(e){balance.textContent='暂无法读取';if(menu)menu.textContent='暂无法读取';status.textContent='暂无法读取：'+e.message;if(collectionUI)collectionUI.element.hidden=true;return null;}balance.textContent='抽卡券：'+p.tickets+' · 星尘：'+p.dust;if(menu)menu.textContent='抽卡券 '+p.tickets+(p.pendingReveal?' · 有待展示结果':'');return p;}
   async function retry(){if(busy)return;busy=true;try{await profile.initialize(true);poolConfig=await profile.getPools();poolsLoading=false;}catch(e){report(e);}finally{busy=false;render();}}
   function recovery(){if(profile.getState&&profile.getState().mode==='account')body.append(button('重试连接',retry),button('登出',async function(){try{await profile.logout();render();}catch(e){report(e);}}));}
   function report(e){console.error('收藏操作未完成',e);status.textContent=e.message;var menu=doc.getElementById('packTicketCount');if(menu)menu.textContent='收藏保存未完成，打开后可重试';}
   var bridge=createMatchBridge({profile:profile,crypto:globalThis.crypto});
   function rates(weights){var total=Object.values(weights).reduce(function(a,b){return a+b;},0);return Object.entries(weights).map(function(pair){return pair[0]+' '+(pair[1]/total*100).toFixed(0)+'%';}).join(' / ');}
   function stopAnimation(){if(animationTimer!==null){clearTimeout(animationTimer);animationTimer=null;}if(preloadFrame!==null){cancelAnimationFrame(preloadFrame);preloadFrame=null;}preloadImages=[];}
   function preload(result){var cards=result.cards.slice(0,10),i=0;function frame(){preloadFrame=null;if(destroyed)return;for(var n=0;n<2&&i<cards.length;n++,i++){var card=collection.getCard(cards[i].cardId),image=doc.createElement('img');image.decoding='async';image.src=card.source.image_url||card.source.avatar_url||'';preloadImages.push(image);}if(i<cards.length)preloadFrame=requestAnimationFrame(frame);}preloadFrame=requestAnimationFrame(frame);}
   function showResults(result){
    stopAnimation();if(body.dataset.resultId===result.resultId&&body.querySelector('.rjc-pack-results')){var existing=body.querySelector('[data-action=confirm-reveal]');if(existing)existing.disabled=readOnly();updateBalance();return;}body.dataset.resultId=result.resultId;body.replaceChildren();title.textContent='开包结果';body.appendChild(el('p','rjc-note','结果已保存并加入仓库。重复卡仅标记，不会自动分解。'));
    var totals={UR:0,SR:0,R:0,N:0},duplicates=0;result.cards.forEach(function(c){totals[c.rarity]++;if(c.duplicate)duplicates++;});body.appendChild(el('p','rjc-summary',(result.cards.length/5)+'包 · '+result.cards.length+'张 · '+Object.entries(totals).map(function(pair){return pair[0]+' '+pair[1];}).join(' / ')+' · 重复 '+duplicates+'张'));
    var grid=el('div','rjc-grid rjc-pack-results'),fragment=doc.createDocumentFragment();result.cards.forEach(function(entry,index){var c=collection.getCard(entry.cardId),cell=el('article','rjc-card');cell.dataset.cardId=c.id;var image=el('img');image.loading=index<5?'eager':'lazy';image.decoding='async';image.width=663;image.height=974;image.addEventListener('error',function(){image.style.visibility='hidden';cell.dataset.imageError='true';});image.src=c.source.image_url||c.source.avatar_url||'';image.alt=c.name;image.className='rjc-result-image';cell.append(image,el('h3','rjc-card-name',c.name));var badge=el('span','rjc-rarity',entry.rarity);badge.dataset.rarity=entry.rarity;cell.append(badge,el('span','rjc-count',entry.duplicate?'重复':'新收藏'));fragment.appendChild(cell);});grid.appendChild(fragment);body.appendChild(grid);
    var confirm=button('确认结果，返回卡包',async function(){if(busy)return;busy=true;confirm.disabled=true;try{await controller.confirm(result.resultId);busy=false;render();}catch(e){busy=false;confirm.disabled=false;report(e);}},'rjc-primary');confirm.dataset.action='confirm-reveal';body.appendChild(confirm);confirm.disabled=readOnly();recovery();updateBalance();
   }
   function animate(result){
    delete body.dataset.resultId;body.replaceChildren();title.textContent='正在开包';var stage=el('div','rjc-pack-animation','✦'),skip=button('跳过动画',function(){showResults(result);},'rjc-primary');body.append(stage,el('p','rjc-note','卡包结果已保存'),skip);preload(result);
    if(globalThis.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches)showResults(result);else animationTimer=setTimeout(function(){animationTimer=null;showResults(result);},1600);
   }
   function render(){
    if(destroyed)return;stopAnimation();status.textContent='';var p=updateBalance(),pending=p&&controller.resume();if(pending){showResults(pending);return;}delete body.dataset.resultId;title.textContent='卡包与收藏';body.replaceChildren();recovery();if(!p)return;
    if(readOnly())status.textContent=poolConfig.error?'本地规则仅供只读显示：'+poolConfig.error.message:'账号缓存只读，请重试连接或登出';
    var pool=poolConfig.pools[selectedPool],tabs=el('div','rjc-tabs');for(var id of Object.keys(poolConfig.pools)){(function(id){var tab=button(poolConfig.pools[id].name,function(){if(!busy){selectedPool=id;render();}});tab.dataset.pool=id;tab.setAttribute('aria-pressed',String(id===selectedPool));tabs.appendChild(tab);})(id);}body.appendChild(tabs);
    body.appendChild(el('p','rjc-note',(selectedPool==='character'?'角色、攻击卡、技能卡':'单次道具、永续道具')+' · '+pool.cardCount+'张；公共卡不入包。'));
    body.appendChild(el('p','rjc-note','每包 '+pool.cardsPerPack+' 张，消耗 '+pool.ticketCost+' 张抽卡券。只用于收藏，所有卡仍可编组。'));
    var probabilities=el('section','rjc-probabilities');probabilities.append(el('h3','','完整概率'),el('p','','普通槽（前'+pool.ordinarySlots+'张）：'+rates(pool.ordinaryWeights)),el('p','','保证槽（第'+pool.guaranteedSlot.position+'张）：'+rates(pool.guaranteedSlot.weights)),el('p','','保底：连续'+pool.pity.afterMisses+'包无'+pool.pity.rarity+'后，下一包必有'+pool.pity.rarity+'；任意位置抽到即归零。'),el('p','','同稀有度内均匀抽取；公共卡不入包。'));
    body.append(probabilities,el('p','rjc-pity','共享保底计数（兼容旧字段）：连续未出'+pool.pity.rarity+' '+p.pity.standard.packsWithoutUR+' / '+pool.pity.afterMisses));
    var opens=el('div','rjc-actions rjc-pack-opens');poolConfig.allowedCounts.forEach(function(count){var open=button('开'+count+'包 · '+(count*pool.ticketCost)+'券',async function(){if(busy)return;busy=true;opens.querySelectorAll('button').forEach(function(b){b.disabled=true;});body.setAttribute('aria-busy','true');status.textContent='⏳ 正在保存整批卡包…';try{var saved=await controller.openPack(selectedPool,count);busy=false;body.setAttribute('aria-busy','false');status.textContent='';updateBalance();animate(saved);}catch(e){busy=false;body.setAttribute('aria-busy','false');if(e.code==='PACK_PENDING'){showResults(controller.resume());}else{render();report(e);}}},'rjc-primary');open.dataset.action='open-pack';open.dataset.count=count;open.disabled=readOnly()||p.tickets<count*pool.ticketCost;opens.appendChild(open);});body.appendChild(opens);
    var actions=el('div','rjc-actions');actions.append(button('仓库 / 图鉴 / 合成',function(){collectionUI.show('warehouse');showScreen('collectionScreen');}),button('重试保存对局奖励',function(){bridge.retry().then(function(){render();},report);}));body.appendChild(actions);if(readOnly())actions.lastChild.disabled=true;
    body.appendChild(el('p','rjc-note','每日登录福利请到主菜单“活动”领取。北京时间每日：前'+rules.economy.participationDailyCap+'局正常完成每局'+rules.economy.participationTickets+'券；首胜额外'+rules.economy.firstWinTickets+'券。活动与对局奖励独立。沙盒和直接退出不发对局券。'));
   }
   function rewardView(job){var state=typeof battleState==='undefined'?null:battleState;job.then(function(value){updateBalance();if(moduleURL&&(typeof battleState==='undefined'||battleState===state))displayGoldReward(doc,value);},report);}
   var api={open:async function(){if(doc.getElementById('battleScreen')&&doc.getElementById('battleScreen').classList.contains('active'))throw Error('战斗期间不能打开卡包');showScreen('packScreen');render();await starting;await poolsStarting;render();},observeBattle:function(state,meta){rewardView(bridge.observe(state,meta));},finishBattle:function(win){rewardView(bridge.finish(win));},abandonBattle:function(){rewardView(bridge.abandon());},profile:profile,controller:controller,bridge:bridge,render:render};
   unsubscribe=profile.subscribe(function(){if(!busy){updateBalance();if(host.classList.contains('active'))render();}});
   function storageChanged(event){if(event.key==='rujuzhe_account_active'){profile.syncSelection().catch(report);return;}if((event.key==='rujuzhe_profile'||event.key&&event.key.startsWith('rujuzhe_account_cache_'))&&!busy){try{updateBalance();if(host.classList.contains('active'))render();}catch(e){report(e);}}}globalThis.addEventListener('storage',storageChanged);
   render();instance=api;var poolsStarting=profile.getPools().then(function(value){if(!destroyed){poolConfig=value;poolsLoading=false;render();}});starting.then(function(value){if(!destroyed){render();if(value&&value.error)report(value.error);}});if(moduleURL&&doc.getElementById('eventsScreen'))loadEvents(doc).catch(function(e){var n=doc.getElementById('mailUnclaimedCount');if(n)n.textContent=e.message;console.error('活动邮件界面未加载',e);});return api;
  })().catch(function(e){if(cleanup)cleanup();booting=null;var n=typeof document!=='undefined'&&document.getElementById('packTicketCount');if(n)n.textContent='暂无法读取，点击重试';throw e;});return booting;
 }
 function ready(action){if(!isPageReady())return Promise.resolve({ignored:true});return boot().then(action).catch(function(e){console.error('卡包操作失败',e);var n=typeof document!=='undefined'&&document.getElementById('packTicketCount');if(n)n.textContent=e.message;});}
 // 只读桥接按事件顺序消费；开局上下文在当前事件结束后即捕获，不等档案网络加载。
 var bridgeEvents=Promise.resolve();
 function bridgeEvent(action){if(!isPageReady())return Promise.resolve({ignored:true});var job=bridgeEvents.then(function(){return boot().then(action);});bridgeEvents=job.catch(function(e){console.error('对局领奖桥接未完成',e);});return bridgeEvents;}
 return Object.freeze({createController:createController,createMatchBridge:createMatchBridge,displayGoldReward:displayGoldReward,isPageReady:isPageReady,getEconomy:getEconomy,boot:boot,openShop:function(){return loadShop(document).then(function(app){return app.open();});},openEvents:function(kind){return loadEvents(document).then(function(app){return app.open(kind);});},enterBattle:function(getContext){var context=Promise.resolve().then(function(){var c=getContext();if(c.meta&&c.meta.online&&typeof Online!=='undefined'&&Online.mode==='friendly')c.meta=Object.assign({},c.meta,{friendly:true});if(typeof RJMatchmaking!=='undefined'){var match=RJMatchmaking.context();if(match)c.meta=Object.assign({},c.meta,match);}return c;});return bridgeEvent(function(app){return context.then(function(c){app.observeBattle(c.state,c.meta);});});},open:function(){if(isPageReady()&&!document.getElementById('battleScreen').classList.contains('active')){showScreen('packScreen');var host=document.getElementById('packScreen');if(!host.querySelector('.rjc-root')&&!document.getElementById('packBootstrapSkeleton')){var skeleton=document.createElement('p');skeleton.id='packBootstrapSkeleton';skeleton.setAttribute('role','status');skeleton.textContent='正在读取卡包，可稍后重试…';host.appendChild(skeleton);}}return ready(function(app){return app.open();});},observeBattle:function(state,meta){return ready(function(app){app.observeBattle(state,meta);});},finishBattle:function(win){return bridgeEvent(function(app){app.finishBattle(win);});},abandonBattle:function(){return bridgeEvent(function(app){app.abandonBattle();});}});
});
