---
name: battlegrid-officers
description: Set up and govern the player's Strategy Officers and work their reviews — create or change an officer through its draft, run one now, read when each runs and what is waiting, and apply, push or dismiss the proposals its reviews carry. It never writes a review. Activate whenever the player wants a new Strategy Officer, wants to change, pause or archive one, wants one to run now, asks what their officers found or when they run, or wants to apply, push or dismiss an officer's proposal.
---

# Strategy Officers

A Strategy Officer is a review the player schedules: on its hour, or when the player runs it now, it reads each
in-scope agent's record and records at most one proposal per agent for the player to apply, push or dismiss. The
officer writes its reviews on its own turn, on its own model and brief. This flow is the player's side of it:
setting an officer up, running it, reading where it stands, and acting on what it proposed.

Every officer run is billed to the player's LLM credit, and an applied proposal changes a live strategy, agent or
Radar deployment. So a setup goes through its own draft, a run is started only on the player's word, and Apply is
confirmed before it is called.

## The four failures this flow exists to prevent

1. **Writing a review yourself.** *Cue: "what would my officer say about…", wanting to record a finding.* You read
   an officer's reviews and give your own reading in the conversation; only the officer records a review. → §2.
2. **Applying without confirmation.** *Cue: "apply it", "make it live".* Apply publishes the proposal to a live
   target. Show the review, then confirm through `ask_user`. → §4.
3. **Computing what is served.** *Cue: working out the next run from the schedule, counting open reviews.* Every
   status figure is on the read. → §3.
4. **Committing a setup unasked.** *Cue: a staged officer that looks right.* The commit is the player's word. → §1.

## 1. Set up and update an officer through its draft

- **Read first.** `list_officers` for the roster (each officer's schedule, scope, last and next run) and the
  `presets`, `list_officer_drafts` for setups part-way through, `get_officer_draft` for one draft.
- **Create.** `stage_officer_draft` with **no** `officerId` and `draftVersion: 0` mints a new create draft; every
  later call names the minted id. Stage only what the player asked for — every axis the draft does not hold starts
  at its default (name "Strategy Officer", the catalog's default model, no instructions, `DAILY` at 03:00 UTC, all
  active agents, all three levers). "Add an officer that reviews my agents every morning at six and focuses on
  stops" is `NAME`, `SCHEDULE` `{ cadence: 'DAILY', hourUtc: 6, weekdayUtc: null }` and `INSTRUCTIONS`
  `{ focusText }` in the player's words — and ask which timezone "six" means before converting it to a UTC hour.
  Worked inputs: `references/officer-stage-examples.md`.
- **Presets are starting points, staged as ordinary axes.** When the player names one of the `presets`
  `list_officers` serves, stage its `name`, `focusText` and `scope` as `NAME`, `INSTRUCTIONS` and `SCOPE`; the
  officer remembers no preset.
- **Axes are whole.** `SCHEDULE` carries `cadence`, `hourUtc` and `weekdayUtc` (`0` Sunday … `6` Saturday, for
  `WEEKLY` only, otherwise null); `SCOPE` carries both `agents` (`'ALL'` or agent ids from
  `list_intelligence_agents`) and `levers`; `MODEL` names a `modelId` from `list_approved_models`. `INSTRUCTIONS`
  are the player's brief in their own words: at most 2,000 characters, naming no tool and no id — the commit
  refuses either.
- **Show, then commit on the player's word.** Read `get_officer_draft` and show the diff, the diagnostics and the
  impact — `nextRunAt` is when it first runs, and a create's `admission` says how many officers the player holds
  against their account plan's officer limit and how many more it admits (`officersRemaining`). Every unarchived
  officer counts, paused ones included; a create past the limit is refused as `PLAN_LIMIT_REACHED`, and archiving
  an officer frees its place. Commit with `commit_officer_draft` naming exactly the `draftVersion` and
  `committedRevision` the read returned, and only when the player says so. A cadence of `OFF` keeps the setup and
  runs nothing on a schedule.
- **Archive** with `archive_officer` only on the player's word: an archived officer runs no more, and its open
  reviews stay in the inbox.
- In the app, the player sets an officer up in its own console, where this conversation may be docked beside the
  form — stage into the officer it is scoped to.

## 2. Run an officer now

`run_officer` with the officer id, on the player's word. It runs exactly what the schedule runs — the officer's
own model and brief, over the agents its scope covers that closed a decision or saw the officer's setup change
since its last review — and answers before any review starts:

- `QUEUED` with `agentCount`: the reviews arrive in `list_officer_reviews` as each finishes;
- `NOTHING_TO_REVIEW`: no agent is under review, or the agents with something new are waiting on a proposal pushed
  into the player's draft, and nothing is queued or billed;
- `ALREADY_QUEUED`: a run of this officer is waiting or running.

A run is per officer: to run two, call it for each. While one is waiting or running, `pendingRun` on `list_officers`
and `get_officer` names its state; read it again rather than calling `run_officer` twice. It follows
`commanderAccess` from `get_account_state`, not `llmAccess`: show `deniedMessage` when it is not allowed. An
archived officer is refused.

An officer waits on an agent whose review by it is pushed: the player is adopting that proposal in the draft, so the
officer reviews that agent again only once the draft is saved or discarded.

**Never write a review.** The officer records its own; a second opinion on one of its reviews is your reading in
the conversation, never a record.

## 3. Where each officer stands

Read it, never compute it. `list_officers` serves each officer's `lastRunAt`, `nextRunAt` and `pendingRun`, and
`list_officer_reviews` serves `openCountByOfficer`, each unarchived officer's reviews awaiting the player. Quote
them as served, through their display names.

## 4. Work the inbox

- **Read.** `list_officer_reviews`, by officer or by agent, newest first; `includeClosed` adds the applied,
  dismissed and superseded history. Show each review's verdict, findings, diff, impact and warnings exactly as
  served; `applyAvailable` says Apply is offered, `heldAxes` names every axis the target's draft holds and who wrote
  it, and `baseMoved` says the target was committed since the review. `awaitingOwner` says the review waits on the
  player; a review that proposes no change (lever `NONE`) is for their information and never waits.
- **Apply** with `apply_officer_proposal` only after an `ask_user` confirmation naming the review, its target and
  its axis, and only on the confirming pick. A client with no `ask_user` asks in its reply and waits for the
  player's word. Apply publishes the proposal to the live target; it needs `mcp:wager`.
- **Push** with `push_officer_proposal` and **Dismiss** with `dismiss_officer_review` on the player's explicit word,
  naming the review. A push places the proposal in the target's draft for the player to save from the editor; a
  dismissal closes the review and touches no draft.
- **A refusal names its recovery** through `details.nextAct`: `BASE_MOVED` — the target moved since the review,
  dismiss it for a re-review; `AXIS_HELD` and `DRAFT_NOT_EMPTY` — the target's draft already holds work, so the
  player saves or discards it, or pushes instead of applying; `TARGET_NOT_OWNED` and `PROPOSAL_INVALID` — the target
  no longer accepts the proposal, so dismiss it. An action on a closed review is refused with its `reviewStatus`, and
  a superseded one names its replacement as `supersededBy`: read that review instead. A dismissed review is not run again until the agent closes a new
  decision or the officer's setup changes.

## Reporting discipline

- Numbers, codes and states exactly as served, through their display names.
- Never describe a proposal as applied before `apply_officer_proposal` answered, or a review as written by you.
