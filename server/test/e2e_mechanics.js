/* 综合机制回归：分段顺序 / 多选一 vs 顺序执行 / 可选 / 区间 / 检索非随机 / 盖伏 / 攻击距离含自身格 */
const { chromium } = require('playwright-core');
const EXE='/usr/local/bin/chromium';
let pass=0,fail=0; const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
(async()=>{
  const browser=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));page.on('dialog',d=>d.dismiss().catch(()=>{}));
  await page.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});
  const D=await page.evaluate(async()=>{
    showChoiceModal=(t,n,d,o,cb)=>cb&&cb(0);showCardPickerMulti=(l,t,cb)=>cb(0);
    const out={};
    // 1) 分段：那之后 切成 main + after_that 两步，顺序固定
    const steps=parseEffect('造成2点伤害。那之后抽1张卡');
    out.segCount=steps.length; out.segTypes=steps.map(s=>s.type);
    // 2) 选一项：互斥单 choice，两支
    const ch=compileStepOps('从以下效果选一项：①造成2点无序伤害②抽1张卡',false);
    out.choiceOps=ch.map(o=>o.op); out.choiceBranches=(ch.find(o=>o.op==='choice')||{}).branches&&ch.find(o=>o.op==='choice').branches.length;
    // 3) 并列“获得：①②”顺序执行，不含 choice
    const od=compileStepOps('获得：①抽1张卡②回复1点音韵值',false);
    out.orderedHasChoice=od.some(o=>o.op==='choice'); out.orderedLen=od.length;
    // 4) 句首“可以”→ optional 包裹
    const op=compileStepOps('可以回复2点同步值',false);
    out.optionalOps=op.map(o=>o.op);
    // 5) 区间 前进3-6格 → move_choice
    const rg=compileStepOps('前进3-6格',false);
    out.rangeOps=rg.map(o=>o.op);
    // 6) 检索非随机：构造牌组，collectZoneCards 返回全部匹配
    randomDeck('p1');randomDeck('p2');startBattle();
    for(let w=0;w<300&&!(battleState&&battleState.p1&&battleState.p2);w++)await new Promise(r=>setTimeout(r,50));
    const p=battleState.p1;
    p.deck=[
      {name:'I1',_category:'item_single',attribute:'无序'},
      {name:'I2',_category:'item_single',attribute:'热忱'},
      {name:'I3',_category:'item_single',attribute:'无序'},
      {name:'A1',_category:'attack_cards',attribute:'无序'}
    ];
    const list=collectZoneCards('p1',['deck'],null,['item_single'],null);
    out.searchAll=list.length; // 应=3（全部匹配的单次道具，非随机1张）
    // 7) 盖伏：写了可盖伏才行；占位占处理区；不预交费
    const fd={name:'可盖卡',cost:3,_category:'item_single',effect:'可盖伏。造成1点伤害。'};
    const nfd={name:'不可盖卡',cost:1,_category:'item_single',effect:'造成1点伤害。'};
    out.canFD=canCardBeFaceDown(fd); out.cannotFD=canCardBeFaceDown(nfd);
    p.hand=[fd];p.permanent=[];p.faceDownCards=[];p.cost=5;battleState.currentPlayer='p1';battleState.turn=1;
    faceDownFromHand(0);
    out.fdNoCost=p.cost===5; // 盖伏不扣费
    out.fdOccupies=p.faceDownCards.length===1 && p.hand.length===0;
    // 当回合不能发动
    battleState.turn=1;fd._faceDownTurn=1;fd._faceDownPlayer='p1';battleState.currentPlayer='p1';
    out.fdSameTurnBlocked=(activateFaceDown(0,'p1')===false);
    // 8) 攻击距离：同行可打、对行不可打；首分句造伤才需要目标
    let same=null,diff=null;
    for(let i=0;i<42&&!same;i++)for(let j=0;j<42;j++){if(i!==j&&isSameRow(i,j)){same=[i,j];break;}}
    for(let i=0;i<42&&!diff;i++)for(let j=0;j<42;j++){if(!isSameRow(i,j)){diff=[i,j];break;}}
    const rowCard={_category:'attack_cards',attack_range:'同一行玩家',effect:'对同一行玩家造成2点伤害'};
    battleState.phase='main1';battleState.currentPlayer='p1';
    battleState.p1.position=same[0];battleState.p2.position=same[1];
    out.rowSame=hasEnemyInAttackRange(rowCard,'p1');
    battleState.p1.position=diff[0];battleState.p2.position=diff[1];
    out.rowDiff=hasEnemyInAttackRange(rowCard,'p1');
    out.dmgFirstNeed=attackNeedsEnemy(rowCard);
    out.moveFirstNoNeed=!attackNeedsEnemy({_category:'attack_cards',attack_range:'前方3格',effect:'前进2格。那之后造成1点伤害'});
    // 无目标时 evaluatePlayable 禁用
    out.greyWhenNoTarget=evaluatePlayable(rowCard,'p1').ok===false;
    battleState.p1.position=same[0];battleState.p2.position=same[1];
    out.okWhenInRange=evaluatePlayable(rowCard,'p1').ok===true;
    out.samePair=same;out.diffPair=diff;
    return out;
  });
  console.log(JSON.stringify(D,null,0));
  ok(D.segCount===2,'那之后切成2步（实际'+D.segCount+'）');
  ok(D.segTypes[0]==='main'&&D.segTypes[1]==='after_that','分段顺序 main→after_that');
  ok(D.choiceOps.indexOf('choice')>=0,'选一项编译为 choice');
  ok(D.choiceBranches===2,'choice 含2个互斥分支');
  ok(!D.orderedHasChoice,'并列获得：不含 choice（顺序执行）');
  ok(D.orderedLen>=2,'并列获得：编译出≥2个顺序动作');
  ok(D.optionalOps.indexOf('optional')>=0,'句首可以→optional（实际'+D.optionalOps+'）');
  ok(D.rangeOps.indexOf('move_range')>=0,'前进3-6格→move_range区间选择（实际'+D.rangeOps+'）');
  ok(D.searchAll===3,'检索返回全部3张匹配卡（非随机1张，实际'+D.searchAll+'）');
  ok(D.canFD&&!D.cannotFD,'仅写了可盖伏的卡能盖伏');
  ok(D.fdNoCost,'盖伏不预支费用');
  ok(D.fdOccupies,'盖伏卡占效果处理区并离开手牌');
  ok(D.fdSameTurnBlocked,'盖伏当回合不能发动');
  ok(!!D.samePair&&!!D.diffPair,'地图存在同行/对行样本 '+JSON.stringify(D.samePair)+'/'+JSON.stringify(D.diffPair));
  ok(D.rowSame===true,'同一行目标在范围内');
  ok(D.rowDiff===false,'对行目标不在同一行范围（不能打）');
  ok(D.dmgFirstNeed===true,'首分句造伤需要敌方目标');
  ok(D.moveFirstNoNeed===true,'首分句是移动则不做范围限制');
  ok(D.greyWhenNoTarget===true,'范围内无目标时攻击卡变灰不可用');
  ok(D.okWhenInRange===true,'范围内有目标时可用');
  ok(!errs.length,'无页面JS错误 '+(errs[0]||''));
  console.log('\n机制E2E：通过',pass,'失败',fail);
  await browser.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
