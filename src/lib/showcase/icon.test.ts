import { ICON_MAX_BYTES, iconsByApp, readIcons } from './icon.ts';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

/**
 * What may be published beside a showcase entry.
 *
 * The format and size rules are shared with the directory and covered by
 * `../directory/avatar.test.ts`; what is tested here is the part that differs.
 * An icon is required rather than optional, and a committed screenshot has to
 * be refused with the reason rather than as an unexplained orphan - that
 * message is the whole reason somebody does not open an issue asking where
 * their screenshots went.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const dirs: string[] = [];

/** A throwaway directory holding the given files. */
function folder(files: Record<string, Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'showcase-icons-'));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

const problemsIn = (dir: string, ids: string[]) => readIcons(dir, ids).problems.join('\n');

describe('an icon is required', () => {
  test('an entry with one is found', () => {
    const dir = folder({ 'harbour.png': PNG, 'harbour.json': Buffer.from('{}') });
    const { icons, problems } = readIcons(dir, ['harbour']);
    assert.deepEqual(problems, []);
    assert.deepEqual([...icons], [['harbour', 'harbour.png']]);
  });

  test('an entry without one fails, and the message says what to commit', () => {
    const problems = problemsIn(folder({ 'harbour.json': Buffer.from('{}') }), ['harbour']);
    assert.match(problems, /harbour\.json: every app needs an icon/);
    assert.match(problems, /"harbour\.png"/);
  });

  test('a rejected file is reported before the gap it causes', () => {
    // The pair is the useful reading: the .svg line explains the missing icon
    // on the line under it.
    const problems = readIcons(folder({ 'harbour.svg': Buffer.alloc(8) }), ['harbour']).problems;
    assert.equal(problems.length, 2);
    assert.match(problems[0], /\.svg is not published here/);
    assert.match(problems[1], /every app needs an icon/);
  });

  test('an empty showcase has nothing missing', () => {
    assert.deepEqual(readIcons(folder({}), []).problems, []);
  });
});

describe('screenshots say why rather than reading as orphans', () => {
  test('a numbered file beside an entry that exists is named as a screenshot', () => {
    const dir = folder({ 'harbour.png': PNG, 'harbour-1.png': PNG });
    const problems = problemsIn(dir, ['harbour']);
    assert.match(problems, /harbour-1\.png: screenshots are not published yet/);
    assert.match(problems, /docs\/app-showcase\.md/);
  });

  test('a numbered file belonging to nothing is still a plain orphan', () => {
    // Nothing called `ghost` exists, so this is a misnamed file rather than
    // somebody adding screenshots, and guessing otherwise would misdirect them.
    const problems = problemsIn(folder({ 'ghost-1.png': PNG }), ['harbour']);
    assert.match(problems, /no app called "ghost-1"/);
  });

  test('an ordinary orphan is unaffected', () => {
    const problems = problemsIn(folder({ 'harbour.png': PNG, 'stray.png': PNG }), ['harbour']);
    assert.match(problems, /no app called "stray"/);
  });
});

describe('the shared rules still apply', () => {
  test('over the cap is refused', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(ICON_MAX_BYTES)]);
    assert.match(problemsIn(folder({ 'harbour.png': big }), ['harbour']), /over the 100KB limit/);
  });

  test('the extension has to be a true claim', () => {
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    assert.match(problemsIn(folder({ 'harbour.png': jpg }), ['harbour']), /contents are not \.png/);
  });
});

describe('the build stops at the first problem', () => {
  test('iconsByApp throws, and names the folder so the file can be found', () => {
    const dir = folder({ 'harbour.svg': Buffer.alloc(8) });
    assert.throws(() => iconsByApp(dir, ['harbour']), /registry\/showcase\/harbour\.svg/);
  });

  test('a missing icon throws too, rather than rendering a gap', () => {
    assert.throws(() => iconsByApp(folder({}), ['harbour']), /every app needs an icon/);
  });

  test('iconsByApp returns the map when there is nothing wrong', () => {
    const dir = folder({ 'harbour.png': PNG });
    assert.deepEqual([...iconsByApp(dir, ['harbour'])], [['harbour', 'harbour.png']]);
  });
});
