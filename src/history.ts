export type MarketEventType =
  | "transfer"
  | "offered"
  | "bid"
  | "bid-withdrawn"
  | "bought"
  | "offer-withdrawn";

export type MarketEvent = {
  block: number;
  timestamp: number;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  type: MarketEventType;
  valueWei?: string;
  from?: string;
  to?: string;
  onlyTo?: string;
};

export type HistoryManifest = {
  source: {
    chainId: number;
    contract: string;
    deploymentBlock: number;
    snapshotBlock: number;
    retrieval: string;
    eventNames: string[];
  };
  totals: {
    rawLogs: number;
    decodedEvents: number;
    punksWithHistory: number;
  };
  shards: Array<{
    file: string;
    from: number;
    to: number;
    events: number;
    sha256: string;
  }>;
};

type HistoryShard = {
  range: { from: number; to: number };
  punks: Record<string, MarketEvent[]>;
};

let manifestPromise: Promise<HistoryManifest> | undefined;
const shardPromises = new Map<number, Promise<HistoryShard>>();

export function loadHistoryManifest() {
  manifestPromise ??= fetch(contentUrl("data/history-manifest.json")).then(
    async (response) => {
      if (!response.ok) throw new Error("History manifest is unavailable.");
      return (await response.json()) as HistoryManifest;
    },
  );
  return manifestPromise;
}

export async function loadPunkHistory(id: number) {
  const shardIndex = Math.floor(id / 100);
  let shardPromise = shardPromises.get(shardIndex);
  if (!shardPromise) {
    const filename = `${String(shardIndex).padStart(2, "0")}.json`;
    shardPromise = fetch(contentUrl(`data/history/${filename}`)).then(async (response) => {
      if (!response.ok) throw new Error(`History shard ${filename} is unavailable.`);
      return (await response.json()) as HistoryShard;
    });
    shardPromises.set(shardIndex, shardPromise);
  }
  const [manifest, shard] = await Promise.all([
    loadHistoryManifest(),
    shardPromise,
  ]);
  return {
    events: shard.punks[String(id)] ?? [],
    manifest,
  };
}
import { contentUrl } from "./paths";
