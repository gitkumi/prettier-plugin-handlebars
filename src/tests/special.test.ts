import { describe, it, expect } from "vitest";
import {
  format,
  expectAstEquivalent,
  expectFormat,
  expectFixture,
  expectFixtureSameRender,
  expectPreservesSemantics,
  loadFixture,
  stripFinalNewline,
} from "./helpers.ts";

// ---------------------------------------------------------------------------
// Edge cases & boundaries
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// String literal escaping (regression)
// ---------------------------------------------------------------------------

describe("string literal escaping", () => {
  it("escapes embedded double quotes", async () => {
    await expectFixture("escaping/embedded-double-quotes");
    await expectFixtureSameRender("escaping/embedded-double-quotes", {
      helpers: { helper: (s: string) => `got:${s}` },
    });
  });

  it("preserves backslashes literally (Handlebars does not decode \\\\)", async () => {
    // Handlebars 4.x only decodes `\"` -> `"` inside strings; backslashes pass
    // through unchanged. So `"a\\b"` round-trips as-is, value stays `a\\b`.
    await expectFixture("escaping/backslashes");
  });

  it("preserves single-quoted strings", async () => {
    await expectFixture("escaping/single-quoted");
  });

  it("preserves a single-quote character inside a double-quoted string", async () => {
    await expectFixture("escaping/single-quote-in-double-quoted");
    await expectFixtureSameRender("escaping/single-quote-in-double-quoted", {
      helpers: { helper: (s: string) => `got:${s}` },
    });
  });

  it("escapes a lone double quote in a string literal", async () => {
    // The AST's `.value` for `"\""` is a single `"` character.
    const { input } = loadFixture("escaping/lone-double-quote");
    await expectPreservesSemantics(input);
  });
});

// ---------------------------------------------------------------------------
// `{{^x}}A{{else}}B{{/x}}`: the Handlebars parser swaps program/inverse for
// inverse-opened blocks, but the plugin no longer reprints expressions —
// the source is preserved verbatim and semantics still round-trip.
// ---------------------------------------------------------------------------

describe("inverse opened block with else", () => {
  it("preserves the source and is stable", async () => {
    const { input } = loadFixture("inverse/opened-with-else");
    const out = await format(input);
    expect(stripFinalNewline(out)).toBe(input);
    expectAstEquivalent(input, out);
    expect(await format(out)).toBe(out);
  });
});

// ---------------------------------------------------------------------------
// CRLF line endings (input normalization) — kept inline because `\r\n` is a
// literal carriage-return + newline and would require CRLF-committed files
// to express in a fixture.
// ---------------------------------------------------------------------------

describe("line ending normalization", () => {
  it("handles CRLF input without crashing", async () => {
    const input = "{{#if x}}\r\n  content\r\n{{/if}}";
    const out = await format(input);
    // Whether the formatter normalizes to LF or preserves CRLF is an
    // implementation choice; semantics must be preserved either way.
    expectAstEquivalent(input, out);
    const second = await format(out);
    expect(second).toBe(out);
  });
});
