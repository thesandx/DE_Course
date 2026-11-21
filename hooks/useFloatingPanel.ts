'use client';

import { useEffect, useRef } from 'react';

/**
 * Keeps the page's floating panels from stacking on top of each other.
 *
 * Pip and the chapter notes both open a panel in the same corner. When one
 * opens, it announces itself on `window`, and every other panel closes. The
 * panels share no state and no parent, so an event is the smallest link.
 */

const EVENT = 'floating-panel:open';

export function useFloatingPanel(name: string, open: boolean, close: () => void): void {
  const closeRef = useRef(close);

  useEffect(() => {
    closeRef.current = close;
  }, [close]);

  useEffect(() => {
    function onOpen(event: Event) {
      if (event instanceof CustomEvent && event.detail !== name) closeRef.current();
    }
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, [name]);

  useEffect(() => {
    if (open) window.dispatchEvent(new CustomEvent(EVENT, { detail: name }));
  }, [name, open]);
}
