/* port-old/run-gates-parallel.cjs —— 【批次5】并行门禁：把 13 分钟串行降到 3~4 分钟
 *
 *  做法：清单**从现有 runner 里读**（保证与门禁口径完全一致 ✓，不自己另立一份 ✗）：
 *    · 9 条套件 ← `port-old/run-9suites.cjs` 里的 '..._test.js' / '..._expect.js' 等
 *    · 探针     ← `port-old/run-probes.cjs` 里的 'probe-*.cjs'
 *  然后并发跑（默认 4 路 ✓，可用 --jobs=N 调整），按**退出码**判定通过 ✓，
 *  最后打印汇总；全部通过才 exit 0 ✓（与 run-all-gates 同语义 ✓）。
 *
 *  用法：node port-old/run-gates-parallel.cjs [--jobs=4] [--only=bgm] [--timeout=300]
 *
 *  【2026-10-05 加固】单例超时（默认 300 秒/条）：`probe-decision-authority.cjs` 会**偶发挂死**
 *  （实测一次 180 秒不动、一次 70 秒内全绿），而沙箱里可能有"卡住又不退出的定时器" ⇒
 *  没有超时时它会把整套门禁一起拖死（当天实测：4 路 worker 满载 20 分钟零输出）。
 *  现在：到点强杀该条并判为失败，门禁能继续跑完、如实报告谁挂死。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..');

const jobsArg = process.argv.find(a => a.startsWith('--jobs='));
const JOBS = Math.max(1, parseInt(jobsArg ? jobsArg.split('=')[1] : '4', 10) || 4);
const onlyArg = process.argv.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.split('=')[1] : null;
const timeoutArg = process.argv.find(a => a.startsWith('--timeout='));
/* 【2026-10-09 门禁分层】--exclude=a,b,c：按子串剔除条目（快层门禁用） */
const exclArg = process.argv.find(a => a.startsWith('--exclude='));
const EXCLUDE = exclArg ? exclArg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean) : [];
/* 【2026-10-09 第5件·门禁分层】--suites-only：只跑 9 条套件（快层用）。
   套件是口径最硬的一批（连锁完整性/效果锁/卡牌期望等），单跑通常 1~2 分钟；
   全量探针（含 depth-sweep 等分钟级）留给上线前的 gate-then。 */
const SUITES_ONLY = process.argv.indexOf('--suites-only') >= 0;
/* 【2026-10-09】已知**时序/网络不稳**的探针：失败时自动重试一次，仍失败才算红。
   依据：作者实测 + A/B 对照 —— probe-online-* 要连线上中继，网络抖动会假红。重试结果如实打印，不静默。
   【2026-10-17 移出】`probe-no-leaked-accounts.cjs` 的时序不稳**已根治**（真因：它自己写了 `waitEngineIdle`
   却从没调用，`check()` 用固定等待后就查账 ⇒ 还在结算时被误判成漏账）⇒ 不再重试，红了就是真红 ✓ */
const FLAKY = [
  'probe-online-liuli-split.cjs',
  'probe-online-guest-pick.cjs',
  'probe-rps-online.cjs',
  /* 【2026-10-17 加入·**统一归类**】凡是要**连线上中继建房间**（`bootPair`/`joinRoom`）的探针，
     并行负载下都可能 `Error: 加入失败`（实测：opp-event-count / online-kaede-sp / online-version-log 各红过一次，
     每次**单跑必绿** ✓）⇒ 统一归入"网络不稳"。
     ⚠ 只是"允许重试一次"，重试结果**如实打印**（不静默 ✓），**不放宽任何断言** ✓ */
  'probe-opp-event-count.cjs',
  'probe-online-kaede-sp.cjs',
  'probe-online-version-log.cjs',
  'probe-online-discard-p2.cjs',
  'probe-online-oldnew-cards.cjs',
  'probe-online-today-changes.cjs',
  'probe-online-def-duration.cjs',
  /* 【2026-10-19 P2-1】并行负载下动画队列状态抖动，单跑必绿；只重试一次，断言不变。 */
  'probe-ai-showgate.cjs',
  'probe-c1-body-in-chain.cjs',
  'probe-c1-async-in-chain.cjs',
  /* 【2026-10-19】并行负载下第 5/6 张牌的 60 秒安静窗口偶发超时；单跑全绿，重试一次断言不变。 */
  'probe-no-leaked-accounts.cjs',
  /* 【2026-10-19】Chrome 未上报/启动抖动，单跑会跳过；重试一次，断言不变。 */
  'probe-browser-chain-play.cjs',
];
const CASE_TIMEOUT_MS = Math.max(10, parseInt(timeoutArg ? timeoutArg.split('=')[1] : '300', 10) || 300) * 1000;

function listFrom(file, pattern) {
  const p = path.join(__dirname, file);
  const src = fs.readFileSync(p, 'utf8');
  const found = [];
  for (const m of src.matchAll(pattern)) { if (!found.includes(m[1])) found.push(m[1]); }
  return found;
}

const suites = listFrom('run-9suites.cjs', /['"]([A-Za-z0-9_\-]+\.js)['"]/g).map(n => ({ name: n, dir: path.join(ROOT, '_relaytest', n) }));
const probes = listFrom('run-probes.cjs', /['"](probe-[A-Za-z0-9_\-]+\.cjs)['"]/g).map(n => ({ name: n, dir: path.join(__dirname, n) }));
/* 【2026-10-05】后加的门禁成员（尚未并入 run-probes.cjs 清单，先在这里登记，保证并行门禁覆盖得到） */
['probe-perm-text-authority.cjs', 'probe-huginn-chaos-final.cjs', 'probe-po-recycle-cost.cjs', 'probe-jiye-d4.cjs', 'probe-gangbi-sp.cjs', 'probe-gangbi-search.cjs', 'probe-armband-faceup.cjs', 'probe-postuse-owner.cjs', 'probe-envask-seat.cjs', 'probe-auth-mode.cjs', 'probe-auth-fallback.cjs', 'probe-auth-client-loop.cjs', 'probe-auth-entry.cjs'].forEach(n => { if (!probes.some(p => p.name === n)) probes.push({ name: n, dir: path.join(__dirname, n) }); });
let all = [...suites, ...probes];
if (SUITES_ONLY) all = [...suites];
if (ONLY) all = all.filter(x => x.name.toLowerCase().includes(ONLY.toLowerCase()));
if (EXCLUDE.length) all = all.filter(x => !EXCLUDE.some(e => x.name.toLowerCase().includes(e.toLowerCase())));
console.log('并行门禁：套件 ' + suites.length + " 条、探针 " + probes.length + ' 条'
  + (ONLY ? ('（--only=' + ONLY + ' ⇒ 只跑 ' + all.length + ' 条）') : '')
  + '；并发 ' + JOBS + ' 路；单例超时 ' + Math.round(CASE_TIMEOUT_MS / 1000) + ' 秒');

/* 【2026-10-09 作者目标第8项·门禁缓存】输入哈希 + 绿结果缓存
   —— 目的：同一份代码反复跑门禁（改一行也要等 6 分钟）太浪费。规则：
      · 哈希＝"该成员自身文件 + 引擎/数据/夹具"的内容摘要；任一变化 ⇒ 缓存失效、自动重跑 ✓
      · **只缓存绿结果**（红的绝不缓存 ⇒ 不会把失败藏起来 ✗）
      · --no-cache 强制全跑；--clear-cache 清空缓存 */
const crypto = require('crypto');
const CACHE_FILE = path.join(ROOT, 'port-old', '_gate-cache.json');
const NO_CACHE = process.argv.indexOf('--no-cache') >= 0;
if (process.argv.indexOf('--clear-cache') >= 0) { try { fs.unlinkSync(CACHE_FILE); console.log('缓存已清空'); } catch (e) {} }
function __inputsOf(item) {
  const list = [item.dir,
    path.join(ROOT, 'assets', 'engine.js'), path.join(ROOT, 'assets', 'ui.js'),
    path.join(ROOT, 'game.html'), path.join(ROOT, 'data', 'cards.json'),
    path.join(ROOT, 'cards.js'), __filename, path.join(ROOT, 'tools', 'gate-proof.cjs'),
    path.join(ROOT, 'tools', 'gate-then.cjs'),
    path.join(ROOT, 'tools', 'check-mobile-playable.cjs'), path.join(ROOT, 'port-old', '_audit-card-behavior.cjs'),
    path.join(ROOT, 'port-old', 'run-probes.cjs'), path.join(ROOT, 'port-old', 'run-9suites.cjs')];
  // 运行资源和浏览器夹具变化也必须使旧绿灯失效。
  fs.readdirSync(path.join(ROOT, 'assets')).filter(f => /\.(js|css)$/.test(f)).sort()
    .forEach(f => list.push(path.join(ROOT, 'assets', f)));
  fs.readdirSync(path.join(ROOT, 'port-old', 'e2e')).filter(f => /\.(cjs|mjs|js)$/.test(f)).sort()
    .forEach(f => list.push(path.join(ROOT, 'port-old', 'e2e', f)));
  try { fs.readdirSync(path.join(ROOT, '_relaytest', 'lib')).forEach(f => list.push(path.join(ROOT, '_relaytest', 'lib', f))); } catch (e) {}
  return list;
}
function __hashOf(item) {
  const h = crypto.createHash('sha1');
  for (const f of __inputsOf(item)) {
    try { h.update(f); h.update(fs.readFileSync(f)); } catch (e) { h.update('(missing)'); }
  }
  return h.digest('hex').slice(0, 16);
}
function __readCache() { try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) { return {}; } }
function __writeCache(o) { try { fs.writeFileSync(CACHE_FILE, JSON.stringify(o), 'utf8'); } catch (e) {} }

function runOne(item) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const ch = spawn(process.execPath, [item.dir], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let timedOut = false;
    /* 单例超时：到点强杀整棵进程树（Windows 用 taskkill /T），并判为失败 */
    const timer = setTimeout(() => {
      timedOut = true;
      out += '\n❌ 超时 ' + Math.round(CASE_TIMEOUT_MS / 1000) + ' 秒被强杀（疑似挂死）\n';
      try {
        if (process.platform === 'win32') spawn('taskkill', ['/PID', String(ch.pid), '/T', '/F'], { stdio: 'ignore' });
        else { try { process.kill(-ch.pid, 'SIGKILL'); } catch (e) { ch.kill('SIGKILL'); } }
      } catch (e) { try { ch.kill('SIGKILL'); } catch (e2) {} }
    }, CASE_TIMEOUT_MS);
    ch.stdout.on('data', d => { out += d.toString(); if (out.length > 200000) out = out.slice(-100000); });
    ch.stderr.on('data', d => { out += d.toString(); });
    ch.on('close', code => {
      clearTimeout(timer);
      resolve({ ...item, code: timedOut ? -2 : code, timedOut, ms: Date.now() - t0, out });
    });
    ch.on('error', e => { clearTimeout(timer); resolve({ ...item, code: -1, ms: Date.now() - t0, out: '启动失败：' + e.message }); });
  });
}

const CACHE_OBJ = __readCache();

(async () => {
  const results = [];
  const queue = all.slice();
  const t0 = Date.now();
  async function worker() {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const inputHash = __hashOf(item);
      /* 【目标第8项】输入没变且上次是绿的 ⇒ 直接跳过（打印"缓存命中"） */
      if (!NO_CACHE) {
        const __c = CACHE_OBJ[item.name];
        const __h = __hashOf(item);
        if (__c && __c.ok === true && __c.hash === __h) {
          console.log('  ⏭ ' + item.name.padEnd(34) + '缓存命中（输入未变、上次通过）');
          results.push({ ...item, code: 0, ms: 0, out: '(cache)', cached: true });
          continue;
        }
      }
      let r = await runOne(item);
      if (__hashOf(item) !== inputHash) { r.code = -3; r.out += '\n❌ 运行期间输入文件变化，不记录绿缓存'; }
      /* 跑完写缓存：**只缓存绿** ✗红的一律不写（避免把失败藏起来） */
      try {
        if (!NO_CACHE) {
          const __h2 = __hashOf(item);
          if (r.code === 0) CACHE_OBJ[item.name] = { ok: true, hash: __h2, at: Date.now() };
          else delete CACHE_OBJ[item.name];
          __writeCache(CACHE_OBJ);
        }
      } catch (e) {}
      /* 【2026-10-09】已知不稳的探针：红了一次先重试（仍红才算失败），并如实打印 */
      if (r.code !== 0 && FLAKY.some(f => f === item.name)) {
        console.log('  ↻ ' + r.name + ' 首次未通过 ⇒ 按"已知不稳"重试一次');
        const r2 = await runOne(item);
        console.log('  ' + (r2.code === 0 ? '✅（重试通过，判为不稳而非回归）' : '❌（重试仍失败，计为真失败）') + ' ' + r2.name);
        r = r2;
        if (__hashOf(item) !== inputHash) { r.code = -3; r.out += '\n❌ 重试期间输入文件变化'; }
      }
      results.push(r);
      console.log((r.code === 0 ? '  ✅ ' : '  ❌ ') + r.name.padEnd(34) + String(Math.round(r.ms / 1000)) + 's' + (r.timedOut ? '（超时被强杀）' : ''));
    }
  }
  await Promise.all(Array.from({ length: Math.min(JOBS, all.length) }, worker));

  const failed = results.filter(r => r.code !== 0);
  const cachedN = results.filter(r => r.cached).length;
  console.log('\n总耗时 ' + Math.round((Date.now() - t0) / 1000) + 's；通过 ' + (results.length - failed.length) + '，失败 ' + failed.length + (cachedN ? ('（其中 ' + cachedN + ' 条缓存命中）') : ''));
  for (const f of failed) {
    console.log('\n—— 失败：' + f.name + '（exit ' + f.code + '）——');
    const lines = String(f.out).split('\n').filter(l => /❌|Error|error|失败|未通过/.test(l)).slice(0, 8);
    console.log(lines.length ? lines.map(l => '  ' + l.trim()).join('\n') : '  （未捕获到关键行）');
  }
  console.log(failed.length ? '\n❌ 并行门禁未通过 ⇒ 不许发布' : '\n✅ 并行门禁全部通过 ⇒ 可以走发布链');
  process.exit(failed.length ? 1 : 0);
})();
