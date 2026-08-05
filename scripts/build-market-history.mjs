import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { decodeEventLog, getAddress, parseAbi } from "viem";

const CONTRACT = "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB";
const DEPLOYMENT_BLOCK = 3_914_495;
const BLOCKSCOUT_API = "https://eth.blockscout.com/api";
const RPC = "https://ethereum-rpc.publicnode.com";
const RANGE_SIZE = 100_000;
const WORKERS = 3;
const CACHE = new URL("../.cache/market-logs/", import.meta.url);
const OUTPUT = new URL("../public/data/history/", import.meta.url);

const abi = parseAbi([
  "event PunkTransfer(address indexed from, address indexed to, uint256 punkIndex)",
  "event PunkOffered(uint256 indexed punkIndex, uint256 minValue, address indexed toAddress)",
  "event PunkBidEntered(uint256 indexed punkIndex, uint256 value, address indexed fromAddress)",
  "event PunkBidWithdrawn(uint256 indexed punkIndex, uint256 value, address indexed fromAddress)",
  "event PunkBought(uint256 indexed punkIndex, uint256 value, address indexed fromAddress, address indexed toAddress)",
  "event PunkNoLongerForSale(uint256 indexed punkIndex)",
]);

const relevantTopics = new Set([
  "0x05af636b70da6819000c49f85b21fa82081c632069bb626f30932034099107d8",
  "0x3c7b682d5da98001a9b8cbda6c647d2c63d698a4184fd1d55e2ce7b66f5d21eb",
  "0x58e5d5a525e3b40bc15abaa38b5882678db1ee68befd2f60bafe3a7fd06db9e3",
  "0x5b859394fabae0c1ba88baffe67e751ab5248d2e879028b8c8d6897b0519f56a",
  "0x6f30e1ee4d81dcc7a8a478577f65d2ed2edb120565960ac45fe7c50551c87932",
  "0xb0e0a660b4e50f26f0b7ce75c24655fc76cc66e3334a54ff410277229fa10bd4",
]);
const LEGACY_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

await mkdir(CACHE, { recursive: true });
await mkdir(OUTPUT, { recursive: true });

async function latestBlock() {
  const response = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_blockNumber",
      params: [],
    }),
  });
  const body = await response.json();
  if (!body.result) throw new Error(`Could not read latest block: ${body.error}`);
  return Number(BigInt(body.result));
}

async function requestJson(url, attempts = 10) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body.result)) {
        throw new Error(body.message || "Unexpected Blockscout response");
      }
      return body.result;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(30_000, attempt * 3_000)),
        );
      }
    }
  }
  throw lastError;
}

async function fetchPage(fromBlock, toBlock, page) {
  const cacheFile = new URL(
    `${fromBlock}-${toBlock}-${page}.json`,
    CACHE,
  );
  try {
    return JSON.parse(await readFile(cacheFile, "utf8"));
  } catch {
    const parameters = new URLSearchParams({
      module: "logs",
      action: "getLogs",
      fromBlock: String(fromBlock),
      toBlock: String(toBlock),
      address: CONTRACT,
      page: String(page),
      offset: "1000",
    });
    const result = await requestJson(`${BLOCKSCOUT_API}?${parameters}`);
    await writeFile(cacheFile, JSON.stringify(result), "utf8");
    return result;
  }
}

async function fetchRange(fromBlock, toBlock) {
  const firstPage = await fetchPage(fromBlock, toBlock, 1);
  if (firstPage.length < 1000) return firstPage;

  if (fromBlock === toBlock) {
    const logs = [...firstPage];
    for (let page = 2; ; page += 1) {
      const next = await fetchPage(fromBlock, toBlock, page);
      logs.push(...next);
      if (next.length < 1000) return logs;
    }
  }

  const midpoint = Math.floor((fromBlock + toBlock) / 2);
  const [left, right] = await Promise.all([
    fetchRange(fromBlock, midpoint),
    fetchRange(midpoint + 1, toBlock),
  ]);
  return [...left, ...right];
}

const snapshotBlock = await latestBlock();
const queue = [];
for (
  let fromBlock = DEPLOYMENT_BLOCK;
  fromBlock <= snapshotBlock;
  fromBlock += RANGE_SIZE
) {
  queue.push({
    fromBlock,
    toBlock: Math.min(snapshotBlock, fromBlock + RANGE_SIZE - 1),
  });
}

const rawLogs = [];
let completed = 0;
async function worker() {
  for (;;) {
    const range = queue.shift();
    if (!range) return;
    const logs = await fetchRange(range.fromBlock, range.toBlock);
    rawLogs.push(...logs);
    completed += 1;
    process.stdout.write(
      `Read ${completed} ranges; ${rawLogs.length.toLocaleString()} raw logs cached\n`,
    );
  }
}
await Promise.all(Array.from({ length: WORKERS }, () => worker()));

const histories = Array.from({ length: 10_000 }, () => []);
let decodedCount = 0;
let correctedBuyerCount = 0;
const legacyTransfersByTransaction = new Map();

for (const log of rawLogs) {
  if (log.topics?.[0]?.toLowerCase() !== LEGACY_TRANSFER_TOPIC) continue;
  const transfer = {
    from: getAddress(`0x${log.topics[1].slice(-40)}`),
    to: getAddress(`0x${log.topics[2].slice(-40)}`),
    logIndex: Number(BigInt(log.logIndex)),
  };
  const transfers =
    legacyTransfersByTransaction.get(log.transactionHash) ?? [];
  transfers.push(transfer);
  legacyTransfersByTransaction.set(log.transactionHash, transfers);
}

for (const log of rawLogs) {
  const topic = log.topics?.[0]?.toLowerCase();
  if (!relevantTopics.has(topic)) continue;
  const decoded = decodeEventLog({
    abi,
    data: log.data,
    topics: log.topics.filter(Boolean),
    strict: true,
  });
  const args = decoded.args;
  const punkIndex = Number(args.punkIndex);
  const common = {
    block: Number(BigInt(log.blockNumber)),
    timestamp: Number(BigInt(log.timeStamp)),
    transactionHash: log.transactionHash,
    transactionIndex: Number(BigInt(log.transactionIndex)),
    logIndex: Number(BigInt(log.logIndex)),
  };
  let event;

  switch (decoded.eventName) {
    case "PunkTransfer":
      event = { ...common, type: "transfer", from: args.from, to: args.to };
      break;
    case "PunkOffered":
      event = {
        ...common,
        type: "offered",
        valueWei: args.minValue.toString(),
        onlyTo: args.toAddress,
      };
      break;
    case "PunkBidEntered":
      event = {
        ...common,
        type: "bid",
        valueWei: args.value.toString(),
        from: args.fromAddress,
      };
      break;
    case "PunkBidWithdrawn":
      event = {
        ...common,
        type: "bid-withdrawn",
        valueWei: args.value.toString(),
        from: args.fromAddress,
      };
      break;
    case "PunkBought":
      {
        const reportedTo = args.toAddress;
        const matchingTransfer = (
          legacyTransfersByTransaction.get(log.transactionHash) ?? []
        )
          .filter(
            (transfer) =>
              transfer.from.toLowerCase() ===
                args.fromAddress.toLowerCase() &&
              transfer.logIndex < common.logIndex,
          )
          .sort((a, b) => b.logIndex - a.logIndex)[0];
        const correctedTo =
          reportedTo ===
            "0x0000000000000000000000000000000000000000" &&
          matchingTransfer
            ? matchingTransfer.to
            : reportedTo;
        if (correctedTo !== reportedTo) correctedBuyerCount += 1;
      event = {
        ...common,
        type: "bought",
        valueWei: args.value.toString(),
        from: args.fromAddress,
        to: correctedTo,
        ...(correctedTo !== reportedTo
          ? { reportedTo: reportedTo, toDerivedFromLegacyTransfer: true }
          : {}),
      };
      break;
      }
    case "PunkNoLongerForSale":
      event = { ...common, type: "offer-withdrawn" };
      break;
    default:
      continue;
  }

  histories[punkIndex].push(event);
  decodedCount += 1;
}

for (const history of histories) {
  history.sort(
    (a, b) =>
      a.block - b.block ||
      a.transactionIndex - b.transactionIndex ||
      a.logIndex - b.logIndex,
  );
}

const shards = [];
for (let shardIndex = 0; shardIndex < 100; shardIndex += 1) {
  const start = shardIndex * 100;
  const punks = {};
  for (let id = start; id < start + 100; id += 1) {
    if (histories[id].length) punks[id] = histories[id];
  }
  const contents = `${JSON.stringify({
    schema: "https://cryptopunks.website/schemas/punks-market-history-shard-v1.json",
    range: { from: start, to: start + 99 },
    punks,
  })}\n`;
  const filename = `${String(shardIndex).padStart(2, "0")}.json`;
  await writeFile(new URL(filename, OUTPUT), contents, "utf8");
  shards.push({
    file: filename,
    from: start,
    to: start + 99,
    events: Object.values(punks).reduce(
      (total, events) => total + events.length,
      0,
    ),
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}

const manifest = {
  schema: "https://cryptopunks.website/schemas/punks-market-history-manifest-v1.json",
  source: {
    chainId: 1,
    contract: CONTRACT,
    deploymentBlock: DEPLOYMENT_BLOCK,
    snapshotBlock,
    retrieval: "Ethereum logs via Blockscout API v1; independently reproducible from any archive node",
    eventNames: abi.filter((item) => item.type === "event").map((item) => item.name),
    eventCorrections: {
      zeroAddressPunkBoughtRecipients:
        "Corrected by matching the immediately preceding legacy Transfer(from,to,1) event in the same transaction.",
      correctedEvents: correctedBuyerCount,
    },
  },
  totals: {
    rawLogs: rawLogs.length,
    decodedEvents: decodedCount,
    punksWithHistory: histories.filter((history) => history.length).length,
  },
  shards,
};
await writeFile(
  new URL("../history-manifest.json", OUTPUT),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);
process.stdout.write(
  `Wrote ${decodedCount.toLocaleString()} decoded events through block ${snapshotBlock}\n`,
);
