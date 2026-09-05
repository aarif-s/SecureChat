const EMAIL_VERIFICATION_URL_BASE = () =>
  process.env.EMAIL_VERIFICATION_URL_BASE ??
  `${process.env.API_URL ?? "http://localhost:5000"}/api/auth/verify-email`;

export async function sendVerificationEmail(
  email: string,
  token: string,
): Promise<void> {
  const provider = process.env.EMAIL_PROVIDER;
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (provider !== "resend" || !apiKey || !from) {
    throw new Error("Email delivery is not configured.");
  }

  const verificationUrl = new URL(EMAIL_VERIFICATION_URL_BASE());
  verificationUrl.searchParams.set("token", token);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Verify your SecureChat email",
      text: `Verify your SecureChat email by opening this link: ${verificationUrl.href}`,
    }),
  });

  if (!response.ok) {
    throw new Error("Email delivery failed.");
  }
}