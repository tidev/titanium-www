/**
 * The gutters the showcase pages share.
 *
 * Only gutters, as with `/directory` and `/modules`: both pages here are one
 * column, so nothing about the grid belongs to the shell.
 */
export default function ShowcaseLayout({ children }: LayoutProps<'/showcase'>) {
  return <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">{children}</div>;
}
