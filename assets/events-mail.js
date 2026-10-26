/* 活动和邮箱只读取登录账号；领取成功后接收服务端快照，不保存本地领取标记。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else{root.RJEventsMail=factory();if(root.document){var start=function(){if(document.getElementById('eventsScreen'))root.RJEventsMail.boot().catch(function(e){var n=document.getElementById('mailUnclaimedCount');if(n)n.textContent=e.message;});};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();}}})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function mount(options){
  var doc=options.document,economy=options.economy,show=options.showScreen,opened=null,batch=null,busy=false,generation=0,ownerKey='',events=null,mails=null;
  var badge=doc.getElementById('mailUnclaimedCount'),views={};
  function el(tag,cls,text){var n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,fn,action){var n=el('button','',text);n.type='button';if(action)n.dataset.action=action;n.addEventListener('click',fn);return n;}
  for(var kind of ['events','mail']){
   var host=doc.getElementById(kind+'Screen'),root=el('section','rjc-root'),header=el('header','rjc-header'),body=el('div'),status=el('p','rjc-status');
   status.setAttribute('role','status');status.setAttribute('aria-live','polite');
   header.append(el('h2','',kind==='events'?'活动':'邮件'),button('返回主菜单',function(){generation++;opened=null;show('mainMenu');},'back'));
   root.append(header,status,body);host.replaceChildren(root);views[kind]={host:host,body:body,status:status};
  }
  function logged(){var s=economy.getState();return s.mode==='account'&&s.phase!=='expired';}
  function active(){return opened&&views[opened].host.classList.contains('active');}
  function login(){generation++;opened=null;show('mainMenu');if(options.openAccount)options.openAccount();}
  function balance(body){try{body.appendChild(el('p','rjc-balance','抽卡券：'+economy.getSnapshot().tickets));}catch(e){body.appendChild(el('p','rjc-note','请先在账号界面选择云档案：'+e.message));}}
  function render(){
   if(!active())return;var body=views[opened].body;body.replaceChildren();
   if(!logged()){body.append(el('p','rjc-note',opened==='events'?'登录后参加：请先登录账号':'登录后查看：请先登录账号'),button('登录账号',login,'login'));return;}
   balance(body);var reload=button('刷新',function(){refresh().catch(report);},'refresh');reload.disabled=busy;body.appendChild(reload);
   if(opened==='events'){
    if(!events){body.appendChild(el('p','rjc-note','正在读取活动…'));return;}
    body.appendChild(el('p','rjc-note',events.day+' · 北京时间每日零点重置；两个活动各领一次，与对局奖励独立。'));
    var grid=el('div','rjc-event-grid');body.appendChild(grid);
    events.events.forEach(function(event){
     var card=el('article','rjc-event-card'),reward=el('p','rjc-event-reward'),claim=button(event.claimed?'今日已领取':'领取 '+event.tickets+' 券',function(){claimOne('events',event.id);},'claim-event');
     card.dataset.eventId=event.id;reward.append(el('span','','🎟 '),el('strong','',String(event.tickets)),el('span','',' 张抽卡券'));claim.disabled=busy||event.claimed;
     card.append(el('h3','rjc-card-name',event.title),reward,el('p','rjc-note',event.claimed?'今日已领取':'今日可领取'),claim);grid.appendChild(card);
    });
   }else{
    if(!mails){body.appendChild(el('p','rjc-note','正在读取邮件…'));return;}
    var unclaimed=mails.mails.filter(function(mail){return !mail.claimed;}),all=button(batch?'收取中 '+batch.done+'/'+batch.total:'一键领取未领邮件',claimAll,'claim-all-mail');all.className='rjc-claim-all';all.disabled=busy||!unclaimed.length;body.appendChild(all);
    if(!mails.mails.length){body.appendChild(el('p','rjc-note','暂无邮件'));return;}
    mails.mails.forEach(function(mail){var row=el('article','rjc-card'),claim=button(mail.claimed?'已领取':'领取 1 券',function(){claimOne('mail',mail.id);},'claim-mail');row.dataset.mailId=mail.id;claim.disabled=busy||mail.claimed;row.append(el('h3','rjc-card-name',mail.subject),el('p','rjc-effect',mail.body),el('p','rjc-note',mail.id+' · 1 张抽卡券 · 不过期'),claim);body.appendChild(row);});
   }
  }
  function report(error){if(active())views[opened].status.textContent=error.message;}
  function count(){if(badge)badge.textContent=logged()&&mails?'未领取 '+mails.mails.filter(function(m){return !m.claimed;}).length+' 封':logged()?'邮件待刷新':'登录后查看';}
  async function refresh(){
   var token=++generation,kind=opened;if(!logged()){events=null;mails=null;count();render();return;}
   var value=await (kind==='events'?economy.getEvents():economy.getMail());
   if(token!==generation)return;if(kind==='events')events=value;else mails=value;count();render();
  }
  async function claimOne(kind,id){
   if(busy||!active()||!logged())return;busy=true;var token=generation;render();views[kind].status.textContent='正在领取…';
   try{
    var value=await (kind==='events'?economy.claimEvent(id):economy.claimMail(id));
    if(token!==generation)return;
    busy=false;await refresh();if(token+1===generation&&active())views[kind].status.textContent=value.result.duplicate?'已领取，本次未重复加券':'已领取 '+value.result.awardedTickets+' 张抽卡券';
   }catch(e){if(token===generation)report(e);}finally{busy=false;render();}
  }
  async function claimAll(){
   if(busy||!active()||opened!=='mail'||!logged()||!mails)return;
   var pending=mails.mails.filter(function(mail){return !mail.claimed;});if(!pending.length)return;
   var owner=economy.getState().accountId,token=generation,failed=[],done=0;busy=true;batch={done:0,total:pending.length};render();
   function sameOwner(){return logged()&&economy.getState().accountId===owner;}
   try{
    for(var mail of pending){
     if(token!==generation||!sameOwner())break;
     try{await economy.claimMail(mail.id);if(!sameOwner())break;mail.claimed=true;done++;}
     catch(e){if(!sameOwner())break;failed.push(mail.subject+'（'+mail.id+'）：'+e.message);}
     batch.done++;if(token===generation&&active()&&opened==='mail'){count();render();views.mail.status.textContent='正在收取 '+batch.done+'/'+batch.total+' 封…';}
    }
    if(sameOwner()&&active()&&opened==='mail'){
     var finishToken=generation;
     var summary='已成功收取 '+done+' 封'+(failed.length?'；失败 '+failed.length+' 封：'+failed.join('；'):'；全部处理完成');
     try{await refresh();if(finishToken+1===generation&&sameOwner()&&opened==='mail')views.mail.status.textContent=summary;}
     catch(e){if(finishToken+1===generation&&sameOwner()&&opened==='mail')views.mail.status.textContent=summary+'；刷新失败：'+e.message;}
    }
   }finally{batch=null;busy=false;count();render();}
  }
  async function updateIdentity(){
   var state=economy.getState(),key=state.accountId+':'+state.phase;if(key===ownerKey)return;ownerKey=key;var token=++generation;events=null;mails=null;count();render();
   if(!logged())return;
   try{var value=await economy.getMail();if(token!==generation)return;mails=value;count();if(active())await refresh();}catch(e){if(token===generation){if(badge)badge.textContent='邮件读取失败';report(e);}}
  }
  var unsubscribe=economy.subscribe(updateIdentity);
  function visible(){if(!doc.hidden&&active()&&!batch)refresh().catch(report);}doc.addEventListener('visibilitychange',visible);
  updateIdentity();
  return Object.freeze({open:async function(kind){if(!views[kind])throw Error('未知功能页');opened=kind;show(kind+'Screen');views[kind].status.textContent='';render();try{await refresh();}catch(e){report(e);}},destroy:function(){generation++;unsubscribe();doc.removeEventListener('visibilitychange',visible);}});
 }
 var instance=null;
 function boot(){if(!instance)instance=RJPackApp.getEconomy().then(function(economy){return mount({document:document,economy:economy,showScreen:showScreen,openAccount:function(){RJCloud.open();}});}).catch(function(e){instance=null;throw e;});return instance;}
 return Object.freeze({mount:mount,boot:boot,open:function(kind){return boot().then(function(app){return app.open(kind);});}});
});
