# SDK release notes

Settled in [TI-72](https://linear.app/titanium-sdk/issue/TI-72), split out of
TI-67. Read this before adding a release, and before writing the legacy redirect
map in TI-39.

## The rule

**Per-version release notes are pages on this site.** One per GA release, at:

```
/docs/sdk/<version>/release-notes
```

It sits beside the reference for that exact version, which is where someone
reading `Titanium.UI.Window` at 12.6.0 looks for what changed in 12.6.0. A flat
`/releases/<version>` was the alternative and was rejected: `/downloads` already
lists releases and `/blog` already carries the announcements, so a third
top-level surface would have competed with both.

Pointing at the GitHub releases instead was never an option. All 71 GA release
bodies were read: 51 are empty and the other 20 hold nothing but a link back to
the old site.

## Where the content comes from

`registry/sdk/<version>/release-notes.md`, captured from `tidev/titanium-docs`
by `scripts/capture-release-notes.ts` and committed. Not fetched at build: the
build takes no network at all, which `pnpm check:offline` enforces (TI-25).

Run it deliberately when a release ships, never on a schedule. A published
release's notes do not change.

```
node scripts/capture-release-notes.ts          list what is there
node scripts/capture-release-notes.ts --write  fetch and store
```

Coverage is 56 of the 71 GA releases. The 15 without are every 7.x, because
titanium-docs itself starts at 8.x. A version with no note has no page, and
nothing links to one: `hasReleaseNote()` gates every link.

## GA gets pages, prereleases do not

The reason is the URL, not the content. 12.1.0.RC and 12.1.0.GA are both version
`12.1.0`, so a release candidate has no segment of its own to live at. Giving it
one would either put two documents about two different releases at one address,
or add a channel to a path that has never carried one.

The 23 prerelease notes are captured anyway and sit beside their GA as
`release-notes.rc.md`, so this can be revisited without going back to a
repository that TI-52 is about to archive. Little is lost meanwhile: an RC note
describes a build nobody should still be running, and its content reappears in
the GA note that follows it within weeks.

Beta is not a question. `registry/sdk/beta.json` is empty, the SDK has published
no beta in the window the registry covers, and titanium-docs holds no beta note
to capture.

## The announcement and the note are not the same thing

A release note is the record of what changed. A blog announcement says it
shipped and picks out what is worth reading about. Where both exist the note
carries an "Announcement post" link to `/blog/<slug>`, and neither grows into
the other.

The link runs one way only. Every announcement post already links to its own
release note in its body, so a second link in the page furniture would repeat
it on the same screen. Those in-body links point at the old wiki and are
repointed at `/docs/sdk/<version>/release-notes` by TI-67. The note has no such
link to inherit, so it is the end that carries one.

Matched on the post slug in `src/lib/blog/announcements.ts`, never on the title.
The landing page used to find a release by looking for its name inside a post
title; that worked, but a retitled post would have broken it silently. 31 of the
50 posts match. The 12 prerelease announcements deliberately match nothing,
since `sdk-12-1-0-rc` announces a different release from `sdk-12-1-0-ga`.

## Where the notes are linked from

- the landing page's latest-release line
- `/downloads`, in the "Latest release" box
- `/downloads/releases`, on every GA row that has one
- `/docs/sdk/<version>`, beside the type counts
- the body of the announcement post, where one exists (repointed by TI-67)

## Redirect targets for TI-39

The old site served 86 URLs under
`/guide/Titanium_SDK/Titanium_SDK_Release_Notes/`, listed in
`docs/legacy-guide-audit.json`. They fall into three groups.

**79 note pages**, in per-major directories:

```
/guide/Titanium_SDK/Titanium_SDK_Release_Notes/Titanium_SDK_Release_Notes_<major>.x/Titanium_SDK_<version>.<channel>_Release_Note.html
    ->  /docs/sdk/<version>/release-notes
```

56 are `.GA` and map one to one onto the pages that exist today. The other 23
are `.RC`, plus one `.RC2` for 12.3.0; they have no page of their own, so they
go to the GA note for the same version, which is the nearest live equivalent.
Every RC version does have a GA note, checked, so none of these dangles.

Two spellings, and a map matching only the first would silently drop five URLs:
the separator before the channel is a dot in 74 of them and an underscore in
five, `Titanium_SDK_9.2.0_GA_Release_Note.html` and the same for 9.2.0.RC,
9.3.0.GA, 9.3.0.RC and 9.3.1.GA.

**7 index pages**, the section root and one per major:

```
/guide/Titanium_SDK/Titanium_SDK_Release_Notes/
/guide/Titanium_SDK/Titanium_SDK_Release_Notes/Titanium_SDK_Release_Notes_<major>.x/
    ->  /downloads/releases
```

That list is every release the registry knows, with a notes link on each GA row,
which is what those index pages were.

**Nothing for 7.x.** The 15 GA releases with no note have no legacy URL either,
so there is no redirect to write and no dead end to cover.

Alloy has its own tree under
`/guide/Alloy_Framework/Alloy_Framework_Release_Notes/`. It is not covered here:
this site does not host Alloy release notes, and TI-39 will have to decide where
those go.
