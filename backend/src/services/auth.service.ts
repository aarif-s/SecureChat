import argon2 from "argon2";
import { UserModel } from "../models/User.js";
import {
  type LoginInput,
  type RegisterInput,
} from "../schemas/auth.schema.js";
import { sendVerificationEmail } from "./email.service.js";
import {
  createVerificationToken,
  hashVerificationToken,
} from "../utils/verification-token.js";

const ARGON2_OPTIONS = {
  type: argon2.argon2id as 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

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
  emailVerified: boolean;
}> {
  const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);
  const verificationToken = createVerificationToken();

  try {
    const user = await UserModel.create({
      email: input.email,
      passwordHash: passwordHash.toString(),
      displayName: input.displayName,
      emailVerified: false,
      emailVerificationTokenHash: hashVerificationToken(verificationToken),
      emailVerificationExpiresAt: new Date(
        Date.now() + EMAIL_VERIFICATION_TTL_MS,
      ),
    });

    await sendVerificationEmail(user.email, verificationToken);

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
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
  emailVerified: boolean;
}> {
  const user = await UserModel.findOne({ email: input.email }).select(
    "+passwordHash",
  );

  if (!user || !user.passwordHash) {
    throw new AuthenticationError();
  }

  const passwordMatches = await argon2.verify(
    user.passwordHash,
    input.password,
  );

  if (!passwordMatches) {
    throw new AuthenticationError();
  }

  if (user.emailVerified === false) {
    throw new EmailVerificationRequiredError();
  }

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
  };
}

export async function verifyEmailToken(token: string): Promise<boolean> {
  const tokenHash = hashVerificationToken(token);
  const user = await UserModel.findOne({
    emailVerificationTokenHash: tokenHash,
    emailVerificationExpiresAt: { $gt: new Date() },
    emailVerified: false,
  }).select("+emailVerificationTokenHash +emailVerificationExpiresAt");

  if (!user) {
    return false;
  }

  const result = await UserModel.updateOne(
    {
      _id: user._id,
      emailVerificationTokenHash: tokenHash,
      emailVerified: false,
    },
    {
      $set: { emailVerified: true },
      $unset: {
        emailVerificationTokenHash: 1,
        emailVerificationExpiresAt: 1,
      },
    },
  );

  return result.modifiedCount === 1;
}

export async function resendVerificationEmail(email: string): Promise<void> {
  const user = await UserModel.findOne({
    email,
    emailVerified: false,
  }).select("+passwordHash");

  if (!user || !user.passwordHash) {
    return;
  }

  const verificationToken = createVerificationToken();
  await UserModel.updateOne(
    { _id: user._id, emailVerified: false },
    {
      $set: {
        emailVerificationTokenHash: hashVerificationToken(verificationToken),
        emailVerificationExpiresAt: new Date(
          Date.now() + EMAIL_VERIFICATION_TTL_MS,
        ),
      },
    },
  );

  await sendVerificationEmail(user.email, verificationToken);
}

export class EmailVerificationRequiredError extends Error {
  constructor() {
    super("Please verify your email before signing in.");
    this.name = "EmailVerificationRequiredError";
  }
}
