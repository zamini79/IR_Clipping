export type Category = "disclosure" | "fnguide";

export interface ClippingFile {
  id: string;
  name: string;
  size: string;
  storagePath: string;
  externalUrl: string;
}

export interface Clipping {
  id: string;
  category: Category;
  board: string;
  title: string;
  source: string;
  sourceRef: string;
  sourceUrl: string;
  department: string;
  body: string;
  collectedAt: string; // ISO string
  createdAt: string; // ISO string
  files: ClippingFile[];
}
