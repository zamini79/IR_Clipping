export type Category = "disclosure" | "fnguide";

export interface ClippingFile {
  id: string;
  name: string;
  size: string;
  storagePath: string;
}

export interface Clipping {
  id: string;
  category: Category;
  title: string;
  source: string;
  department: string;
  body: string;
  collectedAt: string; // ISO string
  createdAt: string; // ISO string
  files: ClippingFile[];
}
