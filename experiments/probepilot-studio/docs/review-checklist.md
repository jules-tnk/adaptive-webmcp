# Review checklist

## Product contract

- [ ] Design and Bench feel like two states of one artifact.
- [ ] The user understands the value proposition within 20 seconds.
- [ ] The agent’s role changes visibly between Design and Bench.
- [ ] The human is required for measurement and approval.
- [ ] A wrong repair can fail without revealing the answer.

## WebMCP

- [ ] Tool names and descriptions are semantic and non-overlapping.
- [ ] `studio_inspect` returns enough state to plan without raw DOM access.
- [ ] Every mutation respects the observed revision.
- [ ] The measurement-request result contains no reading.
- [ ] No tool can create a bench, take a measurement, change locks, or apply a repair.
- [ ] Activity provenance matches the actual actor.

## Private state

- [ ] Hidden fault is absent from Zustand and public DTOs.
- [ ] Hidden fault is absent from localStorage and the DOM.
- [ ] Project reset destroys the old private session.
- [ ] Verification uses the bench engine rather than trusting the staged repair.

## Circuit behavior

- [ ] Demo design simulates consistently.
- [ ] Open wire produces 9 V before the break and 0 V at the LED anode.
- [ ] Correct wire repair restores the LED.
- [ ] Invalid wires and stale mutations are visibly rejected.

## Interface

- [ ] Board remains readable at 1024, 1280, and 1440 pixels.
- [ ] Terminal hit targets are usable.
- [ ] Component values and mode status remain legible.
- [ ] Inspector, activity, and meter do not compete for attention.
- [ ] Reduced motion and keyboard controls work.

## Submission

- [ ] Public demo URL opens directly into the deterministic project.
- [ ] No sign-in, API key, paid service, or external data is required.
- [ ] Repository license and setup instructions are present.
- [ ] Video is under three minutes and includes audio.
- [ ] Video visibly shows WebMCP calls, human measurement, repair lock, approval, and payoff.
