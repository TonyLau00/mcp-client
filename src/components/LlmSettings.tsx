/**
 * LLM Provider settings panel — allows runtime switching between providers.
 *
 * Opens as a dialog from the header. Users can:
 * - Select the active LLM provider
 * - Configure API key, base URL, and model for each provider
 * - Settings are persisted to localStorage
 */
import { useState } from "react";
import { useLlmStore } from "@/store";
import { ALL_PROVIDERS, type LlmProvider, type ProviderConfig } from "@/config";
import { Button, Input, Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui";
import { Settings2, Check, Eye, EyeOff, ExternalLink } from "lucide-react";

/** Provider metadata for display */
const PROVIDER_META: Record<LlmProvider, { icon: string; description: string; docsUrl?: string }> = {
  openai: { icon: "🟢", description: "GPT-4o, o1, o3 series", docsUrl: "https://platform.openai.com/api-keys" },
  claude: { icon: "🟠", description: "Claude Opus, Sonnet, Haiku", docsUrl: "https://console.anthropic.com/" },
  deepseek: { icon: "🔵", description: "DeepSeek-V3 / R1", docsUrl: "https://platform.deepseek.com/api_keys" },
  gemini: { icon: "🔴", description: "Gemini 2.0 Flash / Pro", docsUrl: "https://aistudio.google.com/apikey" },
  ollama: { icon: "🦙", description: "Local models (no key needed)" },
  openrouter: { icon: "🌐", description: "Multi-model aggregator", docsUrl: "https://openrouter.ai/keys" },
  custom: { icon: "⚙️", description: "Any OpenAI-compatible endpoint" },
};

function ProviderCard({
  providerKey,
  providerConfig,
  isActive,
  onSelect,
  onUpdate,
}: {
  providerKey: LlmProvider;
  providerConfig: ProviderConfig;
  isActive: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<ProviderConfig>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const meta = PROVIDER_META[providerKey];

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        isActive
          ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/0.05)]"
          : "border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.3)]"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <button
          className="flex flex-1 items-center gap-3 text-left"
          onClick={onSelect}
        >
          <span className="text-xl">{meta.icon}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{providerConfig.label}</span>
              {isActive && (
                <span className="inline-flex items-center rounded-full bg-[hsl(var(--primary))] px-2 py-0.5 text-[10px] font-medium text-white">
                  <Check className="mr-0.5 h-3 w-3" /> Active
                </span>
              )}
            </div>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {meta.description}
            </p>
          </div>
        </button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="shrink-0 text-xs"
        >
          {expanded ? "Collapse" : "Configure"}
        </Button>
      </div>

      {/* Expanded config */}
      {expanded && (
        <div className="mt-3 space-y-3 border-t border-[hsl(var(--border))] pt-3">
          {/* API Key */}
          {providerConfig.requiresKey && (
            <div>
              <label className="mb-1 flex items-center gap-1 text-xs font-medium text-[hsl(var(--muted-foreground))]">
                API Key
                {meta.docsUrl && (
                  <a
                    href={meta.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[hsl(var(--primary))] hover:underline"
                    title="Get API key"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={providerConfig.apiKey}
                  onChange={(e) => onUpdate({ apiKey: e.target.value })}
                  placeholder="sk-..."
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Base URL */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Base URL
            </label>
            <Input
              value={providerConfig.baseUrl}
              onChange={(e) => onUpdate({ baseUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              className="font-mono text-xs"
            />
          </div>

          {/* Model */}
          <div>
            <label className="mb-1 block text-xs font-medium text-[hsl(var(--muted-foreground))]">
              Model
            </label>
            <Input
              value={providerConfig.model}
              onChange={(e) => onUpdate({ model: e.target.value })}
              placeholder="model-name"
              className="font-mono text-xs"
            />
          </div>

          {/* Status indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {providerConfig.requiresKey && !providerConfig.apiKey ? (
              <span className="text-yellow-500">⚠ API key required</span>
            ) : (
              <span className="text-green-500">✓ Ready</span>
            )}
            <span className="text-[hsl(var(--muted-foreground))]">
              · Format: {providerConfig.apiFormat}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function LlmSettings() {
  const [open, setOpen] = useState(false);
  const { activeProvider, setActiveProvider, getProviderConfig, updateProvider } =
    useLlmStore();

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="LLM Provider Settings"
      >
        <Settings2 className="h-5 w-5" />
      </Button>

      <Dialog open={open} onClose={() => setOpen(false)} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>LLM Provider Settings</DialogTitle>
          <DialogDescription>
            Choose and configure the AI model provider. Settings are saved locally.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {ALL_PROVIDERS.map((key) => (
            <ProviderCard
              key={key}
              providerKey={key}
              providerConfig={getProviderConfig(key)}
              isActive={activeProvider === key}
              onSelect={() => setActiveProvider(key)}
              onUpdate={(updates) => updateProvider(key, updates)}
            />
          ))}
        </div>

        <div className="mt-4 text-center text-xs text-[hsl(var(--muted-foreground))]">
          Active: <strong>{getProviderConfig(activeProvider).label}</strong>
          {" · "}
          Model: <code className="text-[hsl(var(--primary))]">{getProviderConfig(activeProvider).model}</code>
        </div>
      </Dialog>
    </>
  );
}
