/**
 * Transaction confirmation dialog.
 */
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
} from "@/components/ui";
import { useUiStore } from "@/store";
import { AlertTriangle, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import { truncateAddress, sunToTrx } from "@/lib/utils";

export function TransactionConfirmDialog() {
  const { transactionConfirmation, hideTransactionConfirmation } = useUiStore();
  const [copied, setCopied] = useState(false);

  if (!transactionConfirmation) return null;

  const { type, from, to, amount, tokenAddress, rawTransaction } =
    transactionConfirmation;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(rawTransaction, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={!!transactionConfirmation} onClose={hideTransactionConfirmation}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-yellow-500" />
          Review Unsigned Transaction
        </DialogTitle>
        <DialogDescription>
          This transaction requires your signature. Review the details carefully
          before signing with your wallet.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        {/* Transaction Type */}
        <div className="flex items-center gap-2">
          <Badge variant={type === "TRX" ? "default" : "secondary"}>
            {type} Transfer
          </Badge>
        </div>

        {/* Details */}
        <div className="space-y-3 rounded-lg bg-[hsl(var(--muted))] p-4">
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">From</span>
            <span className="font-mono text-sm">{truncateAddress(from, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">To</span>
            <span className="font-mono text-sm">{truncateAddress(to, 8)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[hsl(var(--muted-foreground))]">Amount</span>
            <span className="font-semibold">
              {type === "TRX" ? sunToTrx(amount) : amount} {type}
            </span>
          </div>
          {tokenAddress && (
            <div className="flex justify-between">
              <span className="text-[hsl(var(--muted-foreground))]">Token Contract</span>
              <span className="font-mono text-sm">{truncateAddress(tokenAddress, 8)}</span>
            </div>
          )}
        </div>

        {/* Raw Transaction */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Raw Transaction</span>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              <span className="ml-1">{copied ? "Copied!" : "Copy"}</span>
            </Button>
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-black/50 p-3 font-mono text-xs">
            {JSON.stringify(rawTransaction, null, 2)}
          </pre>
        </div>

        {/* Warning */}
        <div className="flex items-start gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-500">
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            Never share your private key. Sign this transaction locally using
            TronLink, TronWeb, or another secure wallet.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={hideTransactionConfirmation}>
          Close
        </Button>
        <Button onClick={handleCopy}>
          {copied ? "Copied!" : "Copy Transaction"}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
