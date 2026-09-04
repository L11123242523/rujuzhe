const { chromium } = require('playwright-core');
const A=[];const ok=(c,m)=>A.push((c?'PASS ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(async()=>{
  addBattleLog=()=>{};updateBattleUI=()=>{};checkBattleEnd=()=>{};
  judgePerform=(u,s,cb)=>cb(s.kind==='coin'?'正面':6);
  // 编排器选发窗：把妖刀也加入（选第0项=妖刀）；妖刀自己的选项窗选②抽1(i=1)
  const queue=[0,1];
  showChoiceModal=(t,d,x,o,cb)=>{const k=queue.shift();cb(k===undefined?o.length-1:k);};
  showCardPickerMulti=(c,ti,cb,n)=>cb([0]);
  const mk=()=>({hand:[],deck:[{n:1},{n:2}],grave:[],removed:[],permanent:[],faceDownCards:[],sync:30,maxSync:99,cost:5,maxCost:12,shield:0,defense:0,gold:0,position:0,teamAttribute:'热忱'});
  battleState={currentPlayer:'p1',phase:'main1',resp:{},p1:mk(),p2:Object.assign(mk(),{sync:40,teamAttribute:'无序'})};
  // p1：琉璃被动(判定回费)+樱子SP(回同步)+妖刀(造≥5选发)
  battleState.p1._ruriPassive=true;battleState.p1._sakuraHealSync=true;
  battleState.p1.permanent=[{name:'妖刀五月雨'}];
  let finished=false;
  await new Promise(res=>applyDamageOps('p1','p2',{judge:true,base:6,dice:'d6',kind:'fervor'},()=>{finished=true;res();},null));
  return {p1cost:battleState.p1.cost,p1sync:battleState.p1.sync,p2sync:battleState.p2.sync,
    yaodaoFlag:battleState.p1._yaodaoTriggered,handN:battleState.p1.hand.length,finished:finished};
 });
 console.log(JSON.stringify(R,null,1));
 ok(R.finished===true,'造伤连锁走完、最终回调被调用');
 ok(R.p1cost===6,'琉璃被动回1音韵 5->6 got'+R.p1cost);
 ok(R.p1sync===28,'樱子回1同步+妖刀自失3：30+1-3=28 got'+R.p1sync);
 ok(R.yaodaoFlag===true,'妖刀选发并发动');
 console.log('\n'+A.join('\n'));
 const fail=A.filter(x=>x.startsWith('FAIL')).length;
 console.log('pageerror='+errs.length+' '+(errs[0]||''));
 await b.close();process.exit(fail||errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
