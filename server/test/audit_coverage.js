const { chromium } = require('playwright-core');
(async()=>{
 const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
 const pg=await b.newPage();
 await pg.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
 await pg.waitForFunction(()=>document.querySelector('#mainMenu.active'));
 const report=await pg.evaluate(()=>{
  // 文字关键动作 -> 期望出现的op（任一即可）
  const RULES=[
   [/抽\s*[0-9一二两三四]?\s*张|抽取|抽一张|抽卡/,['draw','draw_gift','draw_omikuji','choice','optional','search','register_mechanic','overload'],'抽牌'],
   [/造成[^。；;]{0,12}伤害|造[^。；;]{0,6}点?伤害/,['damage','damage_multi','judge_branch','pay_n_deal_n','damage_by_removed','choice','optional','register_mechanic','pre_next_damage_loss','prevent_next_damage','buff_next_judge'],'造伤'],
   [/前进|后退|移动|跃|位移/,['move','move_range','move_choice','move_by_roll','move_pay_extra','move_to_player','move_to_tile','forward','around','fix_next_move','adjust_next_move','buff_double_move','buff_bonus_move_after','change_direction','choice','optional','register_mechanic','interrupt_move'],'位移'],
   [/回复[^。；;]{0,8}音韵|获得[^。；;]{0,6}音韵|音韵值?\+|回\s*\d+\s*点?音韵/,['gain_cost','gain_cost_if_last_match','choice','optional','sacrifice_now','register_mechanic'],'回音韵'],
   [/回复[^。；;]{0,8}同步|恢复[^。；;]{0,6}同步|同步值?\+\d/,['heal_sync','regen_sync','choice','optional'],'回同步'],
   [/护盾/,['gain_shield','break_shield','choice','optional'],'护盾'],
   [/防御[值力]?\s*[+\-上升降低]/,['def_up','def_down','choice','optional'],'防御'],
   [/检索|从(?:牌组|卡组|墓地|移出游戏)[^。；;]{0,12}选|选择[^。；;]{0,10}加入手卡|加入手牌/,['search','return_pick_bottom','recycle_last','grave_copy','exile_pick','destroy_pick','discard','choice','optional','register_mechanic'],'检索/回收'],
   [/(?:送入|送进|弃置|丢弃)[^。；;]{0,6}墓地|送墓/,['discard','sacrifice_now','threat_sacrifice','destroy_pick','exile_pick','choice','optional'],'送墓'],
   [/移出(?:本局)?游戏|除外/,['exile_pick','damage_by_removed','choice','optional','register_mechanic'],'移出游戏'],
   [/破坏/,['destroy_pick','destroy_route','knock_off','choice','optional','register_mechanic'],'破坏'],
   [/金币/,['gain_gold','choice','optional'],'金币'],
   [/入迷值?\s*(?:降低|减少|-)/,['reduce_fascination','choice','optional'],'降入迷'],
   [/判定/,['judge_branch','buff_next_judge','roll_dice','set_dice_sides','damage','choice','optional','register_mechanic','reroll_judge'],'判定'],
   [/攻击力/,['attack_buff','choice','optional','register_mechanic'],'攻击力'],
  ];
  const out=[];
  allCards.forEach(c=>{
    const eff=c.effect||c.text||c.passive||c.sp||'';
    if(!eff) return;
    let ops=[];
    try{ ops=(compileStepOps(eff,false)||[]).map(o=>o.op); }catch(e){ out.push({n:c.name,cat:c._category,err:String(e.message||e)});return; }
    const flat=JSON.stringify(ops);
    const miss=[];
    RULES.forEach(([re,expects,label])=>{
      if(re.test(eff)){ const ok=expects.some(e=>flat.includes("'"+e+"'")||flat.includes('"'+e+'"')); if(!ok)miss.push(label); }
    });
    if(miss.length) out.push({n:c.name,cat:c._category,ops:ops.join(','),miss:miss.join('/')});
  });
  return out;
 });
 console.log('疑似缺失卡数:',report.length);
 report.forEach(r=>console.log(`[${r.cat||'?'}] ${r.n} :: 缺 ${r.miss} :: ops=${r.ops||r.err||''}`));
 await b.close();
})().catch(e=>{console.error(e);process.exit(1);});
