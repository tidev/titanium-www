import { OG_CONTENT_TYPE, OG_SIZE, sectionCard } from '@/lib/og';

/**
 * The card for every page under `/docs`, guides and API reference alike.
 *
 * One card for the section rather than one per page. A per-page card would have
 * to be rendered for 5,680 type pages that are themselves rendered on demand,
 * and "Titanium.UI.Button" set in 84px tells a reader nothing the link preview's
 * own title does not already say.
 */

export const alt = 'Titanium SDK documentation';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return sectionCard('Documentation', 'Guides and the complete Titanium API reference.');
}
