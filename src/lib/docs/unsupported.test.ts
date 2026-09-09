import { listModules } from '../registry-api/v1.ts';
import { UnsupportedListSchema } from '../registry/index.ts';
import { SITE_URL } from '../site.ts';
import { sitemapEntries } from '../sitemap.ts';
import { markdownFor } from './llms.ts';
import { listedModuleIds, moduleAliases, moduleIds, moduleSummaries } from './modules.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

/**
 * The delisting invariants, over the real registry rather than a fixture.
 *
 * Every failure this guards against is silent. A module that should be gone
 * from the site and is not looks exactly like a module nobody delisted, and a
 * module dropped from `/registry/v1` as well breaks `ti module install` for
 * apps that already depend on it - without any page 404ing to say so.
 *
 * See `docs/module-curation.md`. The list itself is
 * `registry/modules/unsupported.json`.
 */

const list = UnsupportedListSchema.parse(
  JSON.parse(readFileSync('registry/modules/unsupported.json', 'utf8'))
);
const delisted = list.modules.map((m) => m.moduleId);

describe('unsupported modules', () => {
  // A typo delists nothing and reports nothing, which is the worst of both:
  // the module stays on the site and the entry looks like it did its job.
  test('every entry names a module that exists', () => {
    const onDisk = new Set(moduleIds());
    for (const id of delisted) {
      assert.equal(onDisk.has(id), true, `${id} is in unsupported.json but not in the registry`);
    }
  });

  test('is a set, and every entry is explained', () => {
    assert.equal(new Set(delisted).size, delisted.length);
    for (const entry of list.modules) {
      assert.equal(entry.reason.trim().length > 0, true, entry.moduleId);
    }
  });

  test('the registry still holds all of them', () => {
    // `moduleIds()` is the on-disk truth and every path guard below it depends
    // on staying complete. Narrowing it would make these unreadable rather than
    // unlisted, and take the API down with the pages.
    for (const id of delisted) assert.equal(moduleIds().includes(id), true, id);
    assert.equal(listedModuleIds().length, moduleIds().length - delisted.length);
  });

  test('none reaches the site', () => {
    for (const id of delisted) {
      assert.equal(listedModuleIds().includes(id), false, `${id} is still listed`);
      assert.equal(
        moduleSummaries().some((m) => m.id === id),
        false,
        `${id} is still on the browse page`
      );
      assert.equal(
        moduleAliases().some((a) => a.moduleId === id),
        false,
        `${id} still has an alias redirecting to it`
      );
    }
  });

  test('none reaches the sitemap', () => {
    const paths = sitemapEntries().map((e) => e.url.replace(SITE_URL, ''));
    for (const id of delisted) {
      const listed = paths.filter(
        (path) => path === `/modules/${id}` || path.startsWith(`/modules/${id}/`)
      );
      assert.deepEqual(listed, [], `${id} is in the sitemap`);
    }
  });

  test('none is served as agent-readable markdown', () => {
    for (const id of delisted) {
      assert.equal(markdownFor(`/modules/${id}`), undefined, `/md/modules/${id} still answers`);
    }
    // The route itself still works, so this is an exclusion rather than a break.
    assert.equal(typeof markdownFor(`/modules/${listedModuleIds()[0]}`), 'string');
  });

  // The half of the decision that is not a removal. TI-55's endpoint is what
  // the Titanium CLI resolves against, so an app with one of these in its
  // tiapp.xml has to keep building after it leaves the site.
  test('all of them still reach /registry/v1', () => {
    const served = new Set(listModules().map((m) => m.id));
    for (const id of delisted) assert.equal(served.has(id), true, `${id} left the registry API`);
  });
});
