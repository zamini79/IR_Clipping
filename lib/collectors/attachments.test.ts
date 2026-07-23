import { describe, it, expect, vi } from "vitest";
import { storagePathFor, uploadAttachment } from "./attachments";

describe("storagePathFor", () => {
  it("builds board/sourceRef/filename path, sanitizing", () => {
    expect(storagePathFor("fss-bodo", "1182", "사업보고서 개정.pdf"))
      .toBe("fss-bodo/1182/사업보고서_개정.pdf");
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
    expect(deps.fetchBytes).toHaveBeenCalledWith("https://x/a.pdf");
    expect(deps.upload).toHaveBeenCalledWith("fss-bodo/1182/a.pdf", bytes);
    expect(r).toEqual({ storagePath: "fss-bodo/1182/a.pdf", size: "4B", externalUrl: "https://x/a.pdf" });
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
