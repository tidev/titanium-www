export type NavItem = {
  href: string;
  label: string;
  /**
   * A second link shown beside the first, as `Label / Also`.
   *
   * For a destination with a machine-readable twin - the blog and its feed -
   * where a separate row would imply they are separate places.
   */
  also?: { href: string; label: string };
};

/**
 * Main sections. "Docs" is the umbrella over both guides and the API
 * reference - the API is part of the docs, not a sibling of them.
 */
export const primaryNav: NavItem[] = [
  { href: '/docs', label: 'Docs' },
  { href: '/downloads', label: 'Downloads' },
  { href: '/modules', label: 'Modules' },
  { href: '/blog', label: 'Blog', also: { href: '/blog/feed.xml', label: 'RSS' } },
];

/**
 * The one grouped item in the header, and the label the mobile menu repeats.
 *
 * Named here rather than typed into both, because the two have to agree: a
 * phone user reading "Community" in a list and a desktop user reading it on a
 * button are being told they are in the same place.
 */
export const COMMUNITY_LABEL = 'Community';

/**
 * Everything under Community, in the order the menu shows it.
 *
 * The two site pages first, then the two places to go and do something. Both
 * pages arrived here from elsewhere and the grouping is what made room for
 * them: the developer directory (TI-58) sat in the main nav on its own, where
 * it was the only two-word item and pushed hard against the header's width, and
 * the app showcase (TI-54) had nowhere to go at all. What they have in common
 * is that they are the parts of this site made of other people rather than of
 * software, which is a category a cold reader can navigate by.
 *
 * Community itself is not a link. There is no page behind it that would be
 * anything but a list of these four, and a heading that navigates somewhere is
 * a heading that steals the click from whichever child the reader wanted.
 *
 * GitHub is deliberately absent: the header carries it as an icon two inches to
 * the right, and in the footer it heads the Follow column instead.
 */
export const communityNav: NavItem[] = [
  { href: '/showcase', label: 'App Showcase' },
  /**
   * People available for Titanium work (TI-58).
   *
   * The only two-word label in the menu, and it has to be. Both shorter
   * spellings mislead: "Directory" names the format and not the contents,
   * leaving a cold reader to guess a directory of what on a site whose other
   * lists are all of software, and "Developers" is the name every enterprise
   * site gives its developer-resources silo - which on this site is `/docs`.
   */
  { href: '/directory', label: 'Developer Directory' },
  { href: 'https://tidev.slack.com', label: 'Slack' },
  {
    // Contributing is about the software, so its home is here rather than on
    // tidev.io. Settled in TI-68, see `docs/blog-split.md`. The link out is
    // one-way: our page sends people to tidev.io to sign the CLA, which is
    // where the legal relationship lives.
    href: '/contribute',
    label: 'Contribute',
  },
];

export const GITHUB_ORG_URL = 'https://github.com/tidev';

/**
 * Where to follow the project, GitHub first.
 *
 * It heads the column rather than sitting in Community, because it is the one
 * entry here that is not a social account: watching the org is how somebody
 * actually follows the work, and the three below are where it gets talked
 * about. It points at the org rather than a single repo - the popular repos are
 * pinned there, so it is the more useful landing spot.
 *
 * Discussions used to sit in the Community column and no longer does anywhere.
 * It has gone untouched for years, and a link from every page on the site is a
 * promise that somebody is reading the other end.
 */
export const socialNav: NavItem[] = [
  { href: GITHUB_ORG_URL, label: 'GitHub' },
  { href: 'https://bsky.app/profile/titaniumsdk.com', label: 'Bluesky' },
  { href: 'https://x.com/TitaniumSDK', label: 'X' },
  { href: 'https://www.reddit.com/r/TitaniumSDK/', label: 'Reddit' },
];

export const supportNav: NavItem[] = [
  { href: 'https://github.com/sponsors/tidev/', label: 'GitHub Sponsors' },
  { href: 'https://en.liberapay.com/tidev', label: 'Liberapay' },
];

export function isExternal(href: string) {
  return href.startsWith('http');
}
