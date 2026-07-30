# Punks Permanent

An independently operable, decentralised interface for CryptoPunks.

The project starts from a strict distinction: the artwork and native market are
on Ethereum, but the usual doorway is still a conventional web application.
Punks Permanent is building a doorway that can survive its current maintainer,
domain, host, API, indexer and preferred RPC.

Intended public names, confirmed available on 30 July 2026 but not yet
registered:

- `cryptopunks.website`
- `cryptopunkswebsite.eth`
- `web3://cryptopunkswebsite.eth`

This is an independent, unofficial client and is not the official CryptoPunks
website.

## Status

The target is route-by-route visual and functional parity with the public
CryptoPunks website, with its essential paths rebuilt so no official API, host
or image server is indispensable. See the
[parity specification](docs/PARITY.md).

The current milestone implements:

- SVG and attributes from `CryptoPunksData`;
- ownership from the original `CryptoPunksMarket`; and
- native offers and bids from the market contract;
- a deterministic attribute snapshot for all 10,000 Punks at one Ethereum
  block;
- 343,107 decoded native-market events, sharded and independently checksummed;
- complete offers, bids, sales and transfer history with a low/flash-bid toggle
  and JSON download;
- the interactive `/cryptopunks` canonical collection map; and
- the first `/cryptopunks/details/:id` parity route.

It uses several RPC fallbacks and lets a visitor supply their own endpoint.
Owner/ranking routes, market-aware collection filters, wallet transactions and
immutable release infrastructure remain in progress.

Read the [implementation plan](docs/PLAN.md).

## Run locally

```sh
npm install
npm run dev
```

For a production build:

```sh
npm run build
```

The generated `dist/` directory is static and can be opened through any HTTP,
IPFS or compatible distributed-web gateway.

## Canonical contracts

- CryptoPunksMarket: `0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB`
- CryptoPunksData: `0x16f5a35647d6f03d5d3da7b35409d65ba03af3b2`

## Sources

- [The Punks Are Permanent. Their Website Should Be Too.](https://maxand98.com/writing/the-punks-are-permanent/)
- [CryptoPunks Permanence Lab](https://maxand98.com/punks/)
- [Larva Labs CryptoPunks source](https://github.com/larvalabs/cryptopunks)
- [Open-Sourcing a New Interface for the CryptoPunks Market](https://larvalabs.com/writing/2021-11-11-18-0/open-sourcing-a-new-interface-for-the-cryptopunks-market)

## Licence

Code is released under CC0-1.0. CryptoPunks artwork and names are subject to
their respective rights and terms; nothing here claims to be the official
CryptoPunks website.
