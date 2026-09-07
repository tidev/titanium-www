# What gets listed in the module registry

Settled in [TI-23](https://linear.app/titanium-sdk/issue/TI-23). Read this
before editing `registry/modules/verified.json` or
`registry/modules/blocked.json`, and before changing what
`scripts/generate-community-modules.ts` collects.

The registry is a curated list with an uncurated tail, and the point of this
document is that those are different things wearing different badges.

## The rule

**Three tiers, and only one of them says anything about the code.**

| Badge      | Means                                                                            | Lives in                                      |
| ---------- | -------------------------------------------------------------------------------- | --------------------------------------------- |
| Official   | TiDev maintains it. Releases are verified and the API reference is compiled here | `scripts/docgen/sources.json`                 |
| Community  | TiDev has reviewed the repository and vouches for it. Nothing is hosted here     | `registry/modules/verified.json`              |
| Unverified | Found by its `titanium` topic. Nobody has looked at it                           | `registry/modules/community.json`, by default |

**Being listed is not an endorsement.** The bar for appearing at all is a
`titanium` topic and a platform directory. That is a search result, and the
Unverified badge says so.

The test when you are unsure which tier: _has a person looked at this
repository and would we tell someone to use it?_ If not, it is Unverified. The
default is Unverified, and it takes an edit to change.

## Four lists

Two are written by hand, one is generated, one is the existing allowlist.

`scripts/docgen/sources.json` is **unchanged by this policy** and stays what it
was: the repos the regen workflow may fetch and run docgen against. It is a
security boundary before it is a curation list, which is why nothing here
widens it.

`registry/modules/verified.json` is the vouching list, at two granularities. A
`modules` entry vouches for one repository and records who vouched and when,
because a per-module verification nobody signed cannot be revisited. `owners` is
a plain list of GitHub usernames: short enough to read at a glance, and `git log`
answers who added a name and when.

`registry/modules/blocked.json` is the exclusion list. An entry records why,
for the same reason. Forks and archived repositories do **not** belong here:
the generator drops those mechanically.

`registry/modules/community.json` is regenerated daily by
`.github/workflows/refresh-community-modules.yml` and holds only what GitHub
said. **Curation is never written into it.** The status is joined on at read
time in `communityListings()`, so a regen cannot overwrite a judgement and a
judgement never has to be re-applied after one.

## What earns Community

All four, checked by a person against the repository:

1. **GitHub releases with a packaged `.zip` asset.** A repo you have to build
   yourself is not something to point a beginner at.
2. **A parseable manifest** in each platform directory, with a `moduleid`,
   `version` and `minsdk`.
3. **A licence.** Anything OSI-approved. No licence means nobody can legally use
   it, whatever the README implies.
4. **Not abandoned.** A release or a substantive commit inside two years, or an
   explicit statement that it is finished and works.

A module can be excellent and fail this. Failing it means Unverified, not
blocked.

### Vouching for an author

A username in `owners` says the four above hold for everything that author
publishes, including what they publish next. Use it for someone with a track
record and a consistent standard, where listing their modules one at a time
would be a list that goes stale every release.

It is a weaker claim than a per-repo entry, and deliberately so: it is a bet on
the author rather than a review of each module. Two things make that safe to
take. It is applied at read time, so withdrawing it is one deletion and takes
effect on the next build. And a single module that should not carry it goes in
`blocked.json`, which wins.

Vouched for today: **hansemannn** (40 listings) and **m1ga** (8), which is 48
of the 106.

## What earns a block

Not "it is bad". Blocking is for listings that mislead:

- It is not a Titanium module, but carries the topic.
- It duplicates another listing under a different name, with nothing added.
- It is a name-squat, or its README describes something it does not do.
- Its author asked to be delisted.
- It ships something hostile.

Forks and archived repositories are excluded by the generator, so they never
need an entry.

## Delisting

**Archived repositories leave on their own.** The generator drops them, so a
module its author has finished with disappears from the list the next day
without anyone doing anything.

**A verified module that stops meeting the bar is demoted, not blocked.**
Remove it from `verified.json` and it falls back to Unverified with its listing
intact. Blocking is a stronger statement and is not the tool for staleness.

**48 of the 106 are verified**, by two usernames in `owners`. The other 58 are
Unverified: nobody has looked at them, one at a time, and the badge says so.

## Who decides

`.github/CODEOWNERS` names one person: `me@chrisbarber.dev`, @cb1kenobi, "Sole
active maintainer". Verification and blocking are that person's call.

There is no submission process, and that is deliberate. Discovery is automatic
through the `titanium` topic, so there is nothing to submit: a module appears
in the list by carrying the topic, and moves tiers when someone reviews it.
Adding a form would create a queue without adding a way through it.

## What was rejected

**One file that doubles as the security allowlist.** TI-23 originally asked for
this. It would have meant that vouching for a community module also granted its
owner the ability to make this repository fetch and run docgen against their
code on dispatch. Verification is a statement about a module; that would have
made it a grant of execution. The two lists stay separate.

**Dropping the modules that fail the bar.** Of the 112 the search returned,
the median has 6 stars and most have no releases and no packaged asset. Applying the bar as a filter would have emptied the list and lost
modules.titaniumsdk.com most of what it lists. Badging them honestly keeps the
search useful and tells the truth about what a listing is.
