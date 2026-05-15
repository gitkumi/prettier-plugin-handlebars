import { describe, it, expect } from "vitest";
import { format, loadFixture } from "./helpers.ts";

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("throws on invalid syntax", async () => {
    const { input } = loadFixture("errors/missing-condition");
    await expect(format(input)).rejects.toThrow();
  });

  it("throws on unclosed block", async () => {
    const { input } = loadFixture("errors/unclosed-block");
    await expect(format(input)).rejects.toThrow();
  });

  it("throws on mismatched close tag", async () => {
    const { input } = loadFixture("errors/mismatched-close");
    await expect(format(input)).rejects.toThrow();
  });
});
