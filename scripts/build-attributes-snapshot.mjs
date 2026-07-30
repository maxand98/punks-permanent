import { mkdir, writeFile } from "node:fs/promises";
import { createPublicClient, fallback, http } from "viem";
import { mainnet } from "viem/chains";

const DATA_CONTRACT = "0x16f5a35647d6f03d5d3da7b35409d65ba03af3b2";
const OUTPUT = new URL("../public/data/punks-attributes.json", import.meta.url);
const CHUNK_SIZE = 250;
const abi = [
  {
    type: "function",
    name: "punkAttributes",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint16" }],
    outputs: [{ name: "attributes", type: "string" }],
  },
];

const client = createPublicClient({
  chain: mainnet,
  transport: fallback([
    http("https://ethereum-rpc.publicnode.com", { timeout: 20_000 }),
    http("https://eth.llamarpc.com", { timeout: 20_000 }),
  ]),
});

const blockNumber = await client.getBlockNumber();
const punks = [];

for (let start = 0; start < 10_000; start += CHUNK_SIZE) {
  const end = Math.min(start + CHUNK_SIZE, 10_000);
  const results = await client.multicall({
    allowFailure: false,
    blockNumber,
    contracts: Array.from({ length: end - start }, (_, offset) => ({
      address: DATA_CONTRACT,
      abi,
      functionName: "punkAttributes",
      args: [start + offset],
    })),
  });

  for (const value of results) {
    punks.push(value.split(",").map((item) => item.trim()));
  }

  process.stdout.write(`Read ${end}/10000 at block ${blockNumber}\n`);
}

const typeCounts = {};
const attributeCounts = {};
const attributeNumberCounts = {};

for (const attributes of punks) {
  const [rawType, ...traits] = attributes;
  const type = rawType.replace(/ [1-4]$/, "");
  typeCounts[type] = (typeCounts[type] ?? 0) + 1;
  attributeNumberCounts[traits.length] =
    (attributeNumberCounts[traits.length] ?? 0) + 1;

  for (const trait of traits) {
    attributeCounts[trait] = (attributeCounts[trait] ?? 0) + 1;
  }
}

const snapshot = {
  schema: "https://cryptopunks.website/schemas/punks-attributes-v1.json",
  source: {
    chainId: 1,
    blockNumber: blockNumber.toString(),
    contract: DATA_CONTRACT,
    method: "punkAttributes(uint16)",
  },
  counts: {
    types: typeCounts,
    attributes: attributeCounts,
    attributeNumbers: attributeNumberCounts,
  },
  punks,
};

await mkdir(new URL("../public/data/", import.meta.url), { recursive: true });
await writeFile(OUTPUT, `${JSON.stringify(snapshot)}\n`, "utf8");
process.stdout.write(`Wrote ${OUTPUT.pathname}\n`);
