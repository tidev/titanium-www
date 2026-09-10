import { Terminal } from '@/components/ui/terminal';
import { formatDate } from '@/lib/docs/format';
import { communityListings, moduleSummaries } from '@/lib/docs/modules';
import { hasReleaseNote } from '@/lib/docs/release-notes';
import { latestCli } from '@/lib/downloads/cli';
import { latestRelease } from '@/lib/downloads/registry';
import { communityNav } from '@/lib/nav';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * The title and description are the root layout's, which are written for this
 * page in the first place. Only the canonical is new: without one, the home
 * page is the single address on the site that does not name itself, and it is
 * the one most likely to be linked with a tracking parameter stuck on the end.
 */
export const metadata: Metadata = {
  alternates: { canonical: `${SITE_URL}/` },
};

/**
 * Deliberately not the centred logo-tagline-two-buttons stack that React,
 * React Native and Cordova all run. Asymmetric, with real code holding the
 * right side - three rounds of mockups established that the composition is
 * what made those sites interchangeable, far more than the palette was.
 *
 * No images anywhere on this page, which is also why it has no layout shift to
 * manage: the only things that could reflow are the code samples, and all of
 * them are text at a fixed size.
 */

/**
 * Where this release is written up on this site.
 *
 * The release notes now have pages of their own (TI-72), so this points at the
 * one for this version. It used to match a blog post by looking for the release
 * name inside the post title, which worked but rested on a coincidence of
 * wording - a retitled announcement would have quietly sent the landing page to
 * the release list instead.
 *
 * The announcement post is still the better read where one exists, but it is
 * not the record; the release note is, and it exists for every recent release
 * where a post may not.
 */
function releaseNotesHref(version: string | undefined): string {
  if (version && hasReleaseNote(version)) return `/docs/sdk/${version}/release-notes`;
  return '/downloads/releases';
}

/**
 * Every number on this page comes from the registry on disk, never a literal.
 *
 * Two products ship under the Titanium name and both are versioned, so both are
 * named. They are on different numbers - SDK 13.4.1 and CLI 9.1.0 - and the
 * install commands above ask for each separately, so a bare "Latest release:
 * 13.4.1" left the reader to guess which of the two it was talking about.
 *
 * The CLI's notes are its GitHub release, which is where they are written. The
 * SDK's are a page on this site, because its GitHub release bodies are empty -
 * see `docs/release-notes.md`.
 */
function facts() {
  const release = latestRelease();
  return {
    version: release?.version,
    released: release?.date,
    notes: releaseNotesHref(release?.version),
    cli: latestCli(),
    registryModules: moduleSummaries().length,
    communityModules: communityListings().length,
  };
}

/**
 * One "Titanium X 1.2.3, released <date>" line.
 *
 * The date is a `<time>` inside the sentence rather than a second line under
 * it: with two releases listed, four stacked lines read as a table that is not
 * one, and the released-on date is a footnote to the version rather than a
 * fact of its own.
 */
function LatestLine({
  product,
  version,
  date,
  href,
  external,
}: {
  product: string;
  version: string;
  date?: string;
  href: string;
  external?: boolean;
}) {
  const link =
    'font-medium text-link hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
  const label = `${product} ${version}`;

  return (
    <p className="text-sm text-text-muted">
      {external ? (
        <a href={href} target="_blank" rel="noreferrer" className={link}>
          {label}
        </a>
      ) : (
        <Link href={href} className={link}>
          {label}
        </Link>
      )}
      {date && (
        <>
          {', released '}
          <time dateTime={date.slice(0, 10)}>{formatDate(date.slice(0, 10))}</time>
        </>
      )}
    </p>
  );
}

/**
 * `h-full` and the flex column: in the Alloy row the two boxes share a grid row
 * and would otherwise end at different heights, the shorter one leaving a
 * ragged gap under it. Elsewhere the parent is auto-height, so it is inert.
 */
function Chrome({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="size-2 rounded-full bg-border-strong" />
        <span className="font-mono text-xs text-text-subtle">{name}</span>
      </div>
      {/* Focusable because it scrolls: without a tab stop there is no keyboard
          route to the end of a line wider than the box (WCAG 2.1.1). Same
          reasoning as `Terminal` and as the prose blocks in markdown.ts.

          The ring is drawn *inside* the block, unlike everywhere else on the
          site. The wrapper above is `overflow-hidden` for its rounded corners
          and has no padding, so the `<pre>` fills it exactly and a ring offset
          outwards is clipped away on three sides: the stop would have no
          visible indicator at all, which is WCAG 2.4.7. */}
      <pre
        tabIndex={0}
        className="flex-1 overflow-x-auto p-4 font-mono text-sm leading-relaxed focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <code>{children}</code>
      </pre>
    </div>
  );
}

const K = ({ children }: { children: React.ReactNode }) => (
  <span className="text-link">{children}</span>
);
const S = ({ children }: { children: React.ReactNode }) => (
  <span className="text-success">{children}</span>
);
const C = ({ children }: { children: React.ReactNode }) => (
  <span className="text-text-subtle">{children}</span>
);

/**
 * A window with a button that responds - the smallest thing that is still a
 * real app rather than a syntax demo. `Ti.UI.createWindow` returns an Android
 * Activity or a UIWindow, which is the whole point and is worth showing rather
 * than asserting.
 *
 * The object literals are broken across lines to keep the sample inside its
 * column. Written inline the widest line was 63 characters, which overflowed
 * the hero at 1024px and put a scrollbar under it; split, the widest is the
 * 40-character `addEventListener` line. It is also how anyone would actually
 * write it, so nothing is distorted to fit.
 */
function HeroSample() {
  return (
    <Chrome name="app.js">
      <C>{'// one codebase, two native apps\n'}</C>
      <K>const</K>
      {' win = '}
      <K>Ti</K>
      {'.UI.createWindow({\n  backgroundColor: '}
      <S>{"'#15191c'"}</S>
      {'\n});\n\n'}
      <K>const</K>
      {' button = '}
      <K>Ti</K>
      {'.UI.createButton({\n  title: '}
      <S>{"'Say hello'"}</S>
      {'\n});\n\n'}
      {'button.addEventListener('}
      <S>{"'click'"}</S>
      {', () => {\n  '}
      <K>alert</K>
      {'('}
      <S>{"'Hello from a native button'"}</S>
      {');\n});\n\n'}
      {'win.add(button);\n'}
      {'win.open();'}
    </Chrome>
  );
}

/**
 * Alloy, shown as what it actually is: markup, style and controller split up,
 * one file per box so the split is visible rather than described. The view
 * sits on top at full width; the controller and stylesheet share a row under
 * it, since both are narrow and neither is more than a few lines.
 *
 * The row folds back into the column below `sm` and again at `lg` only. At
 * `lg` this section first goes two-column, which leaves the sample track at
 * about 437px and each half-box with room for roughly 21 characters, fewer
 * than the 28 the `backgroundColor` line needs. From `xl` the track is wide
 * enough again. Measured from screenshots at 1024 and 1280, not estimated.
 */
function AlloySample() {
  return (
    <div className="flex flex-col gap-4">
      <Chrome name="index.xml">
        {'<'}
        <K>Alloy</K>
        {'>\n  <'}
        <K>Window</K>
        {'>\n    <'}
        <K>Button</K>
        {' onClick='}
        <S>{'"greet"'}</S>
        {'>Say hello</'}
        <K>Button</K>
        {'>\n  </'}
        <K>Window</K>
        {'>\n</'}
        <K>Alloy</K>
        {'>'}
      </Chrome>
      {/* `min-w-0` on both cells for the same reason as the grid items in
          `Home`: a `<pre>` that cannot shrink widens its track instead of
          scrolling inside it. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <div className="min-w-0">
          <Chrome name="index.js">
            <K>function</K>
            {' greet() {\n  '}
            <K>alert</K>
            {'('}
            <S>{"'Hello from Alloy'"}</S>
            {');\n}\n\n'}
            {'$.index.open();'}
          </Chrome>
        </div>
        <div className="min-w-0">
          <Chrome name="index.tss">
            <S>{'"Window"'}</S>
            {': {\n  backgroundColor: '}
            <S>{"'#15191c'"}</S>
            {'\n},\n'}
            <S>{'"Button"'}</S>
            {': {\n  color: '}
            <S>{"'#ffffff'"}</S>
            {'\n}'}
          </Chrome>
        </div>
      </div>
    </div>
  );
}

function Pillar({
  title,
  children,
  href,
  cta,
}: {
  title: string;
  children: React.ReactNode;
  href: string;
  cta: string;
}) {
  return (
    <div className="relative flex flex-col rounded-lg border border-border p-5 transition-colors hover:border-border-strong">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-text-muted">{children}</p>
      <Link
        href={href}
        className="mt-auto pt-4 text-sm text-link after:absolute after:inset-0 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {cta} <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

export default function Home() {
  const { version, released, notes, cli, registryModules, communityModules } = facts();

  return (
    <div className="w-full">
      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:px-8 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-16 lg:py-24">
        {/* `min-w-0`: a grid item defaults to `min-width: auto`, so the code
            block's long lines widen the track instead of scrolling inside it,
            and the whole page picks up a horizontal scrollbar at 320px. */}
        <div className="min-w-0">
          <h1 className="text-4xl font-semibold leading-tight tracking-tighter text-balance sm:text-5xl">
            Native iOS and Android apps,
            <span className="text-text-muted"> written in JavaScript</span>
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-normal text-text-muted">
            Titanium runs your JavaScript and TypeScript against real platform APIs, so a
            <code className="mx-1 font-mono text-base text-text">Button</code>
            is a real button. Not a web view, not a bridge to one.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {/* The CTA is install rather than a guide because there is no
                getting-started guide yet - the prose rewrites are TI-32 and
                after. Pointing "Get started" at the API reference would send a
                newcomer somewhere that answers a different question. */}
            <Link
              href="/downloads"
              className="rounded-md bg-link px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Install Titanium
            </Link>
            <Link
              href="/docs/sdk"
              className="rounded-md border border-border-strong px-5 py-2.5 text-sm font-medium transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              API reference
            </Link>
          </div>

          {/* Under the buttons rather than above the headline: it is a footnote
              to "install this", not the first thing to read. */}
          {(version || cli) && (
            <div className="mt-8 flex flex-col gap-1">
              {version && (
                <LatestLine product="Titanium SDK" version={version} date={released} href={notes} />
              )}
              {cli && (
                <LatestLine
                  product="Titanium CLI"
                  version={cli.version}
                  date={cli.date}
                  href={cli.url}
                  external
                />
              )}
            </div>
          )}
        </div>

        <div className="min-w-0 lg:pl-4">
          <HeroSample />
        </div>
      </section>

      {/* `border-b` as well as `border-t`: this band is tinted and the section
          after it is not, so without a closing rule the shading just stops.
          The community band needs none - the footer's own border closes it. */}
      <section
        aria-labelledby="what"
        className="border-y border-border bg-surface/40 py-14 sm:py-16"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="what" className="sr-only">
            What Titanium is
          </h2>
          <dl className="grid gap-8 sm:grid-cols-3">
            <div>
              <dt className="text-base font-semibold tracking-tight">Real native UI</dt>
              <dd className="mt-2 text-sm leading-relaxed text-text-muted">
                Every component maps to the platform&rsquo;s own widget. A window is an Activity on
                Android and a UIWindow on iOS, with the scrolling, accessibility and text input that
                come with them.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold tracking-tight">JavaScript and TypeScript</dt>
              <dd className="mt-2 text-sm leading-relaxed text-text-muted">
                Write the language you already know, against{' '}
                <Link href="/docs/sdk" className="text-link hover:text-link-hover">
                  a documented API
                </Link>{' '}
                for both platforms. Type definitions ship with the SDK.
              </dd>
            </div>
            <div>
              <dt className="text-base font-semibold tracking-tight">
                Open source, community owned
              </dt>
              <dd className="mt-2 text-sm leading-relaxed text-text-muted">
                Apache-2.0, governed by TiDev, a non-profit. Fifteen years old and still shipping -
                the SDK is developed in the open by the people who use it.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section
        aria-labelledby="alloy"
        className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:px-8 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-16 lg:py-20"
      >
        <div className="min-w-0 lg:order-2">
          <h2 id="alloy" className="text-2xl font-semibold tracking-tight text-balance">
            Alloy gives your app a structure
          </h2>
          <p className="mt-4 text-base leading-relaxed text-text-muted">
            Alloy is Titanium&rsquo;s MVC framework. Views are XML, styles are a stylesheet, and
            controllers are plain JavaScript - the same split you would reach for anyway, with data
            binding and a build step that compiles it all down to the SDK calls above.
          </p>
          <Link
            href="/docs/sdk"
            className="mt-6 inline-block text-sm text-link hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Alloy documentation <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="min-w-0 lg:order-1">
          <AlloySample />
        </div>
      </section>

      {/* The band has its own roles rather than borrowing `surface`: in light
          mode it lands near it, but in dark it is deliberately darker than a
          normal surface so the window inside it still reads as cut into the
          page. They follow the theme; only the window group stays dark. */}
      <section
        aria-labelledby="install"
        className="border-t border-border bg-terminal-bg py-16 text-terminal-text sm:py-20"
      >
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:px-8 lg:grid-cols-[1fr_1.05fr] lg:items-start lg:gap-16">
          <div className="min-w-0">
            <h2 id="install" className="text-2xl font-semibold tracking-tight text-balance">
              Try it
            </h2>
            <p className="mt-4 text-base leading-relaxed text-terminal-text-muted">
              Install the CLI and Alloy from npm, add the SDK, then scaffold a project and build it.
              What comes out runs on both platforms without anything else added to it.
            </p>
            <p className="mt-4 text-sm text-terminal-text-subtle">
              Requires Node.js 22.19.0 or newer.
            </p>
          </div>

          <div className="min-w-0">
            <Terminal
              commands={[
                'npm install --global titanium alloy',
                'ti sdk install',
                'ti create',
                'cd <project-dir>',
                'ti build',
              ]}
            />
          </div>
        </div>
      </section>

      <section aria-labelledby="explore" className="border-t border-border py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id="explore" className="text-2xl font-semibold tracking-tight">
            Where to go next
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:auto-rows-fr lg:grid-cols-4">
            <Pillar title="API reference" href="/docs/sdk" cta="Browse the API">
              Every namespace, method, property and event in the SDK, generated from the source it
              documents.
            </Pillar>
            <Pillar title="Downloads" href="/downloads" cta="All releases">
              Every GA, RC and beta, plus continuous builds from each active branch.
            </Pillar>
            <Pillar title="Modules" href="/modules" cta="Browse modules">
              {registryModules} maintained modules with full reference docs, alongside{' '}
              {communityModules} more from the community.
            </Pillar>
            <Pillar title="Blog" href="/blog" cta="Read the blog">
              Release announcements and project news, with an RSS feed.
            </Pillar>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="community"
        className="border-t border-border bg-surface/40 py-14 sm:py-16"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 id="community" className="text-2xl font-semibold tracking-tight">
              Built by the people who use it
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-relaxed text-text-muted">
              Titanium is maintained by TiDev, a non-profit, with contributions from the community.
              Everything happens in the open.
            </p>
          </div>
          <ul className="flex flex-wrap gap-3">
            {communityNav.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="inline-block rounded-md border border-border px-4 py-2 text-sm transition-colors hover:border-border-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li>
              <a
                href="https://tidev.io"
                className="inline-block rounded-md border border-border px-4 py-2 text-sm transition-colors hover:border-border-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                TiDev
              </a>
            </li>
          </ul>
        </div>
      </section>
    </div>
  );
}
