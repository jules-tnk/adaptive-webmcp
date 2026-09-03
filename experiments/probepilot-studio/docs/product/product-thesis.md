# Product thesis

## Definition

ProbePilot Studio is a small circuit design studio with a flagship mixed-initiative debugging workflow.

The visual studio is the product container. Evidence-gated human-agent diagnosis is the product thesis.

## Problem

Existing AI circuit tools tend to let the agent see the complete digital model, run every virtual measurement, identify the defect, and edit the circuit directly. That is useful for ideal design work, but it does not represent the difficult part of real troubleshooting: deciding which observation is needed next when the implementation differs from the design.

A normal chat assistant can suggest measurements, but the user must manually describe test points, settings, readings, and current application state. A browser automation agent can click the virtual meter, but then the human is no longer the sensor and the diagnostic exercise loses its point.

## Product contract

ProbePilot separates two models:

1. **Design model** — the intended circuit, visible to both human and agent. The agent may edit and simulate it.
2. **Bench model** — a virtual implementation with an unknown difference. The application knows the private difference; the agent does not.

The bench workflow is:

```text
Agent requests an observation
→ human operates the instrument
→ application records structured evidence
→ agent revises its hypothesis
→ agent stages a bounded repair
→ human approves or rejects
→ application verifies the outcome
```

## Initial user

The credible first user is an electronics learner or instructor teaching systematic diagnostic reasoning. The prototype can later support professional training simulations, but it does not claim to diagnose arbitrary physical equipment.

## Scope principle

Vertical completeness matters more than component breadth. One circuit must be creatable, simulatable, transferable to the bench, diagnosable, repairable, and verifiable without a fake transition.

## Positioning

Use:

> A human-agent circuit studio for designing ideal circuits and debugging the versions that actually get built.

Avoid:

> A complete professional circuit design and repair platform.
