import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useStore } from "zustand";
import { afterEach, describe, expect, it } from "vitest";
import { ComponentPropertyEditor } from "@/components/component-property-editor";
import { createBlankDesign } from "@/domain/fixtures";
import { ComponentKind, MosfetChannel, SpdtPosition, type CircuitComponent } from "@/domain/types";
import { createStudioStore, type StudioState } from "@/state/store";
import { createProbePilotTools } from "@/webmcp/tools";
import type { StoreApi } from "zustand/vanilla";

type EditorHarnessProps = {
  store: StoreApi<StudioState>;
  componentId: string;
};

function EditorHarness({ store, componentId }: EditorHarnessProps) {
  const component = useStore(store, (state) => state.design.components[componentId]);
  if (!component) throw new Error(`Missing ${componentId}.`);
  return <ComponentPropertyEditor component={component} onUpdateProperties={(properties) => store.getState().updateComponent(componentId, { properties }, { actor: "human" })} />;
}

function addComponent(store: StoreApi<StudioState>, kind: ComponentKind): CircuitComponent {
  const result = store.getState().addComponent(kind, { x: 100, y: 100 }, { actor: "human" });
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function renderEditor(kind: ComponentKind) {
  const store = createStudioStore(createBlankDesign("editor-test"));
  const component = addComponent(store, kind);
  render(<EditorHarness store={store} componentId={component.id} />);
  return { store, component };
}

describe("ComponentPropertyEditor", () => {
  afterEach(() => cleanup());

  it("normalizes an SI resistor entry through the authoritative parser", () => {
    const { store, component } = renderEditor(ComponentKind.Resistor);

    const input = screen.getByLabelText("Resistance");
    fireEvent.change(input, { target: { value: "10k" } });
    fireEvent.blur(input);

    expect(store.getState().design.components[component.id]?.properties).toEqual({ kind: ComponentKind.Resistor, resistanceOhms: 10_000, tolerance: 0.05 });
    expect(screen.getByText("Normalized: 10 kΩ")).toBeInTheDocument();
  });

  it("updates a capacitor polarity with its boolean control", () => {
    const { store, component } = renderEditor(ComponentKind.Capacitor);

    fireEvent.click(screen.getByLabelText("Polarized"));

    expect(store.getState().design.components[component.id]?.properties).toMatchObject({ kind: ComponentKind.Capacitor, polarized: true });
  });

  it("updates the selected SPDT path", () => {
    const { store, component } = renderEditor(ComponentKind.SpdtSwitch);

    fireEvent.change(screen.getByLabelText("Position"), { target: { value: SpdtPosition.B } });

    expect(store.getState().design.components[component.id]?.properties).toEqual({ kind: ComponentKind.SpdtSwitch, position: SpdtPosition.B });
  });

  it("shows a fixed transistor type as registry metadata", () => {
    renderEditor(ComponentKind.NpnBjt);

    expect(screen.getByText("Transistor type")).toBeInTheDocument();
    expect(screen.getByText("NPN")).toBeInTheDocument();
  });

  it("shows the authoritative MOSFET channel without allowing a conflicting update", () => {
    const { store, component } = renderEditor(ComponentKind.NChannelMosfet);

    expect(screen.getByText("MOSFET channel")).toBeInTheDocument();
    expect(screen.getByText("N channel")).toBeInTheDocument();
    expect(store.getState().design.components[component.id]?.properties).toMatchObject({ channel: MosfetChannel.N });
  });

  it("keeps the previous property and reports invalid numeric input", () => {
    const { store, component } = renderEditor(ComponentKind.Resistor);

    const input = screen.getByLabelText("Resistance");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(store.getState().design.components[component.id]?.properties).toEqual({ kind: ComponentKind.Resistor, resistanceOhms: 330, tolerance: 0.05 });
    expect(screen.getByRole("alert")).toHaveTextContent("number between 1 and 10000000");
  });

  it("preserves a human agent lock while changing a property", () => {
    const { store, component } = renderEditor(ComponentKind.Resistor);
    act(() => { expect(store.getState().updateComponent(component.id, { agentLocked: true }, { actor: "human" }).ok).toBe(true); });

    const input = screen.getByLabelText("Resistance");
    fireEvent.change(input, { target: { value: "1k" } });
    fireEvent.blur(input);

    expect(store.getState().design.components[component.id]).toMatchObject({ agentLocked: true, properties: { kind: ComponentKind.Resistor, resistanceOhms: 1000 } });
  });

  it("edits and summarizes the normalized resistor tolerance", () => {
    const { store, component } = renderEditor(ComponentKind.Resistor);

    const input = screen.getByLabelText("Tolerance");
    fireEvent.change(input, { target: { value: "5%" } });
    fireEvent.blur(input);

    expect(store.getState().design.components[component.id]?.properties).toMatchObject({ tolerance: 0.05 });
    expect(screen.getByText("Normalized: 5 %")).toBeInTheDocument();
  });

  it("refreshes a numeric field after an external update and undo", () => {
    const { store, component } = renderEditor(ComponentKind.Resistor);
    const input = screen.getByLabelText("Resistance");

    act(() => { expect(store.getState().updateComponent(component.id, { properties: { resistanceOhms: "1k" } }, { actor: "agent" }).ok).toBe(true); });
    expect(input).toHaveValue("1000");
    act(() => { expect(store.getState().undo().ok).toBe(true); });
    expect(input).toHaveValue("330");
  });

  it("refreshes a numeric field after a WebMCP agent update", async () => {
    const { store, component } = renderEditor(ComponentKind.Resistor);
    const updateTool = createProbePilotTools(store).find((tool) => tool.name === "design_update_components");
    if (!updateTool) throw new Error("Missing design update tool.");

    await act(async () => {
      await updateTool.execute({
        expectedRevision: store.getState().design.revision,
        updates: [{ componentId: component.id, properties: { resistanceOhms: "1k" } }]
      });
    });

    expect(screen.getByLabelText("Resistance")).toHaveValue("1000");
  });

  it("preserves selected drafts and errors across unrelated agent mutations, then synchronizes selected values", () => {
    const store = createStudioStore(createBlankDesign("draft-isolation-test"));
    const resistor = addComponent(store, ComponentKind.Resistor);
    const source = addComponent(store, ComponentKind.DcSource);
    render(<EditorHarness store={store} componentId={resistor.id} />);

    const tolerance = screen.getByLabelText("Tolerance");
    fireEvent.change(tolerance, { target: { value: "200%" } });
    fireEvent.blur(tolerance);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    const resistance = screen.getByLabelText("Resistance");
    fireEvent.change(resistance, { target: { value: "1k" } });
    expect(resistance).toHaveValue("1k");

    act(() => { expect(store.getState().updateComponent(source.id, { properties: { voltage: "12V" } }, { actor: "agent" }).ok).toBe(true); });
    expect(screen.getByLabelText("Resistance")).toHaveValue("1k");
    expect(screen.getByRole("alert")).toBeInTheDocument();

    act(() => { expect(store.getState().updateComponent(resistor.id, { properties: { resistanceOhms: "2k" } }, { actor: "agent" }).ok).toBe(true); });
    expect(screen.getByLabelText("Resistance")).toHaveValue("2000");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("refreshes fields and clears validation errors when the selected component changes", () => {
    const store = createStudioStore(createBlankDesign("selection-test"));
    const first = addComponent(store, ComponentKind.Resistor);
    const second = addComponent(store, ComponentKind.Resistor);
    expect(store.getState().updateComponent(second.id, { properties: { resistanceOhms: "1k" } }, { actor: "human" }).ok).toBe(true);
    const view = render(<EditorHarness store={store} componentId={first.id} />);

    const input = screen.getByLabelText("Resistance");
    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    view.rerender(<EditorHarness store={store} componentId={second.id} />);

    expect(screen.getByLabelText("Resistance")).toHaveValue("1000");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("restores the authoritative value after failed validation", () => {
    const { store, component } = renderEditor(ComponentKind.Resistor);
    const input = screen.getByLabelText("Resistance");

    fireEvent.change(input, { target: { value: "0" } });
    fireEvent.blur(input);

    expect(store.getState().design.components[component.id]?.properties).toMatchObject({ resistanceOhms: 330 });
    expect(input).toHaveValue("330");
  });

  it("accepts unit-bearing capacity, voltage rating, and fuse ratings without duplicating units", () => {
    const battery = renderEditor(ComponentKind.Battery);
    const capacity = screen.getByLabelText("Capacity");
    fireEvent.change(capacity, { target: { value: "500mAh" } });
    fireEvent.blur(capacity);
    expect(battery.store.getState().design.components[battery.component.id]?.properties).toMatchObject({ capacityMilliampHours: 500 });
    cleanup();

    const capacitor = renderEditor(ComponentKind.Capacitor);
    const voltageRating = screen.getByLabelText("Voltage rating");
    fireEvent.change(voltageRating, { target: { value: "25V" } });
    fireEvent.blur(voltageRating);
    expect(capacitor.store.getState().design.components[capacitor.component.id]?.properties).toMatchObject({ voltageRating: 25 });
    cleanup();

    const fuse = renderEditor(ComponentKind.Fuse);
    const currentRating = screen.getByLabelText("Current rating");
    fireEvent.change(currentRating, { target: { value: "500mA" } });
    fireEvent.blur(currentRating);
    const fuseVoltageRating = screen.getByLabelText("Voltage rating");
    fireEvent.change(fuseVoltageRating, { target: { value: "32V" } });
    fireEvent.blur(fuseVoltageRating);
    expect(fuse.store.getState().design.components[fuse.component.id]?.properties).toMatchObject({ currentRatingAmps: 0.5, voltageRating: 32 });
  });

  it("rejects a blank non-SI numeric input instead of converting it to zero", () => {
    const { store, component } = renderEditor(ComponentKind.Potentiometer);
    const input = screen.getByLabelText("Wiper position");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(store.getState().design.components[component.id]?.properties).toMatchObject({ wiperPosition: 0.5 });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
