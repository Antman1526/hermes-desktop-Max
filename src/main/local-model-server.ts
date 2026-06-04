import { ChildProcess, spawn, spawnSync } from "child_process";
import { existsSync, readFileSync, unlinkSync } from "fs";
import http from "http";
import net from "net";
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
export const LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT =
  "llama-server was not found. Install llama.cpp with `brew install llama.cpp`, or put a llama-server binary on PATH.";

const PID_FILE = join(HERMES_HOME, "local-model-server.pid");
const MODEL_FILE = join(HERMES_HOME, "local-model-server-model");
const PORT_FILE = join(HERMES_HOME, "local-model-server-port");
const LLAMA_SERVER_CANDIDATES = [
  "/opt/homebrew/bin/llama-server",
  "/usr/local/bin/llama-server",
];
const LOCAL_MODEL_SERVER_MAX_PORT = 8099;
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

function readPort(): number | null {
  try {
    if (!existsSync(PORT_FILE)) return null;
    const port = parseInt(readFileSync(PORT_FILE, "utf-8").trim(), 10);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

function clearStateFiles(): void {
  for (const file of [PID_FILE, MODEL_FILE, PORT_FILE]) {
    try {
      if (existsSync(file)) unlinkSync(file);
    } catch {
      /* best effort */
    }
  }
}

function baseUrlForPort(port: number): string {
  return `http://localhost:${port}/v1`;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function findAvailableLocalModelPort({
  startPort = LOCAL_MODEL_SERVER_PORT,
  endPort = LOCAL_MODEL_SERVER_MAX_PORT,
  isPortAvailable: checkPort = isPortAvailable,
}: {
  startPort?: number;
  endPort?: number;
  isPortAvailable?: (port: number) => Promise<boolean>;
} = {}): Promise<number | null> {
  for (let port = startPort; port <= endPort; port++) {
    if (await checkPort(port)) return port;
  }
  return null;
}

export function isLocalModelServerHealthy(
  port = LOCAL_MODEL_SERVER_PORT,
): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request(
      `http://127.0.0.1:${port}/v1/models`,
      { method: "GET", timeout: 1500 },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          resolve(false);
          return;
        }

        let body = "";
        res.setEncoding("utf-8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body) as { data?: unknown };
            resolve(Array.isArray(parsed.data));
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

function serverHealth(port = LOCAL_MODEL_SERVER_PORT): Promise<boolean> {
  return isLocalModelServerHealthy(port);
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
  const port = readPort() ?? LOCAL_MODEL_SERVER_PORT;
  const managed = Boolean(pid && pidIsAlive(pid));
  const running = await serverHealth(port);
  if (pid && !managed && !running) clearStateFiles();

  return {
    running,
    managed,
    launcherAvailable,
    launcherPath: launcherAvailable ? launcherPath : null,
    modelPath: managed ? readModelPath() : null,
    baseUrl: baseUrlForPort(port),
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
      error: LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT,
    };
  }

  const port = await findAvailableLocalModelPort();
  if (!port) {
    return {
      ...current,
      error: "No free local model server port was found between 8080 and 8099.",
    };
  }

  localModelProcess = spawn(command, buildLlamaServerArgs(modelPath, port), {
    env: { ...process.env, PATH: getEnhancedPath() },
    detached: process.platform !== "win32",
    stdio: "ignore",
    ...HIDDEN_SUBPROCESS_OPTIONS,
  });
  localModelProcess.unref();

  if (localModelProcess.pid) {
    safeWriteFile(PID_FILE, String(localModelProcess.pid));
    safeWriteFile(MODEL_FILE, modelPath);
    safeWriteFile(PORT_FILE, String(port));
  }

  const ready = await waitForLocalModelServerReady({
    healthCheck: () => serverHealth(port),
  });
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
