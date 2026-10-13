(()=>{
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 let gears=[],ready=false;
 const gearView=$('gearDatabaseView'),gearBtn=$('gearDatabaseViewBtn');
 function hideGear(){if(gearView)gearView.hidden=true;gearBtn?.classList.remove('primary')}
 function showGear(){
  document.querySelectorAll('.tracker-view').forEach(x=>x.hidden=true);
  ['talentDatabaseView','characterExtrasView','teamBuilderView','buildAdvisorView'].forEach(id=>{const el=$(id);if(el)el.hidden=true});
  gearView.hidden=false;gearBtn.classList.add('primary');
  ['trackerViewBtn','databaseViewBtn','characterExtrasViewBtn','teamBuilderViewBtn','buildAdvisorBtn'].forEach(id=>$(id)?.classList.remove('primary'));
  if(!ready)load();else render();
 }
 async function load(){
  const host=$('gearDatabaseList');host.innerHTML='<p class="muted">Đang tải dữ liệu trang bị…</p>';
  try{
   const r=await fetch('gear-database.json',{cache:'no-cache'});if(!r.ok)throw Error('HTTP '+r.status);
   const data=await r.json();if(!Array.isArray(data)||data.length<1000)throw Error('Dữ liệu trang bị chưa đầy đủ');
   gears=data;ready=true;populateFilters();render();
  }catch(e){host.innerHTML=`<p class="hint">Không tải được gear-database.json: ${esc(e.message)}. Hãy kiểm tra file đã được đưa lên GitHub cùng index.html chưa.</p>`}
 }
 function populateFilters(){
  const fill=(id,values,label)=>{const el=$(id),old=el.value;el.innerHTML=`<option value="All">${label}</option>`+[...new Set(values.filter(Boolean))].sort((a,b)=>a.localeCompare(b)).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');el.value=[...el.options].some(o=>o.value===old)?old:'All'};
  fill('gearSlotFilter',gears.map(g=>g.slot),'Tất cả slot');
  fill('gearClassFilter',gears.flatMap(g=>String(g.cls||'').split(',').map(x=>x.trim())),'Tất cả class');
  fill('gearAreaFilter',gears.map(g=>g.area),'Tất cả khu vực');
 }
 function statsText(g){return Object.entries(g.stats||{}).filter(([k,v])=>Number(v)!==0).map(([k,v])=>`${k} ${Number(v)>0?'+':''}${v}`).join(' · ')}
 function bondsText(g){return (g.bonds||[]).map(b=>`${b.source||''} ${b.name||''} [${b.count??1}] ${b.effect||''}`).join(' · ')}
 function bondsHtml(g){const bonds=g.bonds||[];if(!bonds.length)return '<p><b>Bond:</b> —</p>';return `<section class="gear-bonds"><b>Bond — bấm từng Bond để xem chi tiết</b>${bonds.map(b=>`<details class="gear-bond"><summary class="gear-bond-summary"><span class="gear-bond-title"><b>${esc(b.source||'Bond')}: ${esc(b.name||'—')} [${esc(b.count??1)}]</b></span><span class="gear-bond-toggle" aria-hidden="true"></span></summary><div class="gear-bond-effect">${b.basicDesc||b.effect?`<div><b>Hiệu ứng cơ bản:</b> ${esc(b.basicDesc||b.effect)}</div>`:'<span class="muted">Chưa có mô tả hiệu ứng trong nguồn.</span>'}${Array.isArray(b.tiers)&&b.tiers.length?`<div class="gear-bond-tiers"><b>Hiệu ứng theo số món cùng Bond:</b><ul>${b.tiers.map(t=>`<li><b>${esc(t.pieces)} món:</b> ${esc(t.effect||'—')}</li>`).join('')}</ul></div>`:''}${Array.isArray(b.tags)&&b.tags.length?`<div class="gear-bond-tags"><b>Tags:</b> ${b.tags.map(esc).join(' · ')}</div>`:''}</div></details>`).join('')}</section>`}
 function searchable(g){return norm([g.id,g.name,g.step,g.slot,g.cls,g.src,g.area,g.areaType,statsText(g),g.upgradeAttr,bondsText(g),g.effect].join(' '))}
 function render(){
  const query=norm($('gearDbSearch').value),tier=$('gearTierFilter').value,slot=$('gearSlotFilter').value,cls=$('gearClassFilter').value,area=$('gearAreaFilter').value;
  const found=gears.filter(g=>(tier==='All'||g.step===tier)&&(slot==='All'||g.slot===slot)&&(cls==='All'||String(g.cls||'').split(',').map(x=>x.trim()).includes(cls))&&(area==='All'||g.area===area)&&(!query||searchable(g).includes(query)));
  $('gearDbResultCount').textContent=`${found.length.toLocaleString()} / ${gears.length.toLocaleString()} trang bị`;
  $('gearDatabaseList').innerHTML=found.slice(0,250).map(g=>`<details class="gear-card"><summary><img class="gear-icon" src="https://gomg-wiki.pages.dev/${esc(g.icon||'')}" loading="lazy" onerror="this.style.visibility='hidden'"><span class="gear-main"><b>${esc(g.name)}</b><small>${esc(g.id)} · ${esc(g.step)} · ${esc(g.slot)} · ${esc(g.cls)}</small><small>${esc(statsText(g))}</small></span><span class="gear-chevron">＋</span></summary><div class="gear-detail"><p><b>Khu vực:</b> ${esc(g.area||'—')} · ${esc(g.areaType||'')}</p><p><b>Nguồn:</b> ${esc((g.src||[]).join(', ')||'—')}</p><p><b>Chỉ số:</b> ${esc(statsText(g)||'—')}</p><p><b>Nâng cấp:</b> ${esc((g.upgradeAttr||[]).join(', ')||'—')}</p>${bondsHtml(g)}${g.effect?`<p><b>Hiệu ứng riêng của trang bị:</b> ${esc(g.effect)}</p>`:''}</div></details>`).join('')||'<p class="muted">Không tìm thấy trang bị phù hợp.</p>';
  if(found.length>250)$('gearDbResultCount').textContent+=` · đang hiển thị 250 kết quả đầu, hãy lọc thêm`;
 }
 gearBtn?.addEventListener('click',showGear);
 ['trackerViewBtn','databaseViewBtn','characterExtrasViewBtn','teamBuilderViewBtn','buildAdvisorBtn'].forEach(id=>$(id)?.addEventListener('click',hideGear));
 ['gearDbSearch','gearTierFilter','gearSlotFilter','gearClassFilter','gearAreaFilter'].forEach(id=>$(id)?.addEventListener(id==='gearDbSearch'?'input':'change',render));
})();
