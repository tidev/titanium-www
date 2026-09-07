import type { VersionOption } from '@/lib/docs/versions';

/**
 * Moves between compiled SDK versions (TI-27).
 *
 * ## Links, not a listbox
 *
 * The version is a path segment, so switching is a navigation - which is what
 * makes a pinned version shareable. Every option is therefore a real `<a>` with
 * a real destination, worked out on the server, and the whole control works
 * with scripting off. That matters more here than for the module filters, which
 * use the Radix `Select`: this is how a reader gets between twenty versions of
 * the reference, not a way to narrow a list they can already see.
 *
 * `<details>` gives the disclosure behaviour, keyboard support and Escape for
 * free. It does not close on an outside click without JavaScript, which is the
 * one thing lost - and every item in it navigates away, so the menu rarely
 * needs closing any other way.
 *
 * ## Versions that do not have this page
 *
 * The reference spans a year of releases and types come and go, so an option
 * can have nowhere to land. Those are kept in the list and marked rather than
 * hidden: "Titanium.UI.Shortcut is not in 12.5.0" is the answer to the reader's
 * actual question, where a silently missing row is not. They point at that
 * version's index, which is the nearest thing that does exist.
 *
 * ## Two versioning schemes, one control
 *
 * The guides are versioned by SDK major and the reference per release (TI-59),
 * so the same switcher shows `13.4.1` in one place and `v13` in the other. That
 * is a real difference and the control has to be honest about it rather than
 * implying the two move together: `label` names what is being switched
 * ("Version" against the reference, "Guides" against prose) and `latestLabel`
 * names the newest option in that scheme ("latest" release, "current" major).
 * Nothing is shared between the two but this component, which is the point.
 */
export function VersionSwitcher({
  current,
  options,
  label = 'Version',
  latestLabel = 'latest',
  className = '',
}: {
  current: string;
  options: VersionOption[];
  /** What is being switched. Read directly before the current value. */
  label?: string;
  /** How the newest option is marked. */
  latestLabel?: string;
  className?: string;
}) {
  const active = options.find((o) => o.version === current);

  return (
    <details className={`group relative ${className}`}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-md border border-border bg-field py-1.5 pr-2 pl-2.5 text-sm text-text transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        <span className="text-xs text-text-subtle">{label}</span>
        <span className="font-mono">{current}</span>
        {active?.unreleased && <span className="text-xs text-text-subtle">unreleased</span>}
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className="size-3 shrink-0 fill-none stroke-current stroke-2 text-text-subtle transition-transform group-open:-rotate-180"
        >
          <path d="m4 6 4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>

      {/* Out of flow, so opening it does not push the page down - the switcher
          sits directly above the type's heading. Right-aligned because the
          switcher itself is at the right end of the crumb row, and a
          left-anchored panel opened across the on-this-page rail. */}
      <ul className="absolute right-0 z-20 mt-1 max-h-80 w-56 overflow-y-auto rounded-md border border-border bg-surface-raised py-1 shadow-lg">
        {options.map((option) => {
          const isCurrent = option.version === current;
          return (
            <li key={option.version}>
              <a
                href={option.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={`flex items-baseline gap-2 px-3 py-1.5 text-sm hover:bg-surface ${
                  isCurrent ? 'text-link' : 'text-text'
                }`}
              >
                <span className="font-mono">{option.version}</span>
                {option.unreleased && <span className="text-2xs text-text-subtle">unreleased</span>}
                {option.latest && <span className="text-2xs text-text-subtle">{latestLabel}</span>}
                {!option.present && (
                  <span className="ml-auto text-2xs text-text-subtle">not in this version</span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/**
 * Says so when a newer release exists.
 *
 * Only on a concrete older release: `main` is ahead of every release, so
 * telling someone reading it that 13.4.1 is newer would be false.
 */
export function OlderVersionNotice({
  current,
  newer,
  type,
}: {
  current: string;
  newer: { version: string; href: string };
  /** The type on screen, so the link can say where it actually goes. */
  type?: string;
}) {
  const sameHere = !type || newer.href.endsWith(`/${type}`);
  return (
    <p className="mt-4 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-muted">
      You are reading <span className="font-mono text-text">{current}</span>.{' '}
      <a href={newer.href} className="text-link underline underline-offset-2">
        {sameHere ? (
          <>
            See this page in <span className="font-mono">{newer.version}</span>
          </>
        ) : (
          <>
            <span className="font-mono">{newer.version}</span> is the latest release
          </>
        )}
      </a>
      {sameHere ? '' : ', where this page does not exist'}.
    </p>
  );
}

/**
 * The banner an archived major carries on every page (TI-59).
 *
 * Sibling of `OlderVersionNotice` rather than a parameter on it. That one
 * answers "a newer release of this type exists", which is a fact about one page
 * in a reference versioned per release. This answers "these guides are not the
 * current ones", which is a fact about the whole tree the reader is standing
 * in, and it has to say so on every page rather than only where something
 * changed: install steps and CLI flags do not announce that they have moved on.
 *
 * Persistent, and not dismissible. A reader who dismissed it on the setup page
 * would carry the assumption into the build page, which is where following the
 * wrong major actually costs them an afternoon.
 *
 * Where the same page exists in current it links straight to it, because that
 * is what the reader wants next and a link to the docs index is a second
 * search. Where it does not, it says so rather than pretending: landing on an
 * index with no explanation reads as a broken link.
 */
export function ArchivedVersionNotice({
  major,
  current,
  href,
  samePage,
}: {
  /** The major being read, e.g. `v13`. */
  major: string;
  /** The major the unversioned URLs serve, e.g. `v14`. */
  current: string;
  /** Where the link goes: the same page in current, or the current index. */
  href: string;
  /** False when current has no equivalent of this page. */
  samePage: boolean;
}) {
  return (
    <p className="mt-4 rounded-md border border-warning bg-surface px-3 py-2 text-sm text-text-muted">
      You are reading the <span className="font-mono text-text">{major}</span> guides. Titanium SDK{' '}
      <span className="font-mono text-text">{current}</span> is current
      {samePage ? '' : ', and this page is not part of it'}.{' '}
      <a href={href} className="text-link underline underline-offset-2">
        {samePage ? `See this page in ${current}` : `Go to the ${current} guides`}
      </a>
      .
    </p>
  );
}
