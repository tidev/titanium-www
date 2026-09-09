import { rewriteLink, rewriteLinks } from './legacy-blog-links.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The rewrite the importer applies, against the shapes the archive actually
 * contains. Every input here was taken from a committed post.
 */

describe('rewriteLink', () => {
  test('sends a per-version release note to its page here', () => {
    assert.equal(
      rewriteLink(
        'https://titaniumsdk.com/guide/Titanium_SDK/Titanium_SDK_Release_Notes/' +
          'Titanium_SDK_Release_Notes_13.x/Titanium_SDK_13.4.1.GA_Release_Note.html'
      ),
      '/docs/sdk/13.4.1/release-notes'
    );
  });

  test('folds a release candidate onto the GA notes for the same version', () => {
    // 12.3.0.RC, 12.3.0.RC2 and 12.3.0.GA were three pages on the old wiki and
    // are one here. Nothing renders the captured RC notes.
    for (const channel of ['GA', 'RC', 'RC2']) {
      assert.equal(
        rewriteLink(
          'https://titaniumsdk.com/guide/Titanium_SDK/Titanium_SDK_Release_Notes/' +
            `Titanium_SDK_Release_Notes_12.x/Titanium_SDK_12.3.0.${channel}_Release_Note.html`
        ),
        '/docs/sdk/12.3.0/release-notes'
      );
    }
  });

  test('leaves a release note alone when the version has no captured note', () => {
    // Reported by `check:docs` rather than pointed somewhere that is not it.
    assert.equal(
      rewriteLink(
        'https://titaniumsdk.com/guide/Titanium_SDK/Titanium_SDK_Release_Notes/' +
          'Titanium_SDK_Release_Notes_7.x/Titanium_SDK_7.0.0.GA_Release_Note.html'
      ),
      null
    );
  });

  test('routes a retired guide to the same page its redirect serves', () => {
    assert.equal(
      rewriteLink(
        'https://titaniumsdk.com/guide/Titanium_SDK/Titanium_SDK_How-tos/' +
          'Adhere_to_the_iOS17_Privacy_Requirements.html'
      ),
      '/docs/distribute/ios'
    );
    assert.equal(
      rewriteLink('https://titaniumsdk.com/guide/Alloy_Framework/Alloy_Guide/Alloy_PurgeTSS.html'),
      '/docs/alloy/styles'
    );
  });

  // The old site served a section index at its directory URL, and posts spell
  // that address all three ways.
  test('resolves a guide URL however the post spelled it', () => {
    const alloy = '/guide/Alloy_Framework/Alloy_Guide/Alloy_Views';
    assert.equal(rewriteLink(`https://titaniumsdk.com${alloy}/`), '/docs/alloy/views');
    assert.equal(rewriteLink(`https://titaniumsdk.com${alloy}`), '/docs/alloy/views');
  });

  // No successor in the approved IA, and the map says so rather than guessing.
  test('sends a guide tree with no successor to the docs index', () => {
    assert.equal(
      rewriteLink(
        'https://titaniumsdk.com/guide/Titanium_SDK/Titanium_SDK_Guide/' +
          'Titanium_and_Angular/Titanium_Angular_Basics.html'
      ),
      '/docs'
    );
  });

  test('makes a link that already resolves root-relative', () => {
    assert.equal(rewriteLink('https://titaniumsdk.com/blog/sdk-13-4-1-ga'), '/blog/sdk-13-4-1-ga');
    assert.equal(rewriteLink('/blog/sdk-13-4-1-ga'), null);
  });

  test('retires the downloads subdomain', () => {
    assert.equal(rewriteLink('https://downloads.titaniumsdk.com/'), '/downloads');
    // The host, not a prefix of one.
    assert.equal(rewriteLink('https://downloads.titaniumsdk.community/x'), null);
  });

  test('normalises both spellings of Slack onto one', () => {
    assert.equal(rewriteLink('https://slack.tidev.io/'), 'https://tidev.slack.com');
    assert.equal(rewriteLink('https://tidev.slack.com/'), 'https://tidev.slack.com');
    assert.equal(rewriteLink('https://tidev.slack.com'), null);
  });

  test('sends donations to the foundation', () => {
    assert.equal(rewriteLink('/donate'), 'https://tidev.io/donate');
  });

  test('maps an old tidev.io post path onto this blog', () => {
    assert.equal(rewriteLink('/posts/2025/sdk_13_0_0_ga.md'), '/blog/sdk-13-0-0-ga');
  });

  test('leaves everything else alone', () => {
    assert.equal(rewriteLink('https://github.com/tidev/titanium-sdk/issues'), null);
    assert.equal(rewriteLink('https://github.com/sponsors/tidev'), null);
    assert.equal(rewriteLink('#install'), null);
  });
});

describe('rewriteLinks', () => {
  test('rewrites link targets and leaves labels and images untouched', () => {
    const body =
      'See the [release notes](https://titaniumsdk.com/guide/Titanium_SDK/' +
      'Titanium_SDK_Release_Notes/Titanium_SDK_Release_Notes_13.x/' +
      'Titanium_SDK_13.4.1.GA_Release_Note.html) and ![shot](/blog/titanium-general.png).';

    assert.equal(
      rewriteLinks(body),
      'See the [release notes](/docs/sdk/13.4.1/release-notes) and ![shot](/blog/titanium-general.png).'
    );
  });

  test('leaves an image reference to the importer, host and all', () => {
    // `rewriteImage` returns the reference untouched when it cannot find the
    // asset. Stripping the host here would turn that into `/images/foo.png`,
    // which nothing serves and `validatePosts` - which reads anchors - would
    // not report.
    const body = '![shot](https://titaniumsdk.com/images/foo.png)';
    assert.equal(rewriteLinks(body), body);
  });

  test('is idempotent', () => {
    const body =
      'See the [release notes](https://titaniumsdk.com/guide/Titanium_SDK/' +
      'Titanium_SDK_Release_Notes/Titanium_SDK_Release_Notes_13.x/' +
      'Titanium_SDK_13.4.1.GA_Release_Note.html), [donate](/donate), ' +
      '[chat](https://slack.tidev.io/) and [this post](/posts/2025/sdk_13_0_0_ga.md).';

    const once = rewriteLinks(body);
    assert.equal(rewriteLinks(once), once);
  });
});
