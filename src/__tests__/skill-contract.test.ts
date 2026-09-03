import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The published skill states the live authoring contract.
 *
 * WHY THIS EXISTS: `skill-package.test.ts` checks PACKAGING — frontmatter, directory naming, the
 * tarball file list — and has never verified a contract statement. Meanwhile three required
 * condition keys (`clock`, `closes` with contract 44, `exit` with 44) and the whole seven-key
 * `entry` axis (44 and 47) reached the boundary while these documents said nothing about them. An
 * author composing faithfully from the published recipes could not produce a CREATE the server
 * accepts, and nothing here could see it.
 *
 * WHERE THE EXPECTED VALUES COME FROM: `src/__fixtures__/authoring-contract-digest.json`, generated
 * by the server repository beside its published manifest and vendored here. Read as DATA — this
 * package embeds no schema by design, and a hand-written mirror of the boundary shape would drift
 * from the boundary exactly as these documents did. The server's own gate reads the same digest, so
 * the rule has ONE implementation rather than two free to disagree.
 *
 * WHAT THIS DELIBERATELY DOES NOT DO — freshness. Do not add a check that the vendored digest's
 * `contractVersion` matches the latest contract the README documents. Both files live HERE and only
 * ever move together, and a contract move upstream needs nothing from this package — no pull
 * request, no release, therefore no CI run here. Such a check passes green in exactly the case it
 * would be written for: both artifacts frozen while the server advances. That is the same shape as
 * this package sitting at 11.0.0 against a deployed contract of 19.3.0 while nothing failed. The
 * freshness obligation lives in the server repository, which observes every contract move by
 * construction (`LAST_VENDORED_DIGEST_CONTRACT_VERSION`, asserted in `mcp-catalog.protocol.test.ts`).
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

interface ContractDigest {
  readonly axes: Readonly<Record<string, readonly string[]>>;
  readonly domains: Readonly<Record<string, readonly string[]>>;
  readonly bounds: { readonly conditionMaxCloses: number; readonly entryMaxCloses: number };
  readonly metricKeys: readonly string[];
}

const digest: ContractDigest = JSON.parse(
  readFileSync(join(repoRoot, 'src', '__fixtures__', 'authoring-contract-digest.json'), 'utf8'),
) as ContractDigest;

const STUDIO = join(repoRoot, 'skills', 'battlegrid-strategy-studio');
const skill = readFileSync(join(STUDIO, 'SKILL.md'), 'utf8');
const recipes = readFileSync(join(STUDIO, 'references', 'recipes.md'), 'utf8');
const ports = readFileSync(join(STUDIO, 'references', 'tradingview-ports.md'), 'utf8');

/** The section where a vocabulary-absence claim may live, in the one document that makes them. */
const ABSENCE_HEADING = '## Not expressible — the catalog keys this needs';

const ABSENCE_PHRASES = [
  'not expressible',
  'not in the catalog',
  'no direct equivalent',
  'catalog carries no',
  // Added after it slipped through: contract 49.1's `PDH`/`PDL` retraction corrected the summary
  // table, the RSI-2 section and the absence table, but section 8 still told authors "PDH/PDL as
  // exact levels are not addressable" — a metric-absence claim wearing a synonym this list did not
  // carry, written with unbackticked keys so the key check above could not see it either. Both
  // detectors were blind to the same sentence, and it shipped to npm.
  'not addressable',
] as const;

/**
 * Collapse whitespace before phrase-matching.
 *
 * NOT a nicety: the app-side twin of these documents carried "Keltner is not in / the catalog"
 * across a line break, and a per-line matcher read that file as clean while the false claim stood.
 */
function normalized(text: string): string {
  return text.replace(/\s+/g, ' ');
}

function sectionBody(markdown: string, heading: string): string {
  const start = markdown.indexOf(`\n${heading}\n`);
  if (start === -1) {
    throw new Error(`[skill-contract] no '${heading}' section to read the claim inventory from`);
  }
  const after = start + heading.length + 2;
  const next = markdown.indexOf('\n## ', after);
  return next === -1 ? markdown.slice(after) : markdown.slice(after, next);
}

/** Keys a document states as required, read from its `{ … }` identifier list. */
function braceListKeys(markdown: string, heading: string): string[] {
  const section = sectionBody(markdown, heading);
  for (const match of section.matchAll(/`?\{([^`}]*)\}`?/g)) {
    const keys = match[1]
      .split(',')
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
    if (keys.length > 0 && keys.every((key) => /^[A-Za-z][A-Za-z0-9]*$/.test(key))) return keys;
  }
  throw new Error(
    `[skill-contract] '${heading}' carries no \`{ key, key, … }\` identifier list — the contract ` +
      `statement must stay readable as a brace-list of bare keys.`,
  );
}

function missingFrom(expected: readonly string[], actual: readonly string[]): string[] {
  const present = new Set(actual);
  return expected.filter((key) => !present.has(key));
}

describe('published skill states the live authoring contract', () => {
  it.each([
    ['condition', '## Conditions — deterministic logic over your own report'],
    ['entry', '## Entry — when, and where, an entry is taken'],
  ])('names every key the %s axis requires', (axis, heading) => {
    expect(missingFrom(digest.axes[axis], braceListKeys(skill, heading))).toEqual([]);
  });

  it.each([
    ['condition', '## Conditions — deterministic logic over your own report'],
    ['entry', '## Entry — when, and where, an entry is taken'],
  ])('names no key the %s axis rejects', (axis, heading) => {
    expect(missingFrom(braceListKeys(skill, heading), digest.axes[axis])).toEqual([]);
  });

  it('states the whole entry-trigger domain', () => {
    const entry = sectionBody(skill, '## Entry — when, and where, an entry is taken');
    expect(digest.domains.entryTrigger.filter((member) => !entry.includes(member))).toEqual([]);
  });

  it('states the whole entry level-source domain', () => {
    const entry = sectionBody(skill, '## Entry — when, and where, an entry is taken');
    expect(digest.domains.entryLevelSource.filter((member) => !entry.includes(member))).toEqual([]);
  });

  it('states the whole clock domain', () => {
    const conditions = sectionBody(skill, '## Conditions — deterministic logic over your own report');
    expect(digest.domains.conditionClock.filter((member) => !conditions.includes(member))).toEqual([]);
  });

  it('states the custom-section shape the boundary requires', () => {
    expect(missingFrom(digest.axes.customSection, braceListKeys(recipes, '## Custom section shape'))).toEqual([]);
  });

  it('carries an entry recipe for every trigger the boundary accepts', () => {
    const entryRecipes = sectionBody(recipes, '## Entry discipline recipes');
    expect(digest.domains.entryTrigger.filter((trigger) => !entryRecipes.includes(trigger))).toEqual([]);
  });
});

describe('published skill states no unverifiable vocabulary absence', () => {
  const claimed = [...sectionBody(ports, ABSENCE_HEADING).matchAll(/`([A-Z][A-Z0-9_]*)`/g)]
    .map((match) => match[1]);

  it('names only metric keys the catalog genuinely lacks', () => {
    // The detector for the drift that raises no error: contract 46.1 shipped all seven rows of the
    // table this section replaced, and nothing could notice — no request is made, no error is
    // raised, and the only effect is a paying author told a strategy cannot be built.
    const served = new Set(digest.metricKeys);
    expect(claimed.filter((key) => served.has(key))).toEqual([]);
  });

  it('names at least one key, so the section is checkable at all', () => {
    expect(claimed.length).toBeGreaterThan(0);
  });

  it.each(ABSENCE_PHRASES)('carries no unnameable "%s" claim in any shipped document', (phrase) => {
    const declared = normalized(sectionBody(ports, ABSENCE_HEADING));
    for (const [name, document] of [
      ['SKILL.md', skill],
      ['recipes.md', recipes],
      ['tradingview-ports.md', ports],
    ] as const) {
      const outside = normalized(document).split(declared);
      expect(outside.filter((part) => part.includes(phrase)), `${name} carries "${phrase}"`).toEqual([]);
    }
  });
});

describe('the contract check fails on the drift it was written for', () => {
  // A gate never seen to reject anything is not evidence that it works.
  it('reports the keys the pre-contract-44 recipe omitted', () => {
    const stale = '\n## X\n\n`{ conditionKey, name, definition, verdict, required }` — five.\n';
    expect(missingFrom(digest.axes.condition, braceListKeys(stale, '## X')).sort()).toEqual([
      'clock',
      'closes',
      'exit',
    ]);
  });

  it('reports a claimed-absent key the catalog now serves', () => {
    const served = new Set(digest.metricKeys);
    const rows = [...'| Keltner | `KC_UPPER` |'.matchAll(/`([A-Z][A-Z0-9_]*)`/g)].map((m) => m[1]);
    expect(rows.filter((key) => served.has(key))).toEqual(['KC_UPPER']);
  });

  it('sees a wrapped claim a line-based scan would miss', () => {
    const wrapped = 'Keltner is not in\n  the catalog, so substitute.';
    expect(wrapped.includes('not in the catalog')).toBe(false);
    expect(normalized(wrapped).includes('not in the catalog')).toBe(true);
  });

  it('refuses to bind an axis to a JSON example', () => {
    const jsonOnly = '\n## X\n\nTune it with `{"multiplier":1.5}`.\n';
    expect(() => braceListKeys(jsonOnly, '## X')).toThrow(/identifier list/);
  });
});
