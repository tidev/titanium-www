'use client';

import {
  AvailabilityChips,
  KindBadge,
  Picture,
  PlaceholderBadge,
  SpecialtyChips,
  Where,
} from './badges';
import { ExternalIcon } from '@/components/ui/external-link';
import { Select } from '@/components/ui/select';
import { capture } from '@/lib/analytics';
import {
  AVAILABILITY_LABELS,
  AVAILABILITY_ORDER,
  KIND_LABELS,
  matches,
  SPECIALTY_LABELS,
  SPECIALTY_ORDER,
  type AvailabilityFilter,
  type KindFilter,
  type Profile,
  type SpecialtyFilter,
} from '@/lib/directory/profile';
import { useMemo, useState } from 'react';

/**
 * The directory list, filtered in the browser.
 *
 * A client component, but not a client-rendered list: every listing is in the
 * prerendered HTML and every card is plain links, so the page reads fine with
 * scripting off. The state only ever hides rows.
 *
 * ## There is no sort menu, and that is the point
 *
 * The order arrives already decided by the server and is never recomputed here.
 * It is fair by construction - see `fairOrder` in `lib/directory/profile.ts` -
 * and a "sort by name" option would hand the top of the list straight back to
 * whoever renamed themselves to sort first, which is the exact thing the
 * ordering exists to prevent. Filtering hides rows; it does not promote one.
 *
 * Reordering in the browser was rejected for a second reason as well: it would
 * change the list after hydration, and a crawler would only ever see the order
 * before that happened.
 */

const KINDS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'Everyone' },
  { value: 'individual', label: KIND_LABELS.individual },
  { value: 'agency', label: KIND_LABELS.agency },
];

const AVAILABILITIES: { value: AvailabilityFilter; label: string }[] = [
  { value: 'all', label: 'Any availability' },
  ...AVAILABILITY_ORDER.map((a) => ({
    value: a as AvailabilityFilter,
    label: AVAILABILITY_LABELS[a],
  })),
];

const SPECIALTIES: { value: SpecialtyFilter; label: string }[] = [
  { value: 'all', label: 'Any specialty' },
  ...SPECIALTY_ORDER.map((s) => ({ value: s as SpecialtyFilter, label: SPECIALTY_LABELS[s] })),
];

export function Browse({ profiles }: { profiles: Profile[] }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [specialty, setSpecialty] = useState<SpecialtyFilter>('all');

  const applyFilter = (filter: 'kind' | 'availability' | 'specialty', value: string) =>
    capture('directory_filter_applied', { filter, value });

  const shown = useMemo(
    () => profiles.filter((p) => matches(p, { kind, availability, specialty, query })),
    [profiles, kind, availability, specialty, query]
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <label className="min-w-56 flex-1">
          <span className="sr-only">Filter the directory</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, skill, or location"
            className="w-full rounded-md border border-border bg-field px-3 py-2 text-sm placeholder:text-text-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </label>

        {/* One group, so the three wrap together rather than one at a time.
            Same reasoning as the module browse row. */}
        <div className="flex min-w-full flex-wrap items-center gap-3 sm:min-w-max">
          <Select
            label="Listing kind"
            hideLabel
            options={KINDS}
            value={kind}
            onChange={(value) => {
              setKind(value);
              applyFilter('kind', value);
            }}
          />
          <Select
            label="Availability"
            hideLabel
            options={AVAILABILITIES}
            value={availability}
            onChange={(value) => {
              setAvailability(value);
              applyFilter('availability', value);
            }}
          />
          <Select
            label="Specialty"
            hideLabel
            options={SPECIALTIES}
            value={specialty}
            onChange={(value) => {
              setSpecialty(value);
              applyFilter('specialty', value);
            }}
          />
        </div>
      </div>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {shown.map((profile) => (
          <ProfileCard key={profile.id} profile={profile} />
        ))}
      </ul>

      {!shown.length && (
        <p className="mt-8 text-sm text-text-muted">
          Nobody listed matches that. Try one filter at a time, or ask in{' '}
          <a href="https://tidev.slack.com" className="text-link hover:underline">
            Slack
            <ExternalIcon />
          </a>
          .
        </p>
      )}
    </>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  return (
    <li className="relative flex flex-col rounded-lg border border-border p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start gap-3">
        <Picture profile={profile} size={40} />

        {/* min-w-0, or a long unbroken name would push the badges out of the
            card rather than wrapping: a flex item's floor is its content. */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-base font-semibold">
              {/* The whole card is not a link: it carries an outbound contact
                  link of its own, and nesting those is not something a keyboard
                  user can unpick. The name is the link to the listing's own
                  page. */}
              <a
                href={`/directory/${profile.id}`}
                className="text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {profile.name}
              </a>
            </h2>
            <span className="ml-auto flex flex-wrap items-center gap-2">
              {profile.placeholder && <PlaceholderBadge />}
              <KindBadge profile={profile} />
            </span>
          </div>

          <Where profile={profile} />
        </div>
      </div>

      <p className="mt-2 text-sm text-text-muted">{profile.summary}</p>

      <div className="mt-3">
        <SpecialtyChips profile={profile} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <AvailabilityChips profile={profile} />
      </div>
    </li>
  );
}
