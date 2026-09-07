import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * The snapshot step, run for real (TI-59).
 *
 * The whole point of the script is that cutting a major by hand goes wrong the
 * second time, so a test that reimplemented the copy would prove nothing. This
 * runs the actual script against a miniature content tree in a scratch
 * directory: the script reads everything from `process.cwd()`, so pointing that
 * at a temporary repository is all the isolation it needs.
 */

const SCRIPT = fileURLToPath(new URL('../snapshot-docs.ts', import.meta.url));

const scratches: string[] = [];
after(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

type Manifest = {
  current: string;
  archived: string[];
  dropped: string[];
  retain: number;
};

/** A repository with just enough in it: a manifest and a few pages. */
function repo(manifest: Manifest, files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'ti-snapshot-'));
  scratches.push(dir);

  mkdirSync(join(dir, 'content'), { recursive: true });
  writeFileSync(join(dir, 'content/doc-versions.json'), JSON.stringify(manifest, null, 2));

  for (const [path, body] of Object.entries(files)) {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, body);
  }
  return dir;
}

const PAGES = {
  'content/docs/index.md': '---\ntitle: Documentation\n---\n\nStart here.\n',
  'content/docs/setup/index.md': '---\ntitle: Environment Setup\n---\n\nPick your OS.\n',
  'content/docs/setup/macos.md': '---\ntitle: macOS\n---\n\n:::include install-cli\n',
  'content/docs/build/ui/layout.md': '---\ntitle: Layout\n---\n\nViews stack.\n',
  'content/docs/_partials/install-cli.md': 'Run `npm install -g titanium`.\n',
};

const run = (cwd: string, ...args: string[]) =>
  execFileSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' });

const failure = (cwd: string, ...args: string[]): string => {
  try {
    run(cwd, ...args);
  } catch (err) {
    const e = err as { stderr?: string; stdout?: string };
    return `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
  return assert.fail('expected the script to exit non-zero');
};

const manifestOf = (dir: string): Manifest =>
  JSON.parse(readFileSync(join(dir, 'content/doc-versions.json'), 'utf8'));

describe('cutting a major', () => {
  test('copies the tree, moves the manifest on, and leaves current editable', () => {
    const dir = repo({ current: 'v13', archived: [], dropped: [], retain: 2 }, PAGES);

    run(dir, 'v14');

    assert.deepEqual(manifestOf(dir), {
      current: 'v14',
      archived: ['v13'],
      dropped: [],
      retain: 2,
    });

    // Every page, at the same relative path. A snapshot that reshaped the tree
    // would give the archive different URLs from the major it is a copy of.
    for (const path of Object.keys(PAGES)) {
      const archived = path.replace('content/docs/', 'content/docs-archive/v13/');
      assert.ok(existsSync(join(dir, archived)), `${archived} was not copied`);
      assert.equal(
        readFileSync(join(dir, archived), 'utf8'),
        readFileSync(join(dir, path), 'utf8'),
        `${archived} is not a byte copy`
      );
    }

    // The live tree is untouched: the copy is what freezes, and editing carries
    // on in `content/docs`.
    assert.ok(existsSync(join(dir, 'content/docs/setup/macos.md')));
  });

  test('takes the partials, not just the pages', () => {
    // A snapshot without them renders holes where every `:::include` was, and
    // the failure is silent until someone opens an archived page.
    const dir = repo({ current: 'v13', archived: [], dropped: [], retain: 2 }, PAGES);
    run(dir, 'v14');
    assert.ok(existsSync(join(dir, 'content/docs-archive/v13/_partials/install-cli.md')));
  });

  test('refuses to snapshot the API reference', () => {
    // It is versioned per release in `registry/` and must never be versioned
    // per major as well. It cannot be under `content/docs`; if it ever is, that
    // is a mistake to stop on rather than to copy.
    const dir = repo(
      { current: 'v13', archived: [], dropped: [], retain: 2 },
      {
        ...PAGES,
        'content/docs/sdk/Titanium.UI.Window.md': '---\ntitle: Window\n---\n',
      }
    );

    const out = failure(dir, 'v14');
    assert.match(out, /reserved root/);
    assert.equal(existsSync(join(dir, 'content/docs-archive')), false);
  });

  test('refuses a major that is not newer', () => {
    const dir = repo({ current: 'v13', archived: [], dropped: [], retain: 2 }, PAGES);
    assert.match(failure(dir, 'v13'), /not newer/);
    assert.match(failure(dir, 'v12'), /not newer/);
    assert.equal(manifestOf(dir).current, 'v13');
  });

  test('refuses a version that is not a major', () => {
    const dir = repo({ current: 'v13', archived: [], dropped: [], retain: 2 }, PAGES);
    assert.match(failure(dir, '14.0.0'), /is not a major/);
  });

  test('refuses to overwrite a snapshot that already exists', () => {
    const dir = repo(
      { current: 'v13', archived: [], dropped: [], retain: 2 },
      { ...PAGES, 'content/docs-archive/v13/index.md': '---\ntitle: Old\n---\n' }
    );
    assert.match(failure(dir, 'v14'), /already exists/);
  });

  test('--dry-run writes nothing', () => {
    const dir = repo({ current: 'v13', archived: [], dropped: [], retain: 2 }, PAGES);
    const out = run(dir, 'v14', '--dry-run');
    assert.match(out, /"current": "v14"/);
    assert.equal(manifestOf(dir).current, 'v13');
    assert.equal(existsSync(join(dir, 'content/docs-archive')), false);
  });
});

describe('retention', () => {
  test('drops the oldest major past the window and records where it went', () => {
    const dir = repo(
      { current: 'v14', archived: ['v13', 'v12'], dropped: [], retain: 2 },
      {
        ...PAGES,
        'content/docs-archive/v13/index.md': '---\ntitle: v13\n---\n',
        'content/docs-archive/v12/index.md': '---\ntitle: v12\n---\n',
      }
    );

    const out = run(dir, 'v15');

    assert.deepEqual(manifestOf(dir), {
      current: 'v15',
      archived: ['v14', 'v13'],
      dropped: ['v12'],
      retain: 2,
    });
    assert.match(out, /Dropping v12/);
    // Deleted, not orphaned. A directory the manifest does not list is a build
    // failure, and 13MB of guides nobody can reach is the thing being avoided.
    assert.equal(existsSync(join(dir, 'content/docs-archive/v12')), false);
    assert.ok(existsSync(join(dir, 'content/docs-archive/v13')));
  });

  test('--prune applies the window on its own', () => {
    const dir = repo(
      { current: 'v14', archived: ['v13', 'v12'], dropped: [], retain: 1 },
      {
        ...PAGES,
        'content/docs-archive/v13/index.md': '---\ntitle: v13\n---\n',
        'content/docs-archive/v12/index.md': '---\ntitle: v12\n---\n',
      }
    );

    run(dir, '--prune');

    const after = manifestOf(dir);
    assert.equal(after.current, 'v14');
    assert.deepEqual(after.archived, ['v13']);
    assert.deepEqual(after.dropped, ['v12']);
  });

  test('retain 0 keeps no archives at all', () => {
    const dir = repo({ current: 'v13', archived: [], dropped: [], retain: 0 }, PAGES);
    run(dir, 'v14');
    const after = manifestOf(dir);
    assert.deepEqual(after.archived, []);
    assert.deepEqual(after.dropped, ['v13']);
    assert.equal(existsSync(join(dir, 'content/docs-archive/v13')), false);
  });
});

describe('--check', () => {
  test('passes on a manifest that matches the disk', () => {
    const dir = repo(
      { current: 'v14', archived: ['v13'], dropped: [], retain: 2 },
      { ...PAGES, 'content/docs-archive/v13/index.md': '---\ntitle: v13\n---\n' }
    );
    assert.match(run(dir, '--check'), /Current v14; archived v13/);
  });

  test('fails when the manifest lists a snapshot that is not there', () => {
    const dir = repo({ current: 'v14', archived: ['v13'], dropped: [], retain: 2 }, PAGES);
    assert.match(failure(dir, '--check'), /content\/docs-archive\/v13 is missing/);
  });

  test('fails on a snapshot directory the manifest does not list', () => {
    // The other half of the same fact. An unlisted directory is content that
    // ships in the repository and appears on no page.
    const dir = repo(
      { current: 'v14', archived: [], dropped: [], retain: 2 },
      { ...PAGES, 'content/docs-archive/v13/index.md': '---\ntitle: v13\n---\n' }
    );
    assert.match(failure(dir, '--check'), /the manifest does not list/);
  });

  test('fails when more majors are kept than the window allows', () => {
    const dir = repo(
      { current: 'v14', archived: ['v13', 'v12'], dropped: [], retain: 1 },
      {
        ...PAGES,
        'content/docs-archive/v13/index.md': '---\ntitle: v13\n---\n',
        'content/docs-archive/v12/index.md': '---\ntitle: v12\n---\n',
      }
    );
    assert.match(failure(dir, '--check'), /run pnpm docs:snapshot --prune/);
  });
});

describe('usage', () => {
  test('says what it wants when given nothing', () => {
    const dir = repo({ current: 'v13', archived: [], dropped: [], retain: 2 }, PAGES);
    assert.match(failure(dir), /Usage: node scripts\/snapshot-docs\.ts/);
  });
});
