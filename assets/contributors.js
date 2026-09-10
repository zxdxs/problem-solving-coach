/* ============================================================
   贡献者表彰页
   ============================================================ */
(function(){
  'use strict';

  function typeInfo(key){
    return PSC_CONTRIBUTOR_TYPES.filter(t=>t.key===key)[0] || PSC_CONTRIBUTOR_TYPES[PSC_CONTRIBUTOR_TYPES.length-1];
  }

  function esc(s){ return PSC.esc(s); }

  function render(){
    const box = document.getElementById('contrib-list');
    if(!box) return;

    const list = PSC_CONTRIBUTORS || [];
    // 统计
    let itemCount = 0;
    list.forEach(c=>{ itemCount += (c.items||[]).length; });
    document.getElementById('stat-people').textContent = list.length;
    document.getElementById('stat-items').textContent = itemCount;

    if(!list.length){
      box.innerHTML = '<p class="muted">还没有贡献者。第一个会是你吗？</p>';
      return;
    }

    let html = '';
    list.forEach((c, idx)=>{
      const badges = (c.types||[]).map(k=>{
        const t = typeInfo(k);
        return '<span class="cbadge" style="background:'+t.color+'1a;color:'+t.color+';border-color:'+t.color+'55">'
             + t.name + '</span>';
      }).join('');

      const items = (c.items||[]).map(i=>'<li>'+esc(i)+'</li>').join('');

      const link = c.link
        ? ' <a href="'+esc(c.link)+'" target="_blank" rel="noopener" style="font-size:13px">主页 ↗</a>'
        : '';

      html += '<div class="contrib-card">'+
        '<div class="c-head">'+
          '<span class="c-avatar">'+esc((c.name||'?').trim().charAt(0))+'</span>'+
          '<div class="c-id">'+
            '<div class="c-name">'+esc(c.name)+link+'</div>'+
            '<div class="c-meta">'+esc(c.date||'')+'　·　'+(c.items||[]).length+' 项贡献</div>'+
          '</div>'+
          '<div class="c-badges">'+badges+'</div>'+
        '</div>'+
        '<ul class="c-items">'+items+'</ul>'+
      '</div>';
    });
    box.innerHTML = html;
  }

  function renderTypes(){
    const box = document.getElementById('type-legend');
    if(!box) return;
    let html = '';
    PSC_CONTRIBUTOR_TYPES.forEach(t=>{
      html += '<div class="legend-item">'+
        '<span class="cbadge" style="background:'+t.color+'1a;color:'+t.color+';border-color:'+t.color+'55">'+t.name+'</span>'+
        '<span class="muted">'+t.desc+'</span></div>';
    });
    box.innerHTML = html;
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    if(!document.getElementById('contrib-list')) return;
    render();
    renderTypes();
  });
})();
