/* 比翼恋理领域增益 + “前方/前后N格内含自身格”范围规则 回归 */
const { chromium } = require('playwright-core');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
(async()=>{
  const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await b.newPage({viewport:{width:1440,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});
  const R=await page.evaluate(()=>{
    const out={};
    window.deckConfig={};
    const biyi=window.cardData.skill_cards.find(c=>c.name==='比翼恋理');
    out.foundBiyi=!!biyi;
    // 1 卡面解析：攻击力+50% / 热忱克制+100%(克制+1变+2) / 判定+2
    const db=parseDomainBuff(biyi.effect);
    out.parse_atkPct=db.atkPct; out.parse_counterAdd=db.counterAdd; out.parse_counterAttr=db.counterAttr; out.parse_judge=db.judgeBonus;

    // 2 范围含自身格
    const f3=parseAttackRange('前方3格'); const a3=parseAttackRange('前后3格');
    out.fwd_self=canReachByRange(f3,10,10);        // 前方3格含自身所在格 -> true
    out.around_self=canReachByRange(a3,10,10);     // 前后3格含自身 -> true
    out.fwd_far=canReachByRange(f3,10,14);         // 前方4格>3 -> false
    out.fwd_in=canReachByRange(f3,10,13);          // 前方3格 -> true

    function mk(attr,pos){return {sync:40,defense:0,shield:0,hand:[],faceDownCards:[],grave:[],removed:[],permanent:[],deck:[],cost:9,maxCost:12,attackBuff:0,position:pos==null?10:pos,statuses:[],captain:{attribute:attr}};}
    function reset(a1,a2){if(!battleState)battleState={};battleState.phase='main1';battleState.currentPlayer='p1';battleState.p1=mk(a1);battleState.p2=mk(a2);}
    function val(attr,opts){return computeDamageValue('p1','p2',Object.assign({base:0,attr:attr},opts||{})).value;}
    function giveDomain(actions){battleState.p1.statuses=[];StatusSys.add('p1',{type:'domain',range:4,actions:actions==null?3:actions,addedBy:'p1',buff:parseDomainBuff(biyi.effect)});}

    // 3 热忱克制+100%：热忱克无序。无领域克制+1=1；领域内克制+2
    reset('热忱','无序'); out.noDom_counter=val('热忱',{});
    giveDomain(); out.dom_counter=val('热忱',{});

    // 4 攻击力+50%作用于攻击力资源再÷2：4攻 无领域=2；领域内 floor(4*1.5=6)/2=3（同属性不克制）
    reset('理智','理智'); battleState.p1.attackBuff=4; out.noDom_atk=val('理智',{});
    giveDomain(); out.dom_atk=val('理智',{});

    // 5 判定+2：同属性 judge，无领域0，领域内2
    reset('理智','理智'); out.noDom_judge=val('理智',{judge:true});
    giveDomain(); out.dom_judge=val('理智',{judge:true});

    // 6 敌方领域不增益自己：p2挂领域，p1不受益
    reset('热忱','无序'); battleState.p2.statuses=[];StatusSys.add('p2',{type:'domain',range:4,actions:3,addedBy:'p2',buff:parseDomainBuff(biyi.effect)});
    out.enemyDomain_noBoost=val('热忱',{});

    // 7 持续3次行动：自己回合开始每次-1，第3次到0移除，增益回落
    reset('热忱','无序'); giveDomain(3);
    StatusSys.tickAction('p1');StatusSys.tickAction('p1'); out.lapse2=val('热忱',{}); // 还剩1次，仍+2
    StatusSys.tickAction('p1'); out.lapseGone=val('热忱',{});                        // 到0移除，回落+1

    // 8 新领域覆盖旧：先range4再range2，只剩一个domain且为range2
    reset('理智','理智'); StatusSys.add('p1',{type:'domain',range:4,actions:3,addedBy:'p1',buff:parseDomainBuff(biyi.effect)});
    battleState.p1.statuses=battleState.p1.statuses.filter(s=>s.type!=='domain');
    StatusSys.add('p1',{type:'domain',range:2,actions:3,addedBy:'p1',buff:parseDomainBuff(biyi.effect)});
    const doms=battleState.p1.statuses.filter(s=>s.type==='domain');
    out.cover_count=doms.length; out.cover_range=doms[0]&&doms[0].range;
    return out;
  });
  ok(R.foundBiyi,'找到比翼恋理卡');
  ok(Math.abs(R.parse_atkPct-0.5)<1e-9,'解析攻击力+50%');
  ok(R.parse_counterAdd===1,'解析热忱克制+100%→克制部分+1');
  ok(R.parse_counterAttr==='热忱','解析克制属性=热忱');
  ok(R.parse_judge===2,'解析判定伤害+2');
  ok(R.fwd_self===true,'前方N格含自身所在格(同格可达)');
  ok(R.around_self===true,'前后N格含自身所在格');
  ok(R.fwd_far===false,'前方超出N格不可达');
  ok(R.fwd_in===true,'前方恰N格可达');
  ok(R.noDom_counter===1,'无领域热忱克制+1');
  ok(R.dom_counter===2,'领域内热忱克制+1变+2');
  ok(R.noDom_atk===2,'无领域4攻=+2');
  ok(R.dom_atk===3,'领域4攻×1.5=6再÷2=+3');
  ok(R.noDom_judge===0,'无领域同属性判定0');
  ok(R.dom_judge===2,'领域内判定+2');
  ok(R.enemyDomain_noBoost===1,'敌方领域不增益自己');
  ok(R.lapse2===2,'持续剩1次行动仍生效');
  ok(R.lapseGone===1,'3次行动到期移除、增益回落');
  ok(R.cover_count===1,'新领域覆盖旧领域(只剩1个)');
  ok(R.cover_range===2,'覆盖后为新领域range2');
  ok(errs.length===0,'无页面错误: '+(errs.join(';')||'无'));
  await b.close();
  console.log('E2E_domain 结果 pass='+pass+' fail='+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
