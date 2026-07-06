import { fireEvent, render, screen } from "@solidjs/testing-library";
import { describe, expect, it, vi } from "vitest";
import { Button } from "../Button";

describe("Button", () => {
  it("renders with text", () => {
    render(() => <Button>Click me</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByRole("button")).toHaveTextContent("Click me");
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(() => <Button onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders every variant as a button with distinct styling", () => {
    // Verifies the variant prop affects the output without coupling the
    // test to specific Tailwind class names.
    const variants = [
      "default",
      "destructive",
      "outline",
      "secondary",
      "ghost",
      "link",
    ] as const;
    const classNames = variants.map((variant) => {
      const { unmount } = render(() => (
        <Button variant={variant}>{variant}</Button>
      ));
      const className = screen.getByRole("button").className;
      expect(className).not.toBe("");
      unmount();
      return className;
    });
    expect(new Set(classNames).size).toBe(variants.length);
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
