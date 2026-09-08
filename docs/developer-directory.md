# Who gets listed in the developer directory

Settled in [TI-58](https://linear.app/titanium-sdk/issue/TI-58). Read this
before adding, renewing or removing anything under `registry/directory/`, and
before reviewing a pull request that does.

The companion document is [`module-curation.md`](./module-curation.md), which
this is deliberately shaped like. The difference is what is being judged. A
module list can be assembled from a topic search and badged honestly, because
the thing being described is a repository and anyone can look at it. A directory
is a list of **people**, who cannot be scraped, cannot be badged by inspection,
and are affected by what we publish about them.

## What this directory is for

Two audiences, and the second one is the reason it exists at all.

A developer looking for paid Titanium work. That is the obvious one.

A company holding a Titanium codebase, asking whether anyone can still maintain
it. That is a real question about a framework in its seventeenth year, and it is
usually asked right before a rewrite is approved. "Here are people who do this,
who confirmed within the last three months that they are available" is a better
answer than anything on a marketing page.

## The rule

**A listing is a claim of availability, not a recommendation.**

TiDev checks that a listing is a real person or company offering real Titanium
work, and nothing beyond that. Nobody here has audited anyone's code, verified a
rate, or spoken to a former client. The directory page says so, and it should
keep saying so.

The test when you are unsure: _would we be misleading someone by publishing
this?_ Not _is this the best developer available_, which is not a question this
project can answer, and not _do we like them_, which is not one it should.

## Who may list

Anyone who is genuinely available for paid Titanium work, and who can open a
pull request. Both halves matter.

The first half is the honest bar and the only one about the person. Individuals,
contractors and agencies are all welcome and share one list.

The second half is the spam gate, and it is a feature rather than a limitation
we are working around. The audience is developers. Someone who cannot open a
pull request against a public repository is, with respect, not the listing a
company hunting for a Titanium maintainer is looking for. A submission form with
no account behind it would be a queue of spam that somebody would then have to
staff, and an account system, sessions, password recovery, deletion requests and
moderation tooling, is a permanent surface for what is fundamentally a list.

`.github/CODEOWNERS` already routes review, `git log` records who added a
listing and when, and the pull request is the audit trail.

## What is not published, ever

**No email addresses.** Not in a `mailto:`, not in a query string, not in a
sentence. The schema rejects all three, and
`src/lib/registry/directory.test.ts` pins that so a future refactor cannot
quietly relax it.

This is not squeamishness about contact details. A published address on a page
this visible is harvested within days, and the person who pays for that is the
listee, for years, on an address they may not be able to abandon. Every listing
carries a `contact` URL instead: a form, a profile, a page with whatever the
person chooses to expose on it, under their control and takeable down by them
without asking us.

Note that `z.url()` on its own accepts `mailto:someone@example.com` as a
perfectly valid URL. The protocol check in the schema is the only thing
standing between the directory and an address on every card.

## Pictures

A listing may carry a photo, or a logo if it is a company. It is optional, and a
listing without one shows the listee's initials instead, in the same box and at
the same size. Nobody is moved down the page for declining to publish a
photograph of themselves.

**A picture is a file committed beside the listing**, at
`registry/directory/<id>.png`, and nothing in the JSON refers to it. The
filename is the link, so there is no field to get out of step with the file, and
the schema does not change to accommodate pictures at all.

**There is no option to link to one.** The obvious alternative - a URL in the
listing, pointing anywhere - fails on two counts. The build refuses network
access outright, so nothing remote can be checked at the point it matters. More
seriously, an `<img>` aimed at a host of the listee's choosing reports every
visitor's address, user agent and referer to that host on every page view, and
can be swapped for a tracking pixel the day after review. This directory refuses
to publish an email address because the cost lands on the listee; a hotlinked
image puts a similar cost on the reader, who never asked to be here at all.

What is enforced, in `src/lib/directory/avatar.ts` and checked by
`pnpm check:registry`:

- `.png`, `.jpg` or `.webp`, and the file has to actually be what its extension
  says. A renamed file is refused rather than published.
- **No SVG.** It is a document that can carry script and pull in remote
  resources, and it would be served from this site's own origin. There is no
  version of an avatar that needs to be a program.
- **100KB per file.** A deployment budget rather than a matter of taste: the
  size limit is measured against the whole static output, which the directory
  shares with the compiled documentation, so the headroom for pictures is
  measured in single-digit megabytes.
- One picture per listing, and no orphans. A picture whose listing is gone fails
  the build rather than staying served at a URL nothing links to.

A picture is removed the way anything else is: by deleting the file. Deleting a
listing deletes its picture in the same pull request, and the published copy is
rebuilt from scratch on every deploy, so nothing survives the removal.

## Expiry, and why renewal is deliberately annoying

**A listing runs for three months.** `expiresAt` is required, cannot be set more
than three months ahead, and an expired listing disappears from the index, from
its own page, from the sitemap and from search.

**Renewing is a pull request that moves one date.** That is friction, and it is
the entire value of the directory. A list of people who were available at some
point is worthless to the company reading it; a list of people who each took two
minutes in the last quarter to say "still available" is worth something. Nothing
else in the system can produce that signal, because nothing else costs the
listee anything.

Expiry is applied at build time, and the site is statically generated, so a
nightly rebuild is what makes it happen on the right day. See
`.github/workflows/daily-rebuild.yml`.

### `neverExpires`

An opt-out exists. It is reviewed rather than self-served, and it should stay
rare.

A listing that never has to be renewed is a listing nobody has recently
confirmed, which is the one thing this directory offers over a web search. The
listing page says so in plain words rather than hiding it. Use it for a
long-standing entry where the maintainer is confident it will not go stale, and
remember that a `neverExpires` listing still gets removed on the grounds below,
just not automatically.

The two worked examples in `registry/directory/` carry it, because they are
maintained by this repository rather than by a person.

## Grounds for removal

A listing is removed, by pull request, when any of these is true:

- **It expired.** Automatic, and not a judgement about anyone. It comes back the
  moment its owner opens a renewal.
- **The listee asked.** No questions, no delay. This is the one that must never
  acquire a process.
- **It is not what it says it is.** Not offering Titanium work, not a real
  person or company, or a summary that describes something else.
- **The contact route is dead.** A 404, a parked domain, a form that bounces. A
  listing nobody can respond to is worse than no listing, because it costs the
  reader time before it fails.
- **It is being used as an advertisement for something else.** The directory is
  for Titanium work, not for a general agency's lead generation.
- **Conduct.** Credible reports of a listee behaving toward clients or toward
  this community in a way that we would not want a link from this site to have
  facilitated.

Removal is a deletion, with the reason in the pull request description. There is
no blocklist and no tombstone: a person is not a repository, and keeping a
public record of somebody we delisted is not a thing this project should have.
Somebody removed for cause who returns is a conversation, not a lookup.

## Who decides

`.github/CODEOWNERS` names one person: `me@chrisbarber.dev`, @cb1kenobi, "Sole
active maintainer". Approving a listing and removing one are that person's call.

The path is named explicitly in CODEOWNERS even though the wildcard already
covers it. That is not redundancy for its own sake: CODEOWNERS is last-match-
wins, so a future rule adding an owner for `/registry/` would otherwise change
who reviews listings as a side effect of a change about something else.

## Fair ordering

The listing order is a rota, not an alphabet. Sorting by name is a permanent
subsidy to whoever calls themselves "AAA Titanium", and there is no defence
against that except not sorting by name.

The order is a seeded shuffle rotated by the day number, computed on the server
at build time. Over any run of days as long as the list, every listing occupies
every position exactly once. Details and the reasoning are in `fairOrder` in
`src/lib/directory/profile.ts`.

The listing page offers filters and no sort menu, on purpose. A "sort by name"
option would hand the top of the list straight back to the person who renamed
themselves.

## Individuals and agencies share one list

They are badged, and there is a filter for anyone who cares. They are not
separate sections.

Somebody arriving here has a problem to solve, not a preference about company
size, and two sections would make them read both to be sure they had seen
everything. The badge answers the question for the minority who do care, at no
cost to everyone else. If the list ever grows to where two sections genuinely
read better than one, that is a change to make then, with the list in front of
us.

## What was rejected

**Accounts, a database, and a management portal.** Better Auth, Neon and Drizzle
were costed and turned down. Sessions, account recovery, GDPR deletion, and
moderation tooling are a permanent surface, and they would be carrying a list
that fits in a directory of JSON files. The pull request already provides
authentication, review, history and revocation.

**Dynamic route filtering for expiry.** Exact to the second, and it gives up
static generation for the whole page to buy precision on a three month window.

**Client-side filtering for expiry.** Expired listings would remain in the HTML
that crawlers read, so they would stay indexed after they stopped being shown.
That is the one failure mode a listee would actually mind.

**A nearing-expiry nudge.** A scheduled action opening an issue that mentions
the listee, a fortnight out. Deferred rather than refused: with two example
listings it would be a workflow with nothing to do, and it needs a GitHub
username on every listing, which the schema does not currently ask for. Revisit
when the directory has enough real listings that renewals are actually being
missed. The listing page already shows a countdown inside the last fortnight,
which costs nothing and covers the listee who thinks to look.
