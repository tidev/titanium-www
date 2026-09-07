import { TypeReference } from '@/components/docs/type-reference';
import { resolveVersion, sdkType } from '@/lib/docs/registry';
import { buildTypeView } from '@/lib/docs/type-view';
import { canonicalPath } from '@/lib/docs/versions';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * One compiled type at a pinned version.
 *
 * The rendering is `TypeReference`, shared with the unversioned copy at
 * `/docs/sdk/<type>` (TI-79). This route is the version-pinned address, so both
 * of its bases are versioned and it browses the API on its own, under `ApiNav`.
 *
 * ## Rendered on first request, not at build time
 *
 * TI-25 prerendered these and said to record the numbers before reaching for
 * runtime rendering. Here they are. One SDK version is 190MB of HTML and RSC
 * payload across 284 pages; twenty versions are 3.8GB. Vercel caps a
 * deployment's static files at 100MB, so even a single version overshoots by
 * 90MB - this was never a question of how many releases to keep.
 *
 * Page weight is not the cause and trimming it is not the fix: brotli takes the
 * largest page from 1053KB to 71KB, because what makes the file big is 152
 * distinct class strings repeated 4,116 times. Nothing is served more slowly
 * for this change. What moves is when the file is written.
 *
 * `generateStaticParams` returns nothing, so a page is rendered the first time
 * someone asks for it and then cached indefinitely - `revalidate = false`,
 * which is honest rather than lazy. A published version is frozen, so there is
 * nothing for a revalidation window to catch, and even `main` - the one tree
 * that does move - is safe: the cache is per-deployment, and `main` only
 * changes when a recompile is deployed.
 *
 * `dynamicParams` is therefore on, which makes `notFound()` below the thing
 * that rejects an unknown version or type. Before, the absence of a prerendered
 * file did that.
 */

export const dynamicParams = true;
export const revalidate = false;

/**
 * Empty deliberately.
 *
 * An empty list is what puts this route on the incremental path instead of
 * making it fully dynamic; returning a subset would prerender that subset, and
 * the whole point is that no amount of it fits.
 */
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: PageProps<'/docs/sdk/[segment]/[type]'>): Promise<Metadata> {
  const { segment, type } = await params;
  const resolved = resolveVersion(segment);
  const view = resolved && buildTypeView((name) => sdkType(resolved, name), type);
  if (!view) return {};

  return {
    title: `${view.type.name} - Titanium SDK`,
    description: view.type.summary?.replace(/<[^>]+>/g, '').slice(0, 160),
    // Built from the resolved name rather than the raw segment, so an alias or
    // a casing variant that still resolves cannot claim a canonical of its own.
    // For the latest release this points at the unversioned page: the two are
    // the same content and only one of them should compete in search.
    alternates: { canonical: `${SITE_URL}${canonicalPath(resolved, view.type.name)}` },
  };
}

export default async function PinnedTypePage({ params }: PageProps<'/docs/sdk/[segment]/[type]'>) {
  const { segment, type } = await params;
  const resolved = resolveVersion(segment);
  if (!resolved) notFound();

  const base = `/docs/sdk/${resolved}`;
  return <TypeReference version={resolved} typeName={type} linkBase={base} imageRoot={base} />;
}
