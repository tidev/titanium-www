import { sitemapEntries } from '@/lib/sitemap';
import type { MetadataRoute } from 'next';

/**
 * `sitemap.xml`.
 *
 * The rules and the reasoning are in `lib/sitemap`, which is where they can be
 * tested: what belongs in a sitemap is a decision about canonicals and robots
 * verdicts, not about this file convention.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries();
}
