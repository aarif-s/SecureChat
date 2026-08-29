import { useState, type FormEvent } from "react";

import {
  getErrorMessage,
  login,
} from "../../services/auth";
import type { AuthUser } from "../../types/auth";
import "./login-page.css";

interface LoginPageProps {
  onLogin: (user: AuthUser) => void;
  onShowSignUp: () => void;
}

function LoginPage({
  onLogin,
  onShowSignUp,
}: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await login(email, password);
      onLogin(response.user);
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
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

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

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
