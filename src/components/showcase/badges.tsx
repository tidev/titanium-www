import { PLATFORM_LABELS, PLATFORM_ORDER, type App } from '@/lib/showcase/app';

/**
 * The small pieces a showcase card and a showcase page share.
 *
 * No `use client` and no state: these are imported by the browse grid, which is
 * a client component, and by the app page, which is not. Everything here
 * imports from `lib/showcase/app.ts` only, which is the half of the library
 * with no filesystem in it.
 */

/**
 * An app icon.
 *
 * A plain `img` rather than `next/image`, on the same reasoning as the
 * directory's `Picture`: the box is a fixed size in CSS so there is no layout
 * shift to prevent, and the file is already capped at 100KB and served from
 * this origin, so there is little left to optimise.
 *
 * `alt=""` because the name is right beside it, every time - this is never
 * rendered alone. Describing it as well would have a screen reader announce
 * "Acme Field Tools, Acme Field Tools icon".
 *
 * Rounded rather than square, because that is what an app icon looks like on
 * both platforms it came from and a square one reads as a logo instead.
 */
export function Icon({ app, size }: { app: App; size: 48 | 80 }) {
  // Tailwind matches whole class names in the source, so these cannot be built
  // by interpolation - the utility would never be generated.
  const box = size === 80 ? 'size-20 rounded-2xl' : 'size-12 rounded-xl';

  return (
    <img
      src={app.icon}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={`${box} shrink-0 border border-border object-cover`}
    />
  );
}

/**
 * Marks a worked example.
 *
 * Loud on purpose. These are not apps, and a reader who mistakes one for a real
 * entry goes looking for it in a store. They are shown only while the showcase
 * holds no real entry at all.
 */
export function PlaceholderBadge() {
  return (
    <span
      title="A worked example, not a real app. Shown only while the showcase is empty"
      className="rounded border border-warning px-1.5 py-0.5 font-mono text-xs text-warning"
    >
      example
    </span>
  );
}

/**
 * What the app was built for, in the vocabulary's own order rather than the
 * order it was written in, so two entries claiming the same reach read the same
 * way.
 */
export function PlatformChips({ app }: { app: App }) {
  const ordered = PLATFORM_ORDER.filter((p) => app.platforms.includes(p));
  return (
    <ul className="flex flex-wrap gap-1.5">
      {ordered.map((p) => (
        <li
          key={p}
          className="rounded-full border border-border px-2 py-0.5 text-xs text-text-muted"
        >
          {PLATFORM_LABELS[p]}
        </li>
      ))}
    </ul>
  );
}

/**
 * The version, said in full, for a card that has no room for a heading.
 *
 * One phrase in one typeface, deliberately. The version had been a mono badge,
 * which set it apart from the words that give it its meaning - and "Built with
 * Titanium" and the number it refers to are a single sentence, not a label and
 * a value. Read as one, it also stops being mistakable for the app's own
 * release number, which is what a bare `12.7.0.GA` on a card looks like.
 *
 * "Titanium" rather than "Titanium SDK": on this site the SDK is what Titanium
 * means, and the extra word buys nothing on a line competing for a card's
 * width.
 *
 * Right-aligned and quiet, because it is the least important thing on the card.
 * It is a fact about the build at the time the entry was written rather than a
 * claim about what is in the store today; the card cannot afford to say that,
 * so the app page does, under the same number.
 */
export function BuiltWith({ app }: { app: App }) {
  return (
    /* `leading-none` so the card's bottom gap matches its right one. The type
       scale pairs every size with a line-height, and at `text-2xs` that leaves
       a couple of pixels of half-leading under the text - which the card's
       `p-4` then sits on top of, so the space below reads as larger than the
       space beside it even though both paddings are 16px. Leading is there to
       separate wrapped lines, and this label is one line at every card width,
       so dropping it costs nothing and makes the box end where the text does. */
    <p className="text-right text-2xs leading-none text-text-subtle">
      Built with Titanium {app.sdkVersion}
    </p>
  );
}
