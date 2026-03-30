import Handlebars from "handlebars";

export type AnnotatedNode = hbs.AST.Node & {
  _start?: number;
  _end?: number;
  [key: string]: unknown;
};

function computeOffsets(source: string): number[] {
  const offsets = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

function locToOffset(loc: hbs.AST.Position, offsets: number[]): number {
  return offsets[loc.line - 1] + loc.column;
}

function annotateOffsets(node: unknown, offsets: number[]): void {
  if (!node || typeof node !== "object") return;
  const n = node as AnnotatedNode;
  if (!n.loc) return;
  n._start = locToOffset(n.loc.start, offsets);
  n._end = locToOffset(n.loc.end, offsets);
  for (const key of Object.keys(n)) {
    if (key === "loc" || key.startsWith("_")) continue;
    const child = n[key];
    if (Array.isArray(child)) {
      for (const c of child) annotateOffsets(c, offsets);
    } else if (child && typeof child === "object" && "type" in (child as object)) {
      annotateOffsets(child, offsets);
    }
  }
}

export const parser = {
  parse(text: string): hbs.AST.Program {
    const ast = Handlebars.parse(text);
    annotateOffsets(ast, computeOffsets(text));
    return ast;
  },
  astFormat: "handlebars-ast",
  locStart(node: AnnotatedNode): number {
    if (node._start === undefined) {
      throw new Error(`Node missing offset annotation: ${node.type}`);
    }
    return node._start;
  },
  locEnd(node: AnnotatedNode): number {
    if (node._end === undefined) {
      throw new Error(`Node missing offset annotation: ${node.type}`);
    }
    return node._end;
  },
};
