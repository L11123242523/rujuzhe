/* =====================================================================
 * RujuzheRoom —— 入局者联机权威房间（Colyseus 0.18，阶段1最小闭环）
 * 职责：服务器是唯一裁决者。客户端只发“意图/动作”，服务器用权威 RNG 与
 *       纯引擎规则(js/engine_core.js，前后端同一份)计算结果并广播。
 * 阶段1闭环：建房/加入/双人就绪 -> 下发同一权威种子 -> 投骰动作 ->
 *           “结果出现但未适用”的连锁响应窗口（双方 pass 才锁定）-> 广播锁定结果。
 * 后续：把卡牌结算/移动/伤害逐步迁入本文件，客户端逐步改为只发 action。
 * ===================================================================== */
const { Room } = require('colyseus');
const { Schema, MapSchema, type } = require('@colyseus/schema');
const path = require('path');
const RJ = require(path.join(__dirname, '..', '..', 'js', 'engine_core.js'));

/* ------------------------------- 状态 Schema ------------------------------- */
class PlayerState extends Schema {
  constructor() {
    super();
    this.sessionId = ''; this.name = ''; this.ready = false; this.connected = true; this.lastRoll = 0;
  }
}
type('string')(PlayerState.prototype, 'sessionId');
type('string')(PlayerState.prototype, 'name');
type('boolean')(PlayerState.prototype, 'ready');
type('boolean')(PlayerState.prototype, 'connected');
type('number')(PlayerState.prototype, 'lastRoll');

class RujuzheState extends Schema {
  constructor() {
    super();
    this.phase = 'lobby'; this.seed = 0; this.turn = 0; this.currentPlayer = ''; this.host = '';
    this.lastRoll = 0; this.rollSides = 6; this.pendingStage = ''; this.passStreak = 0; this.chainSeq = 0;
    this.players = new MapSchema();
  }
}
type('string')(RujuzheState.prototype, 'phase');          // lobby | playing | ended
type('number')(RujuzheState.prototype, 'seed');           // 权威随机种子
type('number')(RujuzheState.prototype, 'turn');
type('string')(RujuzheState.prototype, 'currentPlayer');  // 当前行动方 sessionId
type('string')(RujuzheState.prototype, 'host');
type({ map: PlayerState })(RujuzheState.prototype, 'players');
type('number')(RujuzheState.prototype, 'lastRoll');
type('number')(RujuzheState.prototype, 'rollSides');
type('string')(RujuzheState.prototype, 'pendingStage');   // 开放窗口：'' | dice_result | move | damage | rand
type('number')(RujuzheState.prototype, 'passStreak');
type('number')(RujuzheState.prototype, 'chainSeq');

class RujuzheRoom extends Room {
  onCreate() {
    this.maxClients = 2;
    this.patchRate = 100; // 10fps，回合制足够且省流量
    this.setState(new RujuzheState());
    this.rng = RJ.createRNG();       // 权威随机源，开局 reseed(state.seed)
    this.awaiting = null;           // 当前窗口下一个应响应者 sessionId
    this._window = null;

    this.onMessage('ready', (client, msg) => {
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.name = (msg && msg.name) ? String(msg.name).slice(0, 16) : p.name;
      p.ready = true;
      this.broadcast('lobbyUpdate', this._lobbySnapshot());
      this._tryStart();
    });

    /* 请求一次权威投骰：仅当前行动方、游戏中、无未决窗口 */
    this.onMessage('requestRoll', (client, msg) => {
      if (this.state.phase !== 'playing' || this.state.pendingStage) return;
      if (client.sessionId !== this.state.currentPlayer) return;
      const sides = Math.min(20, Math.max(2, parseInt((msg && msg.sides) || 6, 10) || 6));
      const count = Math.min(3, Math.max(1, parseInt((msg && msg.count) || 1, 10) || 1));
      let raw = 0; for (let i = 0; i < count; i++) raw += this.rng.dice(sides); // 多枚骰点数相加
      this.state.rollSides = sides;
      this.state.lastRoll = raw;
      this._openWindow(RJ.WINDOWS.DICE, { raw: raw, sides: sides, count: count, max: sides * count, current: raw }, client.sessionId);
    });

    this.onMessage('passChain', (client) => {
      if (!this.state.pendingStage) return;
      if (this.awaiting && client.sessionId !== this.awaiting) return; // 尚未轮到你
      this.state.passStreak += 1;
      this._advanceResponse();
    });

    /* 连锁：修改骰子点数（遥控骰子/手套） */
    this.onMessage('chainSetDice', (client, msg) => {
      if (this.state.pendingStage !== RJ.WINDOWS.DICE) return;
      if (!RJ.chainableAt(this.state.pendingStage, 'dice_set')) return;
      if (this.awaiting && client.sessionId !== this.awaiting) return;
      const point = parseInt(msg && msg.point, 10);
      const hi = (this._window && this._window.max) || this.state.rollSides;
      if (!(point >= 1 && point <= hi)) return;
      this.state.chainSeq += 1;
      this.state.lastRoll = point;
      this._window.current = point;
      this.broadcast('chainEvent', { by: client.sessionId, kind: 'dice_set', point: point, seq: this.state.chainSeq });
      this._afterChain();
    });

    /* 连锁：改变方向（颠倒骰子） */
    this.onMessage('chainReverse', (client) => {
      if (this.state.pendingStage !== RJ.WINDOWS.DICE && this.state.pendingStage !== RJ.WINDOWS.MOVE) return;
      if (!RJ.chainableAt(this.state.pendingStage, 'reverse')) return;
      if (this.awaiting && client.sessionId !== this.awaiting) return;
      this.state.chainSeq += 1;
      this._window.reversed = !this._window.reversed;
      this.broadcast('chainEvent', { by: client.sessionId, kind: 'reverse', reversed: this._window.reversed, seq: this.state.chainSeq });
      this._afterChain();
    });
  }

  onJoin(client, options) {
    const p = new PlayerState();
    p.sessionId = client.sessionId;
    p.name = (options && options.name) ? String(options.name).slice(0, 16) : '玩家';
    this.state.players.set(client.sessionId, p);
    if (!this.state.host) this.state.host = client.sessionId;
    this.broadcast('lobbyUpdate', this._lobbySnapshot());
  }

  async onLeave(client, consented) {
    const p = this.state.players.get(client.sessionId);
    if (p) p.connected = false;
    try {
      if (consented) throw new Error('主动离开，不等待重连');
      await this.allowReconnection(client, 60); // 断线保留座位 60s
      const back = this.state.players.get(client.sessionId);
      if (back) back.connected = true;
      this.broadcast('lobbyUpdate', this._lobbySnapshot());
    } catch (e) {
      this.state.players.delete(client.sessionId);
      if (this.state.players.size === 0) return;
      this.state.phase = 'ended';
      this.broadcast('opponentLeft', {});
    }
  }

  /* ------------------------------- 流程控制 ------------------------------- */
  _lobbySnapshot() {
    const players = [];
    this.state.players.forEach((p, sid) => players.push({ sessionId: sid, name: p.name, ready: p.ready, connected: p.connected }));
    return { host: this.state.host, players: players };
  }

  _tryStart() {
    if (this.state.phase !== 'lobby' || this.state.players.size < this.maxClients) return;
    let allReady = true;
    this.state.players.forEach((p) => { if (!p.ready) allReady = false; });
    if (!allReady) return;
    const seed = ((Date.now() >>> 0) ^ ((Math.random() * 4294967296) >>> 0)) >>> 0;
    this.state.seed = seed;
    this.rng.reseed(seed);               // 权威 RNG 以本种子为准，动作序列可完整回放
    this.state.turn = 1;
    this.state.phase = 'playing';
    this.state.currentPlayer = this.state.host;
    this.broadcast('gameStart', { seed: seed, firstPlayer: this.state.host });
  }

  _other(sid) {
    let other = null;
    this.state.players.forEach((p, s) => { if (s !== sid) other = s; });
    return other;
  }

  // 打开“结果已出现、未锁定适用”的窗口；相对发起方，对方先响应
  _openWindow(stage, initial, initiatorSid) {
    this.state.pendingStage = stage;
    this.state.passStreak = 0;
    this.state.chainSeq = 0;
    this._window = Object.assign({ stage: stage, initiator: initiatorSid }, initial);
    const other = this._other(initiatorSid);
    this.awaiting = other; // 对方先
    this.broadcast('windowOpen', { stage: stage, initial: initial, firstResponder: other });
  }

  _afterChain() {
    this.state.passStreak = 0; // 有人插入连锁，重新从对方开始累计 pass
    this.awaiting = this._other(this._window.initiator);
    this.broadcast('awaitResponse', { awaiting: this.awaiting, passStreak: 0 });
  }

  _advanceResponse() {
    if (RJ.shouldResolve(this.state.passStreak)) { this._resolveWindow(); return; }
    // 两人房：窗口打开先问对方(streak0)；对方 pass 后 streak=1，轮到发起方
    this.awaiting = this._window.initiator;
    this.broadcast('awaitResponse', { awaiting: this.awaiting, passStreak: this.state.passStreak });
  }

  _resolveWindow() {
    const w = this._window || {};
    const locked = { stage: this.state.pendingStage, value: this.state.lastRoll, reversed: !!w.reversed };
    this.state.pendingStage = '';
    this.awaiting = null;
    this._window = null;
    this.broadcast('windowResolved', locked);
  }
}

module.exports = { RujuzheRoom, RujuzheState, PlayerState };
