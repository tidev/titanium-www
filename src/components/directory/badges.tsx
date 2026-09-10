import {
  AVAILABILITY_LABELS,
  initials,
  KIND_LABELS,
  SPECIALTY_LABELS,
  SPECIALTY_ORDER,
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
 * A listing's picture: a photo for a person, a logo for a company.
 *
 * Falls back to a monogram rather than to nothing, so that a listing without a
 * picture keeps the same shape as one with it and the names on a page of cards
 * stay on one line. Nobody is pushed down the page for declining to publish a
 * photograph of themselves.
 *
 * ## Three decisions worth the words
 *
 * **A plain `img`, not `next/image`.** The box is a fixed size in CSS, so there
 * is no layout shift to prevent, which is most of what the component buys. The
 * file is already capped at 100KB and served from this origin, so there is
 * little left to optimise. `src/lib/og.tsx` is the only other image in the
 * codebase and reaches the same conclusion for its own reasons.
 *
 * **`alt=""`.** The name is right beside it, every time - this is never
 * rendered alone. Describing the picture as well would have a screen reader
 * announce "Example Agency, Example Agency logo", and a decorative image
 * correctly marked is silent rather than noisy.
 *
 * **Round for a person, square for a company.** A face and a wordmark want
 * different frames, and a logo cropped to a circle usually loses part of itself.
 */
export function Picture({ profile, size }: { profile: Profile; size: 40 | 64 }) {
  // Tailwind matches whole class names in the source, so these cannot be built
  // by interpolation - the utility would never be generated.
  const box = size === 64 ? 'size-16 text-lg' : 'size-10 text-xs';
  const shape = profile.kind === 'agency' ? 'rounded-md' : 'rounded-full';

  if (profile.avatar) {
    return (
      <img
        src={profile.avatar}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        decoding="async"
        className={`${box} ${shape} shrink-0 border border-border object-cover`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`${box} ${shape} flex shrink-0 items-center justify-center border border-border font-medium text-text-subtle`}
    >
      {initials(profile.name)}
    </span>
  );
}

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
 * Specialties, in the vocabulary's own order rather than the order they were
 * written in, so two listings claiming the same work read the same way.
 */
export function SpecialtyChips({ profile }: { profile: Profile }) {
  const ordered = SPECIALTY_ORDER.filter((s) => profile.specialties.includes(s));
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ordered.map((s) => (
        <li
          key={s}
          className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted"
        >
          {SPECIALTY_LABELS[s]}
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
