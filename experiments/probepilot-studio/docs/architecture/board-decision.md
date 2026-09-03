# Board implementation decision

## Decision

Use a purpose-built semantic SVG/DOM board for the challenge MVP.

## Why this fits the constrained product

ProbePilot supports five component types, a fixed low-voltage topology scale, semantic terminals, and simple curved wires. It does not need arbitrary shapes, comments, rich text, grouping, image insertion, or a freeform infinite whiteboard.

The custom board gives direct control over the parts that matter to WebMCP:

- stable component and terminal IDs;
- accessible terminal buttons;
- exact wire semantics;
- test-point highlighting;
- bench measurement targeting;
- component protection;
- simulation overlays;
- no translation layer from generic graph nodes into circuit meaning.

## Why not a freeform canvas

A whiteboard library would optimize for shapes and gestures rather than named terminals and electrical topology. The application would still need a second semantic graph and complex synchronization.

## Why not React Flow in this implementation

React Flow was the initial candidate and remains a reasonable post-MVP option. It supplies mature panning, zooming, selection, handles, and reconnectable edges. The final challenge slice uses a small, bounded board, however, and the custom implementation reduces bundle surface and makes human measurement points actual accessible controls.

The decision is not a claim that a custom editor is universally superior. It is a scope decision for a five-component prototype.

## Migration path

The domain model does not depend on the board. A future React Flow adapter can map:

```text
CircuitComponent → custom React Flow node
CircuitWire → custom React Flow edge
TerminalDefinition → handle
```

Simulation, store commands, WebMCP schemas, activity provenance, and private bench logic would remain unchanged.
