/* 编组合法性：同名不同形态不串用 + 道具永续≤2/不重复 + 校验器拦截 */
const { chromium } = require('playwright-core');
let pass=0,fail=0;const ok=(c,m)=>{if(c){pass++;console.log('  ✓',m);}else{fail++;console.log('  ✗',m);}};
(async()=>{
  const b=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']});
  const page=await b.newPage({viewport:{width:1440,height:900}});
  const errs=[];page.on('pageerror',e=>errs.push(e.message));
  await page.goto('file:///home/user/.super_doubao/super-doubao-runtime/workspace/rujuzhe_game.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#mainMenu.active'),{timeout:8000});
  const R=await page.evaluate(()=>{
    const out={archN:0,badCarry:[],badItem:[]};
    const findC=nm=>allCards.find(c=>c.name===nm);
    const pouxi=findC('剖析'), shuiqiang=findC('水枪攻击！');
    const waterTeam=['现实间里绪','予(水着)','星奈(水着)'];
    out.pouxi_water=cardBelongsToTeam(pouxi,waterTeam);
    out.shuiqiang_water=cardBelongsToTeam(shuiqiang,waterTeam);
    out.pouxi_normal=cardBelongsToTeam(pouxi,['入间予','小野结衣','木原光太郎']);
    out.shortNoLeak=cardBelongsToTeam({character:'予'},['予(水着)']); // 短名只认全等=>false

    // 遍历全部流派智能构筑
    ARCH_LIST.forEach(arch=>{
      out.archN++;
      const d=buildSmartDeck(arch), tn=d.chars.map(c=>c.name);
      d.carries.forEach(c=>{ if(!cardBelongsToTeam(c,tn)) out.badCarry.push(arch+'/'+c.name+'('+c.character_full+')'); });
      const perm=d.items.filter(c=>c._category==='item_permanent').length;
      const in_=d.items.map(c=>c.name), dup=in_.some((n,i)=>in_.indexOf(n)!==i);
      const cn=d.carries.map(c=>c.name), cdup=cn.some((n,i)=>cn.indexOf(n)!==i);
      const req={'无序':2};
      d.chars.forEach(c=>{if(c.attribute&&c.attribute!=='混沌')req[c.attribute]=(req[c.attribute]||0)+2;});
      const have={};d.items.forEach(c=>{if(c.attribute)have[c.attribute]=(have[c.attribute]||0)+1;});
      const attrBad=Object.keys(req).filter(a=>(have[a]||0)<req[a]).map(a=>a+'需'+req[a]+'有'+(have[a]||0));
      if(perm>2||dup||cdup||attrBad.length||d.chars.length!==3||d.items.length!==8||d.carries.length!==4)
        out.badItem.push(arch+' perm='+perm+' dup='+dup+' cdup='+cdup+' 属性['+attrBad.join(',')+'] n='+d.chars.length+'/'+d.items.length+'/'+d.carries.length);
    });

    // 合法基线
    const goodChars=['现实间里绪','予(水着)','星奈(水着)'];
    const goodItems=['设计师的直尺','钢笔','Twice','侦探放大镜','遥控骰子','柔软枕头','四叶草发卡','魔法清点名单'];
    const legalCarry=allCards.filter(c=>(c._category==='attack_cards'||c._category==='skill_cards')&&cardBelongsToTeam(c,goodChars)).map(c=>c.name);
    out.legalCarryN=legalCarry.length;
    function setDeck(items,carries){deckConfig.p1={chars:goodChars.map(findC),items:items.map(findC),carries:carries.map(findC)};}
    // 3a 剖析混队被拦（其余3张合法）
    setDeck(goodItems,[legalCarry[0],legalCarry[1],legalCarry[2],'剖析']);
    out.v_pouxi=validateDeck('p1').some(e=>e.indexOf('剖析')>=0);
    // 3b 永续3张被拦（携带4张全合法）
    const anotherPerm=allCards.find(c=>c._category==='item_permanent'&&goodItems.indexOf(c.name)<0);
    const items3p=goodItems.filter(n=>findC(n)._category!=='item_permanent').concat(['设计师的直尺','钢笔',anotherPerm.name]);
    setDeck(items3p,legalCarry.slice(0,4));
    out.v_perm3=validateDeck('p1').some(e=>e.indexOf('永续')>=0);
    // 3c 同名道具重复被拦
    setDeck(goodItems.slice(0,7).concat(['设计师的直尺']),legalCarry.slice(0,4));
    out.v_dupItem=validateDeck('p1').some(e=>e.indexOf('重复')>=0);
    // 3c2 属性不足(截图那套:无序缺1/理智缺1)被拦
    setDeck(goodItems,legalCarry.slice(0,4));
    out.v_attrLack=validateDeck('p1').some(e=>e.indexOf('属性道具不足')>=0);
    // 3d 合法基线：按硬需求(无序2+每非混沌角色属性2)动态构造8张，应无报错
    const legalItems=(function(){const req={'无序':2};goodChars.map(findC).forEach(c=>{if(c.attribute!=='混沌')req[c.attribute]=(req[c.attribute]||0)+2;});const pool=allCards.filter(c=>c._category==='item_permanent'||c._category==='item_single');const res=[],used={};let pn=0;Object.keys(req).forEach(attr=>{let n=req[attr];pool.forEach(c=>{if(n>0&&!used[c.name]&&c.attribute===attr&&(c._category!=='item_permanent'||pn<2)){used[c.name]=1;if(c._category==='item_permanent')pn++;res.push(c.name);n--;}});});return res;})();
    out.legalItemN=legalItems.length;
    setDeck(legalItems,legalCarry.slice(0,4));
    out.v_clean=validateDeck('p1');

    // 4 战斗内发动校验
    setDeck([],[]);
    out.team_blockPouxi=teamHasCardCharacter('p1',pouxi);
    out.team_allowShuiqiang=teamHasCardCharacter('p1',shuiqiang);
    return out;
  });
  ok(R.pouxi_water===false,'剖析(入间予)不属于予(水着)队伍');
  ok(R.shuiqiang_water===true,'水枪攻击(予水着)属于水着队');
  ok(R.pouxi_normal===true,'剖析在含入间予的队伍合法');
  ok(R.shortNoLeak===false,'短名包含不再导致形态串用');
  ok(R.archN>=6,'遍历全部流派('+R.archN+'个)');
  ok(R.badCarry.length===0,'所有流派智能构筑无跨形态携带: '+(R.badCarry.join(';')||'无'));
  ok(R.badItem.length===0,'所有流派道具永续≤2/无同名/数量正确: '+(R.badItem.join(';')||'无'));
  ok(R.legalCarryN>=4,'水着队合法携带≥4张(实='+R.legalCarryN+')');
  ok(R.v_pouxi===true,'validateDeck 拦死剖析混队');
  ok(R.v_perm3===true,'validateDeck 拦截永续>2');
  ok(R.v_dupItem===true,'validateDeck 拦截同名道具重复');
  ok(R.v_attrLack===true,'validateDeck 拦截道具属性配额不足');
  ok(R.legalItemN===8,'合法道具按硬需求凑满8张(实='+R.legalItemN+')');
  ok(R.v_clean.length===0,'合法基线无报错: '+(R.v_clean.join(';')||'无'));
  ok(R.team_blockPouxi===false,'战斗内水着队不能发动普通予剖析');
  ok(R.team_allowShuiqiang===true,'战斗内水着队可发动予(水着)水枪');
  ok(errs.length===0,'无页面错误: '+(errs.join(';')||'无'));
  await b.close();
  console.log('E2E_deck 结果 pass='+pass+' fail='+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(2);});
