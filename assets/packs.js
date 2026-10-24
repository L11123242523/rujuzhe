/* 游客抽样：只读双池配置，随机源独立；整批交给profile一次保存。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.RJPacks=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';function fail(code,message){var e=new Error(message);e.code=code;throw e;}
 function createSampler(catalog,rules,options){
  options=options||{};var poolId=options.poolId||'character',pool=rules.pools[poolId],groups={},cryptoSource=options.crypto||(typeof globalThis!=='undefined'&&globalThis.crypto);
  if(!Object.hasOwn(rules.pools,poolId)||pool.legacyOnly!==false)fail('PACK_POOL','该卡池不开放新开包');
  var cards=catalog.cards.filter(function(c){return c.collectible&&!c.public&&pool.categories.includes(c.category);});
  if(cards.length!==pool.cardCount||new Set(cards.map(function(c){return c.id;})).size!==pool.cardCount)fail('PACK_CATALOG','卡池目录范围或张数冲突');
  cards.forEach(function(c){(groups[c.rarity]||(groups[c.rarity]=[])).push(c.id);});
  var random=options.random||function(){if(!cryptoSource||typeof cryptoSource.getRandomValues!=='function')fail('PACK_RANDOM','独立安全随机源不可用');return cryptoSource.getRandomValues(new Uint32Array(1))[0]/4294967296;};
  function draw(){var n=random();if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>=1)fail('PACK_RANDOM','随机值必须位于[0,1)');return n;}
  function rarity(weights){var value=draw()*Object.values(weights).reduce(function(a,b){return a+b;},0);for(var entry of Object.entries(weights)){value-=entry[1];if(value<0)return entry[0];}fail('PACK_RANDOM','概率抽样未命中');}
  function sample(pityBefore,owned,count){
   if(count===undefined)count=1;if(!Number.isSafeInteger(count)||!rules.allowedCounts.includes(count))fail('PACK_COUNT','包数只能为1、5、10');
   if(!Number.isSafeInteger(pityBefore)||pityBefore<0)fail('PACK_PITY','保底计数无效');
   owned=owned||{};var seen={},all=[],packs=[],pity=pityBefore;
   for(var pack=0;pack<count;pack++){
    var result=[],hasUR=false,forced=false;
    for(var slot=1;slot<=pool.cardsPerPack;slot++){
     var force=slot===pool.pity.replacementSlot&&pity>=pool.pity.afterMisses&&!hasUR;
     var r=force?pool.pity.rarity:rarity(slot===pool.guaranteedSlot.position?pool.guaranteedSlot.weights:pool.ordinaryWeights),list=groups[r];if(!list||!list.length)fail('PACK_CATALOG','稀有度卡池为空');
     var id=list[Math.floor(draw()*list.length)];result.push({cardId:id,rarity:r,duplicate:(owned[id]||0)+(seen[id]||0)>0});seen[id]=(seen[id]||0)+1;if(r===pool.pity.rarity)hasUR=true;if(force)forced=true;
    }
    var after=hasUR?0:pity+1;packs.push({cards:result,pityBefore:pity,pityAfter:after,forced:forced});all.push.apply(all,result);pity=after;
   }
   return {cards:all,packs:packs,ticketsSpent:count*pool.ticketCost,pityBefore:pityBefore,pityAfter:pity,forced:packs.some(function(p){return p.forced;})};
  }
  return Object.freeze({sample:sample,getPool:function(){return JSON.parse(JSON.stringify(pool));}});
 }
 return Object.freeze({createSampler:createSampler});
});
