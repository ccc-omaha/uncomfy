// GET /api/archive
// Every episode (number, title, date, description, listen link) for the
// search box, read from the podcast's RSS feed. Netlify's CDN caches it for an
// hour, so a new episode is searchable within the hour, no redeploy needed.
// If the feed is down, the last good copy (Netlify Blobs) is served, and if
// even that fails the page falls back to /archive.json from the last deploy.
import { getStore } from '@netlify/blobs';
import lib from '../../lib/archive.js';
import site from '../../content/site.json';

const reply = (body, cdnSeconds) => new Response(JSON.stringify(body), {
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300',
    'netlify-cdn-cache-control': `public, durable, s-maxage=${cdnSeconds}, stale-while-revalidate=86400`
  }
});

export default async () => {
  let store = null;
  try { store = getStore('uncomfy-archive'); } catch { /* Blobs unavailable locally */ }
  try {
    const episodes = await lib.fetchArchive(site.podcastFeed);
    const body = { checked: new Date().toISOString(), episodes };
    if (store) await store.setJSON('all', body).catch(() => {});
    return reply(body, 3600);
  } catch (err) {
    const last = store ? await store.get('all', { type: 'json' }).catch(() => null) : null;
    if (last) return reply(last, 300);
    return new Response(JSON.stringify({ error: 'unavailable' }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  }
};

export const config = { path: '/api/archive' };
