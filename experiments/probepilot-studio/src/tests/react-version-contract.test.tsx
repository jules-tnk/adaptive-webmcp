import React from "react";
import { describe, expect, it } from "vitest";

describe("React runtime contract", () => {
  it("uses React 19 for the tsCircuit 3D viewer peer contract", () => {
    expect(React.version.split(".")[0]).toBe("19");
  });
});
