const { chromium } = require('playwright-core');
const A=[];const ok=(c,m)=>A.push((c?'PASS ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(()=>{
  addBattleLog=()=>{};updateBattleUI=()=>{};
  const out={};
  const mk=(name,eff)=>({name,effect:eff,text:eff});
  // 1 连锁分类：能量饮料(x2自我增益)不是连锁卡；放大镜/爪链/遥控仍是
  out.energy=RJEngine.classifyChainCard(mk('能量饮料','让一次移动动作的位移量x2（最多增加6格）'));
  out.magnifier=RJEngine.classifyChainCard(mk('侦探放大镜','让一次移动动作的位移量增减2格'));
  out.claw=RJEngine.classifyChainCard(mk('猎手爪链','打断一名玩家的移动动作，之后前进3格'));
  out.dice=RJEngine.classifyChainCard(mk('遥控骰子','修改一次掷骰结果为6'));
  // 2 牌组空立即重置：最早进墓(g0)先抽
  deckConfig={p1:{chars:[{name:'X'}],items:[],carries:[]},p2:{chars:[],items:[],carries:[]}};
  battleState={p1:{deck:[],grave:[{name:'g0'},{name:'g1'}],hand:[]},p2:{deck:[],grave:[],hand:[],permanent:[]}};
  var c0=takeTopCard('p1'); out.resetFirst=c0&&c0.name; out.resetDeck=battleState.p1.deck.map(x=>x.name); out.resetGrave=battleState.p1.grave.length;
  // 3 越权过滤：非本队攻击卡不进检索
  battleState.p1.deck=[{name:'别人的攻击',_category:'attack_cards',character:'宁雨清'},{name:'里绪的攻击',_category:'attack_cards',character:'现实间里绪'}];
  deckConfig.p1.chars=[{name:'现实间里绪'}];
  var list=collectZoneCards('p1',['deck'],null,['attack_cards']);
  out.ownerFilter=list.map(x=>x.card.name);
  // 4 playerOwnsCard：没带妖刀=false；permanent有=true
  out.noYaodao=playerOwnsCard('p1',/妖刀|五月雨/);
  battleState.p1.permanent=[{name:'妖刀五月雨'}];
  out.hasYaodao=playerOwnsCard('p1',/妖刀|五月雨/);
  return out;
 });
 console.log(JSON.stringify(R,null,1));
 ok(R.energy===null,'能量饮料x2不再被误判为连锁卡 got'+R.energy);
 ok(R.magnifier==='move_adjust','侦探放大镜仍识别为位移连锁 got'+R.magnifier);
 ok(R.claw==='move_adjust','猎手爪链仍识别 got'+R.claw);
 ok(R.dice==='dice_set','遥控骰子仍识别改点 got'+R.dice);
 ok(R.resetFirst==='g0','牌组空立即重置且最早进墓g0先抽 got'+R.resetFirst);
 ok(JSON.stringify(R.resetDeck)===JSON.stringify(['g1'])&&R.resetGrave===0,'重置后剩余deck=[g1]、grave清空');
 ok(JSON.stringify(R.ownerFilter)===JSON.stringify(['里绪的攻击']),'检索只含本队角色卡 got'+JSON.stringify(R.ownerFilter));
 ok(R.noYaodao===false,'没带妖刀→不拥有');
 ok(R.hasYaodao===true,'有妖刀→拥有');
 console.log('\n'+A.join('\n'));const f=A.filter(x=>x.startsWith('FAIL')).length;
 console.log('批次修复 '+(A.length-f)+'/'+A.length+' pageerror='+errs.length+' '+(errs[0]||''));
 await b.close();process.exit(f||errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
