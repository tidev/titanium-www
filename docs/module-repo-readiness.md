# Module repo readiness

An audit of the 16 official module repositories under the `tidev` GitHub org,
run for [TI-24](https://linear.app/titanium-sdk/issue/TI-24) on 2026-09-07. It
covers what the registry depends on and nothing else: that a release exists,
that its asset is named the way the parser expects, that a manifest is reachable
and complete, and that the repository carries a licence.

Read this before changing `scripts/lib/modules.ts` or
`scripts/generate-modules.ts`, and before cutting a release in any of the 16
repos. `docs/module-curation.md` is the companion piece: it says what earns a
listing. This says what the 16 we already list actually look like.

## Method

The release and repository data came from the GitHub REST API through `gh`, by
hand, in one pass: `repos/{repo}`, `repos/{repo}/releases` paginated, the
recursive git tree of each default branch, and the raw bytes of every
`*/manifest` and `LICENSE` on it. Manifest field values were checked against the
default branch rather than against the registry, because the question is what
the **next** release will carry, and `registry/modules/` records what past ones
did.

Counts that mention manifest reads at tags come from a full
`node scripts/generate-modules.ts` run, which does the same reads the registry
is built from.

None of this happens at build time. The site build is offline by design.

## The headline

**Nothing here blocks the registry.** All 16 repos publish GitHub releases, all
399 assets across those 400 releases parse, and every repo has a licence file
and a reachable manifest for each platform it ships. The registry is viable
today and was already being built from this data before the audit.

What the audit found is drift, and one real defect:

- One repo, `appcelerator.https`, still serves its iOS manifest from the
  pre-rename `iphone/manifest` path. That is not cosmetic. It is why
  [TI-66](https://linear.app/titanium-sdk/issue/TI-66)'s licence sweep missed
  the file, which still declares `Appcelerator Commercial License` while the
  repo's own `LICENSE` is Apache 2.0 and all 26 other manifests now say
  `Apache-2.0`. A stale path hid a wrong licence for the length of a
  remediation.
- `ti.identity` declares two different guids for one module, one per platform,
  and has done since 1.0.0. Three other modules had the same split and were
  reconciled; this one was not.
- `ti.nfc`'s `LICENSE` conditions use on a Terms of Service agreement with a
  company that no longer exists, sitting above an Apache 2.0 grant. It is the
  only repo of the 16 whose licence file adds a restriction.

## Per-repo readiness

### Releases and assets

| Module                           | Repo                             | Releases | One zip | Last release | Tag spellings |
| -------------------------------- | -------------------------------- | -------: | ------: | ------------ | ------------: |
| `appcelerator.ble`               | `appcelerator.ble`               |        6 |     6/6 | 2025-09-19   |             2 |
| `appcelerator.bluetooth`         | `appcelerator.bluetooth`         |        4 |     4/4 | 2025-10-25   |             2 |
| `appcelerator.encrypteddatabase` | `appcelerator.encrypteddatabase` |       28 |   27/28 | 2025-10-25   |             5 |
| `appcelerator.https`             | `appcelerator.https`             |       25 |   25/25 | 2025-10-25   |             5 |
| `com.appcelerator.urlSession`    | `ti.urlsession`                  |       11 |   11/11 | 2021-07-23   |             2 |
| `facebook`                       | `ti.facebook`                    |       81 |   81/81 | 2026-05-08   |             6 |
| `ti.applesignin`                 | `titanium-apple-sign-in`         |        9 |     8/9 | 2023-03-22   |             1 |
| `ti.barcode`                     | `ti.barcode`                     |       27 |   27/27 | 2025-10-25   |             5 |
| `ti.coremotion`                  | `ti.coremotion`                  |        8 |     8/8 | 2021-07-23   |             1 |
| `ti.crypto`                      | `ti.crypto`                      |       13 |   13/13 | 2025-10-25   |             6 |
| `ti.geofence`                    | `ti.geofence`                    |       21 |   21/21 | 2025-10-25   |             7 |
| `ti.identity`                    | `titanium-identity`              |       26 |   26/26 | 2025-09-10   |             5 |
| `ti.map`                         | `ti.map`                         |       95 |   94/95 | 2025-09-10   |             7 |
| `ti.nfc`                         | `ti.nfc`                         |       12 |   12/12 | 2025-10-25   |             5 |
| `ti.playservices`                | `ti.playservices`                |       16 |   16/16 | 2025-09-10   |             3 |
| `ti.webdialog`                   | `titanium-web-dialog`            |       18 |   18/18 | 2025-11-06   |             7 |

"One zip" is releases carrying exactly one `.zip`. The three exceptions are
harmless and are recorded so nobody re-investigates them:

- `ti.map` `3_2_3_GA` and `titanium-apple-sign-in` `v3.1.0` have no assets at
  all. The generator skips them with a note.
- `appcelerator.encrypteddatabase` `android-1.3.0` (2016) has three: an android
  zip, an iphone zip and a universal `-titanium-` package. `beats()` in
  `scripts/generate-modules.ts` already prefers the platform-specific asset over
  the universal one, so this resolves correctly.
- One further release, `ti.geofence` `ios-2.0.2`, is a draft and is skipped.

**Asset naming is the one thing that has never drifted.** All 399 assets match
`<moduleid>-<platform>-<x.y.z>.zip`. In eleven years and 400 releases the
convention has not moved once, which is why the extractor keys on the filename
and never on the tag. The platform slot is always `android`, `iphone` or
`titanium`; `ios` has never appeared in a filename. 24 assets across
`ti.geofence`, `appcelerator.https` and `appcelerator.encrypteddatabase` use
`titanium`, which is a universal package holding both platforms rather than a
third platform.

### Manifests and licence

| Module                           | Platforms      | iOS path  | Fields             | Manifest licence                             | GitHub licence | Follow-up                                            |
| -------------------------------- | -------------- | --------- | ------------------ | -------------------------------------------- | -------------- | ---------------------------------------------------- |
| `appcelerator.ble`               | android+ios    | `ios/`    | complete           | Apache-2.0                                   | undetected     | none                                                 |
| `appcelerator.bluetooth`         | android        | n/a       | complete           | Apache-2.0                                   | undetected     | [TI-84](https://linear.app/titanium-sdk/issue/TI-84) |
| `appcelerator.encrypteddatabase` | android+ios    | `ios/`    | complete           | Apache-2.0                                   | undetected     | [TI-88](https://linear.app/titanium-sdk/issue/TI-88) |
| `appcelerator.https`             | android+iphone | `iphone/` | complete           | Apache-2.0 / Appcelerator Commercial License | undetected     | [TI-80](https://linear.app/titanium-sdk/issue/TI-80) |
| `com.appcelerator.urlSession`    | ios            | `ios/`    | complete           | Apache-2.0                                   | undetected     | [TI-90](https://linear.app/titanium-sdk/issue/TI-90) |
| `facebook`                       | android+ios    | `ios/`    | complete           | Apache-2.0                                   | undetected     | [TI-87](https://linear.app/titanium-sdk/issue/TI-87) |
| `ti.applesignin`                 | ios            | `ios/`    | complete           | MIT                                          | MIT            | none                                                 |
| `ti.barcode`                     | android+ios    | `ios/`    | complete           | Apache-2.0                                   | undetected     | [TI-91](https://linear.app/titanium-sdk/issue/TI-91) |
| `ti.coremotion`                  | ios            | `ios/`    | complete           | Apache-2.0                                   | undetected     | [TI-89](https://linear.app/titanium-sdk/issue/TI-89) |
| `ti.crypto`                      | android+ios    | `ios/`    | **ios apiversion** | Apache-2.0                                   | undetected     | [TI-86](https://linear.app/titanium-sdk/issue/TI-86) |
| `ti.geofence`                    | android+ios    | `ios/`    | complete           | Apache-2.0                                   | undetected     | none                                                 |
| `ti.identity`                    | android+ios    | `ios/`    | complete           | Apache-2.0                                   | undetected     | [TI-81](https://linear.app/titanium-sdk/issue/TI-81) |
| `ti.map`                         | android+ios    | `ios/`    | complete           | Apache-2.0                                   | undetected     | [TI-83](https://linear.app/titanium-sdk/issue/TI-83) |
| `ti.nfc`                         | android+ios    | `ios/`    | complete           | Apache-2.0                                   | undetected     | [TI-82](https://linear.app/titanium-sdk/issue/TI-82) |
| `ti.playservices`                | android        | n/a       | **android author** | Apache-2.0                                   | Apache-2.0     | [TI-85](https://linear.app/titanium-sdk/issue/TI-85) |
| `ti.webdialog`                   | android+ios    | `ios/`    | complete           | Apache-2.0                                   | undetected     | none                                                 |

"Fields" is checked against `version`, `moduleid`, `minsdk`, `apiversion`,
`guid`, `author`, `license`, `copyright`, `description` and `architectures`. 25
of the 27 manifests carry all ten. `docs/module-curation.md` sets the bar at
`moduleid`, `version` and `minsdk`, and every manifest clears that.

"GitHub licence" is the SPDX id GitHub's own classifier reports. Fourteen of the
sixteen say nothing, because their `LICENSE` opens with a copyright preamble
before the Apache text and the classifier will not match a prefixed file. Every
one of those fourteen is Apache 2.0 when read. This is cosmetic and no issue was
filed for it on its own; see "What was deliberately not filed".

## Findings

### The manifest licences were already fixed, except where the path hid one

[TI-66](https://linear.app/titanium-sdk/issue/TI-66) found six spellings of
Apache 2.0 plus `Proprietary` and `Appcelerator Commercial License` across the
sixteen modules, and [TI-69](https://linear.app/titanium-sdk/issue/TI-69)
cleared the placeholder that came with it. Both landed. Reading the default
branches today, 26 of the 27 manifests say `Apache-2.0` or `MIT`.

The exception is `appcelerator.https`, whose iOS manifest still says
`Appcelerator Commercial License`. It is also the only manifest in the org
living at `iphone/manifest`. The two facts are almost certainly the same fact:
whatever swept the org for `*/ios/manifest` did not see this file.

This is the strongest argument in the audit for moving the path, and it is not
an argument about tidiness.

### Three tag conventions is an undercount

TI-24 named three conventions. There are five groupings and 17 distinct
spellings across the 400 releases:

| Shape                   | Example                                                                                                             | Releases |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- | -------: |
| `<platform>-<version>`  | `android-15.0.0`                                                                                                    |      181 |
| `v<version>-<platform>` | `v14.0.0-android`                                                                                                   |      124 |
| `v<version>`            | `v4.0.0`                                                                                                            |       45 |
| `<version>`             | `3.0.0`                                                                                                             |       23 |
| everything else         | `iOS-2.3.2`, `3_2_3_GA`, `android-4.0.2v2`, `Android-v3.0.0`, `ios-v2.0.4`, `2.0.0-android`, `android-1.0.0-beta.1` |       27 |

Fourteen of the sixteen repos have used more than one. `ti.map`, `ti.geofence`
and `ti.webdialog` have used seven each; only `ti.coremotion` and
`titanium-apple-sign-in` have been consistent. None of this costs anything today,
because nothing reads a tag: the version comes from the asset filename and the
tag is carried through as an opaque reference. It costs a release manager, who
has to guess.

### Manifest versions drift behind what shipped

82 of the manifests committed at released tags declare a `version` that does not
match the version in the asset that shipped. The pattern is a bump applied
during packaging but never committed back, so the tag's manifest describes the
previous release. The extractor already handles this correctly, preferring the
asset (`toModuleManifest` falls back to the shipped version, and a disagreement
is reported rather than corrected), so this is a source-repo habit rather than a
registry problem. `titanium-identity` is called out on
[TI-81](https://linear.app/titanium-sdk/issue/TI-81) because there it compounds
with two other defects.

Three repos have the inverse, a version on `master` ahead of anything released:
`appcelerator.encrypteddatabase` iOS is at 4.0.1 with 3.0.0 the newest release,
and `ti.coremotion` and `ti.urlsession` have been sitting unreleased since 2021.

### One module still ships two guids

24 released versions across four modules declare a different `guid` per
platform. `facebook` (11 versions), `ti.map` (9) and `ti.nfc` (1) were
reconciled at some point and agree on their default branches today.
`ti.identity` (3 versions) never was, and still does not.

### minsdk

Two of the 27 manifests use the `.GA` suffix: `ti.map` iOS `10.0.0.GA` and
`appcelerator.bluetooth` android `12.7.0.GA`. Everything else is plain `x.y.z`.

The gap TI-24 flagged in `ti.map` (android `12.7.0`, iOS `10.0.0.GA`) is real
but not unique to it. Seven modules have android two or more majors ahead of
iOS, because the two platforms have separate release histories and iOS has been
the quieter side since 2020. Two modules have the reverse, iOS ahead of android:
`ti.identity` and `appcelerator.ble`. Those gaps are recorded per repo rather
than treated as one problem, because each needs someone to say what that
platform actually requires.

### Stale architectures

Five iOS manifests still list `armv7` and `i386`, slices Xcode has not produced
for years: `appcelerator.https`, `ti.barcode`, `ti.coremotion`, `ti.crypto` and
`ti.urlsession`. Nothing breaks; the packager ignores what it cannot build.
Folded into each repo's issue rather than raised separately.

## Decisions

### Tag convention: `v<version>-<platform>`

Adopted for all future releases in all 16 repos. `ios` or `android`, always
present, including on modules that only ship one platform.

```
v7.3.1-ios
v5.7.0-android
v18.6.0-android
```

`<platform>-<version>` is the plurality across all 400 releases and was the
right answer if the question were "what has this org done most". It is not what
this org is doing. Grouping the releases by year:

| Period       | `v<version>-<platform>` | `<platform>-<version>` | other |
| ------------ | ----------------------: | ---------------------: | ----: |
| 2014 to 2019 |                      11 |                    161 |    71 |
| 2020 to 2023 |                      97 |                     15 |    21 |
| 2024 to 2026 |                      16 |                      4 |     3 |

The 399 here are the released ones; the draft carries no publication date.

`<platform>-<version>` belongs to the Appcelerator era and has been in retreat
since 2019. `v<version>-<platform>` is what the seven modules released together
on 2025-10-25 used, and what 13 of the 15 releases in 2025 used. Adopting it
makes one repo change habit rather than fourteen.

Three details, all of which the corpus already disagrees on:

- **`ios`, never `iphone`.** Both are in use in tags (`v3.0.0-iphone` in
  September 2025, `v4.0.0-ios` in November 2025). The asset filename keeps
  `iphone` because that is what the packager writes, and changing that is a
  packager question, not a tagging one.
- **Lowercase.** `iOS-2.3.2` and `Android-v3.0.0` both exist. They are the only
  two case variants in eleven years and neither should recur.
- **The platform suffix even on single-platform modules.** `ti.playservices`,
  `ti.coremotion`, `ti.urlsession`, `titanium-apple-sign-in` and
  `appcelerator.bluetooth` currently tag bare `vX.Y.Z`. Requiring the suffix
  everywhere makes this one rule with no exceptions, and means a module that
  later gains a second platform does not need a second convention.

**History is not being retagged.** Nothing reads a tag, so the 17 existing
spellings cost nothing to leave. This applies to the next tag and no others.

### Manifest path: both, permanently, and move `appcelerator.https` anyway

TI-24 offered these as alternatives. They are not.

**The extractor keeps both paths, permanently.** `manifestPaths('ios')` returns
`['ios/manifest', 'iphone/manifest']` and will continue to. 36 of the iOS
manifests a full registry build reads still resolve through the fallback, across
five repos, and every one is at an immutable tag. Removing the fallback would
not raise an error, which is the dangerous part: those reads would return null
and the registry would rebuild with the iOS platform quietly absent from those
versions. This is now asserted by a test rather than left to a comment, so a
future tidy-up has to argue with something.

**`appcelerator.https` still moves to `ios/manifest`, on
[TI-80](https://linear.app/titanium-sdk/issue/TI-80).** Not because the
extractor needs it, but because the divergent path is what let a wrong licence
survive an org-wide remediation. The exact change is written out on the issue:
`git mv iphone/manifest ios/manifest`, set `license: Apache-2.0`, and drop the
dead architecture slices. No commits were pushed to any module repo as part of
this audit.

To make the move verifiable rather than a matter of belief,
`scripts/generate-modules.ts` now reports which repos read through the fallback
and marks a repo that has never moved:

```
iOS manifests read from the legacy iphone/ path:
  tidev/appcelerator.https: 16 of 16  <- never moved to ios/manifest
  tidev/ti.geofence: 9 of 13
  tidev/appcelerator.encrypteddatabase: 8 of 18
  tidev/ti.coremotion: 2 of 9
  tidev/ti.facebook: 1 of 46
```

The other four counts will never reach zero, because old tags do not move. Only
the "never moved" marker should disappear, and only for this one repo.

### Axway-era metadata: no blanket rewrite, three targeted corrections

24 of the 27 manifests name Axway or Appcelerator in `author` or `copyright`.
None of them are being rewritten wholesale.

**`copyright` is a legal notice, not a label.** These modules are Apache 2.0,
and section 4(c) requires retaining the copyright and attribution notices
present in the work. `Copyright (c) 2013-present by Axway, Inc.` on `ti.map` is
a true statement about who wrote that code in 2013. Replacing it with TiDev
would assert authorship TiDev does not have and would strip a notice the licence
says to keep. There is no version of "refresh the Axway metadata" that is both
tidy and correct.

Where the current maintainer should appear, it appears **additively**.
`ti.webdialog`'s iOS manifest already shows the shape:
`Copyright (c) 2017-present by TiDev`. A module substantially maintained by
TiDev can carry a second notice beside the first, not instead of it.

**`author` is a credit list and carries no such constraint**, but there is also
nothing wrong with it. `author: Axway` on `appcelerator.ble` and
`author: Appcelerator` on `ti.map` android name a dissolved company where
individuals might be preferable, and that is a matter of taste, not correctness.
No issue was filed.

Three values are wrong as statements of fact and are being fixed:

| Where                       | Value                                                                  | Why it is wrong                                                           | Issue                                                |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `titanium-identity` android | `copyright: Copyright (c) 2017 by Your Company`                        | The scaffolding template's default. Names nobody.                         | [TI-81](https://linear.app/titanium-sdk/issue/TI-81) |
| `appcelerator.https` iOS    | `license: Appcelerator Commercial License`                             | Contradicts the repo's Apache 2.0 `LICENSE` and its own android manifest. | [TI-80](https://linear.app/titanium-sdk/issue/TI-80) |
| `ti.nfc`                    | `LICENSE` conditions use on an Appcelerator Terms of Service agreement | No such agreement can now be entered. Contradicts `license: Apache-2.0`.  | [TI-82](https://linear.app/titanium-sdk/issue/TI-82) |

The first two are the same class of defect TI-66 and TI-69 dealt with, missed
because one was a `copyright` rather than a `license` and the other was behind
the legacy path.

## What changed in this repo

The audit itself is documentation. Two things in the extractor changed, both
because the audit had to determine by hand something the tooling already had in
front of it:

- `scripts/lib/modules.ts` gained `LEGACY_IOS_MANIFEST` and
  `isLegacyManifestPath`, and `scripts/generate-modules.ts` now threads the path
  a manifest was found at through to a per-repo summary. The registry records
  what a manifest said but not where it was read from, so "which repos are still
  on `iphone/`" was a question only GitHub could answer.
- `scripts/lib/modules.ts` gained `guidMismatch`, and `generate-modules.ts`
  reports it for every version and for each default branch. It is the fourth
  manifest cross-check and the only one between two manifests rather than
  between a manifest and its artifact.

Both are reported, never corrected, for the same reason the existing three are:
the manifest is evidence about the release, and where it disagrees with the
artifact, the artifact is what a developer installs.

`registry/modules/` was not regenerated. A run today rewrites 16 files under the
mutable `main/` directories, all of it upstream drift since the last generate
(licence strings normalised by TI-66, `ti.map` android bumped to 6.0.0, a
`ti.playservices` README edit) and none of it this audit's business.

## Follow-ups

One issue per repo, twelve in total, each labelled `upstream` and each naming
the exact change. Four repos needed none: `appcelerator.ble`, `ti.geofence`,
`ti.webdialog` and `titanium-apple-sign-in`.

| Issue                                                | Repo                             | What it asks for                                                         |
| ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| [TI-80](https://linear.app/titanium-sdk/issue/TI-80) | `appcelerator.https`             | Move to `ios/manifest`; fix the `Appcelerator Commercial License` it hid |
| [TI-81](https://linear.app/titanium-sdk/issue/TI-81) | `titanium-identity`              | Reconcile the two guids; replace the `Your Company` copyright            |
| [TI-82](https://linear.app/titanium-sdk/issue/TI-82) | `ti.nfc`                         | Remove the Terms of Service clause from `LICENSE`                        |
| [TI-83](https://linear.app/titanium-sdk/issue/TI-83) | `ti.map`                         | Drop the `.GA` minsdk suffix; decide the real iOS floor                  |
| [TI-84](https://linear.app/titanium-sdk/issue/TI-84) | `appcelerator.bluetooth`         | Drop the `.GA` minsdk suffix                                             |
| [TI-85](https://linear.app/titanium-sdk/issue/TI-85) | `ti.playservices`                | Add the missing `author` field                                           |
| [TI-86](https://linear.app/titanium-sdk/issue/TI-86) | `ti.crypto`                      | Add the missing `apiversion`; drop dead architectures                    |
| [TI-87](https://linear.app/titanium-sdk/issue/TI-87) | `ti.facebook`                    | Adopt the tag convention on the next release                             |
| [TI-88](https://linear.app/titanium-sdk/issue/TI-88) | `appcelerator.encrypteddatabase` | Release iOS 4.0.1 or roll the manifest back                              |
| [TI-89](https://linear.app/titanium-sdk/issue/TI-89) | `ti.coremotion`                  | Say whether it is finished or stalled                                    |
| [TI-90](https://linear.app/titanium-sdk/issue/TI-90) | `ti.urlsession`                  | Say whether it is finished or stalled                                    |
| [TI-91](https://linear.app/titanium-sdk/issue/TI-91) | `ti.barcode`                     | Decide whether iOS 6.0.0 still works                                     |

### What was deliberately not filed

**The 14 undetected licences.** Prefixing a `LICENSE` with a copyright banner
stops GitHub's classifier matching it, so fourteen repos show no licence in the
sidebar despite all being Apache 2.0. Fixing it means fourteen near-identical
PRs to change a label GitHub renders and nothing reads. It is mentioned on
[TI-82](https://linear.app/titanium-sdk/issue/TI-82), which has to touch a
`LICENSE` anyway, and should be picked up opportunistically rather than as a
campaign.

**The 82 manifest versions behind their assets.** A per-repo issue would be
fourteen issues asking for the same habit change, and the extractor already
resolves it in the right direction. The habit is worth fixing in whatever cuts
releases, not in the repos one at a time.

**Retagging.** Explicitly out of scope in TI-24 and correct: nothing reads a
tag, so 400 rewritten refs would buy nothing and break every inbound link to a
release.
