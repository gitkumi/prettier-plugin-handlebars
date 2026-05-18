import Handlebars from "handlebars"
import { encodePlaceholders, type Span } from "./placeholders.ts"

// The whole plugin: hide every handlebars construct behind an opaque
// placeholder, let prettier's HTML formatter format the markup that's left,
// then put the original handlebars source back verbatim (see ./printer.ts).
// The plugin never reformats handlebars itself.
//
// This parser does exactly two things: validate the template (so broken
// templates surface a real error instead of mangled output) and scan every
// handlebars construct into a span. No HTML is inspected here — when
// placeholdering happens to leave markup the HTML parser can't accept (a tag
// opened in one block branch and closed in another, say), the printer catches
// it and emits the source untouched. That verbatim fallback is what lets this
// stay minimal.
//
// Boundary worth knowing: the printer's verbatim fallback covers only
// HTML-formatting failures. Anything thrown here (in the scanner) propagates
// as a hard error with no verbatim net. That is intentional for genuinely
// invalid templates — Handlebars.parse runs first and rejects those — but it
// also means the scanner must stay in agreement with handlebars' own lexer:
// if it threw on a construct Handlebars.parse accepted, a valid template
// would fail outright instead of degrading. New construct handling here is
// held to that bar.

export interface HbsDocument {
  type: "document"
  source: string
  placeholdered: string
  spans: Record<string, string>
}

export function parseHandlebars(source: string): HbsDocument {
  Handlebars.parse(source)
  const { placeholdered, spans } = encodePlaceholders(source, scanSpans(source))
  return { type: "document", source, placeholdered, spans }
}

// Find every handlebars construct verbatim, by offset. We scan the raw text
// rather than walk the Handlebars AST so the original bytes (whitespace-control
// markers, internal spacing, quirky-but-legal forms) round-trip exactly.
function scanSpans(source: string): Span[] {
  const spans: Span[] = []
  let i = 0
  while (i < source.length) {
    if (source[i] !== "{" || source[i + 1] !== "{") {
      i++
      continue
    }
    // An odd run of backslashes immediately before `{{` escapes it: handlebars
    // treats `\{{x}}` as the literal text `{{x}}`, not an expression (while
    // `\\{{x}}` is a literal backslash followed by a real expression). Skip the
    // escaped opener so it stays inert text — scanning it would mis-span valid
    // content and throw on an unterminated `\{{`.
    let backslashes = 0
    while (source[i - 1 - backslashes] === "\\") backslashes++
    if (backslashes % 2 === 1) {
      i += 2
      continue
    }
    const span = scanOne(source, i)
    spans.push(span)
    i = span.end
  }
  return mergeAdjacentSpans(source, spans)
}

// Merge scanned spans so the HTML formatter sees one opaque token where it
// would otherwise mangle a construct's verbatim shape. Two passes, each
// emitting a single placeholder per merged run whose source bytes round-trip
// exactly (so the transform stays idempotent):
//
//  1. Inline blocks. A balanced block (`{{#x}}` … `{{/x}}`) that fits on one
//     source line with no tag boundary inside becomes one span, so an inline
//     conditional-attribute block (`{{#if id}}id="{{id}}"{{/if}}`) is not seen
//     as separate bare attributes and split across lines when the tag breaks.
//     A block whose range contains `<`, `>`, or a newline is left alone, so
//     markup inside a block (`{{#if x}}<a>…</a>{{/if}}`) and embedded JS/CSS
//     between plain mustaches are still formatted normally.
//  2. Whitespace runs. Constructs separated by nothing but whitespace are
//     merged, so the author's line breaks between vertically stacked
//     constructs (`{{#each}}` / `{{> x}}` / `{{/each}}`) survive instead of
//     being collapsed like words.
function mergeAdjacentSpans(source: string, spans: Span[]): Span[] {
  return mergeWhitespaceRuns(source, mergeInlineBlocks(source, spans))
}

// Whether the construct at `start` opens (`{{#x}}`) or closes (`{{/x}}`) a
// block. The strip marker is skipped the same way scanOne does it; after it,
// `#` opens and `/` closes — every other construct (mustache, partial,
// comment, `{{else}}`, raw block) opens nothing.
function blockMarker(source: string, start: number): "open" | "close" | null {
  const i = source.startsWith("{{~", start) ? start + 3 : start + 2
  if (source[i] === "#") return "open"
  if (source[i] === "/") return "close"
  return null
}

// Whether [start, end) holds a tag boundary or newline — the signal that a
// block's interior is markup the HTML formatter must still own. Scanned
// directly (no substring) with an early exit, since most non-mergeable blocks
// hit one of these characters near their start.
function spansMarkup(source: string, start: number, end: number): boolean {
  for (let p = start; p < end; p++) {
    const c = source[p]
    if (c === "<" || c === ">" || c === "\n") return true
  }
  return false
}

// Collapse each outermost balanced block that fits on one line with no tag
// boundary inside into a single span. The template is already validated by
// Handlebars.parse, so blocks are well nested and a stack pairs every closer
// with its opener.
function mergeInlineBlocks(source: string, spans: Span[]): Span[] {
  const closerFor = new Map<number, number>()
  const openStack: number[] = []
  for (let k = 0; k < spans.length; k++) {
    const marker = blockMarker(source, spans[k].start)
    if (marker === "open") openStack.push(k)
    else if (marker === "close") {
      const open = openStack.pop()
      if (open !== undefined) closerFor.set(open, k)
    }
  }

  const merged: Span[] = []
  let k = 0
  while (k < spans.length) {
    const close = closerFor.get(k)
    if (close !== undefined) {
      const start = spans[k].start
      const end = spans[close].end
      if (!spansMarkup(source, start, end)) {
        merged.push({ start, end })
        k = close + 1
        continue
      }
    }
    merged.push(spans[k])
    k++
  }
  return merged
}

// Spans are never mutated: a merged run becomes a fresh span and unmerged
// spans are passed through by reference, so the two passes can share span
// objects safely.
function mergeWhitespaceRuns(source: string, spans: Span[]): Span[] {
  const merged: Span[] = []
  for (const span of spans) {
    const prev = merged[merged.length - 1]
    if (prev && source.slice(prev.end, span.start).trim() === "") {
      merged[merged.length - 1] = { start: prev.start, end: span.end }
    } else {
      merged.push(span)
    }
  }
  return merged
}

function scanOne(source: string, start: number): Span {
  // {{{{raw}}}} ... {{{{/raw}}}} — handlebars does not parse the body, so the
  // whole construct (opener, verbatim body, closer) is a single span.
  if (source.startsWith("{{{{", start)) {
    // Locate the opener terminator the same way scanExpressionEnd does —
    // skipping string and bracketed literals — so a `}}}}` inside an argument
    // string (e.g. {{{{raw x="}}}}"}}}}) is not mistaken for the end of the
    // opener. scanExpressionEnd returns the offset just past `}}}}` and throws
    // if the opener is never terminated.
    const openEnd = scanExpressionEnd(source, start + 4, "}}}}") - 4
    const name = source
      .slice(start + 4, openEnd)
      .trim()
      .split(/\s+/)[0]
    const close = `{{{{/${name}}}}}`
    const closeStart = source.indexOf(close, openEnd + 4)
    if (closeStart < 0) throw new SyntaxError(`Unclosed raw block: ${name}`)
    return { start, end: closeStart + close.length }
  }

  // Skip the optional leading strip marker so the comment/triple checks below
  // see the real opener (`{{~!--` and `{{!--` are the same construct).
  const body = source.startsWith("{{~", start) ? start + 3 : start + 2

  // {{!-- ... --}} block comment. Its body is opaque text that may contain
  // `}}` or HTML, so it terminates strictly on the comment closer and is never
  // treated as expression syntax.
  if (source.startsWith("!--", body)) {
    const end = endOfFirst(source, ["--}}", "--~}}"], body + 3)
    if (end < 0) throw new SyntaxError(`Unclosed comment at ${start}`)
    return { start, end }
  }

  // {{! ... }} short comment — cannot contain `}}` per the handlebars spec.
  if (source[body] === "!") {
    const end = endOfFirst(source, ["}}", "~}}"], body + 1)
    if (end < 0) throw new SyntaxError(`Unclosed comment at ${start}`)
    return { start, end }
  }

  // {{{ ... }}} unescaped expression.
  if (source.startsWith("{{{", start)) {
    return { start, end: scanExpressionEnd(source, start + 3, "}}}") }
  }

  // {{ ... }} / {{~ ... ~}} — every other mustache, block boundary, partial.
  return { start, end: scanExpressionEnd(source, body, "}}") }
}

// End offset (just past the terminator) of whichever `terminators` entry
// starts earliest at or after `from`; -1 if none occur.
function endOfFirst(
  source: string,
  terminators: string[],
  from: number,
): number {
  let bestStart = -1
  let bestEnd = -1
  for (const terminator of terminators) {
    const at = source.indexOf(terminator, from)
    if (at >= 0 && (bestStart < 0 || at < bestStart)) {
      bestStart = at
      bestEnd = at + terminator.length
    }
  }
  return bestEnd
}

// Scan forward to `terminator`, skipping string and bracketed path literals so
// a `}}` (or `}}}`) inside either form does not look like the closer.
function scanExpressionEnd(
  source: string,
  start: number,
  terminator: string,
): number {
  let i = start
  while (i < source.length) {
    const ch = source[i]
    if (ch === '"' || ch === "'") {
      i++
      while (i < source.length && source[i] !== ch) {
        if (source[i] === "\\") i++
        i++
      }
      i++
      continue
    }
    if (ch === "[") {
      i++
      while (i < source.length && source[i] !== "]") i++
      i++
      continue
    }
    if (source.startsWith(terminator, i)) return i + terminator.length
    i++
  }
  throw new SyntaxError(`Unclosed expression looking for ${terminator}`)
}

export const parser = {
  parse(text: string): HbsDocument {
    return parseHandlebars(text)
  },
  astFormat: "handlebars-ast",
  locStart(_node: HbsDocument): number {
    return 0
  },
  locEnd(node: HbsDocument): number {
    return node.source.length
  },
}
