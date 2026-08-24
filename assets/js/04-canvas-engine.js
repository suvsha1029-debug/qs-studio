//  CANVAS ENGINE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const canvasState = {};   // key â†’ { tool, history[], redoStack[] }
const EXPORT_IMAGE_SCALE = 4;

function getBaseCanvasHeight(key){
  return key==='q' ? 90 : 46;
}

function getCanvasHeightForSavedImage(cv, img, key){
  const base=getBaseCanvasHeight(key);
  const srcW=img.naturalWidth||img.width||cv.width||1;
  const srcH=img.naturalHeight||img.height||base;
  const scaledH=Math.max(1, Math.round(srcH * (cv.width / Math.max(1, srcW))));
  const temp=document.createElement('canvas');
  temp.width=cv.width;
  temp.height=scaledH;
  const tctx=temp.getContext('2d', {willReadFrequently:true}) || temp.getContext('2d');
  tctx.fillStyle='#fff';
  tctx.fillRect(0,0,temp.width,temp.height);
  tctx.drawImage(img,0,0,temp.width,temp.height);
  const data=tctx.getImageData(0,0,temp.width,temp.height).data;
  let bottom=0;
  for(let y=temp.height-1; y>=0; y--){
    for(let x=0; x<temp.width; x++){
      const i=(y*temp.width+x)*4;
      const a=data[i+3], r=data[i], g=data[i+1], b=data[i+2];
      if(a>10 && (r<248 || g<248 || b<248)){
        bottom=y+1;
        y=-1;
        break;
      }
    }
  }
  return Math.max(base, Math.min(scaledH, bottom + (key==='q' ? 12 : 8)));
}

function restoreCanvasFromDataUrl(key, dataUrl, afterRestore){
  const cv=document.getElementById(key+'Canvas');
  if(!cv || !dataUrl) return;
  const img=new Image();
  img.onload=()=>{
    // Height from base-image ink content
    let h=getCanvasHeightForSavedImage(cv, img, key);
    // Also ensure canvas is tall enough to show all stored figures
    const figs=getFigureStore(key);
    if(figs.length || getBurnedFigureStore(key).length){
      const figBottom=getAllStoredFigureBottom(key);
      if(figBottom>0) h=Math.max(h, figBottom + (key==='q' ? 14 : 10));
    }
    setCanvasHeightPreserve(key, h);
    const ctx=cv.getContext('2d');
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,cv.width,cv.height);
    ctx.drawImage(img,0,0,cv.width,cv.height);
    if(typeof afterRestore==='function') afterRestore();
  };
  img.src=dataUrl;
}

function restoreCanvasFromComposerHTML(key, html, onFallback){
  const safeHtml=String(html||'').trim();
  if(!safeHtml) return Promise.resolve(false);
  const host=document.createElement('div');
  host.innerHTML=safeHtml;
  return renderMixedComposerCanvas(host, key)
    .then(surface=>applyMixedComposerSurfaceToCanvas(key, surface))
    .then(()=>true)
    .catch(err=>{
      if(typeof onFallback==='function') onFallback(err);
      return false;
    });
}


function getFrameRenderMode(key){
  if(!cur) return 'bitmap';
  if(key==='q') return cur.questionRenderMode || ((cur.questionComposerHTML||'').trim() ? 'source' : 'bitmap');
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    const opt=cur.options[idx];
    return opt?.renderMode || (((opt?.composerHTML)||'').trim() ? 'source' : 'bitmap');
  }
  return 'bitmap';
}

function setFrameRenderMode(key, mode){
  if(!cur) return;
  const clean=mode==='source' ? 'source' : 'bitmap';
  if(key==='q'){
    cur.questionRenderMode=clean;
    return;
  }
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    if(cur.options[idx]) cur.options[idx].renderMode=clean;
  }
}

function setFrameBitmapDirty(key, dirty){
  if(!cur) return;
  if(key==='q'){
    cur.questionBitmapDirty=!!dirty;
    return;
  }
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    if(cur.options[idx]) cur.options[idx].bitmapDirty=!!dirty;
  }
}

function isFrameBitmapDirty(key){
  if(!cur) return false;
  if(key==='q') return !!cur.questionBitmapDirty;
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return !!cur.options[idx]?.bitmapDirty;
  }
  return false;
}

function markFrameAsBitmap(key){
  setFrameRenderMode(key, 'bitmap');
  setFrameBitmapDirty(key, true);
}

function markFrameAsSource(key){
  setFrameRenderMode(key, 'source');
  setFrameBitmapDirty(key, false);
}

function isSourceBackedFrame(key){
  const hasSource=String((typeof getComposerSourceHTML==='function' ? getComposerSourceHTML(key) : '')||'').trim();
  if(!hasSource || typeof getFrameRenderMode!=='function') return false;
  if(getFrameRenderMode(key)==='source') return true;
  return !!(getFrameRenderMode(key)==='bitmap' && getFigureStore(key).length && !isFrameBitmapDirty(key));
}

function ensureSourceBackedFrame(key){
  if(!isSourceBackedFrame(key)) return false;
  markFrameAsSource(key);
  return true;
}

function markFrameAsBitmapUnlessSource(key){
  if(ensureSourceBackedFrame(key)) return;
  markFrameAsBitmap(key);
}

function getImageFitSize(img, maxWidth, maxHeight){
  const srcW = img.naturalWidth || img.width || maxWidth || 1;
  const srcH = img.naturalHeight || img.height || 1;
  const widthCap=Math.max(24, maxWidth || srcW);
  const heightCap=Math.max(24, maxHeight || 1e9);
  const scale=Math.min(widthCap/srcW, heightCap/srcH, 1);
  return {
    drawW: Math.max(1, Math.round(srcW*scale)),
    drawH: Math.max(1, Math.round(srcH*scale))
  };
}

function initCanvas(key){
  const cv = document.getElementById(key+'Canvas');
  if(!cv) return;
  if(!canvasState[key]) canvasState[key] = { tool:'pen', history:[], redo:[] };
  const state = canvasState[key];

  // Fill white background
  const ctx = cv.getContext('2d');
  // Prefer composer HTML source over stored bitmap cache when available.
  const composerHtml = (typeof getComposerSourceHTML==='function') ? String(getComposerSourceHTML(key)||'').trim() : '';
  const stored = getStoredBaseImg(key);
  const renderMode = getFrameRenderMode(key);
  if(renderMode==='source' && composerHtml){
    restoreCanvasFromComposerHTML(key, composerHtml, ()=>{
      if(stored){
        restoreCanvasFromDataUrl(key, stored, ()=>{
          pushHistory(key);
          renderFigureOverlays(key);
        });
      } else {
        ctx.fillStyle='#fff';
        ctx.fillRect(0,0,cv.width,cv.height);
        if(state.history.length===0) pushHistory(key);
        renderFigureOverlays(key);
      }
    });
  } else if(stored){
    restoreCanvasFromDataUrl(key, stored, ()=>{
      pushHistory(key);
      renderFigureOverlays(key);
    });
  } else {
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,cv.width,cv.height);
    if(state.history.length===0) pushHistory(key);
    renderFigureOverlays(key);
  }

  // Size slider
  const sizeEl = document.getElementById(key+'Size');
  const sizeLbl = document.getElementById(key+'SizeLbl');
  if(sizeEl&&sizeLbl) sizeEl.oninput=()=>sizeLbl.textContent=sizeEl.value+'px';

  // Drawing events
  let drawing=false, startX=0, startY=0, snapshot=null;

  function getXY(e){
    const r = cv.getBoundingClientRect();
    const scaleX = cv.width/r.width, scaleY = cv.height/r.height;
    if(e.touches){
      return [(e.touches[0].clientX-r.left)*scaleX,(e.touches[0].clientY-r.top)*scaleY];
    }
    return [(e.clientX-r.left)*scaleX,(e.clientY-r.top)*scaleY];
  }

  function getColor(){ return document.getElementById(key+'Color')?.value||'#111'; }
  function getSize(){ return +(document.getElementById(key+'Size')?.value||2); }

  function onDown(e){
    e.preventDefault();
    drawing=true;
    const [x,y]=getXY(e); startX=x; startY=y;
    const rect=cv.getBoundingClientRect();
    const clientX=e.touches?e.touches[0].clientX:e.clientX;
    const clientY=e.touches?e.touches[0].clientY:e.clientY;
    const boxX=clientX-rect.left;
    const boxY=clientY-rect.top;
    snapshot=ctx.getImageData(0,0,cv.width,cv.height);
    if(state.tool==='text' || state.tool==='legend'){
      openCanvasTextBox(key,boxX,boxY,x,y);
      drawing=false;
    } else if(state.tool==='figure'){
      placeFigureAtPoint(key,x,y);
      drawing=false;
    } else if(state.tool==='graph'){
      placeGraphAtPoint(key,y);
      drawing=false;
    }
  }
  function onMove(e){
    if(!drawing) return; e.preventDefault();
    const [x,y]=getXY(e);
    const t=state.tool;
    ctx.lineCap='round'; ctx.lineJoin='round';
    if(t==='pen'){
      ctx.beginPath(); ctx.moveTo(startX,startY); ctx.lineTo(x,y);
      ctx.strokeStyle=getColor(); ctx.lineWidth=getSize();
      ctx.stroke(); startX=x; startY=y;
    } else if(t==='erase'){
      ctx.beginPath(); ctx.arc(x,y,getSize()*3,0,Math.PI*2);
      ctx.fillStyle='#fff'; ctx.fill();
    } else {
      ctx.putImageData(snapshot,0,0);
      ctx.strokeStyle=getColor(); ctx.lineWidth=getSize();
      ctx.beginPath();
      if(t==='line'){ ctx.moveTo(startX,startY); ctx.lineTo(x,y); ctx.stroke(); }
      else if(t==='rect'){ ctx.strokeRect(startX,startY,x-startX,y-startY); }
      else if(t==='circ'){
        const rx=Math.abs(x-startX)/2, ry=Math.abs(y-startY)/2;
        const cx=(startX+x)/2, cy=(startY+y)/2;
        ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.stroke();
      }
    }
  }
  function onUp(e){
    if(!drawing) return; drawing=false;
    if(state.tool!=='text') markFrameAsBitmap(key);
    pushHistory(key); saveCanvasToQ(key); renderPaper();
  }

  cv.removeEventListener('mousedown',cv._down); cv.removeEventListener('mousemove',cv._move);
  cv.removeEventListener('mouseup',cv._up); cv.removeEventListener('mouseleave',cv._up);
  cv.removeEventListener('touchstart',cv._tdown); cv.removeEventListener('touchmove',cv._tmove);
  cv.removeEventListener('touchend',cv._tup);
  cv._down=onDown; cv._move=onMove; cv._up=onUp;
  cv._tdown=onDown; cv._tmove=onMove; cv._tup=onUp;
  cv.addEventListener('mousedown',cv._down);
  cv.addEventListener('mousemove',cv._move);
  cv.addEventListener('mouseup',cv._up);
  cv.addEventListener('mouseleave',cv._up);
  cv.addEventListener('touchstart',cv._tdown,{passive:false});
  cv.addEventListener('touchmove',cv._tmove,{passive:false});
  cv.addEventListener('touchend',cv._tup);
}

function setTool(tool, key){
  if(!canvasState[key]) return;
  canvasState[key].tool = tool;
  if(tool!=='text' && tool!=='legend') closeCanvasTextBox(key);
  const prefix = key==='q'?'tool':key+'tool';
  ['Pen','Text','Legend','Figure','Graph','Line','Rect','Circ','Erase'].forEach(t=>{
    const b = document.getElementById(prefix+t);
    if(b) b.classList.toggle('active', tool===t.toLowerCase());
  });
}

function pushHistory(key){
  const cv = document.getElementById(key+'Canvas');
  if(!cv||!canvasState[key]) return;
  const st = canvasState[key];
  st.history.push(cv.toDataURL());
  while(st.history.length>10) st.history.shift();
  st.redo=[];
}

function undoCanvas(key){
  const cv = document.getElementById(key+'Canvas');
  if(!cv||!canvasState[key]) return;
  const st = canvasState[key];
  if(st.history.length<=1) return;
  st.redo.push(st.history.pop());
  restoreCanvasFromDataUrl(key, st.history[st.history.length-1], ()=>{
    saveCanvasToQ(key);
    renderPaper();
  });
}

function clearCanvas(key){
  const cv = document.getElementById(key+'Canvas');
  if(!cv) return;
  const baseHeight = getBaseCanvasHeight(key);
  if(cv.height!==baseHeight) cv.height=baseHeight;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#fff'; ctx.fillRect(0,0,cv.width,cv.height);
  markFrameAsBitmap(key);
  const figs=getFigureStore(key);
  figs.length=0;
  const legends=getLegendStore(key);
  legends.length=0;
  clearBurnedFigureImage(key);
  selectedFigureByKey[key]=-1;
  renderFigureOverlays(key);
  pushHistory(key); saveCanvasToQ(key); renderPaper();
}

function importImg(key){
  pickImageFile(img=>{
    markFrameAsBitmapUnlessSource(key);
    openImagePlacementBox(key,img,{mode:'insert'});
  });
}

function getFigureStore(key){
  if(!cur) return [];
  if(key==='q'){
    cur.questionFigures = Array.isArray(cur.questionFigures) ? cur.questionFigures : [];
    return cur.questionFigures;
  }
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    if(cur.options[idx]){
      cur.options[idx].figures = Array.isArray(cur.options[idx].figures) ? cur.options[idx].figures : [];
      return cur.options[idx].figures;
    }
  }
  return [];
}

function getLegendStore(key){
  if(!cur) return [];
  if(key==='q'){
    cur.questionLegends = Array.isArray(cur.questionLegends) ? cur.questionLegends : [];
    return cur.questionLegends;
  }
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    if(cur.options[idx]){
      cur.options[idx].legends = Array.isArray(cur.options[idx].legends) ? cur.options[idx].legends : [];
      return cur.options[idx].legends;
    }
  }
  return [];
}

function getStoredBaseImg(key){
  if(!cur) return null;
  if(key==='q') return cur.questionBaseImage || cur.questionImage || null;
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return cur.options[idx]?.baseImage || cur.options[idx]?.image || null;
  }
  return null;
}

function getBurnedFigureImage(key){
  if(!cur) return '';
  if(key==='q') return cur.questionBurnedFigureImage || '';
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return cur.options[idx]?.burnedFigureImage || '';
  }
  return '';
}

function getBurnedFigureScale(key){
  if(!cur) return 1;
  if(key==='q') return Math.max(1, +(cur.questionBurnedFigureScale || 1));
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return Math.max(1, +(cur.options[idx]?.burnedFigureScale || 1));
  }
  return 1;
}

function setBurnedFigureImage(key, dataUrl, scale=1){
  if(!cur) return;
  const cleanScale=dataUrl ? Math.max(1, +scale || 1) : 1;
  if(key==='q'){
    cur.questionBurnedFigureImage=dataUrl || '';
    cur.questionBurnedFigureScale=cleanScale;
    return;
  }
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    if(cur.options[idx]){
      cur.options[idx].burnedFigureImage=dataUrl || '';
      cur.options[idx].burnedFigureScale=cleanScale;
    }
  }
}

function clearBurnedFigureImage(key){
  setBurnedFigureImage(key, '');
  clearBurnedFigureStore(key);
}

function getBurnedFigureStore(key){
  if(!cur) return [];
  if(key==='q'){
    cur.questionBurnedFigures = Array.isArray(cur.questionBurnedFigures) ? cur.questionBurnedFigures : [];
    return cur.questionBurnedFigures;
  }
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    if(cur.options[idx]){
      cur.options[idx].burnedFigures = Array.isArray(cur.options[idx].burnedFigures) ? cur.options[idx].burnedFigures : [];
      return cur.options[idx].burnedFigures;
    }
  }
  return [];
}

function cloneFigureForBurn(fig){
  return {
    src:fig?.src || '',
    x:Math.round(Number(fig?.x)||0),
    y:Math.round(Number(fig?.y)||0),
    w:Math.round(Math.max(1, Number(fig?.w)||1)),
    h:Math.round(Math.max(1, Number(fig?.h)||1)),
    crop:{...getFigureCrop(fig)}
  };
}

function clearBurnedFigureStore(key){
  const burned=getBurnedFigureStore(key);
  burned.length=0;
}

function getBurnedFigureBottom(key){
  return getBurnedFigureStore(key).reduce((bottom, fig)=>{
    if(!fig) return bottom;
    return Math.max(bottom, (Number(fig.y)||0)+(Number(fig.h)||0));
  }, 0);
}

function storeCanvasImagesForKey(key, baseDataUrl, fullDataUrl, viewerDataUrl){
  if(!cur) return;
  if(key==='q'){
    cur.questionBaseImage=baseDataUrl || cur.questionBaseImage || '';
    cur.questionImage=fullDataUrl || cur.questionImage || '';
    cur.questionViewerImage=viewerDataUrl || cur.questionViewerImage || '';
    return;
  }
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    if(cur.options[idx]){
      cur.options[idx].baseImage=baseDataUrl || cur.options[idx].baseImage || '';
      cur.options[idx].image=fullDataUrl || cur.options[idx].image || '';
      cur.options[idx].viewerImage=viewerDataUrl || cur.options[idx].viewerImage || '';
    }
  }
}

function getCanvasOverlayMetrics(key){
  const wrap=document.getElementById(key+'CanvasWrap');
  const cv=document.getElementById(key+'Canvas');
  if(!wrap||!cv) return null;
  const wrapRect=wrap.getBoundingClientRect();
  const cvRect=cv.getBoundingClientRect();
  return {
    wrap,
    cv,
    left:cvRect.left-wrapRect.left,
    top:cvRect.top-wrapRect.top,
    width:cvRect.width,
    height:cvRect.height,
    scaleX:cv.width/cvRect.width,
    scaleY:cv.height/cvRect.height
  };
}

function getFigureCrop(fig){
  return {
    l:Math.max(0, Math.min(0.8, +(fig?.crop?.l||0))),
    t:Math.max(0, Math.min(0.8, +(fig?.crop?.t||0))),
    r:Math.max(0, Math.min(0.8, +(fig?.crop?.r||0))),
    b:Math.max(0, Math.min(0.8, +(fig?.crop?.b||0)))
  };
}

function getStoredFigureBottom(key){
  return getFigureStore(key).reduce((bottom, fig)=>{
    if(!fig) return bottom;
    return Math.max(bottom, (Number(fig.y)||0)+(Number(fig.h)||0));
  }, 0);
}

function getAllStoredFigureBottom(key){
  return Math.max(getStoredFigureBottom(key), getBurnedFigureBottom(key));
}

function getStoredFigureRight(key){
  return getFigureStore(key).reduce((right, fig)=>{
    if(!fig) return right;
    return Math.max(right, (Number(fig.x)||0)+(Number(fig.w)||0));
  }, 0);
}

function getSurfaceLogicalMetrics(surface, key){
  const cv=document.getElementById(key+'Canvas');
  const styleW=parseFloat(surface?.style?.width||'0');
  const styleH=parseFloat(surface?.style?.height||'0');
  const logicalW=styleW || cv?.width || surface?.width || 1;
  const scale=(surface?.width && logicalW) ? Math.max(1, surface.width/logicalW) : 1;
  const logicalH=styleH || (surface?.height ? surface.height/scale : cv?.height || getBaseCanvasHeight(key));
  return { logicalW, logicalH, scale };
}

function getExistingFigureImageElement(wrap, fig){
  if(!wrap || !fig?.src) return null;
  return [...(wrap.querySelectorAll('.figure-item img')||[])]
    .find(node=>node.getAttribute('src')===fig.src) || null;
}

async function getFigureImageForCanvasExport(fig, wrap){
  const existing=getExistingFigureImageElement(wrap, fig);
  if(existing && (existing.complete || existing.naturalWidth)) return existing;
  if(fig?.src && typeof loadImg==='function') return await loadImg(fig.src);
  return existing;
}

async function drawFigureListOnCanvas(ctx, key, figs, scale=1){
  const wrap=document.getElementById(key+'CanvasWrap');
  const list=(Array.isArray(figs) ? figs : []).filter(fig=>fig && fig.src);
  const prevSmooth=ctx.imageSmoothingEnabled;
  const prevQuality=ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  for(const fig of list){
    try{
      const img=await getFigureImageForCanvasExport(fig, wrap);
      if(!img) continue;
      const crop=getFigureCrop(fig);
      const srcW=img.naturalWidth||img.width||fig.w||1;
      const srcH=img.naturalHeight||img.height||fig.h||1;
      const sx=srcW*crop.l;
      const sy=srcH*crop.t;
      const sw=srcW*(1-crop.l-crop.r);
      const sh=srcH*(1-crop.t-crop.b);
      const dx=Math.round((Number(fig.x)||0)*scale);
      const dy=Math.round((Number(fig.y)||0)*scale);
      const dw=Math.round(Math.max(1, Number(fig.w)||1)*scale);
      const dh=Math.round(Math.max(1, Number(fig.h)||1)*scale);
      if(sw>0 && sh>0 && dw>0 && dh>0) ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);
    }catch(_){ }
  }
  ctx.imageSmoothingEnabled=prevSmooth;
  try{ ctx.imageSmoothingQuality=prevQuality; }catch(_){ }
}

async function drawStoredFiguresOnCanvas(ctx, key, scale=1){
  await drawFigureListOnCanvas(ctx, key, getFigureStore(key), scale);
}

function drawFigureListFromLoadedDom(ctx, key, figs, selector, scale=1){
  const wrap=document.getElementById(key+'CanvasWrap');
  const imgs=[...(wrap?.querySelectorAll(selector)||[])];
  const list=(Array.isArray(figs) ? figs : []).filter(fig=>fig && fig.src);
  const prevSmooth=ctx.imageSmoothingEnabled;
  const prevQuality=ctx.imageSmoothingQuality;
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  list.forEach(fig=>{
    const img=imgs.find(node=>node.getAttribute('src')===fig.src);
    if(!img || (!img.complete && !img.naturalWidth)) return;
    const crop=getFigureCrop(fig);
    const srcW=img.naturalWidth||img.width||fig.w||1;
    const srcH=img.naturalHeight||img.height||fig.h||1;
    const sx=srcW*crop.l;
    const sy=srcH*crop.t;
    const sw=srcW*(1-crop.l-crop.r);
    const sh=srcH*(1-crop.t-crop.b);
    const dx=Math.round((Number(fig.x)||0)*scale);
    const dy=Math.round((Number(fig.y)||0)*scale);
    const dw=Math.round(Math.max(1, Number(fig.w)||1)*scale);
    const dh=Math.round(Math.max(1, Number(fig.h)||1)*scale);
    try{
      if(sw>0 && sh>0 && dw>0 && dh>0) ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);
    }catch(_){ }
  });
  ctx.imageSmoothingEnabled=prevSmooth;
  try{ ctx.imageSmoothingQuality=prevQuality; }catch(_){ }
}

async function drawBurnedFigureLayerOnCanvas(ctx, key, scale=1){
  const burned=getBurnedFigureStore(key).filter(fig=>fig && fig.src);
  if(burned.length){
    await drawFigureListOnCanvas(ctx, key, burned, scale);
    return true;
  }
  const layer=getBurnedFigureImage(key);
  if(!layer) return false;
  try{
    const img=await loadImg(layer);
    const layerScale=getBurnedFigureScale(key);
    const logicalW=(img.naturalWidth||img.width||1)/layerScale;
    const logicalH=(img.naturalHeight||img.height||1)/layerScale;
    const w=Math.round(logicalW*scale);
    const h=Math.round(logicalH*scale);
    const prevSmooth=ctx.imageSmoothingEnabled;
    const prevQuality=ctx.imageSmoothingQuality;
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,0,0,w,h);
    ctx.imageSmoothingEnabled=prevSmooth;
    try{ ctx.imageSmoothingQuality=prevQuality; }catch(_){ }
    return true;
  }catch(_){
    return false;
  }
}

function getBurnedFigureLayerRenderScale(key){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return Math.max(2, Math.min(4, EXPORT_IMAGE_SCALE || 4));
  const baseScale=Math.max(2, Math.min(4, EXPORT_IMAGE_SCALE || 4));
  const maxPixels=16000000;
  const pixelScale=Math.sqrt(maxPixels/Math.max(1, cv.width*cv.height));
  return Math.max(2, Math.min(baseScale, pixelScale));
}

function getFigureLogicalArea(fig){
  return Math.max(0, +(fig?.w||0)) * Math.max(0, +(fig?.h||0));
}

function figuresSharePlacement(first, second){
  const sameSource=String(first?.src||'')===String(second?.src||'');
  const close=(a,b)=>Math.abs((+a||0)-(+b||0))<1;
  return sameSource && close(first?.x,second?.x) && close(first?.y,second?.y)
    && close(first?.w,second?.w) && close(first?.h,second?.h);
}

function figuresMeaningfullyOverlap(first, second){
  const left=Math.max(+(first?.x||0), +(second?.x||0));
  const top=Math.max(+(first?.y||0), +(second?.y||0));
  const right=Math.min(+(first?.x||0)+Math.max(0,+(first?.w||0)), +(second?.x||0)+Math.max(0,+(second?.w||0)));
  const bottom=Math.min(+(first?.y||0)+Math.max(0,+(first?.h||0)), +(second?.y||0)+Math.max(0,+(second?.h||0)));
  const overlap=Math.max(0,right-left)*Math.max(0,bottom-top);
  const smallest=Math.min(getFigureLogicalArea(first),getFigureLogicalArea(second));
  // A real replacement needs meaningful overlap; figures merely touching stay independent.
  return overlap>0 && (smallest===0 || overlap>=smallest*.12);
}

function removeBurnedFiguresMatchingLiveFigure(key, liveFigure){
  if(!liveFigure) return false;
  const burned=getBurnedFigureStore(key);
  if(!burned.length) return false;
  const kept=burned.filter(previous=>!(figuresSharePlacement(previous,liveFigure) || figuresMeaningfullyOverlap(previous,liveFigure)));
  if(kept.length===burned.length) return false;
  burned.splice(0,burned.length,...kept);
  return true;
}

function isEditableVectorCircuitFigure(fig){
  return fig?.kind==='circuit-svg' && !!fig?.circuitScene && /^data:image\/svg\+xml/i.test(String(fig?.src||''));
}

async function updateBurnedFigureLayerFromCurrentFigures(key){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return '';
  ensureCanvasHeightForFigures(key);
  const burned=getBurnedFigureStore(key);
  const liveFigures=getFigureStore(key).filter(fig=>fig && fig.src).map(cloneFigureForBurn);
  if(liveFigures.length){
    // A later burn replaces the prior figure only where it truly covers it.
    // This preserves independent placed figures and never touches the text bitmap.
    const retained=burned.filter(previous=>!liveFigures.some(next=>
      figuresSharePlacement(previous,next) || figuresMeaningfullyOverlap(previous,next)
    ));
    burned.splice(0,burned.length,...retained,...liveFigures);
  }
  const layerScale=getBurnedFigureLayerRenderScale(key);
  const layer=document.createElement('canvas');
  layer.width=Math.max(1, Math.round(cv.width*layerScale));
  layer.height=Math.max(1, Math.round(cv.height*layerScale));
  const lctx=layer.getContext('2d');
  lctx.clearRect(0,0,layer.width,layer.height);
  if(burned.length) await drawFigureListOnCanvas(lctx, key, burned, layerScale);
  else await drawBurnedFigureLayerOnCanvas(lctx, key, layerScale);
  const dataUrl=layer.toDataURL('image/png');
  setBurnedFigureImage(key, dataUrl, layerScale);
  return dataUrl;
}

async function flattenCanvasSurfaceWithFigures(surface, key){
  const figs=getFigureStore(key).filter(fig=>fig && fig.src);
  if(!surface || !figs.length) return surface;
  const metrics=getSurfaceLogicalMetrics(surface, key);
  const logicalW=Math.max(metrics.logicalW, getStoredFigureRight(key)+12);
  const logicalH=Math.max(metrics.logicalH, getBaseCanvasHeight(key), getStoredFigureBottom(key)+12);
  const out=document.createElement('canvas');
  out.width=Math.max(1, Math.round(logicalW*metrics.scale));
  out.height=Math.max(1, Math.round(logicalH*metrics.scale));
  out.style.width=logicalW+'px';
  out.style.height=logicalH+'px';
  const ctx=out.getContext('2d');
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,out.width,out.height);
  ctx.drawImage(surface,0,0);
  await drawStoredFiguresOnCanvas(ctx, key, metrics.scale);
  return out;
}

async function composeSourceSurfaceWithCanvasFigures(source, key, opts={}){
  const cv=document.getElementById(key+'Canvas');
  if(!cv || !source) return source;
  const includeLiveFigures=opts.includeLiveFigures!==false;
  const includeBurnedLayer=opts.includeBurnedLayer!==false;
  const pad=key==='q' ? 8 : 4;
  const sourceScale=Math.max(2, typeof getCanvasIntrinsicScale==='function' ? getCanvasIntrinsicScale(source) : 2);
  const preparedSource=(typeof prepareComposerSurfaceForCanvasApply==='function')
    ? prepareComposerSurfaceForCanvasApply(source, key)
    : {source, sx:0, sy:0, sw:source.naturalWidth||source.width||Math.max(200, cv.width-pad*2), sh:source.naturalHeight||source.height||getBaseCanvasHeight(key), logicalWidth:source.naturalWidth||source.width||Math.max(200, cv.width-pad*2), logicalHeight:source.naturalHeight||source.height||getBaseCanvasHeight(key)};
  const srcW=preparedSource.logicalWidth||Math.max(200, cv.width-pad*2);
  const srcH=preparedSource.logicalHeight||getBaseCanvasHeight(key);
  const maxDrawW=Math.max(180, cv.width-pad*2);
  const drawScale=Math.min(1, maxDrawW/Math.max(1,srcW));
  const drawW=Math.max(60, Math.round(srcW*drawScale));
  const drawH=Math.max(key==='q' ? 28 : 18, Math.round(srcH*drawScale));
  let layerH=0;
  const burnedLayer=getBurnedFigureImage(key);
  if(includeBurnedLayer && burnedLayer){
    try{
      const layerImg=await loadImg(burnedLayer);
      layerH=(layerImg.naturalHeight||layerImg.height||0)/getBurnedFigureScale(key);
    }catch(_){ }
  }
  if(includeBurnedLayer) layerH=Math.max(layerH, getBurnedFigureBottom(key));
  const targetH=Math.max(getBaseCanvasHeight(key), cv.height, layerH, drawH+pad*2, includeLiveFigures ? getStoredFigureBottom(key)+12 : 0);
  const out=document.createElement('canvas');
  out.width=Math.max(1, Math.round(cv.width*sourceScale));
  out.height=Math.max(1, Math.round(targetH*sourceScale));
  out.style.width=cv.width+'px';
  out.style.height=targetH+'px';
  const ctx=out.getContext('2d');
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,out.width,out.height);
  const drawX=pad;
  const drawY=key==='q' ? pad : Math.max(pad, Math.round((targetH-drawH)/2));
  ctx.drawImage(
    preparedSource.source,
    preparedSource.sx,
    preparedSource.sy,
    preparedSource.sw,
    preparedSource.sh,
    drawX*sourceScale,
    drawY*sourceScale,
    drawW*sourceScale,
    drawH*sourceScale
  );
  if(includeBurnedLayer) await drawBurnedFigureLayerOnCanvas(ctx, key, sourceScale);
  if(includeLiveFigures) await drawStoredFiguresOnCanvas(ctx, key, sourceScale);
  return out;
}

function paintSurfaceToEditorCanvas(key, surface){
  const cv=document.getElementById(key+'Canvas');
  if(!cv || !surface) return '';
  const metrics=getSurfaceLogicalMetrics(surface, key);
  const logicalW=Math.max(1, Math.ceil(metrics.logicalW || cv.width || 1));
  const logicalH=Math.max(getBaseCanvasHeight(key), Math.ceil(metrics.logicalH || (surface.height/Math.max(1,metrics.scale))));
  cv.height=Math.min(3600, logicalH);
  const ctx=cv.getContext('2d');
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,cv.width,cv.height);
  ctx.drawImage(
    surface,
    0,0,surface.width,surface.height,
    0,0,Math.min(cv.width, logicalW),Math.min(cv.height, logicalH)
  );
  return cv.toDataURL('image/png');
}

function clearFigureOverlayState(key){
  const figs=getFigureStore(key);
  figs.length=0;
  selectedFigureByKey[key]=-1;
  cropModeByKey[key]=false;
  renderFigureOverlays(key);
}

function saveHighResSurfaceAsBitmapFrame(key, surface){
  const baseDataUrl=paintSurfaceToEditorCanvas(key, surface);
  const exportSurface=(typeof buildHighResExportSurface==='function') ? buildHighResExportSurface(surface, key, 1) : surface;
  const fullDataUrl=exportSurface.toDataURL('image/png');
  const viewerDataUrl=(typeof makeViewerCanvasImage==='function')
    ? makeViewerCanvasImage(surface, key).toDataURL('image/png')
    : fullDataUrl;
  storeCanvasImagesForKey(key, baseDataUrl, fullDataUrl, viewerDataUrl);
}

async function burnBitmapFigureOverlaysIntoCanvas(key){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) throw new Error('Target canvas was not found.');
  ensureCanvasHeightForFigures(key);
  await updateBurnedFigureLayerFromCurrentFigures(key);
  const ctx=cv.getContext('2d');
  await drawStoredFiguresOnCanvas(ctx, key, 1);
  clearFigureOverlayState(key);
  markFrameAsBitmap(key);
  saveCanvasToQ(key);
  setFrameBitmapDirty(key, false);
}

async function burnSourceFigureOverlaysIntoCanvas(key){
  const html=String((typeof getComposerSourceHTML==='function' ? getComposerSourceHTML(key) : '')||'').trim();
  if(!html || typeof renderMixedComposerCanvas!=='function') return false;
  const host=document.createElement('div');
  host.innerHTML=html;
  const source=await renderMixedComposerCanvas(host, key);
  await updateBurnedFigureLayerFromCurrentFigures(key);
  clearFigureOverlayState(key);
  const surface=await composeSourceSurfaceWithCanvasFigures(source, key, { includeLiveFigures:false, includeBurnedLayer:true });
  markFrameAsBitmap(key);
  saveHighResSurfaceAsBitmapFrame(key, surface);
  setFrameBitmapDirty(key, false);
  return true;
}

async function burnFiguresIntoCanvas(key){
  const figs=getFigureStore(key);
  if(!figs.length){
    toast('No imported figure to burn');
    return;
  }
  if(figs.some(isEditableVectorCircuitFigure)){
    saveLS();
    renderPaper();
    toast('Vector circuit saved as editable SVG. It stays editable and is not flattened.');
    return;
  }
  const activeBtn=document.activeElement;
  const oldText=activeBtn?.tagName==='BUTTON' ? activeBtn.textContent : '';
  if(activeBtn?.tagName==='BUTTON'){
    activeBtn.disabled=true;
    activeBtn.textContent='Burning...';
  }
  try{
    const useSource=(typeof getFrameRenderMode==='function' && getFrameRenderMode(key)==='source') || isSourceBackedFrame(key);
    let burned=false;
    if(useSource){
      try{ burned=await burnSourceFigureOverlaysIntoCanvas(key); }
      catch(_){ burned=false; }
    }
    if(!burned) await burnBitmapFigureOverlaysIntoCanvas(key);
    pushHistory(key);
    saveLS();
    renderPaper();
    toast('Imported figure burned into canvas');
  }catch(err){
    showNotice(err?.message || 'Could not burn the imported figure into this canvas.', 'Burn Figure');
  }finally{
    if(activeBtn?.tagName==='BUTTON'){
      activeBtn.disabled=false;
      activeBtn.textContent=oldText || 'Burn Fig';
    }
  }
}

function persistFigureOverlayChange(key){
  if(ensureSourceBackedFrame(key) && typeof syncCanvasAssetForKeyAsync==='function'){
    syncCanvasAssetForKeyAsync(key, { allowBitmapFallback:false }).then(()=>{
      saveLS();
      renderPaper();
    }).catch(()=>{
      saveCanvasToQ(key);
      renderPaper();
    });
  }else{
    saveCanvasToQ(key);
    renderPaper();
  }
}

function applyCropToFigureElement(el, fig){
  const img=el.querySelector('img');
  if(!img) return;
  const crop=getFigureCrop(fig);
  const visibleX=Math.max(0.05, 1-crop.l-crop.r);
  const visibleY=Math.max(0.05, 1-crop.t-crop.b);
  img.style.width=(100/visibleX)+'%';
  img.style.height=(100/visibleY)+'%';
  img.style.marginLeft=(-(crop.l/visibleX)*100)+'%';
  img.style.marginTop=(-(crop.t/visibleY)*100)+'%';
}

function refreshFigureSelectionUI(key){
  const wrap=document.getElementById(key+'CanvasWrap');
  if(!wrap) return;
  const selected=selectedFigureByKey[key];
  wrap.querySelectorAll('.figure-item').forEach(el=>{
    el.classList.toggle('selected', +el.dataset.idx===selected);
    el.classList.toggle('crop-mode', !!cropModeByKey[key] && +el.dataset.idx===selected);
  });
}

function renderBurnedFigureOverlays(key){
  const metrics=getCanvasOverlayMetrics(key);
  if(!metrics) return;
  let host=metrics.wrap.querySelector('.burned-figure-overlay');
  if(host) host.remove();
  const burned=getBurnedFigureStore(key).filter(fig=>fig && fig.src);
  if(!burned.length) return;
  host=document.createElement('div');
  host.className='burned-figure-overlay';
  host.style.left=metrics.left+'px';
  host.style.top=metrics.top+'px';
  host.style.width=metrics.width+'px';
  host.style.height=metrics.height+'px';
  burned.forEach((fig, idx)=>{
    const item=document.createElement('div');
    item.className='burned-figure-item';
    item.dataset.idx=idx;
    item.style.left=(fig.x/metrics.scaleX)+'px';
    item.style.top=(fig.y/metrics.scaleY)+'px';
    item.style.width=(fig.w/metrics.scaleX)+'px';
    item.style.height=(fig.h/metrics.scaleY)+'px';
    item.innerHTML=`<img src="${fig.src}" alt="">`;
    applyCropToFigureElement(item, fig);
    host.appendChild(item);
  });
  metrics.wrap.appendChild(host);
}

function selectFigure(key, idx){
  selectedFigureByKey[key]=idx;
  refreshFigureSelectionUI(key);
}

function renderFigureOverlays(key){
  ensureCanvasHeightForFigures(key);
  const metrics=getCanvasOverlayMetrics(key);
  if(!metrics) return;
  renderBurnedFigureOverlays(key);
  let host=metrics.wrap.querySelector('.figure-overlay');
  if(host) host.remove();
  host=document.createElement('div');
  host.className='figure-overlay';
  host.style.left=metrics.left+'px';
  host.style.top=metrics.top+'px';
  host.style.width=metrics.width+'px';
  host.style.height=metrics.height+'px';
  const figs=getFigureStore(key);
  const selected=selectedFigureByKey[key];
  figs.forEach((fig, idx)=>{
    const item=document.createElement('div');
    const cropMode=!!cropModeByKey[key] && selected===idx;
    const crop=getFigureCrop(fig);
    item.className='figure-item'+(selected===idx?' selected':'')+(cropMode?' crop-mode':'');
    item.dataset.idx=idx;
    if(isEditableVectorCircuitFigure(fig)){
      item.classList.add('vector-circuit-figure');
      item.title='Double-click to edit this vector circuit';
    }
    item.style.left=(fig.x/metrics.scaleX)+'px';
    item.style.top=(fig.y/metrics.scaleY)+'px';
    item.style.width=(fig.w/metrics.scaleX)+'px';
    item.style.height=(fig.h/metrics.scaleY)+'px';
    item.innerHTML=`<img src="${fig.src}" alt="">
      <span class="figure-handle nw"></span><span class="figure-handle ne"></span><span class="figure-handle sw"></span><span class="figure-handle se"></span>
      ${cropMode?`<div class="figure-crop-box" style="left:${crop.l*100}%;top:${crop.t*100}%;width:${Math.max(5,(1-crop.l-crop.r)*100)}%;height:${Math.max(5,(1-crop.t-crop.b)*100)}%">
        <span class="figure-crop-handle cnw"></span><span class="figure-crop-handle cne"></span><span class="figure-crop-handle csw"></span><span class="figure-crop-handle cse"></span>
      </div>`:''}`;
    applyCropToFigureElement(item, fig);
    item.addEventListener('pointerdown',e=>{
      if(e.target.closest('.figure-handle')) return;
      if(e.target.closest('.figure-crop-handle')) return;
      e.preventDefault();
      e.stopPropagation();
      selectFigure(key, idx);
      const rect=item.getBoundingClientRect();
      const hostRect=host.getBoundingClientRect();
      const dx=e.clientX-rect.left;
      const dy=e.clientY-rect.top;
      item.setPointerCapture?.(e.pointerId);
      const move=e2=>{
        const nextLeft=Math.min(Math.max(0, e2.clientX-hostRect.left-dx), Math.max(0, hostRect.width-item.offsetWidth));
        const nextTop=Math.min(Math.max(0, e2.clientY-hostRect.top-dy), Math.max(0, hostRect.height-item.offsetHeight));
        item.style.left=nextLeft+'px';
        item.style.top=nextTop+'px';
      };
        const up=e2=>{
          item.releasePointerCapture?.(e2.pointerId);
          window.removeEventListener('pointermove',move);
          window.removeEventListener('pointerup',up);
          fig.x=Math.round(parseFloat(item.style.left||'0')*metrics.scaleX);
          fig.y=Math.round(parseFloat(item.style.top||'0')*metrics.scaleY);
          ensureCanvasHeightForFigures(key);
          renderFigureOverlays(key);
          persistFigureOverlayChange(key);
        };
      window.addEventListener('pointermove',move);
      window.addEventListener('pointerup',up);
    });
    item.addEventListener('dblclick',e=>{
      if(!isEditableVectorCircuitFigure(fig) || typeof window.openCircuitFigureEditor!=='function') return;
      e.preventDefault();
      e.stopPropagation();
      selectFigure(key, idx);
      window.openCircuitFigureEditor(key, idx);
    });
    item.querySelectorAll('.figure-handle').forEach(handle=>{
      handle.addEventListener('pointerdown',e=>{
        e.preventDefault();
        e.stopPropagation();
        selectFigure(key, idx);
        const startLeft=parseFloat(item.style.left||'0');
        const startTop=parseFloat(item.style.top||'0');
        const startW=item.offsetWidth;
        const startH=item.offsetHeight;
        const hostRect=host.getBoundingClientRect();
        const startX=e.clientX;
        const startY=e.clientY;
        handle.setPointerCapture?.(e.pointerId);
        const move=e2=>{
          const dx=e2.clientX-startX;
          const dy=e2.clientY-startY;
          let nextLeft=startLeft, nextTop=startTop, nextW=startW, nextH=startH;
          if(handle.classList.contains('se')){ nextW=startW+dx; nextH=startH+dy; }
          if(handle.classList.contains('sw')){ nextLeft=startLeft+dx; nextW=startW-dx; nextH=startH+dy; }
          if(handle.classList.contains('ne')){ nextTop=startTop+dy; nextW=startW+dx; nextH=startH-dy; }
          if(handle.classList.contains('nw')){ nextLeft=startLeft+dx; nextTop=startTop+dy; nextW=startW-dx; nextH=startH-dy; }
          nextW=Math.max(24, Math.min(nextW, hostRect.width-nextLeft));
          nextH=Math.max(24, Math.min(nextH, hostRect.height-nextTop));
          nextLeft=Math.max(0, Math.min(nextLeft, hostRect.width-nextW));
          nextTop=Math.max(0, Math.min(nextTop, hostRect.height-nextH));
          item.style.left=nextLeft+'px';
          item.style.top=nextTop+'px';
          item.style.width=nextW+'px';
          item.style.height=nextH+'px';
        };
        const up=e2=>{
          handle.releasePointerCapture?.(e2.pointerId);
          window.removeEventListener('pointermove',move);
          window.removeEventListener('pointerup',up);
          fig.x=Math.round(parseFloat(item.style.left||'0')*metrics.scaleX);
          fig.y=Math.round(parseFloat(item.style.top||'0')*metrics.scaleY);
          fig.w=Math.round(item.offsetWidth*metrics.scaleX);
          fig.h=Math.round(item.offsetHeight*metrics.scaleY);
          ensureCanvasHeightForFigures(key);
          renderFigureOverlays(key);
          persistFigureOverlayChange(key);
        };
        window.addEventListener('pointermove',move);
        window.addEventListener('pointerup',up);
      });
    });
    item.querySelectorAll('.figure-crop-handle').forEach(handle=>{
      handle.addEventListener('pointerdown',e=>{
        e.preventDefault();
        e.stopPropagation();
        selectFigure(key, idx);
        const cropBox=item.querySelector('.figure-crop-box');
        if(!cropBox) return;
        const startW=item.offsetWidth;
        const startH=item.offsetHeight;
        const minVisible=24;
        let leftPx=crop.l*startW;
        let topPx=crop.t*startH;
        let rightPx=startW-(crop.r*startW);
        let bottomPx=startH-(crop.b*startH);
        const startLeft=leftPx, startTop=topPx, startRight=rightPx, startBottom=bottomPx;
        const startX=e.clientX, startY=e.clientY;
        const paint=()=>{
          cropBox.style.left=(leftPx/startW*100)+'%';
          cropBox.style.top=(topPx/startH*100)+'%';
          cropBox.style.width=((rightPx-leftPx)/startW*100)+'%';
          cropBox.style.height=((bottomPx-topPx)/startH*100)+'%';
        };
        handle.setPointerCapture?.(e.pointerId);
        const move=e2=>{
          const dx=e2.clientX-startX;
          const dy=e2.clientY-startY;
          leftPx=startLeft; topPx=startTop; rightPx=startRight; bottomPx=startBottom;
          if(handle.classList.contains('cnw')){ leftPx=startLeft+dx; topPx=startTop+dy; }
          if(handle.classList.contains('cne')){ rightPx=startRight+dx; topPx=startTop+dy; }
          if(handle.classList.contains('csw')){ leftPx=startLeft+dx; bottomPx=startBottom+dy; }
          if(handle.classList.contains('cse')){ rightPx=startRight+dx; bottomPx=startBottom+dy; }
          leftPx=Math.max(0, Math.min(leftPx, rightPx-minVisible));
          topPx=Math.max(0, Math.min(topPx, bottomPx-minVisible));
          rightPx=Math.min(startW, Math.max(rightPx, leftPx+minVisible));
          bottomPx=Math.min(startH, Math.max(bottomPx, topPx+minVisible));
          paint();
        };
        const up=e2=>{
          handle.releasePointerCapture?.(e2.pointerId);
          window.removeEventListener('pointermove',move);
          window.removeEventListener('pointerup',up);
          fig.crop={
            l:+(leftPx/startW).toFixed(4),
            t:+(topPx/startH).toFixed(4),
            r:+((startW-rightPx)/startW).toFixed(4),
            b:+((startH-bottomPx)/startH).toFixed(4)
          };
          cropModeByKey[key]=false;
          renderFigureOverlays(key);
          persistFigureOverlayChange(key);
          toast('Crop saved');
        };
        window.addEventListener('pointermove',move);
        window.addEventListener('pointerup',up);
      });
    });
    host.appendChild(item);
  });
  metrics.wrap.appendChild(host);
}

function cropFigure(key){
  const idx=selectedFigureByKey[key];
  const figs=getFigureStore(key);
  if(!(idx>=0) || !figs[idx]){
    toast('Select a figure first');
    return;
  }
  cropModeByKey[key]=!cropModeByKey[key];
  renderFigureOverlays(key);
  toast(cropModeByKey[key] ? 'Crop mode on: drag the inner corner handles, then release to save crop' : 'Crop mode off');
}

function deleteFigure(key){
  const idx=selectedFigureByKey[key];
  const figs=getFigureStore(key);
  if(!(idx>=0) || !figs[idx]){
    toast('Select a figure first');
    return;
  }
  figs.splice(idx,1);
  selectedFigureByKey[key]=-1;
  renderFigureOverlays(key);
  persistFigureOverlayChange(key);
}

function appendFigureMarker(key){
  if(!cur) return;
  const marker='[[FIGURE]]';
  if(key==='q'){
    if(!String(cur.questionText||'').includes(marker)){
      cur.questionText = (cur.questionText ? cur.questionText+'\n' : '') + marker;
      syncPdfSourceFields();
    }
    return;
  }
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    if(cur.options[idx] && !String(cur.options[idx].text||'').includes(marker)){
      cur.options[idx].text = (cur.options[idx].text ? cur.options[idx].text+'\n' : '') + marker;
      syncPdfSourceFields();
    }
  }
}

function insertMathImg(key){
  const sym=prompt('Type math expression (Unicode symbols supported):', 'Î± + Î² = Î³');
  if(!sym) return;
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return;
  const ctx=cv.getContext('2d');
  const color=document.getElementById(key+'Color')?.value||'#111';
  const size=(+(document.getElementById(key+'Size')?.value||2))*5+10;
  ctx.fillStyle=color;
  ctx.font=`${size}px "Times New Roman",serif`;
  ctx.fillText(sym, 10, Math.min(size+10, cv.height-10));
  pushHistory(key); saveCanvasToQ(key); renderPaper();
}

function autoGrowTextBox(el){
  if(!el) return;
  el.style.height='auto';
  el.style.height=Math.min(Math.max(el.scrollHeight,74),180)+'px';
}

function resizeCanvasPreserve(key, newHeight){
  const cv=document.getElementById(key+'Canvas');
  if(!cv || newHeight<=cv.height) return;
  setCanvasHeightPreserve(key, newHeight);
}

function setCanvasHeightPreserve(key, newHeight){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return;
  newHeight=Math.max(48, Math.round(newHeight));
  if(newHeight===cv.height) return;
  const snap=document.createElement('canvas');
  snap.width=cv.width;
  snap.height=cv.height;
  snap.getContext('2d').drawImage(cv,0,0);
  cv.height=newHeight;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,cv.width,cv.height);
  ctx.drawImage(snap,0,0);
}

function ensureCanvasHeightForText(key, text, font, lineHeight, startY, padRight=12){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return;
  const ctx=cv.getContext('2d');
  const textH=measureCanvasText(ctx,text,cv.width-24-padRight,font,lineHeight);
  const needed=Math.max(startY+textH+16, cv.height);
  resizeCanvasPreserve(key, needed);
}

function ensureCanvasHeightForFigures(key, extraPad=24){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return;
  const maxBottom=getAllStoredFigureBottom(key);
  if(!maxBottom) return;
  resizeCanvasPreserve(key, Math.max(cv.height, maxBottom+extraPad));
}

function expandCanvasPane(key, extra=120){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return;
  resizeCanvasPreserve(key, cv.height+extra);
  renderFigureOverlays(key);
  persistFigureOverlayChange(key);
}

function getCanvasInkBottom(key){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return 0;
  const ctx=cv.getContext('2d');
  const {width,height}=cv;
  const data=ctx.getImageData(0,0,width,height).data;
  for(let y=height-1; y>=0; y--){
    for(let x=0; x<width; x++){
      const i=(y*width+x)*4;
      const a=data[i+3];
      if(!a) continue;
      const r=data[i], g=data[i+1], b=data[i+2];
      if(a>10 && (r<248 || g<248 || b<248)) return y+1;
    }
  }
  return 0;
}

function getDesiredCanvasHeight(key, extraPad=(key==='q' ? 14 : 10)){
  const baseHeight=getBaseCanvasHeight(key);
  const figBottom=getAllStoredFigureBottom(key);
  const inkBottom=getCanvasInkBottom(key);
  return Math.max(baseHeight, inkBottom+extraPad, figBottom+extraPad);
}

function contractCanvasPane(key){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return;
  setCanvasHeightPreserve(key, getDesiredCanvasHeight(key));
  renderFigureOverlays(key);
  persistFigureOverlayChange(key);
}

function autoAdjustCanvasPane(key){
  contractCanvasPane(key);
  toast('Pane auto-adjusted to used space');
}

function getFixedTextPlacement(key, text, font, lineHeight){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return { startX:16, startY:16, textH:0 };
  const ctx=cv.getContext('2d');
  const startX=16;
  const maxWidth=cv.width-startX-12;
  const textH=measureCanvasText(ctx,text,maxWidth,font,lineHeight);
  const baseHeight=getBaseCanvasHeight(key);
  const needed=Math.max(baseHeight, textH+(key==='q' ? 24 : 14));
  resizeCanvasPreserve(key, needed);
  const startY=key==='q' ? 16 : Math.max(16, Math.round((cv.height-textH)/2));
  return { startX, startY, textH };
}

function sentenceCapText(text){
  return String(text||'').replace(/(^\s*[a-z])|([.!?]\s+[a-z])/g, m=>m.toUpperCase());
}

function pickImageFile(cb){
  const inp=document.createElement('input');
  inp.type='file';
  inp.accept='image/*';
  inp.onchange=()=>{
    if(!inp.files?.[0]) return;
    const r=new FileReader();
    r.onload=ev=>{
      const img=new Image();
      img.onload=()=>cb(img);
      img.src=ev.target.result;
    };
    r.readAsDataURL(inp.files[0]);
  };
  inp.click();
}

function insActive(sym){
  const el=activeTextTarget ? document.getElementById(activeTextTarget) : null;
  if(!el) return;
  if(sym==='__to_sup__' || sym==='__to_sub__' || sym==='__frac__' || sym==='__lim__' || sym==='__intlim__' || sym==='__sumlim__' || sym==='__rad__' || sym==='__func__' || sym==='__acc__' || sym==='__mat__' || sym==='__brk__' || sym==='__scr__'){
    if(sym==='__frac__') openEquationBuilder('fraction', el);
    else if(sym==='__lim__') openEquationBuilder('limit', el);
    else if(sym==='__intlim__') openEquationBuilder('integral', el);
    else if(sym==='__sumlim__') openEquationBuilder('summation', el);
    else if(sym==='__rad__') openEquationBuilder('radical', el);
    else if(sym==='__func__') openEquationBuilder('function', el);
    else if(sym==='__acc__') openEquationBuilder('accent', el);
    else if(sym==='__mat__') openEquationBuilder('matrix', el);
    else if(sym==='__brk__') openEquationBuilder('bracket', el);
    else if(sym==='__scr__') openEquationBuilder('script', el);
    else transformSelectedText(el, sym==='__to_sup__' ? 'sup' : 'sub');
    return;
  }
  insertAtCursor(el, sym);
}

function insertAtCursor(el, text, selectAll=false){
  const s=el.selectionStart||el.value.length, e2=el.selectionEnd||el.value.length;
  el.value=el.value.slice(0,s)+text+el.value.slice(e2);
  el.focus();
  if(selectAll){
    el.selectionStart=s;
    el.selectionEnd=s+text.length;
  } else {
    el.selectionStart=el.selectionEnd=s+text.length;
  }
  autoGrowTextBox(el);
}

function centerPadText(text, width){
  const raw=String(text||'');
  const deficit=Math.max(0, width-raw.length);
  const left=' '.repeat(Math.floor(deficit/2));
  const right=' '.repeat(Math.ceil(deficit/2));
  return left+raw+right;
}

function getSuperSubMaps(){
  const supMap = {
    '0':'\u2070','1':'\u00B9','2':'\u00B2','3':'\u00B3','4':'\u2074','5':'\u2075','6':'\u2076','7':'\u2077','8':'\u2078','9':'\u2079',
    '+':'\u207A','-':'\u207B','=':'\u207C','(':'\u207D',')':'\u207E',
    'a':'\u1D43','b':'\u1D47','c':'\u1D9C','d':'\u1D48','e':'\u1D49','f':'\u1DA0','g':'\u1D4D','h':'\u02B0','i':'\u2071','j':'\u02B2','k':'\u1D4F','l':'\u02E1','m':'\u1D50','n':'\u207F','o':'\u1D52','p':'\u1D56','r':'\u02B3','s':'\u02E2','t':'\u1D57','u':'\u1D58','v':'\u1D5B','w':'\u02B7','x':'\u02E3','y':'\u02B8','z':'\u1DBB',
    'A':'\u1D2C','B':'\u1D2E','D':'\u1D30','E':'\u1D31','G':'\u1D33','H':'\u1D34','I':'\u1D35','J':'\u1D36','K':'\u1D37','L':'\u1D38','M':'\u1D39','N':'\u1D3A','O':'\u1D3C','P':'\u1D3E','R':'\u1D3F','T':'\u1D40','U':'\u1D41','V':'\u2C7D','W':'\u1D42'
  };
  const subMap = {
    '0':'\u2080','1':'\u2081','2':'\u2082','3':'\u2083','4':'\u2084','5':'\u2085','6':'\u2086','7':'\u2087','8':'\u2088','9':'\u2089',
    '+':'\u208A','-':'\u208B','=':'\u208C','(':'\u208D',')':'\u208E',
    'a':'\u2090','e':'\u2091','h':'\u2095','i':'\u1D62','j':'\u2C7C','k':'\u2096','l':'\u2097','m':'\u2098','n':'\u2099','o':'\u2092','p':'\u209A','r':'\u1D63','s':'\u209B','t':'\u209C','u':'\u1D64','v':'\u1D65','x':'\u2093'
  };
  return { supMap, subMap };
}

function toSuperText(text){
  const { supMap } = getSuperSubMaps();
  return [...String(text||'')].map(ch=>supMap[ch] || supMap[ch.toLowerCase()] || ch).join('');
}

function toSubText(text){
  const { subMap } = getSuperSubMaps();
  return [...String(text||'')].map(ch=>subMap[ch] || subMap[ch.toLowerCase()] || ch).join('');
}

function toSuperMathText(text){
  const { supMap } = getSuperSubMaps();
  return [...String(text||'')].map(ch=>{
    if(ch==='/' || ch==='⁄') return '⁄';
    return supMap[ch] || supMap[ch.toLowerCase()] || ch;
  }).join('');
}

function toSubMathText(text){
  const { subMap } = getSuperSubMaps();
  return [...String(text||'')].map(ch=>{
    if(ch==='/' || ch==='⁄') return '⁄';
    return subMap[ch] || subMap[ch.toLowerCase()] || ch;
  }).join('');
}

function canUseUnicodeScriptText(text, mode){
  const maps=getSuperSubMaps();
  const map=mode==='sup' ? maps.supMap : maps.subMap;
  return [...String(text||'')].every(ch=>{
    if(ch==='/' || ch==='⁄') return true;
    if(map[ch] || map[ch.toLowerCase()]) return true;
    return !/[A-Za-z0-9+\-=()]/.test(ch);
  });
}

function normalizeInlinePowerNotation(text){
  let out=String(text||'');
  out=out.replace(/\b([A-Za-z])\s*(square|squared)\b/gi, (_,base)=>`${base}²`);
  out=out.replace(/\b([A-Za-z])\s*(cube|cubed)\b/gi, (_,base)=>`${base}³`);
  out=out.replace(/\^\{([^}]+)\}/g, (_,m)=>{
    const clean=normalizeInlinePowerNotation(m);
    return canUseUnicodeScriptText(clean,'sup') ? toSuperMathText(clean) : `^{${clean}}`;
  });
  out=out.replace(/_\{([^}]+)\}/g, (_,m)=>{
    const clean=normalizeInlinePowerNotation(m);
    return canUseUnicodeScriptText(clean,'sub') ? toSubMathText(clean) : `_{${clean}}`;
  });
  out=out.replace(/\^\(([^)]+)\)/g, (_,m)=>{
    const clean=normalizeInlinePowerNotation(m);
    return canUseUnicodeScriptText(clean,'sup') ? toSuperMathText(clean) : `^(${clean})`;
  });
  out=out.replace(/_\(([^)]+)\)/g, (_,m)=>{
    const clean=normalizeInlinePowerNotation(m);
    return canUseUnicodeScriptText(clean,'sub') ? toSubMathText(clean) : `_(${clean})`;
  });
  out=out.replace(/\^([A-Za-z0-9+\-=]+)/g, (_,m)=>{
    return canUseUnicodeScriptText(m,'sup') ? toSuperMathText(m) : `^${m}`;
  });
  out=out.replace(/_([A-Za-z0-9+\-=]+)/g, (_,m)=>{
    return canUseUnicodeScriptText(m,'sub') ? toSubMathText(m) : `_${m}`;
  });
  return out;
}

function getUnicodeScriptReverseMaps(){
  const superMap = {
    '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9',
    '⁺':'+','⁻':'-','⁼':'=','⁽':'(','⁾':')',
    'ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z',
    'ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ⱽ':'V','ᵂ':'W','⁄':'/'
  };
  const subMap = {
    '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9',
    '₊':'+','₋':'-','₌':'=','₍':'(','₎':')',
    'ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'
  };
  return { superMap, subMap };
}

function composerLatexChar(ch){
  const map={
    'α':'\\alpha','β':'\\beta','γ':'\\gamma','δ':'\\delta','ε':'\\varepsilon','ϵ':'\\epsilon','η':'\\eta','θ':'\\theta','λ':'\\lambda','μ':'\\mu','π':'\\pi','ρ':'\\rho','σ':'\\sigma','τ':'\\tau','φ':'\\phi','ϕ':'\\varphi','ω':'\\omega','Ω':'\\Omega','Φ':'\\Phi','Ψ':'\\Psi','Δ':'\\Delta',
    '∂':'\\partial','∇':'\\nabla','∞':'\\infty','≈':'\\approx','≠':'\\ne','≤':'\\le','≥':'\\ge','±':'\\pm','×':'\\times','÷':'\\div','−':'-','→':'\\to','↔':'\\leftrightarrow','·':'\\cdot','∴':'\\therefore','∵':'\\because','ℏ':'\\hbar'
  };
  if(map[ch]) return map[ch];
  if(ch==='\\') return '\\';
  if(/[{}]/.test(ch)) return '\\'+ch;
  return ch;
}

function trimOuterParensForLatex(text){
  let out=String(text||'').trim();
  while(out.length>=2 && out[0]==='(' && out[out.length-1]===')'){
    let depth=0;
    let wraps=true;
    for(let i=0;i<out.length;i++){
      const ch=out[i];
      if(ch==='(') depth++;
      if(ch===')') depth--;
      if(depth===0 && i<out.length-1){ wraps=false; break; }
      if(depth<0){ wraps=false; break; }
    }
    if(!wraps) break;
    out=out.slice(1,-1).trim();
  }
  return out;
}

function normalizeComposerLatexSource(text){
  return repairComposerVisualAccentShortcuts(String(text||''))
    .replace(/\b([A-Za-z])\s*(square|squared)\b/gi, '$1^2')
    .replace(/\b([A-Za-z])\s*(cube|cubed)\b/gi, '$1^3')
    .replace(/\^\s+\{/g,'^{')
    .replace(/_\s+\{/g,'_{')
    .replace(/\^\s+\(/g,'^(')
    .replace(/_\s+\(/g,'_(')
    .replace(/⁄/g,'/')
    .replace(/−/g,'-');
}

function repairComposerVisualAccentShortcuts(value){
  return String(value||'')
    .replace(/(^|[^\\A-Za-z])([A-Za-z])(?:_bar|_overline)\b/g, '$1\\bar{$2}')
    .replace(/(^|[^\\A-Za-z])([A-Za-z])(?:_hat)\b/g, '$1\\hat{$2}')
    .replace(/(^|[^\\A-Za-z])([A-Za-z])(?:_vec|_vector)\b/g, '$1\\vec{$2}')
    .replace(/([A-Za-z])\u0304/g, '\\bar{$1}')
    .replace(/\\(bar|overline|hat|vec|tilde|dot|ddot)\s+([A-Za-z])(?![A-Za-z])/g, '\\$1{$2}');
}

function stripComposerLatexDelimiters(value){
  let raw=String(value||'').trim();
  if(raw.startsWith('$$') && raw.endsWith('$$') && raw.length>4) return raw.slice(2,-2).trim();
  if(raw.startsWith('\\[') && raw.endsWith('\\]') && raw.length>4) return raw.slice(2,-2).trim();
  if(raw.startsWith('\\(') && raw.endsWith('\\)') && raw.length>4) return raw.slice(2,-2).trim();
  if(raw.startsWith('$') && raw.endsWith('$') && raw.length>2) return raw.slice(1,-1).trim();
  return raw;
}

function isClearComposerLatexExpression(value){
  const raw=stripComposerLatexDelimiters(value);
  if(!raw) return false;
  const latexCommand=/\\(?:begin|end|frac|dfrac|tfrac|sqrt|left|right|sum|prod|lim|int|iint|iiint|oint|bar|overline|hat|vec|dot|ddot|tilde|alpha|beta|gamma|delta|epsilon|varepsilon|theta|lambda|mu|pi|rho|sigma|phi|omega|partial|nabla|operatorname|text|mathrm|mathbb|mathcal|sin|cos|tan|log|ln|exp)\b/;
  if(latexCommand.test(raw)) return true;
  if(/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/.test(raw) && !/\s/.test(raw)) return true;
  if(/[\^_]/.test(raw) && /^[A-Za-z0-9{}()[\]+\-*/=,._^\\]+$/.test(raw) && !/\s/.test(raw)) return true;
  return false;
}

function normalizeComposerPastedLatexExpression(value){
  const raw=stripComposerLatexDelimiters(value);
  return normalizeComposerLatexSource(raw);
}

function unwrapLeadingLatexScriptSource(text){
  const raw=normalizeComposerLatexSource(String(text||'').trim());
  const marker=raw[0];
  if(marker!=='^' && marker!=='_') return { marker:'', body:raw };
  const chars=Array.from(raw);
  const arg=readComposerScriptArgument(chars, 1);
  if(arg.body && arg.next>=chars.length) return { marker, body:arg.body };
  return { marker, body:raw.slice(1).trim() || raw };
}

function stripSingleLatexGroup(text){
  const raw=normalizeComposerLatexSource(String(text||'').trim());
  if(raw[0]!=='{' || raw[raw.length-1]!=='}') return raw;
  const grouped=readComposerGroupedArgument(Array.from(raw), 0);
  return grouped.next>=raw.length ? grouped.body : raw;
}

function findTopLevelSlash(text){
  const chars=Array.from(String(text||''));
  let round=0, brace=0;
  for(let i=0;i<chars.length;i++){
    const ch=chars[i];
    if(ch==='(') round++;
    else if(ch===')') round=Math.max(0,round-1);
    else if(ch==='{') brace++;
    else if(ch==='}') brace=Math.max(0,brace-1);
    else if(ch==='/' && round===0 && brace===0) return i;
  }
  return -1;
}

function readComposerGroupedArgument(chars, start){
  const open=chars[start];
  const close=open==='{' ? '}' : ')';
  let level=0;
  let body='';
  for(let i=start;i<chars.length;i++){
    const ch=chars[i];
    if(ch===open){
      if(level>0) body+=ch;
      level++;
      continue;
    }
    if(ch===close){
      level--;
      if(level===0) return { body, next:i+1 };
      body+=ch;
      continue;
    }
    body+=ch;
  }
  return { body, next:chars.length };
}

function readComposerScriptArgument(chars, start){
  if(start>=chars.length) return { body:'', next:start };
  if(chars[start]==='{' || chars[start]==='(') return readComposerGroupedArgument(chars,start);
  if((chars[start]==='-' || chars[start]==='−') && (chars[start+1]==='{' || chars[start+1]==='(')){
    const grouped=readComposerGroupedArgument(chars,start+1);
    return { body:'-'+grouped.body, next:grouped.next };
  }
  let body='';
  let i=start;
  if(chars[i]==='-' || chars[i]==='−'){
    body+='-';
    i++;
  }
  while(i<chars.length && /[A-Za-z0-9+\-=]/.test(chars[i])){
    body+=chars[i];
    i++;
  }
  if(!body && i<chars.length){
    body=chars[i];
    i++;
  }
  return { body, next:i };
}

function composerScriptRunToLatex(run, depth=0){
  let clean=normalizeComposerLatexSource(String(run||'').trim());
  let sign='';
  if(clean.startsWith('-')){
    sign='-';
    clean=clean.slice(1).trim();
  }
  clean=trimOuterParensForLatex(clean);
  const slash=findTopLevelSlash(clean);
  if(slash>0 && slash<clean.length-1){
    const left=clean.slice(0,slash);
    const right=clean.slice(slash+1);
    return `${sign}\\frac{${composerExprToLatex(left, depth+1)}}{${composerExprToLatex(right, depth+1)}}`;
  }
  return sign+composerExprToLatex(clean, depth+1);
}

function composerExprToLatex(input, depth=0){
  let raw=normalizeComposerLatexSource(String(input||'').trim());
  if(!raw) return '';
  if(depth>6) return raw;
  if(/\\[a-zA-Z]+/.test(raw)) return raw;
  raw=raw.replace(/\{([^{}]+)\}/g,'$1');
  const topSlash=findTopLevelSlash(raw);
  if(topSlash>0 && topSlash<raw.length-1 && !/\s/.test(raw)){
    return `\\frac{${composerExprToLatex(raw.slice(0,topSlash), depth+1)}}{${composerExprToLatex(raw.slice(topSlash+1), depth+1)}}`;
  }
  const { superMap, subMap }=getUnicodeScriptReverseMaps();
  const chars=Array.from(raw);
  let out='';
  for(let i=0;i<chars.length;i++){
    const ch=chars[i];
    if(ch==='^' || ch==='_'){
      const arg=readComposerScriptArgument(chars, i+1);
      const latex=composerScriptRunToLatex(arg.body, depth+1);
      out+=ch==='^' ? `^{${latex}}` : `_{${latex}}`;
      i=arg.next-1;
      continue;
    }
    if(superMap[ch]){
      let run='';
      while(i<chars.length && superMap[chars[i]]){
        run+=superMap[chars[i]];
        i++;
      }
      i--;
      out+=`^{${composerScriptRunToLatex(run, depth+1)}}`;
      continue;
    }
    if(subMap[ch]){
      let run='';
      while(i<chars.length && subMap[chars[i]]){
        run+=subMap[chars[i]];
        i++;
      }
      i--;
      out+=`_{${composerScriptRunToLatex(run, depth+1)}}`;
      continue;
    }
    out+=composerLatexChar(ch);
  }
  return out;
}

function getInlineFractionLatex(num='a', den='b', variant='stacked'){
  const n=composerExprToLatex(String(num||'a').trim() || 'a') || 'a';
  const d=composerExprToLatex(String(den||'b').trim() || 'b') || 'b';
  if(variant==='slash' || variant==='linear') return `{${n}}\\, /\\, {${d}}`;
  if(variant==='small') return `\\frac{${n}}{${d}}`;
  return `\\frac{${n}}{${d}}`;
}

function getInlineFractionInputText(num='a', den='b', variant='stacked'){
  const n=String(num||'a').trim() || 'a';
  const d=String(den||'b').trim() || 'b';
  if(variant==='slash' || variant==='linear') return `{${n}}\\,/\\,{${d}}`;
  if(variant==='small') return `\\frac{${n}}{${d}}`;
  return `\\frac{${n}}{${d}}`;
}

function styleChar(ch, style){
  const cp=ch.codePointAt(0);
  if(style==='bold'){
    if(cp>=65 && cp<=90) return String.fromCodePoint(0x1D400 + cp - 65);
    if(cp>=97 && cp<=122) return String.fromCodePoint(0x1D41A + cp - 97);
    if(cp>=48 && cp<=57) return String.fromCodePoint(0x1D7CE + cp - 48);
  }
  if(style==='italic'){
    if(cp===104) return '\u210E';
    if(cp>=65 && cp<=90) return String.fromCodePoint(0x1D434 + cp - 65);
    if(cp>=97 && cp<=122) return String.fromCodePoint(0x1D44E + cp - 97);
  }
  if(style==='underline'){
    return /\s/.test(ch) ? ch : ch + '\u0332';
  }
  return ch;
}

function styleSelectedText(el, style){
  const s=el.selectionStart||0, e=el.selectionEnd||0;
  if(s===e){
    toast('Select text first');
    el.focus();
    return;
  }
  const selected=el.value.slice(s,e);
  const converted=[...selected].map(ch=>styleChar(ch, style)).join('');
  el.value=el.value.slice(0,s)+converted+el.value.slice(e);
  el.selectionStart=s;
  el.selectionEnd=s+converted.length;
  el.focus();
  autoGrowTextBox(el);
}

function buildInlineFractionText(raw){
  const expr=String(raw||'').trim();
  if(!expr || !expr.includes('/')) return '';
  const known={
    '1/2':'\u00BD','1/3':'\u2153','2/3':'\u2154','1/4':'\u00BC','3/4':'\u00BE',
    '1/5':'\u2155','2/5':'\u2156','3/5':'\u2157','4/5':'\u2158',
    '1/6':'\u2159','5/6':'\u215A','1/8':'\u215B','3/8':'\u215C','5/8':'\u215D','7/8':'\u215E'
  };
  if(known[expr]) return known[expr];
  const parts=expr.split('/');
  if(parts.length<2) return '';
  const num=parts.shift().trim();
  const den=parts.join('/').trim();
  if(!num || !den) return '';
  const n=num.length>1 ? `(${num})` : num;
  const d=den.length>1 ? `(${den})` : den;
  return `${toSuperText(n)}\u2044${toSubText(d)}`;
}

function applyInlineFraction(el, expr=''){
  const s=el.selectionStart||0, e=el.selectionEnd||0;
  const selected=expr || el.value.slice(s,e);
  const out=buildInlineFractionText(selected);
  if(!out){
    openEquationBuilder('fraction', el, selected);
    return;
  }
  el.value=el.value.slice(0,s)+out+el.value.slice(e);
  el.selectionStart=s;
  el.selectionEnd=s+out.length;
  el.focus();
  autoGrowTextBox(el);
}

function getActiveEditorKey(){
  return activeTextTarget ? activeTextTarget.replace(/FloatingText$/,'') : '';
}

function openEquationBuilder(kind, el, preset=''){
  const key=getActiveEditorKey();
  const wrapBody=(fields)=>`
    <div class="eq-studio-builder">
      ${fields}
      <div class="field">
        <label>Rendered Preview</label>
        <div class="eq-studio-preview" id="eqBuilderPreview"><div class="preview-empty">Rendered preview appears here.</div></div>
      </div>
      <div class="modal-actions">
        <button class="btn" type="button" id="eqInsertBtn">Insert Into Editor</button>
        <button class="btn pri" type="button" id="eqRenderBtn">Render To Figure</button>
        <button class="btn" type="button" onclick="closeModal()">Cancel</button>
      </div>
    </div>
  `;
  const configs = {
    fraction:{
      title:'Fraction Builder',
      subtitle:'Build a proper fraction using visible numerator and denominator fields.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Numerator</label><input id="eqTop" type="text" placeholder="e.g. a+b"></div>
          <div class="field"><label>Denominator</label><input id="eqBottom" type="text" placeholder="e.g. c+d"></div>
          <div class="field" style="grid-column:1 / -1"><label>Or Paste Full Fraction</label><input id="eqFracExpr" type="text" value="${escA(String(preset||'').trim())}" placeholder="e.g. (a+b)/(c+d)"></div>
        </div>
      `),
      build:()=>{
        const expr=(document.getElementById('eqFracExpr')?.value || '').trim();
        if(expr && expr.includes('/')) return expr;
        const top=(document.getElementById('eqTop')?.value || '').trim();
        const bottom=(document.getElementById('eqBottom')?.value || '').trim();
        return `\\frac{${top||'a'}}{${bottom||'b'}}`;
      }
    },
    limit:{
      title:'Limit Builder',
      subtitle:'Build a limit with lower approach text and a main expression.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Variable</label><input id="eqVar" type="text" placeholder="e.g. x"></div>
          <div class="field"><label>Approaches</label><input id="eqTo" type="text" placeholder="e.g. 0 or \\infty"></div>
          <div class="field" style="grid-column:1 / -1"><label>Expression</label><input id="eqExpr" type="text" placeholder="e.g. \\frac{\\sin x}{x}"></div>
        </div>
      `),
      build:()=>{
        const v=(document.getElementById('eqVar')?.value || 'x').trim();
        const t=(document.getElementById('eqTo')?.value || '0').trim();
        const ex=(document.getElementById('eqExpr')?.value || 'f(x)').trim();
        return `\\lim_{${v} \\to ${t}} ${ex}`;
      }
    },
    integral:{
      title:'Integral Builder',
      subtitle:'Use lower and upper text boxes like a real equation builder, then add integrand and variable.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Lower Limit</label><input id="eqLower" type="text" placeholder="e.g. 0"></div>
          <div class="field"><label>Upper Limit</label><input id="eqUpper" type="text" placeholder="e.g. \\infty"></div>
          <div class="field"><label>Integrand</label><input id="eqExpr" type="text" placeholder="e.g. e^{-x}"></div>
          <div class="field"><label>Variable</label><input id="eqVar" type="text" placeholder="e.g. x"></div>
        </div>
      `),
      build:()=>{
        const lo=(document.getElementById('eqLower')?.value || 'a').trim();
        const hi=(document.getElementById('eqUpper')?.value || 'b').trim();
        const ex=(document.getElementById('eqExpr')?.value || 'f(x)').trim();
        const v=(document.getElementById('eqVar')?.value || 'x').trim();
        return `\\int_{${lo}}^{${hi}} ${ex}\\, d${v}`;
      }
    },
    summation:{
      title:'Summation Builder',
      subtitle:'Build a sigma expression with lower and upper boxes plus the main term.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Index Variable</label><input id="eqVar" type="text" placeholder="e.g. n"></div>
          <div class="field"><label>Starts From</label><input id="eqLower" type="text" placeholder="e.g. 1"></div>
          <div class="field"><label>Upper Limit</label><input id="eqUpper" type="text" placeholder="e.g. \\infty"></div>
          <div class="field" style="grid-column:1 / -1"><label>Term</label><input id="eqExpr" type="text" placeholder="e.g. a_n or \\frac{1}{n^2}"></div>
        </div>
      `),
      build:()=>{
        const v=(document.getElementById('eqVar')?.value || 'n').trim();
        const lo=(document.getElementById('eqLower')?.value || '1').trim();
        const hi=(document.getElementById('eqUpper')?.value || '\\infty').trim();
        const ex=(document.getElementById('eqExpr')?.value || 'a_n').trim();
        return `\\sum_{${v}=${lo}}^{${hi}} ${ex}`;
      }
    },
    radical:{
      title:'Radical Builder',
      subtitle:'Build square-root and n-th-root expressions without typing the template yourself.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Index</label><input id="eqIndex" type="text" placeholder="leave blank for square root"></div>
          <div class="field" style="grid-column:1 / -1"><label>Expression</label><input id="eqExpr" type="text" placeholder="e.g. x^2+y^2"></div>
        </div>
      `),
      build:()=>{
        const idx=(document.getElementById('eqIndex')?.value || '').trim();
        const ex=(document.getElementById('eqExpr')?.value || 'x').trim();
        return idx ? `\\sqrt[${idx}]{${ex}}` : `\\sqrt{${ex}}`;
      }
    },
    function:{
      title:'Function Builder',
      subtitle:'Insert common professional math function forms.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Function</label>
            <select id="eqFn">
              <option>sin</option><option>cos</option><option>tan</option><option>log</option><option>ln</option><option>max</option><option>min</option><option>det</option><option>Pr</option>
            </select>
          </div>
          <div class="field"><label>Argument</label><input id="eqExpr" type="text" placeholder="e.g. x or θ"></div>
        </div>
      `),
      build:()=>{
        const fn=(document.getElementById('eqFn')?.value || 'sin').trim();
        const ex=(document.getElementById('eqExpr')?.value || 'x').trim();
        return `\\${fn}(${ex})`;
      }
    },
    accent:{
      title:'Accent Builder',
      subtitle:'Insert hats, bars, vectors, dots, and tildes on symbols.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Base Symbol</label><input id="eqExpr" type="text" placeholder="e.g. x or AB"></div>
          <div class="field"><label>Accent</label>
            <select id="eqAccent">
              <option value="hat">Hat</option>
              <option value="bar">Bar</option>
              <option value="vec">Vector</option>
              <option value="dot">Dot</option>
              <option value="ddot">Double Dot</option>
              <option value="tilde">Tilde</option>
            </select>
          </div>
        </div>
      `),
      build:()=>{
        const ex=(document.getElementById('eqExpr')?.value || 'x').trim();
        const accent=document.getElementById('eqAccent')?.value || 'hat';
        return `\\${accent}{${ex}}`;
      }
    },
    matrix:{
      title:'Matrix Builder',
      subtitle:'Insert a quick text matrix block like a professional equation placeholder.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Rows</label><input id="eqRows" type="number" min="1" max="4" value="2"></div>
          <div class="field"><label>Columns</label><input id="eqCols" type="number" min="1" max="4" value="2"></div>
        </div>
      `),
      build:()=>{
        const rows=Math.max(1, Math.min(4, +(document.getElementById('eqRows')?.value || 2)));
        const cols=Math.max(1, Math.min(4, +(document.getElementById('eqCols')?.value || 2)));
        const lines=[];
        for(let r=0;r<rows;r++){
          lines.push(Array.from({length:cols},(_,c)=>`a${r+1}${c+1}`).join(' & '));
        }
        return `\\begin{bmatrix}${lines.join('\\\\')}\\end{bmatrix}`;
      }
    },
    bracket:{
      title:'Bracket Builder',
      subtitle:'Insert bracketed expressions like Word equation structures.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Bracket Type</label>
            <select id="eqBracket">
              <option value="()">()</option>
              <option value="[]">[]</option>
              <option value="{}">{ }</option>
              <option value="||">||</option>
              <option value="⟨⟩">⟨ ⟩</option>
            </select>
          </div>
          <div class="field"><label>Expression</label><input id="eqExpr" type="text" placeholder="e.g. x+y"></div>
        </div>
      `),
      build:()=>{
        const br=document.getElementById('eqBracket')?.value || '()';
        const ex=(document.getElementById('eqExpr')?.value || 'x').trim();
        const pairs={'()':['\\left(','\\right)'],'[]':['\\left[','\\right]'],'{}':['\\left\\{','\\right\\}'],'||':['\\left|','\\right|'],'⟨⟩':['\\left\\langle','\\right\\rangle']};
        const pair=pairs[br] || ['\\left(','\\right)'];
        return `${pair[0]} ${ex} ${pair[1]}`;
      }
    },
    script:{
      title:'Script Builder',
      subtitle:'Insert base with superscript and subscript together.',
      body:wrapBody(`
        <div class="modal-grid">
          <div class="field"><label>Base</label><input id="eqBase" type="text" placeholder="e.g. x"></div>
          <div class="field"><label>Superscript</label><input id="eqUpper" type="text" placeholder="e.g. 2"></div>
          <div class="field"><label>Subscript</label><input id="eqLower" type="text" placeholder="e.g. 0"></div>
        </div>
      `),
      build:()=>{
        const base=(document.getElementById('eqBase')?.value || 'x').trim();
        const hi=(document.getElementById('eqUpper')?.value || '').trim();
        const lo=(document.getElementById('eqLower')?.value || '').trim();
        return `${base}${lo?`_{${lo}}`:''}${hi?`^{${hi}}`:''}`;
      }
    }
  };
  const cfg=configs[kind];
  if(!cfg) return;
  openModal({ title:cfg.title, subtitle:cfg.subtitle, closable:true, body:cfg.body });
  const renderPreview=()=>renderTexPreviewInto(document.getElementById('eqBuilderPreview'), cfg.build());
  document.querySelectorAll('#appModalBody input, #appModalBody select, #appModalBody textarea').forEach(node=>{
    node.addEventListener('input', renderPreview);
    node.addEventListener('change', renderPreview);
  });
  renderPreview();
  const insertBtn=document.getElementById('eqInsertBtn');
  if(insertBtn) insertBtn.onclick=()=>{
    const out=cfg.build();
    if(!String(out||'').trim()){
      showNotice('Please fill the required equation fields.', cfg.title);
      return;
    }
    closeModal();
    insertAtCursor(el, out);
    autoGrowTextBox(el);
  };
  const renderBtn=document.getElementById('eqRenderBtn');
  if(renderBtn) renderBtn.onclick=async ()=>{
    const out=cfg.build();
    if(!String(out||'').trim()){
      showNotice('Please fill the required equation fields.', cfg.title);
      return;
    }
    if(!key){
      showNotice('Open the question or option paragraph editor first.', cfg.title);
      return;
    }
    renderBtn.disabled=true;
    renderBtn.textContent='Rendering...';
    try{
      const dataUrl=await renderTexToDataUrl(out);
      closeModal();
      placeRenderedEquationImage(key, dataUrl);
      toast('Equation rendered as figure');
    }catch(err){
      showNotice(err?.message || 'Equation rendering failed.', cfg.title);
      renderBtn.disabled=false;
      renderBtn.textContent='Render To Figure';
    }
  };
}

function getTexPresetExamples(){
  return [
    '\\int_0^\\infty e^{-x}\\,dx',
    '\\sum_{n=1}^{\\infty} \\frac{1}{n^2}',
    '\\lim_{x \\to 0} \\frac{\\sin x}{x}',
    '\\oint_C \\vec{E}\\cdot d\\vec{l}',
    '\\eta = \\sqrt{\\frac{j\\omega\\mu}{\\sigma + j\\omega\\epsilon}}'
  ];
}

function getLatexCatalog(){
  return {
    'Basic': [
      '+','-','=','\\neq','(',')','[',']','\\{','\\}','\\langle','\\rangle','\\lceil','\\rceil','\\lfloor','\\rfloor','\\cdot','\\cdots','\\vdots','\\ddots','\\%','\\hat{}','\\check{}','\\breve{}','\\acute{}','\\grave{}','\\tilde{}','\\bar{}','\\vec{}','\\dot{}','\\ddot{}'
    ],
    'Letters': [
      'a','b','c','x','y','z','A','B','C','X','Y','Z','\\mathbf{A}','\\mathbf{B}','\\mathbf{X}','\\mathbb{R}','\\mathbb{N}','\\mathbb{Z}','\\mathcal{L}','\\mathcal{F}','\\mathfrak{g}','\\mathscr{H}'
    ],
    'Relations': [
      '<','>','\\leq','\\geq','\\ll','\\gg','\\sim','\\simeq','\\approx','\\equiv','\\cong','\\propto','\\parallel','\\perp','\\mid','\\nmid','\\prec','\\succ','\\preceq','\\succeq','\\subset','\\supset','\\subseteq','\\supseteq'
    ],
    'Sets & Logic': [
      '\\in','\\notin','\\ni','\\emptyset','\\varnothing','\\complement','\\forall','\\exists','\\nexists','\\neg','\\lor','\\land','\\implies','\\iff','\\to','\\mapsto','\\therefore','\\because','\\infty','\\aleph','\\wp'
    ],
    'Operators': [
      '\\times','\\div','\\pm','\\mp','\\ast','\\star','\\circ','\\bullet','\\cap','\\cup','\\setminus','\\partial','\\nabla','\\int','\\iint','\\iiint','\\oint','\\sum','\\prod','\\coprod','\\bigoplus','\\bigotimes','\\bigcap','\\bigcup','\\rightarrow','\\leftarrow','\\Rightarrow','\\Leftarrow','\\Leftrightarrow'
    ],
    'Greek': [
      '\\alpha','\\beta','\\gamma','\\delta','\\epsilon','\\varepsilon','\\theta','\\lambda','\\mu','\\nu','\\pi','\\sigma','\\tau','\\phi','\\psi','\\omega','\\Gamma','\\Delta','\\Theta','\\Lambda','\\Pi','\\Sigma','\\Phi','\\Psi','\\Omega','\\eta','\\xi','\\rho','\\varrho','\\chi','\\upsilon','\\Upsilon'
    ],
    'Functions': [
      '\\sin','\\cos','\\tan','\\csc','\\sec','\\cot','\\arcsin','\\arccos','\\arctan','\\sinh','\\cosh','\\tanh','\\ln','\\log','\\exp','\\lim_{n \\to \\infty}','\\max','\\min','\\sup','\\inf','\\det','\\ker','\\Pr'
    ],
    'Structures': [
      '\\frac{a}{b}','\\sqrt{x}','\\sqrt[n]{x}','\\sum_{i=1}^{n}','\\int_{a}^{b}','\\lim_{x\\to0}','x^{n}','x_{i}','x_{i}^{n}','\\binom{n}{r}','\\overline{AB}','\\vec{E}','\\begin{bmatrix}a & b\\\\ c & d\\end{bmatrix}','\\begin{pmatrix}a & b\\\\ c & d\\end{pmatrix}','\\left( \\frac{a+b}{c+d} \\right)'
    ],
    'Formulas': [
      'F = ma','E = mc^2','PV = nRT','x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}','\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}','e^{i\\pi}+1=0','A = \\pi r^2','C = 2\\pi r','V = \\frac{4}{3}\\pi r^3','\\cos(C)=\\frac{a^2+b^2-c^2}{2ab}','\\eta = \\sqrt{\\frac{j\\omega\\mu}{\\sigma + j\\omega\\epsilon}}'
    ]
  };
}

function getLatexCategories(){
  return Object.keys(getLatexCatalog());
}

async function renderTexToDataUrl(tex){
  const mj=await waitForMathJaxReady();
  if(!mj?.tex2svgPromise) throw new Error('MathJax is still loading');
  const node=await mj.tex2svgPromise(tex, { display:true });
  const svg=node.querySelector('svg');
  if(!svg) throw new Error('Equation render failed');
  svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
  svg.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
  svg.setAttribute('color','#000');
  const svgText=new XMLSerializer().serializeToString(svg);
  const blob=new Blob([svgText], { type:'image/svg+xml;charset=utf-8' });
  const url=URL.createObjectURL(blob);
  try{
    const img=await loadImg(url);
    const canvas=document.createElement('canvas');
    const naturalW=Math.max(32, Math.ceil(img.width||img.naturalWidth||320));
    const naturalH=Math.max(32, Math.ceil(img.height||img.naturalHeight||120));
    canvas.width=Math.round(naturalW*EXPORT_IMAGE_SCALE);
    canvas.height=Math.round(naturalH*EXPORT_IMAGE_SCALE);
    const ctx=canvas.getContext('2d');
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.scale(EXPORT_IMAGE_SCALE, EXPORT_IMAGE_SCALE);
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,naturalW,naturalH);
    ctx.drawImage(img,0,0,naturalW,naturalH);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function waitForMathJaxReady(timeoutMs=7000){
  const started=Date.now();
  return new Promise((resolve,reject)=>{
    const check=()=>{
      const mj=window.MathJax;
      if(mj?.tex2svgPromise){
        const startup=mj.startup?.promise;
        if(startup?.then){
          startup.then(()=>resolve(mj)).catch(reject);
        }else{
          resolve(mj);
        }
        return;
      }
      if(Date.now()-started>timeoutMs){
        reject(new Error('MathJax is still loading'));
        return;
      }
      setTimeout(check,80);
    };
    check();
  });
}

function placeRenderedEquationImage(key, dataUrl){
  loadImg(dataUrl).then(img=>{
    openImagePlacementBox(key, img, { mode:'insert' });
  }).catch(()=>{
    showNotice('Equation image could not be placed.', 'Equation');
  });
}

async function renderTexPreviewInto(el, tex){
  if(!el) return;
  const clean=String(tex||'').trim();
  if(!clean){
    el.innerHTML='<div class="preview-empty">Rendered preview appears here.</div>';
    return;
  }
  el.innerHTML='<div class="preview-empty">Rendering preview...</div>';
  try{
    const mj=await waitForMathJaxReady();
    if(!mj?.tex2svgPromise) throw new Error('MathJax is still loading');
    const node=await mj.tex2svgPromise(clean, { display:true });
    const svg=node.querySelector('svg');
    if(!svg) throw new Error('Preview render failed');
    svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
    svg.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
    svg.setAttribute('color','#000');
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.maxWidth='100%';
    svg.style.height='auto';
    el.innerHTML='';
    el.appendChild(svg);
  }catch(err){
    el.innerHTML=`<div class="preview-empty">${escH(err?.message || 'Preview render failed')}</div>`;
  }
}

function getComposerSourceText(key){
  if(!cur) return '';
  if(key==='q') return stripFigureMarkers(cur.questionText||'');
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return stripFigureMarkers(cur.options[idx]?.text||'');
  }
  return '';
}

function getComposerSourceHTML(key){
  if(!cur) return '';
  if(key==='q') return cur.questionComposerHTML || '';
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return cur.options[idx]?.composerHTML || '';
  }
  return '';
}

function getMixedComposerSnapshot(editor){
  if(!editor) return '';
  syncMixedComposerFractionInputs(editor);
  return editor.innerHTML;
}

function pushMixedComposerUndo(editor){
  if(!editor) return;
  const snap=getMixedComposerSnapshot(editor);
  if(mixedComposerUndoStack[mixedComposerUndoStack.length-1]!==snap){
    mixedComposerUndoStack.push(snap);
    if(mixedComposerUndoStack.length>40) mixedComposerUndoStack.shift();
  }
}

function undoMixedComposer(){
  const shell=document.querySelector('.modal-card:has(.mixed-composer)');
  if(shell && !document.getElementById('mixedComposerShellGrip')){ const grip=document.createElement('div'); grip.className='mixed-composer-shell-grip'; grip.id='mixedComposerShellGrip'; grip.title='Drag to resize composer'; shell.appendChild(grip); }
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  const current=getMixedComposerSnapshot(editor);
  if(mixedComposerUndoStack[mixedComposerUndoStack.length-1]!==current){
    mixedComposerUndoStack.push(current);
  }
  while(mixedComposerUndoStack.length>1 && mixedComposerUndoStack[mixedComposerUndoStack.length-1]===current){
    mixedComposerUndoStack.pop();
  }
  if(mixedComposerUndoStack.length<1) return;
  const prev=mixedComposerUndoStack[mixedComposerUndoStack.length-1];
  mixedComposerRestoring=true;
  editor.innerHTML=prev;
  cleanupMixedComposerFormatTails(editor);
  mixedComposerDraftHTML=editor.innerHTML;
  activeFractionInput=null;
  mixedComposerRange=null;
  editor.focus();
  restoreMixedComposerRange();
  mixedComposerRestoring=false;
}
function saveMixedComposerRange(){
  const editor=document.getElementById('mixedComposerEditor');
  const sel=window.getSelection?.();
  if(!editor || !sel || !sel.rangeCount) return;
  const range=sel.getRangeAt(0);
  if(editor.contains(range.commonAncestorContainer)) mixedComposerRange=range.cloneRange();
}

function restoreMixedComposerRange(){
  const editor=document.getElementById('mixedComposerEditor');
  const sel=window.getSelection?.();
  if(!editor || !sel) return;
  sel.removeAllRanges();
  if(mixedComposerRange && editor.contains(mixedComposerRange.commonAncestorContainer)){
    try{
      sel.addRange(mixedComposerRange);
      return;
    }catch(_){
      // Range is stale (e.g. its container was removed by cleanupMixedComposerFormatTails).
      // Fall through to the end-of-editor fallback below.
      mixedComposerRange=null;
    }
  }
  const range=document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  sel.addRange(range);
  mixedComposerRange=range.cloneRange();
}

function setMixedComposerCaretAtTextNode(textNode, offset=0){
  const sel=window.getSelection?.();
  if(!sel || !textNode) return;
  const range=document.createRange();
  range.setStart(textNode, Math.max(0, Math.min(textNode.textContent.length, offset)));
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  mixedComposerRange=range.cloneRange();
}

function insertMixedComposerLineBreak(options={}){
  const editor=document.getElementById('mixedComposerEditor');
  const sel=window.getSelection?.();
  if(!editor || !sel || !sel.rangeCount) return;
  if(!options.skipHistory) pushMixedComposerUndo(editor);
  const range=sel.getRangeAt(0);
  if(!editor.contains(range.commonAncestorContainer)) return;
  range.deleteContents();

  // Insert <br> so the browser actually renders a visual line break.
  // A lone trailing <br> needs a second <br> or a zero-width space after it
  // to force the cursor onto the new line in all browsers.
  const br=document.createElement('br');
  range.insertNode(br);

  // Ensure there is something after the <br> for the caret to sit on.
  // If the <br> is the last child (or followed only by another <br>),
  // append a zero-width space text node so the caret advances visually.
  let anchor=br.nextSibling;
  if(!anchor || (anchor.nodeType===1 && anchor.tagName==='BR')){
    const zws=document.createTextNode('\u200B');
    br.parentNode.insertBefore(zws, anchor || null);
    anchor=zws;
  }

  if(anchor.nodeType===3){
    setMixedComposerCaretAtTextNode(anchor, 0);
  } else {
    const parent=anchor.parentNode;
    const idx=Array.prototype.indexOf.call(parent.childNodes, anchor);
    const nextRange=document.createRange();
    nextRange.setStart(parent, idx);
    nextRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nextRange);
    mixedComposerRange=nextRange.cloneRange();
  }
  mixedComposerDraftHTML=editor.innerHTML;
}

function exitInlineComposerInputToTextLine(input, options={}){
  const editor=document.getElementById('mixedComposerEditor');
  const widget=input?.closest?.('.composer-inline-structure,.composer-inline-frac');
  if(!editor || !widget || !editor.contains(widget)) return false;
  if(!options.skipHistory) pushMixedComposerUndo(editor);
  const spacer=widget.nextSibling?.classList?.contains('composer-caret-spacer') ? widget.nextSibling : widget;
  const br=document.createElement('br');
  const tail=document.createTextNode('\u200B');
  spacer.after(br);
  br.after(tail);
  activeFractionInput=null;
  setMixedComposerCaretAtTextNode(tail, 0);
  mixedComposerDraftHTML=editor.innerHTML;
  editor.focus();
  return true;
}

function insertMixedComposerNormalLine(){
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  const active=document.activeElement;
  if(active?.classList?.contains('frac-input') || active?.classList?.contains('structure-input')){
    exitInlineComposerInputToTextLine(active);
    return;
  }
  insertMixedComposerLineBreak();
  editor.focus();
}

function getNextMixedComposerListNumber(editor){
  const existing=Array.from(editor?.querySelectorAll?.('[data-composer-list-number]') || [])
    .map(node=>Number.parseInt(node.dataset.composerListNumber, 10) || 0);
  return Math.max(0, ...existing) + 1;
}

function insertMixedComposerNumberedLine(){
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  const active=document.activeElement;
  let movedFromWidget=false;
  if(active?.classList?.contains('frac-input') || active?.classList?.contains('structure-input')){
    movedFromWidget=exitInlineComposerInputToTextLine(active);
  }
  if(!movedFromWidget){
    pushMixedComposerUndo(editor);
    const hasContent=String(editor.textContent||'').replace(/[\u200B\u2060\s]/g,'').length>0 || !!editor.querySelector('.composer-inline-structure,.composer-inline-frac,.composer-eq-token,.composer-inline-image');
    if(hasContent) insertMixedComposerLineBreak({skipHistory:true});
    else { editor.focus(); restoreMixedComposerRange(); }
  }
  const sel=window.getSelection?.();
  const range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if(!range || !editor.contains(range.commonAncestorContainer)) return;
  range.deleteContents();
  const marker=document.createElement('span');
  marker.className='composer-list-marker';
  marker.dataset.composerListNumber=String(getNextMixedComposerListNumber(editor));
  marker.contentEditable='false';
  marker.textContent=marker.dataset.composerListNumber+') ';
  const tail=document.createTextNode('\u200B');
  range.insertNode(marker);
  marker.after(tail);
  setMixedComposerCaretAtTextNode(tail, 0);
  mixedComposerDraftHTML=editor.innerHTML;
  editor.focus();
}

function makeComposerPlainTail(){
  const tail=document.createElement('span');
  tail.dataset.formatTail='1';
  tail.style.fontWeight='400';
  tail.style.fontStyle='normal';
  tail.style.textDecoration='none';
  tail.appendChild(document.createTextNode('\u200B'));
  return tail;
}

function cleanupMixedComposerFormatTails(editor){
  if(!editor) return;
  editor.querySelectorAll('span[data-format-tail="1"]').forEach(tail=>{
    const txt=tail.textContent || '';
    if(txt.replace(/[\u200B\u2060\s]/g,'')) return;
    const sel=window.getSelection?.();
    const activeRange=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    const caretInside=activeRange && tail.contains(activeRange.startContainer);
    if(caretInside) return;
    // Also protect tails that mixedComposerRange points into — removing them
    // would leave a stale range and silently kill text insertion.
    if(mixedComposerRange && tail.contains(mixedComposerRange.startContainer)) return;
    tail.remove();
  });
}

function syncMixedComposerFractionInputs(editor){
  if(!editor) return;
  editor.querySelectorAll('.composer-inline-frac .frac-input').forEach(input=>{
    const before=input.value || '';
    const after=/[\\^_]/.test(before) ? before : normalizeInlinePowerNotation(before);
    if(after!==before){
      const pos=input.selectionStart ?? after.length;
      input.value=after;
      input.selectionStart=input.selectionEnd=Math.max(0, Math.min(after.length, pos-(before.length-after.length)));
    }
    input.setAttribute('value', input.value || '');
  });
  editor.querySelectorAll('.composer-inline-structure .structure-input').forEach(input=>{
    const before=input.value || '';
    const after=/[\\^_]/.test(before) ? before : normalizeInlinePowerNotation(before);
    if(after!==before){
      const pos=input.selectionStart ?? after.length;
      input.value=after;
      input.selectionStart=input.selectionEnd=Math.max(0, Math.min(after.length, pos-(before.length-after.length)));
    }
    input.setAttribute('value', input.value || '');
    autoSizeInlineStructureInput(input);
  });
}
function escapeMixedComposerFormattedCaret(){
  const editor=document.getElementById('mixedComposerEditor');
  const sel=window.getSelection?.();
  if(!editor || !sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const range=sel.getRangeAt(0);
  if(!editor.contains(range.commonAncestorContainer)) return false;
  let node=range.startContainer.nodeType===1 ? range.startContainer : range.startContainer.parentNode;
  while(node && node!==editor && !/^(STRONG|B|EM|I|U|SUP|SUB)$/i.test(node.nodeName)){
    node=node.parentNode;
  }
  if(!node || node===editor) return false;
  const tail=makeComposerPlainTail();
  node.parentNode.insertBefore(tail, node.nextSibling);
  const tailText=tail.firstChild;
  const nextRange=document.createRange();
  nextRange.setStart(tailText, tailText.textContent.length);
  nextRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(nextRange);
  mixedComposerRange=nextRange.cloneRange();
  mixedComposerDraftHTML=editor.innerHTML;
  return true;
}

function wrapMixedComposerSelection(tagName, emptyMessage){
  const editor=document.getElementById('mixedComposerEditor');
  const sel=window.getSelection?.();
  if(!editor || !sel || !sel.rangeCount){
    if(emptyMessage!=='') toast(emptyMessage || 'Select text first');
    return false;
  }
  let range=sel.getRangeAt(0);
  if(sel.isCollapsed){
    if(emptyMessage!=='') toast(emptyMessage || 'Select text first');
    return false;
  }
  if(!editor.contains(range.commonAncestorContainer)){
    if(emptyMessage!=='') toast(emptyMessage || 'Select text first');
    return false;
  }
  const wrapper=document.createElement(tagName);
  try{
    const frag=range.extractContents();
    wrapper.appendChild(frag);
    range.insertNode(wrapper);
    const tail=makeComposerPlainTail();
    wrapper.parentNode.insertBefore(tail, wrapper.nextSibling);
    const tailText=tail.firstChild;
    range.setStart(tailText, tailText.textContent.length);
    range.setEnd(tailText, tailText.textContent.length);
    sel.removeAllRanges();
    sel.addRange(range);
    mixedComposerRange=range.cloneRange();
    mixedComposerDraftHTML=editor.innerHTML;
    try{ document.execCommand('removeFormat', false, null); }catch(_){}
    return true;
  }catch(_){
    return false;
  }
}

function isComposerNestedScriptCandidate(node){
  return !!(node && node.nodeType===1 && /^(SUP|SUB)$/i.test(node.nodeName));
}

function wrapExistingComposerNode(node, tagName){
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor || !node || !editor.contains(node) || !node.parentNode) return false;
  if(!isComposerNestedScriptCandidate(node)) return false;
  const wrapper=document.createElement(tagName);
  node.parentNode.insertBefore(wrapper, node);
  wrapper.appendChild(node);
  const tail=makeComposerPlainTail();
  wrapper.parentNode.insertBefore(tail, wrapper.nextSibling);
  const tailText=tail.firstChild;
  const sel=window.getSelection?.();
  if(sel){
    const nextRange=document.createRange();
    nextRange.setStart(tailText, tailText.textContent.length);
    nextRange.setEnd(tailText, tailText.textContent.length);
    sel.removeAllRanges();
    sel.addRange(nextRange);
    mixedComposerRange=nextRange.cloneRange();
  }
  mixedComposerDraftHTML=editor.innerHTML;
  return true;
}

function getPreviousComposerScriptCandidate(node, offset){
  if(!node) return null;
  if(node.nodeType===1){
    if((Number(offset)||0)<=0) return null;
    const child=node.childNodes[Math.max(0, offset-1)];
    return isComposerNestedScriptCandidate(child) ? child : null;
  }
  if(node.nodeType!==3) return null;
  let host=node.parentNode;
  if(host?.nodeType===1 && host.dataset?.formatTail==='1'){
    let prev=host.previousSibling;
    while(prev?.nodeType===3 && !String(prev.nodeValue||'').replace(/[\s\u200B\u2060]/g,'')) prev=prev.previousSibling;
    return isComposerNestedScriptCandidate(prev) ? prev : null;
  }
  return null;
}

function wrapPreviousComposerCharacter(tagName){
  const editor=document.getElementById('mixedComposerEditor');
  const sel=window.getSelection?.();
  if(!editor || !sel || !sel.rangeCount || !sel.isCollapsed) return false;
  const range=sel.getRangeAt(0);
  if(!editor.contains(range.commonAncestorContainer)) return false;
  let node=range.startContainer;
  let offset=range.startOffset;
  if(node.nodeType!==3){
    const child=node.childNodes[Math.max(0, offset-1)];
    if(child?.nodeType===3){
      node=child;
      offset=node.nodeValue.length;
    }else if(wrapExistingComposerNode(getPreviousComposerScriptCandidate(node, offset), tagName)){
      return true;
    }else{
      return false;
    }
  }
  if(offset<=0 || !node.nodeValue) return false;
  let start=offset-1;
  while(start>=0 && /[\s\u200B\u2060]/.test(node.nodeValue[start])) start--;
  if(start<0) return wrapExistingComposerNode(getPreviousComposerScriptCandidate(node, offset), tagName);
  const pick=range.cloneRange();
  pick.setStart(node, start);
  pick.setEnd(node, start+1);
  const wrapper=document.createElement(tagName);
  const frag=pick.extractContents();
  wrapper.appendChild(frag);
  pick.insertNode(wrapper);
  const tail=makeComposerPlainTail();
  wrapper.parentNode.insertBefore(tail, wrapper.nextSibling);
  const tailText=tail.firstChild;
  const next=window.getSelection();
  const nextRange=document.createRange();
  nextRange.setStart(tailText, tailText.textContent.length);
  nextRange.setEnd(tailText, tailText.textContent.length);
  next.removeAllRanges();
  next.addRange(nextRange);
  mixedComposerRange=nextRange.cloneRange();
  mixedComposerDraftHTML=editor.innerHTML;
  return true;
}

function formatMixedComposer(cmd){
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  pushMixedComposerUndo(editor);
  const focused=(document.activeElement?.classList?.contains('frac-input') || document.activeElement?.classList?.contains('structure-input') ? document.activeElement : null);
  const active=focused || (activeFractionInput?.isConnected ? activeFractionInput : null);
  if(active?.classList?.contains('frac-input') || active?.classList?.contains('structure-input')){
    if(cmd==='superscript' || cmd==='subscript' || cmd==='bold' || cmd==='italic' || cmd==='underline'){
      const value=active.value||'';
      const s=active.selectionStart ?? value.length;
      const e=active.selectionEnd ?? value.length;
      if(cmd==='superscript' || cmd==='subscript'){
        const marker=cmd==='superscript' ? '^' : '_';
        if(s===e){
          active.dataset.scriptMode=cmd==='superscript' ? 'sup' : 'sub';
          active.focus();
          return;
        }
        const picked=value.slice(s,e);
        const pickedScript=unwrapLeadingLatexScriptSource(picked);
        const insert=marker+'{'+stripSingleLatexGroup(pickedScript.body)+'}';
        active.value=value.slice(0,s)+insert+value.slice(e);
        active.setAttribute('value', active.value || '');
        active.selectionStart=active.selectionEnd=s+insert.length;
        delete active.dataset.scriptMode;
        activeFractionInput=active;
        if(editor){ syncMixedComposerFractionInputs(editor); mixedComposerDraftHTML=editor.innerHTML; }
        active.focus();
        return;
      }
      if(s===e){
        if(s<=0){
          active.focus();
          return;
        }
        const picked=value.slice(s-1,s);
        const converted=[...picked].map(ch=>styleChar(ch, cmd)).join('');
        active.value=value.slice(0,s-1)+converted+value.slice(e);
        active.setAttribute('value', active.value || '');
        active.selectionStart=active.selectionEnd=s-1+converted.length;
        activeFractionInput=active;
        mixedComposerDraftHTML=editor.innerHTML;
        active.focus();
        return;
      }
      const picked=value.slice(s,e);
      const converted=[...picked].map(ch=>styleChar(ch, cmd)).join('');
      active.value=value.slice(0,s)+converted+value.slice(e);
      active.setAttribute('value', active.value || '');
      active.selectionStart=active.selectionEnd=s+converted.length;
      activeFractionInput=active;
      mixedComposerDraftHTML=editor.innerHTML;
      active.focus();
    }
    return;
  }
  editor.focus();
  restoreMixedComposerRange();
  if(cmd!=='bold' && cmd!=='italic' && cmd!=='underline' && cmd!=='superscript' && cmd!=='subscript'){
    escapeMixedComposerFormattedCaret();
  }
  if(cmd==='superscript' || cmd==='subscript'){
    const tag=cmd==='superscript' ? 'sup' : 'sub';
    if(!wrapMixedComposerSelection(tag, '') && !wrapPreviousComposerCharacter(tag)){
      toast(`Select text first, or place the cursor after a letter, then press ${cmd==='superscript'?'Sup':'Sub'}`);
    }
  } else if(cmd==='bold' || cmd==='italic' || cmd==='underline'){
    const tag = cmd==='bold' ? 'strong' : (cmd==='italic' ? 'em' : 'u');
    if(!wrapMixedComposerSelection(tag, '') && !wrapPreviousComposerCharacter(tag)){
      toast(`Select text first, or place the cursor after a letter, then press ${cmd[0].toUpperCase()+cmd.slice(1)}.`);
    }
  } else {
    try{ document.execCommand(cmd,false,null); }catch(_){}
  }
  syncMixedComposerFractionInputs(editor);
  cleanupMixedComposerFormatTails(editor);
  mixedComposerDraftHTML=editor.innerHTML;
  saveMixedComposerRange();
}

function insertIntoFocusedFractionInput(text, caretOffsetFromEnd=0){
  const editor=document.getElementById('mixedComposerEditor');
  const focused=(document.activeElement?.classList?.contains('frac-input') || document.activeElement?.classList?.contains('structure-input') ? document.activeElement : null);
  const active=focused || (activeFractionInput?.isConnected ? activeFractionInput : null);
  if(!active?.classList?.contains('frac-input') && !active?.classList?.contains('structure-input')) return false;
  pushMixedComposerUndo(editor);
  const value=active.value||'';
  const s=active.selectionStart ?? value.length;
  const e=active.selectionEnd ?? value.length;
  let insert=String(text||'');
  let caretOffset=Number(caretOffsetFromEnd)||0;
  const pendingScript=active.dataset.scriptMode;
  if(pendingScript==='sup' || pendingScript==='sub'){
    const marker=pendingScript==='sup' ? '^' : '_';
    const insertedScript=unwrapLeadingLatexScriptSource(insert);
    insert=marker+'{'+stripSingleLatexGroup(insertedScript.body)+'}';
    caretOffset=0;
    delete active.dataset.scriptMode;
  }
  active.value=value.slice(0,s)+insert+value.slice(e);
  active.setAttribute('value', active.value || '');
  const caret=Math.max(0, Math.min(active.value.length, s+insert.length+caretOffset));
  active.selectionStart=active.selectionEnd=caret;
  if(editor){ syncMixedComposerFractionInputs(editor); mixedComposerDraftHTML=editor.innerHTML; }
  active.focus();
  return true;
}

function bindInlineComposerInputs(wrapper, selector, firstSelector){
  const editor=document.getElementById('mixedComposerEditor');
  const firstInput=wrapper.querySelector(firstSelector || selector);
  wrapper.querySelectorAll(selector).forEach(input=>{
    autoSizeInlineStructureInput(input);
    input.addEventListener('focus',()=>{ activeFractionInput=input; });
    input.addEventListener('click',()=>{ activeFractionInput=input; });
    input.addEventListener('keydown', event=>{
      if(event.key!=='Enter' || event.shiftKey) return;
      event.preventDefault();
      // Enter from any nested equation field resumes ordinary statement typing
      // on a clean line immediately after that equation widget.
      exitInlineComposerInputToTextLine(input);
    });
    input.addEventListener('beforeinput',(e)=>{
      const mode=input.dataset.scriptMode;
      if(!mode || e.inputType!=='insertText' || !e.data) return;
      e.preventDefault();
      const value=input.value||'';
      const s=input.selectionStart ?? value.length;
      const end=input.selectionEnd ?? value.length;
      const marker=mode==='sup' ? '^' : '_';
      const insert=marker+'{'+stripSingleLatexGroup(e.data)+'}';
      input.value=value.slice(0,s)+insert+value.slice(end);
      input.setAttribute('value', input.value || '');
      input.selectionStart=input.selectionEnd=s+insert.length;
      delete input.dataset.scriptMode;
      input.dispatchEvent(new Event('input',{bubbles:true}));
    });
    input.addEventListener('blur',()=>{
      setTimeout(()=>{
        const ae=document.activeElement;
        const stillComposerTool=ae?.closest?.('.composer-eq-tabs,.composer-eq-palette,.composer-eq-toolrow,.mixed-composer-toolbar,.mixed-composer-mathbox,.canvas-textbox');
        if(document.activeElement===input || stillComposerTool) return;
        if(activeFractionInput===input) activeFractionInput=null;
      },0);
    });
    input.addEventListener('input',()=>{
      input.setAttribute('value', input.value || '');
      autoSizeInlineStructureInput(input);
      const liveEditor=document.getElementById('mixedComposerEditor');
      if(liveEditor){ syncMixedComposerFractionInputs(liveEditor); mixedComposerDraftHTML=liveEditor.innerHTML; pushMixedComposerUndo(liveEditor); }
    });
  });
  if(editor){ syncMixedComposerFractionInputs(editor); mixedComposerDraftHTML=editor.innerHTML; }
  if(firstInput) setTimeout(()=>firstInput.focus(),0);
}

function autoSizeInlineStructureInput(input){
  if(!input?.classList?.contains('structure-input')) return;
  if(input.classList.contains('matrix-cell-input')){
    input.style.width='100%';
    return;
  }
  const raw=String(input.value || input.getAttribute('value') || input.placeholder || '');
  const compact=raw.length || 1;
  const min=input.classList.contains('structure-main') ? 28 : input.classList.contains('structure-var') ? 12 : 15;
  const inLargeBracket=!!input.closest?.('.largeParen,.largeBracket,.largeBrace');
  const max=input.classList.contains('structure-main') ? (inLargeBracket ? 420 : 260) : input.classList.contains('structure-var') ? 56 : 96;
  const factor=input.classList.contains('structure-main') ? 8 : input.classList.contains('structure-var') ? 5 : 6;
  const pad=input.classList.contains('structure-var') ? 5 : 10;
  const px=Math.max(min, Math.min(max, compact * factor + pad));
  input.style.width=px+'px';
}

function createComposerCaretSpacer(){
  const gap=document.createElement('span');
  gap.className='composer-caret-spacer';
  gap.appendChild(document.createTextNode(' '));
  return gap;
}

function moveComposerCaretIntoSpacer(gap){
  const sel=window.getSelection();
  if(!sel || !gap?.firstChild) return;
  const range=document.createRange();
  range.setStart(gap.firstChild, gap.firstChild.textContent.length);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  mixedComposerRange=range.cloneRange();
}

function insertInlineFractionWidget(num='a', den='b', variant='stacked'){
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  const focused=(document.activeElement?.classList?.contains('frac-input') || document.activeElement?.classList?.contains('structure-input') ? document.activeElement : null);
  const active=focused || (activeFractionInput?.isConnected ? activeFractionInput : null);
  if(active?.classList?.contains('frac-input') || active?.classList?.contains('structure-input')){
    insertIntoFocusedFractionInput(getInlineFractionInputText(num, den, variant));
    return;
  }
  pushMixedComposerUndo(editor);
  editor.focus();
  restoreMixedComposerRange();
  escapeMixedComposerFormattedCaret();
  const frac=document.createElement('span');
  frac.className='composer-inline-frac';
  if(variant==='slash') frac.classList.add('slash');
  if(variant==='linear') frac.classList.add('linear');
  if(variant==='small') frac.classList.add('small');
  frac.dataset.variant=variant;
  frac.contentEditable='false';
  frac.innerHTML=`
    <input class="frac-input frac-num" value="${escA(num)}" aria-label="Numerator">
    <span class="frac-line"></span>
    <input class="frac-input frac-den" value="${escA(den)}" aria-label="Denominator">
  `;
  const sel=window.getSelection();
  const range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if(range){
    range.deleteContents();
    range.insertNode(frac);
    const gap=createComposerCaretSpacer();
    frac.after(gap);
    moveComposerCaretIntoSpacer(gap);
  } else {
    editor.appendChild(frac);
    const gap=createComposerCaretSpacer();
    editor.appendChild(gap);
    moveComposerCaretIntoSpacer(gap);
  }
  mixedComposerDraftHTML=editor.innerHTML;
  bindInlineComposerInputs(frac, '.frac-input', '.frac-num');
}

function insertFreeComposerBracketPair(kind='largeParen'){
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  const [leftChar,rightChar]=getLargeBracketChars(kind);
  pushMixedComposerUndo(editor);
  editor.focus();
  restoreMixedComposerRange();
  escapeMixedComposerFormattedCaret();
  const left=document.createElement('span');
  left.className='composer-free-bracket composer-free-bracket-left';
  left.dataset.bracketKind=kind;
  left.dataset.bracketChar=leftChar;
  left.contentEditable='false';
  left.textContent=leftChar;
  const middle=document.createTextNode('\u200B');
  const right=document.createElement('span');
  right.className='composer-free-bracket composer-free-bracket-right';
  right.dataset.bracketKind=kind;
  right.dataset.bracketChar=rightChar;
  right.contentEditable='false';
  right.textContent=rightChar;
  const sel=window.getSelection();
  const range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if(range){
    range.deleteContents();
    range.insertNode(right);
    range.insertNode(middle);
    range.insertNode(left);
  } else {
    editor.appendChild(left);
    editor.appendChild(middle);
    editor.appendChild(right);
  }
  const nextRange=document.createRange();
  nextRange.setStart(middle, middle.textContent.length);
  nextRange.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(nextRange);
  mixedComposerRange=nextRange.cloneRange();
  mixedComposerDraftHTML=editor.innerHTML;
}

function insertInlineStructureWidget(kind='integral', preset='', options={}){
  if(kind==='matrix'){
    insertInlineMatrixWidget(2, 2);
    return;
  }
  const active=(document.activeElement?.classList?.contains('frac-input') || document.activeElement?.classList?.contains('structure-input'))
    ? document.activeElement
    : (activeFractionInput?.isConnected ? activeFractionInput : null);
  if(active && !options.forceEditor){
    const insertion=getStructureInlineInputInsert(kind, preset);
    insertIntoFocusedFractionInput(insertion.text, insertion.caretOffset);
    return;
  }
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  pushMixedComposerUndo(editor);
  editor.focus();
  restoreMixedComposerRange();
  escapeMixedComposerFormattedCaret();
  const wrap=document.createElement('span');
  wrap.className='composer-inline-structure ' + kind;
  wrap.dataset.kind=kind;
  wrap.contentEditable='false';
  if(kind==='summation'){
    wrap.innerHTML=`
      <span class="structure-symbol">
        <input class="structure-input structure-limit structure-upper" placeholder="n" aria-label="Upper limit">
        <span>∑</span>
        <input class="structure-input structure-limit structure-lower" placeholder="i=1" aria-label="Lower limit">
      </span>
      <input class="structure-input structure-main structure-expr" placeholder="aᵢ" aria-label="Term">
    `;
  } else if(kind==='summationPlain'){
    wrap.innerHTML=`
      <span class="structure-symbol"><span>∑</span></span>
      <input class="structure-input structure-main structure-expr" placeholder="term" aria-label="Term">
    `;
  } else if(kind==='vector'){
    wrap.innerHTML=`
      <span class="structure-symbol">→</span>
      <input class="structure-input structure-main structure-expr" ${preset?`value="${escA(preset)}"`:'placeholder="A"'} aria-label="Vector symbol">
    `;
  } else if(kind==='visualEquation'){
    wrap.innerHTML=`
      <span class="structure-symbol function-symbol">ƒ</span>
      <input class="structure-input structure-main structure-expr" ${preset?`value="${escA(preset)}"`:'placeholder="x_bar, A^2, y_i"'} aria-label="Visual equation expression">
    `;
  } else if(isLargeBracketStructureKind(kind)){
    const [left,right]=getLargeBracketChars(kind);
    wrap.innerHTML=`
      <span class="structure-big-bracket structure-left">${escH(left)}</span>
      <input class="structure-input structure-main structure-expr" placeholder="expression" aria-label="Bracket expression">
      <span class="structure-big-bracket structure-right">${escH(right)}</span>
    `;
  } else if(isRootStructureKind(kind)){
    const indexValue=kind==='rootCube' ? '3' : '';
    wrap.innerHTML=`
      <span class="structure-root">
        ${kind==='rootNth' ? '<input class="structure-input structure-limit structure-root-index" placeholder="n" aria-label="Root index">' : indexValue ? `<span class="structure-root-index fixed">${indexValue}</span>` : ''}
        <span class="structure-root-symbol">√</span>
        <span class="structure-root-bar"></span>
      </span>
      <input class="structure-input structure-main structure-expr structure-radicand" placeholder="x" aria-label="Radicand">
    `;
  } else if(isFunctionStructureKind(kind)){
    const label=getFunctionStructureLabel(kind);
    wrap.innerHTML=kind==='expFunc' ? `
      <span class="structure-symbol function-symbol">e</span>
      <sup><input class="structure-input structure-main structure-expr" placeholder="x" aria-label="Exponent"></sup>
    ` : isDelimitedFunctionStructureKind(kind) ? `
      <span class="structure-big-bracket structure-left">${escH(getFunctionStructureDelimiters(kind)[0])}</span>
      <input class="structure-input structure-main structure-expr" placeholder="x" aria-label="${escA(label)} argument">
      <span class="structure-big-bracket structure-right">${escH(getFunctionStructureDelimiters(kind)[1])}</span>
    ` : `
      <span class="structure-symbol function-symbol">${label}</span>
      <span class="structure-big-bracket structure-left">(</span>
      <input class="structure-input structure-main structure-expr" placeholder="x" aria-label="${label} argument">
      <span class="structure-big-bracket structure-right">)</span>
    `;
  } else if(isDerivativeStructureKind(kind)){
    const partial=isPartialDerivativeStructureKind(kind);
    const second=isSecondDerivativeStructureKind(kind);
    const power=isPowerDerivativeKind(kind);
    wrap.innerHTML=`
      <span class="structure-symbol derivative-symbol">
        <span>${partial?'∂':'d'}${second?'²':''}${power?'<input class="structure-input structure-limit structure-order" placeholder="n" aria-label="Derivative order">':''}</span>
        <span class="structure-deriv-line"></span>
        <span>${partial?'∂':'d'}<input class="structure-input structure-limit structure-var" placeholder="x" aria-label="Variable">${second?'²':''}${power?'<sup class="structure-order-sup">n</sup>':''}</span>
      </span>
      <input class="structure-input structure-main structure-expr" placeholder="f(x)" aria-label="Expression">
    `;
  } else if(kind==='limitPlain'){
    wrap.innerHTML=`
      <span class="structure-symbol">lim</span>
      <input class="structure-input structure-main structure-expr" placeholder="f(x)" aria-label="Expression">
    `;
  } else if(kind==='limit'){
    wrap.innerHTML=`
      <span class="structure-symbol">lim</span>
      <input class="structure-input structure-limit structure-var" placeholder="x" aria-label="Variable">
      <span class="structure-to">→</span>
      <input class="structure-input structure-limit structure-to-value" placeholder="0" aria-label="Approaches">
      <input class="structure-input structure-main structure-expr" placeholder="f(x)" aria-label="Expression">
    `;
  } else {
    const symbol=getIntegralSymbolForKind(kind);
    const withLimits=hasIntegralLimits(kind);
    const perLimits=hasPerIntegralLimits(kind);
    const order=getIntegralOrderForKind(kind);
    const makeIntegralSymbol=(idx, includeLimits=true)=>{
      if(!includeLimits){
        return `<span class="structure-symbol"><span>∫</span></span>`;
      }
      return `<span class="structure-symbol">
        <input class="structure-input structure-limit structure-upper-${idx}" placeholder="${idx===1?'b':idx===2?'d':'f'}" aria-label="Upper limit ${idx}">
        <span>∫</span>
        <input class="structure-input structure-limit structure-lower-${idx}" placeholder="${idx===1?'a':idx===2?'c':'e'}" aria-label="Lower limit ${idx}">
      </span>`;
    };
    wrap.innerHTML=`
      ${perLimits ? Array.from({length:order},(_,i)=>makeIntegralSymbol(i+1, !(kind==='doubleIntegralFirstLimits' && i>0))).join('') : `
        <span class="structure-symbol">
          ${withLimits ? '<input class="structure-input structure-limit structure-upper" placeholder="b" aria-label="Upper limit">' : ''}
          <span>${symbol}</span>
          ${withLimits ? '<input class="structure-input structure-limit structure-lower" placeholder="a" aria-label="Lower limit">' : ''}
        </span>
      `}
      <input class="structure-input structure-main structure-expr" placeholder="f(x)" aria-label="Integrand">
      ${getIntegralDifferentialInputsHTML(kind)}
    `;
  }
  const sel=window.getSelection();
  const range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if(range){
    range.deleteContents();
    range.insertNode(wrap);
    const gap=createComposerCaretSpacer();
    wrap.after(gap);
    moveComposerCaretIntoSpacer(gap);
  } else {
    editor.appendChild(wrap);
    const gap=createComposerCaretSpacer();
    editor.appendChild(gap);
    moveComposerCaretIntoSpacer(gap);
  }
  mixedComposerDraftHTML=editor.innerHTML;
  bindInlineComposerInputs(wrap, '.structure-input', '.structure-expr');
}

function clampInlineMatrixDimension(value, fallback=3){
  const parsed=Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(8, parsed)) : fallback;
}

function getInlineMatrixCellPlaceholder(row, col){
  return `a${row+1}${col+1}`;
}

function buildInlineMatrixCellsHTML(rows, cols){
  const cells=[];
  for(let row=0; row<rows; row++){
    for(let col=0; col<cols; col++){
      const placeholder=getInlineMatrixCellPlaceholder(row, col);
      cells.push(`<input class="structure-input matrix-cell-input" data-row="${row}" data-col="${col}" placeholder="${escA(placeholder)}" aria-label="Matrix row ${row+1}, column ${col+1}">`);
    }
  }
  return cells.join('');
}

function getInlineMatrixTemplateLatex(rows, cols){
  const safeRows=clampInlineMatrixDimension(rows);
  const safeCols=clampInlineMatrixDimension(cols);
  const rowTex=Array.from({length:safeRows},()=>Array.from({length:safeCols},()=>'\\;').join(' & '));
  return `\\begin{bmatrix}${rowTex.join(' \\\\ ')}\\end{bmatrix}`;
}

function insertInlineMatrixWidget(rows=3, cols=3){
  const safeRows=clampInlineMatrixDimension(rows);
  const safeCols=clampInlineMatrixDimension(cols);
  const active=(document.activeElement?.classList?.contains('frac-input') || document.activeElement?.classList?.contains('structure-input'))
    ? document.activeElement
    : (activeFractionInput?.isConnected ? activeFractionInput : null);
  if(active){
    insertIntoFocusedFractionInput(getInlineMatrixTemplateLatex(safeRows, safeCols));
    return;
  }
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  pushMixedComposerUndo(editor);
  editor.focus();
  restoreMixedComposerRange();
  escapeMixedComposerFormattedCaret();
  const wrap=document.createElement('span');
  wrap.className='composer-inline-structure matrix';
  wrap.dataset.kind='matrix';
  wrap.dataset.rows=String(safeRows);
  wrap.dataset.cols=String(safeCols);
  wrap.style.setProperty('--matrix-cols', String(safeCols));
  wrap.contentEditable='false';
  wrap.innerHTML=`
    <span class="matrix-bracket matrix-bracket-left">[</span>
    <span class="matrix-grid">${buildInlineMatrixCellsHTML(safeRows, safeCols)}</span>
    <span class="matrix-bracket matrix-bracket-right">]</span>
  `;
  const sel=window.getSelection();
  const range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if(range){
    range.deleteContents();
    range.insertNode(wrap);
    const gap=createComposerCaretSpacer();
    wrap.after(gap);
    moveComposerCaretIntoSpacer(gap);
  }else{
    editor.appendChild(wrap);
    const gap=createComposerCaretSpacer();
    editor.appendChild(gap);
    moveComposerCaretIntoSpacer(gap);
  }
  mixedComposerDraftHTML=editor.innerHTML;
  bindInlineComposerInputs(wrap, '.matrix-cell-input', '.matrix-cell-input');
  // Matrix cells sit inside a protected inline widget. Capture the pointer here so
  // the contenteditable parent cannot steal the caret before the cell receives it.
  wrap.querySelectorAll('.matrix-cell-input').forEach(input=>{
    input.addEventListener('pointerdown', event=>{
      event.preventDefault();
      event.stopPropagation();
      activeFractionInput=input;
      input.focus({preventScroll:true});
      const end=input.value.length;
      input.setSelectionRange(end, end);
    });
  });
}

function insertConfiguredInlineMatrix(){
  const rows=document.getElementById('mixedComposerMatrixRows');
  const cols=document.getElementById('mixedComposerMatrixCols');
  insertInlineMatrixWidget(rows?.value, cols?.value);
}

function adjustMixedComposerEditorHeight(delta){
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  const current=parseInt(editor.style.minHeight || getComputedStyle(editor).minHeight || '200',10) || 200;
  const next=Math.max(140, Math.min(720, current + delta));
  editor.style.minHeight=next+'px';
}

function applyMixedComposerFrameWidth(editor, key){
  if(!editor) return;
  editor.style.boxSizing='border-box';
  editor.style.width='100%';
  editor.style.maxWidth='100%';
  editor.style.marginLeft='0';
  editor.style.marginRight='0';
  editor.dataset.canvasWidth='full';
}

function getComposerEqTabs(){
  return {
    Fractions: [
      {d:'½', l:'\\frac{1}{2}', frac:true, n:'1', dn:'2'},
      {d:'a/b', l:'\\frac{a}{b}', frac:true, n:'a', dn:'b'},
      {d:'dy/dx', l:'\\frac{dy}{dx}', frac:true, n:'dy', dn:'dx'},
      {d:'d/dt', l:'\\frac{d}{dt}', frac:true, n:'d', dn:'dt'},
      {d:'Q/ε₀', l:'\\frac{Q}{\\varepsilon_0}', frac:true, n:'Q', dn:'ε₀'}
    ],
    Greek: [
      {d:'α',l:'\\alpha',w:true},{d:'β',l:'\\beta',w:true},{d:'γ',l:'\\gamma',w:true},{d:'δ',l:'\\delta',w:true},
      {d:'ε',l:'\\epsilon',w:true},{d:'ϵ',l:'\\varepsilon',w:true},{d:'θ',l:'\\theta',w:true},{d:'λ',l:'\\lambda',w:true},
      {d:'μ',l:'\\mu',w:true},{d:'π',l:'\\pi',w:true},{d:'ρ',l:'\\rho',w:true},{d:'σ',l:'\\sigma',w:true},
      {d:'φ',l:'\\phi',w:true},{d:'ϕ',l:'\\varphi',w:true},{d:'ω',l:'\\omega',w:true},{d:'η',l:'\\eta',w:true},
      {d:'ξ',l:'\\xi',w:true},{d:'ψ',l:'\\psi',w:true},{d:'χ',l:'\\chi',w:true},{d:'υ',l:'\\upsilon',w:true},
      {d:'ζ',l:'\\zeta',w:true},{d:'ι',l:'\\iota',w:true},{d:'κ',l:'\\kappa',w:true},{d:'ν',l:'\\nu',w:true},
      {d:'ο',l:'o',w:true},{d:'τ',l:'\\tau',w:true},{d:'ϑ',l:'\\vartheta',w:true},{d:'ϱ',l:'\\varrho',w:true},
      {d:'Γ',l:'\\Gamma',w:true},{d:'Δ',l:'\\Delta',w:true},{d:'Θ',l:'\\Theta',w:true},{d:'Λ',l:'\\Lambda',w:true},
      {d:'Ξ',l:'\\Xi',w:true},{d:'Π',l:'\\Pi',w:true},{d:'Σ',l:'\\Sigma',w:true},{d:'Υ',l:'\\Upsilon',w:true},
      {d:'Φ',l:'\\Phi',w:true},{d:'Ψ',l:'\\Psi',w:true},{d:'Ω',l:'\\Omega',w:true}
    ],
    Roman: [
      {d:'I',l:'I',w:true},{d:'II',l:'II',w:true},{d:'III',l:'III',w:true},{d:'IV',l:'IV',w:true},{d:'V',l:'V',w:true},
      {d:'VI',l:'VI',w:true},{d:'VII',l:'VII',w:true},{d:'VIII',l:'VIII',w:true},{d:'IX',l:'IX',w:true},{d:'X',l:'X',w:true},
      {d:'XI',l:'XI',w:true},{d:'XII',l:'XII',w:true},{d:'XIII',l:'XIII',w:true},{d:'XIV',l:'XIV',w:true},{d:'XV',l:'XV',w:true},
      {d:'XVI',l:'XVI',w:true},{d:'XVII',l:'XVII',w:true},{d:'XVIII',l:'XVIII',w:true},{d:'XIX',l:'XIX',w:true},{d:'XX',l:'XX',w:true}
    ],
    Operators: [
      {d:'+',l:'+'},{d:'−',l:'-'},{d:'×',l:'\\times',w:true},{d:'÷',l:'\\div',w:true},{d:'±',l:'\\pm',w:true},
      {d:'=',l:'='},{d:'≠',l:'\\neq',w:true},{d:'≤',l:'\\leq',w:true},{d:'≥',l:'\\geq',w:true},{d:'≈',l:'\\approx',w:true},
      {d:'≈ equal',insert:'≈',l:'\\approx',w:true},{d:'∝',l:'\\propto',w:true},{d:'≡',l:'\\equiv',w:true},{d:'≃',l:'\\simeq',w:true},{d:'≅',l:'\\cong',w:true},
      {d:'≪',l:'\\ll',w:true},{d:'≫',l:'\\gg',w:true},{d:'∼',l:'\\sim',w:true},{d:'√',l:'\\sqrt{x}',w:true},
      {d:'∛',l:'\\sqrt[3]{x}',w:true},{d:'∜',l:'\\sqrt[4]{x}',w:true},{d:'∫',l:'\\int',w:true},{d:'∬',l:'\\iint',w:true},
      {d:'∭',l:'\\iiint',w:true},{d:'∮',l:'\\oint',w:true},{d:'∑',l:'\\sum',w:true},{d:'∏',l:'\\prod',w:true},{d:'lim',l:'\\lim',w:true},
      {d:'∂',l:'\\partial',w:true},{d:'∇',l:'\\nabla',w:true},{d:'∞',l:'\\infty',w:true},{d:'⊕',l:'\\oplus',w:true},
      {d:'⊗',l:'\\otimes',w:true},{d:'⊙',l:'\\odot',w:true},{d:'∴',l:'\\therefore',w:true},{d:'∵',l:'\\because',w:true}
    ],
    'Sets/Logic': [
      {d:'∈',l:'\\in',w:true},{d:'∉',l:'\\notin',w:true},{d:'∋',l:'\\ni',w:true},{d:'⊂',l:'\\subset',w:true},
      {d:'⊃',l:'\\supset',w:true},{d:'⊆',l:'\\subseteq',w:true},{d:'⊇',l:'\\supseteq',w:true},{d:'∩',l:'\\cap',w:true},
      {d:'∪',l:'\\cup',w:true},{d:'∅',l:'\\emptyset',w:true},{d:'∀',l:'\\forall',w:true},{d:'∃',l:'\\exists',w:true},
      {d:'¬',l:'\\neg',w:true},{d:'∧',l:'\\land',w:true},{d:'∨',l:'\\lor',w:true},{d:'⇒',l:'\\Rightarrow',w:true},
      {d:'⇔',l:'\\Leftrightarrow',w:true},{d:'ℝ',l:'\\mathbb{R}',w:true},{d:'ℕ',l:'\\mathbb{N}',w:true},{d:'ℤ',l:'\\mathbb{Z}',w:true},
      {d:'ℚ',l:'\\mathbb{Q}',w:true},{d:'ℂ',l:'\\mathbb{C}',w:true}
    ],
    Physics: [
      {d:'∇',l:'\\nabla',w:true},{d:'∂',l:'\\partial',w:true},{d:'∞',l:'\\infty',w:true},{d:'E⃗',l:'\\vec{E}',w:true},
      {d:'B⃗',l:'\\vec{B}',w:true},{d:'F⃗',l:'\\vec{F}',w:true},{d:'η',l:'\\eta',w:true},{d:'μ₀',l:'\\mu_0',w:true},
      {d:'ε₀',l:'\\varepsilon_0',w:true},{d:'ħ',l:'\\hbar',w:true},{d:'σ',l:'\\sigma',w:true},{d:'ρ',l:'\\rho',w:true},
      {d:'ω',l:'\\omega',w:true},{d:'γ',l:'\\gamma',w:true},{d:'β',l:'\\beta',w:true},{d:'Ω',l:'\\Omega',w:true},
      {d:'Φ',l:'\\Phi',w:true},{d:'Ψ',l:'\\Psi',w:true},{d:'τ',l:'\\tau',w:true},{d:'χ',l:'\\chi',w:true},
      {d:'∮',l:'\\oint',w:true},{d:'∬',l:'\\iint',w:true},{d:'∭',l:'\\iiint',w:true},{d:'∇·',l:'\\nabla\\cdot',w:true},
      {d:'î',l:'\\hat{i}',w:true},{d:'ĵ',l:'\\hat{j}',w:true},{d:'k̂',l:'\\hat{k}',w:true},
      {d:'∇×',l:'\\nabla\\times',w:true},{d:'∇²',l:'\\nabla^2',w:true},{d:'H⃗',l:'\\vec{H}',w:true},{d:'D⃗',l:'\\vec{D}',w:true},
      {d:'J⃗',l:'\\vec{J}',w:true},{d:'P⃗',l:'\\vec{P}',w:true},{d:'M⃗',l:'\\vec{M}',w:true},{d:'k⃗',l:'\\vec{k}',w:true},
      {d:'λ',l:'\\lambda',w:true},{d:'f',l:'f',w:true},{d:'T',l:'T',w:true},{d:'vₚ',l:'v_p',w:true},
      {d:'qₑ',l:'q_e',w:true},{d:'mₑ',l:'m_e',w:true},{d:'kᴮ',l:'k_B',w:true},{d:'c',l:'c',w:true},
      {d:'G',l:'G',w:true},{d:'R',l:'R',w:true},{d:'Nₐ',l:'N_A',w:true},{d:'Φᴮ',l:'\\Phi_B',w:true},
      {d:'Φᴱ',l:'\\Phi_E',w:true},{d:'Vᵣₘₛ',l:'V_{rms}',w:true},{d:'Iᵣₘₛ',l:'I_{rms}',w:true},{d:'Z',l:'Z',w:true},
      {d:'Xᴸ',l:'X_L',w:true},{d:'Xᶜ',l:'X_C',w:true},{d:'ω₀',l:'\\omega_0',w:true},{d:'τ',l:'\\tau',w:true},
      {d:'θᶜ',l:'\\theta_c',w:true},{d:'n̂',l:'\\hat{n}',w:true},{d:'r̂',l:'\\hat{r}',w:true},{d:'a⃗',l:'\\vec{a}',w:true},
      {d:'v⃗',l:'\\vec{v}',w:true},{d:'p⃗',l:'\\vec{p}',w:true}
    ],
    Structures: [
      {d:'Large ( )',structure:'largeParen',w:true},{d:'Large [ ]',structure:'largeBracket',w:true},{d:'Large { }',structure:'largeBrace',w:true},
      {d:'e^x box',structure:'expFunc',w:true},{d:'ln( ) box',structure:'lnFunc',w:true},{d:'log( ) box',structure:'logFunc',w:true},{d:'mod( ) box',structure:'modFunc',w:true},
      {d:'|x| magnitude',structure:'absFunc',w:true},{d:'⌊x⌋ greatest int',structure:'floorFunc',w:true},{d:'⌈x⌉ ceiling',structure:'ceilFunc',w:true},
      {d:'sgn( )',structure:'sgnFunc',w:true},{d:'arg( )',structure:'argFunc',w:true},{d:'Re( )',structure:'realFunc',w:true},{d:'Im( )',structure:'imagFunc',w:true},
      {d:'gcd( )',structure:'gcdFunc',w:true},{d:'lcm( )',structure:'lcmFunc',w:true},{d:'det( )',structure:'detFunc',w:true},
      {d:'√ editable',structure:'rootSquare',w:true},{d:'∛ editable',structure:'rootCube',w:true},{d:'ⁿ√ custom',structure:'rootNth',w:true},
      {d:'Visual eq',structure:'visualEquation',w:true},{d:'vec',structure:'vector',w:true},{d:'∫',structure:'integralPlain',w:true},{d:'∫ limits',structure:'integral',w:true},
      {d:'∬',structure:'doubleIntegral',w:true},{d:'∬ limits',structure:'doubleIntegralLimits',w:true},
      {d:'∫ₐᵇ∫ᶜᵈ',structure:'doubleIntegralEachLimits',w:true},{d:'∫ₐᵇ∫',structure:'doubleIntegralFirstLimits',w:true},
      {d:'∭',structure:'tripleIntegral',w:true},{d:'∭ limits',structure:'tripleIntegralLimits',w:true},
      {d:'∫∫∫ each',structure:'tripleIntegralEachLimits',w:true},
      {d:'∮',structure:'contourIntegral',w:true},{d:'∮ limits',structure:'contourIntegralLimits',w:true},
      {d:'Σ',structure:'summationPlain',w:true},{d:'Σ limits',structure:'summation',w:true},{d:'lim',structure:'limitPlain',w:true},{d:'lim →',structure:'limit',w:true},
      {d:'d/dx',structure:'derivative',w:true},{d:'d²/dx²',structure:'secondDerivative',w:true},
      {d:'dⁿ/dxⁿ',structure:'derivativePower',w:true},{d:'∂/∂x',structure:'partialDerivative',w:true},{d:'∂²/∂x²',structure:'secondPartialDerivative',w:true},{d:'∂ⁿ/∂xⁿ',structure:'partialDerivativePower',w:true},
      {d:'xⁿ',structure:'visualEquation',preset:'x^n',w:true},{d:'xₙ',structure:'visualEquation',preset:'x_n',w:true},{d:'xᵢⁿ',structure:'visualEquation',preset:'x_i^n',w:true},{d:'√x',structure:'rootSquare',w:true},
      {d:'ⁿ√x',structure:'rootNth',w:true},{d:'x̂',structure:'visualEquation',preset:'x_hat',w:true},{d:'x̄',structure:'visualEquation',preset:'x_bar',w:true},{d:'ȳ',structure:'visualEquation',preset:'y_bar',w:true},{d:'Ā',structure:'visualEquation',preset:'A_bar',w:true},{d:'x⃗',structure:'visualEquation',preset:'x_vec',w:true},
      {d:'2×2 matrix',structure:'matrix',w:true},{d:'[ ]',l:'\\begin{bmatrix}a & b\\\\ c & d\\end{bmatrix}',w:true}
    ],
    Trig: [
      {d:'sin',l:'\\sin',w:true},{d:'cos',l:'\\cos',w:true},{d:'tan',l:'\\tan',w:true},{d:'e^x box',structure:'expFunc',w:true},
      {d:'ln( ) box',structure:'lnFunc',w:true},{d:'log( ) box',structure:'logFunc',w:true},{d:'mod( ) box',structure:'modFunc',w:true},{d:'|x|',structure:'absFunc',w:true},{d:'ln',l:'\\ln',w:true},
      {d:'log',l:'\\log',w:true},{d:'exp',l:'\\exp',w:true},{d:'sin⁻¹',l:'\\sin^{-1}',w:true},{d:'cos⁻¹',l:'\\cos^{-1}',w:true}
    ]
  };
}

function resetMixedComposerEquationState(){
  mixedComposerTokens=[];
  mixedComposerCursor=0;
  mixedComposerHist=[[]];
  mixedComposerHistIdx=0;
  mixedComposerTab='Fractions';
}

function saveMixedComposerHistory(){
  mixedComposerHist=mixedComposerHist.slice(0,mixedComposerHistIdx+1);
  mixedComposerHist.push(mixedComposerTokens.map(tok=>({...tok})));
  mixedComposerHistIdx=mixedComposerHist.length-1;
}

function buildMixedComposerEqTabs(){
  const bar=document.getElementById('composerEqTabs');
  if(!bar) return;
  bar.innerHTML=Object.keys(getComposerEqTabs()).map(name=>
    `<button class="btn${name===mixedComposerTab?' pri':''}" type="button" onmousedown="event.preventDefault()" onclick="setMixedComposerTab('${escA(name)}')">${escH(name)}</button>`
  ).join('');
}

function setMixedComposerTab(name){
  mixedComposerTab=name;
  buildMixedComposerEqTabs();
  buildMixedComposerEqPalette();
}

function buildMixedComposerEqPalette(){
  const holder=document.getElementById('composerEqPalette');
  if(!holder) return;
  const list=getComposerEqTabs()[mixedComposerTab]||[];
  holder.innerHTML=list.map(item=>{
    if(item.frac){
      return `<button class="composer-eq-btn frac" type="button" onmousedown="event.preventDefault()" onclick="insertMixedComposerToken('${escA(item.l)}','${escA(item.d)}','frac','${escA(item.n)}','${escA(item.dn)}')"><span class="num">${escH(item.n)}</span><span class="den">${escH(item.dn)}</span></button>`;
    }
    if(item.structure){
      return `<button class="composer-eq-btn${item.w?' wide':''}" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('${escA(item.structure)}','${escA(item.preset||'')}')">${escH(item.d)}</button>`;
    }
    const display=item.insert || item.d;
    return `<button class="composer-eq-btn${item.w?' wide':''}" type="button" onmousedown="event.preventDefault()" onclick="insertMixedComposerToken('${escA(item.l)}','${escA(display)}','plain')">${escH(item.d)}</button>`;
  }).join('');
}

function insertMixedComposerToken(latex, display, type='plain', numText='', denText=''){
  const inlineText=type==='frac' ? getInlineFractionInputText(numText, denText, 'stacked') : display;
  if(insertIntoFocusedFractionInput(inlineText)) return;
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return;
  editor.focus();
  restoreMixedComposerRange();
  escapeMixedComposerFormattedCaret();
  const token=document.createElement('span');
  token.className='composer-eq-token';
  token.contentEditable='false';
  token.dataset.latex=latex;
  token.dataset.plain=type==='frac' ? `${numText||'a'}/${denText||'b'}` : display;
  token.innerHTML=type==='frac'
    ? `<span class="composer-eq-render"><span class="composer-eq-frac"><span class="fn">${escH(numText||'a')}</span><span class="fd">${escH(denText||'b')}</span></span></span>`
    : `<span class="composer-eq-render">${escH(display)}</span>`;
  const sel=window.getSelection();
  const range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if(range){
    range.deleteContents();
    range.insertNode(token);
    const gap=createComposerCaretSpacer();
    token.after(gap);
    moveComposerCaretIntoSpacer(gap);
  } else {
    editor.appendChild(token);
    const gap=createComposerCaretSpacer();
    editor.appendChild(gap);
    moveComposerCaretIntoSpacer(gap);
  }
  syncMixedComposerFractionInputs(editor);
  cleanupMixedComposerFormatTails(editor);
  mixedComposerDraftHTML=editor.innerHTML;
  saveMixedComposerRange();
}

function renderMixedComposerEquationCanvas(){
  const wrap=document.getElementById('composerEqCanvas');
  const latexBox=document.getElementById('composerEqLatex');
  if(!wrap) return;
  wrap.innerHTML='';
  const makeCursor=()=>{
    const c=document.createElement('span');
    c.className='composer-eq-cursor';
    return c;
  };
  mixedComposerTokens.forEach((tok,i)=>{
    if(i===mixedComposerCursor) wrap.appendChild(makeCursor());
    const el=document.createElement('span');
    el.className='composer-eq-token-box';
    if(tok.type==='frac'){
      el.innerHTML=`<span class="composer-eq-frac"><span class="fn">${escH(tok.numText||'a')}</span><span class="fd">${escH(tok.denText||'b')}</span></span>`;
    }else{
      el.textContent=tok.display;
    }
    el.onclick=(e)=>{
      e.stopPropagation();
      mixedComposerCursor=i;
      renderMixedComposerEquationCanvas();
    };
    wrap.appendChild(el);
  });
  if(mixedComposerCursor===mixedComposerTokens.length) wrap.appendChild(makeCursor());
  if(latexBox) latexBox.textContent=getMixedComposerLatex() || 'LaTeX output';
}

function getMixedComposerLatex(){
  return mixedComposerTokens.map(tok=>tok.latex).join(' ').trim();
}

function getMixedComposerDisplayText(){
  return mixedComposerTokens.map(tok=>{
    if(tok.type==='frac') return `${tok.numText||'a'}/${tok.denText||'b'}`;
    return tok.display || '';
  }).join(' ').trim();
}

function getMixedComposerDisplayHTML(){
  return mixedComposerTokens.map(tok=>{
    if(tok.type==='frac'){
      return `<span class="composer-eq-frac"><span class="fn">${escH(tok.numText||'a')}</span><span class="fd">${escH(tok.denText||'b')}</span></span>`;
    }
    return `<span>${escH(tok.display||'')}</span>`;
  }).join('');
}

function renderMixedComposerEquationPreview(){
  const el=document.getElementById('mixedComposerPreview');
  if(!el) return;
  const tex=getMixedComposerLatex();
  if(!tex){
    el.textContent='Build the equation below, then insert it into the statement or add the whole block to the frame.';
    return;
  }
  renderTexPreviewInto(el, tex);
}

function mixedComposerEqBackspace(){
  if(mixedComposerCursor<=0) return;
  saveMixedComposerHistory();
  mixedComposerTokens.splice(mixedComposerCursor-1,1);
  mixedComposerCursor--;
  renderMixedComposerEquationCanvas();
  renderMixedComposerEquationPreview();
}

function mixedComposerEqUndo(){
  if(mixedComposerHistIdx<=0) return;
  mixedComposerHistIdx--;
  mixedComposerTokens=mixedComposerHist[mixedComposerHistIdx].map(tok=>({...tok}));
  mixedComposerCursor=Math.min(mixedComposerCursor,mixedComposerTokens.length);
  renderMixedComposerEquationCanvas();
  renderMixedComposerEquationPreview();
}

function mixedComposerEqRedo(){
  if(mixedComposerHistIdx>=mixedComposerHist.length-1) return;
  mixedComposerHistIdx++;
  mixedComposerTokens=mixedComposerHist[mixedComposerHistIdx].map(tok=>({...tok}));
  mixedComposerCursor=Math.min(mixedComposerCursor,mixedComposerTokens.length);
  renderMixedComposerEquationCanvas();
  renderMixedComposerEquationPreview();
}

function openMixedComposerFractionModal(variant='stacked'){
  insertInlineFractionWidget('a','b',variant);
}

function insertEquationIntoMixedComposer(){
  const editor=document.getElementById('mixedComposerEditor');
  const preview=document.getElementById('mixedComposerPreview');
  const latex=String(getMixedComposerLatex() || '').trim();
  const displayText=String(getMixedComposerDisplayText() || '').trim();
  const displayHTML=getMixedComposerDisplayHTML();
  if(!editor || !latex){
    showNotice('Type the equation first, then insert it into the statement.', 'Composer');
    return;
  }
  if(insertIntoFocusedFractionInput(latex || displayText)){
    resetMixedComposerEquationState();
    renderMixedComposerEquationCanvas();
    renderMixedComposerEquationPreview();
    if(preview) preview.textContent='Equation inserted into the active function box.';
    return;
  }
  pushMixedComposerUndo(editor);
  editor.focus();
  restoreMixedComposerRange();
  const token=document.createElement('span');
  token.className='composer-eq-token';
  token.contentEditable='false';
  token.dataset.latex=latex;
  token.dataset.plain=displayText || latex;
  token.innerHTML=`<span class="composer-eq-render">${displayHTML}</span>`;
  const sel=window.getSelection();
  const range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if(range){
    range.deleteContents();
    range.insertNode(token);
    const gap=createComposerCaretSpacer();
    token.after(gap);
    moveComposerCaretIntoSpacer(gap);
  } else {
    editor.appendChild(token);
    const gap=createComposerCaretSpacer();
    editor.appendChild(gap);
    moveComposerCaretIntoSpacer(gap);
  }
  resetMixedComposerEquationState();
  renderMixedComposerEquationCanvas();
  renderMixedComposerEquationPreview();
  if(preview) preview.textContent='Equation inserted into the statement block.';
  editor.focus();
}

function insertPlainTextIntoMixedComposer(text){
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return false;
  pushMixedComposerUndo(editor);
  editor.focus();
  restoreMixedComposerRange();
  const sel=window.getSelection?.();
  const range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if(!range || !editor.contains(range.commonAncestorContainer)) return false;
  range.deleteContents();
  const clean=String(text||'').replace(/\r\n?/g,'\n').replace(/[\u200B\u2060]/g,'');
  const frag=document.createDocumentFragment();
  clean.split('\n').forEach((part,idx)=>{
    if(idx>0) frag.appendChild(document.createTextNode('\n'));
    if(part) frag.appendChild(document.createTextNode(part));
  });
  const marker=document.createTextNode('\u200B');
  frag.appendChild(marker);
  range.insertNode(frag);
  const nextRange=document.createRange();
  nextRange.setStart(marker, marker.textContent.length);
  nextRange.collapse(true);
  sel.removeAllRanges();
  sel.addRange(nextRange);
  mixedComposerRange=nextRange.cloneRange();
  cleanupMixedComposerFormatTails(editor);
  mixedComposerDraftHTML=editor.innerHTML;
  return true;
}

function createMixedComposerLatexToken(source){
  const latex=normalizeComposerPastedLatexExpression(source);
  if(!latex) return null;
  const widget=document.createElement('span');
  widget.className='composer-inline-structure visualEquation composer-imported-equation';
  widget.dataset.kind='visualEquation';
  widget.contentEditable='false';
  widget.innerHTML=`
    <span class="structure-symbol function-symbol">ƒ</span>
    <input class="structure-input structure-main structure-expr" value="${escA(latex)}" aria-label="Imported PDF equation">
  `;
  return widget;
}

function readMixedComposerDelimitedLatex(text, start){
  const pairs=[
    {open:'$$',close:'$$'},
    {open:'\\[',close:'\\]'},
    {open:'\\(',close:'\\)'},
    {open:'$',close:'$'}
  ];
  for(const pair of pairs){
    if(!text.startsWith(pair.open,start)) continue;
    if(pair.open==='$' && text[start-1]==='\\') continue;
    const contentStart=start+pair.open.length;
    let end=text.indexOf(pair.close,contentStart);
    while(end>=0 && text[end-1]==='\\' && pair.close==='$'){
      end=text.indexOf(pair.close,end+pair.close.length);
    }
    if(end<0) return null;
    const latex=text.slice(contentStart,end).trim();
    return latex ? {latex,end:end+pair.close.length} : null;
  }
  return null;
}

function readMixedComposerRawLatex(text, start){
  const delimited=readMixedComposerDelimitedLatex(text,start);
  if(delimited) return delimited;
  if(text[start]==='\\' && typeof isKatexSelectableCommandAt==='function' && isKatexSelectableCommandAt(text,start)){
    const end=consumeSelectableKatexSegment(text,start);
    if(end>start) return {latex:text.slice(start,end).trim(),end};
  }
  if(typeof consumeKatexSimpleAtom==='function' && typeof shouldStartSelectableKatexFromPlainAtom==='function'){
    const atomEnd=consumeKatexSimpleAtom(text,start);
    if(atomEnd>start && shouldStartSelectableKatexFromPlainAtom(text,start,atomEnd)){
      const end=consumeSelectableKatexSegment(text,start);
      if(end>start) return {latex:text.slice(start,end).trim(),end};
    }
  }
  return null;
}

function splitMixedComposerPdfSource(source){
  const text=String(source||'').replace(/\r\n?/g,'\n').replace(/[\u200B\u2060]/g,'');
  const segments=[];
  let pos=0;
  let plainStart=0;
  while(pos<text.length){
    const match=readMixedComposerRawLatex(text,pos);
    if(!match){
      pos++;
      continue;
    }
    if(pos>plainStart) segments.push({type:'text',value:text.slice(plainStart,pos)});
    segments.push({type:'math',value:match.latex});
    pos=match.end;
    plainStart=pos;
  }
  if(plainStart<text.length) segments.push({type:'text',value:text.slice(plainStart)});
  return segments;
}

function insertPdfSourceIntoMixedComposer(source, options={}){
  const editor=document.getElementById('mixedComposerEditor');
  if(!editor) return false;
  const text=String(source||'').replace(/\r\n?/g,'\n');
  if(!text) return false;
  pushMixedComposerUndo(editor);
  editor.focus();
  restoreMixedComposerRange();
  const sel=window.getSelection?.();
  let range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
  if(options.replace){
    editor.innerHTML='';
    range=document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
  if(!range || !editor.contains(range.commonAncestorContainer)) return false;
  range.deleteContents();
  const frag=document.createDocumentFragment();
  const importedWidgets=[];
  splitMixedComposerPdfSource(text).forEach(segment=>{
    if(segment.type==='math'){
      const token=createMixedComposerLatexToken(segment.value);
      if(token){
        importedWidgets.push(token);
        frag.appendChild(token);
      }
      else frag.appendChild(document.createTextNode(segment.value));
    }else if(segment.value){
      frag.appendChild(document.createTextNode(segment.value));
    }
  });
  const marker=document.createTextNode('\u200B');
  frag.appendChild(marker);
  range.insertNode(frag);
  const nextRange=document.createRange();
  nextRange.setStart(marker,marker.textContent.length);
  nextRange.collapse(true);
  sel?.removeAllRanges();
  sel?.addRange(nextRange);
  mixedComposerRange=nextRange.cloneRange();
  cleanupMixedComposerFormatTails(editor);
  syncMixedComposerFractionInputs(editor);
  importedWidgets.forEach(widget=>bindInlineComposerInputs(widget,'.structure-input','.structure-expr'));
  mixedComposerDraftHTML=editor.innerHTML;
  return true;
}

function getActiveMixedComposerPdfSource(){
  if(!cur || !activeComposerKey) return '';
  const fieldId=activeComposerKey==='q'
    ? 'pdfQuestionText'
    : `pdfOptionText${+activeComposerKey.slice(3)}`;
  const live=document.getElementById(fieldId);
  if(live && String(live.value||'').trim()) return String(live.value||'');
  if(activeComposerKey==='q') return getQuestionPdfSourceText(cur);
  if(activeComposerKey.startsWith('opt')){
    return getOptionPdfSourceText(cur.options?.[+activeComposerKey.slice(3)] || null);
  }
  return '';
}

function importPdfSourceIntoMixedComposer(){
  const source=getActiveMixedComposerPdfSource();
  const preview=document.getElementById('mixedComposerPreview');
  if(!String(source||'').trim()){
    if(preview) preview.textContent='No PDF text is available for this frame.';
    return;
  }
  if(insertPdfSourceIntoMixedComposer(source,{replace:true}) && preview){
    preview.textContent='PDF text imported. Prose is editable, LaTeX is rendered inline, and Undo restores the previous composer content.';
  }
}

function insertLatexEquationIntoMixedComposer(text){
  const latex=normalizeComposerPastedLatexExpression(text);
  if(!latex) return false;
  insertInlineStructureWidget('visualEquation', latex, {forceEditor:true});
  return true;
}

function handleMixedComposerPaste(e){
  const items=Array.from(e.clipboardData?.items||[]);
  const imgItem=items.find(item=>item.type && item.type.startsWith('image/'));
  if(!imgItem){
    const text=e.clipboardData?.getData('text/plain');
    if(text){
      e.preventDefault();
      const active=document.activeElement;
      if(active?.classList?.contains('frac-input') || active?.classList?.contains('structure-input')){
        insertIntoFocusedFractionInput(isClearComposerLatexExpression(text) ? normalizeComposerPastedLatexExpression(text) : text);
      } else {
        insertPdfSourceIntoMixedComposer(text);
      }
    }
    return;
  }
  e.preventDefault();
  const file=imgItem.getAsFile();
  if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    const editor=document.getElementById('mixedComposerEditor');
    if(!editor) return;
    editor.focus();
    restoreMixedComposerRange();
    const img=document.createElement('img');
    img.className='composer-inline-image';
    img.src=String(reader.result||'');
    img.alt='Pasted equation image';
    img.width=160;
    img.height=40;
    img.style.width='160px';
    img.style.height='40px';
    img.style.objectFit='contain';
    img.dataset.w='160';
    img.dataset.h='40';
    const sel=window.getSelection();
    const range=sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if(range){
      range.deleteContents();
      range.insertNode(img);
      const gap=createComposerCaretSpacer();
      img.after(gap);
      moveComposerCaretIntoSpacer(gap);
    } else {
      editor.appendChild(img);
      const gap=createComposerCaretSpacer();
      editor.appendChild(gap);
      moveComposerCaretIntoSpacer(gap);
    }
  };
  reader.readAsDataURL(file);
}

function readInlineStructureValue(node, selector, fallback){
  return String(node.querySelector(selector)?.value || fallback || '').trim() || fallback || '';
}

function readInlineStructureRawValue(node, selector, fallback=''){
  const el=node?.querySelector?.(selector);
  const value=el ? (el.value ?? el.getAttribute?.('value') ?? '') : '';
  return String(value || fallback || '');
}

function getInlineMatrixDimensions(node){
  return {
    rows:clampInlineMatrixDimension(node?.dataset?.rows, 3),
    cols:clampInlineMatrixDimension(node?.dataset?.cols, 3)
  };
}

function getInlineMatrixCellValues(node){
  const {rows, cols}=getInlineMatrixDimensions(node);
  return Array.from({length:rows},(_,row)=>Array.from({length:cols},(_,col)=>{
    const input=node?.querySelector?.(`.matrix-cell-input[data-row="${row}"][data-col="${col}"]`);
    return String(input?.value ?? input?.getAttribute?.('value') ?? '').trim();
  }));
}

function getInlineMatrixLatex(node){
  const cells=getInlineMatrixCellValues(node);
  const rowTex=cells.map(row=>row.map(value=>composerExprToLatex(value) || '\\;').join(' & '));
  return `\\begin{bmatrix}${rowTex.join(' \\\\ ')}\\end{bmatrix}`;
}

function getInlineMatrixPlainText(node){
  return '['+getInlineMatrixCellValues(node).map(row=>row.join(', ')).join('; ')+']';
}

function getIntegralSymbolForKind(kind){
  if(kind==='doubleIntegral' || kind==='doubleIntegralLimits') return '∬';
  if(kind==='tripleIntegral' || kind==='tripleIntegralLimits') return '∭';
  if(kind==='contourIntegral' || kind==='contourIntegralLimits') return '∮';
  return '∫';
}

function getIntegralOrderForKind(kind){
  if(String(kind||'').toLowerCase().includes('triple')) return 3;
  if(String(kind||'').toLowerCase().includes('double')) return 2;
  return 1;
}

function getDefaultIntegralVariables(kind){
  const order=getIntegralOrderForKind(kind);
  if(order>=3) return ['x','y','z'];
  if(order===2) return ['x','y'];
  return ['x'];
}

function getIntegralDifferentialInputsHTML(kind){
  return getDefaultIntegralVariables(kind).map((name, idx)=>`
    <span class="structure-differential-prefix">d</span><input class="structure-input structure-limit structure-var structure-var-${idx+1}" placeholder="${escA(name)}" aria-label="Variable ${idx+1}">
  `).join('');
}

function parseIntegralVariables(kind, raw){
  const defaults=getDefaultIntegralVariables(kind);
  const cleaned=String(raw || '').trim();
  if(!cleaned) return defaults;
  const parts=cleaned
    .split(/[,;\s]+/)
    .map(part=>part.trim())
    .filter(Boolean);
  if(parts.length<=1 && cleaned === defaults[0] && defaults.length>1) return defaults;
  const out=parts.length ? parts : [cleaned];
  while(out.length<defaults.length) out.push(defaults[out.length]);
  return out.slice(0, defaults.length);
}

function getIntegralDifferentialText(kind, raw, tex=false){
  return parseIntegralVariables(kind, raw)
    .map(v=>tex ? `d${v}` : `d${v}`)
    .join(tex ? '\\, ' : ' ');
}

function readIntegralVariableText(node, kind){
  const defaults=getDefaultIntegralVariables(kind);
  const fields=defaults.map((_, idx)=>node.querySelector(`.structure-var-${idx+1}`)).filter(Boolean);
  if(fields.length){
    return defaults.map((fallback, idx)=>String(fields[idx]?.value || fields[idx]?.getAttribute('value') || fallback).trim() || fallback).join(', ');
  }
  return readInlineStructureValue(node, '.structure-var', defaults.join(', '));
}

function getIntegralLatexCommand(kind){
  if(kind==='doubleIntegral' || kind==='doubleIntegralLimits') return '\\iint';
  if(kind==='tripleIntegral' || kind==='tripleIntegralLimits') return '\\iiint';
  if(kind==='contourIntegral' || kind==='contourIntegralLimits') return '\\oint';
  return '\\int';
}

function isIntegralStructureKind(kind){
  return ['integral','integralPlain','doubleIntegral','doubleIntegralLimits','doubleIntegralEachLimits','doubleIntegralFirstLimits','tripleIntegral','tripleIntegralLimits','tripleIntegralEachLimits','contourIntegral','contourIntegralLimits'].includes(kind);
}

function hasIntegralLimits(kind){
  return kind==='integral' || kind==='doubleIntegralLimits' || kind==='tripleIntegralLimits' || kind==='contourIntegralLimits';
}

function hasPerIntegralLimits(kind){
  return kind==='doubleIntegralEachLimits' || kind==='tripleIntegralEachLimits' || kind==='doubleIntegralFirstLimits';
}

function isDerivativeStructureKind(kind){
  return ['derivative','secondDerivative','partialDerivative','secondPartialDerivative','derivativePower','partialDerivativePower'].includes(kind);
}

function isPowerDerivativeKind(kind){
  return kind==='derivativePower' || kind==='partialDerivativePower';
}

function isPartialDerivativeStructureKind(kind){
  return kind==='partialDerivative' || kind==='secondPartialDerivative' || kind==='partialDerivativePower';
}

function isSecondDerivativeStructureKind(kind){
  return kind==='secondDerivative' || kind==='secondPartialDerivative';
}

function isRootStructureKind(kind){
  return ['rootSquare','rootCube','rootNth'].includes(kind);
}

function isFunctionStructureKind(kind){
  return ['expFunc','lnFunc','logFunc','modFunc','absFunc','floorFunc','ceilFunc','sgnFunc','argFunc','realFunc','imagFunc','gcdFunc','lcmFunc','detFunc'].includes(kind);
}

function isDelimitedFunctionStructureKind(kind){
  return ['absFunc','floorFunc','ceilFunc'].includes(kind);
}

function getFunctionStructureDelimiters(kind){
  if(kind==='absFunc') return ['|','|'];
  if(kind==='floorFunc') return ['⌊','⌋'];
  if(kind==='ceilFunc') return ['⌈','⌉'];
  return ['(',')'];
}

function getFunctionStructureLabel(kind){
  if(kind==='expFunc') return 'e';
  if(kind==='lnFunc') return 'ln';
  if(kind==='logFunc') return 'log';
  if(kind==='modFunc') return 'mod';
  if(kind==='absFunc') return '|x|';
  if(kind==='floorFunc') return '⌊x⌋';
  if(kind==='ceilFunc') return '⌈x⌉';
  if(kind==='sgnFunc') return 'sgn';
  if(kind==='argFunc') return 'arg';
  if(kind==='realFunc') return 'Re';
  if(kind==='imagFunc') return 'Im';
  if(kind==='gcdFunc') return 'gcd';
  if(kind==='lcmFunc') return 'lcm';
  if(kind==='detFunc') return 'det';
  return 'f';
}

function isLargeBracketStructureKind(kind){
  return ['largeParen','largeBracket','largeBrace'].includes(kind);
}

function getLargeBracketChars(kind){
  if(kind==='largeBracket') return ['[',']'];
  if(kind==='largeBrace') return ['{','}'];
  return ['(',')'];
}

function getStructureInlineInputText(kind, preset=''){
  if(isLargeBracketStructureKind(kind)){
    const [left,right]=getLargeBracketChars(kind);
    return `${left}${right}`;
  }
  if(isRootStructureKind(kind)){
    if(kind==='rootCube') return '∛x';
    if(kind==='rootNth') return 'ⁿ√x';
    return '√x';
  }
  if(isFunctionStructureKind(kind)){
    if(kind==='expFunc') return 'e^x';
    if(kind==='absFunc') return '|x|';
    if(kind==='floorFunc') return '⌊x⌋';
    if(kind==='ceilFunc') return '⌈x⌉';
    if(kind==='lnFunc') return 'ln(x)';
    if(kind==='modFunc') return 'mod(x)';
    if(kind==='logFunc') return 'log(x)';
    return `${getFunctionStructureLabel(kind)}(x)`;
  }
  if(isDerivativeStructureKind(kind)){
    if(kind==='partialDerivativePower') return '∂ⁿ/∂xⁿ f(x)';
    if(kind==='derivativePower') return 'dⁿ/dxⁿ f(x)';
    if(kind==='secondPartialDerivative') return '∂²/∂x² f(x)';
    if(kind==='partialDerivative') return '∂/∂x f(x)';
    if(kind==='secondDerivative') return 'd²/dx² f(x)';
    return 'd/dx f(x)';
  }
  if(kind==='vector') return `${preset || 'A'}⃗`;
  if(kind==='summation') return 'Σ(i=1 to n) aᵢ';
  if(kind==='summationPlain') return 'Σ term';
  if(kind==='limit') return 'lim x→0 f(x)';
  if(kind==='limitPlain') return 'lim f(x)';
  if(isIntegralStructureKind(kind)){
    const order=getIntegralOrderForKind(kind);
    const symbol=getIntegralSymbolForKind(kind);
    const vars=getDefaultIntegralVariables(kind).map(v=>'d'+v).join(' ');
    if(hasIntegralLimits(kind) || hasPerIntegralLimits(kind)) return `${symbol}(a to b) f(x) ${vars}`;
    if(order>1) return `${'∫'.repeat(order)} f(x) ${vars}`;
    return `${symbol} f(x) ${vars}`;
  }
  return 'f(x)';
}

function getStructureInlineInputLatex(kind, preset=''){
  if(isLargeBracketStructureKind(kind)){
    const [left,right]=getLargeBracketChars(kind);
    return `${left}${right}`;
  }
  if(isRootStructureKind(kind)){
    if(kind==='rootCube') return '\\sqrt[3]{x}';
    if(kind==='rootNth') return '\\sqrt[n]{x}';
    return '\\sqrt{x}';
  }
  if(isFunctionStructureKind(kind)){
    if(kind==='expFunc') return 'e^{x}';
    if(kind==='absFunc') return '\\left|x\\right|';
    if(kind==='floorFunc') return '\\left\\lfloor x\\right\\rfloor';
    if(kind==='ceilFunc') return '\\left\\lceil x\\right\\rceil';
    if(kind==='lnFunc') return '\\ln\\left(x\\right)';
    if(kind==='modFunc') return '\\operatorname{mod}\\left(x\\right)';
    if(kind==='logFunc') return '\\log\\left(x\\right)';
    if(kind==='sgnFunc') return '\\operatorname{sgn}\\left(x\\right)';
    if(kind==='argFunc') return '\\arg\\left(x\\right)';
    if(kind==='realFunc') return '\\operatorname{Re}\\left(x\\right)';
    if(kind==='imagFunc') return '\\operatorname{Im}\\left(x\\right)';
    if(kind==='gcdFunc') return '\\gcd\\left(x\\right)';
    if(kind==='lcmFunc') return '\\operatorname{lcm}\\left(x\\right)';
    if(kind==='detFunc') return '\\det\\left(x\\right)';
  }
  if(isDerivativeStructureKind(kind)){
    if(kind==='partialDerivativePower') return '\\frac{\\partial^{n}}{\\partial x^{n}} f(x)';
    if(kind==='derivativePower') return '\\frac{d^{n}}{dx^{n}} f(x)';
    if(kind==='secondPartialDerivative') return '\\frac{\\partial^{2}}{\\partial x^{2}} f(x)';
    if(kind==='partialDerivative') return '\\frac{\\partial}{\\partial x} f(x)';
    if(kind==='secondDerivative') return '\\frac{d^{2}}{dx^{2}} f(x)';
    return '\\frac{d}{dx} f(x)';
  }
  if(kind==='visualEquation') return preset || 'x_bar';
  if(kind==='vector') return `\\vec{${preset || 'A'}}`;
  if(kind==='summation') return '\\sum_{i=1}^{n} a_i';
  if(kind==='summationPlain') return '\\sum term';
  if(kind==='limit') return '\\lim_{x\\to 0} f(x)';
  if(kind==='limitPlain') return '\\lim f(x)';
  if(isIntegralStructureKind(kind)){
    const vars=getDefaultIntegralVariables(kind);
    const differentials=vars.map(v=>`\\, d${v}`).join('');
    if(kind==='integral') return '\\int_{a}^{b} f(x)\\, dx';
    if(kind==='integralPlain') return '\\int f(x)\\, dx';
    if(kind==='doubleIntegralLimits') return '\\iint_{a}^{b} f(x)\\, dx\\, dy';
    if(kind==='tripleIntegralLimits') return '\\iiint_{a}^{b} f(x)\\, dx\\, dy\\, dz';
    if(kind==='contourIntegralLimits') return '\\oint_{a}^{b} f(x)\\, dx';
    if(kind==='doubleIntegralEachLimits') return '\\int_{a}^{b}\\int_{c}^{d} f(x)\\, dx\\, dy';
    if(kind==='doubleIntegralFirstLimits') return '\\int_{a}^{b}\\int f(x)\\, dx\\, dy';
    if(kind==='tripleIntegralEachLimits') return '\\int_{a}^{b}\\int_{c}^{d}\\int_{e}^{f} f(x)\\, dx\\, dy\\, dz';
    return `${getIntegralLatexCommand(kind)} f(x)${differentials}`;
  }
  return 'f(x)';
}

function getStructureInlineInputInsert(kind, preset=''){
  if(isLargeBracketStructureKind(kind)){
    const [left,right]=getLargeBracketChars(kind);
    const map={
      largeParen:['\\left(', '\\right)'],
      largeBracket:['\\left[', '\\right]'],
      largeBrace:['\\left\\{', '\\right\\}']
    };
    const pair=map[kind] || [left,right];
    return { text:`${pair[0]} ${pair[1]}`, caretOffset:-(pair[1].length+1) };
  }
  return { text:getStructureInlineInputLatex(kind, preset), caretOffset:0 };
}

function getInlineStructureDefaultExpr(kind){
  if(kind==='summation') return 'a_i';
  if(kind==='visualEquation') return 'x_bar';
  if(kind==='vector') return 'A';
  if(isLargeBracketStructureKind(kind)) return '';
  if(isRootStructureKind(kind)) return 'x';
  if(isFunctionStructureKind(kind)) return 'x';
  return 'f(x)';
}

function getInlineStructureLatex(node){
  const kind=String(node?.dataset?.kind || 'integral');
  if(kind==='matrix') return getInlineMatrixLatex(node);
  const expr=isLargeBracketStructureKind(kind)
    ? readInlineStructureRawValue(node, '.structure-expr', '')
    : readInlineStructureValue(node, '.structure-expr', getInlineStructureDefaultExpr(kind));
  const exprLatex=composerExprToLatex(expr);
  if(kind==='summationPlain'){
    return `\\sum ${exprLatex}`;
  }
  if(kind==='summation'){
    const lower=composerExprToLatex(readInlineStructureValue(node, '.structure-lower', 'i=1'));
    const upper=composerExprToLatex(readInlineStructureValue(node, '.structure-upper', 'n'));
    return `\\sum_{${lower}}^{${upper}} ${exprLatex}`;
  }
  if(kind==='vector'){
    return `\\vec{${exprLatex}}`;
  }
  if(kind==='visualEquation'){
    const visualExpr=normalizeComposerPastedLatexExpression(expr);
    return composerExprToLatex(visualExpr) || 'x';
  }
  if(isLargeBracketStructureKind(kind)){
    const [left,right]=getLargeBracketChars(kind);
    const ltxLeft=kind==='largeBrace' ? '\\left\\{' : kind==='largeBracket' ? '\\left[' : '\\left(';
    const ltxRight=kind==='largeBrace' ? '\\right\\}' : kind==='largeBracket' ? '\\right]' : '\\right)';
    return `${ltxLeft} ${exprLatex} ${ltxRight}`;
  }
  if(isRootStructureKind(kind)){
    const index=kind==='rootCube' ? '3' : composerExprToLatex(readInlineStructureValue(node, '.structure-root-index', kind==='rootNth' ? 'n' : ''));
    return index ? `\\sqrt[${index}]{${exprLatex}}` : `\\sqrt{${exprLatex}}`;
  }
  if(isFunctionStructureKind(kind)){
    if(kind==='expFunc') return `e^{${exprLatex}}`;
    if(kind==='absFunc') return `\\left|${exprLatex}\\right|`;
    if(kind==='floorFunc') return `\\left\\lfloor ${exprLatex}\\right\\rfloor`;
    if(kind==='ceilFunc') return `\\left\\lceil ${exprLatex}\\right\\rceil`;
    if(kind==='lnFunc') return `\\ln\\left(${exprLatex}\\right)`;
    if(kind==='modFunc') return `\\operatorname{mod}\\left(${exprLatex}\\right)`;
    if(kind==='logFunc') return `\\log\\left(${exprLatex}\\right)`;
    if(kind==='sgnFunc') return `\\operatorname{sgn}\\left(${exprLatex}\\right)`;
    if(kind==='argFunc') return `\\arg\\left(${exprLatex}\\right)`;
    if(kind==='realFunc') return `\\operatorname{Re}\\left(${exprLatex}\\right)`;
    if(kind==='imagFunc') return `\\operatorname{Im}\\left(${exprLatex}\\right)`;
    if(kind==='gcdFunc') return `\\gcd\\left(${exprLatex}\\right)`;
    if(kind==='lcmFunc') return `\\operatorname{lcm}\\left(${exprLatex}\\right)`;
    if(kind==='detFunc') return `\\det\\left(${exprLatex}\\right)`;
  }
  if(isDerivativeStructureKind(kind)){
    const variable=composerExprToLatex(readInlineStructureValue(node, '.structure-var', 'x'));
    const power=composerExprToLatex(readInlineStructureValue(node, '.structure-order', 'n'));
    if(kind==='partialDerivativePower') return `\\frac{\\partial^{${power}} ${exprLatex}}{\\partial ${variable}^{${power}}}`;
    if(kind==='derivativePower') return `\\frac{d^{${power}} ${exprLatex}}{d${variable}^{${power}}}`;
    if(kind==='partialDerivative') return `\\frac{\\partial ${exprLatex}}{\\partial ${variable}}`;
    if(kind==='secondPartialDerivative') return `\\frac{\\partial^2 ${exprLatex}}{\\partial ${variable}^2}`;
    if(kind==='secondDerivative') return `\\frac{d^2 ${exprLatex}}{d${variable}^2}`;
    return `\\frac{d ${exprLatex}}{d${variable}}`;
  }
  if(kind==='limitPlain'){
    return `\\lim ${exprLatex}`;
  }
  if(kind==='limit'){
    const variable=composerExprToLatex(readInlineStructureValue(node, '.structure-var', 'x'));
    const toValue=composerExprToLatex(readInlineStructureValue(node, '.structure-to-value', '0'));
    return `\\lim_{${variable} \\to ${toValue}} ${exprLatex}`;
  }
  if(isIntegralStructureKind(kind)){
    const variable=readIntegralVariableText(node, kind);
    const differential=parseIntegralVariables(kind, variable).map(v=>`d${composerExprToLatex(v)}`).join('\\, ');
    if(hasPerIntegralLimits(kind)){
      const order=getIntegralOrderForKind(kind);
      const symbols=[];
      for(let i=1;i<=order;i++){
        const lower=composerExprToLatex(readInlineStructureValue(node, `.structure-lower-${i}`, i===1 ? 'a' : ''));
        const upper=composerExprToLatex(readInlineStructureValue(node, `.structure-upper-${i}`, i===1 ? 'b' : ''));
        if(kind==='doubleIntegralFirstLimits' && i>1) symbols.push('\\int');
        else symbols.push(`\\int_{${lower||'a'}}^{${upper||'b'}}`);
      }
      return `${symbols.join(' ')} ${exprLatex}\\, ${differential}`;
    }
    const base=getIntegralLatexCommand(kind);
    if(hasIntegralLimits(kind)){
      const lower=composerExprToLatex(readInlineStructureValue(node, '.structure-lower', 'a'));
      const upper=composerExprToLatex(readInlineStructureValue(node, '.structure-upper', 'b'));
      return `${base}_{${lower}}^{${upper}} ${exprLatex}\\, ${differential}`;
    }
    return `${base} ${exprLatex}\\, ${differential}`;
  }
  return exprLatex;
}

function getInlineStructurePlainText(node){
  const kind=String(node?.dataset?.kind || 'integral');
  if(kind==='matrix') return getInlineMatrixPlainText(node);
  const expr=isLargeBracketStructureKind(kind)
    ? readInlineStructureRawValue(node, '.structure-expr', '')
    : readInlineStructureValue(node, '.structure-expr', getInlineStructureDefaultExpr(kind));
  if(kind==='summationPlain'){
    return `sum ${expr}`;
  }
  if(kind==='summation'){
    return `sum(${readInlineStructureValue(node, '.structure-lower', 'i=1')} to ${readInlineStructureValue(node, '.structure-upper', 'n')}) ${expr}`;
  }
  if(kind==='vector'){
    return `vec(${expr})`;
  }
  if(kind==='visualEquation'){
    return expr;
  }
  if(isLargeBracketStructureKind(kind)){
    const [left,right]=getLargeBracketChars(kind);
    return `${left}${expr}${right}`;
  }
  if(isRootStructureKind(kind)){
    const index=kind==='rootCube' ? '3' : readInlineStructureValue(node, '.structure-root-index', kind==='rootNth' ? 'n' : '');
    return index ? `${index}root(${expr})` : `sqrt(${expr})`;
  }
  if(isFunctionStructureKind(kind)){
    if(kind==='expFunc') return `e^(${expr})`;
    if(kind==='absFunc') return `|${expr}|`;
    if(kind==='floorFunc') return `⌊${expr}⌋`;
    if(kind==='ceilFunc') return `⌈${expr}⌉`;
    if(kind==='lnFunc') return `ln(${expr})`;
    if(kind==='modFunc') return `mod(${expr})`;
    if(kind==='logFunc') return `log(${expr})`;
    return `${getFunctionStructureLabel(kind)}(${expr})`;
  }
  if(isDerivativeStructureKind(kind)){
    const variable=readInlineStructureValue(node, '.structure-var', 'x');
    const power=readInlineStructureValue(node, '.structure-order', 'n');
    const label=isPartialDerivativeStructureKind(kind) ? 'partial' : 'd';
    const order=isPowerDerivativeKind(kind) ? power : (isSecondDerivativeStructureKind(kind) ? '2' : '');
    return `${label}${order}/d${variable}${order ? '^'+order : ''} ${expr}`;
  }
  if(kind==='limitPlain'){
    return `lim ${expr}`;
  }
  if(kind==='limit'){
    return `lim ${readInlineStructureValue(node, '.structure-var', 'x')} -> ${readInlineStructureValue(node, '.structure-to-value', '0')} ${expr}`;
  }
  if(isIntegralStructureKind(kind)){
    const symbol=getIntegralSymbolForKind(kind);
    const variable=readIntegralVariableText(node, kind);
    const differential=getIntegralDifferentialText(kind, variable, false);
    if(hasPerIntegralLimits(kind)){
      const order=getIntegralOrderForKind(kind);
      const pieces=[];
      for(let i=1;i<=order;i++){
        if(kind==='doubleIntegralFirstLimits' && i>1){
          pieces.push('int');
          continue;
        }
        pieces.push(`int${i}(${readInlineStructureValue(node, `.structure-lower-${i}`, 'a')} to ${readInlineStructureValue(node, `.structure-upper-${i}`, 'b')})`);
      }
      return `${pieces.join(' ')} ${expr} ${differential}`;
    }
    if(hasIntegralLimits(kind)){
      return `${symbol}(${readInlineStructureValue(node, '.structure-lower', 'a')} to ${readInlineStructureValue(node, '.structure-upper', 'b')}) ${expr} ${differential}`;
    }
    return `${symbol} ${expr} ${differential}`;
  }
  return expr;
}

function getInlineStructureParts(node){
  const kind=String(node?.dataset?.kind || 'integral');
  const expr=isLargeBracketStructureKind(kind)
    ? readInlineStructureRawValue(node, '.structure-expr', '')
    : readInlineStructureValue(node, '.structure-expr', getInlineStructureDefaultExpr(kind));
  return {
    kind,
    lower:readInlineStructureValue(node, '.structure-lower', kind==='summation' ? 'i=1' : 'a'),
    upper:readInlineStructureValue(node, '.structure-upper', kind==='summation' ? 'n' : 'b'),
    lower1:readInlineStructureValue(node, '.structure-lower-1', 'a'),
    upper1:readInlineStructureValue(node, '.structure-upper-1', 'b'),
    lower2:readInlineStructureValue(node, '.structure-lower-2', 'c'),
    upper2:readInlineStructureValue(node, '.structure-upper-2', 'd'),
    lower3:readInlineStructureValue(node, '.structure-lower-3', 'e'),
    upper3:readInlineStructureValue(node, '.structure-upper-3', 'f'),
    variable:isIntegralStructureKind(kind) ? readIntegralVariableText(node, kind) : readInlineStructureValue(node, '.structure-var', 'x'),
    rootIndex:kind==='rootCube' ? '3' : readInlineStructureValue(node, '.structure-root-index', kind==='rootNth' ? 'n' : ''),
    bracketLeft:isLargeBracketStructureKind(kind) ? getLargeBracketChars(kind)[0] : '',
    bracketRight:isLargeBracketStructureKind(kind) ? getLargeBracketChars(kind)[1] : '',
    toValue:readInlineStructureValue(node, '.structure-to-value', '0'),
    order:readInlineStructureValue(node, '.structure-order', isPowerDerivativeKind(kind) ? 'n' : ''),
    matrixRows:kind==='matrix' ? clampInlineMatrixDimension(node?.dataset?.rows, 3) : 0,
    matrixCols:kind==='matrix' ? clampInlineMatrixDimension(node?.dataset?.cols, 3) : 0,
    matrixCells:kind==='matrix' ? getInlineMatrixCellValues(node) : [],
    expr,
    text:getInlineStructurePlainText(node)
  };
}

function splitComposerVisualAccentText(text){
  const source=String(text||'');
  const parts=[];
  const pattern=/([A-Za-z])(?:_bar|_overline)\b|([A-Za-z])(?:_hat)\b|([A-Za-z])(?:_vec|_vector)\b|([A-Za-z])\u0304/g;
  let last=0;
  let match;
  while((match=pattern.exec(source))){
    const before=source.slice(last, match.index);
    if(before) parts.push({type:'text', text:before});
    if(match[1]) parts.push({type:'eq', latex:`\\bar{${match[1]}}`, text:match[1]+'\u0304'});
    else if(match[2]) parts.push({type:'eq', latex:`\\hat{${match[2]}}`, text:match[2]+'\u0302'});
    else if(match[3]) parts.push({type:'eq', latex:`\\vec{${match[3]}}`, text:match[3]+'\u20D7'});
    else if(match[4]) parts.push({type:'eq', latex:`\\bar{${match[4]}}`, text:match[4]+'\u0304'});
    last=pattern.lastIndex;
  }
  const tail=source.slice(last);
  if(tail) parts.push({type:'text', text:tail});
  return parts.length ? parts : [{type:'text', text:source}];
}

function extractMixedComposerLines(root){
  const lines=[[]];
  const pushText=(text, style={})=>{
    const clean=String(text||'').replace(/[\u200B\u2060]/g,'').replace(/\u00a0/g,' ');
    if(!clean) return;
    clean.split('\n').forEach((part, idx)=>{
      if(idx>0) newline();
      if(part){
        if(isClearComposerLatexExpression(part.trim())){
          const latex=composerExprToLatex(normalizeComposerPastedLatexExpression(part));
          lines[lines.length-1].push({ type:'eq', latex, text:stripComposerLatexDelimiters(part), style:{...style} });
          return;
        }
        splitComposerVisualAccentText(part).forEach(seg=>{
          if(seg.type==='eq') lines[lines.length-1].push({ type:'eq', latex:seg.latex, text:seg.text, style:{...style} });
          else if(seg.text) lines[lines.length-1].push({ type:'text', text:seg.text, style:{...style} });
        });
      }
    });
  };
  const newline=()=>{
    lines.push([]);
  };
  const pushTokenVisual=(node, style={})=>{
    const render=node.querySelector?.('.composer-eq-render') || node;
    const fracs=Array.from(render.querySelectorAll?.('.composer-eq-frac') || []);
    if(fracs.length===1 && render.textContent.trim()===fracs[0].textContent.trim()){
      const num=String(fracs[0].querySelector('.fn')?.textContent || 'a').trim() || 'a';
      const den=String(fracs[0].querySelector('.fd')?.textContent || 'b').trim() || 'b';
      lines[lines.length-1].push({ type:'eq', latex:getInlineFractionLatex(num, den, 'stacked'), text:`${num}/${den}`, style:{...style} });
      return true;
    }
    const plain=String(node.dataset?.plain || render.textContent || '').trim();
    if(plain){
      pushText(plain, style);
      return true;
    }
    return false;
  };
  const walk=(node, style={ bold:false, italic:false, underline:false, sup:false, sub:false, supDepth:0, subDepth:0 })=>{
    if(node.nodeType===3){
      pushText(node.nodeValue, style);
      return;
    }
    if(node.nodeType!==1) return;
    if(node.classList?.contains('composer-free-bracket')){
      const ch=String(node.dataset.bracketChar || node.textContent || '').slice(0,1);
      if(ch) lines[lines.length-1].push({ type:'bracketDraw', text:ch, style:{...style} });
      return;
    }
    if(node.classList?.contains('composer-eq-token')){
      if(pushTokenVisual(node, style)) return;
      lines[lines.length-1].push({
        type:'eq',
        latex:String(node.dataset.latex||'').trim(),
        text:String(node.dataset.plain||node.textContent||''),
        style:{...style}
      });
      return;
    }
    if(node.classList?.contains('composer-inline-frac')){
      const num=String(node.querySelector('.frac-num')?.value || 'a').trim() || 'a';
      const den=String(node.querySelector('.frac-den')?.value || 'b').trim() || 'b';
      const variant=String(node.dataset.variant||'stacked');
      lines[lines.length-1].push({
        type:'eq',
        latex:getInlineFractionLatex(num, den, variant),
        text:`${num}/${den}`,
        style:{...style}
      });
      return;
    }
    if(node.classList?.contains('composer-inline-structure')){
      lines[lines.length-1].push({
        type:'structure',
        latex:getInlineStructureLatex(node),
        ...getInlineStructureParts(node),
        style:{...style}
      });
      return;
    }
    if(node.tagName==='IMG' && node.classList?.contains('composer-inline-image')){
      lines[lines.length-1].push({
        type:'img',
        src:node.getAttribute('src')||'',
        width:+(node.dataset.w||node.naturalWidth||node.width||120),
        height:+(node.dataset.h||node.naturalHeight||node.height||40),
        text:'[Image]',
        style:{...style}
      });
      return;
    }
    if(node.tagName==='BR'){
      newline();
      return;
    }
    const nextStyle={...style};
    if(/^(B|STRONG)$/i.test(node.tagName)) nextStyle.bold=true;
    if(/^(I|EM)$/i.test(node.tagName)) nextStyle.italic=true;
    if(/^U$/i.test(node.tagName)) nextStyle.underline=true;
    if(/^SUP$/i.test(node.tagName)){
      nextStyle.sup=true;
      nextStyle.sub=false;
      nextStyle.supDepth=(Number(style.supDepth)||0)+1;
      nextStyle.subDepth=0;
    }
    if(/^SUB$/i.test(node.tagName)){
      nextStyle.sub=true;
      nextStyle.sup=false;
      nextStyle.subDepth=(Number(style.subDepth)||0)+1;
      nextStyle.supDepth=0;
    }
    const block=/^(DIV|P)$/i.test(node.tagName);
    Array.from(node.childNodes).forEach(child=>walk(child,nextStyle));
    if(block) newline();
  };
  Array.from(root.childNodes).forEach(node=>walk(node));
  while(lines.length>1 && !lines[lines.length-1].length) lines.pop();
  return lines;
}

function getMixedComposerPlainText(root){
  return extractMixedComposerLines(root).map(line=>line.map(seg=>{
    if(seg.type==='eq') return seg.text || '';
    if(seg.type==='img') return '[Image]';
    if(seg.type==='frac') return `${seg.num||'a'}/${seg.den||'b'}`;
    if(seg.type==='structure') return seg.text || '';
    return seg.text;
  }).join('')).join('\n').replace(/[\u200B\u2060]/g,'').replace(/\n+$/,'');
}

const MIXED_COMPOSER_TEXT_SIZE_KEY='qgen_mixed_composer_text_size_v1';
const MIXED_COMPOSER_MATH_SIZE_KEY='qgen_mixed_composer_math_size_v1';
const MIXED_COMPOSER_INNER_MATH_SCALE_KEY='qgen_mixed_composer_inner_math_scale_v1';
const MIXED_COMPOSER_EQUATION_STROKE_KEY='qgen_mixed_composer_equation_stroke_v1';
const MIXED_COMPOSER_RENDER_PROFILE_KEY='qgen_mixed_composer_render_profile_v1';
(function ensurePdfLinkedPreviewStyles(){
  if(document.getElementById('pdfLinkedPreviewStyles')) return;
  const st=document.createElement('style');
  st.id='pdfLinkedPreviewStyles';
  st.textContent=' .pdf-linked-head{margin:8px 0 4px;font-size:11px;font-weight:700;color:var(--ink)} .pdf-linked-preview{--linked-composer-size:20px;--linked-composer-line:1.50;min-height:48px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;overflow:visible;height:auto;font-family:"Cambria Math","STIX Two Math","STIXGeneral","Times New Roman",serif;font-size:var(--linked-composer-size);line-height:var(--linked-composer-line);white-space:normal;word-break:normal} .pdf-linked-preview .lp-text-line{display:block;min-height:calc(var(--linked-composer-size) * var(--linked-composer-line));white-space:pre-wrap} .pdf-linked-preview .lp-blank-line{height:calc(var(--linked-composer-size) * var(--linked-composer-line))} .pdf-linked-preview .composer-inline-image{max-width:100%;height:auto;vertical-align:middle} .pdf-linked-preview .composer-eq-token,.pdf-linked-preview .inline-frac,.pdf-linked-preview .inline-structure,.pdf-linked-preview .composer-inline-frac,.pdf-linked-preview .composer-inline-structure{vertical-align:middle} .pdf-linked-preview .structure-input,.pdf-linked-preview .frac-input{border:0!important;background:transparent!important;box-shadow:none!important;outline:none!important;padding:0 1px!important;border-radius:0!important;color:inherit!important;pointer-events:none!important} .pdf-linked-preview .structure-main,.pdf-linked-preview .structure-expr,.pdf-linked-preview .frac-input,.pdf-linked-preview .linked-preview-value{font-size:1em!important;line-height:1.05!important} .pdf-linked-preview .structure-limit,.pdf-linked-preview .structure-order,.pdf-linked-preview .linked-preview-limit,.pdf-linked-preview .linked-preview-order{font-size:calc(var(--linked-composer-size) * 0.54)!important;line-height:0.98!important} .pdf-linked-preview .structure-symbol{font-size:calc(var(--linked-composer-size) * 1.02);line-height:1!important} .pdf-linked-preview .derivative-symbol{font-size:calc(var(--linked-composer-size) * 0.78)!important} .pdf-linked-preview .linked-preview-value,.pdf-linked-preview .linked-preview-limit,.pdf-linked-preview .linked-preview-order{display:inline-block;min-width:0;padding:0 0.5px;vertical-align:middle;white-space:nowrap} .pdf-linked-preview .linked-preview-limit{position:relative;top:-0.02em} .pdf-linked-preview .structure-upper.linked-preview-limit,[class*="structure-upper-"] .linked-preview-limit{margin-bottom:0.01em} .pdf-linked-preview .structure-lower.linked-preview-limit,[class*="structure-lower-"] .linked-preview-limit{margin-top:-0.03em} .pdf-linked-preview .structure-differential-prefix{margin-left:0.02em;margin-right:-0.02em} .pdf-linked-preview .composer-inline-structure,.pdf-linked-preview .composer-inline-frac{white-space:nowrap;margin-right:0.08em} .pdf-linked-preview .composer-inline-structure input,.pdf-linked-preview .composer-inline-frac input{width:auto!important;min-width:0!important;max-width:none!important} .pdf-linked-preview .structure-symbol > span{display:inline-block;vertical-align:middle} .pdf-linked-preview .structure-to{margin:0 -0.02em} .pdf-linked-preview .structure-input::placeholder,.pdf-linked-preview .frac-input::placeholder{color:transparent!important} .pdf-linked-preview .structure-symbol,.pdf-linked-preview .composer-eq-render,.pdf-linked-preview .composer-eq-token,.pdf-linked-preview .composer-inline-frac,.pdf-linked-preview .composer-inline-structure{background:transparent!important;border-color:transparent!important;box-shadow:none!important} .pdf-linked-preview .structure-deriv-line{background:currentColor!important} .pdf-linked-preview .lp-op-text{display:inline-block;white-space:nowrap;vertical-align:middle} .pdf-linked-preview .lp-op-text sup{font-size:0.58em;line-height:1;position:relative;top:-0.55em;left:-0.05em} .pdf-linked-preview .lp-op-text sub{font-size:0.58em;line-height:1;position:relative;top:0.55em;left:-0.32em} .pdf-linked-preview .lp-deriv-text{white-space:nowrap} .pdf-linked-preview:not(.has-linked-content){color:var(--muted);font-style:italic}';
  document.head.appendChild(st);
})();
(function ensureSelectableCanvasFigureStyles(){
  if(document.getElementById('selectableCanvasFigureStyles')) return;
  const st=document.createElement('style');
  st.id='selectableCanvasFigureStyles';
  st.textContent=[
    '.pdf-linked-preview .lp-canvas-figures{display:block;max-width:100%;overflow:visible;margin:0.08em 0}',
    '.pdf-linked-preview .lp-coordinate-frame{position:relative;display:block;min-height:var(--lp-coordinate-height,0px);overflow:visible}',
    '.pdf-linked-preview .lp-coordinate-source{position:relative;z-index:1;display:block}',
    '.pdf-linked-preview .lp-coordinate-frame .lp-canvas-figures{position:absolute;left:0;top:0;z-index:0;margin:0}',
    '.pdf-linked-preview .lp-canvas-figure-stack{position:relative;display:block;max-width:100%;overflow:visible}',
    '.pdf-linked-preview .lp-canvas-figure{position:absolute;display:block;max-width:none;object-fit:contain;pointer-events:none}',
    '.pdf-linked-preview .lp-canvas-circuit{position:absolute;display:block;overflow:hidden;pointer-events:none}',
    '.pdf-linked-preview .lp-canvas-circuit svg{display:block;width:100%;height:100%;overflow:visible}',
    '.pdf-linked-preview .lp-frac{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;vertical-align:-.34em;min-width:1.45em;margin:0 .08em;line-height:1}',
    '.pdf-linked-preview .lp-frac-num,.pdf-linked-preview .lp-frac-den{display:block;padding:0 .18em;white-space:nowrap;text-align:center}',
    '.pdf-linked-preview .lp-frac-num{padding-bottom:.02em}.pdf-linked-preview .lp-frac-den{padding-top:.02em}',
    '.pdf-linked-preview .lp-frac-bar{display:block;width:100%;border-top:1.35px solid currentColor;margin:.04em 0}',
    '.pdf-linked-preview .lp-frac .lp-frac{font-size:.86em;margin-left:.05em;margin-right:.05em}',
    '.pdf-linked-preview .lp-delimited{display:inline-flex;align-items:center;vertical-align:middle;white-space:nowrap;margin:0 .04em}',
    '.pdf-linked-preview .lp-delimiter{display:flex;align-items:center;align-self:stretch;font:1.36em/.86 "Cambria Math","STIX Two Math",serif;transform:scaleY(1.18);padding:0 .015em}',
    '.pdf-linked-preview .lp-delimited-body{display:inline-flex;align-items:center;padding:0 .08em}',
    '.pdf-linked-preview .lp-root{display:inline-flex;align-items:flex-start;vertical-align:-.08em;white-space:nowrap;margin:0 .04em}',
    '.pdf-linked-preview .lp-root-symbol{font:1.18em/.9 "Cambria Math","STIX Two Math",serif;margin-right:-.02em;position:relative;top:.06em}',
    '.pdf-linked-preview .lp-root-body{display:inline-block;border-top:1.35px solid currentColor;margin-left:.01em;padding:.03em .08em 0;line-height:1.02}',
    '.pdf-linked-preview .lp-root .lp-frac{font-size:.88em}',
    '.pdf-linked-preview .lp-bigop{display:inline-grid;grid-template-rows:auto auto auto;align-items:center;justify-items:center;vertical-align:-.48em;margin:0 .08em;line-height:1;white-space:nowrap}',
    '.pdf-linked-preview .lp-bigop-symbol{display:block;font:1.35em/.78 "Cambria Math","STIX Two Math",serif}',
    '.pdf-linked-preview .lp-bigop-word .lp-bigop-symbol{font-size:.95em;font-family:"Cambria Math","STIX Two Math","Times New Roman",serif;font-weight:400}',
    '.pdf-linked-preview .lp-bigop-upper,.pdf-linked-preview .lp-bigop-lower{display:block;min-height:.72em;font-size:.58em;line-height:.9;text-align:center;white-space:nowrap}',
    '.pdf-linked-preview .lp-bigop-upper:empty,.pdf-linked-preview .lp-bigop-lower:empty{visibility:hidden}',
    '.pdf-linked-preview .lp-katex-math{display:inline-block;vertical-align:middle;max-width:100%;line-height:1.14;margin:0 .04em}',
    '.pdf-linked-preview .lp-katex-math .katex{font-size:1em;line-height:1.14;color:#071526}',
    '.pdf-linked-preview .lp-katex-math .katex-html{white-space:nowrap}',
    '.pdf-linked-preview .lp-katex-math .merror{color:#111;background:transparent}',
    '.pdf-linked-preview .lp-katex-math .base{vertical-align:baseline}',
    '.pdf-linked-preview .lp-accent{position:relative;display:inline-block;padding-top:.18em;line-height:1;vertical-align:baseline;text-align:center}',
    '.pdf-linked-preview .lp-accent-bar::before{content:"";position:absolute;left:12%;right:12%;top:.02em;border-top:1.35px solid currentColor}',
    '.pdf-linked-preview .lp-accent-mark{position:absolute;left:50%;top:-.18em;transform:translateX(-50%);font-size:.72em;line-height:1;pointer-events:none}',
    '.pdf-linked-preview .lp-accent-vec .lp-accent-mark{font-size:.82em;top:-.22em}',
    '.pdf-linked-preview .lp-accent-dot .lp-accent-mark,.pdf-linked-preview .lp-accent-ddot .lp-accent-mark{top:-.12em;font-size:.75em}',
    '.pdf-linked-preview .linked-mathjax-preview{display:inline-block;max-width:100%;vertical-align:middle}',
    '.pdf-linked-preview .linked-mathjax-preview svg{display:inline-block;max-width:100%;height:auto;vertical-align:middle;overflow:visible}'
  ].join('');
  document.head.appendChild(st);
})();
let activeComposerRenderKey='';

function clampMixedComposerTextSize(value){
  const n=Math.round(Number(value)||20);
  return Math.max(12, Math.min(32, n));
}

function clampMixedComposerMathSize(value){
  const n=Math.round(Number(value)||22);
  return Math.max(14, Math.min(52, n));
}

function clampMixedComposerInnerMathScale(value){
  const n=Math.round(Number(value)||115);
  return Math.max(90, Math.min(180, n));
}

function clampMixedComposerEquationStroke(value){
  if(value==='strong') return 'bold'; // Preserve the previous saved setting.
  return ['fine','light','regular','bold','extra'].includes(value) ? value : 'light';
}

function clampMixedComposerRenderProfile(value){
  return value==='official' ? 'official' : 'hallmark';
}

function getStoredComposerTextSizeForKey(key){
  if(!cur || !key) return 0;
  if(key==='q') return clampMixedComposerTextSize(cur.questionComposerTextSize || 20);
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return clampMixedComposerTextSize(cur.options[idx]?.composerTextSize || 20);
  }
  return 0;
}

function getStoredComposerMathSizeForKey(key){
  if(!cur || !key) return 0;
  if(key==='q') return clampMixedComposerMathSize(cur.questionComposerMathSize || 22);
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return clampMixedComposerMathSize(cur.options[idx]?.composerMathSize || 22);
  }
  return 0;
}

function getStoredComposerInnerMathScaleForKey(key){
  if(!cur || !key) return 0;
  if(key==='q') return clampMixedComposerInnerMathScale(cur.questionComposerInnerMathScale || 115);
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return clampMixedComposerInnerMathScale(cur.options[idx]?.composerInnerMathScale || 115);
  }
  return 0;
}

function readMixedComposerTextSize(key=''){
  const dom=document.getElementById('mixedComposerTextSize');
  if(dom && dom.value) return clampMixedComposerTextSize(dom.value);
  const stored=getStoredComposerTextSizeForKey(key || activeComposerRenderKey);
  if(stored) return stored;
  try{ const ls=localStorage.getItem(MIXED_COMPOSER_TEXT_SIZE_KEY); if(ls) return clampMixedComposerTextSize(ls); }catch(_){ }
  return 20;
}

function readMixedComposerMathSize(key=''){
  const dom=document.getElementById('mixedComposerMathSize');
  if(dom && dom.value) return clampMixedComposerMathSize(dom.value);
  const stored=getStoredComposerMathSizeForKey(key || activeComposerRenderKey);
  if(stored) return stored;
  try{ const ls=localStorage.getItem(MIXED_COMPOSER_MATH_SIZE_KEY); if(ls) return clampMixedComposerMathSize(ls); }catch(_){ }
  return 22;
}

function readMixedComposerInnerMathScale(key=''){
  const dom=document.getElementById('mixedComposerInnerMathScale');
  if(dom && dom.value) return clampMixedComposerInnerMathScale(dom.value);
  const stored=getStoredComposerInnerMathScaleForKey(key || activeComposerRenderKey);
  if(stored) return stored;
  try{ const ls=localStorage.getItem(MIXED_COMPOSER_INNER_MATH_SCALE_KEY); if(ls) return clampMixedComposerInnerMathScale(ls); }catch(_){ }
  return 115;
}

function getMixedComposerTextOptionsHTML(selected){
  const current=clampMixedComposerTextSize(selected);
  const vals=[12,13,14,15,16,18,20,22,24,26,28,30,32];
  return vals.map(v=>'<option value="'+v+'"'+(v===current?' selected':'')+'>'+v+'</option>').join('');
}

function getMixedComposerMathOptionsHTML(selected){
  const current=clampMixedComposerMathSize(selected);
  const vals=[14,16,18,20,22,24,26,28,30,32,34,36,38,40,44,48,52];
  return vals.map(v=>'<option value="'+v+'"'+(v===current?' selected':'')+'>'+v+'</option>').join('');
}

function getMixedComposerInnerMathOptionsHTML(selected){
  const current=clampMixedComposerInnerMathScale(selected);
  const vals=[90,100,110,115,120,130,140,150,160,170,180];
  return vals.map(v=>'<option value="'+v+'"'+(v===current?' selected':'')+'>'+v+'%</option>').join('');
}

function getStoredComposerEquationStrokeForKey(key=''){
  if(!cur || !key) return '';
  const stored=key==='q' ? cur.questionComposerEquationInk : (key.startsWith('opt') ? cur.options?.[+key.slice(3)]?.composerEquationInk : '');
  return ['fine','light','regular','bold','extra','strong'].includes(stored) ? clampMixedComposerEquationStroke(stored) : '';
}

function getStoredComposerRenderProfileForKey(key=''){
  if(!cur || !key) return '';
  const stored=key==='q' ? cur.questionComposerRenderProfile : (key.startsWith('opt') ? cur.options?.[+key.slice(3)]?.composerRenderProfile : '');
  return ['hallmark','official'].includes(stored) ? clampMixedComposerRenderProfile(stored) : '';
}

function readMixedComposerRenderProfile(key=''){
  const dom=document.getElementById('mixedComposerRenderProfile');
  if(dom && dom.value) return clampMixedComposerRenderProfile(dom.value);
  const frameKey=key || activeComposerRenderKey;
  const stored=getStoredComposerRenderProfileForKey(frameKey);
  if(stored) return stored;
  if(frameKey && cur) return 'hallmark';
  try{ return clampMixedComposerRenderProfile(localStorage.getItem(MIXED_COMPOSER_RENDER_PROFILE_KEY)); }catch(_){ }
  return 'hallmark';
}

function readMixedComposerEquationStroke(key=''){
  const dom=document.getElementById('mixedComposerEquationStroke');
  if(dom && dom.value) return clampMixedComposerEquationStroke(dom.value);
  const frameKey=key || activeComposerRenderKey;
  const stored=getStoredComposerEquationStrokeForKey(frameKey);
  if(stored) return stored;
  if(frameKey && cur) return 'light';
  try{ return clampMixedComposerEquationStroke(localStorage.getItem(MIXED_COMPOSER_EQUATION_STROKE_KEY)); }catch(_){ }
  return 'light';
}

function getMixedComposerEquationStrokeOptionsHTML(selected){
  const current=clampMixedComposerEquationStroke(selected);
  const labels={fine:'Fine',light:'Light',regular:'Regular',bold:'Bold',extra:'Extra bold'};
  return ['fine','light','regular','bold','extra'].map(value=>'<option value="'+value+'"'+(value===current?' selected':'')+'>'+labels[value]+'</option>').join('');
}

function getMixedComposerRenderProfileOptionsHTML(selected){
  const current=clampMixedComposerRenderProfile(selected);
  const labels={hallmark:'Hallmark HD',official:'Official paper'};
  return ['hallmark','official'].map(value=>'<option value="'+value+'"'+(value===current?' selected':'')+'>'+labels[value]+'</option>').join('');
}

function applyMixedComposerEditorTypography(editor, key=''){
  if(!editor) return;
  const size=readMixedComposerTextSize(key);
  editor.style.fontSize=size+'px';
  editor.style.lineHeight=(Math.max(1.38, (size+8)/size)).toFixed(2);
  const profile=readMixedComposerRenderProfile(key);
  editor.style.fontFamily=profile==='official'
    ? "'Times New Roman','Cambria Math','STIX Two Math','STIXGeneral',serif"
    : "'Cambria Math','STIX Two Math','STIXGeneral','Times New Roman','Georgia','Noto Serif','Segoe UI Symbol',serif";
  editor.style.setProperty('--composer-structure-font-size', Math.max(14, Math.round(size*.9))+'px');
  editor.style.setProperty('--composer-structure-limit-size', Math.max(10, Math.round(size*.6))+'px');
  editor.dataset.equationStroke=readMixedComposerEquationStroke(key);
  editor.dataset.renderProfile=profile;
}

function updateMixedComposerTextSize(value, key=''){
  const size=clampMixedComposerTextSize(value);
  try{ localStorage.setItem(MIXED_COMPOSER_TEXT_SIZE_KEY, String(size)); }catch(_){ }
  const sel=document.getElementById('mixedComposerTextSize');
  if(sel) sel.value=String(size);
  applyMixedComposerEditorTypography(document.getElementById('mixedComposerEditor'), key || activeComposerKey || activeComposerRenderKey);
  return size;
}

function updateMixedComposerMathSize(value, key=''){
  const size=clampMixedComposerMathSize(value);
  try{ localStorage.setItem(MIXED_COMPOSER_MATH_SIZE_KEY, String(size)); }catch(_){ }
  const sel=document.getElementById('mixedComposerMathSize');
  if(sel) sel.value=String(size);
  return size;
}

function updateMixedComposerInnerMathScale(value, key=''){
  const scale=clampMixedComposerInnerMathScale(value);
  try{ localStorage.setItem(MIXED_COMPOSER_INNER_MATH_SCALE_KEY, String(scale)); }catch(_){ }
  const sel=document.getElementById('mixedComposerInnerMathScale');
  if(sel) sel.value=String(scale);
  return scale;
}

function updateMixedComposerEquationStroke(value, key=''){
  const stroke=clampMixedComposerEquationStroke(value);
  try{ localStorage.setItem(MIXED_COMPOSER_EQUATION_STROKE_KEY, stroke); }catch(_){ }
  const sel=document.getElementById('mixedComposerEquationStroke');
  if(sel) sel.value=stroke;
  const editor=document.getElementById('mixedComposerEditor');
  if(editor) editor.dataset.equationStroke=stroke;
  return stroke;
}

function updateMixedComposerRenderProfile(value, key=''){
  const profile=clampMixedComposerRenderProfile(value);
  try{ localStorage.setItem(MIXED_COMPOSER_RENDER_PROFILE_KEY, profile); }catch(_){ }
  const sel=document.getElementById('mixedComposerRenderProfile');
  if(sel) sel.value=profile;
  applyMixedComposerEditorTypography(document.getElementById('mixedComposerEditor'), key || activeComposerKey || activeComposerRenderKey);
  return profile;
}

function getComposerMatrixRowCount(latex=''){
  const source=String(latex||'');
  const match=source.match(/\\begin\{(?:b|p|v|V)?matrix\}([\s\S]*?)\\end\{(?:b|p|v|V)?matrix\}/);
  if(!match) return 0;
  return Math.max(1, Math.min(8, match[1].split(/\\\\/).length));
}

function getComposerLatexCommandCount(latex='', command='frac'){
  const re=new RegExp('\\\\(?:d|t)?'+command+'\\b','g');
  return (String(latex||'').match(re)||[]).length;
}

function getComposerLatexFractionDepth(latex=''){
  const source=String(latex||'');
  let maxDepth=0;
  let depth=0;
  for(let i=0;i<source.length;i++){
    if(source[i]==='\\' && /^(?:\\dfrac|\\tfrac|\\frac)\b/.test(source.slice(i))){
      depth++;
      maxDepth=Math.max(maxDepth, depth);
      continue;
    }
    if(source[i]==='}' && depth>0) depth--;
  }
  return maxDepth;
}

function getComposerLatexTallness(latex=''){
  const source=String(latex||'');
  const fracCount=getComposerLatexCommandCount(source,'frac');
  const fracDepth=getComposerLatexFractionDepth(source);
  const matrixRows=getComposerMatrixRowCount(source);
  const bigDelimiterCount=(source.match(/\\left|\\right|\\middle/g)||[]).length;
  const bigOpCount=(source.match(/\\(?:sum|prod|coprod|int|iint|iiint|oint|lim)\b/g)||[]).length;
  const integralCount=(source.match(/\\(?:int|iint|iiint|oint)\b/g)||[]).length;
  const rootCount=(source.match(/\\sqrt(?:\[[^\]]+\])?\s*\{/g)||[]).length;
  const accentCount=(source.match(/\\(?:bar|overline|hat|vec|dot|ddot|tilde|overrightarrow|overleftarrow)\s*\{/g)||[]).length;
  const scriptCount=(source.match(/[_^]\s*(?:\{|\\|[A-Za-z0-9+\-=()])/g)||[]).length;
  const bigOpScriptCount=(source.match(/\\(?:sum|prod|coprod|int|iint|iiint|oint|lim)\b(?:\s*[_^]\s*(?:\{|\\|[A-Za-z0-9+\-=()]))+/g)||[]).length;
  const complexScriptCount=(source.match(/[_^]\s*\{[^{}]*(?:\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|iint|iiint|oint|lim|left|right)|[{}])[\s\S]*?\}/g)||[]).length;
  return { fracCount, fracDepth, matrixRows, bigDelimiterCount, bigOpCount, integralCount, rootCount, accentCount, scriptCount, bigOpScriptCount, complexScriptCount };
}

function normalizeComposerLatexForSizing(latex=''){
  return String(latex||'')
    .replace(/\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)\b/g,'')
    .replace(/^\s*\{([\s\S]*)\}\s*$/,'$1')
    .trim();
}

function isSimpleComposerLatexAtomContent(value=''){
  const text=normalizeComposerLatexForSizing(value);
  if(!text || /\s/.test(text)) return false;
  if(/\\(?:frac|dfrac|tfrac|begin|left|right|sum|prod|coprod|int|iint|iiint|oint|lim)\b/.test(text)) return false;
  if(/^[A-Za-z0-9]$/.test(text)) return true;
  if(/^[A-Za-z0-9](?:_\{?[A-Za-z0-9+\-=()]+\}?|\^\{?[A-Za-z0-9+\-=()]+\}?){1,2}$/.test(text)) return true;
  if(/^\\(?:alpha|beta|gamma|delta|epsilon|varepsilon|theta|lambda|mu|pi|rho|sigma|phi|omega|Delta|Omega)\b/.test(text)) return true;
  return false;
}

function isComposerCompactInlineLatex(latex=''){
  const source=normalizeComposerLatexForSizing(latex);
  if(!source) return false;
  if(/^\\(?:bar|overline|hat|vec|dot|ddot|tilde|overrightarrow|overleftarrow)\s*\{[^{}\n]{1,18}\}$/.test(source)){
    const inner=source.replace(/^\\(?:bar|overline|hat|vec|dot|ddot|tilde|overrightarrow|overleftarrow)\s*\{|\}$/g,'');
    return isSimpleComposerLatexAtomContent(inner);
  }
  if(/^\\sqrt(?:\[[A-Za-z0-9]{1,3}\])?\s*\{[^{}\n\\]{1,12}\}$/.test(source)) return true;
  if(isSimpleComposerLatexAtomContent(source) && /[_^]/.test(source)) return true;
  return false;
}

function getComposerEquationVerticalPadding(key='', latex='', targetHeight=36){
  if(isComposerCompactInlineLatex(latex)) return Math.max(2, Math.round(targetHeight*.045));
  const tall=getComposerLatexTallness(latex);
  const complex=tall.fracDepth>0 || tall.fracCount>0 || tall.matrixRows>1 || tall.bigDelimiterCount>0 || tall.bigOpCount>0 || tall.rootCount>0 || tall.complexScriptCount>0 || tall.scriptCount>1 || tall.accentCount>0;
  if(!complex) return Math.max(2, Math.round(targetHeight*.05));
  let extra=0.10;
  if(tall.fracDepth>1 || tall.complexScriptCount>0) extra+=0.08;
  if(tall.bigOpScriptCount>0 || tall.rootCount>0) extra+=0.04;
  if(tall.matrixRows>1) extra+=0.04;
  return Math.max(7, Math.round(targetHeight*Math.min(.26, extra)));
}

function getComposerEquationTargetHeight(key='', latex=''){
  const mathSize=readMixedComposerMathSize(key || activeComposerRenderKey);
  if(isComposerCompactInlineLatex(latex)) return Math.max(18, Math.min(46, Math.round(mathSize*1.28)));
  const base=Math.max(20, Math.min(104, Math.round(mathSize*1.94)));
  const tall=getComposerLatexTallness(latex);
  const matrixRows=tall.matrixRows;
  if(matrixRows) return Math.min(340, Math.max(base, Math.round(base*(matrixRows*.94+.32))));
  let multiplier=1;
  if(tall.fracDepth>0) multiplier+=Math.min(1.12, tall.fracDepth*.38);
  if(tall.fracCount>1) multiplier+=Math.min(.42, (tall.fracCount-1)*.11);
  if(tall.rootCount>0) multiplier+=Math.min(.36, tall.rootCount*.14);
  if(tall.bigDelimiterCount>0) multiplier+=Math.min(.30, tall.bigDelimiterCount*.07);
  if(tall.bigOpCount>0) multiplier+=Math.min(.44, tall.bigOpCount*.16);
  if(tall.integralCount>0) multiplier+=Math.min(.34, tall.integralCount*.12);
  if(tall.bigOpScriptCount>0) multiplier+=Math.min(.36, tall.bigOpScriptCount*.18);
  if(tall.scriptCount>1) multiplier+=Math.min(.32, (tall.scriptCount-1)*.07);
  if(tall.complexScriptCount>0) multiplier+=Math.min(.54, tall.complexScriptCount*.28);
  if(tall.accentCount>0) multiplier+=Math.min(.16, tall.accentCount*.04);
  const minNested=tall.fracDepth>1 ? Math.round(mathSize*3.25) : base;
  const minComplex=(tall.fracCount || tall.rootCount || tall.bigOpCount || tall.bigDelimiterCount || tall.complexScriptCount)
    ? Math.round(mathSize*2.52)
    : base;
  const minScript=tall.scriptCount>1 ? Math.round(mathSize*2.18) : base;
  return Math.min(280, Math.max(base, minNested, minComplex, minScript, Math.round(base*multiplier)));
}

function prepareComposerEquationLatex(latex, key=''){
  let out=String(latex||'').trim();
  if(!out) return '';
  const innerScale=readMixedComposerInnerMathScale(key || activeComposerRenderKey);
  if(innerScale>=105) out=out.replace(/\\tfrac/g,'\\frac');
  if(innerScale>=115) out=out.replace(/\\frac/g,'\\dfrac');
  const compact=isComposerCompactInlineLatex(out);
  if(compact){
    out=out.replace(/^\\displaystyle\b\s*/,'').replace(/^\\textstyle\b\s*/,'');
    out='\\textstyle '+out;
  }else if(!/^\\displaystyle\b/.test(out)){
    out='\\displaystyle '+out;
  }
  return out;
}

function getComposerMainTextSize(style={}){
  const base=readMixedComposerTextSize(activeComposerRenderKey);
  const depth=Math.max(Number(style.supDepth)||0, Number(style.subDepth)||0);
  if(depth>0) return Math.max(8, Math.round(base * Math.pow(0.68, depth)));
  return base;
}
function getComposerMinorTextSize(){ return Math.max(10, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.56)); }
function getComposerLabelTextSize(){ return Math.max(12, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.72)); }
function getComposerSymbolTextSize(){ return Math.max(18, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*1.22)); }
function getComposerDerivativeTextSize(){ return Math.max(12, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.78)); }
function getComposerDerivativePowerTextSize(){ return Math.max(8, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.48)); }

function getComposerFont(style, size=18){
  const family=readMixedComposerRenderProfile(activeComposerRenderKey)==='official'
    ? "'Times New Roman','Cambria Math','STIX Two Math','STIXGeneral',serif"
    : "'Cambria Math','STIX Two Math','STIXGeneral','Times New Roman','Georgia','Noto Serif','Segoe UI Symbol',serif";
  return `${style?.italic?'italic ' : ''}${style?.bold?'700 ' : ''}${Math.max(8,size)}px ${family}`;
}


function strokeCanvasText(ctx, text, x, y, color='#000', width=0.18){
  if(readMixedComposerRenderProfile(activeComposerRenderKey)==='official') return;
  ctx.save();
  ctx.lineJoin='round';
  ctx.lineCap='round';
  ctx.strokeStyle=color;
  ctx.lineWidth=width;
  ctx.strokeText(text, x, y);
  ctx.restore();
}

function getComposerRenderScale(){
  return Math.max(EXPORT_IMAGE_SCALE * 2, 8);
}


function getDerivativeVisualParts(item){
  const partial=isPartialDerivativeStructureKind(item.kind);
  const second=isSecondDerivativeStructureKind(item.kind);
  const power=isPowerDerivativeKind(item.kind) ? (item.order || 'n') : (second ? '2' : '');
  const op=partial ? '∂' : 'd';
  return { op, power, variable:item.variable || 'x' };
}

function drawComposerBitmapText(ctx, text, x, baseline, font, fontSize, color='#000', maxWidth=0){
  const content=String(text||'');
  if(!content) return 0;
  ctx.save();
  ctx.font=font;
  const measured=Math.ceil(ctx.measureText(content).width);
  ctx.restore();
  if(typeof buildCanvasTextBitmap==='function'){
    const bitmap=buildCanvasTextBitmap(content, Math.max(maxWidth || (measured+8), 12), font, fontSize+4, color);
    if(bitmap){
      const dx=x-(bitmap.pad/bitmap.scale);
      const dy=(baseline-fontSize)-(bitmap.pad/bitmap.scale);
      const dw=bitmap.canvas.width/bitmap.scale;
      const dh=bitmap.canvas.height/bitmap.scale;
      ctx.drawImage(bitmap.canvas, dx, dy, dw, dh);
      return measured;
    }
  }
  strokeCanvasText(ctx, content, x, baseline, color, 0.12);
  ctx.fillText(content, x, baseline);
  return measured;
}

function measureDerivativeTerm(ctx, op, power='', variable=''){
  ctx.font=getComposerFont({},getComposerDerivativeTextSize());
  const baseText=op + (variable || '');
  const baseW=ctx.measureText(baseText).width;
  let powerW=0;
  if(power){
    ctx.font=getComposerFont({},getComposerDerivativePowerTextSize());
    powerW=ctx.measureText(power).width;
  }
  return Math.ceil(baseW + powerW + (power ? 1 : 0));
}

function drawDerivativeTerm(ctx, x, baseline, op, power='', variable='', style={}){
  const baseFont=getComposerFont(style,getComposerDerivativeTextSize());
  ctx.font=baseFont;
  const baseText=op + (variable || '');
  const baseW=drawComposerBitmapText(ctx, baseText, x, baseline, baseFont, 14, '#000');
  if(power){
    const powerFont=getComposerFont(style,getComposerDerivativePowerTextSize());
    const powerX=x+baseW+1;
    const powerY=baseline-8;
    drawComposerBitmapText(ctx, power, powerX, powerY, powerFont, 8, '#000');
  }
}

function measureComposerStructure(ctx, seg){
  ctx.font=getComposerFont(seg.style,getComposerMinorTextSize());
  const lowerW=Math.ceil(ctx.measureText(seg.lower || '').width);
  const upperW=Math.ceil(ctx.measureText(seg.upper || '').width);
  const toW=Math.ceil(ctx.measureText(seg.toValue || '').width);
  ctx.font=getComposerFont(seg.style,getComposerMainTextSize(seg.style));
  const exprW=Math.ceil(ctx.measureText(seg.expr || '').width);
  const differentialText=isIntegralStructureKind(seg.kind) ? getIntegralDifferentialText(seg.kind, seg.variable, false) : '';
  const varW=Math.ceil(ctx.measureText(differentialText || seg.variable || '').width);
  if(seg.kind==='vector'){
    return { width:Math.max(24, exprW + 8), height:28 };
  }
  if(isLargeBracketStructureKind(seg.kind)){
    const mainSize=getComposerMainTextSize(seg.style);
    const exprText=String(seg.expr || '');
    ctx.font=getComposerFont(seg.style, mainSize);
    const textW=Math.ceil(ctx.measureText(exprText || ' ').width);
    const textH=Math.max(24, Math.round(mainSize*1.35));
    ctx.font=getComposerFont(seg.style, Math.round(mainSize*2.05));
    const leftW=Math.ceil(ctx.measureText(seg.bracketLeft || '(').width);
    const rightW=Math.ceil(ctx.measureText(seg.bracketRight || ')').width);
    return { width:Math.max(46, leftW + textW + rightW + 12), height:Math.max(42, textH + 10) };
  }
  if(isRootStructureKind(seg.kind)){
    ctx.font=getComposerFont(seg.style, Math.round(getComposerMainTextSize(seg.style)*1.9));
    const rootW=Math.ceil(ctx.measureText('√').width);
    ctx.font=getComposerFont(seg.style,getComposerMinorTextSize());
    const idxW=seg.rootIndex ? Math.ceil(ctx.measureText(seg.rootIndex).width) : 0;
    return { width:Math.max(46, rootW + idxW + exprW + 14), height:42 };
  }
  if(isDerivativeStructureKind(seg.kind)){
    const parts=getDerivativeVisualParts(seg);
    const fracTopW=measureDerivativeTerm(ctx, parts.op, parts.power, '');
    const fracBottomW=measureDerivativeTerm(ctx, parts.op, parts.power, parts.variable);
    return { width:Math.max(46, Math.max(fracTopW, fracBottomW) + exprW + 15), height:38 };
  }
  if(seg.kind==='limitPlain'){
    ctx.font=getComposerFont({...seg.style, bold:true},getComposerLabelTextSize());
    const limW=Math.ceil(ctx.measureText('lim').width);
    return { width:Math.max(34, limW + exprW + 8), height:28 };
  }
  if(seg.kind==='limit'){
    const width=Math.max(36, 25 + Math.max(18, varW + toW + 9) + exprW + 7);
    return { width, height:34 };
  }
  const integralLike=isIntegralStructureKind(seg.kind);
  if(seg.kind==='summationPlain'){
    ctx.font=getComposerFont(seg.style,getComposerSymbolTextSize());
    const sumW=Math.ceil(ctx.measureText('∑').width);
    return { width:Math.max(34, sumW + exprW + 8), height:30 };
  }
  if(hasPerIntegralLimits(seg.kind)){
    const order=getIntegralOrderForKind(seg.kind);
    let symbolsW=0;
    for(let i=1;i<=order;i++){
      const includeLimits=!(seg.kind==='doubleIntegralFirstLimits' && i>1);
      ctx.font=getComposerFont(seg.style,10);
      const lw=includeLimits ? Math.ceil(ctx.measureText(seg[`lower${i}`] || 'a').width) : 0;
      const uw=includeLimits ? Math.ceil(ctx.measureText(seg[`upper${i}`] || 'b').width) : 0;
      ctx.font=getComposerFont(seg.style,getComposerSymbolTextSize());
      const sw=Math.ceil(ctx.measureText('∫').width);
      symbolsW+=Math.max(18, sw, lw, uw) + 1;
    }
    return { width:Math.max(48, symbolsW + exprW + 10 + varW + 8), height:58 };
  }
  const symbolText=integralLike ? getIntegralSymbolForKind(seg.kind) : '∑';
  ctx.font=getComposerFont(seg.style, integralLike ? 23 : 23);
  const symbolBaseW=Math.ceil(ctx.measureText(symbolText).width);
  const symbolW=hasIntegralLimits(seg.kind) || seg.kind==='summation'
    ? Math.max(21, symbolBaseW, lowerW, upperW)
    : Math.max(18, symbolBaseW);
  const tailW=integralLike ? 9 + varW : 0;
  const height=(hasIntegralLimits(seg.kind) || seg.kind==='summation') ? 58 : 30;
  return { width:Math.max(34, symbolW + exprW + tailW + 7), height };
}

function drawComposerStructure(ctx, item, x, y, rowHeight){
  const cy=y + Math.round((rowHeight-item.height)/2);
  ctx.fillStyle='#000';
  ctx.textBaseline='alphabetic';
  ctx.font=getComposerFont(item.style,getComposerMinorTextSize());
  if(item.kind==='vector'){
    ctx.font=getComposerFont(item.style,getComposerMainTextSize(item.style));
    const text=item.expr||'A';
    const textW=ctx.measureText(text).width;
    const baseY=cy+22;
    drawComposerBitmapText(ctx, text, x+3, baseY, getComposerFont(item.style,getComposerMainTextSize(item.style)), 17, '#000');
    const arrowY=cy+5;
    ctx.beginPath();
    ctx.moveTo(x+3, arrowY);
    ctx.lineTo(x+Math.max(14, textW+3), arrowY);
    ctx.lineTo(x+Math.max(14, textW+3)-4, arrowY-3);
    ctx.moveTo(x+Math.max(14, textW+3), arrowY);
    ctx.lineTo(x+Math.max(14, textW+3)-4, arrowY+3);
    ctx.strokeStyle='#000';
    ctx.lineWidth=1.2;
    ctx.stroke();
    return;
  }
  if(isLargeBracketStructureKind(item.kind)){
    const mainSize=getComposerMainTextSize(item.style);
    const expr=String(item.expr || '');
    const textFont=getComposerFont(item.style, mainSize);
    ctx.font=textFont;
    const exprW=ctx.measureText(expr || ' ').width;
    const bracketSize=Math.round(mainSize*2.05);
    const [left,right]=[item.bracketLeft||'(', item.bracketRight||')'];
    const bracketFont=getComposerFont(item.style, bracketSize);
    ctx.font=bracketFont;
    const leftW=ctx.measureText(left).width;
    const baseY=cy + Math.round((item.height + bracketSize*0.72)/2);
    const textBaseY=cy + Math.round((item.height + mainSize*0.72)/2);
    drawComposerBitmapText(ctx, left, x+1, baseY, bracketFont, bracketSize, '#000');
    if(expr) drawComposerBitmapText(ctx, expr, x+leftW+5, textBaseY, textFont, mainSize, '#000');
    drawComposerBitmapText(ctx, right, x+leftW+exprW+8, baseY, bracketFont, bracketSize, '#000');
    return;
  }
  if(isRootStructureKind(item.kind)){
    const mainSize=getComposerMainTextSize(item.style);
    const rootSize=Math.round(mainSize*1.9);
    const expr=item.expr||'x';
    const rootFont=getComposerFont(item.style, rootSize);
    const exprFont=getComposerFont(item.style, mainSize);
    const idxFont=getComposerFont(item.style,getComposerMinorTextSize());
    ctx.font=idxFont;
    const idx=item.rootIndex||'';
    const idxW=idx ? ctx.measureText(idx).width : 0;
    ctx.font=rootFont;
    const rootW=ctx.measureText('√').width;
    const rootX=x+Math.max(0, idxW-2);
    if(idx){
      drawComposerBitmapText(ctx, idx, x, cy+12, idxFont, getComposerMinorTextSize(), '#000');
    }
    drawComposerBitmapText(ctx, '√', rootX, cy+31, rootFont, rootSize, '#000');
    const exprX=rootX+rootW-2;
    ctx.font=exprFont;
    const exprW=ctx.measureText(expr).width;
    ctx.beginPath();
    ctx.moveTo(exprX+1, cy+8);
    ctx.lineTo(exprX+exprW+5, cy+8);
    ctx.strokeStyle='#000';
    ctx.lineWidth=1.4;
    ctx.stroke();
    drawComposerBitmapText(ctx, expr, exprX+3, cy+30, exprFont, mainSize, '#000');
    return;
  }
  if(isDerivativeStructureKind(item.kind)){
    const parts=getDerivativeVisualParts(item);
    const topW=measureDerivativeTerm(ctx, parts.op, parts.power, '');
    const bottomW=measureDerivativeTerm(ctx, parts.op, parts.power, parts.variable);
    const fracW=Math.max(topW,bottomW)+8;
    const fx=x+1;
    const cy2=cy+4;
    drawDerivativeTerm(ctx, fx+(fracW-topW)/2, cy2+11, parts.op, parts.power, '', item.style);
    ctx.beginPath();
    ctx.moveTo(fx+1, cy2+16);
    ctx.lineTo(fx+fracW-1, cy2+16);
    ctx.strokeStyle='#000';
    ctx.lineWidth=1.2;
    ctx.stroke();
    drawDerivativeTerm(ctx, fx+(fracW-bottomW)/2, cy2+31, parts.op, parts.power, parts.variable, item.style);
    ctx.font=getComposerFont(item.style,getComposerMainTextSize(item.style));
    drawComposerBitmapText(ctx, item.expr||'f(x)', fx+fracW+3, cy2+22, getComposerFont(item.style,getComposerMainTextSize(item.style)), 17, '#000');
    return;
  }
  if(item.kind==='limitPlain'){
    ctx.font=getComposerFont({...item.style, bold:true},getComposerLabelTextSize());
    drawComposerBitmapText(ctx, 'lim', x, cy+20, getComposerFont({...item.style, bold:true},getComposerLabelTextSize()), 13, '#000');
    const limW=ctx.measureText('lim').width;
    ctx.font=getComposerFont(item.style,getComposerMainTextSize(item.style));
    drawComposerBitmapText(ctx, item.expr||'f(x)', x+limW+3, cy+22, getComposerFont(item.style,getComposerMainTextSize(item.style)), 17, '#000');
    return;
  }
  if(item.kind==='limit'){
    ctx.font=getComposerFont({...item.style, bold:true},getComposerLabelTextSize());
    drawComposerBitmapText(ctx, 'lim', x, cy+17, getComposerFont({...item.style, bold:true},getComposerLabelTextSize()), 13, '#000');
    ctx.font=getComposerFont(item.style,getComposerMinorTextSize());
    const approach=`${item.variable||'x'}→${item.toValue||'0'}`;
    drawComposerBitmapText(ctx, approach, x+2, cy+31, getComposerFont(item.style,getComposerMinorTextSize()), 10, '#000');
    ctx.font=getComposerFont(item.style,getComposerMainTextSize(item.style));
    drawComposerBitmapText(ctx, item.expr||'f(x)', x+29, cy+22, getComposerFont(item.style,getComposerMainTextSize(item.style)), 17, '#000');
    return;
  }
  const integralLike=isIntegralStructureKind(item.kind);
  if(item.kind==='summationPlain'){
    ctx.font=getComposerFont(item.style,getComposerSymbolTextSize());
    const symbol='∑';
    const symbolW=ctx.measureText(symbol).width;
    drawComposerBitmapText(ctx, symbol, x+2, cy+25, getComposerFont(item.style,getComposerSymbolTextSize()), 23, '#000');
    ctx.font=getComposerFont(item.style,getComposerMainTextSize(item.style));
    drawComposerBitmapText(ctx, item.expr||'a_i', x+symbolW+3, cy+22, getComposerFont(item.style,getComposerMainTextSize(item.style)), 17, '#000');
    return;
  }
  if(hasPerIntegralLimits(item.kind)){
    const order=getIntegralOrderForKind(item.kind);
    let cursor=x+2;
    const cy2=cy;
    for(let i=1;i<=order;i++){
      const includeLimits=!(item.kind==='doubleIntegralFirstLimits' && i>1);
      const upperText=item[`upper${i}`] || (i===1?'b':i===2?'d':'f');
      const lowerText=item[`lower${i}`] || (i===1?'a':i===2?'c':'e');
      ctx.font=getComposerFont(item.style,getComposerMinorTextSize());
      const upperW=includeLimits ? ctx.measureText(upperText).width : 0;
      const lowerW=includeLimits ? ctx.measureText(lowerText).width : 0;
      ctx.font=getComposerFont(item.style,getComposerSymbolTextSize());
      const symbolWRaw=ctx.measureText('∫').width;
      const symbolW=Math.max(18, symbolWRaw, upperW, lowerW);
      if(includeLimits){
        ctx.font=getComposerFont(item.style,getComposerMinorTextSize());
        drawComposerBitmapText(ctx, upperText, cursor + (symbolW-upperW)/2, cy2+8, getComposerFont(item.style,getComposerMinorTextSize()), 10, '#000');
      }
      ctx.font=getComposerFont(item.style,getComposerSymbolTextSize());
      drawComposerBitmapText(ctx, '∫', cursor + (symbolW-symbolWRaw)/2, cy2+34, getComposerFont(item.style,getComposerSymbolTextSize()), 23, '#000');
      if(includeLimits){
        ctx.font=getComposerFont(item.style,getComposerMinorTextSize());
        drawComposerBitmapText(ctx, lowerText, cursor + (symbolW-lowerW)/2, cy2+44, getComposerFont(item.style,getComposerMinorTextSize()), 10, '#000');
      }
      cursor+=symbolW+1;
    }
    ctx.font=getComposerFont(item.style,getComposerMainTextSize(item.style));
    const exprY=cy2+30;
    drawComposerBitmapText(ctx, item.expr||'f(x)', cursor+1, exprY, getComposerFont(item.style,getComposerMainTextSize(item.style)), 17, '#000');
    const exprW=ctx.measureText(item.expr||'f(x)').width;
    const differentialText=getIntegralDifferentialText(item.kind, item.variable, false);
    drawComposerBitmapText(ctx, differentialText, cursor+exprW+4, exprY, getComposerFont(item.style,getComposerMainTextSize(item.style)), 17, '#000');
    return;
  }
  const symbol=item.kind==='summation' ? '∑' : getIntegralSymbolForKind(item.kind);
  const symbolX=x+2;
  ctx.font=getComposerFont(item.style,getComposerMinorTextSize());
  const upperText=item.upper || (item.kind==='summation' ? 'n' : 'b');
  const lowerText=item.lower || (item.kind==='summation' ? 'i=1' : 'a');
  const upperW=ctx.measureText(upperText).width;
  const lowerW=ctx.measureText(lowerText).width;
  const showLimits=item.kind==='summation' || hasIntegralLimits(item.kind);
  ctx.font=getComposerFont(item.style,getComposerSymbolTextSize());
  const symbolBaseW=ctx.measureText(symbol).width;
  const symbolW=showLimits ? Math.max(21, upperW, lowerW, symbolBaseW) : Math.max(18, symbolBaseW);
  if(showLimits){
    ctx.font=getComposerFont(item.style,getComposerMinorTextSize());
    drawComposerBitmapText(ctx, upperText, symbolX + (symbolW-upperW)/2, cy+8, getComposerFont(item.style,getComposerMinorTextSize()), 10, '#000');
  }
  ctx.font=getComposerFont(item.style,getComposerSymbolTextSize());
  const symbolY=showLimits ? cy+34 : cy+24;
  drawComposerBitmapText(ctx, symbol, symbolX + (symbolW-symbolBaseW)/2, symbolY, getComposerFont(item.style,getComposerSymbolTextSize()), 23, '#000');
  if(showLimits){
    ctx.font=getComposerFont(item.style,getComposerMinorTextSize());
    drawComposerBitmapText(ctx, lowerText, symbolX + (symbolW-lowerW)/2, cy+44, getComposerFont(item.style,getComposerMinorTextSize()), 10, '#000');
  }
  ctx.font=getComposerFont(item.style,getComposerMainTextSize(item.style));
  const exprX=symbolX+symbolW+2;
  const exprY=showLimits ? cy+30 : cy+22;
  drawComposerBitmapText(ctx, item.expr||'f(x)', exprX, exprY, getComposerFont(item.style,getComposerMainTextSize(item.style)), 17, '#000');
  if(integralLike){
    const exprW=ctx.measureText(item.expr||'f(x)').width;
    const differentialText=getIntegralDifferentialText(item.kind, item.variable, false);
    drawComposerBitmapText(ctx, differentialText, exprX+exprW+4, exprY, getComposerFont(item.style,getComposerMainTextSize(item.style)), 17, '#000');
  }
}

function getComposerItemBaseline(item){
  const type=item?.type || 'text';
  const height=Math.max(1, item?.height || 30);
  if(type==='text'){
    const supDepth=Number(item?.style?.supDepth)||0;
    const subDepth=Number(item?.style?.subDepth)||0;
    if(supDepth>0) return Math.max(7, 15-(supDepth-1)*4);
    if(subDepth>0) return Math.min(29, 23+(subDepth-1)*3);
    return 21;
  }
  // Free brackets are visual wrappers, not equation boxes. They should not pull
  // the whole row baseline downward; the content between them keeps normal flow.
  if(type==='bracketDraw') return 21;
  if(type==='frac'){
    const variant=item.variant || 'stacked';
    if(variant==='slash' || variant==='linear') return 16;
    if(variant==='small') return 17;
    return 21;
  }
  if(type==='structure'){
    if(isLargeBracketStructureKind(item.kind)) return 29;
    if(isRootStructureKind(item.kind)) return 29;
    if(isDerivativeStructureKind(item.kind)) return 22;
    if(item.kind==='vector') return 20;
    if(item.kind==='limit') return 20;
    if(item.kind==='limitPlain' || item.kind==='summationPlain') return 21;
    if(hasIntegralLimits(item.kind) || hasPerIntegralLimits(item.kind) || item.kind==='summation') return 31;
    return 21;
  }
  if(type==='eq' || type==='img') return Math.min(height-3, Math.max(18, Math.round(height * 0.7)));
  return Math.min(height-3, 21);
}

function getComposerStructureFallbackText(seg){
  const kind=String(seg?.kind || '');
  const expr=String(seg?.expr || 'f(x)').trim() || 'f(x)';
  if(isDerivativeStructureKind(kind)){
    const partial=isPartialDerivativeStructureKind(kind);
    const op=partial ? '∂' : 'd';
    const variable=String(seg.variable || 'x').trim() || 'x';
    const power=isPowerDerivativeKind(kind) ? String(seg.order || 'n').trim() : (isSecondDerivativeStructureKind(kind) ? '2' : '');
    return `${op}${power ? '^'+power : ''}${expr}/${op}${variable}${power ? '^'+power : ''}`;
  }
  if(isIntegralStructureKind(kind)){
    const symbol=getIntegralSymbolForKind(kind);
    const vars=getIntegralDifferentialText(kind, seg.variable || 'x', false);
    if(hasPerIntegralLimits(kind)){
      const order=getIntegralOrderForKind(kind);
      const pieces=[];
      for(let i=1;i<=order;i++){
        if(kind==='doubleIntegralFirstLimits' && i>1) pieces.push('∫');
        else pieces.push(`∫(${seg[`lower${i}`] || 'a'} to ${seg[`upper${i}`] || 'b'})`);
      }
      return `${pieces.join(' ')} ${expr} ${vars}`;
    }
    if(hasIntegralLimits(kind)) return `${symbol}(${seg.lower || 'a'} to ${seg.upper || 'b'}) ${expr} ${vars}`;
    return `${symbol} ${expr} ${vars}`;
  }
  return String(seg?.text || expr || '').trim();
}

function finalizeComposerRow(items){
  if(!items.length) return { items, height:30, baseline:21 };
  items.forEach(item=>{
    item.baseline=getComposerItemBaseline(item);
  });
  const baseline=Math.max(21, ...items.map(item=>item.baseline || 21));
  const descent=Math.max(9, ...items.map(item=>Math.max(0, (item.height || 30) - (item.baseline || 21))));
  return { items, height:baseline + descent, baseline };
}

function getMixedComposerRenderScale(){
  if(readMixedComposerRenderProfile(activeComposerRenderKey)==='official') return Math.max(6, getComposerRenderScale());
  return Math.max(12, getComposerRenderScale()+4);
}

function getComposerRowSurfacePad(key){
  return key==='q' ? 11 : 9;
}

function getComposerRowWidth(row){
  if(!row || !row.items || !row.items.length) return 0;
  return row.items.reduce((m,item)=>Math.max(m, (item.x||0) + (item.width||0)), 0);
}

function drawComposerRowItems(ctx, row, originX, baseline){
  row.items.forEach(item=>{
    if(item.type==='eq'){
      ctx.drawImage(item.img, originX+item.x, baseline - item.baseline, item.width, item.height);
      return;
    }
    if(item.type==='img'){
      ctx.drawImage(item.img, originX+item.x, baseline - item.baseline, item.width, item.height);
      return;
    }
    if(item.type==='frac'){
      const fx=originX+item.x;
      const cy=baseline - item.baseline;
      ctx.fillStyle='#000';
      ctx.textBaseline='alphabetic';
      const variant=item.variant||'stacked';
      const fracSize=variant==='small'?Math.max(10, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.58)):Math.max(12, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.68));
      ctx.font=getComposerFont(item.style,fracSize);
      const numW=ctx.measureText(item.num).width;
      const denW=ctx.measureText(item.den).width;
      if(variant==='slash' || variant==='linear'){
        strokeCanvasText(ctx, item.num, fx, cy+16, '#000', 0.35);
        ctx.fillText(item.num, fx, cy+16);
        const slashX=fx+numW+4;
        strokeCanvasText(ctx, '/', slashX, cy+16, '#000', 0.35);
        ctx.fillText('/', slashX, cy+16);
        strokeCanvasText(ctx, item.den, slashX+8, cy+16, '#000', 0.35);
        ctx.fillText(item.den, slashX+8, cy+16);
      } else {
        const numX=fx + (item.width-numW)/2;
        strokeCanvasText(ctx, item.num, numX, cy+11, '#000', 0.35);
        ctx.fillText(item.num, numX, cy+11);
        ctx.beginPath();
        ctx.moveTo(fx+2, cy+15);
        ctx.lineTo(fx+item.width-2, cy+15);
        ctx.strokeStyle='#000';
        ctx.lineWidth=variant==='small'?1.15:1.5;
        ctx.stroke();
        const denX=fx + (item.width-denW)/2;
        const denY=cy+(variant==='small'?24:29);
        strokeCanvasText(ctx, item.den, denX, denY, '#000', 0.35);
        ctx.fillText(item.den, denX, denY);
      }
      return;
    }
    if(item.type==='structure'){
      drawComposerStructure(ctx, item, originX+item.x, baseline - item.baseline, item.height);
      return;
    }
    if(item.type==='bracketDraw'){
      const style=item.style||{};
      const fontSize=Math.max(34, Math.round(getComposerMainTextSize(style)*2.05));
      const font=getComposerFont(style,fontSize);
      ctx.font=font;
      ctx.fillStyle='#000';
      ctx.textBaseline='alphabetic';
      const yOffset=Math.round(fontSize*0.27);
      drawComposerBitmapText(ctx, item.text, originX+item.x, baseline+yOffset, font, fontSize, '#000');
      return;
    }
    const style=item.style||{};
    const fontSize=getComposerMainTextSize(style);
    const font=getComposerFont(style,fontSize);
    ctx.font=font;
    ctx.fillStyle='#000';
    ctx.textBaseline='alphabetic';
    const supDepth=Number(style.supDepth)||0;
    const subDepth=Number(style.subDepth)||0;
    const yShift=supDepth>0 ? -(7+(supDepth-1)*5) : (subDepth>0 ? 5+(subDepth-1)*4 : 0);
    const textX=originX+item.x;
    const textY=baseline+yShift-fontSize;
    if(typeof buildCanvasTextBitmap==='function' && item.text && !/^[\s]+$/.test(item.text)){
      const bitmap=buildCanvasTextBitmap(item.text, Math.max(item.width+6, 12), font, fontSize+4, '#000');
      if(bitmap){
        const dx=textX-(bitmap.pad/bitmap.scale);
        const dy=textY-(bitmap.pad/bitmap.scale);
        const dw=bitmap.canvas.width/bitmap.scale;
        const dh=bitmap.canvas.height/bitmap.scale;
        ctx.drawImage(bitmap.canvas, dx, dy, dw, dh);
      } else {
        strokeCanvasText(ctx, item.text, textX, baseline+yShift, '#000', style.bold?0.32:0.12);
        ctx.fillText(item.text, textX, baseline+yShift);
      }
    } else {
      strokeCanvasText(ctx, item.text, textX, baseline+yShift, '#000', style.bold?0.32:0.12);
      ctx.fillText(item.text, textX, baseline+yShift);
    }
    if(style.underline && item.text.trim()){
      ctx.strokeStyle='#000';
      ctx.lineWidth=1.2;
      const uy=baseline+yShift+2;
      ctx.beginPath();
      ctx.moveTo(textX, uy);
      ctx.lineTo(textX+item.width, uy);
      ctx.stroke();
    }
  });
}

function hardenComposerRowSurface(surface){
  try{
    const ctx=surface.getContext('2d');
    const img=ctx.getImageData(0,0,surface.width,surface.height);
    const d=img.data;
    for(let i=0;i<d.length;i+=4){
      const a=d[i+3];
      if(a<8) continue;
      const lum=(d[i]*0.299)+(d[i+1]*0.587)+(d[i+2]*0.114);
      if(lum>248){ d[i]=255; d[i+1]=255; d[i+2]=255; continue; }
      if(lum>226){ d[i]=248; d[i+1]=248; d[i+2]=248; continue; }
      if(lum>170){ d[i]=12; d[i+1]=12; d[i+2]=12; continue; }
      if(lum>112){ d[i]=2; d[i+1]=2; d[i+2]=2; continue; }
      d[i]=0; d[i+1]=0; d[i+2]=0;
    }
    ctx.putImageData(img,0,0);
  }catch(_){ }
  return surface;
}

function clearComposerRowPadding(surface, pad){
  try{
    const ctx=surface.getContext('2d');
    const w=surface.width;
    const h=surface.height;
    const scale=Math.max(1, getMixedComposerRenderScale());
    const p=Math.max(1, Math.round(pad*scale));
    const img=ctx.getImageData(0,0,w,h);
    const d=img.data;
    for(let y=0;y<h;y++){
      const edgeY=y<p || y>=h-p;
      for(let x=0;x<w;x++){
        if(!edgeY && x>=p && x<w-p) continue;
        const i=(y*w+x)*4;
        if(d[i+3]>0 && d[i]>246 && d[i+1]>246 && d[i+2]>246){
          d[i+3]=0;
        }
      }
    }
    ctx.putImageData(img,0,0);
  }catch(_){ }
  return surface;
}

function renderComposerRowSurface(row, key){
  const scale=getMixedComposerRenderScale();
  const rowPad=getComposerRowSurfacePad(key);
  const width=Math.max(1, Math.ceil(getComposerRowWidth(row) + rowPad*2));
  const height=Math.max(1, Math.ceil(row.height + rowPad*2));
  const surface=document.createElement('canvas');
  surface.width=Math.max(1, Math.round(width*scale));
  surface.height=Math.max(1, Math.round(height*scale));
  surface.style.width=width+'px';
  surface.style.height=height+'px';
  const sctx=surface.getContext('2d');
  sctx.scale(scale, scale);
  sctx.imageSmoothingEnabled=true;
  sctx.imageSmoothingQuality='high';
  sctx.fillStyle='#fff';
  sctx.fillRect(0,0,width,height);
  sctx.lineJoin='round';
  sctx.lineCap='round';
  drawComposerRowItems(sctx, row, rowPad, rowPad + row.baseline);
  // Keep the clean high-resolution anti-aliased row. Pixel thresholding here
  // creates jagged edges and compounds when the surface is downscaled.
  clearComposerRowPadding(surface, rowPad);
  return { canvas:surface, width, height, pad:rowPad };
}

function getComposerEquationInkProfile(level){
  const ink=clampMixedComposerEquationStroke(level);
  if(ink==='regular') return { radius:1, strength:.30 };
  if(ink==='bold') return { radius:1, strength:.62 };
  if(ink==='extra') return { radius:2, strength:.72 };
  return { radius:0, strength:0 };
}

function applyEquationInkToAssetCanvas(canvas, level='light', renderProfile='hallmark'){
  try{
    const profile=getComposerEquationInkProfile(level);
    if(!profile.radius || !profile.strength) return canvas;
    const ctx=canvas.getContext('2d');
    const img=ctx.getImageData(0,0,canvas.width,canvas.height);
    const d=img.data;
    const source=new Uint8ClampedArray(d);
    const width=canvas.width;
    const height=canvas.height;
    const profileFactor=clampMixedComposerRenderProfile(renderProfile)==='official' ? .78 : 1;
    const strength=profile.strength*profileFactor;
    // Expand only the anti-aliased equation ink. Unlike the previous threshold
    // pass, this preserves every original edge shade and never touches prose.
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const index=(y*width+x)*4;
        if(source[index+3]<8) continue;
        const lum=(source[index]*.299)+(source[index+1]*.587)+(source[index+2]*.114);
        const darkness=255-lum;
        if(darkness<18) continue;
        for(let dy=-profile.radius;dy<=profile.radius;dy++){
          for(let dx=-profile.radius;dx<=profile.radius;dx++){
            if(dx===0 && dy===0) continue;
            const distance=Math.sqrt(dx*dx+dy*dy);
            if(distance>profile.radius+.01) continue;
            const nx=x+dx, ny=y+dy;
            if(nx<0 || ny<0 || nx>=width || ny>=height) continue;
            const neighbor=(ny*width+nx)*4;
            const falloff=profile.radius===1 ? 1 : Math.max(.42,1-(distance-1)*.42);
            const spreadDarkness=darkness*strength*falloff;
            const currentLum=(d[neighbor]*.299)+(d[neighbor+1]*.587)+(d[neighbor+2]*.114);
            if(255-currentLum>=spreadDarkness) continue;
            const value=Math.max(0,Math.min(255,Math.round(255-spreadDarkness)));
            d[neighbor]=Math.min(d[neighbor],value);
            d[neighbor+1]=Math.min(d[neighbor+1],value);
            d[neighbor+2]=Math.min(d[neighbor+2],value);
            d[neighbor+3]=Math.max(d[neighbor+3],source[index+3]);
          }
        }
      }
    }
    ctx.putImageData(img,0,0);
  }catch(_){ }
  return canvas;
}

function trimEquationAssetHorizontalPadding(canvas, padding=4){
  try{
    const ctx=canvas?.getContext?.('2d');
    if(!ctx || !canvas.width || !canvas.height) return canvas;
    const image=ctx.getImageData(0,0,canvas.width,canvas.height);
    const data=image.data;
    let minX=canvas.width, maxX=-1;
    for(let y=0;y<canvas.height;y++){
      for(let x=0;x<canvas.width;x++){
        const index=(y*canvas.width+x)*4;
        const lum=(data[index]*0.299)+(data[index+1]*0.587)+(data[index+2]*0.114);
        if(data[index+3]>8 && lum<246){
          minX=Math.min(minX,x);
          maxX=Math.max(maxX,x);
        }
      }
    }
    if(maxX<minX) return canvas;
    const left=Math.max(0,minX-padding);
    const right=Math.min(canvas.width-1,maxX+padding);
    const width=Math.max(1,right-left+1);
    if(width>=canvas.width-2) return canvas;
    const cropped=document.createElement('canvas');
    cropped.width=width;
    cropped.height=canvas.height;
    const cctx=cropped.getContext('2d');
    cctx.fillStyle='#fff';
    cctx.fillRect(0,0,cropped.width,cropped.height);
    cctx.drawImage(canvas,left,0,width,canvas.height,0,0,width,canvas.height);
    return cropped;
  }catch(_){
    return canvas;
  }
}

async function renderMixedComposerCanvas(root, key){
  const prevComposerRenderKey=activeComposerRenderKey;
  activeComposerRenderKey=key||'';
  try{
  const cv=document.getElementById(key+'Canvas');
  const maxWidth=Math.max(220, (cv?.width||760)-32);
  const lines=extractMixedComposerLines(root);
  const measureCanvas=document.createElement('canvas');
  const mctx=measureCanvas.getContext('2d');
  const eqCache={};
  const imgCache={};
  async function getEqAsset(latex){
    const preparedLatex=prepareComposerEquationLatex(latex, activeComposerRenderKey);
    const equationInk=readMixedComposerEquationStroke(activeComposerRenderKey);
    const renderProfile=readMixedComposerRenderProfile(activeComposerRenderKey);
    const cacheKey=preparedLatex+'|'+readMixedComposerMathSize(activeComposerRenderKey)+'|'+readMixedComposerInnerMathScale(activeComposerRenderKey)+'|'+equationInk+'|'+renderProfile;
    if(eqCache[cacheKey]) return eqCache[cacheKey];
    let dataUrl='';
    try{
      dataUrl=await renderTexToDataUrl(preparedLatex);
    }catch(err){
      console.warn('Composer equation render fallback:', preparedLatex, err);
      return null;
    }
    const rawImg=await loadImg(dataUrl);
    const naturalW=rawImg.naturalWidth||rawImg.width||120;
    const naturalH=rawImg.naturalHeight||rawImg.height||36;
    const targetH=getComposerEquationTargetHeight(activeComposerRenderKey, preparedLatex);
    const verticalPad=getComposerEquationVerticalPadding(activeComposerRenderKey, preparedLatex, targetH);
    const scale=targetH/Math.max(1,naturalH);
    let assetW=Math.max(16, Math.round(naturalW*scale));
    const mathH=Math.max(18, Math.round(naturalH*scale));
    const assetH=mathH + verticalPad*2;
    let eqCanvas=document.createElement('canvas');
    eqCanvas.width=Math.max(1, assetW*2);
    eqCanvas.height=Math.max(1, assetH*2);
    const eqCtx=eqCanvas.getContext('2d');
    eqCtx.imageSmoothingEnabled=true;
    eqCtx.imageSmoothingQuality='high';
    eqCtx.fillStyle='#fff';
    eqCtx.fillRect(0,0,eqCanvas.width,eqCanvas.height);
    eqCtx.drawImage(rawImg, 0, verticalPad*2, eqCanvas.width, mathH*2);
    applyEquationInkToAssetCanvas(eqCanvas, equationInk, renderProfile);
    const sourceWidth=eqCanvas.width;
    eqCanvas=trimEquationAssetHorizontalPadding(eqCanvas, Math.max(3, Math.round(targetH*.12)));
    assetW=Math.max(12, Math.round(assetW*(eqCanvas.width/Math.max(1,sourceWidth))));
    eqCache[cacheKey]={ img:eqCanvas, width:assetW, height:assetH };
    return eqCache[cacheKey];
  }
  async function getInlineImageAsset(src, widthHint, heightHint){
    const keyId=`${src}|${widthHint}|${heightHint}`;
    if(imgCache[keyId]) return imgCache[keyId];
    const img=await loadImg(src);
    let width=img.naturalWidth||img.width||widthHint||120;
    let height=img.naturalHeight||img.height||heightHint||40;
    const maxH=42;
    if(height>maxH){
      const scale=maxH/Math.max(1,height);
      width=Math.round(width*scale);
      height=Math.round(height*scale);
    }
    imgCache[keyId]={ img, width, height };
    return imgCache[keyId];
  }
  const rows=[];
  const inlineMathGap=1;
  for(const line of lines){
    if(!line.length){
      rows.push({ items:[], height:30 });
      continue;
    }
    let rowItems=[];
    let rowWidth=0;
    let rowHeight=30;
    const pushRow=()=>{
      rows.push(finalizeComposerRow(rowItems));
      rowItems=[];
      rowWidth=0;
      rowHeight=30;
    };
    for(const seg of line){
      if(seg.type==='eq'){
        const asset=await getEqAsset(seg.latex);
        if(!asset){
          const fallbackText=String(seg.text || seg.latex || '').replace(/[{}]/g,'');
          const font=getComposerFont(seg.style,getComposerMainTextSize(seg.style));
          mctx.font=font;
          const width=Math.max(12, Math.ceil(mctx.measureText(fallbackText).width));
          if(rowWidth>0 && rowWidth+width>maxWidth) pushRow();
          rowItems.push({ type:'text', x:rowWidth, width, text:fallbackText, style:seg.style });
          rowWidth+=width+inlineMathGap;
          rowHeight=Math.max(rowHeight, 30);
          continue;
        }
        if(rowWidth>0 && rowWidth+asset.width>maxWidth) pushRow();
        const scale=Math.min(1, maxWidth/Math.max(1,asset.width));
        const fitted={...asset,width:Math.max(16,Math.round(asset.width*scale)),height:Math.max(18,Math.round(asset.height*scale))};
        rowItems.push({ type:'eq', x:rowWidth, width:fitted.width, height:fitted.height, img:fitted.img, latex:seg.latex });
        rowWidth+=fitted.width+inlineMathGap;
        rowHeight=Math.max(rowHeight, fitted.height+8);
        continue;
      }
      if(seg.type==='frac'){
        const variant=seg.variant||'stacked';
        const fontTop=getComposerFont(seg.style, variant==='small'?Math.max(10, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.58)):Math.max(12, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.68)));
        const fontBottom=getComposerFont(seg.style, variant==='small'?Math.max(10, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.58)):Math.max(12, Math.round(readMixedComposerTextSize(activeComposerRenderKey)*0.68)));
        mctx.font=fontTop;
        const topW=Math.ceil(mctx.measureText(seg.num||'a').width);
        mctx.font=fontBottom;
        const bottomW=Math.ceil(mctx.measureText(seg.den||'b').width);
        const fracW=(variant==='slash'||variant==='linear')
          ? topW+bottomW+14
          : Math.max(topW,bottomW)+8;
        const fracH=(variant==='small') ? 24 : (variant==='slash'||variant==='linear') ? 22 : 30;
        if(rowWidth>0 && rowWidth+fracW>maxWidth) pushRow();
        rowItems.push({ type:'frac', x:rowWidth, width:fracW, height:fracH, num:seg.num||'a', den:seg.den||'b', style:seg.style, variant });
        rowWidth+=fracW+inlineMathGap;
        rowHeight=Math.max(rowHeight, fracH+4);
        continue;
      }
      if(seg.type==='structure'){
        if(seg.latex){
          try{
            const asset=await getEqAsset(seg.latex);
            if(!asset) throw new Error('Equation asset fallback');
            if(rowWidth>0 && rowWidth+asset.width>maxWidth) pushRow();
            const scale=Math.min(1, maxWidth/Math.max(1,asset.width));
            const fitted={...asset,width:Math.max(16,Math.round(asset.width*scale)),height:Math.max(18,Math.round(asset.height*scale))};
            rowItems.push({ type:'eq', x:rowWidth, width:fitted.width, height:fitted.height, img:fitted.img, latex:seg.latex });
            rowWidth+=fitted.width+inlineMathGap;
            rowHeight=Math.max(rowHeight, fitted.height+8);
            continue;
          }catch(_){
            const fallbackText=getComposerStructureFallbackText(seg);
            const font=getComposerFont(seg.style,getComposerMainTextSize(seg.style));
            mctx.font=font;
            const width=Math.max(12, Math.ceil(mctx.measureText(fallbackText).width));
            if(rowWidth>0 && rowWidth+width>maxWidth) pushRow();
            rowItems.push({ type:'text', x:rowWidth, width, text:fallbackText, style:seg.style });
            rowWidth+=width+3;
            rowHeight=Math.max(rowHeight, 30);
            continue;
          }
        }
        const measured=measureComposerStructure(mctx, seg);
        if(rowWidth>0 && rowWidth+measured.width>maxWidth) pushRow();
        rowItems.push({ type:'structure', x:rowWidth, width:measured.width, height:measured.height, ...seg });
        rowWidth+=measured.width+2;
        rowHeight=Math.max(rowHeight, measured.height+6);
        continue;
      }
      if(seg.type==='bracketDraw'){
        const fontSize=Math.max(34, Math.round(getComposerMainTextSize(seg.style)*2.05));
        const font=getComposerFont(seg.style,fontSize);
        mctx.font=font;
        const width=Math.max(12, Math.ceil(mctx.measureText(seg.text || '(').width));
        const height=Math.max(44, Math.round(fontSize*1.06));
        if(rowWidth>0 && rowWidth+width>maxWidth) pushRow();
        rowItems.push({ type:'bracketDraw', x:rowWidth, width, height, text:seg.text, style:seg.style });
        rowWidth+=width+2;
        rowHeight=Math.max(rowHeight, height+4);
        continue;
      }
      if(seg.type==='img'){
        const asset=await getInlineImageAsset(seg.src, seg.width, seg.height);
        if(rowWidth>0 && rowWidth+asset.width>maxWidth) pushRow();
        rowItems.push({ type:'img', x:rowWidth, width:asset.width, height:asset.height, img:asset.img });
        rowWidth+=asset.width+3;
        rowHeight=Math.max(rowHeight, asset.height+8);
        continue;
      }
      const parts=String(seg.text||'').split(/(\s+)/).filter(Boolean);
      for(const part of parts){
        if(!part) continue;
        const font=getComposerFont(seg.style,getComposerMainTextSize(seg.style));
        mctx.font=font;
        const width=Math.ceil(mctx.measureText(part).width);
        if(/^\s+$/.test(part)){
          rowItems.push({ type:'text', x:rowWidth, width, text:part, style:seg.style });
          rowWidth+=width;
          continue;
        }
        if(rowWidth>0 && rowWidth+width>maxWidth) pushRow();
        rowItems.push({ type:'text', x:rowWidth, width, text:part, style:seg.style });
        rowWidth+=width;
      }
    }
    pushRow();
  }
  const margin=key==='q' ? 9 : 3;
  const rowSurfacePad=getComposerRowSurfacePad(key);
  const outerMargin=Math.max(margin, rowSurfacePad);
  const gap=key==='q' ? 6 : 4;
  const width=maxWidth + outerMargin*2;
  const minBlockHeight=key==='q' ? 44 : 30;
  const height=Math.max(minBlockHeight, outerMargin*2 + rows.reduce((sum,row)=>sum+row.height,0) + Math.max(0,rows.length-1)*gap);
  const canvas=document.createElement('canvas');
  const scale=getMixedComposerRenderScale();
  canvas.width=Math.round(width*scale);
  canvas.height=Math.round(height*scale);
  canvas.style.width=width+'px';
  canvas.style.height=height+'px';
  const ctx=canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,width,height);
  ctx.lineJoin='round';
  ctx.lineCap='round';
  let y=outerMargin;
  rows.forEach(row=>{
    try{
      const surface=renderComposerRowSurface(row, key);
      ctx.drawImage(surface.canvas, outerMargin - surface.pad, y - surface.pad, surface.width, surface.height);
    }catch(err){
      drawComposerRowItems(ctx, row, outerMargin, y + row.baseline);
    }
    y+=row.height+gap;
  });
  return canvas;
  } finally {
    activeComposerRenderKey=prevComposerRenderKey;
  }
}

async function renderMixedComposerToDataUrl(root, key){
  const canvas=await renderMixedComposerCanvas(root, key);
  return canvas.toDataURL('image/png');
}

function getComposerApplySourceScale(source){
  const rawW=source?.naturalWidth||source?.width||0;
  const cssW=parseFloat(source?.style?.width||'');
  if(rawW>0 && Number.isFinite(cssW) && cssW>0) return rawW/cssW;
  const scale=(typeof getMixedComposerRenderScale==='function' ? getMixedComposerRenderScale() : 1) || 1;
  return Math.max(1, scale);
}

function getComposerApplyCanvasSource(source){
  if(source?.getContext) return source;
  const rawW=source?.naturalWidth||source?.width||0;
  const rawH=source?.naturalHeight||source?.height||0;
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(1, Math.round(rawW||1));
  canvas.height=Math.max(1, Math.round(rawH||1));
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  try{ ctx.drawImage(source,0,0,canvas.width,canvas.height); }catch(_){ }
  return canvas;
}

function getComposerSurfaceHorizontalInkCrop(source, padLogical=14){
  const canvas=getComposerApplyCanvasSource(source);
  const scale=getComposerApplySourceScale(source);
  const width=canvas.width||1;
  const height=canvas.height||1;
  try{
    const ctx=canvas.getContext('2d');
    const data=ctx.getImageData(0,0,width,height).data;
    let minX=width, maxX=-1;
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const index=(y*width+x)*4;
        const alpha=data[index+3];
        if(alpha<8) continue;
        const r=data[index], g=data[index+1], b=data[index+2];
        const lum=(r*0.299)+(g*0.587)+(b*0.114);
        if(lum<246){
          minX=Math.min(minX,x);
          maxX=Math.max(maxX,x);
        }
      }
    }
    if(maxX>=minX){
      const padPx=Math.max(4, Math.round(padLogical*scale));
      const sx=Math.max(0, minX-padPx);
      const right=Math.min(width, maxX+padPx+1);
      return { source:canvas, sx, sy:0, sw:Math.max(1,right-sx), sh:height, scale };
    }
  }catch(_){ }
  return { source:canvas, sx:0, sy:0, sw:width, sh:height, scale };
}

function prepareComposerSurfaceForCanvasApply(source, key){
  const crop=getComposerSurfaceHorizontalInkCrop(source, key==='q' ? 18 : 14);
  const scale=Math.max(1, crop.scale||1);
  return {
    source:crop.source,
    sx:crop.sx,
    sy:crop.sy,
    sw:crop.sw,
    sh:crop.sh,
    logicalWidth:Math.max(1, crop.sw/scale),
    logicalHeight:Math.max(1, crop.sh/scale)
  };
}

function addImageFigureDirect(key, dataUrl){
  loadImg(dataUrl).then(async img=>{
    const cv=document.getElementById(key+'Canvas');
    if(!cv) return;
    const figs=getFigureStore(key);
    const maxW=Math.max(180, cv.width-32);
    let drawW=img.naturalWidth||img.width||maxW;
    let drawH=img.naturalHeight||img.height||120;
    if(drawW>maxW){
      const scale=maxW/Math.max(1,drawW);
      drawW=Math.round(drawW*scale);
      drawH=Math.round(drawH*scale);
    }
    const fig={
      src:dataUrl,
      x:16,
      y:16,
      w:drawW,
      h:drawH,
      crop:{l:0,t:0,r:0,b:0}
    };
    resizeCanvasPreserve(key, Math.max(cv.height, fig.y+fig.h+24));
    figs.push(fig);
    selectedFigureByKey[key]=figs.length-1;
    renderFigureOverlays(key);
    appendFigureMarker(key);
    if(ensureSourceBackedFrame(key) && typeof syncCanvasAssetForKeyAsync==='function'){
      await syncCanvasAssetForKeyAsync(key, { allowBitmapFallback:false });
      saveLS();
    }else{
      saveCanvasToQ(key);
    }
    renderPaper();
  }).catch(()=>{
    showNotice('Composed statement could not be inserted into the frame.', 'Composer');
  });
}

async function applyMixedComposerSurfaceToCanvas(key, source){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) throw new Error('Target canvas was not found');
  const baseHeight=getBaseCanvasHeight(key);
  const pad=key==='q' ? 8 : 4;
  const preparedSource=prepareComposerSurfaceForCanvasApply(source, key);
  const srcW=preparedSource.logicalWidth||Math.max(200, cv.width-pad*2);
  const srcH=preparedSource.logicalHeight||baseHeight;
  const maxDrawW=Math.max(180, cv.width-pad*2);
  const drawScale=Math.min(1, maxDrawW/Math.max(1,srcW));
  const drawW=Math.max(60, Math.round(srcW*drawScale));
  const drawH=Math.max(key==='q' ? 28 : 18, Math.round(srcH*drawScale));
  let burnedLayerHeight=0;
  const burnedLayer=getBurnedFigureImage(key);
  if(burnedLayer){
    try{
      const layerImg=await loadImg(burnedLayer);
      burnedLayerHeight=(layerImg.naturalHeight||layerImg.height||0)/getBurnedFigureScale(key);
    }catch(_){ }
  }
  burnedLayerHeight=Math.max(burnedLayerHeight, getBurnedFigureBottom(key));
  const figs=getFigureStore(key);
  // Composer updates replace the text bitmap while keeping placed figures in
  // their canvas coordinates, so blank Composer space can act as a figure slot.
  const preservedFigures=figs.filter(fig=>fig && fig.src);
  const figureBottom=preservedFigures.reduce((bottom,fig)=>Math.max(bottom,(+fig.y||0)+(+fig.h||0)),0);
  const targetH=Math.max(baseHeight, Math.min(2200, Math.max(drawH+pad*2, cv.height, burnedLayerHeight, figureBottom+12)));
  cv.height=targetH;
  const ctx=cv.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,cv.width,cv.height);
  figs.splice(0,figs.length,...preservedFigures);
  const legends=getLegendStore(key);
  legends.length=0;
  selectedFigureByKey[key]=preservedFigures.length ? Math.min(Math.max(0, selectedFigureByKey[key]||0), preservedFigures.length-1) : -1;
  renderFigureOverlays(key);
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.globalCompositeOperation='source-over';
  const drawX=pad;
  const drawY=key==='q' ? pad : Math.max(pad, Math.round((targetH-drawH)/2));
  ctx.drawImage(
    preparedSource.source,
    preparedSource.sx,
    preparedSource.sy,
    preparedSource.sw,
    preparedSource.sh,
    drawX,
    drawY,
    drawW,
    drawH
  );
  pushHistory(key);
  if((getBurnedFigureStore(key).length || getBurnedFigureImage(key)) && typeof syncCanvasAssetForKeyAsync==='function'){
    await syncCanvasAssetForKeyAsync(key, { allowBitmapFallback:false });
  }else{
    saveCanvasToQ(key);
  }
  renderPaper();
  autoAdjustCanvasPane(key);
}

function applyMixedComposerToCanvas(key, dataUrl){
  return loadImg(dataUrl).then(img=>applyMixedComposerSurfaceToCanvas(key, img)).catch(()=>{
    showNotice('Composed statement could not be written into the canvas.', 'Composer');
    throw new Error('Composed statement could not be written into the canvas.');
  });
}

function openMixedComposer(key){
  const previousComposerKey=activeComposerKey;
  activeComposerKey=key;
  activeFractionInput=null;
  mixedComposerRange=null;
  mixedComposerUndoStack=[];
  const storedHTML=getComposerSourceHTML(key);
  const existingDraft=(previousComposerKey===key && String(mixedComposerDraftHTML||'').trim()) ? mixedComposerDraftHTML : storedHTML;
  openModal({
    title:'Statement Composer',
    subtitle:'Type normal question text and equations together, then add the whole clean block to the selected question or option frame in one click.',
    closable:true,
    body:`
      <div class="mixed-composer">
        <div class="mixed-composer-toolbar">
          <button class="btn" type="button" onclick="formatMixedComposer('bold')">Bold</button>
          <button class="btn" type="button" onclick="formatMixedComposer('italic')">Italic</button>
          <button class="btn" type="button" onclick="formatMixedComposer('underline')">Underline</button>
          <button class="btn" type="button" onclick="formatMixedComposer('subscript')">Sub</button>
          <button class="btn" type="button" onclick="formatMixedComposer('superscript')">Sup</button>
          <button class="btn" type="button" onclick="insertMixedComposerNormalLine()">New line</button>
          <button class="btn" type="button" onclick="insertMixedComposerNumberedLine()">1) Line</button>
          <button class="btn" type="button" onclick="undoMixedComposer()">Undo</button>
          <button class="btn" type="button" onclick="importPdfSourceIntoMixedComposer()">Import PDF Text</button>
          <label class="field" style="display:inline-flex;align-items:center;gap:6px;margin:0 4px;min-width:auto;border:0;padding:0">Text <select id="mixedComposerTextSize" class="input" style="width:82px;padding:6px 8px">${getMixedComposerTextOptionsHTML(readMixedComposerTextSize(key))}</select></label>
          <label class="field" style="display:inline-flex;align-items:center;gap:6px;margin:0 4px;min-width:auto;border:0;padding:0">Math <select id="mixedComposerMathSize" class="input" style="width:82px;padding:6px 8px">${getMixedComposerMathOptionsHTML(readMixedComposerMathSize(key))}</select></label>
          <label class="field" style="display:inline-flex;align-items:center;gap:6px;margin:0 4px;min-width:auto;border:0;padding:0">Inner <select id="mixedComposerInnerMathScale" class="input" style="width:92px;padding:6px 8px">${getMixedComposerInnerMathOptionsHTML(readMixedComposerInnerMathScale(key))}</select></label>
          <label class="field" style="display:inline-flex;align-items:center;gap:6px;margin:0 4px;min-width:auto;border:0;padding:0">Canvas style <select id="mixedComposerRenderProfile" class="input" style="width:122px;padding:6px 8px">${getMixedComposerRenderProfileOptionsHTML(readMixedComposerRenderProfile(key))}</select></label>
          <label class="field" style="display:inline-flex;align-items:center;gap:6px;margin:0 4px;min-width:auto;border:0;padding:0">Equation ink <select id="mixedComposerEquationStroke" class="input" style="width:104px;padding:6px 8px">${getMixedComposerEquationStrokeOptionsHTML(readMixedComposerEquationStroke(key))}</select></label>
          <div class="mixed-composer-actions">
            <button class="btn" type="button" onclick="adjustMixedComposerEditorHeight(80)">Expand</button>
            <button class="btn" type="button" onclick="adjustMixedComposerEditorHeight(-80)">Contract</button>
            <button class="btn pri composer-apply-btn" type="button" id="mixedComposerApplyTopBtn">Apply</button>
          </div>
          <span class="modal-note">Canvas style: Hallmark HD keeps the dark high-DPI finish. Official paper uses a cleaner exam-paper text/equation print. Equation ink changes both editable equation outlines and the final canvas equation asset.</span>
        </div>
        <div class="field">
          <label>Statement And Equation Block</label>
          <div class="mixed-composer-editor-wrap">
            <div id="mixedComposerEditor" class="mixed-composer-editor" contenteditable="true" spellcheck="true" data-placeholder="Type the full statement here. You can mix normal text and inserted equations in the same block."></div>
            <div class="mixed-composer-pane-grip" id="mixedComposerEditorGrip" title="Drag to resize editor"></div>
          </div>
        </div>
        <div class="mixed-composer-footer">
          <div class="mixed-composer-mathbox">
            <div class="composer-eq-toolrow">
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="openMixedComposerFractionModal('stacked')">Stacked Fraction</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="openMixedComposerFractionModal('slash')">Slash Fraction</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="openMixedComposerFractionModal('small')">Small Fraction</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('expFunc')">e^x</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('lnFunc')">ln( )</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('logFunc')">log( )</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('modFunc')">mod( )</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('absFunc')">|x|</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('floorFunc')">⌊x⌋</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('ceilFunc')">⌈x⌉</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('largeParen')">Big ( )</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('largeBracket')">Big [ ]</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('largeBrace')">Big { }</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineMatrixWidget(3,3)">3×3 Matrix</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineMatrixWidget(4,3)">4×3 Matrix</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineMatrixWidget(3,4)">3×4 Matrix</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineMatrixWidget(4,4)">4×4 Matrix</button>
          <label class="matrix-size-picker">Matrix <input id="mixedComposerMatrixRows" type="number" min="1" max="8" value="3" aria-label="Matrix rows"> × <input id="mixedComposerMatrixCols" type="number" min="1" max="8" value="3" aria-label="Matrix columns"> <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertConfiguredInlineMatrix()">Insert</button></label>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('integralPlain')">Integral</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('integral')">Integral Limits</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('doubleIntegral')">Double Integral</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('doubleIntegralEachLimits')">Double Each Limits</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('tripleIntegral')">Triple Integral</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('tripleIntegralEachLimits')">Triple Each Limits</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('summationPlain')">Summation</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('summation')">Summation Limits</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('limitPlain')">Simple Limit</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('limit')">Limit Approach</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('derivative')">d/dx</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('derivativePower')">dⁿ/dxⁿ</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('partialDerivative')">∂/∂x</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('partialDerivativePower')">∂ⁿ/∂xⁿ</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('vector')">Vector</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('vector','i')">i Vector</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('vector','j')">j Vector</button>
          <button class="btn" type="button" onmousedown="event.preventDefault()" onclick="insertInlineStructureWidget('vector','k')">k Vector</button>
            </div>
            <div class="composer-eq-tabs" id="composerEqTabs"></div>
            <div class="composer-eq-palette" id="composerEqPalette"></div>
            <div class="mixed-composer-pane-grip" id="mixedComposerMathGrip" title="Drag to resize math tools"></div>
          </div>
          <div class="mixed-composer-preview" id="mixedComposerPreview">Fractions, vectors, limits, integrals, and summations now insert directly into the main statement editor at the caret. Fill the boxes there, then keep typing normally.</div>
        </div>
        <div class="modal-actions">
            <button class="btn pri composer-apply-btn" type="button" id="mixedComposerApplyBtn">Apply</button>
          <button class="btn" type="button" onclick="closeModal()">Cancel</button>
        </div>
      </div>
    `
  });
  const editor=document.getElementById('mixedComposerEditor');
  document.querySelectorAll('.mixed-composer-toolbar .btn').forEach(btn=>{
    btn.addEventListener('mousedown', e=>e.preventDefault());
  });
  if(editor){
    const sizeSel=document.getElementById('mixedComposerTextSize');
    if(sizeSel){ sizeSel.value=String(readMixedComposerTextSize(key)); sizeSel.onchange=()=>updateMixedComposerTextSize(sizeSel.value, key); }
    const mathSizeSel=document.getElementById('mixedComposerMathSize');
    if(mathSizeSel){ mathSizeSel.value=String(readMixedComposerMathSize(key)); mathSizeSel.onchange=()=>updateMixedComposerMathSize(mathSizeSel.value, key); }
    const innerMathSel=document.getElementById('mixedComposerInnerMathScale');
    if(innerMathSel){ innerMathSel.value=String(readMixedComposerInnerMathScale(key)); innerMathSel.onchange=()=>updateMixedComposerInnerMathScale(innerMathSel.value, key); }
    const renderProfileSel=document.getElementById('mixedComposerRenderProfile');
    if(renderProfileSel){ renderProfileSel.value=readMixedComposerRenderProfile(key); renderProfileSel.onchange=()=>updateMixedComposerRenderProfile(renderProfileSel.value, key); }
    const equationStrokeSel=document.getElementById('mixedComposerEquationStroke');
    if(equationStrokeSel){ equationStrokeSel.value=readMixedComposerEquationStroke(key); equationStrokeSel.onchange=()=>updateMixedComposerEquationStroke(equationStrokeSel.value, key); }
    initMixedComposerResizeUI();
    applyMixedComposerFrameWidth(editor, key);
    applyMixedComposerEditorTypography(editor, key);
    if(existingDraft) editor.innerHTML=existingDraft;
    else editor.textContent=getComposerSourceText(key);
    mixedComposerUndoStack=[getMixedComposerSnapshot(editor)];
    ['mouseup','keyup','focus'].forEach(evt=>editor.addEventListener(evt, ()=>{
      if(mixedComposerRestoring) return;
      syncMixedComposerFractionInputs(editor);
      cleanupMixedComposerFormatTails(editor);
      mixedComposerDraftHTML=editor.innerHTML;
      saveMixedComposerRange();
    }));
    editor.addEventListener('input', ()=>{
      if(mixedComposerRestoring) return;
      syncMixedComposerFractionInputs(editor);
      cleanupMixedComposerFormatTails(editor);
      mixedComposerDraftHTML=editor.innerHTML;
      pushMixedComposerUndo(editor);
      saveMixedComposerRange();
    });
    editor.addEventListener('beforeinput', (e)=>{
      if(e.inputType==='insertParagraph'){
        // Don't intercept Enter inside inline widget inputs — let those work normally.
        const ae=document.activeElement;
        if(ae && (ae.classList.contains('frac-input') || ae.classList.contains('structure-input'))) return;
        e.preventDefault();
        insertMixedComposerLineBreak();
      }
    });
    editor.addEventListener('keydown', (e)=>{
      if(e.key==='Enter'){
        // Don't intercept Enter inside inline widget inputs — let those work normally.
        const ae=document.activeElement;
        if(ae && (ae.classList.contains('frac-input') || ae.classList.contains('structure-input'))) return;
        e.preventDefault();
        insertMixedComposerLineBreak();
      }
    });
    editor.addEventListener('paste', handleMixedComposerPaste);
    editor.focus();
  }
  resetMixedComposerEquationState();
  buildMixedComposerEqTabs();
  buildMixedComposerEqPalette();
  saveMixedComposerRange();
  const applyBtn=document.getElementById('mixedComposerApplyBtn');
  const applyTopBtn=document.getElementById('mixedComposerApplyTopBtn');
  const setApplyBusy=(busy)=>{
    [applyBtn,applyTopBtn].forEach(btn=>{
      if(!btn) return;
      if(!btn.dataset.idleText) btn.dataset.idleText=btn.textContent || 'Apply To Frame';
      btn.disabled=!!busy;
      btn.classList.toggle('is-applying', !!busy);
      btn.textContent=busy ? 'Applying...' : btn.dataset.idleText;
    });
  };
  const runApply=async ()=>{
    const editorEl=document.getElementById('mixedComposerEditor');
    if(!editorEl) return;
    syncMixedComposerFractionInputs(editorEl);
    cleanupMixedComposerFormatTails(editorEl);
    const plainText=getMixedComposerPlainText(editorEl);
    if(!plainText){
      showNotice('Please type the statement first.', 'Composer');
      return;
    }
    setApplyBusy(true);
    try{
      const surface=await renderMixedComposerCanvas(editorEl, key);
      const composerSize=readMixedComposerTextSize(key);
      const composerMathSize=readMixedComposerMathSize(key);
      const composerInnerMathScale=readMixedComposerInnerMathScale(key);
      const composerEquationInk=readMixedComposerEquationStroke(key);
      const composerRenderProfile=readMixedComposerRenderProfile(key);
      if(cur){
        if(key==='q'){
          cur.questionText=plainText;
          cur.questionComposerHTML=editorEl.innerHTML;
          cur.questionComposerTextSize=composerSize;
          cur.questionComposerMathSize=composerMathSize;
          cur.questionComposerInnerMathScale=composerInnerMathScale;
          cur.questionComposerEquationInk=composerEquationInk;
          cur.questionComposerRenderProfile=composerRenderProfile;
          clearFramePdfTextOverride(key);
          markFrameAsSource(key);
        }
        else if(key.startsWith('opt')){
          const idx=+key.slice(3);
          if(cur.options[idx]){
            cur.options[idx].text=plainText;
            cur.options[idx].composerHTML=editorEl.innerHTML;
            cur.options[idx].composerTextSize=composerSize;
            cur.options[idx].composerMathSize=composerMathSize;
            cur.options[idx].composerInnerMathScale=composerInnerMathScale;
            cur.options[idx].composerEquationInk=composerEquationInk;
            cur.options[idx].composerRenderProfile=composerRenderProfile;
            clearFramePdfTextOverride(key);
            markFrameAsSource(key);
          }
        }
      }
      await applyMixedComposerSurfaceToCanvas(key, surface);
      syncPdfSourceFields();
      mixedComposerDraftHTML='';
      closeModal();
      toast('Statement written to canvas');
    }catch(err){
      showNotice(err?.message || 'Composer render failed.', 'Composer');
      setApplyBusy(false);
    }
  };
  if(applyBtn) applyBtn.onclick=runApply;
  if(applyTopBtn) applyTopBtn.onclick=runApply;
}

function initMixedComposerResizeUI(){
  const shell=document.querySelector('.modal-shell:has(.mixed-composer)');
  const shellGrip=document.getElementById('mixedComposerShellGrip');
  const editor=document.getElementById('mixedComposerEditor');
  const editorGrip=document.getElementById('mixedComposerEditorGrip');
  const mathBox=document.querySelector('.mixed-composer-mathbox');
  const mathGrip=document.getElementById('mixedComposerMathGrip');
  const bind=(grip,target,minW,minH,maxW,maxH)=>{
    if(!grip || !target) return;
    grip.onpointerdown=(e)=>{
      e.preventDefault();
      const startX=e.clientX, startY=e.clientY;
      const rect=target.getBoundingClientRect();
      const startW=rect.width, startH=rect.height;
      grip.setPointerCapture?.(e.pointerId);
      const onMove=(ev)=>{
        if(minW!=null){
          const nextW=Math.max(minW, Math.min(maxW, startW + (ev.clientX-startX)));
          target.style.width=nextW+'px';
          target.style.maxWidth=nextW+'px';
        }
        if(minH!=null){
          const nextH=Math.max(minH, Math.min(maxH, startH + (ev.clientY-startY)));
          target.style.height=nextH+'px';
          target.style.minHeight=nextH+'px';
        }
      };
      const onUp=(ev)=>{
        grip.releasePointerCapture?.(ev.pointerId);
        grip.removeEventListener('pointermove', onMove);
        grip.removeEventListener('pointerup', onUp);
        grip.removeEventListener('pointercancel', onUp);
      };
      grip.addEventListener('pointermove', onMove);
      grip.addEventListener('pointerup', onUp);
      grip.addEventListener('pointercancel', onUp);
    };
  };
  bind(shellGrip, shell, 980, 760, Math.max(1180, Math.round(window.innerWidth*0.98)), Math.max(760, Math.round(window.innerHeight*0.97)));
  bind(editorGrip, editor, null, 260, null, Math.max(620, Math.round(window.innerHeight*0.72)));
  bind(mathGrip, mathBox, null, 240, null, Math.max(720, Math.round(window.innerHeight*0.78)));
}

function getEquationStudioBuilder(){
  return document.getElementById('eqStudioBuilder');
}

function equationStudioInsert(token){
  const el=getEquationStudioBuilder();
  if(!el) return;
  insertAtCursor(el, token);
  renderTexPreviewInto(document.getElementById('eqStudioPreview'), el.value);
}

function setEquationStudioCategory(category){
  const holder=document.getElementById('eqStudioSymbols');
  const searchEl=document.getElementById('eqStudioSearch');
  const tabs=document.getElementById('eqStudioTabs');
  if(!holder || !tabs) return;
  holder.dataset.category=category;
  tabs.querySelectorAll('[data-category]').forEach(btn=>{
    btn.classList.toggle('pri', btn.dataset.category===category);
  });
  const query=String(searchEl?.value || '').trim().toLowerCase();
  const items=(getLatexCatalog()[category] || []).filter(token=>{
    if(!query) return true;
    return token.toLowerCase().includes(query) || token.replaceAll('\\','').toLowerCase().includes(query);
  });
  holder.innerHTML=items.map(token=>`
    <button class="eq-studio-symbol" type="button" onclick="equationStudioInsert('${escA(token)}')">
      <span class="preview">${escH(token)}</span>
      <span class="token">${escH(token)}</span>
    </button>
  `).join('') || `<div class="modal-note">No symbols found in this category.</div>`;
}

function filterEquationStudioSymbols(){
  const holder=document.getElementById('eqStudioSymbols');
  const category=holder?.dataset.category || getLatexCategories()[0];
  setEquationStudioCategory(category);
}

function equationStudioInsertIntoEditor(){
  const el=getEquationStudioBuilder();
  const target=activeTextTarget ? document.getElementById(activeTextTarget) : null;
  const value=String(el?.value || '').trim();
  if(!target || !value){
    showNotice('Build an equation first, then insert it into the paragraph editor.', 'Equation Studio');
    return;
  }
  insertAtCursor(target, value);
  autoGrowTextBox(target);
  closeModal();
}

async function equationStudioRenderToFigure(key){
  const el=getEquationStudioBuilder();
  const value=String(el?.value || '').trim();
  if(!value){
    showNotice('Please build an equation first.', 'Equation Studio');
    return;
  }
  const btn=document.getElementById('eqStudioRenderBtn');
  if(btn){
    btn.disabled=true;
    btn.textContent='Rendering...';
  }
  try{
    const dataUrl=await renderTexToDataUrl(value);
    closeModal();
    placeRenderedEquationImage(key, dataUrl);
    toast('Equation rendered as figure');
  }catch(err){
    showNotice(err?.message || 'Equation rendering failed.', 'Equation Studio');
    if(btn){
      btn.disabled=false;
      btn.textContent='Render To Figure';
    }
  }
}

function openEquationStudio(key, seed=''){
  const categories=getLatexCategories();
  const tabs=categories.map(cat=>`<button class="btn${cat===categories[0]?' pri':''}" data-category="${escA(cat)}" type="button" onclick="setEquationStudioCategory('${escA(cat)}')">${escH(cat)}</button>`).join('');
  openModal({
    title:'Equation Studio',
    subtitle:'Search symbols, build the equation, insert it into the paragraph editor, or render it straight into the current question or option frame.',
    closable:true,
    body:`
      <div class="eq-studio">
        <div class="eq-studio-top">
          <div>
            <div class="field">
              <label>Search Symbols</label>
              <input id="eqStudioSearch" type="text" placeholder="Search latex symbols..." oninput="filterEquationStudioSymbols()">
            </div>
            <div class="eq-studio-tabs" id="eqStudioTabs">${tabs}</div>
            <div class="eq-studio-grid" id="eqStudioSymbols" data-category="${escA(categories[0])}"></div>
          </div>
          <div class="eq-studio-builder">
            <div class="field">
              <label>Equation Builder</label>
              <textarea id="eqStudioBuilder" spellcheck="false" placeholder="Build LaTeX here...">${escH(seed)}</textarea>
            </div>
            <div class="field">
              <label>Rendered Preview</label>
              <div class="eq-studio-preview" id="eqStudioPreview"><div class="preview-empty">Rendered preview appears here.</div></div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn" type="button" onclick="equationStudioInsertIntoEditor()">Insert Into Editor</button>
          <button class="btn pri" type="button" id="eqStudioRenderBtn" onclick="equationStudioRenderToFigure('${escA(key)}')">Render To Figure</button>
          <button class="btn" type="button" onclick="closeModal()">Close</button>
        </div>
      </div>
    `
  });
  setEquationStudioCategory(categories[0]);
  const builder=document.getElementById('eqStudioBuilder');
  if(builder){
    builder.addEventListener('input', ()=>renderTexPreviewInto(document.getElementById('eqStudioPreview'), builder.value));
    builder.focus();
    renderTexPreviewInto(document.getElementById('eqStudioPreview'), builder.value);
  }
}

function openTexEquationModal(key){
  openMixedComposer(key);
  return;
  const examples=getTexPresetExamples().map(ex=>`<button class="btn" type="button" onclick="fillTexExample('${escA(ex)}')">${escH(ex)}</button>`).join('');
  openModal({
    title:'Equation Builder',
    subtitle:'This is fully local. Build the equation with TeX or LaTeX-style syntax and insert it into the question or option frame as a figure.',
    closable:true,
    body:`
      <div class="field">
        <label>TeX Equation</label>
        <textarea id="texEquationInput" spellcheck="false" style="min-height:110px;font-family:var(--mono)" placeholder="e.g. \\int_0^\\infty e^{-x}\\,dx"></textarea>
      </div>
      <div class="field">
        <label>Quick Examples</label>
        <div class="subject-actions">${examples}</div>
      </div>
      <div class="modal-note">This local equation flow does not call any outside math-editor service. It renders in-app and places the output back into the selected canvas frame.</div>
      <div class="modal-actions">
        <button class="btn pri" type="button" id="texEqRenderBtn">Render To Figure</button>
        <button class="btn" type="button" onclick="closeModal()">Cancel</button>
      </div>
    `
  });
  const input=document.getElementById('texEquationInput');
  if(input) input.focus();
  const btn=document.getElementById('texEqRenderBtn');
  if(btn) btn.onclick=async ()=>{
    const tex=String(document.getElementById('texEquationInput')?.value || '').trim();
    if(!tex){
      showNotice('Please enter a TeX equation first.', 'Equation');
      return;
    }
    btn.disabled=true;
    btn.textContent='Rendering...';
    try{
      const dataUrl=await renderTexToDataUrl(tex);
      closeModal();
      placeRenderedEquationImage(key, dataUrl);
      toast('Equation rendered as figure');
    }catch(err){
      showNotice(err?.message || 'Equation rendering failed.', 'Equation');
      btn.disabled=false;
      btn.textContent='Render To Figure';
    }
  };
}

function fillTexExample(value){
  const input=document.getElementById('texEquationInput');
  if(input){
    input.value=value;
    input.focus();
  }
}

function transformSelectedText(el, mode){
  const { supMap, subMap } = getSuperSubMaps();
  const map = mode==='sup' ? supMap : subMap;
  const s=el.selectionStart||0, e=el.selectionEnd||0;
  if(s===e){
    toast(`Select text first to make it ${mode==='sup'?'superscript':'subscript'}`);
    el.focus();
    return;
  }
  const selected=el.value.slice(s,e);
  const converted=[...selected].map(ch=>{
    if(map[ch]) return map[ch];
    if(mode==='sup' && /[A-Z]/.test(ch) && map[ch.toLowerCase()]) return map[ch.toLowerCase()];
    if(mode==='sub' && /[A-Z]/.test(ch) && map[ch.toLowerCase()]) return map[ch.toLowerCase()];
    return map[ch.toLowerCase()] || ch;
  }).join('');
  el.value=el.value.slice(0,s)+converted+el.value.slice(e);
  el.selectionStart=s;
  el.selectionEnd=s+converted.length;
  el.focus();
  autoGrowTextBox(el);
}

function runSelectionAction(action){
  const el=activeTextTarget ? document.getElementById(activeTextTarget) : null;
  if(!el) return;
  if(action==='bold') return styleSelectedText(el, 'bold');
  if(action==='italic') return styleSelectedText(el, 'italic');
  if(action==='underline') return styleSelectedText(el, 'underline');
  if(action==='fraction') return applyInlineFraction(el);
}

function updateSelectionToolbar(key){
  const box=document.getElementById(key+'FloatingBox');
  const input=document.getElementById(key+'FloatingText');
  const bar=document.getElementById(key+'SelectionTools');
  if(!box || !input || !bar) return;
  const hasSelection=(input.selectionEnd||0)>(input.selectionStart||0);
  if(hasSelection) bar.removeAttribute('hidden');
  else bar.setAttribute('hidden','hidden');
}

function getFullMathButtonsHTML(){
  return MATH.map(([sym,val])=>
    val===null ? `<span class="mb-sec">${sym}</span>`
               : `<button class="mb" type="button" onclick="insActive('${val}')">${escH(sym==='̂'?'◌̂':sym)}</button>`
  ).join('');
}

function getMiniMathHTML(){
  const quick = ['α','β','γ','δ','ε','ϵ','η','θ','λ','μ','π','ρ','σ','τ','φ','ω','Δ','Ω','∞','√','∑','∫','∮','∂','∇','∝','≤','≥','≠','≈','±','×','÷','∠','°','ᵃ','ⁿ','ₐ','ₓ','◌̂','lim','∫ₐᵇ','Σₙ'];
  return `<div class="mini-math">` + quick.map(sym=>
    `<button class="mb" type="button" onclick="insActive('${sym==='lim'?'__lim__':sym==='∫ₐᵇ'?'__intlim__':sym==='Σₙ'?'__sumlim__':sym}')">${escH(sym)}</button>`
  ).join('') + `</div>`;
}

function insertTexSnippet(snippet){
  const el=activeTextTarget ? document.getElementById(activeTextTarget) : null;
  if(!el) return;
  insertAtCursor(el, snippet);
}

function toggleBetaEquationPanel(key){
  const panel=document.getElementById(key+'EqBetaPanel');
  const btn=document.getElementById(key+'EqBetaToggle');
  if(!panel || !btn) return;
  const show=panel.hasAttribute('hidden');
  if(show) panel.removeAttribute('hidden');
  else panel.setAttribute('hidden','hidden');
  btn.textContent=show ? 'Hide Equation Tools' : 'Show Equation Tools';
}

function getEquationRibbonHTML(key){
  return `
    <div class="eq-ribbon">
      <div class="eq-ribbon-head">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="eq-ribbon-title">Main Composer</div>
          <span class="beta-pill">PRIMARY</span>
        </div>
        <button class="btn pri" type="button" onclick="openMixedComposer('${key}')">Open Composer</button>
      </div>
      <div class="beta-note">Use the composer for the full question or option block. It handles normal statement text and equations together, then renders the result cleanly into the same frame.</div>
    </div>
  `;
}

function toggleFloatingMath(key){
  const panel=document.getElementById(key+'MathPalette');
  if(panel) panel.classList.toggle('hidden');
}

function closeCanvasTextBox(key){
  const box=document.getElementById(key+'FloatingBox') || document.querySelector(`#${key}CanvasWrap .canvas-textbox`);
  if(box) box.remove();
  const palette=document.getElementById(key+'MathPalette');
  if(palette) palette.remove();
  const optRow=key.startsWith('opt') ? document.getElementById('optRow'+key.slice(3)) : null;
  if(optRow) optRow.classList.remove('focused-editor');
  if(activeTextTarget===key+'FloatingText') activeTextTarget=null;
}

function updateTextBoxCanvasCoords(box, key){
  const cv=document.getElementById(key+'Canvas');
  if(!box || !cv) return;
  if(key.startsWith('opt')){
    box.dataset.canvasX='16';
    box.dataset.canvasY='16';
    return;
  }
  const wrap=document.getElementById(key+'CanvasWrap');
  const wrapRect=wrap.getBoundingClientRect();
  const cvRect=cv.getBoundingClientRect();
  const scaleX=cv.width/cvRect.width;
  const scaleY=cv.height/cvRect.height;
  const left=parseFloat(box.style.left||'0');
  const top=parseFloat(box.style.top||'0');
  if(box.dataset.mode==='legend'){
    box.dataset.canvasX=String(Math.max(12, Math.round(left*scaleX)));
  } else {
    box.dataset.canvasX='16';
  }
  box.dataset.canvasY=String(Math.max(14, Math.round(Math.min(top, wrapRect.height-40)*scaleY)));
}

function makeTextBoxDraggable(box, key){
  const head=box.querySelector('.canvas-textbox-head');
  if(!head) return;
  let dragging=false, dx=0, dy=0;
  function onMove(clientX, clientY){
    if(!dragging) return;
    const wrap=document.getElementById(key+'CanvasWrap');
    const wrapRect=wrap.getBoundingClientRect();
    const nextLeft=Math.min(Math.max(8, clientX-wrapRect.left-dx), Math.max(8, wrapRect.width-box.offsetWidth-8));
    const nextTop=Math.min(Math.max(8, clientY-wrapRect.top-dy), Math.max(8, wrapRect.height-box.offsetHeight-8));
    box.style.left=nextLeft+'px';
    box.style.top=nextTop+'px';
    updateTextBoxCanvasCoords(box,key);
  }
  head.addEventListener('pointerdown',e=>{
    e.preventDefault();
    dragging=true;
    box.classList.add('dragging');
    head.setPointerCapture?.(e.pointerId);
    const rect=box.getBoundingClientRect();
    dx=e.clientX-rect.left;
    dy=e.clientY-rect.top;
    const move=e2=>onMove(e2.clientX,e2.clientY);
    const up=e2=>{
      head.releasePointerCapture?.(e2.pointerId);
      dragging=false;
      box.classList.remove('dragging');
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
  });
}

function closeCanvasImageBox(key){
  const wrap=document.getElementById(key+'CanvasWrap');
  const box=wrap?.querySelector('.canvas-imagebox');
  if(box) box.remove();
}

function makeImageBoxDraggable(box, key){
  const head=box.querySelector('.canvas-imagebox-head');
  if(!head) return;
  let dx=0, dy=0;
  head.addEventListener('pointerdown',e=>{
    e.preventDefault();
    box.classList.add('dragging');
    head.setPointerCapture?.(e.pointerId);
    const rect=box.getBoundingClientRect();
    dx=e.clientX-rect.left;
    dy=e.clientY-rect.top;
    const move=e2=>{
      const wrap=document.getElementById(key+'CanvasWrap');
      const wrapRect=wrap.getBoundingClientRect();
      const nextLeft=Math.min(Math.max(8, e2.clientX-wrapRect.left-dx), Math.max(8, wrapRect.width-box.offsetWidth-8));
      const nextTop=Math.min(Math.max(8, e2.clientY-wrapRect.top-dy), Math.max(8, wrapRect.height-box.offsetHeight-8));
      box.style.left=nextLeft+'px';
      box.style.top=nextTop+'px';
    };
    const up=e2=>{
      head.releasePointerCapture?.(e2.pointerId);
      box.classList.remove('dragging');
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
  });
}

function openImagePlacementBox(key, img, opts={}){
  closeCanvasImageBox(key);
  const wrap=document.getElementById(key+'CanvasWrap');
  const cv=document.getElementById(key+'Canvas');
  if(!wrap||!cv) return;
  const mode=opts.mode||'replace';
  const metrics=getCanvasOverlayMetrics(key);
  const fit=getImageFitSize(img, Math.max(120, cv.width-32), Math.max(60, cv.height-32));
  const box=document.createElement('div');
  box.className='canvas-imagebox';
  box.dataset.mode=mode;
  if(opts.figureIndex!=null) box.dataset.figureIndex=String(opts.figureIndex);
  if(opts.figureMetadata && typeof opts.figureMetadata==='object') box._figureMetadata=opts.figureMetadata;
  if(opts.preferredPlacement && typeof opts.preferredPlacement==='object') box._preferredPlacement=opts.preferredPlacement;
  const requestedLogicalW=+(opts.logicalWidth || opts.figureMetadata?.displayWidth || opts.figureMetadata?.naturalWidth || 0);
  const requestedLogicalH=+(opts.logicalHeight || opts.figureMetadata?.displayHeight || opts.figureMetadata?.naturalHeight || 0);
  if(requestedLogicalW>0) box.dataset.logicalWidth=String(requestedLogicalW);
  if(requestedLogicalH>0) box.dataset.logicalHeight=String(requestedLogicalH);
  box.style.left=((metrics?.left||0)+12)+'px';
  box.style.top=((metrics?.top||0)+12)+'px';
  if(box._preferredPlacement){
    box.style.left=((metrics?.left||0)+(+box._preferredPlacement.x||0)/((metrics?.scaleX)||1))+'px';
    box.style.top=((metrics?.top||0)+(+box._preferredPlacement.y||0)/((metrics?.scaleY)||1))+'px';
  }
  box.innerHTML=`
    <div class="canvas-imagebox-head">
      <span>Drag inside the frame, then apply</span>
      <span>${mode==='replace'?'Change selected figure':'Add figure to frame'}</span>
    </div>
    <img id="${key}FloatingImg" src="${img.src}" alt="">
    <div class="canvas-textbox-actions">
      <button class="btn" type="button" onclick="closeCanvasImageBox('${key}')">Cancel</button>
      <button class="btn pri" type="button" onclick="applyImagePlacement('${key}', '${mode}')">Apply</button>
    </div>
  `;
  wrap.appendChild(box);
  const logicalW=box._preferredPlacement?.w || requestedLogicalW || fit.drawW;
  const logicalH=box._preferredPlacement?.h || requestedLogicalH || fit.drawH;
  const cssW=Math.min((metrics?.width||cv.width)-24, logicalW/((metrics?.scaleX)||1));
  const cssH=Math.min((metrics?.height||cv.height)-24, logicalH/((metrics?.scaleY)||1));
  box.style.width=(cssW+24)+'px';
  box.querySelector('img').style.width=cssW+'px';
  box.querySelector('img').style.height=cssH+'px';
  makeImageBoxDraggable(box,key);
}

async function trimPlainPlacedImageWhitespace(img, box, figureMetadata={}){
  const src=String(img?.src||'');
  if(!/^data:image\//i.test(src)) return null;
  if(/^data:image\/svg\+xml/i.test(src) || String(figureMetadata?.sourceSvg||'').trim()) return null;
  const srcW=img.naturalWidth||img.width||0;
  const srcH=img.naturalHeight||img.height||0;
  if(srcW<8 || srcH<8) return null;
  try{
    const maxScan=900;
    const scanScale=Math.min(1, maxScan/Math.max(srcW,srcH));
    const sw=Math.max(1, Math.round(srcW*scanScale));
    const sh=Math.max(1, Math.round(srcH*scanScale));
    const canvas=document.createElement('canvas');
    canvas.width=sw;
    canvas.height=sh;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#fff';
    ctx.fillRect(0,0,sw,sh);
    ctx.drawImage(img,0,0,sw,sh);
    const pixels=ctx.getImageData(0,0,sw,sh).data;
    let minX=sw,minY=sh,maxX=-1,maxY=-1;
    for(let y=0;y<sh;y++){
      for(let x=0;x<sw;x++){
        const i=(y*sw+x)*4;
        const a=pixels[i+3], r=pixels[i], g=pixels[i+1], b=pixels[i+2];
        if(a>12 && (r<246 || g<246 || b<246)){
          if(x<minX) minX=x;
          if(y<minY) minY=y;
          if(x>maxX) maxX=x;
          if(y>maxY) maxY=y;
        }
      }
    }
    if(maxX<minX || maxY<minY) return null;
    const pad=Math.max(2, Math.round(5*scanScale));
    minX=Math.max(0,minX-pad);
    minY=Math.max(0,minY-pad);
    maxX=Math.min(sw-1,maxX+pad);
    maxY=Math.min(sh-1,maxY+pad);
    const cropW=maxX-minX+1;
    const cropH=maxY-minY+1;
    const keepRatio=(cropW*cropH)/Math.max(1,sw*sh);
    if(keepRatio>.94) return null;
    const fullX=minX/scanScale;
    const fullY=minY/scanScale;
    const fullW=cropW/scanScale;
    const fullH=cropH/scanScale;
    const out=document.createElement('canvas');
    out.width=Math.max(1, Math.round(fullW));
    out.height=Math.max(1, Math.round(fullH));
    const octx=out.getContext('2d');
    octx.imageSmoothingEnabled=true;
    octx.imageSmoothingQuality='high';
    octx.fillStyle='#fff';
    octx.fillRect(0,0,out.width,out.height);
    octx.drawImage(img,fullX,fullY,fullW,fullH,0,0,out.width,out.height);
    const trimmedSrc=out.toDataURL(/^data:image\/jpe?g/i.test(src) ? 'image/jpeg' : 'image/png', .96);
    const logicalW=+(box?.dataset?.logicalWidth||0);
    const logicalH=+(box?.dataset?.logicalHeight||0);
    const nextW=logicalW>0 ? Math.max(1, Math.round(logicalW*(fullW/srcW))) : 0;
    const nextH=logicalH>0 ? Math.max(1, Math.round(logicalH*(fullH/srcH))) : 0;
    return {
      src:trimmedSrc,
      logicalWidth:nextW,
      logicalHeight:nextH,
      trim:{x:fullX,y:fullY,w:fullW,h:fullH,sourceW:srcW,sourceH:srcH}
    };
  }catch(_){
    return null;
  }
}

async function applyImagePlacement(key, mode='replace'){
  const wrap=document.getElementById(key+'CanvasWrap');
  const box=wrap?.querySelector('.canvas-imagebox');
  const img=box?.querySelector('img');
  const cv=document.getElementById(key+'Canvas');
  if(!box||!img||!cv) return;
  const metrics=getCanvasOverlayMetrics(key);
  if(!metrics) return;
  const figs=getFigureStore(key);
  const left=parseFloat(box.style.left||'12');
  const top=parseFloat(box.style.top||'12');
  const fit=getImageFitSize(img, Math.max(120, cv.width-32), Math.max(60, cv.height-32));
  const imgCssW=parseFloat(img.style.width||'0');
  const imgCssH=parseFloat(img.style.height||'0');
  const drawW=Math.max(1, Math.round((+box.dataset.logicalWidth||0) || (imgCssW>0 ? imgCssW*metrics.scaleX : fit.drawW)));
  const drawH=Math.max(1, Math.round((+box.dataset.logicalHeight||0) || (imgCssH>0 ? imgCssH*metrics.scaleY : fit.drawH)));
  const figureMetadata=(box._figureMetadata && typeof box._figureMetadata==='object') ? box._figureMetadata : {};
  const trimmed=await trimPlainPlacedImageWhitespace(img, box, figureMetadata);
  const figSrc=trimmed?.src || img.src;
  const finalDrawW=trimmed?.logicalWidth || drawW;
  const finalDrawH=trimmed?.logicalHeight || drawH;
  const fig={
    src:figSrc,
    x:Math.max(0, Math.round((left-metrics.left)*metrics.scaleX)),
    y:Math.max(0, Math.round((top-metrics.top)*metrics.scaleY)),
    w:finalDrawW,
    h:finalDrawH,
    crop:{l:0,t:0,r:0,b:0}
  };
  if(trimmed?.trim){
    fig.sourceTrim=trimmed.trim;
    fig.naturalWidth=trimmed.trim.w;
    fig.naturalHeight=trimmed.trim.h;
    fig.displayWidth=finalDrawW;
    fig.displayHeight=finalDrawH;
  }
  const previousFigure=(mode==='replace' && box.dataset.figureIndex!=null && figs[+box.dataset.figureIndex]) ? figs[+box.dataset.figureIndex] : null;
  if(previousFigure && box._preferredPlacement){
    fig.x=Math.max(0, Math.round(+previousFigure.x||0));
    fig.y=Math.max(0, Math.round(+previousFigure.y||0));
    fig.w=Math.max(1, Math.round(+previousFigure.w||drawW));
    fig.h=Math.max(1, Math.round(+previousFigure.h||drawH));
    fig.crop=previousFigure.crop || fig.crop;
  }
  fig.x=Math.min(Math.max(0,fig.x), Math.max(0, cv.width-fig.w));
  fig.y=Math.min(Math.max(0,fig.y), Math.max(0, cv.height-fig.h));
  resizeCanvasPreserve(key, Math.max(cv.height, fig.y+fig.h+24));
  if(mode==='replace' && box.dataset.figureIndex!=null && figs[+box.dataset.figureIndex]){
    const prev=figs[+box.dataset.figureIndex];
    removeBurnedFiguresMatchingLiveFigure(key, prev);
    removeBurnedFiguresMatchingLiveFigure(key, fig);
    figs[+box.dataset.figureIndex]={...prev, ...fig, src:figSrc, ...figureMetadata};
    selectedFigureByKey[key]=+box.dataset.figureIndex;
  } else {
    figs.push({...fig, ...figureMetadata});
    selectedFigureByKey[key]=figs.length-1;
  }
  renderFigureOverlays(key);
  appendFigureMarker(key);
  if(ensureSourceBackedFrame(key) && typeof syncCanvasAssetForKeyAsync==='function'){
    await syncCanvasAssetForKeyAsync(key, { allowBitmapFallback:false });
    saveLS();
  }else{
    saveCanvasToQ(key);
  }
  renderPaper();
  closeCanvasImageBox(key);
}

function applyCanvasText(key, x, y){
  markFrameAsBitmap(key);
  const input=document.getElementById(key+'FloatingText');
  const cv=document.getElementById(key+'Canvas');
  const box=document.getElementById(key+'FloatingBox') || document.querySelector(`#${key}CanvasWrap .canvas-textbox`);
  if(!input||!cv||!box) return;
  const text=(box.dataset.mode!=='legend' && key==='q' ? sentenceCapText(input.value) : input.value).trimEnd();
  if(!text){
    if(key.startsWith('opt')){
      toast('Please add this option before moving forward');
      input.focus();
      return;
    }
    closeCanvasTextBox(key);
    return;
  }
  const ctx=cv.getContext('2d');
  const color=document.getElementById(key+'Color')?.value||'#111';
  const size=(+(document.getElementById(key+'Size')?.value||2))*5+10;
  const lineHeight=Math.max(size+4,18);
  updateTextBoxCanvasCoords(box,key);
  const font=`${size}px "Times New Roman",serif`;
  let startX, startY;
  if(box.dataset.mode==='legend'){
    startX=Math.max(12, +(box.dataset.canvasX||x||16));
    startY=Math.max(+(box.dataset.canvasY||y||14),14);
    ensureCanvasHeightForText(key,text,font,lineHeight,startY, startX);
  } else {
    const fixed=getFixedTextPlacement(key,text,font,lineHeight);
    startX=fixed.startX;
    startY=fixed.startY;
  }
  if(box.dataset.mode!=='legend' && cur){
    if(key==='q'){
      cur.questionText=text;
    } else if(key.startsWith('opt')){
      const idx=+key.slice(3);
      if(cur.options[idx]) cur.options[idx].text=text;
    }
  } else if(box.dataset.mode==='legend'){
    const legends=getLegendStore(key);
    legends.push({
      text,
      x:startX,
      y:startY,
      font,
      lineHeight,
      color
    });
  }
  drawCanvasText(cv.getContext('2d'),text,startX,startY,cv.width-startX-12,font,lineHeight,color);
  pushHistory(key);
  saveCanvasToQ(key);
  syncPdfSourceFields();
  renderPaper();
  closeCanvasTextBox(key);
  if(key.startsWith('opt')){
    const nextIdx = +key.slice(3) + 1;
    const nextRow = document.getElementById('optRow'+nextIdx);
    if(nextRow) nextRow.scrollIntoView({behavior:'smooth', block:'center'});
  }
}

function hasPaperText(v){
  return !!displayPdfText(v).trim();
}

function getEditorText(v){
  return String(v||'').replace(/[\u200B\u2060]/g,'').replace(/\[\[FIGURE\]\]/g,'').replace(/\[Figure\]/g,'').replace(/\n{3,}/g,'\n\n').trim();
}

function displayPdfText(v){
  return String(v||'').replace(/[\u200B\u2060]/g,'').replace(/\[\[FIGURE\]\]/g,'[Figure]').trim();
}

function storePdfText(v){
  return String(v||'').replace(/[\u200B\u2060]/g,'').replace(/\[Figure\]/g,'[[FIGURE]]').trim();
}

function stripFigureMarkers(v){
  return String(v||'').replace(/[\u200B\u2060]/g,'').replace(/\[\[FIGURE\]\]/g,'').replace(/\[Figure\]/g,'').trim();
}

function getInlineStructurePdfText(node){
  const kind=String(node?.dataset?.kind || 'integral');
  if(kind==='matrix') return getInlineMatrixPlainText(node);
  const expr=isLargeBracketStructureKind(kind)
    ? readInlineStructureRawValue(node, '.structure-expr', '')
    : readInlineStructureValue(node, '.structure-expr', kind==='summation' ? 'a_i' : kind==='vector' ? 'A' : 'f(x)');
  if(isLargeBracketStructureKind(kind)){
    const [left,right]=getLargeBracketChars(kind);
    return left + expr + right;
  }
  if(kind==='summationPlain') return 'Σ ' + expr;
  if(kind==='summation'){
    const lower=readInlineStructureValue(node, '.structure-lower', 'i=1');
    const upper=readInlineStructureValue(node, '.structure-upper', 'n');
    return 'Σ(' + lower + ' to ' + upper + ') ' + expr;
  }
  if(kind==='vector') return expr + ' vector';
  if(isDerivativeStructureKind(kind)){
    const variable=readInlineStructureValue(node, '.structure-var', 'x');
    const power=readInlineStructureValue(node, '.structure-order', 'n');
    if(kind==='partialDerivativePower') return '∂^' + power + '/∂' + variable + '^' + power + ' ' + expr;
    if(kind==='derivativePower') return 'd^' + power + '/d' + variable + '^' + power + ' ' + expr;
    if(kind==='partialDerivative') return '∂/∂' + variable + ' ' + expr;
    if(kind==='secondPartialDerivative') return '∂²/∂' + variable + '² ' + expr;
    if(kind==='secondDerivative') return 'd²/d' + variable + '² ' + expr;
    return 'd/d' + variable + ' ' + expr;
  }
  if(kind==='limitPlain') return 'lim ' + expr;
  if(kind==='limit'){
    const variable=readInlineStructureValue(node, '.structure-var', 'x');
    const toValue=readInlineStructureValue(node, '.structure-to-value', '0');
    return 'lim ' + variable + '→' + toValue + ' ' + expr;
  }
  if(isIntegralStructureKind(kind)){
    const differential=getIntegralDifferentialText(kind, readIntegralVariableText(node, kind), false);
    if(hasPerIntegralLimits(kind)){
      const order=getIntegralOrderForKind(kind);
      const parts=[];
      for(let i=1;i<=order;i++){
        const lower=readInlineStructureValue(node, '.structure-lower-' + i, i===1 ? 'a' : '');
        const upper=readInlineStructureValue(node, '.structure-upper-' + i, i===1 ? 'b' : '');
        if(kind==='doubleIntegralFirstLimits' && i>1) parts.push('∫');
        else parts.push('∫(' + (lower||'a') + ' to ' + (upper||'b') + ')');
      }
      return parts.join(' ') + ' ' + expr + ' ' + differential;
    }
    const symbol=getIntegralSymbolForKind(kind);
    if(hasIntegralLimits(kind)){
      const lower=readInlineStructureValue(node, '.structure-lower', 'a');
      const upper=readInlineStructureValue(node, '.structure-upper', 'b');
      return symbol + '(' + lower + ' to ' + upper + ') ' + expr + ' ' + differential;
    }
    return symbol + ' ' + expr + ' ' + differential;
  }
  return expr;
}

function extractPdfTextFromComposerNode(root){
  const lines=[[]];
  const current=()=>lines[lines.length-1];
  const newline=()=>{ lines.push([]); };
  const push=(text)=>{ const clean=String(text||''); if(clean) current().push(clean); };
  const readInput=(node, selector, fallback='')=>{
    const el=node.querySelector(selector);
    return String(el?.value || el?.getAttribute('value') || fallback || '').trim();
  };
  const wrapScript=(node, prefix)=>{
    const text=String(node?.textContent || '').replace(/[\u200B\u2060]/g,'').trim();
    if(text) push(prefix + '{' + composerExprToLatex(text) + '}');
  };
  const walk=(node)=>{
    if(!node) return;
    if(node.nodeType===3){ push(node.nodeValue||''); return; }
    if(node.nodeType!==1) return;
    if(node.classList?.contains('composer-eq-token')){
      push(node.dataset.latex || node.dataset.plain || node.textContent || '');
      return;
    }
    if(node.classList?.contains('composer-inline-frac')){
      const num=readInput(node, '.frac-num', 'a');
      const den=readInput(node, '.frac-den', 'b');
      const variant=String(node.dataset?.variant || 'stacked');
      push(getInlineFractionLatex(num, den, variant));
      return;
    }
    if(node.classList?.contains('composer-inline-structure')){
      push(getInlineStructureLatex(node));
      return;
    }
    if(node.classList?.contains('composer-inline-image') || node.tagName==='IMG'){ push('[Image]'); return; }
    if(/^(SUP)$/i.test(node.tagName)){ wrapScript(node, '^'); return; }
    if(/^(SUB)$/i.test(node.tagName)){ wrapScript(node, '_'); return; }
    const block=/^(DIV|P)$/i.test(node.tagName);
    if(node.tagName==='BR'){ newline(); return; }
    Array.from(node.childNodes).forEach(walk);
    if(block) newline();
  };
  Array.from(root.childNodes).forEach(walk);
  while(lines.length>1 && !lines[lines.length-1].length) lines.pop();
  return lines.map(line=>line.join('')).join('\n').replace(/[\u200B\u2060]/g,'').replace(/\n+$/,'');
}

function derivePdfTextFromComposerHTML(html, fallback=''){
  const safeHtml=String(html||'').trim();
  if(!safeHtml) return displayPdfText(fallback||'');
  try{
    const host=document.createElement('div');
    host.innerHTML=safeHtml;
    const plain=extractPdfTextFromComposerNode(host);
    return displayPdfText(plain || fallback || '');
  }catch(_){
    return displayPdfText(fallback||'');
  }
}

function normalizePdfTextForAutoCompare(value){
  return displayPdfText(value||'')
    .replace(/\r\n?/g,'\n')
    .trim();
}

function getQuestionAutoPdfSourceText(qObj=null){
  const q=qObj || cur;
  if(!q) return '';
  return derivePdfTextFromComposerHTML(q.questionComposerHTML, q.questionText||'');
}

function getOptionAutoPdfSourceText(optObj=null){
  const opt=optObj || null;
  if(!opt) return '';
  return derivePdfTextFromComposerHTML(opt.composerHTML, opt.text||'');
}

function shouldKeepManualPdfOverride(manual, autoText){
  const stored=normalizePdfTextForAutoCompare(manual);
  if(!stored) return false;
  const auto=normalizePdfTextForAutoCompare(autoText);
  if(stored===auto) return false;
  return true;
}

function cleanupAutoPdfOverrideForKey(key){
  if(!cur) return;
  if(key==='q'){
    if(!shouldKeepManualPdfOverride(cur.questionPdfText, getQuestionAutoPdfSourceText(cur))){
      delete cur.questionPdfText;
      delete cur.questionPdfTextManual;
    }
    return;
  }
  if(key.startsWith('opt')){
    const opt=cur.options?.[+key.slice(3)];
    if(opt && !shouldKeepManualPdfOverride(opt.pdfText, getOptionAutoPdfSourceText(opt))){
      delete opt.pdfText;
      delete opt.pdfTextManual;
    }
  }
}

function setFramePdfTextOverride(key, value){
  if(!cur) return;
  const clean=storePdfText(value);
  if(key==='q'){
    if(shouldKeepManualPdfOverride(clean, getQuestionAutoPdfSourceText(cur))){
      cur.questionPdfText=clean;
      cur.questionPdfTextManual=true;
    }else{
      delete cur.questionPdfText;
      delete cur.questionPdfTextManual;
    }
    return;
  }
  if(key.startsWith('opt')){
    const opt=cur.options?.[+key.slice(3)];
    if(!opt) return;
    if(shouldKeepManualPdfOverride(clean, getOptionAutoPdfSourceText(opt))){
      opt.pdfText=clean;
      opt.pdfTextManual=true;
    }else{
      delete opt.pdfText;
      delete opt.pdfTextManual;
    }
  }
}


function getQuestionPdfSourceText(qObj=null){
  const q=qObj || cur;
  if(!q) return '';
  const autoText=getQuestionAutoPdfSourceText(q);
  if(q.questionPdfTextManual && shouldKeepManualPdfOverride(q.questionPdfText, autoText)) return displayPdfText(q.questionPdfText);
  return autoText;
}

function getOptionPdfSourceText(optObj=null){
  const opt=optObj || null;
  if(!opt) return '';
  const autoText=getOptionAutoPdfSourceText(opt);
  if(opt.pdfTextManual && shouldKeepManualPdfOverride(opt.pdfText, autoText)) return displayPdfText(opt.pdfText);
  return autoText;
}

function getFramePdfTextOverride(key){
  if(!cur) return '';
  if(key==='q') return String(cur.questionPdfText || '').trim();
  if(key.startsWith('opt')){
    const opt=cur.options?.[+key.slice(3)];
    return String(opt?.pdfText || '').trim();
  }
  return '';
}

function clearFramePdfTextOverride(key){
  if(!cur) return;
  if(key==='q'){
    delete cur.questionPdfText;
    return;
  }
  if(key.startsWith('opt')){
    const opt=cur.options?.[+key.slice(3)];
    if(opt) delete opt.pdfText;
  }
}

function normalizePdfExportText(v){
  const superMap = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-','⁼':'=','⁽':'(','⁾':')','ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ᶦ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z','ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ⱽ':'V','ᵂ':'W'};
  const subMap = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','₌':'=','₍':'(','₎':')','ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};
  const fixes = [
    [/âˆž/g, '∞'],
    [/âˆ‚/g, '∂'],
    [/âˆ‡/g, '∇'],
    [/â‰¤/g, '≤'],
    [/â‰¥/g, '≥'],
    [/â‰ /g, '≠'],
    [/â‰ˆ/g, '≈'],
    [/â‰¡/g, '≡'],
    [/â†’/g, '→'],
    [/â†”/g, '↔'],
    [/â†‘/g, '↑'],
    [/â†“/g, '↓'],
    [/âˆ«/g, '∫'],
    [/âˆ®/g, '∮'],
    [/âˆ‘/g, '∑'],
    [/âˆ/g, '∏'],
    [/âˆš/g, '√'],
    [/âˆ©/g, '∩'],
    [/âˆª/g, '∪'],
    [/Î±/g, 'α'],
    [/Î²/g, 'β'],
    [/Î³/g, 'γ'],
    [/Î´/g, 'δ'],
    [/Îµ/g, 'ε'],
    [/Î·/g, 'η'],
    [/Î¸/g, 'θ'],
    [/Î»/g, 'λ'],
    [/Î¼/g, 'μ'],
    [/Ï€/g, 'π'],
    [/Ï/g, 'ρ'],
    [/Ïƒ/g, 'σ'],
    [/Ï„/g, 'τ'],
    [/Ï•/g, 'φ'],
    [/Ï‰/g, 'ω'],
    [/Î¦/g, 'Φ'],
    [/Î¨/g, 'Ψ'],
    [/Î©/g, 'Ω'],
    [/Î”/g, 'Δ'],
    [/μ₀/g, 'μ0'],
    [/ε₀/g, 'ε0'],
    [/σ₀/g, 'σ0'],
    [/ρ₀/g, 'ρ0'],
    [/H⃗/g, 'vec(H)'],
    [/E⃗/g, 'vec(E)'],
    [/B⃗/g, 'vec(B)'],
    [/D⃗/g, 'vec(D)'],
    [/J⃗/g, 'vec(J)'],
    [/P⃗/g, 'vec(P)'],
    [/M⃗/g, 'vec(M)'],
    [/F⃗/g, 'vec(F)'],
    [/k⃗/g, 'vec(k)'],
    [/∇·/g, 'div '],
    [/∇×/g, 'curl '],
    [/∇²/g, 'del^2 '],
    [/⃗/g, '']
  ];
  let out = String(v || '');
  fixes.forEach(([pattern, replacement]) => {
    out = out.replace(pattern, replacement);
  });
  out = Array.from(out).map(ch => superMap[ch] ?? subMap[ch] ?? ch).join('');
  return out
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[·•]/g, '.')
    .replace(/[øðþæ]/g, m => ({'ø':'phi','ð':'d','þ':'th','æ':'ae'}[m] || m))
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getPaperQuestionText(q){
  return displayPdfText(q?.questionText||'');
}

function getPaperOptionText(opt){
  return displayPdfText(opt?.text||'');
}

function readFileAsDataUrl(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=reject;
    reader.readAsDataURL(file);
  });
}

function getPdfBrandingDraft(){
  const fallback = {
    instituteName:'',
    logoDataUrl:'',
    examDisplayName:String(examName || '').trim(),
    subtitle:''
  };
  const current = typeof normalizePdfBranding==='function'
    ? normalizePdfBranding(pdfBranding)
    : Object.assign({}, fallback, pdfBranding || {});
  if(!String(current.examDisplayName || '').trim()) current.examDisplayName = fallback.examDisplayName;
  return current;
}

function setPdfLogoPreview(dataUrl){
  const clean=String(dataUrl||'').trim();
  const hidden=document.getElementById('pdfLogoDataInput');
  const preview=document.getElementById('pdfLogoPreview');
  if(hidden) hidden.value=clean;
  if(preview){
    preview.innerHTML = clean
      ? `<img src="${escA(clean)}" alt="PDF logo preview" style="max-width:100%;max-height:72px;object-fit:contain;display:block;margin:auto">`
      : `<div class="modal-note" style="text-align:center;padding:18px 8px">No logo selected.</div>`;
  }
}

async function previewPdfBrandingLogoFromInput(input){
  const file=input?.files?.[0] || null;
  if(!file) return;
  try{
    const dataUrl=await readFileAsDataUrl(file);
    setPdfLogoPreview(dataUrl);
  }catch(_){
    toast('Logo image could not be read');
  }
}

function clearPdfBrandingLogoSelection(){
  const input=document.getElementById('pdfLogoInput');
  if(input) input.value='';
  setPdfLogoPreview('');
}

function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||''));
    reader.onerror=reject;
    reader.readAsText(file);
  });
}

function sanitizePdfWatermarkSvg(svg){
  const text=String(svg||'').replace(/^\s*<\?xml[\s\S]*?\?>\s*/i,'');
  if(!/^\s*<svg[\s>]/i.test(text)) return '';
  if(/<script[\s>]|<foreignObject[\s>]|javascript\s*:|\son[a-z]+\s*=/i.test(text)) return '';
  return text;
}

function svgTextToDataUrl(svg){
  const clean=sanitizePdfWatermarkSvg(svg);
  if(!clean) return '';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clean);
}

function decodePdfWatermarkSvgDataUrl(dataUrl){
  const raw=String(dataUrl||'').trim();
  if(!/^data:image\/svg\+xml/i.test(raw)) return '';
  const comma=raw.indexOf(',');
  if(comma<0) return '';
  try{
    const meta=raw.slice(0,comma);
    const body=raw.slice(comma+1);
    return /;base64/i.test(meta) ? decodeURIComponent(escape(atob(body))) : decodeURIComponent(body);
  }catch(_){
    try{ return atob(raw.slice(comma+1)); }catch(__){ return ''; }
  }
}

function extractPdfWatermarkSvgFromJsonObject(value, seen=new Set()){
  if(!value || typeof value!=='object' || seen.has(value)) return '';
  seen.add(value);
  for(const key of ['svg','sourceSvg','svgMarkup','markup']){
    const svg=sanitizePdfWatermarkSvg(value[key]);
    if(svg) return svg;
  }
  for(const key of ['dataUrl','src','image']){
    const svg=sanitizePdfWatermarkSvg(decodePdfWatermarkSvgDataUrl(value[key]));
    if(svg) return svg;
  }
  for(const child of Object.values(value)){
    const found=Array.isArray(child)
      ? child.map(item=>extractPdfWatermarkSvgFromJsonObject(item, seen)).find(Boolean)
      : extractPdfWatermarkSvgFromJsonObject(child, seen);
    if(found) return found;
  }
  return '';
}

function extractPdfWatermarkSvgText(text){
  const raw=String(text||'').trim();
  const direct=sanitizePdfWatermarkSvg(raw);
  if(direct) return direct;
  const fromData=sanitizePdfWatermarkSvg(decodePdfWatermarkSvgDataUrl(raw));
  if(fromData) return fromData;
  try{
    return extractPdfWatermarkSvgFromJsonObject(JSON.parse(raw));
  }catch(_){
    return '';
  }
}

function rasterizePdfWatermarkSvg(svg, maxW=6400, maxH=6400){
  const clean=sanitizePdfWatermarkSvg(svg);
  if(!clean) return Promise.resolve('');
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const srcW=img.naturalWidth||img.width||900;
        const srcH=img.naturalHeight||img.height||900;
        const scale=Math.min(maxW/Math.max(1,srcW), maxH/Math.max(1,srcH));
        const canvas=document.createElement('canvas');
        canvas.width=Math.max(1, Math.round(srcW*scale));
        canvas.height=Math.max(1, Math.round(srcH*scale));
        const ctx=canvas.getContext('2d');
        ctx.clearRect(0,0,canvas.width,canvas.height);
        ctx.drawImage(img,0,0,canvas.width,canvas.height);
        resolve(canvas.toDataURL('image/png'));
      }catch(_){ resolve(''); }
    };
    img.onerror=()=>resolve('');
    img.src=svgTextToDataUrl(clean);
  });
}

function setPdfWatermarkAssetPreview(svgText='', imageDataUrl=''){
  const preview=document.getElementById('wmAssetPreview');
  const svgHidden=document.getElementById('wmVectorSvgInput');
  const imageHidden=document.getElementById('wmImageDataInput');
  const cleanSvg=sanitizePdfWatermarkSvg(svgText);
  const cleanImage=String(imageDataUrl||'').trim();
  if(svgHidden) svgHidden.value=cleanSvg;
  if(imageHidden) imageHidden.value=cleanImage;
  if(!preview) return;
  if(cleanSvg){
    preview.innerHTML=`<div style="max-width:100%;max-height:96px;overflow:hidden">${cleanSvg}</div>`;
  }else if(cleanImage){
    preview.innerHTML=`<img src="${escA(cleanImage)}" alt="Watermark preview" style="max-width:100%;max-height:96px;object-fit:contain;display:block;margin:auto">`;
  }else{
    preview.innerHTML='<div class="modal-note" style="text-align:center;padding:22px 8px">No watermark asset selected.</div>';
  }
  refreshPdfWatermarkDesigner();
}

async function previewPdfWatermarkAssetFromInput(input){
  const file=input?.files?.[0] || null;
  if(!file) return;
  try{
    if(/(?:svg|json|qs-symbol)$/i.test(file.name) || /(?:svg|json)/i.test(file.type)){
      const text=await readFileAsText(file);
      const svg=extractPdfWatermarkSvgText(text);
      if(!svg){ toast('No safe SVG found in that watermark file'); return; }
      const png=await rasterizePdfWatermarkSvg(svg);
      setPdfWatermarkAssetPreview(svg, png);
      return;
    }
    const dataUrl=await readFileAsDataUrl(file);
    setPdfWatermarkAssetPreview('', dataUrl);
  }catch(_){
    toast('Watermark asset could not be read');
  }
}

function clearPdfWatermarkAssetSelection(){
  const input=document.getElementById('wmAssetInput');
  if(input) input.value='';
  setPdfWatermarkAssetPreview('', '');
}

function getPdfWatermarkControlNumber(id, fallback, min=-Infinity, max=Infinity){
  const raw=document.getElementById(id)?.value;
  const n=Number(raw);
  const value=Number.isFinite(n) ? n : fallback;
  return Math.max(min, Math.min(max, value));
}

function setPdfWatermarkControlNumber(id, value){
  const el=document.getElementById(id);
  if(el) el.value=String(Math.round(value * 10) / 10);
}

function getPdfWatermarkTextStyleFromControls(){
  return {
    fontSize:getPdfWatermarkControlNumber('wmTextSizeInput', 22, 6, 140),
    fontFamily:String(document.getElementById('wmTextFontInput')?.value || 'Times New Roman'),
    color:String(document.getElementById('wmTextColorInput')?.value || '#111111'),
    bold:!!document.getElementById('wmTextBoldInput')?.checked,
    italic:!!document.getElementById('wmTextItalicInput')?.checked,
    underline:!!document.getElementById('wmTextUnderlineInput')?.checked
  };
}

let pdfWatermarkDesignerLayers=[];
let pdfWatermarkDesignerSelectedId='';
let pdfWatermarkDesignerSeq=1;
let pdfSheetTemplateLayout=null;

function newPdfWatermarkLayerId(){
  return 'wl_'+Date.now().toString(36)+'_'+(pdfWatermarkDesignerSeq++).toString(36);
}

function getSelectedPdfWatermarkLayer(){
  return pdfWatermarkDesignerLayers.find(layer=>layer.id===pdfWatermarkDesignerSelectedId) || null;
}

function getPdfWatermarkAssetControls(){
  return {
    xPct:getPdfWatermarkControlNumber('wmXPctInput', 50, 0, 100),
    yPct:getPdfWatermarkControlNumber('wmYPctInput', 54, 0, 100),
    widthPct:getPdfWatermarkControlNumber('wmWidthPctInput', 74, 5, 220),
    opacity:getPdfWatermarkControlNumber('wmOpacityInput', 13, 1, 100) / 100,
    angle:getPdfWatermarkControlNumber('wmAssetAngleInput', 0, -180, 180)
  };
}

function getPdfWatermarkTextControls(){
  return {
    xPct:getPdfWatermarkControlNumber('wmTextXPctInput', 24, 0, 100),
    yPct:getPdfWatermarkControlNumber('wmTextYPctInput', 95, 0, 100),
    opacity:getPdfWatermarkControlNumber('wmTextOpacityInput', 100, 1, 100) / 100,
    angle:getPdfWatermarkControlNumber('wmTextAngleInput', 0, -180, 180),
    text:String(document.getElementById('wmTextInput')?.value || '').trim(),
    style:getPdfWatermarkTextStyleFromControls()
  };
}

function applyPdfWatermarkControlsToSelected(){
  const layer=getSelectedPdfWatermarkLayer();
  if(!layer) return;
  if(layer.type==='text'){
    const values=getPdfWatermarkTextControls();
    layer.text=values.text || layer.text || 'Text';
    layer.xPct=values.xPct;
    layer.yPct=values.yPct;
    layer.opacity=values.opacity;
    layer.angle=values.angle;
    layer.style=values.style;
  }else{
    const values=getPdfWatermarkAssetControls();
    layer.xPct=values.xPct;
    layer.yPct=values.yPct;
    layer.widthPct=values.widthPct;
    layer.opacity=values.opacity;
    layer.angle=values.angle;
  }
}

function loadPdfWatermarkLayerIntoControls(layer){
  if(!layer) return;
  if(layer.type==='text'){
    const style=layer.style || {};
    const setChecked=(id,value)=>{ const el=document.getElementById(id); if(el) el.checked=!!value; };
    const setValue=(id,value)=>{ const el=document.getElementById(id); if(el) el.value=String(value ?? ''); };
    setValue('wmTextInput', layer.text || '');
    setValue('wmTextXPctInput', layer.xPct ?? 24);
    setValue('wmTextYPctInput', layer.yPct ?? 95);
    setValue('wmTextOpacityInput', Math.round((+(layer.opacity ?? 1))*100));
    setValue('wmTextAngleInput', layer.angle ?? 0);
    setValue('wmTextSizeInput', style.fontSize ?? 11);
    setValue('wmTextFontInput', style.fontFamily || 'Times New Roman');
    setValue('wmTextColorInput', style.color || '#cc0000');
    setChecked('wmTextBoldInput', style.bold);
    setChecked('wmTextItalicInput', style.italic);
    setChecked('wmTextUnderlineInput', style.underline);
  }else{
    const setValue=(id,value)=>{ const el=document.getElementById(id); if(el) el.value=String(value ?? ''); };
    setValue('wmXPctInput', layer.xPct ?? 50);
    setValue('wmYPctInput', layer.yPct ?? 54);
    setValue('wmWidthPctInput', layer.widthPct ?? 74);
    setValue('wmOpacityInput', Math.round((+(layer.opacity ?? .13))*100));
    setValue('wmAssetAngleInput', layer.angle ?? 0);
  }
}

function renderPdfWatermarkLayerList(){
  const list=document.getElementById('wmLayerList');
  if(!list) return;
  if(!pdfWatermarkDesignerLayers.length){
    list.innerHTML='<div class="modal-note" style="padding:8px">No white-label layers yet.</div>';
    return;
  }
  list.innerHTML=pdfWatermarkDesignerLayers.map((layer,idx)=>{
    const name=layer.type==='text'
      ? (layer.text || 'Text layer')
      : (layer.svg ? 'SVG/vector asset' : 'Image asset');
    return `<button class="wm-layer-row ${layer.id===pdfWatermarkDesignerSelectedId?'active':''}" type="button" data-layer-id="${escA(layer.id)}">
      <span>${idx+1}. ${escH(name).slice(0,60)}</span><small>${escH(layer.type)}</small>
    </button>`;
  }).join('');
  list.querySelectorAll('.wm-layer-row').forEach(btn=>{
    btn.onclick=()=>{
      pdfWatermarkDesignerSelectedId=btn.dataset.layerId || '';
      loadPdfWatermarkLayerIntoControls(getSelectedPdfWatermarkLayer());
      refreshPdfWatermarkDesigner(false);
    };
  });
}

function refreshPdfWatermarkDesigner(){
  const frame=document.getElementById('wmDesignerPage');
  if(!frame) return;
  applyPdfWatermarkControlsToSelected();
  frame.querySelectorAll('.wm-dynamic-layer').forEach(node=>node.remove());
  pdfWatermarkDesignerLayers.forEach(layer=>{
    const node=document.createElement('div');
    node.className='wm-layer wm-dynamic-layer'+(layer.id===pdfWatermarkDesignerSelectedId?' active':'');
    node.dataset.layerId=layer.id;
    node.style.left=(layer.xPct ?? 50)+'%';
    node.style.top=(layer.yPct ?? 50)+'%';
    node.style.opacity=String(layer.opacity ?? 1);
    node.style.transform=`rotate(${layer.angle || 0}deg)`;
    node.style.transformOrigin='0 0';
    if(layer.type==='text'){
      const style=layer.style || {};
      node.className+=' wm-designer-text';
      node.textContent=layer.text || 'Text';
      node.style.fontSize=(style.fontSize || 11)+'px';
      node.style.fontFamily=style.fontFamily || 'Times New Roman';
      node.style.color=style.color || '#cc0000';
      node.style.fontWeight=style.bold ? '700' : '400';
      node.style.fontStyle=style.italic ? 'italic' : 'normal';
      node.style.textDecoration=style.underline ? 'underline' : 'none';
    }else{
      node.style.width=(layer.widthPct || 40)+'%';
      node.innerHTML=layer.svg ? `<div class="wm-designer-svg">${layer.svg}</div>` : `<img src="${escA(layer.image || '')}" alt="">`;
    }
    frame.appendChild(node);
  });
  renderPdfWatermarkLayerList();
}

function bindPdfWatermarkDesignerDrag(){
  const frame=document.getElementById('wmDesignerPage');
  if(!frame || frame.dataset.dragReady==='1') return;
  frame.dataset.dragReady='1';
  frame.addEventListener('pointerdown', (ev)=>{
    const layerNode=ev.target.closest?.('.wm-dynamic-layer');
    if(!layerNode) return;
    const layer=pdfWatermarkDesignerLayers.find(item=>item.id===layerNode.dataset.layerId);
    if(!layer) return;
    pdfWatermarkDesignerSelectedId=layer.id;
    loadPdfWatermarkLayerIntoControls(layer);
    refreshPdfWatermarkDesigner(false);
    ev.preventDefault();
    try{ frame.setPointerCapture(ev.pointerId); }catch(_){}
    const startX=ev.clientX;
    const startY=ev.clientY;
    const startLayerX=+(layer.xPct ?? 0);
    const startLayerY=+(layer.yPct ?? 0);
    const move=(event)=>{
      const rect=frame.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      const dx=((event.clientX-startX)/rect.width)*100;
      const dy=((event.clientY-startY)/rect.height)*100;
      layer.xPct=Math.max(0, Math.min(100, startLayerX+dx));
      layer.yPct=Math.max(0, Math.min(100, startLayerY+dy));
      loadPdfWatermarkLayerIntoControls(layer);
      refreshPdfWatermarkDesigner(false);
    };
    const up=(event)=>{
      move(event);
      frame.removeEventListener('pointermove', move);
      frame.removeEventListener('pointerup', up);
      frame.removeEventListener('pointercancel', up);
      try{ frame.releasePointerCapture(event.pointerId); }catch(_){}
    };
    frame.addEventListener('pointermove', move);
    frame.addEventListener('pointerup', up);
    frame.addEventListener('pointercancel', up);
  });
}

function addPdfWatermarkTextLayer(){
  const values=getPdfWatermarkTextControls();
  const layer={id:newPdfWatermarkLayerId(),type:'text',text:values.text || 'Text',xPct:values.xPct,yPct:values.yPct,opacity:values.opacity,angle:values.angle,style:values.style};
  pdfWatermarkDesignerLayers.push(layer);
  pdfWatermarkDesignerSelectedId=layer.id;
  refreshPdfWatermarkDesigner(false);
}

function addPdfWatermarkAssetLayer(){
  const svg=String(document.getElementById('wmVectorSvgInput')?.value || '').trim();
  const image=String(document.getElementById('wmImageDataInput')?.value || '').trim();
  if(!svg && !image){ toast('Import an asset first.'); return; }
  const values=getPdfWatermarkAssetControls();
  const layer={id:newPdfWatermarkLayerId(),type:svg?'svg':'image',svg,image,xPct:values.xPct,yPct:values.yPct,widthPct:values.widthPct,opacity:values.opacity,angle:values.angle};
  pdfWatermarkDesignerLayers.push(layer);
  pdfWatermarkDesignerSelectedId=layer.id;
  refreshPdfWatermarkDesigner(false);
}

function deletePdfWatermarkSelectedLayer(){
  if(!pdfWatermarkDesignerSelectedId) return;
  const idx=pdfWatermarkDesignerLayers.findIndex(layer=>layer.id===pdfWatermarkDesignerSelectedId);
  if(idx<0) return;
  pdfWatermarkDesignerLayers.splice(idx,1);
  pdfWatermarkDesignerSelectedId=pdfWatermarkDesignerLayers[Math.min(idx, pdfWatermarkDesignerLayers.length-1)]?.id || '';
  loadPdfWatermarkLayerIntoControls(getSelectedPdfWatermarkLayer());
  refreshPdfWatermarkDesigner(false);
}

function movePdfWatermarkSelectedLayer(delta){
  const idx=pdfWatermarkDesignerLayers.findIndex(layer=>layer.id===pdfWatermarkDesignerSelectedId);
  const next=idx+delta;
  if(idx<0 || next<0 || next>=pdfWatermarkDesignerLayers.length) return;
  const [layer]=pdfWatermarkDesignerLayers.splice(idx,1);
  pdfWatermarkDesignerLayers.splice(next,0,layer);
  refreshPdfWatermarkDesigner(false);
}

function getPdfWatermarkSelectedNodeSizePct(){
  const frame=document.getElementById('wmDesignerPage');
  const safeId=window.CSS?.escape ? window.CSS.escape(pdfWatermarkDesignerSelectedId) : String(pdfWatermarkDesignerSelectedId).replace(/"/g,'\\"');
  const node=frame?.querySelector(`.wm-dynamic-layer[data-layer-id="${safeId}"]`);
  const frameRect=frame?.getBoundingClientRect?.();
  const nodeRect=node?.getBoundingClientRect?.();
  if(!frameRect?.width || !frameRect?.height || !nodeRect?.width || !nodeRect?.height) return {w:12,h:6};
  return {w:(nodeRect.width/frameRect.width)*100,h:(nodeRect.height/frameRect.height)*100};
}

function setPdfWatermarkLayerControlValue(id, value){
  const el=document.getElementById(id);
  if(el) el.value=String(Math.round(value*10)/10);
}

function alignPdfWatermarkSelectedLayer(mode){
  const layer=getSelectedPdfWatermarkLayer();
  if(!layer) return;
  applyPdfWatermarkControlsToSelected();
  const margin=Math.max(0, Math.min(50, getPdfWatermarkControlNumber('wmAlignMarginInput', 4, 0, 50)));
  const size=getPdfWatermarkSelectedNodeSizePct();
  if(mode==='left') layer.xPct=margin;
  if(mode==='right') layer.xPct=Math.max(0, 100-size.w-margin);
  if(mode==='top') layer.yPct=margin;
  if(mode==='bottom') layer.yPct=Math.max(0, 100-size.h-margin);
  if(mode==='centerH' || mode==='centerBoth') layer.xPct=Math.max(0, (100-size.w)/2);
  if(mode==='centerV' || mode==='centerBoth') layer.yPct=Math.max(0, (100-size.h)/2);
  loadPdfWatermarkLayerIntoControls(layer);
  refreshPdfWatermarkDesigner(false);
}

function resizePdfWatermarkSelectedLayer(action){
  const layer=getSelectedPdfWatermarkLayer();
  if(!layer) return;
  applyPdfWatermarkControlsToSelected();
  if(layer.type==='text'){
    layer.style=layer.style || {};
    const current=Math.max(6, Math.min(140, +(layer.style.fontSize ?? 11)));
    const next=action==='larger' ? current*1.12 : action==='smaller' ? current/1.12 : current;
    layer.style.fontSize=Math.max(6, Math.min(140, Math.round(next)));
  }else{
    const current=Math.max(5, Math.min(220, +(layer.widthPct ?? 40)));
    const next=action==='larger' ? current*1.12 : action==='smaller' ? current/1.12 : action==='fitWide' ? 92 : current;
    layer.widthPct=Math.max(5, Math.min(220, Math.round(next*10)/10));
  }
  loadPdfWatermarkLayerIntoControls(layer);
  refreshPdfWatermarkDesigner(false);
}

function collectPdfWatermarkDesignerLayers(){
  applyPdfWatermarkControlsToSelected();
  return pdfWatermarkDesignerLayers.map(layer=>JSON.parse(JSON.stringify(layer)));
}

function inferPdfSheetTemplateLayoutFromItems(items=[]){
  let topPct=12;
  let bottomPct=8;
  (Array.isArray(items) ? items : []).forEach(item=>{
    const kind=String(item?.kind || '');
    const x=+(item?.xPct || 0);
    const y=+(item?.yPct || 0);
    const w=+(item?.wPct || 0);
    const h=+(item?.hPct || 0);
    if(kind==='svg' && x<=.01 && y<=.01 && w>=.9 && h>=.9) return;
    if(y<.28) topPct=Math.max(topPct, (y+h)*100 + 3);
    if(y>.62) bottomPct=Math.max(bottomPct, (1-y)*100 + 2);
  });
  return {leftPct:12,rightPct:8,topPct:Math.max(0,Math.min(45,topPct)),bottomPct:Math.max(0,Math.min(35,bottomPct)),fitSource:true};
}

function normalizePdfSheetTemplateLayout(layout, items=[]){
  const inferred=inferPdfSheetTemplateLayoutFromItems(items);
  const src=layout || {};
  const num=(key,fallback,min,max)=>{
    const n=+(src[key] ?? fallback);
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : fallback));
  };
  return {
    leftPct:num('leftPct', inferred.leftPct, 0, 35),
    rightPct:num('rightPct', inferred.rightPct, 0, 35),
    topPct:num('topPct', inferred.topPct, 0, 45),
    bottomPct:num('bottomPct', inferred.bottomPct, 0, 35),
    fitSource:src.fitSource !== false
  };
}

function collectPdfSheetTemplateLayout(){
  return pdfSheetTemplateLayout ? JSON.parse(JSON.stringify(pdfSheetTemplateLayout)) : null;
}

function resolvePdfSheetTextTokens(text, pageNo=1, totalPages=1){
  return String(text || '')
    .replace(/\{page\}/gi, String(pageNo))
    .replace(/\{total\}/gi, String(totalPages));
}

function getPdfSheetTemplateLayers(settings={}){
  if(Array.isArray(settings?.sheetTemplateLayers)) return settings.sheetTemplateLayers;
  if(Array.isArray(settings?.whiteLabelLayers)) return settings.whiteLabelLayers;
  return [];
}

async function importPdfSheetTemplateJsonFromInput(input){
  const file=input?.files?.[0] || null;
  if(!file) return;
  try{
    const raw=await readFileAsText(file);
    const template=JSON.parse(raw);
    if(template?.schema!=='qs-sheet-template-v1') throw new Error('Not a QS Studio page layout JSON file.');
    const assets=template.assets || {};
    const controls=template.controls || {};
    const svg=sanitizePdfWatermarkSvg(assets.svgMarkup || '');
    const svgImage=svg ? await rasterizePdfWatermarkSvg(svg) : '';
    const watermarkImage=String(assets.watermarkImageDataUrl || '').trim();
    const logoImage=String(assets.logoDataUrl || '').trim();
    let items=Array.isArray(template.items) ? [...template.items] : [];
    pdfSheetTemplateLayout=normalizePdfSheetTemplateLayout(template.contentBox, items);
    if(controls.pageNumEnable && !items.some(item=>String(item?.kind || '')==='pageNumber')){
      items.push({
        kind:'pageNumber',
        xPct:.4,
        yPct:.945,
        wPct:.2,
        hPct:.035,
        opacity:controls.pageNumOpacity ?? .85,
        z:999,
        text:controls.pageNumFormat || '{page}',
        format:controls.pageNumFormat || '{page}',
        fontPx:controls.pageNumSize || 11,
        color:controls.pageNumColor || '#111111',
        bold:!!controls.pageNumBold,
        italic:!!controls.pageNumItalic,
        underline:!!controls.pageNumUnderline,
        align:'center'
      });
    }
    const layers=[];
    items.forEach(item=>{
      const kind=String(item?.kind || '');
      const base={
        id:newPdfWatermarkLayerId(),
        xPct:Math.max(0, Math.min(100, +(item.xPct || 0)*100)),
        yPct:Math.max(0, Math.min(100, +(item.yPct || 0)*100)),
        widthPct:Math.max(5, Math.min(220, +(item.wPct || .2)*100)),
        heightPct:Math.max(1, Math.min(220, +(item.hPct || .08)*100)),
        opacity:Math.max(.01, Math.min(1, +(item.opacity ?? 1))),
        angle:Math.max(-180, Math.min(180, +(item.rotate || 0))),
        strength:Math.max(1, Math.min(4, +(item.strength || 1)))
      };
      if(kind==='svg' && (svg || svgImage)){
        layers.push({...base,type:'svg',svg,image:svgImage});
      }else if(kind==='image' && /^data:image\//i.test(watermarkImage)){
        layers.push({...base,type:'image',image:watermarkImage});
      }else if(kind==='logo' && /^data:image\//i.test(logoImage)){
        layers.push({...base,type:'image',image:logoImage,angle:0});
      }else if(['topText','bottomText','pageNumber'].includes(kind)){
        const text=kind==='pageNumber' ? String(item.format || controls.pageNumFormat || '{page}') : String(item.text || '');
        if(text.trim()){
          layers.push({
            ...base,
            type:'text',
            text,
            angle:0,
            align:String(item.align || 'center'),
            style:{
              fontSize:Math.max(6, Math.min(140, +(item.fontPx || 11))),
              fontFamily:'Times New Roman',
              color:String(item.color || '#111111'),
              bold:!!item.bold,
              italic:!!item.italic,
              underline:!!item.underline
            }
          });
        }
      }
    });
    pdfWatermarkDesignerLayers=layers;
    pdfWatermarkDesignerSelectedId=layers[0]?.id || '';
    loadPdfWatermarkLayerIntoControls(getSelectedPdfWatermarkLayer());
    refreshPdfWatermarkDesigner(false);
    const templateStatus=document.getElementById('wmTemplateOnlyStatus');
    if(templateStatus){
      templateStatus.textContent=`Page layout loaded with ${layers.length} locked layer${layers.length===1?'':'s'}. It will be applied to every page.`;
    }
    toast(`Loaded page layout JSON (${layers.length} layer${layers.length===1?'':'s'}).`);
  }catch(err){
    console.error(err);
    showNotice(err?.message || 'Page layout JSON could not be loaded.', 'Page Layout JSON');
  }finally{
    if(input) input.value='';
  }
}

function initPdfWatermarkDesigner(){
  pdfWatermarkDesignerLayers=[];
  pdfWatermarkDesignerSelectedId='';
  pdfSheetTemplateLayout=null;
  const ids=[
    'wmTextInput','wmXPctInput','wmYPctInput','wmWidthPctInput','wmOpacityInput','wmAssetAngleInput',
    'wmTextXPctInput','wmTextYPctInput','wmTextOpacityInput','wmTextAngleInput','wmTextSizeInput',
    'wmTextFontInput','wmTextColorInput','wmTextBoldInput','wmTextItalicInput','wmTextUnderlineInput'
  ];
  ids.forEach(id=>{
    const el=document.getElementById(id);
    if(el && el.dataset.wmDesignerReady!=='1'){
      el.dataset.wmDesignerReady='1';
      el.addEventListener('input', ()=>refreshPdfWatermarkDesigner(true));
      el.addEventListener('change', ()=>refreshPdfWatermarkDesigner(true));
    }
  });
  bindPdfWatermarkDesignerDrag();
  refreshPdfWatermarkDesigner(false);
}

function getPdfSectionKey(meta){
  return [meta?.short || '', meta?.section || '', meta?.full || ''].join('|');
}

function getAvailablePdfSections(){
  const map=new Map();
  (qs||[]).forEach(q=>{
    const meta=getSubjectMeta(q.subject);
    const key=getPdfSectionKey(meta);
    if(!map.has(key)) map.set(key,{key,meta,count:0,totalMarks:0});
    const item=map.get(key);
    item.count++;
    item.totalMarks += +(q.marks || 0);
  });
  return [...map.values()];
}

function getPdfPublishingDraft(){
  const current = typeof normalizePdfPublishing==='function'
    ? normalizePdfPublishing(pdfPublishing)
    : {markOrder:'source',sections:[]};
  const byKey=new Map((current.sections||[]).map(item=>[item.key,item]));
  const sections=getAvailablePdfSections().map((section, idx)=>{
    const saved=byKey.get(section.key);
    return {
      ...section,
      enabled:saved ? saved.enabled !== false : true,
      priority:Math.max(1, Math.round(+saved?.priority || idx+1))
    };
  });
  return { markOrder:current.markOrder || 'source', sections };
}

function renderPdfPublishingRows(draft){
  const sections=Array.isArray(draft?.sections) ? draft.sections : [];
  if(!sections.length) return '<div class="modal-note">No sections found yet.</div>';
  const max=Math.max(1, sections.length);
  const priorityOptions=(value)=>Array.from({length:max},(_,idx)=>{
    const n=idx+1;
    return `<option value="${n}" ${n===value?'selected':''}>Priority ${n}</option>`;
  }).join('');
  return `
    <div style="display:grid;gap:7px">
      ${sections.map((section,idx)=>{
        const meta=section.meta || {};
        const name=`${meta.full || 'Section'} (${meta.short || '-'}) - ${getSectionDisplay(meta)}`;
        return `
          <div style="display:grid;grid-template-columns:28px 1fr 128px;gap:8px;align-items:center;border:1px solid var(--border);border-radius:8px;background:#fff;padding:7px 9px">
            <input id="pdfSectionEnabled_${idx}" type="checkbox" ${section.enabled?'checked':''} title="Include this section">
            <div>
              <div style="font-weight:800;color:#10294d">${escH(name)}</div>
              <div class="modal-note">${section.count} question${section.count===1?'':'s'} | ${section.totalMarks} marks</div>
              <input id="pdfSectionKey_${idx}" type="hidden" value="${escA(section.key)}">
            </div>
            <select id="pdfSectionPriority_${idx}">${priorityOptions(Math.max(1, Math.min(max, Math.round(+section.priority || idx+1))))}</select>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function collectPdfPublishingFromModal(){
  const draft=getPdfPublishingDraft();
  const sections=draft.sections.map((section,idx)=>({
    key:document.getElementById(`pdfSectionKey_${idx}`)?.value || section.key,
    enabled:!!document.getElementById(`pdfSectionEnabled_${idx}`)?.checked,
    priority:Math.max(1, Math.round(+document.getElementById(`pdfSectionPriority_${idx}`)?.value || idx+1))
  }));
  if(sections.length && !sections.some(section=>section.enabled)){
    sections.forEach(section=>{ section.enabled=true; });
    toast('All sections were unchecked, so all sections were kept for safety.');
  }
  return typeof normalizePdfPublishing==='function' ? normalizePdfPublishing({
    markOrder:document.getElementById('pdfMarkOrderInput')?.value || 'source',
    sections
  }) : {
    markOrder:document.getElementById('pdfMarkOrderInput')?.value || 'source',
    sections
  };
}

function openTemplateOnlyPdfExportModal(kind){
  const isSelectablePdf=kind==='selectable' || kind==='selectable-clean';
  const label=kind==='key'
    ? 'Key PDF'
    : kind==='bank'
      ? 'Paper PDF'
      : kind==='selectable-clean'
        ? 'cleantheam PDF'
        : 'Text PDF';
  pdfWatermarkDesignerLayers=[];
  pdfWatermarkDesignerSelectedId='';
  pdfSheetTemplateLayout=null;
  const brand=getPdfBrandingDraft();
  const publishing=getPdfPublishingDraft();
  openModal({
    title:`${label} Export`,
    subtitle:isSelectablePdf ? 'Load a saved page-layout JSON, then open the selectable text PDF print surface.' : 'Load a saved page-layout JSON, or download directly with no page layout.',
    closable:true,
    body:`
      <div class="sec-lbl">Page Layout JSON</div>
      <div class="modal-note">This is now the only watermark/white-label input in the web export path. The page layout is drawn first, then the question paper is printed on top inside its saved content area. Text PDF and cleantheam keep real selectable text.</div>
      <div class="modal-grid" style="margin-top:10px">
        <div class="field" style="grid-column:1/-1">
          <label>Load Saved Page Layout JSON</label>
          <input id="wmSheetTemplateJsonInput" type="file" accept=".json,application/json" onchange="importPdfSheetTemplateJsonFromInput(this)">
          <div class="modal-note" id="wmTemplateOnlyStatus">${isSelectablePdf ? 'No page layout loaded. Export will open a plain selectable text print surface.' : 'No page layout loaded. Export will download a plain PDF.'}</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn pri" type="button" id="wmContinueBtn">${isSelectablePdf ? 'Open' : 'Download'} ${escH(label)}</button>
        <button class="btn" type="button" onclick="closeModal()">Cancel</button>
      </div>
    `
  });
  const btn=document.getElementById('wmContinueBtn');
  const status=document.getElementById('wmTemplateOnlyStatus');
  const input=document.getElementById('wmSheetTemplateJsonInput');
  if(input){
    input.addEventListener('change',()=>{
      window.setTimeout(()=>{
        if(status){
          const count=pdfWatermarkDesignerLayers.length;
          status.textContent=count
            ? `Page layout loaded with ${count} locked layer${count===1?'':'s'}. It will be applied to every page.`
            : (isSelectablePdf ? 'No page layout loaded. Export will open a plain selectable text print surface.' : 'No page layout loaded. Export will download a plain PDF.');
        }
      }, 350);
    });
  }
  if(btn) btn.onclick=()=>{
    const nextBrand=typeof normalizePdfBranding==='function' ? normalizePdfBranding(brand) : brand;
    const nextPublishing=typeof normalizePdfPublishing==='function' ? normalizePdfPublishing(publishing) : publishing;
    pdfBranding=nextBrand;
    pdfPublishing=nextPublishing;
    const sheetTemplateLayers=pdfWatermarkDesignerLayers.map(layer=>JSON.parse(JSON.stringify(layer)));
    const sheetTemplateLayout=collectPdfSheetTemplateLayout();
    const wm={
      text:'',
      image:'',
      vectorSvg:'',
      placement:{},
      textPlacement:{},
      textStyle:{},
      whiteLabelLayers:sheetTemplateLayers,
      sheetTemplateLayers,
      sheetTemplateLayout,
      branding:nextBrand,
      publishing:nextPublishing,
      theme:kind==='selectable-clean'?'cleantheam':'boxed'
    };
    closeModal();
    const job=()=> kind==='key'
      ? exportAnsKeyPDF(wm)
      : isSelectablePdf
        ? exportPaperSelectablePDF(wm)
        : exportPaperPDFTextOnly(wm);
    if(typeof runExportJob==='function'){
      runExportJob(label, job, {
        message:isSelectablePdf ? 'Call registered. Opening selectable text print surface...' : 'Call registered. Building direct PDF download...',
        working:isSelectablePdf ? 'Preparing real selectable text PDF...' : 'Rendering PDF pages...'
      });
    }else{
      job();
    }
  };
}

function askWatermarkThen(kind){
  if(!qs.length){showNotice('No questions available to export.', kind==='key'?'Answer Key PDF':'Paper PDF');return;}
  openTemplateOnlyPdfExportModal(kind);
  return;
  const brand=getPdfBrandingDraft();
  const publishing=getPdfPublishingDraft();
  openModal({
    title:'PDF Export Settings',
    subtitle:'Header branding is saved with this question bank. Watermark applies only to this PDF export.',
    closable:true,
    body:`
      <div class="sec-lbl">Header Branding</div>
      <div class="modal-grid">
        <div class="field">
          <label>Institute Name</label>
          <input id="pdfInstituteInput" type="text" value="${escA(brand.instituteName)}" placeholder="e.g. ABC Institute">
        </div>
        <div class="field">
          <label>Exam Name</label>
          <input id="pdfExamNameInput" type="text" value="${escA(brand.examDisplayName)}" placeholder="${escA(examName || 'Untitled Project')}">
        </div>
        <div class="field" style="grid-column:1/-1">
          <label>Subtitle / Header Note</label>
          <input id="pdfSubtitleInput" type="text" value="${escA(brand.subtitle)}" placeholder="e.g. Mock Test Series - Set 01">
        </div>
        <div class="field">
          <label>Institute Logo</label>
          <input id="pdfLogoInput" type="file" accept="image/*" onchange="previewPdfBrandingLogoFromInput(this)">
          <input id="pdfLogoDataInput" type="hidden" value="${escA(brand.logoDataUrl)}">
        </div>
        <div class="field">
          <label>Logo Preview</label>
          <div id="pdfLogoPreview" style="min-height:78px;border:1px dashed var(--border2);border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden"></div>
          <button class="btn" type="button" style="margin-top:6px" onclick="clearPdfBrandingLogoSelection()">Clear Logo</button>
        </div>
      </div>
      <div class="sec-lbl" style="margin-top:14px">Publishing Order</div>
      <div class="modal-note">Choose which sections appear in the PDF and their priority. Then choose whether lower-mark or higher-mark questions come first inside each section.</div>
      <div style="margin-top:8px">${renderPdfPublishingRows(publishing)}</div>
      <div class="modal-grid" style="margin-top:8px">
        <div class="field" style="grid-column:1/-1">
          <label>Question Order Inside Each Section</label>
          <select id="pdfMarkOrderInput">
            <option value="source" ${publishing.markOrder==='source'?'selected':''}>Keep editor order</option>
            <option value="asc" ${publishing.markOrder==='asc'?'selected':''}>1 mark first, then 2 marks / higher marks</option>
            <option value="desc" ${publishing.markOrder==='desc'?'selected':''}>2 marks / higher marks first, then 1 mark</option>
          </select>
        </div>
      </div>
      <style>
        .modal-card:has(.pdf-watermark-designer){width:min(1320px,96vw);max-height:94vh}
        .pdf-watermark-designer{display:grid;grid-template-columns:minmax(420px,1fr) 360px;gap:14px;align-items:start}
        .wm-designer-page-wrap{background:#dce9f8;border:1px solid var(--border2);border-radius:8px;padding:12px;overflow:auto;max-height:72vh}
        .wm-designer-page{position:relative;width:min(100%,620px);aspect-ratio:210/297;margin:0 auto;background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.18);overflow:hidden;touch-action:none}
        .wm-designer-content{position:absolute;left:11.9%;right:11.9%;top:11.4%;bottom:8.5%;font:13px/1.45 "Times New Roman",serif;color:#222;pointer-events:none}
        .wm-designer-q{display:grid;grid-template-columns:42px 1fr;gap:0}
        .wm-designer-qnum{font-weight:400}
        .wm-designer-lines span{display:block;height:11px;background:linear-gradient(90deg,rgba(0,0,0,.34),rgba(0,0,0,.12));border-radius:999px;margin:0 0 10px}
        .wm-layer{position:absolute;z-index:3;cursor:grab;user-select:none;touch-action:none;text-align:center;transform-origin:center center}
        .wm-layer:active{cursor:grabbing}
        .wm-layer img,.wm-designer-svg svg{display:block;width:100%;height:auto;max-height:100%;object-fit:contain;pointer-events:none}
        .wm-dynamic-layer.active{outline:2px solid #1b65c9;outline-offset:3px}
        .wm-designer-text{white-space:pre;min-width:20px;padding:2px 4px;border:1px dashed rgba(19,83,171,.38);border-radius:3px}
        .wm-layer-list{display:grid;gap:6px;max-height:144px;overflow:auto;border:1px solid var(--border);border-radius:8px;background:#fff;padding:6px}
        .wm-layer-row{display:flex;align-items:center;justify-content:space-between;gap:8px;text-align:left;border:1px solid var(--border);border-radius:6px;background:#f7fbff;padding:7px 8px;color:var(--text);font:700 12px/1.2 var(--sans);cursor:pointer}
        .wm-layer-row.active{border-color:#1b65c9;background:#dcecff}
        .wm-layer-row small{font-weight:600;color:var(--muted);text-transform:uppercase;font-size:10px}
        .wm-control-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}
        @media (max-width:980px){.pdf-watermark-designer{grid-template-columns:1fr}.wm-designer-page-wrap{max-height:62vh}}
      </style>
      <div class="sec-lbl" style="margin-top:14px">Page Layout Designer</div>
      <div class="modal-note">Design the locked sheet layer here. Asset and text coordinates are kept as top-left page percentages and burned onto every exported page; text supports {page} and {total} tokens for jsPDF exports.</div>
      <div class="pdf-watermark-designer">
        <div class="wm-designer-page-wrap">
          <div class="wm-designer-page" id="wmDesignerPage">
            <div class="wm-layer" id="wmDesignerAssetLayer" style="display:none"></div>
            <div class="wm-layer wm-designer-text" id="wmDesignerTextLayer" style="display:none">Text</div>
            <div class="wm-designer-content">
              <div class="wm-designer-q">
                <div class="wm-designer-qnum">Q.1</div>
                <div class="wm-designer-lines">
                  <span style="width:72%"></span><span style="width:88%"></span><span style="width:64%"></span>
                  <span style="width:78%;margin-top:22px"></span><span style="width:52%"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div class="modal-grid" style="grid-template-columns:1fr;gap:9px">
            <div class="field">
              <label>Load Saved Page Layout JSON</label>
              <input id="wmSheetTemplateJsonInput" type="file" accept=".json,application/json" onchange="importPdfSheetTemplateJsonFromInput(this)">
              <div class="modal-note">Create page layouts in Page Layout PDF using a blank A4 sheet, save JSON, then load it here for Paper PDF, Text PDF, cleantheam, or Key PDF.</div>
            </div>
            <div class="field">
              <label>Sheet Asset</label>
              <input id="wmAssetInput" type="file" accept="image/*,.svg,.json,.qs-symbol" onchange="previewPdfWatermarkAssetFromInput(this)">
              <input id="wmVectorSvgInput" type="hidden" value="">
              <input id="wmImageDataInput" type="hidden" value="">
            </div>
            <div class="field">
              <label>Asset Preview</label>
              <div id="wmAssetPreview" style="min-height:88px;border:1px dashed var(--border2);border-radius:8px;background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden"></div>
              <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
                <button class="btn pri" type="button" onclick="addPdfWatermarkAssetLayer()">Add Asset Layer</button>
                <button class="btn" type="button" onclick="clearPdfWatermarkAssetSelection()">Clear Asset</button>
              </div>
            </div>
            <div class="field">
              <label>Asset Placement</label>
              <div class="wm-control-grid">
                <input id="wmXPctInput" type="number" min="0" max="100" step="1" value="50" title="Asset X percent">
                <input id="wmYPctInput" type="number" min="0" max="100" step="1" value="${kind==='selectable-clean'?'54':'52'}" title="Asset Y percent">
                <input id="wmWidthPctInput" type="number" min="5" max="220" step="1" value="${kind==='selectable-clean'?'74':'64'}" title="Asset width percent">
                <input id="wmOpacityInput" type="number" min="1" max="100" step="1" value="${kind==='selectable-clean'?'13':'10'}" title="Asset opacity percent">
                <input id="wmAssetAngleInput" type="number" min="-180" max="180" step="1" value="0" title="Asset angle">
              </div>
            </div>
            <div class="field">
              <label>Layers</label>
              <div id="wmLayerList" class="wm-layer-list"></div>
              <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
                <button class="btn" type="button" onclick="movePdfWatermarkSelectedLayer(-1)">Move Up</button>
                <button class="btn" type="button" onclick="movePdfWatermarkSelectedLayer(1)">Move Down</button>
                <button class="btn danger" type="button" onclick="deletePdfWatermarkSelectedLayer()">Delete</button>
              </div>
            </div>
            <div class="field">
              <label>Align / Resize Selected</label>
              <div class="wm-control-grid">
                <input id="wmAlignMarginInput" type="number" min="0" max="50" step="1" value="4" title="Alignment margin percent">
                <button class="btn" type="button" onclick="alignPdfWatermarkSelectedLayer('centerBoth')">Center</button>
                <button class="btn" type="button" onclick="alignPdfWatermarkSelectedLayer('left')">Left</button>
                <button class="btn" type="button" onclick="alignPdfWatermarkSelectedLayer('centerH')">Center H</button>
                <button class="btn" type="button" onclick="alignPdfWatermarkSelectedLayer('right')">Right</button>
                <button class="btn" type="button" onclick="alignPdfWatermarkSelectedLayer('top')">Top</button>
                <button class="btn" type="button" onclick="alignPdfWatermarkSelectedLayer('centerV')">Center V</button>
                <button class="btn" type="button" onclick="alignPdfWatermarkSelectedLayer('bottom')">Bottom</button>
                <button class="btn" type="button" onclick="resizePdfWatermarkSelectedLayer('smaller')">- Size</button>
                <button class="btn" type="button" onclick="resizePdfWatermarkSelectedLayer('larger')">+ Size</button>
                <button class="btn" type="button" onclick="resizePdfWatermarkSelectedLayer('fitWide')">Fit Wide</button>
              </div>
              <div class="modal-note" style="margin-top:6px">Pick a layer, then align it to the page or resize it. Asset width can go up to 220% for full-page vector burns.</div>
            </div>
          </div>
        </div>
      </div>
      <div class="sec-lbl" style="margin-top:14px">Text Box</div>
      <div class="modal-grid" style="margin-top:8px">
        <div class="field">
          <label>Text</label>
          <input id="wmTextInput" type="text" placeholder="e.g. Organizing Institute: IISc, Bengaluru">
          <button class="btn pri" type="button" style="margin-top:6px" onclick="addPdfWatermarkTextLayer()">Add Text Layer</button>
        </div>
        <div class="field">
          <label>Text Placement</label>
          <div class="wm-control-grid">
            <input id="wmTextXPctInput" type="number" min="0" max="100" step="1" value="24" title="Text X percent">
            <input id="wmTextYPctInput" type="number" min="0" max="100" step="1" value="95" title="Text Y percent">
            <input id="wmTextOpacityInput" type="number" min="1" max="100" step="1" value="100" title="Text opacity percent">
            <input id="wmTextAngleInput" type="number" min="-180" max="180" step="1" value="0" title="Text angle">
          </div>
        </div>
        <div class="field"><label>Font Size</label><input id="wmTextSizeInput" type="number" min="6" max="140" step="1" value="11"></div>
        <div class="field"><label>Font Family</label><select id="wmTextFontInput"><option>Arial</option><option selected>Times New Roman</option><option>Georgia</option><option>Cambria</option><option>Verdana</option></select></div>
        <div class="field"><label>Text Colour</label><input id="wmTextColorInput" type="color" value="#cc0000"></div>
        <div class="field">
          <label>Style</label>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding-top:5px">
            <label style="display:flex;gap:5px;align-items:center"><input id="wmTextBoldInput" type="checkbox"> Bold</label>
            <label style="display:flex;gap:5px;align-items:center"><input id="wmTextItalicInput" type="checkbox"> Italic</label>
            <label style="display:flex;gap:5px;align-items:center"><input id="wmTextUnderlineInput" type="checkbox"> Underline</label>
          </div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn pri" type="button" id="wmContinueBtn">Continue Export</button>
        <button class="btn" type="button" onclick="closeModal()">Cancel</button>
      </div>
    `
  });
  setPdfLogoPreview(brand.logoDataUrl);
  setPdfWatermarkAssetPreview('', '');
  initPdfWatermarkDesigner();
  const btn=document.getElementById('wmContinueBtn');
  if(btn) btn.onclick=async ()=>{
    btn.disabled=true;
    btn.textContent='Preparing...';
    // Open the print surface while this remains a direct user gesture. Reading a
    // watermark file is asynchronous and would otherwise make browsers block it.
    const isSelectablePdf=kind==='selectable' || kind==='selectable-clean';
    const selectableWindow=isSelectablePdf ? window.open('', '_blank', 'width=1120,height=820') : null;
    if(isSelectablePdf && !selectableWindow){
      btn.disabled=false;
      btn.textContent='Continue Export';
      showNotice('The print window was blocked. Allow pop-ups for QS Studio, then try again.', 'Selectable Text PDF');
      return;
    }
    const text=String(document.getElementById('wmTextInput')?.value||'').trim();
    const vectorSvg=String(document.getElementById('wmVectorSvgInput')?.value||'').trim();
    const image=String(document.getElementById('wmImageDataInput')?.value||'').trim();
    const placement={
      xPct:Math.max(0, Math.min(100, +(document.getElementById('wmXPctInput')?.value || 50))),
      yPct:Math.max(0, Math.min(100, +(document.getElementById('wmYPctInput')?.value || 52))),
      widthPct:Math.max(5, Math.min(120, +(document.getElementById('wmWidthPctInput')?.value || 64))),
      opacity:Math.max(.01, Math.min(1, +(document.getElementById('wmOpacityInput')?.value || 10)/100)),
      assetAngle:Math.max(-180, Math.min(180, +(document.getElementById('wmAssetAngleInput')?.value || 0)))
    };
    const textPlacement={
      xPct:Math.max(0, Math.min(100, +(document.getElementById('wmTextXPctInput')?.value || 50))),
      yPct:Math.max(0, Math.min(100, +(document.getElementById('wmTextYPctInput')?.value || 88))),
      opacity:Math.max(.01, Math.min(1, +(document.getElementById('wmTextOpacityInput')?.value || 100)/100)),
      textAngle:Math.max(-180, Math.min(180, +(document.getElementById('wmTextAngleInput')?.value || 0)))
    };
    const textStyle=getPdfWatermarkTextStyleFromControls();
    const nextBrand = typeof normalizePdfBranding==='function' ? normalizePdfBranding({
      instituteName:document.getElementById('pdfInstituteInput')?.value || '',
      examDisplayName:document.getElementById('pdfExamNameInput')?.value || '',
      subtitle:document.getElementById('pdfSubtitleInput')?.value || '',
      logoDataUrl:document.getElementById('pdfLogoDataInput')?.value || ''
    }) : {
      instituteName:String(document.getElementById('pdfInstituteInput')?.value || '').trim(),
      examDisplayName:String(document.getElementById('pdfExamNameInput')?.value || '').trim(),
      subtitle:String(document.getElementById('pdfSubtitleInput')?.value || '').trim(),
      logoDataUrl:String(document.getElementById('pdfLogoDataInput')?.value || '').trim()
    };
    pdfBranding = nextBrand;
    const nextPublishing=collectPdfPublishingFromModal();
    pdfPublishing = nextPublishing;
    const sheetTemplateLayers=collectPdfWatermarkDesignerLayers();
    const sheetTemplateLayout=collectPdfSheetTemplateLayout();
    const whiteLabelLayers=sheetTemplateLayers;
    try{ if(typeof saveLS==='function') saveLS(); }catch(_){}
    closeModal();
    const wm={text,image,vectorSvg,placement,textPlacement,textStyle,whiteLabelLayers,sheetTemplateLayers,sheetTemplateLayout,branding:nextBrand,publishing:nextPublishing,theme:kind==='selectable-clean'?'cleantheam':'boxed'};
    const label=kind==='key' ? 'Key PDF' : isSelectablePdf ? (kind==='selectable-clean' ? 'cleantheam Text PDF' : 'Selectable Text PDF') : 'Paper PDF';
    const job=()=> kind==='key' ? exportAnsKeyPDF(wm) : isSelectablePdf ? exportPaperSelectablePDF(wm, selectableWindow) : exportPaperPDFTextOnly(wm);
    if(isSelectablePdf){ job(); return; }
    if(typeof runExportJob==='function') runExportJob(label, job, {message:'Call registered. Building PDF frames...', working:'Compressing and arranging PDF pages...'});
    else job();
  };
}

function getPdfImageNaturalSize(doc, dataUrl){
  try{
    const props = doc?.getImageProperties ? doc.getImageProperties(dataUrl) : null;
    const w = +(props?.width || props?.w || 0);
    const h = +(props?.height || props?.h || 0);
    if(w>0 && h>0) return {w,h};
  }catch(_){}
  try{
    const raw=String(dataUrl||'');
    const b64=raw.includes(',') ? raw.split(',')[1] : '';
    const bin=b64 ? atob(b64) : '';
    const u8=(idx)=>bin.charCodeAt(idx) & 255;
    const u16be=(idx)=>(u8(idx)<<8)|u8(idx+1);
    const u16le=(idx)=>u8(idx)|(u8(idx+1)<<8);
    const u32be=(idx)=>(u8(idx)*16777216)+(u8(idx+1)<<16)+(u8(idx+2)<<8)+u8(idx+3);
    if(/^data:image\/png/i.test(raw) && bin.length>24){
      const w=u32be(16), h=u32be(20);
      if(w>0 && h>0) return {w,h};
    }
    if(/^data:image\/gif/i.test(raw) && bin.length>10){
      const w=u16le(6), h=u16le(8);
      if(w>0 && h>0) return {w,h};
    }
    if(/^data:image\/jpe?g/i.test(raw) && bin.length>12){
      let i=2;
      while(i<bin.length-9){
        if(u8(i)!==255){ i++; continue; }
        const marker=u8(i+1);
        const len=u16be(i+2);
        if((marker>=192 && marker<=195) || (marker>=197 && marker<=199) || (marker>=201 && marker<=203) || (marker>=205 && marker<=207)){
          const h=u16be(i+5), w=u16be(i+7);
          if(w>0 && h>0) return {w,h};
        }
        i += Math.max(2, len + 2);
      }
    }
  }catch(_){}
  return {w:1,h:1};
}

function getPdfContainSize(doc, dataUrl, maxW, maxH){
  const natural=getPdfImageNaturalSize(doc, dataUrl);
  const scale=Math.min(maxW/Math.max(1,natural.w), maxH/Math.max(1,natural.h));
  return {
    w:Math.max(1, natural.w*scale),
    h:Math.max(1, natural.h*scale)
  };
}

function drawPdfWatermark(doc, pageW, pageH, watermark={}, pageNo=1, totalPages=1){
  const layers=getPdfSheetTemplateLayers(watermark);
  if(layers.length){
    layers.forEach(layer=>drawPdfWhiteLabelLayer(doc, pageW, pageH, layer, pageNo, totalPages));
    return;
  }
  if(!watermark?.text && !watermark?.image && !watermark?.vectorSvg) return;
  const place=watermark?.placement || {};
  const xPct=Math.max(0, Math.min(100, +(place.xPct ?? 50)));
  const yPct=Math.max(0, Math.min(100, +(place.yPct ?? 52)));
  const widthPct=Math.max(5, Math.min(120, +(place.widthPct ?? 64)));
  const opacity=Math.max(.01, Math.min(1, +(place.opacity ?? .115)));
  const assetAngle=Math.max(-180, Math.min(180, +(place.assetAngle ?? 0)));
  const centerX=pageW*(xPct/100);
  const centerY=pageH*(yPct/100);
  try{
    if(watermark.image){
      const maxW=pageW*(widthPct/100);
      const maxH=pageH*.78;
      const fitted=getPdfContainSize(doc, watermark.image, maxW, maxH);
      const x=centerX-(fitted.w/2);
      const y=centerY-(fitted.h/2);
      if(doc.setGState) doc.setGState(new doc.GState({opacity}));
      doc.addImage(watermark.image, /^data:image\/jpe?g/i.test(watermark.image)?'JPEG':'PNG', x, y, fitted.w, fitted.h, undefined, 'FAST', assetAngle);
      if(doc.setGState) doc.setGState(new doc.GState({opacity:1}));
    }
    if(watermark.text){
      const raw=String(watermark.text||'').replace(/\s+/g,' ').trim();
      if(!raw) return;
      const textPlace=watermark.textPlacement || place;
      const textStyle=watermark.textStyle || {};
      const tx=pageW*(Math.max(0, Math.min(100, +(textPlace.xPct ?? 50)))/100);
      const ty=pageH*(Math.max(0, Math.min(100, +(textPlace.yPct ?? 52)))/100);
      const textOpacity=Math.max(.01, Math.min(1, +(textPlace.opacity ?? opacity)));
      const textAngle=Math.max(-180, Math.min(180, +(textPlace.textAngle ?? -36)));
      const fontSize=Math.max(6, Math.min(140, +(textStyle.fontSize ?? 58)));
      const family=/arial|verdana/i.test(String(textStyle.fontFamily||'')) ? 'helvetica' : 'times';
      const style=(textStyle.bold ? 'bold' : '') + (textStyle.italic ? 'italic' : '');
      const fontStyle=style || 'normal';
      const color=String(textStyle.color || '#969696');
      const match=color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      const rgb=match ? match.slice(1).map(v=>parseInt(v,16)) : [150,150,150];
      const lines=String(raw).split(/\n/);
      const lineH=fontSize*1.12;
      const startY=ty-((lines.length-1)*lineH/2);
      if(doc.setGState) doc.setGState(new doc.GState({opacity:textOpacity}));
      try{ doc.setFont(family,fontStyle); }catch(_){ doc.setFont(family,'normal'); }
      doc.setFontSize(fontSize);
      doc.setTextColor(rgb[0],rgb[1],rgb[2]);
      lines.forEach((line,idx)=>doc.text(line, tx, startY + idx*lineH, {align:'center', angle:textAngle}));
      if(textStyle.underline){
        const underlineY=startY + (lines.length-1)*lineH + fontSize*.14;
        const textW=Math.max(...lines.map(line=>doc.getTextWidth ? doc.getTextWidth(line) : fontSize*String(line).length*.5), 1);
        doc.setLineWidth(Math.max(.3, fontSize*.035));
        doc.line(tx-textW/2, underlineY, tx+textW/2, underlineY);
      }
      doc.setTextColor(0);
      if(doc.setGState) doc.setGState(new doc.GState({opacity:1}));
    }
  }catch(_){}
}

function drawPdfWhiteLabelLayer(doc, pageW, pageH, layer={}, pageNo=1, totalPages=1){
  if(!layer || typeof layer!=='object') return;
  const type=String(layer.type || '').toLowerCase();
  const x=pageW*(Math.max(0, Math.min(100, +(layer.xPct ?? 50)))/100);
  const y=pageH*(Math.max(0, Math.min(100, +(layer.yPct ?? 50)))/100);
  const opacity=Math.max(.01, Math.min(1, +(layer.opacity ?? 1)));
  const angle=Math.max(-180, Math.min(180, +(layer.angle ?? 0)));
  try{
    if(type==='text'){
      const raw=resolvePdfSheetTextTokens(layer.text, pageNo, totalPages).trim();
      if(!raw) return;
      const style=layer.style || {};
      const fontSize=Math.max(6, Math.min(140, +(style.fontSize ?? 11)));
      const family=/arial|verdana/i.test(String(style.fontFamily||'')) ? 'helvetica' : 'times';
      const fontStyle=(style.bold ? 'bold' : '') + (style.italic ? 'italic' : '') || 'normal';
      const color=String(style.color || '#111111');
      const match=color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
      const rgb=match ? match.slice(1).map(v=>parseInt(v,16)) : [0,0,0];
      if(doc.setGState) doc.setGState(new doc.GState({opacity}));
      try{ doc.setFont(family,fontStyle); }catch(_){ doc.setFont(family,'normal'); }
      doc.setFontSize(fontSize);
      doc.setTextColor(rgb[0],rgb[1],rgb[2]);
      const lines=raw.split(/\n/);
      const lineH=fontSize*1.12;
      const boxW=pageW*(Math.max(1, Math.min(220, +(layer.widthPct ?? 20)))/100);
      const align=/^(left|right|center)$/i.test(String(layer.align||'')) ? String(layer.align).toLowerCase() : 'center';
      const textX=align==='left' ? x : align==='right' ? x+boxW : x+boxW/2;
      const startY=y+fontSize;
      lines.forEach((line,idx)=>doc.text(line, textX, startY+idx*lineH, {align, angle}));
      if(style.underline && doc.getTextWidth){
        const textW=Math.max(...lines.map(line=>doc.getTextWidth(line)), 1);
        const underlineY=startY+(lines.length-1)*lineH+fontSize*.14;
        doc.setLineWidth(Math.max(.3, fontSize*.035));
        const underX=align==='left' ? textX : align==='right' ? textX-textW : textX-textW/2;
        doc.line(underX, underlineY, underX+textW, underlineY);
      }
      doc.setTextColor(0);
      if(doc.setGState) doc.setGState(new doc.GState({opacity:1}));
      return;
    }
    const image=String(layer.image || '').trim();
    if(!/^data:image\//i.test(image)) return;
    const maxW=pageW*(Math.max(5, Math.min(220, +(layer.widthPct ?? 40)))/100);
    const maxH=pageH*(Math.max(1, Math.min(220, +(layer.heightPct ?? (type==='svg' ? 100 : 8))))/100);
    const fitted=getPdfContainSize(doc, image, maxW, maxH);
    if(doc.setGState) doc.setGState(new doc.GState({opacity}));
    doc.addImage(image, /^data:image\/jpe?g/i.test(image)?'JPEG':'PNG', x, y, fitted.w, fitted.h, undefined, 'FAST', angle);
    if(doc.setGState) doc.setGState(new doc.GState({opacity:1}));
  }catch(_){}
}

function applyPdfWatermarkToAllPages(doc, pageW, pageH, watermark={}){
  if(!watermark?.text && !watermark?.image && !watermark?.vectorSvg && !getPdfSheetTemplateLayers(watermark).length) return;
  const total=doc.getNumberOfPages ? doc.getNumberOfPages() : 1;
  for(let i=1;i<=total;i++){
    doc.setPage(i);
    drawPdfWatermark(doc, pageW, pageH, watermark, i, total);
  }
}

function applyPdfPageNumbersToAllPages(doc, pageW, pageH){
  const total=doc.getNumberOfPages ? doc.getNumberOfPages() : 1;
  for(let i=1;i<=total;i++){
    doc.setPage(i);
    doc.setFont('helvetica','normal');
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(`Page ${i} of ${total}`, pageW/2, pageH-16, {align:'center'});
    doc.setTextColor(0);
  }
}

function loadImg(src){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>resolve(img);
    img.onerror=reject;
    img.src=src;
  });
}

async function composeFiguresForPDF(figs, legends=[]){
  const list=(Array.isArray(figs)?figs:[]).filter(fig=>fig && fig.src);
  const legendList=(Array.isArray(legends)?legends:[]).filter(lg=>String(lg?.text||'').trim());
  if(!list.length && !legendList.length) return null;
  const measureCanvas=document.createElement('canvas');
  const mctx=measureCanvas.getContext('2d');
  const legendBoxes=legendList.map(lg=>{
    const font=lg.font || '14px "Times New Roman",serif';
    const lineHeight=lg.lineHeight || 18;
    mctx.font=font;
    const lines=String(lg.text||'').split('\n');
    const width=Math.max(...lines.map(line=>mctx.measureText(line).width), 24);
    const height=Math.max(lineHeight, lines.length*lineHeight);
    return { ...lg, font, lineHeight, width, height, lines };
  });
  const xs=[
    ...list.map(fig=>fig.x||0),
    ...legendBoxes.map(lg=>lg.x||0)
  ];
  const ys=[
    ...list.map(fig=>fig.y||0),
    ...legendBoxes.map(lg=>lg.y||0)
  ];
  const rights=[
    ...list.map(fig=>(fig.x||0)+(fig.w||0)),
    ...legendBoxes.map(lg=>(lg.x||0)+lg.width)
  ];
  const bottoms=[
    ...list.map(fig=>(fig.y||0)+(fig.h||0)),
    ...legendBoxes.map(lg=>(lg.y||0)+lg.height)
  ];
  const minX=Math.min(...xs, 0);
  const minY=Math.min(...ys, 0);
  const maxX=Math.max(...rights, 24);
  const maxY=Math.max(...bottoms, 24);
  const width=Math.max(24, maxX-minX);
  const height=Math.max(24, maxY-minY);
  const canvas=document.createElement('canvas');
  canvas.width=width;
  canvas.height=height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,width,height);
  for(const fig of list){
    try{
      const img=await loadImg(fig.src);
      const crop=getFigureCrop(fig);
      const sx=img.width*crop.l;
      const sy=img.height*crop.t;
      const sw=img.width*(1-crop.l-crop.r);
      const sh=img.height*(1-crop.t-crop.b);
      ctx.drawImage(
        img,
        sx, sy, Math.max(1,sw), Math.max(1,sh),
        (fig.x||0)-minX, (fig.y||0)-minY, fig.w||0, fig.h||0
      );
    }catch(err){}
  }
  ctx.textBaseline='top';
  legendBoxes.forEach(lg=>{
    ctx.save();
    ctx.font=lg.font;
    ctx.fillStyle=lg.color || '#111';
    lg.lines.forEach((line,idx)=>{
      ctx.fillText(line, (lg.x||0)-minX, (lg.y||0)-minY + idx*lg.lineHeight);
    });
    ctx.restore();
  });
  return {dataUrl:canvas.toDataURL('image/png'), width, height, format:'PNG'};
}

function getLinkedComposerHTMLForKey(key){
  if(!cur) return '';
  if(key==='q') return String(cur.questionComposerHTML||'').trim();
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return String(cur.options[idx]?.composerHTML||'').trim();
  }
  return '';
}

function escapeLinkedPreviewTextHTML(v){
  return String(v||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function getLinkedPreviewTextForKey(key){
  if(!cur) return '';
  if(key==='q') return getQuestionPdfSourceText(cur);
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return getOptionPdfSourceText(cur.options[idx]||null);
  }
  return '';
}

function getLinkedPlainTextForKey(key){
  if(!cur) return '';
  if(key==='q') return displayPdfText(cur.questionText||'');
  if(key.startsWith('opt')){
    const idx=+key.slice(3);
    return displayPdfText(cur.options[idx]?.text||'');
  }
  return '';
}

function applyLinkedPreviewTypography(key, el){
  if(!el) return;
  const size=clampMixedComposerTextSize(getStoredComposerTextSizeForKey(key) || 20);
  const line=(Math.max(1.38, (size+8)/size)).toFixed(2);
  const frameW=key==='q' ? 640 : 500;
  el.style.setProperty('--linked-composer-size', size+'px');
  el.style.setProperty('--linked-composer-line', String(line));
  el.style.fontSize=size+'px';
  el.style.lineHeight=line;
  el.style.width='100%';
  el.style.maxWidth=frameW+'px';
  el.style.minHeight='48px';
  el.style.height='auto';
  el.style.fontFamily="'Cambria Math','STIX Two Math','STIXGeneral','Times New Roman','Georgia','Noto Serif','Segoe UI Symbol',serif";
}

function normalizeLinkedPreviewDOM(el){
  if(!el) return;
  el.querySelectorAll('input.structure-input, input.frac-input').forEach(input=>{
    const span=document.createElement('span');
    const val=String(input.value || input.getAttribute('value') || input.placeholder || '').trim();
    span.textContent=val;
    const klass = input.classList.contains('structure-limit') ? 'linked-preview-limit' : input.classList.contains('structure-order') ? 'linked-preview-order' : 'linked-preview-value';
    span.className=[klass, ...Array.from(input.classList).filter(c=>c!=='structure-input' && c!=='frac-input')].join(' ');
    if(!val) span.style.display='none';
    input.replaceWith(span);
  });
  el.querySelectorAll('.composer-caret-spacer').forEach(n=>n.remove());
  el.querySelectorAll('[contenteditable]').forEach(n=>n.removeAttribute('contenteditable'));
  queueLinkedPreviewLayout(el);
}

function finalizeLinkedPreviewLayout(el){
  if(!el) return;
  el.style.height='auto';
  el.style.minHeight='48px';
}

function queueLinkedPreviewLayout(el){
  if(!el) return;
  finalizeLinkedPreviewLayout(el);
  requestAnimationFrame(()=>{
    finalizeLinkedPreviewLayout(el);
    requestAnimationFrame(()=>finalizeLinkedPreviewLayout(el));
  });
}

function escLinkedPreviewHTML(v){
  return String(v||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function renderLinkedPreviewMathValue(value){
  const raw=String(value||'').trim();
  if(!raw) return '';
  const normalized=normalizeSelectableLatexSource(raw);
  if(isSelectableLatexSource(normalized)){
    return renderSelectableLatexPreviewHTML(normalized);
  }
  // Fields inside composer math widgets are math expressions even when they do
  // not start with a LaTeX command, e.g. x^2, e^{t^2/2}, or a/b.
  if(/[\\^_{}\/]|[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/.test(normalized)){
    const latex=composerExprToLatex(normalized);
    return latex ? renderSelectableLatexPreviewHTML(latex) : escLinkedPreviewHTML(normalized);
  }
  return escLinkedPreviewHTML(normalized);
}

function readLinkedPreviewField(node, selector, fallback=''){
  const el=node?.querySelector?.(selector);
  return String(el?.value || el?.getAttribute?.('value') || fallback || '').trim() || fallback || '';
}

function buildLinkedPreviewIntegralHTML(node, kind){
  const expr=readLinkedPreviewField(node,'.structure-expr','f(x)');
  const diff=readIntegralVariableText(node, kind);
  const order=getIntegralOrderForKind(kind);
  const pieces=[];
  if(hasPerIntegralLimits(kind)){
    for(let i=1;i<=order;i++){
      // handled below in string template generation
    }
  }
  if(hasPerIntegralLimits(kind)){
    for(let i=1;i<=order;i++){
      const upper=readLinkedPreviewField(node, '.structure-upper-'+i, i===1?'b':i===2?'d':'f');
      const lower=readLinkedPreviewField(node, '.structure-lower-'+i, i===1?'a':i===2?'c':'e');
      pieces.push('<span class="lp-op integral"><span class="lp-main">∫</span><sup>'+renderLinkedPreviewMathValue(upper)+'</sup><sub>'+renderLinkedPreviewMathValue(lower)+'</sub></span>');
      if(kind==='doubleIntegralFirstLimits' && i>1){ pieces[pieces.length-1] = '<span class="lp-op integral"><span class="lp-main">∫</span></span>'; }
    }
  } else {
    const sym=getIntegralSymbolForKind(kind);
    if(hasIntegralLimits(kind)){
      const upper=readLinkedPreviewField(node,'.structure-upper','b');
      const lower=readLinkedPreviewField(node,'.structure-lower','a');
      pieces.push('<span class="lp-op integral"><span class="lp-main">'+escLinkedPreviewHTML(sym)+'</span><sup>'+renderLinkedPreviewMathValue(upper)+'</sup><sub>'+renderLinkedPreviewMathValue(lower)+'</sub></span>');
    } else {
      pieces.push('<span class="lp-op integral"><span class="lp-main">'+escLinkedPreviewHTML(sym)+'</span></span>');
    }
  }
  return pieces.join('')+' <span class="lp-expr">'+renderLinkedPreviewMathValue(expr)+'</span> <span class="lp-diff">'+renderLinkedPreviewMathValue(getIntegralDifferentialText(kind, diff, false))+'</span>';
}

function buildLinkedPreviewDerivativeHTML(node, kind){
  const expr=readLinkedPreviewField(node,'.structure-expr','f(x)');
  const variable=readLinkedPreviewField(node,'.structure-var','x');
  const power=readLinkedPreviewField(node,'.structure-order','n');
  const partial=isPartialDerivativeStructureKind(kind);
  const symbol=partial ? '∂' : 'd';
  let num=symbol, den=symbol+renderLinkedPreviewMathValue(variable);
  if(isSecondDerivativeStructureKind(kind)){
    num += '<sup>2</sup>';
    den += '<sup>2</sup>';
  } else if(kind==='derivativePower' || kind==='partialDerivativePower'){
    num += '<sup>'+renderLinkedPreviewMathValue(power)+'</sup>';
    den += '<sup>'+renderLinkedPreviewMathValue(power)+'</sup>';
  }
  return '<span class="lp-deriv"><span class="lp-frac"><span class="lp-frac-num">'+num+'</span><span class="lp-frac-bar"></span><span class="lp-frac-den">'+den+'</span></span> <span class="lp-expr">'+renderLinkedPreviewMathValue(expr)+'</span></span>';
}

function buildLinkedPreviewStructureHTML(node){
  const kind=String(node?.dataset?.kind || '');
  if(!kind) return escLinkedPreviewHTML(node?.textContent||'');
  if(kind==='matrix'){
    const rows=getInlineMatrixCellValues(node);
    return '<span class="lp-matrix"><span class="lp-matrix-bracket">[</span><span class="lp-matrix-grid">'+rows.map(row=>'<span class="lp-matrix-row">'+row.map(value=>'<span class="lp-matrix-cell">'+renderLinkedPreviewMathValue(value || ' ')+'</span>').join('')+'</span>').join('')+'</span><span class="lp-matrix-bracket">]</span></span>';
  }
  if(isLargeBracketStructureKind(kind)){
    const [left,right]=getLargeBracketChars(kind);
    const expr=readInlineStructureRawValue(node,'.structure-expr','');
    return '<span class="lp-delimited"><span class="lp-delimiter">'+escLinkedPreviewHTML(left)+'</span><span class="lp-delimited-body">'+renderLinkedPreviewMathValue(expr)+'</span><span class="lp-delimiter">'+escLinkedPreviewHTML(right)+'</span></span>';
  }
  if(kind==='summationPlain'){
    const expr=readLinkedPreviewField(node,'.structure-expr','term');
    return '<span class="lp-op sigma"><span class="lp-main">Σ</span></span> <span class="lp-expr">'+renderLinkedPreviewMathValue(expr)+'</span>';
  }
  if(kind==='summation'){
    const upper=readLinkedPreviewField(node,'.structure-upper','n');
    const lower=readLinkedPreviewField(node,'.structure-lower','i=1');
    const expr=readLinkedPreviewField(node,'.structure-expr','aᵢ');
    return '<span class="lp-op sigma"><span class="lp-main">Σ</span><sup>'+renderLinkedPreviewMathValue(upper)+'</sup><sub>'+renderLinkedPreviewMathValue(lower)+'</sub></span> <span class="lp-expr">'+renderLinkedPreviewMathValue(expr)+'</span>';
  }
  if(kind==='vector'){
    const expr=readLinkedPreviewField(node,'.structure-expr','A');
    return '<span class="lp-vector">'+renderLinkedPreviewMathValue(expr)+'⃗</span>';
  }
  if(kind==='visualEquation'){
    const expr=readLinkedPreviewField(node,'.structure-expr','x_bar');
    return renderLinkedPreviewMathValue(normalizeComposerPastedLatexExpression(expr));
  }
  if(isFunctionStructureKind(kind)){
    const expr=readLinkedPreviewField(node,'.structure-expr','x');
    if(kind==='expFunc') return '<span class="lp-op-text">e<sup>'+renderLinkedPreviewMathValue(expr)+'</sup></span>';
    if(isDelimitedFunctionStructureKind(kind)){
      const [left,right]=getFunctionStructureDelimiters(kind);
      return '<span class="lp-op-text">'+escLinkedPreviewHTML(left)+renderLinkedPreviewMathValue(expr)+escLinkedPreviewHTML(right)+'</span>';
    }
    return '<span class="lp-op-text">'+escLinkedPreviewHTML(getFunctionStructureLabel(kind)+'(')+renderLinkedPreviewMathValue(expr)+')</span>';
  }
  if(kind==='limitPlain'){
    const expr=readLinkedPreviewField(node,'.structure-expr','f(x)');
    return '<span class="lp-op limit"><span class="lp-main">lim</span></span> <span class="lp-expr">'+renderLinkedPreviewMathValue(expr)+'</span>';
  }
  if(kind==='limit'){
    const variable=readLinkedPreviewField(node,'.structure-var','x');
    const toValue=readLinkedPreviewField(node,'.structure-to-value','0');
    const expr=readLinkedPreviewField(node,'.structure-expr','f(x)');
    return '<span class="lp-op limit"><span class="lp-main">lim</span><sub>'+renderLinkedPreviewMathValue(variable)+'→'+renderLinkedPreviewMathValue(toValue)+'</sub></span> <span class="lp-expr">'+renderLinkedPreviewMathValue(expr)+'</span>';
  }
  if(isDerivativeStructureKind(kind)) return buildLinkedPreviewDerivativeHTML(node, kind);
  if(isIntegralStructureKind(kind)) return buildLinkedPreviewIntegralHTML(node, kind);
  return escLinkedPreviewHTML(node.textContent||'');
}

function buildLinkedPreviewFractionHTML(node){
  const num=String(node.querySelector('.frac-num')?.value || node.querySelector('.frac-num')?.getAttribute('value') || 'a').trim() || 'a';
  const den=String(node.querySelector('.frac-den')?.value || node.querySelector('.frac-den')?.getAttribute('value') || 'b').trim() || 'b';
  const variant=String(node.dataset?.variant || 'stacked');
  if(variant==='slash' || variant==='linear'){
    return '<span class="lp-inline-frac">'+renderLinkedPreviewMathValue(num)+'/'+renderLinkedPreviewMathValue(den)+'</span>';
  }
  return '<span class="lp-frac"><span class="lp-frac-num">'+renderLinkedPreviewMathValue(num)+'</span><span class="lp-frac-bar"></span><span class="lp-frac-den">'+renderLinkedPreviewMathValue(den)+'</span></span>';
}

function buildLinkedPreviewNodeHTML(node){
  if(!node) return '';
  if(node.nodeType===3) return escLinkedPreviewHTML(node.nodeValue||'');
  if(node.nodeType!==1) return '';
  const el=node;
  if(el.classList?.contains('composer-caret-spacer')) return '';
  if(el.classList?.contains('composer-free-bracket')){
    return '<span class="composer-free-bracket">'+escLinkedPreviewHTML(el.dataset.bracketChar || el.textContent || '')+'</span>';
  }
  if(el.classList?.contains('composer-eq-token')){
    const latex=normalizeSelectableLatexSource(el.dataset.latex || '');
    if(latex) return renderSelectableLatexPreviewHTML(latex);
    return escLinkedPreviewHTML(el.dataset.plain || el.textContent || '');
  }
  if(el.classList?.contains('composer-inline-structure')) return buildLinkedPreviewStructureHTML(el);
  if(el.classList?.contains('composer-inline-frac')) return buildLinkedPreviewFractionHTML(el);
  if(el.classList?.contains('composer-inline-image') || el.tagName==='IMG'){
    const image=el.tagName==='IMG' ? el : el.querySelector('img');
    const src=image?.getAttribute('src') || el.dataset?.src || '';
    if(!src) return '';
    const width=Math.max(20, Math.min(1600, +(image?.dataset?.w || el.dataset?.w || image?.width || 0) || 0));
    const height=Math.max(12, Math.min(1200, +(image?.dataset?.h || el.dataset?.h || image?.height || 0) || 0));
    const dimensions=width && height ? ` style="width:${Math.round(width)}px;height:${Math.round(height)}px;object-fit:contain"` : '';
    return '<img class="composer-inline-image" src="'+escLinkedPreviewHTML(src)+'" alt="Inline image"'+dimensions+'>';
  }
  const inner=Array.from(el.childNodes||[]).map(buildLinkedPreviewNodeHTML).join('');
  const tag=el.tagName.toLowerCase();
  if(tag==='br') return '<br>';
  if(['strong','b','em','i','u','sup','sub','span','div'].includes(tag)){
    if(tag==='span' || tag==='div') return inner;
    return '<'+tag+'>'+inner+'</'+tag+'>';
  }
  return inner || escLinkedPreviewHTML(el.textContent||'');
}

function getLinkedPreviewRichHTMLFromComposerHTML(html){
  const wrap=document.createElement('div');
  wrap.innerHTML=String(html||'');
  return Array.from(wrap.childNodes||[]).map(buildLinkedPreviewNodeHTML).join('');
}

function getLinkedComposerImageHTML(html){
  const wrap=document.createElement('div');
  wrap.innerHTML=String(html||'');
  return Array.from(wrap.querySelectorAll('img.composer-inline-image')).map(buildLinkedPreviewNodeHTML).join('');
}

function comparableSelectableComposerSource(value){
  return normalizeSelectableLatexSource(value)
    .replace(/\[\[FIGURE\]\]|\[Figure\]|\[Image\]/g,'')
    .replace(/\s+/g,'')
    .trim();
}

function getLinkedPreviewCircuitSvgMarkup(fig){
  if(fig?.kind!=='circuit-svg') return '';
  const source=String(fig?.sourceSvg||'').trim();
  if(source){
    if(!/^\s*<svg\b/i.test(source) || /<script\b|<foreignObject\b|\son\w+\s*=|javascript:/i.test(source)) return '';
    return source;
  }
  const src=String(fig?.src||'');
  if(!/^data:image\/svg\+xml/i.test(src)) return '';
  const comma=src.indexOf(',');
  if(comma<0) return '';
  try{
    const raw=/;base64/i.test(src.slice(0,comma)) ? decodeLinkedPreviewSvgBase64(src.slice(comma+1)) : decodeURIComponent(src.slice(comma+1));
    if(!/^\s*<svg\b/i.test(raw) || /<script\b|<foreignObject\b|\son\w+\s*=|javascript:/i.test(raw)) return '';
    return raw;
  }catch(_){
    return '';
  }
}

function decodeLinkedPreviewSvgBase64(payload){
  const binary=atob(String(payload||''));
  try{
    const bytes=Uint8Array.from(binary, ch=>ch.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  }catch(_){
    return binary;
  }
}

function getSelectableCanvasFigureHTML(figures){
  return getSelectableCanvasFigureLayer(figures).html;
}

function buildSelectableCanvasFigureStack(normalized, boxW, boxH, className='lp-canvas-figure-stack'){
  const html=normalized.map(({fig,width,height,left,top},index)=>{
    const x=Math.round(left);
    const y=Math.round(top);
    const circuitSvg=getLinkedPreviewCircuitSvgMarkup(fig);
    if(circuitSvg){
      return '<span class="lp-canvas-circuit" aria-label="Placed figure '+(index+1)+'" style="left:'+x+'px;top:'+y+'px;width:'+Math.round(width)+'px;height:'+Math.round(height)+'px">'+circuitSvg+'</span>';
    }
    return '<img class="lp-canvas-figure" src="'+escLinkedPreviewHTML(fig.src)+'" alt="Placed figure '+(index+1)+'" style="left:'+x+'px;top:'+y+'px;width:'+Math.round(width)+'px;height:'+Math.round(height)+'px">';
  }).join('');
  return '<span class="'+className+'" style="width:'+Math.max(1,Math.round(boxW))+'px;height:'+Math.max(1,Math.round(boxH))+'px">'+html+'</span>';
}

function getSelectableCanvasFigureLayer(figures){
  const list=(Array.isArray(figures) ? figures : []).filter(fig=>fig && /^data:image\//i.test(String(fig.src||'')));
  if(!list.length) return {html:'', flowHtml:'', height:0, flowHeight:0};
  let minLeft=Infinity,minTop=Infinity,maxRight=0,maxBottom=0;
  const normalized=list.map(fig=>{
    const width=Math.max(24, Math.min(2400, +(fig.w||0) || 160));
    const height=Math.max(18, Math.min(1800, +(fig.h||0) || 100));
    const left=Math.max(0, +(fig.x||0));
    const top=Math.max(0, +(fig.y||0));
    minLeft=Math.min(minLeft,left);
    minTop=Math.min(minTop,top);
    maxRight=Math.max(maxRight,left+width);
    maxBottom=Math.max(maxBottom,top+height);
    return {fig,width,height,left,top};
  });
  const boxW=Math.max(32, Math.round(maxRight));
  const boxH=Math.max(24, Math.round(maxBottom));
  const flowLeft=Number.isFinite(minLeft) ? minLeft : 0;
  const flowTop=Number.isFinite(minTop) ? minTop : 0;
  const flowNormalized=normalized.map(item=>({...item,left:item.left-flowLeft,top:item.top-flowTop}));
  const flowW=Math.max(32, Math.round(maxRight-flowLeft));
  const flowH=Math.max(24, Math.round(maxBottom-flowTop));
  return {
    html:'<span class="lp-canvas-figures">'+buildSelectableCanvasFigureStack(normalized, boxW, boxH)+'</span>',
    flowHtml:'<span class="lp-canvas-figures lp-canvas-figures-flow">'+buildSelectableCanvasFigureStack(flowNormalized, flowW, flowH)+'</span>',
    height:boxH,
    flowHeight:flowH
  };
}

function getSelectableCanvasFiguresForKey(key){
  return getSelectableCanvasFigureHTML([...(getFigureStore(key)||[]), ...(getBurnedFigureStore(key)||[])]);
}

function formatLinkedPreviewInlineTextHTML(src){
  const clean=String(src||'')
    // Unknown TeX-style prose commands such as "\maximum-likelihood" should
    // read as normal text in the selectable/PDF path, not leak backslashes.
    .replace(/\\([A-Za-z]+)(?=[\s-]|$)/g,'$1');
  let out=escapeLinkedPreviewTextHTML(clean);
  const supMap={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-','⁼':'=','⁽':'(','⁾':')','ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ᶦ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z'};
  const subMap={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','₌':'=','₍':'(','₎':')','ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};
  const supSet=new Set(Object.keys(supMap));
  const subSet=new Set(Object.keys(subMap));
  const convertRuns=(input, set, map, tag)=>{
    let result='';
    for(let i=0;i<input.length;i++){
      const ch=input[i];
      if(set.has(ch)){
        let j=i, buf='';
        while(j<input.length && set.has(input[j])){ buf += (map[input[j]]||input[j]); j++; }
        result += '<'+tag+'>'+buf+'</'+tag+'>';
        i=j-1;
      } else {
        result += ch;
      }
    }
    return result;
  };
  out=convertRuns(out, supSet, supMap, 'sup');
  out=convertRuns(out, subSet, subMap, 'sub');
  out=out.replace(/(∫|∬|∭|∮)(<sub>[^<]+<\/sub>)?(<sup>[^<]+<\/sup>)?/g,'<span class="lp-op-text">$1$3$2</span>');
  out=out.replace(/(Σ|Π)(<sub>[^<]+<\/sub>)?(<sup>[^<]+<\/sup>)?/g,'<span class="lp-op-text">$1$3$2</span>');
  out=out.replace(/\t/g,'&nbsp;&nbsp;&nbsp;&nbsp;').replace(/ {2,}/g, spaces=>'&nbsp;'.repeat(spaces.length));
  out=out.replace(/\n/g,'<br>');
  return out;
}

function formatLinkedPreviewTextHTML(src){
  const raw=String(src||'').replace(/\r\n?/g,'\n');
  return raw.split('\n').map(line=>{
    if(line==='') return '<span class="lp-text-line lp-blank-line">&nbsp;</span>';
    const html=(typeof isSelectableLatexSource==='function' && isSelectableLatexSource(line) && typeof renderSelectableLatexPreviewHTML==='function')
      ? renderSelectableLatexPreviewHTML(line)
      : formatLinkedPreviewInlineTextHTML(line);
    return '<span class="lp-text-line">'+html+'</span>';
  }).join('');
}

const SELECTABLE_BARE_LATEX_WORD_COMMANDS=new Set([
  'alpha','beta','gamma','delta','epsilon','varepsilon','zeta','eta','theta','vartheta','iota','kappa','lambda','mu','nu','xi','pi','varpi','rho','varrho','sigma','varsigma','tau','upsilon','phi','varphi','chi','psi','omega',
  'Gamma','Delta','Theta','Lambda','Xi','Pi','Sigma','Upsilon','Phi','Psi','Omega',
  'partial','nabla','infty','times','div','cdot','pm','mp','leq','geq','neq','approx','simeq','sim','cong','equiv','propto','ll','gg',
  'rightarrow','leftarrow','leftrightarrow','Rightarrow','Leftarrow','Leftrightarrow','mapsto',
  'notin','ni','subset','supset','subseteq','supseteq','cup','cap','setminus','emptyset','varnothing','forall','exists','nexists','neg','land','lor',
  'oplus','otimes','odot','bigoplus','bigotimes','bigcap','bigcup','therefore','because','degree','hbar','ell','Re','Im','perp','parallel','angle',
  'sin','cos','tan','cot','sec','csc','sinh','cosh','tanh','ln','log','exp','lim','mod','det','min','max','arg','gcd','lcm',
  'sqrt','sum','prod','int','iint','iiint','oint'
]);

const SELECTABLE_BARE_LATEX_WORD_ALIASES={
  eq:'=',
  ne:'\\neq',
  le:'\\leq',
  ge:'\\geq',
  infinity:'\\infty',
  empty:'\\emptyset',
  ohm:'\\Omega',
  ceil:'\\lceil',
  floor:'\\lfloor',
  plusminus:'\\pm',
  therefore:'\\therefore',
  because:'\\because'
};

const SELECTABLE_UNICODE_SUPERSCRIPT_MAP={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9','⁺':'+','⁻':'-','⁼':'=','⁽':'(','⁾':')','ᵃ':'a','ᵇ':'b','ᶜ':'c','ᵈ':'d','ᵉ':'e','ᶠ':'f','ᵍ':'g','ʰ':'h','ᶦ':'i','ⁱ':'i','ʲ':'j','ᵏ':'k','ˡ':'l','ᵐ':'m','ⁿ':'n','ᵒ':'o','ᵖ':'p','ʳ':'r','ˢ':'s','ᵗ':'t','ᵘ':'u','ᵛ':'v','ʷ':'w','ˣ':'x','ʸ':'y','ᶻ':'z','ᴬ':'A','ᴮ':'B','ᴰ':'D','ᴱ':'E','ᴳ':'G','ᴴ':'H','ᴵ':'I','ᴶ':'J','ᴷ':'K','ᴸ':'L','ᴹ':'M','ᴺ':'N','ᴼ':'O','ᴾ':'P','ᴿ':'R','ᵀ':'T','ᵁ':'U','ⱽ':'V','ᵂ':'W'};
const SELECTABLE_UNICODE_SUBSCRIPT_MAP={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','₊':'+','₋':'-','₌':'=','₍':'(','₎':')','ₐ':'a','ₑ':'e','ₕ':'h','ᵢ':'i','ⱼ':'j','ₖ':'k','ₗ':'l','ₘ':'m','ₙ':'n','ₒ':'o','ₚ':'p','ᵣ':'r','ₛ':'s','ₜ':'t','ᵤ':'u','ᵥ':'v','ₓ':'x'};
function decodeSelectableUnicodeScriptRun(run,map){return [...String(run||'')].map(ch=>map[ch]||ch).join('');}
function repairSelectableUnicodeScripts(value){
  const supChars=Object.keys(SELECTABLE_UNICODE_SUPERSCRIPT_MAP).join('');
  const subChars=Object.keys(SELECTABLE_UNICODE_SUBSCRIPT_MAP).join('');
  const base='([A-Za-z0-9)\\]}α-ωΑ-Ωϑϕϱϵ∂∇∞∫∮∑∏ΦΨΩεσρτχ])';
  let text=String(value||'');
  text=text.replace(new RegExp(base+'(['+supChars+']+)','g'),(_,head,run)=>head+'^{'+decodeSelectableUnicodeScriptRun(run,SELECTABLE_UNICODE_SUPERSCRIPT_MAP)+'}');
  text=text.replace(new RegExp(base+'(['+subChars+']+)','g'),(_,head,run)=>head+'_{'+decodeSelectableUnicodeScriptRun(run,SELECTABLE_UNICODE_SUBSCRIPT_MAP)+'}');
  return text;
}
function repairSelectableUnicodeMathSymbols(value){
  const map={
    'α':'\\alpha ','β':'\\beta ','γ':'\\gamma ','δ':'\\delta ','ε':'\\epsilon ','ϵ':'\\varepsilon ','ζ':'\\zeta ','η':'\\eta ','θ':'\\theta ','ϑ':'\\vartheta ','ι':'\\iota ','κ':'\\kappa ','λ':'\\lambda ','μ':'\\mu ','ν':'\\nu ','ξ':'\\xi ','π':'\\pi ','ρ':'\\rho ','ϱ':'\\varrho ','σ':'\\sigma ','ς':'\\varsigma ','τ':'\\tau ','υ':'\\upsilon ','φ':'\\phi ','ϕ':'\\varphi ','χ':'\\chi ','ψ':'\\psi ','ω':'\\omega ',
    'Γ':'\\Gamma ','Δ':'\\Delta ','Θ':'\\Theta ','Λ':'\\Lambda ','Ξ':'\\Xi ','Π':'\\Pi ','Σ':'\\Sigma ','Υ':'\\Upsilon ','Φ':'\\Phi ','Ψ':'\\Psi ','Ω':'\\Omega ',
    '±':'\\pm ','∓':'\\mp ','×':'\\times ','÷':'\\div ','·':'\\cdot ','≤':'\\leq ','≥':'\\geq ','≠':'\\neq ','≈':'\\approx ','≃':'\\simeq ','∼':'\\sim ','≅':'\\cong ','≡':'\\equiv ','∝':'\\propto ','∞':'\\infty ','∂':'\\partial ','∇':'\\nabla ','∀':'\\forall ','∃':'\\exists ','∄':'\\nexists ',
    '←':'\\leftarrow ','→':'\\rightarrow ','↔':'\\leftrightarrow ','⇒':'\\Rightarrow ','⇐':'\\Leftarrow ','⇔':'\\Leftrightarrow ','↦':'\\mapsto ',
    '∪':'\\cup ','∩':'\\cap ','⊂':'\\subset ','⊃':'\\supset ','⊆':'\\subseteq ','⊇':'\\supseteq ','∈':'\\in ','∉':'\\notin ','∅':'\\varnothing ','∥':'\\parallel ','⊥':'\\perp ','⊕':'\\oplus ','⊗':'\\otimes ','⊙':'\\odot ','∴':'\\therefore ','∵':'\\because ','ℏ':'\\hbar ','∠':'\\angle '
  };
  return String(value||'').replace(/[α-ωΑ-Ωϑϕϱϵ±∓×÷·≤≥≠≈≃∼≅≡∝∞∂∇∀∃∄←→↔⇒⇐⇔↦∪∩⊂⊃⊆⊇∈∉∅∥⊥⊕⊗⊙∴∵ℏ∠]/g,ch=>map[ch]||ch);
}

function repairSelectableVisualAccentShortcuts(value){
  return withProtectedSelectableLatexTextGroups(value, text=>String(text||'')
    .replace(/(^|[^\\A-Za-z])([A-Za-z])(?:_bar|_overline)\b/g, '$1\\bar{$2}')
    .replace(/(^|[^\\A-Za-z])([A-Za-z])(?:_hat)\b/g, '$1\\hat{$2}')
    .replace(/(^|[^\\A-Za-z])([A-Za-z])(?:_vec|_vector)\b/g, '$1\\vec{$2}')
    .replace(/([A-Za-z])\u0304/g, '\\bar{$1}')
    .replace(/\\(bar|overline|hat|vec|tilde|dot|ddot)\s+([A-Za-z])(?![A-Za-z])/g, '\\$1{$2}'));
}

const SELECTABLE_TEXT_GROUP_COMMANDS=new Set(['operatorname','operatornamewithlimits','text','mathrm','mathbf','mathit','mathbb','mathcal','mathscr']);

function withProtectedSelectableLatexTextGroups(value, mapper){
  const text=String(value||'');
  const protectedGroups=[];
  const re=/\\([A-Za-z]+)\s*\{/g;
  let masked='';
  let cursor=0;
  let match;
  while((match=re.exec(text))){
    const command=match[1] || '';
    if(!SELECTABLE_TEXT_GROUP_COMMANDS.has(command)) continue;
    const braceIndex=re.lastIndex-1;
    const group=readSelectableLatexGroup(text, braceIndex);
    if(group.next<=braceIndex) continue;
    const token='\\uE000QSL'+protectedGroups.length+'QSL\\uE001';
    protectedGroups.push(text.slice(match.index, group.next));
    masked += text.slice(cursor, match.index) + token;
    cursor=group.next;
    re.lastIndex=group.next;
  }
  if(!protectedGroups.length) return mapper(text);
  masked += text.slice(cursor);
  const transformed=mapper(masked);
  return String(transformed).replace(/\\uE000QSL(\d+)QSL\\uE001/g,(_,idx)=>protectedGroups[+idx] || '');
}

function repairBareSelectableLatexPaletteWords(value){
  return withProtectedSelectableLatexTextGroups(value, text=>{
    return String(text||'').replace(/(^|[^\\A-Za-z])([A-Za-z][A-Za-z0-9]*)(_[A-Za-z0-9]+|\^\{?[^ \t\r\n{}]+\}?)?/g,(match, prefix, word, suffix='')=>{
      const command=SELECTABLE_BARE_LATEX_WORD_ALIASES[word] || (SELECTABLE_BARE_LATEX_WORD_COMMANDS.has(word) ? '\\'+word : '');
      if(!command) return match;
      return prefix + command + (suffix || '');
    });
  });
}

function repairBareSelectableLatexCommands(value){
  let text=String(value||'');
  const prefixCommand=(input, commands, lookahead)=>{
    const commandPattern=commands.join('|');
    return input.replace(new RegExp('(^|[^\\\\A-Za-z])('+commandPattern+')(?![A-Za-z])(?='+lookahead+')','g'), (_, lead, command)=>lead+'\\'+command);
  };
  text=prefixCommand(text, ['sqrt'], '\\s*(?:\\[|\\{)');
  text=prefixCommand(text, ['dfrac','tfrac','frac'], '\\s*\\{');
  text=prefixCommand(text, ['begin','end'], '\\s*\\{');
  text=prefixCommand(text, ['left','right'], '\\s*(?:\\\\|[()\\[\\]{}|.])');
  text=prefixCommand(text, ['iiint','iint','oint','int','sum','prod','lim'], '\\s*(?:[_^\\{]|$|[A-Za-z0-9])');
  text=prefixCommand(text, ['operatorname','operatornamewithlimits','mathrm','mathbf','mathit','mathbb','mathcal','mathscr','text'], '\\s*\\{');
  text=prefixCommand(text, ['ln','log','sin','cos','tan','cot','sec','csc','sinh','cosh','tanh','exp','det','min','max'], '\\s*(?:\\{|\\(|[A-Za-z0-9_\\\\])');
  text=prefixCommand(text, ['mod'], '\\s*(?:\\{|\\(|_|\\\\|$)');
  text=prefixCommand(text, ['vec','hat','bar','dot','ddot','tilde','overline','underline','overrightarrow','overleftarrow'], '\\s*(?:\\{|[A-Za-z0-9\\\\])');
  text=prefixCommand(text, ['lfloor','rfloor','lceil','rceil','lvert','rvert','lVert','rVert'], '\\b');
  return repairBareSelectableLatexPaletteWords(text);
}

function normalizeSelectableLatexSource(value){
  return repairBareSelectableLatexCommands(repairSelectableVisualAccentShortcuts(repairSelectableUnicodeMathSymbols(repairSelectableUnicodeScripts(String(value||''))))
    .replace(/\r\n?/g,'\n')
    // A historic serializer could turn the leading "\\t" of \\times into a tab.
    .replace(/\times\b/g,'\\times')
    // Repair only the isolated command tail; ordinary prose is left untouched.
    .replace(/(^|\s)imes(?=\s|\\|$)/g,'$1\\times')
    .replace(/\\ne\b/g,'\\neq')
    .replace(/\\le\b/g,'\\leq')
    .replace(/\\ge\b/g,'\\geq')
    .replace(/[\u200B\u2060]/g,''));
}

function isSelectableLatexSource(value){
  const text=normalizeSelectableLatexSource(value);
  return /\\(?:begin|end|frac|dfrac|tfrac|sqrt|left|right|int|iint|iiint|oint|sum|prod|lim|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|partial|nabla|operatorname|operatornamewithlimits|text|mathrm|mathbb|mathcal|mathscr|vec|hat|bar|dot|ddot|tilde|overline|underline|overrightarrow|overleftarrow|lfloor|rfloor|lceil|rceil|lvert|rvert|lVert|rVert|subset|supset|forall|exists|nexists|emptyset|varnothing|Rightarrow|Leftrightarrow|hbar|degree|times|div|pm|mp|neq|leq|geq|approx|simeq|sim|cong|equiv|propto|otimes|oplus|odot|bigoplus|bigotimes|bigcap|bigcup|therefore|because|perp|parallel|angle|mapsto|setminus)/.test(text)
    || /[A-Za-z0-9)\]][_^](?:\{[^{}\n]+\}|[A-Za-z0-9+\-=()])/.test(text)
    || /[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ᵃᵇᶜᵈᵉᶠᵍʰᶦʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]/.test(text);
}

function readSelectableLatexGroup(source, start){
  const text=String(source||'');
  let pos=start;
  while(/\s/.test(text[pos]||'')) pos++;
  if(text[pos]!=='{'){
    return {value:text[pos]||'', next:Math.min(text.length,pos+1)};
  }
  let depth=0;
  for(let i=pos;i<text.length;i++){
    if(text[i]==='{') depth++;
    else if(text[i]==='}'){
      depth--;
      if(depth===0) return {value:text.slice(pos+1,i), next:i+1};
    }
  }
  return {value:text.slice(pos+1), next:text.length};
}

function readSelectableLatexAtomicExpression(source, start){
  const text=String(source||'');
  let pos=start;
  while(/\s/.test(text[pos]||'')) pos++;
  if(text[pos]==='{') return readSelectableLatexGroup(text,pos);
  if(text[pos]==='\\'){
    const match=text.slice(pos+1).match(/^([A-Za-z]+|.)/);
    const command=match?.[1] || '';
    let next=pos+1+command.length;
    if(command==='sqrt'){
      if(text[next]==='['){
        const end=text.indexOf(']',next+1);
        if(end>=0) next=end+1;
      }
      const body=readSelectableLatexGroup(text,next);
      return {value:text.slice(pos,body.next), next:body.next};
    }
    if(command==='frac' || command==='dfrac' || command==='tfrac'){
      const numerator=readSelectableLatexGroup(text,next);
      const denominator=readSelectableLatexGroup(text,numerator.next);
      return {value:text.slice(pos,denominator.next), next:denominator.next};
    }
    if(text[next]==='{'){
      const body=readSelectableLatexGroup(text,next);
      return {value:text.slice(pos,body.next), next:body.next};
    }
    return {value:text.slice(pos,next), next};
  }
  return readSelectableLatexGroup(text,pos);
}

function readSelectableLatexScripts(source, start){
  const text=String(source||'');
  let pos=start;
  let lower='', upper='';
  for(let guard=0; guard<2; guard++){
    while(/\s/.test(text[pos]||'')) pos++;
    const marker=text[pos];
    if(marker!=='_' && marker!=='^') break;
    const group=readSelectableLatexGroup(text,pos+1);
    if(marker==='_') lower=group.value;
    else upper=group.value;
    pos=group.next;
  }
  return {lower, upper, next:pos};
}

function renderSelectableBigOpHTML(command, source, start, depth){
  const symbols={sum:'&Sigma;',prod:'&Pi;',coprod:'&#8720;',int:'&int;',iint:'&int;&int;',iiint:'&int;&int;&int;',oint:'&oint;',lim:'lim'};
  const scripts=readSelectableLatexScripts(source,start);
  const symbol=symbols[command] || escapeLinkedPreviewTextHTML(command);
  const isLimit=command==='lim';
  const className=isLimit ? 'lp-bigop lp-bigop-word' : 'lp-bigop';
  const upper=scripts.upper ? '<span class="lp-bigop-upper">'+renderSelectableLatexNestedHTML(scripts.upper,depth+1)+'</span>' : '<span class="lp-bigop-upper">&nbsp;</span>';
  const lower=scripts.lower ? '<span class="lp-bigop-lower">'+renderSelectableLatexNestedHTML(scripts.lower,depth+1)+'</span>' : '<span class="lp-bigop-lower">&nbsp;</span>';
  return {
    html:'<span class="'+className+'">'+upper+'<span class="lp-bigop-symbol">'+symbol+'</span>'+lower+'</span>',
    next:scripts.next
  };
}

function renderSelectableLatexNestedHTML(source, depth=0){
  const raw=String(source||'');
  const html=renderSelectableLatexPreviewHTML(raw,depth);
  return html || escLinkedPreviewHTML(raw);
}

function readSelectableLatexDelimiter(source, start){
  const text=String(source||'');
  let pos=start;
  while(/\s/.test(text[pos]||'')) pos++;
  if(text[pos]!=='\\') return {value:text[pos]||'', next:Math.min(text.length,pos+1)};
  const match=text.slice(pos+1).match(/^([A-Za-z]+|.)/);
  const token=match?.[1] || '';
  const values={lbrace:'{',rbrace:'}',lbrack:'[',rbrack:']',langle:'&lang;',rangle:'&rang;',lvert:'|',rvert:'|',vert:'|',lVert:'||',rVert:'||',Vert:'||',lfloor:'&lfloor;',rfloor:'&rfloor;',lceil:'&lceil;',rceil:'&rceil;','{':'{','}':'}','|':'|','[':'[',']':']','(':'(',')':')'};
  return {value:values[token] || token, next:pos+1+token.length};
}

function getSelectableLatexMatrixDelimiters(environment){
  if(environment==='pmatrix') return ['(',')'];
  if(environment==='vmatrix') return ['|','|'];
  if(environment==='Vmatrix') return ['||','||'];
  if(environment==='matrix') return ['',''];
  return ['[',']'];
}

function renderSelectableLatexMatrixHTML(body, environment, depth){
  const [left,right]=getSelectableLatexMatrixDelimiters(environment);
  const rows=String(body||'').split(/\\\\/).map(row=>row.split('&'));
  const rowHtml=rows.map(row=>'<span class="lp-matrix-row">'+row.map(cell=>'<span class="lp-matrix-cell">'+renderSelectableLatexNestedHTML(String(cell||'').replace(/\\[,:;!]/g,''),depth+1)+'</span>').join('')+'</span>').join('');
  const leftHtml=left ? '<span class="lp-matrix-bracket">'+left+'</span>' : '';
  const rightHtml=right ? '<span class="lp-matrix-bracket">'+right+'</span>' : '';
  return '<span class="lp-matrix">'+leftHtml+'<span class="lp-matrix-grid">'+rowHtml+'</span>'+rightHtml+'</span>';
}

const KATEX_SELECTABLE_COMMANDS=new Set([
  'frac','dfrac','tfrac','sqrt','begin','left','right',
  'sum','prod','coprod','int','iint','iiint','oint','lim',
  'sin','cos','tan','cot','sec','csc','sinh','cosh','tanh','log','ln','exp',
  'mod','bmod','pmod','pod','arg','det','gcd','lcm','min','max',
  'operatorname','operatornamewithlimits','mathrm','mathbf','mathit','mathbb','mathcal','mathscr','text',
  'vec','hat','bar','dot','ddot','tilde','overline','underline','overrightarrow','overleftarrow',
  'alpha','beta','gamma','delta','epsilon','varepsilon','zeta','eta','theta','vartheta','iota','kappa','lambda','mu','nu','xi','pi','varpi','rho','varrho','sigma','varsigma','tau','upsilon','phi','varphi','chi','psi','omega',
  'Gamma','Delta','Theta','Lambda','Xi','Pi','Sigma','Upsilon','Phi','Psi','Omega',
  'partial','nabla','infty','times','div','cdot','pm','mp','leq','geq','neq','approx','simeq','sim','cong','equiv','propto','ll','gg','to','rightarrow','leftarrow','leftrightarrow',
  'Rightarrow','Leftarrow','Leftrightarrow','mapsto','in','notin','ni','subset','supset','subseteq','supseteq','cup','cap','setminus','emptyset','varnothing','forall','exists','nexists','neg','land','lor',
  'lfloor','rfloor','lceil','rceil','lvert','rvert','lVert','rVert','oplus','otimes','odot','bigoplus','bigotimes','bigcap','bigcup','hbar','degree','ell','Re','Im','perp','parallel','angle','therefore','because'
]);

function isKatexSelectableSpacingCommand(command){
  return command===',' || command===';' || command===':' || command==='!' || command===' ' ||
    command==='quad' || command==='qquad' || command==='enspace' || command==='thinspace' ||
    command==='medspace' || command==='thickspace' || command==='negthinspace';
}

function getSelectableKatexRenderer(){
  const k=window.katex;
  return k && typeof k.renderToString==='function' ? k : null;
}

function readKatexCommandName(text, start){
  if(text[start]!=='\\') return {command:'', next:start};
  const match=String(text).slice(start+1).match(/^([A-Za-z]+|.)/);
  const command=match?.[1] || '';
  return {command, next:start+1+command.length};
}

function readKatexOptionalBracket(text, start){
  let pos=start;
  while(/\s/.test(text[pos]||'')) pos++;
  if(text[pos]!=='[') return {next:start};
  let depth=0;
  for(let i=pos;i<text.length;i++){
    if(text[i]==='[') depth++;
    else if(text[i]===']'){
      depth--;
      if(depth===0) return {next:i+1};
    }
  }
  return {next:text.length};
}

function consumeKatexScripts(text, start){
  let pos=start;
  for(let guard=0; guard<4; guard++){
    while(/\s/.test(text[pos]||'')) pos++;
    if(text[pos]!=='_' && text[pos]!=='^') break;
    const group=readSelectableLatexGroup(text,pos+1);
    pos=group.next;
  }
  return pos;
}

function readKatexDelimitedCommand(text, start, command, next){
  if(command==='begin'){
    const env=readSelectableLatexGroup(text,next);
    const close='\\end{'+env.value+'}';
    const end=text.indexOf(close, env.next);
    return end>=0 ? end+close.length : env.next;
  }
  if(command==='left'){
    let pos=readSelectableLatexDelimiter(text,next).next;
    let nested=0;
    while(pos<text.length){
      if(text.startsWith('\\left',pos)){ nested++; pos+=5; continue; }
      if(text.startsWith('\\right',pos)){
        const right=readSelectableLatexDelimiter(text,pos+6);
        if(nested===0) return right.next;
        nested--;
        pos=right.next;
        continue;
      }
      pos++;
    }
    return pos;
  }
  return next;
}

function consumeKatexCommandExpression(text, start){
  const {command,next}=readKatexCommandName(text,start);
  if(!command) return start+1;
  if(isKatexSelectableSpacingCommand(command)) return next;
  let pos=next;
  if(command==='sqrt'){
    pos=readKatexOptionalBracket(text,pos).next;
    pos=readSelectableLatexGroup(text,pos).next;
  }else if(command==='frac' || command==='dfrac' || command==='tfrac'){
    const numerator=readSelectableLatexGroup(text,pos);
    const denominator=readSelectableLatexGroup(text,numerator.next);
    pos=denominator.next;
  }else if(command==='begin' || command==='left'){
    pos=readKatexDelimitedCommand(text,start,command,pos);
  }else if(command==='operatorname' || command==='operatornamewithlimits' || command==='mathrm' || command==='mathbf' || command==='mathit' || command==='mathbb' || command==='mathcal' || command==='mathscr' || command==='text'){
    pos=readSelectableLatexGroup(text,pos).next;
  }else if(/^(?:vec|hat|bar|dot|ddot|tilde|overline|underline|overrightarrow|overleftarrow)$/.test(command)){
    if(text.slice(pos).trimStart().startsWith('{')) pos=readSelectableLatexGroup(text,pos).next;
  }
  pos=consumeKatexScripts(text,pos);
  return pos;
}

function consumeKatexSimpleAtom(text, start){
  let pos=start;
  const ch=text[pos] || '';
  if(ch==='{' || ch==='(' || ch==='['){
    const closer=ch==='{' ? '}' : ch==='(' ? ')' : ']';
    let depth=0;
    for(let i=pos;i<text.length;i++){
      if(text[i]===ch) depth++;
      else if(text[i]===closer){
        depth--;
        if(depth===0) return consumeKatexScripts(text,i+1);
      }
    }
    return text.length;
  }
  if(ch==='\\') return consumeKatexScripts(text, consumeKatexCommandExpression(text,pos));
  if(/[A-Za-z]/.test(ch)){
    const word=(text.slice(pos).match(/^[A-Za-z]+/)||[''])[0];
    const commonDifferential=/^d[xyztruvw]$/.test(word);
    const isSingle=word.length===1;
    const isNamedMath=/^(dx|dy|dz|dt|du|dv|dw|dr|ln|log|sin|cos|tan|lim|mod|min|max|arg|det|gcd|lcm)$/.test(word);
    if(!isSingle && !commonDifferential && !isNamedMath) return start;
    pos+=word.length;
    return consumeKatexScripts(text,pos);
  }
  if(/[0-9.]/.test(ch)){
    pos+=(text.slice(pos).match(/^[0-9.]+/)||[''])[0].length;
    return consumeKatexScripts(text,pos);
  }
  if(/[+\-*/=(),|<>[\]]/.test(ch)) return pos+1;
  return start;
}

function getKatexPlainGroupContent(text, start){
  const opener=text[start] || '';
  const closer=opener==='(' ? ')' : opener==='[' ? ']' : opener==='{' ? '}' : '';
  if(!closer) return null;
  let depth=0;
  for(let i=start;i<text.length;i++){
    if(text[i]===opener) depth++;
    else if(text[i]===closer){
      depth--;
      if(depth===0) return {content:text.slice(start+1,i), end:i+1};
    }
  }
  return null;
}

function isKatexMathFollowerGroup(text, start){
  const group=getKatexPlainGroupContent(text,start);
  if(!group) return false;
  const content=String(group.content||'').trim();
  if(!content) return true;
  if(/[\\^_{}]|[0-9+\-*/=|<>]/.test(content)) return true;
  const words=content.match(/[A-Za-z]+/g) || [];
  if(!words.length) return false;
  const mathWords=new Set(['x','y','z','t','u','v','w','r','s','n','m','i','j','k','a','b','c','d','e','f','g','h','in','to','dx','dy','dz','dt','du','dv','dw','dr','ln','log','sin','cos','tan','lim','mod','min','max']);
  return words.every(word=>mathWords.has(word));
}

function consumeKatexFollowingMath(text, start){
  let pos=start;
  for(let guard=0; guard<80 && pos<text.length; guard++){
    const before=pos;
    const gapStart=pos;
    while(/[ \t]/.test(text[pos]||'')) pos++;
    if(text[pos]==='\r' || text[pos]==='\n') return gapStart;
    if(pos-gapStart>1) return gapStart;
    if(text[pos]==='\\'){
      const {command}=readKatexCommandName(text,pos);
      if(!KATEX_SELECTABLE_COMMANDS.has(command) && !isKatexSelectableSpacingCommand(command)) return gapStart;
      pos=consumeKatexCommandExpression(text,pos);
    }else{
      if(/[([{]/.test(text[pos]||'') && !isKatexMathFollowerGroup(text,pos)) return gapStart;
      const next=consumeKatexSimpleAtom(text,pos);
      if(next===pos) return gapStart;
      pos=next;
    }
    if(pos===before) break;
  }
  return pos;
}

function isKatexSelectableCommandAt(text, pos){
  if(text[pos]!=='\\') return false;
  const {command}=readKatexCommandName(text,pos);
  return KATEX_SELECTABLE_COMMANDS.has(command);
}

function shouldStartSelectableKatexFromPlainAtom(text, start, atomEnd){
  if(atomEnd<=start) return false;
  const raw=text.slice(start, atomEnd);
  // Plain prose should stay prose. Only promote atoms that already carry math
  // syntax or are immediately chained into a real LaTeX command.
  if(!/[\^_{}]/.test(raw)) return false;
  if(/[A-Za-z0-9)\]\}]\s*[_^]\s*(?:\{|\\|[A-Za-z0-9+\-=()])/.test(raw)) return true;
  if(/[A-Za-z0-9)\]\}](?:_\{[^{}\n]+\}|_[A-Za-z0-9+\-=()]|\^\{[^{}\n]+\}|\^[A-Za-z0-9+\-=()])/.test(raw)) return true;
  let pos=atomEnd;
  while(/[ \t]/.test(text[pos]||'')) pos++;
  if(text[pos]==='\r' || text[pos]==='\n') return false;
  return isKatexSelectableCommandAt(text,pos) || /[+\-*/=,)|\]]/.test(text[pos]||'');
}

function stripSelectableKatexCommandGroupsForHeuristic(text){
  let out=String(text||'');
  for(let guard=0; guard<12; guard++){
    const next=out
      .replace(/\\(?:operatorname|mathrm|mathbf|mathit|mathbb|mathcal|text|operatornamewithlimits)\s*\{[^{}]*\}/g,' ')
      .replace(/\\begin\s*\{[^{}]*\}/g,' ')
      .replace(/\\end\s*\{[^{}]*\}/g,' ');
    if(next===out) break;
    out=next;
  }
  return out;
}

function looksLikeStandaloneKatexMathSource(source){
  const text=String(source||'').trim();
  if(!text || !/[\\^_{}]/.test(text)) return false;
  const withoutCommands=stripSelectableKatexCommandGroupsForHeuristic(text)
    .replace(/\\(?:[A-Za-z]+|.)/g,' ')
    .replace(/[{}()[\]^_+\-*/=,.;:|<>0-9]/g,' ')
    .replace(/\b(?:dx|dy|dz|dt|du|dv|dw|dr|x|y|z|t|u|v|w|r|f|g|h|e|a|b|c|d|n|m|i|j|k|mod|arg|det|min|max|gcd|lcm)\b/gi,' ');
  return !/[A-Za-z]{3,}/.test(withoutCommands);
}

function renderSelectableKatexMathHTML(latex){
  const k=getSelectableKatexRenderer();
  if(!k) return '';
  const normalized=normalizeSelectableLatexSource(latex)
    .replace(/\\degree\b/g,'^\\circ')
    .replace(/\\ceil\b/g,'\\lceil')
    .replace(/\\floor\b/g,'\\lfloor');
  try{
    const html=k.renderToString(normalized, {
      throwOnError:false,
      strict:'ignore',
      displayMode:false,
      output:'html'
    });
    if(/(?:merror|katex-error)/i.test(html)) return '';
    return '<span class="lp-katex-math">'+html+'</span>';
  }catch(_){
    return '';
  }
}

function shouldSelectableKatexCommandContinueSegment(command){
  return isKatexSelectableSpacingCommand(command) ||
    command==='left' || command==='right' ||
    command==='lceil' || command==='rceil' || command==='lfloor' || command==='rfloor' ||
    command==='lvert' || command==='rvert' || command==='lVert' || command==='rVert' ||
    command==='vec' || command==='hat' || command==='bar' || command==='dot' ||
    command==='ddot' || command==='tilde' || command==='overline' || command==='underline' ||
    command==='operatorname' || command==='operatornamewithlimits' ||
    command==='mathrm' || command==='mathbf' || command==='mathit' ||
    command==='mathbb' || command==='mathcal' || command==='mathscr' || command==='text';
}

function consumeSelectableKatexSegment(text, start){
  let pos=start;
  if(text[pos]==='\\') pos=consumeKatexCommandExpression(text,pos);
  else pos=consumeKatexSimpleAtom(text,pos);
  if(pos<=start) return start+1;
  for(let guard=0; guard<120 && pos<text.length; guard++){
    const before=pos;
    while(/[ \t]/.test(text[pos]||'')) pos++;
    if(text[pos]==='\r' || text[pos]==='\n') break;
    if(text[pos]==='\\'){
      const {command}=readKatexCommandName(text,pos);
      if(!command) break;
      if(KATEX_SELECTABLE_COMMANDS.has(command) && !shouldSelectableKatexCommandContinueSegment(command)) break;
      if(!KATEX_SELECTABLE_COMMANDS.has(command) && !isKatexSelectableSpacingCommand(command)) break;
      pos=consumeKatexCommandExpression(text,pos);
      if(pos===before) break;
      continue;
    }
    if(/[([{]/.test(text[pos]||'') && !isKatexMathFollowerGroup(text,pos)) break;
    const next=consumeKatexSimpleAtom(text,pos);
    if(next<=pos) break;
    const atom=text.slice(pos,next);
    if(/[A-Za-z]{3,}/.test(atom) && !/^(?:dx|dy|dz|dt|du|dv|dw|dr|ln|log|sin|cos|tan|lim|mod|min|max|arg|det|gcd|lcm)$/.test(atom)) break;
    pos=next;
    if(pos===before) break;
  }
  return pos;
}

function renderSelectableKatexMixedHTML(source){
  if(!getSelectableKatexRenderer()) return '';
  const text=normalizeSelectableLatexSource(source);
  if(!text) return '';
  if(looksLikeStandaloneKatexMathSource(text)){
    const full=renderSelectableKatexMathHTML(text);
    if(full) return full;
  }
  let out='';
  const appendRenderedMath=(rawLatex)=>{
    const latex=String(rawLatex||'');
    const boundarySpace=/[ \t]$/.test(latex) ? ' ' : '';
    const cleanLatex=latex.replace(/[ \t]+$/,'');
    const rendered=renderSelectableKatexMathHTML(cleanLatex);
    return (rendered || renderSelectableLatexPreviewFallbackHTML(cleanLatex)) + boundarySpace;
  };
  for(let i=0;i<text.length;){
    if(text[i]==='\\'){
      const {command}=readKatexCommandName(text,i);
      if(KATEX_SELECTABLE_COMMANDS.has(command)){
        const exprEnd=consumeSelectableKatexSegment(text, i);
        const latex=text.slice(i, Math.max(exprEnd, i+1));
        out+=appendRenderedMath(latex);
        i=Math.max(exprEnd, i+1);
        continue;
      }
    }
    const atomEnd=consumeKatexSimpleAtom(text,i);
    if(shouldStartSelectableKatexFromPlainAtom(text,i,atomEnd)){
      const exprEnd=consumeSelectableKatexSegment(text, i);
      const latex=text.slice(i, Math.max(exprEnd, atomEnd));
      out+=appendRenderedMath(latex);
      i=Math.max(exprEnd, atomEnd);
      continue;
    }
    let j=i+1;
    while(j<text.length){
      if(text[j]==='\\'){
        const {command}=readKatexCommandName(text,j);
        if(KATEX_SELECTABLE_COMMANDS.has(command)) break;
      }
      const laterAtomEnd=consumeKatexSimpleAtom(text,j);
      if(shouldStartSelectableKatexFromPlainAtom(text,j,laterAtomEnd)) break;
      if(text[j]==='\n') break;
      j++;
    }
    out+=formatLinkedPreviewInlineTextHTML(text.slice(i,j));
    i=j;
  }
  return out;
}

function renderSelectableLatexPreviewHTML(source, depth=0){
  const katexHtml=depth===0 ? renderSelectableKatexMixedHTML(source) : renderSelectableKatexMathHTML(source);
  return katexHtml || renderSelectableLatexPreviewFallbackHTML(source, depth);
}

function renderSelectableLatexPreviewFallbackHTML(source, depth=0){
  const text=normalizeSelectableLatexSource(source);
  if(!text) return '';
  if(depth>8) return escLinkedPreviewHTML(text);
  const symbols={
    alpha:'&alpha;',beta:'&beta;',gamma:'&gamma;',delta:'&delta;',epsilon:'&epsilon;',varepsilon:'&#1013;',zeta:'&zeta;',eta:'&eta;',theta:'&theta;',vartheta:'&#977;',iota:'&iota;',kappa:'&kappa;',lambda:'&lambda;',mu:'&mu;',nu:'&nu;',xi:'&xi;',pi:'&pi;',varpi:'&#982;',rho:'&rho;',varrho:'&#1009;',sigma:'&sigma;',varsigma:'&#962;',tau:'&tau;',upsilon:'&upsilon;',phi:'&phi;',varphi:'&#981;',chi:'&chi;',psi:'&psi;',omega:'&omega;',
    Gamma:'&Gamma;',Delta:'&Delta;',Theta:'&Theta;',Lambda:'&Lambda;',Xi:'&Xi;',Pi:'&Pi;',Sigma:'&Sigma;',Upsilon:'&Upsilon;',Phi:'&Phi;',Psi:'&Psi;',Omega:'&Omega;',
    partial:'&part;',nabla:'&nabla;',infty:'&infin;',times:'&times;',div:'&divide;',cdot:'&middot;',ast:'&lowast;',star:'&#8902;',circ:'&#8728;',bullet:'&bull;',pm:'&plusmn;',mp:'&#8723;',leq:'&le;',le:'&le;',geq:'&ge;',ge:'&ge;',neq:'&ne;',ne:'&ne;',approx:'&asymp;',equiv:'&equiv;',propto:'&prop;',simeq:'&simeq;',cong:'&cong;',sim:'&sim;',ll:'&Lt;',gg:'&Gt;',
    to:'&rarr;',rightarrow:'&rarr;',leftarrow:'&larr;',leftrightarrow:'&harr;',Rightarrow:'&rArr;',Leftarrow:'&lArr;',Leftrightarrow:'&hArr;',mapsto:'&mapsto;',in:'&isin;',notin:'&notin;',ni:'&#8715;',subset:'&sub;',supset:'&sup;',subseteq:'&sube;',supseteq:'&supe;',cup:'&cup;',cap:'&cap;',setminus:'&#8726;',emptyset:'&empty;',forall:'&forall;',exists:'&exist;',nexists:'&#8708;',neg:'&not;',land:'&and;',lor:'&or;',
    sum:'&Sigma;',prod:'&Pi;',coprod:'&#8720;',int:'&int;',iint:'&int;&int;',iiint:'&int;&int;&int;',oint:'&oint;',oplus:'&oplus;',otimes:'&otimes;',odot:'&odot;',bigoplus:'&bigoplus;',bigotimes:'&bigotimes;',bigcap:'&bigcap;',bigcup:'&bigcup;',therefore:'&there4;',because:'&because;',degree:'&deg;',prime:'&prime;',hbar:'&#8463;',ell:'&#8467;',Re:'&#8476;',Im:'&#8465;',perp:'&perp;',parallel:'&parallel;',angle:'&ang;',triangle:'&#9651;',lceil:'&lceil;',rceil:'&rceil;',lfloor:'&lfloor;',rfloor:'&rfloor;',lvert:'|',rvert:'|',lVert:'||',rVert:'||'
  };
  const wordOps=new Set(['sin','cos','tan','cot','sec','csc','sinh','cosh','tanh','log','ln','exp','mod','sgn','arg','det','gcd','lcm','max','min','lim']);
  let out='';
  for(let i=0;i<text.length;){
    if(text.startsWith('\\begin{',i)){
      const envEnd=text.indexOf('}',i+7);
      const environment=envEnd>=0 ? text.slice(i+7,envEnd) : '';
      if(/^(?:b|p|v|V)?matrix$/.test(environment)){
        const closeToken='\\end{'+environment+'}';
        const close=text.indexOf(closeToken,envEnd+1);
        if(close>=0){
          out+=renderSelectableLatexMatrixHTML(text.slice(envEnd+1,close),environment,depth+1);
          i=close+closeToken.length;
          continue;
        }
      }
    }
    if(text.startsWith('\\frac',i) || text.startsWith('\\dfrac',i) || text.startsWith('\\tfrac',i)){
      const command=text.startsWith('\\dfrac',i) || text.startsWith('\\tfrac',i) ? 6 : 5;
      const numerator=readSelectableLatexGroup(text,i+command);
      const denominator=readSelectableLatexGroup(text,numerator.next);
      out+='<span class="lp-frac"><span class="lp-frac-num">'+renderSelectableLatexNestedHTML(numerator.value,depth+1)+'</span><span class="lp-frac-bar"></span><span class="lp-frac-den">'+renderSelectableLatexNestedHTML(denominator.value,depth+1)+'</span></span>';
      i=denominator.next;
      continue;
    }
    if(text.startsWith('\\sqrt',i)){
      let cursor=i+5;
      let index='';
      while(/\s/.test(text[cursor]||'')) cursor++;
      if(text[cursor]==='['){
        const end=text.indexOf(']',cursor+1);
        if(end>=0){ index=text.slice(cursor+1,end); cursor=end+1; }
      }
      while(/\s/.test(text[cursor]||'')) cursor++;
      let radicand=readSelectableLatexGroup(text,cursor);
      if(!String(radicand.value||'').trim() && text[cursor]!=='{'){
        radicand=readSelectableLatexAtomicExpression(text,cursor);
      }
      const prefix=index ? '<sup class="lp-root-index">'+renderSelectableLatexNestedHTML(index,depth+1)+'</sup>' : '';
      const body=String(radicand.value||'').trim()
        ? renderSelectableLatexNestedHTML(radicand.value,depth+1)
        : '<span class="lp-root-placeholder">&nbsp;</span>';
      out+='<span class="lp-root">'+prefix+'<span class="lp-root-symbol">&radic;</span><span class="lp-root-body">'+body+'</span></span>';
      i=radicand.next;
      continue;
    }
    if(text.startsWith('\\left',i)){
      const left=readSelectableLatexDelimiter(text,i+5);
      let cursor=left.next, nested=0, rightAt=-1;
      while(cursor<text.length){
        if(text.startsWith('\\left',cursor)){ nested++; cursor+=5; continue; }
        if(text.startsWith('\\right',cursor)){
          if(nested===0){ rightAt=cursor; break; }
          nested--; cursor+=6; continue;
        }
        cursor++;
      }
      if(rightAt>=0){
        const right=readSelectableLatexDelimiter(text,rightAt+6);
        out+='<span class="lp-delimited"><span class="lp-delimiter">'+left.value+'</span><span class="lp-delimited-body">'+renderSelectableLatexNestedHTML(text.slice(left.next,rightAt),depth+1)+'</span><span class="lp-delimiter">'+right.value+'</span></span>';
        i=right.next;
        continue;
      }
    }
    if(text.startsWith('\\right',i)){
      const delimiter=readSelectableLatexDelimiter(text,i+6);
      out+=delimiter.value;
      i=delimiter.next;
      continue;
    }
    if(text.startsWith('\\\\',i)){ out+='<br>'; i+=2; continue; }
    const current=text[i];
    if(current==='{'){
      const group=readSelectableLatexGroup(text,i);
      out+=renderSelectableLatexNestedHTML(group.value,depth+1);
      i=group.next;
      continue;
    }
    if(current==='}'){ i++; continue; }
    if(current==='^' || current==='_'){
      const script=readSelectableLatexGroup(text,i+1);
      out+='<'+(current==='^'?'sup':'sub')+'>'+renderSelectableLatexNestedHTML(script.value,depth+1)+'</'+(current==='^'?'sup':'sub')+'>';
      i=script.next;
      continue;
    }
    if(current==='\\'){
      const match=text.slice(i+1).match(/^([A-Za-z]+|.)/);
      const command=match?.[1] || '';
      const next=i+1+command.length;
      if(command==='text' || command==='mathrm' || command==='operatorname' || command==='operatornamewithlimits' || command==='mathbf' || command==='mathit' || command==='mathbb' || command==='mathcal' || command==='mathscr'){
        const value=readSelectableLatexGroup(text,next);
        if(command==='mathbb'){
          const blackboard={R:'ℝ',N:'ℕ',Z:'ℤ',Q:'ℚ',C:'ℂ'};
          const raw=String(value.value||'').trim();
          if(blackboard[raw]){
            out+='<span class="lp-symbol">'+blackboard[raw]+'</span>';
            i=value.next;
            continue;
          }
        }
        const style=command==='mathbf' || command==='mathbb' ? 'font-weight:700' : command==='mathit' ? 'font-style:italic' : (command==='mathcal' || command==='mathscr') ? 'font-family:serif;font-style:italic' : '';
        const inner=renderSelectableLatexNestedHTML(value.value,depth+1);
        out+=style ? '<span style="'+style+'">'+inner+'</span>' : inner;
        i=value.next;
        continue;
      }
      if(command==='vec' || command==='hat' || command==='bar' || command==='dot' || command==='ddot' || command==='tilde'){
        const value=readSelectableLatexGroup(text,next);
        const inner=renderSelectableLatexNestedHTML(value.value,depth+1);
        const mark=command==='hat' ? '&#710;' : command==='dot' ? '&#729;' : command==='ddot' ? '&#168;' : command==='vec' ? '&rarr;' : command==='tilde' ? '&#732;' : '';
        out+='<span class="lp-accent lp-accent-'+command+'">'+(mark?'<span class="lp-accent-mark">'+mark+'</span>':'')+'<span class="lp-accent-body">'+inner+'</span></span>';
        i=value.next;
        continue;
      }
      if(command==='overline' || command==='underline'){
        const value=readSelectableLatexGroup(text,next);
        const inner=renderSelectableLatexNestedHTML(value.value,depth+1);
        out+=command==='overline'
          ? '<span class="lp-accent lp-accent-bar"><span class="lp-accent-body">'+inner+'</span></span>'
          : '<span style="text-decoration:underline">'+inner+'</span>';
        i=value.next;
        continue;
      }
      if(command==='sum' || command==='prod' || command==='coprod' || command==='int' || command==='iint' || command==='iiint' || command==='oint' || command==='lim'){
        const big=renderSelectableBigOpHTML(command,text,next,depth);
        out+=big.html;
        i=big.next;
        continue;
      }
      if(symbols[command]){ out+='<span class="lp-symbol">'+symbols[command]+'</span>'; i=next; continue; }
      if(wordOps.has(command)){ out+='<span class="lp-word-op">'+escapeLinkedPreviewTextHTML(command)+'</span>'; i=next; continue; }
      if(command===',' || command===';' || command===':' || command==='!' || command===' '){ out+=' '; i=next; continue; }
      out+=escapeLinkedPreviewTextHTML(command);
      i=next;
      continue;
    }
    if(current==='\n'){ out+='<br>'; i++; continue; }
    out+=escapeLinkedPreviewTextHTML(current);
    i++;
  }
  return out;
}

function isStandaloneSelectableLatexBlock(source){
  const text=normalizeSelectableLatexSource(source).trim();
  if(!text || !isSelectableLatexSource(text)) return false;
  if(/^\\(?:sqrt|frac|dfrac|tfrac|begin|left|int|iint|iiint|sum|prod|lim|operatorname|ln|log|sin|cos|tan|exp)\b/.test(text)) return true;
  if(/^(?:[A-Za-z0-9_{}^+\-*/=().,\s\\[\]|&:;!<>]+)$/.test(text) && /\\(?:sqrt|frac|begin|left|right|int|sum|lim|ln|log|sin|cos|tan|operatorname)/.test(text)) return true;
  return false;
}

function shouldRenderSelectableSourceAsSingleLatex(source){
  const text=normalizeSelectableLatexSource(source).trim();
  if(!text || !isSelectableLatexSource(text)) return false;
  if(/\n/.test(text)) return false;
  if(isStandaloneSelectableLatexBlock(text)) return true;
  return /^\\(?:[A-Za-z]+|.)/.test(text) && !/[A-Za-z]{3,}\s+[A-Za-z]{3,}/.test(text);
}

function wrapMathJaxSelectablePreview(source, fallbackHtml){
  const encoded=encodeURIComponent(String(source||''));
  return '<span class="linked-mathjax-preview" data-latex="'+encoded+'">'+(fallbackHtml||'')+'</span>';
}

function hydrateLinkedMathJaxPreview(root){
  if(!root || typeof waitForMathJaxReady!=='function') return;
  const targets=[...(root.querySelectorAll?.('.linked-mathjax-preview[data-latex]')||[])];
  if(!targets.length) return;
  targets.forEach(target=>{
    const encoded=target.getAttribute('data-latex') || '';
    let latex='';
    try{ latex=decodeURIComponent(encoded); }catch(_){ latex=encoded; }
    latex=normalizeSelectableLatexSource(latex).trim();
    if(!latex) return;
    const token=String(Date.now())+'-'+Math.random().toString(36).slice(2);
    target.dataset.mathjaxToken=token;
    waitForMathJaxReady(5000).then(mj=>{
      if(!mj?.tex2svgPromise || target.dataset.mathjaxToken!==token) return null;
      return mj.tex2svgPromise(latex, { display:false });
    }).then(node=>{
      if(!node || target.dataset.mathjaxToken!==token) return;
      const svg=node.querySelector('svg');
      if(!svg) return;
      svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
      svg.setAttribute('xmlns:xlink','http://www.w3.org/1999/xlink');
      svg.setAttribute('color','#000');
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.maxWidth='100%';
      svg.style.height='auto';
      target.innerHTML='';
      target.appendChild(svg);
      const parent=target.closest('.pdf-linked-preview');
      if(parent) queueLinkedPreviewLayout(parent);
    }).catch(()=>{});
  });
}

function renderLinkedPdfPreview(key){
  const elId = key==='q' ? 'pdfQuestionLinked' : 'pdfOptionLinked'+key.slice(3);
  const el=document.getElementById(elId);
  if(!el) return;
  applyLinkedPreviewTypography(key, el);
  const composerHtml=getLinkedComposerHTMLForKey(key);
  const manualOverride=displayPdfText(getFramePdfTextOverride(key));
  const plain=manualOverride || getLinkedPreviewTextForKey(key) || getLinkedPlainTextForKey(key);
  const selectableSource=String(plain||'').replace(/\[\[FIGURE\]\]|\[Figure\]|\[Image\]/g,'');
  const selectableClean=selectableSource.trim();
  const sourceIsLatex=isSelectableLatexSource(selectableSource);
  const composerRendered=!manualOverride && composerHtml ? getLinkedPreviewRichHTMLFromComposerHTML(composerHtml) : '';
  const sourceRendered=selectableClean
    ? (shouldRenderSelectableSourceAsSingleLatex(selectableSource)
      ? renderSelectableLatexPreviewHTML(selectableSource)
      : formatLinkedPreviewTextHTML(selectableSource))
    : '';
  // The textarea/PDF source is the canonical selectable-text export path.
  // Prefer it for LaTeX so stale composer widget HTML cannot truncate after
  // the first equation atom while the canvas still renders correctly.
  const preferSourceRendered=!!sourceRendered && (manualOverride || sourceIsLatex);
  const renderedCore=preferSourceRendered ? sourceRendered : (composerRendered || sourceRendered);
  const renderedText=renderedCore
    + (((preferSourceRendered || !composerRendered) && selectableClean) ? getLinkedComposerImageHTML(composerHtml) : '')
  const figureLayer=getSelectableCanvasFigureLayer([...(getFigureStore(key)||[]), ...(getBurnedFigureStore(key)||[])]);
  const markerRe=/(\[\[FIGURE\]\]|\[Figure\]|\[Image\])/g;
  const markerTest=/^(?:\[\[FIGURE\]\]|\[Figure\]|\[Image\])$/;
  const renderedWithMarker=(figureLayer.flowHtml && markerRe.test(selectableSource))
    ? String(selectableSource||'').split(markerRe).map(part=>markerTest.test(part) ? figureLayer.flowHtml : formatLinkedPreviewTextHTML(part)).join('')
    : '';
  markerRe.lastIndex=0;
  const rendered=renderedWithMarker || (figureLayer.html
    ? '<span class="lp-coordinate-frame" style="--lp-coordinate-height:'+Math.max(48, Math.round(figureLayer.height||0))+'px"><span class="lp-coordinate-source">'+renderedText+'</span>'+figureLayer.html+'</span>'
    : renderedText);
  el.innerHTML=rendered || formatLinkedPreviewTextHTML(plain || 'No linked composer content yet.');
  el.classList.toggle('has-linked-content', !!(rendered || plain));
  queueLinkedPreviewLayout(el);
}

function syncPdfSourceFields(){
  if(!cur) return;
  cleanupAutoPdfOverrideForKey('q');
  const qBox=document.getElementById('pdfQuestionText');
  const qPdfText=getQuestionPdfSourceText(cur);
  if(qBox){
    if(qBox.value!==qPdfText) qBox.value=qPdfText;
    qBox.dataset.autoPdfText=getQuestionAutoPdfSourceText(cur);
  }
  renderLinkedPdfPreview('q');
  if(Array.isArray(cur.options)){
    cur.options.forEach((opt,i)=>{
      cleanupAutoPdfOverrideForKey('opt'+i);
      const el=document.getElementById('pdfOptionText'+i);
      const optPdfText=getOptionPdfSourceText(opt);
      if(el){
        if(el.value!==optPdfText) el.value=optPdfText;
        el.dataset.autoPdfText=getOptionAutoPdfSourceText(opt);
      }
      renderLinkedPdfPreview('opt'+i);
    });
  }
}

function openCanvasTextBox(key, boxX, boxY, x, y){
  closeCanvasTextBox(key);
  const wrap=document.getElementById(key+'CanvasWrap');
  const cv=document.getElementById(key+'Canvas');
  if(!wrap||!cv) return;
  const mode=canvasState[key]?.tool||'text';
  if(mode==='text'){
    openMixedComposer(key);
    return;
  }
  if(key.startsWith('opt')) resizeCanvasPreserve(key, Math.max(cv.height, getBaseCanvasHeight(key)));
  const box=document.createElement('div');
  box.className='canvas-textbox';
  box.id=key+'FloatingBox';
  const wrapRect=wrap.getBoundingClientRect();
  let fixedLeft=0, fixedTop=0;
  box.dataset.mode=mode;
  if(key.startsWith('opt')){
    box.classList.add('opt-floating');
    fixedLeft=Math.min(Math.max(24, wrapRect.left+18), Math.max(window.innerWidth-420, 24));
    fixedTop=Math.min(Math.max(86, wrapRect.top+18), Math.max(window.innerHeight-220, 86));
    box.style.left=fixedLeft+'px';
    box.style.top=fixedTop+'px';
    box.style.width='min(420px, 38vw)';
    box.style.maxWidth='420px';
  } else {
    box.style.left=(mode==='legend'
      ? Math.min(Math.max(12,boxX),Math.max(wrapRect.width-260,12))
      : 12)+'px';
    box.style.top=(mode==='legend'
      ? Math.min(Math.max(12,boxY),Math.max(wrapRect.height-130,12))
      : Math.max(12, Math.round((wrapRect.height-130)/2)))+'px';
  }
  box.innerHTML=`
    <div class="canvas-textbox-head">
      <div class="canvas-textbox-meta">${mode==='legend'?'Legend editor for figure label':'Paragraph editor with fixed left alignment.'}</div>
      <div class="canvas-textbox-handle">${mode==='legend'?'Drag to position':'Middle-left aligned'}</div>
    </div>
    <textarea id="${key}FloatingText" spellcheck="true" placeholder="Enter text..."></textarea>
    ${mode!=='legend' ? `<div class="selection-tools" id="${key}SelectionTools" hidden>
      <span class="selection-tools-label">Selection</span>
      <button class="btn" type="button" onclick="runSelectionAction('bold')">Bold</button>
      <button class="btn" type="button" onclick="runSelectionAction('italic')">Italic</button>
      <button class="btn" type="button" onclick="runSelectionAction('underline')">Underline</button>
      <button class="btn" type="button" onclick="runSelectionAction('fraction')">Frac</button>
    </div>` : ''}
    ${mode!=='legend' ? getEquationRibbonHTML(key) : ''}
    ${mode!=='legend' ? `<div class="canvas-textbox-actions" style="justify-content:flex-start;margin-top:6px">
      <button class="btn" type="button" onclick="openMixedComposer('${key}')">Open Composer</button>
      <button class="btn" type="button" onclick="importFigureFromEditor('${key}')">Import Figure</button>
      <button class="btn" type="button" onclick="insertFigureMarkerFromEditor('${key}')">Insert [Figure]</button>
      <button class="btn" type="button" onclick="expandCanvasPane('${key}')">Expand Pane</button>
    </div>` : ''}
    <div class="canvas-textbox-actions">
      <button class="btn" type="button" onclick="closeCanvasTextBox('${key}')">Cancel</button>
      <button class="btn pri" type="button" onclick="applyCanvasText('${key}',${x},${y})">Apply</button>
    </div>
  `;
  if(key.startsWith('opt')){
    document.body.appendChild(box);
    const palette=document.createElement('div');
    palette.className='floating-math-panel opt-floating';
    palette.id=key+'MathPalette';
    const paletteLeft=Math.min(fixedLeft + 440, Math.max(window.innerWidth-460, 18));
    const paletteTop=Math.min(fixedTop, Math.max(window.innerHeight-420, 18));
    palette.style.left=paletteLeft+'px';
    palette.style.top=paletteTop+'px';
    palette.innerHTML=`
      <div class="floating-math-title">Full Math Keyboard</div>
      <div class="math-bar">${getFullMathButtonsHTML()}</div>
    `;
    document.body.appendChild(palette);
  } else {
    wrap.appendChild(box);
  }
  const optRow=key.startsWith('opt') ? document.getElementById('optRow'+key.slice(3)) : null;
  if(optRow) optRow.classList.add('focused-editor');
  if(mode==='legend') makeTextBoxDraggable(box,key);
  updateTextBoxCanvasCoords(box,key);
  const input=document.getElementById(key+'FloatingText');
  if(mode!=='legend' && cur){
    input.value = key==='q'
      ? getEditorText(cur.questionText||'')
      : getEditorText(cur.options[+key.slice(3)]?.text||'');
  }
  activeTextTarget=input.id;
  input.addEventListener('input',()=>autoGrowTextBox(input));
  input.addEventListener('mouseup',()=>updateSelectionToolbar(key));
  input.addEventListener('keyup',()=>updateSelectionToolbar(key));
  input.addEventListener('select',()=>updateSelectionToolbar(key));
  input.addEventListener('keydown',e=>{
    if(e.key==='Escape'){
      e.preventDefault();
      closeCanvasTextBox(key);
    }
  });
  autoGrowTextBox(input);
  updateSelectionToolbar(key);
  input.focus();
}

function placeFigureAtPoint(key, x, y){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return;
  pickImageFile(img=>{
    markFrameAsBitmapUnlessSource(key);
    openImagePlacementBox(key,img,{mode:'insert'});
  });
}

function importFigureFromEditor(key){
  pickImageFile(img=>{
    markFrameAsBitmapUnlessSource(key);
    openImagePlacementBox(key,img,{mode:'insert'});
  });
}

function insertFigureMarkerFromEditor(key){
  appendFigureMarker(key);
  syncPdfSourceFields();
  toast('Figure marker added for PDF text');
}

function changeFigure(key){
  const idx=selectedFigureByKey[key];
  const figs=getFigureStore(key);
  if(!(idx>=0) || !figs[idx]){
    toast('Select a figure first');
    return;
  }
  pickImageFile(img=>{
    openImagePlacementBox(key,img,{mode:'replace', figureIndex:idx});
  });
}

function placeGraphAtPoint(key, y){
  markFrameAsBitmap(key);
  const expr=prompt('Graph expression in x, for example: x*x, Math.sin(x), 0.5*x+1', 'x*x');
  if(!expr) return;
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return;
  const startX=16;
  const startY=Math.max(y,16);
  const graphW=Math.min(cv.width-32, 260);
  const graphH=160;
  resizeCanvasPreserve(key, Math.max(getBaseCanvasHeight(key), startY+graphH+16));
  const ctx=cv.getContext('2d');
  const color=document.getElementById(key+'Color')?.value||'#111';
  const left=startX, top=startY, right=left+graphW, bottom=top+graphH;
  ctx.save();
  ctx.fillStyle='#fff';
  ctx.fillRect(left,top,graphW,graphH);
  ctx.strokeStyle='#666';
  ctx.lineWidth=1;
  ctx.strokeRect(left,top,graphW,graphH);
  ctx.beginPath();
  ctx.moveTo(left+graphW/2, top+8);
  ctx.lineTo(left+graphW/2, bottom-8);
  ctx.moveTo(left+8, top+graphH/2);
  ctx.lineTo(right-8, top+graphH/2);
  ctx.stroke();
  const fn=new Function('x', `with (Math) { return ${expr}; }`);
  ctx.beginPath();
  ctx.strokeStyle=color;
  ctx.lineWidth=2;
  let started=false;
  for(let px=0; px<=graphW; px++){
    const x=((px-graphW/2)/(graphW/2))*10;
    let yv;
    try{ yv=fn(x); }catch{ yv=NaN; }
    if(!Number.isFinite(yv)) { started=false; continue; }
    const py=top+graphH/2-(yv/10)*(graphH/2-10);
    if(py<top || py>bottom){ started=false; continue; }
    if(!started){ ctx.moveTo(left+px, py); started=true; }
    else ctx.lineTo(left+px, py);
  }
  ctx.stroke();
  ctx.restore();
  pushHistory(key);
  saveCanvasToQ(key);
  renderPaper();
}

function saveCanvasToQ(key){
  if(!cur) return;
  const cv=document.getElementById(key+'Canvas');
  const wrap=document.getElementById(key+'CanvasWrap');
  if(!cv) return;
  const desiredH=getDesiredCanvasHeight(key, key==='q' ? 12 : 8);
  if(desiredH < cv.height) setCanvasHeightPreserve(key, desiredH);
  const logicalH=Math.max(getBaseCanvasHeight(key), Math.min(cv.height, desiredH));
  const baseDataUrl=cv.toDataURL('image/png');
  const temp=document.createElement('canvas');
  const exportScale=Math.max(2, EXPORT_IMAGE_SCALE);
  temp.width=Math.max(1, Math.round(cv.width*exportScale));
  temp.height=Math.max(1, Math.round(logicalH*exportScale));
  const tctx=temp.getContext('2d');
  tctx.imageSmoothingEnabled=true;
  tctx.imageSmoothingQuality='high';
  tctx.fillStyle='#fff';
  tctx.fillRect(0,0,temp.width,temp.height);
  tctx.drawImage(cv,0,0,cv.width,logicalH,0,0,temp.width,temp.height);
  const figs=getFigureStore(key);
  figs.forEach(fig=>{
    const img=[...(wrap?.querySelectorAll('.canvas-imagebox img, .figure-item img')||[])].find(node=>node.getAttribute('src')===fig.src) || new Image();
    if(!(img instanceof HTMLImageElement)) return;
    if(!img.getAttribute('src')) img.src=fig.src;
    if(!img.complete && !img.naturalWidth) return;
    const crop=getFigureCrop(fig);
    const srcW=(img.naturalWidth||img.width||fig.w);
    const srcH=(img.naturalHeight||img.height||fig.h);
    const sx=srcW*crop.l;
    const sy=srcH*crop.t;
    const sw=srcW*(1-crop.l-crop.r);
    const sh=srcH*(1-crop.t-crop.b);
    const dx=Math.round(fig.x*exportScale);
    const dy=Math.round(fig.y*exportScale);
    const dw=Math.round(fig.w*exportScale);
    const dh=Math.round(fig.h*exportScale);
    try{
      if(sw>0 && sh>0) tctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);
    }catch(_){ }
  });
  const croppedTemp=document.createElement('canvas');
  let minY=temp.height, maxY=-1;
  try{
    const scan=tctx.getImageData(0,0,temp.width,temp.height).data;
    for(let yy=0; yy<temp.height; yy++){
      for(let xx=0; xx<temp.width; xx++){
        const i=(yy*temp.width+xx)*4;
        const a=scan[i+3], r=scan[i], g=scan[i+1], b=scan[i+2];
        if(a>10 && (r<248 || g<248 || b<248)){
          if(yy<minY) minY=yy;
          if(yy>maxY) maxY=yy;
          break;
        }
      }
    }
  }catch(_){ minY=0; maxY=temp.height-1; }
  const basePx=Math.round(getBaseCanvasHeight(key)*exportScale);
  const padPx=Math.round((key==='q' ? 10 : 8)*exportScale);
  if(key!=='q'){
    // Options need to keep their full frame so center-left alignment survives JSON export.
    minY=0;
    maxY=temp.height-1;
  }else if(maxY>=0){
    minY=Math.max(0,minY-padPx);
    maxY=Math.min(temp.height-1,maxY+padPx);
  }else{
    minY=0; maxY=Math.min(temp.height-1,basePx-1);
  }
  const cropH=Math.max(basePx, maxY-minY+1);
  croppedTemp.width=temp.width;
  croppedTemp.height=Math.min(temp.height, cropH);
  const cctx=croppedTemp.getContext('2d');
  cctx.imageSmoothingEnabled=true;
  cctx.imageSmoothingQuality='high';
  cctx.fillStyle='#fff';
  cctx.fillRect(0,0,croppedTemp.width,croppedTemp.height);
  cctx.drawImage(temp,0,minY,temp.width,croppedTemp.height,0,0,temp.width,croppedTemp.height);
  const dataUrl=croppedTemp.toDataURL('image/png');
  const viewerDataUrl=makeViewerCanvasImage(croppedTemp, key).toDataURL('image/png');
  storeCanvasImagesForKey(key, baseDataUrl, dataUrl, viewerDataUrl);
  setFrameBitmapDirty(key, false);
  saveLS();
}

function getCanvasIntrinsicScale(sourceCanvas){
  const cssW=parseFloat(sourceCanvas?.style?.width || '0');
  const cssH=parseFloat(sourceCanvas?.style?.height || '0');
  const sx=cssW>0 ? (sourceCanvas.width/cssW) : 1;
  const sy=cssH>0 ? (sourceCanvas.height/cssH) : sx;
  return Math.max(1, Math.min(sx || 1, sy || sx || 1));
}

function clampExportSurfaceSize(width, height){
  const maxEdge=9000;
  const maxPixels=36000000;
  const edgeScale=Math.min(1, maxEdge/Math.max(1,width), maxEdge/Math.max(1,height));
  const pixelScale=Math.min(1, Math.sqrt(maxPixels/Math.max(1,width*height)));
  const scale=Math.min(edgeScale, pixelScale);
  return {
    width:Math.max(1, Math.round(width*scale)),
    height:Math.max(1, Math.round(height*scale))
  };
}

function buildHighResExportSurface(sourceCanvas, key, scaleMult=1){
  const intrinsicScale=getCanvasIntrinsicScale(sourceCanvas);
  const targetFactor=intrinsicScale>=2
    ? Math.max(1, Math.round(scaleMult || 1))
    : Math.max(1, Math.round((Math.max(2, EXPORT_IMAGE_SCALE||4))*scaleMult));
  const dims=clampExportSurfaceSize(
    Math.max(1, Math.round(sourceCanvas.width*targetFactor)),
    Math.max(1, Math.round(sourceCanvas.height*targetFactor))
  );
  const out=document.createElement('canvas');
  out.width=dims.width;
  out.height=dims.height;
  const ctx=out.getContext('2d');
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,out.width,out.height);
  ctx.drawImage(sourceCanvas,0,0,sourceCanvas.width,sourceCanvas.height,0,0,out.width,out.height);
  return out;
}

function makeViewerCanvasImage(sourceCanvas, key){
  const targetW=key==='q' ? 700 : 600;
  const minH=key==='q' ? Math.round(getBaseCanvasHeight(key)*(targetW/640)) : Math.round(getBaseCanvasHeight(key)*(targetW/500));
  const targetH=Math.max(minH, Math.round(sourceCanvas.height * (targetW / Math.max(1, sourceCanvas.width))));
  const out=document.createElement('canvas');
  out.width=targetW;
  out.height=targetH;
  const ctx=out.getContext('2d');
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,targetW,targetH);
  const drawH=Math.round(sourceCanvas.height * (targetW / Math.max(1, sourceCanvas.width)));
  const drawY=key==='q' ? 0 : Math.max(0, Math.round((targetH-drawH)/2));
  ctx.drawImage(sourceCanvas,0,0,sourceCanvas.width,sourceCanvas.height,0,drawY,targetW,drawH);
  return out;
}

async function syncBitmapCanvasWithBurnedFiguresAsync(key){
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return false;
  const burned=getBurnedFigureStore(key);
  if(!burned.length) return false;
  const desiredH=getDesiredCanvasHeight(key, key==='q' ? 12 : 8);
  const logicalH=Math.max(getBaseCanvasHeight(key), Math.min(cv.height, desiredH));
  const exportScale=Math.max(2, EXPORT_IMAGE_SCALE);
  const surface=document.createElement('canvas');
  surface.width=Math.max(1, Math.round(cv.width*exportScale));
  surface.height=Math.max(1, Math.round(logicalH*exportScale));
  const ctx=surface.getContext('2d');
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.fillStyle='#fff';
  ctx.fillRect(0,0,surface.width,surface.height);
  ctx.drawImage(cv,0,0,cv.width,logicalH,0,0,surface.width,surface.height);
  await drawBurnedFigureLayerOnCanvas(ctx, key, exportScale);
  const fullDataUrl=surface.toDataURL('image/png');
  const viewerDataUrl=makeViewerCanvasImage(surface, key).toDataURL('image/png');
  storeCanvasImagesForKey(key, cv.toDataURL('image/png'), fullDataUrl, viewerDataUrl);
  setFrameBitmapDirty(key, false);
  saveLS();
  return true;
}

function getStoredImg(key){
  if(!cur) return null;
  if(key==='q') return cur.questionImage||null;
  if(key.startsWith('opt')){ const idx=+key.slice(3); return cur.options[idx]?.image||null; }
  return null;
}

async function syncCanvasAssetForKeyAsync(key, opts={}){
  if(!cur) return;
  const cv=document.getElementById(key+'Canvas');
  if(!cv) return;
  const allowBitmapFallback=opts.allowBitmapFallback!==false;
  const mode=(typeof getFrameRenderMode==='function') ? getFrameRenderMode(key) : 'bitmap';
  const composerHtml=(typeof getComposerSourceHTML==='function') ? String(getComposerSourceHTML(key)||'').trim() : '';
  if(mode==='source' && composerHtml && typeof renderMixedComposerCanvas==='function'){
    try{
      const host=document.createElement('div');
      host.innerHTML=composerHtml;
      let surface=await renderMixedComposerCanvas(host, key);
      if(getBurnedFigureImage(key) || getFigureStore(key).length){
        surface=await composeSourceSurfaceWithCanvasFigures(surface, key);
      }else{
        surface=await flattenCanvasSurfaceWithFigures(surface, key);
      }
      const exportSurface=(typeof buildHighResExportSurface==='function') ? buildHighResExportSurface(surface, key, 1) : surface;
      const fullDataUrl=exportSurface.toDataURL('image/png');
      const viewerDataUrl=makeViewerCanvasImage(surface, key).toDataURL('image/png');
      const baseDataUrl=cv.toDataURL('image/png');
      storeCanvasImagesForKey(key, baseDataUrl, fullDataUrl, viewerDataUrl);
      return;
    }catch(err){
      console.warn('Source composer export sync failed; keeping source frame instead of bitmap fallback:', key, err);
      if(!allowBitmapFallback || composerHtml) return;
    }
    if(!allowBitmapFallback) return;
  }
  if(mode==='bitmap' && getBurnedFigureStore(key).length){
    const ok=await syncBitmapCanvasWithBurnedFiguresAsync(key);
    if(ok) return;
  }
  if(mode==='bitmap' && !isFrameBitmapDirty(key) && getStoredImg(key)) return;
  saveCanvasToQ(key);
}

async function syncCurrentEditorCanvasAssetsForExportAsync(){
  try{
    if(!cur) return;
    await syncCanvasAssetForKeyAsync('q');
    if(Array.isArray(cur.options)){
      for(let idx=0; idx<cur.options.length; idx++){
        await syncCanvasAssetForKeyAsync('opt'+idx);
      }
    }
    saveLS();
  }catch(_){ }
}

function syncCurrentEditorCanvasAssetsForExport(){
  try{
    syncCurrentEditorCanvasAssetsForExportAsync();
  }catch(_){ }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•



