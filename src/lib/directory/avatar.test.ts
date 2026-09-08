import { AVATAR_MAX_BYTES, avatarsByProfile, readAvatars } from './avatar.ts';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

/**
 * What may be published beside a listing.
 *
 * These rules are the only thing between `registry/directory/` and the site:
 * the sync step publishes exactly what passes here, so a hole in this file is
 * a hole in what the site will serve. See `./avatar.ts`.
 *
 * Fixtures are headers rather than real pictures, because a header is all
 * `avatarProblem` reads - it is checking that the extension is a true claim,
 * not that the image decodes.
 */

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const webp = (fourcc: string) =>
  Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.alloc(4),
    Buffer.from(fourcc, 'latin1'),
    Buffer.alloc(4),
  ]);

const dirs: string[] = [];

/** A throwaway directory holding the given files. */
function folder(files: Record<string, Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), 'directory-avatars-'));
  dirs.push(dir);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** The problems reported for one folder, as one string to assert against. */
const problemsIn = (dir: string, ids: string[]) => readAvatars(dir, ids).problems.join('\n');

describe('what may be published', () => {
  test('a png, jpg or webp belonging to a listing is found', () => {
    const dir = folder({
      'ada.png': PNG,
      'grace.jpg': JPG,
      'acme.webp': webp('WEBP'),
      'ada.json': Buffer.from('{}'),
    });

    const { pictures, problems } = readAvatars(dir, ['ada', 'grace', 'acme']);
    assert.deepEqual(problems, []);
    assert.deepEqual(
      [...pictures],
      [
        ['acme', 'acme.webp'],
        ['ada', 'ada.png'],
        ['grace', 'grace.jpg'],
      ]
    );
  });

  test('listings and dotfiles are not mistaken for pictures', () => {
    const dir = folder({ 'ada.json': Buffer.from('{}'), '.DS_Store': Buffer.alloc(8) });
    const { pictures, problems } = readAvatars(dir, ['ada']);
    assert.deepEqual(problems, []);
    assert.equal(pictures.size, 0);
  });

  test('a folder with no pictures, and one that does not exist', () => {
    assert.deepEqual(readAvatars(folder({}), []).problems, []);
    assert.equal(readAvatars(join(tmpdir(), 'no-such-directory-here'), []).pictures.size, 0);
  });
});

describe('formats that are refused', () => {
  test('svg is refused, and says why rather than only that', () => {
    const problems = problemsIn(folder({ 'ada.svg': Buffer.from('<svg/>') }), ['ada']);
    assert.match(problems, /ada\.svg/);
    assert.match(problems, /export it to \.png/);
    assert.match(problems, /script/);
  });

  test('near misses are told what to do instead', () => {
    const dir = folder({ 'a.jpeg': JPG, 'b.gif': Buffer.alloc(8), 'c.avif': Buffer.alloc(8) });
    const problems = problemsIn(dir, ['a', 'b', 'c']);
    assert.match(problems, /rename it to \.jpg/);
    assert.match(problems, /b\.gif.*save it as \.png/);
    assert.match(problems, /c\.avif.*save it as \.webp/);
  });

  test('an unknown extension names the formats that do work', () => {
    const problems = problemsIn(folder({ 'ada.psd': Buffer.alloc(8) }), ['ada']);
    assert.match(problems, /\.png, \.jpg, \.webp/);
  });
});

describe('the extension has to be a true claim', () => {
  test('a jpeg renamed to .png is refused', () => {
    const problems = problemsIn(folder({ 'ada.png': JPG }), ['ada']);
    assert.match(problems, /contents are not \.png/);
    assert.match(problems, /Convert it rather than renaming it/);
  });

  test('svg renamed to .png cannot sneak past on the extension alone', () => {
    const problems = problemsIn(folder({ 'ada.png': Buffer.from('<svg xmlns="...">') }), ['ada']);
    assert.match(problems, /contents are not \.png/);
  });

  test('RIFF alone is not WebP: an AVI renamed to .webp is refused', () => {
    // The signature this guards is a container. Without the format check at
    // byte 8, any RIFF file - AVI, WAV - would publish as a picture.
    assert.match(problemsIn(folder({ 'ada.webp': webp('AVI ') }), ['ada']), /contents are not/);
    assert.deepEqual(readAvatars(folder({ 'ada.webp': webp('WEBP') }), ['ada']).problems, []);
  });
});

describe('size', () => {
  test('over the cap is refused, and the message says the size and the fix', () => {
    const big = Buffer.concat([PNG, Buffer.alloc(AVATAR_MAX_BYTES)]);
    const problems = problemsIn(folder({ 'ada.png': big }), ['ada']);
    assert.match(problems, /over the 100KB limit/);
    assert.match(problems, /256x256/);
  });

  test('exactly at the cap is allowed', () => {
    const exact = Buffer.concat([PNG, Buffer.alloc(AVATAR_MAX_BYTES - PNG.length)]);
    assert.deepEqual(readAvatars(folder({ 'ada.png': exact }), ['ada']).problems, []);
  });
});

describe('a picture belongs to exactly one listing', () => {
  test('an orphan is refused rather than served at a URL nothing links to', () => {
    const problems = problemsIn(folder({ 'ada.png': PNG }), ['grace']);
    assert.match(problems, /no listing called "ada"/);
  });

  test('two pictures for one listing is refused rather than resolved silently', () => {
    const dir = folder({ 'ada.png': PNG, 'ada.jpg': JPG });
    const { pictures, problems } = readAvatars(dir, ['ada']);
    assert.match(problems.join('\n'), /already has ada\.jpg/);
    // The first one alphabetically is still mapped, so the message names the
    // duplicate rather than leaving the listing with nothing.
    assert.deepEqual([...pictures], [['ada', 'ada.jpg']]);
  });
});

describe('every problem is reported, and the build stops at the first', () => {
  test('readAvatars collects them all, so one pass fixes a listing', () => {
    const dir = folder({ 'a.svg': Buffer.alloc(8), 'b.gif': Buffer.alloc(8), 'c.png': PNG });
    assert.equal(readAvatars(dir, ['a', 'b']).problems.length, 3);
  });

  test('avatarsByProfile throws, and names the folder so the file can be found', () => {
    const dir = folder({ 'ada.svg': Buffer.alloc(8) });
    assert.throws(() => avatarsByProfile(dir, ['ada']), /registry\/directory\/ada\.svg/);
  });

  test('avatarsByProfile returns the map when there is nothing wrong', () => {
    const dir = folder({ 'ada.png': PNG });
    assert.deepEqual([...avatarsByProfile(dir, ['ada'])], [['ada', 'ada.png']]);
  });
});
