import type {
  ResearchProtocolManifest,
  SessionRecord,
  StationTelemetryMap,
  TrialEvent
} from '../types/sessionSchema';
import {
  computeGateG0TimingCalibration,
  computeNavonGlobalLocalMetrics,
  computeQuadrantKruskalWallis,
  computeSequenceAndAssociativeScores,
  computeWithinConditionSwitchMetrics,
  evaluateTwoLayerSyndromeRouter
} from '../psychometrics/psychometrics';
import { computeManifestSha256 } from '../registry/protocolRegistry';

export type PersonaPresetId =
  | 'LIVE_PARTICIPANT'
  | 'PERSONA_PCA_DORSAL'
  | 'PERSONA_DLB_PAREIDOLIA'
  | 'PERSONA_LVPPA_PHONOLOGICAL'
  | 'PERSONA_HIGH_BASELINE_AMNESTIC_SRB';

export interface PersonaPresetMeta {
  id: PersonaPresetId;
  label: string;
  subtitle: string;
  isSimulated: boolean;
  clinicalVignette: string;
  visitTrajectoryZ: { visit: number; month: number; zComposite: number; formId: 'Form A' | 'Form B' | 'Form C' }[];
  mesoBurst5DaySlope: number[];
}

export const PERSONA_PRESETS: PersonaPresetMeta[] = [
  {
    id: 'LIVE_PARTICIPANT',
    label: 'Live Interactive Playthrough (Participant Mode)',
    subtitle: 'Unnormed Raw Telemetry Only — Zero Test-Anxiety Participant View',
    isSimulated: false,
    clinicalVignette:
      'Live interactive session. Participant screen hides all numerical scores and error tallies; Researcher HUD displays raw measured metrics and 95% CIs.',
    visitTrajectoryZ: [
      { visit: 1, month: 0, zComposite: 0.0, formId: 'Form A' }
    ],
    mesoBurst5DaySlope: [1.0, 1.08, 1.15, 1.21, 1.25]
  },
  {
    id: 'PERSONA_PCA_DORSAL',
    label: '[SIMULATED] 62yo Architect — Dorsal PCA / Simultanagnosia Profile',
    subtitle: 'MoCA 27/30 Ceiling | Severe Global-Form & Visual Crowding Deficit | Intact Auditory Memory',
    isSimulated: true,
    clinicalVignette:
      'Synthetic demo trajectory modeling early Posterior Cortical Atrophy (Crutch et al., 2017; PMID: 42608702 & PMID: 42789112 [2026]). Exhibits disproportionate Navon global-integration breakdown (GLDI = 0.43) and crowding vulnerability (0.51), causing low visual sequence score (6/23) that is completely rescued on the non-visual Auditory-Verbal Sequence Control (S5.3 = 21/23, Modality Discrepancy = +15).',
    visitTrajectoryZ: [
      { visit: 1, month: 0, zComposite: 1.65, formId: 'Form A' },
      { visit: 2, month: 6, zComposite: 0.95, formId: 'Form B' },
      { visit: 3, month: 12, zComposite: 0.35, formId: 'Form C' }
    ],
    mesoBurst5DaySlope: [0.82, 0.85, 0.87, 0.88, 0.89]
  },
  {
    id: 'PERSONA_DLB_PAREIDOLIA',
    label: '[SIMULATED] 65yo Engineer — Early Lewy Body / Pareidolia & Fluctuation Profile',
    subtitle: 'Positive RBD/Illusion Screen | 5 Noise Pareidolias | High Raw-RT CoMAD (0.34)',
    isSimulated: true,
    clinicalVignette:
      'Synthetic demo trajectory modeling mild-stage Dementia with Lewy Bodies (McKeith et al., 2017; PMID: 42524732 & PMID: 42789112 [2026]). Exhibits 5 false-positive noise pareidolias on S2.1, marked trial-to-trial attentional fluctuation on S3.1 (raw-RT CoMAD = 0.34), coupled ventral+dorsal visuoperceptual slowing, and strong 4-AFC recognition cue rescue (Delta_cue = +0.58).',
    visitTrajectoryZ: [
      { visit: 1, month: 0, zComposite: 1.2, formId: 'Form A' },
      { visit: 2, month: 6, zComposite: 0.55, formId: 'Form B' },
      { visit: 3, month: 12, zComposite: -0.1, formId: 'Form C' }
    ],
    mesoBurst5DaySlope: [0.9, 0.88, 0.94, 0.86, 0.91]
  },
  {
    id: 'PERSONA_LVPPA_PHONOLOGICAL',
    label: '[SIMULATED] 61yo Professor — Logopenic PPA & Proper-Name Tip-of-the-Tongue Profile',
    subtitle: 'Phonological Echo Decay (S4.2) | Intact Semantic Face ID (8/8) with Phonemic Naming Rescue',
    isSimulated: true,
    clinicalVignette:
      'Synthetic demo trajectory modeling early lvPPA / left posterior perisylvian & temporal network dysfunction (Gorno-Tempini et al., 2011; PMID: 42545687 & PMID: 42798815 [2026]; PMID: 37051699). Exhibits length-dependent phonological repetition breakdown and prolonged inter-response pauses on S4, paired with the classic 3-step Famous-Face dissociation (Step 1 Semantic = 8/8, Step 2 Free Naming = 3/8, Step 3 Phonemic Cued = 8/8).',
    visitTrajectoryZ: [
      { visit: 1, month: 0, zComposite: 1.8, formId: 'Form A' },
      { visit: 2, month: 6, zComposite: 1.1, formId: 'Form B' },
      { visit: 3, month: 12, zComposite: 0.45, formId: 'Form C' }
    ],
    mesoBurst5DaySlope: [1.02, 1.06, 1.09, 1.11, 1.12]
  },
  {
    id: 'PERSONA_HIGH_BASELINE_AMNESTIC_SRB',
    label: '[SIMULATED] 62yo Executive — High-Baseline SRB Decline (Z1 = +2.00 -> Z2 = +0.40)',
    subtitle: 'Illustrates F4 Regression-to-the-Mean SRB Math & Low Recognition Cue Rescue (Delta_cue = +0.17)',
    isSimulated: true,
    clinicalVignette:
      'Synthetic demo trajectory modeling high-reserve amnestic consolidation decline (Hammers et al., 2020; PMID: 42385111 [2026]). Drops from +2.00 SD to +0.40 SD while remaining above the unadjusted population mean—demonstrating why high-reliability composites (r_xx >= 0.85, z_SRB = -2.468) and multi-visit slopes (K >= 3) are required, and exhibiting failure of 4-AFC recognition cue rescue (Delta_cue = +0.17).',
    visitTrajectoryZ: [
      { visit: 1, month: 0, zComposite: 2.0, formId: 'Form A' },
      { visit: 2, month: 6, zComposite: 0.4, formId: 'Form B' },
      { visit: 3, month: 12, zComposite: -0.25, formId: 'Form C' },
      { visit: 4, month: 18, zComposite: -0.8, formId: 'Form A' }
    ],
    mesoBurst5DaySlope: [0.95, 0.95, 0.96, 0.95, 0.95]
  }
];

export function buildPresetSessionRecord(
  presetId: PersonaPresetId,
  manifest: ResearchProtocolManifest
): SessionRecord {
  const meta = PERSONA_PRESETS.find((p) => p.id === presetId) ?? PERSONA_PRESETS[0];
  const manifestSha256 = computeManifestSha256(manifest);
  const g0 = computeGateG0TimingCalibration([16.65, 16.68, 16.62, 16.71], [16.66, 16.67], 18.4, true);

  if (presetId === 'LIVE_PARTICIPANT') {
    return {
      schemaVersion: '2.0.0',
      protocolVersion: manifest.protocolVersion,
      protocolManifestSha256: manifestSha256,
      sessionId: 'live-session-2026-11-08',
      prngSeed: 20261108,
      isSimulatedPreset: false,
      simulatedWatermark: 'NONE',
      intendedUseNotice: 'RESEARCH & EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE',
      presentationMode: 'OBSERVATORY_3D_SPOTLIGHT_LOCK',
      motionOff: true,
      startedAtIso: '2026-11-08T20:00:00.000Z',
      gateG0TimingCalibration: g0,
      sensoryChecks: {
        hearingCheckPassed: true,
        selectedVolumeGain: 0.85,
        colorPatternCheckPassed: true
      },
      practiceGates: {},
      trialEventLog: [],
      stationTelemetry: {},
      routingLog: [],
      normativeStatus: 'UNNORMED_RAW_TELEMETRY_ONLY'
    };
  }

  // Construct deterministic synthetic trial events and station telemetry for the selected persona
  const s03Trials = (['Q1', 'Q2', 'Q3', 'Q4'] as const).flatMap((q, qIdx) =>
    Array.from({ length: 8 }, (_, i) => ({
      quadrant: q,
      rtMs:
        presetId === 'PERSONA_PCA_DORSAL' && (q === 'Q2' || q === 'Q3')
          ? 640 + i * 18
          : 340 + qIdx * 6 + i * 5,
      euclideanDistancePx: 140,
      trajectoryLengthPx: presetId === 'PERSONA_PCA_DORSAL' ? 195 : 150
    }))
  );
  const s03Telemetry = computeQuadrantKruskalWallis(s03Trials, 44.5);

  const s11Trials = [
    ...Array.from({ length: 12 }, (_, i) => ({
      level: 'global' as const,
      crowded: i >= 6,
      rtMs:
        presetId === 'PERSONA_PCA_DORSAL'
          ? 1480 + i * 35
          : presetId === 'PERSONA_DLB_PAREIDOLIA'
          ? 980 + i * 20
          : 610 + i * 12,
      isCorrect: presetId === 'PERSONA_PCA_DORSAL' ? i < 6 : true
    })),
    ...Array.from({ length: 12 }, (_, i) => ({
      level: 'local' as const,
      crowded: i >= 6,
      rtMs:
        presetId === 'PERSONA_PCA_DORSAL' && i >= 6
          ? 1220 + i * 25
          : presetId === 'PERSONA_DLB_PAREIDOLIA'
          ? 920 + i * 18
          : 630 + i * 10,
      isCorrect: true
    }))
  ];
  const s11Telemetry = computeNavonGlobalLocalMetrics(s11Trials, 88.0);

  // S3.1 23 repeat + 7 switch trials
  const s31Trials = [
    ...Array.from({ length: 23 }, (_, i) => ({
      condition: 'repeat' as const,
      rtMs:
        presetId === 'PERSONA_DLB_PAREIDOLIA'
          ? i % 2 === 0
            ? 1420 + (i % 4) * 35
            : 490 + (i % 3) * 15
          : 580 + (i % 5) * 14,
      isCorrect: true
    })),
    ...Array.from({ length: 7 }, (_, i) => ({
      condition: 'switch' as const,
      rtMs:
        presetId === 'PERSONA_HIGH_BASELINE_AMNESTIC_SRB' || presetId === 'PERSONA_DLB_PAREIDOLIA'
          ? 1120 + i * 30
          : 780 + i * 20,
      isCorrect: i < 6
    }))
  ];
  const s31Telemetry = computeWithinConditionSwitchMetrics(s31Trials, 1000, 20261108, 16.67, 112.0);

  const s51Telemetry =
    presetId === 'PERSONA_PCA_DORSAL'
      ? computeSequenceAndAssociativeScores({
          placedOrder: [0, 2, 1, 5, 4, 3, 7, 6, 9, 8, 10, 11],
          sLetterFree: 4,
          sCuedTotal: 11,
          auditoryPlacedOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          famousStep1FreeNamingCorrect: 5,
          famousStep2aVisualSemanticCorrect: 5,
          famousStep2bVerbalClueCorrect: 8,
          famousStep3PhonemicCuedCorrect: 8
        })
      : presetId === 'PERSONA_HIGH_BASELINE_AMNESTIC_SRB'
      ? computeSequenceAndAssociativeScores({
          placedOrder: [0, 3, 2, 1, 6, 5, 4, 9, 8, 7, 11, 10],
          sLetterFree: 3,
          sCuedTotal: 5, // Low cued rescue -> primary consolidation deficit!
          auditoryPlacedOrder: [0, 3, 2, 1, 6, 5, 4, 9, 8, 7, 11, 10],
          famousStep1FreeNamingCorrect: 7,
          famousStep2aVisualSemanticCorrect: 8,
          famousStep2bVerbalClueCorrect: 8,
          famousStep3PhonemicCuedCorrect: 8
        })
      : presetId === 'PERSONA_LVPPA_PHONOLOGICAL'
      ? computeSequenceAndAssociativeScores({
          placedOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          sLetterFree: 6,
          sCuedTotal: 12,
          auditoryPlacedOrder: [0, 1, 2, 3, 5, 4, 6, 7, 9, 8, 10, 11],
          famousStep1FreeNamingCorrect: 3, // Anomia / tip-of-the-tongue on Step 1 Free Naming
          famousStep2aVisualSemanticCorrect: 8, // Step 2A Visual Semantic intact
          famousStep2bVerbalClueCorrect: 8, // Step 2B Non-Visual Verbal Clue intact
          famousStep3PhonemicCuedCorrect: 8 // Rescued by Step 3 Phonemic Cue!
        })
      : computeSequenceAndAssociativeScores({
          placedOrder: [0, 1, 2, 3, 4, 6, 5, 7, 8, 9, 10, 11],
          sLetterFree: 4,
          sCuedTotal: 11,
          auditoryPlacedOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          famousStep1FreeNamingCorrect: 7,
          famousStep2aVisualSemanticCorrect: 8,
          famousStep2bVerbalClueCorrect: 8,
          famousStep3PhonemicCuedCorrect: 8
        });

  const stationTelemetry: StationTelemetryMap = {
    'S0.1': {
      informantScore: 3,
      visualHallucinationRbdFlag: presetId === 'PERSONA_DLB_PAREIDOLIA',
      dressingTopoFlag: presetId === 'PERSONA_PCA_DORSAL'
    },
    'S0.3': s03Telemetry,
    'S1.1': s11Telemetry,
    'S1.2': {
      localDetailsNamed: 5,
      relationalLinksNamed: presetId === 'PERSONA_PCA_DORSAL' ? 1 : 4,
      globalThemeIdentified: presetId !== 'PERSONA_PCA_DORSAL',
      nonVerbalPointingScore: 3,
      elementCoverageRatio: presetId === 'PERSONA_PCA_DORSAL' ? 0.5 : 0.92,
      measuredDurationSec: 58.0
    },
    'S1.3': {
      arraysCompleted90s: presetId === 'PERSONA_PCA_DORSAL' ? 6 : 14,
      maxComplexityReached: presetId === 'PERSONA_PCA_DORSAL' ? 4 : 8,
      accuracyRate: presetId === 'PERSONA_PCA_DORSAL' ? 0.67 : 0.93,
      measuredDurationSec: 90.0
    },
    'S2.1': {
      totalNoisePlates: 20,
      pareidoliaFalsePositiveCount: presetId === 'PERSONA_DLB_PAREIDOLIA' ? 5 : 0,
      trueObjectHitCount: 8,
      measuredDurationSec: 72.0
    },
    'S2.2': {
      canonicalAccuracy: 8,
      foreshortenedAccuracy:
        presetId === 'PERSONA_PCA_DORSAL' || presetId === 'PERSONA_DLB_PAREIDOLIA' ? 4 : 7,
      invarianceRatio:
        presetId === 'PERSONA_PCA_DORSAL' || presetId === 'PERSONA_DLB_PAREIDOLIA' ? 0.5 : 0.875,
      measuredDurationSec: 64.0
    },
    'S3.1': s31Telemetry,
    'S3.2': {
      cubeVerticesCorrect: presetId === 'PERSONA_PCA_DORSAL' ? 3 : 8,
      clockNumbersAndHandsCorrect: presetId === 'PERSONA_PCA_DORSAL' ? 2 : 4,
      constructionCompositeScore: presetId === 'PERSONA_PCA_DORSAL' ? 5 : 12,
      measuredDurationSec: 75.0
    },
    'S3.3': {
      maxSpanReached: presetId === 'PERSONA_PCA_DORSAL' ? 4 : 7,
      totalCorrectTrials: presetId === 'PERSONA_PCA_DORSAL' ? 5 : 9,
      measuredDurationSec: 84.0
    },
    'S3.4': {
      fingerIdCorrect: presetId === 'PERSONA_PCA_DORSAL' ? 2 : 3,
      leftRightCrossedCorrect: presetId === 'PERSONA_PCA_DORSAL' ? 2 : 3,
      serial7SubtractionCorrect: presetId === 'PERSONA_PCA_DORSAL' ? 1 : 3,
      supramodalSpellingCorrect: 3,
      compositeCorrect: presetId === 'PERSONA_PCA_DORSAL' ? 8 : 12,
      measuredDurationSec: 65.0
    },
    'S4.1': {
      letterFValidCount: presetId === 'PERSONA_LVPPA_PHONOLOGICAL' ? 9 : 17,
      letterFMedianIriMs: presetId === 'PERSONA_LVPPA_PHONOLOGICAL' ? 4250 : 1850,
      sentenceRepetitionAccuracy: presetId === 'PERSONA_LVPPA_PHONOLOGICAL' ? 0.45 : 0.95,
      phonologicalQueueDecayFlag: presetId === 'PERSONA_LVPPA_PHONOLOGICAL',
      rawAudioRecorded: true,
      measuredDurationSec: 118.0
    },
    'S5.1': s51Telemetry
  };

  const trialEventLog: TrialEvent[] = s31Trials.map((t, idx) => ({
    eventId: `S3.1-T${String(idx + 1).padStart(3, '0')}`,
    trialIndex: idx,
    stationId: 'S3.1',
    condition: t.condition,
    practiceMode: false,
    presentationMode: 'OBSERVATORY_3D_SPOTLIGHT_LOCK',
    stimulusOnsetMs: idx * 1500,
    responseMs: idx * 1500 + t.rtMs,
    rtMs: t.rtMs,
    isCorrect: t.isCorrect,
    maxFrameDeltaMs: 16.7,
    technicalFrameDrop: false,
    modeSwitchInterrupted: false
  }));

  const twoLayerClassification = evaluateTwoLayerSyndromeRouter(
    stationTelemetry,
    true,
    manifest
  );

  return {
    schemaVersion: '2.0.0',
    protocolVersion: manifest.protocolVersion,
    protocolManifestSha256: manifestSha256,
    sessionId: `sim-${presetId.toLowerCase()}-2026`,
    prngSeed: 20261108,
    isSimulatedPreset: true,
    simulatedPresetName: meta.label,
    simulatedWatermark: 'SIMULATED / SYNTHETIC DEMO — NOT REAL PATIENT DATA',
    intendedUseNotice: 'RESEARCH & EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE',
    presentationMode: 'OBSERVATORY_3D_SPOTLIGHT_LOCK',
    motionOff: true,
    startedAtIso: '2026-11-08T20:00:00.000Z',
    gateG0TimingCalibration: g0,
    sensoryChecks: {
      hearingCheckPassed: true,
      selectedVolumeGain: 0.85,
      colorPatternCheckPassed: true
    },
    practiceGates: {
      'S3.1': {
        stationId: 'S3.1',
        block1Correct: 4,
        block2Correct: null,
        passed: true,
        excluded: false
      }
    },
    trialEventLog,
    stationTelemetry,
    routingLog: twoLayerClassification.triggeredRules,
    twoLayerClassification,
    normativeStatus: 'SIMULATED_HEURISTIC_SANDBOX'
  };
}
