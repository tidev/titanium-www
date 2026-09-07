import { DocsShell } from '@/components/docs/docs-shell';
import { TypeReference } from '@/components/docs/type-reference';
import { VersionIndex } from '@/components/docs/version-index';
import { latestSdkVersion, resolveVersion, sdkType, sdkVersions } from '@/lib/docs/registry';
import { buildTypeView } from '@/lib/docs/type-view';
import { canonicalPath } from '@/lib/docs/versions';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * One segment under `/docs/sdk`, which is either a version or a type (TI-79).
 *
 * `/docs/sdk/13.4.1` is a pinned version index; `/docs/sdk/Titanium.UI.Button`
 * is a type at the latest version, inside the documentation. Next allows one
 * dynamic name per level, so a single route has to tell them apart.
 *
 * `resolveVersion` is the test, and it is an allowlist rather than a pattern:
 * the segment is a version only if a compiled directory of that name exists.
 * Nothing can be both, because no compiled type name looks like a version -
 * checked in `ia.test.ts` rather than assumed, since docgen could emit one.
 *
 * ## Prerendering
 *
 * Only the versions. `generateStaticParams` returns those 20 and
 * `dynamicParams` is on so a type name reaches the second branch, where a
 * miss is `notFound()`. Before this route carried types, absence did that job
 * and `dynamicParams` could stay off.
 */

export const dynamicParams = true;

export function generateStaticParams() {
  return sdkVersions().map((segment) => ({ segment }));
}

export async function generateMetadata({
  params,
}: PageProps<'/docs/sdk/[segment]'>): Promise<Metadata> {
  const { segment } = await params;

  const version = resolveVersion(segment);
  if (version) {
    return {
      title: `Titanium API ${version} - Titanium SDK`,
      description: `Every Titanium SDK type, method, property, and event in ${version}.`,
      alternates: { canonical: `${SITE_URL}${canonicalPath(version)}` },
    };
  }

  const latest = latestSdkVersion();
  const view = latest && buildTypeView((name) => sdkType(latest, name), segment);
  if (!view) return {};
  return {
    title: `${view.type.name} - Titanium SDK`,
    description: view.type.summary?.replace(/<[^>]+>/g, '').slice(0, 160),
    alternates: { canonical: `${SITE_URL}/docs/sdk/${view.type.name}` },
  };
}

export default async function SegmentPage({ params }: PageProps<'/docs/sdk/[segment]'>) {
  const { segment } = await params;

  const version = resolveVersion(segment);
  if (version) {
    return <VersionIndex version={version} linkBase={`/docs/sdk/${version}`} />;
  }

  const latest = latestSdkVersion();
  if (!latest) notFound();

  return (
    <DocsShell active={segment}>
      <TypeReference
        version={latest}
        typeName={segment}
        linkBase="/docs/sdk"
        // Versioned, always: `assets.json` is keyed that way. See TypeReference.
        imageRoot={`/docs/sdk/${latest}`}
      />
    </DocsShell>
  );
}
