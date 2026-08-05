import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const expectedImageHash =
  "ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b";
const image = await readFile(
  new URL("../public/assets/punks.png", import.meta.url),
);
const actualImageHash = createHash("sha256").update(image).digest("hex");

if (actualImageHash !== expectedImageHash) {
  throw new Error(`Composite hash mismatch: ${actualImageHash}`);
}

const catalog = JSON.parse(
  await readFile(
    new URL("../public/data/punks-attributes.json", import.meta.url),
    "utf8",
  ),
);

const expectedTypes = {
  Male: 6039,
  Female: 3840,
  Zombie: 88,
  Ape: 24,
  Alien: 9,
};

if (catalog.punks.length !== 10_000) {
  throw new Error(`Expected 10000 Punks, received ${catalog.punks.length}`);
}

for (const [type, count] of Object.entries(expectedTypes)) {
  if (catalog.counts.types[type] !== count) {
    throw new Error(
      `Expected ${count} ${type} Punks, received ${catalog.counts.types[type]}`,
    );
  }
}

if (catalog.punks[7804].join(", ") !== "Alien, Cap Forward, Pipe, Small Shades") {
  throw new Error("Punk #7804 golden attribute fixture does not match.");
}

process.stdout.write(
  `Verified 10,000 onchain attribute records at block ${catalog.source.blockNumber}\n`,
);
process.stdout.write(`Verified composite SHA-256 ${actualImageHash}\n`);

const historyManifest = JSON.parse(
  await readFile(
    new URL("../public/data/history-manifest.json", import.meta.url),
    "utf8",
  ),
);
const historyEventSum = historyManifest.shards.reduce(
  (total, shard) => total + shard.events,
  0,
);
if (historyEventSum !== historyManifest.totals.decodedEvents) {
  throw new Error(
    `History manifest event mismatch: ${historyEventSum} vs ${historyManifest.totals.decodedEvents}`,
  );
}

for (const shard of historyManifest.shards) {
  const contents = await readFile(
    new URL(`../public/data/history/${shard.file}`, import.meta.url),
  );
  const hash = createHash("sha256").update(contents).digest("hex");
  if (hash !== shard.sha256) {
    throw new Error(`History shard ${shard.file} hash mismatch.`);
  }
}

const punk7508Shard = JSON.parse(
  await readFile(
    new URL("../public/data/history/75.json", import.meta.url),
    "utf8",
  ),
);
const punk7508Purchase = punk7508Shard.punks["7508"].find(
  (event) =>
    event.type === "bought" &&
    event.block === 11_504_994 &&
    event.valueWei === "3950000000000000000",
);
if (!punk7508Purchase) {
  throw new Error("Punk #7508 golden purchase fixture is missing.");
}

process.stdout.write(
  `Verified ${historyManifest.totals.decodedEvents.toLocaleString()} decoded market events through block ${historyManifest.source.snapshotBlock}\n`,
);

if (
  historyManifest.source.eventCorrections?.correctedEvents < 4_269
) {
  throw new Error("Legacy PunkBought recipient correction count is invalid.");
}

const marketState = JSON.parse(
  await readFile(
    new URL("../public/data/market-state.json", import.meta.url),
    "utf8",
  ),
);
const marketViews = JSON.parse(
  await readFile(
    new URL("../public/data/market-views.json", import.meta.url),
    "utf8",
  ),
);
if (marketState.punks.length !== 10_000) {
  throw new Error(`Expected 10,000 market records, received ${marketState.punks.length}.`);
}
const rankedPunkTotal = marketState.owners.reduce(
  (total, owner) => total + owner.count,
  0,
);
if (rankedPunkTotal + marketState.totals.burned !== 10_000) {
  throw new Error(
    `Owner rankings plus burns account for ${rankedPunkTotal + marketState.totals.burned} Punks.`,
  );
}
if (
  marketState.owners.some(
    (owner, index) =>
      owner.count !== owner.punks.length ||
      (index > 0 && owner.count > marketState.owners[index - 1].count),
  )
) {
  throw new Error("Owner rankings are internally inconsistent.");
}
const burnedIds = marketState.punks
  .map((punk, id) => ({ punk, id }))
  .filter(
    ({ punk }) =>
      punk.owner.toLowerCase() ===
      "0x0000000000000000000000000000000000000000",
  )
  .map(({ id }) => id);
if (burnedIds.join(",") !== "685,7755") {
  throw new Error(`Unexpected burned Punk set: ${burnedIds.join(",")}`);
}
const expectedOwners = {
  0: "0xe08c32737c021c7d05d116b00a68a02f2d144ac0",
  229: "0x4a2515e0d6d23baf3229f124cc361bc7d3834fec",
  264: "0x8c6e565a72b46712f7608040eaa7d3e7b0b2b4a8",
  7508: "0xff1dd6e2773acddb60781e8e7877e8969f8e008e",
  7804: "0xebb57347b87ebc58faac50a6b872441e761a42fa",
};
for (const [id, owner] of Object.entries(expectedOwners)) {
  if (marketState.punks[Number(id)].owner.toLowerCase() !== owner) {
    throw new Error(`Punk #${id} owner fixture does not match.`);
  }
}
const computedOffers = marketState.punks.filter((punk) => punk.offer).length;
const computedBids = marketState.punks.filter((punk) => punk.bid).length;
if (
  computedOffers !== marketState.totals.openOffers ||
  computedBids !== marketState.totals.openBids
) {
  throw new Error("Open offer or bid totals do not match the Punk records.");
}
if (
  marketViews.largestSales.some(
    (sale, index) =>
      index > 0 &&
      BigInt(sale.valueWei) >
        BigInt(marketViews.largestSales[index - 1].valueWei),
  )
) {
  throw new Error("Largest-sales view is not ordered by ETH value.");
}
if (
  marketViews.recentTransactions.some(
    (event, index) =>
      index > 0 &&
      (event.block > marketViews.recentTransactions[index - 1].block ||
        (event.block === marketViews.recentTransactions[index - 1].block &&
          event.logIndex >
            marketViews.recentTransactions[index - 1].logIndex)),
  )
) {
  throw new Error("Recent-transactions view is not in reverse chain order.");
}
process.stdout.write(
  `Verified ${marketState.totals.owners.toLocaleString()} owner rankings, ${marketState.totals.openOffers.toLocaleString()} offers, ${marketState.totals.openBids.toLocaleString()} bids and ${marketViews.totals.paidSales.toLocaleString()} paid sales\n`,
);
