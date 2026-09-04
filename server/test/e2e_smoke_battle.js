const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE:'+m.text());});
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(async()=>{
  // 自动确认所有弹窗/判定/目标选择，避免卡住
  showChoiceModal=(t,d,x,o,cb)=>cb(0);showCardPickerMulti=(c,ti,cb,n)=>{const ix=[];for(let k=0;k<Math.min(n||1,c.length);k++)ix.push(k);cb(ix);};
  showTargetSelect=(c,e,cb)=>cb('p2');judgePerform=(u,s,cb)=>cb(s.kind==='coin'?'正面':(s.sides||6));
  const log=[];
  // 用随机卡组开战
  const mk=()=>{const d=buildSmartDeck(ARCH_LIST[0]);d.chars=d.chars.concat(Array(Math.max(0,3-d.chars.length)).fill(null));d.items=d.items.concat(Array(Math.max(0,8-d.items.length)).fill(null));d.carries=d.carries.concat(Array(Math.max(0,4-d.carries.length)).fill(null));return d;};
  deckConfig={p1:mk(),p2:mk()};
  if(typeof startBattle==='function')startBattle(); else initBattle();
  await new Promise(r=>setTimeout(r,200));
  log.push('afterStart phase='+battleState.phase+' p1hand='+battleState.p1.hand.length);
  // 推进到roll并投骰
  for(let i=0;i<6;i++){ if(typeof nextPhase==='function'){nextPhase();} await new Promise(r=>setTimeout(r,30)); }
  log.push('phaseNow='+battleState.phase+' pos='+battleState.p1.position);
  return {log,hasState:!!battleState,p1sync:battleState.p1.sync,handN:battleState.p1.hand.length,deckN:battleState.p1.deck.length};
 });
 console.log(JSON.stringify(R,null,1));
 console.log('errors:',errs.length,errs.slice(0,5).join(' | '));
 await b.close();process.exit(errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
