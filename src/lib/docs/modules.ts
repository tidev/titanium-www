import {
  CommunityIndexSchema,
  ModuleIndexSchema,
  ModuleVersionSchema,
  UnsupportedListSchema,
  VerifiedListSchema,
  type ApiIndex,
  type ApiType,
  type ModuleIndex,
  type ModuleVersion,
} from '../registry/index.ts';
import {
  latestPerPlatform,
  type CommunityListing,
  type ModuleSummary,
  type PlatformLatest,
} from './module-summary.ts';
import {
  apiIndexAt,
  apiTypeAt,
  compareVersions,
  hasApiIndex,
  MAIN,
  REGISTRY,
  type CompiledSource,
} from './registry.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads `registry/modules/` off the local filesystem.
 *
 * Keyed on `moduleId` throughout, never on the repository name: they differ for
 * 5 of the 16 (`tidev/titanium-identity` publishes `ti.identity`), and the id is
 * what a developer writes in `tiapp.xml` and what the install directory is named.
 * The repo name reaches the site only as an alias that redirects.
 *
 * Nothing here trusts a URL segment. Ids and version strings are checked against
 * what is on disk rather than pattern-matched, so a traversal attempt resolves
 * to nothing instead of to a path.
 */

const MODULES_DIR = join(REGISTRY, 'modules');

const cache = new Map<string, unknown>();
function readJson<T>(path: string, parse: (v: unknown) => T): T | null {
  if (cache.has(path)) return cache.get(path) as T;
  if (!existsSync(path)) return null;
  const value = parse(JSON.parse(readFileSync(path, 'utf8')));
  cache.set(path, value);
  return value;
}

let ids: string[] | null = null;

/** Every module in the registry, sorted by id. */
export function moduleIds(): string[] {
  if (ids) return ids;
  if (!existsSync(MODULES_DIR)) return (ids = []);
  ids = readdirSync(MODULES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(MODULES_DIR, e.name, 'index.json')))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
  return ids;
}

let unsupported: Set<string> | null = null;

/**
 * Official modules TiDev has stopped supporting, which the site does not show.
 *
 * Hand-maintained in `registry/modules/unsupported.json` and joined on here
 * rather than written into the registry, for the reason the verified list is:
 * `generate-modules.ts` rewrites those directories from what GitHub said, and a
 * judgement stored in its output would be erased by the next run.
 *
 * Absence is not an error. A checkout without the file lists everything, which
 * is the same failure mode as a checkout that has never run the community
 * scrape - and the safe direction, since the alternative is a parse error
 * taking down a build over a curation file.
 */
function unsupportedIds(): Set<string> {
  if (unsupported) return unsupported;
  const path = join(MODULES_DIR, 'unsupported.json');
  if (!existsSync(path)) return (unsupported = new Set());

  const parsed = UnsupportedListSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  return (unsupported = new Set(parsed.modules.map((m) => m.moduleId)));
}

export const isUnsupported = (id: string): boolean => unsupportedIds().has(id);

/**
 * The modules this site has pages for: every one on disk, minus the unsupported.
 *
 * The split is deliberate and runs the other way from what you might expect.
 * `moduleIds()` stays the complete on-disk truth because it is what every
 * lookup below guards against - `moduleIndex`, `moduleVersions` and the release
 * readers all check membership before touching a path, and narrowing it would
 * make an unsupported module unreadable rather than unlisted. `/registry/v1`
 * needs exactly that readability: the Titanium CLI resolves installs against it
 * and an app with `ti.barcode` in its `tiapp.xml` has to keep building.
 *
 * So the site calls this and the API calls `moduleIds()`. Everything that
 * renders a page, a sitemap entry or an llms.txt line uses this one, and
 * `unsupported.test.ts` asserts that none of them let one of these through -
 * because the failure is silent, and a delisted module quietly reappearing
 * looks exactly like nothing having happened.
 */
export function listedModuleIds(): string[] {
  return moduleIds().filter((id) => !isUnsupported(id));
}

export function moduleIndex(id: string): ModuleIndex | null {
  if (!moduleIds().includes(id)) return null;
  return readJson(join(MODULES_DIR, id, 'index.json'), (v) => ModuleIndexSchema.parse(v));
}

/**
 * What a module's own authors say it does, punctuated as a sentence (TI-48).
 *
 * Every module page opens its search description with this, and each view then
 * adds what that view actually holds. The alternative was four sentences per
 * module written by us, which would say the same thing about ti.nfc and
 * ti.playservices and rank as well as that deserves.
 *
 * The registry copies `description` straight off the repository, where trailing
 * punctuation is a coin flip: eleven of the sixteen have none. A description is
 * optional in the schema, so a module without one gets no lead sentence rather
 * than an invented one.
 */
export function moduleBlurb(index: ModuleIndex): string | undefined {
  const text = index.description?.trim();
  if (!text) return undefined;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

/**
 * The module's README, as committed to its repository.
 *
 * Narrowed here rather than read off the parsed index because `ModuleIndexSchema`
 * does not declare the field - it declares `readme` on a *version* instead, so
 * the one `generate-modules.ts` writes at package level arrives through the
 * schema's catchall as `unknown`. The data is real and every module has one;
 * the contract is what is behind, and widening it is a registry change rather
 * than a rendering one.
 */
export function moduleReadme(id: string): string | undefined {
  const readme = (moduleIndex(id) as { readme?: unknown } | null)?.readme;
  return typeof readme === 'string' && readme ? readme : undefined;
}

/**
 * The spellings that should redirect to a canonical id.
 *
 * `aliases` carries the id itself for most modules, so the identity entry is
 * dropped here - a page cannot redirect to itself. What is left is the five
 * repository names that differ from what the module publishes as.
 */
export function moduleAliases(): { alias: string; moduleId: string }[] {
  const out: { alias: string; moduleId: string }[] = [];
  const canonical = new Set(moduleIds());
  for (const id of listedModuleIds()) {
    for (const alias of moduleIndex(id)?.aliases ?? []) {
      if (alias !== id && !canonical.has(alias)) out.push({ alias, moduleId: id });
    }
  }
  return out;
}

/**
 * Every version directory a module has, newest first with `main` last.
 *
 * Read from disk rather than from `index.json.versions`, because the two do not
 * describe the same thing: `versions` lists releases, and `main` is a directory
 * that no release produced.
 */
export function moduleVersions(id: string): string[] {
  if (!moduleIds().includes(id)) return [];
  return readdirSync(join(MODULES_DIR, id), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort(compareVersions);
}

const versionDir = (id: string, version: string): string | null =>
  moduleVersions(id).includes(version) ? join(MODULES_DIR, id, version) : null;

/** One release: platforms, manifests, assets, and where it was compiled from. */
export function moduleRelease(id: string, version: string): ModuleVersion | null {
  const dir = versionDir(id, version);
  if (!dir) return null;
  return readJson(join(dir, 'metadata.json'), (v) => ModuleVersionSchema.parse(v));
}

export function moduleHasDocs(id: string, version: string): boolean {
  const dir = versionDir(id, version);
  return !!dir && hasApiIndex(dir);
}

export function moduleApiIndex(id: string, version: string): ApiIndex | null {
  const dir = versionDir(id, version);
  return dir ? apiIndexAt(dir) : null;
}

export function moduleApiType(id: string, version: string, name: string): ApiType | null {
  const dir = versionDir(id, version);
  return dir ? apiTypeAt(dir, name) : null;
}

export const moduleSource = (id: string, version: string): CompiledSource | undefined =>
  moduleRelease(id, version)?.source as CompiledSource | undefined;

/**
 * The SDK tree this version's cross-repo references were resolved against.
 *
 * docgen records it because a module compiles alone: `Titanium.UI.View` is
 * unresolvable inside ti.map's own checkout, so the SDK it was checked against
 * is written down. Linking those references at that version rather than at
 * whatever the site's newest SDK happens to be is the difference between a
 * reference that was verified and one that was assumed.
 *
 * Read loosely on purpose - docgen owns this file and treats a corrupt one as a
 * reason to recompile, not as a contract breach.
 */
export function externalSdkVersion(id: string, version: string): string | null {
  const dir = versionDir(id, version);
  if (!dir) return null;
  const manifest = readJson(join(dir, 'docgen-manifest.json'), (v) => v as unknown);
  const external = (manifest as { external?: { version?: unknown } } | null)?.external;
  return typeof external?.version === 'string' ? external.version : null;
}

// ------------------------------------------------------------------- summaries

/**
 * The current release per platform, carrying the SDK each one needs.
 *
 * `latestPerPlatform` cannot do this itself: it lives in the fs-free half of
 * the library so the browse page's client bundle can import it, and `minsdk` is
 * in the release manifest. One file read per platform per module, at build time
 * only - every caller is prerendered.
 */
export function latestReleases(index: ModuleIndex): PlatformLatest[] {
  return latestPerPlatform(index).map((entry) => {
    const minsdk = moduleRelease(index.moduleId, entry.version)?.manifests.find(
      (m) => m.platform === entry.platform
    )?.minsdk;
    return minsdk ? { ...entry, minsdk } : entry;
  });
}

/** Everything the browse page shows, and nothing it does not. */
export function moduleSummaries(): ModuleSummary[] {
  return listedModuleIds().flatMap((id) => {
    const index = moduleIndex(id);
    if (!index) return [];

    return [
      {
        kind: 'registry' as const,
        id,
        description: index.description,
        source: index.source,
        repo: index.repo,
        latest: latestReleases(index),
        releases: index.versions.length,
      },
    ];
  });
}

/**
 * What TiDev has vouched for, lowercased for comparison (TI-23).
 *
 * Hand-maintained, and deliberately not folded into `community.json`. That file
 * holds what GitHub said and is rewritten daily; this holds a judgement. Keeping
 * them apart means a regen cannot overwrite a verification, and a verification
 * does not have to be re-applied after one. See `docs/module-curation.md`.
 *
 * Two granularities. A repo entry vouches for one module; an owner entry
 * vouches for everything that author publishes, which is how 48 of the 106
 * listings are covered by two lines.
 */
function vouchedFor(): { repos: Set<string>; owners: Set<string> } {
  const path = join(MODULES_DIR, 'verified.json');
  if (!existsSync(path)) return { repos: new Set(), owners: new Set() };

  const parsed = VerifiedListSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  return {
    repos: new Set(parsed.modules.map((m) => m.repo.toLowerCase())),
    owners: new Set(parsed.owners.map((o) => o.toLowerCase())),
  };
}

/**
 * The community index, or nothing if it has not been generated.
 *
 * Absence is not an error: `pnpm registry:community` needs a GitHub token, so a
 * checkout that has never run it still builds - with the curated modules only.
 *
 * The curation status is joined on here rather than stored in the scrape. Every
 * listing is `unverified` until a person puts it on the verified list, which is
 * the honest default: carrying the `titanium` topic is how these are found, and
 * nothing about that is a review.
 */
export function communityListings(): CommunityListing[] {
  const path = join(MODULES_DIR, 'community.json');
  if (!existsSync(path)) return [];

  const parsed = CommunityIndexSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
  const vouched = vouchedFor();

  return parsed.modules.map((m) => {
    const verified =
      vouched.owners.has(m.owner.toLowerCase()) || vouched.repos.has(m.id.toLowerCase());
    return {
      kind: 'community' as const,
      source: verified ? ('community' as const) : ('unverified' as const),
      ...m,
    };
  });
}

/**
 * The versions whose compiled docs make up `/modules/<id>`.
 *
 * The latest per platform, which is normally one or two release directories.
 * Two modules - ti.coremotion and com.appcelerator.urlSession - have docs only
 * on a prerelease that `latest` deliberately skips, so nothing released would
 * be shown for them; those fall back to `main`, which every module has, and the
 * page says so rather than rendering an empty reference.
 */
export function referenceVersions(id: string, index: ModuleIndex): string[] {
  const released = [...new Set(Object.values(index.latest))]
    .filter((v) => moduleHasDocs(id, v))
    .sort(compareVersions);
  if (released.length) return released;
  return moduleHasDocs(id, MAIN) ? [MAIN] : [];
}

/**
 * Where a README's relative links and images resolve to.
 *
 * The README is third-party markdown written against a repository checkout, so
 * its relative paths point at files this domain does not serve. `HEAD` rather
 * than a branch name: the registry records which commit the docs were compiled
 * from, but not which one the README was read at, and GitHub resolves HEAD to
 * the default branch whatever it is called.
 */
export function readmeRelativeBase(
  index: ModuleIndex
): { images: string; links: string } | undefined {
  const slug = index.repo?.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  if (!slug) return undefined;

  return {
    images: `https://raw.githubusercontent.com/${slug}/HEAD`,
    links: `https://github.com/${slug}/blob/HEAD`,
  };
}
