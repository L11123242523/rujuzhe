/* v568：好友与休闲入口；登录身份、心跳和邀请只保存在内存。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else{root.RJFriends=factory();var start=function(){root.RJFriends.boot().catch(function(e){console.error('好友初始化失败',e);});};if(document.readyState==='loading')addEventListener('DOMContentLoaded',start,{once:true});else start();}})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 var owner=null,epoch=0,timer=null,working=null,store=null,starting=null,invites=[],notice='',page='casual',busy=false,friendClient=null;
 function element(tag,text,cls){var n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 function button(text,action){var n=element('button',text);n.type='button';n.onclick=function(){run(action);};return n;}
 function client(){if(!friendClient)friendClient=RJAccount.create({baseUrl:RJAccount.client().baseUrl});return friendClient;}
 function report(e){notice=e.message;var n=document.getElementById('friendsStatus');if(n)n.textContent=notice;if(typeof showToast==='function')showToast(notice,'warn');}
 async function run(action){if(busy)return;busy=true;try{await action();}catch(e){report(e);}finally{busy=false;}}
 function active(){return !!(Online.connected||Online.active||Online._entryPending||(Online.ws&&Online.ws.readyState<2));}
 function check(token,id){if(epoch!==token||owner!==id)throw Error('账号已切换，请重新打开好友页');}
 function sync(){var state=store.getState(),id=state.mode==='account'&&state.phase!=='expired'?state.accountId:null;if(id===owner)return;if(owner&&Online.mode==='friendly')Online.leave();epoch++;owner=id;invites=[];working=null;if(timer)clearInterval(timer);timer=null;renderInvites();if(owner){poll().catch(report);timer=setInterval(function(){poll().catch(report);},30000);}else if(page==='friends')renderLogin();}
 async function boot(){if(starting)return starting;starting=(async function(){store=await RJPackApp.getEconomy();store.subscribe(sync);sync();return store;})().catch(function(e){starting=null;throw e;});return starting;}
 async function requireAccount(){await boot();sync();if(!owner){showScreen('mainMenu');openAccountDialog();throw Error('好友对战需要登录账号');}return owner;}
 async function poll(){if(!owner)return;if(working)return working;var token=epoch,id=owner;
  var job=(async function(){try{await client().request('/friends/heartbeat','POST',{});check(token,id);await refresh();}catch(e){if(token===epoch&&id===owner)throw e;}finally{if(working===job)working=null;}})();working=job;return job;
 }
 async function refresh(){if(!owner)return;var token=epoch,id=owner,value=await client().request('/friends/invites');check(token,id);invites=value.invites;renderInvites();if(page==='friends'&&document.getElementById('casualScreen').classList.contains('active'))await renderFriends();}
 function renderLogin(){var n=document.getElementById('friendsBody');if(!n)return;n.replaceChildren(element('p','登录后可以添加好友并邀请对战。'),button('登录账号',function(){showScreen('mainMenu');openAccountDialog();}));}
 function renderInvites(){var n=document.getElementById('friendInviteNotice');if(!n)return;n.replaceChildren();n.hidden=!owner||!invites.length;if(n.hidden)return;var v=invites[0];n.append(element('b',(v.from.displayName||v.from.accountNo)+' 邀请你进行好友战'),element('p','全卡可用 · 无奖励 · 邀请有效 2 分钟'),button('接受并进房',function(){return respondInvite(v.id,true);}),button('拒绝',function(){return respondInvite(v.id,false);}));}
 async function open(){await boot();if(active()&&Online.mode==='friendly'&&document.getElementById('friendRoomStatus')){page='room';showScreen('casualScreen');return;}page='casual';showScreen('casualScreen');renderCasual();}
 function renderCasual(){var host=document.getElementById('friendsBody');host.replaceChildren();document.getElementById('friendsTitle').textContent='休闲对战';document.getElementById('friendsStatus').textContent='单机 AI 与好友共用休闲卡组，全卡可用。';
  host.append(button('单机 AI',function(){if(active())throw Error('请先退出当前房间');return RJCloudDecks.startPve();}),button('好友对战',openFriends),button('休闲卡组',function(){if(active())throw Error('请先退出当前房间');openDeckBuilder('pve');}));
 }
 async function openFriends(){await requireAccount();page='friends';showScreen('casualScreen');await poll();await renderFriends();}
 async function renderFriends(){var token=epoch,id=owner;if(!id){renderLogin();return;}var values=await Promise.all([client().request('/friends'),client().request('/friends/requests')]);check(token,id);if(page!=='friends')return;
  var host=document.getElementById('friendsBody');host.replaceChildren();document.getElementById('friendsTitle').textContent='好友';document.getElementById('friendsStatus').textContent=notice||'按完整账号编号添加好友；在线好友可邀请。';
  var form=element('form'),input=element('input');input.id='friendAccountNo';input.placeholder='RJ-完整账号编号';input.setAttribute('aria-label','好友账号编号');input.maxLength=67;input.autocomplete='off';var send=element('button','发送好友申请');send.type='submit';form.append(input,send);form.onsubmit=function(e){e.preventDefault();run(async function(){var result=await client().request('/friends/request','POST',{accountNo:input.value.trim()});check(token,id);notice='已向 '+(result.target.displayName||'未命名玩家')+'（'+result.target.accountNo+'）发送申请';await renderFriends();});};host.append(form);
  host.append(button('刷新',refresh),button('返回休闲对战',open));
  function row(user,desc){var n=element('div',undefined,'friend-row'),copy=element('div');copy.append(element('strong',user.displayName||'未命名玩家'),element('small',user.accountNo),element('small',desc));n.append(copy);return n;}
  host.append(element('h3','收到的申请'));values[1].incoming.forEach(function(v){var n=row(v.account,'申请加你为好友');n.append(button('同意',function(){return respondRequest(v.id,true);}),button('拒绝',function(){return respondRequest(v.id,false);}));host.append(n);});if(!values[1].incoming.length)host.append(element('p','暂无收到的申请'));
  host.append(element('h3','发出的申请'));values[1].outgoing.forEach(function(v){host.append(row(v.account,'等待同意'));});if(!values[1].outgoing.length)host.append(element('p','暂无发出的申请'));
  host.append(element('h3','好友 '+values[0].friends.length+'/'+values[0].limit));values[0].friends.forEach(function(v){var n=row(v,(v.online?'● 在线':'○ 离线')),invite=button('邀请进房',function(){return inviteFriend(v.id);});invite.disabled=!v.online||active();n.append(invite);host.append(n);});if(!values[0].friends.length)host.append(element('p','还没有好友，先按账号编号发送申请。'));
 }
 async function respondRequest(id,accept){var token=epoch,user=owner;await client().request('/friends/respond','POST',{requestId:id,accept:accept});check(token,user);notice=accept?'已成为好友':'已拒绝申请';await renderFriends();}
 async function inviteFriend(friendId){await requireAccount();if(active())throw Error('请先退出当前房间');await RJOnlineAccess.friendlyDeck();var token=epoch,id=owner,result=await client().request('/friends/invite','POST',{friendId:friendId});check(token,id);await enterRoom(result.roomCode,'host');}
 async function respondInvite(inviteId,accept){await requireAccount();if(accept&&active())throw Error('请先退出当前房间');var token=epoch,id=owner;if(accept)await RJOnlineAccess.friendlyDeck();var result=await client().request('/friends/invites/respond','POST',{inviteId:inviteId,accept:accept});check(token,id);if(accept)await enterRoom(result.roomCode,'guest');await refresh();}
 async function enterRoom(code,role){page='room';showScreen('casualScreen');document.getElementById('friendsTitle').textContent='好友战 · 全卡 · 无奖励';var host=document.getElementById('friendsBody');host.replaceChildren(element('p','房号 '+code+' · 双方准备后开始'),element('p','本局使用已保存的云端休闲卡组；不发券、不发金币。'));
  var ready=button('准备',function(){Online.ready();});ready.id='friendReadyBtn';ready.disabled=true;host.append(ready,button('退出房间',async function(){Online.leave();await openFriends();}));var status=element('p','正在进入好友房间…');status.id='friendRoomStatus';status.setAttribute('role','status');host.append(status);await RJOnlineAccess.enterFriendly(Online,code,role);
 }
 return Object.freeze({boot:boot,open:open,openFriends:openFriends,refresh:refresh,invite:inviteFriend,respondInvite:respondInvite});
});
