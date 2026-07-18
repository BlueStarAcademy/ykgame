"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";

type DismissFn = () => void;

type StackEntry = {
  id: string;
  dismiss: DismissFn;
};

type InGameBackContextValue = {
  register: (id: string, dismiss: DismissFn) => () => void;
};

const InGameBackContext = createContext<InGameBackContextValue | null>(null);

const HISTORY_FLAG = "ykgameInGameBack";

function isOurHistoryState(state: unknown): boolean {
  return (
    typeof state === "object" &&
    state !== null &&
    (state as { [HISTORY_FLAG]?: unknown })[HISTORY_FLAG] === true
  );
}

/**
 * Intercepts the phone/browser back button while in-game.
 * Open modals dismiss in LIFO order; with none open, `onEmptyBack` runs
 * (same path as 「게임 저장 후 종료」).
 *
 * Return `false` from `onEmptyBack` to skip re-arming the history trap
 * (e.g. when navigating away to another route).
 */
export function InGameBackProvider({
  active,
  onEmptyBack,
  children,
}: {
  active: boolean;
  onEmptyBack: () => boolean | void;
  children: ReactNode;
}) {
  const stackRef = useRef<StackEntry[]>([]);
  const onEmptyBackRef = useRef(onEmptyBack);
  onEmptyBackRef.current = onEmptyBack;

  const register = useCallback((id: string, dismiss: DismissFn) => {
    stackRef.current = stackRef.current.filter((entry) => entry.id !== id);
    stackRef.current.push({ id, dismiss });
    return () => {
      stackRef.current = stackRef.current.filter((entry) => entry.id !== id);
    };
  }, []);

  useEffect(() => {
    if (!active) {
      stackRef.current = [];
      return;
    }

    let armed = true;
    const trapState = { [HISTORY_FLAG]: true } as const;
    window.history.pushState(trapState, "");

    const onPopState = () => {
      if (!armed) return;

      const stack = stackRef.current;
      if (stack.length > 0) {
        const top = stack.pop();
        top?.dismiss();
        window.history.pushState(trapState, "");
        return;
      }

      const shouldRearm = onEmptyBackRef.current();
      if (shouldRearm !== false) {
        window.history.pushState(trapState, "");
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      armed = false;
      window.removeEventListener("popstate", onPopState);
      stackRef.current = [];
      if (isOurHistoryState(window.history.state)) {
        window.history.back();
      }
    };
  }, [active]);

  return (
    <InGameBackContext.Provider value={{ register }}>
      {children}
    </InGameBackContext.Provider>
  );
}

/**
 * While `open`, registers `onClose` so the in-game back button closes this
 * surface before older ones / before save-and-exit. No-op outside the provider.
 */
export function useRegisterInGameBackDismiss(
  open: boolean,
  onClose: (() => void) | undefined,
) {
  const ctx = useContext(InGameBackContext);
  const id = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const hasClose = Boolean(onClose);

  useEffect(() => {
    if (!open || !hasClose || !ctx) return;
    return ctx.register(id, () => {
      onCloseRef.current?.();
    });
  }, [open, hasClose, ctx, id]);
}
