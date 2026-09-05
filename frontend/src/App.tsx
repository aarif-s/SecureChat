import { useEffect, useState } from "react";

import LoginPage from "./pages/Login/LoginPage";
import RegisterPage from "./pages/Register/RegisterPage";
import ChatPage from "./pages/Chat/ChatPage";
import {
  getCurrentUser,
  getErrorMessage,
  isUnauthorizedError,
} from "./services/auth";
import type { AuthUser } from "./types/auth";

type AuthPage = "sign-in" | "sign-up";

function getInitialAuthNotice(): string | null {
  const params = new URLSearchParams(window.location.search);

  if (params.get("emailVerified") === "1") {
    return "Your email is verified. You can now sign in.";
  }

  if (params.get("authError") === "google-account-conflict") {
    return "Use your existing email and password to sign in to this account.";
  }

  if (params.get("authError") === "google-failed") {
    return "Google sign-in was cancelled or could not be completed.";
  }

  return null;
}

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authPage, setAuthPage] = useState<AuthPage>("sign-in");
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(
    getInitialAuthNotice,
  );

  useEffect(() => {
    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    async function loadSession() {
      try {
        const response = await getCurrentUser();
        setUser(response.user);
      } catch (error: unknown) {
        if (!isUnauthorizedError(error)) {
          setSessionError(getErrorMessage(error));
        }
      } finally {
        setIsLoadingSession(false);
      }
    }

    void loadSession();
  }, []);

  if (isLoadingSession) {
    return <main className="app-status">Checking your session…</main>;
  }

  if (!user) {
    return (
      <>
        {sessionError ? (
          <p className="app-error" role="alert">
            {sessionError}
          </p>
        ) : null}
        {authPage === "sign-in" ? (
          <LoginPage
            onLogin={(authenticatedUser) => {
              setSessionError(null);
              setAuthNotice(null);
              setUser(authenticatedUser);
            }}
            onShowSignUp={() => setAuthPage("sign-up")}
            notice={authNotice}
          />
        ) : (
          <RegisterPage
            onRegister={() => {
              setAuthPage("sign-in");
              setAuthNotice("Account created. Check your email for a verification link before signing in.");
            }}
            onShowSignIn={() => setAuthPage("sign-in")}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ChatPage
        user={user}
        onLogout={() => setUser(null)}
      />
      {sessionError ? (
        <p className="app-error" role="alert">
          {sessionError}
        </p>
      ) : null}
    </>
  );
}

export default App;
