// Answer readiness and one-panel question styling.
(function(){
  function answerIssueForQuestion(q,index){
    const options=Array.isArray(q?.options) ? q.options : [];
    const correct=options.filter(option=>option?.correct);
    let reason='';
    if(q?.type==='NAT' && !String(q?.natAnswer||'').trim()) reason='NAT answer missing';
    else if(q?.type==='MCQ' && correct.length===0) reason='Correct option missing';
    else if(q?.type==='MCQ' && correct.length>1) reason='More than one MCQ answer';
    else if(q?.type==='MSQ' && correct.length===0) reason='Correct options missing';
    if(!reason) return null;
    const identity=typeof buildExportQuestionIdentity==='function'
      ? buildExportQuestionIdentity(q,index)
      : {exportQuestionId:String(q?.qid||q?.id||'')};
    const bankId=typeof ensureBankUid==='function' ? ensureBankUid() : String(bankUid||'');
    const questionId=String(q?.qid||q?.id||`Q${index+1}`);
    return {
      index,
      number:index+1,
      id:String(q?.id||''),
      questionId,
      globalId:[bankId,identity.exportQuestionId||questionId].filter(Boolean).join(':'),
      type:String(q?.type||'Question'),
      reason
    };
  }

  window.getAnswerAuditIssues=function(){
    return (Array.isArray(qs) ? qs : []).map(answerIssueForQuestion).filter(Boolean);
  };

  window.updateAnswerAuditStatus=function(){
    const card=document.getElementById('exportReadiness');
    const summary=document.getElementById('answerAuditSummary');
    if(!card || !summary) return;
    const total=Array.isArray(qs) ? qs.length : 0;
    const missing=window.getAnswerAuditIssues();
    card.classList.toggle('is-empty',total===0);
    card.classList.toggle('has-issues',missing.length>0);
    card.classList.toggle('is-ready',total>0 && missing.length===0);
    summary.textContent=!total ? 'No questions' : missing.length ? `${missing.length} need answers` : `All ${total} answers set`;
  };

  window.openQuestionFromAudit=async function(id,index=-1){
    closeModal();
    const target=(Array.isArray(qs) ? qs : []).find(question=>question?.id===id) || qs[+index] || null;
    if(!target) return;
    if(target.id) await loadQ(target.id);
    else{
      cur=target;
      renderSidebar();
      await renderEditor();
    }
    const editor=document.getElementById('editor');
    if(editor) editor.scrollTop=editor.scrollHeight;
    requestAnimationFrame(()=>{
      const answer=document.getElementById('answerSection');
      answer?.scrollIntoView({behavior:'smooth',block:'center'});
      const first=answer?.querySelector('input');
      first?.focus({preventScroll:true});
    });
  };

  window.openAnswerAudit=function(options={}){
    const issues=window.getAnswerAuditIssues();
    const exportLabel=String(options.exportLabel||'');
    if(!qs.length){
      showNotice('Add a question first.','Answer Audit');
      return;
    }
    if(!issues.length){
      openModal({
        title:'Answers ready',
        subtitle:`${qs.length} of ${qs.length} complete`,
        closable:true,
        body:`<div class="audit-ready"><span>&#10003;</span><strong>All answers are set</strong></div><div class="modal-actions">${options.onContinue?`<button class="btn pri" id="auditContinueBtn">Continue ${escH(exportLabel)}</button>`:''}<button class="btn" type="button" onclick="closeModal()">Close</button></div>`
      });
    }else{
      openModal({
        title:'Answers needed',
        subtitle:`${issues.length} of ${qs.length} incomplete`,
        closable:true,
        body:`
          <div class="answer-audit-list">
            ${issues.map(issue=>`<div class="answer-audit-row">
              <div class="answer-audit-number">Q.${issue.number}</div>
              <div class="answer-audit-info">
                <strong>${escH(issue.reason)}</strong>
                <span>Question ID&nbsp; ${escH(issue.questionId)}</span>
                <span>Global ID&nbsp; ${escH(issue.globalId)}</span>
              </div>
              <button class="btn pri" type="button" onclick="openQuestionFromAudit('${escA(issue.id)}',${issue.index})">Open</button>
            </div>`).join('')}
          </div>
          <div class="modal-actions">
            ${options.onContinue?`<button class="btn" id="auditContinueBtn" type="button">Export anyway</button>`:''}
            <button class="btn" type="button" onclick="closeModal()">Close</button>
          </div>`
      });
    }
    const continueBtn=document.getElementById('auditContinueBtn');
    if(continueBtn) continueBtn.onclick=()=>{ closeModal(); options.onContinue?.(); };
  };

  function stylePreset(name){
    const presets={
      clean:{text:18,math:22,inner:110,ink:'light'},
      balanced:{text:20,math:24,inner:115,ink:'regular'},
      strong:{text:20,math:24,inner:120,ink:'bold'}
    };
    const preset=presets[name]||presets.balanced;
    const values={styleTextSize:preset.text,styleMathSize:preset.math,styleInnerScale:preset.inner,styleInk:preset.ink};
    Object.entries(values).forEach(([id,value])=>{const el=document.getElementById(id);if(el)el.value=String(value)});
    window.updateQuestionStylePreview();
  }
  window.setQuestionStylePreset=stylePreset;

  window.updateQuestionStylePreview=function(){
    const preview=document.getElementById('questionStylePreview');
    if(!preview) return;
    const size=typeof clampMixedComposerTextSize==='function' ? clampMixedComposerTextSize(document.getElementById('styleTextSize')?.value) : 20;
    const math=typeof clampMixedComposerMathSize==='function' ? clampMixedComposerMathSize(document.getElementById('styleMathSize')?.value) : 24;
    const ink=String(document.getElementById('styleInk')?.value||'regular');
    const weights={fine:300,light:400,regular:500,bold:650,extra:800};
    preview.style.fontSize=size+'px';
    preview.style.fontWeight=String(weights[ink]||500);
    preview.querySelector('span')?.style.setProperty('font-size',math+'px');
  };

  window.updateQuestionStyleRange=function(){
    const range=document.querySelector('input[name="styleApplyRange"]:checked')?.value||'paper';
    const applyBtn=document.getElementById('applyQuestionStyleBtn');
    const rangeNote=document.getElementById('questionStyleRangeNote');
    if(applyBtn) applyBtn.textContent=range==='paper' ? `Apply to ${qs.length} questions` : 'Apply to this question';
    if(rangeNote) rangeNote.textContent=range==='paper'
      ? `Every question and its options in this paper will receive the selected style.`
      : 'Only the open question and its options will receive the selected style.';
  };

  window.openQuestionStylePanel=function(){
    if(!qs.length){showNotice('Add a question first.','Paper Style');return}
    const q=cur||qs[0];
    const text=typeof clampMixedComposerTextSize==='function' ? clampMixedComposerTextSize(q.questionComposerTextSize||20) : 20;
    const math=typeof clampMixedComposerMathSize==='function' ? clampMixedComposerMathSize(q.questionComposerMathSize||22) : 22;
    const inner=typeof clampMixedComposerInnerMathScale==='function' ? clampMixedComposerInnerMathScale(q.questionComposerInnerMathScale||115) : 115;
    const ink=typeof clampMixedComposerEquationStroke==='function' ? clampMixedComposerEquationStroke(q.questionComposerEquationInk||'light') : 'light';
    openModal({
      title:'Paper style',
      subtitle:`One control for ${qs.length} question${qs.length===1?'':'s'} and all options`,
      closable:true,
      body:`<div class="question-style-shell">
        <div class="question-style-range" role="radiogroup" aria-label="Apply style to">
          <label>
            <input type="radio" name="styleApplyRange" value="current" onchange="updateQuestionStyleRange()">
            <span><strong>Current question</strong><small>Q.${qs.indexOf(q)+1} · ${escH(q.qid||q.id||'Question')}</small></span>
          </label>
          <label>
            <input type="radio" name="styleApplyRange" value="paper" onchange="updateQuestionStyleRange()" checked>
            <span><strong>Entire paper</strong><small>${qs.length} question${qs.length===1?'':'s'}</small></span>
          </label>
        </div>
        <div class="question-style-presets">
          <button class="style-preset" type="button" onclick="setQuestionStylePreset('clean')">Clean</button>
          <button class="style-preset" type="button" onclick="setQuestionStylePreset('balanced')">Balanced</button>
          <button class="style-preset" type="button" onclick="setQuestionStylePreset('strong')">Bold</button>
        </div>
        <div class="question-style-grid">
          <label><span>Text size</span><select id="styleTextSize" onchange="updateQuestionStylePreview()">${getMixedComposerTextOptionsHTML(text)}</select></label>
          <label><span>Math size</span><select id="styleMathSize" onchange="updateQuestionStylePreview()">${getMixedComposerMathOptionsHTML(math)}</select></label>
          <label><span>Inner math</span><select id="styleInnerScale" onchange="updateQuestionStylePreview()">${getMixedComposerInnerMathOptionsHTML(inner)}</select></label>
          <label><span>Ink</span><select id="styleInk" onchange="updateQuestionStylePreview()">${getMixedComposerEquationStrokeOptionsHTML(ink)}</select></label>
        </div>
        <div class="question-style-scope">
          <label><input id="styleQuestionScope" type="checkbox" checked> Question</label>
          <label><input id="styleOptionScope" type="checkbox" checked> All options</label>
        </div>
        <div class="question-style-preview" id="questionStylePreview">Aa &nbsp; <span>x² + y² = r²</span></div>
        <div class="question-style-note" id="questionStyleRangeNote"></div>
        <div class="question-style-note">Canvas, paper preview and exports stay synchronized. Imported bitmaps stay unchanged.</div>
      </div>
      <div class="modal-actions"><button class="btn pri" id="applyQuestionStyleBtn" type="button" onclick="applyQuestionStylePanel()">Apply to ${qs.length} questions</button><button class="btn" type="button" onclick="closeModal()">Cancel</button></div>`
    });
    updateQuestionStylePreview();
    updateQuestionStyleRange();
  };

  window.applyQuestionStylePanel=async function(){
    const activeQuestion=cur||qs[0];
    if(!activeQuestion) return;
    const applyQuestion=!!document.getElementById('styleQuestionScope')?.checked;
    const applyOptions=!!document.getElementById('styleOptionScope')?.checked;
    if(!applyQuestion && !applyOptions){toast('Choose a style target');return}
    const textSize=clampMixedComposerTextSize(document.getElementById('styleTextSize')?.value);
    const mathSize=clampMixedComposerMathSize(document.getElementById('styleMathSize')?.value);
    const innerScale=clampMixedComposerInnerMathScale(document.getElementById('styleInnerScale')?.value);
    const equationInk=clampMixedComposerEquationStroke(document.getElementById('styleInk')?.value);
    const range=document.querySelector('input[name="styleApplyRange"]:checked')?.value||'paper';
    const targets=range==='paper' ? qs : [activeQuestion];
    const setQuestion=target=>{
      target.questionComposerTextSize=textSize;
      target.questionComposerMathSize=mathSize;
      target.questionComposerInnerMathScale=innerScale;
      target.questionComposerEquationInk=equationInk;
      target.questionComposerRenderProfile='hallmark';
    };
    const setOption=option=>{
      option.composerTextSize=textSize;
      option.composerMathSize=mathSize;
      option.composerInnerMathScale=innerScale;
      option.composerEquationInk=equationInk;
      option.composerRenderProfile='hallmark';
    };
    targets.forEach(target=>{
      if(applyQuestion) setQuestion(target);
      if(applyOptions) (target.options||[]).forEach(setOption);
    });
    closeModal();
    const overlay=document.getElementById('questionLoadOverlay');
    overlay?.classList.add('is-active');
    overlay?.setAttribute('aria-hidden','false');
    try{
      if(cur && targets.includes(cur)) await renderEditor();
      if(typeof saveLS==='function') saveLS();
      renderSidebar();
      renderPaper(true);
      if(typeof hydratePaperLazyImages==='function') await hydratePaperLazyImages({eager:true});
    }finally{
      overlay?.classList.remove('is-active');
      overlay?.setAttribute('aria-hidden','true');
    }
    toast(range==='paper' ? `Style applied to ${targets.length} questions` : 'Style applied to this question');
  };

  const baseRenderSidebar=window.renderSidebar;
  if(typeof baseRenderSidebar==='function'){
    window.renderSidebar=function(){
      const result=baseRenderSidebar.apply(this,arguments);
      window.updateAnswerAuditStatus();
      return result;
    };
    try{ renderSidebar=window.renderSidebar; }catch(_){ }
  }

  const baseRunExportJob=window.runExportJob;
  if(typeof baseRunExportJob==='function'){
    window.runExportJob=function(label,job,opts={}){
      if(/PDF/i.test(String(label||''))) return baseRunExportJob(label,job,opts);
      const issues=window.getAnswerAuditIssues();
      if(!opts.skipAnswerAudit && issues.length){
        window.openAnswerAudit({
          exportLabel:label,
          onContinue:()=>baseRunExportJob(label,job,{...opts,skipAnswerAudit:true})
        });
        return Promise.resolve(false);
      }
      return baseRunExportJob(label,job,opts);
    };
    try{ runExportJob=window.runExportJob; }catch(_){ }
  }

  const baseAskWatermarkThen=window.askWatermarkThen;
  if(typeof baseAskWatermarkThen==='function'){
    window.askWatermarkThen=function(kind){
      const issues=window.getAnswerAuditIssues();
      if(issues.length){
        const labels={key:'Key PDF',bank:'Paper PDF',selectable:'Text PDF','selectable-clean':'Clean PDF'};
        window.openAnswerAudit({
          exportLabel:labels[kind]||'PDF',
          onContinue:()=>baseAskWatermarkThen(kind)
        });
        return;
      }
      return baseAskWatermarkThen(kind);
    };
    try{ askWatermarkThen=window.askWatermarkThen; }catch(_){ }
  }

  document.addEventListener('input',event=>{
    if(event.target?.id==='natAns') requestAnimationFrame(window.updateAnswerAuditStatus);
  });
  document.addEventListener('change',event=>{
    if(/^corr\d+$/.test(event.target?.id||'') || event.target?.id==='natAns') requestAnimationFrame(window.updateAnswerAuditStatus);
  });
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',window.updateAnswerAuditStatus,{once:true});
  else window.updateAnswerAuditStatus();
})();
