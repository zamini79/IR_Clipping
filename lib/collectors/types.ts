export interface CollectedFile { name: string; externalUrl: string }
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
