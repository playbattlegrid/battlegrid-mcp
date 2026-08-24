# CLAUDE.md

Maintainer instructions for `@battlegrid/mcp-server` — a **thin stdio proxy** to BattleGrid's remote
MCP server.

Not to be confused with `AGENTS.md`, which is the machine-readable discovery file telling *external*
agents how to connect. This file is for whoever is changing the code in this repo.

## What this package is, and is not

`src/index.ts` is the whole proxy. It **embeds no schemas**, hardcodes no tool catalog, and pins no
contract version — it authenticates, connects upstream, and forwards `{ request }` verbatim. Almost
every "the server changed" question therefore needs **nothing here**.

Before adding anything to this package, check whether it belongs in `battlegrid-app` instead. Tool
schemas, contract semantics, and error vocabularies all live there.

## Releasing — read this before touching a version

### A version change on `main` IS the release

`.github/workflows/publish.yml` runs on **every push to `main`** (plus `workflow_dispatch`), reads
`package.json`, and asks the registry whether that version exists. Three outcomes:

| Gate decision | When |
|---|---|
| `release=true` | the version is not on the registry → publish, then tag |
| `reconcile_tag=true` | already published, tag missing → create the tag only |
| neither | already published and tagged → nothing to do |

No tag authorizes a release; the tag is an **output** of a successful publish. There is nothing to
run by hand — merging is the trigger.

The workflow is deliberately **not** path-filtered on `package.json`: GitHub skips a path-filtered
workflow when a push diff exceeds 3,000 files and the matching file is not in the first 3,000
returned, so a version bump inside a large merge would silently fail to release. Releases are also
serialized (`concurrency: publish-mcp-server`, `cancel-in-progress: false`) because `npm publish`
moves `dist-tags.latest` unconditionally — a slower older run finishing last would drag `latest`
backward.

### Move all four values together — the check fails closed

`package.json` is not the only place the version lives. The workflow compares **four** values and
aborts the release if any disagree:

| Where | What to change |
|---|---|
| `package.json` | `"version"` |
| `package-lock.json` | root `"version"` |
| `package-lock.json` | `packages[""].version` (the self-referencing entry) |
| `src/index.ts` | `export const PACKAGE_VERSION = '…'` |

Run the workflow's own check locally before committing:

```bash
PKG=$(node -p "require('./package.json').version")
LOCK=$(node -p "require('./package-lock.json').version")
SELF=$(node -p "require('./package-lock.json').packages[''].version")
SRC=$(node -p "require('fs').readFileSync('src/index.ts','utf8').match(/PACKAGE_VERSION = '([^']+)'/)[1]")
[ "$PKG" = "$LOCK" ] && [ "$PKG" = "$SELF" ] && [ "$PKG" = "$SRC" ] \
  && echo "Version integrity OK: $PKG" || echo "MISMATCH — the release would fail closed"
```

The lockfile's self-referencing entry is the one that gets forgotten, which is why the check exists
rather than trusting `npm version`.

### What the number means — and what it must not track

**Version this package's own code, and nothing else.** Since v31 the number is the proxy's build
identity: a fix here, a dependency bump, a documentation correction. Ordinary semver against the
proxy's own surface — MAJOR for a break in how the proxy behaves or what its number means, MINOR for
proxy features, **PATCH for fixes and docs**.

**Do not bump because the server's contract moved.** That used to be the entire job and is now a
category error. A contract move needs *nothing* from this package: connected proxies read the
contract out of the upstream handshake and announce it verbatim on their next connection. The
publish-time deploy gate and the MAJOR.MINOR pairing rule were retired with v31 — there is no
ordering between a release here and a deploy there, in either direction.

So `npm view` and the announced contract legitimately differ, and code keyed to them being equal is
wrong.

### A docs-only change still needs a version bump to reach npm

`package.json`'s `files` is `["dist", "README.md", "LICENSE"]` — **README.md ships inside the
tarball**, so npmjs.com renders the README of the last *published* version.

That makes a README-only merge a silent no-op as far as the registry is concerned: the change lands
on `main`, the gate sees the current version already published, nothing publishes, and the npm page
keeps showing the old text. If the point of the change is that people read it on npm, it needs a
**PATCH bump** — which is exactly what "PATCH for fixes and docs" is for.

This is the one case where documenting a contract move *does* touch this package's version, and the
distinction matters: the bump is for publishing **the documentation**, never for the contract.

### Release checklist

1. Change the code or docs.
2. Move all four version values together; run the integrity snippet above.
3. `npm run build && npm test` (47 tests as of v31.0.3).
4. Open a PR; merge it.
5. The workflow publishes with OIDC provenance and tags `mcp-server@<version>` after success.

If a run fails for a reason outside the diff — an unreachable endpoint, a registry error — re-run it
with `workflow_dispatch`. Never hand-publish: `npm` versions cannot be republished, and a
hand-publish with no tag is the exact silence this workflow was built to remove.

## Layout

```
src/index.ts           the entire proxy
src/__tests__/         announced-version, identity, strategy-authoring-proxy, validate-env
AGENTS.md              discovery file for external agents — how to CONNECT
README.md              user docs + contract history; SHIPS in the tarball
SKILL.md               the published agent skill
site/                  the GitHub Pages site (CNAME + index.html)
.github/workflows/     ci.yml, publish.yml, static.yml
```

```bash
npm run build     # tsc
npm test          # vitest run
npm run dev       # tsc --watch
```

## Contract history lives in the README

When the server's contract breaks, the entry goes in README.md's contract-history section, grouped
by **what a client observes** — rejected input, reshaped output, widened enum — not by internal
cause. Entries are keyed to the CONTRACT version, not to a release of this package.
