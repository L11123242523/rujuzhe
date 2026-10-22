/* 10.22审计批次1：卡面标签、已持有区域、临时移出与构筑边界的独立断言。 */
'use strict';
const H = require('../_relaytest/lib/harness.js');
const errors = [], g = H.bootGame({console:{log(){},warn(){},error(...a){errors.push(a.map(String).join(' '));}}});
g.initCards();
const S = g.sandbox, C = H.makeChecker('审计批次1'), only = (process.argv.find(x=>x.startsWith('--only='))||'').slice(7);
const card = n => JSON.parse(JSON.stringify(g.card(n)));
function fresh(user='p1') {
  function player(){return {hand:[],deck:[],grave:[],removed:[],removedFromGame:[],permanent:[],faceDownCards:[],eventCards:[],musicCards:[],statuses:[],moveBuff:{},position:10,sync:30,maxSync:100,cost:20,maxCost:20,level:1,defense:0,shield:0,attackBuff:0,teamAttribute:'神圣'};}
  S.battleState={p1:player(),p2:player(),turn:3,phase:'main1',currentPlayer:user,_over:false};
  S.deckConfig.p1.chars=[g.card('现实间冬马')]; S.deckConfig.p2.chars=[g.card('现实间冬马')];
  S.Online.active=false;
  S.updateBattleUI=S.addBattleLog=S.runTiming=S.__emitAddHand=function(){};
  return S.battleState;
}
function opRun(op,ctx){let done=0;S.runOneOp(op,ctx,()=>done++);return done;}
function group(id,fn){if(!only||only===id)fn();}
group('A',()=>{
  fresh();const c=card('小试身手！堆沙堡');
  C.eq('沙堡卡面标签',Array.from(S.__cardTags(c)),['丰沛']);
  C.eq('旧type保留',c.type,'移动');C.eq('技能类别保留',c._category,'skill_cards');
  C.eq('沙堡不被移动检索',S.matchCardQuery(c,['移动'],[],null),false);
  C.eq('沙堡仍被丰沛检索',S.matchCardQuery(c,['丰沛'],[],null),true);
  for(const user of ['p1','p2']){
    const b=fresh(user),p=b[user];p.sync=20;p.deck=[{name:'配对顶牌',attribute:'热忱',cost:1,_category:'item_single'}];p.hand=[{name:'配对手牌',attribute:'热忱',cost:2,_category:'item_single'}];
    const original=S.applyMove;S.applyMove=(w,n)=>b[w].position+=n;
    S.showCardPickerMulti=(arr,title,cb)=>cb([0]);let completed=0;
    S.SPECIAL_CARD_HANDLERS[c.name].play(c,user,()=>completed++);S.applyMove=original;
    C.eq(user+'沙堡前进1格',p.position,11);C.eq(user+'配对1次回复3同步',p.sync,23);C.eq(user+'沙堡明确结束',completed,1);
  }
});
group('B',()=>{
  const c=card('Huginn&Muninn');fresh();
  C.eq('双鸦实际tags仅战术',Array.from(c.tags),['战术']);
  C.eq('双鸦规则标签不含侵略',S.__cardTags(c).includes('侵略'),false);
  C.eq('双鸦不被侵略检索',S.matchCardQuery(c,['侵略'],[],null),false);
  C.eq('双鸦仍被战术检索',S.matchCardQuery(c,['战术'],[],null),true);
  C.eq('双鸦不是侵略回收候选',S.__isAggroCard(c),false);
  for(const user of ['p1','p2']){
    const b=fresh(user),target=user==='p1'?'p2':'p1';b[user].hand=[c];b[user].statuses=[{type:'缴械',actions:1}];
    C.eq(user+'缴械不因卡文含侵略而拦双鸦',S.evaluatePlayable(c,user,{allowDuringResolve:true}).ok,true);
    b[user]._hinaSP=true;
    const dmg=S.computeDamageValue(user,target,{base:2,srcCard:c,kind:'attribute',attr:'神圣'});
    C.eq(user+'侵略道具加伤不命中双鸦',dmg.logs.some(x=>x.includes('侵略')),false);
    b[user].grave=[card('得分！')];b[user].removed=[card('神乐铃')];
    let candidates=[];const original=S.showCardPickerMulti;
    S.showCardPickerMulti=(arr,title,cb)=>{candidates=arr.map(x=>x.name).sort();cb([0]);};
    C.eq(user+'双鸦主动可执行',S.PERMANENT_ACTIVE_HANDLERS.huginn(c,user),true);S.showCardPickerMulti=original;
    C.eq(user+'双鸦仍检索墓地及移出侵略卡',candidates,['得分！','神乐铃'].sort());
    C.eq(user+'双鸦支付3费',b[user].cost,17);C.eq(user+'双鸦回收一张',b[user].hand.length,2);
  }
});
group('C',()=>{
  for(const user of ['p1','p2']){
    const b=fresh(user),foreign=card('得分！'),own=card('闲暇时光'),other=card('经文');
    b[user].grave=[foreign,card('神乐铃'),other];b[user].deck=[card('得分！'),own];
    C.eq(user+'墓地侵略候选含非本队卡',S.collectZoneCards(user,['grave'],['侵略'],null,null).map(x=>x.card.name).sort(),['得分！','神乐铃'].sort());
    C.eq(user+'牌组仍只选本队卡',S.collectZoneCards(user,['deck'],null,['attack_cards'],null).map(x=>x.card.name),['闲暇时光']);
    let names=[];const original=S.pickFromList;S.pickFromList=(w,a,t,n,cb)=>{names=a.map(x=>x.card.name).sort();cb(a.filter(x=>x.card===foreign));};
    const op=S.compileStepOps('从墓地中选一张[侵略]标签的卡加入手卡',true).find(x=>x.op==='search');
    C.eq(user+'狼牙回收指令完成',opRun(op,{user,target:user==='p1'?'p2':'p1',card:card('狼牙鹰爪')}),1);
    C.eq(user+'狼牙实际给出全部合法候选',names,['得分！','神乐铃'].sort());
    C.eq(user+'非本队得分实际回手',b[user].hand.includes(foreign),true);C.eq(user+'原墓地不残留',b[user].grave.includes(foreign),false);
    C.eq(user+'回收不改变牌组',b[user].deck.length,2);S.pickFromList=original;
    b[user].grave=[card('得分！'),card('神乐铃'),card('共鸣者')];let copied=[];
    S.pickFromList=(w,a,t,n,cb)=>{copied=a.map(x=>x.card.name).sort();cb([]);};
    opRun({op:'grave_copy',tags:['侵略'],cats:['item_single','attack_cards','skill_cards'],extraCost:1},{user,target:user==='p1'?'p2':'p1',card:card('狼牙鹰爪')});
    C.eq(user+'狼牙墓地单次效果候选',copied,['得分！','神乐铃'].sort());S.pickFromList=original;
  }
});
group('D',()=>{
  for(const user of ['p1','p2']){
    const b=fresh(user),target=user==='p1'?'p2':'p1',q=b[target],picked=card('得分！');
    q.hand=[picked,card('经文')];q.removedFromGame=[card('神乐铃')];let candidates=[];
    const originalPick=S.pickFromList;S.pickFromList=(w,a,t,n,cb)=>{candidates=a.map(x=>x.card.name);cb(a.filter(x=>x.card===picked));};
    C.eq(user+'搜查令移出指令完成',opRun({op:'exile_pick',actions:3},{user,target,card:card('搜查令')}),1);S.pickFromList=originalPick;
    C.eq(user+'对手手牌不按本队筛选',candidates,['得分！','经文']);C.eq(user+'选中卡立即离手',q.hand.includes(picked),false);
    C.eq(user+'选中卡立即进入移出区',q.removedFromGame.includes(picked),true);
    C.eq(user+'临时移出登记3次行动',q._exilePending.map(x=>x.in),[3]);
    const originalDamage=S.applyDamageOps;let base=null;S.applyDamageOps=(u,t,o,cb)=>{base=o.base;cb();};
    opRun({op:'damage_by_removed',plus:1,kind:'sanity'},{user,target,card:card('搜查令')});S.applyDamageOps=originalDamage;
    C.eq(user+'两张移出卡时伤害基数数量加1',base,3);
    S.advanceActionLapse(user);C.eq(user+'其他玩家行动不扣目标持续时间',q._exilePending[0] && q._exilePending[0].in,3);
    S.advanceActionLapse(target);S.advanceActionLapse(target);C.eq(user+'两次行动后仍在移出区',q.removedFromGame.includes(picked),true);
    S.advanceActionLapse(target);C.eq(user+'三次行动后返回原持有者手牌',q.hand.includes(picked),true);C.eq(user+'到期移出区无残留',q.removedFromGame.includes(picked),false);C.eq(user+'到期登记清空',q._exilePending.length,0);
  }
  const b=fresh(),picked=card('得分！');b.p2.hand=[picked];const oldPick=S.pickFromList;
  S.pickFromList=(w,a,t,n,cb)=>cb(a);opRun({op:'exile_pick',actions:3},{user:'p1',target:'p2',card:card('搜查令')});S.pickFromList=oldPick;
  const ix=b.p2.removedFromGame.indexOf(picked);if(ix>=0)b.p2.removedFromGame.splice(ix,1);b.p2.grave.push(picked);
  for(let i=0;i<3;i++)S.advanceActionLapse('p2');C.eq('被其他效果搬离移出区后不会凭空返手',b.p2.hand.includes(picked),false);
});
for(const user of ['p1','p2']){
  const b=fresh(user),p=b[user],dj=card('典籍之残页'),pen=card('钢笔');p.hand=[dj];
  p.deck=[card('闲暇时光')];C.eq(user+'典籍牌组有本队携带卡可发动',S.evaluatePlayable(dj,user).ok,true);
  p.deck=[card('得分！')];C.eq(user+'典籍牌组仅非本队卡不可发动',S.evaluatePlayable(dj,user).ok,false);
  p.deck=[];p.grave=[card('闲暇时光')];C.eq(user+'典籍只有墓地卡不可发动',S.evaluatePlayable(dj,user).ok,false);
  C.eq(user+'钢笔可从墓地发动检索',S.evaluatePlayable(pen,user).ok,true);
  p.grave=[];p.removed=[card('得分！')];C.eq(user+'钢笔可从移出区发动检索',S.evaluatePlayable(pen,user).ok,true);
}
C.eq('执行期错误为空',errors,[]);
process.exit(C.summary());
