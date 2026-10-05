/* assets/engine.js —— 由 game.html 的代码**原样外移**而成（只搬位置，函数体/变量名一字未改）
   导出：文件末尾用 window.<name> 挂回全局，供 game.html 内联代码继续直接使用。 */
var __CN = { '一': 1, '两': 2, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };

function __toNum(s) { if (s == null) return null; if (/^\d+$/.test(s)) return parseInt(s, 10); return (__CN[s] != null ? __CN[s] : null); }

function __matchNum(re, t) { var m = t.match(re); return m ? __toNum(m[1]) : null; }

var __NUM = '([0-9]+|[一二两三四五六七八九十])';

function __hasComplexMechanic(t) {
  return false;
}

function __looksActionable(t) {
  return /造成|造\d|给予|伤害|回复|回\s*\d|扣除|失去|获得|得到|抽取?|前进|后退|移动|跃向|选[^。；]{0,8}(一张|一张卡|\d\s*张)|破坏|送入墓地|送墓|献祭|投掷|掷骰|面骰判定|驱散|抵消|降低|提升|增加|减少|付\d|支付\s*\d|追加|打断|改变|打落|回收|放回|洗(牌|切)|升级|金币|护盾|防御|入迷|音韵|同步值?|攻击力|位移/.test(t);
}

function __parseSources(t) { var s = []; if (/牌组|卡组|牌库/.test(t)) s.push('deck'); if (/墓地/.test(t)) s.push('grave'); if (/移出游戏|移出区|被移出/.test(t)) s.push('removed'); return s; }

function __parseTags(t) { return (t.match(/\[[^\]]+\]/g) || []).map(function (x) { return x.slice(1, -1); }); }

function __parseCats(t) { var c = []; if (/攻击卡/.test(t)) c.push('attack_cards'); if (/技能卡/.test(t)) c.push('skill_cards'); if (/单次种类|单次卡|道具/.test(t)) c.push('item_single'); if (/永续/.test(t)) c.push('item_permanent'); return c; }

function __opAnchors(op) {
  switch (op.op) {
    case 'damage': case 'damage_multi': case 'damage_by_removed': case 'pay_n_deal_n': return ['造成','给予','伤害'];
    case 'heal_sync': case 'regen_sync': return ['回复','恢复'];
    case 'loss_sync': case 'self_alt_sync': return ['扣除','失去'];
    case 'gain_cost': return [/回\s*\d+\s*点?音韵/, '回复音韵', '回音韵', '音韵值', '回费', '获得音韵'];
    case 'lose_cost': return [/失(?:去)?\s*\d+\s*点?音韵/, '失去音韵', '扣除音韵'];
    case 'draw': return ['抽'];
    case 'draw_gift': return ['馈赠'];
    case 'draw_omikuji': return ['御神签'];
    case 'move': case 'move_range': case 'move_choice': case 'move_pay_extra': case 'move_by_roll': case 'move_to_player': case 'move_to_tile': case 'buff_double_move': case 'buff_bonus_move_after': case 'adjust_next_move': case 'adjust_next_move_all': case 'fix_next_move': return ['前进','后退','移动','跃','位移'];
    case 'search': case 'return_all_deck': case 'recycle_last': return ['加入手卡','加入手牌','回收','检索','放回','选'];
    case 'discard': case 'sacrifice_now': return ['送入墓地','送墓','献祭','送入墓'];
    case 'gain_shield': case 'break_shield': return ['护盾'];
    case 'def_down': return ['降低','减']; case 'def_up': return ['提升','增加防御'];
    case 'attack_buff': return ['攻击力'];
    case 'gain_core': return ['引导核心'];
    case 'gain_motivation': return ['激励'];
    case 'overload': return ['过载'];
    case 'gain_gold': return ['金币','＄','$'];
    case 'judge_branch': return ['面骰判定','判定'];
    case 'gain_cost_if_last_match': return ['同色','同费'];
    case 'cleanse': return ['驱散','净化'];
    case 'prevent_next_damage': return ['抵消'];
    case 'change_direction': return ['颠倒','反向','反转'];
    case 'modify_dice': case 'set_dice_sides': return ['骰子','骰'];
    case 'interrupt_move': return ['打断'];
    case 'register_mechanic': return ['领域','决斗','路障','蓝图'];
    default: return null;
  }
}

function __orderOps(t, ops) {
  var cursor = {};
  function posOf(op, stableIdx) {
    var ks = __opAnchors(op); if (!ks) return 1e9 + stableIdx;
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i], idx = -1;
      if (k instanceof RegExp) { var m = k.exec(t); idx = m ? m.index : -1; } // 正则锚点：回N音韵/失N音韵
      else { var from = cursor[op.op + '|' + k] || 0; idx = t.indexOf(k, from); if (idx >= 0) cursor[op.op + '|' + k] = idx + 1; }
      if (idx >= 0) return idx;
    }
    return 1e9 + stableIdx;
  }
  var tagged = ops.map(function (o, i) { return { i: i, p: posOf(o, i) }; });
  tagged.sort(function (a, b) { return a.p - b.p || a.i - b.i; });
  return tagged.map(function (x) { return ops[x.i]; });
}

function __compileBody(t) {
  if (!t) return null;
  if (__hasComplexMechanic(t)) return null;
  if (/泳圈|飞行/.test(t) && !/飞掷一个|最远(?:可以)?飞行/.test(t)) return []; // 泳圈命中/销毁/续飞等描述由 swim_ring 统一处理
  if (/领域内|领域范围内|新领域覆盖|新获得的领域|领域效果会覆盖|友方单位(获得|可以获得)|路障放置|路障不会消失|被路障阻止|移动路径经过/.test(t) && !/展开[^。；]*?前后\s*\d+\s*格的?领域/.test(t)) return []; // 领域/路障规则说明由 register_mechanic 统一登记（展开句本身保留）
  var ops = [], uncovered = [];
  function has(w) { return t.indexOf(w) >= 0; }

  // C16 人格修正拳类“命中且造成N点以上伤害后可以(随机)打落”：前段照常编译造伤，打落编成“条件(本次实际伤害≥N)+可选”，
  // 不再无条件打落、也不再把条件里的“N点”误当基础伤害
  var __knockCondM = t.match(/命中且造成\s*([0-9]+|[一二两三四五六七八九十])\s*点以上伤害后可以(?:随机)?打落其[^。；;]*/);
  if (__knockCondM) {
    var __kcMin = __toNum(__knockCondM[1]) || 4;
    var __kcRest = (t.slice(0, __knockCondM.index) + t.slice(__knockCondM.index + __knockCondM[0].length)).replace(/[，,、\s]+$/, '');
    if (__kcRest) {
      var __kcFront = __compileBody(__kcRest);
      if (__kcFront === null) return null; // 前段无法精确编译：整句回退文本引擎，避免“假伤害/无条件打落”
      if (__kcFront.length) {
        __kcFront.push({ op: 'optional', cond: { lastDmgGe: __kcMin }, label: '随机打落其一张手卡（送墓并失去3音韵）', inner: [{ op: 'knock_off', loseCost: 3 }] });
        return __kcFront;
      }
    }
  }

  // 伤害：需真正造伤（造成/给予/判定伤害）；抵消、暴击伤害、威胁献祭、下次附带均不在此处理
  var __threatHit = /除非将一张/.test(t), __nextJudgeHit = /下一次造伤害附带/.test(t);
  if (has('伤害') && !/等额|与支付音韵相同数值|抵消/.test(t) && !__threatHit && !__nextJudgeHit &&
      /造成?\s*[0-9一二两三四五六七八九十]|给予|判定伤害(?!\s*[-+])|被移出游戏的卡数量|足以击碎|多段|\d\s*段伤害/.test(t)) {
    var judge = has('判定伤害'), dice = null;
    if (judge) {
      if (has('硬币') || has('正反面')) dice = 'coin';
      else if (has('4面骰') || has('四面骰')) dice = 'd4';
      else if (has('6面骰') || has('六面骰')) dice = 'd6';
      else if (has('20面骰')) dice = 'd20';
      else dice = 'fixed'; // 无骰种的“X点判定伤害”=固定值，不掷骰
    }
    // C31 数字误捕：伤害值不得紧跟 次/枚/名/张/面/骰 等量词（"造成一次四面骰判定伤害"不取"一"，"造成4点以上"句式不取4当基础伤害）
    var n = __matchNum(new RegExp('(?:造(?:成)?|给予)\\s*(?:其|一名(?:其他)?玩家|目标)?\\s*' + __NUM + '(?!\\s*[次枚名张面骰])'), t); // 目标写法要容得下「一名其他玩家」——卡面普遍用这个限定词，放不下会把伤害数值读丢（实测：风纪委员臂章会由 damage 退化成 null）
    var kind = has('无序') ? '无序' : (has('理智') ? 'sanity' : (has('热忱') ? 'fervor' : (has('混沌') ? '混沌' : null))); // C25 无序/混沌不再折叠为同一 'chaos' 键
    if (/多段|(\d)\s*段伤害/.test(t)) {
      var hits = [];
      var hm = t.match(new RegExp(__NUM + '点判定伤害')); if (hm) { var __hd = (has('硬币') || has('正反面')) ? 'coin' : (has('4面骰') || has('四面骰')) ? 'd4' : (has('6面骰') || has('六面骰')) ? 'd6' : has('20面骰') ? 'd20' : 'fixed'; hits.push({ judge: true, dice: __hd, base: __toNum(hm[1]) }); }
      var sm2 = t.match(new RegExp(__NUM + '点理智(?:属性)?伤害')); if (sm2) hits.push({ judge: false, base: __toNum(sm2[1]), kind: 'sanity' });
      var cm2 = t.match(new RegExp(__NUM + '点(?:无序|热忱|混沌)(?:属性)?伤害')); if (cm2) hits.push({ judge: false, base: __toNum(cm2[1]) });
      if (hits.length) { var __mop = { op: 'damage_multi', hits: hits }; var __maoe = t.match(/(前方|后方|前后|周围)?\s*(\d+)\s*格范围?内[^。；]{0,14}?(?:所有|全部|每|各)[^。；]{0,6}玩家/); if (__maoe) __mop.aoe = { dir: (__maoe[1] || 'around'), range: +__maoe[2] }; ops.push(__mop); } else uncovered.push('multi'); // C18 清凉时间等多段伤害同样保留 AoE/范围
    } else if (/被移出游戏的卡数量/.test(t)) {
      var plus = __matchNum(new RegExp('相同数值\\+\\s*' + __NUM), t) || 0;
      ops.push({ op: 'damage_by_removed', plus: plus, kind: kind });
    } else if (/足以击碎[^。；]*护盾/.test(t)) {
      ops.push({ op: 'break_shield' });
    } else {
      var __aoeM = t.match(/(前方|后方|前后|周围)?\s*(\d+)\s*格范围?内[^。；]{0,14}?(?:所有|全部|每|各)[^。；]{0,6}玩家/);
      var __rowAoe = /同一行|同行/.test(t) && /(?:所有|全部|每|各)[^。；]{0,6}玩家/.test(t);
      var __aoe = __aoeM ? { dir: (__aoeM[1] || 'around'), range: +__aoeM[2] } : (__rowAoe ? { dir: 'row', range: 21 } : null);
      // C17 单目标距离限定：“对(和)自身(处于)同一个格子/前后N格(范围|以内|内)/同一行内的一名玩家造成…”→ damage 挂 range，执行时校验（不再射程外照打）
      var __sameTile = /(?:和自身)?处于?同一个格子/.test(t);
      var __tgtRm = t.match(/(前后|前方|后方|周围)\s*(\d+)\s*格(?:范围|以内|内)/);
      // 单目标“同一行”造伤（秘技摸头杀/该结束了等特殊范围卡已不做发动时射程要求，结算时仍须同行才命中）
      var __sameRowTgt = /(?:对)?同一行[^。；;]{0,12}?(?:的)?[^。；;]{0,6}玩家/.test(t) && !/(?:所有|全部|每|各)[^。；;]{0,6}玩家/.test(t);
      var __tgtRange = __sameTile ? { dir: '前后', range: 0 } : (__sameRowTgt ? { dir: 'row', range: 21 } : (__tgtRm ? { dir: __tgtRm[1], range: +__tgtRm[2] } : null));
      var __pbN = __matchNum(new RegExp('击退\\s*' + __NUM + '\\s*格'), t);
      var __mkDmg = function (judgeDmg) {
        var d = judgeDmg ? { op: 'damage', judge: true, dice: dice, base: (n == null ? 2 : n), kind: kind }
                         : { op: 'damage', judge: false, base: n, kind: kind };
        // 「对自己造成N点X属性伤害」（贪欲者的烙印）：承受者=使用者本人。
        // 旧编译把整段一律落到 ctx.target（默认对手）——编译"成功"但语义反转，属静默错误，故在此显式标注。
        if (/对自己造成|对自身造成/.test(t)) d.targetWho = 'self';
        if (__aoe) d.aoe = __aoe;
        else if (__tgtRange) d.range = __tgtRange;
        if (!__aoe && __pbN != null) d.pushN = __pbN; // 击退（风纪飞踢）：造伤执行后把目标推送N格，到达格不触发格子效果（见SP口径）
        ops.push(d);
      };
      if (judge && dice) __mkDmg(true);
      else if (!judge && n != null) __mkDmg(false);
      else uncovered.push('damage');
    }
  }

  // 同步
  var __preDmgSync = new RegExp('下次造成伤害前[^。；]*扣除目标\\s*' + __NUM + '\\s*点同步').test(t);
  if (has('同步')) {
    var hm = __matchNum(new RegExp('(?:回复|回)\\s*(?:自身|自己|其|目标|一名玩家)?\\s*' + __NUM + '\\s*点?\\s*(?:同步值?|生命值?|血量)'), t);
    var lm = __matchNum(new RegExp('(?:扣除|扣|失去|失)\\s*(?:其|目标|对方|自身|自己)?\\s*' + __NUM + '\\s*点?\\s*同步'), t);
    // 「每回合回复N点同步值（持续M回合）」是**持续效果**（由 regen_sync 处理）：
    // 不能再被"立即回复"规则抓一次，否则同一句既当场回 N 点、又挂上持续回复
    // （实测【闲暇时光】"立即回复4点"变成了回6点，就是这里重复计了一次）
    var __isRegenClause = /每回合[^。；]{0,8}(?:回复|回)/.test(t) || /持续\s*\d+\s*回合/.test(t);
    if (/回\s*\/\s*扣/.test(t)) { var an = __matchNum(new RegExp('扣自身\\s*' + __NUM), t) || 2; ops.push({ op: 'self_alt_sync', amount: an }); }
    else if (hm != null && !__isRegenClause) ops.push({ op: 'heal_sync', amount: hm });
    else if (lm != null && !__preDmgSync) ops.push({ op: 'loss_sync', amount: lm, targetWho: (has('自身') || has('自己')) ? 'self' : 'target' });
    else if (!__preDmgSync && !__isRegenClause && new RegExp('(?:回复|回|扣除|扣|失去)\\s*(?:自身|自己|其|目标|一名玩家)?\\s*' + __NUM + '?\\s*点?\\s*同步').test(t)) uncovered.push('sync');
  }

  // 音韵
  if (has('音韵')) {
    var cm = __matchNum(new RegExp('(?:回复|回)\\s*(?:自身|自己|其|目标)?\\s*' + __NUM + '\\s*点?音韵'), t);
    var lc = __matchNum(new RegExp('(?:失去|和|与|、)\\s*(?:其|目标|自身|自己)?\\s*' + __NUM + '\\s*点?音韵'), t);
    var pay = t.match(/付\s*(\d+)\s*[-–~至到]\s*(\d+)\s*音韵/);
    if (cm != null) ops.push({ op: 'gain_cost', amount: cm });
    if (lc != null) ops.push({ op: 'lose_cost', amount: lc });
    if (pay) {
      // 红宝之杖·运等“付N-M音韵造等额伤害”：伤害属性随文本，增伤/克制统一走伤害公式
      var __pkind = has('无序') ? '无序' : (has('理智') ? 'sanity' : (has('热忱') ? 'fervor' : (has('混沌') ? '混沌' : null)));
      ops.push({ op: 'pay_n_deal_n', min: +pay[1], max: +pay[2], kind: __pkind });
    }
    if (cm == null && lc == null && !pay && /(?:回复|回|失去)[^。；;\n]{0,12}音韵/.test(t)) uncovered.push('cost');
  }

  if (has('护盾')) {
    var sm = __matchNum(new RegExp('(?:获得|回复|增加)\\s*' + __NUM + '\\s*点?护盾'), t);
    if (sm != null) ops.push({ op: 'gain_shield', amount: sm });
    else if (has('获得') || has('回复') || has('增加')) uncovered.push('shield');
  }
  if (has('防御')) {
    var dd = __matchNum(new RegExp('降低(?:其|目标)?\\s*' + __NUM + '\\s*点防御'), t);
    var du = __matchNum(new RegExp('提升(?:自身)?\\s*' + __NUM + '\\s*点防御'), t);
    if (dd != null) ops.push({ op: 'def_down', amount: dd }); else if (du != null) ops.push({ op: 'def_up', amount: du }); else uncovered.push('defense');
  }
  // 下一次攻击无视N点护盾（如“你呀你呀”）
  var __pierceM = __matchNum(new RegExp('下一次(?:的)?攻击[^。；;]{0,8}?无视\\s*' + __NUM + '\\s*点?护盾'), t);
  if (__pierceM != null) ops.push({ op: 'next_attack_pierce', amount: __pierceM });
  if (has('抽')) {
    var __isLvSeg = /^Lv\d+追加/.test(t.replace(/^\s*/, '')); // 纯 Lv 追加句的抽牌已由 ifLevel 专用指令处理，不走通用抽牌
    if (has('馈赠')) ops.push({ op: 'draw_gift' });
    else if (has('御神签')) ops.push({ op: 'draw_omikuji' });
    else if (!has('乐谱') && !has('事件') && !__isLvSeg) { var dn = __matchNum(new RegExp('抽\\s*' + __NUM), t); var __pickDraw = /【选玩家抽】/.test(t); ops.push({ op: 'draw', n: (dn == null ? 1 : dn), who: __pickDraw ? 'pick_player' : undefined }); }
  }
  if (has('入迷')) {
    var fm = __matchNum(new RegExp('(?:降低|回复|恢复|减少)[\\s\\S]{0,10}?' + __NUM + '\\s*点?入迷'), t);
    if (fm == null) fm = __matchNum(new RegExp('(' + __NUM + ')\\s*点?入迷'), t); // 兜底取“入迷”前点数（跳过“N名玩家”）
    if (fm != null) ops.push({ op: 'reduce_fascination', amount: fm });
    // 无量化入迷（如“降低了入迷值的玩家依次移动”仅作定语）不当作未识别效果阻断
  }

  // 移动
  // “前进/后退N-M格”（风纪飞踢/四叶草发卡SP等）：先选方向再选格数(both)；区间移动（前进3-6格 / 移动2~4格）：闭区间选格数
  var __bothR = t.match(/(?:前进|后退|向前|向后)\s*[/／]\s*(?:前进|后退|向前|向后)\s*(\d+)\s*[-–—~～]\s*(\d+)\s*格/);
  var __rangeM = __bothR ? null : t.match(/(前进|后退|向前[^^。；，]{0,4}|向后[^^。；，]{0,4}|移动)\s*(\d+)\s*[-–—~～]\s*(\d+)\s*格/);
  if (__bothR) { ops.push({ op: 'move_range', min: +__bothR[1], max: +__bothR[2], both: true }); }
  else if (__rangeM) { var __rb = /后退|向后/.test(__rangeM[1]); ops.push({ op: 'move_range', min: +__rangeM[2], max: +__rangeM[3], dir: __rb ? -1 : 1 }); }
  var dirStep = __matchNum(new RegExp('前进\\s*[/／]\\s*后退\\s*' + __NUM + '\\s*格'), t);
  var __payMoveM = t.match(/可额外[^。；;]*?每额外[^。；;]*?(\d+)\s*音韵[^。；;]*?[+＋]\s*(\d+)\s*格/);
  var __payMoveHandled = false;
  if (__payMoveM && dirStep != null) { ops.push({ op: 'move_pay_extra', base: dirStep, perCost: +__payMoveM[1], perStep: +__payMoveM[2] }); __payMoveHandled = true; }
  else if (dirStep != null) ops.push({ op: 'move_choice', steps: dirStep });
  if (/位移量?\s*[x×]\s*2/.test(t)) ops.push({ op: 'buff_double_move' });
  var bm = __matchNum(new RegExp('追加\\s*' + __NUM + '\\s*格'), t);
  if (has('追加') && bm != null && has('移动')) ops.push({ op: 'buff_bonus_move_after', amount: bm });
  if (/移动到[^。；]*(一名其他玩家|玩家所在)/.test(t)) ops.push({ op: 'move_to_player' });
  else if (/跃向对行|对行相同位置/.test(t)) ops.push({ op: 'move_to_tile', kind: 'opposite' });
  else if (/瞬移至?最近的[\s\S]{0,6}交互格/.test(t)) ops.push({ op: 'move_to_tile', kind: 'nearest_interactive' });
  else if (/移动至?[\s\S]{0,8}[「『“"]?\s*Game\s*[」』”"]?\s*格/i.test(t)) ops.push({ op: 'move_to_tile', kind: 'game' });
  else if (/移动至?当前回合玩家所在行的任意交互格|任意一?格|地图任意一?格/.test(t)) ops.push({ op: 'move_to_tile', kind: 'any' });
  var adj = __matchNum(new RegExp('位移(?:量增减|效果|量)\\s*' + __NUM + '\\s*格?'), t);
  if (adj == null) { var __sig = t.match(/位移(?:效果|量)?\s*([+-]\d+)/); if (__sig) adj = +__sig[1]; }
  if (adj != null) ops.push({ op: /所有玩家|全体/.test(t) ? 'adjust_next_move_all' : 'adjust_next_move', delta: adj });
  var fixm = t.match(/位移量固定为\s*(\d+)/); if (fixm) ops.push({ op: 'fix_next_move', n: +fixm[1] });
  if (/改变[^。；]*下一次移动的方向/.test(t)) ops.push({ op: 'change_direction' });
  var direct = !__payMoveHandled && !__bothR && !__rangeM && dirStep == null && (has('前进') || has('后退') || /向前|向后/.test(t) || new RegExp('移动\\s*' + __NUM + '\\s*格').test(t)) &&
    !has('位移量') && !has('移动动作') && !has('下次移动') && !has('追加') && !has('跃向') && !has('移动到') && !has('移动至');
  if (direct) {
    var back = /后退|向后/.test(t);
    var mn = __matchNum(new RegExp('(?:前进|后退|向前[^。；，]{0,6}移动|向后[^。；，]{0,6}移动|移动)\\s*' + __NUM + '\\s*格'), t);
    if (mn == null) mn = 1;
    ops.push({ op: 'move', n: back ? -mn : mn });
  }

  // 掷骰/阶段/打断
  if (/追加一个掷骰阶段|追加一个投掷阶段|追加掷骰/.test(t)) ops.push({ op: 'add_roll_phase', toTarget: /一名玩家|指定玩家|为[^。；;]{0,4}玩家|目标/.test(t) });
  // 关键等级追加抽牌（如“打起精神来！”Lv4自己抽、Lv7目标抽）；数量兼容中文数字
  function __cnNum(s) { return ({ '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5 }[s] || (+s || 1)); }
  var __lvDraw = t.match(/Lv\s*(\d+)\s*追加[：:][^。；;]*?(自己|自身|我)\s*抽\s*(\d+|[一二两三四五])\s*张/);
  if (__lvDraw) ops.push({ op: 'draw', n: __cnNum(__lvDraw[3]), who: 'self', ifLevel: +__lvDraw[1] });
  var __lvDrawT = t.match(/Lv\s*(\d+)\s*追加[：:][^。；;]*?(目标|其|对方|一名玩家)\s*抽\s*(\d+|[一二两三四五])\s*张/);
  if (__lvDrawT) ops.push({ op: 'draw', n: __cnNum(__lvDrawT[3]), who: 'target', ifLevel: +__lvDrawT[1] });
  if (/修改一次(投掷|掷骰)|修改一次投掷动作中的所有点数|修改一次掷骰结果/.test(t)) ops.push({ op: 'modify_dice' });
  var dcm2 = t.match(/下次投掷改为\s*(\d+)\s*枚\s*(\d+)\s*面骰/);
  var dcs = t.match(/下次投掷改为\s*(\d+)\s*面骰/);
  var dja = t.match(/判定伤害\s*([-+])\s*(\d+)/);
  var __adj = dja ? (dja[1] === '-' ? -+dja[2] : +dja[2]) : 0;
  if (dcm2) ops.push({ op: 'set_dice_sides', sides: +dcm2[2], count: +dcm2[1], judgeAdj: __adj, toTarget: /选一名玩家|一名玩家|其/.test(t) });
  else if (dcs) ops.push({ op: 'set_dice_sides', sides: +dcs[1], count: 1, judgeAdj: __adj, toTarget: /选一名玩家|一名玩家|其/.test(t) });
  // 持续回复：每回合回复N同步（持续M回合）
  var rg = t.match(new RegExp('每回合回复\\s*' + __NUM + '\\s*点?同步[^。；]*?持续\\s*' + __NUM + '\\s*回合'));
  if (rg) ops.push({ op: 'regen_sync', amount: __toNum(rg[1]), turns: __toNum(rg[2]) });
  if (/打断[^。；]*(移动|一名玩家)/.test(t)) ops.push({ op: 'interrupt_move', who: has('自己') ? 'self' : 'target' });

  // 费用
  if (has('费用-') || has('花费-') || has('减费')) {
    var rc = __matchNum(new RegExp('[费用花费]\\s*-\\s*' + __NUM), t);
    ops.push({ op: 'next_cost_down', amount: (rc == null ? 1 : rc), alsoTarget: true });
  }
  if ((has('金币') || /[$＄]/.test(t)) && !has('支付') && !has('消耗') && !has('花费')) {
    var gm = __matchNum(new RegExp('(?:获得|得到|\\+)\\s*' + __NUM + '\\s*(?:金币|[$＄])'), t);
    if (gm != null) ops.push({ op: 'gain_gold', amount: gm });
  }

  // 攻击增益 / 暴击率 / 控骰（统一登记为状态）
  if (has('攻击')) {
    var av = __matchNum(new RegExp('(?:自身攻击|攻击力|攻击)\\s*\\+\\s*' + __NUM), t);
    if (av == null) av = __matchNum(new RegExp('\\+\\s*' + __NUM + '\\s*攻击'), t);
    if (av == null) av = __matchNum(new RegExp('(?:上升|提升)\\s*(?:自身|其)?\\s*' + __NUM + '\\s*点?攻击力'), t);
    if (av == null) av = __matchNum(new RegExp('队伍攻击力\\+\\s*' + __NUM), t);
    /* 【百分比形态】（作者 2026-09-28 新卡面：最佳化「提升自身100%的攻击力」）
       引擎的 attackBuff 是 flat 数值 ⇒ N% 只能在**执行时**按"当时的攻击力"换算（见 op attack_buff_temp_pct）。 */
    if (av == null) {
      var __pv = __matchNum(new RegExp('(?:提升|上升|增加)\\s*(?:自身|其)?\\s*' + __NUM + '\\s*%\\s*(?:的)?\\s*攻击力'), t);
      if (__pv != null) ops.push({ op: 'attack_buff_temp_pct', pct: __pv });
    }
    if (av != null) {
      // “直到本回合结束”类攻击力为临时增益，回合结束时清零（最佳化等）；其余为常驻
      // 口径补充（2026-09-25）：卡面也出现「直到**当前阶段**结束前提升自身N点攻击力」的说法（最佳化的新版卡面）。
      // 引擎只有"本回合/常驻"两档，没有"阶段"档 ⇒ 归到**临时**这一档（回合结束清零）。
      // 差别只是"多留一个阶段"，但绝不能再落到常驻分支（那会变成跨回合永久 +N 攻击，实测踩到过）。
      if (/直到本回合结束|本回合结束|当前阶段结束|阶段结束前/.test(t)) ops.push({ op: 'attack_buff_temp', amount: av });
      else ops.push({ op: 'attack_buff', amount: av });
    }
  }
  // 增益持续行动数：持续N次行动 / N次行动内 / 一次行动内；缺省按1次行动
  var __durM = t.match(/持续\s*(\d+)\s*次行动|(\d+)\s*次行动内|一次行动内/);
  var __dur = __durM ? (__durM[1] ? +__durM[1] : (__durM[2] ? +__durM[2] : 1)) : 1;
  var crit = t.match(/获得\s*(\d+)\s*%\s*的?暴击率/);
  if (crit) ops.push({ op: 'apply_status', status: 'crit_rate', value: +crit[1], actions: __dur });
  var critd = t.match(/暴击伤害(?:增加|加成)\s*(\d+)\s*%/) || t.match(/(\d+)\s*%\s*的?暴击伤害(?:增加|加成)?/);
  if (critd) ops.push({ op: 'apply_status', status: 'crit_damage', value: +critd[1], actions: __dur });
  var ctrl = t.match(/\+\s*(\d+)\s*%\s*控骰/);
  if (ctrl) ops.push({ op: 'apply_status', status: 'control_dice', value: +ctrl[1], actions: __dur });
  // 「施加1轮的[缴械]」这种**不带"持续"字样**的时长也要认（安静些的写法；旧正则要求"持续N轮"才匹配）。
  // 但【安静些】那种"检查其手牌…攻击卡…[缴械]"必须**整段交给 disarm_target** 处理：
  // 否则状态会被这里无条件施加一次（哪怕目标手牌根本没有攻击卡）。
  var __disarmClauseTxt = /检查其手牌/.test(t) && /攻击卡/.test(t);
  var named = t.match(/(?:获得|施加|赋予|得到)\s*(?:其|目标|一名玩家)?\s*(?:(?:持续\s*)?(\d+)\s*(?:次行动|轮|回合)的?)?\s*\[([^\]]+)\]/);
  if (named && !__disarmClauseTxt) {
    var dur = named[1] != null ? +named[1] : __matchNum(/持续\s*(\d+)\s*(?:次行动|轮|回合)/, t);
    // 状态名归一：卡面【超频】与贷款/暴击结算使用的 overclock 统一
    var __stName = (named[2] === '超频') ? 'overclock' : named[2];
    ops.push({ op: 'apply_status', status: __stName, actions: (dur == null ? 1 : dur) });
  }

  // 驱散 / 抵消伤害
  if (has('驱散')) ops.push({ op: 'cleanse', who: /一名玩家|其他玩家/.test(t) ? 'target' : 'self' });
  if (/抵消一次即将受到的伤害|抵消一次[^。；]*伤害/.test(t)) ops.push({ op: 'prevent_next_damage' });

  // 检索 / 回收 / 放回
  var exm = t.match(/(无序|热忱|理智|混沌)以外/); // 仅四属性可作排除项，修复把"加入无序/选这张卡"误捕获为属性
  if (/加入手卡|加入手牌|加入[^。；，]{0,14}(?:道具卡|卡)|回收/.test(t)) {
    var sources = __parseSources(t); if (!sources.length) sources = ['deck'];
    var tags = __parseTags(t), cats = __parseCats(t);
    var need = __matchNum(new RegExp('(?:选|将)?[^。；，]{0,8}' + __NUM + '\\s*张'), t) || 1;
    ops.push({ op: 'search', sources: sources, tags: tags, cats: cats, excludeAttr: exm ? exm[1] : null, excludeSelf: /这张卡以外|自身以外|此卡以外/.test(t), need: need, maxCost: (function(){ var m = t.match(/费用\s*(?:不大于|不超过|≤|<=)\s*(\d+)/); return m ? +m[1] : null; })(), to: 'hand', who: /对手|其他玩家/.test(t) ? 'target' : 'self' });
  }
  // 下次造伤附带判定
  var nj = t.match(/下一次造伤害附带(硬币|四面骰|六面骰|4面骰|6面骰)判定伤害/);
  if (nj) { var njd = nj[1].indexOf('硬') >= 0 ? 'coin' : (nj[1].indexOf('四') >= 0 || nj[1].indexOf('4') >= 0 ? 'd4' : 'd6'); var njf = __matchNum(/正面\s*(\d+)/, t) || 2; ops.push({ op: 'buff_next_judge', dice: njd, front: njf }); }
  // 威胁献祭：除非献祭某属性卡，否则受对应伤害
  var th = t.match(new RegExp('除非将一张([一-龥]{2,4})属性的卡送入墓地（?视为一次献祭）?，?否则[^。；]*受到\\s*' + __NUM + '\\s*点([一-龥]{2,4})属性伤害'));
  if (th) ops.push({ op: 'threat_sacrifice', attr: th[1], elseDamage: __toNum(th[2]), kind: th[3] });
  // 选手牌放回牌组最下方（失败分支等）：玩家选卡，非随机
  if (/选[^。；，]{0,8}(手卡|手牌)[^。；，]{0,10}放回[^。；，]{0,6}(牌组|卡组|牌库)[^。；，]{0,4}(最下|底部|底下|底端)/.test(t)) {
    ops.push({ op: 'return_pick_bottom', zone: 'hand', need: __matchNum(new RegExp('选[^。；，]{0,6}' + __NUM), t) || 1 });
  }
  if (/放回(?:其)?牌组/.test(t) && !/最下|底部|底下|底端/.test(t) && !/全部|所有/.test(t)) {
    var src = __parseSources(t);
    ops.push({ op: 'search', sources: src.length ? src : ['grave'], tags: __parseTags(t), cats: __parseCats(t), need: 1, maxCost: (function(){ var m = t.match(/费用\s*(?:不大于|不超过|≤|<=)\s*(\d+)/); return m ? +m[1] : null; })(), to: 'deck', who: /对手|其他玩家/.test(t) ? 'target' : 'self' });
  }
  if (/全部放回牌组|墓地和移出游戏的卡全部/.test(t)) ops.push({ op: 'return_all_deck' });
  if (/回收上一张使用的卡/.test(t)) ops.push({ op: 'recycle_last' });

  // 选卡送入墓地（可献祭/可再抽）
  // 例外：【安静些】的「检查**其（目标）**手牌，若其中有攻击卡的场合则将那张攻击卡送入墓地并对其施加1轮的[缴械]」
  // 主语是目标、候选限定为攻击卡、且有条件（没有攻击卡就不适用）——用通用 discard 会变成"自己手卡强制弃1"，
  // 既弄错主语又静默失效（旧实现就是这条路）。
  var __disarmClause = /检查其手牌/.test(t) && /攻击卡/.test(t) && /缴械/.test(t);
  if (__disarmClause) {
    var __disarmR = __matchNum(new RegExp('(\\d+)\\s*(?:次行动|轮|回合)'), t) || 1;
    ops.push({ op: 'disarm_target', rounds: __disarmR });
  } else if (!__threatHit && /送入墓地|送墓/.test(t) && /选|一张|\d\s*张|手卡|区域|手牌/.test(t)) {
    var zones = []; if (/手卡|手牌/.test(t)) zones.push('hand'); if (/区域|场上|永续/.test(t)) zones.push('permanent'); if (!zones.length) zones.push('hand');
    var dneed = __matchNum(new RegExp('至多?\\s*' + __NUM + '\\s*张'), t) || 1;
    // “至多N张”：可少选甚至不选（先哲之"馈赠"类）
    ops.push({ op: 'discard', zones: zones, need: dneed, allowLess: /至多/.test(t), thenDraw: false, sacrifice: has('献祭') }); // 抽卡交由独立 draw 指令+位置排序保证先后，避免双抽
  }
  if (/进行一次献祭动作|立即献祭/.test(t)) ops.push({ op: 'sacrifice_now', thenDraw: false });
  // 从墓地选卡发动/适用其“卡牌效果”（狼牙鹰爪等）：取 effect 而非 sp，支付该卡费用+额外
  if (/墓地/.test(t) && /(发动|适用)[^。；]*(那张卡|其|此卡)?的?效果|那张卡的效果/.test(t) && /音韵|费用|支付/.test(t) && !/加入手卡|加入手牌|回收/.test(t)) {
    var __gcTags = __parseTags(t);
    var __gcCats = /单次种类|单次卡|单次种类的卡/.test(t) ? ['item_single'] : [];
    var __gcExtra = __matchNum(/(?:所需要的音韵值)?\s*[+＋]\s*(\d+)\s*点音韵/, t) || (/[+＋]/.test(t) ? 1 : 0);
    ops.push({ op: 'grave_copy', tags: __gcTags, cats: __gcCats, extraCost: __gcExtra });
  }
  // “被破坏的卡移出本局游戏”属破坏路由说明，不单独产出动作（破坏动作的去向由 __CTX_FORCE_REMOVED 决定）
  if (/被破坏的卡?[\s\S]*移出(?:本局)?游戏/.test(t) && !/选|一张|1张|场上|功能卡|手卡|手牌/.test(t)) {
    if (__CTX_FORCE_REMOVED) return [];
    var __drw = t.match(/(无序|热忱|理智|混沌)[（(]/);
    ops.push({ op: 'destroy_route', to: 'removed', when: __drw ? __drw[1] : null }); // 条件分支内：按被破坏卡属性决定移出
  }
  // 破坏（选卡）；排除“破坏后将一张移出游戏的卡加入手卡”这类回收移出卡的描述（交给 search，不是再破坏）
  if (has('破坏') && /一张|1张|场上|区域|功能卡|手卡|手牌/.test(t) && !(/加入手[卡牌]/.test(t) && /移出游戏的?卡/.test(t))) {
    ops.push({ op: 'destroy_pick', zone: /手卡|手牌/.test(t) ? 'hand' : 'permanent', to: (/移出/.test(t) || __CTX_FORCE_REMOVED) ? 'removed' : 'grave', who: /自己|自身/.test(t) ? 'self' : 'target' });
  }
  if (/打落/.test(t)) ops.push({ op: 'knock_off', loseCost: 3 });

  // 引导核心 / 激励
  var corem = t.match(/(\d+)\s*点引导核心/); if (corem) ops.push({ op: 'gain_core', n: +corem[1] });
  var mot = t.match(/(?:获得|得到|给予)\s*(\d+)\s*点激励/); if (mot) ops.push({ op: 'gain_motivation', n: +mot[1] });

  // “成功”型判定分支（“则”型已在外层 compileSingle 拆分 thenOps）
  var jb = t.match(/(20|6|4|六|四)面骰判定[\s\S]*?([><≥≤]=?)\s*(\d+)\s*成功/);
  if (jb) ops.push({ op: 'judge_branch', sides: ({ 六: 6, 四: 4 })[jb[1]] || +jb[1], cmp: jb[2], rhs: +jb[3], thenOps: [] });
  // 移动量=本次判定骰点
  if (/位移量为本次附加伤害值|位移量等于本次/.test(t)) ops.push({ op: 'move_by_roll' });
  // 查看手牌并选1张延迟移出
  if (/查看[^。；]*手牌/.test(t) && /移出游戏/.test(t)) ops.push({ op: 'exile_pick', zone: 'hand', actions: __matchNum(/(\d+)\s*次行动内/, t) || 3 });
  // 下次造伤前先扣目标同步
  var pnd = t.match(new RegExp('下次造成伤害前先扣除目标\\s*' + __NUM + '\\s*点同步'));
  if (pnd) ops.push({ op: 'pre_next_damage_loss', amount: __toNum(pnd[1]) });
  // 泳圈飞行物（选方向，沿向最多N格，命中玩家造N理智并降N防）
  if (/泳圈|飞掷一个飞行物/.test(t)) {
    var sr = __matchNum(/最远(?:可以)?飞行\s*(\d+)\s*格/, t) || 4;
    var sd = __matchNum(new RegExp('造成\\s*' + __NUM + '\\s*点理智'), t) || 2;
    var sf = __matchNum(new RegExp('降低其\\s*' + __NUM + '\\s*点防御'), t) || 1;
    ops.push({ op: 'swim_ring', range: sr, damage: sd, def: sf });
  }
  // 检索卡与弃卡同色/同费则回音韵
  var gim = t.match(new RegExp('同色或同费[^。；]*回复\\s*' + __NUM + '\\s*点音韵'));
  if (gim) ops.push({ op: 'gain_cost_if_last_match', amount: __toNum(gim[1]) });

  // 机制登记（规则依赖地图/连锁子系统，显式登记状态待结算点读取，不编造数值）
  var dom = t.match(/展开[^。；]*?前后\s*(\d+)\s*格的?领域[\s\S]*?持续\s*(\d+)\s*次行动/);
  if (dom) ops.push({ op: 'register_mechanic', kind: 'domain', range: +dom[1], actions: +dom[2] });
  if (/发起一次\[?决斗\]?|发起一次决斗/.test(t)) ops.push({ op: 'register_mechanic', kind: 'duel' });
  if (/放置路障/.test(t)) ops.push({ op: 'register_mechanic', kind: 'barrier' });
  if (/视为与那张卡相同/.test(t)) ops.push({ op: 'register_mechanic', kind: 'copy' });
  if (/直接销毁不进墓|销毁，?不进墓|发动后直接销毁/.test(t)) ops.push({ op: 'consume_self' });
  if (/终止所有[^。；]*移动动作/.test(t)) ops.push({ op: 'register_mechanic', kind: 'stop_all_move' });
  if (/交换[^。；]*格子[^。；]*效果/.test(t)) ops.push({ op: 'register_mechanic', kind: 'swap_tile' });
  // 进入过载状态（持续N次行动 / 直到游戏结束=-1）
  if (/进入过载状态/.test(t)) {
    var __ovd = __matchNum(/持续\s*(\d+)\s*次行动/, t);
    ops.push({ op: 'overload', duration: /直到本场?游戏结束/.test(t) ? -1 : (__ovd || 0) });
  }

  if (uncovered.length) return null;
  if (!ops.length) return __looksActionable(t) ? null : [];
    // 可额外耗音韵增伤（水枪攻击等）：给 damage op 挂 payExtra，执行时选择投入点数
  var __dpe = t.match(/每额外(?:消耗|耗)\s*(\d+)\s*点?音韵[^。）)]*?增加\s*(\d+)\s*点?[^。）)]*?伤害(?:[^。）)]*?最多额外(?:消耗|耗)\s*(\d+)\s*点?)?/);
  if (__dpe) { ops.forEach(function (o) { if (o.op === 'damage') o.payExtra = { perCost: +__dpe[1], perDmg: +__dpe[2], max: __dpe[3] ? +__dpe[3] : null }; }); }
  return __orderOps(t, ops);
}

/* ==== 导出垫片（不改名字，仅供跨文件可见）==== */
try { window.__CN = __CN; } catch (e) {}
try { window.__toNum = __toNum; } catch (e) {}
try { window.__matchNum = __matchNum; } catch (e) {}
try { window.__NUM = __NUM; } catch (e) {}
try { window.__hasComplexMechanic = __hasComplexMechanic; } catch (e) {}
try { window.__looksActionable = __looksActionable; } catch (e) {}
try { window.__parseSources = __parseSources; } catch (e) {}
try { window.__parseTags = __parseTags; } catch (e) {}
try { window.__parseCats = __parseCats; } catch (e) {}
try { window.__opAnchors = __opAnchors; } catch (e) {}
try { window.__orderOps = __orderOps; } catch (e) {}
try { window.__compileBody = __compileBody; } catch (e) {}
