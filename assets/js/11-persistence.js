// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PERSISTENCE  â€” File-based save/load  (no localStorage size limits)
//
//  Strategy:
//    â€¢ localStorage  â†’  only lightweight metadata (project index, theme)
//                       NO base64 images stored in localStorage
//    â€¢ Save          â†’  writes a user-approved .qbank.json file handle
//    â€¢ Open          â†’  reads any .qbank.json file back into memory
//    â€¢ Auto-save     â†’  every 60 s, silently re-saves to the same file
//                       handle (if the user granted one this session)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// In-session file handle (File System Access API)
let _fileHandle = null;
let _fileHandleWritable = false;
let _autoSaveTimer = null;
let _autoSaveDebounceTimer = null;
let _saveInProgress = null;
let _saveGeneration = 0;
let _autoSaveSuppression = 0;
const FILE_EXT = '.qbank.json';
const FILE_MIME = 'application/json';

function _cancelScheduledSaves(dropHandle=false){
  _saveGeneration++;
  if(_autoSaveDebounceTimer){ clearTimeout(_autoSaveDebounceTimer); _autoSaveDebounceTimer=null; }
  if(_autoSaveTimer){ clearInterval(_autoSaveTimer); _autoSaveTimer=null; }
  if(dropHandle){
    _fileHandle=null;
    _fileHandleWritable=false;
  }
}

function _beginProjectHydration(dropHandle=true){
  _autoSaveSuppression++;
  _cancelScheduledSaves(dropHandle);
}

function _endProjectHydration(){
  _autoSaveSuppression=Math.max(0,_autoSaveSuppression-1);
  if(!_autoSaveSuppression && _fileHandle && _fileHandleWritable) _scheduleAutoSave();
}

// â”€â”€ helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _defaultProjectName(){
  const d=new Date();
  const pad=n=>String(n).padStart(2,'0');
  return 'QS Project '+d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+' '+pad(d.getHours())+'-'+pad(d.getMinutes());
}
function _bankFileName(){
  if(!String(examName||'').trim()) examName=_defaultProjectName();
  if(typeof getExportIdentity==='function') return getExportIdentity().names.qbank;
  const safe = (examName || 'qs-project').replace(/[^a-zA-Z0-9 _\-]/g, '').trim().replace(/\s+/g, '_').slice(0, 60);
  return (safe || 'qs-project') + FILE_EXT;
}

function _isUsableBankRaster(value){
  if(typeof isUsableRasterDataUrl==='function') return isUsableRasterDataUrl(value);
  const match=String(value||'').trim().match(/^data:image\/(?:png|jpe?g|webp);base64,([a-z0-9+/]+={0,2})$/i);
  return !!(match && match[1].length>=32);
}

async function _buildBankPayload(){
  let assetSyncStatus='complete';
  let assetSyncError='';
  try{
    if(typeof syncCurrentEditorCanvasAssetsForExportAsync==='function') await syncCurrentEditorCanvasAssetsForExportAsync();
    else if(typeof syncCurrentEditorCanvasAssetsForExport==='function') syncCurrentEditorCanvasAssetsForExport();
  }catch(err){
    assetSyncStatus='stored-fallback';
    assetSyncError=String(err?.message||'Canvas asset synchronization failed').slice(0,240);
    console.warn('Project save is using stored lossless canvas assets:',err);
  }
  const frameRecords=(Array.isArray(qs) ? qs : []).flatMap(q=>[
    {image:String(q?.questionImage||''),html:String(q?.questionComposerHTML||'')},
    ...(Array.isArray(q?.options) ? q.options.map(option=>({image:String(option?.image||''),html:String(option?.composerHTML||'')})) : [])
  ]);
  const rasterComplete=frameRecords.length>0 && frameRecords.every(frame=>_isUsableBankRaster(frame.image));
  const rasterLossless=rasterComplete && frameRecords.every(frame=>/^data:image\/png;base64,/i.test(frame.image));
  const composerSourceRecords=frameRecords.filter(frame=>frame.html.trim()).length;
  const figureRecords=(Array.isArray(qs) ? qs : []).flatMap(q=>[
    ...(Array.isArray(q?.questionFigures) ? q.questionFigures : []),
    ...(Array.isArray(q?.questionBurnedFigures) ? q.questionBurnedFigures : []),
    ...(Array.isArray(q?.options) ? q.options.flatMap(option=>[
      ...(Array.isArray(option?.figures) ? option.figures : []),
      ...(Array.isArray(option?.burnedFigures) ? option.burnedFigures : [])
    ]) : [])
  ]);
  const editableVectorRecords=figureRecords.filter(fig=>String(fig?.sourceSvg||'').trim() || /^data:image\/svg\+xml/i.test(String(fig?.src||'')) || fig?.circuitScene).length;
  const identity=typeof getExportIdentity==='function' ? getExportIdentity() : null;
  return JSON.stringify({
    _version: 4,
    _app: 'QSStudio',
    _savedAt: new Date().toISOString(),
    _quality: {
      schema:'hallmark-source-v1',
      raster_complete:rasterComplete,
      raster_lossless:rasterLossless,
      composer_source_records:composerSourceRecords,
      editable_vector_records:editableVectorRecords,
      asset_sync_status:assetSyncStatus,
      asset_sync_error:assetSyncError
    },
    bankUid: identity?.bankId || bankUid || '',
    bank_id: identity?.bankId || bankUid || '',
    project_name: identity?.projectName || examName || '',
    examName: examName || '',
    pdfBranding: typeof normalizePdfBranding==='function' ? normalizePdfBranding(pdfBranding) : (pdfBranding || {}),
    pdfPublishing: typeof normalizePdfPublishing==='function' ? normalizePdfPublishing(pdfPublishing) : (pdfPublishing || {}),
    subjects,
    topics: typeof normalizeTopicList==='function' ? normalizeTopicList(topics, qs) : (topics || []),
    qs
  }, null, 2);
}

function _applyBankPayload(raw){
  const data = JSON.parse(raw);
  if(!data || !Array.isArray(data.qs))
    throw new Error('Invalid .qbank.json file â€” missing questions array.');
  examName = String(data.examName || '').trim() || String(data.project_name || '').trim();
  bankUid = String(data.bankUid || data.bank_id || data.export_set_id || '').trim()
    || (typeof deriveLegacyBankUid==='function' ? deriveLegacyBankUid(data) : createBankUid());
  pdfBranding = typeof normalizePdfBranding==='function' ? normalizePdfBranding(data.pdfBranding) : (data.pdfBranding || {});
  pdfPublishing = typeof normalizePdfPublishing==='function' ? normalizePdfPublishing(data.pdfPublishing) : (data.pdfPublishing || {});
  subjects = (Array.isArray(data.subjects) && data.subjects.length)
    ? JSON.parse(JSON.stringify(data.subjects))
    : JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
  qs = data.qs.map(normalizeQuestion);
  topics = typeof normalizeTopicList==='function' ? normalizeTopicList(data.topics, qs) : (Array.isArray(data.topics) ? data.topics : []);
  qs.forEach(q => {
    if(Array.isArray(q.options)){
      q.options.forEach((opt,i) => { opt.oid = opt.oid || genOid(q.qid, i+1); });
      q.correctOptionIds = q.options.filter(o => o.correct).map(o => o.oid);
    }
  });
  cur = qs[0] || null;
  selectedQIds.clear();
}

// â”€â”€ lightweight localStorage metadata (NO images) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _clearLegacyLocalDraft(){
  try{ localStorage.removeItem(LEGACY_QS_KEY); }catch(_){ }
  try{ localStorage.removeItem(LEGACY_SUBJECTS_KEY); }catch(_){ }
  try{ if(activeProjectId) localStorage.removeItem(getProjectStorageKey(activeProjectId)); }catch(_){ }
}

function _saveMetaToLS(lastFileName = ''){
  _clearLegacyLocalDraft();
  try {
    const meta = {
      examName: examName || '',
      bankUid: bankUid || '',
      questionCount: qs.length,
      subjects: subjects,
      topics: typeof normalizeTopicList==='function' ? normalizeTopicList(topics, qs) : (topics || []),
      lastFileName: lastFileName || _fileHandle?.name || '',
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem('qgen_meta_v1', JSON.stringify(meta));
  } catch(_){ }
}


// â”€â”€ Save to file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * saveToFile(silent)
 *   silent=false  â†’  show picker if no handle, then save; show toast
 *   silent=true   â†’  only save if we already have a handle; no toast on skip
 */
async function _saveToFileOnce(silent = false, operationGeneration = _saveGeneration){
  if(!String(examName||'').trim()) examName=_defaultProjectName();
  const payload = await _buildBankPayload();
  if(operationGeneration!==_saveGeneration) return false;

  // â”€â”€ Try File System Access API first â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(window.showSaveFilePicker){
    try {
      if(!_fileHandle){
        _fileHandle = await window.showSaveFilePicker({
          suggestedName: _bankFileName(),
          types: [{ description: 'QS Studio Project', accept: { [FILE_MIME]: [FILE_EXT] } }]
        });
        _fileHandleWritable = false;
      }
      const targetHandle=_fileHandle;
      if(operationGeneration!==_saveGeneration || !targetHandle) return false;
      const writable = await targetHandle.createWritable();
      await writable.write(payload);
      if(operationGeneration!==_saveGeneration || targetHandle!==_fileHandle){
        try{ await writable.abort?.(); }catch(_){ }
        return false;
      }
      await writable.close();
      _fileHandleWritable = true;
      _saveMetaToLS();
      _scheduleAutoSave();
      if(!silent) toast('Saved project -> ' + targetHandle.name);
      return true;
    } catch(err){
      _fileHandle = null;
      _fileHandleWritable = false;
      _cancelScheduledSaves(false);
      if(!['AbortError','NotAllowedError','SecurityError'].includes(String(err?.name||''))){
        console.error('Project file save failed:',err);
      }
      if(err?.name!=='AbortError' && !silent){
        showNotice('The project file could not be written. Nothing was downloaded. Choose Save All again if you want to grant a different file location.', 'Save Failed');
      }
      return false;
    }
  }

  // No implicit download fallback: only controls labelled as exports download.
  if(!silent){
    showNotice('Direct project-file saving is unavailable in this browser. Nothing was downloaded. Use a clearly labelled export control only when you want a download.', 'Save Not Available');
  }
  return false;
}

async function saveToFile(silent = false){
  // Background work may only reuse a handle that already completed an
  // explicit writable save. It never opens a picker or triggers a download.
  if(silent && (_autoSaveSuppression || !_fileHandle || !_fileHandleWritable)) return false;
  if(_saveInProgress) return _saveInProgress;
  const generation=_saveGeneration;
  const job=_saveToFileOnce(silent,generation);
  _saveInProgress=job;
  try{
    return await job;
  }finally{
    if(_saveInProgress===job) _saveInProgress=null;
  }
}

// â”€â”€ Open from file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function _loadSelectedBank(fileOrPromise, handle=null){
  const token=typeof beginPaperPreparation==='function'
    ? beginPaperPreparation({
        reason:'open-bank',
        title:'Opening question paper',
        detail:'Reading the bank and preparing all paper resources...'
      })
    : null;
  _beginProjectHydration(true);
  try{
    const file=await Promise.resolve(fileOrPromise);
    const raw=await file.text();
    _applyBankPayload(raw);
    _fileHandle=handle;
    _fileHandleWritable=false;
    _saveMetaToLS(file.name);
    await _afterLoad('Opened: '+file.name,token);
    return true;
  }catch(err){
    if(token && typeof finishPaperPreparation==='function'){
      await finishPaperPreparation(token,{failed:1,timedOut:false,reason:'open-error'});
    }
    showNotice('Could not open file: '+(err?.message||'Unknown file error'), 'Open Bank');
    return false;
  }finally{
    _endProjectHydration();
  }
}

async function openFromFile(){
  if(window.showOpenFilePicker){
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'QS Studio Project', accept: { [FILE_MIME]: [FILE_EXT, '.json'] } }],
        multiple: false
      });
      return await _loadSelectedBank(handle.getFile(),handle);
    } catch(err){
      if(err.name === 'AbortError') return;
      // Fall through to <input> picker
    }
  }

  // â”€â”€ Fallback: <input type=file> â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = FILE_EXT + ',.json';
  inp.onchange = async () => {
    const file = inp.files[0];
    if(!file) return;
    await _loadSelectedBank(file,null);
  };
  inp.click();
}

async function _afterLoad(msg, preparationToken=null){
  closeModal();
  renderSidebar();
  renderEditor();
  renderPaper(true);
  if(typeof preparePaperWorkspace==='function'){
    await preparePaperWorkspace({
      token:preparationToken,
      reason:'open-bank',
      title:'Opening question paper',
      detail:'Restoring canvas ink and preloading every paper preview...',
      minVisibleMs:700
    });
  }
  toast(msg);
}

function _queueAutoSave(delay = 6000){
  if(_autoSaveSuppression || _saveInProgress || !_fileHandle || !_fileHandleWritable) return;
  if(_autoSaveDebounceTimer) clearTimeout(_autoSaveDebounceTimer);
  _autoSaveDebounceTimer = setTimeout(() => {
    _autoSaveDebounceTimer = null;
    if(!_autoSaveSuppression && !_saveInProgress && _fileHandle && _fileHandleWritable && String(examName||'').trim()) saveToFile(true);
  }, delay);
}
// â”€â”€ Auto-save (every 90 seconds if we have a file handle) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _scheduleAutoSave(){
  if(_autoSaveTimer) clearInterval(_autoSaveTimer);
  _autoSaveTimer=null;
  if(_autoSaveSuppression || !_fileHandle || !_fileHandleWritable) return;
  _autoSaveTimer = setInterval(() => {
    if(!_autoSaveSuppression && !_saveInProgress && _fileHandle && _fileHandleWritable && String(examName||'').trim()) saveToFile(true);
  }, 180_000);
}

// â”€â”€ Intercept old saveLS() to also flush lightweight meta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//    (We keep saveLS for in-memory sync; it no longer stores images)

const _origSaveLS = saveLS;
window.saveLS = function(){
  _clearLegacyLocalDraft();
  _saveMetaToLS();
  if(!_autoSaveSuppression && !_saveInProgress && _fileHandle && _fileHandleWritable) _queueAutoSave();
};
try{ saveLS = window.saveLS; }catch(_){ }

// â”€â”€ Override saveAll() to use file-based save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

window.saveAll = async function(){
  if(!String(examName||'').trim()) examName = _defaultProjectName();
  return await saveToFile(false);
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  Project Launcher â€” now includes "Open File" button
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

window.showProjectLauncher = function(){
  syncProjectIndex();
  const suggested=_defaultProjectName();
  openModal({
    title: 'Open Or Create Project',
    subtitle: 'Open an existing .qbank.json file or start a new project. If you leave the name blank, a default project name is used automatically.',
    closable: false,
    body: `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn grn" type="button" style="flex:1;justify-content:center;font-size:12px" onclick="openFromFile()">&#128194; Open Existing Project (.qbank.json)</button>
      </div>
      <div class="divider" style="margin:8px 0"></div>
      <div class="sec-lbl" style="margin-bottom:6px">Create New Project</div>
      <div class="modal-grid">
        <div class="field" style="grid-column:1/-1">
          <label>Project Name</label>
          <input id="projectExamNameInput" type="text" value="${suggested}"
            placeholder="${suggested}"
            onkeydown="if(event.key==='Enter') createProjectFromLauncher()">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn pri" type="button" onclick="createProjectFromLauncher()">Create New Project</button>
      </div>
    `
  });
  const input = document.getElementById('projectExamNameInput');
  if(input){ input.focus(); input.select(); }
}
function _recentBanksHTML(){
  return '';
}


window.resumeInMemorySession = function(){
  openFromFile();
};

// â”€â”€ createProjectFromLauncher uses new flow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

window.createProjectFromLauncher = async function(){
  const name = String(document.getElementById('projectExamNameInput')?.value || '').trim();
  const token=typeof beginPaperPreparation==='function'
    ? beginPaperPreparation({reason:'new-project',title:'Preparing a new question paper',detail:'Starting a clean paper workspace...'})
    : null;
  _beginProjectHydration(true);
  try{
    examName = name || _defaultProjectName();
    subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
    topics = JSON.parse(JSON.stringify(DEFAULT_TOPICS));
    qs = [];
    cur = null;
    selectedQIds.clear();
    _saveMetaToLS();
    closeModal();
    renderSidebar();
    renderEditor();
    renderPaper(true);
    if(typeof preparePaperWorkspace==='function'){
      await preparePaperWorkspace({token,reason:'new-project',title:'Preparing a new question paper',minVisibleMs:520});
    }
  }finally{
    _endProjectHydration();
  }
};

// â”€â”€ startFreshProject override â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

window.startFreshProject = function(){
  askConfirm('Discard the current bank and start a completely fresh one?', async () => {
    const token=typeof beginPaperPreparation==='function'
      ? beginPaperPreparation({reason:'fresh-project',title:'Preparing a fresh question paper',detail:'Clearing the old bank and warming the new workspace...'})
      : null;
    _beginProjectHydration(true);
    try{
      examName = _defaultProjectName();
      qs = [];
      cur = null;
      selectedQIds.clear();
      subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
      topics = JSON.parse(JSON.stringify(DEFAULT_TOPICS));
      try { localStorage.removeItem(LEGACY_QS_KEY); } catch(_){ }
      try { localStorage.removeItem(LEGACY_SUBJECTS_KEY); } catch(_){ }
      _saveMetaToLS();
      closeModal();
      renderSidebar();
      renderEditor();
      renderPaper(true);
      if(typeof preparePaperWorkspace==='function'){
        await preparePaperWorkspace({token,reason:'fresh-project',title:'Preparing a fresh question paper',minVisibleMs:520});
      }
    }finally{
      _endProjectHydration();
    }
  });
};

// â”€â”€ bootstrapProjectState override â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

window.bootstrapProjectState = async function(options={}){
  const token=options.preparationToken || (typeof beginPaperPreparation==='function'
    ? beginPaperPreparation({reason:'startup',title:'Preparing QS Studio'})
    : null);
  _beginProjectHydration(true);
  try{
    try { localStorage.removeItem(LEGACY_QS_KEY); } catch(_){ }
    try { localStorage.removeItem(LEGACY_SUBJECTS_KEY); } catch(_){ }
    let meta = null;
    try { meta = JSON.parse(localStorage.getItem('qgen_meta_v1') || 'null'); } catch(_){ meta = null; }
    examName = String(meta?.examName || '').trim() || _defaultProjectName();
    qs = [];
    cur = null;
    subjects = (Array.isArray(meta?.subjects) && meta.subjects.length)
      ? JSON.parse(JSON.stringify(meta.subjects))
      : JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
    topics = typeof normalizeTopicList==='function' ? normalizeTopicList(meta?.topics, qs) : (Array.isArray(meta?.topics) ? JSON.parse(JSON.stringify(meta.topics)) : []);
    selectedQIds.clear();
    closeModal();
    renderSidebar();
    renderEditor();
    renderPaper(true);
    if(typeof preparePaperWorkspace==='function'){
      await preparePaperWorkspace({token,reason:'startup',title:'Preparing QS Studio',minVisibleMs:650});
    }
  }finally{
    _endProjectHydration();
  }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  Expose save/open globally for HTML buttons
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
window.saveToFile = saveToFile;
window.openFromFile = openFromFile;
