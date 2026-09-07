import { BlockError, MAX_PANELS, renderBlocks, unresolvedMarkers } from './blocks.ts';
import { renderMarkdown } from './markdown.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The block components, driven through the real renderer.
 *
 * Every case starts as markdown rather than as hand-written HTML, because the
 * thing most likely to break these is not the transform - it is markdown-it
 * deciding to wrap a marker differently from how the regex expects. A test
 * written against the HTML directly would keep passing through exactly that
 * failure.
 */

const render = (markdown: string) => renderBlocks(renderMarkdown(markdown, {}));

/** Rendered text with the markup taken out. Shiki splits code into per-token
 *  spans, and where those land differs per grammar. */
const text = (html: string) => html.replace(/<[^>]*>/g, '');

const TABS = `
:::tabs

@tab npm

Install with npm.

@tab Yarn

Install with Yarn.

:::
`;

describe('tabs', () => {
  test('become a radio group with one panel each', () => {
    const html = render(TABS);
    assert.match(html, /<div class="tabs">/);
    assert.equal((html.match(/class="tab-radio"/g) ?? []).length, 2);
    assert.equal((html.match(/class="tab-panel"/g) ?? []).length, 2);
    assert.match(html, /<label class="tab" for="tabs-0-0">npm<\/label>/);
    assert.match(html, /<label class="tab" for="tabs-0-1">Yarn<\/label>/);
  });

  test('check the first tab, so a page renders with one panel showing', () => {
    const html = render(TABS);
    assert.match(html, /id="tabs-0-0" checked>/);
    assert.doesNotMatch(html, /id="tabs-0-1" checked/);
  });

  test('keep every panel in the HTML, not just the selected one', () => {
    // The panels are hidden by CSS, so a reader with no stylesheet - and any
    // crawler - still gets the whole page.
    const html = render(TABS);
    assert.match(text(html), /Install with npm\./);
    assert.match(text(html), /Install with Yarn\./);
  });

  test('put each radio directly before its own label', () => {
    // What lets the checked state be styled with `input:checked + .tab` rather
    // than one CSS rule per index.
    assert.match(render(TABS), /id="tabs-0-0" checked><label class="tab"/);
  });

  test('number groups from zero on every render', () => {
    // Ids must not depend on how many pages were rendered first, or the same
    // page would produce different HTML in different builds.
    assert.equal(render(TABS), render(TABS));
  });

  test('give each group on a page its own radio name', () => {
    const html = render(`${TABS}\n${TABS}`);
    assert.match(html, /name="tabs-0"/);
    assert.match(html, /name="tabs-1"/);
  });

  test('render markdown inside a panel', () => {
    const html = render(`
:::tabs

@tab One

A [link](/docs/setup) and \`code\`.

@tab Two

Plain.

:::
`);
    assert.match(html, /<a href="\/docs\/setup">link<\/a>/);
    assert.match(html, /<code>code<\/code>/);
  });
});

describe('a tab group refuses', () => {
  const rejects = (markdown: string, message: RegExp) =>
    assert.throws(
      () => render(markdown),
      (err: Error) => err instanceof BlockError && message.test(err.message)
    );

  test('a single panel, which is not a choice', () => {
    rejects('\n:::tabs\n\n@tab Only\n\nOne.\n\n:::\n', /at least two panels/);
  });

  test('more panels than the CSS has rules for', () => {
    const panels = Array.from({ length: MAX_PANELS + 1 }, (_, i) => `@tab T${i}\n\nBody ${i}.\n`);
    rejects(`\n:::tabs\n\n${panels.join('\n')}\n:::\n`, /more than 6/);
  });

  test('two tabs with the same label', () => {
    rejects('\n:::tabs\n\n@tab npm\n\nA.\n\n@tab npm\n\nB.\n\n:::\n', /repeats the tab "npm"/);
  });

  test('an empty panel', () => {
    rejects('\n:::tabs\n\n@tab npm\n\n@tab Yarn\n\nB.\n\n:::\n', /panel "npm" is empty/);
  });

  test('content before the first tab', () => {
    rejects(
      '\n:::tabs\n\nStray.\n\n@tab A\n\nA.\n\n@tab B\n\nB.\n\n:::\n',
      /before its first @tab/
    );
  });

  test('no tabs at all', () => {
    rejects('\n:::tabs\n\nJust prose.\n\n:::\n', /no @tab panels/);
  });

  test('a heading inside a panel', () => {
    // It would be given an anchor and a contents entry pointing at something
    // hidden until the reader picks that tab.
    rejects('\n:::tabs\n\n@tab A\n\n## Heading\n\n@tab B\n\nB.\n\n:::\n', /contains a heading/);
  });
});

describe('code groups', () => {
  const GROUP = `
:::code-group

@tab npm

\`\`\`sh
npm install -g titanium
\`\`\`

@tab Yarn

\`\`\`sh
yarn global add titanium
\`\`\`

:::
`;

  test('carry the class that welds the strip onto the code', () => {
    assert.match(render(GROUP), /<div class="tabs tabs-code"/);
  });

  test('highlight each block, the same as any other code', () => {
    const html = render(GROUP);
    assert.equal((html.match(/class="[^"]*shiki/g) ?? []).length, 2);
  });

  test('refuse a panel that is not a single code block', () => {
    assert.throws(
      () => render('\n:::code-group\n\n@tab A\n\nProse.\n\n@tab B\n\nAlso prose.\n\n:::\n'),
      /not a single code block/
    );
  });
});

describe('platform blocks', () => {
  test('badge one platform', () => {
    const html = render('\n:::platform android\n\nUse a keystore.\n\n:::\n');
    assert.match(html, /<div class="platform-block">/);
    assert.match(html, /<span class="badge badge-android">Android<\/span>/);
    assert.match(text(html), /Use a keystore\./);
  });

  test('badge several, spelled the way the vendor spells them', () => {
    const html = render('\n:::platform ios, macos\n\nBoth.\n\n:::\n');
    assert.match(html, /badge-ios">iOS</);
    assert.match(html, /badge-macos">macOS</);
  });

  test('say plainly when something is not available', () => {
    // The state the IA leans on: the Windows and Linux setup pages have to
    // express "you cannot build for iOS here" as a fact, not as an absence.
    const html = render('\n:::unavailable ios\n\nBuilding for iOS requires a Mac.\n\n:::\n');
    assert.match(html, /platform-block platform-block-off/);
    assert.match(text(html), /Not available on iOS/);
  });

  test('join several unavailable platforms as a sentence', () => {
    const html = render('\n:::unavailable ios, macos\n\nNo.\n\n:::\n');
    assert.match(text(html), /Not available on iOS or macOS/);
  });

  test('reject a platform that is not one', () => {
    assert.throws(
      () => render('\n:::platform tizen\n\nNope.\n\n:::\n'),
      /not a platform \(macos, windows, linux, ios, android\)/
    );
  });
});

describe('version notices', () => {
  test('name the SDK the content needs', () => {
    const html = render('\n:::since 12.1.0\n\nNew API.\n\n:::\n');
    assert.match(html, /<div class="version-notice">/);
    assert.match(text(html), /Since Titanium SDK 12\.1\.0/);
    assert.match(text(html), /New API\./);
  });

  test('accept a tagged release', () => {
    assert.match(
      text(render('\n:::since 12.1.0.GA\n\nX.\n\n:::\n')),
      /Since Titanium SDK 12\.1\.0\.GA/
    );
  });

  test('reject something that is not a version', () => {
    assert.throws(() => render('\n:::since soon\n\nX.\n\n:::\n'), /not a version number/);
  });
});

describe('missing screenshots', () => {
  const MISSING = `
:::missing 9:16

The two-tab template on an Android emulator.

:::
`;

  test('draws a box the shape of the picture', () => {
    const html = render(MISSING);
    assert.match(html, /<figure class="missing"/);
    assert.match(html, /aspect-ratio:9\/16/);
  });

  test('caps the width from the ratio, so a tall shot is not a storey high', () => {
    // 26rem of height at 9:16 is 14.63rem of width. A 16:9 at the same height
    // is wider than the prose, which is what `min(100%, ...)` is for.
    assert.match(render(MISSING), /max-width:min\(100%,14\.63rem\)/);
    assert.match(render(MISSING.replace('9:16', '16:9')), /max-width:min\(100%,46\.22rem\)/);
  });

  test('crosses the box corner to corner', () => {
    const html = render(MISSING);
    // Stretched by preserveAspectRatio, so the stroke has to opt out of scaling
    // or the hairline turns into a wedge on anything that is not square.
    assert.match(html, /preserveAspectRatio="none"/);
    assert.equal((html.match(/vector-effect="non-scaling-stroke"/g) ?? []).length, 2);
    assert.match(html, /x1="0" y1="0" x2="100" y2="100"/);
    assert.match(html, /x1="100" y1="0" x2="0" y2="100"/);
  });

  test('says it is missing, and what it should show', () => {
    const html = render(MISSING);
    assert.match(text(html), /Missing screenshot/);
    assert.match(text(html), /two-tab template on an Android emulator/);
  });

  test('the X is hidden from a screen reader, the description is not', () => {
    const html = render(MISSING);
    assert.match(html, /<svg class="missing-x"[^>]*aria-hidden="true"/);
    assert.match(html, /<figcaption class="missing-note">/);
  });

  test('leaves no marker behind', () => {
    assert.equal(unresolvedMarkers(render(MISSING)).length, 0);
  });
});

describe('a missing screenshot refuses', () => {
  const bad = (markdown: string) => assert.throws(() => render(markdown), BlockError);

  test('a shape that is not width:height', () => {
    bad(`
:::missing wide

A screenshot.

:::
`);
  });

  test('a side of zero, which has no shape at all', () => {
    bad(`
:::missing 0:16

A screenshot.

:::
`);
  });

  test('no description, which is a hole with a border round it', () => {
    bad(`
:::missing 9:16

:::
`);
  });
});

describe('card grids', () => {
  const CARDS = `
:::cards

@card [Visual Studio Code](#vs-code)

![](/docs/guides/vscode.png)

@card [Pulsar](#pulsar)

![](/docs/guides/pulsar.png)

:::
`;

  test('renders a list of linked cards', () => {
    const html = render(CARDS);
    assert.match(html, /<ul class="cards">/);
    assert.equal((html.match(/<li class="card">/g) ?? []).length, 2);
    assert.match(html, /<a href="#vs-code">/);
    assert.match(html, /<span class="card-label">Visual Studio Code<\/span>/);
  });

  test('keeps the image and empties its alt, since the label names the card', () => {
    const html = render(CARDS);
    assert.match(html, /<img alt="" src="\/docs\/guides\/vscode\.png"|<img alt=""[^>]*vscode\.png/);
    assert.doesNotMatch(html, /alt="Visual Studio Code"/);
  });

  test('a card without an image is still a card', () => {
    const html = render(`
:::cards

@card [One](/one)

@card [Two](/two)

:::
`);
    assert.equal((html.match(/<li class="card">/g) ?? []).length, 2);
    assert.doesNotMatch(html, /<img/);
  });

  test('leaves no marker behind', () => {
    assert.deepEqual(unresolvedMarkers(render(CARDS)), []);
  });
});

describe('a card grid refuses', () => {
  const bad = (markdown: string) => () => render(markdown);

  test('a single card, which is a link wearing a chooser costume', () => {
    assert.throws(
      bad(`
:::cards

@card [Only](/only)

:::
`),
      BlockError
    );
  });

  test('a card whose marker is not a link', () => {
    assert.throws(
      bad(`
:::cards

@card Visual Studio Code

@card [Pulsar](#pulsar)

:::
`),
      BlockError
    );
  });

  test('prose under a card, which would render inside the link', () => {
    assert.throws(
      bad(`
:::cards

@card [One](/one)

Some prose that does not belong here.

@card [Two](/two)

:::
`),
      BlockError
    );
  });

  test('two cards with the same label', () => {
    assert.throws(
      bad(`
:::cards

@card [Same](/one)

@card [Same](/two)

:::
`),
      BlockError
    );
  });

  test('content before the first card', () => {
    assert.throws(
      bad(`
:::cards

Stray text.

@card [One](/one)

@card [Two](/two)

:::
`),
      BlockError
    );
  });
});

describe('unresolvedMarkers', () => {
  test('finds a marker that lost its blank line', () => {
    // markdown-it folds `:::tabs` into the paragraph below it, so the block
    // never matches and would otherwise ship as literal text.
    const html = renderMarkdown(':::tabs\n@tab npm\n\nBody.\n\n:::\n', {});
    assert.ok(unresolvedMarkers(renderBlocks(html)).length > 0);
  });

  test('finds an unclosed block', () => {
    assert.deepEqual(unresolvedMarkers(render('\n:::platform ios\n\nBody.\n')), [
      ':::platform ios',
    ]);
  });

  test('finds a misspelled directive', () => {
    assert.deepEqual(unresolvedMarkers(render('\n:::platforms ios\n\nBody.\n\n:::\n')), [
      ':::platforms ios',
      ':::',
    ]);
  });

  test('is empty for a page that resolved cleanly', () => {
    assert.deepEqual(unresolvedMarkers(render(TABS)), []);
  });

  test('ignores prose that merely mentions the syntax', () => {
    // A paragraph *about* `:::tabs` is inline code, not a marker paragraph.
    assert.deepEqual(unresolvedMarkers(render('Write `:::tabs` to open a group.\n')), []);
  });
});
