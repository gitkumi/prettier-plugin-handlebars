import { describe, expect, it } from "vitest";
import { format, stripFinalNewline } from "./helpers.ts";

describe("HTML formatter delegation", () => {
  it("collapses redundant whitespace inside opening tags", async () => {
    const out = await format('<div    class="x"   >{{name}}</div>');
    expect(stripFinalNewline(out)).toBe('<div class="x">{{name}}</div>');
  });

  it("normalizes element attribute spacing around text and handlebars", async () => {
    const out = await format('<div    class="x"   >hello {{name}}</div>');
    expect(stripFinalNewline(out)).toBe('<div class="x">hello {{name}}</div>');
  });

  it("lowercases element tag names", async () => {
    const out = await format("<DIV>{{x}}</DIV>");
    expect(stripFinalNewline(out)).toBe("<div>{{x}}</div>");
  });

  it("normalizes attribute quote style to double quotes", async () => {
    const out = await format("<div class='card'>{{x}}</div>");
    expect(stripFinalNewline(out)).toBe('<div class="card">{{x}}</div>');
  });

  it("reflows long opening tags and preserves handlebars expressions", async () => {
    const input =
      '<div class="aaaaaaaaaa bbbbbbbbbb cccccccccc dddddddddd eeeeeeeeee ffffffffff">{{x}}</div>';
    const out = await format(input);
    expect(out).toContain("\n");
    expect(out).toContain("{{x}}");
  });
});
