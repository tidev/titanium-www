/**
 * The shared box for a top-level item in the header nav.
 *
 * One string, because the row holds two kinds of element - four links and one
 * disclosure button - and they have to be the same box or they do not line up.
 *
 * `flex items-center` is the load-bearing half. A plain inline `<a>` takes its
 * vertical position from the line box it sits in, and that line box is sized by
 * the *strut* - the inherited font size, not the `text-sm` on the anchor itself
 * - so its text lands a pixel or two away from where a `flex` sibling centres
 * its own. Two items, two rules, and only the odd one out looks wrong. Giving
 * every item the same flex box takes the strut out of it: each is its own
 * padding plus one line, text centred inside, and they agree by construction
 * rather than by luck with a particular typeface's metrics.
 *
 * Its own file rather than an export from `site-header.tsx`, which is a server
 * component: importing a constant out of it would pull the header, the search
 * box and the theme toggle into the client bundle behind `nav-menu.tsx`.
 */
export const NAV_ITEM_CLASS =
  'flex items-center rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
