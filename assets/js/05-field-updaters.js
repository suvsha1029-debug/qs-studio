//  FIELD UPDATERS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function updF(k,v){
  if(!cur) return;
  cur[k]=v;
  if(k==='type'&&v==='MCQ') cur.options.forEach((o,i)=>{if(i>0)o.correct=false;});
  saveLS(); renderSidebar();
}
function setQuestionTopic(v){
  if(!cur) return;
  const topic=typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(v) : String(v || '').trim();
  cur.topic=topic;
  cur.topicCode=typeof topicCodeFromName==='function' ? topicCodeFromName(topic) : topic;
  if(topic && typeof ensureTopicRecord==='function') ensureTopicRecord(topic);
  saveLS(); renderSidebar();
}
function setQuestionDifficulty(v){
  if(!cur) return;
  cur.difficulty=typeof normalizeDifficulty==='function' ? normalizeDifficulty(v) : String(v || 'Medium');
  saveLS(); renderSidebar();
}
function setPdfQuestionText(v){
  if(!cur) return;
  if(typeof setFramePdfTextOverride==='function') setFramePdfTextOverride('q', v);
  else cur.questionPdfText=storePdfText(v);
  saveLS(); renderSidebar(); syncPdfSourceFields(); renderPaper();
}
function setPdfOptionText(i,v){
  if(!cur||!cur.options[i]) return;
  if(typeof setFramePdfTextOverride==='function') setFramePdfTextOverride('opt'+i, v);
  else cur.options[i].pdfText=storePdfText(v);
  saveLS(); syncPdfSourceFields(); renderPaper();
}
function setCorr(i,v){
  if(!cur) return;
  if(cur.type==='MCQ') cur.options.forEach(o=>o.correct=false);
  cur.options[i].correct=v;
  cur.options.forEach((o,idx)=>{ o.oid = o.oid || genOid(cur.qid, idx+1); });
  cur.correctOptionIds = cur.options.filter(o=>o.correct).map(o=>o.oid);
  saveLS(); renderPaper();
}
function regenQid(){
  if(!cur) return;
  cur.qid=genQid(cur.subject, qs.indexOf(cur)+1);
  cur.options.forEach((o,i)=>{ o.oid = genOid(cur.qid, i+1); });
  cur.correctOptionIds = cur.options.filter(o=>o.correct).map(o=>o.oid);
  saveLS(); renderEditor(); renderPaper();
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

