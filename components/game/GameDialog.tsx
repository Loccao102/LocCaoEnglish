"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Every game overlay owns keyboard focus; world controls remain suspended underneath. */
export default function GameDialog({ title, children, onClose, className = "", hidden = false }: {
  title: string; children: ReactNode; onClose?: () => void; className?: string; hidden?: boolean;
}) {
  const id = useId(), root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hidden) return;
    const previous = document.activeElement as HTMLElement | null;
    const node = root.current;
    const selector = 'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]';
    (node?.querySelector<HTMLElement>(selector) || node)?.focus();
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !node) return;
      const elements = [...node.querySelectorAll<HTMLElement>(selector)].filter(el => el.getClientRects().length);
      const first = elements[0], last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); node.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    node?.addEventListener("keydown", trap);
    return () => { node?.removeEventListener("keydown", trap); if (previous?.isConnected) previous.focus(); };
  }, [hidden, title]);
  return <div className="adventure-scrim" hidden={hidden}><div ref={root} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1} className={`adventure-dialog ${className}`}>
    <header className="dialog-heading"><h2 id={id}>{title}</h2>{onClose && <button className="game-icon-button" onClick={onClose} aria-label={`Close ${title}`}>×</button>}</header>
    {children}
  </div></div>;
}
