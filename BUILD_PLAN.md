# PostCircECD: Engineering Build Plan, Data Schema & Acceptance Tests (`F16`)

**Related Specification:** [MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md](MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md) (`v2.0`)
**Progress Tracker:** [PROGRESS.md](PROGRESS.md)

---

## 1. Pinned Technology Stack & Version Policy (`F6`, `F16`)

All package versions must be pinned explicitly in `package.json` (`save-exact=true`) prior to implementation:
* **Runtime & Bundler:** Node.js `>=20.x`, `vite@6.2.0`, `typescript@5.8.2`
* **UI & Telemetry HUD:** `react@19.0.0`, `react-dom@19.0.0`, `tailwindcss@4.0.9`, `lucide-react@0.477.0`
* **3D & Spatial Engine:** `three@0.186.0`, `@types/three@0.186.0`, `xrblocks@0.24.0` *(peer-dependency verified via Step 0 probe in `docs/xrblocks-probe.txt`)*
* **Unit & Psychometric Verification Testing:** `vitest@3.0.7`

---

## 2. Phased Build Order & Minimum Viable Vertical Slice (`F16`)

Rather than attempting to build all 17 sub-tasks simultaneously, implementation proceeds in four gated vertical slices:

### Slice 0: `xrblocks@0.24.0` API Probe & Deterministic Psychometric Core (Foundation)
1. **Task 0A — Live `xrblocks@0.24.0` Probe (`F6`):**
   - Initialize `package.json`, install `three@0.186.0` and `xrblocks@0.24.0`, and run a non-mocked probe script that inspects the exported symbols of `xrblocks` (`xb.Script`, `UICard`, `UIPanel`, `xb.context` / `xb.core.context`, `SceneVisibilityOptions`, `SceneSetOfMarkOptions`) and writes the verified output to `docs/xrblocks-probe.txt`.
2. **Task 0B — Immutable Event Log (`src/eventLog/`) & Pure TypeScript Psychometric Core (`src/psychometrics/`):**
   - Implement an append-only, deterministic trial event log (`TrialEvent[]`) recording the PRNG seed, `protocolManifestSha256`, Gate `G0` hardware frame/audio latency calibration, and raw per-trial timestamps/responses, plus 100% deterministic scoring functions with zero UI or LLM dependencies:
     - `computeGateG0TimingCalibration(frameDeltasMs, pointerDeltasMs, audioLatencyMs)` (bench timing verification & minimum detectable RT effect; [MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md](MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md) §5.2)
     - `computeMyCogRCS(trials)` (pooled 3-MAD trimming + rate-correct score; §2.2.1)
     - `computeWithinConditionSwitchMetrics(trials, bootstrapIterations)` (within-condition 3-MAD trimming, $\text{SCER} = 1 - \text{RCS}_{\text{switch}}/\text{RCS}_{\text{repeat}}$, 1000-sample stratified bootstrap 95% CI, minimum trial gates $\ge 15$ repeat / $\ge 5$ switch, and raw-RT $\text{CoMAD}_{\text{repeat}}$; §2.2.2–2.2.4)
     - `computeQuadrantKruskalWallis(pointingTrials)` (36-target baseline $RT_{\text{motor}}$, path efficiency $\eta_{\text{path}}$, and Kruskal-Wallis $H$ & $p$-value across $Q_1..Q_4$; §2.1)
     - `computeSequenceAndAssociativeScores(placements, freeLetters, cuedMatches, auditoryPlacements)` ($S_{\text{exact}}$, $S_{\text{adj}}$, $p_{\text{free}}$, chance-corrected $p_{\text{cued, corr}}$, $\Delta_{\text{cue}}$ with Wilson 95% CIs, and the Primary Modality Discrepancy Estimand $S_{\text{auditory}} - S_{\text{visual}}$; §2.4, §5.2)
     - `computeSRBChangeScore(z1, z2, rxx, practiceOffset)` (Standardized Regression-Based change $z_{\text{SRB}}$ with regression-to-the-mean term $r_{xx} Z_1$; §4.2)
3. **Task 0C — Version-Locked Dynamic Living Research & Protocol Registry (`src/registry/livingEvidenceRegistry.json` + `scripts/sync-science-evidence.sh`):**
   - Declarative JSON registry storing all station task parameters, convergent-validation rules, normative priors, and verified primary literature records (PMIDs, PMCIDs, DOIs, NCT IDs from the Google Science `literature-search-europepmc` and `clinical-trials-database` skills; §7). Every manifest is stamped with an immutable `protocolVersion` and `protocolManifestSha256` hash at session start so adding new versioned research modules or re-scoring an event log in the HUD never silently alters historical sessions.

### Slice 1: End-to-End MVP Vertical Slice (3D Celestial Observatory Shell + Sensory/Motor Baseline `S0` + Executive Switchboard `S3.1` + Raw Telemetry HUD)
1. **Task 1A — 3D Celestial Observatory (`Spatial Spotlight Lock`), Plain Static Mode Comparator, Intended-Use Banner & Unified 4-Trial Practice Gate (`F3`, `F7`, `F9`):**
   - Renders the flagship **3D Celestial Observatory** (Three.js / `xrblocks` stations) with automatic **Spatial Spotlight Lock** (camera velocity locked to $0\text{ rad/s}$, $85\%$ peripheral curtain dimming, and $0^\circ$ fronto-parallel task cards during timed trials), paired with a persistent top-bar **`Plain Static Mode (Zero Motion)`** comparator toggle, the `RESEARCH & EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE` banner, and the reusable 4-trial practice gate ($\ge 3/4$ to pass, max 1 retry block, auto-skip with exclusion log on second failure, 60s/120s timeout).
2. **Task 1B — Station `S0` (`S0.1` Intake, `S0.2` Hearing/Color Check, `S0.3` 36-Target Pointing Baseline):**
   - Real $60\text{ Hz}$ pointer trajectory and high-resolution `performance.now()` timestamp capture.
3. **Task 1C — Station `S3.1` (30-Trial Mixed Shape/Pattern-Safe DCCS Switchboard):**
   - Full 23-repeat / 7-switch pseudorandom trial block using Okabe-Ito color-safe + redundant interior pattern stimuli (`F8`).
4. **Task 1D — Raw Telemetry HUD (`F2`, `F3`):**
   - Displays live measured raw metrics ($\text{RCS}_{\text{pooled}}$, $\text{SCER}$ + 95% CI, $\text{CoMAD}_{\text{repeat}}$, $RT_{\text{motor}}$, Kruskal-Wallis $H$) with the badge `Normative Status: Raw Telemetry Only (Prototype)`.

### Slice 2: Visuoperceptual (`S1`, `S2`) & Memory/Language/Famous-Photo Cascade (`S4`, `S5`) + Convergent Router
1. **Task 2A — Station `S1.1` (Navon Global/Local Series), `S1.2` (Deterministic Diorama Element Coverage + Point-and-Link Control), and `S1.3` (`Feature Match` 90s Array Comparison).**
2. **Task 2B — Station `S2.1` (Noise Pareidolia Count per Mamiya et al., 2016) & `S2.2` (Foreshortened Silhouette Rotation).**
3. **Task 2C — Station `S3.2` (Cube/Clock Construction), `S3.3` (`Number Ladder` Spatial Span), & `S3.4` (Gerstmann 4-Component Probe).**
4. **Task 2D — Station `S4.1` (Fluency with Tap-Timestamp + Raw Audio Buffer) & `S4.2` (Echo Relay Sentence Repetition).**
5. **Task 2E — Station `S5.1` (12-Item Sequence + Face-Name Matching), `S5.2` (Archival Photograph Famous-Person 3-Step Cascade), & `S5.3` (Auditory-Verbal Sequence Control).**
6. **Task 2F — Deterministic Convergent Router (`F11`):**
   - Implements the two-layer Syndrome Profile classifier (Layer 1: Profiles 0–6; Layer 2: Literature Differential Context) and logs every routing rule in the HUD.

### Slice 3: Watermarked Synthetic Persona Simulator & Multi-Visit `z_SRB` Explorer (`F3`, `F4`, `F13`)
1. **Task 3A — Watermarked Synthetic Persona Presets (`F3`):**
   - Loads synthetic demo trajectories (*Dorsal PCA Profile*, *Pareidolia/Fluctuation Profile*, *Logopenic Profile*, *High-Baseline Multi-Visit SRB Decline*) with a mandatory, non-removable **`SIMULATED / SYNTHETIC DEMO — NOT REAL PATIENT DATA`** banner on the viewport, HUD, and any exported JSON/print view.
2. **Task 3B — Multi-Visit SRB Change & Meso-Scale Learning Burst Inspector (`F4`, `F13`):**
   - Interactive calculator and chart comparing simple-difference RCI vs. regression-based $z_{\text{SRB}}$ across reliability levels $r_{xx}$ and $K \ge 3$ visits.
3. **Task 3C — In-App "Living Evidence & Dynamic Protocol Manager" HUD Tab (`§7`):**
   - Displays all linked Europe PMC / ClinicalTrials.gov references (`PMID`, `PMCID`, `DOI`, `NCTId`), allows toggling newly published research modules (e.g., 2026 LBD Dorsal+Ventral Equivalence Rule `PMID: 42789112`, 2026 PPA Speech Profile `PMID: 42545687`) or importing new JSON protocol/normative cards dynamically at runtime.

---

## 3. Canonical JSON Session Data Schema (`F16`)

Every session conforms to the following deterministic TypeScript/JSON schema (`src/types/sessionSchema.ts`):

```json
{
  "schemaVersion": "2.0.0",
  "protocolVersion": "2.0.0-living-2026-11-08",
  "protocolManifestSha256": "sha256-hex-digest",
  "sessionId": "anon-uuid-v4",
  "prngSeed": 20261108,
  "isSimulatedPreset": false,
  "simulatedWatermark": "NONE | SIMULATED / SYNTHETIC DEMO — NOT REAL PATIENT DATA",
  "intendedUseNotice": "RESEARCH & EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE",
  "presentationMode": "OBSERVATORY_3D_SPOTLIGHT_LOCK | PLAIN_STATIC_2D",
  "motionOff": true,
  "startedAtIso": "2026-11-08T18:00:00.000Z",
  "gateG0TimingCalibration": {
    "frameIntervalMedianMs": 16.67,
    "frameIntervalIqrMs": 0.42,
    "pointerSampleHz": 60.0,
    "audioOutputLatencyMs": 18.5,
    "minimumDetectableEffectMs": 24.0
  },
  "sensoryChecks": {
    "hearingCheckPassed": true,
    "selectedVolumeGain": 0.8,
    "colorPatternCheckPassed": true
  },
  "practiceGates": {
    "S3.1": { "block1Correct": 4, "block2Correct": null, "passed": true, "excluded": false }
  },
  "trialEventLog": [],
  "stationTelemetry": {
    "S0.3": {
      "rtMotorMedianMs": 342.5,
      "quadrantKruskalWallisH": 2.14,
      "quadrantKruskalWallisP": 0.544,
      "medianPathEfficiency": 0.91,
      "measuredDurationSec": 43.2
    },
    "S3.1": {
      "totalTrials": 30,
      "validPooledCount": 29,
      "rcsPooledPerSec": 1.18,
      "validRepeatCount": 22,
      "validSwitchCount": 7,
      "rcsRepeatPerSec": 1.26,
      "rcsSwitchPerSec": 0.94,
      "scer": 0.254,
      "scerBootstrap95Ci": [0.142, 0.368],
      "comadRepeatRaw": 0.162,
      "measuredDurationSec": 112.4
    }
  },
  "routingLog": [],
  "normativeStatus": "UNNORMED_RAW_TELEMETRY_ONLY"
}
```

---

## 4. Per-Task Acceptance Criteria & Verification Commands (`F16`)

| Milestone / Task | Verification Command | Pass / Definition of Done Criterion |
| :--- | :--- | :--- |
| **Doc Control (`F14`)** | `ls *.md && grep -c 'file:///' MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md` | Single canonical master spec in root; `0` occurrences of `file:///`. |
| **Threshold Tagging (`F2`)** | `grep -c 'PROPOSED / UNVALIDATED' MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md` | $\ge 6$ explicit `PROPOSED / UNVALIDATED` tags covering all heuristic cutoffs. |
| **Step 0 `xrblocks` Probe (`F6`)** | `node scripts/probe-xrblocks.mjs > docs/xrblocks-probe.txt` | Logs real exported classes/keys from `xrblocks@0.24.0` without mocks; exit code `0`. |
| **Psychometric Unit Suite (`F4`, `F10`)** | `npx vitest run src/psychometrics/__tests__/psychometrics.test.ts` | 100% pass on: (1) MyCog 3-MAD & RCS, (2) within-condition trimming vs. pooled trimming, (3) raw-RT $\text{CoMAD}$ invariance to $RT_{\text{motor}}$, (4) chance-corrected $\Delta_{\text{cue}}$ with zero division-by-zero at $S_{\text{letter}}=L$, (5) $z_{\text{SRB}}$ matching Table §4.2 to 3 decimal places. |
| **UX & Accessibility (`F3`, `F7`, `F8`, `F9`)** | `npx vitest run src/components/__tests__/ux-safeguards.test.tsx` | Verifies: (1) `Plain Static Mode` disables camera flight, (2) 4-trial practice gate enforces $\ge 3/4$ rule and auto-skips after 2 failed blocks, (3) `SIMULATED` watermark renders on all persona presets and exports. |
| **Production Build** | `npm run build` | Clean TypeScript (`tsc --noEmit`) and Vite production bundle with `0` errors. |
