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
  return spans
}

function scanOne(source: string, start: number): Span {
  // {{{{raw}}}} ... {{{{/raw}}}} — handlebars does not parse the body, so the
  // whole construct (opener, verbatim body, closer) is a single span.
  if (source.startsWith("{{{{", start)) {
    const openEnd = source.indexOf("}}}}", start + 4)
    if (openEnd < 0)
      throw new SyntaxError(`Unclosed raw block opener at ${start}`)
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
