import { ChildProcess, execFile, spawn } from "child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import http from "http";
import https from "https";
import { join } from "path";
import { HERMES_HOME, getEnhancedPath } from "./installer";

export const DEFAULT_PAPERCLIP_URL = "http://127.0.0.1:3100";
export const DEFAULT_PAPERCLIP_VERSION = "2026.529.0";
export const PAPERCLIP_NPX_ARGS = [
  "--yes",
  `paperclipai@${DEFAULT_PAPERCLIP_VERSION}`,
  "run",
];
export const PAPERCLIP_STARTUP_TIMEOUT_MS = 180000;
const PAPERCLIP_HEALTH_POLL_MS = 750;
const PAPERCLIP_NPX_CANDIDATES =
  process.platform === "win32"
    ? ["npx.cmd", "npx"]
    : ["/opt/homebrew/bin/npx", "/usr/local/bin/npx", "/usr/bin/npx", "npx"];

export interface PaperclipConfig {
  serverUrl: string;
  autoStart: boolean;
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

export function getPaperclipNpmCacheDir(): string {
  return join(HERMES_HOME, "paperclip-npm-cache");
}

function paperclipLogFile(): string {
  return join(HERMES_HOME, "paperclip.log");
}

function ensurePaperclipRuntimeDirs(): void {
  mkdirSync(getPaperclipNpmCacheDir(), { recursive: true });
}

function appendPaperclipLog(chunk: Buffer | string): void {
  try {
    if (!existsSync(HERMES_HOME)) {
      mkdirSync(HERMES_HOME, { recursive: true });
    }
    appendFileSync(paperclipLogFile(), chunk);
  } catch {
    // Logging must not block sidecar startup.
  }
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
    autoStart: typeof raw.autoStart === "boolean" ? raw.autoStart : true,
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
      autoStart: config.autoStart ?? current.autoStart,
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

export function requestHealth(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const healthUrl = `${normalizePaperclipUrl(url)}/api/health`;
    const mod = healthUrl.startsWith("https") ? https : http;
    const req = mod.request(
      healthUrl,
      { method: "GET", timeout: 1500 },
      (res) => {
        let body = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            resolve(false);
            return;
          }
          try {
            const parsed = JSON.parse(body) as { status?: unknown };
            resolve(parsed.status === "ok");
          } catch {
            resolve(false);
          }
        });
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
  timeout = 5000,
): Promise<{ ok: boolean; output: string; error: string | null }> {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        env: { ...process.env, PATH: getEnhancedPath() },
        timeout,
      },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          output: (stdout || stderr || "").toString().trim(),
          error: error ? error.message : null,
        });
      },
    );
  });
}

export function resolvePaperclipNpxCommand(
  fileExists: (path: string) => boolean = existsSync,
): string {
  for (const candidate of PAPERCLIP_NPX_CANDIDATES) {
    if (candidate.includes("/") && fileExists(candidate)) return candidate;
  }
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

export function buildPaperclipEnv(
  config: PaperclipConfig,
  baseEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...baseEnv,
    PATH: getEnhancedPath(),
    npm_config_cache: getPaperclipNpmCacheDir(),
    NPM_CONFIG_CACHE: getPaperclipNpmCacheDir(),
  };
  if (baseEnv.PATH && !env.PATH?.includes(baseEnv.PATH)) {
    env.PATH = `${env.PATH}:${baseEnv.PATH}`;
  }
  if (config.telemetryDisabled) {
    env.PAPERCLIP_TELEMETRY_DISABLED = "1";
    env.DO_NOT_TRACK = "1";
  }
  return env;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPaperclipStartup(
  proc: ChildProcess,
  url: string,
  getOutput: () => string,
): Promise<{ success: boolean; error?: string }> {
  const closeState: {
    value: {
      code: number | null;
      signal: NodeJS.Signals | null;
    } | null;
  } = { value: null };
  const errorState: { value: Error | null } = { value: null };

  proc.once("close", (code, signal) => {
    closeState.value = { code, signal };
  });
  proc.once("error", (error) => {
    errorState.value = error;
  });

  const start = Date.now();
  while (Date.now() - start < PAPERCLIP_STARTUP_TIMEOUT_MS) {
    if (await requestHealth(url)) {
      return { success: true };
    }

    if (errorState.value) {
      return {
        success: false,
        error: `Paperclip failed to launch: ${errorState.value.message}`,
      };
    }

    if (closeState.value) {
      const closed = closeState.value;
      const output = getOutput();
      const suffix = output ? ` ${output}` : "";
      return {
        success: false,
        error: `Paperclip exited before becoming healthy (code ${closed.code ?? "unknown"}${closed.signal ? `, signal ${closed.signal}` : ""}).${suffix}`,
      };
    }

    await delay(PAPERCLIP_HEALTH_POLL_MS);
  }

  return {
    success: false,
    error: `Paperclip did not become healthy at ${normalizePaperclipUrl(
      url,
    )} within ${Math.round(PAPERCLIP_STARTUP_TIMEOUT_MS / 1000)}s. Check ${paperclipLogFile()}.`,
  };
}

async function getLauncherInfo(): Promise<{
  available: boolean;
  detail: string | null;
}> {
  const globalCli = await execFileOutput("paperclipai", ["--version"]);
  if (globalCli.ok) {
    return { available: true, detail: globalCli.output || "paperclipai" };
  }

  const npxCommand = resolvePaperclipNpxCommand();
  if (npxCommand.includes("/") && existsSync(npxCommand)) {
    return { available: true, detail: `npx (${npxCommand})` };
  }

  const npx = await execFileOutput(npxCommand, ["--version"], 15000);
  if (npx.ok) {
    return { available: true, detail: `npx ${npx.output}` };
  }

  appendPaperclipLog(
    `[Hermes Desktop] Paperclip launcher unavailable. paperclipai: ${
      globalCli.error || globalCli.output || "unknown error"
    }; ${npxCommand}: ${npx.error || npx.output || "unknown error"}\n`,
  );
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
  ensurePaperclipRuntimeDirs();
  const env = buildPaperclipEnv(config);
  const outputChunks: string[] = [];
  const rememberOutput = (chunk: Buffer | string): void => {
    const text = chunk.toString();
    outputChunks.push(text);
    if (outputChunks.join("").length > 4000) outputChunks.shift();
    appendPaperclipLog(chunk);
  };

  const proc = spawn(resolvePaperclipNpxCommand(), PAPERCLIP_NPX_ARGS, {
    env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });
  paperclipProcess = proc;
  proc.stdout?.on("data", rememberOutput);
  proc.stderr?.on("data", rememberOutput);
  proc.unref();
  proc.on("close", () => {
    paperclipProcess = null;
  });
  proc.on("error", () => {
    paperclipProcess = null;
  });

  const result = await waitForPaperclipStartup(
    proc,
    config.serverUrl,
    () => outputChunks.join("").trim().slice(-1000),
  );
  if (!result.success) {
    if (!proc.killed) proc.kill("SIGTERM");
    if (paperclipProcess === proc) paperclipProcess = null;
  }
  return result;
}

export async function startPaperclipIfAutoStart(): Promise<void> {
  if (!getPaperclipConfig().autoStart) return;
  const result = await startPaperclip();
  if (!result.success) {
    appendPaperclipLog(
      `[Hermes Desktop] Paperclip autostart failed: ${
        result.error || "unknown error"
      }\n`,
    );
  }
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
