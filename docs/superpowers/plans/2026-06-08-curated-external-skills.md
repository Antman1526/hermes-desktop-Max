# Curated External Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pinned skills from `addyosmani/agent-skills` release `0.6.1` and `Leonxlnx/taste-skill` as seamless Browse-tab skills that can be installed and referenced by Hermes Desktop.

**Architecture:** Vendor only upstream `skills/*` directories into `resources/curated-skills/<source>/skills/*` with a source manifest. Extend `src/main/skills.ts` so `listBundledSkills()` merges Hermes repo skills with curated external skills, and `installSkill()` copies a curated skill into the selected Hermes profile before falling back to the Hermes CLI.

**Tech Stack:** Electron main process, Node `fs`, existing Hermes skills IPC, Vitest.

---

### Task 1: Vendor Curated Skill Sources

**Files:**
- Create: `resources/curated-skills/agent-skills/manifest.json`
- Create: `resources/curated-skills/agent-skills/skills/*/SKILL.md`
- Create: `resources/curated-skills/taste-skill/manifest.json`
- Create: `resources/curated-skills/taste-skill/skills/*/SKILL.md`

- [x] **Step 1: Copy only upstream skill directories**

Use the pinned clone `/tmp/hermes-agent-skills-0.6.1` and default-branch clone `/tmp/hermes-taste-skill`; do not vendor full repositories.

- [x] **Step 2: Add source manifests**

Each manifest must include name, displayName, homepage, repository, license, ref, commit, category, and description.

### Task 2: Main-Process Registry Integration

**Files:**
- Modify: `src/main/skills.ts`
- Test: `tests/curated-skills.test.ts`

- [x] **Step 1: Write failing tests**

Tests must assert curated skills appear in `listBundledSkills()`, carry readable metadata, and install by copying `SKILL.md` into a profile skills directory.

- [x] **Step 2: Implement minimal registry logic**

Add resource path resolution for dev and packaged app, manifest parsing, curated skill enumeration, curated install-by-name/install-by-source behavior, and directory-copy helpers.

- [x] **Step 3: Verify focused tests**

Run `./node_modules/.bin/vitest run tests/curated-skills.test.ts --pool=forks --maxWorkers=1`.

### Task 3: Full Verification

**Files:**
- Existing test/build commands only.

- [x] **Step 1: Run full unit suite**

Run `npm test -- --pool=forks --maxWorkers=1`.

- [x] **Step 2: Run production build**

Run `npm run build`.

- [x] **Step 3: Inspect final status**

Completed in the dirty-work cleanup pass on 2026-06-10.

Run `git status --short` and confirm the curated resource files are tracked as intended.
