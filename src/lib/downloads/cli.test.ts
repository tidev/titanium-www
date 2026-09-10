import { latestCli, type CliRelease } from './cli.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/**
 * Which CLI version the site tells people to install.
 *
 * The shape of the real file: 191 versions from npm, of which 46 were released
 * on GitHub and carry a date and a URL. Every case here is drawn from something
 * actually in it.
 */

const release = (version: string, published = true): CliRelease => ({
  version,
  node: '>=22.19.0',
  ...(published
    ? {
        date: '2026-08-22T15:44:18Z',
        url: `https://github.com/tidev/titanium-cli/releases/tag/v${version}`,
      }
    : {}),
});

describe('latestCli', () => {
  test('names the newest published stable release', () => {
    const found = latestCli([release('8.1.5'), release('9.0.0'), release('9.1.0')]);
    assert.equal(found?.version, '9.1.0');
    assert.equal(found?.url, 'https://github.com/tidev/titanium-cli/releases/tag/v9.1.0');
  });

  // `npm i -g titanium` does not install a prerelease, so naming one would tell
  // a reader to expect something the command will not give them.
  test('skips prereleases', () => {
    assert.equal(latestCli([release('9.0.0'), release('9.0.0-rc1')])?.version, '9.0.0');
  });

  // 145 of the 191 versions are npm-only - every 0.0.x and most of 3.x. They
  // have no release page to link to.
  test('skips a version that was never released on GitHub', () => {
    assert.equal(latestCli([release('9.0.0'), release('9.2.0', false)])?.version, '9.0.0');
  });

  // The file is written in semver order, but the rule must not depend on that:
  // 8.1.5 shipped after 9.0.0-rc1, so date order is not version order either.
  test('orders on the version rather than on position or date', () => {
    assert.equal(
      latestCli([release('9.1.0'), release('10.0.0'), release('9.2.0')])?.version,
      '10.0.0'
    );
  });

  test('an empty or unpublished registry has no answer', () => {
    assert.equal(latestCli([]), null);
    assert.equal(latestCli([release('9.1.0', false)]), null);
  });
});
