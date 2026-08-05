# Releasing Punks Permanent

Every release is a static, content-addressable directory. Conventional hosting
is optional; Ethereum and the published checkpoint remain the sources of truth.

## Build and verify

From a clean checkout:

```sh
npm ci
npm run release
```

The command validates the contract-derived datasets, builds the client,
generates direct static entry points for every fixed route and Punk #0–9999,
then verifies every file listed in `dist/SHA256SUMS`.

Before a public release, advance the bundled checkpoint to a recent Ethereum
block and then build the verified payload:

```sh
npm run data:history
npm run data:market
npm run release
```

The checkpoint makes collection-wide pages load quickly. It is not treated as
the live source of truth: the client verifies and applies newer contract events
from Ethereum in the visitor's browser.

Important outputs:

- `dist/release-manifest.json` — contracts, checkpoint blocks, route totals,
  payload size and per-file hashes;
- `dist/SHA256SUMS` — independently verifiable SHA-256 values;
- `dist/route-manifest.json` — the generated direct-route inventory; and
- `dist/` — the complete release payload.

## Verify path independence

The build discovers its content root from the JavaScript bundle URL. It must
therefore behave identically at a domain root and below an IPFS gateway path
such as `/ipfs/<CID>/`. `npm run check:release` rejects root-absolute asset
references and verifies representative nested routes.

Before publishing, serve `dist/` with a plain static server that does not add
SPA rewrites and open at least:

- `/`;
- `/cryptopunks/owners/`;
- `/cryptopunks/details/0/`;
- `/cryptopunks/details/7804/`; and
- `/cryptopunks/details/9999/`.

## Publish to IPFS

With a current Kubo node:

```sh
ipfs add \
  --recursive \
  --cid-version=1 \
  --raw-leaves=true \
  --chunker=size-262144 \
  --quieter \
  dist
```

Record the final directory CID in the signed release ledger. Verify the CID
through the local node and at least two independent gateways before changing a
mutable pointer.

The initial release is not complete until the CID is pinned by at least three
independent operators. GitHub artifacts and a conventional web host are useful
mirrors, not preservation substitutes.

## ENS and conventional domain

After the CID has been independently verified:

1. set the ENS `contenthash` for `cryptopunkswebsite.eth` to the IPFS CID;
2. verify `web3://cryptopunkswebsite.eth` and an independent ENS gateway;
3. point `cryptopunks.website` at a static mirror and publish DNSLink to the
   same CID; and
4. retain the previous CID in an append-only release ledger so rollback never
   destroys an older release.

Updating ENS or DNS is an owner-authorised release action. Building and hashing
the payload does not require custody of either name.
