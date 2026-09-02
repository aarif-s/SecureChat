
import { Types } from "mongoose";
import type { Server as HttpServer } from "node:http";
import { Server, type Socket } from "socket.io";

import { getSession } from "../services/session.service.js";
import {
  ConversationNotAccessibleError,
  getAccessibleConversation,
} from "../services/conversation.service.js";
import {
  deleteMessage,
  editMessage,
  InvalidReactionError,
  markMessageDelivered,
  markMessageRead,
  MessageNotAccessibleError,
  sendMessage,
  updateMessageReaction,
} from "../services/message.service.js";
import {
  editMessageSchema,
  sendMessageSchema,
} from "../schemas/message.schema.js";
import { SESSION_COOKIE_NAME } from "../utils/session-cookie.js";

const CONVERSATION_ROOM_PREFIX = "conversation:";

interface SocketData {
  userId: string;
}

interface ConversationPayload {
  conversationId?: unknown;
}

interface MessagePayload extends ConversationPayload {
  content?: unknown;
}

interface MessageStatusPayload extends ConversationPayload {
  messageId?: unknown;
}

interface MessageEditPayload extends MessageStatusPayload {
  content?: unknown;
}

interface ReactionPayload extends MessageStatusPayload {
  emoji?: unknown;
}

interface SocketAcknowledgement {
  success: boolean;
  error?: string;
  message?: unknown;
  status?: unknown;
}

interface PresenceUpdate {
  userId: string;
  online: boolean;
}

interface TypingUpdate {
  conversationId: string;
  userId: string;
  isTyping: boolean;
}

interface ClientToServerEvents {
  "conversation:join": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "conversation:leave": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "message:send": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "message:edit": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "message:delete": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "typing:start": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "typing:stop": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "message:delivered": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "message:read": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "message:reaction:add": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;

  "message:reaction:remove": (
    payload: unknown,
    callback?: (response: SocketAcknowledgement) => void,
  ) => void;
}

interface ServerToClientEvents {
  "message:new": (message: unknown) => void;

  "message:updated": (message: unknown) => void;

  "message:deleted": (message: unknown) => void;

  "presence:update": (update: PresenceUpdate) => void;

  "typing:update": (update: TypingUpdate) => void;

  "message:status": (status: {
    messageId: string;
    conversationId: string;
    deliveredAt: Date | null;
    readAt: Date | null;
  }) => void;

  "message:reaction": (update: {
    messageId: string;
    conversationId: string;
    emoji: string;
    userId: string;
    action: "add" | "remove";
    reactions: Array<{
      emoji: string;
      userIds: string[];
    }>;
  }) => void;
}

const presenceSockets = new Map<string, Set<string>>();
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();
const TYPING_TIMEOUT_MS = 1_500;

function getConversationRoom(conversationId: string): string {
  return `${CONVERSATION_ROOM_PREFIX}${conversationId}`;
}

function getCookieValue(cookieHeader: string | undefined): string | null {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE_NAME}=`));

  return cookie?.slice(SESSION_COOKIE_NAME.length + 1) || null;
}

function getConversationId(payload: unknown): string | null {
  const record =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;

  const conversationId = record?.conversationId;

  if (
    typeof conversationId !== "string" ||
    !Types.ObjectId.isValid(conversationId)
  ) {
    return null;
  }

  return conversationId;
}

function getMessageId(payload: unknown): string | null {
  const record =
    typeof payload === "object" && payload !== null
      ? (payload as Record<string, unknown>)
      : null;

  const messageId = record?.messageId;

  if (
    typeof messageId !== "string" ||
    !Types.ObjectId.isValid(messageId)
  ) {
    return null;
  }

  return messageId;
}

function getReactionEmoji(payload: unknown): unknown {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("emoji" in payload)
  ) {
    return undefined;
  }

  return (payload as ReactionPayload).emoji;
}

function getPresenceKey(userId: string, socketId: string): string {
  return `${userId}:${socketId}`;
}

function isUserOnline(userId: string): boolean {
  return (presenceSockets.get(userId)?.size ?? 0) > 0;
}

function addPresence(userId: string, socketId: string): void {
  const sockets = presenceSockets.get(userId) ?? new Set<string>();

  sockets.add(socketId);
  presenceSockets.set(userId, sockets);
}

function removePresence(userId: string, socketId: string): boolean {
  const sockets = presenceSockets.get(userId);

  if (!sockets) return false;

  sockets.delete(socketId);

  if (sockets.size > 0) return false;

  presenceSockets.delete(userId);
  return true;
}

function clearTypingTimer(
  socketId: string,
  conversationId: string,
): void {
  const timerKey = getPresenceKey(socketId, conversationId);
  const timer = typingTimers.get(timerKey);

  if (timer) clearTimeout(timer);

  typingTimers.delete(timerKey);
}

function emitTypingUpdate(
  io: Server<
    ClientToServerEvents,
    ServerToClientEvents,
    never,
    SocketData
  >,
  socket: Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    never,
    SocketData
  >,
  conversationId: string,
  isTyping: boolean,
): void {
  io.to(getConversationRoom(conversationId))
    .except(socket.id)
    .emit("typing:update", {
      conversationId,
      userId: socket.data.userId,
      isTyping,
    });
}

function acknowledge(
  callback:
    | ((response: SocketAcknowledgement) => void)
    | undefined,
  response: SocketAcknowledgement,
): void {
  callback?.(response);
}

async function authorizeConversation(
  socket: Socket<
    ClientToServerEvents,
    ServerToClientEvents,
    never,
    SocketData
  >,
  conversationId: string,
): Promise<boolean> {
  try {
    await getAccessibleConversation(
      conversationId,
      socket.data.userId,
    );

    return true;
  } catch (error: unknown) {
    if (!(error instanceof ConversationNotAccessibleError)) {
      throw error;
    }

    return false;
  }
}

export function createChatSocketServer(
  httpServer: HttpServer,
): Server {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    never,
    SocketData
  >(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const sessionId = getCookieValue(
        socket.handshake.headers.cookie,
      );

      if (!sessionId) {
        next(new Error("Authentication required."));
        return;
      }

      const session = await getSession(sessionId);

      if (!session) {
        next(new Error("Authentication required."));
        return;
      }

      socket.data.userId = session.userId;
      next();
    } catch {
      next(new Error("Authentication failed."));
    }
  });

  io.on("connection", (socket) => {
    addPresence(socket.data.userId, socket.id);

    socket.on(
      "conversation:join",
      async (
        payload: unknown,
        callback?: (
          response: SocketAcknowledgement,
        ) => void,
      ) => {
        const conversationId = getConversationId(payload);

        if (!conversationId) {
          acknowledge(callback, {
            success: false,
            error: "Invalid conversation ID.",
          });
          return;
        }

        if (!(await authorizeConversation(socket, conversationId))) {
          acknowledge(callback, {
            success: false,
            error: "Conversation not found.",
          });
          return;
        }

        await socket.join(
          getConversationRoom(conversationId),
        );

        const conversation =
          await getAccessibleConversation(
            conversationId,
            socket.data.userId,
          );

        for (const participantId of conversation.participants) {
          socket.emit("presence:update", {
            userId: participantId.toString(),
            online: isUserOnline(
              participantId.toString(),
            ),
          });
        }

        io.to(
          getConversationRoom(conversationId),
        ).emit("presence:update", {
          userId: socket.data.userId,
          online: true,
        });

        acknowledge(callback, {
          success: true,
        });
      },
    );

    socket.on(
      "conversation:leave",
      async (
        payload: unknown,
        callback?: (
          response: SocketAcknowledgement,
        ) => void,
      ) => {
        const conversationId = getConversationId(payload);

        if (!conversationId) {
          acknowledge(callback, {
            success: false,
            error: "Invalid conversation ID.",
          });
          return;
        }

        await socket.leave(
          getConversationRoom(conversationId),
        );

        clearTypingTimer(
          socket.id,
          conversationId,
        );

        emitTypingUpdate(
          io,
          socket,
          conversationId,
          false,
        );

        acknowledge(callback, {
          success: true,
        });
      },
    );

    async function handleTyping(
      payload: unknown,
      isTyping: boolean,
      callback?: (
        response: SocketAcknowledgement,
      ) => void,
    ): Promise<void> {
      const conversationId = getConversationId(payload);

      if (!conversationId) {
        acknowledge(callback, {
          success: false,
          error: "Invalid typing data.",
        });
        return;
      }

      if (
        !socket.rooms.has(
          getConversationRoom(conversationId),
        ) ||
        !(await authorizeConversation(
          socket,
          conversationId,
        ))
      ) {
        acknowledge(callback, {
          success: false,
          error: "Conversation not found.",
        });
        return;
      }

      clearTypingTimer(
        socket.id,
        conversationId,
      );

      emitTypingUpdate(
        io,
        socket,
        conversationId,
        isTyping,
      );

      if (isTyping) {
        const timerKey = getPresenceKey(
          socket.id,
          conversationId,
        );

        const timer = setTimeout(() => {
          typingTimers.delete(timerKey);

          emitTypingUpdate(
            io,
            socket,
            conversationId,
            false,
          );
        }, TYPING_TIMEOUT_MS);

        typingTimers.set(timerKey, timer);
      }

      acknowledge(callback, {
        success: true,
      });
    }

    socket.on(
      "typing:start",
      (payload, callback) => {
        void handleTyping(
          payload,
          true,
          callback,
        );
      },
    );

    socket.on(
      "typing:stop",
      (payload, callback) => {
        void handleTyping(
          payload,
          false,
          callback,
        );
      },
    );

    async function handleMessageStatus(
      payload: unknown,
      markStatus: typeof markMessageDelivered,
      callback?: (
        response: SocketAcknowledgement,
      ) => void,
    ): Promise<void> {
      const conversationId =
        getConversationId(payload);

      const messageId =
        getMessageId(payload);

      if (!conversationId || !messageId) {
        acknowledge(callback, {
          success: false,
          error: "Invalid message status data.",
        });
        return;
      }

      try {
        const status = await markStatus(
          messageId,
          conversationId,
          socket.data.userId,
        );

        if (status) {
          io.to(
            getConversationRoom(conversationId),
          ).emit(
            "message:status",
            status,
          );
        }

        acknowledge(callback, {
          success: true,
          status,
        });
      } catch (error: unknown) {
        if (
          error instanceof MessageNotAccessibleError
        ) {
          acknowledge(callback, {
            success: false,
            error: error.message,
          });
          return;
        }

        acknowledge(callback, {
          success: false,
          error: "Unable to update message status.",
        });
      }
    }

    socket.on(
      "message:delivered",
      (payload, callback) => {
        void handleMessageStatus(
          payload,
          markMessageDelivered,
          callback,
        );
      },
    );

    socket.on(
      "message:read",
      (payload, callback) => {
        void handleMessageStatus(
          payload,
          markMessageRead,
          callback,
        );
      },
    );

    async function handleReaction(
      payload: unknown,
      action: "add" | "remove",
      callback?: (
        response: SocketAcknowledgement,
      ) => void,
    ): Promise<void> {
      const conversationId =
        getConversationId(payload);

      const messageId =
        getMessageId(payload);

      const emoji =
        getReactionEmoji(payload);

      if (!conversationId || !messageId) {
        acknowledge(callback, {
          success: false,
          error: "Invalid reaction data.",
        });
        return;
      }

      try {
        const reaction =
          await updateMessageReaction(
            messageId,
            conversationId,
            socket.data.userId,
            emoji,
            action,
          );

        if (reaction) {
          const update = {
            ...reaction,
            userId: socket.data.userId,
            action,
          };

          io.to(
            getConversationRoom(conversationId),
          ).emit(
            "message:reaction",
            update,
          );

          acknowledge(callback, {
            success: true,
            status: update,
          });

          return;
        }

        acknowledge(callback, {
          success: true,
        });
      } catch (error: unknown) {
        if (
          error instanceof InvalidReactionError ||
          error instanceof MessageNotAccessibleError
        ) {
          acknowledge(callback, {
            success: false,
            error: error.message,
          });
          return;
        }

        acknowledge(callback, {
          success: false,
          error: "Unable to update reaction.",
        });
      }
    }

    socket.on(
      "message:reaction:add",
      (payload, callback) => {
        void handleReaction(
          payload,
          "add",
          callback,
        );
      },
    );

    socket.on(
      "message:reaction:remove",
      (payload, callback) => {
        void handleReaction(
          payload,
          "remove",
          callback,
        );
      },
    );

    socket.on(
      "message:edit",
      async (
        payload: unknown,
        callback?: (
          response: SocketAcknowledgement,
        ) => void,
      ) => {
        const conversationId =
          getConversationId(payload);

        const messageId =
          getMessageId(payload);

        const content =
          typeof payload === "object" &&
          payload !== null &&
          "content" in payload
            ? (payload as MessageEditPayload).content
            : undefined;

        const result =
          editMessageSchema.safeParse({
            content,
          });

        if (
          !conversationId ||
          !messageId ||
          !result.success
        ) {
          acknowledge(callback, {
            success: false,
            error: "Invalid message edit data.",
          });
          return;
        }

        if (
          !socket.rooms.has(
            getConversationRoom(conversationId),
          ) ||
          !(await authorizeConversation(
            socket,
            conversationId,
          ))
        ) {
          acknowledge(callback, {
            success: false,
            error: "Conversation not found.",
          });
          return;
        }

        try {
          const message = await editMessage(
            messageId,
            conversationId,
            socket.data.userId,
            result.data,
          );

          io.to(
            getConversationRoom(conversationId),
          ).emit(
            "message:updated",
            message,
          );

          acknowledge(callback, {
            success: true,
            message,
          });
        } catch (error: unknown) {
          if (
            error instanceof MessageNotAccessibleError
          ) {
            acknowledge(callback, {
              success: false,
              error: error.message,
            });
            return;
          }

          acknowledge(callback, {
            success: false,
            error: "Unable to edit message.",
          });
        }
      },
    );

    socket.on(
      "message:delete",
      async (
        payload: unknown,
        callback?: (
          response: SocketAcknowledgement,
        ) => void,
      ) => {
        const conversationId =
          getConversationId(payload);

        const messageId =
          getMessageId(payload);

        if (!conversationId || !messageId) {
          acknowledge(callback, {
            success: false,
            error: "Invalid message deletion data.",
          });
          return;
        }

        if (
          !socket.rooms.has(
            getConversationRoom(conversationId),
          ) ||
          !(await authorizeConversation(
            socket,
            conversationId,
          ))
        ) {
          acknowledge(callback, {
            success: false,
            error: "Conversation not found.",
          });
          return;
        }

        try {
          const message = await deleteMessage(
            messageId,
            conversationId,
            socket.data.userId,
          );

          io.to(
            getConversationRoom(conversationId),
          ).emit(
            "message:deleted",
            message,
          );

          acknowledge(callback, {
            success: true,
            message,
          });
        } catch (error: unknown) {
          if (
            error instanceof MessageNotAccessibleError
          ) {
            acknowledge(callback, {
              success: false,
              error: error.message,
            });
            return;
          }

          acknowledge(callback, {
            success: false,
            error: "Unable to delete message.",
          });
        }
      },
    );

    socket.on(
      "message:send",
      async (
        payload: unknown,
        callback?: (
          response: SocketAcknowledgement,
        ) => void,
      ) => {
        const conversationId =
          getConversationId(payload);

        const content =
          typeof payload === "object" &&
          payload !== null &&
          "content" in payload
            ? (payload as MessagePayload).content
            : undefined;

        const result =
          sendMessageSchema.safeParse({
            content,
          });

        if (!conversationId || !result.success) {
          acknowledge(callback, {
            success: false,
            error: "Invalid message data.",
          });
          return;
        }

        if (
          !(await authorizeConversation(
            socket,
            conversationId,
          ))
        ) {
          acknowledge(callback, {
            success: false,
            error: "Conversation not found.",
          });
          return;
        }

        const message = await sendMessage(
          conversationId,
          socket.data.userId,
          result.data,
        );

        io.to(
          getConversationRoom(conversationId),
        ).emit(
          "message:new",
          message,
        );

        acknowledge(callback, {
          success: true,
          message,
        });
      },
    );

    socket.on("disconnecting", () => {
      const finalOffline = removePresence(
        socket.data.userId,
        socket.id,
      );

      for (const room of socket.rooms) {
        if (
          !room.startsWith(
            CONVERSATION_ROOM_PREFIX,
          )
        ) {
          continue;
        }

        const conversationId =
          room.slice(
            CONVERSATION_ROOM_PREFIX.length,
          );

        clearTypingTimer(
          socket.id,
          conversationId,
        );

        emitTypingUpdate(
          io,
          socket,
          conversationId,
          false,
        );

        if (finalOffline) {
          io.to(room).emit(
            "presence:update",
            {
              userId: socket.data.userId,
              online: false,
            },
          );
        }
      }
    });
  });

  return io;
}
