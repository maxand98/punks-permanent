import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { getAddress } from "viem";

const RAW_LOG_CACHE = new URL("../.cache/market-logs/", import.meta.url);
const HISTORY = new URL("../public/data/history/", import.meta.url);
const MANIFEST = new URL(
  "../public/data/history-manifest.json",
  import.meta.url,
);
const LEGACY_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const transfers = new Map();

for (const filename of await readdir(RAW_LOG_CACHE)) {
  if (!filename.endsWith(".json")) continue;
  const logs = JSON.parse(
    await readFile(new URL(filename, RAW_LOG_CACHE), "utf8"),
  );
  for (const log of logs) {
    if (log.topics?.[0]?.toLowerCase() !== LEGACY_TRANSFER_TOPIC) continue;
    transfers.set(`${log.transactionHash}:${log.logIndex}`, {
      transactionHash: log.transactionHash,
      logIndex: Number(BigInt(log.logIndex)),
      from: getAddress(`0x${log.topics[1].slice(-40)}`),
      to: getAddress(`0x${log.topics[2].slice(-40)}`),
    });
  }
}

const byTransaction = new Map();
for (const transfer of transfers.values()) {
  const entries = byTransaction.get(transfer.transactionHash) ?? [];
  entries.push(transfer);
  byTransaction.set(transfer.transactionHash, entries);
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
let corrected = 0;
for (const shardMetadata of manifest.shards) {
  const shardUrl = new URL(shardMetadata.file, HISTORY);
  const shard = JSON.parse(await readFile(shardUrl, "utf8"));
  for (const events of Object.values(shard.punks)) {
    for (const event of events) {
      if (event.type === "bought" && event.toDerivedFromLegacyTransfer) {
        corrected += 1;
        continue;
      }
      if (
        event.type !== "bought" ||
        event.to?.toLowerCase() !== ZERO_ADDRESS
      ) {
        continue;
      }
      const match = (byTransaction.get(event.transactionHash) ?? [])
        .filter(
          (transfer) =>
            transfer.from.toLowerCase() === event.from.toLowerCase() &&
            transfer.logIndex < event.logIndex,
        )
        .sort((a, b) => b.logIndex - a.logIndex)[0];
      if (!match) {
        throw new Error(
          `No legacy Transfer match for ${event.transactionHash}:${event.logIndex}`,
        );
      }
      event.reportedTo = event.to;
      event.to = match.to;
      event.toDerivedFromLegacyTransfer = true;
      corrected += 1;
    }
  }
  const contents = `${JSON.stringify(shard)}\n`;
  await writeFile(shardUrl, contents, "utf8");
  shardMetadata.sha256 = createHash("sha256")
    .update(contents)
    .digest("hex");
}

manifest.source.eventCorrections = {
  zeroAddressPunkBoughtRecipients:
    "Corrected by matching the immediately preceding legacy Transfer(from,to,1) event in the same transaction.",
  correctedEvents: corrected,
};
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(
  `Corrected ${corrected.toLocaleString()} PunkBought recipients and refreshed 100 shard hashes\n`,
);
