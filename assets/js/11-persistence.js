// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  PERSISTENCE  â€” File-based save/load  (no localStorage size limits)
//
//  Strategy:
//    â€¢ localStorage  â†’  only lightweight metadata (project index, theme)
//                       NO base64 images stored in localStorage
//    â€¢ Save          â†’  downloads a .qbank.json file (full state + images)
//    â€¢ Open          â†’  reads any .qbank.json file back into memory
//    â€¢ Auto-save     â†’  every 60 s, silently re-saves to the same file
//                       handle (if the user granted one this session)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// In-session file handle (File System Access API)
let _fileHandle = null;
let _autoSaveTimer = null;
let _autoSaveDebounceTimer = null;
const FILE_EXT = '.qbank.json';
const FILE_MIME = 'application/json';

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

async function _buildBankPayload(){
  try{
    if(typeof syncCurrentEditorCanvasAssetsForExportAsync==='function') await syncCurrentEditorCanvasAssetsForExportAsync();
    else if(typeof syncCurrentEditorCanvasAssetsForExport==='function') syncCurrentEditorCanvasAssetsForExport();
  }catch(_){ }
  const identity=typeof getExportIdentity==='function' ? getExportIdentity() : null;
  return JSON.stringify({
    _version: 3,
    _app: 'QSStudio',
    _savedAt: new Date().toISOString(),
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
  examName = String(data.examName || '').trim();
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
async function saveToFile(silent = false){
  if(!String(examName||'').trim()) examName=_defaultProjectName();
  const payload = await _buildBankPayload();

  // â”€â”€ Try File System Access API first â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if(window.showSaveFilePicker){
    try {
      if(!_fileHandle || !silent){
        _fileHandle = await window.showSaveFilePicker({
          suggestedName: _bankFileName(),
          types: [{ description: 'QS Studio Project', accept: { [FILE_MIME]: [FILE_EXT] } }]
        });
      }
      const writable = await _fileHandle.createWritable();
      await writable.write(payload);
      await writable.close();
      _saveMetaToLS();
      _scheduleAutoSave();
      if(!silent) toast('Saved project -> ' + _fileHandle.name);
      return;
    } catch(err){
      if(err.name === 'AbortError') return;   // user cancelled picker
      // Fall through to download fallback
      _fileHandle = null;
    }
  }

  // â”€â”€ Fallback: download as blob â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  dlBlob(payload, _bankFileName(), FILE_MIME);
  _saveMetaToLS();
  if(!silent) toast('Project downloaded - re-open this file to continue later');
}

// â”€â”€ Open from file â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function openFromFile(){
  if(window.showOpenFilePicker){
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'QS Studio Project', accept: { [FILE_MIME]: [FILE_EXT, '.json'] } }],
        multiple: false
      });
      const file = await handle.getFile();
      const raw  = await file.text();
      _applyBankPayload(raw);
      _fileHandle = handle;
      _saveMetaToLS(file.name);
      _scheduleAutoSave();
      _afterLoad('Opened: ' + file.name);
      return;
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
    try {
      const raw = await file.text();
      _applyBankPayload(raw);
      _fileHandle = null;
      _saveMetaToLS(file.name);
      _afterLoad('Opened: ' + file.name);
    } catch(e){
      showNotice('Could not open file: ' + e.message, 'Open Bank');
    }
  };
  inp.click();
}

function _afterLoad(msg){
  closeModal();
  renderSidebar();
  renderEditor();
  renderPaper();
  toast(msg);
}

function _queueAutoSave(delay = 6000){
  if(_autoSaveDebounceTimer) clearTimeout(_autoSaveDebounceTimer);
  _autoSaveDebounceTimer = setTimeout(() => {
    _autoSaveDebounceTimer = null;
    if(_fileHandle && String(examName||'').trim()) saveToFile(true);
  }, delay);
}
// â”€â”€ Auto-save (every 90 seconds if we have a file handle) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _scheduleAutoSave(){
  if(_autoSaveTimer) clearInterval(_autoSaveTimer);
  _autoSaveTimer = setInterval(() => {
    if(_fileHandle && String(examName||'').trim()) saveToFile(true);
  }, 180_000);
}

// â”€â”€ Intercept old saveLS() to also flush lightweight meta â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//    (We keep saveLS for in-memory sync; it no longer stores images)

const _origSaveLS = saveLS;
window.saveLS = function(){
  _clearLegacyLocalDraft();
  _saveMetaToLS();
  if(_fileHandle) _queueAutoSave();
};
try{ saveLS = window.saveLS; }catch(_){ }

// â”€â”€ Override saveAll() to use file-based save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

window.saveAll = async function(){
  if(!String(examName||'').trim()) examName = _defaultProjectName();
  await saveToFile(false);
  renderSidebar();
  renderEditor();
  renderPaper();
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

window.createProjectFromLauncher = function(){
  const name = String(document.getElementById('projectExamNameInput')?.value || '').trim();
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
  renderPaper();
  _scheduleAutoSave();
};

// â”€â”€ startFreshProject override â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

window.startFreshProject = function(){
  askConfirm('Discard the current bank and start a completely fresh one?', () => {
    _fileHandle = null;
    if(_autoSaveTimer){ clearInterval(_autoSaveTimer); _autoSaveTimer = null; }
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
    renderPaper();
  });
};

// â”€â”€ bootstrapProjectState override â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

window.bootstrapProjectState = function(){
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
  renderPaper();
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  Expose save/open globally for HTML buttons
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
window.saveToFile = saveToFile;
window.openFromFile = openFromFile;
