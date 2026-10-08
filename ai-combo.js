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
    position:['front','mid','back','nearest','farthest','highest','lowest']
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
  function tierBase(t){return t.rank==='Orange'?7:t.rank==='Purple'?5:t.rank==='Blue'?3:2}
  function smHasBuff(text){
    const s=norm(text);
    return ['buff','enhance','increase','boost','grant','gain','empower','strengthen','haste'].some(v=>s.includes(v));
  }
  function talentScore(t, skillText, skillMech, char){
    const tx=talentText(t), tm=mechanics(tx); let score=tierBase(t)*0.8;
    for(const m of skillMech){ if(tm.has(m)) score += (m==='damage'||m==='debuff'||m==='resource'||m==='follow')?5:3; }
    score += Math.min(7, overlapWords(tx,skillText)*1.1);
    const arch=(char.archetypes||[]).map(norm).join(' '), nt=norm(tx);
    if(arch && overlapWords(arch,tx)>0) score+=2.5;
    if(objective==='DPS' && tm.has('damage')) score+=4;
    if(objective==='Sustain' && (tm.has('hp')||tm.has('defense'))) score+=4;
    if(objective==='Control' && tm.has('debuff')) score+=4;
    if(objective==='Speed' && tm.has('speed')) score+=4;
    if(objective==='Resource' && (tm.has('mana')||tm.has('resource')||tm.has('soothe'))) score+=4;
    if(objective==='Character Buff' && (tm.has('buff')||tm.has('status')||tm.has('speed')||tm.has('resource'))) score+=4;
    if(objective==='Character Buff' && smHasBuff(skillText)) score += (tm.has('buff')||tm.has('status')) ? 3 : 0;
    return score;
  }
  function pairScore(a,b){
    const A=mechanics(talentText(a)),B=mechanics(talentText(b)); let s=0;
    for(const m of A) if(B.has(m)) s+=m==='damage'||m==='resource'||m==='status'?2:1.25;
    const pairs=[['debuff','damage'],['speed','damage'],['mana','damage'],['soothe','status'],['hp','defense'],['weakness','damage'],['follow','damage'],['counter','defense'],['position','damage']];
    for(const [x,y] of pairs) if((A.has(x)&&B.has(y))||(A.has(y)&&B.has(x))) s+=2.5;
    return s;
  }
  function recommend(){
    const c=GAME.characters.find(x=>x.id===selectedId); if(!c)return null;
    const ss=skillFor(c); const skillText=sourceText(c); const sm=mechanics(skillText);
    const pool=(GAME.talents||[]).filter(t=>!t.legacy_only).map(t=>({t,base:talentScore(t,skillText,sm,c)})).sort((a,b)=>b.base-a.base).slice(0,80);
    if(pool.length<4)return null;
    let beam=pool.slice(0,20).map(x=>[x.t]);
    for(let depth=1;depth<4;depth++){
      const next=[];
      for(const arr of beam){
        const used=new Set(arr.map(x=>x.id));
        for(const x of pool){if(used.has(x.t.id))continue;let s=x.base;for(const y of arr)s+=pairScore(x.t,y);next.push({arr:[...arr,x.t],score:s});}
      }
      next.sort((a,b)=>b.score-a.score); beam=next.slice(0,60).map(x=>x.arr);
    }
    let best=null,bestScore=-Infinity;
    for(const arr of beam){let score=arr.reduce((n,t)=>n+talentScore(t,skillText,sm,c),0);for(let i=0;i<arr.length;i++)for(let j=i+1;j<arr.length;j++)score+=pairScore(arr[i],arr[j]);if(score>bestScore){bestScore=score;best=arr;}}
    return {character:c,skills:ss,mechanics:sm,talents:best,score:bestScore};
  }
  function explain(r){
    const bits=[]; for(const m of ['damage','debuff','speed','mana','hp','soothe','counter','follow','weakness','position']) if(r.mechanics.has(m)) bits.push(m);
    return bits.slice(0,6);
  }
  function render(){
    const out=document.getElementById('buildAdvisorResults'); if(!out)return;
    const r=recommend(); if(!r){out.innerHTML='<div class="muted">Chọn một Character có dữ liệu skill để bắt đầu.</div>';return;}
    const mech=explain(r);
    out.innerHTML=`<div class="ba-summary"><div><b>${esc(r.character.name_en)}</b><span class="muted"> · ${esc(r.character.source_id||'')}</span></div><div class="ba-tags">${mech.map(x=>`<span>${esc(x)}</span>`).join('')}</div></div>`+
      `<div class="ba-skills"><h3>Skill source</h3>${r.skills.length?r.skills.map(s=>`<article><b>${esc(s.skill)}</b><div>${esc(s.desc)}</div><small>${(s.tags||[]).map(esc).join(' · ')}</small></article>`).join(''):'<span class="muted">Không có skill record cho unit này.</span>'}</div>`+
      `<h3>4 Talent đề xuất</h3><div class="ba-talents">${r.talents.map((t,i)=>`<article class="ba-talent"><div class="ba-num">${i+1}</div><div><h4>${esc(t.name_en||t.name_source)}</h4><div class="muted">${esc(t.rank||'')} · ${esc(t.source_label||t.source_cat||'')}</div><p>${esc(t.description_en||t.effect_en||'Chưa có mô tả')}</p></div></article>`).join('')}</div>`+
      `<p class="hint"><b>Cách chấm:</b> đối chiếu mechanic trong skill/tag của Character với effect/tags của Talent Database, sau đó cộng điểm synergy giữa 4 talent. Đây là bộ máy chấm điểm local, không gọi API AI và không dùng dữ liệu Tracker.</p>`;
  }
  function inject(){
    const switcher=document.querySelector('.view-switcher'); if(!switcher||document.getElementById('buildAdvisorView'))return;
    const btn=document.createElement('button');btn.id='buildAdvisorBtn';btn.type='button';btn.textContent='🧠 Build Advisor';switcher.appendChild(btn);
    const view=document.createElement('section');view.className='card build-advisor-view';view.id='buildAdvisorView';view.hidden=true;
    view.innerHTML=`<div class="section-head"><div><h2>🧠 Build Advisor</h2><span class="muted">Nhập Character → chọn gợi ý → đọc skill → đối chiếu toàn bộ Talent Database → đề xuất 4 Talent</span></div></div><div class="ba-controls"><label>Character<div class="ba-autocomplete"><input id="baCharacter" type="text" autocomplete="off" placeholder="Nhập tên Character..."><div id="baCharacterSuggestions" class="ba-suggestions" hidden></div></div></label><label>Mục tiêu<select id="baObjective"><option>Skill Synergy</option><option>DPS</option><option>Sustain</option><option>Control</option><option>Speed</option><option>Resource</option><option>Character Buff</option></select></label><button id="baGenerate" class="primary">✨ Đề xuất 4 Talent</button></div><div id="buildAdvisorResults" class="build-advisor-results"></div>`;
    switcher.parentNode.insertBefore(view,switcher.nextSibling);
    const trackerViews=document.querySelectorAll('.tracker-view'),dbView=document.getElementById('talentDatabaseView');
    function show(){trackerViews.forEach(x=>x.hidden=true);if(dbView)dbView.hidden=true;view.hidden=false;btn.classList.add('primary');document.getElementById('trackerViewBtn')?.classList.remove('primary');document.getElementById('databaseViewBtn')?.classList.remove('primary');render();}
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
      suggestions.innerHTML=list.map(c=>`<button type="button" class="ba-suggestion" data-id="${esc(c.id)}"><span>${esc(c.name_en)}</span>${c.variant==='Alter'?'<small>Alter</small>':''}</button>`).join('');
      suggestions.hidden=!list.length;
      suggestions.querySelectorAll('.ba-suggestion').forEach(b=>b.onclick=()=>{const c=chars.find(x=>x.id===b.dataset.id);if(!c)return;selectedId=c.id;input.value=c.name_en+(c.variant==='Alter'?' · Alter':'');suggestions.hidden=true;render();});
    }
    input.addEventListener('input',()=>paintSuggestions(input.value));
    input.addEventListener('focus',()=>paintSuggestions(input.value));
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){const first=suggestions.querySelector('.ba-suggestion');if(first)first.click();}else if(e.key==='Escape')suggestions.hidden=true;});
    document.addEventListener('click',e=>{if(!e.target.closest('.ba-autocomplete'))suggestions.hidden=true;});
    document.getElementById('baObjective').onchange=e=>{objective=e.target.value;render()};
    document.getElementById('baGenerate').onclick=render;
    const style=document.createElement('style');style.textContent=`
      .build-advisor-view{margin-top:14px}.ba-controls{display:flex;gap:10px;align-items:end;flex-wrap:wrap}.ba-controls label{display:flex;flex-direction:column;gap:5px;min-width:230px}.ba-controls select,.ba-controls input{min-height:38px;box-sizing:border-box}.ba-autocomplete{position:relative}.ba-autocomplete input{width:100%;padding:8px 10px;border:1px solid var(--border,#ddd);border-radius:8px;background:var(--input-bg,transparent);color:inherit}.ba-suggestions{position:absolute;z-index:50;left:0;right:0;top:calc(100% + 4px);max-height:260px;overflow:auto;border:1px solid var(--border,#ddd);border-radius:10px;background:var(--card-bg,#fff);box-shadow:0 8px 24px rgba(0,0,0,.12)}.ba-suggestion{display:flex;width:100%;justify-content:space-between;gap:10px;padding:9px 11px;border:0;border-bottom:1px solid var(--border,#ddd);background:transparent;color:inherit;text-align:left;cursor:pointer}.ba-suggestion:hover{background:rgba(127,127,127,.10)}.ba-suggestion small{opacity:.65}.build-advisor-results{margin-top:16px}.ba-summary{display:flex;justify-content:space-between;gap:12px;align-items:center;border:1px solid var(--border,#ddd);border-radius:12px;padding:12px}.ba-tags{display:flex;gap:5px;flex-wrap:wrap}.ba-tags span{padding:3px 8px;border:1px solid var(--border,#ddd);border-radius:999px;font-size:11px}.ba-skills{margin:14px 0}.ba-skills article{border-left:3px solid var(--accent,#888);padding:8px 10px;margin:7px 0;background:rgba(127,127,127,.06)}.ba-skills article div{font-size:12px;line-height:1.5;margin-top:3px}.ba-skills small{opacity:.7}.ba-talents{display:grid;gap:9px}.ba-talent{display:grid;grid-template-columns:34px 1fr;gap:10px;border:1px solid var(--border,#ddd);border-radius:12px;padding:11px}.ba-num{font-weight:800;font-size:18px}.ba-talent h4{margin:0 0 2px}.ba-talent p{margin:7px 0 0;font-size:12.5px;line-height:1.5}.build-advisor-view .hint{margin-top:14px}@media(max-width:700px){.ba-controls label,.ba-controls button{width:100%;box-sizing:border-box}.ba-summary{display:block}.ba-tags{margin-top:8px}}
    `;document.head.appendChild(style);
  }
  async function load(){try{const r=await fetch('game-data.json',{cache:'no-store'});if(!r.ok)throw Error();GAME=await r.json();inject();}catch(e){console.warn('Build Advisor: game-data.json unavailable',e)}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load);else load();
})();
