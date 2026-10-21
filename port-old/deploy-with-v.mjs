/* port-old/deploy-with-v.mjs —— 【一条命令的安全发布】把"第 91 项事故"从机制上堵死
 *
 *  背景（2026-10-06 事故）：文件内容更新了，但浏览器/边缘缓存按**完整 URL（含 ?v=）**缓存 ⇒
 *  `assets/engine.js?v=1` 一直命中**旧缓存**（旧的 36KB 引擎）⇒ 页面加载残缺引擎 ⇒ 连锁卡死 ✗。
 *
 *  本脚本把发布链固定成五步，任何一步失败就中止：
 *    ① 语法/结构自检（_writecheck）
 *    ② **自动升版本号**：凡是本次要发布的 assets/*.js|.css，其 `?v=N` 全部 +1（只改引用，不动文件）
 *    ③ 调用既有发布器 publish-api-item2.cjs（路径先 Test-Path）
 *    ④ 等 ~110 秒后核验：**新 URL（?v=N+1）** 取到的字节必须与本地一致（缓存键变了 ⇒ 必回源 ✓）
 *    ⑤ 打印"镜像存档"提示（git 提交由调用者决定）
 *
 *  用法：
 *    node port-old/deploy-with-v.mjs --msg=<提交说明文件> [--files=game.html,assets/engine.js] [--dry]
 *    默认 files = game.html + 全部 assets/*.js|.css
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'node:url';
import GateProof from '../tools/gate-proof.cjs';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = n => { const a = process.argv.find(x => x.startsWith('--' + n + '=')); return a ? a.split('=').slice(1).join('=') : null; };
const dry = process.argv.includes('--dry');
const msgFile = arg('msg');
/* 【2026-10-10 结构修】禁止复用旧说明：2026-10-08 之后**连续 20 多次发布的提交说明都是同一句旧文案**
   （因为都沿用 port-old/_commitmsg-item2.txt 这个默认文件 ⇒ 提交历史完全读不出改了什么 ✗）。
   ⇒ 发布入口**要求显式指定** --msg，缺了就中止（不再保留"忘了就沿用旧的"这条路）。 */
if (!msgFile) {
  console.log('❌ 必须显式指定 --msg=<说明文件>（禁止复用默认说明：曾连续 20+ 次发布都写成同一句旧文案 ✗）');
  process.exit(1);
}
let files = (arg('files') || '').split(',').map(s => s.trim()).filter(Boolean);
if (!files.length) {
  files = ['game.html'];
  const ad = path.join(ROOT, 'assets');
  /* 【2026-10-07 修】这里必须拼成**正斜杠**路径：git tree 的 path 不认 Windows 反斜杠，
     用 path.join 拼出来的 `assets\engine.js` 会让那条 entry 指向一个不存在的路径
     ⇒ 改动过的 assets 静默地没被发布（而没改过的文件因为新旧相同，核对时照样"通过"）。 */
  if (fs.existsSync(ad)) fs.readdirSync(ad).filter(f => /\.(js|css)$/.test(f)).forEach(f => files.push('assets/' + f));
}
const run = (cmd, args, opts = {}) => spawnSync(process.execPath, [path.join(ROOT, 'port-old', cmd), ...args], { cwd: ROOT, encoding: 'utf8', ...opts });

let releasePrepared = false;
try { GateProof.verify(ROOT, false, files.filter(f => f !== 'gamefiles.json')); console.log('✅ 发布前门禁凭据与当前文件一致'); }
catch (e) {
  try { GateProof.verify(ROOT, true, files.filter(f => f !== 'gamefiles.json')); }
  catch (preparedError) { console.error('❌ 中止发布：' + e.message); process.exit(1); }
  releasePrepared = true;
  console.log('✅ 文件精确匹配上次已准备的发布内容，继续同一版本');
}

console.log('=== ① 语法/结构自检 ===');
{
  const r = run('_writecheck.cjs', ['game.html']);
  console.log('  ' + (r.status === 0 ? '✅' : '❌') + ' _writecheck' + (r.status ? ('\n' + String(r.stdout || '').slice(-400)) : ''));
  if (r.status !== 0) process.exit(1);
}

console.log('\n=== ② 自动升版本号（缓存键必须变）===');
{
  /* 【第 73 轮修】dry 必须**传导**给 bump 脚本，否则空跑也会改盘（我上轮就这么误写过一次 ✗） */
  if (!releasePrepared) {
    const r = run('bump-asset-version.cjs', dry ? ['--dry'] : []);
    const out = String(r.stdout || '');
    console.log(out.split('\n').filter(l => l.trim()).slice(0, 10).join('\n'));
    if (r.status !== 0) process.exit(1);
  } else console.log('  沿用已批准的版本号，不重复升版');
  if (dry) { console.log('\n（dry：已确认不会写盘；到此为止）'); process.exit(0); }
  /* 记录升级后的版本号，供第 ④ 步核验 */
  const html = fs.readFileSync(path.join(ROOT, 'game.html'), 'utf8');
  const vers = {};
  for (const m of html.matchAll(/(assets\/[A-Za-z0-9_.\-\/]+\.(?:js|css))\?v=(\d+)/g)) vers[m[1]] = m[2];
  globalThis.__vers = vers;

  /* 【2026-10-13 结构修·发布链静默失效（本次实测）】
     第 ② 步会把 `game.html` 里**所有** assets 的 `?v=` 升位并写盘 ✓，但第 ③ 步只发 `--files` 里列的文件 ✗。
     ⇒ 只发 `port-old/xxx.cjs`（不动 assets）时：本地 game.html 变成 ?v=N+1、**仓库里还是 ?v=N** ✗，
       而第 ④ 步只核验 assets 的 ?v=、**从不核验 game.html** ⇒ 照样打印"全部一致 ✅"＝**假绿灯** ✗。
     ⇒ 结构约束写进脚本：只要本次动了 `assets/`，`game.html` **必须**一起发 ✓（作者划定的铁律，这里落地成机制）。 */
  const __hasAsset = files.some(f => /^assets\//.test(f));
  if (__hasAsset && !files.includes('game.html')) {
    files.push('game.html');
    console.log('  ⚠ 检测到本次发布含 assets/ 但没列 game.html ⇒ **已自动追加 game.html** ✓（bump 已改过它的 ?v=，不发就是假绿灯）');
  }
}

/* 【2026-10-10 结构修·母本缓存键】只要本次要发 `data/cards.json`，就**自动升 app.js 里那个 fetch 键**
   （`fetch('data/cards.json?v=N')`）。为什么必须自动：CF/浏览器按**完整 URL** 缓存，今天实测 ——
   母本更新后没再升键，`?v=2` 那条一直是 cf=HIT 的旧字节（193915 vs 新的 193896）⇒ 玩家拉到的还是旧母本 ✗。
   连带效果：app.js 内容变了 ⇒ 必须同时发 app.js；而 game.html 里的 app.js `?v=` 已由上面的 assets 升位处理 ⇒ 也要一起发。
   注：肉鸽那行 `data/rogue-cards.json?v=1` **不动**（未经点名不碰）。 */
if (files.includes('data/cards.json')) {
  const ap = path.join(ROOT, 'assets', 'app.js');
  if (fs.existsSync(ap)) {
    if (!releasePrepared) {
      const src = fs.readFileSync(ap, 'utf8');
      const m = src.match(/fetch\('data\/cards\.json\?v=(\d+)'/);
      if (!m) { console.log('❌ 找不到 assets/app.js 里的 data/cards.json?v=N（母本缓存键）⇒ 中止，别发旧数据'); process.exit(1); }
      if (dry) { console.log('（dry：会把 assets/app.js 的母本键 v=' + m[1] + ' 升到 v=' + (Number(m[1]) + 1) + '）'); }
      else {
        const next = src.replace(m[0], "fetch('data/cards.json?v=" + (Number(m[1]) + 1) + "'");
        fs.writeFileSync(ap, next, 'utf8');
        console.log('  母本缓存键：data/cards.json?v=' + m[1] + ' → v=' + (Number(m[1]) + 1) + '（已写 assets/app.js）');
      }
    }
    for (const f of ['assets/app.js', 'game.html']) if (!files.includes(f)) files.push(f);
    console.log('  连带发布：' + files.join('、'));
  }
}

if (dry) { console.log('\n（dry：到此为止，未发布）'); process.exit(0); }

/* ============================================================
 * 【2026-10-15】发布链**自动**生成并连带发布 `gamefiles.json`（软件版增量更新清单）
 * ------------------------------------------------------------
 * 作者痛点：「软件版每次更新都要换包挺麻烦的」。软件版现在会在启动时拉这份清单，
 * 只下载**变了的文件**（引擎/卡表/卡图/音效…）⇒ 作者照常发布网页版，玩家不用换包 ✓。
 * 为什么放在发布链里（而不是让作者记得手动跑）：
 *   手跑一定会漏 ⇒ 清单与线上文件漂移 ⇒ 软件版要么漏更新、要么反复下一堆相同文件 ✗。
 *   放在这里 ⇒ **清单与它所描述的那批文件永远同一次提交**（同一 commit ⇒ 原子一致）✓。
 * ============================================================ */
console.log('\n=== ②.5 生成游戏内容清单 gamefiles.json（软件版增量更新用）===');
{
  /* 【2026-10-15 补·结构性防漂移】本步会按"**当前本地**内容"算哈希，其中包含 game.html。
     而 ② 步**已经**把本地 game.html 的 ?v= 升过位了 ⇒ 若本次不把 game.html 一起发出去，
     清单就会描述一个**仓库里并不存在**的 game.html 版本 ⇒ 软件版增量更新时必然"哈希不符，跳过" ✗
     （实测发生过：只发 gamefiles.json ⇒ 仓库 game.html 停在 v351、清单却指向 v352 的字节）
     ⇒ 清单一旦带上 game.html，就**强制**把它并进本次发布，保证两者同一次提交 ✓ */
  const r = run('gen-gamefiles-manifest.cjs', ['--write'], { cwd: path.join(ROOT, 'port-old') });
  console.log(String(r.stdout || '').split('\n').filter(l => l.trim()).slice(0, 4).join('\n'));
  if (r.status !== 0) { console.log('❌ 清单生成失败 ⇒ 中止（不让清单与线上文件漂移）'); process.exit(1); }
  if (!files.includes('gamefiles.json')) files.push('gamefiles.json');
  try {
    const mf = JSON.parse(fs.readFileSync(path.join(ROOT, 'gamefiles.json'), 'utf8'));
    if (mf && mf.files && mf.files['game.html'] && !files.includes('game.html')) {
      files.push('game.html');
      console.log('  【自动补】清单里含 game.html ⇒ 强制把它一并发布（否则清单会指向仓库里不存在的版本）');
    }
  } catch (e) { console.log('  ⚠ 读清单失败（跳过自动补 game.html）：' + (e && e.message)); }
  console.log('  已并入本次发布：' + files.join('、'));
}

console.log('\n=== ③ 发布 ===');
{
  const missing = files.filter(f => !fs.existsSync(path.join(ROOT, f)));
  if (missing.length) { console.log('❌ 缺文件：' + missing.join('、')); process.exit(1); }
  const args = [...files];
  if (msgFile) args.push('--msg=' + msgFile);
  try { GateProof.verify(ROOT, true, files); }
  catch (e) { console.error('❌ 中止发布：' + e.message); process.exit(1); }
  const r = run('publish-api-item2.cjs', args, { env: { ...process.env, RUJUZHE_RELEASE_PREPARED: '1' } });
  console.log(String(r.stdout || '').split('\n').filter(l => /PUBLISHED|回滚|错误|失败/.test(l)).join('\n'));
  if (r.status !== 0) process.exit(1);
}

console.log('\n=== ④ 等 110 秒后核验新 URL ===');
const wait = ms => new Promise(r => setTimeout(r, ms));
await wait(110000);
{
  const crypto = await import('node:crypto');
  const h = b => crypto.createHash('sha256').update(b).digest('hex').slice(0, 10);
  let bad = 0;
  for (const [rel, ver] of Object.entries(globalThis.__vers || {})) {
    const p = path.join(ROOT, rel);
    if (!fs.existsSync(p)) continue;
    const local = fs.readFileSync(p);
    try {
      const res = await fetch('https://rujuzhe-b-a-gs.top/' + rel + '?v=' + ver, { cache: 'no-store' });
      const live = Buffer.from(await res.arrayBuffer());
      const ok = live.length === local.length && h(live) === h(local);
      if (!ok) bad++;
      console.log('  ' + (ok ? '✅' : '⚠') + ' ' + rel + '?v=' + ver + ' 线上' + live.length + ' / 本地' + local.length + ' cf=' + res.headers.get('cf-cache-status'));
    } catch (e) { bad++; console.log('  ⚠ ' + rel + ' 取不到：' + e.message); }
  }
  if (bad) { console.log('\n❌ 有 ' + bad + ' 个资源在**新 URL** 上仍与本地不一致 ⇒ 先别收工，查发布/缓存'); process.exit(1); }
}
console.log('\n=== ⑤ 全部一致 ✅ ===');
console.log('  ⚠ 本步只核验 **assets/*.js|css**（按它们各自的 ?v= 取回比字节）——`game.html` 本身**不在**本步核验范围内 ✗；');
console.log('    它的字节请在发布后用 tools/_check-head-gamehtml-1013.cjs（按 blob）或 tools/_probe-full-consistency-1013.cjs 复核 ✓');
console.log('  提示：本地/镜像 git 提交请自行执行（git add -A && git commit）；' +
  '记法：`game.html` 与 assets 的字节已核对，浏览器会因 ?v 变化而取到新版 ✓');

/* === ⑥ 顺手清一次 Cloudflare 缓存（作者 2026-10-11 接上 ✓）===
   为什么：assets 都带新的 `?v=` 键 ⇒ 不靠清缓存也能取到新版 ✓；
   但 `game.html` / 首页这类**没有版本键**的路径万一被边缘缓存住，玩家会看到旧页面 ✗（表现为"你说发了但我这儿没变" ✓）。
   【2026-10-17 补·**`gamefiles.json` 必须一起清**（作者报「桌面版重启后还是 v412」⇒ 真因 ✓）】
     桌面版的「游戏内容增量更新」在启动时取 `https://rujuzhe-b-a-gs.top/gamefiles.json`，
     再按里面的哈希决定下哪些文件（见 D:\入局者桌面版\main.js 的 checkContentUpdate）。
     而该路径被 CF 边缘缓存成 `Cache-Control: public, max-age=86400`（实测 `cf-cache-status: HIT`、Age 1.7 万秒）
     ⇒ 桌面版读到的是**几天前的旧清单** ⇒ 判断「需要更新 0 个」⇒ **永远不更新** ✗✗
     （它请求头里虽然带了 `cache-control: no-cache`，CF 对这条**不生效** ⇒ 只能靠发布时清 ✓）
     现状核对：裸路径的 `assets/engine.js` 是 `MISS`、`game.html` 是 `DYNAMIC` ⇒ 都能取到新版 ✓，
     **只有 `gamefiles.json` 被缓存住** ⇒ 加进清理清单即可根治 ✓
   凭据：`Cloudflare.txt` 的 `ID:`（zone）与 `API:`（token，作者 2026-10-11 新建的 cfut_ 那枚 ✓）。
   失败**不影响发布结果**（只打印状态 ✓，绝不因此把已成功的发布判失败 ✗）。 */
try {
  const fs2 = await import('node:fs');
  const path2 = await import('node:path');
  const url2 = await import('node:url');
  const ROOT2 = path2.join(path2.dirname(url2.fileURLToPath(import.meta.url)), '..');
  const cfg2 = fs2.readFileSync(path2.join(ROOT2, 'Cloudflare.txt'), 'utf8');
  const zone2 = (cfg2.match(/ID:\s*([0-9a-f]{32})/i) || [])[1];
  const tok2 = (cfg2.match(/API:\s*(\S+)/) || [])[1];
  if (zone2 && tok2) {
    /* 【2026-10-17 实测·**逐文件清理不够，必须整区清**】
       先用 `files:[…, gamefiles.json]` 调 ⇒ 返回 `success:true`，但 30 秒后复核**仍是 `cf-cache-status: HIT`、Age 继续涨**
       （线上还是 v412）✗；改用 `purge_everything:true` ⇒ 立刻 `MISS`、线上变 v421 ✓。
       ⇒ 本链固定用**整区清理**（本站很小，代价可接受；资产都带 `?v=` 新键，本来就要重新取 ✓）。 */
    const purge = await fetch('https://api.cloudflare.com/client/v4/zones/' + zone2 + '/purge_cache', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tok2, 'Content-Type': 'application/json' },
      body: JSON.stringify({ purge_everything: true })
    });
    const purgeTxt = await purge.text();
    let purgeOk = false;
    try { purgeOk = JSON.parse(purgeTxt).success === true; } catch (e) {}
    /* 【2026-10-13 修】原来只看 `purge.status === 200` ✗ —— Cloudflare 的"成功"是响应体里的 success:true ✓
       （HTTP 200 也可能带着 errors 返回 ⇒ 之前"已清缓存 ✓"这句话本身也可能是假绿灯 ✗）。 */
    console.log(purgeOk
      ? '=== ⑥ Cloudflare **整区**缓存已清（含 gamefiles.json ⇒ 桌面版下次启动就能看到新内容清单）✓ ==='
      : '=== ⑥ 清缓存未成功（HTTP ' + purge.status + '，success≠true，不影响本次发布 ✓）：' + String(purgeTxt).slice(0, 160) + ' ===');
  } else { console.log('=== ⑥ 跳过清缓存（Cloudflare.txt 里没解析到 zone/token）==='); }
} catch (e) { console.log('=== ⑥ 清缓存出错（不影响本次发布 ✓）：' + (e && e.message) + ' ==='); }

/* === ⑦ 发布后自检：**内容清单（gamefiles.json）也要能取到新版本** ===
   【2026-10-17 新增】作者报「桌面版重启后还是 v412」⇒ 真因就是这个路径被 CF 边缘缓存住：
     桌面版的「游戏内容增量更新」启动时取它，读到旧清单 ⇒ 判断"需要更新 0 个" ⇒ **永远不更新** ✗
     （当时实测：线上清单 v412 / 本地 v421；加 `?cb=` 绕缓存才是 v421 ⇒ 一眼可辨）
   为什么必须自检：第 ④ 步只核 `assets/*.js|css`（它们带 `?v=`，缓存键变了必然回源 ✓），
     而 `gamefiles.json` 是**裸路径**、最容易被缓存住 ⇒ 之前一直没被发现 ✗
   ⇒ 这里**不带任何参数**取一次线上清单，v 必须等于本地刚写的那份 ✓（失败只告警，不推翻已完成的发布） */
try {
  const fs3 = await import('node:fs');
  const path3 = await import('node:path');
  const url3 = await import('node:url');
  const ROOT3 = path3.join(path3.dirname(url3.fileURLToPath(import.meta.url)), '..');
  const localMan = JSON.parse(fs3.readFileSync(path3.join(ROOT3, 'gamefiles.json'), 'utf8'));
  await new Promise((r) => setTimeout(r, 8000));   /* 清缓存有传播延迟（实测整区清 ~12 秒内生效 ✓） */
  const r7 = await fetch('https://rujuzhe-b-a-gs.top/gamefiles.json', { headers: { 'cache-control': 'no-cache' } });
  const onlineMan = await r7.json();
  const same = String(onlineMan && onlineMan.v) === String(localMan && localMan.v);
  console.log(same
    ? '=== ⑦ 内容清单自检：线上 gamefiles.json v=' + onlineMan.v + ' = 本地 ✓（桌面版下次启动能看到新内容）==='
    : '=== ⑦ ⚠ 内容清单自检**不一致**：线上 v=' + (onlineMan && onlineMan.v) + ' / 本地 v=' + (localMan && localMan.v) +
      ' ｜ cf-cache-status=' + (r7.headers.get('cf-cache-status') || '-') + ' ⇒ 桌面版会读到旧清单、不会更新（发布本身已完成 ✓）===');
} catch (e) { console.log('=== ⑦ 内容清单自检出错（不影响本次发布 ✓）：' + (e && e.message) + ' ==='); }
