/* ============================================================
   训练中心：五步执行单 / 我的练习库 / 训练日志
   数据保存在浏览器 localStorage
   ============================================================ */
(function(){
  'use strict';

  let editingId = null;

  /* ---------- 选项卡 ---------- */
  function bindTabs(){
    document.querySelectorAll('.tab').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const t = btn.getAttribute('data-tab');
        document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on', b===btn));
        document.querySelectorAll('.panel').forEach(p=>p.classList.toggle('on', p.id==='tab-'+t));
      });
    });
  }

  /* ---------- 渲染执行单 ---------- */
  function renderSheetForm(){
    const box = document.getElementById('sheet-form');
    if(!box) return;
    let html = '';
    html += '<label class="f">题目 / 我要解决的问题<span style="color:#b91c1c"> *</span></label>'+
            '<input type="text" id="f-title" placeholder="例：部门的周会总是严重超时">';
    html += '<div style="display:flex;gap:12px;flex-wrap:wrap">'+
            '<div style="flex:1 1 160px"><label class="f">领域标签</label>'+
            '<select id="f-domain"><option>工作决策</option><option>项目排期</option><option>学习备考</option>'+
            '<option>人际沟通</option><option>数理题</option><option>工程问题</option><option>生活琐事</option><option>其他</option></select></div>'+
            '<div style="flex:1 1 160px"><label class="f">投入时间（分钟）</label>'+
            '<input type="number" id="f-minutes" min="0" placeholder="如 25"></div></div>';

    PSC_STEPS.forEach(s=>{
      html += '<div class="step-card">'+
        '<h4>第 '+s.no+' 步 · '+s.name+'</h4>'+
        '<p class="goal">目的：'+s.goal+'</p>'+
        '<div class="act-list"><b>可做动作：</b>'+s.actions.join(' / ')+'</div>'+
        '<label class="f">本步产出物（'+s.output+'）</label>'+
        '<textarea id="f-step'+s.no+'" placeholder="'+s.output+'&#10;自问：'+s.check+'"></textarea>'+
        '</div>';
    });

    html += '<fieldset><legend>错误归因（完成后勾选，可多选）</legend>';
    PSC_ERRORS.forEach((e,i)=>{
      html += '<label class="checkline"><input type="checkbox" class="f-err" value="'+PSC.esc(e.k)+'">'+
              '<span><b>'+e.k+'</b>　<span class="muted">'+e.d+'</span></span></label>';
    });
    html += '</fieldset>';

    html += '<label class="f">一句话范例化（笛卡儿式收尾：这类问题以后都能怎么解？）</label>'+
            '<textarea id="f-gem" placeholder="凡是……的问题，都可以用……来处理。"></textarea>';

    html += '<div class="btn-row">'+
            '<button class="btn" id="btn-save">保存到我的练习库</button>'+
            '<button class="btn ghost" id="btn-print">打印 / 存为 PDF</button>'+
            '<button class="btn ghost" id="btn-md">导出 Markdown</button>'+
            '<button class="btn ghost" id="btn-clear">清空重写</button>'+
            '</div>';
    box.innerHTML = html;

    document.getElementById('btn-save').addEventListener('click', saveSheet);
    document.getElementById('btn-clear').addEventListener('click', ()=>{ resetForm(); PSC.toast('已清空','good'); });
    document.getElementById('btn-print').addEventListener('click', ()=>window.print());
    document.getElementById('btn-md').addEventListener('click', ()=>{
      const s = currentSheetData();
      if(!s.title){ PSC.toast('请先填写题名','bad'); return; }
      PSC.download(sheetFileName(s)+'.md', sheetToMarkdown(s), 'text/markdown');
    });
  }

  function currentSheetData(){
    const steps = {};
    PSC_STEPS.forEach(s=>{
      steps['step'+s.no] = (document.getElementById('f-step'+s.no)||{}).value || '';
    });
    const errs = Array.from(document.querySelectorAll('.f-err:checked')).map(c=>c.value);
    return {
      id: editingId || PSC.uid(),
      title: (document.getElementById('f-title')||{}).value || '',
      domain: (document.getElementById('f-domain')||{}).value || '其他',
      minutes: (document.getElementById('f-minutes')||{}).value || '',
      steps: steps,
      errors: errs,
      gem: (document.getElementById('f-gem')||{}).value || '',
      createdAt: editingId ? (findSheet(editingId)||{}).createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function filledCount(s){
    return PSC_STEPS.filter(st => (s.steps['step'+st.no]||'').trim().length>0).length;
  }

  function sheetFileName(s){
    return '五步执行单_' + (s.title||'未命名').replace(/[\\/:*?“<>|]/g,'').slice(0,24);
  }

  function sheetToMarkdown(s){
    let md = '# 五步执行单：' + (s.title||'未命名') + '\n\n';
    md += '- 领域：' + s.domain + '\n- 投入时间：' + (s.minutes||'未填') + ' 分钟\n';
    md += '- 记录时间：' + PSC.fmtDate(s.updatedAt) + '\n\n';
    PSC_STEPS.forEach(st=>{
      md += '## 第 '+st.no+' 步 · '+st.name+'\n\n';
      md += '> 目的：' + st.goal + '\n\n';
      md += (s.steps['step'+st.no] || '（未填写）') + '\n\n';
    });
    if(s.errors && s.errors.length){ md += '## 错误归因\n\n- ' + s.errors.join('\n- ') + '\n\n'; }
    if(s.gem){ md += '## 一句话范例化\n\n' + s.gem + '\n'; }
    return md;
  }

  function saveSheet(){
    const s = currentSheetData();
    if(!s.title.trim()){ PSC.toast('请先填写”题目 / 我要解决的问题“','bad'); return; }
    const list = PSC.read(PSC.KEY_SHEETS, []);
    const i = list.findIndex(x=>x.id===s.id);
    if(i>=0) list[i]=s; else list.unshift(s);
    PSC.write(PSC.KEY_SHEETS, list);
    editingId = s.id;
    PSC.toast('已保存到我的练习库','good');
    renderLibrary();
  }

  function findSheet(id){
    return PSC.read(PSC.KEY_SHEETS, []).find(x=>x.id===id);
  }

  function loadSheetIntoForm(s){
    editingId = s.id;
    document.getElementById('f-title').value = s.title || '';
    document.getElementById('f-domain').value = s.domain || '其他';
    document.getElementById('f-minutes').value = s.minutes || '';
    PSC_STEPS.forEach(st=>{
      document.getElementById('f-step'+st.no).value = (s.steps && s.steps['step'+st.no]) || '';
    });
    document.querySelectorAll('.f-err').forEach(c=>{
      c.checked = (s.errors||[]).indexOf(c.value) >= 0;
    });
    document.getElementById('f-gem').value = s.gem || '';
    window.scrollTo({top:0, behavior:'smooth'});
  }

  function resetForm(){
    editingId = null;
    document.getElementById('f-title').value = '';
    document.getElementById('f-minutes').value = '';
    PSC_STEPS.forEach(st=>{ document.getElementById('f-step'+st.no).value=''; });
    document.querySelectorAll('.f-err').forEach(c=>c.checked=false);
    document.getElementById('f-gem').value = '';
  }

  /* ---------- 练习库 ---------- */
  function renderLibrary(){
    const box = document.getElementById('lib-list');
    if(!box) return;
    const list = PSC.read(PSC.KEY_SHEETS, []);
    document.getElementById('lib-count').textContent = list.length;
    if(!list.length){
      box.innerHTML = '<p class=”muted“>练习库还是空的。到”五步执行单“做一题并保存，过程就会记录在这里。</p>';
      return;
    }
    let html = '';
    list.forEach(s=>{
      const n = filledCount(s);
      const cls = n===5 ? 'full' : (n>=3 ? 'part' : '');
      html += '<div class=”lib-item“ data-id=”'+s.id+'“>'+
        '<div class=”hd“><span class=”tt“>'+PSC.esc(s.title)+'</span>'+
        '<span class=”chip '+cls+'“>'+n+'/5 步</span>'+
        '<span class=”meta“>'+PSC.esc(s.domain)+' · '+PSC.fmtDate(s.updatedAt)+'</span></div>'+
        '<div class=”btn-row“ style=”margin:8px 0 0“>'+
        '<button class=”btn sm ghost act-view“>查看</button>'+
        '<button class=”btn sm ghost act-edit“>载入编辑</button>'+
        '<button class=”btn sm ghost act-md“>导出 MD</button>'+
        '<button class=”btn sm ghost act-del“>删除</button>'+
        '</div>'+
        '<div class=”lib-body“>'+PSC.esc(sheetToMarkdown(s))+'</div></div>';
    });
    box.innerHTML = html;

    box.querySelectorAll('.lib-item').forEach(item=>{
      const id = item.getAttribute('data-id');
      item.querySelector('.act-view').addEventListener('click', ()=>{
        item.querySelector('.lib-body').classList.toggle('show');
      });
      item.querySelector('.act-edit').addEventListener('click', ()=>{
        loadSheetIntoForm(findSheet(id));
        document.querySelector('.tab[data-tab=”sheet“]').click();
        PSC.toast('已载入，可继续编辑','good');
      });
      item.querySelector('.act-md').addEventListener('click', ()=>{
        const s = findSheet(id);
        PSC.download(sheetFileName(s)+'.md', sheetToMarkdown(s), 'text/markdown');
      });
      item.querySelector('.act-del').addEventListener('click', ()=>{
        if(!confirm('确定删除这条练习记录？此操作不可恢复。')) return;
        let l = PSC.read(PSC.KEY_SHEETS, []);
        l = l.filter(x=>x.id!==id);
        PSC.write(PSC.KEY_SHEETS, l);
        PSC.toast('已删除','good');
        renderLibrary();
      });
    });
  }

  /* ---------- 训练日志 ---------- */
  function renderLogs(){
    const box = document.getElementById('log-list');
    if(!box) return;
    const logs = PSC.read(PSC.KEY_LOGS, []);
    document.getElementById('log-count').textContent = logs.length;
    if(!logs.length){
      box.innerHTML = '<p class=”muted“>还没有日志。训练完随手记一句：今天卡在哪一步、下次怎么改。积累 20 条，你会清楚看见自己的变化。</p>';
      return;
    }
    let html = '';
    logs.forEach(l=>{
      html += '<div class=”lib-item“ data-id=”'+l.id+'“>'+
        '<div class=”hd“><span class=”tt“>'+PSC.esc(l.text.split('\n')[0].slice(0,60))+'</span>'+
        '<span class=”meta“>'+PSC.fmtDate(l.createdAt)+'</span></div>'+
        (l.text.indexOf('\n')>=0 ? '<div class=”lib-body show“ style=”margin-top:8px“>'+PSC.esc(l.text)+'</div>' : '')+
        '<div class=”btn-row“ style=”margin:8px 0 0“>'+
        '<button class=”btn sm ghost act-full“>展开全文</button>'+
        '<button class=”btn sm ghost act-del“>删除</button></div></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('.lib-item').forEach(item=>{
      const id = item.getAttribute('data-id');
      item.querySelector('.act-full').addEventListener('click', ()=>{
        const b = item.querySelector('.lib-body');
        if(b) b.classList.toggle('show');
      });
      item.querySelector('.act-del').addEventListener('click', ()=>{
        if(!confirm('确定删除这条日志？')) return;
        let l = PSC.read(PSC.KEY_LOGS, []);
        l = l.filter(x=>x.id!==id);
        PSC.write(PSC.KEY_LOGS, l);
        renderLogs();
      });
    });
  }

  function initLogs(){
    const btn = document.getElementById('btn-log-add');
    if(!btn) return;
    btn.addEventListener('click', ()=>{
      const t = document.getElementById('log-input').value.trim();
      if(!t){ PSC.toast('请先写点什么','bad'); return; }
      const logs = PSC.read(PSC.KEY_LOGS, []);
      logs.unshift({id:PSC.uid(), text:t, createdAt:new Date().toISOString()});
      PSC.write(PSC.KEY_LOGS, logs);
      document.getElementById('log-input').value='';
      PSC.toast('已记录','good');
      renderLogs();
    });
    const exp = document.getElementById('btn-log-export');
    if(exp) exp.addEventListener('click', ()=>{
      const logs = PSC.read(PSC.KEY_LOGS, []);
      if(!logs.length){ PSC.toast('还没有日志','bad'); return; }
      let md = '# 训练日志\n\n';
      logs.forEach(l=>{ md += '## '+PSC.fmtDate(l.createdAt)+'\n\n'+l.text+'\n\n'; });
      PSC.download('训练日志.md', md, 'text/markdown');
    });
  }

  /* ---------- 库级导出 ---------- */
  function initLibExport(){
    const a = document.getElementById('btn-lib-json');
    if(a) a.addEventListener('click', ()=>{
      const l = PSC.read(PSC.KEY_SHEETS, []);
      if(!l.length){ PSC.toast('练习库是空的','bad'); return; }
      PSC.download('我的练习库.json', JSON.stringify(l,null,2), 'application/json');
    });
    const b = document.getElementById('btn-lib-md');
    if(b) b.addEventListener('click', ()=>{
      const l = PSC.read(PSC.KEY_SHEETS, []);
      if(!l.length){ PSC.toast('练习库是空的','bad'); return; }
      let md = '# 我的练习库\n\n共 '+l.length+' 条\n\n---\n\n';
      l.forEach(s=>{ md += sheetToMarkdown(s) + '\n\n---\n\n'; });
      PSC.download('我的练习库.md', md, 'text/markdown');
    });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if(!document.getElementById('sheet-form')) return;
    bindTabs();
    renderSheetForm();
    renderLibrary();
    initLogs();
    initLibExport();
    renderLogs();
  });
})();
