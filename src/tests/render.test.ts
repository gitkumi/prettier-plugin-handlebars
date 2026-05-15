import { describe, it } from "vitest";
import { expectFixtureSameRender } from "./helpers.ts";

// ---------------------------------------------------------------------------
// Exact render preservation
// ---------------------------------------------------------------------------

describe("exact render preservation", () => {
  it("renders same output for helper with params", async () => {
    await expectFixtureSameRender("render/helper-with-params", {
      context: { items: ["a", "b", "c"] },
      helpers: {
        join(items: string[], sep: string) {
          return items.join(sep);
        },
      },
    });
  });

  it("renders same output for partial with context", async () => {
    await expectFixtureSameRender("render/partial-with-context", {
      context: { person: { name: "Bob" } },
      partials: { greeting: "Hello {{name}}!" },
    });
  });

  it("renders same output for partial with hash", async () => {
    await expectFixtureSameRender("render/partial-with-hash", {
      partials: { greeting: "Hello {{name}}!" },
    });
  });

  it("renders same output for triple-stache (unescaped)", async () => {
    await expectFixtureSameRender("render/triple-stache", {
      context: { html: "<b>bold</b>" },
    });
  });

  it("renders same output for lookup helper", async () => {
    await expectFixtureSameRender("render/lookup-helper", {
      context: { items: ["a", "b", "c"] },
    });
  });

  it("renders same output for sub-expression", async () => {
    await expectFixtureSameRender("render/sub-expression", {
      context: { person: { name: "alice" } },
      helpers: {
        getName(person: { name: string }) {
          return person.name;
        },
        capitalize(str: string) {
          return str.charAt(0).toUpperCase() + str.slice(1);
        },
      },
    });
  });

  it("renders same output for raw block", async () => {
    await expectFixtureSameRender("render/raw-block", {
      context: { parsed: "X" },
      helpers: {
        raw(options: any) {
          return options.fn(this);
        },
      },
    });
  });

  it("renders same output for whitespace-controlled block", async () => {
    await expectFixtureSameRender("render/whitespace-controlled-block", {
      context: { x: true },
    });
  });
});

// ---------------------------------------------------------------------------
// Array index path render equivalence
// ---------------------------------------------------------------------------

describe("array index path render", () => {
  it("renders same output for partial with index context (motivating example)", async () => {
    await expectFixtureSameRender("render/partial-with-index-context", {
      context: { list: [{ name: "first" }, { name: "second" }] },
      partials: { row: "<li>{{name}}</li>" },
    });
  });

  it("renders same output for triple-stache index access", async () => {
    await expectFixtureSameRender("render/triple-stache-index-access", {
      context: { html: ["<b>a</b>", "<i>b</i>"] },
    });
  });

  it("renders same output for deep mixed path", async () => {
    await expectFixtureSameRender("render/deep-mixed-path", {
      context: {
        users: [{ posts: [{ title: "p0" }, { title: "p1" }] }],
      },
    });
  });

  it("renders same output for lookup with index path", async () => {
    await expectFixtureSameRender("render/lookup-with-index-path", {
      context: { users: [{ name: "Alice" }] },
    });
  });
});
