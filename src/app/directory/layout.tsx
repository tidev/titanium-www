/**
 * The gutters the directory pages share.
 *
 * Only gutters, as with `/modules`: both pages here are one column, so nothing
 * about the grid belongs to the shell.
 */
export default function DirectoryLayout({ children }: LayoutProps<'/directory'>) {
  return <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>;
}
