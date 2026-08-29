import { Schema, model, type Types } from "mongoose";

export type MessageStatus = "sent" | "delivered" | "read";
export const ALLOWED_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "😡"] as const;
export type ReactionEmoji = (typeof ALLOWED_REACTIONS)[number];

export interface MessageReaction {
  emoji: ReactionEmoji;
  userIds: Types.ObjectId[];
}

export interface Message {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  content: string;
  status: MessageStatus;
  deliveredAt?: Date | null;
  readAt?: Date | null;
  reactions?: MessageReaction[];
  createdAt: Date;
  updatedAt: Date;
}

const messageSchema = new Schema<Message>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "read"],
      required: true,
      default: "sent",
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
    reactions: {
      type: [
        {
          _id: false,
          emoji: {
            type: String,
            enum: ALLOWED_REACTIONS,
            required: true,
          },
          userIds: {
            type: [Schema.Types.ObjectId],
            ref: "User",
            default: [],
          },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

messageSchema.index({ conversation: 1, createdAt: 1 });

export const MessageModel = model<Message>("Message", messageSchema);
