import { Releases } from '@/components/modules/releases';
import { ModuleLayout } from '@/components/modules/shell';
import { moduleBlurb, moduleIds, moduleIndex } from '@/lib/docs/modules';
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

  // Newest first, per the registry schema.
  const newest = index.versions[0]?.version;
  const oldest = index.versions[index.versions.length - 1]?.version;
  const count = index.versions.length;

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
