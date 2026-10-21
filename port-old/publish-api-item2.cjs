/* 通过 GitHub REST API 发布单个文件（本机 git transport 到 github.com:443 常被墙/超时）。
 * 与前人的 _api_publish.ps1 同机制：blobs → tree(base_tree) → commit → 更新分支 ref（等价一次 git push）。
 * 为什么用 .cjs：PS 5.1 读无 BOM 的 UTF-8 脚本会把中文读成乱码（脚本里连中文路径都会解析失败）；
 *              本仓库规矩也是"带中文的脚本一律写成 .cjs/.mjs"（交接清单铁律#7）。
 * 用法：node port-old/publish-api-item2.cjs [--dry] [路径...]
 *   默认只发 game.html；提交信息取自 port-old/_commitmsg-item2.txt
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OWNER = 'L11123242523';
const REPO = 'rujuzhe';
const BRANCH = 'main';
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
/* 提交信息文件：**必须用 --msg=<路径> 显式指定**。
   【2026-10-10 结构修】原来缺省就沿用 `_commitmsg-item2.txt` ⇒ 2026-10-08 之后连续 20 多次发布的
   提交说明全是同一句旧文案（"队列②完成：贪欲者的烙印…"），提交历史完全读不出改了什么 ✗。
   现在缺 `--msg=` 一律中止，从结构上堵死"复用旧说明"这条路。 */
const msgArg = process.argv.find(a => a.startsWith('--msg='));
if (!msgArg) {
  console.log('❌ 必须显式指定 --msg=<说明文件>（默认的 _commitmsg-item2.txt 已停用：曾被连续复用 ⇒ 说明全是旧文案 ✗）');
  process.exit(1);
}
const MSGFILE = msgArg.slice('--msg='.length);
const dry = process.argv.indexOf('--dry') >= 0;
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const PATHS = files.length ? files : ['game.html'];

const GateProof = require('../tools/gate-proof.cjs');
const prepared = process.env.RUJUZHE_RELEASE_PREPARED === '1';
let approvedBuffers;
try { approvedBuffers = GateProof.verify(ROOT, prepared, PATHS); }
catch (e) { console.error('❌ 中止发布：' + e.message); process.exit(1); }

const token = fs.readFileSync(path.join(ROOT, '.gh_token.txt'), 'utf8').trim();
const H = {
  Authorization: 'Bearer ' + token,
  'User-Agent': 'rujuzhe-publish',
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json; charset=utf-8',
};
const j = async (method, p, body) => {
  const r = await fetch(API + p, { method, headers: H, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(method + ' ' + p + ' → HTTP ' + r.status + '：' + t.slice(0, 300));
  return t ? JSON.parse(t) : null;
};

(async () => {
  console.log('=== 0) 令牌与当前分支头 ===');
  const ref = await j('GET', '/git/ref/heads/' + BRANCH);
  const baseSha = ref.object.sha;
  const baseCommit = await j('GET', '/git/commits/' + baseSha);
  console.log('  令牌可用；' + BRANCH + ' = ' + baseSha);
  console.log('  base tree = ' + baseCommit.tree.sha);

  console.log('=== 1) 上传 blob ===');
  const tree = [];
  for (const p of PATHS) {
    /* 【2026-10-07 修·发布链静默失效】git tree 里的路径**必须是正斜杠**。
       deploy-with-v.mjs 用 path.join 拼出来的是 `assets\engine.js`（Windows 反斜杠），
       直接当 tree path 用 ⇒ 建出一条**指向不存在路径**的 entry，真正的 assets/engine.js **根本没被替换**。
       更坑的是：没改过的文件新旧内容相同 ⇒ 核对时"线上==本地"照样通过，把这个问题掩盖了
       （这次两个真正改过的文件就是这样被判成"线上还是旧的"）。 */
    const treePath = String(p).replace(/\\/g, '/');
    const local = path.join(ROOT, treePath);
    if (!fs.existsSync(local)) throw new Error('本地文件不存在：' + local);
    const buf = approvedBuffers.get(treePath);
    const blob = await j('POST', '/git/blobs', { content: buf.toString('base64'), encoding: 'base64' });
    console.log('  ' + treePath.padEnd(24) + ' ' + Math.round(buf.length / 1024) + ' KB  blob=' + blob.sha.slice(0, 10));
    tree.push({ path: treePath, mode: '100644', type: 'blob', sha: blob.sha });
  }

  console.log('=== 2) 建 tree ===');
  const newTree = await j('POST', '/git/trees', { base_tree: baseCommit.tree.sha, tree });
  console.log('  new tree = ' + newTree.sha);
  if (dry) { console.log('(dry：没有建 commit、没有动分支)'); return; }

  console.log('=== 3) 建 commit ===');
  const message = fs.readFileSync(MSGFILE, 'utf8').trim();
  const newCommit = await j('POST', '/git/commits', { message, tree: newTree.sha, parents: [baseSha] });
  console.log('  new commit = ' + newCommit.sha);

  console.log('=== 4) 更新分支 ref ===');
  GateProof.verify(ROOT, prepared, PATHS);
  const upd = await j('PATCH', '/git/refs/heads/' + BRANCH, { sha: newCommit.sha, force: false });
  console.log('  ' + upd.ref + ' -> ' + upd.object.sha);
  console.log('PUBLISHED ' + newCommit.sha);
  console.log('回滚：PATCH /git/refs/heads/' + BRANCH + ' {"sha":"' + baseSha + '","force":true}');
})().catch(e => { console.log('❌ 发布失败：' + (e && e.message)); process.exit(1); });
