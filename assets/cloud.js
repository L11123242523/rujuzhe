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
    var account=options.account,remote=null,preview=null,busy=false,disposed=false;
    var crypt=options.crypto||globalThis.crypto;
    async function store(){var p=typeof options.profile==='function'?await options.profile():await options.profile;if(!p)throw Error('本地档案尚未就绪');return p;}
    async function previewData(data){
      var p=await store(),bytes=await crypt.subtle.digest('SHA-256',new TextEncoder().encode(canonical(data)));
      var checksum=Array.from(new Uint8Array(bytes),function(n){return n.toString(16).padStart(2,'0');}).join('');
      return p.previewImport(JSON.stringify({format:'rujuzhe-profile',version:1,catalogVersion:p.getCatalog().version,profile:data,checksum:checksum}));
    }
    function alive(){if(disposed)throw issue('CLOUD_CLOSED','账号已切换，请重新打开云档案');}
    async function getProfile(){return account.request('/profile');}
    async function putProfile(data,expectedRevision){return account.request('/profile','PUT',{data:data,expectedRevision:expectedRevision});}
    async function pull(){
      var result=await getProfile();alive();
      if(!result||!Number.isSafeInteger(result.revision)||result.revision<0||!Object.hasOwn(result,'data')||(result.data===null)!==(result.revision===0))throw issue('CLOUD_RESPONSE','云档案格式无效，本机档案未更改');
      var next=result.data===null?null:await previewData(result.data);alive();
      remote=result;preview=next;return state();
    }
    function state(){return {remote:remote?JSON.parse(JSON.stringify(remote)):null,preview:preview?JSON.parse(JSON.stringify(preview)):null,busy:busy};}
    async function exclusive(action){
      alive();if(busy)throw issue('CLOUD_BUSY','上一项操作尚未完成');busy=true;
      try{return await action();}finally{busy=false;}
    }
    return Object.freeze({
      getProfile:getProfile,putProfile:putProfile,getState:state,pull:function(){return exclusive(pull);},
      upload:function(){return exclusive(async function(){
        if(!remote)throw issue('CLOUD_CHOICE','请先读取云档案并选择操作');
        var p=await store(),data=p.getSnapshot(),expected=remote.revision;
        try{
          var saved=await putProfile(data,expected);alive();
          if(!Number.isSafeInteger(saved.revision)||saved.revision!==expected+1)throw issue('CLOUD_RESPONSE','上传响应版本无效，请重新读取云档案');
          remote={revision:saved.revision,data:data,updatedAt:saved.updatedAt};preview=await previewData(data);alive();
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
        var saved=await p.importProfile(preview.previewId,{cloudBackup:true});alive();
        preview=await previewData(remote.data);return saved;
      });},
      keepLocal:function(){alive();return {kept:true};},
      dispose:function(){disposed=true;remote=null;preview=null;}
    });
  }
  function mask(email){var at=String(email||'').lastIndexOf('@');return at<0?'已登录':email.slice(0,Math.min(at,2))+'***'+email.slice(at);}
  function mount(options){
    var doc=options.document||document,host=options.container,account=options.account,profile=options.profile;
    var current=null,controller=null,busy=false,opened=false,email='',code='',notice='',destroyed=false,epoch=0;
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
    function setAccount(a){
      if(controller)controller.dispose();current=a;controller=a?create({account:account,profile:profile,crypto:options.crypto}):null;menu();
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
        box.appendChild(el('p','本机档案即时保存；云端仅在你点击按钮后上传或下载，不会合并。'));
        var actions=el('div');actions.className='rja-actions';box.appendChild(actions);
        button(actions,'读取云档案','pull',function(){work(function(){return controller.pull();},'已读取云档案，请选择操作');});
        var upload=button(actions,'上传本机','upload',function(){if(doc.defaultView.confirm('上传本机档案到云端？将替换所示云版本，不会合并。'))work(function(){return controller.upload();},'本机档案已上传');});upload.disabled=busy||!state.remote;
        var download=button(actions,'下载云端','download',function(){if(doc.defaultView.confirm('下载并替换本机档案？替换前会保留本机备份，不会合并。'))work(function(){return controller.download();},'云档案已下载，本机备份已保留');});download.disabled=busy||!state.remote||!state.remote.data;
        button(actions,'保留本机','keep',function(){controller.keepLocal();close();});
        button(actions,'登出','logout',function(){work(async function(){await account.logout();setAccount(null);},'已登出，本机档案仍保留');});
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
          work(async function(){await account.verify(email,code);var me=await account.me();setAccount(me.account);await controller.pull();code='';},'登录成功，请选择云档案操作');
        });
        if(account.isLocalDev)box.appendChild(el('p','开发模式：验证码在本地 Worker 日志。'));
      }
      var status=el('p',notice);status.className='rja-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');box.appendChild(status);
      var bottom=el('div');bottom.className='rja-actions';box.appendChild(bottom);button(bottom,'关闭','close',close);
    }
    async function work(fn,success){
      if(busy)return;busy=true;var token=epoch;render();
      try{await fn();if(token===epoch)notice=success;}
      catch(e){if(token===epoch)notice=e.message;}
      finally{busy=false;if(token===epoch)render();}
    }
    async function open(){
      if(destroyed||busy)return;
      var main=doc.getElementById('mainMenu');if(!main||!main.classList.contains('active'))return;
      epoch++;opened=true;overlay.hidden=false;notice='';render();
      await work(async function(){try{var me=await account.me();setAccount(me.account);await controller.pull();}catch(e){if(e.status===401){setAccount(null);return;}throw e;}},'');
    }
    function close(){if(!opened)return;opened=false;overlay.hidden=true;var n=doc.getElementById('accountMenuButton');if(n)n.focus();}
    overlay.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();close();}});
    async function initialize(){var token=epoch;try{var result=await account.me();if(!destroyed&&token===epoch)setAccount(result.account);}catch(e){if(e.status===401&&!destroyed&&token===epoch)setAccount(null);}}
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
