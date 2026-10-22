/* 批次1真实出牌：两个座位均经过原出牌、扣费、连锁和区域出口。 */
'use strict';
const L=require('../_relaytest/lib/cardlab.js'),H=require('../_relaytest/lib/harness.js');
const C=H.makeChecker('批次1真实出牌');
(async()=>{
  for(const name of ['小试身手！堆沙堡','Huginn&Muninn','狼牙鹰爪','搜查令'])for(const user of ['p1','p2']){
    const inst=L.bootCard({pickChoice:(title,a)=>/送入墓地并抽|然后可以|弃牌/.test(title)?a.length-1:0,pickChain:(title,a)=>a.length-1,pickCards:(title,a)=>{const i=a.findIndex(c=>c&&c.name==='得分！');return [i<0?0:i];}});
    const S=inst.S,c=JSON.parse(JSON.stringify(inst.g.card(name))),clone=n=>JSON.parse(JSON.stringify(inst.g.card(n)));
    const b=await L.setupBoard(inst,c,inst.g.cards(),{team:['里绪(水着)','椎名小春','小野伊织'],tweak:(s,bs)=>{
      for(const w of ['p1','p2']){
        const p=bs[w];for(const k of Object.keys(p))if(k.startsWith('_'))delete p[k];
        Object.assign(p,{hand:[],deck:[clone('经文')],grave:[],removed:[],removedFromGame:[],permanent:[],faceDownCards:[],eventCards:[],musicCards:[],statuses:[],moveBuff:{},position:10,sync:30,maxSync:100,cost:20,maxCost:20,attackBuff:0,defense:0,shield:0,teamAttribute:'神圣'});
      }
      s.deckConfig.p2.chars=s.deckConfig.p1.chars.slice();bs.currentPlayer=user;bs[user].hand=[c];
      if(name==='小试身手！堆沙堡'){
        bs[user].deck=[{name:'配对顶牌',attribute:'热忱',cost:1,_category:'item_single'}];bs[user].hand.push({name:'配对手牌',attribute:'热忱',cost:2,_category:'item_single'});
        s.applyMove=(w,n)=>{bs[w].position+=n;};
      }
      if(name==='Huginn&Muninn')bs[user].statuses=[{type:'缴械',actions:1}];
      if(name==='狼牙鹰爪')bs[user].grave=[clone('得分！')];
      if(name==='搜查令')bs[user==='p1'?'p2':'p1'].hand=[clone('得分！')];
    }});
    const target=user==='p1'?'p2':'p1';
    C.eq(user+' '+name+'发动资格',S.evaluatePlayable(c,user).ok,true);
    if(user==='p1')S.useCard(0);else S.aiUseCardComplete(0,()=>{});
    const q=await L.quiesce(inst,16000);
    C.eq(user+' '+name+'完整收尾',q.ok,true);
    C.eq(user+' '+name+'只扣本卡费用',b[user].cost,20-Number(c.cost));
    if(name==='小试身手！堆沙堡'){C.eq(user+'沙堡仍前进1格',b[user].position,11);C.eq(user+'沙堡仍配对回3同步',b[user].sync,33);}
    if(name==='Huginn&Muninn'){C.eq(user+'双鸦发动加3攻击',b[user].attackBuff,3);C.eq(user+'双鸦进入永续区',b[user].permanent.includes(c),true);}
    if(name==='狼牙鹰爪')C.eq(user+'狼牙确实从墓地回收非本队得分',L.logsOf(b).some(x=>String(x.msg||x.text||x).includes('加入手卡：得分！')),true);
    if(name==='搜查令'){
      C.eq(user+'搜查令目标手牌清空',b[target].hand.length,0);C.eq(user+'搜查令即时移出得分',b[target].removedFromGame.map(x=>x.name),['得分！']);C.eq(user+'一张移出卡造成2理智',b[target].sync,28);
      C.eq(user+'搜查令登记3次行动',b[target]._exilePending.map(x=>x.in),[3]);
      const snap=S.NetSync.buildSnapshot({mode:'self',full:true});S.NetSync.applySnapshot(JSON.parse(JSON.stringify(snap)));
      const restored=S.battleState[target];C.eq(user+'完整快照保留临时移出卡引用',restored._exilePending[0].card===restored.removedFromGame[0],true);
      for(let i=0;i<3;i++)S.advanceActionLapse(target);
      C.eq(user+'快照恢复后三次行动原卡返手',restored.hand.map(x=>x.name),['得分！']);C.eq(user+'返回后移出区清空',restored.removedFromGame.length,0);
    }
    C.eq(user+' '+name+'执行期无错误',inst.errs,[]);
  }
  process.exit(C.summary());
})().catch(e=>{console.error(e.stack);process.exit(1);});
