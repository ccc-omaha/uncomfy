# uncomfy.org

Site for **unCOMFORTABLE: Conversations About Culture & Christianity**, the podcast from Christ Community Church in Omaha.

- **Edit:** staff edit copy, the questions strip, the hosts photo, and links in [Pages CMS](https://app.pagescms.org). Every field says where it shows up on the page.
- **Episodes run themselves.** The newest episode, the episode cards, and the episode count come from the YouTube playlist. `netlify/functions/episodes.mjs` (`/api/episodes`) reads the playlist's public feed, and the page checks it on every visit, so a new upload shows at the top within about five minutes. No redeploy, no editing. The last good list is kept in Netlify Blobs in case YouTube hiccups.
- **Episode search** covers every episode, not just the newest 15. `netlify/functions/archive.mjs` (`/api/archive`) reads the podcast RSS feed (`podcastFeed` in `content/site.json`), cached for an hour, with Netlify Blobs and the deploy-time `/archive.json` as fallbacks. Search matches episode numbers, title and description words (topics, guest names), and the topic buttons staff edit in Pages CMS. Links like `uncomfy.org/?q=grief` or `?topic=Politics` open with the search already run. `node test/search-check.js` checks the parser and search.
- **Build:** `node build.js` renders `index.html` from `src/template.html` + `content/*.json`, bakes in the current episodes, and writes `site.js` and `styles.css`. Netlify runs it on every deploy. Don't hand-edit the generated files.
- **Question form:** Netlify Forms (`question`). `netlify/functions/submission-created.mjs` emails each question to podcast@cccomaha.org in a branded layout through CCC's Resend account. Needs `RESEND_API_KEY` in Netlify environment variables (optional: `UNCOMFY_NOTIFY_TO`, `UNCOMFY_FROM_EMAIL`). Every question is also kept under Forms in Netlify.
- **Short links:** `/youtube`, `/spotify`, `/apple`, `/ask` (see `netlify.toml`).
- **Brand:** Proxima Nova and Quincy CF via CCC's Adobe Fonts kits. Current CCC brand colors only: Navy, Cream, Blue, Purple, Magenta, Orange, Light Pink, Mint, Aqua. The spiral mark in `images/` and `src/mark.json` was traced from the show's screen logo.
