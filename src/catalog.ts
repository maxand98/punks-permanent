export type CatalogSnapshot = {
  schema: string;
  source: {
    chainId: number;
    blockNumber: string;
    contract: string;
    method: string;
  };
  counts: {
    types: Record<string, number>;
    attributes: Record<string, number>;
    attributeNumbers: Record<string, number>;
  };
  punks: string[][];
};

let catalogPromise: Promise<CatalogSnapshot> | undefined;

export function loadCatalog() {
  catalogPromise ??= fetch(contentUrl("data/punks-attributes.json")).then(
    async (response) => {
      if (!response.ok) {
        throw new Error("The deterministic attribute snapshot is unavailable.");
      }
      return (await response.json()) as CatalogSnapshot;
    },
  );
  return catalogPromise;
}

export function typeDescription(type: string, count: number) {
  return `One of ${count.toLocaleString()} ${normalizePunkType(type)} Punks.`;
}

export function normalizePunkType(type: string) {
  return type.replace(/ [1-4]$/, "");
}
import { contentUrl } from "./paths";
