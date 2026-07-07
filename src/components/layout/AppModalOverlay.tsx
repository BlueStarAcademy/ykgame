"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

interface AppModalOverlayProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
}

export function AppModalOverlay({ open, onClose, children }: AppModalOverlayProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose?.();
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[320] flex items-center justify-center overflow-y-auto bg-black/55 p-4"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
