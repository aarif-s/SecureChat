import { Schema, model, type HydratedDocument } from "mongoose";

export interface User {
  email: string;
  passwordHash?: string | null;
  displayName: string;
  emailVerified: boolean;
  emailVerificationTokenHash?: string | null;
  emailVerificationExpiresAt?: Date | null;
  googleSub?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    passwordHash: {
      type: String,
      required: false,
      select: false,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
    },

    emailVerified: {
      type: Boolean,
      required: true,
      default: false,
    },

    emailVerificationTokenHash: {
      type: String,
      required: false,
      default: null,
      select: false,
    },

    emailVerificationExpiresAt: {
      type: Date,
      required: false,
      default: null,
      select: false,
    },

    googleSub: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

export const UserModel = model<User>(
  "User",
  userSchema,
);