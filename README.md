# @gitkumi/prettier-plugin-handlebars

A minimal Prettier plugin that formats `.hbs` and `.handlebars` files by
delegating HTML formatting to Prettier while preserving Handlebars expressions
verbatim.

## How it works

- Replace Handlebars template tags with placeholders.
- Let Prettier format the remaining source with its HTML formatter.
- Swap the original Handlebars template tags back into the formatted output.

The plugin never reformats Handlebars expressions themselves — every tag's
own bytes round-trip exactly.

## Formatting behavior

To stop Prettier's HTML formatter from mangling Handlebars structure, two kinds
of runs are kept verbatim (the surrounding HTML is still formatted normally):

- **Constructs separated only by whitespace.** A stack of tags such as

  ```hbs
  {{#each items}}
    {{> component}}
  {{/each}}
  ```

  keeps the author's line breaks and indentation instead of being collapsed
  onto one line like words. The plugin preserves your indentation here — it
  does not impose its own, so indent the block body the way you want it.

- **Single-line, tag-free blocks.** A balanced block that fits on one source
  line with no `<`, `>`, or newline inside — e.g. a conditional attribute:

  ```hbs
  <button {{#if id}}id="{{id}}"{{/if}}>…</button>
  ```

  is kept as one unit, so Prettier cannot treat `{{#if}}` / `{{/if}}` as
  separate bare attributes and split them across lines when the tag wraps.

  **Trade-off:** because Prettier never sees inside such a block, the text
  inside it is _not_ reformatted (whitespace is not collapsed, lines are not
  re-wrapped). This is intentional and harmless in practice — single-line
  tag-free blocks are almost always conditional attributes or tiny tokens with
  no meaningful text to format.

Everything else is formatted by Prettier as usual: blocks that contain HTML
tags (`{{#if x}}<a>…</a>{{/if}}`), multi-line blocks, plain mustaches with
text or code between them, and embedded `<script>` / `<style>` content.
