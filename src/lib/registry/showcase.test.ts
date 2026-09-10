import { appTemplate, ShowcaseAppSchema } from './showcase.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * The rules the showcase schema exists to enforce, pinned.
 *
 * Two of them are about what a link promises. The page draws a button labelled
 * "App Store", and a reader taps it believing that is where they are going; the
 * host check is the only thing that makes the label true. The email rules are
 * the directory's, shared through `./fields.ts` and tested here as well because
 * they apply to a different set of fields.
 */

const valid = {
  schemaVersion: 1,
  id: 'field-report',
  name: 'Field Report',
  platforms: ['iphone'],
  sdkVersion: '12.7.0.GA',
  description: 'Offline site inspections.',
  website: 'https://example.com/field-report',
};

/** `valid`, minus the one link it carries, for the "can this be checked" cases. */
const { website: _website, ...linkless } = valid;

const accept = (over: Record<string, unknown>, why: string) => {
  const result = ShowcaseAppSchema.safeParse({ ...valid, ...over });
  assert.equal(result.success, true, `${why}: ${result.error?.issues[0]?.message}`);
};

const reject = (over: Record<string, unknown>, why: string) => {
  assert.equal(ShowcaseAppSchema.safeParse({ ...valid, ...over }).success, false, why);
};

describe('a store link goes to that store', () => {
  test('the real stores are accepted', () => {
    accept({ appStore: 'https://apps.apple.com/gb/app/thing/id123456789' }, 'apps.apple.com');
    accept({ appStore: 'https://itunes.apple.com/app/id123456789' }, 'the legacy itunes host');
    accept({ playStore: 'https://play.google.com/store/apps/details?id=com.example' }, 'play');
  });

  test('a store link pointing anywhere else is refused', () => {
    // The abuse this exists to stop: a labelled store button that sends a
    // reader somewhere they did not agree to go.
    reject({ appStore: 'https://example.com/our-app' }, 'appStore off the App Store');
    reject({ playStore: 'https://example.com/our-app' }, 'playStore off Google Play');
  });

  test('a lookalike host does not pass on a suffix match', () => {
    reject({ appStore: 'https://apps.apple.com.example.net/app/id1' }, 'suffix lookalike');
    reject({ playStore: 'https://play.google.com.evil.test/store' }, 'suffix lookalike');
  });

  test('a subdomain of the store is not the store', () => {
    reject({ appStore: 'https://beta.apps.apple.com/app/id1' }, 'subdomain');
  });

  test('the scheme rules still apply to a store field', () => {
    reject({ appStore: 'javascript:alert(1)' }, 'javascript: url');
    reject({ appStore: 'not a url at all' }, 'unparseable, and it must not throw');
  });
});

describe('an entry can be checked', () => {
  test('at least one of the three links is required', () => {
    assert.equal(ShowcaseAppSchema.safeParse(linkless).success, false, 'no link at all');
  });

  test('any one of the three is enough', () => {
    for (const link of [
      { website: 'https://example.com' },
      { appStore: 'https://apps.apple.com/app/id1' },
      { playStore: 'https://play.google.com/store/apps/details?id=a' },
    ]) {
      const result = ShowcaseAppSchema.safeParse({ ...linkless, ...link });
      assert.equal(result.success, true, Object.keys(link)[0]);
    }
  });
});

describe('an id cannot shadow a page', () => {
  test('"submit" is refused, because /showcase/submit is a page on this site', () => {
    reject({ id: 'submit' }, 'the reserved segment');
  });

  test('ids that merely contain it are fine', () => {
    accept({ id: 'submit-it' }, 'a longer id starting with the reserved word');
  });
});

describe('no published email addresses', () => {
  test('an address in prose is rejected wherever it is written', () => {
    reject({ name: 'Field Report support@example.com' }, 'address in the name');
    reject({ subtitle: 'Write to us at hi@example.com' }, 'address in the subtitle');
    reject({ description: 'Support: hi@example.com' }, 'address in the description');
  });

  test('an address smuggled into a URL is rejected', () => {
    reject({ website: 'https://example.com/?to=hi@example.com' }, 'address in a query string');
  });

  test('a mailto: website is rejected', () => {
    // `z.url()` accepts this on its own: it parses with `new URL()`, which is
    // perfectly happy with a mailto:.
    reject({ website: 'mailto:hi@example.com' }, 'mailto website');
  });
});

describe('the SDK version is a version', () => {
  test('the spellings the SDK itself uses are taken', () => {
    for (const sdkVersion of ['12.7.0', '12.7.0.GA', '13.0.0.RC', '9.3.2.Beta', '3.5.1.GA']) {
      accept({ sdkVersion }, sdkVersion);
    }
  });

  test('a range is not a version', () => {
    reject({ sdkVersion: '12.x' }, 'a major with a wildcard');
    reject({ sdkVersion: '12.7' }, 'a bare major.minor');
    reject({ sdkVersion: 'latest' }, 'a channel name');
  });
});

describe('the shape', () => {
  test('an unrecognised key fails review rather than being carried', () => {
    reject({ screenshots: ['a.png'] }, 'a field somebody hoped would be published');
    reject({ expiresAt: '2026-12-01' }, 'a field borrowed from the directory');
  });

  test('at least one platform, and no more than the four that exist', () => {
    reject({ platforms: [] }, 'no platform');
    reject({ platforms: ['windows'] }, 'a platform that is not in the vocabulary');
    accept(
      { platforms: ['iphone', 'ipad', 'android-phone', 'android-tablet'] },
      'all four form factors'
    );
  });

  test('placeholder defaults to false, so a real entry cannot be one by omission', () => {
    const parsed = ShowcaseAppSchema.parse(valid);
    assert.equal(parsed.placeholder, false);
  });
});

describe('the template shown to submitters', () => {
  test('is a valid entry', () => {
    const result = ShowcaseAppSchema.safeParse(appTemplate);
    assert.equal(result.success, true, `the template is not a valid entry: ${result.error?.issues[0]?.message}`);
  });

  test('its store links are on the stores, which is the rule it is teaching', () => {
    assert.match(appTemplate.appStore ?? '', /^https:\/\/apps\.apple\.com\//);
    assert.match(appTemplate.playStore ?? '', /^https:\/\/play\.google\.com\//);
  });

  test('is not marked as a worked example', () => {
    assert.equal(appTemplate.placeholder, false);
  });
});
