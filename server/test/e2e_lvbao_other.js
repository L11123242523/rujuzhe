// 绿宝之杖·择①：让“其他玩家”抽——1v1直接对手抽、自己后退2格、自己不抽；选项文案无内部标记；共鸣仍走目标馈赠
const { chromium } = require('playwright-core');
const PATH = 'file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html';
let A = [];
const ok = (c, m) => A.push((c ? 'PASS ' : 'FAIL ') + m + (c ? '' : ' ✗'));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const pg = await b.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(PATH, { waitUntil: 'load' });
  await pg.waitForFunction(() => document.querySelector('#mainMenu.active'));

  const R = await pg.evaluate(async () => {
    const out = {};
    const lv = allCards.find(x => x.name && x.name.indexOf('绿宝') >= 0);
    const ops = compileStepOps(lv.effect, false);
    const ch = ops.find(o => o.op === 'choice');
    const b0 = ch.branches[0];
    out.compilesOther = b0.some(o => o.op === 'draw' && o.who === 'other') && b0.some(o => o.op === 'move' && o.n === -2);
    out.labelClean = ch.labels[0].indexOf('【') < 0 && ch.labels[0].indexOf('其他玩家') >= 0;

    // 实际执行分支①
    battleState = { currentPlayer: 'p1', phase: 'main1',
      p1: { hand: [], grave: [], deck: [], permanent: [], faceDownCards: [], removed: [], position: 10, cost: 8, sync: 30, statuses: [] },
      p2: { hand: [], grave: [], deck: [{ name: 'o1' }, { name: 'o2' }], permanent: [], position: 20, cost: 8, sync: 30, statuses: [] } };
    addBattleLog = () => {}; updateBattleUI = () => {}; checkMoveTriggers = () => {}; triggerTileEffect = () => {};
    playDrawAnim = (u, cards, cb) => { cb && cb(); };
    await new Promise(res => runOps(b0, { user: 'p1', target: 'p2', card: lv }, res));
    out.foeDraw = battleState.p2.hand.length === 1 && battleState.p2.hand[0].name === 'o1';
    out.selfNoDraw = battleState.p1.hand.length === 0;
    out.selfBack = battleState.p1.position === 8; // 10-2

    // 共鸣：选目标玩家、其抽1张馈赠 → draw_gift，且不被标 other
    const gm = allCards.find(x => x.name === '共鸣');
    const gops = compileStepOps(gm.effect, false);
    out.resonance = gops.some(o => o.op === 'draw_gift') && !JSON.stringify(gops).includes('"who":"other"');
    return out;
  });

  ok(R.compilesOther, '分支①编译为 other抽1 + 自己后退2格');
  ok(R.labelClean, '选项文案无内部标记且显示“其他玩家”');
  ok(R.foeDraw, '1v1 直接让对手抽1张');
  ok(R.selfNoDraw, '自己不抽牌');
  ok(R.selfBack, '自己后退2格（10→8）');
  ok(R.resonance, '共鸣仍为目标抽馈赠、不被误判为other');
  ok(errs.length === 0, '页面无致命JS错误 ' + (errs[0] || ''));
  console.log(A.join('\n'));
  const f = A.filter(x => x.startsWith('FAIL')).length;
  console.log('\n绿杖other抽牌: 通过 ' + (A.length - f) + ' 失败 ' + f);
  await b.close(); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
