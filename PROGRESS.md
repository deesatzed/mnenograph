# PostCircECD: Project Progress & Mitigation Checklist (`F16`)

**Last Updated:** 2026-11-08
**Canonical Master Spec:** [MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md](MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md) (`v2.0`)
**Build Plan:** [BUILD_PLAN.md](BUILD_PLAN.md)
**Review Response Record:** [docs/reviews/2026-11-08-group-response-and-mitigation-log.md](docs/reviews/2026-11-08-group-response-and-mitigation-log.md)

---

## Phase 1: Specification Audit & Mitigations (`F1`–`F19`) — COMPLETED

- [x] **Step 1 — Canonical Master Spec & Document Control (`F14`):**
  - Designated `MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md` (`v2.0`) as the single canonical specification.
  - Moved `PostCirc ECD Master Specification.md` and `BRAINSTORM_AND_SPEC_SYNTHESIS.md` into `archive/`.
  - Standardized all station/sub-task IDs (`S0.1`–`S5.3`), unified the switch-cost formula ($\text{SCER} = 1 - \text{RCS}_{\text{switch}}/\text{RCS}_{\text{repeat}}$), unified calibration duration ($45\text{ s}$, 36 targets), and replaced all `file:///` links and line numbers with relative links and section numbers.
- [x] **Step 2 — Evidence & Source Corrections (`F1`, `F15`, `F17`–`F19`):**
  - Corrected Urian et al. (2026) validation figures to the $14$ AD + $14$ matched control sample with Wilson 95% CIs ($78\text{–}100\%$ sensitivity, $60\text{–}96\%$ specificity; 1 patient with MMSE $>24$), distinct from the $n=2,859$ + $n=1,856$ training sets.
  - Removed the PCA/lvPPA age-of-onset attribution from Urian et al. Fig. 1 ($\text{LR}(5)=652.50$) and cited Crutch et al. (2017) and Gorno-Tempini et al. (2011).
  - Clarified that Urian et al.'s Yeo-Johnson + pseudo-inverse factor matrix is descriptive over 3 domains (STM, reasoning, verbal) and that PostCircECD's 6-domain matrix requires its own empirical validation cohort.
  - Rewrote the `S0.3` device-latency rationale to match [MyCogTechSpec.md](MyCogTechSpec.md) §4.5 accurately.
  - Changed PCA episodic memory wording to *"initially relatively preserved"* (Crutch et al., 2017), corrected Creyos archive numbers ($>14\text{M}$ assessments over 15 years; $\sim 85,000$ healthy normative cohort), added the Creyos Inc. conflict-of-interest note, and reframed MyCog Mobile's early stopping as statistically efficient for binary MCI triage.
- [x] **Step 3 — Threshold Labelling & Norming/Validation Protocol (`F2`):**
  - Tagged all heuristic cutoffs as `[PROPOSED / UNVALIDATED — DESIGN TARGET]`.
  - Added Section 5 (Norming, Form-Equating, and Clinical Validation Protocol) and enforced the Pre-Validation UI Display Rule (raw metrics + 95% CIs and `No Norm Available (Prototype)` badge in live mode).
- [x] **Step 4 — Intended Use, Privacy, Consent & Regulatory Boundaries (`F3`):**
  - Added Section 6 establishing research-only intended use, 100% local deterministic execution by default (per March 23, 2026 Gemini API Terms and January 29, 2026 FDA CDS guidance), server-side key requirement for any optional AI research mode, and mandatory `SIMULATED / SYNTHETIC DEMO — NOT REAL PATIENT DATA` watermarks on all persona presets and exports.
- [x] **Step 5 — Statistical Repairs (`F4`, `F10`, `F11`, `F13`):**
  - Replaced simple-difference RCI with the **Standardized Regression-Based (SRB) Change Score ($z_{\text{SRB}}$)** (Hammers et al., 2020) including the regression-to-the-mean term $r_{xx} Z_1$ and verified arithmetic table across $r_{xx} \in [0.49, 0.92]$.
  - Enforced within-condition 3-MAD outlier trimming, minimum trial gates + bootstrap 95% CI for $\text{SCER}$, unsubtracted raw-RT $\text{CoMAD}$, 36-target Kruskal-Wallis test for `S0.3` (removing desktop mouse "optic ataxia" claims), chance-corrected recognition gain $\Delta_{\text{cue}}$ (replacing unstable RSI), and Mamiya et al. (2016) pareidolia response counts.
  - Split router classes into Layer 1 (7 Observable Syndrome Profiles) and Layer 2 (Clinician Differential Etiological Context) with Holm-Bonferroni family-wise error control.
  - Removed the $\Delta_{\text{practice}} \to 0$ claim and reconciled Meso-Scale 5-day burst learning vs. Macro-Scale IRT-equated alternate forms.
- [x] **Step 6 — Famous-Face Cascade Repair (`F12`):**
  - Standardized on archival photographs, unified the 3-step sequence in `S5.2`, and removed the circular self-reported unfamiliarity exclusion.
- [x] **Step 7 — `xrblocks@0.24.0` API Alignment (`F5`, `F6`):**
  - Replaced `serializeContext`, `uiblocks`, and `Panel` with `xb.Script`, `UICard`, `UIPanel`, `VisibleObjectsBuilder`, and `SetOfMarkBuilder`.
  - Reframed `S1.2` as deterministic **Spoken & Pointed Scene Element Coverage** with a non-verbal pointing control.
- [x] **Step 8 — UX & Accessibility Safeguards (`F7`, `F8`, `F9`):**
  - Mandated `Plain Static Mode` (`motionOff = true`, fronto-parallel $0^\circ$ cards, zero camera flight during tasks), added `S0.2` hearing/volume and color-safe pattern checks, preserved raw audio + manual tap counters for speech tasks, unified the `Pass 3 of 4` practice gate (max 1 retry block, auto-skip on failure), and added the per-task time budget table.
- [x] **Step 9 — Build Plan & Progress Tracking (`F16`):**
  - Created [BUILD_PLAN.md](BUILD_PLAN.md) and [PROGRESS.md](PROGRESS.md).
- [x] **Step 10 — Independent Redesign Scaffold Assessment & Harmonization ([docs/redesign/2026-11-08-independent-redesign-scaffold.md](docs/redesign/2026-11-08-independent-redesign-scaffold.md)):**
  - Assessed the independent redesign scaffold and integrated its high-value scientific/engineering additions into `v2.0`:
    1. **Immutable Re-Scorable Event Log (`src/eventLog/`)** with PRNG seed and pure scoring functions (`src/psychometrics/`).
    2. **Validation Gate Backbone (`G0`–`G4`),** including Gate `G0` hardware frame-interval/pointer/audio latency verification (`F15`).
    3. **Primary Scientific Estimand Definition:** Perceptually de-confounded modality discrepancy ($S_{\text{auditory}} - S_{\text{visual}}$ conditioned on measured visual crowding/integration threshold and motor baseline; `PMID: 42789112`).
    4. **Participant Zero-Score-Anxiety View** (no numerical scores or error tallies shown on the participant screen during testing) + pause/resume support.
    5. **SHA-256 Content-Hash Protocol Lock (`protocolManifestSha256`)** on the Dynamic Living Research Registry so runtime research additions never silently mutate historical sessions.
    6. **Preserved Flagship Vision:** Retained the **3D Celestial Observatory (`Spatial Spotlight Lock`)** alongside `Plain Static Mode` (`G1` mode-equivalence test), the **Tier 2 Convergent Validation Battery** (Pareidolia, Famous-Face 3-Step Cascade, Cube/Clock, Gerstmann, Diorama), and the **Living Research Registry**.

---

## Phase 2: Application Implementation Milestones — COMPLETED (`v2.0`)

- [x] **Slice 0A:** Initialized project (`package.json`) with pinned dependencies (`three@0.186.0`, `xrblocks@0.24.0`, `react@19.0.0`, `vitest@3.0.7`) and ran the non-mocked `xrblocks@0.24.0` probe (`docs/xrblocks-probe.txt` — 302 verified symbols).
- [x] **Slice 0B & 0C:** Implemented and passed all Vitest unit tests (`src/psychometrics/__tests__/psychometrics.test.ts`) for `src/psychometrics/psychometrics.ts` and `src/eventLog/trialEventLog.ts` + created the SHA-256 content-hash–locked **Dynamic Living Research & Protocol Registry (`src/registry/livingEvidenceRegistry.json`)** backed by the Google Science Europe PMC / ClinicalTrials.gov citations (§7).
- [x] **Slice 1:** Built End-to-End MVP Vertical Slice (**3D Celestial Observatory with Spatial Spotlight Lock** + `Plain Static Mode` comparator in `src/components/CelestialObservatory3D.tsx`, Unified 4-Trial Practice Gate in `src/components/PracticeGateAndModals.tsx`, Station `S0`, Station `S3.1` 30-trial mixed DCCS switchboard, and Raw Telemetry HUD).
- [x] **Slice 2:** Implemented interactive Stations `S1`, `S2`, `S3`, `S4`, `S5` (`src/components/StationTasksInteractive.tsx`) and the deterministic Two-Layer Convergent Router with Holm-Bonferroni FWER control.
- [x] **Slice 3:** Implemented the `SIMULATED`-watermarked Synthetic Persona Simulator (`src/presets/syntheticPersonas.ts`), Multi-Visit `z_SRB` Longitudinal Inspector, Dual-Manifest SHA-256 Delta Comparison, and In-App **Living Evidence & Dynamic Protocol Manager** tab (`src/components/ResearcherTelemetryHud.tsx`). Verified via `src/components/__tests__/ux-safeguards.test.tsx` and `npm run build`.
