import { ApiNav } from '@/components/docs/api-nav';
import { resolveVersion, sdkIndex } from '@/lib/docs/registry';
import { navTypes } from '@/lib/docs/tree';

/**
 * The standalone API rail, for the pinned addresses only.
 *
 * A grid rather than a flex row so the nav's own parts can place themselves:
 * below `lg` it is one column with the disclosure toggle above the content, and
 * at `lg` the toggle goes `display: none` - which drops it out of the grid
 * altogether - leaving the rail in column one.
 *
 * Since TI-79 the segment is not always a version. `/docs/sdk/Titanium.UI.Button`
 * is a type at the latest release and belongs inside the documentation, so it
 * brings its own `DocsShell` and passes through here untouched. This layout is
 * what makes `/docs/sdk/13.4.1` the standalone browser it is meant to be.
 */
export default async function SdkLayout({ children, params }: LayoutProps<'/docs/sdk/[segment]'>) {
  const { segment } = await params;
  const resolved = resolveVersion(segment);
  const index = resolved ? sdkIndex(resolved) : null;

  // Not a version: the page below is an unversioned type page and shells
  // itself. An unknown version also lands here, and its child calls
  // notFound() - a nav for a version that does not exist would be worse than
  // none.
  if (!resolved || !index) return children;

  return (
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-x-8 px-4 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:px-8">
      <ApiNav
        types={navTypes(index.types)}
        base={`/docs/sdk/${resolved}`}
        count={index.counts.types}
      />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
