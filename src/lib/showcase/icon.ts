import { readImages, type ImagePolicy } from '../registry-images.ts';

/**
 * The icon beside a showcase entry (TI-54).
 *
 * A committed file at `registry/showcase/<id>.<ext>`, next to the app's own
 * JSON, copied into `public/` at build time by `scripts/sync-registry-images.ts`.
 *
 * What may be published, and why an icon is a committed file rather than a URL,
 * is in `../registry-images.ts` - the developer directory publishes its pictures
 * through the same rules. What is particular to the showcase is here: an icon is
 * required rather than optional, and a committed screenshot is refused with the
 * reason rather than as an unexplained orphan.
 */

/**
 * The per-file cap, in bytes.
 *
 * A deployment budget rather than a taste judgement, and the same figure the
 * directory uses. The 100MB limit is measured against the static output, which
 * the showcase shares with the whole compiled documentation set, so every
 * entry's icon comes out of headroom measured in single-digit megabytes. A
 * 256x256 WebP lands around 15KB, so this leaves room to be careless without
 * leaving room to be a problem.
 */
export const ICON_MAX_BYTES = 100 * 1024;

const POLICY: ImagePolicy = {
  maxBytes: ICON_MAX_BYTES,
  noun: 'app',
  advice: 'Scale it to 256x256 and save it as .webp',
};

/**
 * A file named like a screenshot of an entry that exists.
 *
 * `acme-tools-1.webp` beside `acme-tools.json` is not a mystery orphan, it is
 * somebody adding screenshots, which this page does not publish yet. Saying so
 * costs six lines and saves the round trip where they rename the file and get
 * the same error back.
 */
const NUMBERED = /^(.+)-\d+\.[a-z]+: no app called/;

function screenshotHint(problem: string, known: Set<string>): string | null {
  const base = NUMBERED.exec(problem)?.[1];
  if (!base || !known.has(base)) return null;
  return `${problem.split(':')[0]}: screenshots are not published yet - an entry carries one icon, named "${base}", and links out to the stores for the rest. See docs/app-showcase.md`;
}

/**
 * Every icon in the folder, and everything wrong with the folder.
 *
 * Two callers with different needs: the build wants the map and should stop at
 * the first thing wrong, and `pnpm check:registry` wants to print everything
 * wrong at once so a submitter fixes their entry in one pass rather than one
 * round trip per mistake.
 *
 * @param ids the apps that exist. Every one of them has to have an icon, so
 *   this is both what names an orphan and what makes a gap a failure.
 */
export function readIcons(
  dir: string,
  ids: readonly string[]
): { icons: Map<string, string>; problems: string[] } {
  const { pictures, problems } = readImages(dir, ids, POLICY);
  const known = new Set(ids);

  const explained = problems.map((problem) => screenshotHint(problem, known) ?? problem);

  // Reported after the file problems rather than mixed in with them: a missing
  // icon is usually the *consequence* of one of the lines above - a rejected
  // .svg leaves the entry with nothing - and reading them in that order is
  // what makes the pair legible.
  for (const id of ids) {
    if (!pictures.has(id)) {
      explained.push(
        `${id}.json: every app needs an icon. Commit one as "${id}.png", ".jpg" or ".webp" beside it`
      );
    }
  }

  return { icons: pictures, problems: explained };
}

/**
 * Every icon, as app id to filename.
 *
 * Throws rather than skipping. An entry whose icon cannot be published is a
 * mistake somebody made on purpose - they committed a file, or forgot to - and
 * carrying on would render a grid with a hole in it and nothing to explain why.
 */
export function iconsByApp(dir: string, ids: readonly string[]): Map<string, string> {
  const { icons, problems } = readIcons(dir, ids);
  if (problems.length) throw new Error(`registry/showcase/${problems[0]}`);
  return icons;
}

/** Where an icon is served from, once the sync step has copied it. */
export const iconUrl = (name: string): string => `/showcase/${name}`;
