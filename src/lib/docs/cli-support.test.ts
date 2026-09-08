import { minimumCli, nodeFloor } from './cli-support.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

/** The shape of the real history, which is what makes these cases meaningful. */
const RELEASES = [
  { version: '5.4.1', node: '>=10.13' },
  { version: '6.0.0', node: '>=14.15' },
  { version: '6.1.1', node: '>=14.15' },
  { version: '7.0.0', node: '>=18' },
  { version: '7.1.7', node: '>=18' },
  { version: '8.0.0', node: '>=20.18.1' },
  { version: '8.1.5', node: '>=20.18.1' },
  { version: '9.0.0', node: '>=22.19.0' },
  { version: '9.1.0', node: '>=22.19.0' },
];

describe('nodeFloor', () => {
  test('reads the floor of a simple range', () => {
    assert.equal(nodeFloor('>=20.18.1'), '20.18.1');
    assert.equal(nodeFloor('>=18'), '18.0.0');
  });

  test('a union admits its lowest branch', () => {
    assert.equal(nodeFloor('16.x || 18.x || 20.x'), '16.0.0');
  });

  test('no range reads as no floor', () => {
    assert.equal(nodeFloor(undefined), null);
    assert.equal(nodeFloor('*'), null);
  });
});

describe('minimumCli', () => {
  // The case that prompted this. The commands ask only for >=3.2.1, but a CLI
  // that starts on Node 18 would build an SDK that needs 20.18.1 and fail late.
  test('the Node floor raises the answer above what the commands ask', () => {
    assert.equal(minimumCli({ node: '>=20.18.1', cli: '>=3.2.1' }, RELEASES), '>=8.0.0');
  });

  test('the commands win when they ask for more than Node implies', () => {
    // Node >=22.19.0 reaches 9.0.0; the commands demand 9.1.0.
    assert.equal(minimumCli({ node: '>=22.19.0', cli: '>=9.1.0' }, RELEASES), '>=9.1.0');
  });

  // 12.x. Floors are compared, so the bounded union resolves on its 16.
  test('a bounded SDK range resolves on its lowest branch', () => {
    assert.equal(minimumCli({ node: '16.x || 18.x || 20.x', cli: '>=3.2.1' }, RELEASES), '>=7.0.0');
  });

  test('the oldest qualifying release wins, not the newest', () => {
    assert.equal(minimumCli({ node: '>=20.18.1', cli: undefined }, RELEASES), '>=8.0.0');
  });

  test('an SDK declaring no Node falls back to the commands', () => {
    assert.equal(minimumCli({ node: undefined, cli: '>=3.2.1' }, RELEASES), '>=3.2.1');
  });

  test('nothing to go on reads as absent', () => {
    assert.equal(minimumCli({ node: undefined, cli: undefined }, RELEASES), undefined);
    assert.equal(minimumCli({ node: '>=20.18.1', cli: undefined }, []), undefined);
  });

  // Naming a prerelease would tell a reader to install something `npm i
  // titanium` does not give them.
  test('prereleases are not offered as the minimum', () => {
    const withPre = [{ version: '8.0.0-beta.1', node: '>=20.18.1' }, ...RELEASES];
    assert.equal(minimumCli({ node: '>=20.18.1', cli: undefined }, withPre), '>=8.0.0');
  });

  test('a CLI release declaring no engines cannot satisfy the rule', () => {
    assert.equal(
      minimumCli({ node: '>=20.18.1', cli: undefined }, [{ version: '8.0.0' }]),
      undefined
    );
  });
});
