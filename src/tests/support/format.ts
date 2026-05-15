import { expect } from "vitest";
import * as prettier from "prettier";
import * as plugin from "../../index.ts";
import { expectAstEquivalent } from "./ast.ts";
import { loadFixture, stripFinalNewline } from "./fixtures.ts";

export async function format(input: string): Promise<string> {
  return prettier.format(input, {
    parser: "handlebars",
    plugins: [plugin],
  });
}

export async function expectFormat(input: string, expected: string) {
  const result = await format(input);
  expect(stripFinalNewline(result), `format mismatch for: ${input}`).toBe(
    stripFinalNewline(expected),
  );
  expectAstEquivalent(input, result);
  const second = await format(result);
  expect(second, `not idempotent for: ${input}`).toBe(result);
}

export async function expectFixture(name: string) {
  const { input, expected } = loadFixture(name);
  await expectFormat(input, expected);
}
