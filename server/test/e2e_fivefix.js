const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);}};
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();pg.on('pageerror',e=>console.log('PAGEERR',e.message));pg.on('dialog',d=>d.accept());
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));

 // ===== 编译层 =====
 const C=await pg.evaluate(()=>{
  const ops=nm=>compileStepOps((allCards.find(x=>x.name===nm)||{effect:''}).effect,false);
  const out={};
  let q=ops('清凉时间！'); const dm=q.find(o=>o.op==='damage_multi');
  out.qingliang=dm?dm.hits:null;
  let f=ops('风纪委员的手段');
  out.fengjiMove=!!f.find(o=>o.op==='move'&&o.n===3); out.fengjiDestroy=!!f.find(o=>o.op==='fengji_destroy');
  let j=ops('狡黠之跃'); out.jiaoxia=!!j.find(o=>o.op==='move_to_tile'&&o.kind==='opposite');
  let s=ops('夏日泳圈攻击！'); out.swim=!!s.find(o=>o.op==='swim_ring');
  return out;
 });
 ok(C.qingliang&&C.qingliang.length===2,'清凉时间=2段：'+JSON.stringify(C.qingliang));
 ok(C.qingliang&&C.qingliang[0].judge===true&&C.qingliang[0].dice==='fixed'&&C.qingliang[0].base===1,'清凉第1段=固定1点判定伤害（无骰种）：'+JSON.stringify(C.qingliang&&C.qingliang[0]));
 ok(C.qingliang&&C.qingliang[1].judge===false&&C.qingliang[1].kind==='sanity'&&C.qingliang[1].base===1,'清凉第2段=1点理智属性伤害');
 ok(C.fengjiMove&&C.fengjiDestroy,'风纪委员=前移3+fengji_destroy路径破坏');
 ok(C.jiaoxia,'狡黠之跃=跃向对行同位');
 ok(C.swim,'夏日泳圈=swim_ring穿透飞行');

 // ===== 执行层 =====
 await pg.evaluate(()=>{
  battleState={currentPlayer:'p1',phase:'main1',resp:{},
   p1:{position:0,hand:[],grave:[],removed:[],removedFromGame:[],permanent:[],faceDownCards:[],cost:9,maxCost:9,attackBuff:0,defense:0,shield:0,sync:30,level:1},
   p2:{position:5,hand:[],grave:[],removed:[],removedFromGame:[],permanent:[],faceDownCards:[],cost:9,maxCost:9,attackBuff:0,defense:0,shield:0,sync:30}};
  deckConfig={p1:{chars:[]},p2:{chars:[]}};
  triggerTileEffect=()=>{};
  showChoiceModal=(t,n,e,ch,cb)=>cb&&cb(ch.length-1); // 默认放弃/最后项
 });

 // 1) 直尺：卡牌效果移动也要累计，移动8格触发2理智
 const R1=await pg.evaluate(async()=>{
  battleState.p1.permanent=[{name:'设计师的直尺',_category:'item_permanent'}];
  battleState.p1._zhichiMoveCount=0; battleState.p2.sync=30;
  applyMove('p1',8); await new Promise(r=>setTimeout(r,60));
  return {zhichi:battleState.p1._zhichiMoveCount,p2sync:battleState.p2.sync};
 });
 ok(R1.zhichi===0,'直尺累计8格后计数清零（实际'+R1.zhichi+'）');
 ok(R1.p2sync===28,'直尺卡牌移动累计8格造成2理智（p2同步28，实际'+R1.p2sync+'）');

 // 2) 多枚骰改点：2枚6面总=7，遥控骰改成6→最终6（不是12）
 const R2=await pg.evaluate(async()=>{
  var eff={player:'p1',moveAmount:7,_diceSides:6,_diceCount:2,_chain:[{kind:'set',by:'p2',name:'遥控骰子',from:7,to:6}]};
  await new Promise(res=>resolveChainStack(eff,res));
  return {final:eff.moveAmount};
 });
 ok(R2.final===6,'2枚6面骰总7被遥控骰改成6（最终='+R2.final+'，非12）');

 // 3) 硬币附带判定吃到“判定伤害+1”增伤：主伤raw1 + 硬币正面附带2判定(+1增伤=3) = 共4，同步30→26
 const R3=await pg.evaluate(async()=>{
  judgePerform=(u,s,cb)=>cb&&cb('正面'); judgeAnimate=(u,s,cb)=>cb&&cb('正面');
  battleState.p2.sync=30; battleState.p1._judgeDamageBonus=1;
  battleState.p1._nextAttackJudge={dice:'coin',front:2};
  await new Promise(res=>dealDamageWithResponse('p2',1,'主伤',res,null,'p1',{raw:true}));
  await new Promise(r=>setTimeout(r,80));
  return {p2sync:battleState.p2.sync,left:battleState.p1._nextAttackJudge||null};
 });
 ok(R3.left===null,'附带硬币判定为一次性消耗');
 ok(R3.p2sync===26,'硬币附带判定吃到判定增伤（30-主1-附带(2+1)=26，实际'+R3.p2sync+'）');

 // 4) 狡黠Lv4：跃向对行登记回跳原位
 const R4=await pg.evaluate(async()=>{
  battleState.p1.level=4; battleState.p1.position=10; battleState.p1._pendingJumpReturn=null;
  var ctx={user:'p1',target:'p2',p:battleState.p1,q:battleState.p2,card:null};
  await new Promise(res=>runOneOp({op:'move_to_tile',kind:'opposite'},ctx,res));
  return {pos:battleState.p1.position,back:battleState.p1._pendingJumpReturn};
 });
 ok(R4.pos===31&&R4.back===10,'狡黠Lv4跃到对行31并登记回跳原位10：'+JSON.stringify(R4));

 console.log('\nRESULT pass='+pass+' fail='+fail);
 await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
