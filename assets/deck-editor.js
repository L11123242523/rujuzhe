/* v567：编辑只写草稿，云端写入仍由显式保存按钮负责。 */
(function(root,factory){'use strict';if(typeof module==='object'&&module.exports)module.exports=factory(require('./cloud-decks.js'));else root.RJDeckEditor=factory(root.RJCloudDecks);})(typeof globalThis!=='undefined'?globalThis:this,function(cloud){
  'use strict';
  var slots=[['chars',3,['characters'],'角色'],['items',8,['item_single','item_permanent'],'道具'],['carries',4,['attack_cards','skill_cards'],'携带']];
  function issue(message){throw Error(message);}
  function create(catalog,cards){
    var codec=cloud.createCodec(catalog),records=catalog.cards.filter(function(c){return c.collectible&&!c.public&&slots.some(function(s){return s[2].includes(c.category);});});
    function migrate(slim){var data={version:1};slots.forEach(function(s){var arr=slim&&slim[s[0]];if(!Array.isArray(arr)||arr.length>s[1])issue(s[3]+'旧卡组槽位无效');data[s[0]]=Array.from({length:s[1]},function(_,i){var name=arr[i];if(name==null)return null;var found=records.filter(function(c){return c.name===name&&s[2].includes(c.category);});if(found.length!==1)issue('旧卡名无法唯一对应：'+name+'（'+s[3]+'），原数据保留');return found[0].id;});});return codec.validate(data);}
    function add(data,id,kind,index){data=codec.validate(data);var card=records.find(function(c){return c.id===id;}),s=slots.find(function(v){return v[2].includes(card&&card.category);});if(!s)issue('卡片不可编入');if(kind&&kind!==s[0])issue('请放入对应类别槽位');kind=s[0];if(index==null)index=data[kind].indexOf(null);if(index<0||index>=s[1])issue(s[3]+'槽位已满，请先移除卡片');data[kind][index]=id;return codec.validate(data);}
    return {codec:codec,records:records,migrate:migrate,add:add,decode:function(data){return codec.decode(data,cards);}};
  }
  var store=null,model=null,bound=false,drag=null,suppressClick=false,migrationError='';
  function ready(){return !!store&&typeof allCards!=='undefined'&&allCards.length>0;}
  function getModel(){if(!ready())issue('卡库尚未就绪');if(!model)model=create(store.getCatalog(),allCards);return model;}
  function init(value){store=value;bind();}
  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function state(){return cloud.state();}
  function locked(){return (!cloud.accountMode()&&!!migrationError)||cloud.blocked()||(typeof RJOnlineAccess!=='undefined'&&typeof Online!=='undefined'&&!!(Online.connected||Online.active||Online._entryPending||(Online.ws&&Online.ws.readyState<2)));}
  function owned(id){try{return store.getSnapshot().owned[id]||0;}catch(e){return null;}}
  function mode(){return state().accountId?state().mode:(deckSetMode==='online'?'match':'casual');}
  function record(id){return getModel().records.find(function(c){return c.id===id;});}
  function unowned(c){return mode()==='match'&&!(owned(c.id)>0);}
  function cardHtml(c,kind,index){var source=getModel().decode((function(){var d={version:1,chars:Array(3).fill(null),items:Array(8).fill(null),carries:Array(4).fill(null)};var s=slots.find(function(v){return v[2].includes(c.category);});d[s[0]][0]=c.id;return d;})()),s=slots.find(function(v){return v[2].includes(c.category);}),card=source[s[0]][0],missing=unowned(c);
    return '<button type="button" class="md-card '+(kind?'deck-slot filled ':'')+(missing?(kind?'online-unowned':'md-unowned'):'')+'" data-card-id="'+esc(c.id)+'"'+(kind?' data-kind="'+kind+'" data-index="'+index+'"':'')+' aria-label="'+esc(c.name+(kind?'，点击移除':'，点击编入'))+'"'+(locked()?' disabled':'')+'>'+(card.image_url?'<img loading="lazy" decoding="async" draggable="false" src="'+esc(card.image_url)+'" alt="">':'')+'<span class="md-rarity">'+esc(c.rarity)+'</span>'+(missing?'<span class="'+(kind?'online-lock':'md-lock')+'">🔒 未持有</span>':'')+'<span class="deck-slot-name">'+esc(c.name)+'</span></button>';
  }
  function render(){
    if(!ready())return;var panel=document.getElementById('mdCollection');if(!panel)return;
    try{var m=getModel(),data=m.codec.encode(deckConfig.p1),count=0,missing=0;
      slots.forEach(function(s){var el=document.getElementById('p1'+({chars:'Chars',items:'Items',carries:'Carries'}[s[0]]));el.innerHTML=data[s[0]].map(function(id,i){if(id){count++;var c=record(id);if(unowned(c))missing++;return cardHtml(c,s[0],i);}return '<button type="button" class="deck-slot md-empty" data-kind="'+s[0]+'" data-index="'+i+'" aria-label="空'+s[3]+'槽位'+(i+1)+'"'+(locked()?' disabled':'')+'>＋</button>';}).join('');});
      document.getElementById('mdDeckSummary').textContent=migrationError||count+'/15 · '+(count===15?'槽位已满':'尚未编满')+(mode()==='match'?' · 未持有 '+missing+' 张':' · 全卡可选');
      var q=document.getElementById('mdSearch').value.trim().toLowerCase(),category=document.getElementById('mdCategory').value,rarity=document.getElementById('mdRarity').value,filter=document.getElementById('mdOwned').value;
      var list=m.records.filter(function(c){var s=slots.find(function(v){return v[2].includes(c.category);}),source=allCards.find(function(v){return v.name===c.name&&v._category===c.category;}),text=c.name+' '+(source&&[source.effect,source.passive,source.sp].filter(Boolean).join(' ')||'');return (!q||text.toLowerCase().includes(q))&&(!category||s[0]===category)&&(!rarity||c.rarity===rarity)&&(!filter||((owned(c.id)>0)===(filter==='yes')));});
      panel.innerHTML=list.map(function(c){return cardHtml(c);}).join('')||'<p class="md-help">没有符合条件的卡片</p>';document.getElementById('mdLibraryCount').textContent=list.length+' 张';
    }catch(e){document.getElementById('mdDeckSummary').textContent=e.message;}
  }
  function apply(data){deckConfig.p1=getModel().decode(data);saveDeckConfig();render();}
  function mutate(action){if(locked()){showToast('当前卡组只读，请重新读取或退出房间后编辑','warn');return;}try{apply(action(getModel().codec.encode(deckConfig.p1)));}catch(e){showToast(e.message,'warn');}}
  function migrate(slim){return getModel().migrate(slim);}
  function loadGuest(slim){try{var resolved={};['p1','p2'].forEach(function(p){if(slim[p])resolved[p]=getModel().decode(migrate(slim[p]));});Object.keys(resolved).forEach(function(p){deckConfig[p]=resolved[p];});migrationError='';return true;}catch(e){migrationError=e.message;showToast(e.message,'warn');return false;}}
  function finish(event,cancel){if(!drag||event.pointerId!==drag.id)return;var d=drag;drag=null;d.node.classList.remove('md-drag-source');if(d.ghost)d.ghost.remove();if(!d.active||cancel)return;suppressClick=true;var hit=document.elementFromPoint(event.clientX,event.clientY),target=hit&&hit.closest('[data-kind]'),library=hit&&hit.closest('#mdLibraryPanel');
    if(!d.kind&&!target)return;if(d.kind&&target&&target.dataset.kind===d.kind&&Number(target.dataset.index)===d.index)return;
    mutate(function(data){if(d.kind){if(!target||library){data[d.kind][d.index]=null;return data;}if(target.dataset.kind!==d.kind)issue('请放入对应类别槽位');var to=Number(target.dataset.index),other=data[d.kind][to];data[d.kind][to]=d.card;data[d.kind][d.index]=other;return getModel().codec.validate(data);}return getModel().add(data,d.card,target.dataset.kind,Number(target.dataset.index));});
  }
  function bind(){if(bound||typeof document==='undefined')return;var root=document.getElementById('deckBuilder');if(!root)return;bound=true;
    ['mdSearch','mdCategory','mdRarity','mdOwned'].forEach(function(id){document.getElementById(id).addEventListener(id==='mdSearch'?'input':'change',render);});
    root.addEventListener('click',function(e){if(suppressClick){suppressClick=false;e.preventDefault();return;}var node=e.target.closest('.md-card,.md-empty');if(!node)return;var kind=node.dataset.kind;if(!node.dataset.cardId){document.getElementById('mdCategory').value=kind;render();return;}mutate(function(data){if(kind){data[kind][Number(node.dataset.index)]=null;return data;}return getModel().add(data,node.dataset.cardId);});});
    root.addEventListener('pointerdown',function(e){suppressClick=false;var node=e.target.closest('.md-card');if(!node||e.button!==0||locked())return;drag={id:e.pointerId,node:node,card:node.dataset.cardId,kind:node.dataset.kind,index:Number(node.dataset.index),x:e.clientX,y:e.clientY,active:false};node.setPointerCapture(e.pointerId);});
    root.addEventListener('pointermove',function(e){if(!drag||e.pointerId!==drag.id)return;if(!drag.active&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)<8)return;e.preventDefault();if(!drag.active){drag.active=true;drag.node.classList.add('md-drag-source');drag.ghost=drag.node.cloneNode(true);drag.ghost.className='md-drag-ghost';drag.ghost.removeAttribute('id');document.body.appendChild(drag.ghost);}drag.ghost.style.left=e.clientX+'px';drag.ghost.style.top=e.clientY+'px';if(e.clientY<50)root.scrollTop-=24;else if(e.clientY>innerHeight-50)root.scrollTop+=24;});
    root.addEventListener('pointerup',function(e){finish(e,false);});root.addEventListener('pointercancel',function(e){finish(e,true);});root.addEventListener('lostpointercapture',function(e){finish(e,true);});
  }
  return Object.freeze({create:create,init:init,ready:ready,render:render,migrate:migrate,loadGuest:loadGuest,migrationBlocked:function(){return !cloud.accountMode()&&!!migrationError;}});
});
