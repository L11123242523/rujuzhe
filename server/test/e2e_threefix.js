const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
function ok(c,m){if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);}}
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();
 pg.on('pageerror',e=>console.log('PAGEERR',e.message));
 pg.on('dialog',d=>d.accept());
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 await pg.evaluate(()=>{
   showChoiceModal=(t,n,e,ch,cb)=>cb&&cb(0);
   const bad=/雨清|光太郎|葵|霜烬/;
   let tries=0;
   do{ randomDeck('p1');randomDeck('p2');tries++; }while(
     tries<40 && ((deckConfig.p1.chars||[]).some(c=>c&&bad.test(c.name))||(deckConfig.p2.chars||[]).some(c=>c&&bad.test(c.name)))
   );
   window.__deal={p1:0,p2:0}; const _o=drawCard;
   window.drawCard=function(p){window.__deal[p]++;return _o(p);};
   startBattle();
 });
 await pg.waitForFunction(()=>battleState&&battleState.p1&&battleState.p2,{timeout:8000});
 const deal=await pg.evaluate(()=>window.__deal);
 ok(deal.p1===4,'起手发牌p1=4（实际'+deal.p1+'）');
 ok(deal.p2===4,'起手发牌p2=4（实际'+deal.p2+'）');
 await sleep(1300); // prepare 抽1
 const after=await pg.evaluate(()=>({p1:battleState.p1.hand.length,p2:battleState.p2.hand.length}));
 ok(after.p1===5,'先手准备阶段抽1后手牌=5（实际'+after.p1+'）');

 // 里绪四面骰：判定增伤仅一次
 const r2=await pg.evaluate(async()=>{
   const p=battleState.p1,q=battleState.p2;
   p.cost=5;p._judgeDamageBonus=1;p._rioFirstTriggerThisTurn=false;
   q.sync=30;q.defense=0;q.shield=0;
   judgeAnimate=(u,o,cb)=>cb(2); // 固定骰面2
   const before=q.sync;
   rioTriggerOnce('p1');
   await new Promise(r=>setTimeout(r,600));
   return {lost:before-q.sync}; // 2骰面+首次热忱1+判定增伤1=4；旧双重=5
 });
 ok(r2.lost===4,'里绪四面骰判定增伤仅一次=4伤（实际'+r2.lost+'）');

 // Twice 稳定编译 + 作用对象
 const r3=await pg.evaluate(async()=>{
   battleState.phase='main1';battleState.currentPlayer='p1';
   const mk=()=>Object.assign({},allCards.find(c=>c.name==='Twice'));
   const ops=compileStepOps(mk().effect,false);
   battleState.p1.hand=[mk()];battleState.p1.cost=10;battleState.p1._extraRollPhase=0;battleState.p2._extraRollPhase=0;
   showTargetSelect=(c,e,cb)=>cb('p1');useCard(0);await new Promise(r=>setTimeout(r,400));
   const self={me:battleState.p1._extraRollPhase,foe:battleState.p2._extraRollPhase};
   battleState.p1.hand=[mk()];battleState.p1._extraRollPhase=0;battleState.p2._extraRollPhase=0;
   showTargetSelect=(c,e,cb)=>cb('p2');useCard(0);await new Promise(r=>setTimeout(r,400));
   const other={me:battleState.p1._extraRollPhase,foe:battleState.p2._extraRollPhase};
   return {op:ops[0]&&ops[0].op,toT:!!(ops[0]&&ops[0].toTarget),self,other};
 });
 ok(r3.op==='add_roll_phase'&&r3.toT,'Twice稳定编译add_roll_phase(toTarget)：'+JSON.stringify(r3.op));
 ok(r3.self.me===1&&r3.self.foe===0,'Twice选自己 自己+1/对手+0：'+JSON.stringify(r3.self));
 ok(r3.other.me===0&&r3.other.foe===1,'Twice选他人 对手+1/自己+0：'+JSON.stringify(r3.other));

 console.log('\nRESULT pass='+pass+' fail='+fail);
 await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
