//  SIDEBAR
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
const SIDEBAR_VIRTUAL_THRESHOLD = 36;
const SIDEBAR_ROW_HEIGHT = 64;
const SIDEBAR_OVERSCAN = 8;
let sidebarScrollRaf = 0;

function sidebarItemHTML(q, top=null){
  const style = top===null ? '' : ` style="top:${top}px"`;
  const difficulty = typeof normalizeDifficulty==='function' ? normalizeDifficulty(q.difficulty) : (q.difficulty || 'Medium');
  const topic = typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(q.topic) : String(q.topic || '').trim();
  const topicCode = typeof topicCodeFromName==='function' ? topicCodeFromName(q.topicCode || topic) : String(q.topicCode || topic || '').trim();
  return `
    <div class="qs-item${q.id===(cur&&cur.id)?' active':''}${selectedQIds.has(q.id)?' sel':''}"${style}>
      <button class="qs-pick${selectedQIds.has(q.id)?' on':''}" type="button" onclick="toggleQSelect(event,'${q.id}')" title="Select">${selectedQIds.has(q.id)?'&#10003;':''}</button>
      <div class="qs-main" onclick="loadQ('${q.id}')">
        <div style="display:flex;align-items:center;gap:5px">
          <span class="badge b-${q.type.toLowerCase()}">${q.type}</span>
          <span class="badge diff-${difficulty.toLowerCase()}">${difficulty}</span>
          <span class="qi-id">${q.qid}</span>
          ${topicCode ? `<span class="topic-chip" title="${escA(topic)}">${escH(topicCode)}</span>` : ''}
        </div>
        <div class="qi-preview">${escH(q.label||q.questionText||'(no label)').replace(/\n/g,' ')}</div>
      </div>
    </div>
  `;
}

function bindSidebarVirtualScroll(el){
  if(!el || el._sidebarVirtualBound) return;
  el._sidebarVirtualBound = true;
  el.addEventListener('scroll', ()=>{
    if(sidebarScrollRaf) return;
    sidebarScrollRaf = requestAnimationFrame(()=>{
      sidebarScrollRaf = 0;
      renderSidebarVirtual(el, false);
    });
  }, { passive:true });
}

function renderSidebarVirtual(el, force=true){
  if(!el) return;
  const viewH = Math.max(1, el.clientHeight || 600);
  const scrollTop = Math.max(0, el.scrollTop || 0);
  const start = Math.max(0, Math.floor(scrollTop / SIDEBAR_ROW_HEIGHT) - SIDEBAR_OVERSCAN);
  const end = Math.min(qs.length, Math.ceil((scrollTop + viewH) / SIDEBAR_ROW_HEIGHT) + SIDEBAR_OVERSCAN);
  const activeId = cur && cur.id ? cur.id : '';
  const selectedKey = Array.from(selectedQIds).sort().join('|');
  const rangeKey = `${start}:${end}:${qs.length}:${activeId}:${selectedKey}`;
  if(!force && el.dataset.virtualRange === rangeKey) return;
  el.dataset.virtualRange = rangeKey;
  el.classList.add('virtualized');
  const rows = qs.slice(start, end).map((q, idx)=>sidebarItemHTML(q, (start + idx) * SIDEBAR_ROW_HEIGHT)).join('');
  el.innerHTML = `<div class="qs-virtual-spacer" style="height:${qs.length * SIDEBAR_ROW_HEIGHT}px">${rows}</div>`;
  el.scrollTop = scrollTop;
}

function renderSidebar(){
  const el = document.getElementById('qsList');
  document.getElementById('qcount').textContent = qs.length;
  bindSidebarVirtualScroll(el);
  if(!qs.length){
    el.classList.remove('virtualized');
    delete el.dataset.virtualRange;
    el.innerHTML='<div style="padding:12px;text-align:center;font-size:11px;color:var(--muted)">No questions yet</div>';
    renderSidebarFooter();
    return;
  }
  if(qs.length >= SIDEBAR_VIRTUAL_THRESHOLD){
    renderSidebarVirtual(el, true);
  }else{
    el.classList.remove('virtualized');
    delete el.dataset.virtualRange;
    el.innerHTML = qs.map(q=>sidebarItemHTML(q)).join('');
  }
  renderSidebarFooter();
}

function renderSidebarFooter(){
  const footer=document.querySelector('.sidebar-footer');
  if(!footer) return;
  const picked=selectedQIds.size;
  footer.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:6px">
      <button class="btn pri" style="width:100%;justify-content:center" onclick="newQ()">+ New Question</button>
      <button class="btn${picked?' del':''}" style="width:100%;justify-content:center" onclick="deleteSelectedQ()" ${picked?'':'disabled'}>
        Delete Selected${picked?` (${picked})`:''}
      </button>
    </div>
  `;
}

function toggleQSelect(ev,id){
  ev.stopPropagation();
  if(selectedQIds.has(id)) selectedQIds.delete(id);
  else selectedQIds.add(id);
  renderSidebar();
}

function handleSubjectPick(sel){
  if(sel.value==='__add__'){
    openSubjectManager();
    if(cur) sel.value = cur.subject;
    else sel.value = subjects[0]?.short || 'EC';
    return;
  }
  updF('subject', sel.value);
  regenQid();
}

function handleTopicPick(sel){
  if(sel.value==='__add__'){
    openTopicManager();
    sel.value = cur ? (cur.topic || '') : '';
    return;
  }
  setQuestionTopic(sel.value);
  renderEditor();
}

function getSectionDisplay(meta){
  const sm = meta || DEFAULT_SUBJECTS[0];
  return sm?.short && sm?.full ? `${sm.short}-${sm.full}` : (sm?.section || sm?.short || '-');
}

function deleteSubjectFlow(short){
  if(subjects.length<=1){ showNotice('At least one subject must remain.', 'Subject Manager'); return; }
  if(qs.some(q=>q.subject===short)){ showNotice('This subject is in use by one or more questions. Reassign those questions first.', 'Subject Manager'); return; }
  const sm=getSubjectMeta(short);
  askConfirm(`Delete subject ${sm.short} (${sm.full})?`, ()=>{
    subjects = subjects.filter(s=>s.short!==short);
    if(cur && cur.subject===short) cur.subject = subjects[0]?.short || 'EC';
    saveLS();
    closeModal();
    renderSidebar();
    renderEditor();
    renderPaper();
    showNotice('Subject deleted successfully.', 'Success');
  });
}

function saveSubjectFromModal(editingShort=''){
  const shortEl=document.getElementById('subjShortInput');
  const fullEl=document.getElementById('subjFullInput');
  const sectionEl=document.getElementById('subjSectionInput');
  const short=String(shortEl?.value||'').trim().toUpperCase();
  const full=String(fullEl?.value||'').trim();
  const section=String(sectionEl?.value||'').trim() || short;
  if(!short){ showNotice('Subject short form is required.', 'Subject Manager'); return; }
  if(!full){ showNotice('Complete subject name is required.', 'Subject Manager'); return; }
  if(subjects.some(s=>s.short===short && s.short!==editingShort)){
    showNotice('Subject short form already exists.', 'Subject Manager');
    return;
  }
  if(editingShort){
    subjects = subjects.map(s=>s.short===editingShort ? { short, full, section } : s);
    qs.forEach(q=>{ if(q.subject===editingShort) q.subject=short; });
  } else {
    subjects.push({ short, full, section });
    if(cur && !cur.subject) cur.subject=short;
  }
  saveLS();
  renderSidebar();
  renderEditor();
  renderPaper();
  openSubjectManager(short);
}

function openSubjectManager(editShort=''){
  const sm = editShort ? getSubjectMeta(editShort) : { short:'', full:'', section:'' };
  const rows = subjects.map(s=>`
    <div class="subject-item">
      <div class="subject-meta">
        <div class="subject-name">${escH(s.short)} - ${escH(s.full)}</div>
        <div class="subject-sub">Section: ${escH(s.section || s.short)}</div>
      </div>
      <div class="subject-actions">
        <button class="btn" type="button" onclick="openSubjectManager('${escA(s.short)}')">Edit</button>
        <button class="btn del" type="button" onclick="deleteSubjectFlow('${escA(s.short)}')">Delete</button>
      </div>
    </div>
  `).join('');
  openModal({
    title:'Subject And Section Manager',
    subtitle:'Add, edit, or delete subject codes and linked section labels without browser popups.',
    closable:true,
    body:`
      <div class="project-list">${rows}</div>
      <div class="modal-grid">
        <div class="field">
          <label>Short Form</label>
          <input id="subjShortInput" type="text" value="${escA(sm.short||'')}" placeholder="e.g. EC">
        </div>
        <div class="field">
          <label>Complete Name</label>
          <input id="subjFullInput" type="text" value="${escA(sm.full||'')}" placeholder="e.g. Electronics & Communication">
        </div>
        <div class="field">
          <label>Section</label>
          <input id="subjSectionInput" type="text" value="${escA(sm.section||'')}" placeholder="e.g. EC">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn pri" type="button" onclick="saveSubjectFromModal('${escA(editShort||'')}')">${editShort?'Save Changes':'Add Subject'}</button>
        ${editShort?`<button class="btn" type="button" onclick="openSubjectManager()">New Entry</button>`:''}
        <button class="btn" type="button" onclick="closeModal()">Close</button>
      </div>
    `
  });
}

function deleteTopicFlow(name){
  const topic=typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(name) : String(name || '').trim();
  if(!topic){ showNotice('Select a topic first.', 'Topic Manager'); return; }
  if(qs.some(q=>(typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(q.topic) : String(q.topic || '').trim())===topic)){
    showNotice('This topic is in use by one or more questions. Reassign those questions first.', 'Topic Manager');
    return;
  }
  askConfirm(`Delete topic ${topic}?`, ()=>{
    topics = (Array.isArray(topics) ? topics : []).filter(t=>{
      const tName=typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(t?.name || t) : String(t?.name || t || '').trim();
      return tName!==topic;
    });
    topics = typeof normalizeTopicList==='function' ? normalizeTopicList(topics, qs) : topics;
    saveLS();
    closeModal();
    renderSidebar();
    renderEditor();
    showNotice('Topic deleted successfully.', 'Success');
  });
}

function saveTopicFromModal(editingName=''){
  const nameEl=document.getElementById('topicNameInput');
  const codeEl=document.getElementById('topicCodeInput');
  const name=typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(nameEl?.value || '') : String(nameEl?.value || '').trim();
  const oldName=typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(editingName) : String(editingName || '').trim();
  const code=typeof topicCodeFromName==='function' ? topicCodeFromName(codeEl?.value || name) : String(codeEl?.value || name || '').trim();
  if(!name){ showNotice('Topic name is required.', 'Topic Manager'); return; }
  topics = typeof normalizeTopicList==='function' ? normalizeTopicList(topics, qs) : (Array.isArray(topics) ? topics : []);
  if(topics.some(t=>String(t.name || t).toLowerCase()===name.toLowerCase() && String(t.name || t)!==oldName)){
    showNotice('Topic already exists.', 'Topic Manager');
    return;
  }
  if(oldName){
    topics = topics.map(t=>{
      const tName=typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(t?.name || t) : String(t?.name || t || '').trim();
      return tName===oldName ? {name, code} : t;
    });
    qs.forEach(q=>{
      const qTopic=typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(q.topic) : String(q.topic || '').trim();
      if(qTopic===oldName){
        q.topic=name;
        q.topicCode=code;
      }
    });
  } else {
    topics.push({name, code});
    if(cur && !cur.topic){
      cur.topic=name;
      cur.topicCode=code;
    }
  }
  topics = typeof normalizeTopicList==='function' ? normalizeTopicList(topics, qs) : topics;
  saveLS();
  renderSidebar();
  renderEditor();
  renderPaper();
  openTopicManager(name);
}

function openTopicManager(editName=''){
  topics = typeof normalizeTopicList==='function' ? normalizeTopicList(topics, qs) : (Array.isArray(topics) ? topics : []);
  const editTopic = topics.find(t=>String(t.name || t)===editName) || {name:'',code:''};
  const rows = topics.length ? topics.map(t=>{
    const tName=typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(t.name || t) : String(t.name || t || '').trim();
    const tCode=typeof topicCodeFromName==='function' ? topicCodeFromName(t.code || tName) : String(t.code || tName || '').trim();
    const count=qs.filter(q=>(typeof normalizeQuestionTopic==='function' ? normalizeQuestionTopic(q.topic) : String(q.topic || '').trim())===tName).length;
    return `
      <div class="subject-item">
        <div class="subject-meta">
          <div class="subject-name">${escH(tName)}</div>
          <div class="subject-sub">Code: ${escH(tCode || '-')} &nbsp;·&nbsp; Questions: ${count}</div>
        </div>
        <div class="subject-actions">
          <button class="btn" type="button" onclick="openTopicManager('${escA(tName)}')">Edit</button>
          <button class="btn del" type="button" onclick="deleteTopicFlow('${escA(tName)}')">Delete</button>
        </div>
      </div>
    `;
  }).join('') : '<div class="modal-note">No topics yet. Add the first topic below.</div>';
  openModal({
    title:'Topic Manager',
    subtitle:'Add, edit, or delete bank topics used for server-side paper generation.',
    closable:true,
    body:`
      <div class="project-list">${rows}</div>
      <div class="modal-grid">
        <div class="field">
          <label>Topic Name</label>
          <input id="topicNameInput" type="text" value="${escA(editTopic.name || '')}" placeholder="e.g. Analog Circuits">
        </div>
        <div class="field">
          <label>Topic Code</label>
          <input id="topicCodeInput" type="text" value="${escA(editTopic.code || '')}" placeholder="Auto from name if blank">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn pri" type="button" onclick="saveTopicFromModal('${escA(editName||'')}')">${editName?'Save Changes':'Add Topic'}</button>
        ${editName?`<button class="btn" type="button" onclick="openTopicManager()">New Entry</button>`:''}
        <button class="btn" type="button" onclick="closeModal()">Close</button>
      </div>
    `
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

