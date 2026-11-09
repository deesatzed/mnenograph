# Independent Redesign Scaffold: Science and UX

**Date:** 2026-11-08
**Status:** Proposal for the Group and the project owner. Nothing here is built or validated. It does not replace `MASTER_CLINICAL_PSYCHOMETRIC_3D_SPEC.md` (v2.0); it is an alternative design to compare against it.
**Basis:** The 2026-11-08 review ([critique](../reviews/2026-11-08-critique-theory-specs-ux.md), findings F1–F19), `MyCogTechSpec.md`, and a read of `BUILD_PLAN.md` and `PROGRESS.md`. I did not re-audit the v2.0 master spec for this document, so statements about v2.0 below come only from `BUILD_PLAN.md`, `PROGRESS.md` and `CLAUDE.md`.

**Plain-language summary.** Build a small research instrument first, not a screener. Its one job is to test whether giving the same memory test in two matched forms (seen vs. heard), alongside a measure of how well the person sees the stimuli, can tell "can't see it well" apart from "can't remember it". Use plain flat screens by default; test the 3D version as a separate experiment. Show raw numbers with error bars and make no diagnostic claims until a study with real participants supports them.

---

## 1. Reframing decisions

| # | Decision | Reason |
| :--- | :--- | :--- |
| R1 | **Research instrument first.** Output is raw metrics with intervals. No syndrome probabilities, no Z-scores, until norms and a known-groups study exist. | F2, F3, F11. v2.0 already adopts the display rule; this makes it the product's definition, not a UI badge. |
| R2 | **One primary question.** Do modality-matched tasks (visual vs. auditory-verbal) plus a measured perceptual threshold separate perceptual failure from true memory or executive failure? | This is the one gap the sources support: MyCog's tasks are visual and fit two factors (`MyCogTechSpec.md`). It needs few tasks and can be tested. |
| R3 | **Plain 2D, touch-first by default.** 3D/XR is an optional, randomized within-person lab arm. | F7. The spec's own premise is that clutter, depth and motion confound the target population. A default that confounds the target cannot also be the instrument. |
| R4 | **Deterministic scoring from an immutable event log.** LLMs are optional, logged adjuncts and never in the scoring path. | F3 (Gemini terms), F10, F16. Any session can be re-scored from raw events. |

## 2. Science scaffold

### 2.1 Estimand
Modality discrepancy: auditory-verbal sequence memory minus visual sequence memory, adjusted for the measured perceptual threshold.

- Pattern expected if perception is the limiting factor: large discrepancy, raised perceptual threshold.
- Pattern expected for a true memory deficit: both memory scores low, small discrepancy.
- These are hypotheses to be tested in the known-groups study, not rules for the instrument.
- Secondary: within-condition variability (CoMAD), sentence repetition. Everything else is exploratory and labelled so.

### 2.2 Tiered task set (replaces roughly 29 tasks)

| Tier | Contents | Rule |
| :--- | :--- | :--- |
| 0. Setup checks | Device and display check, touch/audio latency probe, volume and hearing check, colour-safe check, motor baseline | Recorded as covariates, not scored |
| 1. Core (5) | (1) Perceptual threshold (Navon-style / crowding staircase); (2) Set-shifting with MyCog scoring; (3) Visual associative-sequence memory; (4) Matched auditory-verbal memory, immediate and delayed; (5) Speech (fluency and repetition) with raw audio retained | Always run |
| 2. Conditional probes | Scene description, pareidolia, famous faces, 2D constructional copy, Gerstmann items | Each needs a written hypothesis, a trigger, the confound it rules out, and multiplicity control (Holm-Bonferroni) before it ships |
| 3. Informant | Validated informant instruments | Separate link and login |

### 2.3 Measurement rules
- Scoring functions are pure and deterministic over the event log; property-based tests where inputs allow.
- Every metric reports an interval and a minimum valid-trial count; below the minimum, report "insufficient data", not a number.
- Trial counts come from reliability data collected in G1, not from the source papers (MyCog's 30-trial DCCS is its design, not a derived requirement for this instrument).
- Stimuli come from seeded generators; the seed and parameters are logged.
- Alternate-form equivalence is tested before any longitudinal claim.
- Norms: regression-based, from real data. Change: standardized regression-based (SRB), with at least 3 visits for slopes. Pattern flags are pre-registered; no posteriors.
- Keep from v2.0: within-condition 3-MAD trimming, SCER with bootstrap CI, raw-RT CoMAD, chance-corrected cue gain, z_SRB.

### 2.4 Validation gates
Pass criteria for every gate are written and dated before data collection. Sample sizes come from a power analysis on the variance observed in the preceding gate.

| Gate | Tests | Notes |
| :--- | :--- | :--- |
| G0 | Instrument timing: measured touch, audio and display latency error across a device matrix | Output feeds the minimum detectable effect for every timed metric |
| G1 | Healthy older adults: test-retest, split-half, alternate-form equivalence, usability | Compare usability to MyCog's published S-SUS of 91 |
| G2 | Known groups (PCA, DLB, lvPPA, amnestic, healthy) diagnosed by published criteria (Crutch 2017, McKeith 2017, Gorno-Tempini 2011) by specialists blind to the tool | STARD reporting; sensitivity and specificity with intervals; prevalence-adjusted PPV; pre-registered |
| G3 | Regression-based norms | Needs the sample from a power analysis |
| G4 | Longitudinal change | Separate study |

Ethics approval precedes any human data. Participant data stay on the owner's machine unless the owner approves a specific destination.

## 3. UX scaffold

**Principles.** Plain by default; one task per screen; failure is recorded as data, not shown as failure; participants see no scores; the interface must not require the function being tested.

**Modes.** Plain (default). Immersive 3D (research arm): randomized within-person comparison, healthy volunteers first, to measure whether 3D adds signal or noise.

**Flow.** Consent → setup checks → Session A (perception, shifting, visual memory) → break → Session B (auditory memory, speech, delayed recall). Pause and resume anywhere. Inactivity handling follows MyCog 2.0 (pop-up at 1 minute, session ends after a further interval).

**Practice rule.** Pass 3 of 4, one retry block, then skip with an exclusion flag (same as v2.0).

**Accessibility.** Scalable type; high contrast; every instruction available as read-aloud and text; large, tremor-tolerant targets; speech recognition validated on impaired speech before it is used for scoring (the Whisper post-stroke aphasia paper reported 38.5% vs 10.3% word error rate); raw audio kept.

**Researcher view.** Raw metrics, intervals, QC flags, trial replay. Persona/synthetic demos live in a separate build with a permanent watermark.

**UX evaluation.** Think-aloud sessions with older adults and care partners; drop-out and error logs.

## 4. Build scaffold

```
postcircecd/
  study/          protocol, statistical analysis plan, pre-registration, consent, data-management plan
  docs/           adr/, validation/, reviews/, redesign/
  packages/
    event-log/    versioned JSONL schema, timing probe
    scoring/      pure functions, property-based tests
    tasks/<name>/ spec, seeded generator, scoring, tests
    capture/      audio, pointer/touch, device probe
    analysis/     norming, change scores, QC (Python)
    reporting/    researcher view
    xr-lab/       optional XR Blocks arm, pinned version
  data/           gitignored; participant data never leave this machine
```

- **Event log first.** Immutable and versioned: seed, device, timestamps, raw responses. Every metric must be re-computable from it.
- **Order:** (1) timing probe and event log; (2) set-shifting end to end; (3) matched memory pair; (4) perceptual threshold; (5) speech capture; (6) reporting.
- **Acceptance:** each slice is accepted on real runs with consented or owner-supplied timing data. Hand-worked scoring fixtures (for example from `MyCogTechSpec.md` formulas) are synthetic under the owner's rule; they need the owner's approval, a visible label, and an entry on the open-items list until real runs replace them.
- **Gemini:** off by default; server-proxy only; model version chosen by the owner after a live lookup; logged; never in the scoring path.

## 5. Comparison with v2.0 (from `BUILD_PLAN.md` / `PROGRESS.md` only)

| Topic | v2.0 build plan | This scaffold |
| :--- | :--- | :--- |
| Default presentation | Slice 1 builds the 3D observatory with a "Plain Static Mode" comparator toggle. `CLAUDE.md` calls Plain Static "mandatory"; the plan frames it as a comparator. These two statements should be reconciled. | Plain is the default; 3D is a randomized arm |
| Task count | Slices 0–2 cover about 17 sub-tasks across 6 stations | 5 core tasks; the rest conditional |
| Output claim | Raw telemetry only until norms (matches R1) | Same |
| Router | Slice 2 builds a deterministic two-layer router with Holm-Bonferroni | Deferred until G2 produces data to fit and validate it |
| Persona simulator | Slice 3, watermarked | Separate demo build, after G1 |
| Living registry | Slice 0C: runtime hot-plug of protocol parameters, norms and citations | Not included. Runtime-editable norms and task parameters risk silently changing results between sessions; versioned, pre-registered changes are safer. |
| Validation | Section 5 protocol exists in the spec; no gates in the build plan | Gates G0–G4 are the backbone of the plan |
| Acceptance tests | Vitest suites incl. "z_SRB matching Table §4.2" | Same idea, but fixtures must be labelled synthetic and replaced with real-run checks |

**Not verified by me:** that `PROGRESS.md`'s "COMPLETED" mitigations match the v2.0 text; that the PMIDs cited in `BUILD_PLAN.md` Task 3C (42789112, 42545687) exist and say what is claimed.

## 6. Traceability: review findings → scaffold

| Finding | Addressed by |
| :--- | :--- |
| F1 Urian overstated | R1; G2 reports own sensitivity/specificity with intervals; Urian cited only for its actual 14+14 sample |
| F2 No norms but Z-scores shown | R1; G3; raw metrics until then |
| F3 Privacy, consent, intended use | Research-only use; ethics before data; local data; Gemini off by default |
| F4 Longitudinal alert fails | SRB change; G4; K ≥ 3 visits |
| F5 "Focal capture" unmeasurable | Cut. Tier 2 scene probe needs pointing control and a stated hypothesis |
| F6 XR Blocks identifiers wrong | `xr-lab` pinned; probe before use |
| F7 3D confounds target users | R3 |
| F8 Hearing, colour, language | Tier 0 checks; matched modalities (core to R2) |
| F9 Session length, practice rules | 5 core tasks; one practice rule; pause/resume |
| F10 Extension-metric statistics | Within-condition trimming, intervals, minimum counts |
| F11 Router fires on healthy people | Router deferred to G2; Holm-Bonferroni on any retained flags |
| F12 Famous-face circular exclusion | Tier 2, conditional, needs written trigger and non-circular exclusion rule |
| F13 "Zero practice effect" | Alternate-form equivalence test in G1 |
| F14 Document control | One spec, one ADR log under `docs/adr/` |
| F15 Device-latency rationale | G0 measures it instead of citing it |
| F16 No build plan or acceptance | Section 4; event log; acceptance on real runs |
| F17–F19 Source wording | Carry v2.0's corrected wording forward |

## 7. Keep / cut / defer

- **Keep:** convergent validation; de-confounding by modality; MyCog scoring primitives; informant lens; longitudinal tracking as its own study.
- **Defer or cut:** 3D as default; the Bayesian posterior HUD; the 6-domain radar until factors are estimated from own data; Gemini scene scoring; EHR export; the runtime-editable registry; most of the ~29 tasks (moved to Tier 2).

## 8. Decisions needed from the owner (default in brackets)

1. Intended use: [research instrument].
2. Primary question: [modality de-confounding].
3. Platform: [tablet-first web, 2D tasks; XR as lab arm].
4. Stack: [TypeScript web app, Python analysis].
5. Task licensing: [original tasks modelled on published paradigms; no copies of Creyos or NIH Toolbox items].
6. Participant and ethics access: owner input only.
7. Synthetic scoring fixtures: [approve, labelled, removal tracked].
8. Gemini model ID: only if the Gemini adjunct is kept; the owner picks after a live lookup.
