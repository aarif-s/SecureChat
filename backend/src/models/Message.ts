import { Schema, model, type Types } from "mongoose";

export type MessageStatus = "sent" | "delivered" | "read";
export const ALLOWED_REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "😡"] as const;
export type ReactionEmoji = (typeof ALLOWED_REACTIONS)[number];

export interface MessageReaction {
  emoji: ReactionEmoji;
  userIds: Types.ObjectId[];
}

export interface MessageEncryption {
  algorithm: "aes-256-gcm";
  keyVersion: number;
  iv: string;
  authTag: string;
}

export interface Message {
  conversation: Types.ObjectId;
  sender: Types.ObjectId;
  content?: string;
  encryptedContent?: string;
  encryption?: MessageEncryption;
  isEdited: boolean;
  deletedAt?: Date | null;
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
      required: false,
      trim: true,
      minlength: 1,
      maxlength: 5000,
    },
    encryptedContent: {
      type: String,
      required: false,
    },
    encryption: {
      _id: false,
      algorithm: {
        type: String,
        enum: ["aes-256-gcm"],
        required: true,
      },
      keyVersion: {
        type: Number,
        required: true,
        min: 1,
      },
      iv: {
        type: String,
        required: true,
      },
      authTag: {
        type: String,
        required: true,
      },
    },
    isEdited: {
      type: Boolean,
      required: true,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
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

messageSchema.pre("validate", function validateMessageStorage() {
  const hasPlaintext = typeof this.content === "string";
  const hasEncryptedContent = typeof this.encryptedContent === "string";
  const hasEncryptionMetadata = this.encryption !== undefined;

  if (hasPlaintext && !hasEncryptedContent && !hasEncryptionMetadata) {
    return;
  }

  if (!hasPlaintext && hasEncryptedContent && hasEncryptionMetadata) {
    return;
  }

  throw new Error("Message content storage must be plaintext or encrypted.");
});

export const MessageModel = model<Message>("Message", messageSchema);
