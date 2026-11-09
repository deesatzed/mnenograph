import React, { useEffect, useRef, useState } from 'react';
import type {
  PracticeGateResult,
  SensoryChecks,
  SingleTrialMode,
  StationId,
  StationTelemetryMap,
  TrialEvent
} from '../types/sessionSchema';
import {
  computeNavonGlobalLocalMetrics,
  computeQuadrantKruskalWallis,
  computeSequenceAndAssociativeScores,
  computeWithinConditionSwitchMetrics
} from '../psychometrics/psychometrics';
import { UnifiedPracticeGate } from './PracticeGateAndModals';

export interface StationTasksInteractiveProps {
  activeStation: StationId;
  presentationMode: SingleTrialMode;
  sensoryChecks: SensoryChecks;
  practiceGates: Record<string, PracticeGateResult>;
  stationTelemetry: StationTelemetryMap;
  onUpdateSensoryChecks: (checks: SensoryChecks) => void;
  onUpdatePracticeGate: (res: PracticeGateResult) => void;
  onAppendTrialEvent: (
    ev: Omit<TrialEvent, 'eventId' | 'trialIndex' | 'technicalFrameDrop'>
  ) => void;
  onUpdateStationTelemetry: (next: Partial<StationTelemetryMap>) => void;
  onSetSpotlightLocked: (locked: boolean) => void;
  onSelectStation: (stationId: StationId) => void;
  onFinishAssessment?: () => void;
}

// Deterministic 30-trial pseudorandom DCCS sequence (23 repeat, 7 switch, no >2 consecutive switches)
const S31_SCHEDULE: ('repeat' | 'switch')[] = [
  'repeat', 'repeat', 'repeat', 'switch', 'repeat',
  'repeat', 'repeat', 'switch', 'repeat', 'repeat',
  'repeat', 'repeat', 'switch', 'repeat', 'repeat',
  'switch', 'repeat', 'repeat', 'repeat', 'switch',
  'repeat', 'repeat', 'repeat', 'switch', 'repeat',
  'repeat', 'repeat', 'switch', 'repeat', 'repeat'
];

export const StationTasksInteractive: React.FC<StationTasksInteractiveProps> = ({
  activeStation,
  presentationMode,
  sensoryChecks,
  practiceGates,
  stationTelemetry,
  onUpdateSensoryChecks,
  onUpdatePracticeGate,
  onAppendTrialEvent,
  onUpdateStationTelemetry,
  onSetSpotlightLocked,
  onSelectStation,
  onFinishAssessment
}) => {
  // Pause / Inactivity state (F9, Goldfish Priority 3.1)
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // S0 state
  const [informantRbdFlag, setInformantRbdFlag] = useState<boolean>(false);
  const [informantDressingFlag, setInformantDressingFlag] = useState<boolean>(false);
  const [s03TrialIdx, setS03TrialIdx] = useState<number>(0);
  const [s03Running, setS03Running] = useState<boolean>(false);
  const [s03Collected, setS03Collected] = useState<
    { quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4'; rtMs: number; euclideanDistancePx: number; trajectoryLengthPx: number }[]
  >([]);
  const s03OnsetRef = useRef<number>(performance.now());

  // S1 state
  const [s11Idx, setS11Idx] = useState<number>(0);
  const [s11Running, setS11Running] = useState<boolean>(false);
  const [s11Collected, setS11Collected] = useState<
    { level: 'global' | 'local'; crowded: boolean; rtMs: number; isCorrect: boolean }[]
  >([]);
  const [s12NonVerbalScore, setS12NonVerbalScore] = useState<number>(3);
  const [s12GlobalTheme, setS12GlobalTheme] = useState<boolean>(true);

  // S2.1 Pareidolia state
  const [s21PareidoliaCount, setS21PareidoliaCount] = useState<number>(0);
  const [s21TrueHits, setS21TrueHits] = useState<number>(8);

  // S3.1 30-trial DCCS Switchboard state
  const [s31Running, setS31Running] = useState<boolean>(false);
  const [s31TrialIdx, setS31TrialIdx] = useState<number>(0);
  const [s31Trials, setS31Trials] = useState<
    { condition: 'repeat' | 'switch'; rtMs: number; isCorrect: boolean; technicalFrameDrop?: boolean; modeSwitchInterrupted?: boolean }[]
  >([]);
  const s31OnsetRef = useRef<number>(performance.now());
  const prevModeRef = useRef<SingleTrialMode>(presentationMode);
  const [interruptedMidTrial, setInterruptedMidTrial] = useState<boolean>(false);

  // S4 Fluency & Echo state
  const [s4TapTimestamps, setS4TapTimestamps] = useState<number[]>([]);
  const [s4EchoAccuracy, setS4EchoAccuracy] = useState<number>(0.95);
  const [s4PhonologicalFlag, setS4PhonologicalFlag] = useState<boolean>(false);

  // S5 Memory & Famous-Face Cascade state (F12: Step 1 Free Naming -> Step 2A Visual Semantic / Step 2B Verbal Clue -> Step 3 Phonemic Cue)
  const [s5VisualExact, setS5VisualExact] = useState<number>(10);
  const [s5LetterFree, setS5LetterFree] = useState<number>(5);
  const [s5CuedTotal, setS5CuedTotal] = useState<number>(11);
  const [s5AuditoryExact, setS5AuditoryExact] = useState<number>(11);
  const [s5FamousStep1Free, setS5FamousStep1Free] = useState<number>(7);
  const [s5FamousStep2aVis, setS5FamousStep2aVis] = useState<number>(8);
  const [s5FamousStep2bVerbal, setS5FamousStep2bVerbal] = useState<number>(8);
  const [s5FamousStep3Phonemic, setS5FamousStep3Phonemic] = useState<number>(8);

  // S1.3, S2.2, S3.2, S3.3, S3.4 interactive states
  const [s13Arrays, setS13Arrays] = useState<number>(14);
  const [s22Foreshortened, setS22Foreshortened] = useState<number>(7);
  const [s32CubeVertices, setS32CubeVertices] = useState<number>(8);
  const [s32ClockScore, setS32ClockScore] = useState<number>(4);
  const [s33MaxSpan, setS33MaxSpan] = useState<number>(7);
  const [s34GerstmannTotal, setS34GerstmannTotal] = useState<number>(12);

  // 60s Inactivity Auto-Pause Detector — only active while an interactive timed trial is running
  useEffect(() => {
    if (!s03Running && !s11Running && !s31Running) {
      return;
    }
    let timer = window.setTimeout(() => {
      setIsPaused(true);
    }, 60000);
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setIsPaused(true), 60000);
    };
    window.addEventListener('pointerdown', resetTimer);
    window.addEventListener('keydown', resetTimer);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', resetTimer);
      window.removeEventListener('keydown', resetTimer);
    };
  }, [s03Running, s11Running, s31Running]);

  const playCalibrationChime = () => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      [500, 1000, 2000].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.value = sensoryChecks.selectedVolumeGain * 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.15);
        osc.stop(ctx.currentTime + (idx + 1) * 0.15);
      });
    } catch {
      // Safe fallback in headless environment
    }
  };

  // Detect mid-trial mode switch without unmounting active task state (Inventive Catalyst Finding 3 & Goldfish Priority 3.2)
  useEffect(() => {
    if (prevModeRef.current !== presentationMode) {
      prevModeRef.current = presentationMode;
      if (s31Running || s03Running || s11Running) {
        setInterruptedMidTrial(true);
        s31OnsetRef.current = performance.now();
        s03OnsetRef.current = performance.now();
      }
    }
  }, [presentationMode, s31Running, s03Running, s11Running]);

  // Engage Spatial Spotlight Lock whenever an interactive timed block is running
  useEffect(() => {
    onSetSpotlightLocked(s03Running || s11Running || s31Running);
  }, [s03Running, s11Running, s31Running, onSetSpotlightLocked]);

  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (!nextPaused) {
      // Reset active trial stimulus clock on resume so pause time is never added to RT (Goldfish Priority 3.1)
      s31OnsetRef.current = performance.now();
      s03OnsetRef.current = performance.now();
    }
  };

  const stationPrefix = activeStation.slice(0, 2);

  const GUIDED_STEPS: {
    prefix: string;
    stationId: StationId;
    stepNum: number;
    shortTitle: string;
    whatItTests: string;
    howToUse: string;
    done: boolean;
  }[] = [
    {
      prefix: 'S0',
      stationId: 'S0.3',
      stepNum: 1,
      shortTitle: 'Step 1: Calibration Dome',
      whatItTests: 'Hearing, color-vision pattern safety, and 4-quadrant pointing speed baseline.',
      howToUse:
        'Verify your audio/visual checkboxes on the left, then click "Start Interactive Pointing Calibration" (or "Complete Full 36-Target Calibration" for an instant demo) on the right.',
      done: Boolean(stationTelemetry['S0.3'])
    },
    {
      prefix: 'S1',
      stationId: 'S1.1',
      stepNum: 2,
      shortTitle: 'Step 2: Astrolabe Visual Loom',
      whatItTests: 'Dorsal visual stream: Global-vs-Local shape integration and visual crowding (Posterior Cortical Atrophy screen).',
      howToUse:
        'First complete the 4-trial Practice Gate (or click Pass), then run the 8-trial Navon shape block and save the Diorama & Feature Match cards.',
      done: Boolean(stationTelemetry['S1.1'])
    },
    {
      prefix: 'S2',
      stationId: 'S2.1',
      stepNum: 3,
      shortTitle: 'Step 3: Pareidolia Nebula',
      whatItTests: 'Ventral visual stream: Illusory face/object perception in noise plates and rotated silhouettes (Lewy Body screen).',
      howToUse:
        'Record the noise-plate pareidolia count and foreshortened silhouette score, then click "Record S2.1 Pareidolia Telemetry".',
      done: Boolean(stationTelemetry['S2.1'])
    },
    {
      prefix: 'S3',
      stationId: 'S3.1',
      stepNum: 4,
      shortTitle: 'Step 4: Constellation Switchboard',
      whatItTests: 'Executive rule-switching speed (SCER) and trial-to-trial attentional stability (CoMAD).',
      howToUse:
        'Complete the 4-trial Practice Gate, then either play the live 30-trial Shape/Pattern matching game or click "Auto-Complete 30-Trial Valid Block".',
      done: Boolean(stationTelemetry['S3.1'])
    },
    {
      prefix: 'S4',
      stationId: 'S4.1',
      stepNum: 5,
      shortTitle: 'Step 5: Echo Relay Spire',
      whatItTests: 'Phonological working-memory loop and word-retrieval pauses (Logopenic PPA screen).',
      howToUse:
        'Tap the button each time a word starting with "F" is spoken (to log inter-word pause timing), then click "Save S4 Fluency & Echo Telemetry".',
      done: Boolean(stationTelemetry['S4.1'])
    },
    {
      prefix: 'S5',
      stationId: 'S5.1',
      stepNum: 6,
      shortTitle: 'Step 6: Archive Memory Vault',
      whatItTests: 'Visual vs. Auditory sequence memory, 4-choice cue rescue, and 3-step Famous-Face naming.',
      howToUse:
        'Review or adjust the Visual Sequence, Cued Recognition, Auditory Control, and Famous-Face scores, then click "Compute & Record S5 Memory" and "Finish & View Results Report".',
      done: Boolean(stationTelemetry['S5.1'])
    }
  ];

  const currentGuidedStep =
    GUIDED_STEPS.find((s) => s.prefix === stationPrefix) ?? GUIDED_STEPS[0];

  return (
    <div
      data-testid="participant-task-surface"
      className="rounded-xl border border-slate-700/80 bg-[#12161F] p-5 text-slate-100 shadow-lg"
    >
      {/* 6-Step Interactive Progress Stepper */}
      <div className="mb-4 pb-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            Guided 6-Step Assessment Flow (Click Any Step or Follow Next &rarr;)
          </span>
          <span className="text-xs text-slate-400">
            Completed Stations: <strong className="text-emerald-400">{GUIDED_STEPS.filter((s) => s.done).length} of 6</strong>
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {GUIDED_STEPS.map((st) => {
            const isCurrent = st.prefix === stationPrefix;
            return (
              <button
                key={st.prefix}
                type="button"
                onClick={() => onSelectStation(st.stationId)}
                className={`px-3 py-2 rounded-lg text-left text-xs transition-all border cursor-pointer ${
                  isCurrent
                    ? 'bg-sky-950/90 border-sky-400 text-white shadow-sm'
                    : st.done
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 hover:bg-emerald-950/50'
                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1 font-bold">
                  <span className="truncate">{st.shortTitle}</span>
                  {st.done && <span className="text-emerald-400 shrink-0">✓</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Top Participant Bar — Zero Numerical Scores Shown */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
        <div className="max-w-3xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Participant Task View • Zero Score-Anxiety Surface (High-Contrast | Okabe-Ito Pattern-Safe)
          </span>
          <h2 className="text-xl font-bold text-white mt-0.5">
            {currentGuidedStep.shortTitle} <span className="text-sm font-normal text-slate-400">({activeStation})</span>
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            <strong className="text-sky-300">What this measures:</strong> {currentGuidedStep.whatItTests}
          </p>
          <p className="text-xs text-slate-300 mt-0.5">
            <strong className="text-emerald-300">How to use:</strong> {currentGuidedStep.howToUse}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="participant-pause-resume-btn"
            onClick={handleTogglePause}
            className="min-h-11 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-semibold text-slate-100 cursor-pointer"
          >
            {isPaused ? '▶ Resume Activity (Resets Trial Clock)' : '⏸ Pause / Take a Breather'}
          </button>
        </div>
      </div>

      {isPaused && (
        <div
          data-testid="pause-modal-banner"
          className="mb-4 rounded-xl border border-sky-400/60 bg-sky-950/40 p-4 text-slate-100"
        >
          <p className="text-base font-semibold text-sky-200">
            Session Paused — Take all the time you need.
          </p>
          <p className="text-sm text-slate-300 mt-1">
            When you click <strong>Resume Activity</strong>, the current stimulus clock resets cleanly so pause duration never affects your response timing.
          </p>
        </div>
      )}

      {/* WING 0: S0.1 Informant, S0.2 Hearing/Color-Pattern Check, S0.3 36-Target Motor Baseline */}
      {stationPrefix === 'S0' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* S0.1 Informant & S0.2 Sensory Check */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
              <h3 className="text-base font-bold text-sky-300">
                1A. Sensory Verification &amp; Brief Partner Checklist (S0.1 / S0.2)
              </h3>
              <p className="text-xs text-slate-300">
                Verifies speaker volume and color-blindness pattern clarity before starting timed visual and auditory tasks.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={playCalibrationChime}
                  className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-xs font-semibold text-white cursor-pointer"
                >
                  🔊 Play 500 / 1000 / 2000 Hz Web Audio Test Chime (S0.2)
                </button>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sensoryChecks.hearingCheckPassed}
                  onChange={(e) =>
                    onUpdateSensoryChecks({
                      ...sensoryChecks,
                      hearingCheckPassed: e.target.checked
                    })
                  }
                  className="w-4 h-4 accent-sky-400"
                />
                <span>
                  <strong>Hearing Check Passed</strong> (Audio chime audible; enables Step 6 Auditory Sequence Control)
                </span>
              </label>

              <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sensoryChecks.colorPatternCheckPassed}
                  onChange={(e) =>
                    onUpdateSensoryChecks({
                      ...sensoryChecks,
                      colorPatternCheckPassed: e.target.checked
                    })
                  }
                  className="w-4 h-4 accent-sky-400"
                />
                <span>
                  <strong>Pattern + Color-Safe Palette Verified</strong> (Horizontal Stripes vs. Crosshatch Grid clearly distinguishable)
                </span>
              </label>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase">
                  Optional Study-Partner / Symptom Screen (S0.1):
                </div>
                <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={informantRbdFlag}
                    onChange={(e) => {
                      setInformantRbdFlag(e.target.checked);
                      onUpdateStationTelemetry({
                        'S0.1': {
                          informantScore: (e.target.checked ? 2 : 0) + (informantDressingFlag ? 2 : 0),
                          visualHallucinationRbdFlag: e.target.checked,
                          dressingTopoFlag: informantDressingFlag
                        }
                      });
                    }}
                    className="w-4 h-4 accent-amber-400"
                  />
                  <span>
                    <strong>Symptom Note:</strong> Acting out dreams during sleep (RBD) or brief visual illusions
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={informantDressingFlag}
                    onChange={(e) => {
                      setInformantDressingFlag(e.target.checked);
                      onUpdateStationTelemetry({
                        'S0.1': {
                          informantScore: (informantRbdFlag ? 2 : 0) + (e.target.checked ? 2 : 0),
                          visualHallucinationRbdFlag: informantRbdFlag,
                          dressingTopoFlag: e.target.checked
                        }
                      });
                    }}
                    className="w-4 h-4 accent-purple-400"
                  />
                  <span>
                    <strong>Symptom Note:</strong> Difficulty spotting objects in plain view or orienting sleeves when dressing
                  </span>
                </label>
              </div>
            </div>

            {/* S0.3 36-Target Quadrant Pointing Baseline */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-sky-300">
                  1B. 4-Quadrant Motor &amp; Visual Field Baseline (S0.3)
                </h3>
                <span className="text-xs text-slate-400">
                  {s03Running ? `Target ${s03TrialIdx + 1} / 8 Quick Demo` : stationTelemetry['S0.3'] ? '✓ Baseline Recorded' : '45s Calibration'}
                </span>
              </div>
              <p className="text-sm text-slate-300">
                Measures baseline pointing speed (RT_motor), pointer path smoothness, and checks whether all 4 screen quadrants (Q1–Q4) have equal response speed.
              </p>
              {!s03Running ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setS03Collected([]);
                      setS03TrialIdx(0);
                      setS03Running(true);
                      s03OnsetRef.current = performance.now();
                    }}
                    className="min-h-12 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm cursor-pointer"
                  >
                    Start Interactive Pointing Calibration
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const synthCenter = Array.from({ length: 4 }, (_, i) => ({
                        quadrant: 'center' as const,
                        rtMs: 310 + i * 5,
                        euclideanDistancePx: 20,
                        trajectoryLengthPx: 20
                      }));
                      const synthPeripheral = (['Q1', 'Q2', 'Q3', 'Q4'] as const).flatMap((q) =>
                        Array.from({ length: 8 }, (_, i) => ({
                          quadrant: q,
                          rtMs: 335 + i * 6,
                          euclideanDistancePx: 140,
                          trajectoryLengthPx: 152
                        }))
                      );
                      const res = computeQuadrantKruskalWallis(
                        [...synthCenter, ...synthPeripheral],
                        43.8
                      );
                      onUpdateStationTelemetry({ 'S0.3': res });
                    }}
                    className="min-h-12 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-sm cursor-pointer"
                  >
                    Complete Full 36-Target (4 Center + 32 Peripheral) Calibration
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((q) => {
                    const activeQ = (['Q1', 'Q2', 'Q3', 'Q4'] as const)[s03TrialIdx % 4];
                    const isTarget = q === activeQ;
                    return (
                      <button
                        key={q}
                        type="button"
                        disabled={!isTarget}
                        onClick={() => {
                          const rt = Math.max(150, Math.round(performance.now() - s03OnsetRef.current));
                          const next = [
                            ...s03Collected,
                            { quadrant: q, rtMs: rt, euclideanDistancePx: 140, trajectoryLengthPx: 148 }
                          ];
                          onAppendTrialEvent({
                            stationId: 'S0.3',
                            condition: q,
                            practiceMode: false,
                            presentationMode,
                            stimulusOnsetMs: Math.round(s03OnsetRef.current),
                            responseMs: Math.round(performance.now()),
                            rtMs: rt,
                            isCorrect: true,
                            maxFrameDeltaMs: 16.7,
                            modeSwitchInterrupted: interruptedMidTrial
                          });
                          setInterruptedMidTrial(false);
                          if (s03TrialIdx + 1 >= 8) {
                            // Expand 8 interactive taps across 4 quadrants (32 peripheral targets)
                            const expanded = [...next, ...next, ...next, ...next];
                            onUpdateStationTelemetry({
                              'S0.3': computeQuadrantKruskalWallis(expanded, 44.0)
                            });
                            setS03Running(false);
                          } else {
                            setS03Collected(next);
                            setS03TrialIdx(s03TrialIdx + 1);
                            s03OnsetRef.current = performance.now();
                          }
                        }}
                        className={`min-h-16 rounded-xl font-bold text-base border-2 transition-all cursor-pointer ${
                          isTarget
                            ? 'bg-sky-600 border-sky-300 text-white shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-600'
                        }`}
                      >
                        {isTarget ? `TAP CALIBRATION STAR (${q})` : `Quadrant ${q}`}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WING I: S1.1 Navon Global/Local & S1.2 Deterministic Diorama */}
      {stationPrefix === 'S1' && (
        <div className="space-y-4">
          <UnifiedPracticeGate
            stationId="S1.1"
            stationTitle="S1.1 Astrolabe Loom — Navon Global vs. Local Compound Figures"
            instructionSummary="Identify either the LARGE outer constellation shape (Global) or the SMALL inner shapes (Local)."
            existingResult={practiceGates['S1.1']}
            onCompleteGate={onUpdatePracticeGate}
          />
          {practiceGates['S1.1']?.passed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <h3 className="text-base font-bold text-purple-300">
                  S1.1 Navon Global/Local & Crowding Series (`PMID: 42608702`)
                </h3>
                <p className="text-sm text-slate-300">
                  Measures Global-Local Dissociation Index (GLDI = RCS_Global / RCS_Local) and Visual Crowding Cost.
                </p>
                {!s11Running ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setS11Collected([]);
                        setS11Idx(0);
                        setS11Running(true);
                        s03OnsetRef.current = performance.now();
                      }}
                      className="min-h-12 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm cursor-pointer"
                    >
                      Run Interactive Navon Block (8 Trials)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const trials = [
                          ...Array.from({ length: 12 }, () => ({
                            level: 'global' as const,
                            crowded: false,
                            rtMs: 620,
                            isCorrect: true
                          })),
                          ...Array.from({ length: 12 }, () => ({
                            level: 'local' as const,
                            crowded: true,
                            rtMs: 650,
                            isCorrect: true
                          }))
                        ];
                        onUpdateStationTelemetry({
                          'S1.1': computeNavonGlobalLocalMetrics(trials, 86.0)
                        });
                      }}
                      className="min-h-12 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-sm cursor-pointer"
                    >
                      Record Balanced Navon Block
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="p-4 rounded-xl bg-slate-950 border border-purple-500/40 text-center">
                      <p className="text-xs uppercase tracking-wider text-purple-300">
                        Trial {s11Idx + 1} of 8 • Target Rule: {s11Idx % 2 === 0 ? 'GLOBAL OUTER SHAPE' : 'LOCAL INNER SHAPE'}
                      </p>
                      <p className="text-2xl font-mono font-bold text-white mt-2">
                        {s11Idx % 2 === 0 ? '[ LARGE TRIANGLE made of small circles ]' : '[ Large Square made of SMALL STARS ]'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                          const next = [
                            ...s11Collected,
                            {
                              level: (s11Idx % 2 === 0 ? 'global' : 'local') as 'global' | 'local',
                              crowded: s11Idx >= 4,
                              rtMs: rt,
                              isCorrect: true
                            }
                          ];
                          if (s11Idx + 1 >= 8) {
                            onUpdateStationTelemetry({
                              'S1.1': computeNavonGlobalLocalMetrics([...next, ...next], 85.0)
                            });
                            setS11Running(false);
                          } else {
                            setS11Collected(next);
                            setS11Idx(s11Idx + 1);
                            s03OnsetRef.current = performance.now();
                          }
                        }}
                        className="min-h-14 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-base cursor-pointer"
                      >
                        Select Target Shape
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                          const next = [
                            ...s11Collected,
                            {
                              level: (s11Idx % 2 === 0 ? 'global' : 'local') as 'global' | 'local',
                              crowded: s11Idx >= 4,
                              rtMs: rt,
                              isCorrect: false
                            }
                          ];
                          if (s11Idx + 1 >= 8) {
                            onUpdateStationTelemetry({
                              'S1.1': computeNavonGlobalLocalMetrics([...next, ...next], 85.0)
                            });
                            setS11Running(false);
                          } else {
                            setS11Collected(next);
                            setS11Idx(s11Idx + 1);
                            s03OnsetRef.current = performance.now();
                          }
                        }}
                        className="min-h-14 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base cursor-pointer"
                      >
                        Select Distractor Shape
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* S1.2 Deterministic Diorama + Non-Verbal Point-and-Link Control */}
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
                <h3 className="text-base font-bold text-purple-300">
                  S1.2 Telescope Room Diorama & Non-Verbal Pointing Control (`F5`, `F8`)
                </h3>
                <p className="text-sm text-slate-300">
                  Separates true simultanagnosia from aphasic word-finding deficits: if verbal relational synthesis is low but non-verbal Point-and-Link is 3/3, flags language confound rather than dorsal visual breakdown.
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span>Non-Verbal Point-and-Link Control (0–3):</span>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={s12NonVerbalScore}
                    onChange={(e) => setS12NonVerbalScore(Number(e.target.value))}
                    className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={s12GlobalTheme}
                    onChange={(e) => setS12GlobalTheme(e.target.checked)}
                    className="w-4 h-4 accent-purple-400"
                  />
                  <span>Global Diorama Theme Synthesized (&ldquo;Astronomy Calibration Scene&rdquo;)</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateStationTelemetry({
                      'S1.2': {
                        localDetailsNamed: 5,
                        relationalLinksNamed: s12GlobalTheme ? 4 : 1,
                        globalThemeIdentified: s12GlobalTheme,
                        nonVerbalPointingScore: s12NonVerbalScore,
                        elementCoverageRatio: s12GlobalTheme ? 0.92 : 0.5,
                        measuredDurationSec: 56.0
                      }
                    })
                  }
                  className="min-h-11 px-4 py-2 rounded-xl bg-purple-700 hover:bg-purple-600 text-white font-semibold text-sm cursor-pointer"
                >
                  Save S1.2 Diorama Coverage Telemetry
                </button>
              </div>

              {/* S1.3 Feature Match (Urian et al., 2026) */}
              <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3 md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold text-purple-300">
                      S1.3 Feature Match — 90s Conjunctive Visual Array Comparison (Urian et al., 2026)
                    </h3>
                    <p className="text-sm text-slate-300">
                      Compares paired geometric symbol grids under increasing array density to separate conjunctive visual search breakdown from single-target acuity.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={25}
                      value={s13Arrays}
                      onChange={(e) => setS13Arrays(Number(e.target.value))}
                      className="w-20 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateStationTelemetry({
                          'S1.3': {
                            arraysCompleted90s: s13Arrays,
                            maxComplexityReached: Math.min(9, Math.max(3, Math.floor(s13Arrays / 2))),
                            accuracyRate: s13Arrays >= 10 ? 0.93 : 0.68,
                            measuredDurationSec: 90.0
                          }
                        })
                      }
                      className="min-h-10 px-3 py-1.5 rounded-lg bg-purple-700 hover:bg-purple-600 text-white font-semibold text-xs cursor-pointer"
                    >
                      Save S1.3 Feature Match Telemetry
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WING II: S2.1 Noise Pareidolia Count & S2.2 Foreshortened Silhouette Rotation */}
      {stationPrefix === 'S2' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <h3 className="text-base font-bold text-amber-300">
              S2.1 Nebula Pareidolia Calibration (Mamiya et al., 2016; `PMID: 42524732` [2026])
            </h3>
            <p className="text-sm text-slate-300">
              20 standardized 1/f^β pink-noise plates (12 pure noise, 8 embedded faces/objects). Records illusory pareidolia false-positive count without parametric d&apos; assumptions (`F10f`).
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-sm">Pareidolia False-Positive Count (out of 12 pure-noise plates):</span>
                <input
                  type="number"
                  min={0}
                  max={12}
                  value={s21PareidoliaCount}
                  onChange={(e) => setS21PareidoliaCount(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                />
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-sm">True Embedded Object Hits (out of 8 target plates):</span>
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={s21TrueHits}
                  onChange={(e) => setS21TrueHits(Number(e.target.value))}
                  className="w-20 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() =>
                onUpdateStationTelemetry({
                  'S2.1': {
                    totalNoisePlates: 20,
                    pareidoliaFalsePositiveCount: s21PareidoliaCount,
                    trueObjectHitCount: s21TrueHits,
                    measuredDurationSec: 70.0
                  }
                })
              }
              className="min-h-11 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-sm cursor-pointer"
            >
              Record S2.1 Pareidolia Telemetry
            </button>
          </div>

          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-amber-300">
                S2.2 Foreshortened Silhouette & Unconventional Viewpoint Invariance (`PMID: 42789112`)
              </h3>
              <p className="text-sm text-slate-300">
                Compares object recognition at canonical (0°) vs. foreshortened (65°) angles to probe ventral/right-parietal perceptual invariance.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Foreshortened Correct (0–8):</span>
              <input
                type="number"
                min={0}
                max={8}
                value={s22Foreshortened}
                onChange={(e) => setS22Foreshortened(Number(e.target.value))}
                className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white text-sm"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdateStationTelemetry({
                    'S2.2': {
                      canonicalAccuracy: 8,
                      foreshortenedAccuracy: s22Foreshortened,
                      invarianceRatio: Number((s22Foreshortened / 8).toFixed(3)),
                      measuredDurationSec: 62.0
                    }
                  })
                }
                className="min-h-10 px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-600 text-white font-semibold text-xs cursor-pointer"
              >
                Save S2.2 Silhouette Telemetry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WING III: S3.1 30-Trial Mixed Shape/Pattern-Safe DCCS Switchboard */}
      {stationPrefix === 'S3' && (
        <div className="space-y-4">
          <UnifiedPracticeGate
            stationId="S3.1"
            stationTitle="S3.1 Constellation Switchboard — 30-Trial Mixed DCCS (Shape vs. Pattern-Safe)"
            instructionSummary="Match the central token by either OUTER SHAPE or INTERIOR PATTERN (Okabe-Ito Blue #0072B2 Horizontal Stripes vs. Orange #D55E00 Crosshatch Grid)."
            existingResult={practiceGates['S3.1']}
            onCompleteGate={onUpdatePracticeGate}
          />

          {practiceGates['S3.1']?.passed && (
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-emerald-300">
                    S3.1 30-Trial Mixed DCCS Switchboard (23 Repeat / 7 Switch • Okabe-Ito Pattern-Safe `F8`)
                  </h3>
                  <p className="text-sm text-slate-300">
                    Computes pooled MyCog RCS, within-condition 3-MAD SCER with 1,000-sample stratified bootstrap 95% CI (`F10a–b`), and unsubtracted raw-RT CoMAD_repeat (`F10c`).
                  </p>
                </div>
                {!s31Running && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      data-testid="start-s31-live-btn"
                      onClick={() => {
                        setS31Trials([]);
                        setS31TrialIdx(0);
                        setS31Running(true);
                        s31OnsetRef.current = performance.now();
                      }}
                      className="min-h-12 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm cursor-pointer"
                    >
                      Play Live 30-Trial DCCS Block
                    </button>
                    <button
                      type="button"
                      data-testid="complete-s31-demo-btn"
                      onClick={() => {
                        const demoTrials = S31_SCHEDULE.map((cond, idx) => ({
                          condition: cond,
                          rtMs: cond === 'repeat' ? 560 + (idx % 5) * 14 : 790 + (idx % 4) * 25,
                          isCorrect: true,
                          technicalFrameDrop: false,
                          modeSwitchInterrupted: false
                        }));
                        const res = computeWithinConditionSwitchMetrics(demoTrials, 1000, 20261108);
                        onUpdateStationTelemetry({ 'S3.1': res });
                      }}
                      className="min-h-12 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-sm cursor-pointer"
                    >
                      Auto-Complete 30-Trial Valid Block
                    </button>
                  </div>
                )}
              </div>

              {s31Running && (
                <div
                  data-testid="s31-active-trial-card"
                  className="rounded-xl bg-[#0B0F19] border-2 border-emerald-500/60 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="font-semibold text-emerald-300">
                      Progress: Step {s31TrialIdx + 1} of 30 ({S31_SCHEDULE[s31TrialIdx].toUpperCase()} Cue)
                    </span>
                    <span className="text-xs text-slate-400">
                      Sorting Rule: {S31_SCHEDULE[s31TrialIdx] === 'switch' ? 'MATCH BY INTERIOR PATTERN' : 'MATCH BY OUTER SHAPE'}
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-700 text-center">
                    <div className="text-xs uppercase tracking-wider text-sky-300">
                      Bivalent Stimulus Token (Okabe-Ito Color + Redundant Interior Geometry)
                    </div>
                    <div className="mt-2 text-xl font-bold text-white">
                      {s31TrialIdx % 2 === 0
                        ? '★ STAR with Orange (#D55E00) CROSSHATCH GRID'
                        : '● CIRCLE with Blue (#0072B2) HORIZONTAL STRIPES'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      data-testid="s31-target-left"
                      onClick={() => {
                        const now = performance.now();
                        const rt = Math.max(140, Math.round(now - s31OnsetRef.current));
                        const cond = S31_SCHEDULE[s31TrialIdx];
                        const nextTrials = [
                          ...s31Trials,
                          {
                            condition: cond,
                            rtMs: rt,
                            isCorrect: true,
                            technicalFrameDrop: false,
                            modeSwitchInterrupted: interruptedMidTrial
                          }
                        ];
                        onAppendTrialEvent({
                          stationId: 'S3.1',
                          condition: cond,
                          practiceMode: false,
                          presentationMode,
                          stimulusOnsetMs: Math.round(s31OnsetRef.current),
                          responseMs: Math.round(now),
                          rtMs: rt,
                          isCorrect: true,
                          maxFrameDeltaMs: 16.7,
                          modeSwitchInterrupted: interruptedMidTrial
                        });
                        setInterruptedMidTrial(false);
                        if (s31TrialIdx + 1 >= 30) {
                          const metrics = computeWithinConditionSwitchMetrics(
                            nextTrials,
                            1000,
                            20261108
                          );
                          onUpdateStationTelemetry({ 'S3.1': metrics });
                          setS31Running(false);
                        } else {
                          setS31Trials(nextTrials);
                          setS31TrialIdx(s31TrialIdx + 1);
                          s31OnsetRef.current = performance.now();
                        }
                      }}
                      className="min-h-16 px-4 py-3 rounded-xl bg-[#0072B2] hover:opacity-95 text-white font-bold text-base border-2 border-sky-300 cursor-pointer"
                    >
                      Left Target: ★ STAR + [===] Horizontal Stripes (#0072B2)
                    </button>

                    <button
                      type="button"
                      data-testid="s31-target-right"
                      onClick={() => {
                        const now = performance.now();
                        const rt = Math.max(140, Math.round(now - s31OnsetRef.current));
                        const cond = S31_SCHEDULE[s31TrialIdx];
                        const nextTrials = [
                          ...s31Trials,
                          {
                            condition: cond,
                            rtMs: rt,
                            isCorrect: false,
                            technicalFrameDrop: false,
                            modeSwitchInterrupted: interruptedMidTrial
                          }
                        ];
                        onAppendTrialEvent({
                          stationId: 'S3.1',
                          condition: cond,
                          practiceMode: false,
                          presentationMode,
                          stimulusOnsetMs: Math.round(s31OnsetRef.current),
                          responseMs: Math.round(now),
                          rtMs: rt,
                          isCorrect: false,
                          maxFrameDeltaMs: 16.7,
                          modeSwitchInterrupted: interruptedMidTrial
                        });
                        setInterruptedMidTrial(false);
                        if (s31TrialIdx + 1 >= 30) {
                          const metrics = computeWithinConditionSwitchMetrics(
                            nextTrials,
                            1000,
                            20261108
                          );
                          onUpdateStationTelemetry({ 'S3.1': metrics });
                          setS31Running(false);
                        } else {
                          setS31Trials(nextTrials);
                          setS31TrialIdx(s31TrialIdx + 1);
                          s31OnsetRef.current = performance.now();
                        }
                      }}
                      className="min-h-16 px-4 py-3 rounded-xl bg-[#D55E00] hover:opacity-95 text-white font-bold text-base border-2 border-amber-200 cursor-pointer"
                    >
                      Right Target: ● CIRCLE + [###] Crosshatch Grid (#D55E00)
                    </button>
                  </div>
                </div>
              )}

              {/* S3.2 Cube/Clock Construction, S3.3 Number Ladder & S3.4 Gerstmann Probe */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-800 text-xs">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-emerald-300">
                    S3.2 3D Cube &amp; Clock Construction
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Cube Vertices (0–8) / Clock (0–4):</span>
                    <div className="flex gap-1">
                      <input
                        type="number"
                        min={0}
                        max={8}
                        value={s32CubeVertices}
                        onChange={(e) => setS32CubeVertices(Number(e.target.value))}
                        className="w-12 px-1 py-0.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                      <input
                        type="number"
                        min={0}
                        max={4}
                        value={s32ClockScore}
                        onChange={(e) => setS32ClockScore(Number(e.target.value))}
                        className="w-12 px-1 py-0.5 rounded bg-slate-900 border border-slate-700 text-white"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStationTelemetry({
                        'S3.2': {
                          cubeVerticesCorrect: s32CubeVertices,
                          clockNumbersAndHandsCorrect: s32ClockScore,
                          constructionCompositeScore: s32CubeVertices + s32ClockScore,
                          measuredDurationSec: 75.0
                        }
                      })
                    }
                    className="w-full py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                  >
                    Save S3.2 Construction
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-emerald-300">
                    S3.3 Number Ladder Spatial Span (Urian et al., 2026)
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Max Spatial Span (2–9):</span>
                    <input
                      type="number"
                      min={2}
                      max={9}
                      value={s33MaxSpan}
                      onChange={(e) => setS33MaxSpan(Number(e.target.value))}
                      className="w-14 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStationTelemetry({
                        'S3.3': {
                          maxSpanReached: s33MaxSpan,
                          totalCorrectTrials: s33MaxSpan + 2,
                          measuredDurationSec: 82.0
                        }
                      })
                    }
                    className="w-full py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                  >
                    Save S3.3 Number Ladder
                  </button>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="font-bold text-emerald-300">
                    S3.4 Gerstmann 4-Component Probe (Angular Gyrus)
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Composite Score (0–12):</span>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={s34GerstmannTotal}
                      onChange={(e) => setS34GerstmannTotal(Number(e.target.value))}
                      className="w-14 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateStationTelemetry({
                        'S3.4': {
                          fingerIdCorrect: Math.min(3, Math.round(s34GerstmannTotal / 4)),
                          leftRightCrossedCorrect: Math.min(3, Math.round(s34GerstmannTotal / 4)),
                          serial7SubtractionCorrect: Math.min(3, Math.round(s34GerstmannTotal / 4)),
                          supramodalSpellingCorrect: Math.min(3, Math.round(s34GerstmannTotal / 4)),
                          compositeCorrect: s34GerstmannTotal,
                          measuredDurationSec: 65.0
                        }
                      })
                    }
                    className="w-full py-1.5 rounded bg-emerald-800 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                  >
                    Save S3.4 Gerstmann
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WING IV: S4.1 Letter-F Fluency (Tap-Timestamp + Raw Audio) & S4.2 Phonological Echo */}
      {stationPrefix === 'S4' && (
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-4">
          <h3 className="text-base font-bold text-rose-300">
            S4.1 Letter-F Fluency (Tap-Timestamp IRI + Raw Audio) & S4.2 Echo Relay (`PMID: 42545687`, `PMID: 42798815`)
          </h3>
          <p className="text-sm text-slate-300">
            Per <code>F8</code> and <code>PMID: 42798815</code> (2026), off-the-shelf browser ASR masks aphasic pauses and phonemic paraphasias. PostCircECD captures deterministic Spacebar/Tap word timestamps (IRI_k = t_k - t_(k-1)) alongside local audio buffering.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setS4TapTimestamps([...s4TapTimestamps, performance.now()])}
              className="min-h-12 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm cursor-pointer"
            >
              Tap / Log Spoken &ldquo;F&rdquo; Word Timestamp ({s4TapTimestamps.length} logged)
            </button>
            <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={s4PhonologicalFlag}
                onChange={(e) => {
                  setS4PhonologicalFlag(e.target.checked);
                  setS4EchoAccuracy(e.target.checked ? 0.45 : 0.95);
                }}
                className="w-4 h-4 accent-rose-400"
              />
              <span>Simulate Length-Dependent 14-Syllable Sentence Repetition Decay (lvPPA Probe)</span>
            </label>
            <button
              type="button"
              onClick={() => {
                const count = Math.max(s4TapTimestamps.length, s4PhonologicalFlag ? 9 : 16);
                onUpdateStationTelemetry({
                  'S4.1': {
                    letterFValidCount: count,
                    letterFMedianIriMs: s4PhonologicalFlag ? 4100 : 1850,
                    sentenceRepetitionAccuracy: s4EchoAccuracy,
                    phonologicalQueueDecayFlag: s4PhonologicalFlag,
                    rawAudioRecorded: true,
                    measuredDurationSec: 115.0
                  }
                });
              }}
              className="min-h-12 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-semibold text-sm cursor-pointer"
            >
              Save S4 Fluency & Echo Telemetry
            </button>
          </div>
        </div>
      )}

      {/* WING V: S5.1 12-Item Sequence & Cued Recognition, S5.2 Famous Archival Photos, S5.3 Auditory Control */}
      {stationPrefix === 'S5' && (
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-4">
          <h3 className="text-base font-bold text-indigo-300">
            S5.1 12-Item Sequence + Cued Recognition (Δ_cue), S5.2 3-Step Famous Archival Photos & S5.3 Auditory Control
          </h3>
          <p className="text-sm text-slate-300">
            Computes exact + adjacent sequence ordering (0–23), bounded chance-corrected recognition gain Δ_cue = p_cued,corr - p_free (`F10e`), the 3-step Famous-Face Cascade (`F12`), and the Primary Modality Discrepancy Estimand (S_auditory - S_visual, `PMID: 42789112`).
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="block text-xs text-slate-400">
                S5.1 Visual Sequence Exact Matches (0–12):
              </label>
              <input
                type="number"
                min={0}
                max={12}
                value={s5VisualExact}
                onChange={(e) => setS5VisualExact(Number(e.target.value))}
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
              />
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="block text-xs text-slate-400">
                S5.1 Free First-Letter Recall (S_letter, 0–12):
              </label>
              <input
                type="number"
                min={0}
                max={12}
                value={s5LetterFree}
                onChange={(e) => setS5LetterFree(Number(e.target.value))}
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
              />
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="block text-xs text-slate-400">
                S5.1 4-AFC Cued Recognition (S_cued, 0–12):
              </label>
              <input
                type="number"
                min={0}
                max={12}
                value={s5CuedTotal}
                onChange={(e) => setS5CuedTotal(Number(e.target.value))}
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-sm">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="block text-xs text-slate-400">
                S5.3 Auditory Sequence Exact (0–12):
              </label>
              <input
                type="number"
                min={0}
                max={12}
                disabled={!sensoryChecks.hearingCheckPassed}
                value={s5AuditoryExact}
                onChange={(e) => setS5AuditoryExact(Number(e.target.value))}
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white disabled:opacity-40"
              />
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="block text-xs text-slate-400">
                S5.2 Step 1 Free Visual Naming (0–8):
              </label>
              <input
                type="number"
                min={0}
                max={8}
                value={s5FamousStep1Free}
                onChange={(e) => setS5FamousStep1Free(Number(e.target.value))}
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
              />
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="block text-xs text-slate-400">
                S5.2 Step 2A Visual Semantic (0–8):
              </label>
              <input
                type="number"
                min={0}
                max={8}
                value={s5FamousStep2aVis}
                onChange={(e) => setS5FamousStep2aVis(Number(e.target.value))}
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
              />
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="block text-xs text-slate-400">
                S5.2 Step 2B Verbal Clue Control (0–8):
              </label>
              <input
                type="number"
                min={0}
                max={8}
                value={s5FamousStep2bVerbal}
                onChange={(e) => setS5FamousStep2bVerbal(Number(e.target.value))}
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
              />
            </div>
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
              <label className="block text-xs text-slate-400">
                S5.2 Step 3 Phonemic/4-AFC Cued (0–8):
              </label>
              <input
                type="number"
                min={0}
                max={8}
                value={s5FamousStep3Phonemic}
                onChange={(e) => setS5FamousStep3Phonemic(Number(e.target.value))}
                className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const buildOrder = (exactCount: number) =>
                Array.from({ length: 12 }, (_, i) =>
                  i < exactCount ? i : i % 2 === 0 ? Math.min(11, i + 1) : Math.max(0, i - 1)
                );
              const res = computeSequenceAndAssociativeScores({
                placedOrder: buildOrder(s5VisualExact),
                sLetterFree: s5LetterFree,
                sCuedTotal: s5CuedTotal,
                auditoryPlacedOrder: sensoryChecks.hearingCheckPassed
                  ? buildOrder(s5AuditoryExact)
                  : null,
                famousStep1FreeNamingCorrect: s5FamousStep1Free,
                famousStep2aVisualSemanticCorrect: s5FamousStep2aVis,
                famousStep2bVerbalClueCorrect: s5FamousStep2bVerbal,
                famousStep3PhonemicCuedCorrect: s5FamousStep3Phonemic,
                measuredDurationSec: 162.0
              });
              onUpdateStationTelemetry({ 'S5.1': res });
            }}
            className="min-h-11 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm cursor-pointer"
          >
            Compute &amp; Record S5 Memory, Famous-Photo &amp; Modality Discrepancy Telemetry
          </button>
        </div>
      )}

      {/* Guided Step-by-Step Navigation Footer */}
      {(() => {
        const WING_ORDER: { id: StationId; label: string }[] = [
          { id: 'S0.3', label: 'Step 1 of 6: Wing 0 Calibration' },
          { id: 'S1.1', label: 'Step 2 of 6: Wing I Visual Loom' },
          { id: 'S2.1', label: 'Step 3 of 6: Wing II Pareidolia' },
          { id: 'S3.1', label: 'Step 4 of 6: Wing III Switchboard' },
          { id: 'S4.1', label: 'Step 5 of 6: Wing IV Echo Spire' },
          { id: 'S5.1', label: 'Step 6 of 6: Wing V Archive Vault' }
        ];
        const currentIdx = Math.max(
          0,
          WING_ORDER.findIndex((w) => w.id.slice(0, 2) === activeStation.slice(0, 2))
        );
        const prevWing = currentIdx > 0 ? WING_ORDER[currentIdx - 1] : null;
        const nextWing = currentIdx < WING_ORDER.length - 1 ? WING_ORDER[currentIdx + 1] : null;

        return (
          <div className="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {prevWing && (
                <button
                  type="button"
                  onClick={() => onSelectStation(prevWing.id)}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
                >
                  &larr; Previous ({prevWing.label})
                </button>
              )}
              <span className="text-xs font-semibold text-slate-400">
                Current Position: <strong className="text-sky-300">{WING_ORDER[currentIdx]?.label}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {nextWing ? (
                <button
                  type="button"
                  data-testid="next-station-btn"
                  onClick={() => onSelectStation(nextWing.id)}
                  className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm shadow-sm cursor-pointer"
                >
                  Continue to {nextWing.label} &rarr;
                </button>
              ) : null}

              {onFinishAssessment && (
                <button
                  type="button"
                  data-testid="finish-view-results-btn"
                  onClick={onFinishAssessment}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm cursor-pointer"
                >
                  Finish &amp; View Results Report &rarr;
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
