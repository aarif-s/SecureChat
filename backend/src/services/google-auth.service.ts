import * as oidc from "openid-client";

import { redis } from "../config/redis.js";
import { UserModel } from "../models/User.js";

const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_STATE_PREFIX = "oauth:google:";
const GOOGLE_STATE_TTL_SECONDS = 10 * 60;

interface GoogleOAuthTransaction {
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
}

export interface GoogleAuthUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}

export class GoogleAuthenticationError extends Error {
  constructor() {
    super("Google authentication could not be completed.");
    this.name = "GoogleAuthenticationError";
  }
}

export class GoogleAccountConflictError extends Error {
  constructor() {
    super("This email already has a SecureChat password account.");
    this.name = "GoogleAccountConflictError";
  }
}

let googleConfiguration: Promise<oidc.Configuration> | undefined;

function getGoogleConfigValues(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new GoogleAuthenticationError();
  }

  return { clientId, clientSecret, redirectUri };
}

async function getGoogleConfiguration(): Promise<oidc.Configuration> {
  const { clientId, clientSecret } = getGoogleConfigValues();

  googleConfiguration ??= oidc.discovery(
    new URL(GOOGLE_ISSUER),
    clientId,
    { client_secret: clientSecret },
  );

  return googleConfiguration;
}

export async function startGoogleAuthentication(): Promise<{
  state: string;
  authorizationUrl: URL;
}> {
  const { redirectUri } = getGoogleConfigValues();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();

  await redis.set(
    `${GOOGLE_STATE_PREFIX}${state}`,
    { codeVerifier, nonce, redirectUri } satisfies GoogleOAuthTransaction,
    { ex: GOOGLE_STATE_TTL_SECONDS },
  );

  const config = await getGoogleConfiguration();
  const authorizationUrl = oidc.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return { state, authorizationUrl };
}

export async function completeGoogleAuthentication(
  state: string,
  currentUrl: URL,
): Promise<GoogleAuthUser> {
  const transaction = await redis.getdel<GoogleOAuthTransaction>(
    `${GOOGLE_STATE_PREFIX}${state}`,
  );

  if (!transaction) {
    throw new GoogleAuthenticationError();
  }

  try {
    const config = await getGoogleConfiguration();
    const tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: transaction.codeVerifier,
      expectedState: state,
      expectedNonce: transaction.nonce,
      idTokenExpected: true,
    });
    const claims = tokens.claims();

    if (
      !claims ||
      !validateGoogleClaims(claims) ||
      !validateGoogleNonce(claims, transaction.nonce)
    ) {
      throw new GoogleAuthenticationError();
    }

    return await findOrCreateGoogleUser({
      sub: claims.sub,
      email: claims.email,
      displayName:
        typeof claims.name === "string" ? claims.name : claims.email,
    });
  } catch (error: unknown) {
    if (
      error instanceof GoogleAuthenticationError ||
      error instanceof GoogleAccountConflictError
    ) {
      throw error;
    }

    throw new GoogleAuthenticationError();
  }
}

export function validateGoogleClaims(
  claims: oidc.IDToken,
): claims is oidc.IDToken & {
  sub: string;
  email: string;
  email_verified: true;
  iss: string;
  aud: string | string[];
  exp: number;
} {
  const audience = Array.isArray(claims.aud)
    ? claims.aud
    : [claims.aud];
  const clientId = process.env.GOOGLE_CLIENT_ID;

  return (
    claims.iss === GOOGLE_ISSUER &&
    Boolean(clientId && audience.includes(clientId)) &&
    typeof claims.sub === "string" &&
    typeof claims.email === "string" &&
    claims.email_verified === true &&
    typeof claims.exp === "number" &&
    claims.exp > Math.floor(Date.now() / 1000)
  );
}

export function validateGoogleNonce(
  claims: oidc.IDToken,
  expectedNonce: string,
): boolean {
  return claims.nonce === expectedNonce;
}

export async function findOrCreateGoogleUser(identity: {
  sub: string;
  email: string;
  displayName: string;
}): Promise<GoogleAuthUser> {
  const existingGoogleUser = await UserModel.findOne({
    googleSub: identity.sub,
  });

  if (existingGoogleUser) {
    return toGoogleAuthUser(existingGoogleUser);
  }

  const existingEmailUser = await UserModel.findOne({
    email: identity.email.trim().toLowerCase(),
  });

  if (existingEmailUser) {
    throw new GoogleAccountConflictError();
  }

  try {
    const user = await UserModel.create({
      email: identity.email.trim().toLowerCase(),
      displayName: identity.displayName.trim().slice(0, 80) || "SecureChat user",
      emailVerified: true,
      googleSub: identity.sub,
    });

    return toGoogleAuthUser(user);
  } catch (error: unknown) {
    if (isDuplicateKeyError(error)) {
      const user = await UserModel.findOne({ googleSub: identity.sub });

      if (user) {
        return toGoogleAuthUser(user);
      }

      throw new GoogleAccountConflictError();
    }

    throw error;
  }
}

function toGoogleAuthUser(user: {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}): GoogleAuthUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    emailVerified: user.emailVerified,
  };
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === 11000
  );
}