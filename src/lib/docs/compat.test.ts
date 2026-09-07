import type { ApiType, Toolchain } from '../registry/index.ts';
import {
  cell,
  groupsFor,
  narrowedPlatforms,
  renderMatrix,
  renderToolchain,
  table,
  type MatrixRow,
} from './compat.ts';
import { renderMarkdown } from './markdown.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const row = (over: Partial<MatrixRow> = {}): MatrixRow => ({
  name: 'Titanium.UI.Color',
  platforms: ['android', 'iphone', 'ipad', 'macos'],
  since: '9.1.0',
  deprecated: false,
  partial: [],
  ...over,
});

const type = (over: Partial<ApiType> = {}): ApiType =>
  ({
    schemaVersion: 1,
    name: 'Titanium.UI.View',
    kind: 'view',
    platforms: ['android', 'iphone', 'ipad', 'macos'],
    properties: [],
    methods: [],
    events: [],
    inherited: { properties: [], methods: [], events: [] },
    source: 'Titanium/UI/View.yml',
    ...over,
  }) as ApiType;

describe('table', () => {
  test('pads every column to its widest cell, as oxfmt would', () => {
    // Not cosmetic: `pnpm fmt` reformats markdown, so a ragged table here would
    // be rewritten on disk and the next `docs:compat:check` would call the
    // generator's own output stale.
    assert.deepEqual(table(['SDK', 'Node.js'], [['13.4.1', '>=20.18.1']]), [
      '| SDK    | Node.js   |',
      '| ------ | --------- |',
      '| 13.4.1 | >=20.18.1 |',
    ]);
  });

  test('a rule is never shorter than three dashes', () => {
    assert.deepEqual(table(['A'], [['b']]), ['| A   |', '| --- |', '| b   |']);
  });
});

describe('groupsFor', () => {
  test('groups on the second segment and folds small namespaces into the root', () => {
    const groups = groupsFor([
      'Titanium.UI.View',
      'Titanium.UI.Window',
      'Titanium.UI.Label',
      'Titanium.UI.Button',
      // One type under its namespace does not earn a heading of its own.
      'Titanium.Gesture',
      'Titanium.Locale',
    ]);
    assert.deepEqual([...groups.keys()], ['Titanium', 'Titanium.UI']);
    assert.deepEqual(groups.get('Titanium'), ['Titanium.Gesture', 'Titanium.Locale']);
  });

  test('groups on the second segment only, however deep the name is', () => {
    // Titanium.UI.iOS is a namespace of its own in the reference, and splitting
    // it out would put a heading of iOS-only views beside Titanium.UI for no
    // reason a reader scanning the page would predict.
    const groups = groupsFor([
      'Titanium.UI.View',
      'Titanium.UI.Window',
      'Titanium.UI.Label',
      'Titanium.UI.iOS.BlurView',
    ]);
    assert.deepEqual([...groups.keys()], ['Titanium.UI']);
  });

  test('names outside a known root land in one alphabetical group, listed last', () => {
    const groups = groupsFor(['Point', 'fs', 'Titanium.UI.View', 'buffer.Buffer']);
    assert.equal([...groups.keys()].at(-1), 'Other types');
    assert.deepEqual(groups.get('Other types'), ['buffer.Buffer', 'fs', 'Point']);
  });
});

describe('narrowedPlatforms', () => {
  test('reports a platform the type has that a member does not', () => {
    const narrowed = narrowedPlatforms(
      type({
        properties: [{ name: 'blurRadius', platforms: ['iphone', 'ipad', 'macos'] }],
      } as Partial<ApiType>)
    );
    assert.deepEqual(narrowed, ['android']);
  });

  test('inherited members narrow too, using the reference platforms', () => {
    // The reference carries platforms already narrowed to the inheriting type,
    // so an inherited member can be narrower here than on the type declaring it.
    const narrowed = narrowedPlatforms(
      type({
        inherited: {
          properties: [{ name: 'backgroundColor', from: 'Titanium.UI.View', platforms: ['macos'] }],
          methods: [],
          events: [],
        },
      } as Partial<ApiType>)
    );
    assert.deepEqual(narrowed, ['android', 'iphone', 'ipad']);
  });

  test('a type whose members all match it is not narrowed', () => {
    const narrowed = narrowedPlatforms(
      type({
        methods: [{ name: 'add', platforms: ['android', 'iphone', 'ipad', 'macos'] }],
      } as Partial<ApiType>)
    );
    assert.deepEqual(narrowed, []);
  });
});

describe('cell', () => {
  test('an unavailable platform reads as absent rather than as blank', () => {
    assert.equal(cell(row({ platforms: ['iphone', 'ipad', 'macos'] }), 'android'), '-');
  });

  test('a per-platform since map is read per platform', () => {
    // 91 types arrived on different platforms in different releases, and
    // flattening that to one column would have to pick one of them to print.
    const intl = row({
      since: { iphone: '6.0.0', ipad: '6.0.0', android: '9.1.0', macos: '9.2.0' },
    });
    assert.equal(cell(intl, 'android'), '9.1.0');
    assert.equal(cell(intl, 'iphone'), '6.0.0');
  });

  test('an available type with no recorded release still says it is available', () => {
    assert.equal(cell(row({ since: undefined }), 'android'), 'yes');
  });

  test('a platform with narrower members is marked', () => {
    assert.equal(cell(row({ partial: ['macos'] }), 'macos'), '9.1.0 \\*');
    assert.equal(cell(row({ partial: ['macos'] }), 'android'), '9.1.0');
  });
});

describe('renderMatrix', () => {
  const matrix = {
    version: '13.4.1',
    members: 10395,
    rows: [row(), row({ name: 'Titanium.UI.Window', deprecated: true, partial: ['android'] })],
  };

  test('names the version it was generated from', () => {
    assert.match(renderMatrix(matrix, '<!-- x -->'), /Titanium SDK 13\.4\.1/);
  });

  test('links every type at its unversioned reference page', () => {
    assert.match(
      renderMatrix(matrix, '<!-- x -->'),
      /\[Titanium\.UI\.Color\]\(\/docs\/sdk\/Titanium\.UI\.Color\)/
    );
  });

  test('renders as a table rather than as escaped pipes', () => {
    const html = renderMarkdown(renderMatrix(matrix, '<!-- x -->'), {});
    assert.match(html, /<table>/);
    assert.match(html, /<th>macOS<\/th>/);
    // The narrowing mark has to survive markdown as a literal asterisk; an
    // unescaped one opens emphasis and eats the rest of the row.
    assert.match(html, /<td>9\.1\.0 \*<\/td>/);
  });
});

describe('renderToolchain', () => {
  const at = (version: string, node: string, java: string): Toolchain => ({
    schemaVersion: 1,
    version,
    source: { repo: 'tidev/titanium-sdk', ref: version, commit: 'a'.repeat(40) },
    node,
    android: { minSdkVersion: '24', compileSdkVersion: '36', vendor: { java } },
    ios: { minIosVersion: '15.0', vendor: { xcode: '>=15.0 <=26.x' } },
  });

  test('a range with pipes survives as one table cell', () => {
    // `16.x || 18.x || 20.x` is a real value. Unescaped, its pipes end the cell
    // and every row after it is off by two columns.
    const html = renderMarkdown(
      renderToolchain([at('12.8.0', '16.x || 18.x || 20.x', '>=11.x')], '<!-- x -->'),
      {}
    );
    assert.match(html, /<code>16\.x \|\| 18\.x \|\| 20\.x<\/code>/);
    assert.doesNotMatch(html, /<td>`16\.x<\/td>/);
  });

  test('a newline in a captured value cannot end the row', () => {
    // `vendorDependencies` is the SDK's to shape and this repository transcribes
    // it verbatim, so a wrapped value is the SDK's to introduce. A pipe can be
    // escaped; a newline cannot, so it has to be folded before it is written.
    const wrapped = at('13.4.1', '>=20.18.1', '>=17.x\n  || >=21.x');
    const out = renderToolchain([wrapped], '');
    assert.doesNotMatch(out.split('### What each release needs')[1], /\n\s*\|\| >=21/);
    assert.match(renderMarkdown(out, {}), /<code>&gt;=17\.x \|\| &gt;=21\.x<\/code>/);
  });

  test('a pipe in a vendor key cannot end the row either', () => {
    const odd: Toolchain = {
      schemaVersion: 1,
      version: '13.4.1',
      source: { repo: 'tidev/titanium-sdk', ref: '13.4.1', commit: 'c'.repeat(40) },
      android: { vendor: { 'build|tools': '35.x' } },
      ios: { vendor: {} },
    };
    assert.match(renderToolchain([odd], ''), /\| Build\\\|tools /);
  });

  test('the current release is the newest that is not main', () => {
    const out = renderToolchain(
      [at('main', '>=22.19.0', '>=17.x'), at('13.4.1', '>=20.18.1', '>=17.x')],
      ''
    );
    assert.match(out, /### Titanium SDK 13\.4\.1/);
    assert.match(out, /`main` \(unreleased\)/);
  });

  test('a missing value reads as absent rather than as an empty cell', () => {
    const bare: Toolchain = {
      schemaVersion: 1,
      version: '9.0.0',
      source: { repo: 'tidev/titanium-sdk', ref: '9.0.0', commit: 'b'.repeat(40) },
      android: { vendor: {} },
      ios: { vendor: {} },
    };
    const out = renderToolchain([bare], '');
    assert.match(out, /\| Node\.js +\| - +\|/);
  });
});
