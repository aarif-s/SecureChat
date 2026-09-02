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

export class MessageNotAccessibleError extends Error {
  constructor() {
    super("Message not found.");
    this.name = "MessageNotAccessibleError";
  }
}

export class InvalidReactionError extends Error {
  constructor() {
    super("Invalid reaction.");
    this.name = "InvalidReactionError";
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

export function isAllowedReaction(
  value: unknown,
): value is ReactionEmoji {
  return (
    typeof value === "string" &&
    (ALLOWED_REACTIONS as readonly string[]).includes(value)
  );
}

export async function listMessages(
  conversationId: string,
  userId: string,
) {
  await getAccessibleConversation(
    conversationId,
    userId,
  );

  return MessageModel.find({
    conversation: new Types.ObjectId(conversationId),
  })
    .populate("sender", "displayName email")
    .sort({ createdAt: 1 })
    .lean();
}

export async function sendMessage(
  conversationId: string,
  userId: string,
  input: SendMessageInput,
) {
  await getAccessibleConversation(
    conversationId,
    userId,
  );

  const message = await MessageModel.create({
    conversation: new Types.ObjectId(conversationId),
    sender: new Types.ObjectId(userId),
    content: input.content,
    status: "sent",
  });

  await message.populate(
    "sender",
    "displayName email",
  );

  return message;
}

function serializeReactions(
  reactions: unknown,
): Array<{
  emoji: ReactionEmoji;
  userIds: string[];
}> {
  const reactionList = Array.isArray(reactions)
    ? (reactions as Array<{
        emoji: ReactionEmoji;
        userIds: Types.ObjectId[];
      }>)
    : [];

  return reactionList
    .filter(
      (reaction) => reaction.userIds.length > 0,
    )
    .map((reaction) => ({
      emoji: reaction.emoji,
      userIds: reaction.userIds.map((userId) =>
        userId.toString(),
      ),
    }));
}

/**
 * Add/change/remove a reaction.
 *
 * IMPORTANT:
 * One user can have only ONE reaction
 * on a particular message.
 *
 * Example:
 *
 * ❤️ -> 😂
 *
 * The user's ❤️ is removed and 😂 becomes
 * their only reaction.
 */
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
    conversation = await getAccessibleConversation(
      conversationId,
      userId,
    );
  } catch (error: unknown) {
    if (
      error instanceof
      ConversationNotAccessibleError
    ) {
      throw new MessageNotAccessibleError();
    }

    throw error;
  }

  const messageObjectId =
    new Types.ObjectId(messageId);

  const conversationObjectId =
    new Types.ObjectId(conversationId);

  const userObjectId =
    new Types.ObjectId(userId);

  const message = await MessageModel.findOne({
    _id: messageObjectId,
    conversation: conversationObjectId,
  }).select(
    "_id conversation reactions",
  );

  if (
    !message ||
    !conversation.participants.some(
      (participant) =>
        participant.equals(userObjectId),
    )
  ) {
    throw new MessageNotAccessibleError();
  }

  const reactions = message.reactions ?? [];

  const targetReaction = reactions.find(
    (reaction) =>
      reaction.emoji === emoji,
  );

  const userHasTargetReaction =
    targetReaction?.userIds.some(
      (id) => id.equals(userObjectId),
    ) ?? false;

  /*
   * REMOVE
   *
   * Clicking the reaction already selected
   * by the current user removes it.
   */
  if (action === "remove") {
    if (!userHasTargetReaction) {
      return null;
    }

    for (const reaction of reactions) {
      reaction.userIds =
        reaction.userIds.filter(
          (id) => !id.equals(userObjectId),
        );
    }

    message.reactions =
      reactions.filter(
        (reaction) =>
          reaction.userIds.length > 0,
      );

    await message.save();

    return {
      messageId:
        message._id.toString(),

      conversationId:
        message.conversation.toString(),

      emoji,

      reactions:
        serializeReactions(
          message.reactions,
        ),
    };
  }

  /*
   * ADD / CHANGE
   *
   * Remove the current user's reaction
   * from every other emoji first.
   */
  let changed = false;

  for (const reaction of reactions) {
    if (reaction.emoji === emoji) {
      continue;
    }

    const hadReaction =
      reaction.userIds.some(
        (id) => id.equals(userObjectId),
      );

    if (hadReaction) {
      reaction.userIds =
        reaction.userIds.filter(
          (id) => !id.equals(userObjectId),
        );

      changed = true;
    }
  }

  /*
   * If the user doesn't already have the
   * selected emoji, add it.
   */
  if (!userHasTargetReaction) {
    if (targetReaction) {
      targetReaction.userIds.push(
        userObjectId,
      );
    } else {
      reactions.push({
        emoji,
        userIds: [userObjectId],
      });
    }

    changed = true;
  }

  /*
   * Remove empty reaction groups.
   */
  message.reactions =
    reactions.filter(
      (reaction) =>
        reaction.userIds.length > 0,
    );

  if (!changed) {
    return null;
  }

  await message.save();

  return {
    messageId:
      message._id.toString(),

    conversationId:
      message.conversation.toString(),

    emoji,

    reactions:
      serializeReactions(
        message.reactions,
      ),
  };
}

export async function editMessage(
  messageId: string,
  conversationId: string,
  userId: string,
  input: EditMessageInput,
) {
  const conversation =
    await getAccessibleConversation(
      conversationId,
      userId,
    );

  const message =
    await MessageModel.findOne({
      _id: new Types.ObjectId(messageId),
      conversation:
        new Types.ObjectId(conversationId),
    });

  if (!message) {
    throw new MessageNotAccessibleError();
  }

  if (
    !message.sender.equals(
      new Types.ObjectId(userId),
    )
  ) {
    throw new MessageNotAccessibleError();
  }

  if (
    !conversation.participants.some(
      (participant) =>
        participant.equals(
          new Types.ObjectId(userId),
        ),
    )
  ) {
    throw new MessageNotAccessibleError();
  }

  if (message.deletedAt) {
    throw new MessageNotAccessibleError();
  }

  message.content = input.content;
  message.isEdited = true;

  await message.save();

  await message.populate(
    "sender",
    "displayName email",
  );

  return message;
}

export async function deleteMessage(
  messageId: string,
  conversationId: string,
  userId: string,
) {
  const conversation =
    await getAccessibleConversation(
      conversationId,
      userId,
    );

  const message =
    await MessageModel.findOne({
      _id: new Types.ObjectId(messageId),
      conversation:
        new Types.ObjectId(conversationId),
    });

  if (!message) {
    throw new MessageNotAccessibleError();
  }

  if (
    !message.sender.equals(
      new Types.ObjectId(userId),
    )
  ) {
    throw new MessageNotAccessibleError();
  }

  if (
    !conversation.participants.some(
      (participant) =>
        participant.equals(
          new Types.ObjectId(userId),
        ),
    )
  ) {
    throw new MessageNotAccessibleError();
  }

  if (message.deletedAt) {
    throw new MessageNotAccessibleError();
  }

  message.content =
    "This message was deleted.";

  message.deletedAt = new Date();
  message.isEdited = false;

  await message.save();

  await message.populate(
    "sender",
    "displayName email",
  );

  return message;
}

async function updateMessageStatus(
  messageId: string,
  conversationId: string,
  userId: string,
  field:
    | "deliveredAt"
    | "readAt",
): Promise<MessageStatusUpdate | null> {
  const messageObjectId =
    new Types.ObjectId(messageId);

  const conversationObjectId =
    new Types.ObjectId(conversationId);

  const userObjectId =
    new Types.ObjectId(userId);

  const message =
    await MessageModel.findOne({
      _id: messageObjectId,
      conversation: conversationObjectId,
    }).select(
      "sender deliveredAt readAt",
    );

  if (!message) {
    throw new MessageNotAccessibleError();
  }

  const conversation =
    await getAccessibleConversation(
      conversationId,
      userId,
    );

  if (
    (
      field === "readAt" &&
      conversation.type !== "direct"
    ) ||
    message.sender.equals(userObjectId) ||
    !conversation.participants.some(
      (participant) =>
        participant.equals(userObjectId),
    )
  ) {
    throw new MessageNotAccessibleError();
  }

  const now = new Date();

  const updated =
    await MessageModel.findOneAndUpdate(
      {
        _id: messageObjectId,
        conversation:
          conversationObjectId,
        [field]: null,
        ...(field === "deliveredAt"
          ? { readAt: null }
          : {}),
      },
      {
        $set: {
          [field]: now,
          status:
            field === "readAt"
              ? "read"
              : "delivered",
        },
      },
      {
        returnDocument: "after",
      },
    ).select(
      "_id conversation deliveredAt readAt",
    );

  if (!updated) {
    return null;
  }

  if (
    field === "readAt" &&
    !updated.deliveredAt
  ) {
    await MessageModel.updateOne(
      {
        _id: messageObjectId,
        conversation:
          conversationObjectId,
        deliveredAt: null,
      },
      {
        $set: {
          deliveredAt: now,
        },
      },
    );

    updated.deliveredAt = now;
  }

  return {
    messageId:
      updated._id.toString(),

    conversationId:
      updated.conversation.toString(),

    deliveredAt:
      updated.deliveredAt ?? null,

    readAt:
      updated.readAt ?? null,
  };
}

export function markMessageDelivered(
  messageId: string,
  conversationId: string,
  userId: string,
): Promise<MessageStatusUpdate | null> {
  return updateMessageStatus(
    messageId,
    conversationId,
    userId,
    "deliveredAt",
  );
}

export function markMessageRead(
  messageId: string,
  conversationId: string,
  userId: string,
): Promise<MessageStatusUpdate | null> {
  return updateMessageStatus(
    messageId,
    conversationId,
    userId,
    "readAt",
  );
}