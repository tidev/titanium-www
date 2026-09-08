import { SCHEMA_VERSION, ToolchainSchema, type Toolchain } from '../src/lib/registry/index.ts';
import { CLI_COMMANDS, highestCliVersion } from './lib/cli-version.ts';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Records what each compiled SDK release needs from the machine, into
 * `registry/sdk/<version>/toolchain.json`.
 *
 *   node scripts/capture-toolchain.ts                      every version missing one
 *   node scripts/capture-toolchain.ts 13.4.1               just these
 *   node scripts/capture-toolchain.ts --checkout ~/ti/sdk  read a clone you already have
 *   node scripts/capture-toolchain.ts --force              rewrite ones already captured
 *
 * ## Why this exists
 *
 * The compatibility matrix was hand-written for a decade and the legacy audit
 * flags the page it replaces as factually wrong. Nothing about "Xcode 15.0 to
 * 26.x" can be checked by a build, so it rotted.
 *
 * It never had to be hand-written. The SDK declares every one of those ranges
 * in its own source, and the tooling reads those declarations rather than a
 * document:
 *
 *   android/package.json  vendorDependencies       node-titanium-sdk's
 *                                                  lib/android.js prints these
 *                                                  beside "Supported:" in
 *                                                  `ti info`, and uses them to
 *                                                  mark an install unsupported
 *   iphone/package.json   vendorDependencies       ioslib's supportedVersions,
 *                                                  which is what makes an Xcode
 *                                                  "too old" or "too new"
 *   package.json          vendorDependencies.node  titanium-cli's src/cli.js,
 *                                                  which refuses the SDK outright
 *
 * This transcribes them per release and the page renders the transcription, so
 * the page can only be wrong if the SDK is wrong about itself.
 *
 * ## Why it is not part of the build
 *
 * The build reads the filesystem and nothing else (TI-25, enforced by
 * `scripts/assert-offline.ts`). This clones a repository, so it runs by hand
 * and its output is committed, exactly like `scripts/compile-sdk-release.ts`.
 * Run it after compiling a release.
 *
 * ## Why it is keyed on the commit
 *
 * Each version directory's `metadata.json` records the commit its API reference
 * was compiled from. This reads the same commit, so the toolchain a page states
 * and the API it lists come from one tree rather than from a tag and a branch
 * that have since diverged.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SDK_DIR = join(ROOT, 'registry/sdk');

const argv = process.argv.slice(2);
const force = argv.includes('--force');
const checkoutAt = argv.indexOf('--checkout');
const inlineCheckout = argv.find((a) => a.startsWith('--checkout='));
const givenCheckout = inlineCheckout
  ? inlineCheckout.slice('--checkout='.length)
  : checkoutAt >= 0
    ? argv[checkoutAt + 1]
    : undefined;

// Without a path there is nothing to read, and falling through would clone the
// repository instead: the opposite of what `--checkout` was passed to do.
if ((checkoutAt >= 0 || inlineCheckout) && !givenCheckout) {
  console.error('--checkout needs a path, as in: --checkout ~/ti/titanium-sdk');
  process.exit(1);
}

// Every positional is a version to capture. The one exception is the argument
// `--checkout` consumes, and it is skipped by index only when that flag is
// actually present: `checkoutAt` is -1 otherwise, and skipping index 0 would
// drop the first version asked for without saying so.
const wanted = argv.filter(
  (a, i) => !a.startsWith('--') && !(checkoutAt >= 0 && i === checkoutAt + 1)
);

const run = (args: string[], cwd: string) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

type Compiled = { version: string; dir: string; repo: string; ref: string; commit: string };

/** Every compiled version directory, with the tree it was compiled from. */
function compiled(): Compiled[] {
  const out: Compiled[] = [];
  for (const entry of readdirSync(SDK_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const dir = join(SDK_DIR, entry.name);
    if (!existsSync(join(dir, 'contents.json'))) continue;

    const meta = JSON.parse(readFileSync(join(dir, 'metadata.json'), 'utf8')) as {
      source?: { repo?: string; ref?: string; commit?: string };
    };
    const { repo, ref, commit } = meta.source ?? {};
    if (!repo || !ref || !commit) {
      console.error(`${entry.name}: metadata.json records no repo, ref and commit, skipped`);
      continue;
    }
    out.push({ version: entry.name, dir, repo, ref, commit });
  }
  return out.sort((a, b) => a.version.localeCompare(b.version));
}

/**
 * A repository the wanted commits can be read out of.
 *
 * A checkout passed in is used as it is. Otherwise this makes an empty
 * repository and fetches each commit into it one at a time, shallow: the SDK is
 * far too large to clone whole for three files per release, and a tag-based
 * clone could not reach a `main` commit that has since been superseded.
 */
function repository(repo: string): {
  dir: string;
  cleanup: () => void;
  fetchOne: (commit: string) => void;
} {
  if (givenCheckout) {
    const dir = resolve(givenCheckout);
    if (!existsSync(join(dir, '.git'))) throw new Error(`${givenCheckout} is not a checkout`);
    return { dir, cleanup: () => {}, fetchOne: () => {} };
  }

  const dir = mkdtempSync(join(tmpdir(), 'sdk-toolchain-'));
  run(['init', '--quiet'], dir);
  run(['remote', 'add', 'origin', `https://github.com/${repo}.git`], dir);
  return {
    dir,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
    fetchOne: (commit) => run(['fetch', '--quiet', '--depth', '1', 'origin', commit], dir),
  };
}

/** One `package.json` at a commit, or null when the release does not carry it. */
function packageJson(dir: string, commit: string, path: string): Record<string, unknown> | null {
  try {
    return JSON.parse(run(['show', `${commit}:${path}`], dir)) as Record<string, unknown>;
  } catch (err) {
    // A path the release does not carry is a fact about the release. Anything
    // else - a fetch that did not land, an unreadable object, malformed JSON -
    // is a failure, and reporting it as "not carried" would write a
    // toolchain.json with the field silently missing. No later run would fill
    // it in either, because `todo` skips a version already captured, so the
    // page would state `-` for that release permanently.
    const stderr = String((err as { stderr?: unknown }).stderr ?? '');
    if (/does not exist|exists on disk, but not in/.test(stderr)) return null;
    throw err;
  }
}

/** One file's text at a commit, or null when the release does not carry it. */
function fileAt(dir: string, commit: string, path: string): string | null {
  try {
    return run(['show', `${commit}:${path}`], dir);
  } catch (err) {
    const stderr = String((err as { stderr?: unknown }).stderr ?? '');
    if (/does not exist|exists on disk, but not in/.test(stderr)) return null;
    throw err;
  }
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** `vendorDependencies`, keeping the ranges exactly as the release authored them. */
function vendor(pkg: Record<string, unknown> | null): Record<string, string> {
  const raw = pkg?.vendorDependencies;
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') out[key] = value;
  }
  return out;
}

function capture(at: Compiled, dir: string): Toolchain {
  const root = packageJson(dir, at.commit, 'package.json');
  const android = packageJson(dir, at.commit, 'android/package.json');
  const ios = packageJson(dir, at.commit, 'iphone/package.json');

  if (!android && !ios) {
    throw new Error(`no android/package.json and no iphone/package.json at ${at.commit}`);
  }

  const node = vendor(root).node;
  const declared = str(root?.version);
  const cli = highestCliVersion(
    CLI_COMMANDS.map((command) => fileAt(dir, at.commit, `cli/commands/${command}.js`))
  );
  const minSdk = str(android?.minSDKVersion);
  const compileSdk = str(android?.compileSDKVersion);
  const minIos = str(ios?.minIosVersion);
  const minWatchos = str(ios?.minWatchosVersion);

  const value: Toolchain = {
    schemaVersion: SCHEMA_VERSION,
    version: at.version,
    source: { repo: at.repo, ref: at.ref, commit: at.commit },
    ...(node ? { node } : {}),
    ...(declared ? { declared } : {}),
    ...(cli ? { cli } : {}),
    android: {
      ...(minSdk ? { minSdkVersion: minSdk } : {}),
      ...(compileSdk ? { compileSdkVersion: compileSdk } : {}),
      vendor: vendor(android),
    },
    ios: {
      ...(minIos ? { minIosVersion: minIos } : {}),
      ...(minWatchos ? { minWatchosVersion: minWatchos } : {}),
      vendor: vendor(ios),
    },
  };

  // Parsed back before it is written, so a shape the site cannot read fails
  // here rather than in `pnpm check:registry` after it has been committed.
  return ToolchainSchema.parse(value);
}

const targets = compiled().filter((c) => !wanted.length || wanted.includes(c.version));
for (const version of wanted) {
  if (!targets.some((t) => t.version === version)) {
    console.error(`${version} is not a compiled SDK version under registry/sdk/`);
    process.exit(1);
  }
}

const todo = targets.filter((t) => force || !existsSync(join(t.dir, 'toolchain.json')));
if (!todo.length) {
  console.log(`${targets.length} version(s) already captured. Pass --force to rewrite.`);
  process.exit(0);
}

const repos = new Set(todo.map((t) => t.repo));
if (repos.size > 1 && !givenCheckout) {
  console.error(
    `compiled versions span ${[...repos].join(', ')}; capture one repository at a time`
  );
  process.exit(1);
}

const source = repository([...repos][0]);
let written = 0;
const failed: string[] = [];

try {
  for (const at of todo) {
    try {
      source.fetchOne(at.commit);
      const value = capture(at, source.dir);
      writeFileSync(join(at.dir, 'toolchain.json'), `${JSON.stringify(value, null, 2)}\n`);
      console.log(
        `${at.version}: node ${value.node ?? 'unstated'}, ` +
          `java ${value.android.vendor.java ?? 'unstated'}, ` +
          `xcode ${value.ios.vendor.xcode ?? 'unstated'}`
      );
      written++;
    } catch (err) {
      // One release that cannot be read must not abandon the rest.
      console.error(`${at.version}: FAILED - ${(err as Error).message.split('\n')[0]}`);
      failed.push(at.version);
    }
  }
} finally {
  source.cleanup();
}

console.log(`\n${written} captured, ${failed.length} failed`);
if (failed.length) process.exit(1);
