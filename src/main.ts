import "./style.css";
import {
  loadCatalog,
  normalizePunkType,
  typeDescription,
  type CatalogSnapshot,
} from "./catalog";
import {
  getRpcList,
  loadPunk,
  setCustomRpc,
  svgDataUrl,
  type PunkRecord,
} from "./ethereum";
import { formatEther, getAddress, isAddress } from "viem";
import {
  loadPunkHistory,
  type HistoryManifest,
  type MarketEvent,
} from "./history";
import {
  loadMarketState,
  loadMarketViews,
  syncMarketState,
  type GlobalMarketEvent,
  type MarketSync,
} from "./market";
import { applicationPathname, contentUrl } from "./paths";

const app = document.querySelector<HTMLDivElement>("#app")!;
if (!app) throw new Error("Application root is missing.");
document.documentElement.style.setProperty(
  "--punks-composite-url",
  `url("${contentUrl("assets/punks.png")}")`,
);

const navigation = `
  <header class="site-header">
    <a class="brand" href="/" data-link>CryptoPunks</a>
    <nav aria-label="Primary navigation">
      <a href="https://hub.cryptopunks.app/">Brand Hub</a>
      <a href="/cryptopunks" data-link>All CryptoPunks</a>
      <a href="/cryptopunks/owners" data-link>Owners</a>
      <details>
        <summary>Types and Attributes</summary>
        <div>
          <a href="/cryptopunks/types" data-link>Punk Types</a>
          <a href="/cryptopunks/attributes" data-link>Attributes</a>
          <a href="/cryptopunks/attribute-counts" data-link>Attribute Counts</a>
        </div>
      </details>
      <details>
        <summary>Sales</summary>
        <div>
          <a href="/cryptopunks/largest-sales" data-link>Largest Sales</a>
          <a href="/cryptopunks/transactions" data-link>Recent Transactions</a>
          <a href="/cryptopunks/bids" data-link>Bids</a>
        </div>
      </details>
    </nav>
    <button class="wallet-button" type="button" disabled title="Wallet actions are the next parity phase">Connect Wallet</button>
  </header>
`;

const footer = `
  <footer>
    <div>
      <strong>CryptoPunks</strong>
      <p>An independent, unofficial interface reading the canonical Ethereum contracts.</p>
    </div>
    <div>
      <a href="https://github.com/maxand98/punks-permanent">Source code ↗</a>
      <a href="https://maxand98.com/writing/the-punks-are-permanent/">Preservation proposal ↗</a>
    </div>
  </footer>
`;

function shortAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function etherscan(address: string) {
  return `https://etherscan.io/address/${address}`;
}

function punkRoute(id: number) {
  return `/cryptopunks/details/${id}`;
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character] ?? character,
  );
}

function searchForm(value = "") {
  return `
    <form class="global-search" data-punk-search>
      <label for="punk-search">Find a Punk</label>
      <div>
        <span>#</span>
        <input id="punk-search" name="punk" type="search" value="${escapeHtml(value)}" placeholder="Punk number, type or attribute" required>
        <button type="submit">Search</button>
      </div>
    </form>
  `;
}

function bindNavigation() {
  document.querySelectorAll<HTMLAnchorElement>("[data-link]").forEach((link) => {
    if (link.dataset.bound === "true") return;
    const rawHref = link.getAttribute("href") ?? "/";
    const route = link.dataset.route ?? rawHref;
    if (route.startsWith("/")) {
      link.dataset.route = route;
      link.href = contentUrl(route);
    }
    link.dataset.bound = "true";
    link.addEventListener("click", (event) => {
      if (link.origin !== location.origin) return;
      event.preventDefault();
      history.pushState(null, "", contentUrl(link.dataset.route ?? "/"));
      void renderRoute();
    });
  });

  document
    .querySelectorAll<HTMLFormElement>("[data-punk-search]")
    .forEach((form) => {
      if (form.dataset.bound === "true") return;
      form.dataset.bound = "true";
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const input = form.querySelector<HTMLInputElement>('input[name="punk"]');
        const query = input?.value.trim() ?? "";
        const id = Number(query);
        if (/^\d+$/.test(query) && Number.isInteger(id) && id >= 0 && id <= 9999) {
          history.pushState(null, "", contentUrl(punkRoute(id)));
        } else if (query) {
          history.pushState(
            null,
            "",
            contentUrl(`/cryptopunks/search?query=${encodeURIComponent(query)}`),
          );
        } else {
          return;
        }
        void renderRoute();
      });
    });
}

function renderStatus(record: PunkRecord) {
  const publicOffer =
    record.offer &&
    record.offer.onlySellTo === "0x0000000000000000000000000000000000000000";
  const offerText = record.offer
    ? publicOffer
      ? `${record.offer.priceEth} ETH`
      : `${record.offer.priceEth} ETH to ${shortAddress(record.offer.onlySellTo)}`
    : "Not For Sale";

  return `
    <section class="market-status" aria-labelledby="market-status-title">
      <h2 id="market-status-title">Current Market Status</h2>
      <dl>
        <div>
          <dt>Status</dt>
          <dd class="${record.offer ? "status-for-sale" : ""}">${offerText}</dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd><a href="/cryptopunks/accountinfo?account=${record.owner}" data-link>${shortAddress(record.owner)}</a></dd>
        </div>
        <div>
          <dt>Top Bid</dt>
          <dd>${record.bid ? `${record.bid.priceEth} ETH by ${shortAddress(record.bid.bidder)}` : "No bids yet"}</dd>
        </div>
      </dl>
      <div class="market-actions">
        ${record.offer ? '<button type="button" disabled>Buy</button>' : ""}
        <button type="button" disabled>Bid</button>
      </div>
      <p class="pending-note">Wallet transactions are disabled in this read-only parity milestone.</p>
    </section>
  `;
}

function renderAttributes(
  id: number,
  record: PunkRecord,
  catalog: CatalogSnapshot,
) {
  const [rawType, ...traits] = catalog.punks[id] ?? record.attributes;
  const type = normalizePunkType(rawType);
  const typeCount = catalog.counts.types[type] ?? 0;
  const traitNumberCount =
    catalog.counts.attributeNumbers[String(traits.length)] ?? 0;

  return `
    <p class="punk-kind">${typeDescription(type, typeCount)}</p>
    <section class="attributes" aria-labelledby="attributes-title">
      <h2 id="attributes-title">Attributes</h2>
      <p>This Punk has ${traits.length} attributes, one of ${traitNumberCount.toLocaleString()} with that many.</p>
      <div class="attribute-list">
        ${traits
          .map(
            (trait) => `
              <a class="attribute-card" href="/cryptopunks/search?query=${encodeURIComponent(trait)}" data-link>
                <strong>${trait}</strong>
                <span>${(catalog.counts.attributes[trait] ?? 0).toLocaleString()} Punks have this.</span>
              </a>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function historyLabel(type: MarketEvent["type"]) {
  return (
    {
      transfer: "Transfer",
      offered: "Offered",
      bid: "Bid",
      "bid-withdrawn": "Bid Withdrawn",
      bought: "Sold",
      "offer-withdrawn": "Offer Withdrawn",
    } satisfies Record<MarketEvent["type"], string>
  )[type];
}

function historyAddress(address?: string) {
  if (
    !address ||
    address === "0x0000000000000000000000000000000000000000"
  ) {
    return "";
  }
  return `<a href="/cryptopunks/accountinfo?account=${address}" data-link>${shortAddress(address)}</a>`;
}

function isLowOrFlash(event: MarketEvent, allEvents: MarketEvent[]) {
  if (event.type !== "bid" && event.type !== "bid-withdrawn") return false;
  if (event.valueWei && BigInt(event.valueWei) < 1_000_000_000_000_000_000n) {
    return true;
  }
  return allEvents.some(
    (candidate) =>
      candidate !== event &&
      candidate.transactionHash === event.transactionHash &&
      candidate.valueWei === event.valueWei &&
      candidate.from === event.from &&
      ((event.type === "bid" && candidate.type === "bid-withdrawn") ||
        (event.type === "bid-withdrawn" && candidate.type === "bid")),
  );
}

function historyRows(events: MarketEvent[], showLowFlash: boolean) {
  return [...events]
    .reverse()
    .filter((event) => showLowFlash || !isLowOrFlash(event, events))
    .map((event) => {
      const date = new Intl.DateTimeFormat("en", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(event.timestamp * 1000));
      const amount = event.valueWei
        ? `${Number(formatEther(BigInt(event.valueWei))).toLocaleString("en", {
            maximumFractionDigits: 6,
          })} ETH`
        : "";
      return `
        <tr>
          <td><span class="event-type event-${event.type}">${historyLabel(event.type)}</span></td>
          <td>${historyAddress(event.from)}</td>
          <td>${historyAddress(event.to ?? event.onlyTo)}</td>
          <td class="history-amount">${amount}</td>
          <td><a href="https://etherscan.io/tx/${event.transactionHash}" title="Block ${event.block.toLocaleString()}">${date} ↗</a></td>
        </tr>
      `;
    })
    .join("");
}

function renderHistory(
  events: MarketEvent[],
  manifest: HistoryManifest,
) {
  return `
    <div class="section-heading">
      <div>
        <h2 id="history-title">Transaction History</h2>
        <span>${events.length.toLocaleString()} decoded events through block ${manifest.source.snapshotBlock.toLocaleString()}</span>
      </div>
      <button type="button" id="download-history">Download History</button>
    </div>
    <label class="history-filter">
      <input type="checkbox" id="show-low-flash">
      Show Low/Flash Bids
    </label>
    <div class="history-table-wrap">
      <table>
        <thead><tr><th>Type</th><th>From</th><th>To</th><th>Amount</th><th>Txn</th></tr></thead>
        <tbody id="history-rows">${historyRows(events, false)}</tbody>
      </table>
    </div>
    <p class="history-source">Reconstructed from CryptoPunksMarket events. Snapshot SHA-256 values are published in the <a href="${contentUrl("data/history-manifest.json")}">release manifest</a>.</p>
  `;
}

function bindHistory(id: number, events: MarketEvent[], manifest: HistoryManifest) {
  const checkbox =
    document.querySelector<HTMLInputElement>("#show-low-flash");
  const rows = document.querySelector<HTMLTableSectionElement>("#history-rows");
  const download =
    document.querySelector<HTMLButtonElement>("#download-history");

  checkbox?.addEventListener("change", () => {
    if (rows) rows.innerHTML = historyRows(events, checkbox.checked);
    bindNavigation();
  });
  download?.addEventListener("click", () => {
    const payload = {
      punk: id,
      source: manifest.source,
      events,
    };
    const url = URL.createObjectURL(
      new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
        type: "application/json",
      }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cryptopunk-${id}-history-through-${manifest.source.snapshotBlock}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

async function renderPunkDetail(id: number) {
  if (!Number.isInteger(id) || id < 0 || id > 9999) {
    renderNotFound("That Punk number does not exist.");
    return;
  }

  document.title = `CryptoPunk #${id} - CryptoPunks`;
  app.innerHTML = `
    ${navigation}
    <main class="detail-page">
      <div class="detail-tools">
        ${searchForm(String(id))}
        <nav class="punk-pagination" aria-label="Punk navigation">
          ${id > 0 ? `<a href="${punkRoute(id - 1)}" data-link>← Punk #${id - 1}</a>` : "<span></span>"}
          ${id < 9999 ? `<a href="${punkRoute(id + 1)}" data-link>Punk #${id + 1} →</a>` : "<span></span>"}
        </nav>
      </div>
      <section class="punk-hero">
        <div class="punk-image loading-image" id="punk-image"><span>Reading onchain image…</span></div>
        <div class="punk-heading">
          <p class="kicker">CryptoPunk</p>
          <h1>${id}</h1>
          <div id="punk-attributes"><p>Reading attributes at a fixed Ethereum block…</p></div>
        </div>
      </section>
      <div class="detail-grid">
        <div id="market-status"><h2>Current Market Status</h2><p>Reading the canonical market contract…</p></div>
        <section class="history" aria-labelledby="history-title">
          <div class="history-pending"><strong>Loading deterministic Ethereum history…</strong></div>
        </section>
      </div>
      <aside class="data-provenance" id="data-provenance"></aside>
    </main>
    ${footer}
  `;
  bindNavigation();

  try {
    const [record, catalog, history] = await Promise.all([
      loadPunk(id),
      loadCatalog(),
      loadPunkHistory(id),
    ]);
    const image = document.querySelector<HTMLDivElement>("#punk-image");
    const attributes = document.querySelector<HTMLDivElement>("#punk-attributes");
    const market = document.querySelector<HTMLDivElement>("#market-status");
    const provenance =
      document.querySelector<HTMLElement>("#data-provenance");
    const historyElement = document.querySelector<HTMLElement>(".history");

    if (image) {
      image.classList.remove("loading-image");
      image.innerHTML = `<img src="${svgDataUrl(record.svg)}" alt="CryptoPunk #${id}, rendered from CryptoPunksData">`;
    }
    if (attributes) attributes.innerHTML = renderAttributes(id, record, catalog);
    if (market) market.outerHTML = renderStatus(record);
    if (historyElement) {
      historyElement.innerHTML = renderHistory(
        history.events,
        history.manifest,
      );
      bindHistory(id, history.events, history.manifest);
    }
    if (provenance) {
      provenance.innerHTML = `
        <strong>Verify this page</strong>
        <span>Attributes snapshot: Ethereum block ${Number(catalog.source.blockNumber).toLocaleString()}</span>
        <a href="${etherscan(catalog.source.contract)}">CryptoPunksData ↗</a>
        <a href="${etherscan("0xb47e3cd837dDF8e4c57F05d70Ab865de6e193BBB")}">CryptoPunksMarket ↗</a>
      `;
    }
    bindNavigation();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Ethereum error.";
    const heading = document.querySelector<HTMLDivElement>(".punk-heading");
    if (heading) {
      heading.innerHTML = `<p class="kicker">Ethereum read unavailable</p><h1>${id}</h1><p>${escapeHtml(message)}</p><p>Configure another Ethereum endpoint from the homepage.</p>`;
    }
  }
}

function renderHomepage() {
  document.title = "CryptoPunks";
  app.innerHTML = `
    ${navigation}
    <main>
      <section class="home-hero">
        <div>
          <p class="kicker">10,000 unique collectible characters</p>
          <h1>CryptoPunks</h1>
          <p>Proof of ownership, artwork and the zero-fee native market live on Ethereum. This independent interface is being rebuilt for long-term survival.</p>
          ${searchForm("7804")}
        </div>
        <div class="sample-punk" id="sample-punk"><span>Reading Punk #7804 from Ethereum…</span></div>
      </section>
      <section class="parity-status">
        <p class="kicker">Parity programme</p>
        <h2>The complete website, without an indispensable server.</h2>
        <div>
          <article><strong>10,000</strong><span>attribute records read from CryptoPunksData</span></article>
          <article><strong>2</strong><span>canonical contracts in the essential read path</span></article>
          <article><strong>0</strong><span>official APIs required for this milestone</span></article>
        </div>
        <a href="/cryptopunks/details/7804" data-link>Open the first parity-complete route →</a>
      </section>
      <section class="rpc-settings">
        <div>
          <p class="kicker">Your doorway, your node</p>
          <h2>Choose the Ethereum connection.</h2>
        </div>
        <form id="rpc-form">
          <label for="rpc-url">Custom RPC URL</label>
          <input id="rpc-url" type="url" placeholder="http://localhost:8545">
          <button type="submit">Save endpoint</button>
          <button type="button" id="clear-rpc">Use fallbacks</button>
          <small id="rpc-summary"></small>
        </form>
      </section>
    </main>
    ${footer}
  `;
  bindNavigation();
  bindRpcSettings();

  void loadPunk(7804).then((record) => {
    const sample = document.querySelector<HTMLDivElement>("#sample-punk");
    if (sample) {
      sample.innerHTML = `<a href="${punkRoute(7804)}" data-link><img src="${svgDataUrl(record.svg)}" alt="CryptoPunk #7804"><span>Punk #7804 · Onchain SVG</span></a>`;
      bindNavigation();
    }
  });
}

async function renderAllPunks() {
  document.title = "All CryptoPunks - CryptoPunks";
  app.innerHTML = `
    ${navigation}
    <main class="collection-page">
      <header>
        <p class="kicker">The complete collection</p>
        <h1>All CryptoPunks</h1>
        <p>10,000 unique, 24 × 24 pixel portraits. Select any position in the canonical composite to open its onchain record.</p>
        ${searchForm()}
      </header>
      <section class="collection-summary" id="collection-summary" aria-label="Collection type counts">
        <span>Reading the deterministic attribute snapshot…</span>
      </section>
      <section class="punk-map-section" aria-labelledby="punk-map-title">
        <div class="map-heading">
          <div>
            <p class="kicker">100 × 100 canonical arrangement</p>
            <h2 id="punk-map-title">Interactive CryptoPunks map</h2>
          </div>
          <output id="map-selection">Move across the map to identify a Punk.</output>
        </div>
        <button class="punk-map" id="punk-map" type="button" aria-label="Interactive map of all 10,000 CryptoPunks">
          <img src="${contentUrl("assets/punks.png")}" alt="All 10,000 CryptoPunks in their canonical 100 by 100 arrangement">
          <span class="map-cursor" id="map-cursor" hidden></span>
        </button>
        <p class="map-provenance">Composite SHA-256 <code>ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b</code>, matching the hash embedded in CryptoPunksMarket.</p>
      </section>
    </main>
    ${footer}
  `;
  bindNavigation();

  const map = document.querySelector<HTMLButtonElement>("#punk-map");
  const cursor = document.querySelector<HTMLSpanElement>("#map-cursor");
  const selection = document.querySelector<HTMLOutputElement>("#map-selection");
  let selectedId = 0;

  const locate = (event: PointerEvent) => {
    if (!map) return 0;
    const rect = map.getBoundingClientRect();
    const column = Math.max(
      0,
      Math.min(99, Math.floor(((event.clientX - rect.left) / rect.width) * 100)),
    );
    const row = Math.max(
      0,
      Math.min(99, Math.floor(((event.clientY - rect.top) / rect.height) * 100)),
    );
    selectedId = row * 100 + column;
    if (cursor) {
      cursor.hidden = false;
      cursor.style.left = `${column}%`;
      cursor.style.top = `${row}%`;
    }
    if (selection) selection.textContent = `CryptoPunk #${selectedId}`;
    return selectedId;
  };

  map?.addEventListener("pointermove", locate);
  map?.addEventListener("pointerleave", () => {
    if (cursor) cursor.hidden = true;
  });
  map?.addEventListener("click", (event) => {
    const id = locate(event);
    history.pushState(null, "", contentUrl(punkRoute(id)));
    void renderRoute();
  });

  try {
    const catalog = await loadCatalog();
    const summary = document.querySelector<HTMLElement>("#collection-summary");
    if (summary) {
      summary.innerHTML = Object.entries(catalog.counts.types)
        .map(
          ([type, count]) =>
            `<a href="/cryptopunks/search?query=${encodeURIComponent(type)}" data-link><strong>${count.toLocaleString()}</strong><span>${type}</span></a>`,
        )
        .join("");
      bindNavigation();
    }
  } catch (error) {
    const summary = document.querySelector<HTMLElement>("#collection-summary");
    if (summary) {
      summary.textContent =
        error instanceof Error ? error.message : "Attribute snapshot unavailable.";
    }
  }
}

function punkThumbnail(id: number) {
  const column = id % 100;
  const row = Math.floor(id / 100);
  return `<span class="punk-thumbnail" style="--punk-x:${(column / 99) * 100}%;--punk-y:${(row / 99) * 100}%"></span>`;
}

type MarketResult = MarketSync & { error?: string };

async function loadCurrentMarket(): Promise<MarketResult> {
  try {
    return await syncMarketState();
  } catch (error) {
    const state = await loadMarketState();
    return {
      state,
      checkpointBlock: Number(state.source.blockNumber),
      latestBlock: Number(state.source.blockNumber),
      synced: false,
      newEvents: [],
      error:
        error instanceof Error ? error.message : "Ethereum sync unavailable.",
    };
  }
}

function formatEth(valueWei: string, maximumFractionDigits = 4) {
  return Number(formatEther(BigInt(valueWei))).toLocaleString("en", {
    maximumFractionDigits,
  });
}

function eventDate(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(timestamp * 1000));
}

function syncNotice(market: MarketResult) {
  if (market.synced) {
    return `
      <div class="sync-notice sync-live">
        <strong>Live Ethereum state</strong>
        <span>Checkpoint ${market.checkpointBlock.toLocaleString()} synchronised through block ${market.latestBlock.toLocaleString()}.</span>
      </div>
    `;
  }
  return `
    <div class="sync-notice sync-checkpoint">
      <strong>Checkpoint view — not live</strong>
      <span>Showing block ${market.checkpointBlock.toLocaleString()}. Connect a working Ethereum RPC to synchronise newer events. ${escapeHtml(market.error ?? "")}</span>
    </div>
  `;
}

function routePagination(
  route: string,
  page: number,
  pages: number,
  parameters = new URLSearchParams(),
) {
  const href = (target: number) => {
    const next = new URLSearchParams(parameters);
    next.set("page", String(target));
    return `${route}?${next}`;
  };
  if (pages <= 1) return "";
  return `
    <nav class="result-pagination" aria-label="Result pages">
      ${page > 0 ? `<a href="${href(page - 1)}" data-link>← Previous</a>` : "<span></span>"}
      <span>Page ${page + 1} of ${pages}</span>
      ${page + 1 < pages ? `<a href="${href(page + 1)}" data-link>Next →</a>` : "<span></span>"}
    </nav>
  `;
}

function marketPageHeader(kicker: string, title: string, description: string) {
  return `
    <header class="market-page-header">
      <p class="kicker">${kicker}</p>
      <h1>${title}</h1>
      <p>${description}</p>
    </header>
  `;
}

function globalEventRows(events: GlobalMarketEvent[]) {
  return events
    .map(
      (event) => `
        <tr>
          <td>
            <a class="market-punk" href="${punkRoute(event.punk)}" data-link>
              ${punkThumbnail(event.punk)}
              <strong>#${event.punk}</strong>
            </a>
          </td>
          <td><span class="event-type event-${event.type}">${historyLabel(event.type)}</span></td>
          <td>${historyAddress(event.from)}</td>
          <td>${historyAddress(event.to ?? event.onlyTo)}</td>
          <td class="history-amount">${event.valueWei ? `${formatEth(event.valueWei, 6)} ETH` : ""}</td>
          <td><a href="https://etherscan.io/tx/${event.transactionHash}" title="Block ${event.block.toLocaleString()}">${eventDate(event.timestamp)} ↗</a></td>
        </tr>
      `,
    )
    .join("");
}

function mergeEvents(
  baseline: GlobalMarketEvent[],
  tail: GlobalMarketEvent[],
) {
  const byPosition = new Map<string, GlobalMarketEvent>();
  for (const event of [...baseline, ...tail]) {
    byPosition.set(
      `${event.transactionHash}:${event.logIndex}:${event.type}`,
      event,
    );
  }
  return [...byPosition.values()].sort(
    (a, b) =>
      b.block - a.block ||
      b.transactionIndex - a.transactionIndex ||
      b.logIndex - a.logIndex,
  );
}

async function renderOwners() {
  const page = Math.max(
    0,
    Number(new URLSearchParams(location.search).get("page") ?? 0) || 0,
  );
  const perPage = 100;
  document.title = "CryptoPunks Owners - CryptoPunks";
  app.innerHTML = `
    ${navigation}
    <main class="market-page">
      ${marketPageHeader(
        "Ethereum ownership",
        "Top CryptoPunk Owners",
        "Ranked from canonical CryptoPunksMarket ownership, beginning with a reproducible checkpoint and synchronised in this browser.",
      )}
      <div id="market-route"><p>Synchronising ownership with Ethereum…</p></div>
    </main>
    ${footer}
  `;
  bindNavigation();

  const market = await loadCurrentMarket();
  const start = page * perPage;
  const visible = market.state.owners.slice(start, start + perPage);
  const pages = Math.ceil(market.state.owners.length / perPage);
  const route = document.querySelector<HTMLElement>("#market-route");
  if (!route) return;
  route.innerHTML = `
    ${syncNotice(market)}
    <div class="market-stat-grid">
      <article><strong>${market.state.totals.owners.toLocaleString()}</strong><span>Owners</span></article>
      <article><strong>10,000</strong><span>Punks</span></article>
      <article><strong>${market.state.totals.publicOffers.toLocaleString()}</strong><span>Publicly offered</span></article>
    </div>
    <div class="market-table-wrap">
      <table class="market-table owners-table">
        <thead><tr><th>Rank</th><th>Owner</th><th>Punks</th><th>Sample holdings</th></tr></thead>
        <tbody>
          ${visible
            .map(
              (owner, index) => `
                <tr>
                  <td>${(start + index + 1).toLocaleString()}</td>
                  <td><a href="/cryptopunks/accountinfo?account=${owner.address}" data-link>${shortAddress(owner.address)}</a></td>
                  <td><strong>${owner.count.toLocaleString()}</strong></td>
                  <td>
                    <div class="owner-samples">
                      ${owner.punks
                        .slice(0, 8)
                        .map(
                          (id) =>
                            `<a href="${punkRoute(id)}" title="Punk #${id}" data-link>${punkThumbnail(id)}</a>`,
                        )
                        .join("")}
                    </div>
                  </td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
    ${routePagination("/cryptopunks/owners", page, pages)}
  `;
  bindNavigation();
}

async function renderAccountInfo() {
  const value =
    new URLSearchParams(location.search).get("account")?.trim() ?? "";
  if (!isAddress(value)) {
    renderNotFound("Enter a valid Ethereum address to view its CryptoPunks.");
    return;
  }
  const address = getAddress(value);
  document.title = `${shortAddress(address)} - CryptoPunks Owner`;
  app.innerHTML = `
    ${navigation}
    <main class="market-page">
      ${marketPageHeader(
        "Owner account",
        shortAddress(address),
        "Current CryptoPunks held by this Ethereum address.",
      )}
      <div id="market-route"><p>Synchronising this account with Ethereum…</p></div>
    </main>
    ${footer}
  `;
  bindNavigation();

  const market = await loadCurrentMarket();
  const owner = market.state.owners.find(
    (entry) => entry.address.toLowerCase() === address.toLowerCase(),
  );
  const route = document.querySelector<HTMLElement>("#market-route");
  if (!route) return;
  const punks = owner?.punks ?? [];
  route.innerHTML = `
    ${syncNotice(market)}
    <div class="account-heading">
      <div><strong>${punks.length.toLocaleString()}</strong><span>CryptoPunks owned</span></div>
      <a href="${etherscan(address)}">${address} ↗</a>
    </div>
    ${
      punks.length
        ? `<div class="punk-results account-punks">
            ${punks
              .map(
                (id) => `
                  <a href="${punkRoute(id)}" data-link>
                    ${punkThumbnail(id)}
                    <strong>#${id}</strong>
                    <span>${market.state.punks[id].offer ? `${formatEth(market.state.punks[id].offer!.valueWei)} ETH offer` : "Not offered for sale"}</span>
                  </a>
                `,
              )
              .join("")}
          </div>`
        : '<div class="no-results"><h2>No CryptoPunks held.</h2><p>This address owns no Punks at the displayed Ethereum block.</p></div>'
    }
  `;
  bindNavigation();
}

async function renderLargestSales() {
  const page = Math.max(
    0,
    Number(new URLSearchParams(location.search).get("page") ?? 0) || 0,
  );
  const perPage = 50;
  document.title = "Largest CryptoPunks Sales";
  app.innerHTML = `
    ${navigation}
    <main class="market-page">
      ${marketPageHeader(
        "Native market history",
        "Largest Sales",
        "Paid PunkBought events ranked by their onchain ETH value. No hosted marketplace API is used.",
      )}
      <div id="market-route"><p>Loading and synchronising market history…</p></div>
    </main>
    ${footer}
  `;
  bindNavigation();

  const [market, views] = await Promise.all([
    loadCurrentMarket(),
    loadMarketViews(),
  ]);
  const paidTail = market.newEvents.filter(
    (event) => event.type === "bought" && BigInt(event.valueWei ?? 0) > 0n,
  );
  const sales = mergeEvents(views.largestSales, paidTail).sort((a, b) => {
    const difference = BigInt(b.valueWei ?? 0) - BigInt(a.valueWei ?? 0);
    return difference === 0n ? b.block - a.block : difference > 0n ? 1 : -1;
  });
  const pages = Math.ceil(sales.length / perPage);
  const visible = sales.slice(page * perPage, (page + 1) * perPage);
  const route = document.querySelector<HTMLElement>("#market-route");
  if (!route) return;
  route.innerHTML = `
    ${syncNotice(market)}
    <div class="market-stat-grid">
      <article><strong>${views.totals.paidSales.toLocaleString()}</strong><span>Paid sales recorded</span></article>
      <article><strong>${formatEth(views.sales.allTime.volumeWei, 0)}</strong><span>ETH all-time volume</span></article>
      <article><strong>${formatEth(views.sales.lastYear.averageWei, 2)}</strong><span>Average ETH · last year</span></article>
    </div>
    <div class="market-table-wrap">
      <table class="market-table">
        <thead><tr><th>Punk</th><th>Event</th><th>From</th><th>To</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>${globalEventRows(visible)}</tbody>
      </table>
    </div>
    ${routePagination("/cryptopunks/largest-sales", page, pages)}
  `;
  bindNavigation();
}

async function renderTransactions() {
  const page = Math.max(
    0,
    Number(new URLSearchParams(location.search).get("page") ?? 0) || 0,
  );
  const perPage = 50;
  document.title = "Recent CryptoPunks Transactions";
  app.innerHTML = `
    ${navigation}
    <main class="market-page">
      ${marketPageHeader(
        "Ethereum event stream",
        "Recent Transactions",
        "Offers, bids, transfers and sales decoded directly from CryptoPunksMarket logs.",
      )}
      <div id="market-route"><p>Synchronising recent transactions…</p></div>
    </main>
    ${footer}
  `;
  bindNavigation();
  const [market, views] = await Promise.all([
    loadCurrentMarket(),
    loadMarketViews(),
  ]);
  const events = mergeEvents(views.recentTransactions, market.newEvents);
  const pages = Math.ceil(events.length / perPage);
  const visible = events.slice(page * perPage, (page + 1) * perPage);
  const route = document.querySelector<HTMLElement>("#market-route");
  if (!route) return;
  route.innerHTML = `
    ${syncNotice(market)}
    <div class="market-table-wrap">
      <table class="market-table">
        <thead><tr><th>Punk</th><th>Event</th><th>From</th><th>To</th><th>Amount</th><th>Date</th></tr></thead>
        <tbody>${globalEventRows(visible)}</tbody>
      </table>
    </div>
    ${routePagination("/cryptopunks/transactions", page, pages)}
  `;
  bindNavigation();
}

async function renderBids() {
  document.title = "CryptoPunks Bids";
  app.innerHTML = `
    ${navigation}
    <main class="market-page">
      ${marketPageHeader(
        "Native bids",
        "CryptoPunk Bids",
        "Open bids from current contract state, followed by the recent onchain bid history.",
      )}
      <div id="market-route"><p>Synchronising bids with Ethereum…</p></div>
    </main>
    ${footer}
  `;
  bindNavigation();
  const [market, views] = await Promise.all([
    loadCurrentMarket(),
    loadMarketViews(),
  ]);
  const open = market.state.punks
    .map((punk, id) => ({ id, bid: punk.bid }))
    .filter(
      (entry): entry is { id: number; bid: NonNullable<typeof entry.bid> } =>
        Boolean(entry.bid),
    )
    .sort((a, b) => {
      const difference = BigInt(b.bid.valueWei) - BigInt(a.bid.valueWei);
      return difference > 0n ? 1 : difference < 0n ? -1 : a.id - b.id;
    });
  const recent = mergeEvents(
    views.recentBids,
    market.newEvents.filter((event) => event.type === "bid"),
  ).slice(0, 100);
  const route = document.querySelector<HTMLElement>("#market-route");
  if (!route) return;
  route.innerHTML = `
    ${syncNotice(market)}
    <div class="market-stat-grid">
      <article><strong>${open.length.toLocaleString()}</strong><span>Open bids</span></article>
      <article><strong>${market.state.totals.publicOffers.toLocaleString()}</strong><span>Public offers</span></article>
      <article><strong>${views.totals.bids.toLocaleString()}</strong><span>Historical bids</span></article>
    </div>
    <section class="market-subsection">
      <h2>Current Open Bids</h2>
      <div class="open-bid-grid">
        ${open
          .map(
            ({ id, bid }) => `
              <a href="${punkRoute(id)}" data-link>
                ${punkThumbnail(id)}
                <strong>#${id}</strong>
                <span>${formatEth(bid.valueWei, 6)} ETH</span>
                <small>by ${shortAddress(bid.bidder)}</small>
              </a>
            `,
          )
          .join("")}
      </div>
    </section>
    <section class="market-subsection">
      <h2>Recent Bid Events</h2>
      <div class="market-table-wrap">
        <table class="market-table">
          <thead><tr><th>Punk</th><th>Event</th><th>Bidder</th><th>To</th><th>Amount</th><th>Date</th></tr></thead>
          <tbody>${globalEventRows(recent)}</tbody>
        </table>
      </div>
    </section>
  `;
  bindNavigation();
}

async function renderSearch() {
  const parameters = new URLSearchParams(location.search);
  const query = parameters.get("query")?.trim() ?? "";
  const page = Math.max(0, Number(parameters.get("page") ?? 0) || 0);
  const perPage = 120;
  document.title = `${query || "Search"} - CryptoPunks`;
  app.innerHTML = `
    ${navigation}
    <main class="search-page">
      <header>
        <p class="kicker">Collection search</p>
        <h1>Search CryptoPunks</h1>
        ${searchForm(query)}
      </header>
      <section id="search-results" aria-live="polite">
        <p>Searching the block-labelled onchain attribute snapshot…</p>
      </section>
    </main>
    ${footer}
  `;
  bindNavigation();

  try {
    const catalog = await loadCatalog();
    const normalized = query.toLocaleLowerCase();
    const numericId = /^\d+$/.test(query) ? Number(query) : undefined;
    const matches = catalog.punks
      .map((attributes, id) => ({ attributes, id }))
      .filter(({ attributes, id }) => {
        if (numericId !== undefined) return id === numericId;
        return attributes.some((attribute) =>
          normalizePunkType(attribute).toLocaleLowerCase().includes(normalized),
        );
      });
    const start = page * perPage;
    const visible = matches.slice(start, start + perPage);
    const pages = Math.ceil(matches.length / perPage);
    const results = document.querySelector<HTMLElement>("#search-results");

    if (!results) return;
    results.innerHTML = `
      <div class="results-heading">
        <div><strong>${matches.length.toLocaleString()}</strong><span>Punks Found</span></div>
        <p>Snapshot block ${Number(catalog.source.blockNumber).toLocaleString()}</p>
      </div>
      ${
        visible.length
          ? `<div class="punk-results">
              ${visible
                .map(
                  ({ attributes, id }) => `
                    <a href="${punkRoute(id)}" data-link>
                      ${punkThumbnail(id)}
                      <strong>#${id}</strong>
                      <span>${normalizePunkType(attributes[0])} · ${attributes.slice(1).join(", ") || "No attributes"}</span>
                    </a>
                  `,
                )
                .join("")}
            </div>`
          : `<div class="no-results"><h2>No Punks found.</h2><p>Try a type such as Alien or an attribute such as Pipe.</p></div>`
      }
      ${
        pages > 1
          ? `<nav class="result-pagination" aria-label="Search result pages">
              ${page > 0 ? `<a href="/cryptopunks/search?query=${encodeURIComponent(query)}&page=${page - 1}" data-link>← Previous</a>` : "<span></span>"}
              <span>Page ${page + 1} of ${pages}</span>
              ${page + 1 < pages ? `<a href="/cryptopunks/search?query=${encodeURIComponent(query)}&page=${page + 1}" data-link>Next →</a>` : "<span></span>"}
            </nav>`
          : ""
      }
    `;
    bindNavigation();
  } catch (error) {
    const results = document.querySelector<HTMLElement>("#search-results");
    if (results) {
      results.textContent =
        error instanceof Error ? error.message : "Search snapshot unavailable.";
    }
  }
}

function bindRpcSettings() {
  const form = document.querySelector<HTMLFormElement>("#rpc-form");
  const input = document.querySelector<HTMLInputElement>("#rpc-url");
  const summary = document.querySelector<HTMLElement>("#rpc-summary");
  const clear = document.querySelector<HTMLButtonElement>("#clear-rpc");

  const update = () => {
    const rpcs = getRpcList();
    if (summary) {
      summary.textContent = `${rpcs.length} endpoint${rpcs.length === 1 ? "" : "s"} configured. First: ${rpcs[0]}`;
    }
    if (input) {
      input.value = localStorage.getItem("punks-permanent-rpc") ?? "";
    }
  };

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    setCustomRpc(input?.value ?? "");
    update();
  });
  clear?.addEventListener("click", () => {
    setCustomRpc("");
    update();
  });
  update();
}

function renderPlannedRoute() {
  const route = applicationPathname() + location.search;
  document.title = "CryptoPunks — parity route in progress";
  app.innerHTML = `
    ${navigation}
    <main class="planned-page">
      <p class="kicker">Route inventory</p>
      <h1>This CryptoPunks route is in the parity queue.</h1>
      <p><code>${escapeHtml(route)}</code></p>
      <p>The interface will be backed by Ethereum and reproducible snapshots. It will not silently substitute an official API.</p>
      ${searchForm()}
      <a href="/" data-link>← Return to the working routes</a>
    </main>
    ${footer}
  `;
  bindNavigation();
}

function renderNotFound(message: string) {
  document.title = "CryptoPunks — not found";
  app.innerHTML = `
    ${navigation}
    <main class="planned-page">
      <p class="kicker">Not found</p>
      <h1>${message}</h1>
      ${searchForm()}
    </main>
    ${footer}
  `;
  bindNavigation();
}

async function renderRoute() {
  window.scrollTo(0, 0);
  const pathname = applicationPathname().replace(/\/$/, "") || "/";
  const detailMatch = pathname.match(
    /^\/cryptopunks\/details\/(\d+)\/?$/,
  );

  if (detailMatch) {
    await renderPunkDetail(Number(detailMatch[1]));
  } else if (pathname === "/") {
    renderHomepage();
  } else if (
    pathname === "/cryptopunks"
  ) {
    await renderAllPunks();
  } else if (pathname === "/cryptopunks/search") {
    await renderSearch();
  } else if (pathname === "/cryptopunks/owners") {
    await renderOwners();
  } else if (pathname === "/cryptopunks/accountinfo") {
    await renderAccountInfo();
  } else if (pathname === "/cryptopunks/largest-sales") {
    await renderLargestSales();
  } else if (pathname === "/cryptopunks/transactions") {
    await renderTransactions();
  } else if (pathname === "/cryptopunks/bids") {
    await renderBids();
  } else {
    renderPlannedRoute();
  }
}

window.addEventListener("popstate", () => void renderRoute());
void renderRoute();
