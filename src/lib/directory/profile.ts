import { asDay } from '../fair-order.ts';
import type {
  Availability,
  DeveloperProfile,
  ProfileKind,
  Specialty,
} from '../registry/directory.ts';

/**
 * The directory shapes that hold no filesystem and no zod.
 *
 * Same reason as `../docs/module-summary.ts`: the listing filters in the
 * browser, so this file and everything it imports end up in the client bundle.
 * One `node:fs` import anywhere in that graph fails the build, and pulling the
 * schema in would ship zod to every visitor for the sake of twelve labels.
 * `../registry/directory.ts` is imported for types only, which erases.
 *
 * The thing worth reading here is expiry. Ordering moved to `../fair-order.ts`
 * when the app showcase (TI-54) needed the same rota.
 */

/**
 * A listing, plus the one thing about it that is not in its JSON.
 *
 * `avatar` is the public URL of the picture committed beside the listing, filled
 * in by `./read.ts` from the filename rather than from a field - see
 * `./avatar.ts` for why the schema does not carry one. Optional, because most
 * listings will not have a picture and every one of them still renders.
 */
export type Profile = DeveloperProfile & { avatar?: string };

export const KIND_LABELS: Record<ProfileKind, string> = {
  individual: 'Individual',
  agency: 'Agency',
};

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  'full-time': 'Full time',
  'part-time': 'Part time',
  contract: 'Contract',
};

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  alloy: 'Alloy',
  'app-store-release': 'App store release',
  'ci-cd': 'CI and release automation',
  'code-review': 'Code review',
  'cross-platform-ui': 'Cross-platform UI',
  hyperloop: 'Hyperloop',
  'native-modules-android': 'Android modules',
  'native-modules-ios': 'iOS modules',
  performance: 'Performance',
  'sdk-upgrades': 'SDK upgrades',
  security: 'Security',
  training: 'Training and mentoring',
};

/**
 * Menu order, derived from the label tables rather than written twice.
 *
 * `Record<Specialty, string>` is already exhaustive, so a value added to the
 * schema without a label fails to compile, and this array then carries it
 * without anyone remembering to.
 */
export const SPECIALTY_ORDER = Object.keys(SPECIALTY_LABELS) as Specialty[];
export const AVAILABILITY_ORDER = Object.keys(AVAILABILITY_LABELS) as Availability[];

/**
 * What stands in for a picture on a listing that has none.
 *
 * The first letter of the first two words, so "Example Agency" reads as EA and
 * a one-word name gets a single letter. Deliberately dumb about scripts it
 * cannot reason about: a name in Japanese or Arabic yields its own first
 * characters, which is a better answer than transliterating somebody's name to
 * fill a box.
 *
 * Upper-cased with `toLocaleUpperCase` and no locale argument, so it follows the
 * runtime's rules rather than English's. This is drawn, never announced - the
 * name itself is beside it - so a monogram that reads oddly costs nothing.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => [...word][0] ?? '')
    .join('')
    .toLocaleUpperCase();
}

// ------------------------------------------------------------------- expiry

/**
 * Expired listings are gone on the day they name, not the day after.
 *
 * `expiresAt` reads as "available until", so a listing dated today is still
 * true today. A static build cannot be more precise than this anyway: the page
 * is rendered once and served all day, so the finest granularity available is
 * whatever the rebuild interval is. See `.github/workflows/daily-rebuild.yml`.
 */
export function isExpired(profile: Profile, on: Date): boolean {
  if (profile.neverExpires) return false;
  // Unreachable through the schema, which requires one of the two. Treated as
  // expired rather than as immortal, because that is the safe direction to be
  // wrong in if the shape ever loosens.
  if (!profile.expiresAt) return true;
  return profile.expiresAt < asDay(on);
}

/**
 * Everything that should be rendered, in the sitemap, and in search.
 *
 * Two rules, in order. Expired listings are dropped. Then, if what is left
 * holds any real listing at all, the placeholders are dropped too.
 *
 * That second rule is how the worked examples remove themselves. They exist so
 * this page can be reviewed and so a submitter can read a complete listing
 * before writing one, and the day a real person is merged they stop being
 * shown, without a follow-up pull request that somebody has to remember.
 */
export function liveProfiles(profiles: readonly Profile[], on: Date): Profile[] {
  const live = profiles.filter((p) => !isExpired(p, on));
  const real = live.filter((p) => !p.placeholder);
  return real.length ? real : live;
}

// ---------------------------------------------------------------- filtering

export type AvailabilityFilter = Availability | 'all';
export type SpecialtyFilter = Specialty | 'all';
export type KindFilter = ProfileKind | 'all';

export type Filters = {
  availability: AvailabilityFilter;
  specialty: SpecialtyFilter;
  kind: KindFilter;
  /** Free text over name, summary, location and skills. */
  query: string;
};

/**
 * Applied in the browser, over the already-ordered list.
 *
 * Order is never recomputed here. Filtering hides rows; it does not get to
 * promote one, which is what a "most relevant" re-sort would quietly become.
 */
export function matches(profile: Profile, filters: Filters): boolean {
  if (filters.kind !== 'all' && profile.kind !== filters.kind) return false;
  if (filters.availability !== 'all' && !profile.availability.includes(filters.availability)) {
    return false;
  }
  if (filters.specialty !== 'all' && !profile.specialties.includes(filters.specialty)) {
    return false;
  }

  const needle = filters.query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    profile.name,
    profile.summary,
    profile.location,
    ...profile.skills,
    ...profile.specialties.map((s) => SPECIALTY_LABELS[s]),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}
