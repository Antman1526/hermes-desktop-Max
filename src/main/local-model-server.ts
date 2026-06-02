import { ChildProcess, spawn, spawnSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import http from "http";
import { extname, join } from "path";
import { HERMES_HOME, getEnhancedPath } from "./installer";
import {
  discoverLocalModelFiles,
  type LocalModelFile,
} from "./local-model-files";
import { HIDDEN_SUBPROCESS_OPTIONS } from "./process-options";
import { pidIsAlive, safeWriteFile } from "./utils";

export const LOCAL_MODEL_SERVER_PORT = 8080;
export const LOCAL_MODEL_SERVER_BASE_URL = `http://localhost:${LOCAL_MODEL_SERVER_PORT}/v1`;

const PID_FILE = join(HERMES_HOME, "local-model-server.pid");
const MODEL_FILE = join(HERMES_HOME, "local-model-server-model");
const LLAMA_SERVER_CANDIDATES = [
  "/opt/homebrew/bin/llama-server",
  "/usr/local/bin/llama-server",
];
const SERVER_START_TIMEOUT_MS = 120_000;
const SERVER_START_POLL_MS = 500;

let localModelProcess: ChildProcess | null = null;

export interface LocalModelServerStatus {
  running: boolean;
  managed: boolean;
  launcherAvailable: boolean;
  launcherPath: string | null;
  modelPath: string | null;
  baseUrl: string;
  pid: number | null;
  error?: string;
}

export function isLaunchableLocalModel(modelPath: string): boolean {
  return extname(modelPath).toLowerCase() === ".gguf";
}

export function isDiscoveredLocalModelPath(
  modelPath: string,
  files: Pick<LocalModelFile, "path" | "format">[] = discoverLocalModelFiles(),
): boolean {
  return files.some(
    (file) => file.path === modelPath && file.format === "gguf",
  );
}

export function buildLlamaServerArgs(
  modelPath: string,
  port = LOCAL_MODEL_SERVER_PORT,
): string[] {
  return [
    "--model",
    modelPath,
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--alias",
    modelPath,
  ];
}

export function resolveLlamaServerCommand(
  fileExists: (path: string) => boolean = existsSync,
): string {
  for (const candidate of LLAMA_SERVER_CANDIDATES) {
    if (fileExists(candidate)) return candidate;
  }
  return "llama-server";
}

function commandAvailable(command: string): boolean {
  if (command.includes("/") && existsSync(command)) return true;
  const result = spawnSync(
    process.platform === "win32" ? "where" : "which",
    [command],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: getEnhancedPath() },
      timeout: 5000,
      windowsHide: true,
    },
  );
  return result.status === 0;
}

function readPid(): number | null {
  try {
    if (!existsSync(PID_FILE)) return null;
    const pid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

function readModelPath(): string | null {
  try {
    if (!existsSync(MODEL_FILE)) return null;
    return readFileSync(MODEL_FILE, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

function clearStateFiles(): void {
  for (const file of [PID_FILE, MODEL_FILE]) {
    try {
      if (existsSync(file)) unlinkSync(file);
    } catch {
      /* best effort */
    }
  }
}

function serverHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      `http://127.0.0.1:${LOCAL_MODEL_SERVER_PORT}/v1/models`,
      { method: "GET", timeout: 1500 },
      (res) => {
        resolve(Boolean(res.statusCode && res.statusCode < 500));
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

export async function waitForLocalModelServerReady({
  timeoutMs = SERVER_START_TIMEOUT_MS,
  intervalMs = SERVER_START_POLL_MS,
  healthCheck = serverHealth,
}: {
  timeoutMs?: number;
  intervalMs?: number;
  healthCheck?: () => Promise<boolean>;
} = {}): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  do {
    if (await healthCheck()) return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  } while (Date.now() < deadline);
  return healthCheck();
}

export async function getLocalModelServerStatus(): Promise<LocalModelServerStatus> {
  const launcherPath = resolveLlamaServerCommand();
  const launcherAvailable = commandAvailable(launcherPath);
  const pid = readPid();
  const managed = Boolean(pid && pidIsAlive(pid));
  const running = await serverHealth();
  if (pid && !managed && !running) clearStateFiles();

  return {
    running,
    managed,
    launcherAvailable,
    launcherPath: launcherAvailable ? launcherPath : null,
    modelPath: managed ? readModelPath() : null,
    baseUrl: LOCAL_MODEL_SERVER_BASE_URL,
    pid: managed ? pid : null,
  };
}

export async function startLocalModelServer(
  modelPath: string,
): Promise<LocalModelServerStatus> {
  if (!isLaunchableLocalModel(modelPath)) {
    return {
      ...(await getLocalModelServerStatus()),
      error: "Only GGUF model files can be launched with llama-server.",
    };
  }
  if (!isDiscoveredLocalModelPath(modelPath)) {
    return {
      ...(await getLocalModelServerStatus()),
      error: "Model file is not in a configured local model folder.",
    };
  }
  if (!existsSync(modelPath)) {
    return {
      ...(await getLocalModelServerStatus()),
      error: `Model file does not exist: ${modelPath}`,
    };
  }

  const current = await getLocalModelServerStatus();
  if (current.running && current.modelPath === modelPath) return current;
  if (current.managed && current.modelPath !== modelPath) {
    stopLocalModelServer();
  }

  const command = resolveLlamaServerCommand();
  if (!commandAvailable(command)) {
    return {
      ...current,
      launcherAvailable: false,
      launcherPath: null,
      error: "llama-server was not found on PATH.",
    };
  }

  localModelProcess = spawn(command, buildLlamaServerArgs(modelPath), {
    env: { ...process.env, PATH: getEnhancedPath() },
    detached: process.platform !== "win32",
    stdio: "ignore",
    ...HIDDEN_SUBPROCESS_OPTIONS,
  });
  localModelProcess.unref();

  if (localModelProcess.pid) {
    safeWriteFile(PID_FILE, String(localModelProcess.pid));
    safeWriteFile(MODEL_FILE, modelPath);
  }

  const ready = await waitForLocalModelServerReady();
  const next = await getLocalModelServerStatus();
  return ready
    ? next
    : {
        ...next,
        error:
          "llama-server started but did not become ready within 120 seconds.",
      };
}

export function stopLocalModelServer(): boolean {
  const pid = readPid();
  if (pid) {
    try {
      if (process.platform !== "win32") {
        process.kill(-pid, "SIGTERM");
      } else {
        process.kill(pid, "SIGTERM");
      }
    } catch {
      try {
        process.kill(pid, "SIGTERM");
      } catch {
        /* process already stopped */
      }
    }
  }
  if (localModelProcess) {
    try {
      localModelProcess.kill("SIGTERM");
    } catch {
      /* process already stopped */
    }
    localModelProcess = null;
  }
  clearStateFiles();
  return true;
}
