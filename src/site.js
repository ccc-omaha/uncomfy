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
        cfg.yt = cfg.yt || {};
        eps.forEach(function (e) { if (e.number) cfg.yt[e.number] = e.id; });
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

  // ---------- episode search: every episode, by topic, guest, or number ----------
  var sBox = document.querySelector('[data-search]');
  var SR = window.UncomfySearch;
  if (sBox && SR && R && window.fetch) {
    sBox.hidden = false;
    var qIn = sBox.querySelector('#es-q'), clr = sBox.querySelector('.es-clear');
    var statusEl = sBox.querySelector('[data-es-status]'), list = sBox.querySelector('[data-es-results]');
    var more = sBox.querySelector('.es-more'), none = sBox.querySelector('.es-none'), totalEl = sBox.querySelector('[data-es-count]');
    var chips = [].slice.call(sBox.querySelectorAll('.es-chip'));
    var idx = null, loading = null, found = [], terms = [], shown = 0, PAGE = 10, timer = 0, lastQ = '';

    var load = function () {
      if (!loading) {
        var get = function (u) { return fetch(u).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); };
        loading = get('/api/archive').catch(function () { return get('/archive.json'); }).then(function (d) {
          var eps = (d && d.episodes) || [];
          idx = SR.index(eps);
          if (eps.length) totalEl.textContent = eps.length + ' episodes';
          return idx;
        }).catch(function () { loading = null; idx = null; throw new Error('archive'); });
      }
      return loading;
    };
    // fetch the archive as the section comes into view, so the first search is instant
    if ('IntersectionObserver' in window) {
      var pre = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { pre.disconnect(); load().catch(function () {}); } }, { rootMargin: '600px 0px' });
      pre.observe(sBox);
    } else load().catch(function () {});

    var ytSearch = function (e) { return 'https://www.youtube.com/results?search_query=' + encodeURIComponent('unCOMFORTABLE Podcast ' + (e.n || '') + ' ' + e.t); };
    var item = function (e) {
      var vid = e.v || (e.n && cfg.yt && cfg.yt[e.n]);
      return '<li class="es-item">' +
        '<div class="es-main">' +
          '<p class="es-meta">' + (e.n ? '<span class="ep-num">Ep. ' + R.esc(e.n) + '</span>' : '') + (e.d ? '<time datetime="' + R.esc(e.d) + '">' + R.esc(R.longDate(e.d)) + '</time>' : '') + '</p>' +
          '<h3 class="es-title">' + SR.mark(e.t, terms, R.esc) + '</h3>' +
          (e.s ? '<p class="es-sum">' + SR.mark(SR.snippet(e.s, terms), terms, R.esc) + '</p>' : '') +
        '</div>' +
        '<div class="es-actions">' +
          (vid ? '<button class="es-btn es-play" type="button" data-video="' + R.esc(vid) + '" data-title="' + R.esc(e.t) + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>Play</button>'
               : '<a class="es-btn" href="' + R.esc(ytSearch(e)) + '" target="_blank" rel="noopener"><svg class="i"><use href="#i-yt"/></svg>Watch</a>') +
          (/^https:\/\//.test(e.u || '') ? '<a class="es-btn alt" href="' + R.esc(e.u) + '" target="_blank" rel="noopener"><svg class="i"><use href="#i-spotify"/></svg>Listen</a>' : '') +
        '</div>' +
      '</li>';
    };
    var page = function () {
      list.insertAdjacentHTML('beforeend', found.slice(shown, shown + PAGE).map(item).join(''));
      shown = Math.min(found.length, shown + PAGE);
      more.hidden = shown >= found.length;
      more.textContent = 'Show more (' + (found.length - shown) + ' left)';
    };
    var plural = function (n) { return n + (n === 1 ? ' episode' : ' episodes'); };
    var reset = function () {
      sBox.classList.remove('searching');
      list.innerHTML = ''; statusEl.textContent = ''; more.hidden = true; none.hidden = true; clr.hidden = !qIn.value;
      if (gridEl) gridEl.hidden = false;
    };
    var setUrl = function (key, val) {
      try {
        var u = new URL(location.href);
        u.searchParams.delete('q'); u.searchParams.delete('topic');
        if (val) { u.searchParams.set(key, val); u.hash = 'episodes'; }
        history.replaceState(null, '', u.pathname + u.search + u.hash);
      } catch (e) {}
    };
    var run = function (q, chip) {
      q = String(q || '').trim();
      lastQ = chip ? '' : q;
      clr.hidden = !qIn.value;
      if (!q) { reset(); setUrl(); return; }
      statusEl.textContent = 'Searching...';
      load().then(function () {
        var r = SR.find(idx, chip ? chip.getAttribute('data-words') : q, { topic: !!chip });
        found = r.results; terms = r.terms; shown = 0; list.innerHTML = '';
        sBox.classList.add('searching');
        if (gridEl) gridEl.hidden = true;
        if (r.number !== undefined && r.number !== null) statusEl.textContent = found.length ? 'Episode ' + r.number : 'No episode ' + r.number + ' yet.';
        else if (chip) statusEl.textContent = plural(found.length) + ' on ' + chip.textContent;
        else statusEl.textContent = found.length ? plural(found.length) + ' matching “' + q + '”' : 'Nothing matches “' + q + '”.';
        none.hidden = !!found.length || !!chip;
        page();
        setUrl(chip ? 'topic' : 'q', chip ? chip.textContent : q);
      }).catch(function () {
        statusEl.innerHTML = 'Search is taking a break. <a href="' + '/youtube' + '" target="_blank" rel="noopener">Browse every episode on YouTube</a>.';
      });
    };
    var unchip = function () { chips.forEach(function (c) { c.setAttribute('aria-pressed', 'false'); }); };

    qIn.addEventListener('input', function () {
      unchip();
      clearTimeout(timer);
      timer = setTimeout(function () { run(qIn.value); }, 180);
    });
    qIn.addEventListener('focus', function () { load().catch(function () {}); });
    qIn.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { qIn.value = ''; unchip(); run(''); }
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(timer); run(qIn.value); }
    });
    clr.addEventListener('click', function () { qIn.value = ''; unchip(); run(''); qIn.focus(); });
    more.addEventListener('click', page);
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var on = c.getAttribute('aria-pressed') !== 'true';
        unchip(); qIn.value = ''; clr.hidden = true;
        if (on) { c.setAttribute('aria-pressed', 'true'); run(c.textContent, c); } else run('');
      });
    });
    // "Suggest it as a topic": carry the search into the question form
    var sug = sBox.querySelector('[data-suggest]');
    if (sug) sug.addEventListener('click', function () {
      var ta = document.querySelector('.ask-form textarea[name=question]');
      if (ta && !ta.value.trim() && lastQ) ta.value = 'Could you do an episode on ' + lastQ + '?';
      if (ta) setTimeout(function () { ta.focus({ preventScroll: true }); }, 600);
    });

    // shared links like uncomfy.org/?q=grief#episodes open with the search already run
    try {
      var params = new URL(location.href).searchParams, pq = params.get('q'), pt = params.get('topic');
      var pc = pt && chips.filter(function (c) { return c.textContent.toLowerCase() === pt.toLowerCase(); })[0];
      if (pc) { pc.setAttribute('aria-pressed', 'true'); run(pc.textContent, pc); }
      else if (pq) { qIn.value = pq; run(pq); }
    } catch (e) {}
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
