import { activeCategories, pageCount, publishedPosts } from '@/lib/blog/posts';
import { currentGuideUrls } from '@/lib/docs/doc-versions';
import { SITE_URL } from '@/lib/site';
import type { MetadataRoute } from 'next';

/**
 * The sitemap, covering what exists today.
 *
 * Still partial: the module tree and the API reference are large and the
 * canonical-versus-pinned story for the reference is TI-48's to settle, and
 * listing a URL we may redirect next week is worse than not listing it. Blog
 * posts have settled URLs, so they are here in full.
 *
 * ## The guides, and only the current major
 *
 * Guide URLs settled with TI-59: the current major is unversioned and is the
 * canonical spelling of every page it has, so it is listed. Archived majors are
 * not. A sitemap is a request to crawl, and asking for three near-identical
 * copies of the macOS setup page is asking to have the wrong one ranked; the
 * archived pages instead canonicalise to their equivalent in current, or go
 * `noindex, follow` where current has no equivalent. They stay reachable and
 * crawlable through the switcher and the banner, which is how a reader who
 * needs them gets there. See `archivedSeo` in `lib/docs/doc-versions.ts`.
 *
 * Drafts are excluded, which is the third of the three places TI-53 requires -
 * the index and the feed being the others.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = publishedPosts();
  const newest = posts[0]?.date;

  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/downloads`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/modules`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/contribute`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/registry`, changeFrequency: 'monthly', priority: 0.3 },
    // The one line TI-48 has to merge with. Everything about which guide URLs
    // are listed is decided in `currentGuideUrls`.
    ...currentGuideUrls().map((path) => ({
      url: `${SITE_URL}${path}`,
      changeFrequency: 'monthly' as const,
      priority: path === '/docs' ? 0.8 : 0.6,
    })),
    {
      url: `${SITE_URL}/blog`,
      ...(newest ? { lastModified: newest } : {}),
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    // Page one is /blog, so pagination starts at two.
    ...Array.from({ length: Math.max(0, pageCount() - 1) }, (_, i) => ({
      url: `${SITE_URL}/blog/page/${i + 2}`,
      changeFrequency: 'weekly' as const,
      priority: 0.3,
    })),
    ...activeCategories().map(({ category }) => ({
      url: `${SITE_URL}/blog/category/${category.toLowerCase()}`,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
    ...posts.map((post) => ({
      url: `${SITE_URL}/blog/${post.slug}`,
      lastModified: post.date,
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    })),
  ];
}
