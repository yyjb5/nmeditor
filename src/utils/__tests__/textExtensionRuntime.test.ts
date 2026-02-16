import { describe, expect, it } from "vitest";
import {
  createTextExtensionRuntime,
  type TextExtensionHost,
  type TextExtensionSelection,
} from "../textExtensionRuntime";

type HostState = {
  text: string;
  selection: TextExtensionSelection;
  messages: Array<{ message: string; title?: string }>;
};

function createHost(state: HostState): TextExtensionHost {
  return {
    path: "C:/tmp/demo.txt",
    getText: () => state.text,
    replaceText: (nextText: string) => {
      const changed = nextText !== state.text;
      state.text = nextText;
      return changed;
    },
    getSelection: () => state.selection,
    setSelection: (selection: TextExtensionSelection) => {
      state.selection = selection;
    },
    replaceSelection: (text: string) => {
      const start = Math.max(0, Math.min(state.selection.start, state.selection.end));
      const end = Math.max(0, Math.max(state.selection.start, state.selection.end));
      state.text = `${state.text.slice(0, start)}${text}${state.text.slice(end)}`;
      const caret = start + text.length;
      state.selection = { start: caret, end: caret };
      return true;
    },
    showMessage: async (message: string, title?: string) => {
      state.messages.push({ message, title });
    },
    confirm: async () => true,
  };
}

describe("textExtensionRuntime", () => {
  it("runs a registered command when required permissions are granted", async () => {
    const state: HostState = {
      text: "hello",
      selection: { start: 0, end: 5 },
      messages: [],
    };
    const runtime = createTextExtensionRuntime(() => createHost(state));
    runtime.registerCommand({
      id: "demo.upper",
      title: "Uppercase",
      permissions: ["text.read", "text.write"],
      run: ({ getText, replaceText }) => {
        replaceText(getText().toUpperCase());
      },
    });

    await runtime.runCommand("demo.upper", ["text.read", "text.write"]);
    expect(state.text).toBe("HELLO");
  });

  it("rejects execution when granted permissions miss declared ones", async () => {
    const state: HostState = {
      text: "abc",
      selection: { start: 0, end: 0 },
      messages: [],
    };
    const runtime = createTextExtensionRuntime(() => createHost(state));
    runtime.registerCommand({
      id: "demo.write",
      title: "Write",
      permissions: ["text.write"],
      run: ({ replaceText }) => {
        replaceText("ok");
      },
    });

    await expect(runtime.runCommand("demo.write", [])).rejects.toThrow(
      "missing permissions: text.write",
    );
  });

  it("enforces context-level permissions even if command declares none", async () => {
    const state: HostState = {
      text: "abc",
      selection: { start: 0, end: 0 },
      messages: [],
    };
    const runtime = createTextExtensionRuntime(() => createHost(state));
    runtime.registerCommand({
      id: "demo.illegal",
      title: "Illegal",
      permissions: [],
      run: ({ getText }) => {
        void getText();
      },
    });

    await expect(runtime.runCommand("demo.illegal", [])).rejects.toThrow(
      "requires permission \"text.read\"",
    );
  });

  it("loads commands from script source and supports source unload", async () => {
    const state: HostState = {
      text: "abcdef",
      selection: { start: 1, end: 4 },
      messages: [],
    };
    const runtime = createTextExtensionRuntime(() => createHost(state));
    const loaded = runtime.loadScript(
      `
registerCommand({
  id: "script.wrap",
  title: "Wrap selection",
  permissions: ["selection.read", "selection.write", "text.write"],
  run: ({ replaceSelection }) => {
    replaceSelection("[x]");
  }
});
`,
      "file:demo-script.js",
    );

    expect(loaded.map((item) => item.id)).toEqual(["script.wrap"]);
    await runtime.runCommand("script.wrap", [
      "selection.read",
      "selection.write",
      "text.write",
    ]);
    expect(state.text).toBe("a[x]ef");
    expect(runtime.unloadSource("file:demo-script.js")).toBe(1);
    await expect(runtime.runCommand("script.wrap")).rejects.toThrow("was not found");
  });

  it("prevents command id override across different sources", () => {
    const state: HostState = {
      text: "abc",
      selection: { start: 0, end: 0 },
      messages: [],
    };
    const runtime = createTextExtensionRuntime(() => createHost(state));
    runtime.registerCommand({
      id: "demo.same-id",
      title: "A",
      run: () => {},
    }, "builtin");

    expect(() =>
      runtime.registerCommand(
        {
          id: "demo.same-id",
          title: "B",
          run: () => {},
        },
        "file:ext.js",
      ),
    ).toThrow("already registered by source");
  });
});
