import { Types } from "mongoose";

import { ConversationModel } from "../models/Conversation.js";
import { UserModel } from "../models/User.js";
import type { CreateConversationInput } from "../schemas/conversation.schema.js";

export class ConversationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConversationValidationError";
  }
}

export class ConversationNotAccessibleError extends Error {
  constructor() {
    super("Conversation not found.");
    this.name = "ConversationNotAccessibleError";
  }
}

export async function listConversations(userId: string) {
  return ConversationModel.find({
    participants: new Types.ObjectId(userId),
    deletedFor: { $ne: new Types.ObjectId(userId) },
  })
    .populate("participants", "displayName email")
    .sort({ updatedAt: -1 })
    .lean();
}

export async function createConversation(
  userId: string,
  input: CreateConversationInput,
) {
  const participantIds = [userId, ...input.participantIds].filter(
    (id, index, ids) => ids.indexOf(id) === index,
  );

  if (input.type === "direct" && participantIds.length !== 2) {
    throw new ConversationValidationError(
      "Direct conversations require exactly two participants.",
    );
  }

  const participantObjectIds = participantIds.map(
    (id) => new Types.ObjectId(id),
  );

  const existingUsers = await UserModel.countDocuments({
    _id: { $in: participantObjectIds },
  });

  if (existingUsers !== participantObjectIds.length) {
    throw new ConversationValidationError(
      "One or more participants do not exist.",
    );
  }

  /*
   * Direct conversations are unique between two users.
   *
   * If the conversation already exists, return it instead of
   * creating a duplicate. If this user previously removed it,
   * restore it for this user.
   */
  if (input.type === "direct") {
    const existingConversation = await ConversationModel.findOne({
      type: "direct",
      participants: {
        $all: participantObjectIds,
        $size: 2,
      },
    }).sort({ updatedAt: -1 });

    if (existingConversation) {
      await ConversationModel.updateOne(
        { _id: existingConversation._id },
        {
          $pull: {
            deletedFor: new Types.ObjectId(userId),
          },
        },
      );

      await existingConversation.populate(
        "participants",
        "displayName email",
      );

      return existingConversation;
    }
  }

  const conversation = await ConversationModel.create({
    participants: participantObjectIds,
    type: input.type,
    deletedFor: [],
  });

  await conversation.populate(
    "participants",
    "displayName email",
  );

  return conversation;
}

export async function removeConversationForUser(
  conversationId: string,
  userId: string,
) {
  const conversation = await ConversationModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(conversationId),
      participants: new Types.ObjectId(userId),
    },
    {
      $addToSet: {
        deletedFor: new Types.ObjectId(userId),
      },
    },
    { new: true },
  );

  if (!conversation) {
    throw new ConversationNotAccessibleError();
  }

  return conversation;
}

export async function getAccessibleConversation(
  conversationId: string,
  userId: string,
) {
  const conversation = await ConversationModel.findOne({
    _id: new Types.ObjectId(conversationId),
    participants: new Types.ObjectId(userId),
  });

  if (!conversation) {
    throw new ConversationNotAccessibleError();
  }

  return conversation;
}