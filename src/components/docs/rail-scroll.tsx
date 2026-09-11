'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useLayoutEffect } from 'react';

/**
 * Keeps a scrolling nav rail where the reader left it.
 *
 * The rails are rendered by pages rather than by a layout, so every navigation
 * remounts them and the browser starts them back at zero. That cannot be fixed
 * by moving them into a layout: `/docs/sdk/[segment]` is a version index under
 * `ApiNav` or a type page under the guides rail, and one layout cannot be two
 * things. So the position is remembered instead.
 *
 * `sessionStorage`, not state: it has to survive a remount, and it should not
 * survive the tab. Wrapped because a locked-down browser throws on the property
 * access itself, and a sidebar is not worth an error boundary.
 *
 * On a first visit there is nothing to restore, and the rail centres whatever
 * it marks as current instead - which for a 284-row tree is usually below the
 * fold. The same jump happens when a restored position leaves the current row
 * out of sight: arriving at the API reference from the header while the rail
 * was left deep in a namespace would otherwise show a sidebar with nothing
 * marked on it. Browsing between neighbours keeps the position, because the
 * next row is already in view and nothing moves.
 */
export function RailScroll({ selector, storageKey }: { selector: string; storageKey: string }) {
  // The pathname is not read; it is the dependency that re-runs this when a
  // navigation reuses the component instead of remounting it.
  const pathname = usePathname();

  // Before paint, so a restored rail does not start at zero and jump. Layout
  // effects do not run on the server, and this renders there.
  const useIsomorphic = typeof window === 'undefined' ? useEffect : useLayoutEffect;

  useIsomorphic(() => {
    const box = document.querySelector<HTMLElement>(selector);
    if (!box) return;

    const saved = read(storageKey);
    if (saved !== null) {
      // Clamped by the browser, which matters: the guides rail is 44 rows on a
      // setup page and 328 with the API tree open, so an offset saved on one
      // is out of range on the other.
      box.scrollTop = saved;
    }

    const current = box.querySelector('[aria-current="page"]');
    if (current) {
      const frame = box.getBoundingClientRect();
      const row = current.getBoundingClientRect();
      const inView = row.top >= frame.top && row.bottom <= frame.bottom;
      if (!inView) box.scrollTop += row.top - frame.top - box.clientHeight / 2;
    }

    // One write per frame at most. A rail scroll fires per pixel otherwise, and
    // sessionStorage writes are synchronous.
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        write(storageKey, box.scrollTop);
      });
    };

    box.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      box.removeEventListener('scroll', onScroll);
      // A navigation can tear the rail down between the last frame and the
      // queued write, so take the position on the way out too. Guarded because
      // a detached element reports 0, and saving that is worse than saving
      // nothing: it is indistinguishable from "scrolled to the top".
      if (box.isConnected) write(storageKey, box.scrollTop);
    };
  }, [selector, storageKey, pathname]);

  return null;
}

function read(key: string): number | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw === null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function write(key: string, value: number) {
  try {
    sessionStorage.setItem(key, String(value));
  } catch {
    // Private mode, or storage disabled. The rail still works.
  }
}
