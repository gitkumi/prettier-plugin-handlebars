import { describe, expect, it } from "vitest";
import { curatedFixtures, fixturesWithRenderOptions, renderFixturesOnDisk } from "./cases.ts";
import { listFixtureNames } from "./helpers.ts";

// Fixtures are discovered from disk, so the manifest cannot drift out of sync
// with the filesystem. The only drift discovery cannot prevent itself is
// stale curation: a curated name that no longer exists, or a render/ fixture
// missing its options.
describe("fixture manifest", () => {
  const onDisk = new Set(listFixtureNames());

  it("every curated fixture exists on disk", () => {
    expect(curatedFixtures.filter((fixture) => !onDisk.has(fixture))).toEqual([]);
  });

  it("every render/ fixture has render options", () => {
    expect(renderFixturesOnDisk.filter((f) => !fixturesWithRenderOptions.has(f))).toEqual([]);
  });
});
