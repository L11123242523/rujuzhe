const { chromium } = require('playwright-core');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('PASS',m);}else{fail++;console.log('FAIL',m);}};
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();pg.on('pageerror',e=>console.log('PAGEERR',e.message));pg.on('dialog',d=>d.accept());
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const R=await pg.evaluate(()=>{
  const yu=cardData.characters.find(c=>c.name==='入间予');
  const yum=cardData.characters.find(c=>c.name==='予(水着)');
  const dummy={name:'__占位__',passive:'',sp:''};
  function freshP(){return {hand:[],deck:[],grave:[],removed:[],removedFromGame:[],permanent:[],faceDownCards:[],cost:5,maxCost:12,sync:30,position:0,level:1};}
  showCardPickerMulti=(c,t,cb)=>cb&&cb([0,1,2,3,4]);showChoiceModal=(t,n,e,ch,cb)=>cb&&cb(0);
  const out={yu_sp_member:yu.sp_member, yum_sp_member:yum.sp_member, yu_sp_text:yu.sp};
  // A：入间予当队长
  battleState={currentPlayer:'p1',phase:'prepare',resp:{},p1:freshP(),p2:freshP()};
  deckConfig={p1:{chars:[yu,dummy,dummy]},p2:{chars:[dummy,dummy,dummy]}};
  processCharacterPassives('p1');
  out.A_yuCaptain={yuSP:!!battleState.p1._yuSP,judgeBonus:battleState.p1._judgeDamageBonus||0};
  // B：入间予当队员（占位队长）
  battleState={currentPlayer:'p1',phase:'prepare',resp:{},p1:freshP(),p2:freshP()};
  deckConfig={p1:{chars:[dummy,yu,dummy]},p2:{chars:[dummy,dummy,dummy]}};
  processCharacterPassives('p1');
  out.B_yuMember={yuSP:!!battleState.p1._yuSP,judgeBonus:battleState.p1._judgeDamageBonus||0};
  return out;
 });
 ok(R.yu_sp_member===false,'入间予 sp_member=false（实际'+R.yu_sp_member+'）');
 ok(R.yu_sp_text.indexOf('队员编组')<0,'入间予SP文本已去掉队员生效：'+R.yu_sp_text);
 ok(R.A_yuCaptain.yuSP===true&&R.A_yuCaptain.judgeBonus===1,'予当队长：SP生效、判定+1：'+JSON.stringify(R.A_yuCaptain));
 ok(R.B_yuMember.yuSP===false&&R.B_yuMember.judgeBonus===0,'予当队员：SP不生效、无判定增伤：'+JSON.stringify(R.B_yuMember));
 ok(R.yum_sp_member===true,'予(水着)保留队员SP（独立形态，未误改）');
 console.log('\nRESULT pass='+pass+' fail='+fail);
 await b.close();process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
