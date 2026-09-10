import {
  AvailabilityChips,
  KindBadge,
  Picture,
  PlaceholderBadge,
  SpecialtyChips,
  Where,
} from '@/components/directory/badges';
import { ExternalIcon } from '@/components/ui/external-link';
import { listedProfiles, profileById } from '@/lib/directory/read';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/**
 * One listing, at a URL its owner can hand out.
 *
 * The reason these have pages of their own rather than being anchors on the
 * index: expiry has to reach the page, the sitemap and search alike, and only a
 * real URL can leave all three. When a listing expires this route stops being
 * generated at the next daily rebuild, so the page 404s, drops out of the
 * sitemap, and its search record is not written.
 *
 * The date itself is not drawn here. The page carries what a reader came for -
 * who this is, what they do, how to reach them - and expiry is enforced by the
 * listing simply not existing once it passes, which needs no paragraph.
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

  return (
    <div className="max-w-3xl py-10">
      <p className="text-sm">
        <a href="/directory" className="text-link hover:underline">
          Developer directory
        </a>
      </p>

      <div className="mt-6 flex items-start gap-4">
        <Picture profile={profile} size={64} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-3xl font-semibold tracking-tight">{profile.name}</h1>
            <span className="flex flex-wrap items-center gap-2">
              {profile.placeholder && <PlaceholderBadge />}
              <KindBadge profile={profile} />
            </span>
          </div>

          <div className="mt-2">
            <Where profile={profile} />
          </div>
        </div>
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

      <section aria-labelledby="specialties" className="mt-8">
        <h2 id="specialties" className="text-sm font-semibold tracking-tight">
          Specialties
        </h2>
        <div className="mt-2">
          <SpecialtyChips profile={profile} />
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

        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <li>
            <a
              href={profile.contact.url}
              rel="noopener noreferrer"
              className="text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {profile.contact.label}
              <ExternalIcon />
            </a>
          </li>
          {/* Filtered rather than skipped inside the map, which returned
              `undefined` for a dropped link and left a hole in the array.

              Keyed on both halves: nothing in the schema stops one listing
              pointing two differently labelled links at the same URL. */}
          {profile.links
            .filter((link) => link.url !== profile.contact.url)
            .map((link) => (
              <li key={`${link.label} ${link.url}`}>
                <a
                  href={link.url}
                  rel="noopener noreferrer"
                  className="text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  {link.label}
                  <ExternalIcon />
                </a>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
