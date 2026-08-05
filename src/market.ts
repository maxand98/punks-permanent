import {
  decodeEventLog,
  getAddress,
  parseAbi,
  type Address,
  type Log,
} from "viem";
import { CRYPTOPUNKS_MARKET } from "./contracts";
import { getEthereumLogClient } from "./ethereum";
import type { MarketEvent, MarketEventType } from "./history";
import { contentUrl } from "./paths";

export interface CurrentOffer {
  seller: string;
  valueWei: string;
  onlyTo: string;
}

export interface CurrentBid {
  bidder: string;
  valueWei: string;
}

export interface MarketPunk {
  owner: string;
  offer: CurrentOffer | null;
  bid: CurrentBid | null;
}

export interface OwnerRanking {
  address: string;
  count: number;
  punks: number[];
}

export interface MarketState {
  source: {
    chainId: number;
    blockNumber: string;
    timestamp: number;
    contract: string;
  };
  totals: {
    punks: number;
    owners: number;
    burned: number;
    openOffers: number;
    openBids: number;
    publicOffers: number;
  };
  owners: OwnerRanking[];
  punks: MarketPunk[];
}

export interface GlobalMarketEvent extends MarketEvent {
  punk: number;
}

interface SaleSummary {
  count: number;
  volumeWei: string;
  averageWei: string;
}

export interface MarketViews {
  source: {
    historySnapshotBlock: number;
    stateSnapshotBlock: string;
    stateSnapshotTimestamp: number;
  };
  totals: {
    decodedEvents: number;
    paidSales: number;
    bids: number;
  };
  sales: {
    allTime: SaleSummary;
    last24Hours: SaleSummary;
    last7Days: SaleSummary;
    last28Days: SaleSummary;
    lastYear: SaleSummary;
  };
  largestSales: GlobalMarketEvent[];
  recentTransactions: GlobalMarketEvent[];
  recentBids: GlobalMarketEvent[];
}

let statePromise: Promise<MarketState> | undefined;
let viewsPromise: Promise<MarketViews> | undefined;
let syncPromise: Promise<MarketSync> | undefined;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const LEGACY_TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const syncAbi = parseAbi([
  "event PunkTransfer(address indexed from, address indexed to, uint256 punkIndex)",
  "event PunkOffered(uint256 indexed punkIndex, uint256 minValue, address indexed toAddress)",
  "event PunkBidEntered(uint256 indexed punkIndex, uint256 value, address indexed fromAddress)",
  "event PunkBidWithdrawn(uint256 indexed punkIndex, uint256 value, address indexed fromAddress)",
  "event PunkBought(uint256 indexed punkIndex, uint256 value, address indexed fromAddress, address indexed toAddress)",
  "event PunkNoLongerForSale(uint256 indexed punkIndex)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

async function loadJson<T>(path: string) {
  const response = await fetch(contentUrl(path));
  if (!response.ok) throw new Error(`Could not load ${path}`);
  return (await response.json()) as T;
}

export function loadMarketState() {
  statePromise ??= loadJson<MarketState>("/data/market-state.json");
  return statePromise;
}

export function loadMarketViews() {
  viewsPromise ??= loadJson<MarketViews>("/data/market-views.json");
  return viewsPromise;
}

export interface MarketSync {
  state: MarketState;
  latestBlock: number;
  checkpointBlock: number;
  synced: boolean;
  newEvents: GlobalMarketEvent[];
}

function cloneState(state: MarketState): MarketState {
  return {
    ...state,
    source: { ...state.source },
    totals: { ...state.totals },
    owners: state.owners.map((owner) => ({
      ...owner,
      punks: [...owner.punks],
    })),
    punks: state.punks.map((punk) => ({
      ...punk,
      offer: punk.offer ? { ...punk.offer } : null,
      bid: punk.bid ? { ...punk.bid } : null,
    })),
  };
}

function eventPosition(a: GlobalMarketEvent, b: GlobalMarketEvent) {
  return (
    a.block - b.block ||
    a.transactionIndex - b.transactionIndex ||
    a.logIndex - b.logIndex
  );
}

function rebuildOwners(state: MarketState) {
  const byAddress = new Map<string, OwnerRanking>();
  state.punks.forEach((punk, id) => {
    const key = punk.owner.toLowerCase();
    if (key === ZERO_ADDRESS) return;
    const owner = byAddress.get(key) ?? {
      address: punk.owner,
      count: 0,
      punks: [],
    };
    owner.punks.push(id);
    owner.count += 1;
    byAddress.set(key, owner);
  });
  state.owners = [...byAddress.values()].sort(
    (a, b) => b.count - a.count || a.address.localeCompare(b.address),
  );
  state.totals.owners = state.owners.length;
  state.totals.burned = state.punks.filter(
    (punk) => punk.owner.toLowerCase() === ZERO_ADDRESS,
  ).length;
  state.totals.openOffers = state.punks.filter((punk) => punk.offer).length;
  state.totals.publicOffers = state.punks.filter(
    (punk) => punk.offer?.onlyTo.toLowerCase() === ZERO_ADDRESS,
  ).length;
  state.totals.openBids = state.punks.filter((punk) => punk.bid).length;
}

function decodedEvent(
  log: Log,
  timestamp: number,
): GlobalMarketEvent | undefined {
  let decoded;
  try {
    decoded = decodeEventLog({
      abi: syncAbi,
      data: log.data,
      topics: log.topics,
      strict: true,
    });
  } catch {
    return undefined;
  }
  const args = decoded.args as Record<string, Address | bigint>;
  const common = {
    punk: Number(args.punkIndex),
    block: Number(log.blockNumber),
    timestamp,
    transactionHash: log.transactionHash ?? "",
    transactionIndex: Number(log.transactionIndex ?? 0),
    logIndex: Number(log.logIndex ?? 0),
  };
  let type: MarketEventType;
  switch (decoded.eventName) {
    case "PunkTransfer":
      type = "transfer";
      return {
        ...common,
        type,
        from: String(args.from),
        to: String(args.to),
      };
    case "PunkOffered":
      type = "offered";
      return {
        ...common,
        type,
        valueWei: String(args.minValue),
        onlyTo: String(args.toAddress),
      };
    case "PunkBidEntered":
      type = "bid";
      return {
        ...common,
        type,
        valueWei: String(args.value),
        from: String(args.fromAddress),
      };
    case "PunkBidWithdrawn":
      type = "bid-withdrawn";
      return {
        ...common,
        type,
        valueWei: String(args.value),
        from: String(args.fromAddress),
      };
    case "PunkBought":
      type = "bought";
      return {
        ...common,
        type,
        valueWei: String(args.value),
        from: String(args.fromAddress),
        to: String(args.toAddress),
      };
    case "PunkNoLongerForSale":
      type = "offer-withdrawn";
      return { ...common, type };
  }
}

function applyEvent(state: MarketState, event: GlobalMarketEvent) {
  const punk = state.punks[event.punk];
  if (!punk) return;
  switch (event.type) {
    case "transfer":
      if (event.to) punk.owner = getAddress(event.to);
      break;
    case "offered":
      punk.offer = {
        seller: punk.owner,
        valueWei: event.valueWei ?? "0",
        onlyTo: getAddress(event.onlyTo ?? ZERO_ADDRESS),
      };
      break;
    case "offer-withdrawn":
      punk.offer = null;
      break;
    case "bid":
      punk.bid = {
        bidder: getAddress(event.from ?? ZERO_ADDRESS),
        valueWei: event.valueWei ?? "0",
      };
      break;
    case "bid-withdrawn":
      punk.bid = null;
      break;
    case "bought":
      if (event.to) punk.owner = getAddress(event.to);
      punk.offer = null;
      punk.bid = null;
      break;
  }
}

async function synchronizeMarketState(): Promise<MarketSync> {
  const baseline = await loadMarketState();
  const state = cloneState(baseline);
  const logClient = getEthereumLogClient();
  const checkpointBlock = Number(baseline.source.blockNumber);
  const latestBlock = Number(await logClient.getBlockNumber());
  if (latestBlock <= checkpointBlock) {
    return {
      state,
      latestBlock,
      checkpointBlock,
      synced: true,
      newEvents: [],
    };
  }

  const logs: Log[] = [];
  const ranges = [];
  for (
    let fromBlock = checkpointBlock + 1;
    fromBlock <= latestBlock;
    fromBlock += 50
  ) {
    ranges.push({
      fromBlock,
      toBlock: Math.min(latestBlock, fromBlock + 49),
    });
  }
  for (let start = 0; start < ranges.length; start += 8) {
    const batch = await Promise.all(
      ranges.slice(start, start + 8).map(async (range) => {
        let lastError;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            return await logClient.getLogs({
              address: CRYPTOPUNKS_MARKET,
              events: syncAbi,
              fromBlock: BigInt(range.fromBlock),
              toBlock: BigInt(range.toBlock),
            });
          } catch (error) {
            lastError = error;
            if (attempt < 3) {
              await new Promise((resolve) =>
                setTimeout(resolve, attempt * 350),
              );
            }
          }
        }
        throw lastError;
      }),
    );
    logs.push(...batch.flat());
  }

  const timestamps = new Map<number, number>();
  const eventBlocks = [
    ...new Set(logs.map((log) => Number(log.blockNumber))),
  ];
  for (let start = 0; start < eventBlocks.length; start += 8) {
    await Promise.all(
      eventBlocks.slice(start, start + 8).map(async (blockNumber) => {
        const block = await logClient.getBlock({
          blockNumber: BigInt(blockNumber),
        });
        timestamps.set(blockNumber, Number(block.timestamp));
      }),
    );
  }
  const newEvents = logs
    .map((log) => decodedEvent(log, timestamps.get(Number(log.blockNumber)) ?? 0))
    .filter((event): event is GlobalMarketEvent => Boolean(event))
    .sort(eventPosition);
  const legacyTransfers = logs
    .filter(
      (log) => log.topics[0]?.toLowerCase() === LEGACY_TRANSFER_TOPIC,
    )
    .map((log) => ({
      transactionHash: log.transactionHash ?? "",
      logIndex: Number(log.logIndex ?? 0),
      from: getAddress(`0x${log.topics[1]?.slice(-40)}`),
      to: getAddress(`0x${log.topics[2]?.slice(-40)}`),
    }));
  for (const event of newEvents) {
    if (
      event.type !== "bought" ||
      event.to?.toLowerCase() !== ZERO_ADDRESS
    ) {
      continue;
    }
    const transfer = legacyTransfers
      .filter(
        (candidate) =>
          candidate.transactionHash === event.transactionHash &&
          candidate.from.toLowerCase() === event.from?.toLowerCase() &&
          candidate.logIndex < event.logIndex,
      )
      .sort((a, b) => b.logIndex - a.logIndex)[0];
    if (transfer) event.to = transfer.to;
  }
  newEvents.forEach((event) => applyEvent(state, event));
  rebuildOwners(state);
  state.source.blockNumber = String(latestBlock);
  state.source.timestamp = Math.max(
    baseline.source.timestamp,
    ...newEvents.map((event) => event.timestamp),
  );
  return {
    state,
    latestBlock,
    checkpointBlock,
    synced: true,
    newEvents,
  };
}

export function syncMarketState(): Promise<MarketSync> {
  syncPromise ??= synchronizeMarketState().catch((error) => {
    syncPromise = undefined;
    throw error;
  });
  return syncPromise;
}
