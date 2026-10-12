(()=>{
const KEY='gomg-team-builder-v1';let profiles=[],saved=[],currentId=null;
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const profileLabel=p=>`${p.character||p.base_name||p.stem}${p.variant?' · '+p.variant:''}`;
const iconHTML=p=>p?.icon?`<img class="tb-option-icon" src="${esc(p.icon)}" alt="" loading="lazy" onerror="this.style.display='none'">`:'<span class="tb-option-icon tb-no-icon">✦</span>';
function blankTeam(){return {id:'team-'+Date.now(),name:'',members:[0,1,2].map(()=>({character:'',trait:'',title:'',perk:''}))}}
let team=blankTeam();
function loadSaved(){try{saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(!Array.isArray(saved))saved=[]}catch{saved=[]}}
function persist(){localStorage.setItem(KEY,JSON.stringify(saved))}
function choicesFor(memberIndex,kind){const selected=team.members[memberIndex].character;const self=profiles.find(p=>p.stem===selected);return profiles.filter(p=>!self||p.base_name!==self.base_name).filter(p=>p[kind]&&p[kind].name).sort((a,b)=>profileLabel(a).localeCompare(profileLabel(b)))}
function effectText(p,kind){const x=p?.[kind];if(!x)return '';return `${x.name||''}${x.unlock?' · '+x.unlock:''}${(x.effect||[]).length?'\n'+x.effect.join('\n'):''}`}
function searchBox({index,kind,selected,items,placeholder}){
 const picked=items.find(p=>p.stem===selected);
 const value=picked?(kind==='character'?profileLabel(picked):`${profileLabel(picked)} — ${picked[kind].name}`):'';
 return `<div class="tb-autocomplete" data-member="${index}" data-kind="${kind}" data-selected="${esc(selected||'')}">
 <div class="tb-search-wrap">${picked?iconHTML(picked):''}<div class="tb-search-input" contenteditable="true" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-label="${esc(kind==='character'?'Nhân vật '+(index+1):kind==='trait'?'Trait':kind==='title'?'Title':'Perk')}" data-placeholder="${esc(placeholder)}" data-search-input="1">${esc(value)}</div></div>
 <div class="tb-suggestions" role="listbox" hidden></div></div>`;
}
function render(){const host=$('teamBuilderMembers');if(!host)return;
 host.innerHTML=team.members.map((m,i)=>{
  const chosen=profiles.find(p=>p.stem===m.character);
  const slots=['trait','title','perk'].map(k=>{
   const options=choicesFor(i,k),value=m[k],picked=profiles.find(p=>p.stem===value&&p[k]?.name);
   return `<div class="team-slot"><label>${k==='trait'?'🧬 Trait':k==='title'?'🏷️ Title':'✨ Perk'}</label>${searchBox({index:i,kind:k,selected:value,items:options,placeholder:`Tìm ${k==='trait'?'Trait':k==='title'?'Title':'Perk'} hoặc tên nhân vật…`})}${picked?`<div class="chosen-source">Nguồn: ${esc(profileLabel(picked))} · ${esc(picked[k].id||'')}</div><p class="chosen-effect">${esc(effectText(picked,k))}</p>`:'<p class="chosen-effect muted">Chưa chọn hiệu ứng</p>'}</div>`
  }).join('');
  return `<article class="team-member-card"><div class="team-member-head"><span class="member-number">${i+1}</span><div class="member-character"><b>Nhân vật ${i+1}</b>${searchBox({index:i,kind:'character',selected:m.character,items:profiles,placeholder:'Gõ tên nhân vật để tìm…'})}</div></div>${slots}</article>`
 }).join('');
 $('teamName').value=team.name||'';$('teamBuilderStatus').textContent=`${profiles.length} profiles · ${team.members.length} nhân vật`;renderSaved();
}
function renderSaved(){const el=$('savedTeamsList');if(!el)return;el.innerHTML=saved.map(t=>`<div class="saved-team-item"><span class="saved-team-name">${esc(t.name||'Team chưa đặt tên')} · ${(t.members||[]).filter(m=>m.character).length}/3</span><button type="button" data-load-team="${esc(t.id)}">Mở</button><button type="button" data-delete-team="${esc(t.id)}">Xóa</button></div>`).join('')||'<p class="muted">Chưa có team nào được lưu.</p>'}
function saveTeam(){team.name=$('teamName').value.trim();if(!team.members.some(m=>m.character)){alert('Chọn ít nhất một nhân vật trước khi lưu nhé.');return}const ix=saved.findIndex(t=>t.id===team.id);const copy=JSON.parse(JSON.stringify(team));if(ix>=0)saved[ix]=copy;else saved.unshift(copy);persist();renderSaved();$('teamBuilderStatus').textContent='Đã lưu team trên trình duyệt này';}
function newTeam(){team=blankTeam();currentId=null;render()}
function downloadJSON(){const blob=new Blob([JSON.stringify(team,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=(team.name||'gomg-team').replace(/[^a-z0-9_-]+/gi,'_')+'.json';a.click();URL.revokeObjectURL(a.href)}
function closeSuggestions(except){document.querySelectorAll('#teamBuilderMembers .tb-autocomplete').forEach(box=>{if(box!==except){const list=box.querySelector('.tb-suggestions');if(list)list.hidden=true;const input=box.querySelector('.tb-search-input');if(input)input.setAttribute('aria-expanded','false')}})}
function showSuggestions(box,query=''){
 const index=Number(box.dataset.member),kind=box.dataset.kind,member=team.members[index];if(!member)return;
 const selected=member[kind];let items=kind==='character'?profiles:choicesFor(index,kind);
 const q=norm(query.trim());if(q)items=items.filter(p=>norm(profileLabel(p)).includes(q)||(kind!=='character'&&norm(p[kind]?.name||'').includes(q))||(kind!=='character'&&norm(effectText(p,kind)).includes(q)));
 items=items.slice(0,80);const list=box.querySelector('.tb-suggestions');
 list.innerHTML=items.length?items.map(p=>{const label=kind==='character'?profileLabel(p):`${profileLabel(p)} — ${p[kind].name}`;const desc=kind==='character'?(p.variant||p.base_name||''):((p[kind].effect||[]).join(' ').slice(0,180));return `<button type="button" class="tb-suggestion${p.stem===selected?' is-selected':''}" role="option" aria-selected="${p.stem===selected?'true':'false'}" data-pick-stem="${esc(p.stem)}">${iconHTML(p)}<span class="tb-suggestion-text"><strong>${esc(label)}</strong>${desc?`<small>${esc(desc)}</small>`:''}</span></button>`}).join(''):'<div class="tb-no-results">Không tìm thấy kết quả phù hợp.</div>';
 list.hidden=false;box.querySelector('.tb-search-input').setAttribute('aria-expanded','true');closeSuggestions(box);
}
function injectStyles(){if($('teamBuilderAutocompleteStyles'))return;const style=document.createElement('style');style.id='teamBuilderAutocompleteStyles';style.textContent=`
#teamBuilderMembers .team-member-card{min-width:0}
#teamBuilderMembers .team-member-head{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:start;gap:10px}
#teamBuilderMembers .member-number{padding-top:32px}
#teamBuilderMembers .member-character{min-width:0;width:100%}
#teamBuilderMembers .member-character>b{display:block;margin-bottom:6px}
#teamBuilderMembers .tb-autocomplete{position:relative;width:100%;min-width:0}
#teamBuilderMembers .tb-picked-label{display:flex;align-items:flex-start;gap:8px;width:100%;min-width:0;margin-bottom:6px;padding:7px 8px;border:1px solid #e2c8b6;border-radius:8px;background:#fff7f0;line-height:1.4}
#teamBuilderMembers .tb-picked-label>span{flex:1;min-width:0;white-space:normal;overflow-wrap:anywhere;word-break:normal;font-size:12px}
#teamBuilderMembers .tb-picked-label .tb-option-icon{width:28px;height:28px;flex-basis:28px}
#teamBuilderMembers .tb-search-wrap{display:flex;align-items:center;gap:7px;min-width:0;width:100%;box-sizing:border-box;border:1px solid var(--border-color,#d9c8bd);border-radius:9px;background:var(--input-bg,#fffaf6);padding:0 9px;min-height:40px}
#teamBuilderMembers .tb-search-wrap:focus-within{outline:2px solid #b98368;outline-offset:1px}
#teamBuilderMembers .tb-search-wrap>.tb-option-icon{width:26px;height:26px;flex:0 0 26px}
#teamBuilderMembers .tb-search-input{display:block;white-space:normal;overflow-wrap:anywhere;word-break:normal;max-height:7em;overflow-y:auto;line-height:1.35;cursor:text}
#teamBuilderMembers .tb-search-input{border:0!important;outline:0!important;box-shadow:none!important;background:transparent!important;width:100%;min-width:0;padding:9px 0!important;font:inherit;color:inherit}
#teamBuilderMembers .tb-search-input:empty:before{content:attr(data-placeholder);color:#a18b7c;pointer-events:none}
#teamBuilderMembers .tb-search-wrap:has(.tb-search-input:not(:empty)){align-items:flex-start}
#teamBuilderMembers .tb-search-wrap:has(.tb-search-input:not(:empty))>.tb-option-icon{margin-top:6px}
#teamBuilderMembers .tb-option-icon{width:30px;height:30px;flex:0 0 30px;object-fit:contain;border-radius:6px}
#teamBuilderMembers .tb-no-icon{display:inline-flex;align-items:center;justify-content:center;background:#eee0d6;color:#78513f}
#teamBuilderMembers .tb-suggestions{position:absolute;z-index:1000;left:0;right:0;top:calc(100% + 4px);max-height:300px;overflow:auto;background:#fffaf6;color:#34251f;border:1px solid #d8b9a7;border-radius:10px;box-shadow:0 8px 24px #3d241d30;padding:4px}
#teamBuilderMembers .tb-suggestions[hidden]{display:none}
#teamBuilderMembers .tb-suggestion{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:0;border-radius:7px;background:transparent;color:inherit;padding:7px;cursor:pointer;font:inherit}
#teamBuilderMembers .tb-suggestion:hover,#teamBuilderMembers .tb-suggestion.is-selected{background:#f0dfd4}
#teamBuilderMembers .tb-suggestion-text{display:flex;flex-direction:column;gap:3px;min-width:0;overflow-wrap:anywhere}
#teamBuilderMembers .tb-suggestion-text strong{font-size:13px;font-weight:600}
#teamBuilderMembers .tb-suggestion-text small{font-size:11px;line-height:1.35;color:#806f66;white-space:normal}
#teamBuilderMembers .tb-no-results{padding:12px;font-size:12px;color:#806f66}
#teamBuilderMembers .chosen-effect{white-space:pre-line;overflow-wrap:anywhere}
@media(max-width:650px){#teamBuilderMembers .team-member-head{gap:7px}#teamBuilderMembers .tb-suggestions{max-height:240px}}
`;document.head.appendChild(style)}
window.renderTeamBuilder=render;
document.addEventListener('input',e=>{const input=e.target.closest('#teamBuilderMembers .tb-search-input');if(!input)return;const box=input.closest('.tb-autocomplete');showSuggestions(box,input.textContent)});
document.addEventListener('focusin',e=>{const input=e.target.closest('#teamBuilderMembers .tb-search-input');if(!input)return;const box=input.closest('.tb-autocomplete');showSuggestions(box,input.textContent);input.select()});
document.addEventListener('keydown',e=>{const input=e.target.closest('#teamBuilderMembers .tb-search-input');if(!input)return;const box=input.closest('.tb-autocomplete'),list=box.querySelector('.tb-suggestions');if(e.key==='Escape'){list.hidden=true;input.setAttribute('aria-expanded','false');return}if(e.key==='ArrowDown'&&!list.hidden){e.preventDefault();list.querySelector('.tb-suggestion')?.focus()}if(e.key==='Enter'&&!list.hidden){e.preventDefault();list.querySelector('.tb-suggestion')?.click()}});
document.addEventListener('click',e=>{
 const pick=e.target.closest('#teamBuilderMembers [data-pick-stem]');if(pick){const box=pick.closest('.tb-autocomplete'),i=Number(box.dataset.member),k=box.dataset.kind;if(!team.members[i])return;team.members[i][k]=pick.dataset.pickStem;if(k==='character'){team.members[i].trait='';team.members[i].title='';team.members[i].perk=''}render();return}
 if(!e.target.closest('#teamBuilderMembers .tb-autocomplete'))closeSuggestions(null);
 if(e.target.closest('#saveTeamBtn'))saveTeam();if(e.target.closest('#newTeamBtn'))newTeam();if(e.target.closest('#exportTeamBtn'))downloadJSON();const load=e.target.closest('[data-load-team]');if(load){const found=saved.find(t=>t.id===load.dataset.loadTeam);if(found){team=JSON.parse(JSON.stringify(found));render()}}const del=e.target.closest('[data-delete-team]');if(del&&confirm('Xóa team đã lưu này?')){saved=saved.filter(t=>t.id!==del.dataset.deleteTeam);persist();renderSaved()}
});
async function init(){injectStyles();loadSaved();try{const r=await fetch('character-extras.json',{cache:'no-store'});const d=await r.json();profiles=Array.isArray(d.data)?d.data:[]}catch{profiles=[]}$('teamBuilderStatus').textContent=profiles.length?`${profiles.length} profiles đã tải`:'Không tải được character-extras.json';render()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
