import {
  AVAILABILITY_LABELS,
  KIND_LABELS,
  SPECIALISM_LABELS,
  SPECIALISM_ORDER,
  type Profile,
} from '@/lib/directory/profile';

/**
 * The small pieces a directory card and a directory page share.
 *
 * No `use client` and no state: these are imported by the browse list, which is
 * a client component, and by the profile page, which is not. Everything here
 * imports from `lib/directory/profile.ts` only, which is the half of the
 * library with no filesystem in it.
 */

/**
 * Individual or agency, on every card.
 *
 * The two are one list rather than two sections. Someone looking for help has a
 * problem, not a preference about company size, and splitting the page would
 * make them read both halves to be sure they had seen everything. The badge and
 * this filter carry the distinction for the minority who do care.
 */
export function KindBadge({ profile }: { profile: Profile }) {
  return (
    <span
      title={
        profile.kind === 'agency'
          ? 'A company. Contact goes to the business rather than to one person'
          : 'One person, available directly'
      }
      className="rounded border border-border-strong px-1.5 py-0.5 font-mono text-xs text-text-subtle"
    >
      {KIND_LABELS[profile.kind]}
    </span>
  );
}

/**
 * Marks a worked example.
 *
 * Loud on purpose. These are not people, and a reader who mistakes one for a
 * real listing wastes their time writing to nobody. They are shown only while
 * the directory holds no real listing at all.
 */
export function PlaceholderBadge() {
  return (
    <span
      title="A worked example, not a real listing. Shown only while the directory is empty"
      className="rounded border border-warning px-1.5 py-0.5 font-mono text-xs text-warning"
    >
      example
    </span>
  );
}

/** What someone is available for. Always at least one. */
export function AvailabilityChips({ profile }: { profile: Profile }) {
  return (
    <span className="flex flex-wrap gap-1">
      {profile.availability.map((a) => (
        <span
          key={a}
          className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-text-subtle"
        >
          {AVAILABILITY_LABELS[a]}
        </span>
      ))}
    </span>
  );
}

/**
 * Specialisms, in the vocabulary's own order rather than the order they were
 * written in, so two listings claiming the same work read the same way.
 */
export function SpecialismChips({ profile }: { profile: Profile }) {
  const ordered = SPECIALISM_ORDER.filter((s) => profile.specialisms.includes(s));
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ordered.map((s) => (
        <li
          key={s}
          className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted"
        >
          {SPECIALISM_LABELS[s]}
        </li>
      ))}
    </ul>
  );
}

/**
 * Where they are, and what that means for a call.
 *
 * The time zone rather than the offset: an offset is wrong for half the year,
 * and the zone is the thing a calendar can actually take.
 */
export function Where({ profile }: { profile: Profile }) {
  return (
    <p className="text-xs text-text-subtle">
      {profile.location} <span aria-hidden>·</span>{' '}
      <span className="font-mono">{profile.timezone}</span>
    </p>
  );
}
