import { allPosts, type Post } from './posts.ts';

/**
 * Which announcement post goes with which SDK release (TI-72).
 *
 * The release note says what changed; the announcement says it shipped, and
 * usually picks out the two or three things worth reading about. Both exist for
 * every GA since 11.0.0 and neither knew about the other, which is the third
 * competing surface TI-72 set out not to build.
 *
 * ## The note names its announcement, and not the other way round
 *
 * One direction, deliberately. Every announcement post already links to its own
 * release note in its body, so a second link in the page furniture would say
 * the same thing twice on the same screen. Those in-body links were written
 * against the old wiki and are repointed at `/docs/sdk/<version>/release-notes`
 * by TI-67, which is where the reader is sent from either place.
 *
 * The note has no such link to inherit, so it carries one.
 *
 * ## Matched on the slug, never on the title
 *
 * A post is matched by its own address. The landing page used to find a release
 * by looking for the release name inside a post title, which worked but rested
 * on a coincidence of wording. A slug is the published URL, frozen by the
 * redirects TI-68 settled, so it is the part of a post that cannot change
 * quietly, and 31 of the 50 imported posts carry their version in it.
 *
 * ## GA only
 *
 * Only GA releases have a page, see `src/lib/docs/release-notes.ts` for that
 * decision, so the 12 prerelease announcements resolve to nothing. They must
 * not fall through to the GA that followed them: `sdk-12-1-0-rc` announces a
 * different release from `sdk-12-1-0-ga` even though both carry the version
 * 12.1.0, and one link standing for both would say they were the same release.
 * That trap is already gated on `/downloads/releases`, where matching on
 * version alone once pointed twelve prerelease rows at a GA note.
 */

/**
 * The one announcement whose slug the rule below cannot read.
 *
 * "TiDev, Inc. Releases Titanium SDK 11 GA, Titanium CLI 6.1.0", written before
 * the naming settled into `sdk-<version>-<channel>`. Listed rather than matched
 * by a looser pattern: `sdk-11-ga` could as easily be read as 11.1.0 as 11.0.0,
 * and there is exactly one of them.
 *
 * `release-sdk-11` is deliberately absent. It announced 11.0.0.RC, not the GA.
 */
/*
 * A Map rather than an object literal, so a lookup cannot reach the prototype:
 * a plain object would have answered `constructor` and `toString` with a
 * function, and `announcedVersion` would have returned it despite promising a
 * string. Nothing reaches it with such a slug today - a slug comes from a
 * committed filename by way of `postBySlug` - but the signature should hold on
 * its own rather than on that.
 */
const IRREGULAR = new Map<string, string>([['sdk-11-ga', '11.0.0']]);

/**
 * The GA release a post announces, or null for a post announcing none.
 *
 * Anchored on `sdk-`, so the CLI and Alloy announcements, `cli-7-0-0-ga` and
 * `alloy-2-1-0`, are not read as SDK releases. They are different software with
 * their own version numbers, and `cli-7-0-0-ga` would otherwise resolve to an
 * SDK 7.0.0 whose note this site does not have.
 */
export function announcedVersion(slug: string): string | null {
  const irregular = IRREGULAR.get(slug);
  if (irregular) return irregular;
  const m = /^sdk-(\d+)-(\d+)-(\d+)-ga$/.exec(slug);
  return m ? `${m[1]}.${m[2]}.${m[3]}` : null;
}

let byVersion: Map<string, Post> | undefined;

/**
 * The post announcing a release, or null.
 *
 * Drafts are excluded: a draft is kept out of the index, the feed and the
 * sitemap, so a release note linking to one would be the only way in.
 *
 * Where two posts somehow claim one release the newest wins, `allPosts()` being
 * newest first. Nothing in the archive does, and `announcements.test.ts` holds
 * that, so a future duplicate fails there rather than being resolved silently.
 */
export function announcement(version: string): Post | null {
  if (!byVersion) {
    byVersion = new Map();
    for (const post of allPosts()) {
      if (post.draft) continue;
      const announced = announcedVersion(post.slug);
      if (announced && !byVersion.has(announced)) byVersion.set(announced, post);
    }
  }
  return byVersion.get(version) ?? null;
}
