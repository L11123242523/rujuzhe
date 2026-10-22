/* 妖刀五月雨：真实出牌、四区域原位破坏、可选伤害与双座位决策。 */
'use strict';
const H=require('../_relaytest/lib/harness.js'),L=require('../_relaytest/lib/cardlab.js');
const C=H.makeChecker('妖刀场上范围与可选伤害');
const zones=['permanent','faceDownCards','eventCards','musicCards'];
const watchdog=setTimeout(()=>{console.error('妖刀专项超时');process.exit(1);},150000);
async function scene(cfg){
  let pending=0;const pools=[],asks=[],damage=[],targets=[];
  const user=cfg.user||'p1',foe=user==='p1'?'p2':'p1',sp=cfg.mode==='sp';
  function choice(title,a){
    if(title==='妖刀五月雨·可选伤害')return cfg.decline?a.length-1:cfg.p3?1:0;
    if(title==='妖刀五月雨')return cfg.spChoice==='draw'?1:cfg.spChoice==='skip'?2:0;
    const trigger=a.findIndex(x=>/妖刀五月雨.*造伤|造伤≥5/.test(String(x)));
    if(trigger>=0&&sp)return trigger;
    return a.length-1;
  }
  const i=L.bootCard({pickChoice:choice,pickChain:choice,pickCards:()=>[pending]});
  const S=i.S,card=n=>JSON.parse(JSON.stringify(i.g.card(n))),mark=(n,id)=>Object.assign(card(n),{_probe:id});
  const timers=new Set(),intervals=new Set(),st=S.setTimeout,si=S.setInterval;
  S.setTimeout=(f,t)=>{const h=st(f,t);timers.add(h);return h;};S.setInterval=(f,t)=>{const h=si(f,t);intervals.add(h);return h;};
  const b=await L.setupBoard(i,card('妖刀五月雨'),i.g.cards(),{team:['里绪(水着)','椎名小春','小野伊织'],tweak:(s,b)=>{
    for(const side of ['p1','p2']){
      const p=b[side];for(const k of Object.keys(p))if(k.startsWith('_'))delete p[k];
      Object.assign(p,{hand:[mark('20面骰',side+'/hand')],deck:[mark('20面骰',side+'/deck')],grave:[mark('20面骰',side+'/grave')],removed:[mark('20面骰',side+'/removed')],removedFromGame:[],
        permanent:[mark('设计师的直尺',side+'/permanent')],faceDownCards:[Object.assign(mark('金刚镯',side+'/faceDownCards'),{_faceDownTurn:1,_faceDownPlayer:side})],
        eventCards:[mark('闲庭信步',side+'/eventCards')],musicCards:[mark('乐谱碎片·序幕',side+'/musicCards')],statuses:[],negativeEffects:[],moveBuff:{},sync:30,maxSync:100,cost:20,maxCost:20,attackBuff:0,defense:0,shield:0,position:10,teamAttribute:'神圣'});
    }
    b[foe].permanent.unshift(mark('智能手机','初段供破坏'));
    b[user].hand.unshift(mark('妖刀五月雨',user+'/妖刀本体'));b.currentPlayer=user;
    if(cfg.p3){b.p3=JSON.parse(JSON.stringify(b[foe]));b.p3.permanent=[];b.p3.faceDownCards=[];b.p3.eventCards=[];b.p3.musicCards=[];s.setPlayerIds(['p1','p2','p3']);}
    if(cfg.empty){for(const side of ['p1','p2'])for(const z of zones)b[side][z]=[];}
  }});
  const wanted=cfg.selfSource?user+'/妖刀本体':(cfg.side==='self'?user:foe)+'/'+(cfg.zone||'permanent');
  const victim=cfg.selfSource?b[user].hand[0]:b[cfg.side==='self'?user:foe][cfg.zone||'permanent'].find(c=>c._probe===wanted);
  const pick=S.pickFromList;
  S.pickFromList=function(w,list,title,n,cb,...rest){
    if(/妖刀五月雨/.test(title)){
      const initial=/发动时/.test(title),desired=sp&&initial?'初段供破坏':wanted;
      pending=list.findIndex(x=>x.realCard&&x.realCard._probe===desired);
      if(pending<0)pending=0;
      pools.push({title,entries:list.map(x=>({id:x.realCard&&x.realCard._probe,side:x.side,zone:x.zone,view:x.card.name,hidden:!!x.card._hidden,hasImage:!!x.card.image_url})),pick:pending});
    }
    return pick.call(this,w,list,title,n,cb,...rest);
  };
  const hit=S.dealDamageWithResponse;S.dealDamageWithResponse=function(t,n,src,cb,...rest){damage.push({target:t,amount:n});return hit.call(this,t,n,src,cb,...rest);};
  const target=S.showTargetSelect;S.showTargetSelect=function(...a){targets.push(a[0].name);return target.apply(this,a);};
  if(cfg.remote){
    S.Online.active=true;S.Online.isGuest=false;
    S.Online.askRemote=function(spec,cb){
      asks.push(JSON.parse(JSON.stringify(spec)));
      const question=spec.origin==='ENV.ask'?spec.spec:spec;
      const answer=question.cards?[pending]:choice(question.label||'',question.choices||[]);
      setTimeout(()=>cb(answer),5);
    };
  }
  const label=[user,cfg.remote?'联机意图':cfg.ai?'AI':'真实useCard',cfg.mode||'发动',cfg.side||'',cfg.zone||'',cfg.decline?'放弃伤害':cfg.spChoice||'',cfg.p3?'选p3':'',cfg.selfSource?'自拆本体':'',cfg.empty?'初始空场':''].filter(Boolean).join('/');
  C.eq(label+'可发动',S.evaluatePlayable(b[user].hand[0],user).ok,true);
  let completed=false;
  if(cfg.remote)S.onlineApplyIntent({type:'card',idx:0,name:'妖刀五月雨'},()=>completed=true);
  else if(cfg.ai)S.aiUseCardComplete(0,()=>completed=true);
  else S.useCard(0);
  const quiet=await L.quiesce(i,14000);
  C.eq(label+'完整收尾',quiet.ok,true);C.eq(label+'扣5费',b[user].cost,15);C.eq(label+'无提前选人',targets.length,0);C.eq(label+'无执行错误',i.errs,[]);
  if(cfg.remote||cfg.ai)C.eq(label+'入口回调完成',completed,true);
  const chosenPool=pools.find(x=>sp?!/发动时/.test(x.title):/发动时/.test(x.title));
  if(chosenPool&&!cfg.empty){
    C.eq(label+'池含双方四区',zones.every(z=>chosenPool.entries.some(x=>x.side===user&&x.zone===z)&&chosenPool.entries.some(x=>x.side===foe&&x.zone===z)),true);
    C.eq(label+'无手牌牌组墓地移出',chosenPool.entries.some(x=>!zones.includes(x.zone)),false);
    C.eq(label+'对手暗区仅展示保密占位',chosenPool.entries.filter(x=>x.side===foe&&x.zone!=='permanent').every(x=>x.hidden&&!x.hasImage&&/内容保密/.test(x.view)),true);
    C.eq(label+'双方归属用相对称呼',chosenPool.entries.every(x=>x.view.includes(x.side===user?'（自己·':'（对手·')||cfg.p3),true);
  }
  if(cfg.zone&&!cfg.empty){
    const owner=cfg.side==='self'?user:foe;
    C.eq(label+'选中原卡离开原区',b[owner][cfg.zone].includes(victim),false);
    const publicCard=cfg.zone==='eventCards'||cfg.zone==='musicCards';
    C.eq(label+'原卡进入正确墓地',publicCard?S.publicGraveyard[victim._category].includes(victim):b[owner].grave.includes(victim),true);
    if(publicCard)C.eq(label+'不误入个人墓地',b[owner].grave.includes(victim),false);
  }
  if(cfg.decline){C.eq(label+'放弃不造伤',damage.length,0);C.eq(label+'跳过可选后段失同步',b[user].sync,30);}
  else if(cfg.selfSource){C.eq(label+'本体离场后不继续造伤',damage.length,0);C.eq(label+'本体墓地仅一张',b[user].grave.filter(c=>c===victim).length,1);C.eq(label+'本体不复活',b[user].permanent.includes(victim),false);}
  else{C.eq(label+'只打选定其他玩家',damage,[{target:cfg.p3?'p3':foe,amount:5}]);C.eq(label+'目标实际失5同步',b[cfg.p3?'p3':foe].sync,25);C.eq(label+'自身同步',b[user].sync,(sp&&cfg.spChoice!=='skip')||cfg.ai?24:27);}
  if(sp){
    C.eq(label+'次数只在适用后消耗',!!b[user]._yaodaoTriggered,cfg.spChoice!=='skip');
    if(cfg.spChoice==='draw')C.eq(label+'②真实抽1',b[user].hand.some(c=>c._probe===user+'/deck'),true);
    const again=S.__scanTriggers('after-damage',{attacker:user,target:foe,value:5}).filter(x=>x.id==='yaodao-after-damage');
    C.eq(label+'再次触发资格',again.length,cfg.spChoice==='skip'?1:0);
  }
  if(cfg.p3)C.eq(label+'未选p2不受伤',b.p2.sync,30);
  console.log('场景 '+label+'；伤害='+JSON.stringify(damage)+'；候选='+JSON.stringify((chosenPool&&chosenPool.entries||[]).map(x=>x.id))+'；errors='+JSON.stringify(i.errs)+(cfg.remote?'；远端问题='+JSON.stringify(asks):''));
  for(const h of timers)S.clearTimeout(h);for(const h of intervals)S.clearInterval(h);
}
(async()=>{
  const jobs=[];
  for(const mode of ['activation','sp'])for(const user of ['p1','p2'])for(const side of ['self','foe'])for(const zone of zones)jobs.push({mode,user,side,zone,remote:user==='p2'});
  jobs.push({decline:true,zone:'permanent',side:'foe'},{p3:true,zone:'permanent',side:'foe'},{selfSource:true},{empty:true,decline:true},
    {mode:'sp',spChoice:'draw'},{mode:'sp',spChoice:'skip'},{user:'p2',remote:true,decline:true},{user:'p2',ai:true});
  const filtered=process.argv.includes('--remote-one')?jobs.filter(c=>c.user==='p2'&&c.mode==='activation'&&c.side==='self'&&c.zone==='faceDownCards'):jobs;
  let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<filtered.length)await scene(filtered[cursor++]);}));
  clearTimeout(watchdog);process.exit(C.summary());
})().catch(e=>{console.error(e.stack);process.exit(1);});
