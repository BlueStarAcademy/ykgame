import { createClient } from "redis";
import { getRedisConfig } from "@/lib/redis-config";
import { chatPubSubChannel } from "@/lib/redis-keys";
import { runRedisCommand } from "@/lib/redis";
import type { ChatGearSnapshot, ChatWireMessage } from "@/lib/chat/types";

export type ChatBusEvent =
  | { type: "message"; message: ChatWireMessage }
  | { type: "revoke"; messageId: string; channel: number | null }
  | { type: "presence"; channel: number; count: number };

type LocalListener = {
  id: string;
  channel: number;
  send: (event: ChatBusEvent) => void;
};

type SubscriberClient = {
  isReady: boolean;
  connect: () => Promise<unknown>;
  quit: () => Promise<unknown>;
  destroy: () => void;
  subscribe: (
    channel: string,
    listener: (message: string) => void,
  ) => Promise<unknown>;
  on: (event: "error", listener: (error: Error) => void) => unknown;
};

type ChatBusRuntime = {
  listeners: Map<string, LocalListener>;
  subscriber?: SubscriberClient;
  subscribePromise?: Promise<void>;
  subscribedTopic?: string;
};

const globalChat = globalThis as typeof globalThis & {
  __ykgameChatBus?: ChatBusRuntime;
};

function runtime(): ChatBusRuntime {
  if (!globalChat.__ykgameChatBus) {
    globalChat.__ykgameChatBus = { listeners: new Map() };
  }
  return globalChat.__ykgameChatBus;
}

const recentEventKeys = new Set<string>();

function eventDedupeKey(event: ChatBusEvent): string {
  if (event.type === "message") return `m:${event.message.id}`;
  if (event.type === "revoke") return `r:${event.messageId}`;
  return `p:${event.channel}:${event.count}`;
}

function fanOut(event: ChatBusEvent) {
  const key = eventDedupeKey(event);
  if (recentEventKeys.has(key)) return;
  recentEventKeys.add(key);
  setTimeout(() => recentEventKeys.delete(key), 5_000);

  const rt = runtime();
  for (const listener of rt.listeners.values()) {
    if (event.type === "message") {
      const ch = event.message.channel;
      if (ch == null || ch === listener.channel) {
        listener.send(event);
      }
    } else if (event.type === "revoke") {
      if (event.channel == null || event.channel === listener.channel) {
        listener.send(event);
      }
    } else if (event.type === "presence") {
      if (event.channel === listener.channel) {
        listener.send(event);
      }
    }
  }
}

async function ensureSubscriber(): Promise<void> {
  const config = getRedisConfig();
  if (!config.enabled || !config.url) return;

  const rt = runtime();
  if (rt.subscriber?.isReady && rt.subscribedTopic) return;
  if (rt.subscribePromise) return rt.subscribePromise;

  rt.subscribePromise = (async () => {
    try {
      if (rt.subscriber) {
        try {
          await rt.subscriber.quit();
        } catch {
          try {
            rt.subscriber.destroy();
          } catch {
            /* ignore */
          }
        }
        rt.subscriber = undefined;
        rt.subscribedTopic = undefined;
      }

      const client = createClient({
        url: config.url,
        socket: {
          connectTimeout: config.connectTimeoutMs,
          reconnectStrategy(retries) {
            if (retries >= Math.max(config.reconnectAttempts, 20)) {
              return false;
            }
            return Math.min(100 * 2 ** retries, 2_000);
          },
        },
      });
      client.on("error", (error) => {
        console.warn(
          JSON.stringify({
            event: "chat_pubsub_error",
            errorName: error instanceof Error ? error.name : "Error",
          }),
        );
      });
      await client.connect();
      const topic = chatPubSubChannel(config.prefix);
      await client.subscribe(topic, (payload) => {
        try {
          const parsed = JSON.parse(payload) as ChatBusEvent;
          fanOut(parsed);
        } catch (error) {
          console.warn("[chat] invalid pubsub payload", error);
        }
      });
      rt.subscriber = client;
      rt.subscribedTopic = topic;
    } catch (error) {
      console.warn("[chat] subscriber connect failed", error);
      rt.subscriber = undefined;
      rt.subscribedTopic = undefined;
    } finally {
      rt.subscribePromise = undefined;
    }
  })();

  return rt.subscribePromise;
}

export function registerChatListener(options: {
  channel: number;
  send: (event: ChatBusEvent) => void;
}): () => void {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const rt = runtime();
  rt.listeners.set(id, { id, channel: options.channel, send: options.send });
  void ensureSubscriber();

  return () => {
    rt.listeners.delete(id);
  };
}

export async function publishChatEvent(event: ChatBusEvent): Promise<void> {
  // Always fan-out locally so single-process / missing Redis still works for
  // same-instance listeners; Redis extends to other replicas.
  fanOut(event);

  const config = getRedisConfig();
  if (!config.enabled) return;

  const topic = chatPubSubChannel(config.prefix);
  await runRedisCommand("chat_publish", (client) =>
    client.publish(topic, JSON.stringify(event)),
  );
}

export type { ChatGearSnapshot, ChatWireMessage };
