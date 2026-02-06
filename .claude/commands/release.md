# Release Manager

You are guiding a release for the T402 project. Follow the steps below to ensure a safe, correct release.

## Step 1: Identify Target SDK

Ask the user which SDK(s) to release using AskUserQuestion:

| SDK | Current Version | Tag Pattern | Registry |
|-----|----------------|-------------|----------|
| TypeScript (27 packages) | 2.3.1 | `v{VERSION}` | npm `@t402/*` |
| Go | 1.8.1 | `go/v{VERSION}` | Go Modules (auto) |
| Python | 1.9.1 | `python/v{VERSION}` | PyPI `t402` |
| Java | 1.8.1 | `java/v{VERSION}` | Maven Central `io.t402:t402` |

If the user already specified the SDK in their invocation args, skip the question.

## Step 2: Determine New Version

Ask the user for the version bump type (patch/minor/major) or exact version number. Calculate the new version from the current one.

**Version source of truth:**

| SDK | File | Field |
|-----|------|-------|
| TypeScript | `sdks/typescript/packages/core/package.json` | `"version"` |
| Go | Git tags only (no file to update) | — |
| Python | `sdks/python/t402/pyproject.toml` | `version = "..."` |
| Java | `sdks/java/t402/pom.xml` | `<version>...</version>` |

Read the current version from the source file and confirm the new version with the user.

## Step 3: Pre-Release Checks

Run ALL of these checks before proceeding:

### 3a. Working Tree Clean
```bash
git status --short
```
If there are uncommitted changes, warn the user and ask whether to proceed.

### 3b. Main Branch Up-to-Date
```bash
git fetch origin main
git rev-list HEAD..origin/main --count
```
If behind, warn the user.

### 3c. CHANGELOG Updated

Check that the CHANGELOG has an entry for the new version:

| SDK | CHANGELOG Path |
|-----|---------------|
| TypeScript | `CHANGELOG.md` (root) |
| Go | `sdks/go/CHANGELOG.md` |
| Python | `sdks/python/CHANGELOG.md` |
| Java | `sdks/java/CHANGELOG.md` |

Read the CHANGELOG and check:
- Is there an `## [NEW_VERSION]` or `## NEW_VERSION` section?
- Does it have a date?
- Is it non-empty (has actual change entries)?

If not, offer to help draft the CHANGELOG entry based on `git log` since the last tag.

### 3d. Tests Pass

Run tests for the target SDK:

| SDK | Command | Working Directory |
|-----|---------|-------------------|
| TypeScript | `pnpm test` | `sdks/typescript` |
| Go | `go test ./...` | `sdks/go` |
| Python | `uv run pytest` | `sdks/python/t402` |
| Java | `mvn clean test` | `sdks/java/t402` |

If tests fail, stop and report.

### 3e. CI Workflow Exists and Matches

Verify the release workflow will be triggered by the tag:

| SDK | Workflow | Tag Trigger |
|-----|----------|-------------|
| TypeScript | `.github/workflows/npm_release.yml` | `v*` |
| Go | `.github/workflows/go_release.yml` | `go/v*` |
| Python | `.github/workflows/python_release.yml` | `python/v*` |
| Java | `.github/workflows/java_release.yml` | `java/v*` |

Read the workflow file and confirm the `on.push.tags` pattern matches the tag you'll create.

## Step 4: Version Bump

### TypeScript (27 packages)
Update version in ALL `package.json` files. Use a script approach:
```bash
# Find all @t402/* package.json files and update version
find sdks/typescript/packages -name "package.json" -not -path "*/node_modules/*" | while read f; do
  # Update version field
done
```
Also update the monorepo root `sdks/typescript/package.json`.

**Important:** All 27 packages MUST have the same version number.

### Go
No file to update. Version comes from the git tag.

### Python
Update `sdks/python/t402/pyproject.toml`:
```toml
version = "NEW_VERSION"
```

### Java
Update `sdks/java/t402/pom.xml`:
```xml
<version>NEW_VERSION</version>
```

## Step 5: Commit Version Bump

If any files were changed in Step 4:

```bash
git add <changed files>
git commit -m "chore(SDK_NAME): bump version to NEW_VERSION"
```

## Step 6: Create Tag

Generate the correct tag command:

| SDK | Tag Command |
|-----|-------------|
| TypeScript | `git tag v{VERSION}` |
| Go | `git tag go/v{VERSION}` |
| Python | `git tag python/v{VERSION}` |
| Java | `git tag java/v{VERSION}` |

**IMPORTANT:** Do NOT push the tag yet. Show the tag command and ask the user for confirmation first.

## Step 7: Push

After user confirmation, push both the commit and tag:

```bash
git push origin main
git push origin TAG_NAME
```

## Step 8: Verify CI

After pushing, monitor the CI run:

```bash
gh run list --limit 3
```

Provide the user with:
- The GitHub Actions URL to monitor
- Expected publish targets (npm, PyPI, Maven Central, or Go proxy)
- How to verify the published package:

| SDK | Verify Command |
|-----|---------------|
| TypeScript | `npm view @t402/core version` |
| Go | `go list -m github.com/t402-io/t402/sdks/go@v{VERSION}` |
| Python | `pip index versions t402` |
| Java | Check `https://central.sonatype.com/artifact/io.t402/t402/{VERSION}` |

## Step 9: Update Memory

After successful release, remind the user to update:
- `CLAUDE.md` version table (if needed)
- Memory files with new version numbers

## Error Recovery

### Tag Already Exists
```bash
# Check if tag exists
git tag -l "TAG_NAME"
# If yes, ask user before deleting
git tag -d TAG_NAME
git push origin :refs/tags/TAG_NAME
```

### CI Fails After Tag Push
```bash
# Check CI status
gh run list --limit 5
gh run view RUN_ID

# If fixable: fix, commit, delete old tag, create new tag
# If not: ask user whether to delete the tag
```

### Wrong Version Published
- npm: `npm deprecate @t402/core@VERSION "released in error"`
- PyPI: Cannot unpublish; publish a new patch version
- Maven Central: Cannot unpublish; publish a new patch version
- Go: Cannot unpublish; publish a new patch version

## TypeScript Package Matrix (27 packages)

For reference, these are ALL packages that must be published:

**Core (2):** `@t402/core`, `@t402/extensions`

**Mechanisms (10):** `@t402/evm-core`, `@t402/evm`, `@t402/svm`, `@t402/ton`, `@t402/tron`, `@t402/near`, `@t402/aptos`, `@t402/tezos`, `@t402/polkadot`, `@t402/stacks`

**HTTP Server (4):** `@t402/express`, `@t402/next`, `@t402/hono`, `@t402/fastify`

**HTTP Client (2):** `@t402/fetch`, `@t402/axios`

**UI (3):** `@t402/paywall`, `@t402/react`, `@t402/vue`

**WDK (4):** `@t402/wdk`, `@t402/wdk-gasless`, `@t402/wdk-bridge`, `@t402/wdk-multisig`

**Tools (2):** `@t402/mcp`, `@t402/cli`
