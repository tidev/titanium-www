import { EntryIdExcluding, HostedUrl, NoEmail, PublicUrl } from './fields.ts';
import { z } from 'zod';

/**
 * The app showcase (TI-54): apps that shipped, built with Titanium.
 *
 * One JSON file per app under `registry/showcase/`, added and removed by pull
 * request, exactly as the developer directory works and for the same reasons -
 * see `./directory.ts`. The pull request is the submission form, the review,
 * and the record of who added an entry and when.
 *
 * ## What this page is for
 *
 * A framework in its seventeenth year is asked one question before any other:
 * is anyone still shipping with it. A feature list cannot answer that and a
 * testimonial barely can. A list of apps a reader can open on their own phone
 * can, which is why this is worth carrying and why an entry has to point
 * somewhere a stranger can check.
 *
 * ## Three rules this schema enforces
 *
 * **No reachable email address**, as everywhere a person submits prose. See
 * `./fields.ts`.
 *
 * **A store link goes to that store.** `appStore` and `playStore` are checked
 * against the store's own hostname rather than merely being URLs. A store badge
 * is a promise about where a tap lands, and a link that borrows the badge to
 * send a reader somewhere else is the one abuse this page invites.
 *
 * **An entry is checkable.** At least one of the three links is required, so
 * there is always somewhere a reviewer, or a reader, can go to confirm the app
 * exists. Which one varies honestly: plenty of Titanium's real work is
 * enterprise apps that were never on a public store, and those are exactly the
 * entries a website link is for.
 *
 * ## What is deliberately absent
 *
 * **No expiry.** The directory expires listings because it publishes a claim
 * about the present - somebody is available now - and a stale one misleads. An
 * app that shipped shipped; the fact does not decay, and renewal friction here
 * would only empty the page of true entries. An app pulled from sale is removed
 * by pull request like anything else.
 *
 * **No screenshots.** Settled deliberately, not forgotten: the deployment cap
 * is measured against the whole static output and the headroom is single-digit
 * megabytes, which a few screenshots per app would eat outright. An entry
 * carries an icon, and its store links carry the screenshots the stores already
 * host and size properly. `docs/app-showcase.md` records the numbers, and
 * `src/lib/showcase/icon.ts` refuses a committed screenshot with a message
 * saying so rather than ignoring it.
 */

/** Bumped when the on-disk shape changes incompatibly, as with the module schemas. */
export const SHOWCASE_SCHEMA_VERSION = 1;

/**
 * The form factors an app is built for.
 *
 * Four values rather than two, because "iOS and Android" is the claim every
 * cross-platform framework makes and it is not the one a reader is checking.
 * Tablet layouts are where a cross-platform toolkit usually stops being
 * convincing, so an app that did them says so specifically.
 */
export const AppPlatformSchema = z.enum(['iphone', 'ipad', 'android-phone', 'android-tablet']);
export type AppPlatform = z.infer<typeof AppPlatformSchema>;

/**
 * A Titanium SDK version, as the SDK itself spells one.
 *
 * `12.7.0` and `12.7.0.GA` are both taken, because the trailing qualifier is
 * how a release is named in `tiapp.xml` and half of everyone will copy it from
 * there. A bare major, `12.x`, is refused: this field is a fact about a build
 * and a range is not one.
 */
const SdkVersion = z
  .string()
  .regex(
    /^\d+\.\d+\.\d+(\.(GA|RC|Beta))?$/,
    'must be a Titanium SDK version, such as 12.7.0 or 12.7.0.GA'
  );

/** Apple moved the store to apps.apple.com; itunes.apple.com links still resolve. */
const APP_STORE_HOSTS = ['apps.apple.com', 'itunes.apple.com'];
const PLAY_STORE_HOSTS = ['play.google.com'];

/**
 * One app.
 *
 * Strict, like the directory shape and for the same reason: an unrecognised key
 * is either a typo that silently does nothing or a field somebody hoped would
 * be published, and both should fail review rather than be carried.
 */
export const ShowcaseAppSchema = z
  .strictObject({
    schemaVersion: z.number().int().positive(),

    /**
     * The entry's identity and its URL, and it must equal the filename.
     * `scripts/validate-registry.ts` checks that, because nothing in a schema
     * can see the name of the file it is parsing.
     */
    id: EntryIdExcluding(['submit']),

    name: NoEmail(60),

    /**
     * The line under the name, if the name does not carry it.
     *
     * Optional because plenty of apps are called what they do. Short on
     * purpose: this sits on a card beside three other cards, and a sentence
     * here would set the height of every row.
     */
    subtitle: NoEmail(100).optional(),

    platforms: z.array(AppPlatformSchema).min(1).max(4),

    /**
     * The SDK the app was built with when it was listed.
     *
     * A point in time, not a promise about the current build. `docs/app-showcase.md`
     * says so, and the page dates it rather than presenting it as current.
     */
    sdkVersion: SdkVersion,

    /** What the app is and who it is for, in the submitter's words. */
    description: NoEmail(1000),

    /** The developer's or the app's own site. */
    website: PublicUrl.optional(),

    appStore: HostedUrl(APP_STORE_HOSTS, 'App Store').optional(),
    playStore: HostedUrl(PLAY_STORE_HOSTS, 'Google Play').optional(),

    /**
     * A worked example rather than a real app.
     *
     * Shown only while no real entry exists, and badged as an example wherever
     * it is shown - see `liveApps()`. It exists so the page can be reviewed and
     * so a submitter can read a complete entry before writing one, and it
     * removes itself the day the first real app merges.
     */
    placeholder: z.boolean().default(false),
  })
  .refine((app) => !!(app.appStore || app.playStore || app.website), {
    message: 'give at least one of appStore, playStore or website, so the app can be checked',
    path: ['appStore'],
  });

export type ShowcaseApp = z.infer<typeof ShowcaseAppSchema>;

/**
 * A complete, valid entry, rendered on `/showcase/submit` for a submitter to
 * copy.
 *
 * Beside the shape for the reason `listingTemplate` gives: `./showcase.test.ts`
 * parses this through `ShowcaseAppSchema` on every run, so a template that no
 * longer matches its schema fails the build rather than teaching somebody to
 * write a file CI will reject.
 *
 * It carries all three links, because which of them an entry needs is the one
 * thing about this shape a submitter gets wrong - and it shows a store URL on
 * the store's own hostname, which the schema checks.
 *
 * `sdkVersion` is a parameter rather than a hardcoded example, for the same
 * reason `listingTemplate` takes the day rather than reading the clock: this
 * file has no filesystem and no pool in it, and pulling `latestSdkVersion()`
 * in from `../docs/registry.ts` would drag the whole compiled-docs reader
 * behind it for the sake of one string - the exact trade `../directory/read.ts`
 * declines for the same reason. The caller already has to touch that module
 * for its own page, so it passes the version in instead.
 */
export function appTemplate(sdkVersion: string): ShowcaseApp {
  return {
    schemaVersion: SHOWCASE_SCHEMA_VERSION,
    id: 'harbour-transit',
    name: 'Harbour Transit',
    subtitle: 'Live departures and offline timetables',
    platforms: ['iphone', 'ipad', 'android-phone', 'android-tablet'],
    sdkVersion,
    description:
      'What the app is and who it is for, in your own words. Up to 1000 characters.\n\nBlank lines become paragraphs. Plain text only: it is not rendered as markdown, so a link written here stays a link nobody can click.',
    website: 'https://example.com/harbour-transit',
    appStore: 'https://apps.apple.com/gb/app/harbour-transit/id123456789',
    playStore: 'https://play.google.com/store/apps/details?id=com.example.harbourtransit',
    placeholder: false,
  };
}
