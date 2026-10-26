/* 商店只显示服务端钱包与价格，领取结果不写入游客档或profile金币字段。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.RJShop=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function mount(options){
  var doc=options.document,economy=options.economy,host=doc.getElementById('shopScreen'),wallet=null,busy=false,opened=false,generation=0,identity='';
  function el(tag,cls,text){var n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  function button(text,fn,action){var b=el('button','',text);b.type='button';b.dataset.action=action;b.addEventListener('click',fn);return b;}
  var root=el('section','rjc-root'),header=el('header','rjc-header'),body=el('div'),status=el('p','rjc-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  header.append(el('h2','','商店'),button('返回主菜单',function(){generation++;opened=false;options.showScreen('mainMenu');},'back'));root.append(header,status,body);host.replaceChildren(root);
  function logged(){var state=economy.getState();return state.mode==='account'&&state.phase!=='expired';}
  function active(){return opened&&host.classList.contains('active');}
  function login(){generation++;opened=false;options.showScreen('mainMenu');options.openAccount();}
  function render(){
   if(!active())return;body.replaceChildren();if(!logged()){body.append(el('p','rjc-note','请先登录账号，游客不能获得金币或购买抽卡券。'),button('登录账号',login,'login'));return;}
   var refreshButton=button('刷新余额',function(){refresh().catch(report);},'refresh');refreshButton.disabled=busy;body.appendChild(refreshButton);
   if(!wallet){body.appendChild(el('p','rjc-note','正在读取钱包与价格…'));return;}
   body.append(el('p','rjc-balance','金币：'+wallet.gold+' · 抽卡券：'+wallet.tickets),el('p','rjc-note','仅完整联机结算奖励金币；商店不限购，价格以服务端为准。'));
   var ready=economy.getState().phase==='ready',actions=el('div','rjc-actions');
   for(var count of [1,5,10]){(function(count){var price=wallet.prices[String(count)],buy=button(count+' 券 · '+price+' 金币',function(){purchase(count);},'buy-tickets');buy.dataset.count=count;buy.disabled=busy||!ready||wallet.gold<price;actions.appendChild(buy);})(count);}body.appendChild(actions);
   if(wallet.gold<wallet.prices['1'])body.appendChild(el('p','rjc-note','金币不足，可在完整联机结算后获得金币。'));
   if(!ready)body.append(el('p','rjc-note','请先在账号界面读取并选择云档案，缓存只读时不能购买。'),button('账号与云档案',login,'account'));
  }
  function report(e){if(active())status.textContent=e.message;}
  async function refresh(){var token=++generation;if(!logged()){wallet=null;render();return;}var value=await economy.getWallet();if(token!==generation)return;wallet=value;render();}
  async function purchase(count){
   if(busy||!logged()||!wallet)return;busy=true;var token=generation;status.textContent='正在购买…';render();
   try{var result=await economy.buyTickets(count);if(token!==generation)return;busy=false;await refresh();if(active()&&generation===token+1)status.textContent=(result.duplicate?'该购买已完成，未重复扣款；':'')+'已获得 '+result.result.count+' 券';}
   catch(e){if(token===generation)report(e);}finally{busy=false;render();}
  }
  var initial=economy.getState();identity=initial.accountId+':'+initial.phase;
  var unsubscribe=economy.subscribe(function(){var state=economy.getState(),key=state.accountId+':'+state.phase;if(identity===key)return;identity=key;generation++;wallet=null;render();if(active()&&logged())refresh().catch(report);});
  function visible(){if(!doc.hidden&&active())refresh().catch(report);}doc.addEventListener('visibilitychange',visible);
  return Object.freeze({open:async function(){opened=true;options.showScreen('shopScreen');status.textContent='';render();try{await economy.initialize();await refresh();}catch(e){report(e);}},destroy:function(){generation++;unsubscribe();doc.removeEventListener('visibilitychange',visible);}});
 }
 var instance=null;
 function boot(){if(!instance)instance=RJPackApp.getEconomy().then(function(economy){return mount({document:document,economy:economy,showScreen:showScreen,openAccount:function(){RJCloud.open();}});}).catch(function(e){instance=null;throw e;});return instance;}
 return Object.freeze({mount:mount,boot:boot,open:function(){return boot().then(function(app){return app.open();});}});
});
