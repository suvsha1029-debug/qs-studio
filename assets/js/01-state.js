//  STATE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const PROJECT_INDEX_KEY = 'gate_project_index_v1';
const ACTIVE_PROJECT_KEY = 'gate_active_project_v1';
const APP_THEME_KEY = 'qgen_theme_v1';
const LEGACY_QS_KEY = 'gateqs_v3';
const LEGACY_SUBJECTS_KEY = 'gate_subjects_v1';

let qs = [];
let cur = null;
let frame = 'exam';
let activeOptIdx = -1;   // which option canvas is active
let activeTextTarget = null;
let activeComposerKey = null;
let mixedComposerRange = null;
let mixedComposerDraftHTML = '';
let mixedComposerUndoStack = [];
let mixedComposerRestoring = false;
let activeFractionInput = null;
let mixedComposerTokens = [];
let mixedComposerCursor = 0;
let mixedComposerHist = [[]];
let mixedComposerHistIdx = 0;
let mixedComposerTab = 'Fractions';
let selectedQIds = new Set();
const selectedFigureByKey = {};
const cropModeByKey = {};
let examName = '';
let activeProjectId = sessionStorage.getItem(ACTIVE_PROJECT_KEY) || localStorage.getItem(ACTIVE_PROJECT_KEY) || '';
let bankUid = '';
let projectIndex = JSON.parse(localStorage.getItem(PROJECT_INDEX_KEY) || '[]');
const DEFAULT_SUBJECTS = [
  { short:'EC', full:'Electronics & Communication', section:'EC' }
];
let subjects = JSON.parse(localStorage.getItem(LEGACY_SUBJECTS_KEY) || 'null') || DEFAULT_SUBJECTS;
const DEFAULT_TOPICS = [];
let topics = [];
const DIFFICULTY_LEVELS = ['Easy','Medium','Tough'];

const DEFAULT_PDF_BRANDING = {
  instituteName:'',
  logoDataUrl:'',
  examDisplayName:'',
  subtitle:''
};

const DEFAULT_PDF_PUBLISHING = {
  markOrder:'source',
  sections:[]
};

function normalizePdfBranding(value){
  const src=value && typeof value==='object' ? value : {};
  return {
    instituteName:String(src.instituteName || '').trim(),
    logoDataUrl:String(src.logoDataUrl || '').trim(),
    examDisplayName:String(src.examDisplayName || '').trim(),
    subtitle:String(src.subtitle || '').trim()
  };
}

let pdfBranding = normalizePdfBranding(DEFAULT_PDF_BRANDING);

function normalizePdfPublishing(value){
  const src=value && typeof value==='object' ? value : {};
  const allowedMarks = new Set(['source','asc','desc']);
  const markOrder = allowedMarks.has(String(src.markOrder || 'source')) ? String(src.markOrder || 'source') : 'source';
  const seen = new Set();
  const sections = (Array.isArray(src.sections) ? src.sections : []).map((item, idx)=>{
    const key=String(item?.key || '').trim();
    if(!key || seen.has(key)) return null;
    seen.add(key);
    return {
      key,
      enabled:item?.enabled !== false,
      priority:Math.max(1, Math.round(+item?.priority || idx+1))
    };
  }).filter(Boolean);
  return { markOrder, sections };
}

let pdfPublishing = normalizePdfPublishing(DEFAULT_PDF_PUBLISHING);

function createBankUid(){
  const time=Date.now().toString(36).toUpperCase();
  const rand=Math.random().toString(36).slice(2,7).toUpperCase();
  return `BK${time}${rand}`;
}

function hashLegacyBankText(input, seed=2166136261){
  let h=seed >>> 0;
  const text=String(input || '');
  for(let i=0;i<text.length;i++){
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function deriveLegacyBankUid(payload){
  try{
    const data=payload && typeof payload==='object' ? payload : {};
    const list=Array.isArray(data.qs) ? data.qs : [];
    const signature=[
      String(data.examName || data.project_name || '').trim(),
      list.length,
      list.map((q, index)=>[
        String(q?.qid || '').trim(),
        String(q?.subject || '').trim(),
        String(q?.type || '').trim(),
        String(q?.marks || '').trim(),
        String(q?.label || '').trim(),
        index + 1
      ].join('|')).join('||')
    ].join('###');
    const left=hashLegacyBankText(`${signature}|left`).toString(36).toUpperCase().slice(0, 6).padStart(6, '0');
    const right=hashLegacyBankText(`${signature}|right`).toString(36).toUpperCase().slice(0, 5).padStart(5, '0');
    return `BK${left}${right}`;
  }catch(_){
    return createBankUid();
  }
}

function normalizeDifficulty(value){
  const raw=String(value || '').trim().toLowerCase();
  const found=DIFFICULTY_LEVELS.find(level=>level.toLowerCase()===raw);
  return found || 'Medium';
}

function normalizeQuestionTopic(value){
  return String(value || '').replace(/\s+/g,' ').trim().slice(0, 80);
}

function topicCodeFromName(value){
  const topic=normalizeQuestionTopic(value);
  if(!topic) return '';
  return topic
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toUpperCase()
    .slice(0, 32);
}

function normalizeTopicRecord(value){
  const raw=value && typeof value==='object'
    ? normalizeQuestionTopic(value.name || value.topic || value.label || value.full || value.code)
    : normalizeQuestionTopic(value);
  if(!raw) return null;
  const explicitCode=value && typeof value==='object' ? String(value.code || value.topicCode || value.topic_code || '').trim() : '';
  return {
    name: raw,
    code: topicCodeFromName(explicitCode || raw)
  };
}

function normalizeTopicList(list, records=qs){
  const out=[];
  const seen=new Set();
  function addTopic(value){
    const rec=normalizeTopicRecord(value);
    if(!rec) return;
    const key=rec.name.toLowerCase();
    if(seen.has(key)) return;
    seen.add(key);
    out.push(rec);
  }
  (Array.isArray(list) ? list : []).forEach(addTopic);
  (Array.isArray(records) ? records : []).forEach(q=>addTopic(q?.topic || q?.topicName || q?.topic_name));
  return out.sort((a,b)=>a.name.localeCompare(b.name));
}

function ensureTopicRecord(topicName){
  const rec=normalizeTopicRecord(topicName);
  if(!rec) return null;
  topics=normalizeTopicList(topics);
  if(!topics.some(t=>t.name.toLowerCase()===rec.name.toLowerCase())){
    topics.push(rec);
    topics=normalizeTopicList(topics);
  }
  return rec;
}

function difficultyOptionsHTML(selected){
  const clean=normalizeDifficulty(selected);
  return DIFFICULTY_LEVELS.map(level=>`<option value="${level}"${level===clean?' selected':''}>${level}</option>`).join('');
}

function bankTopicOptionsHTML(selected=''){
  topics=normalizeTopicList(topics, qs);
  const picked=normalizeQuestionTopic(selected);
  return topics
    .filter(topic=>topic.name!==picked)
    .map(topic=>`<option value="${escA(topic.name)}"></option>`)
    .join('');
}

function topicOptionsHTML(selected=''){
  topics=normalizeTopicList(topics, qs);
  const picked=normalizeQuestionTopic(selected);
  return `<option value=""${!picked?' selected':''}>Unassigned</option>`
    + topics.map(topic=>`<option value="${escA(topic.name)}"${topic.name===picked?' selected':''}>${escH(topic.name)}</option>`).join('')
    + `<option value="__add__">+ Add Topic</option>`;
}

function ensureBankUid(){
  bankUid=String(bankUid||'').trim();
  if(!bankUid) bankUid=createBankUid();
  return bankUid;
}

function exportSafeSlug(name){
  return String(name || 'qs-project')
    .replace(/[^a-zA-Z0-9 _\-]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 60)
    .replace(/^_+|_+$/g, '') || 'qs-project';
}

function getExportIdentity(){
  const projectName=String(examName||'Untitled Project').trim() || 'Untitled Project';
  const slug=exportSafeSlug(projectName);
  const bankId=ensureBankUid();
  return {
    projectName,
    slug,
    bankId,
    paperId:`${bankId}-QP`,
    keyId:`${bankId}-AK`,
    fileStem:slug,
    names:{
      qbank:`${slug}.qbank.json`,
      paperJSON:`${slug}_qspaper.json`,
      keyJSON:`${slug}_key.json`,
      paperPDF:`${slug}_qspaper.pdf`,
      keyPDF:`${slug}_key.pdf`
    }
  };
}

function setAppTheme(theme='normal'){
  const clean = ['normal','dark','blue'].includes(theme) ? theme : 'normal';
  document.body.classList.toggle('theme-dark', clean === 'dark');
  document.body.classList.toggle('theme-blue', clean === 'blue');
  localStorage.setItem(APP_THEME_KEY, clean);
  document.querySelectorAll('.theme-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.theme === clean);
  });
}

function normalizeOption(opt){
  return {
    oid: opt?.oid || '',
    image: opt?.image || '',
    baseImage: opt?.baseImage || '',
    viewerImage: opt?.viewerImage || '',
    burnedFigureImage: opt?.burnedFigureImage || '',
    burnedFigureScale: Math.max(1, +(opt?.burnedFigureScale || opt?.burnedFigureImageScale || 1)),
    burnedFigures: Array.isArray(opt?.burnedFigures) ? opt.burnedFigures : [],
    text: opt?.text || '',
    pdfText: opt?.pdfText || '',
    pdfTextManual: !!opt?.pdfTextManual,
    composerHTML: opt?.composerHTML || '',
    composerTextSize: opt?.composerTextSize || 20,
    composerMathSize: opt?.composerMathSize || 22,
    composerInnerMathScale: opt?.composerInnerMathScale || 115,
    composerEquationInk: opt?.composerEquationInk || '',
    composerRenderProfile: opt?.composerRenderProfile || '',
    renderMode: opt?.renderMode || ((opt?.composerHTML||'').trim() ? 'source' : 'bitmap'),
    figures: Array.isArray(opt?.figures) ? opt.figures : [],
    legends: Array.isArray(opt?.legends) ? opt.legends : [],
    correct: !!opt?.correct
  };
}

function normalizeQuestion(q){
  const topic=normalizeQuestionTopic(q?.topic || q?.topicName || q?.topic_name);
  return {
    ...q,
    label: q?.label || '',
    topic,
    topicCode: topicCodeFromName(q?.topicCode || q?.topic_code || topic),
    difficulty: normalizeDifficulty(q?.difficulty || q?.difficultyLevel || q?.level),
    questionText: q?.questionText || '',
    questionComposerHTML: q?.questionComposerHTML || '',
    questionRenderMode: q?.questionRenderMode || ((q?.questionComposerHTML||'').trim() ? 'source' : 'bitmap'),
    questionImage: q?.questionImage || '',
    questionBaseImage: q?.questionBaseImage || '',
    questionViewerImage: q?.questionViewerImage || '',
    questionBurnedFigureImage: q?.questionBurnedFigureImage || '',
    questionBurnedFigureScale: Math.max(1, +(q?.questionBurnedFigureScale || q?.questionBurnedFigureImageScale || 1)),
    questionBurnedFigures: Array.isArray(q?.questionBurnedFigures) ? q.questionBurnedFigures : [],
    questionFigures: Array.isArray(q?.questionFigures) ? q.questionFigures : [],
    questionLegends: Array.isArray(q?.questionLegends) ? q.questionLegends : [],
    natAnswer: q?.natAnswer || '',
    correctOptionIds: Array.isArray(q?.correctOptionIds) ? q.correctOptionIds : [],
    options: Array.isArray(q?.options) ? q.options.map(normalizeOption) : [
      {oid:'',image:'',baseImage:'',viewerImage:'',burnedFigureImage:'',burnedFigureScale:1,burnedFigures:[],text:'',composerHTML:'',composerTextSize:20,renderMode:'bitmap',figures:[],legends:[],correct:false},
      {oid:'',image:'',baseImage:'',viewerImage:'',burnedFigureImage:'',burnedFigureScale:1,burnedFigures:[],text:'',composerHTML:'',composerTextSize:20,renderMode:'bitmap',figures:[],legends:[],correct:false},
      {oid:'',image:'',baseImage:'',viewerImage:'',burnedFigureImage:'',burnedFigureScale:1,burnedFigures:[],text:'',composerHTML:'',composerTextSize:20,renderMode:'bitmap',figures:[],legends:[],correct:false},
      {oid:'',image:'',baseImage:'',viewerImage:'',burnedFigureImage:'',burnedFigureScale:1,burnedFigures:[],text:'',composerHTML:'',composerTextSize:20,renderMode:'bitmap',figures:[],legends:[],correct:false}
    ]
  };
}

qs = qs.map(normalizeQuestion);
qs.forEach(q=>{
  if(Array.isArray(q.options)){
    q.options.forEach((opt,i)=>{ opt.oid = opt.oid || genOid(q.qid,i+1); });
    q.correctOptionIds = q.options.filter(o=>o.correct).map(o=>o.oid);
  }
});
topics = normalizeTopicList(topics, qs);

function getProjectStorageKey(id){
  return 'gate_project_' + id;
}

function normalizeProjectMeta(p){
  return {
    id: p?.id || Date.now().toString(),
    examName: String(p?.examName || '').trim(),
    bankUid: String(p?.bankUid || '').trim(),
    updatedAt: p?.updatedAt || new Date().toISOString()
  };
}

function readProjectState(id){
  if(!id) return null;
  try{
    return JSON.parse(localStorage.getItem(getProjectStorageKey(id)) || 'null');
  }catch{
    return null;
  }
}

function syncProjectIndex(){
  projectIndex = projectIndex
    .map(normalizeProjectMeta)
    .filter(p=>p.examName)
    .sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
  localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(projectIndex));
}

function rememberActiveProject(id){
  activeProjectId = id || '';
  if(activeProjectId){
    sessionStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId);
    localStorage.setItem(ACTIVE_PROJECT_KEY, activeProjectId);
  } else {
    sessionStorage.removeItem(ACTIVE_PROJECT_KEY);
    localStorage.removeItem(ACTIVE_PROJECT_KEY);
  }
}

function upsertProjectMeta(id, name, uid=bankUid){
  const exam = String(name || '').trim();
  const next = normalizeProjectMeta({ id, examName: exam, bankUid: String(uid||'').trim(), updatedAt: new Date().toISOString() });
  const idx = projectIndex.findIndex(p=>p.id===id);
  if(idx>=0) projectIndex[idx] = next;
  else projectIndex.push(next);
  syncProjectIndex();
}

let saveLS = function(){
  try{
    localStorage.removeItem(LEGACY_QS_KEY);
    localStorage.removeItem(LEGACY_SUBJECTS_KEY);
  }catch(_){ }
  if(activeProjectId && String(examName||'').trim()){
    try{ localStorage.removeItem(getProjectStorageKey(activeProjectId)); }catch(_){ }
    try{ upsertProjectMeta(activeProjectId, examName, ensureBankUid()); }catch(_){ }
  }
};

function loadProjectState(id){
  const state = readProjectState(id);
  if(!state) return false;
  examName = String(state.examName || '').trim();
  bankUid = String(state.bankUid || state.bank_id || '').trim() || createBankUid();
  pdfBranding = normalizePdfBranding(state.pdfBranding);
  pdfPublishing = normalizePdfPublishing(state.pdfPublishing);
  subjects = JSON.parse(JSON.stringify((Array.isArray(state.subjects) && state.subjects.length) ? state.subjects : DEFAULT_SUBJECTS));
  qs = (Array.isArray(state.qs) ? state.qs : []).map(normalizeQuestion);
  topics = normalizeTopicList(state.topics, qs);
  qs.forEach(q=>{
    if(Array.isArray(q.options)){
      q.options.forEach((opt,i)=>{ opt.oid = opt.oid || genOid(q.qid,i+1); });
      q.correctOptionIds = q.options.filter(o=>o.correct).map(o=>o.oid);
    }
  });
  cur = qs[0] || null;
  selectedQIds.clear();
  rememberActiveProject(id);
  saveLS();
  return true;
}

function createProjectState(name){
  const clean = String(name || '').trim();
  if(!clean) return false;
  const id = Date.now().toString();
  const hadLegacyDraft = !activeProjectId && !projectIndex.length && (qs.length>0 || JSON.stringify(subjects)!==JSON.stringify(DEFAULT_SUBJECTS));
  examName = clean;
  bankUid = createBankUid();
  pdfBranding = normalizePdfBranding(DEFAULT_PDF_BRANDING);
  pdfPublishing = normalizePdfPublishing(DEFAULT_PDF_PUBLISHING);
  if(!hadLegacyDraft){
    subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
    topics = JSON.parse(JSON.stringify(DEFAULT_TOPICS));
    qs = [];
    cur = null;
  } else {
    qs = qs.map(normalizeQuestion);
    topics = normalizeTopicList(topics, qs);
    cur = cur || qs[0] || null;
  }
  selectedQIds.clear();
  rememberActiveProject(id);
  saveLS();
  return true;
}

function clearCurrentProjectState(){
  if(activeProjectId){
    localStorage.removeItem(getProjectStorageKey(activeProjectId));
    projectIndex = projectIndex.filter(p=>p.id!==activeProjectId);
    syncProjectIndex();
  }
  rememberActiveProject('');
  localStorage.removeItem(LEGACY_QS_KEY);
  localStorage.removeItem(LEGACY_SUBJECTS_KEY);
  examName = '';
  bankUid = '';
  pdfBranding = normalizePdfBranding(DEFAULT_PDF_BRANDING);
  pdfPublishing = normalizePdfPublishing(DEFAULT_PDF_PUBLISHING);
  qs = [];
  cur = null;
  selectedQIds.clear();
  subjects = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS));
  topics = JSON.parse(JSON.stringify(DEFAULT_TOPICS));
}

function startFreshProject(){
  askConfirm('Abort the current project and start a fresh new project from zero?', ()=>{
    clearCurrentProjectState();
    renderSidebar();
    renderEditor();
    renderPaper();
    showProjectLauncher();
  });
}

function getSubjectMeta(short){
  return subjects.find(s=>s.short===short) || subjects[0] || DEFAULT_SUBJECTS[0];
}

function subjectOptionsHTML(selected){
  return subjects.map(s=>`<option value="${escA(s.short)}"${s.short===selected?' selected':''}>${escH(s.short)}</option>`).join('')
    + `<option value="__add__">+ Add Subject</option>`;
}

function genQid(subj, idx){
  const d = new Date();
  return subj + d.getFullYear().toString().slice(2)
    + (d.getMonth()+1).toString().padStart(2,'0')
    + String(idx).padStart(3,'0');
}
function genOid(qid, n){ return qid + String(n*11).padStart(3,'0'); }

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
