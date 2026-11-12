---
name: battlegrid-strategy-examples
description: Full-surface composition patterns for the strategy studio — validated desk-grade examples of custom report sections, benchmark, market-breadth and stablecoin-peg sections, condition trees with verdicts and required enforcement, the entry-condition rule, ATR trade levels with the ATR floor, and position management. Activate beside strategy-authoring whenever a strategy is being composed or upgraded beyond a basic template.
---

# Strategy Studio — full-power composition patterns

`strategy-authoring` owns the flow (evidence → locked spec → discover → stage → review →
commit). This skill owns **what to compose**: a default build — a few platform sections, no
conditions, untouched trade levels — wastes the studio, and one with no entry condition never trades. The playbooks below are compiled in CI, so their
shapes are binding in the sense that matters — they are checked, not merely asserted. Loose tokens
elsewhere in this file are not covered by that gate, and vocabulary moves with deploys, so discovery
in the conversation stays the authority — prefer what `list_strategy_vocabulary` and
`get_strategy_column_contract` return over anything printed here, and read exact headers from a `detail: "detailed"` preview's
`authoring.conditionColumns` before conditioning on them.

## The full-power checklist

Before committing a CREATE, every "no" here is a decision to state, not an omission:

1. At least one **custom section** whose columns encode the thesis — not only platform modules.
2. **Conditions** encode the entry logic: building blocks (`verdict: null`) + verdict carriers,
   and at least one `required: true` condition vetoing obvious disqualifiers **before any
   billing or LLM call**. They are the only deterministic entry gate: with no required and no
   verdict-carrying entry condition the strategy never routes a trade (`NO_ENTRY_CONDITION`).
3. **The ATR floor** (`minAtrPct`) is set for the coins and timeframe the thesis trades, not left
   at the default by accident — a coin below it is refused before any condition is read.
4. **Trade levels + position management** match the setup's geometry and holding period.
5. `marketReadText` states standing orders with `{...}` markers so live values render inline.

## Header grammar (system-generated — never named by the author)

| Transform | Header | Validated example |
|---|---|---|
| `value` | `<code>` | `bbWidthPct`, `RVOL20`, `rate` |
| `trajectory` w4 | `<code>_t3…_t1`, `_now`, `_trend` (rising/falling/flat) | `RSI14_now`, `RSI14_trend` |
| `distance` | `dist_<code>` (signed % from price) | `dist_SMA50` |
| `spread` | `<base>_<operand>_spread` | `mark_oracle_spread` |
| `spread` against an average `{ metric, transformId, window }` | `<base>_<operand code>_spread` | `close_close_ema100_spread`, `close_ema34_close_ema89_spread` |
| `aggregate` wN | `<code>_mean<N>` | `rate_mean24` |
| `rank` | `<code>_rank_<hi\|lo\|far\|near>` — ordinal, `lte N` = top-N | `bbWidthPct_rank_lo` |
| `efficiency` wN | `<code>_er` (1 straight, ~0 chop) — N changes, reading N + 1 bars | `close_ltf_er` |
| `maxShare` wN | `<code>_maxShare` | `volBase_ltf_maxShare` |
| `zscore` wN | `<code>_z<N>` (population σ; bands ±1, ±2) | `RSI14_z20` |
| `stddev` wN | `<code>_sd<N>` (population σ, the input's units) | `close_sd20` |
| `linregSlope` wN | `<code>_slope<N>` (least-squares slope per bar) | `EMA20_slope20` |
| `pctl` wN | `<code>_pctl<N>` (0–100 against the N prior bars) | `RSI14_pctl20` |
| `rollingMin` / `rollingMax` wN | `<code>_min<N>` / `<code>_max<N>`; at `offset` K > 0 `<code>_o<K>_min<N>` | `low_min20`, `high_max20`, `high_o1_max55` |
| `classifyZone` / `classifyState` | `<code>_zone` / `<code>_state` | `RSI14_zone`, `ADX14_state` |
| `levelInteraction` | `<code>_lvl`, `<code>_lvl_b<N>` at a buffer of N bps, `<code>_lvl_a<m>` at `touchAtr` m | `bbUpper20_lvl`, `bbUpper20_lvl_b25`, `EMA20_lvl_a0.5` |
| any, stored `"bars": "all"` | `<code>_dev`, then the transform's suffix | `RSI14_dev_t1` |
| `value` at `offset` N > 0 | `<code>_o<N>` | `RSI14_1d_o1` |

The code carries its tokens in this order: `<code>[_<tf>][_dev][_o<N>]`, then the transform's suffix.
`_dev` follows the STORED selector — the author chose Developing — whatever bar set the column then
reads; `_o<N>` appears on a `value` or a rolling extreme at offset N > 0.

Non-anchor rungs affix `_ltf` (lower) / `_htf` (regime): `MAalign_htf`,
`zones_htf_support_dist`. Chains are bounded at two and take one of two shapes: inner
`distance`/`spread`/`relativeTo` → a series outer (`trajectory`, `aggregate`, …) or `rank`
(`EMA5 spread EMA13 × trajectory` → `EMA5_EMA13_spread_now` + `_trend`); or a rolling extreme
`rollingMax`/`rollingMin` → `distance`, the breakout level (`HIGH × rollingMax(55, offset 1) ×
distance` → `dist_high_o1_max55`). The level chain needs a price base with a per-bar candle value and
`offset` ≥ 1 (the catalog serves it as `chainedOuters.distance.offsetMinimum`): at offset 0 the extreme
includes the bar measured, so a close can never pass it. The offset belongs to the rolling extreme,
never to a chain outer.

**Timeframe references are two families.** *Relative* (`anchor`/`lower`/`regime`) re-resolve
when the strategy timeframe changes — `regime` is the anchor's ladder successor (1d for a 4h
anchor). *Pinned* (`{abs: "<tf>"}`) is fixed, ignores anchor retunes, suffixes the literal
(`RSI14_1d`, `dist_SMA200_1d`, `MAalign_1d` — validated), and binds to discovery's
`rankedTimeframes`, a **superset** of the authorable anchor set — `{abs: "1d"}` is valid while
`1d` is not an anchor. `offset` steps back inside the bar set the Read selector admits, counted
from the newest bar that set admits, and suffixes the header `_o<N>` (`RSI14_1d_o1`). A pinned
column above the strategy timeframe reads Confirmed, so its offset 0 is already the newest
**completed** bar of that timeframe — the deterministic daily-close read — and offset 1 is the
day before it. **Daily-strategy pattern:** anchor 4h, pinned-1d thesis columns with
`"bars": "closed"` at offset 0, `required: true` daily conditions gating every carrier, anchor-rung
columns only for entry timing and risk — daily inputs then move once per daily close while
stops and time decay keep managing intraday. **Benchmark sections** (`benchmarkTicker: "BTC"`,
required-nullable on every custom section) read the benchmark's values on every row — the
standard market-leader regime gate; a section can also read a stablecoin pair or the market itself
(`## Report sections`). Platform `sectionKey`s are their literal keys
(`includeHigherTimeframe`). Custom `sectionKey`s are the **server's** to issue, and which of the two
things you do depends on the operation: on a **CREATE, omit `sectionKey` entirely** — supplying one
is refused, since a new strategy owns no custom sections yet; on an **UPDATE or RESTORE, send back
the keys `get_strategy` returned** for the sections you are keeping, and omit it on a section you
add. Either way you never invent one. To section-qualify a duplicated header, read the key from a
`detail: "detailed"` preview's `authoring.conditionColumns` or from the qualified candidates a
`CONDITION_COLUMN_AMBIGUOUS` refusal offers.

**A session window is an ordinary condition.** `TRADING_SESSION` (`asia` 00–08, `london` 08–13,
`newYork` 13–21, `late` 21–24 UTC) and `DAY_OF_WEEK` (0 = Sunday … 6 = Saturday, UTC) are bar facts of the
bar's open, fixed in UTC with no daylight-saving rule — their glosses state the windows. A weekday London
or New York window is `ALL(TRADING_SESSION in ["london","newYork"], DAY_OF_WEEK between 1 and 5)`, and a
weekend is `NOT(DAY_OF_WEEK between 1 and 5)`; no strategy setting expresses one.

**Event columns print only on their event.** `MACDhist_cross` and `EMA5_13` (Bullish/Bearish) carry a
value on the crossing bar and are null on every other one, and a null reads FALSE. Use an event
column as a TRIGGER inside a carrier, and pair it with a persistent state — a spread sign,
`MAalign` — for regime. A condition that treats an event column as a standing state reads FALSE on
nearly every bar, so it is TRUE only on the crossing bar itself.

**The previous-UTC-day levels are TIMELESS.** `PDH`, `PDL`, `PDO` and the seven floor pivots
(`pivotP`, `pivotR1`–`R3`, `pivotS1`–`S3`) read the UTC-day profile, not a candle rung, so they take
no timeframe reference at all: bind them `{rel: 'anchor'}` — the default — and they serve the same
previous UTC day from any anchor. The trading-session levels (`asiaHi`, `pLondonHi`, `nyOpen`, …) read
the trading-session profile the same way, each session fixed in UTC with the window its label names. An
absolute reference is REFUSED at save, including `1d`,
because there is no rung for one to select. They are catalogued price levels, so `dist_PDH gte 0`
composes directly. (`distance` still rejects an `offset`, and a clause still compares a column
with a literal or with its own previous completed bar, never with another column; neither of those
shapes is what a previous-UTC-day level needed.) Every bar reads the level as it stood when that bar
OPENED, kept for the newest 24 strategy bars: on a `1d` strategy, day D's bar reads `PDH` = the high of
day D−1, so `dist_PDH gt 0` fires on the day that closes above it, and `dist_PDH crossesAbove 0` compares
two bars that each read their own day's level — the first bar of a new day included. A `spread` of a
bar's own value against one of these levels reads that bar's level the same way. A relation over a
session-profile level — `spread`, `distance` or `levelInteraction`, chained forms included, the level as its
side or its operand — is built only on the strategy's anchor rung (`{rel: 'anchor'}`): on any other rung the
operand is not offered and the column is REFUSED at save. The same holds
for every timeless metric — these levels, funding, the regime and the other bundle
reads: a `value` column over one accepts only `offset: 0`, and a larger offset is REFUSED at save,
because there is no earlier bar to cut back to.

## Conditions

`{ conditionKey, name, definition, verdict, required, exitSide }` — all six
required, no defaults. A `clock` key is REFUSED (the per-condition evidence clock was retired in
contract `61.0.0`), so is a condition-level `closes` key — the hold lives on each clause and each
group (contract `84.0.0`) — and so is a boolean `exit` key: the side an exit closes is its own
`exitSide` (contract `88.0.0`). Clauses — the operator a header takes is served per header
(`conditionOperators`), by its output kind: numeric headers take the comparisons
`lt|lte|gte|gt|between` and the prior-bar operators `crossesAbove|crossesBelow|increased|decreased`;
rank headers take the comparisons only; classification, direction and boolean headers take
`is|in|enters|exits` with the served vocabulary; event headers take `is|in`. Groups:
`ALL | ANY | NOT | N_OF` (with `n`) | `SEQUENCE` (with `within`, root only), depth ≤ 2. Every clause and every group carries a required
`hold: { atLeast, of }` — `{ "atLeast": 1, "of": 1 }` is a single read; a clause or group without
`hold` is refused (`CONDITION_HOLD_INVALID`). `conditionRef` composes named conditions (no
cycles; forward refs legal) and carries no hold of its own. `sectionKey: null` is sugar for a report-unique header only.
Verdicts: resolution is taken over the DISTINCT verdicts of the carriers that read TRUE. One
distinct verdict decides, and the first carrier in declaration order carrying it is named as the
decider — so order breaks ties between carriers that AGREE. Carriers that DISAGREE resolve
`NEITHER` and stand the coin aside; declaration order never picks a side between them. Building
blocks carry `null`.

**Prior-bar operators — a column against its own previous completed bar.** A clause compares its
column with a literal, or with the same column's reading on the completed bar before the one it
decides — never with another column. Six operators read that prior bar:

| Operator | Literal | TRUE when |
|---|---|---|
| `crossesAbove` | a number `L` | `x > L` on the decided bar and `x ≤ L` on the bar before |
| `crossesBelow` | a number `L` | `x < L` on the decided bar and `x ≥ L` on the bar before |
| `increased` | none | `x` is strictly above its prior-bar reading |
| `decreased` | none | `x` is strictly below its prior-bar reading |
| `enters` | one label | the label is read now and was not on the bar before |
| `exits` | one label | the label was read on the bar before and is not now |

The crossing boundary is Pine's (`ta.crossover`): a bar sitting exactly on `L` has not crossed until a
later bar closes above it. A change takes no literal at all — `{ "op": "increased" }` with no `value`.
A prior-bar clause reads COMPLETED bars only, on every surface: the decided bar and the one before
it, never the forming bar, so it is never provisional. A failed read on either bar is UNRESOLVED; a
bar with no value (a null) reads FALSE. A header admits them only where its stored history keeps the
bar before: a header whose `conditionHold.maxWindow` is 1 is served none of the six, so
`vol24hUsd increased` is refused (`CONDITION_OPERATOR_UNSUPPORTED`, naming the operators it does
admit), and on a header that keeps them each reads one bar less than its window.

**An edge is counted by the closes it fired on.** `crossesAbove`, `crossesBelow`, `enters` and `exits`
mark the bar a state changed, so a hold over one counts the closes it fired on: "at least k of n closes"
is Pine's `math.sum(cond ? 1 : 0, n) >= k`, and `{ 2, 10 }` is "fired on at least 2 of the last 10
closes". `{ n, n }` over one edge reads TRUE only where it fired on every one of the n closes, which a
single crossing never does twice in a row. `increased` and `decreased` are no edge: "3 closes in a row"
of `increased` is three rising closes. Every prior-bar read counts toward the frame-read budget: a
clause held "within 3 closes" reads four bars.

Recipes — each one clause:

- **Close crossed above the 20 SMA** — `dist_SMA20 crossesAbove 0` (the Moving Averages module).
  `dist_SMA20` is the close's distance from the average, so crossing 0 is the close crossing it.
- **RSI entered overbought** — `RSI14_zone enters "overbought"` (the RSI module).
- **Squeeze released** — `kcSqueeze exits "on"`, over a `KC_SQUEEZE` value column.
- **New 20-bar high** — `donchianHi20 increased`, over a `DONCHIAN_UPPER` value column: the 20-bar
  upper channel rises exactly when the decided bar's high exceeds every high of the 20 bars before it.
- **Close above the prior 20-bar high (Donchian / Turtle breakout)** — `dist_donchianHiPrior20 crossesAbove 0`,
  over a `DONCHIAN_UPPER_PRIOR × distance` column: Pine's `ta.crossover(close, ta.highest(high, 20)[1])`,
  TRUE on the first close of a breakout run. `dist_donchianHiPrior20 gt 0` is Pine's
  `close > ta.highest(high, 20)[1]` and holds on every close of the run. Mirror with
  `dist_donchianLoPrior20 crossesBelow 0` / `lt 0` over `DONCHIAN_LOWER_PRIOR`.
- **Failed breakout of the prior 20-bar high** — `donchianHiPrior20_lvl is "reject_from_below"`, over a
  `DONCHIAN_UPPER_PRIOR × levelInteraction` column: the high pierced the prior 20-bar high and the close
  came back under it. `dist_donchianHiPrior20 crossesBelow 0` is NOT "fell back into the channel": the rail
  rises to each breakout bar's high, so it fires once on the first bar of a breakout run that does not
  close above the raised rail — the run of new closing highs ended.
- **RSI crossed above 50 within the last 3 closes** — `RSI14_now crossesAbove 50` holding
  `{ "atLeast": 1, "of": 3 }`.
- **Close crossed above a 100 EMA** (a length with no stored point) — `close_close_ema100_spread crossesAbove 0`,
  over `CLOSE × spread` with the operand `{ "metric": "CLOSE", "transformId": "ema", "window": 100 }`: the close's
  signed % gap from `ta.ema(close, 100)`. A stored length keeps its own code: the 20 SMA is `dist_SMA20`.
- **EMA 34 crossed above EMA 89** — `close_ema34_close_ema89_spread crossesAbove 0`, over `CLOSE × ema` at
  `window: 34` chained into `spread` with the operand `{ "metric": "CLOSE", "transformId": "ema", "window": 89 }`:
  Pine's `ta.crossover(ta.ema(close, 34), ta.ema(close, 89))`. The operand's average is one of `aggregate` (the
  simple average), `ema`, `rma`, `wma`, at a length of at least 2, and nothing chains over the spread.
- **Two crosses of the 20 EMA in 10 bars** — `dist_EMA20 crossesAbove 0` holding
  `{ "atLeast": 2, "of": 10 }`: the close crossed above the average on at least 2 of the last 10 closes.

**Two things block a trade, not one.** `required: true` = a FALSE reading blocks compose-trade
before billing. And the RESOLVED verdict binds entry DIRECTION: `UP` admits long setups only,
`DOWN` short only, and `NEITHER`/`UNRESOLVED` admit none — the refused side is absent from the
setups block and from the `decide_trade` contract, not merely discouraged in them. A strategy that
declares no verdict-carrying condition resolves `null` and constrains no side.

**A strategy without an entry condition never routes.** An entry condition gates when it is
`required: true` or carries a verdict (`UP`, `DOWN` or `NEITHER`); a building block not marked
`required` gates nothing, and an exit rule never counts. A strategy whose conditions include neither
never trades: every coin fails first with `NO_ENTRY_CONDITION`, before the trade levels, the ATR
floor or any condition is read, and its draft carries the `NO_ENTRY_CONDITION` warning. It never
enters the arena either: an arena grid may hold only the coins its required conditions pass, in the
directions its verdict admits, so an agent bound to a strategy with no entry condition sits out every
session. It stays a valid strategy, so this is a choice to state, never an accident. When the agent decides a
routed trade, its `decide_trade` call cites 1–8 of the evaluated entry conditions in
`conditionChecklist`, and only a condition that read TRUE may be cited as `CONFIRM`.

**Building block or inline — the same logic, different reach.** A `conditionRef` reads the
referenced condition's one answer for the bar being decided — TRUE, FALSE or UNRESOLVED, exactly what
its tree reads in place — so moving a subtree into a building block, or back, never by itself changes
a coin's result. What differs is what each form can reach and what each costs.

Make it a building block when:

- **The tree nests past the depth cap.** "Not a breakout", where a breakout is an `ANY` of `ALL`s,
  is a `NOT` over a group over groups; inside another condition's `ALL` that is one level too deep,
  so the breakout becomes its own building block and the carrier reads `NOT [UP_BREAKOUT]`
  (`CONDITION_GROUP_DEPTH_EXCEEDED` names this remedy).
- **One condition would pass `budgets.conditionClauses`** (served by `list_strategy_vocabulary`). A
  reference spends no clause and no frame read, so a sub-rule referenced from several conditions is
  counted once; every pasted copy is counted again, against `budgets.conditionFrameReads` too.
- **The gate is "either side".** Every `required` condition must read TRUE, so marking `RANGE_LONG`
  and `RANGE_SHORT` both required demands both at once. The gate is one building block,
  `SETUP_VALID` = `ANY [RANGE_LONG, RANGE_SHORT]`, marked `required: true`. It is not redundant with
  the carriers' verdicts: the verdict that binds direction is held through a contrary reading until
  that reading repeats for the dwell the binding records (`verdictDwellRequired` on a signal log's
  `verdictBinding`), while a required condition reads the decided bar alone — so the required block
  is what insists the setup is present now.
- **The sub-rule should be read by name.** A building block's outcome renders under its own key in
  the prompt the agent reads, in the signal log's condition evaluation and in the studio's per-coin
  readout; an inlined clause shows only as evidence under the condition holding it.
  `AT_DEMAND TRUE · FLOW_LONG_OK FALSE` tells the agent and the player why; `RANGE_LONG FALSE` alone
  does not.
- **It must read TRUE without voting.** Verdict resolution skips a building block, so a location or
  flow test never sets a side and never contradicts a carrier into `NEITHER`.

Inline it when:

- **It is one clause used once.** As a building block it spends a whole condition slot out of
  `budgets.strategyConditions` for nothing but its name.
- **The composite must be counted across closes.** A group holding more than Once holds no
  `conditionRef`, so "together on 3 closes in a row" over a sub-rule needs its clauses inline.

Inlining a `NOT` is not always a flipped operator. A clause whose read ran and found no value reads
FALSE, so `NOT [dist_donchianHiPrior20 gt -0.52]` reads TRUE on a coin with no channel value while
`dist_donchianHiPrior20 lte -0.52` reads FALSE; `NOT [CVD_state is "bearish"]` and
`CVD_state in ["bullish", "neutral"]` part the same way. Flip only a header that always carries a
value, or choose deliberately which answer a missing value gives.

A verdict carrier must read no DEVELOPING bar. A verdict is refused over any closure that reads a
column selecting Developing above the strategy timeframe (`CONDITION_VERDICT_READ_ILLEGAL`). The
closure is what the condition reads directly plus everything reached through `conditionRef`,
transitively: a referenced condition contributes what IT reads, so moving the clause into a building
block does not launder it. A closure whose candle columns all read Confirmed — or whose operands no
bar moves at all, such as a published regime label or a funding rate — admits a verdict at every
decision, because a decision reads the completed strategy bar and a level is compared against that
bar's close. A change over a horizon above the strategy timeframe — `chg4h` or `chg24h` on a `1h`
strategy, and `oiRegime`, which reads the `1h` change, below `1h` — is a developing read whatever its
selector: its bar is still in progress at the close, so it carries no verdict. Read a horizon at or
below the strategy timeframe instead, or a Confirmed `CLOSE_CHANGE` on the higher timeframe.

Evaluation is three-valued: UNRESOLVED never collapses to FALSE; a developing read is provisional,
and so is any reading taken on the display lane's forming bar.

**Every condition is decided at the strategy bar's close.** There is no per-condition clock. Which
bar a condition reads is decided by the surface asking — a decision (the radar's close decision, the
compose that takes the trade, the exit sweep) reads completed strategy bars; a display read shows the
forming one and decides nothing — and by each candle column's own Confirmed / Developing selector.

**Hold — how many closes a clause counts.** A clause's `hold: { atLeast, of }` reads TRUE when the
clause read TRUE on at least `atLeast` of its newest `of` COMPLETED bars — counted on the clause's
OWN column timeframe, not the strategy's: a `4h` column on a `1h` strategy held 3 reads three `4h`
bars. The editor calls the control **Hold** and offers four modes:

| Mode | Hold | Reads as |
|---|---|---|
| Once | `{ 1, 1 }` | a single read of the bar being decided |
| In a row | `{ n, n }` | "3 closes in a row" |
| Within | `{ 1, n }` | "within 5 closes" |
| At least | `{ m, n }` | "at least 2 of 5 closes" |

A hold counts the same completed bars whichever surface asks. Each bar is read or unreadable; an
unreadable bar is never replaced by an older one, and the count decides as soon as the bars read
decide it (TRUE once `atLeast` bars read TRUE, FALSE once the rest can no longer reach it), else
UNRESOLVED.

What a header admits is SERVED, never guessed: every column in the strategy's report catalog
(`preview_strategy_report` at `detail: "detailed"` → `authoring.conditionColumns[].outputs[].conditionHold`, and each scalar metric in
the vocabulary) carries `{ timeframe, maxWindow, maxAtLeast, refusal }` — the timeframe it counts,
the largest `of`, the largest `atLeast`, and, when it admits only Once, why. `maxWindow` is the
history the store keeps for that column, less the column's own lookback and warm-up. A hold past
the served domain is refused (`CONDITION_HOLD_ILLEGAL`, the domain in `allowedDomain`). The reasons
a header admits only Once:

- `NOT_REWINDABLE` — the value is stored for the current bar only (the session-field scalars,
  ranks, enrichment metrics, a change at or below the strategy timeframe). **Worked liquidity floor:**
  `LIQUID_FLOOR` holds Once because `vol24hUsd` is a bundle scalar. A structure-zone column is not one of
  these: it holds on its own timeframe up to the window its `conditionHold` serves, each counted bar
  reading the zone set stored for that bar.
- `DEVELOPING` — the column reads a bar still forming: a Developing candle column above the strategy
  timeframe, or a change over a horizon above it. **Developing columns cannot be held**; set a candle
  column Confirmed to count closes, or read a change at or below the strategy timeframe.
- `OFFSET` — the column already reads an earlier bar; remove the offset to count closes.
- `BAR_STATE` — the header describes only the bar being decided.
- `HISTORY` — not enough history is stored on that timeframe to count more than one close.

Candle columns (at, above or below the strategy timeframe), the market and stablecoin-pair columns
(each counted on its subject's own bars), the regime (counted on the regime rung),
and the funding and open-interest histories (on the coarser of the strategy timeframe and their own
hourly cadence) can all be held. **A crossover is an event**: it fires on the bar a state changes,
so a hold over it counts the closes it fired on, as an edge's does.

**Group hold — closes counted together.** A group's `hold` counts its members' joint reading on the
same bar: the group's own outcome, its members folded by its operator, must read TRUE on at least
`atLeast` of its newest `of` bars, counted on its finest member's timeframe. The phrases add
"together": "together on 3 closes in a row", "together within 5 closes", "together on at least 2 of
5 closes". Inside a group holding more than Once, every member holds Once and none is a
`conditionRef` — each read is counted by exactly one hold — so a row holding its own closes, a
reference, or a held group inside is refused, naming the member. A conjunction over a crossover
(`ALL(cross, x)`) counts the closes on which both read TRUE together. Reach for a split to keep a condition's
MEANING separable; a reference carries its condition's one answer for the bar being decided and is
never counted across closes.

**In order — steps over a window.** An entry condition's ROOT group may be
`{ "kind": "group", "op": "SEQUENCE", "within": 8, "hold": { "atLeast": 1, "of": 1 }, "members": [ … ] }` —
the editor's **In order**. Its members are its steps, in order, at least two: each step is one
clause, one group of clauses, or a `conditionRef` to a condition that reads one bar (one clause or
one group of clauses, no reference, every hold Once). It reads TRUE when every step reads TRUE on a
bar of the window, each on a STRICTLY later bar than the step before, and the last step on a bar
that closed inside the decided strategy bar — so steps on a timeframe coarser than the strategy's
complete only when the decided close is one of that timeframe's own closes, and read FALSE on every
other; two steps never match the same bar, neither of the window's timeframe nor of either step's own
(two `1h` steps counted on `15m` bars never both match one hour), and an older match never
stands in for a missing later one. The window counts `within` completed bars of the steps' finest column
timeframe (at least 2, at most what the steps' columns serve — the group hold rule over the steps,
references expanded), so on a `15m` step under a `1h` strategy the last step may read TRUE on any of
the four `15m` bars inside the decided `1h` bar. Every step and the sequence hold Once: the window is
the count. A step reads UNRESOLVED where its bar is unreadable, and the sequence reads UNRESOLVED only
when an unreadable bar could still complete the match. The sequence is root only (never inside a
group, never a step of another) and entry only: an exit rule that is one, or reads one, is refused
(`CONDITION_EXIT_SEQUENCE_UNSUPPORTED`). A misshapen sequence is refused with
`CONDITION_SEQUENCE_INVALID` — for a step reference, `details.context.refusal` names why the referenced
condition is not one bar (`STEP_HOLDS_WINDOW`, `STEP_NESTS_GROUP`, `STEP_READS_REFERENCE`,
`STEP_IS_SEQUENCE`) — and a window outside its domain with `CONDITION_SEQUENCE_WINDOW_INVALID`, the domain
in `allowedDomain`. Its evidence is one `kind: "sequence"` line — each step's `outcome`, `matchedBar`
(`closesBack` on the window's `timeframe`) and `reference` — followed by the matched steps' own clause
lines, each read at the bar it matched.

Worked, in the shape Pine users write most:

- **"A happened within the last N bars, and B is true now"** — Pine `ta.barssince(A) <= N and B` — is
  In order within N+1 [A, B], with B the LAST step, so B reads TRUE on the decided bar and A on one
  of the N bars before it. `MACD_TURNED` = In order within 6 [`MACD_CROSS_UP`, `RSI_ABOVE_50`] is Pine
  `ta.barssince(ta.crossover(macd, signal)) <= 5 and rsi > 50`.
- **The lower timeframe last**: `LONG_TRIGGER` = In order within 8 [`NEAR_SWING_LOW`, `LTF_TURN_UP`]
  reads "near a swing low, then a lower-timeframe turn up, inside 8 bars" — and the 8 are bars of the
  finest step's timeframe, so with a `15m` turn under a `1h` strategy the window is 8 × 15m = 2h, not 8
  strategy bars. No one Pine line says this: `request.security` on the lower timeframe returns only its
  last bar inside the chart bar, while the sequence lets the turn match on ANY `15m` bar of the window
  inside the decided hour.

Two differences from Pine: two steps never share a bar. The sequence finds A on ANY earlier bar of the
window (Pine's `ta.barssince` reports only the most recent A), so it fails to complete only where A's sole
occurrence in the window is B's own bar — where Pine's `ta.barssince(A)` is 0. To accept that case too,
make the sequence its own condition and enter on an `ANY` over its `conditionRef` and the one-bar group
A AND B. And a step whose bar is unreadable reads UNRESOLVED, never FALSE, where Pine's `na` makes the
comparison false.

A swing-failure pattern on ONE candle is not an ordering: it is a single `levelInteraction`
clause, `is "reject_from_above"` at a swing low's level (`reject_from_below` at a high); "on the
same or the next candle" is an `ANY` over that clause and a sequence of the sweep and the reclaim
within 2 — and ANY is not the root sequence, so that sequence is its own condition the `ANY` reads by
`conditionRef`, which the entry may do. Neither is a parity claim for a TradingView sweep or SFP
script: name what the port gives up. That sequence needs a level that outlives the close beyond it, so
a liquidity pool takes its own next-candle form instead: the close beyond retires the pool, and the next
bar reads the reclaim column, `poolAboveRecl is "true"` (`## Market structure levels`).

**Confirmed / Developing, per candle column.** Every transform whose home is the coin's candle series
carries `bars`: `"closed"` is Confirmed — the newest bar completed at the strategy close — and
`"all"` is Developing, the higher-timeframe bar still in progress at that close, which REPAINTS until
it completes. Left unset a column reads Confirmed at every timeframe; Developing applies only where
you choose it. At or below the strategy timeframe a Developing choice sets only what the live lane
shows — no bar is in progress at the anchor's own close — so there it is legal and changes no decision
taken at that close. A condition reading a
developing bar is single-frame: its clause holds Once (a Developing column cannot be held), it
carries no verdict and it cannot be an exit rule. One exception overrides both the stored value and the default: a column reading a metric with
no live value (itself, or a `spread` operand) reads completed bars at every rung, because the forming
bar publishes nothing for it. A change (`chg5m` … `chg24h`, and `oiRegime`'s `1h` change) carries its
horizon in the metric, so above the strategy timeframe it is Developing at every rung and under every
selector. The resolved answer for a column is served on `effectiveParameters.bars`, and it states both
exceptions.

**A higher-timeframe candle-homed level is measured from that timeframe's own bar close.** The
distance to a `4h` Donchian band reads the `4h` bar's own close at every slot, the newest included, as
the `4h` chart reads it — so it changes once per `4h` bar, and the `levelInteraction` label on the same
level reads the same bar. `PRICE_ZONE` classifies its own bar's close the same way. A period level or a
mark (`PDH`, a session level, `MARK`) is measured from the current strategy-bar price, `LAST` — the
strategy bar's close under a decision, the last traded price on display — and an earlier bar's distance
to a period level from that bar's close against the level its own bar opened with. A breakout chain
(`rollingMax(n, offset 1) × distance`) reads each bar's own close against the rolling extreme, as the
distance to the catalogued `DONCHIAN_UPPER_PRIOR` does.

**The lane a strategy is deployed to.** The one report-level scalar family is the **session field**:
five scalars (`fieldPlayers`, `fieldUpBias`, `fieldBiasDir`, `captConc`, `picksSpread`, each headed
`<key>_session` under the `session-field` section) that describe a game session the agent is playing
in. **Radar runs outside one**, so a radar deployment whose strategy reads one is refused outright
(`CONDITION_OPERAND_UNSERVED_IN_LANE`): no report-level scalar is readable in that lane, so remove the
clause or bind the strategy to an agent in a lane that reads a session. Market breadth and the
stablecoin pegs are not scalars — they are columns of market- and pair-bound sections, read per bar in
every lane like any other column.

**What the radar scan can read on a coin.** Beyond the lane, a condition the radar acts on — a
required one, one carrying a verdict, an exit rule, and every condition they reference — must be
readable by the radar scan on each coin the radar acts on for the agent, or it would be decided unread.
What a coin can be read for is its market-data profile: the kinds of data the market-data service
publishes that it serves for that coin, never the coin's asset class. A refusal carries
`CONDITION_UNREADABLE_BY_RADAR_SCAN` with its `reachReason`: `INSTRUMENT` when the profile of the coin —
or of a benchmark section's own instrument — carries no such data, or the service publishes no profile
for it at all (spot-tape columns on a coin no spot venue lists, TradFi or crypto alike; any market-data
column on a ticker with no catalog row), `AGENT_TIMEFRAME` when the agent has no such rung on the
enabled ladder, and `FEED` when the radar scan never reads that data for the agent (crowd reads:
compose reads them, but only for a coin the scan has already admitted). An `INSTRUMENT` refusal names
the kind of data the profile lacks, or says the coin has no profile. The fixes it names: take the
condition's radar role away (neither required nor a verdict, or, for an exit rule, its exit role), read a column the radar
scan has on that coin, or free the coin.

**The refusal lands where an agent meets a coin**: at the radar deploy (its preview, the builder's
Save and the draft commit); at a manual entry request, as `CONDITION_UNREADABLE_ON_COIN`;
and, for an agent already deployed or holding a pending manual request, at a
strategy commit (`commit_strategy_draft`, the builder's Save, `restore_strategy`) or a rebind (the
agent draft's STRATEGY_BINDING commit). A commit is checked only on behalf of those agents: a
strategy carries no lane of its own, so one with no agent the radar acts on is never checked, and
the same strategy is legal, and reads session-field scalars correctly, on an arena agent. A draft
may hold such content — staging never refuses a draft for being invalid — but its commit is
refused, so it never reaches the agents.

**Exit rules.** A condition is an entry condition (`exitSide: null`) or an exit rule, never both.
An exit rule's `exitSide` names the side it closes — `LONG`, `SHORT` or `BOTH` — and it has two
effects: a settled TRUE on a completed bar closes the agent's open position on that side, and while it
reads TRUE that side is not offered for entry (a scan qualification or a compose refusal under
`CONDITION_EXIT_RULE_CLOSES_DIRECTION`, after any verdict refusal of the same side). No verdict chooses
the side: an exit rule carries `verdict: null` and `required: false` (`CONDITION_EXIT_RULE_CARRIES_VERDICT`,
`CONDITION_EXIT_RULE_REQUIRED`). An entry condition cannot reference an exit rule
(`CONDITION_ENTRY_REFERENCES_EXIT_RULE`), so editing an exit rule never changes what the agent enters;
an exit rule may reference anything, so "exit when the entry setup stops holding" is an exit rule
whose definition is `NOT` a `conditionRef` to the entry condition. An exit rule is legal only over a
closure every operand of which a completed bar MOVES (`CONDITION_EXIT_READ_ILLEGAL`), which rules out
a developing read — a bar in progress is the forming bar, and an exit fired on one is an intrabar
exit — and rules out a frame-inert operand, which could never fire. A position stamps the exit rules
it opened under, with the report and timeframes they read: an exit-rule edit applies to positions
opened after it, and an open position keeps the exit rules it opened with, so an open position never
refuses a commit or a rebind.

**A state column is not a flip event — `is` reads the state, `enters` reads the flip.** `ST_DIR`
reads the same on every bar of a trend, so `ST_DIR is "bullish"` is a regime filter and never an
entry signal. The flip is `ST_DIR enters "bullish"`: TRUE on the one completed bar the direction
turned, with no event column needed. The same distinction applies to every persisting
classification: `MAalign`, `ADX14_state`, `zone` — `is` for the regime, `enters` / `exits` for the
bar it changed.

**Name the anchor when a metric is calibrated for one.** `KC_SQUEEZE is "on"` reads *on* about 57% of
1h crypto bars even at canonical parameters — Bollinger σ is close-to-close while ATR captures
intrabar range, so σ/ATR runs low here — against about 19% at 15m. It is a selective filter at 15m and
below and close to useless at 1h. A metric whose selectivity depends on the anchor is stated with the
anchor, or the author gates on something that admits most bars.

## Bar geometry

What one bar did — against a price level, in its own shape, against the bar before it, and how many
bars ran one way. Every value here reads the bar's own open, high, low and close, so it is a candle
column: it takes a timeframe reference and the Confirmed / Developing selector like any other.

**`levelInteraction` — what the bar did at a level.** It classifies the newest bar of the column as
one of five labels: `touch_from_below`, `touch_from_above`, `reject_from_below`, `reject_from_above`,
`none`. The side is where the PRIOR close stood against the level IN FORCE WHEN THE BAR OPENED — from
below when it closed at or under it. For a level computed from its own bar (a band, `VWAP`, a moving
average, `ST_LINE`, `PSAR`, the Ichimoku conversion and base lines) that is the prior bar's level, so a
level that moved between the two bars is judged on the bar it stood at; for a level whose price was fixed
before the bar (a prior-bar Donchian rail, the break memory as of the bar before, a swing level, the displaced Ichimoku lines, a
prior-UTC-day or previous trading-session level or pivot) it is the bar's own level. A developing session
level (`TPO_POC`, `LONDON_HIGH`, an opening range, a single print, …) is read on a completed bar, as both
the side and the level, as it stood when the bar opened — the prior bar's reading in the same day or session
— so a bar that prints a new session high and closes above the old one reads `none` and
`dist_LONDON_HIGH crossesAbove 0` fires; on the day's or session's first bar no such level is in force and
the clause is unresolved. A live read's still-forming bar keeps the level as it stands at the read, the value
a chart shows, and takes its side from the level in force at the bar's open. From below: a bar that closes through the level is a break and reads `none`; a bar whose high
reached the level and whose close came back under it is `reject_from_below`; a bar whose high came
within the TOUCH tolerance of the level is `touch_from_below`. From above is the mirror on the low. A
close through the level in force reads `none` in either direction, a prior close exactly on the level
included — that bar is the `distance` crossing (Pine's `ta.crossover`: on or under the level before,
above it now).

- **A reject bar reports reject.** It is never also reported as a touch, so "touched or rejected" is
  an `in` clause over both labels of a side: `bbUpper20_lvl in ["touch_from_below","reject_from_below"]`.
- **The TOUCH tolerance is one knob, never two.** A column carries exactly one of `buffer` — whole
  basis points of the level, default `0` (exact contact); `buffer: 25` is 0.25%, header `<code>_lvl_b25`
  — or `touchAtr` — a multiple of the column rung's ATR14 at the prior bar, header `<code>_lvl_a<m>`
  (`touchAtr: 0.5` on `EMA20` is `EMA20_lvl_a0.5`) — never both. Only the touch reads it: a close through
  the level and a reject are decided before any tolerance, and a reject must pierce the level itself.
  Their ranges and steps are the served authoring parameters', read from the column contract. A
  `touchAtr` column reads `null` on a bar whose prior bar has no ATR14 yet. Two tolerances are two
  columns (`bbUpper20_lvl`, `bbUpper20_lvl_b25`).
- **A break is a crossing, never a label.** The break of a level is `distance` over the same level
  crossing 0: `dist_bbUpper20 crossesAbove 0` from below, `crossesBelow 0` from above. On the strategy's
  own rung a `…_from_below` label never holds on a bar where `crossesAbove 0` holds.
- **Which levels take it.**
  - **Offered:** a candle-homed level — a band (`BB_UPPER`, `BB_LOWER`, `KC_UPPER`, `KC_LOWER`),
    `VWAP`, a moving average (`SMA20`, `EMA20`, …), `ST_LINE`, `PSAR`, the prior-bar Donchian rails
    (`DONCHIAN_UPPER_PRIOR`, `DONCHIAN_LOWER_PRIOR`), the Donchian break memory as of the bar before
    (`DONCHIAN_BROKEN_HI_PRIOR`, `DONCHIAN_BROKEN_LO_PRIOR`, Pine's `brk[1]`), the Ichimoku lines, the swing levels (`SWING_FRACTAL_HIGH`,
    `SWING_FRACTAL_LOW`) — reads its own value at each bar. A prior-UTC-day level or pivot (`PDH`, `PDL`,
    `PDO`, `PIVOT_P`, `PRIOR_TPO_POC`, …), a previous trading-session level (`PRIOR_LONDON_HIGH`, …) and
    every developing session level — the developing day, week and month value area and point of control
    (`TPO_POC`, `TPO_VAH`, `WEEK_TPO_POC`, …), the current trading sessions' highs, lows and opens
    (`LONDON_HIGH`, `ASIA_OPEN`, …), the opening ranges, the initial balance and its extensions, and today's
    single prints (`TPO_SINGLE_PRINT_ABOVE`/`_BELOW`) — reads each bar's own snapshot of the profile, kept
    for the newest 24 strategy bars, so a clause over it can be held across them as any other clause: at
    12:00 on a `1h` strategy `LONDON_HIGH` reads London's high, and the bar before it read London's high as
    it stood then; a verb over a developing level reads it as it stood when its bar opened. A structure zone's edge
    (`ZONE_SUPPORT_HIGH` `zoneSupHi`, `ZONE_SUPPORT_LOW` `zoneSupLo`, `ZONE_RESIST_HIGH` `zoneResHi`,
    `ZONE_RESIST_LOW` `zoneResLo`), and its midpoint, `(high + low) / 2` — the FVG split, ICT's consequent
    encroachment (`ZONE_SUPPORT_MID` `zoneSupMid`, `ZONE_RESIST_MID` `zoneResMid`), at the strategy's anchor rung
    only, reads at each completed bar the nearest zone of the zones standing when that bar opened — so a zone first
    found from the bar's own data is not its level, and the zone its own close fills still is; the midpoint is always
    the zone its side's edges read. On `PSAR` a wick that
    trades through the SAR flips it on that bar, so a rejection needs the low (high) to meet the SAR
    exactly and a touch needs a tolerance; its flip is `dist_PSAR crossesAbove 0` / `crossesBelow 0`.
  - **Not offered:** the naked points of control and the naked single prints (`NAKED_POC_ABOVE`,
    `NAKED_POC_BELOW`, `NAKED_SINGLE_PRINT_ABOVE`, `NAKED_SINGLE_PRINT_BELOW`), each chosen as the nearest
    untested level beyond the bar's own close, so a close can never pass it — read the distance to it; and
    the same-bar Donchian rails (`DONCHIAN_UPPER`, `DONCHIAN_LOWER`), each the extreme of the window ending at the very bar it would
    classify, which a close can never pass — read `DONCHIAN_UPPER_PRIOR` / `DONCHIAN_LOWER_PRIOR`. The same rule refuses
    them under `distance`; the same-bar gap is `CLOSE × spread(DONCHIAN_UPPER)` (`close_donchianHi20_spread`), a
    number that is never above 0 and so never a breakout; and
    the Donchian break memory itself (`DONCHIAN_BROKEN_HI`, `DONCHIAN_BROKEN_LO`), which the bar's own close
    records or clears, so the bar it is broken or recovered on has no level in force at its open — read
    `DONCHIAN_BROKEN_HI_PRIOR` / `DONCHIAN_BROKEN_LO_PRIOR`, the memory as it stood after the bar before
    (`value` and `distance` over the memory stay offered). A
    price fact (`CLOSE`, `HLC3`, `MARK`) is refused: it is the price, not a level. Under `distance`, `CLOSE` and
    `LAST` are refused at every rung: a distance is measured from the bar's own close (the last price for a bundle
    level), so from either it is 0 on every bar.
- **A higher-rung level reads that rung's completed bar.** `bbUpper20_htf_lvl` classifies the last
  completed regime-rung bar from its own high, low and close, never the strategy bar's price — so
  compose its break on the same rung, `dist_bbUpper20_htf crossesAbove 0`.

**`pctB20` and `BB_UPPER × levelInteraction` answer different questions.** `pctB20` (`BB_PCT_B`) says
where the CLOSE sits in the envelope — `pctB20 lt 0.05` closed in the bottom 5%, `gt 0.95` in the top 5%, a
threshold, never a touch. `BB_UPPER × levelInteraction` says what the bar's RANGE did at the edge — touched it,
or pierced it and closed back.

**Candle patterns** — the bar's shape against the ten bars before it (TA-Lib's default settings). A
pattern carries no trend context: "a hammer in a downtrend" is `pin is "lower_wick"` plus a separate
trend clause.

| Key | Header | Labels |
|---|---|---|
| `CANDLE_DOJI` | `doji` | boolean: the body is at most a tenth of the average range |
| `CANDLE_PIN` | `pin` | `lower_wick`, `upper_wick`, `none` — a short body with one long wick |
| `CANDLE_ENGULFING` | `engulf` | `bullish`, `bearish`, `none` — the body engulfs the prior opposite body |
| `BAR_CONTAINMENT` | `barContain` | `inside`, `outside`, `none` — the range inside, or around, the prior range |

**Gaps** — the open against the bar before it, as three separate keys.

| Key | Header | Reads |
|---|---|---|
| `GAP` | `gap` | `up`, `down`, `none` — the open above the prior high, or below the prior low |
| `GAP_RANGE_CLEAR` | `gapClear` | `up`, `down`, `none` — the whole range clear of the prior range (stricter) |
| `GAP_PCT` | `gapPct` | the signed % from the prior close to the open |

**Runs** — report columns counting consecutive bars, capped at ±20. Gating "three closes in a row" is
the hold's job; a run column shows the streak.

| Key | Header | Counts |
|---|---|---|
| `CLOSE_RUN` | `closeRun` | consecutive closes above (+) or below (−) the close before |
| `CANDLE_RUN` | `candleRun` | consecutive candles of the newest bar's colour, white (+) or black (−) |

**Price sources** — per-bar price facts that take every transform a close takes: `HL2` (`hl2`,
median), `HLC3` (`hlc3`, typical), `OHLC4` (`ohlc4`, average).

**"Within the last N closed bars" is the hold `{ "atLeast": 1, "of": N }`.** A pattern or a gap held
within N reads each of the N bars against its own predecessor.

Recipes — the level recipes on candle-homed levels:

- **Price rejected the upper Bollinger band** — a `BB_UPPER × levelInteraction` column, header
  `bbUpper20_lvl`; the clause `bbUpper20_lvl is "reject_from_below"`.
- **Price touched or rejected VWAP from above** — `VWAP_lvl in ["touch_from_above","reject_from_above"]`,
  with `buffer: 10` for a touch within 0.1% (header `VWAP_lvl_b10`).
- **Price broke the 20 EMA** — `dist_EMA20 crossesAbove 0`, the `distance` column over the same level.
- **Touched the 20 EMA within half an ATR** — an `EMA20 × levelInteraction` column with `touchAtr: 0.5`,
  header `EMA20_lvl_a0.5`; the clause `EMA20_lvl_a0.5 in ["touch_from_above","reject_from_above"]`. The
  column carries `buffer` or `touchAtr`, never both.
- **Retested the broken 20-bar high and held** — a `DONCHIAN_BROKEN_HI_PRIOR × levelInteraction` column
  with `buffer: 20`, header `donchianBrkHiPrior20_lvl_b20`; the clause
  `donchianBrkHiPrior20_lvl_b20 in ["touch_from_above","reject_from_above"]`. The twin is the break that
  stood when the bar opened, so a bar whose own close records a newer break is still judged against the
  older one.
- **Failed breakout: lost the broken 20-bar high** — `dist_donchianBrkHiPrior20 crossesBelow 0`: the bar
  closed back under the break that stood when it opened; `dist_donchianBrkHiPrior20 lt 0` is the state.
  On that bar the memory itself (`donchianBrkHi20`) reads no value, because the close cleared it.
- **Price rejected the top of the support zone** — a `ZONE_SUPPORT_HIGH × levelInteraction` column,
  header `zoneSupHi_lvl`; the clause `zoneSupHi_lvl is "reject_from_above"`: the low pierced the nearest
  support zone's high and the close came back above it.
- **Price lost the support zone** — `dist_zoneSupLo crossesBelow 0`, the `distance` column over the zone's
  low: the close through its far edge, the close that fills the zone. A close exactly on the low is not.
  Author it on the `CONFIRMING_CLOSE` basis: on the `LIVE` basis the live price picks a zone it has not
  passed, so `dist_zoneSupLo` reads `0` or above and never crosses below.
- **Inside or near the support zone** — the nearest-zone distance reads `0` while price is inside the zone,
  so "inside or within 1% above the nearest support zone" is `zones_support_dist between 0 1`;
  `dist_zoneSupHi` is the signed distance to the zone's top and reads below `0` inside it.

Confirmation recipes — each composed from `distance` and the hold, never from a label:

- **Broke by at least X%** — `dist_EMA20 crossesAbove 0.5`: the close crossed 0.5% above the average.
- **Broke and held 3 closes** — `dist_EMA20 crossesAbove 0` holding `{ "atLeast": 1, "of": 3 }` AND
  `dist_EMA20 gt 0` holding `{ "atLeast": 3, "of": 3 }`: it crossed within the last 3 closes and closed
  above on all 3.
- **Above the level 3 closes in a row** — `dist_EMA20 gt 0` holding `{ "atLeast": 3, "of": 3 }` alone is a
  state, never "broke and held": it holds on every close of a run that began long before.
- **Rejected and closed back by X%** — `EMA20_lvl is "reject_from_below"` AND `dist_EMA20 lt -0.3`: the
  high pierced the average and the close came back at least 0.3% under it.
- **A bullish engulfing within the last 3 bars** — `engulf is "bullish"` holding
  `{ "atLeast": 1, "of": 3 }`.
- **An inside bar** — `barContain is "inside"`.
- **A gap up** — `gap is "up"`; `gapClear is "up"` when the whole range must clear.
- **A run of candles as a report column** — a `CANDLE_RUN` value column (`candleRun`) beside the
  thesis columns; no clause needed.
- **The 20-bar simple moving average of typical price** — `HLC3 × aggregate(20)` with
  `aggregate: "mean"`, header `hlc3_mean20`.

## Swing structure

Swing highs, swing lows and the structure they spell, from the market-data swing engine. At the default
pair every value is stored under the bar it describes, so a swing column holds and takes the prior-bar
operators like any candle column. Off it the server computes the swings over the column's own bars, and a
condition over the column reads one bar (*Off 2/2* below).

| Key | Header | Reads |
|---|---|---|
| `SWING_FRACTAL_HIGH` | `fractalHi` | the most recent swing high — a price level |
| `SWING_FRACTAL_LOW` | `fractalLo` | the most recent swing low — a price level |
| `SWING_FRACTAL_LABEL` | `fractalLabel` | `HH`, `HL`, `LH`, `LL`, `none` — the most recent swing against the one before it on its side |

**The rule.** A swing high is a bar whose high is at or above the highs of the `leftBars` bars before it
and strictly above the highs of the `rightBars` bars after it; a swing low mirrors it on the lows. The pair
is two each side by default (Pine's `ta.pivothigh(2, 2)`), and `ta.pivothigh(left, right)` at any other
pair. An equal extreme is allowed on the left and not on the right, so of a run of equal highs the newest is
the swing. A swing is published from the bar that completes its right side — `rightBars` bars after its
own — never earlier and never from a forming bar. Each level is held until the next swing on its side
replaces it.

- **The label is a held state, not an event.** It reads the most recent swing: `HH` / `LH` for a high
  (an equal high is `LH` — it failed to make a higher high), `HL` / `LL` for a low (an equal low is
  `HL`), `none` when no earlier swing on its side is in reach. On too short a history it reads nothing,
  and a clause over it reads FALSE.
- **A swing level does not remember a broken level.** The level steps to the next swing on its side as
  soon as one is decided, `rightBars` bars after that swing's own bar, so a retest of the BROKEN level is
  not a swing-level read.
- **The two levels take** `distance`, `spread`, `aggregate`, `trajectory`, `efficiency`, the
  statistics (`zscore`, `stddev`, `linregSlope`, `pctl`, `rollingMin`, `rollingMax`) and
  `levelInteraction`, and both rank across the board
  (`dist_fractalHi_rank_near`: the coins closest to their own last swing high). Off 2/2 they take
  `distance`, `spread`, `trajectory`, `efficiency` and `levelInteraction` only: `aggregate`, the
  statistics and `rank` read the stored 2/2 and refuse the pair. A transform's catalog entry serves
  `metricParametersAccepted`.
- **The break is the crossing toward the level.** `dist_fractalHi crossesAbove 0` is a close through the
  last swing high and never fires when the level steps onto a new swing, because the bar that confirms
  a swing high sits under it. The opposite crossing (`dist_fractalHi crossesBelow 0`, or
  `dist_fractalLo crossesAbove 0`) CAN fire on the bar the level steps past the close — it is not a
  break.
- **A swing confirmed on the break bar can already have moved the label**, so a structure condition
  paired with a break is held over the bars before it.
- **The pair is the column's knob**, `leftBars` / `rightBars` (2/2 by default; header `_l<left>r<right>`
  off it, `fractalLo_l21r21`). A pivot's age, `SWING_FRACTAL_LOW_BARS_AGO` (`fractalLoAgo`) and
  `SWING_FRACTAL_HIGH_BARS_AGO` (`fractalHiAgo`), reads the pair's `rightBars` on the bar that decides it,
  so on that bar the pivot bar is `rightBars` bars back: a candle pattern AT the swing is the pattern
  column at that offset, beside the age pinned to `rightBars` — the offset equals `rightBars` and changes
  with it. The pair reads `left + right + 1` bars to decide one pivot and must fit the readable depth
  (`strategy-authoring`'s knob rules hold the bound).
- **Off 2/2 a condition reads one bar.** Each bar of an off-default column needs the full readable depth
  behind it, so a condition over it admits:
  - no hold beyond one close (`CONDITION_HOLD_ILLEGAL`);
  - no **In order** step (`CONDITION_SEQUENCE_WINDOW_INVALID`);
  - no prior-bar operator: `crossesAbove`, `crossesBelow`, `increased`, `decreased`, `enters` and `exits`
    are refused with `CONDITION_OPERATOR_UNSUPPORTED`, which leaves `lt`, `lte`, `gte`, `gt`, `between`,
    `is` and `in`.

  So off 2/2 every reading is a state. The structure is `fractalLabel_l5r5 in ["HH","HL"]`. A swing decided
  on this bar is its age pinned to `rightBars`: `fractalHiAgo_l5r5 between 5 5`. The bullish break is the
  state `dist_fractalHi_l5r5 gt 0`: the close stands above the last 5/5 swing high, from the break until
  the close falls back or the level steps.

Recipes — the five structure reads are at the default pair; off it, read them through *Off 2/2* above:

- **The swing structure is bullish** — `fractalLabel in ["HH","HL"]`.
- **A higher high was confirmed on this bar** — `fractalHi increased` (it also catches a second
  higher high in a row, which `fractalLabel enters "HH"` cannot); `fractalHi decreased` is a lower
  high.
- **Bullish break of structure** — a `SWING_FRACTAL_HIGH × distance` column, header `dist_fractalHi`;
  the clause `dist_fractalHi crossesAbove 0`.
- **Bearish break of structure** — `dist_fractalLo crossesBelow 0`.
- **A break of the last swing low while the structure was bullish** — `dist_fractalLo crossesBelow 0`
  together with `fractalLabel in ["HH","HL"]` holding `{ "atLeast": 1, "of": 3 }`, so the bullish
  read may sit on the bars before the break.
- **A hammer at a 21/21 swing low** (LuxAlgo *Swing Highs/Lows & Candle Patterns*, length 21) —
  `fractalLoAgo_l21r21 between 21 21` AND `pin_o21 is "lower_wick"`; mirror with `fractalHiAgo_l21r21`
  and `upper_wick` at a swing high, and `engulf_o21` for an engulfing. The whole conditions are
  `references/recipes.md`, *Candle at a swing and liquidity-pool sweeps*.

## Market structure levels (LuxAlgo SMC)

The levels LuxAlgo's Smart Money Concepts v7.0 draws, at its own defaults unless a column sets a knob:
swing length 50, internal length 5 (fixed), equal-pivot length 3 (`equalBars`), equal threshold 0.1 ×
ATR(200) (`equalThreshold`), confluence filter off. A header carries only a knob off its default, so
the default columns read `structHi`, `iStructLo`, `eqhLvl`. The server computes them over the column's
own bars; nothing is stored, and none is ranked.

**A condition over a market-structure column reads one bar**, at every setting, defaults included, as over a swing
column off 2/2 (*Off 2/2* in `## Swing structure`, which names the refusal codes). Each bar needs the full readable
depth behind it, so a condition over one admits:
- no hold beyond one close;
- no **In order** step;
- no operator that reads the bar before: `crossesAbove`, `crossesBelow`, `increased`, `decreased`, `enters` and
  `exits` are refused.

Every reading in this section is therefore a state.

| Key | Header | Reads |
|---|---|---|
| `SWING_PENDING_HIGH` / `_LOW` | `structHi` / `structLo` | the swing high / low the next swing break is tested against — LuxAlgo's current level while no close has crossed it |
| `INTERNAL_PENDING_HIGH` / `_LOW` | `iStructHi` / `iStructLo` | the same on the internal structure (length 5) |
| `EQH_LEVEL` / `EQL_LEVEL` | `eqhLvl` / `eqlLvl` | the newer pivot of the latest equal-high / equal-low pair, held until the next equal-length pivot on its side |
| `SWING_STRUCTURE_LEVEL` | `structLvl` | the level the latest swing break crossed |
| `LIQUIDITY_POOL_ABOVE` / `_BELOW` | `poolAbove` / `poolBelow` | the nearest intact buyside pool above price / sellside pool below it — an equal-high / equal-low pair's newer pivot, kept until a close beyond it retires it, several at once |
| `LIQUIDITY_POOL_ABOVE_INTACT` / `LIQUIDITY_POOL_BELOW_INTACT` | `poolAboveOk` / `poolBelowOk` | false only on the bar whose close retires that pool |
| `LIQUIDITY_POOL_ABOVE_TOUCHES` / `LIQUIDITY_POOL_BELOW_TOUCHES` | `poolAboveTouch` / `poolBelowTouch` | the bars since that pool formed whose `levelInteraction` against it is a touch or a reject |
| `LIQUIDITY_POOL_ABOVE_RETIRED` / `LIQUIDITY_POOL_BELOW_RETIRED` | `poolAboveRetired` / `poolBelowRetired` | the pool the previous bar's close retired, read on the next bar only — a level the level verbs take |
| `LIQUIDITY_POOL_ABOVE_RECLAIMED` / `LIQUIDITY_POOL_BELOW_RECLAIMED` | `poolAboveRecl` / `poolBelowRecl` | true when this bar's close is back at or inside the pool the previous bar's close retired |

- **A pending level reads on the bar whose close crosses it**, and nothing from the next bar until a new
  pivot is recorded. So `dist_structHi gt 0` is true on that bar alone: every close through the pending swing
  high, the bar LuxAlgo marks BOS or CHoCH. The state is the crossing. It also reads the first, anchoring break,
  which `structEvt` leaves untagged because its tag depends on a bias the column's bars have not yet proven.
- **An internal crossing LuxAlgo does not count stays pending**: where the internal level is the swing
  level's own price, or the confluence filter refuses the bar, the close goes through and the internal
  level still reads, so `dist_iStructHi` reads above 0 while the close stays through it, and the internal
  event does not fire.
- **No close retires an equal-pivot level** — LuxAlgo tests no break on equal highs. A sweep is its REJECT
  (`eqhLvl_lvl is "reject_from_below"`). A close through it is the state `dist_eqhLvl gt 0`, which holds while
  the close stays above, not the crossing bar alone.
- **A close beyond a liquidity pool retires it** (LuxAlgo Liquidity Swings): the pool still reads on that
  bar, and from the next bar `poolAbove` reads the next pool out. A pool's sweep takes two forms: on one
  candle its REJECT, and over two candles the close beyond followed by a close back, which the next bar
  reads through the retired pool — `poolAboveRetired` (the pool the last close took, on that bar only)
  and `poolAboveRecl` (this close is back at or under it).

| Recipe | Column | Header |
|---|---|---|
| Distance to the pending swing high | `{ "metric": "SWING_PENDING_HIGH", "transformId": "distance", "timeframe": { "rel": "anchor" } }` | `dist_structHi` |
| Rejection at the pending swing high | `{ "metric": "SWING_PENDING_HIGH", "transformId": "levelInteraction", "timeframe": { "rel": "anchor" } }` | `structHi_lvl` |
| Sweep of the equal highs | `{ "metric": "EQH_LEVEL", "transformId": "levelInteraction", "timeframe": { "rel": "anchor" } }` | `eqhLvl_lvl` |
| Sweep of the buyside liquidity pool | `{ "metric": "LIQUIDITY_POOL_ABOVE", "transformId": "levelInteraction", "timeframe": { "rel": "anchor" } }` | `poolAbove_lvl` |
| Close back under the buyside pool the last bar retired | `{ "metric": "LIQUIDITY_POOL_ABOVE_RECLAIMED", "transformId": "value", "timeframe": { "rel": "anchor" } }` | `poolAboveRecl` |
| Distance to the pending internal low | `{ "metric": "INTERNAL_PENDING_LOW", "transformId": "distance", "timeframe": { "rel": "anchor" } }` | `dist_iStructLo` |
| A swing length of 20 | `{ "metric": "SWING_PENDING_HIGH", "transformId": "distance", "timeframe": { "rel": "anchor" }, "swingLength": 20 }` | `dist_structHi_s20` |

- **Approaching the swing high** — `dist_structHi gt -0.5` AND `dist_structHi lt 0` (Pine
  `close < hi and close > hi * 0.995`).
- **Swing break of structure** — `dist_structHi gt 0` (Pine `ta.crossover(close, hi)`, LuxAlgo's break
  test). The pending high reads on the break bar only, so this state is the crossing. Pair it with
  `structEvt is "BOS↑"` to drop the anchoring break and a CHoCH.
- **Swept the equal highs and closed back** — `eqhLvl_lvl is "reject_from_below"` (Pine
  `close[1] <= eqh and high >= eqh and close < eqh`).
- **Swept the buyside liquidity pool and closed back** — `poolAbove_lvl is "reject_from_below"`; the
  sellside sweep is `poolBelow_lvl is "reject_from_above"`. On the same or the next candle it is an `ANY`
  of that clause and `poolAboveRecl is "true"` (sellside `poolBelowRecl`). The whole conditions are
  `references/recipes.md`, *Candle at a swing and liquidity-pool sweeps*.

## Entry

`{ trigger, levelOffsetAtrMultiple, validForBars, levels }` — the axis's keys, and the trigger decides
which of them you send. `ON_CANDLE_CLOSE` is sent ALONE, as `{ "trigger": "ON_CANDLE_CLOSE" }`: a
`levelOffsetAtrMultiple`, `validForBars` or `levels` beside it is refused as an unrecognized key. A level
trigger — `STOP_THROUGH_LEVEL` or `ON_RETEST` — sends all three, no defaults. The axis is staged
WHOLE, so a level trigger missing one is refused rather than half-kept. It is not required on every
CREATE: a CREATE that stages no entry takes the platform's seed entry, so stage it whenever the
setup names one. There is no confirm-timeframe key: the bar whose close decides an entry is the
strategy's OWN timeframe.

**A level trigger names its level, once per trade direction.** `levels` is `{ "LONG": <level>,
"SHORT": <level> }`, each a level reference — `{ "metric": "DONCHIAN_UPPER", "timeframe": { "rel": "anchor" }, "bars": null, "offset": 0, "knobs": {}, "windowExtreme": null }` — naming a price level a section
of the evaluated coin yields: the same levels a condition's level reference reads, at the column's own timeframe,
`bars`, `offset` and knobs, or the extreme of a `rollingMax` / `rollingMin` window (`windowExtreme`). The two
directions are authored separately and never mirrored, so an asymmetric strategy is native. A level the report does
not yield is refused at save, naming `entry.levels.LONG` or `entry.levels.SHORT`; add a column that reads it, or choose
one the report has.

**Every trigger is decided at the close of the strategy's own bar — there are three, and the close
is the only entry clock.** The newest completed bar is read on the closed basis — every one-close
condition resolves on that bar and the gates read its close — and a reading that still qualifies
fires at that close. A bar that does not qualify decides nothing and is not revisited. The fill lands
at the next tick, and the platform refuses it if the market has already run past its own drift budget
from that close. A fourth value, `AT_SIGNAL`, is readable on strategies authored before this contract
and is REFUSED on every stage and save; there is no live-reading entry to author.

- `ON_CANDLE_CLOSE` — the entry is taken AT the qualifying close, at market.
- `STOP_THROUGH_LEVEL` — at the qualifying close a TRIGGER order rests past the direction's level, read on that
  bar, by the offset (a breakout: the 20-bar high `DONCHIAN_UPPER` for a long, the 20-bar low `DONCHIAN_LOWER` for a
  short), and the exchange book is the watcher; the entry is taken when price trades through, not when the platform
  notices. The level must sit beyond the mark in the trade's direction.
- `ON_RETEST` — at the qualifying close a LIMIT order rests in front of the direction's level by the offset, waiting
  for a return to it (a pullback: the broken 20-bar high `DONCHIAN_BROKEN_HI` for a long, the broken low
  `DONCHIAN_BROKEN_LO` for a short). The level must sit behind the mark. Not filling is a correct outcome, not a
  failure.

Either way a level with no reading on the decided bar, or on the wrong side of the mark, is no setup — refused with
its stage, never substituted by another level. The entry price is fixed at the decision: a level that moves while the
order waits does not move the order.

**A multi-bar hold belongs to the CLAUSE (or group) that needs it.** Declare that clause's own
`hold` — "3 closes in a row", "within 5 closes" — the entry axis counts no bars, and there is no displacement band: the
platform's entry-deviation gate measures the live mark against the decided close and refuses a fill
that drifted past the budget in either direction.

`levelOffsetAtrMultiple` (0–2) is an UNSIGNED distance from the named level in ATR multiples — a
long adds it, a short subtracts it, so a breakout stop rests past its edge and a pullback limit
rests in front of its edge, and a signed value would invert the trigger's meaning. `validForBars`
(1–24) denominates validity in the strategy's OWN bars rather than minutes, because a 1h setup
waiting for a retest has not failed after fifteen minutes. The resting price must sit on the
correct side of the mark when the order is placed — a buy stop above it, a buy limit below it, the
mirror for a sell — or the entry is refused rather than filled at the market; there is no limit on
how far from the mark a level may rest.

**The trigger decides the shape, so there is no inert dial to leave.** Under `ON_CANDLE_CLOSE` the
two parameters and the levels do not exist on the input — the server stores its seed values for the parameters and
no level — while a read (`get_strategy`) still shows all four keys, `levels` as `null`. Switching a level trigger back
to `ON_CANDLE_CLOSE` is staging `{ "trigger": "ON_CANDLE_CLOSE" }` alone; never copy the read's parameters back
beside it.

## Report sections

`{ kind, sectionKey, title, benchmarkTicker, marketScope, notes, columns }` — the custom section
shape. A section carries no `timeframe`: its relative columns resolve against the strategy timeframe,
and a column reaches any other timeframe by pinning it (`timeframe: { abs: '4h' }`).
`benchmarkTicker`, `marketScope` and `notes` are **required-nullable**: send an explicit `null` rather
than omitting them, because the section is rebuilt whole on save and an omitted key clears the
author's value silently. On a CREATE, omit `sectionKey` — it is derived from the section itself.

**A section reads one subject**, named by its two subject keys — at most one of them set:

- both `null` — the coin under evaluation, one row per coin;
- `benchmarkTicker` — one bound instrument on every row: a roster coin (`"BTC"`, any spelling the
  coin resolves from), or a declared stablecoin pair, `"USDT_USD"` (USDT against USD) or
  `"USDC_USDT"` (USDC against USDT), spelled exactly as declared;
- `marketScope` — the market at one breadth scope (`all`, `crypto`, `l1`, `memes`, `defi`,
  `tradfi`, `stocks`, `indices`, `commodities`), one row for the whole field. Two scopes are two
  sections.

What a section may hold follows its subject, and the save refuses anything else
(`REPORT_COLUMN_SUBJECT_METRIC_UNSUPPORTED`, naming the `subjectKind` and the `metric`). A pair-bound
section reads `OPEN`, `HIGH`, `LOW`, `CLOSE` and `PAR_DEV` — the close's signed % from its par —
and a market section reads the `market` family (`MKT_NET` → `mktBreadth`, `MKT_ABOVE_EMA` →
`mktAboveEma`, and the rest); a coin section, evaluated or bound, reads neither. Read each metric's
`subjectKinds` from `get_metric_construction_hints` rather than this list. Neither a pair nor the
market takes a cross-coin `rank`; a market column takes no `relativeTo`, and a pair column's
`relativeTo` names the other declared pair and has no `BTC` default. Market and pair columns are
series from the moment the platform began recording them: every series transform, timeframe and
hold applies, and a window reaching before the first recorded bar reads absent. Headers carry no subject
token (`mktBreadth`, `mktBreadth_htf`, `parDev_zone`), so the section is what says whose reading a
header is. Worked sections and conditions: `references/recipes.md`, *Market and stablecoin subjects*.

## Trade levels

`{ minStopLossAtrMultiple, maxStopLossAtrMultiple, minRiskRewardRatio, minAtrPct, tradeLevelMenu }` — where stops
and targets may sit, which stops and targets the agent may choose from, and how much a coin must move before it is
worth trading at all. `minStopLossAtrMultiple < maxStopLossAtrMultiple` (≤ the 5×ATR structural cap),
`minRiskRewardRatio` within the served range. `minAtrPct` is the ATR floor: a coin whose ATR% sits below it is refused
(`ATR_VOLATILITY_BELOW_MIN`) before any condition is read, with bounds from
`get_trading_config_catalog`; it is multiplied with `maxStopLossAtrMultiple` in the capital check, so
a high floor with a wide stop needs more capital per trade. The axis is staged whole — all five keys.
Sizing is risk-budget based — a wider stop means a smaller position, never more risk.

**The menu: the author lists the options, the agent picks a pair.** `tradeLevelMenu` is `{ "LONG": { stops, targets },
"SHORT": { stops, targets } }` — each direction authored on its own, never mirrored, each list 1–8 options. Every ATR
below is the strategy timeframe's.

- A **stop** option is one of `{ "kind": "ATR", "atrMultiple": m }` (0 < m ≤ 5), `{ "kind": "LEVEL", "level": <level
  reference>, "bufferAtrMultiple": b }` (0 ≤ b ≤ 5: the stop sits b × ATR beyond the level on the loss side), or
  `{ "kind": "PERCENT", "percent": p }` (0 < p < 100, a fixed percent from entry).
- A **target** option is `{ "kind": "R_MULTIPLE", "multiple": r }` (0 < r ≤ 10) or `{ "kind": "LEVEL", "level": <level
  reference> }`.

A level reference is the same shape the entry axis names, and must be a level the report yields. At each decision the
platform pairs every stop with every target, prices them on the decided bar, and drops a pair whose stop is not on
the loss side of entry or whose target is not on the profit side, a stop tighter than `minStopLossAtrMultiple` or wider
than `maxStopLossAtrMultiple` (or the 5×ATR cap), and a level target whose reward is under `minRiskRewardRatio`. A
level with no reading on the bar drops its options; nothing is stretched or substituted. Pairs that land on the same
two prices are one setup naming every option that made it. The agent chooses one setup; a one-option list is a fixed
choice.

**R is the pair's own risk.** An `R_MULTIPLE` target sits `r × |entry − stop|` from entry for the stop it is paired
with, so 2R beside a 2×ATR stop is twice as far as 2R beside a 1×ATR stop. Its reward is exactly r, so the save refuses
an R option below `minRiskRewardRatio` (it could never trade) rather than dropping it per trade.

**What the save refuses, per direction** (each naming its field): a list outside 1–8 options; an option outside its
bounds; a level the report does not yield; an R target below `minRiskRewardRatio`; a target level that is the
direction's entry level (no reward); and one level in both the stop and the target list. The entry level may also be a
stop. A CREATE that stages no menu opens with the seed — stops ATR 1× / 1.5× / 2× plus the Donchian edge and Bollinger
band on the loss side, targets 1.5R / 2R / 3R (those at or above the minimum) plus the Donchian edge and Bollinger band
on the profit side, never a target at its own entry level — keeping only the levels its report yields.

## Position management

`{ breakEvenEnabled, breakEvenTriggerR, trailingEnabled, trailingTriggerR, trailingGivebackPct,
trailingBufferPct, timeDecayEnabled, timeDecayGracePeriodMinutes, timeDecayIntervalMinutes,
timeDecayTightenPct, timeDecayMaxTightenPct, timeDecayStaleThresholdTpProgressPct,
decisionInvalidationExitEnabled }` — how the stop moves after entry, and when a position is
closed for reasons other than its stop. The policy is stamped on each position when it opens: an
edit applies to positions opened after it, and an open position keeps the policy it opened with.

Validated bounds: break-even trigger 0.5–2R step 0.01; trailing trigger 0–2R step 0.01 (0 = trail
from entry), giveback 25–55% step 1, buffer 0.01–1% step 0.01; timeDecay grace 5–1440 min step 5,
interval 5–480 min step 5, grace ≥ interval while time decay is armed, tighten 0.5–50% step 0.5,
max tighten 1–100% step 1, stale threshold 0–100% of TP progress step 1. Per-mechanism flags; no
umbrella switch.

`decisionInvalidationExitEnabled` is the post-fill invalidation exit: a **closed**
strategy-timeframe candle beyond the decision's invalidation level closes the position
reduce-only. Bar-close only — the protective stop still owns intrabar moves.

Persona presets: scalper (5m/15m) stops 0.5–1.2 ATR, RR 1.5, BE 0.7R, trail 0.9R/giveback 30,
timeDecay ON (45/15, tighten 15→60, stale 30) · intraday mean-revert (1h) 1.0–2.5 ATR, RR 1.5,
BE 0.8R, no trail, timeDecay ON (120/60, 10→40, stale 25) · swing breakout (4h) 0.75–1.75 ATR,
RR 2, BE 1R, trail 1.2R/giveback 35 · swing trend (4h) 1.0–2.5 ATR, RR 2, BE 1R, trail
1.5R/giveback 45–55, no timeDecay.

## Not expressible — the catalog keys this needs

The one place a claim that the catalog LACKS something may live, and every row names the key it
denies so the claim can be checked. A claim about the grammar's shape (a clause compares one
column with a literal or with its own previous completed bar, never with another column; `distance`
rejects an `offset`) belongs in prose above — those are permanent. A claim that a metric is absent belongs here, or nowhere.

| Script / primitive | Key the catalog would need | Nearest expressible neighbour |
|---|---|---|
| 100-period SMA | `SMA100` | close against it is exact: `CLOSE × spread` against the averaged operand `{ "metric": "CLOSE", "transformId": "aggregate", "window": 100 }` (`close_close_mean100_spread`) is (close − `ta.sma(close, 100)`) ÷ that average × 100 per bar, so `gt 0` is close above it, `lt 0` close below it, `crossesAbove 0` / `crossesBelow 0` the cross, and the value itself the percent gap. `CLOSE × aggregate` at window 100 (`close_mean100`) is the average's own value (`close_mean100 increased` is a rising average). Only `levelInteraction` against it — a touch or reject of the average as a level — uses the shipped 50- or 200-period simple average, whichever the thesis leans on |

## Where the worked material lives

This skill's body is the contract — the axes, the header grammar, how conditions and trade levels behave,
and the absence section above. The worked material is disclosed on demand, so it costs nothing until
you ask for it. Read a reference with `read_skill_reference` when you reach the work it covers:

- **`references/recipes.md`** — copy-adaptable column objects and condition fragments: cross
  detection, recency and structure, a candle pattern at a swing and the sweep of a liquidity pool on one or two candles,
  board-relative ranks, cross-venue basis, crowd positioning, the market-regime and
  stablecoin-peg sections, coin selection, and the discovery fields worth reading before you
  compose.
- **`references/playbooks.md`** — five validated desk-grade compositions end to end, and how to
  adapt one rather than copy it.
- **`references/tradingview-ports.md`** — per-script port recipes for the popular TradingView
  strategies, each naming its substitutions where the catalog lacks a primitive.

Every rule about how a column *behaves* is in this body, not in a reference. If a reference seems to
state one, the body is the authority.
