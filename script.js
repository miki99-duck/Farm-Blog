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

  /* ---------- 1. 记住"从哪块田点进文章"（挂载点在下面拿到 #doc-list 之后） ---------- */

  /* ---------- 2 & 3. 菜园子（入口）+ 列表分页 ----------
     田块完全由脚本从已渲染的文档卡片生成，不新增 Jekyll 数据源。
     每篇的「主标签」= 第一个 tag（作者把哪个 tag 放第一行，它就是这篇的归属），
     所以一块田只归一种文档，不会出现同一篇在四块田里重复。
     点田块 → 隐藏菜园子、显示该标签的文档列表；返回 → 切回菜园子。
     深链：#crop=spring / #all / #untagged；Esc 或返回按钮回菜园子。 */
  var list = document.getElementById('doc-list');
  if (!list) { return; }

  /* ---------- 「从哪块田点进文章」记一笔 ----------
     文章页的「◂ 返回农场」要回到"上一级"（= 你点进来时那块田的列表）。
     但浏览器会把 referrer 的 #片段抹掉：从 #crop=java 点进文章，文章页只拿到
     /Farm-Blog/，按 referrer 回去会落到菜园子默认视图，而不是那块田。
     所以在列表里点链接跳走之前，把当前地址（含 #crop=）记进 sessionStorage；
     文章页用完即清（一次性的），避免下次直接打开文章时被陈旧来路带偏。
     隐私模式禁 sessionStorage 时静默跳过：文章页会自动退回 referrer / 静态落点。 */
  list.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) { return; }
    try {
      sessionStorage.setItem('fb_up', location.pathname + location.search + location.hash);
    } catch (err) { /* 存不了就算了 */ }
  }, true);

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
  var searchForm = document.getElementById('search-form');
  var searchInput = document.getElementById('search-input');
  var searchClear = document.getElementById('search-clear');
  var searchStatus = document.getElementById('search-status');
  var cropBanner = document.getElementById('crop-banner');
  var page = 1;
  var active = null;   /* 选中的主标签；null = 菜园子 */
  var searchQuery = '';      /* 非空 = 正在搜索 */
  var searchLabel = '';      /* 面包屑显示的搜索词 */
  var searchHits = [];       /* 命中的卡片下标，供 render 用 */
  var searchTexts = [];      /* 每张卡片的可搜索文本（小写，建索引时算一次） */
  var highlighted = [];      /* 当前被 <mark> 包过的文本节点，清空时要还原 */

  /* 标签元数据：显示名 + emoji。FORMAL 里的进正式田，其余标签进试验田。
     注意：键必须全小写 —— primaryOf() 会把标签 toLowerCase() 后再查这张表，
     写成 'Java' / 'Spring' 这种大小写会匹配不上，emoji 静默退化成兜底 🌱。 */
  var TAG_META = {
    '农场日记': { name:'农场日记', emoji:'📔' },
    '微服务': { name:'微服务', emoji:'🧩' },
    'spring':  { name:'Spring',  emoji:'🍃' },
    'java':    { name:'Java',    emoji:'☕' },
    'css':     { name:'CSS',     emoji:'🖌️' },
    'js':      { name:'JavaScript', emoji:'📜' },
    'vue':     { name:'Vue',     emoji:'🟩' },
    'threejs': { name:'Three.js', emoji:'🧊' },
    'ai':      { name:'AI',      emoji:'🤖' },
    'kafka':   { name:'Kafka',   emoji:'📨' },
    'redis':   { name:'Redis',   emoji:'🧱' },
    'mysql':   { name:'MySQL',   emoji:'🐬' },
    'nginx':   { name:'Nginx',   emoji:'🌐' },
    '矿洞':    { name:'矿洞',    emoji:'⛏️' },
    '冒险':    { name:'冒险',    emoji:'🧭' },
    '秋季':    { name:'秋季',    emoji:'🍂' },
    '收获':    { name:'收获',    emoji:'🎃' },
    '像素风':  { name:'像素风',  emoji:'🎨' },
    '前端':    { name:'前端',    emoji:'🖥️' }
  };
  /* FORMAL 也要全小写，且必须与 TAG_META 的键、以及文档里 tags 的小写形式一致。
     有内容的系列放前面；nginx 目前 0 篇，先留作占位田（会显示成灰的「尚未开垦」）。
     新增一套教程时：这里加标签名（全小写）、TAG_META 里配 name/emoji、
     _config.yml 的 series_titles 里配系列显示名，再补一个 技术/<系列>/index.md
     落地页（front matter 里写 nav_title / nav_order，首页的「系列目录」自动收录，
     不用再改 index.html）—— 少一步就会掉进「田头空地」
     或者在首页看不到入口（2026-09 已经踩过一次）。
     想调整哪几块进正式田，只改这个数组即可，顺序就是显示顺序。
     农场日记：3 篇日记原本各挂一个「收获 / 像素风 / 冒险」当主标签，于是散成
     三块只有 1 篇的试验田；现在统一把主标签换成「农场日记」合成一块正式田，
     原来的 收获 / 秋季 / 矿洞 / 冒险 / 像素风 退到 tags 第二位，只当装饰标签用。 */
  var FORMAL = ['微服务', 'spring', 'java', 'css', 'js', 'vue', 'threejs', 'ai', 'redis', 'mysql', '农场日记', 'nginx'];
  var ALL_ITEM = { name:'全部收成', emoji:'📚' };
  var NONE_ITEM = { name:'田头空地', emoji:'❔' };
  var KEY_ALL = '__all__', KEY_NONE = '__none__';

  function primaryOf(el) {
    var t = el.querySelector('.post-tags .tag');
    return t ? t.textContent.replace(/^#\s*/, '').trim().toLowerCase() : '';
  }
  var primaryIndex = posts.map(primaryOf);

  /* ---------- 搜索索引 ----------
     刻意不新增 Jekyll 数据源：每张卡片上已经有标题、标签、摘要，
     直接从 DOM 摘下来即可，所以新丢一个 .md 进仓库就自动可搜。
     只索引标题 / 标签 / 摘要，不索引正文 —— 109 篇正文合计约 1.3MB，
     塞进索引会让首页体积翻好几倍，而摘要已足够定位到文章。
     摘要用 data-plain 缓存纯文本：高亮会把文本节点拆成 <mark>，
     算索引必须用原始纯文本，否则搜第二次就会匹配到被拆碎的片段。 */
  function plainOf(el) {
    var p = el.querySelector('.post-text');
    return p ? (p.getAttribute('data-plain') || p.textContent) : '';
  }

  /* 把卡片里被 <mark> 拆开的文本还原成单个文本节点。
     被标记的是行内元素 <mark>，用它的 textContent 换回去就等价于原文。 */
  function restoreText() {
    for (var i = 0; i < highlighted.length; i++) {
      var n = highlighted[i];
      if (!n.parentNode) { continue; }
      n.parentNode.replaceChild(document.createTextNode(n.textContent), n);
    }
    highlighted = [];
  }

  function clearSearchState() {
    searchQuery = '';
    searchHits = [];
    restoreText();
  }

  function buildSearchIndex() {
    searchTexts = posts.map(function (el) {
      var tags = el.querySelector('.post-tags');
      var title = el.querySelector('.post-title');
      return [
        title ? title.textContent : '',
        tags ? tags.textContent : '',
        plainOf(el)
      ].join(' ').toLowerCase();
    });
  }
  buildSearchIndex();

  /* 查询按空格拆词，多个词之间是「全部命中」而不是「任一命中」——
     搜「微服务 事务」应该是既讲微服务又讲事务的那几篇，不是并集 */
  function queryWords() {
    return searchQuery.toLowerCase().split(/\s+/).filter(function (w) { return w; });
  }

  function searchMatches(i) {
    var words = queryWords(), t = searchTexts[i];
    if (!words.length) { return false; }
    for (var w = 0; w < words.length; w++) {
      if (t.indexOf(words[w]) === -1) { return false; }
    }
    return true;
  }

  /* ---------- 命中高亮 ----------
     文档标题里有 ( ) + ? [ ] . 等正则元字符，必须转义，
     否则搜「C++」「(0,2,0,0)」这类词会直接抛正则语法错误、整页脚本挂掉 */
  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function highlightIn(rootEl, re) {
    var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null, false);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue && re.test(n.nodeValue)) { nodes.push(n); }
      re.lastIndex = 0;
    }
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i], text = node.nodeValue, frag = document.createDocumentFragment();
      var last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        if (m.index > last) {
          frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        }
        var mark = document.createElement('mark');
        mark.textContent = m[0];
        frag.appendChild(mark);
        highlighted.push(mark);
        last = m.index + m[0].length;
        if (m[0].length === 0) { re.lastIndex++; }   /* 防零宽匹配死循环 */
      }
      if (last < text.length) {
        frag.appendChild(document.createTextNode(text.slice(last)));
      }
      node.parentNode.replaceChild(frag, node);
    }
  }

  function applyHighlight(words) {
    if (!words.length) { return; }
    var re = new RegExp('(' + words.map(escapeRe).join('|') + ')', 'gi');
    for (var k = 0; k < searchHits.length; k++) {
      var el = posts[searchHits[k]];
      var title = el.querySelector('.post-title a');
      var para = el.querySelector('.post-text');
      if (!para) { continue; }
      if (!para.hasAttribute('data-plain')) {
        para.setAttribute('data-plain', para.textContent);
      }
      /* 先清掉上一轮的 <mark>，再基于纯文本重新高亮 */
      para.textContent = para.getAttribute('data-plain');
      if (title) { highlightIn(title, re); }
      highlightIn(para, re);
    }
  }

  function clearHighlights() { restoreText(); }

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
    if (searchQuery) { return searchHits.indexOf(i) !== -1; }
    if (active === null || active === KEY_ALL) { return true; }
    if (active === KEY_NONE) { return primaryIndex[i] === ''; }
    return primaryIndex[i] === active;
  }

  function render() {
    var idx = [], i;

    /* 搜索分支：命中集合每轮重算并写回 searchHits，再走同一套分页。
       必须先算完再让 matches() 读，否则读到的是上一轮的结果。 */
    if (searchQuery) {
      searchHits = [];
      for (i = 0; i < posts.length; i++) {
        if (searchMatches(i)) { searchHits.push(i); }
      }
      clearHighlights();
      applyHighlight(queryWords());
      idx = searchHits.slice();
    } else {
      for (i = 0; i < posts.length; i++) { if (matches(i)) { idx.push(i); } }
    }

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
      if (searchQuery) {
        infoEl.textContent = '搜索「' + searchLabel + '」· ' +
          '共 ' + idx.length + ' 篇 · 第 ' + page + ' / ' + pages + ' 页';
      } else {
        var nm = metaOf(active).name;
        infoEl.textContent = (active === KEY_ALL ? '' : '已筛选「' + nm + '」· ') +
          '共 ' + idx.length + ' 篇 · 第 ' + page + ' / ' + pages + ' 页';
      }
    }
    if (emptyFilter) { emptyFilter.hidden = idx.length !== 0; }
    if (emptyCropName) {
      emptyCropName.textContent = searchQuery ? '（没有匹配的文档）' : metaOf(active).name;
    }
    if (emptyBack) {
      emptyBack.textContent = searchQuery ? '✕ 清空搜索' : '◀ 返回菜园子';
    }
    if (searchStatus) {
      searchStatus.textContent = searchQuery
        ? idx.length + ' 篇命中'
        : (searchInput && searchInput.value ? '没有匹配的文档' : '');
    }

    /* 篇目录必须放在最后建：上面刚算完 el.hidden，
       建目录时要靠它判断哪些条目在当前页（不在当前页的压暗一档）。 */
    buildRail(idx);
    syncRail();
  }

  /* ---------- 篇目录（列表视图左列） ----------
     为什么要有：一块田最多 22 篇、每页只显示 10 篇 —— 想找第三页的第 4 篇，
     旧版只能一页页翻着找。目录列的是**当前筛选结果的全部篇目**（不只当前页），
     点哪一篇就翻到它所在的那一页、滚到那张卡，并给它一圈金色描边。
     索引来源和搜索索引一样：从已渲染的卡片上摘标题，不新增 Jekyll 数据源。

     为什么条目是 <button> 而不是 <a href="#id">：本页的 location.hash 归
     深链机制独占（#crop= / #all / #q=，#untagged），任何 hash 变化都会触发
     window 的 hashchange → applyHash()。用锚点会改 hash，一改就被当成
     「无法识别的深链」弹回菜园子。用按钮就没有这个问题。 */
  var tocCol = document.getElementById('toc-col');
  var tocRailList = document.getElementById('toc-rail-list');
  var tocRailBody = document.getElementById('toc-rail-body');
  var tocRailMeta = document.getElementById('toc-rail-meta');
  var tocRailCount = document.getElementById('toc-rail-count');
  var tocRailToggle = document.getElementById('toc-rail-toggle');
  var railOrder = [];      /* 目录序号 -> posts 下标 */
  var railLinks = [];      /* 目录序号 -> 条目按钮 */
  var railActive = -1;
  var railVisible = [];    /* 当前落在观察带里的目录序号（用来取最靠前的那篇） */
  var railObserver = null;
  var railLockUntil = 0;   /* 点目录跳转后的一小段锁定，见观察器里的说明 */

  /* 目录只在「列表/搜索视图」且有条目时出现。
     两个条件分别由 show* 系列和 render() 改写，所以两处都要调它。 */
  function syncRail() {
    if (!tocCol) { return; }
    var inList = !!listSection && !listSection.hidden;
    var hasItems = !!tocRailList && tocRailList.childElementCount > 0;
    tocCol.hidden = !(inList && hasItems);
  }

  function setRailActive(order) {
    if (order === railActive) { return; }
    if (railLinks[railActive]) {
      railLinks[railActive].classList.remove('active');
      railLinks[railActive].removeAttribute('aria-current');
    }
    railActive = order;
    if (railLinks[order]) {
      railLinks[order].classList.add('active');
      railLinks[order].setAttribute('aria-current', 'true');
      keepRailInView(railLinks[order]);
    }
  }

  /* 22 条目录比竖屏高，当前篇目的高亮可能落在目录自己的滚动视野之外 ——
     把它拉回来。只改 .toc-rail-body 的 scrollTop，不碰页面滚动位置：
     用 scrollIntoView 会连带把整个窗口也滚一下，这里不需要。
     顺带说明为什么不用 offsetTop 算：.toc-rail 是 position:sticky，
     它是 offsetParent，offsetTop 会多算一个表头的高度，直接用矩形比较更省心。 */
  function keepRailInView(item) {
    var body = tocRailBody;
    if (!body || body.scrollHeight <= body.clientHeight + 1) { return; }
    var ir = item.getBoundingClientRect();
    var br = body.getBoundingClientRect();
    if (ir.top < br.top) { body.scrollTop -= (br.top - ir.top); }
    else if (ir.bottom > br.bottom) { body.scrollTop += (ir.bottom - br.bottom); }
  }

  function buildRail(idx) {
    if (!tocRailList) { return; }
    railOrder = idx.slice();
    railLinks = [];
    railActive = -1;
    railVisible = [];
    tocRailList.textContent = '';

    /* 表头：这块地叫什么、一共几篇 */
    var who = searchQuery ? '搜索「' + searchLabel + '」' : metaOf(active).name;
    if (tocRailMeta) { tocRailMeta.textContent = who + ' · ' + idx.length + ' 篇'; }
    if (tocRailCount) { tocRailCount.textContent = ' · ' + idx.length + ' 篇'; }

    /* 切页要重挂观察器：只观察当前页真正显示的那几张卡 */
    if (railObserver) { railObserver.disconnect(); railObserver = null; }

    for (var order = 0; order < idx.length; order++) {
      var el = posts[idx[order]];
      var titleEl = el.querySelector('.post-title');
      var title = titleEl ? titleEl.textContent.trim() : '';
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'toc-rail-item';
      item.setAttribute('data-order', String(order));
      /* 兜底：卡片没有标题时也给个占位，别在目录里留一个点不出来的空行 */
      item.textContent = title || '（无标题）';

      /* 不在当前页的条目：压暗一档 + 说明点它会翻页，先给个预期 */
      var itemPage = Math.floor(order / PER_PAGE) + 1;
      if (itemPage !== page) {
        item.classList.add('is-other-page');
        item.title = '第 ' + itemPage + ' 页 · 点击跳到这篇';
      }

      var li = document.createElement('li');
      li.appendChild(item);
      tocRailList.appendChild(li);
      railLinks.push(item);
    }

    if ('IntersectionObserver' in window && idx.length) {
      /* 高亮规则：取「当前落在观察带里最靠前的那一篇」，不是「最后触发事件的那一篇」。
         后者在光滑滚动中会输错 —— 上一条还没滚出去、下一条已经滚进来时，
         事件顺序不保证，高亮会跳到下面那篇。 */
      railObserver = new IntersectionObserver(function (entries) {
        /* 先无条件把「谁在带里」这本账记准，锁定期间也不停 ——
           否则锁定结束后这本账是缺的，要等下一次相交变化才补得回来。 */
        for (var k = 0; k < entries.length; k++) {
          var at = railOrder.indexOf(posts.indexOf(entries[k].target));
          var pos = railVisible.indexOf(at);
          if (entries[k].isIntersecting) {
            if (at !== -1 && pos === -1) { railVisible.push(at); }
          } else if (pos !== -1) {
            railVisible.splice(pos, 1);
          }
        }
        /* 跳转锁定：点了「第 22 篇」时，如果文档已经到底，它根本贴不到视口顶，
           滚动高亮就会落到它上面那一篇上 —— 用户点了 A，亮的却是 B。
           所以跳转后 800ms 内不改高亮（这段刚好覆盖 smooth 滚动的时长），
           把高亮钉在用户点的那一条；用户自己再滚一下才会重新接管。 */
        if (Date.now() < railLockUntil) { return; }
        var best = -1;
        for (var v = 0; v < railVisible.length; v++) {
          if (best === -1 || railVisible[v] < best) { best = railVisible[v]; }
        }
        if (best !== -1) { setRailActive(best); }
      }, { rootMargin: '-12% 0px -70% 0px', threshold: 0 });
      for (var j = 0; j < idx.length; j++) {
        if (!posts[idx[j]].hidden) { railObserver.observe(posts[idx[j]]); }
      }
    }
  }

  /* 点目录 → 翻到那一页 → 滚到那张卡 → 金圈闪一下。
     分页是前端做的，所以「跳转」= 改 page 再 render，而不是跳 URL。 */
  if (tocRailList) {
    tocRailList.addEventListener('click', function (e) {
      var item = e.target && e.target.closest ? e.target.closest('.toc-rail-item') : null;
      if (!item) { return; }
      var order = parseInt(item.getAttribute('data-order'), 10);
      if (isNaN(order) || order < 0 || order >= railOrder.length) { return; }

      var el = posts[railOrder[order]];
      var wantPage = Math.floor(order / PER_PAGE) + 1;
      if (wantPage !== page) { page = wantPage; render(); }

      /* render() 重建了目录、清了 active，所以这里重新标一次，
         并把高亮钉住 800ms —— 这一段刚好盖住下面的 smooth 滚动。 */
      railLockUntil = Date.now() + 800;
      setRailActive(order);
      if (el.hidden) { el.hidden = false; }   /* 兜底：分页算歪了也别跳到空白 */
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('is-hit');
      window.setTimeout(function () { el.classList.remove('is-hit'); }, 1400);
    });
  }

  /* 窄屏把目录折起来 —— 和文档页的 .toc-toggle 一个套路：
     宽屏常显（按钮 display:none），窄屏默认收起，点了才展开。 */
  if (tocRailToggle && tocCol) {
    var railNarrow = window.matchMedia && window.matchMedia('(max-width: 880px)');
    if (railNarrow && railNarrow.matches) {
      tocCol.classList.add('is-collapsed');
      tocRailToggle.setAttribute('aria-expanded', 'false');
    }
    tocRailToggle.addEventListener('click', function () {
      var collapsed = tocCol.classList.toggle('is-collapsed');
      tocRailToggle.setAttribute('aria-expanded', String(!collapsed));
    });
  }

  /* ---------- 视图切换的滚动一律「瞬移」（不带动画） ----------
     为什么要专门写两个函数（不能直接用 window.scrollTo(0,0) / scrollIntoView()）：
     html{scroll-behavior:smooth} 让所有程序化滚动都变成动画，那正是线上这个 bug 的来源 ——
     点一块田后页面开始把列表头平滑滚到顶，用户在动画没停下时点「◀ 返回菜园子」，
     按下到抬起这几十毫秒里按钮已经从光标下移走（实测按钮 y 从 167 → 27），
     浏览器就把 click 派发给「按下元素」与「抬起元素」的共同祖先（实测落到 #crop-banner），
     这一下完全白点 —— 用户体感就是「点一次不生效，要点两次」。
     换视图本来也不是「在同一页里滚一段」，瞬移观感更干净，顺手把这个坑填死。
     注意用 behavior:'instant' 而不是 'auto'：'auto' 会回去读 CSS 的 scroll-behavior（=smooth），
     等于又要动画。旧引擎不认 'instant' 时退回两参数/无参写法。 */
  function instantScrollTo(top) {
    try { window.scrollTo({ top: top, left: 0, behavior: 'instant' }); }
    catch (e) { window.scrollTo(0, top); }
  }
  function instantScrollIntoView(el) {
    if (!el) { return; }
    try { el.scrollIntoView({ behavior: 'instant', block: 'start' }); }
    catch (e) { el.scrollIntoView(); }
  }

  /* ---------- 视图切换 ---------- */
  function showGarden() {
    active = null;
    page = 1;
    searchLabel = '';
    clearSearchState();
    clearInput();
    render();
    if (gardenView) { gardenView.hidden = false; }
    if (listSection) { listSection.hidden = true; }
    if (sideCol) { sideCol.hidden = false; }
    if (fullpage) { fullpage.classList.remove('no-sidebar'); }
    if (location.hash) { history.replaceState(null, '', location.pathname + location.search); }
    instantScrollTo(0);
    syncRail();
  }

  function showCrop(key) {
    active = key;
    page = 1;
    /* 从搜索点进某块田，搜索状态要清干净，否则 matches() 会继续按搜索过滤 */
    searchLabel = '';
    clearSearchState();
    clearInput();
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
    if (cropBanner) { cropBanner.hidden = false; }
    if (sideCol) { sideCol.hidden = true; }
    if (fullpage) { fullpage.classList.add('no-sidebar'); }
    var hash = key === KEY_ALL ? '#all' : (key === KEY_NONE ? '#untagged' : '#crop=' + encodeURIComponent(key));
    if (location.hash !== hash) { history.replaceState(null, '', hash); }
    if (listHead) { instantScrollIntoView(listHead); }
    syncRail();
  }

  /* ---------- 搜索视图 ----------
     和「点田块」复用同一个列表容器与分页，只是过滤条件换成关键词。
     搜索时把作物横幅藏起来：「成熟度 N 度」在跨标签的搜索结果里没有意义。 */
  function showSearch(text) {
    active = null;
    page = 1;
    searchQuery = text;
    searchLabel = text;
    render();
    if (gardenView) { gardenView.hidden = true; }
    if (listSection) { listSection.hidden = false; }
    if (cropBanner) { cropBanner.hidden = true; }
    if (bcCurrent) { bcCurrent.textContent = '🔍 搜索结果'; }
    if (sideCol) { sideCol.hidden = true; }
    if (fullpage) { fullpage.classList.add('no-sidebar'); }
    if (searchClear) { searchClear.hidden = false; }
    var hash = '#q=' + encodeURIComponent(text);
    if (location.hash !== hash) { history.replaceState(null, '', hash); }
    /* 刻意不 scrollIntoView：用户正在输入，抢滚动会很干扰 */
    syncRail();
  }

  /* 清空输入框（不触发 hashchange，避免和 showSearch 互相递归） */
  function clearInput() {
    if (searchInput && searchInput.value) { searchInput.value = ''; }
    if (searchClear) { searchClear.hidden = true; }
    if (searchStatus) { searchStatus.textContent = ''; }
  }

  /* ---------- 点击前先「钉住」正在进行的平滑滚动 ----------
     背景：html{scroll-behavior:smooth} 让本页所有程序化滚动都是动画（点目录跳转、
     回到顶部……）。而「动画中的元素会在按下→抬起这几十毫秒里从光标下移走」，
     浏览器就把 click 派发给按下点与抬起点的共同祖先（实测落到了 #crop-banner），
     这一下完全白点 —— 用户体感就是「点一次不生效，要点两次」。
     视图切换与分页已经改成瞬移（见上面的 instantScroll* 和分页那段），
     这里再给剩下的平滑滚动兜一层底：pointerdown 比 click 早，先把滚动按当前位置钉住，
     目标站住不动，click 就一定能派到它身上。
     用 behavior:'instant' 而不是 'auto'：'auto' 会去读 CSS 的 scroll-behavior（=smooth），
     等于又要起一段动画。旧引擎不认 'instant' 时退回两参数写法。 */
  document.addEventListener('pointerdown', function () {
    try {
      window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: 'instant' });
    } catch (e) {
      window.scrollTo(window.scrollX, window.scrollY);
    }
  }, true);

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
      /* 翻页也是「换内容」，和视图切换同理用瞬移：翻完页的平滑滚动期间，
         再点一次「下一页」会因为按钮已经移走而丢事件（实测连点两次只前进一步）。 */
      instantScrollIntoView(list);
    });
  }

  /* ---------- 搜索交互 ----------
     索引是本地数组、只有 108 项（109 篇 .md 减去不参与列表的技术/README.md），
     所以不做防抖：每敲一个字即时过滤，
     输入到结果出现之间没有延迟，加了 debounce 反而显得卡。 */
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      var v = searchInput.value.trim();
      if (!v) { showGarden(); return; }
      showSearch(v);
    });

    searchInput.addEventListener('focus', function () {
      if (searchForm) { searchForm.classList.add('is-focused'); }
    });
    searchInput.addEventListener('blur', function () {
      if (searchForm) { searchForm.classList.remove('is-focused'); }
    });
  }

  /* 搜索框是 <form role="search">：回车不刷新页面，直接保持当前结果。
     用 preventDefault 而不是去掉 form —— 有 form 才有原生的 role=search 语义 */
  if (searchForm) {
    searchForm.addEventListener('submit', function (e) { e.preventDefault(); });
  }

  if (searchClear) {
    searchClear.addEventListener('click', function () {
      clearInput();
      if (searchInput) { searchInput.focus(); }
      showGarden();
    });
  }

  document.addEventListener('keydown', function (e) {
    var el = document.activeElement;
    var typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

    /* Esc：搜索中先清搜索，否则退回菜园子 */
    if (e.key === 'Escape') {
      if (searchQuery) {
        clearInput();
        showGarden();
      } else if (active !== null) {
        showGarden();
      }
      return;
    }

    /* / 或 Ctrl/⌘+K 聚焦搜索框 */
    if (typing) { return; }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (searchInput) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      if (searchInput) { e.preventDefault(); searchInput.focus(); searchInput.select(); }
    }
  });

  /* ---------- 深链 ---------- */
  function readHash() {
    var h = location.hash.replace(/^#/, '');
    if (h === 'all') { return KEY_ALL; }
    if (h === 'untagged') { return KEY_NONE; }
    var q = h.match(/^q=(.*)$/);
    if (q) { return { q: decodeURIComponent(q[1]) }; }
    var m = h.match(/^crop=(.+)$/);
    if (m) { return decodeURIComponent(m[1]).toLowerCase(); }
    return null;
  }

  function applyHash() {
    var key = readHash();
    if (key === null) { showGarden(); }
    else if (typeof key === 'object') {
      if (searchInput) { searchInput.value = key.q; }
      if (key.q) { showSearch(key.q); } else { showGarden(); }
    } else { showCrop(key); }
  }

  window.addEventListener('hashchange', applyHash);

  /* ---------- 初始：默认停在菜园子 ---------- */
  var initial = readHash();
  if (initial === null || (typeof initial === 'object' && !initial.q)) {
    if (gardenView) { gardenView.hidden = false; }
    if (listSection) { listSection.hidden = true; }
    if (sideCol) { sideCol.hidden = false; }
    if (fullpage) { fullpage.classList.remove('no-sidebar'); }
    render();
    /* 清掉无法识别的 hash（如 #foo），避免地址栏和视图不一致 */
    if (location.hash) { history.replaceState(null, '', location.pathname + location.search); }
    syncRail();
  } else if (typeof initial === 'object') {
    if (searchInput) { searchInput.value = initial.q; }
    showSearch(initial.q);
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

  /* ---------- 访客计数（GoatCounter 公开 counter 接口） ----------
     踩过的坑：原来打的是 https://<code>.goatcounter.com/api/v2/counters/<code>，
     这个地址根本不存在 —— 官方 JSON API 是 /api/v0/*，而且必须在 header 里
     带 Authorization: Bearer <token>。把 token 写进前端脚本等于把你的统计后台
     公开（谁都能读、v0/count 还能伪造数据），所以前端只该用公开接口：
         https://<code>.goatcounter.com/counter/<PATH>.json   →  {"count": "1,234"}
     PATH 用大写 TOTAL（区分大小写、不带前导斜杠）取全站总数。
     ⚠ 该接口需要在 GoatCounter 后台打开设置
        「Allow adding visitor counts on your website」，
        否则一律返回 403（设置项默认关闭，防止数据被无意泄露）。
     响应最多缓存 4 小时，所以没必要刷太勤，5 分钟一次足够。 */
  (function () {
    var el = document.getElementById('visitor-count');
    if (!el) { return; }
    var CODE = 'miki99-duck';
    var TIP = '访问 https://' + CODE + '.goatcounter.com，在站点设置里打开' +
      '「Allow adding visitor counts on your website」后这里才会显示数字';
    function update() {
      fetch('https://' + CODE + '.goatcounter.com/counter/TOTAL.json')
        .then(function (r) {
          /* 没打开访客计数设置时是 403：保持 "--"，并把原因写进 title */
          if (!r.ok) { el.title = TIP; return null; }
          return r.json();
        })
        .then(function (d) {
          if (d && d.count) {
            el.textContent = d.count;
            el.title = '全站累计访问量（GoatCounter 统计）';
          }
        })
        .catch(function () {
          /* 被广告拦截器或断网挡掉：静默保持 "--"，不打扰阅读 */
          el.title = TIP;
        });
    }
    update();
    setInterval(update, 300000);
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
