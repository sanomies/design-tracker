import { Extension, type Range } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";

/** A single slash-menu entry, plus a payload `run` the editor invokes. */
export type SlashCommandPayload = {
  id: string;
  run: (args: { editor: Editor; range: Range }) => void;
};

type SlashOptions = {
  suggestion: Omit<SuggestionOptions<SlashCommandPayload>, "editor">;
};

/**
 * Notion-style slash command. Press `/` anywhere in the editor to open a
 * command palette. The actual list of commands + popup rendering is supplied
 * via `configure({ suggestion: { items, render } })` from the host component.
 *
 * The default `command` handler delegates to the chosen item's `run`, which
 * is responsible for calling `editor.chain().deleteRange(range).<…>().run()`
 * so the typed `/query` text is removed before the block transformation.
 */
export const SlashCommand = Extension.create<SlashOptions>({
  name: "slashCommand",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        allowSpaces: true,
        startOfLine: false,
        command: ({ editor, range, props }) => {
          props.run({ editor, range });
        },
      } as SlashOptions["suggestion"],
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
