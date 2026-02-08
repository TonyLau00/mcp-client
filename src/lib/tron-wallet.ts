/**
 * TRON Wallet Service — handles wallet connectivity, transaction signing, and broadcasting.
 *
 * Supports two wallet modes:
 *   1. **TronLink** — browser extension wallet (injected window.tronWeb / window.tronLink)
 *   2. **Private Key** — local signing via tronweb SDK (keys never leave the browser)
 *
 * Everything happens entirely client-side — keys never leave the browser,
 * broadcasting goes directly to TronGrid from the browser.
 */
import { TronWeb } from "tronweb";

// ─── Types ──────────────────────────────────────────────────────

export type WalletMode = "tronlink" | "privatekey" | "none";

export interface WalletState {
  mode: WalletMode;
  address: string | null;
  connected: boolean;
  network: string | null;
}

export interface SignedTransaction {
  txID: string;
  raw_data: Record<string, unknown>;
  raw_data_hex: string;
  signature: string[];
  [key: string]: unknown;
}

export interface BroadcastResult {
  success: boolean;
  txHash: string | null;
  message: string | null;
  raw: unknown;
}

// ─── TronLink type declarations (injected by browser extension) ──

interface TronLinkWindow {
  tronWeb?: TronWeb & {
    ready?: boolean;
    defaultAddress?: { base58?: string; hex?: string };
    trx?: {
      sign: (tx: Record<string, unknown>) => Promise<SignedTransaction>;
    };
    fullNode?: { host?: string };
  };
  tronLink?: {
    ready?: boolean;
    request: (args: { method: string }) => Promise<{
      code: number;
      message: string;
      data?: { address?: string };
    }>;
  };
}

function getTronLinkWindow(): TronLinkWindow {
  return window as unknown as TronLinkWindow;
}

// ─── Private-key TronWeb instance ────────────────────────────────

let pkTronWeb: TronWeb | null = null;

/**
 * Detect the TRON network from a TronGrid / TronLink full-node URL.
 */
function detectNetwork(host: string | undefined): string {
  if (!host) return "unknown";
  const h = host.toLowerCase();
  // Nile testnet patterns
  if (h.includes("nile") || h.includes("nileex")) return "nile";
  // Shasta testnet patterns
  if (h.includes("shasta")) return "shasta";
  // Mainnet patterns (must come after testnet checks)
  if (
    h.includes("trongrid.io") ||
    h.includes("tronstack.io") ||
    h.includes("api.tronstack") ||
    h === "https://api.trongrid.io"
  )
    return "mainnet";
  return host;
}

/**
 * Poll for `window.tronWeb` to become ready with an address.
 * TronLink injects tronWeb asynchronously — on testnet this can be slower.
 */
async function waitForTronWeb(timeoutMs = 3000, intervalMs = 200): Promise<TronLinkWindow["tronWeb"]> {
  const w = getTronLinkWindow();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const tw = w.tronWeb;
    if (tw && tw.defaultAddress?.base58) return tw;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return w.tronWeb; // return whatever we have, caller decides
}

/** Stored TronWeb override when user picks a network different from TronLink's native one */
let tronLinkOverrideTw: TronWeb | null = null;

// ─── Public API ──────────────────────────────────────────────────

/**
 * Check if TronLink extension is available in the browser.
 */
export function isTronLinkAvailable(): boolean {
  const w = getTronLinkWindow();
  return !!(w.tronLink || w.tronWeb);
}

/**
 * Connect to TronLink browser extension.
 *
 * @param targetFullHost  The full-node URL the user selected in the UI
 *                        (e.g. "https://nile.trongrid.io"). When the user's
 *                        selected network differs from TronLink's native one we
 *                        create a standalone TronWeb pointed at the target node
 *                        while still reading the address from TronLink.
 * @returns wallet state on success
 */
export async function connectTronLink(targetFullHost?: string): Promise<WalletState> {
  const w = getTronLinkWindow();

  if (w.tronLink) {
    // TronLink v2+ API
    const resp = await w.tronLink.request({ method: "tron_requestAccounts" });
    if (resp.code !== 200) {
      throw new Error(resp.message || "TronLink connection rejected");
    }
  }

  // Poll for tronWeb readiness (testnet can be slower)
  const tw = await waitForTronWeb(3000);
  if (!tw || !tw.defaultAddress?.base58) {
    throw new Error(
      "TronLink is not ready. Please unlock your wallet and refresh the page.",
    );
  }

  const address = tw.defaultAddress.base58;
  const nativeNetwork = detectNetwork(tw.fullNode?.host);

  // Determine target network
  const targetNetwork = targetFullHost ? detectNetwork(targetFullHost) : nativeNetwork;

  // If the user wants a different network than TronLink's native one,
  // create a custom TronWeb instance pointed at the target node.
  // We still use TronLink for signing (via window.tronWeb.trx.sign)
  // but read/broadcast goes through the target node.
  if (targetFullHost && targetNetwork !== nativeNetwork) {
    tronLinkOverrideTw = new TronWeb({ fullHost: targetFullHost });
    // Set the address so queries go to the right account
    tronLinkOverrideTw.setAddress(address);
  } else {
    tronLinkOverrideTw = null;
  }

  return {
    mode: "tronlink",
    address,
    connected: true,
    network: targetNetwork,
  };
}

/**
 * Connect with a private key (local signing only, key never sent anywhere).
 */
export function connectPrivateKey(
  privateKey: string,
  fullHost = "https://nile.trongrid.io",
): WalletState {
  try {
    pkTronWeb = new TronWeb({
      fullHost,
      privateKey,
    });

    const address = pkTronWeb.defaultAddress?.base58 as string | undefined;
    if (!address) {
      throw new Error("Invalid private key — could not derive address");
    }

    return {
      mode: "privatekey",
      address,
      connected: true,
      network: detectNetwork(fullHost),
    };
  } catch (err) {
    pkTronWeb = null;
    throw err instanceof Error
      ? err
      : new Error("Failed to initialize wallet with private key");
  }
}

/**
 * Disconnect the wallet.
 */
export function disconnectWallet(): WalletState {
  pkTronWeb = null;
  tronLinkOverrideTw = null;
  return {
    mode: "none",
    address: null,
    connected: false,
    network: null,
  };
}

/**
 * Get the effective TronWeb instance for broadcasting on the selected network.
 * When the user selected a different network than TronLink's native one we
 * prefer the override instance so broadcasts go to the correct chain.
 */
export function getEffectiveTronWeb(mode: WalletMode): TronWeb | null {
  if (mode === "tronlink") {
    return tronLinkOverrideTw ?? (getTronLinkWindow().tronWeb as TronWeb | undefined) ?? null;
  }
  if (mode === "privatekey") {
    return pkTronWeb;
  }
  return null;
}

/**
 * Get the currently connected address.
 */
export function getConnectedAddress(mode: WalletMode): string | null {
  if (mode === "tronlink") {
    const tw = getTronLinkWindow().tronWeb;
    return tw?.defaultAddress?.base58 ?? null;
  }
  if (mode === "privatekey" && pkTronWeb) {
    return (pkTronWeb.defaultAddress?.base58 as string | undefined) ?? null;
  }
  return null;
}

/**
 * Sign an unsigned transaction.
 *
 * @param unsignedTx  The raw transaction object from `build_unsigned_transfer`
 * @param mode        Current wallet mode
 * @returns           Signed transaction with signature array
 */
export async function signTransaction(
  unsignedTx: Record<string, unknown>,
  mode: WalletMode,
): Promise<SignedTransaction> {
  if (mode === "tronlink") {
    const tw = getTronLinkWindow().tronWeb;
    if (!tw?.trx?.sign) {
      throw new Error("TronLink is not available for signing");
    }
    const signed = await tw.trx.sign(unsignedTx);
    return signed;
  }

  if (mode === "privatekey" && pkTronWeb) {
    const signed = await (pkTronWeb.trx as any).sign(unsignedTx);
    return signed as SignedTransaction;
  }

  throw new Error("No wallet connected. Please connect a wallet first.");
}

/**
 * Get the current wallet state summary.
 */
export function getWalletState(mode: WalletMode): WalletState {
  if (mode === "none") {
    return { mode: "none", address: null, connected: false, network: null };
  }

  const address = getConnectedAddress(mode);
  if (!address) {
    return { mode: "none", address: null, connected: false, network: null };
  }

  if (mode === "tronlink") {
    const tw = getTronLinkWindow().tronWeb;
    return {
      mode: "tronlink",
      address,
      connected: true,
      network: detectNetwork(tw?.fullNode?.host),
    };
  }

  return {
    mode: "privatekey",
    address,
    connected: true,
    network: pkTronWeb
      ? detectNetwork((pkTronWeb as any).fullNode?.host)
      : null,
  };
}

/**
 * Broadcast a signed transaction directly to TronGrid from the browser.
 * No server round-trip needed.
 */
export async function broadcastTransaction(
  signedTx: Record<string, unknown>,
  mode: WalletMode,
): Promise<BroadcastResult> {
  const tw = getEffectiveTronWeb(mode);
  if (!tw) throw new Error("No wallet connected for broadcasting");

  const result = await (tw.trx as any).sendRawTransaction(signedTx);
  return {
    success: result.result === true || result.code === "SUCCESS",
    txHash: (signedTx.txID as string) ?? null,
    message: result.message ?? null,
    raw: result,
  };
}

// ─── Client-side Transaction Builder ─────────────────────────────

export interface BuildTransferParams {
  tokenType: "TRX" | "TRC20";
  from: string;
  to: string;
  /** Human-readable amount, e.g. "10.5" */
  amount: string;
  /** Required for TRC20 */
  contractAddress?: string;
  /** Token decimals (default 6 for USDT) */
  decimals?: number;
  /** Fee limit in TRX for TRC20 (default 30) */
  feeLimitTrx?: number;
}

/**
 * Build an unsigned transfer transaction **client-side** using the wallet's
 * TronWeb instance, which is pointed at the user's selected network.
 *
 * This ensures the transaction's reference block comes from the correct chain
 * (testnet / mainnet), so signing + broadcasting will work on that chain.
 *
 * Falls back to the MCP server's unsigned transaction when no wallet TronWeb
 * is available (should not happen in normal flow).
 */
export async function buildTransferTx(
  mode: WalletMode,
  params: BuildTransferParams,
): Promise<Record<string, unknown>> {
  const tw = getEffectiveTronWeb(mode);
  if (!tw) {
    throw new Error("No wallet connected — cannot build transaction for the selected network");
  }

  const { tokenType, from, to, amount, contractAddress, decimals = 6, feeLimitTrx = 30 } = params;

  if (tokenType === "TRX") {
    // TRX native transfer
    const amountSun = Math.round(parseFloat(amount) * 1_000_000);
    if (amountSun <= 0) throw new Error("Amount must be greater than 0");

    const tx = await (tw.transactionBuilder as any).sendTrx(to, amountSun, from);
    return tx as Record<string, unknown>;
  }

  // TRC20 transfer
  if (!contractAddress) {
    throw new Error("contract_address is required for TRC20 transfers");
  }

  const rawAmount = BigInt(Math.round(parseFloat(amount) * 10 ** decimals));
  const feeLimit = feeLimitTrx * 1_000_000;

  const { transaction } = await (tw.transactionBuilder as any).triggerSmartContract(
    contractAddress,
    "transfer(address,uint256)",
    { feeLimit, callValue: 0 },
    [
      { type: "address", value: to },
      { type: "uint256", value: rawAmount.toString() },
    ],
    from,
  );

  if (!transaction) {
    throw new Error("Failed to build TRC20 transfer transaction");
  }

  return transaction as Record<string, unknown>;
}
