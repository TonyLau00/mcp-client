/**
 * WalletConnect — header button for connecting/disconnecting a TRON wallet.
 * Supports TronLink browser extension and private-key based signing.
 */
import { useState, useRef, useEffect } from "react";
import { useWalletStore } from "@/store";
import {
  isTronLinkAvailable,
  connectTronLink,
  connectPrivateKey,
  disconnectWallet,
} from "@/lib/tron-wallet";
import { truncateAddress } from "@/lib/utils";
import { Button, Input } from "@/components/ui";
import { Wallet, LogOut, ChevronDown, Key, Globe, Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Network presets ─────────────────────────────────────────────

type NetworkId = "mainnet" | "nile" | "shasta" | "custom";

interface NetworkPreset {
  id: NetworkId;
  label: string;
  fullHost: string;
  badge?: string;
}

const NETWORK_PRESETS: NetworkPreset[] = [
  { id: "mainnet", label: "Mainnet", fullHost: "https://api.trongrid.io", badge: "prod" },
  { id: "nile", label: "Nile Testnet", fullHost: "https://nile.trongrid.io", badge: "test" },
  { id: "shasta", label: "Shasta Testnet", fullHost: "https://api.shasta.trongrid.io", badge: "test" },
];

export function WalletConnect() {
  const { mode, address, connected, network, setWallet } = useWalletStore();
  const [open, setOpen] = useState(false);
  const [pkInput, setPkInput] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState<NetworkId>("nile");
  const [customHost, setCustomHost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /** Resolve the full-node URL from the current network selection. */
  const resolvedHost =
    selectedNetwork === "custom"
      ? customHost
      : NETWORK_PRESETS.find((n) => n.id === selectedNetwork)!.fullHost;

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleTronLink = async () => {
    setError(null);
    setLoading(true);
    try {
      const state = await connectTronLink(resolvedHost);
      setWallet(state);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePrivateKey = () => {
    if (!pkInput.trim()) {
      setError("Please enter a private key");
      return;
    }
    if (selectedNetwork === "custom" && !customHost.trim()) {
      setError("Please enter a custom RPC URL");
      return;
    }
    setError(null);
    try {
      const state = connectPrivateKey(pkInput.trim(), resolvedHost);
      setWallet(state);
      setPkInput("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid private key");
    }
  };

  const handleDisconnect = () => {
    const state = disconnectWallet();
    setWallet(state);
    setOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Main button */}
      <Button
        variant={connected ? "outline" : "default"}
        size="sm"
        onClick={() => setOpen(!open)}
        className={cn(
          "gap-1.5",
          connected && "border-green-500/40 text-green-400 hover:bg-green-500/10",
        )}
      >
        <Wallet className="h-4 w-4" />
        {connected ? (
          <>
            <span className={cn(
              "rounded px-1 py-0.5 text-[10px] font-medium leading-none",
              network === "mainnet"
                ? "bg-orange-500/20 text-orange-400"
                : "bg-blue-500/20 text-blue-400",
            )}>
              {network}
            </span>
            <span className="font-mono text-xs">{truncateAddress(address!, 4)}</span>
            <ChevronDown className="h-3 w-3" />
          </>
        ) : (
          "Connect Wallet"
        )}
      </Button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-xl">
          {connected ? (
            /* ── Connected state ── */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Wallet Connected</span>
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <Check className="h-3 w-3" />
                  {mode === "tronlink" ? "TronLink" : "Private Key"}
                </span>
              </div>
              <div className="rounded bg-[hsl(var(--muted))] p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Address</span>
                  <span className="font-mono text-xs">{truncateAddress(address!, 8)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Network</span>
                  <span className="flex items-center gap-1 text-xs">
                    <Globe className="h-3 w-3" />
                    {network}
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-red-400 border-red-500/30 hover:bg-red-500/10"
                onClick={handleDisconnect}
              >
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                Disconnect
              </Button>
            </div>
          ) : (
            /* ── Disconnected state — connect options ── */
            <div className="space-y-4">
              <p className="text-sm font-medium">Connect Wallet</p>

              {/* Network selector (shared by TronLink + Private Key) */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  <Globe className="h-3 w-3" />
                  <span>Network</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {NETWORK_PRESETS.map((net) => (
                    <button
                      key={net.id}
                      onClick={() => setSelectedNetwork(net.id)}
                      className={cn(
                        "rounded-md border px-2 py-1.5 text-xs transition-colors",
                        selectedNetwork === net.id
                          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                          : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]",
                      )}
                    >
                      <div className="font-medium">{net.label.split(" ")[0]}</div>
                      {net.badge && (
                        <div className={cn(
                          "mt-0.5 text-[10px]",
                          net.badge === "prod" ? "text-orange-400" : "text-blue-400",
                        )}>
                          {net.badge}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setSelectedNetwork("custom")}
                  className={cn(
                    "w-full rounded-md border px-2 py-1.5 text-xs transition-colors text-left",
                    selectedNetwork === "custom"
                      ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))]"
                      : "border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]",
                  )}
                >
                  Custom RPC
                </button>
                {selectedNetwork === "custom" && (
                  <Input
                    type="text"
                    placeholder="https://your-node.example.com"
                    value={customHost}
                    onChange={(e) => setCustomHost(e.target.value)}
                    className="text-xs"
                  />
                )}
              </div>

              {/* TronLink option */}
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                disabled={!isTronLinkAvailable() || loading || (selectedNetwork === "custom" && !customHost.trim())}
                onClick={handleTronLink}
              >
                <Wallet className="h-4 w-4" />
                {isTronLinkAvailable()
                  ? loading
                    ? "Connecting..."
                    : "Connect TronLink"
                  : "TronLink not detected"}
              </Button>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-[hsl(var(--border))]" />
                <span className="text-xs text-[hsl(var(--muted-foreground))]">or</span>
                <div className="flex-1 border-t border-[hsl(var(--border))]" />
              </div>

              {/* Private key option */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                  <Key className="h-3 w-3" />
                  <span>Private Key (local signing only)</span>
                </div>
                <Input
                  type="password"
                  placeholder="Enter private key (hex)"
                  value={pkInput}
                  onChange={(e) => setPkInput(e.target.value)}
                  className="font-mono text-xs"
                  onKeyDown={(e) => e.key === "Enter" && handlePrivateKey()}
                />
                <Button
                  variant="default"
                  size="sm"
                  className="w-full"
                  onClick={handlePrivateKey}
                  disabled={!pkInput.trim() || (selectedNetwork === "custom" && !customHost.trim())}
                >
                  Connect with Private Key
                </Button>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">{error}</div>
              )}

              {/* Warning */}
              <p className="text-[10px] text-[hsl(var(--muted-foreground))] leading-tight">
                ⚠️ Private keys are stored in browser memory only and never sent
                to any server. Use a testnet key for development.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
