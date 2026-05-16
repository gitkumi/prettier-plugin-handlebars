import type { RenderOptions } from "./helpers.ts";
import { listFixtureNames } from "./helpers.ts";

export type FixtureCase = {
  name: string;
  fixture: string;
};

export type FixtureGroup = {
  name: string;
  cases: FixtureCase[];
};

export type RenderFixtureCase = FixtureCase & {
  options: RenderOptions;
};

// ---------------------------------------------------------------------------
// Curated facts. These are the only things the filesystem cannot express; the
// rest of the manifest is derived from disk. Adding an ordinary fixture is a
// one-step change: drop a .hbs file under src/tests/fixtures.
// ---------------------------------------------------------------------------

// Fixtures the formatter intentionally reformats. Every other (non-error,
// non-render) fixture is asserted to be a byte-for-byte no-op; these are
// asserted to preserve semantics and idempotency instead.
const SEMANTIC_ONLY = new Set<string>([
  "complex/form-with-helpers",
  "complex/navigation",
  "complex/page-layout",
]);

const rawHelpers = {
  raw(options: any) {
    return options.fn(this);
  },
};

// Render-equivalence inputs: rendering the formatted output must match
// rendering the input. Keyed by fixture name. Every fixture under render/
// must have an entry; any other fixture may opt in to an extra render check.
const RENDER_OPTIONS: Record<string, RenderOptions> = {
  "render/helper-with-params": {
    context: { items: ["a", "b", "c"] },
    helpers: {
      join(items: string[], sep: string) {
        return items.join(sep);
      },
    },
  },
  "render/partial-with-context": {
    context: { person: { name: "Bob" } },
    partials: { greeting: "Hello {{name}}!" },
  },
  "render/partial-with-hash": { partials: { greeting: "Hello {{name}}!" } },
  "render/triple-stache": { context: { html: "<b>bold</b>" } },
  "render/lookup-helper": { context: { items: ["a", "b", "c"] } },
  "render/sub-expression": {
    context: { person: { name: "alice" } },
    helpers: {
      getName(person: { name: string }) {
        return person.name;
      },
      capitalize(str: string) {
        return str.charAt(0).toUpperCase() + str.slice(1);
      },
    },
  },
  "render/raw-block": { context: { parsed: "X" }, helpers: rawHelpers },
  "render/whitespace-controlled-block": { context: { x: true } },
  "render/partial-with-index-context": {
    context: { list: [{ name: "first" }, { name: "second" }] },
    partials: { row: "<li>{{name}}</li>" },
  },
  "render/triple-stache-index-access": { context: { html: ["<b>a</b>", "<i>b</i>"] } },
  "render/deep-mixed-path": {
    context: { users: [{ posts: [{ title: "p0" }, { title: "p1" }] }] },
  },
  "render/lookup-with-index-path": { context: { users: [{ name: "Alice" }] } },
  "paths/segment-literal": {
    context: { "foo bar": "ok", bar: "value" },
    helpers: {
      foo(value: string) {
        return `bad:${value}`;
      },
    },
  },
  "raw/basic": { context: { parsed: "X" }, helpers: rawHelpers },
  "raw/with-triple-stache": { context: {}, helpers: rawHelpers },
  "raw/multiline": { context: { parsed: "X" }, helpers: rawHelpers },
  "escaping/embedded-double-quotes": { helpers: { helper: (s: string) => `got:${s}` } },
  "escaping/single-quote-in-double-quoted": { helpers: { helper: (s: string) => `got:${s}` } },
};

// ---------------------------------------------------------------------------
// Categories derived from the filesystem.
// ---------------------------------------------------------------------------

const ALL = listFixtureNames();

function caseOf(fixture: string): FixtureCase {
  return { name: fixture.slice(fixture.lastIndexOf("/") + 1), fixture };
}

const topDir = (fixture: string): string => fixture.slice(0, fixture.indexOf("/"));

// errors/* — formatting must throw.
export const errorCases: FixtureCase[] = ALL.filter((f) => topDir(f) === "errors").map(caseOf);

// Fixtures with render options — render-equivalence is asserted in addition to
// any format/semantic check that also applies.
export const renderCases: RenderFixtureCase[] = Object.keys(RENDER_OPTIONS)
  .sort()
  .map((fixture) => ({ ...caseOf(fixture), options: RENDER_OPTIONS[fixture] }));

// Reformatting fixtures — semantics + idempotency, not byte-for-byte output.
export const semanticCases: FixtureCase[] = [...SEMANTIC_ONLY].sort().map(caseOf);

// Everything else — byte-for-byte no-op + idempotency + AST equivalence,
// grouped by top-level directory for readable test output.
export const formatGroups: FixtureGroup[] = (() => {
  const byDir = new Map<string, FixtureCase[]>();
  for (const fixture of ALL) {
    const dir = topDir(fixture);
    if (dir === "errors" || dir === "render" || SEMANTIC_ONLY.has(fixture)) continue;
    const cases = byDir.get(dir) ?? [];
    cases.push(caseOf(fixture));
    byDir.set(dir, cases);
  }
  return [...byDir.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, cases]) => ({ name, cases }));
})();

// Curated entries must still exist on disk and every render/ fixture must
// carry options — the only drift filesystem discovery cannot prevent itself.
export const curatedFixtures: string[] = [...SEMANTIC_ONLY, ...Object.keys(RENDER_OPTIONS)];
export const renderFixturesOnDisk: string[] = ALL.filter((f) => topDir(f) === "render");
export const fixturesWithRenderOptions = new Set(Object.keys(RENDER_OPTIONS));
