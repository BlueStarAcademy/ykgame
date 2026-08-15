"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRegisterInGameBackDismiss } from "@/hooks/useInGameBackNavigation";

/**
 * HUD buttons open modals on pointerdown so they work during travel drag.
 * The same press then synthesizes a click on whatever appears under the
 * finger (e.g. gear equip BUCKET slot). Ignore panel input briefly so that
 * trailing click cannot activate content or close via the backdrop.
 */
const OPEN_GHOST_CLICK_GUARD_MS = 350;

interface AppModalOverlayProps {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  /** Extra classes on the dialog panel (width/height overrides). */
  panelClassName?: string;
  /**
   * Stack above an already-open modal. Uses a higher z-index and captures
   * Escape so the underlying modal does not close at the same time.
   */
  nested?: boolean;
}

export function AppModalOverlay({
  open,
  onClose,
  children,
  panelClassName = "",
  nested = false,
}: AppModalOverlayProps) {
  const [inputReady, setInputReady] = useState(false);

  useRegisterInGameBackDismiss(open, onClose);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (nested) e.stopImmediatePropagation();
      onClose?.();
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown, nested);

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown, nested);
    };
  }, [open, onClose, nested]);

  useEffect(() => {
    if (!open) {
      setInputReady(false);
      return;
    }
    setInputReady(false);
    const id = window.setTimeout(() => setInputReady(true), OPEN_GHOST_CLICK_GUARD_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 flex items-start justify-center overflow-y-auto overscroll-contain bg-black/55 p-3 [-webkit-overflow-scrolling:touch] [touch-action:pan-y] sm:items-center sm:p-4 ${
        nested ? "z-[340]" : "z-[320]"
      }`}
      onClick={
        inputReady
          ? onClose
          : (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
      }
    >
      <div
        className={`my-auto max-h-[min(92dvh,40rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-2xl [-webkit-overflow-scrolling:touch] [touch-action:pan-y] landscape:max-h-[min(94dvh,24rem)] ${panelClassName}`.trim()}
        style={inputReady ? undefined : { pointerEvents: "none" }}
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
