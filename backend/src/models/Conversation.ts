import { Schema, model, type Types } from "mongoose";

export type ConversationType = "direct" | "group";

export interface Conversation {
  participants: Types.ObjectId[];
  type: ConversationType;
  deletedFor: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<Conversation>(
  {
    participants: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      required: true,
      validate: {
        validator: (value: Types.ObjectId[]) => value.length >= 2,
        message: "A conversation requires at least two participants.",
      },
    },

    type: {
      type: String,
      enum: ["direct", "group"],
      required: true,
      default: "direct",
    },

    // Users who have removed/hidden this conversation from their sidebar.
    // This does NOT delete the conversation or its messages.
    deletedFor: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

export const ConversationModel = model<Conversation>(
  "Conversation",
  conversationSchema,
);