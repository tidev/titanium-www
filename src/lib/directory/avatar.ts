import { readImages, type ImagePolicy } from '../registry-images.ts';

/**
 * The picture beside a listing: a photo for a person, a logo for a company.
 *
 * A committed file at `registry/directory/<id>.<ext>`, next to the listing's
 * own JSON, copied into `public/` at build time by
 * `scripts/sync-registry-images.ts`.
 *
 * What may be published, and why a picture is a committed file rather than a
 * URL, is in `../registry-images.ts` - the app showcase (TI-54) publishes its
 * icons through the same rules. This file is only what is particular to a
 * listing: the budget, the noun the errors use, and where the copy is served
 * from.
 */

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

const POLICY: ImagePolicy = {
  maxBytes: AVATAR_MAX_BYTES,
  noun: 'listing',
  advice: 'Scale it to 256x256 and save it as .webp',
};

/**
 * Every picture in the folder, sorted into the publishable and the not.
 *
 * Two callers with different needs: the build wants the map and should stop at
 * the first thing wrong, and `pnpm check:registry` wants to print everything
 * wrong at once so a submitter fixes their listing in one pass rather than one
 * round trip per mistake.
 *
 * @param ids the listings that exist, so an orphan can be named as one
 */
export const readAvatars = (dir: string, ids: readonly string[]) => readImages(dir, ids, POLICY);

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
