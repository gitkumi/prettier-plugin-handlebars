import { doc, type AstPath, type Doc } from "prettier";
import type { HbsDocument } from "./parser.ts";

const { utils } = doc;

// The plugin defers every formatting decision to prettier's HTML formatter.
// `embed` hands the placeholdered source (handlebars expressions replaced by
// alphanumeric ids) to the HTML parser, then walks the resulting Doc and
// splices the original handlebars source back into every placeholder. The
// plugin never reprints handlebars expressions — output preserves them byte
// for byte.

export const printer = {
  print(): Doc {
    // `embed` returns a Doc for the single document node, so this fallback
    // should never run in practice.
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

      const html = await textToDoc(node.placeholdered, {
        parser: "html",
        parentParser: "handlebars",
      });

      return substituteSpans(html, node.spans);
    };
  },
};

// Walk the Doc returned by the HTML formatter; for each string segment that
// contains a placeholder id, splice in the original handlebars source.
function substituteSpans(html: Doc, spans: Record<string, string>): Doc {
  const ids = Object.keys(spans);
  return utils.mapDoc(html, (current) => {
    if (typeof current !== "string") return current;
    let result: Doc = current;
    for (const id of ids) {
      result = utils.mapDoc(result, (segment) => {
        if (typeof segment !== "string" || !segment.includes(id)) return segment;
        const parts: Doc[] = [];
        let rest = segment;
        while (true) {
          const idx = rest.indexOf(id);
          if (idx < 0) {
            parts.push(rest);
            break;
          }
          if (idx > 0) parts.push(rest.slice(0, idx));
          parts.push(spans[id]);
          rest = rest.slice(idx + id.length);
        }
        return parts;
      });
    }
    return result;
  });
}
