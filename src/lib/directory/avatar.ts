import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

/**
 * The picture beside a listing: a photo for a person, a logo for a company.
 *
 * A committed file at `registry/directory/<id>.<ext>`, next to the listing's
 * own JSON, copied into `public/` at build time by
 * `scripts/sync-directory-avatars.ts`.
 *
 * ## Why not a URL in the listing
 *
 * A remote image could not work here and should not. The build refuses network
 * access outright - `scripts/assert-offline.ts` fails the process on any
 * outbound socket - so nothing remote can be fetched, measured or checked at
 * the point it matters.
 *
 * The stronger reason is the reader. An `<img>` pointed at a host of the
 * listee's choosing sends every visitor's address, user agent and referer to
 * that host on every page view, and it can be swapped for a tracking pixel the
 * day after review. `docs/developer-directory.md` refuses to publish an email
 * address because the person who pays for it is the listee; here the person who
 * pays is the reader, who never asked for a listing at all.
 *
 * A committed file also arrives as a diff, so it is reviewed like everything
 * else about a listing rather than being a URL nobody clicked.
 *
 * ## Why the filename rather than a field
 *
 * The file is named after the listing's `id`, and nothing in the JSON names it.
 * A field would be the same string written twice, and so a new way for a
 * listing to be wrong. `DeveloperProfileSchema` is untouched by pictures.
 */

/**
 * What may be published, and what each one has to start with.
 *
 * Raster only. SVG is a document that can carry script and reference remote
 * resources, and it would be served from this site's own origin, so it is
 * refused rather than sanitised - there is no version of an avatar that needs
 * to be a program.
 *
 * The magic bytes are checked because the extension is a claim about the file
 * and this is what makes it true. WebP is RIFF, which is a container: the
 * format is at byte 8, so it is matched separately below.
 */
const FORMATS = {
  '.png': [0x89, 0x50, 0x4e, 0x47],
  '.jpg': [0xff, 0xd8, 0xff],
  '.webp': [0x52, 0x49, 0x46, 0x46],
} as const;

export const AVATAR_EXTENSIONS = Object.keys(FORMATS) as (keyof typeof FORMATS)[];

/**
 * Spellings people reasonably reach for that this does not take, and what to do
 * instead. Named explicitly so the error can say so: "not a supported format"
 * sends someone hunting, and the answer for a `.jpeg` is to rename it.
 */
const REDIRECTED: Record<string, string> = {
  '.jpeg': 'rename it to .jpg',
  '.gif': 'save it as .png',
  '.svg':
    "export it to .png. SVG is not published: it can carry script, and it would be served from this site's own origin",
  '.avif': 'save it as .webp',
  '.bmp': 'save it as .png',
  '.tiff': 'save it as .png',
  '.ico': 'save it as .png',
};

/**
 * The per-file cap, in bytes.
 *
 * A deployment budget rather than a taste judgement. The 100MB limit is
 * measured against the static output, which the directory shares with the whole
 * compiled documentation set, so every listing's picture comes out of headroom
 * measured in single-digit megabytes. A 256x256 WebP lands around 15KB, so this
 * leaves room to be careless without leaving room to be a problem.
 */
export const AVATAR_MAX_BYTES = 100 * 1024;

const asKb = (bytes: number) => `${Math.ceil(bytes / 1024)}KB`;

/**
 * Does the file begin the way its extension claims?
 *
 * Reads the first twelve bytes rather than the file, because a picture that
 * fails this is not going to be read any further.
 */
function magicMatches(path: string, ext: keyof typeof FORMATS): boolean {
  const head = readFileSync(path).subarray(0, 12);
  const signature = FORMATS[ext];
  if (!signature.every((byte, i) => head[i] === byte)) return false;
  // RIFF is a container - AVI and WAV open identically. The format lives at
  // byte 8, so an unguarded RIFF check would accept a video renamed to .webp.
  if (ext === '.webp') return head.subarray(8, 12).toString('latin1') === 'WEBP';
  return true;
}

/** Why this file may not be published, or `null` if it may. */
export function avatarProblem(path: string, name: string): string | null {
  const ext = extname(name).toLowerCase();

  const instead = REDIRECTED[ext];
  if (instead) return `${name}: ${ext} is not published here. ${instead}`;

  if (!(ext in FORMATS)) {
    return `${name}: pictures must be ${AVATAR_EXTENSIONS.join(', ')}`;
  }

  const bytes = statSync(path).size;
  if (bytes > AVATAR_MAX_BYTES) {
    return `${name}: ${asKb(bytes)} is over the ${asKb(AVATAR_MAX_BYTES)} limit. Scale it to 256x256 and save it as .webp`;
  }

  if (!magicMatches(path, ext as keyof typeof FORMATS)) {
    return `${name}: the contents are not ${ext}. Convert it rather than renaming it`;
  }

  return null;
}

/** Everything in the directory folder that is not a listing. */
const pictureNames = (dir: string): string[] =>
  readdirSync(dir)
    .filter((name) => !name.endsWith('.json') && !name.startsWith('.'))
    .sort();

/**
 * Every picture in the folder, sorted into the publishable and the not.
 *
 * One traversal, two callers with different needs: the build wants the map and
 * should stop at the first thing wrong, and `pnpm check:registry` wants to
 * print everything wrong at once so a submitter fixes their listing in one
 * pass rather than one round trip per mistake.
 *
 * @param ids the listings that exist, so an orphan can be named as one
 */
export function readAvatars(
  dir: string,
  ids: readonly string[]
): { pictures: Map<string, string>; problems: string[] } {
  const pictures = new Map<string, string>();
  const problems: string[] = [];
  if (!existsSync(dir)) return { pictures, problems };

  const known = new Set(ids);

  for (const name of pictureNames(dir)) {
    const problem = avatarProblem(join(dir, name), name);
    if (problem) {
      problems.push(problem);
      continue;
    }

    const id = name.slice(0, -extname(name).length);
    if (!known.has(id)) {
      problems.push(
        `${name}: no listing called "${id}". A picture is named after the listing it belongs to, and is deleted with it`
      );
      continue;
    }

    const already = pictures.get(id);
    if (already) {
      problems.push(`${name}: "${id}" already has ${already}. One picture per listing`);
      continue;
    }
    pictures.set(id, name);
  }

  return { pictures, problems };
}

/**
 * Every publishable picture, as listing id to filename.
 *
 * Throws rather than skipping. A picture that cannot be published is a mistake
 * somebody made on purpose - they committed a file - and dropping it silently
 * would leave them looking at a monogram with nothing to explain why.
 */
export function avatarsByProfile(dir: string, ids: readonly string[]): Map<string, string> {
  const { pictures, problems } = readAvatars(dir, ids);
  if (problems.length) throw new Error(`registry/directory/${problems[0]}`);
  return pictures;
}

/** Where a picture is served from, once the sync step has copied it. */
export const avatarUrl = (name: string): string => `/directory/${name}`;
