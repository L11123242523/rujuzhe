/* 生成物，请勿手改 —— 由 _relaytest/_build_engine_module.js 从 _relaytest/lib/harness.js 抽取生成。
 * 单一真相：Worker/DO 里的无头 DOM 与测试底座用的是同一份实现（避免"测试里一套、线上另一套"）。
 * createEngineDom(opts) -> { document, byId, diagnostics, el }
 */
'use strict';
function createHarnessDom(opts) {
  opts = opts || {};
  const byId = new Map();
  const diagnostics = { unmatchedSelectors: [], createdBySelector: 0 };

  function matchesSimple(el, sel) {
    sel = String(sel || '').trim();
    if (!sel) return false;
    if (sel[0] === '#') return el.id === sel.slice(1);
    if (sel[0] === '.') return el.classList.contains(sel.slice(1));
    return String(el.tagName || '').toLowerCase() === sel.toLowerCase();
  }
  function walk(el, fn) { for (const c of el.children) { if (fn(c)) return c; const r = walk(c, fn); if (r) return r; } return null; }

  function mkClassList(el) {
    // 单一真相：_classNames；className 是它的访问器（与真实 DOM 一致：
    // 事后写 el.className = 'a b' 必须让 classList.contains('a') 为 true —— 旧桩在这里失真）
    return {
      add(...cs) { cs.forEach(c => el._classNames.add(c)); },
      remove(...cs) { cs.forEach(c => el._classNames.delete(c)); },
      toggle(c, force) {
        const has = el._classNames.has(c);
        const want = (force === undefined) ? !has : !!force;
        if (want) el._classNames.add(c); else el._classNames.delete(c);
        return want;
      },
      contains(c) { return el._classNames.has(c); },
      get length() { return el._classNames.size; }
    };
  }

  function el(tag) {
    const e = {
      tagName: String(tag || 'div').toUpperCase(),
      nodeType: 1, nodeName: String(tag || 'div').toUpperCase(),
      id: '', className: '', _classNames: new Set(),
      style: {}, dataset: {}, attrs: {}, children: [], parentNode: null,
      textContent: '', innerText: '', value: '', checked: false, disabled: false,
      title: '', src: '', href: '', alt: '', type: '',
      offsetWidth: 100, offsetHeight: 20, clientWidth: 1200, clientHeight: 600,
      scrollTop: 0, scrollHeight: 0, scrollWidth: 0,
      _listeners: {}, _html: '',
      get firstChild() { return this.children[0] || null; },
      get lastChild() { return this.children[this.children.length - 1] || null; },
      get childNodes() { return this.children; },
      get nextSibling() { const p = this.parentNode; if (!p) return null; const i = p.children.indexOf(this); return p.children[i + 1] || null; },
      appendChild(c) {
        if (!c) return c;
        if (c.parentNode) c.parentNode.removeChild(c);
        this.children.push(c); c.parentNode = this; return c;
      },
      // ↓↓↓ 这一条是之前所有假 DOM 里最致命的一处：必须真的移除
      removeChild(c) {
        const i = this.children.indexOf(c);
        if (i >= 0) { this.children.splice(i, 1); if (c) c.parentNode = null; }
        return c;
      },
      insertBefore(c, ref) {
        if (!c) return c;
        if (c.parentNode) c.parentNode.removeChild(c);
        const i = ref ? this.children.indexOf(ref) : -1;
        if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
        c.parentNode = this; return c;
      },
      replaceChild(n, o) { const i = this.children.indexOf(o); if (i >= 0) { this.children[i] = n; n.parentNode = this; o.parentNode = null; } return o; },
      remove() { if (this.parentNode) this.parentNode.removeChild(this); },
      contains(n) { if (n === this) return true; return !!walk(this, c => c === n); },
      closest(sel) { let n = this; while (n) { if (matchesSimple(n, sel)) return n; n = n.parentNode; } return null; },
      matches(sel) { return matchesSimple(this, sel); },
      querySelectorAll(sel) {
        const out = [];
        sel = String(sel || '');
        // 支持逗号分隔的简单选择器
        const parts = sel.split(',').map(s => s.trim()).filter(Boolean);
        walk(this, c => { if (parts.some(p => matchesSimple(c, p))) out.push(c); return false; });
        return out;
      },
      querySelector(sel) {
        const found = this.querySelectorAll(sel)[0];
        if (found) return found;
        // 找不到时给一个"占位元素"以免代码崩溃，但记进诊断，避免把"元素缺失"这种真问题掩盖掉
        diagnostics.unmatchedSelectors.push(String(sel));
        diagnostics.createdBySelector++;
        const ph = el('div'); ph._placeholderFor = String(sel); return ph;
      },
      getElementsByTagName(t) { return this.querySelectorAll(t); },
      getElementsByClassName(c) { return this.querySelectorAll('.' + c); },
      setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); if (k === 'class') { this.className = String(v); this._classNames = new Set(String(v).split(/\s+/).filter(Boolean)); } },
      getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      removeAttribute(k) { delete this.attrs[k]; },
      hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attrs, k); },
      addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
      removeEventListener(t, fn) { const a = this._listeners[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); },
      dispatchEvent(ev) {
        const type = ev && ev.type;
        ev = ev || {}; ev.target = ev.target || this; ev.currentTarget = this;
        if (this['on' + type]) { try { this['on' + type](ev); } catch (e) { throw e; } }
        (this._listeners[type] || []).slice().forEach(fn => fn(ev));
        if (this.parentNode && ev.bubbles !== false) this.parentNode.dispatchEvent(ev);
        return true;
      },
      click() { return this.dispatchEvent({ type: 'click', bubbles: true }); },
      focus() {}, blur() {}, scrollTo() {}, scrollIntoView() {},
      setPointerCapture() {}, releasePointerCapture() {},
      getBoundingClientRect() {
        return { top: 0, left: 0, right: this.clientWidth, bottom: this.clientHeight, width: this.clientWidth, height: this.clientHeight, x: 0, y: 0 };
      },
      animate() { return { finished: Promise.resolve(), cancel() {} }; },
      cloneNode() { return el(this.tagName); },
      getContext(kind) { return make2dContext(); }
    };
    e.classList = mkClassList(e);
    Object.defineProperty(e, 'className', {
      get() { return [...this._classNames].join(' '); },
      set(v) { this._classNames = new Set(String(v == null ? '' : v).split(/\s+/).filter(Boolean)); },
      configurable: true, enumerable: true
    });
    Object.defineProperty(e, 'innerHTML', {
      get() { return this._html; },
      set(v) { this._html = String(v == null ? '' : v); this.children.forEach(c => { c.parentNode = null; }); this.children = []; }  // 真实语义：清空子节点
    });
    return e;
  }

  /** canvas 2D 上下文：用 Proxy 自动兜住所有绘图方法，避免"少写一个方法就崩" */
  function make2dContext() {
    const store = { fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px sans-serif',
      textAlign: 'start', textBaseline: 'alphabetic', globalAlpha: 1, lineCap: 'butt', lineJoin: 'miter',
      shadowBlur: 0, shadowColor: '#000', lineDashOffset: 0, globalCompositeOperation: 'source-over' };
    const grad = () => ({ addColorStop() {} });
    const data = { data: new Uint8ClampedArray(4), width: 1, height: 1 };
    const special = {
      createLinearGradient: grad, createRadialGradient: grad, createConicGradient: grad,
      createPattern: () => ({}), measureText: t => ({ width: String(t || '').length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
      getImageData: () => data, createImageData: () => data, putImageData() {}, getLineDash: () => [],
      isPointInPath: () => false, isPointInStroke: () => false
    };
    return new Proxy(store, {
      get(t, k) {
        if (k in t) return t[k];
        if (k in special) return special[k];
        return function () {};       // 其余方法一律 no-op
      },
      set(t, k, v) { t[k] = v; return true; }
    });
  }

  const doc = el('document');
  doc.nodeType = 9;
  doc.createElement = (tag) => el(tag);
  doc.createElementNS = (ns, tag) => el(tag);
  doc.createTextNode = (t) => { const n = el('#text'); n.nodeType = 3; n.textContent = String(t); return n; };
  doc.createDocumentFragment = () => { const f = el('#fragment'); f.nodeType = 11; return f; };
  // 注册表同时支持 elements.get(id) 与 elements[id]：
  // 只用 Map 的话，`elements['choiceButtons']` 会静默返回 undefined，
  // 于是"自动应答点不到按钮"，测试会误判成"游戏不响应"。（我踩过一次，见 README）
  const register = (id, e) => { byId.set(id, e); byId[id] = e; return e; };
  doc.getElementById = (id) => { if (!byId.has(id)) register(id, el('div')).id = id; return byId.get(id); };
  doc.querySelector = (sel) => doc.querySelectorAll(sel)[0] || (() => { diagnostics.unmatchedSelectors.push(String(sel)); const p = el('div'); p._placeholderFor = String(sel); return p; })();
  doc.querySelectorAll = () => [];
  doc.getElementsByTagName = () => [];
  doc.getElementsByClassName = () => [];
  doc.addEventListener = (t, fn) => { (doc._listeners[t] = doc._listeners[t] || []).push(fn); };
  doc.removeEventListener = (t, fn) => { const a = doc._listeners[t] || []; const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); };
  doc.dispatchEvent = (ev) => { const type = ev && ev.type; (doc._listeners[type] || []).slice().forEach(fn => fn(ev || {})); return true; };
  doc.body = el('body'); doc.body.parentNode = doc;
  doc.head = el('head'); doc.head.parentNode = doc;
  doc.documentElement = el('html'); doc.documentElement.parentNode = doc;
  doc.readyState = 'complete';
  doc.cookie = '';
  return { document: doc, byId, diagnostics, el };
}
module.exports = { createEngineDom: createHarnessDom };
