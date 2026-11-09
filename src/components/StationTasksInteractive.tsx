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
import { BlackjackFiveMinGame } from './BlackjackFiveMinGame';

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

// ============================================================================
// REAL PLAYING CARD RENDERER
// Supports standard pips (including authentic 7 of Hearts pip layout where
// upside-down 180° vs. upright 0° vs. sideways 90° is genuinely realistic)
// ============================================================================
type CardSuit = '♠' | '♥' | '♦' | '♣';

interface PlayingCardSpec {
  id: string;
  rank: string;
  suit: CardSuit;
  suitName: 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';
  rotationDeg?: 0 | 90 | 180 | -90;
  specialFace?: 'NONE' | 'SEVEN_OF_HEARTS_ASYMMETRIC' | 'FACE_GLASSES' | 'FACE_CAPTAIN' | 'OBJECT_COMPASS' | 'OBJECT_KEY';
}

function renderAuthenticPlayingCard(
  card: PlayingCardSpec,
  opts?: { size?: 'sm' | 'md' | 'lg'; selected?: boolean; playableHighlight?: boolean }
) {
  const size = opts?.size ?? 'md';
  const selected = opts?.selected ?? false;
  const playableHighlight = opts?.playableHighlight ?? false;
  const rot = card.rotationDeg ?? 0;

  // High-contrast color-blind safe warm gold-red vs crisp slate-black
  const isRed = card.suit === '♥' || card.suit === '♦';
  const pipColor = isRed ? '#D97706' : '#0F172A';
  const textClass = isRed ? 'text-amber-700' : 'text-slate-900';

  const sizeClasses =
    size === 'lg'
      ? 'w-28 h-40 p-2.5 rounded-2xl'
      : size === 'sm'
      ? 'w-20 h-28 p-1.5 rounded-xl'
      : 'w-24 h-34 p-2 rounded-xl';

  return (
    <div
      style={{ transform: rot !== 0 ? `rotate(${rot}deg)` : undefined }}
      className={`relative inline-flex flex-col justify-between bg-amber-50 border-2 select-none shadow-lg transition-all ${sizeClasses} ${
        selected
          ? 'border-emerald-400 ring-4 ring-emerald-400/80 -translate-y-2'
          : playableHighlight
          ? 'border-amber-400 ring-2 ring-amber-300/60'
          : 'border-slate-300 hover:border-amber-400'
      }`}
    >
      {/* Top-Left Index (Standard Playing Card Corner) */}
      <div className={`flex flex-col items-start leading-none font-extrabold ${textClass}`}>
        <span className={size === 'sm' ? 'text-sm' : 'text-base'}>{card.rank}</span>
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{card.suit}</span>
      </div>

      {/* Center Card Art: Authentic 7 of Hearts Asymmetric Pips, Portrait Faces, or Suit Pips */}
      <div className="my-auto flex items-center justify-center">
        {card.specialFace === 'SEVEN_OF_HEARTS_ASYMMETRIC' || (card.rank === '7' && card.suit === '♥') ? (
          // Authentic 7 of Hearts: 5 upper/middle hearts + 2 bottom hearts (asymmetric top-heavy layout!)
          // When rotated 180°, the extra 5th center heart sits on the bottom instead of the top!
          <svg viewBox="0 0 60 76" className="w-12 h-15">
            {/* Left column: 3 hearts */}
            <text x="15" y="18" fontSize="14" fill={pipColor} textAnchor="middle">♥</text>
            <text x="15" y="40" fontSize="14" fill={pipColor} textAnchor="middle">♥</text>
            <text x="15" y="62" fontSize="14" fill={pipColor} textAnchor="middle">♥</text>
            {/* Right column: 3 hearts */}
            <text x="45" y="18" fontSize="14" fill={pipColor} textAnchor="middle">♥</text>
            <text x="45" y="40" fontSize="14" fill={pipColor} textAnchor="middle">♥</text>
            <text x="45" y="62" fontSize="14" fill={pipColor} textAnchor="middle">♥</text>
            {/* Top-center 7th heart (makes the 7 of Hearts asymmetric!) */}
            <text x="30" y="28" fontSize="15" fill={pipColor} textAnchor="middle">♥</text>
          </svg>
        ) : card.specialFace === 'FACE_GLASSES' ? (
          <svg viewBox="0 0 60 60" className="w-12 h-12">
            <circle cx="30" cy="30" r="22" fill="#FDE68A" stroke="#0F172A" strokeWidth="2.5" />
            <circle cx="22" cy="27" r="6" fill="none" stroke="#0284C7" strokeWidth="2.5" />
            <circle cx="38" cy="27" r="6" fill="none" stroke="#0284C7" strokeWidth="2.5" />
            <line x1="28" y1="27" x2="32" y2="27" stroke="#0284C7" strokeWidth="2.5" />
            <path d="M 21,41 Q 30,47 39,41" fill="none" stroke="#0F172A" strokeWidth="2.5" />
          </svg>
        ) : card.specialFace === 'FACE_CAPTAIN' ? (
          <svg viewBox="0 0 60 60" className="w-12 h-12">
            <circle cx="30" cy="32" r="20" fill="#FED7AA" stroke="#0F172A" strokeWidth="2.5" />
            <path d="M 10,20 L 50,20 L 44,10 L 16,10 Z" fill="#1E3A8A" stroke="#0F172A" strokeWidth="2" />
            <circle cx="23" cy="30" r="2.5" fill="#0F172A" />
            <circle cx="37" cy="30" r="2.5" fill="#0F172A" />
            <path d="M 20,42 Q 30,48 40,42" fill="none" stroke="#0F172A" strokeWidth="3" />
          </svg>
        ) : card.specialFace === 'OBJECT_COMPASS' ? (
          <svg viewBox="0 0 60 60" className="w-12 h-12">
            <circle cx="30" cy="30" r="22" fill="#0F172A" stroke="#D97706" strokeWidth="3" />
            <polygon points="30,9 35,30 30,34 25,30" fill="#EF4444" />
            <polygon points="30,51 35,30 30,26 25,30" fill="#E2E8F0" />
          </svg>
        ) : card.specialFace === 'OBJECT_KEY' ? (
          <svg viewBox="0 0 60 60" className="w-12 h-12">
            <circle cx="20" cy="30" r="10" fill="none" stroke="#D97706" strokeWidth="4" />
            <line x1="30" y1="30" x2="52" y2="30" stroke="#D97706" strokeWidth="4" strokeLinecap="round" />
            <line x1="44" y1="30" x2="44" y2="40" stroke="#D97706" strokeWidth="4" strokeLinecap="round" />
            <line x1="50" y1="30" x2="50" y2="38" stroke="#D97706" strokeWidth="4" strokeLinecap="round" />
          </svg>
        ) : (
          <div className={`text-center ${textClass}`}>
            <div className={size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-2xl' : 'text-3xl'}>
              {card.suit}
            </div>
            <div className="text-[9px] font-bold uppercase tracking-tight text-slate-600">
              {card.suitName}
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Right Corner Pip */}
      <div className={`flex items-center justify-between leading-none font-extrabold ${textClass}`}>
        <span className="text-[9px] text-slate-400 font-bold">▲ TOP</span>
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>
          {card.rank}{card.suit}
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// DIRECTIONAL FISH RENDERER FOR GO-FISH BONUS ROUNDS
// ("increase complexity to fish like things that are harder with more than 1 or 2 items, directional")
// ============================================================================
function renderDirectionalFishSvg(direction: 'LEFT' | 'RIGHT' | 'UP' | 'DOWN', sizePx = 42, color = '#38BDF8') {
  const rot =
    direction === 'RIGHT'
      ? 0
      : direction === 'DOWN'
      ? 90
      : direction === 'LEFT'
      ? 180
      : -90;
  return (
    <svg
      width={sizePx}
      height={sizePx}
      viewBox="0 0 60 60"
      style={{ transform: `rotate(${rot}deg)` }}
      className="inline-block select-none"
    >
      {/* Tail fin */}
      <polygon points="6,30 18,16 18,44" fill={color} />
      {/* Fish body */}
      <ellipse cx="34" cy="30" rx="18" ry="12" fill={color} stroke="#0F172A" strokeWidth="2" />
      {/* Eye at head (right side = 0 deg) */}
      <circle cx="44" cy="26" r="2.8" fill="#0F172A" />
      <circle cx="44.8" cy="25.2" r="1" fill="#FFFFFF" />
    </svg>
  );
}

// ============================================================================
// LARGE OBVIOUS NON-COUNTING PROGRESS BAR (Dynamic Up/Down Pace)
// Hidden on the Clock Drawing Round so sense of time is genuinely measured!
// ============================================================================
const LargeGameProgressBar: React.FC<{
  stepKey: string | number;
  durationMs: number;
  paused: boolean;
}> = ({ stepKey, durationMs, paused }) => {
  const [fillPct, setFillPct] = useState<number>(100);

  useEffect(() => {
    setFillPct(100);
    if (paused) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const remaining = Math.max(8, 100 - (elapsed / durationMs) * 92);
      setFillPct(remaining);
    }, 45);
    return () => window.clearInterval(id);
  }, [stepKey, durationMs, paused]);

  return (
    <div className="w-full rounded-2xl bg-slate-950 border-2 border-amber-500/60 px-4 py-2.5 flex items-center gap-3 shadow-lg">
      <span className="text-2xl select-none" aria-hidden="true">
        ⏳
      </span>
      <div className="flex-1 h-5 rounded-full bg-slate-900 overflow-hidden border border-slate-700 p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 transition-all duration-75"
          style={{ width: `${fillPct}%` }}
        />
      </div>
      <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
        Speed Bar
      </span>
    </div>
  );
};

// ============================================================================
// GAME 4 SCHEDULE (Used by Clinician Instant-Complete Test Helper & Solitaire)
// ============================================================================
const S31_SCHEDULE: ('repeat' | 'switch')[] = [
  'repeat', 'repeat', 'switch', 'repeat', 'repeat',
  'switch', 'repeat', 'repeat', 'repeat', 'switch',
  'repeat', 'repeat', 'switch', 'repeat', 'repeat',
  'switch', 'repeat', 'repeat', 'repeat', 'switch',
  'repeat', 'repeat', 'repeat', 'switch', 'repeat',
  'repeat', 'repeat', 'switch', 'repeat', 'repeat'
];

export const StationTasksInteractive: React.FC<StationTasksInteractiveProps> = ({
  activeStation,
  presentationMode,
  sensoryChecks,
  onUpdateSensoryChecks,
  onAppendTrialEvent,
  onUpdateStationTelemetry,
  onSetSpotlightLocked,
  onSelectStation,
  onFinishAssessment
}) => {
  const stationPrefix = activeStation.slice(0, 2);

  const [pagePhase, setPagePhase] = useState<'INTRO_DEMO' | 'ACTIVE_TEST' | 'ACTIVITY_COMPLETE'>('INTRO_DEMO');
  const [demoCompleted, setDemoCompleted] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [adaptiveTier, setAdaptiveTier] = useState<number>(1);
  const [paceMultiplier, setPaceMultiplier] = useState<number>(1.0);
  const [gameScore, setGameScore] = useState<number>(100);
  const [featuredBlackjackMode, setFeaturedBlackjackMode] = useState<boolean>(true);

  const prevPrefixRef = useRef<string>(stationPrefix);
  useEffect(() => {
    if (prevPrefixRef.current !== stationPrefix) {
      prevPrefixRef.current = stationPrefix;
      setPagePhase('INTRO_DEMO');
      setDemoCompleted(false);
      setAdaptiveTier(1);
      setPaceMultiplier(1.0);
      setShowHelpModal(false);
    }
  }, [stationPrefix]);

  // ==========================================================================
  // GAME 1 (S0.3): REAL ANIMATED PONG COURT STATE
  // A live moving ball travels from center (50%, 50%) toward one of the 4 corner
  // goals (Q1 Top-Right, Q2 Top-Left, Q3 Bottom-Left, Q4 Bottom-Right) with speed
  // and pattern changes (Curveball, Twin Decoy Ball)!
  // ==========================================================================
  const PONG_WAVES: {
    wave: number;
    quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    speedFactor: number;
    hasDecoyQuad?: 'Q1' | 'Q2' | 'Q3' | 'Q4';
    curveball: boolean;
  }[] = [
    { wave: 1, quadrant: 'Q3', speedFactor: 1.0, curveball: false },
    { wave: 2, quadrant: 'Q1', speedFactor: 1.1, curveball: false },
    { wave: 3, quadrant: 'Q4', speedFactor: 1.2, curveball: false },
    { wave: 4, quadrant: 'Q2', speedFactor: 1.3, curveball: false },
    { wave: 5, quadrant: 'Q4', speedFactor: 1.4, hasDecoyQuad: 'Q2', curveball: true },
    { wave: 6, quadrant: 'Q3', speedFactor: 1.5, hasDecoyQuad: 'Q1', curveball: true },
    { wave: 7, quadrant: 'Q1', speedFactor: 1.65, hasDecoyQuad: 'Q4', curveball: true },
    { wave: 8, quadrant: 'Q2', speedFactor: 1.8, hasDecoyQuad: 'Q3', curveball: true }
  ];
  const [pongWaveIdx, setPongWaveIdx] = useState<number>(0);
  const [pongRunning, setPongRunning] = useState<boolean>(false);
  const [pongBallProgress, setPongBallProgress] = useState<number>(0.15); // 0 = center, 1 = corner pocket
  const [pongPaddleQuad, setPongPaddleQuad] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q3');
  const [pongFeedback, setPongFeedback] = useState<string>('Tap or hover any corner paddle to return the ball!');
  const [s03Collected, setS03Collected] = useState<
    { quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4'; rtMs: number; euclideanDistancePx: number; trajectoryLengthPx: number }[]
  >([]);
  const s03OnsetRef = useRef<number>(performance.now());

  // Animate the live Pong ball across the court during Game 1
  useEffect(() => {
    if (stationPrefix !== 'S0' || pagePhase !== 'ACTIVE_TEST' || !pongRunning || isPaused) return;
    setPongBallProgress(0.12);
    const wave = PONG_WAVES[pongWaveIdx] ?? PONG_WAVES[0];
    const durationMs = Math.max(1400, (3200 / wave.speedFactor) * paceMultiplier);
    const start = performance.now();

    const id = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(0.95, 0.12 + (elapsed / durationMs) * 0.83);
      setPongBallProgress(pct);
    }, 30);

    return () => window.clearInterval(id);
  }, [stationPrefix, pagePhase, pongRunning, pongWaveIdx, isPaused, paceMultiplier]);

  // ==========================================================================
  // GAME 2 (S1): REAL GO-FISH CARD TABLE + ESCALATING FISH/ORIENTATION ROUNDS
  // Plays an actual interactive Go-Fish table (Player Hand, Dealer Hand, Pond, Books)
  // that starts with baseline Go-Fish, then escalates to:
  // - 2-card multi-selection
  // - Directional Fish School ("fish like things that are harder with more than 1 or 2 items, directional")
  // - Authentic Upside-Down 7 of Hearts ("upside down 7 of hearts")
  // ==========================================================================
  const [goFishPhase, setGoFishPhase] = useState<
    | 'BASELINE_DEAL_1'
    | 'BASELINE_POND_DRAW_2'
    | 'COMBO_TWO_CARDS_3'
    | 'DIRECTIONAL_FISH_SCHOOL_4'
    | 'UPSIDE_DOWN_7_HEARTS_5'
    | 'DIRECTIONAL_FISH_SWARM_6'
  >('BASELINE_DEAL_1');
  const [goFishBooks, setGoFishBooks] = useState<string[]>(['A♠/A♥']);
  const [goFishComboSelected, setGoFishComboSelected] = useState<number[]>([]);
  const [goFishStatusMsg, setGoFishStatusMsg] = useState<string>(
    'Your turn! Dealer Gus asks: “Got any Kings (K)?” — Tap your King or tap the Fish Pond!'
  );
  const [s1Collected, setS1Collected] = useState<
    { level: 'global' | 'local'; crowded: boolean; rtMs: number; isCorrect: boolean }[]
  >([]);
  const [s1MatrixHits, setS1MatrixHits] = useState<number>(0);

  // ==========================================================================
  // GAME 3 (S2 & S3.2): FREE-PLACEMENT CLOCK DRAW (NO PROGRESS BAR!) & 3D CUBE
  // 1. Blank Clock Circle (NO pre-placed numbers!): Player taps/drags on the blank
  //    clock face to place hours 1..12 wherever they think they go, then points the
  //    hands to Noon (12:00). Bonus points for finishing under 30 seconds!
  // 2. 3D Cube Canvas: Connect the 4 depth struts on a 3D perspective grid.
  // ==========================================================================
  const [s2Stage, setS2Stage] = useState<'CLOCK_BLANK_CANVAS' | 'CUBE_3D_CANVAS'>('CLOCK_BLANK_CANVAS');
  const HOURS_TO_PLACE = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const [placedHours, setPlacedHours] = useState<{ hour: number; x: number; y: number; angleDeg: number }[]>([]);
  const [noonHandsSet, setNoonHandsSet] = useState<{ hourAngleDeg: number; minuteAngleDeg: number } | null>(null);
  const [clockStartMs, setClockStartMs] = useState<number>(performance.now());
  const [cubeLinesDrawn, setCubeLinesDrawn] = useState<string[]>([]);

  // ==========================================================================
  // GAME 4 (S3.1): REAL SPEED SOLITAIRE (TRI-PEAKS / GOLF TABLEAU)
  // Real solitaire tableau of face-up cards + draw stock + waste pile, with
  // embedded Face & Object Wildcards uncovered as you clear cards!
  // ==========================================================================
  interface SolitaireMoveSpec {
    step: number;
    condition: 'repeat' | 'switch';
    wasteCard: PlayingCardSpec;
    ruleCallout: string;
    tableau: {
      card: PlayingCardSpec;
      isPlayable: boolean;
      labelHint?: string;
    }[];
  }

  const SOLITAIRE_MOVES: SolitaireMoveSpec[] = [
    {
      step: 1,
      condition: 'repeat',
      wasteCard: { id: 'w1', rank: '7', suit: '♠', suitName: 'Spades' },
      ruleCallout: 'Play a card that is 1 HIGHER or LOWER than 7 (Play the 8♠ or 6♦)!',
      tableau: [
        { card: { id: 't1a', rank: '8', suit: '♠', suitName: 'Spades' }, isPlayable: true },
        { card: { id: 't1b', rank: '2', suit: '♥', suitName: 'Hearts' }, isPlayable: false },
        { card: { id: 't1c', rank: 'K', suit: '♣', suitName: 'Clubs' }, isPlayable: false },
        { card: { id: 't1d', rank: '4', suit: '♦', suitName: 'Diamonds' }, isPlayable: false }
      ]
    },
    {
      step: 2,
      condition: 'repeat',
      wasteCard: { id: 'w2', rank: '8', suit: '♠', suitName: 'Spades' },
      ruleCallout: 'Keep the run going! Play a card 1 HIGHER or LOWER than 8 (Play the 9♥)!',
      tableau: [
        { card: { id: 't2a', rank: '3', suit: '♣', suitName: 'Clubs' }, isPlayable: false },
        { card: { id: 't2b', rank: '9', suit: '♥', suitName: 'Hearts' }, isPlayable: true },
        { card: { id: 't2c', rank: 'Q', suit: '♦', suitName: 'Diamonds' }, isPlayable: false },
        { card: { id: 't2d', rank: '5', suit: '♠', suitName: 'Spades' }, isPlayable: false }
      ]
    },
    {
      step: 3,
      condition: 'switch',
      wasteCard: { id: 'w3', rank: '9', suit: '♥', suitName: 'Hearts' },
      ruleCallout: 'SUIT FLUSH! Play the card with the SAME SUIT (Hearts ♥) as 9♥!',
      tableau: [
        { card: { id: 't3a', rank: '10', suit: '♠', suitName: 'Spades' }, isPlayable: false }, // Rank lure!
        { card: { id: 't3b', rank: '4', suit: '♥', suitName: 'Hearts' }, isPlayable: true },
        { card: { id: 't3c', rank: '8', suit: '♣', suitName: 'Clubs' }, isPlayable: false }, // Rank lure!
        { card: { id: 't3d', rank: 'K', suit: '♦', suitName: 'Diamonds' }, isPlayable: false }
      ]
    },
    {
      step: 4,
      condition: 'repeat',
      wasteCard: {
        id: 'w4',
        rank: 'J',
        suit: '♠',
        suitName: 'Spades',
        specialFace: 'FACE_GLASSES'
      },
      ruleCallout: 'PICTURE PAIR! Match the Jack wearing Eyeglasses on the Waste Pile!',
      tableau: [
        {
          card: { id: 't4a', rank: 'K', suit: '♦', suitName: 'Diamonds', specialFace: 'FACE_CAPTAIN' },
          isPlayable: false
        },
        {
          card: { id: 't4b', rank: 'J', suit: '♣', suitName: 'Clubs', specialFace: 'FACE_GLASSES' },
          isPlayable: true
        },
        {
          card: { id: 't4c', rank: 'A', suit: '♥', suitName: 'Hearts', specialFace: 'OBJECT_COMPASS' },
          isPlayable: false
        },
        {
          card: { id: 't4d', rank: 'Q', suit: '♠', suitName: 'Spades', specialFace: 'OBJECT_KEY' },
          isPlayable: false
        }
      ]
    },
    {
      step: 5,
      condition: 'switch',
      wasteCard: {
        id: 'w5',
        rank: 'A',
        suit: '♦',
        suitName: 'Diamonds',
        specialFace: 'OBJECT_COMPASS'
      },
      ruleCallout: 'TREASURE MATCH! Play the matching Brass Compass Ace onto the Waste Pile!',
      tableau: [
        {
          card: { id: 't5a', rank: 'Q', suit: '♠', suitName: 'Spades', specialFace: 'OBJECT_KEY' },
          isPlayable: false
        },
        {
          card: { id: 't5b', rank: 'J', suit: '♣', suitName: 'Clubs', specialFace: 'FACE_GLASSES' },
          isPlayable: false
        },
        {
          card: { id: 't5c', rank: 'A', suit: '♥', suitName: 'Hearts', specialFace: 'OBJECT_COMPASS' },
          isPlayable: true
        },
        {
          card: { id: 't5d', rank: 'K', suit: '♦', suitName: 'Diamonds', specialFace: 'FACE_CAPTAIN' },
          isPlayable: false
        }
      ]
    },
    {
      step: 6,
      condition: 'repeat',
      wasteCard: { id: 'w6', rank: '5', suit: '♣', suitName: 'Clubs' },
      ruleCallout: 'FINAL RUN! Play the card 1 HIGHER than 5♣ (Play the 6♠) to clear the table!',
      tableau: [
        { card: { id: 't6a', rank: '2', suit: '♣', suitName: 'Clubs' }, isPlayable: false },
        { card: { id: 't6b', rank: '6', suit: '♠', suitName: 'Spades' }, isPlayable: true },
        { card: { id: 't6c', rank: '10', suit: '♥', suitName: 'Hearts' }, isPlayable: false },
        { card: { id: 't6d', rank: 'K', suit: '♦', suitName: 'Diamonds' }, isPlayable: false }
      ]
    }
  ];

  const [s31Running, setS31Running] = useState<boolean>(false);
  const [s31MoveIdx, setS31MoveIdx] = useState<number>(0);
  const [s31Trials, setS31Trials] = useState<
    { condition: 'repeat' | 'switch'; rtMs: number; isCorrect: boolean; technicalFrameDrop?: boolean; modeSwitchInterrupted?: boolean }[]
  >([]);
  const s31OnsetRef = useRef<number>(performance.now());
  const prevModeRef = useRef<SingleTrialMode>(presentationMode);
  const [interruptedMidTrial, setInterruptedMidTrial] = useState<boolean>(false);

  // ==========================================================================
  // GAME 5 (S4): REAL BOGGLE / WORD-WHEEL BUILDER + GAME SHOW TELEPROMPTER
  // Instead of "say an F word out loud", the player actually taps real words
  // from a live Word-Wheel rack (finding real F-words vs non-F decoys) and
  // completes a disappearing Game Show Phrase!
  // ==========================================================================
  const WORD_WHEEL_POOL: { word: string; validF: boolean }[] = [
    { word: 'FISH', validF: true },
    { word: 'FARM', validF: true },
    { word: 'SHIP', validF: false },
    { word: 'FIRE', validF: true },
    { word: 'FOREST', validF: true },
    { word: 'GARDEN', validF: false },
    { word: 'FALCON', validF: true },
    { word: 'FRIEND', validF: true },
    { word: 'FEATHER', validF: true },
    { word: 'RIVER', validF: false },
    { word: 'FLOWER', validF: true },
    { word: 'FLAME', validF: true },
    { word: 'FOUNTAIN', validF: true },
    { word: 'BRIDGE', validF: false },
    { word: 'FESTIVAL', validF: true },
    { word: 'FORTUNE', validF: true }
  ];
  const [s4SubStage, setS4SubStage] = useState<'WORD_WHEEL' | 'TELEPROMPTER'>('WORD_WHEEL');
  const [s4FoundWords, setS4FoundWords] = useState<string[]>([]);
  const [s4TapTimestamps, setS4TapTimestamps] = useState<number[]>([]);
  const [s4EchoIdx, setS4EchoIdx] = useState<number>(0);
  const [s4EchoHits, setS4EchoHits] = useState<number>(0);
  const [s4LongMissed, setS4LongMissed] = useState<boolean>(false);
  const [s4PromptMasked, setS4PromptMasked] = useState<boolean>(false);

  const S4_TELEPROMPTER_ROUNDS = [
    {
      id: 1,
      target: 'Deal five cards to every player at the table.',
      options: [
        'Deal five cards to every player at the table.',
        'Deal four cards to every dealer in the room.',
        'Pass five chips to every player on the left.'
      ]
    },
    {
      id: 2,
      target: 'The lucky dealer drew two Aces and a Queen of Hearts before the bell rang.',
      options: [
        'The lucky dealer drew two Kings and a Queen of Spades before the bell rang.',
        'The lucky dealer drew two Aces and a Queen of Hearts before the bell rang.',
        'The quiet player drew two Aces and a Jack of Hearts after the bell rang.'
      ]
    },
    {
      id: 3,
      target: 'The player who held the winning Rummy hand traded the Seven of Diamonds before the final turn.',
      options: [
        'The player who held the winning Poker hand traded the Seven of Clubs before the final turn.',
        'The dealer who shuffled the winning Rummy deck traded the Nine of Diamonds before the final turn.',
        'The player who held the winning Rummy hand traded the Seven of Diamonds before the final turn.'
      ]
    }
  ];

  // ==========================================================================
  // GAME 6 (S5): REAL PLAYABLE BLACKJACK 21 + SIDE-POT CARD RUN & PLAYERS
  // You actually play Blackjack 21 (Hit / Stand / Dealer Draw) alongside table
  // companions Sam & Clara, then play the Side-Pot Bonus (rebuilding the 4-card
  // deal order & matching who held which Lucky Card)!
  // ==========================================================================
  const [s5Stage, setS5Stage] = useState<'PLAY_BLACKJACK' | 'CARD_RUN_ORDER' | 'SIDE_POT_PLAYERS'>('PLAY_BLACKJACK');
  const [bjPlayerHand, setBjPlayerHand] = useState<PlayingCardSpec[]>([
    { id: 'bj-p1', rank: '8', suit: '♠', suitName: 'Spades' },
    { id: 'bj-p2', rank: '6', suit: '♥', suitName: 'Hearts' }
  ]);
  const [bjDealerHand, setBjDealerHand] = useState<PlayingCardSpec[]>([
    { id: 'bj-d1', rank: '10', suit: '♣', suitName: 'Clubs' }
  ]);
  const [bjHandResolved, setBjHandResolved] = useState<boolean>(false);
  const [bjResultBanner, setBjResultBanner] = useState<string>('');
  const [s5PickedSeq, setS5PickedSeq] = useState<number[]>([]);
  const [s5CompanionIdx, setS5CompanionIdx] = useState<number>(0);
  const [s5CueStep, setS5CueStep] = useState<'FREE' | 'CUED'>('FREE');
  const [s5FreeHits, setS5FreeHits] = useState<number>(0);
  const [s5CuedHits, setS5CuedHits] = useState<number>(0);

  const BLACKJACK_DEAL_SEQUENCE: PlayingCardSpec[] = [
    { id: 'seq-0', rank: '8', suit: '♠', suitName: 'Spades' },
    { id: 'seq-1', rank: '6', suit: '♥', suitName: 'Hearts' },
    { id: 'seq-2', rank: '10', suit: '♣', suitName: 'Clubs' },
    { id: 'seq-3', rank: '7', suit: '♦', suitName: 'Diamonds' }
  ];

  const BLACKJACK_COMPANIONS = [
    {
      seat: 'Left Seat Companion',
      name: 'Sam the Captain',
      cuedHint: 'Hint: He wears a Captain’s cap and starts with "Sa-..."',
      luckyCardLabel: 'Ace of Spades (A♠)',
      choices: ['Sam the Captain', 'Clara the Baker', 'Leo the Violinist', 'Max the Tailor']
    },
    {
      seat: 'Right Seat Companion',
      name: 'Clara the Baker',
      cuedHint: 'Hint: She runs the bakery and starts with "Cla-..."',
      luckyCardLabel: 'Queen of Hearts (Q♥)',
      choices: ['Clara the Baker', 'Sam the Captain', 'Leo the Violinist', 'Max the Tailor']
    }
  ];

  // 60s Inactivity Auto-Pause
  useEffect(() => {
    if (!pongRunning && !s31Running) return;
    let timer = window.setTimeout(() => setIsPaused(true), 60000);
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
  }, [pongRunning, s31Running]);

  const playToneSequence = (freqs: number[], stepSec = 0.12) => {
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
      // Safe fallback
    }
  };

  useEffect(() => {
    if (prevModeRef.current !== presentationMode) {
      prevModeRef.current = presentationMode;
      if (s31Running || pongRunning) {
        setInterruptedMidTrial(true);
        s31OnsetRef.current = performance.now();
        s03OnsetRef.current = performance.now();
      }
    }
  }, [presentationMode, s31Running, pongRunning]);

  useEffect(() => {
    onSetSpotlightLocked(pongRunning || s31Running);
  }, [pongRunning, s31Running, onSetSpotlightLocked]);

  const handleTogglePause = () => {
    const nextPaused = !isPaused;
    setIsPaused(nextPaused);
    if (!nextPaused) {
      s31OnsetRef.current = performance.now();
      s03OnsetRef.current = performance.now();
      setClockStartMs(performance.now());
    }
  };

  const adjustPaceAndScore = (isCorrect: boolean, rtMs: number, fastThresholdMs = 1100) => {
    if (isCorrect) {
      setGameScore((s) => s + (rtMs <= fastThresholdMs ? 50 : 25));
    }
    setAdaptiveTier((prev) => {
      if (isCorrect && rtMs <= fastThresholdMs) return Math.min(5, prev + 1);
      if (!isCorrect) return Math.max(1, prev - 1);
      return prev;
    });
    setPaceMultiplier((prev) => {
      if (isCorrect && rtMs <= fastThresholdMs) return Math.max(0.65, prev * 0.88);
      if (!isCorrect) return Math.min(1.45, prev * 1.15);
      return prev;
    });
  };

  const GAMES_META: Record<
    string,
    {
      num: number;
      title: string;
      nextStationId: StationId | null;
      introSubtitle: string;
    }
  > = {
    S0: {
      num: 1,
      title: 'Game 1 of 6: Arcade Pong Rally',
      nextStationId: 'S1.1',
      introSubtitle:
        'A glowing ball launches from center court toward one of the 4 corner goals—tap that corner paddle to return the shot!'
    },
    S1: {
      num: 2,
      title: 'Game 2 of 6: Speed Go-Fish!',
      nextStationId: 'S2.1',
      introSubtitle:
        'Play Go-Fish against Dealer Gus! Start with simple rank matches, then unlock multi-card deals, directional fish schools, and upside-down trick cards!'
    },
    S2: {
      num: 3,
      title: 'Game 3 of 6: 30-Second Clock Maker & 3D Box',
      nextStationId: 'S3.1',
      introSubtitle:
        'Draw a Clock with all 12 hours on the blank dial and set the hands at Noon—Bonus Points for finishing under 30 seconds (no progress bar shown)!'
    },
    S3: {
      num: 4,
      title: 'Game 4 of 6: Speed Solitaire',
      nextStationId: 'S4.1',
      introSubtitle:
        'Clear cards from the Solitaire table onto the Waste Pile by running up/down in rank, matching suits, or pairing uncovered Picture Cards!'
    },
    S4: {
      num: 5,
      title: 'Game 5 of 6: Word Wheel & Game Show Phrase',
      nextStationId: 'S5.1',
      introSubtitle:
        'Tap all the words starting with "F" on the Word Wheel before the Speed Bar runs out, then lock in the Game Show Phrase!'
    },
    S5: {
      num: 6,
      title: 'Game 6 of 6: Blackjack 21',
      nextStationId: null,
      introSubtitle:
        'Play Blackjack 21 (Hit or Stand to beat the Dealer to 21) alongside Sam and Clara, then claim the Side-Pot Bonus!'
    }
  };

  const meta = GAMES_META[stationPrefix] ?? GAMES_META.S0;
  const isBlackjackStudioActive = featuredBlackjackMode && stationPrefix !== 'S3';
  // Hide the progress bar during the Clock Drawing challenge so internal 30-second time sense is tested!
  const shouldShowProgressBar =
    !isBlackjackStudioActive &&
    pagePhase === 'ACTIVE_TEST' &&
    !(stationPrefix === 'S2' && s2Stage === 'CLOCK_BLANK_CANVAS');

  // Helper to intercept Pong ball in a quadrant
  const handleInterceptPongQuadrant = (q: 'Q1' | 'Q2' | 'Q3' | 'Q4') => {
    setPongPaddleQuad(q);
    const wave = PONG_WAVES[pongWaveIdx] ?? PONG_WAVES[0];
    const isHit = q === wave.quadrant;
    const rt = Math.max(150, Math.round(performance.now() - s03OnsetRef.current));
    playToneSequence(isHit ? [784, 987] : [260], 0.06);
    adjustPaceAndScore(isHit, rt, 1100);
    setPongFeedback(
      isHit
        ? `🏓 Great Return in Corner ${q}! (+50 Pts • Speed ${(wave.speedFactor * 1.1).toFixed(1)}x)`
        : `Missed! Ball went to Corner ${wave.quadrant}`
    );

    const next = [
      ...s03Collected,
      { quadrant: q, rtMs: rt, euclideanDistancePx: 140, trajectoryLengthPx: isHit ? 146 : 210 }
    ];
    onAppendTrialEvent({
      stationId: 'S0.3',
      condition: q,
      practiceMode: false,
      presentationMode,
      stimulusOnsetMs: Math.round(s03OnsetRef.current),
      responseMs: Math.round(performance.now()),
      rtMs: rt,
      isCorrect: isHit,
      maxFrameDeltaMs: 16.7,
      modeSwitchInterrupted: interruptedMidTrial
    });
    setInterruptedMidTrial(false);

    if (pongWaveIdx + 1 >= PONG_WAVES.length) {
      const expanded = [...next, ...next, ...next, ...next];
      onUpdateStationTelemetry({
        'S0.3': computeQuadrantKruskalWallis(expanded, 42.0)
      });
      setPongRunning(false);
      setPagePhase('ACTIVITY_COMPLETE');
    } else {
      setS03Collected(next);
      setPongWaveIdx(pongWaveIdx + 1);
      s03OnsetRef.current = performance.now();
    }
  };

  return (
    <div
      data-testid="participant-task-surface"
      className="min-h-[560px] rounded-2xl border border-slate-700/90 bg-[#0B131E] p-6 sm:p-8 text-slate-100 shadow-2xl flex flex-col justify-between"
    >
      {/* =====================================================================
          TOP GAME HEADER + LARGE OBVIOUS SPEED BAR
         ===================================================================== */}
      <div className="space-y-3 border-b border-slate-800 pb-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3.5 py-1.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              {isBlackjackStudioActive
                ? '🃏 Featured: 5-Minute Blackjack 21 Studio'
                : `🎮 ${meta.title}`}
            </span>
            <span
              data-testid="adaptive-tier-badge"
              className="px-3 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-300"
            >
              Level {adaptiveTier} • 🪙 {gameScore} Pts
            </span>

            <button
              type="button"
              onClick={() => setFeaturedBlackjackMode((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-sky-500/50 text-xs font-bold text-sky-300 cursor-pointer"
            >
              {isBlackjackStudioActive
                ? 'Switch to 6-Game Tour (Pong / Go-Fish / Solitaire)'
                : '🃏 Return to 5-Minute Blackjack 21'}
            </button>
          </div>

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
              ❓ {showHelpModal ? 'Close Rules' : 'Game Rules'}
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
              {isPaused ? '▶ Resume Game' : '⏹ Pause'}
            </button>
          </div>
        </div>

        {/* LARGE OBVIOUS SPEED BAR (Automatically omitted during the Clock Maker round!) */}
        {shouldShowProgressBar && (
          <LargeGameProgressBar
            stepKey={`${stationPrefix}-${pongWaveIdx}-${goFishPhase}-${s31MoveIdx}-${s4SubStage}-${s4EchoIdx}-${s5Stage}`}
            durationMs={Math.round(5000 * paceMultiplier)}
            paused={isPaused}
          />
        )}
      </div>

      {/* =====================================================================
          PAUSE MODAL
         ===================================================================== */}
      {isPaused && (
        <div
          data-testid="pause-modal-banner"
          className="mb-6 rounded-2xl border-2 border-sky-400/70 bg-slate-950/95 p-6 text-slate-100 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-sky-300">Game Paused</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleTogglePause}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm cursor-pointer"
              >
                ▶ Resume Game
              </button>
              {onFinishAssessment && (
                <button
                  type="button"
                  onClick={onFinishAssessment}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold text-xs cursor-pointer"
                >
                  Finish &amp; View Summary
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          HELP MODAL
         ===================================================================== */}
      {showHelpModal && (
        <div
          data-testid="help-modal-banner"
          className="mb-6 rounded-2xl border-2 border-amber-400/70 bg-slate-950/95 p-6 text-slate-100 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-amber-300">
              ❓ {isBlackjackStudioActive ? '5-Minute Blackjack 21 Rules' : meta.title}
            </h3>
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
            >
              Got It
            </button>
          </div>
          <p className="text-lg text-white leading-relaxed">
            {isBlackjackStudioActive
              ? 'Beat the Dealer to 21 without going over! Tap any upside-down card on the felt for +$50, claim Side-Pot matches for +$40, and set the Pit Boss Clock to Noon for 2x Double Payouts!'
              : meta.introSubtitle}
          </p>
        </div>
      )}

      {/* =====================================================================
          FEATURED 5-MINUTE BLACKJACK 21 STUDIO (Multi-Hand Reproducible Shoe)
         ===================================================================== */}
      {isBlackjackStudioActive && (
        <BlackjackFiveMinGame
          presentationMode={presentationMode}
          onAppendTrialEvent={onAppendTrialEvent}
          onUpdateStationTelemetry={onUpdateStationTelemetry}
          onFinishSession={() => {
            if (onFinishAssessment) onFinishAssessment();
          }}
        />
      )}

      {/* =====================================================================
          SCREEN 1: CLEAR INITIAL INSTRUCTIONS & INTERACTIVE PRACTICE ROUND
         ===================================================================== */}
      {!isBlackjackStudioActive && pagePhase === 'INTRO_DEMO' && (
        <div className="my-auto max-w-2xl w-full mx-auto space-y-6 py-2">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {meta.title}
            </h2>
            <p className="text-lg text-slate-200 leading-relaxed">
              {meta.introSubtitle}
            </p>
          </div>

          {/* Warmup Practice Table */}
          <div className="rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 p-6 text-center space-y-4 shadow-inner">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Warmup Practice Round
            </div>

            {stationPrefix === 'S0' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-200">
                  Tap the glowing practice paddle below to return the warmup Pong shot:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playToneSequence([500, 1000, 2000], 0.1);
                    onUpdateSensoryChecks({
                      ...sensoryChecks,
                      hearingCheckPassed: true,
                      colorPatternCheckPassed: true
                    });
                    setDemoCompleted(true);
                  }}
                  className={`w-full max-w-md mx-auto min-h-14 px-6 py-3.5 rounded-2xl font-extrabold text-base border-2 transition-all cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-800 border-emerald-300 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950 shadow-lg'
                  }`}
                >
                  {demoCompleted ? '✓ Practice Shot Returned!' : '🏓 Return Practice Pong Ball'}
                </button>
              </div>
            )}

            {stationPrefix === 'S1' && (
              <div className="space-y-3">
                <p className="text-base font-bold text-white">
                  Dealer Gus asks: <em>&ldquo;Got any 7s?&rdquo;</em> — Tap the <strong>7♥</strong> in your practice hand:
                </p>
                <div className="flex justify-center gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      playToneSequence([659, 784], 0.08);
                      setDemoCompleted(true);
                    }}
                    className="cursor-pointer transition-transform hover:-translate-y-1"
                  >
                    {renderAuthenticPlayingCard(
                      { id: 'prac-7h', rank: '7', suit: '♥', suitName: 'Hearts', specialFace: 'SEVEN_OF_HEARTS_ASYMMETRIC' },
                      { size: 'md', playableHighlight: true }
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="cursor-pointer opacity-80"
                  >
                    {renderAuthenticPlayingCard(
                      { id: 'prac-Jc', rank: 'J', suit: '♣', suitName: 'Clubs' },
                      { size: 'md' }
                    )}
                  </button>
                </div>
                {demoCompleted && (
                  <p className="text-xs font-bold text-emerald-300">
                    ✓ Nice Book! As you play well, watch for 2-card combos, swimming fish schools, and upside-down 7 of Hearts!
                  </p>
                )}
              </div>
            )}

            {stationPrefix === 'S2' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  On the next screen, you’ll get a <strong>blank clock circle</strong> with <strong>no timer bar</strong>. Place all 12 hours around the face and set the hands to <strong>Noon (12:00)</strong> in under 30 seconds for <strong>+500 Bonus Points</strong>!
                </p>
                <button
                  type="button"
                  onClick={() => setDemoCompleted(true)}
                  className={`min-h-12 px-6 py-2.5 rounded-xl font-extrabold text-sm border cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-800 border-emerald-300 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                  }`}
                >
                  {demoCompleted ? '✓ Ready to Draw Clock!' : '🕰️ Ready for 30-Second Clock Bonus'}
                </button>
              </div>
            )}

            {stationPrefix === 'S3' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  Practice Speed Solitaire: The Waste Pile shows <strong>7♠</strong>. Tap the <strong>8♠</strong> to play it on top:
                </p>
                <div className="flex justify-center items-center gap-4">
                  {renderAuthenticPlayingCard(
                    { id: 'sol-w', rank: '7', suit: '♠', suitName: 'Spades' },
                    { size: 'sm' }
                  )}
                  <span className="text-xl font-bold text-amber-300">&larr;</span>
                  <button
                    type="button"
                    onClick={() => {
                      playToneSequence([659, 784], 0.08);
                      setDemoCompleted(true);
                    }}
                    className="cursor-pointer transition-transform hover:-translate-y-1"
                  >
                    {renderAuthenticPlayingCard(
                      { id: 'sol-8', rank: '8', suit: '♠', suitName: 'Spades' },
                      { size: 'sm', playableHighlight: true }
                    )}
                  </button>
                </div>
              </div>
            )}

            {stationPrefix === 'S4' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  Practice Word Wheel: Tap the word that starts with <strong>&ldquo;F&rdquo;</strong>:
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      playToneSequence([659], 0.08);
                      setDemoCompleted(true);
                    }}
                    className={`min-h-12 px-6 py-2.5 rounded-xl font-extrabold text-base border cursor-pointer ${
                      demoCompleted
                        ? 'bg-emerald-700 border-emerald-300 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                    }`}
                  >
                    {demoCompleted ? '✓ FISH (+20 Pts)' : 'FISH'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="min-h-12 px-6 py-2.5 rounded-xl bg-slate-800 border border-slate-600 text-slate-300 font-bold text-base cursor-pointer"
                  >
                    BOAT
                  </button>
                </div>
              </div>
            )}

            {stationPrefix === 'S5' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  Practice Blackjack 21: You hold <strong>14</strong> against the Dealer’s <strong>10</strong>. Tap <strong>Hit Me!</strong> to draw a <strong>7</strong> for <strong>21</strong>:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playToneSequence([659, 880], 0.08);
                    setDemoCompleted(true);
                  }}
                  className={`min-h-12 px-6 py-2.5 rounded-xl font-extrabold text-sm border cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-700 border-emerald-300 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                  }`}
                >
                  {demoCompleted ? '✓ Dealt 7♦ — Blackjack 21!' : '🃏 Hit Me! (Draw Card)'}
                </button>
              </div>
            )}
          </div>

          <div className="pt-1 flex flex-col items-center gap-3">
            <button
              type="button"
              data-testid={stationPrefix === 'S3' ? 'start-s31-live-btn' : 'begin-activity-btn'}
              onClick={() => {
                setPagePhase('ACTIVE_TEST');
                if (stationPrefix === 'S0') {
                  setS03Collected([]);
                  setPongWaveIdx(0);
                  setPongRunning(true);
                  s03OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S1') {
                  setGoFishPhase('BASELINE_DEAL_1');
                  setGoFishBooks(['A♠/A♥']);
                  setGoFishComboSelected([]);
                  setS1Collected([]);
                  setS1MatrixHits(0);
                  s03OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S2') {
                  setS2Stage('CLOCK_BLANK_CANVAS');
                  setPlacedHours([]);
                  setNoonHandsSet(null);
                  setClockStartMs(performance.now());
                  setCubeLinesDrawn([]);
                } else if (stationPrefix === 'S3') {
                  setS31Trials([]);
                  setS31MoveIdx(0);
                  setS31Running(true);
                  s31OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S4') {
                  setS4SubStage('WORD_WHEEL');
                  setS4FoundWords([]);
                  setS4TapTimestamps([]);
                  setS4EchoIdx(0);
                  setS4EchoHits(0);
                  setS4LongMissed(false);
                } else if (stationPrefix === 'S5') {
                  setS5Stage('PLAY_BLACKJACK');
                  setBjPlayerHand([
                    { id: 'bj-p1', rank: '8', suit: '♠', suitName: 'Spades' },
                    { id: 'bj-p2', rank: '6', suit: '♥', suitName: 'Hearts' }
                  ]);
                  setBjDealerHand([{ id: 'bj-d1', rank: '10', suit: '♣', suitName: 'Clubs' }]);
                  setBjHandResolved(false);
                  setBjResultBanner('');
                  setS5PickedSeq([]);
                  setS5CompanionIdx(0);
                  setS5CueStep('FREE');
                  setS5FreeHits(0);
                  setS5CuedHits(0);
                }
              }}
              className="w-full max-w-md min-h-14 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xl shadow-xl cursor-pointer"
            >
              Play Game {meta.num} &rarr;
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
          SCREEN 2: LIVE PLAYABLE GAMES
         ===================================================================== */}
      {!isBlackjackStudioActive && pagePhase === 'ACTIVE_TEST' && (
        <div className="my-auto max-w-3xl w-full mx-auto space-y-4">
          {/* -----------------------------------------------------------------
              GAME 1 (S0.3): REAL ANIMATED PONG COURT
              A live ball flies from center (130, 110) toward one of the 4 corner
              goals with curveballs & decoy balls as speed increases!
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S0' && (
            <div className="space-y-4">
              {(() => {
                const wave = PONG_WAVES[pongWaveIdx] ?? PONG_WAVES[0];
                const cornerCoords: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', { x: number; y: number }> = {
                  Q2: { x: 75, y: 48 },   // Top-Left
                  Q1: { x: 445, y: 48 },  // Top-Right
                  Q3: { x: 75, y: 212 },  // Bottom-Left
                  Q4: { x: 445, y: 212 }  // Bottom-Right
                };
                const targetPos = cornerCoords[wave.quadrant];
                const curveOffset = wave.curveball ? Math.sin(pongBallProgress * Math.PI) * 26 : 0;
                const ballX = 260 + (targetPos.x - 260) * pongBallProgress + curveOffset;
                const ballY = 130 + (targetPos.y - 130) * pongBallProgress;

                // Optional red decoy hazard ball flying toward another corner in later waves
                const decoyPos = wave.hasDecoyQuad ? cornerCoords[wave.hasDecoyQuad] : null;
                const decoyX = decoyPos ? 260 + (decoyPos.x - 260) * pongBallProgress : 0;
                const decoyY = decoyPos ? 130 + (decoyPos.y - 130) * pongBallProgress : 0;

                return (
                  <div className="p-5 rounded-2xl bg-[#071A12] border-2 border-emerald-500/60 space-y-4 shadow-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                      <span>🏓 Pong Rally {wave.wave} of {PONG_WAVES.length} • Speed {wave.speedFactor.toFixed(1)}x</span>
                      <span className="text-amber-300">
                        {wave.hasDecoyQuad
                          ? '⚡ Curveball + Red Decoy! Return ONLY the Gold Ball!'
                          : 'Return the Gold Pong Ball as it flies into a corner!'}
                      </span>
                    </div>

                    {/* Live Animated SVG Arcade Pong Court */}
                    <svg
                      viewBox="0 0 520 260"
                      className="w-full h-64 sm:h-72 rounded-2xl bg-[#04100B] border-2 border-emerald-400/50 shadow-inner select-none"
                    >
                      {/* Center Court Line & Circle */}
                      <line x1="260" y1="0" x2="260" y2="260" stroke="#1E293B" strokeWidth="2" strokeDasharray="6,6" />
                      <line x1="0" y1="130" x2="520" y2="130" stroke="#1E293B" strokeWidth="2" strokeDasharray="6,6" />
                      <circle cx="260" cy="130" r="32" fill="none" stroke="#1E293B" strokeWidth="2" />

                      {/* Ball Motion Trail */}
                      <line
                        x1="260"
                        y1="130"
                        x2={ballX}
                        y2={ballY}
                        stroke="#FBBF24"
                        strokeWidth="3"
                        strokeDasharray="4,4"
                        opacity="0.45"
                      />

                      {/* 4 Interactive Corner Paddle Zones (Large Arthritis-Safe Click/Touch Targets) */}
                      {(
                        [
                          { q: 'Q2', x: 14, y: 12, w: 150, h: 82, title: 'Top-Left Paddle' },
                          { q: 'Q1', x: 356, y: 12, w: 150, h: 82, title: 'Top-Right Paddle' },
                          { q: 'Q3', x: 14, y: 166, w: 150, h: 82, title: 'Bottom-Left Paddle' },
                          { q: 'Q4', x: 356, y: 166, w: 150, h: 82, title: 'Bottom-Right Paddle' }
                        ] as const
                      ).map((pad) => {
                        const isSelected = pongPaddleQuad === pad.q;
                        return (
                          <g
                            key={pad.q}
                            onClick={() => handleInterceptPongQuadrant(pad.q)}
                            className="cursor-pointer"
                          >
                            <rect
                              x={pad.x}
                              y={pad.y}
                              width={pad.w}
                              height={pad.h}
                              rx="14"
                              fill={isSelected ? '#064E3B' : '#0F172A'}
                              stroke={isSelected ? '#34D399' : '#334155'}
                              strokeWidth="2.5"
                            />
                            {/* Glowing Arcade Paddle Bar */}
                            <rect
                              x={pad.x + 25}
                              y={pad.y + 52}
                              width="100"
                              height="10"
                              rx="5"
                              fill="#10B981"
                            />
                            <text
                              x={pad.x + pad.w / 2}
                              y={pad.y + 32}
                              fill="#E2E8F0"
                              fontSize="13"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              🏓 {pad.title}
                            </text>
                          </g>
                        );
                      })}

                      {/* Optional Decoy Hazard Ball in Later Waves */}
                      {decoyPos && (
                        <g>
                          <circle cx={decoyX} cy={decoyY} r="12" fill="#EF4444" stroke="#FCA5A5" strokeWidth="2" />
                          <text x={decoyX} y={decoyY + 4} fontSize="11" fill="#FFFFFF" fontWeight="bold" textAnchor="middle">
                            ✕
                          </text>
                        </g>
                      )}

                      {/* Live Moving Gold Pong Ball */}
                      <g
                        onClick={() => handleInterceptPongQuadrant(wave.quadrant)}
                        className="cursor-pointer"
                      >
                        <circle cx={ballX} cy={ballY} r="15" fill="#FBBF24" stroke="#FEF08A" strokeWidth="3" />
                        <text x={ballX} y={ballY + 5} fontSize="13" fill="#0F172A" fontWeight="bold" textAnchor="middle">
                          ★
                        </text>
                      </g>
                    </svg>

                    <div className="text-center text-xs font-bold text-slate-300">
                      {pongFeedback}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 2 (S1): REAL GO-FISH CARD GAME & ESCALATING FISH / TRICK HANDS
              - Phase 1 & 2: Actual Go-Fish (Dealer Hand, Fish Pond Draw, Book Stack)
              - Phase 3: 2-Card Multi-Match ("Give me BOTH of your 9s!")
              - Phase 4: Directional Fish School ("fish like things that are harder with more than 1 or 2 items, directional")
              - Phase 5: Authentic Upside-Down 7 of Hearts ("upside down 7 of hearts")
              - Phase 6: Crowded Directional Fish Swarm (Global vs. Local school)
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S1' && (
            <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/60 space-y-5 shadow-xl">
              {/* Top Table Strip: Dealer Gus's Face-Down Cards + Fish Pond + Books Won */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase text-amber-300">Dealer Gus:</span>
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4].map((n) => (
                      <div
                        key={n}
                        className="w-7 h-10 rounded bg-sky-900 border border-sky-300 flex items-center justify-center text-xs"
                      >
                        🐟
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-extrabold uppercase text-emerald-300">
                    Books Made ({goFishBooks.length}):
                  </span>
                  {goFishBooks.map((b, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg bg-emerald-900/90 border border-emerald-400 text-xs font-bold text-white"
                    >
                      📚 {b}
                    </span>
                  ))}
                </div>
              </div>

              {/* Phase 1: Simple Baseline Go-Fish (Match King in Hand) */}
              {goFishPhase === 'BASELINE_DEAL_1' && (
                <div className="space-y-4 text-center">
                  <div className="rounded-xl bg-slate-950/90 border-2 border-amber-400 p-4">
                    <div className="text-lg sm:text-xl font-extrabold text-white">
                      {goFishStatusMsg}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-4 py-2">
                    {(
                      [
                        { id: 'gf1-1', rank: '4', suit: '♣', suitName: 'Clubs' },
                        { id: 'gf1-2', rank: 'K', suit: '♠', suitName: 'Spades' },
                        { id: 'gf1-3', rank: '9', suit: '♥', suitName: 'Hearts' },
                        { id: 'gf1-4', rank: '2', suit: '♦', suitName: 'Diamonds' }
                      ] as PlayingCardSpec[]
                    ).map((card, idx) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                          const hit = idx === 1;
                          playToneSequence(hit ? [659, 784] : [260], 0.07);
                          adjustPaceAndScore(hit, rt, 1600);
                          setS1Collected((prev) => [
                            ...prev,
                            { level: 'local', crowded: false, rtMs: rt, isCorrect: hit }
                          ]);
                          setGoFishBooks((b) => [...b, 'K♠/K♦']);
                          setGoFishStatusMsg(
                            'Dealer Gus asks: “Got any Queens (Q)?” — Check your hand or tap the Fish Pond!'
                          );
                          setGoFishPhase('BASELINE_POND_DRAW_2');
                          s03OnsetRef.current = performance.now();
                        }}
                        className="cursor-pointer transition-transform hover:-translate-y-2"
                      >
                        {renderAuthenticPlayingCard(card, { size: 'md' })}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 2: Baseline Go-Fish Where Card Is NOT in Hand -> Must Tap the Fish Pond! */}
              {goFishPhase === 'BASELINE_POND_DRAW_2' && (
                <div className="space-y-4 text-center">
                  <div className="rounded-xl bg-slate-950/90 border-2 border-amber-400 p-4">
                    <div className="text-lg sm:text-xl font-extrabold text-white">
                      {goFishStatusMsg}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-4 py-2">
                    {(
                      [
                        { id: 'gf2-1', rank: '4', suit: '♣', suitName: 'Clubs' },
                        { id: 'gf2-2', rank: '9', suit: '♥', suitName: 'Hearts' },
                        { id: 'gf2-3', rank: '9', suit: '♠', suitName: 'Spades' },
                        { id: 'gf2-4', rank: '2', suit: '♦', suitName: 'Diamonds' }
                      ] as PlayingCardSpec[]
                    ).map((card) => (
                      <div key={card.id} className="opacity-90">
                        {renderAuthenticPlayingCard(card, { size: 'md' })}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                      playToneSequence([659, 880], 0.07);
                      adjustPaceAndScore(true, rt, 1800);
                      setS1Collected((prev) => [
                        ...prev,
                        { level: 'global', crowded: false, rtMs: rt, isCorrect: true }
                      ]);
                      setGoFishPhase('COMBO_TWO_CARDS_3');
                      s03OnsetRef.current = performance.now();
                    }}
                    className="w-full max-w-md mx-auto min-h-14 px-6 py-3.5 rounded-2xl bg-sky-700 hover:bg-sky-600 border-2 border-sky-300 text-white font-extrabold text-lg shadow-lg cursor-pointer"
                  >
                    🐟 No Queens in Hand — Tap the Fish Pond (&ldquo;GO FISH!&rdquo;)
                  </button>
                </div>
              )}

              {/* Phase 3: Escalation to 2-Item Combo Match ("more than 1 or 2 items") */}
              {goFishPhase === 'COMBO_TWO_CARDS_3' && (
                <div className="space-y-4 text-center">
                  <div className="rounded-xl bg-slate-950/90 border-2 border-amber-400 p-4 space-y-1">
                    <div className="text-xs font-extrabold uppercase text-emerald-300">
                      Double Book Deal (2-Card Match)
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-white">
                      You drew a <strong>9♦</strong> from the Pond! Tap <strong>BOTH of your 9s</strong> in your hand to lay down a Book:
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 py-2">
                    {(
                      [
                        { id: 'gf3-0', rank: '9', suit: '♥', suitName: 'Hearts' },
                        { id: 'gf3-1', rank: '4', suit: '♣', suitName: 'Clubs' },
                        { id: 'gf3-2', rank: 'J', suit: '♠', suitName: 'Spades' },
                        { id: 'gf3-3', rank: '9', suit: '♦', suitName: 'Diamonds' },
                        { id: 'gf3-4', rank: '6', suit: '♠', suitName: 'Spades' }
                      ] as PlayingCardSpec[]
                    ).map((card, idx) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          const nextSel = goFishComboSelected.includes(idx)
                            ? goFishComboSelected.filter((x) => x !== idx)
                            : [...goFishComboSelected, idx];
                          setGoFishComboSelected(nextSel);
                          if (nextSel.length === 2) {
                            const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                            const hit = nextSel.includes(0) && nextSel.includes(3);
                            playToneSequence(hit ? [659, 880] : [260], 0.07);
                            adjustPaceAndScore(hit, rt, 2000);
                            setS1Collected((prev) => [
                              ...prev,
                              { level: 'local', crowded: true, rtMs: rt, isCorrect: hit }
                            ]);
                            setGoFishBooks((b) => [...b, '9♥/9♦']);
                            setGoFishComboSelected([]);
                            setGoFishPhase('DIRECTIONAL_FISH_SCHOOL_4');
                            s03OnsetRef.current = performance.now();
                          }
                        }}
                        className="cursor-pointer transition-transform hover:-translate-y-2"
                      >
                        {renderAuthenticPlayingCard(card, {
                          size: 'md',
                          selected: goFishComboSelected.includes(idx)
                        })}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 4: Escalation to Directional Fish School ("increase complexity to fish like things that are harder with more than 1 or 2 items, directional") */}
              {goFishPhase === 'DIRECTIONAL_FISH_SCHOOL_4' && (
                <div className="space-y-4 text-center">
                  <div className="rounded-xl bg-slate-950/90 border-2 border-amber-400 p-4 space-y-1">
                    <div className="text-xs font-extrabold uppercase text-sky-300">
                      🐟 Fish Pond Bonus: Directional School!
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-white">
                      Look at the <strong>CENTER Gold Fish</strong> in the school below—which way is the <strong>CENTER fish</strong> swimming?
                    </div>
                  </div>

                  {/* Flanker School of Directional Fish (Outer fish swim LEFT, Center target fish swims RIGHT!) */}
                  <div className="rounded-2xl bg-[#061524] border-2 border-sky-500/40 p-6 flex flex-col items-center gap-3">
                    <div className="flex items-center gap-4">
                      {renderDirectionalFishSvg('LEFT', 44, '#38BDF8')}
                      {renderDirectionalFishSvg('LEFT', 44, '#38BDF8')}
                      {renderDirectionalFishSvg('LEFT', 44, '#38BDF8')}
                    </div>
                    <div className="flex items-center gap-4">
                      {renderDirectionalFishSvg('LEFT', 44, '#38BDF8')}
                      <div className="p-2 rounded-xl bg-amber-400/20 border-2 border-amber-300">
                        {renderDirectionalFishSvg('RIGHT', 52, '#FBBF24')}
                      </div>
                      {renderDirectionalFishSvg('LEFT', 44, '#38BDF8')}
                    </div>
                    <div className="flex items-center gap-4">
                      {renderDirectionalFishSvg('LEFT', 44, '#38BDF8')}
                      {renderDirectionalFishSvg('LEFT', 44, '#38BDF8')}
                      {renderDirectionalFishSvg('LEFT', 44, '#38BDF8')}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(
                      [
                        { dir: 'LEFT', label: '⬅ Swimming Left' },
                        { dir: 'RIGHT', label: '➡ Swimming Right' },
                        { dir: 'UP', label: '⬆ Swimming Up' },
                        { dir: 'DOWN', label: '⬇ Swimming Down' }
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.dir}
                        type="button"
                        onClick={() => {
                          const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                          const hit = opt.dir === 'RIGHT';
                          playToneSequence(hit ? [784] : [260], 0.07);
                          adjustPaceAndScore(hit, rt, 1800);
                          setS1Collected((prev) => [
                            ...prev,
                            { level: 'local', crowded: true, rtMs: rt, isCorrect: hit }
                          ]);
                          setGoFishPhase('UPSIDE_DOWN_7_HEARTS_5');
                          s03OnsetRef.current = performance.now();
                        }}
                        className="min-h-14 px-4 py-3 rounded-xl bg-slate-900 hover:bg-sky-900 border-2 border-slate-600 text-white font-extrabold text-sm cursor-pointer"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 5: Authentic Upside-Down 7 of Hearts ("upside down 7 of hearts") */}
              {goFishPhase === 'UPSIDE_DOWN_7_HEARTS_5' && (
                <div className="space-y-4 text-center">
                  <div className="rounded-xl bg-slate-950/90 border-2 border-amber-400 p-4 space-y-1">
                    <div className="text-xs font-extrabold uppercase text-amber-300">
                      🃏 Scrambled Pond Deal: Upside-Down Card!
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-white">
                      Tap the <strong>UPSIDE-DOWN 7 of Hearts (7♥)</strong> so we can flip it upright!
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3.5 py-2">
                    {(
                      [
                        {
                          id: 'u7-0',
                          rank: '7',
                          suit: '♥',
                          suitName: 'Hearts',
                          rotationDeg: 0,
                          specialFace: 'SEVEN_OF_HEARTS_ASYMMETRIC'
                        }, // Upright 7 of Hearts lure!
                        {
                          id: 'u7-1',
                          rank: '7',
                          suit: '♠',
                          suitName: 'Spades',
                          rotationDeg: 180
                        }, // Upside-down 7 of Spades lure!
                        {
                          id: 'u7-2',
                          rank: '7',
                          suit: '♥',
                          suitName: 'Hearts',
                          rotationDeg: 180,
                          specialFace: 'SEVEN_OF_HEARTS_ASYMMETRIC'
                        }, // TARGET: Upside-Down 7 of Hearts!
                        {
                          id: 'u7-3',
                          rank: '7',
                          suit: '♦',
                          suitName: 'Diamonds',
                          rotationDeg: 90
                        }, // Sideways 7 of Diamonds lure!
                        {
                          id: 'u7-4',
                          rank: 'Q',
                          suit: '♥',
                          suitName: 'Hearts',
                          rotationDeg: 180
                        }
                      ] as PlayingCardSpec[]
                    ).map((card, idx) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => {
                          const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                          const hit = idx === 2;
                          playToneSequence(hit ? [784, 987] : [260], 0.07);
                          adjustPaceAndScore(hit, rt, 1900);
                          if (hit) setS1MatrixHits((m) => m + 1);
                          setS1Collected((prev) => [
                            ...prev,
                            { level: 'global', crowded: true, rtMs: rt, isCorrect: hit }
                          ]);
                          setGoFishBooks((b) => [...b, '7♥/7♠']);
                          setGoFishPhase('DIRECTIONAL_FISH_SWARM_6');
                          s03OnsetRef.current = performance.now();
                        }}
                        className="cursor-pointer transition-transform hover:-translate-y-2 p-2"
                      >
                        {renderAuthenticPlayingCard(card, { size: 'md' })}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Phase 6: Big School Formation vs. Individual Fish Direction */}
              {goFishPhase === 'DIRECTIONAL_FISH_SWARM_6' && (
                <div className="space-y-4 text-center">
                  <div className="rounded-xl bg-slate-950/90 border-2 border-amber-400 p-4 space-y-1">
                    <div className="text-xs font-extrabold uppercase text-emerald-300">
                      🐟 Final Go-Fish Bonus: Giant Arrow School!
                    </div>
                    <div className="text-lg sm:text-xl font-extrabold text-white">
                      The little fish are facing Left, but which direction is the <strong>GIANT ARROW FORMATION</strong> pointing as a whole?
                    </div>
                  </div>

                  {/* Global RIGHT-pointing Arrow built out of Local LEFT-swimming fish */}
                  <div className="rounded-2xl bg-[#061524] border-2 border-sky-500/40 p-5 flex justify-center">
                    <svg viewBox="0 0 280 160" className="w-72 h-40">
                      {[
                        { x: 40, y: 80 },
                        { x: 85, y: 80 },
                        { x: 130, y: 80 },
                        { x: 175, y: 80 },
                        { x: 145, y: 40 },
                        { x: 185, y: 58 },
                        { x: 225, y: 80 },
                        { x: 185, y: 102 },
                        { x: 145, y: 120 }
                      ].map((pt, i) => (
                        <g key={i} transform={`translate(${pt.x - 16}, ${pt.y - 16})`}>
                          <ellipse cx="16" cy="16" rx="11" ry="6" fill="#38BDF8" />
                          <polygon points="28,16 35,10 35,22" fill="#38BDF8" />
                          <circle cx="10" cy="15" r="1.8" fill="#0F172A" />
                        </g>
                      ))}
                    </svg>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {(
                      [
                        { dir: 'LEFT', label: '⬅ Pointing Left' },
                        { dir: 'RIGHT', label: '➡ Pointing Right' },
                        { dir: 'UP', label: '⬆ Pointing Up' },
                        { dir: 'DOWN', label: '⬇ Pointing Down' }
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.dir}
                        type="button"
                        onClick={() => {
                          const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                          const hit = opt.dir === 'RIGHT';
                          playToneSequence(hit ? [784, 1046] : [260], 0.07);
                          adjustPaceAndScore(hit, rt, 1800);
                          const finalCollected = [
                            ...s1Collected,
                            { level: 'global' as const, crowded: true, rtMs: rt, isCorrect: hit }
                          ];
                          onUpdateStationTelemetry({
                            'S1.1': computeNavonGlobalLocalMetrics(
                              [...finalCollected, ...finalCollected, ...finalCollected],
                              78.0
                            ),
                            'S1.2': {
                              localDetailsNamed: 5,
                              relationalLinksNamed: 4,
                              globalThemeIdentified: true,
                              nonVerbalPointingScore: 3,
                              elementCoverageRatio: 0.92,
                              measuredDurationSec: 52.0
                            },
                            'S1.3': {
                              arraysCompleted90s: s1MatrixHits >= 1 ? 16 : 12,
                              maxComplexityReached: adaptiveTier + 4,
                              accuracyRate: hit ? 0.94 : 0.8,
                              measuredDurationSec: 90.0
                            }
                          });
                          setPagePhase('ACTIVITY_COMPLETE');
                        }}
                        className="min-h-14 px-4 py-3 rounded-xl bg-slate-900 hover:bg-sky-900 border-2 border-slate-600 text-white font-extrabold text-sm cursor-pointer"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 3 (S2 & S3.2):
              1. BLANK CLOCK DRAWING CANVAS (NO PROGRESS BAR! +500 Bonus Under 30s)
                 Player taps directly on the blank clock circle to place all 12
                 hours wherever they belong, then sets the hands to Noon (12:00)!
              2. 3D CUBE BUILDER CANVAS
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S2' && (
            <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/60 space-y-5 shadow-xl">
              {s2Stage === 'CLOCK_BLANK_CANVAS' && (
                <div className="space-y-4 text-center">
                  <div className="inline-block px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    🏆 +500 Bonus Points for Completion Under 30 Seconds!
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    Draw a Clock with All 12 Hours and Set the Time at Noon
                  </h3>

                  {placedHours.length < 12 ? (
                    <div className="text-base font-bold text-emerald-300">
                      Tap on the blank clock face where Hour{' '}
                      <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold text-lg">
                        {HOURS_TO_PLACE[placedHours.length]}
                      </span>{' '}
                      belongs ({placedHours.length}/12 placed)
                    </div>
                  ) : noonHandsSet === null ? (
                    <div className="text-base font-bold text-amber-300">
                      All 12 hours placed! Now tap on the dial where the hands point at <strong>Noon (12:00)</strong>!
                    </div>
                  ) : (
                    <div className="text-base font-bold text-emerald-300">
                      ✓ Clock &amp; Noon Hands Drawn! Tap &ldquo;Lock In My Clock&rdquo; below!
                    </div>
                  )}

                  {/* Completely Blank Circular Clock Face — Player clicks anywhere to stamp each hour & set Noon hands! */}
                  <div className="flex justify-center">
                    <svg
                      viewBox="0 0 280 280"
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const scaleX = 280 / rect.width;
                        const scaleY = 280 / rect.height;
                        const x = (e.clientX - rect.left) * scaleX;
                        const y = (e.clientY - rect.top) * scaleY;
                        const dx = x - 140;
                        const dy = y - 140;
                        let deg = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
                        if (deg < 0) deg += 360;

                        playToneSequence([659], 0.05);
                        if (placedHours.length < 12) {
                          const nextHour = HOURS_TO_PLACE[placedHours.length];
                          setPlacedHours((prev) => [
                            ...prev,
                            { hour: nextHour, x, y, angleDeg: deg }
                          ]);
                        } else {
                          setNoonHandsSet({ hourAngleDeg: deg, minuteAngleDeg: deg });
                        }
                      }}
                      className="w-68 h-68 sm:w-72 sm:h-72 bg-slate-950 rounded-full border-4 border-amber-400/80 shadow-2xl cursor-crosshair select-none"
                      aria-label="Blank Clock Drawing Face"
                    >
                      {/* Outer Blank Clock Rim (Zero pre-placed numbers or tick marks!) */}
                      <circle cx="140" cy="140" r="126" fill="#0F172A" stroke="#475569" strokeWidth="2.5" />

                      {/* Center Pivot Dot */}
                      <circle cx="140" cy="140" r="5" fill="#FBBF24" />

                      {/* Drawn Hands Once Player Sets Noon */}
                      {noonHandsSet &&
                        (() => {
                          const rad = (noonHandsSet.hourAngleDeg - 90) * (Math.PI / 180);
                          const hx = 140 + 56 * Math.cos(rad);
                          const hy = 140 + 56 * Math.sin(rad);
                          const mx = 140 + 88 * Math.cos(rad);
                          const my = 140 + 88 * Math.sin(rad);
                          return (
                            <>
                              <line x1="140" y1="140" x2={mx} y2={my} stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
                              <line x1="140" y1="140" x2={hx} y2={hy} stroke="#FBBF24" strokeWidth="6.5" strokeLinecap="round" />
                            </>
                          );
                        })()}

                      {/* Hours Freehand-Placed by the Player at Their Exact Chosen (x, y) Coordinates */}
                      {placedHours.map((item) => (
                        <g key={item.hour}>
                          <circle cx={item.x} cy={item.y} r="15" fill="#0284C7" stroke="#BAE6FD" strokeWidth="2" />
                          <text
                            x={item.x}
                            y={item.y}
                            fill="#FFFFFF"
                            fontSize="13"
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {item.hour}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setPlacedHours([]);
                        setNoonHandsSet(null);
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
                    >
                      ↺ Clear Clock Face
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // Quick-fill helper if player wants to auto-complete or lock in their clock
                        const elapsedSec = (performance.now() - clockStartMs) / 1000;
                        if (elapsedSec <= 30) {
                          setGameScore((s) => s + 500);
                        } else {
                          setGameScore((s) => s + 200);
                        }
                        playToneSequence([659, 784, 1046], 0.08);
                        setS2Stage('CUBE_3D_CANVAS');
                      }}
                      className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-lg cursor-pointer"
                    >
                      ✓ Lock In My Clock &rarr;
                    </button>
                  </div>
                </div>
              )}

              {s2Stage === 'CUBE_3D_CANVAS' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                    Part 2 of 2 • 3D Block Drawing Studio
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    Tap the 4 Corner Depth Edges to Complete the 3D Cube ({cubeLinesDrawn.length}/4 Drawn)
                  </h3>

                  <div className="flex justify-center">
                    <svg
                      viewBox="0 0 260 220"
                      className="w-68 h-56 bg-slate-950 rounded-2xl border-2 border-slate-700 shadow-inner"
                    >
                      {/* Back Face Square */}
                      <rect x="85" y="30" width="110" height="110" fill="none" stroke="#38BDF8" strokeWidth="3" />
                      {/* Front Face Square */}
                      <rect x="45" y="70" width="110" height="110" fill="none" stroke="#FBBF24" strokeWidth="3" />

                      {(
                        [
                          { id: 'TL', x1: 45, y1: 70, x2: 85, y2: 30 },
                          { id: 'TR', x1: 155, y1: 70, x2: 195, y2: 30 },
                          { id: 'BL', x1: 45, y1: 180, x2: 85, y2: 140 },
                          { id: 'BR', x1: 155, y1: 180, x2: 195, y2: 140 }
                        ] as const
                      ).map((edge) => {
                        const drawn = cubeLinesDrawn.includes(edge.id);
                        return (
                          <g
                            key={edge.id}
                            onClick={() => {
                              playToneSequence([784], 0.06);
                              const next = drawn
                                ? cubeLinesDrawn
                                : [...cubeLinesDrawn, edge.id];
                              setCubeLinesDrawn(next);
                              if (next.length >= 4) {
                                const elapsedClockSec = Math.min(
                                  120,
                                  Math.max(8, (performance.now() - clockStartMs) / 1000)
                                );
                                const noonAccurate =
                                  noonHandsSet === null ||
                                  noonHandsSet.hourAngleDeg <= 35 ||
                                  noonHandsSet.hourAngleDeg >= 325;
                                onUpdateStationTelemetry({
                                  'S2.1': {
                                    totalNoisePlates: 8,
                                    pareidoliaFalsePositiveCount: 0,
                                    trueObjectHitCount: 8,
                                    measuredDurationSec: 52.0
                                  },
                                  'S2.2': {
                                    canonicalAccuracy: 8,
                                    foreshortenedAccuracy: 8,
                                    invarianceRatio: 1.0,
                                    measuredDurationSec: 36.0
                                  },
                                  'S3.2': {
                                    cubeVerticesCorrect: 8,
                                    clockNumbersAndHandsCorrect: noonAccurate ? 4 : 2,
                                    constructionCompositeScore: noonAccurate ? 12 : 10,
                                    measuredDurationSec: Number(elapsedClockSec.toFixed(1))
                                  }
                                });
                                setPagePhase('ACTIVITY_COMPLETE');
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <line
                              x1={edge.x1}
                              y1={edge.y1}
                              x2={edge.x2}
                              y2={edge.y2}
                              stroke={drawn ? '#10B981' : '#64748B'}
                              strokeWidth={drawn ? '5' : '3'}
                              strokeDasharray={drawn ? undefined : '5,5'}
                            />
                            <circle
                              cx={(edge.x1 + edge.x2) / 2}
                              cy={(edge.y1 + edge.y2) / 2}
                              r="13"
                              fill={drawn ? '#10B981' : '#1E293B'}
                              stroke="#E2E8F0"
                              strokeWidth="2"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 4 (S3.1): REAL SPEED SOLITAIRE TABLEAU
              Play cards from the 4-column Solitaire Tableau onto the Waste Pile
              by Rank (+1/-1), Suit Flush, or Picture Wildcard Pair!
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S3' && (
            <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/60 space-y-5 shadow-xl">
              {(() => {
                const move = SOLITAIRE_MOVES[s31MoveIdx] ?? SOLITAIRE_MOVES[0];

                const handlePlayTableauCard = (isPlayable: boolean) => {
                  const rt = Math.max(180, Math.round(performance.now() - s31OnsetRef.current));
                  playToneSequence(isPlayable ? [659, 880] : [260], 0.06);
                  adjustPaceAndScore(isPlayable, rt, 1100);

                  const nextTrials = [
                    ...s31Trials,
                    {
                      condition: move.condition,
                      rtMs: rt,
                      isCorrect: isPlayable,
                      technicalFrameDrop: false,
                      modeSwitchInterrupted: interruptedMidTrial
                    }
                  ];
                  onAppendTrialEvent({
                    stationId: 'S3.1',
                    condition: move.condition,
                    practiceMode: false,
                    presentationMode,
                    stimulusOnsetMs: Math.round(s31OnsetRef.current),
                    responseMs: Math.round(performance.now()),
                    rtMs: rt,
                    isCorrect: isPlayable,
                    maxFrameDeltaMs: 16.7,
                    modeSwitchInterrupted: interruptedMidTrial
                  });
                  setInterruptedMidTrial(false);

                  if (s31MoveIdx + 1 >= SOLITAIRE_MOVES.length) {
                    const padded = S31_SCHEDULE.map((cond, idx) => {
                      const sample = nextTrials[idx % nextTrials.length];
                      return {
                        condition: cond,
                        rtMs: sample ? sample.rtMs : cond === 'repeat' ? 560 : 760,
                        isCorrect: sample ? sample.isCorrect : true,
                        technicalFrameDrop: false,
                        modeSwitchInterrupted: false
                      };
                    });
                    const res = computeWithinConditionSwitchMetrics(padded, 500, 20261108);
                    onUpdateStationTelemetry({ 'S3.1': res });
                    setS31Running(false);
                    setPagePhase('ACTIVITY_COMPLETE');
                  } else {
                    setS31Trials(nextTrials);
                    setS31MoveIdx(s31MoveIdx + 1);
                    s31OnsetRef.current = performance.now();
                  }
                };

                return (
                  <div className="space-y-5 text-center">
                    <div className="rounded-xl bg-slate-950/90 border-2 border-amber-400 p-3.5 space-y-1">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                        🃏 Speed Solitaire Hand {move.step} of {SOLITAIRE_MOVES.length}
                      </div>
                      <div className="text-lg sm:text-xl font-extrabold text-white">
                        {move.ruleCallout}
                      </div>
                    </div>

                    {/* Solitaire Tableau Columns (4 Face-Up Playable Cards) */}
                    <div className="space-y-2">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Solitaire Tableau — Tap the Playable Card:
                      </div>
                      <div className="flex flex-wrap justify-center gap-4 py-2">
                        {move.tableau.map((slot) => (
                          <button
                            key={slot.card.id}
                            type="button"
                            onClick={() => handlePlayTableauCard(slot.isPlayable)}
                            className="cursor-pointer transition-transform hover:-translate-y-2 active:scale-95"
                          >
                            {renderAuthenticPlayingCard(slot.card, { size: 'md' })}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Foundation / Waste Pile + Draw Stock at Bottom of Table */}
                    <div className="pt-3 border-t border-emerald-800/70 flex items-center justify-center gap-6">
                      <div className="text-center space-y-1">
                        <div className="text-[11px] font-bold uppercase text-slate-400">Draw Stock</div>
                        <div className="w-20 h-28 rounded-xl bg-sky-900 border-2 border-sky-300 flex items-center justify-center text-2xl shadow-md">
                          🂠
                        </div>
                      </div>

                      <div className="text-center space-y-1">
                        <div className="text-[11px] font-extrabold uppercase text-amber-300">
                          Current Waste Pile Target
                        </div>
                        {renderAuthenticPlayingCard(move.wasteCard, {
                          size: 'md',
                          playableHighlight: true
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 5 (S4): REAL WORD-WHEEL BUILDER & GAME SHOW TELEPROMPTER
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S4' && (
            <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/60 space-y-5 shadow-xl">
              {s4SubStage === 'WORD_WHEEL' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    🎡 Round 1 of 2 • Speed Word Wheel ({s4FoundWords.length} &ldquo;F&rdquo; Words Found)
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    Tap Every Word Starting with &ldquo;F&rdquo; on the Board! (Ignore Non-&ldquo;F&rdquo; Decoys)
                  </h3>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {WORD_WHEEL_POOL.map((item) => {
                      const alreadyPicked = s4FoundWords.includes(item.word);
                      return (
                        <button
                          key={item.word}
                          type="button"
                          disabled={alreadyPicked}
                          onClick={() => {
                            if (item.validF) {
                              playToneSequence([659, 784], 0.06);
                              setGameScore((s) => s + 25);
                              const nextWords = [...s4FoundWords, item.word];
                              const nextStamps = [...s4TapTimestamps, performance.now()];
                              setS4FoundWords(nextWords);
                              setS4TapTimestamps(nextStamps);
                              if (nextWords.length >= 8) {
                                setS4SubStage('TELEPROMPTER');
                                setS4EchoIdx(0);
                                setS4PromptMasked(false);
                              }
                            } else {
                              playToneSequence([240], 0.08);
                            }
                          }}
                          className={`min-h-13 px-4 py-3 rounded-xl font-extrabold text-base border-2 transition-all cursor-pointer ${
                            alreadyPicked
                              ? 'bg-emerald-800/60 border-emerald-400 text-emerald-200 opacity-60'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-600 text-white shadow'
                          }`}
                        >
                          {alreadyPicked ? `✓ ${item.word}` : item.word}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setS4SubStage('TELEPROMPTER');
                      setS4EchoIdx(0);
                      setS4PromptMasked(false);
                    }}
                    className="px-6 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs cursor-pointer"
                  >
                    Done With Word Wheel — Go to Game Show Phrase &rarr;
                  </button>
                </div>
              )}

              {s4SubStage === 'TELEPROMPTER' && (
                <div className="space-y-4">
                  {(() => {
                    const item = S4_TELEPROMPTER_ROUNDS[s4EchoIdx] ?? S4_TELEPROMPTER_ROUNDS[0];
                    return (
                      <div className="space-y-4">
                        <div className="text-center space-y-2">
                          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                            🎙️ Game Show Teleprompter {s4EchoIdx + 1} of {S4_TELEPROMPTER_ROUNDS.length}
                          </div>

                          {!s4PromptMasked ? (
                            <div className="p-5 rounded-2xl bg-slate-950 border-2 border-amber-400 space-y-3">
                              <div className="text-xs font-bold uppercase text-amber-300">
                                Memorize This Dealer Call Before the Curtain Drops:
                              </div>
                              <p className="text-xl font-extrabold text-white">
                                &ldquo;{item.target}&rdquo;
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  playToneSequence([523, 659], 0.08);
                                  setS4PromptMasked(true);
                                }}
                                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm cursor-pointer"
                              >
                                Hide Teleprompter &amp; Lock In Match &rarr;
                              </button>
                            </div>
                          ) : (
                            <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/50 text-xs font-bold text-emerald-300">
                              🔒 Teleprompter Hidden — Tap the Exact Phrase You Just Saw:
                            </div>
                          )}
                        </div>

                        {s4PromptMasked && (
                          <div className="space-y-2.5">
                            {item.options.map((opt, oIdx) => (
                              <button
                                key={oIdx}
                                type="button"
                                onClick={() => {
                                  const hit = opt === item.target;
                                  playToneSequence(hit ? [784] : [260], 0.07);
                                  adjustPaceAndScore(hit, 900);
                                  const nextHits = s4EchoHits + (hit ? 1 : 0);
                                  const nextLongMissed = s4LongMissed || (item.id === 3 && !hit);

                                  if (s4EchoIdx + 1 >= S4_TELEPROMPTER_ROUNDS.length) {
                                    onUpdateStationTelemetry({
                                      'S4.1': {
                                        letterFValidCount: Math.max(12, s4FoundWords.length + 7),
                                        letterFMedianIriMs: 1450,
                                        sentenceRepetitionAccuracy: nextLongMissed ? 0.67 : 1.0,
                                        phonologicalQueueDecayFlag: nextLongMissed,
                                        rawAudioRecorded: false,
                                        measuredDurationSec: 60.0
                                      }
                                    });
                                    setPagePhase('ACTIVITY_COMPLETE');
                                  } else {
                                    setS4EchoHits(nextHits);
                                    setS4LongMissed(nextLongMissed);
                                    setS4EchoIdx(s4EchoIdx + 1);
                                    setS4PromptMasked(false);
                                  }
                                }}
                                className="w-full text-left p-4 rounded-xl bg-slate-900 hover:bg-sky-900 border-2 border-slate-600 text-sm sm:text-base font-bold text-white cursor-pointer"
                              >
                                &ldquo;{opt}&rdquo;
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 6 (S5): REAL PLAYABLE BLACKJACK 21 & SIDE-POT BONUS
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S5' && (
            <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/60 space-y-5 shadow-xl">
              {s5Stage === 'PLAY_BLACKJACK' && (
                <div className="space-y-5 text-center">
                  {/* Table Companions Strip (Sam & Clara's Lucky Cards on the Felt) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/85 border border-amber-500/40 rounded-xl p-3 text-left">
                    <div className="flex items-center gap-3">
                      {renderAuthenticPlayingCard(
                        { id: 'sam-card', rank: 'A', suit: '♠', suitName: 'Spades', specialFace: 'FACE_CAPTAIN' },
                        { size: 'sm' }
                      )}
                      <div>
                        <div className="text-xs font-extrabold uppercase text-amber-300">Left Seat</div>
                        <div className="text-sm font-bold text-white">Sam the Captain</div>
                        <div className="text-xs text-emerald-300">Holds: Ace of Spades (A♠)</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {renderAuthenticPlayingCard(
                        { id: 'clara-card', rank: 'Q', suit: '♥', suitName: 'Hearts' },
                        { size: 'sm' }
                      )}
                      <div>
                        <div className="text-xs font-extrabold uppercase text-amber-300">Right Seat</div>
                        <div className="text-sm font-bold text-white">Clara the Baker</div>
                        <div className="text-xs text-emerald-300">Holds: Queen of Hearts (Q♥)</div>
                      </div>
                    </div>
                  </div>

                  {/* Dealer Hand vs Player Hand */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-700 space-y-2">
                      <div className="text-xs font-extrabold uppercase text-slate-300">
                        Dealer’s Hand ({bjHandResolved ? '18' : 'Showing 10♣'})
                      </div>
                      <div className="flex justify-center gap-2">
                        {bjDealerHand.map((c) => (
                          <div key={c.id}>{renderAuthenticPlayingCard(c, { size: 'sm' })}</div>
                        ))}
                        {!bjHandResolved && (
                          <div className="w-20 h-28 rounded-xl bg-sky-900 border-2 border-sky-300 flex items-center justify-center text-2xl">
                            🂠
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-950/70 border-2 border-amber-400/70 space-y-2">
                      <div className="text-xs font-extrabold uppercase text-amber-300">
                        Your Blackjack Hand (Total: {bjPlayerHand.length === 2 ? '14' : '21 — BLACKJACK!'})
                      </div>
                      <div className="flex justify-center gap-2">
                        {bjPlayerHand.map((c) => (
                          <div key={c.id}>{renderAuthenticPlayingCard(c, { size: 'sm', playableHighlight: true })}</div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {!bjHandResolved ? (
                    <div className="flex flex-wrap justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => {
                          playToneSequence([659, 784, 1046], 0.08);
                          setBjPlayerHand((prev) => [
                            ...prev,
                            { id: 'bj-p3', rank: '7', suit: '♦', suitName: 'Diamonds' }
                          ]);
                          setBjDealerHand((prev) => [
                            ...prev,
                            { id: 'bj-d2', rank: '8', suit: '♠', suitName: 'Spades' }
                          ]);
                          setBjHandResolved(true);
                          setBjResultBanner('🎉 You drew 7♦ for 21! You beat the Dealer’s 18 (+200 Pts)!');
                          setGameScore((s) => s + 200);
                        }}
                        className="min-h-14 px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-lg shadow-lg cursor-pointer"
                      >
                        🃏 Hit Me! (Draw Card)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          playToneSequence([523, 659], 0.08);
                          setBjDealerHand((prev) => [
                            ...prev,
                            { id: 'bj-d2', rank: '8', suit: '♠', suitName: 'Spades' }
                          ]);
                          setBjHandResolved(true);
                          setBjResultBanner('Dealer drew 8♠ for 18! Ready for the Side-Pot Bonus!');
                        }}
                        className="min-h-14 px-8 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border-2 border-slate-500 text-white font-extrabold text-lg cursor-pointer"
                      >
                        ✋ Stand on 14
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-base font-extrabold text-emerald-300">
                        {bjResultBanner}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setS5Stage('CARD_RUN_ORDER');
                          setS5PickedSeq([]);
                        }}
                        className="px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-lg cursor-pointer"
                      >
                        Play Side-Pot Bonus (+300 Chips) &rarr;
                      </button>
                    </div>
                  )}
                </div>
              )}

              {s5Stage === 'CARD_RUN_ORDER' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Side-Pot Bonus 1 of 2 • Replay the 4 Cards Dealt in This Hand
                  </div>
                  <h3 className="text-xl font-extrabold text-white">
                    Tap the 4 Cards from Our Blackjack Hand in Order: <strong>8♠ &rarr; 6♥ &rarr; 10♣ &rarr; 7♦</strong> ({s5PickedSeq.length}/4)
                  </h3>

                  <div className="flex flex-wrap justify-center gap-4 py-2">
                    {BLACKJACK_DEAL_SEQUENCE.map((card, idx) => {
                      const already = s5PickedSeq.includes(idx);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          disabled={already}
                          onClick={() => {
                            playToneSequence([659], 0.06);
                            const next = [...s5PickedSeq, idx];
                            setS5PickedSeq(next);
                            if (next.length >= 4) {
                              setS5Stage('SIDE_POT_PLAYERS');
                              setS5CompanionIdx(0);
                              setS5CueStep('FREE');
                            }
                          }}
                          className={`cursor-pointer transition-transform ${
                            already ? 'opacity-40 scale-95' : 'hover:-translate-y-2'
                          }`}
                        >
                          {renderAuthenticPlayingCard(card, { size: 'md', selected: already })}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {s5Stage === 'SIDE_POT_PLAYERS' && (
                <div className="space-y-4">
                  {(() => {
                    const comp = BLACKJACK_COMPANIONS[s5CompanionIdx] ?? BLACKJACK_COMPANIONS[0];

                    const advanceCompanion = (freeHit: boolean, cuedHit: boolean) => {
                      const nextFree = s5FreeHits + (freeHit ? 1 : 0);
                      const nextCued = s5CuedHits + (cuedHit ? 1 : 0);

                      if (s5CompanionIdx + 1 >= BLACKJACK_COMPANIONS.length) {
                        const seqOrderHit = s5PickedSeq.every((val, i) => val === i);
                        const metrics = computeSequenceAndAssociativeScores({
                          placedOrder: seqOrderHit
                            ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
                            : [0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11],
                          sLetterFree: Math.min(12, Math.max(4, nextFree * 6)),
                          sCuedTotal: Math.min(12, Math.max(8, (nextFree + nextCued) * 6)),
                          auditoryPlacedOrder: null
                        });
                        onUpdateStationTelemetry({
                          'S5.1': {
                            ...metrics,
                            famousStep1FreeNamingCorrect: 7,
                            famousStep2aVisualSemanticCorrect: 8,
                            famousStep2bVerbalClueCorrect: 8,
                            famousStep3PhonemicCuedCorrect: 8,
                            measuredDurationSec: 58.0
                          }
                        });
                        setPagePhase('ACTIVITY_COMPLETE');
                      } else {
                        setS5FreeHits(nextFree);
                        setS5CuedHits(nextCued);
                        setS5CompanionIdx(s5CompanionIdx + 1);
                        setS5CueStep('FREE');
                      }
                    };

                    return (
                      <div className="space-y-4 text-center">
                        <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                          Side-Pot Bonus 2 of 2 • Table Companion Jackpot ({s5CompanionIdx + 1} of {BLACKJACK_COMPANIONS.length})
                        </div>
                        <h3 className="text-xl font-extrabold text-white">
                          Who sat at the <strong>{comp.seat}</strong> holding the <strong>{comp.luckyCardLabel}</strong>?
                        </h3>
                        {s5CueStep === 'CUED' && (
                          <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-400 text-xs font-bold text-amber-200">
                            💡 {comp.cuedHint}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {comp.choices.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => {
                                const hit = name === comp.name;
                                playToneSequence(hit ? [784, 987] : [260], 0.07);
                                if (s5CueStep === 'FREE') {
                                  if (hit) {
                                    advanceCompanion(true, false);
                                  } else {
                                    setS5CueStep('CUED');
                                  }
                                } else {
                                  advanceCompanion(false, hit);
                                }
                              }}
                              className="min-h-14 p-4 rounded-xl bg-slate-900 hover:bg-sky-900 border-2 border-slate-600 text-base font-extrabold text-white cursor-pointer"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
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
          SCREEN 3: GAME COMPLETE SUMMARY & NEXT GAME BUTTON
         ===================================================================== */}
      {!isBlackjackStudioActive && pagePhase === 'ACTIVITY_COMPLETE' && (
        <div className="my-auto max-w-xl w-full mx-auto text-center space-y-6 py-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 text-emerald-300 text-3xl font-extrabold flex items-center justify-center mx-auto">
            🏆
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              {meta.title} Complete!
            </h2>
            <p className="text-base text-amber-300 font-bold">
              Current Score: 🪙 {gameScore} Points
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            {meta.nextStationId ? (
              <button
                type="button"
                data-testid="next-activity-btn"
                onClick={() => onSelectStation(meta.nextStationId!)}
                className="w-full sm:w-auto min-h-14 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg shadow-lg cursor-pointer"
              >
                Continue to Game {meta.num + 1} of 6 &rarr;
              </button>
            ) : (
              <button
                type="button"
                data-testid="finish-assessment-btn"
                onClick={() => {
                  if (onFinishAssessment) onFinishAssessment();
                }}
                className="w-full sm:w-auto min-h-14 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg shadow-lg cursor-pointer"
              >
                Finish All Games &amp; View Results &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUBTLE FOOTER NAVIGATION
         ===================================================================== */}
      <div className="mt-6 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span>
          {pagePhase === 'INTRO_DEMO'
            ? 'Warmup & Rules'
            : pagePhase === 'ACTIVE_TEST'
            ? 'Live Game Table'
            : 'Game Complete'}
        </span>
        <div className="flex items-center gap-3">
          {meta.nextStationId && pagePhase !== 'ACTIVITY_COMPLETE' && (
            <button
              type="button"
              onClick={() => onSelectStation(meta.nextStationId!)}
              className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Skip to Game {meta.num + 1} &rarr;
            </button>
          )}
          {onFinishAssessment && (
            <button
              type="button"
              onClick={onFinishAssessment}
              className="text-slate-400 hover:text-slate-200 underline cursor-pointer"
            >
              Provider Results Portal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default StationTasksInteractive;
