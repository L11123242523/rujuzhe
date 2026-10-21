/* tools/gate-then.cjs —— 发布前的门禁守卫（2026-10-06「v58 事故」的流程修正）
 *
 * 背景：v58 那次，并行门禁明确打了「❌ 未通过 ⇒ 不许发布」，但发布命令**没有检查退出码**，
 *       照旧 commit + publish 了 —— 直接违反铁律（不许发红）。这不是意外，是流程缺陷。
 *
 * 用法：node tools/gate-then.cjs
 *   · 门禁全绿 ⇒ 打印通过并 exit 0；
 *   · 门禁有任何失败 ⇒ 打印中止原因并 exit 1。
 * 调用方**必须**据此中止发布，例如（pwsh）：
 *   node tools/gate-then.cjs; if ($LASTEXITCODE -ne 0) { '门禁红灯，中止发布'; exit 1 }
 */
'use strict';
const { execFileSync } = require('child_process');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const GateProof = require('./gate-proof.cjs');
try {
  GateProof.clear(ROOT);
  const inputs = GateProof.capture(ROOT);
  /* 【2026-10-07】先跑"防第 8 次"静态检查：判定函数只许收口不许增加、
     decision.js 的账不许整表清空、tick 只许观测不许改状态。任一违反直接中止。 */
  console.log('=== ① 防"第 8 次"静态检查 ===');
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'check-no-new-books.cjs')], { cwd: ROOT, stdio: 'inherit' });
  console.log('\n=== ② 并行门禁（套件 + 探针）===');
  execFileSync(process.execPath, [path.join(ROOT, 'port-old', 'run-gates-parallel.cjs')], { cwd: ROOT, stdio: 'inherit' });
  console.log('\n✅ [gate-then] 已记录 ' + GateProof.seal(ROOT, inputs) + ' 个输入文件的全绿凭据');
  console.log('\n✅ [gate-then] 门禁通过 ⇒ 允许发布');
  process.exit(0);
} catch (e) {
  GateProof.clear(ROOT);
  console.error('门禁失败原因：' + e.message);
  console.error('\n❌ [gate-then] 门禁未通过 ⇒ **中止**！绝不允许发布红版本（v58 事故的流程修正）');
  process.exit(1);
}
