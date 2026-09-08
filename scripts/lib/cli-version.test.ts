import { highestCliVersion } from './cli-version.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

const decl = (v: string) => `export const cliVersion = '${v}';\nexport function run() {}\n`;

describe('highestCliVersion', () => {
  test('reads the modern export form', () => {
    assert.equal(highestCliVersion([decl('>=9.1.0')]), '>=9.1.0');
  });

  test('reads the older CommonJS form', () => {
    assert.equal(highestCliVersion(['exports.cliVersion = ">=3.2.1";']), '>=3.2.1');
    assert.equal(highestCliVersion(['module.exports.cliVersion = ">=3.2.1";']), '>=3.2.1');
  });

  // The case this exists for. All four commands agree in every release captured
  // so far, so a disagreement means something upstream has gone wrong, and the
  // release is unusable below its strictest command whatever the others say.
  test('takes the highest when the commands disagree, not the first', () => {
    assert.equal(
      highestCliVersion([decl('>=3.2.1'), decl('>=9.1.0'), decl('>=5.0.0'), decl('>=3.2.1')]),
      '>=9.1.0'
    );
    assert.equal(highestCliVersion([decl('>=9.1.0'), decl('>=3.2.1')]), '>=9.1.0');
  });

  test('orders on each part, not on the string', () => {
    // '>=10.0.0' sorts before '>=9.1.0' as text and after it as a version.
    assert.equal(highestCliVersion([decl('>=9.1.0'), decl('>=10.0.0')]), '>=10.0.0');
    assert.equal(highestCliVersion([decl('>=3.2.1'), decl('>=3.10.0')]), '>=3.10.0');
    assert.equal(highestCliVersion([decl('>=3.2.1'), decl('>=3.2.10')]), '>=3.2.10');
  });

  test('returns the range exactly as authored', () => {
    assert.equal(highestCliVersion([decl('>=3.2.1 <5')]), '>=3.2.1 <5');
  });

  test('a command the release does not carry is skipped, not counted as zero', () => {
    assert.equal(highestCliVersion([null, decl('>=9.1.0'), null]), '>=9.1.0');
  });

  test('no declaration anywhere reads as absent', () => {
    assert.equal(highestCliVersion([null, null]), undefined);
    assert.equal(highestCliVersion(['export function run() {}']), undefined);
  });
});
