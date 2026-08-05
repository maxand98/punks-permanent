import { formatEther, getAddress, type Address } from "viem";
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

type WalletState = {
  account: Address | null;
  chainId: string | null;
  expanded: boolean;
  pendingWithdrawal: bigint | null;
  loading: boolean;
  message: string;
};

const state: WalletState = {
  account: null,
  chainId: null,
  expanded: false,
  pendingWithdrawal: null,
  loading: false,
  message: "",
};

let providerWithListeners: InjectedProvider | null = null;
let locallyDisconnected = false;

function provider() {
  return (window as Window & { ethereum?: InjectedProvider }).ethereum ?? null;
}

function shortAddress(address: Address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
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
    return `<h2>Connecting</h2><p class="wallet-copy">Waiting for your wallet…</p>`;
  }

  if (!state.account) {
    return `
      <h2>Connect Wallet</h2>
      <p class="wallet-copy">Connect an Ethereum wallet to use the native CryptoPunks market.</p>
      <button class="wallet-primary" type="button" data-wallet-connect>Connect Wallet</button>
      ${state.message ? `<p class="wallet-message">${state.message}</p>` : ""}
    `;
  }

  if (state.chainId !== "0x1") {
    return `
      <h2>Wrong Network</h2>
      <p class="wallet-address">${shortAddress(state.account)}</p>
      <p class="wallet-copy">CryptoPunks uses Ethereum Mainnet.</p>
      <button class="wallet-primary" type="button" data-wallet-mainnet>Switch to Ethereum</button>
      <button class="wallet-secondary" type="button" data-wallet-disconnect>Disconnect</button>
      ${state.message ? `<p class="wallet-message">${state.message}</p>` : ""}
    `;
  }

  return `
    <h2>Connected</h2>
    <p class="wallet-address">${shortAddress(state.account)}</p>
    <p class="wallet-withdrawal">${pendingText()}</p>
    <button class="wallet-primary" type="button" data-wallet-disconnect>Disconnect</button>
    ${state.message ? `<p class="wallet-message">${state.message}</p>` : ""}
  `;
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
  state.message = "";
  renderDrawer();
  try {
    state.account = parseAccount(
      await walletProvider.request({ method: "eth_requestAccounts" }),
    );
    state.chainId = String(await walletProvider.request({ method: "eth_chainId" }));
    await refreshPendingWithdrawal();
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
  state.message = "";
  renderDrawer();
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
  drawer.querySelector<HTMLButtonElement>("[data-wallet-connect]")?.addEventListener("click", () => {
    void connectWallet();
  }, { once: true });
  drawer.querySelector<HTMLButtonElement>("[data-wallet-mainnet]")?.addEventListener("click", () => {
    void switchToMainnet();
  }, { once: true });
  drawer.querySelector<HTMLButtonElement>("[data-wallet-disconnect]")?.addEventListener("click", disconnectWallet, { once: true });
}

function listenForWalletChanges(walletProvider: InjectedProvider) {
  if (providerWithListeners === walletProvider || !walletProvider.on) return;
  providerWithListeners = walletProvider;
  walletProvider.on("accountsChanged", (...args) => {
    if (locallyDisconnected) return;
    state.account = parseAccount(args[0]);
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
  document.querySelectorAll<HTMLElement>("[data-wallet-drawer]").forEach((drawer) => {
    if (drawer.dataset.bound === "true") return;
    drawer.dataset.bound = "true";
    bindDrawerControls(drawer);
  });

  document.querySelectorAll<HTMLButtonElement>("[data-wallet-required]").forEach((button) => {
    if (button.dataset.bound === "true") return;
    button.dataset.bound = "true";
    button.addEventListener("click", () => {
      state.expanded = true;
      renderDrawer();
    });
  });

  renderDrawer();
  void restoreWallet();
}
