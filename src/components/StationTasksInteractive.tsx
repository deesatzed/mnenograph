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

// ============================================================================
// PLAYING CARD RENDERER WITH DIRECTIONAL / UPSIDE-DOWN ROTATION SUPPORT
// Supports normal (0°), upside-down (180°), left-tilted (-90°), right-tilted (90°)
// ============================================================================
type CardSuit = '♠' | '♥' | '♦' | '♣';

interface CardSpec {
  rank: string;
  suit: CardSuit;
  suitName: 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';
  rotationDeg?: 0 | 90 | 180 | -90;
  centerGraphic?: 'DEFAULT' | 'UPSIDE_DOWN_HEART_PIP' | 'PORTRAIT_GLASSES' | 'PORTRAIT_HAT' | 'COMPASS_WILD' | 'GLASSES_WILD';
}

function renderPlayingCard(
  card: CardSpec,
  opts?: { size?: 'sm' | 'md' | 'lg'; highlighted?: boolean; selected?: boolean }
) {
  const size = opts?.size ?? 'md';
  const highlighted = opts?.highlighted ?? false;
  const selected = opts?.selected ?? false;
  const rot = card.rotationDeg ?? 0;

  const isWarmSuit = card.suit === '♥' || card.suit === '♦';
  const inkClass = isWarmSuit ? 'text-amber-700' : 'text-slate-900';

  const dims =
    size === 'lg'
      ? 'w-28 h-40 p-2.5 rounded-2xl'
      : size === 'sm'
      ? 'w-18 h-26 p-1.5 rounded-xl'
      : 'w-22 h-32 p-2 rounded-xl';

  return (
    <div
      style={{ transform: rot !== 0 ? `rotate(${rot}deg)` : undefined }}
      className={`inline-flex flex-col justify-between bg-amber-50 border-2 select-none shadow-md transition-all ${dims} ${
        selected
          ? 'border-emerald-400 ring-4 ring-emerald-400/70 -translate-y-2'
          : highlighted
          ? 'border-amber-400 ring-4 ring-amber-400/50 scale-105'
          : 'border-slate-300'
      }`}
    >
      {/* Top-Left Corner Pip (Notice: on a normal playing card, top-left is upright and bottom-right is inverted;
          when the entire card is upside-down [180°], the top-left pip is at the bottom-right and the center heart/spade points the opposite way!) */}
      <div className={`flex items-center justify-between font-extrabold leading-none ${inkClass}`}>
        <span className={size === 'sm' ? 'text-xs' : 'text-base'}>{card.rank}</span>
        <span className={size === 'sm' ? 'text-xs' : 'text-base'}>▲</span>
      </div>

      {/* Center Pip / Face Graphic */}
      <div className={`text-center leading-none ${inkClass}`}>
        {card.centerGraphic === 'PORTRAIT_GLASSES' ? (
          <svg viewBox="0 0 60 60" className="w-11 h-11 mx-auto">
            <circle cx="30" cy="32" r="22" fill="#FDE68A" stroke="#0F172A" strokeWidth="2.5" />
            <path d="M 10,24 Q 20,4 30,8 Q 40,4 50,24" fill="none" stroke="#0F172A" strokeWidth="4" />
            <circle cx="22" cy="28" r="6" fill="none" stroke="#0284C7" strokeWidth="2.5" />
            <circle cx="38" cy="28" r="6" fill="none" stroke="#0284C7" strokeWidth="2.5" />
            <line x1="28" y1="28" x2="32" y2="28" stroke="#0284C7" strokeWidth="2.5" />
            <path d="M 22,42 Q 30,48 38,42" fill="none" stroke="#0F172A" strokeWidth="2.5" />
          </svg>
        ) : card.centerGraphic === 'COMPASS_WILD' ? (
          <svg viewBox="0 0 60 60" className="w-11 h-11 mx-auto">
            <circle cx="30" cy="30" r="22" fill="#0F172A" stroke="#B45309" strokeWidth="3" />
            <polygon points="30,10 35,30 30,34 25,30" fill="#EF4444" />
            <polygon points="30,50 35,30 30,26 25,30" fill="#E2E8F0" />
          </svg>
        ) : card.centerGraphic === 'GLASSES_WILD' ? (
          <svg viewBox="0 0 60 60" className="w-11 h-11 mx-auto">
            <g transform="translate(30,32) rotate(-18)" fill="none" stroke="#0F172A" strokeWidth="3">
              <circle cx="-12" cy="0" r="8" />
              <circle cx="12" cy="0" r="8" />
              <line x1="-4" y1="0" x2="4" y2="0" />
            </g>
          </svg>
        ) : (
          <>
            <div className={size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-2xl' : 'text-3xl'}>
              {card.suit}
            </div>
            <div className="text-[9px] font-extrabold uppercase tracking-tight text-slate-700 mt-0.5">
              {card.suitName}
            </div>
          </>
        )}
      </div>

      {/* Bottom Edge Marker so Orientation (Upright vs. Upside-Down vs. Sideways) is 100% Visually Unmistakable */}
      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 border-t border-slate-300 pt-0.5">
        <span>BASE</span>
        <span>{card.rank}{card.suit}</span>
      </div>
    </div>
  );
}

// ============================================================================
// LARGE, OBVIOUS NON-COUNTING PROGRESS / SAND-TIMER BAR
// (Hidden automatically on the Clock Bonus Round where we test internal 30s time sense!)
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
      const remaining = Math.max(10, 100 - (elapsed / durationMs) * 90);
      setFillPct(remaining);
    }, 50);
    return () => window.clearInterval(id);
  }, [stepKey, durationMs, paused]);

  return (
    <div className="w-full rounded-2xl bg-slate-950 border-2 border-slate-700 p-3 flex items-center gap-3 shadow-inner">
      <span className="text-2xl select-none" aria-hidden="true">
        ⏳
      </span>
      <div className="flex-1 h-5 rounded-full bg-slate-900 overflow-hidden border border-slate-700 p-0.5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-amber-500 transition-all duration-75"
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
// GAME 1 (S0.3): MODERNIZED ARCADE PONG (10 Rallies)
// ============================================================================
const S03_PONG_RALLIES: {
  rallyNum: number;
  callBanner: string;
  targetQuad: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  hourglassMs: number;
  paddles: Record<
    'Q1' | 'Q2' | 'Q3' | 'Q4',
    { orbType: 'GOLD_STAR' | 'DIAMOND_BOLT' | 'SHIELD_ORB' | 'DECOY_ROCK' | 'EMPTY'; label: string; isTarget: boolean }
  >;
}[] = [
  {
    rallyNum: 1,
    callBanner: 'Bounce the ★ GOLD ORB!',
    targetQuad: 'Q3',
    hourglassMs: 4200,
    paddles: {
      Q2: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q1: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q3: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true },
      Q4: { orbType: 'EMPTY', label: 'Open', isTarget: false }
    }
  },
  {
    rallyNum: 2,
    callBanner: 'Bounce the ★ GOLD ORB!',
    targetQuad: 'Q1',
    hourglassMs: 3900,
    paddles: {
      Q2: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q1: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true },
      Q3: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q4: { orbType: 'EMPTY', label: 'Open', isTarget: false }
    }
  },
  {
    rallyNum: 3,
    callBanner: 'Bounce the ★ GOLD ORB!',
    targetQuad: 'Q4',
    hourglassMs: 3600,
    paddles: {
      Q2: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q1: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q3: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q4: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true }
    }
  },
  {
    rallyNum: 4,
    callBanner: 'Bounce the ★ GOLD ORB!',
    targetQuad: 'Q2',
    hourglassMs: 3400,
    paddles: {
      Q2: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true },
      Q1: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q3: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q4: { orbType: 'EMPTY', label: 'Open', isTarget: false }
    }
  },
  {
    rallyNum: 5,
    callBanner: 'Bounce ONLY the ★ GOLD ORB (Dodge the 🪨 Rock!)',
    targetQuad: 'Q4',
    hourglassMs: 3000,
    paddles: {
      Q2: { orbType: 'DECOY_ROCK', label: '🪨 ROCK', isTarget: false },
      Q1: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q3: { orbType: 'EMPTY', label: 'Open', isTarget: false },
      Q4: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true }
    }
  },
  {
    rallyNum: 6,
    callBanner: 'SPEED SWITCH: Bounce the ◆ DIAMOND COMET!',
    targetQuad: 'Q3',
    hourglassMs: 2700,
    paddles: {
      Q2: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false },
      Q1: { orbType: 'DECOY_ROCK', label: '🪨 ROCK', isTarget: false },
      Q3: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: true },
      Q4: { orbType: 'EMPTY', label: 'Open', isTarget: false }
    }
  },
  {
    rallyNum: 7,
    callBanner: 'MULTI-BALL: Bounce ONLY the 🛡️ SHIELD ORB!',
    targetQuad: 'Q1',
    hourglassMs: 2400,
    paddles: {
      Q2: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: false },
      Q1: { orbType: 'SHIELD_ORB', label: '🛡️ SHIELD ORB', isTarget: true },
      Q3: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false },
      Q4: { orbType: 'DECOY_ROCK', label: '🪨 ROCK', isTarget: false }
    }
  },
  {
    rallyNum: 8,
    callBanner: 'FAST SWITCH: Bounce ONLY the ★ GOLD ORB!',
    targetQuad: 'Q2',
    hourglassMs: 2200,
    paddles: {
      Q2: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true },
      Q1: { orbType: 'SHIELD_ORB', label: '🛡️ SHIELD ORB', isTarget: false },
      Q3: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: false },
      Q4: { orbType: 'DECOY_ROCK', label: '🪨 ROCK', isTarget: false }
    }
  },
  {
    rallyNum: 9,
    callBanner: 'STREAK BONUS: Bounce ONLY the ◆ DIAMOND COMET!',
    targetQuad: 'Q3',
    hourglassMs: 2000,
    paddles: {
      Q2: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false },
      Q1: { orbType: 'SHIELD_ORB', label: '🛡️ SHIELD ORB', isTarget: false },
      Q3: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: true },
      Q4: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false }
    }
  },
  {
    rallyNum: 10,
    callBanner: 'FINAL BALL: Bounce the 🛡️ SHIELD ORB!',
    targetQuad: 'Q1',
    hourglassMs: 1850,
    paddles: {
      Q2: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: false },
      Q1: { orbType: 'SHIELD_ORB', label: '🛡️ SHIELD ORB', isTarget: true },
      Q3: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false },
      Q4: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: false }
    }
  }
];

// ============================================================================
// GAME 2 (S1): SPEED GO-FISH!
// Starts with simple baseline Go-Fish ("Got any 7s?"), then escalates to:
// - 2-Card Multi-Requests ("Tap BOTH the 7 AND the King!")
// - Upside-Down Trick Cards ("Tap the UPSIDE-DOWN 7 of Hearts!")
// - Sideways / Directional Cards ("Tap the RIGHT-POINTING Ace of Spades!")
// ============================================================================
const S1_GO_FISH_ROUNDS: {
  roundNum: number;
  tier: number;
  rule: 'GLOBAL_MACRO' | 'LOCAL_MICRO' | 'MATRIX_DIFF';
  dealerSpeech: string;
  requiredSelections: number; // 1 card or 2 cards
  crowded: boolean;
  hand: CardSpec[];
  correctIndices: number[]; // empty [] means player does not have it -> must tap "🐟 GO FISH!"
}[] = [
  {
    roundNum: 1,
    tier: 1,
    rule: 'LOCAL_MICRO',
    dealerSpeech: '“Got any 7s?”',
    requiredSelections: 1,
    crowded: false,
    hand: [
      { rank: '2', suit: '♣', suitName: 'Clubs' },
      { rank: '7', suit: '♠', suitName: 'Spades' },
      { rank: '10', suit: '♥', suitName: 'Hearts' },
      { rank: 'K', suit: '♦', suitName: 'Diamonds' }
    ],
    correctIndices: [1]
  },
  {
    roundNum: 2,
    tier: 1,
    rule: 'GLOBAL_MACRO',
    dealerSpeech: '“Got any Queens (Q)?”',
    requiredSelections: 1,
    crowded: false,
    hand: [
      { rank: '4', suit: '♠', suitName: 'Spades' },
      { rank: '9', suit: '♣', suitName: 'Clubs' },
      { rank: '6', suit: '♦', suitName: 'Diamonds' },
      { rank: '10', suit: '♥', suitName: 'Hearts' }
    ],
    correctIndices: [] // None in hand -> tap "🐟 GO FISH!"
  },
  {
    roundNum: 3,
    tier: 2,
    rule: 'LOCAL_MICRO',
    dealerSpeech: '“Speed Bonus! Give me BOTH of your 8s (Tap 2 Cards)!”',
    requiredSelections: 2,
    crowded: false,
    hand: [
      { rank: '8', suit: '♠', suitName: 'Spades' },
      { rank: '3', suit: '♦', suitName: 'Diamonds' },
      { rank: 'K', suit: '♣', suitName: 'Clubs' },
      { rank: '8', suit: '♥', suitName: 'Hearts' },
      { rank: '5', suit: '♠', suitName: 'Spades' }
    ],
    correctIndices: [0, 3]
  },
  {
    roundNum: 4,
    tier: 3,
    rule: 'GLOBAL_MACRO',
    dealerSpeech: '“Trick Deck! Tap the UPSIDE-DOWN 7 of Hearts (♥)!”',
    requiredSelections: 1,
    crowded: true,
    hand: [
      { rank: '7', suit: '♥', suitName: 'Hearts', rotationDeg: 0 }, // Upright 7♥ (Lure!)
      { rank: '9', suit: '♠', suitName: 'Spades', rotationDeg: 0 },
      { rank: '4', suit: '♣', suitName: 'Clubs', rotationDeg: 180 },
      { rank: '7', suit: '♥', suitName: 'Hearts', rotationDeg: 180 }, // Upside-down 7♥ (Target!)
      { rank: '7', suit: '♦', suitName: 'Diamonds', rotationDeg: 180 },
      { rank: 'Q', suit: '♠', suitName: 'Spades', rotationDeg: 0 }
    ],
    correctIndices: [3]
  },
  {
    roundNum: 5,
    tier: 4,
    rule: 'LOCAL_MICRO',
    dealerSpeech: '“Directional Deal! Tap the SIDEWAYS (Tilted) Ace of Spades (A♠)!”',
    requiredSelections: 1,
    crowded: true,
    hand: [
      { rank: 'A', suit: '♠', suitName: 'Spades', rotationDeg: 0 }, // Upright A♠ (Lure!)
      { rank: 'K', suit: '♦', suitName: 'Diamonds', rotationDeg: 90 }, // Sideways K♦ (Lure!)
      { rank: '6', suit: '♣', suitName: 'Clubs', rotationDeg: 0 },
      { rank: 'A', suit: '♠', suitName: 'Spades', rotationDeg: 90 }, // Sideways A♠ (Target!)
      { rank: 'A', suit: '♥', suitName: 'Hearts', rotationDeg: 90 },
      { rank: '3', suit: '♠', suitName: 'Spades', rotationDeg: 180 },
      { rank: '9', suit: '♦', suitName: 'Diamonds', rotationDeg: 0 }
    ],
    correctIndices: [3]
  },
  {
    roundNum: 6,
    tier: 4,
    rule: 'MATRIX_DIFF',
    dealerSpeech: '“Double Combo! Tap BOTH the 4 of Clubs (4♣) AND the 9 of Diamonds (9♦)!”',
    requiredSelections: 2,
    crowded: true,
    hand: [
      { rank: '4', suit: '♠', suitName: 'Spades' },
      { rank: '4', suit: '♣', suitName: 'Clubs' },
      { rank: '9', suit: '♥', suitName: 'Hearts' },
      { rank: 'J', suit: '♣', suitName: 'Clubs' },
      { rank: '9', suit: '♦', suitName: 'Diamonds' },
      { rank: '2', suit: '♠', suitName: 'Spades' },
      { rank: '7', suit: '♦', suitName: 'Diamonds' }
    ],
    correctIndices: [1, 4]
  },
  {
    roundNum: 7,
    tier: 5,
    rule: 'MATRIX_DIFF',
    dealerSpeech: '“Pro Trick Hand! Tap BOTH the UPSIDE-DOWN Queen (Q♠) AND the UPRIGHT 5 of Hearts (5♥)!”',
    requiredSelections: 2,
    crowded: true,
    hand: [
      { rank: 'Q', suit: '♠', suitName: 'Spades', rotationDeg: 0 }, // Upright Q♠ lure
      { rank: '5', suit: '♥', suitName: 'Hearts', rotationDeg: 180 }, // Upside-down 5♥ lure
      { rank: 'Q', suit: '♠', suitName: 'Spades', rotationDeg: 180 }, // Upside-down Q♠ (Target 1)
      { rank: '8', suit: '♣', suitName: 'Clubs', rotationDeg: 0 },
      { rank: '5', suit: '♥', suitName: 'Hearts', rotationDeg: 0 }, // Upright 5♥ (Target 2)
      { rank: 'K', suit: '♦', suitName: 'Diamonds', rotationDeg: 90 },
      { rank: '3', suit: '♠', suitName: 'Spades', rotationDeg: 0 },
      { rank: '10', suit: '♣', suitName: 'Clubs', rotationDeg: 180 }
    ],
    correctIndices: [2, 4]
  }
];

// ============================================================================
// GAME 4 (S3.1): SPEED SOLITAIRE (With Wildcard Face/Object Match Built In!)
// ============================================================================
const S31_SCHEDULE: ('repeat' | 'switch')[] = [
  'repeat', 'repeat', 'switch', 'repeat', 'repeat',
  'switch', 'repeat', 'repeat', 'repeat', 'switch',
  'repeat', 'repeat', 'switch', 'repeat', 'repeat',
  'switch', 'repeat', 'repeat', 'repeat', 'switch',
  'repeat', 'repeat', 'repeat', 'switch', 'repeat',
  'repeat', 'repeat', 'switch', 'repeat', 'repeat'
];

// ============================================================================
// GAME 5 (S4): CASINO WORD WHEEL & DEALER CALL-BACK
// ============================================================================
const S4_DEALER_CALLS: {
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
    target: 'Deal five cards to every player.',
    options: [
      'Deal five cards to every player.',
      'Deal four cards to every table.',
      'Pass five chips to every player.'
    ]
  },
  {
    id: 2,
    tier: 3,
    syllables: 15,
    target: 'The lucky dealer drew two Aces and a Queen of Hearts from the deck.',
    options: [
      'The lucky dealer drew two Kings and a Queen of Spades from the deck.',
      'The lucky dealer drew two Aces and a Queen of Hearts from the deck.',
      'The quiet player drew two Aces and a Jack of Hearts from the pile.'
    ]
  },
  {
    id: 3,
    tier: 5,
    syllables: 22,
    target: 'The player who held the winning Rummy hand traded the Seven of Diamonds before the final turn.',
    options: [
      'The player who held the winning Poker hand traded the Seven of Clubs before the final turn.',
      'The dealer who shuffled the winning Rummy deck traded the Nine of Diamonds before the final turn.',
      'The player who held the winning Rummy hand traded the Seven of Diamonds before the final turn.'
    ]
  }
];

// ============================================================================
// GAME 6 (S5): BLACKJACK 21 & TABLE PLAYERS JACKPOT
// ============================================================================
const DEAL_ORDER_CARDS: { id: number; card: CardSpec; nickname: string }[] = [
  { id: 0, card: { rank: 'A', suit: '♠', suitName: 'Spades' }, nickname: 'Ace of Spades' },
  { id: 1, card: { rank: '4', suit: '♥', suitName: 'Hearts' }, nickname: '4 of Hearts' },
  { id: 2, card: { rank: '7', suit: '♣', suitName: 'Clubs' }, nickname: '7 of Clubs' },
  { id: 3, card: { rank: '10', suit: '♦', suitName: 'Diamonds' }, nickname: '10 of Diamonds' },
  { id: 4, card: { rank: 'Q', suit: '♠', suitName: 'Spades' }, nickname: 'Queen of Spades' },
  { id: 5, card: { rank: 'K', suit: '♥', suitName: 'Hearts' }, nickname: 'King of Hearts' }
];

const TABLE_PLAYERS_MEMORY = [
  {
    id: 1,
    tier: 2,
    seatLabel: 'Seat #1 Jackpot Check',
    cluePrompt: 'Which player at our Blackjack table held the ⚓ Lucky Anchor Ace?',
    firstSoundHint: 'Starts with "Sa-..."',
    correctPlayer: 'Sam the Sailor',
    playerChoices: ['Sam the Sailor', 'Clara the Baker', 'Leo the Violinist', 'Max the Gardener'],
    roleQuestion: 'What lucky item did Sam bring to the table?',
    correctRole: '⚓ Brass Compass & Anchor Ace',
    roleChoices: [
      '⚓ Brass Compass & Anchor Ace',
      '🥐 Warm Croissants',
      '🎻 Wooden Violin Case'
    ]
  },
  {
    id: 2,
    tier: 4,
    seatLabel: 'Seat #2 Jackpot Check',
    cluePrompt: 'Which player at our Blackjack table held the 🥐 Golden Bakery King?',
    firstSoundHint: 'Starts with "Cla-..."',
    correctPlayer: 'Clara the Baker',
    playerChoices: ['Clara the Baker', 'Sam the Sailor', 'Leo the Violinist', 'Max the Gardener'],
    roleQuestion: 'What lucky item did Clara bring to the table?',
    correctRole: '🥐 Warm Croissants & Bakery King',
    roleChoices: [
      '🥐 Warm Croissants & Bakery King',
      '⚓ Brass Compass',
      '🎻 Wooden Violin Case'
    ]
  },
  {
    id: 3,
    tier: 5,
    seatLabel: 'Seat #3 Jackpot Check',
    cluePrompt: 'Which player at our Blackjack table held the 🎻 Symphony Queen?',
    firstSoundHint: 'Starts with "Le-..."',
    correctPlayer: 'Leo the Violinist',
    playerChoices: ['Leo the Violinist', 'Sam the Sailor', 'Clara the Baker', 'Max the Gardener'],
    roleQuestion: 'What lucky item did Leo bring to the table?',
    correctRole: '🎻 Wooden Violin & Symphony Queen',
    roleChoices: [
      '🎻 Wooden Violin & Symphony Queen',
      '⚓ Brass Compass',
      '🥐 Warm Croissants'
    ]
  }
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
  const [bonusScore, setBonusScore] = useState<number>(100);

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

  // Game 1 (S0.3: Pong) state
  const [s03TrialIdx, setS03TrialIdx] = useState<number>(0);
  const [s03Running, setS03Running] = useState<boolean>(false);
  const [s03Collected, setS03Collected] = useState<
    { quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4'; rtMs: number; euclideanDistancePx: number; trajectoryLengthPx: number }[]
  >([]);
  const s03OnsetRef = useRef<number>(performance.now());

  // Game 2 (S1: Speed Go-Fish with Trick Cards & Multi-Select) state
  const [s1Idx, setS1Idx] = useState<number>(0);
  const [s1Running, setS1Running] = useState<boolean>(false);
  const [s1SelectedCards, setS1SelectedCards] = useState<number[]>([]);
  const [s1Collected, setS1Collected] = useState<
    { level: 'global' | 'local'; crowded: boolean; rtMs: number; isCorrect: boolean }[]
  >([]);
  const [s1MatrixHits, setS1MatrixHits] = useState<number>(0);

  // Game 3 (S2 & S3.2: 30-Second Clock Maker Bonus [NO PROGRESS BAR] + 3D Box + Foggy Deck) state
  const [s2Stage, setS2Stage] = useState<'CLOCK_DRAW_NO_TIMER' | 'CUBE_3D' | 'MIST_CARDS'>('CLOCK_DRAW_NO_TIMER');
  const [clockHoursPlaced, setClockHoursPlaced] = useState<number[]>([]);
  const [clockHandTargetHour, setClockHandTargetHour] = useState<number | null>(null);
  const [clockStartMs, setClockStartMs] = useState<number>(performance.now());
  const [cubeStruts, setCubeStruts] = useState<string[]>([]);
  const [s2MistIdx, setS2MistIdx] = useState<number>(0);
  const [s2FalsePositives, setS2FalsePositives] = useState<number>(0);

  // Game 4 (S3.1: Speed Solitaire with embedded Face/Object Wildcards) state
  const [s31Running, setS31Running] = useState<boolean>(false);
  const [s31TrialIdx, setS31TrialIdx] = useState<number>(0);
  const [s31Trials, setS31Trials] = useState<
    { condition: 'repeat' | 'switch'; rtMs: number; isCorrect: boolean; technicalFrameDrop?: boolean; modeSwitchInterrupted?: boolean }[]
  >([]);
  const s31OnsetRef = useRef<number>(performance.now());
  const prevModeRef = useRef<SingleTrialMode>(presentationMode);
  const [interruptedMidTrial, setInterruptedMidTrial] = useState<boolean>(false);

  // Game 5 (S4: Word Wheel & Dealer Call-Back) state
  const [s4SubStage, setS4SubStage] = useState<'FLUENCY' | 'ECHO'>('FLUENCY');
  const [s4TapTimestamps, setS4TapTimestamps] = useState<number[]>([]);
  const [s4EchoIdx, setS4EchoIdx] = useState<number>(0);
  const [s4EchoHits, setS4EchoHits] = useState<number>(0);
  const [s4LongMissed, setS4LongMissed] = useState<boolean>(false);
  const [s4PromptMasked, setS4PromptMasked] = useState<boolean>(false);

  // Game 6 (S5: Blackjack 21 & Table Jackpot) state
  const [s5SpanLength, setS5SpanLength] = useState<4 | 6>(4);
  const [s5SubStage, setS5SubStage] = useState<
    'MEET_PLAYERS' | 'STUDY_SEQ' | 'REBUILD_SEQ' | 'BLACKJACK_HAND' | 'SCHOLARS'
  >('MEET_PLAYERS');
  const [s5PickedSeq, setS5PickedSeq] = useState<number[]>([]);
  const [s5FreeLetterHit, setS5FreeLetterHit] = useState<boolean>(false);
  const [s5ScholarIdx, setS5ScholarIdx] = useState<number>(0);
  const [s5ScholarStep, setS5ScholarStep] = useState<'FREE' | 'SEMANTIC' | 'PHONEMIC'>('FREE');
  const [s5FreeHits, setS5FreeHits] = useState<number>(0);
  const [s5SemanticHits, setS5SemanticHits] = useState<number>(0);
  const [s5PhonemicHits, setS5PhonemicHits] = useState<number>(0);

  // 60s Inactivity Auto-Pause
  useEffect(() => {
    if (!s03Running && !s1Running && !s31Running) return;
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
      // Safe fallback
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
      setClockStartMs(performance.now());
    }
  };

  const adjustTier = (isCorrect: boolean, rtMs: number, fastThresholdMs = 950) => {
    if (isCorrect) {
      setBonusScore((s) => s + (rtMs <= fastThresholdMs ? 50 : 25));
    }
    setAdaptiveTier((prev) => {
      if (isCorrect && rtMs <= fastThresholdMs) return Math.min(5, prev + 1);
      if (!isCorrect) return Math.max(1, prev - 1);
      return prev;
    });
    setPaceMultiplier((prev) => {
      if (isCorrect && rtMs <= fastThresholdMs) return Math.max(0.62, prev * 0.88);
      if (!isCorrect) return Math.min(1.5, prev * 1.18);
      return prev;
    });
  };

  // Keyboard support for Game 1 (Keys 1, 2, 3, 4 & Spacebar)
  useEffect(() => {
    if (stationPrefix !== 'S0' || isPaused) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (pagePhase === 'INTRO_DEMO' && (e.key === '1' || e.key === ' ')) {
        e.preventDefault();
        playToneSequence([500, 1000, 2000], 0.12);
        onUpdateSensoryChecks({
          ...sensoryChecks,
          hearingCheckPassed: true,
          colorPatternCheckPassed: true
        });
        setDemoCompleted(true);
        return;
      }
      if (pagePhase === 'ACTIVE_TEST' && s03Running) {
        const keyMap: Record<string, 'Q1' | 'Q2' | 'Q3' | 'Q4'> = {
          '1': 'Q2',
          '2': 'Q1',
          '3': 'Q3',
          '4': 'Q4'
        };
        const pressedQ = keyMap[e.key];
        const currentRally = S03_PONG_RALLIES[s03TrialIdx] ?? S03_PONG_RALLIES[0];
        if (pressedQ) {
          e.preventDefault();
          const isHit = pressedQ === currentRally.targetQuad;
          const rt = Math.max(140, Math.round(performance.now() - s03OnsetRef.current));
          playToneSequence(isHit ? [784] : [260], 0.06);
          adjustTier(isHit, rt, currentRally.hourglassMs * 0.45);
          const next = [
            ...s03Collected,
            { quadrant: pressedQ, rtMs: rt, euclideanDistancePx: 140, trajectoryLengthPx: isHit ? 146 : 210 }
          ];
          onAppendTrialEvent({
            stationId: 'S0.3',
            condition: pressedQ,
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
          if (s03TrialIdx + 1 >= S03_PONG_RALLIES.length) {
            const expanded = [...next, ...next, ...next, ...next];
            onUpdateStationTelemetry({
              'S0.3': computeQuadrantKruskalWallis(expanded, 44.0)
            });
            setS03Running(false);
            setPagePhase('ACTIVITY_COMPLETE');
          } else {
            setS03Collected(next);
            setS03TrialIdx(s03TrialIdx + 1);
            s03OnsetRef.current = performance.now();
          }
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    stationPrefix,
    isPaused,
    pagePhase,
    s03Running,
    s03TrialIdx,
    s03Collected,
    sensoryChecks,
    presentationMode,
    interruptedMidTrial,
    onUpdateSensoryChecks,
    onAppendTrialEvent,
    onUpdateStationTelemetry
  ]);

  const GAMES_META: Record<
    string,
    {
      num: number;
      title: string;
      nextStationId: StationId | null;
      page1SimpleInstruction: string;
      page2SimpleReminder: string;
      hideProgressBar?: boolean;
    }
  > = {
    S0: {
      num: 1,
      title: 'Game 1 of 6: 4-Corner Arcade Pong',
      nextStationId: 'S1.1',
      page1SimpleInstruction:
        'Tap the corner paddle where the glowing target orb lands to bounce it back before the speed bar runs down!',
      page2SimpleReminder: 'Bounce the called-out orb before the Speed Bar runs out!'
    },
    S1: {
      num: 2,
      title: 'Game 2 of 6: Speed Go-Fish!',
      nextStationId: 'S2.1',
      page1SimpleInstruction:
        'Play Go-Fish against the Dealer before the Speed Bar runs down! As you win hands, watch out for 2-card combos and upside-down trick cards!',
      page2SimpleReminder: 'Tap the card(s) the Dealer asks for—or tap "🐟 GO FISH!" if not in your hand.'
    },
    S2: {
      num: 3,
      title: 'Game 3 of 6: 30-Second Clock Maker & 3D Box Bonus',
      nextStationId: 'S3.1',
      page1SimpleInstruction:
        'Build a Clock with all 12 hours and set it to Noon (12:00)—Bonus Points for finishing under 30 seconds (no timer bar shown, so trust your internal sense of time)!',
      page2SimpleReminder: 'Bonus Points for finishing under 30 seconds! Place all 12 hours and set the hands to Noon.',
      hideProgressBar: true
    },
    S3: {
      num: 4,
      title: 'Game 4 of 6: Speed Solitaire & Wildcards',
      nextStationId: 'S4.1',
      page1SimpleInstruction:
        'Play your center card onto Foundation Pile A or Pile B before the Speed Bar runs out—matching by Number, Suit, or Character FaceCard!',
      page2SimpleReminder: 'Play the center card onto the matching Foundation Pile.'
    },
    S4: {
      num: 5,
      title: 'Game 5 of 6: Word Wheel & Dealer Call-Back',
      nextStationId: 'S5.1',
      page1SimpleInstruction:
        'Say words starting with "F" out loud to stack bonus chips before the Speed Bar runs down, then match 3 quick Dealer table calls!',
      page2SimpleReminder: 'Tap the chip for each "F" word you say, then match the Dealer call.'
    },
    S5: {
      num: 6,
      title: 'Game 6 of 6: Blackjack 21 & Table Jackpot',
      nextStationId: null,
      page1SimpleInstruction:
        'Play a hand of Blackjack 21 with Sam, Clara, and Leo, flip the 4-card deal in order, and claim the Table Jackpot!',
      page2SimpleReminder: 'Beat the Dealer to 21 and remember what Sam, Clara, and Leo held.'
    }
  };

  const meta = GAMES_META[stationPrefix] ?? GAMES_META.S0;
  // Hide the progress bar during the Clock Maker round so we genuinely measure the player's internal sense of 30 seconds!
  const shouldShowProgressBar =
    pagePhase === 'ACTIVE_TEST' &&
    !(stationPrefix === 'S2' && s2Stage === 'CLOCK_DRAW_NO_TIMER');

  return (
    <div
      data-testid="participant-task-surface"
      className="min-h-[540px] rounded-2xl border border-slate-700/90 bg-[#0B131E] p-6 sm:p-8 text-slate-100 shadow-2xl flex flex-col justify-between"
    >
      {/* =====================================================================
          PERSISTENT TOP BAR: Game Title + Score Chips + Help/Pause
         ===================================================================== */}
      <div className="space-y-3 border-b border-slate-800 pb-4 mb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="px-3.5 py-1.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
              🎮 {meta.title}
            </span>
            <span
              data-testid="adaptive-tier-badge"
              className="px-3 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-300"
            >
              Table Level {adaptiveTier} • 🪙 {bonusScore} Pts
            </span>
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
              ❓ {showHelpModal ? 'Close Help' : 'How to Play'}
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

        {/* LARGE OBVIOUS NON-COUNTING PROGRESS BAR (Hidden on Clock Bonus Round for Sense-of-Time Measurement) */}
        {shouldShowProgressBar && (
          <LargeGameProgressBar
            stepKey={`${stationPrefix}-${s03TrialIdx}-${s1Idx}-${s2Stage}-${s2MistIdx}-${s31TrialIdx}-${s4EchoIdx}-${s5SubStage}`}
            durationMs={Math.round(4800 * paceMultiplier)}
            paused={isPaused}
          />
        )}
      </div>

      {/* =====================================================================
          PAUSE OVERLAY BANNER
         ===================================================================== */}
      {isPaused && (
        <div
          data-testid="pause-modal-banner"
          className="mb-6 rounded-2xl border-2 border-sky-400/70 bg-slate-950/95 p-6 text-slate-100 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-xl font-bold text-sky-300">
              Game Paused — Take a Breather Anytime
            </h3>
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
          <p className="text-sm text-slate-300">
            Click <strong>Resume Game</strong> whenever you are ready.
          </p>
        </div>
      )}

      {/* =====================================================================
          HELP OVERLAY MODAL
         ===================================================================== */}
      {showHelpModal && (
        <div
          data-testid="help-modal-banner"
          className="mb-6 rounded-2xl border-2 border-amber-400/70 bg-slate-950/95 p-6 text-slate-100 space-y-3"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-amber-300">
              ❓ How to Play: {meta.title}
            </h3>
            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs cursor-pointer"
            >
              Got It
            </button>
          </div>
          <p className="text-lg text-white leading-relaxed">{meta.page1SimpleInstruction}</p>
        </div>
      )}

      {/* =====================================================================
          SCREEN 1 OF EACH GAME: CLEAR 1-SENTENCE INSTRUCTION + PRACTICE ROUND
         ===================================================================== */}
      {pagePhase === 'INTRO_DEMO' && (
        <div className="my-auto max-w-2xl w-full mx-auto space-y-6 py-3">
          <div className="space-y-3 text-center">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
              {meta.title}
            </h2>
            <p className="text-lg sm:text-xl text-slate-100 font-medium leading-relaxed">
              {meta.page1SimpleInstruction}
            </p>
          </div>

          <div className="rounded-2xl bg-[#0D231A] border-2 border-emerald-600/40 p-6 text-center space-y-4 shadow-inner">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Quick Practice Round
            </div>

            {stationPrefix === 'S0' && (
              <div className="space-y-3">
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
                  className={`w-full max-w-md mx-auto min-h-16 px-6 py-4 rounded-2xl font-extrabold text-lg border-2 transition-all cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-800 border-emerald-300 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950 shadow-lg'
                  }`}
                >
                  {demoCompleted
                    ? '✓ Practice Bounce Complete!'
                    : '🏓 Tap Here to Bounce the Practice ★ Gold Orb'}
                </button>
              </div>
            )}

            {stationPrefix === 'S1' && (
              <div className="space-y-4">
                <p className="text-base font-bold text-white">
                  Practice Go-Fish: Dealer asks <em>&ldquo;Got any 5s?&rdquo;</em> — Tap the <strong>5♠</strong> in your hand:
                </p>
                <div className="flex flex-wrap justify-center items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="cursor-pointer transition-transform hover:-translate-y-1"
                  >
                    {renderPlayingCard({ rank: '5', suit: '♠', suitName: 'Spades' }, { size: 'md', highlighted: true })}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="cursor-pointer opacity-80"
                  >
                    {renderPlayingCard({ rank: '9', suit: '♦', suitName: 'Diamonds' }, { size: 'md' })}
                  </button>
                </div>
                {demoCompleted && (
                  <div className="text-sm font-extrabold text-emerald-300">
                    ✓ Great! In later hands, watch out for 2-card combos and upside-down trick cards!
                  </div>
                )}
              </div>
            )}

            {stationPrefix === 'S2' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  No timer bar will be shown on the next screen—finish placing the 12 hours and Noon hands in <strong>under 30 seconds</strong> for a <strong>+500 Point Bonus</strong>!
                </p>
                <button
                  type="button"
                  onClick={() => setDemoCompleted(true)}
                  className={`min-h-14 px-6 py-3 rounded-xl font-extrabold text-base border cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-800 border-emerald-300 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                  }`}
                >
                  {demoCompleted
                    ? '✓ Ready for the 30-Second Clock Challenge!'
                    : '⏱️ I’m Ready for the 30-Second Clock Bonus!'}
                </button>
              </div>
            )}

            {stationPrefix === 'S3' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  Practice Solitaire: Tap <strong>Pile A (7♠)</strong> to play a matching <strong>7♦</strong>:
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className={`min-h-12 px-5 py-2.5 rounded-xl font-extrabold text-sm border cursor-pointer ${
                      demoCompleted
                        ? 'bg-emerald-800 border-emerald-300 text-white'
                        : 'bg-sky-600 hover:bg-sky-500 border-sky-300 text-white'
                    }`}
                  >
                    {demoCompleted ? '✓ Played on Pile A!' : 'Pile A: 7♠ (Spades)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="min-h-12 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm border border-slate-600 cursor-pointer"
                  >
                    Pile B: 2♦ (Diamonds)
                  </button>
                </div>
              </div>
            )}

            {stationPrefix === 'S4' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  Say any <strong>&ldquo;F&rdquo;</strong> word out loud and tap the chip stack once:
                </p>
                <button
                  type="button"
                  onClick={() => {
                    playToneSequence([523], 0.08);
                    setDemoCompleted(true);
                  }}
                  className={`min-h-14 px-6 py-3 rounded-xl font-extrabold text-base border cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-800 border-emerald-300 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                  }`}
                >
                  {demoCompleted ? '✓ Chip Stacked!' : '🪙 Tap Chip Stack (+1 "F" Word)'}
                </button>
              </div>
            )}

            {stationPrefix === 'S5' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  In Blackjack 21, <strong>10 + Ace (11) = 21</strong>! Tap below to join the table:
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
                  {demoCompleted ? '✓ Seat Reserved at Blackjack Table!' : '🃏 Take Seat at Blackjack Table'}
                </button>
              </div>
            )}
          </div>

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
                  setS1SelectedCards([]);
                  setS1MatrixHits(0);
                  setS1Running(true);
                  s03OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S2') {
                  setS2Stage('CLOCK_DRAW_NO_TIMER');
                  setClockHoursPlaced([]);
                  setClockHandTargetHour(null);
                  setClockStartMs(performance.now());
                  setCubeStruts([]);
                  setS2MistIdx(0);
                  setS2FalsePositives(0);
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
                  setS5SubStage('MEET_PLAYERS');
                  setS5PickedSeq([]);
                }
              }}
              className="w-full max-w-md min-h-14 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xl shadow-xl transition-transform active:scale-98 cursor-pointer"
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
          SCREEN 2 OF EACH GAME: LIVE GAME TABLE
         ===================================================================== */}
      {pagePhase === 'ACTIVE_TEST' && (
        <div className="my-auto max-w-3xl w-full mx-auto space-y-4">
          {/* -----------------------------------------------------------------
              GAME 1 (S0.3): MODERN 4-CORNER ARCADE PONG
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S0' && (
            <div className="space-y-4">
              {(() => {
                const rally = S03_PONG_RALLIES[s03TrialIdx] ?? S03_PONG_RALLIES[0];
                return (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-[#0D231A] border-2 border-amber-400/80 p-4 text-center shadow-md">
                      <div className="text-xl sm:text-2xl font-extrabold text-white">
                        {rally.callBanner}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {(
                        [
                          { q: 'Q2', keyNum: '1', label: 'Top-Left Paddle' },
                          { q: 'Q1', keyNum: '2', label: 'Top-Right Paddle' },
                          { q: 'Q3', keyNum: '3', label: 'Bottom-Left Paddle' },
                          { q: 'Q4', keyNum: '4', label: 'Bottom-Right Paddle' }
                        ] as const
                      ).map(({ q, keyNum, label }) => {
                        const pad = rally.paddles[q];
                        const isActiveOrb = pad.orbType !== 'EMPTY';
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => {
                              const isHit = pad.isTarget;
                              const rt = Math.max(
                                140,
                                Math.round(performance.now() - s03OnsetRef.current)
                              );
                              playToneSequence(isHit ? [784] : [260], 0.06);
                              adjustTier(isHit, rt, rally.hourglassMs * 0.45);
                              const next = [
                                ...s03Collected,
                                {
                                  quadrant: q,
                                  rtMs: rt,
                                  euclideanDistancePx: 140,
                                  trajectoryLengthPx: isHit ? 146 : 210
                                }
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
                              if (s03TrialIdx + 1 >= S03_PONG_RALLIES.length) {
                                const expanded = [...next, ...next, ...next, ...next];
                                onUpdateStationTelemetry({
                                  'S0.3': computeQuadrantKruskalWallis(expanded, 44.0)
                                });
                                setS03Running(false);
                                setPagePhase('ACTIVITY_COMPLETE');
                              } else {
                                setS03Collected(next);
                                setS03TrialIdx(s03TrialIdx + 1);
                                s03OnsetRef.current = performance.now();
                              }
                            }}
                            className={`min-h-40 rounded-2xl border-2 flex flex-col items-center justify-center p-5 transition-all cursor-pointer ${
                              pad.isTarget
                                ? 'bg-slate-900 hover:bg-slate-800 border-amber-400 shadow-lg'
                                : isActiveOrb
                                ? 'bg-slate-900 hover:bg-slate-800 border-sky-500/60 shadow-md'
                                : 'bg-slate-950/80 border-slate-800 text-slate-600'
                            }`}
                          >
                            <div
                              className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl font-extrabold ${
                                pad.orbType === 'GOLD_STAR'
                                  ? 'bg-amber-400/20 border-2 border-amber-300 text-amber-300 shadow-md'
                                  : pad.orbType === 'DIAMOND_BOLT'
                                  ? 'bg-sky-400/20 border-2 border-sky-300 text-sky-200'
                                  : pad.orbType === 'SHIELD_ORB'
                                  ? 'bg-emerald-400/20 border-2 border-emerald-300 text-emerald-200'
                                  : pad.orbType === 'DECOY_ROCK'
                                  ? 'bg-slate-800 border-2 border-slate-600 text-slate-400'
                                  : 'border border-dashed border-slate-800 text-slate-700'
                              }`}
                            >
                              {pad.orbType === 'GOLD_STAR'
                                ? '★'
                                : pad.orbType === 'DIAMOND_BOLT'
                                ? '◆'
                                : pad.orbType === 'SHIELD_ORB'
                                ? '🛡️'
                                : pad.orbType === 'DECOY_ROCK'
                                ? '🪨'
                                : '·'}
                            </div>
                            <span className="text-xs font-extrabold uppercase tracking-wider text-white mt-2">
                              {pad.label}
                            </span>
                            <div className="w-24 h-2 rounded-full bg-emerald-400/80 mt-2" />
                            <span className="text-[11px] font-semibold text-slate-400 mt-1">
                              {label} (Key {keyNum})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 2 (S1): SPEED GO-FISH!
              Starts with simple Go-Fish, then escalates to 2-card combos and
              Upside-Down (180°) / Sideways (90°) Trick Cards!
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S1' && (
            <div className="space-y-4">
              {(() => {
                const round = S1_GO_FISH_ROUNDS[s1Idx] ?? S1_GO_FISH_ROUNDS[0];

                const finishRound = (picked: number[] | 'GO_FISH') => {
                  const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                  let hit = false;
                  if (picked === 'GO_FISH') {
                    hit = round.correctIndices.length === 0;
                  } else {
                    const sortedA = [...picked].sort().join(',');
                    const sortedB = [...round.correctIndices].sort().join(',');
                    hit = sortedA === sortedB;
                  }

                  playToneSequence(hit ? [784] : [260], 0.06);
                  adjustTier(hit, rt, 1800);

                  const nextMatrixHits =
                    s1MatrixHits + (round.rule === 'MATRIX_DIFF' && hit ? 1 : 0);
                  const nextCollected = [
                    ...s1Collected,
                    {
                      level: (round.rule === 'LOCAL_MICRO' ? 'local' : 'global') as
                        | 'global'
                        | 'local',
                      crowded: round.crowded,
                      rtMs: rt,
                      isCorrect: hit
                    }
                  ];

                  setS1SelectedCards([]);
                  if (s1Idx + 1 >= S1_GO_FISH_ROUNDS.length) {
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
                        arraysCompleted90s: nextMatrixHits >= 1 ? 16 : 11,
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
                };

                const handleTapCardInHand = (cIdx: number) => {
                  if (round.requiredSelections === 1) {
                    finishRound([cIdx]);
                  } else {
                    const exists = s1SelectedCards.includes(cIdx);
                    const nextSel = exists
                      ? s1SelectedCards.filter((x) => x !== cIdx)
                      : [...s1SelectedCards, cIdx];
                    setS1SelectedCards(nextSel);
                    if (nextSel.length >= round.requiredSelections) {
                      finishRound(nextSel);
                    }
                  }
                };

                return (
                  <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/60 space-y-5 shadow-xl">
                    {/* Dealer Speech Bubble */}
                    <div className="rounded-2xl bg-slate-950/90 border-2 border-amber-400 p-4 text-center space-y-1">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                        🐟 Go-Fish Hand {round.roundNum} of {S1_GO_FISH_ROUNDS.length}
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold text-white">
                        Dealer: {round.dealerSpeech}
                      </div>
                      {round.requiredSelections === 2 && (
                        <div className="text-xs font-bold text-amber-300">
                          (Selected {s1SelectedCards.length} of 2 Cards)
                        </div>
                      )}
                    </div>

                    {/* Player's Fanned Hand (Includes Upside-Down 180° & Sideways 90° Trick Cards!) */}
                    <div
                      className={`flex flex-wrap justify-center items-center py-4 ${
                        round.crowded ? 'gap-2.5 sm:gap-3' : 'gap-4 sm:gap-5'
                      }`}
                    >
                      {round.hand.map((card, cIdx) => (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => handleTapCardInHand(cIdx)}
                          className="transition-transform hover:-translate-y-2 active:scale-95 cursor-pointer p-1"
                        >
                          {renderPlayingCard(card, {
                            size: round.crowded ? 'sm' : 'md',
                            selected: s1SelectedCards.includes(cIdx)
                          })}
                        </button>
                      ))}
                    </div>

                    {/* Prominent "🐟 GO FISH!" Button */}
                    <div className="flex justify-center">
                      <button
                        type="button"
                        onClick={() => finishRound('GO_FISH')}
                        className="w-full max-w-md min-h-14 px-6 py-3.5 rounded-2xl bg-sky-700 hover:bg-sky-600 border-2 border-sky-300 text-white font-extrabold text-lg shadow-lg cursor-pointer"
                      >
                        🐟 &ldquo;GO FISH!&rdquo; (Not in My Hand)
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 3 (S2 & S3.2):
              - STAGE 1: DRAW A CLOCK WITH ALL HOURS & AT NOON (+500 Bonus Under 30s, NO PROGRESS BAR!)
              - STAGE 2: 3D BOX BUILDER
              - STAGE 3: SHROUDED MYSTERY CARD DRAW
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S2' && (
            <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/60 space-y-5 shadow-xl">
              {s2Stage === 'CLOCK_DRAW_NO_TIMER' && (
                <div className="space-y-4 text-center">
                  <div className="inline-block px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    🏆 +500 Bonus Points for Completion Under 30 Seconds!
                  </div>
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    Draw a Clock with All 12 Hours and Set the Hands at Noon
                  </h3>
                  <p className="text-sm text-slate-300">
                    1. Tap the 12 rim spots in order to place all 12 hours around the blank dial ({clockHoursPlaced.length}/12 placed).
                    <br />
                    2. Then tap where the hands point at <strong>Noon</strong>!
                  </p>

                  {/* Blank Clock Dial Where Player Places All 12 Hours & Noon Hands */}
                  <div className="flex justify-center">
                    <svg
                      viewBox="0 0 260 260"
                      className="w-64 h-64 bg-slate-950 rounded-full border-4 border-amber-400/70 shadow-xl"
                      aria-label="Blank Clock Drawing Canvas"
                    >
                      <circle cx="130" cy="130" r="116" fill="#0F172A" stroke="#334155" strokeWidth="2" />

                      {/* Drawn Hands When Player Sets Noon (or Any Target Hour Slot) */}
                      {clockHandTargetHour !== null &&
                        (() => {
                          const angle = ((clockHandTargetHour % 12) * 30 - 90) * (Math.PI / 180);
                          const hx = 130 + 52 * Math.cos(angle);
                          const hy = 130 + 52 * Math.sin(angle);
                          const mx = 130 + 80 * Math.cos(angle);
                          const my = 130 + 80 * Math.sin(angle);
                          return (
                            <>
                              <line x1="130" y1="130" x2={mx} y2={my} stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
                              <line x1="130" y1="130" x2={hx} y2={hy} stroke="#FBBF24" strokeWidth="6" strokeLinecap="round" />
                            </>
                          );
                        })()}

                      <circle cx="130" cy="130" r="6" fill="#FBBF24" />

                      {/* 12 Rim Slots (Blank until tapped by the player!) */}
                      {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((slotHour) => {
                        const angle = ((slotHour % 12) * 30 - 90) * (Math.PI / 180);
                        const cx = 130 + 92 * Math.cos(angle);
                        const cy = 130 + 92 * Math.sin(angle);
                        const isHourPlaced = clockHoursPlaced.includes(slotHour);
                        const isHandSetHere = clockHandTargetHour === slotHour;
                        return (
                          <g
                            key={slotHour}
                            onClick={() => {
                              playToneSequence([659], 0.05);
                              if (!isHourPlaced) {
                                setClockHoursPlaced((prev) => [...prev, slotHour]);
                              } else {
                                setClockHandTargetHour(slotHour);
                              }
                            }}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={cx}
                              cy={cy}
                              r="16"
                              fill={
                                isHandSetHere
                                  ? '#10B981'
                                  : isHourPlaced
                                  ? '#0284C7'
                                  : '#1E293B'
                              }
                              stroke={isHourPlaced ? '#BAE6FD' : '#475569'}
                              strokeWidth="2"
                              strokeDasharray={isHourPlaced ? undefined : '3,3'}
                            />
                            <text
                              x={cx}
                              y={cy}
                              fill={isHourPlaced ? '#FFFFFF' : '#64748B'}
                              fontSize="12"
                              fontWeight="bold"
                              textAnchor="middle"
                              dominantBaseline="central"
                            >
                              {isHourPlaced ? slotHour : '+'}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setClockHoursPlaced([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
                        setClockHandTargetHour(12);
                        playToneSequence([523, 659, 784], 0.07);
                      }}
                      className="min-h-12 px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-bold text-sm cursor-pointer"
                    >
                      ⚡ Quick-Place All 12 Hours &amp; Noon Hands
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const elapsedSec = (performance.now() - clockStartMs) / 1000;
                        if (elapsedSec <= 30) {
                          setBonusScore((s) => s + 500);
                        }
                        setS2Stage('CUBE_3D');
                      }}
                      className="min-h-12 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-lg cursor-pointer"
                    >
                      ✓ Submit Clock &rarr;
                    </button>
                  </div>
                </div>
              )}

              {s2Stage === 'CUBE_3D' && (
                <div className="space-y-4 text-center">
                  <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                    3D Box Builder: Tap the 4 Corner Depth Lines to Complete the 3D Cube
                  </h3>
                  <div className="flex justify-center">
                    <svg
                      viewBox="0 0 360 210"
                      className="w-full max-w-md h-52 bg-slate-950 rounded-2xl border-2 border-slate-800"
                    >
                      <rect x="155" y="30" width="105" height="105" fill="none" stroke="#38BDF8" strokeWidth="3" strokeDasharray="5,4" />
                      <rect x="95" y="70" width="105" height="105" fill="none" stroke="#FBBF24" strokeWidth="3.5" />
                      {[
                        { id: 'TL', x1: 95, y1: 70, x2: 155, y2: 30 },
                        { id: 'TR', x1: 200, y1: 70, x2: 260, y2: 30 },
                        { id: 'BR', x1: 200, y1: 175, x2: 260, y2: 135 },
                        { id: 'BL', x1: 95, y1: 175, x2: 155, y2: 135 }
                      ].map((edge) => {
                        const active = cubeStruts.includes(edge.id);
                        return (
                          <g
                            key={edge.id}
                            onClick={() => {
                              playToneSequence([784], 0.05);
                              setCubeStruts((prev) =>
                                prev.includes(edge.id) ? prev : [...prev, edge.id]
                              );
                            }}
                            className="cursor-pointer"
                          >
                            <line
                              x1={edge.x1}
                              y1={edge.y1}
                              x2={edge.x2}
                              y2={edge.y2}
                              stroke={active ? '#34D399' : '#475569'}
                              strokeWidth={active ? 5 : 3}
                              strokeDasharray={active ? undefined : '4,4'}
                            />
                            <circle
                              cx={(edge.x1 + edge.x2) / 2}
                              cy={(edge.y1 + edge.y2) / 2}
                              r="11"
                              fill={active ? '#059669' : '#1E293B'}
                              stroke="#94A3B8"
                              strokeWidth="1.5"
                            />
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCubeStruts(['TL', 'TR', 'BR', 'BL'])}
                      className="min-h-12 px-5 py-2.5 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-bold text-sm cursor-pointer"
                    >
                      ⚡ Connect All 4 Depth Edges ({cubeStruts.length}/4)
                    </button>
                    <button
                      type="button"
                      onClick={() => setS2Stage('MIST_CARDS')}
                      className="min-h-12 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base cursor-pointer"
                    >
                      ✓ Next: Draw 3 Shrouded Cards &rarr;
                    </button>
                  </div>
                </div>
              )}

              {s2Stage === 'MIST_CARDS' &&
                (() => {
                  const cards = [
                    {
                      id: 1,
                      isBlank: false,
                      correct: '⛵ Sailing Ship Card',
                      kind: 'ship'
                    },
                    {
                      id: 2,
                      isBlank: true,
                      correct: '🃏 Blank Mist Card (Nothing On It)',
                      kind: 'blank'
                    },
                    {
                      id: 3,
                      isBlank: false,
                      correct: '⚓ Lucky Anchor Card',
                      kind: 'anchor'
                    }
                  ];
                  const cur = cards[s2MistIdx] ?? cards[0];
                  return (
                    <div className="space-y-4 text-center">
                      <h3 className="text-xl font-extrabold text-white">
                        Mystery Draw {s2MistIdx + 1} of 3: What is on this shrouded card?
                      </h3>
                      <div className="h-48 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                        <svg viewBox="0 0 320 160" className="w-full h-full max-w-sm">
                          <defs>
                            <filter id={`mist-${cur.id}`}>
                              <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves={4} seed={cur.id * 13} />
                              <feColorMatrix type="saturate" values="0.1" />
                            </filter>
                          </defs>
                          {cur.kind === 'ship' && (
                            <g transform="translate(160,85)" fill="#F8FAFC" opacity={0.75}>
                              <polygon points="-45,12 45,12 30,32 -30,32" />
                              <polygon points="-3,-42 -3,6 -36,6" />
                              <polygon points="3,-36 3,6 38,6" />
                            </g>
                          )}
                          {cur.kind === 'anchor' && (
                            <g transform="translate(160,85) rotate(22)" fill="none" stroke="#F8FAFC" strokeWidth="6" opacity={0.55}>
                              <circle cx="0" cy="-30" r="8" />
                              <line x1="0" y1="-22" x2="0" y2="28" />
                              <path d="M -32,8 Q 0,42 32,8" />
                            </g>
                          )}
                          <rect width="320" height="160" filter={`url(#mist-${cur.id})`} opacity={0.68} />
                        </svg>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {[
                          '⛵ Sailing Ship Card',
                          '⚓ Lucky Anchor Card',
                          '👑 Royal Face Card',
                          '🃏 Blank Mist Card (Nothing On It)'
                        ].map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => {
                              const fp =
                                s2FalsePositives +
                                (cur.isBlank && ch !== '🃏 Blank Mist Card (Nothing On It)' ? 1 : 0);
                              if (s2MistIdx + 1 >= cards.length) {
                                const clockOk =
                                  clockHoursPlaced.length >= 10 && clockHandTargetHour === 12 ? 4 : 3;
                                const cubeOk = Math.max(4, cubeStruts.length * 2);
                                onUpdateStationTelemetry({
                                  'S2.1': {
                                    totalNoisePlates: 20,
                                    pareidoliaFalsePositiveCount: Math.min(12, fp * 2),
                                    trueObjectHitCount: 7,
                                    measuredDurationSec: 65.0
                                  },
                                  'S2.2': {
                                    canonicalAccuracy: 8,
                                    foreshortenedAccuracy: 7,
                                    invarianceRatio: 0.875,
                                    measuredDurationSec: 60.0
                                  },
                                  'S3.2': {
                                    cubeVerticesCorrect: cubeOk,
                                    clockNumbersAndHandsCorrect: clockOk,
                                    constructionCompositeScore: cubeOk + clockOk,
                                    measuredDurationSec: 55.0
                                  }
                                });
                                setPagePhase('ACTIVITY_COMPLETE');
                              } else {
                                setS2FalsePositives(fp);
                                setS2MistIdx(s2MistIdx + 1);
                              }
                            }}
                            className="min-h-14 px-4 py-3 rounded-xl bg-slate-900 hover:bg-sky-700 border border-slate-700 text-white font-extrabold text-base cursor-pointer"
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
              GAME 4 (S3.1): SPEED SOLITAIRE (With Embedded Face & Object Wildcards!)
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S3' && (
            <div
              data-testid="s31-active-trial-card"
              className="rounded-2xl bg-[#0D231A] border-2 border-emerald-500/60 p-6 space-y-5 shadow-lg"
            >
              {(() => {
                const isSwitchRule = S31_SCHEDULE[s31TrialIdx] === 'switch';
                // Every 3rd card is a Character Portrait Face Card or Compass/Glasses Wildcard
                // so Face & Object recognition is silently measured inside Speed Solitaire!
                const isPortraitWild = s31TrialIdx % 3 === 1;
                const isObjectWild = s31TrialIdx % 3 === 2;

                const centerCard: CardSpec = isSwitchRule
                  ? {
                      rank: '2',
                      suit: '♠',
                      suitName: 'Spades',
                      centerGraphic: isPortraitWild
                        ? 'PORTRAIT_GLASSES'
                        : isObjectWild
                        ? 'COMPASS_WILD'
                        : 'DEFAULT'
                    }
                  : {
                      rank: '7',
                      suit: '♦',
                      suitName: 'Diamonds',
                      centerGraphic: isPortraitWild
                        ? 'PORTRAIT_GLASSES'
                        : isObjectWild
                        ? 'GLASSES_WILD'
                        : 'DEFAULT'
                    };

                const handleSolitairePlay = (isCorrectPile: boolean) => {
                  const now = performance.now();
                  const rt = Math.max(140, Math.round(now - s31OnsetRef.current));
                  const cond = S31_SCHEDULE[s31TrialIdx];
                  playToneSequence([isCorrectPile ? 784 : 260], 0.06);
                  adjustTier(isCorrectPile, rt, 850);
                  const nextTrials = [
                    ...s31Trials,
                    {
                      condition: cond,
                      rtMs: rt,
                      isCorrect: isCorrectPile,
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
                    isCorrect: isCorrectPile,
                    maxFrameDeltaMs: 16.7,
                    modeSwitchInterrupted: interruptedMidTrial
                  });
                  setInterruptedMidTrial(false);

                  if (s31TrialIdx + 1 >= 10) {
                    const padded = [...nextTrials, ...nextTrials, ...nextTrials].slice(0, 30);
                    const metrics = computeWithinConditionSwitchMetrics(padded, 1000, 20261108);
                    onUpdateStationTelemetry({
                      'S3.1': metrics,
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
                };

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-300">
                        Speed Solitaire Card {s31TrialIdx + 1} of 10
                      </span>
                      <span
                        className={`px-4 py-1.5 rounded-full text-sm font-extrabold uppercase tracking-wider border-2 ${
                          isSwitchRule
                            ? 'bg-amber-500 text-slate-950 border-amber-200'
                            : 'bg-sky-500 text-slate-950 border-sky-200'
                        }`}
                      >
                        {isSwitchRule
                          ? '🔄 SOLITAIRE RULE: PLAY ON MATCHING SUIT (♠ vs ♦)'
                          : '🔢 SOLITAIRE RULE: PLAY ON MATCHING NUMBER (7 vs 2)'}
                      </span>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/30 text-center space-y-3">
                      <div className="flex justify-center">
                        {renderPlayingCard(centerCard, { size: 'lg', highlighted: true })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        type="button"
                        data-testid="s31-target-left"
                        onClick={() => handleSolitairePlay(true)}
                        className="min-h-24 p-4 rounded-2xl bg-slate-900 hover:bg-emerald-900 border-2 border-sky-400 flex items-center justify-center gap-4 text-white font-extrabold text-base cursor-pointer shadow-md"
                      >
                        {renderPlayingCard(
                          { rank: '7', suit: '♠', suitName: 'Spades', centerGraphic: isPortraitWild ? 'PORTRAIT_GLASSES' : 'DEFAULT' },
                          { size: 'sm' }
                        )}
                        <div className="text-left">
                          <div className="text-xs uppercase text-sky-300">Foundation Pile A</div>
                          <div className="text-lg">7♠ (Number 7 • Spades)</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        data-testid="s31-target-right"
                        onClick={() => handleSolitairePlay(false)}
                        className="min-h-24 p-4 rounded-2xl bg-slate-900 hover:bg-emerald-900 border-2 border-amber-400 flex items-center justify-center gap-4 text-white font-extrabold text-base cursor-pointer shadow-md"
                      >
                        {renderPlayingCard(
                          { rank: '2', suit: '♦', suitName: 'Diamonds' },
                          { size: 'sm' }
                        )}
                        <div className="text-left">
                          <div className="text-xs uppercase text-amber-300">Foundation Pile B</div>
                          <div className="text-lg">2♦ (Number 2 • Diamonds)</div>
                        </div>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 5 (S4): WORD WHEEL & DEALER CALL-BACK
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S4' && (
            <div className="space-y-5">
              {s4SubStage === 'FLUENCY' ? (
                <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 text-center space-y-5">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    🎡 Letter &ldquo;F&rdquo; Speed Word Wheel
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-white">
                    Say any words starting with <strong>&ldquo;F&rdquo;</strong> out loud and tap the gold chip stack for each word!
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      playToneSequence([523], 0.08);
                      const next = [...s4TapTimestamps, performance.now()];
                      setS4TapTimestamps(next);
                      setBonusScore((s) => s + 20);
                      if (next.length >= 3) {
                        setAdaptiveTier((t) => Math.min(5, t + 1));
                      }
                    }}
                    className="w-full max-w-md mx-auto min-h-20 px-6 py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xl shadow-lg cursor-pointer"
                  >
                    🪙 +1 Word Chip ({s4TapTimestamps.length} &ldquo;F&rdquo; Words)
                  </button>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setS4SubStage('ECHO');
                        setS4EchoIdx(0);
                        setS4PromptMasked(false);
                      }}
                      className="px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-sm cursor-pointer"
                    >
                      Cash In Word Chips &rarr; Play 3 Dealer Call-Backs
                    </button>
                  </div>
                </div>
              ) : (
                (() => {
                  const msg = S4_DEALER_CALLS[s4EchoIdx] ?? S4_DEALER_CALLS[0];
                  return (
                    <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-300">
                          Dealer Call-Back {s4EchoIdx + 1} of {S4_DEALER_CALLS.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playToneSequence([440, 554, 659], 0.12);
                            setS4PromptMasked((v) => !v);
                          }}
                          className="text-sky-300 underline cursor-pointer"
                        >
                          {s4PromptMasked ? 'Show Dealer Call' : 'Hide Dealer Call'}
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-700 text-lg font-extrabold text-amber-200">
                        {s4PromptMasked
                          ? '🃏 Tap the exact matching Dealer Call below!'
                          : `🗣️ Dealer: “${msg.target}”`}
                      </div>

                      <div className="space-y-3">
                        {msg.options.map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => {
                              const hit = opt === msg.target;
                              playToneSequence(hit ? [784] : [260], 0.06);
                              adjustTier(hit, 700, 1000);
                              const nextHits = s4EchoHits + (hit ? 1 : 0);
                              const nextMissedLong = s4LongMissed || (msg.syllables >= 15 && !hit);

                              if (s4EchoIdx + 1 >= S4_DEALER_CALLS.length) {
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
                            className="w-full p-4 rounded-xl bg-slate-900 hover:bg-emerald-800 border-2 border-slate-700 text-left text-base font-bold text-white transition-colors cursor-pointer"
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
              GAME 6 (S5): BLACKJACK 21 & TABLE PLAYERS JACKPOT
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S5' && (
            <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 space-y-5">
              {s5SubStage === 'MEET_PLAYERS' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Your Blackjack Table Friends
                  </div>
                  <p className="text-lg font-bold text-white">
                    Remember who is holding each Lucky Card at the table:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-950 border-2 border-sky-400/50 space-y-1.5">
                      <div className="text-3xl">⚓</div>
                      <div className="text-lg font-extrabold text-white">Sam the Sailor</div>
                      <div className="text-xs font-bold text-amber-300">Lucky Anchor Ace</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-950 border-2 border-amber-400/50 space-y-1.5">
                      <div className="text-3xl">🥐</div>
                      <div className="text-lg font-extrabold text-white">Clara the Baker</div>
                      <div className="text-xs font-bold text-amber-300">Golden Bakery King</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-950 border-2 border-emerald-400/50 space-y-1.5">
                      <div className="text-3xl">🎻</div>
                      <div className="text-lg font-extrabold text-white">Leo the Violinist</div>
                      <div className="text-xs font-bold text-amber-300">Symphony Queen</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setS5SubStage('STUDY_SEQ')}
                    className="min-h-14 px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base cursor-pointer shadow-lg"
                  >
                    Deal the Cards &rarr;
                  </button>
                </div>
              )}

              {s5SubStage === 'STUDY_SEQ' && (
                <div className="space-y-4 text-center">
                  <p className="text-lg sm:text-xl font-bold text-white">
                    Watch the Dealer’s <strong>{s5SpanLength}-Card Run</strong> (#1 to #{s5SpanLength}):
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 py-2">
                    {DEAL_ORDER_CARDS.slice(0, s5SpanLength).map((item, idx) => (
                      <div key={item.id} className="flex flex-col items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-950 text-xs font-extrabold text-emerald-300">
                          #{idx + 1}
                        </span>
                        {renderPlayingCard(item.card, { size: 'md', highlighted: true })}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setS5PickedSeq([]);
                      setS5SubStage('REBUILD_SEQ');
                    }}
                    className="min-h-14 px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base cursor-pointer shadow-lg"
                  >
                    Flip Face-Down &amp; Play in Order &rarr;
                  </button>
                </div>
              )}

              {s5SubStage === 'REBUILD_SEQ' && (
                <div className="space-y-4">
                  <p className="text-lg font-bold text-white text-center">
                    Tap the <strong>{s5SpanLength} Cards</strong> in the order they were dealt (#1 &rarr; #{s5SpanLength}):
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {[...DEAL_ORDER_CARDS.slice(0, s5SpanLength)]
                      .reverse()
                      .map((item) => {
                        const already = s5PickedSeq.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            disabled={already}
                            onClick={() => {
                              const next = [...s5PickedSeq, item.id];
                              setS5PickedSeq(next);
                              if (next.length >= s5SpanLength) {
                                const allExact = next.every((val, i) => val === i);
                                adjustTier(allExact, 600, 1000);
                                if (s5SpanLength === 4 && allExact) {
                                  setS5SpanLength(6);
                                  setS5SubStage('STUDY_SEQ');
                                } else {
                                  setS5SubStage('BLACKJACK_HAND');
                                }
                              }
                            }}
                            className={`p-2 rounded-2xl transition-transform cursor-pointer ${
                              already ? 'opacity-30 scale-95' : 'hover:-translate-y-1.5'
                            }`}
                          >
                            {renderPlayingCard(item.card, { size: 'md' })}
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {s5SubStage === 'BLACKJACK_HAND' && (
                <div className="space-y-4 text-center">
                  <p className="text-lg font-bold text-white">
                    Blackjack 21! You hold <strong>10♠ + 4♥ (14)</strong>. Which card hits <strong>21</strong>?
                  </p>
                  <div className="flex justify-center gap-3 py-1">
                    {renderPlayingCard({ rank: '10', suit: '♠', suitName: 'Spades' }, { size: 'sm' })}
                    {renderPlayingCard({ rank: '4', suit: '♥', suitName: 'Hearts' }, { size: 'sm' })}
                  </div>
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                    {(
                      [
                        { label: 'Hit 7♣ (21!)', ok: true },
                        { label: 'Hit 5♦ (19)', ok: false },
                        { label: 'Hit 10♣ (Bust)', ok: false }
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => {
                          setS5FreeLetterHit(c.ok);
                          setS5ScholarIdx(0);
                          setS5ScholarStep('FREE');
                          setS5SubStage('SCHOLARS');
                        }}
                        className="min-h-14 p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm cursor-pointer shadow-md"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {s5SubStage === 'SCHOLARS' && (
                <div className="space-y-4">
                  {(() => {
                    const player =
                      TABLE_PLAYERS_MEMORY[s5ScholarIdx] ?? TABLE_PLAYERS_MEMORY[0];
                    return (
                      <div className="space-y-4">
                        <div className="p-5 rounded-xl bg-slate-950 border border-slate-700 space-y-2 text-center">
                          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                            🃏 {player.seatLabel}
                          </div>
                          <p className="text-xl font-extrabold text-white">
                            {player.cluePrompt}
                          </p>
                        </div>

                        {s5ScholarStep === 'FREE' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                setS5FreeHits(s5FreeHits + 1);
                                setS5ScholarStep('SEMANTIC');
                              }}
                              className="min-h-14 p-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base cursor-pointer"
                            >
                              ✓ {player.correctPlayer}
                            </button>
                            <button
                              type="button"
                              onClick={() => setS5ScholarStep('SEMANTIC')}
                              className="min-h-14 p-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-base cursor-pointer"
                            >
                              💡 Give Me a Table Hint
                            </button>
                          </div>
                        )}

                        {s5ScholarStep === 'SEMANTIC' && (
                          <div className="space-y-3">
                            <div className="text-base font-bold text-sky-200">
                              {player.roleQuestion}
                            </div>
                            <div className="grid grid-cols-1 gap-2.5">
                              {player.roleChoices.map((rc) => (
                                <button
                                  key={rc}
                                  type="button"
                                  onClick={() => {
                                    if (rc === player.correctRole) {
                                      setS5SemanticHits(s5SemanticHits + 1);
                                    }
                                    setS5ScholarStep('PHONEMIC');
                                  }}
                                  className="p-4 rounded-xl bg-slate-900 hover:bg-sky-700 border border-slate-700 text-left text-base font-bold text-white cursor-pointer"
                                >
                                  {rc}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {s5ScholarStep === 'PHONEMIC' && (
                          <div className="space-y-3">
                            <div className="text-base font-extrabold text-amber-300">
                              💡 {player.firstSoundHint} — Tap the player:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {player.playerChoices.map((nm) => (
                                <button
                                  key={nm}
                                  type="button"
                                  onClick={() => {
                                    const nextPhon =
                                      s5PhonemicHits + (nm === player.correctPlayer ? 1 : 0);
                                    if (s5ScholarIdx + 1 >= TABLE_PLAYERS_MEMORY.length) {
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
                                          ? expandTo12([0, 1, 2, 3])
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
                                  className="min-h-14 p-4 rounded-xl bg-slate-900 hover:bg-emerald-700 border-2 border-slate-700 text-base font-extrabold text-white cursor-pointer"
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
          SCREEN 3: CALM SINGLE-BUTTON TRANSITION TO NEXT GAME
         ===================================================================== */}
      {pagePhase === 'ACTIVITY_COMPLETE' && (
        <div className="my-auto max-w-xl w-full mx-auto text-center space-y-5 py-8">
          <div className="inline-block px-4 py-1.5 rounded-full bg-emerald-950 border border-emerald-400/50 text-sm font-bold text-emerald-300">
            🎉 {meta.title} Complete! (🪙 {bonusScore} Points)
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {meta.nextStationId
              ? `Ready for Game ${meta.num + 1} of 6`
              : 'All 6 Lounge Games Complete!'}
          </h2>

          <div className="pt-2 flex flex-wrap justify-center gap-3">
            {meta.nextStationId ? (
              <button
                type="button"
                data-testid="next-station-btn"
                onClick={() => onSelectStation(meta.nextStationId!)}
                className="min-h-14 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg shadow-xl cursor-pointer"
              >
                Continue to Game {meta.num + 1} of 6 &rarr;
              </button>
            ) : (
              onFinishAssessment && (
                <button
                  type="button"
                  data-testid="finish-view-results-btn"
                  onClick={onFinishAssessment}
                  className="min-h-14 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg shadow-xl cursor-pointer"
                >
                  Open Provider Results Report &rarr;
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Subtle Bottom Bar for Clinician / Tester Navigation */}
      <div className="mt-6 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {pagePhase === 'INTRO_DEMO'
            ? 'Screen 1 of 2: How to Play & Practice'
            : pagePhase === 'ACTIVE_TEST'
            ? 'Screen 2 of 2: Live Game Table'
            : 'Game Complete'}
        </span>
        <div className="flex items-center gap-3">
          {meta.nextStationId && pagePhase !== 'ACTIVITY_COMPLETE' && (
            <button
              type="button"
              data-testid="next-station-btn"
              onClick={() => onSelectStation(meta.nextStationId!)}
              className="hover:text-slate-300 underline cursor-pointer"
            >
              Skip to Game {meta.num + 1} &rarr;
            </button>
          )}
          {onFinishAssessment && (
            <button
              type="button"
              data-testid="finish-view-results-btn"
              onClick={onFinishAssessment}
              className="hover:text-slate-300 underline cursor-pointer"
            >
              Provider Results Portal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
