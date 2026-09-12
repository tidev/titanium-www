'use client';

import { BuiltWith, Icon, PlaceholderBadge, PlatformChips } from './badges';
import { Select } from '@/components/ui/select';
import { capture } from '@/lib/analytics';
import {
  matches,
  PLATFORM_LABELS,
  PLATFORM_ORDER,
  type App,
  type PlatformFilter,
} from '@/lib/showcase/app';
import { useMemo, useState } from 'react';

/**
 * The showcase grid, filtered in the browser.
 *
 * A client component, but not a client-rendered grid: every entry is in the
 * prerendered HTML and every card is plain links, so the page reads fine with
 * scripting off. The state only ever hides cards.
 *
 * There is no sort menu, for the reason `lib/fair-order.ts` sets out: the order
 * arrives already decided by the server and is fair by construction, and a
 * "sort by name" option would hand the top of the page straight back to whoever
 * renamed their app to sort first.
 */

const PLATFORMS: { value: PlatformFilter; label: string }[] = [
  { value: 'all', label: 'Any platform' },
  ...PLATFORM_ORDER.map((p) => ({ value: p as PlatformFilter, label: PLATFORM_LABELS[p] })),
];

export function Browse({ apps }: { apps: App[] }) {
  const [query, setQuery] = useState('');
  const [platform, setPlatform] = useState<PlatformFilter>('all');

  const shown = useMemo(
    () => apps.filter((app) => matches(app, { platform, query })),
    [apps, platform, query]
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label className="min-w-56 flex-1">
          <span className="sr-only">Filter the showcase</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or what the app does"
            className="w-full rounded-md border border-border bg-field px-3 py-2 text-sm placeholder:text-text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </label>

        <Select
          label="Platform"
          hideLabel
          options={PLATFORMS}
          value={platform}
          onChange={(value) => {
            setPlatform(value);
            capture('showcase_filter_applied', { filter: 'platform', value });
          }}
        />
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </ul>

      {!shown.length && (
        <p className="mt-8 text-sm text-text-muted">
          No app listed matches that. Try one filter at a time.
        </p>
      )}
    </>
  );
}

function AppCard({ app }: { app: App }) {
  return (
    <li className="flex flex-col rounded-lg border border-border p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <Icon app={app} size={48} />

        {/* min-w-0, or a long unbroken name would push the badges out of the
            card rather than wrapping: a flex item's floor is its content. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-base font-semibold">
              {/* The name is the link, and the card around it is not. A card
                  that is wholly one link reads as a single unlabelled blob to a
                  screen reader working through the list, where a heading that
                  links announces the app's name and where it goes. */}
              <a
                href={`/showcase/${app.id}`}
                className="text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {app.name}
              </a>
            </h2>
            {app.placeholder && <PlaceholderBadge />}
          </div>

          {app.subtitle && <p className="mt-0.5 text-xs text-text-subtle">{app.subtitle}</p>}
        </div>
      </div>

      {/* Clamped rather than truncated in the data: the whole description is in
          the HTML, so search and a reader with styles off get all of it, and
          the grid still keeps its rows even. */}
      <p className="mt-3 line-clamp-3 text-sm text-text-muted">{app.description}</p>

      <div className="mt-3">
        <PlatformChips app={app} />
      </div>

      {/* Last, and pushed to the bottom edge so the line sits level across a
          row of cards whose descriptions are different lengths.

          The store links are not here. They were, and they made every card a
          set of competing exits: two or three outbound links beside the one
          link that goes to the app's own page, where the same stores are listed
          with room to label them. The card's job is to get a reader interested
          enough to open the entry. */}
      <div className="mt-auto pt-3">
        <BuiltWith app={app} />
      </div>
    </li>
  );
}
