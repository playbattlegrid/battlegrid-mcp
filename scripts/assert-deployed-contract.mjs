#!/usr/bin/env node
/**
 * assert-deployed-contract — the publish workflow's deploy gate.
 *
 * WHY THIS EXISTS: the package announces `battlegrid@<version>` in its own stdio handshake, so the
 * number it publishes is read as the contract a client will actually reach. Publishing ahead of the
 * server's deploy therefore announces a contract the server does not answer to — the same defect as
 * a package left behind, inverted and self-inflicted. Before this script that ordering rested
 * entirely on an author remembering to run a canary by hand.
 *
 * DISCOVERY IS THE SOURCE. The comparison is against `serverInfo.version` from a real `initialize`
 * against the deployed endpoint — never against a repository constant or a generated manifest, both
 * of which state what will be served *after* a deploy rather than what is served now.
 *
 * MAJOR AND MINOR. The contract uses MAJOR.MINOR and has never carried a non-zero patch — its minor
 * is how ADDITIVE contract moves ship (5.1.0, 5.2.0 and 6.1.0 were all additive). The proxy
 * announces the FULL version it publishes, so a package minor ahead of the server would advertise
 * additive contract features the deployed endpoint does not serve. Only the PATCH is the package's
 * own space, which is what proxy-only releases have always used — npm carries five (1.0.1, 1.0.2,
 * 1.1.2, 1.1.4, 3.0.1).
 *
 * FAILS CLOSED. A missing or rejected credential is a failure, not a skip: a check that passes when
 * misconfigured is not a check.
 *
 * Usage:
 *   BATTLEGRID_DEPLOY_CHECK_KEY=bg_live_… node scripts/assert-deployed-contract.mjs [--url <url>]
 *
 * Exit 0 = the deployed contract line (MAJOR.MINOR) matches this package's. 1 = it does not, or the
 * check could not be completed. Not published — `files` ships only dist/, README.md, and LICENSE.
 */

import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** GitHub Actions error annotation, falling back to a plain prefix off-runner. */
function fail(message) {
  console.error(`::error::[assert-deployed-contract] ${message}`);
  process.exit(1);
}

/** The contract line a version belongs to: MAJOR.MINOR, ignoring patch. */
function contractLineOf(version, label) {
  const parsed = /^(\d+)\.(\d+)\./.exec(version);
  if (parsed === null) {
    fail(`Cannot read a MAJOR.MINOR contract line from the ${label} version "${version}".`);
  }
  return `${parsed[1]}.${parsed[2]}`;
}

/**
 * The endpoint is read out of src/index.ts rather than restated here, so the assertion and the proxy
 * can never target different hosts. Same idiom the publish workflow uses to read VERSION.
 */
function defaultUrlFromSource() {
  const source = readFileSync('src/index.ts', 'utf8');
  const url = /DEFAULT_URL = '([^']+)'/.exec(source)?.[1];
  if (url === undefined) {
    fail('Could not read DEFAULT_URL from src/index.ts — the proxy default moved or was renamed.');
  }
  return url;
}

const urlFlagIndex = process.argv.indexOf('--url');
const url = urlFlagIndex === -1 ? defaultUrlFromSource() : process.argv[urlFlagIndex + 1];
if (!url || url.startsWith('--')) {
  fail('--url was passed without a value.');
}

const apiKey = process.env.BATTLEGRID_DEPLOY_CHECK_KEY;
if (!apiKey) {
  fail(
    'BATTLEGRID_DEPLOY_CHECK_KEY is not set. The deployed contract cannot be read without a ' +
      'credential — an unauthenticated initialize returns 401 by design. Provision the repository ' +
      'secret; this check does not skip.'
  );
}

const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;

const client = new Client({ name: 'battlegrid-deploy-check', version: packageVersion });

try {
  await client.connect(
    new StreamableHTTPClientTransport(new URL(url), {
      requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
    })
  );
} catch (error) {
  fail(`Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`);
}

const served = client.getServerVersion();
await client.close();

if (!served?.version) {
  fail(`${url} completed initialize but announced no server version.`);
}

const servedLine = contractLineOf(served.version, 'deployed');
const packageLine = contractLineOf(packageVersion, 'package');

if (servedLine !== packageLine) {
  fail(
    `Deployed contract is ${served.version} (contract line ${servedLine}) but this package is ` +
      `${packageVersion} (contract line ${packageLine}). The proxy announces the full version it ` +
      'publishes, so this would advertise a contract the server does not serve. If the server ' +
      'has not deployed this contract yet, deploy it and re-run this job — nothing has been ' +
      'published and no tag exists to move. If this was meant to be a proxy-only release, move ' +
      `the PATCH instead (${servedLine}.x), which is the package's own space.`
  );
}

console.log(
  `[assert-deployed-contract] OK — deployed ${served.name}@${served.version} is on contract line ` +
    `${servedLine}, matching package ${packageVersion}.`
);
