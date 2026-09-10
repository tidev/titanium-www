import { Browse } from '@/components/showcase/browse';
import { orderedApps } from '@/lib/showcase/read';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';

/**
 * Apps that shipped, built with Titanium (TI-54).
 *
 * The answer to the question a seventeen-year-old framework gets asked before
 * any other, and the one thing on this site that answers it without asking to
 * be believed: a reader can open these on their own phone.
 *
 * Read from `registry/showcase/` on disk, so there is no network at build time
 * and no database anywhere.
 *
 * ## Why this page changes without anyone committing anything
 *
 * Only the order. Nothing here expires - see `lib/registry/showcase.ts` for why
 * an app that shipped does not go stale the way an availability listing does -
 * but the display rota advances once a day, so no entry keeps the top of the
 * grid. The nightly rebuild that exists for the directory's expiry turns this
 * one too. See `fairOrder`.
 */

export const metadata: Metadata = {
  title: 'App showcase - Titanium SDK',
  description:
    'Real apps shipped with Titanium SDK: what they are, which platforms they run on, and where to see them in the App Store and on Google Play.',
  alternates: { canonical: `${SITE_URL}/showcase` },
};

export default function ShowcaseIndex() {
  const apps = orderedApps();

  return (
    <div className="max-w-6xl py-10">
      <h1 className="text-3xl font-semibold tracking-tight">App showcase</h1>
      <p className="mt-3 max-w-2xl text-text-muted">
        Apps built with Titanium and shipped to real users.
      </p>
      <p className="mt-3 text-sm text-text-subtle">
        Shipped an app with Titanium?{' '}
        <a
          href="/showcase/submit"
          className="text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Add it to the showcase
        </a>
        .
      </p>

      <Browse apps={apps} />
    </div>
  );
}
