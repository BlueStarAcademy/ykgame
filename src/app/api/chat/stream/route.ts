import { auth } from "@/lib/auth";
import {
  CHAT_CHANNEL_MIN,
  CHAT_HEARTBEAT_MS,
  isValidChatChannel,
} from "@/lib/chat-constants";
import { listChatHistory } from "@/lib/chat/messages";
import { heartbeatChatPresence } from "@/lib/chat/presence";
import {
  registerChatListener,
  type ChatBusEvent,
} from "@/lib/chat/pubsub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Disable Next/proxy response buffering for this long-lived stream. */
export const fetchCache = "force-no-store";

function sseEncode(event: string, data: unknown, id?: string): string {
  const lines = [
    ...(id ? [`id: ${id}`] : []),
    `event: ${event}`,
    `data: ${JSON.stringify(data)}`,
    "",
    "",
  ];
  return lines.join("\n");
}

function sseComment(text: string): string {
  return `: ${text}\n\n`;
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }
  if (!session.user.nickname?.trim()) {
    return new Response("Nickname required", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const channelParam = Number(searchParams.get("channel") ?? CHAT_CHANNEL_MIN);
  const connectionId = searchParams.get("connectionId") ?? "";
  const lastEventId =
    request.headers.get("Last-Event-ID") ?? searchParams.get("since") ?? null;

  if (!connectionId || !isValidChatChannel(channelParam)) {
    return new Response("Bad request", { status: 400 });
  }

  const channelRef = { current: channelParam };
  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          closed = true;
        }
      };

      const pushEvent = (event: ChatBusEvent) => {
        if (event.type === "message") {
          send(sseEncode("message", event.message, event.message.id));
        } else if (event.type === "revoke") {
          send(sseEncode("revoke", event, event.messageId));
        } else if (event.type === "presence") {
          send(sseEncode("presence", event));
        }
      };

      cleanup = registerChatListener({
        channel: channelRef.current,
        send: pushEvent,
      });

      void (async () => {
        if (lastEventId) {
          try {
            const missed = await listChatHistory({
              channel: channelRef.current,
              afterId: lastEventId,
              limit: 80,
            });
            for (const message of missed) {
              send(sseEncode("message", message, message.id));
            }
          } catch (error) {
            console.warn("[chat] catch-up failed", error);
          }
        }

        // Immediate bytes so proxies flush headers and start the stream.
        send(sseComment(`connected ${Date.now()}`));
        send(
          sseEncode("ready", {
            channel: channelRef.current,
            connectionId,
          }),
        );

        heartbeatTimer = setInterval(() => {
          void (async () => {
            // Railway closes HTTP after 5 minutes with no data — comment + ping.
            send(sseComment(`keepalive ${Date.now()}`));

            const beat = await heartbeatChatPresence({
              userId: session.user.id,
              connectionId,
            });
            if (!beat.ok) {
              send(
                sseEncode("error", {
                  error: beat.reason === "stale" ? "STALE" : "REJOIN",
                }),
              );
              return;
            }
            channelRef.current = beat.channel;
            send(
              sseEncode("ping", {
                t: Date.now(),
                channel: beat.channel,
                memberCount: beat.count,
              }),
            );
          })();
        }, CHAT_HEARTBEAT_MS);
      })();

      request.signal.addEventListener("abort", () => {
        closed = true;
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        cleanup?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
    cancel() {
      closed = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      cleanup?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      // Discourage intermediary compression of the live stream.
      "Content-Encoding": "identity",
    },
  });
}
