import { useState, type FormEvent } from "react";

import {
  getErrorMessage,
  getGoogleLoginUrl,
  register,
} from "../../services/auth";
import "../Login/login-page.css";

interface RegisterPageProps {
  onRegister: () => void;
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
      if (response.emailVerificationRequired) {
        onRegister();
      }
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

        <button
          className="google-login-button"
          type="button"
          onClick={() => window.location.assign(getGoogleLoginUrl())}
          disabled={isSubmitting}
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
