/* C1 手动云档案：拉取只预览，上传和下载均由用户明确点击。 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else {
    root.RJCloud=factory();
    var start=function(){if(root.document.defaultView&&root.document.defaultView.document===root.document&&root.document.getElementById('accountRoot'))root.RJCloud.boot();};
    if(root.document){if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});else start();}
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function canonical(o){if(Array.isArray(o))return '['+o.map(canonical).join(',')+']';if(o&&typeof o==='object')return '{'+Object.keys(o).sort().map(function(k){return JSON.stringify(k)+':'+canonical(o[k]);}).join(',')+'}';return JSON.stringify(o);}
  function issue(code,message){var e=new Error(message);e.code=code;return e;}
  function create(options){
    var account=options.account,remote=null,preview=null,busy=false,disposed=false,cache=null,management=null;
    var crypt=options.crypto||globalThis.crypto;
    async function store(){var p=typeof options.profile==='function'?await options.profile():await options.profile;if(!p)throw Error('本地档案尚未就绪');return p;}
    async function accountCache(){if(cache)return cache;var p=await store();if(p.getAccountCache)cache=p.getAccountCache();else{var me=await account.me();cache=p.createAccountCache(me.account.id);}return cache;}
    async function previewData(data,revision){return (await accountCache()).preview({profileRevision:revision,profile:data});}
    function alive(){if(disposed)throw issue('CLOUD_CLOSED','账号已切换，请重新打开云档案');}
    async function getProfile(){return account.request('/profile');}
    async function putProfile(data,expectedRevision){return account.request('/profile','PUT',{data:data,expectedRevision:expectedRevision});}
    async function pull(){
      var result=await getProfile();alive();
      if(!result||!Number.isSafeInteger(result.revision)||result.revision<0||!Object.hasOwn(result,'data')||(result.data===null)!==(result.revision===0))throw issue('CLOUD_RESPONSE','云档案格式无效，本机档案未更改');
      var next=result.data===null?null:await previewData(result.data,result.revision);alive();
      remote=result;preview=next;
      var p=await store();if(p.getMergeState&&result.data!==null){try{management=await p.getMergeState();}catch(e){management={enabled:false,error:'合并状态读取失败：'+e.message};}}
      return state();
    }
    function state(){return {remote:remote?JSON.parse(JSON.stringify(remote)):null,preview:preview?JSON.parse(JSON.stringify(preview)):null,busy:busy,management:management?JSON.parse(JSON.stringify(management)):null};}
    async function exclusive(action){
      alive();if(busy)throw issue('CLOUD_BUSY','上一项操作尚未完成');busy=true;
      try{return await action();}finally{busy=false;}
    }
    return Object.freeze({
      getProfile:getProfile,putProfile:putProfile,getState:state,getAccountCache:accountCache,pull:function(){return exclusive(pull);},
      previewMerge:function(){return exclusive(async function(){
        if(!remote||!remote.data)throw issue('CLOUD_EMPTY','空云档请先首次迁入');var p=await store();management=await p.getMergeState();alive();
        if(!management.enabled)throw issue('MERGE_DISABLED','游客合并入口已关闭');if(management.merged||management.sourceMerged||management.localMark)throw issue('ALREADY_MERGED','账号或这份游客档已经合并过');
        var pinned=management.pendingMerge,local=pinned?pinned.localProfile:p.getGuestProfile().getSnapshot(),cloud=management.profile;
        if(local.pendingReveal!==null||cloud.pendingReveal!==null)throw issue('PENDING_REVEAL','请先展示并确认双方开包结果');
        return {localProfile:local,expectedRevision:pinned?pinned.expectedRevision:management.profileRevision,cloud:cloud};
      });},
      mergeGuest:function(value){return exclusive(async function(){var p=await store(),result=await p.mergeGuest(value.localProfile,value.expectedRevision);alive();remote={revision:result.profileRevision,data:result.profile,updatedAt:result.profile.updatedAt};management=await p.getMergeState();return result;});},
      recoverMerge:function(){return exclusive(async function(){var p=await store();management=await p.recoverGuestMerge();alive();if(management.merged){remote={revision:management.profileRevision,data:management.profile,updatedAt:management.profile.updatedAt};}return management;});},
      updateDisplayName:async function(value){return (await store()).updateDisplayName(value);},
      exportAccount:async function(){return (await store()).exportAccount();},
      deleteAccount:async function(word){return (await store()).deleteAccount(word);},
      upload:function(){return exclusive(async function(){
        if(!remote)throw issue('CLOUD_CHOICE','请先读取云档案并选择操作');
        if(remote.data!==null){var managed=issue('CLOUD_MANAGED','已有云档由服务端管理，禁止整档覆盖；请读取、下载或保留本机');managed.status=409;throw managed;}
        var p=await store(),local=p.getGuestProfile?p.getGuestProfile():p,data=local.getSnapshot(),expected=remote.revision;
        try{
          var saved=await putProfile(data,expected);alive();
          if(!Number.isSafeInteger(saved.revision)||saved.revision!==expected+1)throw issue('CLOUD_RESPONSE','上传响应版本无效，请重新读取云档案');
          remote={revision:saved.revision,data:data,updatedAt:saved.updatedAt};preview=await previewData(data,saved.revision);alive();
          if(p.activateCloud)await p.activateCloud({profileRevision:saved.revision,profile:data});
          return saved;
        }catch(e){
          if(e.status===409){
            remote=null;preview=null;
            try{await pull();e.message='云档案发生冲突，已刷新云版本；请重新选择，不会自动覆盖';}
            catch(refresh){e.message='云档案发生冲突，刷新失败：'+refresh.message+'。请手动重新读取后选择';}
          }
          throw e;
        }
      });},
      download:function(){return exclusive(async function(){
        if(!remote||!remote.data||!preview)throw issue('CLOUD_CHOICE','没有可下载的云档案，请先读取');
        var p=await store();alive();
        var saved=await (await accountCache()).download(preview.previewId);alive();
        if(p.activateCloud)await p.activateCloud(saved);
        preview=await previewData(remote.data,remote.revision);return saved;
      });},
      keepLocal:function(){alive();return {kept:true};},
      dispose:function(){disposed=true;remote=null;preview=null;}
    });
  }
  function mask(email){var at=String(email||'').lastIndexOf('@');return at<0?'已登录':email.slice(0,Math.min(at,2))+'***'+email.slice(at);}
  function mount(options){
    var doc=options.document||document,host=options.container,account=options.account,profile=options.profile;
    var current=null,controller=null,busy=false,opened=false,email='',code='',notice='',destroyed=false,epoch=0,mergeView=null,deleteView=false,deleteWord='',nameValue='';
    function el(tag,text){var n=doc.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
    var style=el('style');
    style.textContent='#accountRoot .rja-overlay[hidden]{display:none!important}#accountRoot .rja-overlay{position:fixed;inset:0;z-index:10000;background:#080c18ce;display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box}#accountRoot .rja-dialog{box-sizing:border-box;width:min(100%,480px);max-height:calc(100dvh - 24px);overflow:auto;background:#172138;color:#f2f5ff;border:1px solid #627baf;border-radius:16px;padding:18px;font:15px/1.55 sans-serif;overflow-wrap:anywhere}#accountRoot .rja-dialog *{box-sizing:border-box;min-width:0}#accountRoot h2{margin:0 0 12px;font-size:22px}#accountRoot p{white-space:pre-line;margin:10px 0}#accountRoot input{width:100%;padding:12px;margin:6px 0 12px;border:1px solid #6980a8;border-radius:8px;background:#0c1526;color:white;font-size:16px}#accountRoot .rja-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}#accountRoot button{flex:1 1 120px;max-width:100%;white-space:normal;overflow-wrap:anywhere;padding:11px;border:1px solid #6f89b6;border-radius:8px;background:#263d61;color:white;cursor:pointer;font-size:15px}#accountRoot button:disabled{opacity:.55;cursor:wait}#accountRoot .rja-status{color:#ffe5a2}';
    var overlay=el('div');overlay.className='rja-overlay';overlay.hidden=true;
    var box=el('section');box.className='rja-dialog';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','账号与云档案');
    overlay.appendChild(box);host.append(style,overlay);
    function menu(){
      var n=doc.getElementById('accountMenuStatus');if(n)n.textContent=current?mask(current.email):'登录/绑定账号';
    }
    function button(parent,text,action,fn){
      var b=el('button',text);b.type='button';b.dataset.action=action;b.disabled=busy;b.addEventListener('click',fn);parent.appendChild(b);return b;
    }
    async function source(){return typeof profile==='function'?await profile():await profile;}
    async function setAccount(a){
      if(controller)controller.dispose();current=a;mergeView=null;deleteView=false;deleteWord='';nameValue=a?a.displayName||'':'';var p=await source();if(p.connect)p.connect(a);controller=a?create({account:account,profile:profile,crypto:options.crypto}):null;menu();
    }
    function summary(remote){
      if(!remote)return '尚未读取云档案';
      if(remote.data===null)return '云端暂无档案。\n上传本机档案？';
      var p=remote.data,values=Object.values(p.owned);
      return '云版本：'+remote.revision+'\n卡牌：'+values.reduce(function(a,b){return a+b;},0)+' 张（'+values.filter(function(n){return n>0;}).length+' 种）\n抽卡券：'+p.tickets+'\n更新时间：'+new Date(remote.updatedAt).toLocaleString('zh-CN');
    }
    function render(){
      menu();if(!opened||destroyed)return;box.replaceChildren();box.appendChild(el('h2','账号与云档案'));
      if(current){
        box.appendChild(el('p','已登录：'+mask(current.email)));
        var state=controller.getState();box.appendChild(el('p',summary(state.remote)));
        box.appendChild(el('p','账号资产以服务端为准；下载仅更新独立账号缓存。游客档保留，不会自动合并。'));
        var actions=el('div');actions.className='rja-actions';box.appendChild(actions);
        button(actions,'读取云档案','pull',function(){work(function(){return controller.pull();},'已读取云档案，请选择操作');});
        var upload=button(actions,'上传本机','upload',function(){if(doc.defaultView.confirm('首次上传本机档案到空云档？不会合并。'))work(function(){return controller.upload();},'本机档案已首次迁入');});upload.disabled=busy||!state.remote||state.remote.data!==null;
        upload.hidden=!!(state.remote&&state.remote.data!==null);
        var download=button(actions,'下载云端','download',function(){if(doc.defaultView.confirm('下载到独立账号缓存？下载前保留本机备份，游客档不会被覆盖。'))work(function(){return controller.download();},'账号缓存已更新，游客档及备份保留');});download.disabled=busy||!state.remote||!state.remote.data;
        button(actions,'保留本机','keep',function(){controller.keepLocal();close();});
        button(actions,'登出','logout',function(){work(async function(){var p=await source();if(p.logout)await p.logout();else await account.logout();await setAccount(null);},'本地缓存与云端可能不同；已恢复原游客档，未自动合并');});
        if(state.management){
          var m=state.management,merge=button(actions,m.pendingMerge?'重试原合并':'合并游客收藏到当前账号','merge',function(){work(async function(){mergeView=await controller.previewMerge();},'请核对双方收藏，再进行二次确认');});
          merge.disabled=busy||!m.enabled||m.merged||m.sourceMerged||!!m.localMark;
          box.appendChild(el('p',m.error||(!m.enabled?'游客合并入口已关闭':m.merged||m.sourceMerged||m.localMark?'已合并；游客档保留但不可再次合并':'每个账号与每份游客档只能合并一次。')));
          button(actions,'查询合并状态','merge-status',function(){work(async function(){await controller.recoverMerge();mergeView=null;},function(){return controller.getState().management.merged?'已合并；游客档保留但不可再次合并':'未查到已提交记录；待定请求仅能按原参数重试';});});
        }
        if(mergeView){
          var total=function(p){return Object.values(p.owned).reduce(function(a,b){return a+b;},0);};
          box.appendChild(el('p','合并对比\n云端：卡牌 '+total(mergeView.cloud)+' 张 / 券 '+mergeView.cloud.tickets+' / 星尘 '+mergeView.cloud.dust+'\n本机：卡牌 '+total(mergeView.localProfile)+' 张 / 券 '+mergeView.localProfile.tickets+' / 星尘 '+mergeView.localProfile.dust));
          var confirmActions=el('div');confirmActions.className='rja-actions';box.appendChild(confirmActions);
          button(confirmActions,'确认一次性合并','merge-confirm',function(){if(doc.defaultView.confirm('这是一次性合并：卡牌、抽卡券、星尘相加；合并后不能再次合并。游客档会保留。确认合并？'))work(async function(){await controller.mergeGuest(mergeView);mergeView=null;},'已合并；游客档保留但不可再次合并');});
          button(confirmActions,'取消合并','merge-cancel',function(){mergeView=null;render();});
        }
        var manageActions=el('div');manageActions.className='rja-actions';box.appendChild(manageActions);
        var nameLabel=el('label','显示名（1–24个字）'),nameInput=el('input');nameInput.value=nameValue;nameInput.maxLength=24;nameInput.disabled=busy;nameInput.dataset.field='display-name';nameInput.addEventListener('input',function(){nameValue=nameInput.value;});box.append(nameLabel,nameInput);
        button(manageActions,'保存显示名','display-name',function(){work(async function(){var result=await controller.updateDisplayName(nameValue);current=result.account;nameValue=current.displayName;},'显示名已保存');});
        button(manageActions,'导出账号 JSON','account-export',function(){work(async function(){var data=await controller.exportAccount(),url=doc.defaultView.URL.createObjectURL(new doc.defaultView.Blob([JSON.stringify(data,null,2)],{type:'application/json'})),link=el('a');link.href=url;link.download='入局者-账号-'+Date.now()+'.json';link.click();doc.defaultView.URL.revokeObjectURL(url);},'账号档案已导出，不含会话凭据');});
        button(manageActions,'删除账号','account-delete',function(){if(doc.defaultView.confirm('删除当前账号及云端收藏？删除前保留本机账号缓存备份，游客档和旧卡组保留。')){deleteView=true;deleteWord='';render();}});
        if(deleteView){
          var word=el('input');word.placeholder='请输入“删除账号”';word.value=deleteWord;word.dataset.field='delete-word';word.disabled=busy;box.appendChild(word);
          var deleteActions=el('div');deleteActions.className='rja-actions';box.appendChild(deleteActions);
          var destroy=button(deleteActions,'确认永久删除账号','account-delete-confirm',function(){work(async function(){await controller.deleteAccount(deleteWord);await setAccount(null);},'账号已删除并登出；本地缓存与云端可能不同，已恢复原游客档');});destroy.disabled=busy||deleteWord!=='删除账号';
          word.addEventListener('input',function(){deleteWord=word.value;destroy.disabled=busy||deleteWord!=='删除账号';});
        }
      }else{
        var label=el('label','邮箱');label.htmlFor='rjaEmail';var input=el('input');input.id='rjaEmail';input.type='email';input.autocomplete='email';input.value=email;input.disabled=busy;input.addEventListener('input',function(){email=input.value.trim();});box.append(label,input);
        var actions=el('div');actions.className='rja-actions';box.appendChild(actions);
        button(actions,'发送验证码','send',function(){
          if(!input.checkValidity()||!email){notice='请输入有效邮箱';render();return;}
          work(function(){return account.requestCode(email);},'验证码已发送，十分钟内有效');
        });
        var codeLabel=el('label','六位验证码');codeLabel.htmlFor='rjaCode';var codeInput=el('input');codeInput.id='rjaCode';codeInput.inputMode='numeric';codeInput.autocomplete='one-time-code';codeInput.maxLength=6;codeInput.value=code;codeInput.disabled=busy;codeInput.addEventListener('input',function(){code=codeInput.value.trim();});box.append(codeLabel,codeInput);
        var verifyActions=el('div');verifyActions.className='rja-actions';box.appendChild(verifyActions);
        button(verifyActions,'登录/绑定账号','verify',function(){
          if(!email||!/^\d{6}$/.test(code)){notice='请输入邮箱和六位验证码';render();return;}
          work(async function(){var p=await source(),me;if(p.verifyLogin)me=await p.verifyLogin(email,code);else{await account.verify(email,code);me=await account.me();}await setAccount(me.account);await controller.pull();code='';},'登录成功，请选择云档案操作');
        });
        if(account.isLocalDev)box.appendChild(el('p','开发模式：验证码在本地 Worker 日志。'));
        button(verifyActions,'继续游客','guest',function(){work(async function(){var p=await source();if(p.logout)await p.logout();else{try{await account.logout();}catch(e){if(e.status!==401)throw e;}}await setAccount(null);},'本地缓存与云端可能不同；已恢复原游客档，未自动合并');});
      }
      var status=el('p',notice);status.className='rja-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');box.appendChild(status);
      var bottom=el('div');bottom.className='rja-actions';box.appendChild(bottom);button(bottom,'关闭','close',close);
    }
    async function work(fn,success){
      if(busy)return;busy=true;var token=epoch;render();
      try{await fn();if(token===epoch)notice=typeof success==='function'?success():success;}
      catch(e){if(token===epoch)notice=e.message;}
      finally{busy=false;if(token===epoch)render();}
    }
    async function open(){
      if(destroyed||busy)return;
      var main=doc.getElementById('mainMenu');if(!main||!main.classList.contains('active'))return;
      epoch++;opened=true;overlay.hidden=false;notice='';render();
      await work(async function(){try{var me=await account.me();await setAccount(me.account);await controller.pull();}catch(e){if(e.status===401){await setAccount(null);return;}throw e;}},'');
    }
    function close(){if(!opened)return;opened=false;overlay.hidden=true;var n=doc.getElementById('accountMenuButton');if(n)n.focus();}
    overlay.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();close();}});
    async function initialize(){var token=epoch;try{var result=await account.me();if(!destroyed&&token===epoch){await setAccount(result.account);if(token===epoch)await controller.pull();}}catch(e){if(e.status===401&&!destroyed&&token===epoch)await setAccount(null);}}
    menu();initialize();
    return Object.freeze({open:open,close:close,getState:function(){return {loggedIn:!!current,maskedEmail:current?mask(current.email):null,busy:busy,notice:notice,opened:opened};},destroy:function(){destroyed=true;epoch++;if(controller)controller.dispose();host.replaceChildren();}});
  }
  var app=null;
  function boot(){
    if(app)return app;
    var host=document.getElementById('accountRoot');if(!host)return null;
    app=mount({container:host,account:RJAccount.client(),profile:async function(){return (await RJPackApp.boot()).profile;}});
    return app;
  }
  return Object.freeze({create:create,mount:mount,maskEmail:mask,boot:boot,open:function(){var a=boot();return a?a.open():Promise.resolve();},close:function(){if(app)app.close();}});
});
