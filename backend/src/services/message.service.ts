import { Types } from "mongoose";

import {
  ALLOWED_REACTIONS,
  MessageModel,
  type ReactionEmoji,
} from "../models/Message.js";
import {
  ConversationNotAccessibleError,
  getAccessibleConversation,
} from "./conversation.service.js";
import type {
  EditMessageInput,
  SendMessageInput,
} from "../schemas/message.schema.js";
import {
  decryptMessage,
  encryptMessage,
  type EncryptedMessagePayload,
} from "./message-encryption.service.js";

export class MessageNotAccessibleError extends Error {
  constructor() {
    super("Message not found.");
    this.name = "MessageNotAccessibleError";
  }
}

export interface MessageStatusUpdate {
  messageId: string;
  conversationId: string;
  deliveredAt: Date | null;
  readAt: Date | null;
}

export interface MessageReactionUpdate {
  messageId: string;
  conversationId: string;
  emoji: ReactionEmoji;
  reactions: Array<{
    emoji: ReactionEmoji;
    userIds: string[];
  }>;
}

export class InvalidReactionError extends Error {
  constructor() {
    super("Invalid reaction.");
    this.name = "InvalidReactionError";
  }
}

export function isAllowedReaction(value: unknown): value is ReactionEmoji {
  return typeof value === "string" &&
    (ALLOWED_REACTIONS as readonly string[]).includes(value);
}

function getSenderId(sender: unknown): string {
  if (typeof sender === "object" && sender !== null && "_id" in sender) {
    return String(sender._id);
  }
  return String(sender);
}

function toMessageDto(message: Record<string, unknown>) {
  const conversationId = String(message.conversation);
  const senderId = getSenderId(message.sender);
  const content = message.deletedAt
    ? "This message was deleted."
    : message.encryption && message.encryptedContent
    ? decryptMessage(
        {
          ...message.encryption as Record<string, unknown>,
          ciphertext: message.encryptedContent,
        } as EncryptedMessagePayload,
        { conversationId, senderId },
      )
    : typeof message.content === "string"
      ? message.content
      : (() => { throw new Error("Message content is unavailable."); })();

  const {
    encryptedContent: _encryptedContent,
    encryption: _encryption,
    ...dto
  } = message;
  return { ...dto, content };
}

export async function listMessages(
  conversationId: string,
  userId: string,
) {
  await getAccessibleConversation(conversationId, userId);

  const messages = await MessageModel.find({
    conversation: new Types.ObjectId(conversationId),
  })
    .populate("sender", "displayName email")
    .sort({ createdAt: 1 })
    .lean();

  return messages.map((message) =>
    toMessageDto(message as unknown as Record<string, unknown>),
  );
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  input: SendMessageInput,
) {
  await getAccessibleConversation(conversationId, userId);

  const encrypted = encryptMessage(input.content, {
    conversationId,
    senderId: userId,
  });
  const message = await MessageModel.create({
    conversation: new Types.ObjectId(conversationId),
    sender: new Types.ObjectId(userId),
    encryptedContent: encrypted.ciphertext,
    encryption: {
      algorithm: encrypted.algorithm,
      keyVersion: encrypted.keyVersion,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    },
    status: "sent",
  });

  await message.populate("sender", "displayName email");

  return toMessageDto(message.toObject() as unknown as Record<string, unknown>);
}

export async function editMessage(
  messageId: string,
  conversationId: string,
  userId: string,
  input: EditMessageInput,
) {
  const conversation = await getAccessibleConversation(conversationId, userId);
  const message = await MessageModel.findOne({
    _id: new Types.ObjectId(messageId),
    conversation: new Types.ObjectId(conversationId),
  });

  if (
    !message ||
    !message.sender.equals(new Types.ObjectId(userId)) ||
    !conversation.participants.some((participant) => participant.equals(new Types.ObjectId(userId))) ||
    message.deletedAt
  ) {
    throw new MessageNotAccessibleError();
  }

  const encrypted = encryptMessage(input.content, {
    conversationId,
    senderId: userId,
  });
  message.content = undefined;
  message.encryptedContent = encrypted.ciphertext;
  message.encryption = {
    algorithm: encrypted.algorithm,
    keyVersion: encrypted.keyVersion,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
  };
  message.isEdited = true;

  await message.save();
  await message.populate("sender", "displayName email");

  return toMessageDto(message.toObject() as unknown as Record<string, unknown>);
}

export async function deleteMessage(
  messageId: string,
  conversationId: string,
  userId: string,
) {
  const conversation = await getAccessibleConversation(conversationId, userId);
  const message = await MessageModel.findOne({
    _id: new Types.ObjectId(messageId),
    conversation: new Types.ObjectId(conversationId),
  });

  if (
    !message ||
    !message.sender.equals(new Types.ObjectId(userId)) ||
    !conversation.participants.some((participant) => participant.equals(new Types.ObjectId(userId))) ||
    message.deletedAt
  ) {
    throw new MessageNotAccessibleError();
  }

  message.deletedAt = new Date();
  message.isEdited = false;

  await message.save();
  await message.populate("sender", "displayName email");

  return toMessageDto(message.toObject() as unknown as Record<string, unknown>);
}

function serializeReactions(
  reactions: unknown,
): Array<{ emoji: ReactionEmoji; userIds: string[] }> {
  const reactionList = Array.isArray(reactions)
    ? reactions as Array<{
        emoji: ReactionEmoji;
        userIds: Types.ObjectId[];
      }>
    : [];

  return reactionList
    .filter((reaction) => reaction.userIds.length > 0)
    .map((reaction) => ({
      emoji: reaction.emoji,
      userIds: reaction.userIds.map((userId) => userId.toString()),
    }));
}

export async function updateMessageReaction(
  messageId: string,
  conversationId: string,
  userId: string,
  emoji: unknown,
  action: "add" | "remove",
): Promise<MessageReactionUpdate | null> {
  if (!isAllowedReaction(emoji)) {
    throw new InvalidReactionError();
  }

  let conversation;
  try {
    conversation = await getAccessibleConversation(conversationId, userId);
  } catch (error: unknown) {
    if (error instanceof ConversationNotAccessibleError) {
      throw new MessageNotAccessibleError();
    }
    throw error;
  }
  const messageObjectId = new Types.ObjectId(messageId);
  const conversationObjectId = new Types.ObjectId(conversationId);
  const userObjectId = new Types.ObjectId(userId);
  const message = await MessageModel.findOne({
    _id: messageObjectId,
    conversation: conversationObjectId,
  }).select("_id conversation reactions");

  if (!message || !conversation.participants.some((participant) => participant.equals(userObjectId))) {
    throw new MessageNotAccessibleError();
  }

  const existingReaction = message.reactions?.find((reaction) => reaction.emoji === emoji);
  const hasReaction = existingReaction?.userIds.some((id) => id.equals(userObjectId)) ?? false;
  const shouldWrite = action === "add" ? !hasReaction : hasReaction;
  let changed = false;

  if (shouldWrite) {
    if (action === "add") {
      const result = await MessageModel.updateOne(
        { _id: messageObjectId, conversation: conversationObjectId },
        { $addToSet: { "reactions.$[reaction].userIds": userObjectId } },
        { arrayFilters: [{ "reaction.emoji": emoji }] },
      );
      changed = result.modifiedCount > 0;
    } else {
      const result = await MessageModel.updateOne(
        { _id: messageObjectId, conversation: conversationObjectId },
        { $pull: { "reactions.$[reaction].userIds": userObjectId } },
        { arrayFilters: [{ "reaction.emoji": emoji }] },
      );
      changed = result.modifiedCount > 0;
    }
  }

  if (action === "add" && !existingReaction) {
    const result = await MessageModel.updateOne(
      {
        _id: messageObjectId,
        conversation: conversationObjectId,
        "reactions.emoji": { $ne: emoji },
      },
      { $push: { reactions: { emoji, userIds: [userObjectId] } } },
    );
    changed = result.modifiedCount > 0;
  }

  const updatedMessage = await MessageModel.findOne({
    _id: messageObjectId,
    conversation: conversationObjectId,
  }).select("_id conversation reactions");

  if (!updatedMessage) {
    throw new MessageNotAccessibleError();
  }

  if (!changed) {
    return null;
  }

  return {
    messageId: updatedMessage._id.toString(),
    conversationId: updatedMessage.conversation.toString(),
    emoji,
    reactions: serializeReactions(updatedMessage.reactions),
  };
}

async function updateMessageStatus(
  messageId: string,
  conversationId: string,
  userId: string,
  field: "deliveredAt" | "readAt",
): Promise<MessageStatusUpdate | null> {
  const messageObjectId = new Types.ObjectId(messageId);
  const conversationObjectId = new Types.ObjectId(conversationId);
  const userObjectId = new Types.ObjectId(userId);
  const message = await MessageModel.findOne({
    _id: messageObjectId,
    conversation: conversationObjectId,
  }).select("sender deliveredAt readAt");

  if (!message) {
    throw new MessageNotAccessibleError();
  }

  const conversation = await getAccessibleConversation(conversationId, userId);
      if ((field === "readAt" && conversation.type !== "direct") ||
        message.sender.equals(userObjectId) ||
      !conversation.participants.some((participant) => participant.equals(userObjectId))) {
    throw new MessageNotAccessibleError();
  }

  const now = new Date();
  const updated = await MessageModel.findOneAndUpdate(
    {
      _id: messageObjectId,
      conversation: conversationObjectId,
      [field]: null,
      ...(field === "deliveredAt" ? { readAt: null } : {}),
    },
    {
      $set: {
        [field]: now,
        status: field === "readAt" ? "read" : "delivered",
      },
    },
    { returnDocument: "after" },
  ).select("_id conversation deliveredAt readAt");

  if (!updated) {
    return null;
  }

  if (field === "readAt" && !updated.deliveredAt) {
    await MessageModel.updateOne(
      {
        _id: messageObjectId,
        conversation: conversationObjectId,
        deliveredAt: null,
      },
      { $set: { deliveredAt: now } },
    );
    updated.deliveredAt = now;
  }

  return {
    messageId: updated._id.toString(),
    conversationId: updated.conversation.toString(),
    deliveredAt: updated.deliveredAt ?? null,
    readAt: updated.readAt ?? null,
  };
}

export function markMessageDelivered(
  messageId: string,
  conversationId: string,
  userId: string,
): Promise<MessageStatusUpdate | null> {
  return updateMessageStatus(messageId, conversationId, userId, "deliveredAt");
}

export function markMessageRead(
  messageId: string,
  conversationId: string,
  userId: string,
): Promise<MessageStatusUpdate | null> {
  return updateMessageStatus(messageId, conversationId, userId, "readAt");
}
