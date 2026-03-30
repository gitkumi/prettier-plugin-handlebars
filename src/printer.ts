import { doc, type AstPath, type Doc, type ParserOptions } from "prettier";

const { join, indent, hardline } = doc.builders;

type Node = hbs.AST.Node;
type PrintFn = (path: AstPath<any>) => Doc;

function stripFlags(strip: hbs.AST.StripFlags | undefined): { open: string; close: string } {
  return { open: strip?.open ? "~" : "", close: strip?.close ? "~" : "" };
}

function openMustache(node: hbs.AST.MustacheStatement): string {
  const { open } = stripFlags(node.strip);
  return (node.escaped === false ? "{{{" : "{{") + open;
}

function closeMustache(node: hbs.AST.MustacheStatement): string {
  const { close } = stripFlags(node.strip);
  return close + (node.escaped === false ? "}}}" : "}}");
}

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

function isSimplePathSegment(part: string): boolean {
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

function printRawBody(program: hbs.AST.Program | undefined): string {
  if (!program?.body?.length) return "";
  return program.body
    .map((statement) => {
      const s = statement as hbs.AST.ContentStatement;
      return (s.original as unknown as string) ?? s.value ?? "";
    })
    .join("");
}

// Offsets are required to look at source slices; the parser annotates them.
type Annotated<T> = T & { _start: number; _end: number };

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
        let text = (content.original as unknown as string) ?? content.value;
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
        return [openMustache(m), path.call(print, "path"), ...printParams(m, print, path), closeMustache(m)];
      }

      case "Decorator": {
        const d = node as hbs.AST.Decorator;
        const { open: ot, close: ct } = stripFlags(d.strip);
        return ["{{" + ot + "* ", path.call(print, "path"), ...printParams(d, print, path), ct + "}}"];
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

      case "CommentStatement": {
        const c = node as Annotated<hbs.AST.CommentStatement>;
        const val = c.value;
        const { open: ot, close: ct } = stripFlags(c.strip);
        if (isSafeComment(c, source)) {
          if (val.includes("\n")) {
            return ["{{" + ot + "!--", val, "--" + ct + "}}"];
          }
          return ["{{" + ot + "!-- ", val.trim(), " --" + ct + "}}"];
        }
        return ["{{" + ot + "! ", val.trim(), " " + ct + "}}"];
      }

      case "BlockStatement":
        return printBlock(node as Annotated<hbs.AST.BlockStatement>, path, print, source);

      case "PartialStatement": {
        const p = node as hbs.AST.PartialStatement;
        const { open: ot, close: ct } = stripFlags(p.strip);
        return ["{{" + ot + "> ", path.call(print, "name"), ...printParams(p, print, path), ct + "}}"];
      }

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
  const { open: ot, close: oct } = stripFlags(node.openStrip);
  const { open: cot, close: cct } = stripFlags(node.closeStrip);

  const parts: Doc[] = [];

  if (inverseOpened) {
    parts.push("{{" + ot + "^", path.call(print, "path"), ...printParams(node, print, path), oct + "}}");
  } else {
    parts.push("{{" + ot + "#", path.call(print, "path"), ...printParams(node, print, path), blockParams(node.program), oct + "}}");
  }

  const bodyKey = inverseOpened ? "inverse" : "program";
  const bodyNode = inverseOpened ? node.inverse : node.program;
  const hasTrailingElse = !inverseOpened && !!node.inverse;

  if (isEmpty(bodyNode) && !hasTrailingElse) {
    parts.push("{{" + cot + "/", path.call(print, "path"), cct + "}}");
    return parts;
  }

  if (!isEmpty(bodyNode)) {
    parts.push(...printBody(path, print, bodyKey));
  }

  if (hasTrailingElse) {
    printInverse(node, path, print, parts);
  }

  parts.push("{{" + cot + "/", path.call(print, "path"), cct + "}}");
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
  const { open: iot, close: ict } = stripFlags(block.inverseStrip);

  path.call((inversePath: AstPath<any>) => {
    const inverse = inversePath.node as hbs.AST.Program & { chained?: boolean };
    if (inverse.chained) {
      // Chained else-if: inverse.body[0] is the nested BlockStatement.
      inversePath.call((blockPath: AstPath<any>) => {
        const chained = blockPath.node as hbs.AST.BlockStatement;
        parts.push(
          "{{" + iot + "else ",
          blockPath.call(print, "path"),
          ...printParams(chained, print, blockPath),
          ict + "}}",
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
      parts.push("{{" + iot + "else" + ict + "}}");
      if (inverse.body.length) {
        parts.push(...indentedBlock(inversePath.map(print, "body")));
      }
    }
  }, "inverse");
}
