// Episode markup, shared by build.js (baked into the page at deploy) and
// site.js (re-rendered in the browser when a newer upload shows up).
(function (root) {
  'use strict';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  // keep the last two words together so a title never ends on one orphaned word
  function tie(s) { return String(s).replace(/(\S+) ([^\s<>]{1,14})$/, function (m, a, b) { return (a + b).length <= 18 ? a + '&nbsp;' + b : m; }); }
  function day(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return null;
    var p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(d);
    var get = function (t) { for (var i = 0; i < p.length; i++) if (p[i].type === t) return +p[i].value; };
    return { y: get('year'), m: get('month'), d: get('day') };
  }
  function longDate(iso) { var x = day(iso); return x ? MONTHS[x.m - 1] + ' ' + x.d + ', ' + x.y : ''; }
  function daysAgo(iso, now) {
    var a = day(iso), b = day(now || new Date().toISOString());
    if (!a || !b) return null;
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 864e5);
  }
  function relDate(iso, now) {
    var n = daysAgo(iso, now);
    if (n === null) return '';
    if (n <= 0) return 'Today';
    if (n === 1) return 'Yesterday';
    if (n < 7) return n + ' days ago';
    return longDate(iso);
  }
  function play(cls) { return '<svg class="' + (cls || 'play') + '" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>'; }
  function num(e) { return e.number ? '<span class="ep-num">Ep. ' + esc(e.number) + '</span>' : ''; }

  function latest(e, L, now) {
    if (!e) return '';
    var fresh = daysAgo(e.published, now);
    var isNew = fresh !== null && fresh <= (+L.newDays || 7);
    return '' +
      '<article class="latest-card" data-id="' + esc(e.id) + '">' +
        (isNew ? '<span class="drop-badge" aria-hidden="true"><svg viewBox="0 0 120 120"><defs><path id="dropc" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/></defs><text><textPath href="#dropc" textLength="276" lengthAdjust="spacing">' + esc(L.newLabel) + ' &#10038; ' + esc(L.newLabel) + ' &#10038;&#160;</textPath></text></svg></span>' : '') +
        '<button class="thumb" type="button" data-video="' + esc(e.id) + '" data-title="' + esc(e.title) + '" aria-label="' + esc(L.playLabel) + ': ' + esc(e.title) + '">' +
          '<img src="' + esc(e.thumbHd) + '" data-fallback="' + esc(e.thumb) + '" alt="" width="1280" height="720" fetchpriority="high">' +
          '<span class="play-btn">' + play() + '<span>' + esc(L.playLabel) + '</span></span>' +
        '</button>' +
        '<div class="latest-meta">' +
          '<p class="latest-label"><span class="pulse" aria-hidden="true"></span>' + esc(isNew ? L.newLabel : L.label) + '</p>' +
          '<h2 class="latest-title">' + num(e) + '<a href="' + esc(e.url) + '" target="_blank" rel="noopener">' + tie(esc(e.title)) + '</a></h2>' +
          (e.summary ? '<p class="latest-sum">' + esc(e.summary) + '</p>' : '') +
          '<p class="latest-date"><time datetime="' + esc(e.published) + '">' + esc(relDate(e.published, now)) + '</time></p>' +
        '</div>' +
      '</article>';
  }

  function card(e, i) {
    return '' +
      '<li class="ep reveal" style="--d:' + (i % 3) * 80 + 'ms">' +
        '<button class="ep-btn" type="button" data-video="' + esc(e.id) + '" data-title="' + esc(e.title) + '">' +
          '<span class="ep-thumb"><img src="' + esc(e.thumb) + '" alt="" width="480" height="360" loading="lazy" decoding="async">' + play('play mini') + '</span>' +
          '<span class="ep-body">' + num(e) +
            '<span class="ep-title">' + tie(esc(e.title)) + '</span>' +
            '<time datetime="' + esc(e.published) + '">' + esc(longDate(e.published)) + '</time>' +
          '</span>' +
        '</button>' +
      '</li>';
  }

  function grid(list, count) { return list.slice(1, 1 + (+count || 6)).map(card).join(''); }

  // "318 episodes and counting", calculated from the newest episode number
  function count(list, text) {
    var n = 0;
    for (var i = 0; i < list.length; i++) if (list[i].number > n) n = list[i].number;
    return n ? '<strong>' + n + '</strong> ' + esc(text) : '';
  }

  var api = { esc: esc, tie: tie, longDate: longDate, relDate: relDate, latest: latest, grid: grid, count: count };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.UncomfyRender = api;
})(this);

// unCOMFORTABLE: page behavior. Everything still works without it.
(function () {
  'use strict';
  var R = window.UncomfyRender;
  var cfg = {};
  try { cfg = JSON.parse(document.getElementById('cfg').textContent); } catch (e) {}
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- reveal on scroll ----------
  function watch(root) {
    var els = (root || document).querySelectorAll('.reveal:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(function (el) { el.classList.add('in'); }); return; }
    var io = watch.io || (watch.io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' }));
    els.forEach(function (el) { io.observe(el); });
  }
  watch();

  // ---------- thumbnails: fall back when YouTube has no HD version ----------
  function thumbs(root) {
    root.querySelectorAll('img[data-fallback]').forEach(function (img) {
      var swap = function () { if (img.dataset.fallback && img.src !== img.dataset.fallback) { img.src = img.dataset.fallback; img.removeAttribute('data-fallback'); } };
      img.addEventListener('error', swap);
      // YouTube's "missing" maxres image is a 120px gray placeholder, not an error
      img.addEventListener('load', function () { if (img.naturalWidth && img.naturalWidth < 200) swap(); });
      if (img.complete && img.naturalWidth && img.naturalWidth < 200) swap();
    });
  }
  thumbs(document);

  // ---------- newest episode: check YouTube on every visit ----------
  var latestEl = document.querySelector('[data-latest]');
  var gridEl = document.querySelector('[data-grid]');
  var countEl = document.querySelector('[data-count]');
  if (latestEl && R && window.fetch) {
    fetch('/api/episodes' + (cfg.playlist ? '?list=' + encodeURIComponent(cfg.playlist) : ''))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        var eps = data && data.episodes;
        if (!eps || !eps.length) return;
        var now = new Date().toISOString();
        var changed = eps[0].id !== cfg.newest;
        // always refresh dates ("2 days ago") and pick up anything new
        latestEl.innerHTML = R.latest(eps[0], cfg.labels, now);
        if (changed) { latestEl.classList.remove('arrive'); void latestEl.offsetWidth; latestEl.classList.add('arrive'); }
        thumbs(latestEl);
        if (gridEl) { gridEl.innerHTML = R.grid(eps, cfg.count); thumbs(gridEl); watch(gridEl); }
        if (countEl) { var html = R.count(eps, cfg.countText); if (html) countEl.innerHTML = html; }
      })
      .catch(function () {});
  }

  // ---------- click to play (keeps YouTube off the page until asked) ----------
  var dlg = document.querySelector('.player');
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-video]');
    if (!b) return;
    var id = b.getAttribute('data-video');
    if (!/^[\w-]{6,20}$/.test(id)) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    f.title = b.getAttribute('data-title') || 'Episode';
    if (dlg && dlg.showModal) {
      dlg.querySelector('.frame').replaceChildren(f);
      dlg.showModal();
    } else window.open('https://www.youtube.com/watch?v=' + id, '_blank', 'noopener');
  });
  if (dlg) {
    var stop = function () { dlg.querySelector('.frame').replaceChildren(); };
    dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.closest('.close')) dlg.close(); });
    dlg.addEventListener('close', stop);
  }

  // ---------- comfort meter: the further you scroll, the less comfortable it gets ----------
  var meter = document.querySelector('.meter');
  if (meter) {
    var fill = meter.querySelector('.meter-fill'), state = meter.querySelector('.meter-state');
    var STATES = [[80, 'Cozy'], [58, 'Shifting in your seat'], [36, 'Squirming'], [14, 'Deeply uncomfortable'], [-1, "Now we're talking"]];
    var last = '';
    var tick = function () {
      var max = document.documentElement.scrollHeight - innerHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      var level = Math.round(100 - p * 97);
      fill.style.transform = 'scaleX(' + level / 100 + ')';
      meter.style.setProperty('--heat', p.toFixed(3));
      meter.classList.toggle('show', scrollY > innerHeight * 0.5);
      for (var i = 0; i < STATES.length; i++) if (level > STATES[i][0]) {
        if (STATES[i][1] !== last) { last = STATES[i][1]; state.textContent = last; meter.classList.remove('bump'); void meter.offsetWidth; meter.classList.add('bump'); }
        break;
      }
    };
    var queued = false;
    addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; tick(); }); } }, { passive: true });
    addEventListener('resize', tick);
    tick();
  }

  // ---------- wordmark: letters scatter away from the cursor ----------
  var wm = document.querySelector('.wm-big');
  if (wm && !reduce && matchMedia('(hover: hover)').matches) {
    var letters = [].slice.call(wm.querySelectorAll('.l'));
    wm.parentNode.addEventListener('pointermove', function (e) {
      letters.forEach(function (l) {
        var r = l.getBoundingClientRect();
        var dx = r.left + r.width / 2 - e.clientX, dy = r.top + r.height / 2 - e.clientY;
        var d = Math.sqrt(dx * dx + dy * dy), f = Math.max(0, 1 - d / 220);
        l.style.setProperty('--px', (dx / (d || 1) * f * 22).toFixed(1) + 'px');
        l.style.setProperty('--py', (dy / (d || 1) * f * 22).toFixed(1) + 'px');
        l.style.setProperty('--pr', (dx / (d || 1) * f * 14).toFixed(1) + 'deg');
      });
    });
    wm.parentNode.addEventListener('pointerleave', function () {
      letters.forEach(function (l) { l.style.removeProperty('--px'); l.style.removeProperty('--py'); l.style.removeProperty('--pr'); });
    });
  }

  // ---------- question form: send without leaving the page ----------
  var form = document.querySelector('.ask-form');
  if (form && window.fetch) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(new FormData(form)).toString() })
        .then(function (r) {
          if (!r.ok) throw new Error(r.status);
          [].forEach.call(form.children, function (el) { if (!el.classList.contains('ask-thanks')) el.hidden = true; });
          var t = form.querySelector('.ask-thanks'); t.hidden = false; t.focus();
          form.classList.add('sent');
        })
        .catch(function () { btn.disabled = false; form.submit(); });
    });
  }
})();
