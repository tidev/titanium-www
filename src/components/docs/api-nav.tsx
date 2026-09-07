'use client';

import { ApiTree, Chevron } from './api-tree';
import type { NavType } from '@/lib/docs/tree';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';

/**
 * The API reference sidebar for a pinned version: every type, by namespace.
 *
 * A client component for exactly one reason - the current type. `params` stops
 * at the segment that owns the layout, so a layout at `[segment]` never sees
 * `[type]`, and no CSS selector can open a `<details>`. `usePathname()` is the
 * only way to read it.
 *
 * It is not a client-rendered tree, though. Type pages render on the server for
 * one concrete URL - at build time before, on first request now - so either way
 * the pathname resolves during that render and the `open` attributes and
 * `aria-current` ship inside the HTML. The tree expands to the right branch and
 * marks the current page with scripting turned off, and hydration has nothing
 * to correct. Verified against an on-demand response, not assumed.
 *
 * The tree itself is `ApiTree`, shared with the guides sidebar (TI-79). What
 * stays here is the rail: the phone disclosure, the sticky box, and the scroll.
 */
export function ApiNav({
  types,
  base,
  count,
}: {
  types: NavType[];
  base: string;
  /** Types in this version, so the phone summary says what it is hiding. */
  count: number;
}) {
  const pathname = usePathname();
  // `/docs/sdk/main/Titanium.UI.Button` -> `Titanium.UI.Button`. Empty on the
  // version index, which sits under this layout but is not a type.
  const active = pathname.startsWith(`${base}/`)
    ? decodeURIComponent(pathname.slice(base.length + 1))
    : '';

  // The rail holds 284 rows and starts at the top, so the branch that was
  // expanded for you is often below the fold. Enhancement only - the rail is
  // correct without it, just scrolled to the wrong place. Measured against the
  // rail's own box rather than scrollIntoView(), which would drag the document
  // along with it.
  const rail = useRef<HTMLElement>(null);
  useEffect(() => {
    const box = rail.current;
    const current = box?.querySelector('[aria-current="page"]');
    if (!box || !current) return;
    const offset = current.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollTop += offset - box.clientHeight / 2;
  }, []);

  return (
    <>
      {/*
        A checkbox drives the phone disclosure so the tree is in the document
        once. The obvious markup - a <details> for phones and an <aside> for
        desktop - renders all 283 rows twice, which measured at +58 kB per page;
        and a <details> cannot be talked into staying open at one breakpoint and
        shut at another, since `open` is an attribute and no CSS reaches it.
        The cost is that assistive tech announces a checkbox rather than a
        disclosure. It works with scripting off, which the alternatives do not.
      */}
      <input id="api-nav-toggle" type="checkbox" className="peer sr-only" />
      <label
        htmlFor="api-nav-toggle"
        className="mt-6 flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium peer-checked:[&_svg]:rotate-90 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus lg:hidden"
      >
        <Chevron className="transition-transform" />
        Browse the API
        <span className="ml-auto font-mono text-xs text-text-subtle">{count} types</span>
      </label>

      <aside className="hidden peer-checked:block lg:block">
        {/* Sticks below the 4rem site header and scrolls on its own, so a long
            branch never drags the page with it. */}
        <nav
          ref={rail}
          aria-label="API reference"
          // `api-nav` is the hook for the chevron rule in globals.css; see there.
          className="api-nav max-h-[70dvh] overflow-y-auto pb-6 text-sm lg:sticky lg:top-16 lg:max-h-[calc(100dvh-4rem)] lg:py-10 lg:pr-3"
        >
          <ApiTree types={types} base={base} active={active} />
        </nav>
      </aside>
    </>
  );
}
