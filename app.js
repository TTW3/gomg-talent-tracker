const KEY="gomg-talent-tracker-v2";
const starter={girls:[
{name:"Character 01",talents:["Astral Double","Astral Double","Nine Lives","Astral Double"]},
{name:"Character 02",talents:["Double Fortune","Double Fortune","High Momentum","High Morale"]}
],log:[]};
let db=load(), gameData={characters:[],talents:[]}, selectedA=null, selectedB=null;

async function loadGameData(){
 try{
  const r=await fetch("game-data.json?cache="+Date.now());
  if(r.ok) gameData=await r.json();
 }catch(e){}
 render();
}
function load(){try{return JSON.parse(localStorage.getItem(KEY))||structuredClone(starter)}catch{return structuredClone(starter)}}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function render(){
 const q=search.value.trim().toLowerCase(),body=girlsBody;body.innerHTML="";
 db.girls.forEach((g,i)=>{
  if(q && !(g.name+" "+g.talents.join(" ")).toLowerCase().includes(q))return;
  const tr=document.createElement("tr");
  tr.innerHTML=`<td><input value="${esc(g.name)}"></td>`+g.talents.map((t,s)=>`<td><input class="slot-input" value="${esc(t)}"></td>`).join("")+`<td><button class="danger" data-del="${i}">Xóa</button></td>`;
  tr.querySelector("td input").addEventListener("change",e=>{g.name=e.target.value.trim()||"Unnamed Girl";save()});
  [...tr.querySelectorAll(".slot-input")].forEach((el,s)=>el.addEventListener("change",e=>{g.talents[s]=e.target.value.trim();save()}));
  tr.querySelector("[data-del]").onclick=()=>{if(confirm("Xóa Girl này?")){db.girls.splice(i,1);save()}};
  body.appendChild(tr);
 });
 girlCount.textContent=db.girls.length;talentCount.textContent=db.girls.length*4;logCount.textContent=db.log.length;
 renderLookup();renderHistory();updateSelectedPills();
}
function addGirl(){db.girls.push({name:`Character ${String(db.girls.length+1).padStart(2,"0")}`,talents:["","","",""]});save()}
function namesForSearch(){
 const names=[...db.girls.map((g,i)=>({name:g.name,index:i,source:"Your tracker"}))];
 const chars=(gameData.characters||[]).map(c=>({name:c.name_en||c.name||"",index:-1,source:"Game database"})).filter(x=>x.name);
 const seen=new Set(),out=[];
 for(const x of [...names,...chars]){const k=x.name.toLowerCase();if(!seen.has(k)){seen.add(k);out.push(x)}}
 return out;
}
function setupSearch(input,box,setter,pill){
 function show(){
  const q=input.value.trim().toLowerCase(),all=namesForSearch();
  const matches=all.filter(x=>!q||x.name.toLowerCase().includes(q)).slice(0,12);
  box.innerHTML=matches.length?matches.map((x,n)=>`<div class="suggestion" data-n="${n}"><b>${esc(x.name)}</b><small>${esc(x.source)}</small></div>`).join(""):'<div class="suggestion">Không tìm thấy Girl</div>';
  box.classList.add("show");
  [...box.querySelectorAll(".suggestion[data-n]")].forEach(el=>el.onclick=()=>{const x=matches[+el.dataset.n];setter(x);input.value=x.name;box.classList.remove("show");updateSelectedPills()});
 }
 input.addEventListener("focus",show);input.addEventListener("input",show);
 document.addEventListener("click",e=>{if(!input.parentElement.contains(e.target))box.classList.remove("show")});
}
setupSearch(aSearch,aResults,x=>selectedA=x.name,p=>p);
setupSearch(bSearch,bResults,x=>selectedB=x.name,p=>p);
function updateSelectedPills(){aSelected.textContent="Girl A: "+(selectedA||"Chưa chọn");bSelected.textContent="Girl B: "+(selectedB||"Chưa chọn")}
function findGirl(name){return db.girls.findIndex(g=>g.name.toLowerCase()===name.toLowerCase())}
function swapTalent(){
 if(!selectedA||!selectedB)return alert("Hãy chọn cả Girl A và Girl B.");
 const ai=findGirl(selectedA),bi=findGirl(selectedB),as=+aSlot.value,bs=+bSlot.value;
 if(ai<0||bi<0)return alert("Girl được chọn chưa có trong database tracker. Hãy thêm Girl đó trước.");
 if(ai===bi&&as===bs)return alert("Hãy chọn 2 slot khác nhau.");
 const A=db.girls[ai],B=db.girls[bi],at=A.talents[as],bt=B.talents[bs];
 [A.talents[as],B.talents[bs]]=[bt,at];
 db.log.push({time:new Date().toLocaleString("vi-VN"),text:`${A.name} [Talent ${as+1}] "${at||"(trống)"} ↔ ${B.name} [Talent ${bs+1}] "${bt||"(trống)"}"`});
 save();
}
function renderLookup(){
 const q=talentSearch.value.trim().toLowerCase(),out=lookupResult;
 if(!q){out.innerHTML='<span class="muted">Nhập tên talent để tìm vị trí.</span>';return}
 let found=[];db.girls.forEach(g=>g.talents.forEach((t,s)=>{if(t.toLowerCase().includes(q))found.push(`<div class="lookup-item"><b>${esc(g.name)}</b><span class="pill">Talent ${s+1}</span><span class="pill">${esc(t)}</span></div>`)}));
 out.innerHTML=found.length?found.join(""):'<span class="muted">Không tìm thấy talent trong tracker.</span>';
}
function renderHistory(){history.innerHTML=db.log.length?db.log.slice().reverse().map(x=>`<div class="history-row"><time>${esc(x.time)}</time>${esc(x.text)}</div>`).join(""):'<span class="muted">Chưa có lần SWAP nào.</span>'}
function exportData(){const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="gomg-talent-backup.json";a.click();URL.revokeObjectURL(a.href)}
importFile.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.girls)throw 0;db=x;save()}catch{alert("JSON không hợp lệ.")}};r.readAsText(f)}
resetBtn.onclick=()=>{if(confirm("Xóa toàn bộ dữ liệu hiện tại và quay về dữ liệu mẫu?")){db=structuredClone(starter);selectedA=selectedB=null;aSearch.value=bSearch.value="";save()}}
clearLogBtn.onclick=()=>{if(confirm("Xóa lịch sử SWAP?")){db.log=[];save()}}
search.oninput=render;talentSearch.oninput=renderLookup;addGirlBtn.onclick=addGirl;swapBtn.onclick=swapTalent;exportBtn.onclick=exportData;
render();loadGameData();
