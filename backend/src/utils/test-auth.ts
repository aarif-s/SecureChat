import "dotenv/config";

const baseUrl = "http://localhost:5000";

async function main(): Promise<void> {
  const email = `auth-test-${Date.now()}@securechat.local`;
  const password = "TestPassword123456!";

  console.log("\n--- REGISTER ---");

  const registerResponse = await fetch(
    `${baseUrl}/api/auth/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        displayName: "Auth Test",
      }),
    },
  );

  console.log("Registration status:", registerResponse.status);

  if (registerResponse.status !== 201) {
    throw new Error("Registration failed.");
  }

  const setCookie = registerResponse.headers.get(
    "set-cookie",
  );

  console.log("Set-Cookie received:", Boolean(setCookie));

  if (!setCookie) {
    throw new Error(
      "Registration did not return Set-Cookie.",
    );
  }

  /*
   * Only keep the cookie pair.
   * Never log the actual session value.
   */
  const cookie = setCookie.split(";")[0];

  console.log("Cookie name:", cookie.split("=")[0]);

  console.log("\n--- /ME ---");

  const meResponse = await fetch(
    `${baseUrl}/api/auth/me`,
    {
      method: "GET",
      headers: {
        Cookie: cookie,
      },
    },
  );

  console.log("ME status:", meResponse.status);

  if (meResponse.status !== 200) {
    throw new Error("Authenticated user lookup failed.");
  }

  console.log("\n--- LOGOUT ---");

  const logoutResponse = await fetch(
    `${baseUrl}/api/auth/logout`,
    {
      method: "POST",
      headers: {
        Cookie: cookie,
      },
    },
  );

  console.log("Logout status:", logoutResponse.status);

  if (logoutResponse.status !== 204) {
    throw new Error("Logout failed.");
  }

  const loggedOutMeResponse = await fetch(
    `${baseUrl}/api/auth/me`,
    {
      method: "GET",
      headers: {
        Cookie: cookie,
      },
    },
  );

  console.log("Post-logout ME status:", loggedOutMeResponse.status);

  if (loggedOutMeResponse.status !== 401) {
    throw new Error("Logged-out session remained valid.");
  }

  console.log("\n--- LOGIN ---");

  const loginResponse = await fetch(
    `${baseUrl}/api/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
      }),
    },
  );

  console.log("Login status:", loginResponse.status);

  if (loginResponse.status !== 200) {
    throw new Error("Login failed.");
  }

  const loginCookie = loginResponse.headers.get("set-cookie");

  console.log("Login Set-Cookie received:", Boolean(loginCookie));

  if (!loginCookie) {
    throw new Error("Login did not return Set-Cookie.");
  }

  const authenticatedCookie = loginCookie.split(";")[0];
  const loggedInMeResponse = await fetch(
    `${baseUrl}/api/auth/me`,
    {
      method: "GET",
      headers: {
        Cookie: authenticatedCookie,
      },
    },
  );

  console.log("Post-login ME status:", loggedInMeResponse.status);

  if (loggedInMeResponse.status !== 200) {
    throw new Error("Newly created session was not valid.");
  }
}

void main().catch(() => {
  console.error("Authentication verification failed.");
  process.exitCode = 1;
});
