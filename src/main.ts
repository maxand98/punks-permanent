import "./style.css";
import { getRpcList, loadPunk, setCustomRpc, svgDataUrl } from "./ethereum";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) throw new Error("Application root is missing.");

app.innerHTML = `
  <header class="site-header">
    <a class="wordmark" href="/">Punks Permanent</a>
    <div class="chain-status"><span></span> Ethereum mainnet</div>
    <a href="https://github.com/maxand98/punks-permanent">Source ↗</a>
  </header>
  <main>
    <section class="hero">
      <p class="eyebrow">Independent CryptoPunks client · Alpha 0.1</p>
      <h1>The Punks are permanent.<br><em>The doorway should be too.</em></h1>
      <p class="lede">A public, reproducible interface that reads the artwork and native market directly from Ethereum. No official API is required.</p>
      <form id="punk-form" class="punk-search">
        <label for="punk-id">Open a Punk</label>
        <div>
          <span>#</span>
          <input id="punk-id" name="punk" type="number" min="0" max="9999" value="7804" required>
          <button type="submit">Read from chain</button>
        </div>
      </form>
    </section>

    <section class="viewer" aria-live="polite">
      <div class="art-stage" id="art-stage">
        <div class="loading-grid"></div>
        <p>Calling CryptoPunksData…</p>
      </div>
      <article class="punk-record" id="punk-record">
        <p class="eyebrow">Canonical contract record</p>
        <h2>Punk #7804</h2>
        <p class="loading-copy">Loading owner, traits and native market state from Ethereum.</p>
      </article>
    </section>

    <section class="principles">
      <p class="eyebrow">What this client refuses to depend on</p>
      <div class="principle-grid">
        <article><span>01</span><h3>No image server</h3><p>The SVG is returned by the onchain CryptoPunksData contract.</p></article>
        <article><span>02</span><h3>No official API</h3><p>Ownership, bids and offers are read from the original market contract.</p></article>
        <article><span>03</span><h3>No single RPC</h3><p>Fallback endpoints are built in, and you can supply your own Ethereum node.</p></article>
        <article><span>04</span><h3>No hidden build</h3><p>Every release will be reproducible, checksummed and content-addressed.</p></article>
      </div>
    </section>

    <section class="node-settings">
      <div>
        <p class="eyebrow">Your doorway, your node</p>
        <h2>Replace our defaults.</h2>
        <p>The essential read path should work through a local node or any standards-compatible Ethereum RPC.</p>
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
  <footer>
    <span>CC0 code · Built for independent operation</span>
    <a href="https://maxand98.com/writing/the-punks-are-permanent/">Read the preservation proposal ↗</a>
  </footer>
`;

const form = document.querySelector<HTMLFormElement>("#punk-form")!;
const input = document.querySelector<HTMLInputElement>("#punk-id")!;
const stage = document.querySelector<HTMLDivElement>("#art-stage")!;
const record = document.querySelector<HTMLElement>("#punk-record")!;
const rpcForm = document.querySelector<HTMLFormElement>("#rpc-form")!;
const rpcInput = document.querySelector<HTMLInputElement>("#rpc-url")!;
const rpcSummary = document.querySelector<HTMLElement>("#rpc-summary")!;

function shortAddress(address: string) {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

function etherscan(address: string) {
  return `https://etherscan.io/address/${address}`;
}

async function renderPunk(id: number) {
  stage.classList.add("is-loading");
  stage.innerHTML = `<div class="loading-grid"></div><p>Reading Punk #${id} from Ethereum…</p>`;
  record.innerHTML = `<p class="eyebrow">Canonical contract record</p><h2>Punk #${id}</h2><p class="loading-copy">Querying multiple independent contract methods.</p>`;

  try {
    const punk = await loadPunk(id);
    stage.classList.remove("is-loading");
    stage.innerHTML = `<img src="${svgDataUrl(punk.svg)}" alt="CryptoPunk #${punk.id}, rendered from the CryptoPunksData contract"><span>Onchain SVG · 24 × 24 source pixels</span>`;
    record.innerHTML = `
      <p class="eyebrow">Canonical contract record</p>
      <h2>Punk #${punk.id}</h2>
      <dl>
        <div><dt>Owner</dt><dd><a href="${etherscan(punk.owner)}">${shortAddress(punk.owner)} ↗</a></dd></div>
        <div><dt>Offer</dt><dd>${punk.offer ? `${punk.offer.priceEth} ETH` : "Not offered"}</dd></div>
        <div><dt>Highest open bid</dt><dd>${punk.bid ? `${punk.bid.priceEth} ETH` : "No open bid"}</dd></div>
      </dl>
      <div class="traits">${punk.attributes.map((trait) => `<span>${trait}</span>`).join("")}</div>
      <p class="provenance">Artwork: CryptoPunksData <code>0x16F5…AF3B2</code><br>State: CryptoPunksMarket <code>0xb47e…3BBB</code></p>
    `;
    history.replaceState(null, "", `?punk=${punk.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Ethereum error.";
    stage.classList.remove("is-loading");
    stage.innerHTML = `<div class="error-mark">!</div><p>Ethereum read unavailable</p>`;
    record.innerHTML = `<p class="eyebrow">The failure is visible</p><h2>Could not load Punk #${id}</h2><p>${message}</p><p>Try your own RPC below. A decentralised client must fail legibly and remain reconfigurable.</p>`;
  }
}

function updateRpcSummary() {
  const rpcs = getRpcList();
  rpcSummary.textContent = `${rpcs.length} endpoint${rpcs.length === 1 ? "" : "s"} configured. First: ${rpcs[0]}`;
  rpcInput.value = localStorage.getItem("punks-permanent-rpc") ?? "";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void renderPunk(Number(input.value));
});

rpcForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setCustomRpc(rpcInput.value);
  updateRpcSummary();
  void renderPunk(Number(input.value));
});

document.querySelector("#clear-rpc")?.addEventListener("click", () => {
  setCustomRpc("");
  updateRpcSummary();
  void renderPunk(Number(input.value));
});

const initial = Number(new URLSearchParams(location.search).get("punk") ?? 7804);
input.value = String(Number.isInteger(initial) && initial >= 0 && initial <= 9999 ? initial : 7804);
updateRpcSummary();
void renderPunk(Number(input.value));
