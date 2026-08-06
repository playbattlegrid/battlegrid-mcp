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
 * DISCOVERY IS THE SOURCE. The comparison is against what the deployed endpoint actually serves —
 * never against a repository constant or a generated manifest, both of which state what will be
 * served *after* a deploy rather than what is served now.
 *
 * NO CREDENTIAL, BY DESIGN. It reads `GET /mcp/version`, which the server exposes unauthenticated
 * precisely so this check does not need a key. Every BattleGrid MCP API key carries `mcp:wager` —
 * there is no read-only variant — so a credentialed check would mean this workflow held authority to
 * submit wagers and close live positions in order to read a version number. That is not a trade
 * worth making, and the same reasoning is why the server-side smoke canary can run this check too.
 *
 * MAJOR AND MINOR. The contract uses MAJOR.MINOR and has never carried a non-zero patch — its minor
 * is how ADDITIVE contract moves ship (5.1.0, 5.2.0 and 6.1.0 were all additive). The proxy
 * announces the FULL version it publishes, so a package minor ahead of the server would advertise
 * additive contract features the deployed endpoint does not serve. Only the PATCH is the package's
 * own space, which is what proxy-only releases have always used — npm carries five (1.0.1, 1.0.2,
 * 1.1.2, 1.1.4, 3.0.1).
 *
 * FAILS CLOSED on every uncertainty: a mismatch, an unreachable endpoint, a non-success status, or a
 * body without a readable version. Publishing on an unverified assumption is the failure this exists
 * to prevent.
 *
 * Usage:
 *   node scripts/assert-deployed-contract.mjs [--url <version-endpoint>]
 *
 * Exit 0 = the deployed contract line (MAJOR.MINOR) matches this package's. 1 = it does not, or the
 * check could not be completed. Not published — `files` ships only dist/, README.md, and LICENSE.
 */

import { readFileSync } from 'node:fs';

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
 * The endpoint is derived from src/index.ts rather than restated here, so the assertion and the
 * proxy can never target different hosts. Same idiom the publish workflow uses to read VERSION.
 */
function versionUrlFromSource() {
  const source = readFileSync('src/index.ts', 'utf8');
  const proxyUrl = /DEFAULT_URL = '([^']+)'/.exec(source)?.[1];
  if (proxyUrl === undefined) {
    fail('Could not read DEFAULT_URL from src/index.ts — the proxy default moved or was renamed.');
  }
  return `${proxyUrl}/version`;
}

const urlFlagIndex = process.argv.indexOf('--url');
const url = urlFlagIndex === -1 ? versionUrlFromSource() : process.argv[urlFlagIndex + 1];
if (!url || url.startsWith('--')) {
  fail('--url was passed without a value.');
}

const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;

let response;
try {
  response = await fetch(url, { headers: { Accept: 'application/json' } });
} catch (error) {
  fail(`Could not reach ${url}: ${error instanceof Error ? error.message : String(error)}`);
}

if (!response.ok) {
  fail(`${url} answered ${response.status} ${response.statusText}. Expected 200.`);
}

let body;
try {
  body = await response.json();
} catch (error) {
  fail(`${url} did not return readable JSON: ${error instanceof Error ? error.message : String(error)}`);
}

if (typeof body?.contractVersion !== 'string') {
  fail(`${url} returned no contractVersion. Body: ${JSON.stringify(body)}`);
}

const servedLine = contractLineOf(body.contractVersion, 'deployed');
const packageLine = contractLineOf(packageVersion, 'package');

if (servedLine !== packageLine) {
  fail(
    `Deployed contract is ${body.contractVersion} (contract line ${servedLine}) but this package is ` +
      `${packageVersion} (contract line ${packageLine}). The proxy announces the full version it ` +
      'publishes, so this would advertise a contract the server does not serve. If the server ' +
      'has not deployed this contract yet, deploy it and re-run this job — nothing has been ' +
      'published and no tag exists to move. If this was meant to be a proxy-only release, move ' +
      `the PATCH instead (${servedLine}.x), which is the package's own space.`
  );
}

console.log(
  `[assert-deployed-contract] OK — deployed ${body.name ?? 'server'}@${body.contractVersion} is on ` +
    `contract line ${servedLine}, matching package ${packageVersion}.`
);
