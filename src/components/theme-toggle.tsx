'use client';

import { useEffect, useRef, useState } from 'react';

type Theme = 'light' | 'system' | 'dark';

const OPTIONS: { value: Theme; label: string; icon: React.ReactNode }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </>
    ),
  },
  {
    value: 'system',
    label: 'System',
    icon: (
      <>
        <rect x="2" y="4" width="20" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </>
    ),
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <path d="M20 14a8 8 0 1 1-9.9-9.9 7 7 0 0 0 9.9 9.9Z" />,
  },
];

/**
 * Three states, not a two-way switch.
 *
 * "system" is represented by the *absence* of a stored value, matching the
 * pre-paint script in layout.tsx and the CSS, which falls back to
 * prefers-color-scheme when no data-theme attribute is set. Storing the
 * literal string "system" would leave an attribute no rule matches.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');
  // The server cannot know the stored theme, so nothing is marked active
  // until after hydration. Avoids a mismatch and a flash of wrong selection.
  const [ready, setReady] = useState(false);
  const group = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    setTheme(stored === 'light' || stored === 'dark' ? stored : 'system');
    setReady(true);
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    const root = document.documentElement;
    if (next === 'system') {
      localStorage.removeItem('theme');
      delete root.dataset.theme;
    } else {
      localStorage.setItem('theme', next);
      root.dataset.theme = next;
    }
  }

  /**
   * Arrow keys move the selection, the way a radio group is expected to.
   *
   * Calling it a `radiogroup` is a promise about how it behaves, and three
   * plain buttons under that role kept none of it: every one was its own tab
   * stop, and the arrow keys did nothing. Native radios have this for free -
   * `.prose-docs .tab-radio` keeps its inputs on screen rather than
   * `display: none` for exactly that reason - but these carry an icon and a
   * pressed shape a native input cannot, so the behaviour is written out.
   *
   * Wrapping rather than stopping at the ends, and moving selection with focus,
   * both follow the ARIA authoring practices for the pattern.
   */
  function onKeyDown(event: React.KeyboardEvent) {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    let next: Theme | undefined;
    if (step) {
      const at = OPTIONS.findIndex((o) => o.value === theme);
      next = OPTIONS[(at + step + OPTIONS.length) % OPTIONS.length]?.value;
    } else if (event.key === 'Home') {
      next = OPTIONS[0]?.value;
    } else if (event.key === 'End') {
      next = OPTIONS[OPTIONS.length - 1]?.value;
    }
    if (!next) return;
    event.preventDefault();
    choose(next);
    // Focus follows selection, so the next arrow press moves on from here.
    group.current?.querySelector<HTMLButtonElement>(`[data-theme-option="${next}"]`)?.focus();
  }

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label="Color theme"
      onKeyDown={onKeyDown}
      className="inline-flex items-center gap-0.5 rounded-full border border-border p-0.5"
    >
      {OPTIONS.map((o) => {
        const active = ready && theme === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.label}
            title={o.label}
            data-theme-option={o.value}
            /* One tab stop for the group, not three: Tab reaches the control
               and the arrows move within it. Keyed off `theme` rather than
               `active` so the stop exists before hydration too, where `ready`
               is false and the server has already rendered "system". */
            tabIndex={theme === o.value ? 0 : -1}
            onClick={() => choose(o.value)}
            className={`grid size-7 place-items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              active ? 'bg-surface-raised text-text' : 'text-text-subtle hover:text-text'
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
              aria-hidden="true"
            >
              {o.icon}
            </svg>
          </button>
        );
      })}
    </div>
  );
}
