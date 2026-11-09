# PostCircECD ("The Celestial Observatory"): Canonical Master Specification
## Clinical Depth, Psychometric & Psychomotor Rigor, SOTA 3D Spatial Platform (`xrblocks` + Gemini), and Regulatory/Validation Framework

**Document Status:** Canonical Master Specification (`v2.0` — Mitigated against Specification Review `F1`–`F19` on 2026-11-08).
**Archived Prior Drafts:** `archive/PostCirc ECD Master Specification.md` and `archive/BRAINSTORM_AND_SPEC_SYNTHESIS.md` are archived for historical reference only.
**Primary Local Sources:**
- [MyCogTechSpec.md](MyCogTechSpec.md) — Technical and psychometric specification of MyCog, MyCog 2.0, MyCog Mobile, and NIH Toolbox Cognition Battery (Sections 1–5, References `[1]`–`[35]`).
- [earlycognitivescreeningnovel-approach-amid-current.pdf](earlycognitivescreeningnovel-approach-amid-current.pdf) — Urian DM, Gupta G, Battista ME, Wild CJ, & Owen AM (2026). *Early cognitive screening for individuals on the dementia continuum: A novel approach amid current trends.* Journal of Alzheimer's Disease, 110(4), 1547–1559. *(Conflict-of-interest note per p. 1555: A.M. Owen owns shares in Creyos Inc., which markets the Creyos tests commercially; C.J. Wild and M.E. Battista are employees of Creyos Inc.)*

> [!CAUTION]
> **Intended Use & Regulatory Status (`F3`):**
> PostCircECD is an **experimental research and science-competition prototype (`RESEARCH & EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE`)**. It is **not** a cleared or approved medical device under FDA or international regulations, does not provide medical advice or clinical diagnosis, and must not be used in clinical practice until formal IRB-approved normative/validation studies (Section 6) and regulatory clearance (Section 7) are completed. All synthetic persona demonstrations and any exported summaries must display a permanent **`SIMULATED / SYNTHETIC DEMO — NOT REAL PATIENT DATA`** watermark.

---

## 1. Pillar I: Clinical Depth & Two-Layer Syndrome-to-Etiology Framework

### 1.1 The Clinical Problem Statement
Standard brief primary-care cognitive screens (MMSE, Mini-Cog, and total-score MoCA) and current two-factor digital screeners (such as MyCog, which models *Episodic Memory* and *Executive Function*; see [MyCogTechSpec.md](MyCogTechSpec.md) Section 4.4) have documented structural limitations when evaluating four populations:

1. **High-Functioning Individuals with Early Cognitive Decline (Age 50–75):** High educational and verbal reserve can mask domain-specific decline on global cutoff screens (e.g., MMSE $>24$ or MoCA $\ge 26$; Urian et al., 2026, pp. 1549, 1552). Detecting early decline in high-reserve adults requires measuring efficiency/latency metrics, domain discrepancies, and longitudinal change relative to baseline rather than relying solely on a single static global cutoff.
2. **Posterior Cortical Atrophy (PCA):** As defined by the international PCA consensus classification (Crutch et al., *Alzheimer's & Dementia* 2017), PCA is a clinico-radiological syndrome characterized by progressive decline in higher visual processing (dorsal stream: **Bálint syndrome** [*simultanagnosia, optic ataxia, ocular apraxia*]; ventral stream: **apperceptive/associative visual agnosia, prosopagnosia**; dominant parietal: **Gerstmann syndrome** [*acalculia, agraphia, finger agnosia, left-right disorientation*], visual crowding, and constructional/dressing apraxia), while **episodic memory and insight are initially relatively preserved** (`F17`, Crutch et al., 2017, pp. 3–5). Because standard digital memory tests (e.g., MyCog Picture Sequence Memory; [MyCogTechSpec.md](MyCogTechSpec.md) Section 3.2) rely on visual stimuli, patients with PCA can fail visual memory tasks *secondarily to visual perceptual impairment*.
3. **Dementia with Lewy Bodies (DLB):** Per the Fourth Consensus Report of the DLB Consortium (McKeith et al., *Neurology* 2017), DLB typically presents with **disproportionate attentional, executive function, and visual processing deficits relative to memory and naming**, accompanied by core clinical features including **fluctuating cognition with pronounced variations in attention and alertness**, **recurrent visual hallucinations / visuoperceptual pareidolias** (Mamiya et al., 2016), **REM sleep behavior disorder (RBD)**, and parkinsonism.
4. **Other Atypical Variants (Logopenic PPA & Dysexecutive Presentations):**
   - **Logopenic Variant Primary Progressive Aphasia (lvPPA):** Per consensus criteria (Gorno-Tempini et al., *Neurology* 2011; Henry & Gorno-Tempini, 2010), core features are **impaired single-word retrieval in spontaneous speech and naming** and **impaired repetition of sentences and phrases** (reflecting phonological working-memory buffer impairment), with **spared single-word comprehension and object knowledge**.
   - **Dysexecutive Syndrome:** Disproportionate impairment in working-memory manipulation, set-shifting efficiency, and inhibitory control.

---

### 1.2 Two-Layer Classification Architecture (`F11`)
Following the consensus framework of Crutch et al. (2017, pp. 5–7), behavioral cognitive screening can only observe **Layer 1 (Cognitive/Behavioral Syndrome Profile)** and **cannot** by itself establish **Layer 2 (Underlying Neuropathological Disease Etiology)**, which requires clinical adjudication, neuroimaging, and fluid/PET biomarkers (for example, Crutch et al., 2017 note that while the vast majority of PCA cases are attributable to Alzheimer's disease pathology, PCA can also arise from Lewy body disease, corticobasal degeneration, or prion disease).

Therefore, PostCircECD separates its output into two strictly distinct layers:
* **Layer 1 — Observable Cognitive Syndrome Profile (7 Distinct Profiles, Not Lumped):**
  1. `Profile 0: Within Expected Range (No Objective Domain Deficit Detected)`
  2. `Profile 1: Dorsal Visuospatial / Parietal Syndrome Profile` (Navon global/crowding deficit, array comparison deficit, constructional/Gerstmann signs)
  3. `Profile 2: Ventral Visuoperceptual Syndrome Profile` (Foreshortened object recognition and visual face-recognition impairment with preserved verbal semantics)
  4. `Profile 3: Pareidolia & Fluctuating Attention Profile` (Elevated noise pareidolia illusory responses paired with high intra-session RT variability)
  5. `Profile 4: Logopenic / Phonological Buffer Profile` (Length-dependent sentence repetition deficit and lexical retrieval pauses with spared single-word comprehension)
  6. `Profile 5: Dysexecutive / Set-Shifting Profile` (Selective reduction in set-shifting efficiency and spatial working-memory span)
  7. `Profile 6: Primary Amnestic / Storage Profile` (Cross-modal visual and auditory-verbal recall and recognition deficit not rescued by cues)
* **Layer 2 — Clinician Differential Context (Literature Reference Only):**
  Maps how Layer 1 profiles relate to differential workup considerations (AD, PCA-AD, PCA-LBD, PCA-CBD, DLB, lvPPA, Vascular/Metabolic, or Reversible Mood/Sleep/Sensory confounds) alongside published epidemiological base-rate notes.

---

### 1.3 Canonical Station & Sub-Task Registry (`F9`, `F14`)
Every station and sub-task has a single canonical identifier (`S0`–`S5`). A standard screening session executes only the **Core Spine (`S0` + 5 core sub-tasks, target duration ~9–11 minutes)** plus **at most 2 Conditional Convergent Follow-Up Probes (capped at $\le 3$ minutes total)** when triggered by the family-wise routing rule (Section 2.6).

| Station ID & Canonical Name | Sub-Task ID & Name | Role (`Core` vs. `Conditional Probe`) | Construct Measured | Target Cap (s) | Measured Pilot Median (s) `[F9]` |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **S0: Intake, Sensory & Motor Baseline** | **S0.1:** Patient & Informant Intake (AD8 + Posterior/DLB items + PHQ-2/GAD-2) | `Core` (Pre-session / Room 0) | Subjective vs. Informant discrepancy; mood/sleep confounds | 90 s | *TBD (Pilot)* |
| **S0: Intake, Sensory & Motor Baseline** | **S0.2:** Hearing, Contrast & Color-Vision Check (`F8`) | `Core` | 3-frequency audibility check + color-safe symbol verification | 30 s | *TBD (Pilot)* |
| **S0: Intake, Sensory & Motor Baseline** | **S0.3:** 36-Target Quadrant Pointing Baseline (`F10d`, `F14`) | `Core` | Baseline motor RT ($RT_{\text{motor}}$) across 4 central + 32 quadrant targets (8/quadrant) | 45 s | *TBD (Pilot)* |
| **S1: The Starlight Orrery (Visuoperceptual Streams)** | **S1.1:** Hierarchical Navon & Crowding Series | `Core` | Global vs. Local rate-correct efficiency ($\text{GLDI}$) across clutter levels | 75 s | *TBD (Pilot)* |
| **S1: The Starlight Orrery (Visuoperceptual Streams)** | **S1.2:** Diorama Scene Element Coverage + Point-and-Link Control (`F5`) | `Conditional Probe` (if `S1.1` flags global/crowding deficit) | Deterministic count of spoken + pointed scene elements across 4 quadrants | 60 s | *TBD (Pilot)* |
| **S1: The Starlight Orrery (Visuoperceptual Streams)** | **S1.3:** 3D/2D `Feature Match` Array Comparison (Urian et al., 2026) | `Conditional Probe` (convergent visual attention check) | Side-by-side shape array comparison over 90 s ($\sum d_{\text{correct}} - \sum d_{\text{incorrect}}$) | 90 s | *TBD (Pilot)* |
| **S2: The Nebula Chamber (Pareidolia & Ventral Object)** | **S2.1:** Noise Pareidolia & Overlapping Figures Screen | `Core` | Illusory face responses in noise (Mamiya et al., 2016) + shape identification | 75 s | *TBD (Pilot)* |
| **S2: The Nebula Chamber (Pareidolia & Ventral Object)** | **S2.2:** Unconventional Views / Silhouette Rotation | `Conditional Probe` (if `S2.1` object hits impaired) | Foreshortened object recognition vs. canonical view | 60 s | *TBD (Pilot)* |
| **S3: The Blueprint Table (Executive, Construction & Parietal)** | **S3.1:** 30-Trial Mixed Switchboard (MyCog DCCS analog + Shape/Pattern-Safe cues `F8`) | `Core` | Executive Rate-Correct Score ($\text{RCS}$), Switch-Cost Ratio ($\text{SCER}$), within-condition $\text{CoMAD}$ | 120 s | *TBD (Pilot)* |
| **S3: The Blueprint Table (Executive, Construction & Parietal)** | **S3.2:** Cube / Infinity Copy & Clock Setting | `Core` | Visuoconstructional accuracy, stroke sequence, spatial planning latency | 90 s | *TBD (Pilot)* |
| **S3: The Blueprint Table (Executive, Construction & Parietal)** | **S3.3:** `Number Ladder` Spatial Working Memory Span (Urian et al., 2026) | `Conditional Probe` (if `S3.1` or `S3.2` borderline) | Visuospatial working memory span (ends after 3 errors) | 75 s | *TBD (Pilot)* |
| **S3: The Blueprint Table (Executive, Construction & Parietal)** | **S3.4:** Gerstmann 4-Component Probe (Hand Laterality/Finger ID, Calculation, Dictated Phrase) | `Conditional Probe` (if `S3.2` impaired) | Dominant inferior parietal / angular gyrus tetrad screen | 75 s | *TBD (Pilot)* |
| **S4: The Acoustic Vault (Language & Phonological Buffer)** | **S4.1:** 60s Letter-F Fluency & 60s Animal Category Fluency (`F8`) | `Core` | Lexical/semantic retrieval rate, 15s decay ratio ($\text{TDR}$), raw audio capture | 135 s | *TBD (Pilot)* |
| **S4: The Acoustic Vault (Language & Phonological Buffer)** | **S4.2:** Echo Relay Sentence Repetition + Non-Verbal Semantic Triad | `Conditional Probe` (if `S4.1` or `S5.2` flags lexical/phonological pause) | Length-dependent phonological buffer (lvPPA) vs. semantic association | 60 s | *TBD (Pilot)* |
| **S5: The Gallery of Pioneers (Memory & Proper-Name Cascade)** | **S5.1:** Expedition Crew & Sequence Memory (MyFaces + MyPictures/PSM Hybrid) | `Core` | 12-item sequence ($S_{\text{exact}}, S_{\text{adj}}$) + Face First-Letter Recall & Cued Name Matching | 150 s | *TBD (Pilot)* |
| **S5: The Gallery of Pioneers (Memory & Proper-Name Cascade)** | **S5.2:** Archival Photograph Famous-Person 3-Step Cascade (`F12`) | `Core` | Free naming $\to$ Visual biography $\to$ Verbal clue control $\to$ Phonemic cue | 75 s | *TBD (Pilot)* |
| **S5: The Gallery of Pioneers (Memory & Proper-Name Cascade)** | **S5.3:** Auditory-Verbal Sequence Control | `Conditional Probe` (if `S5.1` impaired AND `S1.1` visual stream impaired) | De-confounds visual perceptual encoding failure (PCA) from hippocampal storage deficit | 75 s | *TBD (Pilot)* |

*Note on Practice Gating (`F9`):* Every core and conditional task is preceded by the unified **4-Trial Practice Gate** defined in Section 3.4 (target $15\text{–}25\text{ s}$ per gate). Total Core Spine target (including practice gates): **$\sim 11.5\text{ minutes}$**; maximum session with 2 conditional probes: **$\sim 14.5\text{ minutes}$**. Actual durations must be populated in the `Measured Pilot Median` column from pilot telemetry, never estimated.

---

## 2. Pillar II: Psychometric & Statistical Rigor (Repaired per `F1`, `F2`, `F4`, `F10`, `F11`, `F13`, `F15`, `F19`)

> [!IMPORTANT]
> **Unvalidated Threshold Policy (`F2`):**
> Even for the mature MyCog and MyCog Mobile batteries, [MyCogTechSpec.md](MyCogTechSpec.md) (Section 5) notes that **no fixed public cutoffs and no external validation cohorts have been published**. Every numerical threshold in this specification for novel or adapted tasks is explicitly tagged **`[PROPOSED / UNVALIDATED — DESIGN TARGET]`**. Until empirical normative distributions are collected under Section 6, the live application HUD must display **raw measured metrics with 95% confidence intervals** and label normative fields **`No Norm Available (Prototype)`**.

### 2.1 Station `S0.3`: Pointing Baseline & Device Context (`F10d`, `F15`)
* **Correction to Device-Latency Premise (`F15`):** [MyCogTechSpec.md](MyCogTechSpec.md) (Section 4.5) reports that smartphone operating system (iOS vs. Android) shifts mean scores on `Arranging Pictures` (an untimed memory task: iOS $18.80$ vs. Android $17.11$) and `Shape-Color Sorting`, while explicitly stating that **reliability and validity are unaffected** and that no touchscreen-latency calibration, screen-size adjustment, or digital-literacy covariate has been published. It does *not* establish that hardware input latency caused those score shifts.
* **Purpose of Station `S0.3`:** We administer a 36-target pointing baseline (4 central targets + 8 targets in each of the 4 screen quadrants $Q_1..Q_4$, presented in randomized order over $\sim 45\text{ s}$) for two self-contained psychomotor purposes:
  1. **Individual Motor Speed Reference ($RT_{\text{motor}}$):** Median reaction time across the 4 central + 32 quadrant targets after excluding $<100\text{ ms}$ anticipates. Recorded as a covariate for motor-speed adjustment, **never subtracted prior to computing $\text{CoMAD}$** (`F10c`).
  2. **Quadrant Pointing Acquisition Test (`F10d`):** Rather than taking the upward-biased $\max - \min$ of 2–3 noisy trials, collecting $n_q = 8$ trials per quadrant ($32$ peripheral trials total) enables a formal non-parametric **Kruskal-Wallis test ($H$-statistic, $\text{df}=3$)** across quadrants $Q_1..Q_4$, reporting the omnibus $p$-value and median cursor path straightness $\eta_{\text{path}} = d_{\text{Euclidean}} / L_{\text{trajectory}}$.
  3. **Removal of Mouse "Optic Ataxia" Claim (`F10d`):** As established by Borchers et al. (2013), clinical testing for **optic ataxia** requires controlled central gaze fixation while reaching with each hand into both visual hemifields ($4$ hand $\times$ field combinations, $10$ reaches each) and still yields substantial false positives if fixation is not strictly enforced. **Free-gaze 2D mouse/trackpad movement in a browser cannot measure or diagnose optic ataxia.** In desktop mode, `S0.3` reports only **Screen-Quadrant Cursor Acquisition Latency & Path Efficiency**.

---

### 2.2 Station `S3.1`: Executive Rate-Correct Score, Within-Condition Trimming, SCER & CoMAD (`F10a–c`)
Following [MyCogTechSpec.md](MyCogTechSpec.md) (Section 2.2) for the 30-trial mixed DCCS block ($23$ repeat trials, $7$ switch trials):

1. **MyCog 2.0 Pooled Rate-Correct Score ($\text{RCS}_{\text{pooled}}$):**
   - For direct comparability with MyCog 2.0 (Young et al., 2025, `[4]`), compute the pooled median $M_{\text{all}}$ and pooled $\text{MAD}_{\text{all}} = \text{median}(|RT_i - M_{\text{all}}|)$ across all 30 trials, excluding trials with $RT_i < 100\text{ ms}$, $RT_i > 9000\text{ ms}$, or $|RT_i - M_{\text{all}}| > 3 \cdot \text{MAD}_{\text{all}}$.
   - Primary efficiency index:
     $$\text{RCS}_{\text{pooled}} = \frac{C_{\text{valid}}}{\sum_{i \in \text{valid}} RT_i} \quad (\text{correct trials per second})$$
2. **Within-Condition 3-MAD Trimming for Repeat vs. Switch Comparisons (`F10a`):**
   - Because switch trials are legitimately slower than repeat trials, pooled trimming preferentially removes valid slow switch trials. Therefore, before computing condition-specific metrics ($\text{RCS}_{\text{repeat}}$, $\text{RCS}_{\text{switch}}$, $\text{SCER}$, and $\text{CoMAD}$), outlier trimming is performed **separately within each condition** $c \in \{\text{repeat}, \text{switch}\}$ using that condition's own median $M_c$ and $\text{MAD}_c$:
     $$\text{Valid}_c = \left\{ i \in \text{Trials}_c \;\middle|\; 100\text{ ms} \le RT_i \le 9000\text{ ms} \;\land\; |RT_i - M_c| \le 3 \cdot \text{MAD}_c \right\}$$
3. **Canonical Switch-Cost Efficiency Ratio ($\text{SCER}$) & Minimum-Trial / Interval Rule (`F10b`, `F14`):**
   - We adopt a single canonical definition across all project documents:
     $$\text{SCER} = 1 - \frac{\text{RCS}_{\text{switch}}}{\text{RCS}_{\text{repeat}}}$$
   - **Minimum-Trial Gate & Confidence Interval (`F10b`):** $\text{SCER}$ is computed **only if** $|\text{Valid}_{\text{repeat}}| \ge 15$ and $|\text{Valid}_{\text{switch}}| \ge 5$. Because $|\text{Trials}_{\text{switch}}| = 7$ is small, the engine computes a **percentile bootstrap 95% confidence interval** ($B = 1000$ resamples stratified by condition) $\left[\text{SCER}_{2.5\%}, \, \text{SCER}_{97.5\%}\right]$. If $|\text{Valid}_{\text{switch}}| < 5$, $\text{SCER}$ is reported as `Insufficient Valid Switch Trials`.
4. **Within-Condition Raw-RT Coefficient of MAD ($\text{CoMAD}$) (`F10c`):**
   - Subtracting a constant $RT_{\text{motor}}$ leaves $\text{MAD}$ unchanged while lowering the median $M$, which artificially inflates $\text{MAD}/(M - RT_{\text{motor}})$ in individuals with slower baseline motor speed.
   - Therefore, $\text{CoMAD}$ is computed strictly on **unsubtracted raw reaction times within the 23 repeat trials** (and separately within vigilance blocks), detrended for linear trial-order fatigue:
     $$\text{CoMAD}_{\text{repeat}} = \frac{\text{MAD}(RT_{\text{raw, repeat}})}{\text{median}(RT_{\text{raw, repeat}})}$$
   - Any heuristic threshold (e.g., $\text{CoMAD}_{\text{repeat}} > 0.35$ `[PROPOSED / UNVALIDATED — DESIGN TARGET]`) is labeled as an unvalidated research hypothesis.

---

### 2.3 Stations `S1` & `S2`: Visuoperceptual Metrics & Noise Pareidolia Scoring (`F5`, `F10f`)
1. **Navon Global-Local Dominance Index ($\text{GLDI}$, Station `S1.1`):**
   - Computed from within-condition trimmed rate-correct scores across Global-target ($n=16$) and Local-target ($n=16$) trials:
     $$\text{GLDI} = \frac{\text{RCS}_{\text{Global}}}{\text{RCS}_{\text{Local}}}$$
     reported alongside a stratified bootstrap 95% CI. Heuristic flag $\text{GLDI} < 0.55$ is tagged `[PROPOSED / UNVALIDATED — DESIGN TARGET]`.
2. **Spoken & Pointed Scene Element Coverage (Station `S1.2`, `F5`):**
   - Replaces the earlier "Simultanagnosia / Focal Fixation Capture Index." Without hardware eye-tracking, a web camera or 3D viewport only records which objects are **unoccluded inside the camera's normalized view box (`VisibleObjectsBuilder`)**, not where the user's fovea fixated.
   - Moreover, free spoken description is confounded by lexical retrieval (lvPPA), speech output rate, and executive initiation.
   - **Deterministic Primary Score:** The diorama contains $12$ predefined target elements ($3$ per quadrant) and $4$ predefined cross-quadrant action links.
     - **Part A (Spoken Coverage Count):** Deterministic keyword/synonym matcher counts how many of the $12$ elements and $4$ relational links are named ($0\text{–}16$), plus quadrant balance across $Q_1..Q_4$.
     - **Part B (Non-Verbal Point-and-Link Control):** The user directly clicks/taps the interacting object pairs in the scene. This de-confounds **lvPPA / expressive language impairment** (low Part A spoken count, intact Part B non-verbal relational pointing) from **visuoperceptual crowding / simultanagnosia** (impaired on both Part A and Part B despite intact single-object naming).
   - **Adjunct AI Logging:** Any Gemini narrative analysis of the scene transcript is logged strictly as an **exploratory adjunct annotation** tagged with the exact model version ID, temperature, and prompt hash, and never overrides the deterministic coverage score.
3. **Noise Pareidolia Response Count (Station `S2.1`, `F10f`):**
   - Rather than an uncited false-alarm proportion cutoff, scoring aligns directly with the published **Noise Pareidolia Test** literature (**Mamiya et al., 2016**: $52$ DLB, $52$ AD, $20$ healthy controls).
   - In Mamiya et al. (2016), mean illusory pareidolia responses were $7.3$ in DLB, $1.1$ in AD, and $0.2$ in controls; a cutoff of **$\ge 2$ illusory pareidolia responses** discriminated DLB from AD with **$60\%$ sensitivity and $92\%$ specificity**.
   - **Clinical Interpretation Rule:** Because specificity is high ($92\%$) but sensitivity is modest ($60\%$), an elevated illusory count ($\ge 2$ `[PROPOSED / UNVALIDATED — ADAPTED FROM MAMIYA ET AL. 2016 FOR 3D]`) is a specific positive signal for DLB-spectrum visuoperceptual vulnerability, **whereas a negative result ($0\text{–}1$ illusory responses) does NOT rule out DLB**.

---

### 2.4 Station `S5.1`: Dual Episodic Sequence Scoring & Chance-Corrected Recognition Gain (`F10e`)
1. **Sequence Reconstruction (MyPictures / NIH Toolbox PSM Hybrid, $L=12$ tiles):**
   - Computes both **MyCog Exact-Position Score** ($S_{\text{exact}} = \sum_{k=1}^{12} \mathbb{I}(\hat{p}_k = k)$, range $0\text{–}12$; [MyCogTechSpec.md](MyCogTechSpec.md) Section 3.2) and **NIH Toolbox Adjacent-Pair Score** ($S_{\text{adj}} = \sum_{k=1}^{11} \mathbb{I}(\hat{p}_{k+1} - \hat{p}_k = 1)$, range $0\text{–}11$; [MyCogTechSpec.md](MyCogTechSpec.md) Section 3.1).
2. **Associative Memory (MyFaces Analog, $L=12$ pairs) — Replacing Unstable RSI (`F10e`):**
   - The earlier ratio $(S_{\text{match}} - S_{\text{letter}})/(L - S_{\text{letter}})$ divides by zero when $S_{\text{letter}} = L$, jumps from $0.00$ to $1.00$ when $S_{\text{letter}} = L-1$, and fails to correct for the $1/K = 0.25$ chance guessing rate on 4-choice name matching.
   - **Repaired Formulation:**
     1. **Free First-Letter Recall Proportion:** $p_{\text{free}} = \frac{S_{\text{letter}}}{L}$ (with Wilson 95% CI).
     2. **Chance-Corrected Cued Matching Proportion ($K=4$ options):**
        $$p_{\text{cued, corr}} = \max\left(0, \; \frac{\frac{S_{\text{match}}}{L} - \frac{1}{K}}{1 - \frac{1}{K}}\right) = \max\left(0, \; \frac{4 S_{\text{match}} - L}{3 L}\right)$$
     3. **Chance-Corrected Recognition Gain ($\Delta_{\text{cue}}$):**
        $$\Delta_{\text{cue}} = p_{\text{cued, corr}} - p_{\text{free}}$$
        Reported with its 95% confidence interval. Cued-rescue vs. consolidation-failure interpretation is evaluated **only when free recall misses at least 4 items ($L - S_{\text{letter}} \ge 4$)** so the gain denominator has sufficient dynamic range.
   - *Evidence Note (`F19` / Outside Verification Log):* While cued-recall rescue is widely discussed in fronto-subcortical vs. hippocampal memory literature, the 2017 DLB consensus report (McKeith et al., 2017) primarily emphasizes disproportionate attentional, executive, and visual processing deficits relative to memory and naming; therefore, $\Delta_{\text{cue}}$ is treated as a descriptive memory-profile modifier rather than a standalone diagnostic criterion for DLB.

---

### 2.5 Station `S5.2`: Archival Photograph Famous-Person 3-Step Cascade (`F12`)
To eliminate the two flaws identified in `F12` (the circular familiarity exclusion that erases semantic-loss errors, and the rendering-quality confound of stylized 3D busts):
1. **Stimulus Standard:** Uses **high-resolution, standardized archival photographs** displayed on a flat, fronto-parallel ($0^\circ$ tilt) high-contrast card (`UICard`) rather than 3D rendered busts.
2. **Single Canonical 3-Step Sequence ($N=8$ universally iconic figures):**
   - **Step 1 (Free Visual Naming):** Photograph is shown; user speaks or types the person's full name.
   - **Step 2 (Modality Dissociation on Any Missed Item):**
     - **Step 2A (Visual Semantic Identification):** While viewing the photograph, user selects the matching biographical description from 4 options.
     - **Step 2B (Non-Visual Verbal Identification Control):** The photograph is hidden; user hears/reads a defining biographical statement + iconic achievement and selects/names the person (or matches to 4 names).
   - **Step 3 (Phonemic Cue):** If Step 2A was correct but Step 1 free naming failed, provide the initial syllable cue (e.g., `"Al... Ein..."`) to test phonemic retrieval facilitation.
3. **Non-Exclusionary Familiarity Rule (`F12`):**
   - A patient with multimodal person/semantic agnosia (e.g., semantic variant PPA or bilateral anterior temporal lobe atrophy) will frequently claim that a missed famous person is "unfamiliar." **Self-reported unfamiliarity is NEVER subtracted from the denominator.**
   - Instead, all 8 items remain in the denominator; pre-morbid familiarity is corroborated independently via the **Spouse/Informant intake check** and educational-cohort anchor norms, and "reported unfamiliar" responses on high-frequency anchors are scored as **Semantic/Recognition Failure (`Step 2A & 2B Incorrect`)**.

| Step 1: Free Name | Step 2A: Visual Biography | Step 2B: Verbal Clue (No Face) | Step 3: Phonemic Cue | Dissociated Cognitive Profile |
| :---: | :---: | :---: | :---: | :--- |
| Impaired | **Impaired** | **Intact** | Intact (after 2B) | **Visual Face Recognition Deficit (Prosopagnosia / Ventral Stream Profile)** |
| Impaired | **Intact** | Intact | **Intact** | **Pure Lexical / Proper-Name Retrieval Deficit (Anomia Profile)** |
| Impaired | **Impaired** | **Impaired** | Impaired | **Multimodal Person-Specific Semantic Deficit (Semantic / ATL Profile)** |

---

### 2.6 Properly Scoped Integration of Urian et al. (2026) & Family-Wise Router Rules (`F1`, `F11`, `F18`, `F19`)

1. **Accurate Statement of Urian, Gupta, Battista, Wild, & Owen (2026) (`F1a–e`, `F18`):**
   - **Normative Archive & Training Cohorts:** Creyos is an online battery of 12 cognitive tasks administered $>14\text{ million}$ times over 15 years, from which a normative database of approximately $85,000$ healthy participants (including $\sim 5,000$ aged $>65$) was assembled (Urian et al., 2026, p. 1551). Their two-stage ML screener (mean-centering + power transformation followed by a linear Support Vector Classifier on `Number Ladder` and `Feature Match`, using final task score and a reaction-time marker from each task) was trained and hyperparameter-tuned via nested stratified K-fold cross-validation on $n=2,859$ healthy controls and $n=1,856$ neurology-clinic patients (p. 1551).
   - **Preliminary AD Validation Sample (`14 + 14`):** The reported **100% sensitivity (14/14 AD patients flagged; Wilson 95% CI: $78\%\text{–}100\%$) and 86% specificity (2/14 matched controls flagged; Wilson 95% CI: $60\%\text{–}96\%$)** come from a small, preliminary validation cohort of **14 patients clinically diagnosed with AD dementia and 14 age-, gender-, and education-matched controls** (pp. 1552–1553; one of the 14 AD patients scored $>24$ on the MMSE).
   - **General-Population Age Trend (`n = 9,350`):** In a general population sample of $n=9,350$ adults aged 21–97, the probability of a positive screen (`SCR+`) rose significantly above age 50 ($\text{LR}(5)=652.50, p<0.001$; $12.30\%$ at ages 50–60, $20.50\%$ at 60–70, $38.50\%$ at $70+$; Fig. 1, p. 1552). **Urian et al. (2026) do not study or mention PCA, lvPPA, or atypical AD variants**; our focus on the 50–75 age window for PCA and lvPPA derives from the PCA and PPA clinical consensus papers (Crutch et al., 2017; Gorno-Tempini et al., 2011), while Urian et al. support the general principle of including midlife adults ($<65$) in normative baselines.
   - **Descriptive Factor Scoring vs. Classifier:** In Urian et al. (2026, p. 1552 & Fig. 2), Yeo-Johnson transformation + multiplication by the pseudo-inverse of the Varimax-rotated factor loading matrix (from Hampshire et al., *Neuron* 2012) is used strictly to compute **descriptive 3-domain composite scores (Short-Term Memory, Reasoning, Verbal)** across all 12 Creyos tasks. It does not include a posterior/visuoperceptual or pareidolia factor. Any 6-domain factor loading matrix $\mathbf{W}$ for PostCircECD must be **estimated empirically from PostCircECD's own future validation data (Section 6)**.
   - **Self-Reported Health Conditions (Fig. 2, p. 1554):** After FDR correction across 50 comparisons in the $n=9,350$ sample, groups with self-reported hypertension ($n=148$), concussion ($n=30$), and cardiac problems ($n=41$) showed significantly lower descriptive scores on at least one cognitive domain compared to matched controls, but none of the non-AD self-reported condition groups (including depression PHQ-2 $n=70$ and anxiety GAD-2 $n=85$) showed a statistically significant increase in positive screener rate (`P(SCR+)`), whereas the $n=14$ AD group did ($p < 0.001$). Because non-significance in modest subsamples is not proof of formal equivalence, we include PHQ-2/GAD-2 and vascular/sleep history as **explicit clinical context covariates** rather than claiming automatic immunity to false alarms.
2. **Comparison with MyCog Mobile Early Stopping (`F19`):**
   - MyCog Mobile's adaptive testing (Young et al., 2026, [MyCogTechSpec.md](MyCogTechSpec.md) Section 4.2, ref `[8]`) is **statistically efficient for binary MCI triage**, classifying $33\%$ of participants after the first task with $\Delta\text{AUC} = 0.008$ relative to the full 4-task battery. Our convergent-validation routing addresses a *different clinical objective*: rather than stopping early once binary impairment is likely, it administers a targeted follow-up probe (capped at $\le 2$ probes per session) to disambiguate *why* a task failed (e.g., visual crowding vs. hippocampal amnesia).
3. **Family-Wise Type-I Error Control for the Convergent Router (`F11`):**
   - Testing 6 domains independently at $Z \le -1.25$ ($p = 0.1056$) would trigger false-positive follow-up branches in up to $1 - (1 - 0.1056)^6 = 48.8\%$ of healthy individuals under independence.
   - **Repaired Routing Rule:**
     1. **Once Empirical Norms Exist (Section 6):** Apply the **Holm-Bonferroni step-down procedure** across the 6 domain $p$-values at a family-wise error rate of $\alpha_{\text{FWER}} = 0.10$ (so the most extreme domain must reach $p_{(1)} \le 0.10 / 6 = 0.0167$, i.e., $Z_{(1)} \le -2.13$, or $Z_{(1)} \le -1.96$ for $\alpha_{\text{FWER}} = 0.15$), **and** cap follow-up execution at the **top $\le 2$ flagged domains**.
     2. **In Unnormed Prototype Mode (`F2`):** Routing triggers are driven explicitly by **transparent, deterministic task-criterion rules** (e.g., $\ge 2$ missed items on `S2.1` object recognition or $\ge 2$ pareidolia responses; labeled `[PROPOSED / UNVALIDATED — HEURISTIC ROUTING RULE]`) and logged verbatim in the HUD's Branching Log.

---

## 3. Pillar III: SOTA 3D Spatial Platform (`xrblocks@0.24.0` + Three.js) & Accessible UX (`F5`–`F9`)

### 3.1 Verified `xrblocks` (`v0.24.0`) Architecture & Identifiers (`F6`)
*(Note: Per the `google/xrblocks` repository README, `xrblocks` is released under the Apache-2.0 license by Google XR Labs and carries the standard notice: "This is not an officially supported Google product." Physics via Rapier is not bundled inside `xrblocks` and is supplied as an application dependency only if needed.)*

To ensure 100% alignment with the public `xrblocks` (`v0.24.0`) package:
1. **Lifecycle & Input Controller (`xb.Script`):**
   Each station extends `xb.Script` implementing the verified lifecycle methods `init()`, `update()`, `onSelectStart()`, and `onSelectEnd()`.
2. **Spatial UI Primitives (`UICard` & `UIPanel`):**
   Replaces the non-existent `uiblocks` / `Panel` identifiers from earlier drafts with the library's actual UI classes: world-space **`UICard`** containers and nested **`UIPanel`** elements.
3. **Scene Visibility & Set-of-Mark (`VisibleObjectsBuilder` & `SetOfMarkBuilder`):**
   Replaces the non-existent `serializeContext()` method. In `xrblocks`, `Context.ts` / `SceneDetector.ts` use `VisibleObjectsBuilder.ts` (which checks whether each object's projected position lies inside the camera's normalized view box and casts a line-of-sight occlusion ray from the camera) and `SetOfMarkBuilder.ts` to produce structured JSON object marks via `xb.context` / `xb.core.context`.
4. **Mandatory Build Step 0 (`docs/xrblocks-probe.txt`, `F6`):**
   Before building station scenes, a minimal 1-page probe against the installed `xrblocks@0.24.0` package must be executed to log the exact runtime structure of `xb.context` / `xb.core.context` to `docs/xrblocks-probe.txt`.

---

### 3.2 Preserving the Flagship 3D Observatory UX While Guaranteeing PCA / Motion Safety (`F7`)
Our core experiential vision is an **engaging, non-intimidating, 3D game-like exploration of "The Celestial Observatory"** where the user visits five architectural instruments (Calibration Lens, Starlight Orrery, Nebula Chamber, Architect's Blueprint Table, Acoustic Vault, and Gallery of Pioneers). At the same time, because PCA patients experience visual crowding, depth-perception impairment, and sensitivity to visual motion (Crutch et al., 2017; `PMID: 42789112`), **uncontrolled camera motion or background clutter during a timed cognitive trial would act as an experimental confound (`F7`)**.

To preserve the **full 3D Celestial Observatory UX** while eliminating visual/motion confounds during measurement, PostCircECD implements a **Dual-State Spatial Staging Architecture**:

1. **Primary Experience — `3D Celestial Observatory with Spatial Spotlight Lock`:**
   - **Between Stations (Exploration & Narrative Transitions):** The user experiences the rich 3D WebGL/Three.js Observatory environment—3D brass/glass astrolabes, volumetric nebula shaders, architectural drafting tables, and acoustic resonators—keeping engagement high and test anxiety low.
   - **During Timed/Scored Trials (`Spatial Spotlight Lock` Auto-Engages):** The moment a practice gate or scored task begins:
     1. **Camera Lock ($0\text{ rad/s}$ angular & linear velocity):** Camera flight locks into a stationary, fronto-parallel ($0^\circ$ tilt) focal frame facing the station instrument.
     2. **Peripheral Dimming ($85\%$ Curtain):** Surrounding 3D room geometry smoothly dims to a uniform matte slate backdrop (`#12161F`) so zero peripheral objects or ambient particles compete for dorsal/ventral visual attention.
     3. **Controlled 3D/2D Stimulus Presentation:** High-contrast typography ($\ge 20\text{ px}$ body, $\ge 28\text{ px}$ stimuli; AAA $\ge 7:1$ contrast) renders on fronto-parallel `UICard` surfaces, while true 3D depth/crowding stimuli are strictly confined to the tasks where 3D spatial perception is the construct under test (`S1.1` Navon Orrery, `S2.2` 3D Silhouette Rotation, `S3.2` 3D Cube/Truss Construction).
2. **One-Click `Plain Static Mode` (`motionOff = true`, `plainMode = true`) Comparator (`F7`):**
   - A persistent top-bar switch (`3D Observatory [Spotlight Lock]` $\leftrightarrow$ `Plain Static Mode [Zero Motion]`) allows instant switching to a pure 2D static presentation with $0\text{ ms}$ fade-cuts and zero 3D room transitions—both for motion-sensitive participants and for the counterbalanced mode-equivalence pilot check in Section 5.2.

---

### 3.3 Sensory, Color-Vision, and Speech-Recognition Safeguards (`F8`)
1. **Hearing & Volume Verification (`S0.2`):**
   - Per NIDCD epidemiological statistics, disabling hearing loss affects $\sim 5\%$ of adults aged 45–54, $\sim 10\%$ aged 55–64, $\sim 22\%$ aged 65–74, and $\sim 55\%$ aged $75+$.
   - Before any audio instruction or spoken task (`S4.1`, `S4.2`, `S5.3`), `S0.2` plays a 3-level speech-frequency calibration check (`500 Hz`, `1000 Hz`, `2000 Hz` spoken digits) allowing volume adjustment.
   - All task instructions are presented **simultaneously in high-contrast on-screen text and optional audio**. We **remove** the "high/low frequency chime sorting" dual-task from earlier drafts so high-frequency presbycusis never confounds executive testing. If a participant fails the `S0.2` speech-audibility check even at maximum comfortable volume, auditory-only tasks (`S4.2` Echo Relay, `S5.3` Auditory Sequence) are automatically skipped and flagged `Excluded: Uncorrected Hearing Barrier`.
2. **Color-Vision Deficiency Accommodation (`S3.1`):**
   - Because $\sim 1$ in $12$ men ($\sim 8\%$, NEI) have color-vision deficiency, `S3.1` (30-trial mixed DCCS) **never relies on hue alone ("Spectrum")**.
   - Instead, Dimension 1 is **Shape** (Circle vs. Star) and Dimension 2 is **High-Contrast Surface Pattern + Okabe-Ito Color-Safe Luminance** (Solid Blue `#0072B2` vs. Striped Orange/Gold `#E69F00` with bold interior hatching), verified in `S0.2`.
3. **Speech Recognition (ASR) Limitations & Dysfluency-Aware Capture (`S4.1`, `S4.2`):**
   - Off-the-shelf ASR exhibits markedly higher word-error rates on disordered/aphasic speech (e.g., Sanguedolce et al., 2023 reported Whisper WER of $38.5\%$ in post-stroke aphasia vs. $10.3\%$ in controls). Crucially, a 2026 study on Primary Progressive Aphasia (**`PMID: 42798815` / `PMCID: PMC13613221`**, *Brain Communications* 2026) explicitly demonstrated that **off-the-shelf ASR tools fail to detect speech errors in lvPPA and nfvPPA because they prioritize "fluent transcription,"** whereas dedicated phoneme/word-level dysfluency extraction (insertions, replacements, deletions, prolongations, and repetitions) + connected-speech acoustic profiling (**`PMID: 42545687` / `PMCID: PMC13434971`**, *JAMA Neurology* 2026, $\text{AUC}=0.90$ across $N=214$ PPA patients) accurately differentiates PPA variants.
   - **Mitigation Rules:**
     1. **Deterministic Tap/Button Primary Capture + Acoustic Pause Telemetry:** During fluency (`S4.1`), repetition (`S4.2`), and scene description (`S1.2`), the interface captures local raw audio + acoustic pause/syllable-timing envelopes **and** provides a deterministic one-tap / spacebar word-timestamp counter + manual transcript/dysfluency tagger.
     2. **No Automated Paraphasia Grading from Generic Fluent-Prioritizing ASR:** Generic browser ASR transcripts are never used alone to score phonemic paraphasias; any automated speech error detector must use error-preserving acoustic/phoneme alignment benchmarked against human phonetic transcripts.

---

### 3.4 Unified Practice-Gate & Timeout Specification (`F9`, `F14`)
Aligned with MyCog 2.0 human-centered design rules ([MyCogTechSpec.md](MyCogTechSpec.md) Section 1.3 & Section 2.2):
1. **Interactive Practice Gate (`Pass 3 of 4`, Max 1 Retry Block):**
   - Every task begins with 1–2 brief interactive demonstration examples followed by **4 mandatory practice trials with immediate visual/text feedback**.
   - **Pass Criterion:** Participant must answer **$\ge 3\text{ of }4$ practice trials correctly** to enter the live scored block.
   - **Failure / Retry Path:** If the participant scores $<3/4$ on Practice Block 1, the interface displays simplified step-by-step guidance and administers **Practice Block 2 (4 additional practice trials)**.
   - **Auto-Skip on Second Practice Failure:** If the participant scores $<3/4$ on Practice Block 2, the task is **not administered**; the engine logs `Status: Practice Gate Failed (2x <3/4) — Excluded from Cognitive Scoring (Check Vision/Motor/Comprehension)` and advances to the next station without penalizing the cognitive domain score.
2. **Inactivity Timeout (MyCog 2.0 Standard):**
   - Following [MyCogTechSpec.md](MyCogTechSpec.md) Section 1.3 (line 72), $60\text{ seconds}$ of inactivity triggers a high-contrast prompt (*"Are you still there? Tap Continue to resume"*); an additional $60\text{ seconds}$ of inactivity ($120\text{ s}$ total) pauses and saves the session as `Incomplete (Timeout)`.

---

## 4. Pillar V (Renumbered Section 4): Longitudinal Dynamics & Standardized Regression-Based (SRB) Change (`F4`, `F13`)

### 4.1 Reconciling Multi-Day Learning Curves vs. Serial-Visit Alternate Forms (`F13`)
Earlier drafts conflated two distinct longitudinal paradigms that have opposite stimulus requirements:

| Paradigm | Time Window | Stimulus Rule | What Is Measured | Current Validation Status |
| :--- | :--- | :--- | :--- | :--- |
| **1. Meso-Scale Multi-Day Learning Burst** (BRANCH paradigm; Jutten et al., 2025, [MyCogTechSpec.md](MyCogTechSpec.md) ref `[32]`) | Days 1 to 5 (daily 3-min remote associative probe) | **Identical stimuli repeated across Days 1–5** | **Multi-Day Learning Curve ($\beta_{\text{learn}}$):** Relies *intentionally* on daily repetition/practice gain. Reduced multi-day learning slope was observed in $A^+T^+$ preclinical AD on the BRANCH face-name task. | Literature mechanism established on BRANCH; `[PROPOSED / UNVALIDATED]` for PostCircECD tasks. |
| **2. Macro-Scale Serial Clinical Visits** | Months $0, 6, 12, 18+$ (requiring **$K \ge 3$ visits** for any linear slope estimate, `F4`) | **Alternate Parallel Forms (Forms A, B, C)** | **Standardized Regression-Based Change ($z_{\text{SRB}}$):** Compares observed retest score against baseline-predicted retest score. | **Requires empirical IRT form-equating & test-retest study (Section 6).** Fresh/procedural stimuli do **not** automatically eliminate practice effects or guarantee form equivalence (`[MyCogTechSpec.md]` Section 4.3 notes PSM Forms A and B were non-equivalent in one sample). |

*Note (`F13`):* All claims that procedural generation drives practice effects to zero ($\Delta_{\text{practice}} \to 0$) or fixes low test-retest reliability ($\text{ICC}=0.49$ on Arranging Pictures) are **removed**. Uncalibrated procedural generation can introduce form-to-form difficulty variance; therefore, candidate parallel forms must undergo empirical psychometric equating (Section 6.2) before serial clinical use.

---

### 4.2 Standardized Regression-Based (SRB) Change Score (`F4` Mathematical Repair)

#### Why Simple-Difference RCI Fails High-Baseline Individuals (`F4`)
In the simple Jacobson-Truax / Chelune difference formula ($SE_{\text{diff}} = \text{SD}_0 \sqrt{2(1 - r_{xx})}$):
1. A drop of $\Delta Z = -1.60\text{ SD}$ reaches the $-1.96$ threshold **only if test-retest reliability $r_{xx} \ge 0.667$**. Across the published reliabilities in [MyCogTechSpec.md](MyCogTechSpec.md) (Sections 3.1, 3.3, 4.3), the drop required for $\text{RCI}_{\text{simple}} \le -1.96$ is:
   - At $r_{xx} = 0.49$ (Arranging Pictures): $\Delta Z_{\text{req}} = 1.96 \sqrt{2(1 - 0.49)} = \mathbf{1.98\text{ SD}}$ (a $1.60\text{ SD}$ drop yields $\text{RCI} = -1.58$, **not flagged**).
   - At $r_{xx} = 0.61$ (MyCog Mobile lower bound): $\Delta Z_{\text{req}} = \mathbf{1.73\text{ SD}}$ (a $1.60\text{ SD}$ drop yields $\text{RCI} = -1.81$, **not flagged**).
   - At $r_{xx} = 0.71$ (MyCog Mobile upper bound): $\Delta Z_{\text{req}} = \mathbf{1.49\text{ SD}}$ (a $1.60\text{ SD}$ drop yields $\text{RCI} = -2.10$, flagged).
   - At $r_{xx} = 0.78$ (NIH Toolbox PSM): $\Delta Z_{\text{req}} = \mathbf{1.30\text{ SD}}$ (a $1.60\text{ SD}$ drop yields $\text{RCI} = -2.41$, flagged).
   - At $r_{xx} = 0.92$ (MyCog 2.0 DCCS split-half / NIHTB DCCS ICC): $\Delta Z_{\text{req}} = \mathbf{0.78\text{ SD}}$ (a $1.60\text{ SD}$ drop yields $\text{RCI} = -4.00$, flagged).
2. **Regression to the Mean (RTM):** More fundamentally, simple-difference RCI omits regression to the mean. For a high-functioning adult starting at $Z_1 = +2.00$, the expected retest score with **zero true clinical change** (and zero practice gain) is $E[Z_2 \mid Z_1 = +2.00] = r_{xx} Z_1$:
   - At $r_{xx} = 0.49$, expected $Z_2 = +0.98$ (an apparent $-1.02\text{ SD}$ drop due purely to regression to the mean!).
   - At $r_{xx} = 0.61$, expected $Z_2 = +1.22$.
   - At $r_{xx} = 0.71$, expected $Z_2 = +1.42$.

#### Repaired Longitudinal Formula: Standardized Regression-Based (SRB) Change Score (Hammers et al., 2020)
Following Hammers et al. (2020), we replace simple-difference RCI with the **Standardized Regression-Based (SRB) Change Score**, which predicts retest score $\hat{Y}_2$ from baseline performance $Y_1$ (explicitly modeling regression to the mean $r_{xx} Y_1$, personalized practice effects, and demographic covariates $\mathbf{x}$):

$$\hat{Z}_2 = \mu_{\text{practice}}(\mathbf{x}) + r_{xx} Z_1$$
$$SE_{\text{est}} = \text{SD}_0 \sqrt{1 - r_{xx}^2}$$
$$z_{\text{SRB}} = \frac{Z_2 - \hat{Z}_2}{\sqrt{1 - r_{xx}^2}} \quad (\text{for standardized } \text{SD}_0 = 1)$$

**Verified Arithmetic for the Headline Example ($Z_1 = +2.00 \to Z_2 = +0.40$, assuming $\mu_{\text{practice}} = 0$):**

| Assumed Retest Reliability $r_{xx}$ | Source Example in `MyCogTechSpec.md` | Expected Retest $\hat{Z}_2 = r_{xx} Z_1$ (RTM Adjusted) | Prediction Error $SE_{\text{est}} = \sqrt{1 - r_{xx}^2}$ | Observed $z_{\text{SRB}}$ at $Z_2 = +0.40$ | Required $Z_2$ to Reach $z_{\text{SRB}} \le -1.96$ | Flagged at $Z_2 = +0.40$? |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **$0.49$** | Arranging Pictures (`§3.3`) | $+0.980$ | $0.8717$ | **$-0.665$** | $\le -0.729$ | **No** (Low $r_{xx}$ + strong RTM) |
| **$0.61$** | MyCog Mobile lower (`§4.3`) | $+1.220$ | $0.7924$ | **$-1.035$** | $\le -0.333$ | **No** |
| **$0.71$** | MyCog Mobile upper (`§4.3`) | $+1.420$ | $0.7042$ | **$-1.448$** | $\le +0.040$ | **No** |
| **$0.78$** | NIH Toolbox PSM (`§3.1`) | $+1.560$ | $0.6258$ | **$-1.854$** | $\le +0.333$ | **Borderline ($90\%$ CI)** |
| **$0.85$** | Target composite reliability | $+1.700$ | $0.5268$ | **$-2.468$** | $\le +0.667$ | **Yes ($p < 0.05$)** |
| **$0.92$** | NIH Toolbox DCCS (`§4.3`) | $+1.840$ | $0.3919$ | **$-3.674$** | $\le +1.072$ | **Yes ($p < 0.001$)** |

> [!NOTE]
> **Key Statistical Takeaway (`F4`):** Once regression to the mean is properly modeled via $z_{\text{SRB}}$, detecting a change from $Z_1 = +2.00$ to $Z_2 = +0.40$ at the $95\%$ level ($z_{\text{SRB}} \le -1.96$) **requires a task/composite test-retest reliability of at least $r_{xx} \ge 0.797$**. Subtests with low test-retest reliability ($r_{xx} = 0.49\text{–}0.71$) **cannot** reliably flag a $+2.00 \to +0.40$ change on a single retest; high-reliability composites ($r_{xx} \ge 0.85$) or multi-visit trajectories ($K \ge 3$ visits) are mathematically required. All uncited annualized velocity cutoffs (such as $-1.2\text{ SD/yr}$) are removed.

---

## 5. Norming, Form-Equating, and Clinical Validation Protocol (`F2`, `F13`, `G0`–`G4`)

Because no empirical norms or likelihood distributions currently exist for PostCircECD's tasks (`F2`), the project defines a formal Primary Scientific Estimand, an Immutable Event-Log Reproducibility Rule, a 5-stage Validation Gate Backbone (`G0`–`G4`), and strict UI display rules prior to validation:

### 5.1 Pre-Validation UI Display Rule & Participant-vs-Researcher View Separation (Implemented in Code Now)
1. **Participant-Facing View (Zero Test-Anxiety Rule):** During live testing, the participant sees **only** the calm Celestial Observatory / Plain Static task surface, warm non-judgmental progress feedback, and pause/resume controls—**never** numerical scores, reaction-time counters, error tallies, or diagnostic labels.
2. **Researcher / Judge Telemetry HUD:** Displays **raw measured performance metrics** (e.g., $\text{RCS}_{\text{pooled}}$ in $\text{correct/s}$, median RT in $\text{ms}$, $\text{SCER}$ with bootstrap 95% CI, raw sequence scores $S_{\text{exact}}/12$ and $S_{\text{adj}}/11$, pareidolia count, modality-discrepancy index) with the status badge: **`Normative Status: Raw Telemetry Only — No Normative Database Loaded`**.
3. **Heuristic Sandbox / Synthetic Persona Mode:** When a judge or researcher toggles the **Synthetic Persona Simulator** (or Heuristic Routing Preview), every chart, posterior bar, and exported summary is stamped **`SIMULATED / SYNTHETIC DEMO — HEURISTIC WEIGHTS (UNVALIDATED)`**.
4. **Immutable, Re-Scorable Trial Event Log (`src/eventLog/`):** Every session records an append-only, deterministic event stream (`TrialEvent[]`) containing the PRNG seed, `protocolManifestSha256`, hardware/display timing calibration (`G0`), and raw per-trial stimulus/response events. Every summary score in `src/psychometrics/` is a pure function of this event log and is verified by deterministic unit and property-based tests.

### 5.2 Primary Scientific Estimand & 5-Stage Validation Gate Backbone (`G0`–`G4`)
- **Primary Scientific Estimand:** The **Perceptually De-Confounded Modality Discrepancy**—defined as the standardized discrepancy between **auditory-verbal sequence recall (`S5.3`)** and **visual sequence recall (`S5.1`)**, conditioned on the participant's measured **perceptual crowding/integration threshold (`S1.1`–`S1.3`)** and **quadrant motor baseline (`S0.3`)**. This estimand tests whether apparent memory failure on standard visual screens (such as NIH Toolbox PSM) in PCA and LBD is driven by upstream visuoperceptual breakdown (`PMID: 42789112`) rather than hippocampal consolidation failure.
- **Validation Gate Backbone (`G0`–`G4`):**
  1. **Gate `G0` — Hardware, Frame-Time & Audio Latency Verification (Pre-Human Bench Gate):** Measures frame-interval jitter ($\Delta t_{\text{frame}}$), pointer event sampling rate, and Web Audio output latency on the target browser/device prior to `S0.3`, logging the device's minimum detectable timing resolution ($MDE_{\text{ms}}$) directly into the session header (`F15`).
  2. **Gate `G1` — Usability, Mode-Equivalence & 2-Week Test-Retest Study ($N = 120$ Healthy Adults Aged 45–80, IRB Required):** Evaluates System Usability Scale (S-SUS target $\ge 85$, benchmarked against MyCog 2.0's S-SUS of $91$; [MyCogTechSpec.md](MyCogTechSpec.md) Section 1.3), within-subject equivalence between `Plain Static Mode` and `3D Observatory Mode (Spatial Spotlight Lock)` (`F7`), 2-week test-retest reliability ($r_{xx}$ / ICC), and IRT linking of Alternate Forms A, B, and C (`F13`) to confirm which composites achieve $r_{xx} \ge 0.80$ for $z_{\text{SRB}}$ tracking (`F4`).
  3. **Gate `G2` — Known-Groups Specialist Clinic Case-Control Validation (STARD Reporting):** Blinded consensus clinical adjudication using **Crutch et al., 2017** (PCA), **McKeith et al., 2017** (DLB), **Gorno-Tempini et al., 2011** (lvPPA), and **NIA-AA** criteria (MCI/AD), supplemented by standard neuropsychological comparators (MoCA/ACE-III, VOSP, BNT, Rey-Osterrieth, TMT) and amyloid/tau/FDG-PET or CSF biomarkers (`F2`). Reports sensitivity, specificity, ROC AUC with 95% bootstrap CIs, calibration slope, and PPV/NPV across primary-care ($5\%\text{–}15\%$) and specialty-clinic ($30\%\text{–}50\%$) prevalences.
  4. **Gate `G3` — Continuous Regression-Based Norming ($N \ge 600$ Community Controls Stratified Across Ages 45–85+):** Establishes continuous regression-based demographic norms (adjusting for age, education, sex, and input device type: mouse, trackpad, touchscreen; Casaletto et al., 2015 `[23]`) and estimates the empirical domain factor loading matrix $\mathbf{W}$ and SRB prediction equations ($\hat{Y}_2$, $SE_{\text{est}}$).
  5. **Gate `G4` — Longitudinal SRB Change & Meso-Scale Burst Study ($K \ge 3$ Visits):** Validates empirically derived $z_{\text{SRB}}$ change norms and practice-effect offsets across multi-visit trajectories.

---

## 6. Intended Use, Privacy, Data Protection, and Regulatory Boundaries (`F3`)

1. **Intended Use Statement:**
   - PostCircECD is designed and distributed strictly as a **Research Prototype & Interactive Science Demonstration (`NOT A MEDICAL DEVICE — NOT FOR CLINICAL PRACTICE OR DIAGNOSTIC USE`)**.
2. **Local-First Architecture & Zero External Transmission by Default:**
   - **Default Mode (100% Local Deterministic):** All task rendering, reaction-time capture, kinematic calculation, MyCog RCS/3-MAD math, sequence scoring, and heuristic routing execute **entirely locally inside the user's browser**. Zero audio recordings, zero drawings, zero informant responses, and zero telemetry leave the device.
   - **Optional AI Adjunct Mode (Requires Explicit Researcher Configuration & Consent):**
     - Per the **Google Gemini API Additional Terms of Service (effective March 23, 2026)**, Gemini API services *"may not be used in clinical practice, to provide medical advice, or in any manner that is overseen by or requires clearance or approval from a medical device regulatory agency,"* and unpaid tier inputs may be reviewed by human reviewers and must not receive sensitive or personal information.
     - Therefore:
       1. **No Browser-Embedded API Keys:** The browser bundle contains **no hardcoded or client-exposed Gemini API key**. Any optional Gemini call (for synthetic/research testing of scene transcript parsing) must route through a local/server proxy or user-supplied research sandbox key with an explicit pre-session **Data Destination & Consent Gate** listing the exact endpoint and model ID.
       2. **No PHI / Identifiers:** The application never requests or stores names, dates of birth, medical record numbers, or contact details (accepting only an anonymous session code or synthetic preset ID).
3. **FDA Clinical Decision Support (CDS) Guidance Alignment (January 29, 2026, `F3`):**
   - FDA's January 2026 CDS guidance notes that software providing diagnostic or treatment recommendations to patients or caregivers meets the definition of a medical device, and clinician-facing Non-Device CDS must satisfy all four statutory criteria (including enabling the healthcare professional to independently review the basis for the software's output).
   - Accordingly, in prototype/research builds:
     - All outputs display **raw transparent task metrics, exact mathematical formulas, and recorded trial logs** rather than opaque black-box directives.
     - Prescriptive diagnostic/imaging order language is replaced with **transparent educational/research summaries of the observed task metrics**.
     - Every screen and exported/printed summary from a persona preset carries a bold, non-removable header and diagonal watermark:
       **`SIMULATED / SYNTHETIC DEMO PATIENT — FOR RESEARCH & SCIENCE FAIR DEMONSTRATION ONLY — NOT CLINICAL DATA`**.


---

## 7. Pillar VI: Dynamic "Living Research & Protocol Registry" (Powered by Google Science Literature & Clinical Trials Tooling)

### 7.1 Why the Architecture Must Be Dynamic as New Research Emerges
Neurodegenerative diagnostics and digital biomarkers are evolving rapidly—for example, in 2026 alone, new peer-reviewed studies have refined dorsal-vs-ventral visual stream ratios in LBD vs. AD, minor hallucination + pareidolia sensitivity in mild DLB, plasma p-tau217 + $\alpha$-synuclein longitudinal cognitive slopes, and 1-minute automated speech dysfluency models for PPA subtyping.

To ensure PostCircECD never becomes a static, frozen artifact, we architect a **Dynamic Research Protocol & Evidence Registry (`src/registry/livingEvidenceRegistry.json`)**:
1. **Declarative, Content-Hash–Locked Versioned Task & Rule Definitions:**
   - Every station parameter (trial count, stimulus difficulty ladder, crowding levels), every convergent-validation routing rule, every normative regression coefficient ($\beta_{\text{age}}, \beta_{\text{edu}}, r_{xx}$), and every literature-backed differential note is loaded from a versioned JSON schema (`ResearchProtocolManifest`).
   - **Pre-Registered Session Integrity Safeguard:** To prevent runtime edits from silently altering results between visits, every active `ResearchProtocolManifest` is frozen at session start and stamped with its canonical `protocolVersion` and `protocolManifestSha256` hash inside the session's immutable event log (`src/eventLog/`). Researchers can register **new versioned manifests** (e.g., `v2.1-experimental`) or preview how an existing event log re-scores under a newly published research module in the HUD without ever mutating the original recorded session.
2. **In-App "Living Evidence & Protocol Manager" Tab in the HUD:**
   - Allows researchers, clinicians, and Google Science judges to:
     - Inspect the **exact primary literature citations (PMID, PMCID, DOI, NCT ID, sample size $N$, and reported effect sizes/AUCs)** backing each station and metric.
     - **Toggle or Hot-Plug Emerging Research Modules at Runtime** (e.g., toggling the 2026 LBD Dorsal+Ventral Equivalence Rule or importing a newly published normative table or trial protocol JSON) and immediately see how the adaptive router and telemetry HUD respond.
3. **Automated Google Science Evidence Sync Pipeline (`scripts/sync-science-evidence.sh`):**
   - Integrates with the Google Science `literature-search-europepmc` (`scripts/europepmc_api.py`) and `clinical-trials-database` (`scripts/clinical_trials_api.py`) CLI tools to query Europe PMC and ClinicalTrials.gov for new open-access publications and clinical trials on PCA, DLB, lvPPA, and digital cognitive biomarkers, writing structured citation updates into `docs/evidence-feed.json`.

---

### 7.2 Primary Literature & Clinical Trials Grounding Table (Verified via Google Science `literature-search-europepmc` & `clinical-trials-database` on 2026-11-08)

All records below were retrieved directly via the Google Science `literature-search-europepmc` and `clinical-trials-database` skills on 2026-11-08:

| Target Domain / Station | Verified Primary Reference (PMID / PMCID / DOI / NCT) | Study Sample & Design | Key Empirical Finding Integrated into PostCircECD | Direct Link |
| :--- | :--- | :--- | :--- | :--- |
| **Dorsal vs. Ventral Stream in LBD vs. AD (`S1`, `S2`)** | **PMID: `42789112`** \| **PMCID: `PMC13615153`**<br>DOI: `10.1007/s00415-026-14166-5` (*J Neurol* 2026)<br>*Dorsal and ventral stream visuoperceptual processing deficits in Lewy body disease.* | $n=53$ LBD (asymptomatic to dementia) vs. $n=29$ AD | **1.** LBD shows comparable **ventral AND dorsal** stream impairments, whereas **ventral performance is relatively preserved compared to dorsal in AD**.<br>**2.** Visuoperceptual deficits in LBD explain a major fraction of variance on *visually presented* executive/attention tests, with larger effect sizes than non-visual tests (Digit Span, phonemic fluency)—directly validating our **Visual-vs-Auditory De-Confounding** architecture. | [Europe PMC](https://europepmc.org/article/MED/42789112) |
| **Pareidolia & Minor Hallucinations in Early DLB vs. AD (`S0.1`, `S2.1`)** | **PMID: `42524732`** \| **PMCID: `PMC13499909`**<br>DOI: `10.1177/13872877261468798` (*J Alzheimers Dis* 2026)<br>*Minor hallucinations as an early marker to differentiate dementia with Lewy bodies from Alzheimer's disease.* | $N=121$ mild stage (GDS 3–4), biomarker-supported ($60$ AD, $61$ DLB) | In mild stages where global cognition, executive, and language scores overlap, **episodic memory is significantly more impaired in AD across all recall measures**, whereas **Pareidolia Test responses and minor hallucinations ($54.1\%$ in DLB vs. $13.3\%$ in AD)** show the highest discriminative accuracy for early DLB. | [Europe PMC](https://europepmc.org/article/MED/42524732) |
| **Longitudinal Trajectories in Biomarker-Confirmed AD, DLB & Mixed Pathology (`Pillar V`)** | **PMID: `42385111`** \| **PMCID: `PMC13382850`**<br>DOI: `10.1212/wnl.0000000000218201` (*Neurology* 2026)<br>*Neuropsychological Profile and Cognitive Trajectories of Patients With Biomarker Evidence of Alzheimer Disease or Dementia With Lewy bodies.* | $N=350$ memory clinic patients with CSF/plasma p-tau217 & $\alpha$-synuclein biomarkers (AD $n=249$, AD+$\alpha$Syn $n=31$, DLB $n=33$, DLB+AD $n=37$) | Establishes distinct baseline and linear mixed-effects longitudinal slopes: AD declines more steeply than pure DLB in **memory ($\beta=0.184, p<0.01$) and language ($\beta=0.206, p<0.01$)**, whereas $\alpha$-synuclein co-pathology drives steeper visual attention/processing speed, constructional praxis, and ideomotor apraxia deficits. | [Europe PMC](https://europepmc.org/article/MED/42385111) |
| **Automated Picture-Description Speech Profiles in PPA (`S1.2`, `S4`)** | **PMID: `42545687`** \| **PMCID: `PMC13434971`**<br>DOI: `10.1001/jamaneurol.2026.2520` (*JAMA Neurol* 2026)<br>*Automated Speech Analysis to Identify Clinical, Anatomical, and Pathological Variants of Primary Progressive Aphasia.* | $N=214$ ($43$ controls, $50$ nfvPPA, $56$ lvPPA, $65$ svPPA; $64$ autopsy-confirmed) + 2-site external validation | From a **1–2 minute picture description recording**, 4–8 selected acoustic/linguistic features per variant achieved **$\text{AUC}=0.90$ ($95\%\text{ CI}: 0.83\text{–}0.97$)** in external validation and correlated with **left posterior temporal cortex & angular gyrus in lvPPA** and **bilateral anterior temporal lobes in svPPA**. | [Europe PMC](https://europepmc.org/article/MED/42545687) |
| **Why Off-the-Shelf ASR Fails on PPA & How Dysfluency Detection Works (`F8`, `S4`)** | **PMID: `42798815`** \| **PMCID: `PMC13613221`**<br>DOI: `10.1093/braincomms/fcag353` (*Brain Commun* 2026)<br>*Artificial intelligence-based speech error detection to differentiate primary progressive aphasia variants.* | $N=104$ ($40$ nfvPPA, $40$ lvPPA, $24$ controls) | Directly confirms our `F8` safeguard: **off-the-shelf ASR tools fail to detect PPA speech errors because they prioritize "fluent transcription."** Extracting phoneme/word-level insertions, replacements, deletions, prolongations, and repetitions separated PPA from controls ($p<0.006$) and nfvPPA from lvPPA ($\text{AUC}=0.798$). | [Europe PMC](https://europepmc.org/article/MED/42798815) |
| **PCA Diagnostic Delay & Simultanagnosia Assessment (`S1.1`, `S1.2`)** | **PMID: `42608702`** (`PMC13483831`, 2026) & **PMID: `40881893`** (`PMC12362458`, 2025) | Clinical case-series & perceptual analyses in PCA | Documents how routine cognitive screens miss early PCA visuoperceptual/simultanagnosia deficits and how hierarchical figure/plate tasks unmask global synthesis breakdown despite normal visual acuity. | [Europe PMC (42608702)](https://europepmc.org/article/MED/42608702) \| [Europe PMC (40881893)](https://europepmc.org/article/MED/40881893) |
| **Famous Face & Proper-Name Anatomical Network (`S5.2`)** | **PMID: `37051699`** (`PMC10171495`, *Hum Brain Mapp* 2023) & **PMID: `27298765`** (`PMC4893012`, *NeuroImage Clin* 2016) | Hierarchical face-shape, familiarity, and proper-name retrieval cohorts | Validates the anatomical dissociation between **ventral visual face-shape/identity perception**, **familiarity categorization**, and **left anterior temporal lobe / inferior longitudinal fasciculus proper-name lexical retrieval**. | [Europe PMC (37051699)](https://europepmc.org/article/MED/37051699) \| [Europe PMC (27298765)](https://europepmc.org/article/MED/27298765) |
| **MyCog Pragmatic Trial Reference (`MyCogTechSpec.md` `[12]`)** | **ClinicalTrials.gov: `NCT05607732`**<br>*Primary Care Detection of Cognitive Impairment Leveraging Health & Consumer Technologies in Underserved Communities: The MyCog Trial.* | 24 Oak Street Health practices ($45,257$ patients); Status verified live: `ACTIVE_NOT_RECRUITING` | Confirms ongoing pragmatic trial status of the 2-task MyCog baseline in primary care. | [ClinicalTrials.gov](https://clinicaltrials.gov/study/NCT05607732) |
