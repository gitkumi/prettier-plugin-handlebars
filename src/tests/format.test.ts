import { describe, it, expect, vi } from "vitest"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import * as prettier from "prettier"
import { encodePlaceholders } from "../placeholders.ts"
import * as plugin from "../index.ts"

function format(input: string): Promise<string> {
  return prettier.format(input, { parser: "handlebars", plugins: [plugin] })
}

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "fixtures")

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name)
    return e.isDirectory() ? walk(path) : [path]
  })
}

// Every `<name>.hbs` under fixtures/ is one case. Formatting cases have an
// explicit `<name>.expected.hbs` sibling; `errors/*` cases have none and are
// expected to be rejected by the parser instead.
const names = walk(FIXTURES)
  .filter((f) => f.endsWith(".hbs") && !f.endsWith(".expected.hbs"))
  .map((f) =>
    relative(FIXTURES, f)
      .replace(/\\/g, "/")
      .replace(/\.hbs$/, ""),
  )
  .sort()

const read = (file: string) => readFileSync(join(FIXTURES, file), "utf8")

// The contract: handlebars source comes back byte for byte, only the
// surrounding HTML is reformatted, and reformatting is stable.
describe("formats handlebars fixtures", () => {
  for (const name of names.filter((n) => !n.startsWith("errors/"))) {
    it(name, async () => {
      const input = read(name + ".hbs")
      const expected = read(name + ".expected.hbs")
      const out = await format(input)
      expect(out).toBe(expected)
      expect(await format(out), "not idempotent").toBe(out)
    })
  }
})

describe("rejects invalid handlebars", () => {
  for (const name of names.filter((n) => n.startsWith("errors/"))) {
    it(name, async () => {
      await expect(format(read(name + ".hbs"))).rejects.toThrow()
    })
  }
})

describe("regressions", () => {
  it("adds exactly one trailing newline to non-empty formatted output", async () => {
    await expect(format("<p>{{x}}</p>")).resolves.toBe("<p>{{x}}</p>\n")
    await expect(format("<p>{{x}}</p>\n\n")).resolves.toBe("<p>{{x}}</p>\n")
  })

  it("adds exactly one trailing newline to verbatim fallback output", async () => {
    const input = "{{#if x}}<div>{{else}}</span>{{/if}}"
    await expect(format(input)).resolves.toBe(input + "\n")
  })

  it("can log verbatim fallback errors when debugging is enabled", async () => {
    const previous = process.env.PRETTIER_HBS_DEBUG
    const error = vi.spyOn(console, "error").mockImplementation(() => {})
    process.env.PRETTIER_HBS_DEBUG = "1"
    try {
      await format("{{#if x}}<div>{{else}}</span>{{/if}}")
      expect(error).toHaveBeenCalledOnce()
    } finally {
      if (previous === undefined) {
        delete process.env.PRETTIER_HBS_DEBUG
      } else {
        process.env.PRETTIER_HBS_DEBUG = previous
      }
      error.mockRestore()
    }
  })

  it("preserves significant pre and textarea content", async () => {
    await expect(format("<pre>  {{x}}\n  y</pre>")).resolves.toBe(
      "<pre>\n  {{x}}\n  y</pre\n>\n",
    )
    await expect(format("<textarea>  {{x}}\n  y</textarea>")).resolves.toBe(
      "<textarea>\n  {{x}}\n  y</textarea\n>\n",
    )
  })

  it("formats script and style content with placeholders", async () => {
    await expect(format("<script>const x = {{json}};</script>")).resolves.toBe(
      "<script>\n  const x = {{json}};\n</script>\n",
    )
    await expect(
      format("<style>.a { color: {{color}}; }</style>"),
    ).resolves.toBe("<style>\n  .a {\n    color: {{color}};\n  }\n</style>\n")
  })

  it("normalizes CRLF and preserves BOM", async () => {
    await expect(format("<p>{{x}}</p>\r\n")).resolves.toBe("<p>{{x}}</p>\n")
    await expect(format("\ufeff<p>{{x}}</p>")).resolves.toBe(
      "\ufeff<p>{{x}}</p>\n",
    )
  })

  it("formats empty and whitespace-only input to empty output", async () => {
    await expect(format("")).resolves.toBe("")
    await expect(format("   \n\t")).resolves.toBe("")
  })

  it("preserves whitespace between adjacent constructs verbatim", async () => {
    // Constructs separated only by whitespace are merged into one span, so the
    // author's spacing/line breaks round-trip exactly instead of the HTML
    // formatter collapsing them like words.
    await expect(format("{{foo}}   \n\n   {{bar}}")).resolves.toBe(
      "{{foo}}   \n\n   {{bar}}\n",
    )
  })

  it("does not scan terminators inside bracketed path literals", async () => {
    const input = "<div>{{[foo}}<br>bar]}}</div>"
    await expect(format(input)).resolves.toBe(input + "\n")
  })

  it("does not use placeholder ids that already appear in source", () => {
    const originalRandom = Math.random
    Math.random = () => 0
    try {
      const source = "<p>phbs00000xx {{name}}</p>"
      const start = source.indexOf("{{name}}")
      const { placeholdered, spans } = encodePlaceholders(source, [
        { start, end: start + "{{name}}".length },
      ])

      expect(placeholdered).toBe("<p>phbs00000xx phbs010000xx</p>")
      expect(spans).toEqual({ phbs010000xx: "{{name}}" })
    } finally {
      Math.random = originalRandom
    }
  })
})
