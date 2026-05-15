import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

export type Fixture = { input: string; expected: string };

export function loadFixture(name: string): Fixture {
  const inputPath = join(FIXTURES, name + ".hbs");
  const expectedPath = join(FIXTURES, name + ".expected.hbs");
  const input = readFileSync(inputPath, "utf8");
  const expected = existsSync(expectedPath) ? readFileSync(expectedPath, "utf8") : input;
  return { input: stripFinalNewline(input), expected: stripFinalNewline(expected) };
}

export function listFixtureNames(): string[] {
  return listFiles(FIXTURES)
    .filter((file) => file.endsWith(".hbs") && !file.endsWith(".expected.hbs"))
    .map((file) => relative(FIXTURES, file).replace(/\\/g, "/").replace(/\.hbs$/, ""))
    .sort();
}

export function stripFinalNewline(output: string): string {
  return output.endsWith("\n") ? output.slice(0, -1) : output;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}
