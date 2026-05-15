import Handlebars from "handlebars";

// Single-node AST. The plugin's only job is to hide handlebars expressions
// from prettier's HTML formatter (replace each with an alphanumeric placeholder)
// so the HTML formatter can format the surrounding markup. The printer then
// substitutes each placeholder with its original handlebars source verbatim —
// the plugin never reformats handlebars itself.
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

// Placeholder ids must survive prettier's HTML formatter unchanged. Lowercase
// alphanumeric works in element text, attribute names, attribute values, and
// custom tag names. The random seed + trailing `xx` makes natural collision
// with user content astronomically unlikely.
function createIdGenerator(): () => string {
  const seed = Math.floor(Math.random() * 0xffffffff).toString(36);
  let counter = 0;
  return () => `phbs${seed}${(counter++).toString(36)}xx`;
}

interface Span {
  start: number;
  end: number;
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

  const spans = absorbWhitespaceGaps(
    source,
    protectConditionalAttributeEmptyElements(source, scanSpans(source)),
  );
  const getId = createIdGenerator();
  const spanMap: Record<string, string> = {};

  // Replace spans in reverse order so earlier indices stay valid.
  let placeholdered = source;
  for (let k = spans.length - 1; k >= 0; k--) {
    const { start, end } = spans[k];
    const id = getId();
    spanMap[id] = source.slice(start, end);
    placeholdered = placeholdered.slice(0, start) + id + placeholdered.slice(end);
  }

  return {
    type: "document",
    source,
    placeholdered,
    spans: spanMap,
  };
}

function protectConditionalAttributeEmptyElements(source: string, spans: Span[]): Span[] {
  const protectedRegions: Span[] = [];

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

    protectedRegions.push({ start: tagStart, end: closeStart + closeTag.length });
  }

  if (protectedRegions.length === 0) return spans;

  const mergedRegions = mergeOverlappingSpans(protectedRegions);
  const unprotectedSpans = spans.filter(
    (span) => !mergedRegions.some((region) => region.start <= span.start && span.end <= region.end),
  );
  return mergeOverlappingSpans([...unprotectedSpans, ...mergedRegions]);
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
