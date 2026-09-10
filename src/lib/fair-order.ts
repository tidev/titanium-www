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
 * So the order is a pure function of three inputs - the set of entries, the
 * day, and a per-registry seed - and it is computed on the server at build
 * time. Nothing is shuffled in the browser: a client-side shuffle would reorder
 * after hydration, which is a mismatch, and crawlers would only ever see the
 * pre-shuffle order.
 *
 * Two steps:
 *
 *   1. **A base permutation**, from a seeded shuffle of the entries sorted by
 *      id. Seeded from a fixed constant, so it is stable across builds, and
 *      shuffled rather than sorted so that no property of a name buys a
 *      position. The permutation changes whenever the set of entries changes,
 *      which also stops any pair of them being neighbours forever.
 *
 *   2. **A rotation** of that permutation by the day number.
 *
 * The rotation is what makes this *exactly* fair rather than fair on average.
 * Over any n consecutive days, n being the number of entries, every entry
 * occupies every position exactly once. A per-day reshuffle would only get
 * there in expectation, and with a dozen entries the variance over a quarter
 * is large enough to notice. Being first is worth something, so it is shared
 * out on a rota rather than by a coin toss.
 *
 * The rota only advances when the site is rebuilt, which is why the daily cron
 * that handles directory expiry earns its keep twice: it is also what turns
 * every rota on the site.
 *
 * Used by the developer directory (TI-58) and the app showcase (TI-54). Both
 * are lists of things people submitted about themselves, where the top of the
 * page is worth something and nobody should be able to buy it.
 */

/** The UTC day, as `YYYY-MM-DD`. Day granularity is the whole expiry contract. */
export const asDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Whole days since the epoch, in UTC.
 *
 * The rotation counter, and the reason ordering advances exactly once per day
 * however many times the site is rebuilt in between.
 */
export const dayNumber = (date: Date): number => Math.floor(date.getTime() / 86_400_000);

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
 * One registry's order for one day.
 *
 * Sorted by id first so the base permutation depends on *which* entries exist
 * and not on the order the filesystem happened to hand them over in.
 *
 * @param seed any constant, one per registry. Distinct seeds are what keep two
 *   lists that happen to be the same length from sharing a permutation, which
 *   would be a coincidence nobody could explain if they ever noticed it.
 */
export function fairOrder<T extends { id: string }>(
  entries: readonly T[],
  on: Date,
  seed: number
): T[] {
  if (entries.length < 2) return [...entries];

  const byId = [...entries].sort((a, b) => a.id.localeCompare(b.id));
  const base = shuffled(byId, seed + byId.length);

  const offset = ((dayNumber(on) % base.length) + base.length) % base.length;
  return [...base.slice(offset), ...base.slice(0, offset)];
}
