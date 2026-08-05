import { readFile, writeFile } from "node:fs/promises";

const dataUrl = new URL("../public/data/", import.meta.url);
const manifest = JSON.parse(
  await readFile(new URL("history-manifest.json", dataUrl), "utf8"),
);
const state = JSON.parse(
  await readFile(new URL("market-state.json", dataUrl), "utf8"),
);
const events = [];

for (const shard of manifest.shards) {
  const contents = JSON.parse(
    await readFile(new URL(`history/${shard.file}`, dataUrl), "utf8"),
  );
  for (const [punk, history] of Object.entries(contents.punks)) {
    for (const event of history) events.push({ punk: Number(punk), ...event });
  }
}

const newestFirst = (a, b) =>
  b.block - a.block ||
  b.transactionIndex - a.transactionIndex ||
  b.logIndex - a.logIndex;
const highestFirst = (a, b) => {
  const difference = BigInt(b.valueWei) - BigInt(a.valueWei);
  return difference === 0n ? newestFirst(a, b) : difference > 0n ? 1 : -1;
};
const paidSales = events.filter(
  (event) => event.type === "bought" && BigInt(event.valueWei ?? 0) > 0n,
);
const bids = events.filter(
  (event) => event.type === "bid" && BigInt(event.valueWei ?? 0) > 0n,
);
const snapshotTimestamp = state.source.timestamp;
const windows = {
  day: 86_400,
  week: 7 * 86_400,
  fourWeeks: 28 * 86_400,
  year: 365 * 86_400,
};

function saleSummary(seconds) {
  const selected = seconds
    ? paidSales.filter(
        (sale) => sale.timestamp >= snapshotTimestamp - seconds,
      )
    : paidSales;
  const volumeWei = selected.reduce(
    (total, sale) => total + BigInt(sale.valueWei),
    0n,
  );
  return {
    count: selected.length,
    volumeWei: volumeWei.toString(),
    averageWei: selected.length
      ? (volumeWei / BigInt(selected.length)).toString()
      : "0",
  };
}

const views = {
  schema: "https://cryptopunks.website/schemas/punks-market-views-v1.json",
  source: {
    historySnapshotBlock: manifest.source.snapshotBlock,
    stateSnapshotBlock: state.source.blockNumber,
    stateSnapshotTimestamp: snapshotTimestamp,
  },
  totals: {
    decodedEvents: events.length,
    paidSales: paidSales.length,
    bids: bids.length,
  },
  sales: {
    allTime: saleSummary(),
    last24Hours: saleSummary(windows.day),
    last7Days: saleSummary(windows.week),
    last28Days: saleSummary(windows.fourWeeks),
    lastYear: saleSummary(windows.year),
  },
  largestSales: [...paidSales].sort(highestFirst).slice(0, 500),
  recentTransactions: [...events].sort(newestFirst).slice(0, 2_000),
  recentBids: [...bids].sort(newestFirst).slice(0, 1_000),
};

await writeFile(
  new URL("market-views.json", dataUrl),
  `${JSON.stringify(views)}\n`,
  "utf8",
);
process.stdout.write(
  `Wrote views from ${events.length.toLocaleString()} decoded events and ${paidSales.length.toLocaleString()} paid sales\n`,
);
