/* 里绪形态/技能卡归属/判定动画 回归（真实页面） */
const { chromium } = require('playwright-core');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
(async()=>{
  const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await b.newPage({viewport:{width:1440,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});
  const R=await page.evaluate(async()=>{
    const out={};
    showChoiceModal=(t,n,d,o,cb)=>cb&&cb(window.__pick!=null?window.__pick:0);
    showCardPickerMulti=(l,t,cb)=>cb(0);
    const chars=window.cardData.characters;
    const rio=chars.find(c=>c.name==='现实间里绪');
    const rioM=chars.find(c=>c.name==='里绪(水着)');
    const other=chars.find(c=>c.name!=='现实间里绪'&&c.name!=='里绪(水着)');
    const skill=window.cardData.skill_cards.find(c=>c.name==='认真起来了！');

    // —— 场景1：技能卡形态归属（不 startBattle，直接构造 deckConfig + battleState 最小环境）——
    deckConfig.p1={chars:[other,other,other],items:[],attacks:[]};
    battleState={p1:{cost:9,usedSkillsThisTurn:[],hand:[],deck:[],grave:[],permanent:[]},p2:{sync:30,defense:0,shield:0,hand:[],grave:[],deck:[]}};
    battleState.phase='main1';battleState.currentPlayer='p1';
    out.skillNoRio=evaluatePlayable(skill,'p1').ok;                       // 不带现实间里绪→false
    deckConfig.p1.chars=[rio,other,other];
    out.skillWithRio=evaluatePlayable(skill,'p1').ok;                     // 带现实间里绪→true
    deckConfig.p1.chars=[rioM,other,other];
    out.skillOnlyMizugi=evaluatePlayable(skill,'p1').ok;                  // 只带水着→false（不通用）
    out.skillReason=evaluatePlayable(skill,'p1').reason;

    // —— 场景2：被动标记精确（直接调 processCharacterPassives 两次）——
    function passiveOf(cap){
      deckConfig.p1.chars=[cap,other,other];
      battleState.p1._rioPassive=false;
      processCharacterPassives('p1');
      return !!battleState.p1._rioPassive;
    }
    out.passiveNormal=passiveOf(rio);    // 现实间里绪队长→true
    out.passiveMizugi=passiveOf(rioM);   // 水着队长→false

    // —— 场景3：累计8格→付费1+四面骰动画+造伤 ——
    deckConfig.p1.chars=[rio,other,other];
    battleState.p1._rioPassive=true;battleState.p1._rioMoveCount=0;battleState.p1._rioFirstTriggerThisTurn=false;
    battleState.p1._judgeDamageBonus=0; // 隔离SP判定增伤，纯净验证“四面骰+首次热忱”
    battleState.p1.cost=5;battleState.p2.sync=30;
    let animSpec=null,dmgCalls=[];
    const realAnim=window.judgeAnimate;
    window.judgeAnimate=(u,spec,cb)=>{animSpec=spec;cb(spec.fixed!=null?spec.fixed:3);};
    dealDamageWithResponse=(t,d,src,cb)=>{dmgCalls.push({t,d});battleState[t].sync=Math.max(0,battleState[t].sync-d);if(cb)cb(d);};
    window.__pick=0; // 选择“支付1音韵发动”
    rioAccumulateMove('p1',8);
    await new Promise(r=>setTimeout(r,30));
    out.payCost=battleState.p1.cost;                 // 5-1=4
    out.animSides=animSpec&&animSpec.sides;          // 4
    out.animKind=animSpec&&animSpec.kind;            // dice
    out.dmgDealt=dmgCalls.length&&dmgCalls[0].d;     // 3骰+首次1热忱=4
    // 选择“不发动”：不付费不造伤
    battleState.p1._rioMoveCount=8;battleState.p1.cost=5;dmgCalls=[];window.__pick=1;
    rioAccumulateMove('p1',8);await new Promise(r=>setTimeout(r,30));
    out.declineCost=battleState.p1.cost; out.declineDmg=dmgCalls.length;
    window.__pick=0;window.judgeAnimate=realAnim;

    // —— 场景4：通用文本判定造伤会调 judgeAnimate ——
    let anim4=null;window.judgeAnimate=(u,spec,cb)=>{anim4=spec;cb(spec.fixed!=null?spec.fixed:3);};
    await new Promise(res=>processSingleEffect('对一名其他玩家造成一次四面骰判定伤害',{user:'p1',target:'p2',card:{name:'摸头杀',attribute:'热忱'}},res));
    out.processAnimSides=anim4&&anim4.sides;
    return out;
  });
  console.log(JSON.stringify(R,null,1));
  ok(R.skillNoRio===false,'技能卡：未编入现实间里绪时不能用【认真起来了】');
  ok(R.skillWithRio===true,'技能卡：编入现实间里绪后可用');
  ok(R.skillOnlyMizugi===false,'技能卡：只编入里绪(水着)不能混用普通形态技能');
  ok(/未编入/.test(R.skillReason||''),'技能卡：拦截原因明确');
  ok(R.passiveNormal===true,'被动：现实间里绪队长启用移动累计被动');
  ok(R.passiveMizugi===false,'被动：里绪(水着)队长不触发普通里绪移动累计');
  ok(R.payCost===4,'里绪被动：发动支付1音韵（5→4）');
  ok(R.animKind==='dice'&&R.animSides===4,'里绪被动：走四面骰判定动画');
  ok(R.dmgDealt===4,'里绪被动：四面骰3点+本回合首次1热忱=4点');
  ok(R.declineCost===5&&R.declineDmg===0,'里绪被动：选“不发动”不付费不造伤');
  ok(R.processAnimSides===4,'通用判定造伤（摸头杀类）播四面骰动画');
  ok(errs.length===0,'页面无致命JS错误'+(errs.length?('：'+errs.slice(0,2)):''));
  await b.close();
  console.log(`\n里绪形态回归: 通过 ${pass} 失败 ${fail}`);
  process.exit(fail?1:0);
})().catch(e=>{console.error('异常',e);process.exit(1);});
