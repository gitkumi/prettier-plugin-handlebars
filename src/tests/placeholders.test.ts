import { describe, expect, it } from "vitest";
import { encodePlaceholders, substitutePlaceholders, type Span } from "../placeholders.ts";

// The placeholder protocol is testable on its own, without prettier or the
// HTML formatter: encode spans, subject the placeholdered text to the kinds
// of transforms the HTML formatter applies, then assert substitution recovers
// the original source exactly.

function spansOf(source: string, token: RegExp): Span[] {
  const spans: Span[] = [];
  for (const match of source.matchAll(token)) {
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

describe("placeholder protocol", () => {
  it("round-trips a span unchanged", () => {
    const source = "<p>{{name}}</p>";
    const spans = spansOf(source, /\{\{[^}]*\}\}/g);
    const { placeholdered, spans: map } = encodePlaceholders(source, spans);

    expect(placeholdered).not.toContain("{{");
    expect(substitutePlaceholders(placeholdered, map)).toBe(source);
  });

  it("recovers many spans, including ones that previously collided as substrings", () => {
    // Regression: with a variable-length base-36 counter, id(1)="..1xx" was a
    // substring of id(69)="..1xxx", so substituting the short id corrupted the
    // long one. >70 spans forces the counter past that point.
    const source = Array.from({ length: 120 }, (_, i) => `{{e${i}}}`).join("");
    const spans = spansOf(source, /\{\{e\d+\}\}/g);
    const { placeholdered, spans: map } = encodePlaceholders(source, spans);

    const ids = Object.keys(map);
    expect(ids.length).toBe(120);
    for (const a of ids) {
      for (const b of ids) {
        if (a !== b) expect(b.includes(a)).toBe(false);
      }
    }
    expect(substitutePlaceholders(placeholdered, map)).toBe(source);
  });

  it("recovers adjacent placeholders with no separator between them", () => {
    // The span pipeline concatenates placeholders for adjacent expressions;
    // substitution must still split them apart correctly.
    const source = "{{a}}{{b}}{{c}}";
    const spans = spansOf(source, /\{\{[a-z]\}\}/g);
    const { placeholdered, spans: map } = encodePlaceholders(source, spans);

    expect(Object.keys(map).length).toBe(3);
    expect(substitutePlaceholders(placeholdered, map)).toBe(source);
  });

  it("mints ids that survive the HTML formatter lowercasing tag names", () => {
    const source = "{{name}}";
    const { placeholdered } = encodePlaceholders(source, spansOf(source, /\{\{[^}]*\}\}/g));

    expect(placeholdered).toMatch(/^[a-z0-9]+$/);
    expect(placeholdered.toLowerCase()).toBe(placeholdered);
  });

  it("leaves a Doc with no placeholders untouched", () => {
    expect(substitutePlaceholders("<p>plain</p>", {})).toBe("<p>plain</p>");
  });
});
