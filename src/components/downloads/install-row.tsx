import { AssetLinks } from './asset-links';
import { InstallCommand } from './install-command';
import { installCommand } from '@/lib/downloads/format';
import type { Build } from '@/lib/registry';

/**
 * How to get one build: the install command, and the archives beside it.
 *
 * Shared by the download lists and the API reference's version index (TI-75),
 * so that "how do I get this" reads the same wherever a version is named. The
 * layout is the reason it is a component rather than two adjacent elements: the
 * command and the chips have to wrap as one group, and `min-w-max` on the chips
 * is what stops them being squeezed into a column instead of wrapping. Below
 * `sm` there is no width to fit them alongside, so they take their own line.
 */
export function InstallRow({ build, branch }: { build: Build; branch?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <InstallCommand
        command={installCommand(build.name, branch)}
        label={`Copy the install command for ${build.name}`}
      />
      {build.assets.length ? (
        <div className="min-w-full sm:min-w-max">
          <AssetLinks assets={build.assets} />
        </div>
      ) : (
        <p className="text-sm text-text-subtle">No archives were published for this build.</p>
      )}
    </div>
  );
}
