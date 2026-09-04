const { chromium } = require('playwright-core');
const A=[];const ok=(c,m)=>A.push((c?'PASS ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(()=>{
  addBattleLog=()=>{};updateBattleUI=()=>{};checkBattleEnd=()=>{};triggerTileEffect=()=>{};
  deckConfig={p1:{chars:[]},p2:{chars:[]}};
  const mk=()=>({hand:[],deck:[],grave:[],removed:[],permanent:[],faceDownCards:[],sync:30,maxSync:99,cost:5,maxCost:12,shield:0,defense:0,attackBuff:0,gold:0,position:0,_xianji:0});
  const out={};
  // 1 小春：累计4格即+1先机
  battleState={currentPlayer:'p1',p1:mk(),p2:mk()};
  battleState.p1._koharuPassive=true;
  accumulateMovePassives('p1',4,null);
  out.koharu4=battleState.p1._xianji; // 期望1
  battleState.p1._xianji=0;battleState.p1._koharuMoveCount=0;accumulateMovePassives('p1',3,null);out.koharu3=battleState.p1._xianji; // 期望0
  // 2 莉莉SP：墓地[非单次(较上), 单次(最下)] pop单次后最下非单次=>执行+回费
  let dispatch=0;dispatchStep=(t,c,cb)=>{dispatch++;cb&&cb();};
  battleState.p1.grave=[{name:'非单次',_category:'item_permanent'},{name:'单次',_category:'item_single',effect:'x'}];
  battleState.p1._lilySP=true;battleState.turn=1;
  activateLilySP();
  out.lilyOkCost=battleState.p1.cost;out.lilyOkDispatch=dispatch;out.lilyOkDeck=battleState.p1.deck.length; // 6,1,1
  // 反例：[单次,单次] pop后最下还是单次=>不执行不回费
  dispatch=0;battleState.p1.cost=5;battleState.p1.deck=[];
  battleState.p1.grave=[{name:'单次A',_category:'item_single',effect:'x'},{name:'单次B',_category:'item_single',effect:'x'}];
  activateLilySP();
  out.lilyNoCost=battleState.p1.cost;out.lilyNoDispatch=dispatch; // 5,0
  // 3 能量饮料SP：位移>7造3、>14造5
  const dmg=[];dealDamageWithResponse=(t,d,src,cb,attr,who,op)=>{dmg.push(d);cb&&cb();};
  async function moveEd(n){battleState.p1.position=0;battleState.p1.moveBuff={energyDrinkSP:true};applyMove('p1',n);}
  return (async()=>{await moveEd(8);out.ed8=dmg.slice();dmg.length=0;await moveEd(15);out.ed15=dmg.slice();dmg.length=0;await moveEd(6);out.ed6=dmg.slice();return out;})();
 });
 console.log(JSON.stringify(R,null,1));
 ok(R.koharu4===1,'小春累计4格+1先机 got'+R.koharu4);
 ok(R.koharu3===0,'小春累计3格不触发 got'+R.koharu3);
 ok(R.lilyOkCost===6&&R.lilyOkDispatch===1&&R.lilyOkDeck===1,'莉莉 单次+新最下非单次→执行并回1费');
 ok(R.lilyNoCost===5&&R.lilyNoDispatch===0,'莉莉 两张单次→不执行不回费 got'+R.lilyNoCost+'/'+R.lilyNoDispatch);
 ok(JSON.stringify(R.ed8)==='[3]','能量饮料位移8造3 got'+JSON.stringify(R.ed8));
 ok(JSON.stringify(R.ed15)==='[5]','能量饮料位移15造5 got'+JSON.stringify(R.ed15));
 ok(JSON.stringify(R.ed6)==='[]','能量饮料位移6不造伤 got'+JSON.stringify(R.ed6));
 console.log('\n'+A.join('\n'));const f=A.filter(x=>x.startsWith('FAIL')).length;
 console.log('五卡引擎 '+(A.length-f)+'/'+A.length+' pageerror='+errs.length+' '+(errs[0]||''));
 await b.close();process.exit(f||errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
