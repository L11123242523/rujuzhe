const { chromium } = require('playwright-core');
const A=[];const ok=(c,m)=>A.push((c?'PASS ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(async()=>{
  addBattleLog=()=>{};updateBattleUI=()=>{};
  const log=[];
  // ---- 用例1：必发A自动入链；选发B、C，玩家先点C再点B再结束 => 链=[A,C,B]，逆结算 B,C,A
  const pickQ=[]; // 每次弹窗选第几项
  showChoiceModal=(t,d,x,opts,cb)=>{ const k=pickQ.shift(); cb(k===undefined?opts.length-1:k); };
  pickQ.push(0); // 剩余[B,C]，选第0个=B？我们想先选C(idx1)
  pickQ.length=0; pickQ.push(1,0); // 第一次选C(idx1)，第二次剩B选B(idx0)，第三次自动结束
  await new Promise(res=>{
   resolveSimultaneous('p1',[
     {key:'A',label:'必发A',owner:'p1',mandatory:true,fire:d=>{log.push('A');d();}},
     {key:'B',label:'选发B',owner:'p1',mandatory:false,fire:d=>{log.push('B');d();}},
     {key:'C',label:'选发C',owner:'p1',mandatory:false,fire:d=>{log.push('C');d();}},
   ],res);
  });
  const order1=log.slice();
  // ---- 用例2：玩家不选发（直接结束），只结算必发A
  log.length=0;
  showChoiceModal=(t,d,x,o,cb)=>cb(o.length-1); // 直接结束
  await new Promise(res=>resolveSimultaneous('p1',[
    {key:'A',label:'必发A',owner:'p1',mandatory:true,fire:d=>{log.push('A');d();}},
    {key:'B',label:'选发B',owner:'p1',mandatory:false,fire:d=>{log.push('B');d();}},
  ],res));
  const order2=log.slice();
  // ---- 用例3：alive失效=丢失目标不执行
  log.length=0;let alive=true;
  showChoiceModal=(t,d,x,o,cb)=>cb(o.length-1);
  await new Promise(res=>resolveSimultaneous('p1',[
    {key:'X',label:'可能丢失',owner:'p1',mandatory:true,alive:()=>alive,fire:d=>{log.push('X');d();}},
    {key:'K',label:'先结算使其丢失',owner:'p1',mandatory:true,fire:d=>{alive=false;log.push('K');d();}},
  ],res));
  const order3=log.slice();
  return {order1,order2,order3};
 });
 console.log(JSON.stringify(R,null,1));
 ok(JSON.stringify(R.order1)===JSON.stringify(['B','C','A']),'玩家选C再B，链[A,C,B]逆结算=B,C,A got'+JSON.stringify(R.order1));
 ok(JSON.stringify(R.order2)===JSON.stringify(['A']),'放弃选发只结算必发A got'+JSON.stringify(R.order2));
 ok(JSON.stringify(R.order3)===JSON.stringify(['K']),'逆结算时X目标丢失不执行，只结算K got'+JSON.stringify(R.order3));
 console.log('\n'+A.join('\n'));
 const fail=A.filter(x=>x.startsWith('FAIL')).length;
 console.log('\n编排器 '+(A.length-fail)+'/'+A.length+' 通过, pageerror='+errs.length+' '+(errs[0]||''));
 await b.close();process.exit(fail||errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
