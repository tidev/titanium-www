import { formatDate } from '@/lib/docs/format';
import { PLATFORM_LABELS, type PlatformLatest } from '@/lib/docs/module-summary';
import type { ModuleSource } from '@/lib/registry';

/**
 * What backs a module, which is not the same as who owns it.
 *
 * The badge said "TiDev" and was read as a statement about the owner. It never
 * was: `tidev` means the module is curated here, with verified releases and a
 * compiled reference, and the giveaway is tidev/ti.worker - a TiDev repository
 * that nothing on this site documents. Naming the status rather than the org is
 * what makes the three readable together.
 *
 * ## The colours are a scale, not three categories
 *
 * Official is `link`, the same blue as every link on the site, because it is
 * the one tier that leads somewhere here - a compiled API reference. Verified
 * is `success`, which is the strongest thing that can be said about a module
 * nothing here hosts. Unverified is `text-subtle`, deliberately the quietest
 * thing on the card.
 *
 * It used to warn in amber, which was wrong twice over: it read as a defect
 * report on 63 modules nobody has examined, and amber against green made the
 * two look like a pass and a fail rather than two points on a scale. Not
 * reviewed is an absence of information, and it should look like one.
 */
const SOURCE_STYLE: Record<ModuleSource, { label: string; className: string; title: string }> = {
  tidev: {
    label: 'Official',
    className: 'border-link text-link',
    title: 'Maintained by TiDev: verified releases and a compiled API reference here',
  },
  community: {
    label: 'Verified',
    className: 'border-success text-success',
    title: 'Reviewed by TiDev and vouched for. Published on GitHub by its author',
  },
  unverified: {
    label: 'Unverified',
    className: 'border-border-strong text-text-subtle',
    title: 'Listed because it carries the titanium topic on GitHub. Nobody has reviewed it',
  },
};

/**
 * The card stripe, keyed to the same three values as the badge.
 *
 * A background on a pseudo-element rather than `border-l-*`: the card's border
 * changes colour on hover, and a left border would be overwritten by it.
 */
export const SOURCE_STRIPE: Record<ModuleSource, string> = {
  tidev: 'before:bg-link',
  community: 'before:bg-success',
  unverified: 'before:bg-border-strong',
};

export function SourceBadge({ source }: { source: ModuleSource }) {
  const style = SOURCE_STYLE[source];
  return (
    <span
      title={style.title}
      className={`rounded border px-1.5 py-0.5 font-mono text-xs ${style.className}`}
    >
      {style.label}
    </span>
  );
}

/**
 * The newest release on each platform, side by side.
 *
 * Two rows rather than one "latest", because there is no such thing: ti.map's
 * android 5.7.0 and iOS 7.3.1 are both current, from eighteen months apart, and
 * a reader who sees only one of them will install the wrong module.
 */
export function LatestPerPlatform({
  latest,
  href,
  className = '',
}: {
  latest: PlatformLatest[];
  /** Links each version to its own page when given. */
  href?: (version: string) => string;
  className?: string;
}) {
  if (!latest.length) return null;

  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      {latest.map(({ platform, version, publishedAt, minsdk }) => {
        const date = formatDate(publishedAt);
        return (
          <li key={platform} className="flex flex-wrap items-baseline gap-1.5 text-sm">
            <span className="text-text-subtle">{PLATFORM_LABELS[platform]}</span>
            {href ? (
              <a href={href(version)} className="font-mono text-link hover:underline">
                {version}
              </a>
            ) : (
              <span className="font-mono">{version}</span>
            )}
            {date && <span className="text-xs text-text-subtle">{date}</span>}
            {/* Per platform, because it is: ti.map needs SDK 12.7.0 on Android
                and 10.0.0 on iOS. Shown as the manifest wrote it - some say
                `10.0.0.GA` - since normalising would be inventing precision. */}
            {minsdk && (
              <span
                title={`Requires Titanium SDK ${minsdk} or newer`}
                className="text-xs text-text-subtle"
              >
                · SDK {minsdk}+
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Which platforms one release shipped for. */
export function PlatformChips({ platforms }: { platforms: readonly ('android' | 'ios')[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {platforms.map((p) => (
        <span
          key={p}
          className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-text-subtle"
        >
          {PLATFORM_LABELS[p]}
        </span>
      ))}
    </span>
  );
}
