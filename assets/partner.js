/* 陪练墙：渲染 PSC_PARTNERS */
(function(){
  'use strict';
  var box = document.getElementById('partner-list');
  if(!box || typeof PSC_PARTNERS === 'undefined') return;

  var list = PSC_PARTNERS;
  if(!list.length){
    box.innerHTML = '<div class="card" style="text-align:center;color:var(--ink-3)">'
      + '墙上还空着。<b>第一个留名的人，需要一点勇气。</b></div>';
    return;
  }

  var KIND = {
    'find':   {label:'找陪练',  color:'var(--brand)'},
    'coach':  {label:'辅导员',  color:'var(--brand-2)'},
    'both':   {label:'都可以',  color:'#7c3aed'}
  };

  var html = '';
  list.forEach(function(p){
    var k = KIND[p.kind] || KIND['find'];
    var tags = (p.tags||[]).map(function(t){
      return '<span class="chip">'+PSC.esc(t)+'</span>';
    }).join('');
    html += '<div class="card" style="margin-bottom:12px">'
      + '<div style="display:flex;flex-wrap:wrap;align-items:baseline;gap:10px">'
      + '<b style="font-size:17px">'+PSC.esc(p.name)+'</b>'
      + '<span class="badge" style="background:'+k.color+';color:#fff">'+k.label+'</span>'
      + '<span class="muted" style="font-size:14px">'+PSC.esc(p.where||'')+'</span>'
      + '</div>'
      + '<div class="muted" style="margin-top:8px">'+PSC.esc(p.want||'')+'</div>'
      + '<div style="margin-top:8px">'+tags+'</div>'
      + (p.note ? '<div class="muted" style="margin-top:8px;font-size:14px">'+PSC.esc(p.note)+'</div>' : '')
      + '</div>';
  });
  box.innerHTML = html;
})();
