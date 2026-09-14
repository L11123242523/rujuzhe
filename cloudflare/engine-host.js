/* 引擎宿主（C 阶段第 4 步 · 批次 1）：在**没有浏览器**的环境里起一份游戏运行时
 * ===========================================================================
 * 用途：Durable Object / Worker 里每个房间一份运行时；Node 测试里也可以在**同一进程**里起多份
 *   （不需要 vm —— 这是本批次的关键结论：运行时用形参遮蔽全局，所以多份天然隔离）。
 * 与浏览器的一致性来自两件事：
 *   ① 假 DOM 与测试底座是**同一份实现**（`cloudflare/engine-dom.js` 由 harness 抽出生成）；
 *   ② 初始化顺序与浏览器一致：脚本执行 → DOMContentLoaded → load（游戏在 load 里 initCards）。
 * 用法（Node）：
 *   const { createEngineHost } = require('../cloudflare/engine-host.js');
 *   const host = createEngineHost({ cardDataJson, ENV: serverEnv });
 *   host.load();                       // 触发 load（内部 initCards）
 *   host.sandbox.startBattle();        // 之后照常调用引擎 API
 */
'use strict';
const { createEngineDom } = require('./engine-dom.js');
const { createEngineRuntime } = require('./engine-runtime.js');

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(String(k)) ? m.get(String(k)) : null),
    setItem: (k, v) => { m.set(String(k), String(v)); },
    removeItem: (k) => { m.delete(String(k)); },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] || null,
    get length() { return m.size; }
  };
}

/** 造一份运行时。opts: { cardDataJson, ENV, WebSocket, fetch, THREE, seedNow } */
function createEngineHost(opts) {
  opts = opts || {};
  const dom = createEngineDom(opts);
  const sandbox = {};

  // window 也是事件目标：游戏在 window.addEventListener('load', …) 里做初始化
  const winListeners = {};
  sandbox.addEventListener = (t, fn) => { (winListeners[t] = winListeners[t] || []).push(fn); };
  sandbox.removeEventListener = (t, fn) => { const a = winListeners[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  sandbox.dispatchEvent = (ev) => { const t = ev && ev.type; (winListeners[t] || []).slice().forEach(fn => fn(ev || {})); return true; };
  sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox; sandbox.top = sandbox;

  const btoaImpl = (typeof btoa === 'function') ? btoa : undefined;
  const atobImpl = (typeof atob === 'function') ? atob : undefined;

  const runtime = createEngineRuntime({
    globalThis: sandbox,
    window: sandbox,
    document: dom.document,
    setTimeout, clearTimeout, setInterval, clearInterval,
    localStorage: memoryStorage(),
    sessionStorage: memoryStorage(),
    navigator: { userAgent: 'rujuzhe-engine-host', language: 'zh-CN', platform: 'server' },
    location: { href: 'engine://room', search: '', protocol: 'engine:', host: 'engine' },
    btoa: btoaImpl, atob: atobImpl,
    performance: (typeof performance !== 'undefined') ? performance : undefined,
    WebSocket: opts.WebSocket,
    fetch: opts.fetch,
    THREE: opts.THREE,
    ENV: opts.ENV
  });

  // 与浏览器一致：卡数据来自页内 <script id="cardData"> 的 textContent
  if (opts.cardDataJson) {
    dom.document.getElementById('cardData').textContent = opts.cardDataJson;
    sandbox.cardData = JSON.parse(opts.cardDataJson);
  }

  const host = {
    sandbox: runtime.sandbox,
    document: dom.document,
    byId: dom.byId,
    diagnostics: dom.diagnostics,
    /* 批次 2：运行时自报的"作用域清单"与自检（在没有 with 之后，靠它守住"名字清单没漏"）。
       scopeNames = 声明成局部变量、并在 sandbox 上装了转发存取器的名字。 */
    scopeNames: runtime.scopeNames || [],
    selfCheck: runtime.selfCheck || null,
    api: runtime.api,
    loadEvents: [], loadErrors: [],
    /** 触发一个 window 事件；出错如实记账（不静默吞） */
    fire(type) {
      try { runtime.sandbox.dispatchEvent({ type, bubbles: false }); this.loadEvents.push(type); return true; }
      catch (e) { this.loadErrors.push(type + ': ' + (e && e.message)); return false; }
    },
    /** 与浏览器同序：DOMContentLoaded → load */
    load() {
      this.fire('DOMContentLoaded');
      this.fire('load');
      return runtime.sandbox.allCards || [];
    }
  };
  return host;
}

module.exports = { createEngineHost, memoryStorage };
