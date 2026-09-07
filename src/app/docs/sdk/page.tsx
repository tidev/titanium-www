import { DocsShell } from '@/components/docs/docs-shell';
import { VersionIndex } from '@/components/docs/version-index';
import { latestSdkVersion } from '@/lib/docs/registry';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * The API reference at the latest release, inside the documentation (TI-79).
 *
 * This is the canonical address. `/docs/sdk/latest` redirects here and
 * `/docs/sdk/<version>` is the pinned copy, which points its canonical at this
 * page while it is the latest.
 *
 * Prerendered - one page, against the type pages' 284 per version, which is why
 * they are not. See the type route for those numbers.
 */

export const metadata: Metadata = {
  title: 'Titanium API - Titanium SDK',
  description: 'Every Titanium SDK type, method, property, and event.',
  alternates: { canonical: `${SITE_URL}/docs/sdk` },
};

export default function ApiIndexPage() {
  const latest = latestSdkVersion();
  if (!latest) notFound();

  return (
    <DocsShell active="">
      <VersionIndex version={latest} linkBase="/docs/sdk" />
    </DocsShell>
  );
}
