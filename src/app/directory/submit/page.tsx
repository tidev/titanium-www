import { ExternalLink } from '@/components/ui/external-link';
import { newFileUrl } from '@/lib/github';
import { prettyJson } from '@/lib/pretty-json';
import { IMAGE_EXTENSIONS } from '@/lib/registry-images';
import { listingTemplate, LISTING_DAYS } from '@/lib/registry/directory';
import { SITE_URL } from '@/lib/site';
import type { Metadata } from 'next';

/**
 * How to get into the developer directory (TI-58).
 *
 * A page rather than a card on the index: it has an address other pages can
 * point at, it can be found by somebody searching for it, and it leaves the
 * index to the job of showing the directory.
 *
 * `newFileUrl` hands GitHub a complete, valid listing, so this page only has
 * to say what a submitter would not already guess: rename the file, keep the
 * `id` in step. Everything a button labelled "Add your profile on GitHub"
 * already implies is left unsaid.
 *
 * No mention of `?template=` and the pull request checklist it fills in - that
 * was a bullet here once, on the theory that a reviewer benefits from it. A
 * submitter reads this page to add a listing, not to learn a GitHub query
 * parameter, and asking them to carry one to the next page they had not
 * reached yet was optimising for a reviewer's convenience on a page written
 * for someone else entirely.
 *
 * `docs/developer-directory.md` is the reviewer's copy of the same rules and
 * goes further than a submitter needs - who decides, what was rejected, the
 * ordering rota. What a submitter needs is below the button instead.
 */

/** The filename a submitter is meant to change. Named to be obviously a placeholder. */
const PLACEHOLDER_FILE = 'registry/directory/your-name.json';

const MONTHS = Math.round(LISTING_DAYS / 30);

export const metadata: Metadata = {
  title: 'Get listed in the developer directory - Titanium SDK',
  description:
    'How to add yourself or your company to the Titanium developer directory: one JSON file, one pull request, no account and no form.',
  alternates: { canonical: `${SITE_URL}/directory/submit` },
};

const LINK =
  'text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

export default function GetListedPage() {
  // Read at build time, so the expiry date it carries moves with the nightly
  // rebuild rather than ageing into the past on a page nobody edits.
  const json = prettyJson(listingTemplate(new Date()));

  return (
    <div className="max-w-3xl py-10">
      <p className="text-sm">
        <a href="/directory" className={LINK}>
          Developer directory
        </a>
      </p>

      <h1 className="mt-6 text-3xl font-semibold tracking-tight">Get listed</h1>
      <p className="mt-3 text-text-muted">
        Available for paid Titanium work? Add yourself: one file, one pull request, no account.
      </p>

      <p className="mt-8">
        <ExternalLink
          href={newFileUrl(PLACEHOLDER_FILE, json)}
          className="inline-block rounded-md border border-border-strong px-4 py-2.5 font-medium text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Add your profile on GitHub
        </ExternalLink>
      </p>

      <ul className="mt-6 max-w-xl list-disc space-y-2 pl-5 text-sm text-text-muted">
        <li>
          Rename the file to a slug of your own - it becomes{' '}
          <code className="font-mono text-xs">
            {SITE_URL.replace('https://', '')}/directory/&lt;slug&gt;
          </code>
          , and has to match the <code className="font-mono text-xs">id</code> inside it.
        </li>
        <li>No GitHub account? One is forked for you on the way in.</li>
        <li>
          A photo or logo is optional ({IMAGE_EXTENSIONS.join(', ')}, at most 100KB), committed
          beside the JSON and named the same. Without one you get initials.
        </li>
        <li>
          No email address anywhere - not in <code className="font-mono text-xs">contact.url</code>,
          not in a link, not written into any text field. The schema rejects it.
        </li>
      </ul>

      <table className="mt-8 w-full max-w-xl border-collapse text-sm">
        <caption className="mb-2 text-left text-sm text-text-muted">
          Every field in the{' '}
          <ExternalLink href={newFileUrl(PLACEHOLDER_FILE, json)} className={LINK}>
            template
          </ExternalLink>{' '}
          above.
        </caption>
        <thead>
          <tr className="border-b border-border-strong text-left text-text-subtle">
            <th className="py-1.5 pr-4 font-medium">Field</th>
            <th className="py-1.5 font-medium">What goes in it</th>
          </tr>
        </thead>
        <tbody className="text-text-muted">
          {[
            ['id', 'Lowercase kebab-case slug. Must match the filename, and becomes your URL.'],
            ['name', 'Your name, or the company name.'],
            ['kind', '"individual" or "agency".'],
            ['summary', 'One sentence, up to 280 characters. What you do.'],
            ['location', 'Free text: a city, a country, or "Remote, EU only".'],
            ['timezone', 'An IANA zone, such as Europe/Berlin. Checked against the real list.'],
            ['availability', 'One or more of "full-time", "part-time", "contract".'],
            [
              'specialties',
              'One to eight values from the fixed list in src/lib/registry/directory.ts.',
            ],
            ['skills', 'Free text, shown but not filtered on (optional).'],
            ['contact', 'A page you control - a form, a profile, anywhere you can be reached.'],
            ['links', 'Your site, repositories, portfolio, up to six (optional).'],
            [
              'expiresAt',
              'YYYY-MM-DD, no more than three months out. Or set neverExpires instead.',
            ],
          ].map(([field, description]) => (
            <tr key={field} className="border-b border-border">
              <td className="py-1.5 pr-4 align-top font-mono text-xs">{field}</td>
              <td className="py-1.5 align-top">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-labelledby="renewal" className="mt-12 border-t border-border pt-8">
        <h2 id="renewal" className="text-lg font-semibold tracking-tight">
          Listings run for {MONTHS} months
        </h2>
        <p className="mt-2 text-text-muted">
          Renewing is a one-line pull request moving the date. That friction is the point: a list of
          people confirmed available beats a list of people who once were.
        </p>
      </section>

      <section aria-labelledby="who-may-list" className="mt-10">
        <h2 id="who-may-list" className="text-lg font-semibold tracking-tight">
          Who may list
        </h2>
        <p className="mt-2 text-text-muted">
          Anyone genuinely available for paid Titanium work - individuals, contractors and agencies
          share one list. A listing is a claim of availability, not a recommendation: we check that
          it is a real person or company offering real work, and nothing further.
        </p>
      </section>

      <section aria-labelledby="removal" className="mt-10">
        <h2 id="removal" className="text-lg font-semibold tracking-tight">
          When a listing is removed
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-text-muted">
          <li>It expires. Comes back the moment its owner renews.</li>
          <li>Its owner asks. No questions, no delay.</li>
          <li>It is not what it says it is.</li>
          <li>The contact link is dead.</li>
          <li>It advertises something other than Titanium work.</li>
          <li>Credible reports of misconduct toward clients or this community.</li>
        </ul>
        <p className="mt-3 text-text-muted">
          A deletion, with the reason in the pull request. No blocklist, no public record.
        </p>
      </section>
    </div>
  );
}
