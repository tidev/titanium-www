import { DeveloperProfileSchema } from '../registry/directory.ts';
import { avatarsByProfile, avatarUrl } from './avatar.ts';
import { fairOrder, liveProfiles, type Profile } from './profile.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/**
 * Reads `registry/directory/` off the local filesystem (TI-58).
 *
 * The filesystem half, kept apart from `./profile.ts` for the reason that file
 * explains: the listing filters in the browser, so nothing it imports may reach
 * `node:fs`. Everything here runs at build time only.
 *
 * No network, in keeping with `pnpm check:offline`. A listing is a committed
 * file; there is nothing to fetch.
 */

/**
 * Spelled out rather than imported from `../docs/registry.ts`.
 *
 * That module's `REGISTRY` is the same string, but importing it pulls the whole
 * pool reader in behind it, and the pool builds paths dynamically enough that
 * Turbopack traces the entire project through anything that touches it. The
 * directory has no pool, no content addressing and one flat folder, so it
 * should not inherit that trace for the sake of one `join`.
 */
const DIRECTORY_DIR = join(process.cwd(), 'registry', 'directory');

let all: Profile[] | null = null;

/**
 * Every listing on disk, valid or not yet expired alike.
 *
 * Parsed through the same schema CI validates with, so a file that would fail
 * `pnpm check:registry` throws here rather than rendering a half-built card.
 * The build failing on it is the correct outcome: the schema is the only thing
 * standing between a listing and a published email address.
 */
export function allProfiles(): Profile[] {
  if (all) return all;
  if (!existsSync(DIRECTORY_DIR)) return (all = []);

  const listings = readdirSync(DIRECTORY_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => {
      const parsed = DeveloperProfileSchema.parse(
        JSON.parse(readFileSync(join(DIRECTORY_DIR, name), 'utf8'))
      );
      if (parsed.id !== basename(name, '.json')) {
        throw new Error(
          `registry/directory/${name}: id is "${parsed.id}"; it must match the filename`
        );
      }
      return parsed;
    });

  // A second pass, because a picture is matched to a listing by name and the
  // orphan check needs to know every id before it can call one an orphan. Like
  // the schema above, it throws rather than skipping: a committed file that
  // cannot be published is a mistake somebody should be told about.
  const pictures = avatarsByProfile(
    DIRECTORY_DIR,
    listings.map((profile) => profile.id)
  );

  all = listings.map((profile) => {
    const picture = pictures.get(profile.id);
    return picture ? { ...profile, avatar: avatarUrl(picture) } : profile;
  });
  return all;
}

/**
 * The day the site is being built, in UTC.
 *
 * The one place time enters the directory, and everything downstream takes it
 * as an argument so that none of it depends on when the tests run. UTC because
 * the same commit is built by a laptop and by a runner in a different zone, and
 * they should stamp the same day into the HTML.
 *
 * This being read at build time is exactly why the daily rebuild exists: a
 * listing that expires tomorrow keeps rendering until something rebuilds.
 */
export const buildDate = (): Date => new Date();

/** What the site publishes today: unexpired, and real if any real listing exists. */
export const listedProfiles = (on: Date = buildDate()): Profile[] =>
  liveProfiles(allProfiles(), on);

/** The listing page's order. Fair, deterministic, and turned by the daily rebuild. */
export const orderedProfiles = (on: Date = buildDate()): Profile[] =>
  fairOrder(listedProfiles(on), on);

/** One listing, or nothing. Used by the profile page, which does not trust its URL segment. */
export function profileById(id: string, on: Date = buildDate()): Profile | null {
  return listedProfiles(on).find((p) => p.id === id) ?? null;
}
