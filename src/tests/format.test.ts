import { describe, it, expect } from "vitest";
import {
  expectFixture,
  expectSameRender,
  format,
  loadFixture,
  expectAstEquivalent,
  stripFinalNewline,
} from "./helpers.ts";

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

describe("plain text", () => {
  it("formats plain text", async () => {
    await expectFixture("mixed-html/plain-text");
  });

  it("collapses multiline text per HTML whitespace rules", async () => {
    // Delegating to prettier's HTML formatter means inter-word newlines
    // collapse to spaces, the same as a browser would render them.
    await expectFixture("mixed-html/multiline-text");
  });

  it("preserves special characters", async () => {
    await expectFixture("mixed-html/special-characters");
  });
});

// ---------------------------------------------------------------------------
// Mustache expressions
// ---------------------------------------------------------------------------

describe("mustache expressions", () => {
  it("formats simple expression", async () => {
    await expectFixture("mustache/simple");
  });

  it("formats expression with param", async () => {
    await expectFixture("mustache/with-param");
  });

  it("formats expression with string literal param", async () => {
    await expectFixture("mustache/with-string-literal-param");
  });

  it("formats expression with number literal param", async () => {
    await expectFixture("mustache/with-number-literal-param");
  });

  it("formats expression with negative number", async () => {
    await expectFixture("mustache/with-negative-number");
  });

  it("formats expression with boolean true", async () => {
    await expectFixture("mustache/with-boolean-true");
  });

  it("formats expression with boolean false", async () => {
    await expectFixture("mustache/with-boolean-false");
  });

  it("formats expression with undefined", async () => {
    await expectFixture("mustache/with-undefined");
  });

  it("formats expression with null", async () => {
    await expectFixture("mustache/with-null");
  });

  it("formats expression with multiple params", async () => {
    await expectFixture("mustache/with-multiple-params");
  });

  it("formats multiple inline expressions", async () => {
    await expectFixture("mustache/multiple-inline");
  });
});

// ---------------------------------------------------------------------------
// Triple-stache (unescaped)
// ---------------------------------------------------------------------------

describe("triple-stache (unescaped)", () => {
  it("formats triple-stache expression", async () => {
    await expectFixture("triple-stache/simple");
  });

  it("formats triple-stache with params", async () => {
    await expectFixture("triple-stache/with-params");
  });

  it("preserves mixed escaped and unescaped", async () => {
    await expectFixture("triple-stache/mixed-escaped-unescaped");
  });

  it("formats triple-stache inside block", async () => {
    await expectFixture("triple-stache/inside-block");
  });
});

// ---------------------------------------------------------------------------
// Whitespace control (~)
// ---------------------------------------------------------------------------

describe("whitespace control", () => {
  it("preserves ~ on open", async () => {
    await expectFixture("whitespace/open-tilde");
  });

  it("preserves ~ on close", async () => {
    await expectFixture("whitespace/close-tilde");
  });

  it("preserves ~ on both sides", async () => {
    await expectFixture("whitespace/both-tilde");
  });

  it("preserves ~ on block open/close tags", async () => {
    await expectFixture("whitespace/block-open-close");
  });

  it("preserves ~ on else", async () => {
    await expectFixture("whitespace/else-tilde");
  });

  it("preserves ~ on partial", async () => {
    await expectFixture("whitespace/partial-tilde");
  });

  it("preserves ~ on simple comment", async () => {
    await expectFixture("whitespace/simple-comment-tilde");
  });

  it("preserves ~ on safe comment", async () => {
    await expectFixture("whitespace/safe-comment-tilde");
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe("comments", () => {
  it("formats simple comment", async () => {
    await expectFixture("comments/simple");
  });

  it("formats safe comment", async () => {
    await expectFixture("comments/safe");
  });

  it("formats multiline safe comment", async () => {
    await expectFixture("comments/multiline-safe");
  });

  it("formats empty comment", async () => {
    await expectFixture("comments/empty");
  });

  it("formats comment inside block", async () => {
    await expectFixture("comments/inside-block");
  });

  it("formats comment between blocks", async () => {
    // HTML whitespace collapse joins these inline; the comment stays intact.
    await expectFixture("comments/between-blocks");
  });
});

// ---------------------------------------------------------------------------
// Hash arguments
// ---------------------------------------------------------------------------

describe("hash arguments", () => {
  it("formats single hash pair", async () => {
    await expectFixture("hash/single");
  });

  it("formats multiple hash pairs", async () => {
    await expectFixture("hash/multiple");
  });

  it("formats hash with path value", async () => {
    await expectFixture("hash/with-path-value");
  });

  it("formats hash with mixed params and hash", async () => {
    await expectFixture("hash/mixed-params-and-hash");
  });
});

// ---------------------------------------------------------------------------
// Path expressions
// ---------------------------------------------------------------------------

describe("path expressions", () => {
  it("formats dotted paths", async () => {
    await expectFixture("paths/dotted");
  });

  it("formats parent traversal", async () => {
    await expectFixture("paths/parent");
  });

  it("formats multi-level parent traversal", async () => {
    await expectFixture("paths/multi-level-parent");
  });

  it("formats this reference", async () => {
    await expectFixture("paths/this-dot");
  });

  it("formats this keyword alone", async () => {
    await expectFixture("paths/this-alone");
  });

  it("formats @data variables", async () => {
    await expectFixture("paths/data-variable");
  });

  it("formats @root data variable", async () => {
    await expectFixture("paths/root-data");
  });

  it("formats explicit current path", async () => {
    await expectFixture("paths/explicit-current");
  });

  it("formats parent data variable", async () => {
    await expectFixture("paths/parent-data-variable");
  });

  it("formats segment-literal path", async () => {
    await expectFixture("paths/segment-literal");
    const { input } = loadFixture("paths/segment-literal");
    await expectSameRender(input, {
      context: {
        "foo bar": "ok",
        bar: "value",
      },
      helpers: {
        foo(value: string) {
          return `bad:${value}`;
        },
      },
    });
  });

  it("formats nested segment-literal path", async () => {
    await expectFixture("paths/nested-segment-literal");
  });

  it("formats dot path (.)", async () => {
    await expectFixture("paths/dot-path");
  });
});

// ---------------------------------------------------------------------------
// Sub-expressions
// ---------------------------------------------------------------------------

describe("sub-expressions", () => {
  it("formats basic sub-expression", async () => {
    await expectFixture("sub-expressions/basic");
  });

  it("formats nested sub-expressions", async () => {
    await expectFixture("sub-expressions/nested");
  });

  it("formats sub-expression with hash", async () => {
    await expectFixture("sub-expressions/with-hash");
  });

  it("formats sub-expression with mixed args", async () => {
    await expectFixture("sub-expressions/with-mixed-args");
  });
});

// ---------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------

describe("block helpers", () => {
  it("formats simple block", async () => {
    await expectFixture("blocks/simple");
  });

  it("formats block with expressions in body", async () => {
    await expectFixture("blocks/with-expressions-in-body");
  });

  it("formats empty block", async () => {
    await expectFixture("blocks/empty");
  });

  it("formats block with block params", async () => {
    await expectFixture("blocks/with-block-params");
  });

  it("formats block with multiple block params", async () => {
    await expectFixture("blocks/with-multiple-block-params");
  });

  it("formats block with hash arguments", async () => {
    await expectFixture("blocks/with-hash-arguments");
  });

  it("formats nested blocks (2 levels)", async () => {
    await expectFixture("blocks/nested-2");
  });

  it("formats nested blocks (3 levels)", async () => {
    await expectFixture("blocks/nested-3");
  });

  it("formats nested blocks (4 levels)", async () => {
    await expectFixture("blocks/nested-4");
  });

  it("formats adjacent blocks", async () => {
    await expectFixture("blocks/adjacent");
  });

  it("formats adjacent blocks separated by newline", async () => {
    // HTML whitespace collapse joins these inline.
    await expectFixture("blocks/adjacent-newline");
  });
});

// ---------------------------------------------------------------------------
// Inverse blocks / else
// ---------------------------------------------------------------------------

describe("inverse blocks / else", () => {
  it("formats if/else", async () => {
    await expectFixture("inverse/if-else");
  });

  it("formats inverse shorthand with ^", async () => {
    await expectFixture("inverse/shorthand");
  });

  it("formats chained else-if (2 branches)", async () => {
    await expectFixture("inverse/chained-2");
  });

  it("formats chained else-if (4 branches)", async () => {
    await expectFixture("inverse/chained-4");
  });

  it("formats empty program with else content", async () => {
    await expectFixture("inverse/empty-program-with-else");
  });

  it("formats content with empty else", async () => {
    await expectFixture("inverse/content-with-empty-else");
  });

  it("formats both sides empty with else", async () => {
    await expectFixture("inverse/both-empty-with-else");
  });

  it("formats else in nested block", async () => {
    await expectFixture("inverse/nested");
  });
});

// ---------------------------------------------------------------------------
// Partials
// ---------------------------------------------------------------------------

describe("partials", () => {
  it("formats basic partial", async () => {
    await expectFixture("partials/basic");
  });

  it("formats partial with context", async () => {
    await expectFixture("partials/with-context");
  });

  it("formats partial with hash", async () => {
    await expectFixture("partials/with-hash");
  });

  it("formats dynamic partial", async () => {
    await expectFixture("partials/dynamic");
  });

  it("formats dynamic partial with context", async () => {
    await expectFixture("partials/dynamic-with-context");
  });

  it("formats partial inside block", async () => {
    await expectFixture("partials/inside-block");
  });
});

// ---------------------------------------------------------------------------
// Partial blocks
// ---------------------------------------------------------------------------

describe("partial blocks", () => {
  it("formats basic partial block", async () => {
    await expectFixture("partial-blocks/basic");
  });

  it("formats empty partial block", async () => {
    await expectFixture("partial-blocks/empty");
  });

  it("formats partial block with hash", async () => {
    await expectFixture("partial-blocks/with-hash");
  });
});

// ---------------------------------------------------------------------------
// Decorators
// ---------------------------------------------------------------------------

describe("decorators", () => {
  it("formats inline decorator", async () => {
    await expectFixture("decorators/inline");
  });

  it("formats inline decorator with params", async () => {
    await expectFixture("decorators/inline-with-params");
  });

  it("formats decorator block", async () => {
    await expectFixture("decorators/block");
  });

  it("formats inline partial inside block", async () => {
    await expectFixture("decorators/inline-partial-inside-block");
  });
});

// ---------------------------------------------------------------------------
// Raw blocks
// ---------------------------------------------------------------------------

describe("raw blocks", () => {
  it("formats raw block", async () => {
    await expectFixture("raw/basic");
    const { input } = loadFixture("raw/basic");
    await expectSameRender(input, {
      context: { parsed: "X" },
      helpers: {
        raw(options: any) {
          return options.fn(this);
        },
      },
    });
  });

  it("formats empty raw block", async () => {
    await expectFixture("raw/empty");
  });

  it("preserves triple-stache syntax inside raw block", async () => {
    await expectFixture("raw/with-triple-stache");
    const { input } = loadFixture("raw/with-triple-stache");
    await expectSameRender(input, {
      helpers: {
        raw(options: any) {
          return options.fn(this);
        },
      },
    });
  });

  it("preserves multiline raw block body exactly", async () => {
    await expectFixture("raw/multiline");
    const { input } = loadFixture("raw/multiline");
    await expectSameRender(input, {
      context: { parsed: "X" },
      helpers: {
        raw(options: any) {
          return options.fn(this);
        },
      },
    });
  });
});

// ---------------------------------------------------------------------------
// Mixed HTML and Handlebars
// ---------------------------------------------------------------------------

describe("mixed HTML and Handlebars", () => {
  it("formats inline HTML with expression", async () => {
    await expectFixture("mixed-html/inline-expression");
  });

  it("formats block within HTML", async () => {
    // Prettier's HTML formatter re-indents children of <ul>.
    await expectFixture("mixed-html/block-within-html");
  });

  it("formats text before and after block", async () => {
    // Whitespace between inline content collapses; the AST is preserved.
    await expectFixture("mixed-html/text-before-and-after");
  });

  it("formats block wrapped in inline HTML with nested span", async () => {
    await expectFixture("mixed-html/wrapped-with-nested-span");
  });
});

// ---------------------------------------------------------------------------
// Complex real-world templates
// ---------------------------------------------------------------------------

describe("complex real-world templates", () => {
  it("formats a page layout", async () => {
    const { input } = loadFixture("complex/page-layout");
    const result = await format(input);
    expectAstEquivalent(input, result);
    expect(await format(result)).toBe(result);
    expect(result).toContain("{{{this.title}}}");
    expect(result).toContain("{{> postFooter}}");
    expect(result).toContain("{{else}}");
  });

  it("formats a form template with helpers", async () => {
    const { input } = loadFixture("complex/form-with-helpers");
    const result = await format(input);
    expectAstEquivalent(input, result);
    expect(await format(result)).toBe(result);
    expect(result).toContain('action="/save"');
    expect(result).toContain('placeholder="Name"');
  });

  it("formats a navigation partial with conditionals", async () => {
    const { input } = loadFixture("complex/navigation");
    const result = await format(input);
    expectAstEquivalent(input, result);
    expect(await format(result)).toBe(result);
  });

  it("formats template with all feature types combined", async () => {
    const { input } = loadFixture("complex/all-features");
    const result = await format(input);
    expectAstEquivalent(input, result);
    expect(await format(result)).toBe(result);
  });
});

// ---------------------------------------------------------------------------
// Built-in helpers: unless, with, lookup, log
// ---------------------------------------------------------------------------

describe("built-in helpers", () => {
  it("formats unless block", async () => {
    await expectFixture("built-ins/unless");
  });

  it("formats unless with else", async () => {
    await expectFixture("built-ins/unless-with-else");
  });

  it("formats with block", async () => {
    await expectFixture("built-ins/with");
  });

  it("formats with block with else", async () => {
    await expectFixture("built-ins/with-else");
  });

  it("formats with block params", async () => {
    await expectFixture("built-ins/with-block-params");
  });

  it("formats each with else (empty list fallback)", async () => {
    await expectFixture("built-ins/each-with-else");
  });

  it("formats standalone lookup expression", async () => {
    await expectFixture("built-ins/lookup");
  });

  it("formats log helper", async () => {
    await expectFixture("built-ins/log");
  });

  it("formats log helper with level", async () => {
    await expectFixture("built-ins/log-with-level");
  });
});

// ---------------------------------------------------------------------------
// String literal edge cases
// ---------------------------------------------------------------------------

describe("string literal edge cases", () => {
  it("formats empty string literal", async () => {
    await expectFixture("literals/empty-string");
  });

  it("formats string with spaces", async () => {
    await expectFixture("literals/string-with-spaces");
  });

  it("formats decimal number literal", async () => {
    await expectFixture("literals/decimal");
  });

  it("formats zero literal", async () => {
    await expectFixture("literals/zero");
  });
});

// ---------------------------------------------------------------------------
// Additional path expression coverage
// ---------------------------------------------------------------------------

describe("additional path expressions", () => {
  it("formats multiple segment-literal segments", async () => {
    // [foo] and [bar] are simple identifiers, so brackets are normalized away
    await expectFixture("paths/multiple-segment-literals");
  });

  it("formats @first data variable", async () => {
    await expectFixture("paths/first-data");
  });

  it("formats @last data variable", async () => {
    await expectFixture("paths/last-data");
  });

  it("formats @key data variable", async () => {
    await expectFixture("paths/key-data");
  });
});

// ---------------------------------------------------------------------------
// Additional sub-expression coverage
// ---------------------------------------------------------------------------

describe("additional sub-expressions", () => {
  it("formats deeply nested sub-expressions (3 levels)", async () => {
    await expectFixture("sub-expressions/deeply-nested-3");
  });

  it("formats sub-expression as block condition", async () => {
    await expectFixture("sub-expressions/as-block-condition");
  });

  it("formats sub-expression in hash value", async () => {
    await expectFixture("sub-expressions/in-hash-value");
  });
});

// ---------------------------------------------------------------------------
// Additional block coverage
// ---------------------------------------------------------------------------

describe("additional block coverage", () => {
  it("formats block with both positional params and hash", async () => {
    await expectFixture("blocks/both-positional-and-hash");
  });

  it("formats inverse shorthand {{^}} standalone", async () => {
    await expectFixture("blocks/inverse-shorthand-standalone");
  });

  it("formats inverse shorthand with params", async () => {
    await expectFixture("blocks/inverse-shorthand-with-params");
  });
});

// ---------------------------------------------------------------------------
// Additional partial coverage
// ---------------------------------------------------------------------------

describe("additional partial coverage", () => {
  it("formats partial with both context and hash", async () => {
    await expectFixture("partials/with-context-and-hash");
  });

  it("formats partial block with inline partial inside", async () => {
    await expectFixture("partial-blocks/with-inline-partial-inside");
  });
});

// ---------------------------------------------------------------------------
// Comment edge cases
// ---------------------------------------------------------------------------

describe("comment edge cases", () => {
  it("formats safe comment containing }}", async () => {
    await expectFixture("comments/safe-containing-close-mustache");
  });

  it("formats safe comment containing {{", async () => {
    await expectFixture("comments/safe-containing-open-mustache");
  });
});

// ---------------------------------------------------------------------------
// Decorator strip flags (regression)
// ---------------------------------------------------------------------------

describe("decorator whitespace control", () => {
  it("preserves ~ on inline decorator", async () => {
    await expectFixture("decorators/tilde-both");
  });

  it("preserves ~ on inline decorator (open only)", async () => {
    await expectFixture("decorators/tilde-open-only");
  });

  it("preserves ~ on inline decorator (close only)", async () => {
    await expectFixture("decorators/tilde-close-only");
  });

  it("preserves ~ on inline decorator with params", async () => {
    await expectFixture("decorators/tilde-with-params");
  });
});

// ---------------------------------------------------------------------------
// Array index path access
//
// Handlebars 4.x requires purely-numeric path segments to be bracketed
// (`list.[0]`). Bare `list.0` is a parse error. Mixed segments that merely
// *contain* digits (`list.0a`, `list.foo-bar`) parse fine without brackets;
// only segments the lexer would consume as a NUMBER token need brackets.
// ---------------------------------------------------------------------------

describe("array index path access", () => {
  it("formats a single bracketed index", async () => {
    await expectFixture("array-index/single");
  });

  it("formats a multi-digit bracketed index", async () => {
    await expectFixture("array-index/multi-digit");
  });

  it("formats an index followed by a property", async () => {
    await expectFixture("array-index/with-property");
  });

  it("formats consecutive bracketed indices (2D array)", async () => {
    await expectFixture("array-index/consecutive-2d");
  });

  it("formats a deep mixed path", async () => {
    await expectFixture("array-index/deep-mixed");
  });

  it("formats a top-level bare bracketed index", async () => {
    await expectFixture("array-index/top-level-bare");
  });

  it("formats index access with parent traversal", async () => {
    await expectFixture("array-index/parent-traversal");
  });

  it("formats index access on `this`", async () => {
    await expectFixture("array-index/on-this");
  });

  it("formats index access from @root", async () => {
    await expectFixture("array-index/from-root");
  });

  it("formats index access from explicit current path", async () => {
    await expectFixture("array-index/from-explicit-current");
  });

  it("formats index access in a triple-stache", async () => {
    await expectFixture("array-index/in-triple-stache");
  });

  it("formats index access as a helper positional param", async () => {
    await expectFixture("array-index/as-helper-param");
  });

  it("formats index access as a hash value", async () => {
    await expectFixture("array-index/as-hash-value");
  });

  it("formats index access inside a sub-expression", async () => {
    await expectFixture("array-index/in-sub-expression");
  });

  it("formats index access as the lookup target", async () => {
    await expectFixture("array-index/as-lookup-target");
  });

  it("formats index access as a partial context (motivating example)", async () => {
    await expectFixture("array-index/as-partial-context");
  });

  it("formats index access in a partial with hash", async () => {
    await expectFixture("array-index/in-partial-with-hash");
  });

  it("formats index access as an if-block condition", async () => {
    await expectFixture("array-index/as-if-condition");
  });

  it("formats index access as an each-block subject", async () => {
    await expectFixture("array-index/as-each-subject");
  });

  it("formats index access as a with-block subject", async () => {
    await expectFixture("array-index/as-with-subject");
  });

  it("formats index access inside a block with block params", async () => {
    await expectFixture("array-index/in-block-with-block-params");
  });

  it("preserves mixed alphanumeric segment without brackets (parses unbracketed)", async () => {
    // `list.0a` is valid unbracketed because `0a` is not a NUMBER token.
    // Brackets are redundant here, so they should normalize away.
    await expectFixture("array-index/mixed-alphanumeric");
  });

  it("preserves alphanumeric-starting-with-digit segment without brackets", async () => {
    await expectFixture("array-index/digit-first-alphanumeric");
  });
});

// ---------------------------------------------------------------------------
// Partial block built-in `@partial-block`
// ---------------------------------------------------------------------------

describe("partial block builtins", () => {
  it("formats nested partial rendering @partial-block", async () => {
    await expectFixture("partial-blocks/nested-partial-block");
  });
});

// ---------------------------------------------------------------------------
// HTML formatting (delegated to prettier)
// ---------------------------------------------------------------------------

describe("HTML formatting (delegated to prettier)", () => {
  it("formats handlebars inside an attribute value", async () => {
    await expectFixture("html-formatting/handlebars-in-attribute");
  });

  it("normalizes element attribute spacing", async () => {
    // No handlebars in this input — purely a check that HTML normalization
    // runs. expectFormat would compare handlebars ASTs (the whole input is
    // one ContentStatement), and HTML whitespace normalization legitimately
    // changes that, so check the output directly.
    const out = await format('<div    class="x"   >hello {{name}}</div>');
    expect(stripFinalNewline(out)).toBe('<div class="x">hello {{name}}</div>');
  });

  it("reflows long opening tags onto multiple lines", async () => {
    const input =
      '<div class="aaaaaaaaaa bbbbbbbbbb cccccccccc dddddddddd eeeeeeeeee ffffffffff">{{x}}</div>';
    const out = await format(input);
    expect(out).toContain("\n");
    // Handlebars expression survives the reflow.
    expect(out).toContain("{{x}}");
  });
});
