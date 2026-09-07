import { excludedBecause, type Candidate } from './community-filter.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The mechanical half of the curation policy (TI-23).
 *
 * These rules run only inside a scrape that needs a GitHub token, so without
 * this they would ship unexercised. `docs/module-curation.md` is what they
 * implement.
 */

const repo = (full_name: string, extra: Partial<Candidate> = {}): Candidate => ({
  full_name,
  archived: false,
  fork: false,
  ...extra,
});

const none = new Set<string>();

describe('what reaches the community list', () => {
  test('an ordinary repo is listed', () => {
    assert.equal(excludedBecause(repo('someone/ti.thing'), none, none), null);
  });

  test('an archived repo is dropped', () => {
    // The author has said it is finished; listing it as something to reach for
    // is the listing being wrong rather than the module being bad.
    assert.equal(excludedBecause(repo('someone/old', { archived: true }), none, none), 'archived');
  });

  test('a fork is dropped', () => {
    assert.equal(excludedBecause(repo('someone/ti.map', { fork: true }), none, none), 'fork');
  });

  test('a curated repo is dropped, so nothing is listed twice', () => {
    const curated = new Set(['tidev/ti.map']);
    assert.equal(excludedBecause(repo('tidev/ti.map'), curated, none), 'curated');
  });

  test('a blocked repo is dropped', () => {
    const blocked = new Set(['someone/squatted']);
    assert.equal(excludedBecause(repo('someone/squatted'), none, blocked), 'blocked');
  });
});

describe('the rules in combination', () => {
  test('matching is case-insensitive, because GitHub slugs are', () => {
    // The lists are hand-written and a person will not match GitHub's casing.
    const curated = new Set(['tidev/ti.map']);
    assert.equal(excludedBecause(repo('TiDev/Ti.Map'), curated, none), 'curated');
  });

  test('curated beats every other reason', () => {
    // A TiDev repo that is also archived should read as curated: that is why it
    // has no business in this list, and the count should say so.
    const curated = new Set(['tidev/ti.map']);
    const both = repo('tidev/ti.map', { archived: true, fork: true });
    assert.equal(excludedBecause(both, curated, none), 'curated');
  });

  test('blocked beats archived, so a deliberate exclusion is reported as one', () => {
    const blocked = new Set(['someone/thing']);
    const both = repo('someone/thing', { archived: true });
    assert.equal(excludedBecause(both, none, blocked), 'blocked');
  });

  test('a fork of a blocked repo is reported as blocked', () => {
    const blocked = new Set(['someone/thing']);
    assert.equal(excludedBecause(repo('someone/thing', { fork: true }), none, blocked), 'blocked');
  });
});
