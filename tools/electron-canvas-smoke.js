const path = require('path');
const { app, BrowserWindow } = require('electron');

app.disableHardwareAcceleration();
app.commandLine.appendSwitch('force-color-profile', 'srgb');
app.commandLine.appendSwitch('disable-lcd-text');
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-accelerated-2d-canvas');

async function run() {
  const win = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });
  const rendererErrors=[];
  win.webContents.on('console-message',(_event,level,message)=>{
    if(level>=3) rendererErrors.push(String(message||''));
  });
  await win.loadFile(path.resolve(__dirname,'..','qs_studio.html'));
  const result=await win.webContents.executeJavaScript(`(async()=>{
    const deadline=Date.now()+30000;
    while(!(globalThis.MathJax && typeof MathJax.tex2svgPromise==='function')){
      if(Date.now()>deadline) throw new Error('MathJax did not become ready');
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    const initialBufferDeadline=Date.now()+20000;
    while(globalThis.__paperPreparationState?.active){
      if(Date.now()>initialBufferDeadline) break;
      await new Promise(resolve=>setTimeout(resolve,40));
    }
    const initialBuffer={
      state:globalThis.__paperPreparationState||null,
      hidden:document.getElementById('paperLoadOverlay')?.getAttribute('aria-hidden')==='true',
      bodyReleased:!document.body.classList.contains('paper-preparing'),
      shellReleased:!document.querySelector('.shell')?.hasAttribute('inert')
    };

    function pixelStats(source){
      const logicalW=Math.max(1,Math.round(parseFloat(source.style.width)||source.width));
      const logicalH=Math.max(1,Math.round(parseFloat(source.style.height)||source.height));
      const display=document.createElement('canvas');
      display.width=logicalW;
      display.height=logicalH;
      const ctx=display.getContext('2d',{willReadFrequently:true});
      ctx.imageSmoothingEnabled=true;
      ctx.imageSmoothingQuality='high';
      ctx.fillStyle='#fff';
      ctx.fillRect(0,0,logicalW,logicalH);
      ctx.drawImage(source,0,0,source.width,source.height,0,0,logicalW,logicalH);
      const data=ctx.getImageData(0,0,logicalW,logicalH).data;
      const ink=new Uint8Array(logicalW*logicalH);
      let minX=logicalW,minY=logicalH,maxX=-1,maxY=-1,darkPixels=0;
      for(let y=0;y<logicalH;y++) for(let x=0;x<logicalW;x++){
        const i=(y*logicalW+x)*4;
        const lum=data[i]*.299+data[i+1]*.587+data[i+2]*.114;
        if(data[i+3]>8 && lum<220){
          ink[y*logicalW+x]=1;
          darkPixels++;
          minX=Math.min(minX,x); minY=Math.min(minY,y);
          maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
        }
      }
      const seen=new Uint8Array(ink.length);
      let components=0,singlePixelComponents=0;
      const queue=[];
      for(let pos=0;pos<ink.length;pos++){
        if(!ink[pos]||seen[pos]) continue;
        components++; seen[pos]=1; queue.length=0; queue.push(pos);
        let area=0;
        for(let q=0;q<queue.length;q++){
          const current=queue[q]; area++;
          const cx=current%logicalW,cy=Math.floor(current/logicalW);
          for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
            if(!dx&&!dy) continue;
            const nx=cx+dx,ny=cy+dy;
            if(nx<0||ny<0||nx>=logicalW||ny>=logicalH) continue;
            const next=ny*logicalW+nx;
            if(ink[next]&&!seen[next]){seen[next]=1;queue.push(next);}
          }
        }
        if(area===1) singlePixelComponents++;
      }
      return {
        logicalW,logicalH,darkPixels,components,singlePixelComponents,
        inkBounds:maxX>=minX?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:null
      };
    }

    async function renderEquation(name,latex,mathSize,innerMathScale,equationInk){
      const root=document.createElement('div');
      const line=document.createElement('div');
      const equation=document.createElement('span');
      equation.className='composer-eq-token';
      equation.dataset.latex=latex;
      line.appendChild(equation);
      root.appendChild(line);
      const canvas=await renderMixedComposerCanvas(root,'q',{
        key:'q',textSize:14,mathSize,innerMathScale,equationInk,
        renderProfile:'hallmark',frameWidth:640
      });
      const prepared=prepareComposerSurfaceForCanvasApply(canvas,'q');
      const sourceScale=Math.max(1,canvas.width/Math.max(1,parseFloat(canvas.style.width)||canvas.width));
      return {
        name,mathSize,innerMathScale,equationInk,...pixelStats(canvas),
        applyCrop:{x:prepared.sx/sourceScale,y:prepared.sy/sourceScale,w:prepared.logicalWidth,h:prepared.logicalHeight}
      };
    }

    async function renderText(name,text,textSize,equationInk){
      const root=document.createElement('div');
      const line=document.createElement('div');
      line.textContent=text;
      root.appendChild(line);
      const canvas=await renderMixedComposerCanvas(root,'q',{
        key:'q',textSize,mathSize:14,innerMathScale:90,equationInk,
        renderProfile:'hallmark',frameWidth:640
      });
      return {name,textSize,equationInk,...pixelStats(canvas)};
    }

    const repeated='\\\\int_a^b \\\\int_c^d \\\\int_e^f f(x)\\\\,dx\\\\,dy\\\\,dz';
    const simple='\\\\int_a^b f(x)\\\\,dx';
    const cases=[];
    cases.push(await renderEquation('small-repeated-integral',repeated,14,90,'regular'));
    cases.push(await renderEquation('default-repeated-integral',repeated,22,115,'regular'));
    cases.push(await renderEquation('regular-ink',simple,22,115,'regular'));
    cases.push(await renderEquation('bold-ink',simple,22,115,'bold'));
    cases.push(await renderEquation('extra-bold-ink',simple,22,115,'extra'));
    cases.push(await renderEquation('small-nested-fraction','\\\\frac{1}{1+\\\\frac{x}{\\\\sqrt{1+x^2}}}',14,90,'regular'));
    cases.push(await renderEquation('small-compact-atom','x_i^2',14,90,'regular'));
    cases.push(await renderText('small-prose-regular','dfvdff fg gf ngfn gf g v',14,'regular'));
    cases.push(await renderText('small-prose-extra-bold','dfvdff fg gf ngfn gf g v',14,'extra'));

    const byName=Object.fromEntries(cases.map(item=>[item.name,item]));
    const failures=[];
    if(!initialBuffer.state || initialBuffer.state.active || !initialBuffer.hidden || !initialBuffer.bodyReleased || !initialBuffer.shellReleased){
      failures.push('initial paper preparation buffer did not release cleanly');
    }
    if(!document.getElementById('qCanvas')){
      cur=normalizeQuestion({
        id:'electron-smoke-question',qid:'SMOKE-Q1',type:'MCQ',
        subject:subjects[0]?.short||'EC',marks:2,negMarks:-.67
      });
      qs=[cur];
      renderEditor();
      await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    }
    const qCanvas=document.getElementById('qCanvas');
    const qWrap=document.getElementById('qCanvasWrap');
    const frameStyle=qWrap ? getComputedStyle(qWrap) : null;
    const canvasStyle=qCanvas ? getComputedStyle(qCanvas) : null;
    if(!frameStyle || frameStyle.overflow!=='hidden' || !canvasStyle || parseFloat(canvasStyle.marginLeft)!==0){
      failures.push('canvas is not left-pinned and clipped inside its frame');
    }
    let oneClickComposer=false;
    if(qCanvas){
      const rect=qCanvas.getBoundingClientRect();
      qCanvas.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,pointerId:91,clientX:rect.left+8,clientY:rect.top+8}));
      await new Promise(resolve=>setTimeout(resolve,30));
      oneClickComposer=!!document.getElementById('mixedComposerEditor');
      if(oneClickComposer && typeof closeModal==='function') closeModal();
    }
    if(!oneClickComposer) failures.push('one canvas click did not open Hallmark Composer in Text mode');
    const small=byName['small-repeated-integral'];
    const normal=byName['default-repeated-integral'];
    if(!small.inkBounds || small.inkBounds.h>34) failures.push('Math 14 / Inner 90 integral ink is still inflated');
    if(!small.applyCrop || small.applyCrop.x>12 || small.applyCrop.y>12) failures.push('Hallmark content is not prepared from the top-left edge');
    if(!normal.inkBounds || normal.inkBounds.h<small.inkBounds.h) failures.push('math size selector is not visually monotonic');
    const regular=byName['regular-ink'].darkPixels;
    const bold=byName['bold-ink'].darkPixels;
    const extra=byName['extra-bold-ink'].darkPixels;
    if(!(regular<bold && bold<extra)) failures.push('Regular/Bold/Extra bold are not visually distinct');
    if(!(byName['small-prose-regular'].darkPixels<byName['small-prose-extra-bold'].darkPixels)) failures.push('small prose ink levels are not visually distinct');
    if(!byName['small-compact-atom'].inkBounds || byName['small-compact-atom'].inkBounds.h>22) failures.push('small compact atom is vertically distorted');
    for(const item of cases){
      const allowed=Math.max(2,Math.floor(item.components*.08));
      if(item.singlePixelComponents>allowed) failures.push(item.name+' has isolated display-noise pixels');
    }
    const fallbackCanvas=document.createElement('canvas');
    fallbackCanvas.width=8; fallbackCanvas.height=8;
    const fallbackCtx=fallbackCanvas.getContext('2d');
    fallbackCtx.fillStyle='#fff'; fallbackCtx.fillRect(0,0,8,8);
    const storedFallback=fallbackCanvas.toDataURL('image/png');
    const fallbackAssets=await buildExportAssetsForQuestionRecord({
      questionComposerHTML:'<div>Fallback integrity test</div>',
      questionComposerTextSize:14,questionComposerMathSize:14,questionComposerInnerMathScale:90,
      questionComposerEquationInk:'regular',questionRenderMode:'source',questionImage:storedFallback,
      questionFigures:[{src:'data:image/png;base64,definitely-invalid',x:0,y:0,w:20,h:20,crop:{l:0,t:0,r:0,b:0}}],
      questionBurnedFigures:[],options:[]
    });
    if(fallbackAssets.questionRenderStatus!=='stored-fallback' || fallbackAssets.questionImage!==storedFallback){
      failures.push('failed figure composition did not preserve the complete stored fallback');
    }

    const sourceOnlySvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 30"><path d="M2 15H78" fill="none" stroke="#111" stroke-width="3"/><circle cx="40" cy="15" r="10" fill="white" stroke="#111" stroke-width="3"/></svg>';
    const parityRecord=normalizeQuestion({
      id:'electron-json-pdf-parity',qid:'SMOKE-PARITY',type:'MCQ',
      subject:subjects[0]?.short||'EC',marks:2,negMarks:-.67,
      questionText:'JSON PDF parity question',
      questionComposerHTML:'<div>JSON PDF parity question</div>',
      questionComposerTextSize:14,questionComposerMathSize:14,questionComposerInnerMathScale:90,
      questionComposerEquationInk:'extra',questionRenderMode:'source',
      questionFigures:[{src:'',sourceSvg:sourceOnlySvg,kind:'circuit-svg',circuitScene:{version:3,wires:[{x1:2,y1:15,x2:78,y2:15}]},x:220,y:8,w:160,h:60,crop:{l:0,t:0,r:0,b:0}}],
      options:[
        {oid:'SMOKE-PARITY-A',text:'First high quality option',composerHTML:'<div>First high quality option</div>',composerTextSize:14,composerMathSize:14,composerInnerMathScale:90,composerEquationInk:'regular',renderMode:'source'},
        {oid:'SMOKE-PARITY-B',text:'Second high quality option',composerHTML:'<div>Second high quality option</div>',composerTextSize:14,composerMathSize:14,composerInnerMathScale:90,composerEquationInk:'bold',renderMode:'source'}
      ]
    });
    cur=parityRecord;
    qs=[parityRecord];
    renderEditor();
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    const sourceOnlyOverlayVisible=!!document.querySelector('#qCanvasWrap .figure-item img[src^="data:image/svg+xml"]');
    if(!sourceOnlyOverlayVisible) failures.push('sourceSvg-only circuit did not survive import into the canvas overlay');
    let capturedPaperJson='';
    const originalDlBlob=globalThis.dlBlob;
    globalThis.dlBlob=(data,_name,type)=>{
      if(String(type||'').startsWith('application/json')) capturedPaperJson=String(data||'');
    };
    try{
      await exportPaperJSON();
    }finally{
      globalThis.dlBlob=originalDlBlob;
    }
    if(!capturedPaperJson) failures.push('Paper JSON export was not captured');
    const paperJson=capturedPaperJson ? JSON.parse(capturedPaperJson) : null;
    const directPdfAssets=await buildExportAssetsForQuestionRecord(parityRecord);
    const exportedQuestion=paperJson?.questions?.[0];
    const exportedOptionA=exportedQuestion?.options?.A;
    if(exportedQuestion?.question_image!==directPdfAssets.questionImage){
      failures.push('Paper JSON question image differs from the full asset selected first by PDF');
    }
    if(exportedOptionA?.image!==directPdfAssets.optionAssets?.[0]?.full){
      failures.push('Paper JSON option image differs from the full asset selected first by PDF');
    }
    if(!isUsableRasterDataUrl(exportedQuestion?.question_image) || !isUsableRasterDataUrl(exportedOptionA?.image)){
      failures.push('Paper JSON contains an unusable question or option raster');
    }
    const fullQuestionImg=await loadImg(exportedQuestion?.question_image||'');
    const viewerQuestionImg=await loadImg(exportedQuestion?.question_viewer_image||'');
    const fullOptionImg=await loadImg(exportedOptionA?.image||'');
    const viewerOptionImg=await loadImg(exportedOptionA?.viewer_image||'');
    const jsonPdfParity={
      exactQuestionAsset:exportedQuestion?.question_image===directPdfAssets.questionImage,
      exactOptionAsset:exportedOptionA?.image===directPdfAssets.optionAssets?.[0]?.full,
      questionFull:[fullQuestionImg.naturalWidth,fullQuestionImg.naturalHeight],
      questionViewer:[viewerQuestionImg.naturalWidth,viewerQuestionImg.naturalHeight],
      optionFull:[fullOptionImg.naturalWidth,fullOptionImg.naturalHeight],
      optionViewer:[viewerOptionImg.naturalWidth,viewerOptionImg.naturalHeight],
      lossless:paperJson?.render_quality?.raster_lossless===true
    };
    if(jsonPdfParity.questionFull[0]<=jsonPdfParity.questionViewer[0] || jsonPdfParity.optionFull[0]<=jsonPdfParity.optionViewer[0]){
      failures.push('Paper JSON primary images were downgraded to viewer-preview resolution');
    }
    if(!jsonPdfParity.lossless) failures.push('Paper JSON did not declare complete lossless raster quality');
    if(exportedQuestion?.question_vector_figures?.[0]?.source_svg!==sourceOnlySvg){
      failures.push('Paper JSON dropped editable sourceSvg circuit metadata');
    }
    jsonPdfParity.sourceOnlyOverlayVisible=sourceOnlyOverlayVisible;
    jsonPdfParity.editableVectorRecords=paperJson?.render_quality?.editable_vector_records||0;

    let downloadCalls=0,pickerCalls=0,payloadBuilds=0,saveNotices=0;
    const savedDlBlob=globalThis.dlBlob;
    const savedBuildBankPayload=globalThis._buildBankPayload;
    const savedShowNotice=globalThis.showNotice;
    const savedPicker=window.showSaveFilePicker;
    const hadPicker=Object.prototype.hasOwnProperty.call(window,'showSaveFilePicker');
    try{
      globalThis.dlBlob=()=>{ downloadCalls++; };
      globalThis._buildBankPayload=async()=>{ payloadBuilds++; return '{"safe":true}'; };
      globalThis.showNotice=()=>{ saveNotices++; };
      window.showSaveFilePicker=async()=>{ pickerCalls++; throw new DOMException('Denied by smoke test','NotAllowedError'); };

      _fileHandle=null;
      _fileHandleWritable=false;
      _autoSaveSuppression=0;
      _saveInProgress=null;
      await saveToFile(true);
      const noHandlePayloadBuilds=payloadBuilds;

      _fileHandle={
        name:'read-only-smoke.qbank.json',
        queryPermission:async()=> 'granted',
        createWritable:async()=>{ throw new DOMException('Write denied','NotAllowedError'); }
      };
      _fileHandleWritable=true;
      await saveToFile(true);

      _fileHandle=null;
      _fileHandleWritable=false;
      await saveToFile(false);
      if(noHandlePayloadBuilds!==0) failures.push('silent save without a handle built a payload');
      if(downloadCalls!==0) failures.push('denied or silent project save triggered a download');
      if(pickerCalls!==1) failures.push('silent project save opened a file picker');
    }finally{
      globalThis.dlBlob=savedDlBlob;
      globalThis._buildBankPayload=savedBuildBankPayload;
      globalThis.showNotice=savedShowNotice;
      if(hadPicker) window.showSaveFilePicker=savedPicker;
      else delete window.showSaveFilePicker;
      _fileHandle=null;
      _fileHandleWritable=false;
      _saveInProgress=null;
    }
    const downloadSafety={downloadCalls,pickerCalls,payloadBuilds,saveNotices};

    const previewRecords=Array.from({length:24},(_,index)=>normalizeQuestion({
      id:'buffer-'+index,qid:'BUFFER-'+(index+1),type:'MCQ',subject:subjects[0]?.short||'EC',marks:2,negMarks:-.67,
      questionText:'',questionImage:storedFallback,questionBaseImage:storedFallback,questionViewerImage:storedFallback,
      options:Array.from({length:4},(__,optionIndex)=>({
        oid:'BUFFER-'+(index+1)+'-'+optionIndex,text:'',image:storedFallback,baseImage:storedFallback,viewerImage:storedFallback,
        renderMode:'bitmap',figures:[],legends:[],correct:false
      }))
    }));
    qs=previewRecords;
    cur=previewRecords[0];
    const bufferToken=beginPaperPreparation({reason:'electron-buffer-smoke',title:'Preparing smoke paper'});
    renderSidebar();
    renderEditor();
    renderPaper(true);
    const shell=document.querySelector('.shell');
    const activeAtStart=document.getElementById('paperLoadOverlay')?.classList.contains('is-active') &&
      document.body.classList.contains('paper-preparing') && shell?.hasAttribute('inert');
    const bufferReport=await preparePaperWorkspace({token:bufferToken,reason:'electron-buffer-smoke',minVisibleMs:260,hardTimeoutMs:9000});
    const previewImages=[...document.querySelectorAll('#paperBody img')];
    const allPreviewImagesReady=previewImages.length===120 && previewImages.every(img=>
      !img.hasAttribute('data-src') && img.complete && img.naturalWidth>0 && img.dataset.paperLoadState==='ready'
    );
    const releasedAfterBuffer=!document.getElementById('paperLoadOverlay')?.classList.contains('is-active') &&
      !document.body.classList.contains('paper-preparing') && !shell?.hasAttribute('inert');
    if(!activeAtStart) failures.push('paper buffer did not immediately block the workspace');
    if(!allPreviewImagesReady) failures.push('paper buffer released before all viewer images were decoded');
    if(!releasedAfterBuffer || bufferReport.timedOut) failures.push('paper buffer failed to release normally after readiness');
    const paperBuffer={initialBuffer,activeAtStart,releasedAfterBuffer,allPreviewImagesReady,imageCount:previewImages.length,report:bufferReport};

    return {ok:failures.length===0,failures,cases,oneClickComposer,exportFallbackStatus:fallbackAssets.questionRenderStatus,jsonPdfParity,downloadSafety,paperBuffer};
  })()`,true);
  if(rendererErrors.length) result.rendererErrors=rendererErrors.slice(0,10);
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
  await win.close();
  return result.ok ? 0 : 1;
}

app.whenReady().then(async()=>{
  try{
    const code=await run();
    app.exit(code);
  }catch(err){
    process.stderr.write(String(err?.stack||err)+'\n');
    app.exit(1);
  }
});
