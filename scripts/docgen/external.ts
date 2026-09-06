import { sha256 } from './manifest.ts';
import { readFileSync } from 'node:fs';

/**
 * A corpus compiled from another repo, read back so this one can link into it.
 *
 * docgen compiles one repo at a time, so a module's own compile has never heard
 * of `Titanium.UI.View`: every reference ti.map makes into the SDK resolved to
 * nothing and was left on the page as literal `<Titanium.UI>`. Loading the SDK's
 * already-compiled index gives those references something to resolve to.
 *
 * The index carries member names rather than only counts precisely so this stays
 * a verification and not a guess - `<Titanium.UI.ANIMATION_CURVE_LINEAR>` is
 * checked against the SDK's member table the same way an internal reference is
 * checked against the local one, so a typo fails the compile instead of shipping
 * an anchor to a member that does not exist.
 */

/** Which compiled corpus to resolve into. Stated by the caller, never inferred. */
export type ExternalSource = {
  /** The repo it was compiled from, e.g. `tidev/titanium-sdk`. */
  repo: string;
  version: string;
  /** Path to that version's compiled `index.json`. */
  index: string;
};

export type ExternalCorpus = {
  repo: string;
  version: string;
  /** Type name -> every member name that type's page anchors. */
  members: ReadonlyMap<string, ReadonlySet<string>>;
  /**
   * Identifies what was consumed - names, not prose. An SDK summary edit must
   * not invalidate every module's compiled output; a renamed type must.
   */
  hash: string;
};

/** `tidev/titanium-sdk@main`, for logs and error messages. */
export const externalLabel = (s: { repo: string; version: string }) => `${s.repo}@${s.version}`;

type IndexShape = { types?: { name?: unknown; members?: unknown }[] };

export function loadExternalCorpus({
  repo,
  version,
  index: indexFile,
}: ExternalSource): ExternalCorpus {
  let index: IndexShape;
  try {
    index = JSON.parse(readFileSync(indexFile, 'utf8'));
  } catch (err) {
    throw new Error(`cannot read the external corpus at ${indexFile}: ${(err as Error).message}`);
  }

  const entries = Array.isArray(index.types) ? index.types : null;
  if (!entries) throw new Error(`${indexFile} is not a compiled index: no \`types\` array`);

  const members = new Map<string, ReadonlySet<string>>();
  const parts: string[] = [];
  for (const entry of entries) {
    if (typeof entry?.name !== 'string') continue;
    if (!Array.isArray(entry.members)) {
      // Written by a docgen that predates TI-61. Guessing the member set is the
      // one thing this must not do, so it stops instead.
      throw new Error(
        `${indexFile} carries no member names for ${entry.name}.\n` +
          'It was compiled before member names were recorded; regenerate it first.'
      );
    }
    const names = entry.members.filter((m): m is string => typeof m === 'string');
    members.set(entry.name, new Set(names));
    parts.push(`${entry.name}\0${names.join('\0')}`);
  }

  // Only the types the index lists, which is the emitted set: a pseudo-type the
  // other repo inlined has no page, so linking to it would be a dead link.
  return { repo, version, members, hash: sha256(parts.join('\n')) };
}
