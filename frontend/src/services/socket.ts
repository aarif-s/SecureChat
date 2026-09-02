import { io, type Socket } from "socket.io-client";

import type { Message, ReactionEmoji } from "../types/chat";

const apiBaseUrl = (
  import.meta.env.VITE_API_URL ?? "http://localhost:5000"
).replace(/\/$/, "");

interface ServerToClientEvents {
  "message:new": (message: Message) => void;

  "message:updated": (message: Message) => void;

  "message:deleted": (message: Message) => void;

  "presence:update": (update: {
    userId: string;
    online: boolean;
  }) => void;

  "typing:update": (update: {
    conversationId: string;
    userId: string;
    isTyping: boolean;
  }) => void;

  "message:status": (status: {
    messageId: string;
    conversationId: string;
    deliveredAt: string | null;
    readAt: string | null;
  }) => void;

  "message:reaction": (update: {
    messageId: string;
    conversationId: string;
    emoji: ReactionEmoji;
    userId: string;
    action: "add" | "remove";
    reactions: Array<{
      emoji: ReactionEmoji;
      userIds: string[];
    }>;
  }) => void;
}

interface ClientToServerEvents {
  "conversation:join": (
    payload: { conversationId: string },
    callback: (response: {
      success: boolean;
      error?: string;
    }) => void,
  ) => void;

  "conversation:leave": (
    payload: { conversationId: string },
    callback: (response: {
      success: boolean;
      error?: string;
    }) => void,
  ) => void;

  "message:send": (
    payload: {
      conversationId: string;
      content: string;
    },
    callback: (response: {
      success: boolean;
      error?: string;
      message?: Message;
    }) => void,
  ) => void;

  "message:edit": (
    payload: {
      conversationId: string;
      messageId: string;
      content: string;
    },
    callback: (response: {
      success: boolean;
      error?: string;
      message?: Message;
    }) => void,
  ) => void;

  "message:delete": (
    payload: {
      conversationId: string;
      messageId: string;
    },
    callback: (response: {
      success: boolean;
      error?: string;
      message?: Message;
    }) => void,
  ) => void;

  "typing:start": (
    payload: { conversationId: string },
    callback: (response: {
      success: boolean;
      error?: string;
    }) => void,
  ) => void;

  "typing:stop": (
    payload: { conversationId: string },
    callback: (response: {
      success: boolean;
      error?: string;
    }) => void,
  ) => void;

  "message:delivered": (
    payload: {
      conversationId: string;
      messageId: string;
    },
    callback: (response: {
      success: boolean;
      error?: string;
    }) => void,
  ) => void;

  "message:read": (
    payload: {
      conversationId: string;
      messageId: string;
    },
    callback: (response: {
      success: boolean;
      error?: string;
    }) => void,
  ) => void;

  "message:reaction:add": (
    payload: {
      conversationId: string;
      messageId: string;
      emoji: ReactionEmoji;
    },
    callback: (response: {
      success: boolean;
      error?: string;
    }) => void,
  ) => void;

  "message:reaction:remove": (
    payload: {
      conversationId: string;
      messageId: string;
      emoji: ReactionEmoji;
    },
    callback: (response: {
      success: boolean;
      error?: string;
    }) => void,
  ) => void;
}

export type ChatSocket = Socket<
  ServerToClientEvents,
  ClientToServerEvents
>;

export function createChatSocket(): ChatSocket {
  return io(apiBaseUrl, {
    autoConnect: false,
    withCredentials: true,
  });
}