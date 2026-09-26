/**
 * 入局者 v2 · 界面（P6）
 * ---------------------------------------------------------------------------
 * 这一层**只做两件事**：把状态画出来、把人的输入交回引擎。
 * 它不实现任何规则 —— 规则全在 `packages/engine`，AI 在 `packages/ai`。
 *
 * 驱动方式用的是引擎的"可恢复窗口"：
 *   · 任何动作后调用 `runWindow(state)`（**不给答案源**）
 *   · 引擎需要人答时会返回 `{done:false, pending}`，界面把 pending 画成按钮
 *   · 人点完 → `answerDecision()` → 再 `runWindow()`，直到空闲
 * 这样"界面"与"测试/AI"用的是同一套引擎接口，不存在第二套驱动（旧引擎的病根之一就是有两套）。
 */

import { createState, validateState, busyReason, othersOf } from './packages/engine/state.js';
import { createRNG } from './packages/engine/rng.js';
import { startTurn, advancePhase, endTurn } from './packages/engine/flow.js';
import { playCard } from './packages/engine/play.js';
import { runWindow } from './packages/engine/window.js';
import { answerDecision } from './packages/engine/decision.js';
import { legality } from './packages/engine/offer.js';
import { setupPublicDecks } from './packages/engine/rules/tiles.js';
import { applyStartOfGame } from './packages/engine/abilities.js';
import { LAYOUT } from './packages/engine/rules/map.js';
import { RULES } from './packages/engine/rules/constants.js';
import { createAI } from './packages/ai/index.js';
import { createGame } from './packages/ai/game.js';
import { createBoard } from './battle/board3d.js';

const $ = (id) => document.getElementById(id);
let G = null;                 // { state, api, ais, ai }
let CARDS = [];               // 内容（由 build 阶段生成 app/cards.json）
let ART = new Map();          // 卡 id → 图片文件名（由 tools/build-assets.mjs 生成）
let MAP3D = null;             // 3D 棋盘数据（assets/map3d.json）
let BOARD = null;             // 3D 棋盘实例（创建失败则回退 2D 文字环）

/* ── 载入内容与卡图 ───────────────────────────────────────────────────── */
async function loadCards() {
  const res = await fetch('./cards.json');
  if (!res.ok) throw new Error('读不到 cards.json（请先跑 node v2/tools/build-app.mjs）');
  const data = await res.json();
  const cards = data.cards.map((c) => ({ ...c.fields, id: c.id, category: c.category, ops: c.ops }));
  try {
    const artRes = await fetch('./assets/index.json');
    if (artRes.ok) {
      const idx = await artRes.json();
      // 卡图索引的 key 是「分类/id」：不同分类会撞 id，只按 id 查会张冠李戴
      ART = new Map((idx.items || []).map((it) => [it.key || (it.category + '/' + it.id), it.file]));
    }
  } catch (e) { /* 没图也能玩 */ }
  try {
    const m = await fetch('./assets/map3d.json');
    if (m.ok) MAP3D = await m.json();
  } catch (e) { /* 没有 3D 数据就退回文字棋盘 */ }
  return cards;
}
const artUrl = (card) => (card && ART.has(card.category + '/' + card.id) ? './assets/cards/' + ART.get(card.category + '/' + card.id) : null);

/* ── 事件 → 人话（界面的日志 = 引擎内部日志 + 动作返回的事件）────────────── */
function describeEvent(e) {
  if (!e || !e.type) return '';
  const who = (id) => (id === 'p1' ? '你' : id === 'p2' ? 'AI' : id);
  const card = e.card ? (e.card.name || '') : '';
  switch (e.type) {
    case 'phase': return `【阶段】→ ${e.label || e.to}`;
    case 'turnStart': return `【回合】第 ${e.turn} 回合（第 ${e.round} 轮），轮到 ${who(e.seat)}`;
    case 'draw': return `【抽卡】${who(e.seat)} 抽到「${card}」`;
    case 'drawFailed': return `【抽卡】${who(e.seat)} 无牌可抽（${e.reason || ''}）`;
    case 'gainCost': return `【音韵】${who(e.seat)} +${e.amount}`;
    case 'healSync': return `【同步】${who(e.seat)} 回复 ${e.amount}`;
    case 'lossSync': return `【同步】${who(e.seat)} 失去 ${e.amount}`;
    case 'damage': return `【伤害】${who(e.target)} 受到 ${e.dealt ?? e.amount} 点${e.judge ? '（判定）' : ''}`;
    case 'damageOutOfRange': return `【伤害】不适用：${e.note || ''}`;
    case 'move': return `【移动】${who(e.seat)} ${e.from} → ${e.to}${e.tile ? '（' + e.tile.name + '）' : ''}`;
    case 'startTileReward': return `【起点】${who(e.seat)} 经过/到达起点：金币 +${e.gold} 音韵 +${e.cost}`;
    case 'gainGold': return `【金币】${who(e.seat)} +${e.amount}`;
    case 'levelUp': return `【升级】${who(e.seat)} 升到 Lv${e.level}`;
    case 'gainMotivation': return `【激励】${who(e.seat)} +${e.amount}`;
    case 'sacrificeNow': return `【献祭】${who(e.seat)} 献祭 ${(e.cards || []).map((c) => c.name).join('、')}`;
    case 'sacrificeRefused': return `【献祭】${who(e.seat)} 本回合次数已用完（${e.used}/${e.limit}）`;
    case 'gift': return `【馈赠】${who(e.seat)} 抽到「${card}」`;
    case 'musicCard': return `【乐谱】${who(e.seat)} 抽到「${card}」`;
    case 'eventCard': return `【事件卡】${who(e.seat)} 抽到「${card}」`;
    case 'tile': return `【格子】${who(e.seat)} 落在「${e.label}」`;
    case 'tilePending': return `【格子】${e.tile}：${e.note || '待实现'}`;
    case 'publicCard': return `【公共卡】结算「${card}」`;
    case 'search': return `【检索】${who(e.seat)} 取到 ${(e.cards || []).map((c) => c.name).join('、')}`;
    case 'toGrave': return `【去向】「${card}」进墓地`;
    case 'toPermanent': return `【去向】「${card}」留在效果处理区`;
    case 'cardConsumed': return `【去向】「${card}」销毁（不进墓）`;
    case 'toDeckBottom': return `【去向】「${card}」放回牌组最下方`;
    case 'useCard': return `【出牌】${who(e.seat)} 使用「${card}」（支付 ${e.paid} 音韵）`;
    case 'defeated': return `【结束】${who(e.seat)} 同步值归零`;
    case 'damagePrevented': return `【抵消】${who(e.target)} 抵消了 ${e.amount} 点伤害`;
    case 'gospelOffered': return `【福音雅颂】${e.taken ? '发动' : '不发动'}`;
    case 'mechanics': return '';
    default: return '';
  }
}
function note(state, evs) {
  for (const e of evs || []) {
    const text = describeEvent(e);
    if (text) state.log.push({ type: e.type, text });
  }
}

/* ── 渲染 ─────────────────────────────────────────────────────────────── */
function renderRing() {
  const { state } = G;
  // 有 3D 棋盘就画 3D；没有（无 WebGL / 缺数据）才回退到文字环 —— 不允许因为 3D 挂了就玩不了
  if (BOARD && BOARD.ok) {
    BOARD.setState(state);
    if (!BOARD.__told) {
      BOARD.__told = true;
      state.log.push({ type: 'uiInfo', text: '3D 棋盘已就绪：拖动可旋转、滚轮缩放、点格子看信息' });
    }
    return;
  }
  const ring = $('ring');
  ring.innerHTML = '';
  LAYOUT.forEach((tile, i) => {
    const d = document.createElement('div');
    d.className = 'tile type-' + tile.type;
    d.title = `#${i} ${tile.name}（${tile.type}）`;
    d.innerHTML = `<span class="idx">${i}</span><span class="nm">${tile.name}</span>`;
    for (const id of state.seatIds) {
      if (state.seats[id].position === i) {
        const p = document.createElement('span');
        p.className = 'token ' + id;
        p.textContent = id === 'p1' ? '你' : 'AI';
        d.appendChild(p);
      }
    }
    ring.appendChild(d);
  });
}

function seatCard(id, label) {
  const s = G.state.seats[id];
  const isTurn = G.state.currentPlayer === id;
  const cap = s.captain ? CARDS.find((c) => c.category === 'characters' && c.name === s.captain.name) : null;
  const capArt = artUrl(cap);
  return `<div class="seat ${id} ${isTurn ? 'active' : ''}">
    <div class="seat-head">${label}${isTurn ? ' · 回合中' : ''}</div>
    ${capArt ? `<img class="portrait" src="${capArt}" alt="${cap ? cap.name : ''}" />` : ''}
    <div class="stat"><b>同步</b> ${s.sync} / ${s.maxSync}</div>
    <div class="stat"><b>音韵</b> ${s.cost} / ${s.maxCost}</div>
    <div class="stat"><b>金币</b> ${s.gold}</div>
    <div class="stat"><b>等级</b> Lv${s.level} · 激励 ${s.motivation}</div>
    <div class="stat"><b>位置</b> #${s.position} · 护盾 ${s.shield} · 防御 ${s.defense}</div>
    <div class="stat"><b>区域</b> 手 ${s.hand.length} / 墓 ${s.grave.length} / 永续 ${s.permanent.length} / 移出 ${s.removed.length}</div>
    ${s.captain ? `<div class="stat"><b>队长</b> ${s.captain.name}${(s.teamNames || []).length ? ' + ' + s.teamNames.join('、') : ''}</div>` : ''}
    <div class="stat"><b>属性</b> ${s.teamAttribute || '—'}</div>
  </div>`;
}

function renderSeats() {
  $('seats').innerHTML = seatCard('p1', '你（p1）') + seatCard('p2', 'AI（p2）');
}

function renderHand() {
  const { state } = G;
  const me = state.seats.p1;
  const mine = state.currentPlayer === 'p1';
  $('hand-hint').textContent = mine ? '' : '（不是你的回合，可先看看）';
  const box = $('hand');
  box.innerHTML = '';
  me.hand.forEach((card, i) => {
    const el = document.createElement('button');
    el.className = 'card';
    const v = legality(state, 'p1', card, { target: othersOf(state, 'p1')[0] });
    el.classList.toggle('disabled', !mine || !v.ok);
    el.title = v.ok ? '点击出牌' : (v.reason || '现在不能出');
    const art = artUrl(card);
    el.innerHTML = `${art ? `<img class="thumb" src="${art}" alt="" />` : '<span class="thumb ph"></span>'}
      <span class="cn">${card.name}</span>
      <span class="cc">费 ${card.cost ?? '—'}${card.attribute ? ' · ' + card.attribute : ''}</span>
      <span class="ce">${String(card.effect || '').slice(0, 70)}</span>`;
    el.onclick = () => onPlayCard(i);
    box.appendChild(el);
  });
  if (!me.hand.length) box.innerHTML = '<div class="panel">（手牌为空）</div>';
}

function renderLog() {
  const el = $('log');
  el.innerHTML = G.state.log.slice(-60).map((e) => `<div class="line t-${e.type}">${e.text || e.type}</div>`).join('');
  el.scrollTop = el.scrollHeight;
}

function renderHeader() {
  const { state } = G;
  $('phase-label').textContent = '阶段：' + state.phase;
  $('turn-label').textContent = `第 ${state.turn} 回合 · 第 ${state.round} 轮 · 当前 ${state.currentPlayer}`;
}

function renderAll() {
  renderHeader(); renderRing(); renderSeats(); renderHand(); renderLog();
}

/* ── 决策 UI（引擎挂起时把人点的那一下交回去）────────────────────────── */
function showDecision(pending, done) {
  const box = $('decision');
  box.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'd-title';
  title.textContent = (pending.reason || pending.title || '需要你决定') + `（${pending.kind}）`;
  box.appendChild(title);

  const finish = (value) => { box.innerHTML = '<div class="panel">（已提交）</div>'; done(value); };
  const opts = pending.options || pending.labels || [];
  if (pending.kind === 'chain') {
    const cands = pending.candidates || [];
    cands.forEach((c) => {
      const b = document.createElement('button');
      b.textContent = '连锁：' + (c.label || c.card?.name || c.id);
      b.onclick = () => finish(c.id);
      box.appendChild(b);
    });
    const p = document.createElement('button');
    p.className = 'ghost'; p.textContent = '放弃（PASS）';
    p.onclick = () => finish('pass');
    box.appendChild(p);
    return;
  }
  if (opts.length) {
    opts.forEach((label, i) => {
      const b = document.createElement('button');
      b.textContent = typeof label === 'string' ? label : JSON.stringify(label);
      b.onclick = () => finish(pending.kind === 'choice' ? i : (pending.kind === 'pickList' || pending.kind === 'pickCards' ? [i] : i));
      box.appendChild(b);
    });
    return;
  }
  const pool = pending.candidates || pending.cards || [];
  if (pool.length) {
    pool.forEach((c, i) => {
      const b = document.createElement('button');
      const card = c.card || c;
      b.textContent = (card.name || '卡') + (card.cost != null ? `（费 ${card.cost}）` : '');
      b.onclick = () => finish(pending.need > 1 ? [i] : (pending.kind === 'choice' ? i : [i]));
      box.appendChild(b);
    });
    return;
  }
  const b = document.createElement('button');
  b.textContent = '确定';
  b.onclick = () => finish(pending.kind === 'choice' ? 0 : [0]);
  box.appendChild(b);
}

/**
 * 驱动到空闲：反复 `runWindow`，需要人答就画出来等点击。
 * 这就是"可恢复窗口"的用处 —— 界面不需要知道任何规则。
 */
function step() {
  if (!G) return renderAll();
  for (let guard = 0; guard < 200; guard++) {
    const r = runWindow(G.state);
    note(G.state, r.events);
    if (r.done) return renderAll();
    if (r.pending) { renderAll(); return showDecision(r.pending, (value) => { answerDecision(G.state, r.pending.id, value); step(); }); }
  }
  G.state.log.push({ type: 'uiWarn', text: '⚠ 驱动步数超限（可能是自触发死循环）' });
  return renderAll();
}

/* ── 动作 ─────────────────────────────────────────────────────────────── */
function onPlayCard(index) {
  const { state } = G;
  if (state.currentPlayer !== 'p1') return;
  const card = state.seats.p1.hand[index];
  if (!card) return;
  const r = playCard(state, 'p1', card, { rng: G.rng, target: othersOf(state, 'p1')[0] });
  if (!r.ok) { state.log.push({ type: 'uiWarn', text: `⚠ 出牌被拒：${card.name} —— ${r.reason}` }); }
  else note(state, r.events);
  step();
}

function onAdvancePhase() {
  const { state } = G;
  if (state.currentPlayer !== 'p1') return;
  const r = advancePhase(state, { rng: G.rng });
  note(state, r.events);
  step();
}

function onEndTurn() {
  const { state } = G;
  if (state.currentPlayer !== 'p1') return;
  note(state, endTurn(state));
  step();
  aiTurnIfNeeded();
}

/** AI 回合：交给 AI 走完，界面只负责在它之后把窗口驱动干净 */
function aiTurnIfNeeded() {
  if (!G || G.state.currentPlayer !== 'p2') return;
  setTimeout(() => {
    try {
      G.ai.takeTurn(G.api);
    } catch (e) {
      G.state.log.push({ type: 'uiWarn', text: '⚠ AI 抛错：' + e.message });
    }
    step();
  }, 120);
}

/* ── 新开一局 ─────────────────────────────────────────────────────────── */
async function newGame() {
  if (!CARDS.length) CARDS = await loadCards();
  const { state, api, ais, rng } = createGame({
    cards: CARDS,
    seed: 20260926,
    teams: [['现实间冬马', '入间予', '小野葵'], ['入间予', '枫(水着)', '小野伊织']],
  });
  G = { state, api, rng, ais, ai: ais[1] };
  // 3D 棋盘（照老站做法）：建不起来就回退文字环，**不许因此玩不了**
  const host = $('board3d');
  if (host && MAP3D) {
    try {
      if (BOARD && BOARD.dispose) BOARD.dispose();
      const b = createBoard(host, MAP3D, {
        onTileClick: (id) => {
          const t = LAYOUT[id];
          if (t) state.log.push({ type: 'uiInfo', text: `【格子 #${id}】${t.name}（${t.type}）` });
          renderLog();
        },
      });
      BOARD = b.ok ? b : null;
      if (!b.ok) state.log.push({ type: 'uiWarn', text: `3D 棋盘不可用（${b.reason}）—— 已回退文字棋盘` });
    } catch (e) {
      BOARD = null;
      state.log.push({ type: 'uiWarn', text: '3D 棋盘初始化失败：' + e.message });
    }
    const ring = $('ring');
    if (ring && ring.style) ring.style.display = BOARD ? 'none' : '';
    if (!BOARD) renderRing();
  }
  state.log.push({ type: 'uiInfo', text: `新开一局：你 vs AI（种子 20260926，引擎 ${(await import('./packages/engine/index.js')).ENGINE_VERSION}）` });
  note(state, startTurn(state));   // 第一回合的准备阶段（抽 1 张、自然回复）也要进日志
  step();
}

$('btn-new').onclick = () => newGame().catch((e) => { $('log').innerHTML = '<div class="line t-uiWarn">启动失败：' + e.message + '</div>'; });
$('btn-phase').onclick = onAdvancePhase;
$('btn-end').onclick = onEndTurn;

// 暴露给控制台，便于手工排查
window.__RUJUZHE__ = { get game() { return G; }, newGame, step };
if (typeof window.addEventListener === 'function') {
  window.addEventListener('resize', () => { if (BOARD && BOARD.ok) BOARD.resize(); });
}
