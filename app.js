const KEY="gomg-talent-tracker-v2";
const starter={
 girls:[
  {name:"Character 01",talents:["Astral Double","Astral Double","Nine Lives","Astral Double"]},
  {name:"Character 02",talents:["Double Fortune","Double Fortune","High Momentum","High Morale"]}
 ],
 log:[]
};
let db=load();
function load(){try{return JSON.parse(localStorage.getItem(KEY))||structuredClone(starter)}catch{return structuredClone(starter)}}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function render(){
 const q=document.querySelector("#search").value.trim().toLowerCase();
 const body=document.querySelector("#girlsBody"); body.innerHTML="";
 db.girls.forEach((g,i)=>{
   if(q && !(g.name+" "+g.talents.join(" ")).toLowerCase().includes(q)) return;
   const tr=document.createElement("tr");
   tr.innerHTML=`<td><input value="${esc(g.name)}" aria-label="Girl name"></td>`+
     g.talents.map((t,s)=>`<td><input class="slot-input" value="${esc(t)}" aria-label="Talent ${s+1}"></td>`).join("")+
     `<td><button class="danger" data-del="${i}">Xóa</button></td>`;
   tr.querySelector("td input").addEventListener("change",e=>{g.name=e.target.value.trim()||"Unnamed Girl";save()});
   [...tr.querySelectorAll(".slot-input")].forEach((el,s)=>el.addEventListener("change",e=>{g.talents[s]=e.target.value.trim();save()}));
   tr.querySelector("[data-del]").onclick=()=>{if(confirm("Xóa Girl này?")){db.girls.splice(i,1);save()}};
   body.appendChild(tr);
 });
 const opts=db.girls.map((g,i)=>`<option value="${i}">${esc(g.name)}</option>`).join("");
 aGirl.innerHTML=opts;bGirl.innerHTML=opts;
 girlCount.textContent=db.girls.length;
 talentCount.textContent=db.girls.length*4;
 logCount.textContent=db.log.length;
 renderLookup();renderHistory();
}
function addGirl(){db.girls.push({name:`Character ${String(db.girls.length+1).padStart(2,"0")}`,talents:["","","",""]});save()}
function swapTalent(){
 if(db.girls.length<2)return alert("Cần ít nhất 2 Girl.");
 const ai=+aGirl.value,bi=+bGirl.value,as=+aSlot.value,bs=+bSlot.value;
 if(ai===bi&&as===bs)return alert("Hãy chọn 2 slot khác nhau.");
 const A=db.girls[ai],B=db.girls[bi],at=A.talents[as],bt=B.talents[bs];
 [A.talents[as],B.talents[bs]]=[bt,at];
 db.log.push({time:new Date().toLocaleString("vi-VN"),text:`${A.name} [Talent ${as+1}] "${at||"(trống)"} ↔ ${B.name} [Talent ${bs+1}] "${bt||"(trống)"}"`});
 save();
}
function renderLookup(){
 const q=document.querySelector("#talentSearch").value.trim().toLowerCase(),out=document.querySelector("#lookupResult");
 if(!q){out.innerHTML='<span class="muted">Nhập tên talent để tìm vị trí.</span>';return}
 let found=[];
 db.girls.forEach(g=>g.talents.forEach((t,s)=>{if(t.toLowerCase().includes(q))found.push(`<div class="lookup-item"><b>${esc(g.name)}</b><span class="pill">Talent ${s+1}</span><span class="pill">${esc(t)}</span></div>`)}));
 out.innerHTML=found.length?found.join(""):'<span class="muted">Không tìm thấy talent.</span>';
}
function renderHistory(){
 history.innerHTML=db.log.length?db.log.slice().reverse().map(x=>`<div class="history-row"><time>${esc(x.time)}</time>${esc(x.text)}</div>`).join(""):'<span class="muted">Chưa có lần SWAP nào.</span>';
}
function exportData(){
 const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
 const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="gomg-talent-backup.json";a.click();URL.revokeObjectURL(a.href)
}
importFile.onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const x=JSON.parse(r.result);if(!x.girls)throw 0;db=x;save()}catch{alert("JSON không hợp lệ.")}};r.readAsText(f)}
resetBtn.onclick=()=>{if(confirm("Xóa toàn bộ dữ liệu hiện tại và quay về dữ liệu mẫu?")){db=structuredClone(starter);save()}}
clearLogBtn.onclick=()=>{if(confirm("Xóa lịch sử SWAP?")){db.log=[];save()}}
search.oninput=render;talentSearch.oninput=renderLookup;addGirlBtn.onclick=addGirl;swapBtn.onclick=swapTalent;exportBtn.onclick=exportData;
render();
