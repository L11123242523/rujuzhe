/**
 * 入局者 v2 · 等级与激励（规则书 §9）
 * ---------------------------------------------------------------------------
 * 与旧引擎 `checkLevelUp`（game.html:13466-13491）与 `useGuideCore`（13454）
 * **行为等价**，含一条规则书没写但线上生效的：**每次升级回复 2 点同步值**（13480）。
 */

import { RULES, levelUpCost, motivationCap } from './constants.js';

/**
 * 结算升级（可连续升多级）+ 激励溢出截断。
 * 就地修改 seat，返回事件清单。
 */
export function applyLevelUps(seat) {
  const events = [];
  let ups = 0;
  while (seat.level < RULES.level.max) {
    const cost = levelUpCost(seat.level);
    if (cost === null || seat.motivation < cost) break;
    seat.motivation -= cost;
    seat.level += 1;
    seat.sync = Math.min(seat.sync + RULES.level.syncHealPerLevel, seat.maxSync || seat.sync);
    ups += 1;
    events.push({ type: 'levelUp', level: seat.level, sync: seat.sync, motivation: seat.motivation });
  }
  const cap = motivationCap(seat.level);
  if (RULES.motivation.overflowDiscarded && seat.motivation > cap) {
    const discarded = seat.motivation - cap;
    seat.motivation = cap;
    events.push({ type: 'motivationOverflow', cap, discarded });
  }
  return events;
}

/** 获得激励点数（馈赠/乐谱角星、灵感格等）→ 立即结算升级（§9.3 满足即必须升级） */
export function gainMotivation(seat, amount) {
  if (!(amount > 0)) return [];
  seat.motivation += amount;
  return applyLevelUps(seat);
}

/** 引导核心：消耗 1 个，把激励补满到"升到下一级所需"，随即结算升级（§7.2.5；旧 13454-13464） */
export function useGuideCore(seat) {
  const held = seat.counters.guideCore || 0;
  if (!(held > 0)) return { ok: false, reason: '没有引导核心', events: [] };
  const need = levelUpCost(seat.level);
  if (need === null) return { ok: false, reason: '已满级', events: [] };
  seat.counters.guideCore = held - 1;
  seat.motivation = Math.max(seat.motivation || 0, need);
  const events = [{ type: 'guideCore', filledTo: need }].concat(applyLevelUps(seat));
  return { ok: true, events };
}

/** 只读：距离下一级还差多少激励（UI 用） */
export function motivationToNext(seat) {
  const need = levelUpCost(seat.level);
  return need === null ? null : Math.max(0, need - (seat.motivation || 0));
}
