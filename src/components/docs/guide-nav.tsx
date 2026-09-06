import { SECTIONS, type DocPage } from '@/lib/docs/ia';
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
 * Sibling of `ApiNav`, which does the same job for `/docs/sdk` - that one is a
 * disclosure tree over 45,610 types, this one is a fixed list of about forty
 * pages, so they share an idea and no code.
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

export function GuideNav({ current, written }: GuideNavProps) {
  return (
    <aside className="lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto">
      <nav aria-label="Documentation">
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
