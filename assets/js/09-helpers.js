//  HELPERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function escH(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escT(s){ return escH(s); }

function fmtTextHTML(s){
  return escH(s).replace(/\n/g,'<br>');
}

function wrapTextLines(text, maxWidth, measure){
  const parts=String(text||'').split('\n');
  const lines=[];
  parts.forEach(part=>{
    if(!part.trim()){
      lines.push('');
      return;
    }
    const words=part.split(/\s+/);
    let line='';
    words.forEach(word=>{
      const test=line?line+' '+word:word;
      if(line && measure(test)>maxWidth){
        lines.push(line);
        line=word;
      } else {
        line=test;
      }
    });
    lines.push(line);
  });
  return lines;
}

function measureCanvasText(ctx, text, maxWidth, font, lineHeight){
  if(!text) return 0;
  ctx.save();
  ctx.font=font;
  const lines=wrapTextLines(text, maxWidth, t=>ctx.measureText(t).width);
  ctx.restore();
  return lines.length*lineHeight;
}

function getCanvasTextRenderScale(font){
  const match=String(font||'').match(/(\d+(?:\.\d+)?)px/);
  const size=match?Number(match[1]):16;
  if(size<=12) return 9;
  if(size<=14) return 8;
  if(size<=18) return 7;
  if(size<=24) return 6;
  return 5;
}

function scaleCanvasFont(font, scale){
  return String(font||'').replace(/(\d+(?:\.\d+)?)px/, (_,n)=>`${Math.max(1, Number(n)*scale)}px`);
}

function buildCanvasTextBitmap(text, maxWidth, font, lineHeight, color){
  if(!text) return null;
  const scale=getCanvasTextRenderScale(font);
  const scaledFont=scaleCanvasFont(font, scale);
  const scaledLineHeight=Math.max(1, lineHeight*scale);
  const probe=document.createElement('canvas');
  const pctx=probe.getContext('2d');
  pctx.font=scaledFont;
  pctx.textBaseline='top';
  const lines=wrapTextLines(text, Math.max(1, maxWidth*scale), t=>pctx.measureText(t).width);
  const pad=Math.max(10, Math.ceil(scale*3));
  const maxLineWidth=lines.reduce((m,line)=>Math.max(m, pctx.measureText(line||' ').width), 0);
  const width=Math.max(1, Math.ceil(maxLineWidth + pad*2));
  const height=Math.max(1, Math.ceil(lines.length*scaledLineHeight + pad*2));
  const off=document.createElement('canvas');
  off.width=width;
  off.height=height;
  const octx=off.getContext('2d');
  octx.clearRect(0,0,width,height);
  octx.font=scaledFont;
  octx.fillStyle=color || '#000';
  octx.textBaseline='top';
  octx.textRendering='geometricPrecision';
  octx.lineJoin='round';
  octx.lineCap='round';
  lines.forEach((line,idx)=>{
    const yy=pad + idx*scaledLineHeight;
    octx.fillText(line, pad, yy);
  });
  // Preserve the browser's high-DPI anti-aliasing. Outlining and posterizing
  // this bitmap produces noisy halos when it is reduced to the display size.
  return { canvas:off, scale, pad, lines };
}

function drawCanvasText(ctx, text, x, y, maxWidth, font, lineHeight, color){
  if(!text) return 0;
  const bitmap=buildCanvasTextBitmap(text, maxWidth, font, lineHeight, color);
  if(!bitmap) return 0;
  const destX=x-(bitmap.pad/bitmap.scale);
  const destY=y-(bitmap.pad/bitmap.scale);
  const destW=bitmap.canvas.width/bitmap.scale;
  const destH=bitmap.canvas.height/bitmap.scale;
  ctx.save();
  ctx.imageSmoothingEnabled=true;
  if('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality='high';
  ctx.drawImage(bitmap.canvas, destX, destY, destW, destH);
  ctx.restore();
  return bitmap.lines.length*lineHeight;
}

// A paper is released only after its lightweight viewer assets and the active
// editor have reached a terminal state. Full Hallmark export rasters stay
// encoded in the bank and are not decoded here, which keeps large banks sane.
let paperPreparationGeneration=0;
let paperPreparationHardTimer=null;
let paperPreparationActive=false;

function paperPreparationDelay(ms){
  return new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(ms)||0)));
}

function paperPreparationFrame(timeoutMs=280){
  return new Promise(resolve=>{
    let settled=false;
    let timer=null;
    const finish=()=>{
      if(settled) return;
      settled=true;
      if(timer) clearTimeout(timer);
      resolve();
    };
    timer=setTimeout(finish,Math.max(80,Number(timeoutMs)||280));
    try{
      if(typeof window.requestAnimationFrame==='function') window.requestAnimationFrame(finish);
      else setTimeout(finish,16);
    }catch(_){ finish(); }
  });
}

function paperPreparationTimeout(promise, timeoutMs, fallback=false){
  return new Promise(resolve=>{
    let settled=false;
    const finish=value=>{
      if(settled) return;
      settled=true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer=setTimeout(()=>finish(fallback),Math.max(100,Number(timeoutMs)||1000));
    Promise.resolve(promise).then(finish,()=>finish(fallback));
  });
}

function updatePaperPreparation(token, detail, progress, foot=''){
  if(token!==paperPreparationGeneration || !paperPreparationActive) return false;
  const detailEl=document.getElementById('paperLoadDetail');
  const progressEl=document.getElementById('paperLoadProgress');
  const footEl=document.getElementById('paperLoadFoot');
  if(detailEl && detail) detailEl.textContent=detail;
  if(progressEl && Number.isFinite(Number(progress))) progressEl.style.width=Math.max(4,Math.min(100,Number(progress)))+'%';
  if(footEl && foot) footEl.textContent=foot;
  const state=window.__paperPreparationState||{};
  window.__paperPreparationState={...state,token,active:true,detail:detail||state.detail||'',progress:Number(progress)||state.progress||0};
  return true;
}

function beginPaperPreparation(options={}){
  const token=++paperPreparationGeneration;
  paperPreparationActive=true;
  const overlay=document.getElementById('paperLoadOverlay');
  const title=document.getElementById('paperLoadTitle');
  const shell=document.querySelector('.shell');
  if(paperPreparationHardTimer) clearTimeout(paperPreparationHardTimer);
  document.body.classList.add('paper-preparing');
  document.body.setAttribute('aria-busy','true');
  if(shell){
    shell.setAttribute('inert','');
    shell.setAttribute('aria-busy','true');
  }
  if(overlay){
    overlay.classList.add('is-active');
    overlay.setAttribute('aria-hidden','false');
    overlay.setAttribute('aria-busy','true');
  }
  if(title) title.textContent=options.title||'Preparing your question paper';
  updatePaperPreparation(
    token,
    options.detail||'Loading fonts, equations, canvas ink, and paper previews...',
    7,
    options.foot||'Please wait—the paper will open when it is ready to scroll.'
  );
  const hardTimeout=Math.max(4000,Number(options.hardTimeoutMs)||18000);
  paperPreparationHardTimer=setTimeout(()=>{
    finishPaperPreparation(token,{timedOut:true,failed:0,reason:options.reason||'hard-timeout'});
  },hardTimeout+1200);
  window.__paperPreparationState={token,active:true,reason:options.reason||'workspace',startedAt:Date.now(),progress:7};
  return token;
}

async function finishPaperPreparation(token, report={}){
  if(token!==paperPreparationGeneration || !paperPreparationActive) return false;
  paperPreparationActive=false;
  if(paperPreparationHardTimer){ clearTimeout(paperPreparationHardTimer); paperPreparationHardTimer=null; }
  const failed=Math.max(0,Number(report.failed)||0);
  const timedOut=!!report.timedOut;
  const readyDetail=timedOut
    ? 'Paper opened safely. A slow resource may finish in the background.'
    : (failed ? `Paper ready. ${failed} unavailable preview resource${failed===1?' was':'s were'} skipped.` : 'Paper ready—canvas ink and previews are prepared.');
  const state=window.__paperPreparationState||{};
  window.__paperPreparationState={...state,active:true,releasing:true,progress:100,failed,timedOut,completedAt:Date.now(),reason:report.reason||state.reason||'workspace'};
  const detailEl=document.getElementById('paperLoadDetail');
  const progressEl=document.getElementById('paperLoadProgress');
  const footEl=document.getElementById('paperLoadFoot');
  if(detailEl) detailEl.textContent=readyDetail;
  if(progressEl) progressEl.style.width='100%';
  if(footEl) footEl.textContent='Ready';
  await paperPreparationDelay(140);
  if(token!==paperPreparationGeneration) return false;
  const overlay=document.getElementById('paperLoadOverlay');
  const shell=document.querySelector('.shell');
  if(overlay){
    overlay.classList.remove('is-active');
    overlay.setAttribute('aria-hidden','true');
    overlay.setAttribute('aria-busy','false');
  }
  document.body.classList.remove('paper-preparing');
  document.body.setAttribute('aria-busy','false');
  if(shell){
    shell.removeAttribute('inert');
    shell.setAttribute('aria-busy','false');
  }
  window.__paperPreparationState={...window.__paperPreparationState,active:false,releasing:false,releasedAt:Date.now()};
  return true;
}

async function warmPaperFonts(){
  if(!document.fonts) return true;
  const jobs=[];
  if(document.fonts.ready) jobs.push(document.fonts.ready);
  if(typeof document.fonts.load==='function'){
    ['16px "Times New Roman"','16px "Cambria Math"','16px "KaTeX_Main"','16px "KaTeX_Math"'].forEach(font=>jobs.push(document.fonts.load(font)));
  }
  await paperPreparationTimeout(Promise.allSettled(jobs),4500,[]);
  return true;
}

async function waitForWorkspaceGlobal(name, timeoutMs=3500){
  const started=Date.now();
  while(!window[name] && Date.now()-started<timeoutMs) await paperPreparationDelay(60);
  return !!window[name];
}

async function settleWorkspaceImages(selector, timeoutMs=4500){
  const images=[...document.querySelectorAll(selector)];
  if(!images.length) return {total:0,loaded:0,failed:0};
  const results=await Promise.all(images.map(img=>paperPreparationTimeout(new Promise(resolve=>{
    const decode=async ok=>{
      if(ok && typeof img.decode==='function'){
        try{ await paperPreparationTimeout(img.decode(),1600,true); }catch(_){ }
      }
      resolve(ok);
    };
    if(img.complete){ decode(img.naturalWidth>0); return; }
    img.addEventListener('load',()=>decode(true),{once:true});
    img.addEventListener('error',()=>decode(false),{once:true});
  }),timeoutMs,false)));
  return {total:images.length,loaded:results.filter(Boolean).length,failed:results.filter(value=>!value).length};
}

async function waitForStablePaperLayout(){
  const scroll=document.getElementById('paperScroll');
  const sheet=document.getElementById('paperSheet');
  const oldScrollTop=scroll?.scrollTop||0;
  let stableFrames=0;
  let previous=-1;
  for(let i=0;i<8 && stableFrames<2;i++){
    await paperPreparationFrame();
    const height=Math.round(sheet?.getBoundingClientRect?.().height||sheet?.offsetHeight||0);
    if(height===previous) stableFrames++;
    else stableFrames=0;
    previous=height;
  }
  if(scroll) scroll.scrollTop=Math.min(oldScrollTop,Math.max(0,scroll.scrollHeight-scroll.clientHeight));
  await new Promise(resolve=>{
    let settled=false;
    const finish=()=>{
      if(settled) return;
      settled=true;
      clearTimeout(fallback);
      resolve();
    };
    const fallback=setTimeout(finish,260);
    if('requestIdleCallback' in window) requestIdleCallback(finish,{timeout:180});
    else setTimeout(finish,40);
  });
}

async function preparePaperWorkspace(options={}){
  const token=options.token||beginPaperPreparation(options);
  const startedAt=Date.now();
  const minVisibleMs=Math.max(250,Number(options.minVisibleMs)||650);
  const hardTimeoutMs=Math.max(3500,Number(options.hardTimeoutMs)||16000);
  let failed=0;
  let timedOut=false;
  const work=(async ()=>{
    await paperPreparationFrame();
    updatePaperPreparation(token,'Building the complete paper preview...',16);
    if(typeof renderPaper==='function') renderPaper(true);

    const fontJob=warmPaperFonts();
    const katexJob=waitForWorkspaceGlobal('katex',3000);
    const mathJob=(typeof waitForMathJaxReady==='function')
      ? paperPreparationTimeout(waitForMathJaxReady(6000),6500,false)
      : Promise.resolve(true);

    updatePaperPreparation(token,'Restoring Hallmark canvas ink and editable figures...',34);
    if(typeof waitForEditorCanvasReady==='function') await waitForEditorCanvasReady(9000);
    if(typeof waitForCanvasResourceTasks==='function'){
      const canvasReady=await waitForCanvasResourceTasks(9000);
      if(!canvasReady) failed++;
    }

    updatePaperPreparation(token,'Preloading every paper preview for smooth scrolling...',62);
    if(typeof renderPaper==='function') renderPaper(true);
    if(typeof hydratePaperLazyImages==='function'){
      const paperImages=await hydratePaperLazyImages({eager:true});
      failed+=Number(paperImages?.failed)||0;
    }

    updatePaperPreparation(token,'Settling fonts, equations, and active editor media...',82);
    const resourceResults=await Promise.all([fontJob,katexJob,mathJob]);
    if(resourceResults[1]===false) failed++;
    if(resourceResults[2]===false) failed++;
    const editorImages=await settleWorkspaceImages('#editor img',4200);
    failed+=editorImages.failed;

    updatePaperPreparation(token,'Finalizing paper layout...',94);
    await waitForStablePaperLayout();
    return true;
  })();
  const completed=await paperPreparationTimeout(work,hardTimeoutMs,false);
  timedOut=completed!==true;
  const terminalStage=String(window.__paperPreparationState?.detail||'');
  const remaining=minVisibleMs-(Date.now()-startedAt);
  if(remaining>0) await paperPreparationDelay(remaining);
  await finishPaperPreparation(token,{failed,timedOut,reason:options.reason||'workspace'});
  return {token,failed,timedOut,terminalStage,durationMs:Date.now()-startedAt};
}

function imgPDFHeight(dataUrl, maxW, maxH){
  return new Promise((res,rej)=>{
    const img=new Image();
    img.onload=()=>{
      let w=img.width, h=img.height;
      const scale=Math.min(maxW/w, maxH/h, 1);
      res(h*scale);
    };
    img.onerror=rej;
    img.src=dataUrl;
  });
}

function getPDF(){
  const lib=window.jspdf||window.jsPDF;
  if(!lib){showNotice('PDF library is still loading. Wait 1 second and retry.', 'Library Loading');return null;}
  return lib.jsPDF||lib;
}

function dlBlob(data,name,type){
  const rawType=String(type||'application/octet-stream');
  const safeType=/^(?:application\/json|text\/|image\/svg\+xml)\b/i.test(rawType) && !/charset=/i.test(rawType)
    ? rawType+';charset=utf-8'
    : rawType;
  const blob=new Blob([data],{type:safeType});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name; a.click();
}

function escA(s){ return escH(s); }

function toast(msg){
  const t=document.createElement('div');
  t.innerHTML=msg;
  t.style.cssText='position:fixed;bottom:18px;right:18px;background:#1a5fa8;color:#fff;padding:7px 14px;border-radius:4px;font-size:12px;z-index:9999;box-shadow:0 2px 8px rgba(0,0,0,.25);transition:opacity .4s';
  document.body.appendChild(t);
  setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),420);},2400);
}

function openModal({title='Dialog', subtitle='', body='', closable=true}={}){
  const modal=document.getElementById('appModal');
  document.getElementById('appModalTitle').textContent=title;
  document.getElementById('appModalSub').textContent=subtitle;
  document.getElementById('appModalBody').innerHTML=body;
  const closeBtn=document.getElementById('appModalClose');
  closeBtn.style.display=closable?'inline-flex':'none';
  closeBtn.onclick=()=>{ if(closable) closeModal(); };
  modal.classList.remove('hidden');
}

function closeModal(){
  document.getElementById('appModal').classList.add('hidden');
}

function showNotice(message, title='Notice'){
  openModal({
    title,
    subtitle:'',
    closable:true,
    body:`
      <div class="modal-note">${escH(message)}</div>
      <div class="modal-actions">
        <button class="btn pri" type="button" onclick="closeModal()">OK</button>
      </div>
    `
  });
}


let exportProgressCloseTimer=null;
let exportJobRunning=false;

function showExportProgress(title='Export', message='Call registered. Working on it...'){
  if(exportProgressCloseTimer){ clearTimeout(exportProgressCloseTimer); exportProgressCloseTimer=null; }
  openModal({
    title,
    subtitle:'Export request received',
    closable:false,
    body:`
      <div id="exportProgressBox" class="export-progress-box">
        <div class="export-spinner" aria-hidden="true"></div>
        <div class="export-progress-copy">
          <div class="export-progress-title">Call registered</div>
          <div id="exportProgressMessage" class="export-progress-message">${escH(message)}</div>
        </div>
      </div>
      <div class="export-progress-bar"><span id="exportProgressFill"></span></div>
      <div class="modal-actions export-progress-actions">
        <button class="btn pri export-buffer-btn" type="button" disabled>
          <span class="export-mini-spinner" aria-hidden="true"></span>
          Buffering...
        </button>
      </div>
    `
  });
  requestAnimationFrame(()=>{
    const fill=document.getElementById('exportProgressFill');
    if(fill) fill.classList.add('running');
  });
}

function updateExportProgress(message){
  const msg=document.getElementById('exportProgressMessage');
  if(msg) msg.textContent=message;
}

function closeExportProgressSoon(message='Download request sent.'){
  if(!document.getElementById('exportProgressBox')) return;
  updateExportProgress(message);
  const btn=document.querySelector('.export-buffer-btn');
  if(btn) btn.textContent='Ready';
  exportProgressCloseTimer=setTimeout(()=>{
    exportProgressCloseTimer=null;
    if(document.getElementById('exportProgressBox')) closeModal();
  }, 850);
}

async function runExportJob(label='Export', job, opts={}){
  if(exportJobRunning){
    toast('Export is already running. Please wait for it to finish.');
    return;
  }
  if(typeof job!=='function'){
    showNotice('Export action is not available yet. Refresh once and retry.', label);
    return;
  }
  exportJobRunning=true;
  showExportProgress(label, opts.message || 'Call registered. Preparing export files...');
  await new Promise(resolve=>setTimeout(resolve, 70));
  updateExportProgress(opts.working || 'Working on the export. Please wait...');
  try{
    const result=await job();
    closeExportProgressSoon(opts.done || 'Download request sent.');
    return result;
  }catch(err){
    console.error(err);
    if(document.getElementById('exportProgressBox')) closeModal();
    showNotice(err?.message || 'Export failed before download.', label);
  }finally{
    exportJobRunning=false;
  }
}
function askConfirm(message, onYes){
  const destructive = /delete|remove|clear|fresh|discard|abort/i.test(String(message || ''));
  openModal({
    title:'Please Confirm',
    subtitle:'',
    closable:true,
    body:`
      <div class="confirm-box">
        <div class="confirm-icon">${destructive ? '!' : '?'}</div>
        <div class="confirm-copy">
          <div class="confirm-title">${destructive ? 'Careful, this can remove work' : 'Please confirm this action'}</div>
          <div class="confirm-message">${escH(message)}</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn ${destructive ? 'del' : 'pri'}" type="button" id="confirmYesBtn">${destructive ? 'Yes, continue' : 'Confirm'}</button>
        <button class="btn" type="button" onclick="closeModal()">Cancel</button>
      </div>
    `
  });
  const yes=document.getElementById('confirmYesBtn');
  if(yes) yes.onclick=()=>{ closeModal(); onYes?.(); };
}

function renderProjectRows(){
  if(!projectIndex.length) return '<div class="modal-note">No saved projects yet.</div>';
  return `<div class="project-list">` + projectIndex.map(p=>`
    <div class="project-item">
      <div class="project-meta">
        <div class="project-name">${escH(p.examName)}</div>
        <div class="project-sub">Updated ${new Date(p.updatedAt).toLocaleString()}</div>
      </div>
      <div class="project-actions">
        <button class="btn" type="button" onclick="openExistingProject('${escA(p.id)}')">Open</button>
      </div>
    </div>
  `).join('') + `</div>`;
}

function showProjectLauncher(){
  syncProjectIndex();
  openModal({
    title:'Project Launcher',
    subtitle:'Create a new question bank or open an existing one. You cannot continue without a bank name.',
    closable:false,
    body:`
      <div class="modal-grid">
        <div class="field" style="grid-column:1/-1">
          <label>Project Name</label>
          <input id="projectExamNameInput" type="text" value="" placeholder="e.g. Electronics Practice Bank 01">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn pri" type="button" onclick="createProjectFromLauncher()">Create New Bank</button>
      </div>
      <div class="sec-lbl">Open Project</div>
      ${renderProjectRows()}
    `
  });
  const input=document.getElementById('projectExamNameInput');
  if(input) input.focus();
}

function createProjectFromLauncher(){
  const name=String(document.getElementById('projectExamNameInput')?.value || '').trim();
  if(!name){
    toast('Project name is required before you can continue');
    return;
  }
  createProjectState(name);
  closeModal();
  renderSidebar();
  renderEditor();
  renderPaper();
  showNotice('Project created successfully.', 'Success');
}

function openExistingProject(id){
  if(!loadProjectState(id)){
    toast('That project could not be opened');
    return;
  }
  closeModal();
  renderSidebar();
  renderEditor();
  renderPaper();
  toast('Project opened');
}

function bootstrapProjectState(){
  syncProjectIndex();
  if(activeProjectId && loadProjectState(activeProjectId)) return;
  if(projectIndex.length || !examName.trim()) showProjectLauncher();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


