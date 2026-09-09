import { allPaths } from './ia.ts';
import map from './legacy-guide-redirects.json' with { type: 'json' };
import { versionsWithNotes } from './release-notes.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

/**
 * The legacy `/guide/*` redirect map, checked against the real IA (TI-39).
 *
 * This file is the whole reason `legacy-guide-redirects.json` has no generator.
 * The old corpus is frozen and `tidev/titanium-docs` is being archived (TI-52),
 * so nothing regenerates the map; what it needs instead is something that fails
 * when the *new* tree moves underneath it. Rename a page in `ia.ts` and 10
 * redirects start pointing at a 404 - silently, because a redirect to a missing
 * page still returns a 308 and only the second request 404s.
 *
 * The audit is the URL inventory, verified 1:1 against the checkout when the map
 * was built: 336 pages, 265 serving `.html` and 71 serving a directory URL.
 */

const audit = JSON.parse(readFileSync('docs/legacy-guide-audit.json', 'utf8')).pages as {
  path: string;
  url: string;
}[];

/**
 * Real routes outside the guide tree.
 *
 * `/contribute` (TI-76) takes the Contributing wiki, which the approved IA
 * deliberately gives no home under `/docs`; `/downloads` (TI-40) takes the
 * continuous-builds page. Both are pages rather than sections, so `allPaths()`
 * does not know them.
 */
const EXTERNAL = ['/contribute', '/downloads'];

const routable = new Set([
  ...allPaths(),
  ...versionsWithNotes().map((version) => `/docs/sdk/${version}/release-notes`),
  ...EXTERNAL,
]);

describe('legacy guide redirects', () => {
  test('every destination resolves to a page this site serves', () => {
    for (const { source, destination } of map.rules) {
      assert.equal(routable.has(destination), true, `${source} -> ${destination} does not resolve`);
    }
  });

  // The one-hop criterion. A destination that is also a source chains, and the
  // symptom in production is a slow redirect nobody measures.
  test('no destination is itself a redirect source', () => {
    const sources = new Set(map.rules.map((rule) => rule.source));
    for (const { source, destination } of map.rules) {
      assert.equal(sources.has(destination), false, `${source} -> ${destination} chains`);
    }
  });

  test('every audited legacy URL is either redirected or deliberately dropped', () => {
    const covered = new Set([...map.rules.map((r) => r.source), ...map.notFound]);
    for (const page of audit) {
      const url = page.url.replace(/\/$/, '');
      assert.equal(covered.has(url), true, `${page.url} is in neither rules nor notFound`);
    }
  });

  /**
   * The 404s are a decision, not an oversight: RC builds, Alloy's own notes and
   * the section indexes never earned a page and are not getting one. Pinning the
   * shape here stops a future edit from quietly dropping a GA note into the same
   * bucket, which would break a URL that release announcements still link to.
   */
  test('only release notes without a page are dropped', () => {
    for (const url of map.notFound) {
      assert.match(url, /Release_Note/i, `${url} is not a release note`);
      assert.doesNotMatch(url, /\d+\.\d+\.\d+[._]GA_Release_Note/, `${url} is a GA note`);
    }
    assert.equal(map.notFound.length, 35);
  });

  test('every GA release note reaches its built page', () => {
    const ga = audit.filter((p) => /\d+\.\d+\.\d+[._]GA_Release_Note\.md$/.test(p.path));
    const bySource = new Map(map.rules.map((r) => [r.source, r.destination]));
    assert.equal(ga.length, versionsWithNotes().length, 'GA notes and built pages disagree');
    for (const page of ga) {
      const version = page.path.match(/(\d+\.\d+\.\d+)[._]GA_Release_Note\.md$/)![1];
      assert.equal(bySource.get(page.url), `/docs/sdk/${version}/release-notes`);
    }
  });

  /**
   * VuePress served `README.md` at a directory URL, so 71 of these pages are
   * indexed with a trailing slash - and a source spelled that way is dead code.
   *
   * Next normalises the slash off in a 308 of its own before either redirects or
   * middleware get to look, so only the bare form can ever match; its compiled
   * regex ends `(?:/)?$` and covers both spellings regardless. Measured on
   * 16.3.4: `skipTrailingSlashRedirect` does not change this - it survives in
   * the config schema but nothing in the server runtime reads it - so those 71
   * URLs cost two hops and there is no supported hook to make it one.
   */
  test('no source carries a trailing slash', () => {
    for (const { source } of map.rules) {
      assert.doesNotMatch(source, /.\/$/, `${source} can never match`);
    }
  });
});
