export type PresentationMode =
  | 'OBSERVATORY_3D_SPOTLIGHT_LOCK'
  | 'PLAIN_STATIC_2D'
  | 'MIXED_MODES';

export type SingleTrialMode = 'OBSERVATORY_3D_SPOTLIGHT_LOCK' | 'PLAIN_STATIC_2D';

export type StationId =
  | 'S0.1'
  | 'S0.2'
  | 'S0.3'
  | 'S1.1'
  | 'S1.2'
  | 'S1.3'
  | 'S2.1'
  | 'S2.2'
  | 'S3.1'
  | 'S3.2'
  | 'S3.3'
  | 'S3.4'
  | 'S4.1'
  | 'S4.2'
  | 'S5.1'
  | 'S5.2'
  | 'S5.3';

export type SyndromeProfileId =
  | 'PROFILE_0_UNIMPAIRED'
  | 'PROFILE_1_DORSAL_STREAM_SPATIAL'
  | 'PROFILE_2_VENTRAL_PERCEPTUAL_CROWDING'
  | 'PROFILE_3_PARETO_FLUCTUATION_ATTENTION'
  | 'PROFILE_4_PHONOLOGICAL_LOOP_WORKING_MEMORY'
  | 'PROFILE_5_DYSEXECUTIVE_SET_SHIFTING'
  | 'PROFILE_6_HIPPOCAMPAL_CONSOLIDATION_AMNESTIC';

export interface PointerSample {
  tMs: number;
  x: number;
  y: number;
}

export interface TrialEvent {
  eventId: string;
  trialIndex: number;
  stationId: StationId;
  condition: string; // e.g., 'repeat', 'switch', 'Q1', 'Q2', 'Q3', 'Q4', 'center', 'global', 'local', 'crowded', 'uncrowded'
  practiceMode: boolean;
  presentationMode: SingleTrialMode;
  stimulusOnsetMs: number;
  responseMs: number;
  rtMs: number;
  isCorrect: boolean;
  maxFrameDeltaMs: number;
  technicalFrameDrop: boolean;
  modeSwitchInterrupted: boolean;
  pointerTrajectory?: PointerSample[];
  euclideanDistancePx?: number;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface GateG0TimingCalibration {
  frameIntervalMedianMs: number;
  frameIntervalIqrMs: number;
  pointerSampleHz: number;
  audioOutputLatencyMs: number;
  minimumDetectableEffectMs: number;
  shaderPrewarmCompleted: boolean;
}

export interface SensoryChecks {
  hearingCheckPassed: boolean;
  selectedVolumeGain: number;
  colorPatternCheckPassed: boolean;
}

export interface PracticeGateResult {
  stationId: StationId;
  block1Correct: number;
  block2Correct: number | null;
  passed: boolean;
  excluded: boolean;
  exclusionReason?: string;
}

export interface S03PointingTelemetry {
  rtMotorMedianMs: number;
  quadrantMediansMs: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number>;
  quadrantValidCounts: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number>;
  quadrantKruskalWallisH: number | null;
  quadrantKruskalWallisP: number | null;
  medianPathEfficiency: number;
  measuredDurationSec: number;
}

export interface S11NavonTelemetry {
  rcsGlobalPerSec: number;
  rcsLocalPerSec: number;
  rcsUncrowdedPerSec: number;
  rcsCrowdedPerSec: number;
  gldiRatio: number | null;
  crowdingCostRatio: number | null;
  measuredDurationSec: number;
}

export interface S12DioramaTelemetry {
  localDetailsNamed: number;
  relationalLinksNamed: number;
  globalThemeIdentified: boolean;
  nonVerbalPointingScore: number; // out of 3
  elementCoverageRatio: number;
  measuredDurationSec: number;
}

export interface S13FeatureMatchTelemetry {
  arraysCompleted90s: number;
  maxComplexityReached: number;
  accuracyRate: number;
  measuredDurationSec: number;
}

export interface S21PareidoliaTelemetry {
  totalNoisePlates: number;
  pareidoliaFalsePositiveCount: number;
  trueObjectHitCount: number;
  measuredDurationSec: number;
}

export interface S22SilhouetteTelemetry {
  canonicalAccuracy: number; // /8
  foreshortenedAccuracy: number; // /8
  invarianceRatio: number;
  measuredDurationSec: number;
}

export interface S32CubeClockTelemetry {
  cubeVerticesCorrect: number; // /8
  clockNumbersAndHandsCorrect: number; // /4
  constructionCompositeScore: number; // /12
  measuredDurationSec: number;
}

export interface S31SwitchboardTelemetry {
  totalTrials: number;
  validPooledCount: number;
  rcsPooledPerSec: number;
  validRepeatCount: number;
  validSwitchCount: number;
  rcsRepeatPerSec: number;
  rcsSwitchPerSec: number;
  scer: number | null;
  scerBootstrap95Ci: [number, number] | null;
  scerStatus: 'VALID' | 'INSUFFICIENT_TRIALS' | 'INDETERMINATE_ZERO_REPEAT_ACCURACY';
  comadRepeatRaw: number | null;
  technicalDropsExcluded: number;
  measuredDurationSec: number;
}

export interface S33NumberLadderTelemetry {
  maxSpanReached: number;
  totalCorrectTrials: number;
  measuredDurationSec: number;
}

export interface S34GerstmannTelemetry {
  fingerIdCorrect: number; // /3
  leftRightCrossedCorrect: number; // /3
  serial7SubtractionCorrect: number; // /3
  supramodalSpellingCorrect: number; // /3
  compositeCorrect: number; // /12
  measuredDurationSec: number;
}

export interface S4FluencyEchoTelemetry {
  letterFValidCount: number;
  letterFMedianIriMs: number;
  sentenceRepetitionAccuracy: number; // 0..1
  phonologicalQueueDecayFlag: boolean;
  rawAudioRecorded: boolean;
  measuredDurationSec: number;
}

export interface S5MemoryFamousTelemetry {
  sExact12: number;
  sAdjacent11: number;
  sComposite23: number;
  sLetterFree: number;
  sCuedTotal: number;
  pFree: number;
  pFreeWilson95Ci: [number, number];
  pCuedCorrected: number;
  pCuedWilson95Ci: [number, number];
  deltaCueGain: number;
  isCueGainInterpretable: boolean;
  auditorySequenceScore23: number | null;
  modalityDiscrepancyEstimand: number | null; // S_auditory - S_visual
  famousStep1FreeNamingCorrect: number; // /8 (Step 1: Free Visual Naming)
  famousStep2aVisualSemanticCorrect: number; // /8 (Step 2A: Visual Semantic / Era / Occupation)
  famousStep2bVerbalClueCorrect: number; // /8 (Step 2B: Non-Visual Verbal Clue Control — No Face)
  famousStep3PhonemicCuedCorrect: number; // /8 (Step 3: Phonemic Cue Rescue)
  measuredDurationSec: number;
}

export interface StationTelemetryMap {
  'S0.1'?: { informantScore: number; visualHallucinationRbdFlag: boolean; dressingTopoFlag: boolean };
  'S0.3'?: S03PointingTelemetry;
  'S1.1'?: S11NavonTelemetry;
  'S1.2'?: S12DioramaTelemetry;
  'S1.3'?: S13FeatureMatchTelemetry;
  'S2.1'?: S21PareidoliaTelemetry;
  'S2.2'?: S22SilhouetteTelemetry;
  'S3.1'?: S31SwitchboardTelemetry;
  'S3.2'?: S32CubeClockTelemetry;
  'S3.3'?: S33NumberLadderTelemetry;
  'S3.4'?: S34GerstmannTelemetry;
  'S4.1'?: S4FluencyEchoTelemetry;
  'S5.1'?: S5MemoryFamousTelemetry;
}

export interface RoutingLogEntry {
  ruleId: string;
  triggerStationId: StationId;
  targetProbeId: StationId;
  observedMetricSummary: string;
  thresholdTag: 'PROPOSED / UNVALIDATED — HEURISTIC ROUTING RULE';
  status: 'TRIGGERED_AND_QUEUED' | 'SUPPRESSED_MAX_2_PROBES_CAP' | 'SUPPRESSED_HEARING_CHECK_FAILED';
}

export interface LiteratureEvidenceItem {
  id: string;
  pmid?: string;
  pmcid?: string;
  doi?: string;
  nctId?: string;
  year: number;
  journalOrRegistry: string;
  title: string;
  sampleDescription: string;
  keyFindingSummary: string;
  stationIds: StationId[];
  url: string;
  enabledInRouter: boolean;
}

export interface ResearchProtocolManifest {
  protocolVersion: string;
  publishedDate: string;
  description: string;
  maxConditionalProbes: number;
  fwerAlpha: number;
  heuristics: {
    gldiAnomalyCutoff: number;
    crowdingRatioCutoff: number;
    scerElevatedCutoff: number;
    comadFluctuationCutoff: number;
    pareidoliaCountCutoff: number;
    deltaCueRescueCutoff: number;
    modalityDiscrepancyCutoff: number;
    enable2026LbdDorsalVentralRule: boolean;
    enable2026MildDlbPareidoliaBoost: boolean;
    enable2026PpaSpeechDysfluencyRule: boolean;
    enable2026BiomarkerSlopePriors: boolean;
  };
  srbReliabilityPriors: Record<string, number>;
  evidenceItems: LiteratureEvidenceItem[];
}

export interface TwoLayerRoutingResult {
  primaryLayer1Profile: SyndromeProfileId;
  layer1ProfileLabel: string;
  layer2DifferentialContext: string;
  triggeredRules: RoutingLogEntry[];
  activeEvidenceCitations: string[];
  holmBonferroniAdjustedFlags: {
    domain: string;
    rawPValueProxy: number;
    holmThreshold: number;
    flagged: boolean;
  }[];
}

export interface SessionRecord {
  schemaVersion: '2.0.0';
  protocolVersion: string;
  protocolManifestSha256: string;
  sessionId: string;
  prngSeed: number;
  isSimulatedPreset: boolean;
  simulatedPresetName?: string;
  simulatedWatermark: 'NONE' | 'SIMULATED / SYNTHETIC DEMO — NOT REAL PATIENT DATA';
  intendedUseNotice: 'RESEARCH & EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE';
  presentationMode: PresentationMode;
  motionOff: boolean;
  startedAtIso: string;
  gateG0TimingCalibration: GateG0TimingCalibration;
  sensoryChecks: SensoryChecks;
  practiceGates: Record<string, PracticeGateResult>;
  trialEventLog: TrialEvent[];
  stationTelemetry: StationTelemetryMap;
  routingLog: RoutingLogEntry[];
  twoLayerClassification?: TwoLayerRoutingResult;
  normativeStatus: 'UNNORMED_RAW_TELEMETRY_ONLY' | 'SIMULATED_HEURISTIC_SANDBOX';
}
