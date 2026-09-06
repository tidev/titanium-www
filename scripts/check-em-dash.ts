import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Fails the build on an em dash in anything this repo authors.
 *
 * They read as generated text, and they were never going to stay consistent:
 * some pages had them, hand-written pages and every legacy post did not, and
 * the site drew from both. Removing the 630 that had accumulated is only worth
 * doing once, so this keeps them out.
 *
 *   node scripts/check-em-dash.ts
 *
 * `docs/writing-guides.md` says what to write instead. Briefly: the punctuation
 * the sentence wants, and a spaced hyphen when none of it fits.
 *
 * ## What is not checked
 *
 * `registry/` is compiled from the SDK's own YAML and from module READMEs other
 * people wrote. The four JSON files under `docs/` and `src/lib/docs/` are legacy
 * maps keyed by legacy titles, where an em dash is part of a key that has to
 * match the page it came from. Rewriting either would be editing someone else's
 * words, or breaking a lookup.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const ROOTS = ['content', 'src', 'scripts', 'docs'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.css', '.md']);

/** Escaped, so this file does not fail its own check. */
const EM_DASH = '\u2014';

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (EXTENSIONS.has(extname(entry.name))) yield path;
  }
}

const found: string[] = [];

for (const root of ROOTS) {
  for (const path of files(join(ROOT, root))) {
    const lines = readFileSync(path, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (line.includes(EM_DASH))
        found.push(`${relative(ROOT, path)}:${i + 1}\n    ${line.trim()}`);
    });
  }
}

if (!found.length) {
  console.log('No em dashes.');
  process.exit(0);
}

console.error(`${found.length} em dash(es):\n`);
for (const where of found) console.error(`  ${where}`);
console.error('\nSee "No em dashes" in docs/writing-guides.md.');
process.exit(1);
