// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  EXPORT: PAPER JSON  â€” matches exam viewer format exactly
//  question_image = base64 PNG
//  options = { A: base64_png, B: base64_png, ... }
//  NO answer key inside
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function dataUrlToViewerImage(dataUrl, key){
  if(!dataUrl || !/^data:image\/png/i.test(dataUrl)) return dataUrl || '';
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const targetW=key==='q' ? 700 : 600;
        const minH=key==='q' ? Math.round(getBaseCanvasHeight(key)*(targetW/640)) : Math.round(getBaseCanvasHeight(key)*(targetW/500));
        const targetH=Math.max(minH, Math.round((img.naturalHeight||img.height||minH) * (targetW / Math.max(1, img.naturalWidth||img.width||targetW))));
        const out=document.createElement('canvas');
        out.width=targetW;
        out.height=targetH;
        const ctx=out.getContext('2d');
        ctx.imageSmoothingEnabled=true;
        ctx.imageSmoothingQuality='high';
        ctx.fillStyle='#fff';
        ctx.fillRect(0,0,targetW,targetH);
        const srcW=img.naturalWidth||img.width||targetW;
        const srcH=img.naturalHeight||img.height||minH;
        const drawH=Math.round(srcH * (targetW / Math.max(1, srcW)));
        const drawY=0;
        ctx.drawImage(img,0,0,srcW,srcH,0,drawY,targetW,drawH);
        resolve(out.toDataURL('image/png'));
      }catch(_){
        resolve(dataUrl);
      }
    };
    img.onerror=()=>resolve(dataUrl);
    img.src=dataUrl;
  });
}

function safeCanvasDataUrl(canvas, type='image/png', quality){
  try{
    if(!canvas || !canvas.width || !canvas.height) return '';
    return quality === undefined ? canvas.toDataURL(type) : canvas.toDataURL(type, quality);
  }catch(err){
    console.warn('Canvas export skipped:', err);
    return '';
  }
}

function isUsableRasterDataUrl(value){
  const dataUrl=String(value||'').trim();
  const match=dataUrl.match(/^data:image\/(?:png|jpe?g|webp);base64,([a-z0-9+/]+={0,2})$/i);
  return !!(match && match[1].length>=32);
}

function buildHighResExportDataUrlFromSurface(surface, key){
  if(!surface) return '';
  try{
    if(typeof buildHighResExportSurface==='function') return safeCanvasDataUrl(buildHighResExportSurface(surface, key, 1), 'image/png');
  }catch(_){ }
  return safeCanvasDataUrl(surface, 'image/png');
}

function getCurrentExportIdentity(){
  if(typeof getExportIdentity==='function') return getExportIdentity();
  const projectName=String(examName||'Untitled Project').trim() || 'Untitled Project';
  const slug=projectName.replace(/[^a-zA-Z0-9 _\-]/g,'').trim().replace(/\s+/g,'_') || 'qs-project';
  const bankId='BK'+Date.now().toString(36).toUpperCase();
  return {
    projectName,
    slug,
    bankId,
    paperId:`${bankId}-QP`,
    keyId:`${bankId}-AK`,
    fileStem:slug,
    names:{
      paperJSON:`${slug}_qspaper.json`,
      keyJSON:`${slug}_key.json`,
      paperPDF:`${slug}_qspaper.pdf`,
      keyPDF:`${slug}_key.pdf`
    }
  };
}

function exportIdentityFields(identity, role){
  return {
    project_name: identity.projectName,
    bank_id: identity.bankId,
    export_set_id: identity.bankId,
    paper_id: identity.paperId,
    key_id: identity.keyId,
    export_role: role,
    expected_pair: role==='answer_key' ? identity.paperId : identity.keyId,
    file_stem: identity.fileStem
  };
}

function isStrictExportQuestionId(value){
  return /^[A-Z]{2,6}\d{10}QS\d+$/i.test(String(value||'').trim());
}

function cleanExportToken(value, fallback='GEN'){
  const token=String(value || '').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0, 6);
  return token || fallback;
}

function exportStateSignature(records=qs){
  const list=Array.isArray(records) ? records : [];
  const parts=list.map((q, index)=>[
    String(q?.qid || '').trim(),
    String(q?.subject || '').trim(),
    String(q?.label || '').trim(),
    String(q?.topic || '').trim(),
    String(q?.difficulty || '').trim(),
    String(q?.marks || '').trim(),
    index + 1
  ].join('|'));
  return [
    ensureBankUid(),
    String(examName || '').trim(),
    list.length,
    parts.join('||')
  ].join('###');
}

function hashUnsigned32(input, seed=2166136261){
  let h=seed >>> 0;
  const text=String(input || '');
  for(let i=0;i<text.length;i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function hashDigits(input, count){
  let out='';
  let salt=0;
  while(out.length < count){
    out += String(hashUnsigned32(`${input}|${salt++}`));
  }
  return out.replace(/\D/g,'').padEnd(count,'0').slice(0, count);
}

function hashAlphaNum(input, count){
  const chars='abcdefghijklmnopqrstuvwxyz0123456789';
  let out='';
  let salt=0;
  while(out.length < count){
    let h=hashUnsigned32(`${input}|${salt++}`);
    for(let i=0;i<7 && out.length < count;i++){
      out += chars.charAt(h % chars.length);
      h = Math.floor(h / chars.length);
    }
  }
  return out.slice(0, count);
}

function groupedLicenseKey(text){
  const raw=String(text || '').replace(/[^a-z0-9]/gi,'').toLowerCase().padEnd(20, '0').slice(0, 20);
  return `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}`;
}

let exportAuthSessionCache = null;

function nowEpochMicros(){
  return Date.now() * 1000;
}

function randomAlphaNum(count){
  const chars='abcdefghijklmnopqrstuvwxyz0123456789';
  let out='';
  if(globalThis.crypto?.getRandomValues){
    const bytes=new Uint8Array(Math.max(count, 8));
    globalThis.crypto.getRandomValues(bytes);
    for(let i=0;i<count;i++) out += chars.charAt(bytes[i] % chars.length);
    return out;
  }
  while(out.length < count){
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function exportSessionKey(records=qs){
  return exportStateSignature(records);
}

function getExportAuthBundle(records=qs){
  const signature=exportSessionKey(records);
  if(exportAuthSessionCache?.signature===signature) return exportAuthSessionCache.bundle;
  const paperLicenseKey=groupedLicenseKey(randomAlphaNum(20));
  const paperCreatedEpochMicros=nowEpochMicros();
  const answerKeyLicenseKey=`${paperLicenseKey}-${randomAlphaNum(7)}`;
  const bundle={
    paperLicenseKey,
    paperCreatedEpochMicros,
    answerKeyLicenseKey
  };
  exportAuthSessionCache={ signature, bundle };
  return bundle;
}

function exportAuthFields(auth, role){
  const bundle=auth || getExportAuthBundle(qs);
  const fields={
    license_key: bundle.paperLicenseKey,
    paper_license_key: bundle.paperLicenseKey,
    license_created_epoch_micros: bundle.paperCreatedEpochMicros,
    paper_created_epoch_micros: bundle.paperCreatedEpochMicros,
    license_auth_required: true
  };
  if(role==='answer_key'){
    fields.source_license_key = bundle.paperLicenseKey;
    fields.answer_key_license_key = bundle.answerKeyLicenseKey;
    fields.answer_key_instance_key = bundle.answerKeyLicenseKey;
    fields.answer_key_created_epoch_micros = Date.now()*1000;
    fields.paired_paper_license_key = bundle.paperLicenseKey;
    fields.paired_answer_key_license_key = bundle.answerKeyLicenseKey;
  }else{
    fields.answer_key_license_key = bundle.answerKeyLicenseKey;
    fields.paired_paper_license_key = bundle.paperLicenseKey;
    fields.paired_answer_key_license_key = bundle.answerKeyLicenseKey;
  }
  return fields;
}

function buildExportQuestionId(q, index){
  const sourceQuestionId=String(q?.qid || '').trim();
  if(isStrictExportQuestionId(sourceQuestionId)) return sourceQuestionId.toUpperCase();
  const prefix=cleanExportToken(q?.subject || q?.section || q?.subjectShort || 'GEN', 'GEN');
  const digits=hashDigits([
    ensureBankUid(),
    sourceQuestionId,
    prefix,
    index + 1,
    String(q?.questionText || '').slice(0, 64),
    String(q?.topic || '').slice(0, 32)
  ].join('|'), 10);
  return `${prefix}${digits}QS${index+1}`;
}

function buildExportOptionIds(q, index, exportQuestionId){
  if(q?.type==='NAT') return null;
  const out={};
  const count=Array.isArray(q?.options) ? q.options.length : 0;
  for(let j=0; j<count; j++){
    const letter=String.fromCharCode(65+j);
    out[letter] = `${exportQuestionId}_OP${letter}${j+1}`;
  }
  return out;
}

function buildSourceOptionIds(q){
  if(q?.type==='NAT') return null;
  return (Array.isArray(q?.options) ? q.options : []).reduce((acc, o, j)=>{
    acc[String.fromCharCode(65+j)] = String(o?.oid || genOid(q.qid, j+1) || '').trim();
    return acc;
  }, {});
}

function buildExportQuestionIdentity(q, index){
  const exportQuestionId=buildExportQuestionId(q, index);
  const sourceQuestionId=String(q?.qid || '').trim() || exportQuestionId;
  const optionIds=buildExportOptionIds(q, index, exportQuestionId);
  const sourceOptionIds=buildSourceOptionIds(q);
  return {
    exportQuestionId,
    sourceQuestionId,
    optionIds,
    sourceOptionIds,
    legacyDetected: exportQuestionId !== sourceQuestionId
  };
}

function hasLegacyExportQuestions(records=qs){
  return (Array.isArray(records) ? records : []).some((q, index)=>buildExportQuestionIdentity(q, index).legacyDetected);
}

function parseNatAnswerExport(value){
  const raw=String(value || '').trim();
  const canonical=raw.replace(/\u2212/g, '-');
  const safeRange = canonical.match(/^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*(?:to|\.\.|-|‒|–|—|−)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)\s*$/i);
  if(safeRange){
    const left=String(safeRange[1]).trim();
    const right=String(safeRange[2]).trim();
    const leftNum=Number(left);
    const rightNum=Number(right);
    const lower=Number.isFinite(leftNum) && Number.isFinite(rightNum) ? String(Math.min(leftNum, rightNum)) : left;
    const upper=Number.isFinite(leftNum) && Number.isFinite(rightNum) ? String(Math.max(leftNum, rightNum)) : right;
    return {
      correct_answer: `${lower}-${upper}`,
      nat_answer_mode: 'range',
      nat_answer_range: {
        lower,
        upper,
        inclusive: true,
        sign_policy: 'absolute-or-signed'
      },
      nat_range_sign_mode: 'absolute-or-signed'
    };
  }
  return {
    correct_answer: canonical || '(not set)',
    nat_answer_mode: 'exact',
    nat_answer_value: canonical || ''
  };
}

function getQuestionClassificationFields(q){
  const topic = typeof normalizeQuestionTopic==='function'
    ? normalizeQuestionTopic(q?.topic || q?.topicName || q?.topic_name)
    : String(q?.topic || q?.topicName || q?.topic_name || '').trim();
  const topicCode = typeof topicCodeFromName==='function'
    ? topicCodeFromName(q?.topicCode || q?.topic_code || topic)
    : String(q?.topicCode || q?.topic_code || topic || '').trim();
  const difficulty = typeof normalizeDifficulty==='function'
    ? normalizeDifficulty(q?.difficulty || q?.difficultyLevel || q?.level)
    : String(q?.difficulty || 'Medium');
  return {
    topic,
    topic_code: topicCode,
    difficulty,
    selection_meta: {
      topic,
      topic_code: topicCode,
      difficulty
    }
  };
}

function buildQuestionClassificationSummary(records){
  const topicMap=new Map();
  const difficultyCounts={Easy:0, Medium:0, Tough:0};
  (Array.isArray(records) ? records : []).forEach(q=>{
    const meta=getQuestionClassificationFields(q);
    difficultyCounts[meta.difficulty]=(difficultyCounts[meta.difficulty] || 0) + 1;
    const key=meta.topic_code || 'UNASSIGNED';
    if(!topicMap.has(key)){
      topicMap.set(key,{
        topic: meta.topic || 'Unassigned',
        topic_code: meta.topic_code || '',
        question_count: 0,
        total_marks: 0,
        difficulty_counts: {Easy:0, Medium:0, Tough:0}
      });
    }
    const row=topicMap.get(key);
    row.question_count += 1;
    row.total_marks += +(q?.marks || 0);
    row.difficulty_counts[meta.difficulty]=(row.difficulty_counts[meta.difficulty] || 0) + 1;
  });
  return {
    topic_count: topicMap.size,
    topics: [...topicMap.values()].sort((a,b)=>a.topic.localeCompare(b.topic)),
    difficulty_counts: difficultyCounts
  };
}

function buildTopicAwareQuestionAlias(q, index){
  const meta=getQuestionClassificationFields(q);
  const subject=String(q?.subject || 'SUBJ').replace(/[^a-zA-Z0-9]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase() || 'SUBJ';
  const topic=meta.topic_code || 'UNTOPIC';
  const difficulty=String(meta.difficulty || 'Medium').toUpperCase();
  return `${subject}-${topic}-${difficulty}-Q${String((+index || 0)+1).padStart(4,'0')}`;
}

function buildTopicAwareOptionAliases(q, index){
  if(q?.type==='NAT') return null;
  const base=buildTopicAwareQuestionAlias(q, index);
  const count=Array.isArray(q?.options) ? q.options.length : 0;
  return Array.from({length:count}).reduce((acc,_,j)=>{
    acc[String.fromCharCode(65+j)] = `${base}-${String.fromCharCode(65+j)}`;
    return acc;
  },{});
}

async function buildExportAssetsForQuestionRecord(q){
    const renderContextFor=(key,record,option=false)=>({
      key,
      textSize:clampSelectableComposerTextSize(option ? record?.composerTextSize : record?.questionComposerTextSize),
      mathSize:clampSelectableComposerMathSize(option ? record?.composerMathSize : record?.questionComposerMathSize),
      innerMathScale:clampSelectableComposerInnerScale(option ? record?.composerInnerMathScale : record?.questionComposerInnerMathScale),
      equationInk:typeof clampMixedComposerEquationStroke==='function'
        ? clampMixedComposerEquationStroke(option ? record?.composerEquationInk : record?.questionComposerEquationInk)
        : String((option ? record?.composerEquationInk : record?.questionComposerEquationInk)||'light'),
      renderProfile:'hallmark',
      frameWidth:key==='q' ? 640 : 500
    });
    async function buildForKey(key, record, option, html, fullFallback, viewerFallback, renderMode, figures, burnedFigures, burnedImage, burnedScale){
      const safeHtml=String(html||'').trim();
      const shouldRenderSource=renderMode==='source' || (!renderMode && safeHtml);
      if(shouldRenderSource && safeHtml && typeof renderMixedComposerCanvas==='function'){
        try{
          const host=document.createElement('div');
          host.innerHTML=safeHtml;
          const renderContext=renderContextFor(key,record,option);
          let surface=await renderMixedComposerCanvas(host, key, renderContext);
          if(typeof composeSourceSurfaceWithCanvasFigures==='function' && ((figures||[]).length || (burnedFigures||[]).length || burnedImage)){
            surface=await composeSourceSurfaceWithCanvasFigures(surface, key, {
              frameWidth:renderContext.frameWidth,
              frameHeight:key==='q' ? 90 : 46,
              figures:Array.isArray(figures) ? figures : [],
              burnedFigures:Array.isArray(burnedFigures) ? burnedFigures : [],
              burnedImage:burnedImage || '',
              burnedScale:Math.max(1,Number(burnedScale)||1),
              strictFigures:true
            });
          }
          const full=buildHighResExportDataUrlFromSurface(surface, key);
          const viewer=safeCanvasDataUrl(makeViewerCanvasImage(surface, key), 'image/png');
          if(!isUsableRasterDataUrl(full) || !isUsableRasterDataUrl(viewer)){
            throw new Error('Canvas serialization returned an unusable raster image.');
          }
          return { full, viewer, renderStatus:'source-rendered' };
        }catch(err){
          console.warn('Source export render failed; using stored lossless fallback:', key, err);
        }
      }
      const storedFull=fullFallback || viewerFallback || '';
      const full=isUsableRasterDataUrl(storedFull) ? storedFull : '';
      const storedViewer=viewerFallback || (full ? await dataUrlToViewerImage(full, key) : '');
      const viewer=isUsableRasterDataUrl(storedViewer) ? storedViewer : '';
      return { full, viewer, renderStatus:(full || viewer) ? 'stored-fallback' : 'missing' };
    }
    const questionAssets=await buildForKey(
      'q',q,false,q.questionComposerHTML,q.questionImage,q.questionViewerImage,q.questionRenderMode,
      q.questionFigures,q.questionBurnedFigures,q.questionBurnedFigureImage,q.questionBurnedFigureScale
    );
    const optionAssets=[];
    if(Array.isArray(q.options)){
      for(let j=0; j<q.options.length; j++){
        const opt=q.options[j] || {};
        optionAssets.push(await buildForKey(
          'opt'+j,opt,true,opt.composerHTML,opt.image,opt.viewerImage,opt.renderMode,
          opt.figures,opt.burnedFigures,opt.burnedFigureImage,opt.burnedFigureScale
        ));
      }
    }
    return {
      questionImage: questionAssets.full,
      questionViewerImage: questionAssets.viewer,
      questionRenderStatus: questionAssets.renderStatus,
      optionAssets
    };
}

function exportYield(){
  return new Promise(resolve=>{
    if('requestIdleCallback' in window) requestIdleCallback(()=>resolve(), {timeout:120});
    else setTimeout(resolve, 0);
  });
}

async function buildExportAssetsForAllQuestions(records, label='assets'){
  const out=[];
  const list=Array.isArray(records) ? records : [];
  for(let i=0; i<list.length; i++){
    if(typeof updateExportProgress==='function'){
      updateExportProgress(`Rendering ${label} ${i+1}/${list.length}...`);
    }
    out.push(await buildExportAssetsForQuestionRecord(list[i]));
    await exportYield();
  }
  return out;
}

async function exportPaperJSON(){
  try{ if(typeof syncCurrentEditorCanvasAssetsForExportAsync==='function') await syncCurrentEditorCanvasAssetsForExportAsync(); else if(typeof syncCurrentEditorCanvasAssetsForExport==='function') syncCurrentEditorCanvasAssetsForExport(); }catch(_){ }
  if(!qs.length){showNotice('No questions available to export.', 'Paper JSON');return;}
  const firstMeta = getSubjectMeta(qs[0]?.subject || subjects[0]?.short || 'EC');
  const identity=getCurrentExportIdentity();
  const auth=getExportAuthBundle(qs);
  const legacyUpgradeApplied=hasLegacyExportQuestions(qs);
  const exportAssets = await buildExportAssetsForAllQuestions(qs, 'JSON image assets');
  const cloneExportFigureSet=figures=>{
    try{ return JSON.parse(JSON.stringify(Array.isArray(figures) ? figures : [])); }
    catch(_){ return []; }
  };
  // Keep original SVG figures alongside the PNG export cache. Consumers that support
  // SVG can re-render these without losing circuit-line precision or edit metadata.
  const decodeSvgBase64Utf8=payload=>{
    const binary=atob(String(payload||''));
    try{
      const bytes=Uint8Array.from(binary, ch=>ch.charCodeAt(0));
      return new TextDecoder('utf-8').decode(bytes);
    }catch(_){
      return binary;
    }
  };
  const decodeSvgDataUrl=src=>{
    const value=String(src||'');
    if(!/^data:image\/svg\+xml/i.test(value)) return '';
    const comma=value.indexOf(',');
    if(comma<0) return '';
    const header=value.slice(0,comma), payload=value.slice(comma+1);
    try{ return /;base64/i.test(header) ? decodeSvgBase64Utf8(payload) : decodeURIComponent(payload); }
    catch(_){ return ''; }
  };
  const readSvgViewBox=svg=>{
    const text=String(svg||'');
    const match=text.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
    const nums=match ? match[1].split(/[\s,]+/).map(Number).filter(Number.isFinite) : [];
    if(nums.length>=4) return {x:nums[0],y:nums[1],w:nums[2],h:nums[3]};
    return null;
  };
  const cloneVectorFigureSet=figures=>cloneExportFigureSet(figures).map((fig,index)=>{
    const svg=String(fig?.sourceSvg||'').trim() || decodeSvgDataUrl(fig?.src);
    if(!svg || !/<svg[\s>]/i.test(svg)) return null;
    const viewBox=fig.sourceViewBox || readSvgViewBox(svg);
    return {
      index,
      kind:fig.kind || 'svg-figure',
      x:+fig.x || 0, y:+fig.y || 0, w:+fig.w || 0, h:+fig.h || 0,
      crop:fig.crop || null,
      natural_width:+fig.naturalWidth || +fig.displayWidth || +fig.w || 0,
      natural_height:+fig.naturalHeight || +fig.displayHeight || +fig.h || 0,
      display_width:+fig.displayWidth || +fig.w || 0,
      display_height:+fig.displayHeight || +fig.h || 0,
      source_view_box:viewBox,
      svg,
      svg_data_url:String(fig.src || ''),
      source_svg:String(fig.sourceSvg || ''),
      editable_scene:fig.circuitScene || null
    };
  }).filter(Boolean);
  const buildComposerRenderSource=(record,option=false,asset={})=>{
    const html=String((option ? record?.composerHTML : record?.questionComposerHTML) || '');
    const raster=String(asset?.full || asset?.image || '');
    const rasterUsable=isUsableRasterDataUrl(raster);
    const mimeMatch=raster.match(/^data:(image\/[a-z0-9.+-]+)[;,]/i);
    const rasterMime=mimeMatch ? mimeMatch[1].toLowerCase() : '';
    const renderStatus=String(asset?.renderStatus || (raster ? 'stored-fallback' : 'missing'));
    return {
      schema:'hallmark-source-v1',
      renderer:'hallmark-hd',
      render_mode:String((option ? record?.renderMode : record?.questionRenderMode) || (html.trim() ? 'source' : 'bitmap')),
      composer_html:html,
      text_size:clampSelectableComposerTextSize(option ? record?.composerTextSize : record?.questionComposerTextSize),
      math_size:clampSelectableComposerMathSize(option ? record?.composerMathSize : record?.questionComposerMathSize),
      inner_math_scale:clampSelectableComposerInnerScale(option ? record?.composerInnerMathScale : record?.questionComposerInnerMathScale),
      equation_ink:typeof clampMixedComposerEquationStroke==='function'
        ? clampMixedComposerEquationStroke(option ? record?.composerEquationInk : record?.questionComposerEquationInk)
        : String((option ? record?.composerEquationInk : record?.questionComposerEquationInk)||'light'),
      composer_source_present:!!html.trim(),
      raster_present:rasterUsable,
      raster_format:rasterMime,
      raster_lossless:rasterUsable && rasterMime==='image/png',
      render_status:renderStatus
    };
  };
  const questions = await Promise.all(qs.map(async (q,i)=>{
    const sm=getSubjectMeta(q.subject);
    const exportIdentity=buildExportQuestionIdentity(q, i);
    const assets=exportAssets[i] || {questionImage:q.questionImage||'', questionViewerImage:q.questionViewerImage||'', optionAssets:[]};
    const opts={};
    if(q.type!=='NAT'){
      await Promise.all(q.options.map(async (o,j)=>{
        const optAsset=(assets.optionAssets && assets.optionAssets[j]) || {full:o.image||'', viewer:o.viewerImage||''};
        const fullImage = optAsset.full || o.image || '';
        const viewerImage = optAsset.viewer || o.viewerImage || await dataUrlToViewerImage(fullImage||o.image||'', 'opt'+j);
        opts[String.fromCharCode(65+j)] = {
          image: fullImage || viewerImage,
          viewer_image: viewerImage || fullImage,
          figures: cloneExportFigureSet(o.figures),
          burned_figures: cloneExportFigureSet(o.burnedFigures),
          vector_figures: cloneVectorFigureSet(o.figures),
          burned_vector_figures: cloneVectorFigureSet(o.burnedFigures),
          burned_figure_image: String(o.burnedFigureImage || ''),
          burned_figure_scale: Math.max(1, Number(o.burnedFigureScale)||1),
          selectable_text: typeof getOptionPdfSourceText==='function' ? getOptionPdfSourceText(o) : '',
          render_source:buildComposerRenderSource(o,true,optAsset)
        };
      }));
    }
    return {
      section: getSectionDisplay(sm),
      section_code: sm.section,
      subject_short: sm.short,
      subject_name: sm.full,
      question_number: 'Q.'+(i+1),
      question_type: q.type,
      marks: q.marks,
      negative_marks: q.negMarks,
      question_id: exportIdentity.exportQuestionId,
      bank_question_id: exportIdentity.sourceQuestionId,
      source_question_id: exportIdentity.sourceQuestionId,
      legacy_question_id: exportIdentity.sourceQuestionId,
      export_question_alias: buildTopicAwareQuestionAlias(q, i),
      legacy_id_transformed: exportIdentity.legacyDetected,
      ...getQuestionClassificationFields(q),
      question_selectable_text: typeof getQuestionPdfSourceText==='function' ? getQuestionPdfSourceText(q) : '',
      question_image: assets.questionImage || assets.questionViewerImage || q.questionImage || q.questionViewerImage || await dataUrlToViewerImage(q.questionImage||'', 'q'),
      question_viewer_image: assets.questionViewerImage || q.questionViewerImage || await dataUrlToViewerImage(assets.questionImage || q.questionImage || '', 'q'),
      question_figures: cloneExportFigureSet(q.questionFigures),
      question_burned_figures: cloneExportFigureSet(q.questionBurnedFigures),
      question_vector_figures: cloneVectorFigureSet(q.questionFigures),
      question_burned_vector_figures: cloneVectorFigureSet(q.questionBurnedFigures),
      question_burned_figure_image: String(q.questionBurnedFigureImage || ''),
      question_burned_figure_scale: Math.max(1, Number(q.questionBurnedFigureScale)||1),
      question_render_source:buildComposerRenderSource(q,false,{full:assets.questionImage || assets.questionViewerImage || '',renderStatus:assets.questionRenderStatus}),
      option_ids: exportIdentity.optionIds,
      source_option_ids: exportIdentity.sourceOptionIds,
      legacy_option_ids: exportIdentity.sourceOptionIds,
      bank_option_ids: buildTopicAwareOptionAliases(q, i),
      options: q.type==='NAT'?null:opts,
      status: 'not_visited',
      chosen_option: null,
      chosen_option_id: null
    };
  }));
  const allRenderSources=questions.flatMap(question=>[
    question.question_render_source,
    ...Object.values(question.options || {}).map(option=>option?.render_source).filter(Boolean)
  ]).filter(Boolean);
  const rasterComplete=allRenderSources.length>0 && allRenderSources.every(source=>source.raster_present);
  const rasterLossless=rasterComplete && allRenderSources.every(source=>source.raster_lossless);
  const composerSourceRecords=allRenderSources.filter(source=>source.composer_source_present).length;
  const renderStatusCounts=allRenderSources.reduce((counts,source)=>{
    const status=['source-rendered','stored-fallback','missing'].includes(source.render_status) ? source.render_status : 'stored-fallback';
    counts[status]=(counts[status]||0)+1;
    return counts;
  },{'source-rendered':0,'stored-fallback':0,missing:0});
  const editableVectorRecords=questions.reduce((count,question)=>{
    const questionVectors=(question.question_vector_figures||[]).length+(question.question_burned_vector_figures||[]).length;
    const optionVectors=Object.values(question.options||{}).reduce((sum,option)=>sum+(option?.vector_figures||[]).length+(option?.burned_vector_figures||[]).length,0);
    return count+questionVectors+optionVectors;
  },0);
  const out={
    type: 'QUESTION_PAPER',
    export_schema_version: 'strict-v2',
    export_schema_role: 'question-paper',
    legacy_export_upgrade_applied: legacyUpgradeApplied,
    generated_by: 'QS Studio',
    generated_only_at_export: true,
    render_quality:{
      schema:'hallmark-source-v1',
      raster_complete:rasterComplete,
      raster_lossless:rasterLossless,
      composer_source_records:composerSourceRecords,
      editable_vector_records:editableVectorRecords,
      render_status_counts:renderStatusCounts
    },
    paper_created_by: 'QS Studio',
    license_origin: 'export-session',
    nat_evaluation_rule: 'inclusive-range-or-exact-with-sign-flex-range',
    exam: examName || 'Untitled Project',
    exam_name: examName || 'Untitled Project',
    ...exportIdentityFields(identity, 'question_paper'),
    ...exportAuthFields(auth, 'question_paper'),
    subject: 'Project',
    paper_subject: firstMeta.full,
    subject_short: firstMeta.short,
    section: getSectionDisplay(firstMeta),
    section_code: firstMeta.section,
    total_marks: qs.reduce((s,q)=>s+q.marks,0),
    topics: typeof normalizeTopicList==='function' ? normalizeTopicList(topics, qs) : (topics || []),
    classification: buildQuestionClassificationSummary(qs),
    exported_at: new Date().toISOString(),
    total_questions: qs.length,
    note: 'ANSWER KEY IS NOT INCLUDED. JSON includes frame assets with per-record fidelity metadata, Hallmark composer source/settings, viewer variants, and editable SVG/vector layers.',
    questions
  };
  dlBlob(JSON.stringify(out,null,2),identity.names.paperJSON,'application/json');
  toast('Paper JSON exported (no answer key)');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  EXPORT: ANSWER KEY JSON  (text only, separate file)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function exportAnsKeyJSON(){
  try{ if(typeof syncCurrentEditorCanvasAssetsForExportAsync==='function') await syncCurrentEditorCanvasAssetsForExportAsync(); else if(typeof syncCurrentEditorCanvasAssetsForExport==='function') syncCurrentEditorCanvasAssetsForExport(); }catch(_){ }
  if(!qs.length){showNotice('No questions available to export.', 'Answer Key JSON');return;}
  const firstMeta = getSubjectMeta(qs[0]?.subject || subjects[0]?.short || 'EC');
  const identity=getCurrentExportIdentity();
  const auth=getExportAuthBundle(qs);
  const legacyUpgradeApplied=hasLegacyExportQuestions(qs);
  const out={
    type: 'ANSWER_KEY',
    export_schema_version: 'strict-v2',
    export_schema_role: 'answer-key',
    legacy_export_upgrade_applied: legacyUpgradeApplied,
    generated_by: 'QS Studio',
    generated_only_at_export: true,
    key_created_by: 'QS Studio',
    license_origin: 'export-session',
    nat_evaluation_rule: 'inclusive-range-or-exact-with-sign-flex-range',
    exam: examName || 'Untitled Project',
    exam_name: examName || 'Untitled Project',
    ...exportIdentityFields(identity, 'answer_key'),
    ...exportAuthFields(auth, 'answer_key'),
    subject: 'Project',
    paper_subject: firstMeta.full,
    subject_short: firstMeta.short,
    section: getSectionDisplay(firstMeta),
    section_code: firstMeta.section,
    total_marks: qs.reduce((s,q)=>s+q.marks,0),
    topics: typeof normalizeTopicList==='function' ? normalizeTopicList(topics, qs) : (topics || []),
    classification: buildQuestionClassificationSummary(qs),
    exported_at: new Date().toISOString(),
    answers: qs.map((q,i)=>{
      const exportIdentity=buildExportQuestionIdentity(q, i);
      return {
        section: getSectionDisplay(getSubjectMeta(q.subject)),
        question_number: 'Q.'+(i+1),
        question_id: exportIdentity.exportQuestionId,
        bank_question_id: exportIdentity.sourceQuestionId,
        source_question_id: exportIdentity.sourceQuestionId,
        legacy_question_id: exportIdentity.sourceQuestionId,
        export_question_alias: buildTopicAwareQuestionAlias(q, i),
        legacy_id_transformed: exportIdentity.legacyDetected,
        ...getQuestionClassificationFields(q),
        question_type: q.type,
        marks: q.marks,
        negative_marks: q.negMarks,
        ...(q.type==='NAT'
          ? parseNatAnswerExport(q.natAnswer)
          : {
              correct_options: q.options.map((o,j)=>o.correct?String.fromCharCode(65+j):null).filter(Boolean),
              correct_option_ids: q.options.map((o,j)=>o.correct ? exportIdentity.optionIds?.[String.fromCharCode(65+j)] || null : null).filter(Boolean),
              source_correct_option_ids: q.options.map(o=>o.correct?(o.oid || null):null).filter(Boolean),
              option_ids: exportIdentity.optionIds,
              source_option_ids: exportIdentity.sourceOptionIds,
              legacy_option_ids: exportIdentity.sourceOptionIds,
              bank_option_ids: buildTopicAwareOptionAliases(q, i)
            })
      };
    })
  };
  dlBlob(JSON.stringify(out,null,2),identity.names.keyJSON,'application/json');
  toast('Answer key JSON exported');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  EXPORT: PAPER PDF  (embeds images, no answer key)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function getPdfExportBranding(settings={}){
  const hasOverride = !!(settings && typeof settings==='object' && settings.branding);
  const raw = hasOverride ? settings.branding : (typeof pdfBranding!=='undefined' ? pdfBranding : {});
  const brand = typeof normalizePdfBranding==='function' ? normalizePdfBranding(raw) : {
    instituteName:String(raw?.instituteName || '').trim(),
    logoDataUrl:String(raw?.logoDataUrl || '').trim(),
    examDisplayName:String(raw?.examDisplayName || '').trim(),
    subtitle:String(raw?.subtitle || '').trim()
  };
  if(!brand.examDisplayName) brand.examDisplayName = String(examName || 'Untitled Project').trim() || 'Untitled Project';
  return brand;
}

function getPdfDataUrlFormat(dataUrl){
  return /^data:image\/jpe?g/i.test(String(dataUrl||'')) ? 'JPEG' : 'PNG';
}

function pdfHeaderText(v){
  return normalizePdfExportText(String(v || '').replace(/\s+/g,' ').trim());
}

function drawPdfCenteredText(doc, text, x, y, maxW){
  const clean=pdfHeaderText(text);
  if(!clean) return y;
  const lines=doc.splitTextToSize(clean, maxW);
  lines.forEach((line,idx)=>doc.text(line, x, y + idx*10.5, {align:'center'}));
  return y + Math.max(1, lines.length)*10.5;
}

function drawPdfBrandingHeader(doc, pageW, margin, y, meta, totalMarks, branding, kind='paper'){
  const brand = getPdfExportBranding({branding});
  const logoFrameW = 94;
  const logoFrameH = 72;
  const maxTextW = pageW - margin*2 - logoFrameW - 58;
  const logoX = margin;
  const logoY = y - 8;
  if(brand.logoDataUrl){
    try{
      const fitted = typeof getPdfContainSize==='function'
        ? getPdfContainSize(doc, brand.logoDataUrl, logoFrameW, logoFrameH)
        : {w:logoFrameW,h:logoFrameH};
      const ix=logoX + (logoFrameW-fitted.w)/2;
      const iy=logoY + (logoFrameH-fitted.h)/2;
      doc.addImage(brand.logoDataUrl, getPdfDataUrlFormat(brand.logoDataUrl), ix, iy, fitted.w, fitted.h, undefined, 'FAST');
    }catch(_){}
  }

  let ty = y + 4;
  doc.setTextColor(0);
  if(brand.instituteName){
    doc.setFont('helvetica','bold');
    doc.setFontSize(10.5);
    ty = drawPdfCenteredText(doc, brand.instituteName, pageW/2, ty, maxTextW) + 1;
  }

  const title = kind==='key' ? `${brand.examDisplayName} - Answer Key` : brand.examDisplayName;
  doc.setFont('times','bold');
  doc.setFontSize(15);
  ty = drawPdfCenteredText(doc, title, pageW/2, ty, maxTextW) + 2;

  if(brand.subtitle){
    doc.setFont('helvetica','normal');
    doc.setFontSize(8.8);
    doc.setTextColor(55);
    ty = drawPdfCenteredText(doc, brand.subtitle, pageW/2, ty, maxTextW) + 1;
    doc.setTextColor(0);
  }

  const subject = meta ? `${meta.full} (${meta.short})` : 'Project';
  const section = meta ? getSectionDisplay(meta) : '-';
  doc.setFont('courier','normal');
  doc.setFontSize(7.8);
  doc.setTextColor(75);
  ty = drawPdfCenteredText(doc, `${subject} | Section: ${section} | Total: ${totalMarks}M`, pageW/2, ty, maxTextW);
  doc.setTextColor(0);

  const lineY = Math.max(y + 104, ty + 4, brand.logoDataUrl ? logoY + logoFrameH + 12 : y + 104);
  doc.setDrawColor(40);
  doc.setLineWidth(1);
  doc.line(margin, lineY, pageW-margin, lineY);
  return lineY + 14;
}

function getPdfExportPublishing(settings={}){
  const hasOverride = !!(settings && typeof settings==='object' && settings.publishing);
  const raw = hasOverride ? settings.publishing : (typeof pdfPublishing!=='undefined' ? pdfPublishing : {});
  return typeof normalizePdfPublishing==='function' ? normalizePdfPublishing(raw) : {
    markOrder:['source','asc','desc'].includes(String(raw?.markOrder || 'source')) ? String(raw?.markOrder || 'source') : 'source',
    sections:Array.isArray(raw?.sections) ? raw.sections : []
  };
}

function getPdfSectionKeyForExport(meta){
  return typeof getPdfSectionKey==='function'
    ? getPdfSectionKey(meta)
    : [meta?.short || '', meta?.section || '', meta?.full || ''].join('|');
}

function getPdfOrderedSectionKeys(sectionOrder, grouped, publishing){
  const saved=new Map((publishing.sections||[]).map((item,idx)=>[item.key,{...item,_idx:idx}]));
  let keys=[...sectionOrder].filter(key=>{
    const item=saved.get(key);
    return item ? item.enabled !== false : true;
  });
  if(!keys.length) keys=[...sectionOrder];
  return keys.sort((a,b)=>{
    const ai=saved.get(a), bi=saved.get(b);
    const ap=ai ? +ai.priority || 9999 : sectionOrder.indexOf(a)+1;
    const bp=bi ? +bi.priority || 9999 : sectionOrder.indexOf(b)+1;
    return ap-bp || sectionOrder.indexOf(a)-sectionOrder.indexOf(b);
  }).filter(key=>grouped.has(key));
}

function getPdfOrderedEntries(group, publishing){
  const base=(publishing.markOrder==='source')
    ? [...(group.regular||[]), ...(group.nat||[])]
    : [...(group.entries||[])];
  if(publishing.markOrder==='asc' || publishing.markOrder==='desc'){
    const dir=publishing.markOrder==='asc' ? 1 : -1;
    return base.sort((a,b)=>(((+a.q.marks||0)-(+b.q.marks||0))*dir) || (a.originalIndex-b.originalIndex));
  }
  return base;
}

function formatPdfMarksLabel(value){
  const n=+value || 0;
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/,'')} mark${Math.abs(n)===1?'':'s'}`;
}

function formatPdfMarksWord(value){
  const n=+value || 0;
  if(n===1) return 'ONE mark';
  if(n===2) return 'TWO marks';
  if(n===3) return 'THREE marks';
  if(n===4) return 'FOUR marks';
  if(n===5) return 'FIVE marks';
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/\.?0+$/,'')} marks`;
}

function getPdfMarkRangeSummary(items){
  if(!items?.length) return 'No questions in this section.';
  const ranges=[];
  let start=1, last=1, mark=+items[0].q.marks || 0;
  for(let i=1;i<items.length;i++){
    const nextMark=+items[i].q.marks || 0;
    if(nextMark===mark){ last=i+1; continue; }
    ranges.push({start,last,mark});
    start=last=i+1;
    mark=nextMark;
  }
  ranges.push({start,last,mark});
  const minMark=Math.min(...ranges.map(r=>r.mark));
  let visible=ranges.filter(r=>r.mark>minMark);
  if(!visible.length) visible=ranges;
  return visible.map(r=>{
    const qRange=r.start===r.last ? `Q.${r.start}` : `Q.${r.start} - Q.${r.last}`;
    return `${qRange} Carry ${formatPdfMarksWord(r.mark)} Each`;
  }).join('; ');
}

async function exportPaperPDFTextOnly(watermark={}){
  try{ if(typeof syncCurrentEditorCanvasAssetsForExportAsync==='function') await syncCurrentEditorCanvasAssetsForExportAsync(); else if(typeof syncCurrentEditorCanvasAssetsForExport==='function') syncCurrentEditorCanvasAssetsForExport(); }catch(_){ }
  if(!qs.length){showNotice('No questions available to export.', 'Paper PDF');return;}
  const jsPDF=getPDF(); if(!jsPDF) return;
  const doc=new jsPDF({unit:'pt',format:'a4',compress:true});
  const identity=getCurrentExportIdentity();
  const branding=getPdfExportBranding(watermark);
  const publishing=getPdfExportPublishing(watermark);
  let totalMarks=qs.reduce((s,q)=>s+q.marks,0);
  const PAGE_W=595, PAGE_H=842, LABEL_W=58, GAP=12;
  const sheetTemplateLayers=typeof getPdfSheetTemplateLayers==='function' ? getPdfSheetTemplateLayers(watermark) : [];
  const sheetLayout=watermark?.sheetTemplateLayout || null;
  const useSheetLayout=!!(sheetTemplateLayers.length && sheetLayout);
  const LEFT_M=useSheetLayout ? Math.max(12, PAGE_W*(Math.max(0, Math.min(35, +(sheetLayout.leftPct ?? 12)))/100)) : 36;
  const RIGHT_M=useSheetLayout ? Math.max(12, PAGE_W*(Math.max(0, Math.min(35, +(sheetLayout.rightPct ?? 8)))/100)) : 36;
  const TOP_M=useSheetLayout ? Math.max(12, PAGE_H*(Math.max(0, Math.min(45, +(sheetLayout.topPct ?? 14)))/100)) : 36;
  const BOTTOM_M=useSheetLayout ? Math.max(12, PAGE_H*(Math.max(0, Math.min(35, +(sheetLayout.bottomPct ?? 8)))/100)) : 36;
  const M=LEFT_M;
  const CONTENT_W=PAGE_W-LEFT_M-RIGHT_M-LABEL_W;
  const BOTTOM_LIMIT=PAGE_H-BOTTOM_M;
  const CELL_W=PAGE_W-LEFT_M-RIGHT_M-LABEL_W;
  const SECTION_BODY_TOP=useSheetLayout ? TOP_M : M+124;
  const IMG_PAD=6;
  const QUESTION_ROW_MIN=58;
  const OPTION_ROW_MIN=30;
  const NAT_ANSWER_ROW_MIN=34;
  const QUESTION_PDF_WIDTH_SCALE=.94;
  const OPTION_PDF_WIDTH_SCALE=.82;
  const PDF_CANVAS_POINT_SCALE=.72;
  const QUESTION_GAP=10;
  const isSheetTemplatePageNumberLayer=layer=>layer?.type==='text' && /\{page\}|\{total\}/i.test(String(layer.text || ''));
  const sheetTemplateBaseLayers=useSheetLayout ? sheetTemplateLayers.filter(layer=>!isSheetTemplatePageNumberLayer(layer)) : [];
  const sheetTemplateTokenLayers=useSheetLayout ? sheetTemplateLayers.filter(isSheetTemplatePageNumberLayer) : [];
  function drawSheetTemplateBaseLayers(){
    if(!useSheetLayout || !sheetTemplateBaseLayers.length || typeof drawPdfWhiteLabelLayer!=='function') return;
    sheetTemplateBaseLayers.forEach(layer=>drawPdfWhiteLabelLayer(doc, PAGE_W, PAGE_H, layer, 1, 1));
  }
  function drawSheetTemplateTokenLayers(){
    if(!useSheetLayout || !sheetTemplateTokenLayers.length || typeof drawPdfWhiteLabelLayer!=='function') return;
    const total=doc.getNumberOfPages ? doc.getNumberOfPages() : 1;
    for(let pageNo=1; pageNo<=total; pageNo++){
      doc.setPage(pageNo);
      sheetTemplateTokenLayers.forEach(layer=>drawPdfWhiteLabelLayer(doc, PAGE_W, PAGE_H, layer, pageNo, total));
    }
  }
  const sectionOrder=[];
  const grouped=new Map();
  qs.forEach((q,idx)=>{
    const sm=getSubjectMeta(q.subject);
    const key=sm.short+'|'+sm.section+'|'+sm.full;
    if(!grouped.has(key)){
      grouped.set(key,{meta:sm, regular:[], nat:[], entries:[]});
      sectionOrder.push(key);
    }
    const bucket=grouped.get(key);
    const entry={q, originalIndex:idx};
    bucket.entries.push(entry);
    if(q.type==='NAT') bucket.nat.push(entry);
    else bucket.regular.push(entry);
  });
  const orderedSectionKeys=getPdfOrderedSectionKeys(sectionOrder, grouped, publishing);
  totalMarks=orderedSectionKeys.reduce((sum,key)=>{
    const group=grouped.get(key);
    return sum + (group?.entries || []).reduce((s,entry)=>s+(+entry.q.marks||0),0);
  },0);

  function newPage(){
    doc.addPage();
    drawSheetTemplateBaseLayers();
    return useSheetLayout ? SECTION_BODY_TOP : M;
  }

  function drawSectionHeader(meta, y){
    if(useSheetLayout) return Math.max(y, SECTION_BODY_TOP);
    return drawPdfBrandingHeader(doc, PAGE_W, M, y, meta, totalMarks, branding, 'paper');
  }

  function drawPdfSectionIntro(group, orderedItems, y){
    if(useSheetLayout) return Math.max(y, SECTION_BODY_TOP);
    const meta=group.meta;
    const title=`${normalizePdfExportText(meta.full)} (${normalizePdfExportText(meta.short)})`;
    const subtitle=`Section: ${normalizePdfExportText(getSectionDisplay(meta))} | ${getPdfMarkRangeSummary(orderedItems)}`;
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.8);
    const summaryLines=doc.splitTextToSize(subtitle, PAGE_W-LEFT_M-RIGHT_M-16);
    const titleH=24;
    const summaryH=Math.max(22, summaryLines.length*10 + 8);
    if(y + titleH + summaryH + 8 > BOTTOM_LIMIT){
      y = newPage();
      y = drawSectionHeader(meta, y);
    }
    doc.setDrawColor(0);
    doc.setFillColor(0);
    doc.setLineWidth(1);
    doc.rect(M, y, PAGE_W-LEFT_M-RIGHT_M, titleH, 'FD');
    doc.setTextColor(255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(11);
    doc.text(title, PAGE_W/2, y+16, {align:'center'});
    y += titleH;
    doc.setFillColor(244);
    doc.setDrawColor(0);
    doc.rect(M, y, PAGE_W-LEFT_M-RIGHT_M, summaryH, 'FD');
    doc.setTextColor(0);
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.8);
    summaryLines.forEach((line,idx)=>doc.text(line, M+8, y+13+(idx*10)));
    return y + summaryH + 10;
  }

  function getPdfLayoutScale(img, kind='q'){
    const expectedW=kind==='opt' ? 500 : 640;
    const naturalW=img?.naturalWidth || img?.width || expectedW;
    const scale=naturalW/expectedW;
    return scale>=2 ? scale : 1;
  }

  const PDF_EMBED_PX_PER_POINT={q:3.2,opt:3.0};
  const PDF_EMBED_MAX_WIDTH={q:2400,opt:1800};
  const PDF_SCAN_MAX_EDGE=2600;
  const PDF_SCAN_MAX_PIXELS=7000000;

  function makePdfEmbedImage(sourceCanvas, pointW, pointH, kind='q', crop=null){
    if(!sourceCanvas || !pointW || !pointH) return null;
    const pxPerPoint=PDF_EMBED_PX_PER_POINT[kind] || PDF_EMBED_PX_PER_POINT.q;
    const maxW=PDF_EMBED_MAX_WIDTH[kind] || PDF_EMBED_MAX_WIDTH.q;
    const targetW=Math.max(1, Math.min(maxW, Math.round(pointW*pxPerPoint)));
    const targetH=Math.max(1, Math.round(pointH*(targetW/Math.max(1,pointW))));
    const out=document.createElement('canvas');
    out.width=targetW;
    out.height=targetH;
    const octx=out.getContext('2d');
    if(!octx) return null;
    octx.imageSmoothingEnabled=true;
    octx.imageSmoothingQuality='high';
    octx.fillStyle='#fff';
    octx.fillRect(0,0,targetW,targetH);
    const sourceW=sourceCanvas.naturalWidth||sourceCanvas.width||1;
    const sourceH=sourceCanvas.naturalHeight||sourceCanvas.height||1;
    const sx=Math.max(0,Number(crop?.x)||0);
    const sy=Math.max(0,Number(crop?.y)||0);
    const sw=Math.max(1,Math.min(sourceW-sx,Number(crop?.w)||sourceW));
    const sh=Math.max(1,Math.min(sourceH-sy,Number(crop?.h)||sourceH));
    // The scan proxy is only for finding bounds. Always sample the original
    // Hallmark surface directly into the final PNG so export has one resize.
    octx.drawImage(sourceCanvas,sx,sy,sw,sh,0,0,targetW,targetH);
    return {dataUrl:safeCanvasDataUrl(out, 'image/png'), fmt:'PNG'};
  }

  function getPdfSourceFormat(dataUrl){
    return /^data:image\/jpe?g/i.test(String(dataUrl||'')) ? 'JPEG' : 'PNG';
  }

  async function getPdfImageInfo(dataUrl, kind='q'){
    if(!dataUrl) return null;
    try{
      const img=await loadImg(dataUrl);
      const layoutScale=getPdfLayoutScale(img, kind);
      const srcW=img.naturalWidth || img.width || 1;
      const srcH=img.naturalHeight || img.height || 1;
      const scanScale=Math.min(
        1,
        PDF_SCAN_MAX_EDGE/Math.max(1,srcW),
        PDF_SCAN_MAX_EDGE/Math.max(1,srcH),
        Math.sqrt(PDF_SCAN_MAX_PIXELS/Math.max(1,srcW*srcH))
      );
      const trimCanvas=document.createElement('canvas');
      trimCanvas.width=Math.max(1, Math.round(srcW*scanScale));
      trimCanvas.height=Math.max(1, Math.round(srcH*scanScale));
      const tctx=trimCanvas.getContext('2d');
      tctx.imageSmoothingEnabled=true;
      tctx.imageSmoothingQuality='high';
      tctx.fillStyle='#fff';
      tctx.fillRect(0,0,trimCanvas.width,trimCanvas.height);
      tctx.drawImage(img,0,0,trimCanvas.width,trimCanvas.height);
      const pixels=tctx.getImageData(0,0,trimCanvas.width,trimCanvas.height).data;
      let minX=trimCanvas.width, minY=trimCanvas.height, maxX=-1, maxY=-1;
      for(let yy=0; yy<trimCanvas.height; yy++){
        for(let xx=0; xx<trimCanvas.width; xx++){
          const i=(yy*trimCanvas.width+xx)*4;
          const r=pixels[i], g=pixels[i+1], b=pixels[i+2], a=pixels[i+3];
          if(a>10 && (r<246 || g<246 || b<246)){
            if(xx<minX) minX=xx;
            if(yy<minY) minY=yy;
            if(xx>maxX) maxX=xx;
            if(yy>maxY) maxY=yy;
          }
        }
      }
      if(maxX>=minX && maxY>=minY){
        const padSource=Math.max(1, Math.round((kind==='opt' ? 4 : 6)*layoutScale));
        const sourceMinX=Math.max(0,Math.floor(minX/scanScale)-padSource);
        const sourceMinY=Math.max(0,Math.floor(minY/scanScale)-padSource);
        const sourceMaxX=Math.min(srcW,Math.ceil((maxX+1)/scanScale)+padSource);
        const sourceMaxY=Math.min(srcH,Math.ceil((maxY+1)/scanScale)+padSource);
        const sourceCropW=Math.max(1,sourceMaxX-sourceMinX);
        const sourceCropH=Math.max(1,sourceMaxY-sourceMinY);
        const pointW=(sourceCropW/layoutScale)*PDF_CANVAS_POINT_SCALE;
        const pointH=(sourceCropH/layoutScale)*PDF_CANVAS_POINT_SCALE;
        const packed=makePdfEmbedImage(img, pointW, pointH, kind, {x:sourceMinX,y:sourceMinY,w:sourceCropW,h:sourceCropH});
        return {
          dataUrl: packed?.dataUrl || dataUrl,
          w: pointW,
          h: pointH,
          fmt: packed?.fmt || 'PNG',
          kind,
          cropLogicalX: sourceMinX/layoutScale,
          cropLogicalY: sourceMinY/layoutScale,
          logicalToPoint: PDF_CANVAS_POINT_SCALE,
          sourceDataUrl: dataUrl,
          sourceFmt: getPdfSourceFormat(dataUrl)
        };
      }
      const pointW=(srcW/layoutScale)*PDF_CANVAS_POINT_SCALE;
      const pointH=(srcH/layoutScale)*PDF_CANVAS_POINT_SCALE;
      const packed=makePdfEmbedImage(img, pointW, pointH, kind);
      return {
        dataUrl: packed?.dataUrl || dataUrl,
        w: pointW,
        h: pointH,
        fmt: packed?.fmt || getPdfSourceFormat(dataUrl),
        kind,
        cropLogicalX: 0,
        cropLogicalY: 0,
        logicalToPoint: PDF_CANVAS_POINT_SCALE,
        sourceDataUrl: dataUrl,
        sourceFmt: getPdfSourceFormat(dataUrl)
      };
    }catch(_){
      return null;
    }
  }

  async function getFirstPdfImageInfo(candidates, kind='q'){
    const seen=new Set();
    for(const candidate of (Array.isArray(candidates) ? candidates : [candidates])){
      const dataUrl=String(candidate||'').trim();
      if(!dataUrl || !/^data:image\//i.test(dataUrl) || seen.has(dataUrl)) continue;
      seen.add(dataUrl);
      const info=await getPdfImageInfo(dataUrl, kind);
      if(info) return info;
    }
    return null;
  }

  function getPdfImageMaxWidth(kind){
    return Math.max(160, (CELL_W-(IMG_PAD*2)) * (kind==='opt' ? OPTION_PDF_WIDTH_SCALE : QUESTION_PDF_WIDTH_SCALE));
  }

  function fitImage(info, maxW, maxH){
    if(!info) return {w:0,h:0};
    const maxUpscale=info.kind==='opt' ? 1.35 : 2.4;
    const scale=Math.min(maxW/Math.max(1,info.w), maxH/Math.max(1,info.h), maxUpscale);
    return {
      w: Math.max(1, info.w*scale),
      h: Math.max(1, info.h*scale)
    };
  }

  function drawEmptyCell(label, text, y, meta, rowH=46){
    if(y + rowH > BOTTOM_LIMIT){
      y = newPage();
      y = drawSectionHeader(meta, y);
    }
    doc.setDrawColor(34);
    doc.setLineWidth(1);
    doc.rect(M, y, LABEL_W, rowH);
    doc.rect(M + LABEL_W, y, CELL_W, rowH);
    doc.setFont('times','bold');
    doc.setFontSize(12);
    doc.text(label, M + 9, y + 18);
    doc.setFont('times','normal');
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(text, M + LABEL_W + IMG_PAD, y + 19);
    doc.setTextColor(0);
    return y + rowH;
  }

  function isOptionQuestion(q){
    return q && (q.type==='MCQ' || q.type==='MSQ');
  }

  function drawAnswerRow(y, meta){
    return drawEmptyCell('Ans', '____________________________', y, meta, NAT_ANSWER_ROW_MIN);
  }

  function drawQuestionInfoLine(q, x, y){
    doc.setFont('times','bolditalic');
    doc.setFontSize(10.5);
    doc.setTextColor(20,20,20);
    doc.text(`Type: ${q.type}`, x, y);
    let cursor=x+86;
    doc.setTextColor(20,130,65);
    doc.text(`Marks: +${q.marks}M`, cursor, y);
    cursor+=96;
    doc.setTextColor(190,35,35);
    doc.text(`Negative Marks: ${q.negMarks}M`, cursor, y);
    doc.setTextColor(0);
  }

  function getImageRowHeight(info, minHeight=46, qMeta=null, kind='q', maxImgH=PAGE_H){
    if(!info) return minHeight;
    const metaLineH=qMeta ? 18 : 0;
    const fitted=fitImage(info, getPdfImageMaxWidth(kind), Math.max(80, maxImgH - IMG_PAD*2 - metaLineH));
    return Math.max(minHeight, fitted.h + IMG_PAD*2 + metaLineH);
  }

  function getQuestionBlockHeight(q, qInfo, optInfos){
    let total=getImageRowHeight(qInfo, QUESTION_ROW_MIN, q, 'q');
    if(q.type==='NAT'){
      total+=NAT_ANSWER_ROW_MIN;
    } else if(isOptionQuestion(q)){
      (optInfos||[]).forEach(info=>{
        total+=getImageRowHeight(info, OPTION_ROW_MIN, null, 'opt');
      });
    }
    return total + QUESTION_GAP;
  }

  function decodePdfSvgDataUrl(src){
    const value=String(src||'');
    if(!/^data:image\/svg\+xml/i.test(value)) return '';
    const comma=value.indexOf(',');
    if(comma<0) return '';
    try{
      return /;base64/i.test(value.slice(0,comma)) ? decodeSvgBase64Utf8(value.slice(comma+1)) : decodeURIComponent(value.slice(comma+1));
    }catch(_){
      return '';
    }
  }

  function parsePdfSvgNumber(value, fallback=0){
    const n=parseFloat(String(value||'').replace(/px$/,''));
    return Number.isFinite(n) ? n : fallback;
  }

  function parsePdfSvgPoints(value){
    const nums=String(value||'').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
    const pts=[];
    for(let i=0;i+1<nums.length;i+=2) pts.push([nums[i],nums[i+1]]);
    return pts;
  }

  function makePdfSvgMatrix(){
    return typeof DOMMatrix==='function' ? new DOMMatrix() : null;
  }

  function parsePdfSvgTransform(value){
    let matrix=makePdfSvgMatrix();
    if(!matrix) return null;
    const text=String(value||'');
    const re=/([a-zA-Z]+)\(([^)]*)\)/g;
    let match;
    while((match=re.exec(text))){
      const name=match[1];
      const nums=match[2].split(/[\s,]+/).map(Number).filter(Number.isFinite);
      try{
        if(name==='translate') matrix=matrix.translate(nums[0]||0, nums[1]||0);
        else if(name==='scale') matrix=matrix.scale(nums[0] ?? 1, nums[1] ?? nums[0] ?? 1);
        else if(name==='rotate') matrix=nums.length>2 ? matrix.translate(nums[1],nums[2]).rotate(nums[0]||0).translate(-nums[1],-nums[2]) : matrix.rotate(nums[0]||0);
        else if(name==='matrix' && nums.length>=6) matrix=matrix.multiply(new DOMMatrix(nums.slice(0,6)));
      }catch(_){ }
    }
    return matrix;
  }

  function multiplyPdfSvgMatrix(a,b){
    if(a && b) return a.multiply(b);
    return a || b || makePdfSvgMatrix();
  }

  function transformPdfSvgPoint(matrix, x, y){
    if(matrix && typeof DOMPoint==='function'){
      const p=new DOMPoint(x,y).matrixTransform(matrix);
      return [p.x,p.y];
    }
    return [x,y];
  }

  function getPdfSvgInheritedStyle(node, parent={}){
    const style={...parent};
    const attrStyle=String(node.getAttribute?.('style')||'');
    attrStyle.split(';').forEach(pair=>{
      const idx=pair.indexOf(':');
      if(idx>0) style[pair.slice(0,idx).trim()]=pair.slice(idx+1).trim();
    });
    ['stroke','stroke-width','fill','opacity','stroke-opacity','fill-opacity'].forEach(name=>{
      const value=node.getAttribute?.(name);
      if(value!=null) style[name]=value;
    });
    return style;
  }

  function applyPdfSvgStroke(style, scale=1){
    const stroke=style.stroke && style.stroke!=='none' ? style.stroke : '#111';
    try{ doc.setDrawColor(stroke); }catch(_){ doc.setDrawColor(0); }
    doc.setLineWidth(Math.max(.25, parsePdfSvgNumber(style['stroke-width'], 1)*scale));
  }

  function applyPdfSvgFill(style){
    const fill=style.fill && style.fill!=='none' ? style.fill : '';
    if(!fill) return false;
    try{ doc.setFillColor(fill); }catch(_){ doc.setFillColor(255); }
    return true;
  }

  function drawPdfSvgPolyline(points, closed, matrix, originX, originY, scale, style){
    if(points.length<2) return;
    const pts=points.map(([x,y])=>transformPdfSvgPoint(matrix,x,y).map(v=>v*scale));
    applyPdfSvgStroke(style, scale);
    if(closed && applyPdfSvgFill(style) && typeof doc.lines==='function'){
      const start=pts[0];
      const rel=pts.slice(1).map((p,i)=>[p[0]-pts[i][0],p[1]-pts[i][1]]);
      rel.push([pts[0][0]-pts[pts.length-1][0],pts[0][1]-pts[pts.length-1][1]]);
      doc.lines(rel, originX+start[0], originY+start[1], [1,1], 'FD', true);
      return;
    }
    for(let i=1;i<pts.length;i++) doc.line(originX+pts[i-1][0], originY+pts[i-1][1], originX+pts[i][0], originY+pts[i][1]);
    if(closed) doc.line(originX+pts[pts.length-1][0], originY+pts[pts.length-1][1], originX+pts[0][0], originY+pts[0][1]);
  }

  function parsePdfSvgPathPoints(d){
    const tokens=String(d||'').match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
    const pts=[];
    let i=0, cmd='', x=0, y=0, startX=0, startY=0;
    const num=()=>parseFloat(tokens[i++]);
    const hasNum=()=>i<tokens.length && !/^[a-zA-Z]$/.test(tokens[i]);
    while(i<tokens.length){
      if(/^[a-zA-Z]$/.test(tokens[i])) cmd=tokens[i++];
      const lower=cmd.toLowerCase();
      const rel=cmd===lower;
      if(lower==='m' || lower==='l'){
        while(hasNum()){
          let nx=num(), ny=num();
          if(rel){ nx+=x; ny+=y; }
          x=nx; y=ny;
          if(lower==='m'){ startX=x; startY=y; }
          pts.push([x,y]);
          if(lower==='m') cmd=rel?'l':'L';
        }
      }else if(lower==='h'){
        while(hasNum()){ let nx=num(); if(rel) nx+=x; x=nx; pts.push([x,y]); }
      }else if(lower==='v'){
        while(hasNum()){ let ny=num(); if(rel) ny+=y; y=ny; pts.push([x,y]); }
      }else if(lower==='c'){
        while(hasNum()){
          num(); num(); num(); num();
          let nx=num(), ny=num();
          if(rel){ nx+=x; ny+=y; }
          x=nx; y=ny; pts.push([x,y]);
        }
      }else if(lower==='q'){
        while(hasNum()){
          num(); num();
          let nx=num(), ny=num();
          if(rel){ nx+=x; ny+=y; }
          x=nx; y=ny; pts.push([x,y]);
        }
      }else if(lower==='z'){
        pts.push([startX,startY]);
      }else{
        break;
      }
    }
    return pts;
  }

  function drawPdfSvgNode(node, matrix, originX, originY, scale, parentStyle){
    if(!node || node.nodeType!==1) return;
    const tag=String(node.tagName||'').toLowerCase().replace(/^.*:/,'');
    const localMatrix=multiplyPdfSvgMatrix(matrix, parsePdfSvgTransform(node.getAttribute('transform')));
    const style=getPdfSvgInheritedStyle(node, parentStyle);
    if(tag==='g' || tag==='svg'){
      Array.from(node.children||[]).forEach(child=>drawPdfSvgNode(child, localMatrix, originX, originY, scale, style));
      return;
    }
    if(tag==='line'){
      const p1=transformPdfSvgPoint(localMatrix, parsePdfSvgNumber(node.getAttribute('x1')), parsePdfSvgNumber(node.getAttribute('y1'))).map(v=>v*scale);
      const p2=transformPdfSvgPoint(localMatrix, parsePdfSvgNumber(node.getAttribute('x2')), parsePdfSvgNumber(node.getAttribute('y2'))).map(v=>v*scale);
      applyPdfSvgStroke(style, scale);
      doc.line(originX+p1[0], originY+p1[1], originX+p2[0], originY+p2[1]);
    }else if(tag==='rect'){
      const fillValue=String(style.fill || node.getAttribute('fill') || '').trim().toLowerCase();
      const strokeValue=String(style.stroke || node.getAttribute('stroke') || '').trim().toLowerCase();
      const widthAttr=String(node.getAttribute('width')||'');
      const heightAttr=String(node.getAttribute('height')||'');
      const isWhiteBackground=(fillValue==='#fff' || fillValue==='#ffffff' || fillValue==='white') && (!strokeValue || strokeValue==='none')
        && (widthAttr.includes('%') || heightAttr.includes('%') || node.parentElement?.tagName?.toLowerCase?.()==='svg');
      if(isWhiteBackground) return;
      const x=parsePdfSvgNumber(node.getAttribute('x')), y=parsePdfSvgNumber(node.getAttribute('y'));
      const w=parsePdfSvgNumber(node.getAttribute('width')), h=parsePdfSvgNumber(node.getAttribute('height'));
      const pts=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
      drawPdfSvgPolyline(pts, true, localMatrix, originX, originY, scale, style);
    }else if(tag==='polyline' || tag==='polygon'){
      drawPdfSvgPolyline(parsePdfSvgPoints(node.getAttribute('points')), tag==='polygon', localMatrix, originX, originY, scale, style);
    }else if(tag==='circle' || tag==='ellipse'){
      const c=transformPdfSvgPoint(localMatrix, parsePdfSvgNumber(node.getAttribute('cx')), parsePdfSvgNumber(node.getAttribute('cy'))).map(v=>v*scale);
      const rx=parsePdfSvgNumber(node.getAttribute(tag==='circle'?'r':'rx'))*scale;
      const ry=parsePdfSvgNumber(node.getAttribute(tag==='circle'?'r':'ry'))*scale;
      applyPdfSvgStroke(style, scale);
      const mode=applyPdfSvgFill(style) ? 'FD' : 'S';
      if(tag==='circle' && Math.abs(rx-ry)<.01) doc.circle(originX+c[0], originY+c[1], rx, mode);
      else doc.ellipse(originX+c[0], originY+c[1], rx, ry, mode);
    }else if(tag==='path'){
      const pts=parsePdfSvgPathPoints(node.getAttribute('d'));
      drawPdfSvgPolyline(pts, /z\s*$/i.test(String(node.getAttribute('d')||'')), localMatrix, originX, originY, scale, style);
    }else if(tag==='text'){
      // Keep complex math/text from the high-quality raster frame. jsPDF plain
      // text cannot preserve SVG/KaTeX glyph shaping and can reintroduce mojibake.
      return;
    }
  }

  function drawSvgFigureVectorOverlay(fig, imgX, imgY, fitted, info){
    const raw=String(fig?.sourceSvg||'').trim() || decodePdfSvgDataUrl(fig?.src);
    if(!raw || /<script\b|<foreignObject\b|\son\w+\s*=|javascript:/i.test(raw)) return false;
    let root;
    try{ root=new DOMParser().parseFromString(raw, 'image/svg+xml').documentElement; }catch(_){ return false; }
    if(!root || String(root.tagName||'').toLowerCase()!=='svg') return false;
    const viewBox=String(root.getAttribute('viewBox')||'').split(/[\s,]+/).map(Number).filter(Number.isFinite);
    const vbW=viewBox.length>=4 ? viewBox[2] : parsePdfSvgNumber(root.getAttribute('width'), fig.w||1);
    const vbH=viewBox.length>=4 ? viewBox[3] : parsePdfSvgNumber(root.getAttribute('height'), fig.h||1);
    if(!(vbW>0 && vbH>0)) return false;
    const fitScale=Math.min(fitted.w/Math.max(1,info.w), fitted.h/Math.max(1,info.h), 1);
    const pointScale=(info.logicalToPoint || PDF_CANVAS_POINT_SCALE)*fitScale;
    const originX=imgX + ((+fig.x||0) - (info.cropLogicalX||0))*pointScale;
    const originY=imgY + ((+fig.y||0) - (info.cropLogicalY||0))*pointScale;
    const targetW=(+fig.w||vbW)*pointScale;
    const targetH=(+fig.h||vbH)*pointScale;
    if(originX+targetW<imgX || originY+targetH<imgY || originX>imgX+fitted.w || originY>imgY+fitted.h) return false;
    const crop=fig.crop || {};
    const cropL=Math.max(0, Math.min(.95, +crop.l||0));
    const cropT=Math.max(0, Math.min(.95, +crop.t||0));
    const visibleW=Math.max(.04, 1-cropL-Math.max(0, Math.min(.95, +crop.r||0)));
    const visibleH=Math.max(.04, 1-cropT-Math.max(0, Math.min(.95, +crop.b||0)));
    const svgScale=Math.min(targetW/Math.max(1,vbW*visibleW), targetH/Math.max(1,vbH*visibleH));
    const base=makePdfSvgMatrix();
    const matrix=base
      ? base.translate(-(viewBox[0]||0), -(viewBox[1]||0)).translate(-vbW*cropL, -vbH*cropT)
      : null;
    drawPdfSvgNode(root, matrix, originX, originY, svgScale, {stroke:'#111',fill:'none','stroke-width':'1'});
    return true;
  }

  function drawPdfVectorFigureOverlays(figures, info, imgX, imgY, fitted){
    getUniquePdfVectorFigures(figures).forEach(fig=>{
      if(!String(fig?.sourceSvg||'').trim() && !/^data:image\/svg\+xml/i.test(String(fig?.src||''))) return;
      try{ drawSvgFigureVectorOverlay(fig, imgX, imgY, fitted, info); }catch(_){ }
    });
  }

  function getPdfFigureArea(fig){
    return Math.max(0, +(fig?.w||0)) * Math.max(0, +(fig?.h||0));
  }

  function pdfFiguresOverlapMeaningfully(first, second){
    const left=Math.max(+(first?.x||0), +(second?.x||0));
    const top=Math.max(+(first?.y||0), +(second?.y||0));
    const right=Math.min(+(first?.x||0)+Math.max(0,+(first?.w||0)), +(second?.x||0)+Math.max(0,+(second?.w||0)));
    const bottom=Math.min(+(first?.y||0)+Math.max(0,+(first?.h||0)), +(second?.y||0)+Math.max(0,+(second?.h||0)));
    const overlap=Math.max(0,right-left)*Math.max(0,bottom-top);
    const smallest=Math.min(getPdfFigureArea(first), getPdfFigureArea(second));
    return overlap>0 && (smallest===0 || overlap>=smallest*.12);
  }

  function pdfFiguresSharePlacement(first, second){
    const close=(a,b)=>Math.abs((+a||0)-(+b||0))<=2;
    const sameSource=String(first?.sourceSvg||first?.src||'')===String(second?.sourceSvg||second?.src||'');
    return sameSource && close(first?.x,second?.x) && close(first?.y,second?.y)
      && close(first?.w,second?.w) && close(first?.h,second?.h);
  }

  function getUniquePdfVectorFigures(figures){
    const list=(Array.isArray(figures) ? figures : [])
      .filter(fig=>fig && (String(fig.sourceSvg||'').trim() || /^data:image\/svg\+xml/i.test(String(fig.src||''))));
    return list.reduce((kept, fig)=>{
      const duplicateIndex=kept.findIndex(prev=>pdfFiguresSharePlacement(prev,fig) || pdfFiguresOverlapMeaningfully(prev,fig));
      if(duplicateIndex>=0) kept[duplicateIndex]=fig;
      else kept.push(fig);
      return kept;
    }, []);
  }

  function drawImageRow(label, info, y, meta, minHeight=46, qMeta=null, vectorFigures=[]){
    if(!info) return drawEmptyCell(label, '(empty)', y, meta, minHeight);
    const kind=qMeta ? 'q' : 'opt';
    const maxImgW=getPdfImageMaxWidth(kind);
    const metaLineH=qMeta ? 18 : 0;
    const maxImgH=Math.max(80, BOTTOM_LIMIT - y - IMG_PAD*2 - metaLineH);
    let fitted=fitImage(info, maxImgW, maxImgH);
    let rowH=Math.max(minHeight, fitted.h + IMG_PAD*2 + metaLineH);
    if(y + rowH > BOTTOM_LIMIT){
      y = newPage();
      y = drawSectionHeader(meta, y);
      fitted=fitImage(info, maxImgW, Math.max(80, BOTTOM_LIMIT - y - IMG_PAD*2 - metaLineH));
      rowH=Math.max(minHeight, fitted.h + IMG_PAD*2 + metaLineH);
    }
    doc.setDrawColor(34);
    doc.setLineWidth(1);
    doc.rect(M, y, LABEL_W, rowH);
    doc.rect(M + LABEL_W, y, CELL_W, rowH);
    doc.setFont('times','bold');
    doc.setFontSize(12);
    doc.text(label, M + 9, y + 18);
    const imgX=M + LABEL_W + IMG_PAD;
    const imgY=y + IMG_PAD;
    let embedded=false;
    try{
      doc.addImage(info.dataUrl, info.fmt, imgX, imgY, fitted.w, fitted.h, undefined, 'FAST');
      embedded=true;
    }catch(_){
      if(info.sourceDataUrl && info.sourceDataUrl!==info.dataUrl){
        try{
          doc.addImage(info.sourceDataUrl, info.sourceFmt || getPdfSourceFormat(info.sourceDataUrl), imgX, imgY, fitted.w, fitted.h, undefined, 'FAST');
          embedded=true;
        }catch(__){}
      }
    }
    if(embedded){
      // The lossless frame already contains every placed circuit/SVG. Drawing
      // the approximate jsPDF path overlay here a second time produced doubled,
      // misaligned strokes and visible vector "noise". Selectable export and
      // Paper JSON retain the original SVG separately for true vector use.
      if(qMeta){
        drawQuestionInfoLine(qMeta, imgX, imgY + fitted.h + 13);
      }
    }else{
      doc.setFont('times','normal');
      doc.setFontSize(10);
      doc.setTextColor(120);
      doc.text('(image could not be embedded)', imgX, y+19);
      doc.setTextColor(0);
    }
    return y + rowH;
  }

  drawSheetTemplateBaseLayers();
  let y = drawSectionHeader(grouped.get(orderedSectionKeys[0]).meta, useSheetLayout ? SECTION_BODY_TOP : M);
  for(const [sectionIdx, sectionKey] of orderedSectionKeys.entries()){
    const group=grouped.get(sectionKey);
    if(sectionIdx>0){
      y = newPage();
      y = drawSectionHeader(group.meta, y);
    }
    const orderedItems=getPdfOrderedEntries(group, publishing);
    y = drawPdfSectionIntro(group, orderedItems, y);
    for(const [idx, entry] of orderedItems.entries()){
      const q=entry.q;
      try{
        if(typeof updateExportProgress==='function'){
          updateExportProgress(`Rendering PDF question ${entry.originalIndex+1}/${qs.length}...`);
        }
        let assets;
        try{ assets=await buildExportAssetsForQuestionRecord(q); }
        catch(_){ assets={questionImage:q.questionImage||'', questionViewerImage:q.questionViewerImage||'', optionAssets:[]}; }
        const qInfo=await getFirstPdfImageInfo([assets.questionImage, q.questionImage, assets.questionViewerImage, q.questionViewerImage, q.questionBaseImage], 'q');
        const optInfos=[];
        if(isOptionQuestion(q)){
          for(let optIdx=0; optIdx<(q.options||[]).length; optIdx++){
            const opt=(q.options||[])[optIdx];
            const optAsset=(assets.optionAssets && assets.optionAssets[optIdx]) || {};
            optInfos.push(await getFirstPdfImageInfo([optAsset.full, opt?.image, optAsset.viewer, opt?.viewerImage, opt?.baseImage], 'opt'));
          }
        }
        const blockH=getQuestionBlockHeight(q, qInfo, optInfos);
        const pageBodyH=BOTTOM_LIMIT-SECTION_BODY_TOP;
        if(blockH <= pageBodyH && y + blockH > BOTTOM_LIMIT){
          y = newPage();
          y = drawSectionHeader(group.meta, y);
        }
        y = drawImageRow(`Q.${idx+1}`, qInfo, y, group.meta, QUESTION_ROW_MIN, q, [
          ...(q.questionFigures||[]),
          ...(q.questionBurnedFigures||[])
        ]);
        if(q.type==='NAT'){
          y = drawAnswerRow(y, group.meta);
        } else if(isOptionQuestion(q)){
          for(const [optIdx, optInfo] of optInfos.entries()){
            const opt=(q.options||[])[optIdx] || {};
            y = drawImageRow(`(${String.fromCharCode(65+optIdx)})`, optInfo, y, group.meta, OPTION_ROW_MIN, null, [
              ...(opt.figures||[]),
              ...(opt.burnedFigures||[])
            ]);
          }
        }
        y += QUESTION_GAP;
        if(y > BOTTOM_LIMIT - 30){
          y = newPage();
          y = drawSectionHeader(group.meta, y);
        }
      }catch(err){
        console.error('PDF question skipped', entry.originalIndex+1, err);
        y = drawEmptyCell(`Q.${idx+1}`, '(question skipped due to export image error)', y, group.meta, QUESTION_ROW_MIN);
        y += QUESTION_GAP;
      }
      await exportYield();
    }
  }

  if(watermark?.sheetPipelineBase){
    return doc.output('arraybuffer');
  }
  if(useSheetLayout) drawSheetTemplateTokenLayers();
  else applyPdfWatermarkToAllPages(doc, PAGE_W, PAGE_H, watermark);
  if(!useSheetLayout && typeof applyPdfPageNumbersToAllPages==='function') applyPdfPageNumbersToAllPages(doc, PAGE_W, PAGE_H);
  doc.save(identity.names.paperPDF);
  toast('Paper PDF exported');
}

async function exportPaperPDF(){
  return exportPaperPDFTextOnly();
}

async function openQsSheetTemplatePipeline(){
  const pipelineUrl=`pdf_sheet_template_pipeline.html?mode=template&ts=${Date.now().toString(36)}#blank_template`;
  const pipelineWindow=window.open(pipelineUrl, '_blank', 'width=1440,height=900');
  if(!pipelineWindow){
    showNotice('The page layout window was blocked. Allow pop-ups for QS Studio, then try again.', 'Page Layout PDF');
    return;
  }
  toast('Page Layout Designer opened on a blank A4 layout.');
}

// Selectable export deliberately uses the browser print engine. Native DOM text
// preserves selection/search in the saved PDF while the regular Paper PDF keeps
// its high-DPI canvas frames for exact visual fidelity.
function escapeSelectablePaperHTML(value){
  return String(value ?? '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function escapeSelectableCssUrl(value){
  return String(value ?? '').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r?\n/g,'');
}

function resolveSelectableSheetTextTokens(text){
  return String(text || '').replace(/\{page\}/gi, '1').replace(/\{total\}/gi, '');
}

function makeSelectableSheetTextSvgSrc(text, style={}, boxWidthPx=0, align='center'){
  const raw=resolveSelectableSheetTextTokens(text);
  const lines=raw.split(/\r?\n/);
  const fontSize=Math.max(6, Math.min(140, +(style.fontSize ?? 11)));
  const family=String(style.fontFamily || 'Times New Roman').replace(/["<>]/g,'');
  const color=/^#[0-9a-f]{6}$/i.test(String(style.color||'')) ? String(style.color) : '#111111';
  const weight=style.bold ? 700 : 400;
  const italic=style.italic ? 'italic' : 'normal';
  const decoration=style.underline ? ' underline' : '';
  const maxChars=Math.max(1, ...lines.map(line=>line.length));
  const naturalWidth=Math.max(24, Math.ceil(maxChars * fontSize * .62 + 10));
  const width=Math.max(naturalWidth, Math.ceil(+boxWidthPx || 0));
  const lineHeight=fontSize*1.18;
  const height=Math.max(fontSize+8, Math.ceil(lines.length * lineHeight + 8));
  const safeAlign=/^(left|right|center)$/i.test(String(align||'')) ? String(align).toLowerCase() : 'center';
  const anchor=safeAlign==='left' ? 'start' : safeAlign==='right' ? 'end' : 'middle';
  const x=safeAlign==='left' ? 4 : safeAlign==='right' ? width-4 : width/2;
  const tspans=lines.map((line,idx)=>`<tspan x="${x}" y="${Math.round(4+fontSize+idx*lineHeight)}">${escapeSelectablePaperHTML(line)}</tspan>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text text-anchor="${anchor}" font-family="${escapeSelectablePaperHTML(family)}" font-size="${fontSize}" font-weight="${weight}" font-style="${italic}" text-decoration="${decoration.trim()}" fill="${color}">${tspans}</text></svg>`;
  return {
    src:'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg),
    widthPx:width,
    heightPx:height
  };
}

function makeSelectableSheetTemplateSvgSrc(layers=[]){
  const pageW=210;
  const pageH=297;
  const svgDataUrl=(markup)=>{
    const raw=String(markup || '').trim();
    return raw ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(raw) : '';
  };
  const safeLayers=(Array.isArray(layers) ? layers : []).filter(layer=>layer && (layer.text || layer.svgSrc || layer.svg || layer.image));
  const nodes=safeLayers.map((layer,idx)=>{
    const type=String(layer.type || '').toLowerCase();
    const x=(Math.max(0, Math.min(100, +(layer.xPct ?? 0)))/100)*pageW;
    const y=(Math.max(0, Math.min(100, +(layer.yPct ?? 0)))/100)*pageH;
    const w=(Math.max(1, Math.min(220, +(layer.widthPct ?? 40)))/100)*pageW;
    const h=(Math.max(1, Math.min(220, +(layer.heightPct ?? (type==='svg' ? 100 : 8))))/100)*pageH;
    const opacity=Math.max(.01, Math.min(1, +(layer.opacity ?? 1)));
    const angle=Math.max(-180, Math.min(180, +(layer.angle ?? 0)));
    const common=`opacity="${opacity}" transform="translate(${x.toFixed(3)} ${y.toFixed(3)}) rotate(${angle.toFixed(3)})"`;
    if(type==='text'){
      const raw=resolveSelectableSheetTextTokens(layer.text);
      if(!raw.trim()) return '';
      const style=layer.style || {};
      const fontSize=Math.max(6, Math.min(140, +(style.fontSize ?? 11))) * .352778;
      const family=String(style.fontFamily || 'Times New Roman').replace(/["<>]/g,'');
      const color=/^#[0-9a-f]{6}$/i.test(String(style.color||'')) ? String(style.color) : '#111111';
      const weight=style.bold ? 700 : 400;
      const italic=style.italic ? 'italic' : 'normal';
      const decoration=style.underline ? 'underline' : 'none';
      const align=/^(left|right|center)$/i.test(String(layer.align||'')) ? String(layer.align).toLowerCase() : 'center';
      const anchor=align==='left' ? 'start' : align==='right' ? 'end' : 'middle';
      const textX=align==='left' ? 0 : align==='right' ? w : w/2;
      const lineH=fontSize*1.18;
      const tspans=raw.split(/\r?\n/).map((line,lineIdx)=>`<tspan x="${textX.toFixed(3)}" y="${(fontSize + lineIdx*lineH).toFixed(3)}">${escapeSelectablePaperHTML(line)}</tspan>`).join('');
      return `<g ${common}><text text-anchor="${anchor}" font-family="${escapeSelectablePaperHTML(family)}" font-size="${fontSize.toFixed(3)}" font-weight="${weight}" font-style="${italic}" text-decoration="${decoration}" fill="${color}">${tspans}</text></g>`;
    }
    const src=type==='svg' ? (String(layer.svgSrc || '').trim() || svgDataUrl(layer.svg)) : String(layer.image || '').trim();
    if(!/^data:image\//i.test(src)) return '';
    const par=(type==='svg' && +(layer.widthPct ?? 0) >= 90 && +(layer.heightPct ?? 0) >= 90) ? 'xMidYMid meet' : 'xMinYMin meet';
    return `<g ${common}><image href="${escapeSelectablePaperHTML(src)}" x="0" y="0" width="${w.toFixed(3)}" height="${h.toFixed(3)}" preserveAspectRatio="${par}"/></g>`;
  }).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}" preserveAspectRatio="none">${nodes}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function loadSelectableSheetImage(src){
  return new Promise(resolve=>{
    const img=new Image();
    img.crossOrigin='anonymous';
    const done=()=>resolve(img);
    img.onload=done;
    img.onerror=()=>resolve(null);
    img.src=src;
  });
}

async function makeSelectableSheetTemplateRasterSrc(layers=[], scale=4){
  const mmToPx=12*scale;
  const pageWmm=210;
  const pageHmm=297;
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(pageWmm*mmToPx);
  canvas.height=Math.round(pageHmm*mmToPx);
  const ctx=canvas.getContext('2d');
  if(!ctx) return '';
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const sorted=(Array.isArray(layers) ? layers : []).slice().sort((a,b)=>(+(a.z||0))-(+(b.z||0)));
  for(const layer of sorted){
    if(!layer || !(layer.text || layer.svgSrc || layer.svg || layer.image)) continue;
    const type=String(layer.type || '').toLowerCase();
    const x=(Math.max(0, Math.min(100, +(layer.xPct ?? 0)))/100)*canvas.width;
    const y=(Math.max(0, Math.min(100, +(layer.yPct ?? 0)))/100)*canvas.height;
    const w=(Math.max(1, Math.min(220, +(layer.widthPct ?? 40)))/100)*canvas.width;
    const boxH=(Math.max(1, Math.min(220, +(layer.heightPct ?? (type==='svg' ? 100 : 8))))/100)*canvas.height;
    const opacity=Math.max(.01, Math.min(1, +(layer.opacity ?? 1)));
    const angle=Math.max(-180, Math.min(180, +(layer.angle ?? 0)))*Math.PI/180;
    ctx.save();
    ctx.globalAlpha=opacity;
    ctx.translate(x,y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.rect(0,0,w,boxH);
    ctx.clip();
    if(type==='text'){
      const raw=resolveSelectableSheetTextTokens(layer.text);
      if(raw.trim()){
        const style=layer.style || {};
        const fontSize=Math.max(6, Math.min(140, +(style.fontSize ?? 11))) * (96/72) * scale;
        const family=String(style.fontFamily || 'Times New Roman').replace(/["<>]/g,'');
        const color=/^#[0-9a-f]{6}$/i.test(String(style.color||'')) ? String(style.color) : '#111111';
        const weight=style.bold ? '700' : '400';
        const italic=style.italic ? 'italic ' : '';
        const align=/^(left|right|center)$/i.test(String(layer.align||'')) ? String(layer.align).toLowerCase() : 'center';
        ctx.font=`${italic}${weight} ${fontSize}px "${family}"`;
        ctx.fillStyle=color;
        ctx.textBaseline='top';
        ctx.textAlign=align;
        const textX=align==='left' ? 0 : align==='right' ? w : w/2;
        const lineH=fontSize*1.18;
        const lines=raw.split(/\r?\n/);
        const blockH=lines.length*lineH;
        const startY=Math.max(0, (boxH-blockH)/2);
        lines.forEach((line,lineIdx)=>{
          const ty=startY + lineIdx*lineH;
          ctx.fillText(line, textX, ty);
          if(style.underline){
            const width=ctx.measureText(line).width;
            const ux=align==='left' ? textX : align==='right' ? textX-width : textX-width/2;
            ctx.fillRect(ux, ty+fontSize*1.08, width, Math.max(1, fontSize*.045));
          }
        });
      }
    }else{
      const rawSvg=String(layer.svg || '').trim();
      const src=(type==='svg' && rawSvg)
        ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(rawSvg)
        : (type==='svg' && /^data:image\//i.test(String(layer.image||'')))
          ? String(layer.image)
          : type==='svg'
            ? String(layer.svgSrc || '')
            : String(layer.image || '');
      const img=await loadSelectableSheetImage(src);
      if(img){
        const naturalW=img.naturalWidth || img.width || 1;
        const naturalH=img.naturalHeight || img.height || 1;
        let drawW=w;
        let drawH=w*(naturalH/Math.max(1,naturalW));
        if(drawH>boxH){
          drawH=boxH;
          drawW=boxH*(naturalW/Math.max(1,naturalH));
        }
        const isFullSheet=+(layer.widthPct ?? 0)>=90 && +(layer.heightPct ?? 0)>=90;
        const dx=isFullSheet ? (w-drawW)/2 : 0;
        const dy=isFullSheet ? (boxH-drawH)/2 : 0;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      }
    }
    ctx.restore();
  }
  return canvas.toDataURL('image/png', .96);
}

function trimSelectableSheetCanvas(canvas, padding=2){
  try{
    const ctx=canvas?.getContext?.('2d');
    if(!ctx || !canvas.width || !canvas.height) return null;
    const image=ctx.getImageData(0,0,canvas.width,canvas.height);
    const data=image.data;
    let minX=canvas.width, minY=canvas.height, maxX=-1, maxY=-1;
    for(let y=0;y<canvas.height;y++){
      for(let x=0;x<canvas.width;x++){
        const index=(y*canvas.width+x)*4;
        if(data[index+3]>3){
          minX=Math.min(minX,x);
          minY=Math.min(minY,y);
          maxX=Math.max(maxX,x);
          maxY=Math.max(maxY,y);
        }
      }
    }
    if(maxX<minX || maxY<minY) return null;
    const left=Math.max(0,minX-padding);
    const top=Math.max(0,minY-padding);
    const right=Math.min(canvas.width-1,maxX+padding);
    const bottom=Math.min(canvas.height-1,maxY+padding);
    const width=Math.max(1,right-left+1);
    const height=Math.max(1,bottom-top+1);
    const cropped=document.createElement('canvas');
    cropped.width=width;
    cropped.height=height;
    const cctx=cropped.getContext('2d');
    cctx.imageSmoothingEnabled=true;
    cctx.imageSmoothingQuality='high';
    cctx.drawImage(canvas,left,top,width,height,0,0,width,height);
    return {canvas:cropped,left,top,width,height};
  }catch(_){
    return null;
  }
}

function reinforceSelectableSheetCanvas(canvas, strength=1){
  const amount=Math.max(1, Math.min(4, +(strength || 1)));
  if(amount<=1.01) return canvas;
  try{
    const copy=document.createElement('canvas');
    copy.width=canvas.width;
    copy.height=canvas.height;
    const cctx=copy.getContext('2d');
    cctx.drawImage(canvas,0,0);
    const ctx=canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    const passes=Math.min(8, Math.ceil((amount-1)*3));
    const alpha=Math.min(.38, (amount-1)/Math.max(1,passes));
    const offsets=[[0,0],[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
    for(let i=0;i<passes;i++){
      const [dx,dy]=offsets[(i+1)%offsets.length];
      ctx.globalAlpha=alpha;
      ctx.drawImage(copy,dx,dy);
    }
    ctx.restore();
  }catch(_){ }
  return canvas;
}

async function drawSelectableSheetLayerOnCanvas(ctx, canvasWidth, canvasHeight, layer, scale=2){
  if(!ctx || !layer || !(layer.text || layer.svgSrc || layer.svg || layer.image)) return false;
  const type=String(layer.type || '').toLowerCase();
  const x=(Math.max(0, Math.min(100, +(layer.xPct ?? 0)))/100)*canvasWidth;
  const y=(Math.max(0, Math.min(100, +(layer.yPct ?? 0)))/100)*canvasHeight;
  const w=(Math.max(1, Math.min(220, +(layer.widthPct ?? 40)))/100)*canvasWidth;
  const boxH=(Math.max(1, Math.min(220, +(layer.heightPct ?? (type==='svg' ? 100 : 8))))/100)*canvasHeight;
  const opacity=Math.max(.01, Math.min(1, +(layer.opacity ?? 1)));
  const angle=Math.max(-180, Math.min(180, +(layer.angle ?? 0)))*Math.PI/180;
  ctx.save();
  ctx.globalAlpha=opacity;
  ctx.translate(x,y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.rect(0,0,w,boxH);
  ctx.clip();
  if(type==='text'){
    const raw=resolveSelectableSheetTextTokens(layer.text);
    if(raw.trim()){
      const style=layer.style || {};
      const fontSize=Math.max(6, Math.min(140, +(style.fontSize ?? 11))) * (96/72) * scale;
      const family=String(style.fontFamily || 'Times New Roman').replace(/["<>]/g,'');
      const color=/^#[0-9a-f]{6}$/i.test(String(style.color||'')) ? String(style.color) : '#111111';
      const weight=style.bold ? '700' : '400';
      const italic=style.italic ? 'italic ' : '';
      const align=/^(left|right|center)$/i.test(String(layer.align||'')) ? String(layer.align).toLowerCase() : 'center';
      ctx.font=`${italic}${weight} ${fontSize}px "${family}"`;
      ctx.fillStyle=color;
      ctx.textBaseline='top';
      ctx.textAlign=align;
      const textX=align==='left' ? 0 : align==='right' ? w : w/2;
      const lineH=fontSize*1.18;
      const lines=raw.split(/\r?\n/);
      const blockH=lines.length*lineH;
      const startY=Math.max(0, (boxH-blockH)/2);
      lines.forEach((line,lineIdx)=>{
        const ty=startY + lineIdx*lineH;
        ctx.fillText(line, textX, ty);
        if(style.underline){
          const width=ctx.measureText(line).width;
          const ux=align==='left' ? textX : align==='right' ? textX-width : textX-width/2;
          ctx.fillRect(ux, ty+fontSize*1.08, width, Math.max(1, fontSize*.045));
        }
      });
    }
  }else{
    const rawSvg=String(layer.svg || '').trim();
    const src=(type==='svg' && rawSvg)
      ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(rawSvg)
      : (type==='svg' && /^data:image\//i.test(String(layer.image||'')))
        ? String(layer.image)
        : type==='svg'
          ? String(layer.svgSrc || '')
          : String(layer.image || '');
    const img=await loadSelectableSheetImage(src);
    if(img){
      const naturalW=img.naturalWidth || img.width || 1;
      const naturalH=img.naturalHeight || img.height || 1;
      let drawW=w;
      let drawH=w*(naturalH/Math.max(1,naturalW));
      if(drawH>boxH){
        drawH=boxH;
        drawW=boxH*(naturalW/Math.max(1,naturalH));
      }
      const isFullSheet=+(layer.widthPct ?? 0)>=90 && +(layer.heightPct ?? 0)>=90;
      const dx=isFullSheet ? (w-drawW)/2 : 0;
      const dy=isFullSheet ? (boxH-drawH)/2 : 0;
      ctx.drawImage(img, dx, dy, drawW, drawH);
    }
  }
  ctx.restore();
  return true;
}

async function makeSelectableSheetTemplateLayerImages(layers=[], scale=2){
  const mmToPx=12*scale;
  const pageWmm=210;
  const pageHmm=297;
  const canvasWidth=Math.round(pageWmm*mmToPx);
  const canvasHeight=Math.round(pageHmm*mmToPx);
  const sorted=(Array.isArray(layers) ? layers : [])
    .filter(layer=>layer && (layer.text || layer.svgSrc || layer.svg || layer.image))
    .filter(layer=>!(String(layer.type||'').toLowerCase()==='text' && /\{page\}|\{total\}/i.test(String(layer.text||''))))
    .slice()
    .sort((a,b)=>(+(a.z||0))-(+(b.z||0)));
  const result=[];
  for(const layer of sorted){
    const canvas=document.createElement('canvas');
    canvas.width=canvasWidth;
    canvas.height=canvasHeight;
    const ctx=canvas.getContext('2d');
    if(!ctx) continue;
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.clearRect(0,0,canvas.width,canvas.height);
    await drawSelectableSheetLayerOnCanvas(ctx, canvas.width, canvas.height, layer, scale);
    if(String(layer.type || '').toLowerCase()!=='text') reinforceSelectableSheetCanvas(canvas, layer.strength);
    const trimmed=trimSelectableSheetCanvas(canvas, Math.max(2, Math.round(mmToPx*.25)));
    if(!trimmed) continue;
    result.push({
      src:trimmed.canvas.toDataURL('image/png', .96),
      xMm:trimmed.left/mmToPx,
      yMm:trimmed.top/mmToPx,
      wMm:trimmed.width/mmToPx,
      hMm:trimmed.height/mmToPx
    });
  }
  return result;
}

function formatSelectablePaperText(value){
  const raw=String(value||'');
  if(typeof formatLinkedPreviewTextHTML==='function') return formatLinkedPreviewTextHTML(raw);
  return escapeSelectablePaperHTML(raw).replace(/\r?\n/g,'<br>');
}

function getSelectableCircuitSvgMarkup(fig){
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
    const raw=/;base64/i.test(src.slice(0,comma)) ? decodeSvgBase64Utf8(src.slice(comma+1)) : decodeURIComponent(src.slice(comma+1));
    // Stored circuits are generated locally. Reject executable SVG from imported files.
    if(!/^\s*<svg\b/i.test(raw) || /<script\b|<foreignObject\b|\son\w+\s*=|javascript:/i.test(raw)) return '';
    return raw;
  }catch(_){
    return '';
  }
}

function buildSelectablePaperFigureStack(normalized, boxW, boxH){
  const html=normalized.map(({fig,x,y,width,height},index)=>{
    const circuitSvg=getSelectableCircuitSvgMarkup(fig);
    if(circuitSvg){
      return `<span class="selectable-coordinate-figure selectable-coordinate-circuit" aria-label="Circuit diagram ${index+1}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px">${circuitSvg}</span>`;
    }
    return `<img class="selectable-coordinate-figure" src="${escapeSelectablePaperHTML(fig.src)}" alt="Placed figure ${index+1}" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px">`;
  }).join('');
  return `<div class="selectable-figure-flow-layer" aria-hidden="true"><div class="selectable-figure-flow-stack" style="width:${boxW}px;height:${boxH}px">${html}</div></div>`;
}

function getSelectablePaperFigureLayer(figures){
  const seen=new Set();
  const list=(Array.isArray(figures) ? figures : []).filter(fig=>{
    const src=String(fig?.src||'');
    if(!/^data:image\//i.test(src)) return false;
    const stamp=[src.slice(0,96),Math.round(+fig.x||0),Math.round(+fig.y||0),Math.round(+fig.w||0),Math.round(+fig.h||0)].join('|');
    if(seen.has(stamp)) return false;
    seen.add(stamp);
    return true;
  });
  if(!list.length) return {html:'',flowHtml:''};
  let minX=Infinity,minY=Infinity,maxRight=0,maxBottom=0;
  const normalized=list.map(fig=>{
    const width=Math.max(12,Math.min(680,Math.round(+fig.w||160)));
    const height=Math.max(12,Math.min(3400,Math.round(+fig.h||100)));
    const x=Math.max(0,Math.min(Math.max(0,680-width),Math.round(+fig.x||0)));
    const y=Math.max(0,Math.min(3400,Math.round(+fig.y||0)));
    minX=Math.min(minX,x);
    minY=Math.min(minY,y);
    maxRight=Math.max(maxRight,x+width);
    maxBottom=Math.max(maxBottom,y+height);
    return {fig,x,y,width,height};
  });
  const boxW=Math.max(24,Math.min(680,Math.round(maxRight)));
  const boxH=Math.max(18,Math.round(maxBottom));
  const flowX=Number.isFinite(minX) ? minX : 0;
  const flowY=Number.isFinite(minY) ? minY : 0;
  const flowNormalized=normalized.map(item=>({...item,x:item.x-flowX,y:item.y-flowY}));
  const flowW=Math.max(24,Math.min(680,Math.round(maxRight-flowX)));
  const flowH=Math.max(18,Math.round(maxBottom-flowY));
  return {
    html:buildSelectablePaperFigureStack(normalized, boxW, boxH),
    flowHtml:buildSelectablePaperFigureStack(flowNormalized, flowW, flowH),
    width:boxW,
    height:boxH,
    flowWidth:flowW,
    flowHeight:flowH
  };
}

function wrapSelectablePaperFrame(content, figureLayer){
  if(!figureLayer?.html) return content;
  const minHeight=Math.max(18, Math.round(+figureLayer.height || 0));
  return `<div class="selectable-frame-stack selectable-coordinate-frame" style="min-height:${minHeight}px">${content?`<div class="selectable-frame-source">${content}</div>`:''}${figureLayer.html}</div>`;
}

function clampSelectableComposerTextSize(value){
  if(typeof clampMixedComposerTextSize==='function') return clampMixedComposerTextSize(value);
  const n=Math.round(Number(value)||20);
  return Math.max(12, Math.min(32, n));
}

function clampSelectableComposerMathSize(value){
  if(typeof clampMixedComposerMathSize==='function') return clampMixedComposerMathSize(value);
  const n=Math.round(Number(value)||22);
  return Math.max(14, Math.min(52, n));
}

function clampSelectableComposerInnerScale(value){
  if(typeof clampMixedComposerInnerMathScale==='function') return clampMixedComposerInnerMathScale(value);
  const n=Math.round(Number(value)||115);
  return Math.max(90, Math.min(180, n));
}

function getSelectablePaperFrameTypography(record, option=false){
  const textSize=clampSelectableComposerTextSize(option ? record?.composerTextSize : record?.questionComposerTextSize);
  const mathSize=clampSelectableComposerMathSize(option ? record?.composerMathSize : record?.questionComposerMathSize);
  const innerScale=clampSelectableComposerInnerScale(option ? record?.composerInnerMathScale : record?.questionComposerInnerMathScale);
  const line=Math.max(1.38, (textSize+8)/textSize);
  const innerEm=Math.max(.7, Math.min(1.8, innerScale/100));
  const mathEm=Math.max(.58, Math.min(3.2, (mathSize/Math.max(1,textSize))*innerEm));
  const nestedFracEm=.86;
  const ink=typeof clampMixedComposerEquationStroke==='function'
    ? clampMixedComposerEquationStroke(option ? record?.composerEquationInk : record?.questionComposerEquationInk)
    : String((option ? record?.composerEquationInk : record?.questionComposerEquationInk)||'light');
  const inkWeights={fine:300,light:400,regular:500,bold:650,extra:800};
  const inkWeight=inkWeights[ink]||400;
  return {textSize, mathSize, innerScale, line, mathEm, innerEm, nestedFracEm, ink, inkWeight};
}

function getSelectablePaperFrameStyle(record, option=false){
  const t=getSelectablePaperFrameTypography(record, option);
  return [
    `--selectable-text-size:${t.textSize}px`,
    `--selectable-line-height:${t.line.toFixed(2)}`,
    `--selectable-math-size:${t.mathSize}px`,
    `--selectable-math-em:${t.mathEm.toFixed(3)}em`,
    `--selectable-inner-math-em:${t.innerEm.toFixed(3)}em`,
    `--selectable-nested-frac-em:${t.nestedFracEm.toFixed(3)}em`,
    `--selectable-ink-weight:${t.inkWeight}`,
    `--selectable-frame-width:100%`,
    `font-size:${t.textSize}px`,
    `line-height:${t.line.toFixed(2)}`,
    `font-weight:${t.inkWeight}`
  ].join(';');
}

function wrapSelectableTypedFrame(html, record, option=false){
  return `<div class="selectable-typed-frame" style="${getSelectablePaperFrameStyle(record, option)}">${html}</div>`;
}

const SELECTABLE_FIGURE_MARKER_RE=/(\[\[FIGURE\]\]|\[Figure\]|\[Image\])/g;
const SELECTABLE_FIGURE_MARKER_TEST_RE=/^(?:\[\[FIGURE\]\]|\[Figure\]|\[Image\])$/;

function stripSelectableFigureMarkers(value){
  return removeSelectableFigureMarkers(value).trim();
}

function removeSelectableFigureMarkers(value){
  return String(value||'').replace(SELECTABLE_FIGURE_MARKER_RE,'');
}

function prepareSelectablePaperLatexSource(source, record=null, option=false){
  let out=String(source||'').trim();
  if(!out) return '';
  const innerScale=getSelectablePaperFrameTypography(record || {}, option).innerScale;
  out=out.replace(/^\\(?:displaystyle|textstyle|scriptstyle|scriptscriptstyle)\b\s*/,'');
  if(innerScale<=100){
    out=out.replace(/\\(?:dfrac|frac|tfrac)\b/g,'\\tfrac');
    return out;
  }
  if(innerScale>=105) out=out.replace(/\\tfrac/g,'\\frac');
  if(innerScale>=115) out=out.replace(/\\frac/g,'\\dfrac');
  // Do not prefix a global TeX style command. PDF source commonly mixes prose
  // and inline math ("The value is \\frac{a}{b}"). A leading \\displaystyle
  // becomes a detached/literal token in the mixed renderer and can force the
  // following fraction onto its own line. Explicit fraction commands preserve
  // the requested scale without changing the sentence's inline flow.
  return out;
}

function renderSelectablePaperSourceHTML(source, record=null, option=false){
  const raw=String(source||'');
  const clean=raw.trim();
  if(!clean) return raw ? formatSelectablePaperText(raw) : '';
  const sourceIsLatex=typeof isSelectableLatexSource==='function' && isSelectableLatexSource(clean);
  const singleLatex=sourceIsLatex && (
    typeof shouldRenderSelectableSourceAsSingleLatex==='function'
      ? shouldRenderSelectableSourceAsSingleLatex(raw)
      : !/\n/.test(clean)
  );
  if(singleLatex && typeof renderSelectableLatexPreviewHTML==='function'){
    const inlineHtml=renderSelectableLatexPreviewHTML(prepareSelectablePaperLatexSource(clean, record, option));
    // selectable-frame-stack is a column flex container. Keep mixed prose and
    // its math atoms inside one line box so text nodes do not become separate
    // anonymous flex rows in the printable document.
    return `<span class="lp-text-line">${inlineHtml}</span>`;
  }
  return formatSelectablePaperText(raw);
}

function renderSelectablePaperSourceWithFigures(source, figureLayer, record=null, option=false){
  const raw=String(source||'');
  if(!raw || !figureLayer?.html || !SELECTABLE_FIGURE_MARKER_RE.test(raw)){
    SELECTABLE_FIGURE_MARKER_RE.lastIndex=0;
    return {html:renderSelectablePaperSourceHTML(removeSelectableFigureMarkers(raw), record, option), placed:false};
  }
  SELECTABLE_FIGURE_MARKER_RE.lastIndex=0;
  const parts=raw.split(SELECTABLE_FIGURE_MARKER_RE);
  let placed=false;
  const html=parts.map((part,index)=>{
    if(SELECTABLE_FIGURE_MARKER_TEST_RE.test(part)){
      if(placed) return '';
      placed=true;
      return figureLayer.flowHtml || figureLayer.html;
    }
    // The line break that carries a standalone figure marker is structural,
    // not an authored empty paragraph. Remove only the adjacent break so the
    // PDF keeps intentional blank lines elsewhere without adding a large gap.
    let textPart=part;
    if(SELECTABLE_FIGURE_MARKER_TEST_RE.test(parts[index+1]||'')) textPart=textPart.replace(/\r?\n[ \t]*$/,'');
    if(SELECTABLE_FIGURE_MARKER_TEST_RE.test(parts[index-1]||'')) textPart=textPart.replace(/^[ \t]*\r?\n/,'');
    return renderSelectablePaperSourceHTML(textPart, record, option);
  }).join('');
  return {html, placed};
}

function getSelectablePaperFrameHTML(record, option=false){
  const rawManual=String(option ? (record?.pdfText || '') : (record?.questionPdfText || '')).trim();
  const manualFlag=option ? !!record?.pdfTextManual : !!record?.questionPdfTextManual;
  const manual=manualFlag ? rawManual : '';
  const composerHtml=String(option ? (record?.composerHTML || '') : (record?.questionComposerHTML || '')).trim();
  const source=manual || (option
    ? (typeof getOptionPdfSourceText==='function' ? getOptionPdfSourceText(record) : record?.text || '')
    : (typeof getQuestionPdfSourceText==='function' ? getQuestionPdfSourceText(record) : record?.questionText || ''));
  const figures=[
    ...(option ? (record?.figures || []) : (record?.questionFigures || [])),
    ...(option ? (record?.burnedFigures || []) : (record?.questionBurnedFigures || []))
  ];
  const figureLayer=getSelectablePaperFigureLayer(figures);
  const inlineImages=composerHtml && typeof getLinkedComposerImageHTML==='function' ? getLinkedComposerImageHTML(composerHtml) : '';
  const burnedLayer=String(option ? (record?.burnedFigureImage || '') : (record?.questionBurnedFigureImage || '')).trim();
  const burnedLayerHtml=!figureLayer.html && /^data:image\//i.test(burnedLayer)
    ? `<img class="selectable-fallback-image selectable-burned-figure-layer" src="${escapeSelectablePaperHTML(burnedLayer)}" alt="Placed figure layer">`
    : '';
  const attachedImages=inlineImages + burnedLayerHtml;
  const finish=(content, placedFigureLayer=false)=>{
    const combined=content+attachedImages;
    // PDF content must participate in document flow. Canvas-space overlays put
    // the figure behind later text and reserve its original Y offset as blank
    // paper. Marker placement already uses the compact, origin-normalized layer;
    // use that same layer as the fallback after text when no marker is present.
    const flowFigure=(!placedFigureLayer && figureLayer.flowHtml) ? figureLayer.flowHtml : '';
    const framed=`<div class="selectable-frame-stack">${combined}${flowFigure}</div>`;
    return wrapSelectableTypedFrame(framed, record, option);
  };
  const sourceWithMarkers=String(source||'');
  const selectableSource=stripSelectableFigureMarkers(sourceWithMarkers);
  const sourceIsLatex=typeof isSelectableLatexSource==='function' && isSelectableLatexSource(selectableSource);
  const renderedSource=sourceWithMarkers ? renderSelectablePaperSourceWithFigures(sourceWithMarkers, figureLayer, record, option) : {html:'', placed:false};
  // A figure marker is an explicit layout instruction. Honour it before the
  // richer composer fallback so text below the marker cannot collide with an
  // absolutely positioned canvas layer.
  if(renderedSource.placed && renderedSource.html){
    return finish(renderedSource.html, true);
  }
  // Keep Text PDF in lockstep with the repaired selectable preview path:
  // LaTeX/PDF source is canonical because composer widget HTML can go stale
  // after the first math atom while the canvas still contains the full render.
  if(sourceIsLatex && renderedSource.html){
    return finish(renderedSource.html, renderedSource.placed);
  }
  // Composer HTML preserves mixed inline widgets/images for non-LaTeX source.
  // Use it only after the canonical LaTeX path has had first refusal.
  if(!manual && composerHtml && typeof getLinkedPreviewRichHTMLFromComposerHTML==='function'){
    return finish(getLinkedPreviewRichHTMLFromComposerHTML(composerHtml));
  }
  if(renderedSource.html) return finish(renderedSource.html, false);
  if(attachedImages || figureLayer.html) return finish('');
  const image=String(option
    ? (record?.image || record?.viewerImage || record?.baseImage || '')
    : (record?.questionImage || record?.questionViewerImage || record?.questionBaseImage || '')).trim();
  if(/^data:image\//i.test(image)) return finish(`<img class="selectable-fallback-image" src="${escapeSelectablePaperHTML(image)}" alt="Rendered question frame">`);
  return wrapSelectableTypedFrame('<span class="selectable-empty">No printable content was added for this frame.</span>', record, option);
}

function snapshotSelectablePdfEditorState(){
  if(typeof cur==='undefined' || !cur) return;
  const questionBox=document.getElementById('pdfQuestionText');
  if(questionBox){
    if(typeof setFramePdfTextOverride==='function') setFramePdfTextOverride('q', questionBox.value);
    else if(typeof storePdfText==='function') cur.questionPdfText=storePdfText(questionBox.value);
    else cur.questionPdfText=String(questionBox.value||'').trim();
  }
  (cur.options||[]).forEach((opt,index)=>{
    const box=document.getElementById('pdfOptionText'+index);
    if(box && opt){
      if(typeof setFramePdfTextOverride==='function') setFramePdfTextOverride('opt'+index, box.value);
      else if(typeof storePdfText==='function') opt.pdfText=storePdfText(box.value);
      else opt.pdfText=String(box.value||'').trim();
    }
  });
  try{ if(typeof saveLS==='function') saveLS(); }catch(_){ }
}

function buildSelectablePaperDocument(settings={}){
  const identity=getCurrentExportIdentity();
  const publishing=getPdfExportPublishing(settings);
  const theme=String(settings?.theme || '').toLowerCase();
  const cleanTheme=theme==='cleantheam';
  const watermarkText=String(settings?.text||'').trim();
  const watermarkImage=String(settings?.image||'').trim();
  const watermarkSvg=(typeof sanitizePdfWatermarkSvg==='function') ? sanitizePdfWatermarkSvg(settings?.vectorSvg || '') : '';
  const watermarkSvgSrc=watermarkSvg && typeof svgTextToDataUrl==='function' ? svgTextToDataUrl(watermarkSvg) : '';
  const wmPlace=settings?.placement || {};
  const wmXPct=Math.max(0, Math.min(100, +(wmPlace.xPct ?? 50)));
  const wmYPct=Math.max(0, Math.min(100, +(wmPlace.yPct ?? (cleanTheme ? 54 : 52))));
  const wmWidthPct=Math.max(5, Math.min(120, +(wmPlace.widthPct ?? (cleanTheme ? 74 : 64))));
  const wmOpacity=Math.max(.01, Math.min(1, +(wmPlace.opacity ?? (cleanTheme ? .13 : .10))));
  const wmAssetAngle=Math.max(-180, Math.min(180, +(wmPlace.assetAngle ?? 0)));
  const textPlace=settings?.textPlacement || wmPlace;
  const textXPct=Math.max(0, Math.min(100, +(textPlace.xPct ?? 50)));
  const textYPct=Math.max(0, Math.min(100, +(textPlace.yPct ?? (cleanTheme ? 95 : 52))));
  const textOpacity=Math.max(.01, Math.min(1, +(textPlace.opacity ?? 1)));
  const wmTextAngle=Math.max(-180, Math.min(180, +(textPlace.textAngle ?? (cleanTheme ? 0 : -42))));
  const textStyle=settings?.textStyle || {};
  const safeFonts=new Set(['Arial','Times New Roman','Georgia','Cambria','Verdana']);
  const textFont=safeFonts.has(String(textStyle.fontFamily||'')) ? String(textStyle.fontFamily) : (cleanTheme ? 'Arial' : 'Times New Roman');
  const textSize=Math.max(6, Math.min(140, +(textStyle.fontSize ?? (cleanTheme ? 11 : 58))));
  const textColor=/^#[0-9a-f]{6}$/i.test(String(textStyle.color||'')) ? String(textStyle.color) : (cleanTheme ? '#cc0000' : '#111111');
  const textWeight=textStyle.bold ? 700 : 400;
  const textItalic=textStyle.italic ? 'italic' : 'normal';
  const textDecoration=textStyle.underline ? 'underline' : 'none';
  const normalizeWhiteLabelLayer=(layer)=>{
    if(!layer || typeof layer!=='object') return null;
    const type=String(layer.type || '').toLowerCase();
    const base={
      id:String(layer.id || Math.random()).replace(/[^\w-]/g,''),
      type,
      xPct:Math.max(0, Math.min(100, +(layer.xPct ?? 50))),
      yPct:Math.max(0, Math.min(100, +(layer.yPct ?? 50))),
      opacity:Math.max(.01, Math.min(1, +(layer.opacity ?? 1))),
      angle:Math.max(-180, Math.min(180, +(layer.angle ?? 0))),
      widthPct:Math.max(5, Math.min(220, +(layer.widthPct ?? 40))),
      strength:Math.max(1, Math.min(4, +(layer.strength ?? 1)))
    };
    if(type==='text'){
      const style=layer.style || {};
      const font=safeFonts.has(String(style.fontFamily||'')) ? String(style.fontFamily) : 'Times New Roman';
      const color=/^#[0-9a-f]{6}$/i.test(String(style.color||'')) ? String(style.color) : '#111111';
      return {...base,text:String(layer.text || '').trim(),align:String(layer.align || 'center'),style:{
        fontSize:Math.max(6, Math.min(140, +(style.fontSize ?? 11))),
        fontFamily:font,
        color,
        bold:!!style.bold,
        italic:!!style.italic,
        underline:!!style.underline
      }};
    }
    if(type==='svg'){
      const svg=(typeof sanitizePdfWatermarkSvg==='function') ? sanitizePdfWatermarkSvg(layer.svg || '') : '';
      const image=String(layer.image || '').trim();
      const svgSrc=svg && typeof svgTextToDataUrl==='function' ? svgTextToDataUrl(svg) : '';
      return svg ? {...base,svg,svgSrc,image:/^data:image\//i.test(image) ? image : ''} : null;
    }
    if(type==='image'){
      const image=String(layer.image || '').trim();
      return /^data:image\//i.test(image) ? {...base,image} : null;
    }
    return null;
  };
  const sheetTemplateSourceLayers=Array.isArray(settings?.sheetTemplateLayers)
    ? settings.sheetTemplateLayers
    : (Array.isArray(settings?.whiteLabelLayers) ? settings.whiteLabelLayers : []);
  const whiteLabelLayers=sheetTemplateSourceLayers
    .map(normalizeWhiteLabelLayer)
    .filter(layer=>layer && (layer.text || layer.svg || layer.image));
  const sheetLayout=settings?.sheetTemplateLayout || null;
  const useSheetLayout=!!(whiteLabelLayers.length && sheetLayout);
  const pageMarginTop=useSheetLayout ? Math.max(0, Math.min(120, +(sheetLayout.topPct ?? 14) * 2.97)) : 24;
  const pageMarginBottom=useSheetLayout ? Math.max(0, Math.min(100, +(sheetLayout.bottomPct ?? 8) * 2.97)) : 18;
  const pageMarginLeft=useSheetLayout ? Math.max(0, Math.min(90, +(sheetLayout.leftPct ?? 12) * 2.1)) : 25;
  const pageMarginRight=useSheetLayout ? Math.max(0, Math.min(90, +(sheetLayout.rightPct ?? 8) * 2.1)) : 25;
  const pageCssMargin=useSheetLayout ? '0' : `${pageMarginTop}mm ${pageMarginRight}mm ${pageMarginBottom}mm ${pageMarginLeft}mm`;
  const sheetBgLeft=useSheetLayout ? 0 : -pageMarginLeft;
  const sheetBgTop=useSheetLayout ? 0 : -pageMarginTop;
  const sheetContentBottomPad=useSheetLayout ? pageMarginBottom+18 : pageMarginBottom;
  const sheetBottomLayers=whiteLabelLayers.filter(layer=>layer && layer.type!=='svg' && +(layer.yPct ?? 0)>62);
  const pageNumberBottomMm=sheetBottomLayers.length ? 18 : 6;
  const totalMarks=qs.reduce((sum,q)=>sum+(+q.marks||0),0);
  const sectionOrder=[];
  const grouped=new Map();
  qs.forEach((q, originalIndex)=>{
    const meta=getSubjectMeta(q.subject);
    const key=meta.short+'|'+meta.section+'|'+meta.full;
    if(!grouped.has(key)){
      grouped.set(key,{meta,regular:[],nat:[],entries:[]});
      sectionOrder.push(key);
    }
    const group=grouped.get(key);
    const entry={q,originalIndex};
    group.entries.push(entry);
    if(q.type==='NAT') group.nat.push(entry); else group.regular.push(entry);
  });
  const orderedKeys=getPdfOrderedSectionKeys(sectionOrder, grouped, publishing);
  let sheetQuestionCounter=0;
  const renderQuestionArticle=(entry, index)=>{
    const q=entry.q;
    const questionHtml=getSelectablePaperFrameHTML(q);
    const options=q.type==='NAT'
      ? (cleanTheme ? '' : '<div class="selectable-nat-answer"><strong>Answer:</strong><span></span></div>')
      : (q.options||[]).map((opt,optIndex)=>`<div class="selectable-option"><div class="selectable-option-label">(${String.fromCharCode(65+optIndex)})</div><div class="selectable-option-content">${getSelectablePaperFrameHTML(opt,true)}</div></div>`).join('');
    const qNo=useSheetLayout ? (++sheetQuestionCounter) : (index+1);
    const qLabel=`Q.${qNo}`;
    return `<article class="selectable-question">
      <div class="selectable-question-main"><div class="selectable-question-label">${qLabel}</div><div class="selectable-question-body">${questionHtml}</div></div>
      ${options}
    </article>`;
  };
  const estimateSheetQuestionHeightMm=(html)=>{
    const source=String(html || '');
    const plain=source
      .replace(/<br\s*\/?>/gi,'\n')
      .replace(/<\/(?:div|p|li|tr|article)>/gi,'\n')
      .replace(/<[^>]+>/g,' ')
      .replace(/&nbsp;/g,' ')
      .replace(/\s+/g,' ')
      .trim();
    const explicitLines=(source.match(/lp-text-line|<br\s*\/?>|\\n/g)||[]).length;
    const textLines=Math.max(1, Math.ceil(plain.length/54) + Math.ceil(explicitLines*.5));
    const optionCount=(source.match(/class="selectable-option"/g)||[]).length;
    const figureCount=(source.match(/selectable-coordinate-circuit|selectable-coordinate-figure|selectable-fallback-image|lp-canvas-figure/g)||[]).length;
    const mathBlocks=(source.match(/lp-frac|lp-root|lp-katex-math|lp-matrix/g)||[]).length;
    return Math.min(270, 16 + textLines*5.7 + optionCount*13 + figureCount*48 + Math.min(24, mathBlocks*1.2));
  };
  const buildSheetPages=(entries)=>{
    const bottomAssetTops=sheetBottomLayers
      .map(layer=>(Math.max(0, Math.min(100, +(layer.yPct ?? 100)))/100)*297);
    const firstBottomAssetMm=bottomAssetTops.length ? Math.min(...bottomAssetTops) : Infinity;
    const contentBottomLimitMm=Math.min(297-pageMarginBottom-18, Number.isFinite(firstBottomAssetMm) ? firstBottomAssetMm-8 : Infinity);
    const maxContentMm=Math.max(40, contentBottomLimitMm-pageMarginTop);
    const gapMm=6;
    const pages=[];
    let page=[];
    let used=0;
    entries.forEach((entry)=>{
      const article=renderQuestionArticle(entry, sheetQuestionCounter);
      const est=estimateSheetQuestionHeightMm(article);
      const nextUsed=used + (page.length ? gapMm : 0) + est;
      const wouldLeaveUnsafeTail=page.length && (maxContentMm-nextUsed)<12;
      if(page.length && (nextUsed>maxContentMm || wouldLeaveUnsafeTail)){
        pages.push(page);
        page=[];
        used=0;
      }
      page.push(article);
      used += (page.length>1 ? gapMm : 0) + est;
    });
    if(page.length) pages.push(page);
    const totalPages=Math.max(1, pages.length);
    return pages.map((articles,pageIdx)=>`<section class="selectable-sheet-page">${articles.join('')}<div class="selectable-page-number">Page ${pageIdx+1} / ${totalPages}</div></section>`).join('');
  };
  const sections=useSheetLayout
    ? buildSheetPages(orderedKeys.flatMap(sectionKey=>getPdfOrderedEntries(grouped.get(sectionKey), publishing)))
    : orderedKeys.map(sectionKey=>{
    const group=grouped.get(sectionKey);
    const entries=getPdfOrderedEntries(group, publishing);
    const sectionTitle=useSheetLayout ? '' : escapeSelectablePaperHTML(group.meta.full || group.meta.short || 'Section');
    const sectionInfo=useSheetLayout ? '' : escapeSelectablePaperHTML(cleanTheme ? getPdfMarkRangeSummary(entries) : `Section: ${getSectionDisplay(group.meta)} | ${getPdfMarkRangeSummary(entries)}`);
    const questions=entries.map((entry,index)=>renderQuestionArticle(entry,index)).join('');
    const intro=useSheetLayout ? '' : `<div class="selectable-section-title">${sectionTitle}</div><div class="selectable-section-summary">${sectionInfo}</div>`;
    return `<section class="selectable-section">${intro}${questions}</section>`;
  }).join('');
  const watermarkStyle=`--wm-x:${wmXPct}%;--wm-y:${wmYPct}%;--wm-w:${wmWidthPct}vw;--wm-opacity:${wmOpacity};--wm-asset-angle:${wmAssetAngle}deg`;
  const watermarkTextStyle=`--wm-text-x:${textXPct}%;--wm-text-y:${textYPct}%;--wm-text-opacity:${textOpacity};--wm-text-angle:${wmTextAngle}deg;--wm-text-size:${textSize}pt;--wm-text-font:"${textFont}";--wm-text-color:${textColor};--wm-text-weight:${textWeight};--wm-text-style:${textItalic};--wm-text-decoration:${textDecoration}`;
  const watermark=(!whiteLabelLayers.length && watermarkText) ? `<div class="selectable-text-watermark" style="${watermarkTextStyle}">${escapeSelectablePaperHTML(watermarkText)}</div>` : '';
  const watermarkVector=(!whiteLabelLayers.length && watermarkSvgSrc) ? `<img class="selectable-vector-watermark" style="${watermarkStyle}" src="${escapeSelectablePaperHTML(watermarkSvgSrc)}" alt="" aria-hidden="true">` : '';
  const watermarkPicture=(!whiteLabelLayers.length && !watermarkSvg && watermarkImage) ? `<img class="selectable-image-watermark" style="${watermarkStyle}" src="${escapeSelectablePaperHTML(watermarkImage)}" alt="">` : '';
  const sheetTemplateLayerImages=Array.isArray(settings?.sheetTemplateLayerImages) ? settings.sheetTemplateLayerImages.filter(layer=>layer && /^data:image\//i.test(String(layer.src||''))) : [];
  const sheetTemplateRaster=String(settings?.sheetTemplateRaster || '').trim();
  const sheetBackgroundSrc=useSheetLayout && whiteLabelLayers.length && !sheetTemplateLayerImages.length
    ? (/^data:image\//i.test(sheetTemplateRaster) ? sheetTemplateRaster : makeSelectableSheetTemplateSvgSrc(whiteLabelLayers))
    : '';
  const sheetLayerImages=useSheetLayout && sheetTemplateLayerImages.length
    ? sheetTemplateLayerImages.map(layer=>`<img class="selectable-sheet-template-layer" style="left:${(+layer.xMm||0).toFixed(3)}mm;top:${(+layer.yMm||0).toFixed(3)}mm;width:${Math.max(.1,+layer.wMm||0).toFixed(3)}mm;height:${Math.max(.1,+layer.hMm||0).toFixed(3)}mm" src="${escapeSelectablePaperHTML(layer.src)}" alt="" aria-hidden="true">`).join('')
    : '';
  const sheetBackground=useSheetLayout && whiteLabelLayers.length && !sheetLayerImages
    ? `<div class="selectable-sheet-template-bg" style="--sheet-bg:url('${escapeSelectableCssUrl(sheetBackgroundSrc)}')" aria-hidden="true"></div>`
    : sheetLayerImages;
  const whiteLabel=useSheetLayout ? '' : whiteLabelLayers.map((layer,idx)=>{
    const isTokenLayer=layer.type==='text' && /\{page\}|\{total\}/i.test(String(layer.text || ''));
    const z=isTokenLayer ? 8 : Math.min(1, idx);
    const xMm=(layer.xPct/100)*210 - (useSheetLayout ? pageMarginLeft : 0);
    const yMm=(layer.yPct/100)*297 - (useSheetLayout ? pageMarginTop : 0);
    const wMm=(layer.widthPct/100)*210;
    const common=`--wl-x:${xMm}mm;--wl-y:${yMm}mm;--wl-o:${layer.opacity};--wl-a:${layer.angle}deg;--wl-z:${z};--wl-w:${wMm}mm`;
    if(layer.type==='text'){
      const style=layer.style || {};
      const boxWidthMm=Math.max(4, (layer.widthPct/100)*210);
      const textSvg=makeSelectableSheetTextSvgSrc(layer.text, style, boxWidthMm / .2646, layer.align || 'center');
      const textWidthMm=Math.max(4, boxWidthMm);
      const textCss=`${common};--wl-text-w:${textWidthMm}mm`;
      return `<img class="selectable-white-label-layer selectable-white-label-text-asset" style="${textCss}" src="${escapeSelectablePaperHTML(textSvg.src)}" alt="" aria-hidden="true">`;
    }
    if(layer.type==='svg'){
      const svgSrc=String(layer.svgSrc || '').trim() || (String(layer.svg || '').trim() ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(String(layer.svg || '').trim()) : '');
      return `<img class="selectable-white-label-layer selectable-white-label-asset" style="${common}" src="${escapeSelectablePaperHTML(svgSrc)}" alt="" aria-hidden="true">`;
    }
    return `<img class="selectable-white-label-layer selectable-white-label-asset" style="${common}" src="${escapeSelectablePaperHTML(layer.image)}" alt="">`;
  }).join('');
  const header='';
  const footer='';
  const title='&#8203;';
  const katexCssHref=escapeSelectablePaperHTML(new URL('assets/vendor/katex/katex.min.css?v=katex1', window.location.href).href);
  const htmlClasses=[cleanTheme?'selectable-clean-theme':'selectable-boxed-theme', useSheetLayout?'selectable-sheet-layout':''].filter(Boolean).join(' ');
  return `<!doctype html><html class="${htmlClasses}"><head><meta charset="utf-8"><title>${title}</title><link rel="stylesheet" href="${katexCssHref}"><style>
    @page{size:A4;margin:${pageCssMargin}}
    *{box-sizing:border-box}
    html,body{margin:0;background:#fff;color:#090909;font-family:"Times New Roman","Cambria Math","STIX Two Math",serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    body{padding:0}
    body{font-size:11.5pt;line-height:1.36}
    .selectable-page{position:relative;z-index:3;width:100%}
    .selectable-sheet-layout body{width:210mm;margin:0}
    .selectable-sheet-layout .selectable-page{width:210mm}
    .selectable-sheet-page{position:relative;width:210mm;height:297mm;padding:${pageMarginTop}mm ${pageMarginRight}mm ${sheetContentBottomPad}mm ${pageMarginLeft}mm;overflow:hidden;break-after:page;page-break-after:always}.selectable-sheet-page:last-child{break-after:auto;page-break-after:auto}
    .selectable-page-number{position:absolute;left:0;right:0;bottom:${pageNumberBottomMm}mm;text-align:center;font:9pt/1 "Times New Roman",serif;color:#111827;opacity:.86;z-index:5;pointer-events:none;user-select:none;-webkit-user-select:none}
    .selectable-section{break-before:page;width:100%;overflow:hidden}.selectable-section:first-of-type{break-before:auto}.selectable-section-title{color:#222;padding:0 0 10px 0;font-weight:700;font-size:13.5pt}.selectable-section-summary{font:700 13pt/1.22 "Times New Roman",serif;margin:0 0 12px;width:100%;overflow:hidden}
    .selectable-question{break-inside:avoid;page-break-inside:avoid;border:1px solid #222;margin:0 0 8mm;width:100%;overflow:hidden}.selectable-question-main,.selectable-option{display:grid;grid-template-columns:56px minmax(0,1fr);break-inside:avoid;page-break-inside:avoid;width:100%}.selectable-question-label{padding:11px 10px;font-weight:400;border-right:1px solid #777;font-size:14pt}.selectable-question-body{padding:10px 12px;min-height:70px;min-width:0}.selectable-option{border-top:1px solid #777}.selectable-option-label{padding:10px 10px;font-weight:700;border-right:1px solid #777;font-size:12pt}.selectable-option-content{padding:8px 10px;min-height:38px;min-width:0}
    .selectable-question-body,.selectable-option-content{user-select:text;-webkit-user-select:text;cursor:text;white-space:normal;overflow:visible}.selectable-typed-frame{font-size:var(--selectable-text-size,20px);line-height:var(--selectable-line-height,1.4);font-family:"Cambria Math","STIX Two Math","STIXGeneral","Times New Roman","Georgia","Noto Serif","Segoe UI Symbol",serif;width:100%;max-width:100%;overflow:visible}.selectable-typed-frame .lp-text-line{display:block;min-height:calc(var(--selectable-text-size,20px) * var(--selectable-line-height,1.4));white-space:pre-wrap}.selectable-typed-frame .lp-blank-line{height:calc(var(--selectable-text-size,20px) * var(--selectable-line-height,1.4))}.selectable-typed-frame sup,.selectable-typed-frame sub{font-size:.62em;line-height:0;position:relative;vertical-align:baseline}.selectable-typed-frame sup{top:-.55em}.selectable-typed-frame sub{top:.22em}.selectable-frame-stack{display:flex;flex-direction:column;align-items:flex-start;gap:6px;width:100%;max-width:100%}.selectable-coordinate-frame{position:relative;display:block;gap:0}.selectable-frame-source{position:relative;z-index:1;width:100%}.selectable-coordinate-frame .selectable-figure-flow-layer{position:absolute;left:0;top:0;z-index:0}.selectable-coordinate-frame .selectable-frame-source{z-index:1}.selectable-figure-flow-layer{display:block;max-width:100%;overflow:visible}.selectable-figure-flow-stack{position:relative;display:block;overflow:visible}.selectable-coordinate-figure{position:absolute;display:block;max-width:none;object-fit:contain;pointer-events:none}.selectable-coordinate-circuit{position:absolute;display:block;overflow:hidden;pointer-events:none}.selectable-coordinate-circuit svg{display:block;width:100%;height:100%;overflow:visible}.selectable-fallback-image{max-width:100%;height:auto;display:block}.selectable-empty{font-style:italic;color:#666}.selectable-nat-answer{display:flex;gap:12px;align-items:center;border-top:1px solid #777;padding:9px 12px}.selectable-nat-answer span{display:inline-block;min-width:240px;border-bottom:1px solid #111;height:18px}
    .lp-matrix{display:inline-flex;align-items:stretch;vertical-align:middle;margin:0 .16em;line-height:1.22;font-size:var(--selectable-math-em,1em)}.lp-matrix-grid{display:flex;flex-direction:column;justify-content:center;padding:0 .18em}.lp-matrix-bracket{display:flex;align-items:center;font:2.15em/.76 "Cambria Math","STIX Two Math",serif;transform:scaleY(1.34);padding:0 .01em}.lp-matrix-row{display:flex;justify-content:center;gap:.55em}.lp-matrix-cell{min-width:1.1em;text-align:center;white-space:nowrap}.lp-delimited{display:inline-flex;align-items:center;vertical-align:middle;white-space:nowrap;margin:0 .04em;font-size:var(--selectable-math-em,1em)}.lp-delimiter{display:flex;align-items:center;align-self:stretch;font:1.36em/.86 "Cambria Math","STIX Two Math",serif;transform:scaleY(1.18);padding:0 .015em}.lp-delimited-body{display:inline-flex;align-items:center;padding:0 .08em}.lp-root{display:inline-flex;align-items:flex-start;vertical-align:-.08em;white-space:nowrap;margin:0 .04em;font-size:var(--selectable-math-em,1em)}.lp-root-symbol{font:1.18em/.9 "Cambria Math","STIX Two Math",serif;margin-right:-.02em;position:relative;top:.06em}.lp-root-index{font-size:.54em;line-height:1;position:relative;top:-.48em;margin-right:-.12em}.lp-root-body{display:inline-block;border-top:1.35px solid currentColor;margin-left:.01em;padding:.03em .08em 0;line-height:1.02}.lp-root .lp-frac{font-size:var(--selectable-nested-frac-em,.88em)}.lp-word-op{font-style:normal;white-space:nowrap}.lp-symbol{display:inline-block;vertical-align:middle;font-size:var(--selectable-math-em,1em)}.lp-accent{display:inline-block;position:relative;white-space:nowrap;font-size:var(--selectable-math-em,1em)}.lp-accent>sup{font-size:.56em;line-height:1;position:absolute;left:44%;top:-.62em}.lp-frac{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;vertical-align:-.34em;line-height:1;min-width:1.45em;margin:0 .08em;font-size:var(--selectable-math-em,1em)}.lp-frac-num,.lp-frac-den{display:block;padding:0 .18em;white-space:nowrap;text-align:center}.lp-frac-num{padding-bottom:.02em}.lp-frac-den{padding-top:.02em}.lp-frac-bar{display:block;width:100%;border-top:1.35px solid currentColor;margin:.04em 0}.lp-frac .lp-frac{font-size:var(--selectable-nested-frac-em,.86em);margin-left:.05em;margin-right:.05em}.lp-op{display:inline-block;position:relative;vertical-align:middle;white-space:nowrap;margin:0 .09em;font-size:var(--selectable-math-em,1em)}.lp-op .lp-main{font-size:1.22em}.lp-op sup,.lp-op sub{font-size:.57em;position:absolute;left:84%;white-space:nowrap}.lp-op sup{top:-.55em}.lp-op sub{bottom:-.5em}.lp-deriv{display:inline-flex;align-items:center;vertical-align:middle;font-size:var(--selectable-math-em,1em)}.lp-op-text{display:inline-block;white-space:nowrap;vertical-align:middle;font-size:var(--selectable-math-em,1em)}.lp-op-text sup{font-size:.58em;line-height:1;position:relative;top:-.55em;left:-.05em}.lp-op-text sub{font-size:.58em;line-height:1;position:relative;top:.55em;left:-.32em}.lp-katex-math{display:inline-block;vertical-align:middle;max-width:100%;line-height:1.14;margin:0 .04em}.lp-katex-math .katex{font-size:var(--selectable-math-em,1em);line-height:1.14;color:#071526}.lp-katex-math .katex-html{white-space:nowrap}.lp-katex-math .merror{color:#111;background:transparent}.lp-katex-math .base{vertical-align:baseline}.composer-inline-image{max-width:100%;height:auto;vertical-align:middle}.lp-canvas-figures{display:inline-flex;flex-wrap:wrap;align-items:center;vertical-align:middle;max-width:100%;gap:4px}.lp-canvas-figure{display:inline-block;max-width:100%;vertical-align:middle;object-fit:contain}.composer-free-bracket{display:inline-block;vertical-align:middle;font-size:2em;line-height:.82}
    .selectable-text-watermark{position:fixed;left:var(--wm-text-x,50%);top:var(--wm-text-y,52%);transform:rotate(var(--wm-text-angle,-36deg));transform-origin:0 0;z-index:4;font:var(--wm-text-style,normal) var(--wm-text-weight,700) var(--wm-text-size,58pt)/1 var(--wm-text-font,Arial),sans-serif;letter-spacing:0;color:var(--wm-text-color,#111);text-decoration:var(--wm-text-decoration,none);opacity:var(--wm-text-opacity,.10);white-space:pre;pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.selectable-image-watermark,.selectable-vector-watermark{position:fixed;left:var(--wm-x,50%);top:var(--wm-y,52%);transform:rotate(var(--wm-asset-angle,0deg));transform-origin:0 0;z-index:0;width:var(--wm-w,64vw);max-width:92vw;max-height:78vh;object-fit:contain;opacity:var(--wm-opacity,.10);pointer-events:none;user-select:none;-webkit-user-select:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.selectable-sheet-template-bg{position:fixed;left:${sheetBgLeft}mm;top:${sheetBgTop}mm;width:210mm;height:297mm;z-index:4;pointer-events:none;user-select:none;-webkit-user-select:none;background-image:var(--sheet-bg);background-repeat:no-repeat;background-position:0 0;background-size:210mm 297mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}.selectable-sheet-template-layer{position:fixed;z-index:4;display:block;pointer-events:none;user-select:none;-webkit-user-select:none;image-rendering:auto;-webkit-print-color-adjust:exact;print-color-adjust:exact}.selectable-white-label-layer{position:fixed;left:var(--wl-x,50%);top:var(--wl-y,50%);transform:rotate(var(--wl-a,0deg));transform-origin:0 0;opacity:var(--wl-o,1);z-index:var(--wl-z,0);pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact}.selectable-white-label-asset{display:block;width:var(--wl-w,40vw);max-width:220vw;max-height:140vh;object-fit:contain;user-select:none;-webkit-user-select:none}.selectable-white-label-text-asset{display:block;width:var(--wl-text-w,40mm);height:auto;max-width:220vw;user-select:none;-webkit-user-select:none}
    .selectable-clean-theme body{background:#fff;padding:0}
    .selectable-clean-theme .selectable-page{padding-top:0;border:0}
    .selectable-clean-theme .selectable-section:first-of-type{padding-top:0}
    .selectable-clean-theme .selectable-section{padding-top:0}
    .selectable-clean-theme .selectable-section-title{font-size:15pt;text-decoration:underline;padding:0 0 6px;color:#090909;margin-left:50px}
    .selectable-clean-theme .selectable-section-summary{font-size:13.5pt;margin:0 0 24px;border:0;padding:0;margin-left:50px}
    .selectable-clean-theme .selectable-question{border:0;margin:0 0 16mm;overflow:visible}
    .selectable-clean-theme .selectable-question-main,.selectable-clean-theme .selectable-option{grid-template-columns:48px minmax(0,1fr);border:0}
    .selectable-clean-theme .selectable-question-main,.selectable-clean-theme .selectable-question-body,.selectable-clean-theme .selectable-option,.selectable-clean-theme .selectable-option-content,.selectable-clean-theme .selectable-frame-stack,.selectable-clean-theme .selectable-coordinate-frame{border:0!important;background:transparent!important;box-shadow:none!important}
    .selectable-clean-theme .selectable-question-label{border:0;padding:0 10px 0 0;font-size:13.5pt;font-weight:400}
    .selectable-clean-theme .selectable-question-body{padding:0;min-height:0}
    .selectable-clean-theme .selectable-option{border:0;margin-top:30px}
    .selectable-clean-theme .selectable-option-label{border:0;padding:0 10px 0 0;font-size:13.5pt;font-weight:400}
    .selectable-clean-theme .selectable-option-content{padding:0;min-height:0}
    .selectable-clean-theme .selectable-typed-frame{font-size:18px;line-height:1.58}
    .selectable-clean-theme .selectable-typed-frame .lp-text-line{min-height:calc(var(--selectable-text-size,20px) * 1.55)}
    .selectable-clean-theme .selectable-typed-frame .lp-blank-line{height:calc(var(--selectable-text-size,20px) * 1.55)}
    .selectable-clean-theme .selectable-text-watermark{letter-spacing:0}
    .selectable-clean-theme .selectable-image-watermark,.selectable-clean-theme .selectable-vector-watermark{max-width:88vw;max-height:76vh}
    .selectable-sheet-layout .selectable-question{margin-bottom:0;overflow:hidden}.selectable-sheet-layout .selectable-question+.selectable-question{margin-top:6mm}
    @media print{.selectable-section{break-before:page}.selectable-section:first-of-type{break-before:auto}.selectable-question{break-inside:avoid;page-break-inside:avoid}.selectable-option{break-inside:avoid;page-break-inside:avoid}.selectable-sheet-layout .selectable-section{break-before:auto}.selectable-sheet-layout .selectable-sheet-page{break-after:page;page-break-after:always;overflow:hidden}.selectable-sheet-layout .selectable-sheet-page:last-child{break-after:auto;page-break-after:auto}.selectable-clean-theme .selectable-section{padding-top:0}.selectable-clean-theme .selectable-section:first-of-type{padding-top:0}.selectable-clean-theme .selectable-page{padding-top:0}.selectable-sheet-template-bg,.selectable-sheet-template-layer,.selectable-white-label-layer,.selectable-image-watermark,.selectable-vector-watermark,.selectable-text-watermark{position:fixed!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style></head><body>${header}${sheetBackground}${whiteLabel}${watermark}${watermarkVector}${watermarkPicture}<main class="selectable-page">${sections}</main>${footer}</body></html>`;
}

async function exportPaperSelectablePDF(settings={}, existingWindow=null){
  snapshotSelectablePdfEditorState();
  try{ if(typeof syncCurrentEditorCanvasAssetsForExportAsync==='function') await syncCurrentEditorCanvasAssetsForExportAsync(); else if(typeof syncCurrentEditorCanvasAssetsForExport==='function') syncCurrentEditorCanvasAssetsForExport(); }catch(_){ }
  try{ if(typeof syncPdfSourceFields==='function') syncPdfSourceFields(); }catch(_){ }
  if(!qs.length){showNotice('No questions available to export.', 'Selectable Text PDF');return;}
  const sheetLayers=Array.isArray(settings?.sheetTemplateLayers)
    ? settings.sheetTemplateLayers
    : (Array.isArray(settings?.whiteLabelLayers) ? settings.whiteLabelLayers : []);
  const sheetLayout=settings?.sheetTemplateLayout || null;
  if(sheetLayers.length && sheetLayout && !Array.isArray(settings?.sheetTemplateLayerImages)){
    try{
      settings={...settings, sheetTemplateLayerImages:await makeSelectableSheetTemplateLayerImages(sheetLayers, 2), sheetTemplateRaster:''};
    }catch(err){
      console.warn('Page layout layer preparation failed; falling back to full layout raster', err);
      try{
        settings={...settings, sheetTemplateRaster:await makeSelectableSheetTemplateRasterSrc(sheetLayers, 1.5)};
      }catch(fallbackErr){
        console.warn('Page layout rasterization failed; falling back to SVG background', fallbackErr);
        settings={...settings, sheetTemplateRaster:''};
      }
    }
  }
  const printWindow=existingWindow || window.open('', '_blank', 'width=1120,height=820');
  if(!printWindow){
    showNotice('The print window was blocked. Allow pop-ups for QS Studio, then try again.', 'Selectable Text PDF');
    return;
  }
  try{
    printWindow.opener=null;
    printWindow.document.open();
    printWindow.document.write(buildSelectablePaperDocument(settings));
    printWindow.document.close();
    try{ printWindow.document.title='\u200B'; }catch(_){}
    try{ printWindow.history.replaceState(null, '\u200B', window.location.href.split('#')[0] + '#print'); }catch(_){}
    printWindow.focus();
    const printWhenReady=async ()=>{
      try{ await printWindow.document.fonts?.ready; }catch(_){}
      try{
        const images=[...printWindow.document.images];
        await Promise.all(images.map(img=>{
          if(img.complete && img.naturalWidth) return img.decode ? img.decode().catch(()=>{}) : Promise.resolve();
          return new Promise(resolve=>{
            const done=()=>resolve();
            img.addEventListener('load', done, {once:true});
            img.addEventListener('error', done, {once:true});
            window.setTimeout(done, 1200);
          });
        }));
      }catch(_){}
      window.setTimeout(()=>printWindow.print(), 250);
    };
    printWhenReady();
    toast('Selectable text paper opened. Choose Save as PDF in the print dialog.');
  }catch(err){
    try{ printWindow.close(); }catch(_){}
    showNotice(err?.message || 'Selectable text paper could not be prepared.', 'Selectable Text PDF');
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  EXPORT: ANSWER KEY PDF
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
async function exportAnsKeyPDF(watermark={}){
  try{ if(typeof syncCurrentEditorCanvasAssetsForExportAsync==='function') await syncCurrentEditorCanvasAssetsForExportAsync(); else if(typeof syncCurrentEditorCanvasAssetsForExport==='function') syncCurrentEditorCanvasAssetsForExport(); }catch(_){ }
  if(!qs.length){showNotice('No questions available to export.', 'Answer Key PDF');return;}
  const jsPDF=getPDF(); if(!jsPDF) return;
  const doc=new jsPDF({unit:'pt',format:'a4',compress:true});
  const identity=getCurrentExportIdentity();
  const branding=getPdfExportBranding(watermark);
  const publishing=getPdfExportPublishing(watermark);
  const sectionOrder=[];
  const grouped=new Map();
  qs.forEach((q,idx)=>{
    const sm=getSubjectMeta(q.subject);
    const key=getPdfSectionKeyForExport(sm);
    if(!grouped.has(key)){
      grouped.set(key,{meta:sm, regular:[], nat:[], entries:[]});
      sectionOrder.push(key);
    }
    const entry={q, originalIndex:idx};
    const bucket=grouped.get(key);
    bucket.entries.push(entry);
    if(q.type==='NAT') bucket.nat.push(entry);
    else bucket.regular.push(entry);
  });
  const orderedSectionKeys=getPdfOrderedSectionKeys(sectionOrder, grouped, publishing);
  const totalMarks=orderedSectionKeys.reduce((sum,key)=>{
    const group=grouped.get(key);
    return sum + (group?.entries || []).reduce((s,entry)=>s+(+entry.q.marks||0),0);
  },0);
  const W=595,H=842,M=34; let y=M;
  const firstMeta = grouped.get(orderedSectionKeys[0])?.meta || getSubjectMeta(qs[0]?.subject || subjects[0]?.short || 'EC');
  y = drawPdfBrandingHeader(doc, W, M, y, firstMeta, totalMarks, branding, 'key');

  const cols=[
    {label:'Q No.', x:M, w:44},
    {label:'Section', x:M+44, w:120},
    {label:'Max Marks', x:M+164, w:62},
    {label:'Neg. Marks', x:M+226, w:68},
    {label:'Type', x:M+294, w:52},
    {label:'Correct Answer', x:M+346, w:181}
  ];
  const tableW=cols.reduce((s,c)=>s+c.w,0);
  const rowH=24;
  function correctAnswerText(q){
    if(q.type==='NAT') return q.natAnswer ? String(q.natAnswer) : '(not set)';
    const corr=(q.options||[]).map((o,j)=>o.correct?String.fromCharCode(65+j):null).filter(Boolean);
    return corr.length ? corr.join(', ') : '(none set)';
  }
  function drawAnswerHeader(){
    doc.setFillColor(231,239,252);
    doc.setDrawColor(70);
    doc.setLineWidth(.7);
    doc.rect(M,y,tableW,rowH,'FD');
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0);
    cols.forEach(c=>{
      doc.text(c.label,c.x+4,y+15,{maxWidth:c.w-8});
      doc.line(c.x,y,c.x,y+rowH);
    });
    doc.line(M+tableW,y,M+tableW,y+rowH);
    y+=rowH;
  }

  function drawKeySectionIntro(group, orderedItems){
    const meta=group.meta;
    const title=`${normalizePdfExportText(meta.full)} (${normalizePdfExportText(meta.short)})`;
    const subtitle=`Section: ${normalizePdfExportText(getSectionDisplay(meta))} | ${getPdfMarkRangeSummary(orderedItems)}`;
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.2);
    const lines=doc.splitTextToSize(subtitle, tableW-12);
    const titleH=22;
    const summaryH=Math.max(20, lines.length*9.5+8);
    if(y + titleH + summaryH + rowH > H-M){
      doc.addPage();
      y=M;
      y = drawPdfBrandingHeader(doc, W, M, y, meta, totalMarks, branding, 'key');
    }
    doc.setDrawColor(0);
    doc.setFillColor(0);
    doc.rect(M,y,tableW,titleH,'FD');
    doc.setTextColor(255);
    doc.setFont('helvetica','bold');
    doc.setFontSize(10);
    doc.text(title, M+tableW/2, y+14, {align:'center'});
    y += titleH;
    doc.setFillColor(244);
    doc.setDrawColor(0);
    doc.rect(M,y,tableW,summaryH,'FD');
    doc.setTextColor(0);
    doc.setFont('helvetica','bold');
    doc.setFontSize(8.2);
    lines.forEach((line,idx)=>doc.text(line,M+6,y+12+(idx*9.5)));
    y += summaryH;
  }

  for(const [sectionIdx, sectionKey] of orderedSectionKeys.entries()){
    const group=grouped.get(sectionKey);
    const orderedItems=getPdfOrderedEntries(group, publishing);
    if(sectionIdx>0){
      doc.addPage();
      y=M;
      y = drawPdfBrandingHeader(doc, W, M, y, group.meta, totalMarks, branding, 'key');
    }
    drawKeySectionIntro(group, orderedItems);
    drawAnswerHeader();
    for(const [idx, entry] of orderedItems.entries()){
      const q=entry.q;
      const sm=getSubjectMeta(q.subject);
    if(y>H-M-rowH){
      doc.addPage();
      y=M;
      y = drawPdfBrandingHeader(doc, W, M, y, group.meta, totalMarks, branding, 'key');
      drawAnswerHeader();
    }
    const row=[
      `Q.${idx+1}`,
      sm.short || sm.section || '-',
      `+${q.marks}M`,
      `${q.negMarks}M`,
      q.type,
      correctAnswerText(q)
    ];
    doc.setDrawColor(130);
    doc.setLineWidth(.4);
    doc.rect(M,y,tableW,rowH);
    cols.forEach((c,idx)=>{
      if(idx>0) doc.line(c.x,y,c.x,y+rowH);
      doc.setFont('helvetica', idx===5 ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      if(idx===2) doc.setTextColor(20,130,65);
      else if(idx===3) doc.setTextColor(190,35,35);
      else doc.setTextColor(0);
      doc.text(String(row[idx]), c.x+4, y+15, {maxWidth:c.w-8});
    });
    doc.setTextColor(0);
    y+=rowH;
    }
  }
  applyPdfWatermarkToAllPages(doc, W, H, watermark);
  if(typeof applyPdfPageNumbersToAllPages==='function') applyPdfPageNumbersToAllPages(doc, W, H);
  doc.save(identity.names.keyPDF);
  toast('Answer key PDF exported');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•


const _exportPaperPDFTextOnlyGuarded = exportPaperPDFTextOnly;
exportPaperPDFTextOnly = async function(watermark={}){
  try{
    return await _exportPaperPDFTextOnlyGuarded(watermark);
  }catch(err){
    console.error(err);
    if(document.getElementById('exportProgressBox')) throw err;
    showNotice(err?.message || 'Paper PDF export failed before download.', 'Paper PDF');
  }
};


