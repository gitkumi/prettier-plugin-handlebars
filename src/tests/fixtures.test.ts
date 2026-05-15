import { describe, expect, it } from "vitest";
import { referencedFixtures } from "./cases.ts";
import { listFixtureNames } from "./helpers.ts";

describe("fixture manifest", () => {
  it("references every fixture file", () => {
    const fixtureNames = listFixtureNames();
    const unreferenced = fixtureNames.filter((fixture) => !referencedFixtures.has(fixture));
    const missing = [...referencedFixtures].filter((fixture) => !fixtureNames.includes(fixture));

    expect({ missing, unreferenced }).toEqual({ missing: [], unreferenced: [] });
  });
});
