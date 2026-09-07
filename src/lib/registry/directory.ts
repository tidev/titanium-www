import { z } from 'zod';

/**
 * The developer directory (TI-58): people and companies available for paid
 * Titanium work.
 *
 * One JSON file per listing under `registry/directory/`, added and removed by
 * pull request. There is no account, no session and no portal, and the pull
 * request is the spam gate rather than a limitation we are working around: the
 * audience is developers, `.github/CODEOWNERS` already routes the review, and
 * `git log` answers who added a listing and when.
 *
 * Alongside the module schemas because it is validated by the same mechanism -
 * `pnpm check:registry` walks `registry/` and picks a schema from the path - not
 * because a listing is registry data in the sense the Titanium CLI means. The
 * public API under `/registry/v1` does not serve these.
 *
 * ## Two rules this schema exists to enforce
 *
 * **No reachable email address, anywhere.** A published `mailto:` is a gift to
 * scrapers, and the person who pays for it is the listee. Every URL has to be
 * `http(s)`, and every field a person writes prose into is checked for an
 * address in the text. See `PublicUrl` and `NoEmail`.
 *
 * **A listing states an end date.** `expiresAt` is required unless the listing
 * opts out with `neverExpires`, and it cannot be set further than three months
 * out. Renewing is a pull request that bumps the date, which is the point: a
 * directory of people who are still available is worth reading, and a directory
 * of people who were available in 2019 is not.
 */

/** Bumped when the on-disk shape changes incompatibly, as with the module schemas. */
export const DIRECTORY_SCHEMA_VERSION = 1;

/** How far ahead of the day it is written an `expiresAt` may be set. */
export const LISTING_DAYS = 92;

/**
 * An address in running text.
 *
 * Deliberately loose about what a valid address is, because the question here
 * is not "would this deliver" but "would a scraper collect it". Anything shaped
 * like `local@domain.tld` would.
 */
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;

/**
 * Is this an `http(s)` URL?
 *
 * `new URL()` throws on anything it cannot parse, and zod runs every check in a
 * chain even after an earlier one has failed - so an unparseable string reaches
 * this refinement whether or not `z.url()` has already rejected it, and an
 * unguarded throw escapes `safeParse` entirely. A listing whose URL is missing
 * its scheme (`example.com/enquiries`, far and away the commonest way to get
 * this field wrong) would crash `pnpm check:registry` with a raw stack trace
 * before it printed which file was at fault, and take the rest of the registry
 * walk down with it. Unparseable is simply not an http(s) URL, so say so.
 */
function isHttpUrl(value: string): boolean {
  try {
    return /^https?:$/.test(new URL(value).protocol);
  } catch {
    return false;
  }
}

/**
 * Rejects everything but `http(s)`.
 *
 * `z.url()` alone does not: it parses with `new URL()`, which accepts
 * `mailto:someone@example.com`, `tel:` and `javascript:` as perfectly valid
 * URLs. Verified against the installed zod rather than assumed. So the one rule
 * this whole file exists to enforce would pass validation without this line.
 */
const PublicUrl = z
  .url()
  .max(300)
  .refine(isHttpUrl, {
    message: 'must be an http(s) URL. Link to a page you control, never a mailto: or tel: address',
  })
  .refine((value) => !EMAIL.test(value), {
    message: 'must not contain an email address, not even in a query string',
  });

const NoEmail = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !EMAIL.test(value), {
      message: 'must not contain an email address. Link to a contact page instead',
    });

/**
 * A time zone the runtime can actually resolve.
 *
 * Asked of `Intl.DateTimeFormat` rather than checked against
 * `Intl.supportedValuesOf('timeZone')`, which sounds like the right list and is
 * not: it returns canonical primary zones only, so it rejects `UTC` outright
 * and rejects every alias a person might reasonably write, `Asia/Calcutta` and
 * `Europe/Kiev` among them. Those all resolve perfectly well and mean exactly
 * what the listee intended. The question worth asking is "would a calendar take
 * this", and this is how you ask it.
 *
 * Memoised, because the schema is parsed once per listing per build and
 * constructing a formatter is not free.
 */
const zoneCache = new Map<string, boolean>();

function resolvableZone(value: string): boolean {
  const cached = zoneCache.get(value);
  if (cached !== undefined) return cached;
  let ok = false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    ok = true;
  } catch {
    ok = false;
  }
  zoneCache.set(value, ok);
  return ok;
}

const Timezone = z
  .string()
  .min(1)
  .max(60)
  // The shape first, so `America/New_York` is required rather than the offsets
  // and abbreviations `DateTimeFormat` also accepts on some runtimes. An offset
  // is wrong for half the year in most of the world, which is the whole reason
  // this field is a zone and not a number.
  .refine((value) => /^[A-Za-z][\w+-]*(?:\/[\w+-]+)*$/.test(value), {
    message: 'must be an IANA time zone, such as Europe/Berlin or America/New_York',
  })
  .refine(resolvableZone, {
    message: 'is not a time zone this runtime recognises. Check the spelling against the IANA list',
  });

/** `YYYY-MM-DD`. A day, not an instant: the expiry window is three months wide. */
const IsoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'must be a real date');

export const ProfileKindSchema = z.enum(['individual', 'agency']);
export type ProfileKind = z.infer<typeof ProfileKindSchema>;

/** What someone is available for, not what they are good at. */
export const AvailabilitySchema = z.enum(['full-time', 'part-time', 'contract']);
export type Availability = z.infer<typeof AvailabilitySchema>;

/**
 * A closed vocabulary, and that is the whole reason it works as a filter.
 *
 * Free text here would make the filter menu unbounded and immediately gameable:
 * the first person to write "Titanium, titanium, TITANIUM, Titanium SDK" as
 * four specialisms appears under four headings. A fixed list also means two
 * people who do the same work are findable by the same term, which a free-text
 * field never delivers.
 *
 * Adding a value is a pull request against this file, reviewed like any other.
 * `skills` below is where the free text goes: shown, never filtered on.
 */
export const SpecialismSchema = z.enum([
  'alloy',
  'app-store-release',
  'ci-cd',
  'code-review',
  'cross-platform-ui',
  'hyperloop',
  'native-modules-android',
  'native-modules-ios',
  'performance',
  'sdk-upgrades',
  'security',
  'training',
]);
export type Specialism = z.infer<typeof SpecialismSchema>;

const LinkSchema = z.strictObject({
  label: NoEmail(40),
  url: PublicUrl,
});

/**
 * One listing.
 *
 * Strict, unlike the hand-written module shapes, which are `loose()` so that a
 * note somebody left survives. The reason is different here: an unrecognised
 * key in a listing is either a typo that silently does nothing, or a field
 * somebody hoped would be published. Both should fail review rather than be
 * carried, and the email rules can only cover fields the schema knows about.
 */
export const DeveloperProfileSchema = z
  .strictObject({
    schemaVersion: z.number().int().positive(),

    /**
     * The listing's identity and its URL, and it must equal the filename.
     * `scripts/validate-registry.ts` checks that, because nothing in a schema
     * can see the name of the file it is parsing.
     */
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase kebab-case slug')
      .max(60),

    name: NoEmail(80),
    kind: ProfileKindSchema,

    /** One sentence. What you do, in your words. */
    summary: NoEmail(280),

    /**
     * Free text, because the useful answer varies: a city, a country, or
     * "Remote, EU only". The machine-readable half of "where are you" is the
     * time zone below, which is also the half a client actually needs.
     */
    location: NoEmail(80),
    timezone: Timezone,

    availability: z.array(AvailabilitySchema).min(1).max(3),
    specialisms: z.array(SpecialismSchema).min(1).max(8),

    /** Free text, shown but never filtered on. See `SpecialismSchema`. */
    skills: z.array(NoEmail(30)).max(12).default([]),

    /**
     * How to reach them, and the only route published.
     *
     * A URL rather than an address, and required rather than optional: a
     * listing nobody can respond to is not a listing. A contact form, a
     * profile with a message button, or a page carrying whatever the person
     * chooses to expose all work. What we will not do is publish the address
     * for them.
     */
    contact: LinkSchema,

    /** Site, repositories, portfolio. Six is plenty and keeps a card readable. */
    links: z.array(LinkSchema).max(6).default([]),

    /**
     * The day this listing stops being shown, at UTC day granularity.
     *
     * Absent only when `neverExpires` is set. The two are mutually exclusive:
     * an expiry date beside an opt-out from expiry is two answers to one
     * question, and whichever the code picked would surprise somebody.
     */
    expiresAt: IsoDay.optional(),

    /**
     * Opts out of expiry entirely.
     *
     * Reviewed rather than self-served, and rare. A listing that never has to
     * be renewed is a listing nobody has confirmed is still true, which is the
     * one thing this directory is for. See `docs/developer-directory.md`.
     */
    neverExpires: z.boolean().default(false),

    /**
     * A worked example rather than a real person.
     *
     * Shown only while no real listing exists, and badged as an example
     * wherever it is shown - see `liveProfiles()`. It exists so the page can be
     * reviewed and so a submitter can read a complete listing before writing
     * one, and it removes itself the day the first real listing merges.
     */
    placeholder: z.boolean().default(false),
  })
  .refine((p) => p.neverExpires !== (p.expiresAt !== undefined), {
    message: 'set exactly one of expiresAt or neverExpires',
    path: ['expiresAt'],
  });

export type DeveloperProfile = z.infer<typeof DeveloperProfileSchema>;

/**
 * The listing cap, applied as "no further ahead than three months from now".
 *
 * One-directional on purpose, and it has to be. A check that also failed on a
 * date in the past would turn every expired listing into a red build on pull
 * requests that never touched the directory, and expiry is not a defect: it is
 * the mechanism working. This one only ever becomes *more* true as time passes,
 * so a commit that passed today still passes when CI re-runs it in a year.
 *
 * `now` is injectable so the test does not depend on the day it runs.
 */
export function expiryProblem(profile: DeveloperProfile, now: Date): string | null {
  if (!profile.expiresAt) return null;
  const limit = new Date(now.getTime() + LISTING_DAYS * 86_400_000);
  const day = limit.toISOString().slice(0, 10);
  if (profile.expiresAt > day) {
    return `expiresAt ${profile.expiresAt} is more than ${LISTING_DAYS} days out (no later than ${day})`;
  }
  return null;
}
