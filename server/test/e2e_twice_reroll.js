const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);}};
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();pg.on('pageerror',e=>console.log('PAGEERR',e.message));pg.on('dialog',d=>d.accept());
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(async()=>{
  const out={};
  // 分类
  const tw=Object.assign({},allCards.find(c=>c.name==='Twice'));
  out.kind=RJEngine.classifyChainCard(tw);
  out.atRand=RJEngine.chainableAt('rand_result','reroll_judge');
  out.atDice=RJEngine.chainableAt('dice_result','reroll_judge');
  // 二选一编译
  const ops=compileStepOps(tw.effect,false);
  out.choiceOp=ops[0]&&ops[0].op; out.labels=(ops[0]&&ops[0].labels)||[];
  out.branchA=ops[0].branches[0][0].op; out.branchB=ops[0].branches[1][0].op;
  // 构造最小 battleState
  battleState={currentPlayer:'p1',phase:'main1',turn:1,resp:{dice:null,move:null,damage:null,rand:null},
    p1:{hand:[],faceDownCards:[],grave:[],cost:9},p2:{hand:[],faceDownCards:[],grave:[],cost:9}};
  // mock judgeAnimate：首次3，之后重判1
  window.__n=0; window.__titles=[];
  judgeAnimate=(u,s,cb)=>{window.__n++; cb(window.__n===1?3:1);};
  renderChainBar=()=>{}; hideChainBar=()=>{}; addBattleLog=()=>{}; updateBattleUI=()=>{};
  function runOnce(hand){return new Promise(res=>{
    battleState.p1.hand=hand.map(c=>Object.assign({},c));battleState.p1.grave=[];battleState.p1.cost=9;
    window.__n=0;
    judgePerform('p1',{kind:'dice',sides:4,label:'测试判定'},(val,cxl)=>res({val,cxl,graveN:battleState.p1.grave.length,cost:battleState.p1.cost}));
  });}
  // 情形1：无连锁卡→快速路径，立即得初始值3
  showChoiceModal=()=>{out.fastPathOpened=true;};
  out.fast=await runOnce([]);
  // 情形2：有Twice，弹窗自动选第0项(Twice)重判
  showChoiceModal=(title,sub,hint,choices,cb)=>{window.__titles.push(title); cb(0);};
  out.reroll=await runOnce([tw]);
  out.rerollTitle=window.__titles[0]||'';
  return out;
 });
 ok(R.kind==='reroll_judge','Twice分类=reroll_judge：'+R.kind);
 ok(R.atRand&&R.atDice,'rand/dice窗口放行reroll_judge');
 ok(R.choiceOp==='choice','Twice编译为二选一choice');
 ok(R.labels.length===2&&/追加/.test(R.labels[0])&&/重新/.test(R.labels[1]),'二选一标签正确：'+JSON.stringify(R.labels));
 ok(R.branchA==='add_roll_phase'&&R.branchB==='reroll_judge','两分支指令正确');
 ok(!R.fastPathOpened&&R.fast.val===3,'无连锁卡快速路径直接得初始值3：'+JSON.stringify(R.fast));
 ok(R.reroll.val===1,'Twice重判后采用新结果1（旧3作废）：'+JSON.stringify(R.reroll));
 ok(R.reroll.graveN===1&&R.reroll.cost===7,'重判后Twice进墓、扣2费（余7）：'+JSON.stringify(R.reroll));
 ok(/判定确定前/.test(R.rerollTitle),'判定窗口弹窗标题正确：'+R.rerollTitle);
 console.log('\nRESULT pass='+pass+' fail='+fail);
 await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
