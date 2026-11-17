// Shared by build.js and the /api/episodes function.
// Reads the public YouTube RSS feed for the podcast playlist and turns it into
// a clean list of episodes, newest first. No API key needed.
'use strict';

const FEED = id => `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(id)}`;
const PLAYLIST_RE = /^[A-Za-z0-9_-]{10,64}$/;

// Pull the playlist ID out of a pasted link like
// https://www.youtube.com/playlist?list=PLzdVE7HNsqM9KTuzDL7BvpGlliUYfjM4-
function playlistId(link) {
  const s = String(link || '').trim();
  const m = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
  const id = m ? m[1] : s;
  return PLAYLIST_RE.test(id) ? id : '';
}

const decode = s => String(s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
  .replace(/&amp;/g, '&');
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]).trim() : ''; };

// "unCOMFORTABLE Podcast | 318: When Scripture Changes Your Mind" -> { number: 318, title: "When Scripture Changes Your Mind" }
function cleanTitle(raw) {
  let t = String(raw || '').trim();
  let number = null;
  // "Title — unCOMFORTABLE Podcast 322" (the channel's current format)
  const suffix = t.match(/\s*[|\-–—:]\s*un\s*comfortable(?:\s+podcast)?(?:\s*(?:ep(?:isode)?\.?\s*)?#?(\d{1,4}))?\s*$/i);
  if (suffix) { if (suffix[1]) number = +suffix[1]; t = t.slice(0, suffix.index); }
  // drop the show name at the start too
  t = t
       .replace(/^un\s*comfortable(\s+podcast)?\s*[|\-–—:]\s*/i, '');
  const lead = t.match(/^(?:ep(?:isode)?\.?\s*)?#?(\d{1,4})\s*[:.|\-–—]\s*/i);
  if (lead) { number = +lead[1]; t = t.slice(lead[0].length); }
  const tail = t.match(/\s*[|\-–—(]\s*(?:ep(?:isode)?\.?\s*)#?(\d{1,4})\)?\s*$/i);
  if (number === null && tail) { number = +tail[1]; t = t.slice(0, tail.index); }
  return { number, title: t.replace(/\s+/g, ' ').trim() || String(raw || '').trim() };
}

function parse(xml) {
  const entries = xml.split('<entry>').slice(1).map(chunk => {
    const id = tag(chunk, 'yt:videoId');
    const raw = tag(chunk, 'title');
    const { number, title } = cleanTitle(raw);
    const desc = tag(chunk, 'media:description');
    return {
      id,
      number,
      title,
      published: tag(chunk, 'published'),
      summary: desc.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').slice(0, 280),
      url: `https://www.youtube.com/watch?v=${id}`,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      thumbHd: `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
    };
  }).filter(e => e.id && !/^(private|deleted) video$/i.test(e.title));
  // playlists can be ordered any way, so always sort by upload date
  entries.sort((a, b) => Date.parse(b.published) - Date.parse(a.published));
  return entries;
}

async function fetchEpisodes(id, { timeout = 8000 } = {}) {
  if (!PLAYLIST_RE.test(id || '')) throw new Error('bad playlist id');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(FEED(id), { signal: ctrl.signal, headers: { 'user-agent': 'uncomfy.org episode check' } });
    if (!res.ok) throw new Error('feed ' + res.status);
    const list = parse(await res.text());
    if (!list.length) throw new Error('empty feed');
    return list;
  } finally { clearTimeout(timer); }
}

module.exports = { playlistId, cleanTitle, parse, fetchEpisodes };
