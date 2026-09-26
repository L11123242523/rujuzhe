/**
 * 入局者 v2 · 决策（一等对象）
 * ---------------------------------------------------------------------------
 * 旧引擎的决策点是 **82 处 `showChoiceModal(...)`**，答案靠"同一调用栈里的回调"取，
 * 于是：① 重叠询问互相覆盖（旧 A2 缺陷）；② 闭包无法序列化 ⇒ 重连必丢。
 *
 * 新引擎的决策是**可序列化的数据**，存在 `state.pendingDecisions` 里；
 * 谁答（本机玩家 / AI / 远端人类）只是"谁来调用 `answer()`"的区别，引擎不知道也不需要知道。
 * 没有答案时窗口**停在原地**（不改状态），绝不猜、绝不随机（规则书 §10.3）。
 */

/** 生成决策（写入 state.pendingDecisions，可 JSON 化） */
export function makeDecision(state, fields) {
  if (!state.decisionSeq) state.decisionSeq = 0;
  state.decisionSeq += 1;
  const d = Object.freeze({
    id: fields.id || (fields.kind + '#' + state.decisionSeq),
    seq: state.decisionSeq,
    kind: fields.kind,
    seat: fields.seat,
    reason: fields.reason || '',
    options: fields.options || [],
    title: fields.title || '',
    subtitle: fields.subtitle || '',
    ...(fields.meta ? { meta: fields.meta } : {}),
  });
  state.pendingDecisions.push(d);
  return d;
}

export function pendingOf(state) {
  return state.pendingDecisions.length ? state.pendingDecisions[0] : null;
}

/**
 * 记录答案（由 UI / AI / 远端调用）。
 * **注意：决策先留在 `pendingDecisions` 里**，由窗口在下一次驱动时用 `consumeAnswer()` 消费 ——
 * 早期实现在这里直接出队，结果窗口下一轮找不到"刚答的是哪一条"，只好重新提问（实测导致死循环）。
 */
export function answerDecision(state, decisionId, value) {
  const d = state.pendingDecisions.find((x) => x.id === decisionId);
  if (!d) throw new Error('[engine.decision] 未知或已回答的决策：' + decisionId);
  state.answers[decisionId] = value;
  return d;
}

/** 取答案（窗口驱动时调用）；没有答案返回 undefined（调用方据此保持挂起） */
export function takeAnswer(state, decisionId) {
  if (!Object.prototype.hasOwnProperty.call(state.answers, decisionId)) return undefined;
  return state.answers[decisionId];
}

/** 消费答案：把决策出队、答案删除（窗口推进时调用，保证"答一次只推进一次"） */
export function consumeAnswer(state, decisionId) {
  const value = takeAnswer(state, decisionId);
  if (value === undefined) return undefined;
  const ix = state.pendingDecisions.findIndex((d) => d.id === decisionId);
  if (ix >= 0) state.pendingDecisions.splice(ix, 1);
  delete state.answers[decisionId];
  return value;
}
