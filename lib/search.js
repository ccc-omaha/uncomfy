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
