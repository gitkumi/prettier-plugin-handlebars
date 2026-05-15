import { describe, expect, it } from "vitest";
import { parseHandlebars } from "../parser.ts";

describe("parser placeholdering", () => {
  it("replaces handlebars expressions with stable placeholder ids", () => {
    const doc = parseHandlebars("<p>{{name}}</p>");
    const [id] = Object.keys(doc.spans);

    expect(doc.placeholdered).toBe(`<p>${id}</p>`);
    expect(doc.spans[id]).toBe("{{name}}");
  });

  it("absorbs whitespace-only gaps between adjacent handlebars spans", () => {
    const doc = parseHandlebars("{{first}}\n  {{second}}");
    const spans = Object.values(doc.spans);

    expect(doc.placeholdered).not.toContain("\n");
    expect(spans).toContain("{{first}}");
    expect(spans).toContain("\n  {{second}}");
  });

  it("absorbs multiline whitespace around a handlebars-only HTML child", () => {
    const source = "<div>\n  {{{ children }}}\n</div>";
    const doc = parseHandlebars(source);
    const [id] = Object.keys(doc.spans);

    expect(doc.placeholdered).toBe(`<div>${id}</div>`);
    expect(doc.spans[id]).toBe("\n  {{{ children }}}\n");
  });

  it("protects empty tags with conditional valued attributes", () => {
    const source = '<button\n  class="button"\n{{#if id}}id="{{id}}"{{/if}}\n></button>';
    const doc = parseHandlebars(source);
    const [id] = Object.keys(doc.spans);

    expect(doc.placeholdered).toBe(id);
    expect(doc.spans[id]).toBe(source);
  });

  it("captures raw blocks as a single span", () => {
    const source = "{{{{raw}}}}{{notParsed}}{{{{/raw}}}}";
    const doc = parseHandlebars(source);

    expect(Object.values(doc.spans)).toEqual([source]);
  });

  it("does not close expressions inside string literals", () => {
    const source = '{{helper "}}"}}';
    const doc = parseHandlebars(source);

    expect(Object.values(doc.spans)).toEqual([source]);
  });

  it("captures safe comments containing handlebars delimiters", () => {
    const source = "{{!-- {{ not parsed }} --}}";
    const doc = parseHandlebars(source);

    expect(Object.values(doc.spans)).toEqual([source]);
  });
});
