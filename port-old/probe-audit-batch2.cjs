/* 10.22批次2：同行全体范围与乌托邦反制资格独立回归。 */
'use strict';
const H=require('../_relaytest/lib/harness.js'),L=require('../_relaytest/lib/cardlab.js');
const g=H.bootGame();g.initCards();const S=g.sandbox,C=H.makeChecker('审计批次2');
const card=n=>JSON.parse(JSON.stringify(g.card(n)));
function fresh(user){const p=()=>({hand:[],deck:[],grave:[],removed:[],removedFromGame:[],permanent:[],faceDownCards:[],eventCards:[],musicCards:[],statuses:[],position:10,sync:30,maxSync:100,cost:20,maxCost:20,level:1,attackBuff:0,defense:0,shield:0});S.battleState={p1:p(),p2:p(),p3:p(),turn:3,currentPlayer:user,phase:'main1',_over:false};S.TW.active=null;S.Online.active=false;S.addBattleLog=S.updateBattleUI=S.runTiming=function(){};return S.battleState;}
for(const user of ['p1','p2']){
 const target=user==='p1'?'p2':'p1',b=fresh(user);b[target].position=11;b.p3.position=35;
 for(const other of [false,true]){
  const text=other?'对同一行的所有其他玩家造成2点理智属性伤害。':card('水枪攻击！').effect;
  const op=S.compileStepOps(text,false).find(o=>o.op==='damage');const original=S.applyDamageOps;let hits=[],done=0;
  S.applyDamageOps=(u,t,o,cb)=>{hits.push(t);cb();};S.showChoiceModal=(t,n,e,a,cb)=>cb(0);S.runOneOp(op,{user,target,card:card('水枪攻击！')},()=>done++);S.applyDamageOps=original;
  C.eq(user+(other?'其他玩家':'所有玩家')+'同行范围',hits.sort(),(other?[target]:[user,target]).sort());C.eq('范围步骤结束',done,1);
 }
 b[target].position=10;let hits=[];const orig=S.applyDamageOps;S.applyDamageOps=(u,t,o,cb)=>{hits.push(t);cb();};
 S.runOneOp(S.compileStepOps(card('水枪攻击！').effect,false).find(o=>o.op==='damage'),{user,target,card:card('水枪攻击！')},()=>{});S.applyDamageOps=orig;C.eq(user+'同格也包含双方',hits.sort(),[user,target].sort());
 const u=card('崩塌之乌托邦');b[user].hand=[u];
 C.eq(user+'无窗口不可发动',S.evaluatePlayable(u,user).ok,false);
 for(const [stage,text,want] of [['effect_activate','抽一张卡',true],['effect_activate','将一张卡加入手卡',true],['effect_activate','选一张手卡送入墓地',true],['effect_activate','造成2点伤害',false],['move','抽一张卡',false]]){
  const e={_stage:stage,card:{name:'来源',effect:text},player:target};S.TW.active={state:'collect',effect:e};
  C.eq(user+'资格 '+stage+'/'+text,S.hasChainTarget(u),want);
  C.eq(user+'候选 '+stage+'/'+text,S.collectChainable(user,e).some(x=>x.card===u),want);
 }
 S.TW.active={state:'settling',effect:{_stage:'effect_activate',card:{effect:'抽一张卡'}}};C.eq(user+'结算期间旧来源不可再用',S.hasChainTarget(u),false);
}
{
 const b=fresh('p1'),op=S.compileStepOps(card('水枪攻击！').effect,false).find(o=>o.op==='damage');C.eq('额外音韵上限保留3',op.payExtra.max,3);
 const orig=S.applyDamageOps;let bases=[];S.applyDamageOps=(u,t,o,cb)=>{bases.push(o.base);cb();};S.showChoiceModal=(t,n,e,a,cb)=>cb(a.length-1);
 S.runOneOp(op,{user:'p1',target:'p2',card:card('水枪攻击！')},()=>{});S.applyDamageOps=orig;
 C.eq('投入3点后每名同行玩家基础伤害5',bases,[5,5,5]);C.eq('额外音韵只扣一次',b.p1.cost,17);
}
(async()=>{
 for(const user of ['p1','p2'])for(const name of ['水枪攻击！','崩塌之乌托邦']){
  const inst=L.bootCard({pickChoice:()=>0,pickChain:(t,a)=>a.length-1,pickCards:()=>[0]}),T=inst.S,c=JSON.parse(JSON.stringify(inst.g.card(name)));
  const b=await L.setupBoard(inst,c,inst.g.cards(),{team:['予(水着)','椎名小春','小野伊织'],tweak:(s,b)=>{for(const w of ['p1','p2']){for(const k of Object.keys(b[w]))if(k.startsWith('_'))delete b[w][k];Object.assign(b[w],{hand:[],deck:[],grave:[],removed:[],removedFromGame:[],permanent:[],faceDownCards:[],statuses:[],eventCards:[],musicCards:[],sync:30,maxSync:100,cost:20,maxCost:20,position:10,attackBuff:0,defense:0,shield:0,teamAttribute:'神圣'});}s.deckConfig.p2.chars=s.deckConfig.p1.chars.slice();b.currentPlayer=user;b[user].hand=[c];}});
  if(user==='p1')T.useCard(0);else T.aiUseCardComplete(0,()=>{});const quiet=await L.quiesce(inst,16000);C.eq(user+name+'真实出牌收尾',quiet.ok,true);
  if(name==='水枪攻击！'){if(b[user].sync!==28)console.log('自身伤害现场 '+JSON.stringify(L.logsOf(b).slice(-20)));C.eq(user+'水枪自身受2伤',b[user].sync,28);C.eq(user+'水枪对手受2伤',b[user==='p1'?'p2':'p1'].sync,28);C.eq(user+'水枪基础费用2',b[user].cost,18);}
  else {C.eq(user+'乌托邦空放不扣费',b[user].cost,20);C.eq(user+'乌托邦空放不离手',b[user].hand.includes(c),true);C.eq(user+'乌托邦空放不送墓',b[user].grave.length,0);}
  if(name==='崩塌之乌托邦'){
   const effect={_stage:'effect_activate',player:user==='p1'?'p2':'p1',card:{name:'反制来源',effect:'抽一张卡'},_chain:[]};
   T.applyChainCard(user,{card:c,from:'hand',index:0},effect,()=>{});await L.quiesce(inst,8000);
   await new Promise(resolve=>T.resolveChainStack(effect,resolve));await L.quiesce(inst,8000);
   C.eq(user+'合法反制效果确实无效',effect.cancelled,true);C.eq(user+'合法反制卡确实送墓',b[user].grave.includes(c),true);
  }
  C.eq(user+name+'无执行错误',inst.errs,[]);
 }
 process.exit(C.summary());
})().catch(e=>{console.error(e.stack);process.exit(1);});
