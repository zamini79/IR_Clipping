import nodemailer from "nodemailer";

export async function sendDigest(
  recipients: string[],
  digest: { subject: string; html: string; text: string }
): Promise<void> {
  if (recipients.length === 0) return;
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Missing GMAIL_USER / GMAIL_APP_PASSWORD");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });
  await transport.sendMail({
    from: user,
    to: recipients.join(", "),
    subject: digest.subject,
    text: digest.text,
    html: digest.html,
  });
}
