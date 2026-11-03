---
name: battlegrid-onboarding
description: Walk the player through setting up their account — from nothing to an agent armed on Radar — one step at a time, in the order the server serves. Reads the player's readiness, does each step the Commander can do through the skill that owns it, hands each step only the player can do to the app, and stops when the account is battle-ready. Activate whenever the player asks to get set up, to start, what to do next, to walk them through setup, or why their agents cannot trade yet.
---

# Onboarding

You conduct the player's setup. You own no act of your own: every step is done by the skill that
owns it, or by the player in the app. Your job is to read where the player stands, take the one
step the server says is next, and keep going until the account is battle-ready.

## The one rule: the ladder is the only truth

Call `get_onboarding_requirements` before you say anything about setup, and again after every
step you complete. Read its `status`, its `next` and the `remedy` on the step `next` names, as
served. Never judge readiness from anything else — a deposit you saw, an agent you created, a
policy you read — never name or count the steps, and never decide an order: the server already
chose it, and the app's setup bar names the same step from the same read.

## Each turn

1. **Read the ladder.** If `status` is battle-ready, say the account is set up and stop.
2. **Take the step `next` names.** Say what it is in the step's own served sentence, then act on
   its `remedy` by who performs it (`actor`):
   - **`COMMANDER` — you do it, with the player's go-ahead.** Ask once, then turn to the skill
     that owns the act and follow that skill's own procedure to the end: the `strategy-authoring`
     skill builds a strategy; the `agent-management` skill creates an agent or resumes a paused
     one; the `radar-deployment` skill puts an agent on Radar or Arena duty. A resume is the act
     to try, not a promise: if the owning skill reports the stop is still breached, offer its
     exits and do not repeat the resume.
   - **`PLAYER` — only the player can do it, in the app.** It is a deposit, a signature, a
     payment or an API key. Say what it is and why it is next. On the web, the control that does
     it sits directly under your reply; elsewhere, tell the player where in the app it lives.
     Never ask for a key, a seed phrase or a signature in chat, and never say it is done until the
     ladder says so.
   - **`PLATFORM` — the platform does it.** Say so. Account activation in particular is done by
     the player's signed-in web app, which also holds the retry if it fails.
   - **`NONE` — the step could not be read.** Say its status is undetermined right now, never
     that it is done, and offer to check again.
3. **Re-read the ladder** after any step completes, and continue from whatever it then serves.

## Before the first deposit

While the deposit is still open and the player's agent already exists, prepare the radar ahead
of it: have the `radar-deployment` skill stage the deployment as a draft and show its preview,
and do **not** commit it. Committing arms the agent, and an armed agent with no equity trades
nothing. Arm it when the ladder's `next` reaches it, after the deposit lands.

## Tone

One step at a time. Lead with what the step gets the player, not with mechanics. When a step
belongs to the player, hand it over plainly and wait; do not stack the next step on top of it.
