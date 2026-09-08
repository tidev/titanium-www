'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * The docs rail as a layer on a phone, and the rail itself above `lg`.
 *
 * Below `lg` the guides tree used to stack above the article, so every docs
 * page opened on about forty rows of navigation and the reader scrolled past
 * the whole IA to reach the first paragraph. This puts it behind a "Menu"
 * control instead.
 *
 * ## One copy of the tree
 *
 * The obvious build - a drawer for phones beside the existing rail for desktop -
 * renders the nav twice. That is the arrangement `ApiNav` measured at +58 kB a
 * page and refused, and here it would also duplicate `guide-api-toggle`: two
 * checkboxes sharing an id, so the label opens whichever the parser saw first.
 * So the tree is rendered once, inside the dialog, and above `lg` every wrapper
 * around it - this element included - collapses to `display: contents`. No box,
 * no styles, nothing between the grid and the `<aside>`: desktop lays out
 * exactly as it did before, which is why none of the rail's own classes moved.
 *
 * The dialog is deliberately given no `open:` display rule. `dialog[open]`
 * already resolves to block from the UA sheet, and a `.open\:flex` class would
 * outrank `lg:contents` on specificity - media queries add none - and strand a
 * modal in the sidebar column. The column layout comes from the wrapper inside.
 *
 * Native <dialog> rather than a hand-rolled drawer, for the reasons `MobileNav`
 * gives: showModal() traps focus, handles Esc, and makes the page inert.
 *
 * ## Known cost
 *
 * A closed dialog held at `display: contents` still reaches the accessibility
 * tree as a `dialog` node wrapping the rail above `lg` - measured in Chrome's
 * tree, and not removable from there: `role="none"` is dropped on this element
 * (`role="group"` applies, so it is the presentational role specifically that
 * Chrome refuses) and `aria-hidden` would take the nav with it. The way out is
 * to render the wrapper only below `lg`, which means the server - which cannot
 * know the width - has to render the rail inline and let hydration move it,
 * shifting the article down on every phone load. A stray node on desktop was
 * judged the smaller harm; revisit if a reader reports otherwise.
 */
export function DocsNavDrawer({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function close() {
    ref.current?.close();
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onClose = () => setOpen(false);
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, []);

  // Following a link inside the layer navigates without unmounting the dialog,
  // which would otherwise leave the reader holding the menu they just used
  // over the page they asked for. Closing an already-closed dialog, as on the
  // first render, does nothing.
  useEffect(() => {
    ref.current?.close();
  }, [pathname]);

  // Widening past `lg` turns the layer back into the column it lives in. A
  // modal left open across that line would hold focus and keep the article
  // inert while the rail sat visible beside it, with the control that closes
  // it display:none - a trap you can only leave with Esc.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 64rem)');
    const onChange = () => {
      if (mq.matches) ref.current?.close();
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="docs-nav-drawer"
        onClick={() => {
          ref.current?.showModal();
          setOpen(true);
        }}
        className="mb-6 flex cursor-pointer items-center gap-2 self-start rounded-md border border-border px-3 py-2 text-sm font-medium hover:text-link focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus lg:hidden"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          className="size-5"
          aria-hidden="true"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        Menu
      </button>

      <dialog
        id="docs-nav-drawer"
        ref={ref}
        aria-label="Documentation"
        // Clicking the backdrop resolves to the dialog element itself.
        onClick={(e) => {
          if (e.target === ref.current) close();
        }}
        className="m-0 h-dvh max-h-dvh w-[min(20rem,85vw)] max-w-none bg-surface p-0 text-text backdrop:bg-black/50 lg:contents"
      >
        <div className="flex h-full flex-col lg:contents">
          <div className="flex items-center justify-between border-b border-border px-5 py-4 lg:hidden">
            <span className="text-sm font-medium text-text-muted">Menu</span>
            <button
              type="button"
              onClick={close}
              aria-label="Close menu"
              className="grid size-9 cursor-pointer place-items-center rounded-md text-text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                className="size-5"
                aria-hidden="true"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* The rail scrolls itself above `lg`; on a phone it is a plain block,
              so the scroll has to live here. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 lg:contents">{children}</div>
        </div>
      </dialog>
    </>
  );
}
