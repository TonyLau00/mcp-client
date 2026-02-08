/**
 * Main application component.
 */
import { useEffect } from "react";
import { useMcpStore, useUiStore } from "@/store";
import { getMcpClient } from "@/lib/mcp-client";
import { config } from "@/config";
import {
  ConnectionSettings,
  ChatInterface,
  TransactionConfirmDialog,
  LlmSettings,
} from "@/components";
import { Moon, Sun, Github } from "lucide-react";
import { Button } from "@/components/ui";

function App() {
  const { setServerUrl, setConnected, setConnecting, setTools, setError } =
    useMcpStore();
  const { theme, setTheme } = useUiStore();

  // Auto-connect on mount
  useEffect(() => {
    const autoConnect = async () => {
      setServerUrl(config.mcpServerUrl);
      setConnecting(true);

      try {
        const client = getMcpClient(config.mcpServerUrl);
        await client.connect();
        setConnected(true);
        setTools(client.tools);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to connect";
        setError(message);
        console.error("[App] Auto-connect failed:", message);
      } finally {
        setConnecting(false);
      }
    };

    autoConnect();
  }, [setServerUrl, setConnected, setConnecting, setTools, setError]);

  return (
    <div className="flex h-screen flex-col bg-[hsl(var(--background))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))] px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))]">
              <span className="text-lg font-bold text-white">T</span>
            </div>
            <div>
              <h1 className="font-semibold">TRON MCP Agent</h1>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                ReAct-powered blockchain agent
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LlmSettings />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              title="GitHub"
            >
              <Button variant="ghost" size="icon">
                <Github className="h-5 w-5" />
              </Button>
            </a>

            <ConnectionSettings />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden p-4">
        <div className="mx-auto h-full max-w-6xl">
          <ChatInterface />
        </div>
      </main>

      {/* Transaction confirmation dialog */}
      <TransactionConfirmDialog />
    </div>
  );
}

export default App;
