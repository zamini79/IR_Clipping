import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMail = vi.fn();
const close = vi.fn();
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail, close }) },
}));

const { sendDigest } = await import("./mailer");

const digest = { subject: "s", html: "<p>h</p>", text: "t" };

beforeEach(() => {
  sendMail.mockReset();
  close.mockReset();
  process.env.GMAIL_USER = "sender@gmail.com";
  process.env.GMAIL_APP_PASSWORD = "pw";
});
afterEach(() => {
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
});

describe("sendDigest", () => {
  it("sends one message per recipient, each addressed only to that person", async () => {
    sendMail.mockImplementation(async ({ to }: { to: string }) => ({ accepted: [to], rejected: [], messageId: `<${to}>` }));
    const r = await sendDigest(["a@sk.com", "b@sk.com", "c@sk.com"], digest);
    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(sendMail.mock.calls.map((c) => c[0].to)).toEqual(["a@sk.com", "b@sk.com", "c@sk.com"]);
    expect(r!.accepted).toEqual(["a@sk.com", "b@sk.com", "c@sk.com"]);
    expect(r!.messageIds).toHaveLength(3);
  });

  it("keeps delivering after one recipient throws, and reports it", async () => {
    sendMail.mockImplementation(async ({ to }: { to: string }) => {
      if (to === "bad@sk.com") throw new Error("550 rejected");
      return { accepted: [to], rejected: [], messageId: `<${to}>` };
    });
    const r = await sendDigest(["a@sk.com", "bad@sk.com", "c@sk.com"], digest);
    expect(sendMail).toHaveBeenCalledTimes(3); // the failure didn't abort the batch
    expect(r!.accepted).toEqual(["a@sk.com", "c@sk.com"]);
    expect(r!.failed).toEqual([{ email: "bad@sk.com", error: "550 rejected" }]);
  });

  it("collects addresses the server refused", async () => {
    sendMail.mockResolvedValue({ accepted: [], rejected: ["x@sk.com"], messageId: "<1>" });
    const r = await sendDigest(["x@sk.com"], digest);
    expect(r!.accepted).toEqual([]);
    expect(r!.rejected).toEqual(["x@sk.com"]);
  });

  it("returns null without sending when there are no recipients", async () => {
    expect(await sendDigest([], digest)).toBeNull();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("throws when the Gmail credentials are missing", async () => {
    delete process.env.GMAIL_APP_PASSWORD;
    await expect(sendDigest(["a@sk.com"], digest)).rejects.toThrow(/GMAIL/);
  });

  it("closes the pooled connection even if a send throws", async () => {
    sendMail.mockRejectedValue(new Error("boom"));
    await sendDigest(["a@sk.com"], digest);
    expect(close).toHaveBeenCalled();
  });
});
