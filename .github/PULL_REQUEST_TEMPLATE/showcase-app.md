<!--
  Adding, editing, or removing an app showcase entry.

  Use this template by adding ?template=showcase-app.md to the URL of the pull
  request page. It is a named template rather than the default one, so it applies
  only to showcase pull requests and does not appear on every other pull request
  in the repository.

  The policy this is checked against is docs/app-showcase.md. Read it before
  filling this in; it says which apps are listed and what is asked of you.
-->

## What this is

- [ ] A new app
- [ ] An edit to an existing entry
- [ ] A removal

**Entry file:** `registry/showcase/<your-slug>.json`

## Required fields

Every one of these is required by the schema, and `pnpm check:registry` fails
without them.

| Field         | What goes in it                                                             |
| ------------- | --------------------------------------------------------------------------- |
| `id`          | Lowercase kebab-case slug. **Must equal the filename** and becomes your URL |
| `name`        | The app's name, up to 60 characters                                         |
| `platforms`   | One or more of `iphone`, `ipad`, `android-phone`, `android-tablet`          |
| `sdkVersion`  | The Titanium SDK it was built with, such as `12.7.0` or `12.7.0.GA`         |
| `description` | What the app is and who it is for, up to 1000 characters                    |

Optional: `subtitle` (one short line under the name) and the three links below.

## At least one link, so the app can be checked

| Field       | What goes in it                                 |
| ----------- | ----------------------------------------------- |
| `appStore`  | An `apps.apple.com` (or `itunes.apple.com`) URL |
| `playStore` | A `play.google.com` URL                         |
| `website`   | The app's or the developer's own site           |

**One of the three is required.** If the app was built for one organisation and
was never on a public store, `website` alone is the right answer - a lot of
Titanium's best work looks like that, and it belongs here.

Store links are checked against the store's own hostname. That is on purpose:
the page draws a link labelled "App Store", and the label is a promise about
where a tap lands.

## The icon, which is required

Commit it beside your JSON as `registry/showcase/<your-slug>.png` (or `.jpg`, or
`.webp`). Nothing in the JSON refers to it: the filename is what connects it to
your entry.

- **100KB, maximum.** Roughly 256x256 saved as `.webp`. The site has a hard
  deployment size limit and every entry shares it
- **No SVG.** It can carry script and would be served from this site's own
  origin. Export it to `.png`
- Convert rather than rename: the contents are checked against the extension
- **Screenshots are not published.** Not an oversight - `docs/app-showcase.md`
  has the size arithmetic. Your store links carry them already

## Before you open this

- [ ] The file is named `<id>.json` and the `id` inside it is the same string
- [ ] The app has actually shipped, and the link goes somewhere a stranger can
      confirm that
- [ ] **This is your app**, or you own it. Not one you admire - see
      `docs/app-showcase.md`. Opening this pull request is how permission is
      recorded, so it should be opened by someone who can give it
- [ ] You have the right to publish the icon
- [ ] **No email address anywhere**, including inside a URL. The schema rejects
      `mailto:`, `tel:` and anything shaped like an address in any text field
- [ ] The icon is `.png`, `.jpg` or `.webp`, at most 100KB, and named after your
      slug
- [ ] `pnpm check:registry` passes locally, or CI will run it for you

## Anything the reviewer should know

<!--
  Say briefly who you are and what your connection to the app is. Nothing
  formal, just enough that the reviewer is not publishing a name with no history
  behind it.

  Entries are removed on request, unconditionally. If that ever needs to happen,
  open a pull request deleting the JSON and the icon, or ask.
-->
