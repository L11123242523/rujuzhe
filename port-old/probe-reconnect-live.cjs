/* 真中继、双引擎：房主和客人各在待答时断开WebSocket，验证原结算继续。 */
'use strict';
const OP=require('../_relaytest/lib/onlinepair');let total=0,bad=0;
const watchdog=setTimeout(()=>{console.error('❌ 重连真中继探针超时');process.exit(1);},240000);
function chk(ok,s){total++;if(!ok)bad++;console.log((ok?'✅ ':'❌ ')+s);}
(async()=>{
 try{
 const {H,G,until}=await OP.bootPair(),h=H.S,g=G.S,shown=[];let completions=0,resyncs=0;
 for(const [name,S] of [['房主',h],['客人',g]]){const recv=S.Online._onServer,send=S.Online._send;S.Online._onServer=function(m){if(m&&['joined','error','peerBack','peerLost'].includes(m.t))console.log(name+'收到 '+JSON.stringify(m));return recv.call(this,m);};S.Online._send=function(m){if(m&&m.t==='hello')console.log(name+'发送hello '+JSON.stringify(m));return send.call(this,m);};}
 const original=h.Online._onResync;h.Online._onResync=function(m){resyncs++;return original.call(this,m);};
 g.Online._renderAsk=(spec,cb)=>shown.push({spec,cb});
 h.Online.askRemote({label:'重连专项：选择中断线',choices:['继续','取消']},v=>{if(v===0)completions++;});
 chk(await until(()=>shown.length===1,12000),'真中继把原问题送到客人');
 const b=h.battleState,ids=Object.keys(h.Online._asks),rec=h.Online._asks[ids[0]];
 h.Online.ws.close();
 chk(await until(()=>g.Online._peerLost,8000),'客人收到房主掉线通知');
 chk(await until(()=>h.Online.connected&&!g.Online._peerLost,60000),'房主自动重连成功');
 chk(resyncs===0&&h.battleState===b&&h.Online._asks[ids[0]]===rec,'不断页房主保留原局面、同一请求及回调');
 chk(shown.length===1&&completions===0,'房主重连后无重复弹窗、无补答');
 g.Online.ws.close();
 chk(await until(()=>h.Online._peerLost,8000),'房主收到客人掉线通知');
 chk(await until(()=>g.Online.connected&&!h.Online._peerLost,60000),'客人自动重连成功');
 chk(shown.length===1&&completions===0,'客人不断页重连沿用原问题，不重复显示');
 shown[0].cb(0);
 chk(await until(()=>completions===1,10000),'重连后真实答案到达房主，原效果恰好完成一次');
 chk(Object.keys(h.Online._asks).length===0,'房主待答全部收尾');
 chk(await until(()=>Object.keys(g.Online._receivedAsks||{}).length===0,10000),'客人收到答案确认并清理重发记录');
 }finally{clearTimeout(watchdog);await OP.close();}
 console.log('共 '+total+' 项，通过 '+(total-bad)+'，失败 '+bad);process.exit(bad?1:0);
})().catch(e=>{console.error('❌ '+e.stack);process.exit(1);});
