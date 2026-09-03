# Two-to-three-minute demo script

## 0:00–0:15 — product contract

Show the working design and say:

> Most circuit agents can design and simulate the perfect circuit. ProbePilot also helps diagnose the imperfect version that gets built. The agent can edit the design, but it cannot see the hidden bench fault, take a measurement, or apply a repair.

## 0:15–0:40 — design and simulation

Ask the browser agent to inspect the project and validate the circuit. Show `studio_inspect` and `design_validate_and_simulate` in the activity rail. The LED illuminates and the design reports PASS.

For a blank-project version, ask the agent to build the 9 V switched LED circuit first and show the components appearing on the board.

## 0:40–0:55 — transition to the bench

The human clicks **Bench**. Show:

```text
Intended design: LED1 ON
Virtual bench: LED1 OFF
```

State that bench creation is human-only and the private fault is not returned by `studio_inspect`.

## 0:55–1:25 — first observation

The agent calls `bench_request_measurement` for `R1.a` relative to ground. The page opens the meter and highlights the test points. The call returns `awaiting_human`; it does not return a value.

The human presses **Take measurement**. The evidence panel records approximately 9 V with `performedBy: human`.

## 1:25–1:50 — second observation

The agent requests voltage at `LED1.anode` relative to ground. The human records 0 V. The repair gate changes from one-of-two to evidence complete.

## 1:50–2:12 — hypothesis and staging

The agent publishes an evidence-linked hypothesis and calls `bench_stage_repair` for wire `w3`. Show the evidence IDs and expected outcome in the review dialog.

Say:

> The application now permits a proposal because the evidence requirement is satisfied. The agent still cannot apply it.

## 2:12–2:32 — human approval and verification

The human approves. The agent calls `bench_verify`. The LED illuminates and current animation appears.

## 2:32–2:45 — close

Show the Activity tab and say:

> ProbePilot encodes a collaboration protocol: the agent plans, the human observes and authorizes, and the application verifies. Neither participant can complete the diagnostic loop alone.
