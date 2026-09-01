const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
const stateJs = read('assets/js/01-state.js');
const editorJs = read('assets/js/03-editor.js');
const actionsJs = read('assets/js/06-actions.js');
const previewJs = read('assets/js/07-paper-preview.js');
const helpersJs = read('assets/js/09-helpers.js');
const initJs = read('assets/js/10-init.js');
const persistenceJs = read('assets/js/11-persistence.js');
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

function sourceBetween(text, startMarker, endMarker) {
  const start=text.indexOf(startMarker);
  if(start<0) return '';
  const end=text.indexOf(endMarker,start+startMarker.length);
  return end<0 ? text.slice(start) : text.slice(start,end);
}

function loadFunctionsIntoSandbox(source, names, globals={}) {
  const sandbox={console,Math,Number,String,RegExp,Object,Array,JSON,...globals};
  vm.createContext(sandbox);
  const bodies=names.map(name=>functionBody(source,name));
  if(bodies.some(body=>!body)) throw new Error('Could not load production function into stress sandbox');
  vm.runInContext(bodies.join('\n'),sandbox);
  return sandbox;
}

let composerSizingStressOk=false;
let composerSizingStressDetail='';
try{
  const sizing={
    console,Math,Number,String,RegExp,Object,Array,JSON,
    document:{getElementById:()=>null},
    localStorage:{getItem:()=>null,setItem:()=>{}},
    MIXED_COMPOSER_TEXT_SIZE_KEY:'test-text-size',
    MIXED_COMPOSER_MATH_SIZE_KEY:'test-math-size',
    MIXED_COMPOSER_INNER_MATH_SCALE_KEY:'test-inner-scale',
    MIXED_COMPOSER_EQUATION_STROKE_KEY:'test-ink',
    activeComposerKey:null,
    activeComposerRenderKey:'q',
    activeComposerRenderContext:null,
    cur:{questionComposerMathSize:22,questionComposerInnerMathScale:115,options:[]}
  };
  vm.createContext(sizing);
  vm.runInContext(sourceBetween(canvas,'function clampMixedComposerTextSize','function getComposerMainTextSize'),sizing);
  const formulas=[
    'x_i^2',
    '\\frac{a}{b}',
    '\\frac{1}{1+\\frac{x}{\\sqrt{1+x^2}}}',
    '\\int_a^b f(x)\\,dx',
    '\\int_a^b \\int_c^d \\int_e^f f(x)\\,dx\\,dy\\,dz',
    '\\begin{bmatrix}a&b\\\\c&d\\end{bmatrix}'
  ];
  const sizes=[14,16,22,36,52];
  const innerScales=[90,100,115,150,180];
  const heights=new Map();
  for(const size of sizes){
    sizing.cur.questionComposerMathSize=size;
    for(const inner of innerScales){
      sizing.cur.questionComposerInnerMathScale=inner;
      for(const formula of formulas){
        const height=sizing.getComposerEquationTargetHeight('q',formula);
        if(!Number.isFinite(height) || height<16 || height>340) throw new Error(`invalid target ${height} for ${size}/${inner}`);
        heights.set(`${size}|${inner}|${formula}`,height);
      }
    }
  }
  for(const formula of formulas){
    for(const inner of innerScales){
      let previous=0;
      for(const size of sizes){
        const current=heights.get(`${size}|${inner}|${formula}`);
        if(current<previous) throw new Error(`size selector is non-monotonic for ${formula}`);
        previous=current;
      }
    }
    for(const size of sizes){
      let previous=0;
      for(const inner of innerScales){
        const current=heights.get(`${size}|${inner}|${formula}`);
        if(current<previous) throw new Error(`inner scale is non-monotonic for ${formula}`);
        previous=current;
      }
    }
  }
  sizing.cur.questionComposerMathSize=14;
  sizing.cur.questionComposerInnerMathScale=90;
  const single=heights.get(`14|90|${formulas[3]}`);
  const repeated=heights.get(`14|90|${formulas[4]}`);
  if(repeated>30 || repeated>single+2) throw new Error(`Math 14 / Inner 90 integral inflated to ${repeated}px`);
  const compactLatex=sizing.prepareComposerEquationLatex('\\frac{a}{b}','q');
  if(!compactLatex.startsWith('\\textstyle ') || !compactLatex.includes('\\tfrac')) throw new Error('Inner 90 did not request compact TeX geometry');
  sizing.cur.questionComposerInnerMathScale=115;
  const displayLatex=sizing.prepareComposerEquationLatex('\\frac{a}{b}','q');
  if(!displayLatex.startsWith('\\displaystyle ') || !displayLatex.includes('\\dfrac')) throw new Error('Inner 115 did not restore display TeX geometry');
  composerSizingStressOk=true;
}catch(err){
  composerSizingStressDetail=String(err?.message||err);
}

let jsonRoundTripStressOk=false;
let jsonRoundTripStressDetail='';
try{
  const normalizer={console,Math,Number,String,RegExp,Object,Array,JSON,DIFFICULTY_LEVELS:['Easy','Medium','Hard']};
  vm.createContext(normalizer);
  vm.runInContext(
    sourceBetween(stateJs,'function normalizeDifficulty','function normalizeQuestionTopic')+'\n'+
    sourceBetween(stateJs,'function normalizeQuestionTopic','function normalizeTopicRecord')+'\n'+
    sourceBetween(stateJs,'function normalizeFigureCropRecord','qs = qs.map(normalizeQuestion);'),
    normalizer
  );
  const sourceSvg='<svg viewBox="0 0 40 20"><path d="M1 10H39" stroke="#111" stroke-width="2.4"/></svg>';
  const raster='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  let record={
    qid:'Q-STRESS',topic:'Signals',difficulty:'Hard',questionComposerHTML:'<div>\\(x^2\\)</div>',
    questionComposerMathSize:14,questionComposerInnerMathScale:90,questionComposerEquationInk:'bold',
    questionRenderMode:'source',questionImage:raster,renderChecksum:'sha256:test',
    questionFigures:[{src:'data:image/svg+xml,'+encodeURIComponent(sourceSvg),sourceSvg,circuitScene:{version:3,wires:[{x1:0,y1:10,x2:40,y2:10}]},styleManifest:{schema:'qs-studio-style-preservation/v1'},x:3,y:4,w:40,h:20,crop:{l:.75,r:.75,t:.1,b:.1},customVectorMetadata:{stable:true}}],
    options:[{oid:'O1',composerHTML:'<div>A</div>',composerMathSize:14,composerInnerMathScale:90,renderMode:'source',image:raster,unknownOptionMetadata:'keep-me',figures:[]}]
  };
  for(let i=0;i<100;i++) record=normalizer.normalizeQuestion(JSON.parse(JSON.stringify(record)));
  const fig=record.questionFigures[0];
  if(record.questionComposerHTML!=='<div>\\(x^2\\)</div>' || record.questionComposerMathSize!==14 || record.questionComposerInnerMathScale!==90) throw new Error('composer source/settings changed');
  if(record.questionImage!==raster || record.renderChecksum!=='sha256:test') throw new Error('lossless raster or unknown question metadata changed');
  if(fig.sourceSvg!==sourceSvg || fig.circuitScene?.version!==3 || fig.styleManifest?.schema!=='qs-studio-style-preservation/v1') throw new Error('editable vector source changed');
  if(fig.customVectorMetadata?.stable!==true || record.options[0].unknownOptionMetadata!=='keep-me') throw new Error('forward-compatible metadata was dropped');
  if(fig.crop.l+fig.crop.r>0.9600001 || fig.crop.t+fig.crop.b>0.9600001) throw new Error('normalized crop removed the entire figure');
  jsonRoundTripStressOk=true;
}catch(err){
  jsonRoundTripStressDetail=String(err?.message||err);
}

let exportClampStressOk=false;
let exportClampStressDetail='';
try{
  const limiter=loadFunctionsIntoSandbox(canvas,['clampExportSurfaceSize']);
  let seed=0x51f15e;
  for(let i=0;i<25000;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const width=16+(seed%200000);
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const height=16+(seed%200000);
    const out=limiter.clampExportSurfaceSize(width,height);
    if(out.width<1 || out.height<1 || out.width>9000 || out.height>9000 || out.width*out.height>36000000) throw new Error(`limit exceeded by ${width}x${height} -> ${out.width}x${out.height}`);
    if(out.width>8 && out.height>8){
      const ratioError=Math.abs(Math.log((out.width/out.height)/(width/height)));
      const quantizationTolerance=Math.max(.003,1/Math.min(out.width,out.height));
      if(ratioError>quantizationTolerance) throw new Error(`aspect ratio drifted for ${width}x${height}`);
    }
  }
  exportClampStressOk=true;
}catch(err){
  exportClampStressDetail=String(err?.message||err);
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
  'nested equations keep breathing space without count-based integral inflation',
  includesAll(canvas, [
    'function getComposerLatexTallness',
    'function getComposerLatexFractionDepth',
    'function getComposerEquationVerticalPadding',
    'let structureFactor=1;',
    'if(tall.fracDepth>0) structureFactor+=Math.min(.24, tall.fracDepth*.10);',
    'if(tall.bigOpScriptCount>0) structureFactor+=.08;',
    'structureFactor=Math.min(1.38, structureFactor);',
    'const matrixFactor=1 + Math.max(0,matrixRows-1)*.72;',
    'const verticalPad=getComposerEquationVerticalPadding(activeComposerRenderKey, preparedLatex, targetH);',
    'const assetH=mathH + verticalPad*2;',
    'verticalPad*equationScale,',
    'mathH*equationScale,'
  ]) &&
    !functionBody(canvas, 'getComposerEquationTargetHeight').includes('integralCount*') &&
    !functionBody(canvas, 'getComposerEquationTargetHeight').includes('bigOpCount*'),
  'repeated horizontal integrals must affect width, not explode Math 14 glyph height'
);

check(
  'simple visual equation atoms stay compact instead of display-sized',
  includesAll(canvas, [
    'function isComposerCompactInlineLatex',
    "out='\\\\textstyle '+out;",
    'const innerFactor=readMixedComposerInnerMathScale(key || activeComposerRenderKey)/100;',
    'if(isComposerCompactInlineLatex(latex)) return Math.max(16, Math.min(64, Math.round(mathSize*1.24*innerFactor)));',
    "if(isComposerCompactInlineLatex(latex)) return Math.max(2, Math.round(targetHeight*.045));",
    "if(/^\\\\(?:bar|overline|hat|vec|dot|ddot|tilde|overrightarrow|overleftarrow)\\s*\\{[^{}\\n]{1,18}\\}$/.test(source))",
    "out=out.replace(/\\\\(?:dfrac|frac|tfrac)\\b/g,'\\\\tfrac');"
  ]),
  'x_bar/X_bar/y_bar and simple root/script atoms must not inflate like full display equations'
);

check(
  'composer apply crops only empty outer surface space',
  includesAll(canvas, [
    'function getComposerApplySourceScale',
    'function getComposerSurfaceInkCrop',
    'function prepareComposerSurfaceForCanvasApply',
    'const padYPx=Math.max(3, Math.round(6*scale));',
    'return { source:canvas, sx, sy, sw:Math.max(1,right-sx), sh:Math.max(1,bottom-sy), scale };',
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
    "const hasOwn=name=>Object.prototype.hasOwnProperty.call(opts,name);",
    "const frameWidth=Math.max(1, Number(opts.frameWidth)||Number(cv?.width)||(key==='q' ? 640 : 500));",
    "const liveFigures=hasOwn('figures') ? (Array.isArray(opts.figures) ? opts.figures : []) : getFigureStore(key);",
    "const preparedSource=(typeof prepareComposerSurfaceForCanvasApply==='function')",
    'const srcW=preparedSource.logicalWidth||Math.max(200, frameWidth-pad*2);',
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
    'if(!allowBitmapFallback || composerHtml) return false;'
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
      'pdfFiguresSharePlacement(prev,fig) || pdfFiguresOverlapMeaningfully(prev,fig)'
    ]) &&
    !functionBody(exportJs, 'drawImageRow').includes('drawPdfVectorFigureOverlays('),
  'simple PDF export must not draw a second approximate vector copy over the lossless frame'
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
  'Hallmark HD wording is restored and circuit figure panel is not mojibake',
  canvas.includes('Hallmark HD renders text and equations once at final resolution') &&
    circuitJs.includes("title:'Circuit Figure Panel'") &&
    circuitJs.includes("b.textContent='Circuit Fig'") &&
    !circuitJs.includes("b.textContent='â") &&
    !circuitJs.includes('Place components â'),
  'composer should identify the Hallmark HD renderer and circuit labels must remain readable'
);

check(
  'only legacy Pen and Math-to-Image canvas paths are removed',
  !canvas.includes('function insertMathImg') &&
    !canvas.includes("tool:'pen'") &&
    !canvas.includes("state.tool==='pen'") &&
    !read('assets/js/03-editor.js').includes("setTool('pen'") &&
    !read('assets/js/03-editor.js').includes('Math→Img') &&
    includesAll(read('assets/js/03-editor.js'), [
      'Hallmark HD Composer',
      "setTool('figure','q')",
      "setTool('graph','q')",
      "setTool('line','q')",
      "setTool('rect','q')",
      "setTool('circ','q')",
      "setTool('erase','q')",
      "changeFigure('q')",
      "cropFigure('q')",
      "deleteFigure('q')",
      "burnFiguresIntoCanvas('q')",
      "expandCanvasPane('q')",
      "contractCanvasPane('q')",
      "autoAdjustCanvasPane('q')",
      "clearCanvas('q')",
      "importImg('q')",
      "undoCanvas('q')"
    ]),
  'all canvas controls except Pen and prompt-based Math-to-Image must remain visible'
);

check(
  'Hallmark HD is the only composer canvas profile',
  includesAll(canvas, [
    "function clampMixedComposerRenderProfile(value){\n  return 'hallmark';",
    "function readMixedComposerRenderProfile(key=''){\n  return 'hallmark';",
    'class="composer-profile-badge"',
    '>Hallmark HD</span>'
  ]) &&
    !canvas.includes('getMixedComposerRenderProfileOptionsHTML') &&
    !canvas.includes('updateMixedComposerRenderProfile') &&
    !canvas.includes('mixedComposerRenderProfile'),
  'old saved Official paper choices must not downgrade Hallmark HD rendering'
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
  'Hallmark ink levels produce distinct final-DPI text and equation weights',
  includesAll(canvas, [
    'function drawEquationAssetWithInk',
    'function drawComposerTextWithInk',
    'const equationInk=readMixedComposerEquationStroke(activeComposerRenderKey);',
    'drawEquationAssetWithInk(',
    "if(ink==='regular') return { opacity:1, spread:.16, passes:5, fontWeight:500, ruleScale:1, textSpread:0, textPasses:1 };",
    "if(ink==='bold') return { opacity:1, spread:.32, passes:5, fontWeight:650, ruleScale:1.35, textSpread:.08, textPasses:5 };",
    "return { opacity:1, spread:.54, passes:9, fontWeight:800, ruleScale:1.72, textSpread:.18, textPasses:9 };",
    'for(const [dx,dy] of offsets)',
    'drawComposerTextWithInk(ctx,item.text,textX,textY);',
    'ctx.lineWidth=getHallmarkRuleWidth(variant===\'small\'?1.15:1.5);'
  ]) &&
    !canvas.includes('applyEquationInkToAssetCanvas') &&
    !canvas.includes('hardenComposerRowSurface') &&
    !canvas.includes('renderComposerRowSurface'),
  'Fine, Light, Regular, Bold, and Extra bold must remain visibly separate without pixel mutation passes'
);

check(
  'equation ink visibly updates editable nested equation controls',
  componentCss.includes('--composer-ui-font-weight:800') &&
    componentCss.includes('.mixed-composer-editor .structure-input,.mixed-composer-editor .frac-input,.mixed-composer-editor .structure-main') &&
    componentCss.includes('font-weight:var(--composer-ui-font-weight,400)!important'),
  'Bold and Extra bold must affect equation glyphs, not only widget borders'
);

check(
  'ordinary composer prose renders directly on the final high-DPI surface',
  includesAll(canvas, [
    'function drawComposerBitmapText',
    'function drawComposerTextWithInk',
    'const scale=Math.max(1, getMixedComposerRenderScale());',
    "ctx.textRendering='geometricPrecision';",
    "if('fontKerning' in ctx) ctx.fontKerning='normal';",
    'drawComposerTextWithInk(ctx,item.text,textX,textY);'
  ]) &&
    !canvas.includes('buildCanvasTextBitmap(') &&
    !canvas.includes('strokeCanvasText(') &&
    !functionBody(canvas, 'drawComposerTextWithInk').includes('strokeText(') &&
    functionBody(canvas, 'getComposerFont').includes('const inkWeight=getComposerEquationInkProfile') &&
    functionBody(canvas, 'getComposerFont').includes('const weight=style?.bold ? Math.max(700,inkWeight) : inkWeight;'),
  'normal letters must be weighted directly on the final surface, never pre-rasterized or resampled row-by-row'
);

check(
  'composer equations rasterize from vector exactly once at their selected size',
  includesAll(canvas, [
    'async function renderTexToSvgImage(tex)',
    'vector=await renderTexToSvgImage(preparedLatex);',
    "const rawImg=vector.img;",
    "URL.revokeObjectURL(vector.url);",
    "Rasterize MathJax's SVG once, directly at the final Hallmark HD size."
  ]) &&
    !canvas.includes('renderTexToDataUrl(preparedLatex, getMixedComposerRenderScale())'),
  'lower Math sizes must not pass through an intermediate PNG that introduces folded or wrinkled glyph edges'
);

check(
  'composer waits for stable font metrics before measuring small text',
  functionBody(canvas, 'renderMixedComposerCanvasQueuedWork').includes('if(document.fonts?.ready) await document.fonts.ready;'),
  'late font swaps must not cramp or wrinkle small alphabetic text after layout'
);

check(
  'concurrent frame restores cannot leak size or ink settings across canvases',
  includesAll(canvas, [
    'let mixedComposerRenderQueue=Promise.resolve();',
    'let activeComposerRenderContext=null;',
    'function captureMixedComposerRenderContext',
    'const snapshot=renderContext',
    'const run=()=>renderMixedComposerCanvasQueuedWork(root,key,snapshot);',
    'const pending=mixedComposerRenderQueue.then(run,run);',
    'mixedComposerRenderQueue=pending.catch(()=>{});',
    'activeComposerRenderContext=renderContext || captureMixedComposerRenderContext(activeComposerRenderKey);',
    'activeComposerRenderContext=prevComposerRenderContext;'
  ]) &&
    functionBody(canvas, 'captureMixedComposerRenderContext').includes('Object.freeze') &&
    includesAll(functionBody(canvas, 'isMixedComposerControlContextVisible'),[
      "const modal=document.getElementById('appModal');",
      "!modal.classList.contains('hidden')",
      "document.getElementById('mixedComposerEditor')"
    ]) &&
    (canvas.match(/isMixedComposerControlContextVisible\(key\)/g)||[]).length>=4 &&
    (canvas.match(/activeComposerRenderContext\?\.key===frameKey/g)||[]).length>=4,
  'async q/option renders must retain their own text size, math size, inner scale, and Hallmark ink level'
);

check(
  'Composer Apply atomically snapshots DOM and selectors before asynchronous rendering',
  includesAll(sourceBetween(canvas,'const runApply=async ()=>','if(applyBtn) applyBtn.onclick=runApply;'),[
    'const targetQuestion=cur;',
    "const targetCanvas=document.getElementById(key+'Canvas');",
    'const ownsApplyTarget=()=>isCanvasRenderTargetCurrent(key,targetQuestion,targetCanvas)',
    'const sourceHTML=editorEl.innerHTML;',
    'const renderRoot=editorEl.cloneNode(true);',
    'const renderContext=captureMixedComposerRenderContext(key);',
    'const plainText=getMixedComposerPlainText(renderRoot);',
    'renderMixedComposerCanvas(renderRoot, key, renderContext)',
    'const composerSize=renderContext.textSize;',
    'targetQuestion.questionComposerHTML=sourceHTML;',
    'targetQuestion.options[idx].composerHTML=sourceHTML;',
    'expectedQuestion:targetQuestion,',
    'expectedCanvas:targetCanvas',
    'if(applied===false || !ownsApplyTarget())'
  ]) && includesAll(canvas,[
    "control.dataset.applyWasDisabled=control.disabled ? '1' : '0';",
    "composerEditor.setAttribute('contenteditable','false');",
    "document.getElementById('appModalClose')",
    ".modal-actions button:not(.composer-apply-btn)"
  ]),
  'queued rendering must not pair one bitmap with later live HTML/settings or commit into a newly selected question'
);

check(
  'composer sizing and restore paths preserve glyph aspect ratio',
  includesAll(functionBody(canvas, 'restoreCanvasFromDataUrl'), [
    'const aspectHeight=Math.max(1,Math.round(srcH*(cv.width/Math.max(1,srcW))));',
    'ctx.drawImage(img,0,0,cv.width,aspectHeight);'
  ]) &&
    !canvas.includes('const drawW=Math.max(60, Math.round(srcW*drawScale));') &&
    !canvas.includes("const drawH=Math.max(key==='q' ? 28 : 18, Math.round(srcH*drawScale));") &&
    (canvas.match(/const drawW=Math\.max\(1, srcW\*drawScale\);/g)||[]).length>=2 &&
    (canvas.match(/const drawH=Math\.max\(1, srcH\*drawScale\);/g)||[]).length>=2 &&
    includesAll(canvas,[
      'const mathW=Math.max(1, naturalW*scale);',
      'const mathH=Math.max(1, naturalH*scale);',
      'const horizontalPad=Math.max(0,(16-mathW)/2);',
      'horizontalPad*equationScale,',
      'mathW*equationScale,',
      'width:eqCanvas.width/equationScale,',
      'height:eqCanvas.height/equationScale'
    ]) &&
    includesAll(functionBody(canvas, 'renderTexToDataUrl'),[
      'const naturalW=Math.max(1, Number(img.naturalWidth||img.width)||320);',
      'const naturalH=Math.max(1, Number(img.naturalHeight||img.height)||120);',
      'const padX=Math.max(0,(32-naturalW)/2);',
      'const padY=Math.max(0,(32-naturalH)/2);',
      'ctx.drawImage(img,padX,padY,naturalW,naturalH);'
    ]) &&
    !functionBody(canvas, 'renderMixedComposerCanvasQueuedWork').includes('const mathH=Math.max(18, naturalH*scale);'),
  'minimum canvas footprints must add whitespace instead of independently stretching narrow or short glyph surfaces'
);

check(
  'question and option canvas content uses consistent top-left alignment',
  (canvas.match(/const drawY=pad;/g)||[]).length>=2 &&
    functionBody(canvas, 'getFixedTextPlacement').includes('const startY=16;') &&
    functionBody(canvas, 'getFixedTextPlacement').includes('const needed=Math.max(baseHeight, startY+textH+16);') &&
    functionBody(canvas, 'makeViewerCanvasImage').includes('const drawY=0;') &&
    functionBody(exportJs, 'dataUrlToViewerImage').includes('const drawY=0;') &&
    canvas.includes("'Top-left aligned'") &&
    !canvas.includes("const drawY=key==='q' ? pad : Math.max(pad, Math.round((targetH-drawH)/2));") &&
    !functionBody(canvas, 'getFixedTextPlacement').includes('(cv.height-textH)/2'),
  'option content and fixed text must not be vertically centered while question content is top-aligned'
);

check(
  'canvas surface is left-pinned and clipped inside its blue frame',
  componentCss.includes('.canvas-wrap{position:relative;border:2px solid #174b7c') &&
    componentCss.includes('overflow:hidden;min-height:96px') &&
    componentCss.includes('-webkit-user-select:none;margin:0!important}') &&
    componentCss.includes('.canvas-wrap:has(>.canvas-imagebox),.canvas-wrap:has(>.canvas-textbox){overflow:visible}') &&
    componentCss.includes('.canvas-wrap{border-color:#174b7c;box-shadow:none;overflow:hidden}'),
  'inline margin:auto must not center the real canvas and overlays must not leak beyond the frame border'
);

check(
  'restored text blocks return to one-click Composer editing',
  includesAll(functionBody(canvas, 'initCanvas'), [
    "if(composerHtml) state.tool='text';",
    'setTool(state.tool,key);',
    'function onWrapTextClick(e)',
    "if(e.target!==wrap || (e.button!==undefined && e.button!==0)) return;",
    "state.tool='text';",
    "openMixedComposer(key);",
    "wrap.addEventListener('pointerdown',wrap._textBlockPointerDown);"
  ]) &&
    includesAll(functionBody(canvas, 'openCanvasTextBox'), [
      "if(mode==='text'){",
      'openMixedComposer(key);'
    ]),
  'the visible Text state and internal tool state must agree after a frame rerender'
);

check(
  'source-backed composer resizing uses one exact display-density downsample',
  includesAll(canvas, [
    'function renderComposerSourceOverlay(key, preparedSource, placement)',
    "overlay.className='composer-source-overlay';",
    "if(clean==='bitmap') clearComposerSourceOverlay(key);",
    'const cssScaleX=metrics.width/Math.max(1,metrics.cv.width);',
    'const displayDensity=Math.max(1, Math.min(3, Number(window.devicePixelRatio)||1));',
    'overlay.width=Math.max(1, Math.round(displayW*displayDensity));',
    'overlay.height=Math.max(1, Math.round(displayH*displayDensity));',
    "ctx.imageSmoothingQuality='high';",
    'renderComposerSourceOverlay(key, preparedSource, {'
  ]) &&
    componentCss.includes('.composer-source-overlay{position:absolute;pointer-events:none;z-index:7'),
  'small text/math must not leave a 12x backing surface to uncontrolled browser zoom filtering'
);

check(
  'Composer outer-margin crop preserves intentional leading blank figure rows',
  includesAll(canvas,[
    'canvas.dataset.composerOuterMargin=String(outerMargin);',
    'const structuralMargin=Number(source?.dataset?.composerOuterMargin);',
    'Number.isFinite(structuralMargin) && structuralMargin>=0',
    'Math.max(0,Math.min(minY,Math.round(structuralMargin*scale)))'
  ]),
  'top alignment may remove renderer padding, but not authored blank Composer rows'
);

check(
  'strict export composition falls back instead of silently dropping failed figures',
  includesAll(sourceBetween(canvas,'async function drawFigureListOnCanvas','async function drawStoredFiguresOnCanvas'),[
    'const failures=[];',
    'if(opts.strict && failures.length)',
    'throw new Error(`Could not render ${failures.length} of ${list.length} canvas figure(s)'
  ]) &&
    includesAll(sourceBetween(canvas,'async function composeSourceSurfaceWithCanvasFigures','function paintSurfaceToEditorCanvas'),[
      'const strictFigures=opts.strictFigures===true;',
      '{strict:strictFigures}',
      "if(strictFigures) throw new Error('Burned figure layer did not draw: '"
    ]) &&
    includesAll(sourceBetween(exportJs,'async function buildExportAssetsForQuestionRecord','function exportYield'),[
      'strictFigures:true',
      'if(!isUsableRasterDataUrl(full) || !isUsableRasterDataUrl(viewer))',
      "throw new Error('Canvas serialization returned an unusable raster image.');"
    ]) &&
    sourceBetween(canvas,'async function syncCanvasAssetForKeyAsync','async function syncCurrentEditorCanvasAssetsForExportAsync').includes('{strictFigures:true}'),
  'an invalid live/burned figure must select the complete stored raster fallback'
);

check(
  'sourceSvg-only circuit records remain visible across canvas, burn, preview, and export paths',
  includesAll(functionBody(canvas, 'getFigureDisplaySource'),[
    "const src=String(fig?.src||'').trim();",
    "const svg=String(fig?.sourceSvg||'').trim();",
    "svgTextToDataUrl(svg)"
  ]) &&
    (canvas.match(/filter\(hasRenderableFigureSource\)/g)||[]).length>=4 &&
    includesAll(functionBody(canvas, 'renderFigureOverlays'),[
      'getFigureDisplaySource(fig)',
      'isEditableVectorCircuitFigure(fig)'
    ]) &&
    functionBody(canvas, 'cloneFigureForBurn').includes('...fig,'),
  'editable SVG/circuit source must not disappear merely because its cached data URL is absent'
);

check(
  'v4 project import accepts canonical and snake-case project names',
  persistenceJs.includes("examName = String(data.examName || '').trim() || String(data.project_name || '').trim();") &&
    stateJs.includes("String(data.examName || '').trim() || String(data.project_name || '').trim(),"),
  'writer and reader must agree on project_name interoperability'
);

check(
  'Paper JSON preserves burned-layer geometry and validates raster payloads',
  includesAll(exportJs,[
    'function isUsableRasterDataUrl(value)',
    'burned_figure_scale: Math.max(1, Number(o.burnedFigureScale)||1),',
    'question_burned_figure_scale: Math.max(1, Number(q.questionBurnedFigureScale)||1),',
    'raster_present:rasterUsable,',
    "raster_lossless:rasterUsable && rasterMime==='image/png'"
  ]),
  'empty data URLs must not be marked complete, and raster-only burned figures need their logical scale'
);

check(
  'figure crop limits agree across editor state, canvas, and PDF vector metadata',
  includesAll(functionBody(stateJs, 'normalizeFigureCropRecord'),['Math.min(.95','if(total<=.96)']) &&
    includesAll(functionBody(canvas, 'getFigureCrop'),['Math.min(.95','if(total<=.96)']) &&
    includesAll(functionBody(exportJs, 'drawSvgFigureVectorOverlay'),['Math.min(.95','Math.max(.04']),
  'crop values must not jump when the same figure moves between UI, project JSON, and export'
);

check(
  'Math selector stress matrix prevents Math 14 / Inner 90 integral inflation',
  composerSizingStressOk,
  composerSizingStressDetail
);

check(
  '100-cycle project JSON round trip preserves Hallmark, raster, SVG, and circuit sources',
  jsonRoundTripStressOk,
  jsonRoundTripStressDetail
);

check(
  '25,000 export sizes obey edge, pixel-budget, and aspect-ratio limits',
  exportClampStressOk,
  exportClampStressDetail
);

check(
  'Paper and project JSON declare lossless source-first quality metadata',
  includesAll(exportJs,[
    'const buildComposerRenderSource=',
    'question_render_source:buildComposerRenderSource',
    'render_source:buildComposerRenderSource',
    'const rasterComplete=allRenderSources.length>0 && allRenderSources.every(source=>source.raster_present);',
    'const rasterLossless=rasterComplete && allRenderSources.every(source=>source.raster_lossless);',
    'composer_source_records:composerSourceRecords',
    'editable_vector_records:editableVectorRecords',
    'editable_scene:fig.circuitScene || null'
  ]) && includesAll(persistenceJs,[
    '_version: 4',
    '_quality: {',
    'const rasterLossless=rasterComplete && frameRecords.every',
    'composer_source_records:composerSourceRecords',
    'editable_vector_records:editableVectorRecords',
    'asset_sync_status:assetSyncStatus'
  ]),
  'export/import quality manifests or editable sources are missing'
);

check(
  'Paper JSON and PDF prefer the same full-resolution question and option assets',
  includesAll(sourceBetween(exportJs, 'async function exportPaperJSON', 'async function exportPaperPDFTextOnly'),[
    "buildExportAssetsForAllQuestions(qs, 'JSON image assets')",
    'question_image: assets.questionImage || assets.questionViewerImage',
    "const fullImage = optAsset.full || o.image || '';"
  ]) && includesAll(sourceBetween(exportJs, 'async function exportPaperPDFTextOnly', 'async function exportPaperPDF(){'),[
    'assets=await buildExportAssetsForQuestionRecord(q)',
    '[assets.questionImage, q.questionImage, assets.questionViewerImage',
    '[optAsset.full, opt?.image, optAsset.viewer'
  ]),
  'both formats must select the shared Hallmark full image before any viewer-resolution fallback'
);

check(
  'record export renders off-screen source with explicit immutable geometry and figures',
  includesAll(sourceBetween(exportJs,'async function buildExportAssetsForQuestionRecord','function exportYield'),[
    'const renderContext=renderContextFor(key,record,option);',
    'renderMixedComposerCanvas(host, key, renderContext)',
    'frameWidth:renderContext.frameWidth',
    'figures:Array.isArray(figures) ? figures : []',
    'burnedFigures:Array.isArray(burnedFigures) ? burnedFigures : []'
  ]) &&
    !sourceBetween(exportJs,'async function buildExportAssetsForQuestionRecord','function exportYield').includes('cur=') &&
    includesAll(sourceBetween(canvas,'async function composeSourceSurfaceWithCanvasFigures','function setCanvasRenderModeForKey'),[
      "const frameWidth=Math.max(1, Number(opts.frameWidth)||Number(cv?.width)||(key==='q' ? 640 : 500));",
      "const liveFigures=hasOwn('figures') ? (Array.isArray(opts.figures) ? opts.figures : []) : getFigureStore(key);"
    ]),
  'export must not depend on whichever editor record happens to be mounted in the DOM'
);

check(
  'PDF scan proxy finds bounds only and final PNG samples the original once',
  includesAll(functionBody(exportJs, 'getPdfImageInfo'),[
    'const scanScale=Math.min(',
    'tctx.drawImage(img,0,0,trimCanvas.width,trimCanvas.height);',
    'const sourceMinX=Math.max(0,Math.floor(minX/scanScale)-padSource);',
    'makePdfEmbedImage(img, pointW, pointH, kind, {x:sourceMinX,y:sourceMinY,w:sourceCropW,h:sourceCropH})'
  ]) && includesAll(functionBody(exportJs, 'makePdfEmbedImage'),[
    'octx.drawImage(sourceCanvas,sx,sy,sw,sh,0,0,targetW,targetH);',
    "return {dataUrl:safeCanvasDataUrl(out, 'image/png'), fmt:'PNG'};"
  ]) && !functionBody(exportJs, 'makePdfEmbedImage').includes('trimCanvas'),
  'final PDF rows must not use the low-resolution scan proxy as their image source'
);

check(
  'circuit export keeps precise single-pass strokes and editable SVG metadata',
  includesAll(circuitJs,[
    'stroke-width="3.2"',
    "_cBoostStrokeMarkup(c.sym.svgFn(false), 1.85, 5.9)",
    'preserveAspectRatio="xMinYMin meet"',
    'shape-rendering="geometricPrecision"',
    'text-rendering="geometricPrecision"',
    'sourceSvg:svgStr',
    'circuitScene:scene'
  ]) &&
    !functionBody(exportJs, 'drawImageRow').includes('drawPdfVectorFigureOverlays('),
  'circuit strokes must not be over-thickened or painted twice in simple PDF export'
);

check(
  'canvas ink uses one captured pointer stream and stays visible while drawing',
  includesAll(functionBody(canvas, 'initCanvas'), [
    "cv.setPointerCapture?.(e.pointerId);",
    'markFrameAsBitmap(key);',
    "typeof e.getCoalescedEvents==='function'",
    "ctx.strokeStyle=tool==='erase' ? '#fff' : getColor();",
    "cv.addEventListener('pointercancel',cv._pointerCancel);",
    "cv.addEventListener('lostpointercapture',cv._pointerCancel);",
    'if(snapshot) ctx.putImageData(snapshot,0,0);'
  ]) &&
    !functionBody(canvas, 'initCanvas').includes("cv.addEventListener('touchstart'") &&
    !functionBody(canvas, 'initCanvas').includes("cv.addEventListener('mousedown'") &&
    componentCss.includes('.canvas-wrap>canvas,.canvas-wrap canvas.draw-canvas{display:block;cursor:crosshair;touch-action:none'),
  'drawing must not duplicate touch/mouse input, disappear under source overlays, or terminate when the pointer leaves the canvas'
);

check(
  'full-screen paper buffer is accessible, translucent, and locks interaction only while active',
  includesAll(html,[
    'id="paperLoadOverlay"',
    'role="status"',
    'aria-live="polite"',
    'class="paper-preparing"',
    'id="paperLoadProgress"'
  ]) && includesAll(componentCss,[
    'body.paper-preparing{overflow:hidden}',
    '.paper-load-overlay{',
    'z-index:30000',
    'backdrop-filter:blur(15px)',
    '.paper-load-overlay.is-active',
    '@media (prefers-reduced-motion:reduce)'
  ]),
  'the preparation UI must be visible before startup JS and remain accessible without replacing app dialogs'
);

check(
  'paper preparation waits for real resources and always has a bounded release',
  includesAll(sourceBetween(helpersJs,'async function preparePaperWorkspace','function imgPDFHeight'),[
    "renderPaper(true)",
    "waitForEditorCanvasReady(9000)",
    "waitForCanvasResourceTasks(9000)",
    "hydratePaperLazyImages({eager:true})",
    "settleWorkspaceImages('#editor img',4200)",
    'waitForStablePaperLayout()',
    'paperPreparationTimeout(work,hardTimeoutMs,false)',
    'finishPaperPreparation(token'
  ]) && includesAll(sourceBetween(helpersJs,'function beginPaperPreparation','async function finishPaperPreparation'),[
    "shell.setAttribute('inert','')",
    "document.body.classList.add('paper-preparing')",
    'paperPreparationHardTimer=setTimeout'
  ]) && includesAll(sourceBetween(helpersJs,'async function finishPaperPreparation','async function warmPaperFonts'),[
    "shell.removeAttribute('inert')",
    "document.body.classList.remove('paper-preparing')",
    "overlay.setAttribute('aria-hidden','true')"
  ]),
  'the overlay must track fonts/canvases/previews/layout and release even when one resource is broken'
);

check(
  'paper preview supports eager bounded decode of every viewer-sized image',
  includesAll(sourceBetween(previewJs,'async function hydratePaperLazyImages','let _paperRenderQueued'),[
    'options?.eager===true',
    'paperLazyObserver.disconnect()',
    'Math.min(12,imgs.length)',
    'await Promise.all(workers)',
    'failed++'
  ]) && includesAll(functionBody(previewJs,'settlePaperPreviewImage'),[
    "img.loading='eager'",
    "img.removeAttribute('data-src')",
    "img.decode()",
    "img.dataset.paperLoadState=ok?'ready':'failed'"
  ]),
  'initial/open preparation must hydrate all small viewer assets so scrolling does not trigger late image work'
);

check(
  'editor and canvas restoration expose terminal readiness promises',
  includesAll(editorJs,[
    'let editorCanvasReadyPromise=Promise.resolve([]);',
    'function waitForEditorCanvasReady',
    'const settled=await Promise.allSettled(jobs);',
    'return editorCanvasReadyPromise;'
  ]) && includesAll(canvas,[
    'const canvasResourceTasks = new Set();',
    'function trackCanvasResourceTask',
    'async function waitForCanvasResourceTasks',
    'img.onerror=()=>finish(false);',
    'return trackCanvasResourceTask(task,expectedQuestion);',
    "new Error('Image load timed out')"
  ]),
  'broken or slow canvas images must settle rather than leaving the paper buffer hung forever'
);

check(
  'startup, imported banks, fresh projects, and first questions use the paper buffer',
  includesAll(initJs,['initializeQsStudio','beginPaperPreparation','bootstrapProjectState({preparationToken:token})']) &&
    includesAll(persistenceJs,[
      "reason:'open-bank'",
      'await _afterLoad',
      "reason:'new-project'",
      "reason:'fresh-project'",
      'options.preparationToken'
    ]) && includesAll(actionsJs,["reason:'first-question'",'preparePaperWorkspace({']),
  'all requested paper entry points must warm resources before interaction is released'
);

const projectSaveOnceBody=functionBody(persistenceJs,'_saveToFileOnce');
const projectSaveBody=functionBody(persistenceJs,'saveToFile');
check(
  'background and denied project saves can never trigger a download',
  includesAll(projectSaveBody,[
    'if(silent && (_autoSaveSuppression || !_fileHandle || !_fileHandleWritable)) return false;',
    'if(_saveInProgress) return _saveInProgress;'
  ]) && includesAll(projectSaveOnceBody,[
    "if(!_fileHandle){",
    "if(err?.name!=='AbortError' && !silent)",
    'Nothing was downloaded.',
    'return false;'
  ]) && !projectSaveOnceBody.includes('dlBlob(') &&
    includesAll(functionBody(persistenceJs,'_queueAutoSave'),['_fileHandleWritable','_saveInProgress','_autoSaveSuppression']) &&
    includesAll(functionBody(persistenceJs,'_scheduleAutoSave'),['_fileHandleWritable','_saveInProgress','_autoSaveSuppression']),
  'Save All may write an approved handle, but autosave/permission failures must never fall through to Downloads'
);

check(
  'only explicitly labelled symbol export controls download files',
  functionBody(svgMaker,'saveSymbolToLibrary').includes('Nothing was downloaded; use Export Symbol JSON') &&
    !functionBody(svgMaker,'saveSymbolToLibrary').includes('downloadSymbolJson()') &&
    html.includes("runExportJob('Paper JSON'") && html.includes("runExportJob('Key JSON'") && html.includes('onclick="exportOnePNG()"'),
  'Save to Library must not silently convert itself into a download action'
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
