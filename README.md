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

Alpha 0.1 is a contract-first proof of the essential read path. It retrieves:

- SVG and attributes from `CryptoPunksData`;
- ownership from the original `CryptoPunksMarket`; and
- native offers and bids from the market contract.

It uses several RPC fallbacks and lets a visitor supply their own endpoint. It
does not yet include full collection browsing, event history, transactions or
immutable release infrastructure.

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
