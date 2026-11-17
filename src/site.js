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
