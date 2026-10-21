/* 真实浏览器的手机视口入口回归，明确不冒称实际触摸或尺寸已通过。 */
'use strict';
require('../tools/check-mobile-playable.cjs').run({local:true,entryOnly:true})
  .then(r=>{process.exitCode=r.exitCode;}).catch(e=>{console.error('手机入口异常：'+e.stack);process.exitCode=1;});
