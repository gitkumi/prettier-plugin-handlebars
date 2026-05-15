import { describe, expect, it } from "vitest";
import { errorCases } from "./cases.ts";
import { format, loadFixture } from "./helpers.ts";

describe("error handling", () => {
  it.each(errorCases)("throws for $fixture", async ({ fixture }) => {
    const { input } = loadFixture(fixture);
    await expect(format(input)).rejects.toThrow();
  });
});
