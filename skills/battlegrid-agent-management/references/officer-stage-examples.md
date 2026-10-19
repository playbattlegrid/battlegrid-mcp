# Strategy Officer stage examples

Complete `stage_officer_draft` inputs. Each is checked in CI against the live stage schema and the setup rules a
commit applies without a repository read. Its shape is current.

Every `<UPPER_SNAKE>` value is a placeholder. Replace it with the id a read returned:

- `<OFFICER_ID>` comes from `list_officers` or the draft you are editing.
- `<AGENT_ID>` and `<OTHER_AGENT_ID>` come from `list_intelligence_agents`.
- `<MODEL_ID>` is the row's `modelId` from `list_approved_models`.

Never send a placeholder as written, and never invent an id. `draftVersion` is the version `get_officer_draft`
returned: 0 when there was no draft, and for a new create draft. Each axis you send is written whole, and an axis
you omit keeps the value the draft already has, the officer's current value, or for a new officer its default.

## Add an officer that reviews every morning at six and focuses on stops

Omit `officerId` to open a create draft. The response carries the minted id, which every later call names. Convert
the player's "six" to a UTC hour only after asking which timezone they mean; this example is 06:00 UTC.

```json stage_officer_draft
{
  "draftVersion": 0,
  "axes": {
    "NAME": { "name": "Morning Stops Officer" },
    "SCHEDULE": { "cadence": "DAILY", "hourUtc": 6, "weekdayUtc": null },
    "INSTRUCTIONS": { "focusText": "Focus on stops: premature stop-outs and what price did after each exit." }
  }
}
```

## Start from the regime preset, weekly on Monday

A preset is staged as ordinary axes: its name, its brief and its scope.

```json stage_officer_draft
{
  "draftVersion": 0,
  "axes": {
    "NAME": { "name": "Regime Officer" },
    "INSTRUCTIONS": {
      "focusText": "Read the record by the regime each decision was scored against. Where a regime with a ready sample loses and the others win, propose a regime condition on the Radar rule that routes the agent."
    },
    "SCOPE": { "agents": "ALL", "levers": ["radar-deployment"] },
    "SCHEDULE": { "cadence": "WEEKLY", "hourUtc": 7, "weekdayUtc": 1 }
  }
}
```

## Narrow an existing officer to two agents and the rails lever

SCOPE is sent whole: both the agents and the levers, even when only one changes.

```json stage_officer_draft
{
  "officerId": "<OFFICER_ID>",
  "draftVersion": 0,
  "axes": {
    "SCOPE": { "agents": ["<AGENT_ID>", "<OTHER_AGENT_ID>"], "levers": ["agent"] }
  }
}
```

## Change the model and pause the officer

A cadence of OFF keeps the setup and runs nothing.

```json stage_officer_draft
{
  "officerId": "<OFFICER_ID>",
  "draftVersion": 0,
  "axes": {
    "MODEL": { "modelId": "<MODEL_ID>" },
    "SCHEDULE": { "cadence": "OFF", "hourUtc": 3, "weekdayUtc": null }
  }
}
```
