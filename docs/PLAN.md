# Punks Permanent: implementation plan

## North-star recovery test

If the maintainer, conventional domain, web host, official APIs, preferred
indexer and preferred RPC all disappear, a person with an Ethereum client must
still be able to:

1. locate a preserved release;
2. render any Punk and read its attributes;
3. verify ownership, bids, offers and sales;
4. reconstruct history; and
5. prepare a native-market transaction locally.

The project is not “completely decentralised” until that test passes.

## Public addresses

- Project name: **Punks Permanent**
- Repository: `github.com/maxand98/punks-permanent`
- Proposed Ethereum-native name: `punks.maxand98.eth`
- Native URL: `web3://punks.maxand98.eth`
- Gateway URL: `https://punks.maxand98.eth.limo`
- Convenience mirror: `https://permanent.maxand98.com`

The ENS contenthash is the canonical mutable pointer. Every release CID remains
independently addressable and listed in an append-only signed release ledger.
The conventional domain is a convenience, never the root of trust.

## Architecture

### Irreducible read path

- Static, client-rendered application with no required server runtime.
- Punk image and traits from `CryptoPunksData`.
- Ownership and native market state from `CryptoPunksMarket`.
- Multiple RPC fallbacks plus user-configured and local-node support.
- All contract addresses, ABIs, schemas and significant behaviours documented.

### Reproducible derived data

- Open-source deterministic log indexer.
- Versioned event schema and golden test vectors.
- Content-addressed snapshots for fast startup.
- Full chain-log replay as the slower trustless fallback.
- Derived figures label their block number and derivation version.

### Publishing and discovery

- Reproducible static build with software bill of materials.
- SHA-256 checksums and signed release manifest.
- IPFS publication with at least three independent pinning operators.
- Arweave release copy to introduce a different storage failure model.
- ENS contenthash and DNSLink convenience pointer.
- Local-first downloadable archive.

### Client diversity and final rescue layer

- This polished TypeScript client.
- A separately implemented minimal client with no shared framework.
- A tiny Ethereum-resident rescue viewer addressed through `web3://`.
- Shared conformance tests, not a shared runtime dependency tree.

## Delivery phases

### Phase 0 — preservation charter and evidence

- [x] Public repository and initial licence.
- [x] Recovery test and decentralisation boundary.
- [x] Contract-first read-only alpha.
- [ ] Record licences and provenance for every non-code asset.
- [ ] Document significant properties of cryptopunks.app without copying its
      protected editorial design or text.

Exit: scope, legal boundary and acceptance tests are public.

### Phase 1 — complete read-only collection client

- [ ] All 10,000 Punks with virtualised browse, search and trait filters.
- [ ] Owner pages, bids, offers, transfers and sales.
- [ ] Block-number-labelled data and visible source provenance.
- [ ] RPC health, offline states, local cache and accessibility.
- [ ] Direct contract mode that works without an indexer.

Exit: core collection browsing survives loss of every official API.

### Phase 2 — deterministic history and discovery

- [ ] Specify all V1/V2 market events and edge cases.
- [ ] Build a replayable indexer and publish its database schema.
- [ ] Generate signed, content-addressed snapshots.
- [ ] Verify snapshot output against direct log queries and known Punks.
- [ ] Add reproducible owners, leaderboards and market statistics.

Exit: a third party can reconstruct every displayed derived value.

### Phase 3 — native market interaction

- [ ] Wallet connection remains optional for reading.
- [ ] Prepare offer, bid, buy, accept, transfer and withdraw calls locally.
- [ ] Simulate each transaction and show decoded calldata before signature.
- [ ] Support hardware wallets and standards-based injected providers.
- [ ] Ship contract-level fork tests and a read-only safety mode.

Exit: the native market remains usable with no project-controlled backend.

### Phase 4 — immutable release system

- [ ] Deterministic build in CI and independently reproduced checksum.
- [ ] Signed manifest, dependency lock, SBOM and restore instructions.
- [ ] Publish to IPFS and Arweave; verify from independent gateways/nodes.
- [ ] Establish independent pinning partners and a public responsibility map.
- [ ] Configure `punks.maxand98.eth` contenthash and the convenience mirror.

Exit: a release survives loss of GitHub, DNS and the primary host.

### Phase 5 — genuine client diversity

- [ ] Publish the interface/data specification and conformance suite.
- [ ] Fund or recruit an independently authored minimal client.
- [ ] Avoid shared framework, indexer and RPC assumptions.
- [ ] Run cross-client regression and malformed-data tests.

Exit: one implementation bug cannot remove access.

### Phase 6 — Ethereum rescue viewer and stewardship

- [ ] Define the irreducible UX and byte budget.
- [ ] Store the rescue client in Ethereum bytecode.
- [ ] Expose it through ERC-4804 `web3://`.
- [ ] Use a multisig for mutable pointers and publish the governance policy.
- [ ] Run and record six-monthly disaster-recovery drills.

Exit: the north-star recovery test passes from a clean machine.

## Near-term build order

1. Verify the current alpha against several independent RPC endpoints.
2. Add the complete collection browser with direct onchain image loading.
3. Write the contract/event specification and golden fixtures.
4. Implement deterministic history reconstruction.
5. Produce the first reproducible IPFS test release.

## Principles

- Read-only access never requires a wallet.
- Optional services fail by degradation, not by taking down the collection.
- Every displayed claim names its source, block and derivation where relevant.
- Historical releases are immutable and remain discoverable.
- No single organisation, domain, host, provider or codebase is indispensable.
