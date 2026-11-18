// Builds uncomfy.org from src/template.html + content/*.json.
// Staff edit content/*.json in Pages CMS. Netlify runs `node build.js` on every deploy.
// Never hand-edit the generated index.html; edit src/ or content/ and rebuild.
//
// Episodes come from the YouTube playlist, not from staff. The build bakes in the
// newest list, and the page checks /api/episodes on every visit, so a new upload
// appears at the top of the site within minutes without anyone touching it.
'use strict';
const fs = require('fs');
const path = require('path');
const R = require('./lib/render.js');
const EP = require('./lib/episodes.js');
const AR = require('./lib/archive.js');

const ROOT = __dirname;
const SITE_URL = 'https://uncomfy.org/';
const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f + '.json'), 'utf8'));
const c = Object.fromEntries(['site', 'hero', 'latest', 'questions', 'mission', 'directions', 'episodes', 'hosts', 'ask', 'listen'].map(k => [k, read(k)]));
const S = c.site;

// ---------- text helpers ----------
const esc = R.esc;
// keep the last two words together so nothing ends on one orphaned word,
// unless that pair is too long to fit a narrow column (then let it wrap normally)
const tie = s => String(s).replace(/(\S+) ([^\s<>]{1,14}(?:<\/[a-z]+>)*)$/, (m, a, b) => (a + b).replace(/<[^>]+>/g, '').length <= 18 ? `${a}&nbsp;${b}` : m);
const inline = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/\[(.+?)\]\(((?:https?:\/\/|mailto:|\/|#)[^\s)]*)\)/g, (m, t, u) => `<a href="${u}"${/^https?:/.test(u) ? ' target="_blank" rel="noopener"' : ''}>${t}</a>`);
const fmt = s => tie(inline(s));
const COLORS = { Aqua: 'aqua', Blue: 'blue', Orange: 'orange', Magenta: 'magenta', Purple: 'purple', Pink: 'pink', Mint: 'mint', Cream: 'cream', Navy: 'navy' };
const color = n => 'c-' + (COLORS[n] || 'aqua');

// ---------- episodes ----------
async function getEpisodes() {
  const cache = path.join(ROOT, 'data/episodes.json');
  const id = EP.playlistId(S.youtube);
  try {
    const list = await EP.fetchEpisodes(id, { timeout: 10000 });
    fs.writeFileSync(cache, JSON.stringify({ checked: new Date().toISOString(), episodes: list.slice(0, 15) }, null, 2) + '\n');
    console.log(`episodes: ${list.length} from YouTube, newest "${list[0].title}"`);
    return list;
  } catch (e) {
    const saved = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')).episodes || [] : [];
    console.log(`episodes: YouTube unavailable (${e.message}), using ${saved.length} saved`);
    return saved;
  }
}

// every episode for the search box, from the podcast RSS feed (YouTube's feed only has the newest 15)
async function getArchive(eps) {
  const cache = path.join(ROOT, 'data/archive.json');
  let list = [];
  try {
    list = await AR.fetchArchive(S.podcastFeed, { timeout: 15000 });
    fs.writeFileSync(cache, JSON.stringify({ checked: new Date().toISOString(), episodes: list }) + '\n');
    console.log(`archive: ${list.length} episodes from the podcast feed`);
  } catch (e) {
    list = fs.existsSync(cache) ? JSON.parse(fs.readFileSync(cache, 'utf8')).episodes || [] : [];
    console.log(`archive: podcast feed unavailable (${e.message}), using ${list.length} saved`);
  }
  const videos = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/youtube-videos.json'), 'utf8'));
  const recent = { byNumber: Object.fromEntries((eps || []).filter(e => e.number).map(e => [e.number, e.id])) };
  list = AR.attachVideos(list, [videos, recent]);
  console.log(`archive: ${list.filter(e => e.v).length} of ${list.length} linked to their YouTube video`);
  // public copy the page falls back to if /api/archive is ever down
  fs.writeFileSync(path.join(ROOT, 'archive.json'), JSON.stringify({ checked: new Date().toISOString(), episodes: list }));
  return list;
}

// ---------- pieces ----------
const PLATFORMS = [['youtube', 'YouTube', 'yt'], ['spotify', 'Spotify', 'spotify'], ['apple', 'Apple Podcasts', 'apple']];
const listenButtons = PLATFORMS.filter(([k]) => S[k]).map(([k, label, ic]) =>
  `<a class="pill p-${k}" href="${esc(S[k])}" target="_blank" rel="noopener"><svg class="i"><use href="#i-${ic}"/></svg><span>${label}</span></a>`).join('');
// voicemail number as a tap-to-call link (calculated, never typed twice)
const tel = p => 'tel:+1' + String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const reviewLinks = [['apple', 'Apple Podcasts'], ['spotify', 'Spotify']].filter(([k]) => S[k]).map(([k, label]) => `<a href="${esc(S[k])}" target="_blank" rel="noopener">${label}</a>`).join('');
const listenBig = PLATFORMS.filter(([k]) => S[k]).map(([k, label, ic]) =>
  `<a class="plat p-${k}" href="${esc(S[k])}" target="_blank" rel="noopener"><svg class="i"><use href="#i-${ic}"/></svg><span><small>Listen on</small>${label}</span><svg class="i go"><use href="#i-arrow"/></svg></a>`).join('');

// each letter of COMFORTABLE squirms on its own
const wordmarkLetters = 'COMFORTABLE'.split('').map((ch, i) => {
  const r = (((i * 37) % 11) - 5) * 0.9;           // fixed, so the build is repeatable
  const y = (((i * 53) % 7) - 3) * 0.6;
  return `<span class="l" style="--i:${i};--r:${r.toFixed(1)}deg;--y:${y.toFixed(1)}px">${ch}</span>`;
}).join('');

const qs = (c.questions.questions || []).filter(Boolean);
const tickerSet = qs.map(q => `<span>${esc(q)}</span><i aria-hidden="true">&#10038;</i>`).join('');
const ticker = `<div class="tk" >${tickerSet}</div><div class="tk" aria-hidden="true">${tickerSet}</div>`;

const directionCards = (c.directions.cards || []).map((x, i) => `
      <article class="dir ${color(x.color)} reveal" style="--d:${i * 120}ms">
        <p class="dir-kicker">${esc(x.kicker)}</p>
        <h3>${tie(esc(x.title))}</h3>
        <p>${fmt(x.text)}</p>
      </article>`).join('');

const H = c.hosts;
const SPOT = { Left: [14, 66], Middle: [50, 64], Right: [86, 64] };
const pic = (p, alt, w, h) => {
  const s = '/' + String(p || '').replace(/^\//, '');
  const webp = s.replace(/\.(jpe?g|png)$/i, '.webp');
  const has = webp !== s && fs.existsSync(path.join(ROOT, webp));
  return `<picture>${has ? `<source type="image/webp" srcset="${esc(webp)}">` : ''}<img src="${esc(s)}" alt="${esc(alt)}" width="${w}" height="${h}" loading="lazy" decoding="async"></picture>`;
};
const hostList = (H.hosts || []).filter(h => h.name);
// name stickers on the photo; a host with a bio gets a speech bubble that pops on hover or tap
const slug = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const hostTags = hostList.map((h, i) => {
  const [x, y] = SPOT[h.spot] || SPOT.Middle;
  const face = `<small>Hello, I'm</small><b>${esc(h.name)}</b>${h.role ? `<em>${esc(h.role)}</em>` : ''}`;
  const id = 'bio-' + slug(h.name);
  const sticker = h.bio
    ? `<button class="tag-btn" type="button" aria-expanded="false" aria-controls="${id}" aria-label="${esc(h.name)}: show bio">${face}</button><span class="bubble ${color(h.color)}" id="${id}" role="note"><span class="bubble-name">${esc(h.name)}</span><span class="bubble-text">${fmt(h.bio)}</span></span>`
    : `<span class="tag-btn">${face}</span>`;
  return `<span class="tag ${color(h.color)} at-${slug(h.spot || 'Middle')}${h.bio ? ' has-bio' : ''}" style="--x:${x}%;--y:${y}%;--d:${300 + i * 180}ms;--t:${[-6, 4, -3][i % 3]}deg">${sticker}</span>`;
}).join('');
const hasBios = hostList.some(h => h.bio);
const studio = H.photo ? `<figure class="studio reveal">${pic(H.photo, H.photoAlt, 1600, 896)}${hostTags}</figure>` : '';
// phones: the photo is too small for bubbles, so the tapped bio opens in this card under it
const hostCards = studio + (hasBios ? `<div class="bio-pop" aria-live="polite" hidden></div>${H.hint ? `<p class="host-hint"><span aria-hidden="true">&#9758;</span> ${esc(H.hint)}</p>` : ''}` : '');

// the show's spiral mark, one path per ring so each ring can turn on its own
const RINGS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/mark.json'), 'utf8'));
const mark = cls => `<svg class="${cls}" viewBox="${-RINGS.r} ${-RINGS.r} ${RINGS.r * 2} ${RINGS.r * 2}" aria-hidden="true">${RINGS.paths.map((d, i) => `<path class="ring r${i}" d="${d}"/>`).join('')}</svg>`;
// the words that circle the sticker; textLength in the template spaces them evenly around the ring
const loop = (s, n) => Array(n).fill(esc(s).toUpperCase()).join(' &#10038; ') + ' &#10038;&#160;';
const bigMarquee = Array(2).fill(`<span>Get uncomfortable</span><i>&#10038;</i><span>Faith worth questioning</span><i>&#10038;</i><span>Conversations worth having</span><i>&#10038;</i>`).join('');

// ---------- render ----------
(async () => {
  const eps = await getEpisodes();
  await getArchive(eps);
  const now = new Date().toISOString();
  const L = c.latest;
  const youtube = esc(S.youtube);
  const fallbackLatest = `<div class="latest-card empty"><p class="latest-label"><span class="pulse" aria-hidden="true"></span>${esc(L.label)}</p><h2 class="latest-title"><a href="${youtube}" target="_blank" rel="noopener">Watch the newest episode on&nbsp;YouTube</a></h2></div>`;

  const schema = {
    '@context': 'https://schema.org', '@type': 'PodcastSeries',
    name: S.showName, alternateName: `${S.showName}: ${S.subtitle}`, url: SITE_URL,
    description: S.seoDescription, image: SITE_URL + 'images/cover-art.jpg',
    publisher: { '@type': 'Organization', name: S.churchName, url: S.churchUrl },
    sameAs: [S.youtube, S.spotify, S.apple].filter(Boolean)
  };
  if (eps[0]) schema.episode = eps.slice(0, 5).map(e => ({ '@type': 'PodcastEpisode', name: e.title, url: e.url, datePublished: e.published, ...(e.number ? { episodeNumber: e.number } : {}) }));

  const config = {
    playlist: EP.playlistId(S.youtube),
    labels: { label: L.label, newLabel: L.newLabel, newDays: +L.newDays || 7, playLabel: L.playLabel },
    countText: L.countText,
    count: +c.episodes.count || 6,
    newest: eps[0] ? eps[0].id : '',
    // episode number -> YouTube video, so search results for recent episodes play right on the page
    yt: Object.fromEntries(eps.filter(e => e.number).map(e => [e.number, e.id]))
  };
  const E = c.episodes;
  const topicChips = (E.topics || []).filter(t => t && t.label).map(t =>
    `<button class="es-chip" type="button" data-words="${esc(t.words || t.label)}" aria-pressed="false">${esc(t.label)}</button>`).join('');

  const vars = {
    title: esc(S.seoTitle), description: esc(S.seoDescription), url: SITE_URL, showName: esc(S.showName),
    subtitle: tie(esc(S.subtitle)), youtube, churchUrl: esc(S.churchUrl), churchName: esc(S.churchName), instagram: esc(S.instagram),
    tiktok: esc(S.tiktok), handle: esc(S.handle), voicemail: esc(S.voicemail), telHref: tel(S.voicemail), reviewLinks,
    footerText: fmt(S.footerText),
    'hero.eyebrow': esc(c.hero.eyebrow), 'hero.tagline': fmt(c.hero.tagline), 'hero.intro': fmt(c.hero.intro), 'hero.listenLabel': esc(c.hero.listenLabel),
    stickerLoop: loop(c.hero.stickerText, 2),
    wordmarkLetters, listenButtons, listenBig, markSmall: mark('mk'), markNeon: mark('mk-neon'),
    count: R.count(eps, L.countText),
    latest: eps[0] ? R.latest(eps[0], config.labels, now) : fallbackLatest,
    ticker,
    'mission.eyebrow': esc(c.mission.eyebrow), 'mission.statement': fmt(c.mission.statement), 'mission.text': fmt(c.mission.text),
    'directions.eyebrow': esc(c.directions.eyebrow), 'directions.heading': fmt(c.directions.heading), 'directions.text': fmt(c.directions.text), directionCards,
    'episodes.eyebrow': esc(c.episodes.eyebrow), 'episodes.heading': fmt(c.episodes.heading), 'episodes.text': fmt(c.episodes.text), 'episodes.buttonLabel': esc(c.episodes.buttonLabel), 'episodes.count': esc(config.count),
    grid: R.grid(eps, config.count),
    'episodes.searchLabel': esc(E.searchLabel), 'episodes.searchPlaceholder': esc(E.searchPlaceholder), 'episodes.topicsLabel': esc(E.topicsLabel),
    'episodes.noResults': fmt(E.noResults), 'episodes.suggestLabel': esc(E.suggestLabel), topicChips,
    'hosts.eyebrow': esc(c.hosts.eyebrow), 'hosts.heading': fmt(c.hosts.heading), 'hosts.text': fmt(c.hosts.text), hostCards,
    'listen.heading': fmt(c.listen.heading), 'listen.text': fmt(c.listen.text), bigMarquee,
    'listen.voicemailKicker': esc(c.listen.voicemailKicker), 'listen.voicemailText': fmt(c.listen.voicemailText), 'listen.followKicker': esc(c.listen.followKicker), 'listen.followText': fmt(c.listen.followText), 'listen.reviewKicker': esc(c.listen.reviewKicker), 'listen.reviewText': fmt(c.listen.reviewText),
    schema: `<script type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`,
    config: JSON.stringify(config).replace(/</g, '\\u003c'),
    version: Date.now().toString(36)
  };
  for (const k of Object.keys(c.ask)) vars['ask.' + k] = /Heading|heading$/.test(k) ? tie(esc(c.ask[k])) : (/Text$|^text$|Note$/.test(k) ? fmt(c.ask[k]) : esc(c.ask[k]));

  const tpl = fs.readFileSync(path.join(ROOT, 'src/template.html'), 'utf8');
  const out = tpl.replace(/\{\{([\w.]+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error('template uses {{' + k + '}} but build.js has no value for it');
    return vars[k];
  });
  fs.writeFileSync(path.join(ROOT, 'index.html'), out);

  // thank-you page for the question form when JavaScript is off
  fs.mkdirSync(path.join(ROOT, 'thanks'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'thanks/index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Thank you | ${esc(S.showName)}</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="https://use.typekit.net/ohw6ayv.css"><link rel="stylesheet" href="https://use.typekit.net/dyw0udq.css"><link rel="stylesheet" href="/styles.css?v=${vars.version}"></head><body class="thanks-page"><main class="wrap"><a class="brand" href="/"><span class="un">un</span>COMFORTABLE</a><h1>${tie(esc(c.ask.thanksHeading))}</h1><p>${fmt(c.ask.thanksText)}</p><a class="btn" href="/">Back to the podcast</a></main></body></html>\n`);

  // front-end script = shared episode renderer + episode search + page behavior
  fs.writeFileSync(path.join(ROOT, 'site.js'), ['lib/render.js', 'lib/search.js', 'src/site.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n'));
  fs.copyFileSync(path.join(ROOT, 'src/styles.css'), path.join(ROOT, 'styles.css'));
  console.log('built index.html');
})().catch(e => { console.error(e); process.exit(1); });
