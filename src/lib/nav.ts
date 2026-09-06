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
    // Interim target. Contributing is about the software, so its home is
    // `/contribute` on this site rather than on tidev.io, settled in TI-68,
    // see `docs/blog-split.md`. That page still has to be written: it pulls
    // together the CLA, code of conduct, and committer path from
    // tidev/organization-docs. Point this at `/contribute` when it exists.
    href: 'https://github.com/tidev/titanium-sdk/blob/main/.github/CONTRIBUTING.md',
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
