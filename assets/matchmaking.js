/* v569：匹配只负责队列、冻结卡组和生命周期，战斗仍由原房主/本地AI执行。 */
(function(root){'use strict';
 var store,client,owner=null,epoch=0,current=null,frozen=null,pending=false,timer=null,polling=null,entering=null,notice='',records=new Map();
 function locked(){return pending||!!(current&&['waiting','pairing','matched','bot'].includes(current.status)&&!current.finishedAt);}
 function transport(){return client||(client=RJAccount.create({baseUrl:RJAccount.client().baseUrl}));}
 function report(e){notice=e.message;render();if(typeof showToast==='function')showToast(e.message,'warn');}
 function check(e,id){if(e!==epoch||id!==owner)throw Error('匹配账号已切换，请重新进入');}
 async function boot(){if(store)return store;store=await RJPackApp.getEconomy();store.subscribe(sync);sync();return store;}
 function sync(){var s=store.getState(),id=s.mode==='account'&&s.phase!=='expired'?s.accountId:null;if(id===owner)return;epoch++;owner=id;current=null;frozen=null;pending=false;entering=null;if(timer)clearInterval(timer);timer=null;if(Online.mode==='matched')Online.leave();render();}
 function node(tag,text){var n=document.createElement(tag);if(text)n.textContent=text;return n;}
 function button(text,fn,disabled){var b=node('button',text);b.type='button';b.disabled=!!disabled;b.onclick=function(){Promise.resolve().then(fn).catch(report);};return b;}
 function render(){var host=document.getElementById('matchmakingBody');if(!host)return;host.replaceChildren();var s=current;
  host.append(node('p',notice||(!owner?'登录后使用已保存的云端匹配卡组。':!s||!locked()?'匹配前可换卡组；入队后锁定，真人与人机奖励相同。':s.status==='waiting'?'正在寻找对手… 已等待 '+Math.max(0,Math.floor((Date.now()-s.queuedAt)/1000))+' 秒':s.status==='pairing'?'已找到对手，正在创建房间…':s.status==='bot'?'暂无真人，进入人机练习':'已匹配 '+(s.opponent?s.opponent.displayName+'（'+s.opponent.accountNo+'）':'真人')+' · 自动准备中')));
  host.append(button('开始匹配',enqueue,locked()||!owner),button('选择匹配卡组',function(){if(locked())throw Error('匹配中不能打开或切换卡组');openDeckBuilder('online');},locked()));
  if(s&&['waiting','pairing'].includes(s.status))host.append(button('取消匹配',cancel,pending));
  if(s&&s.status==='canceled')host.append(node('p','本局已取消，无奖励。'));
  if(s&&s.status==='matched')host.append(node('p','随机房主先手 · 房号 '+s.roomCode+' · 30秒内未开局则取消'));
 }
 async function deckSnapshot(){await RJOnlineAccess.gate();var cloud=await RJCloudDecks.boot();if(cloud.state().accountId!==owner||cloud.state().phase!=='ready')throw Error('请先读取并保存云端匹配卡组');
  if(!locked())enterOnlineDeckMode();var errors=validateDeck('p1');if(errors.length)throw Error('匹配卡组不合法：'+errors.join('、'));
  var lib=RJOnlineDeck.create(store.getCatalog()),cfg=lib.bind(deckConfig.p1),cards=lib.fromCfg(cfg,true),hash=await lib.hash(cards),saved=(await transport().request('/decks')).decks.match.data;
  if(!saved||await lib.hash([].concat(saved.chars,saved.items,saved.carries))!==hash)throw Error('匹配草稿尚未保存，请先保存云端match卡组');
  return {cfg:JSON.parse(JSON.stringify(cfg)),data:saved,hash:hash};
 }
 async function restoreDeck(){var saved=(await transport().request('/decks')).decks.match.data,cloud=await RJCloudDecks.boot(),cfg=cloud.codec.decode(saved,allCards),lib=RJOnlineDeck.create(store.getCatalog());
  if(await lib.hash(lib.fromCfg(cfg,true))!==current.deckHash)throw Error('锁定卡组与云端卡组不一致，不能开局');return {cfg:cfg,data:saved,hash:current.deckHash};
 }
 async function open(){await boot();if(!owner){openAccountDialog();throw Error('匹配对战需要登录账号');}showScreen('matchmakingScreen');notice='';await poll();render();}
 function watch(){if(!timer)timer=setInterval(function(){poll().catch(report);},1000);}
 async function enqueue(){await boot();if(locked())return;if(Online.connected||Online.active||Online._entryPending)throw Error('请先退出当前房间');var e=epoch,id=owner;frozen=await deckSnapshot();check(e,id);pending=true;notice='';render();
  try{var value=await transport().request('/match/queue','POST',{deck:frozen.data,deckHash:frozen.hash});check(e,id);current=value;watch();await advance();}
  finally{if(e===epoch){pending=false;render();}}
 }
 async function poll(){if(!owner||pending)return;if(polling)return polling;var e=epoch,id=owner;
  var job=(async function(){try{var value=await transport().request('/match/status');check(e,id);var r=records.get(value.matchId);if(value.status==='finished'&&r)r.resolve();if(r&&r.ended&&value.status==='matched')value={...value,status:'finished',finishedAt:Date.now()};current=value;if(locked()){if(!(value.status==='matched'&&value.startedAt))watch();await advance();}else if(timer){clearInterval(timer);timer=null;}render();}finally{if(polling===job)polling=null;}})();polling=job;return job;
 }
 async function cancel(){if(pending||!current)return;var e=epoch,id=owner;pending=true;try{var v=await transport().request('/match/cancel','POST',{queueId:current.queueId});check(e,id);current=v;notice='已取消匹配，无奖励。';}finally{if(e===epoch){pending=false;render();}}}
 function record(s){if(records.has(s.matchId))return records.get(s.matchId);var resolve;var r={...s,ended:false,signal:new Promise(function(done){resolve=done;}),resolve:function(){r.ended=true;resolve();}};records.set(s.matchId,r);return r;}
 async function advance(){var s=current;if(!s)return;if(s.status==='canceled'){if(Online.mode==='matched')Online.leave();entering=null;return;}
  if(!['matched','bot'].includes(s.status)||entering===s.queueId)return;entering=s.queueId;
  try{if(!frozen||frozen.hash!==s.deckHash)frozen=await restoreDeck();var r=record(s);deckConfig.p1=JSON.parse(JSON.stringify(frozen.cfg));deckSetMode='online';
   if(s.status==='matched'){await RJOnlineAccess.enterMatched(Online,s,frozen.cfg);return;}
   var bot=buildSmartDeck(ARCH_LIST[Math.floor(Math.random()*ARCH_LIST.length)]);deckConfig.p2={chars:__cloneDeckSlots(bot.chars,3),items:__cloneDeckSlots(bot.items,8),carries:__cloneDeckSlots(bot.carries,4)};
   var errors=validateDeck('p2');if(errors.length)throw Error('人机卡组不合法：'+errors.join('、'));
   current=await transport().request('/match/progress','POST',{queueId:s.queueId,action:'start'});r.startedAt=current.startedAt;startingBot=true;try{startBattle();}finally{startingBot=false;}
  }catch(e){entering=null;throw e;}
 }
 var startingBot=false;
 function context(){if(!current||!current.matchId||!['matched','bot'].includes(current.status))return null;var r=record(current);return {matchId:r.matchId,matchEnd:function(){return finish(r);}};}
 async function finish(r){if(r.mode==='matched_bot'&&!r.ended){if(!r.finishing)r.finishing=transport().request('/match/progress','POST',{queueId:r.queueId,action:'end'}).then(function(v){r.resolve();if(current&&current.queueId===r.queueId)current=v;render();}).catch(function(e){r.finishing=null;throw e;});await r.finishing;}else await r.signal;return {ended:true};}
 function relayEnded(id){var r=records.get(id);if(!r||r.mode!=='matched_real')return;r.resolve();if(current&&current.matchId===id){current={...current,status:'finished',finishedAt:Date.now()};if(timer)clearInterval(timer);timer=null;}render();}
 function status(text){var n=document.getElementById('matchmakingRoomStatus');if(n)n.textContent=text;}
 function started(id){if(current&&current.matchId===id&&timer){clearInterval(timer);timer=null;}}
 function left(){if(current&&current.status==='matched')watch();}
 root.RJMatchmaking=Object.freeze({boot:boot,open:open,enqueue:enqueue,cancel:cancel,poll:poll,locked:locked,context:context,relayEnded:relayEnded,started:started,left:left,status:status,startingBot:function(){return startingBot;},state:function(){return current?{...current}:null;}});
})(globalThis);
