import type { ModuleManifest, Platform } from '../../src/lib/registry/index.ts';

/**
 * The two things that describe a module release: the name of the zip attached
 * to it, and the manifest committed at its tag.
 *
 * Both are parsed here, away from the fetching, because both are where the
 * history is awkward - a dotted camelCase module id, a package that is neither
 * platform, a manifest format that predates the repo's YAML - and none of that
 * should need the network to test.
 *
 * Tags are deliberately absent. They are opaque references and nothing here
 * reads one: 18 spellings are in use across the 16 repos, four of them in
 * ti.map alone, and every attempt to derive meaning from one is a bug waiting
 * for the next release manager's habits.
 */

/** What the platform slot of an asset name can mean. */
export type AssetTarget = Platform | 'universal';

export type ParsedAsset = {
  /** From the filename, which is the only place it appears. Not the repo name. */
  moduleId: string;
  target: AssetTarget;
  version: string;
  filename: string;
};

/**
 * The platform slot in `<moduleid>-<platform>-<version>.zip`.
 *
 * `iphone` is what the packager has always written for iOS; `ios` never appears
 * in a filename in the current corpus and is accepted only so that renaming it
 * upstream is not a code change here.
 *
 * `titanium` is not a third platform. All 24 assets that use it were downloaded
 * and listed: every one contains both `modules/android/` and `modules/iphone/`,
 * so it is a universal package and expands to the platforms the release
 * actually shipped, rather than being discarded as unparseable.
 *
 * Matching is case-sensitive. Tag spellings wander (`iOS-2.3.2`,
 * `Android-v3.0.0`); filenames never have, and an asset that breaks that should
 * stop the run rather than be quietly lowercased into place.
 */
const TARGETS: Record<string, AssetTarget> = {
  android: 'android',
  ios: 'ios',
  iphone: 'ios',
  titanium: 'universal',
};

/**
 * Anchored at the end, greedy at the front.
 *
 * The module id is the one part that cannot be constrained: it carries dots and
 * mixed case (`com.appcelerator.urlSession-iphone-4.0.1.zip`) and differs from
 * the repository name for 5 of the 16 repos. Splitting on `-` or `.` gets those
 * wrong, so the platform and version are pinned to the tail and whatever
 * precedes them is the id.
 */
const ASSET = /^(.+)-([A-Za-z]+)-(\d+\.\d+\.\d+)\.zip$/;

/** Thrown rather than returned so a nonconforming asset stops the backfill. */
export class AssetNameError extends Error {}

export function parseAsset(filename: string): ParsedAsset {
  const m = ASSET.exec(filename);
  if (!m) {
    throw new AssetNameError(`${filename}: expected <moduleid>-<platform>-<x.y.z>.zip`);
  }

  const target = TARGETS[m[2]];
  if (!target) {
    throw new AssetNameError(
      `${filename}: unknown platform "${m[2]}" (known: ${Object.keys(TARGETS).join(', ')})`
    );
  }

  return { moduleId: m[1], target, version: m[3], filename };
}

/**
 * A module manifest: `key: value` lines, `#` comments, blanks.
 *
 * Not YAML, despite looking like it. Values are unquoted and contain colons
 * (`copyright: Copyright (c) 2013-present by Axway, Inc.`), and a YAML parser
 * would read `minsdk: 10.0` as a number and `mac: true` as a boolean before
 * this code got a say in either.
 */
export function parseManifest(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colon = trimmed.indexOf(':');
    if (colon < 0) continue;
    fields[trimmed.slice(0, colon).trim()] = trimmed.slice(colon + 1).trim();
  }
  return fields;
}

/** Absent and empty are the same thing here: a manifest key with no value says nothing. */
const value = (fields: Record<string, string>, key: string): string | undefined =>
  fields[key] ? fields[key] : undefined;

/**
 * Shapes one platform's manifest into the schema's per-platform record.
 *
 * `platform` is passed in rather than read from the manifest's own `platform:`
 * key: the caller knows which asset it is describing, and a manifest that
 * disagrees is a discrepancy to report, not a value to trust.
 */
export function toModuleManifest(
  fields: Record<string, string>,
  platform: Platform,
  fallbackVersion: string
): ModuleManifest {
  const apiversion = value(fields, 'apiversion');
  const architectures = value(fields, 'architectures');
  const mac = value(fields, 'mac');

  return {
    platform,
    // The schema requires a version, and a handful of old manifests were tagged
    // without one being bumped into them. The version on the asset is what
    // actually shipped, so it stands in.
    version: value(fields, 'version') ?? fallbackVersion,
    // `name` is deliberately not captured. It is a build label nothing reads --
    // the install directory is the moduleid, node-appc keys every lookup on the
    // id, and carrying a second identifier only invites it to drift from the one
    // developers write in tiapp.xml.
    ...(value(fields, 'minsdk') ? { minsdk: fields.minsdk } : {}),
    // Numeric everywhere it appears, but kept as text if it ever is not, since
    // the schema accepts both and losing the original would be worse.
    ...(apiversion
      ? { apiversion: /^\d+$/.test(apiversion) ? Number(apiversion) : apiversion }
      : {}),
    ...(architectures ? { architectures: architectures.split(/\s+/) } : {}),
    ...(value(fields, 'guid') ? { guid: fields.guid } : {}),
    ...(value(fields, 'author') ? { author: fields.author } : {}),
    ...(value(fields, 'license') ? { license: fields.license } : {}),
    ...(value(fields, 'copyright') ? { copyright: fields.copyright } : {}),
    ...(value(fields, 'description') ? { description: fields.description } : {}),
    ...(value(fields, 'respackage') ? { respackage: fields.respackage } : {}),
    ...(mac ? { mac: mac === 'true' } : {}),
  };
}

/**
 * The spelling iOS used before `ios/`, and still uses at most of these tags.
 *
 * Kept as a named constant because two things read it and they want it for
 * opposite reasons: `manifestPaths` so an old tag still resolves, and
 * `isLegacyManifestPath` so a run can say how much of the corpus is still on it.
 */
export const LEGACY_IOS_MANIFEST = 'iphone/manifest';

/**
 * Where a platform's manifest lives in a checkout, newest spelling first.
 *
 * iOS moved from `iphone/` to `ios/` partway through these repos' lives and
 * both are still reachable at their own tags, so which one exists is a property
 * of the release, not of the module.
 *
 * Both spellings are permanent (TI-24). 36 of the iOS manifests a full run
 * reads still resolve through the fallback, spread across 5 of the 16 repos,
 * and every one of them is at a tag that cannot be rewritten. Dropping
 * `iphone/manifest` would not tidy anything up: those reads would return null,
 * and the registry would rebuild with the iOS platform quietly missing from
 * those versions rather than fail. The fallback is load-bearing, not
 * transitional.
 */
export const manifestPaths = (platform: Platform): string[] =>
  platform === 'android' ? ['android/manifest'] : ['ios/manifest', LEGACY_IOS_MANIFEST];

/**
 * Whether a manifest was read from the pre-rename path.
 *
 * The registry records what a manifest said but not where it was read from, so
 * "which repos are still on `iphone/`" was a question TI-24 had to answer by
 * hand against GitHub. Reporting it from the run that already does the reading
 * means the next person does not have to.
 */
export const isLegacyManifestPath = (path: string): boolean => path === LEGACY_IOS_MANIFEST;

/**
 * The distinct guids in one version's manifests, when its platforms disagree.
 *
 * A guid identifies the module, not the build, so the two platforms of one
 * release are meant to share one. Eleven years of separate per-platform release
 * histories put three modules out of step at some point and left `ti.identity`
 * that way (TI-24): its android and iOS manifests have never matched. Reported
 * rather than corrected, like every other manifest cross-check here, because
 * the manifest is evidence about the release and the shipped artifact is what a
 * developer installs.
 *
 * Null when there is nothing to say: fewer than two guids present, or agreement.
 */
export function guidMismatch(manifests: ModuleManifest[]): string[] | null {
  const guids = [...new Set(manifests.map((m) => m.guid).filter((g) => g !== undefined))];
  return guids.length > 1 ? guids.sort() : null;
}
