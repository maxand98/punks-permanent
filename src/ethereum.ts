import {
  createPublicClient,
  fallback,
  formatEther,
  http,
  type Address,
} from "viem";
import { mainnet } from "viem/chains";
import {
  CRYPTOPUNKS_DATA,
  CRYPTOPUNKS_MARKET,
  dataAbi,
  marketAbi,
} from "./contracts";

const DEFAULT_RPCS = [
  "https://ethereum-rpc.publicnode.com",
  "https://eth.llamarpc.com",
  "https://cloudflare-eth.com",
];

export type PunkRecord = {
  id: number;
  svg: string;
  attributes: string[];
  owner: Address;
  offer: null | { priceEth: string; onlySellTo: Address };
  bid: null | { priceEth: string; bidder: Address };
};

function configuredRpcs() {
  const custom = localStorage.getItem("punks-permanent-rpc")?.trim();
  return custom ? [custom, ...DEFAULT_RPCS] : DEFAULT_RPCS;
}

export function getEthereumClient() {
  return createPublicClient({
    chain: mainnet,
    transport: fallback(
      configuredRpcs().map((url) => http(url, { timeout: 8_000 })),
      { rank: true },
    ),
  });
}

export function getEthereumLogClient() {
  const custom = localStorage.getItem("punks-permanent-rpc")?.trim();
  const urls = custom
    ? [custom, "https://1rpc.io/eth"]
    : ["https://1rpc.io/eth"];
  return createPublicClient({
    chain: mainnet,
    transport: fallback(
      urls.map((url) => http(url, { timeout: 12_000 })),
    ),
  });
}

export function getRpcList() {
  return configuredRpcs();
}

export function setCustomRpc(url: string) {
  const normalized = url.trim();
  if (!normalized) localStorage.removeItem("punks-permanent-rpc");
  else localStorage.setItem("punks-permanent-rpc", normalized);
}

export function svgDataUrl(svg: string) {
  const payload = svg.startsWith("data:image/svg+xml")
    ? svg.slice(svg.indexOf(",") + 1)
    : svg;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(payload)}`;
}

export async function loadPunk(id: number): Promise<PunkRecord> {
  if (!Number.isInteger(id) || id < 0 || id > 9999) {
    throw new Error("Punk number must be from 0 to 9999.");
  }

  const publicClient = getEthereumClient();
  const punkId = BigInt(id);
  const [svg, attributes, owner, offer, bid] = await Promise.all([
    publicClient.readContract({
      address: CRYPTOPUNKS_DATA,
      abi: dataAbi,
      functionName: "punkImageSvg",
      args: [id],
    }),
    publicClient.readContract({
      address: CRYPTOPUNKS_DATA,
      abi: dataAbi,
      functionName: "punkAttributes",
      args: [id],
    }),
    publicClient.readContract({
      address: CRYPTOPUNKS_MARKET,
      abi: marketAbi,
      functionName: "punkIndexToAddress",
      args: [punkId],
    }),
    publicClient.readContract({
      address: CRYPTOPUNKS_MARKET,
      abi: marketAbi,
      functionName: "punksOfferedForSale",
      args: [punkId],
    }),
    publicClient.readContract({
      address: CRYPTOPUNKS_MARKET,
      abi: marketAbi,
      functionName: "punkBids",
      args: [punkId],
    }),
  ]);

  return {
    id,
    svg,
    attributes: attributes.split(",").map((item) => item.trim()),
    owner,
    offer: offer[0]
      ? { priceEth: formatEther(offer[3]), onlySellTo: offer[4] }
      : null,
    bid: bid[0] ? { priceEth: formatEther(bid[3]), bidder: bid[2] } : null,
  };
}
