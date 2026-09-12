import { supportNav } from '@/lib/nav';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';

/**
 * How to help (TI-76).
 *
 * Ported from tidev.io/contribute, which is where this lived before the split
 * in TI-68 put anything about the software on this site. The copy is that
 * page's, near enough verbatim: it says what the project actually wants and
 * rewriting it would only have made it different, not better.
 *
 * The CLA is the exception. Signing stays on tidev.io, which owns the legal
 * relationship, so this page explains the agreement and sends people there.
 * Two places collecting the same signature is two things to keep correct.
 */

export const metadata: Metadata = {
  title: 'Contribute - Titanium SDK',
  description:
    'Ways to contribute to Titanium: features and native modules, bug fixes, documentation, testing, writing, and donations.',
  alternates: { canonical: `${SITE_URL}/contribute` },
};

/** Where the CLA is read and signed. Not here, on purpose. */
const CLA_URL = 'https://tidev.io/contribute';

/**
 * What each donation route actually is, keyed by the URL in `supportNav`.
 *
 * The links stay in `nav.ts` so this page and the footer cannot drift apart;
 * the prose describing them is page copy and lives here. A link added there
 * without a line here still renders, just without the description, which is
 * the right way round for a footer entry nobody has written about yet.
 */
const DONATE_BLURB: Record<string, string> = {
  'https://github.com/sponsors/tidev/': 'One-off or recurring, billed through your GitHub account.',
  'https://en.liberapay.com/tidev': 'Recurring weekly, monthly or yearly donations.',
};

const WAYS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'New features and native modules',
    body: 'Implement new Android and iOS features, add a new API or integration, improve parity and platform support.',
  },
  {
    title: 'Bug fixes and improvements',
    body: 'Fix issues across the SDK, CLI, and libraries, remove deprecated features, improve CI workflows, and add more tests.',
  },
  {
    title: 'Documentation',
    body: 'Document features and quirks, add code snippets, fix typos and bad grammar, and remove deprecated content.',
  },
  {
    title: 'Tests and testing',
    body: (
      <>
        Help us by building your apps against the latest{' '}
        {/* The original points at downloads.titaniumsdk.com, a subdomain being
            folded into this site by TI-43. Linking the subpath directly rather
            than porting a URL that is on its way to becoming a redirect. */}
        <a href="/downloads/builds" className="text-link hover:underline">
          CI builds
        </a>{' '}
        and reporting any issues.
      </>
    ),
  },
  {
    title: 'Tutorials, blog posts, videos',
    body: 'Share your knowledge with the world, write about a Titanium feature, and compare Titanium to other platforms.',
  },
  /**
   * The two non-code ways in, and the second home for the pitches that used to
   * sit on every directory listing and every showcase entry. Here rather than
   * there because this is the page somebody opens already asking how to take
   * part, where a listing page's reader is usually asking something else.
   */
  {
    title: 'Show what you built',
    body: (
      <>
        Shipped an app with Titanium? Add it to the{' '}
        <a href="/showcase/submit" className="text-link hover:underline">
          app showcase
        </a>
        . Proof that real apps ship is the most persuasive thing this site carries.
      </>
    ),
  },
  {
    title: 'Take on Titanium work',
    body: (
      <>
        Available for hire? Add yourself to the{' '}
        <a href="/directory/submit" className="text-link hover:underline">
          developer directory
        </a>
        , so a company weighing up a rewrite can see that people who maintain Titanium exist.
      </>
    ),
  },
  {
    title: 'Donations',
    body: 'Tax deductible donations pay engineers to fix issues and keep up with the latest Android and iOS releases.',
  },
];

/**
 * Right chevron.
 *
 * The same path the API nav draws, deliberately not shared with it: that one
 * hardcodes `text-text-subtle` and is rotated by a CSS rule keyed on the nav,
 * so a common component would have to be configurable to serve both. Twelve
 * lines of SVG is the cheaper duplicate.
 */
function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-3 shrink-0"
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

export default function ContributePage() {
  return (
    // Gutters, matching /registry. This route has no layout of its own.
    <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Wider than the 3xl a prose page gets, because the six cards below want
          three columns. Paragraphs are pulled back to 3xl individually rather
          than running the full width, which would be past comfortable reading. */}
      <div className="max-w-5xl py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Interested in contributing?</h1>
        <p className="mt-3 max-w-3xl text-text-muted">
          Titanium is maintained by TiDev, a non-profit, and built by the people who use it.
        </p>

        <section aria-labelledby="donate" className="mt-12">
          <h2 id="donate" className="text-xl font-semibold tracking-tight">
            Donate
          </h2>
          <p className="mt-2 max-w-3xl text-text-muted">
            Donations pay for engineer time, which is what keeps Titanium current with each new
            Android and iOS release.
          </p>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {supportNav.map((item) => (
              <li
                key={item.href}
                className="relative flex flex-col rounded-lg border border-border p-5 transition-colors hover:border-border-strong"
              >
                <h3 className="text-base font-semibold tracking-tight">{item.label}</h3>
                {DONATE_BLURB[item.href] && (
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">
                    {DONATE_BLURB[item.href]}
                  </p>
                )}
                {/* The whole card is the target: `after:inset-0` stretches this
                    link over it, the same way the landing page's cards work. */}
                <a
                  href={item.href}
                  className="mt-auto inline-flex items-center gap-1.5 pt-4 text-sm text-link after:absolute after:inset-0 hover:text-link-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Donate
                  <Chevron />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="ways" className="mt-12">
          <h2 id="ways" className="text-xl font-semibold tracking-tight">
            Ways to contribute
          </h2>
          {/* Three across on a wide screen, two on a tablet, stacked on a phone.
              `auto-rows-fr` keeps a row's cards the same height, so the borders
              line up despite the descriptions being different lengths. */}
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:auto-rows-fr lg:grid-cols-3">
            {WAYS.map((way) => (
              <li
                key={way.title}
                className="flex flex-col rounded-lg border border-border p-5 transition-colors hover:border-border-strong"
              >
                <h3 className="text-base font-semibold tracking-tight">{way.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">{way.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="code" className="mt-12">
          <h2 id="code" className="text-xl font-semibold tracking-tight">
            Contributing code
          </h2>
          <p className="mt-2 max-w-3xl text-text-muted">
            Source code contributions are always welcome. Before we can accept your pull request,
            you must sign a Contributor License Agreement (CLA).
          </p>
          <p className="mt-3 max-w-3xl text-text-muted">
            A contributor license agreement is a legally binding document in which you agree that
            all intellectual property ownership rights for any source code, documentation, and other
            contributions will belong to TiDev, Inc.
          </p>
          <p className="mt-3 max-w-3xl text-text-muted">
            A CLA ensures that all code, docs and the rest belong to TiDev, which avoids ownership
            disputes later. Ours is written for an individual and TiDev, Inc. Check that your
            employer allows you to sign it before contributing.
          </p>
          <p className="mt-5">
            <a
              href={CLA_URL}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-border-strong"
            >
              Sign the CLA
              <Chevron />
            </a>
          </p>
        </section>

        {/* Last, beside the CLA, because the two are the same kind of thing: the
            terms of taking part, which a reader wants after they know what
            taking part would mean and not before. The CLA covers the code, this
            covers everyone - it applies to the repositories, the events and the
            chat alike, so it is not scoped to the section above. */}
        <section aria-labelledby="conduct" className="mt-12">
          <h2 id="conduct" className="text-xl font-semibold tracking-tight">
            Code of Conduct
          </h2>
          <p className="mt-2 max-w-3xl text-text-muted">
            Everyone taking part in the Titanium community agrees to the Code of Conduct, whether
            they are contributing to a repository, at a TiDev event, or talking in the community
            chat. It is short, and it is worth reading before you start.
          </p>
          <p className="mt-5">
            <a
              href="/code-of-conduct"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-border-strong"
            >
              Read the Code of Conduct
              <Chevron />
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
