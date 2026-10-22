/* 10.22批次3：移动动作绑定、实际路程SP与泳圈逐段飞行。 */
'use strict';
const H=require('../_relaytest/lib/harness.js'),L=require('../_relaytest/lib/cardlab.js');
const watchdog=setTimeout(()=>{console.error('本批探针超时');process.exit(1);},150000);
const g=H.bootGame();g.initCards();const S=g.sandbox,C=H.makeChecker('审计批次3');
const card=n=>JSON.parse(JSON.stringify(g.card(n)));
const damage=[],logs=[];
function fresh(actor,mover,n,from='hand'){
 const p=()=>({hand:[],grave:[],deck:[],removed:[],removedFromGame:[],permanent:[],faceDownCards:[],eventCards:[],musicCards:[],statuses:[],moveBuff:{},cost:20,maxCost:20,sync:30,maxSync:100,position:10,level:1,gold:0});
 S.battleState={p1:p(),p2:p(),p3:p(),currentPlayer:from==='hand'?actor:mover,turn:5,round:3,phase:'main1',_over:false};S.TW.active=null;S.setPlayerIds(['p1','p2','p3']);S.Online.active=false;S.deckConfig.p1.chars=S.deckConfig.p2.chars=[];damage.length=0;logs.length=0;
 const c=card('能量饮料'),effect={type:'move',_stage:'move',player:mover,moveAmount:n,diceResult:n,_chain:[]};
 if(from==='faceDown'){c._faceDownTurn=3;c._faceDownPlayer=actor;S.battleState[actor].faceDownCards=[c];}else S.battleState[actor].hand=[c];
 S.rwOpen('move',{amount:n,player:mover});return{actor,mover,c,effect,from};
}
S.addBattleLog=(w,t)=>logs.push(t);S.updateBattleUI=S.renderChainBar=S.hideChainBar=S.triggerTileEffect=S.rioAccumulateMove=S.accumulateMovePassives=S.checkBattleEnd=S.runTiming=S.__replayPendingPhaseIntent=function(){};
S.postUsePassiveHooks=(w,c,done)=>done();S.showChoiceModal=(t,n,e,a,cb)=>cb(0);
S.dealDamageWithResponse=(to,n,src,cb,attr,by)=>{damage.push({to,n,attr,by});if(cb)cb();};
async function activate(t){const picks=S.collectChainable(t.actor,t.effect).filter(x=>x.card===t.c);C.eq(t.actor+'/'+t.mover+'/'+t.from+'只有一个候选',picks.length,1);if(!picks.length)return;await new Promise(resolve=>S.applyChainCard(t.actor,picks[0],t.effect,resolve));}
const settle=e=>new Promise(resolve=>S.resolveChainStack(e,resolve));
(async()=>{
 let t=fresh('p1','p1',4);S.rwClose('move');C.eq('饮料无动作不可空放',S.evaluatePlayable(t.c,'p1').ok,false);C.eq('饮料分类为移动响应',S.RJEngine.classifyChainCard(t.c),'move_adjust');C.eq('鼓舞分类保持主动增益',S.RJEngine.classifyChainCard(card('鼓舞')),null);
 for(const actor of ['p1','p2'])for(const mover of ['p1','p2'])for(const from of ['hand','faceDown']){
  t=fresh(actor,mover,4,from);await activate(t);C.eq('发动未抢改数值',t.effect.moveAmount,4);await settle(t.effect);C.eq('逆结算4→8',t.effect.moveAmount,8);C.eq('付费一次',S.battleState[actor].cost,17);C.eq('原卡送墓',S.battleState[actor].grave.includes(t.c),true);
  C.eq('双方不挂人物翻倍',[S.battleState.p1.moveBuff.doubleMove||false,S.battleState.p2.moveBuff.doubleMove||false],[false,false]);
  S.executeMoveEffect(t.effect);C.eq('实际位移8',S.battleState[mover]._lastMoveSteps,8);C.eq('SP按用卡者归属',damage.map(x=>({n:x.n,by:x.by,attr:x.attr})),[{n:3,by:actor,attr:'热忱'}]);C.eq('动作SP已清',t.effect._energyDrinkSP,undefined);
  damage.length=0;S.applyMove(mover,3);C.eq('后续位移保持3',S.battleState[mover]._lastMoveSteps,3);C.eq('后续不重复SP',damage.length,0);
 }
 for(const [base,want,sp] of [[0,0,0],[3,6,0],[4,8,3],[7,13,3],[8,14,3],[9,15,5]]){
  t=fresh('p1','p1',base);await activate(t);await settle(t.effect);S.executeMoveEffect(t.effect);C.eq('原'+base+'实际路程',S.battleState.p1._lastMoveSteps,want);C.eq('原'+base+'SP阈值',damage.map(x=>x.n),sp?[sp]:[]);
 }
 for(const steps of [7,14,15]){t=fresh('p1','p1',steps);t.effect._energyDrinkSP=[{by:'p1'}];S.executeMoveEffect(t.effect);C.eq('严格大于边界'+steps,damage.map(x=>x.n),steps>14?[5]:steps>7?[3]:[]);}
 t=fresh('p1','p1',4);await activate(t);t.effect._chain.push({kind:'add',by:'p2',name:'调整',from:4,delta:2});await settle(t.effect);C.eq('先加2再翻倍',t.effect.moveAmount,12);
 t=fresh('p1','p1',4);await activate(t);t.effect._chain.push({kind:'cancel',by:'p2',name:'打断'});await settle(t.effect);C.eq('先打断则不翻倍',t.effect.moveAmount,4);S.executeMoveEffect(t.effect);C.eq('取消动作不留SP',t.effect._energyDrinkSP,undefined);C.eq('取消动作无SP',damage.length,0);
 t=fresh('p1','p1',4);await activate(t);await settle(t.effect);S.battleState._barriers=[{pos:12,by:'p1'}];S.executeMoveEffect(t.effect);C.eq('路障实际2格',S.battleState.p1._lastMoveSteps,2);C.eq('计划8实际2不触发SP',damage.length,0);
 t=fresh('p1','p1',4);await activate(t);await settle(t.effect);S.showChoiceModal=(a,b,c,d,cb)=>cb(d.length-1);S.executeMoveEffect(t.effect);C.eq('SP允许放弃',damage.length,0);S.showChoiceModal=(a,b,c,d,cb)=>cb(0);
 t=fresh('p1','p1',4);const gu=card('鼓舞');S.runOneOp(S.compileStepOps(gu.effect,false).find(x=>x.op==='buff_double_move'),{user:'p1',target:'p2',card:gu},()=>{});C.eq('鼓舞仍给所选目标',S.battleState.p2.moveBuff.doubleMove,true);C.eq('鼓舞仍可选择消费',S.battleState.p2.moveBuff.choice,true);
 t=fresh('p1','p1',4);S.runOneOp({op:'buff_double_move'},{user:'p1',target:'p2',card:t.c},()=>{});C.eq('裸饮料指令不预挂人物',S.battleState.p2.moveBuff.doubleMove,undefined);
 // 资格反证：其他回合不能从手牌响应，无移动/错误时点/已取消来源不列入盖伏候选。
 t=fresh('p1','p2',4);S.battleState.currentPlayer='p2';C.eq('他人回合手牌不可用',S.collectChainable('p1',t.effect).some(x=>x.card===t.c),false);
 for(const stage of ['dice_result','effect_activate']){t=fresh('p1','p1',4,'faceDown');t.effect._stage=stage;C.eq(stage+'不列入饮料',S.collectChainable('p1',t.effect).some(x=>x.card===t.c),false);}
 t=fresh('p1','p1',4,'faceDown');t.effect.cancelled=true;C.eq('已取消来源不列入',S.collectChainable('p1',t.effect).some(x=>x.card===t.c),false);
 // AI主移动出口也必须使用同一动作携带的数值及SP，隔离自动决策。
 const before=S.beforeEffectExecution;
 t=fresh('p2','p2',9);S.__setAiSeat('p2');
 S.beforeEffectExecution=(e,cb)=>{if(e._stage!=='move'){cb(e);return;}t.effect=e;activate(t).then(()=>settle(e)).then(()=>cb(e));};
 await new Promise(resolve=>S.aiExecuteMove(9,resolve));S.beforeEffectExecution=before;
 C.eq('AI实际移动15格',S.battleState.p2._lastMoveSteps,15);C.eq('AI出口SP5点',damage.map(x=>({n:x.n,by:x.by})),[{n:5,by:'p2'}]);C.eq('AI动作SP清除',t.effect._energyDrinkSP,undefined);
 // 逐格路径隔离：目标位置在每次伤害回调后重新读取，不预截名单。
 const original=S.applyDamageOps;S.applyDefenseDown=()=>{};
 for(const user of ['p1','p2'])for(const dir of [1,-1])for(const gap of [3,4,5]){
  fresh(user,user,4);const others=['p1','p2','p3'].filter(w=>w!==user),b=S.battleState;b[user].position=dir>0?40:1;b[others[0]].position=(b[user].position+dir*2+42)%42;b[others[1]].position=(b[user].position+dir*(2+gap)+42)%42;
  const hits=[];let done=0;S.applyDamageOps=(u,w,o,cb)=>{hits.push(w);cb();};S.showChoiceModal=(a,b,c,d,cb)=>cb(dir>0?0:1);S.Online.active=user==='p2';S.onlineDecideModal=(w,a,b,c,d,cb)=>cb(dir>0?0:1);
  S.runOneOp({op:'swim_ring',range:4,damage:2,def:1},{user,target:others[0],card:card('夏日泳圈攻击！')},()=>done++);
  C.eq(user+'方向'+dir+'后段'+gap+'格命中',hits,gap<=4?others:[others[0]]);C.eq('飞行恰好完成一次',done,1);
 }
 fresh('p1','p1',4);S.battleState.p2.position=12;S.battleState.p3.position=30;let hits=[];S.showChoiceModal=(a,b,c,d,cb)=>cb(0);S.applyDamageOps=(u,w,o,cb)=>{hits.push(w);if(w==='p2')S.battleState.p3.position=15;cb();};S.runOneOp({op:'swim_ring',range:4,damage:2,def:1},{user:'p1',card:card('夏日泳圈攻击！')},()=>{});C.eq('首击后重新读取后续站位',hits,['p2','p3']);S.applyDamageOps=original;
 // 真实三座位出牌与实际同步/防御变化。
 for(const user of ['p1','p2']){
  const inst=L.bootCard({pickChoice:()=>0,pickChain:(t,a)=>a.length-1,pickCards:()=>[0]}),T=inst.S,c=JSON.parse(JSON.stringify(inst.g.card('夏日泳圈攻击！')));
  const b=await L.setupBoard(inst,c,inst.g.cards(),{team:['枫(水着)','椎名小春','小野伊织'],tweak:(s,b)=>{
   for(const w of ['p1','p2']){for(const k of Object.keys(b[w]))if(k.startsWith('_'))delete b[w][k];Object.assign(b[w],{hand:[],deck:[],grave:[],removed:[],removedFromGame:[],permanent:[],faceDownCards:[],eventCards:[],musicCards:[],statuses:[],moveBuff:{},position:10,sync:30,maxSync:100,cost:20,maxCost:20,attackBuff:0,defense:0,shield:0,teamAttribute:'神圣',level:1});}
   b.p3=JSON.parse(JSON.stringify(b.p2));const foe=user==='p1'?'p2':'p1';b[foe].position=12;b.p3.position=15;b[user].hand=[c];b.currentPlayer=user;b.phase='main1';s.setPlayerIds(['p1','p2','p3']);s.deckConfig.p2.chars=s.deckConfig.p1.chars.slice();
  }});
  if(user==='p1')T.useCard(0);else T.aiUseCardComplete(0,()=>{});const quiet=await L.quiesce(inst,16000),foe=user==='p1'?'p2':'p1';
  C.eq(user+'泳圈收尾',quiet.ok,true);C.eq(user+'首目标实际同步28',b[foe].sync,28);C.eq(user+'总5格第二目标实际同步28',b.p3.sync,28);C.eq(user+'两目标实际降防',[b[foe].defense,b.p3.defense],[-1,-1]);C.eq(user+'使用者不受伤',b[user].sync,30);C.eq(user+'泳圈费用3',b[user].cost,17);C.eq(user+'泳圈无异常',inst.errs,[]);
 }
 clearTimeout(watchdog);process.exit(C.summary());
})().catch(e=>{console.error(e.stack);process.exit(1);});
