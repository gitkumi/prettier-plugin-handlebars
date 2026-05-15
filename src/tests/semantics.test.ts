import { describe, it } from "vitest";
import { expectFixturePreservesSemantics } from "./helpers.ts";

// ---------------------------------------------------------------------------
// Semantic preservation — original set
// ---------------------------------------------------------------------------

describe("semantic preservation", () => {
  const cases: Array<{ name: string; fixture: string }> = [
    { name: "mustache simple", fixture: "semantics/mustache-simple" },
    { name: "triple-stache simple", fixture: "semantics/triple-stache-simple" },
    { name: "helper with mixed args", fixture: "semantics/helper-with-mixed-args" },
    { name: "if block", fixture: "semantics/if-block" },
    { name: "if/else block", fixture: "semantics/if-else-block" },
    { name: "if/else-if chain", fixture: "semantics/if-else-if-chain" },
    { name: "each with block params", fixture: "semantics/each-with-block-params" },
    { name: "partial with context and hash", fixture: "semantics/partial-with-context-and-hash" },
    { name: "sub-expression", fixture: "semantics/sub-expression" },
    { name: "simple comment", fixture: "semantics/comment-simple" },
    { name: "safe comment", fixture: "semantics/comment-safe" },
    { name: "parent path", fixture: "semantics/parent-path" },
    { name: "@index", fixture: "semantics/data-index" },
    { name: "explicit current path", fixture: "semantics/explicit-current-path" },
    { name: "@../index", fixture: "semantics/parent-data-index" },
    { name: "this keyword", fixture: "semantics/this-keyword" },
    { name: "dotted path", fixture: "semantics/dotted-path" },
    { name: "segment literal", fixture: "semantics/segment-literal" },
    { name: "nested segment literal", fixture: "semantics/nested-segment-literal" },
  ];

  for (const { name, fixture } of cases) {
    it(`preserves semantics for ${name}`, async () => {
      await expectFixturePreservesSemantics(fixture);
    });
  }
});

// ---------------------------------------------------------------------------
// Additional semantic preservation
// ---------------------------------------------------------------------------

describe("additional semantic preservation", () => {
  const cases: Array<{ name: string; fixture: string }> = [
    { name: "unless block", fixture: "semantics/unless-block" },
    { name: "with block", fixture: "semantics/with-block" },
    { name: "with block params", fixture: "semantics/with-block-params" },
    { name: "each with else", fixture: "semantics/each-with-else" },
    { name: "lookup helper", fixture: "semantics/lookup-helper" },
    { name: "log helper", fixture: "semantics/log-helper" },
    { name: "if with sub-expression", fixture: "semantics/if-with-sub-expression" },
    { name: "helper hash sub-expression", fixture: "semantics/helper-hash-sub-expression" },
    { name: "inverse shorthand", fixture: "semantics/inverse-shorthand" },
    { name: "partial with context and hash", fixture: "semantics/partial-with-context-and-hash-2" },
    { name: "@first", fixture: "semantics/data-first" },
    { name: "@last", fixture: "semantics/data-last" },
    { name: "@key", fixture: "semantics/data-key" },
  ];

  for (const { name, fixture } of cases) {
    it(`preserves semantics for ${name}`, async () => {
      await expectFixturePreservesSemantics(fixture);
    });
  }
});

// ---------------------------------------------------------------------------
// Array index path semantics
//
// All these inputs already exist as fixtures under array-index/ — reuse them
// rather than duplicating.
// ---------------------------------------------------------------------------

describe("array index path semantics", () => {
  const cases: Array<{ name: string; fixture: string }> = [
    { name: "single", fixture: "array-index/single" },
    { name: "multi-digit", fixture: "array-index/multi-digit" },
    { name: "with property", fixture: "array-index/with-property" },
    { name: "consecutive 2D", fixture: "array-index/consecutive-2d" },
    { name: "deep mixed", fixture: "array-index/deep-mixed" },
    { name: "top-level bare", fixture: "array-index/top-level-bare" },
    { name: "parent traversal", fixture: "array-index/parent-traversal" },
    { name: "on this", fixture: "array-index/on-this" },
    { name: "from @root", fixture: "array-index/from-root" },
    { name: "from explicit current", fixture: "array-index/from-explicit-current" },
    { name: "in triple-stache", fixture: "array-index/in-triple-stache" },
    { name: "as helper param", fixture: "array-index/as-helper-param" },
    { name: "as hash value", fixture: "array-index/as-hash-value" },
    { name: "in sub-expression", fixture: "array-index/in-sub-expression" },
    { name: "as lookup target", fixture: "array-index/as-lookup-target" },
    { name: "as partial context", fixture: "array-index/as-partial-context" },
    { name: "as if-block condition", fixture: "array-index/as-if-condition" },
    { name: "as each-block subject", fixture: "array-index/as-each-subject" },
    { name: "as with-block subject", fixture: "array-index/as-with-subject" },
    { name: "in block with block params", fixture: "array-index/in-block-with-block-params" },
  ];

  for (const { name, fixture } of cases) {
    it(`preserves semantics for ${name}`, async () => {
      await expectFixturePreservesSemantics(fixture);
    });
  }
});
