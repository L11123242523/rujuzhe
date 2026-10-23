/* 卡包抽样：只读配置，随机源独立于战斗；本模块不接触任何战斗状态。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.RJPacks=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 function fail(code,message){var e=new Error(message);e.code=code;throw e;}
 function createSampler(catalog,rules,options){
  options=options||{};var pool=JSON.parse(JSON.stringify(rules.pools.standard)),cards=catalog.cards.filter(function(c){return c.collectible&&!c.public;}),groups={},cryptoSource=options.crypto||(typeof globalThis!=='undefined'&&globalThis.crypto);
  cards.forEach(function(c){(groups[c.rarity]||(groups[c.rarity]=[])).push(c.id);});
  if(cards.length!==136||new Set(cards.map(function(c){return c.id;})).size!==136)fail('PACK_CATALOG','抽取目录必须为136张唯一可收藏卡');
  Object.keys(pool.ordinaryWeights).forEach(function(r){if(pool.ordinaryWeights[r]>0&&(!groups[r]||!groups[r].length))fail('PACK_CATALOG','稀有度卡池为空：'+r);});
  var random=options.random||function(){if(!cryptoSource||typeof cryptoSource.getRandomValues!=='function')fail('PACK_RANDOM','独立安全随机源不可用');return cryptoSource.getRandomValues(new Uint32Array(1))[0]/4294967296;};
  function draw(){var n=random();if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>=1)fail('PACK_RANDOM','随机值必须位于[0,1)');return n;}
  function rarity(weights){var keys=Object.keys(weights),total=keys.reduce(function(sum,k){var w=weights[k];if(!Number.isFinite(w)||w<0)fail('PACK_RULES','概率权重无效');return sum+w;},0);if(total<=0)fail('PACK_RULES','概率总权重必须大于0');var value=draw()*total;for(var i=0;i<keys.length;i++){value-=weights[keys[i]];if(value<0)return keys[i];}fail('PACK_RANDOM','概率抽样未命中');}
  function sample(pityBefore,owned){
   if(!Number.isSafeInteger(pityBefore)||pityBefore<0)fail('PACK_PITY','保底计数无效');
   owned=owned||{};var seen={},result=[],hasUR=false,forced=false;
   for(var slot=1;slot<=pool.cardsPerPack;slot++){
    var force=slot===pool.pity.replacementSlot&&pityBefore>=pool.pity.afterMisses&&!hasUR;
    var r=force?pool.pity.rarity:rarity(slot===pool.guaranteedSlot.position?pool.guaranteedSlot.weights:pool.ordinaryWeights),list=groups[r];
    if(!list||!list.length)fail('PACK_CATALOG','保证稀有度卡池为空');
    var id=list[Math.floor(draw()*list.length)],duplicate=(owned[id]||0)+(seen[id]||0)>0;seen[id]=(seen[id]||0)+1;
    result.push({cardId:id,rarity:r,duplicate:duplicate});if(r===pool.pity.rarity)hasUR=true;if(force)forced=true;
   }
   return {cards:result,pityBefore:pityBefore,pityAfter:hasUR&&pool.pity.resetOnAnyUR?0:pityBefore+1,forced:forced};
  }
  return Object.freeze({sample:sample,getPool:function(){return JSON.parse(JSON.stringify(pool));}});
 }
 return Object.freeze({createSampler:createSampler});
});
