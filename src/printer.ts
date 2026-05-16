import { type AstPath, type Doc } from "prettier";
import type { HbsDocument } from "./parser.ts";
import { substitutePlaceholders } from "./placeholders.ts";

// The plugin defers every formatting decision to prettier's HTML formatter.
// `embed` hands the placeholdered source to the HTML parser, then walks the
// resulting Doc and splices the original handlebars source back into every
// placeholder. The plugin never reprints handlebars expressions — the
// substituted text preserves the input byte for byte, including whitespace
// that the parser absorbed between adjacent handlebars expressions. The
// placeholder protocol itself lives in ./placeholders.ts.
//
// The parser coalesces the markup patterns it knows the HTML parser would
// reject (see computeSpans). Anything that slips through — markup left
// unbalanced by handlebars in a way the parser did not anticipate — would
// make textToDoc throw. Rather than surface that as the opaque `print()`
// guard error, we degrade gracefully: emit the original source verbatim. The
// document is then a byte-for-byte no-op, which is always correct.

export const printer = {
  print(): Doc {
    throw new Error("print() should not be called; embed handles the document node.");
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
      const node = path.node;
      if (!node || node.type !== "document") return undefined;

      try {
        const html = await textToDoc(node.placeholdered, {
          parser: "html",
          parentParser: "handlebars",
        });
        return substitutePlaceholders(html, node.spans);
      } catch {
        return node.source;
      }
    };
  },
};
