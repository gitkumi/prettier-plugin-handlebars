import { expect } from "vitest";
import Handlebars from "handlebars";
import { format } from "./format.ts";
import { loadFixture, stripFinalNewline } from "./fixtures.ts";

export type RenderOptions = {
  context?: Record<string, unknown>;
  data?: Record<string, unknown>;
  helpers?: Record<string, (...args: any[]) => unknown>;
  partials?: Record<string, string>;
};

export async function expectSameRender(input: string, options: RenderOptions = {}) {
  const result = await format(input);
  expect(stripFinalNewline(render(result, options))).toBe(
    stripFinalNewline(render(input, options)),
  );
}

export async function expectFixtureSameRender(name: string, options: RenderOptions = {}) {
  const { input } = loadFixture(name);
  await expectSameRender(input, options);
}

function render(input: string, options: RenderOptions = {}): string {
  const runtime = Handlebars.create();
  for (const [name, helper] of Object.entries(options.helpers ?? {})) {
    runtime.registerHelper(name, helper);
  }
  for (const [name, partial] of Object.entries(options.partials ?? {})) {
    runtime.registerPartial(name, partial);
  }
  return runtime.compile(input)(options.context ?? {}, {
    data: options.data ?? {},
  });
}
