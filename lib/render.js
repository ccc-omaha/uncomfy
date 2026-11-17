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
