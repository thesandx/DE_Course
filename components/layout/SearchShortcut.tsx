'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export interface SearchShortcutProps {
  /** The course's search page, opened when the top bar has no search box. */
  href: string;
  /** The top bar's search box. The shortcut focuses it when it is on screen. */
  inputId: string;
}

/** True when the key press is for a field, so `/` types a slash there. */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/**
 * ⌘K or Ctrl+K anywhere, or `/` outside a field, opens the course search: it
 * focuses the top bar's box when the box is visible, and opens the search page
 * otherwise. Renders nothing.
 */
export function SearchShortcut({ href, inputId }: SearchShortcutProps) {
  const router = useRouter();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const combo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      const slash =
        event.key === '/' && !event.metaKey && !event.ctrlKey && !isTyping(event.target);
      if (!combo && !slash) return;
      event.preventDefault();
      const box = document.getElementById(inputId);
      if (box instanceof HTMLInputElement && box.offsetParent !== null) box.focus();
      else router.push(href);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [href, inputId, router]);
  return null;
}
