import { describe, it, expect } from "vitest";
import { expectFixture, format, loadFixture, stripFinalNewline } from "./helpers.ts";

// Each test loads <name>.hbs as input and <name>.expected.hbs as the prettier
// HTML formatter's actual output. `expectFixture` asserts exact match,
// idempotency, AND that the semantic AST round-trips — so these tests
// simultaneously prove HTML formatting runs and that handlebars semantics
// survive the reflow.

describe("HTML integration — structure & indentation", () => {
  it("re-indents collapsed nested elements", () =>
    expectFixture("html-integration/nested-indentation"));

  it("indents children of <ul> with a wrapped each block", () =>
    expectFixture("html-integration/each-list"));

  it("indents table headers, rows, and each-generated body rows", () =>
    expectFixture("html-integration/table-with-block"));

  it("indents a full HTML document (DOCTYPE, head, body)", () =>
    expectFixture("html-integration/full-document"));

  it("indents nested handlebars blocks wrapping nested HTML", () =>
    expectFixture("html-integration/nested-blocks-in-html"));
});

describe("HTML integration — attribute handling", () => {
  it("reflows a long opening tag across multiple lines", () =>
    expectFixture("html-integration/long-tag-reflow"));

  it("preserves a handlebars block embedded in an attribute value", () =>
    expectFixture("html-integration/block-in-attribute"));

  it("preserves multiple handlebars expressions in a single attribute", () =>
    expectFixture("html-integration/attribute-with-multiple-expressions"));

  it("preserves a conditional that toggles an attribute", () =>
    expectFixture("html-integration/conditional-attribute-presence"));

  it("preserves whitespace inside an if-block in an attribute value", () =>
    expectFixture("html-integration/whitespace-in-if"));
});

describe("HTML integration — void & phrasing elements", () => {
  it("breaks void elements (<img>, <br>, <input>) inside a block parent", () =>
    expectFixture("html-integration/void-elements"));

  it("preserves whitespace-sensitive flow of paired/void siblings", () =>
    expectFixture("html-integration/self-closing-vs-paired"));

  it("reflows long paragraph text with inline phrasing children", () =>
    expectFixture("html-integration/inline-text-flow"));
});

describe("HTML integration — handlebars blocks around HTML", () => {
  it("keeps short conditional blocks on a single line inside parent element", () =>
    expectFixture("html-integration/block-wraps-element"));

  it("keeps short if/else-if/else chains on a single line", () =>
    expectFixture("html-integration/chained-else-if-in-html"));

  it("keeps a form with inline labels and a submit button", () =>
    expectFixture("html-integration/form-with-inputs"));
});

describe("HTML integration — comments", () => {
  it("preserves HTML <!-- --> alongside handlebars {{! }} and {{!-- --}}", () =>
    expectFixture("html-integration/html-and-hbs-comments"));
});

// ---------------------------------------------------------------------------
// Sanity checks — confirm the HTML formatter is actually doing work, not just
// returning the input unchanged. If these stop holding, the embed integration
// is silently broken even when other tests still pass.
// ---------------------------------------------------------------------------

describe("HTML integration — formatter is running", () => {
  it("collapses redundant whitespace inside opening tags", async () => {
    const out = await format('<div    class="x"   >{{name}}</div>');
    expect(stripFinalNewline(out)).toBe('<div class="x">{{name}}</div>');
  });

  it("lowercases element tag names", async () => {
    const out = await format("<DIV>{{x}}</DIV>");
    expect(stripFinalNewline(out)).toBe("<div>{{x}}</div>");
  });

  it("normalizes attribute quote style to double quotes", async () => {
    const out = await format("<div class='card'>{{x}}</div>");
    expect(stripFinalNewline(out)).toBe('<div class="card">{{x}}</div>');
  });

});
