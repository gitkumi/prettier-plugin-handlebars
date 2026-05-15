import Handlebars from "handlebars";

// ---------------------------------------------------------------------------
// Intermediate AST
//
// Modeled after prettier-plugin-go-template: a tree of `root` / `block` /
// `multi-block` / `inline` / `raw` nodes. Each block's body is stored as
// `aliasedContent`: the original source text with every nested handlebars
// expression replaced by a unique placeholder id. The printer's `embed`
// hands the aliased content to prettier's HTML parser, then substitutes the
// printed handlebars expressions back into the resulting Doc.
// ---------------------------------------------------------------------------

export type HbsNode = Root | Block | MultiBlock | Inline | Raw;

/** Any node except the root — i.e., any node that has an `id`. */
export type HbsChild = Block | MultiBlock | Inline | Raw;

type AnyAstNode = hbs.AST.Node & { _start?: number; _end?: number };

export interface Root {
  type: "root";
  index: 0;
  length: number;
  content: string;
  contentStart: 0;
  aliasedContent: string;
  children: Record<string, HbsChild>;
}

export interface Block {
  type: "block";
  id: string;
  index: number;
  length: number;
  content: string;
  contentStart: number;
  aliasedContent: string;
  children: Record<string, HbsChild>;
  start: Inline;
  end: Inline | null;
}

export interface MultiBlock {
  type: "multi-block";
  id: string;
  index: number;
  length: number;
  blocks: Block[];
}

export type InlineKind =
  | "mustache"
  | "comment"
  | "partial"
  | "decorator"
  | "block-open"
  | "block-close"
  | "partial-block-open"
  | "partial-block-close"
  | "decorator-block-open"
  | "decorator-block-close"
  | "else"
  | "else-if";

export type InlineData =
  | { kind: "mustache"; node: hbs.AST.MustacheStatement }
  | { kind: "comment"; node: hbs.AST.CommentStatement }
  | { kind: "partial"; node: hbs.AST.PartialStatement }
  | { kind: "decorator"; node: hbs.AST.Decorator }
  | { kind: "block-open"; node: hbs.AST.BlockStatement; isInverse: boolean }
  | { kind: "block-close"; node: hbs.AST.BlockStatement }
  | { kind: "partial-block-open"; node: hbs.AST.PartialBlockStatement }
  | { kind: "partial-block-close"; node: hbs.AST.PartialBlockStatement }
  | { kind: "decorator-block-open"; node: hbs.AST.DecoratorBlock }
  | { kind: "decorator-block-close"; node: hbs.AST.DecoratorBlock }
  | { kind: "else"; strip: hbs.AST.StripFlags | undefined }
  | { kind: "else-if"; node: hbs.AST.BlockStatement };

export interface Inline {
  type: "inline";
  id: string;
  index: number;
  length: number;
  data: InlineData;
}

export interface Raw {
  type: "raw";
  id: string;
  index: number;
  length: number;
  content: string;
}

// ---------------------------------------------------------------------------
// Offset annotation (Handlebars only gives us line/column locations)
// ---------------------------------------------------------------------------

function computeLineOffsets(source: string): number[] {
  const offsets = [0];
  for (let i = 0; i < source.length; i++) {
    if (source[i] === "\n") offsets.push(i + 1);
  }
  return offsets;
}

function locToOffset(loc: hbs.AST.Position, offsets: number[]): number {
  return offsets[loc.line - 1] + loc.column;
}

function annotate(node: unknown, offsets: number[]): void {
  if (!node || typeof node !== "object") return;
  const n = node as AnyAstNode & Record<string, unknown>;
  if (n.loc) {
    n._start = locToOffset(n.loc.start, offsets);
    n._end = locToOffset(n.loc.end, offsets);
  }
  for (const key of Object.keys(n)) {
    if (key === "loc" || key.startsWith("_")) continue;
    const child = n[key];
    if (Array.isArray(child)) {
      for (const c of child) annotate(c, offsets);
    } else if (child && typeof child === "object" && "type" in (child as object)) {
      annotate(child, offsets);
    }
  }
}

// ---------------------------------------------------------------------------
// Placeholder ids
//
// Ids must survive prettier's HTML formatter unchanged (lowercase alphanumeric
// works in element text, attribute names, and attribute values). The random
// prefix avoids any chance of natural collision with user content.
// ---------------------------------------------------------------------------

function createIdGenerator(): () => string {
  const seed = Math.floor(Math.random() * 0xffffffff).toString(36);
  let counter = 0;
  return () => `phbs${seed}${(counter++).toString(36)}xx`;
}

// ---------------------------------------------------------------------------
// Body bounds
// ---------------------------------------------------------------------------

function bodyBounds(
  program: hbs.AST.Program | undefined | null,
): { start: number; end: number } | null {
  if (!program || !program.body || program.body.length === 0) return null;
  const first = program.body[0] as AnyAstNode;
  const last = program.body[program.body.length - 1] as AnyAstNode;
  if (first._start === undefined || last._end === undefined) return null;
  return { start: first._start, end: last._end };
}

// ---------------------------------------------------------------------------
// Walkers
// ---------------------------------------------------------------------------

interface Ctx {
  source: string;
  getId: () => string;
}

function aliasContent(
  rawContent: string,
  contentStart: number,
  children: Record<string, HbsChild>,
): string {
  // Replace each child's source range with its id. Iterate in reverse order
  // (high index first) so earlier indices remain valid during substitution.
  const entries = Object.entries(children).sort(
    ([, a], [, b]) => b.index - a.index,
  );
  let result = rawContent;
  for (const [id, child] of entries) {
    const from = child.index - contentStart;
    const to = from + child.length;
    result = result.slice(0, from) + id + result.slice(to);
  }
  return result;
}

function walkProgram(
  program: hbs.AST.Program | undefined | null,
  parent: Root | Block,
  ctx: Ctx,
): void {
  if (!program) return;
  for (const stmt of program.body) {
    if (stmt.type === "ContentStatement") continue;
    const child = buildChild(stmt, ctx);
    if (child) parent.children[child.id] = child;
  }
}

function buildChild(stmt: hbs.AST.Statement, ctx: Ctx): HbsChild | null {
  const s = stmt as AnyAstNode;
  switch (stmt.type) {
    case "MustacheStatement":
      return makeInline(ctx.getId(), s, {
        kind: "mustache",
        node: stmt as hbs.AST.MustacheStatement,
      });
    case "CommentStatement":
      return makeInline(ctx.getId(), s, {
        kind: "comment",
        node: stmt as hbs.AST.CommentStatement,
      });
    case "PartialStatement":
      return makeInline(ctx.getId(), s, {
        kind: "partial",
        node: stmt as hbs.AST.PartialStatement,
      });
    case "Decorator":
      return makeInline(ctx.getId(), s, {
        kind: "decorator",
        node: stmt as hbs.AST.Decorator,
      });
    case "BlockStatement":
      return buildBlock(stmt as hbs.AST.BlockStatement, ctx);
    case "PartialBlockStatement":
      return buildSimpleContainer(
        stmt as hbs.AST.PartialBlockStatement,
        "partial-block-open",
        "partial-block-close",
        ctx,
      );
    case "DecoratorBlock":
      return buildSimpleContainer(
        stmt as hbs.AST.DecoratorBlock,
        "decorator-block-open",
        "decorator-block-close",
        ctx,
      );
  }
  return null;
}

function makeInline(id: string, anchor: AnyAstNode, data: InlineData): Inline {
  if (anchor._start === undefined || anchor._end === undefined) {
    throw new Error(`Missing offsets for ${anchor.type}`);
  }
  return {
    type: "inline",
    id,
    index: anchor._start,
    length: anchor._end - anchor._start,
    data,
  };
}

// {{{{raw}}}}...{{{{/raw}}}} is parsed as a BlockStatement; the body is a
// single ContentStatement with the unparsed source.
function isRawBlock(block: hbs.AST.BlockStatement, source: string): boolean {
  const start = (block as AnyAstNode)._start;
  return start !== undefined && source.slice(start, start + 4) === "{{{{";
}

function buildBlock(block: hbs.AST.BlockStatement, ctx: Ctx): HbsChild {
  const b = block as AnyAstNode;
  if (b._start === undefined || b._end === undefined) {
    throw new Error("BlockStatement missing offsets");
  }

  if (isRawBlock(block, ctx.source)) {
    return {
      type: "raw",
      id: ctx.getId(),
      index: b._start,
      length: b._end - b._start,
      content: ctx.source.slice(b._start, b._end),
    };
  }

  // `{{^x}}body{{/x}}` (no else): Handlebars parses with no `program`, the
  // body in `inverse`. Treat as a simple block printed with `^` opener.
  // `{{^x}}A{{else}}B{{/x}}` has both program and inverse: route to multi-block
  // (Handlebars internally swaps them so output normalizes to `{{#x}}B{{else}}A{{/x}}`).
  const isInverseShorthand = !block.program && !!block.inverse;
  const bodyProgram = isInverseShorthand ? block.inverse : block.program;

  if (!isInverseShorthand && block.inverse) {
    return buildMultiBlock(block, ctx);
  }

  const id = ctx.getId();
  const start = makeInline(ctx.getId(), b, {
    kind: "block-open",
    node: block,
    isInverse: isInverseShorthand,
  });
  const end = makeInline(ctx.getId(), b, {
    kind: "block-close",
    node: block,
  });

  const body = bodyBounds(bodyProgram);
  const contentStart = body ? body.start : b._start;
  const content = body ? ctx.source.slice(body.start, body.end) : "";

  const node: Block = {
    type: "block",
    id,
    index: b._start,
    length: b._end - b._start,
    content,
    contentStart,
    aliasedContent: "",
    children: {},
    start,
    end,
  };
  walkProgram(bodyProgram, node, ctx);
  node.aliasedContent = aliasContent(content, contentStart, node.children);
  return node;
}

function buildSimpleContainer(
  block: hbs.AST.PartialBlockStatement | hbs.AST.DecoratorBlock,
  openKind: "partial-block-open" | "decorator-block-open",
  closeKind: "partial-block-close" | "decorator-block-close",
  ctx: Ctx,
): Block {
  const b = block as AnyAstNode;
  if (b._start === undefined || b._end === undefined) {
    throw new Error(`${block.type} missing offsets`);
  }
  const id = ctx.getId();
  const start = makeInline(ctx.getId(), b, {
    kind: openKind,
    node: block as any,
  } as InlineData);
  const end = makeInline(ctx.getId(), b, {
    kind: closeKind,
    node: block as any,
  } as InlineData);

  const body = bodyBounds(block.program);
  const contentStart = body ? body.start : b._start;
  const content = body ? ctx.source.slice(body.start, body.end) : "";

  const node: Block = {
    type: "block",
    id,
    index: b._start,
    length: b._end - b._start,
    content,
    contentStart,
    aliasedContent: "",
    children: {},
    start,
    end,
  };
  walkProgram(block.program, node, ctx);
  node.aliasedContent = aliasContent(content, contentStart, node.children);
  return node;
}

// Decompose an if/else (or chained if/else-if/.../else) BlockStatement into a
// flat multi-block: one Block per body section, separated by else / else-if
// inline markers. The first block carries the outer opener, the last block
// carries the outer closer, and intermediate sections share an else marker.
function buildMultiBlock(
  outer: hbs.AST.BlockStatement,
  ctx: Ctx,
): MultiBlock {
  const o = outer as AnyAstNode;
  const sections: Array<{
    start: Inline;
    body: hbs.AST.Program | undefined;
    end: Inline | null;
  }> = [];

  // Walk the chain: each iteration handles one "if" / "else if" level.
  // `current` is the BlockStatement whose `program` we're treating as one
  // section, and whose `inverse` decides what comes next.
  // The very first section uses `outer`'s opener; subsequent sections use
  // an else / else-if marker built from the corresponding BlockStatement.
  let current: hbs.AST.BlockStatement = outer;
  // first section's opener is the outer block opener
  let nextOpener: Inline = makeInline(ctx.getId(), o, {
    kind: "block-open",
    node: outer,
    isInverse: !outer.program && !!outer.inverse,
  });

  while (true) {
    if (current.inverse && (current.inverse as { chained?: boolean }).chained) {
      const chained = current.inverse.body[0] as hbs.AST.BlockStatement;
      // Section closes with an `{{else if ...}}` marker.
      const elseIfMarker = makeInline(ctx.getId(), chained as AnyAstNode, {
        kind: "else-if",
        node: chained,
      });
      sections.push({ start: nextOpener, body: current.program, end: null });
      nextOpener = elseIfMarker;
      current = chained;
      continue;
    }

    if (current.inverse) {
      // Plain `{{else}}` separating program from inverse body.
      // Use the OUTERMOST block's inverseStrip (matches existing printer
      // behavior); for chained chains the relevant strip is on `current`.
      const elseMarker: Inline = {
        type: "inline",
        id: ctx.getId(),
        // We don't have a precise index for the {{else}} token from the AST,
        // and we don't need one — the marker is consumed during block
        // assembly, never substituted into aliased content.
        index: -1,
        length: 0,
        data: { kind: "else", strip: current.inverseStrip },
      };
      sections.push({ start: nextOpener, body: current.program, end: null });
      sections.push({
        start: elseMarker,
        body: current.inverse,
        end: makeInline(ctx.getId(), o, { kind: "block-close", node: outer }),
      });
      break;
    }

    // No inverse: terminal section, with the outer closer attached.
    sections.push({
      start: nextOpener,
      body: current.program,
      end: makeInline(ctx.getId(), o, { kind: "block-close", node: outer }),
    });
    break;
  }

  const blocks: Block[] = sections.map((section) => {
    const body = bodyBounds(section.body);
    const contentStart = body ? body.start : section.start.index;
    const content = body ? ctx.source.slice(body.start, body.end) : "";
    const block: Block = {
      type: "block",
      id: ctx.getId(),
      index: section.start.index >= 0 ? section.start.index : contentStart,
      length: section.start.length,
      content,
      contentStart,
      aliasedContent: "",
      children: {},
      start: section.start,
      end: section.end,
    };
    walkProgram(section.body, block, ctx);
    block.aliasedContent = aliasContent(content, contentStart, block.children);
    return block;
  });

  return {
    type: "multi-block",
    id: ctx.getId(),
    index: o._start!,
    length: o._end! - o._start!,
    blocks,
  };
}

// ---------------------------------------------------------------------------
// Top-level parse
// ---------------------------------------------------------------------------

export function parseHandlebars(text: string): Root {
  const ast = Handlebars.parse(text);
  annotate(ast, computeLineOffsets(text));

  const ctx: Ctx = { source: text, getId: createIdGenerator() };
  const root: Root = {
    type: "root",
    index: 0,
    length: text.length,
    content: text,
    contentStart: 0,
    aliasedContent: "",
    children: {},
  };
  for (const stmt of ast.body) {
    if (stmt.type === "ContentStatement") continue;
    const child = buildChild(stmt, ctx);
    if (child) root.children[child.id] = child;
  }
  root.aliasedContent = aliasContent(text, 0, root.children);
  return root;
}

export const parser = {
  parse(text: string): Root {
    return parseHandlebars(text);
  },
  astFormat: "handlebars-ast",
  locStart(node: HbsNode): number {
    return node.index;
  },
  locEnd(node: HbsNode): number {
    return node.index + node.length;
  },
};
