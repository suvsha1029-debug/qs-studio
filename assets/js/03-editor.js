//  EDITOR
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let editorCanvasReadyPromise=Promise.resolve([]);

function waitForEditorCanvasReady(timeoutMs=10000){
  const timeout=new Promise(resolve=>setTimeout(()=>resolve(false),Math.max(250,Number(timeoutMs)||10000)));
  return Promise.race([editorCanvasReadyPromise,timeout]);
}

function loadQ(id){ cur = qs.find(q=>q.id===id)||null; renderSidebar(); return renderEditor(); }

function renderEditor(){
  const ed = document.getElementById('editor');
  if(!cur){
    ed.innerHTML='<div class="empty"><div style="font-size:32px">&#128203;</div><div>Select a question</div></div>';
    editorCanvasReadyPromise=Promise.resolve([]);
    return editorCanvasReadyPromise;
  }
  const q = cur;
  const isNAT = q.type==='NAT', isMSQ = q.type==='MSQ';
  const sm = getSubjectMeta(q.subject);

  ed.innerHTML = `
  <!-- META -->
  <div>
    <div class="sec-lbl">Metadata</div>
    <div class="field-row">
      <div class="field" style="flex:0 0 80px">
        <label>Type</label>
        <select onchange="updF('type',this.value);renderEditor();renderPaper()">
          <option${q.type==='MCQ'?' selected':''}>MCQ</option>
          <option${q.type==='MSQ'?' selected':''}>MSQ</option>
          <option${q.type==='NAT'?' selected':''}>NAT</option>
        </select>
      </div>
      <div class="field" style="flex:0 0 80px">
        <label>Subject</label>
        <select onchange="handleSubjectPick(this)">
          ${subjectOptionsHTML(q.subject)}
        </select>
      </div>
      <div class="field" style="flex:0 0 100px">
        <label>Section</label>
        <div class="qid-box">${escH(sm.section||'-')}</div>
      </div>
      <div class="field" style="flex:1 1 220px">
        <label>Bank Subject</label>
        <div class="qid-box">${escH(sm.full||'-')}</div>
      </div>
      <div class="field" style="flex:1 1 180px">
        <label>Topic</label>
        <select onchange="handleTopicPick(this)">
          ${typeof topicOptionsHTML==='function' ? topicOptionsHTML(q.topic) : `<option value="">Unassigned</option>`}
        </select>
      </div>
      <div class="field" style="flex:0 0 100px">
        <label>Difficulty</label>
        <select onchange="setQuestionDifficulty(this.value)">
          ${typeof difficultyOptionsHTML==='function' ? difficultyOptionsHTML(q.difficulty) : `
            <option${q.difficulty==='Easy'?' selected':''}>Easy</option>
            <option${!q.difficulty||q.difficulty==='Medium'?' selected':''}>Medium</option>
            <option${q.difficulty==='Tough'?' selected':''}>Tough</option>
          `}
        </select>
      </div>
      <div class="field" style="flex:0 0 65px">
        <label>Marks</label>
        <input type="number" value="${q.marks}" step="0.5" min="0" onchange="updF('marks',+this.value)">
      </div>
      <div class="field" style="flex:0 0 80px">
        <label>Neg Marks</label>
        <input type="number" value="${q.negMarks}" step="0.01" onchange="updF('negMarks',+this.value)">
      </div>
      <div class="field" style="flex:0 0 110px">
        <label>Total Marks</label>
        <div class="qid-box">${qs.reduce((s,x)=>s+(+x.marks||0),0)} M</div>
      </div>
      <div class="field" style="flex:1">
        <label>Question ID</label>
        <div class="qid-box">${q.qid}</div>
      </div>
    </div>
    <div class="field-row" style="margin-top:6px">
      <button class="btn" type="button" onclick="openSubjectManager()">Manage Subjects</button>
      <button class="btn del" type="button" onclick="deleteSubjectFlow('${escA(q.subject)}')">Delete Subject</button>
      <button class="btn" type="button" onclick="openTopicManager()">Manage Topics</button>
    </div>
    <div class="field" style="margin-top:6px">
      <label>Short label (sidebar display)</label>
      <input type="text" value="${escA(q.label||'')}" placeholder="e.g. Find r₃ using Pythagorean theorem..."
        oninput="updF('label',this.value);renderSidebar()">
    </div>
  </div>

  <!-- QUESTION CONTENT -->
  <div>
    <div class="sec-lbl">Question Content</div>
    <div class="canvas-wrap" id="qCanvasWrap">
      <div class="canvas-tools" id="qTools">
        <button class="tool-btn active" id="toolText" onclick="setTool('text','q')">Text</button>
        <button class="tool-btn" id="toolLegend" onclick="setTool('legend','q')">Aa Legend</button>
        <button class="tool-btn" id="toolFigure" onclick="setTool('figure','q')">Figure</button>
        <button class="tool-btn" id="toolGraph" onclick="setTool('graph','q')">Graph</button>
        <button class="tool-btn" id="toolLine" onclick="setTool('line','q')">Line</button>
        <button class="tool-btn" id="toolRect" onclick="setTool('rect','q')">Rect</button>
        <button class="tool-btn" id="toolCirc" onclick="setTool('circ','q')">Circle</button>
        <button class="tool-btn" id="toolErase" onclick="setTool('erase','q')">Erase</button>
        <input type="color" id="qColor" value="#111111" title="Color">
        <input type="range" id="qSize" min="1" max="24" value="2" title="Size">
        <span id="qSizeLbl" style="font-size:10px;color:var(--muted)">2px</span>
        <button class="tool-btn" onclick="clearCanvas('q')">Clear</button>
        <button class="tool-btn" onclick="importImg('q')">Import</button>
        <button class="tool-btn" onclick="changeFigure('q')">Change Fig</button>
        <button class="tool-btn" onclick="cropFigure('q')">Crop Fig</button>
        <button class="tool-btn" onclick="deleteFigure('q')">Delete Fig</button>
        <button class="tool-btn" onclick="burnFiguresIntoCanvas('q')">Burn Fig</button>
        <button class="tool-btn" onclick="expandCanvasPane('q')">Expand Pane</button>
        <button class="tool-btn" onclick="contractCanvasPane('q')">Contract Pane</button>
        <button class="tool-btn" onclick="autoAdjustCanvasPane('q')">Auto Adjust</button>
        <button class="tool-btn" onclick="openMixedComposer('q')">Hallmark HD Composer</button>
        <button class="tool-btn" onclick="undoCanvas('q')">Undo</button>
      </div>
      <canvas id="qCanvas" width="640" height="90" style="max-width:100%;margin:0 auto"></canvas>
    </div>
    <div class="pdf-source-panel">
      <div class="sec-lbl" style="margin-bottom:0">PDF Text Source</div>
      <div class="pdf-source-note">This panel is used only for the question bank PDF export. It does not change the JSON export or viewer data.</div>
      <div class="pdf-source-grid">
        <div class="field">
          <label>Question text for PDF</label>
          <textarea id="pdfQuestionText" spellcheck="true" placeholder="Type the clean bank PDF version of the question here..."
            oninput="setPdfQuestionText(this.value)">${escH(typeof getQuestionPdfSourceText==='function' ? getQuestionPdfSourceText(q) : displayPdfText(q.questionText||''))}</textarea>
          <div class="pdf-linked-head">Selectable Composer Preview</div>
          <div id="pdfQuestionLinked" class="pdf-linked-preview"></div>
        </div>
      </div>
    </div>
  </div>

  <div class="divider"></div>

  ${isNAT ? `
  <!-- NAT ANSWER -->
  <div>
    <div class="sec-lbl">NAT Answer (goes to answer key only)</div>
    <div class="field">
      <input type="text" id="natAns" value="${escA(q.natAnswer||'')}"
        placeholder="e.g. 3.5  or  3.4-3.6  or  -36 to -34"
        oninput="updF('natAnswer',this.value)">
      <div style="font-size:10px;color:var(--muted);margin-top:2px">This value will NOT appear in the question image. Stored in answer key only. Range keys are inclusive, and signed ranges are evaluated by magnitude too.</div>
    </div>
  </div>
  ` : `
  <!-- OPTIONS -->
  <div>
    <div class="sec-lbl">Options &nbsp;<span style="font-size:9px;font-weight:400">${isMSQ?'(multiple correct)':'(single correct)'}</span></div>
    <div id="optList">
      ${q.options.map((opt,i)=>`
      <div class="opt-row" id="optRow${i}">
        <span class="opt-lbl" style="padding-top:28px">${String.fromCharCode(65+i)}</span>
        <div class="opt-right">
          <div class="opt-top">
            <div class="chk-wrap">
              <input type="${isMSQ?'checkbox':'radio'}" name="corr_${q.id}" id="corr${i}"
                ${opt.correct?'checked':''} onchange="setCorr(${i},this.checked)">
              <label for="corr${i}" style="cursor:pointer">&#10003; Correct</label>
            </div>
            <button class="tool-btn" onclick="clearCanvas('opt${i}')">Clear</button>
            <button class="tool-btn" onclick="importImg('opt${i}')">Import</button>
            <button class="tool-btn" onclick="changeFigure('opt${i}')">Change Fig</button>
            <button class="tool-btn" onclick="cropFigure('opt${i}')">Crop Fig</button>
            <button class="tool-btn" onclick="deleteFigure('opt${i}')">Delete Fig</button>
            <button class="tool-btn" onclick="burnFiguresIntoCanvas('opt${i}')">Burn Fig</button>
            <button class="tool-btn" onclick="expandCanvasPane('opt${i}')">Expand Pane</button>
            <button class="tool-btn" onclick="contractCanvasPane('opt${i}')">Contract Pane</button>
            <button class="tool-btn" onclick="autoAdjustCanvasPane('opt${i}')">Auto Adjust</button>
            <button class="tool-btn" onclick="openMixedComposer('opt${i}')">Hallmark HD Composer</button>
            <button class="tool-btn" onclick="undoCanvas('opt${i}')">Undo</button>
            <span class="opt-id-row">${opt.oid||genOid(q.qid,i+1)}</span>
          </div>
          <div class="canvas-wrap" id="opt${i}CanvasWrap">
            <div class="canvas-tools" id="opt${i}Tools">
              <button class="tool-btn active" id="opt${i}toolText" onclick="setTool('text','opt${i}')">Text</button>
              <button class="tool-btn" id="opt${i}toolLegend" onclick="setTool('legend','opt${i}')">Aa</button>
              <button class="tool-btn" id="opt${i}toolFigure" onclick="setTool('figure','opt${i}')">&#128444;</button>
              <button class="tool-btn" id="opt${i}toolGraph" onclick="setTool('graph','opt${i}')">&#128200;</button>
              <button class="tool-btn" id="opt${i}toolLine" onclick="setTool('line','opt${i}')">&#9135;</button>
              <button class="tool-btn" id="opt${i}toolRect" onclick="setTool('rect','opt${i}')">&#9633;</button>
              <button class="tool-btn" id="opt${i}toolCirc" onclick="setTool('circ','opt${i}')">&#9711;</button>
              <button class="tool-btn" id="opt${i}toolErase" onclick="setTool('erase','opt${i}')">&#9003;</button>
              <input type="color" id="opt${i}Color" value="#111111">
              <input type="range" id="opt${i}Size" min="1" max="20" value="2">
              <span id="opt${i}SizeLbl" style="font-size:10px;color:var(--muted)">2px</span>
            </div>
            <canvas id="opt${i}Canvas" width="500" height="46" style="max-width:100%;margin:0 auto"></canvas>
          </div>
          <div class="pdf-opt-box">
            <div class="pdf-opt-head">Option ${String.fromCharCode(65+i)} PDF text</div>
            <div class="field">
              <textarea id="pdfOptionText${i}" spellcheck="true" placeholder="Type the clean bank PDF version of option ${String.fromCharCode(65+i)} here..."
                oninput="setPdfOptionText(${i},this.value)">${escH(typeof getOptionPdfSourceText==='function' ? getOptionPdfSourceText(opt) : displayPdfText(opt.text||''))}</textarea>
              <div class="pdf-linked-head">Selectable Composer Preview</div>
              <div id="pdfOptionLinked${i}" class="pdf-linked-preview"></div>
            </div>
          </div>
        </div>
      </div>
      `).join('')}
    </div>
  </div>
  `}
  `;

  // Init canvases after DOM insertion
  const expectedQuestion=q;
  editorCanvasReadyPromise=new Promise(resolve=>requestAnimationFrame(async ()=>{
    if(cur!==expectedQuestion){ resolve([]); return; }
    const jobs=[initCanvas('q')];
    if(!isNAT) expectedQuestion.options.forEach((_,i)=>jobs.push(initCanvas('opt'+i)));
    if(typeof syncPdfSourceFields==='function') syncPdfSourceFields();
    const settled=await Promise.allSettled(jobs);
    resolve(settled);
  }));
  return editorCanvasReadyPromise;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

