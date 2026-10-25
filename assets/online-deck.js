/* v556：前后端共享的联机槽位规范，顺序和重复均参与签名。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory();else root.RJOnlineDeck=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var slots=[['chars',3,['characters']],['items',8,['item_single','item_permanent']],['carries',4,['attack_cards','skill_cards']]];
  function fail(message){var e=new Error(message);e.code='ONLINE_DECK_INVALID';throw e;}
  function create(catalog){
    var byId=new Map(catalog.cards.map(function(c){return [c.id,c];}));
    function record(card){
      if(!card||typeof card!=='object')fail('联机卡组有空槽位');
      var found=catalog.cards.filter(function(c){return c.category===card._category&&c.name===card.name;});
      if(found.length!==1||(card.collectionId&&card.collectionId!==found[0].id))fail('卡片与收藏ID未精确绑定');
      return found[0];
    }
    function ids(cards){
      if(!Array.isArray(cards)||cards.length!==15||cards.some(function(id){return typeof id!=='string';}))fail('联机卡组须为3角色、8道具、4携带的完整槽位ID');
      var offset=0;
      slots.forEach(function(s){cards.slice(offset,offset+s[1]).forEach(function(id){var c=byId.get(id);if(!c||!c.collectible||c.public||s[2].indexOf(c.category)<0)fail('联机卡组槽位类型或卡ID无效');});offset+=s[1];});
      return cards.slice();
    }
    function fromCfg(cfg,strict){
      if(!cfg||typeof cfg!=='object'||Object.keys(cfg).some(function(k){return !slots.some(function(s){return s[0]===k;});}))fail('联机卡组字段无效');
      return ids([].concat.apply([],slots.map(function(s){
        if(!Array.isArray(cfg[s[0]])||cfg[s[0]].length!==s[1])fail('联机卡组槽位不完整');
        return cfg[s[0]].map(function(c){var r=record(c);if(strict&&c.collectionId!==r.id)fail('实际卡组缺少稳定卡ID');return r.id;});
      })));
    }
    function bind(cfg){var copy=JSON.parse(JSON.stringify(cfg));slots.forEach(function(s){if(!Array.isArray(copy[s[0]]))fail('联机卡组槽位缺失');copy[s[0]].forEach(function(c){c.collectionId=record(c).id;});});fromCfg(copy,true);return copy;}
    async function hash(cards,crypt){var list=ids(cards),canonical=JSON.stringify({chars:list.slice(0,3),items:list.slice(3,11),carries:list.slice(11,15)});return Array.from(new Uint8Array(await (crypt||globalThis.crypto).subtle.digest('SHA-256',new TextEncoder().encode(canonical))),function(x){return x.toString(16).padStart(2,'0');}).join('');}
    return Object.freeze({ids:ids,record:record,fromCfg:fromCfg,bind:bind,hash:hash,byId:byId});
  }
  return Object.freeze({create:create});
});
