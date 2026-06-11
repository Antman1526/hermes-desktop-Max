import { ChildProcess, spawn, spawnSync } from "child_process";
import {
  appendFileSync,
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  unlinkSync,
} from "fs";
import http from "http";
import net from "net";
import { homedir, tmpdir } from "os";
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
export const LOCAL_MODEL_SERVER_CONTEXT_SIZE = 16_384;
export const LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT =
  "llama-server was not found. Install llama.cpp with `brew install llama.cpp`, or put a llama-server binary on PATH.";

const PID_FILE = join(HERMES_HOME, "local-model-server.pid");
const MODEL_FILE = join(HERMES_HOME, "local-model-server-model");
const PORT_FILE = join(HERMES_HOME, "local-model-server-port");
const LOG_FILE = join(HERMES_HOME, "local-model-server.log");
const LLAMA_LOG_FILE = join(HERMES_HOME, "local-model-server-llama.log");
const LLAMA_SERVER_CANDIDATES = [
  "/opt/homebrew/bin/llama-server",
  "/usr/local/bin/llama-server",
];
const LOCAL_MODEL_SERVER_MAX_PORT = 8099;
const SERVER_START_TIMEOUT_MS = 300_000;
const SERVER_START_POLL_MS = 500;

let localModelProcess: ChildProcess | null = null;

function logLocalModelServer(message: string): void {
  try {
    appendFileSync(
      LOG_FILE,
      `[${new Date().toISOString()}] ${message}\n`,
      "utf-8",
    );
  } catch {
    /* best effort */
  }
}

export function localModelServerEnv(
  sourceEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...sourceEnv,
    PATH: sourceEnv.PATH || getEnhancedPath(),
  };
  if (!env.HOME && process.platform !== "win32") env.HOME = homedir();
  if (!env.TMPDIR && process.platform !== "win32") env.TMPDIR = tmpdir();
  for (const key of Object.keys(env)) {
    if (
      key.startsWith("ELECTRON_") ||
      key.startsWith("DYLD_") ||
      key.startsWith("LD_")
    ) {
      delete env[key];
    }
  }
  delete env.NODE_OPTIONS;
  delete env.NODE_REPL_NODE_MODULE_DIRS;
  return env;
}

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

export interface LocalModelRuntimeStatus {
  llamaServerAvailable: boolean;
  llamaServerPath: string | null;
  installHint: string | null;
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

export function validateLocalModelLaunchPath(
  modelPath: string,
  files: Pick<LocalModelFile, "path" | "format">[] = discoverLocalModelFiles(),
): string | null {
  if (!isLaunchableLocalModel(modelPath)) {
    return "Only GGUF model files can be launched with llama-server.";
  }
  if (!isDiscoveredLocalModelPath(modelPath, files)) {
    return `Model file is outside configured local model roots: ${modelPath}`;
  }
  if (!existsSync(modelPath)) {
    return `Model file does not exist: ${modelPath}`;
  }
  return null;
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
    "--ctx-size",
    String(LOCAL_MODEL_SERVER_CONTEXT_SIZE),
    "--no-warmup",
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

export function getLocalModelRuntimeStatus(
  fileExists: (path: string) => boolean = existsSync,
  commandIsAvailable: (command: string) => boolean = commandAvailable,
): LocalModelRuntimeStatus {
  const command = resolveLlamaServerCommand(fileExists);
  const available =
    command.includes("/") && fileExists(command)
      ? true
      : commandIsAvailable(command);
  return {
    llamaServerAvailable: available,
    llamaServerPath: available ? command : null,
    installHint: available ? null : LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT,
  };
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

function isPortReachable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function findAvailableLocalModelPort({
  startPort = LOCAL_MODEL_SERVER_PORT,
  endPort = LOCAL_MODEL_SERVER_MAX_PORT,
  isPortAvailable: checkPort = isPortAvailable,
  isPortReachable: checkReachable = isPortReachable,
}: {
  startPort?: number;
  endPort?: number;
  isPortAvailable?: (port: number) => Promise<boolean>;
  isPortReachable?: (port: number) => Promise<boolean>;
} = {}): Promise<number | null> {
  for (let port = startPort; port <= endPort; port++) {
    if ((await checkPort(port)) && !(await checkReachable(port))) return port;
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
  logLocalModelServer(`start requested model=${modelPath}`);
  const launchError = validateLocalModelLaunchPath(modelPath);
  if (launchError) {
    logLocalModelServer(`rejected: ${launchError}`);
    return {
      ...(await getLocalModelServerStatus()),
      error: launchError,
    };
  }

  logLocalModelServer("checking current local model server status");
  const current = await getLocalModelServerStatus();
  logLocalModelServer(
    `current status running=${current.running} managed=${current.managed} model=${current.modelPath || ""}`,
  );
  if (current.running && current.modelPath === modelPath) return current;
  if (current.managed && current.modelPath !== modelPath) {
    logLocalModelServer("stopping existing managed local model server");
    stopLocalModelServer();
  }

  const command = resolveLlamaServerCommand();
  logLocalModelServer(`resolved command=${command}`);
  if (!commandAvailable(command)) {
    logLocalModelServer("rejected: llama-server command unavailable");
    return {
      ...current,
      launcherAvailable: false,
      launcherPath: null,
      error: LOCAL_MODEL_SERVER_MISSING_LLAMA_HINT,
    };
  }

  logLocalModelServer("finding available local model server port");
  const port = await findAvailableLocalModelPort();
  if (!port) {
    logLocalModelServer("rejected: no free local model server port");
    return {
      ...current,
      error: "No free local model server port was found between 8080 and 8099.",
    };
  }
  logLocalModelServer(`using port=${port}`);

  const args = buildLlamaServerArgs(modelPath, port);
  logLocalModelServer(
    `spawning command=${command} args=${JSON.stringify(args)}`,
  );
  let logFd: number | null = null;
  try {
    logFd = openSync(LLAMA_LOG_FILE, "a");
    localModelProcess = spawn(command, args, {
      env: localModelServerEnv(),
      detached: process.platform !== "win32",
      stdio: ["ignore", logFd, logFd],
      ...HIDDEN_SUBPROCESS_OPTIONS,
    });
  } finally {
    if (logFd !== null) closeSync(logFd);
  }
  localModelProcess.unref();

  let exited = false;
  let exitDetail = "";
  localModelProcess.once("exit", (code, signal) => {
    exited = true;
    exitDetail = `code=${code ?? "null"} signal=${signal ?? "null"}`;
    logLocalModelServer(`child exited ${exitDetail}`);
  });

  if (localModelProcess.pid) {
    logLocalModelServer(`spawned pid=${localModelProcess.pid}`);
    safeWriteFile(PID_FILE, String(localModelProcess.pid));
    safeWriteFile(MODEL_FILE, modelPath);
    safeWriteFile(PORT_FILE, String(port));
  } else {
    logLocalModelServer("spawn returned without pid");
  }

  logLocalModelServer("waiting for server readiness");
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  let ready = false;
  do {
    if (await serverHealth(port)) {
      ready = true;
      break;
    }
    if (exited) break;
    await new Promise((resolve) => setTimeout(resolve, SERVER_START_POLL_MS));
  } while (Date.now() < deadline);
  logLocalModelServer(`readiness result=${ready}`);
  const next = await getLocalModelServerStatus();
  logLocalModelServer(
    `post-start status running=${next.running} managed=${next.managed} model=${next.modelPath || ""}`,
  );
  if (ready) return next;

  const error = exited
    ? `llama-server exited before it became ready (${exitDetail}). Check ${LLAMA_LOG_FILE}.`
    : `llama-server started but did not become ready within ${Math.round(
        SERVER_START_TIMEOUT_MS / 1000,
      )} seconds.`;
  logLocalModelServer(`startup failed: ${error}`);
  stopLocalModelServer();
  return {
    ...(await getLocalModelServerStatus()),
    error,
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
