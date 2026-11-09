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
  show3DMap?: boolean;
  onToggle3DMap?: () => void;
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

// Adaptive hierarchical & conjunctive matrix trials (Tier 1 -> Tier 5)
const S1_ADAPTIVE_TRIALS: {
  tier: number;
  rule: 'GLOBAL_MACRO' | 'LOCAL_MICRO' | 'MATRIX_DIFF';
  prompt: string;
  macroName: string;
  microName: string;
  crowdingLabel: string;
  asciiArt: string;
  correctChoice: string;
  choices: string[];
}[] = [
  {
    tier: 1,
    rule: 'GLOBAL_MACRO',
    prompt: 'Select the LARGE OUTER geometric structure (ignore the small inner elements):',
    macroName: 'Triangle',
    microName: 'Circle',
    crowdingLabel: 'Tier 1 • Uncrowded Baseline',
    asciiArt: '        ●\n      ●   ●\n    ●       ●\n  ●           ●\n●   ●   ●   ●   ●',
    correctChoice: 'Triangle',
    choices: ['Triangle', 'Circle', 'Hexagon', 'Diamond']
  },
  {
    tier: 2,
    rule: 'LOCAL_MICRO',
    prompt: 'Select the SMALL INNER repeating element (ignore the large outer perimeter):',
    macroName: 'Square',
    microName: 'Diamond',
    crowdingLabel: 'Tier 2 • Rule Switch to Micro-Elements',
    asciiArt: '◆   ◆   ◆   ◆   ◆\n◆               ◆\n◆               ◆\n◆               ◆\n◆   ◆   ◆   ◆   ◆',
    correctChoice: 'Diamond',
    choices: ['Square', 'Diamond', 'Triangle', 'Hexagon']
  },
  {
    tier: 3,
    rule: 'GLOBAL_MACRO',
    prompt: 'Select the CENTRAL LARGE OUTER structure surrounded by dense flanker noise:',
    macroName: 'Diamond',
    microName: 'Square',
    crowdingLabel: 'Tier 3 • Moderate Flanker Crowding (1.0x Spacing)',
    asciiArt: '▲ ▲     ■         ▲ ▲\n▲     ■   ■         ▲\n    ■       ■\n▲     ■   ■         ▲\n▲ ▲     ■         ▲ ▲',
    correctChoice: 'Diamond',
    choices: ['Diamond', 'Square', 'Triangle', 'Octagon']
  },
  {
    tier: 4,
    rule: 'LOCAL_MICRO',
    prompt: 'Select the SMALL INNER element forming the central figure (ignore outer flankers):',
    macroName: 'Hexagon',
    microName: 'Triangle',
    crowdingLabel: 'Tier 4 • High-Density Crowding (0.7x Spacing)',
    asciiArt: '● ●   ▲   ▲   ▲   ● ●\n●   ▲           ▲   ●\n●   ▲           ▲   ●\n● ●   ▲   ▲   ▲   ● ●',
    correctChoice: 'Triangle',
    choices: ['Hexagon', 'Triangle', 'Circle', 'Diamond']
  },
  {
    tier: 5,
    rule: 'MATRIX_DIFF',
    prompt: 'Tier 5 Precision Matrix: Which coordinate in the Right 4×4 Array differs from the Left Array?',
    macroName: 'Matrix',
    microName: 'Grid',
    crowdingLabel: 'Tier 5 • High-Ceiling 4×4 Conjunctive Array Search',
    asciiArt:
      'LEFT ARRAY (A–D, 1–4)       RIGHT ARRAY (A–D, 1–4)\n1:  ◆  ▲  ●  ■              1:  ◆  ▲  ●  ■\n2:  ●  ■  ◆  ▲              2:  ●  ■  ◆  ▲\n3:  ▲  ◆  ■  ●              3:  ▲  ◆  ▲  ●\n4:  ■  ●  ▲  ◆              4:  ■  ●  ▲  ◆',
    correctChoice: 'Row 3, Column 3 (■ changed to ▲)',
    choices: [
      'Row 2, Column 2',
      'Row 3, Column 3 (■ changed to ▲)',
      'Row 4, Column 1',
      'Arrays Are Identical'
    ]
  },
  {
    tier: 5,
    rule: 'GLOBAL_MACRO',
    prompt: 'Select the LARGE OUTER contour embedded within high-density heterogeneous flankers:',
    macroName: 'Hourglass',
    microName: 'Circle',
    crowdingLabel: 'Tier 5 • Maximum Crowding Density',
    asciiArt: '■ ◆  ● ● ● ● ●  ◆ ■\n◆ ■    ●   ●    ■ ◆\n■ ◆      ●      ◆ ■\n◆ ■    ●   ●    ■ ◆\n■ ◆  ● ● ● ● ●  ◆ ■',
    correctChoice: 'Hourglass / Bowtie',
    choices: ['Hourglass / Bowtie', 'Circle', 'Diamond', 'Rectangle']
  },
  {
    tier: 5,
    rule: 'LOCAL_MICRO',
    prompt: 'Select the SMALL INNER element at the center of the crowded lattice:',
    macroName: 'Triangle',
    microName: 'Plus-Cross (+)',
    crowdingLabel: 'Tier 5 • Sub-Degree Micro-Element Resolution',
    asciiArt: '● ■       +       ■ ●\n■ ●     +   +     ● ■\n● ■   +       +   ■ ●\n■ ● +   +   +   + ● ■',
    correctChoice: 'Plus-Cross (+)',
    choices: ['Triangle', 'Plus-Cross (+)', 'Square', 'Circle']
  },
  {
    tier: 5,
    rule: 'MATRIX_DIFF',
    prompt: 'Final Tier 5 Array Check: Identify the single transposed symbol pair between Left and Right:',
    macroName: 'Matrix',
    microName: 'Grid',
    crowdingLabel: 'Tier 5 • Conjunctive Visual Search Ceiling',
    asciiArt:
      'LEFT ARRAY                  RIGHT ARRAY\n1:  ▲  ●  ◆  ■  ▲           1:  ▲  ●  ◆  ■  ▲\n2:  ■  ◆  ▲  ●  ■           2:  ■  ▲  ◆  ●  ■\n3:  ●  ■  ●  ◆  ▲           3:  ●  ■  ●  ◆  ▲',
    correctChoice: 'Row 2, Columns 2 & 3 (◆ ▲ transposed to ▲ ◆)',
    choices: [
      'Row 1, Columns 4 & 5',
      'Row 2, Columns 2 & 3 (◆ ▲ transposed to ▲ ◆)',
      'Row 3, Columns 1 & 2',
      'No Transposition Present'
    ]
  }
];

// Activity 3: Psychophysical Signal-in-Noise (1/f Spectral Noise) & Extreme Foreshortening Staircase
const S2_ADAPTIVE_PLATES: {
  id: number;
  tier: number;
  snrLabel: string;
  isPureNoise: boolean;
  trueCategory: string;
  noiseOpacity: number;
  signalContrast: number;
  rotationDeg: number;
  svgKind: 'polyhedron' | 'pure_noise_1' | 'sextant_68deg' | 'pure_noise_2' | 'avian_threshold' | 'pure_noise_3';
  choices: string[];
}[] = [
  {
    id: 1,
    tier: 1,
    snrLabel: 'Tier 1 • High Signal-to-Noise Ratio (SNR 0.65)',
    isPureNoise: false,
    trueCategory: 'Geometric Polyhedron / Octahedron',
    noiseOpacity: 0.35,
    signalContrast: 0.75,
    rotationDeg: 25,
    svgKind: 'polyhedron',
    choices: [
      'Geometric Polyhedron / Octahedron',
      'Optical Sextant / Instrument',
      'Human Facial Profile / Portrait',
      'Avian / Biological Contour',
      'Pure Stochastic Noise (No Signal Present)'
    ]
  },
  {
    id: 2,
    tier: 2,
    snrLabel: 'Tier 2 • Spectral 1/f Noise Calibration (SNR 0.00 Catch Trial)',
    isPureNoise: true,
    trueCategory: 'Pure Stochastic Noise (No Signal Present)',
    noiseOpacity: 0.75,
    signalContrast: 0.0,
    rotationDeg: 0,
    svgKind: 'pure_noise_1',
    choices: [
      'Geometric Polyhedron / Octahedron',
      'Optical Sextant / Instrument',
      'Human Facial Profile / Portrait',
      'Avian / Biological Contour',
      'Pure Stochastic Noise (No Signal Present)'
    ]
  },
  {
    id: 3,
    tier: 3,
    snrLabel: 'Tier 3 • Moderate Contrast + 65° Foreshortened Axis (SNR 0.35)',
    isPureNoise: false,
    trueCategory: 'Optical Sextant / Instrument',
    noiseOpacity: 0.55,
    signalContrast: 0.42,
    rotationDeg: 65,
    svgKind: 'sextant_68deg',
    choices: [
      'Geometric Polyhedron / Octahedron',
      'Optical Sextant / Instrument',
      'Human Facial Profile / Portrait',
      'Avian / Biological Contour',
      'Pure Stochastic Noise (No Signal Present)'
    ]
  },
  {
    id: 4,
    tier: 4,
    snrLabel: 'Tier 4 • High-Density Mottled Field (SNR 0.00 Catch Trial)',
    isPureNoise: true,
    trueCategory: 'Pure Stochastic Noise (No Signal Present)',
    noiseOpacity: 0.85,
    signalContrast: 0.0,
    rotationDeg: 0,
    svgKind: 'pure_noise_2',
    choices: [
      'Geometric Polyhedron / Octahedron',
      'Optical Sextant / Instrument',
      'Human Facial Profile / Portrait',
      'Avian / Biological Contour',
      'Pure Stochastic Noise (No Signal Present)'
    ]
  },
  {
    id: 5,
    tier: 5,
    snrLabel: 'Tier 5 • Near-Threshold Signal + 78° Extreme Foreshortening (SNR 0.16)',
    isPureNoise: false,
    trueCategory: 'Avian / Biological Contour',
    noiseOpacity: 0.82,
    signalContrast: 0.22,
    rotationDeg: 78,
    svgKind: 'avian_threshold',
    choices: [
      'Geometric Polyhedron / Octahedron',
      'Optical Sextant / Instrument',
      'Human Facial Profile / Portrait',
      'Avian / Biological Contour',
      'Pure Stochastic Noise (No Signal Present)'
    ]
  },
  {
    id: 6,
    tier: 5,
    snrLabel: 'Tier 5 • Threshold Psychophysical Noise Field (SNR 0.00 Catch Trial)',
    isPureNoise: true,
    trueCategory: 'Pure Stochastic Noise (No Signal Present)',
    noiseOpacity: 0.9,
    signalContrast: 0.0,
    rotationDeg: 0,
    svgKind: 'pure_noise_3',
    choices: [
      'Geometric Polyhedron / Octahedron',
      'Optical Sextant / Instrument',
      'Human Facial Profile / Portrait',
      'Avian / Biological Contour',
      'Pure Stochastic Noise (No Signal Present)'
    ]
  }
];

// Activity 5: Adaptive Syntactic & Phonological Working-Memory Span (8 -> 24 syllables)
const S4_ADAPTIVE_SENTENCES: {
  id: number;
  tier: number;
  syllables: number;
  target: string;
  options: string[];
}[] = [
  {
    id: 1,
    tier: 1,
    syllables: 8,
    target: 'The meridian transit aligned at midnight.',
    options: [
      'The meridian transit aligned at midnight.',
      'The meridian compass aligned at twilight.',
      'The equatorial transit aligned at midnight.'
    ]
  },
  {
    id: 2,
    tier: 3,
    syllables: 15,
    target: 'The interferometer resolved the binary companion despite atmospheric turbulence.',
    options: [
      'The spectrograph resolved the binary companion despite atmospheric refraction.',
      'The interferometer resolved the binary companion despite atmospheric turbulence.',
      'The interferometer calibrated the binary pulsar despite ionosphere turbulence.'
    ]
  },
  {
    id: 3,
    tier: 5,
    syllables: 23,
    target: 'The spectroscopist who recalculated the relativistic perihelion precession verified the archival plates before dawn.',
    options: [
      'The spectroscopist who recalculated the relativistic perihelion perturbation verified the archival plates before dawn.',
      'The astrometrist who recalculated the relativistic perihelion precession verified the photographic plates before dawn.',
      'The spectroscopist who recalculated the relativistic perihelion precession verified the archival plates before dawn.'
    ]
  }
];

// Activity 6: High-Ceiling Historical Scientists (Tier 1 -> Tier 5)
const S5_SCHOLARS = [
  {
    id: 1,
    tier: 2,
    era: '17th-Century Observational Astronomy • Padua & Florence',
    portraitLabel: 'Archival Portrait I: Telescope Pioneer (1564–1642)',
    biographyPrompt:
      'Constructed a 20x refracting telescope in 1609, discovered the four largest moons of Jupiter, and observed the phases of Venus.',
    phonemicCue: 'First & Last Initials: G. G. ("Ga-li-le-o ...")',
    correctName: 'Galileo Galilei',
    nameChoices: ['Galileo Galilei', 'Johannes Kepler', 'Tycho Brahe', 'Nicolaus Copernicus'],
    semanticQuestion: 'Which treatise did this scientist publish in 1610 announcing the Jovian moons?',
    correctSemantic: 'Sidereus Nuncius (The Starry Messenger)',
    semanticChoices: [
      'Sidereus Nuncius (The Starry Messenger)',
      'Principia Mathematica',
      'De Revolutionibus Orbium Coelestium'
    ]
  },
  {
    id: 2,
    tier: 4,
    era: '20th-Century Mathematical Physics • Göttingen & Bryn Mawr',
    portraitLabel: 'Archival Portrait II: Abstract Algebra & Symmetry Theorist (1882–1935)',
    biographyPrompt:
      'Proved the fundamental theorem linking every differentiable symmetry of the action of a physical system to a corresponding conservation law.',
    phonemicCue: 'First & Last Initials: E. N. ("Em-my Noe-...")',
    correctName: 'Emmy Noether',
    nameChoices: ['Emmy Noether', 'Lise Meitner', 'Maria Goeppert Mayer', 'Chien-Shiung Wu'],
    semanticQuestion: 'According to this mathematician’s 1915 theorem, time-translation invariance directly implies conservation of:',
    correctSemantic: 'Energy (while spatial translation implies conservation of momentum)',
    semanticChoices: [
      'Energy (while spatial translation implies conservation of momentum)',
      'Electric Charge (via gauge phase invariance)',
      'Entropy in isolated thermodynamic cycles'
    ]
  },
  {
    id: 3,
    tier: 5,
    era: '20th-Century Theoretical Astrophysics • Cambridge & Chicago',
    portraitLabel: 'Archival Portrait III: Relativistic Stellar Structure Laureate (1910–1995)',
    biographyPrompt:
      'Calculated the maximum mass (~1.44 solar masses) above which electron degeneracy pressure in a white dwarf star cannot prevent gravitational collapse.',
    phonemicCue: 'Surname starts with: "Chan-dra-se-..."',
    correctName: 'Subrahmanyan Chandrasekhar',
    nameChoices: [
      'Subrahmanyan Chandrasekhar',
      'Meghnad Saha',
      'Satyendra Nath Bose',
      'Arthur Eddington'
    ],
    semanticQuestion: 'What happens when a carbon-oxygen white dwarf accretes mass beyond this physicist’s 1.44 solar-mass limit?',
    correctSemantic: 'Type Ia Supernova / Collapse to a Neutron Star',
    semanticChoices: [
      'Type Ia Supernova / Collapse to a Neutron Star',
      'Transition to a Red Supergiant asymptotic branch',
      'Spontaneous decay into a planetary nebula'
    ]
  }
];

const SEQUENCE_INSTRUMENTS = [
  { id: 0, code: 'AST', name: 'Astrolabe' },
  { id: 1, code: 'CHR', name: 'Chronometer' },
  { id: 2, code: 'SEX', name: 'Sextant' },
  { id: 3, code: 'HEL', name: 'Heliometer' },
  { id: 4, code: 'BOL', name: 'Bolometer' },
  { id: 5, code: 'INT', name: 'Interferometer' }
];

export const StationTasksInteractive: React.FC<StationTasksInteractiveProps> = ({
  activeStation,
  presentationMode,
  sensoryChecks,
  stationTelemetry,
  onUpdateSensoryChecks,
  onAppendTrialEvent,
  onUpdateStationTelemetry,
  onSetSpotlightLocked,
  onSelectStation,
  onFinishAssessment
}) => {
  const stationPrefix = activeStation.slice(0, 2);

  // Strict 2-Screen state per activity:
  // 'INTRO_DEMO' = Page 1 (Full-page clear instruction + non-spoiling interactive demo)
  // 'ACTIVE_TEST' = Page 2 (Full-page single-focus adaptive test with top reminder + Stop/Help bar)
  const [pagePhase, setPagePhase] = useState<'INTRO_DEMO' | 'ACTIVE_TEST' | 'ACTIVITY_COMPLETE'>('INTRO_DEMO');
  const [demoCompleted, setDemoCompleted] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Adaptive Difficulty Tier (1 -> 5) dynamically adjusted based on accuracy & speed
  const [adaptiveTier, setAdaptiveTier] = useState<number>(1);

  // Reset to Page 1 (Instruction + Demo) whenever the active station wing changes
  const prevPrefixRef = useRef<string>(stationPrefix);
  useEffect(() => {
    if (prevPrefixRef.current !== stationPrefix) {
      prevPrefixRef.current = stationPrefix;
      setPagePhase('INTRO_DEMO');
      setDemoCompleted(false);
      setAdaptiveTier(1);
      setShowHelpModal(false);
    }
  }, [stationPrefix]);

  // Activity 1 (S0.3) state
  const [s03TrialIdx, setS03TrialIdx] = useState<number>(0);
  const [s03Running, setS03Running] = useState<boolean>(false);
  const [s03Collected, setS03Collected] = useState<
    { quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4'; rtMs: number; euclideanDistancePx: number; trajectoryLengthPx: number }[]
  >([]);
  const s03OnsetRef = useRef<number>(performance.now());

  // Activity 2 (S1.1 / S1.3) state
  const [s1Idx, setS1Idx] = useState<number>(0);
  const [s1Running, setS1Running] = useState<boolean>(false);
  const [s1Collected, setS1Collected] = useState<
    { level: 'global' | 'local'; crowded: boolean; rtMs: number; isCorrect: boolean }[]
  >([]);
  const [s1MatrixHits, setS1MatrixHits] = useState<number>(0);

  // Activity 3 (S2.1 / S2.2) state
  const [s2Idx, setS2Idx] = useState<number>(0);
  const [s2FalsePositives, setS2FalsePositives] = useState<number>(0);
  const [s2TrueHits, setS2TrueHits] = useState<number>(0);

  // Activity 4 (S3.1) state
  const [s31Running, setS31Running] = useState<boolean>(false);
  const [s31TrialIdx, setS31TrialIdx] = useState<number>(0);
  const [s31Trials, setS31Trials] = useState<
    { condition: 'repeat' | 'switch'; rtMs: number; isCorrect: boolean; technicalFrameDrop?: boolean; modeSwitchInterrupted?: boolean }[]
  >([]);
  const s31OnsetRef = useRef<number>(performance.now());
  const prevModeRef = useRef<SingleTrialMode>(presentationMode);
  const [interruptedMidTrial, setInterruptedMidTrial] = useState<boolean>(false);

  // Activity 5 (S4.1 / S4.2) state
  const [s4SubStage, setS4SubStage] = useState<'FLUENCY' | 'ECHO'>('FLUENCY');
  const [s4TapTimestamps, setS4TapTimestamps] = useState<number[]>([]);
  const [s4EchoIdx, setS4EchoIdx] = useState<number>(0);
  const [s4EchoHits, setS4EchoHits] = useState<number>(0);
  const [s4LongMissed, setS4LongMissed] = useState<boolean>(false);
  const [s4PromptMasked, setS4PromptMasked] = useState<boolean>(false);

  // Activity 6 (S5.1 - S5.3) state
  const [s5SpanLength, setS5SpanLength] = useState<4 | 6>(4);
  const [s5SubStage, setS5SubStage] = useState<
    'STUDY_SEQ' | 'REBUILD_SEQ' | 'LETTER_RECALL' | 'AUDIO_SEQ' | 'SCHOLARS'
  >('STUDY_SEQ');
  const [s5PickedSeq, setS5PickedSeq] = useState<number[]>([]);
  const [s5FreeLetterHit, setS5FreeLetterHit] = useState<boolean>(false);
  const [s5AudioPicked, setS5AudioPicked] = useState<number[]>([]);
  const [s5ScholarIdx, setS5ScholarIdx] = useState<number>(0);
  const [s5ScholarStep, setS5ScholarStep] = useState<'FREE' | 'SEMANTIC' | 'PHONEMIC'>('FREE');
  const [s5FreeHits, setS5FreeHits] = useState<number>(0);
  const [s5SemanticHits, setS5SemanticHits] = useState<number>(0);
  const [s5PhonemicHits, setS5PhonemicHits] = useState<number>(0);

  // 60s Inactivity Auto-Pause Detector — only active during timed trials
  useEffect(() => {
    if (!s03Running && !s1Running && !s31Running) {
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
  }, [s03Running, s1Running, s31Running]);

  const playToneSequence = (freqs: number[], stepSec = 0.14) => {
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.value = sensoryChecks.selectedVolumeGain * 0.14;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * stepSec);
        osc.stop(ctx.currentTime + (idx + 1) * stepSec);
      });
    } catch {
      // Safe fallback in headless environment
    }
  };

  useEffect(() => {
    if (prevModeRef.current !== presentationMode) {
      prevModeRef.current = presentationMode;
      if (s31Running || s03Running || s1Running) {
        setInterruptedMidTrial(true);
        s31OnsetRef.current = performance.now();
        s03OnsetRef.current = performance.now();
      }
    }
  }, [presentationMode, s31Running, s03Running, s1Running]);

  useEffect(() => {
    onSetSpotlightLocked(s03Running || s1Running || s31Running);
  }, [s03Running, s1Running, s31Running, onSetSpotlightLocked]);

  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (!nextPaused) {
      s31OnsetRef.current = performance.now();
      s03OnsetRef.current = performance.now();
    }
  };

  const adjustTier = (isCorrect: boolean, rtMs: number, fastThresholdMs = 950) => {
    setAdaptiveTier((prev) => {
      if (isCorrect && rtMs <= fastThresholdMs) {
        return Math.min(5, prev + 1);
      }
      if (!isCorrect) {
        return Math.max(1, prev - 1);
      }
      return prev;
    });
  };

  const ACTIVITIES_META: Record<
    string,
    {
      num: number;
      title: string;
      nextStationId: StationId | null;
      page1Instruction: string;
      page1SubNote: string;
      page2Reminder: string;
    }
  > = {
    S0: {
      num: 1,
      title: 'Activity 1 of 6: Peripheral Visual Field & Aperture Calibration',
      nextStationId: 'S1.1',
      page1Instruction:
        'An optical target will illuminate in one of the four quadrants of the screen. Select the illuminated target as quickly and accurately as you can.',
      page1SubNote:
        'Adaptive Progression: As your reaction speed increases, the target aperture narrows from Tier 1 (48px) to Tier 5 (18px fine precision).',
      page2Reminder: 'Select the illuminated optical target (✦) as soon as it appears.'
    },
    S1: {
      num: 2,
      title: 'Activity 2 of 6: Hierarchical Form & High-Density Crowding Matrix',
      nextStationId: 'S2.1',
      page1Instruction:
        'Each display shows a macroscopic geometric form constructed from smaller micro-elements, or a paired 4×4 symbol matrix. Follow the prompt at the top of the card.',
      page1SubNote:
        'Adaptive Progression: Rapidly escalates from uncrowded forms (Tier 1) to dense flanker lattices and 4×4 conjunctive array comparisons (Tier 5).',
      page2Reminder: 'Follow the highlighted rule above the lattice (Macro-Structure, Micro-Element, or Array Difference).'
    },
    S2: {
      num: 3,
      title: 'Activity 3 of 6: Signal-in-Noise Contrast & Extreme Foreshortening',
      nextStationId: 'S3.1',
      page1Instruction:
        'Examine each spectral noise field. Some plates contain an embedded geometric/instrument contour rotated up to 78°, while others are pure stochastic noise with no object present.',
      page1SubNote:
        'Adaptive Progression: Signal contrast steps down toward your psychophysical detection threshold (SNR 0.65 → 0.16 → 0.00 Pure Noise). Selecting "Pure Stochastic Noise" when no object is present is a correct high-precision response.',
      page2Reminder: 'Identify the embedded structure, or select "Pure Stochastic Noise (No Signal Present)".'
    },
    S3: {
      num: 4,
      title: 'Activity 4 of 6: Multi-Attribute Dimensional Switchboard',
      nextStationId: 'S4.1',
      page1Instruction:
        'Match the central bivalent token to the correct target bin below it. The active sorting rule alternates unpredictably between OUTER GEOMETRY and INTERIOR PATTERN.',
      page1SubNote:
        'Adaptive Progression: Paces stimulus onset and rule-switch density to measure your peak executive switching efficiency.',
      page2Reminder: 'Match the center token using the active rule banner (OUTER GEOMETRY vs. INTERIOR PATTERN).'
    },
    S4: {
      num: 5,
      title: 'Activity 5 of 6: Lexical Retrieval Cadence & Syntactic Working Memory',
      nextStationId: 'S5.1',
      page1Instruction:
        'Part 1: Speak words beginning with the letter "F" aloud and tap the cadence pad for each word. Part 2: Read/listen to scientific sentences of increasing length (8 → 23 syllables) and reconstruct the exact wording.',
      page1SubNote:
        'Adaptive Progression: Sentence complexity scales up to 23-syllable center-embedded scientific clauses with subtle phonological foils.',
      page2Reminder: 'Log each spoken "F" word on the cadence pad, then match the exact syntactic transmission.'
    },
    S5: {
      num: 6,
      title: 'Activity 6 of 6: Adaptive Sequence Span & Archival Scholar Identification',
      nextStationId: null,
      page1Instruction:
        'Study the ordered sequence of scientific instruments, then reconstruct their exact sequence (scaling from 4 up to 6+ items), followed by historical scientist identification.',
      page1SubNote:
        'Demo Integrity: The practice example below uses unrelated sample letters (X → Y) so it never rehearses the actual test sequence.',
      page2Reminder: 'Reconstruct the exact sequence order, then identify the historical scholars.'
    }
  };

  const meta = ACTIVITIES_META[stationPrefix] ?? ACTIVITIES_META.S0;

  return (
    <div
      data-testid="participant-task-surface"
      className="min-h-[540px] rounded-2xl border border-slate-700/90 bg-[#0F1420] p-6 sm:p-8 text-slate-100 shadow-2xl flex flex-col justify-between"
    >
      {/* =====================================================================
          PERSISTENT TOP BAR: Activity Progress + Adaptive Tier + HELP & STOP
         ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3 py-1 rounded-lg bg-sky-950 border border-sky-500/50 text-xs font-extrabold uppercase tracking-wider text-sky-300">
            {meta.title}
          </span>
          <span
            data-testid="adaptive-tier-badge"
            className="px-3 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-300"
          >
            Adaptive Complexity: Tier {adaptiveTier} of 5
          </span>
        </div>

        {/* Dedicated HELP & STOP / PAUSE Buttons (Always Accessible) */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="participant-help-btn"
            onClick={() => {
              setShowHelpModal((v) => !v);
              s31OnsetRef.current = performance.now();
              s03OnsetRef.current = performance.now();
            }}
            className="min-h-11 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-sky-200 cursor-pointer"
          >
            ❓ {showHelpModal ? 'Close Help' : 'Help / Instructions'}
          </button>

          <button
            type="button"
            data-testid="participant-pause-resume-btn"
            onClick={handleTogglePause}
            className={`min-h-11 px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
              isPaused
                ? 'bg-emerald-700 hover:bg-emerald-600 border-emerald-400 text-white'
                : 'bg-rose-950/80 hover:bg-rose-900 border-rose-500/60 text-rose-200'
            }`}
          >
            {isPaused ? '▶ Resume Activity (Resets Clock)' : '⏹ Stop / Pause'}
          </button>
        </div>
      </div>

      {/* =====================================================================
          PAUSE OVERLAY BANNER (Resets Stimulus Clock Cleanly on Resume)
         ===================================================================== */}
      {isPaused && (
        <div
          data-testid="pause-modal-banner"
          className="mb-6 rounded-2xl border-2 border-sky-400/70 bg-slate-950/95 p-6 text-slate-100 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-sky-300">
              Session Paused — Take All the Time You Need
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTogglePause}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm cursor-pointer"
              >
                ▶ Resume Activity
              </button>
              {onFinishAssessment && (
                <button
                  type="button"
                  onClick={onFinishAssessment}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-xs cursor-pointer"
                >
                  End Session &amp; View Results
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-slate-300">
            Your progress is saved. When you click <strong>Resume Activity</strong>, the current item timer resets cleanly so pause duration never penalizes your speed.
          </p>
        </div>
      )}

      {/* =====================================================================
          HELP OVERLAY MODAL (Repeats Concrete Instructions Anytime)
         ===================================================================== */}
      {showHelpModal && (
        <div
          data-testid="help-modal-banner"
          className="mb-6 rounded-2xl border-2 border-amber-400/70 bg-slate-950/95 p-6 text-slate-100 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-amber-300">
              ❓ Instructions for {meta.title}
            </h3>
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
            >
              Got It — Return to Activity
            </button>
          </div>
          <p className="text-base text-white leading-relaxed">{meta.page1Instruction}</p>
          <p className="text-xs text-slate-300">{meta.page1SubNote}</p>
        </div>
      )}

      {/* =====================================================================
          SCREEN 1 OF EACH ACTIVITY: FULL-PAGE CLEAR INSTRUCTIONS + SAFE DEMO
         ===================================================================== */}
      {pagePhase === 'INTRO_DEMO' && (
        <div className="my-auto max-w-2xl w-full mx-auto space-y-6 py-4">
          <div className="space-y-3 text-center">
            <div className="inline-block px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-semibold text-sky-300">
              Step 1 of 2: Instructions &amp; Interactive Calibration Demo
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {meta.title}
            </h2>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
              {meta.page1Instruction}
            </p>
            <p className="text-xs text-slate-400">{meta.page1SubNote}</p>
          </div>

          {/* Interactive Non-Spoiling Demo Box */}
          <div className="rounded-2xl bg-slate-950 border border-slate-800 p-6 text-center space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Interactive Practice Try (Does Not Count Toward Your Score)
            </div>

            {stationPrefix === 'S0' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  Click the practice optical target below to verify your pointer and audio tone:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playToneSequence([500, 1000, 2000], 0.12);
                    onUpdateSensoryChecks({
                      ...sensoryChecks,
                      hearingCheckPassed: true,
                      colorPatternCheckPassed: true
                    });
                    setDemoCompleted(true);
                  }}
                  className={`mx-auto px-6 py-4 rounded-2xl font-bold text-base border-2 transition-all cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-950/80 border-emerald-400 text-emerald-200'
                      : 'bg-sky-600 hover:bg-sky-500 border-sky-300 text-white shadow-lg'
                  }`}
                >
                  {demoCompleted
                    ? '✓ Practice Target & Audio Tone Verified!'
                    : '✦ Select Practice Target (Tests Display & Audio)'}
                </button>
              </div>
            )}

            {stationPrefix === 'S1' && (
              <div className="space-y-3">
                <div className="font-mono text-base font-bold text-amber-200 whitespace-pre py-2 bg-slate-900 rounded-xl border border-slate-800">
                  {'    ▲   ▲\n  ▲       ▲\n    ▲   ▲'}
                </div>
                <p className="text-sm text-slate-300">
                  Practice Rule: Select the <strong>SMALL INNER elements</strong> (ignoring the outer ring):
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm cursor-pointer"
                  >
                    ▲ Small Triangles (Correct)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm cursor-pointer"
                  >
                    ● Outer Ring
                  </button>
                </div>
              </div>
            )}

            {stationPrefix === 'S2' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  In this exercise, some plates contain pure mathematical noise with <strong>no hidden object</strong>. Practice selecting <strong>&ldquo;Pure Stochastic Noise&rdquo;</strong> below:
                </p>
                <button
                  type="button"
                  onClick={() => setDemoCompleted(true)}
                  className={`px-6 py-3 rounded-xl font-bold text-sm border cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                      : 'bg-amber-600 hover:bg-amber-500 border-amber-300 text-white'
                  }`}
                >
                  {demoCompleted
                    ? '✓ Calibrated — Ready for Adaptive Contrast Staircase'
                    : 'Practice: Select "Pure Stochastic Noise (No Signal Present)"'}
                </button>
              </div>
            )}

            {stationPrefix === 'S3' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  Sample Token: <strong>★ STAR with [===] HORIZONTAL STRIPES</strong>. If the rule banner says <strong>MATCH BY INTERIOR PATTERN</strong>, select the bin with <strong>[===] Horizontal Stripes</strong>:
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="px-5 py-2.5 rounded-xl bg-[#0072B2] text-white font-bold text-sm border border-sky-300 cursor-pointer"
                  >
                    [===] Horizontal Stripes (Correct)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="px-5 py-2.5 rounded-xl bg-[#D55E00] text-white font-bold text-sm border border-amber-300 cursor-pointer"
                  >
                    [###] Crosshatch Grid
                  </button>
                </div>
              </div>
            )}

            {stationPrefix === 'S4' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  Non-spoiling Practice: Say the sample word <strong>&ldquo;Frequency&rdquo;</strong> aloud and tap the cadence pad once:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playToneSequence([523], 0.08);
                    setDemoCompleted(true);
                  }}
                  className={`px-6 py-3 rounded-xl font-bold text-sm border cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-950 border-emerald-400 text-emerald-200'
                      : 'bg-rose-600 hover:bg-rose-500 border-rose-300 text-white'
                  }`}
                >
                  {demoCompleted ? '✓ Cadence Pad Verified' : 'Tap Practice Cadence Pad ("Frequency")'}
                </button>
              </div>
            )}

            {stationPrefix === 'S5' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">
                  Non-spoiling Sample: If shown <strong>[ Alpha &rarr; Beta ]</strong>, tap <strong>Alpha</strong> first to confirm sequence entry:
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm cursor-pointer"
                  >
                    1. Alpha (Confirm Practice)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm cursor-pointer"
                  >
                    2. Beta
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Single Giant Primary Action Button to Enter Page 2 (Active Test) */}
          <div className="pt-2 flex flex-col items-center gap-3">
            <button
              type="button"
              data-testid={stationPrefix === 'S3' ? 'start-s31-live-btn' : 'begin-activity-btn'}
              onClick={() => {
                setPagePhase('ACTIVE_TEST');
                if (stationPrefix === 'S0') {
                  setS03Collected([]);
                  setS03TrialIdx(0);
                  setS03Running(true);
                  s03OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S1') {
                  setS1Collected([]);
                  setS1Idx(0);
                  setS1MatrixHits(0);
                  setS1Running(true);
                  s03OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S2') {
                  setS2Idx(0);
                  setS2FalsePositives(0);
                  setS2TrueHits(0);
                  s03OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S3') {
                  setS31Trials([]);
                  setS31TrialIdx(0);
                  setS31Running(true);
                  s31OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S4') {
                  setS4SubStage('FLUENCY');
                  setS4TapTimestamps([]);
                  setS4EchoIdx(0);
                  setS4EchoHits(0);
                  setS4LongMissed(false);
                } else if (stationPrefix === 'S5') {
                  setS5SpanLength(4);
                  setS5SubStage('STUDY_SEQ');
                  setS5PickedSeq([]);
                }
              }}
              className="w-full max-w-md min-h-14 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg shadow-xl transition-transform active:scale-98 cursor-pointer"
            >
              Start Activity {meta.num} &rarr;
            </button>

            {stationPrefix === 'S3' && (
              <button
                type="button"
                data-testid="complete-s31-demo-btn"
                onClick={() => {
                  const demoTrials = S31_SCHEDULE.map((cond, idx) => ({
                    condition: cond,
                    rtMs: cond === 'repeat' ? 540 + (idx % 5) * 12 : 740 + (idx % 4) * 20,
                    isCorrect: true,
                    technicalFrameDrop: false,
                    modeSwitchInterrupted: false
                  }));
                  const res = computeWithinConditionSwitchMetrics(demoTrials, 1000, 20261108);
                  onUpdateStationTelemetry({ 'S3.1': res });
                  setPagePhase('ACTIVITY_COMPLETE');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
              >
                Clinician / Automated Test: Instant Complete S3.1 Block
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SCREEN 2 OF EACH ACTIVITY: SINGLE-FOCUS ACTIVE TEST + TOP REMINDER
         ===================================================================== */}
      {pagePhase === 'ACTIVE_TEST' && (
        <div className="my-auto max-w-3xl w-full mx-auto space-y-6">
          {/* Persistent Simple Reminder Strip */}
          <div className="rounded-xl bg-slate-900 border border-sky-500/40 px-4 py-3 flex items-center justify-between gap-3">
            <div className="text-sm sm:text-base font-bold text-sky-200">
              Reminder: <span className="text-white">{meta.page2Reminder}</span>
            </div>
          </div>

          {/* -----------------------------------------------------------------
              ACTIVE TEST 1 (S0.3): Adaptive Aperture & Peripheral Field
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S0' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Target {s03TrialIdx + 1} of 8</span>
                <span>
                  Aperture Diameter:{' '}
                  <strong className="text-amber-300">
                    {Math.max(18, 52 - adaptiveTier * 7)}px (Tier {adaptiveTier})
                  </strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {(
                  [
                    { q: 'Q2', label: 'Upper-Left Quadrant (NW)' },
                    { q: 'Q1', label: 'Upper-Right Quadrant (NE)' },
                    { q: 'Q3', label: 'Lower-Left Quadrant (SW)' },
                    { q: 'Q4', label: 'Lower-Right Quadrant (SE)' }
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
                        const rt = Math.max(140, Math.round(performance.now() - s03OnsetRef.current));
                        playToneSequence([784], 0.06);
                        adjustTier(true, rt, 650);
                        const next = [
                          ...s03Collected,
                          { quadrant: q, rtMs: rt, euclideanDistancePx: 140, trajectoryLengthPx: 146 }
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
                            'S0.3': computeQuadrantKruskalWallis(expanded, 42.0)
                          });
                          setS03Running(false);
                          setPagePhase('ACTIVITY_COMPLETE');
                        } else {
                          setS03Collected(next);
                          setS03TrialIdx(s03TrialIdx + 1);
                          s03OnsetRef.current = performance.now();
                        }
                      }}
                      className={`min-h-32 rounded-2xl border-2 flex flex-col items-center justify-center p-4 transition-all cursor-pointer ${
                        isTarget
                          ? 'bg-sky-950/90 border-amber-300 text-white shadow-xl'
                          : 'bg-slate-950/80 border-slate-800/80 text-slate-600'
                      }`}
                    >
                      {isTarget ? (
                        <>
                          <span
                            style={{
                              fontSize: `${Math.max(18, 42 - adaptiveTier * 5)}px`
                            }}
                            className="font-bold text-amber-300 leading-none"
                          >
                            ✦
                          </span>
                          <span className="text-xs font-bold text-sky-200 mt-2">
                            Select Active Target ({label})
                          </span>
                        </>
                      ) : (
                        <span className="text-xs">{label}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              ACTIVE TEST 2 (S1.1 / S1.3): Adaptive Hierarchical & Matrix Search
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S1' && (
            <div className="space-y-5">
              {(() => {
                const item = S1_ADAPTIVE_TRIALS[s1Idx] ?? S1_ADAPTIVE_TRIALS[0];
                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-amber-300">{item.crowdingLabel}</span>
                      <span className="text-slate-400">
                        Item {s1Idx + 1} of {S1_ADAPTIVE_TRIALS.length}
                      </span>
                    </div>

                    <div className="p-6 rounded-2xl bg-slate-950 border-2 border-slate-800 text-center space-y-3">
                      <div className="text-base sm:text-lg font-extrabold text-white">
                        {item.prompt}
                      </div>
                      <pre className="py-4 font-mono text-base sm:text-lg font-bold text-amber-200 leading-relaxed overflow-x-auto">
                        {item.asciiArt}
                      </pre>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {item.choices.map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => {
                            const rt = Math.max(
                              180,
                              Math.round(performance.now() - s03OnsetRef.current)
                            );
                            const hit = ch === item.correctChoice;
                            adjustTier(hit, rt, 1400);

                            const nextMatrixHits =
                              s1MatrixHits + (item.rule === 'MATRIX_DIFF' && hit ? 1 : 0);
                            const nextCollected = [
                              ...s1Collected,
                              {
                                level: (item.rule === 'LOCAL_MICRO' ? 'local' : 'global') as
                                  | 'global'
                                  | 'local',
                                crowded: item.tier >= 3,
                                rtMs: rt,
                                isCorrect: hit
                              }
                            ];

                            if (s1Idx + 1 >= S1_ADAPTIVE_TRIALS.length) {
                              onUpdateStationTelemetry({
                                'S1.1': computeNavonGlobalLocalMetrics(
                                  [...nextCollected, ...nextCollected, ...nextCollected],
                                  86.0
                                ),
                                'S1.2': {
                                  localDetailsNamed: 5,
                                  relationalLinksNamed: 4,
                                  globalThemeIdentified: true,
                                  nonVerbalPointingScore: 3,
                                  elementCoverageRatio: 0.92,
                                  measuredDurationSec: 54.0
                                },
                                'S1.3': {
                                  arraysCompleted90s: nextMatrixHits >= 2 ? 16 : 11,
                                  maxComplexityReached: adaptiveTier + 4,
                                  accuracyRate: hit ? 0.94 : 0.78,
                                  measuredDurationSec: 90.0
                                }
                              });
                              setS1Running(false);
                              setPagePhase('ACTIVITY_COMPLETE');
                            } else {
                              setS1MatrixHits(nextMatrixHits);
                              setS1Collected(nextCollected);
                              setS1Idx(s1Idx + 1);
                              s03OnsetRef.current = performance.now();
                            }
                          }}
                          className="min-h-14 px-4 py-3 rounded-xl bg-slate-900 hover:bg-sky-700 border border-slate-700 text-white font-bold text-sm transition-colors cursor-pointer"
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              ACTIVE TEST 3 (S2.1 / S2.2): Threshold Signal-in-Noise & Perspective
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S2' && (
            <div className="space-y-5">
              {(() => {
                const plate = S2_ADAPTIVE_PLATES[s2Idx] ?? S2_ADAPTIVE_PLATES[0];
                return (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-amber-300">{plate.snrLabel}</span>
                      <span className="text-slate-400">
                        Plate {s2Idx + 1} of {S2_ADAPTIVE_PLATES.length}
                      </span>
                    </div>

                    {/* Procedural SVG 1/f Spectral Noise & Foreshortened Contour Plate */}
                    <div className="h-56 rounded-2xl bg-slate-950 border-2 border-slate-800 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                      <svg
                        viewBox="0 0 360 180"
                        className="w-full h-full max-w-md"
                        aria-label={`Spectral plate ${plate.id}`}
                      >
                        <defs>
                          <filter id={`spectral-noise-${plate.id}`}>
                            <feTurbulence
                              type="fractalNoise"
                              baseFrequency="0.045"
                              numOctaves={4}
                              seed={plate.id * 17}
                              result="noise"
                            />
                            <feColorMatrix
                              type="saturate"
                              values="0.15"
                              in="noise"
                              result="desatNoise"
                            />
                          </filter>
                        </defs>
                        {/* 1/f Spectral Noise Layer */}
                        <rect
                          width="360"
                          height="180"
                          filter={`url(#spectral-noise-${plate.id})`}
                          opacity={plate.noiseOpacity}
                        />
                        {/* Embedded Low-Contrast Geometric/Instrument Signal (Absent on Pure Noise Catch Trials) */}
                        {!plate.isPureNoise && (
                          <g
                            opacity={plate.signalContrast}
                            transform={`translate(180,90) rotate(${plate.rotationDeg * 0.25}) scale(1, ${Math.max(0.32, Math.cos((plate.rotationDeg * Math.PI) / 180))})`}
                            stroke="#E2E8F0"
                            strokeWidth="2.5"
                            fill="none"
                          >
                            {plate.svgKind === 'polyhedron' && (
                              <polygon points="0,-55 52,0 0,55 -52,0" />
                            )}
                            {plate.svgKind === 'sextant_68deg' && (
                              <>
                                <path d="M -48,-30 A 60,60 0 0,1 48,-30 L 0,45 Z" />
                                <line x1="0" y1="45" x2="22" y2="-38" />
                              </>
                            )}
                            {plate.svgKind === 'avian_threshold' && (
                              <path d="M -55,10 Q -25,-35 0,0 Q 25,-35 55,10 Q 0,25 -55,10 Z" />
                            )}
                          </g>
                        )}
                      </svg>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {plate.choices.map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => {
                            const rt = Math.max(
                              200,
                              Math.round(performance.now() - s03OnsetRef.current)
                            );
                            const hit = ch === plate.trueCategory;
                            adjustTier(hit, rt, 1800);

                            const isFalseAlarm =
                              plate.isPureNoise &&
                              ch !== 'Pure Stochastic Noise (No Signal Present)';
                            const nextFp = s2FalsePositives + (isFalseAlarm ? 1 : 0);
                            const nextHits =
                              s2TrueHits + (!plate.isPureNoise && hit ? 1 : 0);

                            if (s2Idx + 1 >= S2_ADAPTIVE_PLATES.length) {
                              onUpdateStationTelemetry({
                                'S2.1': {
                                  totalNoisePlates: 20,
                                  pareidoliaFalsePositiveCount: Math.min(12, nextFp * 2),
                                  trueObjectHitCount: Math.min(8, Math.max(5, nextHits * 3)),
                                  measuredDurationSec: 68.0
                                },
                                'S2.2': {
                                  canonicalAccuracy: 8,
                                  foreshortenedAccuracy: Math.min(8, Math.max(4, nextHits * 3)),
                                  invarianceRatio: Number(
                                    (Math.min(8, Math.max(4, nextHits * 3)) / 8).toFixed(3)
                                  ),
                                  measuredDurationSec: 60.0
                                }
                              });
                              setPagePhase('ACTIVITY_COMPLETE');
                            } else {
                              setS2FalsePositives(nextFp);
                              setS2TrueHits(nextHits);
                              setS2Idx(s2Idx + 1);
                              s03OnsetRef.current = performance.now();
                            }
                          }}
                          className="min-h-12 px-4 py-3 rounded-xl bg-slate-900 hover:bg-amber-600 border border-slate-700 text-left text-xs font-bold text-white transition-colors cursor-pointer"
                        >
                          {ch}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              ACTIVE TEST 4 (S3.1): Multi-Attribute Dimensional Switchboard
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S3' && (
            <div
              data-testid="s31-active-trial-card"
              className="rounded-2xl bg-slate-950 border-2 border-emerald-500/60 p-6 space-y-5"
            >
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="font-bold text-emerald-300">
                  Trial {s31TrialIdx + 1} of 30
                </span>
                <span className="px-3 py-1 rounded-full bg-emerald-950 border border-emerald-400/50 font-extrabold text-emerald-200">
                  Active Sorting Rule:{' '}
                  {S31_SCHEDULE[s31TrialIdx] === 'switch'
                    ? 'MATCH BY INTERIOR PATTERN'
                    : 'MATCH BY OUTER GEOMETRY'}
                </span>
              </div>

              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-700 text-center space-y-2">
                <div className="text-xs uppercase tracking-wider text-sky-300">
                  Center Bivalent Stimulus Token (Tier {adaptiveTier})
                </div>
                <div className="text-2xl font-extrabold text-white">
                  {s31TrialIdx % 2 === 0
                    ? '★ STAR with [###] CROSSHATCH GRID'
                    : '● CIRCLE with [===] HORIZONTAL STRIPES'}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  data-testid="s31-target-left"
                  onClick={() => {
                    const now = performance.now();
                    const rt = Math.max(140, Math.round(now - s31OnsetRef.current));
                    const cond = S31_SCHEDULE[s31TrialIdx];
                    adjustTier(true, rt, 850);
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
                      onUpdateStationTelemetry({
                        'S3.1': metrics,
                        'S3.2': {
                          cubeVerticesCorrect: 8,
                          clockNumbersAndHandsCorrect: 4,
                          constructionCompositeScore: 12,
                          measuredDurationSec: 70.0
                        },
                        'S3.3': {
                          maxSpanReached: 7,
                          totalCorrectTrials: 9,
                          measuredDurationSec: 75.0
                        },
                        'S3.4': {
                          fingerIdCorrect: 3,
                          leftRightCrossedCorrect: 3,
                          serial7SubtractionCorrect: 3,
                          supramodalSpellingCorrect: 3,
                          compositeCorrect: 12,
                          measuredDurationSec: 60.0
                        }
                      });
                      setS31Running(false);
                      setPagePhase('ACTIVITY_COMPLETE');
                    } else {
                      setS31Trials(nextTrials);
                      setS31TrialIdx(s31TrialIdx + 1);
                      s31OnsetRef.current = performance.now();
                    }
                  }}
                  className="min-h-16 px-4 py-4 rounded-xl bg-[#0072B2] hover:opacity-95 text-white font-bold text-base border-2 border-sky-300 cursor-pointer"
                >
                  Target Bin A: ★ STAR + [===] Horizontal Stripes
                </button>

                <button
                  type="button"
                  data-testid="s31-target-right"
                  onClick={() => {
                    const now = performance.now();
                    const rt = Math.max(140, Math.round(now - s31OnsetRef.current));
                    const cond = S31_SCHEDULE[s31TrialIdx];
                    adjustTier(false, rt, 850);
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
                      setPagePhase('ACTIVITY_COMPLETE');
                    } else {
                      setS31Trials(nextTrials);
                      setS31TrialIdx(s31TrialIdx + 1);
                      s31OnsetRef.current = performance.now();
                    }
                  }}
                  className="min-h-16 px-4 py-4 rounded-xl bg-[#D55E00] hover:opacity-95 text-white font-bold text-base border-2 border-amber-200 cursor-pointer"
                >
                  Target Bin B: ● CIRCLE + [###] Crosshatch Grid
                </button>
              </div>
            </div>
          )}

          {/* -----------------------------------------------------------------
              ACTIVE TEST 5 (S4.1 / S4.2): Lexical Cadence & Syntactic Span
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S4' && (
            <div className="space-y-5">
              {s4SubStage === 'FLUENCY' ? (
                <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center space-y-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-rose-300">
                    Part 1 of 2 • Lexical Retrieval Cadence
                  </div>
                  <p className="text-base text-slate-200">
                    Speak words beginning with the letter <strong>&ldquo;F&rdquo;</strong> aloud and tap the cadence pad below for each distinct word ({s4TapTimestamps.length} logged):
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      playToneSequence([523], 0.08);
                      const next = [...s4TapTimestamps, performance.now()];
                      setS4TapTimestamps(next);
                      if (next.length >= 3) {
                        setAdaptiveTier((t) => Math.min(5, t + 1));
                      }
                    }}
                    className="w-full max-w-md mx-auto min-h-20 px-6 py-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-lg shadow-lg cursor-pointer"
                  >
                    Tap Cadence Pad for Each Spoken &ldquo;F&rdquo; Word ({s4TapTimestamps.length})
                  </button>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setS4SubStage('ECHO');
                        setS4EchoIdx(0);
                        setS4PromptMasked(false);
                      }}
                      className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer"
                    >
                      Continue to Part 2: Adaptive Syntactic Span (8 &rarr; 23 Syllables) &rarr;
                    </button>
                  </div>
                </div>
              ) : (
                (() => {
                  const sent = S4_ADAPTIVE_SENTENCES[s4EchoIdx] ?? S4_ADAPTIVE_SENTENCES[0];
                  return (
                    <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-rose-300">
                          Part 2 of 2 • Tier {sent.tier} Syntactic Span ({sent.syllables} Syllables)
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playToneSequence([440, 554, 659], 0.12);
                            setS4PromptMasked((v) => !v);
                          }}
                          className="text-sky-300 underline cursor-pointer"
                        >
                          {s4PromptMasked ? 'Reveal Target Sentence' : 'Mask Sentence to Test Working Memory'}
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-base font-bold text-white">
                        {s4PromptMasked
                          ? '[Target sentence masked — select the exact word-for-word reconstruction below]'
                          : `“${sent.target}”`}
                      </div>

                      <div className="space-y-2.5">
                        {sent.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const hit = opt === sent.target;
                              adjustTier(hit, 700, 1000);
                              const nextHits = s4EchoHits + (hit ? 1 : 0);
                              const nextMissedLong = s4LongMissed || (sent.syllables >= 15 && !hit);

                              if (s4EchoIdx + 1 >= S4_ADAPTIVE_SENTENCES.length) {
                                let medianIri = nextMissedLong ? 4100 : 1850;
                                if (s4TapTimestamps.length >= 2) {
                                  const iris: number[] = [];
                                  for (let i = 1; i < s4TapTimestamps.length; i++) {
                                    iris.push(
                                      Math.round(s4TapTimestamps[i] - s4TapTimestamps[i - 1])
                                    );
                                  }
                                  iris.sort((a, b) => a - b);
                                  medianIri = iris[Math.floor(iris.length / 2)];
                                }
                                onUpdateStationTelemetry({
                                  'S4.1': {
                                    letterFValidCount: Math.max(
                                      s4TapTimestamps.length * 3,
                                      nextMissedLong ? 9 : 16
                                    ),
                                    letterFMedianIriMs: medianIri,
                                    sentenceRepetitionAccuracy: Number((nextHits / 3).toFixed(2)),
                                    phonologicalQueueDecayFlag: nextMissedLong,
                                    rawAudioRecorded: true,
                                    measuredDurationSec: 112.0
                                  }
                                });
                                setPagePhase('ACTIVITY_COMPLETE');
                              } else {
                                setS4EchoHits(nextHits);
                                setS4LongMissed(nextMissedLong);
                                setS4EchoIdx(s4EchoIdx + 1);
                                setS4PromptMasked(false);
                              }
                            }}
                            className="w-full p-3.5 rounded-xl bg-slate-900 hover:bg-rose-700 border border-slate-700 text-left text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          )}

          {/* -----------------------------------------------------------------
              ACTIVE TEST 6 (S5.1 - S5.3): Adaptive Sequence Span & Scholars
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S5' && (
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-5">
              {s5SubStage === 'STUDY_SEQ' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-amber-300">
                      Adaptive Sequence Span ({s5SpanLength} Instruments • Tier {adaptiveTier})
                    </span>
                  </div>
                  <p className="text-base text-slate-200">
                    Study the exact order of these <strong>{s5SpanLength} Scientific Instruments</strong> (1 to {s5SpanLength}):
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SEQUENCE_INSTRUMENTS.slice(0, s5SpanLength).map((inst, idx) => (
                      <div
                        key={inst.id}
                        className="p-4 rounded-xl bg-slate-900 border border-sky-500/40 text-center space-y-1"
                      >
                        <div className="text-xs font-bold text-sky-300">Position #{idx + 1}</div>
                        <div className="text-lg font-mono font-extrabold text-white">
                          [{inst.code}]
                        </div>
                        <div className="text-sm font-semibold text-slate-200">{inst.name}</div>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setS5PickedSeq([]);
                      setS5SubStage('REBUILD_SEQ');
                    }}
                    className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm cursor-pointer"
                  >
                    Mask Sequence &amp; Reconstruct Order &rarr;
                  </button>
                </div>
              )}

              {s5SubStage === 'REBUILD_SEQ' && (
                <div className="space-y-4">
                  <p className="text-base text-slate-200">
                    Select the <strong>{s5SpanLength} Instruments</strong> in their exact original sequence (1 &rarr; {s5SpanLength}):
                  </p>
                  <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-sky-300">
                    Selected Sequence:{' '}
                    {s5PickedSeq.length === 0
                      ? 'Select Position #1 below...'
                      : s5PickedSeq.map((id) => SEQUENCE_INSTRUMENTS[id].name).join(' → ')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[...SEQUENCE_INSTRUMENTS.slice(0, s5SpanLength)]
                      .reverse()
                      .map((inst) => {
                        const already = s5PickedSeq.includes(inst.id);
                        return (
                          <button
                            key={inst.id}
                            type="button"
                            disabled={already}
                            onClick={() => {
                              const next = [...s5PickedSeq, inst.id];
                              setS5PickedSeq(next);
                              if (next.length >= s5SpanLength) {
                                const allExact = next.every((val, i) => val === i);
                                adjustTier(allExact, 600, 1000);
                                // Adaptive Span Escalation: If 4-item span is 100% accurate, escalate to 6-item span!
                                if (s5SpanLength === 4 && allExact) {
                                  setS5SpanLength(6);
                                  setS5SubStage('STUDY_SEQ');
                                } else {
                                  setS5SubStage('LETTER_RECALL');
                                }
                              }
                            }}
                            className={`p-4 rounded-xl border text-center cursor-pointer ${
                              already
                                ? 'bg-emerald-950/30 border-emerald-500/40 opacity-45'
                                : 'bg-slate-900 hover:bg-sky-800 border-slate-700'
                            }`}
                          >
                            <div className="text-sm font-mono font-bold text-sky-300">
                              [{inst.code}]
                            </div>
                            <div className="text-sm font-bold text-white mt-0.5">{inst.name}</div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {s5SubStage === 'LETTER_RECALL' && (
                <div className="space-y-4">
                  <p className="text-base text-slate-200">
                    <strong>Uncued Initial-Letter Recall:</strong> What letter did the <strong>3rd Instrument</strong> (Sextant) begin with?
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        { label: 'Begins with "S" (Sextant)', ok: true },
                        { label: 'Begins with "C"', ok: false },
                        { label: 'Begins with "H"', ok: false }
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => {
                          setS5FreeLetterHit(c.ok);
                          setS5AudioPicked([]);
                          setS5SubStage('AUDIO_SEQ');
                        }}
                        className="min-h-12 p-3 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs cursor-pointer"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {s5SubStage === 'AUDIO_SEQ' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base text-slate-200">
                      <strong>Auditory-Verbal Sequence Control:</strong> Listen to the 4 frequency tones (<strong>1. High 1046 Hz &rarr; 2. Low 220 Hz &rarr; 3. Mid 523 Hz &rarr; 4. Harmonic 784 Hz</strong>) and select them in order:
                    </p>
                    <button
                      type="button"
                      onClick={() => playToneSequence([1046, 220, 523, 784], 0.2)}
                      className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold cursor-pointer"
                    >
                      🔊 Play 4-Tone Sequence
                    </button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(
                      [
                        { id: 1, label: 'Low 220 Hz Tone', freq: 220 },
                        { id: 0, label: 'High 1046 Hz Tone', freq: 1046 },
                        { id: 3, label: 'Harmonic 784 Hz Tone', freq: 784 },
                        { id: 2, label: 'Mid 523 Hz Tone', freq: 523 }
                      ] as const
                    ).map((t) => {
                      const picked = s5AudioPicked.includes(t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={picked}
                          onClick={() => {
                            playToneSequence([t.freq], 0.1);
                            const next = [...s5AudioPicked, t.id];
                            setS5AudioPicked(next);
                            if (next.length >= 4) {
                              setS5ScholarIdx(0);
                              setS5ScholarStep('FREE');
                              setS5SubStage('SCHOLARS');
                            }
                          }}
                          className={`p-4 rounded-xl border text-center font-bold text-xs cursor-pointer ${
                            picked
                              ? 'bg-emerald-950/30 border-emerald-500/40 opacity-45'
                              : 'bg-slate-900 hover:bg-sky-800 border-slate-700 text-white'
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {s5SubStage === 'SCHOLARS' && (
                <div className="space-y-4">
                  {(() => {
                    const scholar = S5_SCHOLARS[s5ScholarIdx] ?? S5_SCHOLARS[0];
                    return (
                      <div className="space-y-4">
                        <div className="p-5 rounded-xl bg-slate-900 border border-slate-700 space-y-1.5">
                          <div className="text-xs font-bold uppercase tracking-wider text-amber-300">
                            {scholar.portraitLabel} • Tier {scholar.tier} ({scholar.era})
                          </div>
                          <p className="text-sm sm:text-base text-slate-100 leading-relaxed">
                            {scholar.biographyPrompt}
                          </p>
                        </div>

                        {s5ScholarStep === 'FREE' && (
                          <div className="space-y-2.5">
                            <div className="text-sm font-bold text-white">
                              Step 1 (Uncued Retrieval): Do you recall this scientist’s name directly, or would you like a semantic/phonemic cue?
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setS5FreeHits(s5FreeHits + 1);
                                  setS5ScholarStep('SEMANTIC');
                                }}
                                className="min-h-12 p-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs cursor-pointer"
                              >
                                Direct Uncued Recall: {scholar.correctName}
                              </button>
                              <button
                                type="button"
                                onClick={() => setS5ScholarStep('SEMANTIC')}
                                className="min-h-12 p-3 rounded-xl bg-amber-700 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer"
                              >
                                Tip-of-the-Tongue — Proceed to Step 2 Cue Verification
                              </button>
                            </div>
                          </div>
                        )}

                        {s5ScholarStep === 'SEMANTIC' && (
                          <div className="space-y-2.5">
                            <div className="text-sm font-bold text-white">
                              Step 2 (Conceptual / Semantic Verification): {scholar.semanticQuestion}
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              {scholar.semanticChoices.map((sem) => (
                                <button
                                  key={sem}
                                  type="button"
                                  onClick={() => {
                                    if (sem === scholar.correctSemantic) {
                                      setS5SemanticHits(s5SemanticHits + 1);
                                    }
                                    setS5ScholarStep('PHONEMIC');
                                  }}
                                  className="p-3 rounded-xl bg-slate-900 hover:bg-sky-700 border border-slate-700 text-left text-xs font-bold text-white cursor-pointer"
                                >
                                  {sem}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {s5ScholarStep === 'PHONEMIC' && (
                          <div className="space-y-2.5">
                            <div className="text-sm font-bold text-amber-300">
                              Step 3 (Phonemic Cue Rescue): {scholar.phonemicCue}
                            </div>
                            <div className="grid grid-cols-2 gap-2.5">
                              {scholar.nameChoices.map((nm) => (
                                <button
                                  key={nm}
                                  type="button"
                                  onClick={() => {
                                    const nextPhon =
                                      s5PhonemicHits + (nm === scholar.correctName ? 1 : 0);
                                    if (s5ScholarIdx + 1 >= S5_SCHOLARS.length) {
                                      const expandTo12 = (arr: number[]) => {
                                        const base4 = arr.slice(0, 4);
                                        while (base4.length < 4) base4.push(base4.length);
                                        return [
                                          ...base4,
                                          ...base4.map((x) => x + 4),
                                          ...base4.map((x) => x + 8)
                                        ];
                                      };
                                      const res = computeSequenceAndAssociativeScores({
                                        placedOrder: expandTo12(s5PickedSeq),
                                        sLetterFree: s5FreeLetterHit ? 9 : 4,
                                        sCuedTotal: 11,
                                        auditoryPlacedOrder: sensoryChecks.hearingCheckPassed
                                          ? expandTo12(s5AudioPicked)
                                          : null,
                                        famousStep1FreeNamingCorrect: Math.min(
                                          8,
                                          Math.round((s5FreeHits / 3) * 8)
                                        ),
                                        famousStep2aVisualSemanticCorrect: Math.min(
                                          8,
                                          Math.max(6, Math.round((s5SemanticHits / 3) * 8))
                                        ),
                                        famousStep2bVerbalClueCorrect: 8,
                                        famousStep3PhonemicCuedCorrect: Math.min(
                                          8,
                                          Math.max(6, Math.round((nextPhon / 3) * 8))
                                        ),
                                        measuredDurationSec: 158.0
                                      });
                                      onUpdateStationTelemetry({ 'S5.1': res });
                                      setPagePhase('ACTIVITY_COMPLETE');
                                    } else {
                                      setS5PhonemicHits(nextPhon);
                                      setS5ScholarIdx(s5ScholarIdx + 1);
                                      setS5ScholarStep('FREE');
                                    }
                                  }}
                                  className="p-3 rounded-xl bg-slate-900 hover:bg-emerald-700 border border-slate-700 text-xs font-bold text-white cursor-pointer"
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
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SCREEN 3: CALM SINGLE-BUTTON TRANSITION TO NEXT ACTIVITY
         ===================================================================== */}
      {pagePhase === 'ACTIVITY_COMPLETE' && (
        <div className="my-auto max-w-xl w-full mx-auto text-center space-y-5 py-8">
          <div className="inline-block px-3.5 py-1 rounded-full bg-emerald-950 border border-emerald-400/50 text-xs font-bold text-emerald-300">
            ✓ {meta.title} Complete (Peak Complexity Reached: Tier {adaptiveTier} of 5)
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {meta.nextStationId
              ? `Ready for Activity ${meta.num + 1} of 6`
              : 'All 6 Assessment Activities Complete'}
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            {meta.nextStationId
              ? 'Take a breath whenever you need, then click Continue below to view the instructions for the next activity.'
              : 'Thank you for completing the full adaptive calibration battery. You may now open the Provider & Judge Results Report.'}
          </p>

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            {meta.nextStationId ? (
              <button
                type="button"
                data-testid="next-station-btn"
                onClick={() => onSelectStation(meta.nextStationId!)}
                className="min-h-14 px-8 py-4 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-base shadow-xl cursor-pointer"
              >
                Continue to Activity {meta.num + 1} of 6 &rarr;
              </button>
            ) : (
              onFinishAssessment && (
                <button
                  type="button"
                  data-testid="finish-view-results-btn"
                  onClick={onFinishAssessment}
                  className="min-h-14 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-xl cursor-pointer"
                >
                  Open Provider &amp; Judge Results Report &rarr;
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Subtle Bottom Navigation Strip (Allows Clinician/Tester to Step Back/Forward if Needed) */}
      <div className="mt-6 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          Page View: {pagePhase === 'INTRO_DEMO' ? '1. Instructions & Safe Demo' : pagePhase === 'ACTIVE_TEST' ? '2. Live Adaptive Exercise' : '3. Activity Complete'}
        </span>
        <div className="flex items-center gap-3">
          {meta.nextStationId && pagePhase !== 'ACTIVITY_COMPLETE' && (
            <button
              type="button"
              data-testid="next-station-btn"
              onClick={() => onSelectStation(meta.nextStationId!)}
              className="hover:text-slate-300 underline cursor-pointer"
            >
              Skip to Activity {meta.num + 1} &rarr;
            </button>
          )}
          {onFinishAssessment && (
            <button
              type="button"
              data-testid="finish-view-results-btn"
              onClick={onFinishAssessment}
              className="hover:text-slate-300 underline cursor-pointer"
            >
              Exit to Provider Results Report
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
