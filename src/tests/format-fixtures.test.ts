import { describe, it } from "vitest";
import { exactFormatGroups } from "./cases.ts";
import { expectFixture } from "./helpers.ts";

describe("exact fixture formatting", () => {
  for (const { name, cases } of exactFormatGroups) {
    describe(name, () => {
      it.each(cases)("$fixture", async ({ fixture }) => {
        await expectFixture(fixture);
      });
    });
  }
});
