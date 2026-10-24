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
    var baseUrl=base.href.replace(/\/$/,''),send=options.fetch||globalThis.fetch.bind(globalThis);
    async function request(path,method,data){
      var response;
      try{response=await send(baseUrl+path,{method:method||'GET',credentials:'include',cache:'no-store',headers:{Accept:'application/json',...(data===undefined?{}:{'Content-Type':'application/json'})},...(data===undefined?{}:{body:JSON.stringify(data)})});}
      catch(cause){var network=new Error('网络连接失败，请稍后重试；本机档案未更改');network.code='ACCOUNT_NETWORK';throw network;}
      var body;try{body=await response.json();}catch(e){var invalid=new Error('账号服务返回了无效数据');invalid.code='ACCOUNT_RESPONSE';throw invalid;}
      if(!response.ok){
        var error=new Error(response.status===503?'邮件登录未启用':(body.message||'账号操作未完成'));
        error.status=response.status;error.code=body.error||'ACCOUNT_HTTP';error.detail=body;throw error;
      }
      return body;
    }
    return Object.freeze({
      baseUrl:baseUrl,isLocalDev:local,request:request,
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
