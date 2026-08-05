# Replicate and preserve CryptoPunks.website

This project is designed so that no company, domain, gateway, API, or maintainer is indispensable. A fan can keep a complete release available from an ordinary computer.

## Preserve a published release

1. Install an IPFS implementation such as Kubo.
2. Find the current release CID in `docs/releases/`.
3. Fetch and pin it:

   ```sh
   ipfs get /ipfs/<CID> -o cryptopunks-website
   ipfs pin add /ipfs/<CID>
   ```

4. Open it through a local gateway at `http://127.0.0.1:8080/ipfs/<CID>/` or publish the CID through any public gateway, DNSLink name, or ENS `contenthash`.
5. Share the CID with another independent operator. A CID is useful only while at least one node continues to provide its blocks.

## Rebuild from source

```sh
git clone https://github.com/maxand98/punks-permanent.git
cd punks-permanent
npm ci
npm run verify:data
npm run build
npm run verify:release
ipfs add --cid-version=1 --raw-leaves --recursive dist
```

Compare the resulting checksums and CID with the signed release record. A different CID means some byte differs; inspect it before serving it as the same release.

## Keep the site current

The interface is not merely a screenshot. It combines two classes of data:

- Immutable or reproducible material: the verified Punk composite, attributes, historical Ethereum logs, static routes, application code, and release manifests.
- Current Ethereum state: owners, open offers, bids, balances, and new market events read from the canonical CryptoPunks contracts through a configurable RPC endpoint.

For maximum independence, run your own Ethereum node and enter its RPC URL. Public RPC services are convenient fallbacks, not roots of trust.

## Make the source harder to erase

Keep several independent copies:

- a normal GitHub mirror for discoverability and familiar code review;
- one or more peer-to-peer Git seeds, with Radicle planned as the first source-code mirror;
- Nostr NIP-34 repository announcements and signed patch metadata;
- immutable Git bundles and built releases pinned on IPFS;
- an ENS `contenthash` and DNSLink record that can point to a chosen release CID.

Buzz can publish release announcements, CIDs, checksums, and requests for new community pins. It is a useful relay-based distribution channel, but it is not currently a Git object transport, code-review forge, or substitute for independent Git/IPFS seeds.

## Verify the chain dependencies

The essential read path must remain anchored to the canonical Ethereum contracts recorded in the source. Before accepting a change, verify contract addresses, block ranges, artifact hashes, and release checksums. Never replace an unavailable Ethereum read with an undocumented centralized API response.

