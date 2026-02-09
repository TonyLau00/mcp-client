/**
 * TransactionCard — inline card rendered in the chat area for pending
 * unsigned transactions. Shows transaction details + Sign & Send buttons.
 *
 * All signing and broadcasting happens client-side via tron-wallet.ts.
 */
import { useState } from "react";
import { useWalletStore, type PendingTransaction } from "@/store";
import {
  signTransaction,
  broadcastTransaction,
} from "@/lib/tron-wallet";
import { truncateAddress } from "@/lib/utils";
import { Button, Card, Badge } from "@/components/ui";
import {
  Send,
  Wallet,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  transaction: PendingTransaction;
}

export function TransactionCard({ transaction: tx }: Props) {
  const { connected, mode, network, updatePendingTx, removePendingTx } =
    useWalletStore();
  const [copied, setCopied] = useState(false);

  // ── Sign & broadcast flow ──
  const handleSignAndSend = async () => {
    if (!connected || mode === "none") return;

    try {
      // 1. Signing
      updatePendingTx(tx.id, { status: "signing", error: undefined });
      const signed = await signTransaction(
        tx.unsignedTransaction,
        mode,
      );

      // 2. Broadcasting
      updatePendingTx(tx.id, {
        status: "broadcasting",
        signedTransaction: signed as unknown as Record<string, unknown>,
      });
      const result = await broadcastTransaction(
        signed as unknown as Record<string, unknown>,
        mode,
      );

      if (result.success) {
        updatePendingTx(tx.id, {
          status: "success",
          txHash: result.txHash ?? undefined,
        });
      } else {
        updatePendingTx(tx.id, {
          status: "error",
          error: result.message || "Broadcast failed",
        });
      }
    } catch (err) {
      updatePendingTx(tx.id, {
        status: "error",
        error: err instanceof Error ? err.message : "Transaction failed",
      });
    }
  };

  // ── Copy raw tx JSON ──
  const handleCopy = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify(tx.unsignedTransaction, null, 2),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Tron explorer link ──
  console.log("TransactionCard network:", network); // Debug log
  const explorerUrl = tx.txHash
    ? network === "mainnet"
      ? `https://tronscan.org/#/transaction/${tx.txHash}`
      : `https://nile.tronscan.org/#/transaction/${tx.txHash}`
    : null;

  // ── Status color helper ──
  const statusColor: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    signing: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    broadcasting: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    success: "bg-green-500/10 text-green-400 border-green-500/30",
    error: "bg-red-500/10 text-red-400 border-red-500/30",
  };

  const statusLabel: Record<string, string> = {
    pending: "Awaiting Signature",
    signing: "Signing...",
    broadcasting: "Broadcasting...",
    success: "Confirmed",
    error: "Failed",
  };

  return (
    <Card
      className={cn(
        "border-l-4 mx-2 my-3",
        tx.status === "success"
          ? "border-l-green-500"
          : tx.status === "error"
            ? "border-l-red-500"
            : "border-l-yellow-500",
      )}
    >
      <div className="p-4 space-y-3">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-[hsl(var(--primary))]" />
            <span className="font-medium text-sm">
              Transfer {tx.type === "TRC20" ? "TRC20 Token" : "TRX"}
            </span>
          </div>
          <Badge
            variant="outline"
            className={cn("text-xs", statusColor[tx.status])}
          >
            {tx.status === "signing" || tx.status === "broadcasting" ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : tx.status === "success" ? (
              <CheckCircle2 className="h-3 w-3 mr-1" />
            ) : tx.status === "error" ? (
              <XCircle className="h-3 w-3 mr-1" />
            ) : null}
            {statusLabel[tx.status]}
          </Badge>
        </div>

        {/* ── Transaction details ── */}
        <div className="rounded bg-[hsl(var(--muted))] p-3 text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">From</span>
            <span className="font-mono">{truncateAddress(tx.from, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">To</span>
            <span className="font-mono">{truncateAddress(tx.to, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">Amount</span>
            <span className="font-semibold">{tx.amount} {tx.type}</span>
          </div>
          {tx.tokenAddress && (
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Token</span>
              <span className="font-mono">
                {truncateAddress(tx.tokenAddress, 6)}
              </span>
            </div>
          )}
          {tx.txHash && (
            <div className="flex justify-between items-center">
              <span className="text-[hsl(var(--muted-foreground))]">TxHash</span>
              <span className="font-mono flex items-center gap-1">
                {truncateAddress(tx.txHash, 8)}
                {explorerUrl && (
                  <a
                    href={explorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[hsl(var(--primary))] hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </span>
            </div>
          )}
        </div>

        {/* ── Error message ── */}
        {tx.status === "error" && tx.error && (
          <div className="rounded bg-red-500/10 p-2 text-xs text-red-400">
            {tx.error}
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex items-center gap-2">
          {tx.status === "pending" && (
            <>
              {connected ? (
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSignAndSend}
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Sign &amp; Send
                </Button>
              ) : (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  Connect wallet to sign →
                </span>
              )}

              <Button
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={handleCopy}
              >
                <Copy className="h-3 w-3" />
                {copied ? "Copied!" : "Copy Raw TX"}
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-[hsl(var(--muted-foreground))]"
                onClick={() => removePendingTx(tx.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {tx.status === "error" && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={handleSignAndSend}
              >
                <Wallet className="h-3.5 w-3.5" />
                Retry
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[hsl(var(--muted-foreground))]"
                onClick={() => removePendingTx(tx.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {tx.status === "success" && (
            <>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    View on TronScan
                  </Button>
                </a>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-[hsl(var(--muted-foreground))]"
                onClick={() => removePendingTx(tx.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}

          {(tx.status === "signing" || tx.status === "broadcasting") && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto text-[hsl(var(--muted-foreground))]"
              onClick={() => removePendingTx(tx.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
