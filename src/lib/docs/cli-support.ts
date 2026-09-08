import type { CliReleases, Toolchain } from '../registry/index.ts';
import semver from 'semver';

/**
 * The oldest Titanium CLI that can build a given SDK release (TI-75).
 *
 * Two constraints decide it, and the answer is whichever is stricter.
 *
 * ## The commands
 *
 * Each bundled command exports a `cliVersion`, and the CLI refuses to run a
 * command whose range it does not satisfy. That is a floor stated directly.
 *
 * ## The Node the SDK needs
 *
 * The subtler one. An SDK release declares the Node it requires, but the CLI
 * does not enforce it: `titanium-cli` reads `vendorDependencies.node` and
 * throws inside a `try` whose `catch` is empty, so nothing stops you running a
 * CLI on a Node the SDK cannot build under. The build fails later and further
 * from the cause.
 *
 * So the CLI itself has to be the guard. A CLI whose own `engines.node` floor
 * is below the SDK's would start on a Node the SDK does not support; one at or
 * above it cannot. That makes the answer the oldest CLI whose Node floor is at
 * least the SDK's.
 *
 * Worked through: SDK 13.4.1 needs Node `>=20.18.1`. CLI 7 declares `>=18` and
 * would start on Node 18, where that SDK breaks. CLI 8 declares `>=20.18.1` and
 * cannot. So 8.0.0, even though the commands ask only for `>=3.2.1`.
 *
 * Floors are compared, not ranges. Where an SDK bounds its range - 12.x
 * declares `16.x || 18.x || 20.x` - the floor is what the comparison uses, so
 * 12.x resolves to CLI 7. That is a deliberate reading rather than a fallout:
 * matching floors keeps one rule for every release, at the cost of naming a CLI
 * a Node 16 user on 12.x cannot run.
 */

/**
 * The lowest Node version a range admits, or null when it admits everything.
 *
 * `semver.minVersion` rather than walking comparators: it already answers this
 * for unions, so `16.x || 18.x || 20.x` gives 16.0.0 without this having an
 * opinion about how a range is put together. `*` is excluded because its
 * minimum is 0.0.0, which would compare as a real floor and make every CLI
 * qualify.
 */
export function nodeFloor(range: string | undefined): string | null {
  if (!range) return null;
  const valid = semver.validRange(range, { loose: true });
  if (!valid || valid === '*') return null;
  return semver.minVersion(valid, { loose: true })?.version ?? null;
}

/**
 * The minimum CLI for one release, or undefined when nothing constrains it.
 *
 * `releases` is every published CLI, in any order. Prereleases are ignored:
 * naming one as a requirement would tell a reader to install something npm
 * does not give them by default.
 */
export function minimumCli(
  toolchain: Pick<Toolchain, 'node' | 'cli'>,
  releases: CliReleases['releases']
): string | undefined {
  const sdkFloor = nodeFloor(toolchain.node);

  const byNode = sdkFloor
    ? releases
        .filter((r) => semver.valid(r.version) && !semver.prerelease(r.version))
        .filter((r) => {
          const floor = nodeFloor(r.node);
          return floor !== null && semver.gte(floor, sdkFloor);
        })
        .sort((a, b) => semver.compare(a.version, b.version))[0]?.version
    : undefined;

  const fromCommands = toolchain.cli;
  if (!byNode) return fromCommands;
  if (!fromCommands) return `>=${byNode}`;

  // The commands state a range; the Node rule states a concrete version. Keep
  // whichever demands more, and say it the way that constraint was authored.
  const commandFloor = nodeFloor(fromCommands);
  if (commandFloor && semver.gt(commandFloor, byNode)) return fromCommands;
  return `>=${byNode}`;
}
