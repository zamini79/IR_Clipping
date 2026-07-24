import { describe, it, expect, vi } from "vitest";
import { storagePathFor, uploadAttachment } from "./attachments";

describe("storagePathFor", () => {
  it("keeps ASCII names, replacing spaces with underscore", () => {
    expect(storagePathFor("fss-bodo", "1182", "report v2.pdf"))
      .toBe("fss-bodo/1182/report_v2.pdf");
  });
  it("collapses unsafe (Korean/parenthesis) runs to a single underscore for a valid Storage key", () => {
    // Korean + space + parens are all rejected by Supabase Storage keys.
    expect(storagePathFor("fss-bodo", "1182", "사업보고서 개정.pdf"))
      .toBe("fss-bodo/1182/_.pdf");
    expect(storagePathFor("fsc-reg", "87392", "공고(인가).hwpx"))
      .toBe("fsc-reg/87392/_.hwpx");
  });
});

describe("uploadAttachment", () => {
  const file = { name: "a.pdf", externalUrl: "https://x/a.pdf" };

  it("downloads then uploads and returns storagePath+size", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const deps = {
      fetchBytes: vi.fn().mockResolvedValue(bytes),
      upload: vi.fn().mockResolvedValue(undefined),
    };
    const r = await uploadAttachment(deps, "fss-bodo", "1182", file);
    expect(deps.fetchBytes).toHaveBeenCalledWith("https://x/a.pdf", undefined, undefined);
    expect(deps.upload).toHaveBeenCalledWith("fss-bodo/1182/a.pdf", bytes);
    expect(r).toEqual({ storagePath: "fss-bodo/1182/a.pdf", size: "4B", externalUrl: "https://x/a.pdf" });
  });

  it("passes per-file auth headers to fetchBytes", async () => {
    const deps = {
      fetchBytes: vi.fn().mockResolvedValue(new Uint8Array([1])),
      upload: vi.fn().mockResolvedValue(undefined),
    };
    const authed = { name: "b.pdf", externalUrl: "https://x/b.pdf", headers: { Cookie: "s=1" } };
    await uploadAttachment(deps, "klca-doc", "2613", authed);
    expect(deps.fetchBytes).toHaveBeenCalledWith("https://x/b.pdf", { Cookie: "s=1" }, undefined);
  });

  it("returns null (does not throw) when download fails", async () => {
    const deps = {
      fetchBytes: vi.fn().mockRejectedValue(new Error("timeout")),
      upload: vi.fn(),
    };
    const r = await uploadAttachment(deps, "fss-bodo", "1182", file);
    expect(r).toBeNull();
    expect(deps.upload).not.toHaveBeenCalled();
  });
});
