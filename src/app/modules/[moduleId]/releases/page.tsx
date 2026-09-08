import { Releases } from '@/components/modules/releases';
import { ModuleLayout } from '@/components/modules/shell';
import { moduleBlurb, moduleIds, moduleIndex } from '@/lib/docs/modules';
import { compareVersions } from '@/lib/docs/registry';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/** Every release of one module. */

export const dynamicParams = false;

export function generateStaticParams() {
  return moduleIds().map((moduleId) => ({ moduleId }));
}

export async function generateMetadata({
  params,
}: PageProps<'/modules/[moduleId]/releases'>): Promise<Metadata> {
  const { moduleId } = await params;
  const index = moduleIndex(moduleId);
  if (!index) return {};

  // Sorted by version rather than read off the ends of `index.versions`, which
  // is newest first by publish *date*. The two orders disagree for five of the
  // sixteen modules, because a module's platforms ship independently: ti.map's
  // most recent release is android 5.7.0 while its highest version is iOS
  // 7.3.1, so the ends of that array describe a range that excludes releases
  // the page itself lists.
  const byVersion = index.versions.map((entry) => entry.version).toSorted(compareVersions);
  const newest = byVersion[0];
  const oldest = byVersion[byVersion.length - 1];
  const count = byVersion.length;

  return {
    title: `${index.moduleId} releases - Titanium modules`,
    description: [
      moduleBlurb(index),
      count > 1
        ? `All ${count} published releases, ${oldest} to ${newest}, with the archives to download.`
        : `Its ${count === 1 ? `one published release, ${newest},` : 'published releases,'} with the archives to download.`,
    ]
      .filter((part) => !!part)
      .join(' '),
    alternates: { canonical: `${SITE_URL}/modules/${index.moduleId}/releases` },
  };
}

export default async function ModuleReleasesPage({
  params,
}: PageProps<'/modules/[moduleId]/releases'>) {
  const { moduleId } = await params;

  const index = moduleIndex(moduleId);
  if (!index) notFound();

  return (
    <ModuleLayout index={index} active="releases">
      <Releases index={index} className="mt-8" />
    </ModuleLayout>
  );
}
