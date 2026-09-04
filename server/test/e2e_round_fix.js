const { chromium } = require('playwright-core');
const A=[];const ok=(c,m)=>A.push((c?'PASS ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(async()=>{
  addBattleLog=()=>{};updateBattleUI=()=>{};checkBattleEnd=()=>{};
  showChoiceModal=(t,d,x,o,cb)=>cb(0);showCardPickerMulti=(c,ti,cb,n)=>{const ix=[];for(let k=0;k<Math.min(n||1,c.length);k++)ix.push(k);cb(ix);};
  judgePerform=(u,s,cb)=>cb(s.kind==='coin'?'正面':(s.sides||6));
  teamHasCardCharacter=()=>true;checkLevelUp=()=>{};
  const R={};
  // 1 tags合法
  const LEGAL=new Set(['移动','战术','侵略','丰沛','反制']);let bad=[];
  ['item_permanent','item_single'].forEach(k=>(cardData[k]||[]).forEach(c=>(c.tags||[]).forEach(t=>{if(!LEGAL.has(t))bad.push(c.name+':'+t);})));
  R.tagsBad=bad;
  // 2 判定不吃克制（热忱打无序，judge base2 应=2；普通=3）
  const mk=(attr)=>({hand:[],deck:[{name:'a'},{name:'b'},{name:'c'}],grave:[],removed:[],permanent:[],faceDownCards:[],sync:40,maxSync:999,cost:9,maxCost:12,shield:0,defense:0,gold:0,position:0,attackBuff:0,motivation:0,level:1,teamAttribute:attr||'热忱'});
  const dv=(judge)=>computeDamageValue('p1','p2',{base:2,judge:judge,attr:'热忱',kind:judge?'judge':'fervor'}).value;
  battleState={phase:'main1',currentPlayer:'p1',p1:mk('热忱'),p2:Object.assign(mk('无序'),{position:25})};
  R.judgeNoCrit=dv(true);R.normalCrit=dv(false);
  // 3 Twice目标类型=any_player
  const tw=allCards.find(c=>c.name==='Twice');R.twiceTT=parseTargetType(tw.effect);
  // 4 过载：自己回合用单次进墓抽1
  battleState.p1._overload={until:-1};battleState.currentPlayer='p1';
  const before=battleState.p1.hand.length;const used={name:'U',_category:'item_single'};
  placeAfterUse('p1',used,false);postUsePassiveHooks('p1',used,false);
  R.overloadSelfDraw=battleState.p1.hand.length-before;
  // 对手回合不抽
  battleState.p1._overload={until:-1};const b2=battleState.p1.hand.length;battleState.currentPlayer='p2';
  const used2={name:'U2',_category:'item_single'};placeAfterUse('p1',used2,false);postUsePassiveHooks('p1',used2,false);
  R.overloadOppNoDraw=battleState.p1.hand.length-b2;
  // 5 技能卡实例计次：用过锁、进墓清、回收可再发
  const sk=allCards.find(c=>c._category==='skill_cards');battleState.currentPlayer='p1';battleState.p1.permanent=[];
  recordSkillUse(sk,'p1');R.skillLocked=!evaluatePlayable(sk,'p1').ok;
  placeAfterUse('p1',sk,false);battleState.p1.hand.push(sk);R.skillResetAfterGrave=evaluatePlayable(sk,'p1').ok;
  // 8 同行攻击：摸头杀跨行false同行true
  const mt=allCards.find(c=>c.name==='秘技！摸头杀');
  battleState.p2.position=25;R.mtCross=evaluatePlayable(mt,'p1').ok;
  battleState.p2.position=5;R.mtSame=evaluatePlayable(mt,'p1').ok;
  // 9 供给者主动+3激励 & 发动引导核心
  const sup=allCards.find(c=>c._category==='item_permanent'&&c.name&&c.name.indexOf('供给者')>=0);
  battleState.phase='main1';battleState.p1.motivation=0;battleState.p1.permanent=[sup];executePermanentActive(0);
  R.supplierMot=battleState.p1.motivation;
  // 11 妖刀造6触发
  battleState.p1.sync=40;battleState.p1.permanent=[{name:'妖刀五月雨'}];battleState.p2.sync=40;
  await new Promise(r=>applyDamageOps('p1','p2',{judge:false,base:6,kind:'chaos'},r,null));
  R.yaodaoTrig=battleState.p1._yaodaoTriggered;R.yaodaoSync=battleState.p1.sync;
  return R;
 });
 console.log(JSON.stringify(R,null,1));
 // 断言
 const r=R;
 ok((r.tagsBad||[]).length===0,'道具tags全合法(脏:'+JSON.stringify(r.tagsBad)+')');
 ok(r.judgeNoCrit===2,'判定伤害不吃克制=2 got'+r.judgeNoCrit);
 ok(r.normalCrit===3,'普通伤害吃克制=3 got'+r.normalCrit);
 ok(r.twiceTT==='any_player','Twice目标类型any_player got'+r.twiceTT);
 ok(r.overloadSelfDraw===1,'过载自己回合进墓抽1 got'+r.overloadSelfDraw);
 ok(r.overloadOppNoDraw===0,'过载对手回合不抽 got'+r.overloadOppNoDraw);
 ok(r.skillLocked===true,'技能卡用过锁定');
 ok(r.skillResetAfterGrave===true,'技能卡进墓清标记可再发');
 ok(r.mtCross===false,'摸头杀跨行变灰');
 ok(r.mtSame===true,'摸头杀同行可用');
 ok(r.supplierMot===3,'供给者主动+3激励 got'+r.supplierMot);
 ok(r.yaodaoTrig===true&&r.yaodaoSync===37,'妖刀造6触发且自失3 got'+r.yaodaoSync);
 console.log('\n'+A.join('\n'));
 const fail=A.filter(x=>x.startsWith('FAIL')).length;
 console.log('\nE2E '+(A.length-fail)+'/'+A.length+' 通过, pageerrors='+errs.length+' '+(errs[0]||''));
 await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
