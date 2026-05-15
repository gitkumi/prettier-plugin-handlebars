import { describe, it, expect } from "vitest";
import * as prettier from "prettier";
import Handlebars from "handlebars";
import * as plugin from "../src/index.ts";

type RenderOptions = {
  context?: Record<string, unknown>;
  data?: Record<string, unknown>;
  helpers?: Record<string, (...args: any[]) => unknown>;
  partials?: Record<string, string>;
};

async function format(input: string): Promise<string> {
  return prettier.format(input, {
    parser: "handlebars",
    plugins: [plugin],
  });
}

/** Assert exact formatted output AND idempotency in one call. */
async function expectFormat(input: string, expected: string) {
  const result = await format(input);
  expect(result, `format mismatch for: ${input}`).toBe(expected);
  expectAstEquivalent(input, result);
  const second = await format(result);
  expect(second, `not idempotent for: ${input}`).toBe(result);
}

/**
 * Assert the formatted output re-parses to a semantically equivalent AST.
 * Strips loc/strip metadata, whitespace-only content nodes, and normalizes
 * content values so that whitespace changes from formatting don't cause
 * false negatives.
 */
function normalizeAst(obj: any): any {
  if (Array.isArray(obj)) {
    return obj
      .map(normalizeAst)
      .filter(
        (n: any) =>
          !(n && n.type === "ContentStatement" && !n.value?.trim()),
      );
  }
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (["loc", "strip", "openStrip", "inverseStrip", "closeStrip", "indent", "original", "rightStripped", "leftStripped"].includes(k)) continue;
      if (k === "value" && obj.type === "ContentStatement") {
        out[k] = (v as string).trim();
        continue;
      }
      if (k === "value" && obj.type === "CommentStatement") {
        out[k] = (v as string).trim();
        continue;
      }
      out[k] = normalizeAst(v);
    }
    return out;
  }
  return obj;
}

function expectAstEquivalent(input: string, output: string) {
  const originalAst = normalizeAst(Handlebars.parse(input));
  const formattedAst = normalizeAst(Handlebars.parse(output));
  expect(formattedAst, `semantics changed for: ${input}`).toEqual(originalAst);
}

async function expectPreservesSemantics(input: string) {
  const result = await format(input);
  expectAstEquivalent(input, result);
}

function render(input: string, options: RenderOptions = {}): string {
  const runtime = Handlebars.create();

  for (const [name, helper] of Object.entries(options.helpers ?? {})) {
    runtime.registerHelper(name, helper);
  }

  for (const [name, partial] of Object.entries(options.partials ?? {})) {
    runtime.registerPartial(name, partial);
  }

  return runtime.compile(input)(options.context ?? {}, {
    data: options.data ?? {},
  });
}

function stripFinalNewline(output: string): string {
  return output.endsWith("\n") ? output.slice(0, -1) : output;
}

async function expectSameRender(input: string, options: RenderOptions = {}) {
  const result = await format(input);
  expect(stripFinalNewline(render(result, options))).toBe(
    stripFinalNewline(render(input, options)),
  );
}

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
// Plain text
// ---------------------------------------------------------------------------

describe("plain text", () => {
  it("formats plain text", async () => {
    await expectFormat("hello world", "hello world");
  });

  it("preserves multiline text", async () => {
    await expectFormat("line1\nline2", "line1\nline2");
  });

  it("preserves special characters", async () => {
    await expectFormat("<p>&amp; &lt; &gt;</p>", "<p>&amp; &lt; &gt;</p>");
  });

});

// ---------------------------------------------------------------------------
// Mustache expressions
// ---------------------------------------------------------------------------

describe("mustache expressions", () => {
  it("formats simple expression", async () => {
    await expectFormat("{{hello}}", "{{hello}}");
  });

  it("formats expression with param", async () => {
    await expectFormat("{{hello world}}", "{{hello world}}");
  });

  it("formats expression with string literal param", async () => {
    await expectFormat('{{helper "world"}}', "{{helper \"world\"}}");
  });

  it("formats expression with number literal param", async () => {
    await expectFormat("{{helper 42}}", "{{helper 42}}");
  });

  it("formats expression with negative number", async () => {
    await expectFormat("{{helper -1}}", "{{helper -1}}");
  });

  it("formats expression with boolean true", async () => {
    await expectFormat("{{helper true}}", "{{helper true}}");
  });

  it("formats expression with boolean false", async () => {
    await expectFormat("{{helper false}}", "{{helper false}}");
  });

  it("formats expression with undefined", async () => {
    await expectFormat("{{helper undefined}}", "{{helper undefined}}");
  });

  it("formats expression with null", async () => {
    await expectFormat("{{helper null}}", "{{helper null}}");
  });

  it("formats expression with multiple params", async () => {
    await expectFormat('{{helper "a" "b" "c"}}', "{{helper \"a\" \"b\" \"c\"}}");
  });

  it("formats multiple inline expressions", async () => {
    await expectFormat("{{first}} {{second}} {{third}}", "{{first}} {{second}} {{third}}");
  });
});

// ---------------------------------------------------------------------------
// Triple-stache (unescaped)
// ---------------------------------------------------------------------------

describe("triple-stache (unescaped)", () => {
  it("formats triple-stache expression", async () => {
    await expectFormat("{{{hello}}}", "{{{hello}}}");
  });

  it("formats triple-stache with params", async () => {
    await expectFormat("{{{helper arg}}}", "{{{helper arg}}}");
  });

  it("preserves mixed escaped and unescaped", async () => {
    await expectFormat("{{escaped}} and {{{unescaped}}}", "{{escaped}} and {{{unescaped}}}");
  });

  it("formats triple-stache inside block", async () => {
    await expectFormat("{{#if x}}{{{raw}}}{{/if}}", "{{#if x}}{{{raw}}}{{/if}}");
  });
});

// ---------------------------------------------------------------------------
// Whitespace control (~)
// ---------------------------------------------------------------------------

describe("whitespace control", () => {
  it("preserves ~ on open", async () => {
    await expectFormat("{{~hello}}", "{{~hello}}");
  });

  it("preserves ~ on close", async () => {
    await expectFormat("{{hello~}}", "{{hello~}}");
  });

  it("preserves ~ on both sides", async () => {
    await expectFormat("{{~hello~}}", "{{~hello~}}");
  });

  it("preserves ~ on block open/close tags", async () => {
    await expectFormat("{{~#if x~}}content{{~/if~}}", "{{~#if x~}}content{{~/if~}}");
  });

  it("preserves ~ on else", async () => {
    await expectFormat("{{#if x}}yes{{~else~}}no{{/if}}", "{{#if x}}yes{{~else~}}no{{/if}}");
  });

  it("preserves ~ on partial", async () => {
    await expectFormat("{{~> myPartial~}}", "{{~> myPartial~}}");
  });

  it("preserves ~ on simple comment", async () => {
    await expectFormat("{{~! comment ~}}", "{{~! comment ~}}");
  });

  it("preserves ~ on safe comment", async () => {
    await expectFormat("{{~!-- comment --~}}", "{{~!-- comment --~}}");
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe("comments", () => {
  it("formats simple comment", async () => {
    await expectFormat("{{! this is a comment }}", "{{! this is a comment }}");
  });

  it("formats safe comment", async () => {
    await expectFormat("{{!-- this is a comment --}}", "{{!-- this is a comment --}}");
  });

  it("formats multiline safe comment", async () => {
    await expectFormat("{{!--\n  line1\n  line2\n--}}", "{{!--\n  line1\n  line2\n--}}");
  });

  it("formats empty comment", async () => {
    await expectFormat("{{!}}", "{{!  }}");
  });

  it("formats comment inside block", async () => {
    await expectFormat("{{#if x}}{{! note }}content{{/if}}", "{{#if x}}{{! note }}content{{/if}}");
  });

  it("formats comment between blocks", async () => {
    await expectFormat("{{#if a}}x{{/if}}\n{{! separator }}\n{{#if b}}y{{/if}}", "{{#if a}}x{{/if}}\n{{! separator }}\n{{#if b}}y{{/if}}");
  });
});

// ---------------------------------------------------------------------------
// Hash arguments
// ---------------------------------------------------------------------------

describe("hash arguments", () => {
  it("formats single hash pair", async () => {
    await expectFormat("{{helper key=value}}", "{{helper key=value}}");
  });

  it("formats multiple hash pairs", async () => {
    await expectFormat('{{helper key="val" num=42 bool=true}}', "{{helper key=\"val\" num=42 bool=true}}");
  });

  it("formats hash with path value", async () => {
    await expectFormat("{{helper key=some.path}}", "{{helper key=some.path}}");
  });

  it("formats hash with mixed params and hash", async () => {
    await expectFormat('{{helper positional key="named"}}', "{{helper positional key=\"named\"}}");
  });
});

// ---------------------------------------------------------------------------
// Path expressions
// ---------------------------------------------------------------------------

describe("path expressions", () => {
  it("formats dotted paths", async () => {
    await expectFormat("{{person.name}}", "{{person.name}}");
  });

  it("formats parent traversal", async () => {
    await expectFormat("{{../parent}}", "{{../parent}}");
  });

  it("formats multi-level parent traversal", async () => {
    await expectFormat("{{../../grandparent}}", "{{../../grandparent}}");
  });

  it("formats this reference", async () => {
    await expectFormat("{{this.foo}}", "{{this.foo}}");
  });

  it("formats this keyword alone", async () => {
    await expectFormat("{{this}}", "{{this}}");
  });

  it("formats @data variables", async () => {
    await expectFormat("{{@index}}", "{{@index}}");
  });

  it("formats @root data variable", async () => {
    await expectFormat("{{@root.name}}", "{{@root.name}}");
  });

  it("formats explicit current path", async () => {
    await expectFormat("{{./foo}}", "{{./foo}}");
  });

  it("formats parent data variable", async () => {
    await expectFormat("{{@../index}}", "{{@../index}}");
  });

  it("formats segment-literal path", async () => {
    const input = "{{[foo bar]}}";
    await expectFormat(input, "{{[foo bar]}}");
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
    await expectFormat("{{foo.[bar baz]}}", "{{foo.[bar baz]}}");
  });

  it("formats dot path (.)", async () => {
    await expectFormat("{{helper .}}", "{{helper .}}");
  });
});

// ---------------------------------------------------------------------------
// Sub-expressions
// ---------------------------------------------------------------------------

describe("sub-expressions", () => {
  it("formats basic sub-expression", async () => {
    await expectFormat("{{helper (subexpr arg)}}", "{{helper (subexpr arg)}}");
  });

  it("formats nested sub-expressions", async () => {
    await expectFormat("{{helper (a (b c))}}", "{{helper (a (b c))}}");
  });

  it("formats sub-expression with hash", async () => {
    await expectFormat("{{helper (subexpr key=val)}}", "{{helper (subexpr key=val)}}");
  });

  it("formats sub-expression with mixed args", async () => {
    await expectFormat('{{helper (subexpr arg1 "arg2" key=val)}}', "{{helper (subexpr arg1 \"arg2\" key=val)}}");
  });
});

// ---------------------------------------------------------------------------
// Block helpers
// ---------------------------------------------------------------------------

describe("block helpers", () => {
  it("formats simple block", async () => {
    await expectFormat("{{#if condition}}content{{/if}}", "{{#if condition}}content{{/if}}");
  });

  it("formats block with expressions in body", async () => {
    await expectFormat("{{#each items}}{{this}}{{/each}}", "{{#each items}}{{this}}{{/each}}");
  });

  it("formats empty block", async () => {
    await expectFormat("{{#if x}}{{/if}}", "{{#if x}}{{/if}}");
  });

  it("formats block with block params", async () => {
    await expectFormat("{{#each items as |item|}}{{item}}{{/each}}", "{{#each items as |item|}}{{item}}{{/each}}");
  });

  it("formats block with multiple block params", async () => {
    await expectFormat("{{#each map as |value key|}}{{key}}: {{value}}{{/each}}", "{{#each map as |value key|}}{{key}}: {{value}}{{/each}}");
  });

  it("formats block with hash arguments", async () => {
    await expectFormat('{{#component name="test"}}content{{/component}}', "{{#component name=\"test\"}}content{{/component}}");
  });

  it("formats nested blocks (2 levels)", async () => {
    await expectFormat("{{#if a}}{{#if b}}content{{/if}}{{/if}}", "{{#if a}}{{#if b}}content{{/if}}{{/if}}");
  });

  it("formats nested blocks (3 levels)", async () => {
    await expectFormat("{{#if a}}{{#each items}}{{#if b}}x{{/if}}{{/each}}{{/if}}", "{{#if a}}{{#each items}}{{#if b}}x{{/if}}{{/each}}{{/if}}");
  });

  it("formats nested blocks (4 levels)", async () => {
    await expectFormat("{{#a}}{{#b}}{{#c}}{{#d}}x{{/d}}{{/c}}{{/b}}{{/a}}", "{{#a}}{{#b}}{{#c}}{{#d}}x{{/d}}{{/c}}{{/b}}{{/a}}");
  });

  it("formats adjacent blocks", async () => {
    await expectFormat("{{#if a}}x{{/if}}{{#if b}}y{{/if}}", "{{#if a}}x{{/if}}{{#if b}}y{{/if}}");
  });

  it("formats adjacent blocks separated by newline", async () => {
    await expectFormat("{{#if a}}x{{/if}}\n{{#if b}}y{{/if}}", "{{#if a}}x{{/if}}\n{{#if b}}y{{/if}}");
  });
});

// ---------------------------------------------------------------------------
// Inverse blocks / else
// ---------------------------------------------------------------------------

describe("inverse blocks / else", () => {
  it("formats if/else", async () => {
    await expectFormat("{{#if x}}yes{{else}}no{{/if}}", "{{#if x}}yes{{else}}no{{/if}}");
  });

  it("formats inverse shorthand with ^", async () => {
    await expectFormat("{{^if condition}}content{{/if}}", "{{^if condition}}content{{/if}}");
  });

  it("formats chained else-if (2 branches)", async () => {
    await expectFormat("{{#if a}}one{{else if b}}two{{else}}three{{/if}}", "{{#if a}}one{{else if b}}two{{else}}three{{/if}}");
  });

  it("formats chained else-if (4 branches)", async () => {
    await expectFormat("{{#if a}}1{{else if b}}2{{else if c}}3{{else if d}}4{{else}}5{{/if}}", "{{#if a}}1{{else if b}}2{{else if c}}3{{else if d}}4{{else}}5{{/if}}");
  });

  it("formats empty program with else content", async () => {
    await expectFormat("{{#if x}}{{else}}fallback{{/if}}", "{{#if x}}{{else}}fallback{{/if}}");
  });

  it("formats content with empty else", async () => {
    await expectFormat("{{#if x}}content{{else}}{{/if}}", "{{#if x}}content{{else}}{{/if}}");
  });

  it("formats both sides empty with else", async () => {
    await expectFormat("{{#if x}}{{else}}{{/if}}", "{{#if x}}{{else}}{{/if}}");
  });

  it("formats else in nested block", async () => {
    await expectFormat("{{#if a}}{{#if b}}x{{else}}y{{/if}}{{/if}}", "{{#if a}}{{#if b}}x{{else}}y{{/if}}{{/if}}");
  });
});

// ---------------------------------------------------------------------------
// Partials
// ---------------------------------------------------------------------------

describe("partials", () => {
  it("formats basic partial", async () => {
    await expectFormat("{{> myPartial}}", "{{> myPartial}}");
  });

  it("formats partial with context", async () => {
    await expectFormat("{{> myPartial context}}", "{{> myPartial context}}");
  });

  it("formats partial with hash", async () => {
    await expectFormat("{{> myPartial key=value}}", "{{> myPartial key=value}}");
  });

  it("formats dynamic partial", async () => {
    await expectFormat("{{> (lookup . 'name')}}", "{{> (lookup . \"name\")}}");
  });

  it("formats dynamic partial with context", async () => {
    await expectFormat("{{> (lookup . 'partialName') context}}", "{{> (lookup . \"partialName\") context}}");
  });

  it("formats partial inside block", async () => {
    await expectFormat("{{#if x}}{{> myPartial}}{{/if}}", "{{#if x}}{{> myPartial}}{{/if}}");
  });
});

// ---------------------------------------------------------------------------
// Partial blocks
// ---------------------------------------------------------------------------

describe("partial blocks", () => {
  it("formats basic partial block", async () => {
    await expectFormat("{{#> myPartial}}fallback{{/myPartial}}", "{{#> myPartial}}fallback{{/myPartial}}");
  });

  it("formats empty partial block", async () => {
    await expectFormat("{{#> myPartial}}{{/myPartial}}", "{{#> myPartial}}{{/myPartial}}");
  });

  it("formats partial block with hash", async () => {
    await expectFormat('{{#> layout title="Home"}}body{{/layout}}', "{{#> layout title=\"Home\"}}body{{/layout}}");
  });
});

// ---------------------------------------------------------------------------
// Decorators
// ---------------------------------------------------------------------------

describe("decorators", () => {
  it("formats inline decorator", async () => {
    await expectFormat("{{* decorator}}", "{{* decorator}}");
  });

  it("formats inline decorator with params", async () => {
    await expectFormat("{{* decorator arg}}", "{{* decorator arg}}");
  });

  it("formats decorator block", async () => {
    await expectFormat('{{#*inline "myPartial"}}content{{/inline}}', "{{#*inline \"myPartial\"}}content{{/inline}}");
  });

  it("formats inline partial inside block", async () => {
    await expectFormat('{{#if x}}{{#*inline "nav"}}nav content{{/inline}}body{{/if}}', "{{#if x}}{{#*inline \"nav\"}}nav content{{/inline}}body{{/if}}");
  });
});

// ---------------------------------------------------------------------------
// Raw blocks
// ---------------------------------------------------------------------------

describe("raw blocks", () => {
  it("formats raw block", async () => {
    const input = "{{{{raw}}}}not {{parsed}}{{{{/raw}}}}";
    await expectFormat(input, "{{{{raw}}}}not {{parsed}}{{{{/raw}}}}");
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
    await expectFormat("{{{{raw}}}}{{{{/raw}}}}", "{{{{raw}}}}{{{{/raw}}}}");
  });

  it("preserves triple-stache syntax inside raw block", async () => {
    const input = "{{{{raw}}}}{{{triple}}} and {{double}}{{{{/raw}}}}";
    await expectFormat(input, "{{{{raw}}}}{{{triple}}} and {{double}}{{{{/raw}}}}");
    await expectSameRender(input, {
      helpers: {
        raw(options: any) {
          return options.fn(this);
        },
      },
    });
  });

  it("preserves multiline raw block body exactly", async () => {
    const input = "{{{{raw}}}}\n  not {{parsed}}\n{{{{/raw}}}}";
    await expectFormat(input, "{{{{raw}}}}\n  not {{parsed}}\n{{{{/raw}}}}");
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
    await expectFormat("<div>{{name}}</div>", "<div>{{name}}</div>");
  });

  it("formats block within HTML", async () => {
    await expectFormat("<ul>\n{{#each items}}\n<li>{{this}}</li>\n{{/each}}\n</ul>", "<ul>\n{{#each items}}\n<li>{{this}}</li>\n{{/each}}\n</ul>");
  });

  it("formats text before and after block", async () => {
    await expectFormat("before\n{{#if x}}content{{/if}}\nafter", "before\n{{#if x}}content{{/if}}\nafter");
  });

  it("formats block wrapped in inline HTML with nested span", async () => {
    await expectFormat("<div>{{#if x}}<span>{{name}}</span>{{/if}}</div>", "<div>{{#if x}}<span>{{name}}</span>{{/if}}</div>");
  });
});

// ---------------------------------------------------------------------------
// Semantic preservation
// ---------------------------------------------------------------------------

describe("semantic preservation", () => {
  const templates = [
    "{{hello}}",
    "{{{unescaped}}}",
    '{{helper "str" 42 true key=val}}',
    "{{#if x}}content{{/if}}",
    "{{#if x}}yes{{else}}no{{/if}}",
    "{{#if a}}1{{else if b}}2{{else}}3{{/if}}",
    "{{#each items as |item|}}{{item}}{{/each}}",
    "{{> myPartial context key=val}}",
    "{{helper (sub arg)}}",
    "{{! comment }}",
    "{{!-- safe comment --}}",
    "{{../parent}}",
    "{{@index}}",
    "{{./foo}}",
    "{{@../index}}",
    "{{this}}",
    "{{person.name}}",
    "{{[foo bar]}}",
    "{{foo.[bar baz]}}",
  ];

  for (const tmpl of templates) {
    it(`preserves semantics for: ${tmpl}`, async () => {
      await expectPreservesSemantics(tmpl);
    });
  }
});

// ---------------------------------------------------------------------------
// Complex real-world templates
// ---------------------------------------------------------------------------

describe("complex real-world templates", () => {
  it("formats a page layout", async () => {
    const input = [
      "<html>",
      "<body>",
      "{{#if user}}",
      "<h1>Hello, {{user.name}}!</h1>",
      "{{#each user.posts}}",
      "<article>",
      "<h2>{{{this.title}}}</h2>",
      "<p>{{this.body}}</p>",
      "{{> postFooter}}",
      "</article>",
      "{{/each}}",
      "{{else}}",
      "<p>Please log in</p>",
      "{{/if}}",
      "</body>",
      "</html>",
    ].join("\n");

    const result = await format(input);
    expectAstEquivalent(input, result);
    expect(await format(result)).toBe(result);
    expect(result).toContain("{{{this.title}}}");
    expect(result).toContain("{{> postFooter}}");
    expect(result).toContain("{{else}}");
  });

  it("formats a form template with helpers", async () => {
    const input =
      '{{#form model action="/save"}}{{input "name" value=model.name placeholder="Name"}}{{#if errors}}<span class="error">{{errors.name}}</span>{{/if}}{{/form}}';
    const result = await format(input);
    expectAstEquivalent(input, result);
    expect(await format(result)).toBe(result);
    expect(result).toContain('action="/save"');
    expect(result).toContain('placeholder="Name"');
  });

  it("formats a navigation partial with conditionals", async () => {
    const input = [
      "{{#each navItems}}",
      '<a href="{{this.url}}" class="{{#if this.active}}active{{/if}}">',
      "{{this.label}}",
      "{{#if this.badge}}",
      '<span class="badge">{{this.badge}}</span>',
      "{{/if}}",
      "</a>",
      "{{/each}}",
    ].join("\n");

    const result = await format(input);
    expectAstEquivalent(input, result);
    expect(await format(result)).toBe(result);
  });

  it("formats template with all feature types combined", async () => {
    const input = [
      "{{! Page header }}",
      "{{> header}}",
      "{{#if authenticated}}",
      '{{#*inline "userBadge"}}<span>{{@root.user.name}}</span>{{/inline}}',
      "{{{dangerousHtml}}}",
      "{{#each items as |item idx|}}",
      "{{~#if item.visible~}}",
      '{{helper (lookup ../config "formatter") item key=idx}}',
      "{{~/if~}}",
      "{{/each}}",
      "{{else}}",
      "{{> loginForm action='/login'}}",
      "{{/if}}",
      "{{!-- end template --}}",
    ].join("\n");

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
    await expectFormat("{{#unless hidden}}visible{{/unless}}", "{{#unless hidden}}visible{{/unless}}");
  });

  it("formats unless with else", async () => {
    await expectFormat("{{#unless hidden}}visible{{else}}hidden{{/unless}}", "{{#unless hidden}}visible{{else}}hidden{{/unless}}");
  });

  it("formats with block", async () => {
    await expectFormat("{{#with person}}{{firstname}} {{lastname}}{{/with}}", "{{#with person}}{{firstname}} {{lastname}}{{/with}}");
  });

  it("formats with block with else", async () => {
    await expectFormat("{{#with person}}Hello {{name}}{{else}}No person{{/with}}", "{{#with person}}Hello {{name}}{{else}}No person{{/with}}");
  });

  it("formats with block params", async () => {
    await expectFormat("{{#with person as |p|}}{{p.name}}{{/with}}", "{{#with person as |p|}}{{p.name}}{{/with}}");
  });

  it("formats each with else (empty list fallback)", async () => {
    await expectFormat("{{#each items}}{{this}}{{else}}No items{{/each}}", "{{#each items}}{{this}}{{else}}No items{{/each}}");
  });

  it("formats standalone lookup expression", async () => {
    await expectFormat("{{lookup items 0}}", "{{lookup items 0}}");
  });

  it("formats log helper", async () => {
    await expectFormat("{{log \"debug info\"}}", "{{log \"debug info\"}}");
  });

  it("formats log helper with level", async () => {
    await expectFormat('{{log "message" level="warn"}}', "{{log \"message\" level=\"warn\"}}");
  });
});

// ---------------------------------------------------------------------------
// String literal edge cases
// ---------------------------------------------------------------------------

describe("string literal edge cases", () => {
  it("formats empty string literal", async () => {
    await expectFormat('{{helper ""}}', "{{helper \"\"}}");
  });

  it("formats string with spaces", async () => {
    await expectFormat('{{helper "hello world"}}', "{{helper \"hello world\"}}");
  });

  it("formats decimal number literal", async () => {
    await expectFormat("{{helper 3.14}}", "{{helper 3.14}}");
  });

  it("formats zero literal", async () => {
    await expectFormat("{{helper 0}}", "{{helper 0}}");
  });
});

// ---------------------------------------------------------------------------
// Additional path expression coverage
// ---------------------------------------------------------------------------

describe("additional path expressions", () => {
  it("formats multiple segment-literal segments", async () => {
    // [foo] and [bar] are simple identifiers, so brackets are normalized away
    await expectFormat("{{[foo].[bar]}}", "{{foo.bar}}");
  });

  it("formats @first data variable", async () => {
    await expectFormat("{{@first}}", "{{@first}}");
  });

  it("formats @last data variable", async () => {
    await expectFormat("{{@last}}", "{{@last}}");
  });

  it("formats @key data variable", async () => {
    await expectFormat("{{@key}}", "{{@key}}");
  });
});

// ---------------------------------------------------------------------------
// Additional sub-expression coverage
// ---------------------------------------------------------------------------

describe("additional sub-expressions", () => {
  it("formats deeply nested sub-expressions (3 levels)", async () => {
    await expectFormat("{{helper (a (b (c d)))}}", "{{helper (a (b (c d)))}}");
  });

  it("formats sub-expression as block condition", async () => {
    await expectFormat("{{#if (isdefined value)}}yes{{/if}}", "{{#if (isdefined value)}}yes{{/if}}");
  });

  it("formats sub-expression in hash value", async () => {
    await expectFormat("{{helper key=(subexpr arg)}}", "{{helper key=(subexpr arg)}}");
  });
});

// ---------------------------------------------------------------------------
// Additional block coverage
// ---------------------------------------------------------------------------

describe("additional block coverage", () => {
  it("formats block with both positional params and hash", async () => {
    await expectFormat('{{#helper param1 key="val"}}content{{/helper}}', "{{#helper param1 key=\"val\"}}content{{/helper}}");
  });

  it("formats inverse shorthand {{^}} standalone", async () => {
    await expectFormat("{{^isActive}}inactive{{/isActive}}", "{{^isActive}}inactive{{/isActive}}");
  });

  it("formats inverse shorthand with params", async () => {
    await expectFormat("{{^if condition}}fallback{{/if}}", "{{^if condition}}fallback{{/if}}");
  });
});

// ---------------------------------------------------------------------------
// Additional partial coverage
// ---------------------------------------------------------------------------

describe("additional partial coverage", () => {
  it("formats partial with both context and hash", async () => {
    await expectFormat("{{> myPartial context key=value}}", "{{> myPartial context key=value}}");
  });

  it("formats partial block with inline partial inside", async () => {
    await expectFormat('{{#> layout}}{{#*inline "header"}}My Header{{/inline}}Body{{/layout}}', "{{#> layout}}{{#*inline \"header\"}}My Header{{/inline}}Body{{/layout}}");
  });
});

// ---------------------------------------------------------------------------
// Comment edge cases
// ---------------------------------------------------------------------------

describe("comment edge cases", () => {
  it("formats safe comment containing }}", async () => {
    await expectFormat("{{!-- contains }} inside --}}", "{{!-- contains }} inside --}}");
  });

  it("formats safe comment containing {{", async () => {
    await expectFormat("{{!-- contains {{ inside --}}", "{{!-- contains {{ inside --}}");
  });
});

// ---------------------------------------------------------------------------
// Exact render preservation
// ---------------------------------------------------------------------------

describe("exact render preservation", () => {

  it("renders same output for helper with params", async () => {
    await expectSameRender('{{join items ","}}', {
      context: { items: ["a", "b", "c"] },
      helpers: {
        join(items: string[], sep: string) {
          return items.join(sep);
        },
      },
    });
  });

  it("renders same output for partial with context", async () => {
    await expectSameRender("{{> greeting person}}", {
      context: { person: { name: "Bob" } },
      partials: { greeting: "Hello {{name}}!" },
    });
  });

  it("renders same output for partial with hash", async () => {
    await expectSameRender('{{> greeting name="World"}}', {
      partials: { greeting: "Hello {{name}}!" },
    });
  });

  it("renders same output for triple-stache (unescaped)", async () => {
    await expectSameRender("{{{html}}}", {
      context: { html: "<b>bold</b>" },
    });
  });

  it("renders same output for lookup helper", async () => {
    await expectSameRender("{{lookup items 1}}", {
      context: { items: ["a", "b", "c"] },
    });
  });

  it("renders same output for sub-expression", async () => {
    await expectSameRender("{{capitalize (getName person)}}", {
      context: { person: { name: "alice" } },
      helpers: {
        getName(person: { name: string }) {
          return person.name;
        },
        capitalize(str: string) {
          return str.charAt(0).toUpperCase() + str.slice(1);
        },
      },
    });
  });

  it("renders same output for raw block", async () => {
    await expectSameRender("{{{{raw}}}}not {{parsed}}{{{{/raw}}}}", {
      context: { parsed: "X" },
      helpers: {
        raw(options: any) {
          return options.fn(this);
        },
      },
    });
  });

  it("renders same output for whitespace-controlled block", async () => {
    await expectSameRender("a {{~#if x~}} b {{~/if~}} c", {
      context: { x: true },
    });
  });
});

// ---------------------------------------------------------------------------
// Additional semantic preservation
// ---------------------------------------------------------------------------

describe("additional semantic preservation", () => {
  const templates = [
    "{{#unless hidden}}visible{{/unless}}",
    "{{#with person}}{{name}}{{/with}}",
    "{{#with person as |p|}}{{p.name}}{{/with}}",
    "{{#each items}}{{this}}{{else}}empty{{/each}}",
    "{{lookup items 0}}",
    "{{log \"debug\"}}",
    "{{#if (isdefined val)}}yes{{/if}}",
    "{{helper key=(sub arg)}}",
    "{{^isActive}}fallback{{/isActive}}",
    "{{> partial context key=val}}",
    "{{@first}}",
    "{{@last}}",
    "{{@key}}",
  ];

  for (const tmpl of templates) {
    it(`preserves semantics for: ${tmpl}`, async () => {
      await expectPreservesSemantics(tmpl);
    });
  }
});

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe("error handling", () => {
  it("throws on invalid syntax", async () => {
    await expect(format("{{#if}}")).rejects.toThrow();
  });

  it("throws on unclosed block", async () => {
    await expect(format("{{#if x}}content")).rejects.toThrow();
  });

  it("throws on mismatched close tag", async () => {
    await expect(format("{{#if x}}content{{/each}}")).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// String literal escaping (regression)
// ---------------------------------------------------------------------------

describe("string literal escaping", () => {
  it("escapes embedded double quotes", async () => {
    await expectFormat('{{helper "say \\"hi\\""}}', "{{helper \"say \\\"hi\\\"\"}}");
    await expectSameRender('{{helper "say \\"hi\\""}}', {
      helpers: { helper: (s: string) => `got:${s}` },
    });
  });

  it("preserves backslashes literally (Handlebars does not decode \\\\)", async () => {
    // Handlebars 4.x only decodes `\"` -> `"` inside strings; backslashes pass
    // through unchanged. So `"a\\b"` round-trips as-is, value stays `a\\b`.
    await expectFormat('{{helper "a\\\\b"}}', "{{helper \"a\\\\b\"}}");
  });

  it("normalizes single-quoted strings to double-quoted", async () => {
    await expectFormat("{{helper 'hello'}}", "{{helper \"hello\"}}");
  });

  it("preserves a single-quote character inside a double-quoted string", async () => {
    await expectFormat('{{helper "it\'s"}}', "{{helper \"it's\"}}");
    await expectSameRender('{{helper "it\'s"}}', {
      helpers: { helper: (s: string) => `got:${s}` },
    });
  });

  it("escapes a lone double quote in a string literal", async () => {
    // The AST's `.value` for `"\""` is a single `"` character.
    await expectPreservesSemantics('{{helper "\\""}}');
  });
});

// ---------------------------------------------------------------------------
// Decorator strip flags (regression)
// ---------------------------------------------------------------------------

describe("decorator whitespace control", () => {
  it("preserves ~ on inline decorator", async () => {
    await expectFormat("{{~* dec~}}", "{{~* dec~}}");
  });

  it("preserves ~ on inline decorator (open only)", async () => {
    await expectFormat("{{~* dec}}", "{{~* dec}}");
  });

  it("preserves ~ on inline decorator (close only)", async () => {
    await expectFormat("{{* dec~}}", "{{* dec~}}");
  });

  it("preserves ~ on inline decorator with params", async () => {
    await expectFormat("{{~* dec arg key=val~}}", "{{~* dec arg key=val~}}");
  });
});

// ---------------------------------------------------------------------------
// `{{^x}}A{{else}}B{{/x}}` is rewritten to `{{#x}}B{{else}}A{{/x}}` because
// the Handlebars parser swaps program/inverse for inverse-opened blocks. The
// output is semantically identical.
// ---------------------------------------------------------------------------

describe("inverse opened block with else", () => {
  it("rewrites to {{#x}}<else>{{else}}<body>{{/x}} and is stable", async () => {
    const input = "{{^x}}inv{{else}}els{{/x}}";
    const out = await format(input);
    expect(out).toBe("{{#x}}els{{else}}inv{{/x}}");
    expectAstEquivalent(input, out);
    expect(await format(out)).toBe(out);
  });
});

// ---------------------------------------------------------------------------
// CRLF line endings (input normalization)
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
    await expectFormat("{{list.[0]}}", "{{list.[0]}}");
  });

  it("formats a multi-digit bracketed index", async () => {
    await expectFormat("{{list.[42]}}", "{{list.[42]}}");
  });

  it("formats an index followed by a property", async () => {
    await expectFormat("{{list.[0].name}}", "{{list.[0].name}}");
  });

  it("formats consecutive bracketed indices (2D array)", async () => {
    await expectFormat("{{matrix.[0].[1]}}", "{{matrix.[0].[1]}}");
  });

  it("formats a deep mixed path", async () => {
    await expectFormat("{{users.[0].posts.[2].title}}", "{{users.[0].posts.[2].title}}");
  });

  it("formats a top-level bare bracketed index", async () => {
    await expectFormat("{{[0]}}", "{{[0]}}");
  });

  it("formats index access with parent traversal", async () => {
    await expectFormat("{{../list.[0]}}", "{{../list.[0]}}");
  });

  it("formats index access on `this`", async () => {
    await expectFormat("{{this.[0]}}", "{{this.[0]}}");
  });

  it("formats index access from @root", async () => {
    await expectFormat("{{@root.users.[0]}}", "{{@root.users.[0]}}");
  });

  it("formats index access from explicit current path", async () => {
    await expectFormat("{{./list.[0]}}", "{{./list.[0]}}");
  });

  it("formats index access in a triple-stache", async () => {
    await expectFormat("{{{list.[0]}}}", "{{{list.[0]}}}");
  });

  it("formats index access as a helper positional param", async () => {
    await expectFormat("{{helper list.[0]}}", "{{helper list.[0]}}");
  });

  it("formats index access as a hash value", async () => {
    await expectFormat("{{helper key=list.[0]}}", "{{helper key=list.[0]}}");
  });

  it("formats index access inside a sub-expression", async () => {
    await expectFormat("{{helper (sub list.[0])}}", "{{helper (sub list.[0])}}");
  });

  it("formats index access as the lookup target", async () => {
    await expectFormat('{{lookup list.[0] "name"}}', "{{lookup list.[0] \"name\"}}");
  });

  it("formats index access as a partial context (motivating example)", async () => {
    await expectFormat("{{> component list.[0]}}", "{{> component list.[0]}}");
  });

  it("formats index access in a partial with hash", async () => {
    await expectFormat("{{> row list.[0] highlight=true}}", "{{> row list.[0] highlight=true}}");
  });

  it("formats index access as an if-block condition", async () => {
    await expectFormat("{{#if list.[0]}}yes{{/if}}", "{{#if list.[0]}}yes{{/if}}");
  });

  it("formats index access as an each-block subject", async () => {
    await expectFormat("{{#each list.[0].items}}{{this}}{{/each}}", "{{#each list.[0].items}}{{this}}{{/each}}");
  });

  it("formats index access as a with-block subject", async () => {
    await expectFormat("{{#with list.[0]}}{{name}}{{/with}}", "{{#with list.[0]}}{{name}}{{/with}}");
  });

  it("formats index access inside a block with block params", async () => {
    await expectFormat("{{#each list.[0] as |item|}}{{item}}{{/each}}", "{{#each list.[0] as |item|}}{{item}}{{/each}}");
  });

  it("preserves mixed alphanumeric segment without brackets (parses unbracketed)", async () => {
    // `list.0a` is valid unbracketed because `0a` is not a NUMBER token.
    // Brackets are redundant here, so they should normalize away.
    await expectFormat("{{list.[0a]}}", "{{list.0a}}");
  });

  it("preserves alphanumeric-starting-with-digit segment without brackets", async () => {
    await expectFormat("{{list.[1foo]}}", "{{list.1foo}}");
  });

  it("renders same output for partial with index context (motivating example)", async () => {
    await expectSameRender("{{> row list.[0]}}", {
      context: { list: [{ name: "first" }, { name: "second" }] },
      partials: { row: "<li>{{name}}</li>" },
    });
  });

  it("renders same output for triple-stache index access", async () => {
    await expectSameRender("{{{html.[0]}}}", {
      context: { html: ["<b>a</b>", "<i>b</i>"] },
    });
  });

  it("renders same output for deep mixed path", async () => {
    await expectSameRender("{{users.[0].posts.[1].title}}", {
      context: {
        users: [
          { posts: [{ title: "p0" }, { title: "p1" }] },
        ],
      },
    });
  });

  it("renders same output for lookup with index path", async () => {
    await expectSameRender('{{lookup users.[0] "name"}}', {
      context: { users: [{ name: "Alice" }] },
    });
  });
});

describe("array index path semantics", () => {
  const templates = [
    "{{list.[0]}}",
    "{{list.[42]}}",
    "{{list.[0].name}}",
    "{{matrix.[0].[1]}}",
    "{{users.[0].posts.[2].title}}",
    "{{[0]}}",
    "{{../list.[0]}}",
    "{{this.[0]}}",
    "{{@root.users.[0]}}",
    "{{./list.[0]}}",
    "{{{list.[0]}}}",
    "{{helper list.[0]}}",
    "{{helper key=list.[0]}}",
    "{{helper (sub list.[0])}}",
    '{{lookup list.[0] "name"}}',
    "{{> component list.[0]}}",
    "{{#if list.[0]}}yes{{/if}}",
    "{{#each list.[0].items}}{{this}}{{/each}}",
    "{{#with list.[0]}}{{name}}{{/with}}",
    "{{#each list.[0] as |item|}}{{item}}{{/each}}",
  ];

  for (const tmpl of templates) {
    it(`preserves semantics for: ${tmpl}`, async () => {
      await expectPreservesSemantics(tmpl);
    });
  }
});

// ---------------------------------------------------------------------------
// Partial block built-in `@partial-block`
// ---------------------------------------------------------------------------

describe("partial block builtins", () => {
  it("formats nested partial rendering @partial-block", async () => {
    await expectFormat("{{#> layout}}{{> @partial-block}}{{/layout}}", "{{#> layout}}{{> @partial-block}}{{/layout}}");
  });
});

describe("whatever", () => {
  it("formats", async () => {
    await expectFormat('<div> class="foo {{#if class}}{{class}}{{/if}}">{{> @partial-block}}</div>', "<div> class=\"foo {{#if class}}{{class}}{{/if}}\">{{> @partial-block}}</div>");
  })
})
