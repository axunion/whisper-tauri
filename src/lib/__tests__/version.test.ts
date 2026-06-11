import { describe, expect, it } from "vitest";
import { isNewerVersion } from "../version";

describe("isNewerVersion", () => {
  it("should return false when versions are equal", () => {
    expect(isNewerVersion("0.1.0", "0.1.0")).toBe(false);
  });

  it("should return true when latest patch is higher", () => {
    expect(isNewerVersion("0.1.0", "0.1.1")).toBe(true);
  });

  it("should return true when latest minor is higher", () => {
    expect(isNewerVersion("0.1.9", "0.2.0")).toBe(true);
  });

  it("should return true when latest major is higher", () => {
    expect(isNewerVersion("0.9.9", "1.0.0")).toBe(true);
  });

  it("should ignore a leading v on either side", () => {
    expect(isNewerVersion("0.1.0", "v0.1.1")).toBe(true);
    expect(isNewerVersion("v0.1.0", "0.1.0")).toBe(false);
    expect(isNewerVersion("v0.1.0", "v0.2.0")).toBe(true);
  });

  it("should return false when current is newer than latest", () => {
    expect(isNewerVersion("0.2.0", "v0.1.0")).toBe(false);
    expect(isNewerVersion("1.0.0", "0.9.9")).toBe(false);
  });

  it("should compare numerically, not lexicographically", () => {
    expect(isNewerVersion("0.9.0", "0.10.0")).toBe(true);
    expect(isNewerVersion("0.10.0", "0.9.0")).toBe(false);
  });

  it("should strip prerelease suffixes before comparing", () => {
    expect(isNewerVersion("0.2.0-dev", "v0.2.0")).toBe(false);
    expect(isNewerVersion("0.1.0-beta.1", "v0.2.0")).toBe(true);
  });

  it("should treat missing segments as zero", () => {
    expect(isNewerVersion("0.1", "0.1.0")).toBe(false);
    expect(isNewerVersion("0.1", "0.1.1")).toBe(true);
  });

  it("should return false for unparsable latest strings", () => {
    expect(isNewerVersion("0.1.0", "")).toBe(false);
    expect(isNewerVersion("0.1.0", "not-a-version")).toBe(false);
  });
});
