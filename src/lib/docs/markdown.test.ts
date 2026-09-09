import { anchorFor, apiTarget, memberAnchor, pathLinker } from './links.ts';
import { renderMarkdown } from './markdown.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * Cross-repo reference resolution, which is the half of the story the registry
 * cannot settle.
 *
 * docgen compiles one repository at a time, so a module's prose carries
 * `api:Modules.Map.View` and `api:Titanium.UI.View` side by side with nothing
 * to tell them apart. Which tree each belongs to is decided by the linker, and
 * these pin the three outcomes: an anchor on the page, a path into the SDK, and
 * no link at all.
 */

/** Stands in for a module page: its own types are anchors, the SDK's are paths. */
const moduleLike = (local: string[], sdk: string[]) => {
  const own = new Set(local);
  const other = new Set(sdk);
  return (type: string, member?: string) => {
    if (own.has(type)) return `#${member ? memberAnchor(type, member) : type}`;
    if (other.has(type)) return `/docs/sdk/main/${type}${member ? `#${anchorFor(member)}` : ''}`;
    return null;
  };
};

const link = moduleLike(['Modules.Map', 'Modules.Map.View'], ['Titanium.UI.View', 'Global.String']);

describe('apiTarget', () => {
  test('splits a type from a member', () => {
    assert.deepEqual(apiTarget('api:Modules.Map.View'), { type: 'Modules.Map.View' });
    assert.deepEqual(apiTarget('api:Modules.Map#NORMAL_TYPE'), {
      type: 'Modules.Map',
      member: 'NORMAL_TYPE',
    });
  });

  test('is not fooled by anything else in an href', () => {
    assert.equal(apiTarget('https://example.com/api:X'), null);
    assert.equal(apiTarget('#local'), null);
    assert.equal(apiTarget('./relative.md'), null);
  });
});

describe('pathLinker', () => {
  test('links a type under the base path', () => {
    assert.equal(
      pathLinker('/docs/sdk/main')('Titanium.UI.View'),
      '/docs/sdk/main/Titanium.UI.View'
    );
  });

  test('anchors a member on its type page', () => {
    assert.equal(
      pathLinker('/docs/sdk/main')('Titanium.UI.View', 'backgroundColor'),
      '/docs/sdk/main/Titanium.UI.View#backgroundColor'
    );
  });

  test('refuses a type outside the index it was given', () => {
    // The regression this exists for: docgen folds single-use pseudo-types
    // into their referents, so `Titanium.Event` is named across the reference
    // and rendered nowhere. Linked blindly it was 606 dead links on its own,
    // out of 1,023 across the tree.
    const link = pathLinker('/docs/sdk/main', new Set(['Titanium.UI.View']));
    assert.equal(link('Titanium.UI.View'), '/docs/sdk/main/Titanium.UI.View');
    assert.equal(link('Titanium.Event'), null);
    assert.equal(link('Error'), null);
  });

  test('links everything when given no index', () => {
    // Prose rendered from a bare base string has no index to check against,
    // and must keep resolving the common case rather than dropping every link.
    assert.equal(pathLinker('/docs/sdk/main')('Whatever'), '/docs/sdk/main/Whatever');
  });
});

describe('renderMarkdown, module references', () => {
  test('resolves the module’s own types to anchors on the page', () => {
    const html = renderMarkdown('See [the view](api:Modules.Map.View#mapType).', { link });
    assert.match(html, /href="#Modules\.Map\.View\.mapType"/);
  });

  test('resolves SDK types into the SDK tree', () => {
    const html = renderMarkdown('Extends [a view](api:Titanium.UI.View).', { link });
    assert.match(html, /href="\/docs\/sdk\/main\/Titanium\.UI\.View"/);
  });

  test('drops the link, not the text, for a type nothing renders', () => {
    // Pseudo-types docgen folds into their referent emit no file, so a link
    // would be a 404. Eight references in the module corpus land here.
    const html = renderMarkdown('A [MapLocationTypeV2](api:MapLocationTypeV2) value.', { link });
    assert.doesNotMatch(html, /<a/);
    assert.match(html, /MapLocationTypeV2/);
  });

  test('rescues the ExtJS-era links the source still carries', () => {
    // 46 survive in the registry. Only the type reference has anywhere to go.
    assert.match(renderMarkdown('[x](#!/api/Titanium.UI.View)', { link }), /\/docs\/sdk\/main\//);
    assert.match(renderMarkdown('[x](#!/api/Anything-examples)', { link }), /href="#examples"/);
    assert.doesNotMatch(renderMarkdown('[installed](#!/guide/Using_a_Module)', { link }), /<a/);
    assert.match(renderMarkdown('[installed](#!/guide/Using_a_Module)', { link }), /installed/);
    // A member address for a type that no longer exists resolves to nothing.
    assert.doesNotMatch(renderMarkdown('[x](#!/api/GeoFences-method-create)', { link }), /<a/);
  });

  test('a bare path base still behaves like the SDK reference', () => {
    const html = renderMarkdown('[x](api:Titanium.UI.View#backgroundColor)', {
      link: pathLinker('/docs/sdk/main'),
    });
    assert.match(html, /href="\/docs\/sdk\/main\/Titanium\.UI\.View#backgroundColor"/);
  });
});

describe('renderMarkdown, third-party README', () => {
  const relative = {
    images: 'https://raw.githubusercontent.com/tidev/titanium-web-dialog/HEAD',
    links: 'https://github.com/tidev/titanium-web-dialog/blob/HEAD',
  };

  test('rewrites a relative image at the repository, not at this domain', () => {
    const html = renderMarkdown('<img src="./fixtures/example-screens.jpg">', { link, relative });
    assert.match(html, /src="https:\/\/raw\.githubusercontent\.com\/[^"]+\/fixtures\//);
  });

  test('rewrites a relative link and marks it as leaving the site', () => {
    const html = renderMarkdown('[the license](LICENSE)', { link, relative });
    assert.match(
      html,
      /href="https:\/\/github\.com\/tidev\/titanium-web-dialog\/blob\/HEAD\/LICENSE"/
    );
    assert.match(html, /rel="noopener noreferrer"/);
  });

  test('leaves a mailto alone rather than resolving it at the repository', () => {
    // `com.appcelerator.urlSession` offers a support address. Read as relative,
    // it shipped a link to `.../blob/HEAD/mailto:info@...`, which goes nowhere.
    const html = renderMarkdown('[email us](mailto:info@example.com)', { link, relative });
    assert.match(html, /href="mailto:info@example\.com"/);
    assert.doesNotMatch(html, /blob\/HEAD\/mailto/);
  });

  test('leaves absolute references and in-page anchors alone', () => {
    const html = renderMarkdown('[a](https://example.com) [b](#usage)', { link, relative });
    assert.match(html, /href="https:\/\/example\.com"/);
    assert.match(html, /href="#usage"/);
  });

  test('strips script from markdown nobody on this team wrote', () => {
    const html = renderMarkdown('Hi <script>alert(1)</script> there', { link });
    assert.doesNotMatch(html, /script|alert/);
  });
});

/**
 * The Appcelerator-era addresses the source still carries (TI-92).
 *
 * Eleven of seventeen module READMEs and part of the SDK prose cite hosts that
 * were decommissioned with the brand. The renderer is the only place that can
 * deal with them: the registry stores each README exactly as its repository
 * committed it, and rewriting upstream would mean a PR against eleven repos
 * that would still leave the copies already captured.
 */
describe('renderMarkdown, retired hosts', () => {
  const badge =
    '[![Build Status](https://jenkins.appcelerator.org/buildStatus/icon?job=modules%2Fti.map)]' +
    '(https://jenkins.appcelerator.org/job/modules/job/ti.map/)';

  test('removes a build badge for a CI system that no longer exists', () => {
    // The regression: six READMEs open with this, rendering a broken image on
    // the first line of the page - `facebook` and `ti.map` among them.
    const html = renderMarkdown(badge, { link });
    assert.doesNotMatch(html, /<img/);
    assert.doesNotMatch(html, /jenkins\.appcelerator\.org/);
  });

  test('leaves the live badge sitting next to it alone', () => {
    // The npm version badge is real and still resolves; only the dead one goes.
    const shields =
      '[![npm](https://img.shields.io/npm/v/@titanium-sdk/ti.map.png)]' +
      '(https://www.npmjs.com/package/@titanium-sdk/ti.map)';
    const html = renderMarkdown(`${badge} ${shields}`, { link });
    assert.match(html, /img\.shields\.io/);
    assert.match(html, /href="https:\/\/www\.npmjs\.com/);
    assert.doesNotMatch(html, /jenkins/);
  });

  test('drops the link and keeps the sentence for retired documentation', () => {
    // "Please use JIRA to report issues" still reads; a certificate warning
    // followed by a 404 does not. Same trade as the ExtJS-era guide links.
    const html = renderMarkdown(
      'Please use [JIRA](https://jira.appcelerator.org) to report issues.',
      { link }
    );
    assert.doesNotMatch(html, /<a/);
    // The anchor becomes a span, so the sentence survives intact once tags go.
    assert.equal(html.replace(/<[^>]+>/g, '').trim(), 'Please use JIRA to report issues.');
  });

  test('covers both retired domains, apex and subdomain alike', () => {
    for (const href of [
      'https://wiki.appcelerator.org/display/community/Home',
      'https://ti.appcelerator.org/x',
      'https://docs.appcelerator.com/platform/latest/',
      'https://appcelerator.com',
      'https://www.appcelerator.com/',
    ]) {
      assert.doesNotMatch(renderMarkdown(`[text](${href})`, { link }), /<a/, href);
    }
  });

  test('leaves tislack.org alone, which is still serving', () => {
    // Cited in the same sentence as the dead hosts and easy to sweep up with
    // them, but it resolves and answers 200.
    const html = renderMarkdown('ask our [TiSlack community](http://tislack.org)', { link });
    assert.match(html, /href="http:\/\/tislack\.org"/);
  });

  test('does not mistake a relative reference for a retired one', () => {
    const relative = {
      images: 'https://raw.githubusercontent.com/tidev/ti.map/HEAD',
      links: 'https://github.com/tidev/ti.map/blob/HEAD',
    };
    const html = renderMarkdown('[the license](LICENSE) ![shot](./shot.png)', { link, relative });
    assert.match(html, /href="https:\/\/github\.com\/tidev\/ti\.map\/blob\/HEAD\/LICENSE"/);
    assert.match(html, /<img/);
  });
});

/**
 * The accessibility guarantees the renderer makes about its own output (TI-49).
 *
 * Both exist because this HTML comes from fifteen years of hand-written source
 * that cannot be asked to carry them, so the renderer supplies them instead.
 */
describe('renderMarkdown, accessibility', () => {
  test('gives an image with no alt an empty one rather than none', () => {
    // Otherwise a screen reader falls back to announcing the filename.
    assert.match(renderMarkdown('<img src="/docs/img/7618194.png">', { link }), /alt=""/);
  });

  test('keeps the alt the source did write', () => {
    const html = renderMarkdown('![A modal window](/docs/img/window-modal.png)', { link });
    assert.match(html, /alt="A modal window"/);
    assert.doesNotMatch(html, /alt=""/);
  });

  test('makes every code block focusable, highlighted or not', () => {
    // A block scrolls sideways rather than widening the page, so a keyboard
    // needs a way to reach the end of a long line.
    const highlighted = renderMarkdown('```js\nvar win = Ti.UI.createWindow();\n```', { link });
    assert.match(highlighted, /<pre[^>]*\btabindex="0"/);
    assert.match(highlighted, /<pre[^>]*class="[^"]*shiki/);
    // No language, so Shiki declines to colour it - it still scrolls.
    assert.match(renderMarkdown('```\nError: Rebuild failed\n```', { link }), /<pre tabindex="0"/);
  });

  test('does not write a second tabindex over the one Shiki already wrote', () => {
    // Two copies of the attribute is invalid HTML, and a parser keeps the
    // first, so Shiki's own value would be silently discarded.
    const opening = renderMarkdown('```js\nvar a = 1;\n```', { link }).match(/<pre[^>]*>/)?.[0];
    assert.ok(opening, 'expected a <pre>');
    assert.equal(opening.match(/\btabindex=/g)?.length, 1);
  });
});
