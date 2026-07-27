import nodemailer from "nodemailer";

export interface SendResult {
  accepted: string[];
  rejected: string[];
  messageId: string;
  response: string;
}

/**
 * Sends the digest to every recipient in one message.
 *
 * Returns what the SMTP server said per address: silently dropping this is how
 * a recipient can stop receiving mail without anyone noticing. `accepted` only
 * means Gmail took the address — the receiving domain can still quarantine it.
 */
export async function sendDigest(
  recipients: string[],
  digest: { subject: string; html: string; text: string }
): Promise<SendResult | null> {
  if (recipients.length === 0) return null;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Missing GMAIL_USER / GMAIL_APP_PASSWORD");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  const info = await transport.sendMail({
    from: `IR 클리핑 <${user}>`,
    to: recipients.join(", "),
    subject: digest.subject,
    text: digest.text,
    html: digest.html,
  });
  return {
    accepted: (info.accepted ?? []).map(String),
    rejected: (info.rejected ?? []).map(String),
    messageId: info.messageId ?? "",
    response: info.response ?? "",
  };
}
