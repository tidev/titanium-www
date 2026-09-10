import { initials, isExpired, liveProfiles, matches, type Profile } from './profile.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The property the directory rests on: expiry. Ordering is shared with the app
 * showcase and tested in `../fair-order.test.ts`.
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
  specialties: ['alloy'],
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

describe('matches', () => {
  const all = { availability: 'all', specialty: 'all', kind: 'all', query: '' } as const;
  const person = profile('dana', {
    name: 'Dana Example',
    kind: 'agency',
    availability: ['part-time', 'contract'],
    specialties: ['alloy', 'ci-cd'],
    skills: ['Kotlin'],
    location: 'Lisbon, Portugal',
  });

  test('filters on availability, specialty and kind', () => {
    assert.equal(matches(person, { ...all, availability: 'contract' }), true);
    assert.equal(matches(person, { ...all, availability: 'full-time' }), false);
    assert.equal(matches(person, { ...all, specialty: 'ci-cd' }), true);
    assert.equal(matches(person, { ...all, specialty: 'security' }), false);
    assert.equal(matches(person, { ...all, kind: 'agency' }), true);
    assert.equal(matches(person, { ...all, kind: 'individual' }), false);
  });

  test('the text box reads name, summary, location, skills and specialty labels', () => {
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
