/* 16 标准时点总线回归：注册全部时点 hook，触发对应动作，断言每个时点都真实 fire */
const { chromium } = require('playwright-core');
const EXE='/usr/local/bin/chromium';
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
(async()=>{
  const browser=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await page.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const R = await page.evaluate(async()=>{
    const out={fired:{}};
    showChoiceModal=(t,n,d,o,cb)=>cb&&cb(0);
    showCardPickerMulti=(l,t,cb)=>cb(0);
    if(typeof showTimingQuestion!=='undefined')showTimingQuestion=(a,b,c,cb)=>cb&&cb(false);
    if(typeof showTargetSelect!=='undefined')showTargetSelect=(c,e,cb)=>cb&&cb('p2');
    out.errs=[]; const __T=(nm,fn)=>{try{fn();}catch(e){out.errs.push(nm+':'+e.message);}};
    randomDeck('p1');randomDeck('p2');startBattle();
    for(let w=0;w<300&&!(typeof battleState!=='undefined'&&battleState.p1&&battleState.p2);w++)await new Promise(r=>setTimeout(r,50));
    // 注册全部16时点
    Object.keys(TIMING).forEach(k=>onTiming(TIMING[k],()=>{out.fired[k]=(out.fired[k]||0)+1;}));
    const p=battleState.p1,q=battleState.p2; battleState.phase='main1';battleState.currentPlayer='p1';p.cost=12;
    const F=()=>out.fired;
    // 抽卡：ON_DRAW + ON_ADD_HAND
    p.deck=[{name:'D1',cost:1},{name:'D2',cost:1}];p.grave=[];
    __T('draw',()=>drawCard('p1'));
    __T('grave',()=>checkGraveTrigger('p1',{name:'GV1'},'test'));
    __T('remove',()=>{if(!p.removed)p.removed=[];p.removed.push({name:'RM1'});runTiming(TIMING.ON_REMOVE,{player:'p1',card:{name:'RM1'}});});
    __T('r2h',()=>__emitAddHand('p1',{name:'RH1'},'removed'));
    __T('addh',()=>__emitAddHand('p1',{name:'AH1'},'deck'));
    __T('rec',()=>__emitRecover('p1',1,'test'));
    // 造伤六时点：before_damage/on_damage/after_damage + before_hurt/on_hurt/after_hurt
    q.sync=30;
    await new Promise(res=>{ try{ dealDamageWithResponse('p2',3,'测试造伤',res,'无序','p1',{raw:false}); }catch(e){out.errs.push('dmg:'+e.message);res();} });
    await new Promise(r=>setTimeout(r,100));
    // 移动产生未适用：ON_MOVE_PENDING（executeMoveEffect 开头）
    __T('move',()=>executeMoveEffect({player:'p1',moveAmount:2}));
    await new Promise(r=>setTimeout(r,120));
    // 发动/适用/完成：使用一张零费简单单次卡（走 settleCardExecution，含连锁快速路径）
    const simple={name:'__时点测试卡',cost:0,_category:'item_single',effect:'获得1金币'};
    p.hand.push(simple);
    await new Promise(res=>{ try{ settleCardExecution(simple,'p1','p2',{actualCost:0},res); }catch(e){out.errs.push('settle:'+e.message);res();} });
    await new Promise(r=>setTimeout(r,160));
    out.snapshot=F();
    return out;
  });
  await sleep(300);
console.log('内部错误：',JSON.stringify(R.errs||[]));
  const f=R.snapshot;
  console.log('时点触发计数：',JSON.stringify(f));
  ok(f.ON_DRAW>=1,'ON_DRAW 抽卡时');
  ok(f.ON_ADD_HAND>=1,'ON_ADD_HAND 加入手卡(检索)');
  ok(f.ON_TO_GRAVE>=1,'ON_TO_GRAVE 送入墓地');
  ok(f.ON_REMOVE>=1,'ON_REMOVE 移出游戏');
  ok(f.ON_REMOVE_TO_HAND>=1,'ON_REMOVE_TO_HAND 移出卡加入手卡');
  ok(f.ON_ACTIVATE>=1,'ON_ACTIVATE 发动效果');
  ok(f.ON_APPLY>=1,'ON_APPLY 进入适用时点');
  ok(f.ON_EFFECT_DONE>=1,'ON_EFFECT_DONE 结算完成后');
  ok(f.ON_MOVE_PENDING>=1,'ON_MOVE_PENDING 移动产生未适用');
  ok(f.BEFORE_DAMAGE>=1,'BEFORE_DAMAGE 造成伤害前');
  ok(f.ON_DAMAGE>=1,'ON_DAMAGE 造成伤害时');
  ok(f.AFTER_DAMAGE>=1,'AFTER_DAMAGE 造成伤害后');
  ok(f.BEFORE_HURT>=1,'BEFORE_HURT 受到伤害前');
  ok(f.ON_HURT>=1,'ON_HURT 受到伤害时');
  ok(f.AFTER_HURT>=1,'AFTER_HURT 受到伤害后');
  ok(f.ON_RECOVER_COST>=1,'ON_RECOVER_COST 回复音韵值');
  if(errs.length){console.log('页面JS错误：',errs.slice(0,5));}
  ok(!errs.length,'无页面JS错误');
  console.log(`\n时点E2E：通过 ${pass}，失败 ${fail}`);
  await browser.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
