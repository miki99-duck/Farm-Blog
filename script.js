/* ============================================================
   首页交互
   0)   HUD 时间：按浏览器实时时间刷新（天气 chip 固定晴天）
   1)   「返回农场」按文档层级自动定位站点根
   1.5) 背景音乐：点音符开关，文件缺失时按钮提示
   2)   文档列表前端分页（每页 10 条）
   2.5) 缩略图：按标签优先级注入 emoji 与底色
   3)   农作物筛选：成熟度 = 对应文章数，筛选后同样分页
   ============================================================ */
(function () {
  'use strict';

  var PER_PAGE = 10;

  /* ---------- 0. HUD 时间：按浏览器实时时间刷新 ----------
     季节按真实月份推算；星期、时段、时分取当前时刻。
     天气 chip 不挂脚本，永远显示「晴天」。 */
  var WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var hudDate = document.getElementById('hud-date');
  var hudTime = document.getElementById('hud-time');

  function seasonOf(m) {
    if (m >= 3 && m <= 5) { return '春季'; }
    if (m >= 6 && m <= 8) { return '夏季'; }
    if (m >= 9 && m <= 11) { return '秋季'; }
    return '冬季'; // 12 / 1 / 2
  }

  function periodOf(h) {
    if (h < 5) { return '凌晨'; }
    if (h < 11) { return '上午'; }
    if (h < 13) { return '中午'; }
    if (h < 18) { return '下午'; }
    if (h < 23) { return '晚上'; }
    return '深夜';
  }

  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  function renderHud() {
    var now = new Date();
    if (hudDate) {
      hudDate.textContent = seasonOf(now.getMonth() + 1) + ' · ' +
        (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' +
        WEEKDAYS[now.getDay()];
    }
    if (hudTime) {
      var h = now.getHours();
      var h12 = (h % 12 === 0) ? 12 : (h % 12);
      hudTime.textContent = periodOf(h) + ' ' + h12 + ':' + pad2(now.getMinutes());
    }
  }

  renderHud();
  /* 分钟级显示，每 30 秒刷新一次（最差迟到 30 秒，可忽略） */
  setInterval(renderHud, 30000);

  /* ---------- 1.5 背景音乐：点音符开关 ----------
     浏览器策略要求用户手势才能起播，所以默认静音，首次点击才加载文件。
     preload="none" 让没打算听的人不白下一段音频。 */
  var musicBtn = document.getElementById('music-btn');
  var music = document.getElementById('bg-music');
  if (musicBtn && music) {
    var musicLabel = document.getElementById('music-label');
    var MUSIC_TIP = '未找到音乐文件：确认 music/ 下有 winter.mp3、winter-festival.mp3、country-shop.mp3';
    /* 播放列表：src 相对站点根，name 显示在 HUD chip 上。想加歌就往这里加。 */
    var TRACKS = [
      { src: 'music/winter.mp3', name: '冬天' },
      { src: 'music/winter-festival.mp3', name: '冬日星盛宴' },
      { src: 'music/country-shop.mp3', name: '乡村商店' }
    ];
    var trackIdx = 0;
    var missing = false;
    music.volume = 0.35;   /* 背景音乐不该盖过读文章 */
    music.src = TRACKS[0].src;

    function setOn(on) {
      musicBtn.setAttribute('aria-pressed', String(on));
      musicBtn.setAttribute('aria-label', on ? '关闭背景音乐' : '播放背景音乐');
      musicBtn.title = on
        ? '正在播放：' + TRACKS[trackIdx].name + ' · 播完自动接下一首 · 点击关闭'
        : '点击播放背景音乐';
      if (musicLabel) { musicLabel.textContent = on ? '♪ ' + TRACKS[trackIdx].name : '♪ 音乐关'; }
    }

    function markMissing() {
      missing = true;
      musicBtn.classList.add('is-missing');
      musicBtn.title = MUSIC_TIP;
      setOn(false);
    }

    musicBtn.addEventListener('click', function () {
      if (missing) { return; }
      if (musicBtn.getAttribute('aria-pressed') === 'true') {
        music.pause();
        setOn(false);
        return;
      }
      setOn(true);
      var p = music.play();
      if (p && p.catch) { p.catch(markMissing); }
    });

    /* 一首播完自动接下一首，最后一首之后回到第一首（列表循环）。
       某首缺文件就跳过它继续试，循环一圈都不行才停下。 */
    music.addEventListener('ended', function () {
      var tried = 0;
      (function nextTrack() {
        trackIdx = (trackIdx + 1) % TRACKS.length;
        var t = TRACKS[trackIdx];
        /* 只有一首歌时会回到自己：从开头重播，不重新加载 */
        if (music.getAttribute('src') === t.src) { music.currentTime = 0; }
        else { music.src = t.src; }
        setOn(true);
        var p = music.play();
        if (p && p.catch) {
          p.catch(function () {
            tried += 1;
            if (tried < TRACKS.length) { nextTrack(); }
            else { setOn(false); }
          });
        }
      })();
    });
  }

  /* ---------- 1. 返回农场 ----------
     菜园子页面没有 .hud-home，这里是空操作；保留给将来可能的子页面 */
  var home = document.querySelector('.hud-home');
  if (home) {
    home.addEventListener('click', function (e) {
      if (window.history && window.history.length > 1) {
        e.preventDefault();
        history.back();
      }
    });
  }

  /* ---------- 2 & 3. 菜园子（入口）+ 列表分页 ----------
     田块完全由脚本从已渲染的文档卡片生成，不新增 Jekyll 数据源。
     每篇的「主标签」= 第一个 tag（作者把哪个 tag 放第一行，它就是这篇的归属），
     所以一块田只归一种文档，不会出现同一篇在四块田里重复。
     点田块 → 隐藏菜园子、显示该标签的文档列表；返回 → 切回菜园子。
     深链：#crop=spring / #all / #untagged；Esc 或返回按钮回菜园子。 */
  var list = document.getElementById('doc-list');
  if (!list) { return; }

  var posts = Array.prototype.slice.call(list.querySelectorAll('article.post'));
  var pager = document.getElementById('pager');
  var pagesEl = document.getElementById('pager-pages');
  var infoEl = document.getElementById('pager-info');
  var gardenView = document.getElementById('garden-view');
  var listSection = document.getElementById('list-section');
  var listHead = document.getElementById('list-head');
  var fullpage = document.querySelector('.fullpage');
  var sideCol = document.querySelector('.side-col');
  var gardenFormal = document.getElementById('garden-formal');
  var gardenTrial = document.getElementById('garden-trial');
  var gardenSpecial = document.getElementById('garden-special');
  var trialField = document.getElementById('trial-field');
  var trialCount = document.getElementById('trial-count');
  var bannerCrop = document.getElementById('banner-crop');
  var bannerName = document.getElementById('banner-name');
  var bannerSub = document.getElementById('banner-sub');
  var bannerMeta = document.getElementById('banner-meta');
  var bcCurrent = document.getElementById('bc-current');
  var bcGarden = document.getElementById('bc-garden');
  var backBtn = document.getElementById('back-garden');
  var emptyFilter = document.getElementById('empty-filter');
  var emptyCropName = document.getElementById('empty-crop-name');
  var emptyBack = document.getElementById('empty-back');
  var page = 1;
  var active = null;   /* 选中的主标签；null = 菜园子 */

  /* 标签元数据：显示名 + emoji。FORMAL 是固定 6 块正式田，其余标签进试验田 */
  var TAG_META = {
    '微服务': { name:'微服务', emoji:'🧩' },
    'java':    { name:'Java',    emoji:'☕' },
    'spring':  { name:'Spring',  emoji:'🍃' },
    'kafka':   { name:'Kafka',   emoji:'📨' },
    'mysql':   { name:'MySQL',   emoji:'🐬' },
    'nginx':   { name:'Nginx',   emoji:'🌐' },
    '矿洞':    { name:'矿洞',    emoji:'⛏️' },
    '冒险':    { name:'冒险',    emoji:'🧭' },
    '秋季':    { name:'秋季',    emoji:'🍂' },
    '收获':    { name:'收获',    emoji:'🎃' },
    '像素风':  { name:'像素风',  emoji:'🎨' },
    '前端':    { name:'前端',    emoji:'🖥️' },
    'css':     { name:'CSS',     emoji:'🖌️' }
  };
  var FORMAL = ['微服务', 'spring', 'java', 'kafka', 'mysql', 'nginx'];
  var ALL_ITEM = { name:'全部收成', emoji:'📚' };
  var NONE_ITEM = { name:'田头空地', emoji:'❔' };
  var KEY_ALL = '__all__', KEY_NONE = '__none__';

  function primaryOf(el) {
    var t = el.querySelector('.post-tags .tag');
    return t ? t.textContent.replace(/^#\s*/, '').trim().toLowerCase() : '';
  }
  var primaryIndex = posts.map(primaryOf);

  function metaOf(key) {
    if (key === KEY_ALL) { return ALL_ITEM; }
    if (key === KEY_NONE) { return NONE_ITEM; }
    return TAG_META[key] || { name:key, emoji:'🌱' };
  }

  /* 生长阶段：5 格进度，篇数越多越满 */
  function stageOf(n) {
    if (n === 0)  { return { pips:0, label:'尚未开垦' }; }
    if (n === 1)  { return { pips:1, label:'种子期' }; }
    if (n <= 3)   { return { pips:2, label:'幼苗期' }; }
    if (n <= 9)   { return { pips:3, label:'成长期' }; }
    if (n <= 14)  { return { pips:4, label:'茂盛期' }; }
    return { pips:5, label:'丰收期' };
  }

  /* ---------- 统计 ---------- */
  var counts = {};
  var untaggedCount = 0;
  for (var i = 0; i < primaryIndex.length; i++) {
    var pk = primaryIndex[i];
    if (!pk) { untaggedCount++; continue; }
    counts[pk] = (counts[pk] || 0) + 1;
  }
  var trialTags = [];
  for (var tk in counts) {
    if (!Object.prototype.hasOwnProperty.call(counts, tk)) { continue; }
    if (FORMAL.indexOf(tk) === -1 && counts[tk] > 0) { trialTags.push(tk); }
  }
  trialTags.sort();
  var maxCropCount = 1;
  for (var mk in counts) {
    if (Object.prototype.hasOwnProperty.call(counts, mk) && counts[mk] > maxCropCount) { maxCropCount = counts[mk]; }
  }

  /* ---------- 生成田块 ---------- */
  function pipsHtml(n) {
    var s = stageOf(n), h = '', p;
    for (p = 0; p < 5; p++) { h += '<i class="pip' + (p < s.pips ? ' on' : '') + '"></i>'; }
    return h;
  }

  function makePlot(key, tiny) {
    var m = metaOf(key);
    var n = counts[key] || 0;
    var s = stageOf(n);
    var d = document.createElement('div');
    d.className = 'plot' + (tiny ? ' tiny' : '') + (n === 0 ? ' fallow' : '');
    d.setAttribute('role', 'button');
    d.setAttribute('data-crop', key);
    d.title = n === 0 ? '这块田还没种上文章' : '进入「' + m.name + '」：' + n + ' 篇';
    d.innerHTML = '<div class="plot-crop">' + m.emoji + '</div>' +
      '<div class="plot-name">' + m.name + '</div>' +
      (tiny ? '' : '<div class="pips">' + pipsHtml(n) + '</div>' +
        '<div class="stage">' + s.label + '</div>') +
      '<div class="plot-count">' + n + ' 篇 · 成熟度 ' + n + ' 度</div>';
    if (n === 0) { d.setAttribute('aria-disabled', 'true'); d.setAttribute('tabindex', '-1'); }
    else { d.setAttribute('tabindex', '0'); }
    return d;
  }

  function makeSpecial(item, count, desc, dataset) {
    var d = document.createElement('div');
    d.className = 'plot special';
    d.setAttribute('role', 'button');
    d.setAttribute('tabindex', '0');
    d.setAttribute('data-crop', dataset);
    d.title = '进入「' + item.name + '」：' + count + ' 篇';
    d.innerHTML = '<div class="plot-crop">' + item.emoji + '</div>' +
      '<div class="plot-name">' + item.name + '</div>' +
      '<div class="stage">' + desc + '</div>' +
      '<div class="plot-count">' + count + ' 篇</div>';
    return d;
  }

  FORMAL.forEach(function (key) { gardenFormal.appendChild(makePlot(key, false)); });

  if (trialTags.length === 0) {
    if (trialField) { trialField.hidden = true; }
  } else {
    var trialDocs = 0;
    trialTags.forEach(function (t) { trialDocs += counts[t]; });
    if (trialCount) { trialCount.textContent = trialTags.length + ' 块田 · ' + trialDocs + ' 篇'; }
    trialTags.forEach(function (key) { gardenTrial.appendChild(makePlot(key, true)); });
  }

  gardenSpecial.appendChild(makeSpecial(ALL_ITEM, posts.length, '总仓', KEY_ALL));
  if (untaggedCount > 0) {
    gardenSpecial.appendChild(makeSpecial(NONE_ITEM, untaggedCount, '待补标签', KEY_NONE));
  }

  /* ---------- 过滤 + 分页 ---------- */
  function matches(i) {
    if (active === null || active === KEY_ALL) { return true; }
    if (active === KEY_NONE) { return primaryIndex[i] === ''; }
    return primaryIndex[i] === active;
  }

  function render() {
    var idx = [], i;
    for (i = 0; i < posts.length; i++) { if (matches(i)) { idx.push(i); } }

    var pages = Math.max(1, Math.ceil(idx.length / PER_PAGE));
    if (page > pages) { page = pages; }
    if (page < 1) { page = 1; }
    var from = (page - 1) * PER_PAGE;
    var onPage = idx.slice(from, from + PER_PAGE);

    posts.forEach(function (el, i) { el.hidden = onPage.indexOf(i) === -1; });

    if (pager) { pager.hidden = pages <= 1; }
    if (pagesEl) {
      pagesEl.textContent = '';
      for (var n = 1; n <= pages; n++) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'pager-btn pager-num' + (n === page ? ' is-current' : '');
        b.setAttribute('data-page', String(n));
        b.textContent = String(n);
        if (n === page) { b.setAttribute('aria-current', 'page'); }
        pagesEl.appendChild(b);
      }
    }
    if (pager) {
      var prev = pager.querySelector('[data-page="prev"]');
      var next = pager.querySelector('[data-page="next"]');
      if (prev) { prev.disabled = page <= 1; }
      if (next) { next.disabled = page >= pages; }
    }
    if (infoEl) {
      var nm = metaOf(active).name;
      infoEl.textContent = (active === KEY_ALL ? '' : '已筛选「' + nm + '」· ') +
        '共 ' + idx.length + ' 篇 · 第 ' + page + ' / ' + pages + ' 页';
    }
    if (emptyFilter) { emptyFilter.hidden = idx.length !== 0; }
  }

  /* ---------- 视图切换 ---------- */
  function showGarden() {
    active = null;
    page = 1;
    render();
    if (gardenView) { gardenView.hidden = false; }
    if (listSection) { listSection.hidden = true; }
    if (sideCol) { sideCol.hidden = false; }
    if (fullpage) { fullpage.classList.remove('no-sidebar'); }
    if (location.hash) { history.replaceState(null, '', location.pathname + location.search); }
    window.scrollTo(0, 0);
  }

  function showCrop(key) {
    active = key;
    page = 1;
    var m = metaOf(key);
    var n = key === KEY_ALL ? posts.length : (key === KEY_NONE ? untaggedCount : (counts[key] || 0));
    if (bannerCrop) { bannerCrop.textContent = m.emoji; }
    if (bannerName) { bannerName.textContent = m.name; }
    if (bcCurrent) { bcCurrent.textContent = m.emoji + ' ' + m.name; }
    if (emptyCropName) { emptyCropName.textContent = m.name; }
    if (bannerSub) {
      bannerSub.textContent = key === KEY_ALL
        ? '全部文档 · 不分标签'
        : (key === KEY_NONE ? '还没写 tags，暂时不归属任何田' : stageOf(n).label + ' · 成熟度 ' + n + ' 度');
    }
    if (bannerMeta) {
      var w = key === KEY_ALL ? 100 : Math.max(6, Math.round((n / maxCropCount) * 100));
      bannerMeta.innerHTML = '成熟度 ' + n + ' 度' +
        '<span class="banner-bar"><span style="width:' + w + '%"></span></span>';
    }
    render();
    if (gardenView) { gardenView.hidden = true; }
    if (listSection) { listSection.hidden = false; }
    if (sideCol) { sideCol.hidden = true; }
    if (fullpage) { fullpage.classList.add('no-sidebar'); }
    var hash = key === KEY_ALL ? '#all' : (key === KEY_NONE ? '#untagged' : '#crop=' + encodeURIComponent(key));
    if (location.hash !== hash) { history.replaceState(null, '', hash); }
    if (listHead) { listHead.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }

  /* ---------- 事件 ---------- */
  function onPlotActivate(e) {
    var d = e.target && e.target.closest ? e.target.closest('.plot') : null;
    if (!d || d.classList.contains('fallow')) { return; }
    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') { return; }
    if (e.type === 'keydown') { e.preventDefault(); }
    showCrop(d.getAttribute('data-crop'));
  }

  [gardenFormal, gardenTrial, gardenSpecial].forEach(function (host) {
    if (!host) { return; }
    host.addEventListener('click', onPlotActivate);
    host.addEventListener('keydown', onPlotActivate);
  });

  function goBack(e) { e.preventDefault(); showGarden(); }
  if (backBtn) { backBtn.addEventListener('click', goBack); }
  if (bcGarden) { bcGarden.addEventListener('click', goBack); }
  if (emptyBack) { emptyBack.addEventListener('click', goBack); }

  if (pager) {
    pager.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button[data-page]') : null;
      if (!btn || btn.disabled) { return; }
      var v = btn.getAttribute('data-page');
      if (v === 'prev') { page -= 1; }
      else if (v === 'next') { page += 1; }
      else { page = parseInt(v, 10) || 1; }
      render();
      list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && active !== null) { showGarden(); }
  });

  /* ---------- 深链 ---------- */
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (h === 'all') { return KEY_ALL; }
    if (h === 'untagged') { return KEY_NONE; }
    var m = h.match(/^crop=(.+)$/);
    if (m) { return decodeURIComponent(m[1]).toLowerCase(); }
    return null;
  }

  window.addEventListener('hashchange', function () {
    var key = readHash();
    if (key === null) { showGarden(); }
    else { showCrop(key); }
  });

  /* ---------- 初始：默认停在菜园子 ---------- */
  var initial = readHash();
  if (initial === null) {
    if (gardenView) { gardenView.hidden = false; }
    if (listSection) { listSection.hidden = true; }
    if (sideCol) { sideCol.hidden = false; }
    if (fullpage) { fullpage.classList.remove('no-sidebar'); }
    render();
    /* 清掉无法识别的 hash（如 #foo），避免地址栏和视图不一致 */
    if (location.hash) { history.replaceState(null, '', location.pathname + location.search); }
  } else {
    showCrop(initial);
  }
}());


  /* ============================================================
     农具光标：点热键栏的农具 → 全站鼠标变成该农具样式。
     选「空手」恢复默认光标。选择存在 localStorage，跨页持久。
     ============================================================ */
  var TOOL_HS = {
    axe:[4,3], pickaxe:[2,3], hoe:[8,12], scythe:[2,3],
    watering:[14,5], trap:[8,8], rod:[7,2], sling:[8,4],
    bomb:[8,7], shears:[6,3], saw:[12,7], empty:null
  };
  function applyTool(toolId) {
    var slot = document.querySelector('.slot[data-tool="' + toolId + '"]');
    var svg = slot ? slot.querySelector('svg') : null;
    var hs = TOOL_HS[toolId];
    var cur = '';
    if (svg && hs) {
      var svgStr = svg.outerHTML.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
      cur = 'url("data:image/svg+xml,' + encodeURIComponent(svgStr) + '") ' + hs[0] + ' ' + hs[1] + ', auto';
    }
    document.body.style.cursor = cur;
    localStorage.setItem('sv_cursor', cur);
    localStorage.setItem('sv_tool', toolId);
  }
  function selectTool(toolId) {
    document.querySelectorAll('.hotbar .slot.active').forEach(function (s) { s.classList.remove('active'); });
    var slot = document.querySelector('.slot[data-tool="' + toolId + '"]');
    if (slot) { slot.classList.add('active'); applyTool(toolId); }
  }
  (function () {
    var saved = localStorage.getItem('sv_cursor');
    if (saved) { document.body.style.cursor = saved; }
  })();
  document.querySelectorAll('.hotbar .slot').forEach(function (slot) {
    slot.addEventListener('click', function () {
      var t = slot.getAttribute('data-tool');
      if (t) { selectTool(t); }
    });
  });

  /* ---------- 访客计数（GoatCounter API，30 秒刷新） ---------- */
  (function () {
    var el = document.getElementById('visitor-count');
    if (!el) { return; }
    function update() {
      fetch('https://miki99-duck.goatcounter.com/api/v2/counters/miki99-duck')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (d) {
          if (d && d.totals) { el.textContent = d.totals.hits.toLocaleString(); }
        })
        .catch(function () {});
    }
    update();
    setInterval(update, 30000);
  })();

  /* 9) 回到顶部：滚动超过 300px 显示，点击平滑滚回顶部 */
  (function () {
    var btn = document.getElementById('back-to-top');
    if (!btn) { return; }
    var lastVisible = null;

    function onScroll() {
      var show = window.scrollY > 300;
      if (show !== lastVisible) {
        btn.hidden = !show;
        lastVisible = show;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  })();
