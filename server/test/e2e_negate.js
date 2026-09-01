/* 反制整效（崩塌之乌托邦）连锁回归：
 * 1 仅对含加手/送墓/抽/检索的源效果可连锁 2 纯增益不可连锁 3 逆结算 negate 令整效 cancelled */
const { chromium } = require('playwright-core');
const EXE='/usr/local/bin/chromium';
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
(async()=>{
  const browser=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await page.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});
  const R=await page.evaluate(async()=>{
    showChoiceModal=(t,n,d,o,cb)=>cb&&cb(o.length-1); // 默认不连锁
    showCardPickerMulti=(l,t,cb)=>cb(0);
    randomDeck('p1');randomDeck('p2');startBattle();
    for(let w=0;w<300&&!(battleState&&battleState.p1&&battleState.p2);w++)await new Promise(r=>setTimeout(r,50));
    const out={};
    const collapse=window.cardData.item_single.find(c=>c.name&&c.name.indexOf('崩塌')>=0);
    out.found=!!collapse;
    battleState.p2.hand=[Object.assign({},collapse)]; battleState.p2.cost=12;
    // 分类
    out.kind=RJEngine.classifyChainCard(battleState.p2.hand[0]);
    // 1) 含“加入手卡”的源效果 → p2 可连锁到崩塌
    const effSearch={_stage:'effect_activate',player:'p1',card:{name:'检索源',effect:'从牌组选1张道具卡加入手卡'}};
    out.canChainSearch=collectChainable('p2',effSearch).length;
    // 含“送入墓地”的源效果 → 可连锁
    const effMill={_stage:'effect_activate',player:'p1',card:{name:'送墓源',effect:'选对手1张手卡送入墓地'}};
    out.canChainMill=collectChainable('p2',effMill).length;
    // 2) 纯增益 → 不可连锁
    const effGold={_stage:'effect_activate',player:'p1',card:{name:'金币',effect:'获得3金币'}};
    out.cannotChainGold=collectChainable('p2',effGold).length;
    // 费用不足不可连锁
    battleState.p2.cost=0;
    out.noCost=collectChainable('p2',effSearch).length;
    battleState.p2.cost=12;
    // 3) 逆结算 negate → cancelled
    const eff={_stage:'effect_activate',player:'p1',card:{name:'检索源',effect:'从牌组选1张加入手卡'},_chain:[{kind:'negate',by:'p2',name:'崩塌之乌托邦'}]};
    await new Promise(res=>resolveChainStack(eff,()=>res()));
    out.cancelled=!!eff.cancelled;
    // 4) 空链（双方都无反制）→ 不 cancelled
    const eff2={_stage:'effect_activate',player:'p1',card:{name:'金币',effect:'获得3金币'},_chain:[]};
    await new Promise(res=>resolveChainStack(eff2,()=>res()));
    out.emptyKept=!eff2.cancelled;
    return out;
  });
  ok(R.found,'找到崩塌之乌托邦');
  ok(R.kind==='negate_effect','分类为 negate_effect（实际:'+R.kind+'）');
  ok(R.canChainSearch===1,'含加入手卡的效果可被反制');
  ok(R.canChainMill===1,'含送入墓地的效果可被反制');
  ok(R.cannotChainGold===0,'纯增益不可被反制');
  ok(R.noCost===0,'费用不足不能反制');
  ok(R.cancelled,'逆结算后整效被无效(cancelled)');
  ok(R.emptyKept,'无连锁时效果保留');
  ok(!errs.length,'无页面JS错误 '+(errs[0]||''));
  console.log('\n反制E2E：通过',pass,'失败',fail);
  await browser.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
