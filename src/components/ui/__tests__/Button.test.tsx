import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("renders with text", () => {
    render(() => <Button>Click me</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("applies default variant classes", () => {
    render(() => <Button>Default</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-primary");
    expect(button.className).toContain("text-primary-foreground");
  });

  it("applies destructive variant classes", () => {
    render(() => <Button variant="destructive">Delete</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-destructive");
  });

  it("applies outline variant classes", () => {
    render(() => <Button variant="outline">Outline</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("border");
    expect(button.className).toContain("border-input");
  });

  it("applies secondary variant classes", () => {
    render(() => <Button variant="secondary">Secondary</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("bg-secondary");
  });

  it("applies ghost variant classes", () => {
    render(() => <Button variant="ghost">Ghost</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("hover:bg-accent");
  });

  it("applies link variant classes", () => {
    render(() => <Button variant="link">Link</Button>);
    const button = screen.getByRole("button");
    expect(button.className).toContain("underline-offset-4");
  });

  it("is disabled when disabled prop is set", () => {
    const onClick = vi.fn();
    render(() => (
      <Button disabled onClick={onClick}>
        Disabled
      </Button>
    ));
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
