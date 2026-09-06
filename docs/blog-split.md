# The blog split with tidev.io

Settled in [TI-68](https://linear.app/titanium-sdk/issue/TI-68). Read this before
writing a post, and before touching `content/blog` or the redirects on
[tidev.io](https://tidev.io).

## The rule

**titaniumsdk.com/blog is the blog for the software.** Releases, tutorials,
platform news, community calls - anything a developer using Titanium would want
to read.

**tidev.io/blog keeps foundation posts.** TiDev the non-profit writing as
itself: governance, funding and sponsorship, trademark and legal, board and
organisation news.

The test when you are unsure: _is the subject the SDK, or the organisation that
stewards it?_ A post about a release goes here even though TiDev shipped it. A
post about TiDev's finances goes there even though the money pays for releases.

Cross-posting was rejected. TI-53 named the failure mode - two half-maintained
blogs - and a `rel=canonical` between them buys the appearance of a decision
without making one.

## The 50 imported posts

All of them are ours. The import categorised them 48 `Releases` and 2
`Community`; none is a foundation post, so the split moves the whole archive
rather than dividing it. They are already live at `titaniumsdk.com/blog/<slug>`
and each page emits `alternates.canonical` pointing at this site, so nothing in
this repo changes for them.

## Redirects on tidev.io

Deployed when this site goes live, not before - until then tidev.io is the only
copy anyone has bookmarked.

There is no slug map. The import replaced underscores with hyphens and did
nothing else, so one rewrite covers all 50:

```
/blog/:slug  ->  https://titaniumsdk.com/blog/:slug with "_" replaced by "-"   (301)
```

For example `/blog/sdk_13_4_1_ga` → `https://titaniumsdk.com/blog/sdk-13-4-1-ga`.

That the transform really is mechanical is checkable rather than asserted - every
committed slug equals its `tidev-www` filename with underscores replaced. If
tidev.io gains posts before the cutover, re-run `scripts/import-tidev-blog.ts`
and the property still holds, because the script is what establishes it.

Once the redirects are up, tidev.io's own links into its blog point at dead
URLs one hop from their destination. Repoint them at titaniumsdk.com directly.

## Contribute

Contributing to Titanium is about the software, so its home is
`titaniumsdk.com/contribute`. `communityNav` in `src/lib/nav.ts` points there
now rather than at the interim GitHub link, so it does not have to move twice.
Until the page is written that link 404s. Writing it is TI-76, a port of
tidev.io/contribute minus the CLA form.

The link out is one-way. Our page sends people to tidev.io/contribute to sign
the CLA, because tidev.io owns the legal relationship. tidev.io does not link
back here, so nothing on that site has to change for this.

The legacy `Contributing_to_Titanium` tree is a separate question and a
separate ticket, TI-77.

## What was removed

Imported posts carried a `source:` frontmatter field recording their tidev.io
URL. It drove nothing - canonical is unconditional and points here - and TI-68
required it either drive the canonical tag or go. It went. Provenance is not
lost: `scripts/import-tidev-blog.ts` computes the same URL from the filename,
and git records the import.
