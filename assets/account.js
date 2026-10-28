/* C1 账号传输：只依赖 HttpOnly Cookie，不保存会话令牌。 */
(function(root,factory){
  'use strict';
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.RJAccount=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(options){
    options=options||{};
    var base=new URL(options.baseUrl||'https://api.rujuzhe-b-a-gs.top');
    var local=base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname);
    if(base.username||base.password||base.search||base.hash||(!local&&base.protocol!=='https:'))throw Error('账号 API 地址无效');
    var baseUrl=base.href.replace(/\/$/,''),send=options.fetch||globalThis.fetch.bind(globalThis),booting=null,generation=0;
    function invalidateBootstrap(){generation++;booting=null;}
    function bootstrap(sourceProfileId,retry){if(retry)invalidateBootstrap();if(!booting){var token=generation;booting=request('/account/bootstrap'+(sourceProfileId?'?sourceProfileId='+encodeURIComponent(sourceProfileId):'')).then(function(value){if(token!==generation){var e=Error('账号启动快照已失效，请重新读取');e.code='ECONOMY_SESSION_CHANGED';throw e;}return value;});}return booting;}
    async function request(path,method,data){
      var response;
      try{response=await send(baseUrl+path,{method:method||'GET',credentials:'include',cache:'no-store',headers:{Accept:'application/json',...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});}
      catch(cause){var network=new Error('网络连接失败，请稍后重试；本机档案未更改');network.code='ACCOUNT_NETWORK';throw network;}
      var body;try{body=await response.json();}catch(e){var invalid=new Error('账号服务返回了无效数据');invalid.code='ACCOUNT_RESPONSE';throw invalid;}
      if(!response.ok){
        if(response.status===409&&method&&method!=='GET')invalidateBootstrap();
        var error=new Error(response.status===503&&body.error==='AUTH_DISABLED'?'邮件登录未启用':(body.message||'账号操作未完成'));
        error.status=response.status;error.code=body.error||'ACCOUNT_HTTP';error.detail=body;throw error;
      }
      if(method&&method!=='GET')invalidateBootstrap();
      return body;
    }
    return Object.freeze({
      baseUrl:baseUrl,isLocalDev:local,request:request,bootstrap:bootstrap,invalidateBootstrap:invalidateBootstrap,
      requestCode:function(email){return request('/auth/request-code','POST',{email:email});},
      verify:function(email,code){return request('/auth/verify','POST',{email:email,code:code});},
      me:function(){return request('/me');},
      logout:function(){return request('/auth/logout','POST',{});}
    });
  }
  var instance=null;
  function client(){if(!instance)instance=create(globalThis.RUJUZHE_ACCOUNT_CONFIG||{});return instance;}
  return Object.freeze({create:create,client:client,requestCode:function(email){return client().requestCode(email);},verify:function(email,code){return client().verify(email,code);},me:function(){return client().me();},logout:function(){return client().logout();}});
});
