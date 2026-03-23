#!/usr/bin/env node

/**
 * @battlegrid/mcp-server — stdio proxy to BattleGrid's remote MCP server
 *
 * Reads BATTLEGRID_API_KEYS (comma-separated) or BATTLEGRID_API_KEY from
 * environment, discovers account identities via GET /mcp/identity, connects
 * to the remote BattleGrid MCP server via Streamable HTTP, and re-exposes
 * all tools, prompts, and resources over stdio transport for local MCP clients.
 *
 * Multi-account support: when multiple keys are configured, an `account`
 * enum parameter is injected into every tool so the AI agent can choose
 * which account to act as. Tool calls are routed with the matching Bearer token.
 *
 * Architecture: Matches Stripe's @stripe/mcp pattern — thin authenticated proxy.
 *
 * Usage:
 *   BATTLEGRID_API_KEY=bg_live_... npx @battlegrid/mcp-server
 *   BATTLEGRID_API_KEYS=bg_live_aaa,bg_live_bbb npx @battlegrid/mcp-server
 *
 * Environment Variables:
 *   BATTLEGRID_API_KEYS (optional) — Comma-separated list of API keys
 *   BATTLEGRID_API_KEY  (optional) — Single API key (fallback if BATTLEGRID_API_KEYS not set)
 *   BATTLEGRID_API_URL  (optional) — Override server URL (default: https://mcp.battlegrid.trade)
 */

import { createHash } from 'crypto';
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

export const VERSION = '1.1.4';
export const DEFAULT_URL = 'https://mcp.battlegrid.trade';
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [2000, 4000, 8000];

// --- Types ---

export interface EnvConfig {
  apiKeys: string[];
  apiUrl: string;
}

export interface AccountIdentity {
  apiKey: string;
  userId: string;
  username: string;
  keyLabel: string | null;
}

// --- Environment validation (exported for testing) ---

export function validateEnv(env: Record<string, string | undefined>): EnvConfig {
  const apiUrl = env.BATTLEGRID_API_URL || DEFAULT_URL;

  // BATTLEGRID_API_KEYS (comma-separated) takes precedence
  const keysRaw = env.BATTLEGRID_API_KEYS;
  let apiKeys: string[];

  if (keysRaw) {
    apiKeys = keysRaw.split(',').map(k => k.trim()).filter(Boolean);
  } else {
    const singleKey = env.BATTLEGRID_API_KEY;
    apiKeys = singleKey ? [singleKey] : [];
  }

  if (apiKeys.length === 0) {
    throw new Error(
      'BATTLEGRID_API_KEY or BATTLEGRID_API_KEYS environment variable is required.\n' +
      'Get your API key at: https://battlegrid.trade → Profile → MCP tab'
    );
  }

  for (const key of apiKeys) {
    if (!key.startsWith('bg_live_')) {
      throw new Error(
        `API key must start with "bg_live_" (got "${key.slice(0, 12)}...")\n` +
        'Create a new key at: https://battlegrid.trade → Profile → MCP tab'
      );
    }
  }

  return { apiKeys, apiUrl };
}

// --- Identity discovery (exported for testing) ---

export async function discoverIdentities(
  apiKeys: string[],
  apiUrl: string,
): Promise<AccountIdentity[]> {
  // Strip trailing slash for clean URL construction
  const baseUrl = apiUrl.replace(/\/+$/, '');

  const results = await Promise.allSettled(
    apiKeys.map(async (apiKey) => {
      const response = await fetch(`${baseUrl}/identity`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text}`);
      }
      const data = await response.json() as { userId: string; username: string | null; keyLabel: string | null };
      return {
        apiKey,
        userId: data.userId,
        username: data.username ?? data.userId.slice(0, 8),
        keyLabel: data.keyLabel,
      } satisfies AccountIdentity;
    }),
  );

  const identities: AccountIdentity[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      identities.push(result.value);
    } else {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      const keyPrefix = apiKeys[i].substring(0, 12);
      process.stderr.write(
        `Warning: identity discovery failed for key #${i + 1} (${keyPrefix}): ${reason}\n`
      );
    }
  }

  if (identities.length === 0) {
    throw new Error(
      'No valid API keys — all identity lookups failed.\n' +
      'Check your keys at: https://battlegrid.trade → Profile → MCP tab'
    );
  }

  return identities;
}

// --- Connection with retry ---

function isAuthError(error: unknown): boolean {
  // Check error.code for StreamableHTTPError (MCP SDK stores HTTP status as .code)
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: unknown }).code;
    if (code === 401 || code === 403) return true;
  }
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
      // Log full error detail for diagnostics
      const errorCode = error && typeof error === 'object' && 'code' in error
        ? (error as { code: unknown }).code
        : undefined;
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (isAuthError(error)) {
        throw new Error(
          `Authentication failed (HTTP ${errorCode ?? 'unknown'}): ${errorMessage}\n` +
          'This means the server rejected your API key. Possible causes:\n' +
          '  1. Key was revoked (a new key invalidates all previous keys)\n' +
          '  2. Key was corrupted during copy-paste\n' +
          '  3. Environment variable contains extra whitespace or newline\n' +
          'Create a new key at: https://battlegrid.trade → Profile → MCP tab'
        );
      }

      if (attempt === MAX_RETRIES) {
        throw new Error(
          `Cannot connect to BattleGrid server at ${apiUrl} after ${MAX_RETRIES + 1} attempts.\n` +
          `Last error: ${errorMessage}\n` +
          `Check your internet connection or verify the server is running.\n` +
          `Health check: ${apiUrl.replace('/mcp', '')}/health`
        );
      }

      const delay = RETRY_DELAYS_MS[attempt] ?? 8000;
      process.stderr.write(
        `Connection attempt ${attempt + 1} failed (${errorMessage}), retrying in ${delay / 1000}s...\n`
      );
      await sleep(delay);
    }
  }
}

// --- Multi-account tool augmentation ---

interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

function injectAccountParam(tools: ToolDefinition[], accountNames: string[]): ToolDefinition[] {
  return tools.map(tool => ({
    ...tool,
    inputSchema: {
      ...tool.inputSchema,
      properties: {
        account: {
          type: 'string',
          enum: accountNames,
          description: `Which BattleGrid account to use for this action. Available: ${accountNames.join(', ')}`,
        },
        ...tool.inputSchema.properties,
      },
      required: ['account', ...(tool.inputSchema.required ?? [])],
    },
  }));
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

  // Log key diagnostics for cross-referencing with server logs
  for (let i = 0; i < config.apiKeys.length; i++) {
    const key = config.apiKeys[i];
    const hashPrefix = createHash('sha256').update(key).digest('hex').substring(0, 16);
    process.stderr.write(
      `BattleGrid MCP: Key #${i + 1} prefix=${key.substring(0, 12)} hashPrefix=${hashPrefix} len=${key.length}\n`
    );
  }

  // Discover identities for all keys
  let identities: AccountIdentity[];
  try {
    identities = await discoverIdentities(config.apiKeys, config.apiUrl);
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  const isMultiAccount = identities.length > 1;
  const accountNames = identities.map(id => id.username);

  // Build lookup: username → apiKey
  const keyByAccount = new Map<string, string>();
  for (const id of identities) {
    keyByAccount.set(id.username, id.apiKey);
  }

  process.stderr.write(
    `BattleGrid MCP: ${identities.length} account(s) discovered — ${accountNames.join(', ')}\n`
  );

  // Connect to remote using the first key (for capability discovery)
  const primaryKey = identities[0].apiKey;
  const primaryTransport = new StreamableHTTPClientTransport(
    new URL(config.apiUrl),
    { requestInit: { headers: { Authorization: `Bearer ${primaryKey}` } } }
  );

  const primaryClient = new Client(
    { name: 'battlegrid-proxy', version: VERSION },
    { capabilities: {} }
  );

  try {
    await connectWithRetry(primaryClient, primaryTransport, config.apiUrl);
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  // Discover remote capabilities
  const [toolsResult, promptsResult, resourcesResult] = await Promise.all([
    primaryClient.listTools(),
    primaryClient.listPrompts(),
    primaryClient.listResources(),
  ]);

  process.stderr.write(
    `BattleGrid MCP: ${toolsResult.tools.length} tools, ` +
    `${promptsResult.prompts.length} prompts, ` +
    `${resourcesResult.resources.length} resources\n`
  );

  // Augment tools with account parameter if multi-account
  const exposedTools = isMultiAccount
    ? injectAccountParam(toolsResult.tools as ToolDefinition[], accountNames)
    : toolsResult.tools;

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
    tools: exposedTools,
  }));

  // Keep a pool of remote clients keyed by API key for routing
  const clientPool = new Map<string, Client>();
  clientPool.set(primaryKey, primaryClient);

  async function getClientForKey(apiKey: string): Promise<Client> {
    const existing = clientPool.get(apiKey);
    if (existing) return existing;

    const transport = new StreamableHTTPClientTransport(
      new URL(config.apiUrl),
      { requestInit: { headers: { Authorization: `Bearer ${apiKey}` } } }
    );
    const client = new Client(
      { name: 'battlegrid-proxy', version: VERSION },
      { capabilities: {} }
    );
    await connectWithRetry(client, transport, config.apiUrl);
    clientPool.set(apiKey, client);
    return client;
  }

  localServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      let targetKey = primaryKey;
      const args = { ...request.params.arguments } as Record<string, unknown>;

      if (isMultiAccount) {
        const selectedAccount = args.account as string | undefined;
        if (!selectedAccount || !keyByAccount.has(selectedAccount)) {
          return {
            content: [{
              type: 'text' as const,
              text: `Error: "account" parameter is required. Choose one of: ${accountNames.join(', ')}`,
            }],
            isError: true,
          };
        }
        targetKey = keyByAccount.get(selectedAccount)!;
        delete args.account; // Strip before forwarding to remote
      }

      const client = await getClientForKey(targetKey);
      return await client.callTool({
        name: request.params.name,
        arguments: args,
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
    return await primaryClient.getPrompt({
      name: request.params.name,
      arguments: request.params.arguments,
    });
  });

  // --- Proxy: resources ---

  localServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resourcesResult.resources,
  }));

  localServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    return await primaryClient.readResource({
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
