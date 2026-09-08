import {
  daysRemaining,
  fairOrder,
  initials,
  isExpired,
  liveProfiles,
  matches,
  type Profile,
} from './profile.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The two properties the directory rests on: expiry, and an order nobody can
 * buy a position in.
 *
 * Every case passes the day in rather than reading the clock, so none of this
 * changes answer depending on when it runs. That is the same discipline the
 * production code follows, for the same reason.
 */

const profile = (id: string, over: Partial<Profile> = {}): Profile => ({
  schemaVersion: 1,
  id,
  name: id,
  kind: 'individual',
  summary: `${id} builds Titanium apps`,
  location: 'Remote',
  timezone: 'UTC',
  availability: ['contract'],
  specialisms: ['alloy'],
  skills: [],
  contact: { label: 'Contact', url: 'https://example.com/contact' },
  links: [],
  expiresAt: '2026-12-01',
  neverExpires: false,
  placeholder: false,
  ...over,
});

const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

describe('expiry', () => {
  test('a listing stands on the day it names, and is gone the next', () => {
    const p = profile('a', { expiresAt: '2026-06-30' });
    assert.equal(isExpired(p, day('2026-06-29')), false);
    assert.equal(isExpired(p, day('2026-06-30')), false);
    assert.equal(isExpired(p, day('2026-07-01')), true);
  });

  test('the time of day does not move the boundary', () => {
    const p = profile('a', { expiresAt: '2026-06-30' });
    assert.equal(isExpired(p, new Date('2026-06-30T23:59:59Z')), false);
    assert.equal(isExpired(p, new Date('2026-07-01T00:00:01Z')), true);
  });

  test('neverExpires opts out', () => {
    const p = profile('a', { expiresAt: undefined, neverExpires: true });
    assert.equal(isExpired(p, day('2099-01-01')), false);
    assert.equal(daysRemaining(p, day('2026-01-01')), null);
  });

  test('days remaining counts down and then goes negative', () => {
    const p = profile('a', { expiresAt: '2026-06-30' });
    assert.equal(daysRemaining(p, day('2026-06-20')), 10);
    assert.equal(daysRemaining(p, day('2026-06-30')), 0);
    assert.equal(daysRemaining(p, day('2026-07-05')), -5);
  });

  test('a listing with neither date is treated as expired, not as immortal', () => {
    // Unreachable through the schema, which requires one of the two. Pinned
    // because it is the safe direction to be wrong in if that ever loosens.
    const p = profile('a', { expiresAt: undefined, neverExpires: false });
    assert.equal(isExpired(p, day('2026-01-01')), true);
  });
});

describe('liveProfiles', () => {
  const live = profile('live', { expiresAt: '2026-12-01' });
  const dead = profile('dead', { expiresAt: '2020-01-01' });
  const example = profile('example', {
    expiresAt: undefined,
    neverExpires: true,
    placeholder: true,
  });

  test('drops expired listings', () => {
    const shown = liveProfiles([live, dead], day('2026-06-01'));
    assert.deepEqual(
      shown.map((p) => p.id),
      ['live']
    );
  });

  test('shows the worked examples only while nothing real is listed', () => {
    assert.deepEqual(
      liveProfiles([example], day('2026-06-01')).map((p) => p.id),
      ['example']
    );
    // The first real listing removes them, with no follow-up pull request.
    assert.deepEqual(
      liveProfiles([example, live], day('2026-06-01')).map((p) => p.id),
      ['live']
    );
  });

  test('an expired real listing does not keep the examples hidden', () => {
    assert.deepEqual(
      liveProfiles([example, dead], day('2026-06-01')).map((p) => p.id),
      ['example']
    );
  });
});

describe('fairOrder', () => {
  const people = ['aaa-titanium', 'bea', 'carlos', 'dana', 'evan'].map((id) => profile(id));

  test('is deterministic for a given day, so two builds of one commit agree', () => {
    const first = fairOrder(people, day('2026-06-01')).map((p) => p.id);
    const second = fairOrder([...people].reverse(), day('2026-06-01')).map((p) => p.id);
    assert.deepEqual(first, second);
  });

  test('is not alphabetical, and does not reward a name chosen to sort first', () => {
    const alphabetical = people.map((p) => p.id).sort();
    // Over a full rotation the greedy id is first exactly once, like everyone
    // else. A single day could coincide with alphabetical order by chance, so
    // the claim is checked across the cycle rather than on one day.
    const firsts = Array.from({ length: people.length }, (_, i) =>
      fairOrder(people, new Date((20_000 + i) * 86_400_000)).map((p) => p.id)
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

  test('every listing holds every position exactly once per cycle', () => {
    // The point of rotating rather than reshuffling: exactly fair, not fair in
    // expectation. With n listings, n consecutive days is one full rota.
    const seen = new Map<string, Set<number>>(people.map((p) => [p.id, new Set<number>()]));
    for (let i = 0; i < people.length; i++) {
      fairOrder(people, new Date((20_000 + i) * 86_400_000)).forEach((p, position) => {
        seen.get(p.id)!.add(position);
      });
    }
    for (const [id, positions] of seen) {
      assert.equal(positions.size, people.length, `${id} did not visit every position`);
    }
  });

  test('the order advances once per day, not once per rebuild', () => {
    const morning = fairOrder(people, new Date('2026-06-01T01:00:00Z')).map((p) => p.id);
    const evening = fairOrder(people, new Date('2026-06-01T23:00:00Z')).map((p) => p.id);
    const tomorrow = fairOrder(people, new Date('2026-06-02T01:00:00Z')).map((p) => p.id);
    assert.deepEqual(morning, evening);
    assert.notDeepEqual(morning, tomorrow);
  });

  test('keeps every listing, and copes with none or one', () => {
    assert.equal(fairOrder(people, day('2026-06-01')).length, people.length);
    assert.deepEqual(fairOrder([], day('2026-06-01')), []);
    assert.deepEqual(
      fairOrder([people[0]], day('2026-06-01')).map((p) => p.id),
      ['aaa-titanium']
    );
  });
});

describe('matches', () => {
  const all = { availability: 'all', specialism: 'all', kind: 'all', query: '' } as const;
  const person = profile('dana', {
    name: 'Dana Example',
    kind: 'agency',
    availability: ['part-time', 'contract'],
    specialisms: ['alloy', 'ci-cd'],
    skills: ['Kotlin'],
    location: 'Lisbon, Portugal',
  });

  test('filters on availability, specialism and kind', () => {
    assert.equal(matches(person, { ...all, availability: 'contract' }), true);
    assert.equal(matches(person, { ...all, availability: 'full-time' }), false);
    assert.equal(matches(person, { ...all, specialism: 'ci-cd' }), true);
    assert.equal(matches(person, { ...all, specialism: 'security' }), false);
    assert.equal(matches(person, { ...all, kind: 'agency' }), true);
    assert.equal(matches(person, { ...all, kind: 'individual' }), false);
  });

  test('the text box reads name, summary, location, skills and specialism labels', () => {
    assert.equal(matches(person, { ...all, query: 'lisbon' }), true);
    assert.equal(matches(person, { ...all, query: 'kotlin' }), true);
    assert.equal(matches(person, { ...all, query: 'release automation' }), true);
    assert.equal(matches(person, { ...all, query: 'swift' }), false);
  });
});

describe('initials', () => {
  test('the first letter of the first two words', () => {
    assert.equal(initials('Example Agency'), 'EA');
    assert.equal(initials('Ada Lovelace Consulting'), 'AL');
  });

  test('a one-word name gets one letter', () => {
    assert.equal(initials('Titanium'), 'T');
  });

  test('stray whitespace does not become a blank initial', () => {
    assert.equal(initials('  grace   hopper  '), 'GH');
  });

  test('a name outside the Latin alphabet keeps its own characters', () => {
    // Transliterating somebody's name to fill a box would be worse than
    // showing the name's own first characters. This is drawn, never announced.
    assert.equal(initials('東京 開発'), '東開');
  });

  test('an astral first character is not cut in half', () => {
    // Split by code point, not code unit: name[0] on an emoji or an extended
    // plane character yields half a surrogate pair and renders as a box.
    assert.equal(initials('𝒜da Lovelace'), '𝒜L');
  });
});
