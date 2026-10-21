/* 全量门禁的内容凭据；只允许原输入及发布器规定的版本号变换。 */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');
const proofPath = root => path.join(root, '.gate-pass.json');
const excluded = /(\.bak|\.before-|\.before_|\.DS_Store|Thumbs\.db|_sync-meta\.json|\.map$)/i;
function capture(root) {
  const files = {};
  function walk(rel, filter) {
    const abs = path.join(root, rel);
    if (excluded.test(path.basename(abs))) return;
    if (fs.statSync(abs).isDirectory()) {
      for (const name of fs.readdirSync(abs).sort()) walk(rel + '/' + name, filter);
    } else if (!filter || filter(rel)) files[rel] = digest(fs.readFileSync(abs));
  }
  for (const rel of ['game.html', 'query.html', 'cards.js', 'assets', 'data', 'vendor']) walk(rel);
  for (const rel of ['_relaytest', 'tools']) walk(rel, f => /\.(js|cjs|mjs)$/.test(f));
  for (const name of fs.readdirSync(path.join(root, 'port-old')).sort()) {
    if (/^probe-.*\.cjs$/.test(name) || ['run-probes.cjs', 'run-9suites.cjs', 'run-gates-parallel.cjs',
      'deploy-with-v.mjs', 'publish-api-item2.cjs', '_writecheck.cjs', 'bump-asset-version.cjs', 'gen-gamefiles-manifest.cjs', '_audit-card-behavior.cjs'].includes(name)) walk('port-old/' + name);
  }
  walk('port-old/e2e', f => /\.(js|cjs|mjs)$/.test(f));
  const sources = {};
  for (const rel of ['game.html', 'assets/app.js']) sources[rel] = fs.readFileSync(path.join(root, rel), 'utf8');
  return { files, sources };
}
function assertSame(expected, actual) {
  const changed = Array.from(new Set([...Object.keys(expected), ...Object.keys(actual)])).filter(f => expected[f] !== actual[f]);
  if (changed.length) throw new Error('门禁输入已变化，请重跑 node tools/gate-then.cjs：' + changed.slice(0, 8).join('、'));
}
function clear(root) { fs.rmSync(proofPath(root), { force: true }); }
function seal(root, before) {
  assertSame(before.files, capture(root).files);
  const proof = { schema: 1, passed: true, root: path.resolve(root), node: process.version, at: new Date().toISOString(), ...before };
  const target = proofPath(root);
  fs.writeFileSync(target + '.tmp', JSON.stringify(proof));
  fs.renameSync(target + '.tmp', target);
  return Object.keys(before.files).length;
}
function verify(root, prepared, publishFiles) {
  let proof;
  try { proof = JSON.parse(fs.readFileSync(proofPath(root), 'utf8')); }
  catch (e) { throw new Error('缺少有效的全量门禁凭据，请先运行 node tools/gate-then.cjs'); }
  if (proof.schema !== 1 || proof.passed !== true || proof.root !== path.resolve(root) || proof.node !== process.version || !proof.files || !proof.sources) throw new Error('门禁凭据无效，请重跑 node tools/gate-then.cjs');
  const expected = { ...proof.files }, paths = (publishFiles || []).map(f => String(f).replace(/\\/g, '/'));
  for (const rel of ['game.html', 'assets/app.js']) {
    if (typeof proof.sources[rel] !== 'string' || digest(proof.sources[rel]) !== proof.files[rel]) throw new Error('门禁凭据的原文件内容不一致');
  }
  if (prepared) {
    expected['game.html'] = digest(proof.sources['game.html'].replace(/(assets\/[A-Za-z0-9_.\-\/]+\.(?:js|css))\?v=(\d+)/g,
      (m, f, v) => f + '?v=' + (Number(v) + 1)));
    if (paths.includes('data/cards.json')) expected['assets/app.js'] = digest(proof.sources['assets/app.js'].replace(/fetch\('data\/cards\.json\?v=(\d+)'/,
      (m, v) => "fetch('data/cards.json?v=" + (Number(v) + 1) + "'"));
  }
  assertSame(expected, capture(root).files);
  const buffers = new Map();
  for (const rel of paths) {
    if (path.isAbsolute(rel) || rel.split('/').some(p => p === '..' || p === '' || p === '.')) throw new Error('发布路径不合法：' + rel);
    const buf = fs.readFileSync(path.join(root, rel));
    if (rel === 'gamefiles.json' && prepared) {
      const manifest = JSON.parse(buf.toString('utf8'));
      const version = (/assets\/engine\.js\?v=(\d+)/.exec(fs.readFileSync(path.join(root, 'game.html'), 'utf8')) || [])[1];
      const runtime = Object.keys(expected).filter(f => /^(?:game\.html$|query\.html$|cards\.js$|assets\/|data\/|vendor\/)/.test(f));
      if (String(manifest.v) !== version || manifest.n !== runtime.length || Object.keys(manifest.files || {}).length !== runtime.length || runtime.some(f => manifest.files[f] !== expected[f].slice(0, 16))) throw new Error('发布内容清单与门禁批准的文件不一致');
    } else if (!expected[rel] || digest(buf) !== expected[rel]) throw new Error('发布文件未经本次门禁验证：' + rel);
    buffers.set(rel, buf);
  }
  return buffers;
}
module.exports = { capture, clear, seal, verify, assertSame };
