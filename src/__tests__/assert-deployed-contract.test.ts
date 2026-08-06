/**
 * assert-deployed-contract — the publish workflow's deploy gate.
 *
 * This script decides whether a release is allowed to proceed, and it is the ONLY thing standing
 * between a version bump and a published package announcing a contract the server does not serve.
 * A bug in it either blocks every release or waves through the exact defect it exists to catch, and
 * neither would surface until a release was already in flight.
 *
 * It is a top-level program that calls process.exit, so it is exercised as a subprocess against a
 * local server rather than imported. That is the honest test anyway: the workflow depends on the
 * exit CODE, not on any exported function.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const PACKAGE_VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version as string;

/** What the server should answer with on the next request. */
let respond: (res: Parameters<Parameters<typeof createServer>[0]>[1]) => void;
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  server = createServer((_req, res) => respond(res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('no port');
  baseUrl = `http://127.0.0.1:${address.port}/mcp/version`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function serveJson(body: unknown, status = 200): void {
  respond = (res) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
}

/** Runs the real script and resolves its exit code — never rejects. */
async function runGate(url: string): Promise<{ code: number; stderr: string }> {
  try {
    await execFileAsync('node', ['scripts/assert-deployed-contract.mjs', '--url', url]);
    return { code: 0, stderr: '' };
  } catch (err) {
    const e = err as { code?: number; stderr?: string };
    return { code: e.code ?? -1, stderr: e.stderr ?? '' };
  }
}

describe('assert-deployed-contract — the publish gate', () => {
  it('allows a release when the deployed contract line matches', async () => {
    serveJson({ name: 'battlegrid', contractVersion: PACKAGE_VERSION });

    const { code } = await runGate(baseUrl);

    expect(code).toBe(0);
  });

  it('allows a proxy-only PATCH release within the same contract line', async () => {
    // The contract has never carried a non-zero patch, so PATCH is the package's own space.
    // npm already carries five proxy-only releases; comparing full versions would reject them all.
    const [major, minor] = PACKAGE_VERSION.split('.');
    serveJson({ name: 'battlegrid', contractVersion: `${major}.${minor}.0` });

    const { code } = await runGate(baseUrl);

    expect(code).toBe(0);
  });

  it('refuses a release when the deployed MAJOR differs', async () => {
    const olderMajor = Number(PACKAGE_VERSION.split('.')[0]) - 1;
    serveJson({ name: 'battlegrid', contractVersion: `${olderMajor}.0.0` });

    const { code, stderr } = await runGate(baseUrl);

    expect(code).toBe(1);
    expect(stderr).toContain('::error::');
  });

  it('refuses a release when only the deployed MINOR differs', async () => {
    // The case major-only equality would have wrongly allowed: the contract ships ADDITIVE moves as
    // minors, so publishing ahead on the minor advertises features the server does not serve.
    const [major, minor] = PACKAGE_VERSION.split('.');
    serveJson({ name: 'battlegrid', contractVersion: `${major}.${Number(minor) + 1}.0` });

    const { code } = await runGate(baseUrl);

    expect(code).toBe(1);
  });

  it('fails closed on a non-success status', async () => {
    serveJson({ error: 'nope' }, 503);

    const { code } = await runGate(baseUrl);

    expect(code).toBe(1);
  });

  it('fails closed when the body is not JSON', async () => {
    respond = (res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html>gateway</html>');
    };

    const { code } = await runGate(baseUrl);

    expect(code).toBe(1);
  });

  it('fails closed when the body carries no contractVersion', async () => {
    serveJson({ name: 'battlegrid' });

    const { code } = await runGate(baseUrl);

    expect(code).toBe(1);
  });

  it('fails closed when the endpoint is unreachable', async () => {
    const { code } = await runGate('http://127.0.0.1:9/mcp/version');

    expect(code).toBe(1);
  });
});
