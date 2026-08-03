/**
 * Email utility.
 *
 * Sends transactional email via the Brevo REST API (HTTPS, no SMTP).
 * In development without BREVO_API_KEY, the OTP is logged to the server
 * console and returned as `devOtp` in the API response so the flow can be
 * tested without a mail account.
 */

const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

interface SendOtpOptions {
  to: string;
  name: string;
  otp: string;
}

interface SendOtpResult {
  sent: boolean;
  devOtp?: string; // only present in dev when BREVO_API_KEY is not configured
}

export async function sendActivationOtp({ to, name, otp }: SendOtpOptions): Promise<SendOtpResult> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    // Development fallback — log and return OTP in response
    console.info(`[email] OTP for ${name} <${to}>: ${otp}`);
    if (process.env.NODE_ENV === "production") {
      // In production without the API key this is a misconfiguration — fail loudly
      throw new Error("BREVO_API_KEY is not configured. Cannot send activation email.");
    }
    return { sent: false, devOtp: otp };
  }

  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!senderEmail) {
    throw new Error("BREVO_SENDER_EMAIL is not configured. Cannot send activation email.");
  }

  const senderName = process.env.BREVO_SENDER_NAME ?? "EvenSteven";

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to, name }],
    subject: "Your EvenSteven activation code",
    textContent: [
      `Hi ${name},`,
      ``,
      `Your one-time activation code is:`,
      ``,
      `  ${otp}`,
      ``,
      `It expires in 15 minutes. Enter it to activate your account and choose a PIN.`,
      ``,
      `If you didn't request this, you can safely ignore this email.`,
    ].join("\n"),
    htmlContent: `
      <p>Hi ${name},</p>
      <p>Your one-time activation code is:</p>
      <p style="font-size:2em;letter-spacing:0.3em;font-weight:bold">${otp}</p>
      <p>It expires in 15 minutes. Enter it to activate your account and choose a PIN.</p>
      <p style="color:#666;font-size:0.9em">If you didn't request this, you can safely ignore this email.</p>
    `,
  };

  console.info("[email] Sending email via Brevo API");
  let response: Response;
  try {
    response = await fetch(BREVO_API_URL, {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[email] Brevo API request failed", err);
    throw err;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "(no body)");
    console.error("[email] Brevo API error", response.status, body);
    throw new Error(`Brevo API returned ${response.status}`);
  }

  return { sent: true };
}
