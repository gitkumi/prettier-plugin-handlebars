import { doc, type AstPath, type Doc } from "prettier"
import type { HbsDocument } from "./parser.ts"
import { substitutePlaceholders } from "./placeholders.ts"

const { hardline, trim } = doc.builders

// The plugin defers every formatting decision to prettier's HTML formatter.
// `embed` hands the placeholdered source to the HTML parser, then walks the
// resulting Doc and splices the original handlebars source back into every
// placeholder. "Verbatim" is scoped precisely: the plugin never reprints a
// handlebars expression, so each expression's own bytes (internal spacing,
// whitespace-control markers, quirky-but-legal forms) round-trip exactly. The
// text *around* expressions is not verbatim — it is HTML, formatted like any
// other markup. A run of constructs with no tag boundary between them is also
// preserved verbatim: the parser merges such a run into one span (see
// mergeAdjacentSpans in ./parser.ts), so the author's line breaks between
// stacked constructs (`{{#each}}` / `{{> x}}` / `{{/each}}`) and inline
// conditional-attribute blocks (`{{#if id}}id="{{id}}"{{/if}}`) survive
// instead of the HTML formatter collapsing or splitting them. A gap that
// contains a tag boundary is still the HTML formatter's to reflow. The
// placeholder protocol itself lives in ./placeholders.ts.
//
// The parser never inspects HTML. When placeholdering leaves markup the HTML
// parser can't accept (a tag opened in one block branch and closed in
// another, say), textToDoc throws. Rather than surface that as the opaque
// `print()` guard error, we degrade gracefully: emit the original source
// verbatim. The document is then a byte-for-byte no-op, which is always
// correct.

export const printer = {
  print(): Doc {
    throw new Error(
      "print() should not be called; embed handles the document node.",
    )
  },

  embed() {
    return async (
      textToDoc: (
        text: string,
        options: { parser: string; parentParser?: string },
      ) => Promise<Doc>,
      _print: unknown,
      path: AstPath<HbsDocument>,
    ): Promise<Doc | undefined> => {
      const node = path.node
      if (!node || node.type !== "document") return undefined

      try {
        const html = await textToDoc(node.placeholdered, {
          parser: "html",
          parentParser: "handlebars",
        })
        return withFinalNewline(
          substitutePlaceholders(html, node.spans),
          node.source,
        )
      } catch (error) {
        if (process.env.PRETTIER_HBS_DEBUG) console.error(error)
        return normalizeFinalNewline(node.source)
      }
    }
  },
}

function withFinalNewline(formatted: Doc, source: string): Doc {
  return source.trim() === "" ? "" : [formatted, trim, hardline]
}

// The verbatim fallback is deliberately a byte-for-byte echo of the source
// except for the trailing newline. Internal CRLF is preserved on purpose:
// once HTML formatting has failed there is no parsed structure to safely
// rewrite line endings against, so a no-op is the only always-correct output.
// (The happy path does normalize CRLF -> LF, because the HTML formatter owns
// that text; the two paths diverge here by design, not by oversight.)
function normalizeFinalNewline(source: string): string {
  return source.trim() === "" ? "" : source.replace(/(?:\r?\n)+$/, "") + "\n"
}
