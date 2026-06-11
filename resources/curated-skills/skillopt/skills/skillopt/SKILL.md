---
name: skillopt
description: Use Microsoft SkillOpt workflows to improve Hermes skills through validation-gated offline reflection, replay, and staged skill updates.
---

# SkillOpt for Hermes Skills

Use this skill when the user wants to improve agent skills, make recurring workflows more reliable, evaluate whether a skill change actually helps, or run a SkillOpt/SkillOpt-Sleep style optimization cycle for Hermes Desktop.

SkillOpt treats a skill document as trainable state for a frozen agent. The useful pattern for Hermes is:

1. Harvest representative tasks or session transcripts.
2. Reproduce the failure or recurring workflow.
3. Propose bounded edits to one skill document.
4. Evaluate against held-out tasks.
5. Stage the candidate for review.
6. Adopt only if the validation gate improves or preserves behavior.

## Source

- Repository: https://github.com/microsoft/SkillOpt
- Docs: https://microsoft.github.io/SkillOpt/
- License: MIT
- Pinned source revision for this curated Hermes skill: `c1ac570d944ee7f83fc7c4273abfcb4bfdfea392`

## Hermes-Specific Workflow

Before changing an installed Hermes skill:

1. Identify the active profile:
   - Default profile skills live under `~/.hermes/skills`.
   - Named profile skills live under `~/.hermes/profiles/<profile>/skills`.
2. Read the target `SKILL.md` and any referenced support files.
3. Define a small validation set:
   - 3 to 10 representative prompts or tasks.
   - At least one held-out task that was not used to draft the edit.
   - Include regressions the current skill must not reintroduce.
4. Create a staged candidate file instead of overwriting the live skill.
5. Compare baseline behavior to candidate behavior.
6. Adopt only after the user approves the staged candidate.

Do not silently rewrite production skills. SkillOpt-style updates must be reviewable.

## Installing SkillOpt Locally

Use an isolated Python environment so Hermes Desktop's Node/Electron dependencies remain untouched:

```bash
python3 -m venv .venv-skillopt
source .venv-skillopt/bin/activate
python -m pip install --upgrade pip
python -m pip install skillopt
```

For the current repository version:

```bash
git clone https://github.com/microsoft/SkillOpt.git /tmp/SkillOpt
cd /tmp/SkillOpt
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -e ".[dev]"
```

## Running SkillOpt-Sleep

For safe preview mode:

```bash
python -m skillopt_sleep run --project "$(pwd)" --backend mock --gate on
```

For a real optimizer run using Codex budget:

```bash
python -m skillopt_sleep run --project "$(pwd)" --backend codex --gate on
```

Use `mock` first. Move to a real backend only after the project path, candidate skill, and validation tasks are clear.

## Skill Candidate Template

When staging a skill update, produce a review artifact with this structure:

```markdown
# SkillOpt Candidate: <skill-name>

## Target

- Installed skill path:
- Profile:
- Baseline commit or timestamp:

## Motivation

- Failure or repeated task:
- Evidence from sessions/tests:

## Proposed Edit

- Summary:
- Files changed:

## Validation Set

- Train/replay tasks:
- Held-out tasks:
- Must-not-regress checks:

## Results

- Baseline:
- Candidate:
- Gate decision:

## Adoption Plan

- Backup path:
- Exact file copy/edit command:
- Rollback command:
```

## Acceptance Gate

Accept a candidate only when all are true:

- It improves the target failure or recurring workflow.
- It does not reduce held-out task quality.
- It is shorter or clearer than the original unless extra detail is justified.
- It preserves the skill's trigger rules and safety constraints.
- The user can inspect the staged diff before adoption.

Reject or revise when the candidate:

- Adds vague best-practice text without changing behavior.
- Overfits to one transcript.
- Deletes safety constraints.
- Requires hidden secrets or provider-specific assumptions.
- Makes the skill harder to trigger correctly.

## Hermes Desktop Opportunities

Good targets for SkillOpt-style improvement in this app:

- Skills that repeatedly fail to trigger from user intent.
- Skills with long instructions but weak verification steps.
- Coding workflows where the same defects recur across sessions.
- Local model workflows that need clearer evaluation prompts.
- Documentation/reconstruction workflows that need stricter acceptance gates.

When in doubt, optimize one skill at a time and keep a reversible backup.
