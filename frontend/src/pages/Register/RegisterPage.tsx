import { useState, type FormEvent } from "react";

import {
  getErrorMessage,
  register,
} from "../../services/auth";
import type { AuthUser } from "../../types/auth";
import "../Login/login-page.css";

interface RegisterPageProps {
  onRegister: (user: AuthUser) => void;
  onShowSignIn: () => void;
}

function RegisterPage({
  onRegister,
  onShowSignIn,
}: RegisterPageProps) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): string | null {
    const normalizedDisplayName = displayName.trim();
    const normalizedEmail = email.trim();

    if (normalizedDisplayName.length === 0 || normalizedDisplayName.length > 80) {
      return "Display name must be between 1 and 80 characters.";
    }

    if (
      normalizedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      return "Enter a valid email address.";
    }

    if (password.length < 12 || password.length > 128) {
      return "Password must be between 12 and 128 characters.";
    }

    if (password !== passwordConfirmation) {
      return "Passwords do not match.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await register(
        displayName.trim(),
        email.trim(),
        password,
      );
      onRegister(response.user);
    } catch (submitError: unknown) {
      setError(getErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="register-title">
        <p className="login-eyebrow">SecureChat</p>
        <h1 id="register-title">Create an account</h1>
        <p className="login-description">
          Start your secure conversations.
        </p>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            type="text"
            autoComplete="name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            minLength={1}
            maxLength={80}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="register-email">Email address</label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="register-password">Password</label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={12}
            maxLength={128}
            required
            disabled={isSubmitting}
          />

          <label htmlFor="password-confirmation">Confirm password</label>
          <input
            id="password-confirmation"
            type="password"
            autoComplete="new-password"
            value={passwordConfirmation}
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            minLength={12}
            maxLength={128}
            required
            disabled={isSubmitting}
          />

          {error ? (
            <p className="login-error" role="alert">
              {error}
            </p>
          ) : null}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="login-navigation">
          Already have an account?{" "}
          <button type="button" onClick={onShowSignIn} disabled={isSubmitting}>
            Sign in
          </button>
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;
