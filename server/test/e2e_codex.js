const { chromium } = require('playwright-core');
const A=[];const ok=(c,m)=>A.push((c?'PASS ':'FAIL ')+m);
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(()=>{
   showScreen('cardViewer');
   const out={total:allCards.length,cat:{},names:{}};
   // 每个分类都应渲染出卡
   cardCategories.forEach(function(c){ currentFilter=c.key; renderCardGrid(); out.cat[c.key]=document.querySelectorAll('#cardGrid .card-item').length; });
   // 永续/单次分类下应能找到曾缺类别的卡
   function findIdx(nm){ return allCards.findIndex(c=>c.name===nm); }
   [['狼牙鹰爪','item_permanent'],['巧匠之手','item_permanent'],['核心的供给者','item_permanent'],['崩塌之乌托邦','item_single'],['先哲之"馈赠"','item_single']].forEach(function([nm,cat]){
     var idx=findIdx(nm); out.names[nm]={idx:idx,cat:idx>=0?allCards[idx]._category:null,exp:cat};
     if(idx>=0){ showViewerCardDetail(idx); out.names[nm].title=document.querySelector('#cardModalContent h3').textContent; }
   });
   return out;
 });
 console.log(JSON.stringify(R,null,1));
 ok(R.total>=130,'allCards 加载 got'+R.total);
 var zeroCats=Object.entries(R.cat).filter(([k,v])=>k!=='all'&&v===0).map(x=>x[0]);
 ok(zeroCats.length===0,'各分类均有卡渲染，空分类:['+zeroCats+']');
 var bad=Object.entries(R.names).filter(([n,v])=>v.idx<0||v.cat!==v.exp||v.title!==n);
 ok(bad.length===0,'曾缺类别卡归类正确且点开标题正确: '+JSON.stringify(bad));
 console.log('\n'+A.join('\n'));const f=A.filter(x=>x.startsWith('FAIL')).length;
 console.log('图鉴 '+(A.length-f)+'/'+A.length+' pageerror='+errs.length+' '+(errs[0]||''));
 await b.close();process.exit(f||errs.length?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
