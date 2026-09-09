/* ============================================================
   掌握度自测：分层出题 → 自动判分 → 给出等级与建议
   ============================================================ */
(function(){
  'use strict';

  const SCALE_SCORE = [0, 50, 75, 100]; // L1 / L2 / L3 / L4

  function layerName(k){
    const m = {'know':'应知','do':'应会','understand':'深度理解','transfer':'迁移'};
    return m[k] || k;
  }

  function renderQuiz(){
    const box = document.getElementById('quiz-box');
    if(!box) return;
    let html = '';
    PSC_QUIZ.questions.forEach((q, idx)=>{
      html += '<div class="q-card" data-qid="'+q.id+'">'+
        '<div class="q-head"><span class="q-no">'+(idx+1)+'</span>'+
        '<span class="q-layer '+q.layer+'">'+layerName(q.layer)+'</span>'+
        (q.type==='multi' ? '<small class="muted">（多选）</small>' : '')+
        (q.type==='scale' ? '<small class="muted">（自评量规）</small>' : '')+
        '</div><div class="q-text">'+PSC.esc(q.q)+'</div>';

      if(q.type==='scale'){
        q.scale.forEach((s, i)=>{
          html += '<label class="opt" data-idx="'+i+'"><input type="radio" name="'+q.id+'" value="'+i+'"><span>'+PSC.esc(s)+'</span></label>';
        });
      } else {
        q.options.forEach((o, i)=>{
          html += '<label class="opt" data-idx="'+i+'" data-ok="'+(o.ok?'1':'0')+'">'+
            '<input type="'+(q.type==='multi'?'checkbox':'radio')+'" name="'+q.id+'" value="'+i+'">'+
            '<span>'+PSC.esc(o.t)+'</span></label>';
        });
      }
      html += '<div class="explain"><b>解析：</b>'+PSC.esc(q.explain||'')+'</div></div>';
    });

    html += '<div class="btn-row"><button class="btn" id="btn-submit">提交并判分</button>'+
            '<button class="btn ghost" id="btn-reset">重做一次</button>'+
            '<button class="btn ghost" id="btn-print">打印试卷</button></div>';
    box.innerHTML = html;

    document.getElementById('btn-submit').addEventListener('click', grade);
    document.getElementById('btn-reset').addEventListener('click', ()=>{
      document.querySelectorAll('#quiz-box input').forEach(i=>i.checked=false);
      document.querySelectorAll('#quiz-box .opt').forEach(o=>o.classList.remove('correct','wrong'));
      document.querySelectorAll('#quiz-box .explain').forEach(e=>e.classList.remove('show'));
      const r = document.getElementById('quiz-result'); if(r) r.innerHTML='';
      window.scrollTo({top:0, behavior:'smooth'});
    });
    document.getElementById('btn-print').addEventListener('click', ()=>window.print());
  }

  function grade(){
    const stats = {};
    PSC_LAYERS.forEach(l=>{ stats[l.key] = {got:0, total:0}; });
    let allAnswered = true;

    PSC_QUIZ.questions.forEach(q=>{
      const picked = Array.from(document.querySelectorAll('#quiz-box input[name="'+q.id+'"]:checked'));
      const card = document.querySelector('.q-card[data-qid="'+q.id+'"]');
      const ex = card.querySelector('.explain');
      ex.classList.add('show');

      if(q.type==='scale'){
        if(!picked.length){ allAnswered = false; stats[q.layer].total++; return; }
        const sc = SCALE_SCORE[parseInt(picked[0].value,10)] || 0;
        stats[q.layer].got += sc; stats[q.layer].total += 100;
        card.querySelectorAll('.opt').forEach(o=>o.classList.remove('correct','wrong'));
        picked[0].closest('.opt').classList.add('correct');
        return;
      }

      // 单选 / 多选
      const correctIdx = q.options.map((o,i)=>o.ok?i:-1).filter(i=>i>=0);
      card.querySelectorAll('.opt').forEach(o=>{
        const i = parseInt(o.getAttribute('data-idx'),10);
        o.classList.remove('correct','wrong');
        if(correctIdx.indexOf(i)>=0) o.classList.add('correct');
        else if(picked.some(p=>parseInt(p.value,10)===i)) o.classList.add('wrong');
      });

      if(!picked.length){ allAnswered = false; }
      const mine = picked.map(p=>parseInt(p.value,10)).sort().join(',');
      const right = correctIdx.slice().sort().join(',');
      const ok = mine === right;
      stats[q.layer].got += ok ? 100 : 0;
      stats[q.layer].total += 100;
    });

    if(!allAnswered){
      PSC.toast('还有题目未作答，未作答的题按 0 分计','bad');
    }

    // 计算
    let totalGot=0, totalAll=0;
    PSC_LAYERS.forEach(l=>{ totalGot += stats[l.key].got; totalAll += stats[l.key].total; });
    const pct = totalAll ? Math.round(totalGot*100/totalAll) : 0;
    const lv = PSC_LEVELS.slice().reverse().find(l=>pct>=l.min) || PSC_LEVELS[0];

    let html = '<div class="result-card"><h3>自测结果</h3>'+
      '<div class="result-level" style="color:'+lv.color+'">'+lv.level+'　'+lv.name+'　'+pct+' 分</div>'+
      '<div style="font-size:14.5px;opacity:.95">'+lv.advice+'</div><div style="margin-top:16px">';
    PSC_LAYERS.forEach(l=>{
      const s = stats[l.key];
      const p = s.total ? Math.round(s.got*100/s.total) : 0;
      html += '<div class="layer-row"><span class="nm">'+l.name+'</span>'+
        '<span class="bar"><i style="width:'+p+'%;background:'+
        (p>=85?'#6ee7b7':(p>=65?'#7dd3fc':(p>=40?'#fcd34d':'#fca5a5')))+'"></i></span>'+
        '<span class="pc">'+p+'%</span></div>';
    });
    html += '</div><div class="muted" style="margin-top:12px;color:#c7d7f5">'+
      '判定规则：L3 应会是及格线，<b>L4 迁移</b>才算完全掌握。'+
      '未达标的层级，回到对应章节补练后重测。</div></div>';
    document.getElementById('quiz-result').innerHTML = html;

    // 保存成绩
    const h = PSC.read(PSC.KEY_QUIZ, []);
    h.unshift({id:PSC.uid(), at:new Date().toISOString(), pct:pct, level:lv.level, name:lv.name,
               detail: PSC_LAYERS.map(l=>({k:l.key, p: stats[l.key].total?Math.round(stats[l.key].got*100/stats[l.key].total):0}))});
    PSC.write(PSC.KEY_QUIZ, h.slice(0,20));
    renderHistory();

    // 同步进度：达到 L3 以上，标记该章“应知/应会”
    if(pct>=65){ PSC.setLayer('strategy','know',true); PSC.setLayer('strategy','do',true); }
    if(pct>=85){ PSC.setLayer('strategy','understand',true); }

    document.getElementById('quiz-result').scrollIntoView({behavior:'smooth', block:'center'});
  }

  function renderHistory(){
    const box = document.getElementById('quiz-history');
    if(!box) return;
    const h = PSC.read(PSC.KEY_QUIZ, []);
    if(!h.length){ box.innerHTML = '<p class="muted">还没有成绩记录。</p>'; return; }
    let html = '<table><thead><tr><th>时间</th><th>等级</th><th>总分</th>'+
      PSC_LAYERS.map(l=>'<th>'+l.name+'</th>').join('')+'</tr></thead><tbody>';
    h.forEach(r=>{
      html += '<tr><td>'+PSC.fmtDate(r.at)+'</td><td><b>'+r.level+' '+r.name+'</b></td><td>'+r.pct+'</td>'+
        (r.detail||[]).map(d=>'<td>'+d.p+'%</td>').join('')+'</tr>';
    });
    html += '</tbody></table>';
    box.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if(!document.getElementById('quiz-box')) return;
    renderQuiz();
    renderHistory();
  });
})();
