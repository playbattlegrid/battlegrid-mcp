---
name: battlegrid-trade-proposal
description: Find a trade for one of the player's agents and, on the player's consent, queue it to execute at the agent's next strategy-bar close. Activate whenever the player asks which coins fit an agent right now, which of their agents fits a coin, wants a trade found or placed for an agent or on a coin, or asks the agent to evaluate a coin. The scans are the agents' own gates — one agent over every active coin, or one coin over every one of the player's agents; a queued request is decided at the agent's next strategy-bar close, and a qualifying close places the agent's entry at once with no further step; consent is always the player's word, given before the request is queued.
---

# Trade Proposal

You are finding a trade for an agent the player configured and, once the player consents, queueing
it. Every step below reads what the server decided and puts it to the player in their terms;
nothing here re-sorts a list, re-derives a verdict, or queues on the player's behalf without their
word. No decision waits for the player afterwards: consent comes before the queue, and a qualifying
close executes.

## 0. What is already held — before anything else

- `list_user_active_positions` first, every time.
- A queued request holds the player's request slot for that coin, and a placing or live position its
  position slot, across **all** their agents. **Never queue on a coin the player already holds a
  live position on** — say why, and name the position that holds it.

## 1. When the player names a coin and not an agent — choose the agent

- `scan_coin_agents` for the coin. The rows arrive server-ranked across the player's own agents:
  `qualified` first, then `rejected` with the first failing gate, then `unscorable` with the
  reason, then `ineligible` with the refusal `propose_entry_decision` would give (`AGENT_NOT_ACTIVE`,
  `MODEL_INACTIVE`, `AGENT_HALTED`). Read them **as written** — never re-sort or re-derive a verdict.
- **Ask the top-ranked qualifying agent**, and name the other agents that qualified so the player can
  choose one of them instead. One request per coin: the platform holds one pending request per coin
  across all of the player's agents, so ask one agent, not each of them.
- **When none qualifies, say so plainly.** Name each agent's blocking gate or ineligibility, and offer
  the strategy doctor for the one whose blocking gate is the one to work on. Never propose through an agent the scan
  reports rejected, unscorable or ineligible.
- **When the player has no agent at all**, the scan is empty: say so, and the next step is building one
  (a strategy first, when they have none).
- A refused scan (`RATE_LIMITED`) is a refusal with its retry-after, never "nothing fits".

## 2. Which coins fit the agent right now

- `scan_agent_coins` for the agent. The rows arrive server-ranked: qualifying coins first by ticker,
  then the rest with their first failing gate, then coins that could not be evaluated, with the reason.
  The scan reads the agent's gates and spends no LLM call.
- Read the rows **as written**: the rank, the verdict, the first failing gate, the unscorable
  label. Never re-sort them and never re-derive a verdict from its numbers — the server's ranking
  is the answer.
- The scan is the **ranking** answer, not the full gate detail. For one shortlisted coin's
  per-direction and per-gate breakdown — candidate levels, every gate's own reading, the ATR
  corridor — call `get_agent_coin_qualification` on up to 12 tickers. Never re-scan for it.
- A refused scan (`RATE_LIMITED`) is a refusal: say the scan was refused and when it can be retried
  (`retryAfterSeconds`). Never say "nothing fits".

## 3. Confirm, then queue the request

- **Confirm with the player before queueing.** Name the agent, the coin and the bar it will be
  decided on, and say that a qualifying close places the agent's entry at once, sized by the agent's
  own risk budget, with no further step. Ask, and queue only on their yes.
- **The player's own words can already be the consent.** "Trade SOL with Atlas at its next close" is
  consent: queue without asking again. So is a standing instruction the player gave you to trade for
  them. Interest is not consent — "what fits SOL right now?" is a question, so report the fit and ask
  whether to trade it.
- `propose_entry_decision` **only** on that consent, and only on the coins the player named, or on
  the top qualifying row when they asked for the best fit. One coin per call.
- **The call does not decide.** It registers a request against the agent's next strategy-bar close
  and returns immediately; no model runs and nothing is spent. The agent reads that bar on its
  settled close, through the same path its radar deployments use.
- `userMessage` is the player's own words for the turn; it is recorded in the conversation and read
  by no model. Mint a **fresh UUID** `idempotencyKey` per request; a retry with the same key replays
  the recorded result and never registers a second one.
- **One pending request per coin.** A second is refused with `CONFLICT` / `REQUEST_PENDING` — read
  the one that exists with `get_entry_request` rather than asking again.

## 4. Tell the player what they are waiting for

- `type: "queued"` is the normal answer. Read `request` back to them: the bar being decided
  (`barStart`), when the answer is due (`decidesBy`), and the deadline past which that bar can no
  longer be decided (`windowEndsAt`). `decidesBy` and `windowEndsAt` are different instants — a bar
  that has already settled is decided at the next sweep, seconds away.
- Say where the answer will appear: on the delegation card in this conversation. Nothing further is
  needed from the player; the card carries the answer to them when the bar closes, and a qualifying
  close's entry is already being placed by then.
- When the player asks what the agent decided, read the request's conversation with
  `get_trade_conversation({ conversationId })`, using the id the `queued` result carried. It serves
  the whole transcript in stored order — the queued card, the agent's reasoning, its thesis and
  setups, the entry card naming the decision and the position it placed, a no-trade with its reason
  and next coins, or a close answer.
- When the player asks about an earlier request and its `conversationId` is not in this
  conversation, find it with `list_trade_conversations`: narrow by the agent's `agentId`, and by
  `window` (or `since` / `until`) when the player names a period. Open the matching row with
  `get_trade_conversation`, passing the row's `id` as `conversationId`. Never queue a new request to
  learn what an earlier one decided.
- `get_entry_request` re-reads a request until it is answered — including while its close has fired
  and the decision is being composed, and past its deadline until its overdue answer lands.
  `cancel_entry_request` withdraws it only while it still awaits its close; once the close has fired
  it is `NOT_FOUND`, and the answer arrives in the conversation. Both are `NOT_FOUND` once it has
  been answered or cancelled, and that is the honest record: the answer is in the conversation.
- `type: "error"` — the block, with its remedy: `OPEN_POSITION_CONFLICT` means a position already
  holds the slot (see step 0) and nothing was queued; `LLM_CREDITS_EXHAUSTED` means top up when
  `topupAvailable` is true; `ENTRIES_PAUSED` means the platform has paused new entries while market
  data is missing across many coins, and nothing was queued. The pause is platform-wide, not the
  agent's or the coin's, so never retry it through another agent or on another coin. It lifts by
  itself once the data is back: ask again then, under a fresh `idempotencyKey` — the same key only
  replays this refusal. A refused request (`RATE_LIMITED`) is a refusal with its retry-after.
  Never "nothing to do".

## 5. When the answer arrives — report it

Every request that is not withdrawn is answered exactly once, in the conversation.

- A decided close produces one of: an **entry** — the thesis, the setups and the entry card naming
  the decision and the position it placed, which is already executing; a no-trade with the reason
  and the next coins worth asking about; a refusal, `close_refused`, which names the gate that failed
  when the close did not qualify and none when it qualified and the radar's own gates stopped its
  fire; `close_missed`, naming the bar, when its window passed with no sweep; a bar the agent's own
  radar deployment decided first; or an error carrying the engine's block, with nothing entered,
  when admission refused the qualifying close's fire — `ENTRIES_PAUSED` while new entries are
  paused, an account block, a halted agent, a position already held — or `EVALUATION_FAULTED` when
  the decision that fired did not finish.
- A bar the agent's own radar deployment decided first is reported from that deployment's decision,
  never decided again. It arrives as `close_fired_by_radar` — a trade taken in full — only when the
  deployment's fire enqueued a trade decision. Otherwise it arrives as what stopped that fire, and
  none of these is a trade: a fire admission refused arrives as the engine's block, exactly as when
  the refused fire was the request's own; a fire the radar's own gates stopped — its coin cooldown,
  its hourly cap, post-close suppression, a decision already running on the coin — arrives as
  `close_refused` with no gate, because the close qualified and nothing was entered; and a close
  whose coin another agent's fire took arrives as `close_claimed_by_radar`.
- On an entry, read the decision with `get_entry_decision` and state the direction, the entry, stop
  and take-profit levels, the position size, the **`convictionPercent`**, and the position's state —
  placing, working, open, rejected or expired. No conviction floor is applied on this surface: the
  conviction is the agent's own reading, and the player's consent was the gate.
- Open positions, once filled, are `list_user_active_positions`'s; closing one happens only on the
  player's word.
