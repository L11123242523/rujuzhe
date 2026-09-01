/* 全真实卡牌执行冒烟：每张 单次/攻击/技能/永续 都能被效果引擎无异常执行到完成，
 * 不允许抛错、不允许出现未处理 op、不允许回调永远不触发（卡死）。 */
const { chromium } = require('playwright-core');
const EXE='/usr/local/bin/chromium';
let pass=0,fail=0; const fails=[];
(async()=>{
  const browser=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await page.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});
  const R=await page.evaluate(async()=>{
    showChoiceModal=(t,n,d,o,cb)=>cb&&cb(0);
    showCardPickerMulti=(l,t,cb)=>cb(Array.isArray(l)&&l.length?[0]:0);
    if(typeof showTimingQuestion!=='undefined')showTimingQuestion=(a,b,c,cb)=>cb&&cb(false);
    if(typeof showTargetSelect!=='undefined')showTargetSelect=(c,e,cb)=>cb&&cb('p2');
    if(typeof showTargetCards!=='undefined')showTargetCards=(w,z,t,s,cb)=>{const a=battleState[w][z]||[];cb(a[0],0);};
    randomDeck('p1');randomDeck('p2');startBattle();
    for(let w=0;w<400&&!(battleState&&battleState.p1&&battleState.p2);w++)await new Promise(r=>setTimeout(r,50));
    battleState.phase='main1';battleState.currentPlayer='p1';
    const cats=['item_single','attack_cards','skill_cards'];
    const report={ran:0,compileBad:[],execBad:[],permBad:[]};
    function topup(){const A=battleState.p1,B=battleState.p2;[A,B].forEach(p=>{p.cost=12;p.sync=40;p.maxSync=40;p.gold=9999;if(p.deck.length<3)for(let i=0;i<6;i++)p.deck.push({name:'填充'+i,cost:0,_category:'item_single',effect:'获得1金币'});if(!p.grave)p.grave=[];if(!p.removed)p.removed=[];if(!p.permanent)p.permanent=[];});}
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    // —— 单次/攻击/技能：编译 + 完整 settleCardExecution ——
    for(const cat of cats){
      const list=allCards.filter(c=>c._category===cat);
      for(const card of list){
        topup();
        let ops=null,compileErr=null;
        try{ ops=compileStepOps(card.effect||card.text||'',false); }catch(e){compileErr=e.message;}
        if(compileErr){report.compileBad.push(card.name+':'+compileErr);continue;}
        if(ops===undefined||ops===null){report.compileBad.push(card.name+':编译结果'+ops);continue;}
        const clone=Object.assign({},card);clone.cost=0; // 费用拉满避免资源分支
        battleState.p1.hand=[clone];
        let done=false,execErr=null;
        try{ settleCardExecution(clone,'p1','p2',{actualCost:0},()=>{done=true;}); }catch(e){execErr=e.message;}
        for(let w=0;w<100&&!done&&!execErr;w++)await wait(30);
        if(execErr)report.execBad.push(card.name+':'+execErr);
        else if(!done)report.execBad.push(card.name+':回调未触发(卡死)');
        else report.ran++;
      }
    }
    // —— 永续：resolvePermanentOnPlay 首次发动时效果 ——
    const perms=allCards.filter(c=>c._category==='item_permanent');
    for(const card of perms){
      topup();
      const clone=Object.assign({},card);clone.cost=0;
      let done=false,perr=null;
      try{ resolvePermanentOnPlay(clone,'p1',()=>{done=true;}); }catch(e){perr=e.message;}
      for(let w=0;w<80&&!done&&!perr;w++)await wait(30);
      if(perr)report.permBad.push(card.name+':'+perr);
      else if(!done)report.permBad.push(card.name+':发动时效果未完成');
      else report.ran++;
    }
    return report;
  });
  console.log('成功执行到完成的卡数：',R.ran);
  console.log('编译异常：',JSON.stringify(R.compileBad));
  console.log('执行异常/卡死：',JSON.stringify(R.execBad));
  console.log('永续发动异常：',JSON.stringify(R.permBad));
  if(R.compileBad.length===0)pass++;else fail++;
  if(R.execBad.length===0)pass++;else fail++;
  if(R.permBad.length===0)pass++;else fail++;
  if(errs.length===0)pass++;else{fail++;console.log('页面错误：',errs.slice(0,8));}
  console.log('\n全卡冒烟：通过',pass,'失败',fail);
  await browser.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
