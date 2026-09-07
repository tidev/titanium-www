import {
  AvailabilityChips,
  KindBadge,
  PlaceholderBadge,
  SpecialismChips,
  Where,
} from '@/components/directory/badges';
import { HowToList } from '@/components/directory/submit';
import { daysRemaining } from '@/lib/directory/profile';
import { buildDate, listedProfiles, profileById } from '@/lib/directory/read';
import { formatDate } from '@/lib/docs/format';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * One listing, at a URL its owner can hand out.
 *
 * The reason these have pages of their own rather than being anchors on the
 * index: expiry has to be visible in the listing, the sitemap and search, and
 * only a real URL can leave all three. When a listing expires this route stops
 * being generated at the next daily rebuild, so the page 404s, drops out of the
 * sitemap, and its search record is not written.
 *
 * `generateStaticParams` reads the same filtered set the index does, so there
 * is exactly one definition of what is currently listed.
 */

export const dynamicParams = false;

export function generateStaticParams() {
  return listedProfiles().map((profile) => ({ profileId: profile.id }));
}

export async function generateMetadata({
  params,
}: PageProps<'/directory/[profileId]'>): Promise<Metadata> {
  const { profileId } = await params;
  const profile = profileById(profileId);
  if (!profile) return {};

  return {
    title: `${profile.name} - Titanium developer directory`,
    description: profile.summary,
    alternates: { canonical: `${SITE_URL}/directory/${profile.id}` },
  };
}

export default async function ProfilePage({ params }: PageProps<'/directory/[profileId]'>) {
  const { profileId } = await params;

  // Not trusted as a path: `profileById` looks the segment up among the
  // listings actually on disk rather than joining it onto one.
  const profile = profileById(profileId);
  if (!profile) notFound();

  const left = daysRemaining(profile, buildDate());

  return (
    <div className="max-w-3xl py-10">
      <p className="text-sm">
        <a href="/directory" className="text-link hover:underline">
          Developer directory
        </a>
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">{profile.name}</h1>
        <span className="flex flex-wrap items-center gap-2">
          {profile.placeholder && <PlaceholderBadge />}
          <KindBadge profile={profile} />
        </span>
      </div>

      <div className="mt-2">
        <Where profile={profile} />
      </div>

      <p className="mt-4 text-text-muted">{profile.summary}</p>

      <section aria-labelledby="availability" className="mt-8">
        <h2 id="availability" className="text-sm font-semibold tracking-tight">
          Available for
        </h2>
        <div className="mt-2">
          <AvailabilityChips profile={profile} />
        </div>
      </section>

      <section aria-labelledby="specialisms" className="mt-8">
        <h2 id="specialisms" className="text-sm font-semibold tracking-tight">
          Specialisms
        </h2>
        <div className="mt-2">
          <SpecialismChips profile={profile} />
        </div>
        {profile.skills.length > 0 && (
          <p className="mt-3 text-sm text-text-muted">
            {/* Free text the listee wrote, shown but never filtered on: the
                filters run on the closed vocabulary above, which is what stops
                the menu filling up with one person's spelling of Titanium. */}
            Also: {profile.skills.join(', ')}
          </p>
        )}
      </section>

      <section aria-labelledby="contact" className="mt-8">
        <h2 id="contact" className="text-sm font-semibold tracking-tight">
          Get in touch
        </h2>
        <p className="mt-2">
          <a
            href={profile.contact.url}
            rel="noopener noreferrer"
            className="text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {profile.contact.label}
          </a>
        </p>
        {/* Said out loud, because the absence of an address on a directory page
            reads as an omission unless somebody explains it. */}
        <p className="mt-2 text-xs text-text-subtle">
          This directory publishes no email addresses. The link above goes to a page this
          listing&rsquo;s owner controls.
        </p>

        {profile.links.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {/* Keyed on both halves: nothing in the schema stops one listing
                pointing two differently labelled links at the same URL. */}
            {profile.links.map((link) => (
              <li key={`${link.label} ${link.url}`}>
                <a
                  href={link.url}
                  rel="noopener noreferrer"
                  className="text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="freshness" className="mt-8 border-t border-border pt-6">
        <h2 id="freshness" className="text-sm font-semibold tracking-tight">
          How current is this
        </h2>
        {profile.expiresAt ? (
          <p className="mt-2 text-sm text-text-muted">
            Confirmed available until {formatDate(`${profile.expiresAt}T00:00:00Z`)}
            {left !== null && left <= 14 && (
              <>
                {' '}
                <span className="text-warning">
                  ({left <= 0 ? 'due for renewal now' : `${left} day${left === 1 ? '' : 's'} left`})
                </span>
              </>
            )}
            . After that this listing is removed automatically until its owner opens a pull request
            moving the date.
          </p>
        ) : (
          <p className="mt-2 text-sm text-text-muted">
            {/* Named honestly rather than dressed up. An opt-out from expiry is
                an opt-out from the one guarantee the directory makes. */}
            This listing is exempt from the three month renewal, so nobody has recently confirmed
            that it is still current.
          </p>
        )}
      </section>

      <HowToList className="mt-12" />
    </div>
  );
}
