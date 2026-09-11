/**
 * Which scraped repositories reach the community list (TI-23).
 *
 * Split out of `generate-community-modules.ts` so it can be tested: that script
 * runs its work at the top level and needs a GitHub token, so importing it from
 * a test would execute a scrape. The rules here are the whole of the mechanical
 * half of `docs/module-curation.md`; the judgement half is `blocked.json`,
 * which arrives as `blocked`.
 */

export type Candidate = {
  full_name: string;
  archived: boolean;
  fork: boolean;
};

export type Exclusion = 'curated' | 'blocked' | 'archived' | 'fork';

/**
 * Why this repo is not listed, or null when it is.
 *
 * Returns the reason rather than a boolean so the generator can report counts
 * per cause. A run that suddenly drops forty repos should say which rule did it.
 */
export function excludedBecause(
  repo: Candidate,
  curated: ReadonlySet<string>,
  blocked: ReadonlySet<string>
): Exclusion | null {
  const slug = repo.full_name.toLowerCase();

  // Curated first: a TiDev repo that is also archived should read as curated,
  // since that is the reason it has no business in this list.
  if (curated.has(slug)) return 'curated';
  if (blocked.has(slug)) return 'blocked';

  // Archived is the author saying the repository is finished. Listing it as
  // something to reach for is the listing being wrong, not the module.
  if (repo.archived) return 'archived';

  // A backstop, not an active rule: GitHub's repository search omits forks
  // unless the query says `fork:true`, and ours does not - the first real run
  // dropped 0 of 302 candidates here. It stays because that is a property of
  // the query rather than of the data, so a future edit to QUERIES could start
  // admitting them, and because a fork is nearly always somebody's patch of a
  // module already listed.
  if (repo.fork) return 'fork';

  return null;
}
