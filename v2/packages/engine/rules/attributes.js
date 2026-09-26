/**
 * 入局者 v2 · 属性与克制（规则书 §6 + 附录A）
 * ---------------------------------------------------------------------------
 * 与旧引擎 `__normAttr` / `__attrBeats` / `__kindOf` / `__calcTeamAttribute`
 * （game.html:16471-16495）**行为等价**，由 `tools/diff-harness/diff-rules.mjs` 守。
 * 差别只有一条（有意）：新引擎只用完整属性名，不再靠 `indexOf` 猜 —— 
 * 但为了与旧引擎逐值一致，`normalizeAttr` 仍按"包含即认定"实现（旧口径）。
 */

export const ATTRS = Object.freeze(['热忱', '理智', '无序', '混沌']);

/** 克制环（规则书 §6.2）：热忱克无序，理智克热忱，无序克理智；混沌不克任何属性 */
export const COUNTER = Object.freeze({ 热忱: '无序', 理智: '热忱', 无序: '理智' });

/** 旧引擎口径：属性串里"包含"哪个属性名就归一为哪个（混沌优先判定） */
export function normalizeAttr(x) {
  const s = x || '';
  if (s.indexOf('混沌') >= 0) return '混沌';
  if (s.indexOf('热忱') >= 0) return '热忱';
  if (s.indexOf('理智') >= 0) return '理智';
  if (s.indexOf('无序') >= 0) return '无序';
  return s;
}

/**
 * att 是否克制 def（规则书 附录A）。
 * · 同属性：不克制；**例外**：混沌打混沌有克制（附录A「混沌×混沌＝克制」）
 * · 非混沌打混沌：克制（混沌被所有属性克制）
 * · 混沌打非混沌：不克制
 */
export function beats(att, def) {
  const a = normalizeAttr(att), d = normalizeAttr(def);
  if (a === d) return a === '混沌';
  if (d === '混沌') return true;
  if (a === '混沌') return false;
  return COUNTER[a] === d;
}

/** 伤害种类（旧 `__kindOf` 逐字等价）：理智→sanity，热忱→fervor，无序/混沌按字面 */
export function kindOf(attr) {
  const k = attr || '';
  if (!k) return null;
  if (k.indexOf('无序') >= 0) return '无序';
  if (k.indexOf('混') >= 0) return '混沌';
  if (k.indexOf('理智') >= 0) return 'sanity';
  if (k.indexOf('热忱') >= 0) return 'fervor';
  return null;
}

/** 队伍属性裁决（规则书派生口径，旧 `__calcTeamAttribute`）：①≥2 张同属性角色→该属性；②否则取队长属性 */
export function teamAttributeFromChars(chars, captain) {
  const list = (chars || []).filter(Boolean);
  const count = {};
  for (const c of list) if (c.attribute) count[c.attribute] = (count[c.attribute] || 0) + 1;
  for (const k of Object.keys(count)) if (count[k] >= 2) return k;
  const cap = captain || list[0];
  return cap ? (cap.attribute ?? null) : null;
}
