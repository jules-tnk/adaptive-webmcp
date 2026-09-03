import { describe, expect, it } from "vitest"
import { symbols, getSvg } from "schematic-symbols"
import { resistorProps } from "@tscircuit/props"
import { any_circuit_element } from "circuit-json"

describe("tsCircuit dependency contract", () => {
  it("exposes schematic symbols and SVG rendering", () => {
    expect(symbols.resistor_right).toBeDefined()
    expect(getSvg).toBeTypeOf("function")
  })

  it("parses resistor props", () => {
    const parsed = resistorProps.parse({ name: "R1", resistance: "10k" })

    expect(parsed.resistance).toBe(10000)
  })

  it("parses a minimal Circuit JSON source component", () => {
    const parsed = any_circuit_element.parse({
      type: "source_component",
      ftype: "simple_resistor",
      source_component_id: "source_component_1",
      name: "R1",
      supplier_part_numbers: {},
      resistance: "10k",
    })

    expect(parsed.type).toBe("source_component")
  })
})
