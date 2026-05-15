import { describe, it } from "vitest";
import { renderCases } from "./cases.ts";
import { expectFixtureSameRender } from "./helpers.ts";

describe("render equivalence", () => {
  it.each(renderCases)("$fixture", async ({ fixture, options }) => {
    await expectFixtureSameRender(fixture, options);
  });
});
