/**
 * 入局者 v2 · 规则常量（唯一来源）
 * ---------------------------------------------------------------------------
 * 每一条都标出处：`规则书§x` = 《入局者规则书.txt》章节；`game.html:LNNNN` = 旧引擎里
 * **规则书没写但线上已在生效**的行为（必须保留，且必须记账）。
 * 引擎里**不许**再出现散落的字面数字 —— 一切走这里。
 */

export const RULES = Object.freeze({
  // ── 卡组与编组（规则书 §2） ────────────────────────────────────────────
  deck: {
    items: 8,              // §2.1 一套卡组 = 8 张道具卡
    carries: 4,            // §2.1 + 4 张角色携带卡
    permanentLimit: 2,     // §2.2 永续道具最多 2 张
    teamSize: 3,           // §2.1 编组 3 张角色（1 队长 + 2 队员）
    captainCount: 1,
    memberCount: 2,
    chaosAttrQuota: 2,     // §2.3 默认携带 2 张无序属性道具
    attrQuotaPerChar: 2,   // §2.3 每名非混沌角色可另带 2 张同属性道具
    initialHand: 4,        // §2.5 起手 4 张（先手不额外多抽）
    handLimit: 5,          // §2.5 手牌上限 5
    drawPerTurn: 1,        // §2.5 每回合准备阶段抽 1
  },

  // ── 资源（规则书 §5） ─────────────────────────────────────────────────
  sync: {
    multiplier: 2.5,       // §5.1 队伍同步值 = 3 名角色同步值之和 × 2.5
    rounding: 'ceil',      // §5.1 出现 0.5 一律向上进一
  },
  cost: {
    max: 12,               // §5.2 音韵值上限
    baseRegen: 5,          // §5.2 准备阶段基础自然回复
    drawByCost: 3,         // §5.3 支付 3 点音韵抽 1 张，每回合不限次数
  },
  gold: { startTilePass: 400, startTileLand: 800 }, // §附录B 起点：经过 +400/+1音韵，到达双倍
  shield: { mode: 'points' },                        // §5.7 点数制，优先抵伤
  fascination: { note: '入迷值；归零者获胜（破局者），增减以卡面为准' }, // §1 + §5.8

  // ── 控骰与暴击（规则书 §5.5/§5.6） ─────────────────────────────────────
  diceControl: { perPct: 20, maxNormalPct: 100, maxJudgePct: 20 },
  crit: { baseRate: 0, baseMultiplier: 1.5, judgeApplies: false },

  // ── 属性（规则书 §6 + 附录A） ─────────────────────────────────────────
  attributes: {
    list: ['热忱', '理智', '无序', '混沌'],
    counterOnHit: 1,       // §6.3 克制时该段 +1
    counterPerSegment: true, // §6.3/§8.4 多段每段分别 +1
  },
  movement: {
    cap: 20,               // §6.4 单次位移超过 20 格按 20 格计
    tiles: 42,             // 地图 42 格（规则书附录B + game.html:3880 MAP_TILES）
  },

  // ── 等级与激励（规则书 §9） ────────────────────────────────────────────
  level: {
    min: 1,
    max: 10,               // §9.1 最高 Lv10
    keyLevels: [1, 4, 7, 10],
    thresholds: [1, 2, 3, 4, 5, 7, 7, 7, 7], // §9.2 Lv1→2 需 1 … Lv5→6 需 5，Lv6 起每级 7；累计 43
    totalToMax: 43,
    syncHealPerLevel: 2,   // ⚠ game.html:13480 —— 规则书未写、线上已在生效：每次升级回复 2 点同步值（不超上限）
  },
  motivation: {
    capLower: 5,           // §9.3 Lv1–Lv5 上限 5
    capUpper: 7,           // §9.3 Lv6 起上限 7
    upperFromLevel: 6,
    overflowDiscarded: true,
  },
  guideCore: { levelsPerPoint: 1 }, // §7.2.5 1 点引导核心直接升 1 级并填满当前激励条

  // ── 献祭（规则书 §11） ────────────────────────────────────────────────
  sacrifice: { perTurn: 1, regain: 2, countsAsEffectGrave: false },

  // ── 公共卡（规则书 §7 + 附录C） ────────────────────────────────────────
  gift: {
    pool: ['200$', '500$', '1000$', 'Noise(>10)', 'Noise(≤10)', '和声'],
    pityEvery: 6,          // §7.1.3 每 6 次必出 1 张「和声」
    coin: { '200$': 200, '500$': 500, '1000$': 1000 },
  },
  music: { order: ['序幕', '渐起', '回响', '高涨', '尾声', '谢幕'] }, // §7.2.2 固定顺序
  omikuji: {             // §7.4 + 附录C：12 张签堆
    stackSize: 12,
    composition: { 大吉: 1, 大凶: 1, 吉: 1, 凶: 1, 小吉: 4, 中吉: 3, 绪吉: 1 },
    shrineCost: 2000,
  },
  eventDeck: {                            // §7.3
    kinds: ['交互冲动', '即兴演出', '命运之回声', '圆桌会议', '大风', '独奏', '王车易位', '赌徒游戏', '躁动之心', '闲庭信步'],
    cardTileDraws: 1,
    readingRoomDraws: 2,
  },

  // ── 地图格（规则书 附录B） ─────────────────────────────────────────────
  // interactive=true 表示"到达后可选择不执行"
  tiles: {
    start: { label: '起点', interactive: false, passGold: 400, passCost: 1, landGold: 800, landCost: 2 },
    gift: { label: '馈赠格', interactive: false, giftDraws: 1 },
    item: { label: '易物', interactive: true, cost: 0, paidCost: 500, note: '送 1 张卡入墓后抽 1；或付 500 金币抽 1' },
    again: { label: 'Again', interactive: false, note: '投掷阶段以 1/3/5 点到达时可再投一次' },
    bus: { label: '公交站', interactive: true, cost: 200 },
    subway: { label: '地铁', interactive: true, cost: 200 },
    card: { label: '卡牌格', interactive: false, eventDraws: 1 },
    story: { label: 'Story（乐谱格）', interactive: false, musicDraws: 1 },
    power: { label: '配电室', interactive: true, note: '可关闭 1 格（不能关四角），每名玩家只能关 1 个；也可开启 1 个' },
    inspire: { label: '灵感', interactive: false, gainCost: 3, gainMotivation: 1 },
    read: { label: '阅览室', interactive: false, eventDraws: 2 },
    shrine: { label: '神社', interactive: true, cost: 2000, omikujiDraws: 1 },
    game: { label: 'GAME', interactive: true, cost: 500, note: '投硬币猜正反，猜中抽 2 张' },
    airport: { label: '机场', interactive: true, cost: 500, note: '下个主要阶段开始时可前进到任意 1 格' },
  },
});

/** 等级 → 升到下一级所需激励点数（规则书 §9.2） */
export function levelUpCost(level) {
  const t = RULES.level.thresholds;
  if (!Number.isInteger(level) || level < RULES.level.min) return null;
  if (level >= RULES.level.max) return null; // 已满级
  return t[level - 1];
}

/** 激励条上限（规则书 §9.3） */
export function motivationCap(level) {
  return level >= RULES.motivation.upperFromLevel ? RULES.motivation.capUpper : RULES.motivation.capLower;
}
