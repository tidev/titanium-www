import { CliReleasesSchema, type CliReleases } from '../registry/index.ts';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import semver from 'semver';

/**
 * Reads the captured Titanium CLI releases off the local filesystem.
 *
 * Same contract as the SDK reader beside it: no network at build time,
 * everything resolves against `registry/` in the repo. The file is written by
 * `pnpm registry:cli`, which is where the two upstreams and the split between
 * them are explained.
 *
 * The CLI sits here rather than under `docs/` because `/downloads` is where the
 * site tells people to install it, and the landing page names the current
 * version for the same reason. `src/lib/docs/cli-support.ts` is a different
 * question - which CLI an *SDK release* needs - and reads the same list.
 */

const RELEASES = join(process.cwd(), 'registry/cli/releases.json');

export type CliRelease = CliReleases['releases'][number];

/** A version that was released on GitHub, so it has a date and notes to link to. */
export type PublishedCliRelease = CliRelease & { date: string; url: string };

let cached: CliReleases | null | undefined;

/** The whole document, or null when it has not been captured. */
export function readCliReleases(): CliReleases | null {
  if (cached !== undefined) return cached;
  cached = existsSync(RELEASES)
    ? CliReleasesSchema.parse(JSON.parse(readFileSync(RELEASES, 'utf8')))
    : null;
  return cached;
}

/** Every captured version, in the order the file lists them. Empty when absent. */
export const cliReleases = (): CliRelease[] => readCliReleases()?.releases ?? [];

/**
 * The CLI version to tell someone to install, or null.
 *
 * The newest stable release that GitHub actually published. Three filters, and
 * each drops something real:
 *
 *   the release  a version published to npm and never released on GitHub has no
 *                date and no notes to link to, and 145 of the 191 are exactly
 *                that - every 0.0.x and most of 3.x. Naming one would put a
 *                version on the landing page with nothing behind it.
 *   prereleases  `9.0.0-rc1` is on npm and on GitHub, and `npm i -g titanium`
 *                does not give it to you. Judged on the version rather than on
 *                GitHub's own flag, which is the rule `minimumCli` already
 *                applies; the capture fails if the two ever disagree.
 *   the version  ordered with semver, not by file order or by date. A patch on
 *                an old line ships after the newer line's first release - 8.1.5
 *                came out after 9.0.0-rc1 - so date order would eventually name
 *                a version that is not the newest.
 *
 * Takes the list so the rule can be tested without a registry on disk.
 */
export function latestCli(
  releases: readonly CliRelease[] = cliReleases()
): PublishedCliRelease | null {
  const published = releases.filter(
    (r): r is PublishedCliRelease =>
      Boolean(r.url) &&
      Boolean(r.date) &&
      semver.valid(r.version) !== null &&
      !semver.prerelease(r.version)
  );
  if (!published.length) return null;
  return published.reduce((best, next) => (semver.gt(next.version, best.version) ? next : best));
}
