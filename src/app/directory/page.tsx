import { Browse } from '@/components/directory/browse';
import { HowToList } from '@/components/directory/submit';
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
  const agencies = profiles.filter((p) => p.kind === 'agency').length;
  const individuals = profiles.length - agencies;
  const examples = profiles.some((p) => p.placeholder);

  // The renewal claim below is only true of listings that actually renew, and
  // `neverExpires` is an opt-out from exactly that. Every listing page is
  // careful to say so on the exempt ones; the index would otherwise make the
  // opposite claim about the same listing on the page before it.
  const allRenewed = profiles.every((p) => !p.neverExpires);

  return (
    <div className="max-w-5xl py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Developer directory</h1>
      <p className="mt-3 max-w-2xl text-text-muted">
        Developers and companies available for Titanium work, listed at their own request. Whether
        you need an app built, a native module written, or an existing Titanium codebase kept
        running, these are the people who do it.
      </p>
      <p className="mt-3 max-w-2xl text-sm text-text-subtle">
        {examples ? (
          <>
            Nobody is listed yet. The entries below are worked examples, marked as such, and they
            will disappear as soon as the first real listing lands.
          </>
        ) : (
          <>
            {individuals} individual{individuals === 1 ? '' : 's'} and {agencies} agenc
            {agencies === 1 ? 'y' : 'ies'}
            {allRenewed
              ? ', each of whom confirmed within the last three months that they are available'
              : '. Most confirmed within the last three months that they are available; the few exempt from renewal say so on their own page'}
            . Listings are shown in a rotating order that changes daily, so no name, and no amount
            of renaming, buys a place at the top.
          </>
        )}
      </p>
      <p className="mt-3 max-w-2xl text-sm text-text-subtle">
        A listing is not a recommendation. TiDev checks that an entry is a real person or company
        offering real Titanium work, and nothing further. Take the usual care you would with anyone
        you have not worked with.
      </p>

      <Browse profiles={profiles} />

      <HowToList className="mt-12" />
    </div>
  );
}
