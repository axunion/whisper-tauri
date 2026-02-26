import { describe, expect, it } from "vitest";
import { toastVariants } from "../toast";

describe("toastVariants", () => {
  it("applies default variant classes", () => {
    const classes = toastVariants({ variant: "default" });
    expect(classes).toContain("bg-background");
    expect(classes).toContain("text-foreground");
  });

  it("applies success variant classes", () => {
    const classes = toastVariants({ variant: "success" });
    expect(classes).toContain("bg-success");
    expect(classes).toContain("text-success-foreground");
  });

  it("applies error variant classes", () => {
    const classes = toastVariants({ variant: "error" });
    expect(classes).toContain("bg-error");
    expect(classes).toContain("text-error-foreground");
  });

  it("applies warning variant classes", () => {
    const classes = toastVariants({ variant: "warning" });
    expect(classes).toContain("bg-warning");
    expect(classes).toContain("text-warning-foreground");
  });

  it("applies info variant classes", () => {
    const classes = toastVariants({ variant: "info" });
    expect(classes).toContain("bg-info");
    expect(classes).toContain("text-info-foreground");
  });

  it("applies destructive variant classes", () => {
    const classes = toastVariants({ variant: "destructive" });
    expect(classes).toContain("bg-destructive");
    expect(classes).toContain("text-destructive-foreground");
  });

  it("defaults to default variant when no variant specified", () => {
    const classes = toastVariants({});
    expect(classes).toContain("bg-background");
    expect(classes).toContain("text-foreground");
  });

  it("includes common base classes", () => {
    const classes = toastVariants({ variant: "default" });
    expect(classes).toContain("rounded-md");
    expect(classes).toContain("shadow-lg");
    expect(classes).toContain("pointer-events-auto");
  });
});
