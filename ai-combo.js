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
  const recommendationCache=new Map();
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
  function talentScore(t, skillText, skillMech, char){
    const tx=talentText(t), tm=mechanics(tx); let score=tierBase(t);
    // 1) Character-exclusive talent is the strongest signal by far.
    if(exclusiveMatch(t,char)) score += 28;
    // 2) Match the Character's actual mechanics/scaling.
    for(const m of skillMech){
      if(tm.has(m)){
        if(m==='luck') score+=14;
        else if(m==='damage') score+=5;
        else if(m==='resource'||m==='follow') score+=4.5;
        else score+=3.5;
      }
    }
    // 3) Exact words from the skill are useful, but much weaker than real mechanic matches.
    score += Math.min(5, overlapWords(tx,skillText)*0.55);
    const arch=(char.archetypes||[]).map(norm).join(' ');
    if(arch && overlapWords(arch,tx)>0) score+=3;
    // 4) Objective is a tie-breaker, not the main source of truth.
    if(objective==='DPS' && tm.has('damage')) score+=3;
    if(objective==='Sustain' && (tm.has('hp')||tm.has('defense')||tm.has('survival'))) score+=5;
    if(objective==='Control' && tm.has('debuff')) score+=3;
    if(objective==='Speed' && tm.has('speed')) score+=3;
    if(objective==='Resource' && (tm.has('mana')||tm.has('resource')||tm.has('soothe'))) score+=3;
    if(objective==='Character Buff' && (tm.has('buff')||tm.has('status')||tm.has('speed')||tm.has('resource'))) score+=3;
    if(objective==='Character Buff' && smHasBuff(skillText) && (tm.has('buff')||tm.has('status'))) score+=4;
    // 5) Do NOT reward unrelated DoT/control effects just because they share the broad 'debuff' bucket.
    const skillNorm=norm(skillText);
    const burnOnly=!skillNorm.includes('burn') && /burn/.test(norm(tx));
    const chillOnly=!skillNorm.includes('chill') && /chill/.test(norm(tx));
    const poisonOnly=!skillNorm.includes('poison') && /poison/.test(norm(tx));
    if(burnOnly) score-=5;
    if(chillOnly) score-=5;
    if(poisonOnly) score-=5;
    return score;
  }
  // Duplicate handling: 4 slots may contain the same talent, but duplicate effects do not always stack.
  // Known non-stacking effects are treated as unique; other talents are allowed to repeat.
  function duplicateKey(t){
    return norm([t.name_en,t.description_en,t.effect_en,t.source_value,t.exclusive_name].join('|'));
  }
  function isNonStacking(t){
    const x=talentText(t);
    // Nine Lives is a unique 9-life effect: copies do not grant additional lives.
    if(/\bnine lives\b/.test(norm(t.name_en||''))) return true;
    // Explicit wording indicating uniqueness/non-stacking.
    return /\b(non[- ]?stack|does not stack|cannot stack|only one|unique effect|duplicate effect)\b/.test(norm(x));
  }
  function likelyStackable(t){
    if(isNonStacking(t)) return false;
    const x=norm(talentText(t));
    // Only allow repeated copies to gain extra value when the effect itself
    // looks like something that can accumulate. This prevents every EX from
    // becoming an automatic 4x recommendation.
    return /\b(per|each|every|stacks?|stacking|for every|for each)\b/.test(x)
      || /\b(?:gain|deal|increase|reduce|boost|add|apply)\s+\+?\d/.test(x)
      || /\+\d+(?:\.\d+)?\s*(?:luck|spd|speed|hp|mana|damage|dmg|attack|toughness|defense|%)/.test(x);
  }
  function repeatValue(t,count){
    if(count<=1) return 1;
    return likelyStackable(t) ? count : 1;
  }
  function pairScore(a,b,skillMech){
    const A=mechanics(talentText(a)),B=mechanics(talentText(b)); let s=0;
    for(const m of A) if(B.has(m) && skillMech.has(m)) s+=m==='luck'||m==='damage'?1.8:1;
    const pairs=[['debuff','damage'],['speed','damage'],['mana','damage'],['soothe','status'],['hp','defense'],['weakness','damage'],['follow','damage'],['counter','defense'],['position','damage'],['luck','damage']];
    for(const [x,y] of pairs) if(skillMech.has(x)||skillMech.has(y)) if((A.has(x)&&B.has(y))||(A.has(y)&&B.has(x))) s+=1.5;
    return s;
  }
  function recommend(){
    const c=GAME.characters.find(x=>x.id===selectedId); if(!c)return null;
    const ss=skillFor(c); const skillText=sourceText(c); const sm=new Set([...mechanics(skillText),...directMechanicWords(skillText)]);
    const all=(GAME.talents||[]).filter(t=>!t.legacy_only);
    const scored=all.map(t=>({t,base:talentScore(t,skillText,sm,c)})).sort((a,b)=>b.base-a.base);
    // Keep a broad pool so an exact EX talent can never be crowded out by generic high-tier talents.
    const exclusive=scored.filter(x=>exclusiveMatch(x.t,c));
    const pool=[];
    for(const x of [...exclusive,...scored]) if(!pool.some(y=>y.t.id===x.t.id)) pool.push(x);
    // Keep the expensive combo search small. Most useful candidates are already near the top.
    const capped=pool.slice(0,36);
    if(capped.length<1)return null;

    // Search 4 slots. A talent may repeat. For non-stacking effects (e.g. Nine Lives),
    // repeated copies are legal slots but contribute only once to the build score.
    let beam=[{arr:[],score:0}];
    for(let depth=0;depth<4;depth++){
      const next=[];
      for(const state of beam){
        for(const x of capped){
          const arr=[...state.arr,x.t];
          let score=state.score + x.base;
          const sameCount=arr.filter(t=>t.id===x.t.id).length;
          if(sameCount>1){
            const effective=repeatValue(x.t,sameCount);
            score -= x.base * (sameCount-effective) * 1.25;
          }
          for(const y of state.arr){ if(y.id===x.t.id && !likelyStackable(x.t)) continue; score+=pairScore(x.t,y,sm); }
          next.push({arr,score});
        }
      }
      next.sort((a,b)=>b.score-a.score);
      // Keep enough diversity so both repeat-heavy and mixed builds survive.
      beam=next.slice(0,48);
    }

    let best=null,bestScore=-Infinity;
    for(const state of beam){
      const arr=state.arr;
      let score=0;
      const counts=new Map();
      for(const t of arr) counts.set(t.id,(counts.get(t.id)||0)+1);
      for(const [id,count] of counts){
        const t=arr.find(x=>x.id===id);
        score += talentScore(t,skillText,sm,c);
        const effective=repeatValue(t,count);
        if(effective>1) score += (effective-1)*talentScore(t,skillText,sm,c);
      }
      for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++){ if(arr[i].id===arr[j].id && !likelyStackable(arr[i])) continue; score+=pairScore(arr[i],arr[j],sm); }
      if(exclusive.length && arr.some(t=>exclusiveMatch(t,c))) score+=12;
      if(score>bestScore){bestScore=score;best=arr;}
    }
    return {character:c,skills:ss,mechanics:sm,talents:best,score:bestScore};
  }
  function explain(r){
    const bits=[]; for(const m of ['damage','debuff','speed','mana','hp','soothe','counter','follow','weakness','position','survival']) if(r.mechanics.has(m)) bits.push(m);
    return bits.slice(0,6);
  }
  function render(force=false){
    const out=document.getElementById('buildAdvisorResults'); if(!out)return;
    const key=selectedId+'|'+objective;
    const r=force ? recommend() : recommendationCache.get(key); if(!r){out.innerHTML='<div class="muted">Chọn một Character có dữ liệu skill để bắt đầu.</div>';return;}
    const mech=explain(r);
    out.innerHTML=`<div class="ba-summary"><div class="ba-character-selected">${r.character.icon?`<img class="ba-char-icon" src="${esc(r.character.icon)}" alt="" loading="lazy">`:''}<div><b>${esc(r.character.name_en)}</b><span class="muted"> · ${esc(r.character.source_id||'')}</span></div></div><div class="ba-tags">${mech.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`+
      `<div class="ba-skills"><h3>Skill source</h3>${r.skills.length?r.skills.map(s=>`<article><b>${esc(s.skill)}</b><div>${esc(s.desc)}</div><small>${(s.tags||[]).map(esc).join(' · ')}</small></article>`).join(''):'<span class="muted">Không có skill record cho unit này.</span>'}</div>`+
      `<h3>4 Talent đề xuất</h3><div class="ba-talents">${r.talents.map((t,i)=>`<article class="ba-talent"><div class="ba-num">${i+1}</div><div><h4>${esc(t.name_en||t.name_source)}</h4><div class="muted">${esc(t.rank||'')} · ${esc(t.source_label||t.source_cat||'')}</div><p>${esc(t.description_en||t.effect_en||'Chưa có mô tả')}</p></div></article>`).join('')}</div>`+
      `<p class="hint"><b>Cách chấm:</b> ưu tiên cơ chế thật sự trong Skill/Archetype, EX chỉ là một tín hiệu chứ không mặc định chiếm cả 4 slot. Talent lặp lại chỉ được cộng thêm nếu effect có dấu hiệu stack; hiệu ứng không stack như Nine Lives chỉ tính một lần. Đây là bộ máy chấm điểm local, không gọi API AI và không dùng dữ liệu Tracker.</p>`;
  }
  function inject(){
    const switcher=document.querySelector('.view-switcher'); if(!switcher||document.getElementById('buildAdvisorView'))return;
    const btn=document.createElement('button');btn.id='buildAdvisorBtn';btn.type='button';btn.textContent='🧠 Build Advisor';switcher.appendChild(btn);
    const view=document.createElement('section');view.className='card build-advisor-view';view.id='buildAdvisorView';view.hidden=true;
    view.innerHTML=`<div class="section-head"><div><h2>🧠 Build Advisor</h2><span class="muted">Nhập Character → chọn gợi ý → đọc skill → đối chiếu toàn bộ Talent Database → đề xuất 4 Talent</span></div></div><div class="ba-controls"><label>Character<div class="ba-autocomplete"><input id="baCharacter" type="text" autocomplete="off" placeholder="Nhập tên Character..."><div id="baCharacterSuggestions" class="ba-suggestions" hidden></div></div></label><label>Mục tiêu<select id="baObjective"><option>Skill Synergy</option><option>DPS</option><option>Sustain</option><option>Control</option><option>Speed</option><option>Resource</option><option>Character Buff</option></select></label><button id="baGenerate" class="primary">✨ Đề xuất 4 Talent</button></div><div id="buildAdvisorResults" class="build-advisor-results"></div>`;
    switcher.parentNode.insertBefore(view,switcher.nextSibling);
    const trackerViews=document.querySelectorAll('.tracker-view'),dbView=document.getElementById('talentDatabaseView');
    function show(){trackerViews.forEach(x=>x.hidden=true);if(dbView)dbView.hidden=true;view.hidden=false;btn.classList.add('primary');document.getElementById('trackerViewBtn')?.classList.remove('primary');document.getElementById('databaseViewBtn')?.classList.remove('primary'); const out=document.getElementById('buildAdvisorResults'); if(out && !recommendationCache.has(selectedId+'|'+objective)) out.innerHTML='<div class="muted">Chọn Character + mục tiêu rồi bấm ✨ Đề xuất 4 Talent.</div>'; }
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
      suggestions.querySelectorAll('.ba-suggestion').forEach(b=>b.onclick=()=>{const c=chars.find(x=>x.id===b.dataset.id);if(!c)return;selectedId=c.id;input.value=c.name_en+(c.variant==='Alter'?' · Alter':'');suggestions.hidden=true;recommendationCache.delete(selectedId+'|'+objective);render(false);});
    }
    input.addEventListener('input',()=>paintSuggestions(input.value));
    input.addEventListener('focus',()=>paintSuggestions(input.value));
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=suggestions.querySelector('.ba-suggestion');if(first)first.click();}else if(e.key==='Escape')suggestions.hidden=true;});
    document.addEventListener('click',e=>{if(!e.target.closest('.ba-autocomplete'))suggestions.hidden=true;});
    document.getElementById('baObjective').onchange=e=>{objective=e.target.value;recommendationCache.delete(selectedId+'|'+objective);render(false)};
    document.getElementById('baGenerate').onclick=()=>{
      const out=document.getElementById('buildAdvisorResults');
      if(out) out.innerHTML='<div class="muted">⏳ Đang phân tích Talent...</div>';
      setTimeout(()=>render(true),0);
    };
    const style=document.createElement('style');style.textContent=`
      .build-advisor-view{margin-top:14px}.ba-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.ba-controls label{display:flex;flex-direction:column;gap:5px;min-width:230px}.ba-controls select,.ba-controls input{min-height:38px;box-sizing:border-box}.ba-autocomplete{position:relative}.ba-autocomplete input{width:100%;padding:8px 10px;border:1px solid var(--border,#ddd);border-radius:8px;background:var(--input-bg,transparent);color:inherit}.ba-suggestions{position:absolute;z-index:50;left:0;right:0;top:calc(100% + 4px);max-height:260px;overflow:auto;border:1px solid var(--border,#ddd);border-radius:10px;background:var(--card-bg,#fff);box-shadow:0 8px 24px rgba(0,0,0,.12)}.ba-suggestion{display:flex;width:100%;align-items:center;justify-content:flex-start;gap:9px;padding:7px 11px;border:0;border-bottom:1px solid var(--border,#ddd);background:transparent;color:inherit;text-align:left;cursor:pointer}.ba-suggestion:hover{background:rgba(127,127,127,.10)}.ba-suggestion-icon{width:32px;height:32px;object-fit:cover;border-radius:7px;flex:0 0 32px}.ba-suggestion-name{flex:1;min-width:0}.ba-suggestion small{opacity:.65;margin-left:auto}.ba-character-selected{display:flex;align-items:center;gap:9px}.ba-char-icon{width:42px;height:42px;object-fit:cover;border-radius:9px;flex:0 0 42px}.build-advisor-results{margin-top:16px}.ba-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid var(--border,#ddd);border-radius:12px;padding:12px}.ba-tags{display:flex;gap:5px;flex-wrap:wrap}.ba-tags span{padding:3px 8px;border:1px solid var(--border,#ddd);border-radius:999px;font-size:11px}.ba-skills{margin:14px 0}.ba-skills article{border-left:3px solid var(--accent,#888);padding:8px 10px;margin:7px 0;background:rgba(127,127,127,.06)}.ba-skills article div{font-size:12px;line-height:1.5;margin-top:3px}.ba-skills small{opacity:.7}.ba-talents{display:grid;gap:9px}.ba-talent{display:grid;grid-template-columns:34px 1fr;gap:10px;border:1px solid var(--border,#ddd);border-radius:12px;padding:11px}.ba-num{font-weight:800;font-size:18px}.ba-talent h4{margin:0 0 2px}.ba-talent p{margin:7px 0 0;font-size:12.5px;line-height:1.5}.build-advisor-view .hint{margin-top:14px}@media(max-width:700px){.ba-controls label,.ba-controls button{width:100%;box-sizing:border-box}.ba-summary{display:block}.ba-tags{margin-top:8px}}
    `;document.head.appendChild(style);
  }
  async function load(){try{const r=await fetch('game-data.json',{cache:'no-store'});if(!r.ok)throw Error();GAME=await r.json();inject();}catch(e){console.warn('Build Advisor: game-data.json unavailable',e)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
