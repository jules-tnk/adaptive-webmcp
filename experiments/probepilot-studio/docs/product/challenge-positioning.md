# WebMCP Challenge positioning

## One-sentence pitch

ProbePilot is a circuit studio where the agent can build the ideal design, but must ask the human to collect evidence before it can stage a repair for the faulty bench implementation.

## WebMCP leverage

The page exposes domain operations rather than button clicks:

- inspect exact topology and revisions;
- atomically build a semantic circuit;
- validate and simulate;
- request an exact measurement;
- publish evidence-linked hypotheses;
- stage, but not apply, a repair;
- verify the result.

The most important WebMCP behavior is a deliberate pause: `bench_request_measurement` changes the shared page into an awaiting-human state and returns no reading.

## Execution

The prototype provides a complete vertical journey with:

- deterministic seeded design;
- no account or backend;
- no external service dependency;
- revision conflict protection;
- grouped undo for agent builds;
- human-owned component protection;
- visible action provenance;
- automated domain, store, and tool tests;
- one-click reset.

## Potential impact

ProbePilot teaches diagnostic process rather than answer memorization:

- choose a useful test;
- understand what the test can distinguish;
- keep an evidence trail;
- avoid premature component replacement;
- verify the result rather than trusting the proposal.

## Creativity and ambition

The human is not merely a confirmation dialog. The human is the agent’s sensor. The application enforces the division of labor in code.

## What the demo must visibly prove

1. The agent builds or inspects the live design through semantic tools.
2. The ideal design passes simulation.
3. The bench visibly fails while the cause remains unknown.
4. A measurement request stops and waits for the human.
5. The returned evidence carries human provenance.
6. A premature repair is rejected or remains locked.
7. The agent stages the repair but cannot apply it.
8. Human approval changes the bench.
9. Verification produces the payoff.
