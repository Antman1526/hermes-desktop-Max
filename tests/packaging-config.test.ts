import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf-8")) as {
  build?: { appId?: string; productName?: string };
  scripts: Record<string, string>;
};
const builderYaml = readFileSync("electron-builder.yml", "utf-8");

describe("packaging config", () => {
  it("brands the packaged mac app as Hermes Desktop Max", () => {
    expect(builderYaml).toContain("appId: com.antman.hermes-desktop-max");
    expect(builderYaml).toContain("productName: Hermes Desktop Max");
    expect(builderYaml).toContain(
      "artifactName: hermes-desktop-max-${version}-${arch}.${ext}",
    );
    expect(builderYaml).toContain("owner: Antman1526");
    expect(builderYaml).toContain("repo: hermes-desktop-Max");
  });

  it("uses an unsigned local mac DMG build command by default", () => {
    expect(packageJson.scripts["build:mac"]).toContain("npm run build");
    expect(packageJson.scripts["build:mac"]).toContain("--mac dmg");
    expect(packageJson.scripts["build:mac"]).toContain("--publish never");
    expect(packageJson.scripts["build:mac"]).toContain("-c.mac.notarize=false");
  });
});
