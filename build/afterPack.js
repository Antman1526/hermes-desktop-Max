const { execFileSync } = require("child_process");
const { existsSync, readdirSync } = require("fs");
const path = require("path");

// Sign a single path, ignoring "not an Mach-O" errors for non-binary files.
function sign(target, entitlements) {
  const args = ["--force", "--sign", "-"];
  if (entitlements) args.push("--entitlements", entitlements);
  args.push(target);

  try {
    execFileSync("codesign", args, {
      stdio: "pipe",
    });
  } catch (e) {
    // Ignore files that aren't signable (scripts, plists, etc.)
    const msg = (e.stderr || e.stdout || "").toString();
    if (
      !msg.includes("is not an Mach-O file") &&
      !msg.includes("bundle format unrecognized")
    ) {
      throw e;
    }
  }
}

function trySign(target) {
  try {
    sign(target);
  } catch {
    // Nested Electron framework items are best-effort ad-hoc signatures.
  }
}

function walkFiles(root, predicate, visit) {
  if (!existsSync(root)) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, visit);
    } else if (entry.isFile() && predicate(fullPath, entry.name)) {
      visit(fullPath);
    }
  }
}

function walkBundleDirs(root, maxDepth, visit, depth = 1) {
  if (!existsSync(root) || depth > maxDepth) return;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.name.endsWith(".xpc") || entry.name.endsWith(".app")) {
      visit(fullPath);
      continue;
    }
    walkBundleDirs(fullPath, maxDepth, visit, depth + 1);
  }
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  const entitlementsPath = path.join(
    context.packager.projectDir,
    "build/entitlements.mac.plist",
  );

  console.log(`Ad-hoc re-signing (inside-out): ${appPath}`);

  try {
    execFileSync(
      "/usr/libexec/PlistBuddy",
      [
        "-c",
        "Delete :ElectronAsarIntegrity",
        path.join(appPath, "Contents/Info.plist"),
      ],
      { stdio: "pipe" },
    );
    console.log("Removed ElectronAsarIntegrity from Info.plist.");
  } catch (e) {
    const msg = (e.stderr || e.stdout || "").toString();
    if (!msg.includes("Does Not Exist")) {
      throw e;
    }
  }

  // Step 1: sign .dylib files (deepest leaves first)
  walkFiles(appPath, (_file, name) => name.endsWith(".dylib"), trySign);

  // Step 2: sign XPC services and nested .app bundles inside Frameworks
  walkBundleDirs(path.join(appPath, "Contents/Frameworks"), 4, trySign);

  // Step 3: sign each .framework (the versioned bundle, not through symlinks)
  for (const entry of readdirSync(path.join(appPath, "Contents/Frameworks"), {
    withFileTypes: true,
  })) {
    if (entry.isDirectory() && entry.name.endsWith(".framework")) {
      trySign(path.join(appPath, "Contents/Frameworks", entry.name));
    }
  }

  // Step 4: sign the outer .app
  sign(appPath, entitlementsPath);

  console.log("Ad-hoc re-signing complete.");
};
