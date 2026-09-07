import { ApiTree, Chevron } from './api-tree';
import { RailScroll } from './rail-scroll';
import { ROOT_TITLE, SECTIONS, type DocPage } from '@/lib/docs/ia';
import type { NavType } from '@/lib/docs/tree';
import Link from 'next/link';

/**
 * The guide sidebar, rendered from `ia.ts` rather than from what exists on disk.
 *
 * The whole tree is shown from the start, including pages nobody has written
 * yet. That is deliberate: the structure was agreed up front and M3 fills it in
 * over many tickets, so a nav built from the filesystem would reshuffle itself
 * every time a page landed, and a reader would have no way to tell "not written"
 * from "does not exist". Unwritten pages are visibly dimmed and not links.
 *
 * Sibling of `ApiNav`, which does the same job for a pinned `/docs/sdk/<version>`.
 * That one is a disclosure tree over 284 types and this is a fixed list of about
 * forty pages, so they shared an idea and no code - until TI-79, which hangs the
 * same tree under the "Titanium API" row when the reader is inside the API.
 * `ApiTree` is the shared half; the rails around it stay separate.
 *
 * ## Four states, four strengths
 *
 * A link at rest is full-strength `text`, the page you are on is `link`, and a
 * page nobody has written is `text-subtle`. The first of those used to be
 * `text-muted`, one small step from the unwritten state and the same token the
 * article body uses - so an available page read as a disabled one, and the nav
 * read as more body copy. Contrast was never the problem (`text-muted` is 7.3:1
 * on white); the problem was that three different meanings looked alike.
 *
 * The fourth is a section heading, which is not a row at all: smaller,
 * uppercase, and never interactive. Same reasoning applied a second time. See
 * `SectionHeading`.
 */

export type GuideNavProps = {
  /** The current `/docs`-rooted path, for marking the active page. */
  current: string;
  /** Paths that have content. Everything else renders as pending. */
  written: ReadonlySet<string>;
  /**
   * The API namespace tree, drawn under the section link whose href is `base`.
   *
   * Present only under `/docs/sdk`. TI-28 measured the tree at 78 KiB of markup
   * per page, which has no business on a setup page, so everywhere else that
   * row stays a single link and this stays undefined.
   *
   * `active` is the type on screen, or empty on the index. The route that
   * renders this knows it from its own params, so the tree itself renders on
   * the server and nothing here needs `usePathname()`.
   */
  apiTree?: { types: NavType[]; base: string; active: string; count: number };
};

function Row({
  href,
  title,
  active,
  written,
  depth,
}: {
  href: string;
  title: string;
  active: boolean;
  written: boolean;
  depth: 0 | 1;
}) {
  const indent = depth === 1 ? 'pl-3' : '';

  if (!written) {
    return (
      <li>
        <span
          className={`block py-1 text-sm text-text-subtle ${indent}`}
          // Says why it is not a link, for anyone who wonders whether the page
          // is missing or simply not yet written.
          title="Not written yet"
        >
          {title}
        </span>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={`block py-1 text-sm ${indent} ${
          active ? 'font-medium text-link' : 'text-text hover:text-link'
        }`}
      >
        {title}
      </Link>
    </li>
  );
}

/**
 * A section label.
 *
 * Not a link, and not a `Row`. A section is a category rather than a
 * destination, so it cannot be clickable on the strength of a file happening to
 * exist at its path - which is how "Environment Setup" came to behave unlike
 * every other section. A section with a page of its own lists it as a child
 * instead, through `section.index`.
 *
 * It gets its own weight for the reason the three link states have theirs: the
 * unwritten state is `text-subtle`, and a category borrowing it would make a
 * heading and a missing page look alike. Uppercase at a smaller size reads as a
 * label rather than as a row you failed to click.
 */
function SectionHeading({ title }: { title: string }) {
  return (
    <h2 className="py-1 text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</h2>
  );
}

/**
 * The API tree, nested under its row, behind a disclosure on a phone.
 *
 * The guides rail has no disclosure of its own - below `lg` it simply stacks
 * above the article - so 284 extra rows would bury the page. A checkbox is what
 * `ApiNav` uses for the same problem and for the same reason: the tree stays in
 * the document once, and it works with scripting off. The id differs from that
 * one because both are global and only one of them may own `#api-nav-toggle`.
 *
 * `api-nav` is a behaviour hook rather than an identity: it is what the chevron
 * rule in `globals.css` selects on, so the branches turn here too. No CSS
 * changed for this.
 */
function ApiSubtree({ tree }: { tree: NonNullable<GuideNavProps['apiTree']> }) {
  return (
    <>
      {/* Hidden above `lg` for the reason `ApiNav`'s twin is: `sr-only` leaves
          the control focusable and named only by a label that is itself
          display:none at that width. See the note there. */}
      <input id="guide-api-toggle" type="checkbox" className="peer sr-only lg:hidden" />
      <label
        htmlFor="guide-api-toggle"
        className="ml-3 flex cursor-pointer items-center gap-1.5 py-1 text-sm text-text-muted peer-checked:[&_svg]:rotate-90 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus lg:hidden"
      >
        <Chevron className="transition-transform" />
        Browse types
        <span className="ml-auto font-mono text-xs text-text-subtle">{tree.count}</span>
      </label>
      <div className="api-nav ml-3 hidden text-sm peer-checked:block lg:block">
        <ApiTree types={tree.types} base={tree.base} active={tree.active} />
      </div>
    </>
  );
}

export function GuideNav({ current, written, apiTree }: GuideNavProps) {
  return (
    // The id is `RailScroll`'s handle on the box that actually scrolls: the
    // <aside> carries `overflow-y-auto`, not the <nav> inside it.
    <aside
      id="guide-rail"
      className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto"
    >
      {/* Remembers where the rail was left. Rendered for every docs page, not
          just the ones carrying the tree: a guides rail long enough to scroll
          resets on navigation just as visibly. */}
      <RailScroll selector="#guide-rail" storageKey="docs:rail" />
      <nav aria-label="Documentation">
        {/* `/docs` is a page like any other and the only one no section holds,
            so without this row the tree cannot reach it. Unindented and with no
            rule down its left, because it hangs off no category: it sits level
            with the section labels rather than under one. */}
        <ul className="mb-5">
          <Row
            href="/docs"
            title={ROOT_TITLE}
            active={current === '/docs'}
            written={written.has('/docs')}
            depth={0}
          />
        </ul>
        {SECTIONS.map((section) => {
          const base = `/docs/${section.slug}`;
          const covered = new Set(section.index?.covers ?? []);
          const uncovered = section.pages.filter((page) => !covered.has(page.slug));
          return (
            <div key={section.slug} className="mb-5">
              <SectionHeading title={section.title} />
              <ul className="mt-0.5 ml-1.5 border-l border-border pl-2">
                {!!section.index && (
                  <>
                    <Row
                      href={base}
                      title={section.index.title}
                      active={current === base}
                      written={written.has(base)}
                      depth={0}
                    />
                    {/* The pages that row introduces, drawn under it. They are
                        its siblings by URL and its children editorially; see
                        `covers` in `ia.ts`. */}
                    {section.pages
                      .filter((page) => covered.has(page.slug))
                      .map((page: DocPage) => {
                        const path = `${base}/${page.slug}`;
                        return (
                          <Row
                            key={page.slug}
                            href={path}
                            title={page.title}
                            active={current === path}
                            written={written.has(path)}
                            depth={1}
                          />
                        );
                      })}
                  </>
                )}
                {/* Somewhere else on the site that belongs in this section.
                    Always a link: `written` tracks pages this route renders,
                    and these are not among them. */}
                {section.links?.map((link) => {
                  const tree = apiTree?.base === link.href ? apiTree : undefined;
                  return (
                    <li key={link.href}>
                      <ul>
                        <Row
                          href={link.href}
                          title={link.title}
                          // Current on the index itself. A type page below it is
                          // marked inside the tree, on its own row.
                          active={!!tree && tree.active === ''}
                          written
                          depth={0}
                        />
                      </ul>
                      {!!tree && <ApiSubtree tree={tree} />}
                    </li>
                  );
                })}
                {uncovered.map((page: DocPage) => {
                  const path = `${base}/${page.slug}`;
                  return (
                    <li key={page.slug}>
                      <ul>
                        <Row
                          href={path}
                          title={page.title}
                          active={current === path}
                          written={written.has(path)}
                          depth={0}
                        />
                      </ul>
                      {!!page.pages?.length && (
                        <ul>
                          {page.pages.map((child) => {
                            const childPath = `${path}/${child.slug}`;
                            return (
                              <Row
                                key={child.slug}
                                href={childPath}
                                title={child.title}
                                active={current === childPath}
                                written={written.has(childPath)}
                                depth={1}
                              />
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
