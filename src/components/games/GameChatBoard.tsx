"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { AppModalOverlay } from "@/components/layout/AppModalOverlay";
import {
  CHAT_BODY_MAX_LENGTH,
  CHAT_CHANNEL_CAPACITY,
  CHAT_CHANNEL_MAX,
  CHAT_CHANNEL_MIN,
  CHAT_COOLDOWN_MS,
  CHAT_SSE_MAX_MS,
} from "@/lib/chat-constants";
import type {
  ChatGearSnapshot,
  ChatNotice,
  ChatWireMessage,
} from "@/lib/chat/types";
import { GearIconCell } from "@/games/yanmar/GearIconCell";
import { type GearSlot, type ItemGrade } from "@/games/yanmar/gearCatalog";
import { gearGradeLabel, gearSlotLabel } from "@/i18n/yanmarCatalog";

type JoinResponse = {
  connectionId: string;
  channel: number;
  memberCount: number;
  capacity: number;
  notices: ChatNotice[];
  messages: ChatWireMessage[];
  error?: string;
};

const CHAT_EMOJIS = ["😀", "😄", "😂", "😍", "🥳", "👍", "👏", "🔥", "💪", "🎉"];

function formatPreview(
  message: ChatWireMessage | null,
  notice: ChatNotice | null,
  noNotices: string,
  anonymous: string,
): string {
  if (!message) return notice?.message ?? noNotices;
  const name = message.nickname?.trim() || anonymous;
  return `${name}: ${message.body}`;
}

function ChatGearInspect({
  snapshot,
  onClose,
}: {
  snapshot: ChatGearSnapshot;
  onClose: () => void;
}) {
  const t = useTranslations("shell.chat");
  const catalogT = useTranslations("yanmar");
  const slot = snapshot.slot as GearSlot;
  const grade = snapshot.grade as ItemGrade;
  return (
    <AppModalOverlay open nested onClose={onClose} panelClassName="bg-slate-950 text-amber-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-black">{t("inspectGear")}</h3>
        <button
          type="button"
          className="rounded-lg bg-white/10 px-2 py-1 text-xs"
          onClick={onClose}
        >
          {t("close")}
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <GearIconCell
          slot={slot}
          grade={grade}
          enhanceLevel={snapshot.enhanceLevel}
          size="lg"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">
            {snapshot.nameSnapshot}
            {snapshot.enhanceLevel > 0 ? ` +${snapshot.enhanceLevel}` : ""}
          </p>
          <p className="text-[11px] text-amber-200/80">
            {gearSlotLabel(catalogT, slot)} · {gearGradeLabel(catalogT, grade)}
          </p>
        </div>
      </div>
    </AppModalOverlay>
  );
}

function renderMessageBody(
  message: ChatWireMessage,
  onInspect: (snap: ChatGearSnapshot) => void,
) {
  if (message.kind === "SYSTEM" && message.gearSnapshot) {
    const snap = message.gearSnapshot;
    const name = snap.nameSnapshot;
    const idx = message.body.indexOf(name);
    if (idx >= 0) {
      const before = message.body.slice(0, idx);
      const after = message.body.slice(idx + name.length);
      return (
        <>
          {before}
          <button
            type="button"
            className="font-black text-amber-300 underline decoration-dotted underline-offset-2"
            onClick={() => onInspect(snap)}
          >
            {name}
          </button>
          {after}
        </>
      );
    }
  }
  return message.body;
}

export function GameChatBoard() {
  const t = useTranslations("shell.chat");
  const [open, setOpen] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [channel, setChannel] = useState(CHAT_CHANNEL_MIN);
  const [memberCount, setMemberCount] = useState(0);
  const [notices, setNotices] = useState<ChatNotice[]>([]);
  const [messages, setMessages] = useState<ChatWireMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(true);
  const [sending, setSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [inspect, setInspect] = useState<ChatGearSnapshot | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const lastEventIdRef = useRef<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const latestChat =
    [...messages].reverse().find((message) => message.kind === "USER") ?? null;
  const preview = useMemo(
    () => formatPreview(latestChat, notices[0] ?? null, t("noNotices"), t("anonymous")),
    [latestChat, notices, t],
  );

  const applyJoinPayload = useCallback((data: JoinResponse) => {
    setConnectionId(data.connectionId);
    setChannel(data.channel);
    setMemberCount(data.memberCount ?? 0);
    setNotices(Array.isArray(data.notices) ? data.notices : []);
    const list = Array.isArray(data.messages) ? data.messages : [];
    setMessages(list);
    if (list.length > 0) {
      lastEventIdRef.current = list[list.length - 1]!.id;
    }
  }, []);

  const join = useCallback(
    async (options?: {
      channel?: number;
      mode?: "auto" | "explicit";
      connectionId?: string;
    }) => {
      setJoining(true);
      setError(null);
      try {
        const res = await fetch("/api/chat/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            connectionId: options?.connectionId ?? connectionId ?? undefined,
            channel: options?.channel ?? CHAT_CHANNEL_MIN,
            mode: options?.mode ?? "auto",
          }),
        });
        const data = (await res.json()) as JoinResponse;
        if (!res.ok) {
          setError(
            data.error === "ALL_CHANNELS_FULL"
              ? t("allChannelsFull")
              : data.error === "CHANNEL_FULL"
                ? t("channelFull")
                : data.error === "UNAVAILABLE"
                  ? t("unavailable")
                  : t("joinFailed"),
          );
          return false;
        }
        applyJoinPayload(data);
        return true;
      } catch {
        setError(t("joinFailed"));
        return false;
      } finally {
        setJoining(false);
      }
    },
    [applyJoinPayload, connectionId, t],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void join({ channel: CHAT_CHANNEL_MIN, mode: "auto" });
    }, 0);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- mount once

  useEffect(() => {
    return () => {
      const id = connectionId;
      if (!id) return;
      void fetch("/api/chat/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId: id }),
        keepalive: true,
      });
    };
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId) return;

    let cancelled = false;
    let es: EventSource | null = null;
    let recycleTimer: ReturnType<typeof setTimeout> | null = null;

    const openStream = () => {
      if (cancelled) return;
      const params = new URLSearchParams({
        channel: String(channel),
        connectionId,
      });
      if (lastEventIdRef.current) {
        params.set("since", lastEventIdRef.current);
      }

      es?.close();
      es = new EventSource(`/api/chat/stream?${params.toString()}`);

      es.addEventListener("message", (ev) => {
        if (cancelled) return;
        try {
          const message = JSON.parse(ev.data) as ChatWireMessage;
          lastEventIdRef.current = message.id;
          setMessages((prev) => {
            if (prev.some((m) => m.id === message.id)) return prev;
            return [...prev, message].slice(-200);
          });
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("revoke", (ev) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(ev.data) as { messageId: string };
          setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("ping", (ev) => {
        if (cancelled) return;
        try {
          const payload = JSON.parse(ev.data) as {
            memberCount?: number;
            channel?: number;
          };
          if (typeof payload.memberCount === "number") {
            setMemberCount(payload.memberCount);
          }
        } catch {
          /* ignore */
        }
      });

      es.addEventListener("error", (ev) => {
        if (cancelled) return;
        // Named SSE "error" events carry JSON; connection errors have empty data.
        const messageEvent = ev as MessageEvent<string>;
        if (typeof messageEvent.data === "string" && messageEvent.data) {
          try {
            const payload = JSON.parse(messageEvent.data) as { error?: string };
            if (payload.error === "STALE" || payload.error === "REJOIN") {
              void join({
                channel,
                mode: "auto",
                connectionId,
              });
            }
          } catch {
            /* ignore */
          }
        }
      });
    };

    openStream();
    // Recycle before Railway's 15-minute HTTP max duration.
    recycleTimer = setInterval(() => {
      openStream();
    }, CHAT_SSE_MAX_MS);

    return () => {
      cancelled = true;
      if (recycleTimer) clearInterval(recycleTimer);
      es?.close();
    };
  }, [connectionId, channel, join]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      return;
    }
    const tick = () => {
      setCooldownLeft(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const onChannelChange = async (next: number) => {
    if (next === channel) return;
    await join({
      channel: next,
      mode: "explicit",
      connectionId: connectionId ?? undefined,
    });
  };

  const send = async () => {
    if (sending || cooldownLeft > 0) return;
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = (await res.json()) as {
        message?: ChatWireMessage;
        error?: string;
      };
      if (!res.ok) {
        if (data.error === "COOLDOWN") {
          setCooldownUntil(Date.now() + CHAT_COOLDOWN_MS);
          setError(t("cooldownError", { seconds: CHAT_COOLDOWN_MS / 1000 }));
        } else if (data.error === "NO_CHANNEL") {
          setError(t("rejoinChannel"));
          void join({ channel, mode: "auto", connectionId: connectionId ?? undefined });
        } else {
          setError(t("sendFailed"));
        }
        return;
      }
      setDraft("");
      setCooldownUntil(Date.now() + CHAT_COOLDOWN_MS);
      if (data.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message!.id)) return prev;
          return [...prev, data.message!].slice(-200);
        });
        lastEventIdRef.current = data.message.id;
      }
    } catch {
      setError(t("sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const insertEmoji = (emoji: string) => {
    const input = inputRef.current;
    const start = input?.selectionStart ?? draft.length;
    const end = input?.selectionEnd ?? draft.length;
    const next = `${draft.slice(0, start)}${emoji}${draft.slice(end)}`.slice(
      0,
      CHAT_BODY_MAX_LENGTH,
    );
    setDraft(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      const caret = Math.min(start + emoji.length, CHAT_BODY_MAX_LENGTH);
      input?.setSelectionRange(caret, caret);
    });
  };

  const channelOptions = useMemo(
    () =>
      Array.from(
        { length: CHAT_CHANNEL_MAX - CHAT_CHANNEL_MIN + 1 },
        (_, i) => CHAT_CHANNEL_MIN + i,
      ),
    [],
  );

  return (
    <>
      <button
        type="button"
        className="yanmar-game-ticker yanmar-game-chat-bar shrink-0"
        aria-label={t("openAriaLabel")}
        onClick={() => setOpen(true)}
      >
        <span className="yanmar-game-chat-bar-channel">Ch.{channel}</span>
        <span className="yanmar-game-chat-bar-text">{preview}</span>
      </button>

      <AppModalOverlay
        open={open}
        onClose={() => setOpen(false)}
        panelClassName="yanmar-chat-modal-panel !h-[80dvh] !max-h-[80dvh] max-w-[min(94vw,42rem)] bg-[#16110e] text-amber-50"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-amber-500/25 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black">{t("title")}</h2>
              <button
                type="button"
                className="rounded-lg bg-white/10 px-2 py-1 text-xs"
                onClick={() => setOpen(false)}
              >
                {t("close")}
              </button>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-rose-300">
              {t("warning")}
            </p>
            <div className="yanmar-chat-notice-marquee mt-2" aria-label={t("noticesAriaLabel")}>
              {notices.length === 0 ? (
                <p className="yanmar-chat-notice-marquee-item text-amber-200/60">
                  {t("noNotices")}
                </p>
              ) : (
                <div className="yanmar-chat-notice-marquee-track">
                  {[...notices, ...notices].map((n, index) => (
                    <span key={`${n.id}-${index}`} className="yanmar-chat-notice-marquee-item">
                      {n.message}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <label className="text-[11px] text-amber-200/80" htmlFor="chat-channel">
                {t("channel")}
              </label>
              <select
                id="chat-channel"
                className="rounded-md border border-amber-500/30 bg-black/40 px-2 py-1 text-xs"
                value={channel}
                disabled={joining}
                onChange={(e) => void onChannelChange(Number(e.target.value))}
              >
                {channelOptions.map((ch) => (
                  <option key={ch} value={ch}>
                    {t("channelOption", { channel: ch })}
                  </option>
                ))}
              </select>
              <span className="text-[11px] tabular-nums text-amber-200/70">
                {memberCount}/{CHAT_CHANNEL_CAPACITY}
              </span>
            </div>
          </div>

          <div
            ref={listRef}
            className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-2"
            role="log"
            aria-live="polite"
          >
            {messages.length === 0 ? (
              <p className="text-[11px] text-amber-200/50">{t("noMessages")}</p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`text-[12px] leading-snug ${
                    m.kind === "SYSTEM"
                      ? "text-sky-200"
                      : "text-amber-50"
                  }`}
                >
                  {m.kind === "USER" ? (
                    <span className="font-bold text-amber-300">
                      {m.nickname ?? t("anonymous")}:{" "}
                    </span>
                  ) : null}
                  {renderMessageBody(m, setInspect)}
                </div>
              ))
            )}
          </div>

          <div className="border-t border-amber-500/25 px-3 py-2">
            {error ? (
              <p className="mb-1 text-[11px] text-rose-300">{error}</p>
            ) : null}
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label={t("emojiPickerAriaLabel")}
                  aria-expanded={emojiOpen}
                  disabled={sending || joining || cooldownLeft > 0}
                  className="rounded-lg border border-amber-500/30 bg-black/35 px-2 py-1.5 text-sm disabled:opacity-40"
                  onClick={() => setEmojiOpen((value) => !value)}
                >
                  😊
                </button>
                {emojiOpen ? (
                  <div className="absolute bottom-full left-0 z-10 mb-2 grid w-40 grid-cols-5 gap-1 rounded-lg border border-amber-500/30 bg-[#24170f] p-1.5 shadow-xl">
                    {CHAT_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="rounded p-1 text-base hover:bg-white/10"
                        onClick={() => insertEmoji(emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <input
                ref={inputRef}
                type="text"
                value={draft}
                maxLength={CHAT_BODY_MAX_LENGTH}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={
                  cooldownLeft > 0
                    ? t("inputAvailableAfter", { seconds: cooldownLeft })
                    : t("messagePlaceholder")
                }
                disabled={sending || joining || cooldownLeft > 0}
                className="min-w-0 flex-1 rounded-lg border border-amber-500/30 bg-black/35 px-2 py-1.5 text-xs outline-none focus:border-amber-400"
              />
              <button
                type="submit"
                disabled={
                  sending || joining || cooldownLeft > 0 || !draft.trim()
                }
                className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-black text-slate-950 disabled:opacity-40"
              >
                {t("send")}
              </button>
            </form>
          </div>
        </div>
      </AppModalOverlay>

      {inspect ? (
        <ChatGearInspect snapshot={inspect} onClose={() => setInspect(null)} />
      ) : null}
    </>
  );
}

/** @deprecated Use GameChatBoard — kept as alias during migration. */
export function GameTickerBoard(_props?: { includePractice?: boolean }) {
  void _props;
  return <GameChatBoard />;
}
