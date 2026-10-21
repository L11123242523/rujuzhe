/* 逆结算中产生的造伤后触发，不能与当前链互相等待。 */
'use strict';
const L=require('../_relaytest/lib/cardlab');let total=0,bad=0;
function chk(v,s){total++;if(!v)bad++;console.log((v?'✅ ':'❌ ')+s);}
(async()=>{
for(const owner of ['p1','p2']){
 const I=L.bootCard({pickChain:(t,a)=>a.length-1}),S=I.S;L.startMatchWith(I,{seed:1});await L.quiesce(I,5000);
 const b=S.battleState,foe=owner==='p1'?'p2':'p1';b.currentPlayer=owner;b[owner]._ruriPassive=true;const count=b[owner]._ruriJudgeCount||0,old=b[foe].sync;let done=0;
 const start=L.logsOf(b).length;
 S.TW.settlePrebuilt([{owner,label:'造伤后触发互等回归',fire:n=>S.dealDamageWithResponse(foe,1,'回归判定伤害',n,null,owner,{judge:true})}],{done:()=>done++});
 const end=Date.now()+10000;
 while(Date.now()<end&&(S.TW.active||S.TW.queue.length||S.effectEngine._resolveDepth||S.effectEngine._pendingTriggers.length))await new Promise(r=>setTimeout(r,20));
 const logs=L.logsOf(b).slice(start),parent=logs.findIndex(x=>x.includes('连锁全部结算完成')),passive=logs.findIndex(x=>x.includes('【琉璃被动】判定伤害后回复'));
 chk(done===1,owner+' 原链恰好完成一次');chk(b[foe].sync<old,owner+' 原伤害确实落地');chk(b[owner]._ruriJudgeCount===count+1,owner+' 琉璃被动完整触发一次');
 chk(parent>=0&&passive>parent,owner+' 原链全部完成后才处理新触发');
 chk(!S.TW.active&&!S.TW.queue.length&&S.effectEngine._resolveDepth===0&&!S.effectEngine._chainLock,owner+' 窗口、队列与结算深度归零');
 chk(!S.Decision.isOpen()&&!S.DecisionHub.active,owner+' 无残留待答');chk(!I.errs.length,owner+' 无执行异常');
}
{
 const I=L.bootCard(),S=I.S;L.startMatchWith(I,{seed:1});await L.quiesce(I,5000);let parent=0,childNext,childDone=0;
 S.TW.settlePrebuilt([{owner:'p2',label:'父链',fire:next=>{S.resolveSimultaneous('p2',[{owner:'p2',label:'异步后继触发',mandatory:true,fire:done=>{childNext=()=>{childDone++;done();};}}],next);}}],{done:()=>parent++});
 const end=Date.now()+6000;while(!childNext&&Date.now()<end)await new Promise(r=>setTimeout(r,20));
 chk(parent===1&&!!childNext,'父链不等后继触发，完整交接后启动异步候选');
 await new Promise(r=>setTimeout(r,150));chk(childDone===0&&!!S.TW.active,'后继未回调前保持结算，不提前吞掉异步效果');
 if(childNext)childNext();const finish=Date.now()+4000;while(S.TW.active&&Date.now()<finish)await new Promise(r=>setTimeout(r,20));
 chk(childDone===1&&!S.TW.active&&S.effectEngine._resolveDepth===0,'后继明确回调后整链恰好收尾一次');
}
console.log('共 '+total+' 项，通过 '+(total-bad)+'，失败 '+bad);process.exit(bad?1:0);
})().catch(e=>{console.error('❌ '+e.stack);process.exit(1);});
