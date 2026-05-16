import { describe, it } from "vitest";
import { formatGroups } from "./cases.ts";
import { expectFixture } from "./helpers.ts";

describe("exact fixture formatting", () => {
  for (const { name, cases } of formatGroups) {
    describe(name, () => {
      it.each(cases)("$fixture", async ({ fixture }) => {
        await expectFixture(fixture);
      });
    });
  }
});
