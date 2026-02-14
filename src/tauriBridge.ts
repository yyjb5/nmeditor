import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";
import {
  confirm as tauriConfirm,
  message as tauriMessage,
  open as tauriOpenDialog,
  save as tauriSaveDialog,
} from "@tauri-apps/plugin-dialog";
import {
  readFile as tauriReadFile,
  stat as tauriStat,
  writeFile as tauriWriteFile,
  writeTextFile as tauriWriteTextFile,
} from "@tauri-apps/plugin-fs";

type Unlisten = () => void | Promise<void>;

type BridgeOverride = {
  invoke?: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  listen?: <T>(
    event: string,
    handler: (payload: { payload: T }) => void,
  ) => Promise<Unlisten>;
  openDialog?: (options?: Record<string, unknown>) => Promise<string | string[] | null>;
  saveDialog?: (options?: Record<string, unknown>) => Promise<string | null>;
  confirmDialog?: (message: string, options?: Record<string, unknown>) => Promise<boolean>;
  messageDialog?: (message: string, options?: Record<string, unknown>) => Promise<void>;
  statFile?: (path: string) => Promise<{ size?: number }>;
  readBinaryFile?: (path: string) => Promise<Uint8Array>;
  writeBinaryFile?: (path: string, data: Uint8Array) => Promise<void>;
  writeTextFile?: (path: string, content: string) => Promise<void>;
};

const getOverride = (): BridgeOverride | null => {
  if (typeof window === "undefined") return null;
  return (window as unknown as { __NMEDITOR_BRIDGE__?: BridgeOverride }).__NMEDITOR_BRIDGE__ ?? null;
};

const hasTauriRuntime = (): boolean => {
  if (typeof window === "undefined") return false;
  const candidate = window as unknown as { __TAURI_INTERNALS__?: unknown };
  return typeof candidate.__TAURI_INTERNALS__ !== "undefined";
};

const missingRuntimeError = (apiName: string): Error =>
  new Error(
    `[tauriBridge] ${apiName} is unavailable outside Tauri runtime. ` +
      "Provide window.__NMEDITOR_BRIDGE__ mock when running in browser tests.",
  );

export async function invokeCmd<T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> {
  const override = getOverride();
  if (override?.invoke) return override.invoke<T>(command, args);
  if (!hasTauriRuntime()) throw missingRuntimeError(`invoke(${command})`);
  return tauriInvoke<T>(command, args);
}

export async function listenEvent<T>(
  event: string,
  handler: (payload: { payload: T }) => void,
): Promise<Unlisten> {
  const override = getOverride();
  if (override?.listen) return override.listen<T>(event, handler);
  if (!hasTauriRuntime()) {
    if (typeof window === "undefined") return async () => {};
    const eventName = `nmeditor:${event}`;
    const listener = (raw: Event) => {
      const custom = raw as CustomEvent<T>;
      handler({ payload: custom.detail });
    };
    window.addEventListener(eventName, listener as EventListener);
    return async () => {
      window.removeEventListener(eventName, listener as EventListener);
    };
  }
  return tauriListen<T>(event, handler);
}

export async function openFileDialog(
  options?: Record<string, unknown>,
): Promise<string | string[] | null> {
  const override = getOverride();
  if (override?.openDialog) return override.openDialog(options);
  if (!hasTauriRuntime()) return null;
  return tauriOpenDialog(options as never);
}

export async function saveFileDialog(
  options?: Record<string, unknown>,
): Promise<string | null> {
  const override = getOverride();
  if (override?.saveDialog) return override.saveDialog(options);
  if (!hasTauriRuntime()) return null;
  return tauriSaveDialog(options as never);
}

export async function confirmDialog(
  message: string,
  options?: Record<string, unknown>,
): Promise<boolean> {
  const override = getOverride();
  if (override?.confirmDialog) return override.confirmDialog(message, options);
  if (!hasTauriRuntime()) {
    if (typeof window === "undefined") return false;
    return window.confirm(message);
  }
  return tauriConfirm(message, options as never);
}

export async function messageDialog(
  message: string,
  options?: Record<string, unknown>,
): Promise<void> {
  const override = getOverride();
  if (override?.messageDialog) return override.messageDialog(message, options);
  if (!hasTauriRuntime()) return;
  await tauriMessage(message, options as never);
}

export async function statFile(path: string): Promise<{ size?: number }> {
  const override = getOverride();
  if (override?.statFile) return override.statFile(path);
  if (!hasTauriRuntime()) throw missingRuntimeError("statFile");
  const result = await tauriStat(path);
  return { size: result.size };
}

export async function readBinaryFile(path: string): Promise<Uint8Array> {
  const override = getOverride();
  if (override?.readBinaryFile) return override.readBinaryFile(path);
  if (!hasTauriRuntime()) throw missingRuntimeError("readBinaryFile");
  return tauriReadFile(path);
}

export async function writeBinaryFile(path: string, data: Uint8Array): Promise<void> {
  const override = getOverride();
  if (override?.writeBinaryFile) return override.writeBinaryFile(path, data);
  if (!hasTauriRuntime()) throw missingRuntimeError("writeBinaryFile");
  await tauriWriteFile(path, data);
}

export async function writeText(path: string, content: string): Promise<void> {
  const override = getOverride();
  if (override?.writeTextFile) return override.writeTextFile(path, content);
  if (!hasTauriRuntime()) throw missingRuntimeError("writeText");
  await tauriWriteTextFile(path, content);
}
