import { GuideNav } from './guide-nav';
import { DocsNavDrawer } from './nav-drawer';
import { writtenPaths } from '@/lib/docs/guides';
import { latestSdkVersion, sdkIndex } from '@/lib/docs/registry';
import { navTypes } from '@/lib/docs/tree';

/**
 * The documentation shell, wrapped around the unversioned API pages (TI-79).
 *
 * `/docs/sdk` and `/docs/sdk/<type>` are part of the docs rather than a silo
 * beside them, so they get the guides sidebar - with the namespace tree hung
 * under its "Titanium API" row - instead of `ApiNav`. A pinned
 * `/docs/sdk/<version>` keeps the standalone rail; that is the whole difference
 * between the two addresses.
 *
 * The same grid the guide route uses, minus its third column: these pages carry
 * their own right-hand rail (the version switcher and an in-page contents)
 * inside `children`, placed by the nested grid a type page already had.
 */
export function DocsShell({ active, children }: { active: string; children: React.ReactNode }) {
  const latest = latestSdkVersion();
  const types = latest ? (sdkIndex(latest)?.types ?? []) : [];

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-x-8 px-4 py-8 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8">
      <DocsNavDrawer>
        <GuideNav
          current={active ? `/docs/sdk/${active}` : '/docs/sdk'}
          written={writtenPaths()}
          apiTree={{
            types: navTypes(types),
            base: '/docs/sdk',
            active,
            count: types.length,
          }}
        />
      </DocsNavDrawer>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
