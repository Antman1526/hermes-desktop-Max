import { execFileSync } from "child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
} from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import {
  HERMES_HOME,
  HERMES_PYTHON,
  HERMES_REPO,
  hermesCliArgs,
  getEnhancedPath,
} from "./installer";
import { profileHome } from "./utils";
import { HIDDEN_SUBPROCESS_OPTIONS } from "./process-options";

export interface InstalledSkill {
  name: string;
  category: string;
  description: string;
  path: string;
}

export interface SkillSearchResult {
  name: string;
  description: string;
  category: string;
  source: string;
  installed: boolean;
  homepage?: string;
  repository?: string;
  license?: string;
  ref?: string;
  commit?: string;
}

interface CuratedSkillManifest {
  name: string;
  displayName?: string;
  description?: string;
  homepage: string;
  repository: string;
  license: string;
  ref: string;
  commit: string;
  category: string;
  sourceLabel: string;
}

interface CuratedSkill {
  folderName: string;
  skillPath: string;
  manifest: CuratedSkillManifest;
  name: string;
  description: string;
}

/**
 * Parse SKILL.md frontmatter (YAML between --- markers) for name/description.
 */
function parseSkillFrontmatter(content: string): {
  name: string;
  description: string;
} {
  const result = { name: "", description: "" };

  // Check for YAML frontmatter
  if (!content.startsWith("---")) {
    // Fall back to first heading and first paragraph
    const headingMatch = content.match(/^#\s+(.+)/m);
    if (headingMatch) result.name = headingMatch[1].trim();
    const paraMatch = content.match(/^(?!#)(?!---).+/m);
    if (paraMatch) result.description = paraMatch[0].trim().slice(0, 120);
    return result;
  }

  const endIdx = content.indexOf("---", 3);
  if (endIdx === -1) return result;

  const frontmatter = content.slice(3, endIdx);

  const nameMatch = frontmatter.match(/^\s*name:\s*["']?([^"'\n]+)["']?\s*$/m);
  if (nameMatch) result.name = nameMatch[1].trim();

  const descMatch = frontmatter.match(
    /^\s*description:\s*["']?([^"'\n]+)["']?\s*$/m,
  );
  if (descMatch) result.description = descMatch[1].trim();

  return result;
}

function curatedSkillsRootCandidates(): string[] {
  const candidates = [
    join(process.cwd(), "resources", "curated-skills"),
    join(__dirname, "..", "..", "resources", "curated-skills"),
  ];
  const resourcesPath = process.resourcesPath;
  if (resourcesPath) {
    candidates.push(
      join(resourcesPath, "resources", "curated-skills"),
      join(resourcesPath, "app.asar", "resources", "curated-skills"),
    );
  }
  return Array.from(new Set(candidates));
}

function curatedSkillsRoot(): string {
  return (
    curatedSkillsRootCandidates().find((candidate) => existsSync(candidate)) ??
    ""
  );
}

function readJsonFile<T>(file: string): T | null {
  try {
    return JSON.parse(readFileSync(file, "utf-8")) as T;
  } catch {
    return null;
  }
}

function listCuratedSkills(): CuratedSkill[] {
  const root = curatedSkillsRoot();
  if (!root) return [];

  const skills: CuratedSkill[] = [];
  try {
    for (const sourceName of readdirSync(root)) {
      const sourcePath = join(root, sourceName);
      if (!statSync(sourcePath).isDirectory()) continue;

      const manifest = readJsonFile<CuratedSkillManifest>(
        join(sourcePath, "manifest.json"),
      );
      if (!manifest?.category || !manifest.sourceLabel) continue;

      const skillsDir = join(sourcePath, "skills");
      if (!existsSync(skillsDir)) continue;

      for (const folderName of readdirSync(skillsDir)) {
        const skillPath = join(skillsDir, folderName);
        if (!statSync(skillPath).isDirectory()) continue;

        const skillFile = join(skillPath, "SKILL.md");
        if (!existsSync(skillFile)) continue;

        const content = readFileSync(skillFile, "utf-8").slice(0, 4000);
        const meta = parseSkillFrontmatter(content);
        skills.push({
          folderName,
          skillPath,
          manifest,
          name: meta.name || folderName,
          description: meta.description || manifest.description || "",
        });
      }
    }
  } catch {
    return [];
  }

  return skills.sort(
    (a, b) =>
      a.manifest.category.localeCompare(b.manifest.category) ||
      a.name.localeCompare(b.name),
  );
}

function findCuratedSkill(identifier: string): CuratedSkill | null {
  const normalized = identifier.trim().toLowerCase();
  if (!normalized) return null;

  return (
    listCuratedSkills().find((skill) => {
      const sourcePath = `${skill.manifest.sourceLabel}/${skill.folderName}`;
      return (
        skill.name.toLowerCase() === normalized ||
        skill.folderName.toLowerCase() === normalized ||
        sourcePath.toLowerCase() === normalized
      );
    }) ?? null
  );
}

function copyDirectoryRecursive(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const entry of readdirSync(from)) {
    const source = join(from, entry);
    const target = join(to, entry);
    const stat = statSync(source);
    if (stat.isDirectory()) {
      copyDirectoryRecursive(source, target);
    } else if (stat.isFile()) {
      mkdirSync(dirname(target), { recursive: true });
      copyFileSync(source, target);
    }
  }
}

function installCuratedSkill(
  identifier: string,
  profile?: string,
): SkillCliResult | null {
  const skill = findCuratedSkill(identifier);
  if (!skill) return null;

  const destination = join(
    profileHome(profile),
    "skills",
    skill.manifest.category,
    skill.folderName,
  );
  try {
    copyDirectoryRecursive(skill.skillPath, destination);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Install failed.",
    };
  }
}

/**
 * Walk the skills directory to find all installed skills.
 * Structure: skills/<category>/<skill-name>/SKILL.md
 */
export function listInstalledSkills(profile?: string): InstalledSkill[] {
  const skillsDir = join(profileHome(profile), "skills");
  if (!existsSync(skillsDir)) return [];

  const skills: InstalledSkill[] = [];

  try {
    const categories = readdirSync(skillsDir);

    for (const category of categories) {
      const categoryPath = join(skillsDir, category);
      if (!statSync(categoryPath).isDirectory()) continue;

      const entries = readdirSync(categoryPath);
      for (const entry of entries) {
        const entryPath = join(categoryPath, entry);
        if (!statSync(entryPath).isDirectory()) continue;

        const skillFile = join(entryPath, "SKILL.md");
        if (!existsSync(skillFile)) continue;

        try {
          const content = readFileSync(skillFile, "utf-8").slice(0, 4000);
          const meta = parseSkillFrontmatter(content);

          skills.push({
            name: meta.name || entry,
            category,
            description: meta.description || "",
            path: entryPath,
          });
        } catch {
          skills.push({
            name: entry,
            category,
            description: "",
            path: entryPath,
          });
        }
      }
    }
  } catch {
    // ignore
  }

  return skills.sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

/**
 * Get the full content of a SKILL.md for the detail view.
 */
export function getSkillContent(skillPath: string): string {
  const skillFile = join(skillPath, "SKILL.md");
  if (!existsSync(skillFile)) return "";

  try {
    return readFileSync(skillFile, "utf-8");
  } catch {
    return "";
  }
}

/**
 * Search the skill registry via the hermes CLI.
 */
export function searchSkills(query: string): SkillSearchResult[] {
  try {
    const output = execFileSync(
      HERMES_PYTHON,
      hermesCliArgs(["skills", "browse", "--query", query, "--json"]),
      {
        cwd: HERMES_REPO,
        env: {
          ...process.env,
          PATH: getEnhancedPath(),
          HOME: homedir(),
          HERMES_HOME,
        },
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 30000,
        ...HIDDEN_SUBPROCESS_OPTIONS,
      },
    );

    const text = output.toString().trim();
    if (!text) return [];

    // Try to parse JSON output
    try {
      const results = JSON.parse(text);
      if (Array.isArray(results)) {
        return results.map((r: Record<string, string>) => ({
          name: r.name || "",
          description: r.description || "",
          category: r.category || "",
          source: r.source || "",
          installed: false,
        }));
      }
    } catch {
      // If JSON parsing fails, the CLI may not support --json flag
      // Fall back to listing bundled skills that match
    }

    return [];
  } catch {
    return [];
  }
}

/**
 * List bundled skills from the hermes-agent repo.
 */
export function listBundledSkills(): SkillSearchResult[] {
  const bundledDir = join(HERMES_REPO, "skills");
  const skills: SkillSearchResult[] = [];

  if (existsSync(bundledDir)) {
    try {
      const categories = readdirSync(bundledDir);

      for (const category of categories) {
        const catPath = join(bundledDir, category);
        if (!statSync(catPath).isDirectory()) continue;

        const entries = readdirSync(catPath);
        for (const entry of entries) {
          const entryPath = join(catPath, entry);
          if (!statSync(entryPath).isDirectory()) continue;

          const skillFile = join(entryPath, "SKILL.md");
          if (!existsSync(skillFile)) continue;

          try {
            const content = readFileSync(skillFile, "utf-8").slice(0, 4000);
            const meta = parseSkillFrontmatter(content);

            skills.push({
              name: meta.name || entry,
              description: meta.description || "",
              category,
              source: "bundled",
              installed: false,
            });
          } catch {
            skills.push({
              name: entry,
              description: "",
              category,
              source: "bundled",
              installed: false,
            });
          }
        }
      }
    } catch {
      // ignore
    }
  }

  for (const skill of listCuratedSkills()) {
    skills.push({
      name: skill.name,
      description: skill.description,
      category: skill.manifest.category,
      source: skill.manifest.sourceLabel,
      installed: false,
      homepage: skill.manifest.homepage,
      repository: skill.manifest.repository,
      license: skill.manifest.license,
      ref: skill.manifest.ref,
      commit: skill.manifest.commit,
    });
  }

  return skills.sort(
    (a, b) =>
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
  );
}

/**
 * Failure markers seen in `hermes skills install/uninstall` stdout when the
 * CLI exits 0 despite the operation having failed. Observed live against
 * Hermes Agent v0.14.0 (2026.5.16) on 2026-05-22:
 *
 *   $ hermes skills install concept-diagram --yes
 *   Resolving 'concept-diagram'...
 *   No exact match for 'concept-diagram'. Did you mean one of these?
 *     concept-diagrams - official/creative/concept-diagrams
 *   $ echo $?    -> 0
 *
 * Without this classifier the desktop would trust the 0 exit and report
 * a successful install, leaving the user with a button that flashed and
 * did nothing (issue #310).
 */
const SKILL_CLI_FAILURE_MARKERS: readonly RegExp[] = [
  /\bNo exact match for\b/,
  /\bNo skill named\b/,
  /^Error:/m,
];

export interface SkillCliResult {
  success: boolean;
  error?: string;
}

/**
 * Classify the combined output of `hermes skills install/uninstall` after
 * the subprocess has exited 0. The CLI exits 0 even on resolution failure
 * (issue #310), so the exit code alone is not enough. When a known failure
 * marker is present, surface the message (minus the leading
 * "Resolving '...'" progress line) as `error` so the renderer can display
 * it; otherwise treat the operation as successful.
 *
 * Pure — no I/O, no globals — so it is cheap to unit-test exhaustively.
 */
export function classifySkillCliOutput(
  stdout: string,
  stderr: string = "",
): SkillCliResult {
  const combined = `${stdout}\n${stderr}`;
  if (SKILL_CLI_FAILURE_MARKERS.some((re) => re.test(combined))) {
    return { success: false, error: extractSkillCliMessage(combined) };
  }
  return { success: true };
}

function extractSkillCliMessage(output: string): string {
  // Strip the leading "Resolving '<name>'..." progress line — pure noise
  // for the user. Keep the rest verbatim so suggestions like
  // "Did you mean concept-diagrams" reach the renderer.
  const lines = output
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^Resolving '.*'\.\.\.$/.test(l));
  return lines.join("\n").trim() || output.trim();
}

export function installSkill(
  identifier: string,
  profile?: string,
): SkillCliResult {
  const curatedResult = installCuratedSkill(identifier, profile);
  if (curatedResult) return curatedResult;

  try {
    const args = hermesCliArgs(["skills", "install", identifier, "--yes"]);
    if (profile && profile !== "default") {
      args.splice(process.platform === "win32" ? 2 : 1, 0, "-p", profile);
    }

    const stdout = execFileSync(HERMES_PYTHON, args, {
      cwd: HERMES_REPO,
      env: {
        ...process.env,
        PATH: getEnhancedPath(),
        HOME: homedir(),
        HERMES_HOME,
      },
      stdio: "pipe",
      timeout: 60000,
      ...HIDDEN_SUBPROCESS_OPTIONS,
    });
    // Exit 0 alone is not proof of success — the CLI exits 0 on resolution
    // failure too. Inspect the captured stdout for known failure markers
    // (issue #310).
    return classifySkillCliOutput(stdout?.toString() ?? "");
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const msg = (e.stderr?.toString() || e.message || "").trim();
    return {
      success: false,
      error: msg || e.stdout?.toString()?.trim() || "Install failed.",
    };
  }
}

export function uninstallSkill(name: string, profile?: string): SkillCliResult {
  try {
    const args = hermesCliArgs(["skills", "uninstall", name]);
    if (profile && profile !== "default") {
      args.splice(process.platform === "win32" ? 2 : 1, 0, "-p", profile);
    }

    const stdout = execFileSync(HERMES_PYTHON, args, {
      cwd: HERMES_REPO,
      env: {
        ...process.env,
        PATH: getEnhancedPath(),
        HOME: homedir(),
        HERMES_HOME,
      },
      stdio: "pipe",
      timeout: 30000,
      ...HIDDEN_SUBPROCESS_OPTIONS,
    });
    // Same exit-0-on-failure shape as install (#310) — classify the
    // captured output before claiming success.
    return classifySkillCliOutput(stdout?.toString() ?? "");
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer; message?: string };
    const msg = (e.stderr?.toString() || e.message || "").trim();
    return {
      success: false,
      error: msg || e.stdout?.toString()?.trim() || "Uninstall failed.",
    };
  }
}
