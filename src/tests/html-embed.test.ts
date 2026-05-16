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

  // Embedded-language elements (script/style) are reformatted by prettier's
  // JS/CSS sub-printers, which rewrites the literal text — so these cannot be
  // pinned as format/semantic/render fixtures (AST and render equivalence both
  // operate on the literal string). The contract that holds is narrower: the
  // handlebars expression survives verbatim and the result is idempotent.
  it("preserves a handlebars expression inside <script> and stays idempotent", async () => {
    const input = "<script>\nvar count = {{count}};\nrender(count);\n</script>";
    const out = await format(input);
    expect(out).toContain("{{count}}");
    expect(await format(out)).toBe(out);
  });

  it("preserves a handlebars expression inside <style> and stays idempotent", async () => {
    const input = "<style>\n.a{color:{{color}};}\n</style>";
    const out = await format(input);
    expect(out).toContain("{{color}}");
    expect(await format(out)).toBe(out);
  });

  // The conditional-wrapper idiom opens a tag in one branch and closes it in
  // another; placeholdered, that markup is unbalanced and prettier's HTML
  // parser would reject it. The parser coalesces each such block so the file
  // formats instead of crashing with the opaque print() guard error.
  it("formats around a conditional tag-wrapper block instead of crashing", async () => {
    const input =
      '<div class="wrap">{{#if url}}<a href="{{url}}">{{else}}<span>{{/if}}{{label}}{{#if url}}</a>{{else}}</span>{{/if}}</div>';
    const out = await format(input);
    expect(out).toContain('{{#if url}}<a href="{{url}}">{{else}}<span>{{/if}}');
    expect(out).toContain("{{#if url}}</a>{{else}}</span>{{/if}}");
    expect(await format(out)).toBe(out);
  });
});
