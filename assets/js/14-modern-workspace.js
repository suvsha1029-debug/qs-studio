// Responsive workspace navigation and compact UI status synchronization.
(function(){
  const validViews=new Set(['questions','editor','actions']);
  const compactQuery=window.matchMedia('(max-width:1080px)');

  function panelFor(view){
    return document.querySelector(`[data-workspace-panel="${view}"]`);
  }

  window.setWorkspaceView=function(view,options={}){
    const normalized=view==='preview' ? 'actions' : view;
    const next=validViews.has(normalized) ? normalized : 'questions';
    document.body.dataset.workspaceView=next;
    document.querySelectorAll('[data-workspace-view-button]').forEach(button=>{
      const active=button.dataset.workspaceViewButton===next;
      button.setAttribute('aria-pressed',active?'true':'false');
      button.classList.toggle('active',active);
    });
    if(options.focus && compactQuery.matches){
      requestAnimationFrame(()=>{
        const panel=panelFor(next);
        const target=panel?.querySelector('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)');
        target?.focus({preventScroll:true});
      });
    }
  };

  window.scrollExportControls=function(){
    setWorkspaceView('actions');
    requestAnimationFrame(()=>document.getElementById('exportHub')?.scrollIntoView({behavior:'smooth',block:'nearest'}));
  };

  function syncWorkspaceStatus(){
    const paperTitle=document.getElementById('paperTitle')?.textContent?.trim()||'Untitled Project';
    const activeId=document.querySelector('.qs-item.active .qi-id')?.textContent?.trim()||'';
    const count=document.getElementById('qcount')?.textContent?.trim()||'0';
    const project=document.getElementById('workspaceProjectTitle');
    const status=document.getElementById('workspaceQuestionStatus');
    const editorStatus=document.getElementById('editorQuestionStatus');
    if(project) project.textContent=paperTitle;
    if(status) status.textContent=activeId ? `${activeId} · ${count} total` : `${count} questions`;
    if(editorStatus) editorStatus.textContent=activeId || 'No question selected';
  }

  function syncCompactState(){
    document.body.classList.toggle('workspace-compact',compactQuery.matches);
    if(compactQuery.matches && !validViews.has(document.body.dataset.workspaceView)) setWorkspaceView('questions');
  }

  function initModernWorkspace(){
    setWorkspaceView(document.body.dataset.workspaceView||'questions');
    syncCompactState();
    syncWorkspaceStatus();
    const observer=new MutationObserver(syncWorkspaceStatus);
    ['paperTitle','qcount','qsList','editor'].forEach(id=>{
      const element=document.getElementById(id);
      if(element) observer.observe(element,{childList:true,subtree:true,characterData:true});
    });
    if(typeof compactQuery.addEventListener==='function') compactQuery.addEventListener('change',syncCompactState);
    else compactQuery.addListener(syncCompactState);
  }

  document.addEventListener('keydown',event=>{
    if(!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const view={Digit1:'questions',Digit2:'editor',Digit3:'actions'}[event.code];
    if(!view) return;
    event.preventDefault();
    setWorkspaceView(view,{focus:true});
  });

  const baseLoadQuestion=window.loadQ;
  if(typeof baseLoadQuestion==='function'){
    window.loadQ=async function(){
      if(compactQuery.matches) setWorkspaceView('editor');
      return baseLoadQuestion.apply(this,arguments);
    };
    try{ loadQ=window.loadQ; }catch(_){ }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initModernWorkspace,{once:true});
  else initModernWorkspace();
})();
