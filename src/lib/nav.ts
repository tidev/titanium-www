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
 * Routes are placeholders until M2–M4 build them out.
 */
export const primaryNav: NavItem[] = [
  { href: '/docs', label: 'Docs' },
  { href: '/downloads', label: 'Downloads' },
  { href: '/modules', label: 'Modules' },
  { href: '/blog', label: 'Blog', also: { href: '/blog/feed.xml', label: 'RSS' } },
  /**
   * People available for Titanium work (TI-58).
   *
   * In the main nav rather than under Contribute, because the two audiences it
   * serves are both arriving cold: a company deciding whether a Titanium
   * codebase can still be maintained, and a developer looking for paid work.
   * Neither would think to look inside a page about contributing.
   */
  { href: '/directory', label: 'Directory' },
];

/**
 * GitHub points at the org rather than a single repo - the popular repos are
 * pinned there, so it is the more useful landing spot.
 */
export const communityNav: NavItem[] = [
  { href: 'https://github.com/tidev', label: 'GitHub' },
  { href: 'https://github.com/tidev/titanium-sdk/discussions', label: 'Discussions' },
  { href: 'https://tidev.slack.com', label: 'Slack' },
  {
    // Contributing is about the software, so its home is here rather than on
    // tidev.io. Settled in TI-68, see `docs/blog-split.md`. Pointed here rather
    // than at the interim GitHub link so it does not have to move twice; TI-76
    // writes the page, a port of tidev.io/contribute minus the CLA form. The
    // link out is one-way: our page sends people to tidev.io to sign the CLA,
    // which is where the legal relationship lives. This 404s until TI-76 lands.
    href: '/contribute',
    label: 'Contribute',
  },
];

export const socialNav: NavItem[] = [
  { href: 'https://bsky.app/profile/titaniumsdk.com', label: 'Bluesky' },
  { href: 'https://x.com/TitaniumSDK', label: 'X' },
  { href: 'https://www.reddit.com/r/TitaniumSDK/', label: 'Reddit' },
];

export const supportNav: NavItem[] = [
  { href: 'https://github.com/sponsors/tidev/', label: 'GitHub Sponsors' },
  { href: 'https://en.liberapay.com/tidev', label: 'Liberapay' },
];

export const GITHUB_ORG_URL = 'https://github.com/tidev';

export function isExternal(href: string) {
  return href.startsWith('http');
}
