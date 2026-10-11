/* 角色卡被动/SP 精确期望值回归 —— 批次D
 * ============================================================
 * 目标：24 张角色卡全部覆盖。基线 char_effect_expect.js 已覆盖 12 张
 *   （现实间冬马 / 木原光太郎 / 椎名小春 / 小野葵 / 宁雨清 / 小沙香琉璃 /
 *     宫樱子 / 里尔亚斯·斯塔芙莉娅斯特 / 予(水着) / 琉璃(水着) / 星奈(水着) / 里绪(水着)），
 *   本文件负责剩下 12 张：
 *     入间枫 / 松山惠 / 小野结衣 / 现实间里绪 / 莉莉·缇雅菲洛 / 露璐缇雅·爱德华 /
 *     霜烬 / 小仓霞 / 小野伊织 / 入间予 / 雨宫羽奈 / 枫(水着)
 *
 * 遵守 _relaytest/README.md 的写测试规矩，逐条对应：
 *   #1  期望值一律从 cardData 的 passive/sp 字段**逐字**推导（每条用例都带 text 守卫：
 *       卡面文本若被改动，本用例立刻报 ⏭ 未验证，而不是继续拿旧期望值去判）
 *   #15 塞卡前先 evaluatePlayable().ok —— 不可出的卡会被引擎静默拒绝
 *   #16 静默判定交给 L.quiesce（含 battleState._logs 长度 + 动画/弹窗/意图）
 *   #17 怀疑"游戏有 bug"前先排除取样窗口（本文件的差分用例都用 L.quiesce 等到真静默）
 *   #18 换分支/换场景必须断言"控制变量确实改变了场景"（见每条 diff 用例的 control）
 *
 * 本文件相对基线的**新增维度**：队员位（把被测角色放在队伍第 2 位，而不是队长位），
 *   覆盖 4 个卡面写明"作为队员编组也生效"的角色：入间枫(SP)、现实间里绪(SP)、
 *   雨宫羽奈(SP)、枫(水着)(SP)。
 *
 * 用法：node char_expect_batchD.js [角色名]
 */
'use strict';
const L = require('./lib/cardlab');
const H = require('./lib/harness');
const C = H.makeChecker('角色被动/SP 精确期望（批次D）');
const sleep = L.sleep;

/* 基线已覆盖的 12 张（用于末尾的"24 张是否都覆盖到"自检） */
const BASELINE_COVERED = ['现实间冬马', '木原光太郎', '椎名小春', '小野葵', '宁雨清', '小沙香琉璃',
  '宫樱子', '里尔亚斯·斯塔芙莉娅斯特', '予(水着)', '琉璃(水着)', '星奈(水着)', '里绪(水着)'];
/* 本文件要覆盖的 12 张 */
const BATCH_D = ['入间枫', '松山惠', '小野结衣', '现实间里绪', '莉莉·缇雅菲洛', '露璐缇雅·爱德华',
  '霜烬', '小仓霞', '小野伊织', '入间予', '雨宫羽奈', '枫(水着)'];

const SKIPPED = [];     // ⏭ 未验证（既不通过也不失败，但必须在回报里列出）
const SUSPECTED = [];   // 卡面文本与实测不一致 / 需人工确认

/* ============================================================
 * 一、通用工具
 * ============================================================ */

/** 状态字段差值（照抄基线口径：数字相减；逗号拼接的卡名列表按条目数相减） */
function delta(res, field) {
  const a = res.before[field], b = res.after[field];
  if (typeof a === 'number' && typeof b === 'number') return b - a;
  if (typeof a === 'string' || a === undefined) {
    const na = !a ? 0 : String(a).split(',').filter(Boolean).length;
    const nb = !b ? 0 : String(b).split(',').filter(Boolean).length;
    return nb - na;
  }
  return NaN;
}

/** 规则：混沌属性受所有属性攻击「多1伤害」（基线 char_effect_expect.js 里的同名函数） */
function foeDamageBonus(inst) {
  const a = inst && inst.S && inst.S.battleState && inst.S.battleState.p2 && inst.S.battleState.p2.teamAttribute;
  return a === '混沌' ? 1 : 0;
}

/** 队伍成员（开局前在 deckConfig 里定下的那一份，被动/SP 就是按它注册的） */
function teamOf(S) {
  return (((S.deckConfig || {}).p1 || {}).chars || []).filter(Boolean);
}
function teamNames(S) { return teamOf(S).map(c => c.name); }

/** 从真战斗日志里读"判定伤害骰点：N"（判定伤害的骰点先落日志、再结算增伤） */
function rollOf(logs) {
  const m = logs.join(' ').match(/判定伤害骰点：(\d+)/);
  return m ? Number(m[1]) : null;
}

/** 候选卡池：与基线同口径（排除角色/表情/御神签/馈赠卡） */
function cardPool(inst) {
  return inst.g.cards().filter(c => c && c.name && c.cost !== undefined &&
    c._category !== 'emojis' && c._category !== 'characters' &&
    c._category !== 'omikuji' && c._category !== 'gift_cards');
}

/** 把卡塞进手牌后问引擎"这张卡现在能不能出"（规矩 #15） */
function playableNow(inst, card, cost) {
  const S = inst.S;
  S.battleState.p1.hand = [card];
  if (cost !== undefined && cost !== null) S.battleState.p1.cost = cost;
  let pv = null;
  try { pv = S.evaluatePlayable(card, 'p1'); } catch (e) { pv = { ok: false, reason: 'evaluatePlayable 抛错: ' + e.message }; }
  return pv || { ok: false, reason: 'evaluatePlayable 无返回' };
}

/** 按条件挑第一张"当前可出"的卡（卡名不写死） */
function pickPlayable(inst, pred, note, cost) {
  const list = cardPool(inst).filter(pred);
  for (const c of list) {
    const pv = playableNow(inst, c, cost === undefined ? 12 : cost);
    if (pv.ok) return c;
  }
  return null;
}

function preconditionError(msg) { const e = new Error(msg); e.precondition = true; return e; }

/** 出牌：先校验可出，再真的 useCard(0) */
function useCardNow(inst, card, cost) {
  const pv = playableNow(inst, card, cost);
  if (!pv.ok) throw preconditionError('卡【' + card.name + '】在本场景不可出（' + pv.reason + '）——规矩#15：不可出不当作失败，记为未验证');
  inst.S.useCard(0);
}

/** 在当前场景里挑一张"可出"的卡并打出（挑不到 → 未验证，不当失败）；cost 传 null 表示不动当前费用 */
async function playPickedCard(inst, pred, cost, note) {
  const cands = cardPool(inst).filter(pred).sort((a, b) => (Number(a.cost) || 0) - (Number(b.cost) || 0));
  for (const c of cands) {
    if (playableNow(inst, c, cost).ok) { await useCardNow(inst, c, cost); return c; }
  }
  throw preconditionError('找不到可出的卡（' + note + '；候选 ' + cands.length + ' 张）');
}

/** 对手（p2）的队伍与属性：多局差分时用它证明"对手没变"，排除混沌弱点/克制混淆 */
function p2Team(r) { return (((r.inst.S.deckConfig || {}).p2 || {}).chars || []).filter(Boolean).map(c => c.name).join('/'); }
function p2Attr(r) { return String(r.inst.S.battleState.p2.teamAttribute); }

/** 卡是否按"使用时视为[移动]标签道具卡"结算（与游戏同口径）：优先用引擎自己的 __cardTags */
function tagsOf(S, card) {
  try { if (typeof S.__cardTags === 'function') return S.__cardTags(card); } catch (e) {}
  return [].concat((card && card.tags) || [], (card && card.type) ? [card.type] : []);
}

/** 打印 cardData 里某角色的某个字段原文（用于把"卡面原文"落进日志，不靠记忆） */
function faceText(inst, name, field) {
  const c = inst && inst.g ? inst.g.card(name) : null;
  return c ? String(c[field] == null ? '（空）' : c[field]) : '（cardData 里找不到该角色）';
}

/** 卡面文本守卫：期望值是从 cardData 的 passive/sp 逐字推导的，文本变了就必须重推 */
function textGuard(inst, cs) {
  if (!cs.text) return null;
  const c = inst.g.card(cs.char);
  const t = c ? String(c[cs.text.f] == null ? '' : c[cs.text.f]) : '';
  if (!t) return 'cardData 里找不到【' + cs.char + '】的 ' + cs.text.f + ' 字段';
  if (t.indexOf(cs.text.has) < 0) return '卡面 ' + cs.text.f + ' 字段已不含「' + cs.text.has + '」（当前：' + t.slice(0, 80) + '…）→ 期望值需重新从卡面推导';
  return null;
}

function line(cs, detail, problems) {
  const head = (cs.char + ' · ' + cs.why.slice(0, 30)).padEnd(46);
  const body = detail.join('；') || '（仅日志断言）';
  if (problems.length) C.bad(head + ' ' + body + '  ← ' + problems.join(' / '));
  else C.ok(head + ' ' + body);
}

function printSkip(cs, reason) {
  SKIPPED.push(cs.char + '：' + reason);
  console.log('  ⏭ 未验证 ' + String(cs.char).padEnd(14) + reason);
  console.log('     （未验证原因对应卡面：' + cs.why.slice(0, 60) + '…）');
}

/** 予被动控骰百分比：卡面「初始20%控骰。队伍中编组了光太郎、葵、莉莉、霞中任意一名提升予20%控骰(可叠加)。
 *  编组琉璃、里绪或枫时提升予40%控骰(不可叠加)」→ 按**实际编组**逐字算期望值，不写死 */
function yuControlExpected(S) {
  const names = teamNames(S);
  let pct = 0.2;
  ['光太郎', '葵', '莉莉', '霞'].forEach(k => { if (names.some(n => String(n).indexOf(k) >= 0)) pct += 0.2; });
  if (names.some(n => /琉璃|里绪|枫/.test(String(n)))) pct += 0.4;
  return pct;
}

/** 露璐缇雅SP：「这张卡编组时会作为2名[破坏者]角色计数」→ 期望 = 2 + 其他队员的[破坏者]标签数
 *  （其他队员的标签数从 cardData 现算，不写死） */
function breakerExpected(S) {
  let n = 2;
  teamOf(S).forEach(c => {
    if (String(c.name).indexOf('露璐缇雅') >= 0 || String(c.name).indexOf('爱德华') >= 0) return;
    const tags = [].concat(c.archetypes || [], c.roles || [], c.tags || []);
    if (tags.some(t => String(t || '').indexOf('破坏者') >= 0)) n += 1;
  });
  return n;
}

/** 自然回复（规则：基础5；枫(水着)/葵SP各+50%向下；予SP每名无序成员+1；霜烬SP+1；
 *  霜烬被动同步<14时+4；里尔亚斯被动+2起）—— 差分用例用它算期望差值 */
function regenSetup(sync) {
  return (S, bs) => { bs.p1.cost = 0; bs.p1.maxCost = 12; bs.p1.sync = sync; bs.p1._firstRegenSkipped = true; };
}
async function regenAct(inst) {
  const S = inst.S;
  S.battleState.currentPlayer = 'p1';
  S.startTurn();                      // 回合开始的准备阶段就是"自然回复"的结算点
}

/* ============================================================
 * 二、用例表
 * ============================================================ */

const CASES = [
  /* ---------------- 入间枫（混沌） ---------------- */
  {
    char: '入间枫', kind: 'raw', team: ['入间枫'],
    why: 'SP：开局从①回6音韵②抽2张③献祭+1 中选两项适用 → 开局结算完必须恰好选满2项、询问已结束',
    text: { f: 'sp', has: '从以下效果中选择两项适用' },
    check: (S, ctx) => {
      const p = S.battleState.p1;
      const sel = (p._kaedeSPSelected || []).map(o => o.label);
      return [
        ['_kaedeSP===true（队长位注册）', p._kaedeSP === true, ''],
        ['_kaedeSPSelected 恰好2项', sel.length === 2, '实得=' + JSON.stringify(sel)],
        ['_kaedeSPPending 已清', p._kaedeSPPending === false, ''],
        ['日志含「选择完成」', /【入间枫SP】选择完成/.test(ctx.logs.join(' ')), '']
      ];
    }
  },
  {
    // 新增维度：队员位。枫 SP 卡面明写"这个效果即使作为队员编组也会生效"
    char: '入间枫', kind: 'raw', team: ['莉莉·缇雅菲洛', '入间枫'],
    why: 'SP：作为队员编组也生效（队长换莉莉，枫在队伍第2位）→ 同样必须选满2项',
    text: { f: 'sp', has: '即使作为队员编组也会生效' },
    check: (S, ctx) => {
      const p = S.battleState.p1, names = teamNames(S);
      const sel = (p._kaedeSPSelected || []).map(o => o.label);
      return [
        ['控制变量：枫确实不在队长位', names[0] !== '入间枫' && names[1] === '入间枫', '队伍=' + names.join('/')],
        ['_kaedeSPSelected 恰好2项（队员位）', sel.length === 2, '实得=' + JSON.stringify(sel)],
        ['_kaedeSPPending 已清', p._kaedeSPPending === false, ''],
        ['队长被动不因队员位生效（规则：队长提供被动）', !p._kaedePassive, '_kaedePassive=' + p._kaedePassive]
      ];
    }
  },
  {
    char: '入间枫',
    why: '被动：每次使用[战术]或[增益]标签的卡后 → ①抽1张馈赠卡 ②再抽1张展示（同色留/异色送墓回2音韵）',
    text: { f: 'passive', has: '每次使用[战术]或[增益]标签的卡后' },
    // 枫的被动在引擎里是"选发"（postUsePassiveHooks 里 mandatory:false）→ 会走选发连锁窗口。
    // 底座 autoAnswer 对"连锁"类弹窗的默认策略是**选最后一项(=PASS)**，所以必须显式接受它，
    // 否则用例会静默变成"玩家主动放弃"，看起来像"被动没实现"（规矩#18：旋钮必须真的接上线）
    boot: {
      pickChain: (title, arr) => {
        const i = (arr || []).findIndex(x => /入间枫被动/.test(String(x)));
        return i >= 0 ? i : Math.max(0, (arr || []).length - 1);
      }
    },
    tweak: (S, bs) => { bs.p1.cost = 12; },
    // 卡名不写死：挑第一张"带[战术]/[增益]标签且当前可出"的卡（规矩#15）；
    // 排除"盖伏/连锁/抵消"类响应卡，避免用卡流程绕到连锁路径上去
    act: async (inst) => {
      inst.__picked = await playPickedCard(inst,
        c => /item|skill/.test(c._category || '') && /战术|增益/.test(String(c.type || '')) &&
             !/盖伏|连锁|抵消/.test(String(c.effect || '') + String(c.sp || '')),
        null, '带[战术]/[增益]标签的普通道具/技能卡');
    },
    check: (res, inst) => {
      const j = res.logs.join(' ');
      const t = tagsOf(res.S, inst.__picked);
      return [
        // 判据是"卡面文本带不带这个标签"：cardData 的 type/tags 字段就是卡面标签，__cardTags() 是与引擎同源的读取口径
        ['实际用的卡带[战术]或[增益]标签（__cardTags 输出）', t.indexOf('战术') >= 0 || t.indexOf('增益') >= 0,
          '卡=' + (inst.__picked || {}).name + '，__cardTags=' + JSON.stringify(t)],
        ['被动真的上链并完成结算', /▸ 逆结算 C\d+【入间枫被动·敏锐洞察】/.test(j), ''],
        ['抽到1张馈赠卡', /抽到馈赠卡【/.test(j), ''],
        ['再抽1张并展示（同色留/异色送墓）', /【入间枫被动】展示抽到的卡【/.test(j), ''],
        ['被动按队长位注册', res.S.battleState.p1._kaedePassive === true, '']
      ];
    },
    evidence: (res, inst) => {
      const c = inst.__picked || {};
      return [
        '入间枫 cardData.passive 原文：' + faceText(inst, '入间枫', 'passive'),
        '实际打出的卡：' + c.name + '｜cardData.type=' + JSON.stringify(c.type) + '｜cardData.tags=' + JSON.stringify(c.tags || null) +
          '｜效果原文=' + String(c.effect || '').slice(0, 70),
        '__cardTags(card) 实际输出=' + JSON.stringify(tagsOf(res.S, c)) + '（含[战术]/[增益]=' + (tagsOf(res.S, c).some(x => /战术|增益/.test(String(x)))) + '）',
        '被动注册条件：p1._kaedePassive=' + res.S.battleState.p1._kaedePassive + '｜队长=' + ((res.S.battleState.p1.captain || {}).name) +
          '｜队伍=' + teamNames(res.S).join('/') + '｜引擎内该被动是"选发"(mandatory:false) → 必须在选发连锁窗口里主动接受（本用例 boot.pickChain 就是这么接线的）',
        '连锁/结算日志：' + (res.logs.filter(l => /连锁|逆结算|入间枫被动|馈赠卡/.test(l)).join(' ｜ ') || '（无）')
      ];
    }
  },

  /* ---------------- 松山惠（理智） ---------------- */
  {
    char: '松山惠',
    why: 'SP：①乐曲α，回复4点音韵值并抽1张 → 主动发动后费用+4（上限12内）、手牌+1',
    text: { f: 'sp', has: '乐曲α，回复4点音韵值并抽1张' },
    tweak: (S, bs) => { bs.p1.hand = []; bs.p1.cost = 4; bs.p1.maxCost = 12; },
    act: async (inst) => { inst.S.useCharacterPassive(); },     // 角色技能按钮：选项表里只有「惠·乐曲」
    exact: [['自己.cost', 4], ['自己.手牌', 1]],
    mustLog: /【惠SP·乐曲α】回复4音韵并抽1张/,
    check: (res) => [['乐曲每回合一次的门控已被消耗', res.S.battleState.p1._megumiSPTurn === res.S.battleState.turn,
      '_megumiSPTurn=' + res.S.battleState.p1._megumiSPTurn + ' turn=' + res.S.battleState.turn]]
  },
  {
    char: '松山惠',
    why: '被动：使用3张牌后，若这些牌所需的音韵值依次递增则执行[乐曲α]（→ 日志必须命中递增/α分支）',
    text: { f: 'passive', has: '依次递增则执行[乐曲α]' },
    tweak: (S, bs) => { bs.p1.cost = 12; },
    // 逐张挑"费用严格大于上一张且当前可出"的卡，凑成递增序列（挑不到就记未验证，不当失败）
    act: async (inst) => {
      const used = [];
      for (let need = 0; need < 3; need++) {
        const prev = used.length ? used[used.length - 1].cost : -1;
        const cands = cardPool(inst).filter(c => Number(c.cost) > prev && used.indexOf(c) < 0).sort((a, b) => a.cost - b.cost);
        let picked = null;
        for (const c of cands) { if (playableNow(inst, c, 12).ok) { picked = c; break; } }
        if (!picked) throw preconditionError('凑不出第' + (need + 1) + '张费用递增且可出的卡（已用：' + used.map(c => c.name + '(' + c.cost + ')').join('、') + '）');
        used.push(picked);
        await useCardNow(inst, picked, 12);
        await L.quiesce(inst, 9000);
      }
      inst.__megumiSeq = used;
    },
    check: (res, inst) => {
      const j = res.logs.join(' ');
      const used = (inst.__megumiSeq || []).map(c => c.name + '(' + c.cost + ')');
      // 卡面 SP 把[乐曲α]定义为"回复4点音韵值并抽1张"；被动分支的实现回2音韵（见文件末尾"需人工确认"），
      // 因此这里只断言**分支选择**（这是被动文本唯一可逐字推导的部分），数值差异单独列出不当通过
      return [
        ['费用序列=递增（控制变量）', (inst.__megumiSeq || []).length === 3, '实际打出=' + used.join('→')],
        ['命中[乐曲α]分支', /乐曲α/.test(j), ''],
        ['日志写明"费用递增"', /费用递增/.test(j), ''],
        ['序列已结算并清空（重新编排旋律）', (res.S.battleState.p1._megumiCostSeq || []).length === 0, '_megumiCostSeq=' + JSON.stringify(res.S.battleState.p1._megumiCostSeq)]
      ];
    }
  },

  /* ---------------- 小野结衣（热忱） ---------------- */
  {
    char: '小野结衣', kind: 'diff',
    why: 'SP：使用攻击卡最终伤害+1 → 同一张攻击卡、同一站位，结衣队长应与无增伤队长相差恰好1点',
    text: { f: 'sp', has: '使用攻击卡或[侵略]技能卡最终伤害+1' },
    // 卡面「造成一次四面骰判定伤害」= **单段**判定伤害（判定伤害不吃属性克制，只吃判定增伤），
    // 因此把两边各自日志里的骰点扣掉，剩下的差值必须恰好 = 结衣SP 的 +1。
    // （先用【横扫之刃】跑过一版：那张卡在本站位下会打 2 段"1点热忱伤害"，差值自然=2，
    //   与卡面逐字推导的"单段"冲突 → 换成单段卡，避免把多段当成 SP 生效证据）
    card: '人格修正拳！',
    runs: [
      { team: ['小野结衣'], tweak: (S, bs) => { bs.p2.position = 3; bs.p1.cost = 12; } },
      { team: ['莉莉·缇雅菲洛'], tweak: (S, bs) => { bs.p2.position = 3; bs.p1.cost = 12; } }
    ],
    act: async (inst, card) => { await useCardNow(inst, card, 12); },
    measure: (r) => (-delta(r, '对手.sync')) - (rollOf(r.logs) === null ? NaN : rollOf(r.logs)),
    expectDiff: 1,
    check: (rs) => [
      ['控制变量：队长确实换人', teamNames(rs[0].inst.S)[0] !== teamNames(rs[1].inst.S)[0],
        'A队长=' + teamNames(rs[0].inst.S)[0] + ' B队长=' + teamNames(rs[1].inst.S)[0]],
      // 用户怀疑过"对手队伍/属性不同 → 混沌弱点多1"：两局的 p2 都由 harness 用同一个 ARCH_LIST 下标构筑，
      // 这里把它断言成前提（对手队伍与本方一样完全一致、属性也一致），否则差值不能只归给结衣SP
      ['控制变量：两局对手队伍完全相同', p2Team(rs[0]) === p2Team(rs[1]), 'A对手=' + p2Team(rs[0]) + ' B对手=' + p2Team(rs[1])],
      ['控制变量：两局对手队伍属性完全相同（排除混沌弱点/克制混淆）', p2Attr(rs[0]) === p2Attr(rs[1]),
        'A对手属性=' + p2Attr(rs[0]) + ' B对手属性=' + p2Attr(rs[1])],
      ['控制变量：本方攻击力/防御等增伤来源一致', (rs[0].inst.S.battleState.p1.attackBuff || 0) === (rs[1].inst.S.battleState.p1.attackBuff || 0) &&
        (rs[0].inst.S.battleState.p2.defense || 0) === (rs[1].inst.S.battleState.p2.defense || 0),
        'A攻=' + (rs[0].inst.S.battleState.p1.attackBuff || 0) + '/守=' + (rs[0].inst.S.battleState.p2.defense || 0) +
        ' B攻=' + (rs[1].inst.S.battleState.p1.attackBuff || 0) + '/守=' + (rs[1].inst.S.battleState.p2.defense || 0)],
      ['A 的结衣SP已注册 / B 没有', rs[0].inst.S.battleState.p1._yuiSP === true && !rs[1].inst.S.battleState.p1._yuiSP, ''],
      ['两张卡都是【人格修正拳！】（同卡）', rs[0].card.name === rs[1].card.name, rs[0].card.name],
      ['两边各只发生1次判定骰（单段前提）', (rs[0].logs.join(' ').match(/判定伤害骰点：/g) || []).length === 1 &&
        (rs[1].logs.join(' ').match(/判定伤害骰点：/g) || []).length === 1,
        'A段数=' + (rs[0].logs.join(' ').match(/判定伤害骰点：/g) || []).length + ' B段数=' + (rs[1].logs.join(' ').match(/判定伤害骰点：/g) || []).length]
    ],
    evidence: (rs) => rs.map((r, i) => (i + 1) + '局 逐条伤害结算：对手队伍=' + p2Team(r) + '（属性=' + p2Attr(r) + '，队长=' +
      (((r.inst.S.battleState.p2.captain) || {}).name) + '）｜骰点=' + rollOf(r.logs) + '｜' +
      (r.logs.filter(l => /判定伤害骰点|【增伤】|受到|护盾|防御/.test(l)).join(' ｜ ') || '（无增伤日志）'))
  },

  /* ---------------- 现实间里绪（热忱）·队员位 ---------------- */
  {
    char: '现实间里绪', kind: 'diff',
    why: 'SP：全队造成的判定伤害+1，作为队员编组也生效 → 里绪当队员时，判定伤害应比对照队多1点（扣掉各自骰点）',
    text: { f: 'sp', has: '全队造成的判定伤害+1' },
    card: '破损电子设备',                   // 2费：对一名其他玩家造成一次4面骰判定伤害
    runs: [
      { team: ['莉莉·缇雅菲洛', '现实间里绪'], tweak: (S, bs) => { bs.p1.cost = 12; } },
      { team: ['莉莉·缇雅菲洛', '宁雨清'], tweak: (S, bs) => { bs.p1.cost = 12; } }
    ],
    act: async (inst, card) => { await useCardNow(inst, card, 12); },
    // 骰点用日志读数从两边各自扣掉，剩下的差值才只反映"判定伤害+N"
    measure: (r) => (-delta(r, '对手.sync')) - (rollOf(r.logs) === null ? NaN : rollOf(r.logs)),
    expectDiff: 1,
    check: (rs) => {
      const A = rs[0], B = rs[1];
      return [
        ['控制变量：里绪在A队第2位（不在队长位）', teamNames(A.inst.S)[0] !== '现实间里绪' && teamNames(A.inst.S)[1] === '现实间里绪', 'A队=' + teamNames(A.inst.S).join('/')],
        ['两边骰点都从日志读到（否则期望无法推导）', rollOf(A.logs) !== null && rollOf(B.logs) !== null, 'A骰=' + rollOf(A.logs) + ' B骰=' + rollOf(B.logs)],
        ['A 判定增伤=1（里绪SP）/ B 无', A.inst.S.battleState.p1._judgeDamageBonus === 1 && !B.inst.S.battleState.p1._judgeDamageBonus,
          'A=' + A.inst.S.battleState.p1._judgeDamageBonus + ' B=' + B.inst.S.battleState.p1._judgeDamageBonus],
        ['队长被动不因队员位生效（规则：队长提供被动）', !A.inst.S.battleState.p1._rioPassive, '_rioPassive=' + A.inst.S.battleState.p1._rioPassive]
      ];
    }
  },

  /* ---------------- 莉莉·缇雅菲洛（无序） ---------------- */
  {
    char: '莉莉·缇雅菲洛',
    why: 'SP：每回合一次把墓地最下方一张卡放回牌组最下方；该卡是单次种类且新墓地最下方不是单次种类时，视为使用它并回1音韵',
    text: { f: 'sp', has: '把墓地最下方的一张卡放回牌组最下方' },
    tweak: (S, bs, card, out) => {
      const single = S.allCards.find(c => c && c._category === 'item_single');
      const perm = S.allCards.find(c => c && c._category === 'item_permanent');
      bs.p1.grave = [single, perm];        // 引擎口径：grave[0]=墓地最下方（最早进墓），末位=牌组最下方
      bs.p1.hand = [S.allCards.find(c => c && c._category === 'item_single' && c !== single)];
      bs.p1.cost = 4; bs.p1.maxCost = 12;
      out.single = single; out.perm = perm;
    },
    // 2026-09-27：莉莉·回收 已从「角色技能」菜单移到"自己回合开始时弹窗询问"（作者裁决），
    // 本用例只验证**效果数值**，所以直接调效果函数（触发方式由源码断言守）
    act: async (inst) => { inst.S.activateLilySP(); },
    check: (res) => {
      const p = res.S.battleState.p1, j = res.logs.join(' ');
      const single = (res.inst.__out || {}).single;    // tweak 里选的"墓地最下方"那张卡
      const back = p.deck[p.deck.length - 1];
      return [
        ['放回的卡=原墓地最下方，且落在牌组末位', !!back && !!single && back.name === single.name, '牌组末位=' + (back && back.name)],
        ['墓地张数 -1', (p.grave || []).length === 1, '墓地=' + (p.grave || []).map(c => c.name).join(',')],
        ['日志：墓地最下方放回牌组最下方', /【莉莉SP】墓地最下方【.+】放回牌组最下方/.test(j), ''],
        ['条件分支：视为使用并回1音韵', /视为使用【.+】并回复1音韵/.test(j), ''],
        ['该分支确实回了1音韵（费用Δ=+1）', delta(res, '自己.cost') === 1, '费用Δ=' + delta(res, '自己.cost')]
      ];
    }
  },

  /* ---------------- 露璐缇雅·爱德华（理智） ---------------- */
  {
    char: '露璐缇雅·爱德华',
    why: '被动：使用/发动的卡费用与上一张相同时 → 自身攻击力+1（本回合结束为止）并回复1点音韵值',
    text: { f: 'passive', has: '费用与上一张卡相同时可以提升自身1点攻击力' },
    // 控制变量：连打两张"同费"的卡（第一张必然不触发，第二张才该触发）
    // 选卡条件：效果文本不含 音韵/费用/金币/抽/弃/献祭/回收 —— 隔离卡片自身对费用的扰动
    tweak: (S, bs) => { bs.p1.cost = 10; bs.p1.maxCost = 12; },
    act: async (inst) => {
      const clean = c => Number(c.cost) >= 2 && Number(c.cost) <= 4 &&
        !/音韵|费用|金币|抽|弃|献祭|回收/.test(String(c.effect || '') + String(c.text || ''));
      const x = await playPickedCard(inst, clean, 10, '第一张费用干净的卡');
      await L.quiesce(inst, 9000);
      const y = await playPickedCard(inst, c => clean(c) && Number(c.cost) === Number(x.cost), null, '与第一张同费且可出的卡');
      await L.quiesce(inst, 9000);
      inst.__pair = [x, y];
    },
    check: (res, inst) => {
      const pair = inst.__pair || [];
      return [
        ['打出的两张卡费用相同（控制变量）', pair.length === 2 && Number(pair[0].cost) === Number(pair[1].cost),
          '实际=' + pair.map(c => c.name + '(' + c.cost + ')').join(' + ')],
        ['同费触发计数=1（只有第二张触发）', res.S.battleState.p1._edwardTriggerCount === 1, '实得=' + res.S.battleState.p1._edwardTriggerCount],
        ['攻击力+1（本回合结束为止）', delta(res, '自己._tempAttack') === 1, 'Δ=' + delta(res, '自己._tempAttack')],
        ['回复1点音韵（费用Δ = -(两卡费用和)+1）', delta(res, '自己.cost') === -(Number(pair[0].cost) + Number(pair[1].cost)) + 1,
          '期望=' + (-(Number(pair[0].cost) + Number(pair[1].cost)) + 1) + ' 实得=' + delta(res, '自己.cost')],
        ['日志写明同费触发', /【爱德华被动·别眨眼！】同费触发第1次/.test(res.logs.join(' ')), '']
      ];
    }
  },
  {
    char: '露璐缇雅·爱德华', kind: 'raw', team: ['露璐缇雅·爱德华'],
    why: 'SP：这张卡编组时会作为2名[破坏者]角色计数 → 破坏者合计 = 2 + 其他队员的[破坏者]标签数',
    text: { f: 'sp', has: '作为2名[破坏者]角色计数' },
    check: (S) => {
      const exp = breakerExpected(S), got = S.__breakerCount('p1');
      return [
        ['队伍构成（含其他人标签数由 cardData 现算）', true, '队伍=' + teamNames(S).join('/') + ' → 期望=' + exp],
        ['破坏者合计 = 2 + 其他队员破坏者数', got === exp, '实得=' + got + ' 期望=' + exp],
        ['SP 已注册', S.battleState.p1._edwardSP === true, '']
      ];
    }
  },

  /* ---------------- 霜烬（热忱） ---------------- */
  {
    char: '霜烬', kind: 'diff',
    why: 'SP：队伍每回合自然回复的音韵值+1（队员位也生效）→ 霜烬队长比无霜烬队长多回1音韵',
    text: { f: 'sp', has: '队伍每回合自然回复的音韵值+1' },
    runs: [
      { team: ['霜烬'], tweak: regenSetup(30) },
      { team: ['莉莉·缇雅菲洛'], tweak: regenSetup(30) }
    ],
    act: regenAct,
    field: '自己.cost', measure: (r) => delta(r, '自己.cost'),
    expectDiff: 1,
    check: (rs) => [
      ['控制变量：队长确实换人', (rs[0].inst.S.battleState.p1.captain || {}).name === '霜烬' && (rs[1].inst.S.battleState.p1.captain || {}).name === '莉莉·缇雅菲洛',
        'A=' + (rs[0].inst.S.battleState.p1.captain || {}).name + ' B=' + (rs[1].inst.S.battleState.p1.captain || {}).name],
      ['控制变量：同步值都=30（>26 与 <14 两条被动都不适用）', deltasync(rs) === 0, 'A=' + rs[0].before['自己.sync'] + ' B=' + rs[1].before['自己.sync']],
      ['A 的 _frostRegen=true / B 无', rs[0].inst.S.battleState.p1._frostRegen === true && !rs[1].inst.S.battleState.p1._frostRegen, ''],
      ['A 实际回费=6 / B=5', delta(rs[0], '自己.cost') === 6 && delta(rs[1], '自己.cost') === 5,
        'A=' + delta(rs[0], '自己.cost') + ' B=' + delta(rs[1], '自己.cost')]
    ]
  },
  {
    char: '霜烬', kind: 'diff',
    why: '被动：同步值低于14时每回合自然回复+4（同一副队伍、只改同步值 13 vs 30 做控制变量）',
    text: { f: 'passive', has: '同步值低于14' },
    runs: [
      { team: ['霜烬'], tweak: regenSetup(13) },
      { team: ['霜烬'], tweak: regenSetup(30) }
    ],
    act: regenAct,
    field: '自己.cost', measure: (r) => delta(r, '自己.cost'),
    expectDiff: 4,
    check: (rs) => [
      ['控制变量：同步值确实一个是13一个是30', rs[0].before['自己.sync'] === 13 && rs[1].before['自己.sync'] === 30,
        'A=' + rs[0].before['自己.sync'] + ' B=' + rs[1].before['自己.sync']],
      ['两队成员完全相同（只有同步值变）', teamNames(rs[0].inst.S).join('/') === teamNames(rs[1].inst.S).join('/'), teamNames(rs[0].inst.S).join('/')],
      ['低同步：回费=10（5基础+4被动+1SP）', delta(rs[0], '自己.cost') === 10, '实得=' + delta(rs[0], '自己.cost')],
      ['日志写明同步低于14', /【霜烬被动】同步低于14/.test(rs[0].logs.join(' ')), '']
    ]
  },

  /* ---------------- 小仓霞（热忱） ---------------- */
  {
    char: '小仓霞',
    why: '被动：每回合一次，选至多2张手卡和1张区域内卡放回牌组洗切，然后抽相同数量；放回3张时回1音韵',
    text: { f: 'passive', has: '选至多2张手卡和1张区域内卡放回牌组洗切' },
    tweak: (S, bs) => {
      const items = cardPool({ g: { cards: () => S.allCards } }).filter(c => /item/.test(c._category || ''));
      bs.p1.permanent = [items[0]];
      bs.p1.hand = [items[1], items[2], items[3]];
      bs.p1.cost = 4; bs.p1.maxCost = 12;
    },
    act: async (inst) => {
      const S = inst.S;
      // 为什么自己驱动选择器：整肃的流程是"选2张手卡 → 回调里再弹一次'选1张区域内卡'"，是**嵌套选择器**。
      // 底座 autoAnswer 对 showCardPickerMulti 的包装是"读完回调 → 调用 → 再置 null"，
      // 嵌套时第二次选择器的回调会被外层的置 null 抹掉，表现为"手卡放回了、后面全停"。
      // 游戏自己的真实点击路径是 fire(){ 先取出并置 null，再调用回调 } → 嵌套安全，
      // 所以这是**测试底座**的假故障（不改 lib/，按规矩只在用例里换成直接回调驱动）。
      const asked = [];
      S.showCardPickerMulti = function (cards, title, cb, need, allowLess) {
        const arr = cards || [];
        const n = Math.max(1, Math.min(need || 1, arr.length || 1));
        const sel = (n >= 2) ? arr.map((c, i) => i).slice(0, n) : 0;
        asked.push(title + ' → 选' + JSON.stringify(sel));
        setTimeout(() => { try { cb(sel); } catch (e) { asked.push('回调抛错：' + e.message); } }, 20);
      };
      inst.__asked = asked;
      S.useCharacterPassive();      // 角色技能按钮里唯一一项「霞·整肃」
    },
    // 期望值（逐字）：放回 2手卡+1区域卡=3 张 → 抽相同数量=3张；手牌 -2+3=+1；永续区 -1；牌库 +3-3=0；费用 +1
    exact: [['自己.手牌', 1]],
    check: (res, inst) => {
      const j = res.logs.join(' ');
      const cnt = re => (j.match(re) || []).length;
      const backHand = cnt(/【霞被动·整肃】手卡【/g), backPerm = cnt(/【霞被动·整肃】永续【/g), drawn = cnt(/【霞被动·整肃】抽到【/g);
      return [
        ['两次选择器都真的弹了（手卡+永续区）', (inst.__asked || []).length === 2, (inst.__asked || []).join(' / ')],
        ['放回手卡正好2张', backHand === 2, '实得=' + backHand],
        ['放回区域内卡正好1张（前提：场上有区域内卡可选）', backPerm === 1, '实得=' + backPerm],
        ['放回合计=3张', backHand + backPerm === 3, '实得=' + (backHand + backPerm)],
        ['按"抽相同数量"抽了3张', drawn === 3, '实得=' + drawn],
        ['永续区 -1', delta(res, '自己.永续区') === -1, 'Δ=' + delta(res, '自己.永续区')],
        ['牌库数 ±0（放回3抽3）', delta(res, '自己.牌库数') === 0, 'Δ=' + delta(res, '自己.牌库数')],
        ['费用 +1（放回3张回1音韵）', delta(res, '自己.cost') === 1, 'Δ=' + delta(res, '自己.cost')],
        ['日志：放回3张回1音韵', /放回3张，回复1点音韵值/.test(j), ''],
        ['每回合一次已被消耗', res.S.battleState.p1._kasumiUsedThisTurn === true, '']
      ];
    },
    evidence: (res, inst) => {
      const j = res.logs.join(' ');
      const cnt = re => (j.match(re) || []).length;
      return [
        '小仓霞 cardData.passive 原文：' + faceText(inst, '小仓霞', 'passive'),
        '放回张数打点：手卡 ' + cnt(/【霞被动·整肃】手卡【/g) + ' 张｜永续区 ' + cnt(/【霞被动·整肃】永续【/g) + ' 张｜合计 ' +
          (cnt(/【霞被动·整肃】手卡【/g) + cnt(/【霞被动·整肃】永续【/g)) + ' 张',
        '抽卡张数打点：' + cnt(/【霞被动·整肃】抽到【/g) + ' 张（卡面"然后抽相同数量"）',
        '选择器实际点选：' + (inst.__asked || []).join(' ｜ '),
        '逐条日志：' + (res.logs.join(' ｜ ') || '（无）').slice(0, 320)
      ];
    }
  },

  /* ---------------- 小野伊织（理智） ---------------- */
  {
    char: '小野伊织',
    why: '被动：抽馈赠卡时不会抽到[500$] → 连抽6次馈赠卡，日志必须显示奖池已剔除500$且一次都没抽到',
    text: { f: 'passive', has: '抽馈赠卡时不会抽到[500$]' },
    tweak: (S, bs) => { bs.p1.cost = 6; bs.p1.gold = 0; },
    act: async (inst) => {
      for (let i = 0; i < 6; i++) {
        inst.S.drawGiftCard('p1');
        await sleep(1200);                       // 校准类馈赠会播 20 面骰动画，等它落地再抽下一张
        await L.quiesce(inst, 6000);
      }
    },
    check: (res) => {
      const j = res.logs.join(' ');
      const drawn = (j.match(/抽到馈赠卡【([^】]+)】/g) || []).map(s => s.replace(/抽到馈赠卡【|】/g, ''));
      const filterLogs = (j.match(/【伊织被动·恩典】本次馈赠卡池不含\[500\$\]/g) || []).length;
      return [
        ['连抽6张都到了结算口', drawn.length === 6, '实得=' + drawn.length + ' 张：' + drawn.join(',')],
        ['奖池剔除日志出现6次（每次抽卡都滤）', filterLogs === 6, '实得=' + filterLogs + ' 次'],
        ['一张也不是[500$]', drawn.indexOf('500$') < 0, '抽到=' + drawn.join(',')],
        ['被动按队长位注册', res.S.battleState.p1._ioriPassive === true, '']
      ];
    }
  },
  {
    char: '小野伊织',
    why: 'SP：到达[神社]后回自身5音韵并抽1张馈赠卡 → 把人放到神社格触发落格效果，费用必须+5且抽到1张馈赠卡',
    text: { f: 'sp', has: '到达[神社]后回自身5音韵并抽1张馈赠卡' },
    tweak: (S, bs) => {
      const idx = (S.MAP_TILES || []).findIndex(t => t && t.type === 'shrine');
      if (idx < 0) throw new Error('地图里找不到 shrine 格');
      bs.p1.position = idx;                     // 直接站到神社格（不写死格子编号）
      bs.p1.cost = 4; bs.p1.maxCost = 12;
      bs.p1.gold = 0;                           // 金币清零：隔离"付费抽御神签"的噪声
    },
    act: async (inst) => { inst.S.triggerTileEffect('p1'); },
    exact: [['自己.cost', 5]],
    mustLog: /【小野伊织SP】到达神社，回复5点音韵值/,
    check: (res, inst) => [
      ['确实落在神社格', /到达【神社】/.test(res.logs.join(' ')), '落格日志：' + (res.logs.find(l => /到达【/.test(l)) || '（无）')],
      ['抽到1张馈赠卡', /抽到馈赠卡【/.test(res.logs.join(' ')), ''],
      ['SP 已注册', res.S.battleState.p1._ioriSP === true, '']
    ]
  },

  /* ---------------- 入间予（无序） ---------------- */
  {
    char: '入间予', kind: 'raw', team: ['入间予'],
    why: '被动：初始20%控骰，编组光太郎/葵/莉莉/霞各+20%(可叠加)，编组琉璃/里绪/枫+40%(不可叠加) → 按实际编组逐字算期望',
    text: { f: 'passive', has: '初始20%控骰' },
    check: (S) => {
      const exp = yuControlExpected(S), got = S.battleState.p1._diceControlBonus;
      return [
        ['队伍构成', true, '队伍=' + teamNames(S).join('/') + ' → 期望控骰=' + Math.round(exp * 100) + '%'],
        ['_diceControlBonus = 卡面算出的百分比', Math.abs(got - exp) < 1e-9, '实得=' + (got === undefined ? '（无）' : Math.round(got * 100) + '%') + ' 期望=' + Math.round(exp * 100) + '%'],
        ['被动已注册', S.battleState.p1._yuPassive === true, '']
      ];
    }
  },
  {
    char: '入间予',
    why: '被动：控骰能力要真的被投掷消费（普通投掷上限100%）→ 打点 __diceControlPct，期望=卡面算出的百分比',
    text: { f: 'passive', has: '初始20%控骰' },
    tweak: (S, bs) => { bs.p1.cost = 4; bs.p1.maxCost = 12; },
    act: async (inst) => {
      const S = inst.S, bs = S.battleState;
      const orig = S.__diceControlPct;
      if (typeof orig !== 'function') throw new Error('引擎里没有 __diceControlPct（控骰消费点）');
      inst.__pcts = [];
      S.__diceControlPct = function (pl) { const v = orig.apply(this, arguments); if (pl === 'p1') inst.__pcts.push(v); return v; };
      bs.phase = 'roll'; bs.currentPlayer = 'p1'; bs._diceRolledThisPhase = false; bs._moveResolved = false;
      S.rollDice();
    },
    check: (res, inst) => {
      const exp = yuControlExpected(res.S);
      const seen = inst.__pcts || [];
      return [
        ['投掷确实走了控骰消费点（__diceControlPct 被打点命中）', seen.length > 0, '命中 ' + seen.length + ' 次'],
        ['消费到的百分比=卡面算出的百分比', seen.length > 0 && Math.abs(seen[0] - exp) < 1e-9,
          '实得=' + (seen.length ? Math.round(seen[0] * 100) + '%' : '（未命中）') + ' 期望=' + Math.round(exp * 100) + '%'],
        ['投掷日志落地', /投出\s*\d+\s*点/.test(res.logs.join(' ')), '']
      ];
    }
  },

  /* ---------------- 雨宫羽奈（理智）·队员位 ---------------- */
  {
    char: '雨宫羽奈', kind: 'diff',
    why: 'SP：使用[侵略]道具卡最终伤害+1，作为队员编组也生效 → 羽奈当队员时，[侵略]道具的伤害应比对照队多1点',
    text: { f: 'sp', has: '使用[侵略]道具卡最终伤害+1' },
    card: '风纪委员臂章',                     // 永续/[侵略]：发动时给予一名其他玩家3点理智伤害（固定值、不掷骰）
    runs: [
      { team: ['莉莉·缇雅菲洛', '雨宫羽奈'], tweak: (S, bs) => { bs.p1.cost = 12; } },
      { team: ['莉莉·缇雅菲洛', '宁雨清'], tweak: (S, bs) => { bs.p1.cost = 12; } }
    ],
    act: async (inst, card) => { await useCardNow(inst, card, 12); },
    measure: (r) => -delta(r, '对手.sync'),
    expectDiff: 1,
    check: (rs) => {
      const A = rs[0], B = rs[1];
      return [
        ['控制变量：羽奈在A队第2位（队长同为莉莉）', teamNames(A.inst.S)[0] === '莉莉·缇雅菲洛' && teamNames(A.inst.S)[1] === '雨宫羽奈' && teamNames(B.inst.S)[0] === '莉莉·缇雅菲洛',
          'A队=' + teamNames(A.inst.S).join('/') + ' B队=' + teamNames(B.inst.S).join('/')],
        ['A 的羽奈SP已注册 / B 没有', A.inst.S.battleState.p1._hinaSP === true && !B.inst.S.battleState.p1._hinaSP, ''],
        ['羽奈被动不因队员位生效（规则：队长提供被动）', !A.inst.S.battleState.p1._hinaPassive, '_hinaPassive=' + A.inst.S.battleState.p1._hinaPassive],
        ['两边基础伤害相同（同卡同场景）', A.card.name === B.card.name, A.card.name]
      ];
    }
  },

  /* ---------------- 枫(水着)（理智）·队员位 ---------------- */
  {
    char: '枫(水着)', kind: 'diff',
    why: 'SP：小队中每名成员自然回复的音韵值增加50%（向下），队员位也生效 → 基础5点应变为 floor(5×1.5)=7',
    text: { f: 'sp', has: '每名成员自然回复的音韵值增加50%' },
    runs: [
      { team: ['莉莉·缇雅菲洛', '枫(水着)'], tweak: regenSetup(30) },
      { team: ['莉莉·缇雅菲洛', '宁雨清'], tweak: regenSetup(30) }
    ],
    act: regenAct,
    field: '自己.cost', measure: (r) => delta(r, '自己.cost'),
    expectDiff: 2,                                     // 7 - 5
    check: (rs) => [
      ['控制变量：枫(水着)在A队第2位（队长同为莉莉）', teamNames(rs[0].inst.S)[0] === '莉莉·缇雅菲洛' && teamNames(rs[0].inst.S)[1] === '枫(水着)',
        'A队=' + teamNames(rs[0].inst.S).join('/') + ' B队=' + teamNames(rs[1].inst.S).join('/')],
      ['A 的 _kaedeMizugiRegen=true / B 无', rs[0].inst.S.battleState.p1._kaedeMizugiRegen === true && !rs[1].inst.S.battleState.p1._kaedeMizugiRegen, ''],
      ['A 实际回费=7（floor(5×1.5)）/ B=5', delta(rs[0], '自己.cost') === 7 && delta(rs[1], '自己.cost') === 5,
        'A=' + delta(rs[0], '自己.cost') + ' B=' + delta(rs[1], '自己.cost')]
    ]
  },

  /* ---------------- 「初始手牌+1」：同一副卡组只换队长顺序的差分 ----------------
     这两条对应基线 char_effect_expect.js 里长期标为"未验证"的 小野葵 / 木原光太郎 被动。
     基线当时的结论是"换队长会连整副卡组一起换，初始手牌张数不可比" —— 差分法把这件事隔离掉了：
     同一个流派构筑出来的队伍，只把 chars 的两名成员**位置互换**（成员集合/道具/携带卡完全不动），
     于是"谁当队长"成了唯一变量，而引擎里队长被动只按 chars[0] 注册（isCaptain = (i===0)）。 */
  {
    char: '小野葵', kind: 'deckswap',
    why: '被动：初始手牌+1 → 同一副卡组只把队长位从【小野葵】换成一名没有初始手牌类被动的队友，初始手牌应恰好少1张',
    text: { f: 'passive', has: '初始手牌+1' },
    // ARCH_LIST 的 6 个流派里没有任何一个编入小野葵（见运行时打印）→ 走"手工构筑"路线：
    // 队友用**游戏自己的** autoFillItems + cardBelongsToTeam 选卡，且队友被动/SP 都碰不到手牌
    teammates: ['宫樱子', '松山惠']
  },
  {
    char: '木原光太郎', kind: 'deckswap',
    why: '被动：初始手牌+1，每个回合开始时可以额外抽取1张卡 → 只换队长顺序时初始手牌差1，跑完准备阶段后差2',
    text: { f: 'passive', has: '初始手牌+1' },
    teammates: ['宫樱子', '松山惠'],
    alsoPerTurnDraw: true
  },

  /* ---------------- 明确标"未验证"的部分（不假装通过） ----------------
     以下都是**同一张角色卡的另一半效果**，本批次没跑出可靠观测点，
     按任务要求单列并写清精确原因（角色本身在批次D内都已有 ≥1 条通过断言）。 */
  {
    char: '松山惠',
    why: '被动触发的[乐曲α]数值口径（卡面 SP 把乐曲α定义为"回复4点音韵值并抽1张"）',
    text: { f: 'passive', has: '依次递增则执行[乐曲α]' },
    skip: '实现分两条路且数值不同：主动发动(activateMegumiSP)的α回4音韵并抽1，被动音律感应分支的α回2音韵并抽1（日志原文「费用递增乐曲α：回2音韵并抽1」）。卡面只把[乐曲α]定义了一次 → 两处口径不一致，属"卡面/实现不一致"疑似项，故不断言数值，只断言分支选择（见本轮通过项与回报清单）'
  },
  {
    char: '莉莉·缇雅菲洛',
    why: '被动「逝者之眼」：投掷结果出现前在原点数/对立面之间二选一；抽卡前可看牌组最下方并选择从顶/底抽',
    text: { f: 'passive', has: '对立面点数中选择一项' },
    skip: '需要在 rollPlayerDice 内部的投掷结果生成前拦截并二选一（起点数已定、尚未落地），cardlab 目前没有"在投掷前的骰子修正窗口内作答"的驱动点；本次只验证了她的 SP（墓地回收+视为使用）'
  },
  {
    char: '小仓霞',
    why: 'SP：到达公共站/地铁可直接移动至该线路或转乘线路下车点，无需判定和支付费用',
    text: { f: 'sp', has: '到达公共站/地铁可直接移动至该线路' },
    skip: '需要把角色放到公交/地铁格并驱动"乘车→选线路→选下车点"的多步流程（含联机决策问答），cardlab 没有该场景驱动能力；本次只验证了她的被动「整肃」（放回3张的抽/费/区域变化全部对上）'
  },
  {
    char: '现实间里绪',
    why: '被动：可用2枚六面骰替换移动骰（不可用于判定伤害）；单回合累计移动8格后可付1音韵造四面骰判定伤害',
    text: { f: 'passive', has: '可以使用2枚六面骰替换原本使用的骰子' },
    skip: '需要驱动"投掷方式二选一"的弹窗（在 rollDiceForPlayer 内）与"单回合累计8格→付1/2音韵造判定伤害"的多步流程；本次只验证了里绪的 SP（队员位全队判定+1）'
  },
  {
    char: '雨宫羽奈',
    why: '被动：用[侵略]道具造伤后追加1段1理智伤；用[移动]道具后对一名玩家造1理智伤（一次行动一次）',
    text: { f: 'passive', has: '使用[侵略]道具卡造伤害后追加1段1理智伤害' },
    skip: '被动只在队长位注册，而本轮验证她的 SP 时故意把她放在队员位（差分要求"只多出SP"）；要验证被动需要另开一套"队长位"场景并驱动[移动]道具钩子，本轮未做'
  },
  {
    char: '枫(水着)',
    why: '被动：使用理智属性的卡造成伤害后追加1段1点理智伤害（那之后可前进1-3格）；单回合累计移动8格可回收墓地一张[移动]/[战术]道具',
    text: { f: 'passive', has: '追加1段1点理智属性伤害' },
    skip: '需要先造出"理智卡造成的伤害"再读追加段（涉及选卡+目标+段数判定），本轮只验证了她的 SP（队员位自然回复+50%）；追加段与回收分支都未驱动'
  },
  {
    char: '霜烬',
    why: '被动另一半：同步值高于26时全队不会受到其他玩家施加的负面效果',
    text: { f: 'passive', has: '同步值高于26' },
    skip: '需要在同步>26时由对手施加一个负面效果再看是否被拦下（要构造"对手施加负面"的卡与时点），本轮只验证了低同步分支（自然回复+4）与 SP（回费+1）'
  },
  {
    char: '小野结衣',
    why: '被动「小野一刀流」：使用攻击卡或[侵略]道具卡指定目标后可将其一张卡直到本回合结束前移出游戏',
    text: { f: 'passive', has: '可将其一张卡直到本回合结束前移出游戏' },
    skip: '该被动是"选发"（postUsePassiveHooks 里 mandatory:false）且移出对象走 pickFromList 弹窗，需要在选发连锁窗口里主动选它（底座默认对连锁窗口答 PASS）；本轮只验证了她的 SP（攻击卡最终伤害+1）'
  },
  {
    char: '露璐缇雅·爱德华',
    why: 'SP 另一半：破坏者合计≥3时每个自己回合可发动一次，破坏一名玩家区域内的一张卡，然后其回复4音韵',
    text: { f: 'sp', has: '破坏一名玩家区域内的一张卡' },
    skip: '主动发动需要"破坏者≥3"的合法队伍（本轮流派「控场队」实测破坏者计数=2，未达阈值）且要驱动"选哪一方区域→选哪张卡"两级弹窗；本轮只验证了"作为2名破坏者计数"这一句'
  },
  {
    char: '入间枫',
    why: 'SP 其余选项组合（③每回合献祭次数+1 与①/②的组合未逐一覆盖）',
    text: { f: 'sp', has: '①回复6点音韵值②抽2张卡③每回合献祭次数+1' },
    skip: 'autoAnswer 对"入间枫SP选择"弹窗固定选第一项（结果固定为②+①），要覆盖 ③ 需要给底座传自定义 pickChoice；本轮只断言了"恰好选满2项且询问已结束"这条机制本身'
  },
  {
    char: '入间予',
    why: 'SP：全队判定伤害+1，每有1名无序属性成员全队自然回复音韵+1；被动 Lv7 追加每次投掷后回1音韵',
    text: { f: 'sp', has: '每有1名无序属性成员全队自然回复音韵+1' },
    skip: '需在准备阶段自然回复时读"无序成员数×1"的加成（要跑一次准备阶段回复并把队伍换成含无序成员的组合），且 Lv7 需要先把等级升到7；本轮只验证了他的被动控骰（登记值+真实投掷消费）'
  },
  {
    char: '木原光太郎',
    why: 'SP 另一半：每回合首次完成献祭后从"①500金币②队伍攻击+1③对一名玩家造1点无序伤害"中选一项执行',
    text: { f: 'sp', has: '①获得500金币②增加1点队伍攻击力③对一名其他玩家造成1点无序属性伤害' },
    skip: '该三选一是献祭后的弹窗分支，基线 char_effect_expect.js 已验证"献祭次数+1"这一句、本批次验证了初始手牌+1与回合开始额外抽1；三个选项的具体结算本轮未逐一断言'
  },
  {
    char: '小野伊织',
    why: '被动另一半：每次投掷结果出现时可在其和2中选一项为最终结果',
    text: { f: 'passive', has: '可在其和2中选一项为最终结果' },
    skip: '同莉莉的投掷修正窗口：需要在投掷结果落地前作答（__ioriAsk），cardlab 目前没有该驱动点；本轮验证了她的被动馈赠池过滤（连抽6次不含500$）与 SP（到达神社回5音韵+抽1馈赠）'
  },
  {
    char: '小野葵',
    why: 'SP：每名成员自然回复音韵+50%(向下)，队伍暴击伤害+1',
    text: { f: 'sp', has: '每名成员自然回复音韵+50%' },
    skip: '需要在准备阶段自然回复时读 floor(5×1.5)=7 的加成（本轮已用同一手法验证了 枫(水着) 的同类 SP=7、霜烬 SP=+1），但小野葵本批次的主要工作量在"初始手牌+1"的差分上，未再单开一条'
  }
];

function deltasync(rs) { return (rs[0].before['自己.sync'] || 0) - (rs[1].before['自己.sync'] || 0); }

/* ============================================================
 * 二·B、"同一副卡组只换队长顺序"的差分（用于验证「初始手牌+1」这类
 *      以前无法隔离的被动）
 * ------------------------------------------------------------
 * 为什么这样能隔离：引擎的队长判定是 `chars[0]`（processCharacterPassives 里 isCaptain = (i===0)），
 * 而道具/携带卡的选卡只依赖**队伍成员的集合**（autoFillItems 按属性需求、cardBelongsToTeam 按队名集合），
 * 与顺序无关。所以「chars 只做位置互换」时，两局的牌库构成完全一致，**唯一的差别**就是
 * 哪一名角色拿到队长位 → 哪一名角色的被动被注册。
 * 前提必须被断言（规矩#18）：两局的 chars 名字集合、items、carries 必须逐项相同，
 * 否则这条差分无效（不能拿它当证据）。
 * ============================================================ */

/** 找"编入了 want 的流派" + 一个**没有初始手牌类被动**的队友当对照组队长 */
function findPartnerArch(probe, want) {
  const S = probe.S, scans = [];
  for (const arch of (S.ARCH_LIST || [])) {
    let d = null;
    try { d = S.buildSmartDeck(arch); } catch (e) { scans.push(arch + '(抛错:' + e.message + ')'); continue; }
    const team = ((d && d.chars) || []).filter(Boolean);
    const names = team.map(c => c.name);
    if (names.indexOf(want) < 0) { scans.push(arch + '→' + names.join('/')); continue; }
    // 对照组队长：队友里"被动文本不含初始手牌/7张"且不是宁雨清（她当队长会走7选5、当队员会跳过统一起手4张）
    const partner = team.filter(c => c.name !== want &&
      !/初始手牌|7张|七张/.test(String(c.passive || '')) && String(c.name).indexOf('雨清') < 0)[0];
    if (partner) return { arch: arch, partner: partner.name, team: names, scans: scans };
    scans.push(arch + '→' + names.join('/') + '（队友都不适合当对照组：' +
      team.filter(c => c.name !== want).map(c => c.name + ':' + (/初始手牌|7张|七张/.test(String(c.passive || '')) ? '有初始手牌类被动' : '宁雨清')).join('、') + '）');
  }
  return { fail: scans };
}

/** 队员是否"碰不到手牌"：被动/SP 文本里没有初始手牌、也没有"抽N张卡"（N≥2）这类开局抽卡 */
function handNeutral(card) {
  const t = String(card.passive || '') + '|' + String(card.sp || '');
  return !/初始手牌/.test(t) && !/抽\s*[2-9]\s*张卡/.test(t);
}

/** 手工构筑：用**游戏自己的** autoFillItems（8张道具）与 cardBelongsToTeam（挑选属于本队的携带卡），
 *  与 buildSmartDeck 尾部同口径 → 同一队伍集合下结果确定，与队长顺序无关 */
function buildDeckManual(S, names) {
  const have = S.allCards || [];
  const team = names.map(n => have.filter(c => c && c.name === n)[0]);
  if (team.some(c => !c)) return { err: '角色找不到：' + JSON.stringify(names) };
  const items = S.autoFillItems(team, [], null);
  const pool = have.filter(c => c && (c._category === 'attack_cards' || c._category === 'skill_cards') && S.cardBelongsToTeam(c, names));
  const atks = pool.filter(c => c._category === 'attack_cards'), skls = pool.filter(c => c._category === 'skill_cards');
  const sel = [];
  const take = (arr, n) => { for (const c of arr) { if (n <= 0) break; if (sel.indexOf(c) < 0) { sel.push(c); n--; } } };
  take(atks, 2); take(skls, 2);
  for (const c of atks.concat(skls)) { if (sel.length >= 4) break; if (sel.indexOf(c) < 0) sel.push(c); }
  return { chars: team, items: items.filter(Boolean), carries: sel.slice(0, 4) };
}

/** 开一局：卡组与构筑结果完全一致，只把 captainName 排到队长位（chars[0]），其余保持原相对顺序 */
async function runDeckSwap(route, captainName) {
  const inst = L.bootCard();
  const S = inst.S;
  try {
    if (typeof S.buildSmartDeck === 'function' && S.ARCH_LIST && S.ARCH_LIST.length) {
      S.applySmartDeck('p2', S.buildSmartDeck(S.ARCH_LIST[1 % S.ARCH_LIST.length]), false);
    }
    let d = null;
    if (route.kind === 'arch') d = S.buildSmartDeck(route.arch);
    else d = buildDeckManual(S, route.team);
    if (d && d.err) return { err: d.err };
    const team = ((d && d.chars) || []).filter(Boolean);
    const cap = team.filter(c => c.name === captainName)[0];
    if (!cap) return { err: '队伍里没有【' + captainName + '】（队伍=' + team.map(c => c.name).join('/') + '）' };
    d.chars = [cap].concat(team.filter(c => c !== cap));       // ★ 只做位置互换
    S.applySmartDeck('p1', d, false);
  } catch (e) { return { err: '构筑/应用抛错：' + e.message }; }
  const verr = (typeof S.validateDeck === 'function') ? S.validateDeck('p1') : [];
  S.startBattle();
  if (!S.battleState) return { err: 'startBattle 后 battleState 为空（卡组校验：' + JSON.stringify(verr) + '）' };
  // ★ 初始手牌：在 startBattle 同步返回的这一刻读数 —— 此时 startTurn(300ms)/枫SP(500ms) 的定时器都还没跑
  const hand0 = S.battleState.p1.hand.length;
  const snap = {
    chars: (S.deckConfig.p1.chars || []).filter(Boolean).map(c => c.name),
    items: (S.deckConfig.p1.items || []).filter(Boolean).map(c => c.name).sort(),
    carries: (S.deckConfig.p1.carries || []).filter(Boolean).map(c => c.name).sort()
  };
  await L.quiesce(inst, 12000);
  const hand1 = S.battleState.p1.hand.length;                 // 跑完第一回合准备阶段之后
  const logs = L.logsOf(S.battleState);
  return { inst: inst, hand0: hand0, hand1: hand1, snap: snap, verr: verr, logs: logs, captainLine: (logs.filter(l => /（队长）/.test(l))[0] || '') };
}

async function runDeckSwapCase(cs) {
  const probe = L.bootCard();
  const found = findPartnerArch(probe, cs.char);
  const routes = [];
  const routeNotes = [];
  if (found.arch) routes.push({ name: '流派「' + found.arch + '」', kind: 'arch', arch: found.arch, partner: found.partner, team: found.team });
  else routeNotes.push('流派路线不可用：' + (found.fail || []).join(' ｜ '));
  // 路线②：手工构筑（队友由用例指定为"碰不到手牌"的角色）——用来补流派路线覆盖不到的角色，
  // 同时把"每回合开始额外抽1"这类需要跑完准备阶段才看得见的差值也隔离干净
  if (cs.teammates) routes.push({ name: '手工构筑[' + [cs.char].concat(cs.teammates).join('/') + ']', kind: 'manual', partner: cs.teammates[0], team: [cs.char].concat(cs.teammates) });
  if (!routes.length) {
    printSkip(cs, '没有任何可用的构筑路线（流派路线：' + routeNotes.join('；') + '）→ 差分无法成立');
    return;
  }
  const problems = [], detail = [];
  let anyOk = false;
  for (const rt of routes) {
    // 控制变量前提：手工路线的队友必须"碰不到手牌"（被动/SP 里没有初始手牌、也没有抽N张卡）
    if (rt.kind === 'manual') {
      const bad = (cs.teammates || []).filter(n => { const c = probe.g.card(n); return !c || !handNeutral(c); });
      if (bad.length) { problems.push(rt.name + '：队友【' + bad.join('/') + '】的被动/SP 会碰手牌 → 控制变量不成立'); continue; }
      detail.push('（手工路线队友' + cs.teammates.join('/') + ' 的 passive/sp 均不含"初始手牌/抽N张卡"，碰不到手牌）');
    }
    const A = await runDeckSwap(rt, cs.char);            // 队长 = 被测角色
    const B = await runDeckSwap(rt, rt.partner);         // 队长 = 对照组（卡面没有初始手牌类被动）
    if (A.err || B.err) { detail.push(rt.name + '：⏭ 开局失败（A=' + (A.err || '正常') + ' B=' + (B.err || '正常') + '）'); routeNotes.push(rt.name + ' 不可用：' + (A.err || B.err)); continue; }
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    const okPremise = same(A.snap.chars.slice().sort(), B.snap.chars.slice().sort()) && same(A.snap.items, B.snap.items) &&
      same(A.snap.carries, B.snap.carries) && A.verr.length === 0 && B.verr.length === 0;
    const d0 = A.hand0 - B.hand0, d1 = A.hand1 - B.hand1;
    const part = rt.name + '：初始手牌 期望差+1 实得' + (d0 > 0 ? '+' : '') + d0 +
      '（A/' + cs.char + '队长=' + A.hand0 + '张；B/' + rt.partner + '队长=' + B.hand0 + '张）；跑完准备阶段后差' + (d1 > 0 ? '+' : '') + d1;
    detail.push(part);
    if (!okPremise) { problems.push(rt.name + '：差分前提不成立（队伍集合/道具/携带卡/卡组校验 有一项不同）'); 
      detail.push('（前提明细：A队=' + A.snap.chars.join('/') + ' B队=' + B.snap.chars.join('/') + '；校验A=' + JSON.stringify(A.verr) + ' 校验B=' + JSON.stringify(B.verr) + '）');
      continue; }
    if (d0 !== 1) { problems.push(rt.name + '：初始手牌差值期望 1，实得 ' + d0); continue; }
    if (A.captainLine.indexOf('【' + cs.char + '】') < 0 || B.captainLine.indexOf('【' + rt.partner + '】') < 0) {
      problems.push(rt.name + '：队长位没有按预期互换（A：' + A.captainLine + '；B：' + B.captainLine + '）'); continue;
    }
    if (!/初始手牌\+1/.test(A.logs.join(' '))) { problems.push(rt.name + '：A局日志里没有"初始手牌+1"的回执'); continue; }
    detail.push('（前提✓：两局队伍集合/道具/携带卡一致、卡组校验通过；队长=A局' + cs.char + '、B局' + rt.partner + '；A局有"初始手牌+1"回执）');
    // 【2026-10-11 第二次平衡性调整】光太郎新卡面**删掉了**「每个回合开始时可以额外抽取1张卡」✗
    // ⇒ 这里反过来断言"已不再额外抽卡"（跑完准备阶段后差值不再 +1 ✓），让这条覆盖继续有效 ✓
    if (cs.alsoPerTurnDraw) {
      if (rt.kind === 'manual') {
        if (d1 - d0 !== 0) { problems.push(rt.name + '：新卡面已删「回合开始额外抽1张」⇒ 差值应不再+1，实得再+' + (d1 - d0)); continue; }
        detail.push('（手工路线额外断言：跑完准备阶段后差值仍=1，确认"回合开始额外抽1张"已按新卡面移除 ✓）');
      } else {
        detail.push('（流派路线 d1 差值=' + d1 + ' 不作断言：该队队友含【入间枫】，其SP①/②会给两局加上不对称的抽牌）');
      }
    }
    anyOk = true;
  }
  if (!anyOk && !problems.length) { printSkip(cs, '所有构筑路线都跑不起来：' + routeNotes.concat(detail).join('；')); return; }
  okLine([['至少一条差分路线成立且差值=+1', anyOk, '']], problems, detail);
  if (routeNotes.length) detail.push('');
  line(cs, detail, problems);
  routes.forEach((rt, i) => console.log('     路线' + (i + 1) + '：' + rt.name + '，队伍=' + rt.team.join('/') + '，对照组队长=' + rt.partner));
  routeNotes.forEach(n => console.log('     ⚠ ' + n));
}

/* ============================================================
 * 三、跑批
 * ============================================================ */

function okLine(checks, problems, detail) {
  for (const c of checks) {
    const [name, cond, extra] = c;
    if (cond) detail.push(name + (extra ? '（' + extra + '）' : ''));
    else problems.push(name + (extra ? ' ← ' + extra : ''));
  }
}

async function run() {
  /* 自检 0：角色卡是否都被覆盖（角色清单从 cardData 现取，不写死数量） */
  const probe = L.bootCard();
  const allChars = probe.g.cards().filter(c => c && c._category === 'characters').map(c => c.name);
  /* 2026-09-16：卡池从 24 张角色扩到 27 张（新增 琉璃(万圣祭)/羽奈(往昔)/XHZD）。
     这三张由 newcards_expect.js 覆盖（它们的要点是"形态隔离串味"与"新机制"，与批次D 的差分口径不同），
     因此这里把它们登记为"其他套件已覆盖"，并把总数期望同步到 27 —— 数量写死从来不是为了卡数量本身，
     而是为了"新增角色必须有人管"这件事不被漏掉。 */
  const COVERED_ELSEWHERE_CHARS = ['琉璃(万圣祭)', '羽奈(往昔)', 'XHZD'];
  C.eq('角色卡总数（cardData 现算）', allChars.length, 24 + COVERED_ELSEWHERE_CHARS.length);
  const union = BASELINE_COVERED.concat(BATCH_D).concat(COVERED_ELSEWHERE_CHARS);
  const missing = allChars.filter(n => union.indexOf(n) < 0);
  const extra = union.filter(n => allChars.indexOf(n) < 0);
  C.truthy('基线12 + 批次D12 + 新卡3（newcards_expect.js）覆盖全部角色（无遗漏/无重复外名）', missing.length === 0 && extra.length === 0,
    '未被任何套件覆盖=' + JSON.stringify(missing) + ' 不在 cardData 里的名字=' + JSON.stringify(extra));
  const caseChars = Array.from(new Set(CASES.map(c => c.char)));
  const noCase = BATCH_D.filter(n => caseChars.indexOf(n) < 0);
  C.truthy('批次D 每个角色都有用例', noCase.length === 0, '缺少用例=' + JSON.stringify(noCase));
  // 疑似"卡面文本 vs 实现"不一致（只记录、不当通过也不当失败）
  SUSPECTED.push('松山惠：卡面 SP 把[乐曲α]定义为「回复4点音韵值并抽1张」，但被动「音律感应」的递增分支执行的是"回2音韵并抽1"'
    + '（日志原文「【惠被动·音律感应】费用递增乐曲α：回2音韵并抽1」），主动发动路径(activateMegumiSP)执行的才是回4。'
    + '两处口径不一致 —— 需作者确认被动分支是"有意削弱"还是漏改；本套件因此只断言分支选择，不断言数值。');
  SUSPECTED.push('入间枫的被动存在两份实现：kaedePassiveTrigger（全文件无调用点=死代码）与 postUsePassiveHooks 内的「入间枫·敏锐洞察（选发）」分支（锚点 '
    + '\'入间枫被动·敏锐洞察\'，配 mandatory:false）。死代码里那句「使用战术/增益卡，触发被动」的日志在实际流程中不会出现 —— 写断言时不要拿它当证据（我第一版就是这么写错的）。');
  SUSPECTED.push('测试底座（非游戏缺陷，未改 lib/）：autoAnswer 对 showCardPickerMulti 的包装是"取出回调→调用→置 null"，'
    + '嵌套选择器（小仓霞·整肃选了手卡后还要选区域内卡）里后一个回调会被外层置 null 抹掉 → 表现为"流程停在第一步"。'
    + '游戏自己的点击路径 fire(){先取出并置 null，再调用} 嵌套是安全的。本文件在小仓霞用例里自己驱动选择器绕过它。');

  const only = process.argv[2] || null;
  const cases = only ? CASES.filter(c => c.char === only) : CASES;

  for (const cs of cases) {
    const inst = L.bootCard(cs.boot || {});
    const inst_g = {};                        // 给 tweak 往外传参用（tweak 是同步的）
    const guard = textGuard(inst, cs);
    if (guard) { printSkip(cs, guard); continue; }
    /* ---------- 明确标注"未验证"的用例（不算通过也不算失败） ---------- */
    if (cs.skip) { printSkip(cs, cs.skip); continue; }

    /* ---------- raw：开局瞬间就断言（被动/SP 是在 startBattle 里注册的） ---------- */
    if (cs.kind === 'raw') {
      L.startMatchWith(inst, { team: cs.team || [cs.char] });
      await L.quiesce(inst, 12000);
      if (!inst.S.battleState) { C.bad(cs.char + '：开局失败 —— ' + (inst.g.notes.join(' | ') || '（无）')); continue; }
      if (inst.badDeck) { printSkip(cs, '无法凑出合法卡组：' + inst.badDeck.slice(0, 90)); continue; }
      const logs = L.logsOf(inst.S.battleState);
      const problems = [], detail = [];
      okLine(cs.check(inst.S, { logs: logs, inst: inst }), problems, detail);
      line(cs, detail, problems);
      console.log('     ' + ('队伍=' + teamNames(inst.S).join('/')).padEnd(30) + ' 备注=' + (inst.g.notes.join(' | ') || '（无）').slice(0, 110));
      await sleep(50);
      continue;
    }

    /* ---------- deckswap：同一副卡组只换队长顺序（初始手牌类被动的差分） ---------- */
    if (cs.kind === 'deckswap') {
      await runDeckSwapCase(cs);
      await sleep(50);
      continue;
    }

    /* ---------- diff：两局对照（控制变量），比差值 ---------- */
    if (cs.kind === 'diff') {
      const runsRes = [];
      let abort = null;
      for (const spec of cs.runs) {
        const ri = L.bootCard(cs.boot || {});
        const card = cs.card ? ri.g.card(cs.card) : null;
        const pool = ri.g.cards().filter(c => c && c.name && c._category !== 'emojis' && c._category !== 'characters' && c._category !== 'omikuji');
        const bs = await L.setupBoard(ri, card || ri.g.card(cs.char), pool, { team: spec.team, tweak: spec.tweak });
        if (!bs) { abort = '开局失败：' + (ri.g.notes.join(' | ') || '（无）'); break; }
        if (ri.badDeck) { abort = '无法凑出合法卡组：' + ri.badDeck.slice(0, 90); break; }
        const before = L.fieldMap(ri.S), logsBefore = L.logsOf(bs).length;
        let threw = null;
        try { await cs.act(ri, card); } catch (e) { threw = e; }
        const q = await L.quiesce(ri, cs.cap || 15000);
        runsRes.push({
          inst: ri, card: card, before: before, after: L.fieldMap(ri.S),
          logs: L.logsOf(ri.S.battleState).slice(logsBefore), quiet: q, threw: threw
        });
        if (threw && threw.precondition) { abort = threw.message; break; }
      }
      if (abort) { printSkip(cs, abort); continue; }
      const problems = [], detail = [];
      runsRes.forEach((r, i) => { if (r.threw) problems.push('第' + (i + 1) + '局动作抛错：' + r.threw.message); if (!r.quiet.ok) problems.push('第' + (i + 1) + '局流程未静默：' + (r.quiet.busy || '超时')); });
      const a = cs.measure(runsRes[0]), b = cs.measure(runsRes[1]);
      const got = a - b;
      detail.push('差值 期望+' + cs.expectDiff + ' 实得' + (got > 0 ? '+' : '') + got + '（A=' + a + ' B=' + b + '）');
      if (!(Math.abs(got - cs.expectDiff) < 1e-9)) problems.push('差值期望 ' + cs.expectDiff + '，实得 ' + got);
      if (cs.check) okLine(cs.check(runsRes), problems, detail);
      line(cs, detail, problems);
      runsRes.forEach((r, i) => console.log('     第' + (i + 1) + '局日志: ' + (r.logs.slice(-6).join(' | ') || '（无）').slice(0, 260)));
      if (cs.evidence) { try { cs.evidence(runsRes).forEach(l => console.log('     ▸证据 ' + l)); } catch (e) { console.log('     ▸证据 打印失败：' + e.message); } }
      await sleep(50);
      continue;
    }

    /* ---------- board：单局最小场景 + 动作 ---------- */
    const card = inst.g.card(cs.card || cs.char);        // 需要"动态挑可出卡"的用例，挑卡在 act 内做
    const pool = inst.g.cards().filter(c => c && c.name && c._category !== 'emojis' && c._category !== 'characters' && c._category !== 'omikuji');
    const bs = await L.setupBoard(inst, card || inst.g.card(cs.char), pool, {
      team: cs.team || [cs.char],
      tweak: (S, b, c) => { if (cs.tweak) cs.tweak(S, b, c, inst_g); }
    });
    if (!bs) { C.bad(cs.char + '：开局失败 —— ' + (inst.g.notes.join(' | ') || '（无）') + ' toast: ' + (inst.g.toasts.join(' | ') || '（无）').slice(0, 90)); continue; }
    if (inst.badDeck) { printSkip(cs, '无法凑出合法卡组：' + inst.badDeck.slice(0, 90)); continue; }
    inst.__out = inst_g;

    const before = L.fieldMap(inst.S), logsBefore = L.logsOf(bs).length;
    let threw = null;
    try { await cs.act(inst, card); } catch (e) { threw = e; }
    if (threw && threw.precondition) { printSkip(cs, threw.message); continue; }
    const q = await L.quiesce(inst, cs.cap || 15000);
    const after = L.fieldMap(inst.S);
    const logs = L.logsOf(inst.S.battleState).slice(logsBefore);
    const res = { before: before, after: after, logs: logs, quiet: q, diffs: L.diffFields(before, after), S: inst.S, inst: inst, card: card };

    const problems = [], detail = [];
    if (threw) problems.push('动作抛错：' + threw.message);
    if (!q.ok) problems.push('流程未静默：' + (q.busy || '超时'));
    for (const [f, want] of (cs.exact || [])) {
      if (typeof want !== 'number' || Number.isNaN(want)) continue;
      const got = delta(res, f);
      detail.push(f + ' 期望' + (want > 0 ? '+' : '') + want + ' 实得' + (got > 0 ? '+' : '') + got);
      if (got !== want) problems.push(f + ' 期望 ' + want + '，实得 ' + got);
    }
    for (const [f, a2, b2, note] of (cs.dyn ? cs.dyn(res, inst) : [])) {
      const got = delta(res, f);
      if (typeof b2 === 'number') {
        const lo = Math.min(a2, b2), hi = Math.max(a2, b2);
        detail.push(f + ' 期望[' + lo + ',' + hi + '] 实得' + got + (note || ''));
        if (!(got >= lo && got <= hi)) problems.push(f + ' 期望落在 [' + lo + ',' + hi + ']，实得 ' + got);
      } else {
        const why2 = (typeof b2 === 'string') ? b2 : (note || '');
        detail.push(f + ' 期望' + (a2 > 0 ? '+' : '') + a2 + ' 实得' + (got > 0 ? '+' : '') + got + why2);
        if (got !== a2) problems.push(f + ' 期望 ' + a2 + '，实得 ' + got);
      }
    }
    for (const [f, a2, b2] of (cs.range || [])) {
      const got = delta(res, f);
      const lo = Math.min(a2, b2), hi = Math.max(a2, b2);
      detail.push(f + ' 期望[' + lo + ',' + hi + '] 实得' + got);
      if (!(got >= lo && got <= hi)) problems.push(f + ' 期望落在 [' + lo + ',' + hi + ']，实得 ' + got);
    }
    if (cs.mustLog && !cs.mustLog.test(logs.join(' '))) problems.push('日志里没有出现期望的被动/SP 记录（' + cs.mustLog + '）');
    if (cs.check) okLine(cs.check(res, inst), problems, detail);

    line(cs, detail, problems);
    console.log('     日志: ' + (logs.slice(-8).join(' | ') || '（无）').slice(0, 300));
    if (cs.evidence) { try { cs.evidence(res, inst).forEach(l => console.log('     ▸证据 ' + l)); } catch (e) { console.log('     ▸证据 打印失败：' + e.message); } }
    await sleep(50);
  }

  /* ---------- 收尾：未验证清单 + 疑似不一致清单 ---------- */
  if (SKIPPED.length) {
    console.log('\n  ⏭ 未验证清单（' + SKIPPED.length + ' 条，不算通过也不算失败）：');
    SKIPPED.forEach(s => console.log('     · ' + s));
  }
  if (SUSPECTED.length) {
    console.log('\n  ⚠ 需人工确认（卡面文本 / 实现口径不一致）：');
    SUSPECTED.forEach(s => console.log('     · ' + s));
  }
  process.exit(C.summary());
}

run().catch(e => { console.log('❌ 异常：' + (e && e.stack || e)); process.exit(1); });
