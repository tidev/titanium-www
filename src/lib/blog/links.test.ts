import { LEGACY_GUIDE, unresolved, validatePosts } from './links.ts';
import { activeCategories, allPosts, CATEGORIES } from './posts.ts';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';

/**
 * The blog link check, driven directly as well as over the real archive.
 *
 * Asserting only that the committed posts pass would leave the check itself
 * unexercised: a resolver that returned null for everything would look exactly
 * the same. So each family is given a path that must resolve and one that must
 * not.
 */

describe('unresolved', () => {
  test('accepts a static route, with or without a trailing slash', () => {
    assert.equal(unresolved('/contribute'), null);
    assert.equal(unresolved('/downloads/builds'), null);
    assert.equal(unresolved('/blog/'), null);
    assert.equal(unresolved('/'), null);
  });

  test('rejects a path no route serves', () => {
    // The archive linked this on 38 posts. tidev.io has the page; this site
    // never has.
    assert.ok(unresolved('/donate'));
    assert.ok(unresolved('/guide/Alloy_Framework/Alloy_Guide/Alloy_PurgeTSS.html'));
  });

  test('resolves only the categories the archive route generates', () => {
    const active = activeCategories().map(({ category }) => category);
    assert.ok(active.length, 'expected the archive to have categories');
    assert.equal(unresolved(`/blog/category/${active[0].toLowerCase()}`), null);
    assert.ok(unresolved('/blog/category/no-such-category'));

    // `dynamicParams` is off on that route and its params come from
    // `activeCategories`, so a declared category with nothing filed under it
    // is a 404 the check has to report rather than a category that exists.
    for (const category of CATEGORIES.filter((c) => !active.includes(c))) {
      assert.ok(unresolved(`/blog/category/${category.toLowerCase()}`), category);
    }
  });

  test('resolves a post by slug', () => {
    const [post] = allPosts();
    assert.equal(unresolved(`/blog/${post.slug}`), null);
    assert.ok(unresolved('/blog/no-such-post'));
  });

  test('resolves a docs page against the IA', () => {
    assert.equal(unresolved('/docs'), null);
    assert.equal(unresolved('/docs/build'), null);
    assert.equal(unresolved('/docs/build/ui/layout'), null);
    // The legacy mapping predicted this one. The approved IA has no such page,
    // which is why the rewrite truncates to the nearest ancestor.
    assert.ok(unresolved('/docs/alloy/guide'));
  });

  test('resolves release notes for versions with no compiled reference', () => {
    // 11.1.0 has a captured note and no API index, so it is in
    // `versionsWithNotes()` and not in `sdkVersions()`.
    assert.equal(unresolved('/docs/sdk/11.1.0/release-notes'), null);
    assert.ok(unresolved('/docs/sdk/11.1.0'));
    assert.ok(unresolved('/docs/sdk/99.0.0/release-notes'));
  });

  test('resolves an API type page', () => {
    assert.equal(unresolved('/docs/sdk/Titanium.UI.Window'), null);
    assert.ok(unresolved('/docs/sdk/Titanium.Nonexistent'));
  });

  test('checks a file against public/', () => {
    assert.equal(unresolved('/blog/titanium-general.png'), null);
    assert.ok(unresolved('/blog/no-such-image.png'));
  });
});

describe('validatePosts', () => {
  test('the committed archive has no dead or absolute internal link', () => {
    const problems = validatePosts();
    assert.deepEqual(problems, [], problems.map((p) => `${p.where}: ${p.message}`).join('\n'));
  });

  test('no post mentions the legacy wiki, as prose or as a link', () => {
    // The link check cannot see the prose form: `linkify` is off, so a bare
    // URL in a sentence renders as text and never becomes an anchor. Five
    // arrived that way.
    const dir = join(process.cwd(), 'content/blog');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const text = readFileSync(join(dir, file), 'utf8');
      assert.ok(!LEGACY_GUIDE.test(text), `${file} still points at the legacy wiki`);
    }
  });
});

describe('LEGACY_GUIDE', () => {
  test('catches ours, in either form', () => {
    assert.ok(LEGACY_GUIDE.test('see https://titaniumsdk.com/guide/Alloy_Framework/'));
    assert.ok(LEGACY_GUIDE.test('the [guide](/guide/Alloy_Framework/Alloy_Guide.html)'));
  });

  test('leaves somebody else’s /guide/ alone', () => {
    // A Titanium post citing the platform docs is ordinary, and the check has
    // to let one be written.
    assert.ok(!LEGACY_GUIDE.test('https://developer.android.com/guide/topics/manifest'));
    assert.ok(!LEGACY_GUIDE.test('[Apple](https://developer.apple.com/guide/xcode/)'));
  });
});
