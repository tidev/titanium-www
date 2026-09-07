import { blockedByRobots, blogPosting, breadcrumbList } from './seo.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The rules that are easy to get wrong quietly.
 *
 * A robots.txt that blocks one path too many, or structured data that names a
 * relative URL, both look fine in review and cost traffic for months. These pin
 * the cases the reasoning in `seo.ts` actually turns on.
 */

describe('blockedByRobots', () => {
  test('blocks the JSON API', () => {
    assert.equal(blockedByRobots('/registry/v1/modules'), true);
    assert.equal(blockedByRobots('/registry/modules.json'), true);
  });

  test('leaves the page documenting the API crawlable', () => {
    // The whole reason DISALLOW carries a trailing slash. Without it this is
    // blocked and the page disappears from search along with the JSON.
    assert.equal(blockedByRobots('/registry'), false);
  });

  test('leaves the agent-readable output alone', () => {
    // TI-57 owns these files. This owns the promise that nothing blocks them.
    for (const path of ['/llms.txt', '/llms-full.txt', '/docs/setup/macos.md']) {
      assert.equal(blockedByRobots(path), false, path);
    }
  });
});

describe('breadcrumbList', () => {
  test('numbers from one and makes every href absolute', () => {
    const data = breadcrumbList([
      { label: 'Docs', href: '/docs' },
      { label: 'Getting Started', href: '/docs/setup' },
      { label: 'macOS' },
    ]) as { itemListElement: { position: number; name: string; item?: string }[] };

    assert.deepEqual(
      data.itemListElement.map((item) => [item.position, item.name, item.item]),
      [
        [1, 'Docs', 'https://titaniumsdk.com/docs'],
        [2, 'Getting Started', 'https://titaniumsdk.com/docs/setup'],
        // The current page. A last item with no `item` is what the schema
        // expects, and it is the shape the component already renders.
        [3, 'macOS', undefined],
      ]
    );
  });

  test('drops an empty href rather than pointing at the site root', () => {
    // The SDK reference builds crumb hrefs as `name && ...`, which is '' for a
    // namespace with no page of its own.
    const data = breadcrumbList([{ label: 'Titanium', href: '' }]) as {
      itemListElement: { item?: string }[];
    };
    assert.equal('item' in data.itemListElement[0], false);
  });
});

describe('blogPosting', () => {
  const post = {
    slug: 'titanium-13-4-1',
    title: 'Titanium SDK 13.4.1',
    description: 'A patch release.',
    date: '2026-08-01',
    authors: ['Ada Lovelace', 'Grace Hopper'],
  };

  test('names every author and the post itself', () => {
    const data = blogPosting(post) as {
      author: { name: string }[];
      mainEntityOfPage: string;
      image?: string;
    };
    assert.deepEqual(
      data.author.map((a) => a.name),
      ['Ada Lovelace', 'Grace Hopper']
    );
    assert.equal(data.mainEntityOfPage, 'https://titaniumsdk.com/blog/titanium-13-4-1');
    // No cover, so no image. An empty one would be a broken URL in the markup.
    assert.equal('image' in data, false);
  });

  test('absolutises a cover image', () => {
    const data = blogPosting({ ...post, cover: '/blog/cover.png' }) as { image: string };
    assert.equal(data.image, 'https://titaniumsdk.com/blog/cover.png');
  });
});
