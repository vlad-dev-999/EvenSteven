/**
 * Email utility.
 *
 * If SMTP_HOST is configured, sends real email via nodemailer.
 * In development (NODE_ENV !== 'production') without SMTP, the OTP is logged
 * to the server console and returned as `devOtp` in the API response so the
 * flow can be tested without a mail server.
 */

interface SendOtpOptions {
  to: string;
  name: string;
  otp: string;
}

interface SendOtpResult {
  sent: boolean;
  devOtp?: string; // only present in dev when SMTP is not configured
}

export async function sendActivationOtp({ to, name, otp }: SendOtpOptions): Promise<SendOtpResult> {
  const host = process.env.SMTP_HOST;

  if (!host) {
    // Development fallback — log and return OTP in response
    console.info(`[email] OTP for ${name} <${to}>: ${otp}`);
    if (process.env.NODE_ENV === "production") {
      // In production without SMTP this is a misconfiguration — fail loudly
      throw new Error("SMTP_HOST is not configured. Cannot send activation email.");
    }
    return { sent: false, devOtp: otp };
  }

  // Lazy import so nodemailer is only loaded when needed
  const nodemailer = await import("nodemailer");

  const transporter = nodemailer.default.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  });

  const from = process.env.SMTP_FROM ?? `"EvenSteven" <noreply@${host}>`;

  await transporter.sendMail({
    from,
    to: `"${name}" <${to}>`,
    subject: "Your EvenSteven activation code",
    text: [
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
    html: `
      <p>Hi ${name},</p>
      <p>Your one-time activation code is:</p>
      <p style="font-size:2em;letter-spacing:0.3em;font-weight:bold">${otp}</p>
      <p>It expires in 15 minutes. Enter it to activate your account and choose a PIN.</p>
      <p style="color:#666;font-size:0.9em">If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  return { sent: true };
}
