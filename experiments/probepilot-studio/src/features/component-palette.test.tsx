import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ComponentPalette } from "./component-palette";
import { studioStore } from "@/state/store";

describe("ComponentPalette", () => {
  beforeEach(() => {
    studioStore.getState().newBlankProject();
  });

  afterEach(() => cleanup());

  it("finds a zener diode from the registry catalog search", () => {
    render(<ComponentPalette />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Search components" }), { target: { value: "zener" } });

    expect(screen.getByRole("button", { name: "Add Zener diode" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Capacitor" })).not.toBeInTheDocument();
  });

  it("filters the registry catalog to semiconductors", () => {
    render(<ComponentPalette />);

    fireEvent.click(screen.getByRole("button", { name: /^Semiconductors/ }));

    expect(screen.getByRole("heading", { name: "Semiconductors" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Zener diode" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add Capacitor" })).not.toBeInTheDocument();
  });

  it("adds a capacitor and exposes capability support in text", () => {
    render(<ComponentPalette />);

    expect(screen.getByText("0 placed")).toBeInTheDocument();
    const capacitor = screen.getByRole("button", { name: "Add Capacitor" });
    fireEvent.click(capacitor);

    expect(screen.getByText("1 placed")).toBeInTheDocument();
    expect(Object.values(studioStore.getState().design.components).map((component) => component.kind)).toContain("capacitor");
    expect(within(capacitor).getByLabelText("Design supported")).toBeInTheDocument();
    expect(within(capacitor).getByLabelText("SPICE supported")).toBeInTheDocument();
    expect(within(capacitor).getByLabelText(/Bench unavailable: This component is not available in the guided hands-on bench workflow\./)).toBeInTheDocument();
  });

  it("explains a missing SPICE capability without conflating it with Bench support", () => {
    render(<ComponentPalette />);

    const opAmp = screen.getByRole("button", { name: "Add Op-amp" });

    expect(within(opAmp).getByLabelText("SPICE unavailable: No verified SPICE model is available for this component.")).toBeInTheDocument();
  });
});
