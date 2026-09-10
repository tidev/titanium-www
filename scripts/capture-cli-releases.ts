import { CliReleasesSchema, SCHEMA_VERSION } from '../src/lib/registry/index.ts';
import { paginate } from './lib/github.ts';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

/**
 * Captures every published Titanium CLI release into the registry.
 *
 *   node scripts/capture-cli-releases.ts
 *
 * Split out of `scripts/generate-compat.ts --refresh`, which is where this
 * started when the compatibility table was the only thing that wanted it. The
 * landing page and `/downloads` now name the current CLI too, so the capture
 * belongs beside the other `registry:*` scripts rather than inside the one page
 * generator that happened to need it first. `generate-compat.ts` only reads the
 * file now.
 *
 * Deliberately not part of the build. TI-25 requires the build to read the
 * filesystem and nothing else, and `scripts/assert-offline.ts` enforces it;
 * fetching here would also make two builds of one commit produce different
 * pages. Run it when a CLI ships.
 *
 * ## Two upstreams
 *
 * **GitHub is the source of truth for releases.** `tidev/titanium-cli`
 * publishes one release per version and writes a real body for it, so `date`
 * and `url` come from there and the site links out to the release page rather
 * than restating it. That is the opposite of the SDK, whose 71 release bodies
 * are empty or a link back to this site - which is why those notes are captured
 * into pages here instead. See `docs/release-notes.md`.
 *
 * **npm is read for `engines.node` only.** It is a fact about a published
 * package rather than about a release, it is the input to `minimumCli`, and npm
 * has it for all 191 versions where the repository has releases for the most
 * recent 46 - including the 3.x and 5.x the compatibility table still reasons
 * about. Dropping npm would silently shorten that table.
 *
 * A version published to npm and never released on GitHub is kept, without a
 * date or a URL. Nothing links to one: `latestCli()` needs the URL.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = join(ROOT, 'registry/cli/releases.json');

const NPM = 'https://registry.npmjs.org';
const PACKAGE = 'titanium';
const REPO = 'tidev/titanium-cli';

/**
 * Every version and the Node it declares.
 *
 * The abbreviated packument is asked for by `Accept`: the full document carries
 * dist metadata for every version and is an order of magnitude larger for no
 * gain here.
 */
async function npmVersions(): Promise<Map<string, string | undefined>> {
  const res = await fetch(`${NPM}/${PACKAGE}`, {
    headers: { accept: 'application/vnd.npm.install-v1+json' },
  });
  if (!res.ok) throw new Error(`npm answered ${res.status} for ${PACKAGE}`);

  const body = (await res.json()) as { versions?: Record<string, { engines?: { node?: string } }> };
  const entries = Object.entries(body.versions ?? {});
  if (!entries.length) throw new Error(`the ${PACKAGE} packument listed no versions`);

  return new Map(entries.map(([version, info]) => [version, info.engines?.node]));
}

type GhRelease = {
  tag_name: string;
  draft: boolean;
  prerelease: boolean;
  published_at: string | null;
  html_url: string;
};

/**
 * Every published release, keyed by the version its tag names.
 *
 * Tags are inconsistent - `v9.1.0` on recent releases, a bare `3.4.0` on the
 * older ones - so the `v` is optional and the URL is stored rather than rebuilt
 * from the version later.
 *
 * Drafts are skipped. They are invisible without a token and this script runs
 * with one, so capturing them would publish an unreleased version to the
 * landing page.
 */
async function githubReleases(): Promise<Map<string, { date: string; url: string }>> {
  const found = new Map<string, { date: string; url: string }>();

  for await (const page of paginate<GhRelease>(`/repos/${REPO}/releases`)) {
    for (const release of page) {
      if (release.draft) continue;

      const version = release.tag_name.replace(/^v/, '');
      if (!semver.valid(version)) {
        throw new Error(`${REPO} release ${release.tag_name} is not tagged with a version`);
      }

      // The one place the two ways of saying "prerelease" could disagree.
      // Everything downstream reads the version - `minimumCli` does, and so
      // does `latestCli` - so a release flagged on GitHub but not in its
      // own version would quietly become the version the site tells people to
      // install. It agrees on all 46 today; fail here rather than there.
      if (release.prerelease !== Boolean(semver.prerelease(version))) {
        throw new Error(
          `${REPO} release ${release.tag_name} is marked ` +
            `${release.prerelease ? '' : 'not '}prerelease, which its version does not say`
        );
      }

      // `published_at` is null only on a draft, which is already skipped.
      if (!release.published_at) throw new Error(`${REPO} release ${release.tag_name} has no date`);
      found.set(version, { date: release.published_at, url: release.html_url });
    }
  }

  if (!found.size) throw new Error(`${REPO} has published no releases`);
  return found;
}

const [engines, published] = await Promise.all([npmVersions(), githubReleases()]);

const unpublished = [...published.keys()].filter((v) => !engines.has(v));
if (unpublished.length) {
  // Not fatal: a release can precede the npm publish by minutes. Worth saying,
  // because a version that stays here is one the repository released and never
  // shipped.
  console.warn(`Released on GitHub but not on npm: ${unpublished.join(', ')}`);
}

const releases = [...new Set([...engines.keys(), ...published.keys()])]
  .sort((a, b) => semver.compare(a, b) || a.localeCompare(b))
  .map((version) => ({
    version,
    ...(engines.get(version) ? { node: engines.get(version) } : {}),
    ...published.get(version),
  }));

const value = CliReleasesSchema.parse({
  schemaVersion: SCHEMA_VERSION,
  fetchedAt: new Date().toISOString(),
  source: { registry: NPM, package: PACKAGE, repo: REPO },
  releases,
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(value, null, 2)}\n`);

const latest = releases.filter((r) => r.url && !semver.prerelease(r.version)).at(-1);
console.log(
  `registry/cli/releases.json: ${releases.length} version(s), ` +
    `${published.size} released on GitHub, latest ${latest?.version ?? 'none'}`
);
