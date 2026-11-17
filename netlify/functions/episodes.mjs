// GET /api/episodes
// Returns the podcast's newest episodes from the YouTube playlist, newest first.
// The page calls this on every visit, so a new upload shows at the top of
// uncomfy.org within a few minutes of hitting the playlist, no redeploy needed.
// Netlify's CDN caches the answer for 5 minutes. If YouTube is slow or down,
// the last good list (kept in Netlify Blobs) is served instead.
import { getStore } from '@netlify/blobs';
import lib from '../../lib/episodes.js';

const DEFAULT_LIST = 'PLzdVE7HNsqM9KTuzDL7BvpGlliUYfjM4-';

const reply = (body, cdnSeconds) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=60',
    'netlify-cdn-cache-control': `public, durable, s-maxage=${cdnSeconds}, stale-while-revalidate=86400`,
    'access-control-allow-origin': '*'
  }
});

export default async (req) => {
  const url = new URL(req.url);
  const id = lib.playlistId(url.searchParams.get('list')) || DEFAULT_LIST;
  let store = null;
  try { store = getStore('uncomfy-episodes'); } catch { /* Blobs unavailable locally */ }

  try {
    const episodes = (await lib.fetchEpisodes(id)).slice(0, 15);
    const body = { checked: new Date().toISOString(), source: 'youtube', episodes };
    if (store) await store.setJSON(id, body).catch(() => {});
    return reply(body, 300);
  } catch (err) {
    const last = store ? await store.get(id, { type: 'json' }).catch(() => null) : null;
    if (last) return reply({ ...last, source: 'saved' }, 60);
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
};

export const config = { path: '/api/episodes' };
