/* 逐卡断言审计：状态有变化不是效果正确；未登记用例的卡明确列为未验证。
 * node port-old/_audit-card-behavior.cjs [--only=精确卡名,精确卡名] [--json=报告路径]
 * 退出码：0=所选断言均通过；1=失败/异常/未完成；2=有未验证/无法发动/跳过。
 */
'use strict';
const path = require('path'), fs = require('fs'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
// 每项只证明注明的范围；复用已经验证的真实指令与负向断言，不宣称整张卡所有组合已穷举。
const CONTRACTS = [
  { cards: ['谢幕', '剖析'], file: 'probe-curtain-sp-owner.cjs', scope: '移动来源归属、两座位、路径/同格、无目标及后续移动不继承' },
  { cards: ['谢幕', '剖析'], file: 'probe-move-actual-path.cjs', scope: '截停实际步数、路径触碰、起点奖励、变向与落点预览' },
  { cards: ['某女士爱用球棒', '羽奈(往昔)'], file: 'probe-bat-yunai-review.cjs', scope: '球棒零至三突破手位移；羽奈相邻单次分类、墓地位置、AI及客人分支' }
];
function verdict(r) {
  if (!r || typeof r !== 'object') return { status: '异常', reason: '子用例未返回执行结果' };
  const text = String(r.stdout || '') + '\n' + String(r.stderr || '');
  if (r.error && r.error.code === 'ETIMEDOUT' || r.signal) return { status: '未完成', reason: '子进程超时或被终止' };
  if (r.error || /(?:^|\n)\s*(?:\w*Error:|(?:探针|审计)?异常[：:])/.test(text)) return { status: '异常', reason: r.error ? r.error.message : text.slice(-600) };
  if (r.status === 2) return { status: '跳过', reason: text.trim().slice(-600) || '子用例未完成验证' };
  if (r.status === 3) return { status: '无法发动', reason: text.trim().slice(-600) || '场景不满足发动条件' };
  if (r.status !== 0 || text.includes('❌')) return { status: '失败', reason: text.trim().slice(-1000) };
  const summaries = Array.from(text.matchAll(/共\s*(\d+)\s*项，通过\s*(\d+)\s*，失败\s*(\d+)/g));
  if (!summaries.length || summaries.some(m => Number(m[1]) === 0)) return { status: '未验证', reason: '没有非零的专门断言汇总；仅扣费、送墓或有状态变化不算通过' };
  if (summaries.some(m => Number(m[1]) !== Number(m[2]) || Number(m[3]) !== 0)) return { status: '失败', reason: '断言汇总未全绿' };
  const m = summaries[summaries.length - 1];
  return { status: '通过', assertions: Number(m[1]), reason: '仅代表登记的断言范围通过' };
}
function audit(cards, contracts, execute) {
  const runs = new Map(), results = [];
  for (const card of cards) {
    const cases = contracts.filter(c => c.cards.includes(card.name));
    if (!cases.length) { results.push({ name: card.name, status: '未验证', reason: '尚无登记的专门断言；不以状态指纹代替正确性判断' }); continue; }
    for (const test of cases) {
      if (!runs.has(test.file)) {
        let r; try { r = execute(test); } catch (e) { r = { error: e }; }
        runs.set(test.file, verdict(r));
      }
      results.push({ name: card.name, file: test.file, scope: test.scope, ...runs.get(test.file) });
    }
  }
  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;
  const cardCounts = {};
  for (const card of cards) {
    const entries = results.filter(r => r.name === card.name);
    const state = ['异常','失败','未完成','未验证','无法发动','跳过','通过'].find(s => entries.some(r => r.status === s));
    cardCounts[state] = (cardCounts[state] || 0) + 1;
  }
  const exitCode = results.some(r => ['失败','异常','未完成'].includes(r.status)) ? 1 : results.some(r => r.status !== '通过') || !results.length ? 2 : 0;
  return { cards: cards.length, processes: runs.size, counts, cardCounts, exitCode, results };
}
function main(argv) {
  const L = require('../_relaytest/lib/cardlab.js');
  const pool = L.bootCard({}).S.allCards;
  const all = pool.filter(c => c && c.name && c._category !== 'emojis');
  const opt = key => { const a = argv.find(x => x.startsWith('--' + key + '=')); return a ? a.slice(key.length + 3) : ''; };
  const names = opt('only').split(',').filter(Boolean);
  if (names.some(n => !all.some(c => c.name === n))) throw new Error('找不到精确卡名：' + names.filter(n => !all.some(c => c.name === n)).join('、'));
  const chosen = names.length ? all.filter(c => names.includes(c.name)) : all;
  const report = audit(chosen, CONTRACTS, test => cp.spawnSync(process.execPath, [path.join(__dirname, test.file)], { cwd: ROOT, encoding: 'utf8', timeout: 180000 }));
  report.excludedEmojis = pool.filter(c => c && c._category === 'emojis').length;
  console.log('按卡登记断言：' + report.cards + ' 张；实际执行 ' + report.processes + ' 个专门探针（共享用例不重复执行）');
  for (const r of report.results) console.log('  [' + r.status + '] ' + r.name + '：' + (r.scope || r.reason));
  console.log('按卡状态（仅登记范围）：' + JSON.stringify(report.cardCounts) + '；用例状态：' + JSON.stringify(report.counts) + '；退出码 ' + report.exitCode);
  if (opt('json')) fs.writeFileSync(path.resolve(opt('json')), JSON.stringify(report, null, 2));
  return report.exitCode;
}
module.exports = { CONTRACTS, verdict, audit, main };
if (require.main === module) {
  try { process.exit(main(process.argv.slice(2))); }
  catch (e) { console.error('审计异常：' + e.stack); process.exit(1); }
}
