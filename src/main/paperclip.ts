import { ChildProcess, execFile, spawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import http from "http";
import https from "https";
import { join } from "path";
import { HERMES_HOME, getEnhancedPath } from "./installer";

export const DEFAULT_PAPERCLIP_URL = "http://127.0.0.1:3100";

export interface PaperclipConfig {
  serverUrl: string;
  telemetryDisabled: boolean;
}

export interface PaperclipStatus {
  serverUrl: string;
  running: boolean;
  managed: boolean;
  launcherAvailable: boolean;
  launcherDetail: string | null;
  health: "ok" | "unreachable";
}

let paperclipProcess: ChildProcess | null = null;

function desktopConfigFile(): string {
  return join(HERMES_HOME, "desktop.json");
}

function readDesktopConfig(): Record<string, unknown> {
  try {
    const file = desktopConfigFile();
    if (!existsSync(file)) return {};
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    return {};
  }
}

function writeDesktopConfig(data: Record<string, unknown>): void {
  if (!existsSync(HERMES_HOME)) {
    mkdirSync(HERMES_HOME, { recursive: true });
  }
  writeFileSync(desktopConfigFile(), JSON.stringify(data, null, 2), "utf-8");
}

export function normalizePaperclipUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return DEFAULT_PAPERCLIP_URL;
  const withProtocol = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `http://${trimmed}`;
  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return DEFAULT_PAPERCLIP_URL;
    }
    return withProtocol.replace(/\/+$/, "");
  } catch {
    return DEFAULT_PAPERCLIP_URL;
  }
}

export function readPaperclipConfigFromData(
  data: Record<string, unknown>,
): PaperclipConfig {
  const raw =
    data.paperclip && typeof data.paperclip === "object"
      ? (data.paperclip as Record<string, unknown>)
      : {};

  return {
    serverUrl: normalizePaperclipUrl(
      typeof raw.serverUrl === "string" ? raw.serverUrl : "",
    ),
    telemetryDisabled:
      typeof raw.telemetryDisabled === "boolean" ? raw.telemetryDisabled : true,
  };
}

export function mergePaperclipConfigData(
  data: Record<string, unknown>,
  config: Partial<PaperclipConfig>,
): Record<string, unknown> {
  const current = readPaperclipConfigFromData(data);
  return {
    ...data,
    paperclip: {
      serverUrl: normalizePaperclipUrl(config.serverUrl ?? current.serverUrl),
      telemetryDisabled: config.telemetryDisabled ?? current.telemetryDisabled,
    },
  };
}

export function getPaperclipConfig(): PaperclipConfig {
  return readPaperclipConfigFromData(readDesktopConfig());
}

export function setPaperclipConfig(
  config: Partial<PaperclipConfig>,
): PaperclipConfig {
  const nextData = mergePaperclipConfigData(readDesktopConfig(), config);
  writeDesktopConfig(nextData);
  return readPaperclipConfigFromData(nextData);
}

function requestHealth(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const healthUrl = `${normalizePaperclipUrl(url)}/health`;
    const mod = healthUrl.startsWith("https") ? https : http;
    const req = mod.request(
      healthUrl,
      { method: "GET", timeout: 1500 },
      (res) => {
        resolve(
          Boolean(
            res.statusCode && res.statusCode >= 200 && res.statusCode < 500,
          ),
        );
        res.resume();
      },
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function execFileOutput(
  command: string,
  args: string[],
): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        env: { ...process.env, PATH: getEnhancedPath() },
        timeout: 5000,
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          output: (stdout || stderr || "").toString().trim(),
        });
      },
    );
  });
}

async function getLauncherInfo(): Promise<{
  available: boolean;
  detail: string | null;
}> {
  const globalCli = await execFileOutput("paperclipai", ["--version"]);
  if (globalCli.ok) {
    return { available: true, detail: globalCli.output || "paperclipai" };
  }

  const npx = await execFileOutput("npx", ["--version"]);
  if (npx.ok) {
    return { available: true, detail: `npx ${npx.output}` };
  }

  return { available: false, detail: null };
}

export async function getPaperclipStatus(): Promise<PaperclipStatus> {
  const config = getPaperclipConfig();
  const [healthy, launcher] = await Promise.all([
    requestHealth(config.serverUrl),
    getLauncherInfo(),
  ]);
  const managed = Boolean(paperclipProcess && !paperclipProcess.killed);

  return {
    serverUrl: config.serverUrl,
    running: healthy,
    managed,
    launcherAvailable: launcher.available,
    launcherDetail: launcher.detail,
    health: healthy ? "ok" : "unreachable",
  };
}

export async function startPaperclip(): Promise<{
  success: boolean;
  error?: string;
}> {
  const status = await getPaperclipStatus();
  if (status.running) return { success: true };
  if (!status.launcherAvailable) {
    return {
      success: false,
      error:
        "Paperclip launcher not found. Install Node.js/npm so npx is available.",
    };
  }

  const config = getPaperclipConfig();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: getEnhancedPath(),
  };
  if (config.telemetryDisabled) {
    env.PAPERCLIP_TELEMETRY_DISABLED = "1";
    env.DO_NOT_TRACK = "1";
  }

  paperclipProcess = spawn("npx", ["paperclipai", "run"], {
    env,
    stdio: "ignore",
    detached: false,
  });
  paperclipProcess.unref();
  paperclipProcess.on("close", () => {
    paperclipProcess = null;
  });
  paperclipProcess.on("error", () => {
    paperclipProcess = null;
  });

  return { success: true };
}

export function stopPaperclip(): { success: boolean; error?: string } {
  if (!paperclipProcess || paperclipProcess.killed) {
    return {
      success: false,
      error: "Hermes Desktop is not managing the running Paperclip process.",
    };
  }
  paperclipProcess.kill("SIGTERM");
  paperclipProcess = null;
  return { success: true };
}
