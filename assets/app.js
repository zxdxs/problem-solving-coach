/* ============================================================
   站点共用逻辑：导航渲染 / 本地存储 / 提示 / 导入导出
   所有数据保存在浏览器 localStorage，不上传服务器。
   ============================================================ */
(function(){
  'use strict';

  const KEY_PROGRESS = 'psc_progress_v1';
  const KEY_SHEETS   = 'psc_sheets_v1';
  const KEY_LOGS     = 'psc_logs_v1';
  const KEY_QUIZ     = 'psc_quiz_v1';

  /* ---------- 存储 ---------- */
  function read(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  }
  function write(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e){ toast('保存失败：浏览器存储空间不足或被禁用', 'bad'); return false; }
  }

  /* ---------- 进度数据结构 ---------- */
  function getProgress(){
    const p = read(KEY_PROGRESS, {});
    if(!p.chapters) p.chapters = {};
    return p;
  }
  function setLayer(chapterId, layerKey, val){
    const p = getProgress();
    if(!p.chapters[chapterId]) p.chapters[chapterId] = {};
    p.chapters[chapterId][layerKey] = val;
    p.updatedAt = new Date().toISOString();
    write(KEY_PROGRESS, p);
    refreshNavProgress();
    return p;
  }
  function chapterDone(chapterId){
    const p = getProgress();
    const c = p.chapters[chapterId] || {};
    return PSC_LAYERS.filter(l=>c[l.key]).length;
  }
  function overallPercent(){
    const p = getProgress();
    const total = PSC_CHAPTERS.length * PSC_LAYERS.length;
    let done = 0;
    PSC_CHAPTERS.forEach(ch=>{
      const c = p.chapters[ch.id] || {};
      PSC_LAYERS.forEach(l=>{ if(c[l.key]) done++; });
    });
    return total ? Math.round(done*100/total) : 0;
  }

  /* ---------- 提示条 ---------- */
  let toastTimer = null;
  function toast(msg, kind){
    let el = document.getElementById('psc-toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'psc-toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%) translateY(20px);'+
        'background:#0f172a;color:#fff;padding:11px 20px;border-radius:10px;font-size:14px;z-index:999;'+
        'opacity:0;transition:.25s;box-shadow:0 10px 30px rgba(0,0,0,.3);max-width:88vw;text-align:center;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.background = kind==='bad' ? '#b91c1c' : (kind==='good' ? '#047857' : '#0f172a');
    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2200);
  }

  /* ---------- 导航 ---------- */
  function buildNav(){
    const nav = document.getElementById('nav-links');
    if(!nav) return;
    let html = '<a class="navlink" href="index.html" data-id="index">首页</a>';
    html += '<a class="navlink" href="plan.html" data-id="plan">30 天计划</a>';
    html += '<a class="navlink" href="partner.html" data-id="partner">找陪练</a>';
    PSC_NAV.forEach(g=>{
      html += '<div class="nav-item"><a class="navlink" href="javascript:void(0)">'+g.group+'</a><div class="dropdown">';
      g.items.forEach(it=>{
        const href = it.id==='philosophy' ? 'philosophy.html'
                   : it.id==='practice'  ? 'practice.html'
                   : it.id==='quiz'      ? 'quiz.html'
                   : it.id==='progress'  ? 'progress.html'
                   : 'chapter-'+it.id+'.html';
        html += '<a href="'+href+'" data-id="'+it.id+'">'+it.title+'</a>';
      });
      html += '</div></div>';
    });
    html += '<a class="navlink" href="references.html" data-id="references">延伸阅读</a>';
    html += '<a class="navlink" href="contact.html" data-id="contact">联系与共建</a>';
    html += '<a class="navlink" href="contributors.html" data-id="contributors">贡献者</a>';
    nav.innerHTML = html;
  }

  function refreshNavProgress(){
    const el = document.getElementById('nav-progress');
    if(el) el.textContent = '掌握度 ' + overallPercent() + '%';
    const bar = document.getElementById('nav-progress-bar');
    if(bar) bar.style.width = overallPercent() + '%';
  }

  function setActive(activeId){
    document.querySelectorAll('#nav-links [data-id]').forEach(a=>{
      if(a.getAttribute('data-id')===activeId){
        a.classList.add('active');
        const item = a.closest('.nav-item');
        if(item){ const t = item.querySelector('a.navlink'); if(t) t.classList.add('active'); }
      }
    });
  }

  function renderFooter(el){
    if(!el) return;
    el.innerHTML =
      '<div class="wrap" style="padding-top:0;padding-bottom:26px;">'+
      '<div>解决问题训练站 · 原创教学设计工程　|　所有练习数据保存在你自己的浏览器中，不会上传</div>'+
      '<div style="margin-top:4px;">通用解题策略是百年来的公共智慧积累；站内例题取自流传已久的经典问题与真实工作场景。'+
      '学术源流与方法出处见<a href="references.html">延伸阅读</a>。</div></div>';
  }

  function init(activeId){
    buildNav();
    setActive(activeId);
    refreshNavProgress();
    renderFooter(document.getElementById('site-footer'));
  }

  /* ---------- 工具 ---------- */
  function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
  function fmtDate(iso){
    const d = new Date(iso);
    const p = n => String(n).padStart(2,'0');
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes());
  }
  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function download(filename, text, mime){
    const blob = new Blob([text], {type:(mime||'text/plain')+';charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 200);
  }
  function copyText(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(()=>toast('已复制到剪贴板','good'))
        .catch(()=>toast('复制失败，请手动选择文本','bad'));
    } else { toast('当前浏览器不支持自动复制，请手动选择','bad'); }
  }

  /* ---------- 章节掌握度组件（各章页面共用） ---------- */
  function renderChapterProgress(chapterId, boxId, barId){
    const box = document.getElementById(boxId);
    if(!box) return;
    const p = getProgress().chapters[chapterId] || {};
    let html = '';
    PSC_LAYERS.forEach(l=>{
      const on = !!p[l.key];
      html += '<label class="prog-item'+(on?' on':'')+'"><input type="checkbox" data-layer="'+l.key+'" '+(on?'checked':'')+'>'+
              '<span>'+l.name+'<br><small class="muted">'+l.desc+'</small></span></label>';
    });
    box.innerHTML = html;
    function upd(){
      const n = chapterDone(chapterId);
      const bar = document.getElementById(barId);
      if(bar) bar.style.width = (n*100/PSC_LAYERS.length)+'%';
    }
    box.querySelectorAll('input').forEach(cb=>{
      cb.addEventListener('change', ()=>{
        cb.closest('.prog-item').classList.toggle('on', cb.checked);
        setLayer(chapterId, cb.getAttribute('data-layer'), cb.checked);
        upd();
      });
    });
    upd();
  }

  /* ---------- 导出 ---------- */
  function PSC_API(){}

  window.PSC = {
    KEY_PROGRESS, KEY_SHEETS, KEY_LOGS, KEY_QUIZ,
    read, write, toast, uid, fmtDate, esc, download, copyText,
    getProgress, setLayer, chapterDone, overallPercent,
    init, refreshNavProgress, renderChapterProgress
  };
})();
