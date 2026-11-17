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

// Episode search, shared by the page (site.js) and the tests.
// Finds episodes by number ("200", "#200", "ep 200"), by any words in the
// title or description (topics, guest names), or by a topic chip's word list.
(function (root) {
  'use strict';
  var STOP = { a: 1, an: 1, the: 1, and: 1, or: 1, of: 1, to: 1, in: 1, is: 1, it: 1, for: 1, on: 1, with: 1, about: 1, at: 1, be: 1, do: 1, we: 1, i: 1, my: 1, our: 1, are: 1, episode: 1, episodes: 1, ep: 1 };

  // lowercase, no accents, curly quotes straightened, apostrophes dropped
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[‘’'`]/g, '').replace(/[“”]/g, '"');
  }
  // like norm, but keeps every character so positions line up with the original text
  function fold(s) {
    return String(s || '').split('').map(function (ch) { var c = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return c.length === 1 ? c : ch; }).join('');
  }
  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  // a term matches at the start of a word, so "race" finds "racism" but not "grace"
  function termRe(term) { return new RegExp('(^|[^a-z0-9])' + escRe(term).replace(/ /g, '[^a-z0-9]+')); }

  function words(q) {
    return norm(q).replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/).filter(function (w) { return w && !STOP[w]; });
  }
  function number(q) {
    var m = String(q || '').trim().match(/^(?:ep(?:isode)?\.?\s*|#|no\.?\s*)?(\d{1,4})$/i);
    return m ? +m[1] : null;
  }

  function index(list) {
    return (list || []).map(function (e) { return { e: e, t: norm(e.t), s: norm(e.s) }; });
  }

  // returns { terms, results: [episode...] } best first
  function find(idx, q, opts) {
    opts = opts || {};
    var n = opts.topic ? null : number(q);
    if (n !== null) {
      return { terms: [], number: n, results: idx.filter(function (x) { return x.e.n === n; }).map(function (x) { return x.e; }) };
    }
    var any = !!opts.topic; // topic chips match ANY of their words; typed searches need ALL words
    var terms = any
      ? String(q).split(',').map(function (t) { return norm(t).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }).filter(Boolean)
      : words(q);
    if (!terms.length) return { terms: [], results: [] };
    var res = terms.map(termRe);
    var phrase = !any && terms.length > 1 ? termRe(terms.join(' ')) : null;
    var scored = [];
    idx.forEach(function (x) {
      var score = 0, hits = 0;
      for (var i = 0; i < res.length; i++) {
        var inT = res[i].test(x.t), inS = res[i].test(x.s);
        if (inT || inS) { hits++; score += (inT ? 4 : 0) + (inS ? 1 : 0); }
        else if (!any) return;
      }
      if (!hits) return;
      if (phrase && phrase.test(x.t)) score += 6;
      if (phrase && phrase.test(x.s)) score += 2;
      scored.push({ e: x.e, score: score });
    });
    scored.sort(function (a, b) { return b.score - a.score || Date.parse(b.e.d || 0) - Date.parse(a.e.d || 0); });
    return { terms: terms, results: scored.map(function (x) { return x.e; }) };
  }

  // escape, then wrap matched words in <mark>
  function mark(text, terms, esc) {
    var out = esc(text);
    if (!terms || !terms.length) return out;
    var plain = fold(out);
    var spans = [];
    terms.forEach(function (t) {
      var re = new RegExp('(^|[^a-z0-9])(' + escRe(t).replace(/ /g, '[^a-z0-9]+') + '[a-z0-9]*)', 'g'), m;
      while ((m = re.exec(plain))) { spans.push([m.index + m[1].length, m.index + m[0].length]); if (m[0].length === 0) re.lastIndex++; }
    });
    if (!spans.length) return out;
    spans.sort(function (a, b) { return a[0] - b[0]; });
    var html = '', at = 0;
    spans.forEach(function (s) {
      if (s[0] < at) return;
      // never split an HTML entity like &amp;
      if (/&[a-z#0-9]*$/i.test(out.slice(at, s[0]))) return;
      html += out.slice(at, s[0]) + '<mark>' + out.slice(s[0], s[1]) + '</mark>';
      at = s[1];
    });
    return html + out.slice(at);
  }

  // a short piece of the description, centered on the first match
  function snippet(text, terms, len) {
    len = len || 190;
    text = String(text || '');
    if (text.length <= len) return text;
    var plain = fold(text), at = -1;
    (terms || []).forEach(function (t) { var m = plain.match(termRe(t)); if (m && (at < 0 || m.index < at)) at = m.index + m[1].length; });
    if (at < len * 0.6) return text.slice(0, len).replace(/\s+\S*$/, '') + '...';
    var start = text.lastIndexOf(' ', at - 50);
    return '...' + text.slice(start + 1, start + 1 + len).replace(/\s+\S*$/, '') + '...';
  }

  var api = { norm: norm, words: words, number: number, index: index, find: find, mark: mark, snippet: snippet };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.UncomfySearch = api;
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
