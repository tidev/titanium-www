import { OG_CONTENT_TYPE, OG_SIZE, sectionCard } from '@/lib/og';

/**
 * The card for the blog index and any post without a cover image.
 *
 * A post that has one sets `openGraph.images` itself, and a page's own images
 * win over a file placed in the segment, so this is the fallback rather than an
 * override.
 */

export const alt = 'The Titanium SDK blog';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return sectionCard('Blog', 'Releases, tutorials, and news from the Titanium community.');
}
