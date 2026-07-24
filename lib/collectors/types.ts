export interface CollectedFile {
  name: string;
  externalUrl: string;
  // Optional request headers (e.g. { Cookie, Referer }) needed to download this
  // file — used for login-gated sources like KLCA. Runtime-only; never persisted.
  headers?: Record<string, string>;
}
export interface CollectedItem {
  board: string;
  source: string;
  sourceRef: string;
  title: string;
  department: string;
  collectedAt: string; // ISO
  sourceUrl: string;
  body: string;
  files: CollectedFile[];
}
export interface Collector {
  board: string;
  source: string;
  collect(): Promise<CollectedItem[]>;
}
