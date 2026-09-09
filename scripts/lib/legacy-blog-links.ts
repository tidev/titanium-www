import legacyGuide from '../../src/lib/docs/legacy-guide-redirects.json' with { type: 'json' };
import { versionsWithNotes } from '../../src/lib/docs/release-notes.ts';

/**
 * Repoints the links the 50 migrated posts brought with them (TI-67).
 *
 * The archive was written against the old documentation wiki, so its bodies
 * carry absolute `https://titaniumsdk.com/guide/…_Release_Note.html` addresses
 * that this site does not serve. Measured before the rewrite: of the 47
 * distinct non-asset internal paths linked from post bodies, 46 had no page
 * here. `/contribute` was the only one that resolved.
 *
 * ## Why this sits beside the importer rather than being a one-off edit
 *
 * `import-tidev-blog.ts` is re-runnable by design, and `docs/blog-split.md`
 * says to re-run it if tidev.io gains posts before the cutover. A hand edit to
 * `content/blog` would be silently undone by that run, and all 87 dead links
 * would come back. It already rewrites image references for exactly this
 * reason; links are the same problem one field over.
 *
 * ## What it does not do
 *
 * Link targets only. Three posts referenced the old site as bare prose rather
 * than as a link - "browse the docs https://titaniumsdk.com/" - and turning
 * those into something that reads well is an edit to somebody's sentence, not
 * a substitution. Those were fixed by hand, and a re-import would reintroduce
 * them. That is not silent: `pnpm check:docs` fails the build on a dead
 * internal link in a post body, so a re-import that regresses one says so.
 */

/** This site, however the old post spelled it. */
const SITE = /^https?:\/\/(?:www\.)?titaniumsdk\.com(?=\/|$)/;

/**
 * A per-version release note on the old wiki.
 *
 * The channel is captured but not used: `12.3.0.RC2` and `12.3.0.GA` were two
 * pages there and are one page here. See `releaseNotesPath`.
 */
const RELEASE_NOTE =
  /^\/guide\/Titanium_SDK\/Titanium_SDK_Release_Notes\/[^/]+\/Titanium_SDK_(\d+\.\d+\.\d+)\.([A-Za-z0-9]+)_Release_Note\.html$/;

/** tidev.io served the blog from `/posts/<year>/<name>.md`. */
const OLD_POST = /^\/posts\/\d{4}\/([\w-]+)\.md$/;

/**
 * The one Slack address, chosen to match `communityNav` in `src/lib/nav.ts`.
 *
 * The archive uses both `tidev.slack.com` and `slack.tidev.io` depending on who
 * wrote the post. Both resolve; the site had already picked one, so this is
 * normalisation rather than a new decision.
 */
const SLACK = 'https://tidev.slack.com';

/**
 * Donations are the foundation's, not the software's.
 *
 * `/donate` was a page on tidev.io and the import made it root-relative, which
 * pointed 38 links at a path this site has never served. `docs/blog-split.md`
 * puts funding on tidev.io, and that page offers the same two routes the
 * footer's `supportNav` does.
 */
const DONATE = 'https://tidev.io/donate';

/**
 * A version's release notes here, or null when there is no page to send to.
 *
 * Release candidates share a version with the GA that follows and are captured
 * as `release-notes.rc.md`, which nothing renders (see `release-notes.ts`), so
 * an RC announcement lands on the GA notes for the same version. Those are the
 * superset: every ticket the RC listed shipped in it.
 *
 * Null rather than a guess when the version has no note at all. The link then
 * stays as it was and `check:docs` fails on it, which is the right way round:
 * a dead link that is reported beats one quietly pointed somewhere wrong.
 */
function releaseNotesPath(version: string): string | null {
  return versionsWithNotes().includes(version) ? `/docs/sdk/${version}/release-notes` : null;
}

/**
 * A retired guide's address here, from the `/guide/*` redirect map (TI-39).
 *
 * The same answer the redirect serves, which is the point: a link in a post and
 * a link from a search result should not land in different places. It replaces
 * a truncation step this file used to need, back when the only mapping
 * available was TI-31's provisional one and its predicted leaves - `/docs/alloy/
 * guide` for PurgeTSS - had to be trimmed to an ancestor that existed.
 *
 * The map keys on the URL the old site served, so a post that wrote the address
 * with `.html`, with a trailing slash, or with neither all resolve.
 *
 * `/docs` is a real answer here rather than a failure. 36 legacy trees have no
 * successor in the approved IA - Contributing, Angular, the Welcome pages - and
 * the map says so deliberately.
 */
const rules = new Map(legacyGuide.rules.map((rule) => [rule.source, rule.destination]));

function guidePath(path: string): string | null {
  const bare = path.replace(/\/$/, '');
  return rules.get(path) ?? rules.get(`${bare}.html`) ?? rules.get(bare) ?? null;
}

/**
 * Where a link in a migrated post should point, or null to leave it alone.
 *
 * Null is the common answer: most links in the archive go to GitHub, and those
 * are correct as written.
 */
export function rewriteLink(href: string): string | null {
  if (/^https?:\/\/downloads\.titaniumsdk\.com(?=[/:?#]|$)/.test(href)) return '/downloads';
  if (/^https?:\/\/(?:slack\.tidev\.io|tidev\.slack\.com)\/?$/.test(href)) {
    return href === SLACK ? null : SLACK;
  }

  // Everything past here is a path on this site, however it was addressed.
  const path = SITE.test(href) ? href.replace(SITE, '') || '/' : href;
  if (!path.startsWith('/')) return null;

  const note = RELEASE_NOTE.exec(path);
  if (note) return releaseNotesPath(note[1]);

  if (path.startsWith('/guide/')) return guidePath(path);

  const post = OLD_POST.exec(path);
  if (post) return `/blog/${post[1].replace(/_/g, '-')}`;

  if (path === '/donate') return DONATE;

  // Already somewhere real, but written with the domain in it: absolute links
  // send a preview deploy to production and hard-code a name the site may not
  // always answer to.
  return path === href ? null : path;
}

/**
 * Every markdown link target in a body, rewritten where it needs to be.
 *
 * Image references are left to `rewriteImage` in the importer, which is the
 * pass that knows where the asset went. Sharing this one would strip the host
 * off an image the copy failed to find and leave a path nothing serves - and
 * `validatePosts` reads `<a href>`, so a broken `<img>` reports nothing.
 */
export function rewriteLinks(body: string): string {
  return body.replace(
    /(\]\()([^)\s]+)(\))/g,
    (all, open: string, href: string, close: string, offset: number) => {
      const label = body.lastIndexOf('[', offset);
      if (label > 0 && body[label - 1] === '!') return all;

      const to = rewriteLink(href);
      return to === null ? all : `${open}${to}${close}`;
    }
  );
}
