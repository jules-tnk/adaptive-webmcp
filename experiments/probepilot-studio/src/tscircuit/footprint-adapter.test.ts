import { describe, expect, it } from "vitest";
import { any_circuit_element } from "circuit-json";
import { ComponentDefinitionRegistry } from "@/components/component-definition-registry";
import { CircuitFixtures, createDemoDesign } from "@/domain/fixtures";
import { PhysicalLayout } from "@/physical/physical-layout";
import { FootprintAdapter } from "@/tscircuit/footprint-adapter";
import { PhysicalPreviewAdapter } from "@/tscircuit/physical-preview-adapter";

describe("FootprintAdapter", () => {
  it("resolves every default catalog footprint without generic fallback", () => {
    for (const definition of ComponentDefinitionRegistry.list()) {
      expect(FootprintAdapter.resolve(definition.defaultFootprint).generic).toBe(false);
    }
  });

  it("uses explicit generic geometry for custom footprints", () => {
    expect(FootprintAdapter.resolve("custom-package").generic).toBe(true);
  });

  it("emits valid linked PCB, pad, port, trace, and CAD elements", () => {
    const design = createDemoDesign();
    const result = PhysicalPreviewAdapter.convert(design, PhysicalLayout.generate(design));
    expect(any_circuit_element.array().safeParse(result.elements).success).toBe(true);
    expect(result.elements.filter((element) => element.type === "pcb_port")).toHaveLength(9);
    expect(result.elements.filter((element) => element.type === "pcb_trace")).toHaveLength(5);
    expect(result.elements.filter((element) => element.type === "cad_component")).toHaveLength(5);
    expect(result.elements.filter((element) => element.type === "pcb_silkscreen_rect")).toHaveLength(5);
    expect(result.elements.filter((element) => element.type === "pcb_silkscreen_text")).toHaveLength(5);
  });

  it("emits physical packages for the complete 21-component catalog", () => {
    const design = CircuitFixtures.createComponentCatalogDesign();
    const result = PhysicalPreviewAdapter.convert(design, PhysicalLayout.generate(design));
    expect(result.elements.filter((element) => element.type === "pcb_component")).toHaveLength(21);
    expect(result.elements.filter((element) => element.type === "cad_component")).toHaveLength(21);
    expect(result.warnings).toEqual([]);
  });
});
