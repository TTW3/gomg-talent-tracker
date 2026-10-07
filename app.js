const KEY="gomg-talent-tracker-v2";
const starter={
 girls:[
  {name:"Character 01",talents:["Astral Double","Astral Double","Nine Lives","Astral Double"]},
  {name:"Character 02",talents:["Double Fortune","Double Fortune","High Momentum","High Morale"]}
 ],
 log:[]
};
let db=load();
let gameData={characters:[],talents:[]};
let selectedA=null, selectedB=null;

function load(){
  try{return JSON.parse(localStorage.getItem(KEY))||structuredClone(starter)}
  catch{return structuredClone(starter)}
}
function save(){localStorage.setItem(KEY,JSON.stringify(db));render()}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}

async function loadGameData(){
  try{
    const response=await fetch("game-data.json");
    if(response.ok) gameData=await response.json();
  }catch(e){
    console.warn("Game database could not be loaded.",e);
  }
  render();
}

function render(){
  const q=document.querySelector("#search").value.trim().toLowerCase();
  const body=document.querySelector("#girlsBody");
  body.innerHTML="";
  db.girls.forEach((g,i)=>{
    if(q && !(g.name+" "+g.talents.join(" ")).toLowerCase().includes(q)) return;
    const tr=document.createElement("tr");
    tr.innerHTML=
      `<td><input value="${esc(g.name)}" aria-label="Girl name"></td>`+
      g.talents.map((t,s)=>`<td><input class="slot-input" value="${esc(t)}" aria-label="Talent ${s+1}"></td>`).join("")+
      `<td><button class="danger" data-del="${i}">Xóa</button></td>`;
    tr.querySelector("td input").addEventListener("change",e=>{
      g.name=e.target.value.trim()||"Unnamed Girl"; save();
    });
    [...tr.querySelectorAll(".slot-input")].forEach((el,s)=>el.addEventListener("change",e=>{
      g.talents[s]=e.target.value.trim(); save();
    }));
    tr.querySelector("[data-del]").onclick=()=>{
      if(confirm("Xóa Girl này?")){db.girls.splice(i,1);save();}
    };
    body.appendChild(tr);
  });

  document.querySelector("#girlCount").textContent=db.girls.length;
  document.querySelector("#talentCount").textContent=db.girls.length*4;
  document.querySelector("#logCount").textContent=db.log.length;
  renderLookup();
  renderHistory();
  updateSelectedPills();
}

function addGirl(){
  db.girls.push({
    name:`Character ${String(db.girls.length+1).padStart(2,"0")}`,
    talents:["","","",""]
  });
  save();
}

function trackerGirlMatches(query){
  const q=query.trim().toLowerCase();
  return db.girls
    .map((g,i)=>({name:g.name,index:i,source:"Tracker"}))
    .filter(x=>!q || x.name.toLowerCase().includes(q));
}

function gameCharacterMatches(query){
  const q=query.trim().toLowerCase();
  return (gameData.characters||[])
    .map((c,i)=>({
      name:c.name_en||c.name||c.name_cn||"",
      index:-1,
      source:"Game database"
    }))
    .filter(x=>x.name && (!q || x.name.toLowerCase().includes(q)));
}

/*
  IMPORTANT:
  Search suggestions show the user's actual tracker Girls first.
  Game database names are only shown as optional reference suggestions.
  Selecting a game-database-only name does NOT make it a valid SWAP target.
*/
function showSuggestions(input,box,side){
  const q=input.value.trim();
  const own=trackerGirlMatches(q);
  const game=gameCharacterMatches(q);

  const seen=new Set();
  const merged=[];
  for(const item of [...own,...game]){
    const key=item.name.toLowerCase();
    if(seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
    if(merged.length>=12) break;
  }

  if(!merged.length){
    box.innerHTML='<div class="suggestion">Không tìm thấy Girl phù hợp.</div>';
  }else{
    box.innerHTML=merged.map((x,i)=>
      `<div class="suggestion" data-index="${i}"><b>${esc(x.name)}</b><small>${esc(x.source)}</small></div>`
    ).join("");
  }
  box.classList.add("show");

  [...box.querySelectorAll("[data-index]")].forEach(el=>{
    el.onclick=()=>{
      const item=merged[+el.dataset.index];
      input.value=item.name;
      if(item.index>=0){
        if(side==="A") selectedA=item.name;
        else selectedB=item.name;
      }else{
        // Reference-only game name: do not silently select it as a tracker Girl.
        if(side==="A") selectedA=null;
        else selectedB=null;
        alert(`"${item.name}" có trong Game Database nhưng chưa có trong Talent Tracker của bạn.\n\nHãy thêm Girl này vào bảng Talent Database trước khi SWAP.`);
      }
      updateSelectedPills();
      box.classList.remove("show");
    };
  });
}

function setupGirlSearch(input,box,side){
  input.addEventListener("focus",()=>showSuggestions(input,box,side));
  input.addEventListener("input",()=>{
    if(side==="A" && selectedA && input.value.trim().toLowerCase()!==selectedA.toLowerCase()) selectedA=null;
    if(side==="B" && selectedB && input.value.trim().toLowerCase()!==selectedB.toLowerCase()) selectedB=null;
    updateSelectedPills();
    showSuggestions(input,box,side);
  });
  document.addEventListener("click",e=>{
    if(!input.parentElement.contains(e.target)) box.classList.remove("show");
  });
}

function updateSelectedPills(){
  document.querySelector("#aSelected").textContent="Girl A: "+(selectedA||"Chưa chọn");
  document.querySelector("#bSelected").textContent="Girl B: "+(selectedB||"Chưa chọn");
}

function findGirl(name){
  return db.girls.findIndex(g=>g.name.toLowerCase()===name.toLowerCase());
}

function swapTalent(){
  if(!selectedA || !selectedB){
    alert("Hãy chọn cả Girl A và Girl B.");
    return;
  }
  const ai=findGirl(selectedA), bi=findGirl(selectedB);
  const as=+document.querySelector("#aSlot").value;
  const bs=+document.querySelector("#bSlot").value;

  if(ai<0 || bi<0){
    alert("Girl được chọn chưa có trong Talent Database của bạn.");
    return;
  }
  if(ai===bi && as===bs){
    alert("Hãy chọn 2 slot khác nhau.");
    return;
  }

  const A=db.girls[ai],B=db.girls[bi];
  const at=A.talents[as],bt=B.talents[bs];

  [A.talents[as],B.talents[bs]]=[bt,at];

  db.log.push({
    time:new Date().toLocaleString("vi-VN"),
    text:`${A.name} [Talent ${as+1}] "${at||"(trống)"} ↔ ${B.name} [Talent ${bs+1}] "${bt||"(trống)"}`
  });

  save();
}

function renderLookup(){
  const q=document.querySelector("#talentSearch").value.trim().toLowerCase();
  const out=document.querySelector("#lookupResult");
  if(!q){
    out.innerHTML='<span class="muted">Nhập tên talent để tìm vị trí.</span>';
    return;
  }
  const found=[];
  db.girls.forEach(g=>g.talents.forEach((t,s)=>{
    if(t.toLowerCase().includes(q)){
      found.push(`<div class="lookup-item"><b>${esc(g.name)}</b><span class="pill">Talent ${s+1}</span><span class="pill">${esc(t)}</span></div>`);
    }
  }));
  out.innerHTML=found.length?found.join(""):'<span class="muted">Không tìm thấy talent.</span>';
}

function renderHistory(){
  const history=document.querySelector("#history");
  history.innerHTML=db.log.length
    ? db.log.slice().reverse().map(x=>`<div class="history-row"><time>${esc(x.time)}</time>${esc(x.text)}</div>`).join("")
    : '<span class="muted">Chưa có lần SWAP nào.</span>';
}

function exportData(){
  const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download="gomg-talent-backup.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

document.querySelector("#importFile").onchange=e=>{
  const f=e.target.files[0]; if(!f)return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      const x=JSON.parse(r.result);
      if(!x.girls) throw new Error();
      db=x; save();
    }catch{
      alert("JSON không hợp lệ.");
    }
  };
  r.readAsText(f);
};

document.querySelector("#resetBtn").onclick=()=>{
  if(confirm("Xóa toàn bộ dữ liệu hiện tại và quay về dữ liệu mẫu?")){
    db=structuredClone(starter);
    selectedA=selectedB=null;
    document.querySelector("#aSearch").value="";
    document.querySelector("#bSearch").value="";
    save();
  }
};

document.querySelector("#clearLogBtn").onclick=()=>{
  if(confirm("Xóa lịch sử SWAP?")){db.log=[];save();}
};

document.querySelector("#search").addEventListener("input",render);
document.querySelector("#talentSearch").addEventListener("input",renderLookup);
document.querySelector("#addGirlBtn").onclick=addGirl;
document.querySelector("#swapBtn").onclick=swapTalent;
document.querySelector("#exportBtn").onclick=exportData;

setupGirlSearch(
  document.querySelector("#aSearch"),
  document.querySelector("#aResults"),
  "A"
);
setupGirlSearch(
  document.querySelector("#bSearch"),
  document.querySelector("#bResults"),
  "B"
);

render();
loadGameData();
