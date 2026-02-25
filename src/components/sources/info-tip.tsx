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
        className={`inline-flex items-center text-[11px] text-zinc-500 hover:text-zinc-300 cursor-help ${className ?? ''}`}
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
            className="fixed z-[90] max-w-xs -translate-x-1/2 rounded-lg border border-white/[0.12] bg-zinc-900 px-2.5 py-2 text-[11px] text-zinc-200 shadow-xl pointer-events-none"
            style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
}
