const KEY="gomg-talent-tracker-v3";let GAME=null,db=null;
const starter={girls:[],log:[]};
const $=id=>document.getElementById(id);
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function clone(x){return JSON.parse(JSON.stringify(x))}
function loadLocal(){try{return JSON.parse(localStorage.getItem(KEY))||clone(starter)}catch{return clone(starter)}}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function talentById(id){return GAME.talents.find(x=>x.id===id)}
function charById(id){return GAME.characters.find(x=>x.id===id)}
function talentLabel(id){let t=talentById(id);return t?t.name_en||t.name_source||id:(id||"")}
function charLabel(id){let c=charById(id);return c?c.name_en:id||""}
function tierClass(t){return t?`tier tier-${t}`:""}
function displayTalent(t){if(!t)return '<span class="muted">Empty</span>';let x=talentById(t);if(!x)return esc(t);return `<span class="${tierClass(x.rank)}">${esc(x.name_en||x.name_source)}</span>`}
function migrate(){
 db=loadLocal();
 // Convert old string-based records to database IDs where possible.
 const charMap=new Map(GAME.characters.map(c=>[c.name_en.toLowerCase(),c.id]));
 const talMap=new Map(GAME.talents.flatMap(t=>[[t.name_en.toLowerCase(),t.id],[(t.name_source||"").toLowerCase(),t.id]].filter(x=>x[0])));
 db.girls=(db.girls||[]).map((g,i)=>{
   let cid=charMap.get(String(g.charId||g.name||"").toLowerCase());
   const name=g.name||"";
   if(!cid && name && !/^Character \\d+$/i.test(name)) cid=charMap.get(name.toLowerCase());
   return {charId:cid||null,name:cid?charLabel(cid):(name||`Custom Girl ${i+1}`),customName:cid?false:true,talents:(g.talents||["","","",""]).map(t=>talMap.get(String(t).toLowerCase())||t)};
 });
 db.log=db.log||[];
 saveSilently();
}
function saveSilently(){localStorage.setItem(KEY,JSON.stringify(db))}
async function init(){
 try{
  const r=await fetch("game-data.json",{cache:"no-store"});if(!r.ok)throw Error();
  GAME=await r.json();$("dbStatus").textContent=`Loaded ${GAME.characters.length} characters / ${GAME.talents.length} bundled talents`;$("dbBadge").textContent=`DB ${GAME.schema_version}`;
 }catch(e){GAME={characters:[],talents:[]};$("dbStatus").textContent="Database file not loaded — add game-data.json";$("dbBadge").textContent="DB error"}
 db=loadLocal();migrate();render();
}
function render(){
 const q=$("search").value.trim().toLowerCase(),body=$("girlsBody");body.innerHTML="";
 (db.girls||[]).forEach((g,i)=>{
  const search=(g.name+" "+g.talents.map(talentLabel).join(" ")).toLowerCase();if(q&&!search.includes(q))return;
  const tr=document.createElement("tr");
  tr.innerHTML=`<td>${girlEditor(g,i)}</td>`+g.talents.map((t,s)=>`<td>${talentEditor(t,i,s)}</td>`).join("")+`<td><button class="danger" data-del="${i}">Xóa</button></td>`;
  tr.querySelector("[data-del]").onclick=()=>{if(confirm("Xóa Girl này khỏi tracker?")){db.girls.splice(i,1);save()}};
  body.appendChild(tr);
 });
 fillGirlSelects();fillSlotSelects();renderLookup();renderHistory();
 $("girlCount").textContent=db.girls.length;$("talentCount").textContent=db.girls.length*4;$("logCount").textContent=db.log.length;
 $("charDbCount").textContent=GAME.characters.length;$("talentDbCount").textContent=GAME.talents.length;
}
function girlEditor(g,i){
 const value=g.charId?charLabel(g.charId):(g.name||"");
 return `<div class="autocomplete">
   <input class="girlinput" data-g="${i}" value="${esc(value)}" placeholder="Gõ tên Girl..." autocomplete="off">
   <div class="suggestions"></div>
 </div>`;
}
function talentEditor(t,i,s){
 const value=t?talentLabel(t):"";
 return `<div class="autocomplete">
   <input class="talentinput" data-g="${i}" data-s="${s}" value="${esc(value)}" placeholder="Gõ tên Talent..." autocomplete="off">
   <div class="suggestions"></div>
 </div>`;
}
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
   const id=esc(x.id),name=esc(x.name_en||x.name_source||"");
   const source=x.name_source&&x.name_en!==x.name_source?`<small>${esc(x.name_source)}</small>`:"";
   return `<div class="suggestion" data-id="${id}"><span>${name}</span>${source}</div>`;
 }).join("");
 box.classList.add("open");
}
document.addEventListener("input",e=>{
 if(e.target.matches(".girlinput,.talentinput"))showSuggestions(e.target);
});
document.addEventListener("focusin",e=>{
 if(e.target.matches(".girlinput,.talentinput"))showSuggestions(e.target);
});
document.addEventListener("mousedown",e=>{
 const suggestion=e.target.closest(".suggestion");
 if(!suggestion)return;
 const input=suggestion.closest(".autocomplete").querySelector("input");
 const id=suggestion.dataset.id;
 if(input.classList.contains("girlinput")){
   const i=+input.dataset.g;
   const c=charById(id);
   if(!c)return;
   db.girls[i].charId=c.id;
   db.girls[i].name=charLabel(c.id);
   db.girls[i].customName=false;
 }else{
   const i=+input.dataset.g,s=+input.dataset.s;
   db.girls[i].talents[s]=id;
 }
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
 if(first){e.preventDefault();first.dispatchEvent(new MouseEvent("mousedown",{bubbles:true}))}
});
function fillGirlSelects(){
 const opts=db.girls.map((g,i)=>`<option value="${i}">${esc(g.name)}</option>`).join("");$("aGirl").innerHTML=opts;$("bGirl").innerHTML=opts;
}
function fillSlotSelects(){const x=['Talent 1','Talent 2','Talent 3','Talent 4'];$("aSlot").innerHTML=x.map((v,i)=>`<option value="${i}">${v}</option>`).join("");$("bSlot").innerHTML=x.map((v,i)=>`<option value="${i}">${v}</option>`).join("")}

function addGirl(){db.girls.push({charId:GAME.characters[0]?.id||null,name:GAME.characters[0]?.name_en||"Custom Girl",customName:false,talents:["","","",""]});save()}
function swapTalent(){
 if(db.girls.length<2)return alert("Cần ít nhất 2 Girl.");
 const ai=+$("aGirl").value,bi=+$("bGirl").value,as=+$("aSlot").value,bs=+$("bSlot").value;
 if(ai===bi&&as===bs)return alert("Hãy chọn 2 slot khác nhau.");
 const A=db.girls[ai],B=db.girls[bi],at=A.talents[as],bt=B.talents[bs];
 if(!at||!bt)return alert("Cả 2 slot phải có talent.");
 const ta=talentById(at),tb=talentById(bt);
 if(ta&&tb&&ta.rank!==tb.rank)return alert(`Không thể SWAP khác tier: ${ta.rank} ↔ ${tb.rank}`);
 [A.talents[as],B.talents[bs]]=[bt,at];
 db.log.push({time:new Date().toLocaleString("vi-VN"),text:`${A.name} [T${as+1}] ${talentLabel(at)} ↔ ${B.name} [T${bs+1}] ${talentLabel(bt)}`});
 save();
}
function renderLookup(){
 const q=$("talentSearch").value.trim().toLowerCase(),out=$("lookup");if(!q){out.innerHTML='<span class="muted">Nhập tên talent để tìm.</span>';return}
 const matches=GAME.talents.filter(t=>(t.name_en+" "+(t.name_source||"")).toLowerCase().includes(q)).slice(0,30);
 const rows=[];matches.forEach(t=>{db.girls.forEach(g=>g.talents.forEach((id,s)=>{if(id===t.id)rows.push(`<div class="lookup-item"><b>${esc(g.name)}</b><span class="pill">Talent ${s+1}</span><span class="pill ${tierClass(t.rank)}">${esc(t.name_en||t.name_source)}</span></div>`)}))});
 out.innerHTML=rows.length?rows.join(""):(matches.length?'<span class="muted">Talent có trong database nhưng chưa được gán cho Girl nào.</span>':'<span class="muted">Không tìm thấy trong bundled database.</span>');
}
function renderHistory(){$("history").innerHTML=db.log.length?db.log.slice().reverse().map(x=>`<div class="history-row"><time>${esc(x.time)}</time>${esc(x.text)}</div>`).join(""):'<span class="muted">Chưa có SWAP.</span>'}
function exportData(){const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="gomg-talent-backup.json";a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
$("importFile").onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.girls)throw 0;db=x;save()}catch{alert("JSON không hợp lệ.")}};r.readAsText(f)}
$("search").oninput=render;$("talentSearch").oninput=renderLookup;$("addGirlBtn").onclick=addGirl;$("swapBtn").onclick=swapTalent;$("exportBtn").onclick=exportData;
$("resetBtn").onclick=()=>{if(confirm("Reset toàn bộ tracker?")){db=clone(starter);save()}};
$("clearLogBtn").onclick=()=>{if(confirm("Xóa lịch sử SWAP?")){db.log=[];save()}};
init();
