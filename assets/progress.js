/* ============================================================
   学习进度：八章 × 四层掌握度追踪 / 导入导出 / 重置
   ============================================================ */
(function(){
  'use strict';

  function render(){
    const box = document.getElementById('prog-table');
    if(!box) return;
    const p = PSC.getProgress();
    let done = 0, total = 0;
    let html = '<div class="table-scroll"><table><thead><tr><th style="min-width:190px">章节</th>'+
      PSC_LAYERS.map(l=>'<th title="'+l.desc+'">'+l.name+'</th>').join('')+
      '<th>完成度</th></tr></thead><tbody>';

    PSC_CHAPTERS.forEach(ch=>{
      const c = p.chapters[ch.id] || {};
      const n = PSC_LAYERS.filter(l=>c[l.key]).length;
      done += n; total += PSC_LAYERS.length;
      const pct = Math.round(n*100/PSC_LAYERS.length);
      html += '<tr><td><a href="'+ch.href+'">'+ch.no+'　'+ch.title+'</a></td>';
      PSC_LAYERS.forEach(l=>{
        const on = !!c[l.key];
        html += '<td style="text-align:center"><label class="checkline" style="justify-content:center;margin:0">'+
          '<input type="checkbox" data-ch="'+ch.id+'" data-layer="'+l.key+'" '+(on?'checked':'')+'>'+
          '<span style="font-size:12.5px;color:'+(on?'#047857':'#94a3b8')+'">'+(on?'✓':'—')+'</span></label></td>';
      });
      html += '<td><span class="bar-mini"><i style="width:'+pct+'%"></i></span> '+pct+'%</td></tr>';
    });

    html += '</tbody></table></div>';

    const overall = total ? Math.round(done*100/total) : 0;
    document.getElementById('prog-overall').innerHTML =
      '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">'+
      '<div style="font-size:30px;font-weight:800;color:var(--brand)">'+overall+'%</div>'+
      '<div style="flex:1 1 220px"><div class="prog-bar"><i style="width:'+overall+'%"></i></div>'+
      '<div class="muted">已完成 '+done+' / '+total+' 个掌握点（共 '+PSC_CHAPTERS.length+' 章 × '+PSC_LAYERS.length+' 层）</div></div></div>';

    box.innerHTML = html;

    box.querySelectorAll('input[type=checkbox]').forEach(cb=>{
      cb.addEventListener('change', ()=>{
        PSC.setLayer(cb.getAttribute('data-ch'), cb.getAttribute('data-layer'), cb.checked);
        render();
      });
    });
  }

  function initIO(){
    const ex = document.getElementById('btn-export');
    if(ex) ex.addEventListener('click', ()=>{
      const data = {
        app:'解决问题训练站', version:1, exportedAt:new Date().toISOString(),
        progress: PSC.read(PSC.KEY_PROGRESS, {}),
        sheets:   PSC.read(PSC.KEY_SHEETS, []),
        logs:     PSC.read(PSC.KEY_LOGS, []),
        quiz:     PSC.read(PSC.KEY_QUIZ, [])
      };
      PSC.download('我的学习数据.json', JSON.stringify(data,null,2), 'application/json');
      PSC.toast('已导出全部学习数据','good');
    });

    const im = document.getElementById('btn-import');
    const fi = document.getElementById('file-import');
    if(im && fi) im.addEventListener('click', ()=>fi.click());
    if(fi) fi.addEventListener('change', e=>{
      const f = e.target.files && e.target.files[0];
      if(!f) return;
      const r = new FileReader();
      r.onload = ()=>{
        try{
          const d = JSON.parse(r.result);
          if(d.progress) PSC.write(PSC.KEY_PROGRESS, d.progress);
          if(d.sheets)   PSC.write(PSC.KEY_SHEETS, d.sheets);
          if(d.logs)     PSC.write(PSC.KEY_LOGS, d.logs);
          if(d.quiz)     PSC.write(PSC.KEY_QUIZ, d.quiz);
          PSC.toast('导入成功','good');
          render();
        }catch(err){ PSC.toast('文件格式不正确','bad'); }
      };
      r.readAsText(f);
      fi.value = '';
    });

    const rs = document.getElementById('btn-reset');
    if(rs) rs.addEventListener('click', ()=>{
      if(!confirm('确定清空全部学习数据？包括进度、练习库、日志与成绩。建议先导出备份。')) return;
      [PSC.KEY_PROGRESS, PSC.KEY_SHEETS, PSC.KEY_LOGS, PSC.KEY_QUIZ].forEach(k=>localStorage.removeItem(k));
      PSC.toast('已清空','good');
      render();
    });

    const pr = document.getElementById('btn-print');
    if(pr) pr.addEventListener('click', ()=>window.print());
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if(!document.getElementById('prog-table')) return;
    render();
    initIO();
  });
})();
