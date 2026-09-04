// 绿宝之杖·择①：统一弹一个“选择玩家”框，列出所有在场玩家，点谁谁抽，自己后退2格；共鸣仍走目标馈赠
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
    const ch = compileStepOps(lv.effect, false).find(o => o.op === 'choice');
    const b0 = ch.branches[0];
    out.compilesPick = b0.some(o => o.op === 'draw' && o.who === 'pick_player') && b0.some(o => o.op === 'move' && o.n === -2);
    out.labelClean = ch.labels[0].indexOf('【') < 0 && ch.labels[0].indexOf('抽一张卡') >= 0;

    function fresh() {
      battleState = { currentPlayer: 'p1', phase: 'main1',
        p1: { hand: [], grave: [], deck: [{ name: 's1' }, { name: 's2' }], permanent: [], faceDownCards: [], removed: [], position: 10, cost: 8, sync: 30, statuses: [] },
        p2: { hand: [], grave: [], deck: [{ name: 'o1' }, { name: 'o2' }], permanent: [], position: 20, cost: 8, sync: 30, statuses: [] } };
      addBattleLog = () => {}; updateBattleUI = () => {}; checkMoveTriggers = () => {}; triggerTileEffect = () => {};
      playDrawAnim = (u, cards, cb) => { cb && cb(); };
    }
    let pickOpts = null, pickIdx = 0;
    showChoiceModal = (title, name, sub, opts, cb) => { if (title === '选择抽牌的玩家') { pickOpts = opts.slice(); cb(pickIdx); } else cb(0); };

    // 选0=你自己
    fresh(); pickOpts = null; pickIdx = 0;
    out.allPlayers = allInGamePlayers().join(',') === 'p1,p2';
    await new Promise(res => runOps(b0, { user: 'p1', target: 'p2', card: lv }, res));
    out.optsAreAll = Array.isArray(pickOpts) && pickOpts.length === 2; // [你,对手]
    out.pickSelf = battleState.p1.hand.length === 1 && battleState.p1.hand[0].name === 's1' && battleState.p2.hand.length === 0 && battleState.p1.position === 8;

    // 选1=对手
    fresh(); pickIdx = 1;
    await new Promise(res => runOps(b0, { user: 'p1', target: 'p2', card: lv }, res));
    out.pickFoe = battleState.p2.hand.length === 1 && battleState.p2.hand[0].name === 'o1' && battleState.p1.hand.length === 0 && battleState.p1.position === 8;

    const gm = allCards.find(x => x.name === '共鸣');
    const gops = compileStepOps(gm.effect, false);
    out.resonance = gops.some(o => o.op === 'draw_gift') && !JSON.stringify(gops).includes('pick_player');
    return out;
  });

  ok(R.compilesPick, '分支①编译为 pick_player抽1 + 自己后退2格');
  ok(R.labelClean, '选项文案无内部标记');
  ok(R.allPlayers, '在场玩家列表=p1,p2');
  ok(R.optsAreAll, '选择框列出全部在场玩家（你/对手）');
  ok(R.pickSelf, '选自己→自己抽1、对手不抽、后退到8');
  ok(R.pickFoe, '选对手→对手抽1、自己不抽、后退到8');
  ok(R.resonance, '共鸣仍为目标抽馈赠、不受影响');
  ok(errs.length === 0, '页面无致命JS错误 ' + (errs[0] || ''));
  console.log(A.join('\n'));
  const f = A.filter(x => x.startsWith('FAIL')).length;
  console.log('\n绿杖选玩家抽牌: 通过 ' + (A.length - f) + ' 失败 ' + f);
  await b.close(); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
