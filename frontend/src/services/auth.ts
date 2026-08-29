import type { AuthResponse, AuthUser } from "../types/auth";

const apiBaseUrl = (
  import.meta.env.VITE_API_URL ?? "http://localhost:5000"
).replace(/\/$/, "");

interface ErrorResponse {
  error: string;
}

class ApiError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function isErrorResponse(value: unknown): value is ErrorResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof value.error === "string"
  );
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      isErrorResponse(body)
        ? body.error
        : "Unable to complete the request.";

    throw new ApiError(message, response.status);
  }

  return body as T;
}

export function getCurrentUser(): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/me");
}

export function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(
  displayName: string,
  email: string,
  password: string,
): Promise<AuthResponse> {
  return request<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ displayName, email, password }),
  });
}

export async function logout(): Promise<void> {
  await request<null>("/api/auth/logout", {
    method: "POST",
  });
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Unable to complete the request.";
}

export type { AuthUser };
