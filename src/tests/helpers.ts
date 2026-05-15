import { expect } from "vitest";
import * as prettier from "prettier";
import Handlebars from "handlebars";
import * as plugin from "../index.ts";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures");

export type RenderOptions = {
  context?: Record<string, unknown>;
  data?: Record<string, unknown>;
  helpers?: Record<string, (...args: any[]) => unknown>;
  partials?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Fixture loading
//
// Inputs live in `<fixtures>/<name>.hbs`. If a sibling `<name>.expected.hbs`
// exists, it's the expected formatted output; otherwise output == input.
// ---------------------------------------------------------------------------

export type Fixture = { input: string; expected: string };

export function loadFixture(name: string): Fixture {
  const inputPath = join(FIXTURES, name + ".hbs");
  const expectedPath = join(FIXTURES, name + ".expected.hbs");
  const input = readFileSync(inputPath, "utf8");
  const expected = existsSync(expectedPath)
    ? readFileSync(expectedPath, "utf8")
    : input;
  return { input: stripFinalNewline(input), expected: stripFinalNewline(expected) };
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

export async function format(input: string): Promise<string> {
  return prettier.format(input, {
    parser: "handlebars",
    plugins: [plugin],
  });
}

/** Assert exact formatted output and idempotency. Final newlines (which
 *  prettier always emits) are ignored when comparing. */
export async function expectFormat(input: string, expected: string) {
  const result = await format(input);
  expect(stripFinalNewline(result), `format mismatch for: ${input}`).toBe(
    stripFinalNewline(expected),
  );
  expectAstEquivalent(input, result);
  const second = await format(result);
  expect(second, `not idempotent for: ${input}`).toBe(result);
}

/** Load a fixture and assert it formats to its `.expected.hbs` (or itself). */
export async function expectFixture(name: string) {
  const { input, expected } = loadFixture(name);
  await expectFormat(input, expected);
}

// ---------------------------------------------------------------------------
// Semantic equivalence
//
// Strip loc/strip metadata, drop whitespace-only ContentStatements, and
// collapse whitespace runs in remaining ContentStatement values — HTML
// formatter-introduced whitespace reflow is not a semantic change.
// ---------------------------------------------------------------------------

function normalizeAst(obj: any): any {
  if (Array.isArray(obj)) {
    return obj
      .map(normalizeAst)
      .filter((n: any) => !(n && n.type === "ContentStatement" && !n.value?.trim()));
  }
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (
        [
          "loc",
          "strip",
          "openStrip",
          "inverseStrip",
          "closeStrip",
          "indent",
          "original",
          "rightStripped",
          "leftStripped",
        ].includes(k)
      ) {
        continue;
      }
      if (k === "value" && obj.type === "ContentStatement") {
        out[k] = (v as string).replace(/\s+/g, " ").trim();
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

export function expectAstEquivalent(input: string, output: string) {
  const originalAst = normalizeAst(Handlebars.parse(input));
  const formattedAst = normalizeAst(Handlebars.parse(output));
  expect(formattedAst, `semantics changed for: ${input}`).toEqual(originalAst);
}

export async function expectPreservesSemantics(input: string) {
  const result = await format(input);
  expectAstEquivalent(input, result);
}

export async function expectFixturePreservesSemantics(name: string) {
  const { input } = loadFixture(name);
  await expectPreservesSemantics(input);
}

// ---------------------------------------------------------------------------
// Render equivalence
// ---------------------------------------------------------------------------

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

export function stripFinalNewline(output: string): string {
  return output.endsWith("\n") ? output.slice(0, -1) : output;
}

export async function expectSameRender(input: string, options: RenderOptions = {}) {
  const result = await format(input);
  expect(stripFinalNewline(render(result, options))).toBe(
    stripFinalNewline(render(input, options)),
  );
}

export async function expectFixtureSameRender(name: string, options: RenderOptions = {}) {
  const { input } = loadFixture(name);
  await expectSameRender(input, options);
}
