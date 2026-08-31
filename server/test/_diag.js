/* 诊断增强：走完整链路并在点投骰后转储联机状态轨迹 */
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const URL='http://localhost:2567/rujuzhe_game.html', EXE='/usr/local/bin/chromium';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>console.log('[pageerror]',e.message));
  page.on('dialog',d=>{console.log('[dialog]',d.message());d.accept().catch(()=>{});});
  await page.goto(URL,{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'));
  await page.evaluate(()=>{setInterval(()=>{const m=document.querySelector('.choice-modal.show,.modal.show');if(m){const b=m.querySelector('button');if(b)b.click();}},100);});
  const info=await page.evaluate(()=>{
    randomDeck('p1');randomDeck('p2');
    return {v:[validateDeck('p1').length,validateDeck('p2').length],
      chars:deckConfig.p1.chars.filter(Boolean).map(c=>c.name)};
  });
  console.log('配卡:',JSON.stringify(info));
  await page.evaluate(()=>{document.getElementById('olServer').value='';document.getElementById('olName').value='主机';showScreen('onlineLobby');});
  await page.click('.ol-btn:has-text("创建房间")');
  await page.waitForFunction(()=>window.Online&&Online.roomId);
  const roomId=await page.evaluate(()=>Online.roomId);
  console.log('房号',roomId);
  const bot=spawn('node',[path.join(__dirname,'..','..','_bot.js'),roomId],{stdio:['ignore','pipe','inherit']});
  let blog='';bot.stdout.on('data',d=>blog+=d);
  await page.click('#olReadyBtn');
  await page.waitForFunction(()=>Online.active&&document.querySelector('#battleScreen.active'),{timeout:10000});
  const start=await page.evaluate(()=>({hand:(battleState.p1.hand||[]).length,cur:battleState.currentPlayer,mySess:Online.mySession,isHost:Online.isHost,
    rstate:Online.room.state?{host:Online.room.state.host,current:Online.room.state.currentPlayer,phase:Online.room.state.phase}:null}));
  console.log('开局状态:',JSON.stringify(start));
  for(let i=0;i<2;i++){await page.click('#btnNextPhase');await sleep(250);}
  await page.waitForFunction(()=>battleState.phase==='roll');
  console.log('已到投骰阶段，btnRoll display=',await page.evaluate(()=>document.getElementById('btnRoll').style.display));
  await page.evaluate(()=>{ window.__tr=[]; const iv=setInterval(()=>{ window.__tr.push({ t:Date.now(),
    phase:battleState.phase, rolling:battleState._onlineRolling, rolled:battleState._diceRolledThisPhase,
    win:Online._win?{stage:Online._win.stage,first:Online._win.firstResponder===Online.mySession}:null,
    rs:Online.room.state?{cur:Online.room.state.currentPlayer===Online.mySession,pending:Online.room.state.pendingStage,streak:Online.room.state.passStreak}:null,
    bar:document.getElementById('onlineChainBar').style.display,
    pass:!!document.querySelector('#onlineChainBar button.pass'),
    txt:(document.getElementById('ocTitle')||{}).textContent||'' }); },300); setTimeout(()=>clearInterval(iv),6000); });
  await page.click('#btnRoll');
  await sleep(4500);
  const tr=await page.evaluate(()=>window.__tr);
  console.log('=== 投骰后状态轨迹 ===');
  tr.forEach(x=>console.log(JSON.stringify(x)));
  console.log('=== bot日志 ===\n'+blog);
  bot.kill();await browser.close();process.exit(0);
})().catch(e=>{console.error('异常',e);process.exit(1);});
