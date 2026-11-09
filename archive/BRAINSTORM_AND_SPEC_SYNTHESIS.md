# PostCircECD: AI-Driven 3D Adaptive Neuro-Cognitive Screening
## Brainstorm, Clinical Architecture & Synthesis with `MyCogTechSpec.md`

---

## Part 1: Clinical & Scientific Problem Statement

### Target Conditions
1. **Visual Recognition (Visuoperceptual Deficits):** Ventral stream ("what" pathway: apperceptive and associative visual agnosias, prosopagnosia, degraded/overlapping object recognition).
2. **Posterior Cortical Atrophy (PCA):** Dorsal stream ("where/how" pathway: Bálint syndrome — *simultanagnosia, optic ataxia, ocular apraxia*; Gerstmann syndrome — *acalculia, agraphia, finger agnosia, left-right confusion*; visual crowding; dressing/constructional apraxia).
3. **Other Atypical Alzheimer Variants:**
   - **Logopenic variant Primary Progressive Aphasia (lvPPA):** Impaired phonological working memory buffer (length-dependent sentence repetition deficit, word-finding pauses, phonological paraphasias with spared single-word comprehension).
   - **Frontal / Dysexecutive AD:** Severe working memory manipulation and set-shifting deficits out of proportion to amnesia.
4. **Dementia with Lewy Bodies (DLB):** Visuoperceptual pareidolias (seeing faces/shapes in noise), marked moment-to-moment cognitive/attentional fluctuations (high Intra-Individual Variability in reaction time), visuoconstructional impairment, retrieval-type memory deficit (rescued by cues), and prodromal markers (REM sleep behavior disorder, anosmia).
5. **Early Cognitive Decline in High-Functioning Individuals:** High cognitive/verbal reserve masks deficits on global screens (e.g., scoring 27–29/30 on the MoCA). Detection requires:
   - Domain-specific subscore discrepancy analysis rather than a single global cutoff.
   - Process/kinematic digital biomarkers (planning latency, switch cost, fluency decay curves).
   - High-ceiling associative binding (Face-Name-Attribute, Object-Location) and multi-trial learning slopes.
   - Spouse/Informant ecological discrepancy (AD8 / IQCODE + Posterior/DLB real-world items).

---

## Part 2: How `MyCogTechSpec.md` Helps — Strengths to Adopt & Critical Gaps We Solve

Reviewing [MyCogTechSpec.md](file:///Users/o2satz/Downloads/PostCircECD/MyCogTechSpec.md) provides three major advantages for our Google Science submission: **(1) gold-standard psychometric math we can adopt directly**, **(2) human-centered older-adult UX rules**, and **(3) documented scientific blind spots in current NIH/DetectCID tools that our 3D AI system directly solves.**

### A. Validated Psychometric Primitives to Adopt from MyCog / NIH Toolbox
1. **Rate-Correct Score (RCS) & MAD Outlier Trimming (from MyCog DCCS / MySorting):**
   - Rather than the NIH Toolbox two-vector score (which has an artificial discontinuity at 80% accuracy), MyCog uses **Rate-Correct Score = $\text{Correct Trials} / \text{Total Reaction Time}$**.
   - **Outlier trimming:** Exclude trials $<100\text{ ms}$, $>9\text{ s}$, or $>3\text{ MAD}$ (Median Absolute Deviations) from the participant's median RT.
   - **Our Extension:** In addition to overall RCS across a 30-trial mixed block (23 repeat, 7 switch), we compute:
     - **Switch-Cost Ratio:** $\text{RCS}_{\text{repeat}} / \text{RCS}_{\text{switch}}$ (sensitive to subtle executive decline in high-functioning adults).
     - **Attentional Fluctuation Index:** $\text{MAD}(\text{RT}) / \text{Median}(\text{RT})$ across the session (specifically targeting **DLB cognitive fluctuations**).
2. **Episodic Sequence & Dual Scoring (from NIH Toolbox PSM & MyCog MyPictures):**
   - Computing *both* **Exact-Position Score** (MyCog 12-tile rule) and **Adjacent-Pair Score** (NIH Toolbox IRT rule) distinguishes whether a user forgot the *anchor boundaries* vs. preserved *local temporal chaining*.
3. **Associative Memory & Preclinical $A^+T^+$ Sensitivity (from MyFaces / FNAME / BRANCH):**
   - Combining **First-Letter Recall** (free phonological-orthographic retrieval) and **Name/Attribute Matching** (cued associative recognition) directly parallels FNAME (linked to frontal PiB amyloid burden, $R^2=0.29$) and BRANCH multi-day associative learning curves (sensitive to $A^+T^+$ preclinical AD).
4. **Cross-Modal Working Memory Span (from MySequences / NIHTB List Sorting):**
   - Dual-modality (visual + auditory) presentation requiring mental reordering by a physical dimension (e.g., 3D object size/mass) across 1-category and 2-category blocks, terminating or adapting after 2 failures at a span level.
5. **Human-Centered Older-Adult UX (from MyCog 2.0, S-SUS = 91):**
   - **No passive instruction videos:** Use concise interactive instructions followed by **mandatory gated practice trials with immediate feedback** (must pass 3/4 or 4/5 before live psychometric capture begins).
   - **Demographic & Device Normalization:** Continuous regression-based adjustment for age, education, and **measured device input latency**.

### B. The 5 Critical Gaps in MyCog / Mobile Toolbox That Make Our Project Special
`MyCogTechSpec.md` exposes why current primary-care digital screeners fail our target populations:
1. **The Visual Confound Blind Spot (No Visuoperceptual or Posterior Domain):**
   - MyCog and MyCog Mobile only model a **two-factor structure (Episodic Memory + Executive Function)**. Every single task (PSM, DCCS, MyFaces) relies heavily on visual perception!
   - *Clinical Danger:* A patient with **Posterior Cortical Atrophy (PCA)** or **DLB** who fails MyPictures or MySorting because of **simultanagnosia, visual crowding, or optic ataxia** will be misclassified as having primary amnesia or dysexecutive MCI—or vice versa!
   - *Our Solution:* Explicitly add a **Visuoperceptual & Posterior Parieto-Occipital Factor** (Dorsal Stream + Ventral Stream + Pareidolia) and use AI to **de-confound visual perception from memory/executive scores**.
2. **Shallow "Adaptive" Testing (Skip-Only vs. Convergent Validation):**
   - As noted in `MyCogTechSpec.md` (Section 4.2, ref [8]), MyCog Mobile's only adaptive feature is *early stopping* (skipping the final task when earlier tasks classify MCI).
   - *Our Solution:* **Closed-Loop Convergent Validation (Multi-Trait Multi-Method AI Routing).** When a deficit is detected in Task A, the AI spawns an *orthogonal 3D task (Task A')* that tests the same neural circuit via a different modality/mechanic to verify the finding and rule out motor/visual confounds.
3. **Severe Practice Effects & Poor Longitudinal Reliability (`ICC = 0.49`):**
   - MyCog Mobile's `Arranging Pictures` has a 2-week test-retest ICC of only **0.49** with a **+3.21 point practice gain**, and no published alternate forms.
   - *Our Solution:* **Procedural 3D Psychometric Isomorphs.** The AI generates parallel 3D forms with matched psychometric difficulty parameters (clutter entropy, graph distance, syllable length, semantic distinctness) so repeat testing has zero stimulus memorization.
4. **Unsupervised Remote Inflation (`β = 1.114` on Remote Memory):**
   - Remote users score artificially higher on MyPictures due to environmental help or note-taking.
   - *Our Solution:* Real-time kinematic/gaze-proxy/timing telemetry and **implicit spatial-incidental encoding** in 3D space that cannot be easily written down as a 1D word list.
5. **Unmeasured Device/Hardware Latency (`iOS 18.80 vs. Android 17.11`):**
   - `MyCogTechSpec.md` (Section 4.5) notes that OS/hardware differences shift mean scores because no touchscreen/mouse latency calibration is performed.
   - *Our Solution:* A 20-second **Room 0: 3D Motor & Input Latency Calibration** that measures baseline cursor/touch ballistic speed, tremor, and frame-to-click hardware lag, subtracting baseline motor time from all cognitive RT metrics.

---

## Part 3: The 3D Game Experience — *"The Celestial Observatory"*

To make this an impressive **Google Science submission**, the assessment takes place inside a breathtaking, interactive **3D WebGL / Three.js Observatory** guided by a voice-and-visual **AI Director (powered by Gemini)**.

### Architectural Pillars
1. **Room 0: Dual-Channel Calibration & Prior Loader (90 sec)**
   - **Baseline Motor & Visual Acuity Calibration:** User aligns 3D lenses and intercepts simple high-contrast light targets across the 4 visual quadrants. Establishes **baseline motor RT, hardware latency, peripheral reach kinematics (Optic Ataxia baseline), and basic contrast acuity**.
   - **Prior & Informant Bayesian Ingestion:** Loads any prior session vector + Spouse/Informant "Observer Lens" (AD8 + PCA/DLB real-world checklist: cluttered counters, stairs/depth judgment, reading line loss, dream enactment, fluctuating alertness).
2. **Station 1: The Starlight Orrery — *Dorsal & Ventral Visual Streams (PCA & Agnosia)***
   - **Primary Mechanic (3D Navon & Crowding):** Hierarchical 3D constellations where small rotating polyhedra form a larger macro-glyph. User identifies either the Global shape or Local elements under varying 3D clutter densities.
   - **Convergent Validation Branch A (If Global/Local ratio or crowding spikes $\rightarrow$ Suspect Simultanagnosia):**
     - **The Diorama Lens (Complex 3D Scene Synthesis):** Camera pans into a rich 3D multi-event scene. User speaks for 45 seconds describing what is happening. Gemini analyzes **global narrative integration vs. piecemeal object listing**, spatial quadrant neglect, and word-finding pause distribution.
   - **Convergent Validation Branch B (If shape recognition degrades $\rightarrow$ Suspect Ventral Agnosia):**
     - **3D Foreshortened Silhouette Forge:** Rotating a 3D object from an non-canonical/unusual viewing angle until recognized (VOSP Unusual Views / Poppelreuter analog).
3. **Station 2: The Nebula Chamber — *Pareidolia & Attentional Fluctuations (DLB Screen)***
   - **Primary Mechanic (Procedural 3D Pareidolia Shaders):** Volumetric WebGL clouds and carved stone reliefs generated via procedural noise. Half contain subtle embedded faces/animals; half are pure fractal noise.
   - **Convergent Validation Branch (If Pareidolia False Alarms $>1$ or high RT variance $\rightarrow$ Suspect DLB):**
     - Injects **Micro-Vigilance Pulses** across subsequent transitions to quantify the **Attentional Fluctuation Index ($\text{MAD}/\text{Median RT}$)** and pairs with **Clock/Cube 3D Reconstruction**.
4. **Station 3: The Architect's Drafting Table — *Visuoconstruction, Set-Shifting & Gerstmann Tetrad***
   - **Primary Mechanic 1 (3D DCCS / Trails Switchboard):** Routing light beams by switching between Dimension A (Geometry) and Dimension B (Spectrum) across 30 mixed trials (computing **MyCog Rate-Correct Score**, **3-MAD outlier trimming**, and **Switch-Cost Ratio**).
   - **Primary Mechanic 2 (Blueprint Cube & Astronomical Clock):** Drawing/assembling the 3D structural cube and setting clock hands on the drafting surface (capturing stroke sequence, planning pauses, and spatial symmetry).
   - **Convergent Validation Branch (If Cube/Clock or Parietal error $\rightarrow$ Suspect Gerstmann / Parietal Variant):**
     - **The Automaton's Hands:** 3D articulated hand mental rotation (Left/Right + Finger identification), sequential counterweight balancing (Acalculia), and dictated log inscription (Agraphia).
5. **Station 4: The Acoustic Vault — *Associative Memory, Working Memory & Logopenic Language***
   - **Primary Mechanic 1 (3D Expedition Crew & Artifacts — MyFaces + PSM Hybrid):**
     - Encodes historical explorers (Face + Name + 3D Tool/Sequence). Tests **First-Letter Name Recall**, **Cued Name Matching**, and **Sequence Reconstruction** (scored by both Exact Position and Adjacent Pairs).
     - *Crucial Differential:* Compares **Free Recall vs. Cued Recognition** to separate *hippocampal storage failure* (typical AD) from *fronto-subcortical/DLB retrieval failure* (rescued by cues) and *visual encoding failure* (PCA—tested via auditory-verbal vs. visual sequence comparison!).
   - **Primary Mechanic 2 (The Resonance Lexicon — Fluency & Phonological Loop):**
     - 60-second Letter-F fluency + Category fluency with real-time 3D audio-reactive feedback.
   - **Convergent Validation Branch (If speech pauses or phonemic errors $\rightarrow$ Suspect lvPPA):**
     - **The Echo Relay:** Repeating acoustic sentences of escalating syllable length and low word-probability to isolate phonological loop breakdown.

---

## Part 4: The "Judge / Clinician Live HUD" (For the Google Science Submission)
Alongside the immersive 3D viewport, a toggleable **Scientific Telemetry Drawer** displays in real time:
1. **Live 6-Domain Bayesian Radar & Posterior Probabilities:**
   - Visuoperceptual (Dorsal/Ventral), Executive/Set-Shifting (RCS & Switch Cost), Associative & Episodic Memory (Storage vs. Retrieval), Language/Phonological Loop, Attentional Stability (IIV), and Visuoconstruction/Parietal.
2. **Phenotype Differential Likelihoods:**
   - Real-time updating bars for: *Normal Aging / High Reserve*, *Amnestic MCI*, *Posterior Cortical Atrophy (Dorsal/Ventral)*, *Dementia with Lewy Bodies (DLB)*, *Logopenic PPA*, and *Dysexecutive Variant*.
3. **Closed-Loop Adaptation Log ("Why the AI Branched"):**
   - Shows exact psychometric triggers (e.g., *"Detected Global:Local Navon latency ratio of 2.4x (+2.1 SD) in Station 1; automatically spawning Orthogonal Validation Task 1B [3D Scene Synthesis] and Auditory-Verbal Memory Control to test whether visual crowding is confounding downstream memory scores"*).
4. **Longitudinal & Prior Simulator:**
   - One-click presets allowing Science Fair / Google judges to load synthetic patient priors (e.g., *"62yo Architect, High Reserve, MoCA 28/30, Spouse AD8 flags difficulty finding tools on workbench"*) and watch the 3D session dynamically adapt its testing path!


---

## Part 5: Assessment of Google XR Blocks (`google/xrblocks` / AI Studio XR Blocks) as the SOTA Platform UI

### Overview of XR Blocks (`https://aistudio.google.com/learn/xr-blocks-in-ai-studio`)
**XR Blocks (`npm: xrblocks`, `github.com/google/xrblocks`)** is Google XR Labs' open-source spatial computing + AI framework built on **Three.js**, **WebXR**, **Rapier 3D Physics**, **Spatial UI (`uiblocks` / `Panel`)**, and native **Gemini Multimodal / Live AI (`xb.ai` & `xb.context`)**. Critically, it includes a **built-in Desktop Simulator** so the exact same 3D spatial scene runs seamlessly in a standard desktop web browser (mouse/trackpad/touch + mic) *and* scales up to WebXR headsets (Android XR / Galaxy XR).

### Why XR Blocks is a Game-Changer for This Google Science Submission

1. **Set-of-Mark (SoM) & Semantic Scene Context (`xb.context`) for Simultanagnosia & Agnosia:**
   - Standard web tests only know what button a user clicked. XR Blocks' `xb.context` exposes the **live 3D semantic scene tree, camera frustum visibility state, and Set-of-Mark (SoM) annotated 3D frame captures** directly to Gemini.
   - *Clinical Breakthrough:* During the **Complex 3D Scene Description (Simultanagnosia screen)**, Gemini receives both the user's spoken audio/transcript *and* the exact `xb.context` Set-of-Mark graph of which 3D actors/objects are visible in each quadrant of the user's viewport. It can objectively quantify **Focal Fixation Capture** (describing only 1 object while ignoring 4 adjacent visible objects in the frustum) vs. **Global Scene Integration**.

2. **Unified 3D Kinematics & Physics (`Rapier` + Ray/Hand Tracking) for Optic Ataxia & Constructional Apraxia:**
   - Bálint syndrome's **Optic Ataxia** (impaired visual guidance of reaching into peripheral fields) and **3D Visuoconstructional Apraxia** are true 3D spatial deficits that 2D paper tests flatten.
   - With XR Blocks' unified input pipeline (desktop raycast pointer in simulator mode, or 6-DoF hand/controller rays in XR mode) + Rapier physics, we capture **3D reach trajectory curvature, deceleration phase jitter, depth overshoot, and quadrant-specific reaction time** while assembling 3D geometric trusses (the 3D upgrade of the MoCA Cube).

3. **World-Space Spatial UI (`uiblocks` / `Panel`) Meets MyCog 2.0 Older-Adult Accessibility:**
   - `MyCogTechSpec.md` highlights that older adults require high contrast, large typography, zero clutter in instructions, and mandatory interactive practice trials.
   - XR Blocks' `Panel` system renders crisp, ergonomically angled **world-space 3D cards** directly in front of the user's focal plane, eliminating small 2D corner menus during testing, while allowing us to render a separate **2D HTML/React "Judge & Clinician Telemetry HUD"** alongside the 3D canvas.

4. **Dual-Mode Architecture (Desktop Browser First + WebXR Ready):**
   - **In AI Studio / Standard Browser:** Runs immediately via the XR Blocks Desktop Simulator + Three.js WebGL canvas—zero headset required for patients or competition judges.
   - **Future-Proof Spatial Biomarker Platform:** Because it uses `xrblocks` primitives (`xb.Script`, `Panel`, unified pointers), the submission demonstrates a path from today's pre-visit laptop/tablet browser screening to tomorrow's head/eye/hand-tracked Android XR neurological clinic.

### Recommended Hybrid Technical Architecture
- **3D Spatial Engine & XR Layer:** `three` + `xrblocks` patterns (`xb.Script` lifecycle, world-space `Panel` UI blocks, Set-of-Mark scene state serializer for Gemini `xb.context`, and 3D raycast kinematics).
- **AI & Psychometric Controller:** `@google/genai` (Gemini Multimodal for scene description analysis, verbal fluency clustering, and Bayesian adaptive branching) + deterministic local psychometric engine (implementing exact `MyCogTechSpec.md` **Rate-Correct Score**, **3-MAD outlier trimming**, **Adjacent-Pair vs. Exact-Position memory scoring**, and **Bayesian Posterior updating**).
- **Clinician / Judge Telemetry Overlay:** React + Tailwind split/floating HUD displaying live kinematic traces, 6-domain radar, differential phenotype probabilities (*PCA vs. DLB vs. lvPPA vs. High-Reserve MCI*), and the **Prior/Informant Scenario Simulator**.
