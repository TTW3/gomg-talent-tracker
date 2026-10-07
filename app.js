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
 if(g.charId){return `<select class="girlselect" data-g="${i}">${GAME.characters.map(c=>`<option value="${c.id}" ${c.id===g.charId?"selected":""}>${esc(c.name_en)}</option>`).join("")}</select>`}
 return `<input class="customgirl" data-g="${i}" value="${esc(g.name)}" placeholder="Custom Girl">`;
}
function talentEditor(t,i,s){
 const opts=GAME.talents.map(x=>`<option value="${x.id}" ${x.id===t?"selected":""}>${esc(x.name_en||x.name_source)}${x.name_source&&x.name_en!==x.name_source?" · "+esc(x.name_source):""}</option>`).join("");
 return `<select class="slotselect" data-g="${i}" data-s="${s}"><option value="">— Empty —</option>${opts}</select>`;
}
function fillGirlSelects(){
 const opts=db.girls.map((g,i)=>`<option value="${i}">${esc(g.name)}</option>`).join("");$("aGirl").innerHTML=opts;$("bGirl").innerHTML=opts;
}
function fillSlotSelects(){const x=['Talent 1','Talent 2','Talent 3','Talent 4'];$("aSlot").innerHTML=x.map((v,i)=>`<option value="${i}">${v}</option>`).join("");$("bSlot").innerHTML=x.map((v,i)=>`<option value="${i}">${v}</option>`).join("")}
document.addEventListener("change",e=>{
 if(e.target.matches(".girlselect")){const i=+e.target.dataset.g;db.girls[i].charId=e.target.value;db.girls[i].name=charLabel(e.target.value);db.girls[i].customName=false;save()}
 if(e.target.matches(".customgirl")){const i=+e.target.dataset.g;db.girls[i].name=e.target.value.trim()||"Custom Girl";save()}
 if(e.target.matches(".slotselect")){const i=+e.target.dataset.g,s=+e.target.dataset.s;db.girls[i].talents[s]=e.target.value;save()}
});
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
