---
name: cryptopunks-research
description: Research CryptoPunks traits and native-market history using Punks Permanent's deterministic snapshots and canonical Ethereum contracts.
license: CC0-1.0 for application code; artwork and names retain their respective rights
compatibility: Requires HTTPS access to cryptopunks.website and, for current state, an Ethereum mainnet RPC. No wallet is needed for reads.
metadata:
  author: Maxand98
  version: "1.0"
  homepage: https://cryptopunks.website/
---

# CryptoPunks research

Use this skill for reproducible research about a Punk's traits and native CryptoPunksMarket history.

## Workflow

1. Validate that the Punk ID is an integer from 0 through 9999.
2. Read `https://cryptopunks.website/data/punks-attributes.json` for snapshot traits.
3. Read the history manifest, select shard `floor(id / 100)` padded to two digits, and verify its SHA-256 checksum when integrity matters.
4. Use `https://cryptopunks.website/cryptopunks/details/{id}` as the human-facing canonical route.
5. Query CryptoPunksMarket at `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB` for current ownership, offer, or bid state, and report the block number.
6. Cite snapshot URLs and blocks. Separate historical snapshot facts from fresh chain state.

## Wallet boundary

Public reads require no wallet. The interface's transaction actions are disabled. Do not sign, bid, buy, or spend. If a future task explicitly authorizes transactions, use a dedicated wallet with contract allowlists, transaction caps, short-lived allowances, and separate user confirmation.

## Attribution

Punks Permanent is independent and unofficial. Do not imply endorsement by the official CryptoPunks team. Application code is CC0-1.0; artwork and names retain their respective rights.

