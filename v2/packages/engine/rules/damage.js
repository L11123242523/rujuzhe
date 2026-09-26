/**
 * 入局者 v2 · 伤害管线（规则书 §8）
 * ---------------------------------------------------------------------------
 * 与旧引擎 `computeDamageValue`（game.html:17124-17231）**行为等价**，
 * 差别是结构：旧引擎把"规则"与"某张卡的修正"混在一个 100 行的函数里
 * （按 `permanent` 里的卡名 `indexOf('风纪委员')` 之类）；
 * 新引擎把卡牌修正一律表达成**数据** `modifiers`，规则核心只认 `when` 标签。
 *
 * 规则核心（逐条对规则书）：
 *   ① 括号内 = max(0, 基础伤害 + 攻击力加成 − 防御)，攻击力加成 = ⌊攻击力 ÷ 2⌋（§8.1/§8.2）
 *   ② 暴击：初始 0%、爆伤 150%，判定伤害不暴击（§5.6/§8.3）
 *   ③ 括号外①：属性克制每段 +1（§6.3）；判定伤害不吃克制（§8.3）
 *   ④ 括号外②：判定伤害增伤（§8.3.2）；硬币判定同样算判定
 *   ⑤ 括号外③：理智伤害 +N（旧引擎 `_intellectBonus`）
 *   ⑥ 括号外④：各类"最终伤害 +N"（做成 modifiers）
 *   ⑦ 自己对自己造成的伤害不产生克制关系（旧口径 selfInflicted，game.html:17170）
 *
 * 纯函数：随机只以 `crit.roll`（1..100 的骰值）形式传入，由调用方从 rng 取。
 */

import { beats, kindOf } from './attributes.js';
import { RULES } from './constants.js';

/** 攻击力加成 = ⌊攻击力 ÷ 2⌋（规则书 §8.2） */
export function attackBonus(attackPower) {
  return Math.floor((attackPower || 0) / 2);
}

/**
 * @param {object} input
 * @param {number} input.base              基础伤害
 * @param {number} [input.attackPower]     攻击力资源（旧 attackBuff + _tempAttack）
 * @param {number} [input.attackPct]       攻击力 +N%（领域；作用在攻击力资源上，再 ÷2）
 * @param {number} [input.defense]         目标防御
 * @param {string} [input.attackerAttr]    进攻属性（显式 > 卡牌属性 > 队伍属性，由调用方定）
 * @param {string} [input.defenderAttr]    防守方队伍属性
 * @param {boolean} [input.judge]          是否判定伤害
 * @param {boolean} [input.selfInflicted]  是否自伤（不产生克制）
 * @param {boolean} [input.coinFail]       硬币判定为反面（直接 0）
 * @param {Array<{id:string, when:'counter'|'judge'|'sanity'|'always'|'crit', add:number}>} [input.modifiers]
 * @param {{rate?:number, bonusPct?:number, roll?:number}} [input.crit]
 * @returns {{value:number, core:number, atk:number, base:number, defense:number, kind:string|null,
 *            attr:string|null, judge:boolean, steps:Array<{id:string, add:number}>}}
 */
export function computeDamage(input = {}) {
  const steps = [];
  const base = input.base || 0;
  if (input.coinFail) {
    return { value: 0, core: 0, atk: 0, base, defense: 0, kind: null, attr: null, judge: !!input.judge, steps: [{ id: 'coinFail', add: 0 }] };
  }

  let rawAtk = input.attackPower || 0;
  if (input.attackPct) rawAtk = Math.floor(rawAtk * (1 + input.attackPct));
  const atk = attackBonus(rawAtk);
  const defense = Number.isFinite(input.defense) ? input.defense : 0;

  let core = base + atk - defense;
  if (core < 0) core = 0;
  let value = core;

  // ② 暴击（判定伤害不适用）
  const crit = input.crit || {};
  if (!input.judge && (crit.rate || 0) > 0 && (crit.roll || 0) <= crit.rate) {
    const mult = RULES.crit.baseMultiplier + (crit.bonusPct || 0) / 100;
    core = Math.round(core * mult);
    value = core;
    steps.push({ id: 'crit×' + mult.toFixed(2), add: 0 });
  }

  const judge = !!input.judge;
  const kind = judge ? null : kindOf(input.attackerAttr);
  const attr = input.attackerAttr ?? null;
  const mods = input.modifiers || [];

  // ③ 属性克制 +1（判定伤害不吃；自伤不产生克制）
  const countered = !judge && !input.selfInflicted && !!input.attackerAttr && !!input.defenderAttr
    && beats(input.attackerAttr, input.defenderAttr);
  if (countered) {
    value += RULES.attributes.counterOnHit;
    steps.push({ id: 'counter', add: RULES.attributes.counterOnHit });
  }

  for (const m of mods) {
    if (!m || typeof m.add !== 'number') continue;
    const applies = m.when === 'always'
      || (m.when === 'counter' && countered)
      || (m.when === 'judge' && judge)
      || (m.when === 'sanity' && kind === 'sanity');
    if (applies) {
      value += m.add;
      steps.push({ id: m.id, add: m.add });
    }
  }

  if (value < 0) value = 0;
  return { value, core, atk, base, defense, kind, attr, judge, steps };
}
