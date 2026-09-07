import {
  ARCHIVE_ROOT,
  CURRENT_ROOT,
  manifest,
  validateDocVersions,
  type DocVersionManifest,
} from '../src/lib/docs/doc-versions.ts';
import { RESERVED_ROOTS } from '../src/lib/docs/ia.ts';
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Cuts a snapshot of the guides when an SDK major ships (TI-59).
 *
 *   node scripts/snapshot-docs.ts v14      archive the current major, make v14 current
 *   node scripts/snapshot-docs.ts --prune  apply the retention policy on its own
 *   node scripts/snapshot-docs.ts --check  report drift, write nothing
 *
 *   ... --dry-run                          print the plan, touch nothing
 *
 * ## What it does, and why it is a script
 *
 * Prose is versioned by major, and the copy is the whole mechanism: the current
 * tree is snapshotted once per major and then keeps being edited in place. That
 * is Docusaurus's model, and it works because the cost is paid per major rather
 * than per release.
 *
 * Doing it by hand once means doing it wrong the second time. The steps that
 * are easy to get wrong are all here: the copy has to take the whole six
 * section tree *and* `_partials` (a snapshot missing its partials renders
 * holes), it must not take the API reference, the manifest and the directories
 * have to move together, and the retention window has to be applied or the
 * deployment grows by about 13MB a major until it hits the cap.
 *
 * ## What is never copied
 *
 * `/docs/sdk` is versioned per release and compiled into `registry/`, so it is
 * not under `content/docs` and the copy cannot reach it. That is a property of
 * the layout rather than a rule anyone has to remember, and this script asserts
 * it anyway: a reserved root appearing inside the content tree would be a
 * mistake serious enough to stop the snapshot.
 *
 * Images are not copied either. They live in `public/docs/guides/` and are
 * shared by every major, which is the same reasoning as
 * `scripts/sync-doc-assets.ts`: nineteen copies of one screenshot is 9MB of
 * nothing.
 *
 * ## Retention
 *
 * `retain` in the manifest, currently two archived majors beside the current
 * one. Anything older is deleted and recorded in `dropped`, where
 * `next.config.ts` picks it up and redirects `/docs/v11/...` to the same page
 * in current. The guides for a major nobody runs are read by nobody and are a
 * standing invitation to follow instructions that stopped being true years ago.
 */

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const dryRun = flag('dry-run');
const target = args.find((a) => !a.startsWith('--'));

const MANIFEST = join(process.cwd(), 'content/doc-versions.json');
const MAJOR = /^v[1-9]\d*$/;
const num = (major: string) => Number(major.slice(1));

function die(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Every file a snapshot takes, as paths relative to `content/docs`. */
function snapshotFiles(root: string): string[] {
  const out: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    )) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      const rel = relative(root, full);

      if (entry.isDirectory()) {
        // The reference is compiled per release into `registry/` and must never
        // be snapshotted per major as well. It cannot be here, and if it ever
        // is, that is a mistake to stop on rather than to copy.
        if (dir === root && RESERVED_ROOTS.includes(entry.name as never)) {
          die(
            `content/docs/${entry.name} is a reserved root and must not be snapshotted. ` +
              `The API reference is versioned per release in registry/, not per major.`
          );
        }
        walk(full);
      } else if (entry.name.endsWith('.md')) {
        out.push(rel);
      }
    }
  };

  walk(root);
  return out;
}

function copyTree(from: string, to: string, files: string[]) {
  for (const rel of files) {
    const dest = join(to, rel);
    mkdirSync(join(dest, '..'), { recursive: true });
    copyFileSync(join(from, rel), dest);
  }
}

function write(next: DocVersionManifest) {
  writeFileSync(MANIFEST, `${JSON.stringify(next, null, 2)}\n`);
}

// ------------------------------------------------------------------- --check

if (flag('check')) {
  const problems = validateDocVersions();
  if (!problems.length) {
    const { current, archived, dropped } = manifest();
    console.log(
      `Current ${current}; archived ${archived.join(', ') || 'none'};` +
        ` dropped ${dropped.join(', ') || 'none'}.`
    );
    process.exit(0);
  }
  console.error(`${problems.length} problem(s):\n`);
  for (const { where, message } of problems) console.error(`  ${where}\n    ${message}`);
  process.exit(1);
}

// ------------------------------------------------------------------ the work

const before = manifest();
let next: DocVersionManifest = {
  ...before,
  archived: [...before.archived],
  dropped: [...before.dropped],
};

if (target) {
  if (!MAJOR.test(target)) die(`"${target}" is not a major. Write it as v14.`);
  if (num(target) <= num(before.current)) {
    die(`${target} is not newer than the current major, ${before.current}.`);
  }

  const archiveDir = join(ARCHIVE_ROOT, before.current);
  const files = snapshotFiles(CURRENT_ROOT);
  const pages = files.filter((f) => !f.startsWith('_')).length;

  console.log(
    `Snapshotting ${before.current} (${pages} pages, ${files.length - pages} partials) ` +
      `into content/docs-archive/${before.current}, and making ${target} current.`
  );

  if (!dryRun) {
    try {
      statSync(archiveDir);
      die(`content/docs-archive/${before.current} already exists. Delete it or fix the manifest.`);
    } catch {
      // Absent, which is the only state a snapshot may be cut into.
    }
    copyTree(CURRENT_ROOT, archiveDir, files);
  }

  next = { ...next, current: target, archived: [before.current, ...next.archived] };
} else if (!flag('prune')) {
  die(
    'Usage: node scripts/snapshot-docs.ts <new major> | --prune | --check [--dry-run]\n' +
      'See the comment at the top of this file, and "Versioning" in docs/writing-guides.md.'
  );
}

// Retention, applied on every run: cutting a snapshot is exactly when the
// oldest one falls out, and a separate step to remember is a step to forget.
const kept = next.archived.slice(0, next.retain);
const drop = next.archived.slice(next.retain);

for (const major of drop) {
  console.log(
    `Dropping ${major}: past the retention window of ${next.retain}. ` +
      `/docs/${major}/... will redirect into ${next.current}.`
  );
  if (!dryRun) rmSync(join(ARCHIVE_ROOT, major), { recursive: true, force: true });
}

next = {
  ...next,
  archived: kept,
  dropped: [...drop, ...next.dropped].sort((a, b) => num(b) - num(a)),
};

if (dryRun) {
  console.log('\nDry run. The manifest would become:\n');
  console.log(JSON.stringify(next, null, 2));
  process.exit(0);
}

write(next);

const problems = validateDocVersions();
if (problems.length) {
  console.error(`\nThe result does not validate:\n`);
  for (const { where, message } of problems) console.error(`  ${where}\n    ${message}`);
  process.exit(1);
}

console.log(
  `\nDone. Current ${next.current}; archived ${next.archived.join(', ') || 'none'}.\n\n` +
    `Next:\n` +
    `  1. Edit content/docs for ${next.current}. The snapshot is frozen and keeps its own copy.\n` +
    `  2. pnpm check:docs && pnpm build\n` +
    `  3. Commit content/docs-archive and content/doc-versions.json together.`
);
