# Figures a finding may cite

A finding names exactly one figure id from this list — the submit refuses any other. Each row says which read
serves the figure, where in that read's output it sits, its unit, and how its value and population go into the
finding. The owner's card renders each id through its own label and unit, so your `statement` carries the
words and the figure carries the number.

## How a finding carries a figure

A finding is `{ figureId, slice, value, statement }`:

- **`slice`** — the slice the figure was read over, or null for the agent's whole window:
  `{ kind: 'REGIME', regime }` (a regime row's key — a regime, `UNAVAILABLE` or `ABSENT`),
  `{ kind: 'HOUR', hourUtc }`, `{ kind: 'WEEKDAY', weekday }`, `{ kind: 'COIN', coinTicker }`, or
  `{ kind: 'CONDITION', conditionKey, conditionName }`, each copied from the row it was read from.
- **`value`** — `{ readiness: 'READY', sampleSize, value }`, or `{ readiness: 'INSUFFICIENT_DATA', sampleSize }`
  copied from a figure that reads `INSUFFICIENT_DATA`. A count or a sum is an observation and always `READY`.
- **`statement`** — one sentence naming the value and its population in display words: "won 4 of 19 closed
  trades in Bear Ranging (21.1%)", "too few closed trades on Saturdays to report a rate (3)".

The outputs are `{ analytics }` for `get_agent_review_analytics`, `{ quality }` for
`get_agent_decision_quality`, `{ economics }` for `get_agent_cost_economics`, `{ stats }` for
`get_agent_entry_discipline`, and `{ calibration }` for `get_agent_conviction_calibration`. In the review read,
`figures` below means `analytics.overall` for the whole window, or a slice row's `figures` — `regime[]`,
`hourOfDay[]`, `weekday[]` or `coin[]` — for that slice.

## The figures

### Volume

- **`DECISIONS_EVALUATED`** — `figures.decisions`. Count of decisions. `sampleSize` is the count itself.
- **`CLOSED_TRADES`** — `figures.closedTrades`. Count of closed trades. `sampleSize` is the count itself.
- **`FORCED_EXITS`** — `figures.forcedExitCount`. Count of closes the Decision Quality band counts as forced
  exits. `sampleSize` is the slice's `closedTrades`.

### Result

- **`WIN_RATE`** — `figures.winRate`: `ratePercent` when `READY`, in percent; its `sampleSize` is the closed
  trades. State it with `figures.winningTrades` of `figures.closedTrades`.
- **`REALIZED_NET_USD`** — `figures.realizedNetUsd`, USD, signed: the sum of the closed trades' recorded net.
  `sampleSize` is `figures.closedTrades`.
- **`REALIZED_FEES_USD`** — a coin row's `feesUsd`, or `analytics.llm.feesUsd` for the whole window, USD.
  `sampleSize` is that row's `closedTrades`.

### Exits

- **`PREMATURE_STOP_RATE`** — `figures.prematureStop`, or `quality.exitQuality.prematureStop` for the whole
  window: `prematureStopRatePercent` when `READY`, in percent, with `prematureStopCount` of `sampleSize` stop-outs
  that were `STOPPED_EARLY` ("Stopped Early" — the original target printed within 24h of the stop).
- **`POST_EXIT_MEAN_RETURN`** — `quality.exitQuality.postExit`: `meanSignedReturnPct` when `READY`, percent,
  direction-signed — the mean move in the trade's favour over the 24 hours after the exit. Positive means price
  kept going the trade's way after it closed.
- **`MEDIAN_EXIT_EFFICIENCY`** — `quality.exitEfficiency.medianEfficiencyPercent`: `median` when `READY`, in
  percent of the in-trade favourable move the exit kept.
- **`MEDIAN_MAE_R`** — `quality.exitEfficiency.medianMaeR`: `median` when `READY`, in R — how far against the
  trade price went before the exit, in units of the initial risk.

### Entries

- **`ENTER_MEAN_RETURN`** — the `enter` cell of one `filterValue[]` row (in `quality.filterValue`, or a slice's
  `figures.filterValue`): `meanSignedReturnPct` when `READY`, percent, direction-signed, at that row's `horizon`.
  The statement names the horizon.
- **`SKIP_MEAN_RETURN`** — the `skip` cell of the same row, the same way. A positive skip return is a recorded
  forward move the agent did not take — a mark, never money it lost.
- **`CONFIRMATION_TAX_USD`** — `stats.confirmationTax.totalUsd`, USD, signed (positive is an adverse fill against
  the decided price). `sampleSize` is `stats.confirmationTax.measuredEntries`. Not citable while `totalUsd` is null.

### Conditions

- **`CONDITION_CITATIONS_ON_LOSERS`** — in a `condition[]` row, the `LOST` count of one `cells[]` entry; the
  statement names the cell's verdict (Confirm, Warn, Reject). `sampleSize` is the row's `citations`. The slice is
  `{ kind: 'CONDITION', conditionKey, conditionName }` from the row — name the condition by `conditionName`.
- **`CONDITION_CITATIONS_ON_WINNERS`** — the `WON` count of one cell of the same row, the same way.

### Costs

- **`COST_ERODED_TRADES`** — `economics.costErodedCount`: winners before costs that costs turned into losses.
  `sampleSize` is `economics.totals.positionCount`.
- **`FEES_PERCENT_OF_GROSS`** — `economics.totals.feesPercentOfGross`, or one close outcome row's, in percent.
  `sampleSize` is that row's `positionCount`. Not citable while it is null (gross at or below zero) — cite
  `REALIZED_FEES_USD` instead.
- **`LLM_PLATFORM_SPEND_USD`** — `analytics.llm.platformSpendUsd`, USD, the platform-billed model spend over the
  window. `sampleSize` is `analytics.llm.calls`. BYOK spend (`byokSpendUsd`) is reported in the statement when
  non-zero, never subtracted.
- **`NET_AFTER_LLM_USD`** — `analytics.llm.netAfterLlmUsd`, USD, signed: realized net after platform model spend.
  `sampleSize` is `analytics.llm.decisions`.

### Conviction and rails

- **`CALIBRATION_GAP`** — two bands of one `calibration.slices[]` entry, both `READY`: the value is the higher
  conviction band's `winRatePercent` less the lower band's, in percentage points, and `sampleSize` is the smaller
  of the two bands' samples. The statement names both bands and both served rates. While either band reads
  `INSUFFICIENT_DATA`, cite that band's sample instead.
- **`RAIL_REFUSALS`** — one `analytics.railRefusals[]` row's `count`, a count of entries a rail refused, named in
  the statement by the row's reason through its display name (daily trade limit reached, exposure budget
  exhausted, agent halted, insufficient equity). `sampleSize` is the count itself. The current halt is
  `analytics.halt`: name its `haltReason` through its display name beside the refusals.

## Display vocabulary

- Regimes by display name: Bull Expansion, Bear Expansion, Bull Ranging, Bear Ranging, Contraction, Volatile,
  Unclassified; `UNAVAILABLE` is "No regime" (a cold regime context was recorded) and `ABSENT` is "Not recorded".
- Weekdays and hours in UTC, said as such ("Thursdays, UTC", "23:00 UTC").
- Verdicts, close outcomes and halt reasons by their display names, never the stored code.
- Percentages to one decimal, USD to cents, R to two decimals — as served, never re-rounded into a different claim.
