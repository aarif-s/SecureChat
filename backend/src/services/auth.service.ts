import argon2 from "argon2";

import { UserModel } from "../models/User.js";
import {
  type LoginInput,
  type RegisterInput,
} from "../schemas/auth.schema.js";

const ARGON2_OPTIONS = {
  type: argon2.argon2id as 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export class AuthenticationError extends Error {
  constructor() {
    super("Invalid email or password.");
    this.name = "AuthenticationError";
  }
}

export async function registerUser(
  input: RegisterInput,
): Promise<{
  id: string;
  email: string;
  displayName: string;
}> {
  const existingUser = await UserModel.exists({
    email: input.email,
  });

  if (existingUser) {
    throw new AuthenticationError();
  }

  const passwordHash = await argon2.hash(
    input.password,
    ARGON2_OPTIONS,
  );

  try {
    const user = await UserModel.create({
      email: input.email,
      passwordHash: passwordHash.toString(),
      displayName: input.displayName,
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
    };
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      throw new AuthenticationError();
    }

    throw error;
  }
}

export async function authenticateUser(
  input: LoginInput,
): Promise<{
  id: string;
  email: string;
  displayName: string;
}> {
  const user = await UserModel.findOne({
    email: input.email,
  }).select("+passwordHash");

  if (!user) {
    throw new AuthenticationError();
  }

  const passwordMatches = await argon2.verify(
    user.passwordHash,
    input.password,
  );

  if (!passwordMatches) {
    throw new AuthenticationError();
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}