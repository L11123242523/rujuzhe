/* 统一伤害管线 + 造成伤害前时点（镇定药片）回归，驱动真实 dealDamageWithResponse/computeDamageValue */
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
    // 仅覆盖 UI/动画，保留真实伤害管线
    showChoiceModal=(t,n,d,o,cb)=>{window.__lastTitle=t;cb&&cb(window.__pick!=null?window.__pick:0);};
    showCardPickerMulti=(l,t,cb)=>cb(0);
    rwOpen=()=>{};rwClose=()=>{};updateBattleUI=()=>{};checkBattleEnd=()=>{};redraw=()=>{};
    judgeAnimate=(u,spec,cb)=>cb(spec.fixed!=null?spec.fixed:(spec.kind==='coin'?'正面':3));
    const calm=window.cardData.item_single.concat(window.cardData.item_permanent).find(c=>c.name==='镇定药片');
    out.foundCalm=!!calm;
    function mk(attr){return {sync:40,defense:0,shield:0,hand:[],faceDownCards:[],grave:[],removed:[],permanent:[],deck:[],cost:9,maxCost:12,attackBuff:0,captain:{attribute:attr}};}
    window.deckConfig={}; // 空队伍配置，使 getTeamAttribute 回退到 battleState[x].captain.attribute
    function reset(a1,a2){if(!battleState)battleState={};battleState.phase='main1';battleState.currentPlayer='p1';battleState.p1=mk(a1);battleState.p2=mk(a2);window.__pick=0;}
    function hit(base,attr,opts){return new Promise(res=>{dealDamageWithResponse('p2',base,'测试',()=>res(),attr,'p1',opts||{});setTimeout(()=>res(),30);});}

    // A 高防5：判定增伤+2、理智克热忱+1，括号内 core=max(0,3-5)=0，括号外共+3 => 扣3（旧实现增伤被防御吃掉=0）
    reset('理智','热忱');battleState.p2.defense=5;battleState.p1._judgeDamageBonus=2;
    await hit(3,'理智',{judge:true,kind:'sanity'});
    out.A_highDefBonus=40-battleState.p2.sync;

    // B 克制只加一次：无序克理智，base2 def0 => 3（不是4）
    reset('无序','理智');await hit(2,'无序',{});
    out.B_counterOnce=40-battleState.p2.sync;

    // C 攻击力÷2向下取整：2攻=+1，被1防抵消 =>0
    reset('理智','理智');battleState.p1.attackBuff=2;battleState.p2.defense=1;
    await hit(0,'理智',{});
    out.C_attack=40-battleState.p2.sync;
    // C2 不足2点攻击力不增加伤害：1攻 def0 base0 =>0
    reset('理智','理智');battleState.p1.attackBuff=1;
    await hit(0,'理智',{});
    out.C2_oneAtk=40-battleState.p2.sync;
    // C3 3点攻击力向下取整=+1：def0 base0 =>1
    reset('理智','理智');battleState.p1.attackBuff=3;
    await hit(0,'理智',{});
    out.C3_threeAtk=40-battleState.p2.sync;

    // D 判定伤害吃属性克制（旧文本层判定丢克制）：理智克热忱，def10，base1，无判定增伤 => core0+克制1=1
    reset('理智','热忱');battleState.p2.defense=10;
    await hit(1,'理智',{judge:true,kind:'sanity'});
    out.D_judgeCounter=40-battleState.p2.sync;

    // E 镇定药片：造成伤害前选手牌送墓，最终+2。同属性理智不克制，base2 => 4，且卡进墓地
    reset('理智','理智');battleState.p1.hand=[JSON.parse(JSON.stringify(calm))];window.__pick=0;
    await hit(2,'理智',{});
    out.E_calmBoost=40-battleState.p2.sync;
    out.E_calmToGrave=battleState.p1.grave.some(c=>c.name==='镇定药片');
    out.E_title=window.__lastTitle;

    // F 镇定药片选“不使用”：仍为 base2，卡留手牌
    reset('理智','理智');battleState.p1.hand=[JSON.parse(JSON.stringify(calm))];
    window.__pick=99; // 最后一项=不使用
    await hit(2,'理智',{});
    out.F_decline=40-battleState.p2.sync;
    out.F_keepHand=battleState.p1.hand.some(c=>c.name==='镇定药片');

    // G 指令层 applyDamageOps → 统一出口衔接：编译“造成6点伤害”，目标2防，同属性不克制 => core=6-2=4（不双重减防）
    reset('理智','理智');battleState.p2.defense=2;
    const gop=compileStepOps('造成6点伤害')[0];
    await new Promise(res=>applyDamageOps('p1','p2',gop,res,null));
    out.G_opcode=40-battleState.p2.sync;
    return out;
  });
  ok(R.foundCalm,'卡牌库含镇定药片');
  ok(R.A_highDefBonus===3,'A 高防下判定增伤+克制不被防御吃掉（扣3） got '+R.A_highDefBonus);
  ok(R.B_counterOnce===3,'B 属性克制全局只+1（扣3） got '+R.B_counterOnce);
  ok(R.C_attack===0,'C 2攻=+1被1防抵消（扣0） got '+R.C_attack);
  ok(R.C2_oneAtk===0,'C2 1点攻击力不足2点不增伤（扣0） got '+R.C2_oneAtk);
  ok(R.C3_threeAtk===1,'C3 3攻向下取整=+1（扣1） got '+R.C3_threeAtk);
  ok(R.D_judgeCounter===1,'D 判定伤害吃到属性克制（扣1） got '+R.D_judgeCounter);
  ok(R.E_calmBoost===4,'E 镇定药片送墓最终+2（扣4） got '+R.E_calmBoost);
  ok(R.E_calmToGrave===true,'E 镇定药片送墓后进入墓地');
  ok(R.E_title==='造成伤害前','E 触发“造成伤害前”时点弹窗 got '+R.E_title);
  ok(R.F_decline===2,'F 拒绝镇定药片则不增伤（扣2） got '+R.F_decline);
  ok(R.F_keepHand===true,'F 拒绝后镇定药片留在手牌');
  ok(R.G_opcode===4,'G 指令层→统一出口衔接正确（扣4，无双重减防） got '+R.G_opcode);
  ok(errs.length===0,'页面无 pageerror（'+errs.join('; ')+'）');
  await b.close();
  console.log('\nE2E_damage 结果 pass=%d fail=%d',pass,fail);process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
