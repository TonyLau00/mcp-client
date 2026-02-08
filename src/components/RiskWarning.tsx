/**
 * Risk warning banner for malicious addresses.
 */
import { AlertTriangle, ShieldAlert, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui";

interface RiskWarningProps {
  address: string;
  riskLevel: "high" | "critical";
  riskFactors: string[];
  onDismiss?: () => void;
}

export function RiskWarning({
  address,
  riskLevel,
  riskFactors,
  onDismiss,
}: RiskWarningProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={cn(
        "rounded-lg p-4",
        riskLevel === "critical"
          ? "bg-red-500/20 border border-red-500/50"
          : "bg-yellow-500/20 border border-yellow-500/50"
      )}
    >
      <div className="flex items-start gap-3">
        {riskLevel === "critical" ? (
          <ShieldAlert className="h-6 w-6 text-red-500 flex-shrink-0" />
        ) : (
          <AlertTriangle className="h-6 w-6 text-yellow-500 flex-shrink-0" />
        )}
        
        <div className="flex-1 min-w-0">
          <h4
            className={cn(
              "font-semibold",
              riskLevel === "critical" ? "text-red-500" : "text-yellow-500"
            )}
          >
            {riskLevel === "critical" ? "⚠️ Critical Risk Detected" : "⚠️ High Risk Warning"}
          </h4>
          
          <p className="mt-1 text-sm opacity-90">
            Address <code className="font-mono">{address}</code> has been flagged
            as potentially dangerous.
          </p>
          
          {riskFactors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {riskFactors.map((factor, i) => (
                <li key={i} className="text-sm flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                  {factor}
                </li>
              ))}
            </ul>
          )}
        </div>

        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
