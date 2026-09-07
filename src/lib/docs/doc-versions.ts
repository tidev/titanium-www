import { writtenPaths, type Problem } from './guides.ts';
import { allPaths, RESERVED_ROOTS, SECTIONS, VERSION_SEGMENT } from './ia.ts';
import { latestSdkVersion, MAIN } from './registry.ts';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';

/**
 * Which major of the guides a reader is looking at (TI-59).
 *
 * ## The shape of the thing
 *
 * Prose is versioned by SDK **major**, not by release. The API reference is
 * versioned per release because its surface changes per release; a guide to
 * installing the CLI does not, and copying forty pages nineteen times would buy
 * nothing but 250MB. So the two schemes are deliberately different, and the
 * switcher says which is which rather than implying they move together.
 *
 * The current major is unversioned:
 *
 *   /docs/setup/macos          the current major, canonical and indexed
 *   /docs/v13/setup/macos      an archived major
 *
 * That is the same rule the approved IA states as "no version in a guide URL":
 * the live set carries no version, and an archived major carries one because it
 * is no longer the live set. It keeps the nicest URLs on the pages that get
 * linked, it means no redirect has to fire when a major rolls, and it leaves
 * one canonical per page rather than splitting authority between two spellings
 * of the same content.
 *
 * ## One place, and it is this file's manifest
 *
 * `content/doc-versions.json` is the only place a version number is written
 * down. Not frontmatter: a page cannot know which major it belongs to, because
 * the answer is the same for every page in its tree and changes for all of them
 * at once. Forty files each carrying `version: v13` is forty chances to be
 * wrong and no way to be right.
 *
 * The manifest is written by `scripts/snapshot-docs.ts`. Editing it by hand
 * without moving the directories is caught by `pnpm check:docs`.
 *
 * ## What is not versioned
 *
 * `/docs/sdk/...` is not, and must never be, snapshotted per major. It is
 * already versioned per release and it lives in `registry/`, not in
 * `content/docs`, so the snapshot cannot reach it even by accident. See
 * `snapshotFiles` in the script for the assertion that says so out loud.
 *
 * The blog is not versioned either. A post is dated and describes a moment;
 * giving it a version would promise a revision per major that nobody is going
 * to write.
 */

/** `v13`. The `v` is part of the spelling, in the manifest and in the URL. */
export type DocMajor = string;

const MAJOR = /^v[1-9]\d*$/;

const ManifestSchema = z
  .object({
    /** The major the unversioned URLs serve. */
    current: z.string().regex(MAJOR),
    /**
     * Majors kept as snapshots under `content/docs-archive/`, newest first.
     * Length is capped by `retain`.
     */
    archived: z.array(z.string().regex(MAJOR)).default([]),
    /**
     * Majors that fell out of the retention window and were deleted. Kept so
     * their URLs can be redirected rather than 404ed, and so the record of what
     * once existed does not vanish with the directory.
     */
    dropped: z.array(z.string().regex(MAJOR)).default([]),
    /**
     * How many archived majors to keep beside the current one.
     *
     * Two, which is the current major plus roughly two years of majors behind
     * it. The cost is not theoretical: one archived major measured at about
     * 13MB of built output against a 100MB deployment cap, so this is a budget
     * rather than a preference. Guides for every major back to 3.x would be
     * both dead weight and a liability, since nobody rereads them.
     */
    retain: z.number().int().min(0).default(2),
  })
  .strict();

export type DocVersionManifest = z.infer<typeof ManifestSchema>;

const CONTENT = join(process.cwd(), 'content');
const MANIFEST = join(CONTENT, 'doc-versions.json');

/** Where the current major's pages live. Archived majors sit beside it. */
export const CURRENT_ROOT = join(CONTENT, 'docs');
export const ARCHIVE_ROOT = join(CONTENT, 'docs-archive');

let cached: DocVersionManifest | undefined;

/**
 * The manifest, parsed.
 *
 * Cached in production only, for the same reason `guides.ts` caches there only:
 * this file is not in the module graph, so a `next dev` edit would otherwise be
 * invisible until the server restarted.
 */
export function manifest(file = MANIFEST): DocVersionManifest {
  if (cached && file === MANIFEST && process.env.NODE_ENV === 'production') return cached;
  const parsed = ManifestSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  if (file === MANIFEST) cached = parsed;
  return parsed;
}

export const currentMajor = (): DocMajor => manifest().current;
export const archivedMajors = (): DocMajor[] => manifest().archived;
export const droppedMajors = (): DocMajor[] => manifest().dropped;

/** Every published major, current first. Dropped ones are not published. */
export const publishedMajors = (): DocMajor[] => [currentMajor(), ...archivedMajors()];

/** `13.4.1` and `13` both become `v13`. `main` has no major. */
export function majorOf(version: string): DocMajor | null {
  if (version === MAIN) return null;
  const first = version.split('.')[0];
  return /^[1-9]\d*$/.test(first) ? `v${first}` : null;
}

/** The major the newest compiled SDK release belongs to, when there is one. */
export function sdkMajor(): DocMajor | null {
  const latest = latestSdkVersion();
  return latest ? majorOf(latest) : null;
}

export const isArchived = (major: DocMajor): boolean => archivedMajors().includes(major);

/** True for a path segment that is spelled like a major, published or not. */
export const looksVersioned = (segment: string): boolean => VERSION_SEGMENT.test(segment);

/** Where a major's markdown lives. The current major keeps `content/docs`. */
export const contentRoot = (major: DocMajor): string =>
  major === currentMajor() ? CURRENT_ROOT : join(ARCHIVE_ROOT, major);

/** `''` for the current major, `/v13` for an archived one. */
export const basePath = (major: DocMajor): string => (major === currentMajor() ? '' : `/${major}`);

/** The URL for a set of `/docs`-relative segments at a given major. */
export const docHref = (major: DocMajor, segments: readonly string[]): string =>
  ['/docs' + basePath(major), ...segments].join('/');

/**
 * Splits a `/docs` catch-all's segments into a major and the page beneath it.
 *
 * A leading segment that is spelled like a major is always treated as one, even
 * when it names no published major: `/docs/v9/setup` must 404 rather than
 * looking for a section called `v9`. `ia.test.ts` holds section slugs to that
 * rule so the two can never collide.
 */
export function splitDocPath(segments: readonly string[]): {
  major: DocMajor;
  rest: string[];
  /** The URL named a major explicitly, whether or not it is published. */
  explicit: boolean;
  /** The named major exists. False means 404. */
  known: boolean;
} {
  const [first, ...rest] = segments;
  if (first && looksVersioned(first)) {
    return {
      major: first,
      rest,
      explicit: true,
      known: archivedMajors().includes(first),
    };
  }
  return { major: currentMajor(), rest: [...segments], explicit: false, known: true };
}

/** Every `/docs`-rooted path that has content at a major, version prefix included. */
export function writtenPathsFor(major: DocMajor): Set<string> {
  const prefix = basePath(major);
  if (!prefix) return writtenPaths();
  const root = contentRoot(major);
  if (!existsSync(root)) return new Set();
  return new Set(
    [...writtenPaths(root)].map((path) => `/docs${prefix}${path.slice('/docs'.length)}`)
  );
}

/**
 * Keeps an archived page's links inside its own major.
 *
 * Snapshot markdown is a byte copy, so its links are written unversioned:
 * `/docs/build/ui/layout` on a v13 page would walk the reader into the current
 * guides without saying so, which is the one thing a versioned archive exists
 * to prevent. Rewriting at render time rather than at snapshot time keeps the
 * archived source identical to what was published, so a diff between a snapshot
 * and the live tree shows editorial changes and nothing else.
 *
 * Reserved roots are left alone. `/docs/sdk/Titanium.UI.Window` is the API
 * reference, which is versioned per release and has no `/docs/v13` spelling;
 * pointing a v13 guide at a `/docs/v13/sdk/...` that cannot exist would turn
 * every API link in the archive into a 404.
 *
 * Only `href` is touched. `/docs/guides/*.png` is a file under `public/`, it
 * reaches the page as `src`, and there is one copy of it shared by every major.
 */
export function versionizeLinks(html: string, major: DocMajor): string {
  const prefix = basePath(major);
  if (!prefix) return html;

  // `/docs` has to end at a path boundary. Without the lookahead `/docsearch`
  // is a match with `rest` of `earch`, and the rewrite splices the prefix into
  // the middle of a word.
  return html.replace(/href="\/docs(?=["/#?])([^"]*)"/g, (whole, rest: string) => {
    const first = rest.split('/')[1] ?? '';
    // A fragment or a query directly on /docs is still the docs index.
    const segment = first.split(/[#?]/)[0];
    if (RESERVED_ROOTS.includes(segment as never) || looksVersioned(segment)) return whole;
    return `href="/docs${prefix}${rest}"`;
  });
}

/**
 * The switcher's options for a guide page, newest first.
 *
 * Shares `VersionOption` with the API reference so both feed the one switcher
 * component. `unreleased` is always false: `main` is a compiled branch of the
 * SDK, and there is no equivalent for prose - a major does not exist as a
 * documentation target until it ships.
 *
 * `present` is the reason this is computed on the server. A page added after
 * v13 was cut has nothing to land on in v13, and offering the reader a link to
 * a 404 is worse than telling them the page is not in that version.
 */
export function guideVersionOptions(
  rest: readonly string[]
): { version: string; href: string; present: boolean; latest: boolean; unreleased: boolean }[] {
  const current = currentMajor();
  return publishedMajors().map((major) => {
    const present = hasPage(major, rest);
    return {
      version: major,
      // Somewhere that exists either way: a major without this page sends the
      // reader to that major's docs index rather than to a 404.
      href: present ? docHref(major, rest) : docHref(major, []),
      present,
      latest: major === current,
      unreleased: false,
    };
  });
}

/**
 * Whether a major has something to show at these segments.
 *
 * Written content, or an index that renders a child list from `ia.ts` without
 * needing a file of its own: `/docs/build` lists the section whether or not
 * anyone wrote `build/index.md`, so it is a real destination in any major that
 * has the section. A leaf with no file is not, which is what the switcher and
 * the canonical rule both need to know.
 */
export function hasPage(major: DocMajor, rest: readonly string[]): boolean {
  if (writtenPathsFor(major).has(docHref(major, rest))) return true;
  return isIndexPath(rest);
}

/** A path that renders a list of its children rather than prose. */
export function isIndexPath(rest: readonly string[]): boolean {
  if (rest.length <= 1) return true;
  if (rest.length > 2) return false;
  const section = SECTIONS.find((s) => s.slug === rest[0]);
  return !!section?.pages.find((p) => p.slug === rest[1])?.pages?.length;
}

/**
 * Every path a major routes, version prefix included.
 *
 * The whole IA, for every major. An archived tree is frozen but the structure
 * it is drawn in is not, so a section index still renders its child list and a
 * page the snapshot never had still resolves, saying so and linking to current.
 * That is worth a handful of near-empty pages: the alternative is a sidebar
 * whose rows 404 in the archive and not in current.
 */
export function routedPaths(major: DocMajor): string[] {
  const prefix = basePath(major);
  return allPaths().map((path) => `/docs${prefix}${path.slice('/docs'.length)}`);
}

/**
 * The current major's guide URLs, for the sitemap.
 *
 * Only pages that have content: the IA defines paths that are not written yet,
 * and listing one tells a crawler to come and look at a page that says it does
 * not exist. Archived majors are deliberately absent; see `archivedSeo`.
 *
 * TI-48 owns `sitemap.ts`. This is the one function it calls for guides, so the
 * seam between the two tickets is a single import.
 */
export const currentGuideUrls = (): string[] => [...writtenPathsFor(currentMajor())].sort();

/**
 * How an archived page asks not to compete with current in search.
 *
 * Where the page exists in current, it canonicalises to it: the two are the
 * same page at different majors, the current one is the copy that should rank,
 * and consolidating is what stops "Titanium macOS setup" returning three
 * near-identical results. It stays indexable, because a canonical is a
 * consolidation rather than a removal, and an archived page is still a page
 * somebody on that SDK may need to find directly.
 *
 * Where it does not exist in current there is nothing to consolidate to, and an
 * orphan archived page ranking for a current query is exactly the problem this
 * ticket is about. Those go `noindex, follow`: out of the results, still
 * crawled, so its links keep passing.
 *
 * The alternative considered and rejected was `noindex` on everything archived.
 * It is simpler, and it makes a page nobody can find while the SDK it documents
 * is still in use.
 */
export function archivedSeo(
  major: DocMajor,
  rest: readonly string[]
): { canonical: string; index: boolean } {
  const current = currentMajor();
  const inCurrent = hasPage(current, rest);
  return {
    canonical: inCurrent ? docHref(current, rest) : docHref(major, rest),
    index: inCurrent,
  };
}

// ------------------------------------------------------------------ integrity

/**
 * Everything that can be wrong about the manifest and the trees beside it.
 *
 * Reported the same way guide content is, through `pnpm check:docs`, because
 * the failure modes are the same shape: a directory and a list of directories
 * disagreeing is exactly as silent as a page with no entry in the IA.
 */
export function validateDocVersions(): Problem[] {
  const problems: Problem[] = [];
  const where = 'content/doc-versions.json';

  let parsed: DocVersionManifest;
  try {
    parsed = manifest();
  } catch (err) {
    return [{ where, message: (err as Error).message }];
  }
  const { current, archived, dropped, retain } = parsed;

  const all = [current, ...archived, ...dropped];
  if (new Set(all).size !== all.length) {
    problems.push({ where, message: 'a major is listed more than once' });
  }

  const descending = (list: string[]) =>
    list.every((v, i) => i === 0 || Number(list[i - 1].slice(1)) > Number(v.slice(1)));
  if (!descending(archived)) {
    problems.push({ where, message: '`archived` must be newest first' });
  }
  for (const major of archived) {
    if (Number(major.slice(1)) >= Number(current.slice(1))) {
      problems.push({ where, message: `${major} is archived but is not older than ${current}` });
    }
  }

  if (archived.length > retain) {
    problems.push({
      where,
      message: `${archived.length} archived majors kept, retain is ${retain}: run pnpm docs:snapshot --prune`,
    });
  }

  // The manifest and the filesystem are two records of one fact, and the build
  // reads both. A snapshot half-applied is otherwise a 404 nobody sees until a
  // reader follows the switcher.
  for (const major of archived) {
    if (!existsSync(join(ARCHIVE_ROOT, major))) {
      problems.push({
        where,
        message: `${major} is archived but content/docs-archive/${major} is missing`,
      });
    }
  }
  if (existsSync(ARCHIVE_ROOT)) {
    for (const entry of readdirSync(ARCHIVE_ROOT, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
      if (!archived.includes(entry.name)) {
        problems.push({
          where: `content/docs-archive/${entry.name}`,
          message: 'a snapshot directory the manifest does not list',
        });
      }
    }
  }

  // A section named `v13` would shadow an archived major, and the failure would
  // read as a missing guide rather than as a naming clash.
  for (const section of SECTIONS) {
    if (looksVersioned(section.slug)) {
      problems.push({
        where: 'ia.ts',
        message: `section "${section.slug}" is spelled like a major`,
      });
    }
  }

  // The forcing function. A compiled 14.0.0 with the guides still calling
  // themselves v13 means every install step on the site is now describing the
  // previous SDK, which is the exact failure this ticket exists to prevent.
  const sdk = sdkMajor();
  if (sdk && Number(sdk.slice(1)) > Number(current.slice(1))) {
    problems.push({
      where,
      message:
        `the newest compiled SDK is ${sdk} and the guides are still ${current}: ` +
        `cut the snapshot with pnpm docs:snapshot ${sdk}`,
    });
  }

  return problems;
}
