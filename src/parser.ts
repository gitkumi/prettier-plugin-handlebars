import Handlebars from "handlebars";
import { encodePlaceholders, type Span } from "./placeholders.ts";

// Single-node AST. The plugin's only job is to hide handlebars expressions
// from prettier's HTML formatter (replace each with an alphanumeric placeholder)
// so the HTML formatter can format the surrounding markup. The printer then
// substitutes each placeholder with its original handlebars source verbatim —
// the plugin never reformats handlebars itself. The placeholder protocol
// (id format and its invariants) lives entirely in ./placeholders.ts.
//
// To preserve whitespace BETWEEN handlebars expressions (which prettier's
// HTML formatter would otherwise collapse as text content), each span also
// absorbs any whitespace-only gap between it and the previous span. The
// placeholdered source ends up with adjacent placeholders concatenated;
// the absorbed whitespace reappears verbatim during substitution.

export interface HbsDocument {
  type: "document";
  source: string;
  placeholdered: string;
  spans: Record<string, string>;
}

// Linear scan for every handlebars expression in the source. We do not rely
// on the Handlebars AST for positions — direct scanning preserves the exact
// original text (whitespace-strip flags, internal spacing, and quirky-but-
// legal forms) byte for byte.
function scanSpans(source: string): Span[] {
  const spans: Span[] = [];
  let i = 0;
  while (i < source.length) {
    if (source[i] !== "{" || source[i + 1] !== "{") {
      i++;
      continue;
    }
    const start = i;
    let end: number;
    if (source.startsWith("{{{{", i)) {
      // Raw block: {{{{name}}}}...{{{{/name}}}} — the body between the two
      // delimiters is verbatim source (handlebars does not parse it), so the
      // entire construct is captured as a single span.
      const openEnd = source.indexOf("}}}}", i + 4);
      if (openEnd < 0) throw new SyntaxError("Unclosed raw block opener at " + i);
      const name = source.slice(i + 4, openEnd).trim().split(/\s+/)[0];
      const closeMarker = `{{{{/${name}}}}}`;
      const closeStart = source.indexOf(closeMarker, openEnd + 4);
      if (closeStart < 0) throw new SyntaxError(`Unclosed raw block: ${name}`);
      end = closeStart + closeMarker.length;
    } else if (source.startsWith("{{!--", i)) {
      const closeIdx = source.indexOf("--}}", i + 5);
      if (closeIdx < 0) throw new SyntaxError("Unclosed comment at " + i);
      end = closeIdx + 4;
    } else if (source.startsWith("{{{", i)) {
      end = scanExpressionEnd(source, i + 3, "}}}");
    } else {
      end = scanExpressionEnd(source, i + 2, "}}");
    }
    spans.push({ start, end });
    i = end;
  }
  return spans;
}

// Scan forward from `start` to `terminator`, skipping over string literals
// (which may legally contain `}}` and would otherwise look like a closer).
function scanExpressionEnd(source: string, start: number, terminator: string): number {
  let i = start;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      const q = ch;
      i++;
      while (i < source.length && source[i] !== q) {
        if (source[i] === "\\") i++;
        i++;
      }
      i++;
      continue;
    }
    if (source.startsWith(terminator, i)) return i + terminator.length;
    i++;
  }
  throw new SyntaxError(`Unclosed expression looking for ${terminator}`);
}

// Expand spans to absorb whitespace that prettier's HTML formatter would
// otherwise discard while inlining short placeholder text:
//
// - whitespace-only gaps between consecutive handlebars spans
// - multiline whitespace around a standalone triple-stache child between HTML
//   tags
//
// Whitespace next to mixed HTML/text content is still left to prettier's HTML
// formatter.
function absorbWhitespaceGaps(source: string, spans: Span[]): Span[] {
  if (spans.length === 0) return spans;
  const out = spans.map((span) => ({ ...span }));

  for (let i = 0; i < spans.length; i++) {
    let runEnd = i;
    while (
      runEnd + 1 < spans.length &&
      isWhitespaceOnly(source.slice(spans[runEnd].end, spans[runEnd + 1].start))
    ) {
      runEnd++;
    }

    const runStartOffset = spans[i].start;
    const runEndOffset = spans[runEnd].end;
    const prev = previousNonWhitespaceIndex(source, runStartOffset);
    const next = nextNonWhitespaceIndex(source, runEndOffset);
    const leadingGap = source.slice(prev + 1, runStartOffset);
    const trailingGap = source.slice(runEndOffset, next);

    if (
      prev >= 0 &&
      next < source.length &&
      i === runEnd &&
      isTripleStacheSpan(source.slice(runStartOffset, runEndOffset)) &&
      source[prev] === ">" &&
      source[next] === "<" &&
      (leadingGap.includes("\n") || trailingGap.includes("\n"))
    ) {
      out[i].start = prev + 1;
      out[runEnd].end = next;
    }

    i = runEnd;
  }

  for (let i = 1; i < spans.length; i++) {
    const prevEnd = out[i - 1].end;
    const gap = source.slice(prevEnd, out[i].start);
    if (gap.length > 0 && isWhitespaceOnly(gap)) {
      out[i].start = prevEnd;
    }
  }
  return out;
}

function previousNonWhitespaceIndex(source: string, index: number): number {
  let i = index - 1;
  while (i >= 0 && /\s/.test(source[i])) i--;
  return i;
}

function nextNonWhitespaceIndex(source: string, index: number): number {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i++;
  return i;
}

function isWhitespaceOnly(value: string): boolean {
  return value.length > 0 && /^\s+$/.test(value);
}

function isTripleStacheSpan(value: string): boolean {
  return value.startsWith("{{{") && !value.startsWith("{{{{");
}

export function parseHandlebars(source: string): HbsDocument {
  // Validate syntax via the real handlebars parser; surfaces useful errors
  // for unclosed blocks, mismatched closers, etc.
  Handlebars.parse(source);

  const { placeholdered, spans } = encodePlaceholders(source, computeSpans(source));

  return {
    type: "document",
    source,
    placeholdered,
    spans,
  };
}

// The span pipeline. The order is load-bearing and applies in three stages:
//
//  1. scan    — find every handlebars expression verbatim, by offset.
//  2. protect — coalesce regions the HTML formatter would otherwise mangle or
//               choke on into a single opaque span, replacing the individual
//               spans inside them. Two detectors contribute regions:
//                 - empty elements whose only attributes are conditional
//                   (`<button {{#if x}}disabled{{/if}}>`)
//                 - blocks whose literal HTML is not tag-balanced, e.g. a
//                   block that opens a tag in one branch and closes it in
//                   another (`{{#if u}}<a>{{else}}<span>{{/if}}…`). The HTML
//                   parser rejects the unbalanced placeholdered fragment, so
//                   the whole block is emitted verbatim instead.
//               Must run before absorb so absorb sees the merged span.
//  3. absorb  — expand spans over whitespace the HTML formatter would discard.
//
// The result is a sorted, non-overlapping span list ready for placeholdering.
function computeSpans(source: string): Span[] {
  const scanned = scanSpans(source);
  const regions = [
    ...conditionalAttributeEmptyElementRegions(source, scanned),
    ...unbalancedHtmlBlockRegions(source, scanned),
  ];
  return absorbWhitespaceGaps(source, applyProtectedRegions(scanned, regions));
}

// Replace every span that falls inside a protected region with the region
// itself (coalescing its pieces into one opaque span), leaving spans outside
// all regions untouched. Regions may overlap or nest; merging resolves both.
function applyProtectedRegions(spans: Span[], regions: Span[]): Span[] {
  if (regions.length === 0) return spans;
  const merged = mergeOverlappingSpans(regions);
  const unprotected = spans.filter(
    (span) => !merged.some((region) => region.start <= span.start && span.end <= region.end),
  );
  return mergeOverlappingSpans([...unprotected, ...merged]);
}

function conditionalAttributeEmptyElementRegions(source: string, spans: Span[]): Span[] {
  const regions: Span[] = [];

  for (const span of spans) {
    if (!source.slice(span.start, span.end).startsWith("{{#")) continue;

    const tagStart = source.lastIndexOf("<", span.start);
    if (tagStart < 0 || source.slice(tagStart, span.start).includes(">")) continue;

    const tagName = source.slice(tagStart + 1).match(/^([A-Za-z][\w:-]*)\b/)?.[1];
    if (!tagName) continue;

    const tagEnd = source.indexOf(">", span.end);
    if (tagEnd < 0) continue;

    const openingTag = source.slice(tagStart, tagEnd + 1);
    if (!openingTag.includes("{{/")) continue;

    const closeTag = `</${tagName}>`;
    const closeStart = skipWhitespace(source, tagEnd + 1);
    if (!source.startsWith(closeTag, closeStart)) continue;

    regions.push({ start: tagStart, end: closeStart + closeTag.length });
  }

  return regions;
}

// A handlebars block whose literal HTML (every nested handlebars expression
// removed) does not form a balanced tag tree. When placeholdered, such a
// block leaves unbalanced markup that prettier's HTML parser rejects — most
// commonly the conditional-wrapper idiom, where a tag is opened in one branch
// and closed in another. The entire block (opener through matching closer) is
// protected so it round-trips verbatim while the rest of the document still
// formats.
function unbalancedHtmlBlockRegions(source: string, spans: Span[]): Span[] {
  const regions: Span[] = [];
  const openStack: number[] = [];

  for (let i = 0; i < spans.length; i++) {
    const kind = blockKind(source.slice(spans[i].start, spans[i].end));
    if (kind === "open") {
      openStack.push(i);
      continue;
    }
    if (kind !== "close") continue;

    const openIdx = openStack.pop();
    if (openIdx === undefined) continue;

    const start = spans[openIdx].start;
    const end = spans[i].end;
    if (!isHtmlBalanced(stripSpansWithin(source, spans, start, end))) {
      regions.push({ start, end });
    }
  }

  return regions;
}

// Classify a span by its role in handlebars block nesting. Raw blocks are
// captured whole by the scanner, so they are atomic leaves here. `{{^name}}`
// is an inverse-block opener (paired with `{{/name}}`); a bare `{{^}}` /
// `{{~^~}}` is only an else-marker and is not a block boundary.
function blockKind(text: string): "open" | "close" | "leaf" {
  if (text.startsWith("{{{{")) return "leaf";
  const marker = text.match(/^\{\{~?([#/^])/);
  if (!marker) return "leaf";
  if (marker[1] === "#") return "open";
  if (marker[1] === "/") return "close";
  return /^\{\{~?\^\s*[^\s}~]/.test(text) ? "open" : "leaf";
}

// Source between [start, end) with every span that lies wholly within it
// removed, leaving only the literal HTML and text the block contributes.
function stripSpansWithin(source: string, spans: Span[], start: number, end: number): string {
  let out = "";
  let cursor = start;
  for (const span of spans) {
    if (span.start < start || span.end > end) continue;
    out += source.slice(cursor, span.start);
    cursor = span.end;
  }
  return out + source.slice(cursor, end);
}

// HTML void elements never have a closing tag, so an unmatched one does not
// make a fragment unbalanced.
const VOID_ELEMENTS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr",
]);

// Whether the tags in `html` form a balanced tree: every open tag closed in
// order, no stray closers. Comments, doctype/CDATA, self-closing tags, void
// elements, and `>` inside quoted attribute values are all accounted for so
// the check matches what prettier's HTML parser would accept.
function isHtmlBalanced(html: string): boolean {
  const stack: string[] = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] !== "<") {
      i++;
      continue;
    }
    if (html.startsWith("<!--", i)) {
      const close = html.indexOf("-->", i + 4);
      if (close < 0) return false;
      i = close + 3;
      continue;
    }
    if (html[i + 1] === "!") {
      const close = html.indexOf(">", i);
      if (close < 0) return false;
      i = close + 1;
      continue;
    }
    const closing = html[i + 1] === "/";
    const nameStart = i + (closing ? 2 : 1);
    const name = html.slice(nameStart).match(/^([a-zA-Z][\w:-]*)/)?.[1];
    if (!name) {
      i++;
      continue;
    }
    let j = nameStart + name.length;
    let selfClose = false;
    while (j < html.length && html[j] !== ">") {
      const ch = html[j];
      if (ch === '"' || ch === "'") {
        j++;
        while (j < html.length && html[j] !== ch) j++;
      } else if (ch === "/" && html[j + 1] === ">") {
        selfClose = true;
      }
      j++;
    }
    if (j >= html.length) return false;
    i = j + 1;

    const tag = name.toLowerCase();
    if (closing) {
      if (stack.pop() !== tag) return false;
    } else if (!selfClose && !VOID_ELEMENTS.has(tag)) {
      stack.push(tag);
    }
  }
  return stack.length === 0;
}

function mergeOverlappingSpans(spans: Span[]): Span[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  for (const span of sorted) {
    const prev = out[out.length - 1];
    if (prev && span.start <= prev.end) {
      prev.end = Math.max(prev.end, span.end);
    } else {
      out.push({ ...span });
    }
  }
  return out;
}

function skipWhitespace(source: string, index: number): number {
  let i = index;
  while (i < source.length && /\s/.test(source[i])) i++;
  return i;
}

export const parser = {
  parse(text: string): HbsDocument {
    return parseHandlebars(text);
  },
  astFormat: "handlebars-ast",
  locStart(_node: HbsDocument): number {
    return 0;
  },
  locEnd(node: HbsDocument): number {
    return node.source.length;
  },
};
