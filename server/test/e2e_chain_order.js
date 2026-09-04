const { chromium } = require('playwright-core');
const A=[];const ok=(c,m)=>A.push((c?'PASS ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(async()=>{
  addBattleLog=()=>{};updateBattleUI=()=>{};
  // 用例1：必发A单入；选发B/C，tp优先权窗口先选C再选B => 链[A,C,B]逆结算 B,C,A
  const log=[];let q=[1,0];
  showChoiceModal=(t,d,x,o,cb)=>{const k=q.shift();cb(k===undefined?o.length-1:k);};
  window.__aiChainDecide=undefined;
  await new Promise(res=>resolveSimultaneous('p1',[
    {key:'A',label:'必发A',owner:'p1',mandatory:true,fire:d=>{log.push('A');d();}},
    {key:'B',label:'选发B',owner:'p1',mandatory:false,fire:d=>{log.push('B');d();}},
    {key:'C',label:'选发C',owner:'p1',mandatory:false,fire:d=>{log.push('C');d();}},
  ],res));
  const o1=log.slice();
  // 用例2：必发A，选发B；玩家PASS => 只结A
  log.length=0;q=[];showChoiceModal=(t,d,x,o,cb)=>cb(o.length-1);
  await new Promise(res=>resolveSimultaneous('p1',[
    {key:'A',label:'必发A',owner:'p1',mandatory:true,fire:d=>{log.push('A');d();}},
    {key:'B',label:'选发B',owner:'p1',mandatory:false,fire:d=>{log.push('B');d();}},
  ],res));
  const o2=log.slice();
  // 用例3：两个必发X,K；排序时先X后K => 链[X,K]逆序K先结使X目标丢失 => 只K
  log.length=0;let alive=true;q=[0,1];showChoiceModal=(t,d,x,o,cb)=>{const k=q.shift();cb(k===undefined?0:k);}; // 必发排序窗：先X后K
  await new Promise(res=>resolveSimultaneous('p1',[
    {key:'X',label:'可能丢失',owner:'p1',mandatory:true,alive:()=>alive,fire:d=>{log.push('X');d();}},
    {key:'K',label:'使其丢失',owner:'p1',mandatory:true,fire:d=>{alive=false;log.push('K');d();}},
  ],res));
  const o3=log.slice();
  // 用例4：优先权轮转——tp先PASS，AI(foe)发动F，tp获得响应再发动B，之后双方PASS关链；逆结算 B,F
  log.length=0;const seq=[];let q4=['pass','B'];
  showChoiceModal=(t,d,x,o,cb)=>{const k=q4.shift();cb(k==='pass'||k===undefined?o.length-1:o.findIndex(z=>z.indexOf('选发B')>=0));};
  window.__aiChainDecide=(who,pool)=>{const i=pool.findIndex(c=>c.key==='F');return i;};
  await new Promise(res=>resolveSimultaneous('p1',[
    {key:'B',label:'选发B',owner:'p1',mandatory:false,fire:d=>{seq.push('B');d();}},
    {key:'F',label:'AI选发F',owner:'p2',mandatory:false,fire:d=>{seq.push('F');d();}},
  ],res));
  window.__aiChainDecide=undefined;
  return {o1,o2,o3,o4:seq};
 });
 console.log(JSON.stringify(R,null,1));
 ok(JSON.stringify(R.o1)===JSON.stringify(['B','C','A']),'必发自动入链+选发按优先权两次发动，链[A,C,B]逆结算B,C,A got'+JSON.stringify(R.o1));
 ok(JSON.stringify(R.o2)===JSON.stringify(['A']),'PASS选发只结必发 got'+JSON.stringify(R.o2));
 ok(JSON.stringify(R.o3)===JSON.stringify(['K']),'多个必发玩家排序，K先结使X丢失 got'+JSON.stringify(R.o3));
 ok(JSON.stringify(R.o4)===JSON.stringify(['B','F']),'优先权轮转：tp pass→AI发动F→tp响应B，逆结算B,F got'+JSON.stringify(R.o4));
 console.log('\n'+A.join('\n'));
 const fail=A.filter(x=>x.startsWith('FAIL')).length;
 console.log('\n编排器 '+(A.length-fail)+'/'+A.length+' 通过, pageerror='+errs.length+' '+(errs[0]||''));
 await b.close();process.exit(fail||errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
