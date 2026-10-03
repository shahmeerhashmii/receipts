import React, { useEffect, useRef } from 'react';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={sheetRef}
        style={{ display: 'flex', flexDirection: 'column' }}
      >
        <div className="sheet-handle" style={{ flexShrink: 0 }} />
        {title && <div className="sheet-title" style={{ flexShrink: 0 }}>{title}</div>}
        {/* Scrollable content area fills remaining height */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '4px 20px',
          paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}>
          {children}
        </div>
      </div>
    </>
  );
}
