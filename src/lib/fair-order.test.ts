import { fairOrder } from './fair-order.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * An order nobody can buy a position in.
 *
 * Shared by the developer directory (TI-58) and the app showcase (TI-54), so it
 * is tested here against plain entries rather than against either one's shape.
 *
 * Every case passes the day in rather than reading the clock, so none of this
 * changes answer depending on when it runs. That is the same discipline the
 * production code follows, for the same reason.
 */

/** One registry's seed. The value is arbitrary; sharing it across a run is not. */
const SEED = 5820;

const day = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe('fairOrder', () => {
  const people = ['aaa-titanium', 'bea', 'carlos', 'dana', 'evan'].map((id) => ({ id }));

  test('is deterministic for a given day, so two builds of one commit agree', () => {
    const first = fairOrder(people, day('2026-06-01'), SEED).map((p) => p.id);
    const second = fairOrder([...people].reverse(), day('2026-06-01'), SEED).map((p) => p.id);
    assert.deepEqual(first, second);
  });

  test('is not alphabetical, and does not reward a name chosen to sort first', () => {
    const alphabetical = people.map((p) => p.id).sort();
    // Over a full rotation the greedy id is first exactly once, like everyone
    // else. A single day could coincide with alphabetical order by chance, so
    // the claim is checked across the cycle rather than on one day.
    const firsts = Array.from({ length: people.length }, (_, i) =>
      fairOrder(people, new Date((20_000 + i) * 86_400_000), SEED).map((p) => p.id)
    );
    assert.equal(
      firsts.filter((order) => order[0] === 'aaa-titanium').length,
      1,
      'the alphabetically first id takes the top slot exactly once per cycle'
    );
    assert.ok(
      firsts.some((order) => order.join() !== alphabetical.join()),
      'the order is not simply alphabetical'
    );
  });

  test('every entry holds every position exactly once per cycle', () => {
    // The point of rotating rather than reshuffling: exactly fair, not fair in
    // expectation. With n entries, n consecutive days is one full rota.
    const seen = new Map<string, Set<number>>(people.map((p) => [p.id, new Set<number>()]));
    for (let i = 0; i < people.length; i++) {
      fairOrder(people, new Date((20_000 + i) * 86_400_000), SEED).forEach((p, position) => {
        seen.get(p.id)!.add(position);
      });
    }
    for (const [id, positions] of seen) {
      assert.equal(positions.size, people.length, `${id} did not visit every position`);
    }
  });

  test('the order advances once per day, not once per rebuild', () => {
    const morning = fairOrder(people, new Date('2026-06-01T01:00:00Z'), SEED).map((p) => p.id);
    const evening = fairOrder(people, new Date('2026-06-01T23:00:00Z'), SEED).map((p) => p.id);
    const tomorrow = fairOrder(people, new Date('2026-06-02T01:00:00Z'), SEED).map((p) => p.id);
    assert.deepEqual(morning, evening);
    assert.notDeepEqual(morning, tomorrow);
  });

  test('keeps every entry, and copes with none or one', () => {
    assert.equal(fairOrder(people, day('2026-06-01'), SEED).length, people.length);
    assert.deepEqual(fairOrder([], day('2026-06-01'), SEED), []);
    assert.deepEqual(
      fairOrder([people[0]], day('2026-06-01'), SEED).map((p) => p.id),
      ['aaa-titanium']
    );
  });
});
