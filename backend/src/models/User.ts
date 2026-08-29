import { Schema, model, type HydratedDocument } from "mongoose";

export interface User {
  email: string;
  passwordHash: string;
  displayName: string;
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
      required: true,
      select: false,
    },

    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 80,
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