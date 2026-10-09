const KEY="gomg-talent-tracker-v3";let GAME=null,db=null;
const starter={girls:[],log:[]};
const BOARD_COUNT=4,SLOT_COUNT=4;
function emptyBoards(){return Array.from({length:BOARD_COUNT},()=>Array(SLOT_COUNT).fill(""))}
function normalizeGirl(g,i){
  let boards=g.boards;
  if(!Array.isArray(boards)){
    const old=Array.isArray(g.talents)?g.talents.slice(0,SLOT_COUNT):Array(SLOT_COUNT).fill("");
    boards=emptyBoards(); boards[0]=old.concat(Array(Math.max(0,SLOT_COUNT-old.length)).fill("")).slice(0,SLOT_COUNT);
  } else {
    boards=Array.from({length:BOARD_COUNT},(_,b)=>Array.isArray(boards[b])?boards[b].slice(0,SLOT_COUNT).concat(Array(Math.max(0,SLOT_COUNT-(boards[b]||[]).length)).fill("")).slice(0,SLOT_COUNT):Array(SLOT_COUNT).fill(""));
  }
  return {...g,boards,activeBoard:Number.isInteger(g.activeBoard)&&g.activeBoard>=0&&g.activeBoard<BOARD_COUNT?g.activeBoard:0};
}
const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function clone(x){return JSON.parse(JSON.stringify(x))}
function loadLocal(){try{return JSON.parse(localStorage.getItem(KEY))||clone(starter)}catch{return clone(starter)}}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function splitTalentValue(v){const raw=String(v||"");const p=raw.lastIndexOf("|");return p>0?{id:raw.slice(0,p),tier:raw.slice(p+1)}:{id:raw,tier:""}}
function talentById(id){const x=splitTalentValue(id);return GAME.talents.find(t=>t.id===x.id)}
function talentTier(id){const x=splitTalentValue(id),t=talentById(id);return x.tier&&t&&t.tiers?.includes(x.tier)?x.tier:(t?.rank||"")}
function talentValue(id,tier){if(!id)return "";const t=talentById(id);const tierOk=tier&&t?.tiers?.includes(tier)?tier:(t?.rank||"");return tierOk?`${splitTalentValue(id).id}|${tierOk}`:splitTalentValue(id).id}
function charById(id){return GAME.characters.find(x=>x.id===id)}
function talentLabel(id){let t=talentById(id);const x=splitTalentValue(id);return t?talentName(t):(x.id||"")}
function charLabel(id){let c=charById(id);return c?c.name_en:id||""}
function tierClass(t){return t?`tier tier-${t}`:""}
function tierOptions(t,selected){const tiers=Array.isArray(t?.tiers)&&t.tiers.length?t.tiers:[t?.rank].filter(Boolean);const order=["Orange","Purple","Blue","Green"];const sorted=order.filter(x=>tiers.includes(x)).concat(tiers.filter(x=>!order.includes(x)));return sorted.map(x=>`<option value="${esc(x)}" ${x===selected?"selected":""}>${esc(x)}</option>`).join("")}
const NAME_TRANSLATIONS={"伤害加深":"Deepened Damage","冬眠蛰伏":"Hibernating Ambush","剧毒唾液":"Toxic Saliva","动态视觉":"Dynamic Vision","动能转化":"Kinetic Conversion","厚实鳞甲":"Thick Scales","变温爆发":"Ectothermic Burst","变色鳞甲":"Color-Changing Scales","吸水皮肤":"Water-Absorbing Skin","奇形吹管":"Strange Flute","巨颚撕咬":"Giant Jaw Bite","强力后肢":"Powerful Hind Legs","断尾求生":"Tail-Shedding Survival","施虐打击":"Sadistic Strike","既定程序":"Preset Program","死亡翻滚":"Death Roll","沼泽霸主":"Swamp Overlord","浪潮翻涌":"Surging Tide","清脆蛙鸣":"Clear Frog Call","猎魔仪式":"Demon Hunt Ritual","疯狂生长":"Wild Growth","耐心潜伏":"Patient Ambush","能源自毁":"Energy Self-Destruct","自我诊断":"Self-Diagnosis","致命毒素":"Deadly Toxin","超载运行":"Overload","远古意志":"Ancient Will","难以清洗":"Hard to Cleanse","默默潜水":"Silent Diving"};
function talentName(t){return t?.name_en||NAME_TRANSLATIONS[t?.name_source||t?.name_cn]||t?.name_source||t?.name_cn||t?.id||"Unknown Talent"}
function talentSourceName(t){return t?.name_source||t?.name_cn||""}
function tierEffect(t,tier){let text=t?.description_en||t?.effect_en||t?.description||"No description available.";const vals=(t?.tier_values?.[tier]||[]).filter(v=>v!==undefined&&v!==null&&String(v)!=="0"&&String(v)!=="");let n=0;if(vals.length)text=text.replace(/\b\d+(?:\.\d+)?\b/g,match=>n<vals.length?String(vals[n++]):match);return text}
function tierDot(tier){return ({Green:"🟢",Blue:"🔵",Purple:"🟣",Orange:"🟠"})[tier]||"⚪"}
function renderTalentDatabase(){const list=$("talentDatabaseList");if(!list)return;const q=normalizeText($("talentDbSearch")?.value||"");const active=document.querySelector('[data-db-tier].active')?.dataset.dbTier||"All";
 const matches=GAME.talents.filter(t=>{const text=normalizeText([talentName(t),talentSourceName(t),t.effect_en,t.effect_cn,t.source_label,t.source_value].join(" "));return (!q||text.includes(q))&&(active==="All"||(t.tiers||[t.rank]).includes(active));}).sort((a,b)=>talentName(a).localeCompare(talentName(b)));
 $("talentDbResultCount").textContent=`${matches.length} talents`;
 list.innerHTML=matches.map(t=>{const tiers=(t.tiers||[t.rank].filter(Boolean)).filter(Boolean);const source=talentSourceName(t);return `<article class="talent-db-card"><button type="button" class="talent-db-open" data-talent-id="${esc(t.id)}"><span class="talent-db-title">${esc(talentName(t))}</span>${source&&source!==talentName(t)?`<small class="talent-source-name">${esc(source)}</small>`:""}<span class="talent-db-meta">${esc(t.source_label||t.source_cat||"")}</span></button><div class="talent-db-tier-list">${tiers.map(tier=>`<div class="talent-db-tier"><b>${tierDot(tier)} ${esc(tier)}</b><p>${esc(tierEffect(t,tier))}</p></div>`).join("")}</div><button type="button" class="talent-info-btn" data-talent-id="${esc(t.id)}" aria-label="Chi tiết ${esc(talentName(t))}">i</button></article>`}).join("")||'<p class="muted">Không tìm thấy Talent phù hợp.</p>';
}
function openTalentModal(id){const t=GAME.talents.find(x=>x.id===id);if(!t)return;$("talentModalTitle").textContent=talentName(t);const src=talentSourceName(t);$("talentModalMeta").innerHTML=`${src&&src!==talentName(t)?`<div class="talent-source-name">Tên gốc: ${esc(src)}</div>`:""}<span>${esc(t.source_label||t.source_cat||"")}</span>`;const tiers=(t.tiers||[t.rank].filter(Boolean)).filter(Boolean);$("talentModalBody").innerHTML=tiers.map(tier=>`<section class="talent-modal-tier"><h4>${tierDot(tier)} ${esc(tier)}</h4><p>${esc(tierEffect(t,tier))}</p></section>`).join("")+`<details><summary>Thông tin gốc</summary><p>${esc(t.effect_cn||"")}</p><small>${esc(t.id||"")}</small></details>`;$("talentModal").hidden=false}
function initTalentDatabase(){const dbBtn=$("databaseViewBtn"),trackerBtn=$("trackerViewBtn"),view=$("talentDatabaseView");if(!dbBtn||!trackerBtn||!view)return;function show(which){const database=which==="database";document.querySelectorAll(".tracker-view").forEach(x=>x.hidden=database);view.hidden=!database;dbBtn.classList.toggle("primary",database);trackerBtn.classList.toggle("primary",!database);if(database)renderTalentDatabase()};dbBtn.addEventListener("click",()=>show("database"));trackerBtn.addEventListener("click",()=>show("tracker"));$("talentDbSearch")?.addEventListener("input",renderTalentDatabase);document.querySelectorAll("[data-db-tier]").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll("[data-db-tier]").forEach(x=>x.classList.toggle("active",x===btn));renderTalentDatabase()}));$("talentDatabaseList")?.addEventListener("click",e=>{const b=e.target.closest("[data-talent-id]");if(b)openTalentModal(b.dataset.talentId)});$("talentModalClose")?.addEventListener("click",()=>$("talentModal").hidden=true);$("talentModal")?.addEventListener("click",e=>{if(e.target.id==="talentModal")$("talentModal").hidden=true});document.addEventListener("keydown",e=>{if(e.key==="Escape"&&$("talentModal"))$("talentModal").hidden=true})}
function injectTalentDatabaseStyle(){if($("talentDatabaseStyle"))return;const st=document.createElement("style");st.id="talentDatabaseStyle";st.textContent=`.talent-db-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,330px),1fr));gap:12px}.talent-db-card{position:relative;border:1px solid var(--border,#ddd);border-radius:14px;padding:14px;padding-right:42px;min-width:0}.talent-db-open{display:flex;flex-direction:column;gap:4px;text-align:left;background:transparent;border:0;padding:0;color:inherit;width:100%;cursor:pointer}.talent-db-title{font-size:17px;font-weight:750}.talent-source-name{display:block;color:var(--muted,#777);font-size:13px}.talent-db-meta{font-size:12px;opacity:.7}.talent-db-tier-list{display:grid;gap:10px;margin-top:12px}.talent-db-tier{border-top:1px solid var(--border,#ddd);padding-top:9px}.talent-db-tier b{display:block;margin-bottom:4px}.talent-db-tier p,.talent-modal-tier p{margin:0;white-space:normal;line-height:1.5}.talent-info-btn{position:absolute;right:10px;top:10px;border-radius:50%;width:27px;height:27px;padding:0;font-weight:800}.talent-modal[hidden]{display:none}.talent-modal{position:fixed;inset:0;z-index:1000;background:#0008;display:grid;place-items:center;padding:16px}.talent-modal-card{background:var(--card,#fff);color:inherit;border-radius:16px;max-width:650px;width:100%;max-height:85vh;overflow:auto;padding:18px}.talent-modal-head{display:flex;justify-content:space-between;gap:12px;align-items:start}.talent-modal-tier{padding:12px 0;border-bottom:1px solid var(--border,#ddd)}.talent-modal-tier h4{margin:0 0 6px}.talent-modal-body details{margin-top:12px}@media(max-width:600px){.talent-db-list{grid-template-columns:1fr}.talent-db-title{font-size:16px}}`;document.head.appendChild(st)}
function displayTalent(t){if(!t)return '<span class="muted">Empty</span>';let x=talentById(t);if(!x)return esc(t);return `<span class="${tierClass(talentTier(t))}">${esc(x.name_en||x.name_source)} · ${esc(talentTier(t))}</span>`}
function migrate(){
 db=loadLocal();
 const charMap=new Map(GAME.characters.map(c=>[(c.name_en||"").toLowerCase(),c.id]));
 const talMap=new Map(GAME.talents.flatMap(t=>[[String(t.name_en||"").toLowerCase(),t.id],[String(t.name_source||"").toLowerCase(),t.id]].filter(x=>x[0])));
 db.girls=(db.girls||[]).map((raw,i)=>{
   const g=normalizeGirl(raw,i);
   let cid=g.charId;
   const probe=String(g.charId||g.name||"").toLowerCase();
   if(!cid) cid=charMap.get(probe);
   const boards=g.boards.map(board=>board.map(t=>{const raw=String(t||"");const parsed=splitTalentValue(raw);const base=talMap.get(parsed.id.toLowerCase())||parsed.id;const tt=GAME.talents.find(x=>x.id===base);const tier=parsed.tier&&tt?.tiers?.includes(parsed.tier)?parsed.tier:(tt?.rank||"");return tier?`${base}|${tier}`:base;}));
   return {charId:cid||null,name:cid?charLabel(cid):(g.name||`Custom Girl ${i+1}`),customName:cid?false:true,boards,activeBoard:g.activeBoard};
 });
 db.log=db.log||[];
 saveSilently();
}
function saveSilently(){localStorage.setItem(KEY,JSON.stringify(db))}
function injectTalentTierStyle(){if(document.getElementById("talentTierStyle"))return;const st=document.createElement("style");st.id="talentTierStyle";st.textContent=".talent-editor{display:flex;gap:6px;align-items:center}.talent-editor .autocomplete{flex:1;min-width:0}.talent-tier-select{width:92px;min-height:34px;border:1px solid var(--border,#ddd);border-radius:8px;background:var(--input-bg,transparent);color:inherit}.talent-tier-select:disabled{opacity:.55}.tracker-girl-line{display:flex;align-items:center;gap:8px}.tracker-girl-line .autocomplete{flex:1;min-width:0}.tracker-girl-icon{width:38px;height:38px;object-fit:cover;border-radius:8px;flex:0 0 38px}.tracker-talent-info{flex:0 0 28px;width:28px;height:28px;padding:0;border-radius:50%;font-weight:800;line-height:1}.tracker-talent-info:disabled{opacity:.3}@media(max-width:700px){.talent-editor{flex-wrap:wrap}.talent-editor .autocomplete{flex:1 1 calc(100% - 38px)}.talent-tier-select{width:100%}}";document.head.appendChild(st)}
async function init(){
 try{
  const r=await fetch("game-data.json",{cache:"no-store"});if(!r.ok)throw Error();
  GAME=await r.json();$("dbStatus").textContent=`Loaded ${GAME.characters.length} characters / ${GAME.talents.length} bundled talents`;$("dbBadge").textContent=`DB ${GAME.schema_version}`;
 }catch(e){GAME={characters:[],talents:[]};$("dbStatus").textContent="Database file not loaded — add game-data.json";$("dbBadge").textContent="DB error"}
 db=loadLocal();migrate();injectTalentTierStyle();injectTrackerLayoutStyle();injectTalentDatabaseStyle();initTalentDatabase();render();
}
function render(){
 const q=normalizeText($("search").value),body=$("girlsBody");body.innerHTML="";
 (db.girls||[]).forEach((g,i)=>{
  const allTalentIds=g.boards.flat();
  const search=normalizeText(g.name+" "+allTalentIds.map(talentLabel).join(" "));if(q&&!search.includes(q))return;
  const b=Math.min(BOARD_COUNT-1,Math.max(0,g.activeBoard||0));g.activeBoard=b;
  const tr=document.createElement("tr");
  tr.innerHTML=`<td>${girlEditor(g,i)}</td>`+g.boards[b].map((t,s)=>`<td>${talentEditor(t,i,b,s)}</td>`).join("")+`<td class="tracker-delete-cell"><button class="danger" data-del="${i}">Xóa</button></td>`;
  tr.querySelector("[data-del]").onclick=()=>{if(confirm("Xóa Girl này khỏi tracker?")){db.girls.splice(i,1);save()}};
  body.appendChild(tr);
 });
 fillGirlSelects();fillBoardSelects();fillSlotSelects();renderLookup();renderHistory();
 $("girlCount").textContent=db.girls.length;$("talentCount").textContent=db.girls.length*BOARD_COUNT*SLOT_COUNT;$("logCount").textContent=db.log.length;
 $("charDbCount").textContent=GAME.characters.length;$("talentDbCount").textContent=GAME.talents.length;renderTalentDatabase();
}
function girlEditor(g,i){
 const value=g.charId?charLabel(g.charId):(g.name||"");
 const c=g.charId?charById(g.charId):null;
 const icon=c?.icon || (c?.source_id ? `https://gomg-wiki.pages.dev/assets/icons/Header/${c.source_id}.png` : "");
 const portrait=icon?`<img class="tracker-girl-icon" src="${esc(icon)}" alt="" loading="lazy" onerror="this.style.display='none'">`:"";
 const active=Math.min(BOARD_COUNT-1,Math.max(0,g.activeBoard||0));
 const boardTabs=Array.from({length:BOARD_COUNT},(_,b)=>{const count=(g.boards[b]||[]).filter(Boolean).length;return `<button type="button" class="board-tab ${b===active?"active":""} ${count===0?"board-empty":""}" data-board="${b}" data-g="${i}">Board ${b+1} <b>${count}/4</b></button>`}).join("");
 const total=g.boards.flat().filter(Boolean).length;
 return `<div class="girl-cell"><div class="tracker-girl-line">${portrait}<div class="autocomplete"><input class="girlinput" data-g="${i}" value="${esc(value)}" placeholder="Gõ tên Girl..." autocomplete="off"><div class="suggestions"></div></div><span class="tracker-total-count">${total}/16</span></div><div class="board-tabs">${boardTabs}</div></div>`;
}
function talentEditor(t,i,b,s){
 const value=t?talentLabel(t):"";const tt=t?talentById(t):null;const sel=t?talentTier(t):"";const talentId=t?splitTalentValue(t).id:"";
 return `<div class="tracker-talent-card"><div class="tracker-talent-name-row"><div class="autocomplete"><input class="talentinput" data-g="${i}" data-b="${b}" data-s="${s}" value="${esc(value)}" placeholder="＋ Chọn talent" autocomplete="off"><div class="suggestions"></div></div><button type="button" class="tracker-talent-info" data-talent-info="${esc(talentId)}" ${tt?"":"disabled"} title="Xem chi tiết Talent" aria-label="Xem chi tiết Talent">i</button></div><select class="talent-tier-select" data-g="${i}" data-b="${b}" data-s="${s}" ${tt?"":"disabled"}><option value="">Tier</option>${tierOptions(tt,sel)}</select></div>`;
}
function injectTrackerLayoutStyle(){if($("trackerLayoutStyle"))return;const st=document.createElement("style");st.id="trackerLayoutStyle";st.textContent=`
.tracker-view .table-wrap{overflow-x:auto}
.tracker-view #girlsBody{vertical-align:top}
.tracker-view .table-wrap table{width:100%;min-width:1050px;table-layout:fixed;border-collapse:separate;border-spacing:0}
.tracker-view .table-wrap th:nth-child(1),.tracker-view .table-wrap td:nth-child(1){width:25%}
.tracker-view .table-wrap th:nth-child(2),.tracker-view .table-wrap td:nth-child(2),.tracker-view .table-wrap th:nth-child(3),.tracker-view .table-wrap td:nth-child(3),.tracker-view .table-wrap th:nth-child(4),.tracker-view .table-wrap td:nth-child(4),.tracker-view .table-wrap th:nth-child(5),.tracker-view .table-wrap td:nth-child(5){width:17%}
.tracker-view .table-wrap th:last-child,.tracker-view .table-wrap td:last-child{width:7%}
.tracker-view .table-wrap td{padding:9px 7px;vertical-align:top}
.tracker-girl-line{display:flex;align-items:center;gap:8px;min-width:0}
.tracker-girl-line .autocomplete{flex:1;min-width:0}
.tracker-girl-icon{width:42px;height:42px;object-fit:cover;border-radius:9px;flex:0 0 42px;background:#f3e4dc}
.tracker-girl-line .girlinput{width:100%;min-width:0;box-sizing:border-box;height:44px}
.tracker-total-count{flex:0 0 auto;background:#35ad62;color:#fff;border-radius:8px;padding:5px 8px;font-weight:800;white-space:nowrap}
.board-tabs{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}
.board-tabs .board-tab{font-size:12px;padding:6px 8px;white-space:nowrap;display:inline-flex;align-items:center;gap:5px}
.board-tabs .board-tab b{color:#21824a;font-size:12px}
.board-tabs .board-tab.board-empty{opacity:.65}
.tracker-talent-card{border:1px solid var(--border,#e5d5cc);border-radius:11px;overflow:visible;min-width:0;background:var(--card,#fffaf6)}
.tracker-talent-name-row{display:flex;align-items:center;gap:7px;padding:7px 8px;min-width:0}
.tracker-talent-name-row .autocomplete{flex:1;min-width:0}
.tracker-talent-name-row .talentinput{display:block;width:100%;min-width:0;box-sizing:border-box;height:38px;border:0;background:transparent;padding:5px 3px;font-size:14px;text-overflow:clip}
.tracker-talent-info{flex:0 0 28px;width:28px;height:28px;padding:0;border-radius:50%;font-weight:800;line-height:1;border:1px solid #e8c5b5;background:#fff4ee;color:#4a2a20}
.tracker-talent-info:disabled{opacity:.25}
.tracker-talent-card .talent-tier-select{display:block;width:calc(100% - 14px);margin:0 7px 7px;min-height:36px;box-sizing:border-box;border:1px solid var(--border,#dfc9bd);border-radius:8px;background:var(--input-bg,#fff);color:inherit;padding:5px 8px}
.tracker-delete-cell{vertical-align:middle!important;text-align:center}
.tracker-delete-cell button{white-space:nowrap}
@media(max-width:700px){
 .tracker-view .table-wrap{overflow-x:visible}
 .tracker-view .table-wrap table{display:block;width:100%;min-width:0;table-layout:auto;border-collapse:separate;border-spacing:0}
 .tracker-view .table-wrap thead{display:none}
 .tracker-view .table-wrap tbody{display:block;width:100%}
 .tracker-view .table-wrap tbody tr{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:9px 10px;position:relative;width:100%;box-sizing:border-box;padding:12px;margin:0 0 12px;border:1px solid var(--border,#e5d5cc);border-radius:14px;background:var(--card,#fffaf6)}
 .tracker-view .table-wrap tbody td{display:block;width:auto!important;min-width:0;padding:0!important;vertical-align:top}
 .tracker-view .table-wrap tbody td:first-child{grid-column:1/-1;padding-right:62px!important}
 .tracker-view .table-wrap tbody td:nth-child(2)::before,.tracker-view .table-wrap tbody td:nth-child(3)::before,.tracker-view .table-wrap tbody td:nth-child(4)::before,.tracker-view .table-wrap tbody td:nth-child(5)::before{display:block;font-size:12px;font-weight:750;color:var(--muted,#7b6558);margin:0 0 5px 2px;content:"Talent"}
 .tracker-view .table-wrap tbody td:nth-child(2)::before{content:"Talent 1"}
 .tracker-view .table-wrap tbody td:nth-child(3)::before{content:"Talent 2"}
 .tracker-view .table-wrap tbody td:nth-child(4)::before{content:"Talent 3"}
 .tracker-view .table-wrap tbody td:nth-child(5)::before{content:"Talent 4"}
 .tracker-view .table-wrap tbody td:last-child{position:absolute;right:10px;top:12px;width:auto!important}
 .tracker-girl-line{gap:7px}
 .tracker-girl-icon{width:38px;height:38px;flex-basis:38px}
 .tracker-girl-line .girlinput{height:42px;font-size:13px}
 .tracker-total-count{font-size:12px;padding:4px 6px}
 .board-tabs .board-tab{padding:5px 7px;font-size:11px}
 .tracker-talent-card{width:100%;box-sizing:border-box}
 .tracker-talent-name-row{gap:5px;padding:6px}
 .tracker-talent-name-row .talentinput{font-size:13px;height:40px}
 .tracker-talent-info{flex-basis:27px;width:27px;height:27px}
 .tracker-view .table-wrap tbody td:last-child button{padding:7px 10px;font-size:12px}
}
`;document.head.appendChild(st)}

function normalizeText(v){return String(v||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()}
function fuzzyScore(query,text){
 const q=normalizeText(query),t=normalizeText(text);
 if(!q)return 0;
 if(t===q)return 1000;
 if(t.startsWith(q))return 800-q.length;
 const idx=t.indexOf(q);
 if(idx>=0)return 600-idx;
 const words=q.split(/\s+/).filter(Boolean);
 let pos=0,score=0;
 for(const w of words){const p=t.indexOf(w,pos);if(p<0)return -1;score+=100-p;pos=p+w.length}
 return 300+score;
}
function findGirlSuggestions(query){
 const q=normalizeText(query);
 if(!q)return GAME.characters.slice(0,10);
 return GAME.characters
   .map(c=>({item:c,score:Math.max(fuzzyScore(q,c.name_en),fuzzyScore(q,c.name_source||""))}))
   .filter(x=>x.score>=0)
   .sort((a,b)=>b.score-a.score)
   .slice(0,8)
   .map(x=>x.item);
}
function findTalentSuggestions(query){
 const q=normalizeText(query);
 if(!q)return GAME.talents.slice(0,10);
 return GAME.talents
   .map(t=>({item:t,score:Math.max(fuzzyScore(q,t.name_en),fuzzyScore(q,t.name_source||""))}))
   .filter(x=>x.score>=0)
   .sort((a,b)=>b.score-a.score)
   .slice(0,8)
   .map(x=>x.item);
}
function showSuggestions(input){
 const box=input.parentElement.querySelector(".suggestions");
 const isGirl=input.classList.contains("girlinput");
 const items=isGirl?findGirlSuggestions(input.value):findTalentSuggestions(input.value);
 if(!items.length){box.innerHTML="";box.classList.remove("open");return}
 box.innerHTML=items.map(x=>{
   const name=esc(talentName(x));
   const source=talentSourceName(x)&&talentName(x)!==talentSourceName(x)?`<small>${esc(talentSourceName(x))}</small>`:"";
   if(isGirl)return `<div class="suggestion" data-id="${esc(x.id)}"><span>${name}</span>${source}</div>`;
   const tiers=Array.isArray(x.tiers)&&x.tiers.length?x.tiers:(x.rank?[x.rank]:["Orange"]);
   return tiers.map(tier=>`<div class="suggestion talent-tier-option" data-id="${esc(x.id)}" data-tier="${esc(tier)}"><span>${name}</span>${source}<b class="tier tier-${esc(tier)}">${esc(tier)}</b></div>`).join("");
 }).join("");
 box.classList.add("open");
}
document.addEventListener("click",e=>{
 const tab=e.target.closest(".board-tab");
 if(!tab)return;
 const i=+tab.dataset.g,b=+tab.dataset.board;
 if(!db.girls[i])return;
 db.girls[i].activeBoard=b;save();
});
document.addEventListener("input",e=>{
 if(e.target.matches(".girlinput,.talentinput"))showSuggestions(e.target);
});
document.addEventListener("focusin",e=>{
 if(e.target.matches(".girlinput,.talentinput"))showSuggestions(e.target);
});
function chooseSuggestion(suggestion){
 const input=suggestion.closest(".autocomplete")?.querySelector("input");
 if(!input)return;
 const id=suggestion.dataset.id;
 if(input.classList.contains("girlinput")){
   const i=+input.dataset.g;
   const c=charById(id);
   if(!c||!db.girls[i])return;
   db.girls[i].charId=c.id;
   db.girls[i].name=charLabel(c.id);
   db.girls[i].customName=false;
 }else{
   const i=+input.dataset.g,s=+input.dataset.s,b=+input.dataset.b;
   if(!db.girls[i])return;
   const tierSel=input.closest(".tracker-talent-card")?.querySelector(".talent-tier-select");
   const t=talentById(id);
   const availableTiers=(Array.isArray(t?.tiers)&&t.tiers.length?t.tiers:[t?.rank].filter(Boolean));
   const tierOrder=["Orange","Purple","Blue","Green"];
   const orderedTiers=tierOrder.filter(x=>availableTiers.includes(x)).concat(availableTiers.filter(x=>!tierOrder.includes(x)));
   const chosen=tierSel?.value&&orderedTiers.includes(tierSel.value)?tierSel.value:(t?.rank&&orderedTiers.includes(t.rank)?t.rank:(orderedTiers[0]||""));
   db.girls[i].boards[b][s]=chosen?`${id}|${chosen}`:id;
   if(tierSel){
     // Rebuild the full tier list before enabling the native select. Some mobile
     // browsers otherwise show only the first option until the popup is reopened.
     tierSel.disabled=true;
     tierSel.replaceChildren(new Option("Tier",""));
     orderedTiers.forEach(tier=>tierSel.add(new Option(tier,tier,tier===chosen,tier===chosen)));
     tierSel.value=chosen;
     requestAnimationFrame(()=>{if(tierSel.isConnected)tierSel.disabled=!t;});
   }
 }
 // Persist without re-rendering the table. Re-rendering immediately here can
 // replace the input DOM while the browser is still processing the click/touch.
 localStorage.setItem(KEY,JSON.stringify(db));
 input.value=input.classList.contains("girlinput")?charLabel(id):talentLabel(db.girls[+input.dataset.g].boards[+input.dataset.b][+input.dataset.s]);
 const box=input.parentElement.querySelector(".suggestions");
 if(box){box.innerHTML="";box.classList.remove("open");}
}
document.addEventListener("pointerdown",e=>{
 const suggestion=e.target.closest(".suggestion");
 if(!suggestion)return;
 e.preventDefault();
 chooseSuggestion(suggestion);
},{passive:false});
document.addEventListener("click",e=>{
 const suggestion=e.target.closest(".suggestion");
 if(!suggestion)return;
 // Fallback for browsers that do not emit pointerdown for this control.
 if(suggestion.dataset.chosen==="1")return;
 chooseSuggestion(suggestion);
});
document.addEventListener("click",e=>{
 const info=e.target.closest("[data-talent-info]");
 if(info && info.dataset.talentInfo){openTalentModal(info.dataset.talentInfo);}
});

document.addEventListener("change",e=>{
 if(!e.target.matches(".talent-tier-select"))return;
 const i=+e.target.dataset.g,b=+e.target.dataset.b,s=+e.target.dataset.s;
 if(!db.girls[i])return;
 const current=db.girls[i].boards[b][s],base=splitTalentValue(current).id,t=talentById(base);
 if(!t)return;
 db.girls[i].boards[b][s]=e.target.value?`${base}|${e.target.value}`:base;
 save();
});
document.addEventListener("focusout",e=>{
 if(!e.target.matches(".girlinput,.talentinput"))return;
 setTimeout(()=>{
   const box=e.target.parentElement.querySelector(".suggestions");
   if(box)box.classList.remove("open");
 },150);
});
document.addEventListener("keydown",e=>{
 if(!e.target.matches(".girlinput,.talentinput")||e.key!=="Enter")return;
 const box=e.target.parentElement.querySelector(".suggestions.open");
 const first=box?.querySelector(".suggestion");
 if(first){e.preventDefault();chooseSuggestion(first)}
});
function fillGirlSelects(){
 const opts=db.girls.map((g,i)=>`<option value="${i}">${esc(g.name)}</option>`).join("");$("aGirl").innerHTML=opts;$(`bGirl`).innerHTML=opts;
}
function fillBoardSelects(){
 const x=Array.from({length:BOARD_COUNT},(_,i)=>`<option value="${i}">Board ${i+1}</option>`).join("");$("aBoard").innerHTML=x;$("bBoard").innerHTML=x;
}
function fillSlotSelects(){const x=Array.from({length:SLOT_COUNT},(_,i)=>`<option value="${i}">Talent ${i+1}</option>`).join("");$("aSlot").innerHTML=x;$("bSlot").innerHTML=x}
function addGirl(){const c=GAME.characters[0];db.girls.push({charId:c?.id||null,name:c?.name_en||"Custom Girl",customName:false,boards:emptyBoards(),activeBoard:0});save()}
function swapTalent(){
 if(db.girls.length<2)return alert("Cần ít nhất 2 Girl.");
 const ai=+$(`aGirl`).value,bi=+$(`bGirl`).value,ab=+$(`aBoard`).value,bb=+$(`bBoard`).value,as=+$(`aSlot`).value,bs=+$(`bSlot`).value;
 if(ai===bi&&ab===bb&&as===bs)return alert("Hãy chọn 2 slot khác nhau.");
 const A=db.girls[ai],B=db.girls[bi],at=A.boards[ab][as],bt=B.boards[bb][bs];
 if(!at||!bt)return alert("Cả 2 slot phải có talent.");
 const ta=talentById(at),tb=talentById(bt);
 if(ta&&tb&&talentTier(at)!==talentTier(bt))return alert(`Không thể SWAP khác tier: ${talentTier(at)} ↔ ${talentTier(bt)}`);
 [A.boards[ab][as],B.boards[bb][bs]]=[bt,at];
 db.log.push({time:new Date().toLocaleString("vi-VN"),text:`${A.name} [B${ab+1} T${as+1}] ${talentLabel(at)} ↔ ${B.name} [B${bb+1} T${bs+1}] ${talentLabel(bt)}`});
 save();
}
function renderLookup(){
 const q=normalizeText($("talentSearch").value),out=$("lookup");if(!q){out.innerHTML='<span class="muted">Nhập tên talent để tìm.</span>';return}
 const matches=GAME.talents.filter(t=>normalizeText(talentName(t)+" "+(t.name_source||t.name_cn||"")).includes(q)).slice(0,30);
 const rows=[];matches.forEach(t=>{db.girls.forEach(g=>g.boards.forEach((board,b)=>board.forEach((id,s)=>{if(splitTalentValue(id).id===t.id)rows.push(`<div class="lookup-item"><b>${esc(g.name)}</b><span class="pill">Board ${b+1}</span><span class="pill">Talent ${s+1}</span><span class="pill ${tierClass(talentTier(id))}">${esc(talentName(t))} · ${esc(talentTier(id))}</span></div>`)})))});
 out.innerHTML=rows.length?rows.join(""):(matches.length?'<span class="muted">Talent có trong database nhưng chưa được gán cho Girl nào.</span>':'<span class="muted">Không tìm thấy trong bundled database.</span>');
}
function renderHistory(){$("history").innerHTML=db.log.length?db.log.slice().reverse().map(x=>`<div class="history-row"><time>${esc(x.time)}</time>${esc(x.text)}</div>`).join(""):'<span class="muted">Chưa có SWAP.</span>'}
function exportData(){const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="gomg-talent-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.girls)throw 0;db=x;db.girls=(db.girls||[]).map((g,i)=>normalizeGirl(g,i));db.log=db.log||[];save()}catch{alert("JSON không hợp lệ.")}};r.readAsText(f)}
$("search").oninput=render;$("talentSearch").oninput=renderLookup;$("addGirlBtn").onclick=addGirl;$("swapBtn").onclick=swapTalent;$("exportBtn").onclick=exportData;
$("resetBtn").onclick=()=>{if(confirm("Reset toàn bộ tracker?")){db=clone(starter);save()}};
$("clearLogBtn").onclick=()=>{if(confirm("Xóa lịch sử SWAP?")){db.log=[];save()}};

// ---------------- GitHub encrypted sync ----------------
const SYNC_TOKEN_KEY="gomg-gh-token";
const SYNC_PASS_KEY="gomg-sync-pass";
const SYNC_PATH_KEY="gomg-sync-path";
function syncRepo(){
  const parts=location.pathname.split('/').filter(Boolean);
  const owner=location.hostname.endsWith('.github.io')?location.hostname.split('.')[0]:"ttw3";
  const repo=parts[0]||"gomg-talent-tracker";
  return {owner,repo};
}
function b64(bytes){let s="";bytes=new Uint8Array(bytes);for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(s)}
function unb64(s){const bin=atob(s.replace(/\n/g,""));const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function textBytes(s){return new TextEncoder().encode(s)}
async function deriveKey(pass,salt){const base=await crypto.subtle.importKey("raw",textBytes(pass),"PBKDF2",false,["deriveKey"]);return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:120000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"])}
async function encryptSync(data,pass){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const key=await deriveKey(pass,salt);const plain=textBytes(JSON.stringify(data));const cipher=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,plain);return JSON.stringify({version:1,createdAt:new Date().toISOString(),salt:b64(salt),iv:b64(iv),data:b64(cipher)})}
async function decryptSync(payload,pass){const x=typeof payload==='string'?JSON.parse(payload):payload;if(x.version!==1)throw Error("Sync file version không hỗ trợ");const key=await deriveKey(pass,unb64(x.salt));const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(x.iv)},key,unb64(x.data));return JSON.parse(new TextDecoder().decode(plain))}
function syncToken(){return localStorage.getItem(SYNC_TOKEN_KEY)||$("ghToken")?.value.trim()||""}
function syncPass(){return localStorage.getItem(SYNC_PASS_KEY)||$("syncPass")?.value||""}
function syncPath(){return localStorage.getItem(SYNC_PATH_KEY)||$("syncPath")?.value.trim()||"sync-data/gomg-tracker.enc.json"}
function setSyncStatus(msg,ok=false){const el=$("syncStatus");if(el){el.textContent=msg;el.classList.toggle("ok",ok)}}
function apiUrl(path){const r=syncRepo();return `https://api.github.com/repos/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}`}
async function ghRequest(path,opts={}){const token=syncToken();if(!token)throw Error("Chưa nhập GitHub Token.");const headers={Accept:"application/vnd.github+json",Authorization:`Bearer ${token}`,"X-GitHub-Api-Version":"2022-11-28",...(opts.body?{"Content-Type":"application/json"}:{})};const r=await fetch(apiUrl(path),{...opts,headers});let data={};try{data=await r.json()}catch{}if(!r.ok)throw Error(data.message||`GitHub API ${r.status}`);return data}
async function pullSync(silent=false){try{const pass=syncPass();if(!pass)throw Error("Chưa nhập mật khẩu mã hóa.");const data=await ghRequest(syncPath(),{method:"GET",cache:"no-store"});let encryptedText=new TextDecoder().decode(unb64(data.content));if(!encryptedText.trim().startsWith("{")){try{encryptedText=new TextDecoder().decode(unb64(encryptedText));}catch{}}const remote=await decryptSync(encryptedText,pass);if(!remote.girls)throw Error("Dữ liệu sync không hợp lệ.");db=remote;db.girls=(db.girls||[]).map((g,i)=>normalizeGirl(g,i));db.log=db.log||[];saveSilently();render();setSyncStatus(`✓ Đã lấy dữ liệu từ GitHub lúc ${new Date().toLocaleTimeString('vi-VN')}`,true);return true}catch(e){if(!silent)setSyncStatus(`✕ ${e.message}`);return false}}
async function pushSync(){try{const token=$("ghToken").value.trim(),pass=$("syncPass").value,path=$("syncPath").value.trim()||"sync-data/gomg-tracker.enc.json";if(!token)throw Error("Chưa nhập GitHub Token.");if(!pass)throw Error("Chưa nhập mật khẩu mã hóa.");localStorage.setItem(SYNC_TOKEN_KEY,token);localStorage.setItem(SYNC_PASS_KEY,pass);localStorage.setItem(SYNC_PATH_KEY,path);setSyncStatus("Đang đẩy dữ liệu lên GitHub…");let sha=null;try{const existing=await ghRequest(path,{method:"GET",cache:"no-store"});sha=existing.sha}catch(e){if(!/Not Found/i.test(e.message))throw e}const encrypted=await encryptSync(db,pass);const body={message:`Sync GOMG tracker ${new Date().toISOString()}`,content:b64(textBytes(encrypted)),...(sha?{sha}:{})};await ghRequest(path,{method:"PUT",body:JSON.stringify(body)});setSyncStatus(`✓ Đã đẩy dữ liệu lên ${syncRepo().owner}/${syncRepo().repo} lúc ${new Date().toLocaleTimeString('vi-VN')}`,true)}catch(e){setSyncStatus(`✕ ${e.message}`)}}
function initSyncUI(){
 const token=localStorage.getItem(SYNC_TOKEN_KEY)||"",pass=localStorage.getItem(SYNC_PASS_KEY)||"",path=localStorage.getItem(SYNC_PATH_KEY)||"sync-data/gomg-tracker.enc.json";
 if($("ghToken"))$("ghToken").value=token;if($("syncPass"))$("syncPass").value=pass;if($("syncPath"))$("syncPath").value=path;
 $("syncBtn")?.addEventListener("click",()=>{$("syncPanel").hidden=!$("syncPanel").hidden});
 $("closeSyncBtn")?.addEventListener("click",()=>$("syncPanel").hidden=true);
 $("pushSyncBtn")?.addEventListener("click",pushSync);
 $("pullSyncBtn")?.addEventListener("click",()=>pullSync(false));
}

initSyncUI();
init();


// Tier selector styling for Talent Tracker suggestions only.
(function(){const st=document.createElement("style");st.textContent=`.talent-tier-option{gap:8px}.talent-tier-option .tier{margin-left:auto;font-size:11px;font-weight:700}.talent-tier-option small{margin-left:4px;opacity:.65}`;document.head.appendChild(st)})();
