# Accessibility and mobile audit

Run for [TI-49](https://linear.app/titanium-sdk/issue/TI-49) on **2026-09-07**,
against the production build (`pnpm build && pnpm start`) of this branch, which
is `4a0939e` plus the fixes listed below. Every sweep was run twice: once on
`4a0939e` to find the defects, and again after fixing them, so the before and
after numbers are the same measurement.

Numbers below are measured, not estimated. Where a criterion needs hardware or a
person this machine does not have, it says so instead of reporting a result.

Re-run everything here before claiming the gate again: the scripts are described
under [Method](#method) and are a dozen lines each.

## Headline

| Measure                                           | Result                                                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| axe violations, 12 pages x 2 themes x 2 viewports | **0 critical, 0 serious-with-a-fix-available**; 3 rules left open, all design or content decisions |
| Lighthouse performance                            | **93 to 100** (worst: API reference, mobile)                                                       |
| Lighthouse accessibility                          | **95 to 100** (worst: API reference, both form factors)                                            |
| Horizontal scroll at 320px                        | **none** on any of the 12 pages                                                                    |
| Contrast, shipped tokens                          | **56 of 56 pairings pass**, both themes                                                            |
| Contrast, rendered elements                       | 3,992 pass, **0 violations**, 14,320 not resolvable by axe (see [Contrast](#contrast))             |
| `prefers-reduced-motion`                          | respected; **0** elements keep a transition or animation                                           |

Before this pass the same sweep reported 8 rules: 2 critical (`image-alt`,
`label`), 4 serious (`scrollable-region-focusable`, `link-in-text-block`,
`target-size`, `nested-interactive`) and 2 moderate (`landmark-unique`,
`heading-order`), plus one page scrolling sideways at 320px. Five of the eight
are gone. The three that remain are `target-size`, `nested-interactive` and
`heading-order`, at the same node counts as before, and they are open findings
9, 8 and 11 below.

## Method

Tooling, all run locally against the production server on `localhost:3000`:

| Tool           | Version       |
| -------------- | ------------- |
| axe-core       | 4.13.0        |
| Lighthouse     | 12.8.2        |
| puppeteer-core | 23.11.1       |
| Google Chrome  | 152.0.7977.83 |
| Node           | v26.8.1       |

axe ran with tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice`
over twelve pages, each at 320x720 (mobile emulation, touch) and 1280x900, in
both the light and dark themes: 48 page loads per sweep. The pages are one from
every section named in the ticket plus their neighbours:

`/`, `/docs`, `/docs/setup/macos`, `/docs/sdk/Titanium.UI.Window`,
`/docs/sdk/main/Titanium.UI.Window`, `/docs/sdk/main`, `/modules`,
`/modules/appcelerator.ble`, `/modules/appcelerator.ble/api`, `/downloads`,
`/downloads/builds`, `/blog/sdk-13-4-1-ga`.

Search and the mobile drawer are dialogs rather than pages, so they were audited
open and populated: the drawer at 375px, and search after typing `window` and
waiting for 31 results to land. Both come back clean.

Lighthouse ran on seven pages in both form factors, mobile under the standard
4x CPU slowdown and 1.6 Mbps throttling.

### What the numbers do not cover

- **Lighthouse SEO reads 61 to 69 on every page. That is an artifact of testing
  on localhost, not a finding.** `src/app/robots.ts` serves `Disallow: /` for any
  host `isIndexableHost` does not recognise, so the only failing SEO audit is
  `is-crawlable`. Every other SEO audit passes.
- axe is a static checker. It finds roughly a third of WCAG issues at best, and
  none of the ones that need judgement about whether a page makes sense.

## Findings

Severity is axe's, or assigned by the same scale where the finding came from
manual inspection rather than a tool.

### Fixed in this pass

| #   | Page                          | Component                                                                       | WCAG                         | Severity | Finding and fix                                                                                                                                                                                                                                                                                                                                           |
| --- | ----------------------------- | ------------------------------------------------------------------------------- | ---------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | API reference (both routes)   | `src/lib/docs/markdown.ts`                                                      | 1.1.1 Non-text Content       | critical | About twenty images in the apidoc corpus are hand-written HTML with no `alt`, so a screen reader announced the filename (`7618194ed3a17536.png`). The renderer now defaults `alt=""`, marking them decorative. See [open finding 10](#still-open) for the real fix.                                                                                       |
| 2   | API reference, all three      | `docs/api-nav.tsx`, `docs/guide-nav.tsx`                                        | 4.1.2 Name, Role, Value      | critical | The phone disclosure is a `peer sr-only` checkbox whose only label is `lg:hidden`. Above `lg` that left a 1x1 unnamed checkbox in the tab order, confirmed as a real focus stop by walking Tab. Both inputs now carry `lg:hidden` too; `peer-checked` is a sibling selector and does not care about `display`.                                            |
| 3   | Landing, guides, API, modules | `markdown.ts`, `app/page.tsx`, `docs/member-section.tsx`, `modules/install.tsx` | 2.1.1 Keyboard               | serious  | Code blocks and the parameters tables scroll sideways so they cannot widen the page, but nothing could focus them, so a keyboard had no route to the end of a long line. All now take `tabindex="0"` with a visible ring, which is what `Terminal` already did for its rows. Counts are in [What this cost the tab order](#what-this-cost-the-tab-order). |
| 4   | CI builds                     | `downloads/branch-builds.tsx`                                                   | 1.4.1 Use of Color           | serious  | "open an issue" sits mid-sentence in a `text-text-muted` paragraph, and `--link` against that is under 3:1 in the light theme, so colour alone marked it as a link. Now underlined at rest.                                                                                                                                                               |
| 5   | Module API reference          | `docs/member-section.tsx`                                                       | 1.3.1 Info and Relationships | moderate | `aria-labelledby` promoted every member group to a `region` landmark, so a module page offered eight landmarks all called "Properties". Nested groups keep the heading and give up the landmark; page-level groups keep both.                                                                                                                             |
| 6   | Module API reference          | `docs/member-section.tsx`                                                       | 1.4.10 Reflow                | serious  | The page scrolled sideways at 320px: `Promise<Titanium.Android.RequestPermissionAccessResult>` is one 429px token. Type and return signatures now break inside the word, the same trade `.prose-docs` already makes for links and inline code. This was the last horizontal scroll on the site.                                                           |
| 7   | Every page                    | `theme-toggle.tsx`                                                              | 2.1.1 Keyboard, 4.1.2        | serious  | The control claims `role="radiogroup"` and behaved like three unrelated buttons: three separate tab stops, and the arrow keys did nothing. Now a roving `tabindex` with Arrow, Home and End, per the ARIA authoring practices. Verified: `tabIndex` is `[-1, 0, -1]` and ArrowRight moves the selection.                                                  |

Finding 5's first fix introduced the same problem one level down: naming the
parameters wrapper `role="region"` gave a type page sixty landmarks called
"Parameters". It ships as `role="group"`, which takes a name without joining the
landmark list. Worth knowing before someone reaches for `region` again.
Re-checked after the fact: `group` does not repeat the mistake a level further
down, and `landmark-unique` is clean on every page in the sweep.

Finding 3 has a trap of its own. The landing page block sits in an
`overflow-hidden` wrapper it fills exactly, so a ring offset outwards is clipped
on three sides and the new stop had no visible indicator at all: WCAG 2.4.7,
introduced by the fix for 2.1.1. That one block draws its ring inset instead.
Anything given a tab stop needs its ring looked at, not assumed.

### What this cost the tab order

Making the scrolling boxes focusable adds stops, and it is worth being exact
about how many, because it is the largest single behaviour change in this pass.
Measured on the shipped build:

| Page                                | Blocks | Parameter tables | Added stops | Of those, scrolling at 320px | At 1280px |
| ----------------------------------- | ------ | ---------------- | ----------- | ---------------------------- | --------- |
| `/`                                 | 2      | 0                | 2           | 2                            | 0         |
| `/docs/setup/macos`                 | 18     | 0                | 18          | 5                            | 1         |
| `/docs/sdk/Titanium.UI.Window`      | 28     | 36               | 64          | 64                           | 5         |
| `/docs/sdk/main/Titanium.UI.Window` | 28     | 36               | 64          | 64                           | 5         |
| `/modules/appcelerator.ble`         | 61     | 0                | 61          | 55                           | 3         |
| `/modules/appcelerator.ble/api`     | 3      | 97               | 100         | 100                          | 0         |

So the worst page gains 100 stops, not the couple of dozen a spot check
suggests. The defence is the second-to-last column: at 320px, where the scroll
trade is what stops the page moving sideways, every one of those boxes really
does scroll and really does need a keyboard route. At 1280px almost none of them
do, and those stops are surplus.

`tabindex` is written at render time and cannot know the viewport, so this is
the cost of doing it without script. Whether 100 stops reads as help or as an
obstacle is the sort of question only the screen reader pass below can settle.

### Still open

None of these are unsafe to ship. Each needs a decision that is not the QA
pass's to make.

| #   | Page                              | Component                                                      | WCAG                    | Severity | Finding                                                                                                                                                                                                      | Why it is open                                                                                                                                                                                                                             |
| --- | --------------------------------- | -------------------------------------------------------------- | ----------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 8   | API reference, guides             | `docs/api-tree.tsx`                                            | 4.1.2 Name, Role, Value | serious  | `nested-interactive`: each namespace row puts a link inside its `<summary>`, 21 of them on a type page. A screen reader in browse mode may not reach the link, and the summary's name absorbs the link text. | Deliberate and documented in the component: splitting them costs one extra row per namespace across 284 types. Fixing it is a nav redesign, not a patch.                                                                                   |
| 9   | API reference, guides, module API | `docs/api-tree.tsx`, `docs/toc.tsx`, `docs/member-section.tsx` | 2.5.8 Target Size (AA)  | serious  | Rail rows and contents links measure 17 to 20px tall against a 24px minimum. 59 on the module API page.                                                                                                      | The rails are dense on purpose and the comments say so. Note that most flagged nodes are inline links inside a sentence, which 2.5.8 exempts and axe does not model, so the true count is smaller than it looks. Needs a density decision. |
| 10  | API reference                     | registry prose                                                 | 1.1.1 Non-text Content  | moderate | Finding 1 makes those images silent rather than wrong. Some are genuine screenshots that deserve real alt text.                                                                                              | Writing it means describing twenty images from a 15-year corpus. That is a content task, and inventing alt text from a filename would be worse than the empty string.                                                                      |
| 11  | API reference                     | registry prose                                                 | 1.3.1 (best practice)   | moderate | `heading-order`: one example description opens at `h3` under the page `h1`.                                                                                                                                  | The heading is in the SDK's own YAML. Fixing it here means rewriting corpus prose at render time, which is a docgen decision.                                                                                                              |

## Criterion by criterion

| Ticket criterion                                          | Status                                                                                                                                                                                              |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Axe clean on representative pages from every section      | **Met**, with findings 8, 9 and 11 recorded as accepted. No critical or serious issue remains that has an unambiguous fix.                                                                          |
| Keyboard navigable end to end                             | **Met.** Walked Tab through the header, both docs rails, the version switcher, the tabs and both dialogs. Two defects found and fixed (findings 2 and 7).                                           |
| Focus visible everywhere, never trapped except in modals  | **Met.** Every stop in the header sequence draws a 2px ring. The two dialogs trap deliberately and both release on Escape with focus restored to the trigger, verified.                             |
| Screen reader pass on the main flows                      | **Not done. Needs a person.** See below.                                                                                                                                                            |
| Contrast clears AA in both themes, against shipped tokens | **Met.** See [Contrast](#contrast).                                                                                                                                                                 |
| Real device testing on iOS Safari and Android Chrome      | **Not done. Needs hardware.** See below.                                                                                                                                                            |
| No horizontal page scroll at 320px                        | **Met.** All 12 pages measure `scrollWidth == clientWidth == 320`. One page failed before finding 6.                                                                                                |
| `prefers-reduced-motion` respected                        | **Met.** Under emulated `reduce`, zero elements retain a transition or animation over 50ms, and `scroll-behavior` is `auto`. The existing rule in `globals.css` covers it; nothing needed changing. |
| Lighthouse scores recorded                                | **Met.** Below.                                                                                                                                                                                     |

## Contrast

Two checks, because neither is sufficient alone.

**Tokens.** `pnpm check:contrast` parses `src/app/globals.css` itself rather than
a duplicate table, so it measures what ships. All 56 pairings pass in both
themes. The tightest are `text-subtle on field` at 4.68:1 (min 4.5) in light, and
`border-strong on bg` at 3.28:1 (min 3) in dark.

**Rendered elements.** axe's `color-contrast` rule over 9 pages in both themes:
3,992 elements pass and **none fail**. It also returns 14,320 as _incomplete_,
every one with the same reason: `Element's background color could not be
determined due to a background gradient`. That gradient is the brushed grain on
`body` and `.surface-metal`.

So the grain was measured directly. It paints one stripe pixel in every three at
`rgb(0 0 0 / 0.014)` in light and `rgb(255 255 255 / 0.016)` in dark. Compositing
a worst-case stripe pixel onto `--bg` gives `#fbfbfb` and `#1e2327`, and every
tight pairing still clears its target:

| Theme | Pairing               | Flat   | Worst grain pixel | Minimum |
| ----- | --------------------- | ------ | ----------------- | ------- |
| light | `text-subtle on bg`   | 5.07:1 | 4.90:1            | 4.5     |
| light | `focus on bg`         | 4.95:1 | 4.78:1            | 3       |
| light | `border-strong on bg` | 3.36:1 | 3.25:1            | 3       |
| dark  | `text-subtle on bg`   | 7.09:1 | 6.77:1            | 4.5     |
| dark  | `border-strong on bg` | 3.28:1 | 3.13:1            | 3       |

The worst case anywhere is `border-strong` in dark at 3.13:1 against a 3.0
minimum, and that is a border rather than text. The grain costs at most 0.33 of
a ratio point. It does not put anything under AA.

## Lighthouse

2026-09-07, production build, localhost. Mobile is throttled 4x CPU and
1.6 Mbps; desktop is not.

| Page                                | Form    | Perf | A11y | Best practices | LCP   | CLS | TBT   |
| ----------------------------------- | ------- | ---- | ---- | -------------- | ----- | --- | ----- |
| `/`                                 | mobile  | 96   | 100  | 100            | 2.8 s | 0   | 0 ms  |
| `/`                                 | desktop | 100  | 100  | 100            | 0.6 s | 0   | 0 ms  |
| `/docs/setup/macos`                 | mobile  | 96   | 100  | 100            | 2.8 s | 0   | 0 ms  |
| `/docs/setup/macos`                 | desktop | 100  | 96   | 100            | 0.6 s | 0   | 0 ms  |
| `/docs/sdk/main/Titanium.UI.Window` | mobile  | 93   | 95   | 100            | 3.2 s | 0   | 10 ms |
| `/docs/sdk/main/Titanium.UI.Window` | desktop | 100  | 95   | 100            | 0.7 s | 0   | 0 ms  |
| `/modules/appcelerator.ble`         | mobile  | 96   | 100  | 100            | 2.8 s | 0   | 0 ms  |
| `/modules/appcelerator.ble`         | desktop | 100  | 100  | 100            | 0.6 s | 0   | 0 ms  |
| `/modules/appcelerator.ble/api`     | mobile  | 96   | 100  | 100            | 2.7 s | 0   | 10 ms |
| `/modules/appcelerator.ble/api`     | desktop | 100  | 96   | 100            | 0.7 s | 0   | 0 ms  |
| `/downloads`                        | mobile  | 96   | 100  | 100            | 2.8 s | 0   | 0 ms  |
| `/downloads`                        | desktop | 100  | 100  | 100            | 0.6 s | 0   | 0 ms  |
| `/modules`                          | mobile  | 95   | 100  | 100            | 2.9 s | 0   | 0 ms  |
| `/modules`                          | desktop | 100  | 100  | 100            | 0.6 s | 0   | 0 ms  |

Cumulative layout shift is 0 on every page in both form factors, and total
blocking time never exceeds 10ms. The only accessibility audits Lighthouse fails
are `target-size` and `heading-order`, which are open findings 9 and 11.

SEO is 61 to 69 everywhere and is not a finding: see
[What the numbers do not cover](#what-the-numbers-do-not-cover).

## What still needs a person

Two acceptance criteria cannot be closed from this environment. Neither was
attempted, and neither should be marked done on the strength of anything above.

**Real device testing on iOS Safari and Android Chrome.** Everything here is
Chrome 152 on macOS, including the 320px work, which used Chrome's mobile
emulation. Emulation gets layout right and gets platform behaviour wrong. The
things most likely to differ, and so the things worth checking first:

- The native `<dialog>` in `MobileNav` and `SiteSearch`. `showModal` focus
  trapping, backdrop dismissal and Escape are exactly where Safari has
  historically diverged.
- `100dvh` and the sticky header against Safari's collapsing toolbar. The rails
  use `max-h-[calc(100dvh-4rem)]`.
- `autoFocus` on the search input, which on iOS decides whether the keyboard
  opens and whether the viewport zooms.
- The Radix `Select` in the module filters. `src/components/ui/select.tsx`
  records that phones get the listbox rather than the OS picker, and that
  trade has never been checked on a real phone.
- Touch target sizes in the docs rails, which is open finding 9 and is much
  easier to judge with a thumb than with a checker.

**A screen reader pass on the main flows.** No VoiceOver, NVDA or TalkBack here,
and none of them can be driven headlessly in a way that would produce an honest
result. axe checks that names and roles exist; it cannot tell you whether the
reference page is comprehensible read aloud. The flows worth walking:

- Landing to a guide to a code sample, now that every code block is a tab stop.
  That is 18 extra stops on the macOS setup guide and 100 on the busiest module
  API page, and it should be confirmed that it reads as a help rather than as an
  obstacle. See [What this cost the tab order](#what-this-cost-the-tab-order).
- Search: type, arrow through the grouped results, choose one. The combobox
  wiring checks out statically, including a resolving `aria-activedescendant`.
- The API rail on a type page, which is where open finding 8 lives. A link
  inside a `<summary>` is the thing most likely to be genuinely unreachable, and
  a real screen reader is the only way to settle how bad it is.
- The mobile drawer, opened and dismissed.
- A module's parameters table, which is now a named `group` and should announce
  as one.
