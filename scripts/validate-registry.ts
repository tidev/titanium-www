/**
 * Validates everything under registry/ against the Zod schemas, plus the
 * build-data shapes inherited from tidev/downloads-www.
 *
 * The schemas are a public contract - the Titanium CLI reads them through the
 * registry API - so a malformed entry has to fail CI rather than ship.
 *
 *   node scripts/validate-registry.ts [dir]
 */
import { CONTENTS, ContentsSchema, poolPath } from '../src/lib/docs/pool.ts';
import {
  ApiIndexSchema,
  ApiTypeSchema,
  BranchesSchema,
  DeveloperProfileSchema,
  expiryProblem,
  BuildListSchema,
  CliReleasesSchema,
  PrunedListSchema,
  BlockedListSchema,
  CommunityIndexSchema,
  ModuleIndexSchema,
  VerifiedListSchema,
  ModuleVersionSchema,
  SdkVersionSchema,
  ToolchainSchema,
} from '../src/lib/registry/index.ts';
import { POOL_DIR } from './lib/pool.ts';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ZodType } from 'zod';

const root = process.argv[2]
  ? process.argv[2]
  : fileURLToPath(new URL('../registry', import.meta.url));

/** Picks the schema from where a file sits, so layout mistakes surface too. */
function schemaFor(rel: string): ZodType | null {
  const parts = rel.split('/');
  const file = parts.at(-1)!;

  if (parts[0] === 'builds') {
    if (file === 'branches.json') return BranchesSchema;
    // pruned/<branch>.pruned.json holds tombstones, not builds
    if (parts[1] === 'pruned') return PrunedListSchema;
    return BuildListSchema;
  }

  // Developer directory listings (TI-58), one file per person or company.
  // Checked here rather than by a script of its own so that a listing carrying
  // a mailto: fails the same gate as a malformed module manifest, and so that
  // adding one is a pull request against a directory CI already walks.
  if (parts[0] === 'directory' && parts.length === 2) return DeveloperProfileSchema;

  // docgen rebuilds from scratch when it cannot read its own manifest, so a
  // corrupt one costs time rather than correctness. Nothing to enforce.
  if (file === 'docgen-manifest.json') return null;

  // One document, not a directory: the CLI is a single package with one
  // release history, unrelated to any SDK version's directory.
  if (parts[0] === 'cli' && file === 'releases.json') return CliReleasesSchema;

  if (parts[0] === 'sdk') {
    // sdk/{ga,rc,beta}.json are release lists; sdk/<version>/ is one compiled
    // version, shaped like a module version directory.
    if (parts.length === 2) return BuildListSchema;
    if (file === CONTENTS) return ContentsSchema;
    if (file === 'metadata.json') return SdkVersionSchema;
    if (file === 'toolchain.json') return ToolchainSchema;
  }

  if (parts[0] === 'modules') {
    // The community index sits beside the curated directories rather than in
    // one of them: it describes repos this site does not host pages for.
    if (parts.length === 2 && file === 'community.json') return CommunityIndexSchema;

    // The two hand-maintained curation lists, beside the scrape they qualify
    // (TI-23). They have to be named here or they are not checked at all: this
    // function falls through to `null`, which skips rather than fails, so an
    // unlisted file passes CI silently however malformed it is.
    if (parts.length === 2 && file === 'verified.json') return VerifiedListSchema;
    if (parts.length === 2 && file === 'blocked.json') return BlockedListSchema;

    // modules/<id>/index.json describes the package: versions, platforms, repo.
    // The compiled API reference for a version no longer collides with it -
    // that lives in the pool and is validated below, by the role its manifest
    // gives it rather than by where it sits.
    if (parts.length === 3 && file === 'index.json') return ModuleIndexSchema;
    if (file === CONTENTS) return ContentsSchema;
    if (file === 'metadata.json') return ModuleVersionSchema;
  }

  return null;
}

/** Every `.json` outside a pool: the pool is validated by role, not by path. */
function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (name === POOL_DIR) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.json')) out.push(full);
  }
  return out;
}

/** Directories carrying a version manifest, wherever they sit. */
function versionDirs(dir: string, depth = 4): string[] {
  if (depth < 0) return [];
  const found: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    if (!name.isDirectory() || name.name === POOL_DIR) continue;
    const full = join(dir, name.name);
    if (existsSync(join(full, CONTENTS))) found.push(full);
    else found.push(...versionDirs(full, depth - 1));
  }
  return found;
}

let ok = 0;
let failed = 0;
let skipped = 0;

function check(file: string, rel: string, schema: ZodType) {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (err) {
    console.log(`  FAIL  ${rel}  not valid JSON: ${(err as Error).message}`);
    failed++;
    return;
  }

  const result = schema.safeParse(data);
  if (result.success) {
    ok++;
    return;
  }
  failed++;
  console.log(`  FAIL  ${rel}`);
  for (const issue of result.error.issues.slice(0, 4)) {
    console.log(`          ${issue.path.join('.') || '<root>'}: ${issue.message}`);
  }
}

for (const file of walk(root).sort()) {
  const rel = relative(root, file);
  const schema = schemaFor(rel);
  if (!schema) {
    console.log(`  skip  ${rel}  (no schema for this path)`);
    skipped++;
    continue;
  }
  check(file, rel, schema);
}

/**
 * Pooled documents, under the schema the manifest that names them implies.
 *
 * A blob's path says nothing about what it holds - that is the point of content
 * addressing - so the role has to come from the manifest. This is stronger than
 * the depth rule it replaces: a document is checked as whatever a reader will
 * actually load it as, and a manifest naming the wrong kind of file fails here
 * rather than at render time. Each distinct blob is checked once however many
 * versions share it.
 */
const seen = new Set<string>();
for (const dir of versionDirs(root)) {
  const parsed = ContentsSchema.safeParse(JSON.parse(readFileSync(join(dir, CONTENTS), 'utf8')));
  // The manifest itself already failed in the walk above; do not report twice.
  if (!parsed.success) continue;
  const contents = parsed.data;

  for (const [entry, schema] of [
    [contents.index, ApiIndexSchema] as const,
    ...Object.values(contents.types).map((e) => [e, ApiTypeSchema] as const),
  ]) {
    const path = poolPath(dir, entry);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    check(path, `${relative(root, dir)} -> ${entry}`, schema);
  }
}

/**
 * The two directory rules a schema cannot see (TI-58).
 *
 * A listing's `id` is its URL, so it has to equal the filename: nothing in a
 * Zod schema knows what file it is parsing, and a mismatch would render a page
 * at one address while every link pointed at another.
 *
 * The expiry cap is checked here for a subtler reason. It is written as "no
 * further ahead than three months from today", which only ever becomes more
 * true as time passes, so a commit that passes now still passes when CI re-runs
 * it next year. A check that also failed on a date in the *past* would turn
 * every expired listing into a red build on pull requests that never touched
 * the directory, and expiry is the mechanism working rather than a defect.
 * Expired listings simply stop being rendered; see
 * `src/lib/directory/profile.ts`.
 */
const directoryDir = join(root, 'directory');
if (existsSync(directoryDir)) {
  const now = new Date();
  for (const name of readdirSync(directoryDir).sort()) {
    if (!name.endsWith('.json')) continue;

    // Both failures below are already reported by the walk above, so this pass
    // skips them rather than reporting them twice. Broken JSON has to be caught
    // rather than left to throw: the walk prints a usable `FAIL ... not valid
    // JSON` line, and an uncaught SyntaxError here would then kill the script
    // before the summary, taking every other listing's id and expiry check with
    // it.
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(join(directoryDir, name), 'utf8'));
    } catch {
      continue;
    }

    const parsed = DeveloperProfileSchema.safeParse(data);
    if (!parsed.success) continue;

    const problems: string[] = [];
    if (parsed.data.id !== basename(name, '.json')) {
      problems.push(`id is "${parsed.data.id}"; it must match the filename`);
    }
    const expiry = expiryProblem(parsed.data, now);
    if (expiry) problems.push(expiry);

    if (problems.length) {
      failed++;
      console.log(`  FAIL  directory/${name}`);
      for (const problem of problems) console.log(`          ${problem}`);
    }
  }
}

console.log(`\n${ok} valid, ${failed} invalid, ${skipped} skipped`);
process.exit(failed === 0 ? 0 : 1);
