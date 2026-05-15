import { expect } from "vitest";
import Handlebars from "handlebars";
import { format } from "./format.ts";
import { loadFixture } from "./fixtures.ts";

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
        out[k] = (v as string)
          .replace(/\s*([<>])\s*/g, "$1")
          .replace(/\s+/g, " ")
          .trim();
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
