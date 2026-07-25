import type { CollectedFile } from "./types";

export interface AttachmentDeps {
  fetchBytes: (
    url: string,
    headers?: Record<string, string>,
    postForm?: Record<string, string>
  ) => Promise<Uint8Array>;
  upload: (path: string, bytes: Uint8Array, contentType: string) => Promise<void>;
}

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  zip: "application/zip",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

/**
 * MIME type to store an attachment under. Supabase Storage defaults uploads to
 * `text/plain;charset=UTF-8`, which stops browsers from rendering PDFs inline,
 * so every upload must pass an explicit type.
 *
 * hwp/hwpx intentionally fall through to `application/octet-stream`: the
 * Hancom-specific types (application/x-hwp …) make browsers hand the file to
 * the local 한컴 web handler (rhwp) instead of simply saving it.
 */
export function contentTypeFor(name: string): string {
  const ext = (name.match(/\.([A-Za-z0-9]+)$/) ?? [])[1]?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
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
    await deps.upload(path, bytes, contentTypeFor(file.name));
    return { storagePath: path, size: humanSize(bytes.byteLength), externalUrl: file.externalUrl };
  } catch {
    return null;
  }
}
