/**
 * The upstream connection's retry: a transient failure is retried on a fresh client and transport, and a refusal of
 * the credential is reported at once.
 *
 * Every attempt is a real MCP SDK v2 client over a real Streamable HTTP transport whose `fetch` is scripted, so the
 * status the retry decision reads is the one the SDK reports. The scripted bodies are chosen to discriminate: a 503
 * whose body names `401` must still retry, and a 401 whose body carries no digits must still stop — the decision is
 * the HTTP status, never the message text.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import { connectWithRetry } from '../index.js';

const API_URL = 'https://mcp.retry.test/mcp';
const API_KEY = 'bg_live_retry_test_key';

/** A handler serving a bare upstream, so an attempt the script lets through completes a real handshake. */
function upstream(): ReturnType<typeof createMcpHandler> {
  return createMcpHandler(() => new McpServer({ name: 'battlegrid', version: '115.0.0' }), { legacy: 'stateless' });
}

/**
 * A client factory whose transports share one scripted `fetch`: the first `failures.length` requests answer the
 * scripted responses, every later one reaches the upstream. Counts the attempts it built.
 */
function scripted(failures: Response[]): { createClient: Parameters<typeof connectWithRetry>[0]; attempts: () => number } {
  const handler = upstream();
  const pending = [...failures];
  let attempts = 0;
  return {
    attempts: () => attempts,
    createClient: () => {
      attempts++;
      return {
        client: new Client({ name: 'battlegrid-proxy', version: '0.0.0-test' }, { versionNegotiation: { mode: 'auto' } }),
        transport: new StreamableHTTPClientTransport(new URL(API_URL), {
          fetch: async (input, init) => pending.shift() ?? handler.fetch(new Request(input, init)),
        }),
      };
    },
  };
}

describe('connectWithRetry', () => {
  beforeEach(() => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retries a transient failure on a fresh client and transport, even when its body names 401', async () => {
    const { createClient, attempts } = scripted([new Response('upstream 401 gateway', { status: 503 })]);

    const client = await connectWithRetry(createClient, API_URL, API_KEY);

    expect(attempts()).toBe(2);
    expect(client.getServerVersion()).toMatchObject({ name: 'battlegrid', version: '115.0.0' });
    await client.close();
  }, 15_000);

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
  ])('reports a %i at once, without retrying, whatever its body says', async (status, body) => {
    const { createClient, attempts } = scripted([new Response(body, { status })]);

    await expect(connectWithRetry(createClient, API_URL, API_KEY)).rejects.toThrow(
      new RegExp(`Authentication failed for key ${API_KEY.substring(0, 12)} \\(HTTP ${status}\\)`),
    );
    expect(attempts()).toBe(1);
  });
});
