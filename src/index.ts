import { parser } from "./parser.ts";
import { printer } from "./printer.ts";

export const languages = [
  {
    name: "Handlebars",
    parsers: ["handlebars"],
    extensions: [".hbs", ".handlebars"],
    vscodeLanguageIds: ["handlebars"],
  },
];

export const parsers = {
  handlebars: parser,
};

export const printers = {
  "handlebars-ast": printer,
};
