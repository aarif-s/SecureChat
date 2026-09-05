import { useState, type FormEvent } from "react";

import {
  getErrorMessage,
  getGoogleLoginUrl,
  login,
  resendVerification,
} from "../../services/auth";
import type { AuthUser } from "../../types/auth";
import "./login-page.css";

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
  onShowSignUp: () => void;
  notice?: string | null;
}

function LoginPage({
  onLogin,
  onShowSignUp,
  notice,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [canResend, setCanResend] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await login(email, password);
      onLogin(response.user);
    } catch (submitError: unknown) {
      const message = getErrorMessage(submitError);
      setError(message);
      setCanResend(message.includes("verify your email"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <p className="login-eyebrow">SecureChat</p>
        <h1 id="login-title">Sign in</h1>
        <p className="login-description">
          Continue to your secure conversations.
        </p>

        {notice ? (
          <p className="login-notice" role="status">
            {notice}
          </p>
        ) : null}

        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            disabled={isSubmitting}
          />

          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          {canResend ? (
            <button
              type="button"
              onClick={async () => {
                setIsResending(true);
                try {
                  await resendVerification(email.trim());
                  setError("If the account can receive email, a new verification link was sent.");
                  setCanResend(false);
                } catch (resendError: unknown) {
                  setError(getErrorMessage(resendError));
                } finally {
                  setIsResending(false);
                }
              }}
              disabled={isSubmitting || isResending}
            >
              {isResending ? "Sending…" : "Resend verification email"}
            </button>
          ) : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <button
          className="google-login-button"
          type="button"
          onClick={() => window.location.assign(getGoogleLoginUrl())}
          disabled={isSubmitting || isResending}
        >
          <svg
            className="google-logo"
            viewBox="0 0 24 24"
            role="img"
            aria-label="Google"
          >
            <path fill="#4285F4" d="M21.35 12.23c0-.78-.07-1.53-.23-2.23H12v4.22h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.69 2.91-4.18 2.91-7.38Z" />
            <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.37l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.53A9.75 9.75 0 0 0 12 21.75Z" />
            <path fill="#FBBC05" d="M6.54 13.82A5.87 5.87 0 0 1 6.23 12c0-.63.11-1.24.31-1.82V7.65H3.3A9.75 9.75 0 0 0 2.25 12c0 1.57.38 3.06 1.05 4.35l3.24-2.53Z" />
            <path fill="#EA4335" d="M12 6.15c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.27 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.7 5.4l3.24 2.53C7.31 7.87 9.46 6.15 12 6.15Z" />
          </svg>
          Continue with Google
        </button>

        <p className="login-navigation">
          New to SecureChat?{" "}
          <button type="button" onClick={onShowSignUp} disabled={isSubmitting}>
            Create an account
          </button>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;
