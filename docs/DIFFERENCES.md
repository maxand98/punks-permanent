# CryptoPunks.app and CryptoPunks.website

## TL;DR

CryptoPunks.website is an independent preservation client for the canonical
CryptoPunks artwork and native Ethereum market. It aims to preserve the public
experience of CryptoPunks.app without making the continued operation of one
project-controlled application server a condition of access.

The visual design and the essential contract reads are substantially rebuilt,
but the two sites are not yet functionally identical. CryptoPunks.website must
continue to identify itself as independent and unofficial until every parity
item has been implemented and tested.

## Technical note

### Application and hosting

CryptoPunks.app is the canonical publisher-operated application. Its current
page is delivered as a Next.js application with project-managed web and wallet
infrastructure.

CryptoPunks.website is compiled into static files. Every release has a CID and
a checksummed manifest, can be pinned by independent IPFS nodes, and can be
served from an IPFS gateway without relying on the Cloudflare hostname.
Cloudflare is a convenient public gateway, not the sole copy of the interface.

### Artwork and attributes

CryptoPunks.website obtains Punk SVG data and attributes from the canonical
CryptoPunksData contract. It also packages the canonical 100 by 100 composite
whose SHA-256 hash matches the value recorded by CryptoPunksMarket. A
block-labelled 10,000-Punk attribute snapshot allows the collection to remain
browsable when a public RPC is temporarily unavailable.

### Ownership and market history

Ownership, offers, bids and pending withdrawals come from the canonical
CryptoPunksMarket contract. Historical activity is reconstructed from Ethereum
logs into independently checksummed shards. The browser begins with a stated
checkpoint and attempts to synchronise newer events through a user-selectable
Ethereum RPC. If synchronisation fails, the interface labels the view as a
checkpoint rather than describing stale data as live.

### Wallet transactions

CryptoPunks.website can prepare the native market's buy, bid, withdraw-bid,
offer, restricted-offer, remove-from-sale, accept-bid, transfer and
withdraw-proceeds calls. Before opening the wallet confirmation, it reloads the
current contract state and simulates the call. The wallet remains the final
signing authority and no project-controlled transaction relay is required.

The preservation client currently supports injected EIP-1193 wallets such as
MetaMask. It does not yet reproduce the official site's broader WalletConnect
and wallet-selection experience, and its transaction paths still require live
end-to-end testing with consenting wallets before full parity can be claimed.

### Features still different or incomplete

- Homepage statistics and several homepage Punk strips are not yet populated
  from the live market at render time.
- Attributes, for-sale, sales, wrapped-Punks, terms and notifications routes
  still have route shells rather than complete official-equivalent experiences.
- Search does not yet provide every market-aware grouping and owner aggregate.
- ENS forward/reverse verification is not yet displayed.
- The ETH/USD selector and language selector are visual parity elements only;
  currency conversion and translations are not yet implemented.
- WalletConnect, notification subscriptions and the official account
  notification experience are not yet implemented.
- Desktop and mobile screenshot-diff acceptance has not yet been completed for
  every route and state.

### Replication

Anyone can clone the source, verify the release manifest, build the static
files, fetch the published CID, pin it on an IPFS node, and connect the client
to any Ethereum RPC or a self-hosted node. The detailed procedure is in
[`REPLICATION.md`](./REPLICATION.md).
