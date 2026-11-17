// node test/search-check.js : checks the archive parser and search against a sample feed
'use strict';
const assert = require('assert');
const fs = require('fs');
const A = require('../lib/archive.js');
const S = require('../lib/search.js');
const R = require('../lib/render.js');

const list = A.parse(fs.readFileSync(__dirname + '/podcast-feed.xml', 'utf8'));
assert.strictEqual(list.length, 5);
assert.deepStrictEqual([list[0].n, list[0].t], [322, "When God Doesn't Heal: Losing My Wife to Cancer"]);
assert.ok(!/DISCLAIMER/i.test(list[0].s) && /God's goodness/.test(list[0].s), 'disclaimer stripped, entities decoded');
assert.strictEqual(list.find(e => /Asbury/.test(e.t)).n, null);
assert.strictEqual(list.find(e => e.n === 14).t, 'What Is My Calling');
assert.ok(/Asbury & what/.test(list.find(e => /Asbury/.test(e.t)).s));

const idx = S.index(list);
const nums = q => S.find(idx, q).results.map(e => e.n);
assert.deepStrictEqual(nums('14'), [14]);
assert.deepStrictEqual(nums('#322'), [322]);
assert.deepStrictEqual(nums('ep 7'), [7]);
assert.deepStrictEqual(nums('episode 007'), [7]);
assert.deepStrictEqual(nums('999'), []);
assert.deepStrictEqual(nums('preston sprinkle'), [318], 'guest in title');
assert.deepStrictEqual(nums('caleb'), [322], 'guest in description');
assert.deepStrictEqual(nums('grief cancer'), [322], 'all words');
assert.deepStrictEqual(nums('grief alcohol'), [], 'all words must match');
assert.deepStrictEqual(nums('doesnt heal'), [322], 'apostrophes ignored');
assert.deepStrictEqual(nums('cafe'), [7], 'accents ignored');
assert.deepStrictEqual(nums('race'), [7], 'word start: race matches race/racism, not grace');
const topic = S.find(idx, 'sexuality, gender, alcohol', { topic: true }).results.map(e => e.n);
assert.deepStrictEqual(topic.sort(), [318, 7].sort(), 'topic chips match any word');

const t = S.find(idx, 'god heal');
assert.strictEqual(S.mark(list[0].t, t.terms, R.esc), "When <mark>God</mark> Doesn't <mark>Heal</mark>: Losing My Wife to Cancer");
assert.strictEqual(S.mark('Asbury & what', ['what'], R.esc), 'Asbury &amp; <mark>what</mark>');
assert.ok(S.snippet('x '.repeat(200) + 'grief here', ['grief']).includes('grief'));
console.log('search checks passed');
