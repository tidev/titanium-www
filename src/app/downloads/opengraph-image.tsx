import { OG_CONTENT_TYPE, OG_SIZE, sectionCard } from '@/lib/og';

/**
 * The card for the downloads views.
 *
 * Names no version. The card is cached by whoever renders the preview, and a
 * release number baked into an image is wrong within weeks with nothing on our
 * side able to correct it.
 */

export const alt = 'Titanium SDK downloads';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return sectionCard('Downloads', 'Every SDK release, plus the CI builds from each active branch.');
}
