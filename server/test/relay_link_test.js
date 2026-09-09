const WebSocket = require('ws');
const URL = 'ws://localhost:2567';
let pass=0,fail=0; const F=[];
const ok=(c,m)=>{if(c){pass++;}else{fail++;F.push(m);console.log('  ✗ '+m);}};
const wait=(ws,cond,ms=3000)=>new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('等消息超时')),ms);ws.on('message',b=>{const m=JSON.parse(b);if(cond(m)){clearTimeout(t);res(m);}});});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const A=new WebSocket(URL),B=new WebSocket(URL);
  await new Promise(r=>A.on('open',r)),await new Promise(r=>B.on('open',r));

  // A 创建
  let pA=wait(A,m=>m.t==='joined');
  A.send(JSON.stringify({t:'create',name:'甲'}));
  const jA=await pA; ok(jA.isHost===true&&jA.id&&jA.sid,'A 创建成为房主并拿到房号 '+jA.id);

  // B 加入
  let pB=wait(B,m=>m.t==='joined');
  B.send(JSON.stringify({t:'join',id:jA.id,name:'乙'}));
  const jB=await pB; ok(jB.id===jA.id&&jB.isHost===false,'B 凭房号加入同一房间');

  // 双方就绪 -> start，同种子、first=A
  let sA=wait(A,m=>m.t==='start'),sB=wait(B,m=>m.t==='start');
  A.send(JSON.stringify({t:'ready'})); await sleep(20); B.send(JSON.stringify({t:'ready'}));
  const stA=await sA,stB=await sB;
  ok(!!stA.seed&&stA.seed===stB.seed,'双方收到相同种子 '+stA.seed);
  ok(stA.first===jA.sid,'先手=房主A');

  // relay：A 发，只有 B 收到，A 自己不回收
  let got=false; B.on('message',b=>{const m=JSON.parse(b);if(m.t==='relay'&&m.m&&m.m.k==='intent')got=m.m;});
  A.send(JSON.stringify({t:'relay',m:{k:'intent',a:{type:'roll'}}}));
  await sleep(100);
  ok(got&&got.a.type==='roll','A 的意图被中继到 B');

  // 错误房号
  const C=new WebSocket(URL); await new Promise(r=>C.on('open',r));
  let pe=wait(C,m=>m.t==='error'); C.send(JSON.stringify({t:'join',id:'ZZZZ',name:'丙'}));
  const e=await pe; ok(!!e.msg,'不存在房号返回 error'); C.close();

  // B 离开 -> A 收 oppLeft
  let pL=wait(A,m=>m.t==='oppLeft'); B.close(); const l=await pL;
  ok(!!l,'一方掉线，另一方收到 oppLeft');
  A.close();
  await sleep(100);
  console.log(`\n中继服链路测试: 通过 ${pass} 失败 ${fail}`);
  if(F.length)console.log(F.join('\n'));
  process.exit(fail?1:0);
})().catch(e=>{console.error('测试异常',e);process.exit(1);});
