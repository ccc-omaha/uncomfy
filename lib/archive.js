// The full back catalog for episode search.
// YouTube's public feed only lists the newest 15 videos, so search reads the
// podcast's own RSS feed (Spotify for Creators / Anchor), which has every
// episode back to 001 with its title, date, and description. No API key needed.
// Shared by build.js (bakes /archive.json at deploy) and /api/archive (live).
'use strict';

const decode = s => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&#(\d+);/g, (m, n) => String.fromCodePoint(+n)).replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]).trim() : ''; };

// "322 — When God Doesn't Heal" / "014 - What Is My Calling" -> { number, title }
function splitTitle(raw) {
  const t = String(raw || '').replace(/\s+/g, ' ').trim();
  const m = t.match(/^(?:ep(?:isode)?\.?\s*)?#?(\d{1,4})\s*[—–\-:|.]+\s*/i);
  return m ? { number: +m[1], title: t.slice(m[0].length).trim() || t } : { number: null, title: t };
}

// description HTML -> plain text, minus the standard legal disclaimer
function cleanDescription(html) {
  const paras = decode(html)
    .split(/<\/p>|<br\s*\/?>|\n\s*\n/i)
    .map(p => decode(p.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
    .filter(p => p && !/^disclaimer\b/i.test(p) && !/do not necessarily reflect the official position/i.test(p));
  const text = paras.join(' ');
  return text.length > 600 ? text.slice(0, 600).replace(/\s+\S*$/, '') + '...' : text;
}

function parse(xml) {
  const list = String(xml || '').split('<item>').slice(1).map(chunk => {
    const { number, title } = splitTitle(tag(chunk, 'title'));
    const date = new Date(tag(chunk, 'pubDate'));
    return {
      n: number,
      t: title,
      d: isNaN(date) ? '' : date.toISOString(),
      s: cleanDescription(tag(chunk, 'description') || tag(chunk, 'itunes:summary')),
      u: tag(chunk, 'link')
    };
  }).filter(e => e.t);
  list.sort((a, b) => Date.parse(b.d || 0) - Date.parse(a.d || 0));
  return list;
}

async function fetchArchive(feed, { timeout = 10000 } = {}) {
  if (!/^https:\/\//.test(feed || '')) throw new Error('no feed link');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(feed, { signal: ctrl.signal, headers: { 'user-agent': 'uncomfy.org episode search' } });
    if (!res.ok) throw new Error('feed ' + res.status);
    const list = parse(await res.text());
    if (list.length < 5) throw new Error('feed looks empty');
    return list;
  } finally { clearTimeout(timer); }
}

module.exports = { splitTitle, cleanDescription, parse, fetchArchive };
