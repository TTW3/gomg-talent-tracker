(()=>{
const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[-_]+/g,' ').replace(/[^a-z0-9+% ]/g,' ').replace(/\s+/g,' ').trim();
const KEY='gomg-gear-loadout-v1',LEGACY_KEY='gomg-gear-loadout-legacy-v1',STAR_KEY='gomg-gear-loadout-stars-v1';let chars=[],gears=[],current='',loadouts={},legacyUsage={},gearStars={},activeSlot='';
const slots=['Head','Necklace','Body','Gloves','Shoes','Belt','Ring','Badge','Main','Off'];
function installGearLoadoutStyles(){
 if(document.getElementById('gearLoadoutOnlyStyles'))return;
 const style=document.createElement('style');style.id='gearLoadoutOnlyStyles';
 style.textContent=`
 /* Gear Loadout only. Do not affect other tabs. */
 /* Complete Gear Loadout layout; all selectors are scoped to this view. */
 #gearLoadoutView .gl-layout{display:grid;grid-template-columns:minmax(0,1.08fr) minmax(0,.92fr);gap:12px;align-items:start}
 #gearLoadoutView .gl-stage,#gearLoadoutView .gl-panel{min-width:0;border:1px solid var(--line,#e7c8b5);border-radius:11px;background:#fffaf5;padding:10px}
 #gearLoadoutView .gl-stage-title{text-align:center;font-weight:800;font-size:16px;margin:1px 0 10px;color:var(--text,#402a20)}
 #gearLoadoutView .gl-board{position:relative;width:100%;height:560px;min-height:560px;box-sizing:border-box;border:1px dashed #e7bda2;border-radius:12px;background:radial-gradient(ellipse at center,#fff0e4 0%,#fffaf5 68%);overflow:visible}
 #gearLoadoutView .gl-slot{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;gap:4px;width:94px;min-height:90px;padding:25px 5px 7px;box-sizing:border-box;border:1px solid #d7a181;border-radius:9px;background:#fffdf9;color:var(--text,#402a20);box-shadow:0 2px 5px #6e493414;cursor:pointer;text-align:center;z-index:3;white-space:normal}
#gearLoadoutView .gl-slot:hover{border-color:#9d6547;box-shadow:0 3px 9px #6e49341f;transform:translateY(-1px)}
 /* Preserve horizontal centering for the Head and Badge slots during hover. */
 #gearLoadoutView .gl-pos-head:hover{transform:translate(-50%,-1px)}
 #gearLoadoutView .gl-pos-badge:hover{transform:translate(-50%,-1px)}
 #gearLoadoutView .gl-slot:focus-visible{outline:2px solid #a77a5a;outline-offset:2px}
 #gearLoadoutView .gl-slot img{width:25px;height:25px;object-fit:contain}
 #gearLoadoutView .gl-slot b{font-size:11px;line-height:1.15}
 #gearLoadoutView .gl-slot small{font-size:9px;line-height:1.25;overflow-wrap:anywhere;color:#7b4e38}
 #gearLoadoutView .gl-slot-icon{font-size:18px;line-height:22px;color:#9c6748}
 #gearLoadoutView .gl-pos-head{top:3%;left:50%;transform:translateX(-50%)}
 #gearLoadoutView .gl-pos-necklace{top:20%;left:5%}
 #gearLoadoutView .gl-pos-body{top:20%;right:5%}
 #gearLoadoutView .gl-pos-gloves{top:43%;left:2%}
 #gearLoadoutView .gl-pos-shoes{top:43%;right:2%}
 #gearLoadoutView .gl-pos-belt{top:65%;left:5%}
 #gearLoadoutView .gl-pos-ring{top:65%;right:5%}
 #gearLoadoutView .gl-pos-main{top:64%;left:34%;z-index:4}
 #gearLoadoutView .gl-pos-off{top:64%;right:34%;z-index:4}
 #gearLoadoutView .gl-pos-badge{bottom:2%;left:50%;transform:translateX(-50%);z-index:8!important}
 #gearLoadoutView .gl-avatar{position:absolute;left:50%;top:45%;transform:translate(-50%,-50%);width:42%;height:48%;display:flex;align-items:center;justify-content:center;pointer-events:none;z-index:1}
 #gearLoadoutView .gl-avatar img{width:100%;height:100%;object-fit:contain}
 #gearLoadoutView .gl-avatar span{font-size:42px;color:#b98c70}
 #gearLoadoutView .gl-avatar small{font-size:9px;color:var(--muted,#806d60)}
 #gearLoadoutView .gl-note{text-align:center;color:var(--muted,#806d60);font-size:10px;margin:9px 0 0}
 #gearLoadoutView .gl-side{display:flex;flex-direction:column;gap:10px;min-width:0}
 #gearLoadoutView .gl-panel h3{font-size:13px;margin:0 0 9px}
 #gearLoadoutView .gl-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
 #gearLoadoutView .gl-stat{display:flex;justify-content:space-between;gap:8px;padding:7px 8px;border:1px solid #ead9ca;border-radius:7px;background:#fffdf9;font-size:11px}
 #gearLoadoutView .gl-empty{font-size:11px;color:var(--muted,#806d60);line-height:1.45}
 #gearLoadoutView .gl-gear-results{display:flex;flex-direction:column;gap:6px;margin-top:8px}
 #gearLoadoutView .gl-gear-item{display:flex;align-items:center;gap:9px;width:100%;min-width:0;padding:8px;border:1px solid #e7c8b5;border-radius:8px;background:#fffdf9;color:var(--text,#402a20);text-align:left;cursor:pointer}
 #gearLoadoutView .gl-gear-item img{width:38px;height:38px;flex:0 0 38px;object-fit:contain;border-radius:6px;background:#f4e3d6}
 #gearLoadoutView .gl-gear-item>span{display:flex;flex-direction:column;gap:3px;min-width:0}
 #gearLoadoutView .gl-gear-item b{font-size:12px}
 #gearLoadoutView .gl-gear-item small{font-size:10px;color:var(--muted,#806d60);overflow-wrap:anywhere}
 #gearLoadoutView .gl-picker-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 #gearLoadoutView .gl-picker-filters select{width:100%;min-width:0}
 #gearLoadoutView .gl-toolbar{display:flex;align-items:end;gap:10px;flex-wrap:wrap;margin-bottom:15px}
 #gearLoadoutView .gl-character-field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted,#806d60);min-width:260px;flex:1 1 320px}
 #gearLoadoutView .gl-character-autocomplete{position:relative;width:100%;min-width:0}
 #gearLoadoutView .gl-character-autocomplete input{width:100%;box-sizing:border-box}
 @media(max-width:850px){#gearLoadoutView .gl-layout{grid-template-columns:minmax(0,1fr)}#gearLoadoutView .gl-board{height:560px}#gearLoadoutView .gl-stage,#gearLoadoutView .gl-panel{padding:9px}}
 @media(max-width:520px){#gearLoadoutView .gl-board{height:500px;min-height:500px}#gearLoadoutView .gl-slot{width:78px;min-height:82px;padding-left:3px;padding-right:3px}#gearLoadoutView .gl-pos-main{left:30%}#gearLoadoutView .gl-pos-off{right:30%}#gearLoadoutView .gl-avatar{width:44%;height:43%}#gearLoadoutView .gl-picker-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}

 #gearLoadoutView .gl-board{min-height:540px;overflow:visible}
 #gearLoadoutView .gl-pos-badge{bottom:2%;z-index:8!important}
 #gearLoadoutView .gl-pos-main,#gearLoadoutView .gl-pos-off{z-index:2}
 #gearLoadoutView .gl-board{height:560px;min-height:560px;overflow:visible!important}

 #gearLoadoutView .gl-toolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:15px}
 #gearLoadoutView .gl-character-field{display:flex;flex-direction:column;gap:5px;font-size:12px;color:var(--muted);min-width:260px;flex:1 1 320px}
 #gearLoadoutView .gl-character-autocomplete{position:relative;width:100%;min-width:0}
 #gearLoadoutView .gl-character-autocomplete input{width:100%;min-width:0;box-sizing:border-box}
 #gearLoadoutView .gl-character-suggestions{display:none;position:absolute;left:0;right:0;top:calc(100% + 4px);max-height:300px;overflow:auto;background:#fffaf5;border:1px solid var(--line);border-radius:10px;box-shadow:0 8px 22px #6e493426;z-index:1200;touch-action:pan-y;-webkit-overflow-scrolling:touch}
 #gearLoadoutView .gl-character-suggestions.open{display:block}
 #gearLoadoutView .gl-character-suggestion{display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;text-align:left;background:transparent;border:0;border-bottom:1px solid #eadbd0;border-radius:0;color:var(--text);cursor:pointer}
 #gearLoadoutView .gl-character-suggestion:last-child{border-bottom:0}
 #gearLoadoutView .gl-character-suggestion:hover,#gearLoadoutView .gl-character-suggestion[aria-selected=true]{background:#f1e2d5}
 #gearLoadoutView .gl-character-suggestion img,#gearLoadoutView .gl-character-no-icon{width:36px;height:36px;flex:0 0 36px;object-fit:cover;border-radius:7px;background:#eadbd0;display:flex;align-items:center;justify-content:center}
 #gearLoadoutView .gl-character-suggestion>span:last-child{display:flex;flex-direction:column;gap:3px;min-width:0}
 #gearLoadoutView .gl-character-suggestion b{font-size:12px;line-height:1.3;overflow-wrap:anywhere}
 #gearLoadoutView .gl-character-suggestion small{font-size:10px;color:var(--muted);white-space:normal}
 #gearLoadoutView .gl-character-no-result{padding:12px;color:var(--muted);font-size:12px}
 #gearLoadoutView .gl-bond-row{padding:0!important;border:1px solid #ead9ca!important;border-radius:9px;margin:0 0 7px;overflow:hidden;background:#fffdf9}
 #gearLoadoutView .gl-bond-row summary{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:9px 10px;cursor:pointer;list-style:none}
 #gearLoadoutView .gl-bond-row summary::-webkit-details-marker{display:none}
 #gearLoadoutView .gl-bond-title{display:flex;flex-direction:column;gap:3px;min-width:0}
 #gearLoadoutView .gl-bond-title b{font-size:12px;overflow-wrap:anywhere}
 #gearLoadoutView .gl-bond-title small{font-size:10px;color:var(--muted)}
 #gearLoadoutView .gl-bond-chevron{font-size:16px;color:var(--brown);flex:0 0 auto;transition:transform .15s}
 #gearLoadoutView .gl-bond-row[open] .gl-bond-chevron{transform:rotate(45deg)}
 #gearLoadoutView .gl-bond-detail{padding:9px 10px 10px;border-top:1px solid #eadbd0;background:#fffaf5;font-size:11px;line-height:1.5;overflow-wrap:anywhere}
 #gearLoadoutView .gl-bond-detail p{margin:4px 0 8px}
 #gearLoadoutView .gl-bond-effect{display:flex;flex-direction:column;gap:2px;padding:7px 8px;margin:5px 0;border-radius:7px;background:#edf5e9;color:#3f6540}
 #gearLoadoutView .gl-bond-effect b{font-size:11px}
 #gearLoadoutView .gl-bond-inactive{background:#f5eee8;color:var(--muted)}
 #gearLoadoutView .gl-bond-next{color:var(--muted)}
 #gearLoadoutView .gl-bond-gear{padding-top:6px;border-top:1px dashed #eadbd0}
 #gearLoadoutView .gl-gear-bond-match{display:block;margin-top:4px;color:#76513d;white-space:normal;line-height:1.4}\n #gearLoadoutView .gl-avatar{background:transparent;border:0;overflow:visible;box-shadow:none}
 #gearLoadoutView .gl-avatar img{width:100%;height:100%;object-fit:contain;border-radius:0;filter:drop-shadow(0 3px 4px #6e49342b)}
 #gearLoadoutView .gl-avatar small{position:absolute;bottom:0;left:0;right:0;background:#fff8f0cc;border-radius:6px;padding:2px}
 #gearLoadoutView .gl-slot-remove{font-size:9px;color:#9a4638;line-height:1.2;text-align:center}
 #gearLoadoutView .gl-legacy-toggle{position:absolute;top:3px;right:3px;z-index:4;min-width:19px;height:19px;padding:0 4px;border:1px solid #c9a88c;border-radius:6px;background:#fffaf5;color:#80543b;font-size:10px;font-weight:800;line-height:17px;cursor:pointer;box-shadow:0 1px 2px #6e493414}
 #gearLoadoutView .gl-legacy-toggle[aria-pressed=true]{background:#754a36;border-color:#754a36;color:#fffaf5}
 #gearLoadoutView .gl-legacy-toggle:hover{filter:brightness(.97);transform:none}
 #gearLoadoutView .gl-legacy-toggle:focus-visible{outline:2px solid #b88764;outline-offset:2px}
 #gearLoadoutView .gl-star-toggle{position:absolute;top:3px;left:3px;z-index:4;min-width:25px;height:19px;padding:0 4px;border:1px solid #c9a88c;border-radius:6px;background:#fffaf5;color:#80543b;font-size:9px;font-weight:800;line-height:17px;cursor:pointer;box-shadow:0 1px 2px #6e493414}
 #gearLoadoutView .gl-star-toggle[data-stars="1"],#gearLoadoutView .gl-star-toggle[data-stars="2"],#gearLoadoutView .gl-star-toggle[data-stars="3"]{background:#f5df9a;border-color:#d6ad45;color:#6e4a0a}
 #gearLoadoutView .gl-star-toggle:focus-visible{outline:2px solid #b88764;outline-offset:2px}
 #gearLoadoutView .gl-picker-filters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
 #gearLoadoutView .gl-picker-filters select{min-width:0;width:100%}
 #gearLoadoutView .gl-bonds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;align-items:start}
 #gearLoadoutView .gl-bond-row{margin:0!important;min-width:0}
 #gearLoadoutView .gl-bond-row summary{padding:7px 8px;gap:5px}
 #gearLoadoutView .gl-bond-title b{font-size:11px}
 #gearLoadoutView .gl-bond-title small{font-size:9px}
 #gearLoadoutView .gl-bond-detail{padding:7px 8px;font-size:10px}
 @media(max-width:760px){#gearLoadoutView .gl-bonds{grid-template-columns:minmax(0,1fr)}#gearLoadoutView .gl-picker-filters{grid-template-columns:repeat(2,minmax(0,1fr))}}
 `;
 document.head.appendChild(style);
}
function ensureCharacterAutocomplete(){
 const input=$('glCharacterSearch'),sel=$('glCharacter');if(!input||!sel)return;
 let box=$('glCharacterSuggestions'),wrap=input.closest('.gl-character-autocomplete');
 if(!wrap){
  const label=input.closest('label');
  wrap=document.createElement('div');wrap.className='gl-character-autocomplete';
  input.parentNode.insertBefore(wrap,input);wrap.appendChild(input);
  if(label){label.classList.add('gl-character-field');for(const n of [...label.childNodes])if(n.nodeType===Node.TEXT_NODE&&n.textContent.trim()){n.textContent='Nhân vật';break;}}
 }
 if(!box){box=document.createElement('div');box.id='glCharacterSuggestions';box.className='gl-character-suggestions';box.setAttribute('role','listbox');wrap.appendChild(box);}
 const selectLabel=sel.closest('label');if(selectLabel)selectLabel.hidden=true;else sel.hidden=true;
 input.setAttribute('autocomplete','off');input.setAttribute('aria-label','Tìm và chọn nhân vật');
}

function switchView(){document.querySelectorAll('.tracker-view').forEach(x=>x.hidden=true);['talentDatabaseView','characterExtrasView','teamBuilderView','buildAdvisorView','gearDatabaseView'].forEach(id=>{const e=$(id);if(e)e.hidden=true});$('gearLoadoutView').hidden=false;document.querySelectorAll('.view-switcher button').forEach(b=>b.classList.remove('primary'));$('gearLoadoutViewBtn').classList.add('primary');render();}
function hide(){if($('gearLoadoutView'))$('gearLoadoutView').hidden=true;$('gearLoadoutViewBtn')?.classList.remove('primary');closeCharacterSuggestions();}
function gearIcon(g){return 'https://gomg-wiki.pages.dev/'+String(g.icon||'').replace(/^\//,'')}
function characterPortrait(c){
 const raw=String(c?.source_id||'').trim();
 if(!raw)return '';
 const actor=raw.endsWith('_000')?raw:raw+'_000';
 return 'https://gomg-wiki.pages.dev/assets/icons/ActorAnim/RoleDraw/'+encodeURIComponent(actor)+'.png';
}
function currentSet(){return loadouts[current]||(loadouts[current]={})}
function chosen(slot){const id=currentSet()[slot];return gears.find(g=>g.id===id)}
function isLegacy(slot,g=chosen(slot)){return !!(current&&g&&legacyUsage[current]&&legacyUsage[current][slot]===g.id)}
function getStars(slot,g=chosen(slot)){const entry=current&&gearStars[current]&&gearStars[current][slot];return g&&entry&&entry.gearId===g.id?Math.max(0,Math.min(3,Number(entry.stars)||0)):0}
function toggleStars(slot){const g=chosen(slot);if(!current||!g)return;if(!gearStars[current])gearStars[current]={};const next=(getStars(slot,g)+1)%4;if(next===0)delete gearStars[current][slot];else gearStars[current][slot]={gearId:g.id,stars:next};localStorage.setItem(STAR_KEY,JSON.stringify(gearStars));renderSlots();renderBonds();}
function bondContribution(slot,g,b,index){return Number(b.count||1)+(isLegacy(slot,g)?1:0)+(getStars(slot,g)>=index+1?1:0)}
function toggleLegacy(slot){const g=chosen(slot);if(!current||!g)return;if(!legacyUsage[current])legacyUsage[current]={};if(isLegacy(slot,g))delete legacyUsage[current][slot];else legacyUsage[current][slot]=g.id;localStorage.setItem(LEGACY_KEY,JSON.stringify(legacyUsage));renderSlots();renderBonds();}
function sumStats(){const totals={};slots.forEach(s=>{const g=chosen(s);Object.entries(g?.stats||{}).forEach(([k,v])=>totals[k]=(totals[k]||0)+Number(v||0))});return totals}
function renderSlots(){document.querySelectorAll('.gl-slot').forEach(btn=>{const slot=btn.dataset.slot,g=chosen(slot),legacy=isLegacy(slot,g),stars=getStars(slot,g);btn.innerHTML=g?`<button type="button" class="gl-star-toggle" data-star-slot="${esc(slot)}" data-stars="${stars}" aria-label="Nâng sao gear ${esc(slot)}" title="Sao gear: ${stars}★. Bấm để tăng sao (0–3)">★${stars}</button><button type="button" class="gl-legacy-toggle" data-legacy-slot="${esc(slot)}" aria-pressed="${legacy}" title="${legacy?'Legacy đang bật: mỗi Bond của gear được +1 điểm':'Bật Legacy: mỗi Bond của gear được +1 điểm'}">L</button><img src="${esc(gearIcon(g))}" onerror="this.style.display='none'"><b>${esc(slot)}</b><small>${esc(g.name)}</small><span class="gl-slot-remove">${stars?'★'.repeat(stars)+' · ':''}${legacy?'Legacy +1 · ':''}Bấm để đổi</span>`:`<span class="gl-slot-icon">${({Head:'♜',Necklace:'◇',Body:'♧',Gloves:'♢',Shoes:'⌁',Belt:'═',Ring:'○',Badge:'✦',Main:'⚔',Off:'🛡'})[slot]}</span><b>${esc(slot)}</b><small>+ Gắn gear</small>`;btn.title=g?`${g.name} · ${stars} sao${legacy?' · Legacy đang bật':''} · bấm để đổi hoặc tháo`:`Gắn gear: ${slot}`;});}
function renderStats(){const t=sumStats();$('glStats').innerHTML=Object.keys(t).length?Object.entries(t).filter(([k,v])=>v!==0).map(([k,v])=>`<div class="gl-stat"><b>${esc(k)}</b><span>${v>0?'+':''}${v}</span></div>`).join(''):'<p class="gl-empty">Chưa có chỉ số. Hãy gắn gear vào các slot.</p>';renderBonds();}
function renderBonds(){const counts={};slots.forEach(slot=>{const g=chosen(slot);(g?.bonds||[]).forEach((b,index)=>{const source=String(b.source||'Bond'),name=String(b.name||'—'),key=source+'::'+name;if(!counts[key])counts[key]={source,name,count:0,parts:[]};const baseCount=Number(b.count||1),legacyBonus=isLegacy(slot,g)?1:0,stars=getStars(slot,g),starBonus=stars>=index+1?1:0;counts[key].count+=baseCount+legacyBonus+starBonus;counts[key].parts.push({gear:g,bond:b,slot,baseCount,legacyBonus,starBonus,stars});});});const list=Object.values(counts).sort((a,b)=>a.source.localeCompare(b.source)||a.name.localeCompare(b.name));if(!list.length){$('glBonds').innerHTML='<p class="gl-empty">Chưa có Bond.</p>';return;}$('glBonds').innerHTML=list.map((x,i)=>{const first=x.parts[0].bond,tiers=Array.isArray(first.tiers)?first.tiers:[],active=tiers.filter(t=>Number(t.pieces)<=x.count),next=tiers.find(t=>Number(t.pieces)>x.count);const details=active.length?active.map(t=>`<div class="gl-bond-effect"><b>${Number(t.pieces)} pieces đang kích hoạt</b><span>${esc(t.effect||'Không có mô tả hiệu ứng.')}</span></div>`).join(''):`<div class="gl-bond-effect gl-bond-inactive">Chưa đạt mốc kích hoạt đầu tiên${tiers.length?` (${Number(tiers[0].pieces)} pieces)`:''}.</div>`;const sources=x.parts.map(p=>`${p.slot}: ${p.gear.name} (+${p.baseCount}${p.legacyBonus?' + 1 Legacy':''}${p.starBonus?` + 1 từ ${p.stars}★`:''})`).join(' · ');return `<details class="gl-bond-row"><summary><span class="gl-bond-title"><b>${esc(x.source)}: ${esc(x.name)}</b><small>${x.count} điểm Bond · ${active.length?'đã kích hoạt '+active.length+' mốc':'chưa kích hoạt'}</small></span><span class="gl-bond-chevron">＋</span></summary><div class="gl-bond-detail"><p class="gl-bond-base"><b>Hiệu ứng cơ bản:</b> ${esc(first.basicDesc||first.effect||'Chưa có mô tả.')}</p>${details}${next?`<p class="gl-bond-next"><b>Mốc tiếp theo:</b> ${Number(next.pieces)} pieces — ${esc(next.effect||'')}</p>`:''}<p class="gl-bond-gear"><b>Đóng góp từ gear đang mặc:</b> ${esc(sources)}</p></div></details>`;}).join('');}
function render(){if(!current){$('glCharacterName').textContent='Chọn nhân vật';$('glAvatar').innerHTML='<span>✦</span><small>Character icon</small>';renderSlots();renderStats();return;}const c=chars.find(x=>String(x.id)===current);$('glCharacterName').textContent=c?.name_en||c?.name||'Character';const portrait=characterPortrait(c),fallback=String(c?.icon||'');$('glAvatar').innerHTML=portrait?`<img src="${esc(portrait)}" alt="${esc(c?.name_en||c?.name||'Character')}" data-fallback="${esc(fallback)}" onerror="if(this.dataset.fallback&&this.src!==this.dataset.fallback){this.onerror=null;this.src=this.dataset.fallback}else{this.outerHTML='<span>✦</span><small>Không có ảnh toàn thân</small>'}">`:(fallback?`<img src="${esc(fallback)}" alt="${esc(c?.name_en||c?.name||'Character')}" onerror="this.outerHTML='<span>✦</span><small>Không tải được ảnh</small>'">`:'<span>✦</span><small>Chưa có ảnh</small>');const input=$('glCharacterSearch');if(c&&input)input.value=c.name_en||c.name||c.id;renderSlots();renderStats();if(activeSlot)renderPicker();}
function closeCharacterSuggestions(){const box=$('glCharacterSuggestions');if(box){box.classList.remove('open');box.innerHTML='';}}
function renderCharacterSuggestions(){const input=$('glCharacterSearch'),box=$('glCharacterSuggestions');if(!input||!box)return;const q=norm(input.value);let found=chars.map(c=>({c,n:norm(c.name_en||c.name||c.id)})).filter(x=>!q||x.n.includes(q));found.sort((a,b)=>{if(q){const ap=a.n.startsWith(q)?0:1,bp=b.n.startsWith(q)?0:1;if(ap!==bp)return ap-bp;const ae=a.n===q?0:1,be=b.n===q?0:1;if(ae!==be)return ae-be;}return (a.c.name_en||a.c.name||'').localeCompare(b.c.name_en||b.c.name||'');});found=found.slice(0,10);if(!found.length){box.innerHTML='<div class="gl-character-no-result">Không tìm thấy nhân vật phù hợp.</div>';box.classList.add('open');return;}box.innerHTML=found.map(({c})=>`<button type="button" class="gl-character-suggestion" data-char-id="${esc(c.id)}" role="option" aria-selected="${String(c.id)===current?'true':'false'}">${c.icon?`<img src="${esc(c.icon)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`:'<span class="gl-character-no-icon">✦</span>'}<span><b>${esc(c.name_en||c.name||c.id)}</b><small>${esc([c.rarity,c.role,c.element].filter(Boolean).join(' · '))}</small></span></button>`).join('');box.classList.add('open');}
function selectCharacter(id){const c=chars.find(x=>String(x.id)===String(id));if(!c)return;current=String(c.id);$('glCharacter').value=current;$('glCharacterSearch').value=c.name_en||c.name||c.id;activeSlot='';closeCharacterSuggestions();render();}
function bondSearchText(g){return (g.bonds||[]).flatMap(b=>[b.name,b.source,b.basicDesc,b.effect,...(b.tags||[]),...(b.tiers||[]).map(t=>t.effect)]).filter(Boolean).join(' ');}
function renderPicker(){const slot=activeSlot;$('glPickerSlot').textContent=slot?'— '+slot:'';const q=norm($('glGearSearch').value),tier=$('glGearTier').value,cls=$('glGearClass').value,area=$('glGearArea')?.value||'All';const found=gears.filter(g=>{const areaKey=String(g.areaType||'')+'::'+String(g.area||'');if(g.slot!==slot||(tier!=='All'&&g.step!==tier)||(cls!=='All'&&!String(g.cls||'').split(',').map(x=>x.trim()).includes(cls))||(area!=='All'&&areaKey!==area))return false;if(!q)return true;const general=norm([g.id,g.name,g.step,g.slot,g.cls,Object.entries(g.stats||{}).map(([k,v])=>k+' '+v).join(' ')].join(' '));const bonds=norm(bondSearchText(g));return general.includes(q)||bonds.includes(q);}).slice(0,100);$('glGearResults').innerHTML=found.length?found.map(g=>{const matchingBonds=(g.bonds||[]).filter(b=>norm([b.name,b.source,b.basicDesc,b.effect,...(b.tags||[]),...(b.tiers||[]).map(t=>t.effect)].filter(Boolean).join(' ')).includes(q));const bondLine=matchingBonds.length?`<small class="gl-gear-bond-match">Bond: ${esc(matchingBonds.map(b=>`${b.source||'Bond'}: ${b.name}${b.basicDesc||b.effect?' — '+(b.basicDesc||b.effect):''}`).join(' · '))}</small>`:'';return `<button class="gl-gear-item" data-gear-id="${esc(g.id)}"><img src="${esc(gearIcon(g))}" onerror="this.style.visibility='hidden'"><span><b>${esc(g.name)}</b><small>${esc(g.id)} · ${esc(g.step)} · ${esc(g.cls||'')}</small><small>${esc(Object.entries(g.stats||{}).filter(([k,v])=>Number(v)).map(([k,v])=>k+' '+(v>0?'+':'')+v).join(' · ')||'Không có chỉ số')}</small>${bondLine}</span></button>`;}).join(''):'<p class="gl-empty">Không tìm thấy gear phù hợp cho slot này. Thử từ khóa Bond như “follow up”, “speed” hoặc “stun”.</p>';}
async function init(){try{const [cr,gr]=await Promise.all([fetch('game-data.json',{cache:'no-cache'}),fetch('gear-database.json',{cache:'no-cache'})]);if(!cr.ok||!gr.ok)throw Error('Thiếu game-data.json hoặc gear-database.json');const cd=await cr.json();gears=await gr.json();chars=Array.isArray(cd)?cd:(cd.characters||cd.units||[]);if(!Array.isArray(gears)||gears.length<100)throw Error('Gear database chưa đầy đủ');try{loadouts=JSON.parse(localStorage.getItem(KEY)||'{}')}catch{loadouts={};}try{legacyUsage=JSON.parse(localStorage.getItem(LEGACY_KEY)||'{}')}catch{legacyUsage={};}try{gearStars=JSON.parse(localStorage.getItem(STAR_KEY)||'{}')}catch{gearStars={};}const sel=$('glCharacter');sel.innerHTML='<option value="">— Chọn nhân vật —</option>'+chars.map(c=>`<option value="${esc(c.id)}">${esc(c.name_en||c.name||c.id)}</option>`).join('');const classes=[...new Set(gears.flatMap(g=>String(g.cls||'').split(',').map(x=>x.trim()).filter(Boolean)))].sort();$('glGearClass').innerHTML='<option value="All">Mọi class</option>'+classes.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');let areaSelect=$('glGearArea');if(!areaSelect){areaSelect=document.createElement('select');areaSelect.id='glGearArea';areaSelect.setAttribute('aria-label','Lọc theo khu vực');areaSelect.innerHTML='<option value="All">Mọi khu vực</option>';const filters=document.querySelector('#gearLoadoutView .gl-picker-filters');if(filters)filters.appendChild(areaSelect);}const areas=[...new Map(gears.map(g=>[String(g.areaType||'')+'::'+String(g.area||''),{key:String(g.areaType||'')+'::'+String(g.area||''),label:(g.area||'Unknown')+(g.areaType&&g.areaType!=='World'?' · '+g.areaType:'')}])).values()].sort((a,b)=>a.label.localeCompare(b.label));areaSelect.innerHTML='<option value="All">Mọi khu vực</option>'+areas.map(a=>`<option value="${esc(a.key)}">${esc(a.label)}</option>`).join('');$('gearLoadoutStatus').textContent=`${chars.length} nhân vật · ${gears.length} gear`; }catch(e){$('gearLoadoutStatus').textContent='Lỗi tải dữ liệu';$('glGearResults').innerHTML=`<p class="gl-empty">${esc(e.message)}. Kiểm tra hai file JSON trong repo test.</p>`;}}
function placeBondsBelowPicker(){
 const bonds=$('glBonds'),results=$('glGearResults');
 if(!bonds||!results)return;
 const bondPanel=bonds.closest('.gl-panel'),pickerPanel=results.closest('.gl-panel');
 if(!bondPanel||!pickerPanel||bondPanel.parentElement!==pickerPanel.parentElement)return;
 pickerPanel.parentElement.insertBefore(bondPanel,pickerPanel.nextSibling);
}
installGearLoadoutStyles();ensureCharacterAutocomplete();placeBondsBelowPicker();
document.querySelector('.view-switcher')?.addEventListener('click',e=>{if(!e.target.closest('#gearLoadoutViewBtn'))hide();});$('gearLoadoutViewBtn')?.addEventListener('click',switchView);$('glCharacterSearch')?.addEventListener('input',()=>{renderCharacterSuggestions();});$('glCharacterSearch')?.addEventListener('focus',renderCharacterSuggestions);$('glCharacterSearch')?.addEventListener('keydown',e=>{if(e.key==='Escape')closeCharacterSuggestions();if(e.key==='Enter'){const first=$('glCharacterSuggestions')?.querySelector('[data-char-id]');if(first){e.preventDefault();selectCharacter(first.dataset.charId);}}});$('glCharacterSuggestions')?.addEventListener('click',e=>{const b=e.target.closest('[data-char-id]');if(b)selectCharacter(b.dataset.charId);});document.addEventListener('click',e=>{if(!e.target.closest('.gl-character-autocomplete'))closeCharacterSuggestions();});$('glCharacter')?.addEventListener('change',e=>selectCharacter(e.target.value));document.querySelectorAll('.gl-slot').forEach(b=>b.addEventListener('click',e=>{const starButton=e.target.closest('[data-star-slot]');if(starButton){e.preventDefault();e.stopPropagation();toggleStars(starButton.dataset.starSlot);return;}const legacyButton=e.target.closest('[data-legacy-slot]');if(legacyButton){e.preventDefault();e.stopPropagation();toggleLegacy(legacyButton.dataset.legacySlot);return;}if(!current){$('gearLoadoutStatus').textContent='Hãy chọn nhân vật trước';$('glCharacterSearch').focus();return;}const slot=b.dataset.slot;activeSlot=slot;renderPicker();$('glGearSearch').focus();}));$('glGearSearch')?.addEventListener('input',renderPicker);$('glGearTier')?.addEventListener('change',renderPicker);$('glGearClass')?.addEventListener('change',renderPicker);$('glGearArea')?.addEventListener('change',renderPicker);document.addEventListener('change',e=>{if(e.target?.id==='glGearArea')renderPicker();});$('glGearResults')?.addEventListener('click',e=>{const b=e.target.closest('[data-gear-id]');if(!b||!activeSlot||!current)return;currentSet()[activeSlot]=b.dataset.gearId;localStorage.setItem(KEY,JSON.stringify(loadouts));render();});$('glClearBtn')?.addEventListener('click',()=>{if(!current){$('gearLoadoutStatus').textContent='Hãy chọn nhân vật trước';return;}if(!window.confirm('Tháo toàn bộ gear của nhân vật đang chọn?'))return;loadouts[current]={};legacyUsage[current]={};gearStars[current]={};localStorage.setItem(KEY,JSON.stringify(loadouts));localStorage.setItem(LEGACY_KEY,JSON.stringify(legacyUsage));localStorage.setItem(STAR_KEY,JSON.stringify(gearStars));render();});// Keep Gear Loadout isolated: when another top-level tab is clicked, hide only this view.
document.addEventListener('click',e=>{
 const btn=e.target.closest('.view-switcher button');
 if(btn&&btn.id!=='gearLoadoutViewBtn')hide();
},true);
init();
})();
