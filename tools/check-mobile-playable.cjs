/* 手机视口验证：按稳定入口定位，坐标点击只执行一次，缺失和遮挡均不算通过。
 * node tools/check-mobile-playable.cjs [--local] [--url=…] [--width=390] [--height=844] [--shot=…]
 */
'use strict';
const K = require('../port-old/e2e/kit.cjs');
const ACTIONS = {
  deck: '#mainMenu button[onclick="openDeckBuilder(\'pve\')"]',
  p1: '#deckBuilder button[onclick="randomDeck(\'p1\')"]',
  p2: '#deckBuilder button[onclick="randomDeck(\'p2\')"]',
  back: '#deckBackBtn', battle: '#mainMenu button[onclick="startBattle()"]', next: '#btnNextPhase'
};
function consoleErrors(logs) { return ((logs || {}).errors || []).map(e => e.text || String(e)).filter(t => !/favicon\.ico/.test(t)); }
function judgeUI(ui) {
  return { small: ui.buttons.filter(b => b.w < 24 || b.h < 24), blocked: ui.buttons.filter(b => !b.hitOk),
    missingHand: ui.expectedHand > 0 && ui.cards.length < ui.expectedHand,
    smallHand: ui.cards.filter(c => c.w < 26 || c.h < 26) };
}
async function locate(page, selector) {
  return page.eval(sel => {
    const el = Array.from(document.querySelectorAll(sel)).find(e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && getComputedStyle(e).visibility!=='hidden'; });
    if (!el) return { missing: true, selector: sel };
    el.scrollIntoView({ block:'center', inline:'center', behavior:'instant' });
    const r=el.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2;
    const hit=document.elementFromPoint(x,y);
    return { selector:sel, x,y,w:r.width,h:r.height,hitOk:!!hit&&(hit===el||el.contains(hit)) };
  }, selector);
}
async function activate(page, selector) {
  const b=await locate(page,selector);
  if (b.missing || !b.hitOk) throw new Error('入口缺失或被遮挡：'+JSON.stringify(b));
  await page.eval(sel => {
    const witness={count:0};window.__mobileClickWitness=witness;
    document.querySelector(sel).addEventListener('click',()=>witness.count++);
  },selector);
  await page.send('Input.dispatchMouseEvent',{type:'mousePressed',x:b.x,y:b.y,button:'left',buttons:1,clickCount:1});
  await page.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:b.x,y:b.y,button:'left',buttons:0,clickCount:1});
  await page.waitFor('window.__mobileClickWitness && window.__mobileClickWitness.count === 1',{timeout:2000,desc:'坐标点击确实到达入口'});
  return b;
}
async function measure(page) {
  return page.eval(()=>{
    const buttons=[];
    for (const e of document.querySelectorAll('#battleScreen button')) {
      const r=e.getBoundingClientRect();
      if(r.width<=0||r.height<=0||r.bottom<=0||r.top>=innerHeight||r.right<=0||r.left>=innerWidth||getComputedStyle(e).visibility==='hidden')continue;
      const x=Math.max(0,Math.min(innerWidth-1,r.x+r.width/2)),y=Math.max(0,Math.min(innerHeight-1,r.y+r.height/2)),hit=document.elementFromPoint(x,y);
      buttons.push({key:e.id||e.getAttribute('onclick')||e.textContent.trim(),text:e.textContent.trim().slice(0,24),w:r.width,h:r.height,hitOk:!!hit&&(hit===e||e.contains(hit))});
    }
    const cards=Array.from(document.querySelectorAll('#battleHand .hand-card')).map(e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height};});
    return {buttons,cards,expectedHand:battleState.p1.hand.length,docW:document.documentElement.scrollWidth,vw:innerWidth};
  });
}
async function run(opts={}) {
  const width=opts.width||390,height=opts.height||844,env=await K.bootEnv({headless:true,width,height});
  let bad=0,total=0;
  const chk=(ok,label,detail)=>{total++;if(!ok)bad++;console.log((ok?'✅ ':'❌ ')+label+(detail?'：'+JSON.stringify(detail):''));};
  try {
    const page=env.page;
    await page.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await page.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:5});
    const url=opts.local?env.url:(opts.url||'https://rujuzhe-b-a-gs.top/game.html');
    console.log('手机视口 '+width+'×'+height+'：'+url+'（坐标点击验证，不代表真实设备触摸已验证）');
    await page.goto(url);await K.waitEngineReady(page);
    let info=await page.eval(()=>({vw:innerWidth,docW:document.documentElement.scrollWidth}));
    chk(info.vw===width,'手机视口生效',info);chk(info.docW<=width+2,'主页无横向溢出',info);
    await activate(page,ACTIONS.deck);
    await page.waitFor(()=>document.getElementById('deckBuilder').classList.contains('active'),{desc:'编组界面打开'});
    chk(true,'点击打开编组，定位不依赖按钮文字');
    for(const seat of ['p1','p2']) {
      await activate(page,ACTIONS[seat]);
      const counts=await page.eval(w=>[deckConfig[w].chars,deckConfig[w].items,deckConfig[w].carries].map(a=>(a||[]).filter(Boolean).length),seat);
      chk(JSON.stringify(counts)==='[3,8,4]',seat+'通过随机配置按钮配好卡组',counts);
    }
    await activate(page,ACTIONS.back);
    await page.waitFor(()=>document.getElementById('mainMenu').classList.contains('active'),{desc:'返回主菜单'});
    await activate(page,ACTIONS.battle);
    await page.waitFor(()=>!!(battleState&&battleState.p1&&battleState.p1.hand&&document.getElementById('battleScreen').classList.contains('active')),{timeout:20000,desc:'真实入口进入对局'});
    chk(true,'点击单机入口进入真实对局');
    const drained=await K.drainAsks(page,{timeout:15000});
    chk(!drained.timedOut&&!drained.stalled,'开局询问均由真实按钮完成');
    if(!opts.entryOnly) {
      const first=await measure(page),next=await locate(page,ACTIONS.next),second=await measure(page);
      chk(!next.missing&&next.hitOk&&next.w>=24&&next.h>=24,'阶段按钮存在且可命中',next);
      const unique=new Map([...first.buttons,...second.buttons].map(b=>[b.key,b]));
      const ui={...second,buttons:Array.from(unique.values())},v=judgeUI(ui);
      console.log('按钮尺寸样本：'+JSON.stringify(ui.buttons.map(b=>({text:b.text,w:Math.round(b.w),h:Math.round(b.h)}))));
      chk(ui.docW<=width+2,'对局无横向溢出');
      chk(v.small.length===0,'实际测量的按钮均不小于24像素（不预先过滤小按钮）',v.small);
      chk(v.blocked.length<=Math.floor(ui.buttons.length/2),'按钮命中检查',v.blocked);
      chk(!v.missingHand,'有手牌时必须渲染手牌元素',{expected:ui.expectedHand,rendered:ui.cards.length});
      chk(v.smallHand.length===0,'每张手牌尺寸均不小于26像素',v.smallHand);
    } else console.log('本次范围：仅验证手机视口入口，不代表触摸、按钮尺寸与手牌覆盖已通过');
    const errors=consoleErrors(page.logs());chk(errors.length===0,'无JS或资源报错',errors);
    if(opts.shot)await page.screenshot(opts.shot);
    console.log('共 '+total+' 项，通过 '+(total-bad)+'，失败 '+bad);
    return {total,bad,exitCode:bad?1:0};
  } finally {await env.close();}
}
module.exports={ACTIONS,consoleErrors,judgeUI,locate,activate,measure,run};
if(require.main===module) {
  const arg=(key,fallback)=>{const a=process.argv.find(x=>x.startsWith('--'+key+'='));return a?a.slice(key.length+3):fallback;};
  run({url:arg('url',''),local:process.argv.includes('--local'),width:Number(arg('width',390)),height:Number(arg('height',844)),shot:arg('shot','')})
    .then(r=>{process.exitCode=r.exitCode;}).catch(e=>{console.error('手机检查异常：'+e.stack);process.exitCode=1;});
}
