import { Browse } from '@/components/directory/browse';
import { orderedProfiles } from '@/lib/directory/read';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';

/**
 * People and companies available for paid Titanium work (TI-58).
 *
 * Two audiences, one page. A developer looking for work, and a company holding
 * a Titanium codebase looking for someone who can maintain it. The second is
 * the one that matters to the project: "can we still hire for this" is a real
 * question about a framework in its seventeenth year, and a directory is the
 * only honest way to answer it.
 *
 * Read from `registry/directory/` on disk, so there is no network at build time
 * and no database anywhere.
 *
 * ## Why this page changes without anyone committing anything
 *
 * Listings expire, and a static build has no sense of time passing: a listing
 * that expires tomorrow keeps rendering until something rebuilds. So something
 * rebuilds, daily - see `.github/workflows/daily-rebuild.yml`. Expiry is then
 * filtered here, at build time, at day granularity, which is plenty for a three
 * month window and keeps every page static.
 *
 * The two alternatives were both worse. Filtering in a dynamic route is always
 * exact and gives up static generation for the whole page. Filtering in the
 * browser leaves expired listings in the HTML that crawlers read, so they stay
 * indexed after they stop being shown, which is the one outcome that would
 * embarrass a listee.
 *
 * That same daily rebuild turns the ordering rota. See `fairOrder`.
 */

export const metadata: Metadata = {
  title: 'Developer directory - Titanium SDK',
  description:
    'Independent developers, contractors and agencies available for Titanium work: building apps, maintaining an existing codebase, native modules, and SDK upgrades.',
  alternates: { canonical: `${SITE_URL}/directory` },
};

export default function DirectoryIndex() {
  const profiles = orderedProfiles();

  return (
    <div className="max-w-5xl py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Developer directory</h1>
      <p className="mt-3 max-w-2xl text-text-muted">
        Developers and companies available for Titanium work. Whether you need an app built, a
        native module written, or an existing Titanium codebase kept running, these are the people
        who do it.
      </p>
      {/* One line, above the results rather than below them. The person this
          is addressed to arrived intending to list themselves and should not
          have to read the whole directory first; everybody else reads six
          words and moves on. The prose it used to carry is at
          `/directory/submit`. */}
      <p className="mt-3 text-sm text-text-subtle">
        Available for Titanium work?{' '}
        <a
          href="/directory/submit"
          className="text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Get listed
        </a>
        .
      </p>

      <Browse profiles={profiles} />
    </div>
  );
}
