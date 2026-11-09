# CLAUDE.md

This file provides guidance when working with documentation and code in `/Users/o2satz/Downloads/PostCircECD`.

## Current state: Mitigated Canonical Specification (`v2.0`) + Build Plan Ready

This directory holds the mitigated canonical specification, review records, and engineering build plan for **PostCircECD ("The Celestial Observatory")**: a research-prototype browser-based adaptive cognitive screener (Three.js + `xrblocks@0.24.0` + deterministic psychometric engine + optional server-proxied Gemini adjunct) aimed at early/atypical cognitive decline in high-functioning adults (PCA, DLB, lvPPA, dysexecutive and amnestic presentations).

Note: `/Users/o2satz/Downloads/CLAUDE.md` (parent directory) describes an unrelated project and does not apply here.

## Files and how they relate

| File | Role |
| :--- | :--- |
| [MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md](MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md) | **Single Canonical Master Specification (`v2.0`).** Mitigates all findings (`F1`–`F19`) from the 2026-11-08 specification review. Use relative links and section numbers when citing. |
| [BUILD_PLAN.md](BUILD_PLAN.md) | **Engineering Build Plan (`F16`).** Defines pinned dependencies (`xrblocks@0.24.0`, `three@0.174.0`, `react@19.0.0`, `vitest@3.0.7`), phased vertical slices (Slice 0–3), the JSON session schema, and per-task acceptance tests. |
| [PROGRESS.md](PROGRESS.md) | **Live Milestone Checklist (`F16`).** Tracks completed spec mitigations and upcoming implementation slices. |
| [MyCogTechSpec.md](MyCogTechSpec.md) | **Source of truth for MyCog / NIH Toolbox psychometrics.** Plain text, numbered sections (1–5), references `[1]`–`[35]`. Cite by section number (e.g., Section 2.2, Section 4.5), not line numbers. |
| [earlycognitivescreeningnovel-approach-amid-current.pdf](earlycognitivescreeningnovel-approach-amid-current.pdf) | Urian et al., *J Alzheimer's Disease* 2026 (Creyos). Source for `Number Ladder`, `Feature Match`, 3-factor Yeo-Johnson + pseudo-inverse descriptive scoring, and general-population age trend ($n=9,350$). Note preliminary AD validation sample size ($14$ AD + $14$ matched controls) and Creyos Inc. conflict-of-interest disclosure (p. 1555). |
| [docs/reviews/2026-11-08-group-response-and-mitigation-log.md](docs/reviews/2026-11-08-group-response-and-mitigation-log.md) | Point-by-point Group response (`Accept` / `Accept in part`) and mitigation verification record for all 19 review findings (`F1`–`F19`). |
| [docs/redesign/2026-11-08-independent-redesign-scaffold.md](docs/redesign/2026-11-08-independent-redesign-scaffold.md) | Independent minimal-scope redesign scaffold. Assessed and harmonized into `v2.0` (adopting the Immutable Event Log, Gate `G0`–`G4` validation backbone, Modality-Discrepancy primary estimand, participant zero-score-anxiety rule, and SHA-256 content-hash protocol lock, while preserving the flagship 3D Celestial Observatory UX and Tier 2 convergent validation battery). |
| `archive/` | Holds archived earlier drafts (`PostCirc ECD Master Specification.md` and `BRAINSTORM_AND_SPEC_SYNTHESIS.md`) for historical provenance. Do not edit archived files. |

## Core Architectural & Scientific Rules (Enforced by `v2.0` Spec)

1. **Intended Use & Watermarking (`F3`):** PostCircECD is strictly a `RESEARCH & EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE`. Default execution is 100% local and deterministic in the browser (no client-exposed Gemini API keys; no external transmission of audio, drawings, or informant responses without explicit server-proxy configuration and consent). All synthetic persona presets and their exports must display a permanent `SIMULATED / SYNTHETIC DEMO — NOT REAL PATIENT DATA` watermark.
2. **Pre-Validation UI Display Rule & Participant View Separation (`F2`):** Every heuristic cutoff is tagged `[PROPOSED / UNVALIDATED — DESIGN TARGET]`. During testing, the participant screen shows **zero numerical scores or error tallies** (preventing test anxiety); the Researcher/Judge Telemetry HUD displays **raw measured metrics with 95% CIs** and `No Norm Available (Prototype)`, never invented Z-scores or clinical probabilities.
3. **Immutable Event Log, Content-Hash Protocol Lock & Gate `G0` (`§5`, `§7`):**
   - Every session records an append-only `trialEventLog` stamped with `prngSeed`, `protocolVersion`, `protocolManifestSha256`, and Gate `G0` hardware frame/audio latency calibration (`F15`).
   - All scoring functions in `src/psychometrics/` are pure functions of the event log. Dynamic Living Research Registry additions (`src/registry/livingEvidenceRegistry.json`) create new version-hashed manifests so historical sessions never mutate silently.
4. **Repaired Statistical Core (`F4`, `F10`, `F11`, `F13`):**
   - **Primary Scientific Estimand:** Perceptually de-confounded modality discrepancy ($S_{\text{auditory}} - S_{\text{visual}}$ conditioned on measured perceptual crowding threshold and motor baseline; `PMID: 42789112`).
   - **Within-condition 3-MAD trimming** for Repeat vs. Switch comparisons; canonical switch cost is $\text{SCER} = 1 - \text{RCS}_{\text{switch}}/\text{RCS}_{\text{repeat}}$ with a 1,000-sample bootstrap 95% CI and minimum valid-trial gates ($\ge 15$ repeat, $\ge 5$ switch).
   - **Raw-RT $\text{CoMAD}$:** Computed within-condition on unsubtracted raw RTs (never after subtracting $RT_{\text{motor}}$).
   - **Chance-Corrected Recognition Gain ($\Delta_{\text{cue}}$):** Replaces the unstable RSI ratio on associative memory.
   - **Standardized Regression-Based Change ($z_{\text{SRB}}$):** Replaces simple-difference RCI to account for regression to the mean ($r_{xx} Z_1$); linear slopes require $K \ge 3$ visits.
   - **Two-Layer Taxonomy:** Separates Layer 1 (7 Observable Syndrome Profiles) from Layer 2 (Clinician Differential Etiological Context), with Holm-Bonferroni family-wise error control across domains.
5. **Dual-Mode 3D Celestial Observatory (`Spatial Spotlight Lock`) & Accessible UX Safeguards (`F7`, `F8`, `F9`):**
   - Preserves the flagship **3D Celestial Observatory** (`OBSERVATORY_3D_SPOTLIGHT_LOCK`: camera velocity locked to $0\text{ rad/s}$, $85\%$ peripheral curtain dimming, and fronto-parallel $0^\circ$ task cards during timed trials) alongside a 1-click **`Plain Static Mode` (`PLAIN_STATIC_2D`)** comparator toggle so 3D aesthetics never confound PCA/DLB psychometrics (`G1` mode-equivalence test).
   - Includes `S0.2` hearing/volume and color-safe pattern checks, raw audio + tap-counter capture for speech tasks, pause/resume support, and the unified **Pass 3 of 4** practice gate (max 1 retry block, auto-skip with exclusion flag on second failure).
