# CryptoPunks website parity specification

## Target

Recreate the observable public experience and functionality of
`cryptopunks.app`, then replace every essential centralised dependency according
to the recovery plan in `PLAN.md`.

Parity is measured route by route and interaction by interaction. “Similar” is
not an acceptance criterion.

## Evidence boundary

The live site currently rejects the available automated browser environment.
The initial inventory therefore uses:

1. search-indexed public `cryptopunks.app` pages;
2. the Larva Labs `cryptopunks` contract/artwork repository;
3. the MIT-licensed `larvalabs/cryptopunksmarket` client and its Cypress tests;
4. the canonical Ethereum contracts; and
5. the preservation proposal and evidence graph.

Pixel-level sign-off remains blocked until the live site can be viewed in the
test browser or a complete current screenshot set is supplied. Functional work
continues independently of that visual gate.

## Global shell

- [ ] CryptoPunks identity and global header.
- [ ] Brand Hub link.
- [ ] All CryptoPunks.
- [ ] Owners.
- [ ] Types and Attributes group:
  - [ ] Punk Types.
  - [ ] Attributes.
  - [ ] Attribute Counts.
- [ ] Sales group:
  - [ ] Largest Sales.
  - [ ] Recent Transactions.
  - [ ] Bids.
- [ ] Wallet connection and account state.
- [ ] Responsive navigation.
- [ ] Footer, Q&A and legal links.
- [ ] Loading, empty, offline and partial-degradation states.

## Route inventory

The canonical route column records observed routes where the public index
exposes them. Routes still requiring live-browser confirmation are marked TBD.

| Experience | Canonical route | Required behaviour | Decentralised source |
| --- | --- | --- | --- |
| Homepage | `/` | Introduction, interactive 10,000-Punk map, overall statistics, largest sales, recent transactions, offers, bids, sales, all/wrapped Punks, Q&A | Contracts, deterministic index, verified static editorial package |
| All Punks | `/cryptopunks` | Browse 10,000; sale/bid colour states; open detail; search and filters | Composite hash/onchain art, market contract, deterministic index |
| Search | `/cryptopunks/search?query=…` | Punk matches, for-sale subset, recent sales, bids and matching owners | Onchain attribute snapshot plus deterministic event index |
| Punk detail | `/cryptopunks/details/:id` | Image, type, attribute rarity, current market status, actions, complete transaction history, low/flash-bid toggle, history download | CryptoPunksData, CryptoPunksMarket, Ethereum logs |
| Owner/account | `/cryptopunks/accountinfo?account=:address` | Address/ENS identity, owned Punks, market activity and account actions | Contract state, ENS, deterministic event index |
| Top owners | TBD | Ranked owners and holdings | Contract state snapshot |
| Punk types | TBD | Male, Female, Zombie, Ape, Alien groups and counts | Onchain attribute snapshot |
| Attributes | TBD | Trait directory and matching Punks | Onchain attribute snapshot |
| Attribute counts | TBD | Distribution by number of attributes | Onchain attribute snapshot |
| Largest sales | TBD | Ranked historical sales with Punk, parties, ETH, USD and date | `PunkBought` logs plus timestamped ETH/USD source |
| Recent transactions | TBD | Offers, bids, transfers and sales in chronological order | Ethereum logs |
| Bids | TBD | Current/recent bids and aggregate statistics | Contract state and Ethereum logs |
| Wrapped Punks | external | Count and link to the wrapper client | Wrapped Punks contract |
| Brand Hub | external | Preserve official outbound route | Static link |

## Punk detail acceptance checklist

- [x] Canonical `/cryptopunks/details/:id` parsing.
- [x] Validate Punk range 0–9999.
- [x] Render SVG directly from `CryptoPunksData`.
- [x] Render type and all attributes from `CryptoPunksData`.
- [x] Attribute and type population counts from a block-labelled deterministic
      onchain snapshot.
- [x] Read owner, offer and highest open bid from `CryptoPunksMarket`.
- [x] Previous/next Punk navigation.
- [x] Link owner into the local account route.
- [x] Visible contract provenance.
- [x] Reconstruct complete event history from Ethereum logs.
- [x] Show/hide low and flash bids.
- [x] Download history.
- [ ] Resolve ENS with forward/reverse verification.
- [ ] Block-labelled current state.
- [ ] Wallet-aware action visibility.
- [ ] Pixel-level desktop parity.
- [ ] Pixel-level mobile parity.

## All Punks acceptance checklist

- [x] Render the canonical 100 × 100 composite.
- [x] Verify and publish its contract-bound SHA-256.
- [x] Map every visual position deterministically to Punk #0–9999.
- [x] Pointer selection opens the canonical local detail route.
- [x] Display type totals from the block-labelled onchain snapshot.
- [ ] Overlay current blue/red/purple native market states.
- [ ] Search by type, attribute, owner and Punk number.
- [ ] Keyboard-accessible navigation for every Punk.
- [ ] Pixel-level desktop and mobile parity.

## Search acceptance checklist

- [x] Search by exact Punk number.
- [x] Search types and attributes without a hosted API.
- [x] Paginate large result sets.
- [x] Render thumbnails from the contract-bound canonical composite.
- [x] Link every result to the canonical detail route.
- [ ] Currently-for-sale result subset and prices.
- [ ] Recent sales and bids for the result cohort.
- [ ] Matching-owner aggregation.
- [ ] Pixel-level desktop and mobile parity.

## Native market interaction inventory

These behaviours are derived from the official open-source market client and
its automated tests.

### Visitor/bidder

- [ ] Connect wallet only when an action is requested.
- [ ] Terms and marketplace-risk acknowledgement.
- [ ] Place bid with exact ETH value.
- [ ] Withdraw own bid.
- [ ] Buy a Punk offered to the visitor or to anyone.

### Owner

- [ ] Offer for sale to anyone.
- [ ] Offer for sale to one address.
- [ ] Remove from sale.
- [ ] Accept the current bid with minimum-price protection.
- [ ] Transfer to a valid non-zero address.
- [ ] Withdraw pending account balance.

### Transaction safety

- [ ] Reject incomplete, overlong and zero addresses.
- [ ] Reject empty and zero values where invalid.
- [ ] Display decoded function, parameters and value before signature.
- [ ] Simulate calls at the current block.
- [ ] Display submitted transaction and confirmed/failed state.
- [ ] Never require a project-controlled relay for the native market.

## Data products

| Product | Trust model | Status |
| --- | --- | --- |
| Punk SVG and attributes | Direct contract call | Implemented |
| Attribute snapshot | Deterministic calls at one block; generated JSON includes block and contract | Implemented |
| Current owner/offer/bid | Direct contract call | Implemented |
| Complete event history | Direct log reconstruction with 100 independently checksummed acceleration shards | Implemented |
| Owners and rankings | Deterministic state/event reconstruction | Planned |
| ETH/USD historical values | Signed, versioned external price corpus; never required for ETH truth | Planned |
| ENS names | Forward and reverse onchain verification | Planned |

## Visual evidence required

For each route, capture at minimum:

- desktop at 1440 × 1000;
- tablet at 820 × 1180;
- mobile at 390 × 844;
- loading state;
- typical populated state;
- empty/unavailable state; and
- connected-wallet variants applicable to that route.

Screenshots are stored as test evidence, not copied into the public site.

## Definition of complete

Completion requires:

1. every row above implemented or explicitly excluded with written reason;
2. functional tests for every market action and validation condition;
3. screenshot comparison within the agreed tolerance on all target viewports;
4. the disaster-recovery test in `PLAN.md` passing; and
5. a public parity report linking each observed feature to its implementation,
   data source and verification evidence.
