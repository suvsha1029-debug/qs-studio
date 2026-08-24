const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const readOptional = file => {
  const absolute = path.join(root, file);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, 'utf8') : null;
};

const baseCss = read('assets/css/00-base.css');
const componentCss = read('assets/css/02-components.css');
const canvas = read('assets/js/04-canvas-engine.js');
const exportJs = read('assets/js/08-export.js');
const circuitJs = read('assets/js/12-circuit-editor.js');
const html = read('qs_studio.html');
const svgMaker = read('svg_symbol_maker.html');
const sheetPipeline = read('pdf_sheet_template_pipeline.html');
const desktopHtml = readOptional('desktop-electron/dist/win-unpacked/resources/studio/qs_studio.html');
const desktopCanvas = readOptional('desktop-electron/dist/win-unpacked/resources/studio/assets/js/04-canvas-engine.js');
const desktopExport = readOptional('desktop-electron/dist/win-unpacked/resources/studio/assets/js/08-export.js');
const desktopSheetPipeline = readOptional('desktop-electron/dist/win-unpacked/resources/studio/pdf_sheet_template_pipeline.html');
const hasDesktopPackage = [desktopHtml, desktopCanvas, desktopExport, desktopSheetPipeline].every(value => value !== null);

const checks = [];
function check(name, condition, detail = '') {
  checks.push({ name, ok: !!condition, detail });
}

function includesAll(text, snippets) {
  return snippets.every(snippet => text.includes(snippet));
}

function functionBody(text, name) {
  const start = text.indexOf(`function ${name}`);
  if (start < 0) return '';
  const brace = text.indexOf('{', start);
  if (brace < 0) return '';
  let depth = 0;
  for (let i = brace; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return '';
}

check(
  'selectable inline math preserves prose after subscript/superscript',
  includesAll(canvas, [
    'function isKatexMathFollowerGroup',
    "if(/[([{]/.test(text[pos]||'') && !isKatexMathFollowerGroup(text,pos)) return gapStart;",
    "if(next===pos) return gapStart;"
  ])
);

check(
  'selectable inline math accepts nested braced exponent expressions',
  canvas.includes("if(/[A-Za-z0-9)\\]\\}]\\s*[_^]\\s*(?:\\{|\\\\|[A-Za-z0-9+\\-=()])/.test(raw)) return true;"),
  'e^{-j\\frac{2\\pi}{8}nk} must render as one KaTeX atom, not raw e^ prose'
);

check(
  'mod operator no longer matches ordinary words like modulation',
  canvas.includes("text=prefixCommand(text, ['mod'], '\\\\s*(?:\\\\{|\\\\(|_|\\\\\\\\|$)');") &&
    !canvas.includes("['ln','log','sin','cos','tan','cot','sec','csc','sinh','cosh','tanh','exp','mod','det','min','max']")
);

check(
  'selectable preview preserves blank lines and visible line rows',
  includesAll(canvas, [
    "raw.split('\\n').map(line=>{",
    "lp-text-line lp-blank-line",
    "formatLinkedPreviewInlineTextHTML(line)"
  ])
);

check(
  'PDF source extraction preserves repeated line breaks',
  includesAll(functionBody(canvas, 'extractPdfTextFromComposerNode'), [
    'const newline=()=>{ lines.push([]); };',
    ".join('\\n').replace(/[\\u200B\\u2060]/g,'').replace(/\\n+$/,'')"
  ]) &&
    !functionBody(canvas, 'extractPdfTextFromComposerNode').includes(".replace(/\\n{3,}/g,'\\n\\n').trim()")
);

check(
  'visual bar shortcuts normalize for canvas and selectable math',
  includesAll(canvas, [
    'function repairComposerVisualAccentShortcuts',
    'function repairSelectableVisualAccentShortcuts',
    'function splitComposerVisualAccentText',
    "splitComposerVisualAccentText(part).forEach(seg=>",
    ".replace(/(^|[^\\\\A-Za-z])([A-Za-z])(?:_bar|_overline)\\b/g, '$1\\\\bar{$2}')",
    ".replace(/(^|[^\\\\A-Za-z])([A-Za-z])(?:_hat)\\b/g, '$1\\\\hat{$2}')",
    ".replace(/(^|[^\\\\A-Za-z])([A-Za-z])(?:_vec|_vector)\\b/g, '$1\\\\vec{$2}')",
    ".replace(/([A-Za-z])\\u0304/g, '\\\\bar{$1}')",
    'repairBareSelectableLatexCommands(repairSelectableVisualAccentShortcuts(',
    "structure:'visualEquation',preset:'y_bar'",
    "structure:'visualEquation',preset:'A_bar'"
  ]) &&
    !canvas.includes('(?:_?hat)') &&
    !canvas.includes('(?:_?bar|_?overline)') &&
    !canvas.includes('(?:_?vec|_?vector)'),
  'accent shortcuts must require underscores so words like that/That stay prose'
);

check(
  'composer visual equation box renders through shared equation path',
  includesAll(canvas, [
    "structure:'visualEquation'",
    "structure:'visualEquation',preset:'x^n'",
    "structure:'visualEquation',preset:'x_n'",
    "structure:'visualEquation',preset:'x_i^n'",
    "structure:'visualEquation',preset:'x_bar'",
    "insertInlineStructureWidget('${escA(item.structure)}','${escA(item.preset||'')}')",
    "kind==='visualEquation'",
    'placeholder="x_bar, A^2, y_i"',
    "if(kind==='visualEquation') return preset || 'x_bar';",
    "if(kind==='visualEquation') return 'x_bar';",
    "const visualExpr=normalizeComposerPastedLatexExpression(expr);",
    "return composerExprToLatex(visualExpr) || 'x';",
    "return renderLinkedPreviewMathValue(normalizeComposerPastedLatexExpression(expr));"
  ]),
  'visual equation box support is missing or not routed through shared equation rendering'
);

check(
  'selectable fallback accents are centered above the symbol',
  includesAll(canvas, [
    '.pdf-linked-preview .lp-accent{position:relative;display:inline-block',
    '.pdf-linked-preview .lp-accent-mark{position:absolute;left:50%;top:-.18em;transform:translateX(-50%)',
    "out+='<span class=\"lp-accent lp-accent-'+command+'\">'+(mark?'<span class=\"lp-accent-mark\">'+mark+'</span>':'')+'<span class=\"lp-accent-body\">'+inner+'</span></span>';",
    "? '<span class=\"lp-accent lp-accent-bar\"><span class=\"lp-accent-body\">'+inner+'</span></span>'"
  ]),
  'bar/hat/vector fallback accents must be centered, not appended as trailing superscripts'
);

check(
  'composer paste supports isolated raw LaTeX equation boxes',
  includesAll(canvas, [
    'function stripComposerLatexDelimiters',
    'function isClearComposerLatexExpression',
    'function normalizeComposerPastedLatexExpression',
    'function insertLatexEquationIntoMixedComposer',
    "insertInlineStructureWidget('visualEquation', latex, {forceEditor:true});",
    "insertIntoFocusedFractionInput(isClearComposerLatexExpression(text) ? normalizeComposerPastedLatexExpression(text) : text);",
    'if(isClearComposerLatexExpression(part.trim()))',
    'return renderLinkedPreviewMathValue(normalizeComposerPastedLatexExpression(expr));',
    'const visualExpr=normalizeComposerPastedLatexExpression(expr);'
  ]),
  'raw LaTeX paste must remain isolated and render through visual equation boxes'
);

check(
  'canvas composer gives all nested equation assets generous breathing space',
  includesAll(canvas, [
    'function getComposerLatexTallness',
    'function getComposerLatexFractionDepth',
    'const rootCount=(source.match(/\\\\sqrt',
    'const scriptCount=(source.match(/[_^]\\s*(?:\\{|\\\\|[A-Za-z0-9+\\-=()])/g)||[]).length;',
    'const bigOpScriptCount=(source.match(/\\\\(?:sum|prod|coprod|int|iint|iiint|oint|lim)\\b(?:\\s*[_^]\\s*(?:\\{|\\\\|[A-Za-z0-9+\\-=()]))+/g)||[]).length;',
    'const complexScriptCount=(source.match(/[_^]\\s*\\{[^{}]*(?:\\\\(?:frac|dfrac|tfrac|sqrt|sum|prod|int|iint|iiint|oint|lim|left|right)|[{}])[\\s\\S]*?\\}/g)||[]).length;',
    'function getComposerEquationVerticalPadding',
    'if(tall.rootCount>0) multiplier+=Math.min(.36, tall.rootCount*.14);',
    'if(tall.bigOpCount>0) multiplier+=Math.min(.44, tall.bigOpCount*.16);',
    'if(tall.complexScriptCount>0) multiplier+=Math.min(.54, tall.complexScriptCount*.28);',
    'const minNested=tall.fracDepth>1 ? Math.round(mathSize*3.25) : base;',
    'const minComplex=(tall.fracCount || tall.rootCount || tall.bigOpCount || tall.bigDelimiterCount || tall.complexScriptCount)',
    'const verticalPad=getComposerEquationVerticalPadding(activeComposerRenderKey, preparedLatex, targetH);',
    'const assetH=mathH + verticalPad*2;',
    'eqCtx.drawImage(rawImg, 0, verticalPad*2, eqCanvas.width, mathH*2);'
  ]),
  'nested fractions, roots, integrals, sums, limits, and complex exponents must not be compressed on canvas'
);

check(
  'simple visual equation atoms stay compact instead of display-sized',
  includesAll(canvas, [
    'function isComposerCompactInlineLatex',
    "out='\\\\textstyle '+out;",
    "if(isComposerCompactInlineLatex(latex)) return Math.max(18, Math.min(46, Math.round(mathSize*1.28)));",
    "if(isComposerCompactInlineLatex(latex)) return Math.max(2, Math.round(targetHeight*.045));",
    "if(/^\\\\(?:bar|overline|hat|vec|dot|ddot|tilde|overrightarrow|overleftarrow)\\s*\\{[^{}\\n]{1,18}\\}$/.test(source))"
  ]),
  'x_bar/X_bar/y_bar and simple root/script atoms must not inflate like full display equations'
);

check(
  'composer apply crops empty horizontal surface space without removing vertical layout',
  includesAll(canvas, [
    'function getComposerApplySourceScale',
    'function getComposerSurfaceHorizontalInkCrop',
    'function prepareComposerSurfaceForCanvasApply',
    'return { source:canvas, sx, sy:0, sw:Math.max(1,right-sx), sh:height, scale };',
    'const preparedSource=prepareComposerSurfaceForCanvasApply(source, key);',
    'const srcW=preparedSource.logicalWidth||Math.max(200, cv.width-pad*2);',
    'const srcH=preparedSource.logicalHeight||baseHeight;',
    'preparedSource.source,',
    'preparedSource.sx,',
    'preparedSource.sy,',
    'preparedSource.sw,',
    'preparedSource.sh,'
  ]),
  'applying a composer preview must not scale the whole blank composer sheet and shrink nested equations'
);

check(
  'question canvas source sync uses the same prepared composer surface path',
  includesAll(canvas, [
    'async function composeSourceSurfaceWithCanvasFigures',
    "const preparedSource=(typeof prepareComposerSurfaceForCanvasApply==='function')",
    'const srcW=preparedSource.logicalWidth||Math.max(200, cv.width-pad*2);',
    'const srcH=preparedSource.logicalHeight||getBaseCanvasHeight(key);',
    'preparedSource.source,',
    'preparedSource.sx,',
    'preparedSource.sy,',
    'preparedSource.sw,',
    'preparedSource.sh,'
  ]),
  'source-backed question canvas/export path must not re-scale the raw full composer surface'
);

check(
  'source composer frames do not fall back to stale bitmap canvas export',
  includesAll(canvas, [
    "console.warn('Source composer export sync failed; keeping source frame instead of bitmap fallback:', key, err);",
    'if(!allowBitmapFallback || composerHtml) return;'
  ])
);

check(
  'replacing a figure clears stale burned/vector duplicates',
  includesAll(canvas, [
    'function removeBurnedFiguresMatchingLiveFigure',
    'figuresSharePlacement(previous,liveFigure) || figuresMeaningfullyOverlap(previous,liveFigure)',
    'removeBurnedFiguresMatchingLiveFigure(key, prev);',
    'removeBurnedFiguresMatchingLiveFigure(key, fig);'
  ]) &&
    includesAll(exportJs, [
      'function getUniquePdfVectorFigures',
      'pdfFiguresSharePlacement(prev,fig) || pdfFiguresOverlapMeaningfully(prev,fig)',
      'getUniquePdfVectorFigures(figures).forEach(fig=>'
    ]),
  'simple PDF export must not draw both old and replacement vector figures'
);

check(
  'composer and shell UI expose stable grouped actions',
  includesAll(canvas, [
    'mixed-composer-actions',
    'composer-apply-btn',
    'id="mixedComposerApplyTopBtn"',
    'id="mixedComposerApplyBtn"'
  ]) &&
    includesAll(html, [
      'strip-actions',
      'btn-open',
      'btn-save-all',
      'Save All'
    ]),
  'Open/Save and composer action controls must keep their grouped UI hooks'
);

check(
  'composer actions use Apply-first vertical list without selector overlap',
  includesAll(componentCss, [
    '.modal-close{width:30px!important;height:30px!important;border-radius:2px!important',
    '.mixed-composer-actions{display:flex!important;flex-direction:column!important',
    'flex:0 0 92px!important;width:92px!important',
    '.mixed-composer-actions .btn{width:92px!important;min-width:92px!important;height:28px!important',
    '.composer-apply-btn{order:-3;',
    '@media (max-width:1420px)'
  ]) &&
    componentCss.lastIndexOf('.mixed-composer-actions{display:flex!important;flex-direction:column!important') >
      componentCss.lastIndexOf('/* Final arctic official UI override - keep this last. */'),
  'composer actions must stay as an Apply-first vertical list'
);

check(
  'arctic square UI skin is applied after legacy component rules',
  includesAll(baseCss, [
    '--bg:#233f6f',
    '--accent:#004b7a',
    "--display:'Georgia','Times New Roman',serif"
  ]) &&
    componentCss.lastIndexOf('/* Final arctic official UI override - keep this last. */') > componentCss.lastIndexOf('.paper-lazy-img') &&
    includesAll(componentCss, [
      '.btn,.tool-btn,.mb,.field input,.field select,.field textarea,.canvas-textbox textarea,.matrix-size-picker input{border-color:#174b7c;border-radius:3px',
      '.mixed-composer-editor{border-color:#174b7c}',
      '.canvas-wrap{border-color:#174b7c',
      '.strip{background:linear-gradient(180deg,#1f3f70 0%,#142f59 100%)',
      '.mixed-composer-toolbar .btn:hover,.mixed-composer-toolbar .tool-btn:hover,.composer-eq-btn:hover{transform:none;box-shadow:none;background:#eef6fb}'
    ]),
  'official arctic square skin must remain the final component override'
);

check(
  'composer apply button shows a blocking spinner while rendering',
  includesAll(canvas, [
    'const setApplyBusy=(busy)=>',
    "btn.classList.toggle('is-applying', !!busy);",
    "btn.textContent=busy ? 'Applying...' : btn.dataset.idleText;",
    'setApplyBusy(true);',
    'setApplyBusy(false);'
  ]) &&
    includesAll(componentCss, [
      '.composer-apply-btn.is-applying::before',
      'animation:composerApplySpin .75s linear infinite',
      '@keyframes composerApplySpin'
    ]),
  'composer Apply To Frame must visibly buffer during render'
);

check(
  'exam UI wording is generic and circuit figure panel is not mojibake',
  canvas.includes('exam-paper text/equation print') &&
    circuitJs.includes("title:'Circuit Figure Panel'") &&
    circuitJs.includes("b.textContent='Circuit Fig'") &&
    !circuitJs.includes("b.textContent='â") &&
    !circuitJs.includes('Place components â'),
  'visible UI should avoid exam-specific branding and mojibake circuit labels'
);

check(
  'selectable PDF uses real page margins on every page',
  exportJs.includes('@page{size:A4;margin:${pageCssMargin}}') &&
    exportJs.includes('const pageMarginTop=useSheetLayout') &&
    exportJs.includes('const pageCssMargin=useSheetLayout') &&
    exportJs.includes('body{padding:0}')
);

check(
  'cleantheam exists as a separate export mode',
  html.includes("askWatermarkThen('selectable-clean')") &&
    canvas.includes("theme:kind==='selectable-clean'?'cleantheam':'boxed'") &&
    exportJs.includes("cleanTheme=theme==='cleantheam'")
);

check(
  'cleantheam does not print NAT Answer blank',
  exportJs.includes("? (cleanTheme ? '' : '<div class=\"selectable-nat-answer\"><strong>Answer:</strong><span></span></div>')")
);

check(
  'question packing avoids splitting whole questions where possible',
  includesAll(exportJs, [
    'break-inside:avoid;page-break-inside:avoid',
    '.selectable-question{break-inside:avoid',
    '.selectable-option{break-inside:avoid;page-break-inside:avoid}'
  ])
);

check(
  'sheet template layers are print-stable on every page',
  includesAll(exportJs, [
    'const sheetTemplateSourceLayers=Array.isArray(settings?.sheetTemplateLayers)',
    'const whiteLabelLayers=sheetTemplateSourceLayers',
    'function makeSelectableSheetTemplateSvgSrc',
    'async function makeSelectableSheetTemplateRasterSrc',
    'function trimSelectableSheetCanvas',
    'async function makeSelectableSheetTemplateLayerImages',
    'canvas.toDataURL(\'image/png\', .96)',
    'sheetTemplateLayerImages',
    'sheetTemplateRaster',
    'await makeSelectableSheetTemplateLayerImages(sheetLayers, 2)',
    'await makeSelectableSheetTemplateRasterSrc(sheetLayers, 1.5)',
    'function escapeSelectableCssUrl',
    'layer.svg || layer.image',
    'layer.text || layer.svgSrc || layer.svg || layer.image',
    'function reinforceSelectableSheetCanvas',
    "reinforceSelectableSheetCanvas(canvas, layer.strength)",
    'ctx.rect(0,0,w,boxH)',
    'const startY=Math.max(0, (boxH-blockH)/2)',
    'const h=(Math.max(1, Math.min(220, +(layer.heightPct',
    "const par=(type==='svg' && +(layer.widthPct ?? 0) >= 90 && +(layer.heightPct ?? 0) >= 90) ? 'xMidYMid meet' : 'xMinYMin meet';",
    'selectable-sheet-layout',
    'selectable-sheet-page',
    'const estimateSheetQuestionHeightMm=(html)=>',
    'const buildSheetPages=(entries)=>',
    'const sheetBottomLayers=whiteLabelLayers.filter',
    'const pageNumberBottomMm=sheetBottomLayers.length ? 18 : 6',
    'const bottomAssetTops=sheetBottomLayers',
    'const contentBottomLimitMm=Math.min(297-pageMarginBottom-18',
    'const wouldLeaveUnsafeTail=page.length && (maxContentMm-nextUsed)<12',
    'buildSheetPages(orderedKeys.flatMap(sectionKey=>getPdfOrderedEntries(grouped.get(sectionKey), publishing)))',
    '<div class="selectable-page-number">Page ${pageIdx+1} / ${totalPages}</div>',
    '.selectable-page-number{position:absolute;left:0;right:0;bottom:${pageNumberBottomMm}mm;text-align:center',
    '.selectable-sheet-layout body{width:210mm;margin:0}',
    'const sheetContentBottomPad=useSheetLayout ? pageMarginBottom+18 : pageMarginBottom',
    '.selectable-sheet-page{position:relative;width:210mm;height:297mm;padding:${pageMarginTop}mm ${pageMarginRight}mm ${sheetContentBottomPad}mm ${pageMarginLeft}mm;overflow:hidden',
    'const sheetTemplateLayerImages=Array.isArray(settings?.sheetTemplateLayerImages)',
    'const sheetLayerImages=useSheetLayout && sheetTemplateLayerImages.length',
    '<img class="selectable-sheet-template-layer"',
    'const sheetBackground=useSheetLayout && whiteLabelLayers.length',
    '<div class="selectable-sheet-template-bg"',
    'background-image:var(--sheet-bg)',
    'background-size:210mm 297mm',
    'z-index:4;pointer-events:none;user-select:none;-webkit-user-select:none;background-image:var(--sheet-bg)',
    'const whiteLabel=useSheetLayout ? \'\' : whiteLabelLayers.map',
    '.selectable-sheet-template-bg{position:fixed',
    'left:${sheetBgLeft}mm;top:${sheetBgTop}mm;width:210mm;height:297mm',
    '.selectable-sheet-template-layer{position:fixed',
    '.selectable-white-label-layer{position:fixed',
    '.selectable-sheet-template-bg,.selectable-sheet-template-layer,.selectable-white-label-layer,.selectable-image-watermark,.selectable-vector-watermark,.selectable-text-watermark{position:fixed!important',
    '-webkit-print-color-adjust:exact;print-color-adjust:exact',
    'await Promise.all(images.map(img=>'
  ])
);

check(
  'SVG maker exports sharp arrowheads consistently',
  svgMaker.includes('viewBox="0 0 18 12" refX="17.2" refY="6" markerWidth="6" markerHeight="5.5"') &&
    svgMaker.includes('M0 .8L18 6L0 11.2L5.2 6Z') &&
    !svgMaker.includes('viewBox="0 0 12 12" refX="11" refY="6" markerWidth="4" markerHeight="4"'),
  'SVG maker arrow marker reverted to blunt head'
);

check(
  'SVG maker has native logic-gate presets and external SVG import',
  includesAll(svgMaker, [
    'id="logicGateSelect"',
    'insertLogicGatePreset',
    'logicGatePresetElements',
    'id="svgImportFile"',
    'importSvgFile',
    'parsedSvgItemsFromMarkup',
    'embeddedSvgExportMarkup',
    "type:'embeddedSvg'",
    "type:'path'"
  ]),
  'SVG maker lost logic-gate preset or external SVG import support'
);

check(
  'SVG maker exports stroke, font, and component dimensions as preserved metadata',
  includesAll(svgMaker, [
    'function exportStyleManifest',
    "schema:'qs-studio-style-preservation/v1'",
    'data-qs-preserve-styles="1"',
    'id="qs-style-manifest"',
    'strokeWidth:+item.sw||0',
    'fontSize:+item.fs||undefined',
    'componentDimensionsPreserved:true',
    'preserveElementStyles:true',
    'styleManifest,anchorMode'
  ]),
  'SVG maker style preservation manifest missing'
);

check(
  'SVG maker and circuit editor trim imported figure whitespace',
  includesAll(svgMaker, [
    'const pad=10;',
    'const dx=pad-raw.x;',
    'const dy=pad-raw.y;',
    'function svgEstimatedVisualBoxFromMarkup',
    'function cropSvgMarkupToVisualBox',
    'Complex SVG imported as a preserved vector group with tight visual bounds.'
  ]) &&
    includesAll(circuitJs, [
      'let detectedSvgPaint=false',
      'if(!detectedSvgPaint && source?.viewBox)',
      'const vx=x0-PAD;',
      'const vy=y0-PAD;'
    ]) &&
    !circuitJs.includes('Math.min(0,x0-PAD)') &&
    !circuitJs.includes('Math.min(0,y0-PAD)'),
  'Imported SVG/circuit figures can regain centered whitespace or full-viewBox export'
);

check(
  'plain imported canvas figures are trimmed before storage',
  includesAll(canvas, [
    'async function trimPlainPlacedImageWhitespace',
    'if(/^data:image\\/svg\\+xml/i.test(src) || String(figureMetadata?.sourceSvg||\'\').trim()) return null;',
    'if(keepRatio>.94) return null;',
    'const trimmed=await trimPlainPlacedImageWhitespace(img, box, figureMetadata);',
    'const figSrc=trimmed?.src || img.src;',
    'fig.sourceTrim=trimmed.trim;',
    'fig.displayWidth=finalDrawW;',
    'fig.displayHeight=finalDrawH;'
  ]),
  'plain imported figures can carry hidden white margins into canvas/selectable/PDF exports'
);

check(
  'selectable figure markers use compact flow layers while overlays keep coordinates',
  includesAll(canvas, [
    'function buildSelectableCanvasFigureStack',
    'flowHtml:\'<span class="lp-canvas-figures lp-canvas-figures-flow">',
    'const flowNormalized=normalized.map(item=>({...item,left:item.left-flowLeft,top:item.top-flowTop}));',
    'markerTest.test(part) ? figureLayer.flowHtml : formatLinkedPreviewTextHTML(part)'
  ]) &&
    includesAll(exportJs, [
      'function buildSelectablePaperFigureStack',
      'flowHtml:buildSelectablePaperFigureStack(flowNormalized, flowW, flowH)',
      'const flowNormalized=normalized.map(item=>({...item,x:item.x-flowX,y:item.y-flowY}));',
      'return figureLayer.flowHtml || figureLayer.html;'
    ]),
  'selectable PDF figure markers can reserve canvas-origin whitespace or drift from preview'
);

check(
  'Circuit editor preserves imported SVG maker widths and styles',
  includesAll(circuitJs, [
    'function _cCustomStrokeWidth',
    'raw.sw ?? raw.strokeWidth ?? raw.style?.strokeWidth',
    'sw:_cCustomStrokeWidth(raw,2)',
    'strokeWidth:_cCustomStrokeWidth(raw,2)',
    "type==='embeddedSvg'",
    'function _cCustomReadStyleManifestFromSvg',
    "schema==='qs-studio-style-preservation/v1'",
    'const styleManifest=payload.styleManifest||_cCustomReadStyleManifestFromSvg',
    'styleManifest,componentDefaults',
    'let detectedSvgPaint=false',
    'if(!detectedSvgPaint && source?.viewBox)',
    'const vx=x0-PAD;',
    'const vy=y0-PAD;'
  ]) &&
    !circuitJs.includes('Math.min(0,x0-PAD)') &&
    !circuitJs.includes('Math.min(0,y0-PAD)'),
  'Circuit editor no longer preserves SVG maker style contract'
);

check(
  'white-label layers use top-left coordinates, not center reinterpretation',
  includesAll(canvas, [
    "node.style.transform=`rotate(${layer.angle || 0}deg)`;",
    "node.style.transformOrigin='0 0';",
    'const startLayerX=+(layer.xPct ?? 0);',
    'const startLayerY=+(layer.yPct ?? 0);',
    `doc.addImage(image, /^data:image\\/jpe?g/i.test(image)?'JPEG':'PNG', x, y, fitted.w, fitted.h`
  ]) &&
    exportJs.includes('transform:rotate(var(--wl-a,0deg));transform-origin:0 0') &&
    !exportJs.includes('.selectable-white-label-layer{position:fixed;left:var(--wl-x,50%);top:var(--wl-y,50%);transform:translate(-50%,-50%)'),
  'white-label export must preserve designer top-left placement'
);

check(
  'SVG white-label layers retain raster fallback for jsPDF exports',
  exportJs.includes("return svg ? {...base,svg,svgSrc,image:/^data:image\\//i.test(image) ? image : ''} : null;") &&
    exportJs.includes('svgTextToDataUrl(svg)') &&
    exportJs.includes('<img class="selectable-white-label-layer selectable-white-label-asset"') &&
    canvas.includes(`const layer={id:newPdfWatermarkLayerId(),type:svg?'svg':'image',svg,image`),
  'SVG layer image fallback missing'
);

check(
  'clean selectable export uses only white-label designer layers for branding',
  exportJs.includes("const header='';") &&
    exportJs.includes("const footer='';") &&
    !exportJs.includes('selectable-clean-header') &&
    !exportJs.includes('selectable-clean-logo') &&
    !exportJs.includes('selectable-clean-footer')
);

check(
  'jsPDF exports apply white-label layers to all pages',
  includesAll(canvas, [
    'layers.forEach(layer=>drawPdfWhiteLabelLayer(doc, pageW, pageH, layer, pageNo, totalPages));',
    'for(let i=1;i<=total;i++){',
    'drawPdfWatermark(doc, pageW, pageH, watermark, i, total);'
  ]) &&
    includesAll(exportJs, [
      'const sheetTemplateBaseLayers=useSheetLayout ? sheetTemplateLayers.filter(layer=>!isSheetTemplatePageNumberLayer(layer)) : [];',
      'const sheetTemplateTokenLayers=useSheetLayout ? sheetTemplateLayers.filter(isSheetTemplatePageNumberLayer) : [];',
      'function drawSheetTemplateBaseLayers()',
      'if(useSheetLayout) drawSheetTemplateTokenLayers();',
      'else applyPdfWatermarkToAllPages(doc, PAGE_W, PAGE_H, watermark);'
    ])
);

check(
  'sheet template text layers are burned into selectable export assets',
  includesAll(exportJs, [
    'function makeSelectableSheetTextSvgSrc',
    'function makeSelectableSheetTemplateSvgSrc',
    'async function makeSelectableSheetTemplateLayerImages',
    'selectable-sheet-template-layer',
    'selectable-white-label-text-asset',
    'data:image/svg+xml;charset=utf-8,',
    'src="${escapeSelectablePaperHTML(textSvg.src)}"'
  ])
);

check(
  'sheet template designer has center align and resize tools',
  includesAll(canvas, [
    'function alignPdfWatermarkSelectedLayer',
    'function resizePdfWatermarkSelectedLayer',
    "alignPdfWatermarkSelectedLayer('centerBoth')",
    "resizePdfWatermarkSelectedLayer('fitWide')",
    'wmAlignMarginInput',
    'Math.min(220, +(layer.widthPct ?? 40))'
  ]) &&
    exportJs.includes('Math.min(220, +(layer.widthPct ?? 40))') &&
    exportJs.includes('max-width:220vw'),
  'sheet template align/resize controls or export size cap missing'
);

check(
  'standalone sheet template pipeline is embedded as a first-class export path',
  html.includes('openQsSheetTemplatePipeline()') &&
    exportJs.includes('async function openQsSheetTemplatePipeline()') &&
    exportJs.includes('pdf_sheet_template_pipeline.html?mode=template&ts=') &&
    exportJs.includes('sheetPipelineBase') &&
    exportJs.includes("return doc.output('arraybuffer');") &&
    sheetPipeline.includes('qs-sheet-template-load-pdf') &&
    sheetPipeline.includes('async function loadPdfArrayBuffer') &&
    sheetPipeline.includes('Apply to all pages & download'),
  'sheet template pipeline handoff missing'
);

check(
  'sheet template pipeline supports burned image watermarks and layer strength',
  includesAll(sheetPipeline, [
    'watermarkImageInput',
    'Watermark image',
    'state.watermarkImageDataUrl',
    'watermarkImageDataUrl: state.watermarkImageDataUrl',
    "makeOverlay('image'",
    "item.kind === 'image'",
    'async function rasterImageToPng',
    'function reinforceCanvasAlpha',
    'watermarkImageStrength',
    'svgStrength'
  ]) &&
    includesAll(canvas, [
      'const watermarkImage=String(assets.watermarkImageDataUrl',
      "kind==='image'",
      'strength:Math.max(1, Math.min(4'
    ]) &&
    includesAll(exportJs, [
      'strength:Math.max(1, Math.min(4',
      'function reinforceSelectableSheetCanvas',
      'reinforceSelectableSheetCanvas(canvas, layer.strength)'
    ])
);

check(
  'sheet template designer opens blank and does not auto-export current QS paper',
  includesAll(exportJs, [
    'pdf_sheet_template_pipeline.html?mode=template&ts=',
    'Page Layout Designer opened on a blank A4 layout.'
  ]) &&
    !exportJs.includes('Building base QS PDF for sheet template') &&
    !exportJs.includes("if(!qs.length){showNotice('No questions available to export.', 'Page Layout PDF');return;}") &&
    includesAll(sheetPipeline, [
      'Cache-Control',
      "startupParams.get('mode') === 'template'",
      'await startBlankA4Template();',
      'loadedSessionId',
      "type: 'qs-sheet-template-loaded'",
      'state.loadedSessionId === data.sessionId'
    ])
);

check(
  'sheet template pipeline supports blank A4 JSON templates',
  includesAll(sheetPipeline, [
    'Start Blank A4 Layout',
    'Save Layout JSON',
    'Load Layout JSON',
    "schema: 'qs-sheet-template-v1'",
    'async function startBlankA4Template',
    'function getTemplateSnapshot',
    'async function applyTemplateSnapshot',
    'els.saveTemplateJson.addEventListener'
  ])
);

check(
  'sheet template JSON preserves centered auto page numbering',
  includesAll(sheetPipeline, [
    'Auto page number at bottom-center',
    'Bottom margin',
    "const align = 'center'",
    '(state.pageCssW - w) / 2',
    'if (els.pageNumEnable.checked) updatePageNumber();'
  ]) &&
    includesAll(canvas, [
      'controls.pageNumEnable',
      "kind:'pageNumber'",
      'xPct:.4',
      "align:'center'"
    ])
);

check(
  'sheet templates carry printable content margins and fit source PDFs into them',
  includesAll(sheetPipeline, [
    'Printable content area',
    'contentTopPct',
    'fitSourceToContentBox',
    'contentBox: getContentBoxFromControls(items)',
    'if (contentBox.fitSource !== false)',
    'outPage.drawPage(embedded'
  ]) &&
    includesAll(canvas, [
      'let pdfSheetTemplateLayout=null',
      'normalizePdfSheetTemplateLayout(template.contentBox, items)',
      'sheetTemplateLayout=collectPdfSheetTemplateLayout()',
      'sheetTemplateLayout,branding'
    ]) &&
    includesAll(exportJs, [
      'const sheetLayout=watermark?.sheetTemplateLayout || null',
      'const useSheetLayout=!!(sheetTemplateLayers.length && sheetLayout)',
      'if(useSheetLayout) return Math.max(y, SECTION_BODY_TOP)',
      'const pageMarginTop=useSheetLayout'
    ])
);

check(
  'sheet template is a base sheet with crisp content printed above it',
  includesAll(exportJs, [
    'drawSheetTemplateBaseLayers();',
    'let y = drawSectionHeader(grouped.get(orderedSectionKeys[0]).meta, useSheetLayout ? SECTION_BODY_TOP : M);',
    "const z=isTokenLayer ? 8 : Math.min(1, idx);",
    '.selectable-page{position:relative;z-index:3;width:100%}',
    "if(!useSheetLayout && typeof applyPdfPageNumbersToAllPages==='function')"
  ])
);

check(
  'sheet template text boxes preserve width and centered alignment',
  includesAll(canvas, [
    "align:String(item.align || 'center')",
    'const boxW=pageW*(Math.max(1, Math.min(220, +(layer.widthPct ?? 20)))/100)',
    "const align=/^(left|right|center)$/i.test(String(layer.align||''))"
  ]) &&
    includesAll(exportJs, [
      "function makeSelectableSheetTextSvgSrc(text, style={}, boxWidthPx=0, align='center')",
      "align:String(layer.align || 'center')",
      'const width=Math.max(naturalWidth, Math.ceil(+boxWidthPx || 0))',
      'text-anchor="${anchor}"',
      "makeSelectableSheetTextSvgSrc(layer.text, style, boxWidthMm / .2646, layer.align || 'center')"
    ])
);

check(
  'sheet template mode suppresses generated paper headers',
  includesAll(exportJs, [
    "const sectionTitle=useSheetLayout ? '' : escapeSelectablePaperHTML",
    "const sectionInfo=useSheetLayout ? '' : escapeSelectablePaperHTML",
    "const intro=useSheetLayout ? '' : `<div class=\"selectable-section-title\">${sectionTitle}</div><div class=\"selectable-section-summary\">${sectionInfo}</div>`;",
    'return `<section class="selectable-section">${intro}${questions}</section>`;'
  ]),
  'template exports must not overlay generated section headers on top of template header text'
);

check(
  'export modal can import saved sheet template JSON',
  includesAll(canvas, [
    'async function importPdfSheetTemplateJsonFromInput',
    "template?.schema!=='qs-sheet-template-v1'",
    'wmSheetTemplateJsonInput',
    'importPdfSheetTemplateJsonFromInput(this)',
    'Loaded page layout JSON'
  ])
);

check(
  'web PDF export modal is template-only and preserves selectable text route',
  includesAll(canvas, [
    'function openTemplateOnlyPdfExportModal',
    'This is now the only watermark/white-label input in the web export path.',
    'Load Saved Page Layout JSON',
    "${isSelectablePdf ? 'Open' : 'Download'} ${escH(label)}",
    "openTemplateOnlyPdfExportModal(kind);",
    "const job=()=> kind==='key'",
    'exportPaperSelectablePDF(wm)',
    'isSelectablePdf',
    ': exportPaperPDFTextOnly(wm);'
  ]),
  'Text PDF/cleantheam must not be routed through the image-frame Paper PDF exporter'
);

check(
  'minimal template export preserves imported layer coordinates',
  includesAll(canvas, [
    'const frame=document.getElementById(\'wmDesignerPage\');',
    'if(!frame) return;',
    'applyPdfWatermarkControlsToSelected();',
    'const sheetTemplateLayers=pdfWatermarkDesignerLayers.map(layer=>JSON.parse(JSON.stringify(layer)));'
  ]),
  'imported JSON layers must not be rewritten by missing old designer controls'
);

check(
  'print title is intentionally blanked to reduce browser header text',
  exportJs.includes("const title='&#8203;'") &&
    exportJs.includes("printWindow.document.title='\\u200B'")
);

check(
  'equation ink selector changes the final high-DPI equation asset',
  includesAll(canvas, [
    'function applyEquationInkToAssetCanvas',
    'const equationInk=readMixedComposerEquationStroke(activeComposerRenderKey);',
    'applyEquationInkToAssetCanvas(eqCanvas, equationInk, renderProfile);',
    "if(ink==='extra') return { radius:2, strength:.72 };"
  ]) &&
    !canvas.includes('hardenEquationAssetCanvas(eqCanvas'),
  'equation ink must remain equation-only and must not restore destructive posterization'
);

check(
  'equation ink visibly updates editable nested equation controls',
  componentCss.includes('--composer-ui-font-weight:800') &&
    componentCss.includes('font-weight:var(--composer-ui-font-weight,400)!important'),
  'Bold and Extra bold must affect equation glyphs, not only widget borders'
);

check(
  'desktop packaged JS is synced with root JS when present',
  !hasDesktopPackage || (canvas === desktopCanvas && exportJs === desktopExport),
  'desktop JS differs from root JS'
);

const rootCanvasTag = (html.match(/04-canvas-engine\.js\?v=([^"]+)/) || [])[1];
const rootExportTag = (html.match(/08-export\.js\?v=([^"]+)/) || [])[1];
const desktopCanvasTag = desktopHtml ? (desktopHtml.match(/04-canvas-engine\.js\?v=([^"]+)/) || [])[1] : null;
const desktopExportTag = desktopHtml ? (desktopHtml.match(/08-export\.js\?v=([^"]+)/) || [])[1] : null;
check(
  'desktop HTML cache tags match root HTML when present',
  !hasDesktopPackage || (rootCanvasTag === desktopCanvasTag && rootExportTag === desktopExportTag)
);

const failed = checks.filter(item => !item.ok);
for (const item of checks) {
  const status = item.ok ? 'PASS' : 'FAIL';
  console.log(`${status} ${item.name}${item.detail && !item.ok ? ` - ${item.detail}` : ''}`);
}

if (failed.length) {
  console.error(`\n${failed.length} stability regression check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} stability regression checks passed.`);
