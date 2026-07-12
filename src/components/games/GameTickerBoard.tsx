"use client";

import { useEffect, useMemo, useState } from "react";

type TickerFeedItem = {
  id: string;
  kind: "notice" | "coupon" | "practice";
  message: string;
  createdAt: string | null;
};

const POLL_MS = 12_000;
const FALLBACK_MESSAGE = "YK건기 시뮬레이션에 오신 것을 환영합니다.";

function TickerTrack({ messages }: { messages: string[] }) {
  const loop = messages.length > 0 ? [...messages, ...messages] : [FALLBACK_MESSAGE, FALLBACK_MESSAGE];
  const durationSec = Math.max(18, loop.length * 6);

  return (
    <div
      className="yanmar-game-ticker-track"
      style={{ animationDuration: `${durationSec}s` }}
    >
      {loop.map((message, index) => (
        <span key={`${message}-${index}`} className="yanmar-game-ticker-item">
          {message}
        </span>
      ))}
    </div>
  );
}

export function GameTickerBoard({
  includePractice = false,
}: {
  includePractice?: boolean;
}) {
  const [items, setItems] = useState<TickerFeedItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/ticker${includePractice ? "?practice=1" : ""}`,
          { cache: "no-store" },
        );
        const data = (await res.json()) as { items?: TickerFeedItem[] };
        if (!cancelled) setItems(Array.isArray(data.items) ? data.items : []);
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
      <TickerTrack messages={messages} />
    </div>
  );
}
