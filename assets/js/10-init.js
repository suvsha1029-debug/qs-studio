//  INIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
setAppTheme(localStorage.getItem(APP_THEME_KEY) || 'normal');
if(typeof bootstrapProjectState === 'function'){
  bootstrapProjectState();
}else{
  renderSidebar();
  renderEditor();
  renderPaper();
}



