import type {
  Availability,
  DeveloperProfile,
  ProfileKind,
  Specialism,
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
 * The two things worth reading here are expiry and ordering.
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

export const SPECIALISM_LABELS: Record<Specialism, string> = {
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
 * `Record<Specialism, string>` is already exhaustive, so a value added to the
 * schema without a label fails to compile, and this array then carries it
 * without anyone remembering to.
 */
export const SPECIALISM_ORDER = Object.keys(SPECIALISM_LABELS) as Specialism[];
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

/** The UTC day, as `YYYY-MM-DD`. Day granularity is the whole expiry contract. */
export const asDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Whole days since the epoch, in UTC.
 *
 * The rotation counter for fair ordering, and the reason ordering advances
 * exactly once per day however many times the site is rebuilt in between.
 */
export const dayNumber = (date: Date): number => Math.floor(date.getTime() / 86_400_000);

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

/** Days left, for the "renew this" nudge on a listing page. Negative once past. */
export function daysRemaining(profile: Profile, on: Date): number | null {
  if (profile.neverExpires || !profile.expiresAt) return null;
  return dayNumber(new Date(`${profile.expiresAt}T00:00:00Z`)) - dayNumber(on);
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

// ----------------------------------------------------------------- ordering

/**
 * ## Fair ordering, inside a static build
 *
 * Alphabetical is a permanent subsidy to whoever renames themselves "AAA
 * Titanium", and there is no defence against that except not sorting by name.
 * What replaces it has to satisfy three things at once: it must be *fair*, it
 * must be the same for every visitor on a given day (a static page is rendered
 * once and served to everyone), and it must be *deterministic*, or two builds
 * of the same commit would differ and nothing about the deploy would be
 * reproducible.
 *
 * So the order is a pure function of two inputs, the set of listings and the
 * day, and it is computed on the server at build time. Nothing is shuffled in
 * the browser: a client-side shuffle would reorder after hydration, which is a
 * mismatch, and crawlers would only ever see the pre-shuffle order.
 *
 * Two steps:
 *
 *   1. **A base permutation**, from a seeded shuffle of the listings sorted by
 *      id. Seeded from a fixed constant, so it is stable across builds, and
 *      shuffled rather than sorted so that no property of a name buys a
 *      position. The permutation changes whenever the set of listings changes,
 *      which also stops any pair of listings being neighbours forever.
 *
 *   2. **A rotation** of that permutation by the day number.
 *
 * The rotation is what makes this *exactly* fair rather than fair on average.
 * Over any n consecutive days, n being the number of listings, every listing
 * occupies every position exactly once. A per-day reshuffle would only get
 * there in expectation, and with a dozen listings the variance over a quarter
 * is large enough to notice. Being first is worth something, so it is shared
 * out on a rota rather than by a coin toss.
 *
 * The rota only advances when the site is rebuilt, which is why the daily cron
 * that handles expiry earns its keep twice: it is also what turns the rota.
 */

/** A fixed seed. Any constant does; this one is `TI-58` as digits. */
const BASE_SEED = 5820;

/**
 * mulberry32: 32 bits of state, uniform enough for dealing out positions.
 *
 * Written out rather than pulled in, because a dependency for nine lines of
 * arithmetic would be a supply-chain surface for the sake of a shuffle. Not
 * cryptographic, and does not need to be: the sequence being predictable buys
 * nobody anything when every position is visited equally often anyway.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Fisher-Yates, seeded. Does not touch its input. */
function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const random = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The listing order for one day.
 *
 * Sorted by id first so the base permutation depends on *which* listings exist
 * and not on the order the filesystem happened to hand them over in.
 */
export function fairOrder(profiles: readonly Profile[], on: Date): Profile[] {
  if (profiles.length < 2) return [...profiles];

  const byId = [...profiles].sort((a, b) => a.id.localeCompare(b.id));
  const base = shuffled(byId, BASE_SEED + byId.length);

  const offset = ((dayNumber(on) % base.length) + base.length) % base.length;
  return [...base.slice(offset), ...base.slice(0, offset)];
}

// ---------------------------------------------------------------- filtering

export type AvailabilityFilter = Availability | 'all';
export type SpecialismFilter = Specialism | 'all';
export type KindFilter = ProfileKind | 'all';

export type Filters = {
  availability: AvailabilityFilter;
  specialism: SpecialismFilter;
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
  if (filters.specialism !== 'all' && !profile.specialisms.includes(filters.specialism)) {
    return false;
  }

  const needle = filters.query.trim().toLowerCase();
  if (!needle) return true;

  const haystack = [
    profile.name,
    profile.summary,
    profile.location,
    ...profile.skills,
    ...profile.specialisms.map((s) => SPECIALISM_LABELS[s]),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(needle);
}
