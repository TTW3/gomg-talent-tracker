/* GOMG Build Advisor v11 - Character Analyzer
 * Separate third branch. Reads only bundled game-data.json.
 * It never reads or writes tracker/localStorage/sync data.
 * Purpose: explain build-relevant mechanics and surface candidates; it does not
 * claim to know a single "best 4-talent" build.
 */
(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const STOP=new Set('the and for with from this that target targets enemy enemies ally allies all each every per gain gains deal deals damage dmg apply applies applied stacks stack of to on at in into by when while after before has have having is are be will can their its your'.split(' '));
  const MECH={
    luck:['luck','fortune'],speed:['speed','spd','action','turn','initiative','haste'],mana:['mana','energy','energized','max mana'],
    hp:['hp','health','heal','healing','max hp'],soothe:['soothe','nourishment'],counter:['counter','thorns','reflect'],
    follow:['follow-up','follow up','extra action','extra actions'],weakness:['weakness','exposed','expose'],
    debuff:['debuff','hinder','stun','fear','burn','chill','poison','decay','nullify','cleanse','vulnerable','taunt'],
    defense:['toughness','shield','barrier','damage taken','defense'],buff:['buff','enhance','increase','boost','grant','empower','strengthen'],
    status:['status','stack','stacks'],position:['front','mid','back','nearest','farthest','highest','lowest'],
    survival:['nine lives','extra life','revive','survive','survival','fatal damage','fatal dmg','death'],
    damage:['damage','dmg','skill','attack','critical','crit','hit','multi-hit']
  };
  const MECH_LABEL={luck:'Luck',speed:'Speed',mana:'Mana',hp:'HP',soothe:'Soothe',counter:'Counter',follow:'Follow-up / Extra Action',weakness:'Weakness',debuff:'Debuff / Control',defense:'Defense',buff:'Buff',status:'Status / Stacks',position:'Position',survival:'Survival',damage:'Damage / Skill'};
  let GAME=null,selectedId='',objective='Skill Synergy';

  function words(s){return new Set(norm(s).split(/[^a-z0-9+%-]+/).filter(x=>x.length>2&&!STOP.has(x)));}
  function overlap(a,b){const A=words(a),B=words(b);let n=0;for(const w of A)if(B.has(w))n++;return n;}
  function skillFor(c){return (GAME.skills||[]).filter(s=>s.id===c.source_id)}
  function skillText(c){const ss=skillFor(c);return [c.name_en,c.role,c.type,c.element,c.terrain,(c.archetypes||[]).join(' '),...ss.map(s=>`${s.skill} ${s.desc} ${(s.tags||[]).join(' ')}`)].join(' ')}
  function mechanics(text){const s=norm(text),out=new Set();for(const[k,ks]of Object.entries(MECH))if(ks.some(v=>s.includes(norm(v))))out.add(k);return out;}
  function talentText(t){return [t.name_en,t.name_source,t.description_en,t.effect_en,t.source_label,t.source_value,t.exclusive_name,(t.tags||[]).join(' ')].join(' ')}
  function exclusiveMatch(t,c){const cid=String(c.source_id||'');const exid=String(t.source_value||'');const exn=norm(t.exclusive_name||'');const cn=norm(c.name_en||'');return !!((cid&&exid&&cid===exid)||(exn&&cn&&exn===cn));}
  function isNine(t){return /\bnine lives\b/.test(norm(t.name_en||''));}
  function isNonStack(t){const x=norm(talentText(t));return isNine(t)||/\b(non[- ]?stack|does not stack|cannot stack|only one|unique effect|duplicate effect)\b/.test(x);}
  function likelyStack(t){if(isNonStack(t))return false;const x=norm(talentText(t));return /\b(per|each|every|stacks?|stacking|for every|for each)\b/.test(x)||/\b(gain|deal|increase|reduce|boost|add|apply)\s+\+?\d/.test(x)||/\+\d+(?:\.\d+)?\s*(?:luck|spd|speed|hp|mana|damage|dmg|attack|toughness|defense|%)\b/.test(x);}
  function tier(t){return t.rank==='Orange'?4:t.rank==='Purple'?3:t.rank==='Blue'?2:1;}
  function relation(t,core){
    const x=norm(talentText(t));const provides=new Set(),consumes=new Set();
    for(const m of core){const keys=MECH[m]||[];if(keys.some(k=>x.includes(norm(k)))){
      if(new RegExp('(?:gain|grant|give|add|increase|boost|restore|start|starting|obtain|receive|apply)[^.!?]{0,100}\\b(?:'+keys.map(k=>norm(k).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\b').test(x))provides.add(m);
      if(new RegExp('(?:per|for every|for each|based on|scales? with|depending on|according to)[^.!?]{0,100}\\b(?:'+keys.map(k=>norm(k).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\b').test(x))consumes.add(m);
    }}
    return {provides,consumes};
  }
  function candidateScore(t,c,sm,core,category){
    const tx=talentText(t),tm=mechanics(tx),r=relation(t,core);let s=tier(t)*0.7;
    if(exclusiveMatch(t,c))s+=8;
    for(const m of core){if(r.provides.has(m))s+=10;if(r.consumes.has(m))s+=11;if(tm.has(m))s+=2.5;}
    for(const m of sm)if(tm.has(m))s+=m==='damage'?1.2:1;
    s+=Math.min(3,overlap(tx,skillText(c))*0.25);
    if(isNine(t))s+=category==='survival'?10:2;
    if(category==='core'&&(r.provides.size||r.consumes.size))s+=5;
    if(category==='survival'&&(tm.has('survival')||tm.has('defense')||tm.has('hp')))s+=5;
    if(category==='exclusive'&&t.source_cat==='Exclusive')s+=2;
    if(category==='objective'){
      if(objective==='DPS'&&tm.has('damage'))s+=4;
      if(objective==='Sustain'&&(tm.has('survival')||tm.has('defense')||tm.has('hp')))s+=4;
      if(objective==='Control'&&tm.has('debuff'))s+=4;
      if(objective==='Speed'&&tm.has('speed'))s+=4;
      if(objective==='Resource'&&(tm.has('mana')||tm.has('soothe')||tm.has('resource')))s+=4;
      if(objective==='Character Buff'&&(tm.has('buff')||tm.has('status')||tm.has('speed')))s+=4;
    }
    // Avoid unrelated DoTs being boosted merely by the broad debuff category.
    const sk=norm(skillText(c));
    if(!sk.includes('burn')&&/burn/.test(norm(tx)))s-=2;
    if(!sk.includes('poison')&&/poison/.test(norm(tx)))s-=2;
    if(!sk.includes('chill')&&/chill/.test(norm(tx)))s-=2;
    return s;
  }
  function coreMechanics(c,text,sm){
    const out=new Set();
    // Explicit scaling/resource phrases are stronger than generic keyword hits.
    const s=norm(text);
    for(const m of ['luck','mana','speed','hp','soothe','counter','weakness','follow','status','position']){
      const ks=MECH[m]||[];const joined=ks.map(norm).join('|');
      if(new RegExp('(?:per|for every|for each|based on|scales? with|depending on)[^.!?]{0,90}\\b(?:'+joined+')\\b').test(s))out.add(m);
    }
    for(const a of (c.archetypes||[])){
      const x=norm(a);for(const m of Object.keys(MECH))if((MECH[m]||[]).some(k=>x.includes(norm(k))))out.add(m);
      if(/luk|luck/.test(x))out.add('luck');
    }
    // If only generic damage is found, keep it secondary rather than declaring it the core.
    return out;
  }
  function analyze(){
    const c=GAME.characters.find(x=>x.id===selectedId);if(!c)return null;
    const ss=skillFor(c),st=skillText(c),sm=mechanics(st),core=coreMechanics(c,st,sm);
    const all=(GAME.talents||[]).filter(t=>!t.legacy_only);
    const buckets={core:[],survival:[],exclusive:[],objective:[],related:[]};
    for(const t of all){
      const r=relation(t,core), tm=mechanics(talentText(t));
      if(r.provides.size||r.consumes.size)buckets.core.push(t);
      if(isNine(t)||tm.has('survival')||tm.has('defense')||tm.has('hp'))buckets.survival.push(t);
      if(t.source_cat==='Exclusive')buckets.exclusive.push(t);
      if(objective!=='Skill Synergy')buckets.objective.push(t);
      if([...sm].some(m=>tm.has(m)))buckets.related.push(t);
    }
    const rank=(arr,cat)=>arr.map(t=>({t,score:candidateScore(t,c,sm,core,cat)})).sort((a,b)=>b.score-a.score).slice(0,6).map(x=>x.t);
    const nine=buckets.survival.find(isNine);
    return {character:c,skills:ss,mechanics:sm,core,all,talents:{core:rank(buckets.core,'core'),survival:rank(buckets.survival,'survival'),exclusive:rank(buckets.exclusive,'exclusive'),objective:rank(buckets.objective,'objective'),related:rank(buckets.related,'related')},nine};
  }
  function reason(t,r){const bits=[],core=r.core;const rel=relation(t,core);for(const m of rel.provides)bits.push('Cung cấp '+MECH_LABEL[m]);for(const m of rel.consumes)bits.push('Khai thác '+MECH_LABEL[m]);if(isNine(t))bits.push('Survival / 9 mạng');if(exclusiveMatch(t,r.character))bits.push('EX chính chủ');else if(t.source_cat==='Exclusive')bits.push('EX của Character khác');if(likelyStack(t))bits.push('Có dấu hiệu stack');else if(isNonStack(t))bits.push('Hiệu ứng không cộng dồn');return bits.slice(0,3).join(' · ')||'Liên quan đến mechanic của Character';}
  function card(t,r){return `<article class="ba-candidate"><div><h4>${esc(t.name_en||t.name_source||'Unknown')}</h4><div class="muted">${esc(t.rank||'')} · ${esc(t.source_label||t.source_cat||'')}</div><p>${esc(t.description_en||t.effect_en||'Chưa có mô tả')}</p><small class="ba-reason">${esc(reason(t,r))}</small></div></article>`;}
  function unique(list){const seen=new Set();return list.filter(t=>{if(!t||seen.has(t.id))return false;seen.add(t.id);return true;});}
  function render(){const out=document.getElementById('buildAdvisorResults');if(!out)return;const r=analyze();if(!r){out.innerHTML='<div class="muted">Chọn một Character có dữ liệu skill để phân tích.</div>';return;}
    const core=[...r.core].map(m=>MECH_LABEL[m]);const mech=[...r.mechanics].map(m=>MECH_LABEL[m]);
    const primary=unique([...r.talents.core,...r.talents.survival,...r.talents.related]).slice(0,12);
    out.innerHTML=`<div class="ba-summary"><div class="ba-character-selected">${r.character.icon?`<img class="ba-char-icon" src="${esc(r.character.icon)}" alt="" loading="lazy">`:''}<div><b>${esc(r.character.name_en)}</b><span class="muted"> · ${esc(r.character.source_id||'')}</span></div></div><div class="ba-tags">${mech.slice(0,8).map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`+
      `<div class="ba-skills"><h3>Skill source</h3>${r.skills.length?r.skills.map(s=>`<article><b>${esc(s.skill)}</b><div>${esc(s.desc)}</div><small>${(s.tags||[]).map(esc).join(' · ')}</small></article>`).join(''):'<span class="muted">Không có skill record cho unit này.</span>'}</div>`+
      `<div class="ba-analysis-grid"><section class="ba-panel"><h3>🎯 Core mechanic</h3>${core.length?core.map(x=>`<span class="ba-core-pill">${esc(x)}</span>`).join(''):'<p class="muted">Chưa xác định được scaling mechanic rõ ràng từ dữ liệu hiện có.</p>'}</section><section class="ba-panel"><h3>❤️ Survival</h3><p>Advisor coi Survival là một lớp riêng, không chỉ bật khi chọn mục tiêu Sustain.</p>${r.nine?`<div class="ba-note"><b>Nine Lives</b> · ${esc(r.nine.description_en||r.nine.effect_en||'')}</div>`:'<p class="muted">Không tìm thấy Nine Lives trong database.</p>'}</section></div>`+
      `<section class="ba-panel"><h3>🔗 Talent đáng xem theo mechanic</h3><div class="ba-talents">${primary.map(t=>card(t,r)).join('')}</div></section>`+
      `<section class="ba-panel"><h3>⭐ EX candidates</h3><div class="ba-talents">${r.talents.exclusive.map(t=>card(t,r)).join('')||'<p class="muted">Không có EX phù hợp nổi bật.</p>'}</div></section>`+
      `<section class="ba-panel"><h3>🧩 Theo mục tiêu: ${esc(objective)}</h3><div class="ba-talents">${r.talents.objective.map(t=>card(t,r)).join('')||'<p class="muted">Không có ứng viên nổi bật.</p>'}</div></section>`+
      `<p class="hint"><b>Đây không phải “best 4 build”.</b> Advisor chỉ phân tích Skill → core mechanic → Talent cung cấp/khai thác mechanic → Survival → EX/utility. Một Talent có thể được dùng nhiều slot nếu game cho phép, nhưng hiệu ứng non-stack như Nine Lives không được tính nhiều lần. EX của Character khác vẫn được xét.</p>`;
  }
  function inject(){const switcher=document.querySelector('.view-switcher');if(!switcher||document.getElementById('buildAdvisorView'))return;
    const btn=document.createElement('button');btn.id='buildAdvisorBtn';btn.type='button';btn.textContent='🧠 Build Advisor';switcher.appendChild(btn);
    const view=document.createElement('section');view.className='card build-advisor-view';view.id='buildAdvisorView';view.hidden=true;
    view.innerHTML=`<div class="section-head"><div><h2>🧠 Build Advisor · Character Analyzer</h2><span class="muted">Phân tích Character và tìm Talent đáng xem — không cố đoán một “best build” duy nhất.</span></div></div><div class="ba-controls"><label>Character<div class="ba-autocomplete"><input id="baCharacter" type="text" autocomplete="off" placeholder="Nhập tên Character..."><div id="baCharacterSuggestions" class="ba-suggestions" hidden></div></div></label><label>Mục tiêu<select id="baObjective"><option>Skill Synergy</option><option>DPS</option><option>Sustain</option><option>Control</option><option>Speed</option><option>Resource</option><option>Character Buff</option></select></label><button id="baGenerate" class="primary">🔍 Phân tích Character</button></div><div id="buildAdvisorResults" class="build-advisor-results"></div>`;
    switcher.parentNode.insertBefore(view,switcher.nextSibling);
    const trackerViews=document.querySelectorAll('.tracker-view'),dbView=document.getElementById('talentDatabaseView');
    function show(){trackerViews.forEach(x=>x.hidden=true);if(dbView)dbView.hidden=true;view.hidden=false;btn.classList.add('primary');document.getElementById('trackerViewBtn')?.classList.remove('primary');document.getElementById('databaseViewBtn')?.classList.remove('primary');const out=document.getElementById('buildAdvisorResults');if(out)out.innerHTML='<div class="muted">Chọn Character + mục tiêu rồi bấm 🔍 Phân tích Character.</div>';}
    btn.onclick=show;document.getElementById('trackerViewBtn')?.addEventListener('click',()=>{view.hidden=true;btn.classList.remove('primary');});document.getElementById('databaseViewBtn')?.addEventListener('click',()=>{view.hidden=true;btn.classList.remove('primary');});
    const input=document.getElementById('baCharacter'),suggestions=document.getElementById('baCharacterSuggestions');const chars=(GAME.characters||[]).filter(c=>c.source_id).sort((a,b)=>norm(a.name_en).localeCompare(norm(b.name_en)));selectedId=chars[0]?.id||'';if(chars[0])input.value=chars[0].name_en+(chars[0].variant==='Alter'?' · Alter':'');
    function paint(qv){const q=norm(qv).trim();const list=q?chars.filter(c=>norm(c.name_en).includes(q)||norm(c.source_id).includes(q)).slice(0,12):chars.slice(0,12);suggestions.innerHTML=list.map(c=>`<button type="button" class="ba-suggestion" data-id="${esc(c.id)}">${c.icon?`<img class="ba-suggestion-icon" src="${esc(c.icon)}" alt="" loading="lazy">`:''}<span class="ba-suggestion-name">${esc(c.name_en)}</span>${c.variant==='Alter'?'<small>Alter</small>':''}</button>`).join('');suggestions.hidden=!list.length;suggestions.querySelectorAll('.ba-suggestion').forEach(b=>b.onclick=()=>{const c=chars.find(x=>x.id===b.dataset.id);if(!c)return;selectedId=c.id;input.value=c.name_en+(c.variant==='Alter'?' · Alter':'');suggestions.hidden=true;document.getElementById('buildAdvisorResults').innerHTML='<div class="muted">Đã chọn Character. Bấm 🔍 Phân tích Character.</div>';});}
    input.addEventListener('input',()=>paint(input.value));input.addEventListener('focus',()=>paint(input.value));input.addEventListener('keydown',e=>{if(e.key==='Enter'){const f=suggestions.querySelector('.ba-suggestion');if(f)f.click();}else if(e.key==='Escape')suggestions.hidden=true;});document.addEventListener('click',e=>{if(!e.target.closest('.ba-autocomplete'))suggestions.hidden=true;});
    document.getElementById('baObjective').onchange=e=>{objective=e.target.value;document.getElementById('buildAdvisorResults').innerHTML='<div class="muted">Đã chọn mục tiêu. Bấm 🔍 Phân tích Character.</div>';};document.getElementById('baGenerate').onclick=render;
    const style=document.createElement('style');style.textContent=`.build-advisor-view{margin-top:14px}.ba-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.ba-controls label{display:flex;flex-direction:column;gap:5px;min-width:230px}.ba-controls select,.ba-controls input{min-height:38px;box-sizing:border-box}.ba-autocomplete{position:relative}.ba-autocomplete input{width:100%;padding:8px 10px;border:1px solid var(--border,#ddd);border-radius:8px;background:var(--input-bg,transparent);color:inherit}.ba-suggestions{position:absolute;z-index:50;left:0;right:0;top:calc(100% + 4px);max-height:260px;overflow:auto;border:1px solid var(--border,#ddd);border-radius:10px;background:var(--card-bg,#fff);box-shadow:0 8px 24px rgba(0,0,0,.12)}.ba-suggestion{display:flex;width:100%;align-items:center;gap:9px;padding:7px 11px;border:0;border-bottom:1px solid var(--border,#ddd);background:transparent;color:inherit;text-align:left;cursor:pointer}.ba-suggestion:hover{background:rgba(127,127,127,.10)}.ba-suggestion-icon{width:32px;height:32px;object-fit:cover;border-radius:7px;flex:0 0 32px}.ba-suggestion-name{flex:1;min-width:0}.ba-suggestion small{opacity:.65;margin-left:auto}.ba-character-selected{display:flex;align-items:center;gap:9px}.ba-char-icon{width:42px;height:42px;object-fit:cover;border-radius:9px;flex:0 0 42px}.build-advisor-results{margin-top:16px}.ba-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid var(--border,#ddd);border-radius:12px;padding:12px}.ba-tags{display:flex;gap:5px;flex-wrap:wrap}.ba-tags span,.ba-core-pill{padding:3px 8px;border:1px solid var(--border,#ddd);border-radius:999px;font-size:11px;display:inline-block}.ba-skills{margin:14px 0}.ba-skills article{border-left:3px solid var(--accent,#888);padding:8px 10px;margin:7px 0;background:rgba(127,127,127,.06)}.ba-skills article div{font-size:12px;line-height:1.5;margin-top:3px}.ba-skills small{opacity:.7}.ba-analysis-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}.ba-panel{border:1px solid var(--border,#ddd);border-radius:12px;padding:12px;margin-top:10px}.ba-panel h3{margin-top:0}.ba-talents{display:grid;gap:9px}.ba-candidate{border:1px solid var(--border,#ddd);border-radius:10px;padding:10px}.ba-candidate h4{margin:0 0 2px}.ba-candidate p{margin:6px 0 0;font-size:12.5px;line-height:1.5}.ba-reason{display:block;margin-top:6px;opacity:.75;font-size:11px}.ba-note{padding:9px;border-radius:8px;background:rgba(127,127,127,.07);font-size:12.5px;line-height:1.5}.build-advisor-view .hint{margin-top:14px}@media(max-width:700px){.ba-controls label,.ba-controls button{width:100%;box-sizing:border-box}.ba-summary,.ba-analysis-grid{display:block}.ba-tags{margin-top:8px}}`;
    document.head.appendChild(style);
  }
  async function load(){try{const r=await fetch('game-data.json',{cache:'no-store'});if(!r.ok)throw Error();GAME=await r.json();inject();}catch(e){console.warn('Build Advisor: game-data.json unavailable',e)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
