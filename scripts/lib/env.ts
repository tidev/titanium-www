import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

/**
 * Loads `.env.local` then `.env` from the repo root.
 *
 * Imported for its side effect by the modules that read credentials, so a
 * script cannot forget to do it and fail with a confusing "token is required".
 *
 * Three properties this relies on, all dotenv defaults:
 *
 *   - A real environment variable always wins. CI passes `GITHUB_TOKEN` through
 *     `env:` from secrets, and that must not be shadowed by a stray `.env` on a
 *     runner.
 *   - Nothing already set is overwritten, so **the first file loaded wins**.
 *     That is why `.env.local` is read first.
 *   - A missing file is a no-op, not an error. There is neither in CI.
 *
 * `.env.local` used to be ignored entirely, which is a trap rather than a
 * preference: `next dev` reads it, both are gitignored, and Next's own
 * convention is that it overrides `.env`. A token put in the file the framework
 * treats as authoritative was silently shadowed by a stale one in `.env`, and
 * the only symptom was a 401 from GitHub naming neither file.
 *
 * Resolved from this file rather than `process.cwd()`, so it works no matter
 * where the script was invoked from.
 */
for (const file of ['.env.local', '.env']) {
  config({
    path: fileURLToPath(new URL(`../../${file}`, import.meta.url)),
    quiet: true,
  });
}
