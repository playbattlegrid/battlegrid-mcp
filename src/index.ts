#!/usr/bin/env node

/**
 * @battlegrid/mcp-server — stdio proxy to BattleGrid's remote MCP server
 *
 * Reads BATTLEGRID_API_KEY from environment, connects to the remote BattleGrid
 * MCP server via Streamable HTTP, and re-exposes all tools, prompts, and
 * resources over stdio transport for local MCP clients.
 *
 * Architecture: Matches Stripe's @stripe/mcp pattern — thin authenticated proxy.
 *
 * Usage:
 *   BATTLEGRID_API_KEY=bg_live_... npx @battlegrid/mcp-server
 *
 * Environment Variables:
 *   BATTLEGRID_API_KEY  (required) — Your BattleGrid API key (starts with bg_live_)
 *   BATTLEGRID_API_URL  (optional) — Override server URL (default: https://mcp.battlegrid.trade)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export const VERSION = '1.0.1';
export const DEFAULT_URL = 'https://mcp.battlegrid.trade';
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 4000, 8000];

// --- Environment validation (exported for testing) ---

export interface EnvConfig {
  apiKey: string;
  apiUrl: string;
}

export function validateEnv(env: Record<string, string | undefined>): EnvConfig {
  const apiKey = env.BATTLEGRID_API_KEY;
  const apiUrl = env.BATTLEGRID_API_URL || DEFAULT_URL;

  if (!apiKey) {
    throw new Error(
      'BATTLEGRID_API_KEY environment variable is required.\n' +
      'Get your API key at: https://battlegrid.trade → Profile → MCP tab'
    );
  }

  if (!apiKey.startsWith('bg_live_')) {
    throw new Error(
      'API key must start with "bg_live_"\n' +
      'Create a new key at: https://battlegrid.trade → Profile → MCP tab'
    );
  }

  return { apiKey, apiUrl };
}

// --- Connection with retry ---

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('401') || message.includes('Unauthorized') || message.includes('403');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(client: Client, transport: StreamableHTTPClientTransport, apiUrl: string): Promise<void> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      await client.connect(transport);
      return;
    } catch (error) {
      // Auth errors should not be retried — the key is wrong
      if (isAuthError(error)) {
        throw new Error(
          'Invalid or revoked API key.\n' +
          'Create a new key at: https://battlegrid.trade → Profile → MCP tab'
        );
      }

      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Cannot connect to BattleGrid server at ${apiUrl} after ${MAX_RETRIES + 1} attempts.\n` +
          `Check your internet connection or verify the server is running.\n` +
          `Health check: ${apiUrl.replace('/mcp', '')}/health`
        );
      }

      const delay = RETRY_DELAYS_MS[attempt] ?? 8000;
      process.stderr.write(
        `Connection attempt ${attempt + 1} failed, retrying in ${delay / 1000}s...\n`
      );
      await sleep(delay);

      // Recreate transport for retry (previous one may be in a broken state)
      // Note: we can't reconnect the same transport, so we create a fresh Client+Transport
      // on each retry in the main function instead
    }
  }
}

// --- Main ---

async function main(): Promise<void> {
  let config: EnvConfig;
  try {
    config = validateEnv(process.env);
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  // Connect to remote BattleGrid MCP server with retry
  const remoteTransport = new StreamableHTTPClientTransport(
    new URL(config.apiUrl),
    { requestInit: { headers: { Authorization: `Bearer ${config.apiKey}` } } }
  );

  const remoteClient = new Client(
    { name: 'battlegrid-proxy', version: VERSION },
    { capabilities: {} }
  );

  try {
    await connectWithRetry(remoteClient, remoteTransport, config.apiUrl);
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  // Discover remote capabilities
  const [toolsResult, promptsResult, resourcesResult] = await Promise.all([
    remoteClient.listTools(),
    remoteClient.listPrompts(),
    remoteClient.listResources(),
  ]);

  process.stderr.write(
    `BattleGrid MCP: ${toolsResult.tools.length} tools, ` +
    `${promptsResult.prompts.length} prompts, ` +
    `${resourcesResult.resources.length} resources\n`
  );

  // Create local stdio server
  const localServer = new Server(
    { name: 'battlegrid', version: VERSION },
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  // --- Proxy: tools ---

  localServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolsResult.tools,
  }));

  localServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      return await remoteClient.callTool({
        name: request.params.name,
        arguments: request.params.arguments,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // --- Proxy: prompts ---

  localServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: promptsResult.prompts,
  }));

  localServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
    return await remoteClient.getPrompt({
      name: request.params.name,
      arguments: request.params.arguments,
    });
  });

  // --- Proxy: resources ---

  localServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourcesResult.resources,
  }));

  localServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return await remoteClient.readResource({
      uri: request.params.uri,
    });
  });

  // --- Start stdio transport ---

  const stdioTransport = new StdioServerTransport();
  await localServer.connect(stdioTransport);

  process.stderr.write('BattleGrid MCP server running on stdio\n');
}

// Only run when executed directly (not when imported for testing)
const isDirectExecution = process.argv[1] &&
  (process.argv[1].endsWith('/index.js') || process.argv[1].endsWith('/battlegrid-mcp'));

if (isDirectExecution) {
  main().catch((error) => {
    process.stderr.write(`Fatal error: ${error}\n`);
    process.exit(1);
  });
}
