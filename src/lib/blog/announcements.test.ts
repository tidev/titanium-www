import { hasReleaseNote } from '../docs/release-notes.ts';
import { announcedVersion, announcement } from './announcements.ts';
import { publishedPosts } from './posts.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

describe('announcedVersion', () => {
  test('reads the version out of a GA announcement slug', () => {
    assert.equal(announcedVersion('sdk-13-4-1-ga'), '13.4.1');
    assert.equal(announcedVersion('sdk-12-6-0-ga'), '12.6.0');
  });

  test('the one irregular slug is listed rather than guessed at', () => {
    // "TiDev, Inc. Releases Titanium SDK 11 GA, Titanium CLI 6.1.0".
    assert.equal(announcedVersion('sdk-11-ga'), '11.0.0');
  });

  test('a prerelease announcement resolves to nothing', () => {
    // 12.1.0.RC and 12.1.0.GA are different releases carrying one version, and
    // only the GA has a page. Falling through would say they were the same.
    assert.equal(announcedVersion('sdk-12-1-0-rc'), null);
    assert.equal(announcedVersion('sdk-12-3-0-rc-2'), null);
    assert.equal(announcedVersion('release-sdk-11'), null);
  });

  test('other software is not read as an SDK release', () => {
    assert.equal(announcedVersion('cli-7-0-0-ga'), null);
    assert.equal(announcedVersion('cli-8-0-0'), null);
    assert.equal(announcedVersion('alloy-2-1-0'), null);
    assert.equal(announcedVersion('hacktoberfest2022'), null);
  });
});

describe('the archive', () => {
  const announcements = publishedPosts().filter((p) => announcedVersion(p.slug));

  test('every GA announcement points at a release note that exists', () => {
    assert.ok(announcements.length >= 31, `only ${announcements.length} matched`);
    for (const post of announcements) {
      const version = announcedVersion(post.slug)!;
      assert.ok(hasReleaseNote(version), `${post.slug} claims ${version}, which has no note`);
    }
  });

  test('no two posts claim one release', () => {
    const seen = new Map<string, string>();
    for (const post of announcements) {
      const version = announcedVersion(post.slug)!;
      const other = seen.get(version);
      assert.equal(other, undefined, `${post.slug} and ${other} both claim ${version}`);
      seen.set(version, post.slug);
    }
  });

  test('the link is the same one in both directions', () => {
    for (const post of announcements) {
      const back = announcement(announcedVersion(post.slug)!);
      assert.equal(back?.slug, post.slug);
    }
  });

  test('a release with no announcement resolves to null rather than to a near miss', () => {
    // Notes go back to 8.0.0; the blog archive starts announcing at 11.0.0.
    assert.equal(announcement('8.0.0'), null);
    assert.equal(announcement('nonsense'), null);
  });
});
