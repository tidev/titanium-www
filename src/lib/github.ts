/**
 * Links into this repository on GitHub.
 *
 * One definition, because the pages that send people there - `/directory/submit`
 * and `/showcase/submit` - had a `REPO` constant each and were one typo away
 * from disagreeing about where the project lives.
 */

export const REPO_URL = 'https://github.com/tidev/titaniumsdk.com';

/**
 * GitHub's file editor, opened on a new file that is already written.
 *
 * `?filename=` and `?value=` are long-standing query parameters on `/new/`:
 * the first fills the name field, the second fills the editor. Between them a
 * submitter arrives at a complete, valid file and only has to change the values
 * to their own, rather than copying a block off this site into an empty box and
 * hoping the punctuation survived.
 *
 * **The whole path goes in `filename`, and the URL carries only the branch.**
 * When `filename` is set, GitHub drops the last folder segment of the path in
 * the URL, so `/new/main/registry/directory?filename=x.json` lands the file in
 * `registry/x.json`. Passing `/new/main` and the full path avoids the rule
 * rather than trying to satisfy it.
 *
 * A reader without write access is not turned away: GitHub forks the repository
 * for them on the way in, which is the flow every submission takes anyway.
 */
export function newFileUrl(path: string, content: string): string {
  const params = new URLSearchParams({ filename: path, value: content });
  return `${REPO_URL}/new/main?${params}`;
}
