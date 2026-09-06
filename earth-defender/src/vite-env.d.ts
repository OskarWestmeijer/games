/// <reference types="vite/client" />

declare module 'virtual:model-manifest' {
  export interface ModelEntry {
    url: string;
    name: string;
    source: string;
    thumbnail: string | null;
    sizeBytes: number;
  }
  export const models: ModelEntry[];
}
