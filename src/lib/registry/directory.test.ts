import { DeveloperProfileSchema, expiryProblem, LISTING_DAYS } from './directory.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The rules the directory schema exists to enforce, pinned.
 *
 * These are not shape checks for their own sake. Publishing an email address is
 * a cost the listee pays and cannot undo, and an unbounded expiry date is a
 * listing that never has to prove anyone is still available. Both are one
 * careless review away, so both are tested.
 */

const valid = {
  schemaVersion: 1,
  id: 'jo-example',
  name: 'Jo Example',
  kind: 'individual',
  summary: 'Titanium contractor',
  location: 'Remote',
  timezone: 'Europe/Berlin',
  availability: ['contract'],
  specialisms: ['alloy'],
  contact: { label: 'Contact', url: 'https://example.com/contact' },
  expiresAt: '2026-06-30',
};

const reject = (over: Record<string, unknown>, why: string) => {
  const result = DeveloperProfileSchema.safeParse({ ...valid, ...over });
  assert.equal(result.success, false, why);
};

describe('no published email addresses', () => {
  test('a mailto: contact is rejected', () => {
    // `z.url()` accepts this on its own: it parses with `new URL()`, which is
    // perfectly happy with a mailto:. Verified against the installed zod.
    reject({ contact: { label: 'Email', url: 'mailto:jo@example.com' } }, 'mailto contact');
  });

  test('other schemes are rejected too', () => {
    reject({ contact: { label: 'Call', url: 'tel:+15550100' } }, 'tel contact');
    reject({ contact: { label: 'Hi', url: 'javascript:alert(1)' } }, 'javascript contact');
  });

  test('an address smuggled into a URL is rejected', () => {
    reject(
      { contact: { label: 'Contact', url: 'https://example.com/?to=jo@example.com' } },
      'address in a query string'
    );
  });

  test('an address smuggled into prose is rejected', () => {
    reject({ summary: 'Reach me at jo@example.com' }, 'address in the summary');
    reject({ name: 'Jo Example jo@example.com' }, 'address in the name');
    reject({ location: 'Berlin (jo@example.com)' }, 'address in the location');
    reject({ links: [{ label: 'jo@example.com', url: 'https://example.com' }] }, 'address in a label');
  });

  test('an ordinary https contact is accepted', () => {
    assert.equal(DeveloperProfileSchema.safeParse(valid).success, true);
  });
});

describe('expiry', () => {
  test('exactly one of expiresAt and neverExpires', () => {
    reject({ expiresAt: undefined, neverExpires: undefined }, 'neither');
    reject({ expiresAt: '2026-06-30', neverExpires: true }, 'both');
    assert.equal(
      DeveloperProfileSchema.safeParse({ ...valid, expiresAt: undefined, neverExpires: true })
        .success,
      true
    );
  });

  test('the cap only ever complains about dates too far ahead', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    const parse = (expiresAt: string) =>
      DeveloperProfileSchema.parse({ ...valid, expiresAt });

    assert.equal(expiryProblem(parse('2026-03-01'), now), null, 'inside the window');
    assert.notEqual(expiryProblem(parse('2030-01-01'), now), null, 'years out');

    // The one-directional part, and the reason this check is safe to run in CI
    // on old commits: a date in the past is not a failure. Expiry is the
    // mechanism working, and it must never turn an unrelated pull request red.
    assert.equal(expiryProblem(parse('2020-01-01'), now), null, 'already expired');

    // The boundary, stated in terms of the constant rather than a copied date.
    const edge = new Date(now.getTime() + LISTING_DAYS * 86_400_000).toISOString().slice(0, 10);
    assert.equal(expiryProblem(parse(edge), now), null, 'the last allowed day');
  });

  test('neverExpires has nothing to cap', () => {
    const forever = DeveloperProfileSchema.parse({
      ...valid,
      expiresAt: undefined,
      neverExpires: true,
    });
    assert.equal(expiryProblem(forever, new Date('2026-01-01T00:00:00Z')), null);
  });
});

describe('the rest of the shape', () => {
  test('the id is a slug, because it is also the URL', () => {
    reject({ id: 'Jo Example' }, 'spaces and capitals');
    reject({ id: '../etc' }, 'path traversal');
  });

  test('an unknown key fails rather than being carried', () => {
    // Strict, unlike the loose module shapes. A key nobody reads here is either
    // a typo that silently does nothing or a field somebody hoped would be
    // published, and the email rules only cover fields the schema knows about.
    reject({ email: 'jo@example.com' }, 'unknown key');
  });

  test('the time zone has to be one a runtime can resolve', () => {
    reject({ timezone: 'Europe/Atlantis' }, 'invented zone');
    reject({ timezone: 'GMT+1' }, 'an offset, not a zone');
    reject({ timezone: '+01:00' }, 'a bare offset');
  });

  test('UTC and alias zones are accepted', () => {
    // `Intl.supportedValuesOf('timeZone')` rejects all three: it returns
    // canonical primary zones only. They resolve fine and mean exactly what
    // the listee intended, so the schema asks DateTimeFormat instead. Pinned
    // because switching back to the list that sounds correct would silently
    // start rejecting real submissions.
    for (const timezone of ['UTC', 'Asia/Calcutta', 'Europe/Kiev']) {
      assert.equal(
        DeveloperProfileSchema.safeParse({ ...valid, timezone }).success,
        true,
        `${timezone} should be accepted`
      );
    }
  });

  test('availability and specialisms come from the closed vocabularies', () => {
    reject({ availability: [] }, 'no availability');
    reject({ availability: ['weekends'] }, 'invented availability');
    reject({ specialisms: ['titanium titanium titanium'] }, 'invented specialism');
  });
});
