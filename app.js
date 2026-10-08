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
function talentById(id){return GAME.talents.find(x=>x.id===id)}
function charById(id){return GAME.characters.find(x=>x.id===id)}
function talentLabel(id){let t=talentById(id);return t?t.name_en||t.name_source||id:(id||"")}
function charLabel(id){let c=charById(id);return c?c.name_en:id||""}
function tierClass(t){return t?`tier tier-${t}`:""}
function displayTalent(t){if(!t)return '<span class="muted">Empty</span>';let x=talentById(t);if(!x)return esc(t);return `<span class="${tierClass(x.rank)}">${esc(x.name_en||x.name_source)}</span>`}
function migrate(){
 db=loadLocal();
 const charMap=new Map(GAME.characters.map(c=>[(c.name_en||"").toLowerCase(),c.id]));
 const talMap=new Map(GAME.talents.flatMap(t=>[[String(t.name_en||"").toLowerCase(),t.id],[String(t.name_source||"").toLowerCase(),t.id]].filter(x=>x[0])));
 db.girls=(db.girls||[]).map((raw,i)=>{
   const g=normalizeGirl(raw,i);
   let cid=g.charId;
   const probe=String(g.charId||g.name||"").toLowerCase();
   if(!cid) cid=charMap.get(probe);
   const boards=g.boards.map(board=>board.map(t=>talMap.get(String(t).toLowerCase())||t));
   return {charId:cid||null,name:cid?charLabel(cid):(g.name||`Custom Girl ${i+1}`),customName:cid?false:true,boards,activeBoard:g.activeBoard};
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
 const q=normalizeText($("search").value),body=$("girlsBody");body.innerHTML="";
 (db.girls||[]).forEach((g,i)=>{
  const allTalentIds=g.boards.flat();
  const search=normalizeText(g.name+" "+allTalentIds.map(talentLabel).join(" "));if(q&&!search.includes(q))return;
  const b=Math.min(BOARD_COUNT-1,Math.max(0,g.activeBoard||0));g.activeBoard=b;
  const tr=document.createElement("tr");
  tr.innerHTML=`<td>${girlEditor(g,i)}</td>`+g.boards[b].map((t,s)=>`<td>${talentEditor(t,i,b,s)}</td>`).join("")+`<td><button class="danger" data-del="${i}">Xóa</button></td>`;
  tr.querySelector("[data-del]").onclick=()=>{if(confirm("Xóa Girl này khỏi tracker?")){db.girls.splice(i,1);save()}};
  body.appendChild(tr);
 });
 fillGirlSelects();fillBoardSelects();fillSlotSelects();renderLookup();renderHistory();
 $("girlCount").textContent=db.girls.length;$("talentCount").textContent=db.girls.length*BOARD_COUNT*SLOT_COUNT;$("logCount").textContent=db.log.length;
 $("charDbCount").textContent=GAME.characters.length;$("talentDbCount").textContent=GAME.talents.length;
}
function girlEditor(g,i){
 const value=g.charId?charLabel(g.charId):(g.name||"");
 const tabs=Array.from({length:BOARD_COUNT},(_,b)=>`<button type="button" class="board-tab ${b===(g.activeBoard||0)?"active":""}" data-board="${b}" data-g="${i}">Board ${b+1}</button>`).join("");
 return `<div class="girl-cell"><div class="autocomplete"><input class="girlinput" data-g="${i}" value="${esc(value)}" placeholder="Gõ tên Girl..." autocomplete="off"><div class="suggestions"></div></div><div class="board-tabs">${tabs}</div></div>`;
}
function talentEditor(t,i,b,s){
 const value=t?talentLabel(t):"";
 return `<div class="autocomplete"><input class="talentinput" data-g="${i}" data-b="${b}" data-s="${s}" value="${esc(value)}" placeholder="Gõ tên Talent..." autocomplete="off"><div class="suggestions"></div></div>`;
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
   db.girls[i].boards[b][s]=id;
 }
 // Persist without re-rendering the table. Re-rendering immediately here can
 // replace the input DOM while the browser is still processing the click/touch.
 localStorage.setItem(KEY,JSON.stringify(db));
 input.value=input.classList.contains("girlinput")?charLabel(id):talentLabel(id);
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
 if(ta&&tb&&ta.rank!==tb.rank)return alert(`Không thể SWAP khác tier: ${ta.rank} ↔ ${tb.rank}`);
 [A.boards[ab][as],B.boards[bb][bs]]=[bt,at];
 db.log.push({time:new Date().toLocaleString("vi-VN"),text:`${A.name} [B${ab+1} T${as+1}] ${talentLabel(at)} ↔ ${B.name} [B${bb+1} T${bs+1}] ${talentLabel(bt)}`});
 save();
}
function renderLookup(){
 const q=normalizeText($("talentSearch").value),out=$("lookup");if(!q){out.innerHTML='<span class="muted">Nhập tên talent để tìm.</span>';return}
 const matches=GAME.talents.filter(t=>normalizeText(t.name_en+" "+(t.name_source||"")).includes(q)).slice(0,30);
 const rows=[];matches.forEach(t=>{db.girls.forEach(g=>g.boards.forEach((board,b)=>board.forEach((id,s)=>{if(id===t.id)rows.push(`<div class="lookup-item"><b>${esc(g.name)}</b><span class="pill">Board ${b+1}</span><span class="pill">Talent ${s+1}</span><span class="pill ${tierClass(t.rank)}">${esc(t.name_en||t.name_source)}</span></div>`)})))});
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
