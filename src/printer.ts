import { doc, type AstPath, type Doc, type ParserOptions } from "prettier";
import type {
  Block,
  HbsNode,
  Inline,
  InlineData,
  Root,
} from "./parser.ts";

const { builders, utils } = doc;

type PrintFn = (path: AstPath<HbsNode>) => Doc;

// ---------------------------------------------------------------------------
// Delimiters
// ---------------------------------------------------------------------------

function delims(
  prefix: string,
  suffix: string,
  strip: hbs.AST.StripFlags | undefined,
  triple = false,
): { open: string; close: string } {
  const lhs = triple ? "{{{" : "{{";
  const rhs = triple ? "}}}" : "}}";
  const lstrip = strip?.open ? "~" : "";
  const rstrip = strip?.close ? "~" : "";
  return { open: lhs + lstrip + prefix, close: suffix + rstrip + rhs };
}

// ---------------------------------------------------------------------------
// Expression atoms (paths, literals, sub-expressions, hashes)
// ---------------------------------------------------------------------------

function isSimplePathSegment(part: string): boolean {
  // Handlebars' lexer consumes purely-numeric segments as a NUMBER token, so
  // array-index segments like `0` must be bracketed (`list.[0]`).
  if (/^\d+$/.test(part)) return false;
  return /^[\p{L}\p{N}_$-]+$/u.test(part);
}

function printPathSegment(part: string): string {
  return isSimplePathSegment(part) ? part : `[${part}]`;
}

function printPath(node: hbs.AST.PathExpression): string {
  if (node.original === "." || node.original === "this") return node.original;
  const value = node.parts.map(printPathSegment).join(".");
  if (node.data) return "@" + "../".repeat(node.depth) + value;
  if (node.original.startsWith("./")) return "./" + value;
  if (node.original.startsWith("this.")) return "this." + value;
  return "../".repeat(node.depth) + value;
}

function printExpression(node: hbs.AST.Expression): string {
  switch (node.type) {
    case "PathExpression":
      return printPath(node as hbs.AST.PathExpression);
    case "StringLiteral":
      // Handlebars only decodes `\"` -> `"`; backslashes pass through.
      return '"' + (node as hbs.AST.StringLiteral).value.replace(/"/g, '\\"') + '"';
    case "NumberLiteral":
      return String((node as hbs.AST.NumberLiteral).value);
    case "BooleanLiteral":
      return String((node as hbs.AST.BooleanLiteral).value);
    case "UndefinedLiteral":
      return "undefined";
    case "NullLiteral":
      return "null";
    case "SubExpression": {
      const s = node as hbs.AST.SubExpression;
      return "(" + printPath(s.path as hbs.AST.PathExpression) + printArgs(s) + ")";
    }
  }
  throw new Error(`Unknown expression type: ${(node as { type: string }).type}`);
}

function printHash(hash: hbs.AST.Hash): string {
  return hash.pairs
    .map((p) => p.key + "=" + printExpression(p.value))
    .join(" ");
}

function printArgs(node: {
  params?: hbs.AST.Expression[];
  hash?: hbs.AST.Hash;
}): string {
  const parts: string[] = [];
  if (node.params?.length) {
    for (const p of node.params) parts.push(" ", printExpression(p));
  }
  if (node.hash) parts.push(" ", printHash(node.hash));
  return parts.join("");
}

function blockParams(program: hbs.AST.Program | undefined): string {
  if (program?.blockParams?.length) {
    return " as |" + program.blockParams.join(" ") + "|";
  }
  return "";
}

// ---------------------------------------------------------------------------
// Inline kinds
// ---------------------------------------------------------------------------

function printInline(inline: Inline, source: string): string {
  return printInlineData(inline.data, inline, source);
}

function printInlineData(data: InlineData, inline: Inline, source: string): string {
  switch (data.kind) {
    case "mustache": {
      const m = data.node;
      const d = delims("", "", m.strip, m.escaped === false);
      return d.open + printExpression(m.path) + printArgs(m) + d.close;
    }
    case "decorator": {
      const dec = data.node;
      const d = delims("* ", "", dec.strip);
      return d.open + printExpression(dec.path) + printArgs(dec) + d.close;
    }
    case "partial": {
      const p = data.node;
      const d = delims("> ", "", p.strip);
      return d.open + printExpression(p.name) + printArgs(p) + d.close;
    }
    case "comment":
      return printComment(data.node, source);
    case "block-open": {
      const b = data.node;
      const open = data.isInverse ? "^" : "#";
      const d = delims(open, "", b.openStrip);
      const params = data.isInverse
        ? ""
        : blockParams(b.program);
      return d.open + printPath(b.path as hbs.AST.PathExpression) + printArgs(b) + params + d.close;
    }
    case "block-close": {
      const b = data.node;
      const d = delims("/", "", b.closeStrip);
      return d.open + printPath(b.path as hbs.AST.PathExpression) + d.close;
    }
    case "partial-block-open": {
      const p = data.node;
      const d = delims("#> ", "", p.openStrip);
      return d.open + printExpression(p.name) + printArgs(p) + d.close;
    }
    case "partial-block-close": {
      const p = data.node;
      const d = delims("/", "", p.closeStrip);
      return d.open + printExpression(p.name) + d.close;
    }
    case "decorator-block-open": {
      const dec = data.node;
      const d = delims("#*", "", dec.openStrip);
      return d.open + printPath(dec.path as hbs.AST.PathExpression) + printArgs(dec) + d.close;
    }
    case "decorator-block-close": {
      const dec = data.node;
      const d = delims("/", "", dec.closeStrip);
      return d.open + printPath(dec.path as hbs.AST.PathExpression) + d.close;
    }
    case "else": {
      const d = delims("else", "", data.strip);
      return d.open + d.close;
    }
    case "else-if": {
      const b = data.node;
      const d = delims("else ", "", b.openStrip);
      return d.open + printPath(b.path as hbs.AST.PathExpression) + printArgs(b) + d.close;
    }
  }
}

// {{!-- ... --}} vs {{! ... }} cannot be distinguished from the AST alone;
// look at the source slice at the comment's start.
function printComment(node: hbs.AST.CommentStatement, source: string): string {
  const n = node as hbs.AST.CommentStatement & { _start?: number };
  const start = n._start ?? 0;
  const isSafe = source.slice(start, start + 6).includes("!--");
  const val = node.value;
  if (isSafe) {
    if (val.includes("\n")) {
      const d = delims("!--", "--", node.strip);
      return d.open + val + d.close;
    }
    const d = delims("!-- ", " --", node.strip);
    return d.open + val.trim() + d.close;
  }
  const d = delims("! ", " ", node.strip);
  return d.open + val.trim() + d.close;
}

// ---------------------------------------------------------------------------
// Printer
// ---------------------------------------------------------------------------

export const printer = {
  print(path: AstPath<HbsNode>, _options: ParserOptions, print: PrintFn): Doc {
    const node = path.node;
    switch (node.type) {
      case "inline":
        // `embed` handles inline printing where it needs context (the
        // surrounding source for comment disambiguation), so this branch is
        // only hit when an inline is printed standalone (no parent block
        // embed). That doesn't happen in practice but we provide a fallback.
        return printInline(node, "");
      case "raw":
        return node.content;
      case "multi-block":
        return path.map(print, "blocks");
      case "root":
      case "block":
        // `embed` produces the Doc for these; reaching `print` for them
        // means embed returned undefined (shouldn't happen for our cases).
        throw new Error(`print() called on ${node.type}; expected embed.`);
    }
  },

  embed() {
    return async (
      textToDoc: (
        text: string,
        options: { parser: string; parentParser?: string },
      ) => Promise<Doc>,
      print: PrintFn,
      path: AstPath<HbsNode>,
      options: ParserOptions,
    ): Promise<Doc | undefined> => {
      const node = path.node;
      if (!node || (node.type !== "root" && node.type !== "block")) return undefined;
      const source = options.originalText;
      const aliased = (node as Root | Block).aliasedContent;

      // Format the placeholdered HTML body via prettier's html parser.
      const html = await textToDoc(aliased, {
        parser: "html",
        parentParser: "handlebars",
      });

      const mapped = utils.stripTrailingHardline(
        substituteChildren(html, node as Root | Block, path, print, source),
      );

      if (node.type === "root") {
        return [mapped, builders.hardline];
      }

      // Block: wrap with start/end. End may be null when this block is an
      // intermediate section of a multi-block.
      const startDoc = printInline((node as Block).start, source);
      const endDoc = (node as Block).end
        ? printInline((node as Block).end!, source)
        : "";

      const body = aliased.trim()
        ? builders.indent([builders.softline, mapped])
        : "";

      return [startDoc, body, builders.softline, endDoc];
    };
  },
};

// ---------------------------------------------------------------------------
// ID substitution
//
// Walk the Doc returned by the HTML formatter; for every string node that
// contains a child's id, splice in that child's printed form. After
// substitution, the printed handlebars expressions sit in the correct
// positions within the HTML structure prettier produced.
// ---------------------------------------------------------------------------

function substituteChildren(
  html: Doc,
  parent: Root | Block,
  path: AstPath<HbsNode>,
  print: PrintFn,
  source: string,
): Doc {
  return utils.mapDoc(html, (current) => {
    if (typeof current !== "string") return current;
    let result: Doc = current;
    for (const id of Object.keys(parent.children)) {
      result = utils.mapDoc(result, (segment) => {
        if (typeof segment !== "string" || !segment.includes(id)) return segment;
        const idx = segment.indexOf(id);
        return [
          segment.slice(0, idx),
          printChildById(path, print, id, source),
          segment.slice(idx + id.length),
        ];
      });
    }
    return result;
  });
}

function printChildById(
  path: AstPath<HbsNode>,
  print: PrintFn,
  id: string,
  source: string,
): Doc {
  const parent = path.node as Root | Block;
  const child = parent.children[id];
  if (!child) throw new Error(`Missing child for id ${id}`);
  // Inline / raw need direct printing here (we have the source for comment
  // disambiguation, which `print` for an inline doesn't get). Block and
  // multi-block route through `path.call(print, ...)` so prettier's embed
  // machinery runs for them.
  if (child.type === "inline") return printInline(child, source);
  if (child.type === "raw") return child.content;
  return path.call(print, "children", id);
}
