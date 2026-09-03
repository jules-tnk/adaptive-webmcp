import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Launchpad } from "@/features/launchpad";

describe("Launchpad", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("explains the product, workflow, safety boundary, project library, and common questions", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Launchpad /></MemoryRouter>);

    expect(screen.getByRole("heading", { level: 1, name: /Design the ideal circuit/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your projects" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "From circuit idea to verified repair" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "The human stays in the measurement loop" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nine tools, one controlled workspace" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Questions before you start" })).toBeInTheDocument();
    expect(screen.getByText("Where are my projects stored?")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Open deterministic demo/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Blank circuit/i }).length).toBeGreaterThan(0);
  });

  it("explains when a requested project no longer exists", () => {
    render(<MemoryRouter initialEntries={["/?notice=project-not-found"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Launchpad /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("could not be found");
  });
});
