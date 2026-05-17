# @gitkumi/prettier-plugin-handlebars

A minimal Prettier plugin that formats `.hbs` and `.handlebars` files by
delegating HTML formatting to Prettier while preserving Handlebars expressions
verbatim.

## How it works

- Replace Handlebars template tags with placeholders.
- Let Prettier format the remaining source with its HTML formatter.
- Swap the original Handlebars template tags back into the formatted output.

Currently, the plugin does not reformat Handlebars expressions themselves.
