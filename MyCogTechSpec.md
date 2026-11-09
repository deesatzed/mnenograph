MyCog and MyCog Mobile: Technical and Psychometric Specification
Corrections to the premise and scope

MyCog is two self-administered NIH Toolbox–derived tasks on an iPad: Picture Sequence Memory (PSM) and Dimensional Change Card Sort (DCCS). It takes about 7 minutes and its results flow into the EHR. [1] MyCog Mobile is a separate smartphone app with four tasks: MyPictures, MyFaces, MySorting and MySequences. [2-3] All four task names you listed are real.

Several details in the requested outline do not match the published record:

    DCCS scoring in MyCog is not the NIH Toolbox two-vector algorithm. MyCog uses a rate-correct score: correct trials divided by total reaction time. [4]

    Adults get no pre-switch or post-switch block. Both MyCog and NIH Toolbox adults take only the 30-trial mixed block. [4-5]

    PSM in MyCog is scored per tile. Each placement is scored right or wrong, not by NIH Toolbox adjacent pairs with an IRT theta. A higher-order IRT composite was tested only in a machine-learning analysis. [4][6]

    MyFaces has no published link to amyloid or tau biomarkers. Its published formats are "First Letter" recall and "Name Matching." Face–occupation pairing, specific delay intervals and biomarker correlations have not been reported. [3][7]

    MySequences has no published adaptive-difficulty rules. The only adaptive feature described for MyCog Mobile is skipping the last task once earlier tasks give a confident classification. [8]

    No MyCog validation used PET, CSF, NIA-AA consensus adjudication, MoCA or MMSE as the reference standard. References were EHR or medical-record diagnoses, a recent comprehensive battery, or the Mini-Cog as a stand-in. [7][9-10]

    No published MyCog study reports PPV or NPV. Any PPV or NPV below is calculated here at assumed prevalences and labeled as such.

1. System overview and architecture
1.1 Platform comparison
Attribute	MyCog (in-clinic iPad)	MyCog Mobile (remote smartphone)	References
Tasks	PSM (episodic memory), DCCS (executive function)	MyPictures, MyFaces, MySorting, MySequences	[1-3]
Time	~7 min total; DCCS ~3 min	Total time not reported; adaptive skipping shortens it	[1, 4, 8]
Where it is taken	Waiting room, exam room, or wherever fits the workflow; self- or examiner-administered	Patient's own smartphone before the primary care visit	[1, 11]
Primary use	Annual Wellness Visit (AWV) cognitive component and any reported or suspected concern	Pre-visit remote screening	[1, 11-12]
EHR integration	Automatic Epic integration, SmartPhrases/SmartLinks, flowsheets, best-practice alerts, order sets	Not described in peer-reviewed reports	[1]
Scoring output	Logistic-regression probability built from memory accuracy and EF efficiency	6-predictor logistic model for MCI	[10, 13]

The published reports do not specify which smartphone operating systems MyCog Mobile supports. The construct-validation protocol used study-provided phones. [11] The parent Mobile Toolbox runs on both iOS and Android. [14]
1.2 EHR and clinical decision support workflow

In the DetectCID consortium, the workflow ran as follows: [1]

    Triage. At the AWV, Medicare patients answer brief questions about cognitive concerns. MyCog is given when the patient endorses a concern, a care partner raises one, or the PCP suspects impairment.

    Results to the chart. Results post to the chart automatically.

    Abnormal results. An abnormal result triggers a set of orders plus referral and diagnostic guidance.

Specific Epic features included: [1]

    SmartPhrases and SmartLinks

    Automated text reports inside the AWV template

    Flowsheets that track annual scores to show relative decline

    Best-practice alerts and automated referral orders

At federally qualified health centers without clear specialist pathways, the recommendations assumed workup would stay in primary care. [1] MyCog was one of three DetectCID paradigms, alongside UCSF's TabCAT-BHA and Einstein's 5-Cog. [1] It is in use at Oak Street Health, Access Community Health and Northwestern Medicine. [4]
1.3 Design accommodations for older adults

MyCog Mobile design work (Young et al.): [15]

    Input came from clinicians (n=5), administrators (n=3), cognitively healthy older adults (n=5) and an 11-member community panel.

    Prototype usability averaged 91 (SD 5.18) on the Simplified System Usability Scale (S-SUS).

    Older adults identified small text, unfamiliar interfaces and a need for support as barriers.

MyCog 2.0 changes (tablet redesign): [4]

    Short simplified instructions replace the demonstration videos.

    Interactive practice trials must be passed before continuing.

    Larger text, higher contrast and an introduction screen that sets expectations.

    Inactivity timeout: a pop-up after 1 minute, and the test ends after another minute.

1.4 Lineage from the NIH Toolbox Cognition Battery (NIHTB-CB)

MyCog (tablet). PSM and DCCS were shortened and adapted for self-administration; the NIH Toolbox versions require an examiner. [1] Richard Gershon led the NIH Toolbox and the NIA-funded Mobile Toolbox. Michael Wolf and Cindy Nowinski lead MyCog. Stephanie Young is first author on most validation papers. [13][16]

MyCog Mobile. Its tasks are smartphone adaptations of Mobile Toolbox measures. The Mobile Toolbox is an open-source smartphone library derived from the NIH Toolbox and normed against 2020 US Census targets. [16]
Construct	NIHTB-CB parent	Mobile Toolbox analog	MyCog (tablet)	MyCog Mobile	References
Cognitive flexibility	DCCS	Shape-Color Sorting	DCCS (30 mixed trials, rate-correct score)	MySorting	[2, 4-5, 14]
Episodic memory (sequence)	PSM	Arranging Pictures	PSM (12-image sequence)	MyPictures	[2, 4-5, 17]
Associative memory	— (FNAME was added in the ARMADA study)	Faces and Names	—	MyFaces	[2, 7, 18]
Working memory	List Sorting	Sequences	—	MySequences	[2, 5]
2. Executive function specifications
2.1 NIH Toolbox DCCS (parent standard)

Construct. Cognitive flexibility (set-shifting); the original paradigm is Zelazo's. [5]

Stimuli and trial flow:

    Two target images that differ on both dimensions sit at the bottom of the screen. [19]

    A cue word, "color" or "shape," appears at center, followed by a test image that matches one target on each dimension.

    The participant taps the target that matches on the cued dimension.

Block structure:

    Ages 3–7 receive pre-switch, post-switch and, if they pass, mixed blocks. [5]

    Ages 8 and older receive only the mixed block: 30 trials, 23 repeat and 7 switch in fixed pseudorandom positions. [5][20]

    Participants must get at least 3 of 4 practice trials correct to proceed. The test takes about 4 minutes. [19-20]

Two-vector scoring (computed score 0–10): [20]

    Accuracy vector (0–5). Correct responses out of 40, multiplied by 5/40. The 40 includes 10 credited pre-switch/post-switch points for anyone aged 8 or older.

    Reaction-time vector (0–5). Added only when accuracy exceeds 80%.

        Uses median RT on correct trials.

        Excludes trials under 100 ms or more than 3 SD from the individual's mean.

        Truncates the median to 500–3,000 ms, applies a log₁₀ transform, and rescales so faster responses score higher.

    Below 80% accuracy, the score is the accuracy vector alone. This creates a scoring discontinuity in low-accuracy populations: 37% of one Guatemalan cohort fell below the threshold. [20]

Normative conversions:

    Uncorrected standard score: mean 100, SD 15. Preferred for longitudinal tracking. [19][21]

    Age-corrected standard score: mean 100, SD 15, winsorized at ±3 SD. [19][22]

    Fully corrected T-score: mean 50, SD 10. Adjusted for age, sex, race/ethnicity and education (Casaletto et al.). [23]

    Version 3 re-norming: n=3,904, using continuous regression-based norming. [24]

2.2 MyCog DCCS (tablet)

Trial sequence (five blocks): [4]

    2 demonstration trials, matching by shape

    5 practice trials by shape, with feedback

    2 demonstration trials, matching by color

    5 practice trials by color, with feedback

    30 mixed test trials, pseudorandom

Reaction-time handling: [4]

    RT is the time from image onset to response.

    Outliers are trials under 100 ms, over 9 s, or more than 3 median absolute deviations from the person's median RT.

Scoring. The primary score is the rate-correct score: correct trials divided by total RT. It is a single efficiency index and does not use the 80% accuracy gate. [4]

Calibration. MyCog DCCS does not produce normative T-scores. Executive-function efficiency enters the logistic detection model directly. [13]

Version equivalence. MyCog 2.0 showed no differential item functioning in DCCS accuracy versus the original. Response times differed on 5 items, which were faster in version 2.0, so RT-based scores from the two versions are not directly interchangeable. [4]
2.3 MySorting (smartphone)

What is published:

    MySorting is a smartphone adaptation of DCCS by way of Mobile Toolbox Shape-Color Sorting. [2]

    It correlated ρ=0.55 with tablet DCCS. [3]

    Shape-Color Sorting showed very high internal consistency and strong 2-week test-retest reliability in three studies (N=92, 1,021 and 168). [14]

    Phone operating system (iOS vs Android) changed mean performance but not reliability or validity. [14]

    Administration setting had no effect on executive-function scores (remote n=701 vs in-person n=292). [25]

    MySorting was one of only two significant predictors of a failed Mini-Cog. [7]

What is not published:

    Specific MySorting countermeasures against cheating or response-validity checks.

    Correction for touchscreen latency.

The protections that are documented are the shared reaction-time outlier trimming used in the MyCog family, mandatory practice and timeouts. [4]
3. Memory specifications
3.1 NIH Toolbox PSM (parent standard)

Encoding and reconstruction:

    Thematically related pictures with no inherent order appear one at a time with spoken captions.

    Each picture then moves to a fixed position.

    The pictures are scrambled to the center, and the participant drags them back into order. [5][26]

Sequence length: 6–18 pictures depending on age. [19] Adult forms are commonly described as 15 pictures on trial 1 and 18 on trial 2. [21][27] The 2013 battery description listed shorter sequences for some age bands. [5] The test takes about 7–10 minutes. [5]

Scoring.

    Credit goes to each correctly ordered adjacent pair, regardless of absolute position. The adult maximum is 31 (14 plus 17). [27]

    Raw scores are converted to an IRT theta (mean 0, SD 1). [28-29]

    Test-retest reliability: ICC 0.78. [5]

    PSM correlates with CVLT-II and BVMT-R. [30]

3.2 MyCog PSM (tablet)

Task flow (as described in the MyCog 2.0 report): [4]

    A short animated demonstration of dragging.

    Free practice at dragging pictures.

    A 4-image "camping" practice sequence.

    A single 12-image live sequence ("a day with a friend"), which is scrambled and then reconstructed.

Scoring.

    Each of the 12 tile placements is scored correct or incorrect by exact position, not adjacent pair. [4]

    The primary score is the total of correct placements. [4]

    Yao et al. derived a two-parameter higher-order IRT composite combining PSM and DCCS. They found a fixed composite cutoff inadequate; models that added age performed better. [6]

3.3 MyPictures (smartphone)

Origin. MyPictures is the episodic-memory analog of PSM by way of Mobile Toolbox Arranging Pictures. [2]

Psychometrics in the MyCog Mobile cohort:

    ρ=0.52 with tablet PSM. [3]

    ρ=0.51 with Verbal Paired Associates immediate recall. [3]

Psychometrics of the parent task, Arranging Pictures: [17]

    Internal consistency 0.80–0.85.

    Convergent correlations ρ=0.44–0.76.

    2-week test-retest ICC only 0.49, with a practice gain of 3.21 points. This limits serial use without alternate forms.

Remote vs tablet. Remote MyPictures scores are higher (t(249)=2.98, p=0.004). [3] The larger cohort confirmed a small remote advantage on Picture Memory trial 1 (β=1.114) and more perfect memory scores remotely (partial η² ≤0.014). [25] This is the main published signal for possible unsupervised inflation.
3.4 MyFaces (associative memory, smartphone)

What is published:

    Origin. MyFaces is derived from Mobile Toolbox Faces and Names. [2]

    Scored components:

        A "First Letter" subtest: recall the first letter of the name paired with each face. [3]

        A "Name Matching" subtest: match faces to the first letters of their names. [7]

    Convergent validity. ρ=0.56 with Verbal Paired Associates immediate recall; small correlations with non-memory measures. [3]

    Predictive value. Name Matching was one of the two significant predictors of a failed Mini-Cog. [7]

    Setting effect. Remote First Letter scores are lower (β=−3.194), and education moderated this effect. [25]

Biomarkers. No MyFaces amyloid or tau data exist. [3] The face–name rationale comes from other instruments:

    The original FNAME name-recall score was associated with PiB amyloid burden (frontal R²=0.29); face–occupation recall was not. [31]

    In the ARMADA study, FNAME discriminated amyloid status only modestly (AUC 0.73–0.77), and only when combined with clinical status. [18]

    On the unsupervised BRANCH platform, the face–name task showed reduced multi-day learning only in A+T+ participants. Digit Signs was affected by amyloid alone. [32]

    Mobile Toolbox fluid composite scores were associated with tau PET in medial temporal and neocortical regions in the Harvard Aging Brain Study. [33]

3.5 MySequences (working memory, smartphone)

What is published:

    MySequences is derived from Mobile Toolbox Sequences, whose parent is NIHTB List Sorting. [2]

    NIHTB List Sorting mechanics (parent only): items are presented visually and aurally and repeated back in size order. There are one-category and two-category conditions, lists lengthen across trials, and the test stops after two failed trials of the same length. [5]

    Setting effect. In-person scores were higher in the construct study, but setting effects were not significant in the larger sample. [3][25]

What is not published: MySequences' own stimuli, span rules and adaptive-difficulty logic.
4. Validation methodology and results
4.1 Cohorts and reference standards
Study	Platform	N; population	Reference standard	References
Curtis 2023 pilot	MyCog	80 older adults from an existing cohort	Dementia or CI diagnosis in the record, or a comprehensive battery within 18 months	[9]
Yao 2023	MyCog	86	CI status; higher-order IRT plus machine learning	[6]
Young 2025 clinical validation	MyCog	145 (65 diagnosed CI, 80 cognitively normal), age ≥65	Clinical diagnosis	[13]
Young 2025 MyCog 2.0	MyCog 2.0	200; mean age 72.6; 78.5% White, 17.5% Black, 20% Hispanic	Construct validity against WMS-IV VPA, D-KEFS TMT and CWI, Mini-Cog word recall	[4]
Young 2024 pilot	MyCog Mobile	51, age ≥65, remote, tested twice	Reliability and usability	[2]
Young 2025 construct	MyCog Mobile	200, ages 65–87, 5 US sites	VPA, digit span, letter-number sequencing, CWI, TMT	[3]
Young 2024 exploratory	MyCog Mobile	200; 20 Mini-Cog positive	Mini-Cog ≤2 (proxy)	[7]
Young 2026 JAMIA Open	MyCog Mobile	277 (100 EHR-confirmed MCI, 177 normal aging)	EHR diagnosis of MCI	[10]

The original MyCog comparison sample was 93.9% White. [4] The MyCog Paradigm trial addresses diversity directly. It randomizes 24 Oak Street Health practices (45,257 patients) and focuses on low-income, Black and Hispanic older adults. Its primary outcome is detected or diagnosed cognitive impairment (NCT05607732). It is NIA-funded, and no results have been published. [12]
4.2 Diagnostic accuracy
Study	Target	AUC	Sensitivity	Specificity	Other	References
MyCog pilot	CI/dementia	Not reported	0.79	0.82	—	[9]
MyCog, Yao (random forest)	CI	—	0.758	0.951	Accuracy 0.902; precision 0.803	[6]
MyCog clinical validation	CI	0.890 (final logistic regression); 0.817–0.873 across models	0.723–0.831	0.788–0.912	Accuracy 0.807–0.828	[13]
MyCog Mobile vs Mini-Cog	Mini-Cog ≤2	0.83 (0.75–0.95)	0.76	0.88	Wide CIs; only 20 positives	[7]
MyCog Mobile JAMIA Open	MCI	Optimism-corrected 0.812	Not separately reported	Not separately reported	Accuracy 75% (69–80%); calibration slope 0.92	[10]
MyCog Mobile adaptive	MCI	ΔAUC 0.008 vs full battery	—	—	33% classified after the first step; 17% needed all tasks	[8]

Interpretation:

    Sensitivity and specificity depend on the chosen threshold, and no fixed public cutoff has been published. [6][13]

    No published MyCog study reports separate accuracy for MCI versus dementia.

    The MyCog Mobile MCI model added net benefit over refer-all and refer-none strategies on decision-curve analysis, capturing about 55% of the net benefit a perfect screener would provide. [10]

Calculated PPV/NPV (not published; Bayes' theorem at assumed prevalence):
Sensitivity/specificity used	Prevalence	PPV	NPV
MyCog pilot, 0.79/0.82[9]	10%	~33%	~97%
MyCog pilot, 0.79/0.82[9]	20%	~52%	~94%
MyCog Mobile, 0.76/0.88[7]	10%	~41%	~97%
MyCog Mobile, 0.76/0.88[7]	20%	~61%	~94%

At primary care prevalence, a negative result is more informative than a positive one. A positive result means diagnostic evaluation is needed, not a diagnosis.
4.3 Reliability

MyCog 2.0 (tablet): [4][4]

    Battery internal consistency ωt=0.84.

    DCCS split-half reliability 0.92.

MyCog Mobile:

    Internal consistency 0.73–0.91 in the pilot; test-retest reliability 0.61–0.71 at about 2 weeks. [2]

    Split-half reliability 0.71–0.89 in the construct study. [3]

NIH Toolbox reference values:

    DCCS ICC is high (0.92 in ABCD adolescents). PSM ICC is 0.78. [5][34]

    Composite test-retest reliability is 0.86–0.92. [35]

Alternate forms. No MyCog alternate-form equivalence data have been published. PSM forms A and B appeared non-equivalent in an intellectual-disability sample. [29] The practice effect on Arranging Pictures argues for caution when retesting annually. [17]
4.4 Construct validity

The MyCog 2.0 two-factor model (episodic memory and executive function) fit well: CFI 0.965, TLI 0.950, RMSEA 0.053. DCCS loaded 0.70 on executive function, PSM loaded 0.63 on memory, and the two factors correlated at 0.70. [4][4] MyCog Mobile replicated the two-factor structure. [3] NIH Toolbox composites correlate 0.78–0.90 with gold-standard composites. [35]

The MyCog 2.0 two-factor model figure shows the PSM and DCCS loadings alongside the reference neuropsychological measures.
Wiley Logo
Figure 3. Two‐factor model of MyCog 2.0.
Psychometric Properties of MyCog 2.0: A Human‐Centered Cognitive Screening Tool for Older Adults. Int J Methods Psychiatr Res. June 1, 2025.

Used under license from Wiley.
4.5 Demographic and device effects

MyCog and MyCog Mobile:

    Neither publishes demographically corrected T-scores.

    Age is handled as a model covariate: Yao's models added age to the IRT-derived scores. [6]

    Remote face-memory deficits were moderated by education. [25]

NIH Toolbox: regression-based fully corrected T-scores adjust for age, sex, race/ethnicity and education. After full correction, demographic associations are removed. [23]

Device and setting:

    Phone operating system shifts mean scores on Arranging Pictures (iOS 18.80 vs Android 17.11) and Shape-Color Sorting. Reliability and validity are unaffected. [14][17]

    Setting effects are small and specific to the memory subtests. [25]

    No touchscreen-latency calibration, screen-size adjustment or digital-literacy covariate has been published.

5. Summary

MyCog is a validated, EHR-integrated two-task tablet screener. Against clinical diagnosis it reached an AUC of 0.890. [13] MyCog Mobile adds face-name and working-memory tasks for remote use, with an optimism-corrected AUC of 0.812 for MCI using EHR-confirmed diagnoses. [10]

The main gaps are:

    No external validation cohorts.

    No biomarker-anchored reference standards.

    No published PPV or NPV, and no fixed cutoffs.

    No alternate-form data, so longitudinal use is uncertain.

    No results yet from the MyCog Paradigm pragmatic trial. [10][12]

Would it help to go further into how DetectCID's TabCAT-BHA and 5-Cog compare with MyCog on diagnostic accuracy and implementation outcomes in primary care?
1.
Lessons from Detecting Cognitive Impairment Including Dementia (DetectCID) in Primary Care.
Journal of Alzheimer's Disease : JAD. 2022. Bernstein Sideman A, Chalmer R, Ayers E, et al.
2.
Remote Self-Administration of Cognitive Screeners for Older Adults Prior to a Primary Care Visit: Pilot Cross-Sectional Study of the Reliability and Usability of the MyCog Mobile Screening App.
JMIR Formative Research. 2024. Young SR, Dworak EM, Byrne GJ, et al.
3.
MyCog Mobile Smartphone-Based Cognitive Screening System: A Cross-Sectional Construct Validation in a General Population Sample at Multiple Research Facilities in the USA.
BMJ Open. 2025. Young SR, Dworak EM, Byrne GJ, et al.
4.
Psychometric Properties of MyCog 2.0: A Human‐Centered Cognitive Screening Tool for Older Adults.
International Journal of Methods in Psychiatric Research. 2025. Young SR, Shono Y, Hauner KK, et al.
5.
Cognition Assessment Using the NIH Toolbox.
Neurology. 2013. Weintraub S, Dikmen SS, Heaton RK, et al.Observational

6.
Prediction of Cognitive Impairment Using Higher Order Item Response Theory and Machine Learning Models.
Frontiers in Psychiatry. 2023. Yao L, Shono Y, Nowinski C, et al.
7.
An Initial Exploratory Examination of the Sensitivity and Specificity of MyCog Mobile Using the Mini-Cog as a Proxy for Suspected Cognitive Impairment.
Journal of Primary Care & Community Health. 2024. Young SR, Dworak E, Byrne G, et al.
8.
Adaptive Testing for Smartphone-Based Cognitive Screening: Reducing Patient Burden While Maintaining Classification Accuracy.
Alzheimer's & Dementia. 2026. Young SR, Benavente JY, Dworak EM, Wolf MS, Nowinski CJ.
9.
Pilot Testing of the MyCog Assessment: Rapid Detection of Cognitive Impairment in Everyday Clinical Settings.
Gerontology & Geriatric Medicine. 2023. Curtis LM, Batio S, Benavente JY, et al.
10.
Clinical Validation of MyCog Mobile: Development of a Parsimonious and Clinically Interpretable Prediction Model for Mild Cognitive Impairment.
JAMIA Open. 2026. Young SR, Dworak EM, Hauner K, et al.
11.
Protocol for a Construct and Clinical Validation Study of MyCog Mobile: A Remote Smartphone-Based Cognitive Screener for Older Adults.
BMJ Open. 2024. Young SR, McManus Dworak E, Byrne GJ, et al.
12.
Primary Care Detection of Cognitive Impairment Leveraging Health and Consumer Technologies in Underserved US Communities: Protocol for a Pragmatic Randomised Controlled Trial of the MyCog Paradigm.
BMJ Open. 2023. Lovett R, Bonham M, Yoshino Benavente J, et al.
13.
Clinical Validation and Machine Learning Optimization of MyCog: A Self-Administered Cognitive Screener for Primary Care Settings.
Alzheimer's & Dementia. 2025. Young SR, Shono Y, Hauner K, et al.
14.
Mobile Toolbox (MTB) Remote Measures of Executive Function and Processing Speed: Development and Validation.
Journal of the International Neuropsychological Society : JINS. 2024. Novack MA, Young SR, Dworak EM, et al.Observational
15.
Remote Cognitive Screening of Healthy Older Adults for Primary Care With the MyCog Mobile App: Iterative Design and Usability Evaluation.
JMIR Formative Research. 2023. Young SR, Lattie EG, Berry ABL, et al.
16.
The Mobile Toolbox for monitoring cognitive function.
The Lancet. Neurology. 2022. Gershon RC, Sliwinski MJ, Mangravite L, et al.Opinion
17.
Development and Validation of an Episodic Memory Measure in the Mobile Toolbox (MTB): Arranging Pictures.
Journal of Clinical and Experimental Neuropsychology. 2024. Young SR, Dworak EM, Novack MA, et al.Observational
18.
Face Name Associative Memory Exam and Biomarker Status in the ARMADA Study: Advancing Reliable Measurement in Alzheimer's Disease and Cognitive Aging.
Alzheimer's & Dementia. 2023. Rentz DM, Klinger HM, Samaroo A, et al.
19.
A pilot study of remote cognitive assessment in children using the NIH toolbox participant/examiner app.
Scientific Reports. 2025. Ece B, Ho EH, Tuladhar Z, et al.
20.
Contrasting speed and accuracy approaches to measure executive functions in three low-and middle-income countries.
PloS One. 2022. Wray C, Kowalski AJ, Mpondo F, et al.
21.
Utility of the iPad NIH Toolbox Cognition Battery in a clinical trial of older adults.
Journal of the American Geriatrics Society. 2021. Parsey CM, Bagger JE, Trittschuh EH, Hanson AJ.Clinical Trial
22.
Evaluation of the NIH Toolbox Cognition Battery in Adolescents with HIV Infection in Zimbabwe.
AIDS and Behavior. 2026. Shears A, Dzavakwa N, Redzo N, et al.
23.
Demographically Corrected Normative Standards for the English Version of the NIH Toolbox Cognition Battery.
Journal of the International Neuropsychological Society : JINS. 2015. Casaletto KB, Umlauf A, Beaumont J, et al.
24.
Norming of the NIH Toolbox Cognition Battery Version 3.
Assessment. 2026. Ho EH, Han YC, LaForte EM, et al.
25.
A Comparison of High Performance on Remote vs. In-Person Self- Administered Neuropsychological Measures: The Mobile Toolbox and MyCog Mobile.
Journal of Clinical and Experimental Neuropsychology. 2026. Young SR, Zhang M, Dworak EMM, et al.
26.
Associations Between Episodic Memory and Hippocampal Volume in Late Adulthood.
Hippocampus. 2025. Aghjayan SL, Polk SE, Ripperger HS, et al.
27.
The structural brain network topology of episodic memory.
PloS One. 2021. Matyi MA, Spielberg JM.
28.
Sequence of decline on the NIH-toolbox cognitive battery in a predominantly Latino sample with autosomal dominant Alzheimer's disease.
Journal of Alzheimer's Disease : JAD. 2025. Petkus AJ, Sonti AN, Montoya L, et al.Observational
29.
Validation of the NIH Toolbox Cognitive Battery in Intellectual Disability.
Neurology. 2020. Shields RH, Kaat AJ, McKenzie FJ, et al.Observational

30.
Measuring Episodic Memory Across the Lifespan: NIH Toolbox Picture Sequence Memory Test.
Journal of the International Neuropsychological Society : JINS. 2014. Dikmen SS, Bauer PJ, Weintraub S, et al.
31.
Face-Name Associative Memory Performance Is Related to Amyloid Burden in Normal Elderly.
Neuropsychologia. 2011. Rentz DM, Amariglio RE, Becker JA, et al.
32.
Detecting early cognitive deficits in preclinical Alzheimer’s disease using a remote digital multi-day learning paradigm.
NPJ Digital Medicine. 2025. Jutten RJ, Soberanes D, Molinare CP, et al.
33.
The Mobile Toolbox for Remote, Self-Administered Cognitive Assessment in Older Adults: Associations With in-Clinic Cognitive Testing and Alzheimer's Disease Biomarkers.
Alzheimer's & Dementia. 2025. Jutten RJ, Burling JE, Slade E, et al.
34.
Executive functions and psychopathology: A transdiagnostic network analysis.
PloS One. 2025. Ganai UJ, Bhushan B.
35.
Reliability and Validity of Composite Scores From the NIH Toolbox Cognition Battery in Adults.
Journal of the International Neuropsychological Society : JINS. 2014. Heaton RK, Akshoomoff N, Tulsky D, et al.
