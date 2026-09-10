/**
 * The box with an arrow leaving it: this link goes off titaniumsdk.com.
 *
 * Used where a reader is choosing between links and the destination changes
 * what the click means - a listee's contact page, an app's store listing, the
 * GitHub pages that explain how to submit. A directory entry is mostly other
 * people's addresses, so saying which ones leave is worth the fourteen pixels.
 *
 * ## Two details that are easy to get wrong
 *
 * **`aria-hidden`, and it says nothing about tabs.** The icon marks *where* a
 * link goes, not *how* it opens. Most links carrying it replace the page and
 * the back button works, so announcing a new tab would announce something that
 * does not happen; where one genuinely does open, `ExternalLink` below adds the
 * warning as visually-hidden text beside it.
 *
 * **Margin, not a space.** The gap is `ml-1` and the caller writes no
 * whitespace before this element, so there is no break opportunity between the
 * label's last word and the icon. Inside a sentence - the submit blocks put
 * links mid-paragraph - a literal space would let the icon wrap onto a line of
 * its own, orphaned from the link it belongs to.
 *
 * The alignment is a negative baseline offset rather than `align-middle`, which
 * sits an icon of this size visibly high against the text it follows.
 */
export function ExternalIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="ml-1 inline-block size-3 shrink-0 align-[-0.1em]"
    >
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

/**
 * An external link that opens in a new tab, with the icon and the warning.
 *
 * For the outbound links on the two submission pages, where the reader is
 * halfway through a set of numbered steps: sending them to GitHub in the same
 * tab replaces the instructions they are following, and the way back is a
 * button they have to think to press.
 *
 * The visually-hidden note is not optional politeness. Taking over the back
 * button without warning is the substance of WCAG 3.2.5, and a sighted reader
 * gets that warning from the icon. `rel="noreferrer"` also covers `noopener`,
 * which is the one that matters: a `target="_blank"` page can otherwise reach
 * back through `window.opener`.
 */
export function ExternalLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children}
      <ExternalIcon />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
