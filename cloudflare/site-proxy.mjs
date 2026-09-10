/* =====================================================================
 * site-proxy.mjs —— 把自有域名（根域 / www）反代到 GitHub Pages 上的静态站
 * ---------------------------------------------------------------------
 * 为什么是反代而不是把文件搬进 Cloudflare：
 *   静态站有 392 个文件 / 90MB（其中 assets/images 就 386 个）。
 *   搬迁需要先把这些文件下载一遍再上传，而实测本机到 raw.githubusercontent
 *   的持续吞吐只有 0.02 MB/s（5MB 要 310 秒），GitHub Pages 更是 600 秒超时。
 *   反代零上传、立刻生效，而且内容跟 GitHub Pages 自动保持同步 ——
 *   仓库那边照旧用 deploy_rujuzhe.ps1 发布即可。
 *
 * 缓存策略：
 *   图片 / JS / CSS 等静态资源 -> Cloudflare 边缘长缓存（1 天），命中后极快
 *   HTML                        -> 不缓存，改了立刻生效（避免发布后看到旧页面）
 * ===================================================================== */

const ORIGIN = 'https://l11123242523.github.io/rujuzhe';
const ALLOWED_HOSTS = ['rujuzhe-b-a-gs.top', 'www.rujuzhe-b-a-gs.top'];
const ASSET_RE = /\.(png|jpe?g|webp|gif|svg|ico|js|css|woff2?|ttf|eot|mp3|ogg|wav|json|map)$/i;
// 只透传这些请求头，避免把原始 Host 之类带给 GitHub Pages
const PASS_HEADERS = ['accept', 'accept-language', 'accept-encoding', 'user-agent',
  'if-none-match', 'if-modified-since', 'range'];

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (ALLOWED_HOSTS.indexOf(url.hostname) === -1) {
      return new Response('not found', { status: 404 });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('method not allowed', { status: 405 });
    }

    const headers = new Headers();
    for (const k of PASS_HEADERS) {
      const v = request.headers.get(k);
      if (v) headers.set(k, v);
    }

    const isAsset = ASSET_RE.test(url.pathname);
    const init = { method: request.method, headers, redirect: 'follow' };
    if (isAsset) {
      init.cf = {
        cacheEverything: true,
        cacheTtl: 86400,
        cacheTtlByStatus: { '200-299': 86400, '301-302': 3600, '404': 60, '500-599': 0 }
      };
    }

    const res = await fetch(ORIGIN + url.pathname + url.search, init);
    const out = new Response(res.body, res);
    out.headers.set('x-served-by', 'rujuzhe-edge-proxy');
    // 根域访问 / 时给个明确提示，方便排查
    if (url.pathname === '/' && res.status === 404) {
      return new Response('静态源站没有首页（GitHub Pages 上的 index.html 不存在）', { status: 404 });
    }
    out.headers.set('cache-control', isAsset ? 'public, max-age=86400' : 'public, max-age=60');
    return out;
  }
};
