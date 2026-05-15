import { describe, it } from "vitest";
import { semanticGroups } from "./cases.ts";
import { expectFixturePreservesSemantics } from "./helpers.ts";

describe("semantic preservation", () => {
  for (const { name, cases } of semanticGroups) {
    describe(name, () => {
      it.each(cases)("$fixture", async ({ fixture }) => {
        await expectFixturePreservesSemantics(fixture);
      });
    });
  }
});
