import { z } from 'zod';

/**
 * The field types the hand-submitted registries share.
 *
 * Two of them - the developer directory (TI-58) and the app showcase (TI-54) -
 * are lists of things people submit about themselves by pull request, and both
 * publish links a stranger wrote to an audience that never asked to be sent
 * anywhere. The rules for that are identical in both, and they are the rules
 * most worth not getting subtly different in two files.
 *
 * The generated registries - modules, builds, SDK versions - do not use these.
 * Their contents come from manifests and release assets rather than from a
 * person, so their shapes live with the generators that write them.
 */

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
 * unguarded throw escapes `safeParse` entirely. A submission whose URL is
 * missing its scheme (`example.com/enquiries`, far and away the commonest way
 * to get this field wrong) would crash `pnpm check:registry` with a raw stack
 * trace before it printed which file was at fault, and take the rest of the
 * registry walk down with it. Unparseable is simply not an http(s) URL, so say
 * so.
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
 * the directory exists to enforce would pass validation without this line.
 */
export const PublicUrl = z
  .url()
  .max(300)
  .refine(isHttpUrl, {
    message: 'must be an http(s) URL. Link to a page you control, never a mailto: or tel: address',
  })
  .refine((value) => !EMAIL.test(value), {
    message: 'must not contain an email address, not even in a query string',
  });

/** Prose a person wrote, with no address hidden in it. */
export const NoEmail = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((value) => !EMAIL.test(value), {
      message: 'must not contain an email address. Link to a contact page instead',
    });

/**
 * A `PublicUrl` that also has to be on one of the named hosts.
 *
 * For a field whose whole meaning is where it points: an "App Store" link that
 * goes somewhere other than the App Store is not a mislabelled link, it is a
 * store badge borrowed to send a reader somewhere they did not agree to go.
 *
 * Subdomains are not accepted, only the exact hosts listed. `endsWith` matching
 * would take `apps.apple.com.example.net`, which is the shape this check exists
 * to refuse.
 *
 * @param hosts the exact hostnames allowed, lowercase
 * @param what how to name the destination in the error
 */
export const HostedUrl = (hosts: readonly string[], what: string) =>
  PublicUrl.refine(
    (value) => {
      try {
        return hosts.includes(new URL(value).hostname.toLowerCase());
      } catch {
        // Unparseable is already rejected above; say no rather than throwing.
        return false;
      }
    },
    { message: `must be a ${what} link, on ${hosts.join(' or ')}` }
  );

/** `YYYY-MM-DD`. A day, not an instant. */
export const IsoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be a YYYY-MM-DD date')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'must be a real date');

/** The identity of a hand-written registry entry, and its URL segment. */
export const EntryId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase kebab-case slug')
  .max(60);

/**
 * An `EntryId` that cannot collide with a static route beside it.
 *
 * Both registries render at `/<section>/<id>`, and both sections also hold a
 * hand-written page at a fixed segment - `/directory/submit`, `/showcase/submit`.
 * Next resolves a static segment before a dynamic one, so an entry that took
 * one of those names would not 404 or warn: it would simply never be reachable,
 * while still appearing in the index, the sitemap and search, all linking to a
 * page about something else. Enforced here rather than in the route, because
 * this is the schema that decides what an id may be, and it is the schema
 * `pnpm check:registry` runs before anything is built.
 */
export const EntryIdExcluding = (reserved: readonly string[]) =>
  EntryId.refine((id) => !reserved.includes(id), {
    message: `must not be ${reserved.join(' or ')}: that is a page on this site, and an entry with that id would be unreachable`,
  });
