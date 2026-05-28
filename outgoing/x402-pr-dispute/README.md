# x402 upstream PR — `dispute` extension

Prepared 2026-05-29 for submission to https://github.com/x402-foundation/x402.

## Files in this directory

| File                      | Purpose                                                          |
|---------------------------|------------------------------------------------------------------|
| `extension-dispute.md`    | The spec file to commit at `specs/extensions/extension-dispute.md` in the x402 fork. |
| `PR-description.md`       | The PR body text (paste into the GitHub PR description form).    |
| `README.md`               | This file — submission instructions.                              |

## What changed from t402's `specs/extensions/dispute.md`

| t402 (this repo)                | x402 upstream draft (this artifact)                      | Reason                                                  |
|---------------------------------|----------------------------------------------------------|---------------------------------------------------------|
| `T402Dispute` EIP-712 domain    | `x402 dispute` EIP-712 domain                            | Match offer-receipt precedent (`"x402 offer"`, `"x402 receipt"`). |
| References to `./offer-and-receipt.md` | References to `./extension-offer-and-receipt.md`         | Match x402 file-naming convention.                       |
| References to `t402` in motivation / status | Replaced with `x402`                                     | Upstream framing.                                       |
| t402-leading "Status: Draft (t402-leading)" front matter | Removed; styled to match `extension-auth-hints.md` modern `##` header layout | Match x402 conventions.                                 |
| t402 SDK references in §SDK Support | Removed (the spec itself is implementation-agnostic); the four t402 reference impls live in the PR description, not the spec | Avoid coupling spec to a specific protocol fork.        |
| Marketing language ("first HTTP-native...") | Removed                                                  | Match x402 spec tone.                                   |
| §Relationship to x402           | New §Relationship to PRs #2493-2495                      | Explicit positioning vs in-flight regulatory work.       |
| §Composability Dispute + ERC-8004 | Removed (not relevant upstream)                          | t402-specific extension.                                 |

The seven-step verification pipeline, four-arbiter trust model, closed-enum reasons / verdicts, and composability matrix with `auth-capture` / `batch-settlement` / `exact` are unchanged.

## Submission steps (when you are ready)

1. **Fork x402** if you have not already:

   ```bash
   gh repo fork x402-foundation/x402 --clone --remote
   ```

2. **Branch off main** in your fork:

   ```bash
   cd x402
   git checkout -b extension/dispute
   ```

3. **Copy the spec file** into the fork's spec directory:

   ```bash
   cp ../t402/outgoing/x402-pr-dispute/extension-dispute.md \
      specs/extensions/extension-dispute.md
   ```

4. **Commit and push**:

   ```bash
   git add specs/extensions/extension-dispute.md
   git commit -m "docs(spec): add dispute extension (draft)

   See PR description for motivation, design summary, and reference
   implementation pointers."
   git push -u origin extension/dispute
   ```

5. **Open the PR** against `x402-foundation/x402:main`:

   ```bash
   gh pr create --repo x402-foundation/x402 \
     --title "docs(spec): add dispute extension (draft)" \
     --body "$(cat ../t402/outgoing/x402-pr-dispute/PR-description.md)"
   ```

   Or use the GitHub UI and paste the contents of `PR-description.md` into the description box.

## Pre-submission checklist

Per x402 `CONTRIBUTING.md` AI-disclosure guidance:

- [x] Spec text personally reviewed against `extension-offer-and-receipt.md` and `extension-auth-hints.md` conventions.
- [x] Reference impl exists in t402 fork; 222 unit tests across 4 SDKs.
- [x] AI-assistance disclosure included in PR body.
- [ ] **You** to verify before clicking submit:
  - [ ] Read `extension-dispute.md` end-to-end one more time.
  - [ ] Confirm the PR title / body match what you intend.
  - [ ] Confirm the GitHub branch points at the right repo.
  - [ ] Decide whether to open it as Draft (recommended for a spec proposal) or Ready for review.

## Recommended: open as Draft first

x402 maintainers may want to align this with PR #2493-2495 timing. Opening as **Draft** signals "ready for discussion, not yet asking for merge" and gives them room to coordinate.

Convert to Ready for Review after the wire-shape questions in `PR-description.md` are answered.

## Risks / what could go sideways

1. **Domain naming**: `"x402 dispute"` collides with PSD2-PR naming convention if they introduce conflicting EIP-712 domains. Watch for maintainer feedback.
2. **PR #2493-2495 timing**: if any of those land first with a different envelope, the spec may need to be re-drafted to align.
3. **Reference impl coupling**: the PR description links the t402 reference impls. Maintainers may prefer the reference impl ship in their own repo. If so, we can prepare a follow-up PR adapting the t402 dispute extension to their TS / Go / Python SDK layout.

## Not done by this artifact

- Smart-contract arbiter (`arbiterScheme: "contract"`) reference implementation. Spec mentions EIP-1271 verification; if maintainers want this in the SDK before merging, we ship a follow-up PR.
- JWS format normative text. Currently reserved.
- Cross-SDK reference impl PR to x402 (after spec merges). Planned but separate.
