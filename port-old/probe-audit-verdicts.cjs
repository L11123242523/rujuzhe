/* 审计器的反例：不能把出牌成本、退出0、异常或跳过当成通过。 */
'use strict';
const assert = require('assert'), cp = require('child_process'), path = require('path');
const A = require('./_audit-card-behavior.cjs'), M = require('../tools/check-mobile-playable.cjs');
let total = 0;
function eq(got, want, label) { assert.deepStrictEqual(got, want, label); total++; console.log('✅ ' + label); }
const green = { status: 0, stdout: '共 2 项，通过 2，失败 0' };
for (const [input, wanted, label] of [
  [green,'通过','非零专门断言全绿才通过'],
  [{status:0,stdout:'已扣费并送墓，状态改变'},'未验证','仅出牌成本变化不算通过'],
  [{status:0,stdout:'有反应'},'未验证','有反应不算正确性断言'],
  [{status:0,stdout:'共 0 项，通过 0，失败 0'},'未验证','零断言不算通过'],
  [{status:0,stdout:'共 2 项，通过 1，失败 1'},'失败','计数不符为失败'],
  [{status:0,stdout:green.stdout+'\n共 1 项，通过 0，失败 1'},'失败','不能只读取第一条绿汇总'],
  [{status:1,stdout:green.stdout},'失败','非零退出不能被绿文字覆盖'],
  [{status:0,stderr:'TypeError: 出错'},'异常','stderr异常单独报告'],
  [{status:0,stdout:'探针异常：出错'},'异常','stdout异常也不能被吞'],
  [{error:new Error('启动失败')},'异常','启动错误不算无法发动'],
  [{error:{code:'ETIMEDOUT'}},'未完成','超时不算通过'],
  [{status:2,stdout:'缺少场景'},'跳过','跳过单列'],
  [{status:3,stdout:'发动条件不足'},'无法发动','无法发动单列'],
  [null,'异常','执行结果缺失不算通过']
]) eq(A.verdict(input).status,wanted,label);
const cards=[{name:'甲'},{name:'乙'},{name:'丙'}];
const tests=[{cards:['甲','乙'],file:'共享',scope:'指定断言'}];let calls=0;
let report=A.audit(cards,tests,()=>{calls++;return green;});
eq(calls,1,'共享用例只执行一次');eq(report.exitCode,2,'未覆盖的卡导致明确未验证退出');eq(report.counts['未验证'],1,'未覆盖卡不计通过');
eq(A.audit(cards.slice(0,2),tests,()=>green).exitCode,0,'全部选定断言通过才退出0');
eq(A.audit(cards.slice(0,1),tests,()=>{throw new Error('运行异常');}).exitCode,1,'异常使审计退出1');
eq(A.audit([{name:'甲附加'}],tests,()=>green).counts['未验证'],1,'卡名精确匹配，不用包含关系配用例');
const two=[...tests,{cards:['甲'],file:'另一个',scope:'反例'}];
eq(A.audit([{name:'甲'}],two,()=>green).cardCounts['通过'],1,'一张卡多个用例不重复计作多张卡通过');
eq(A.audit([{name:'甲'}],two,t=>t.file==='另一个'?{status:1}:green).cardCounts['失败'],1,'同一卡后续失败不能被先前通过覆盖');
eq(M.judgeUI({buttons:[{w:90,h:22,hitOk:true}],cards:[],expectedHand:5}).small.length,1,'手机小按钮先测量再判定，不预先过滤');
eq(M.judgeUI({buttons:[],cards:[],expectedHand:5}).missingHand,true,'有手牌但没渲染不能跳过');
eq(M.consoleErrors({errors:[{text:'真实错误'},{text:'favicon.ico 404'}]}),['真实错误'],'保留控制台真实错误文本');
const root=path.resolve(__dirname,'..');
let r=cp.spawnSync(process.execPath,[path.join(__dirname,'_audit-card-behavior.cjs'),'--only=不存在的精确卡名'],{cwd:root,encoding:'utf8',timeout:10000});
eq(r.status,1,'精确卡名未找到不能零测试绿灯');
r=cp.spawnSync(process.execPath,[path.join(__dirname,'_audit-card-behavior.cjs'),'--only=剖析,谢幕,某女士爱用球棒,羽奈(往昔)'],{cwd:root,encoding:'utf8',timeout:30000});
eq(r.status,0,'真实登记用例执行并完成全部指定断言');
eq(/实际执行 3 个/.test(r.stdout),true,'真实共享探针去重且保留各卡范围');
r=cp.spawnSync(process.execPath,[path.join(__dirname,'_audit-card-behavior.cjs'),'--only=1000$,御神签·大吉'],{cwd:root,encoding:'utf8',timeout:10000});
eq(r.status,2,'馈赠卡和御神签也枚举，未登记时明确退出2');
eq(/按卡登记断言：2 张/.test(r.stdout),true,'明确覆盖两种特殊卡类别');
console.log('共 '+total+' 项，通过 '+total+'，失败 0');
