import {
  corpusVersion,
  flattenBlocks,
  llmsFullTxt,
  llmsGroups,
  llmsTxt,
  markdownFor,
  validateLlmsIndex,
} from './llms.ts';
import { latestSdkVersion, sdkIndex } from './registry.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The machine-readable corpus, over the real tree.
 *
 * No fixtures. `llms.txt` is a claim about what this site serves, and a fixture
 * would let it be right about a tree nobody visits. The registry and
 * `content/docs` are both committed, so the real thing is deterministic.
 */

describe('flattenBlocks', () => {
  test('turns a tab group into labelled prose', () => {
    const out = flattenBlocks(
      ':::tabs\n\n@tab macOS\n\nbrew install\n\n@tab Windows\n\nchoco\n\n:::'
    );
    assert.match(out, /\*\*macOS\*\*/);
    assert.match(out, /\*\*Windows\*\*/);
    assert.doesNotMatch(out, /:::/);
    assert.doesNotMatch(out, /@tab/);
  });

  test('keeps a platform restriction as a sentence', () => {
    // Losing this turns an iOS-only instruction into a universal one, which is
    // the single most costly thing flattening could get wrong.
    const out = flattenBlocks(':::platform ios\n\nUse Xcode.\n\n:::');
    assert.match(out, /\*\*Applies to iOS only\.\*\*/);
    assert.match(out, /Use Xcode\./);
  });

  test('keeps an unavailability and a version floor', () => {
    assert.match(flattenBlocks(':::unavailable android\n\nno\n\n:::'), /Not available on Android/);
    assert.match(flattenBlocks(':::since 12.1.0\n\nnew\n\n:::'), /Titanium SDK 12\.1\.0 and later/);
  });

  test('leaves fenced code alone', () => {
    // A shell block containing something that looks like a marker is not one.
    const out = flattenBlocks('```sh\n:::tabs\n@tab x\n```\n');
    assert.match(out, /:::tabs/);
    assert.match(out, /@tab x/);
  });

  test('turns cards into a list', () => {
    const out = flattenBlocks(':::cards\n\n@card [Setup](/docs/setup)\n\n:::');
    assert.equal(out, '- [Setup](/docs/setup)');
  });
});

describe('markdownFor', () => {
  test('serves a guide with its frontmatter restated as text', () => {
    const md = markdownFor('/docs/setup/macos')!;
    assert.match(md, /^# /);
    assert.match(md, /Applies to: macOS, iOS, Android/);
    assert.match(md, /Source: https:\/\/titaniumsdk\.com\/docs\/setup\/macos/);
  });

  test('expands an included partial rather than emitting the directive', () => {
    const md = markdownFor('/docs/setup/macos')!;
    assert.doesNotMatch(md, /:::include/);
    assert.match(md, /titanium/i);
  });

  test('resolves the docs index at the empty path', () => {
    assert.match(markdownFor('/docs')!, /^# /);
  });

  test('serves a type, with platforms, since and deprecation as text', () => {
    const md = markdownFor('/docs/sdk/Titanium.UI.Window')!;
    assert.match(md, /^# Titanium\.UI\.Window/);
    assert.match(md, /- Platforms: /);
    assert.match(md, /- Titanium SDK version: /);
    assert.match(md, /## Properties/);
    // Inherited members are listed under the type that declares them rather
    // than expanded, which is what keeps a type page a sane size.
    assert.match(md, /## Inherited members/);
  });

  test('states the deprecation of a deprecated type in words', () => {
    const version = latestSdkVersion()!;
    const deprecated = sdkIndex(version)!.types.find((t) => t.deprecated);
    assert.ok(deprecated, 'the registry has no deprecated type to check');
    assert.match(markdownFor(`/docs/sdk/${deprecated.name}`)!, /DEPRECATED/);
  });

  test('resolves a segment as a version before a type, as the pages do', () => {
    const version = latestSdkVersion()!;
    assert.match(markdownFor(`/docs/sdk/${version}`)!, /# Titanium API/);
    assert.match(markdownFor(`/docs/sdk/${version}/Titanium.UI.Window`)!, /# Titanium\.UI\.Window/);
  });

  test('pins the version in every artifact', () => {
    const version = corpusVersion();
    for (const path of ['/docs', '/docs/sdk', '/docs/sdk/Titanium.UI.Window', '/modules']) {
      assert.match(markdownFor(path)!, new RegExp(version.replace(/\./g, '\\.')), path);
    }
  });

  test('names the retired Appcelerator toolchain', () => {
    // The point of the corpus. A model that has read a decade of `appc`
    // instructions has to be told, not merely not-told otherwise.
    assert.match(markdownFor('/docs')!, /Appcelerator toolchain is retired/);
  });

  test('serves a module with the id and the install snippet', () => {
    const md = markdownFor('/modules/ti.map')!;
    assert.match(md, /Module id: `ti\.map`/);
    assert.match(md, /<module platform=/);
  });

  test('refuses a path that is not a page', () => {
    for (const path of [
      '/docs/nope',
      '/docs/sdk/NoSuchType',
      '/docs/sdk/13.4.1/NoSuchType',
      '/docs/sdk/a/b/c',
      '/modules/nope',
      '/modules/ti.map/api',
      '/blog/sdk-13-4-1-ga',
      '/',
    ]) {
      assert.equal(markdownFor(path), undefined, path);
    }
  });

  test('links out to markdown rather than to pages', () => {
    const md = markdownFor('/docs/sdk/Titanium.UI.Window')!;
    assert.doesNotMatch(md, /\]\(api:/);
    assert.doesNotMatch(md, /\]\(\/docs/);
  });
});

describe('llmsTxt', () => {
  const text = llmsTxt();

  test('follows the llmstxt.org shape: H1, blockquote, then linked sections', () => {
    const lines = text.split('\n');
    assert.equal(lines[0], '# Titanium SDK');
    assert.ok(
      lines.some((l) => l.startsWith('> ')),
      'no blockquote summary'
    );
    assert.ok(lines.some((l) => l.startsWith('## ')));
    assert.match(text, /\n## Optional\n/);
  });

  test('every link is absolute and points at markdown or off site', () => {
    for (const [, href] of text.matchAll(/\]\(([^)]+)\)/g)) {
      assert.ok(href.startsWith('https://'), href);
      if (href.startsWith('https://titaniumsdk.com/docs')) assert.match(href, /\.md$/, href);
    }
  });

  test('cross-references the skills repository', () => {
    assert.match(text, /github\.com\/tidev\/skills/);
  });

  test('lists modules, so the id for a capability is answerable', () => {
    assert.match(text, /\n## Modules\n/);
    assert.match(text, /ti\.map/);
  });

  test('lists no page that has not been written', () => {
    // A placeholder is honest on a page and a broken promise in an index.
    for (const group of llmsGroups()) {
      for (const entry of group.entries) {
        assert.ok(markdownFor(entry.path), `${entry.path} has no markdown`);
      }
    }
  });

  test('validates clean against the real tree', () => {
    assert.deepEqual(validateLlmsIndex(), []);
  });

  test('lists the documentation home, which belongs to no section', () => {
    // It is the entry point of the tree and is reached by neither section loop,
    // so it went missing from the index and from llms-full.txt.
    const paths = llmsGroups().flatMap((group) => group.entries.map((entry) => entry.path));
    assert.ok(paths.includes('/docs'), 'the documentation home is not indexed');
  });
});

describe('markdownFor path handling', () => {
  // These segments reach `join(CONTENT, ...segments)`, which resolves `..`. Left
  // unchecked they escaped the content root and read arbitrary markdown from the
  // repository, dying in the frontmatter parser as a 500 rather than a 404, and
  // would have served any file that happened to satisfy the schema.
  const escapes = [
    '/docs/../../AGENTS',
    '/docs/../../README',
    '/docs/../blog/sdk-11-ga',
    '/docs/../../package',
    '/docs/setup/../../../AGENTS',
  ];

  for (const path of escapes) {
    test(`refuses to escape the content root: ${path}`, () => {
      assert.equal(markdownFor(path), undefined);
    });
  }

  test('refuses a partial, which is a fragment rather than a page', () => {
    assert.equal(markdownFor('/docs/_partials/install-cli'), undefined);
  });

  test('never throws for an arbitrary path', () => {
    // The route turns `undefined` into a 404. A throw would be a public 500.
    for (const path of [...escapes, '/docs/_partials/jdk', '/docs/.', '/docs/..']) {
      assert.doesNotThrow(() => markdownFor(path), path);
    }
  });

  test('still serves the pages it is meant to', () => {
    assert.ok(markdownFor('/docs'));
    assert.ok(markdownFor('/docs/setup/macos'));
  });
});

describe('llmsFullTxt', () => {
  test('carries the guides and not the reference', () => {
    const { text, omitted } = llmsFullTxt();
    assert.deepEqual(omitted, []);
    assert.match(text, /# Titanium SDK guides/);
    assert.match(text, /Guides only/);
    // A type page would drag in the whole reference, which is the one thing
    // this file is scoped to exclude.
    assert.doesNotMatch(text, /^- Kind: (view|proxy|module|pseudo)$/m);
  });

  test('stays inside its own cap', () => {
    const { text } = llmsFullTxt();
    assert.ok(Buffer.byteLength(text, 'utf8') < 1_000_000);
  });

  test('truncates at the cap and says what it dropped', () => {
    const { text, omitted } = llmsFullTxt(20_000);
    assert.ok(omitted.length > 0, 'nothing was dropped at a 20KB cap');
    // The cap the header states, not a loose multiple of it. The footer listing
    // the omissions is part of the file, and appending it unbudgeted put a
    // 20,000 byte cap at 21,045 bytes.
    assert.ok(Buffer.byteLength(text, 'utf8') <= 20_000, 'the file overran its own cap');
    assert.match(text, /## Omitted for size/);
    // Dropped is not lost: each one is still addressable on its own.
    for (const path of omitted) assert.ok(text.includes(`${path}.md`), path);
  });

  test('drops from the end rather than by whichever page happens to fit', () => {
    const { omitted } = llmsFullTxt(20_000);
    const all = llmsGroups()
      .filter((g) => g.guides)
      .flatMap((g) => g.entries.map((e) => e.path));
    assert.deepEqual(omitted, all.slice(all.length - omitted.length));
  });
});
