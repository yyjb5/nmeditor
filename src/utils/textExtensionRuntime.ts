export const TEXT_EXTENSION_PERMISSION_VALUES = [
  "text.read",
  "text.write",
  "selection.read",
  "selection.write",
  "ui.message",
  "ui.confirm",
] as const;

export type TextExtensionPermission = (typeof TEXT_EXTENSION_PERMISSION_VALUES)[number];

export type TextExtensionSelection = {
  start: number;
  end: number;
};

export type TextExtensionCommandContext = {
  readonly path: string | null;
  getText: () => string;
  replaceText: (nextText: string) => boolean;
  getSelection: () => TextExtensionSelection;
  setSelection: (selection: TextExtensionSelection) => void;
  replaceSelection: (text: string) => boolean;
  showMessage: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
};

export type TextExtensionCommandDefinition = {
  id: string;
  title: string;
  description?: string;
  permissions?: TextExtensionPermission[];
  run: (context: TextExtensionCommandContext) => void | Promise<void>;
};

export type TextExtensionCommandSummary = {
  id: string;
  title: string;
  description: string;
  permissions: TextExtensionPermission[];
  sourceId: string;
};

export type TextExtensionHost = {
  path: string | null;
  getText: () => string;
  replaceText: (nextText: string) => boolean;
  getSelection: () => TextExtensionSelection;
  setSelection: (selection: TextExtensionSelection) => void;
  replaceSelection: (text: string) => boolean;
  showMessage: (message: string, title?: string) => Promise<void>;
  confirm: (message: string, title?: string) => Promise<boolean>;
};

type NormalizedCommand = {
  id: string;
  title: string;
  description: string;
  permissions: TextExtensionPermission[];
  run: (context: TextExtensionCommandContext) => void | Promise<void>;
};

type RegisteredCommand = {
  sourceId: string;
  definition: NormalizedCommand;
};

export type TextExtensionRuntime = {
  registerCommand: (
    definition: TextExtensionCommandDefinition,
    sourceId?: string,
  ) => TextExtensionCommandSummary;
  listCommands: () => TextExtensionCommandSummary[];
  runCommand: (
    commandId: string,
    grantedPermissions?: TextExtensionPermission[],
  ) => Promise<void>;
  loadScript: (scriptSource: string, sourceId: string) => TextExtensionCommandSummary[];
  unloadSource: (sourceId: string) => number;
};

const VALID_PERMISSIONS = new Set<string>(TEXT_EXTENSION_PERMISSION_VALUES);

function normalizeId(value: unknown): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!id) {
    throw new Error("Extension command id is required.");
  }
  return id;
}

function normalizeTitle(value: unknown): string {
  const title = typeof value === "string" ? value.trim() : "";
  if (!title) {
    throw new Error("Extension command title is required.");
  }
  return title;
}

function normalizePermissions(value: unknown): TextExtensionPermission[] {
  if (typeof value === "undefined") return [];
  if (!Array.isArray(value)) {
    throw new Error("Extension command permissions must be an array.");
  }
  const seen = new Set<TextExtensionPermission>();
  const next: TextExtensionPermission[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") {
      throw new Error("Extension command permission items must be strings.");
    }
    if (!VALID_PERMISSIONS.has(raw)) {
      throw new Error(`Unsupported extension permission: ${raw}`);
    }
    const permission = raw as TextExtensionPermission;
    if (seen.has(permission)) continue;
    seen.add(permission);
    next.push(permission);
  }
  return next;
}

function normalizeDefinition(definition: TextExtensionCommandDefinition): NormalizedCommand {
  if (typeof definition !== "object" || definition === null) {
    throw new Error("Extension command definition must be an object.");
  }
  if (typeof definition.run !== "function") {
    throw new Error("Extension command run must be a function.");
  }
  return {
    id: normalizeId(definition.id),
    title: normalizeTitle(definition.title),
    description: typeof definition.description === "string" ? definition.description.trim() : "",
    permissions: normalizePermissions(definition.permissions),
    run: definition.run,
  };
}

function ensureGrantedPermissions(
  commandId: string,
  required: TextExtensionPermission[],
  granted: Set<TextExtensionPermission>,
) {
  const missing = required.filter((permission) => !granted.has(permission));
  if (!missing.length) return;
  throw new Error(
    `Command "${commandId}" missing permissions: ${missing.join(", ")}`,
  );
}

function createSummary(command: RegisteredCommand): TextExtensionCommandSummary {
  return {
    id: command.definition.id,
    title: command.definition.title,
    description: command.definition.description,
    permissions: [...command.definition.permissions],
    sourceId: command.sourceId,
  };
}

function buildSandboxRunner(scriptSource: string): (sandbox: Record<string, unknown>) => void {
  return new Function(
    "sandbox",
    `"use strict";
const registerCommand = sandbox.registerCommand;
const exports = undefined;
const module = undefined;
const require = undefined;
const window = undefined;
const document = undefined;
const globalThis = undefined;
const Function = undefined;
${scriptSource}
`,
  ) as (sandbox: Record<string, unknown>) => void;
}

export function createTextExtensionRuntime(getHost: () => TextExtensionHost): TextExtensionRuntime {
  const commands = new Map<string, RegisteredCommand>();

  const registerCommand = (
    definition: TextExtensionCommandDefinition,
    sourceId = "manual",
  ): TextExtensionCommandSummary => {
    const normalized = normalizeDefinition(definition);
    const normalizedSourceId = sourceId.trim() || "manual";
    const existing = commands.get(normalized.id);
    if (existing && existing.sourceId !== normalizedSourceId) {
      throw new Error(
        `Command id "${normalized.id}" is already registered by source "${existing.sourceId}".`,
      );
    }
    commands.set(normalized.id, {
      sourceId: normalizedSourceId,
      definition: normalized,
    });
    return createSummary(commands.get(normalized.id)!);
  };

  const listCommands = (): TextExtensionCommandSummary[] =>
    [...commands.values()]
      .map((item) => createSummary(item))
      .sort((left, right) =>
        `${left.title}:${left.id}`.localeCompare(`${right.title}:${right.id}`),
      );

  const runCommand = async (
    commandId: string,
    grantedPermissions?: TextExtensionPermission[],
  ): Promise<void> => {
    const key = commandId.trim();
    if (!key) {
      throw new Error("Command id is required.");
    }
    const command = commands.get(key);
    if (!command) {
      throw new Error(`Command "${key}" was not found.`);
    }
    const granted = new Set<TextExtensionPermission>(
      grantedPermissions ?? command.definition.permissions,
    );
    ensureGrantedPermissions(key, command.definition.permissions, granted);
    const host = getHost();
    const requirePermission = (permission: TextExtensionPermission) => {
      if (!granted.has(permission)) {
        throw new Error(`Command "${key}" requires permission "${permission}".`);
      }
    };
    const context: TextExtensionCommandContext = {
      path: host.path,
      getText: () => {
        requirePermission("text.read");
        return host.getText();
      },
      replaceText: (nextText: string) => {
        requirePermission("text.write");
        return host.replaceText(nextText);
      },
      getSelection: () => {
        requirePermission("selection.read");
        return host.getSelection();
      },
      setSelection: (selection: TextExtensionSelection) => {
        requirePermission("selection.write");
        host.setSelection(selection);
      },
      replaceSelection: (text: string) => {
        requirePermission("selection.read");
        requirePermission("selection.write");
        requirePermission("text.write");
        return host.replaceSelection(text);
      },
      showMessage: async (message: string, title?: string) => {
        requirePermission("ui.message");
        await host.showMessage(message, title);
      },
      confirm: async (message: string, title?: string) => {
        requirePermission("ui.confirm");
        return host.confirm(message, title);
      },
    };
    await command.definition.run(context);
  };

  const unloadSource = (sourceId: string): number => {
    const key = sourceId.trim();
    if (!key) return 0;
    const removedIds: string[] = [];
    for (const [commandId, command] of commands) {
      if (command.sourceId !== key) continue;
      removedIds.push(commandId);
    }
    for (const commandId of removedIds) {
      commands.delete(commandId);
    }
    return removedIds.length;
  };

  const loadScript = (scriptSource: string, sourceId: string): TextExtensionCommandSummary[] => {
    const normalizedSourceId = sourceId.trim();
    if (!normalizedSourceId) {
      throw new Error("Script source id is required.");
    }
    if (!scriptSource.trim()) {
      throw new Error("Script content is empty.");
    }
    unloadSource(normalizedSourceId);
    const staged: TextExtensionCommandDefinition[] = [];
    const sandbox = Object.freeze({
      registerCommand: (candidate: unknown) => {
        if (typeof candidate !== "object" || candidate === null) {
          throw new Error("registerCommand expects an object.");
        }
        staged.push(candidate as TextExtensionCommandDefinition);
      },
    });
    const runner = buildSandboxRunner(scriptSource);
    runner(sandbox);
    if (!staged.length) {
      throw new Error("Script did not register any commands.");
    }
    return staged.map((command) => registerCommand(command, normalizedSourceId));
  };

  return {
    registerCommand,
    listCommands,
    runCommand,
    loadScript,
    unloadSource,
  };
}
