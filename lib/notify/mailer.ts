import nodemailer from "nodemailer";

export interface SendResult {
  /** Addresses the mail server took. */
  accepted: string[];
  /** Addresses the mail server refused. */
  rejected: string[];
  /** Addresses whose send threw (connection, auth, rate limit…). */
  failed: { email: string; error: string }[];
  messageIds: string[];
}

/**
 * Sends the digest to each recipient as its own message.
 *
 * One message addressed to everyone was accepted by Gmail but only reached some
 * inboxes — a corporate gateway will treat an external sender with a list of
 * internal recipients as bulk mail. Separate messages also keep the recipient
 * list private and isolate failures: one bad address no longer decides whether
 * anyone else is reached.
 */
export async function sendDigest(
  recipients: string[],
  digest: { subject: string; html: string; text: string }
): Promise<SendResult | null> {
  if (recipients.length === 0) return null;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Missing GMAIL_USER / GMAIL_APP_PASSWORD");

  // Pooled so the whole batch reuses one authenticated connection.
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,
    maxConnections: 1,
  });

  const result: SendResult = { accepted: [], rejected: [], failed: [], messageIds: [] };
  try {
    for (const to of recipients) {
      try {
        const info = await transport.sendMail({
          from: `IR 클리핑 <${user}>`,
          to,
          subject: digest.subject,
          text: digest.text,
          html: digest.html,
        });
        result.accepted.push(...(info.accepted ?? []).map(String));
        result.rejected.push(...(info.rejected ?? []).map(String));
        if (info.messageId) result.messageIds.push(info.messageId);
      } catch (e) {
        // Keep going: the remaining recipients shouldn't lose their mail.
        result.failed.push({ email: to, error: e instanceof Error ? e.message : String(e) });
      }
    }
  } finally {
    transport.close();
  }
  return result;
}
