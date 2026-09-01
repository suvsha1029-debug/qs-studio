//  LIVE PAPER PREVIEW
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function renderPaperNow(){
  const body=document.getElementById('paperBody');
  const meta=document.getElementById('paperMeta');
  const pfL=document.getElementById('pfLeft');
  const titleEl=document.getElementById('paperTitle');
  const total=qs.reduce((s,q)=>s+q.marks,0);
  const firstMeta = getSubjectMeta(qs[0]?.subject || subjects[0]?.short || 'EC');
  if(titleEl) titleEl.textContent = examName || 'Untitled Project';
  meta.textContent=qs.length?`${qs.length} question${qs.length!==1?'s':''} · Subject ${firstMeta.short} · Section ${getSectionDisplay(firstMeta)} · Total ${total}M`:(examName ? '0 questions' : 'Create or open a question bank');
  pfL.textContent=qs.length?`Q1-Q${qs.length} | Section: ${getSectionDisplay(firstMeta)} | Total: ${total}M`:(examName ? 'No questions' : 'No active project');
  if(!qs.length){
    if(paperLazyObserver) paperLazyObserver.disconnect();
    body.innerHTML='<div style="padding:20px;text-align:center;font-size:11px;color:#aaa;font-family:Times New Roman,serif">Project is empty.</div>';
    return;
  }
  body.innerHTML=qs.map((q,i)=>{
    const sm=getSubjectMeta(q.subject);
    const qText=stripFigureMarkers(getPaperQuestionText(q));
    const qPreviewImage=q.questionViewerImage || q.questionImage || '';
    const qImg=!qText && qPreviewImage?`<img class="pq-img paper-lazy-img" loading="lazy" decoding="async" alt="" data-src="${qPreviewImage}">`:'';
    const isNAT=q.type==='NAT';
    let opts='';
    if(!isNAT){
      opts=`<div class="pq-opts">`+q.options.map((o,j)=>`
        <div class="pq-opt">
          <span class="ol">(${String.fromCharCode(65+j)})</span>
          <div class="pq-opt-body">
            ${stripFigureMarkers(getPaperOptionText(o))?`<div class="pq-opt-text">${escH(stripFigureMarkers(getPaperOptionText(o))).replace(/\n/g,'<br>')}</div>`:''}
            ${!stripFigureMarkers(getPaperOptionText(o)) && (o.viewerImage||o.image)?`<img class="paper-lazy-img" loading="lazy" decoding="async" alt="" data-src="${o.viewerImage||o.image}">`:''}
            ${!stripFigureMarkers(getPaperOptionText(o)) && !(o.viewerImage||o.image)?'<span style="color:#bbb;font-size:10px">(empty)</span>':''}
          </div>
        </div>`).join('')+'</div>';
    } else {
      opts='<div style="color:#aaa;font-size:10px;font-family:Times New Roman,serif;margin-top:4px;margin-left:4px">Answer: ___________</div>';
    }
    return `<div class="paper-q">
      <span class="pq-num">Q.${i+1}</span>
      <div class="pq-body">
        ${qText?`<div class="pq-text">${escH(qText).replace(/\n/g,'<br>')}</div>`:''}
        ${qImg}
        ${opts}
        <div class="pq-meta">[${q.type}] +${q.marks}M ${q.negMarks}M &nbsp;·&nbsp; ${sm.section}</div>
      </div>
    </div>`;
  }).join('');
  hydratePaperLazyImages();
}

let paperLazyObserver = null;
function settlePaperPreviewImage(img, timeoutMs=5000){
  if(!img) return Promise.resolve(false);
  const pendingSrc=String(img.dataset?.src||'');
  img.loading='eager';
  img.decoding='async';
  return new Promise(resolve=>{
    let settled=false;
    const finish=async ok=>{
      if(settled) return;
      settled=true;
      clearTimeout(timer);
      img.removeEventListener('load',onLoad);
      img.removeEventListener('error',onError);
      if(ok && typeof img.decode==='function'){
        try{
          await Promise.race([
            img.decode(),
            new Promise(done=>setTimeout(done,Math.min(450,timeoutMs)))
          ]);
        }catch(_){ }
      }
      img.dataset.paperLoadState=ok?'ready':'failed';
      resolve(ok);
    };
    const onLoad=()=>finish(true);
    const onError=()=>finish(false);
    const timer=setTimeout(()=>finish(false),Math.max(300,timeoutMs));
    img.addEventListener('load',onLoad,{once:true});
    img.addEventListener('error',onError,{once:true});
    if(pendingSrc){
      img.src=pendingSrc;
      img.removeAttribute('data-src');
    }
    if(img.complete) finish(img.naturalWidth>0);
  });
}

async function hydratePaperLazyImages(options={}){
  const eager=options===true || options?.eager===true;
  const imgs=[...document.querySelectorAll('#paperBody img[data-src]')];
  if(!imgs.length){
    if(paperLazyObserver) paperLazyObserver.disconnect();
    return {total:0,loaded:0,failed:0};
  }
  const loadImg=img=>{
    if(!img || (!img.dataset?.src && !img.getAttribute('src'))) return Promise.resolve(false);
    return settlePaperPreviewImage(img,5000);
  };
  if(eager){
    if(paperLazyObserver) paperLazyObserver.disconnect();
    // Prime every viewer asset at once so the browser can schedule decoding in
    // parallel. Workers below only bound the heavier decode/terminal waits.
    imgs.forEach(img=>{
      const src=String(img.dataset?.src||'');
      img.loading='eager';
      img.decoding='async';
      if(src){
        img.src=src;
        img.removeAttribute('data-src');
      }
    });
    let cursor=0, loaded=0, failed=0;
    const workers=Array.from({length:Math.min(12,imgs.length)},async ()=>{
      while(cursor<imgs.length){
        const img=imgs[cursor++];
        if(await loadImg(img)) loaded++;
        else failed++;
      }
    });
    await Promise.all(workers);
    return {total:imgs.length,loaded,failed};
  }
  if(!('IntersectionObserver' in window)){
    const settled=await Promise.all(imgs.map(loadImg));
    return {total:imgs.length,loaded:settled.filter(Boolean).length,failed:settled.filter(value=>!value).length};
  }
  if(paperLazyObserver) paperLazyObserver.disconnect();
  paperLazyObserver = new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        loadImg(entry.target);
        paperLazyObserver.unobserve(entry.target);
      }
    });
  }, { root:document.getElementById('paperScroll'), rootMargin:'420px 0px' });
  imgs.forEach(img=>paperLazyObserver.observe(img));
  return {total:imgs.length,loaded:0,failed:0,deferred:true};
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
let _paperRenderQueued=false;
function renderPaper(force=false){
  if(force===true){
    _paperRenderQueued=false;
    return renderPaperNow();
  }
  if(_paperRenderQueued) return;
  _paperRenderQueued=true;
  const run=()=>{
    _paperRenderQueued=false;
    renderPaperNow();
  };
  if(window.requestAnimationFrame) setTimeout(()=>requestAnimationFrame(run), 45);
  else setTimeout(run, 45);
}
//  PNG EXPORT (single question exam frame)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
function setFrame(s,el){
  frame=s;
  document.querySelectorAll('.fp').forEach(e=>e.classList.remove('sel'));
  el.classList.add('sel');
}

function exportOnePNG(){
  if(!cur){showNotice('Select a question first.', 'PNG Export');return;}
  renderQtoPNG(cur, frame, dataUrl=>{
    const a=document.createElement('a');
    a.download=cur.qid+'.png'; a.href=dataUrl; a.click();
    toast('PNG: '+cur.qid+'.png');
  });
}

function renderQtoPNG(q, style, cb){
  const isDark=style==='dark';
  const bg=isDark?'#181818':'#ffffff';
  const fg=isDark?'#f0f0f0':'#111111';
  const muted=isDark?'#999':'#666';
  const sepClr=isDark?'#3a3a3a':'#cccccc';
  const bdr=isDark?'#555':'#333';
  const sm=getSubjectMeta(q.subject);
  const qText=getPaperQuestionText(q);
  function fitForExportImage(img, maxW, maxH){
    if(!img) return {w:0,h:0};
    const iw=img.naturalWidth||img.width||1;
    const ih=img.naturalHeight||img.height||1;
    const scale=Math.min(maxW/Math.max(1,iw), maxH/Math.max(1,ih), 1);
    return {
      w:Math.max(1, Math.round(iw*scale)),
      h:Math.max(1, Math.round(ih*scale))
    };
  }

  const promises=[];
  let qImg=null;
  const optImgs=[];

  if(!qText && q.questionImage){
    promises.push(new Promise(res=>{
      const img=new Image(); img.onload=()=>{qImg=img;res();}; img.onerror=res;
      img.src=q.questionImage;
    }));
  }
  if(q.type!=='NAT'){
    q.options.forEach((opt,i)=>{
      optImgs.push(null);
      if(!hasPaperText(opt.text) && opt.image){
        const idx=i;
        promises.push(new Promise(res=>{
          const img=new Image(); img.onload=()=>{optImgs[idx]=img;res();}; img.onerror=res;
          img.src=opt.image;
        }));
      }
    });
  }

  Promise.all(promises).then(()=>{
    const W=620, PAD=26;
    const cv=document.getElementById('xcanvas');
    let ctx=cv.getContext('2d');
    cv.width=W;
    const textMaxW=W-PAD*2-30;
    const qFont='15px "Times New Roman",serif';
    const qLine=24;
    const optFont='14px "Times New Roman",serif';
    const optLine=22;
    const qTextH=qText?measureCanvasText(ctx,qText,textMaxW,qFont,qLine):0;
    const qFit=qImg?fitForExportImage(qImg,textMaxW,240):{w:0,h:0};
    const QH=qFit.h;
    let H=PAD+24+18+Math.max(qTextH,0)+(qTextH?12:0)+QH+20;
    if(q.type==='NAT'){
      H+=36;
    } else {
      q.options.forEach((opt,i)=>{
        const oimg=optImgs[i];
        const oText=getPaperOptionText(opt);
        if(oText){
          H+=Math.max(32, measureCanvasText(ctx,oText,textMaxW-34,optFont,optLine)+12);
        } else if(oimg){
          H+=fitForExportImage(oimg,W-PAD*2-36,90).h+16;
        } else {
          H+=32;
        }
        H+=8;
      });
    }
    H+=36;
    const logicalH=Math.max(H,200);
    cv.width=Math.round(W*EXPORT_IMAGE_SCALE);
    cv.height=Math.round(logicalH*EXPORT_IMAGE_SCALE);
    ctx=cv.getContext('2d');
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.scale(EXPORT_IMAGE_SCALE, EXPORT_IMAGE_SCALE);

    ctx.fillStyle=bg; ctx.fillRect(0,0,W,logicalH);

    if(style==='exam'){
      ctx.strokeStyle=bdr; ctx.lineWidth=2; ctx.strokeRect(10,10,W-20,logicalH-20);
      ctx.strokeStyle='#888'; ctx.lineWidth=.5; ctx.strokeRect(16,16,W-32,logicalH-32);
    } else if(style==='minimal'){
      ctx.strokeStyle='#ccc'; ctx.lineWidth=1; ctx.strokeRect(0,0,W,logicalH);
    }

    let y=PAD+4;

    ctx.fillStyle=muted; ctx.font='10px "Courier New",monospace';
    ctx.fillText(`${q.type}  |  +${q.marks}M  ${q.negMarks}M`, PAD, y);
    const rTxt=`Subject: ${sm.short} | Section: ${getSectionDisplay(sm)}`;
    ctx.fillText(rTxt, W-PAD-ctx.measureText(rTxt).width, y);
    y+=14;
    ctx.strokeStyle=sepClr; ctx.lineWidth=.7;
    ctx.beginPath(); ctx.moveTo(PAD,y); ctx.lineTo(W-PAD,y); ctx.stroke();
    y+=12;

    ctx.fillStyle=fg; ctx.font='bold 13px "Times New Roman",serif';
    const qnum=(qs.indexOf(q)+1)+'.';
    ctx.fillText(qnum, PAD, y+13);
    let bodyTop=y;
    if(qText){
      ctx.fillStyle=fg;
      y+=drawCanvasText(ctx,qText,PAD+28,bodyTop,textMaxW,qFont,qLine,fg)+4;
    } else if(qImg){
      const drawW=qFit.w;
      const drawH=qFit.h;
      ctx.drawImage(qImg, PAD+28, bodyTop, drawW, drawH);
      y+=drawH+4;
    } else {
      ctx.fillStyle='#bbb'; ctx.font='11px sans-serif';
      ctx.fillText('(empty question)', PAD+28, y+16);
      y+=24;
    }
    y+=10;

    if(q.type==='NAT'){
      ctx.fillStyle='#f8f7f4'; ctx.fillRect(PAD,y,W-PAD*2,32);
      ctx.strokeStyle=sepClr; ctx.lineWidth=.5; ctx.strokeRect(PAD,y,W-PAD*2,32);
      ctx.fillStyle=fg; ctx.font='12px "Times New Roman",serif';
      ctx.fillText('Answer: _____________________________', PAD+10, y+20);
      y+=44;
    } else {
      q.options.forEach((opt,i)=>{
        const oimg=optImgs[i];
        const oText=getPaperOptionText(opt);
        const optH=oText
          ? Math.max(32, measureCanvasText(ctx,oText,textMaxW-34,optFont,optLine)+12)
          : (oimg?fitForExportImage(oimg,W-PAD*2-36,90).h+16:32);
        ctx.fillStyle='#f8f7f4'; ctx.fillRect(PAD,y,W-PAD*2,optH);
        ctx.strokeStyle=sepClr; ctx.lineWidth=.5; ctx.strokeRect(PAD,y,W-PAD*2,optH);
        ctx.fillStyle=fg; ctx.font='bold 12px "Times New Roman",serif';
        ctx.fillText('('+String.fromCharCode(65+i)+')', PAD+6, y+optH/2+4);
        if(oText){
          drawCanvasText(ctx,oText,PAD+26,y+6,textMaxW-8,optFont,optLine,fg);
        } else if(oimg){
          const fit=fitForExportImage(oimg,W-PAD*2-36,90);
          const ow=fit.w;
          const oh=fit.h;
          ctx.drawImage(oimg, PAD+26, y+6, ow, oh);
        }
        y+=optH+5;
      });
    }

    y+=10;
    ctx.strokeStyle=sepClr; ctx.lineWidth=.5;
    ctx.beginPath(); ctx.moveTo(PAD,y); ctx.lineTo(W-PAD,y); ctx.stroke();
    y+=14;
    ctx.fillStyle=muted; ctx.font='9px "Courier New",monospace';
    ctx.fillText('QS Studio  |  '+new Date().toLocaleDateString()+'  |  Paper export', PAD, y);

    cb(cv.toDataURL('image/png'));
  });
}




