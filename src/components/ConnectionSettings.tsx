/**
 * MCP Connection Settings component.
 */
import { useState, useCallback } from "react";
import { Settings, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";
import { useMcpStore } from "@/store";
import { getMcpClient } from "@/lib/mcp-client";

export function ConnectionSettings() {
  const {
    serverUrl,
    connected,
    connecting,
    tools,
    error,
    setServerUrl,
    setConnected,
    setConnecting,
    setTools,
    setError,
  } = useMcpStore();

  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [showSettings, setShowSettings] = useState(false);

  const handleConnect = useCallback(async () => {
    setConnecting(true);
    setError(null);

    try {
      const client = getMcpClient(inputUrl);
      
      // Disconnect if already connected
      if (connected) {
        client.disconnect();
      }

      await client.connect();
      setServerUrl(inputUrl);
      setConnected(true);
      setTools(client.tools);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Connection failed";
      setError(message);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [inputUrl, connected, setServerUrl, setConnected, setConnecting, setTools, setError]);

  const handleDisconnect = useCallback(() => {
    const client = getMcpClient(serverUrl);
    client.disconnect();
    setConnected(false);
    setTools([]);
  }, [serverUrl, setConnected, setTools]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowSettings(!showSettings)}
          title="Connection Settings"
        >
          <Settings className="h-5 w-5" />
        </Button>
        
        <Badge variant={connected ? "success" : "secondary"}>
          {connected ? (
            <>
              <Wifi className="mr-1 h-3 w-3" />
              Connected
            </>
          ) : (
            <>
              <WifiOff className="mr-1 h-3 w-3" />
              Disconnected
            </>
          )}
        </Badge>
      </div>

      {showSettings && (
        <Card className="absolute right-0 top-12 z-50 w-80">
          <CardHeader>
            <CardTitle className="text-base">MCP Server Connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Server URL</label>
              <Input
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="http://localhost:3100"
                disabled={connecting}
              />
            </div>

            {error && (
              <p className="text-sm text-[hsl(var(--destructive))]">{error}</p>
            )}

            <div className="flex gap-2">
              {connected ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleDisconnect}
                    className="flex-1"
                  >
                    Disconnect
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleConnect}
                    disabled={connecting}
                  >
                    <RefreshCw className={`h-4 w-4 ${connecting ? "animate-spin" : ""}`} />
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="flex-1"
                >
                  {connecting ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>

            {connected && tools.length > 0 && (
              <div className="space-y-2 border-t pt-4">
                <p className="text-sm font-medium">Available Tools ({tools.length})</p>
                <div className="flex flex-wrap gap-1">
                  {tools.map((tool) => (
                    <Badge key={tool.name} variant="outline" className="text-xs">
                      {tool.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
