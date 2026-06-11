import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

let testHome = "";

async function loadSkillsModule(): Promise<
  typeof import("../src/main/skills")
> {
  testHome = mkdtempSync(join(tmpdir(), "hermes-curated-skills-"));
  vi.resetModules();
  vi.stubEnv("HERMES_HOME", testHome);
  return import("../src/main/skills");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  if (testHome) {
    rmSync(testHome, { recursive: true, force: true });
    testHome = "";
  }
});

describe("curated external skills", () => {
  it("lists pinned agent-skills and taste-skill entries in the bundled browser", async () => {
    const { listBundledSkills } = await loadSkillsModule();

    const skills = listBundledSkills();

    expect(skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "api-and-interface-design",
          category: "agent-skills",
          source: "addyosmani/agent-skills@0.6.1",
        }),
        expect.objectContaining({
          name: "design-taste-frontend",
          category: "taste-skill",
          source: "Leonxlnx/taste-skill@3c7017d",
        }),
        expect.objectContaining({
          name: "skillopt",
          category: "skill-optimization",
          source: "microsoft/SkillOpt@c1ac570",
          homepage: "https://microsoft.github.io/SkillOpt/",
          repository: "https://github.com/microsoft/SkillOpt",
          license: "MIT",
        }),
      ]),
    );
  });

  it("installs a curated skill into the selected profile without the Hermes CLI", async () => {
    const { installSkill } = await loadSkillsModule();

    const result = installSkill("design-taste-frontend", "designer");

    expect(result).toEqual({ success: true });
    const installed = readFileSync(
      join(
        testHome,
        "profiles",
        "designer",
        "skills",
        "taste-skill",
        "taste-skill",
        "SKILL.md",
      ),
      "utf-8",
    );
    expect(installed).toContain("name: design-taste-frontend");
    expect(installed).toContain("Anti-Slop Frontend Skill");
  });

  it("installs the curated SkillOpt skill into the selected profile", async () => {
    const { installSkill } = await loadSkillsModule();

    const result = installSkill("skillopt", "research");

    expect(result).toEqual({ success: true });
    const installed = readFileSync(
      join(
        testHome,
        "profiles",
        "research",
        "skills",
        "skill-optimization",
        "skillopt",
        "SKILL.md",
      ),
      "utf-8",
    );
    expect(installed).toContain("name: skillopt");
    expect(installed).toContain("SkillOpt for Hermes Skills");
    expect(installed).toContain("validation-gated");
  });

  it("auto-installs SkillOpt as a mandatory skill when listing installed skills", async () => {
    const { listInstalledSkills } = await loadSkillsModule();

    const skills = listInstalledSkills("sleepy");

    expect(skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "skillopt",
          category: "skill-optimization",
          required: true,
        }),
      ]),
    );
    const installed = readFileSync(
      join(
        testHome,
        "profiles",
        "sleepy",
        "skills",
        "skill-optimization",
        "skillopt",
        "SKILL.md",
      ),
      "utf-8",
    );
    expect(installed).toContain("SkillOpt for Hermes Skills");
  });

  it("prevents uninstalling the mandatory SkillOpt sleep-cycle skill", async () => {
    const { uninstallSkill } = await loadSkillsModule();

    const result = uninstallSkill("skillopt", "sleepy");

    expect(result.success).toBe(false);
    expect(result.error).toContain("mandatory sleep-cycle workflow");
    expect(result.error).toContain("cannot be uninstalled");
  });

  it("exposes the mandatory SkillOpt payload for local and remote seeding", async () => {
    const { isMandatorySkillName, listMandatoryCuratedSkillPayloads } =
      await loadSkillsModule();

    const payloads = listMandatoryCuratedSkillPayloads();

    expect(isMandatorySkillName("SkillOpt")).toBe(true);
    expect(payloads).toEqual([
      expect.objectContaining({
        name: "skillopt",
        category: "skill-optimization",
        folderName: "skillopt",
      }),
    ]);
    expect(payloads[0].content).toContain("SkillOpt for Hermes Skills");
  });

  it("only reads skill detail content from Hermes skill locations", async () => {
    const { getSkillContent, installSkill } = await loadSkillsModule();
    installSkill("skillopt", "research");
    const installedPath = join(
      testHome,
      "profiles",
      "research",
      "skills",
      "skill-optimization",
      "skillopt",
    );
    const outsidePath = mkdtempSync(join(tmpdir(), "hermes-skill-outside-"));
    writeFileSync(join(outsidePath, "SKILL.md"), "secret");

    try {
      expect(getSkillContent(installedPath)).toContain(
        "SkillOpt for Hermes Skills",
      );
      expect(getSkillContent(outsidePath)).toBe("");
    } finally {
      rmSync(outsidePath, { recursive: true, force: true });
    }
  });
});
