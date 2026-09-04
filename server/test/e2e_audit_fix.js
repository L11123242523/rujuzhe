const { chromium } = require('playwright-core');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);}};
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();pg.on('pageerror',e=>console.log('PAGEERR',e.message));pg.on('dialog',d=>d.accept());
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const C=await pg.evaluate(()=>{
  const ops=nm=>compileStepOps((allCards.find(x=>x.name===nm)||{effect:''}).effect,false);
  const count=(arr,op)=>arr.filter(o=>o.op===op).length;
  const deepCount=(arr,op)=>{let n=0;(arr||[]).forEach(o=>{if(o.op===op)n++;['inner','then','options','effects','branch'].forEach(k=>{if(Array.isArray(o[k]))n+=deepCount(o[k],op);});if(Array.isArray(o.branches))o.branches.forEach(br=>{if(Array.isArray(br))n+=deepCount(br,op);});});return n;};
  const out={};
  let a=ops('人格修正拳！');
  out.renge={knock:deepCount(a,'knock_off'),lose:deepCount(a,'lose_cost'),judge:a.some(o=>o.op==='damage'&&o.judge)};
  a=ops('你呀你呀'); out.ni=a.some(o=>o.op==='next_attack_pierce'&&o.amount===3)&&a.some(o=>o.op==='def_up');
  a=ops('打起精神来！');
  out.dqs={add:a.find(o=>o.op==='add_roll_phase')&&a.find(o=>o.op==='add_roll_phase').toTarget===true,
    lv4:a.some(o=>o.op==='draw'&&o.who==='self'&&o.ifLevel===4),
    lv7:a.some(o=>o.op==='draw'&&o.who==='target'&&o.ifLevel===7)};
  a=ops('底牌'); out.dipai={ret:count(a,'return_all_deck'),badSearch:a.filter(o=>o.op==='search'&&o.to==='deck').length,consume:count(a,'consume_self')};
  a=ops('命运之回声');
  out.echo={perm:a.filter(o=>o.op==='destroy_pick'&&o.zone==='permanent').length,hand:a.filter(o=>o.op==='destroy_pick'&&o.zone==='hand').length};
  out.jiaoxia=JSON.stringify(ops('狡黠之跃'));
  a=ops('风纪委员的手段'); out.fengji=a.some(o=>o.op==='move'&&o.n===3)&&a.some(o=>o.op==='fengji_destroy');
  a=ops('Twice'); out.twice=a[0]&&a[0].op==='choice';
  return out;
 });
 ok(C.renge.knock===1,'人格修正拳只打落一次（实际'+C.renge.knock+'）');
 ok(C.renge.lose===0,'打落内含失费，无重复lose_cost（实际'+C.renge.lose+'）');
 ok(C.renge.judge,'人格修正拳为四面骰判定伤害');
 ok(C.ni,'你呀你呀=防御+1 & 下次攻击无视3护盾');
 ok(C.dqs.add&&C.dqs.lv4&&C.dqs.lv7,'打起精神=追加(目标)+Lv4自抽+Lv7目标抽：'+JSON.stringify(C.dqs));
 ok(C.dipai.ret===1&&C.dipai.badSearch===0&&C.dipai.consume===1,'底牌=全部回牌组&无多余选卡&销毁：'+JSON.stringify(C.dipai));
 ok(C.echo.perm===1&&C.echo.hand===0,'命运回声只破坏场上功能卡一次、无误伤手牌：'+JSON.stringify(C.echo));
 ok(C.jiaoxia.indexOf('move_to_tile')>=0&&C.jiaoxia.indexOf('opposite')>=0,'狡黠之跃=跃向对行同位：'+C.jiaoxia);
 ok(C.fengji,'风纪委员=前移3+终点破坏');
 ok(C.twice,'Twice仍为二选一choice（回归）');

 // 执行层：无视3护盾
 const P=await pg.evaluate(async()=>{
  battleState={currentPlayer:'p1',phase:'main1',resp:{},p1:{hand:[],grave:[],cost:9,maxCost:9,attack:0,shield:0,defense:0,sync:30},p2:{hand:[],grave:[],cost:9,maxCost:9,attack:0,shield:5,defense:0,sync:30}};
  battleState.p1._nextAttackPierce=3;
  showChoiceModal=(t,n,e,ch,cb)=>cb&&cb(ch.length-1); // 不连锁/不抵消
  await new Promise(res=>dealDamageWithResponse('p2',3,'测试',res,null,'p1',{raw:true}));
  return {shield:battleState.p2.shield,sync:battleState.p2.sync,pierceLeft:battleState.p1._nextAttackPierce||0};
 });
 ok(P.shield===3&&P.sync===29&&P.pierceLeft===0,'无视3护盾：3点被无视并保留、2点生效挡2造1（盾余3/同步29）：'+JSON.stringify(P));
 console.log('\nRESULT pass='+pass+' fail='+fail);
 await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
