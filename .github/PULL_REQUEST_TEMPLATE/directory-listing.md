<!--
  Adding, renewing, or removing a developer directory listing.

  Use this template by adding ?template=directory-listing.md to the URL of the
  pull request page. It is a named template rather than the default one, so it
  applies only to directory pull requests and does not appear on every other
  pull request in the repository.

  The policy this is checked against is docs/developer-directory.md. Read it
  before filling this in; it says who may list and what gets a listing removed.
-->

## What this is

- [ ] A new listing
- [ ] A renewal (only `expiresAt` moves)
- [ ] An edit to an existing listing
- [ ] A removal

**Listing file:** `registry/directory/<your-slug>.json`

## Required fields

Every one of these is required by the schema, and `pnpm check:registry` fails
without them. They are listed here so you can see what you are agreeing to
publish before you write it.

| Field          | What goes in it                                                             |
| -------------- | --------------------------------------------------------------------------- |
| `id`           | Lowercase kebab-case slug. **Must equal the filename** and becomes your URL |
| `name`         | Your name, or the company name                                              |
| `kind`         | `individual` or `agency`                                                    |
| `summary`      | One sentence, up to 280 characters. What you do                             |
| `location`     | Free text: a city, a country, or something like "Remote, EU only"           |
| `timezone`     | An IANA zone, such as `Europe/Berlin`. Checked against the real list        |
| `availability` | One or more of `full-time`, `part-time`, `contract`                         |
| `specialisms`  | One to eight values from the list in `src/lib/registry/directory.ts`        |
| `contact`      | `{ "label": "...", "url": "https://..." }`. A page you control              |
| `expiresAt`    | `YYYY-MM-DD`, no more than three months out. Or set `neverExpires` instead  |

Optional: `skills` (free text, shown but not filtered on) and `links` (up to six).

## An optional picture

A photo if you are an individual, a logo if you are a company. Commit it beside
your JSON as `registry/directory/<your-slug>.png` (or `.jpg`, or `.webp`) and
nothing in the JSON refers to it: the filename is what connects it to your
listing. Without one, your listing shows your initials, which is a perfectly
good listing.

- **100KB, maximum.** Roughly 256x256 saved as `.webp`. The site has a hard
  deployment size limit and every listing shares it
- **No SVG.** It can carry script and would be served from this site's own
  origin. Export it to `.png`
- Convert rather than rename: the contents are checked against the extension

## Before you open this

- [ ] The file is named `<id>.json` and the `id` inside it is the same string
- [ ] `expiresAt` is at most three months from today, or this is a reviewed
      `neverExpires` listing and the reason is in the description below
- [ ] **No email address anywhere**, including inside a URL. The schema rejects
      `mailto:`, `tel:` and anything shaped like an address in any text field.
      This is not a formality: a scrapeable address on a public page is a cost
      you would carry for years
- [ ] `contact.url` goes to a page you control and can change or take down
- [ ] You are offering real Titanium work, and the summary describes it honestly
- [ ] Any picture is `.png`, `.jpg` or `.webp`, at most 100KB, and named after
      your slug
- [ ] `pnpm check:registry` passes locally, or CI will run it for you

## Anything the reviewer should know

<!--
  For a renewal, "still available, date moved" is a complete description.

  For a new listing, say briefly who you are: a repository, a shipped app, a
  Slack or Discussions handle. Nothing formal, just enough that the reviewer is
  not approving a name with no history behind it.
-->
