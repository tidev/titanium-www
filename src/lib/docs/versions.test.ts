import { indexedVersions, INDEXED_LINES } from './versions.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * Which pinned versions of the reference are offered to search engines.
 *
 * Driven by a list rather than by `registry/`, because the point of the rule is
 * what it does as releases accumulate, and a test reading the twenty directories
 * on disk would only assert today's answer and fail on the next compile.
 */

describe('indexedVersions', () => {
  test('keeps the newest release of each of the most recent lines', () => {
    assert.deepEqual(
      indexedVersions([
        '13.4.1',
        '13.4.0',
        '13.3.1',
        '13.3.0',
        '13.2.0',
        '13.1.1',
        '13.0.0',
        'main',
      ]),
      ['13.4.1', '13.3.1', '13.2.0']
    );
  });

  test('counts lines, not releases', () => {
    // Four patches on one line must not push the other lines out. This is the
    // whole reason the cutoff is not "the newest N versions".
    assert.deepEqual(
      indexedVersions(['12.6.4', '12.6.3', '12.6.2', '12.6.1', '12.5.1', '12.4.0']),
      ['12.6.4', '12.5.1', '12.4.0']
    );
  });

  test('never offers main', () => {
    // Recompiled whenever the branch moves, so anything indexed from it
    // describes a tree that no longer exists.
    assert.deepEqual(indexedVersions(['main']), []);
    assert.equal(indexedVersions(['13.4.1', 'main']).includes('main'), false);
  });

  test('takes what there is when there are fewer lines than the cutoff', () => {
    assert.equal(indexedVersions(['13.4.1', '13.4.0']).length, 1);
    assert.equal(indexedVersions([]).length, 0);
    assert.equal(INDEXED_LINES > 0, true);
  });
});
