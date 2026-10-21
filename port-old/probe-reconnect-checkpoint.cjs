/* 刷新丢失调用栈后，两端只恢复完整检查点；半次扣费、移动与判定均撤销。 */
'use strict';
const H=require('../_relaytest/lib/harness');let total=0,bad=0;
function chk(v,s){total++;if(!v)bad++;console.log((v?'✅ ':'❌ ')+s);}
function boot(){const g=H.bootGame({console:{log(){},warn(){},error(...a){console.error(...a)}}});g.initCards();return g.sandbox;}
const S=boot();S.battleState={turn:1,currentPlayer:'p1',phase:'main1',p1:{cost:8,sync:30,hand:[S.allCards.find(c=>c.name==='剖析')],deck:[],grave:[],permanent:[],position:5},p2:{cost:7,sync:30,hand:[],deck:[],grave:[],permanent:[],position:10},_logs:[]};
S.Online.active=true;S.Online.isGuest=false;S.Online.seed=123;
let saved;S.Online._send=m=>{if(m.m&&m.m.k==='snapSave')saved=JSON.parse(JSON.stringify(m.m.s));return true;};
S.Online._saveSnapshotSoon(true);chk(saved.idle===true&&Object.keys(saved.cards).length>0,'空闲恢复点包含完整卡定义');
for(const kind of ['选择中','扣费后','判定中']){
 S.effectEngine._resolveDepth=1;S.battleState.p1.cost=3;S.battleState.p1.position=8;S.battleState.p1.hand=[];S.battleState.p2.sync=21;
 S.Online._saveSnapshotSoon(true);
 chk(saved.idle===false&&saved.completeCheckpoint&&saved.completeCheckpoint.idle===true,kind+' 最新快照仍携带完整恢复点');
 const R=boot();R.Online.active=true;R.Online.isGuest=false;R.Online._enteredBattle=false;
 let pushed=0,view;R.Online._sendSnapshotNow=()=>{pushed++;view=R.NetSync.buildSnapshot({full:true});view.recoveryToken=R.Online._recoveryToken;};
 R.Online._onResync({s:JSON.parse(JSON.stringify(saved)),safe:false});
 chk(R.battleState.p1.cost===8&&R.battleState.p1.position===5&&R.battleState.p2.sync===30,kind+' 费用、位置与同步值整体回退');
 chk(R.battleState.p1.hand[0].name==='剖析'&&!R.battleState.p1.hand[0].__missing,kind+' 原卡回手且定义完整');
 chk(pushed===1&&R.Online._enteredBattle,kind+' 恢复后明确向客人推送完整视图');
 const G=boot();G.Online.active=true;G.Online.isGuest=true;let stale=0;G.showChoiceModal('旧选择','','',['甲'],()=>stale++);G.Online._receivedAsks={old:{answered:false}};G.Online._onSnapshot(view);
 chk(G.battleState.p2.cost===8&&G.battleState.p2.position===5&&G.battleState.p1.sync===30,kind+' 客人与房主恢复到同一局面（按视角换位）');
 chk(!G.DecisionHub.active&&!G.DecisionHub.queue.length&&!G.Decision.isOpen()&&stale===0&&Object.keys(G.Online._receivedAsks).length===0,kind+' 客人旧弹窗取消、不补答、不残留');
 chk(R.battleState._logs.some(x=>/同步回退/.test(x.msg)),kind+' 日志明确说明回退和重新操作');
}
const F=boot();F.Online.active=true;F.Online.isGuest=false;let notices=[];F.Online._relay=m=>notices.push(m);F.Online._onResync({s:{state:{p1:{cost:3}},cards:{},idle:false},safe:false});
chk(!F.Online._enteredBattle&&notices.some(m=>m.k==='recoveryFailed'),'旧版或无完整恢复点时拒绝把半成品作为可玩对局');
console.log('共 '+total+' 项，通过 '+(total-bad)+'，失败 '+bad);process.exit(bad?1:0);
