const KEY="gomg-talent-tracker-v2";
const STARTER={
  girls:[
    {name:"Character 01",talents:["Astral Double","Astral Double","Nine Lives","Astral Double"]},
    {name:"Character 02",talents:["Double Fortune","Double Fortune","High Momentum","High Morale"]}
  ],
  log:[]
};

let db=loadDB();
let gameData={characters:[],talents:[]};
let selectedA=null, selectedB=null;

const $=id=>document.getElementById(id);

function loadDB(){
  try{
    const saved=localStorage.getItem(KEY);
    return saved?JSON.parse(saved):structuredClone(STARTER);
  }catch(e){return structuredClone(STARTER)}
}
function saveDB(){
  localStorage.setItem(KEY,JSON.stringify(db));
  render();
}
function esc(v){
  return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

async function loadGameData(){
  try{
    const r=await fetch("game-data.json");
    if(r.ok) gameData=await r.json();
  }catch(e){console.warn("game-data.json could not be loaded",e)}
  render();
}

/* ===== V2 DATABASE: this is deliberately kept simple ===== */
function render(){
  const q=$("search").value.trim().toLowerCase();
  const body=$("girlsBody");
  body.innerHTML="";

  db.girls.forEach((g,i)=>{
    if(q && !(g.name+" "+g.talents.join(" ")).toLowerCase().includes(q)) return;

    const tr=document.createElement("tr");

    const nameTd=document.createElement("td");
    const nameInput=document.createElement("input");
    nameInput.value=g.name;
    nameTd.appendChild(nameInput);
    tr.appendChild(nameTd);

    g.talents.forEach((talent,s)=>{
      const td=document.createElement("td");
      const input=document.createElement("input");
      input.className="slot-input";
      input.value=talent;
      input.addEventListener("change",()=>{g.talents[s]=input.value.trim();saveDB()});
      td.appendChild(input);
      tr.appendChild(td);
    });

    const actionTd=document.createElement("td");
    const del=document.createElement("button");
    del.className="danger";
    del.textContent="Xóa";
    del.addEventListener("click",()=>{
      if(confirm("Xóa Girl này?")){
        db.girls.splice(i,1);
        if(selectedA===g.name) selectedA=null;
        if(selectedB===g.name) selectedB=null;
        saveDB();
      }
    });
    actionTd.appendChild(del);
    tr.appendChild(actionTd);

    nameInput.addEventListener("change",()=>{
      const oldName=g.name;
      g.name=nameInput.value.trim()||"Unnamed Girl";
      if(selectedA===oldName) selectedA=g.name;
      if(selectedB===oldName) selectedB=g.name;
      saveDB();
    });

    body.appendChild(tr);
  });

  $("girlCount").textContent=db.girls.length;
  $("talentCount").textContent=db.girls.length*4;
  $("logCount").textContent=db.log.length;
  renderLookup();
  renderHistory();
  updatePills();
}

/* ===== THIS IS THE ORIGINAL V2 "ADD GIRL" BEHAVIOR ===== */
function addGirl(){
  const number=db.girls.length+1;
  db.girls.push({
    name:`Character ${String(number).padStart(2,"0")}`,
    talents:["","","",""]
  });
  saveDB();
}

/* ===== SEARCH ONLY FOR SWAP SELECTOR ===== */
function getTrackerGirls(query){
  const q=query.trim().toLowerCase();
  return db.girls
    .map((g,i)=>({name:g.name,index:i,source:"Tracker"}))
    .filter(x=>!q || x.name.toLowerCase().includes(q));
}

function getGameGirls(query){
  const q=query.trim().toLowerCase();
  return (gameData.characters||[])
    .map(c=>({name:c.name_en||c.name||"",index:-1,source:"Game database"}))
    .filter(x=>x.name && (!q || x.name.toLowerCase().includes(q)));
}

function showGirlSuggestions(side){
  const input=side==="A"?$("aSearch"):$("bSearch");
  const box=side==="A"?$("aResults"):$("bResults");
  const q=input.value.trim();

  // Tracker entries FIRST, exactly as the user wants.
  const own=getTrackerGirls(q);
  const external=getGameGirls(q);
  const all=[];
  const seen=new Set();

  for(const x of [...own,...external]){
    const key=x.name.toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    all.push(x);
    if(all.length>=12)break;
  }

  box.innerHTML=all.length
    ? all.map((x,i)=>`<div class="suggestion" data-i="${i}"><b>${esc(x.name)}</b><small>${esc(x.source)}</small></div>`).join("")
    : `<div class="suggestion">Không tìm thấy Girl.</div>`;

  box.classList.add("show");

  box.querySelectorAll("[data-i]").forEach(el=>{
    el.addEventListener("click",()=>{
      const item=all[Number(el.dataset.i)];
      input.value=item.name;
      if(item.index>=0){
        if(side==="A")selectedA=item.name; else selectedB=item.name;
        updatePills();
      }else{
        if(side==="A")selectedA=null; else selectedB=null;
        updatePills();
        alert(`"${item.name}" có trong Game Database nhưng chưa có trong Talent Database của bạn.\nHãy thêm Girl đó bằng "+ Thêm Girl" trước khi SWAP.`);
      }
      box.classList.remove("show");
    });
  });
}

function setupGirlSearch(side){
  const input=side==="A"?$("aSearch"):$("bSearch");
  const box=side==="A"?$("aResults"):$("bResults");

  input.addEventListener("focus",()=>showGirlSuggestions(side));
  input.addEventListener("input",()=>{
    const value=input.value.trim().toLowerCase();
    if(side==="A" && selectedA && value!==selectedA.toLowerCase())selectedA=null;
    if(side==="B" && selectedB && value!==selectedB.toLowerCase())selectedB=null;
    updatePills();
    showGirlSuggestions(side);
  });

  document.addEventListener("click",e=>{
    if(!input.parentElement.contains(e.target))box.classList.remove("show");
  });
}

function updatePills(){
  $("aSelected").textContent="Girl A: "+(selectedA||"Chưa chọn");
  $("bSelected").textContent="Girl B: "+(selectedB||"Chưa chọn");
}

function findGirl(name){
  return db.girls.findIndex(g=>g.name.toLowerCase()===name.toLowerCase());
}

function swapTalent(){
  if(!selectedA||!selectedB){alert("Hãy chọn cả Girl A và Girl B.");return}
  const ai=findGirl(selectedA),bi=findGirl(selectedB);
  const as=Number($("aSlot").value),bs=Number($("bSlot").value);

  if(ai<0||bi<0){alert("Girl được chọn chưa có trong Talent Database.");return}
  if(ai===bi&&as===bs){alert("Hãy chọn 2 slot khác nhau.");return}

  const A=db.girls[ai],B=db.girls[bi];
  const at=A.talents[as],bt=B.talents[bs];
  [A.talents[as],B.talents[bs]]=[bt,at];

  db.log.push({
    time:new Date().toLocaleString("vi-VN"),
    text:`${A.name} [Talent ${as+1}] "${at||"(trống)"} ↔ ${B.name} [Talent ${bs+1}] "${bt||"(trống)"}`
  });
  saveDB();
}

function renderLookup(){
  const q=$("talentSearch").value.trim().toLowerCase();
  const out=$("lookupResult");
  if(!q){out.innerHTML='<span class="muted">Nhập tên talent để tìm vị trí.</span>';return}

  const found=[];
  db.girls.forEach(g=>g.talents.forEach((t,s)=>{
    if(t.toLowerCase().includes(q))
      found.push(`<div class="lookup-item"><b>${esc(g.name)}</b><span class="pill">Talent ${s+1}</span><span class="pill">${esc(t)}</span></div>`);
  }));
  out.innerHTML=found.length?found.join(""):'<span class="muted">Không tìm thấy talent.</span>';
}

function renderHistory(){
  const out=$("history");
  out.innerHTML=db.log.length
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

/* ===== EVENTS: explicit element references so +Thêm Girl cannot fail ===== */
$("addGirlBtn").addEventListener("click",addGirl);
$("swapBtn").addEventListener("click",swapTalent);
$("exportBtn").addEventListener("click",exportData);
$("search").addEventListener("input",render);
$("talentSearch").addEventListener("input",renderLookup);

$("resetBtn").addEventListener("click",()=>{
  if(confirm("Xóa toàn bộ dữ liệu hiện tại và quay về dữ liệu mẫu?")){
    db=structuredClone(STARTER);
    selectedA=selectedB=null;
    $("aSearch").value="";
    $("bSearch").value="";
    saveDB();
  }
});

$("clearLogBtn").addEventListener("click",()=>{
  if(confirm("Xóa lịch sử SWAP?")){db.log=[];saveDB()}
});

$("importFile").addEventListener("change",e=>{
  const f=e.target.files[0];if(!f)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const imported=JSON.parse(reader.result);
      if(!Array.isArray(imported.girls))throw new Error("bad data");
      db=imported;
      selectedA=selectedB=null;
      $("aSearch").value="";
      $("bSearch").value="";
      saveDB();
    }catch(err){alert("JSON không hợp lệ.")}
  };
  reader.readAsText(f);
});

setupGirlSearch("A");
setupGirlSearch("B");
render();
loadGameData();
