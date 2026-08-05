import type { Abi } from "viem";

export const CRYPTOPUNKS_MARKET =
  "0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB" as const;
export const CRYPTOPUNKS_DATA =
  "0x16f5a35647d6f03d5d3da7b35409d65ba03af3b2" as const;

export const dataAbi = [
  {
    type: "function",
    name: "punkImageSvg",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint16" }],
    outputs: [{ name: "svg", type: "string" }],
  },
  {
    type: "function",
    name: "punkAttributes",
    stateMutability: "view",
    inputs: [{ name: "index", type: "uint16" }],
    outputs: [{ name: "attributes", type: "string" }],
  },
] as const satisfies Abi;

export const marketAbi = [
  {
    type: "function",
    name: "pendingWithdrawals",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "amount", type: "uint256" }],
  },
  {
    type: "function",
    name: "punkIndexToAddress",
    stateMutability: "view",
    inputs: [{ name: "punkIndex", type: "uint256" }],
    outputs: [{ name: "owner", type: "address" }],
  },
  {
    type: "function",
    name: "punksOfferedForSale",
    stateMutability: "view",
    inputs: [{ name: "punkIndex", type: "uint256" }],
    outputs: [
      { name: "isForSale", type: "bool" },
      { name: "punkIndex", type: "uint256" },
      { name: "seller", type: "address" },
      { name: "minValue", type: "uint256" },
      { name: "onlySellTo", type: "address" },
    ],
  },
  {
    type: "function",
    name: "punkBids",
    stateMutability: "view",
    inputs: [{ name: "punkIndex", type: "uint256" }],
    outputs: [
      { name: "hasBid", type: "bool" },
      { name: "punkIndex", type: "uint256" },
      { name: "bidder", type: "address" },
      { name: "value", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "buyPunk",
    stateMutability: "payable",
    inputs: [{ name: "punkIndex", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "enterBidForPunk",
    stateMutability: "payable",
    inputs: [{ name: "punkIndex", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawBidForPunk",
    stateMutability: "nonpayable",
    inputs: [{ name: "punkIndex", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "acceptBidForPunk",
    stateMutability: "nonpayable",
    inputs: [
      { name: "punkIndex", type: "uint256" },
      { name: "minPrice", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "offerPunkForSale",
    stateMutability: "nonpayable",
    inputs: [
      { name: "punkIndex", type: "uint256" },
      { name: "minSalePriceInWei", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "offerPunkForSaleToAddress",
    stateMutability: "nonpayable",
    inputs: [
      { name: "punkIndex", type: "uint256" },
      { name: "minSalePriceInWei", type: "uint256" },
      { name: "toAddress", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "punkNoLongerForSale",
    stateMutability: "nonpayable",
    inputs: [{ name: "punkIndex", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "transferPunk",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "punkIndex", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
] as const satisfies Abi;
