// 本轮回归：回收垫底/牌组重置顺序/降防2次行动/绿杖choice文字/一刀两断墓地SP/里绪四↔六面骰/水着琉璃热忱最终增伤
const { chromium } = require('playwright-core');
const PATH = 'file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html';
let A = [];
function ok(cond, msg) { A.push((cond ? 'PASS ' : 'FAIL ') + msg + (cond ? '' : ' ✗')); }
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/local/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const pg = await b.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(PATH, { waitUntil: 'load' });
  await pg.waitForFunction(() => document.querySelector('#mainMenu.active'));

  const R = await pg.evaluate(async () => {
    addBattleLog = () => {}; updateBattleUI = () => {};
    const out = {};
    const mk = () => ({ hand: [], grave: [], deck: [], removed: [], removedFromGame: [], permanent: [], faceDownCards: [], sync: 30, maxSync: 99, cost: 8, maxCost: 12, shield: 0, defense: 0, defenseBase: 0, _defDowns: [], attackBuff: 0, position: 0, statuses: [] });

    // 1) 回收卡使用后放回牌组最下方（末位），不进墓
    battleState = { currentPlayer: 'p1', phase: 'main1', p1: mk(), p2: mk() };
    battleState.p1.deck = [{ name: 'd1' }];
    const rec = { name: '认真起来了！', _category: 'skill_cards', sp: '此卡进墓地后可花1音韵回收，被回收后使用放回牌组最下方', _recycled: true };
    battleState.p1.hand.push(rec);
    placeAfterUse('p1', rec, false);
    out.recycleBottom = battleState.p1.deck[battleState.p1.deck.length - 1].name === '认真起来了！' && battleState.p1.grave.length === 0 && battleState.p1.deck[0].name === 'd1';

    // 2) 牌组空→墓地正序为新牌组，抽牌顺序 g0→g1→g2（墓地最下方先抽）
    battleState.p1.deck = []; battleState.p1.grave = [{ name: 'g0' }, { name: 'g1' }, { name: 'g2' }];
    __refillDeckIfEmpty('p1');
    out.refillOrder = battleState.p1.deck.map(c => c.name).join(',') === 'g0,g1,g2';
    out.drawOrder = [takeTopCard('p1').name, takeTopCard('p1').name, takeTopCard('p1').name].join(',') === 'g0,g1,g2';

    // 3) 降防持续2次行动：当回合-2，流逝1次仍-2，流逝2次回0；加防不被降防到期清掉
    battleState.p2 = mk();
    applyDefenseDown('p2', 2, 2);
    const d0 = battleState.p2.defense;            // -2
    lapseDefenseDown('p2'); const d1 = battleState.p2.defense; // 流逝1次仍-2
    lapseDefenseDown('p2'); const d2 = battleState.p2.defense; // 第2次到期回0
    applyDefenseUp('p2', 1); const du = battleState.p2.defense; // 加防+1
    applyDefenseDown('p2', 2, 1); const dm = battleState.p2.defense; // +1-2=-1
    lapseDefenseDown('p2'); const d3 = battleState.p2.defense; // 1次降防到期，仅剩加防+1
    out.defLapse = (d0 === -2 && d1 === -2 && d2 === 0 && du === 1 && dm === -1 && d3 === 1);

    // 4) 绿杖三选一选项有文字
    const lv = allCards.find(c => c.name && c.name.indexOf('绿宝之杖') >= 0);
    const ops = compileStepOps(lv.effect, false);
    const ch = ops.find(o => o.op === 'choice');
    out.lvChoice = !!ch && ch.branches.length === 3 && ch.labels.every(x => x && x.length > 4);

    // 5) 一刀两断墓地SP：送1卡进墓、自身回手
    const wm = allCards.find(c => c.name && c.name.indexOf('一刀两断') >= 0);
    battleState.p1.grave = [wm]; battleState.p1.hand = [{ name: '祭品', _category: 'item_single' }]; battleState.p1.permanent = [];
    showCardPickerMulti = (l, t, cb) => cb([0]);
    const def = __graveSPDef(wm); const okBefore = !!def && def.ok(battleState.p1);
    activateGraveSP('grave', 0);
    out.watermelonSP = okBefore && battleState.p1.hand.some(c => c.name && c.name.indexOf('一刀两断') >= 0) && battleState.p1.grave.some(c => c.name === '祭品');

    // 6) 里绪：选项0=四面骰、选项1=六面骰
    const sidesSeen = [];
    battleState.p1 = mk(); battleState.p2 = mk(); battleState.p2.sync = 40;
    battleState.p1._rioPassive = true; battleState.p1._rioMoveCount = 8;
    judgePerform = (u, spec, cb) => { sidesSeen.push(spec.sides); cb(3); };
    dealDamageWithResponse = (t, d, s, cb) => { battleState[t].sync -= d; cb && cb(d); };
    let pick = 0; showChoiceModal = (t, n, e, chs, cb) => cb(pick);
    rioTriggerOnce('p1'); // 四面
    pick = 1; battleState.p1.cost = 8; rioTriggerOnce('p1'); // 六面
    await new Promise(r => setTimeout(r, 30));
    out.rioSides = sidesSeen[0] === 4 && sidesSeen[1] === 6;

    // 7) 水着琉璃：下次热忱最终伤害+1 被消费
    battleState.p1 = mk();
    battleState.p1._nextFervorFinalUp = 1;
    const cv = computeDamageValue('p1', 'p2', { base: 2, attr: '热忱', kind: 'fervor' });
    out.mizugiFinal = cv.value === 3 && (battleState.p1._nextFervorFinalUp || 0) === 0;

    return out;
  });

  ok(R.recycleBottom, '回收卡使用后放回牌组最下方且不进墓');
  ok(R.refillOrder, '牌组空→墓地正序作为新牌组');
  ok(R.drawOrder, '重置后抽牌顺序=墓地最下方依次向上');
  ok(R.defLapse, '降防持续2次行动到期恢复、加防保留');
  ok(R.lvChoice, '绿杖三选一选项均带文字');
  ok(R.watermelonSP, '一刀两断墓地SP：送1卡自身回手');
  ok(R.rioSides, '里绪1费四面骰/2费六面骰选项正确');
  ok(R.mizugiFinal, '水着琉璃下次热忱最终伤害+1并消费');
  ok(errs.length === 0, '页面无致命JS错误 ' + (errs[0] || ''));

  console.log(A.join('\n'));
  const f = A.filter(x => x.startsWith('FAIL')).length;
  console.log('\nfixes3 回归: 通过 ' + (A.length - f) + ' 失败 ' + f);
  await b.close(); process.exit(f ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
