import type { CollectedFile } from "./types";

export interface AttachmentDeps {
  fetchBytes: (url: string) => Promise<Uint8Array>;
  upload: (path: string, bytes: Uint8Array) => Promise<void>;
}

function humanSize(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
}

export function storagePathFor(board: string, sourceRef: string, name: string): string {
  const safe = name.trim().replace(/\s+/g, "_").replace(/[\/\\]/g, "_");
  const ref = sourceRef.replace(/[^A-Za-z0-9._-]/g, "_");
  return `${board}/${ref}/${safe}`;
}

export async function uploadAttachment(
  deps: AttachmentDeps,
  board: string,
  sourceRef: string,
  file: CollectedFile
): Promise<{ storagePath: string; size: string; externalUrl: string } | null> {
  try {
    const bytes = await deps.fetchBytes(file.externalUrl);
    const path = storagePathFor(board, sourceRef, file.name);
    await deps.upload(path, bytes);
    return { storagePath: path, size: humanSize(bytes.byteLength), externalUrl: file.externalUrl };
  } catch {
    return null;
  }
}
