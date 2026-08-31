/* 对战网页效果处理 bug 回归测试（真实页面 + Playwright）
 * 覆盖：1牌库空立即重置 2光太郎加献祭次数可用 3回收卡用后放牌组底
 *      4里绪累计回合清零 6引导核心填满升级 7投掷阶段移动道具可用 5过载自己回合抽牌
 */
const { chromium } = require('playwright-core');
const EXE='/usr/local/bin/chromium';
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
(async()=>{
  const browser=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  // 所有选择类弹窗自动选第一项/自动确认，避免异步挂起
  await page.addInitScript(()=>{ window.__autoChoose=true; });
  await page.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});

  const R = await page.evaluate(async()=>{
    const out={};
    // 自动选择，避免弹窗挂起
    showChoiceModal=(t,n,d,o,cb)=>cb&&cb(0);
    showCardPickerMulti=(list,title,cb,n)=>cb(0);
    // 配合法双方，并把光太郎放进 p1 队员位
    randomDeck('p1');randomDeck('p2');
    const kotaro=window.cardData.characters.find(c=>c.name&&c.name.indexOf('光太郎')>=0);
    if(kotaro) deckConfig.p1.chars[1]=kotaro;
    out.validate=[validateDeck('p1').length,validateDeck('p2').length];
    startBattle();
    await new Promise(r=>setTimeout(r,700));
    const p=battleState.p1;

    // ---- bug2: 光太郎队员SP 献祭次数+1，可连续献祭2次 ----
    out.sacBonus=p._sacrificeBonus||0;
    // 保证有2张手卡与足够费用观测净变化
    const before={hand:p.hand.length,grave:p.grave.length,cost:p.cost};
    doSacrifice(); await new Promise(r=>setTimeout(r,60));
    doSacrifice(); await new Promise(r=>setTimeout(r,60));
    out.afterSac={hand:p.hand.length,grave:p.grave.length,cost:p.cost};
    out.sacUsed=p._sacrificeUsedThisTurn;

    // ---- bug1: 牌库空→墓地立即倒置为新牌库并抽到 ----
    p.deck=[]; p.grave=[{name:'G1',cost:1},{name:'G2',cost:1}];
    const d=drawCard('p1');
    out.refill={drew:d&&d.name,deckLen:p.deck.length,graveLen:p.grave.length};

    // ---- bug4: 里绪累计在 startTurn 清零 ----
    p._rioMoveCount=5; p._zhichiMoveCount=5;
    battleState.phase='end';
    startTurn(); await new Promise(r=>setTimeout(r,60));
    out.rioReset={rio:p._rioMoveCount,zhi:p._zhichiMoveCount};

    // ---- bug6: 引导核心填满当前升级条并升级 ----
    p.level=1; p.motivation=0; p._guideCore=1;
    useGuideCore('p1');
    out.guide={level:p.level,motivation:p.motivation,core:p._guideCore};

    // ---- bug7: roll阶段移动类主动道具可用、非移动非骰子道具仍受限 ----
    battleState.phase='roll'; battleState.currentPlayer='p1';
    const moveCard={name:'测试移动卡',cost:0,_category:'item_single',effect:'前进3格'};
    const buffCard={name:'测试纯增益',cost:0,_category:'item_single',effect:'获得1000金币'};
    out.rollMove=evaluatePlayable(moveCard,'p1').ok;
    out.rollBuff=evaluatePlayable(buffCard,'p1').ok;
    out.isMoveRoll=isMoveRollCard(moveCard);

    // ---- bug3: 回收卡(SP写放回牌组最下方)再使用→放回deck底部而非墓地 ----
    battleState.phase='main1';
    const rc={name:'破损电子设备',cost:2,_category:'item_single',sp:'被回收后的此卡使用后放回牌组最下方。',_recycled:true};
    p.deck=[]; p.grave=[];
    placeAfterUse('p1',rc,false);
    out.recycle={inDeck:p.deck.length===1,inGrave:p.grave.length===0,recycledCleared:rc._recycled===false};

    // ---- bug5: 过载在自己回合因用卡进墓立即抽1 ----
    p._overload={until:3}; p.deck=[{name:'N1',cost:1}]; const beforeHand=p.hand.length;
    const oc={name:'过载测试卡',cost:0,_category:'item_single',effect:'获得1000金币'};
    settleCardExecution(oc,'p1','p2',{actualCost:0},()=>{});
    await new Promise(r=>setTimeout(r,800));
    out.overload={handGain:p.hand.length-beforeHand};

    // ---- bug2 补充：效果处理路径 sacrificeCards 也吃加次数（一次送2张均成功）----
    p._sacrificeBonus=1; p._sacrificeUsedThisTurn=0; p.hand=[{name:'S1',_category:'item_single'},{name:'S2',_category:'item_single'}]; p.grave=[];
    p._kotaroSP=false; p._kaedeSacrificeDamage=false; p._lilithSacHeal=false; p._meiSPBeta=false;
    await new Promise(res=>sacrificeCards('p1',[{zone:'hand',card:p.hand[0]},{zone:'hand',card:p.hand[1]}],false,res));
    out.sacCore={grave:p.grave.length,used:p._sacrificeUsedThisTurn};

    // ---- bug3同类：共鸣“进墓地后…花2音韵回收”也应被识别并正确扣2费 ----
    p.cost=5; const gm={name:'共鸣',_category:'skill_cards',sp:'此卡进墓地后可花2音韵回收，被回收后使用放回牌组最下方',effect:'自己回合选一名玩家，其抽1张馈赠卡。'};
    p.grave=[gm]; p.hand=[];
    checkGraveTrigger('p1',gm,'use'); await new Promise(r=>setTimeout(r,150));
    out.recyIdentify={recycled:gm._recycled===true,inHand:p.hand.indexOf(gm)>=0,cost:p.cost};

    return out;
  });
  console.log(JSON.stringify(R,null,1));
  ok(R.validate&&R.validate[0]===0&&R.validate[1]===0,'双方卡组合法');
  ok(R.sacBonus>=1,'bug2 光太郎队员SP使献祭次数+1（bonus='+R.sacBonus+'）');
  ok(R.sacUsed===2,'bug2 可连续献祭2次（实际used='+R.sacUsed+'，墓增'+(R.afterSac.grave)+'）');
  ok(R.refill.drew&&R.refill.graveLen===0&&R.refill.deckLen===1,'bug1 牌库空立即用墓地倒置并抽到（抽到'+R.refill.drew+'）');
  ok(R.rioReset.rio===0&&R.rioReset.zhi===0,'bug4 里绪/直尺累计回合开始归零');
  ok(R.guide.level===2&&R.guide.core===0,'bug6 引导核心填满累计条并升级到Lv2（motivation='+R.guide.motivation+'）');
  ok(R.isMoveRoll&&R.rollMove===true,'bug7 投掷阶段移动类道具可发动');
  ok(R.rollBuff===false,'bug7 投掷阶段非移动/非骰子道具仍受限');
  ok(R.recycle.inDeck&&R.recycle.inGrave&&R.recycle.recycledCleared,'bug3 回收卡再使用放回牌组最下方');
  ok(R.overload.handGain===1,'bug5 过载自己回合用卡进墓立即抽1（净增'+R.overload.handGain+'）');
  ok(R.sacCore&&R.sacCore.grave===2&&R.sacCore.used===2,'bug2 效果处理献祭路径同样可用满加次数（墓'+(R.sacCore&&R.sacCore.grave)+'）');
  ok(R.recyIdentify&&R.recyIdentify.recycled&&R.recyIdentify.inHand&&R.recyIdentify.cost===3,'bug3同类 共鸣“进墓地后花2音韵回收”被正确识别并扣2费（费'+(R.recyIdentify&&R.recyIdentify.cost)+'）');
  ok(errs.length===0,'页面无致命JS错误'+(errs.length?('：'+errs.slice(0,2)):''));
  await browser.close();
  console.log(`\n效果bug回归: 通过 ${pass} 失败 ${fail}`);
  process.exit(fail?1:0);
})().catch(e=>{console.error('测试异常',e);process.exit(1);});
