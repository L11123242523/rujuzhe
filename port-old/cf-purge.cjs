/* 清 Cloudflare 边缘缓存（站点走代理 Worker：cacheEverything:true, cacheTtl:86400，
 * 于是 cards.js 这类资源会被边缘钉住 24 小时 —— 2026-10-01 作者实测"卡还是旧的"就是这个）。
 * 用法：node port-old/cf-purge.cjs [路径...]      默认清 cards.js / query.html / game.html
 *       node port-old/cf-purge.cjs --all          整站清
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const cfg = fs.readFileSync(path.join(ROOT, 'Cloudflare.txt'), 'utf8');
const zone = (cfg.match(/ID:\s*([0-9a-f]{32})/i) || [])[1];
const token = (cfg.match(/API:\s*(cf(?:ut|at|api|k)_[A-Za-z0-9_\-]+)/) || [])[1];
if (!zone || !token) { console.log('❌ Cloudflare.txt 里没解析到 zone id / API token'); process.exit(1); }
console.log('zone=' + zone + '  token=' + token.slice(0, 12) + '…');

const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const all = process.argv.indexOf('--all') >= 0;
const paths = args.length ? args : ['cards.js', 'query.html', 'game.html'];
const body = all ? { purge_everything: true } : { files: paths.map(p => 'https://rujuzhe-b-a-gs.top/' + p.replace(/^\//, '')) };

(async () => {
  const r = await fetch('https://api.cloudflare.com/client/v4/zones/' + zone + '/purge_cache', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  let j = null; try { j = JSON.parse(t); } catch (e) {}
  console.log('HTTP ' + r.status);
  console.log(t.slice(0, 500));
  if (j && j.success) console.log('✅ 已提交清除：' + (all ? '整站' : paths.join('、')));
  else { console.log('❌ 清除失败（看上面的 errors）'); process.exit(1); }
})();
