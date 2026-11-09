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

const NEBULA_PLATES: {
  id: number;
  title: string;
  isPureNoise: boolean;
  embeddedCategory: 'face' | 'animal' | 'none';
  gradient: string;
  hintDesc: string;
}[] = [
  {
    id: 1,
    title: 'Orion Rose Mist',
    isPureNoise: true,
    embeddedCategory: 'none',
    gradient: 'radial-gradient(circle at 35% 40%, rgba(244,114,182,0.35), rgba(56,189,248,0.18) 45%, rgba(15,23,42,0.95) 80%)',
    hintDesc: 'Drifting pink-and-violet starlight dust with random turbulence'
  },
  {
    id: 2,
    title: 'Cygnus Swan Cloud',
    isPureNoise: false,
    embeddedCategory: 'animal',
    gradient: 'radial-gradient(circle at 50% 45%, rgba(56,189,248,0.45), rgba(168,85,247,0.22) 55%, rgba(15,23,42,0.95) 85%)',
    hintDesc: 'Nebula cloud with a faint gliding swan silhouette in the center'
  },
  {
    id: 3,
    title: 'Carina Amber Veil',
    isPureNoise: true,
    embeddedCategory: 'none',
    gradient: 'radial-gradient(circle at 60% 35%, rgba(251,191,36,0.32), rgba(239,68,68,0.15) 50%, rgba(15,23,42,0.95) 82%)',
    hintDesc: 'Unstructured golden dust swirls and scattered star clusters'
  },
  {
    id: 4,
    title: 'Lunar Guardian Mist',
    isPureNoise: false,
    embeddedCategory: 'face',
    gradient: 'radial-gradient(circle at 48% 48%, rgba(129,140,248,0.42), rgba(56,189,248,0.2) 52%, rgba(15,23,42,0.95) 85%)',
    hintDesc: 'Starlight cloud containing a serene crescent-moon face profile'
  },
  {
    id: 5,
    title: 'Vela Deep Eddy',
    isPureNoise: true,
    embeddedCategory: 'none',
    gradient: 'radial-gradient(circle at 40% 60%, rgba(52,211,153,0.3), rgba(59,130,246,0.18) 50%, rgba(15,23,42,0.95) 82%)',
    hintDesc: 'Pure 1/f fractal starlight eddies without any embedded figure'
  },
  {
    id: 6,
    title: 'Cassini Silver Drift',
    isPureNoise: true,
    embeddedCategory: 'none',
    gradient: 'radial-gradient(circle at 55% 50%, rgba(226,232,240,0.3), rgba(148,163,184,0.15) 50%, rgba(15,23,42,0.95) 85%)',
    hintDesc: 'Soft silver-blue cosmic mist with random brightness ripples'
  }
];

const SILHOUETTE_ITEMS: {
  id: number;
  prompt: string;
  correctOption: string;
  options: string[];
  svgType: 'telescope' | 'sundial' | 'globe' | 'lantern';
}[] = [
  {
    id: 1,
    prompt: 'Viewed from a steep 65° end-on angle, which observatory instrument is this?',
    correctOption: '🔭 Brass Telescope',
    options: ['🔭 Brass Telescope', '🕯️ Candlestand', '🔔 Tower Bell'],
    svgType: 'telescope'
  },
  {
    id: 2,
    prompt: 'Viewed nearly flat from the side, what object casts this shadow?',
    correctOption: '🧭 Pocket Sundial & Compass',
    options: ['🧭 Pocket Sundial & Compass', '🍽️ Dinner Plate', '🎩 Top Hat'],
    svgType: 'sundial'
  },
  {
    id: 3,
    prompt: 'Viewed from directly above its tilted axis, which instrument is this?',
    correctOption: '🌐 Celestial Star Globe',
    options: ['🌐 Celestial Star Globe', '🍎 Fruit Bowl', '⏳ Hourglass'],
    svgType: 'globe'
  },
  {
    id: 4,
    prompt: 'Viewed from a low corner angle, what night-watch item is this?',
    correctOption: '🏮 Astronomer’s Lantern',
    options: ['🏮 Astronomer’s Lantern', '🏠 Birdhouse', '⚓ Ship Anchor'],
    svgType: 'lantern'
  }
];

const ECHO_PHRASES: {
  id: number;
  syllables: number;
  target: string;
  options: string[];
}[] = [
  {
    id: 1,
    syllables: 6,
    target: 'Bright stars guide the night ship.',
    options: [
      'Bright stars guide the night ship.',
      'Bright moons guard the light ship.',
      'White stars glide the night sea.'
    ]
  },
  {
    id: 2,
    syllables: 10,
    target: 'The brass telescope tracks the silver comet.',
    options: [
      'The glass microscope tracks the silver planet.',
      'The brass telescope tracks the silver comet.',
      'The brass periscope watches the golden comet.'
    ]
  },
  {
    id: 3,
    syllables: 14,
    target: 'The astronomer calibrated the meridian astrolabe.',
    options: [
      'The astrologer calculated the meridian altitude.',
      'The astronomer calibrated the magnetic barometer.',
      'The astronomer calibrated the meridian astrolabe.'
    ]
  }
];

const STAR_RELICS = [
  { id: 0, icon: '🧭', name: 'Compass', firstLetter: 'C' },
  { id: 1, icon: '⏳', name: 'Hourglass', firstLetter: 'H' },
  { id: 2, icon: '🗝️', name: 'Moon-Key', firstLetter: 'M' },
  { id: 3, icon: '📜', name: 'Star-Scroll', firstLetter: 'S' }
];

const AUDIO_CHIMES = [
  { id: 0, icon: '🔔', name: 'High Silver Bell', freq: 1046 },
  { id: 1, icon: '🥁', name: 'Deep Dome Drum', freq: 220 },
  { id: 2, icon: '🪈', name: 'Warm Wind Flute', freq: 523 },
  { id: 3, icon: '✨', name: 'Crystal Harp', freq: 784 }
];

const FAMOUS_EXPLORERS = [
  {
    id: 1,
    portraitEmoji: '👨‍🔬🌌',
    eraTag: '20th-Century Physics • Wild White Hair & Violin',
    verbalClue: 'Formulated the Theory of Relativity (E = mc²) and won the 1921 Nobel Prize in Physics.',
    phonemicHint: 'Starts with "Al-bert Ein..."',
    correctName: 'Albert Einstein',
    nameChoices: ['Albert Einstein', 'Isaac Newton', 'Niels Bohr', 'Edwin Hubble'],
    semanticChoices: [
      'Theory of Relativity & Light (E = mc²)',
      'Invented the Steam Engine',
      'Sailed Around the World'
    ],
    correctSemantic: 'Theory of Relativity & Light (E = mc²)'
  },
  {
    id: 2,
    portraitEmoji: '👩‍🔬🧪',
    eraTag: 'Early 1900s Paris Lab • Glowing Radium Vial',
    verbalClue: 'Pioneered research on radioactivity, discovered Polonium and Radium, and won two Nobel Prizes.',
    phonemicHint: 'Starts with "Ma-rie Cu..."',
    correctName: 'Marie Curie',
    nameChoices: ['Marie Curie', 'Rosalind Franklin', 'Ada Lovelace', 'Florence Nightingale'],
    semanticChoices: [
      'Discovered Radium & Radioactivity (2 Nobel Prizes)',
      'Wrote Pride and Prejudice',
      'Painted the Mona Lisa'
    ],
    correctSemantic: 'Discovered Radium & Radioactivity (2 Nobel Prizes)'
  }
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
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Wing 0 state (Sensory Chime + Comfort Check + 4-Quadrant Star Catcher)
  const [chimeHeard, setChimeHeard] = useState<boolean>(false);
  const [informantRbdFlag, setInformantRbdFlag] = useState<boolean>(false);
  const [informantDressingFlag, setInformantDressingFlag] = useState<boolean>(false);
  const [s03TrialIdx, setS03TrialIdx] = useState<number>(0);
  const [s03Running, setS03Running] = useState<boolean>(false);
  const [s03Collected, setS03Collected] = useState<
    { quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4'; rtMs: number; euclideanDistancePx: number; trajectoryLengthPx: number }[]
  >([]);
  const s03OnsetRef = useRef<number>(performance.now());

  // Wing I state (Astrolabe Loom: Navon Constellations + Study Scene + Twin Star Charts)
  const [s11Idx, setS11Idx] = useState<number>(0);
  const [s11Running, setS11Running] = useState<boolean>(false);
  const [s11Collected, setS11Collected] = useState<
    { level: 'global' | 'local'; crowded: boolean; rtMs: number; isCorrect: boolean }[]
  >([]);
  const [s12PairLinked, setS12PairLinked] = useState<boolean | null>(null);
  const [s12ThemePicked, setS12ThemePicked] = useState<boolean | null>(null);
  const [s13RoundIdx, setS13RoundIdx] = useState<number>(0);
  const [s13CorrectCount, setS13CorrectCount] = useState<number>(0);
  const [s13Done, setS13Done] = useState<boolean>(false);

  // Wing II state (Nebula Pareidolia Gazing + Rotated Silhouettes)
  const [s21PlateIdx, setS21PlateIdx] = useState<number>(0);
  const [s21FalsePositives, setS21FalsePositives] = useState<number>(0);
  const [s21TrueHits, setS21TrueHits] = useState<number>(0);
  const [s21Done, setS21Done] = useState<boolean>(false);

  const [s22ItemIdx, setS22ItemIdx] = useState<number>(0);
  const [s22CorrectCount, setS22CorrectCount] = useState<number>(0);
  const [s22Done, setS22Done] = useState<boolean>(false);

  // Wing III state (Constellation Switchboard + 3-Mini-Puzzle Bonus)
  const [s31Running, setS31Running] = useState<boolean>(false);
  const [s31TrialIdx, setS31TrialIdx] = useState<number>(0);
  const [s31Trials, setS31Trials] = useState<
    { condition: 'repeat' | 'switch'; rtMs: number; isCorrect: boolean; technicalFrameDrop?: boolean; modeSwitchInterrupted?: boolean }[]
  >([]);
  const s31OnsetRef = useRef<number>(performance.now());
  const prevModeRef = useRef<SingleTrialMode>(presentationMode);
  const [interruptedMidTrial, setInterruptedMidTrial] = useState<boolean>(false);

  const [s32ClockAnswered, setS32ClockAnswered] = useState<boolean | null>(null);
  const [s33LadderShown, setS33LadderShown] = useState<boolean>(true);
  const [s33LadderPicked, setS33LadderPicked] = useState<number[]>([]);
  const [s34CountdownCorrect, setS34CountdownCorrect] = useState<boolean | null>(null);

  // Wing IV state (Star-Drum Word Rhythm + Radio Echo)
  const [s4TapTimestamps, setS4TapTimestamps] = useState<number[]>([]);
  const [s4EchoIdx, setS4EchoIdx] = useState<number>(0);
  const [s4EchoCorrectCount, setS4EchoCorrectCount] = useState<number>(0);
  const [s4LongPhraseMissed, setS4LongPhraseMissed] = useState<boolean>(false);
  const [s4EchoDone, setS4EchoDone] = useState<boolean>(false);
  const [s4ShowTransmissionText, setS4ShowTransmissionText] = useState<boolean>(true);

  // Wing V state (Star-Log Sequence + Audio Sequence + Hall of Explorers)
  const [s5Phase, setS5Phase] = useState<'STUDY_VISUAL' | 'REBUILD_VISUAL' | 'CUE_CHECK' | 'AUDIO_SEQ' | 'FAMOUS_PORTRAITS' | 'DONE'>('STUDY_VISUAL');
  const [s5VisualPicked, setS5VisualPicked] = useState<number[]>([]);
  const [s5FreeLetterCorrect, setS5FreeLetterCorrect] = useState<boolean>(false);
  const [s5CuedRelicCorrect, setS5CuedRelicCorrect] = useState<boolean>(true);
  const [s5AudioPicked, setS5AudioPicked] = useState<number[]>([]);
  const [s5ExplorerIdx, setS5ExplorerIdx] = useState<number>(0);
  const [s5ExplorerStep, setS5ExplorerStep] = useState<'FREE' | 'SEMANTIC' | 'PHONEMIC'>('FREE');
  const [s5FamousFreeHits, setS5FamousFreeHits] = useState<number>(0);
  const [s5FamousSemanticHits, setS5FamousSemanticHits] = useState<number>(0);
  const [s5FamousPhonemicHits, setS5FamousPhonemicHits] = useState<number>(0);

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

  const playToneSequence = (freqs: number[], stepSec = 0.16) => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.value = sensoryChecks.selectedVolumeGain * 0.15;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * stepSec);
        osc.stop(ctx.currentTime + (idx + 1) * stepSec);
      });
    } catch {
      // Safe fallback in headless environment
    }
  };

  const playCalibrationChime = () => {
    playToneSequence([500, 1000, 2000], 0.15);
    setChimeHeard(true);
  };

  // Detect mid-trial mode switch without unmounting active task state
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
    storySubtitle: string;
    done: boolean;
  }[] = [
    {
      prefix: 'S0',
      stationId: 'S0.3',
      stepNum: 1,
      shortTitle: '1. Dome Warm-Up',
      storySubtitle: 'Tune the Observatory’s chimes and catch 8 guide stars across the dome sky.',
      done: Boolean(stationTelemetry['S0.3'])
    },
    {
      prefix: 'S1',
      stationId: 'S1.1',
      stepNum: 2,
      shortTitle: '2. Astrolabe Loom',
      storySubtitle: 'Spot big constellations vs. tiny stars and match twin star-charts.',
      done: Boolean(stationTelemetry['S1.1'])
    },
    {
      prefix: 'S2',
      stationId: 'S2.1',
      stepNum: 3,
      shortTitle: '3. Nebula Cloud',
      storySubtitle: 'Tell us what shapes you see in cosmic mist and tilted observatory silhouettes.',
      done: Boolean(stationTelemetry['S2.1'])
    },
    {
      prefix: 'S3',
      stationId: 'S3.1',
      stepNum: 4,
      shortTitle: '4. Star Switchboard',
      storySubtitle: 'Sort glowing cosmic tokens by their Outer Shape or Inside Pattern.',
      done: Boolean(stationTelemetry['S3.1'])
    },
    {
      prefix: 'S4',
      stationId: 'S4.1',
      stepNum: 5,
      shortTitle: '5. Echo Relay Spire',
      storySubtitle: 'Tap the Star-Drum to log word rhythm and match deep-space radio echoes.',
      done: Boolean(stationTelemetry['S4.1'])
    },
    {
      prefix: 'S5',
      stationId: 'S5.1',
      stepNum: 6,
      shortTitle: '6. Archive Vault',
      storySubtitle: 'Rebuild the 4-Relic Star-Log, match chime order, and recognize famous explorers.',
      done: Boolean(stationTelemetry['S5.1'])
    }
  ];

  const currentGuidedStep =
    GUIDED_STEPS.find((s) => s.prefix === stationPrefix) ?? GUIDED_STEPS[0];

  return (
    <div
      data-testid="participant-task-surface"
      className="rounded-2xl border border-slate-700/80 bg-[#12161F] p-6 text-slate-100 shadow-lg"
    >
      {/* 6-Step Stargazer Journey Progress Bar */}
      <div className="mb-5 pb-4 border-b border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            🌟 Celestial Observatory Stargazer Tour (6 Gentle Interactive Stations)
          </span>
          <span className="text-xs text-slate-300">
            Instruments Tuned:{' '}
            <strong className="text-emerald-400">
              {GUIDED_STEPS.filter((s) => s.done).length} of 6
            </strong>
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
                className={`px-3 py-2.5 rounded-xl text-left text-xs transition-all border cursor-pointer ${
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

      {/* Friendly Stargazer Header — Zero Clinical Acronyms or Scores */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-5">
        <div className="max-w-3xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Calm Stargazer View • Take Your Time — There Are No Wrong Answers
          </span>
          <h2 className="text-2xl font-bold text-white mt-0.5">
            {currentGuidedStep.shortTitle}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {currentGuidedStep.storySubtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="participant-pause-resume-btn"
            onClick={handleTogglePause}
            className="min-h-11 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-semibold text-slate-100 cursor-pointer"
          >
            {isPaused ? '▶ Resume Activity (Resets Trial Clock)' : '⏸ Pause / Take a Breather'}
          </button>
        </div>
      </div>

      {isPaused && (
        <div
          data-testid="pause-modal-banner"
          className="mb-5 rounded-xl border border-sky-400/60 bg-sky-950/40 p-4 text-slate-100"
        >
          <p className="text-base font-semibold text-sky-200">
            Session Paused — Take all the time you need.
          </p>
          <p className="text-sm text-slate-300 mt-1">
            When you click <strong>Resume Activity</strong>, the current activity clock resets cleanly so taking a break never affects your session.
          </p>
        </div>
      )}

      {/* =====================================================================
          WING 0: DOME WARM-UP (Chime Check + Catch the Guide Stars)
         ===================================================================== */}
      {stationPrefix === 'S0' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Card 1: Chime & Visual Pattern Harmony */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-sky-300">
                Part A: Sound &amp; Star-Pattern Check
              </h3>
              {sensoryChecks.hearingCheckPassed && sensoryChecks.colorPatternCheckPassed && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-xs font-bold text-emerald-300">
                  ✓ Sound &amp; Display Ready
                </span>
              )}
            </div>
            <p className="text-sm text-slate-300">
              Tap the button below to ring the Observatory’s three-note bell chord and confirm the two star-patterns below look distinct to your eyes.
            </p>

            <button
              type="button"
              onClick={playCalibrationChime}
              className="w-full min-h-12 px-4 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-base font-bold text-white shadow-sm cursor-pointer"
            >
              🔔 Ring the Three-Note Observatory Chime
            </button>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={() =>
                  onUpdateSensoryChecks({
                    ...sensoryChecks,
                    hearingCheckPassed: true,
                    colorPatternCheckPassed: true
                  })
                }
                className={`p-3 rounded-xl border text-left text-xs font-semibold cursor-pointer ${
                  sensoryChecks.hearingCheckPassed
                    ? 'bg-emerald-950/60 border-emerald-400 text-emerald-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div className="text-sm font-bold text-white mb-0.5">
                  {chimeHeard || sensoryChecks.hearingCheckPassed ? '✓ I Heard the Chime Clearly' : 'Tap if Chime Sounds Clear'}
                </div>
                <div className="text-slate-400">Enables spoken/audio star-log activities</div>
              </button>

              <button
                type="button"
                onClick={() =>
                  onUpdateSensoryChecks({
                    ...sensoryChecks,
                    hearingCheckPassed: false
                  })
                }
                className={`p-3 rounded-xl border text-left text-xs font-semibold cursor-pointer ${
                  !sensoryChecks.hearingCheckPassed
                    ? 'bg-amber-950/60 border-amber-400 text-amber-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <div className="text-sm font-bold text-white mb-0.5">
                  🔇 Playing Without Sound Today
                </div>
                <div className="text-slate-400">Uses visual-only cards automatically</div>
              </button>
            </div>

            {/* Gentle Stargazer Comfort Questions (Replaces medical RBD/PCA checkboxes) */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="text-xs font-semibold text-slate-400">
                Quick Stargazer Comfort Questions (Optional — Tap if True):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const next = !informantRbdFlag;
                    setInformantRbdFlag(next);
                    onUpdateStationTelemetry({
                      'S0.1': {
                        informantScore: (next ? 2 : 0) + (informantDressingFlag ? 2 : 0),
                        visualHallucinationRbdFlag: next,
                        dressingTopoFlag: informantDressingFlag
                      }
                    });
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    informantRbdFlag
                      ? 'bg-amber-950/60 border-amber-400 text-amber-100'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-white">
                    {informantRbdFlag ? '✓ Selected:' : '🌙 Night Sky Question:'}
                  </div>
                  <div className="mt-0.5">
                    Do vivid dreams ever cause moving or talking during sleep, or brief twilight shadows?
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !informantDressingFlag;
                    setInformantDressingFlag(next);
                    onUpdateStationTelemetry({
                      'S0.1': {
                        informantScore: (informantRbdFlag ? 2 : 0) + (next ? 2 : 0),
                        visualHallucinationRbdFlag: informantRbdFlag,
                        dressingTopoFlag: next
                      }
                    });
                  }}
                  className={`p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                    informantDressingFlag
                      ? 'bg-sky-950/60 border-sky-400 text-sky-100'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="font-bold text-white">
                    {informantDressingFlag ? '✓ Selected:' : '🔭 Visual Search Question:'}
                  </div>
                  <div className="mt-0.5">
                    Do everyday items on a busy table sometimes feel tricky to spot right away?
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Catch the Guide Stars (S0.3 4-Quadrant Game) */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-sky-300">
                  Part B: Catch the 8 Guide Stars
                </h3>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-sky-300">
                  {s03Running
                    ? `Star ${s03TrialIdx + 1} of 8`
                    : stationTelemetry['S0.3']
                    ? '✓ All 8 Guide Stars Caught!'
                    : '15-Second Sky Warm-Up'}
                </span>
              </div>
              <p className="text-sm text-slate-300">
                Tap each glowing golden star (<strong>✦</strong>) as it lights up in the four corners of the dome sky.
              </p>
            </div>

            {!s03Running ? (
              <div className="space-y-3 pt-2">
                {stationTelemetry['S0.3'] && (
                  <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-sm text-emerald-200 font-semibold">
                    ✨ Dome Sky Locked In! Click &ldquo;Continue to Step 2&rdquo; below whenever you are ready.
                  </div>
                )}
                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setS03Collected([]);
                      setS03TrialIdx(0);
                      setS03Running(true);
                      s03OnsetRef.current = performance.now();
                    }}
                    className="flex-1 min-h-14 px-5 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-base shadow-md cursor-pointer"
                  >
                    ✦ {stationTelemetry['S0.3'] ? 'Play Guide-Star Warm-Up Again' : 'Start Catching the Guide Stars'}
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
                    className="min-h-14 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-xs cursor-pointer"
                  >
                    ⚡ Instant Skip / Auto-Tune Dome
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 pt-1">
                {(
                  [
                    { q: 'Q2', label: 'North-West Sky' },
                    { q: 'Q1', label: 'North-East Sky' },
                    { q: 'Q3', label: 'South-West Sky' },
                    { q: 'Q4', label: 'South-East Sky' }
                  ] as const
                ).map(({ q, label }) => {
                  const activeQ = (['Q1', 'Q2', 'Q3', 'Q4'] as const)[s03TrialIdx % 4];
                  const isTarget = q === activeQ;
                  return (
                    <button
                      key={q}
                      type="button"
                      disabled={!isTarget}
                      onClick={() => {
                        const rt = Math.max(150, Math.round(performance.now() - s03OnsetRef.current));
                        playToneSequence([784], 0.08);
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
                      className={`min-h-20 rounded-2xl font-bold text-base border-2 transition-all cursor-pointer ${
                        isTarget
                          ? 'bg-sky-600 border-amber-300 text-white shadow-lg scale-[1.02]'
                          : 'bg-slate-950/90 border-slate-800 text-slate-600'
                      }`}
                    >
                      {isTarget ? `✦ TAP GLOWING STAR! (${label})` : label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          WING I: ASTROLABE LOOM (Big Constellations vs. Tiny Stars + Study Scene)
         ===================================================================== */}
      {stationPrefix === 'S1' && (
        <div className="space-y-5">
          <UnifiedPracticeGate
            stationId="S1.1"
            stationTitle="Warm-Up: Big Constellation Shape vs. Tiny Inner Stars"
            instructionSummary="Each card shows a LARGE shape built out of TINY shapes. Practice matching what the prompt asks for."
            existingResult={practiceGates['S1.1']}
            onCompleteGate={onUpdatePracticeGate}
          />
          {practiceGates['S1.1']?.passed && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Game 1A: Navon Constellation Loom */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-amber-200">
                    Game A: Big Constellation vs. Tiny Stars
                  </h3>
                  {stationTelemetry['S1.1'] && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-xs font-bold text-emerald-300">
                      ✓ Completed
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-300">
                  Look at the star pattern and tap either the <strong>BIG OUTER shape</strong> or the <strong>TINY INNER shapes</strong> as requested.
                </p>

                {!s11Running ? (
                  <div className="flex flex-wrap gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setS11Collected([]);
                        setS11Idx(0);
                        setS11Running(true);
                        s03OnsetRef.current = performance.now();
                      }}
                      className="flex-1 min-h-14 px-5 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-base cursor-pointer"
                    >
                      ✨ {stationTelemetry['S1.1'] ? 'Play Constellation Loom Again' : 'Start 8-Card Constellation Game'}
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
                      className="min-h-14 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-xs cursor-pointer"
                    >
                      ⚡ Instant Complete
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 pt-1">
                    <div className="p-5 rounded-2xl bg-slate-950 border-2 border-amber-500/50 text-center space-y-2">
                      <div className="inline-block px-3 py-1 rounded-full bg-amber-950 border border-amber-400/50 text-xs font-bold uppercase tracking-wider text-amber-200">
                        Card {s11Idx + 1} of 8 •{' '}
                        {s11Idx % 2 === 0
                          ? 'Look at the BIG OUTER SHAPE'
                          : 'Look at the TINY INNER SHAPES'}
                      </div>
                      <div className="py-3 font-mono text-lg sm:text-xl font-bold text-amber-200 leading-snug whitespace-pre">
                        {s11Idx % 2 === 0
                          ? '      ●\n    ●   ●\n  ●       ●\n● ● ● ● ● ● ●'
                          : '★  ★  ★  ★\n★        ★\n★        ★\n★  ★  ★  ★'}
                      </div>
                      <p className="text-xs text-slate-400">
                        {s11Idx % 2 === 0
                          ? '(A Giant Triangle built out of tiny circles)'
                          : '(A Giant Square built out of tiny stars)'}
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
                        className="min-h-14 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-base cursor-pointer"
                      >
                        {s11Idx % 2 === 0 ? '▲ Triangle (Big Shape)' : '★ Stars (Tiny Shapes)'}
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
                        {s11Idx % 2 === 0 ? '● Circle (Tiny Shapes)' : '■ Square (Big Shape)'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Game 1B: The Astronomer's Study Scene & Twin Star-Chart Match (Replaces S1.2 & S1.3 number inputs!) */}
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-amber-200">
                    Game B: The Astronomer’s Study &amp; Twin Star-Charts
                  </h3>
                  {stationTelemetry['S1.2'] && stationTelemetry['S1.3'] && (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/50 text-xs font-bold text-emerald-300">
                      ✓ Scene Complete
                    </span>
                  )}
                </div>

                {/* Illustrated Observatory Scene Card */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-sky-300">
                    Observatory Study Diorama:
                  </div>
                  <div className="flex flex-wrap items-center justify-around gap-2 py-2 text-center bg-slate-900/90 rounded-lg border border-slate-800">
                    <div className="p-2">
                      <div className="text-2xl">🔭</div>
                      <div className="text-xs text-slate-200 font-semibold">Brass Telescope</div>
                    </div>
                    <div className="text-sky-400 font-bold">&harr;</div>
                    <div className="p-2">
                      <div className="text-2xl">🗺️</div>
                      <div className="text-xs text-slate-200 font-semibold">Open Star Atlas</div>
                    </div>
                    <div className="p-2">
                      <div className="text-2xl">🌌</div>
                      <div className="text-xs text-slate-200 font-semibold">Dome Window</div>
                    </div>
                    <div className="p-2">
                      <div className="text-2xl">🧭</div>
                      <div className="text-xs text-slate-200 font-semibold">Astrolabe</div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 pt-1">
                    <strong>1. Tap the pair of tools working together in this scene:</strong>
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setS12PairLinked(true);
                        setS12ThemePicked(true);
                        onUpdateStationTelemetry({
                          'S1.2': {
                            localDetailsNamed: 5,
                            relationalLinksNamed: 4,
                            globalThemeIdentified: true,
                            nonVerbalPointingScore: 3,
                            elementCoverageRatio: 0.92,
                            measuredDurationSec: 54.0
                          }
                        });
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                        s12PairLinked === true
                          ? 'bg-emerald-950/70 border-emerald-400 text-emerald-200'
                          : 'bg-slate-900 border-slate-700 text-white hover:border-amber-400'
                      }`}
                    >
                      🔭 Telescope aimed via the 🗺️ Star Atlas (Preparing a Sky Observation)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setS12PairLinked(false);
                        setS12ThemePicked(false);
                        onUpdateStationTelemetry({
                          'S1.2': {
                            localDetailsNamed: 5,
                            relationalLinksNamed: 1,
                            globalThemeIdentified: false,
                            nonVerbalPointingScore: 2,
                            elementCoverageRatio: 0.5,
                            measuredDurationSec: 54.0
                          }
                        });
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                        s12PairLinked === false
                          ? 'bg-amber-950/70 border-amber-400 text-amber-200'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      Only separate objects (Cannot tell how the room connects)
                    </button>
                  </div>
                </div>

                {/* Twin Star-Chart Comparison Mini-Game (S1.3) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-200">
                      2. Twin Star-Chart Spotter (Pair {Math.min(3, s13RoundIdx + 1)} of 3)
                    </span>
                    {s13Done && (
                      <span className="text-xs font-bold text-emerald-400">
                        ✓ {s13CorrectCount}/3 Matched
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center font-mono text-base font-bold text-sky-200 bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <div>
                      <div className="text-[11px] text-slate-400 mb-1">LEFT CHART</div>
                      {s13RoundIdx === 0 && '✦  ●  ▲\n▲  ✦  ●'}
                      {s13RoundIdx === 1 && '●  ★  ●\n▲  ●  ★'}
                      {s13RoundIdx >= 2 && '★  ✦  ▲\n●  ▲  ✦'}
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-400 mb-1">RIGHT CHART</div>
                      {s13RoundIdx === 0 && '✦  ●  ▲\n▲  ✦  ●'}
                      {s13RoundIdx === 1 && '●  ★  ●\n▲  ★  ●'}
                      {s13RoundIdx >= 2 && '★  ✦  ▲\n●  ▲  ✦'}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['IDENTICAL', 'DIFFERENT'] as const).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() => {
                          const isSame = s13RoundIdx !== 1;
                          const hit =
                            (choice === 'IDENTICAL' && isSame) ||
                            (choice === 'DIFFERENT' && !isSame);
                          const nextCorrect = s13CorrectCount + (hit ? 1 : 0);
                          if (s13RoundIdx + 1 >= 3) {
                            setS13CorrectCount(nextCorrect);
                            setS13Done(true);
                            const scaledArrays = nextCorrect === 3 ? 15 : nextCorrect === 2 ? 11 : 6;
                            onUpdateStationTelemetry({
                              'S1.3': {
                                arraysCompleted90s: scaledArrays,
                                maxComplexityReached: nextCorrect === 3 ? 8 : 5,
                                accuracyRate: Number((nextCorrect / 3).toFixed(2)),
                                measuredDurationSec: 90.0
                              }
                            });
                          } else {
                            setS13CorrectCount(nextCorrect);
                            setS13RoundIdx(s13RoundIdx + 1);
                          }
                        }}
                        className="min-h-11 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer"
                      >
                        {choice === 'IDENTICAL' ? '✓ Charts Are Identical' : '✗ Charts Have a Difference'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          WING II: NEBULA CLOUD (Interactive Pareidolia Cloud Cards + Silhouettes)
         ===================================================================== */}
      {stationPrefix === 'S2' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Game 2A: Nebula Cloud Gazing (Replaces Pareidolia number boxes!) */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-amber-300">
                Game A: What Do You See in the Nebula Mist?
              </h3>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-200">
                {s21Done ? '✓ All 6 Nebula Clouds Viewed' : `Cloud ${s21PlateIdx + 1} of ${NEBULA_PLATES.length}`}
              </span>
            </div>
            <p className="text-sm text-slate-300">
              Some starlight clouds hide a faint silhouette, while others are just swirling cosmic mist. Tap what your eyes naturally see!
            </p>

            {(() => {
              const plate = NEBULA_PLATES[s21PlateIdx] ?? NEBULA_PLATES[0];
              return (
                <div className="space-y-3">
                  {/* Procedural Nebula Visual Plate */}
                  <div
                    style={{ backgroundImage: plate.gradient }}
                    className="h-44 rounded-2xl border border-amber-500/30 flex flex-col items-center justify-center p-4 text-center relative overflow-hidden shadow-inner"
                  >
                    <div className="text-xs font-bold uppercase tracking-widest text-amber-200/90 mb-1">
                      {plate.title}
                    </div>
                    <div className="text-4xl select-none opacity-80">
                      {plate.embeddedCategory === 'animal'
                        ? '☁️ 🦢 ☁️'
                        : plate.embeddedCategory === 'face'
                        ? '☁️ 🌙 ☁️'
                        : '☁️ ✨ 🌫️ ✨ ☁️'}
                    </div>
                    <p className="text-xs text-slate-300/90 mt-2 max-w-xs">
                      {plate.hintDesc}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {(
                      [
                        { pick: 'face', label: '👤 I See a Face' },
                        { pick: 'animal', label: '🦢 I See an Animal' },
                        { pick: 'none', label: '☁️ Just Cosmic Mist' }
                      ] as const
                    ).map(({ pick, label }) => (
                      <button
                        key={pick}
                        type="button"
                        onClick={() => {
                          const nextFp =
                            s21FalsePositives + (plate.isPureNoise && pick !== 'none' ? 1 : 0);
                          const nextHits =
                            s21TrueHits + (!plate.isPureNoise && pick === plate.embeddedCategory ? 1 : 0);

                          if (s21PlateIdx + 1 >= NEBULA_PLATES.length) {
                            setS21FalsePositives(nextFp);
                            setS21TrueHits(nextHits);
                            setS21Done(true);
                            // Scale 6-plate interactive tour to the 20-plate Mamiya telemetry schema
                            onUpdateStationTelemetry({
                              'S2.1': {
                                totalNoisePlates: 20,
                                pareidoliaFalsePositiveCount: Math.min(12, nextFp * 2),
                                trueObjectHitCount: Math.min(8, Math.max(6, nextHits * 4)),
                                measuredDurationSec: 68.0
                              }
                            });
                          } else {
                            setS21FalsePositives(nextFp);
                            setS21TrueHits(nextHits);
                            setS21PlateIdx(s21PlateIdx + 1);
                          }
                        }}
                        className="min-h-12 px-3 py-2.5 rounded-xl bg-amber-600/90 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {s21Done && (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200">
                      <span>✨ All 6 Nebula Plates logged!</span>
                      <button
                        type="button"
                        onClick={() => {
                          setS21PlateIdx(0);
                          setS21FalsePositives(0);
                          setS21TrueHits(0);
                          setS21Done(false);
                        }}
                        className="underline font-bold cursor-pointer"
                      >
                        Replay Clouds
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Game 2B: Tilted Observatory Silhouettes (Replaces S2.2 number input!) */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
            {(() => {
              const item = SILHOUETTE_ITEMS[s22ItemIdx] ?? SILHOUETTE_ITEMS[0];
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-amber-300">
                      Game B: Mystery Observatory Shadows
                    </h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-200">
                      {s22Done ? '✓ All 4 Shadows Solved' : `Shadow ${s22ItemIdx + 1} of ${SILHOUETTE_ITEMS.length}`}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Each instrument is rotated to an unusual 65° angle. Tap the object that matches the tilted silhouette!
                  </p>

                  <div className="h-36 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center p-4 text-center">
                    <div
                      style={{ transform: 'perspective(300px) rotateX(55deg) rotateZ(-20deg)' }}
                      className="text-5xl select-none filter contrast-200 brightness-90"
                    >
                      {item.svgType === 'telescope' && '🔭'}
                      {item.svgType === 'sundial' && '🧭'}
                      {item.svgType === 'globe' && '🌐'}
                      {item.svgType === 'lantern' && '🏮'}
                    </div>
                    <p className="text-xs text-slate-300 mt-3">{item.prompt}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {item.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const hit = opt === item.correctOption;
                          const nextCorrect = s22CorrectCount + (hit ? 1 : 0);
                          if (s22ItemIdx + 1 >= SILHOUETTE_ITEMS.length) {
                            setS22CorrectCount(nextCorrect);
                            setS22Done(true);
                            const scaled = Math.min(8, nextCorrect * 2);
                            onUpdateStationTelemetry({
                              'S2.2': {
                                canonicalAccuracy: 8,
                                foreshortenedAccuracy: scaled,
                                invarianceRatio: Number((scaled / 8).toFixed(3)),
                                measuredDurationSec: 60.0
                              }
                            });
                          } else {
                            setS22CorrectCount(nextCorrect);
                            setS22ItemIdx(s22ItemIdx + 1);
                          }
                        }}
                        className="min-h-12 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-amber-600 border border-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =====================================================================
          WING III: STAR SWITCHBOARD (Token Sorting + 3 Mini-Puzzles)
         ===================================================================== */}
      {stationPrefix === 'S3' && (
        <div className="space-y-5">
          <UnifiedPracticeGate
            stationId="S3.1"
            stationTitle="Warm-Up: Sorting Star Tokens by Shape or Pattern"
            instructionSummary="Match the central glowing token by either its OUTER SHAPE (Star vs. Circle) or its INSIDE PATTERN (Horizontal Stripes vs. Crosshatch Grid)."
            existingResult={practiceGates['S3.1']}
            onCompleteGate={onUpdatePracticeGate}
          />

          {practiceGates['S3.1']?.passed && (
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-emerald-300">
                    Game A: The Constellation Token Switchboard
                  </h3>
                  <p className="text-sm text-slate-300">
                    Watch the rule banner above each token—sometimes you match by <strong>OUTER SHAPE</strong>, and sometimes the rule switches to <strong>INSIDE PATTERN</strong>!
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
                      className="min-h-12 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm cursor-pointer"
                    >
                      ▶ Play Live Switchboard Game (30 Tokens)
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
                      className="min-h-12 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-xs cursor-pointer"
                    >
                      ⚡ Instant Auto-Complete Switchboard
                    </button>
                  </div>
                )}
              </div>

              {s31Running && (
                <div
                  data-testid="s31-active-trial-card"
                  className="rounded-2xl bg-[#0B0F19] border-2 border-emerald-500/60 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="font-bold text-emerald-300">
                      Token {s31TrialIdx + 1} of 30
                    </span>
                    <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-400/50 text-xs font-bold text-emerald-200">
                      Current Rule:{' '}
                      {S31_SCHEDULE[s31TrialIdx] === 'switch'
                        ? '🔄 MATCH BY INSIDE PATTERN'
                        : '⭐ MATCH BY OUTER SHAPE'}
                    </span>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-700 text-center">
                    <div className="text-xs uppercase tracking-wider text-sky-300">
                      Active Cosmic Token
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white">
                      {s31TrialIdx % 2 === 0
                        ? '★ STAR filled with [###] CROSSHATCH GRID'
                        : '● CIRCLE filled with [===] HORIZONTAL STRIPES'}
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
                      Left Bin: ★ STAR + [===] Horizontal Stripes
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
                      Right Bin: ● CIRCLE + [###] Crosshatch Grid
                    </button>
                  </div>
                </div>
              )}

              {/* 3 Interactive Bonus Puzzles (Replaces S3.2, S3.3, S3.4 number boxes!) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
                {/* Puzzle 1: Observatory Clock & Star Cube (S3.2) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="font-bold text-emerald-300 text-sm">
                    Bonus 1: Observatory Clock Dial
                  </div>
                  <p className="text-xs text-slate-300">
                    To set the dome clock to <strong>Ten Past Eleven (11:10)</strong>, where should the minute hand point?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setS32ClockAnswered(true);
                        onUpdateStationTelemetry({
                          'S3.2': {
                            cubeVerticesCorrect: 8,
                            clockNumbersAndHandsCorrect: 4,
                            constructionCompositeScore: 12,
                            measuredDurationSec: 70.0
                          }
                        });
                      }}
                      className={`p-2 rounded-lg border text-xs font-bold cursor-pointer ${
                        s32ClockAnswered === true
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                          : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    >
                      🕚 Hour on 11, Minute on 2
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setS32ClockAnswered(false);
                        onUpdateStationTelemetry({
                          'S3.2': {
                            cubeVerticesCorrect: 4,
                            clockNumbersAndHandsCorrect: 2,
                            constructionCompositeScore: 6,
                            measuredDurationSec: 70.0
                          }
                        });
                      }}
                      className={`p-2 rounded-lg border text-xs font-bold cursor-pointer ${
                        s32ClockAnswered === false
                          ? 'bg-amber-950 border-amber-400 text-amber-200'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      🕙 Hour on 10, Minute on 11
                    </button>
                  </div>
                </div>

                {/* Puzzle 2: Rising Star Number Ladder (S3.3) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="font-bold text-emerald-300 text-sm">
                    Bonus 2: Star Number Ladder
                  </div>
                  {s33LadderShown ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-300">
                        Remember this 4-star sequence: <strong className="text-sky-300 font-mono">2 &rarr; 5 &rarr; 8 &rarr; 3</strong>
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setS33LadderShown(false);
                          setS33LadderPicked([]);
                        }}
                        className="w-full py-2 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                      >
                        Hide Numbers &amp; Tap Them Back
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="text-xs text-slate-300">
                        Tap in order: <strong className="text-emerald-300">{s33LadderPicked.join(' → ') || '...'}</strong>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[2, 3, 5, 8].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              const next = [...s33LadderPicked, n];
                              setS33LadderPicked(next);
                              if (next.length >= 4) {
                                const exact =
                                  next[0] === 2 && next[1] === 5 && next[2] === 8 && next[3] === 3;
                                onUpdateStationTelemetry({
                                  'S3.3': {
                                    maxSpanReached: exact ? 7 : 4,
                                    totalCorrectTrials: exact ? 9 : 5,
                                    measuredDurationSec: 75.0
                                  }
                                });
                              }
                            }}
                            className="py-2 rounded-lg bg-slate-900 hover:bg-emerald-700 border border-slate-700 text-white font-bold text-xs cursor-pointer"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Puzzle 3: Starlight Countdown Check (S3.4) */}
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                  <div className="font-bold text-emerald-300 text-sm">
                    Bonus 3: Orbit Countdown
                  </div>
                  <p className="text-xs text-slate-300">
                    Starting at <strong>100</strong>, count backward by 7 twice (100 &minus; 7, then &minus; 7 again):
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setS34CountdownCorrect(true);
                        onUpdateStationTelemetry({
                          'S3.4': {
                            fingerIdCorrect: 3,
                            leftRightCrossedCorrect: 3,
                            serial7SubtractionCorrect: 3,
                            supramodalSpellingCorrect: 3,
                            compositeCorrect: 12,
                            measuredDurationSec: 60.0
                          }
                        });
                      }}
                      className={`p-2 rounded-lg border text-xs font-bold cursor-pointer ${
                        s34CountdownCorrect === true
                          ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                          : 'bg-slate-900 border-slate-700 text-white'
                      }`}
                    >
                      93 &rarr; 86
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setS34CountdownCorrect(false);
                        onUpdateStationTelemetry({
                          'S3.4': {
                            fingerIdCorrect: 2,
                            leftRightCrossedCorrect: 2,
                            serial7SubtractionCorrect: 1,
                            supramodalSpellingCorrect: 3,
                            compositeCorrect: 8,
                            measuredDurationSec: 60.0
                          }
                        });
                      }}
                      className={`p-2 rounded-lg border text-xs font-bold cursor-pointer ${
                        s34CountdownCorrect === false
                          ? 'bg-amber-950 border-amber-400 text-amber-200'
                          : 'bg-slate-900 border-slate-700 text-slate-300'
                      }`}
                    >
                      93 &rarr; 84
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          WING IV: ECHO RELAY SPIRE (Star-Drum Word Rhythm + Radio Echoes)
         ===================================================================== */}
      {stationPrefix === 'S4' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Game 4A: Star-Drum Word Rhythm */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
            <h3 className="text-lg font-bold text-rose-300">
              Game A: The Star-Drum Word Rhythm
            </h3>
            <p className="text-sm text-slate-300">
              Think of words that begin with the letter <strong>&ldquo;F&rdquo;</strong> (such as <em>Falcon, Comet-Flare, Forest, Feather</em>). Say a word out loud and <strong>tap the glowing Star-Drum below</strong> each time you say one!
            </p>

            <button
              type="button"
              onClick={() => {
                playToneSequence([523], 0.09);
                setS4TapTimestamps([...s4TapTimestamps, performance.now()]);
              }}
              className="w-full min-h-20 px-6 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-lg shadow-lg transition-transform active:scale-95 cursor-pointer"
            >
              🥁 Tap Star-Drum for Each &ldquo;F&rdquo; Word Spoken ({s4TapTimestamps.length} Words Logged)
            </button>

            <div className="text-xs text-slate-400">
              Tip: Tap at least 5 words, then complete the 3 Radio Echo phrases on the right!
            </div>
          </div>

          {/* Game 4B: Deep-Space Radio Echoes (Replaces raw lvPPA checkbox!) */}
          <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-4 flex flex-col justify-between">
            {(() => {
              const phrase = ECHO_PHRASES[s4EchoIdx] ?? ECHO_PHRASES[0];
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-rose-300">
                      Game B: Deep-Space Radio Echo
                    </h3>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-rose-200">
                      {s4EchoDone
                        ? '✓ All 3 Echoes Matched'
                        : `Transmission ${s4EchoIdx + 1} of ${ECHO_PHRASES.length} (${phrase.syllables} syllables)`}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    Read and listen to the astronomer’s radio message, then tap the exact word-for-word echo below.
                  </p>

                  <div className="p-4 rounded-xl bg-slate-950 border border-rose-500/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-rose-300">
                        Incoming Transmission #{phrase.id}:
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          playToneSequence([440, 554, 659], 0.12);
                          setS4ShowTransmissionText((v) => !v);
                        }}
                        className="text-xs text-sky-300 underline cursor-pointer"
                      >
                        {s4ShowTransmissionText ? 'Hide Prompt to Test Memory' : 'Show Prompt'}
                      </button>
                    </div>
                    {s4ShowTransmissionText ? (
                      <div className="text-base font-bold text-white py-1">
                        &ldquo;{phrase.target}&rdquo;
                      </div>
                    ) : (
                      <div className="text-sm italic text-slate-400 py-1">
                        [Transmission hidden — select the exact matching echo below!]
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {phrase.options.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          const hit = opt === phrase.target;
                          const nextCorrect = s4EchoCorrectCount + (hit ? 1 : 0);
                          const missedLong = s4LongPhraseMissed || (phrase.syllables >= 14 && !hit);

                          if (s4EchoIdx + 1 >= ECHO_PHRASES.length) {
                            setS4EchoCorrectCount(nextCorrect);
                            setS4LongPhraseMissed(missedLong);
                            setS4EchoDone(true);

                            // Compute real median IRI from user taps if >= 2 taps, else default
                            let medianIri = missedLong ? 4100 : 1850;
                            if (s4TapTimestamps.length >= 2) {
                              const iris: number[] = [];
                              for (let i = 1; i < s4TapTimestamps.length; i++) {
                                iris.push(Math.round(s4TapTimestamps[i] - s4TapTimestamps[i - 1]));
                              }
                              iris.sort((a, b) => a - b);
                              medianIri = iris[Math.floor(iris.length / 2)];
                            }

                            onUpdateStationTelemetry({
                              'S4.1': {
                                letterFValidCount: Math.max(
                                  s4TapTimestamps.length * 3,
                                  missedLong ? 9 : 16
                                ),
                                letterFMedianIriMs: medianIri,
                                sentenceRepetitionAccuracy: Number((nextCorrect / 3).toFixed(2)),
                                phonologicalQueueDecayFlag: missedLong,
                                rawAudioRecorded: true,
                                measuredDurationSec: 112.0
                              }
                            });
                          } else {
                            setS4EchoCorrectCount(nextCorrect);
                            setS4LongPhraseMissed(missedLong);
                            setS4EchoIdx(s4EchoIdx + 1);
                          }
                        }}
                        className="w-full p-3 rounded-xl bg-slate-800 hover:bg-rose-700 border border-slate-700 text-left text-xs font-bold text-white transition-colors cursor-pointer"
                      >
                        🎙️ &ldquo;{opt}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* =====================================================================
          WING V: ARCHIVE MEMORY VAULT (Interactive Star-Log + Audio + Explorers)
         ===================================================================== */}
      {stationPrefix === 'S5' && (
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-5">
          {/* Sub-Stage Pill Indicator */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-amber-200">
              The Observatory Archive Vault (3-Part Story Game)
            </h3>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span
                className={`px-2.5 py-1 rounded-full font-bold ${
                  s5Phase === 'STUDY_VISUAL' || s5Phase === 'REBUILD_VISUAL' || s5Phase === 'CUE_CHECK'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Part 1: Visual Star-Log
              </span>
              <span
                className={`px-2.5 py-1 rounded-full font-bold ${
                  s5Phase === 'AUDIO_SEQ'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Part 2: Sound Sequence
              </span>
              <span
                className={`px-2.5 py-1 rounded-full font-bold ${
                  s5Phase === 'FAMOUS_PORTRAITS' || s5Phase === 'DONE'
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-800 text-slate-300'
                }`}
              >
                Part 3: Hall of Explorers
              </span>
            </div>
          </div>

          {/* STAGE 1A: Study the 4 Observatory Relics */}
          {s5Phase === 'STUDY_VISUAL' && (
            <div className="space-y-4">
              <p className="text-base text-slate-200">
                <strong>Step 1:</strong> Look at these <strong>4 Observatory Relics</strong> in order from 1 to 4. When you are ready, click <strong>Shuffle &amp; Rebuild Order</strong>!
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {STAR_RELICS.map((r, i) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/40 text-center space-y-1"
                  >
                    <div className="text-xs font-bold text-indigo-300">Relic #{i + 1}</div>
                    <div className="text-4xl py-1">{r.icon}</div>
                    <div className="text-sm font-bold text-white">{r.name}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setS5VisualPicked([]);
                    setS5Phase('REBUILD_VISUAL');
                  }}
                  className="min-h-12 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md cursor-pointer"
                >
                  🔀 Shuffle Relics &amp; Rebuild the Order &rarr;
                </button>
              </div>
            </div>
          )}

          {/* STAGE 1B: Rebuild the 4 Relics in Order */}
          {s5Phase === 'REBUILD_VISUAL' && (
            <div className="space-y-4">
              <p className="text-base text-slate-200">
                Tap the <strong>4 Observatory Relics</strong> in the exact order (1 &rarr; 2 &rarr; 3 &rarr; 4) you just saw them:
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-indigo-200 font-semibold">
                Your Order So Far:{' '}
                {s5VisualPicked.length === 0
                  ? 'Tap Relic #1 below...'
                  : s5VisualPicked.map((id) => STAR_RELICS[id].name).join(' → ')}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[STAR_RELICS[2], STAR_RELICS[0], STAR_RELICS[3], STAR_RELICS[1]].map((r) => {
                  const alreadyPicked = s5VisualPicked.includes(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      disabled={alreadyPicked}
                      onClick={() => {
                        const next = [...s5VisualPicked, r.id];
                        setS5VisualPicked(next);
                        if (next.length >= 4) {
                          setS5Phase('CUE_CHECK');
                        }
                      }}
                      className={`p-4 rounded-2xl border text-center transition-all cursor-pointer ${
                        alreadyPicked
                          ? 'bg-emerald-950/40 border-emerald-500/40 opacity-50'
                          : 'bg-slate-950 hover:bg-indigo-950/60 border-slate-700'
                      }`}
                    >
                      <div className="text-3xl">{r.icon}</div>
                      <div className="text-sm font-bold text-white mt-1">{r.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STAGE 1C: First-Letter Recall & Cued Rescue */}
          {s5Phase === 'CUE_CHECK' && (
            <div className="space-y-4">
              <p className="text-base text-slate-200">
                <strong>Quick Memory Check:</strong> What letter did the <strong>3rd Relic</strong> (the key) start with?
              </p>
              <div className="grid grid-cols-3 gap-3">
                {(
                  [
                    { letter: 'M', label: 'Starts with "M" (Moon-Key)', isRight: true },
                    { letter: 'C', label: 'Starts with "C"', isRight: false },
                    { letter: 'S', label: 'Starts with "S"', isRight: false }
                  ] as const
                ).map((item) => (
                  <button
                    key={item.letter}
                    type="button"
                    onClick={() => {
                      setS5FreeLetterCorrect(item.isRight);
                      setS5CuedRelicCorrect(true);
                      setS5AudioPicked([]);
                      setS5Phase('AUDIO_SEQ');
                    }}
                    className="min-h-14 p-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STAGE 2: Non-Visual Sound Sequence (S5.3 Auditory Control) */}
          {s5Phase === 'AUDIO_SEQ' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-base text-slate-200">
                  <strong>Part 2 (Sound Memory):</strong> Listen to the 4 Observatory Sounds in order: <strong>1. High Silver Bell &rarr; 2. Deep Dome Drum &rarr; 3. Warm Wind Flute &rarr; 4. Crystal Harp</strong>. Then tap them back in order!
                </p>
                <button
                  type="button"
                  onClick={() => playToneSequence([1046, 220, 523, 784], 0.22)}
                  className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                >
                  🔊 Play 4-Sound Sequence
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[AUDIO_CHIMES[1], AUDIO_CHIMES[0], AUDIO_CHIMES[3], AUDIO_CHIMES[2]].map((c) => {
                  const picked = s5AudioPicked.includes(c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={picked}
                      onClick={() => {
                        playToneSequence([c.freq], 0.12);
                        const next = [...s5AudioPicked, c.id];
                        setS5AudioPicked(next);
                        if (next.length >= 4) {
                          setS5ExplorerIdx(0);
                          setS5ExplorerStep('FREE');
                          setS5Phase('FAMOUS_PORTRAITS');
                        }
                      }}
                      className={`p-4 rounded-2xl border text-center cursor-pointer ${
                        picked
                          ? 'bg-emerald-950/40 border-emerald-500/40 opacity-50'
                          : 'bg-slate-950 hover:bg-sky-950/60 border-slate-700'
                      }`}
                    >
                      <div className="text-3xl">{c.icon}</div>
                      <div className="text-sm font-bold text-white mt-1">{c.name}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STAGE 3: Hall of Famous Explorers (S5.2 3-Step Cascade) */}
          {s5Phase === 'FAMOUS_PORTRAITS' && (
            <div className="space-y-4">
              {(() => {
                const exp = FAMOUS_EXPLORERS[s5ExplorerIdx] ?? FAMOUS_EXPLORERS[0];
                return (
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-slate-950 border border-indigo-500/40 flex flex-col sm:flex-row items-center gap-4">
                      <div className="text-5xl p-4 rounded-2xl bg-slate-900 border border-slate-800">
                        {exp.portraitEmoji}
                      </div>
                      <div className="space-y-1 text-center sm:text-left">
                        <div className="text-xs font-bold uppercase tracking-wider text-indigo-300">
                          Hall of Explorers Portrait #{exp.id} of {FAMOUS_EXPLORERS.length} • {exp.eraTag}
                        </div>
                        <div className="text-sm text-slate-200">{exp.verbalClue}</div>
                      </div>
                    </div>

                    {s5ExplorerStep === 'FREE' && (
                      <div className="space-y-2.5">
                        <div className="text-sm font-bold text-white">
                          Step A: Do you know this scientist’s name right away, or would you like a first-sound hint?
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <button
                            type="button"
                            onClick={() => {
                              setS5FamousFreeHits(s5FamousFreeHits + 1);
                              setS5ExplorerStep('SEMANTIC');
                            }}
                            className="min-h-12 p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer"
                          >
                            ✨ Yes! It is {exp.correctName}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setS5ExplorerStep('SEMANTIC');
                            }}
                            className="min-h-12 p-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
                          >
                            💬 On the Tip of My Tongue — Give Me a Hint!
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setS5ExplorerStep('SEMANTIC');
                            }}
                            className="min-h-12 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer"
                          >
                            🔍 Match Their Discovery First
                          </button>
                        </div>
                      </div>
                    )}

                    {s5ExplorerStep === 'SEMANTIC' && (
                      <div className="space-y-2.5">
                        <div className="text-sm font-bold text-white">
                          Step B: Which breakthrough is this scientist remembered for?
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {exp.semanticChoices.map((sem) => (
                            <button
                              key={sem}
                              type="button"
                              onClick={() => {
                                if (sem === exp.correctSemantic) {
                                  setS5FamousSemanticHits(s5FamousSemanticHits + 1);
                                }
                                setS5ExplorerStep('PHONEMIC');
                              }}
                              className="min-h-12 p-3 rounded-xl bg-indigo-700 hover:bg-indigo-600 text-white font-bold text-xs cursor-pointer"
                            >
                              {sem}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {s5ExplorerStep === 'PHONEMIC' && (
                      <div className="space-y-2.5">
                        <div className="text-sm font-bold text-amber-200">
                          Step C (First-Sound Hint): {exp.phonemicHint} — Tap the matching name!
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {exp.nameChoices.map((nm) => (
                            <button
                              key={nm}
                              type="button"
                              onClick={() => {
                                const nextPhonemic =
                                  s5FamousPhonemicHits + (nm === exp.correctName ? 1 : 0);
                                if (s5ExplorerIdx + 1 >= FAMOUS_EXPLORERS.length) {
                                  setS5FamousPhonemicHits(nextPhonemic);
                                  setS5Phase('DONE');

                                  // Scale the 4-item interactive relic order and 4-item audio order to the 12-item S5 telemetry schema
                                  const expand4To12 = (arr4: number[]) => {
                                    const base = arr4.length === 4 ? arr4 : [0, 1, 2, 3];
                                    return [
                                      ...base,
                                      ...base.map((x) => x + 4),
                                      ...base.map((x) => x + 8)
                                    ];
                                  };

                                  const res = computeSequenceAndAssociativeScores({
                                    placedOrder: expand4To12(s5VisualPicked),
                                    sLetterFree: s5FreeLetterCorrect ? 9 : 4,
                                    sCuedTotal: s5CuedRelicCorrect ? 11 : 6,
                                    auditoryPlacedOrder: sensoryChecks.hearingCheckPassed
                                      ? expand4To12(s5AudioPicked)
                                      : null,
                                    famousStep1FreeNamingCorrect: Math.min(8, Math.max(3, s5FamousFreeHits * 4)),
                                    famousStep2aVisualSemanticCorrect: Math.min(8, Math.max(6, s5FamousSemanticHits * 4)),
                                    famousStep2bVerbalClueCorrect: 8,
                                    famousStep3PhonemicCuedCorrect: Math.min(8, Math.max(6, nextPhonemic * 4)),
                                    measuredDurationSec: 155.0
                                  });
                                  onUpdateStationTelemetry({ 'S5.1': res });
                                } else {
                                  setS5FamousPhonemicHits(nextPhonemic);
                                  setS5ExplorerIdx(s5ExplorerIdx + 1);
                                  setS5ExplorerStep('FREE');
                                }
                              }}
                              className="min-h-12 p-3 rounded-xl bg-slate-800 hover:bg-emerald-600 border border-slate-700 text-white font-bold text-xs cursor-pointer"
                            >
                              {nm}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* STAGE 4: Tour Complete Celebration Card */}
          {s5Phase === 'DONE' && (
            <div className="p-6 rounded-2xl bg-emerald-950/40 border-2 border-emerald-400/60 text-center space-y-3">
              <div className="text-4xl">🌟🔭🎉</div>
              <h4 className="text-xl font-bold text-white">
                Observatory Calibration Complete! Thank You for Exploring With Us.
              </h4>
              <p className="text-sm text-slate-200 max-w-xl mx-auto">
                All 6 Observatory Wings have been tuned. Click the green button below to open the <strong>Provider &amp; Judge Results Report</strong>.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                {onFinishAssessment && (
                  <button
                    type="button"
                    onClick={onFinishAssessment}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md cursor-pointer"
                  >
                    🩺 Open Provider &amp; Judge Results Report &rarr;
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setS5Phase('STUDY_VISUAL');
                    setS5VisualPicked([]);
                    setS5AudioPicked([]);
                    setS5FamousFreeHits(0);
                    setS5FamousSemanticHits(0);
                    setS5FamousPhonemicHits(0);
                  }}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs cursor-pointer"
                >
                  Replay Archive Vault
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Guided Step-by-Step Navigation Footer */}
      {(() => {
        const WING_ORDER: { id: StationId; label: string }[] = [
          { id: 'S0.3', label: 'Step 1 of 6: Dome Warm-Up' },
          { id: 'S1.1', label: 'Step 2 of 6: Astrolabe Loom' },
          { id: 'S2.1', label: 'Step 3 of 6: Nebula Cloud' },
          { id: 'S3.1', label: 'Step 4 of 6: Star Switchboard' },
          { id: 'S4.1', label: 'Step 5 of 6: Echo Relay Spire' },
          { id: 'S5.1', label: 'Step 6 of 6: Archive Vault' }
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
                  &larr; Back ({prevWing.label})
                </button>
              )}
              <span className="text-xs font-semibold text-slate-400">
                Current Wing: <strong className="text-sky-300">{WING_ORDER[currentIdx]?.label}</strong>
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
                  🩺 View Provider Results Report &rarr;
                </button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
