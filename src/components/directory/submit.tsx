/**
 * How to get listed, and how to stay listed.
 *
 * Shown on both the index and every listing page, because the two audiences for
 * it are different: a reader of the index might be a developer who should be in
 * it, and a reader of a listing page is often the listee checking their own
 * entry after a renewal.
 */

const REPO = 'https://github.com/tidev/titaniumsdk.com';

/**
 * GitHub's new-file editor, pre-addressed to the right directory.
 *
 * A pull request is the submission form. That is not a workaround for having no
 * database: an account system for a list this size would be sessions, recovery,
 * deletion requests and moderation tooling, permanently, and the pull request
 * already carries review, history, and an author who is who they say they are.
 *
 * The named pull request template cannot be attached to this link - GitHub
 * takes `?template=` on the compare page, which is two steps later - so the
 * template is named in the prose instead.
 */
export const NEW_LISTING_URL = `${REPO}/new/main/registry/directory`;

export const POLICY_URL = `${REPO}/blob/main/docs/developer-directory.md`;

export const TEMPLATE_URL = `${REPO}/blob/main/.github/PULL_REQUEST_TEMPLATE/directory-listing.md`;

export function HowToList({ className = '' }: { className?: string }) {
  return (
    <section
      aria-labelledby="get-listed"
      className={`rounded-lg border border-border p-5 ${className}`}
    >
      <h2 id="get-listed" className="text-lg font-semibold tracking-tight">
        Get listed
      </h2>
      <p className="mt-2 text-sm text-text-muted">
        Add one JSON file to <code className="font-mono text-xs">registry/directory/</code> and open
        a pull request. No account, no form. A photo or logo is optional: commit it beside the JSON,
        named after your listing, at most 100KB. Use the{' '}
        <a href={TEMPLATE_URL} className="text-link hover:underline">
          listing template
        </a>{' '}
        by appending <code className="font-mono text-xs">?template=directory-listing.md</code> to
        the pull request URL, and read{' '}
        <a href={POLICY_URL} className="text-link hover:underline">
          who may list and why a listing is removed
        </a>{' '}
        first.
      </p>
      <p className="mt-3 text-sm text-text-muted">
        Listings run for three months. Renewing is a one-line pull request that moves the date, and
        that friction is deliberate: it is what makes this a list of people who are actually
        available rather than a list of people who once were.
      </p>
      <p className="mt-3 text-sm text-text-subtle">
        No email addresses are published here, yours included. Every listing links to a page its
        owner controls, because a scrapeable address on a public page is a cost you would carry and
        we would not.
      </p>
      <a
        href={NEW_LISTING_URL}
        className="mt-4 inline-block rounded-md border border-border-strong px-3 py-2 text-sm font-medium text-link hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Add a listing on GitHub
      </a>
    </section>
  );
}
