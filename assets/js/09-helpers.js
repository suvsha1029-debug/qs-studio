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


