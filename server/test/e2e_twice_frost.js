const { chromium } = require('playwright-core');
const A=[];const ok=(c,m)=>A.push((c?'PASS ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(()=>{
  addBattleLog=()=>{};updateBattleUI=()=>{};
  battleState={currentPlayer:'p1',phase:'main2',
    p1:{deck:[],grave:[],hand:[],cost:12,maxCost:12,sync:30,position:5,permanent:[]},
    p2:{deck:[],grave:[],hand:[],cost:12,maxCost:12,sync:30,position:9,permanent:[],statuses:[]}};
  const out={};
  // Twice：main2 阶段主动追加 → 立即回到本回合 roll，且 flag 被消费、可再投
  battleState.p1._extraRollPhase=1;
  enterExtraRollPhase('p1');
  out.phaseAfter=battleState.phase; out.flagAfter=battleState.p1._extraRollPhase; out.rollFlag=battleState._diceRolledThisPhase;
  // 霜烬：p2 同步30、被动开；p1 施加缴械应被免疫
  battleState.p2._frostPassive=true;
  StatusSys.add('p2',{type:'缴械',addedBy:'p1'});
  out.enemyDebuffBlocked=!StatusSys.has('p2','缴械');
  // 自己对自己施加不拦
  StatusSys.add('p2',{type:'减速',addedBy:'p2'});
  out.selfDebuffKept=StatusSys.has('p2','减速');
  // 同步<=26 不免疫
  battleState.p2.sync=20; StatusSys.add('p2',{type:'神醉',addedBy:'p1'});
  out.lowSyncNotImmune=StatusSys.has('p2','神醉');
  out.blockHelper=frostBlockDebuff('p1','p2'); // sync20 应 false
  return out;
 });
 console.log(JSON.stringify(R));
 ok(R.phaseAfter==='roll','main2主动追加立即回本回合roll got'+R.phaseAfter);
 ok(R.flagAfter===0,'追加flag被消费 got'+R.flagAfter);
 ok(R.rollFlag===false,'重置为未投骰状态');
 ok(R.enemyDebuffBlocked===true,'霜烬>26免疫对方负面状态');
 ok(R.selfDebuffKept===true,'自己施加的状态不被免疫');
 ok(R.lowSyncNotImmune===true,'同步≤26不免疫');
 ok(R.blockHelper===false,'霜烬helper在20同步不拦截');
 console.log('\n'+A.join('\n'));const f=A.filter(x=>x.startsWith('FAIL')).length;
 console.log('Twice/霜烬 '+(A.length-f)+'/'+A.length+' pageerror='+errs.length+' '+(errs[0]||''));
 await b.close();process.exit(f||errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
