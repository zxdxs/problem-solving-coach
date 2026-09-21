/* 贡献墙：渲染 PSC_CREDITS（名单与类型表都来自 data.js，本文件不另存一份真相） */
(function(){
  'use strict';

  var box = document.getElementById('contrib-list');
  if(!box) return;

  var list = (typeof PSC_CREDITS !== 'undefined' && PSC_CREDITS) ? PSC_CREDITS : [];
  var TYPES = (typeof PSC_CONTRIBUTOR_TYPES !== 'undefined' && PSC_CONTRIBUTOR_TYPES) ? PSC_CONTRIBUTOR_TYPES : [];

  /* 未知类型退回最后一项（约定是 'other'）；类型表整个缺失时给一个中性兜底 */
  function typeInfo(key){
    var hit = TYPES.filter(function(t){ return t.key === key; })[0];
    return hit || TYPES[TYPES.length-1] || {name:key, color:'#475569'};
  }

  function badge(key){
    var t = typeInfo(key);
    return '<span class="cbadge" style="background:'+t.color+'1a;color:'+t.color+';border-color:'+t.color+'55">'
         + PSC.esc(t.name) + '</span>';
  }

  function isSource(c){ return (c.types||[]).indexOf('source') >= 0; }

  /* 统计 */
  var itemCount = 0;
  list.forEach(function(c){ itemCount += (c.items||[]).length; });
  var sp = document.getElementById('stat-people');
  var si = document.getElementById('stat-items');
  if(sp) sp.textContent = list.length;
  if(si) si.textContent = itemCount;

  if(!list.length){
    box.innerHTML = '<p class="muted">名单还没装载。第一个会是你吗？</p>';
  }else{
    /* 原书作者与出版者恒定置顶，其余保持 data.js 里的顺序 */
    var ordered = list.slice().sort(function(a,b){
      return (isSource(a)?0:1) - (isSource(b)?0:1);
    });
    var html = '';
    ordered.forEach(function(c, idx){
      var origin = isSource(c);
      if(origin && idx === 0){
        html += '<p class="origin-note">没有他们，就没有这个网站。'
              + '本站所用方法与例题，全部出自江丕权、李越、戴国强编著'
              + '《解决问题的策略与技能》（科学普及出版社，1992）。</p>';
      }
      var badges = (c.types||[]).map(badge).join('');
      var items = (c.items||[]).map(function(i){ return '<li>'+PSC.esc(i)+'</li>'; }).join('');
      var link = c.link
        ? ' <a href="'+PSC.esc(c.link)+'" target="_blank" rel="noopener" style="font-size:13px">主页 ↗</a>'
        : '';
      var name = (c.name||'?').trim();
      html += '<div class="contrib-card'+(origin?' origin':'')+'">'
        + '<div class="c-head">'
          + '<span class="c-avatar">'+PSC.esc(origin ? '源' : name.charAt(0))+'</span>'
          + '<div class="c-id">'
            + '<div class="c-name">'+PSC.esc(c.name)+link+'</div>'
            + '<div class="c-meta">'+PSC.esc(c.date||'')+'　·　'+(c.items||[]).length+' 项贡献</div>'
          + '</div>'
          + '<div class="c-badges">'+badges+'</div>'
        + '</div>'
        + '<ul class="c-items">'+items+'</ul>'
      + '</div>';
    });
    box.innerHTML = html;
  }

  /* 类型图例 */
  var legend = document.getElementById('type-legend');
  if(legend && TYPES.length){
    legend.innerHTML = TYPES.map(function(t){
      return '<div class="legend-item">'+badge(t.key)
           + '<span class="muted">'+PSC.esc(t.desc)+'</span></div>';
    }).join('');
  }
})();
