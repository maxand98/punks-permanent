import {
  encodeFunctionData,
  formatEther,
  getAddress,
  isAddress,
  parseEther,
  toHex,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import { CRYPTOPUNKS_MARKET, marketAbi } from "./contracts";
import { getEthereumClient } from "./ethereum";

type ProviderRequest = {
  method: string;
  params?: readonly unknown[] | object;
};

type InjectedProvider = {
  request(request: ProviderRequest): Promise<unknown>;
  on?(event: string, listener: (...args: unknown[]) => void): void;
};

type ActionKind =
  | "buy"
  | "bid"
  | "withdraw-bid"
  | "accept-bid"
  | "offer"
  | "cancel-offer"
  | "transfer"
  | "withdraw";

type MarketAction = {
  kind: ActionKind;
  punkId?: number;
  offerEth?: string;
  bidEth?: string;
};

type WalletState = {
  account: Address | null;
  chainId: string | null;
  expanded: boolean;
  pendingWithdrawal: bigint | null;
  loading: boolean;
  message: string;
  transactionHash: Hex | null;
  action: MarketAction | null;
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const state: WalletState = {
  account: null,
  chainId: null,
  expanded: false,
  pendingWithdrawal: null,
  loading: false,
  message: "",
  transactionHash: null,
  action: null,
};

let providerWithListeners: InjectedProvider | null = null;
let locallyDisconnected = false;

function provider() {
  return (window as Window & { ethereum?: InjectedProvider }).ethereum ?? null;
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function sameAddress(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
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

function parseAccount(value: unknown): Address | null {
  if (!Array.isArray(value) || typeof value[0] !== "string") return null;
  try {
    return getAddress(value[0]);
  } catch {
    return null;
  }
}

async function refreshPendingWithdrawal() {
  if (!state.account || state.chainId !== "0x1") {
    state.pendingWithdrawal = null;
    return;
  }

  try {
    state.pendingWithdrawal = await getEthereumClient().readContract({
      address: CRYPTOPUNKS_MARKET,
      abi: marketAbi,
      functionName: "pendingWithdrawals",
      args: [state.account],
    });
  } catch {
    state.pendingWithdrawal = null;
  }
}

function pendingText() {
  if (state.pendingWithdrawal === null || state.pendingWithdrawal === 0n) {
    return "No pending withdrawals.";
  }
  return `${formatEther(state.pendingWithdrawal)} ETH available to withdraw.`;
}

function messageContent() {
  const message = state.message
    ? `<p class="wallet-message">${escapeHtml(state.message)}</p>`
    : "";
  const transaction = state.transactionHash
    ? `<a class="wallet-transaction-link" href="https://etherscan.io/tx/${state.transactionHash}" target="_blank" rel="noreferrer">View transaction on Etherscan</a>`
    : "";
  return `${message}${transaction}`;
}

function transactionContent(action: MarketAction) {
  const id = action.punkId;
  const punkLabel = id === undefined ? "" : `CryptoPunk #${id}`;
  const back = '<button class="wallet-back" type="button" data-wallet-back>← Back</button>';
  const notice = '<p class="wallet-confirmation-note">Current contract state is checked before your wallet opens. Your wallet provides the final confirmation.</p>';

  if (action.kind === "buy" && id !== undefined) {
    return `${back}<h2>Buy ${punkLabel}</h2><p class="wallet-price">${escapeHtml(action.offerEth ?? "—")} ETH</p>${notice}<form data-market-transaction><button class="wallet-primary" type="submit">Buy Punk</button></form>${messageContent()}`;
  }

  if (action.kind === "bid" && id !== undefined) {
    return `${back}<h2>Bid on ${punkLabel}</h2><form class="wallet-form" data-market-transaction><label for="wallet-bid-value">Bid amount in ETH</label><input id="wallet-bid-value" name="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" required>${notice}<button class="wallet-primary" type="submit">Place Bid</button></form>${messageContent()}`;
  }

  if (action.kind === "offer" && id !== undefined) {
    return `${back}<h2>Offer ${punkLabel}</h2><form class="wallet-form" data-market-transaction><label for="wallet-offer-value">Sale price in ETH</label><input id="wallet-offer-value" name="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" required><label for="wallet-offer-address">Specific buyer address (optional)</label><input id="wallet-offer-address" name="recipient" autocomplete="off" placeholder="0x…">${notice}<button class="wallet-primary" type="submit">Offer Punk for Sale</button></form>${messageContent()}`;
  }

  if (action.kind === "transfer" && id !== undefined) {
    return `${back}<h2>Transfer ${punkLabel}</h2><form class="wallet-form" data-market-transaction><label for="wallet-transfer-address">Recipient Ethereum address</label><input id="wallet-transfer-address" name="recipient" autocomplete="off" placeholder="0x…" required>${notice}<button class="wallet-primary" type="submit">Transfer Punk</button></form>${messageContent()}`;
  }

  const labels: Record<Exclude<ActionKind, "buy" | "bid" | "offer" | "transfer">, [string, string]> = {
    "withdraw-bid": [`Withdraw bid on ${punkLabel}`, `Withdraw ${action.bidEth ?? "the current"} ETH bid`],
    "accept-bid": [`Accept bid on ${punkLabel}`, `Accept ${action.bidEth ?? "the current"} ETH bid`],
    "cancel-offer": [`Remove ${punkLabel} from sale`, "Remove sale offer"],
    withdraw: ["Withdraw proceeds", "Withdraw ETH"],
  };
  const [title, button] = labels[action.kind as keyof typeof labels];
  return `${back}<h2>${title}</h2>${notice}<form data-market-transaction><button class="wallet-primary" type="submit">${button}</button></form>${messageContent()}`;
}

function drawerContent() {
  if (!provider()) {
    return `
      <h2>Connect Wallet</h2>
      <p class="wallet-copy">Install an Ethereum wallet such as MetaMask to use the native CryptoPunks market.</p>
      <button class="wallet-primary" type="button" data-wallet-connect>Connect Wallet</button>
      <p class="wallet-message">No compatible wallet was found.</p>
    `;
  }

  if (state.loading) {
    return `<h2>Checking</h2><p class="wallet-copy">${escapeHtml(state.message || "Waiting for your wallet…")}</p>`;
  }

  if (!state.account) {
    const intent = state.action?.punkId === undefined
      ? ""
      : `<p class="wallet-intent">Continue with CryptoPunk #${state.action.punkId}</p>`;
    return `
      <h2>Connect Wallet</h2>
      ${intent}
      <p class="wallet-copy">Connect an Ethereum wallet to use the native CryptoPunks market.</p>
      <button class="wallet-primary" type="button" data-wallet-connect>Connect Wallet</button>
      ${messageContent()}
    `;
  }

  if (state.chainId !== "0x1") {
    return `
      <h2>Wrong Network</h2>
      <p class="wallet-address">${shortAddress(state.account)}</p>
      <p class="wallet-copy">CryptoPunks uses Ethereum Mainnet.</p>
      <button class="wallet-primary" type="button" data-wallet-mainnet>Switch to Ethereum</button>
      <button class="wallet-secondary" type="button" data-wallet-disconnect>Disconnect</button>
      ${messageContent()}
    `;
  }

  if (state.action) return transactionContent(state.action);

  const withdraw = state.pendingWithdrawal && state.pendingWithdrawal > 0n
    ? '<button class="wallet-secondary" type="button" data-wallet-withdraw>Withdraw proceeds</button>'
    : "";
  return `
    <h2>Connected</h2>
    <p class="wallet-address">${shortAddress(state.account)}</p>
    <p class="wallet-withdrawal">${pendingText()}</p>
    ${withdraw}
    <button class="wallet-primary" type="button" data-wallet-disconnect>Disconnect</button>
    ${messageContent()}
  `;
}

function syncMarketControls() {
  document.querySelectorAll<HTMLButtonElement>("[data-market-action]").forEach((button) => {
    const owner = button.dataset.owner;
    const bidder = button.dataset.bidder;
    const kind = button.dataset.marketAction as ActionKind;
    const isOwner = Boolean(state.account && owner && sameAddress(state.account, owner));
    const isBidder = Boolean(state.account && bidder && sameAddress(state.account, bidder));
    if (["offer", "cancel-offer", "transfer", "accept-bid"].includes(kind)) {
      button.hidden = !isOwner;
    } else if (kind === "withdraw-bid") {
      button.hidden = !isBidder;
    } else if (kind === "buy") {
      button.hidden = isOwner;
    }
  });
}

function renderDrawer() {
  document.querySelectorAll<HTMLElement>("[data-wallet-drawer]").forEach((drawer) => {
    drawer.classList.toggle("is-collapsed", !state.expanded);
    const panel = drawer.querySelector<HTMLElement>("[data-wallet-panel]");
    const tab = drawer.querySelector<HTMLButtonElement>("[data-wallet-tab]");
    if (panel) {
      panel.innerHTML = `
        <button class="wallet-collapse" type="button" data-wallet-collapse aria-label="Collapse wallet panel">›</button>
        ${drawerContent()}
      `;
    }
    if (tab) {
      tab.hidden = state.expanded;
      tab.textContent = state.account ? shortAddress(state.account) : "Connect Wallet";
    }
    bindDrawerControls(drawer);
  });
  syncMarketControls();
}

async function connectWallet() {
  const walletProvider = provider();
  if (!walletProvider) {
    state.message = "No compatible Ethereum wallet was found.";
    renderDrawer();
    return;
  }

  locallyDisconnected = false;
  state.loading = true;
  state.message = "Waiting for your wallet…";
  state.transactionHash = null;
  renderDrawer();
  try {
    state.account = parseAccount(
      await walletProvider.request({ method: "eth_requestAccounts" }),
    );
    state.chainId = String(await walletProvider.request({ method: "eth_chainId" }));
    await refreshPendingWithdrawal();
    state.message = "";
  } catch (error) {
    state.account = null;
    state.message = error instanceof Error ? error.message : "Wallet connection was cancelled.";
  } finally {
    state.loading = false;
    renderDrawer();
  }
}

async function switchToMainnet() {
  const walletProvider = provider();
  if (!walletProvider) return;
  state.message = "";
  try {
    await walletProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0x1" }],
    });
    state.chainId = String(await walletProvider.request({ method: "eth_chainId" }));
    await refreshPendingWithdrawal();
  } catch (error) {
    state.message = error instanceof Error ? error.message : "The network change was cancelled.";
  }
  renderDrawer();
}

function disconnectWallet() {
  locallyDisconnected = true;
  state.account = null;
  state.pendingWithdrawal = null;
  state.action = null;
  state.message = "";
  state.transactionHash = null;
  renderDrawer();
}

async function readPunkMarketState(punkId: number) {
  const client = getEthereumClient();
  const id = BigInt(punkId);
  const [owner, offer, bid] = await Promise.all([
    client.readContract({ address: CRYPTOPUNKS_MARKET, abi: marketAbi, functionName: "punkIndexToAddress", args: [id] }),
    client.readContract({ address: CRYPTOPUNKS_MARKET, abi: marketAbi, functionName: "punksOfferedForSale", args: [id] }),
    client.readContract({ address: CRYPTOPUNKS_MARKET, abi: marketAbi, functionName: "punkBids", args: [id] }),
  ]);
  return { owner, offer, bid };
}

function ethInput(form: HTMLFormElement, name: string) {
  const value = form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value.trim() ?? "";
  try {
    const amount = parseEther(value);
    if (amount <= 0n) throw new Error();
    return amount;
  } catch {
    throw new Error("Enter a valid ETH amount greater than zero.");
  }
}

async function prepareTransaction(form: HTMLFormElement) {
  if (!state.account || !state.action) throw new Error("Connect your wallet first.");
  const action = state.action;
  const id = action.punkId === undefined ? null : BigInt(action.punkId);
  const market = action.punkId === undefined ? null : await readPunkMarketState(action.punkId);
  let functionName = "withdraw";
  let args: readonly unknown[] = [];
  let value = 0n;

  if (action.kind === "withdraw") {
    await refreshPendingWithdrawal();
    if (!state.pendingWithdrawal || state.pendingWithdrawal <= 0n) throw new Error("There are no proceeds to withdraw.");
  } else if (!market || id === null) {
    throw new Error("The Punk market state could not be loaded.");
  } else if (action.kind === "buy") {
    if (!market.offer[0]) throw new Error("This Punk is no longer for sale.");
    if (sameAddress(market.owner, state.account)) throw new Error("You already own this Punk.");
    if (!sameAddress(market.offer[4], ZERO_ADDRESS) && !sameAddress(market.offer[4], state.account)) {
      throw new Error("This offer is reserved for another address.");
    }
    functionName = "buyPunk";
    args = [id];
    value = market.offer[3];
  } else if (action.kind === "bid") {
    if (sameAddress(market.owner, state.account)) throw new Error("The owner cannot bid on their own Punk.");
    functionName = "enterBidForPunk";
    args = [id];
    value = ethInput(form, "amount");
  } else if (action.kind === "withdraw-bid") {
    if (!market.bid[0] || !sameAddress(market.bid[2], state.account)) throw new Error("There is no active bid from this wallet.");
    functionName = "withdrawBidForPunk";
    args = [id];
  } else if (action.kind === "accept-bid") {
    if (!sameAddress(market.owner, state.account)) throw new Error("Only the owner can accept this bid.");
    if (!market.bid[0]) throw new Error("There is no active bid to accept.");
    functionName = "acceptBidForPunk";
    args = [id, market.bid[3]];
  } else if (action.kind === "offer") {
    if (!sameAddress(market.owner, state.account)) throw new Error("Only the owner can offer this Punk for sale.");
    const amount = ethInput(form, "amount");
    const recipient = form.querySelector<HTMLInputElement>('[name="recipient"]')?.value.trim() ?? "";
    if (recipient) {
      if (!isAddress(recipient) || sameAddress(recipient, ZERO_ADDRESS)) throw new Error("Enter a valid buyer address.");
      functionName = "offerPunkForSaleToAddress";
      args = [id, amount, getAddress(recipient)];
    } else {
      functionName = "offerPunkForSale";
      args = [id, amount];
    }
  } else if (action.kind === "cancel-offer") {
    if (!sameAddress(market.owner, state.account)) throw new Error("Only the owner can remove this sale offer.");
    if (!market.offer[0]) throw new Error("This Punk is not currently for sale.");
    functionName = "punkNoLongerForSale";
    args = [id];
  } else if (action.kind === "transfer") {
    if (!sameAddress(market.owner, state.account)) throw new Error("Only the owner can transfer this Punk.");
    const recipient = form.querySelector<HTMLInputElement>('[name="recipient"]')?.value.trim() ?? "";
    if (!isAddress(recipient) || sameAddress(recipient, ZERO_ADDRESS)) throw new Error("Enter a valid recipient address.");
    if (sameAddress(recipient, state.account)) throw new Error("The recipient already owns this Punk.");
    functionName = "transferPunk";
    args = [getAddress(recipient), id];
  }

  const data = encodeFunctionData({
    abi: marketAbi as Abi,
    functionName,
    args,
  });
  return { data, value };
}

async function submitTransaction(form: HTMLFormElement) {
  const walletProvider = provider();
  if (!walletProvider || !state.account || state.chainId !== "0x1") return;
  state.loading = true;
  state.message = "Checking current Ethereum state…";
  state.transactionHash = null;
  renderDrawer();
  try {
    const { data, value } = await prepareTransaction(form);
    await getEthereumClient().call({
      account: state.account,
      to: CRYPTOPUNKS_MARKET,
      data,
      value,
    });
    state.message = "Confirm this transaction in your wallet.";
    renderDrawer();
    const result = await walletProvider.request({
      method: "eth_sendTransaction",
      params: [{
        from: state.account,
        to: CRYPTOPUNKS_MARKET,
        data,
        value: toHex(value),
      }],
    });
    if (typeof result !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(result)) {
      throw new Error("The wallet did not return a transaction hash.");
    }
    state.transactionHash = result as Hex;
    state.message = "Transaction submitted. Waiting for Ethereum confirmation.";
    state.loading = false;
    renderDrawer();
    void getEthereumClient().waitForTransactionReceipt({ hash: state.transactionHash }).then(async () => {
      state.message = "Transaction confirmed on Ethereum.";
      state.action = null;
      await refreshPendingWithdrawal();
      renderDrawer();
      window.dispatchEvent(new CustomEvent("punks:transaction-confirmed"));
    }).catch(() => undefined);
  } catch (error) {
    state.loading = false;
    state.message = error instanceof Error ? error.message : "The transaction was cancelled.";
    renderDrawer();
  }
}

function bindDrawerControls(drawer: HTMLElement) {
  drawer.querySelector<HTMLButtonElement>("[data-wallet-collapse]")?.addEventListener("click", () => {
    state.expanded = false;
    renderDrawer();
  }, { once: true });
  drawer.querySelector<HTMLButtonElement>("[data-wallet-tab]")?.addEventListener("click", () => {
    state.expanded = true;
    renderDrawer();
  }, { once: true });
  drawer.querySelector<HTMLButtonElement>("[data-wallet-connect]")?.addEventListener("click", () => void connectWallet(), { once: true });
  drawer.querySelector<HTMLButtonElement>("[data-wallet-mainnet]")?.addEventListener("click", () => void switchToMainnet(), { once: true });
  drawer.querySelector<HTMLButtonElement>("[data-wallet-disconnect]")?.addEventListener("click", disconnectWallet, { once: true });
  drawer.querySelector<HTMLButtonElement>("[data-wallet-back]")?.addEventListener("click", () => {
    state.action = null;
    state.message = "";
    state.transactionHash = null;
    renderDrawer();
  }, { once: true });
  drawer.querySelector<HTMLButtonElement>("[data-wallet-withdraw]")?.addEventListener("click", () => {
    state.action = { kind: "withdraw" };
    state.message = "";
    renderDrawer();
  }, { once: true });
  drawer.querySelector<HTMLFormElement>("[data-market-transaction]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitTransaction(event.currentTarget as HTMLFormElement);
  }, { once: true });
}

function listenForWalletChanges(walletProvider: InjectedProvider) {
  if (providerWithListeners === walletProvider || !walletProvider.on) return;
  providerWithListeners = walletProvider;
  walletProvider.on("accountsChanged", (...args) => {
    if (locallyDisconnected) return;
    state.account = parseAccount(args[0]);
    state.action = null;
    void refreshPendingWithdrawal().finally(renderDrawer);
  });
  walletProvider.on("chainChanged", (...args) => {
    state.chainId = typeof args[0] === "string" ? args[0] : null;
    void refreshPendingWithdrawal().finally(renderDrawer);
  });
}

async function restoreWallet() {
  const walletProvider = provider();
  if (!walletProvider || locallyDisconnected) return;
  listenForWalletChanges(walletProvider);
  try {
    state.account = parseAccount(await walletProvider.request({ method: "eth_accounts" }));
    state.chainId = String(await walletProvider.request({ method: "eth_chainId" }));
    if (state.account) await refreshPendingWithdrawal();
  } catch {
    state.account = null;
  }
  renderDrawer();
}

export function bindWalletDrawer() {
  if (
    state.action?.punkId !== undefined &&
    !document.querySelector(`[data-market-action][data-punk-id="${state.action.punkId}"]`)
  ) {
    state.action = null;
  }

  document.querySelectorAll<HTMLElement>("[data-wallet-drawer]").forEach((drawer) => {
    if (drawer.dataset.bound === "true") return;
    drawer.dataset.bound = "true";
    bindDrawerControls(drawer);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-market-action]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      state.action = {
        kind: button.dataset.marketAction as ActionKind,
        punkId: button.dataset.punkId ? Number(button.dataset.punkId) : undefined,
        offerEth: button.dataset.offerEth,
        bidEth: button.dataset.bidEth,
      };
      state.message = "";
      state.transactionHash = null;
      state.expanded = true;
      renderDrawer();
    });
  });

  renderDrawer();
  void restoreWallet();
}
