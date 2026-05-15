import { doc, type AstPath, type Doc, type ParserOptions } from "prettier";

const { join, indent, hardline } = doc.builders;

type Node = hbs.AST.Node;
type PrintFn = (path: AstPath<any>) => Doc;

// The parser annotates each node with source offsets; many helpers need them
// to disambiguate AST forms that share a shape (e.g. `{{! }}` vs `{{!-- --}}`).
type Annotated<T> = T & { _start: number; _end: number };

// ---------------------------------------------------------------------------
// Delimiter helpers
// ---------------------------------------------------------------------------

// Build the open/close delimiter strings for a Handlebars tag, applying any
// `~` strip flags and an inner sigil. For example:
//   delims("#", "",   strip)       -> `{{#` / `}}`     (or `{{~#` / `~}}`)
//   delims("!-- ", " --", strip)   -> `{{!-- ` / ` --}}`
//   delims("",  "",   strip, true) -> `{{{` / `}}}`    (triple-stache)
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
// Params, hash, block params
// ---------------------------------------------------------------------------

type HasParamsAndHash = {
  params?: hbs.AST.Expression[];
  hash?: hbs.AST.Hash;
};

function printParams(node: HasParamsAndHash, print: PrintFn, path: AstPath<any>): Doc[] {
  const parts: Doc[] = [];
  if (node.params?.length) {
    for (let i = 0; i < node.params.length; i++) {
      parts.push(" ", path.call(print, "params", i));
    }
  }
  if (node.hash) {
    parts.push(" ", path.call(print, "hash"));
  }
  return parts;
}

function blockParams(program: hbs.AST.Program | undefined): string {
  if (program?.blockParams?.length) {
    return " as |" + program.blockParams.join(" ") + "|";
  }
  return "";
}

// ---------------------------------------------------------------------------
// Body / content helpers
// ---------------------------------------------------------------------------

function isEmpty(program: hbs.AST.Program | undefined | null): boolean {
  return !program?.body?.length;
}

function indentedBlock(body: Doc[]): Doc[] {
  return [indent([hardline, ...body]), hardline];
}

function printBody(path: AstPath<any>, print: PrintFn, key: string): Doc[] {
  return indentedBlock(path.call((p: AstPath<any>) => p.map(print, "body"), key));
}

function trimBlockContent(value: string, isFirst: boolean, isLast: boolean): string {
  let result = value;
  if (isFirst) result = result.replace(/^\s+/, "");
  if (isLast) result = result.replace(/\s+$/, "");
  return result;
}

// `@types/handlebars` types `ContentStatement.original` as `StripFlags`, but
// the parser stores the raw source text there. Cast through `unknown` to
// recover the actual runtime type.
function contentText(node: hbs.AST.ContentStatement): string {
  return (node.original as unknown as string) ?? node.value;
}

// ---------------------------------------------------------------------------
// Path expressions
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

function printPathExpression(node: hbs.AST.PathExpression): string {
  if (node.original === "." || node.original === "this") {
    return node.original;
  }

  const pathValue = node.parts.map(printPathSegment).join(".");

  if (node.data) {
    return "@" + "../".repeat(node.depth) + pathValue;
  }

  if (node.original.startsWith("./")) {
    return "./" + pathValue;
  }

  if (node.original.startsWith("this.")) {
    return "this." + pathValue;
  }

  return "../".repeat(node.depth) + pathValue;
}

// ---------------------------------------------------------------------------
// Source-slice disambiguation
// ---------------------------------------------------------------------------

// {{!-- ... --}} vs {{! ... }}. The parser's AST doesn't distinguish, so we
// look at the source slice at the node's start offset.
function isSafeComment(node: Annotated<hbs.AST.CommentStatement>, source: string): boolean {
  return source.slice(node._start, node._start + 6).includes("!--");
}

// {{{{raw}}}} ... {{{{/raw}}}} vs {{#...}} ... {{/...}}.
function isRawBlock(node: Annotated<hbs.AST.BlockStatement>, source: string): boolean {
  return source.slice(node._start, node._start + 4) === "{{{{";
}

// `{{^x}}...{{/x}}` parses to a block with no program but with an inverse; the
// Handlebars parser shifts the body into `inverse`. Non-inverse blocks always
// have a program (possibly empty body) and optionally an inverse.
function isInverseOpened(node: hbs.AST.BlockStatement): boolean {
  return !node.program && !!node.inverse;
}

function printRawBody(program: hbs.AST.Program | undefined): string {
  if (!program?.body?.length) return "";
  return program.body
    .map((s) => contentText(s as hbs.AST.ContentStatement))
    .join("");
}

// ---------------------------------------------------------------------------
// Printer
// ---------------------------------------------------------------------------

export const printer = {
  print(path: AstPath<any>, options: ParserOptions, print: PrintFn): Doc {
    const node = path.node;
    const source = options.originalText;

    switch (node.type) {
      case "Program": {
        const program = node as hbs.AST.Program;
        if (!program.body?.length) return "";
        return [...path.map(print, "body"), hardline];
      }

      case "ContentStatement": {
        const content = node as hbs.AST.ContentStatement;
        let text = contentText(content);
        const parent = path.getParentNode();
        if (parent && (parent as Node).type === "Program") {
          const idx = path.getName() as number;
          const isLast = idx === (parent as hbs.AST.Program).body.length - 1;
          const grandparent = path.getParentNode(1) as Node | null;
          if (grandparent && grandparent.type !== undefined) {
            return trimBlockContent(text, idx === 0, isLast);
          }
          // Root-level Program appends its own hardline; avoid doubling it.
          if (isLast) {
            text = text.replace(/\n+$/, "");
          }
        }
        return text;
      }

      case "MustacheStatement": {
        const m = node as hbs.AST.MustacheStatement;
        const { open, close } = delims("", "", m.strip, m.escaped === false);
        return [open, path.call(print, "path"), ...printParams(m, print, path), close];
      }

      case "Decorator": {
        const d = node as hbs.AST.Decorator;
        const { open, close } = delims("* ", "", d.strip);
        return [open, path.call(print, "path"), ...printParams(d, print, path), close];
      }

      case "PartialStatement": {
        const p = node as hbs.AST.PartialStatement;
        const { open, close } = delims("> ", "", p.strip);
        return [open, path.call(print, "name"), ...printParams(p, print, path), close];
      }

      case "PathExpression":
        return printPathExpression(node as hbs.AST.PathExpression);

      case "StringLiteral":
        // Handlebars' string lexer only decodes `\"` -> `"`; backslashes pass
        // through literally. So only `"` needs escaping to round-trip.
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
        return ["(", path.call(print, "path"), ...printParams(s, print, path), ")"];
      }

      case "Hash":
        return join(" ", path.map(print, "pairs"));

      case "HashPair": {
        const pair = node as hbs.AST.HashPair;
        return [pair.key, "=", path.call(print, "value")];
      }

      case "CommentStatement":
        return printComment(node as Annotated<hbs.AST.CommentStatement>, source);

      case "BlockStatement":
        return printBlock(node as Annotated<hbs.AST.BlockStatement>, path, print, source);

      case "PartialBlockStatement":
        return printSimpleBlock("{{#> ", "name", node as hbs.AST.PartialBlockStatement, path, print);

      case "DecoratorBlock":
        return printSimpleBlock("{{#*", "path", node as hbs.AST.DecoratorBlock, path, print);

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  },

  getVisitorKeys(node: Node): string[] {
    switch (node.type) {
      case "Program":
        return ["body"];
      case "BlockStatement":
        return ["program", "inverse"];
      case "PartialBlockStatement":
      case "DecoratorBlock":
        return ["program"];
      default:
        return [];
    }
  },
};

// ---------------------------------------------------------------------------
// Comment printing
// ---------------------------------------------------------------------------

function printComment(node: Annotated<hbs.AST.CommentStatement>, source: string): Doc {
  const val = node.value;
  if (isSafeComment(node, source)) {
    if (val.includes("\n")) {
      const { open, close } = delims("!--", "--", node.strip);
      return [open, val, close];
    }
    const { open, close } = delims("!-- ", " --", node.strip);
    return [open, val.trim(), close];
  }
  const { open, close } = delims("! ", " ", node.strip);
  return [open, val.trim(), close];
}

// ---------------------------------------------------------------------------
// Block printing
// ---------------------------------------------------------------------------

type SimpleBlockNode = hbs.AST.PartialBlockStatement | hbs.AST.DecoratorBlock;

function printSimpleBlock(
  openTag: string,
  nameKey: "name" | "path",
  node: SimpleBlockNode,
  path: AstPath<any>,
  print: PrintFn,
): Doc[] {
  const parts: Doc[] = [openTag, path.call(print, nameKey), ...printParams(node, print, path), "}}"];
  if (!isEmpty(node.program)) {
    parts.push(...printBody(path, print, "program"));
  }
  parts.push("{{/", path.call(print, nameKey), "}}");
  return parts;
}

function printBlock(
  node: Annotated<hbs.AST.BlockStatement>,
  path: AstPath<any>,
  print: PrintFn,
  source: string,
): Doc {
  if (isRawBlock(node, source)) {
    return [
      "{{{{", path.call(print, "path"), "}}}}",
      printRawBody(node.program),
      "{{{{/", path.call(print, "path"), "}}}}",
    ];
  }

  const inverseOpened = isInverseOpened(node);
  const opener = delims(inverseOpened ? "^" : "#", "", node.openStrip);
  const closer = delims("/", "", node.closeStrip);

  const parts: Doc[] = [
    opener.open,
    path.call(print, "path"),
    ...printParams(node, print, path),
  ];
  if (!inverseOpened) {
    parts.push(blockParams(node.program));
  }
  parts.push(opener.close);

  const bodyKey = inverseOpened ? "inverse" : "program";
  const bodyNode = inverseOpened ? node.inverse : node.program;
  const hasTrailingElse = !inverseOpened && !!node.inverse;

  if (isEmpty(bodyNode) && !hasTrailingElse) {
    parts.push(closer.open, path.call(print, "path"), closer.close);
    return parts;
  }

  if (!isEmpty(bodyNode)) {
    parts.push(...printBody(path, print, bodyKey));
  }

  if (hasTrailingElse) {
    printInverse(node, path, print, parts);
  }

  parts.push(closer.open, path.call(print, "path"), closer.close);
  return parts;
}

// Print the inverse (else / else-if) portion of a block statement. Recurses
// through arbitrary-depth chained inverses (if/else-if/else-if/else) by
// descending with `path.call`, so Prettier's path context stays correct at
// each level.
function printInverse(
  block: hbs.AST.BlockStatement,
  path: AstPath<any>,
  print: PrintFn,
  parts: Doc[],
): void {
  if (!block.inverse) return;

  path.call((inversePath: AstPath<any>) => {
    const inverse = inversePath.node as hbs.AST.Program & { chained?: boolean };
    if (inverse.chained) {
      // Chained else-if: inverse.body[0] is the nested BlockStatement.
      inversePath.call((blockPath: AstPath<any>) => {
        const chained = blockPath.node as hbs.AST.BlockStatement;
        const { open, close } = delims("else ", "", block.inverseStrip);
        parts.push(
          open,
          blockPath.call(print, "path"),
          ...printParams(chained, print, blockPath),
          close,
        );
        if (!isEmpty(chained.program)) {
          parts.push(
            ...indentedBlock(
              blockPath.call((pgm: AstPath<any>) => pgm.map(print, "body"), "program"),
            ),
          );
        }
        printInverse(chained, blockPath, print, parts);
      }, "body", 0);
    } else {
      // Final {{else}} with no condition.
      const { open, close } = delims("else", "", block.inverseStrip);
      parts.push(open + close);
      if (inverse.body.length) {
        parts.push(...indentedBlock(inversePath.map(print, "body")));
      }
    }
  }, "inverse");
}
