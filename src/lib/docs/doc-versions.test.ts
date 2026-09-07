import {
  archivedSeo,
  basePath,
  currentMajor,
  docHref,
  guideVersionOptions,
  isIndexPath,
  looksVersioned,
  majorOf,
  publishedMajors,
  routedPaths,
  splitDocPath,
  validateDocVersions,
  versionizeLinks,
} from './doc-versions.ts';
import { allPaths, SECTIONS } from './ia.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The rules prose versioning is built on (TI-59).
 *
 * These run against the real manifest rather than a fixture, on purpose: the
 * manifest is the single place a version is written down, and a test that
 * mocked it would prove the mechanism works on data nobody ships. What is
 * asserted is therefore the shape of the answers, not a particular major.
 *
 * The one thing a fixture does buy is a second published major, which the
 * repository does not have yet. `scripts/__tests__/snapshot-docs.test.ts` cuts
 * a real one in a scratch directory and checks what comes out.
 */

describe('majorOf', () => {
  test('takes the major from a release', () => {
    assert.equal(majorOf('13.4.1'), 'v13');
    assert.equal(majorOf('9.0.0'), 'v9');
  });

  test('has no answer for main', () => {
    // `main` is a moving branch of the SDK, not a release, so it belongs to no
    // documentation major. Guessing one would tie the guides to a tree that
    // changes under them.
    assert.equal(majorOf('main'), null);
  });
});

describe('splitDocPath', () => {
  test('unversioned segments are the current major', () => {
    const { major, rest, explicit } = splitDocPath(['setup', 'macos']);
    assert.equal(major, currentMajor());
    assert.deepEqual(rest, ['setup', 'macos']);
    assert.equal(explicit, false);
  });

  test('/docs is the current major too', () => {
    const { major, rest } = splitDocPath([]);
    assert.equal(major, currentMajor());
    assert.deepEqual(rest, []);
  });

  test('a segment spelled like a major is one, published or not', () => {
    // The alternative is looking for a section called `v9`, which would make an
    // unpublished major render the docs index instead of 404ing.
    const { major, rest, explicit, known } = splitDocPath(['v9', 'setup', 'macos']);
    assert.equal(major, 'v9');
    assert.deepEqual(rest, ['setup', 'macos']);
    assert.equal(explicit, true);
    assert.equal(known, false);
  });

  test('no section can be mistaken for a major', () => {
    for (const section of SECTIONS) {
      assert.equal(looksVersioned(section.slug), false, `${section.slug} looks like a major`);
    }
  });
});

describe('docHref', () => {
  test('the current major carries no prefix', () => {
    assert.equal(basePath(currentMajor()), '');
    assert.equal(docHref(currentMajor(), ['setup', 'macos']), '/docs/setup/macos');
    assert.equal(docHref(currentMajor(), []), '/docs');
  });

  test('an older major carries one', () => {
    assert.equal(basePath('v1'), '/v1');
    assert.equal(docHref('v1', ['setup', 'macos']), '/docs/v1/setup/macos');
    assert.equal(docHref('v1', []), '/docs/v1');
  });
});

describe('versionizeLinks', () => {
  const html = (body: string) => versionizeLinks(body, 'v1');

  test('keeps a guide link inside the major being read', () => {
    assert.equal(
      html('<a href="/docs/build/ui/layout">Layout</a>'),
      '<a href="/docs/v1/build/ui/layout">Layout</a>'
    );
    assert.equal(html('<a href="/docs">Docs</a>'), '<a href="/docs/v1">Docs</a>');
  });

  test('leaves the API reference alone', () => {
    // The reference is versioned per release and has no `/docs/v1` spelling, so
    // prefixing it would turn every API link in the archive into a 404.
    const link = '<a href="/docs/sdk/Titanium.UI.Window">Titanium.UI.Window</a>';
    assert.equal(html(link), link);
    assert.equal(html('<a href="/docs/latest">latest</a>'), '<a href="/docs/latest">latest</a>');
  });

  test('does not double-prefix a link that already names a major', () => {
    const link = '<a href="/docs/v2/setup">v2</a>';
    assert.equal(html(link), link);
  });

  test('leaves everything outside /docs alone', () => {
    const other = '<a href="/modules/ti.map">ti.map</a><a href="https://example.com/docs/x">x</a>';
    assert.equal(html(other), other);
  });

  test('does not touch an image path', () => {
    // `/docs/guides/*.png` is a file under `public/`, shared by every major.
    // One copy, and a prefix would break it in the archive.
    const img = '<img src="/docs/guides/android-sdk-manager.png" alt="">';
    assert.equal(html(img), img);
  });

  test('carries a fragment and a query through', () => {
    assert.equal(
      html('<a href="/docs/setup/macos#install-xcode">Xcode</a>'),
      '<a href="/docs/v1/setup/macos#install-xcode">Xcode</a>'
    );
  });

  test('is a no-op for the current major', () => {
    const link = '<a href="/docs/setup/macos">macOS</a>';
    assert.equal(versionizeLinks(link, currentMajor()), link);
  });
});

describe('isIndexPath', () => {
  test('the docs root and a section are indexes', () => {
    assert.equal(isIndexPath([]), true);
    assert.equal(isIndexPath(['build']), true);
  });

  test('a page with children is an index', () => {
    assert.equal(isIndexPath(['build', 'ui']), true);
  });

  test('a leaf is not', () => {
    assert.equal(isIndexPath(['setup', 'macos']), false);
    assert.equal(isIndexPath(['build', 'ui', 'layout']), false);
  });
});

describe('guideVersionOptions', () => {
  test('one option per published major, current first and marked', () => {
    const options = guideVersionOptions(['setup', 'macos']);
    assert.deepEqual(
      options.map((o) => o.version),
      publishedMajors()
    );
    assert.equal(options[0].version, currentMajor());
    assert.equal(options[0].latest, true);
    // `unreleased` belongs to the reference, where `main` is a compiled branch.
    // A documentation major does not exist until it ships.
    assert.equal(
      options.every((o) => !o.unreleased),
      true
    );
  });

  test('every option lands somewhere that exists', () => {
    for (const option of guideVersionOptions(['setup', 'macos'])) {
      assert.ok(option.href.startsWith('/docs'));
      // An option with no equivalent page points at that major's index rather
      // than at a 404, and says so through `present`.
      if (!option.present) assert.equal(option.href, docHref(option.version, []));
    }
  });
});

describe('archivedSeo', () => {
  test('a page that exists in current canonicalises to it and stays indexable', () => {
    const seo = archivedSeo('v1', ['setup', 'macos']);
    assert.equal(seo.canonical, '/docs/setup/macos');
    assert.equal(seo.index, true);
  });

  test('a page current does not have is noindexed instead', () => {
    // Nothing to consolidate to, and an orphan archived page ranking for a
    // current query is the problem this scheme exists to prevent.
    const seo = archivedSeo('v1', ['setup', 'this-page-was-dropped']);
    assert.equal(seo.canonical, '/docs/v1/setup/this-page-was-dropped');
    assert.equal(seo.index, false);
  });
});

describe('routedPaths', () => {
  test('a major routes the whole IA under its own prefix', () => {
    const paths = routedPaths('v1');
    assert.equal(paths.length, allPaths().length);
    assert.ok(paths.includes('/docs/v1'));
    assert.ok(paths.includes('/docs/v1/build/ui/layout'));
    assert.equal(
      paths.every((p) => p.startsWith('/docs/v1')),
      true
    );
  });

  test('the current major routes the unprefixed paths', () => {
    assert.deepEqual(routedPaths(currentMajor()), allPaths());
  });
});

describe('the shipped manifest', () => {
  test('validates', () => {
    assert.deepEqual(validateDocVersions(), []);
  });

  test('never lists the current major as archived', () => {
    const current = currentMajor();
    assert.equal(publishedMajors().filter((m) => m === current).length, 1);
  });
});
