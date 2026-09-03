//  INIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
(async function initializeQsStudio(){
  const token=typeof beginPaperPreparation==='function'
    ? beginPaperPreparation({
        reason:'startup',
        title:'Preparing QS Studio',
        detail:'Loading the paper engine, fonts, equations, and canvas resources...'
      })
    : null;
  try{
    setAppTheme();
    if(typeof bootstrapProjectState === 'function'){
      const result=bootstrapProjectState({preparationToken:token});
      if(result?.then) await result;
      else if(typeof preparePaperWorkspace==='function') await preparePaperWorkspace({token,reason:'startup'});
    }else{
      renderSidebar();
      renderEditor();
      renderPaper(true);
      if(typeof preparePaperWorkspace==='function') await preparePaperWorkspace({token,reason:'startup'});
    }
  }catch(err){
    console.error('QS Studio startup preparation failed:',err);
    if(token && typeof finishPaperPreparation==='function') await finishPaperPreparation(token,{timedOut:true,failed:1,reason:'startup-error'});
  }
})();

