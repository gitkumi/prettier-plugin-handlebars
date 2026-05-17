import { doc, type Doc } from "prettier"

const { utils } = doc

// The placeholder protocol — the plugin's single most fragile property, owned
// in one place so encode and decode cannot drift apart.
//
// The plugin replaces every handlebars expression with an opaque placeholder
// id, lets prettier's HTML formatter format the surrounding markup, then
// substitutes each id back with its original source verbatim. For that round
// trip to be correct, the id format must satisfy three invariants, all
// enforced here and nowhere else:
//
//  1. Survives prettier's HTML formatter unchanged. Lowercase alphanumeric is
//     valid (and left untouched) in element text, attribute names, attribute
//     values, and custom tag names. The HTML formatter lowercases tag names,
//     so the id must already be lowercase to come back identical.
//  2. No id is a substring of another id. Substitution scans for each id by
//     value; if one id were a substring of another, replacing the short one
//     would corrupt the long one. Ids are therefore fixed-length within a
//     document — distinct equal-length strings cannot be substrings of each
//     other. (A variable-length base-36 counter does NOT guarantee this: e.g.
//     counter 1 -> "1" and counter 69 -> "1x" yield "...1xx" and "...1xxx".)
//  3. Astronomically unlikely to collide with user content. A random per-run
//     seed plus the constant "phbs"/"xx" affixes make a natural occurrence in
//     a real template effectively impossible, and encodePlaceholders rejects a
//     generated id set if any id already appears in the source.

const ID_PREFIX = "phbs"
const ID_SUFFIX = "xx"
const MIN_COUNTER_WIDTH = 4

export interface Span {
  start: number
  end: number
}

export interface Placeholdered {
  placeholdered: string
  spans: Record<string, string>
}

// Replace each span in `source` with a placeholder id, returning the
// placeholdered text and the id -> original-source map. Spans are assumed
// sorted by `start` and non-overlapping (the parser's span pipeline
// guarantees this); they are substituted back-to-front so earlier offsets
// stay valid.
export function encodePlaceholders(
  source: string,
  spans: Span[],
): Placeholdered {
  // One width for every id in this document keeps them equal-length, which is
  // what makes invariant 2 hold. maxIndex is floored at 0 so the empty-spans
  // case takes the length of "0", not of "-1".
  const maxIndex = Math.max(0, spans.length - 1)
  const width = Math.max(MIN_COUNTER_WIDTH, maxIndex.toString(36).length)
  const makeId = makePlaceholderIdFactory(source, spans.length, width)

  // Spans are sorted ascending and non-overlapping, so one forward pass can
  // emit the text before each span followed by its id, then the trailing
  // tail. Joining once is O(n + k); a per-span splice of the whole string
  // would be O(n * k).
  const spanMap: Record<string, string> = {}
  const parts: string[] = []
  let cursor = 0
  for (let k = 0; k < spans.length; k++) {
    const { start, end } = spans[k]
    const id = makeId(k)
    spanMap[id] = source.slice(start, end)
    parts.push(source.slice(cursor, start), id)
    cursor = end
  }
  parts.push(source.slice(cursor))
  return { placeholdered: parts.join(""), spans: spanMap }
}

function makePlaceholderIdFactory(
  source: string,
  count: number,
  width: number,
): (index: number) => string {
  let attempt = 0
  while (true) {
    const randomSeed = Math.floor(Math.random() * 0xffffffff).toString(36)
    const seed = attempt === 0 ? randomSeed : randomSeed + attempt.toString(36)
    const makeId = (index: number): string =>
      ID_PREFIX + seed + index.toString(36).padStart(width, "0") + ID_SUFFIX

    let collides = false
    for (let index = 0; index < count; index++) {
      if (source.includes(makeId(index))) {
        collides = true
        break
      }
    }
    if (!collides) return makeId
    attempt++
  }
}

// Replace every placeholder id in a formatted Doc with its original handlebars
// source, in a single pass. Ids are matched by an exact alternation of the
// known keys; because every id is equal-length and lowercase-alphanumeric,
// the match is unambiguous and needs no regex escaping. Anything that is not
// a known id is left untouched.
export function substitutePlaceholders(
  formatted: Doc,
  spans: Record<string, string>,
): Doc {
  const ids = Object.keys(spans)
  if (ids.length === 0) return formatted

  const pattern = new RegExp(ids.join("|"), "g")
  return utils.mapDoc(formatted, (current) =>
    typeof current === "string"
      ? current.replace(pattern, (id) => spans[id] ?? id)
      : current,
  )
}
