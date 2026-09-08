/**
 * Which Titanium CLI an SDK release requires, read from the commands themselves.
 *
 * The SDK bundles four commands, and each exports its own `cliVersion`. That
 * export is what the CLI enforces before it will run the command, so it is the
 * only statement of the requirement that is actually load-bearing.
 *
 * The `titanium` entry in the SDK's `package.json` is a different claim and is
 * deliberately not read: it is a development dependency of the SDK repository
 * rather than a statement about what a release needs from the machine, and
 * putting it on the compatibility page would print a number that nothing
 * checks.
 *
 * Parsing rather than importing, because these are read out of a git object at
 * a release's commit. Importing would mean executing a command module from a
 * years-old SDK against today's runtime.
 */

/** The commands the SDK bundles. There are only these four. */
export const CLI_COMMANDS = ['build', 'clean', 'create', 'project'] as const;

/** `export const cliVersion = '>=9.1.0'`, and the older `exports.cliVersion` form. */
const CLI_VERSION = /cliVersion\s*=\s*['"]([^'"]+)['"]/;

/** The numeric version inside a range, for ordering `>=3.2.1` against `>=9.1.0`. */
function rangeOrder(range: string): [number, number, number] {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(range);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
}

/**
 * The highest `cliVersion` across the command sources given, or undefined when
 * none declares one.
 *
 * All four should agree, and across every release captured so far they do. The
 * highest wins rather than the first because a release that disagrees with
 * itself is still unusable below its strictest command: the CLI refuses that
 * one, and naming a lower version would tell a reader their install was fine
 * when the build will not run.
 *
 * The range is returned as authored, like every other range on the page. Only
 * the ordering looks inside it.
 */
export function highestCliVersion(sources: readonly (string | null)[]): string | undefined {
  const found: string[] = [];
  for (const src of sources) {
    const m = src && CLI_VERSION.exec(src);
    if (m) found.push(m[1]);
  }
  if (!found.length) return undefined;

  return found.reduce((best, next) => {
    const [a, b] = [rangeOrder(next), rangeOrder(best)];
    for (let i = 0; i < 3; i++) {
      if (a[i] !== b[i]) return a[i] > b[i] ? next : best;
    }
    return best;
  });
}
