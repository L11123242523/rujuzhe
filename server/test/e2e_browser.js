/* 浏览器端到端联机测试（Playwright + 系统 Chromium 驱动真实前端）
 * 前置：PORT=2567 node server/index.js
 * 链路：配卡→建房→bot加入→准备开局→推进投骰→权威连锁窗口(bot先pass/我方pass)→锁定移动
 */
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const URL='http://localhost:2567/rujuzhe_game.html', EXE='/usr/local/bin/chromium';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};

(async()=>{
  const browser=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push('pageerror: '+e.message));
  page.on('console',m=>{if(m.type()==='error'){const t=m.text();if(!/favicon|Failed to load resource|onMessage\(\) not registered/.test(t))errors.push(t);}});
  page.on('dialog',d=>d.accept().catch(()=>{}));

  await page.goto(URL,{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});
  ok(true,'主菜单加载');
  // 自动消除单选选择弹窗（点首项即关闭）；开局多选角色（枫SP/雨清7选5）在配卡时避开
  await page.evaluate(()=>setInterval(()=>{const m=document.querySelector('#choiceModal.active');if(m){const b=m.querySelector('#choiceButtons button');if(b)b.click();}},100));

  const ds=await page.evaluate(()=>{
    let names,guard=0;
    do{ randomDeck('p1');randomDeck('p2');
      names=[...deckConfig.p1.chars,...deckConfig.p2.chars].filter(Boolean).map(c=>c.name||'').join('');
      guard++;
    }while((/枫|雨清/.test(names)||validateDeck('p1').length||validateDeck('p2').length)&&guard<30);
    return[validateDeck('p1').length,validateDeck('p2').length];
  });
  ok(ds[0]===0&&ds[1]===0,'双方卡组合法 p1/p2 问题数='+ds.join('/'));

  await page.evaluate(()=>{document.getElementById('olServer').value='';document.getElementById('olName').value='主机';showScreen('onlineLobby');});
  await page.click('.ol-btn:has-text("创建房间")');
  await page.waitForFunction(()=>window.Online&&Online.roomId,{timeout:8000});
  const roomId=await page.evaluate(()=>Online.roomId);
  ok(!!roomId,'创建房间 '+roomId);

  const bot=spawn('node',[path.join(__dirname,'..','..','_bot.js'),roomId],{stdio:['ignore','pipe','inherit']});
  let blog='';bot.stdout.on('data',d=>blog+=d);

  await page.click('#olReadyBtn');
  await page.waitForFunction(()=>Online.active&&document.querySelector('#battleScreen.active'),{timeout:10000});
  ok(true,'双方就绪→gameStart→进入对战');
  const hand=await page.evaluate(()=>(battleState.p1.hand||[]).length);
  ok(hand===5,'先手初始手牌5张（实际'+hand+'）');

  for(const tgt of ['main1','roll']){
    await page.click('#btnNextPhase',{force:true});
    await page.waitForFunction(t=>battleState.phase===t,tgt,{timeout:6000});
    await sleep(200);
  }
  await page.waitForFunction(()=>document.getElementById('btnRoll').style.display!=='none',{timeout:6000});
  ok(true,'推进到投骰阶段');

  const before=await page.evaluate(()=>({pos:battleState.p1.position}));
  await page.click('#btnRoll',{force:true});
  // bot 先 pass，随后轮到我方（pass 按钮出现）
  await page.waitForFunction(()=>{const b=document.querySelector('#onlineChainBar button.pass');return b&&b.offsetParent!==null;},{timeout:8000});
  ok(true,'权威窗口：bot先pass后轮到我方响应');
  ok(/windowOpen/.test(blog)&&/-> pass/.test(blog),'bot确实收到窗口并先pass');
  await page.screenshot({path:'/tmp/e2e_chain.png'});
  // 我方 pass（JS点击，规避动态按钮 :visible 判定）
  await page.evaluate(()=>document.querySelector('#onlineChainBar button.pass').click());
  // 锁定→本地采用权威值→移动→进入主要阶段2
  await page.waitForFunction(()=>battleState.p1._lastRoll>=1&&battleState.phase!=='roll',{timeout:8000});
  const after=await page.evaluate(()=>({last:battleState.p1._lastRoll,pos:battleState.p1.position,phase:battleState.phase,rolling:battleState._onlineRolling}));
  ok(!!after.last,'权威骰点锁定='+after.last+'，门闩已释放(rolling='+after.rolling+')');
  ok(after.pos!==before.pos,'按权威点数移动：位置 '+before.pos+' → '+after.pos);
  ok(after.phase==='main2','投骰后进入主要阶段2（当前'+after.phase+'）');
  await page.screenshot({path:'/tmp/e2e_battle.png'});

  // 断线清理：bot离开后主机应收到 opponentLeft 并回主菜单
  ok(errors.length===0,'全程无致命前端错误'+(errors.length?'：\n   '+errors.slice(0,3).join('\n   '):''));

  bot.kill();await browser.close();
  console.log(`\n浏览器联机E2E: 通过 ${pass} 失败 ${fail}`);
  process.exit(fail?1:0);
})().catch(e=>{console.error('E2E异常',e);process.exit(1);});
