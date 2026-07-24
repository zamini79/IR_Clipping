import type { CollectedFile } from "./types";

export interface AttachmentDeps {
  fetchBytes: (
    url: string,
    headers?: Record<string, string>,
    postForm?: Record<string, string>
  ) => Promise<Uint8Array>;
  upload: (path: string, bytes: Uint8Array) => Promise<void>;
}

export function humanSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}

// Supabase Storage object keys must be ASCII-safe; Korean/parenthesis/space
// characters are rejected with "Invalid key". Replace any run of unsafe chars
// with a single underscore. The human-readable filename is preserved separately
// in clipping_files.name; this only affects the storage key.
function safeSegment(s: string): string {
  return s.trim().replace(/[^A-Za-z0-9._-]+/g, "_") || "file";
}

export function storagePathFor(board: string, sourceRef: string, name: string): string {
  return `${safeSegment(board)}/${safeSegment(sourceRef)}/${safeSegment(name)}`;
}

export async function uploadAttachment(
  deps: AttachmentDeps,
  board: string,
  sourceRef: string,
  file: CollectedFile
): Promise<{ storagePath: string; size: string; externalUrl: string } | null> {
  try {
    const bytes = await deps.fetchBytes(file.externalUrl, file.headers, file.postForm);
    const path = storagePathFor(board, sourceRef, file.name);
    await deps.upload(path, bytes);
    return { storagePath: path, size: humanSize(bytes.byteLength), externalUrl: file.externalUrl };
  } catch {
    return null;
  }
}
