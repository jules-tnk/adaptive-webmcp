import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { DeleteProjectDialog } from "@/projects/delete-project-dialog";

describe("DeleteProjectDialog", () => {
  afterEach(() => cleanup());

  it("names the project and requires an explicit destructive confirmation", () => {
    const confirm = vi.fn();
    render(<DeleteProjectDialog projectName="Status LED" onConfirm={confirm} trigger={<Button>Delete</Button>} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog", { name: "Delete project?" })).toBeInTheDocument();
    expect(screen.getByText(/Status LED/)).toBeInTheDocument();
    expect(screen.getByText(/this browser/)).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete project" }));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes without deleting when cancelled", () => {
    const confirm = vi.fn();
    render(<DeleteProjectDialog projectName="Status LED" onConfirm={confirm} trigger={<Button>Delete</Button>} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
