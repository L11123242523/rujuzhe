/* 重连时请求与效果的唯一归属：真实客户端函数，两端传输可控故障注入。 */
'use strict';
const H=require('../_relaytest/lib/harness');
let total=0,bad=0;
function chk(ok,label){total++;if(!ok)bad++;console.log((ok?'✅ ':'❌ ')+label);}
function boot(guest){
 const g=H.bootGame({console:{log(){},warn(){},error(...a){console.error(...a);}}});g.initCards();const S=g.sandbox;
 S.battleState={turn:1,phase:'main1',currentPlayer:'p1',p1:{sync:30,cost:8,hand:[],deck:[],grave:[],permanent:[]},p2:{sync:30,cost:8,hand:[],deck:[],grave:[],permanent:[]}};
 S.Online.active=true;S.Online.isGuest=guest;S.Online._enteredBattle=true;
 S.updateBattleUI=()=>{};S.Online.pushSnapshot=()=>{};S.Online._sendSnapshotNow=()=>{};
 return S;
}
const h=boot(false),g=boot(true),O=h.Online,G=g.Online,answers=[],shown=[],wire=[];
let connected=true,answerConnected=true;
O._send=m=>{wire.push(m);if(!connected)return false;if(m.t==='relay'&&['ask','askAck'].includes(m.m.k))G._onRelay(m.m);return true;};
G._send=m=>{if(!answerConnected)return false;if(m.t==='relay'&&m.m.k==='ans')O._onAnswer(m.m);return true;};
g.Online._renderAsk=(spec,cb)=>shown.push({spec,cb});
O.askRemote({choices:['甲','乙'],label:'扣费后选择'},v=>{answers.push(v);h.battleState.p1.sync+=2;});
h.battleState.p1.cost-=1;
const id=Object.keys(O._asks)[0];
chk(shown.length===1&&answers.length===0,'初次问题已到达，尚未替玩家作答');
O._onPeerBack();O._onPeerBack();
chk(shown.length===1&&Object.keys(O._asks).length===1,'不断页客人重连：同一问题不重复渲染');
const b=h.battleState,rec=O._asks[id];wire.length=0;O._onRejoined();
chk(!wire.some(m=>m.t==='resync')&&h.battleState===b&&O._asks[id]===rec,'房主不断页重连保留同一局面和原回调，不覆盖快照');
chk(h.battleState.p1.cost===7&&answers.length===0,'不断页重连不重复扣费、不提前结算');
answerConnected=false;shown[0].cb(1);
chk(answers.length===0&&G._receivedAsks[id].answered,'回答发送失败时保留真实答案');
answerConnected=true;O._onPeerBack();
chk(answers.length===1&&answers[0]===1&&h.battleState.p1.sync===32,'重发问题带回原答案，效果恰好结算一次');
chk(!O._asks[id]&&!G._receivedAsks[id],'房主接收后确认，双方请求记录清理');
O._onAnswer({id,v:1});chk(answers.length===1,'迟到重复答案不会再次结算');
connected=false;O.askRemote({choices:['甲'],label:'断线期间新问题'},v=>answers.push(v));
const next=Object.keys(O._asks)[0];chk(!!next&&answers.length===1,'问题发送失败不补答null，保留待答');
connected=true;O._onRejoined();chk(shown.length===2,'房主恢复连接后补发断线期间的新问题');shown[1].cb(0);
chk(answers.length===2&&answers[1]===0,'补发问题仍由玩家选择并恰好完成一次');
O.askRemote({choices:['甲'],label:'客人刷新前问题'},v=>answers.push(v));
const fresh=boot(true);fresh.Online._renderAsk=(spec,cb)=>shown.push({spec,cb});fresh.Online._send=G._send;
O._send=m=>{if(m.t==='relay'&&['ask','askAck'].includes(m.m.k))fresh.Online._onRelay(m.m);return true;};
O._onPeerBack();chk(shown.length===4,'客人页面重建后收到原待答问题');shown[3].cb(0);
chk(answers.length===3&&Object.keys(O._asks).length===0,'客人刷新后应答推进房主原流程');
// 检查点只读取生命周期，不以经过多少秒判断结束。
h.DecisionHub.active={id:99,kind:'pickCards'};chk(!!h.__eeIdleForSnapshot(),'统一选择未完成时不能打安全检查点');h.DecisionHub.active=null;
h.TW.queue.push({kind:'open'});chk(!!h.__eeIdleForSnapshot(),'时点窗口排队时不能打安全检查点');h.TW.queue.length=0;
h.effectEngine._animating=true;chk(!!h.__eeIdleForSnapshot(),'效果演出未完成时不能打安全检查点');h.effectEngine._animating=false;
console.log('共 '+total+' 项，通过 '+(total-bad)+'，失败 '+bad);process.exit(bad?1:0);
