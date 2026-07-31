import { readdir, readFile, writeFile } from "node:fs/promises";
import { getAddress } from "viem";

const OUTPUT = new URL("../public/data/market-state.json", import.meta.url);
const HISTORY_MANIFEST = new URL(
  "../public/data/history-manifest.json",
  import.meta.url,
);
const HISTORY = new URL("../public/data/history/", import.meta.url);
const RAW_LOG_CACHE = new URL("../.cache/market-logs/", import.meta.url);
const CONTRACT = "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB";
const ASSIGN_TOPIC =
  "0x8a0e37b73a0d9c82e205d4d1a3ff3d0b57ce5f4d7bccf6bac03336dc101cb7ba";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const manifest = JSON.parse(await readFile(HISTORY_MANIFEST, "utf8"));
const owners = Array(10_000).fill(null);
const assignments = new Map();

// The event archive cache contains overlapping retrieval pages by design.
// Deduplicating by transaction hash and log index recovers the 10,000 original
// Assign events without another RPC or hosted indexer request.
for (const filename of await readdir(RAW_LOG_CACHE)) {
  if (!filename.endsWith(".json")) continue;
  const logs = JSON.parse(
    await readFile(new URL(filename, RAW_LOG_CACHE), "utf8"),
  );
  for (const log of logs) {
    if (log.topics?.[0]?.toLowerCase() !== ASSIGN_TOPIC) continue;
    assignments.set(`${log.transactionHash}:${log.logIndex}`, log);
  }
}

if (assignments.size !== 10_000) {
  throw new Error(
    `Expected 10,000 unique Assign events, received ${assignments.size}. Run npm run data:history to restore the raw log cache.`,
  );
}

for (const log of assignments.values()) {
  const id = Number(BigInt(log.data));
  const address = `0x${log.topics[1].slice(-40)}`;
  owners[id] = getAddress(address);
}

const punks = owners.map((owner) => ({
  owner,
  offer: null,
  bid: null,
}));
let latestEventTimestamp = 0;
let replayedEvents = 0;

for (const shard of manifest.shards) {
  const contents = JSON.parse(
    await readFile(new URL(shard.file, HISTORY), "utf8"),
  );
  for (const [idText, events] of Object.entries(contents.punks)) {
    const punk = punks[Number(idText)];
    for (const event of events) {
      latestEventTimestamp = Math.max(latestEventTimestamp, event.timestamp);
      replayedEvents += 1;
      switch (event.type) {
        case "transfer":
          punk.owner = getAddress(event.to);
          break;
        case "offered":
          punk.offer = {
            seller: punk.owner,
            valueWei: event.valueWei,
            onlyTo:
              event.onlyTo.toLowerCase() === ZERO_ADDRESS
                ? ZERO_ADDRESS
                : getAddress(event.onlyTo),
          };
          break;
        case "offer-withdrawn":
          punk.offer = null;
          break;
        case "bid":
          punk.bid = {
            bidder: getAddress(event.from),
            valueWei: event.valueWei,
          };
          break;
        case "bid-withdrawn":
          punk.bid = null;
          break;
        case "bought":
          punk.owner = getAddress(event.to);
          punk.offer = null;
          punk.bid = null;
          break;
      }
    }
  }
  process.stdout.write(
    `Replayed ${shard.to + 1}/10000 Punk histories\n`,
  );
}

if (replayedEvents !== manifest.totals.decodedEvents) {
  throw new Error(
    `Expected ${manifest.totals.decodedEvents} replay events, received ${replayedEvents}.`,
  );
}
if (punks.some((punk) => !punk.owner)) {
  throw new Error("At least one Punk has no reconstructed owner.");
}

const byOwner = new Map();
for (const [id, punk] of punks.entries()) {
  const key = punk.owner.toLowerCase();
  if (key === ZERO_ADDRESS) continue;
  const entry = byOwner.get(key) ?? { address: punk.owner, punks: [] };
  entry.punks.push(id);
  byOwner.set(key, entry);
}
const ownerRankings = [...byOwner.values()]
  .map((owner) => ({ ...owner, count: owner.punks.length }))
  .sort((a, b) => b.count - a.count || a.address.localeCompare(b.address));
const openOffers = punks.filter((punk) => punk.offer);
const openBids = punks.filter((punk) => punk.bid);
const burned = punks.filter(
  (punk) => punk.owner.toLowerCase() === ZERO_ADDRESS,
);

const snapshot = {
  schema: "https://cryptopunks.website/schemas/punks-market-state-v1.json",
  source: {
    chainId: 1,
    blockNumber: String(manifest.source.snapshotBlock),
    timestamp: latestEventTimestamp,
    timestampBasis: "latest decoded CryptoPunksMarket event at or before checkpoint",
    contract: CONTRACT,
    derivation:
      "Original Assign events plus ordered replay of PunkTransfer, PunkOffered, PunkBidEntered, PunkBidWithdrawn, PunkBought and PunkNoLongerForSale",
  },
  totals: {
    punks: punks.length,
    owners: ownerRankings.length,
    burned: burned.length,
    openOffers: openOffers.length,
    openBids: openBids.length,
    publicOffers: openOffers.filter(
      (punk) => punk.offer.onlyTo.toLowerCase() === ZERO_ADDRESS,
    ).length,
  },
  owners: ownerRankings,
  punks,
};

await writeFile(OUTPUT, `${JSON.stringify(snapshot)}\n`, "utf8");
process.stdout.write(
  `Wrote checkpoint at block ${manifest.source.snapshotBlock}: ${ownerRankings.length.toLocaleString()} owners, ${burned.length} burned, ${openOffers.length.toLocaleString()} offers and ${openBids.length.toLocaleString()} bids\n`,
);
