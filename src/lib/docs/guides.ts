import { BlockError, renderBlocks, unresolvedMarkers } from './blocks.ts';
import { withHeadingAnchors, type Heading } from './headings.ts';
import {
  allPaths,
  findPage,
  isValidSlug,
  MAX_DEPTH,
  PLATFORM_IDS,
  reservedSegments,
  SECTIONS,
  type PlatformId,
} from './ia.ts';
import { renderMarkdown } from './markdown.ts';
import { DirectiveError, expandDirectives, referencedPartials } from './partials.ts';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

/**
 * Guide pages, read from `content/docs/**\/*.md` (TI-32).
 *
 * ## Markdown, not MDX
 *
 * The ticket is titled "MDX content pipeline", and this is not MDX. That is
 * deliberate and worth stating plainly rather than discovering later.
 *
 * This repository already has a markdown pipeline - markdown-it, a
 * sanitize-html allowlist, Shiki, and post-render transforms for callouts and
 * heading anchors. It renders the API reference prose, module READMEs, release
 * notes and the blog. TI-53 considered MDX for the blog and rejected it in as
 * many words, to avoid ending up with two pipelines; adding it here would
 * create exactly the split that decision avoided, and would mean a guide and an
 * API page rendered the same callout through different code.
 *
 * Everything the ticket asks content authors to be able to do - callouts, tabs,
 * code groups, platform badges, version notices - is a block-level construct,
 * not arbitrary React. Those are `:::` directives, which is one small parser
 * against a whole second toolchain. If a page ever genuinely needs a component
 * with state, that is the moment to revisit this, and the decision should be
 * made then rather than assumed now.
 *
 * ## Layout on disk
 *
 * The path mirrors the URL, so a page's address is knowable from its filename:
 *
 *   content/docs/index.md                     -> /docs
 *   content/docs/setup/index.md               -> /docs/setup
 *   content/docs/setup/macos.md               -> /docs/setup/macos
 *   content/docs/build/ui/index.md            -> /docs/build/ui
 *   content/docs/build/ui/layout.md           -> /docs/build/ui/layout
 *   content/docs/_partials/install-cli.md     -> not a page
 *
 * Section and page structure lives in `ia.ts`, not in the directory listing. A
 * file with no entry there is an error rather than a page, because a guide that
 * exists but appears in no sidebar is invisible, and that failure is silent.
 *
 * An archived major is the same tree under a different root, and every function
 * here takes one: `content/docs-archive/v13/setup/macos.md` is read by exactly
 * this code and rendered by exactly the same pipeline. Which roots exist, and
 * which URL each answers at, is `doc-versions.ts` (TI-59). Nothing in this file
 * knows about versions, and that is what keeps a snapshot from being a second
 * kind of content.
 */

const CONTENT = join(process.cwd(), 'content/docs');

/**
 * Everything under here is a real content tree: the current major and the
 * archived snapshots beside it (TI-59). Anything outside it is a fixture.
 *
 * Spelled out rather than imported from `doc-versions.ts`, which reads this
 * module. The two facts are one line apart and a cycle is not worth avoiding
 * that.
 */
const CONTENT_PARENT = join(process.cwd(), 'content') + sep;

/** Overridable so tests can run the real pipeline over a fixture tree. */
const partialsIn = (root: string) => join(root, '_partials');

const FrontmatterSchema = z
  .object({
    title: z.string().min(1),
    /** Metadata only: the search snippet and tab preview, never rendered. */
    description: z.string().default(''),
    /**
     * What this page applies to. Drives `:::only` blocks and the platform
     * badge. Absent means universal, which is the common case.
     */
    platforms: z.array(z.enum(PLATFORM_IDS as [PlatformId, ...PlatformId[]])).optional(),
    /**
     * The SDK release a page's content assumes, shown as a notice.
     *
     * Finer than the URL, and not a substitute for it. The major a page belongs
     * to is decided once for the whole tree in `content/doc-versions.json`
     * (TI-59); this says which release *within* that major a passage started
     * being true, for a reader on 13.0.0 reading the v13 guides. Never write a
     * major here that disagrees with the tree the file sits in.
     */
    since: z.string().optional(),
    /**
     * Work in progress. The page still renders at its URL - that is what makes
     * it reviewable - but it is not linked from the sidebar or a section index,
     * it says so at the top, and it asks search engines not to index it.
     */
    draft: z.boolean().default(false),
  })
  // Unknown keys are a typo, not an extension point. A misspelled `platform`
  // would otherwise silently apply to every platform.
  .strict();

export type Guide = {
  /** URL path, e.g. `/docs/setup/macos`. */
  path: string;
  /** `/docs`-relative segments, e.g. `['setup', 'macos']`. Empty for `/docs`. */
  segments: string[];
  title: string;
  description: string;
  platforms?: readonly string[];
  since?: string;
  draft: boolean;
  html: string;
  toc: Heading[];
  /**
   * The page's markdown with `:::include` and `:::only` already resolved, and
   * frontmatter removed. What `html` was rendered from.
   *
   * Carried so the machine-readable output (TI-57) can serve markdown that is
   * the same page, rather than HTML turned back into markdown by a converter
   * that would have to guess. Kept as the expanded form because that is the
   * page a reader gets: an unexpanded `:::include install-cli` would hand a
   * model a marker instead of the install steps.
   */
  markdown: string;
  /** Repo-relative source, for the edit link. */
  sourcePath: string;
};

export class GuideError extends Error {}

const readerFor =
  (root: string) =>
  (name: string): string | undefined => {
    const file = join(partialsIn(root), `${name}.md`);
    return existsSync(file) ? readFileSync(file, 'utf8') : undefined;
  };

/** Where a set of segments would be read from, index form first. */
function sourceFor(root: string, segments: string[]): string | undefined {
  const base = join(root, ...segments);
  const candidates = segments.length
    ? [`${base}.md`, join(base, 'index.md')]
    : [join(root, 'index.md')];
  return candidates.find((f) => existsSync(f) && statSync(f).isFile());
}

function parse(root: string, segments: string[], file: string, text: string): Guide {
  const path = ['/docs', ...segments].join('/');
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) throw new GuideError(`${path}: no frontmatter`);

  const parsed = FrontmatterSchema.safeParse(parseYaml(m[1]));
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'frontmatter'}: ${i.message}`)
      .join('; ');
    throw new GuideError(`${path}: ${detail}`);
  }
  const front = parsed.data;

  let expanded: string;
  try {
    expanded = expandDirectives(text.slice(m[0].length), {
      platforms: front.platforms,
      readPartial: readerFor(root),
    });
  } catch (err) {
    if (err instanceof DirectiveError) throw new GuideError(`${path}: ${err.message}`);
    throw err;
  }

  // No `link` option: guide prose is written for people, not against the type
  // tree, so an `api:` URI would be a mistake rather than something to resolve.
  let rendered: string;
  try {
    rendered = renderBlocks(renderMarkdown(expanded, {}));
  } catch (err) {
    if (err instanceof BlockError) throw new GuideError(`${path}: ${err.message}`);
    throw err;
  }

  // A marker no transform consumed is a mistake that would otherwise ship as
  // literal `:::` in the prose - usually a missing blank line around it, which
  // makes markdown-it fold the marker into the paragraph below.
  const stray = unresolvedMarkers(rendered);
  if (stray.length) {
    throw new GuideError(
      `${path}: unrecognised or unclosed block marker: ${stray.join(', ')} ` +
        `(a marker needs a blank line above and below it)`
    );
  }

  const { html, toc } = withHeadingAnchors(rendered);

  return {
    path,
    segments,
    title: front.title,
    description: front.description,
    ...(front.platforms ? { platforms: front.platforms } : {}),
    ...(front.since ? { since: front.since } : {}),
    draft: front.draft,
    html,
    toc,
    markdown: expanded.trim(),
    sourcePath: file.slice(process.cwd().length + 1),
  };
}

const cache = new Map<string, Guide | null>();

/**
 * Caching is a production-only optimisation.
 *
 * A build renders every guide once and `writtenPaths` parses all of them again
 * for the sidebar, so the cache earns its place there. In `next dev` it is
 * actively wrong: markdown under `content/` is not in the module graph, so
 * editing a page does not invalidate this module, and a cached guide would be
 * served until the server was restarted. Anyone writing a page would be editing
 * a file the site refused to re-read.
 */
const CACHEABLE = process.env.NODE_ENV === 'production';

/**
 * One guide, or undefined when nothing is written yet.
 *
 * A missing page is not an error: the structure is defined up front in `ia.ts`
 * and filled in over the course of M3, so most of the tree has no file for a
 * while. The route renders a section index or a short "not written yet" state
 * rather than a 404, because the URL is real and will be filled.
 */
export function guide(segments: string[], root = CONTENT): Guide | undefined {
  // Only real trees are cached. A fixture root is a test, and caching those
  // would leak one test's content into the next.
  //
  // The key carries the root because an archived major is a second real tree
  // holding the same segments (TI-59). Keying on segments alone would serve one
  // major's macOS setup page from another's.
  const live = CACHEABLE && root.startsWith(CONTENT_PARENT);
  const key = `${root}::${segments.join('/')}`;
  if (live) {
    const hit = cache.get(key);
    if (hit !== undefined) return hit ?? undefined;
  }

  const file = sourceFor(root, segments);
  if (!file) {
    if (live) cache.set(key, null);
    return undefined;
  }
  const parsed = parse(root, segments, file, readFileSync(file, 'utf8'));
  if (live) cache.set(key, parsed);
  return parsed;
}

/** Every content file on disk, as `/docs`-relative segment lists. */
export function contentFiles(root = CONTENT): string[][] {
  if (!existsSync(root)) return [];

  const walk = (dir: string, prefix: string[]): string[][] => {
    const out: string[][] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      // Partials are fragments, not pages.
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...walk(full, [...prefix, entry.name]));
      } else if (entry.name.endsWith('.md')) {
        out.push(entry.name === 'index.md' ? prefix : [...prefix, entry.name.slice(0, -3)]);
      }
    }
    return out;
  };

  return walk(root, []);
}

/**
 * Every `/docs` path that has content, for the sidebar.
 *
 * The nav shows the whole approved structure including pages nobody has written
 * yet, so it needs to know which of them to render as links. Derived from the
 * filesystem rather than from the IA, because that is exactly the difference it
 * is being asked about - and then filtered by frontmatter, because a draft is a
 * file that exists and a page that is not ready to be sent anyone.
 */
export function writtenPaths(root = CONTENT): Set<string> {
  const out = new Set<string>();
  for (const segments of contentFiles(root)) {
    let page: Guide | undefined;
    try {
      page = guide(segments, root);
    } catch {
      // A page that does not parse is reported by `validateGuides`, which fails
      // the build. Treating it as unwritten here keeps the nav renderable in
      // `next dev` while someone is midway through fixing it.
      continue;
    }
    // A draft is deliberately not linked. It renders for whoever has the URL.
    if (page && !page.draft) out.add(page.path);
  }
  return out;
}

/**
 * Every `/docs` page worth putting in front of a search engine (TI-48).
 *
 * Three kinds of address answer under `/docs`, and only two of them are pages.
 * A path with a file is a written guide. A path with no file but with children
 * below it renders the index of those children, which is a real destination and
 * how a reader gets into a section. A path with neither renders "this page has
 * not been written yet", and no version of that is worth a search result: it is
 * thin by construction, and listing it teaches a search engine that the site
 * answers a question it does not.
 *
 * Drafts are absent, which is the third of the three places TI-53 requires, the
 * index and the feed being the others. `writtenPaths` dropping them is not on
 * its own enough: a draft that sits at a path with children below it would fall
 * through to the children rule and be listed, while the page itself is served
 * `noindex, nofollow`. So a file that exists is asked about directly, and only
 * a path with no file at all reaches the children rule.
 *
 * `/docs` itself is always here: it lists the six sections whether or not
 * anyone has written an introduction above them.
 */
export function indexableGuidePaths(root = CONTENT): string[] {
  const written = writtenPaths(root);
  return allPaths().filter((path) => {
    if (written.has(path)) return true;
    const segments = path.split('/').slice(2);
    if (!segments.length) return true;

    // Absent from `written` and yet a file: a draft, or a page that does not
    // parse - which `validateGuides` fails the build over. Neither is offered.
    try {
      if (guide(segments, root)) return false;
    } catch {
      return false;
    }

    const found = findPage(segments);
    const children = found && (found.page ? found.page.pages : found.section.pages);
    return !!children?.length;
  });
}

export type Problem = { where: string; message: string };

/**
 * Everything that should fail a build, gathered rather than thrown one at a
 * time so an author fixing content sees the whole list in one run.
 *
 * Checks, in the order they can be decided:
 *
 *   - the IA itself is well-formed (slugs, depth, reserved segments)
 *   - every content file corresponds to a page in the IA
 *   - every page parses, and its directives resolve
 *   - every internal link points at a path the IA defines
 *   - every code fence names a language the highlighter has
 *
 * The link check is why this lives here rather than in a script: it needs the
 * rendered HTML, which needs the whole pipeline.
 *
 * ## Running it over an archived major
 *
 * An archived snapshot is content like any other and gets the same checks, so a
 * partial that went missing from a snapshot fails the build rather than
 * rendering a hole (TI-59). Two things differ, and both are options rather than
 * conditionals in here:
 *
 *   - `base` prefixes the reported paths, so a problem in the v13 tree reads as
 *     `/docs/v13/setup/macos` and not as a phantom problem in current.
 *   - `structure` is off for archives. `ia.ts` is one tree shared by every
 *     major, so checking it once per major would report every structural
 *     mistake as many times as there are snapshots.
 *
 * Links inside an archived page are checked against the *current* IA, because
 * that is what the snapshot's own markdown was written against and what the
 * route resolves them to inside the archive. A page whose IA entry is deleted
 * later is reported as an orphan, which is the honest outcome: unreachable
 * archived content is worse than a build failure that names it.
 */
export function validateGuides(
  root = CONTENT,
  { base = '', structure = true }: { base?: string; structure?: boolean } = {}
): Problem[] {
  const problems: Problem[] = [];
  const known = new Set<string>(['/docs']);
  // Facts about `ia.ts`, which is one tree behind every major. Gathered
  // separately from the content problems so a run over an archive can drop them
  // rather than report the same structural mistake once per snapshot.
  const structural: Problem[] = [];

  for (const section of SECTIONS) {
    const at = `ia.ts: ${section.slug}`;
    if (!isValidSlug(section.slug)) {
      structural.push({ where: at, message: `not a valid slug` });
    }
    known.add(`/docs/${section.slug}`);

    for (const page of section.pages) {
      const path = `/docs/${section.slug}/${page.slug}`;
      if (!isValidSlug(page.slug)) structural.push({ where: path, message: 'not a valid slug' });
      // A page directly under /docs would shadow a section; one nested inside a
      // section cannot, so only the top level is checked against the list.
      known.add(path);

      for (const child of page.pages ?? []) {
        const childPath = `${path}/${child.slug}`;
        if (!isValidSlug(child.slug)) {
          structural.push({ where: childPath, message: 'not a valid slug' });
        }
        if (childPath.split('/').length - 2 > MAX_DEPTH) {
          structural.push({ where: childPath, message: `deeper than ${MAX_DEPTH} segments` });
        }
        known.add(childPath);
      }
    }
  }

  for (const reserved of reservedSegments()) {
    const claimed = SECTIONS.some((s) => s.pages.some((p) => p.slug === reserved));
    if (claimed) {
      structural.push({
        where: `ia.ts`,
        message: `a page claims the reserved segment "${reserved}"`,
      });
    }
  }

  if (structure) problems.push(...structural);

  for (const segments of contentFiles(root)) {
    const path = [`/docs${base}`, ...segments].join('/');

    if (segments.length && !findPage(segments)) {
      problems.push({
        where: path,
        message: base
          ? 'file has no entry in ia.ts, so this snapshot page is unreachable: ' +
            'restore the entry, or delete the file from the snapshot'
          : 'file has no entry in ia.ts, so it would appear in no sidebar',
      });
      continue;
    }

    let page: Guide | undefined;
    try {
      page = guide(segments, root);
    } catch (err) {
      problems.push({ where: path, message: (err as Error).message });
      continue;
    }
    if (!page) continue;

    const read = readerFor(root);
    for (const name of referencedPartials(
      readFileSync(join(process.cwd(), page.sourcePath), 'utf8')
    )) {
      if (read(name) === undefined) {
        problems.push({ where: path, message: `no such partial: ${name}` });
      }
    }

    for (const lang of new Set(unhighlightedLangs(page.html))) {
      problems.push({
        where: path,
        message: `code fence tagged \`${lang}\`, which highlight.ts has no grammar for`,
      });
    }

    for (const href of internalLinks(page.html)) {
      const [target] = href.split('#');
      // Only guide paths are checked. `/docs/sdk/...` is the generated API
      // reference, which this module knows nothing about.
      if (!target.startsWith('/docs') || target.startsWith('/docs/sdk')) continue;
      if (!known.has(target.replace(/\/$/, ''))) {
        problems.push({ where: path, message: `link to a path the IA does not define: ${href}` });
      }
    }
  }

  return problems;
}

/**
 * Languages declared on a code fence that came out unhighlighted.
 *
 * `highlightCodeBlocks` replaces a block it can colour with Shiki markup, which
 * carries no `language-` class, and leaves everything else exactly as it found
 * it. A surviving class is therefore the highlighter saying it did not know the
 * language, which renders as a plain block beside coloured ones and reads as a
 * bug rather than a choice - that is how `fish` shipped grey next to `sh`.
 *
 * An untagged fence is not reported. 44 blocks in the corpus have no language
 * on purpose, and `highlightCodeBlocks` documents why it will not guess.
 */
export function unhighlightedLangs(html: string): string[] {
  return [...html.matchAll(/<pre[^>]*><code class="language-([A-Za-z0-9_+-]+)"/g)].map((m) => m[1]);
}

/** Every `href` in rendered HTML that stays on this site. */
export function internalLinks(html: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
    const href = m[1];
    if (href.startsWith('/')) out.push(href);
  }
  return out;
}
