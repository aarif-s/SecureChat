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

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authPage, setAuthPage] = useState<AuthPage>("sign-in");
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  useEffect(() => {
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
              setUser(authenticatedUser);
            }}
            onShowSignUp={() => setAuthPage("sign-up")}
          />
        ) : (
          <RegisterPage
            onRegister={(authenticatedUser) => {
              setSessionError(null);
              setUser(authenticatedUser);
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
