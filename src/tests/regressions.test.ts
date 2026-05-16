import { describe, expect, it } from "vitest";
import { expectAstEquivalent, expectPreservesSemantics, format, loadFixture } from "./helpers.ts";

// Per-fixture format/semantic/idempotency coverage is driven from disk by the
// format and semantics suites. This file holds only bespoke assertions that
// check specific constructs survive — things a generic fixture run cannot say.

describe("edge cases", () => {
  it("handles empty input", async () => {
    expect(await format("")).toBe("");
  });

  it("handles whitespace-only input", async () => {
    expect(await format("   \n  \n  ")).toBe("");
  });

  it("handles single newline", async () => {
    expect(await format("\n")).toBe("");
  });
});

describe("complex templates", () => {
  it("keeps important page layout handlebars constructs", async () => {
    const { input } = loadFixture("complex/page-layout");
    const result = await format(input);
    expect(result).toContain("{{{this.title}}}");
    expect(result).toContain("{{> postFooter}}");
    expect(result).toContain("{{else}}");
  });

  it("keeps important form attributes", async () => {
    const { input } = loadFixture("complex/form-with-helpers");
    const result = await format(input);
    expect(result).toContain('action="/save"');
    expect(result).toContain('placeholder="Name"');
  });
});

describe("special syntax regressions", () => {
  it("preserves a lone double quote string literal semantically", async () => {
    const { input } = loadFixture("escaping/lone-double-quote");
    await expectPreservesSemantics(input);
  });

  it("handles CRLF input without crashing", async () => {
    const input = "{{#if x}}\r\n  content\r\n{{/if}}";
    const out = await format(input);
    expectAstEquivalent(input, out);
    const second = await format(out);
    expect(second).toBe(out);
  });
});
