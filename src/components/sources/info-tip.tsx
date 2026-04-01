'use client';

import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

type InfoTipProps = {
  text: string;
  className?: string;
};

export function InfoTip({ text, className }: InfoTipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  const show = useCallback(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.bottom + 6 });
  }, []);

  const hide = useCallback(() => setPos(null), []);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={text}
        className={`inline-flex cursor-help items-center text-[11px] quorum-text-subtle hover:quorum-text-primary ${className ?? ''}`}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => e.stopPropagation()}
      >
        &#9432;
      </button>
      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[90] max-w-xs -translate-x-1/2 rounded-2xl border quorum-border-strong quorum-surface-strong px-3 py-2 text-[11px] quorum-text-primary shadow-[0_24px_70px_rgba(0,0,0,0.35)] backdrop-blur-xl"
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}
