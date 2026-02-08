/**
 * MCP Client - Connects to tron-mcp-server via SSE transport.
 *
 * This module handles:
 * - SSE connection lifecycle
 * - Tool listing and invocation
 * - JSON-RPC message handling
 */

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpCallResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

type MessageHandler = (message: JsonRpcResponse) => void;

/**
 * MCP Client using SSE transport.
 */
export class McpClient {
  private serverUrl: string;
  private eventSource: EventSource | null = null;
  private sessionId: string | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
  }>();
  private messageHandlers: MessageHandler[] = [];
  private _connected = false;
  private _tools: McpTool[] = [];

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl;
  }

  get connected(): boolean {
    return this._connected;
  }

  get tools(): McpTool[] {
    return this._tools;
  }

  /**
   * Connect to the MCP server via SSE.
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const sseUrl = `${this.serverUrl}/sse`;
      console.log("[MCP] Connecting to", sseUrl);

      this.eventSource = new EventSource(sseUrl);

      this.eventSource.onopen = () => {
        console.log("[MCP] SSE connection opened");
      };

      this.eventSource.addEventListener("endpoint", (event) => {
        // The server sends the messages endpoint URL
        const data = event.data;
        console.log("[MCP] Received endpoint:", data);
        // Extract sessionId from the endpoint URL
        const url = new URL(data, this.serverUrl);
        this.sessionId = url.searchParams.get("sessionId");
        console.log("[MCP] Session ID:", this.sessionId);

        // Now initialize the connection
        this.initialize().then(resolve).catch(reject);
      });

      this.eventSource.addEventListener("message", (event) => {
        try {
          const message = JSON.parse(event.data) as JsonRpcResponse;
          this.handleMessage(message);
        } catch (err) {
          console.error("[MCP] Failed to parse message:", err);
        }
      });

      this.eventSource.onerror = (err) => {
        console.error("[MCP] SSE error:", err);
        this._connected = false;
        if (!this.sessionId) {
          reject(new Error("Failed to connect to MCP server"));
        }
      };
    });
  }

  /**
   * Disconnect from the MCP server.
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.sessionId = null;
    this._connected = false;
    this._tools = [];
    this.pendingRequests.clear();
  }

  /**
   * Initialize the MCP connection.
   */
  private async initialize(): Promise<void> {
    const result = await this.sendRequest("initialize", {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: {
        name: "mcp-client",
        version: "0.1.0",
      },
    });

    console.log("[MCP] Initialized:", result);
    this._connected = true;

    // Send initialized notification
    await this.sendNotification("notifications/initialized");

    // Fetch available tools
    await this.listTools();
  }

  /**
   * List available tools from the server.
   */
  async listTools(): Promise<McpTool[]> {
    const result = (await this.sendRequest("tools/list", {})) as {
      tools: McpTool[];
    };
    this._tools = result.tools || [];
    console.log("[MCP] Available tools:", this._tools.map((t) => t.name));
    return this._tools;
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    const result = (await this.sendRequest("tools/call", {
      name,
      arguments: args,
    })) as McpCallResult;

    return result;
  }

  /**
   * Send a JSON-RPC request to the server.
   */
  private async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.postMessage(request);
    });
  }

  /**
   * Send a JSON-RPC notification (no response expected).
   */
  private async sendNotification(method: string, params?: unknown): Promise<void> {
    const notification = {
      jsonrpc: "2.0" as const,
      method,
      params,
    };
    this.postMessage(notification);
  }

  /**
   * Post a message to the server's messages endpoint.
   */
  private async postMessage(message: unknown): Promise<void> {
    if (!this.sessionId) {
      throw new Error("Not connected to MCP server");
    }

    const url = `${this.serverUrl}/messages?sessionId=${this.sessionId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }
  }

  /**
   * Handle incoming messages from the server.
   */
  private handleMessage(message: JsonRpcResponse): void {
    // Check if this is a response to a pending request
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        return;
      }
    }

    // Otherwise, notify handlers
    for (const handler of this.messageHandlers) {
      handler(message);
    }
  }

  /**
   * Add a message handler.
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.push(handler);
    return () => {
      const idx = this.messageHandlers.indexOf(handler);
      if (idx >= 0) this.messageHandlers.splice(idx, 1);
    };
  }
}

// Singleton instance
let clientInstance: McpClient | null = null;

export function getMcpClient(serverUrl: string): McpClient {
  if (!clientInstance || clientInstance["serverUrl"] !== serverUrl) {
    clientInstance = new McpClient(serverUrl);
  }
  return clientInstance;
}
