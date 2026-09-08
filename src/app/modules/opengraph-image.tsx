import { OG_CONTENT_TYPE, OG_SIZE, sectionCard } from '@/lib/og';

/** The card for the module browser and every module page below it. */

export const alt = 'Titanium modules';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return sectionCard('Modules', 'Native functionality for iOS and Android, packaged per platform.');
}
