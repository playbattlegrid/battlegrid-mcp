---
name: battlegrid-strategy-studio
description: Author full-power BattleGrid trading strategies over MCP — multi-section reports, benchmark sections, layered conditions with verdicts and enforcement gates, tiered signal weights, routing gates, ATR trade levels, and post-entry position management. Use whenever building or upgrading a strategy so it uses the whole studio, not a bare template. Companion to the `battlegrid` skill, which owns connection and the compile → review → apply workflow.
---

# BattleGrid Strategy Studio — full-power authoring

A default strategy — a few platform sections, no conditions, untouched weights — wastes the
studio. This skill teaches every axis the strategy aggregate owns and how professional desks
compose them. Workflow, envelopes, and error recovery live in the `battlegrid` skill; this one
is about *what to author*.

**Ground rule: shapes here are binding, tokens are illustrative.** Every metric code, signal id,
header, and bound in this skill was validated against the live server, but the server's
vocabulary moves with deployments. Before compiling, re-discover (`list_strategy_categories` →
`list_strategy_vocabulary` → `get_metric_construction_hints` → `get_strategy_column_contract`,
`list_strategy_signals` → `get_strategy_signal_definition`) and prefer what discovery returns
over anything printed here.

## What a strategy owns (author all of it, deliberately)

| Axis | Fields | What it does |
|---|---|---|
| Identity | `name` ≤50, `tagline` ≤80, `description` ≤500 | How agents and humans find it |
| Timeframe | `timeframe` (from discovery's enabled list) | Anchor rung; cadence persona and regime rung derive from it |
| Report | `sections[]` — platform + custom columns | The per-coin table the agent LLM actually reads |
| Conditions | `conditions[]` — typed boolean trees | Deterministic verdicts (UP/DOWN/NEITHER) + hard enforcement gates |
| Signal rules | `rules[]` — `{signalId, allocation 0–3, required, params?}` | What scores, how much it counts, what must fire |
| Routing gates | `minAggregateScore` 0–1, `minRequiredCount` 0–20, `minAtrPct` | Whether a scored setup may route to a trade |
| Trade levels | `minStopLossAtrMultiple` < `maxStopLossAtrMultiple`, `minRiskRewardRatio` | Where stops/targets may sit |
| Position management | breakEven / trailing / timeDecay dials | How the stop moves after entry |
| Market Read | `marketReadText` ≤2000 with `{...}` markers | Standing orders rendered with live values |

A compile also always carries `intentSummary`, `assumptions[]`, and `coinSelection` — call
context, not strategy state (see the `battlegrid` skill).

## The full-power checklist

Before compiling a CREATE, confirm all six; a "no" is a decision, not an omission:

1. Report has at least one **custom section** whose columns encode the thesis (not only platform
   modules), and every column earns its tokens.
2. **Conditions** encode the entry logic deterministically — building blocks + verdict carriers —
   and at least one `required: true` condition guards spend on obvious disqualifiers.
3. **Every signal you want scoring is named in `rules`** with a deliberate tier; signals you do
   not name keep server defaults (typically Off). Verify in the compiled scorecard, never assume.
4. **Gates** are set against the weight budget you chose (see scoring math below).
5. **Trade levels + position management** match the setup's geometry and holding period.
6. `marketReadText` states the standing orders with markers so the agent sees live values inline.

## Report grammar — sections and columns

A custom column is `metric × transform (± chained transform) × timeframe ref (± params)`.
Headers are **system-generated, never named by you**. Validated affix patterns:

| Transform | Header shape | Example (validated) |
|---|---|---|
| `value` | `<code>` | `bbWidthPct`, `RVOL`, `rate` |
| `trajectory` (window 4) | `<code>_t3 … _t1`, `<code>_now`, `<code>_trend` (rising/falling/flat) | `RSI14_now`, `RSI14_trend` |
| `distance` (price → level) | `dist_<code>` (signed %) | `dist_SMA50` |
| `spread` (base vs operand) | `<base>_<operand>_spread` | `mark_oracle_spread`, `EMA5_EMA13_spread` |
| `aggregate` (window N) | `<code>_mean<N>` | `rate_mean24` |
| `rank` (ordering hi/lo/far/near) | `<code>_rank_<ordering>` — ordinal, 1 = best; compare with `lte N` for top-N | `bbWidthPct_rank_lo`, `closeChg_rank_far` |
| `efficiency` (window N) | `<code>_er` (0–1; 1 = straight move, ~0 = chop) | `close_ltf_er` |
| `maxShare` (window N) | `<code>_maxShare` (0–1 concentration) | `volBase_ltf_maxShare` |
| `classifyZone` / `classifyState` | `<code>_zone` / `<code>_state` | `RSI14_zone` (overbought/oversold/neutral), `ADX_state` (weak/developing/trending/extreme) |

Non-anchor rungs add a rung affix: `_ltf` (lower) / `_htf` (regime), e.g. `MAalign_htf`,
`zones_htf_support_dist`. Chains are bounded at two: inner `distance`/`spread` → outer
`trajectory`/`aggregate`/`efficiency`/`maxShare`/`rank` (e.g. EMA5 `spread` EMA13 ×
`trajectory` → `EMA5_EMA13_spread_now` + `_trend`). Read exact headers from
`get_strategy_column_contract` or a `preview_strategy_report`'s `conditionColumns` before
writing conditions against them.

**Timeframe references — two families.** *Relative* (`{rel: "anchor" | "lower" | "regime"}`)
re-resolve when the strategy timeframe changes; `regime` is the anchor's ladder successor (a 4h
anchor's regime rung is 1d today). *Pinned* (`{abs: "<tf>"}`) is fixed and ignores anchor
retunes; its legal set is discovery's `rankedTimeframes` — a **superset** of the authorable
anchor set (`timeframes`), so `{abs: "1d"}` is valid while `1d` is not an anchor. Pinned
headers suffix the literal: `RSI14_1d`, `dist_SMA200_1d`, `MAalign_1d` (validated). `offset: 1`
on a pinned `value` column reads the **last closed** bar of that timeframe — the deterministic
daily-close read; offset does not change the header, so one section carries one offset per
`metric × timeframe`. This is how higher-timeframe theses (daily-chart strategies included)
are authored on an intraday anchor — see the daily pattern in `references/tradingview-ports.md`.

**Benchmark sections** (`benchmarkTicker: "BTC"` on a custom section) read the *benchmark's*
values instead of the evaluated coin's — the standard way to gate a whole book on market-leader
regime. `benchmarkTicker` is required-nullable on every custom section: send `null` for an
ordinary section, never omit it.

Budgets are served by discovery (validated today: 32 sections, 32 custom columns, 8 distinct
timeframes, 16 conditions, 16 clauses, 16k estimated report tokens). `preview_strategy_report`
echoes your usage against each cap.

## Conditions — deterministic logic over your own report

Each condition: `{ conditionKey, name, definition, verdict, required }` — all five required;
`verdict` and `required` have no defaults.

- **Clauses** compare one column: numeric/rank headers take `lt|lte|gte|gt|between`;
  classification/direction/event headers take `is|in` with the column's exact vocabulary
  (served per header in `conditionColumns` / the column contract).
- **Groups**: `ALL`, `ANY`, `NOT`, `N_OF` (with `n`), depth ≤ 2 (an inner group holds leaves
  only).
- **References** (`{kind:"conditionRef", conditionKey}`) compose named conditions; cycles are
  rejected, forward references are legal.
- **Column addressing**: `{sectionKey, header}`. `sectionKey: null` is authoring sugar for a
  header unique across the whole report; a duplicated header (e.g. `ADX` in two sections) must
  be section-qualified. To reference your own custom sections at CREATE time, mint the
  `custom:<uuid>` sectionKey yourself and reuse it in the clauses.
- **Verdict**: `UP` | `DOWN` | `NEITHER` on deciding conditions, explicit `null` on building
  blocks. Declaration order is precedence: the first TRUE condition with a non-null verdict
  decides the coin's verdict. Put the more specific carrier first.
- **`required: true`** makes a FALSE reading a hard gate: the compose-trade evaluation is
  blocked *before any billing or LLM call*. This is the cheapest risk control in the studio —
  use it for liquidity floors, regime vetoes, and "never fight the HTF" rules.
- Evaluation is three-valued: `UNRESOLVED` (missing input) is never collapsed to FALSE, and
  outcomes read from a still-forming bar are marked provisional.

## Signal weights — the scorecard is a weighted average, budget it

Allocation tiers: `0` Off, `1` Normal, `2` Important, `3` Critical.

```
aggregateScore = Σ(score × allocation) / Σ(allocation)   over triggered signals
```

Consequences worth designing around:

- Weights are **relative**: one Critical among Normals dominates; all-Critical equals all-Normal.
  Build a pyramid — 1–2 Critical (the thesis), 2–4 Important (confirmation), a few Normal
  (context) — and turn everything else Off so noise cannot dilute the average.
- `required: true` on a rule does two things: the signal counts toward `minRequiredCount` when
  it triggers, and the gate blocks routing when too few required signals fired. A rule with
  `required: true` at allocation 0 is **rejected** (contract 34) — raise the allocation or clear
  the flag.
- `params` are per-signal and replace canonical defaults only when present and valid — tune
  thresholds to the strategy (e.g. an RSI-overbought at 65 for a fade book) after reading
  `get_strategy_signal_definition({signalId, timeframe})`. Omitted `params` preserve defaults
  byte-for-byte.
- Which signals *can* trigger follows from your report's sections/columns
  (`derive_strategy_rule_view` shows in-report membership for a draft). Weighting a signal your
  report never feeds is dead weight.

## Routing gates

- `minAggregateScore` (0–1): floor on the weighted average above. Set it from your pyramid: if
  routing should need the Critical thesis plus one Important confirmation, compute that mix's
  aggregate and gate just under it.
- `minRequiredCount` (0–20): how many `required` signals must be among the triggered set.
- `minAtrPct`: minimum ATR as % of price — a dead-market filter; bounds come from
  `get_trading_config_catalog` (validated today: 0.1–10).

## Trade levels (ATR geometry)

`minStopLossAtrMultiple < maxStopLossAtrMultiple` (band where the stop may sit; ceiling capped
at the structural 3×ATR), `minRiskRewardRatio` (catalog bounds today: 0.5–3). Position size is
risk-budget based (`riskPct / stopDistancePct` — see the `battlegrid` skill's contract notes),
so a *wider* stop means a *smaller* position, not more risk. Tight bands suit breakout entries;
wide bands suit mean reversion that needs room.

## Position management (how the stop moves)

Validated live bounds: `breakEvenTriggerR` 0.5–2 · `trailingTriggerR` 0–2 step 0.01 (0 = trail
from entry) · `trailingGivebackPct` 25–55 · `trailingBufferPct` 0.01–1 · `timeDecay` grace
1–1440 min ≥ interval 1–480 min, tighten 0.1–50%, max 1–100%, stale threshold 0–100% of TP
progress. Each mechanism has its own enabled flag; there is no umbrella switch. Trend books:
arm break-even ~1R, trail late with a generous giveback (40–55). Mean-reversion/scalp books:
break-even early, tight giveback, and **timeDecay on** — a thesis that hasn't paid within its
horizon should be squeezed out.

## Coin selection (per compile, not persisted)

`{mode:"ranked", limit, category?}` (categories today: ALL, CRYPTO, L1, MEMES, DEFI, TRADFI,
STOCKS, INDICES, COMMODITIES) or `{mode:"explicit", tickers[]}`. Choose the cohort the review
should render over — explicit tickers for a focused edit, ranked for a scanning book.

## Market Read markers

`marketReadText` renders with live values wherever a `{...}` marker names a column header
(`{RVOL}`), a condition (`{SQUEEZE_ON}` — renders outcome plus evidence), or a section-qualified
form on collision (`{custom:<uuid>.MAalign}`). The preview returns `marketReadMarkers` with each
marker's resolution status — fix `unknown`/`ambiguous` markers before compiling.

## References

- `references/playbooks.md` — five validated desk-grade playbooks with full payloads: volatility
  compression breakout, crowded-positioning fade, relative-strength rotation with a benchmark
  gate, HTF trend pullback, perp/spot flow divergence at structure.
- `references/recipes.md` — copy-adaptable column recipes, condition patterns, weight matrices,
  and trade-level/position-management presets per trading persona.
- `references/tradingview-ports.md` — the most popular TradingView community scripts (Squeeze
  Momentum [LazyBear], Supertrend/UT Bot, Chandelier Exit, MACD + 200 MA, golden cross, RSI-2,
  VWAP reversion, Donchian/Turtle, ICT FVG/order blocks) translated process-for-process onto
  the studio's vocabulary, with an expressibility triage and honest named substitutions for
  what the grammar cannot carry.

Validate a draft cheaply before compiling: `derive_strategy_rule_view` (report membership +
rule defaults, no write) and `preview_strategy_report` (rendered tables, condition outcomes
with evidence, verdict tally, budget usage, marker resolution). Then compile once, review the
compiled truth, and apply.
