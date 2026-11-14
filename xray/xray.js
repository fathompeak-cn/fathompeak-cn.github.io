/* ==========================================================
   XRAY 层 —— 三个动作：
   1) 进入镜像 3 秒后，渐变打开“揭穿”动画
   2) 动画结束后，把可疑处标红/圈出
   3) 点任意标红处，弹出证据卡（显示后台数据的“占位符”原文）
   全部依赖 xray/claims.json；不改原站任何文件
   ========================================================== */
(function () {
  'use strict';
  // 前几秒保持与原站完全一致：先隐藏所有自有 UI，揭穿开始或选择“先看原样”后再出现
  try { document.documentElement.classList.add('xray-idle'); } catch (e) {}
  var X = window.__XRAY = {};
  var CLAIMS = null, byId = {};
  var flagged = [], circles = [], badges = [];
  var mode = 'off'; // off | flags | reveal
  var revealAt = Date.now();
  var REVEAL_DELAY = 3000;

  /* ---------- 工具 ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function reduced() { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function currentRoute() { var h = (location.hash || '#home').replace(/^#/, '').split('/')[0].split('?')[0]; return h || 'home'; }
  function inHome2() { var f = document.getElementById('fp-fresh'); return !!(f && f.classList.contains('on')); }

  /* ---------- 载入数据 ---------- */
  X.init = function () {
    var p = fetch('xray/claims.json', { cache: 'no-store' }).then(function (r) { return r.json(); });
    p.then(function (data) {
      CLAIMS = data; (data.claims || []).forEach(function (c) { byId[c.id] = c; });
      try { buildChrome(); } catch (e) { console.warn('[xray] chrome', e); }
      try { routeWatcher(); } catch (e) { console.warn('[xray] routeWatcher', e); }
      try { buildFlags(); } catch (e) { console.warn('[xray] flags', e); }
      try { buildCircles(data.redCircle || []); } catch (e) { console.warn('[xray] circles', e); }
      try { startRevealTimer(); } catch (e) { console.warn('[xray] timer', e); }
      try { hookUrlMode(); } catch (e) { console.warn('[xray] url', e); }
    }).catch(function (e) { console.warn('[xray] claims 载入失败', e); });
    return p;
  };

  /* ---------- 常驻角标 / 工具条 ---------- */
  function buildChrome() {
    if ($('#xray-badge')) return;
    var badge = el('div', '', '<span class="dot"></span><span>镜像副本 · <b>非官方</b> · 点此揭穿</span>');
    badge.id = 'xray-badge'; badge.title = '这是一个用于展示疑点的镜像副本，不是沐仞官方页面';
    badge.addEventListener('click', function () { openDrawer(); });
    document.body.appendChild(badge);

    var tools = el('div');
    tools.id = 'xray-tools';
    tools.innerHTML =
      '<button type="button" data-x="flags" aria-pressed="true">揭穿层</button>' +
      '<span class="sep"></span>' +
      '<button type="button" data-x="evidence">证据清单</button>';
    tools.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-x]'); if (!b) return;
      var k = b.getAttribute('data-x');
      if (k === 'flags') toggleFlags();
      if (k === 'evidence') openDrawer();
    });
    document.body.appendChild(tools);
    mode = 'flags';
  }

  /* ---------- 可疑处标记（只在当前可见路由内查找） ---------- */
  var SKIP_SEL = '#xray-badge,#xray-tools,#xray-card,#xray-reveal,#xray-sassy,#xray-drawer,script,style,svg,nav,header.hero,pre,code';
  function isShown(n) {
    for (var e = n; e && e !== document.documentElement; e = e.parentElement) {
      var cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    }
    return true;
  }
  function activeScope() {
    var f = document.getElementById('fp-fresh');
    if (f && f.classList.contains('on')) { var h = f.querySelector('[data-route]'); if (h) return h; return f; }
    var secs = $$('section[data-route]');
    for (var i = 0; i < secs.length; i++) { if (isShown(secs[i])) return secs[i]; }
    return null;
  }
  function markElement(node, claim) {
    if (!node) return false;
    var t = node;
    if (t.nodeType === 3) {
      if (t.parentElement && t.parentElement.closest(SKIP_SEL)) return false;
      var span = el('span');
      span.className = 'x-flag' + (claim.level === 'strong' ? ' x-strong' : '');
      span.setAttribute('data-claim', claim.id); span.setAttribute('role', 'button'); span.setAttribute('tabindex', '0');
      span.textContent = t.nodeValue;
      t.parentNode.replaceChild(span, t); t = span;
    } else {
      if (!t.closest || t.closest(SKIP_SEL)) return false;
      if (!t.classList.contains('x-flag')) { t.classList.add('x-flag'); t.setAttribute('data-claim', claim.id); t.setAttribute('role', 'button'); t.setAttribute('tabindex', '0'); }
      if (claim.level === 'strong') t.classList.add('x-strong');
    }
    flagged.push(t); return true;
  }
  function findText(scope, raw) {
    var tw = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = tw.nextNode())) {
      var p = n.parentElement; if (!p || (p.closest && p.closest(SKIP_SEL))) continue;
      if ((n.nodeValue || '').indexOf(raw) >= 0) return n;
    }
    return null;
  }
  function buildFlags() {
    flagged = [];
    var scope = activeScope();
    if (!scope) return;
    (CLAIMS.claims || []).forEach(function (c) {
      try {
        // 已经标过这一条就不要再包一层（慢网络下会多次补扫）
        if (scope.querySelector('.x-flag[data-claim="' + c.id + '"]')) return;
        if (c.selector) { var t = scope.querySelector(c.selector); if (t) markElement(t, c); }
        if (c.match) { var node = findText(scope, c.match); if (node) markElement(node, c); }
      } catch (e) { console.warn('[xray] 标记失败', c.id, e.message); }
    });
  }
  /* ---------- 点击 / 键盘：打开证据卡（window 捕获阶段，先于原站路由处理） ---------- */
  function onFlagClick(e) {
    if (e.__xrayDone) return; e.__xrayDone = true;
    var t = e.target;
    var f = t && t.closest ? t.closest('.x-flag') : null;
    if (!f) return;
    e.preventDefault(); e.stopPropagation();
    var id = f.getAttribute('data-claim');
    if (byId[id]) openCard(id, f);
  }
  window.addEventListener('click', onFlagClick, false);
  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var f = e.target.closest && e.target.closest('.x-flag');
    if (!f) return;
    e.preventDefault(); var id = f.getAttribute('data-claim'); if (byId[id]) openCard(id, f);
  }, true);

  /* ---------- 大红圈 + 一句话引导 ---------- */
  function placeBadge(b, r, hint) {
    if (!b) return;
    var vw = innerWidth;
    var w = b.offsetWidth || 210, h = b.offsetHeight || 32;
    var left = Math.min(Math.max(12, r.left + r.width / 2 - w / 2), vw - w - 12) + scrollX;
    var top = (r.top > h + 26) ? (r.top - h - 16 + scrollY) : (r.bottom + 14 + scrollY);
    b.style.transform = 'none';
    b.style.left = left + 'px'; b.style.top = top + 'px';
    b.style.position = 'absolute';
  }
  function buildCircles(list) {
    list.forEach(function (rc) {
      var claim = byId[rc.claimId]; if (!claim) return;
      var target = null;
      var draw = function () {
        var scene = (X.getScope ? X.getScope() : activeScope()) || document;
        var t = scene.querySelector(rc.selector);
        if (!t || !isShown(t)) return;
        if (circles.some(function (c) { return c.getAttribute('data-for') === rc.claimId + '|' + rc.selector; })) return;
        target = t;
        var r = t.getBoundingClientRect();
        if (r.width < 4 && r.height < 4) return;
        var pad = 12;
        var x = r.left + scrollX - pad, y = r.top + scrollY - pad, w = r.width + pad * 2, h = r.height + pad * 2;
        var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'x-circle');
        svg.setAttribute('data-for', rc.claimId + '|' + rc.selector);
        svg.style.position = 'absolute'; svg.style.left = '0'; svg.style.top = '0';
        svg.style.width = '100%'; svg.style.height = '100%';
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var jx = 5; // 手绘抖动
        var d = 'M' + (x + 18) + ' ' + (y + 5 + jx) +
          ' C' + (x + w * .3) + ' ' + (y - 4) + ' ' + (x + w * .75) + ' ' + (y + 3) + ' ' + (x + w - 8) + ' ' + (y + 10) +
          ' C' + (x + w + 5) + ' ' + (y + h * .32) + ' ' + (x + w + 4) + ' ' + (y + h * .78) + ' ' + (x + w - 16) + ' ' + (y + h - 2) +
          ' C' + (x + w * .55) + ' ' + (y + h + 5) + ' ' + (x + w * .2) + ' ' + (y + h - 2) + ' ' + (x + 6) + ' ' + (y + h - 8) +
          ' C' + (x - 5) + ' ' + (y + h * .58) + ' ' + (x + 2) + ' ' + (y + h * .18) + ' ' + (x + 18) + ' ' + (y + 5 + jx);
        path.setAttribute('d', d);
        path.style.setProperty('--len', '3200');
        svg.appendChild(path);
        var hint = rc.hint || claim.flag || claim.title;
        document.body.appendChild(svg);
        // 引导语用独立的 HTML 层（SVG 内的 <a> 不参与布局）
        var badge = document.createElement('a');
        badge.className = 'x-badge'; badge.href = '#xray-' + rc.claimId;
        badge.setAttribute('data-for', rc.claimId + '|' + rc.selector);
        badge.innerHTML = '<i>✳</i>' + esc(hint) + '<span class="arr">›</span>';
        badge.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openCard(rc.claimId, target || null); });
        svg.setAttribute('data-badge', '1');
        badges.push(badge);
        document.body.appendChild(badge);
        placeBadge(badge, r, hint);
        circles.push(svg);
        if (!t.classList.contains('x-circle-target')) { t.classList.add('x-circle-target'); }
      };
      (X._circles = X._circles || []).push(draw);
      draw();
    });
    var onRe = function () { clearCircles(); (X._circles || []).forEach(function (f) { try { f(); } catch (e) {} }); circles.forEach(function (sv) { sv.classList.add('drawn'); }); };
    window.addEventListener('resize', onRe);
    window.addEventListener('scroll', function () { /* 滚动时只是位置变化，圈是绝对定位，无需重画 */ }, { passive: true });
  }
  function clearCircles() {
    circles.forEach(function (s) { s.remove(); });
    badges.forEach(function (b) { b.remove(); });
    circles = []; badges = [];
    $$('.x-circle-target').forEach(function (t) { t.classList.remove('x-circle-target'); });
  }
  /* 慢网络/首屏脚本较大时，站点内容可能在 xray 初始化之后才渲染。
     这里补扫当前路由，直到标记和红圈都出现（最多 25 秒）。 */
  var markRetry = 0;
  function drawCirclesNow() {
    (X._circles || []).forEach(function (f) { try { f(); } catch (e) {} });
    circles.forEach(function (sv) { setTimeout(function () { sv.classList.add('drawn'); }, 80); });
  }
  function ensureMarked(limitMs) {
    var started = Date.now();
    clearInterval(markRetry);
    markRetry = setInterval(function () {
      if (!document.body.classList.contains('xray-flags-on')) { clearInterval(markRetry); return; }
      var sc = activeScope();
      var alive = $$('.x-flag').filter(function (n) { return sc && sc.contains(n) && isShown(n); });
      if (!alive.length) { try { buildFlags(); } catch (e) {} }
      drawCirclesNow();
      if (alive.length && circles.length) { clearInterval(markRetry); return; }
      if (Date.now() - started > (limitMs || 25000)) clearInterval(markRetry);
    }, 800);
  }

  /* ---------- 证据卡 ---------- */
  var card = null, cardFor = null;
  function openCard(id, anchor) {
    var c = byId[id]; if (!c) return;
    if (!card) {
      card = el('div'); card.id = 'xray-card';
      card.innerHTML = '<div class="xc-head"><span class="xc-tag"></span><h3></h3><button class="xc-close" type="button" aria-label="关闭">×</button></div>' +
        '<div class="xc-body"></div><div class="xc-foot"></div><div class="xc-note"></div>';
      card.querySelector('.xc-close').addEventListener('click', closeCard);
      document.body.appendChild(card);
    }
    var tag = card.querySelector('.xc-tag');
    tag.textContent = c.tag === 'evidence' ? '证据' : (c.tag === 'unverified' ? '未核实' : '推断');
    tag.className = 'xc-tag' + (c.tag !== 'evidence' ? ' warn' : '');
    card.querySelector('h3').textContent = c.title;
    var body = card.querySelector('.xc-body');
    body.innerHTML =
      '<div class="xc-row claim"><span class="lab">他们怎么说</span><span class="val">' + esc(c.claim) + '</span></div>' +
      '<div class="xc-row fact"><span class="lab">实际是什么</span><span class="val">' + esc(c.fact) + '</span></div>' +
      (c.premise ? '<div class="xc-row"><span class="lab">前提</span><span class="val">' + esc(c.premise) + '</span></div>' : '') +
      '<div class="xc-row"><span class="lab">后台数据 · 原文</span><pre class="x-code">' +
        esc((c.evidence || []).map(function (e) { return '// ' + e.file + ' · ' + e.pointer + '\n' + e.value; }).join('\n\n')) +
      '</pre></div>' +
      (c.verify ? '<div class="xc-row"><span class="lab">你自己怎么验</span><pre class="x-code">' + esc(c.verify) + '</pre></div>' : '');
    var foot = card.querySelector('.xc-foot');
    foot.innerHTML = '<button type="button" class="primary" data-x="copy">复制验证命令</button>' +
      '<button type="button" data-x="drawer">看全部证据</button>';
    foot.querySelector('[data-x="copy"]').addEventListener('click', function () {
      var txt = (c.verify || '');
      if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { flash('已复制'); }, function () { flash('复制失败，请手动选择'); });
      else flash('请手动选择文本');
      function flash(m) { var b = foot.querySelector('[data-x="copy"]'); var o = b.textContent; b.textContent = m; setTimeout(function () { b.textContent = o; }, 1400); }
    });
    foot.querySelector('[data-x="drawer"]').addEventListener('click', function () { closeCard(); openDrawer(); });
    card.querySelector('.xc-note').textContent = '状态：' + (CLAIMS.meta.tiers || {})[c.tag] || '';
    // 先隐藏测量再显形，避免宽高为 0 导致定位错误
    card.style.visibility = 'hidden';
    placeCard(anchor);
    card.classList.add('on');
    card.style.visibility = '';
    requestAnimationFrame(function () { placeCard(anchor); });
    // 把被点的元素挪到卡片后面，避免同一页里重复展开覆盖
    Array.prototype.forEach.call(card.querySelectorAll('[data-x]'), function () {});
    if (cardFor) cardFor.classList.remove('x-open');
    cardFor = anchor; if (anchor) anchor.classList.add('x-open');
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
  }
  function placeCard(anchor) {
    if (!card) return;
    var vw = innerWidth, vh = innerHeight;
    var w = card.offsetWidth || 440;
    if (vw <= 800 || !anchor) { card.style.left = ''; card.style.top = ''; card.style.right = ''; card.style.bottom = ''; return; }
    var r = anchor.getBoundingClientRect();
    var left = Math.min(Math.max(14, r.left), vw - w - 14);
    var top = r.bottom + 10;
    var h = card.offsetHeight || 300;
    if (top + h > vh - 14) top = Math.max(14, r.top - h - 10);
    card.style.left = left + 'px'; card.style.top = top + 'px'; card.style.right = 'auto'; card.style.bottom = 'auto';
  }
  function onScroll() { if (cardFor) placeCard(cardFor); }
  function onResize() { if (cardFor) placeCard(cardFor); }
  function closeCard() {
    if (!card) return; card.classList.remove('on');
    if (cardFor) cardFor.classList.remove('x-open'); cardFor = null;
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeCard(); closeSassy(); } });

  /* ---------- 揭穿动画 ---------- */
  var overlay = null, timer = 0, done = false;
  function buildOverlay() {
    if (overlay) return overlay;
    overlay = el('div'); overlay.id = 'xray-reveal'; overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML =
      '<div class="x-panel">' +
        '<span class="x-kick">本站镜像 · 3 秒揭穿 · 不是官方页面</span>' +
        '<h2 class="x-big">这份“绿电词元”，<br><em>我们没有一句能兑现。</em></h2>' +
        '<p class="x-sub">下面 5 件事，他们写在官网上、写得很漂亮。可只要点开任何一处，<b>后台原始数据就摆在那里</b>——电站是手工标签，实时行情是写死的 12 行，模型数目自己都对不上。</p>' +
        '<div class="x-count">' +
          '<div><b>12</b><span>行“实时”行情</span></div>' +
          '<div><b>7</b><span>座手工电站</span></div>' +
          '<div><b>6 / 7</b><span>两套模型目录</span></div>' +
          '<div><b>0</b><span>座已投产电站</span></div>' +
        '</div>' +
        '<div class="x-go"><button type="button" data-x="enter">开始逐条揭穿</button><button type="button" class="ghost" data-x="skip">先看原样</button></div>' +
        '<div class="x-progress"><i></i></div>' +
      '</div>';
    overlay.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-x]'); if (!b) return;
      if (b.getAttribute('data-x') === 'enter') { closeOverlay(); enterFlags(); }
      if (b.getAttribute('data-x') === 'skip') { closeOverlay(); dismissToPlain(); }
    });
    document.body.appendChild(overlay);
    return overlay;
  }
  function openOverlay() {
    var o = buildOverlay();
    o.classList.add('on');
    requestAnimationFrame(function () { o.classList.add('show'); });
    var bar = o.querySelector('.x-progress i'); bar.style.width = '0';
    setTimeout(function () { bar.style.width = '100%'; }, 60);
    if (!document.body.hasAttribute('data-x-scroll')) {
      document.body.setAttribute('data-x-scroll', document.body.style.overflow || '');
      document.body.style.overflow = 'hidden';
    }
  }
  function closeOverlay() {
    if (!overlay) return;
    overlay.classList.remove('show'); overlay.classList.remove('on');
    if (document.body.hasAttribute('data-x-scroll')) {
      document.body.style.overflow = document.body.getAttribute('data-x-scroll') || '';
      document.body.removeAttribute('data-x-scroll');
    }
  }
  function startRevealTimer() {
    clearTimeout(timer);
    revealAt = Date.now();
    if (reduced()) { enterFlags(); return; }
    timer = setTimeout(function () { if (mode === 'flags') runReveal(false); else runReveal(false); }, REVEAL_DELAY);
  }
  function runReveal(force) {
    if (done && !force) return;
    done = true;
    // 进入页面 3 秒后打开揭穿动画
    openOverlay();
  }
  function enterFlags() {
    mode = 'reveal';
    document.documentElement.classList.remove('xray-idle');
    closeOverlay();
    document.documentElement.classList.add('xray-flags-on');
    document.body.classList.add('xray-flags-on');
    // 圈出来：等遮罩淡出（约 550ms）后再画，避免被遮挡导致尺寸为 0
    setTimeout(function () {
      (X._circles || []).forEach(function (f) { try { f(); } catch (e) {} });
      circles.forEach(function (svg) { setTimeout(function () { svg.classList.add('drawn'); }, 80); });
      startObserveCircles();
    }, 620);
    ensureMarked(25000);
    // 俏皮卡：公司 / 顾问 / 订单
    showSassy();
    // 滚动到第一处可疑点
    setTimeout(function () {
      var first = findFirstVisibleFlag();
      if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 450);
  }
  function findFirstVisibleFlag() {
    var list = flagged.filter(function (n) { return n.offsetParent !== null && n.getBoundingClientRect().top > 0; });
    return list[0] || flagged[0] || null;
  }
  function startObserveCircles() {
    if (X._io) X._io.disconnect();
    X._io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var svg = en.target; if (svg.classList.contains('drawn')) return;
          svg.classList.add('drawn');
        }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    circles.forEach(function (s) { X._io.observe(s); });
  }

  /* ---------- 俏皮卡（公司 / 顾问 / 订单） ---------- */
  var sassy = null;
  function showSassy() {
    if (sassy) { sassy.classList.add('on'); return; }
    sassy = el('div'); sassy.id = 'xray-sassy';
    var q = (CLAIMS.sassy && CLAIMS.sassy.questions) || [];
    sassy.innerHTML =
      '<div class="xs-head"><span class="xs-face">😳</span><b>沐仞的商务口径</b><button class="xs-close" type="button" aria-label="关闭">×</button></div>' +
      '<p class="xs-q">有本事你问我，我肯定答不上来</p>' +
      '<ul>' + q.map(function (x) { return '<li><i>❓</i><span><b>' + esc(x.q) + '</b><br>' + esc(x.a) + '</span></li>'; }).join('') + '</ul>' +
      '<p class="xs-foot">以上问题，官网上都找不到答案：没有客户名、没有合同号、也没有真正在跑的电站。</p>';
    sassy.querySelector('.xs-close').addEventListener('click', function () { closeSassy(); });
    sassy.addEventListener('click', function (e) {
      if (e.target.closest('li')) openDrawer();
    });
    document.body.appendChild(sassy);
    requestAnimationFrame(function () { sassy.classList.add('on'); });
  }
  function closeSassy() { if (sassy) sassy.classList.remove('on'); }

  /* ---------- 先看原样：只保留最小的“镜像副本”声明 ---------- */
  function dismissToPlain() {
    document.documentElement.classList.remove('xray-idle');
    document.documentElement.classList.add('xray-plain');
    document.body.classList.remove('xray-flags-on');
    closeCard(); closeSassy(); clearCircles();
  }

  /* ---------- 切换揭穿层 ---------- */
  function toggleFlags() {
    var on = !document.body.classList.contains('xray-flags-on');
    document.body.classList.toggle('xray-flags-on', on);
    document.documentElement.classList.toggle('xray-flags-on', on);
    var b = $('#xray-tools [data-x="flags"]'); if (b) b.setAttribute('aria-pressed', String(on));
    if (on) {
      (X._circles || []).forEach(function (f) { try { f(); } catch (e) {} });
      circles.forEach(function (s) { s.classList.add('drawn'); });
      showSassy();
      ensureMarked(12000);
    } else { closeCard(); closeSassy(); }
  }

  /* ---------- 证据抽屉 ---------- */
  var drawer = null;
  function openDrawer() {
    if (!drawer) {
      drawer = el('div'); drawer.id = 'xray-drawer';
      drawer.innerHTML =
        '<div class="xd-main">' +
          '<div class="xd-head"><div><h2>证据清单 · 自己验一遍</h2><p style="margin:2px 0 0;font-size:11.5px;color:var(--ink-50)">每一条都标注：证据 / 未核实 / 推断</p></div><button class="xd-x" type="button" aria-label="关闭">×</button></div>' +
          '<div id="xray-drawer-body"></div>' +
          '<div class="xd-disclaimer">本站是镜像副本，不是沐仞官方页面。所有数字来自站点自身公开数据；标为“未核实”的部分需要读者自行查证，本站不作定论。</div>' +
        '</div>' +
        '<div class="xd-side" style="background:rgba(20,18,20,.55)"></div>';
      drawer.querySelector('.xd-x').addEventListener('click', function () { drawer.classList.remove('on'); });
      drawer.addEventListener('click', function (e) { if (e.target === drawer || e.target.classList.contains('xd-side')) drawer.classList.remove('on'); });
      document.body.appendChild(drawer);
      renderDrawer();
    }
    drawer.classList.add('on');
  }
  function renderDrawer() {
    var body = $('#xray-drawer-body'); if (!body) return;
    var groups = { evidence: '证据（可复现）', inference: '推断（有前提）', unverified: '未核实（需自行查证）' };
    var html = '';
    Object.keys(groups).forEach(function (k) {
      var list = (CLAIMS.claims || []).filter(function (c) { return c.tag === k; });
      if (!list.length) return;
      html += '<h3>' + groups[k] + '</h3>';
      list.forEach(function (c) {
        html += '<div class="xd-item"><b>' + esc(c.title) + '</b><p>' + esc(c.fact) + '</p>' +
          (c.verify ? '<button type="button" data-run="' + esc(c.id) + '">▶ 显示验证命令</button><div class="out" hidden><pre>' + esc(c.verify) + '</pre></div>' : '') +
          '</div>';
      });
    });
    html += '<h3>未核实 · 需要外部登记信息</h3>' +
      '<div class="xd-item"><b>张文宇 · 首席顾问</b><p>页面写“前浙江大学二级教授、麻省理工学院博士后、群智工业理论提出者、连续 4 年全球前 2% 科学家”。<br>去浙大教师主页、MIT 校友档案、公开论文库按姓名检索，看是否能对上。</p></div>' +
      '<div class="xd-item"><b>订单：“数千万、海外为主”</b><p>没有任何客户名、合同号，也没有可以核对的公开记录。</p></div>';
    body.innerHTML = html;
    body.querySelectorAll('button[data-run]').forEach(function (b) {
      b.addEventListener('click', function () {
        var out = b.nextElementSibling; if (!out) return;
        var hidden = out.hidden; out.hidden = !hidden;
        b.textContent = (hidden ? '▼ 收起验证命令' : '▶ 显示验证命令');
      });
    });
  }

  /* ---------- 路由观察：换页后再标记（不做 MutationObserver，避免循环） ---------- */
  var remarkTimer = 0;
  function remark(delay) {
    clearTimeout(remarkTimer);
    remarkTimer = setTimeout(function () {
      if (document.body.classList.contains('xray-flags-on')) {
        // 标记已存在就不重复处理
        var sc = activeScope();
      var alive = $$('.x-flag').filter(function (n) { return sc && sc.contains(n) && isShown(n); });
        if (alive.length) {
          if (!circles.length) { (X._circles || []).forEach(function (f) { try { f(); } catch (e) {} }); circles.forEach(function (sv) { sv.classList.add('drawn'); }); }
          ensureMarked(12000);
          return;
        }
      }
      closeCard(); clearCircles();
      try { buildFlags(); } catch (e) {}
      if (document.body.classList.contains('xray-flags-on')) {
        (X._circles || []).forEach(function (f) { try { f(); } catch (e) {} });
        circles.forEach(function (sv) { sv.classList.add('drawn'); });
        ensureMarked(12000);
      }
    }, delay);
  }
  function routeWatcher() {
    var last = location.hash;
    var onHash = function () {
      if (location.hash === last) return;
      last = location.hash; remark(520);
    };
    window.addEventListener('hashchange', onHash);
    document.addEventListener('hashchange', onHash, true);
    // 原站也走 history.pushState 时兜底
    var push = history.pushState;
    history.pushState = function () { var r = push.apply(this, arguments); setTimeout(onHash, 0); return r; };
    window.addEventListener('popstate', function () { setTimeout(onHash, 0); });
    // 同一 hash 内由原站内部切换（点击导航）也补一次
    document.addEventListener('click', function (e) {
      if (!e.target.closest('a[href^="#"],#xray-tools,#xray-badge')) return;
      setTimeout(function () { remark(420); }, 0);
    }, true);
    setTimeout(function () { if (!document.querySelector('.x-flag')) remark(0); }, 1300);
  }

  /* ---------- URL 模式：?x=0 关闭，?x=reveal 直接打开 ---------- */
  function hookUrlMode() {
    var p = new URLSearchParams(location.search + (location.hash.indexOf('?') >= 0 ? location.hash.slice(location.hash.indexOf('?')) : ''));
    if (p.get('x') === '0') { clearTimeout(timer); document.body.classList.remove('xray-flags-on'); }
    if (p.get('x') === 'reveal') { clearTimeout(timer); enterFlags(); }
  }

  /* ---------- 启动 ---------- */
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', X.init);
  else X.init();
})();
