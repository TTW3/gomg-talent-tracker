/* GOMG Build Advisor
 * Separate third branch. Reads only bundled game-data.json.
 * It never reads or writes tracker/localStorage/sync data.
 */
(function(){
  'use strict';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const words=s=>new Set(norm(s).split(/[^a-z0-9+%-]+/).filter(x=>x.length>2));
  const STOP=new Set('the and for with from this that target targets enemy enemies ally allies all each every per gain gains deal deals damage dmg apply applies applied stacks stack of to on at in into by when while after before has have having is are be will can their its your'.split(' '));
  const MECH={
    damage:['damage','dmg','skill','follow-up','multi-hit','basic','attack','critical','crit'],
    speed:['speed','spd','action','turn','initiative','haste'],
    mana:['mana','energy','energized','max mana'],
    hp:['hp','health','heal','healing','max hp','hp gain','hp loss'],
    soothe:['soothe','nourishment'],
    debuff:['debuff','hinder','expose','stun','fear','burn','chill','poison','decay','nullify','cleanse','vulnerable','taunt','toughness'],
    defense:['toughness','shield','barrier','damage taken','defense'],
    counter:['counter','thorns','reflect'],
    luck:['luck','fortune','random'],
    status:['status','stack','stacks','buff','debuff'],
    buff:['buff','enhance','increase','boost','grant','gain','empower','strengthen','haste'],
    follow:['follow-up','follow up','extra action','extra actions'],
    resource:['mana','hp','soothe','nourishment','energy','stack','stacks'],
    weakness:['weakness','exposed','expose'],
    position:['front','mid','back','nearest','farthest','highest','lowest'],
    survival:['nine lives','extra life','revive','survive','survival','death']
  };
  let GAME=null, selectedId='', objective='Skill Synergy';
  function skillFor(c){return (GAME.skills||[]).filter(s=>s.id===c.source_id)}
  function sourceText(c){const ss=skillFor(c);return [c.name_en,c.role,c.type,c.element,c.terrain,(c.archetypes||[]).join(' '),...ss.map(s=>s.skill+' '+s.desc+' '+(s.tags||[]).join(' '))].join(' ')}
  function mechanics(text){
    const s=norm(text), out=new Set();
    for(const [k,ks] of Object.entries(MECH)) if(ks.some(v=>s.includes(norm(v)))) out.add(k);
    return out;
  }
  function talentText(t){return [t.name_en,t.name_source,t.description_en,t.effect_en,t.source_label,t.source_value,(t.tags||[]).join(' ')].join(' ')}
  function overlapWords(a,b){
    const A=[...words(a)].filter(x=>!STOP.has(x)),B=new Set([...words(b)].filter(x=>!STOP.has(x)));
    let n=0; for(const w of A) if(B.has(w)) n++; return n;
  }
  function tierBase(t){return t.rank==='Orange'?2.5:t.rank==='Purple'?1.7:t.rank==='Blue'?1.1:0.7}
  function exclusiveMatch(t,char){
    const cid=String(char.source_id||'');
    const exid=String(t.source_value||'');
    const exname=norm(t.exclusive_name||'');
    const cname=norm(char.name_en||'');
    return (exid && cid && exid===cid) || (exname && cname && exname===cname);
  }
  function smHasBuff(text){
    const s=norm(text);
    return ['buff','enhance','increase','boost','grant','gain','empower','strengthen','haste'].some(v=>s.includes(v));
  }
  function directMechanicWords(text){
    const s=norm(text);
    const out=new Set();
    // Important: only count a mechanic when it is actually present in the selected Character/skill.
    if(/\bluck\b|fortune/.test(s)) out.add('luck');
    if(/\bspd\b|speed|haste|action/.test(s)) out.add('speed');
    if(/\bmana\b|energy|energized/.test(s)) out.add('mana');
    if(/\bhp\b|health|heal|healing/.test(s)) out.add('hp');
    if(/soothe|nourishment/.test(s)) out.add('soothe');
    if(/burn|chill|poison|decay|stun|fear|expose|weakness|vulnerable|taunt|hinder/.test(s)) out.add('debuff');
    if(/counter|thorns|reflect/.test(s)) out.add('counter');
    if(/follow[- ]?up|extra action/.test(s)) out.add('follow');
    if(/buff|enhance|increase|boost|grant|empower|strengthen/.test(s)) out.add('buff');
    if(/status|stack|stacks/.test(s)) out.add('status');
    if(/defense|damage taken|shield|barrier|toughness/.test(s)) out.add('defense');
    if(/weakness|exposed|expose/.test(s)) out.add('weakness');
    if(/front|mid|back|nearest|farthest|highest|lowest/.test(s)) out.add('position');
    if(/nine lives|extra life|revive|survive|survival|death/.test(s)) out.add('survival');
    if(/damage|dmg|attack|critical|crit|skill/.test(s)) out.add('damage');
    return out;
  }
  function coreRelations(skillText, skillMech, char){
    const s=norm(skillText), rel={providers:new Set(), consumers:new Set(), conditions:new Set()};
    const keys=['luck','mana','speed','hp','soothe','nourishment','counter','thorns','weakness','debuff','stun','fear','burn','poison','decay','follow-up','multi-hit','crit','critical','shield','toughness','attack','defense'];
    for(const k of keys){
      if(s.includes(norm(k))){
        if(new RegExp('(?:for every|per|based on|scales? with|depending on|for each)[^.!?]{0,70}\\b'+norm(k)+'\\b').test(s)) rel.consumers.add(k);
        if(new RegExp('(?:gain|start|starting|increase|increased|bonus|grant|grants|give|gives)[^.!?]{0,70}\\b'+norm(k)+'\\b').test(s)) rel.providers.add(k);
      }
    }
    if(char.archetypes) for(const a of char.archetypes){
      const x=norm(a);
      for(const k of keys) if(x.includes(k)) rel.consumers.add(k);
      if(/stack/.test(x)) rel.conditions.add('stack');
    }
    return rel;
  }
  function talentRelations(t){
    const x=norm(talentText(t));
    const out={provides:new Set(),consumes:new Set(),survival:false,damage:false,utility:false};
    const keys=['luck','mana','speed','hp','soothe','nourishment','counter','thorns','weakness','debuff','stun','fear','burn','poison','decay','follow-up','multi-hit','crit','critical','shield','toughness','attack','defense','status','buff'];
    for(const k of keys){
      const kx=norm(k);
      if(!x.includes(kx)) continue;
      if(new RegExp('(?:gain|start|starting|increase|increased|bonus|grant|grants|give|gives|add|adds|apply|applies)[^.!?]{0,90}\\b'+kx+'\\b').test(x)) out.provides.add(k);
      if(new RegExp('(?:for every|per|based on|scales? with|depending on|for each)[^.!?]{0,90}\\b'+kx+'\\b').test(x)) out.consumes.add(k);
    }
    out.survival=/nine lives|revive|survive|fatal dmg|fatal damage|death|extra life|cannot die|invulnerab/.test(x);
    out.damage=/damage|dmg|attack|crit|critical|hit/.test(x);
    out.utility=/buff|debuff|status|mana|soothe|speed|weakness|counter|follow/.test(x);
    return out;
  }
  function hasCoreSource(t, core){
    const tr=talentRelations(t);
    for(const k of core.consumers) if(tr.provides.has(k)) return true;
    return false;
  }
  function hasCoreConsumer(t, core){
    const tr=talentRelations(t);
    for(const k of core.consumers) if(tr.consumes.has(k)) return true;
    return false;
  }
  function flatMagnitude(t, key){
    const x=norm(talentText(t));
    const re=new RegExp('(?:gain|grant|grants|give|gives|add|adds|increase|increases|deal|deals)\\s+\\+?(\\d+(?:\\.\\d+)?)\\s*(?:'+norm(key)+')\\b');
    const m=x.match(re); return m?Number(m[1]):0;
  }
  function talentScore(t, skillText, skillMech, char, core){
    const tx=talentText(t), tm=mechanics(tx), tr=talentRelations(t); let score=tierBase(t);
    // EX is useful, but its identity alone is never enough to dominate the build.
    if(exclusiveMatch(t,char)) score += 5;
    // Core-mechanic relationships are the main signal.
    for(const m of skillMech){
      if(tm.has(m)) score += (m==='luck'?5:m==='damage'?2.5:2);
    }
    for(const m of core.consumers){
      if(tr.provides.has(m)){
        score += 22;     // supplies what the skill scales from
        const mag=flatMagnitude(t,m);
        if(mag>0) score += Math.min(18, Math.log2(mag+1)*5);
      }
      if(tr.consumes.has(m)) score += 24;     // directly converts/scales from it
    }
    // Explicitly reward effects that mention the actual skill's scaling phrase.
    if(hasCoreSource(t,core)) score += 8;
    if(hasCoreConsumer(t,core)) score += 10;
    // Survival baseline: most builds benefit from one Nine Lives; do not force four.
    if(tr.survival) score += 3;
    if(/\bnine lives\b/.test(norm(t.name_en||''))){
      score += skillMech.has('survival') ? 6 : 16;
    }
    // Archetype overlap is supporting evidence only.
    const arch=(char.archetypes||[]).map(norm).join(' ');
    if(arch && overlapWords(arch,tx)>0) score+=2;
    // Objective is a secondary preference.
    if(objective==='DPS' && tr.damage) score+=3;
    if(objective==='Sustain' && (tr.survival||tm.has('hp')||tm.has('defense'))) score+=5;
    if(objective==='Control' && tm.has('debuff')) score+=3;
    if(objective==='Speed' && tm.has('speed')) score+=3;
    if(objective==='Resource' && (tm.has('mana')||tm.has('resource')||tm.has('soothe'))) score+=3;
    if(objective==='Character Buff' && (tm.has('buff')||tm.has('status')||tm.has('speed')||tm.has('resource'))) score+=3;
    if(objective==='Character Buff' && smHasBuff(skillText) && (tm.has('buff')||tm.has('status'))) score+=4;
    // Penalize unrelated DoT/control effects when the skill never uses them.
    const skillNorm=norm(skillText);
    for(const dot of ['burn','chill','poison']) if(!skillNorm.includes(dot) && new RegExp('\\b'+dot+'\\b').test(norm(tx))) score-=4;
    return score;
  }
  function isNonStacking(t){
    const x=talentText(t);
    if(/\bnine lives\b/.test(norm(t.name_en||''))) return true;
    return /\b(non[- ]?stack|does not stack|cannot stack|only one|unique effect|duplicate effect)\b/.test(norm(x));
  }
  function likelyStackable(t){
    if(isNonStacking(t)) return false;
    const x=norm(talentText(t));
    // Flat stat/resource gains and explicit per/each wording are normally repeatable.
    if(/\b(per|for every|for each)\b/.test(x) && !/(?:stacks?|stacking)\b/.test(x) && /\b(?:damage|dmg|hit|heal|attack|fear|follow[- ]?up)\b/.test(x)) return false;
    return /\b(stacks?|stacking)\b/.test(x)
      || /\b(?:gain|increase|add)\s+\+?\d/.test(x)
      || /\+\d+(?:\.\d+)?\s*(?:luck|spd|speed|hp|mana|toughness|defense|%)/.test(x);
  }
  function repeatValue(t,count){
    if(count<=1) return 1;
    return likelyStackable(t) ? count : 1;
  }
  function pairScore(a,b,skillMech,core){
    const A=talentRelations(a),B=talentRelations(b); let s=0;
    for(const m of core.consumers){
      if((A.provides.has(m)&&B.consumes.has(m))||(B.provides.has(m)&&A.consumes.has(m))) s+=12;
      if(A.provides.has(m)&&B.provides.has(m)) s+=3;
      if(A.consumes.has(m)&&B.consumes.has(m)) s+=4;
    }
    const AM=mechanics(talentText(a)),BM=mechanics(talentText(b));
    for(const m of AM) if(BM.has(m) && skillMech.has(m)) s+=m==='luck'?1.2:.7;
    const pairs=[['debuff','damage'],['speed','damage'],['mana','damage'],['soothe','status'],['hp','defense'],['weakness','damage'],['follow','damage'],['counter','defense'],['position','damage']];
    for(const [x,y] of pairs) if((A.provides.has(x)||A.consumes.has(x)||AM.has(x))&&(B.provides.has(y)||B.consumes.has(y)||BM.has(y))) s+=1.2;
    return s;
  }
  function buildScore(arr,skillText,sm,char,core){
    let score=0; const counts=new Map();
    for(const t of arr) counts.set(t.id,(counts.get(t.id)||0)+1);
    for(const [id,count] of counts){
      const t=arr.find(x=>x.id===id); const base=talentScore(t,skillText,sm,char,core); const effective=repeatValue(t,count);
      score += base * effective;
      if(count>1 && effective===1) score -= base*(count-1)*1.4;
      if(count>1 && effective===count && !hasCoreSource(t,core) && !hasCoreConsumer(t,core)) score -= base*(count-1)*0.35;
    }
    for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++){
      if(arr[i].id===arr[j].id && !likelyStackable(arr[i])) continue;
      score += pairScore(arr[i],arr[j],sm,core);
    }
    // One survival anchor is strongly preferred for ordinary characters.
    const hasNine=arr.some(t=>/\bnine lives\b/.test(norm(t.name_en||'')));
    const nativeSurvival=sm.has('survival');
    if(!hasNine && !nativeSurvival) score-=90;
    if(hasNine) score+=10;
    // A build should contain at least one provider and/or consumer when the skill has a clear scaling mechanic.
    if(core.consumers.size){
      if(arr.some(t=>hasCoreSource(t,core))) score+=10;
      if(arr.some(t=>hasCoreConsumer(t,core))) score+=12;
    }
    return score;
  }
  function recommend(){
    const c=GAME.characters.find(x=>x.id===selectedId); if(!c)return null;
    const ss=skillFor(c); const skillText=sourceText(c); const sm=new Set([...mechanics(skillText),...directMechanicWords(skillText)]);
    const core=coreRelations(skillText,sm,c);
    const all=(GAME.talents||[]).filter(t=>!t.legacy_only);
    const scored=all.map(t=>({t,base:talentScore(t,skillText,sm,c,core)})).sort((a,b)=>b.base-a.base);
    // Keep a compact but diverse candidate pool. Cross-character EX talents are allowed.
    const survival=(GAME.talents||[]).filter(t=>/\bnine lives\b/.test(norm(t.name_en||'')));
    const coreCandidates=scored.filter(x=>hasCoreSource(x.t,core)||hasCoreConsumer(x.t,core));
    const exclusive=scored.filter(x=>exclusiveMatch(x.t,c));
    const pool=[];
    for(const x of [...survival.map(t=>({t,base:talentScore(t,skillText,sm,c,core)})),...coreCandidates,...exclusive,...scored]){
      if(!pool.some(y=>y.t.id===x.t.id)) pool.push(x);
    }
    const capped=pool.slice(0,32);
    if(capped.length<1)return null;
    const nineEntry=capped.find(x=>/\bnine lives\b/.test(norm(x.t.name_en||'')));
    const nine=nineEntry?.t;
    const requireNine=!!nine && !sm.has('survival');
    let beam=requireNine?[{arr:[nine],score:buildScore([nine],skillText,sm,c,core)}]:[{arr:[],score:0}];
    for(let depth=requireNine?1:0;depth<4;depth++){
      const next=[];
      for(const state of beam){
        for(const x of capped){
          // Do not waste slots on duplicate non-stackable talents.
          if(state.arr.some(y=>y.id===x.t.id) && !likelyStackable(x.t)) continue;
          const arr=[...state.arr,x.t];
          const score=buildScore(arr,skillText,sm,c,core);
          next.push({arr,score});
        }
      }
      next.sort((a,b)=>b.score-a.score); beam=next.slice(0,64);
    }
    beam=beam.filter(state=>!requireNine || state.arr.some(t=>/\bnine lives\b/.test(norm(t.name_en||''))));
    beam.sort((a,b)=>b.score-a.score);
    const best=beam[0]?.arr||[];
    return {character:c,skills:ss,mechanics:sm,core,talents:best,score:beam[0]?.score||0};
  }
  function explain(r){
    const bits=[]; for(const m of ['luck','mana','speed','damage','hp','soothe','counter','follow','weakness','survival']) if(r.mechanics.has(m)) bits.push(m);
    return bits.slice(0,7);
  }
  function talentReason(t,r){
    const tr=talentRelations(t), bits=[];
    for(const m of r.core.consumers){
      if(tr.provides.has(m)) bits.push('Cung cấp '+m.toUpperCase());
      if(tr.consumes.has(m)) bits.push('Khai thác '+m.toUpperCase());
    }
    if(/\bnine lives\b/.test(norm(t.name_en||''))) bits.push('Survival / 9 mạng');
    if(exclusiveMatch(t,r.character)) bits.push('EX chính chủ');
    else if(t.source_cat==='Exclusive') bits.push('EX khác Character');
    if(likelyStackable(t)) bits.push('Có thể lặp hiệu ứng');
    return bits.slice(0,3).join(' · ') || 'Synergy tổng thể';
  }
  function render(){
    const out=document.getElementById('buildAdvisorResults'); if(!out)return;
    const key=selectedId+'|'+objective;
    const r=recommend(); if(!r){out.innerHTML='<div class="muted">Chọn một Character có dữ liệu skill để bắt đầu.</div>';return;}
    const mech=explain(r);
    out.innerHTML=`<div class="ba-summary"><div class="ba-character-selected">${r.character.icon?`<img class="ba-char-icon" src="${esc(r.character.icon)}" alt="" loading="lazy">`:''}<div><b>${esc(r.character.name_en)}</b><span class="muted"> · ${esc(r.character.source_id||'')}</span></div></div><div class="ba-tags">${mech.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`+
      `<div class="ba-skills"><h3>Skill source</h3>${r.skills.length?r.skills.map(s=>`<article><b>${esc(s.skill)}</b><div>${esc(s.desc)}</div><small>${(s.tags||[]).map(esc).join(' · ')}</small></article>`).join(''):'<span class="muted">Không có skill record cho unit này.</span>'}</div>`+
      `<h3>4 Talent đề xuất</h3><div class="ba-talents">${r.talents.map((t,i)=>`<article class="ba-talent"><div class="ba-num">${i+1}</div><div><h4>${esc(t.name_en||t.name_source)}</h4><div class="muted">${esc(t.rank||'')} · ${esc(t.source_label||t.source_cat||'')}</div><p>${esc(t.description_en||t.effect_en||'Chưa có mô tả')}</p><small class="ba-reason">${esc(talentReason(t,r))}</small></div></article>`).join('')}</div>`+
      `<p class="hint"><b>Cách chấm:</b> Skill → cơ chế cốt lõi → Talent cung cấp cơ chế → Talent khai thác cơ chế → survival → synergy. EX của Character khác vẫn được xét theo effect thực tế. Talent lặp chỉ cộng thêm khi effect có khả năng stack; Nine Lives chỉ tính một hiệu ứng.</p>`;
  }
  function inject(){
    const switcher=document.querySelector('.view-switcher'); if(!switcher||document.getElementById('buildAdvisorView'))return;
    const btn=document.createElement('button');btn.id='buildAdvisorBtn';btn.type='button';btn.textContent='🧠 Build Advisor';switcher.appendChild(btn);
    const view=document.createElement('section');view.className='card build-advisor-view';view.id='buildAdvisorView';view.hidden=true;
    view.innerHTML=`<div class="section-head"><div><h2>🧠 Build Advisor</h2><span class="muted">Nhập Character → chọn gợi ý → đọc skill → đối chiếu toàn bộ Talent Database → đề xuất 4 Talent</span></div></div><div class="ba-controls"><label>Character<div class="ba-autocomplete"><input id="baCharacter" type="text" autocomplete="off" placeholder="Nhập tên Character..."><div id="baCharacterSuggestions" class="ba-suggestions" hidden></div></div></label><label>Mục tiêu<select id="baObjective"><option>Skill Synergy</option><option>DPS</option><option>Sustain</option><option>Control</option><option>Speed</option><option>Resource</option><option>Character Buff</option></select></label><button id="baGenerate" class="primary">✨ Đề xuất 4 Talent</button></div><div id="buildAdvisorResults" class="build-advisor-results"></div>`;
    switcher.parentNode.insertBefore(view,switcher.nextSibling);
    const trackerViews=document.querySelectorAll('.tracker-view'),dbView=document.getElementById('talentDatabaseView');
    function show(){trackerViews.forEach(x=>x.hidden=true);if(dbView)dbView.hidden=true;view.hidden=false;btn.classList.add('primary');document.getElementById('trackerViewBtn')?.classList.remove('primary');document.getElementById('databaseViewBtn')?.classList.remove('primary');const out=document.getElementById('buildAdvisorResults');if(out)out.innerHTML='<div class="muted">Chọn Character + mục tiêu rồi bấm ✨ Đề xuất 4 Talent.</div>';}
    btn.onclick=show;
    document.getElementById('trackerViewBtn')?.addEventListener('click',()=>{view.hidden=true;btn.classList.remove('primary');});
    document.getElementById('databaseViewBtn')?.addEventListener('click',()=>{view.hidden=true;btn.classList.remove('primary');});
    const input=document.getElementById('baCharacter');
    const suggestions=document.getElementById('baCharacterSuggestions');
    const chars=(GAME.characters||[]).filter(c=>c.source_id).sort((a,b)=>norm(a.name_en).localeCompare(norm(b.name_en)));
    selectedId=chars[0]?.id||'';
    if(chars[0]) input.value=chars[0].name_en+(chars[0].variant==='Alter'?' · Alter':'');
    function paintSuggestions(query){
      const q=norm(query).trim();
      const list=q?chars.filter(c=>norm(c.name_en).includes(q)||norm(c.source_id).includes(q)).slice(0,12):chars.slice(0,12);
      suggestions.innerHTML=list.map(c=>`<button type="button" class="ba-suggestion" data-id="${esc(c.id)}">${c.icon?`<img class="ba-suggestion-icon" src="${esc(c.icon)}" alt="" loading="lazy">`:''}<span class="ba-suggestion-name">${esc(c.name_en)}</span>${c.variant==='Alter'?'<small>Alter</small>':''}</button>`).join('');
      suggestions.hidden=!list.length;
      suggestions.querySelectorAll('.ba-suggestion').forEach(b=>b.onclick=()=>{const c=chars.find(x=>x.id===b.dataset.id);if(!c)return;selectedId=c.id;input.value=c.name_en+(c.variant==='Alter'?' · Alter':'');suggestions.hidden=true;const out=document.getElementById('buildAdvisorResults');if(out)out.innerHTML='<div class="muted">Đã chọn Character. Bấm ✨ Đề xuất 4 Talent.</div>';});
    }
    input.addEventListener('input',()=>paintSuggestions(input.value));
    input.addEventListener('focus',()=>paintSuggestions(input.value));
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=suggestions.querySelector('.ba-suggestion');if(first)first.click();}else if(e.key==='Escape')suggestions.hidden=true;});
    document.addEventListener('click',e=>{if(!e.target.closest('.ba-autocomplete'))suggestions.hidden=true;});
    document.getElementById('baObjective').onchange=e=>{objective=e.target.value;const out=document.getElementById('buildAdvisorResults');if(out)out.innerHTML='<div class="muted">Đã chọn mục tiêu. Bấm ✨ Đề xuất 4 Talent.</div>';};
    document.getElementById('baGenerate').onclick=render;
    const style=document.createElement('style');style.textContent=`
      .build-advisor-view{margin-top:14px}.ba-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.ba-controls label{display:flex;flex-direction:column;gap:5px;min-width:230px}.ba-controls select,.ba-controls input{min-height:38px;box-sizing:border-box}.ba-autocomplete{position:relative}.ba-autocomplete input{width:100%;padding:8px 10px;border:1px solid var(--border,#ddd);border-radius:8px;background:var(--input-bg,transparent);color:inherit}.ba-suggestions{position:absolute;z-index:50;left:0;right:0;top:calc(100% + 4px);max-height:260px;overflow:auto;border:1px solid var(--border,#ddd);border-radius:10px;background:var(--card-bg,#fff);box-shadow:0 8px 24px rgba(0,0,0,.12)}.ba-suggestion{display:flex;width:100%;align-items:center;justify-content:flex-start;gap:9px;padding:7px 11px;border:0;border-bottom:1px solid var(--border,#ddd);background:transparent;color:inherit;text-align:left;cursor:pointer}.ba-suggestion:hover{background:rgba(127,127,127,.10)}.ba-suggestion-icon{width:32px;height:32px;object-fit:cover;border-radius:7px;flex:0 0 32px}.ba-suggestion-name{flex:1;min-width:0}.ba-suggestion small{opacity:.65;margin-left:auto}.ba-character-selected{display:flex;align-items:center;gap:9px}.ba-char-icon{width:42px;height:42px;object-fit:cover;border-radius:9px;flex:0 0 42px}.build-advisor-results{margin-top:16px}.ba-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid var(--border,#ddd);border-radius:12px;padding:12px}.ba-tags{display:flex;gap:5px;flex-wrap:wrap}.ba-tags span{padding:3px 8px;border:1px solid var(--border,#ddd);border-radius:999px;font-size:11px}.ba-skills{margin:14px 0}.ba-skills article{border-left:3px solid var(--accent,#888);padding:8px 10px;margin:7px 0;background:rgba(127,127,127,.06)}.ba-skills article div{font-size:12px;line-height:1.5;margin-top:3px}.ba-skills small{opacity:.7}.ba-talents{display:grid;gap:9px}.ba-talent{display:grid;grid-template-columns:34px 1fr;gap:10px;border:1px solid var(--border,#ddd);border-radius:12px;padding:11px}.ba-num{font-weight:800;font-size:18px}.ba-talent h4{margin:0 0 2px}.ba-talent p{margin:7px 0 0;font-size:12.5px;line-height:1.5}.ba-reason{display:block;margin-top:7px;opacity:.75;font-size:11px}.build-advisor-view .hint{margin-top:14px}@media(max-width:700px){.ba-controls label,.ba-controls button{width:100%;box-sizing:border-box}.ba-summary{display:block}.ba-tags{margin-top:8px}}
    `;document.head.appendChild(style);
  }
  async function load(){try{const r=await fetch('game-data.json',{cache:'no-store'});if(!r.ok)throw Error();GAME=await r.json();inject();}catch(e){console.warn('Build Advisor: game-data.json unavailable',e)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
