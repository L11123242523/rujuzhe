/* 真实 DOM 交互回归：
 * A 道具选择器列出全部道具，已选/超限置灰但仍显示；
 * B 盖伏卡点击能真正发动：不删手牌、费用只扣一次、卡离开盖伏区并有去向；
 * C 玩家手动用普通卡时，效果执行前“连锁询问”真实弹窗（修复前玩家路径绕过连锁窗口）。 */
const { chromium } = require('playwright-core');
const EXE='/usr/local/bin/chromium';
let pass=0,fail=0;const fails=[];
const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;fails.push(m);console.log('  ✗',m);}};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const browser=await chromium.launch({executablePath:EXE,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  page.on('dialog',d=>d.accept().catch(()=>{}));
  await page.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});
  await page.evaluate(()=>{ window.__origChoice=showChoiceModal; }); // 保存原始弹窗实现

  // ---------- A ----------
  const A=await page.evaluate(()=>{
    deckConfig.p1.items=new Array(8).fill(null);
    const all=allCards.filter(c=>c._category==='item_permanent'||c._category==='item_single');
    deckConfig.p1.items[0]=all[0];
    openCardPicker('p1','items',0);
    const nodes=[...document.querySelectorAll('#cardPickerGrid .card-picker-item')];
    const dis=nodes.filter(e=>e.classList.contains('picker-disabled'));
    const n0=all[0].name;
    const still=nodes.some(e=>e.querySelector('.card-picker-item-name')&&e.querySelector('.card-picker-item-name').textContent===n0);
    closeCardPicker();
    return {shown:nodes.length,total:all.length,disabled:dis.length,still};
  });
  ok(A.shown===A.total,'道具选择器完整列出全部 '+A.total+' 张（不隐藏已选）');
  ok(A.disabled===1&&A.still,'已选的1张置灰但仍在列表');

  // 开局（B/C 共用），自动应答所有选择窗（连锁选最后=不连锁）
  await page.evaluate(()=>{ showChoiceModal=(t,n,e,ch,cb)=>cb&&cb(ch.length-1); randomDeck('p1');randomDeck('p2');startBattle(); });
  await page.waitForFunction(()=>battleState&&battleState.p1&&battleState.p2,{timeout:8000});
  await sleep(1400); // 等 startBattle 的异步 startTurn 链稳定

  // ---------- B 盖伏 ----------
  await page.evaluate(()=>{
    const fd=allCards.find(c=>c._category==='item_single'&&typeof isChainOnlyCard==='function'&&!isChainOnlyCard(c)&&/^[0-9]+$/.test(String(c.cost))&&!/盖伏/.test(c.effect||''));
    const p=battleState.p1;
    p.hand=[{name:'无关卡甲',cost:0,_category:'item_single',effect:'获得1金币'},{name:'无关卡乙',cost:0,_category:'item_single',effect:'获得1金币'}];
    p.grave=[];p.permanent=[];p.faceDownCards=[];
    const card=Object.assign({},fd);card._faceDownTurn=battleState.turn-1;card._faceDownPlayer='p1';
    p.faceDownCards=[card];p.cost=10;battleState.phase='main1';battleState.currentPlayer='p1';
    window.__fdName=card.name;window.__fdCost=parseInt(card.cost,10)||0;window.__handBefore=p.hand.length;
    updateBattleUI();
  });
  ok(!!await page.$('.permanent-slot.face-down'),'盖伏卡渲染且可点击');
  await page.$eval('.permanent-slot.face-down',el=>el.click());
  await sleep(1500);
  const BR=await page.evaluate(()=>{const p=battleState.p1;return{fdLeft:p.faceDownCards.length,handN:p.hand.length,cost:p.cost,
    inGrave:p.grave.some(c=>c.name===window.__fdName),inPerm:p.permanent.some(c=>c.name===window.__fdName),fdCost:window.__fdCost,hb:window.__handBefore,origKept:['无关卡甲','无关卡乙'].every(n=>p.hand.some(c=>c.name===n))};});
  console.log('B 盖伏区剩',BR.fdLeft,'手牌',BR.hb,'->',BR.handN,'费10->',BR.cost,'(卡费',BR.fdCost,') 进墓',BR.inGrave,'留场',BR.inPerm);
  ok(BR.fdLeft===0,'盖伏卡点击后离开盖伏区');
  ok(BR.origKept,'没有误删原有手牌（splice(-1) 已修；前进落点抽卡不计）');
  ok(BR.cost===10-BR.fdCost,'费用只扣一次（应='+(10-BR.fdCost)+' 实='+BR.cost+'）');
  ok(BR.inGrave||BR.inPerm,'盖伏卡有正确去向');

  // ---------- C 连锁真实弹窗（恢复原始弹窗实现，不自动关闭）----------
  await page.evaluate(()=>{
    showChoiceModal=window.__origChoice;
    const re=/加入手卡|加入手牌|送入墓地|送墓|抽\d?张|抽一张|检索/;
    const src=allCards.find(c=>c._category==='item_single'&&re.test(c.effect||'')&&!isSpecialInteractiveCard(c)&&!needTargetSelect(c.effect||''));
    const negate=allCards.find(c=>(c.name||'').indexOf('崩塌')>=0);
    const p=battleState.p1;
    p.hand=[Object.assign({},src),Object.assign({},negate)];
    p.grave=[{name:'墓甲',_category:'item_single'},{name:'墓乙',_category:'item_single'},{name:'墓丙',_category:'item_single'}];
    battleState.p2.hand=[];
    p.cost=12;battleState.phase='main1';battleState.currentPlayer='p1';
    window.__src=src.name;
    useCard(0);
  });
  let chainShown=false,chainTitle='';
  try{await page.waitForSelector('#choiceModal.active',{timeout:3500});chainShown=true;chainTitle=await page.textContent('#choiceTitle');}catch(e){}
  console.log('C 发动【'+await page.evaluate(()=>window.__src)+'】 连锁弹窗=',chainShown,'标题=',chainTitle);
  ok(chainShown,'玩家手动发动后真实弹出连锁询问窗口');
  ok(chainTitle.indexOf('连锁')>=0,'弹窗标题含“连锁”');
  await page.evaluate(()=>{const bs=[...document.querySelectorAll('#choiceButtons button')];if(bs.length)bs[bs.length-1].click();});
  await sleep(500);
  const realErr=errs.filter(e=>!/favicon|Failed to load resource/.test(e));
  ok(realErr.length===0,'全程无页面脚本错误'+(realErr.length?('：'+realErr.slice(0,3)):''));
  console.log('\nUI修复回归：通过',pass,'失败',fail,fails.length?('FAIL='+JSON.stringify(fails)):'');
  await browser.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
