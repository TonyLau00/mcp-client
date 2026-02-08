#!/usr/bin/env tsx
/**
 * MCP Tools Test Script
 * 
 * Usage:
 *   npx tsx scripts/test-tools.ts [--server http://localhost:3100]
 * 
 * Tests all MCP tools with predefined arguments and reports results.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

interface ToolTestCase {
  args: Record<string, unknown>;
  description: string;
  expectedToFail?: boolean; // Known backend issues
  failureReason?: string;
}

const TOOL_TESTS: Record<string, ToolTestCase> = {
  get_account_info: {
    description: "Get account info for USDT contract",
    args: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
  },
  get_transaction_status: {
    description: "Check transaction status",
    args: {
      tx_hash: "8c458265e890ce3259423ff6bb50b182136ee6a99b848ec5935a27fae2039b71",
    },
  },
  get_network_parameters: {
    description: "Fetch TRON network parameters",
    args: {},
  },
  check_address_security: {
    description: "Security check for test address",
    args: { address: "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf" },
  },
  build_unsigned_transfer: {
    description: "Build unsigned TRX transfer",
    args: {
      from_address: "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf",
      to_address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
      amount: "1",
      token_type: "TRX",
    },
  },
  analyze_address_graph: {
    description: "Analyze transaction graph (2 hops)",
    args: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", depth: 2 },
    expectedToFail: true,
    failureReason: "Neo4j query syntax error in tron-graph backend (variable depth not supported)",
  },
  get_address_risk_score: {
    description: "Risk assessment for test address",
    args: { address: "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf" },
  },
  get_address_flow_analysis: {
    description: "Fund flow analysis",
    args: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", depth: 2 },
    expectedToFail: true,
    failureReason: "Neo4j query syntax error in tron-graph backend (variable depth not supported)",
  },
  get_contract_callers: {
    description: "Top contract callers",
    args: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", limit: 10 },
  },
  get_contract_methods: {
    description: "Contract method statistics",
    args: { address: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" },
  },
  get_address_contracts: {
    description: "Contract interactions for address",
    args: { address: "TDqSquXBgUCLYvYC4XZgrprLK589dkhSCf" },
  },
};

interface TestResult {
  tool: string;
  status: "success" | "error" | "skipped" | "known-failure";
  elapsed: number;
  error?: string;
  resultPreview?: string;
}

async function connectToServer(serverUrl: string): Promise<Client> {
  const transport = new SSEClientTransport(new URL(serverUrl));
  const client = new Client(
    { name: "mcp-test-client", version: "1.0.0" },
    { capabilities: {} }
  );

  await client.connect(transport);
  return client;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function truncate(text: string, maxLen = 100): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + "...";
}

async function runTest(
  client: Client,
  toolName: string,
  testCase: ToolTestCase
): Promise<TestResult> {
  const t0 = performance.now();
  
  try {
    const result = await client.callTool({
      name: toolName,
      arguments: testCase.args,
    });

    const elapsed = Math.round(performance.now() - t0);

    if (result.isError) {
      return {
        tool: toolName,
        status: "error",
        elapsed,
        error: result.content.map((c) => c.text).join("\n"),
      };
    }

    const preview = result.content
      .map((c) => {
        if (c.type === "text") {
          try {
            const parsed = JSON.parse(c.text);
            return JSON.stringify(parsed, null, 2);
          } catch {
            return c.text;
          }
        }
        return `[${c.type}]`;
      })
      .join("\n");

    return {
      tool: toolName,
      status: "success",
      elapsed,
      resultPreview: truncate(preview, 200),
    };
  } catch (err) {
    const elapsed = Math.round(performance.now() - t0);
    return {
      tool: toolName,
      status: "error",
      elapsed,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const serverUrl = args.includes("--server")
    ? args[args.indexOf("--server") + 1]
    : "http://localhost:3100/sse";

  console.log("╔═══════════════════════════════════════════════════════╗");
  console.log("║          MCP Tools Test Suite                         ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");
  console.log(`📡 Server: ${serverUrl}\n`);

  let client: Client;

  try {
    console.log("🔌 Connecting to MCP server...");
    client = await connectToServer(serverUrl);
    console.log("✅ Connected successfully\n");
  } catch (err) {
    console.error("❌ Failed to connect to server:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Fetch available tools
  let availableTools: string[];
  try {
    const toolsList = await client.listTools();
    availableTools = toolsList.tools.map((t) => t.name);
    console.log(`🔧 Found ${availableTools.length} tools\n`);
  } catch (err) {
    console.error("❌ Failed to fetch tools list:");
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Run tests
  const results: TestResult[] = [];
  const toolsToTest = Object.keys(TOOL_TESTS);

  console.log("🧪 Running tests...\n");
  console.log("─".repeat(60));

  for (const toolName of toolsToTest) {
    const testCase = TOOL_TESTS[toolName];

    if (!availableTools.includes(toolName)) {
      console.log(`⚠️  ${toolName.padEnd(30)} SKIPPED (not available)`);
      results.push({
        tool: toolName,
        status: "skipped",
        elapsed: 0,
      });
      continue;
    }

    process.stdout.write(`⏳ ${toolName.padEnd(30)} `);
    const result = await runTest(client, toolName, testCase);
    
    // Mark known failures differently
    if (result.status === "error" && testCase.expectedToFail) {
      result.status = "known-failure";
    }
    
    results.push(result);

    // Clear line and print result
    process.stdout.write("\r");
    if (result.status === "success") {
      console.log(
        `✅ ${toolName.padEnd(30)} ${formatDuration(result.elapsed).padStart(8)}`
      );
    } else if (result.status === "known-failure") {
      console.log(
        `⚠️  ${toolName.padEnd(30)} ${formatDuration(result.elapsed).padStart(8)} (known issue)`
      );
      if (testCase.failureReason) {
        console.log(`   └─ ${testCase.failureReason}`);
      }
    } else if (result.status === "error") {
      console.log(
        `❌ ${toolName.padEnd(30)} ${formatDuration(result.elapsed).padStart(8)}`
      );
      console.log(`   └─ Error: ${truncate(result.error || "Unknown error", 80)}`);
    }
  }

  console.log("─".repeat(60) + "\n");

  // Summary
  const successCount = results.filter((r) => r.status === "success").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const knownFailureCount = results.filter((r) => r.status === "known-failure").length;
  const skippedCount = results.filter((r) => r.status === "skipped").length;
  const totalElapsed = results.reduce((sum, r) => sum + r.elapsed, 0);

  console.log("📊 Test Summary:");
  console.log(`   ✅ Passed:  ${successCount}`);
  console.log(`   ❌ Failed:  ${errorCount}`);
  console.log(`   ⚠️  Known Issues: ${knownFailureCount}`);
  console.log(`   ⏸️  Skipped: ${skippedCount}`);
  console.log(`   ⏱️  Total:   ${formatDuration(totalElapsed)}`);
  console.log();

  // Exit with error if any test failed
  if (errorCount > 0) {
    console.log("❌ Some tests failed\n");
    process.exit(1);
  } else if (knownFailureCount > 0) {
    console.log(`⚠️  All tests passed (${knownFailureCount} known issue${knownFailureCount > 1 ? 's' : ''} ignored)\n`);
    process.exit(0);
  } else {
    console.log("✅ All tests passed\n");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("\n❌ Unexpected error:");
  console.error(err);
  process.exit(1);
});
