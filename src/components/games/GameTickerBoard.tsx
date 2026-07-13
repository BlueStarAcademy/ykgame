"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  TICKER_LEFT_PAUSE_MS,
  TICKER_SCROLL_SPEED_DEFAULT,
} from "@/lib/ticker-constants";

type TickerFeedItem = {
  id: string;
  kind: "notice" | "coupon" | "practice";
  message: string;
  createdAt: string | null;
};

const POLL_MS = 12_000;
const FALLBACK_MESSAGE = "YK건기 시뮬레이션에 오신 것을 환영합니다.";

type Phase = "enter" | "pause" | "exit" | "waitMeasure";

function TickerMarquee({
  messages,
  scrollSpeedPx,
}: {
  messages: string[];
  scrollSpeedPx: number;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLSpanElement>(null);
  const [index, setIndex] = useState(0);

  const safeMessages = messages.length > 0 ? messages : [FALLBACK_MESSAGE];
  const message = safeMessages[index % safeMessages.length] ?? FALLBACK_MESSAGE;

  const messagesRef = useRef(safeMessages);
  const speedRef = useRef(scrollSpeedPx);
  const indexRef = useRef(0);
  const phaseRef = useRef<Phase>("waitMeasure");
  const posRef = useRef(0);
  const targetEnterRef = useRef(0);
  const targetExitRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const needsMeasureRef = useRef(true);

  useEffect(() => {
    messagesRef.current = safeMessages;
  }, [safeMessages]);

  useEffect(() => {
    speedRef.current = Math.max(1, scrollSpeedPx);
  }, [scrollSpeedPx]);

  /** Apply position via DOM — avoid setState every frame (causes jank). */
  const applyX = (x: number) => {
    const item = itemRef.current;
    if (!item) return;
    item.style.transform = `translate3d(${x}px,0,0)`;
  };

  const startMessageFromRight = () => {
    const viewport = viewportRef.current;
    const item = itemRef.current;
    if (!viewport || !item) return false;
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = null;
    }
    const containerWidth = viewport.clientWidth;
    const textWidth = Math.max(1, item.offsetWidth);
    targetEnterRef.current = 0;
    targetExitRef.current = -textWidth;
    posRef.current = containerWidth;
    phaseRef.current = "enter";
    lastTsRef.current = null;
    needsMeasureRef.current = false;
    applyX(posRef.current);
    return true;
  };

  useLayoutEffect(() => {
    if (!needsMeasureRef.current) return;
    startMessageFromRight();
  }, [index, message]);

  useEffect(() => {
    let cancelled = false;
    let rafId = 0;

    const advanceToNext = () => {
      const list = messagesRef.current;
      const next = list.length > 0 ? (indexRef.current + 1) % list.length : 0;
      indexRef.current = next;
      needsMeasureRef.current = true;
      phaseRef.current = "waitMeasure";
      setIndex(next);
    };

    const tick = (ts: number) => {
      if (cancelled) return;

      if (phaseRef.current === "waitMeasure" || phaseRef.current === "pause") {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = Math.min(0.05, (ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;

      posRef.current -= speedRef.current * dt;

      if (phaseRef.current === "enter") {
        if (posRef.current <= targetEnterRef.current) {
          posRef.current = targetEnterRef.current;
          applyX(posRef.current);
          phaseRef.current = "pause";
          lastTsRef.current = null;
          pauseTimerRef.current = setTimeout(() => {
            if (cancelled) return;
            phaseRef.current = "exit";
            lastTsRef.current = null;
          }, TICKER_LEFT_PAUSE_MS);
        } else {
          applyX(posRef.current);
        }
      } else if (phaseRef.current === "exit") {
        if (posRef.current <= targetExitRef.current) {
          posRef.current = targetExitRef.current;
          applyX(posRef.current);
          advanceToNext();
        } else {
          applyX(posRef.current);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    // Kick off first measure + loop.
    needsMeasureRef.current = true;
    startMessageFromRight();
    rafId = requestAnimationFrame(tick);

    const onResize = () => {
      needsMeasureRef.current = true;
      startMessageFromRight();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      window.removeEventListener("resize", onResize);
    };
    // Mount once; speed/messages via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={viewportRef} className="yanmar-game-ticker-viewport">
      <span ref={itemRef} className="yanmar-game-ticker-item">
        {message}
      </span>
    </div>
  );
}

export function GameTickerBoard({
  includePractice = false,
}: {
  includePractice?: boolean;
}) {
  const [items, setItems] = useState<TickerFeedItem[]>([]);
  const [scrollSpeedPx, setScrollSpeedPx] = useState(
    TICKER_SCROLL_SPEED_DEFAULT,
  );

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/ticker${includePractice ? "?practice=1" : ""}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as {
          items?: TickerFeedItem[];
          scrollSpeedPx?: number;
        };
        if (!cancelled) {
          setItems(Array.isArray(data.items) ? data.items : []);
          if (
            typeof data.scrollSpeedPx === "number" &&
            Number.isFinite(data.scrollSpeedPx)
          ) {
            setScrollSpeedPx(data.scrollSpeedPx);
          }
        }
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) {
          timer = setTimeout(() => {
            void load();
          }, POLL_MS);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [includePractice]);

  const messages = useMemo(() => {
    const list = items.map((item) => item.message).filter(Boolean);
    return list.length > 0 ? list : [FALLBACK_MESSAGE];
  }, [items]);

  return (
    <div
      className="yanmar-game-ticker shrink-0"
      aria-live="polite"
      aria-label="전광판"
    >
      <TickerMarquee messages={messages} scrollSpeedPx={scrollSpeedPx} />
    </div>
  );
}
