/**
 * 入局者 v2 · 攻击射程（规则书 §6.4 与作者确认的两条口径）
 * ---------------------------------------------------------------------------
 * 逐字移植旧引擎 `parseAttackRange` / `canReachByRange` / `attackNeedsEnemy`
 * （`game.html:4851-4905`）—— 这是"这张攻击卡现在能不能出"的权威判据。
 * 换掉我 P2 的简化版（只认 ops 里附带的 `{dir,range}`），因为那丢掉了旧引擎已有的范围种类：
 *   `moveThenAround`（先前进 N 格再判前后 M 格，如【钢筋铁肘】）、`forwardBack`（横扫之刃）、
 *   `pathBack`（后退路径，谢幕）、`movetorow`（狩猎之少女）、`samecell` / `samerow` / `global` / `noneed`。
 *
 * 作者确认的两条发动口径（旧注释原文）：
 *   ① 特殊范围（同一行/全图/移动到同行/后退路径/飞行物等 **非点位射程**）与非造伤卡：
 *      **发动时不要求射程**；
 *   ② 只有"前端 = 移动/飞掷"的攻击卡允许在射程外发动（移动可能把目标纳入射程）。
 * 其余"普通点位射程 + 造伤"的攻击卡，发动时即要求范围内存在可攻击目标。
 *
 * 验证：`tools/diff-harness/diff-range.mjs` 对全部 155 张卡逐张比对
 * 本模块与旧引擎 `parseAttackRange` / `attackNeedsEnemy` 的输出。
 */

import { ringForward, ringMinDist, isSameRow, TILE_COUNT } from './map.js';

/** attack_range 文本 → 结构化范围 */
export function parseAttackRange(text) {
  const raw = text || '';
  const spec = { kind: 'global', aoe: /所有玩家|AOE/.test(raw), raw };
  if (/无（(治疗|增益|驱散|疗愈)/.test(raw)) { spec.kind = 'noneed'; return spec; }
  if (/全图|无距离限制/.test(raw)) { spec.kind = 'global'; return spec; }
  let m;
  if (/同格/.test(raw)) { spec.kind = 'samecell'; return spec; }
  if ((m = raw.match(/前移(\d+)格后前后(\d+)格/))) { spec.kind = 'moveThenAround'; spec.move = +m[1]; spec.n = +m[2]; return spec; }
  if ((m = raw.match(/前方最远(\d+)格\+身后(\d+)格/))) { spec.kind = 'forwardBack'; spec.n = +m[1]; spec.m = +m[2]; return spec; }
  if ((m = raw.match(/后退(\d+)格过程中/))) { spec.kind = 'pathBack'; spec.n = +m[1]; return spec; }
  if (/移动到同一行目标格/.test(raw)) { spec.kind = 'movetorow'; return spec; }
  if (/同一行/.test(raw)) { spec.kind = 'samerow'; return spec; }
  if ((m = raw.match(/前后(\d+)格/))) { spec.kind = 'around'; spec.n = +m[1]; return spec; }
  if ((m = raw.match(/前方(\d+)格/))) { spec.kind = 'forward'; spec.n = +m[1]; return spec; }
  if ((m = raw.match(/最远(\d+)格/))) { spec.kind = 'around'; spec.n = +m[1]; return spec; }
  // 未识别的"玩家"类描述按全图处理（旧引擎在这里 console.warn，新引擎记进 spec 供审计）
  if (/玩家/.test(raw)) { spec.kind = 'global'; spec.unrecognized = true; return spec; }
  spec.kind = 'noneed';
  return spec;
}

/** 从 fromPos 能否打到 toPos（各范围种类逐条对齐旧引擎） */
export function canReachByRange(specOrText, fromPos, toPos) {
  const spec = typeof specOrText === 'string' ? parseAttackRange(specOrText) : (specOrText || { kind: 'global' });
  const from = fromPos || 0, to = toPos || 0;
  switch (spec.kind) {
    case 'noneed':
    case 'global': return true;
    case 'samecell': return from === to;
    case 'samerow':
    case 'movetorow': return isSameRow(from, to);
    case 'around': return ringMinDist(from, to) <= spec.n;
    case 'forward': { const d = ringForward(from, to); return d >= 0 && d <= spec.n; }
    case 'forwardBack': { const f = ringForward(from, to), b = TILE_COUNT - f; return (f >= 0 && f <= spec.n) || (b >= 0 && b <= spec.m); }
    case 'moveThenAround': { const base = (from + spec.move) % TILE_COUNT; return ringMinDist(base, to) <= spec.n; }
    case 'pathBack': { for (let st = 1; st <= spec.n; st++) if (((from - st + TILE_COUNT * 2) % TILE_COUNT) === to) return true; return false; }
    default: return true;
  }
}

/** 这张攻击卡是否需要在发动时就要求"范围内有敌人" */
export function attackNeedsEnemy(card) {
  if (!card) return false;
  const text = card.attack_range || '';
  const spec = parseAttackRange(text);
  if (spec.kind === 'noneed') return false;
  const t = String(card.effect || card.text || '').replace(/^\s*[\[【][^\]】]*[\]】]\s*/, '').trim();
  const first = (t.split(/[，。；,;、]/)[0] || '');
  const firstIsMove = /前进|后退|向前|向后|移动|跃|飞掷/.test(first) && !/造成|伤害|给予|击退/.test(first);
  if (firstIsMove) return false;                             // 口径②：前端是移动/飞掷的允许射程外发动
  const isPlainRange = ['around', 'forward', 'samecell', 'forwardBack', 'samerow'].includes(spec.kind);
  if (!isPlainRange) return false;                            // 口径①：特殊范围不做射程要求
  const hasDmg = /造成|给予|击退|打落/.test(t) || /(?:点|次|面骰)[^。；]{0,8}伤害/.test(t) || /伤害/.test(t);
  return !!hasDmg;                                            // 非造伤卡不做射程要求
}

/** 对手是否在该卡射程内（旧 `hasEnemyInAttackRange`） */
export function hasEnemyInAttackRange(card, fromPos, toPos) {
  const spec = parseAttackRange(card && card.attack_range);
  if (spec.kind === 'noneed') return true;
  return canReachByRange(spec, fromPos, toPos);
}
