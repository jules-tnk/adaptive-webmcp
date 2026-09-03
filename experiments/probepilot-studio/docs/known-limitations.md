# Known limitations

These are deliberate MVP boundaries rather than hidden claims.

## Electrical model

- one low-voltage DC source;
- simplified single-path solver;
- no AC, capacitors, inductors, transistors, logic ICs, or parallel-network analysis;
- simplified LED model;
- educational readings rather than SPICE-grade results.

## Board

- bounded work surface rather than an infinite canvas;
- no free-floating junction nodes;
- wire crossings do not connect;
- no automatic schematic layout;
- no import from KiCad or SPICE;
- desktop editing only.

## Projects

- latest public design is written to localStorage but the launchpad does not yet expose a complete recent-project manager;
- active bench sessions are intentionally not restored because their private fault state is not persisted;
- no cloud accounts or multiplayer collaboration.

## Bench

- the challenge route uses a deterministic open-wire fault for video reliability;
- wrong-resistor and reversed-LED faults exist at the engine boundary but are not selectable in the UI;
- repair actions alter the private bench model rather than a detailed visual breadboard.

## WebMCP

- tool registration depends on a browser exposing `document.modelContext.registerTool`;
- the site remains manually usable when the API is unavailable;
- no embedded model or chat is included;
- supported browser behavior must be retested against the challenge environment before submission.
