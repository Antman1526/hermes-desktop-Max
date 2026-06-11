import { createHash } from "crypto";
import { existsSync, readdirSync, statSync } from "fs";
import { basename, extname, join } from "path";
import { HERMES_HOME } from "./installer";
import { getLocalModelRoots, DEFAULT_LOCAL_MODEL_ROOTS } from "./config";
import type { SavedModel } from "./models";
import { safeWriteFile } from "./utils";

export const LOCAL_MODEL_ROOTS = DEFAULT_LOCAL_MODEL_ROOTS;

export interface LocalModelFile {
  path: string;
  root: string;
  format: "gguf" | "safetensors";
  size?: number;
  mtimeMs?: number;
}

export interface LocalModelRootStatus {
  path: string;
  available: boolean;
  modelCount: number;
}

export interface LocalModelScanStatus {
  createdAt: number;
  roots: LocalModelRootStatus[];
  files: LocalModelFile[];
}

const SUPPORTED_FORMATS = new Set([".gguf", ".safetensors"]);
const DEFAULT_LOCAL_BASE_URL = "http://localhost:8080/v1";
const MIN_LOCAL_MODEL_BYTES = 1 * 1024 * 1024;
const LOCAL_MODEL_SCAN_CACHE_FILE = join(HERMES_HOME, "local-model-scan.json");
const NON_CHAT_MODEL_NAME_PATTERNS = [
  /\bembed(?:ding)?s?\b/i,
  /\bnomic[-_. ]?embed\b/i,
  /\bbge[-_. ]/i,
  /\be5[-_. ]/i,
  /\bgte[-_. ]/i,
];

function modelNameFromPath(path: string): string {
  const withoutExt = basename(path, extname(path));
  return (
    "Local " + withoutExt.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim()
  );
}

function stableLocalModelId(path: string): string {
  return `local-file-${createHash("sha1").update(path).digest("hex").slice(0, 16)}`;
}

export function isLikelyChatLocalModelFile(path: string): boolean {
  const name = basename(path, extname(path)).replace(/[_-]+/g, " ");
  return !NON_CHAT_MODEL_NAME_PATTERNS.some((pattern) => pattern.test(name));
}

export function discoverLocalModelFiles(
  roots: string[] = getLocalModelRoots(),
): LocalModelFile[] {
  const found: LocalModelFile[] = [];

  function visit(root: string, dir: string): void {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith("._")) continue;
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(root, entryPath);
        continue;
      }
      if (!entry.isFile()) continue;

      const ext = extname(entry.name).toLowerCase();
      if (!SUPPORTED_FORMATS.has(ext)) continue;
      if (!isLikelyChatLocalModelFile(entry.name)) continue;
      try {
        const stat = statSync(entryPath);
        if (stat.size < MIN_LOCAL_MODEL_BYTES) continue;
        found.push({
          path: entryPath,
          root,
          format: ext.slice(1) as LocalModelFile["format"],
          size: stat.size,
          mtimeMs: stat.mtimeMs,
        });
      } catch {
        continue;
      }
    }
  }

  for (const root of roots) {
    if (existsSync(root)) visit(root, root);
  }

  return found;
}

function writeLocalModelScanCache(status: LocalModelScanStatus): void {
  try {
    safeWriteFile(LOCAL_MODEL_SCAN_CACHE_FILE, JSON.stringify(status, null, 2));
  } catch {
    /* best effort */
  }
}

export function getLocalModelScanStatus(
  roots: string[] = getLocalModelRoots(),
): LocalModelScanStatus {
  const files = discoverLocalModelFiles(roots);
  const rootsStatus = roots.map((root) => ({
    path: root,
    available: existsSync(root),
    modelCount: files.filter((file) => file.root === root).length,
  }));
  const status = {
    createdAt: Date.now(),
    roots: rootsStatus,
    files,
  };
  writeLocalModelScanCache(status);
  return status;
}

export function rescanLocalModels(roots: string[] = getLocalModelRoots()): {
  status: LocalModelScanStatus;
  models: SavedModel[];
} {
  const status = getLocalModelScanStatus(roots);
  return {
    status,
    models: buildLocalModelEntries(status.files),
  };
}

export function buildLocalModelEntries(files: LocalModelFile[]): SavedModel[] {
  return files.map((file) => ({
    id: stableLocalModelId(file.path),
    name: modelNameFromPath(file.path),
    provider: "custom",
    model: file.path,
    baseUrl: DEFAULT_LOCAL_BASE_URL,
    source: "local-file",
    modelPath: file.path,
    modelRoot: file.root,
    modelFormat: file.format,
    launchable: file.format === "gguf",
    available: true,
    rootAvailable: true,
    createdAt: Date.now(),
  }));
}

function inferRoot(
  modelPath: string | undefined,
  roots: string[],
): string | undefined {
  if (!modelPath) return undefined;
  return roots.find(
    (root) => modelPath === root || modelPath.startsWith(`${root}/`),
  );
}

function localRootRank(entry: SavedModel, roots: string[]): number {
  const modelRoot = entry.modelRoot || inferRoot(entry.modelPath, roots);
  const index = modelRoot ? roots.indexOf(modelRoot) : -1;
  return index === -1 ? roots.length : index;
}

function sortLocalModelsByRootPriority(
  models: SavedModel[],
  roots: string[],
): SavedModel[] {
  return models
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const aLocal = a.entry.source === "local-file";
      const bLocal = b.entry.source === "local-file";
      if (!aLocal || !bLocal) return a.index - b.index;

      const rootDelta =
        localRootRank(a.entry, roots) - localRootRank(b.entry, roots);
      if (rootDelta !== 0) return rootDelta;

      return (
        (a.entry.name || a.entry.model).localeCompare(
          b.entry.name || b.entry.model,
        ) || a.index - b.index
      );
    })
    .map(({ entry }) => entry);
}

export function mergeDiscoveredLocalModelEntries(
  existing: SavedModel[],
  {
    discovered,
    roots = LOCAL_MODEL_ROOTS,
  }: { discovered: SavedModel[]; roots?: string[] },
): SavedModel[] {
  const chatCapableExisting = existing.filter(
    (entry) =>
      entry.source !== "local-file" ||
      isLikelyChatLocalModelFile(entry.modelPath || entry.model),
  );
  const discoveredByModel = new Map(
    discovered.map((entry) => [`${entry.provider}:${entry.model}`, entry]),
  );
  const seen = new Set<string>();

  const reconciled = chatCapableExisting.map((entry) => {
    if (entry.source !== "local-file") return entry;

    const key = `${entry.provider}:${entry.model}`;
    const fresh = discoveredByModel.get(key);
    if (fresh) {
      seen.add(key);
      return {
        ...entry,
        baseUrl: fresh.baseUrl,
        modelPath: fresh.modelPath,
        modelRoot: fresh.modelRoot,
        modelFormat: fresh.modelFormat,
        launchable: fresh.launchable,
        available: true,
        rootAvailable: true,
        unavailableReason: undefined,
      };
    }

    const modelRoot = entry.modelRoot || inferRoot(entry.modelPath, roots);
    const rootAvailable = modelRoot ? existsSync(modelRoot) : false;
    const unavailableReason =
      modelRoot && !rootAvailable
        ? `Model folder is not mounted: ${modelRoot}`
        : `Model file is missing: ${entry.modelPath || entry.model}`;

    return {
      ...entry,
      modelRoot,
      available: false,
      rootAvailable,
      unavailableReason,
    };
  });

  for (const entry of discovered) {
    const key = `${entry.provider}:${entry.model}`;
    if (
      !seen.has(key) &&
      !chatCapableExisting.some((m) => `${m.provider}:${m.model}` === key)
    ) {
      reconciled.push(entry);
    }
  }

  return sortLocalModelsByRootPriority(reconciled, roots);
}
