/* 手机尺寸与浏览器合成触摸回归；不冒称真实手机硬件测试。 */
'use strict';
const K=require('./e2e/kit.cjs'),M=require('../tools/check-mobile-playable.cjs');
(async()=>{
 const full=await M.run({local:true});if(full.exitCode)throw new Error('手机完整检查未通过');
 let total=0;
 for(const width of [320,390,414]){
 const e=await K.bootEnv({width,height:844});
 try{
 const p=e.page;await p.send('Emulation.setDeviceMetricsOverride',{width,height:844,deviceScaleFactor:1,mobile:true});
 await p.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});await p.goto(e.url);await K.prepareBattle(p);await K.drainAsks(p,{timeout:12000});
 for(const action of ["showOppZone('grave')","showOppZone('removed')","showPublicGraveList()"]){
 const b=await M.locate(p,'#battleScreen button[onclick="'+action+'"]');
 if(b.missing||!b.hitOk||b.h<36||b.w<36)throw new Error('触摸入口尺寸或命中失败：'+JSON.stringify(b));
 await p.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x,y:b.y,id:0}]});
 await p.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await p.waitFor(()=>document.getElementById('cardListModal').classList.contains('active'),{timeout:3000,desc:'触摸打开墓地区列表'});
 console.log('✅ '+width+'像素视口触摸打开 '+action+'，高度'+b.h);total++;await p.eval(()=>closeCardList());
 }
 }finally{await e.close();}
 }
 console.log('共 '+total+' 项，通过 '+total+'，失败 0');
})().catch(e=>{console.error('❌ '+e.stack);process.exitCode=1;});
