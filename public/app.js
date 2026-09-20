const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const frames = [
  ["Animais na folhagem","/assets/safari-frame-turma-v2.png"],
  ["Macaco e Apolo no jipe","/assets/moldura-jipe-macaco-apolo-v3.png"],
  ["Girafa na folhagem","/assets/moldura-girafa-aquarela.png"],
  ["Elefante botânico","/assets/moldura-elefante-aquarela.png"],
  ["Leão à esquerda","/assets/moldura-leao-turma-v2.png"],
  ["Leão à direita","/assets/moldura-leao-turma-direita-v2.png"],
  ["Turma com Apolo","/assets/moldura-turma-apolo-completa.png"],
  ["Sem moldura",null]
];

const filters = [
  ["Natural","none"],
  ["Iluminado","brightness(1.12) contrast(.96) saturate(1.03)"],
  ["Luz quente","sepia(.11) saturate(1.08) brightness(1.05)"],
  ["Rosé","sepia(.10) saturate(.92) hue-rotate(330deg) brightness(1.04)"],
  ["Bronze","sepia(.26) saturate(1.12) contrast(1.02)"],
  ["Festa","saturate(1.34) contrast(1.06) brightness(1.03)"],
  ["Vintage suave","sepia(.17) saturate(.82) contrast(.96)"],
  ["Verde safari","sepia(.06) hue-rotate(48deg) saturate(.88) brightness(1.02)"]
];

const makeupOptions = {
  lipstick:[["Natural",null],["Nude","#a56f63"],["Rosé","#b85f70"],["Vermelho suave","#b74d50"],["Vinho suave","#873e50"]],
  lashes:[["Nenhum","none"],["Natural","natural"],["Alongado","long"],["Festa","party"]],
  blush:[["Nenhum",null],["Rosado","#d97983"],["Pêssego","#df8c74"],["Bronze","#b67859"]]
};

const state = {
  step:1, frame:0, filter:0, stream:null, sourceType:null, facing:"user",
  sources:[], sourceIndex:0, result:null, landmarks:null, landmarker:null, faceReady:false,
  makeup:{lipstick:null,lashes:"none",blush:null,intensity:.60},
  galleryAdmin:false, modalPhoto:null
};

const els = {
  welcome:$("#welcomeScreen"), edit:$("#editScreen"), result:$("#resultScreen"),
  video:$("#camera"), source:$("#sourcePhoto"), makeup:$("#makeupPreview"), frame:$("#framePreview"),
  placeholder:$("#cameraPlaceholder"), countdown:$("#countdown"), frameGrid:$("#frameGrid"),
  framePanel:$("#framePanel"), effectsPanel:$("#effectsPanel"), filterGrid:$("#filterGrid"),
  stepEyebrow:$("#stepEyebrow"), stepTitle:$("#stepTitle"), progress:$$(".progress i"),
  back:$("#backBtn"), next:$("#nextBtn"), error:$("#cameraError"), file:$("#fileInput"),
  cameraInput:$("#cameraInput"), selectedStrip:$("#selectedStrip"),
  resultImage:$("#resultImage"), publishStatus:$("#publishStatus"), faceStatus:$("#faceStatus"),
  galleryGrid:$("#galleryGrid"), galleryEmpty:$("#galleryEmpty"), branding:$(".frame-branding")
};

function showScreen(name){
  [els.welcome,els.edit,els.result].forEach(x=>x.classList.add("hidden"));
  els[name].classList.remove("hidden");
}
function stopCamera(){ state.stream?.getTracks().forEach(t=>t.stop()); state.stream=null; }
function isMobile(){ return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || matchMedia("(pointer:coarse)").matches; }

function setFilterPreview(){
  const f=filters[state.filter][1]; els.video.style.filter=f; els.source.style.filter=f;
}
function syncFrame(){
  const src=frames[state.frame][1];
  els.frame.classList.toggle("frame-open",state.frame===2||state.frame===3);
  if(src){els.frame.src=src;els.frame.classList.remove("hidden");els.branding.classList.remove("hidden")}
  else {els.frame.classList.add("hidden");els.branding.classList.add("hidden")}
}
function renderFrames(){
  els.frameGrid.innerHTML="";
  frames.forEach(([name,src],i)=>{
    const b=document.createElement("button"); b.className="choice-card"+(state.frame===i?" selected":"");
    const cls=(i===2||i===3)?" style=\"transform:scale(1.12)\"":"";
    b.innerHTML=src
      ? '<span class="choice-thumb"><img src="'+src+'" alt=""'+cls+'></span><span>'+name+'</span>'
      : '<span class="choice-thumb none">＋</span><span>'+name+'</span>';
    b.onclick=()=>{state.frame=i;syncFrame();renderFrames()};
    els.frameGrid.appendChild(b);
  });
}
function renderFilters(){
  els.filterGrid.innerHTML="";
  filters.forEach(([name,filter],i)=>{
    const b=document.createElement("button"); b.className="choice-card"+(state.filter===i?" selected":"");
    b.innerHTML='<span class="filter-preview"><img src="/assets/apolo-rosto-centralizado.png" alt="" style="filter:'+filter+'"></span><span>'+name+'</span>';
    b.onclick=()=>{state.filter=i;setFilterPreview();renderFilters()};
    els.filterGrid.appendChild(b);
  });
}
function renderMakeup(){
  Object.entries(makeupOptions).forEach(([key,items])=>{
    const box=document.querySelector('[data-options="'+key+'"]'); box.innerHTML="";
    items.forEach(([label,value])=>{
      const b=document.createElement("button"); b.className="chip"+(state.makeup[key]===value?" active":""); b.textContent=label;
      b.onclick=()=>{state.makeup[key]=value;renderMakeup();drawPreviewMakeup()}; box.appendChild(b);
    });
  });
}
function updateStep(){
  els.stepEyebrow.textContent="ETAPA "+state.step+" DE 3";
  els.stepTitle.textContent=state.step===1?"Escolha sua moldura":"Maquiagem, luz & cor";
  els.progress.forEach((x,i)=>x.classList.toggle("on",i<state.step));
  els.framePanel.classList.toggle("hidden",state.step!==1);
  els.effectsPanel.classList.toggle("hidden",state.step!==2);
  els.next.textContent=state.step===1?"Continuar →":"FINALIZAR FOTO";
  els.back.textContent=state.step===1?"← Voltar":"← Molduras";
}

function dataURL(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=reject; r.readAsDataURL(file);
  });
}
async function chooseFiles(files){
  const valid=[...files].filter(f=>f.type.startsWith("image/")); if(!valid.length) return;
  stopCamera();
  state.sources=await Promise.all(valid.map(async f=>({name:f.name||"foto",dataUrl:await dataURL(f)})));
  state.sourceIndex=0; state.sourceType="image"; state.result=null;
  showScreen("edit"); state.step=1; updateStep(); renderSelectedStrip(); await loadCurrentSource();
}
async function loadCurrentSource(){
  const item=state.sources[state.sourceIndex]; if(!item) return;
  els.source.onload=async()=>{
    els.source.classList.remove("hidden"); els.video.classList.add("hidden"); els.placeholder.classList.add("hidden");
    els.makeup.classList.remove("mirror"); await detectImageFace(); drawPreviewMakeup();
  };
  els.source.src=item.dataUrl;
}
function renderSelectedStrip(){
  const many=state.sources.length>1;
  els.selectedStrip.classList.toggle("hidden",!many); els.selectedStrip.innerHTML="";
  if(!many) return;
  state.sources.forEach((s,i)=>{
    const b=document.createElement("button"); b.className="selected-thumb"+(i===state.sourceIndex?" active":"");
    b.innerHTML='<img src="'+s.dataUrl+'" alt="Foto '+(i+1)+'">';
    b.onclick=async()=>{state.sourceIndex=i;renderSelectedStrip();await loadCurrentSource()};
    els.selectedStrip.appendChild(b);
  });
}

async function startCamera(){
  if(isMobile()){
    els.cameraInput.value=""; els.cameraInput.click(); return;
  }
  showScreen("edit"); state.step=1; updateStep(); state.sourceType="camera"; state.sources=[];
  els.selectedStrip.classList.add("hidden"); els.source.classList.add("hidden"); els.video.classList.remove("hidden"); els.placeholder.classList.remove("hidden");
  stopCamera(); els.error.classList.add("hidden");
  try{
    state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:state.facing},width:{ideal:1280},height:{ideal:1600}},audio:false});
    els.video.srcObject=state.stream; await els.video.play(); els.placeholder.classList.add("hidden");
    els.video.classList.toggle("mirror",state.facing==="user"); els.makeup.classList.toggle("mirror",state.facing==="user");
    await ensureFaceLandmarker("VIDEO"); requestAnimationFrame(faceLoop);
  }catch(e){
    els.error.textContent="A câmera ao vivo não abriu. Vamos usar a câmera do aparelho.";
    els.error.classList.remove("hidden"); els.cameraInput.click();
  }
}

let mpModule=null;
async function ensureFaceLandmarker(mode){
  try{
    if(!mpModule) mpModule=await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/+esm");
    if(!state.landmarker){
      const vision=await mpModule.FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm");
      state.landmarker=await mpModule.FaceLandmarker.createFromOptions(vision,{
        baseOptions:{modelAssetPath:"https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",delegate:"GPU"},
        runningMode:mode,numFaces:1,outputFaceBlendshapes:false
      });
    }else await state.landmarker.setOptions({runningMode:mode});
    state.faceReady=true; els.faceStatus.textContent="Maquiagem facial pronta — os efeitos acompanham o rosto.";
  }catch(e){
    console.warn(e); state.faceReady=false; els.faceStatus.textContent="Neste aparelho, use Luz & Cor normalmente; a maquiagem facial pode ficar indisponível.";
  }
}
async function detectImageFaceFor(image){
  await ensureFaceLandmarker("IMAGE"); if(!state.faceReady) return null;
  try{return state.landmarker.detect(image).faceLandmarks?.[0]||null}catch(e){return null}
}
async function detectImageFace(){ state.landmarks=await detectImageFaceFor(els.source); }
let lastVideoTime=-1;
function faceLoop(){
  if(state.sourceType!=="camera"||!state.stream)return;
  if(state.faceReady&&els.video.readyState>=2&&els.video.currentTime!==lastVideoTime){
    lastVideoTime=els.video.currentTime;
    try{state.landmarks=state.landmarker.detectForVideo(els.video,performance.now()).faceLandmarks?.[0]||null;drawPreviewMakeup()}catch(e){}
  }
  requestAnimationFrame(faceLoop);
}

const lipOuter=[61,146,91,181,84,17,314,405,321,375,291];
const leftUpper=[33,160,158,133],rightUpper=[362,385,387,263];
function pt(lm,i,w,h,mirror=false){const p=lm[i];return[(mirror?1-p.x:p.x)*w,p.y*h]}
function drawMakeup(ctx,lm,w,h,mirror=false){
  if(!lm)return; const a=state.makeup.intensity;
  if(state.makeup.blush){
    ctx.save();ctx.globalAlpha=.22*a;
    for(const idx of [117,346]){const[x,y]=pt(lm,idx,w,h,mirror),r=Math.max(18,w*.065);const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,state.makeup.blush);g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}ctx.restore();
  }
  if(state.makeup.lipstick){
    ctx.save();ctx.globalAlpha=.46*a;ctx.fillStyle=state.makeup.lipstick;ctx.beginPath();
    lipOuter.forEach((idx,j)=>{const[x,y]=pt(lm,idx,w,h,mirror);j?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();ctx.fill();ctx.restore();
  }
  if(state.makeup.lashes!=="none"){
    const amount=state.makeup.lashes==="party"?7:state.makeup.lashes==="long"?5:3;
    const len=(state.makeup.lashes==="party"?18:state.makeup.lashes==="long"?14:10)*(w/430)*a;
    ctx.save();ctx.strokeStyle="#3f342f";ctx.lineWidth=Math.max(1.2,w/430*1.4);ctx.lineCap="round";ctx.globalAlpha=.65+.25*a;
    for(const arr of [leftUpper,rightUpper])for(let i=0;i<amount;i++){const t=(i+1)/(amount+1),p1=pt(lm,arr[0],w,h,mirror),p2=pt(lm,arr[arr.length-1],w,h,mirror),x=p1[0]+(p2[0]-p1[0])*t,y=p1[1]+(p2[1]-p1[1])*t;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(mirror?-1:1)*(t-.5)*len*.35,y-len);ctx.stroke()}ctx.restore();
  }
}
function drawPreviewMakeup(){
  const c=els.makeup,box=$("#photoStage").getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
  c.width=Math.max(1,Math.round(box.width*dpr));c.height=Math.max(1,Math.round(box.height*dpr));c.style.width=box.width+"px";c.style.height=box.height+"px";
  const ctx=c.getContext("2d");ctx.scale(dpr,dpr);drawMakeup(ctx,state.landmarks,box.width,box.height,false);
}

function drawCover(ctx,media,w,h,mirror=false){
  const sw=media.videoWidth||media.naturalWidth,sh=media.videoHeight||media.naturalHeight,scale=Math.max(w/sw,h/sh),dw=sw*scale,dh=sh*scale;
  ctx.save();if(mirror){ctx.translate(w,0);ctx.scale(-1,1)}ctx.drawImage(media,(w-dw)/2,(h-dh)/2,dw,dh);ctx.restore();
}
async function loadImage(src){const im=new Image();im.src=src;await im.decode();return im}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.roundRect(x,y,w,h,r)}
function drawBranding(ctx,w,h){
  if(!frames[state.frame][1])return;
  const text1="SAFARI DO APOLO",text2="14 • 11 • 2026";
  ctx.save();ctx.font="700 25px Arial";const tw=Math.max(ctx.measureText(text1).width,ctx.measureText(text2).width);const bw=tw+48,bh=72,x=(w-bw)/2,y=h-94;
  ctx.fillStyle="rgba(255,250,240,.90)";roundRect(ctx,x,y,bw,bh,36);ctx.fill();
  ctx.strokeStyle="rgba(129,146,106,.75)";ctx.lineWidth=2;ctx.stroke();
  ctx.fillStyle="#3f4b3b";ctx.textAlign="center";ctx.font="800 24px Arial";ctx.fillText(text1,w/2,y+29);ctx.font="700 20px Arial";ctx.fillText(text2,w/2,y+55);ctx.restore();
}
async function composeMedia(media,landmarks,mirror=false){
  const w=1080,h=1350,c=document.createElement("canvas");c.width=w;c.height=h;const ctx=c.getContext("2d");
  ctx.filter=filters[state.filter][1];drawCover(ctx,media,w,h,mirror);ctx.filter="none";drawMakeup(ctx,landmarks,w,h,mirror);
  const f=frames[state.frame][1];
  if(f){
    const im=await loadImage(f),s=(state.frame===2||state.frame===3)?1.13:1;
    const dw=w*s,dh=h*s;ctx.drawImage(im,(w-dw)/2,(h-dh)/2,dw,dh);drawBranding(ctx,w,h);
  }
  return c.toDataURL("image/jpeg",.92);
}
async function composeCurrent(){
  if(state.sourceType==="camera")return composeMedia(els.video,state.landmarks,state.facing==="user");
  return composeMedia(els.source,state.landmarks,false);
}
async function composeSource(dataUrl){
  const im=await loadImage(dataUrl),lm=await detectImageFaceFor(im);return composeMedia(im,lm,false);
}

async function capture(){
  els.next.disabled=true;
  if(state.sourceType==="camera"){
    for(const n of [3,2,1]){els.countdown.textContent=n;els.countdown.classList.remove("hidden");await new Promise(r=>setTimeout(r,650))}
    els.countdown.classList.add("hidden");
  }
  state.result=await composeCurrent();stopCamera();els.resultImage.src=state.result;showScreen("result");prepareBatchButtons();els.next.disabled=false;
}

function prepareBatchButtons(){
  $$(".batch-action").forEach(x=>x.remove());
  if(state.sources.length<=1)return;
  const saveAll=document.createElement("button");saveAll.className="secondary batch-action";saveAll.textContent="⬇️ SALVAR TODAS";
  saveAll.onclick=saveAllResults;
  const publishAll=document.createElement("button");publishAll.className="secondary gallery-add batch-action";publishAll.textContent="🌿 ADICIONAR TODAS À GALERIA";
  publishAll.onclick=publishAllResults;
  $("#shareBtn").after(saveAll);$("#publishBtn").after(publishAll);
}
async function saveResult(){const a=document.createElement("a");a.href=state.result;a.download="safari-do-apolo.jpg";a.click()}
async function saveAllResults(){
  const btn=[...$$(".batch-action")].find(b=>b.textContent.includes("SALVAR TODAS"));if(btn){btn.disabled=true;btn.textContent="Preparando…"}
  try{
    const {default:JSZip}=await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");const zip=new JSZip();
    for(let i=0;i<state.sources.length;i++){const out=await composeSource(state.sources[i].dataUrl);zip.file("safari-apolo-"+String(i+1).padStart(2,"0")+".jpg",out.split(",")[1],{base64:true})}
    const blob=await zip.generateAsync({type:"blob"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="fotos-safari-do-apolo.zip";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }finally{if(btn){btn.disabled=false;btn.textContent="⬇️ SALVAR TODAS"}}
}
async function shareResult(){
  const blob=await(await fetch(state.result)).blob(),file=new File([blob],"safari-do-apolo.jpg",{type:"image/jpeg"});
  if(navigator.share&&navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:"Safari do Apolo"});else saveResult();
}
async function postPhoto(dataUrl){const r=await fetch("/api/photos",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dataUrl})});const j=await r.json();if(!r.ok)throw new Error(j.error||"Erro");return j}
async function publishResult(){
  const b=$("#publishBtn");b.disabled=true;els.publishStatus.textContent="Publicando sua lembrança…";
  try{await postPhoto(state.result);els.publishStatus.textContent="Sua lembrança foi adicionada à galeria! 🌿";b.textContent="✓ PUBLICADA NA GALERIA"}
  catch(e){els.publishStatus.textContent="Não foi possível publicar agora. Tente novamente."}finally{b.disabled=false}
}
async function publishAllResults(){
  const btn=[...$$(".batch-action")].find(b=>b.textContent.includes("ADICIONAR TODAS"));if(btn){btn.disabled=true;btn.textContent="Publicando…"}
  els.publishStatus.textContent="Publicando as fotos…";
  try{
    for(let i=0;i<state.sources.length;i++){const out=await composeSource(state.sources[i].dataUrl);await postPhoto(out);els.publishStatus.textContent="Publicando "+(i+1)+" de "+state.sources.length+"…"}
    els.publishStatus.textContent="Todas as lembranças foram adicionadas à galeria! 🌿";
  }catch(e){els.publishStatus.textContent="Algumas fotos não puderam ser publicadas. Tente novamente."}
  finally{if(btn){btn.disabled=false;btn.textContent="🌿 ADICIONAR TODAS À GALERIA"}}
}

function resetBooth(){
  stopCamera();state.result=null;state.landmarks=null;state.step=1;state.frame=0;state.filter=0;state.sources=[];state.sourceIndex=0;
  state.makeup={lipstick:null,lashes:"none",blush:null,intensity:.60};els.selectedStrip.classList.add("hidden");
  els.publishStatus.textContent="";$("#publishBtn").textContent="🌿 ADICIONAR À GALERIA";
  renderFrames();renderFilters();renderMakeup();syncFrame();showScreen("welcome");
}
function navTo(which){
  $$(".view").forEach(v=>v.classList.remove("active"));$("#"+which+"View").classList.add("active");
  $$(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.go===which));
  if(which==="gallery")loadGallery();else resetBooth();
}
$$("[data-go]").forEach(b=>b.onclick=()=>navTo(b.dataset.go));

$("#startCamera").onclick=startCamera;
$("#chooseGallery").onclick=()=>{els.file.value="";els.file.click()};
els.file.onchange=e=>chooseFiles(e.target.files||[]);
els.cameraInput.onchange=e=>chooseFiles(e.target.files||[]);

els.next.onclick=()=>{if(state.step===1){state.step=2;updateStep()}else capture()};
els.back.onclick=()=>{if(state.step===1)resetBooth();else{state.step=1;updateStep()}};

$("#saveBtn").onclick=saveResult;$("#shareBtn").onclick=shareResult;$("#publishBtn").onclick=publishResult;$("#againBtn").onclick=resetBooth;

$$(".effect-tab").forEach(b=>b.onclick=()=>{
  $$(".effect-tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");
  $("#makeupPanel").classList.toggle("hidden",b.dataset.effectTab!=="makeup");$("#lightPanel").classList.toggle("hidden",b.dataset.effectTab!=="light");
});
$$("[data-clear]").forEach(b=>b.onclick=()=>{const k=b.dataset.clear;state.makeup[k]=k==="lashes"?"none":null;renderMakeup();drawPreviewMakeup()});
$("#noMakeup").onclick=()=>{state.makeup={...state.makeup,lipstick:null,lashes:"none",blush:null};renderMakeup();drawPreviewMakeup()};
$("#clearAll").onclick=()=>{state.makeup={lipstick:null,lashes:"none",blush:null,intensity:.60};state.filter=0;$("#makeupIntensity").value=60;$("#makeupIntensityLabel").textContent="60%";renderMakeup();renderFilters();setFilterPreview();drawPreviewMakeup()};
$("#makeupIntensity").oninput=e=>{state.makeup.intensity=Number(e.target.value)/100;$("#makeupIntensityLabel").textContent=e.target.value+"%";drawPreviewMakeup()};

async function loadGallery(){
  const r=await fetch("/api/photos"),j=await r.json();state.galleryAdmin=!!j.admin;els.galleryGrid.innerHTML="";els.galleryEmpty.classList.toggle("hidden",j.photos.length>0);
  j.photos.forEach(p=>{const d=document.createElement("button");d.className="gallery-item"+(p.hidden?" hidden-photo":"");d.innerHTML='<img loading="lazy" src="/api/photos/'+p.id+'/image" alt="Memória do Safari do Apolo">'+(state.galleryAdmin?'<span class="gallery-admin-badge">'+(p.hidden?"Oculta":"Visível")+'</span>':"");d.onclick=()=>openPhoto(p);els.galleryGrid.appendChild(d)});
  $("#adminEntry").textContent=state.galleryAdmin?"Administração ativa":"Administrar galeria";
}
function openPhoto(p){
  state.modalPhoto=p;$("#modalPhoto").src="/api/photos/"+p.id+"/image";$("#modalDownload").href="/api/photos/"+p.id+"/image";
  $("#modalHide").classList.toggle("hidden",!state.galleryAdmin);$("#modalDelete").classList.toggle("hidden",!state.galleryAdmin);$("#modalHide").textContent=p.hidden?"Tornar visível":"Ocultar";$("#photoModal").classList.remove("hidden");
}
$("#closePhotoModal").onclick=()=>$("#photoModal").classList.add("hidden");
$("#modalShare").onclick=async()=>{const url=location.origin+"/api/photos/"+state.modalPhoto.id+"/image";if(navigator.share)await navigator.share({title:"Safari do Apolo",url});else navigator.clipboard?.writeText(url)};
$("#modalHide").onclick=async()=>{const p=state.modalPhoto;await fetch("/api/photos/"+p.id,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({hidden:!p.hidden})});$("#photoModal").classList.add("hidden");loadGallery()};
$("#modalDelete").onclick=async()=>{if(!confirm("Excluir esta foto da galeria?"))return;await fetch("/api/photos/"+state.modalPhoto.id,{method:"DELETE"});$("#photoModal").classList.add("hidden");loadGallery()};

$("#adminEntry").onclick=async()=>{
  const s=await(await fetch("/api/session")).json();$("#loginModal").classList.remove("hidden");$("#logoutBtn").classList.toggle("hidden",!s.admin);$("#loginBtn").classList.toggle("hidden",s.admin);$("#loginStatus").textContent=s.admin?"Você está logada como administradora.":"";
};
$("#closeLogin").onclick=()=>$("#loginModal").classList.add("hidden");
$("#loginBtn").onclick=async()=>{
  const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:$("#adminEmail").value,password:$("#adminPassword").value})});
  const j=await r.json();if(!r.ok){$("#loginStatus").textContent=j.error;return}$("#loginStatus").textContent="Login realizado.";$("#logoutBtn").classList.remove("hidden");$("#loginBtn").classList.add("hidden");loadGallery();
};
$("#logoutBtn").onclick=async()=>{await fetch("/api/logout",{method:"POST"});$("#loginModal").classList.add("hidden");loadGallery()};

renderFrames();renderFilters();renderMakeup();syncFrame();setFilterPreview();updateStep();
window.addEventListener("resize",drawPreviewMakeup);
