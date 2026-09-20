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

const frameImages = new Map();

function getFrameImage(src){
  if(!frameImages.has(src)) frameImages.set(src,loadImage(src));
  return frameImages.get(src);
}

const state = {
  frame:0,
  stream:null,
  facing:"user",
  sourceType:null,
  sources:[],
  sourceIndex:0,
  result:null,
  galleryAdmin:false,
  modalPhoto:null
};

const els = {
  cameraTab:$("#cameraTab"),
  galleryTab:$("#galleryTab"),
  cameraSection:$("#cameraSection"),
  gallerySection:$("#gallerySection"),
  galleryCount:$("#galleryCount"),
  stage:$("#photoStage"),
  video:$("#camera"),
  sourcePhoto:$("#sourcePhoto"),
  frame:$("#framePreview"),
  branding:$(".frame-branding"),
  placeholder:$("#cameraPlaceholder"),
  startCamera:$("#startCamera"),
  switchCamera:$("#switchCameraBtn"),
  shutter:$("#shutterBtn"),
  countdown:$("#countdown"),
  fileInput:$("#fileInput"),
  cameraInput:$("#cameraInput"),
  chooseGallery:$("#chooseGallery"),
  nativeCamera:$("#nativeCameraBtn"),
  error:$("#cameraError"),
  frameGrid:$("#frameGrid"),
  selectedStrip:$("#selectedStrip"),
  resultSection:$("#resultSection"),
  resultImage:$("#resultImage"),
  saveBtn:$("#saveBtn"),
  shareBtn:$("#shareBtn"),
  publishBtn:$("#publishBtn"),
  againBtn:$("#againBtn"),
  publishStatus:$("#publishStatus"),
  galleryGrid:$("#galleryGrid"),
  galleryEmpty:$("#galleryEmpty")
};

function stopCamera(){
  state.stream?.getTracks().forEach(t=>t.stop());
  state.stream=null;
}

function showSection(which){
  const camera=which==="camera";
  els.cameraSection.classList.toggle("active",camera);
  els.gallerySection.classList.toggle("active",!camera);
  els.cameraTab.classList.toggle("active",camera);
  els.galleryTab.classList.toggle("active",!camera);
  if(!camera){
    stopCamera();
    loadGallery();
  }
}

els.cameraTab.onclick=async()=>{
  showSection("camera");
  if(!state.stream && state.sourceType!=="image") await startCamera();
};
els.galleryTab.onclick=()=>showSection("gallery");
$("#brandHome").onclick=async()=>{
  showSection("camera");
  if(!state.stream && state.sourceType!=="image") await startCamera();
};

async function syncFrame(){
  const src=frames[state.frame][1];
  if(src){
    els.frame.classList.remove("hidden");
    els.branding.classList.remove("hidden");
    const image=await getFrameImage(src);
    const ctx=els.frame.getContext("2d");
    ctx.clearRect(0,0,els.frame.width,els.frame.height);
    drawBalancedFrame(ctx,image,els.frame.width,els.frame.height,state.frame);
  }else{
    els.frame.getContext("2d").clearRect(0,0,els.frame.width,els.frame.height);
    els.frame.classList.add("hidden");
    els.branding.classList.add("hidden");
  }
}

function renderFrames(){
  els.frameGrid.innerHTML="";
  frames.forEach(([name,src],i)=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="frame-card"+(i===state.frame?" selected":"");
    b.innerHTML=src
      ? '<span class="frame-thumb"><img src="'+src+'" alt=""></span><span>'+name+'</span>'
      : '<span class="frame-thumb none">＋</span><span>Sem moldura</span>';
    b.onclick=async()=>{
      state.frame=i;
      await syncFrame();
      renderFrames();
    };
    els.frameGrid.appendChild(b);
  });
}

function showPlaceholder(){
  els.placeholder.classList.remove("hidden");
  els.video.classList.add("hidden");
  els.sourcePhoto.classList.add("hidden");
  els.switchCamera.classList.add("hidden");
  els.shutter.classList.add("hidden");
}

async function startCamera(){
  stopCamera();
  state.sourceType="camera";
  state.sources=[];
  els.selectedStrip.classList.add("hidden");
  els.error.classList.add("hidden");
  els.nativeCamera.classList.add("hidden");
  els.placeholder.classList.remove("hidden");
  els.video.classList.remove("hidden");
  els.sourcePhoto.classList.add("hidden");

  try{
    if(!navigator.mediaDevices?.getUserMedia) throw new Error("Câmera indisponível");
    const stream=await navigator.mediaDevices.getUserMedia({
      video:{
        facingMode:{ideal:state.facing},
        width:{ideal:1280},
        height:{ideal:1600}
      },
      audio:false
    });
    state.stream=stream;
    els.video.srcObject=stream;
    await els.video.play();
    els.video.classList.toggle("mirror",state.facing==="user");
    els.placeholder.classList.add("hidden");
    els.switchCamera.classList.remove("hidden");
    els.shutter.classList.remove("hidden");
  }catch(e){
    console.warn(e);
    els.video.classList.add("hidden");
    els.placeholder.classList.remove("hidden");
    els.error.textContent="Não consegui abrir a câmera dentro do site. Confira a permissão da câmera ou use a câmera do celular.";
    els.error.classList.remove("hidden");
    els.nativeCamera.classList.remove("hidden");
  }
}

els.startCamera.onclick=startCamera;
els.switchCamera.onclick=async()=>{
  state.facing=state.facing==="user"?"environment":"user";
  await startCamera();
};
els.nativeCamera.onclick=()=>{
  els.cameraInput.value="";
  els.cameraInput.click();
};
els.chooseGallery.onclick=()=>{
  els.fileInput.value="";
  els.fileInput.click();
};

function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onload=()=>resolve(String(r.result));
    r.onerror=reject;
    r.readAsDataURL(file);
  });
}

async function chooseFiles(fileList){
  const files=[...fileList].filter(f=>f.type.startsWith("image/"));
  if(!files.length)return;
  stopCamera();
  state.sources=await Promise.all(files.map(async file=>({
    name:file.name||"foto",
    dataUrl:await fileToDataURL(file)
  })));
  state.sourceIndex=0;
  state.sourceType="image";
  renderSelectedStrip();
  loadCurrentSource();
}

function renderSelectedStrip(){
  const many=state.sources.length>1;
  els.selectedStrip.classList.toggle("hidden",!many);
  els.selectedStrip.innerHTML="";
  if(!many)return;
  state.sources.forEach((s,i)=>{
    const b=document.createElement("button");
    b.type="button";
    b.className="selected-thumb"+(i===state.sourceIndex?" active":"");
    b.innerHTML='<img src="'+s.dataUrl+'" alt="Foto '+(i+1)+'">';
    b.onclick=()=>{
      state.sourceIndex=i;
      renderSelectedStrip();
      loadCurrentSource();
    };
    els.selectedStrip.appendChild(b);
  });
}

function loadCurrentSource(){
  const item=state.sources[state.sourceIndex];
  if(!item)return;
  els.sourcePhoto.onload=()=>{
    els.sourcePhoto.classList.remove("hidden");
    els.video.classList.add("hidden");
    els.placeholder.classList.add("hidden");
    els.switchCamera.classList.add("hidden");
    els.shutter.classList.remove("hidden");
    els.error.classList.add("hidden");
  };
  els.sourcePhoto.src=item.dataUrl;
}

els.fileInput.onchange=e=>chooseFiles(e.target.files||[]);
els.cameraInput.onchange=e=>chooseFiles(e.target.files||[]);

function drawCover(ctx,media,w,h,mirror=false){
  const sw=media.videoWidth||media.naturalWidth;
  const sh=media.videoHeight||media.naturalHeight;
  const scale=Math.max(w/sw,h/sh);
  const dw=sw*scale,dh=sh*scale;
  ctx.save();
  if(mirror){ctx.translate(w,0);ctx.scale(-1,1)}
  ctx.drawImage(media,(w-dw)/2,(h-dh)/2,dw,dh);
  ctx.restore();
}

async function loadImage(src){
  const im=new Image();
  im.src=src;
  await im.decode();
  return im;
}

function drawFrameCorners(ctx,image,w,h){
  const sw=image.naturalWidth,sh=image.naturalHeight;
  const halfW=sw/2,halfH=sh/2;
  const cornerW=w*.35,cornerH=h*.35;
  ctx.drawImage(image,0,0,halfW,halfH,0,0,cornerW,cornerH);
  ctx.drawImage(image,halfW,0,halfW,halfH,w-cornerW,0,cornerW,cornerH);
  ctx.drawImage(image,0,halfH,halfW,halfH,0,h-cornerH,cornerW,cornerH);
  ctx.drawImage(image,halfW,halfH,halfW,halfH,w-cornerW,h-cornerH,cornerW,cornerH);
}

function drawBottomGroup(ctx,image,w,h,index){
  const sw=image.naturalWidth,sh=image.naturalHeight;
  const topW=w*.35,topH=h*.30;

  // Folhagens superiores menores, sempre encostadas nos cantos.
  ctx.drawImage(image,0,0,sw/2,sh*.42,0,0,topW,topH);
  ctx.drawImage(image,sw/2,0,sw/2,sh*.42,w-topW,0,topW,topH);

  // Personagens permanecem inteiros e centralizados na base.
  const sourceY=sh*.36;
  const groupWidth=index===6?w*.66:w*.72;
  const groupHeight=(sh-sourceY)*(groupWidth/sw);
  ctx.drawImage(image,0,sourceY,sw,sh-sourceY,(w-groupWidth)/2,h-groupHeight,groupWidth,groupHeight);
}

function drawBalancedFrame(ctx,image,w,h,index){
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality="high";
  if(index===1||index===6) drawBottomGroup(ctx,image,w,h,index);
  else drawFrameCorners(ctx,image,w,h);
  ctx.restore();
}

async function drawBranding(ctx,w){
  if(!frames[state.frame][1])return;
  const logo=await loadImage("/assets/apolo-lettering.png");
  const y=24;

  ctx.save();
  ctx.textAlign="center";

  // SAFÁRI DO — relevo claro + sombra marrom
  ctx.font="800 25px Georgia";
  ctx.fillStyle="#79574c";
  ctx.shadowColor="rgba(255,255,255,.98)";
  ctx.shadowBlur=2;
  ctx.shadowOffsetX=-2;
  ctx.shadowOffsetY=-2;
  ctx.fillText("SAFÁRI DO",w/2,y+28);
  ctx.shadowColor="rgba(112,78,66,.55)";
  ctx.shadowBlur=2;
  ctx.shadowOffsetX=2;
  ctx.shadowOffsetY=3;
  ctx.fillText("SAFÁRI DO",w/2,y+28);

  // Apolo — lettering original verde com relevo suave
  ctx.shadowColor="rgba(255,255,255,.62)";
  ctx.shadowBlur=1;
  ctx.shadowOffsetX=-1;
  ctx.shadowOffsetY=-1;
  ctx.drawImage(logo,w/2-112,y+34,224,82);
  ctx.shadowColor="rgba(66,80,40,.25)";
  ctx.shadowBlur=3;
  ctx.shadowOffsetX=2;
  ctx.shadowOffsetY=3;
  ctx.drawImage(logo,w/2-112,y+34,224,82);

  // Data — mesmo relevo do título
  ctx.font="800 22px Georgia";
  ctx.fillStyle="#79574c";
  ctx.shadowColor="rgba(255,255,255,.98)";
  ctx.shadowBlur=2;
  ctx.shadowOffsetX=-2;
  ctx.shadowOffsetY=-2;
  ctx.fillText("14 • 11 • 2026",w/2,y+138);
  ctx.shadowColor="rgba(112,78,66,.55)";
  ctx.shadowBlur=2;
  ctx.shadowOffsetX=2;
  ctx.shadowOffsetY=3;
  ctx.fillText("14 • 11 • 2026",w/2,y+138);

  ctx.restore();
}
async function composeMedia(media,mirror=false){
  const w=1122,h=1402;
  const canvas=document.createElement("canvas");
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext("2d");
  drawCover(ctx,media,w,h,mirror);
  const frameSrc=frames[state.frame][1];
  if(frameSrc){
    const frame=await getFrameImage(frameSrc);
    drawBalancedFrame(ctx,frame,w,h,state.frame);
    await drawBranding(ctx,w);
  }
  return canvas.toDataURL("image/jpeg",.92);
}

async function composeCurrent(){
  if(state.sourceType==="camera"){
    if(!els.video.videoWidth)throw new Error("A câmera ainda está iniciando");
    return composeMedia(els.video,state.facing==="user");
  }
  if(state.sourceType==="image") return composeMedia(els.sourcePhoto,false);
  throw new Error("Abra a câmera ou escolha uma foto primeiro");
}

async function capture(){
  try{
    if(state.sourceType==="camera"){
      for(const n of [3,2,1]){
        els.countdown.textContent=n;
        els.countdown.classList.remove("hidden");
        await new Promise(r=>setTimeout(r,520));
      }
      els.countdown.classList.add("hidden");
    }
    state.result=await composeCurrent();
    stopCamera();
    els.resultImage.src=state.result;
    els.resultSection.classList.remove("hidden");
    els.resultSection.scrollIntoView({behavior:"smooth",block:"start"});
    prepareBatchButtons();
  }catch(e){
    els.error.textContent=e.message||"Não foi possível criar a foto.";
    els.error.classList.remove("hidden");
  }
}
els.shutter.onclick=capture;

async function saveDataUrl(dataUrl,name="safari-do-apolo.jpg"){
  const a=document.createElement("a");
  a.href=dataUrl;a.download=name;a.click();
}
els.saveBtn.onclick=()=>state.result&&saveDataUrl(state.result);

async function nativeShareDataUrl(dataUrl){
  const blob=await (await fetch(dataUrl)).blob();
  const file=new File([blob],"safari-do-apolo.jpg",{type:"image/jpeg"});
  if(navigator.share&&navigator.canShare?.({files:[file]})){
    await navigator.share({
      files:[file],
      title:"Safari do Apolo",
      text:"Uma lembrança da primeira volta ao sol do Apolo!"
    });
    return true;
  }
  return false;
}
els.shareBtn.onclick=async()=>{
  if(!state.result)return;
  const ok=await nativeShareDataUrl(state.result);
  if(!ok)saveDataUrl(state.result);
};

async function postPhoto(dataUrl){
  const r=await fetch("/api/photos",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({dataUrl})
  });
  const j=await r.json();
  if(!r.ok)throw new Error(j.error||"Erro ao publicar");
  return j;
}

els.publishBtn.onclick=async()=>{
  if(!state.result)return;
  els.publishBtn.disabled=true;
  els.publishStatus.textContent="Publicando…";
  try{
    await postPhoto(state.result);
    els.publishStatus.textContent="Sua lembrança foi adicionada à galeria! 🌿";
    updateGalleryCount();
  }catch(e){
    els.publishStatus.textContent=e.message||"Não foi possível publicar.";
  }finally{
    els.publishBtn.disabled=false;
  }
};

els.againBtn.onclick=()=>{
  state.result=null;
  els.resultSection.classList.add("hidden");
  els.publishStatus.textContent="";
  showPlaceholder();
  window.scrollTo({top:0,behavior:"smooth"});
};

function prepareBatchButtons(){
  $$(".batch-action").forEach(x=>x.remove());
  if(state.sources.length<=1)return;

  const saveAll=document.createElement("button");
  saveAll.className="soft-action batch-action";
  saveAll.textContent="Salvar todas";
  saveAll.onclick=saveAllSelected;

  const publishAll=document.createElement("button");
  publishAll.className="soft-action batch-action";
  publishAll.textContent="Adicionar todas à galeria";
  publishAll.onclick=publishAllSelected;

  els.resultSection.querySelector(".result-actions").append(saveAll,publishAll);
}

async function composeSource(dataUrl){
  const im=await loadImage(dataUrl);
  return composeMedia(im,false);
}

async function saveAllSelected(){
  try{
    const {default:JSZip}=await import("https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm");
    const zip=new JSZip();
    for(let i=0;i<state.sources.length;i++){
      const out=await composeSource(state.sources[i].dataUrl);
      zip.file("safari-apolo-"+String(i+1).padStart(2,"0")+".jpg",out.split(",")[1],{base64:true});
    }
    const blob=await zip.generateAsync({type:"blob"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;a.download="fotos-safari-do-apolo.zip";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }catch(e){console.warn(e)}
}

async function publishAllSelected(){
  els.publishStatus.textContent="Publicando as fotos…";
  try{
    for(let i=0;i<state.sources.length;i++){
      const out=await composeSource(state.sources[i].dataUrl);
      await postPhoto(out);
      els.publishStatus.textContent="Publicando "+(i+1)+" de "+state.sources.length+"…";
    }
    els.publishStatus.textContent="Todas foram adicionadas à galeria! 🌿";
    updateGalleryCount();
  }catch(e){
    els.publishStatus.textContent="Não foi possível publicar todas as fotos.";
  }
}

/* GALERIA */
async function updateGalleryCount(){
  try{
    const r=await fetch("/api/photos");
    const j=await r.json();
    els.galleryCount.textContent=j.photos?.length?"("+j.photos.length+")":"";
  }catch{}
}

async function galleryFile(p){
  const r=await fetch("/api/photos/"+p.id+"/image");
  if(!r.ok)throw new Error("Não foi possível carregar a foto");
  const blob=await r.blob();
  return new File([blob],"safari-do-apolo.jpg",{type:blob.type||"image/jpeg"});
}

async function saveGalleryPhoto(p){
  const file=await galleryFile(p);
  const url=URL.createObjectURL(file);
  const a=document.createElement("a");
  a.href=url;a.download=file.name;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}

async function shareGalleryPhoto(p){
  const file=await galleryFile(p);
  if(navigator.share&&navigator.canShare?.({files:[file]})){
    await navigator.share({
      files:[file],
      title:"Safari do Apolo",
      text:"Uma lembrança da primeira volta ao sol do Apolo!"
    });
    return;
  }
  const shareUrl=location.origin+"/share/photo/"+p.id;
  try{
    await navigator.clipboard.writeText(shareUrl);
    alert("Link da foto copiado.");
  }catch{
    location.href=shareUrl;
  }
}

function galleryAction(label,cls,fn){
  const b=document.createElement("button");
  b.type="button";b.className="gallery-action "+(cls||"");b.textContent=label;
  b.onclick=async(e)=>{
    e.stopPropagation();b.disabled=true;
    try{await fn()}finally{b.disabled=false}
  };
  return b;
}

async function loadGallery(){
  const r=await fetch("/api/photos");
  const j=await r.json();
  state.galleryAdmin=!!j.admin;
  els.galleryGrid.innerHTML="";
  els.galleryEmpty.classList.toggle("hidden",j.photos.length>0);
  els.galleryCount.textContent=j.photos.length?"("+j.photos.length+")":"";

  for(const p of j.photos){
    const card=document.createElement("article");
    card.className="gallery-item"+(p.hidden?" hidden-photo":"");

    const photo=document.createElement("button");
    photo.type="button";
    photo.className="gallery-photo-button";
    photo.innerHTML='<img loading="lazy" src="/api/photos/'+p.id+'/image" alt="Memória do Safari do Apolo">';
    photo.onclick=()=>openPhoto(p);
    card.appendChild(photo);

    if(state.galleryAdmin){
      const badge=document.createElement("span");
      badge.className="gallery-admin-badge";
      badge.textContent=p.hidden?"Oculta":"Visível";
      card.appendChild(badge);
    }

    const actions=document.createElement("div");
    actions.className="gallery-actions";
    actions.append(
      galleryAction("Salvar","",()=>saveGalleryPhoto(p)),
      galleryAction("Compartilhar","share-main",()=>shareGalleryPhoto(p))
    );
    card.appendChild(actions);

    if(state.galleryAdmin){
      const admin=document.createElement("div");
      admin.className="gallery-admin-actions";
      admin.append(
        galleryAction(p.hidden?"Mostrar":"Ocultar","",()=>togglePhoto(p)),
        galleryAction("Excluir","",()=>deletePhoto(p))
      );
      card.appendChild(admin);
    }
    els.galleryGrid.appendChild(card);
  }
  $("#adminEntry").textContent=state.galleryAdmin?"Administração ativa":"Administrar galeria";
}

async function togglePhoto(p){
  await fetch("/api/photos/"+p.id,{
    method:"PATCH",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({hidden:!p.hidden})
  });
  await loadGallery();
}
async function deletePhoto(p){
  if(!confirm("Excluir esta foto da galeria?"))return;
  await fetch("/api/photos/"+p.id,{method:"DELETE"});
  await loadGallery();
}

function openPhoto(p){
  state.modalPhoto=p;
  $("#modalPhoto").src="/api/photos/"+p.id+"/image";
  $("#modalDownload").href="/api/photos/"+p.id+"/image";
  $("#modalHide").classList.toggle("hidden",!state.galleryAdmin);
  $("#modalDelete").classList.toggle("hidden",!state.galleryAdmin);
  $("#modalHide").textContent=p.hidden?"Mostrar":"Ocultar";
  $("#photoModal").classList.remove("hidden");
}
$("#closePhotoModal").onclick=()=>$("#photoModal").classList.add("hidden");
$("#modalShare").onclick=()=>state.modalPhoto&&shareGalleryPhoto(state.modalPhoto);
$("#modalHide").onclick=async()=>{
  if(!state.modalPhoto)return;
  await togglePhoto(state.modalPhoto);
  $("#photoModal").classList.add("hidden");
};
$("#modalDelete").onclick=async()=>{
  if(!state.modalPhoto)return;
  await deletePhoto(state.modalPhoto);
  $("#photoModal").classList.add("hidden");
};

/* ADMIN */
let adminSetupRequired=false;
async function openAdmin(){
  const s=await (await fetch("/api/session")).json();
  adminSetupRequired=!!s.setupRequired;
  $("#loginModal").classList.remove("hidden");
  $("#adminEmail").value=s.adminEmail||"";
  $("#adminEmail").readOnly=!!s.adminEmail;
  $("#logoutBtn").classList.toggle("hidden",!s.admin);
  $("#loginBtn").classList.toggle("hidden",s.admin);
  $("#loginBtn").textContent=adminSetupRequired?"Criar minha senha":"Entrar";
  $("#loginHint").textContent=s.admin
    ?"Você está logada como administradora."
    : adminSetupRequired
      ?"Primeiro acesso: crie sua senha de administradora."
      :"Entre com sua senha de administradora.";
  $("#loginStatus").textContent="";
}
$("#topAdminBtn").onclick=openAdmin;
$("#adminEntry").onclick=openAdmin;
$("#closeLogin").onclick=()=>$("#loginModal").classList.add("hidden");
$("#loginBtn").onclick=async()=>{
  const endpoint=adminSetupRequired?"/api/setup-admin":"/api/login";
  const r=await fetch(endpoint,{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      email:$("#adminEmail").value,
      password:$("#adminPassword").value
    })
  });
  const j=await r.json();
  if(!r.ok){
    $("#loginStatus").textContent=j.error||"Não foi possível entrar.";
    return;
  }
  adminSetupRequired=false;
  $("#loginStatus").textContent="Login realizado.";
  $("#loginBtn").classList.add("hidden");
  $("#logoutBtn").classList.remove("hidden");
  loadGallery();
};
$("#logoutBtn").onclick=async()=>{
  await fetch("/api/logout",{method:"POST"});
  $("#loginModal").classList.add("hidden");
  loadGallery();
};

renderFrames();
syncFrame();
showPlaceholder();
updateGalleryCount();
setTimeout(()=>{
  if(document.visibilityState==="visible" && !state.stream && state.sourceType!=="image"){
    startCamera().catch(()=>{});
  }
},300);
