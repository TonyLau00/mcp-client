/**
 * Address info panel component.
 */
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
} from "@/components/ui";
import { Wallet, Zap, Activity, Coins } from "lucide-react";
import { sunToTrx, truncateAddress } from "@/lib/utils";
import { RiskWarning } from "./RiskWarning";

interface TokenBalance {
  symbol: string;
  balance: string;
  contractAddress: string;
}

interface AddressInfoProps {
  address: string;
  trxBalance: number;
  bandwidth: number;
  energy: number;
  tokens: TokenBalance[];
  riskLevel?: "low" | "medium" | "high" | "critical";
  riskScore?: number;
  riskFactors?: string[];
  tags?: string[];
}

export function AddressInfoPanel({
  address,
  trxBalance,
  bandwidth,
  energy,
  tokens,
  riskLevel,
  riskScore,
  riskFactors = [],
  tags = [],
}: AddressInfoProps) {
  const showRiskWarning = riskLevel === "high" || riskLevel === "critical";

  return (
    <div className="space-y-4">
      {/* Risk Warning */}
      {showRiskWarning && (
        <RiskWarning
          address={address}
          riskLevel={riskLevel as "high" | "critical"}
          riskFactors={riskFactors}
        />
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            Address Info
          </CardTitle>
          <p className="font-mono text-sm text-[hsl(var(--muted-foreground))]">
            {truncateAddress(address, 10)}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag, i) => (
                <Badge key={i} variant="secondary">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Risk Score */}
          {riskScore !== undefined && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--muted-foreground))]">
                Risk Score
              </span>
              <Badge
                variant={
                  riskLevel === "critical"
                    ? "destructive"
                    : riskLevel === "high"
                    ? "warning"
                    : riskLevel === "medium"
                    ? "secondary"
                    : "success"
                }
              >
                {(riskScore * 100).toFixed(0)}% ({riskLevel})
              </Badge>
            </div>
          )}

          {/* Balance Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-[hsl(var(--muted))] p-3 text-center">
              <Coins className="mx-auto h-5 w-5 text-[hsl(var(--primary))] mb-1" />
              <p className="text-lg font-semibold">{sunToTrx(trxBalance)}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">TRX</p>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted))] p-3 text-center">
              <Activity className="mx-auto h-5 w-5 text-blue-500 mb-1" />
              <p className="text-lg font-semibold">{bandwidth.toLocaleString()}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Bandwidth</p>
            </div>
            <div className="rounded-lg bg-[hsl(var(--muted))] p-3 text-center">
              <Zap className="mx-auto h-5 w-5 text-yellow-500 mb-1" />
              <p className="text-lg font-semibold">{energy.toLocaleString()}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Energy</p>
            </div>
          </div>

          {/* Token List */}
          {tokens.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">TRC20 Tokens</p>
              <div className="space-y-2">
                {tokens.map((token, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded bg-[hsl(var(--muted))] px-3 py-2"
                  >
                    <span className="font-medium">{token.symbol}</span>
                    <span className="font-mono text-sm">{token.balance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
