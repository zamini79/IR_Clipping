import nodemailer from "nodemailer";

/** Gmail SMTP, pooled so a batch reuses one authenticated connection. */
function openTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error("Missing GMAIL_USER / GMAIL_APP_PASSWORD");
  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user, pass },
    pool: true,
    maxConnections: 1,
  });
  return { user, transport };
}

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
  const { user, transport } = openTransport();

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

/**
 * 운영자에게 보내는 발송 실패 알림.
 *
 * 다이제스트 수신자와 분리된 주소로 보낸다(`OPS_ALERT_EMAIL`, 쉼표로 여러 명).
 * 값이 없으면 발신 계정 자신에게 보내 알림이 어디로도 못 가는 일을 막는다 —
 * 이 저장소는 공개 레포라 주소를 코드에 박지 않는다.
 *
 * 실패 알림이 실패해도 수집 파이프라인을 멈추면 안 되므로 절대 throw하지 않고
 * 성공 여부만 돌려준다.
 */
export async function sendOpsAlert(subject: string, lines: string[]): Promise<boolean> {
  const to = (process.env.OPS_ALERT_EMAIL ?? process.env.GMAIL_USER ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (to.length === 0) return false;

  const text = lines.join("\n");
  try {
    const { user, transport } = openTransport();
    try {
      for (const addr of to) {
        await transport.sendMail({
          from: `IR 클리핑 알림 <${user}>`,
          to: addr,
          subject,
          text,
          html: `<pre style="font:13px/1.7 'Pretendard','Malgun Gothic',sans-serif;white-space:pre-wrap">${lines
            .map((l) => l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
            .join("\n")}</pre>`,
        });
      }
    } finally {
      transport.close();
    }
    return true;
  } catch (e) {
    console.error("[collect] ops alert failed:", e instanceof Error ? e.message : String(e));
    return false;
  }
}
