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
 * Strategy authoring (v3): the strategy-authoring tools publish one strict
 * server-owned outer object, `{ request: canonicalPayload }`. In multi-account
 * mode the proxy adds `account` only as a sibling of `request`, producing
 * exactly `{ account, request }`; on a call it strips only `account` and
 * forwards the unchanged `{ request }`. It never descends into or reconstructs
 * the nested request — the server owns every required field, bound, union
 * discriminator, and `additionalProperties:false` constraint.
 *
 * Versions (two of them, describing two different things):
 *   - PACKAGE_VERSION — this proxy's own code. Sent UPSTREAM as the client identity.
 *   - the announced contract — read from the upstream handshake at connect time and relayed
 *     DOWNSTREAM verbatim. Never a constant compiled into this package. See `announcedIdentityOf`.
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
 *   BATTLEGRID_API_URL  (optional) — Override server URL (default: https://mcp.battlegrid.trade/mcp)
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
  type Implementation,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * This package's own version — the proxy's code, and nothing else.
 *
 * It deliberately does NOT describe the server's wire contract. That number is read from the
 * upstream handshake on every connection and relayed downstream (`announcedIdentityOf`), so the two
 * cannot drift: there is no second place to update and no release needed when the contract moves.
 *
 * Sent upstream as the CLIENT identity, where "which proxy build is calling" is exactly the question
 * being asked. Move it for a change to THIS package — a proxy fix, a dependency bump, a docs
 * correction. Never move it to track the server.
 */
export const PACKAGE_VERSION = '31.1.3';
export const DEFAULT_URL = 'https://mcp.battlegrid.trade/mcp';
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

export interface ToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

/**
 * Add a required `account` enum to every discovered tool, as a sibling of the
 * existing top-level properties. For the strict authoring tools whose schema is
 * `{ request: canonicalPayload }`, this produces exactly `{ account, request }`
 * with `required: ["account", "request"]`; the server-owned root
 * `additionalProperties:false` and the entire nested `request` (unions,
 * required fields, bounds) are preserved by reference, never rewritten.
 */
export function injectAccountParam(tools: ToolDefinition[], accountNames: string[]): ToolDefinition[] {
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

// --- Announced identity (exported for testing) ---

/**
 * The identity the local stdio server announces downstream: the upstream server's own, relayed
 * verbatim from the handshake that just completed.
 *
 * WHY RELAY RATHER THAN DECLARE. A local client reads this handshake as a statement about the
 * contract it is about to call. Announcing a constant compiled into this package makes that
 * statement on the server's behalf and then depends on a human keeping the two in step — which is
 * how the package sat at `11.0.0` against a deployed contract of `19.3.0` for ten days, how `5.1.0`
 * came to be declared in this repository and absent from the registry, and why four of the last five
 * releases were version bumps carrying no code change at all. Reading the number off the connection
 * that will actually serve the calls makes the pairing true by construction, on every connection,
 * with no release involved.
 *
 * VERBATIM, NOT RECONSTRUCTED. `Implementation` also carries optional display metadata (`title`,
 * `websiteUrl`, `icons`, …). Passing the object through means a field the server adds later reaches
 * local clients without an edit here — the same reason the tool catalog is never enumerated.
 *
 * FAILS CLOSED. `serverInfo` is required in a successful MCP `initialize` result, so a connected
 * client holding none is a protocol violation rather than a case to design around. Falling back to
 * PACKAGE_VERSION here would reintroduce the exact fiction this function exists to remove, and would
 * do it silently, at the one moment the truth was unavailable.
 */
export function announcedIdentityOf(serverInfo: Implementation | undefined): Implementation {
  if (serverInfo === undefined) {
    throw new Error(
      'Upstream MCP server completed initialize without announcing serverInfo, so there is no ' +
      'contract version to relay to local clients. This is a protocol violation by the server — ' +
      'not a configuration problem, and not something this proxy will substitute a guess for.'
    );
  }
  return serverInfo;
}

// --- Proxy server factory (exported for protocol testing) ---

export interface CreateProxyServerOptions {
  /** Discovered account identities (index 0 is the primary key used for capability discovery). */
  identities: AccountIdentity[];
  /** Connect (or reuse) a remote MCP client for a given API key. Called once per key, lazily. */
  connect: (apiKey: string) => Promise<Client>;
}

export interface ProxyServer {
  server: Server;
  toolCount: number;
  promptCount: number;
  resourceCount: number;
  isMultiAccount: boolean;
  accountNames: string[];
  /** The upstream identity relayed downstream — the contract a local client will actually reach. */
  announced: Implementation;
}

/**
 * Build the local stdio-facing MCP server that proxies to the remote BattleGrid
 * server. Discovers remote capabilities through the primary client, augments
 * tools with the `account` enum when multiple accounts resolved, and wires
 * strip-only-account routing to a lazily-populated per-key client pool.
 */
export async function createProxyServer(options: CreateProxyServerOptions): Promise<ProxyServer> {
  const { identities, connect } = options;

  const isMultiAccount = identities.length > 1;
  const accountNames = identities.map(id => id.username);

  // Build lookup: username → apiKey
  const keyByAccount = new Map<string, string>();
  for (const id of identities) {
    keyByAccount.set(id.username, id.apiKey);
  }

  // Primary client (first key) is used for capability discovery and non-tool proxying.
  const primaryKey = identities[0].apiKey;
  const primaryClient = await connect(primaryKey);

  // What this proxy announces downstream is what the upstream just announced to it — read here,
  // from the completed handshake, so it can never be a stale constant.
  const announced = announcedIdentityOf(primaryClient.getServerVersion());

  // Discover remote capabilities
  const [toolsResult, promptsResult, resourcesResult] = await Promise.all([
    primaryClient.listTools(),
    primaryClient.listPrompts(),
    primaryClient.listResources(),
  ]);

  // Augment tools with account parameter if multi-account
  const exposedTools = isMultiAccount
    ? injectAccountParam(toolsResult.tools as ToolDefinition[], accountNames)
    : toolsResult.tools;

  // Create local stdio server, announcing the upstream's identity rather than one of our own.
  const localServer = new Server(
    announced,
    {
      capabilities: {
        tools: {},
        prompts: {},
        resources: {},
      },
    }
  );

  // Keep a pool of remote clients keyed by API key for routing
  const clientPool = new Map<string, Client>();
  clientPool.set(primaryKey, primaryClient);

  async function getClientForKey(apiKey: string): Promise<Client> {
    const existing = clientPool.get(apiKey);
    if (existing) return existing;

    const client = await connect(apiKey);
    clientPool.set(apiKey, client);
    return client;
  }

  // --- Proxy: tools ---

  localServer.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: exposedTools,
  }));

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
        delete args.account; // Strip ONLY account before forwarding; request is forwarded unchanged
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

  return {
    server: localServer,
    toolCount: toolsResult.tools.length,
    promptCount: promptsResult.prompts.length,
    resourceCount: resourcesResult.resources.length,
    isMultiAccount,
    accountNames,
    announced,
  };
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

  process.stderr.write(
    `BattleGrid MCP: ${identities.length} account(s) discovered — ${identities.map(id => id.username).join(', ')}\n`
  );

  // Lazily connect a remote MCP client per API key, with retry + auth diagnostics.
  const connect = async (apiKey: string): Promise<Client> => {
    const transport = new StreamableHTTPClientTransport(
      new URL(config.apiUrl),
      { requestInit: { headers: { Authorization: `Bearer ${apiKey}` } } }
    );
    // Upstream is told which proxy build is calling — the one question PACKAGE_VERSION answers.
    const client = new Client(
      { name: 'battlegrid-proxy', version: PACKAGE_VERSION },
      { capabilities: {} }
    );
    await connectWithRetry(client, transport, config.apiUrl);
    return client;
  };

  let proxy: ProxyServer;
  try {
    proxy = await createProxyServer({ identities, connect });
  } catch (error) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }

  // Both numbers, labelled. They describe different things and are EXPECTED to differ — printing
  // only one leaves an operator to guess which, and printing neither is how the last drift went
  // unnoticed for ten days.
  process.stderr.write(
    `BattleGrid MCP: announcing ${proxy.announced.name}@${proxy.announced.version} ` +
    `(server contract, read from the upstream handshake) — proxy ${PACKAGE_VERSION}\n`
  );
  process.stderr.write(
    `BattleGrid MCP: ${proxy.toolCount} tools, ${proxy.promptCount} prompts, ${proxy.resourceCount} resources\n`
  );

  // --- Start stdio transport ---

  const stdioTransport = new StdioServerTransport();
  await proxy.server.connect(stdioTransport);

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
