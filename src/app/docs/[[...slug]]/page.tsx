import { Breadcrumbs, type Crumb } from '@/components/docs/breadcrumbs';
import { GuideNav } from '@/components/docs/guide-nav';
import { GuideToc } from '@/components/docs/guide-toc';
import { DocsNavDrawer } from '@/components/docs/nav-drawer';
import { ArchivedVersionNotice, VersionSwitcher } from '@/components/docs/version-switcher';
import {
  archivedSeo,
  basePath,
  contentRoot,
  currentMajor,
  docHref,
  guideVersionOptions,
  hasPage,
  publishedMajors,
  routedPaths,
  splitDocPath,
  versionizeLinks,
  writtenPathsFor,
  type DocMajor,
} from '@/lib/docs/doc-versions';
import { formatDate } from '@/lib/docs/format';
import { guide, type Guide } from '@/lib/docs/guides';
import {
  allPaths,
  findPage,
  platformLabel,
  SECTIONS,
  type DocPage,
  type DocSection,
} from '@/lib/docs/ia';
import { lastUpdated } from '@/lib/docs/last-updated';
import { NOINDEX } from '@/lib/seo';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

/**
 * Every guide page, and the section and docs indexes (TI-32), at every
 * published SDK major (TI-59).
 *
 * An optional catch-all, so one file serves `/docs`, `/docs/setup`,
 * `/docs/build/ui/layout` and `/docs/v13/setup/macos`. `/docs/sdk/...` is a
 * static segment and wins over this one, which is what keeps the API reference
 * where it is.
 *
 * ## Why the major is handled here rather than in its own route
 *
 * `/docs/[version]/[[...slug]]` cannot exist beside `/docs/[[...slug]]`: two
 * dynamic segments at one level is a routing conflict, not a preference. So the
 * major is the first segment of the catch-all, recognised by spelling and
 * resolved by `splitDocPath`. `ia.test.ts` holds every section slug away from
 * that spelling, so a section can never be mistaken for a major or the reverse.
 *
 * The current major is unversioned and archived majors are prefixed, which
 * means the pages that get linked keep the short URL and nothing has to
 * redirect when a major rolls. `/docs/v13/...` while v13 is current is a
 * redirect to the unversioned page rather than a second copy of it, so `latest`
 * and the current major both resolve without duplicating a single built page.
 * See `latestRedirects` in `next.config.ts`.
 *
 * Prerendered: the whole tree is about forty pages per major read from local
 * markdown, against 5,680 API type pages that are rendered on demand. There is
 * no reason for a guide to pay a cold render.
 *
 * ## A defined path with no content is not a 404
 *
 * The structure was agreed up front and M3 fills it in over many tickets, so
 * for a while most of these paths have no file. They still resolve, and say
 * plainly that the page is not written yet with links to what is. A 404 would
 * tell a reader the page does not exist, which is a different and untrue claim
 * - and would make every link written ahead of its target a build failure.
 *
 * In an archived major the same path resolves and says something different: the
 * snapshot is frozen, so a page missing from it was never in that major. It
 * points at the current guides instead of promising the page is coming.
 *
 * A path the IA does *not* define is a genuine 404.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  // `/docs` itself is the empty case: an optional catch-all takes no `slug`.
  //
  // The current major contributes its unversioned paths and each archived major
  // its prefixed ones. Nothing emits `/docs/<current major>/...`: that spelling
  // redirects, and generating it would be the duplicate this scheme exists to
  // avoid.
  const paths = [...allPaths(), ...publishedMajors().slice(1).flatMap(routedPaths)];

  return paths.map((path) => {
    const segments = path.split('/').slice(2);
    return segments.length ? { slug: segments } : { slug: undefined };
  });
}

const segmentsOf = (slug: string[] | undefined) => slug ?? [];

export async function generateMetadata({
  params,
}: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const { major, rest, explicit, known } = splitDocPath(segmentsOf((await params).slug));
  if (explicit && !known) return {};

  const path = docHref(major, rest);
  const page = guide(rest, contentRoot(major));
  const found = rest.length ? findPage(rest) : undefined;

  const title = page?.title ?? found?.page?.title ?? found?.section.title ?? 'Documentation';
  const description =
    page?.description ??
    found?.page?.blurb ??
    found?.section.blurb ??
    'Titanium SDK documentation.';

  // "Windows Setup - Getting Started - Titanium SDK". The section is what
  // tells a search result, or a crowded tab strip, which of several Setup pages
  // this is.
  //
  // An archived major names itself in the last part rather than the first, so
  // two majors of one page sort together in a tab strip and are still told
  // apart. Current says nothing, because current is the unmarked case.
  //
  // Consecutive repeats collapse, which is what keeps a section index from
  // announcing itself twice and what stops `/docs` - whose own title is the
  // site's - rendering as "Titanium SDK - Titanium SDK".
  const archived = major !== currentMajor();
  const parts = [title, found?.section.title, `Titanium SDK${archived ? ` ${major}` : ''}`].filter(
    (p) => !!p
  );

  const seo = archived ? archivedSeo(major, rest) : { canonical: path, index: true };

  return {
    title: parts.filter((part, i) => part !== parts[i + 1]).join(' - '),
    description,
    // An archived page canonicalises to its equivalent in current, so the two
    // do not compete for the same query. Where current has no equivalent there
    // is nothing to consolidate to and the page goes `noindex, follow`
    // instead. See `archivedSeo`.
    alternates: { canonical: `${SITE_URL}${seo.canonical}` },
    // A page's own verdict wins over the archive's. A draft, or a defined path
    // with nothing written under it, should stay out of the index whichever
    // major it sits in; only where the page itself has no objection does the
    // archived-orphan rule decide.
    ...(robotsFor(rest, contentRoot(major)) ?? (seo.index ? {} : { robots: NOINDEX })),
  };
}

/**
 * When a `/docs` path should be kept out of search, and why (TI-48).
 *
 * Two cases, and they want different verdicts. A draft renders so it can be
 * reviewed at its URL, but it is not finished prose and should not be what a
 * search brings someone to; it is `follow: false` as well, because a draft is
 * usually written against pages that do not exist yet.
 *
 * A defined path with no file and nothing below it is the other. It renders
 * "this page has not been written yet" above links to what is written, so it is
 * `noindex` and followed: thin enough that indexing it would teach a search
 * engine the site answers a question it does not, and the links off it are
 * real. `indexableGuidePaths` applies the same rule to the sitemap.
 */
function robotsFor(segments: string[], root?: string): { robots: Metadata['robots'] } | undefined {
  const page = guide(segments, root);
  if (page) return page.draft ? { robots: { index: false, follow: false } } : undefined;
  if (!segments.length) return undefined;

  const found = findPage(segments);
  const children = found && (found.page ? found.page.pages : found.section.pages);
  return children?.length ? undefined : { robots: NOINDEX };
}

/** GitHub's edit view for the file behind a page. */
const editUrl = (sourcePath: string) =>
  `https://github.com/tidev/titaniumsdk.com/edit/main/${sourcePath}`;

function crumbsFor(rest: string[], prefix: string): Crumb[] {
  const root = `/docs${prefix}`;
  const crumbs: Crumb[] = [{ label: 'Docs', href: root }];
  const found = rest.length ? findPage(rest) : undefined;
  if (!found) return crumbs;

  // A section with a page of its own does not own its path: that page does, and
  // it is a sibling of the section's other pages rather than their parent. So
  // the category is a plain label and its page becomes a crumb in its own
  // right. Without `index` the path is the generated index of the section's
  // children, which is a real destination and stays a link.
  const index = found.section.index;
  crumbs.push(
    index
      ? { label: found.section.title }
      : { label: found.section.title, href: `${root}/${found.section.slug}` }
  );

  // A page the section's own page introduces sits under it in the sidebar, so
  // it sits under it here. Those two describing the same page differently is
  // the whole reason `covers` is written down rather than inferred.
  if (index?.covers?.includes(rest[1] ?? '')) {
    crumbs.push({ label: index.title, href: `${root}/${found.section.slug}` });
  }
  // A third-level page sits under a parent that is itself a page.
  if (rest.length === 3) {
    const parent = found.section.pages.find((p) => p.slug === rest[1]);
    if (parent) {
      crumbs.push({ label: parent.title, href: `${root}/${found.section.slug}/${parent.slug}` });
    }
  }
  if (found.page) crumbs.push({ label: found.page.title });
  else if (index) crumbs.push({ label: index.title });
  return crumbs;
}

/** A section's or the site's children, as cards. */
function PageList({
  base,
  pages,
  links,
  written,
  pendingLabel,
}: {
  base: string;
  pages: DocPage[];
  /** Destinations outside the section, listed first and always ready. */
  links?: readonly { title: string; href: string; blurb?: string }[];
  written: ReadonlySet<string>;
  pendingLabel: string;
}) {
  const cards = [
    ...(links ?? []).map((link) => ({ ...link, key: link.href, ready: true })),
    ...pages.map((page) => {
      const href = `${base}/${page.slug}`;
      return { ...page, href, key: page.slug, ready: written.has(href) };
    }),
  ];
  return (
    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
      {cards.map((page) => {
        const { href, ready } = page;
        const body = (
          <>
            <span className="font-medium text-text">{page.title}</span>
            {!!page.blurb && (
              <span className="mt-1 block text-sm text-text-muted">{page.blurb}</span>
            )}
            {!ready && <span className="mt-2 block text-xs text-text-subtle">{pendingLabel}</span>}
          </>
        );
        return (
          <li key={page.key}>
            {ready ? (
              <Link
                href={href}
                className="block rounded-lg border border-border p-4 hover:border-border-strong"
              >
                {body}
              </Link>
            ) : (
              <div className="block rounded-lg border border-dashed border-border p-4 opacity-70">
                {body}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The six sections, on the docs landing.
 *
 * Deliberately carries no "N of M pages written" counter. That is our progress,
 * not the reader's business, and a page advertising how unfinished it is invites
 * them to leave. Which individual pages are pending is visible where it is
 * actionable - in the sidebar and on the section index.
 */
function SectionList({ prefix }: { prefix: string }) {
  return (
    <ul className="mt-8 grid gap-4 sm:grid-cols-2">
      {SECTIONS.map((section) => (
        <li key={section.slug}>
          <Link
            href={`/docs${prefix}/${section.slug}`}
            className="block rounded-lg border border-border p-5 hover:border-border-strong"
          >
            <span className="font-medium text-text">{section.title}</span>
            <span className="mt-1 block text-sm text-text-muted">{section.blurb}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Where to go when the page a reader asked for has no content yet. */
function Pending({ section, page }: { section: DocSection; page?: DocPage }) {
  return (
    <div className="mt-8 rounded-lg border border-dashed border-border p-6">
      <p className="text-text">This page has not been written yet.</p>
      <p className="mt-2 text-sm text-text-muted">
        {page ? `${page.title} is part of ` : 'It belongs to '}
        <Link href={`/docs/${section.slug}`} className="text-link hover:underline">
          {section.title}
        </Link>
        , which is being written as part of the documentation rewrite. The{' '}
        <Link href="/docs/sdk" className="text-link hover:underline">
          API reference
        </Link>{' '}
        is complete and searchable in the meantime.
      </p>
    </div>
  );
}

/**
 * The same state in an archived major, which is a different fact.
 *
 * A snapshot is frozen, so a page it does not carry was never in that major.
 * "Not written yet" would promise something nobody is going to write, and the
 * useful answer is the current page, where it exists.
 */
function NotInThisMajor({
  major,
  rest,
  section,
}: {
  major: DocMajor;
  rest: string[];
  section: DocSection;
}) {
  const current = currentMajor();
  const inCurrent = hasPage(current, rest);
  return (
    <div className="mt-8 rounded-lg border border-dashed border-border p-6">
      <p className="text-text">This page is not part of the {major} guides.</p>
      <p className="mt-2 text-sm text-text-muted">
        {inCurrent
          ? `It was written after ${major} was archived, and a snapshot is never added to. `
          : `The ${current} guides do not have it either. `}
        <Link href={docHref(current, inCurrent ? rest : [])} className="text-link hover:underline">
          {inCurrent ? `Read it in ${current}` : `Browse the ${current} guides`}
        </Link>
        , or stay in {major} and pick another page from{' '}
        <Link href={docHref(major, [section.slug])} className="text-link hover:underline">
          {section.title}
        </Link>
        .
      </p>
    </div>
  );
}

function Meta({ page }: { page: Guide }) {
  const updated = lastUpdated(page.sourcePath);
  return (
    <div className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-4 text-sm text-text-subtle">
      <a
        href={editUrl(page.sourcePath)}
        rel="noopener noreferrer"
        className="text-link hover:underline"
      >
        Edit this page on GitHub
      </a>
      {!!updated && <span>Last updated {formatDate(updated)}</span>}
    </div>
  );
}

export default async function DocsPage({ params }: PageProps<'/docs/[[...slug]]'>) {
  const { major, rest, explicit, known } = splitDocPath(segmentsOf((await params).slug));
  if (explicit && !known) notFound();

  const found = rest.length ? findPage(rest) : undefined;
  if (rest.length && !found) notFound();

  const current = currentMajor();
  const archived = major !== current;
  const prefix = basePath(major);
  const path = docHref(major, rest);

  const page = guide(rest, contentRoot(major));
  const written = writtenPathsFor(major);

  // The page's own children, when it has any: a section index lists its pages,
  // and `build/ui` lists the four below it.
  const children = !found ? undefined : found.page ? found.page.pages : found.section.pages;
  // Only the section's own index lists them. A page inside the section is not
  // where someone looks for the section's out-links.
  const sectionLinks = found && !found.page ? found.section.links : undefined;

  const title = page?.title ?? found?.page?.title ?? found?.section.title ?? 'Documentation';

  // A control with one option is not a switcher. It appears the moment there is
  // a second major to move to, which is the moment it means anything.
  const options = publishedMajors().length > 1 ? guideVersionOptions(rest) : [];
  const inCurrent = archived && hasPage(current, rest);

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-x-8 px-4 py-8 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8 xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
      <DocsNavDrawer>
        <GuideNav
          current={path}
          written={written}
          prefix={prefix}
          pendingTitle={archived ? `Not in ${major}` : 'Not written yet'}
        />
      </DocsNavDrawer>

      <article className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Breadcrumbs crumbs={crumbsFor(rest, prefix)} />
          {!!options.length && (
            <VersionSwitcher
              current={major}
              options={options}
              label="Guides"
              latestLabel="current"
              className="ml-auto"
            />
          )}
        </div>

        {archived && (
          <ArchivedVersionNotice
            major={major}
            current={current}
            href={docHref(current, inCurrent ? rest : [])}
            samePage={inCurrent}
          />
        )}

        {/* No lede under the title: `description` is written for the search
            result and repeating it above the opening paragraph says the same
            thing twice. It reaches the reader through `generateMetadata`. */}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text">{title}</h1>

        {(!!page?.platforms?.length || !!page?.since) && (
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-subtle">
            {!!page.platforms?.length && (
              <span>Applies to {page.platforms.map(platformLabel).join(', ')}</span>
            )}
            {/* The release the page's content assumes, within its major. The
                major is in the URL; this is the finer grain, for a reader on an
                older release of the same major. */}
            {!!page.since && <span>Written for Titanium SDK {page.since} and later</span>}
          </p>
        )}

        {!!page?.draft && (
          <p className="mt-4 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-text-muted">
            This is a draft. It is not linked from the sidebar, and search engines are asked to skip
            it.
          </p>
        )}

        {page ? (
          <div
            className="prose-docs mt-8 text-text-muted"
            // Sanitized in renderMarkdown; see the allowlist there. The link
            // rewrite runs after sanitising and only edits `href` values the
            // allowlist already passed.
            dangerouslySetInnerHTML={{ __html: versionizeLinks(page.html, major) }}
          />
        ) : found ? (
          archived ? (
            <NotInThisMajor major={major} rest={rest} section={found.section} />
          ) : (
            <Pending section={found.section} page={found.page} />
          )
        ) : null}

        {(!!children?.length || !!sectionLinks?.length) && (
          <PageList
            base={path}
            pages={children ?? []}
            links={sectionLinks}
            written={written}
            pendingLabel={archived ? `Not in ${major}` : 'Not written yet'}
          />
        )}
        {!rest.length && <SectionList prefix={prefix} />}

        {!!page && <Meta page={page} />}
      </article>

      {page ? <GuideToc headings={page.toc} /> : <div />}
    </div>
  );
}
