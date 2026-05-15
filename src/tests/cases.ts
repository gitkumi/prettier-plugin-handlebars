import type { RenderOptions } from "./helpers.ts";

export type FixtureCase = {
  name: string;
  fixture: string;
};

export type FixtureGroup = {
  name: string;
  cases: FixtureCase[];
};

export type RenderFixtureCase = FixtureCase & {
  options: RenderOptions;
};

export const exactFormatGroups: FixtureGroup[] = [
  group("plain text", [
    "mixed-html/plain-text",
    "mixed-html/multiline-text",
    "mixed-html/special-characters",
  ]),
  group("mustache expressions", [
    "mustache/simple",
    "mustache/with-param",
    "mustache/with-string-literal-param",
    "mustache/with-number-literal-param",
    "mustache/with-negative-number",
    "mustache/with-boolean-true",
    "mustache/with-boolean-false",
    "mustache/with-undefined",
    "mustache/with-null",
    "mustache/with-multiple-params",
    "mustache/multiple-inline",
  ]),
  group("triple-stache", [
    "triple-stache/simple",
    "triple-stache/with-params",
    "triple-stache/mixed-escaped-unescaped",
    "triple-stache/inside-block",
  ]),
  group("whitespace control", [
    "whitespace/open-tilde",
    "whitespace/close-tilde",
    "whitespace/both-tilde",
    "whitespace/block-open-close",
    "whitespace/else-tilde",
    "whitespace/partial-tilde",
    "whitespace/simple-comment-tilde",
    "whitespace/safe-comment-tilde",
  ]),
  group("comments", [
    "comments/simple",
    "comments/safe",
    "comments/multiline-safe",
    "comments/empty",
    "comments/inside-block",
    "comments/between-blocks",
    "comments/safe-containing-close-mustache",
    "comments/safe-containing-open-mustache",
  ]),
  group("hash arguments", [
    "hash/single",
    "hash/multiple",
    "hash/with-path-value",
    "hash/mixed-params-and-hash",
  ]),
  group("path expressions", [
    "paths/dotted",
    "paths/parent",
    "paths/multi-level-parent",
    "paths/this-dot",
    "paths/this-alone",
    "paths/data-variable",
    "paths/root-data",
    "paths/explicit-current",
    "paths/parent-data-variable",
    "paths/segment-literal",
    "paths/nested-segment-literal",
    "paths/dot-path",
    "paths/multiple-segment-literals",
    "paths/first-data",
    "paths/last-data",
    "paths/key-data",
  ]),
  group("sub-expressions", [
    "sub-expressions/basic",
    "sub-expressions/nested",
    "sub-expressions/with-hash",
    "sub-expressions/with-mixed-args",
    "sub-expressions/deeply-nested-3",
    "sub-expressions/as-block-condition",
    "sub-expressions/in-hash-value",
  ]),
  group("blocks", [
    "blocks/simple",
    "blocks/with-expressions-in-body",
    "blocks/empty",
    "blocks/with-block-params",
    "blocks/with-multiple-block-params",
    "blocks/with-hash-arguments",
    "blocks/nested-2",
    "blocks/nested-3",
    "blocks/nested-4",
    "blocks/adjacent",
    "blocks/adjacent-newline",
    "blocks/both-positional-and-hash",
    "blocks/inverse-shorthand-standalone",
    "blocks/inverse-shorthand-with-params",
  ]),
  group("inverse blocks", [
    "inverse/if-else",
    "inverse/shorthand",
    "inverse/chained-2",
    "inverse/chained-4",
    "inverse/empty-program-with-else",
    "inverse/content-with-empty-else",
    "inverse/both-empty-with-else",
    "inverse/nested",
  ]),
  group("partials", [
    "partials/basic",
    "partials/with-context",
    "partials/with-hash",
    "partials/dynamic",
    "partials/dynamic-with-context",
    "partials/inside-block",
    "partials/with-context-and-hash",
  ]),
  group("partial blocks", [
    "partial-blocks/basic",
    "partial-blocks/empty",
    "partial-blocks/with-hash",
    "partial-blocks/with-inline-partial-inside",
    "partial-blocks/nested-partial-block",
  ]),
  group("decorators", [
    "decorators/inline",
    "decorators/inline-with-params",
    "decorators/block",
    "decorators/inline-partial-inside-block",
    "decorators/tilde-both",
    "decorators/tilde-open-only",
    "decorators/tilde-close-only",
    "decorators/tilde-with-params",
  ]),
  group("raw blocks", ["raw/basic", "raw/empty", "raw/with-triple-stache", "raw/multiline"]),
  group("mixed HTML and Handlebars", [
    "mixed-html/inline-expression",
    "mixed-html/block-within-html",
    "mixed-html/text-before-and-after",
    "mixed-html/wrapped-with-nested-span",
  ]),
  group("built-in helpers", [
    "built-ins/unless",
    "built-ins/unless-with-else",
    "built-ins/with",
    "built-ins/with-else",
    "built-ins/with-block-params",
    "built-ins/each",
    "built-ins/each-with-else",
    "built-ins/lookup",
    "built-ins/log",
    "built-ins/log-with-level",
  ]),
  group("literal edge cases", [
    "literals/empty-string",
    "literals/string-with-spaces",
    "literals/decimal",
    "literals/zero",
  ]),
  group("array index paths", [
    "array-index/single",
    "array-index/multi-digit",
    "array-index/with-property",
    "array-index/consecutive-2d",
    "array-index/deep-mixed",
    "array-index/top-level-bare",
    "array-index/parent-traversal",
    "array-index/on-this",
    "array-index/from-root",
    "array-index/from-explicit-current",
    "array-index/in-triple-stache",
    "array-index/as-helper-param",
    "array-index/as-hash-value",
    "array-index/in-sub-expression",
    "array-index/as-lookup-target",
    "array-index/as-partial-context",
    "array-index/in-partial-with-hash",
    "array-index/as-if-condition",
    "array-index/as-each-subject",
    "array-index/as-with-subject",
    "array-index/in-block-with-block-params",
    "array-index/mixed-alphanumeric",
    "array-index/digit-first-alphanumeric",
  ]),
  group("HTML integration", [
    "html-integration/nested-indentation",
    "html-integration/each-list",
    "html-integration/table-with-block",
    "html-integration/full-document",
    "html-integration/nested-blocks-in-html",
    "html-integration/long-tag-reflow",
    "html-integration/block-in-attribute",
    "html-integration/attribute-with-multiple-expressions",
    "html-integration/conditional-attribute-presence",
    "html-integration/whitespace-in-if",
    "html-integration/void-elements",
    "html-integration/self-closing-vs-paired",
    "html-integration/inline-text-flow",
    "html-integration/block-wraps-element",
    "html-integration/chained-else-if-in-html",
    "html-integration/form-with-inputs",
    "html-integration/html-and-hbs-comments",
  ]),
  group("HTML formatting", ["html-formatting/handlebars-in-attribute"]),
  group("string literal escaping", [
    "escaping/embedded-double-quotes",
    "escaping/backslashes",
    "escaping/single-quoted",
    "escaping/single-quote-in-double-quoted",
  ]),
];

export const complexCases: FixtureCase[] = cases([
  "complex/page-layout",
  "complex/form-with-helpers",
  "complex/navigation",
  "complex/all-features",
]);

export const semanticGroups: FixtureGroup[] = [
  group("semantic preservation", [
    "semantics/mustache-simple",
    "semantics/triple-stache-simple",
    "semantics/helper-with-mixed-args",
    "semantics/if-block",
    "semantics/if-else-block",
    "semantics/if-else-if-chain",
    "semantics/each-with-block-params",
    "semantics/partial-with-context-and-hash",
    "semantics/sub-expression",
    "semantics/comment-simple",
    "semantics/comment-safe",
    "semantics/parent-path",
    "semantics/data-index",
    "semantics/explicit-current-path",
    "semantics/parent-data-index",
    "semantics/this-keyword",
    "semantics/dotted-path",
    "semantics/segment-literal",
    "semantics/nested-segment-literal",
  ]),
  group("additional semantic preservation", [
    "semantics/unless-block",
    "semantics/with-block",
    "semantics/with-block-params",
    "semantics/each-with-else",
    "semantics/lookup-helper",
    "semantics/log-helper",
    "semantics/if-with-sub-expression",
    "semantics/helper-hash-sub-expression",
    "semantics/inverse-shorthand",
    "semantics/partial-with-context-and-hash-2",
    "semantics/data-first",
    "semantics/data-last",
    "semantics/data-key",
  ]),
  group("array index path semantics", [
    "array-index/single",
    "array-index/multi-digit",
    "array-index/with-property",
    "array-index/consecutive-2d",
    "array-index/deep-mixed",
    "array-index/top-level-bare",
    "array-index/parent-traversal",
    "array-index/on-this",
    "array-index/from-root",
    "array-index/from-explicit-current",
    "array-index/in-triple-stache",
    "array-index/as-helper-param",
    "array-index/as-hash-value",
    "array-index/in-sub-expression",
    "array-index/as-lookup-target",
    "array-index/as-partial-context",
    "array-index/as-if-condition",
    "array-index/as-each-subject",
    "array-index/as-with-subject",
    "array-index/in-block-with-block-params",
  ]),
  group("semantic regressions", ["escaping/lone-double-quote"]),
];

export const renderCases: RenderFixtureCase[] = [
  {
    name: "helper with params",
    fixture: "render/helper-with-params",
    options: {
      context: { items: ["a", "b", "c"] },
      helpers: {
        join(items: string[], sep: string) {
          return items.join(sep);
        },
      },
    },
  },
  {
    name: "partial with context",
    fixture: "render/partial-with-context",
    options: {
      context: { person: { name: "Bob" } },
      partials: { greeting: "Hello {{name}}!" },
    },
  },
  {
    name: "partial with hash",
    fixture: "render/partial-with-hash",
    options: { partials: { greeting: "Hello {{name}}!" } },
  },
  {
    name: "triple-stache",
    fixture: "render/triple-stache",
    options: { context: { html: "<b>bold</b>" } },
  },
  {
    name: "lookup helper",
    fixture: "render/lookup-helper",
    options: { context: { items: ["a", "b", "c"] } },
  },
  {
    name: "sub-expression",
    fixture: "render/sub-expression",
    options: {
      context: { person: { name: "alice" } },
      helpers: {
        getName(person: { name: string }) {
          return person.name;
        },
        capitalize(str: string) {
          return str.charAt(0).toUpperCase() + str.slice(1);
        },
      },
    },
  },
  {
    name: "raw block",
    fixture: "render/raw-block",
    options: {
      context: { parsed: "X" },
      helpers: {
        raw(options: any) {
          return options.fn(this);
        },
      },
    },
  },
  {
    name: "whitespace-controlled block",
    fixture: "render/whitespace-controlled-block",
    options: { context: { x: true } },
  },
  {
    name: "partial with index context",
    fixture: "render/partial-with-index-context",
    options: {
      context: { list: [{ name: "first" }, { name: "second" }] },
      partials: { row: "<li>{{name}}</li>" },
    },
  },
  {
    name: "triple-stache index access",
    fixture: "render/triple-stache-index-access",
    options: { context: { html: ["<b>a</b>", "<i>b</i>"] } },
  },
  {
    name: "deep mixed path",
    fixture: "render/deep-mixed-path",
    options: { context: { users: [{ posts: [{ title: "p0" }, { title: "p1" }] }] } },
  },
  {
    name: "lookup with index path",
    fixture: "render/lookup-with-index-path",
    options: { context: { users: [{ name: "Alice" }] } },
  },
  {
    name: "segment-literal path",
    fixture: "paths/segment-literal",
    options: {
      context: { "foo bar": "ok", bar: "value" },
      helpers: {
        foo(value: string) {
          return `bad:${value}`;
        },
      },
    },
  },
  rawRenderCase("raw/basic", { parsed: "X" }),
  rawRenderCase("raw/with-triple-stache"),
  rawRenderCase("raw/multiline", { parsed: "X" }),
  {
    name: "embedded double quotes",
    fixture: "escaping/embedded-double-quotes",
    options: { helpers: { helper: (s: string) => `got:${s}` } },
  },
  {
    name: "single quote inside double-quoted string",
    fixture: "escaping/single-quote-in-double-quoted",
    options: { helpers: { helper: (s: string) => `got:${s}` } },
  },
];

export const errorCases: FixtureCase[] = cases([
  "errors/missing-condition",
  "errors/unclosed-block",
  "errors/mismatched-close",
]);

export const regressionFixtures: FixtureCase[] = cases(["inverse/opened-with-else"]);

export const referencedFixtures = new Set([
  ...exactFormatGroups.flatMap((fixtureGroup) => fixtureGroup.cases.map(({ fixture }) => fixture)),
  ...complexCases.map(({ fixture }) => fixture),
  ...semanticGroups.flatMap((fixtureGroup) => fixtureGroup.cases.map(({ fixture }) => fixture)),
  ...renderCases.map(({ fixture }) => fixture),
  ...errorCases.map(({ fixture }) => fixture),
  ...regressionFixtures.map(({ fixture }) => fixture),
]);

function group(name: string, fixtures: string[]): FixtureGroup {
  return { name, cases: cases(fixtures) };
}

function cases(fixtures: string[]): FixtureCase[] {
  return fixtures.map((fixture) => ({
    name: fixture.slice(fixture.lastIndexOf("/") + 1),
    fixture,
  }));
}

function rawRenderCase(fixture: string, context: Record<string, unknown> = {}): RenderFixtureCase {
  return {
    name: fixture,
    fixture,
    options: {
      context,
      helpers: {
        raw(options: any) {
          return options.fn(this);
        },
      },
    },
  };
}
