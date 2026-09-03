import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBar } from "@/features/status-bar";

describe("StatusBar", () => {
  it("renders a stable snapshot from the studio store", () => {
    render(<StatusBar />);

    expect(screen.getByText(/components/)).toBeInTheDocument();
    expect(screen.getByText(/revision/)).toBeInTheDocument();
  });
});
