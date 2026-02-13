import { render, screen } from "@solidjs/testing-library";
import { describe, expect, it } from "vitest";
import { Progress } from "../Progress";

describe("Progress", () => {
  it("renders a progressbar", () => {
    render(() => <Progress value={50} />);
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("reflects value via aria attributes", () => {
    render(() => <Progress value={30} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "30");
    expect(progressbar).toHaveAttribute("aria-valuemax", "100");
  });

  it("reflects custom maxValue via aria attributes", () => {
    render(() => <Progress value={75} maxValue={200} />);
    const progressbar = screen.getByRole("progressbar");
    expect(progressbar).toHaveAttribute("aria-valuenow", "75");
    expect(progressbar).toHaveAttribute("aria-valuemax", "200");
  });
});
