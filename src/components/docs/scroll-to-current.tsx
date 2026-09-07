'use client';

import { useEffect, useRef } from 'react';

/**
 * Scrolls a scrolling nav box to whatever it marks as the current page.
 *
 * The API tree is 284 rows, so the branch expanded for you is usually below the
 * fold. Enhancement only: the box is correct without this, just scrolled to the
 * top. It measures against the box rather than calling `scrollIntoView()`,
 * which would drag the document along with it.
 *
 * A component rather than a hook so `GuideNav` can stay a server component and
 * guide pages keep shipping no JavaScript for their sidebar. Rendered only
 * where the tree is - see `ApiNav` for the same effect written inline, which it
 * can afford because it is already a client component.
 */
export function ScrollToCurrent({ within }: { within: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const box = document.querySelector<HTMLElement>(within);
    const current = box?.querySelector('[aria-current="page"]');
    if (!box || !current) return;
    const offset = current.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.scrollTop += offset - box.clientHeight / 2;
  }, [within]);
  return null;
}
