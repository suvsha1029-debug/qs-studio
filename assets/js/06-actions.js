//  NEW / SAVE / DELETE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function newQ(){
  if(!examName.trim()){
    showProjectLauncher();
    return;
  }
  const isFirstPaperQuestion=qs.length===0;
  const preparationToken=isFirstPaperQuestion && typeof beginPaperPreparation==='function'
    ? beginPaperPreparation({
        reason:'first-question',
        title:'Preparing the first question',
        detail:'Building the editor canvas and warming the new paper preview...'
      })
    : null;
  const idx=qs.length+1;
  const firstSub = subjects[0]?.short || 'EC';
  const q={
    id:Date.now().toString(),
    qid:genQid(firstSub,idx),
    type:'MCQ', subject:firstSub,
    label:'',
    topic:'',
    topicCode:'',
    difficulty:'Medium',
    questionText:'',
    questionComposerHTML:'',
    marks:2, negMarks:-0.67,
    questionImage:'',
    questionBaseImage:'',
    questionViewerImage:'',
    questionFigures:[],
    questionLegends:[],
    options:[
      {oid:genOid(genQid(firstSub,idx),1),image:'',baseImage:'',viewerImage:'',text:'',composerHTML:'',renderMode:'bitmap',figures:[],legends:[],correct:false},
      {oid:genOid(genQid(firstSub,idx),2),image:'',baseImage:'',viewerImage:'',text:'',composerHTML:'',renderMode:'bitmap',figures:[],legends:[],correct:false},
      {oid:genOid(genQid(firstSub,idx),3),image:'',baseImage:'',viewerImage:'',text:'',composerHTML:'',renderMode:'bitmap',figures:[],legends:[],correct:false},
      {oid:genOid(genQid(firstSub,idx),4),image:'',baseImage:'',viewerImage:'',text:'',composerHTML:'',renderMode:'bitmap',figures:[],legends:[],correct:false}
    ],
    natAnswer:'',
    correctOptionIds:[]
  };
  qs.push(q); saveLS(); loadQ(q.id); renderPaper();
  if(isFirstPaperQuestion && typeof preparePaperWorkspace==='function'){
    preparePaperWorkspace({
      token:preparationToken,
      reason:'first-question',
      title:'Preparing the first question',
      minVisibleMs:500
    }).catch(err=>console.error('First-question preparation failed:',err));
  }
}

function saveQ(){
  if(!cur) return;
  saveLS(); renderSidebar(); renderPaper();
  toast('Saved ✓');
}

function saveAll(){
  saveLS();
  renderSidebar();
  renderEditor();
  renderPaper();
  openModal({
    title:'Saved Successfully',
    subtitle:'Everything in this question bank has been stored.',
    closable:true,
    body:`
      <div class="save-all-copy">
        <div class="save-all-ok">&#10003;</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="font-size:15px;font-weight:700;color:var(--accent)">All questions, options, subjects, and bank data are saved.</div>
          <div class="modal-note">Your current question bank is safe to continue editing.</div>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn pri" type="button" onclick="closeModal()">OK</button>
      </div>
    `
  });
}

function deleteQ(){
  if(!cur) return;
  askConfirm('Delete this question?', ()=>{
    qs=qs.filter(q=>q.id!==cur.id);
    selectedQIds.delete(cur.id);
    cur=null; saveLS(); renderSidebar(); renderEditor(); renderPaper();
  });
}

function deleteSelectedQ(){
  if(!selectedQIds.size) return;
  askConfirm(`Delete ${selectedQIds.size} selected question(s)?`, ()=>{
    qs=qs.filter(q=>!selectedQIds.has(q.id));
    if(cur && selectedQIds.has(cur.id)) cur=null;
    selectedQIds.clear();
    saveLS(); renderSidebar(); renderEditor(); renderPaper();
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

