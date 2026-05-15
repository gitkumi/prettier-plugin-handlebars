import { describe, expect, it } from "vitest";
import { complexCases, regressionFixtures } from "./cases.ts";
import {
  expectAstEquivalent,
  expectPreservesSemantics,
  format,
  loadFixture,
  stripFinalNewline,
} from "./helpers.ts";

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
  it.each(complexCases)("$fixture", async ({ fixture }) => {
    const { input } = loadFixture(fixture);
    const result = await format(input);
    expectAstEquivalent(input, result);
    expect(await format(result)).toBe(result);
  });

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
  it.each(regressionFixtures)("preserves $fixture source and stability", async ({ fixture }) => {
    const { input } = loadFixture(fixture);
    const out = await format(input);
    expect(stripFinalNewline(out)).toBe(input);
    expectAstEquivalent(input, out);
    expect(await format(out)).toBe(out);
  });

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
