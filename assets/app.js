/* ============================================================
   站点共用逻辑：导航渲染 / 本地存储 / 提示 / 导入导出
   所有数据保存在浏览器 localStorage，不上传服务器。
   ============================================================ */
(function(){
  'use strict';

  const KEY_PROGRESS = 'psc_progress_v1';
  const KEY_SHEETS   = 'psc_sheets_v1';
  const KEY_LOGS     = 'psc_logs_v1';
  /* KEY_PLAN：plan.html 页已于 R1-T（1.23.0）整页删除。此 key 与 STORE_KEYS 里的
     plan 栏位保留，只为了让 progress 页的「导出全部／清空全部数据」仍能涵盖
     旧访客 localStorage 里的 psc_plan_v1 残留。不要删除。 */
  const KEY_QUIZ     = 'psc_quiz_v1';
  const KEY_T14 = 'psc_t14', KEY_T15 = 'psc_t15', KEY_T19 = 'psc_t19',
        KEY_DRILLS_DONE = 'psc_drills_done', KEY_PLAN = 'psc_plan_v1';

  /* 全站「学习者数据」清单 —— 唯一真相来源。
     progress.html 的导出／导入／清空都走这一张表；各学习页也改引用这里的 KEY_* 常量。
     以后新增 localStorage key，只改这一处（否则就会重演「导出只覆盖 4 个 key」的旧缺陷）。 */
  const STORE_KEYS = [
    {key:KEY_PROGRESS,    field:'progress'},
    {key:KEY_SHEETS,      field:'sheets'},
    {key:KEY_LOGS,        field:'logs'},
    {key:KEY_QUIZ,        field:'quiz'},
    {key:KEY_T14,         field:'t14'},
    {key:KEY_T15,         field:'t15'},
    {key:KEY_T19,         field:'t19'},
    {key:KEY_DRILLS_DONE, field:'drillsDone'},
    {key:KEY_PLAN,        field:'plan'}   /* R1-T：见上方 KEY_PLAN 注解，勿删 */
  ];

  /* ---------- 存储 ---------- */
  function read(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      if(raw === null || raw === '') return fallback;
      const val = JSON.parse(raw);
      /* JSON.parse('null') === null：null 不是有效数据，一律回退（否则调用方对 null 取属性会抛 TypeError） */
      return (val === null || val === undefined) ? fallback : val;
    }catch(e){ return fallback; }
  }
  function write(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch(e){ toast('保存失败：浏览器存储空间不足或被禁用', 'bad'); return false; }
  }

  /* ---------- 进度数据结构 ---------- */
  function getProgress(){
    let p = read(KEY_PROGRESS, {});
    /* 坏值（null／字符串／数组等）一律回退成 {}，绝不让调用方拿到非对象 */
    if(!p || typeof p !== 'object' || Array.isArray(p)) p = {};
    if(!p.chapters || typeof p.chapters !== 'object' || Array.isArray(p.chapters)) p.chapters = {};
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
    /* 这 4 条是硬编码底线：即使 data.js 载入失败／PSC_NAV 结构异常，导航也不能整片消失
       （首页 ＋ 找陪练 ＋ 版权溯源 ＋ 联系与共建；R1-U 后「延伸阅读」升为群组，故为 4 而非 5） */
    let html = '<a class="navlink" href="index.html" data-id="index">首页</a>';
    /* 「找陪练」的位置由业主指定：排在「练技能」与「延伸阅读」之间（R1-AA）。
       降级态（data.js 挂了）时仍在下面单独补一条，见 !navGroups 分支。 */
    const partnerLink = '<a class="navlink" href="partner.html" data-id="partner">找陪练</a>';
    let navGroups = false;
    try{
      if(typeof PSC_NAV !== 'undefined' && PSC_NAV && typeof PSC_NAV.forEach === 'function'){
        PSC_NAV.forEach(g=>{
          html += '<div class="nav-item"><a class="navlink" href="javascript:void(0)">'+g.group+'</a><div class="dropdown">';
          (g.items||[]).forEach(it=>{
            const href = it.id==='lessons' ? 'lessons.html'
                       : it.id==='philosophy' ? 'philosophy.html'
                       : it.id==='practice'  ? 'practice.html'
                       : it.id==='drills'    ? 'drills.html'
                       : it.id==='quiz'      ? 'quiz.html'
                       : it.id==='progress'  ? 'progress.html'
                       : it.id==='nonstep'   ? 'nonstep.html'
                       : it.id==='errors'    ? 'errors.html'
                       : it.id==='partner'   ? 'partner.html'
                       : it.id==='provenance' ? 'provenance.html'
                       : it.id==='references' ? 'references.html'
                       : 'chapter-'+it.id+'.html';
            html += '<a href="'+href+'" data-id="'+it.id+'">'+it.title+'</a>';
          });
          html += '</div></div>';
          if(g.group === '练技能'){ html += partnerLink; }
        });
        navGroups = true;
      }
    }catch(e){
      /* 分组渲染失败不影响下面的硬编码入口；已在 html 里的部分照常输出 */
      try{ console.warn('[PSC] 导航分组渲染失败，已降级：', e); }catch(_){}
    }
    /* data.js 没载入（或分组渲染失败）时，导航只剩固定入口。
       补上「版权 · 授权 · 溯源」——它是版权／授权／备案时第一个被引用的页面，
       不能因为数据文件挂了就到不了（R1-H 删掉贡献者页、R1-T 删掉 plan 页之后，
       固定入口只剩「首页／找陪练」2 条；加上本行与尾端「延伸阅读／联系与共建」2 条，
       降级态共 5 条；data.js 正常时它已在 PSC_NAV 里，不会重复输出）。 */
    if(!navGroups){
      html += partnerLink;
      html += '<a class="navlink" href="provenance.html" data-id="provenance">版权 · 授权 · 溯源</a>';
    }
    html += '<a class="navlink" href="contact.html" data-id="contact">联系与共建</a>';
    nav.innerHTML = html;
    buildNavToggle(nav);
  }

  /* ---------- 窄屏导航：汉堡按钮 ＋ 点击展开（>640px 时按钮 display:none，行为完全不变） ---------- */
  function isNarrowNav(){
    try{ return !!(window.matchMedia && window.matchMedia('(max-width:640px)').matches); }
    catch(e){ return false; }
  }

  function navParts(){
    const nav = document.getElementById('nav-links');
    if(!nav) return {nav:null, toggle:null};
    const inner = nav.parentNode;
    return {nav:nav, toggle: inner ? inner.querySelector('.nav-toggle') : null};
  }

  /* 收起/展开整个导航（窄屏用）。open=true 展开 */
  function setNavOpen(open){
    const p = navParts();
    if(p.nav){
      if(open) p.nav.setAttribute('data-open','true');
      else{
        p.nav.removeAttribute('data-open');
        p.nav.querySelectorAll('.nav-item[data-open="true"]').forEach(function(o){
          o.setAttribute('data-open','false');
        });
      }
    }
    if(p.toggle){
      p.toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      p.toggle.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    }
  }

  function buildNavToggle(nav){
    const inner = nav.parentNode;
    if(!inner) return;
    let btn = inner.querySelector('.nav-toggle');
    if(!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'nav-toggle';
      btn.setAttribute('aria-label','打开导航菜单');
      btn.innerHTML = '<span class="bars" aria-hidden="true"></span>';
      inner.appendChild(btn);
    }
    btn.setAttribute('aria-expanded','false');
    btn.onclick = function(){ setNavOpen(nav.getAttribute('data-open') !== 'true'); };

    /* 分组标题：窄屏下点击展开/收起该组下拉（宽屏仍走 hover／focus-within，不拦截）
       各组互不影响（非手风琴）：4 组可同时展开，展开后 28 个链接全部可见 */
    nav.querySelectorAll('.nav-item > a.navlink').forEach(function(a){
      a.addEventListener('click', function(e){
        if(!isNarrowNav()) return;
        e.preventDefault();
        const item = a.parentNode;
        if(item.getAttribute('data-open') === 'true') item.removeAttribute('data-open');
        else item.setAttribute('data-open','true');
      });
    });

    /* 点击任意真实链接后，窄屏下自动收起整个菜单 */
    nav.addEventListener('click', function(e){
      let t = e.target;
      while(t && t !== nav && t.tagName !== 'A') t = t.parentNode;
      if(!t || t === nav) return;
      const href = t.getAttribute('href') || '';
      if(!href || href.indexOf('javascript:') === 0) return;   // 分组标题不是真链接
      if(isNarrowNav()) setNavOpen(false);
    });
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
      '<div>解决问题训练站　|　所有练习数据保存在你自己的浏览器中，不会上传</div>'+
      /* 站名一句：来自 data.js 的 PSC_SITE.slogan。data.js 不在时不显示这一行
         （刻意不在这里写硬编码字面——那会变成第二个真相来源）。 */
      (function(){
        try{
          if(typeof PSC_SITE==='undefined' || !PSC_SITE || !PSC_SITE.slogan) return '';
          return '<div style="margin-top:4px;"><b>'+esc(PSC_SITE.slogan)+'</b></div>';
        }catch(e){ return ''; }
      })()+
      '<div style="margin-top:4px;">本站五步策略与训练体系，'+
      '本于 <b>江丕权、李越、戴国强</b> 编著《解决问题的策略与技能》（科学普及出版社，1992）。'+
      '原书的方法与例题归三位编著者及出版者所有；本站所做，是把它整理成可练习、可验收的形式，'+
      '并补上原书未能承载的反馈与陪练。<br>'+
      '通用解题策略是百年来的公共智慧积累（Polya 1945、Woods 等）；'+
      '站内例题取自流传已久的经典问题与真实工作场景。'+
      '完整学术源流与方法出处见<a href="references.html">延伸阅读</a>。</div>'+
      /* 题库版本号：出问题时先问用户页脚这一行。见 data.js 头部 PSC_VERSION 注释。
         data.js 载入失败时退回建置时兜底版本号，保证页脚永远有内容、有版本号。 */
      (function(){
        try{
          if(typeof PSC_VERSION!=='undefined' && PSC_VERSION){
            const v = PSC_VERSION;
            return '<div style="margin-top:6px;">题库版本 '+
              v.major+'.'+v.minor+'.'+v.patch+'　·　'+v.date+'　·　'+esc(v.codename)+'</div>';
          }
        }catch(e){}
        /* 不再有兜底版本號：一個「錯的」版本號比「未載入」更糟——
           使用者回報 bug 時會報錯版本，我們會往錯的方向查。
           所以這裡只說「未載入」，不得含任何 \d+\.\d+\.\d+。 */
        return '<div style="margin-top:6px;">题库版本：数据文件未载入</div>';
      })()+
      '<div style="margin-top:6px;">© 2026 solve-lab.cn　｜　内容为学习用途的转述与改写，'
      +'原书《解决问题的策略与技能》（江丕权、李越、戴国强编著，科学普及出版社，1992）'
      +'权利归三位编著者及出版者　｜　书目与出处见<a href="references.html">延伸阅读</a>　｜　'
      +'版权、授权状态与版本沿革见<a href="provenance.html">版权 · 授权 · 版本溯源</a></div>'
      +'</div>';
  }

  function init(activeId){
    /* 每一步各自兜底：任一环节抛错（最典型的是 data.js 没载入）都不能吃掉后面的页脚。
       页脚放最后，但由 safe() 保证前面任何一步失败都不再影响它。 */
    function safe(label, fn){
      try{ fn(); }
      catch(e){ try{ console.warn('[PSC] '+label+' 失败：', e); }catch(_){} }
    }
    safe('buildNav',           ()=>buildNav());
    safe('setActive',          ()=>setActive(activeId));
    safe('refreshNavProgress', ()=>refreshNavProgress());
    safe('renderFooter',       ()=>renderFooter(document.getElementById('site-footer')));
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
  /* 强调渲染：数据里用双星号包起来的词，是编写时的 Markdown 强调标记。
     本站不渲染 Markdown，直接输出会把星号原样显示出来（即 precheck 说的「Markdown 泄漏」）。
     先转义再换成粗体标签，顺序不能反（反过来会把标签本身当数据转义掉）。 */
  function em(s){
    return esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
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

  /* ---------- 全部学习数据的导出／导入／清空 ----------
     exportAll：回传 {app, version:2, exportedAt, + STORE_KEYS 的 9 个 field}
     importAll：逐 field——档里有就写、没有就保持原值；对 null／非物件／缺 field 一律容错，
                绝不清掉未提供的 key（旧的 4-field 导出档仍可导入）。
     clearAll ：清掉 STORE_KEYS 全部 9 个 key。 */
  function exportAll(){
    const out = {app:'解决问题训练站', version:2, exportedAt:new Date().toISOString()};
    STORE_KEYS.forEach(o=>{ out[o.field] = read(o.key, null); });
    return out;
  }
  function importAll(d){
    if(!d || typeof d !== 'object' || Array.isArray(d)) return false;
    STORE_KEYS.forEach(o=>{
      if(Object.prototype.hasOwnProperty.call(d, o.field) && d[o.field] !== undefined){
        write(o.key, d[o.field]);
      }
    });
    return true;
  }
  function clearAll(){
    STORE_KEYS.forEach(o=>{ try{ localStorage.removeItem(o.key); }catch(e){} });
  }

  window.PSC = {
    KEY_PROGRESS, KEY_SHEETS, KEY_LOGS, KEY_QUIZ,
    KEY_T14, KEY_T15, KEY_T19, KEY_DRILLS_DONE, KEY_PLAN, STORE_KEYS,
    exportAll, importAll, clearAll,
    read, write, toast, uid, fmtDate, esc, em, download, copyText,
    getProgress, setLayer, chapterDone, overallPercent,
    init, refreshNavProgress, renderChapterProgress
  };
})();
