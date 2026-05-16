import { describe, expect, it } from "vitest";
import { semanticCases } from "./cases.ts";
import { expectAstEquivalent, format, loadFixture } from "./helpers.ts";

// Fixtures the formatter reformats: output is not pinned, but meaning and
// idempotency must hold.
describe("semantic preservation", () => {
  it.each(semanticCases)("$fixture", async ({ fixture }) => {
    const { input } = loadFixture(fixture);
    const result = await format(input);
    expectAstEquivalent(input, result);
    expect(await format(result)).toBe(result);
  });
});
