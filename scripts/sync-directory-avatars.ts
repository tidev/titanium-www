import { avatarsByProfile } from '../src/lib/directory/avatar.ts';
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Mirrors directory listing pictures into `public/` so Next can serve them.
 *
 * They are committed beside the listing they belong to, in `registry/directory/`,
 * rather than dropped into `public/` directly - see `src/lib/directory/avatar.ts`
 * for why a picture is a committed file at all.
 *
 * ## This step is the enforcement, not a convenience
 *
 * Everything under `public/` is served verbatim, by the host's own static layer
 * in deployment, with nothing between the file and the reader. A picture
 * committed straight into `public/` would therefore be published whatever it
 * was: any size, any format, belonging to no listing at all.
 *
 * Making the copy the only route in means the rules in `avatarProblem` are not
 * merely checked somewhere, they are the thing that publishes. A file that
 * fails them has no path to the site.
 *
 * The destination is gitignored and rebuilt from scratch, so a picture is
 * committed exactly once and a deleted listing cannot leave one behind.
 *
 *   node scripts/sync-directory-avatars.ts
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const SOURCE = join(root, 'registry/directory');
const PUBLIC = join(root, 'public/directory');

/** The listings that exist, by id. Their pictures are named after them. */
function listingIds(): string[] {
  if (!existsSync(SOURCE)) return [];
  return readdirSync(SOURCE)
    .filter((name) => name.endsWith('.json'))
    .map((name) => basename(name, '.json'));
}

function sync(): void {
  // Everything is checked before anything is removed. `avatarsByProfile` throws
  // on the first unpublishable file, and clearing the destination first would
  // mean a rejected picture took every good one down with it - leaving a build
  // that still references them and quietly serves none.
  const pictures = avatarsByProfile(SOURCE, listingIds());

  // Rebuilt rather than updated. A listing removed in the same commit that
  // added it back under another name would otherwise leave its picture served
  // at a URL nothing links to.
  rmSync(PUBLIC, { recursive: true, force: true });

  if (!pictures.size) {
    console.log('directory: no listing pictures to publish');
    return;
  }

  mkdirSync(PUBLIC, { recursive: true });
  for (const name of pictures.values()) {
    copyFileSync(join(SOURCE, name), join(PUBLIC, name));
  }

  console.log(`directory: published ${pictures.size} listing picture(s) to public/directory/`);
}

sync();
