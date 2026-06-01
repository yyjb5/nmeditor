import { accessSync, constants } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
const separator = process.platform === "win32" ? ";" : ":";
const executable = process.execPath;
const tauriCli = join(root, "node_modules", "@tauri-apps", "cli", "tauri.js");

const candidates = [
  process.env.CARGO_HOME ? join(process.env.CARGO_HOME, "bin") : null,
  process.env.USERPROFILE ? join(process.env.USERPROFILE, ".cargo", "bin") : null,
  process.env.HOME ? join(process.env.HOME, ".cargo", "bin") : null,
].filter(Boolean);

const existingPath = process.env[pathKey] ?? "";
const pathParts = existingPath.split(separator).filter(Boolean);
for (const candidate of candidates) {
  try {
    accessSync(candidate, constants.R_OK);
    if (!pathParts.some((part) => part.toLowerCase() === candidate.toLowerCase())) {
      pathParts.unshift(candidate);
    }
  } catch {
    // Ignore missing Cargo installs; Tauri will report the underlying error.
  }
}

const env = {
  ...process.env,
  [pathKey]: pathParts.join(separator),
};

const child = spawn(executable, [tauriCli, ...process.argv.slice(2)], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: false,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
