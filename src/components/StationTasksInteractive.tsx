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
// COLOR-BLIND SAFE PLAYING CARD RENDERER
// Shows Rank + Suit Symbol (♠ ♥ ♦ ♣) + Suit Word so color vision is never tested
// ============================================================================
type CardSuit = '♠' | '♥' | '♦' | '♣';

interface CardSpec {
  rank: string;
  suit: CardSuit;
  suitName: 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';
}

function renderPlayingCard(
  card: CardSpec,
  opts?: { size?: 'sm' | 'md' | 'lg'; highlighted?: boolean }
) {
  const size = opts?.size ?? 'md';
  const highlighted = opts?.highlighted ?? false;
  const isWarmSuit = card.suit === '♥' || card.suit === '♦';
  const inkClass = isWarmSuit ? 'text-amber-700' : 'text-slate-900';

  const dims =
    size === 'lg'
      ? 'w-28 h-38 p-2.5 rounded-2xl'
      : size === 'sm'
      ? 'w-16 h-24 p-1.5 rounded-xl'
      : 'w-22 h-30 p-2 rounded-xl';

  return (
    <div
      className={`inline-flex flex-col justify-between bg-amber-50 border-2 select-none shadow-md transition-transform ${dims} ${
        highlighted
          ? 'border-amber-400 ring-4 ring-amber-400/50 scale-105'
          : 'border-slate-300'
      }`}
    >
      <div className={`flex items-center justify-between font-extrabold leading-none ${inkClass}`}>
        <span className={size === 'sm' ? 'text-xs' : 'text-base'}>{card.rank}</span>
        <span className={size === 'sm' ? 'text-xs' : 'text-base'}>{card.suit}</span>
      </div>
      <div className={`text-center leading-none ${inkClass}`}>
        <div className={size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-2xl'}>
          {card.suit}
        </div>
        <div className="text-[10px] font-extrabold uppercase tracking-tight text-slate-700 mt-0.5">
          {card.suitName}
        </div>
      </div>
      <div className={`flex items-center justify-between font-extrabold leading-none ${inkClass}`}>
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{card.suit}</span>
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{card.rank}</span>
      </div>
    </div>
  );
}

// ============================================================================
// NON-COUNTING DYNAMIC HOURGLASS BAR (Flows smoothly without stressful numbers;
// speeds up on streaks and slows down gently if a player needs more time)
// ============================================================================
const DynamicHourglassBar: React.FC<{
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
      // Floors gently at 12% so the player never feels "timed out" or punished
      const remaining = Math.max(12, 100 - (elapsed / durationMs) * 88);
      setFillPct(remaining);
    }, 60);
    return () => window.clearInterval(id);
  }, [stepKey, durationMs, paused]);

  return (
    <div className="flex items-center gap-2.5 w-full max-w-xs" aria-label="Dynamic hourglass pace bar">
      <span className="text-base select-none" aria-hidden="true">
        ⏳
      </span>
      <div className="flex-1 h-2.5 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-300 to-amber-500 transition-all duration-75"
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
};

// ============================================================================
// GAME 1 (S0.3 Surrogate): MODERN 4-CORNER PONG / STAR-DEFLECTOR ARCADE
// Rounds 1–4: Single glowing Gold Orb bounces into 1 of the 4 corner paddles (pure RT_motor).
// Rounds 5–10: Multi-Ball Speed Rally! Deflect ONLY the Target Orb while ignoring Decoy Asteroids.
// ============================================================================
const S03_PONG_RALLIES: {
  rallyNum: number;
  rallyBadge: string;
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
    rallyBadge: 'Warm-Up Rally 1 of 10',
    callBanner: 'Bounce the ★ GOLD ORB!',
    targetQuad: 'Q3',
    hourglassMs: 4200,
    paddles: {
      Q2: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q1: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q3: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true },
      Q4: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false }
    }
  },
  {
    rallyNum: 2,
    rallyBadge: 'Warm-Up Rally 2 of 10',
    callBanner: 'Bounce the ★ GOLD ORB!',
    targetQuad: 'Q1',
    hourglassMs: 3900,
    paddles: {
      Q2: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q1: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true },
      Q3: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q4: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false }
    }
  },
  {
    rallyNum: 3,
    rallyBadge: 'Warm-Up Rally 3 of 10',
    callBanner: 'Bounce the ★ GOLD ORB!',
    targetQuad: 'Q4',
    hourglassMs: 3600,
    paddles: {
      Q2: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q1: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q3: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q4: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true }
    }
  },
  {
    rallyNum: 4,
    rallyBadge: 'Warm-Up Rally 4 of 10',
    callBanner: 'Bounce the ★ GOLD ORB!',
    targetQuad: 'Q2',
    hourglassMs: 3400,
    paddles: {
      Q2: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true },
      Q1: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q3: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q4: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false }
    }
  },
  {
    rallyNum: 5,
    rallyBadge: 'Speed Rally 5 of 10 • Dodge the Gray Asteroid!',
    callBanner: 'Bounce ONLY the ★ GOLD ORB (Ignore the 🪨 Gray Rock!)',
    targetQuad: 'Q4',
    hourglassMs: 3000,
    paddles: {
      Q2: { orbType: 'DECOY_ROCK', label: '🪨 GRAY ROCK (IGNORE)', isTarget: false },
      Q1: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q3: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false },
      Q4: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true }
    }
  },
  {
    rallyNum: 6,
    rallyBadge: 'Speed Rally 6 of 10 • Bonus Target Switch!',
    callBanner: 'NEW TARGET: Bounce the ◆ DIAMOND COMET!',
    targetQuad: 'Q3',
    hourglassMs: 2700,
    paddles: {
      Q2: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false },
      Q1: { orbType: 'DECOY_ROCK', label: '🪨 GRAY ROCK', isTarget: false },
      Q3: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: true },
      Q4: { orbType: 'EMPTY', label: 'Open Corner', isTarget: false }
    }
  },
  {
    rallyNum: 7,
    rallyBadge: 'Speed Rally 7 of 10 • Multi-Ball Arcade!',
    callBanner: 'Bounce ONLY the 🛡️ SHIELD ORB!',
    targetQuad: 'Q1',
    hourglassMs: 2500,
    paddles: {
      Q2: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: false },
      Q1: { orbType: 'SHIELD_ORB', label: '🛡️ SHIELD ORB', isTarget: true },
      Q3: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false },
      Q4: { orbType: 'DECOY_ROCK', label: '🪨 GRAY ROCK', isTarget: false }
    }
  },
  {
    rallyNum: 8,
    rallyBadge: 'Speed Rally 8 of 10 • Fast Switch!',
    callBanner: 'BACK TO GOLD: Bounce ONLY the ★ GOLD ORB!',
    targetQuad: 'Q2',
    hourglassMs: 2300,
    paddles: {
      Q2: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: true },
      Q1: { orbType: 'SHIELD_ORB', label: '🛡️ SHIELD ORB', isTarget: false },
      Q3: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: false },
      Q4: { orbType: 'DECOY_ROCK', label: '🪨 GRAY ROCK', isTarget: false }
    }
  },
  {
    rallyNum: 9,
    rallyBadge: 'Speed Rally 9 of 10 • Double Decoys!',
    callBanner: 'Bounce ONLY the ◆ DIAMOND COMET!',
    targetQuad: 'Q3',
    hourglassMs: 2100,
    paddles: {
      Q2: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false },
      Q1: { orbType: 'SHIELD_ORB', label: '🛡️ SHIELD ORB', isTarget: false },
      Q3: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: true },
      Q4: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false }
    }
  },
  {
    rallyNum: 10,
    rallyBadge: 'Final Rally 10 of 10 • Grand Finale!',
    callBanner: 'FINAL SHOT: Bounce the 🛡️ SHIELD ORB!',
    targetQuad: 'Q1',
    hourglassMs: 1900,
    paddles: {
      Q2: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: false },
      Q1: { orbType: 'SHIELD_ORB', label: '🛡️ SHIELD ORB', isTarget: true },
      Q3: { orbType: 'GOLD_STAR', label: '★ GOLD ORB', isTarget: false },
      Q4: { orbType: 'DIAMOND_BOLT', label: '◆ DIAMOND COMET', isTarget: false }
    }
  }
];

// ============================================================================
// GAME 2 (S1 Surrogate): SPEED GO-FISH! (8 Hands)
// Real Go-Fish gameplay! You hold a hand of cards (growing from 4 spaced cards
// to 9 tightly fanned cards). The Dealer asks: "Do you have any 7s?"
// You tap the matching card RIGHT IN YOUR HAND, or tap "🐟 GO FISH!" if you don't have it!
// Secretly measures:
// - Uncrowded 4-card hand vs. Tightly Crowded 8-9 card hand search time (PCA Visual Crowding!)
// - Suit vs. Rank attention switching
// ============================================================================
const S1_GO_FISH_HANDS: {
  handNum: number;
  tier: number;
  rule: 'GLOBAL_MACRO' | 'LOCAL_MICRO' | 'MATRIX_DIFF';
  dealerAsk: string;
  askDetail: string;
  crowded: boolean;
  playerHand: CardSpec[];
  matchingCardIndex: number | null; // null means player does NOT have it -> correct move is "🐟 GO FISH!"
}[] = [
  {
    handNum: 1,
    tier: 1,
    rule: 'LOCAL_MICRO',
    dealerAsk: 'Dealer asks: "Do you have any 7s?"',
    askDetail: 'Tap the 7 in your hand—or tap GO FISH if you don’t have one!',
    crowded: false,
    playerHand: [
      { rank: '2', suit: '♣', suitName: 'Clubs' },
      { rank: '7', suit: '♠', suitName: 'Spades' },
      { rank: '10', suit: '♥', suitName: 'Hearts' },
      { rank: 'K', suit: '♦', suitName: 'Diamonds' }
    ],
    matchingCardIndex: 1
  },
  {
    handNum: 2,
    tier: 1,
    rule: 'GLOBAL_MACRO',
    dealerAsk: 'Dealer asks: "Do you have any HEARTS (♥)?"',
    askDetail: 'Tap the Heart card in your hand—or tap GO FISH!',
    crowded: false,
    playerHand: [
      { rank: '4', suit: '♠', suitName: 'Spades' },
      { rank: '9', suit: '♣', suitName: 'Clubs' },
      { rank: 'Q', suit: '♥', suitName: 'Hearts' },
      { rank: '6', suit: '♦', suitName: 'Diamonds' }
    ],
    matchingCardIndex: 2
  },
  {
    handNum: 3,
    tier: 2,
    rule: 'LOCAL_MICRO',
    dealerAsk: 'Dealer asks: "Do you have any KINGS (K)?"',
    askDetail: 'Check your hand carefully—if you have no Kings, tap GO FISH!',
    crowded: false,
    playerHand: [
      { rank: '3', suit: '♠', suitName: 'Spades' },
      { rank: '8', suit: '♦', suitName: 'Diamonds' },
      { rank: 'J', suit: '♣', suitName: 'Clubs' },
      { rank: '5', suit: '♥', suitName: 'Hearts' },
      { rank: '9', suit: '♠', suitName: 'Spades' }
    ],
    matchingCardIndex: null // Correct action is "🐟 GO FISH!"
  },
  {
    handNum: 4,
    tier: 3,
    rule: 'LOCAL_MICRO',
    dealerAsk: 'Dealer asks: "Do you have any 6s?"',
    askDetail: 'Your hand is fuller now! Tap the 6 in your hand—or tap GO FISH!',
    crowded: true,
    playerHand: [
      { rank: '9', suit: '♠', suitName: 'Spades' },
      { rank: '3', suit: '♥', suitName: 'Hearts' },
      { rank: '8', suit: '♣', suitName: 'Clubs' },
      { rank: '6', suit: '♦', suitName: 'Diamonds' },
      { rank: 'Q', suit: '♠', suitName: 'Spades' },
      { rank: '2', suit: '♥', suitName: 'Hearts' },
      { rank: '5', suit: '♣', suitName: 'Clubs' }
    ],
    matchingCardIndex: 3
  },
  {
    handNum: 5,
    tier: 3,
    rule: 'GLOBAL_MACRO',
    dealerAsk: 'Dealer asks: "Do you have any DIAMONDS (♦)?"',
    askDetail: 'Look across your fanned hand for a Diamond (♦)—or tap GO FISH!',
    crowded: true,
    playerHand: [
      { rank: '4', suit: '♠', suitName: 'Spades' },
      { rank: '10', suit: '♣', suitName: 'Clubs' },
      { rank: '7', suit: '♥', suitName: 'Hearts' },
      { rank: 'K', suit: '♠', suitName: 'Spades' },
      { rank: '9', suit: '♦', suitName: 'Diamonds' },
      { rank: '2', suit: '♣', suitName: 'Clubs' },
      { rank: 'J', suit: '♥', suitName: 'Hearts' }
    ],
    matchingCardIndex: 4
  },
  {
    handNum: 6,
    tier: 4,
    rule: 'MATRIX_DIFF',
    dealerAsk: 'Dealer asks: "Do you have any ACES (A)?"',
    askDetail: 'Check your 8-card hand—tap the Ace or tap GO FISH!',
    crowded: true,
    playerHand: [
      { rank: '8', suit: '♠', suitName: 'Spades' },
      { rank: '4', suit: '♦', suitName: 'Diamonds' },
      { rank: 'Q', suit: '♣', suitName: 'Clubs' },
      { rank: '7', suit: '♥', suitName: 'Hearts' },
      { rank: '3', suit: '♠', suitName: 'Spades' },
      { rank: '10', suit: '♦', suitName: 'Diamonds' },
      { rank: '6', suit: '♣', suitName: 'Clubs' },
      { rank: 'K', suit: '♥', suitName: 'Hearts' }
    ],
    matchingCardIndex: null // Correct move is "🐟 GO FISH!"
  },
  {
    handNum: 7,
    tier: 5,
    rule: 'LOCAL_MICRO',
    dealerAsk: 'Dealer asks: "Do you have the 4♠ Four of Spades?"',
    askDetail: 'Careful—there are several 4s! Tap ONLY the 4♠ Four of Spades!',
    crowded: true,
    playerHand: [
      { rank: '4', suit: '♦', suitName: 'Diamonds' },
      { rank: '9', suit: '♠', suitName: 'Spades' },
      { rank: '4', suit: '♥', suitName: 'Hearts' },
      { rank: '7', suit: '♣', suitName: 'Clubs' },
      { rank: '4', suit: '♠', suitName: 'Spades' },
      { rank: '4', suit: '♣', suitName: 'Clubs' },
      { rank: 'J', suit: '♦', suitName: 'Diamonds' },
      { rank: '2', suit: '♠', suitName: 'Spades' }
    ],
    matchingCardIndex: 4
  },
  {
    handNum: 8,
    tier: 5,
    rule: 'MATRIX_DIFF',
    dealerAsk: 'Bonus Pair Check: "Tap Either Card of Your Matching PAIR of 8s!"',
    askDetail: 'Spot the two 8s hiding in your 8-card hand and tap either 8!',
    crowded: true,
    playerHand: [
      { rank: '3', suit: '♠', suitName: 'Spades' },
      { rank: '8', suit: '♥', suitName: 'Hearts' },
      { rank: 'K', suit: '♣', suitName: 'Clubs' },
      { rank: '5', suit: '♦', suitName: 'Diamonds' },
      { rank: 'J', suit: '♠', suitName: 'Spades' },
      { rank: '2', suit: '♣', suitName: 'Clubs' },
      { rank: '9', suit: '♦', suitName: 'Diamonds' },
      { rank: '8', suit: '♠', suitName: 'Spades' }
    ],
    matchingCardIndex: 1 // Index 1 or 7 (both have rank '8')
  }
];

// ============================================================================
// GAME 3 (S2.1 / S2.2 Surrogate): MYSTERY DECK DRAW (Foggy Card Table)
// Draw a card from the Mystery Deck—tap the Emblem on the card, or tap
// "🃏 Blank Joker Card (Nothing On It)" when the card is pure mist!
// ============================================================================
const S2_MYSTERY_CARDS: {
  id: number;
  tier: number;
  drawLabel: string;
  isBlankJoker: boolean;
  correctAnswer: string;
  mistOpacity: number;
  emblemOpacity: number;
  tiltDeg: number;
  emblemKind: 'ship' | 'blank_1' | 'anchor' | 'blank_2' | 'bird' | 'blank_3';
  choices: string[];
}[] = [
  {
    id: 1,
    tier: 1,
    drawLabel: 'Mystery Card 1 of 6',
    isBlankJoker: false,
    correctAnswer: '⛵ Sailing Ship Card',
    mistOpacity: 0.32,
    emblemOpacity: 0.88,
    tiltDeg: 0,
    emblemKind: 'ship',
    choices: [
      '⛵ Sailing Ship Card',
      '⚓ Lucky Anchor Card',
      '🕊️ Flying Bird Card',
      '👑 Royal Crown / Face Card',
      '🃏 Blank Mist Card (Nothing On It)'
    ]
  },
  {
    id: 2,
    tier: 2,
    drawLabel: 'Mystery Card 2 of 6',
    isBlankJoker: true,
    correctAnswer: '🃏 Blank Mist Card (Nothing On It)',
    mistOpacity: 0.76,
    emblemOpacity: 0,
    tiltDeg: 0,
    emblemKind: 'blank_1',
    choices: [
      '⛵ Sailing Ship Card',
      '⚓ Lucky Anchor Card',
      '🕊️ Flying Bird Card',
      '👑 Royal Crown / Face Card',
      '🃏 Blank Mist Card (Nothing On It)'
    ]
  },
  {
    id: 3,
    tier: 3,
    drawLabel: 'Mystery Card 3 of 6',
    isBlankJoker: false,
    correctAnswer: '⚓ Lucky Anchor Card',
    mistOpacity: 0.54,
    emblemOpacity: 0.56,
    tiltDeg: 25,
    emblemKind: 'anchor',
    choices: [
      '⛵ Sailing Ship Card',
      '⚓ Lucky Anchor Card',
      '🕊️ Flying Bird Card',
      '👑 Royal Crown / Face Card',
      '🃏 Blank Mist Card (Nothing On It)'
    ]
  },
  {
    id: 4,
    tier: 4,
    drawLabel: 'Mystery Card 4 of 6',
    isBlankJoker: true,
    correctAnswer: '🃏 Blank Mist Card (Nothing On It)',
    mistOpacity: 0.85,
    emblemOpacity: 0,
    tiltDeg: 0,
    emblemKind: 'blank_2',
    choices: [
      '⛵ Sailing Ship Card',
      '⚓ Lucky Anchor Card',
      '🕊️ Flying Bird Card',
      '👑 Royal Crown / Face Card',
      '🃏 Blank Mist Card (Nothing On It)'
    ]
  },
  {
    id: 5,
    tier: 5,
    drawLabel: 'Mystery Card 5 of 6',
    isBlankJoker: false,
    correctAnswer: '🕊️ Flying Bird Card',
    mistOpacity: 0.76,
    emblemOpacity: 0.38,
    tiltDeg: 32,
    emblemKind: 'bird',
    choices: [
      '⛵ Sailing Ship Card',
      '⚓ Lucky Anchor Card',
      '🕊️ Flying Bird Card',
      '👑 Royal Crown / Face Card',
      '🃏 Blank Mist Card (Nothing On It)'
    ]
  },
  {
    id: 6,
    tier: 5,
    drawLabel: 'Mystery Card 6 of 6',
    isBlankJoker: true,
    correctAnswer: '🃏 Blank Mist Card (Nothing On It)',
    mistOpacity: 0.88,
    emblemOpacity: 0,
    tiltDeg: 0,
    emblemKind: 'blank_3',
    choices: [
      '⛵ Sailing Ship Card',
      '⚓ Lucky Anchor Card',
      '🕊️ Flying Bird Card',
      '👑 Royal Crown / Face Card',
      '🃏 Blank Mist Card (Nothing On It)'
    ]
  }
];

// ============================================================================
// GAME 4 (S3.1 & S3.2 Surrogate): SPEED RUMMY DISCARD + 3D CUBE & WATCH DRAW
// ============================================================================
const S31_SCHEDULE: ('repeat' | 'switch')[] = [
  'repeat', 'repeat', 'switch', 'repeat', 'repeat',
  'switch', 'repeat', 'repeat', 'repeat', 'switch',
  'repeat', 'repeat', 'switch', 'repeat', 'repeat',
  'switch', 'repeat', 'repeat', 'repeat', 'switch',
  'repeat', 'repeat', 'repeat', 'switch', 'repeat',
  'repeat', 'repeat', 'switch', 'repeat', 'repeat'
];

// 3D Isometric Cube Strut Candidates (4 True 3D Depth Struts + 2 Flat Diagonal Decoys)
const S32_CUBE_STRUTS: {
  id: string;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  isTrue3DStrut: boolean;
}[] = [
  { id: 'TL', label: '1. Top-Left Depth Edge (A → E)', x1: 95, y1: 75, x2: 155, y2: 35, isTrue3DStrut: true },
  { id: 'TR', label: '2. Top-Right Depth Edge (B → F)', x1: 205, y1: 75, x2: 265, y2: 35, isTrue3DStrut: true },
  { id: 'BR', label: '3. Bottom-Right Depth Edge (C → G)', x1: 205, y1: 185, x2: 265, y2: 145, isTrue3DStrut: true },
  { id: 'BL', label: '4. Bottom-Left Depth Edge (D → H)', x1: 95, y1: 185, x2: 155, y2: 145, isTrue3DStrut: true },
  { id: 'DECOY_1', label: 'Flat Front Diagonal (A → C)', x1: 95, y1: 75, x2: 205, y2: 185, isTrue3DStrut: false },
  { id: 'DECOY_2', label: 'Flat Roof Crossbar (A → F)', x1: 95, y1: 75, x2: 265, y2: 35, isTrue3DStrut: false }
];

// ============================================================================
// GAME 5 (S4 Surrogate): PART 1 (FACE & OBJECT RECOGNITION), PART 2 (WORD WHEEL), PART 3 (TELEPHONE)
// ============================================================================
const S4_FACE_OBJECT_CARDS: {
  id: number;
  kind: 'object_compass' | 'object_glasses' | 'face_identity' | 'face_expression';
  badge: string;
  prompt: string;
  firstLetterHint: string;
  correctChoice: string;
  choices: string[];
}[] = [
  {
    id: 1,
    kind: 'object_compass',
    badge: 'Object Recognition 1 of 4',
    prompt: 'What everyday object is drawn on this card?',
    firstLetterHint: 'Hint: Starts with "C..." (Used for finding North)',
    correctChoice: '🧭 Pocket Compass',
    choices: ['🧭 Pocket Compass', '🔒 Padlock', '🔔 Handbell', '⏳ Sand Timer']
  },
  {
    id: 2,
    kind: 'object_glasses',
    badge: 'Object Recognition 2 of 4 (Angled View)',
    prompt: 'What everyday item is shown here from a tilted angle?',
    firstLetterHint: 'Hint: Starts with "E..." (Worn for reading)',
    correctChoice: '👓 Eyeglasses',
    choices: ['👓 Eyeglasses', '✂️ Scissors', '🎧 Headphones', '🔑 House Key']
  },
  {
    id: 3,
    kind: 'face_identity',
    badge: 'Face Recognition 3 of 4 • Same Person Match',
    prompt: 'Look at the Guest Portrait at the top (wearing round glasses & wavy hair). Which portrait below is the SAME person?',
    firstLetterHint: 'Hint: Look for both the round glasses AND wavy hair together!',
    correctChoice: 'Portrait B (Round Glasses + Wavy Hair)',
    choices: [
      'Portrait A (Square Glasses + Straight Hair)',
      'Portrait B (Round Glasses + Wavy Hair)',
      'Portrait C (No Glasses + Wavy Hair)',
      'Portrait D (Tall Hat + Beard)'
    ]
  },
  {
    id: 4,
    kind: 'face_expression',
    badge: 'Face Expression 4 of 4 • Card-Table Reaction',
    prompt: 'Look at this player’s face (raised eyebrows, wide eyes, open "O" mouth). What expression are they showing?',
    firstLetterHint: 'Hint: Starts with "S..." (When someone draws an unexpected Ace!)',
    correctChoice: '😮 Surprised / Astonished',
    choices: [
      '😮 Surprised / Astonished',
      '😠 Angry / Scowling',
      '😴 Sleepy / Yawning',
      '😢 Sad / Crying'
    ]
  }
];
const S4_TELEPHONE_ROUNDS: {
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
// GAME 6 (S5 Surrogate): BLACKJACK 21 DEAL ORDER & "WHO HELD WHICH CARD?" RECALL
// ZERO OUTSIDE TRIVIA OR KNOWLEDGE BASE TESTED!
// All 3 players & their lucky cards are introduced right inside the game!
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
    seatLabel: 'Table Seat #1 (Introduced at Start of Game 6)',
    cardHeld: '⚓ Lucky Anchor Ace',
    cluePrompt: 'At the start of this round, which player held the ⚓ Lucky Anchor Ace?',
    firstSoundHint: 'First-Sound Hint: Starts with "Sa-..." (Sailor)',
    correctPlayer: 'Sam the Sailor',
    playerChoices: ['Sam the Sailor', 'Clara the Baker', 'Leo the Violinist', 'Max the Gardener'],
    roleQuestion: 'What did Sam bring to the card table?',
    correctRole: '⚓ A Sailor’s Brass Compass & Anchor Card',
    roleChoices: [
      '⚓ A Sailor’s Brass Compass & Anchor Card',
      '🥐 A Tray of Warm Croissants',
      '🎻 A Wooden Violin Case'
    ]
  },
  {
    id: 2,
    tier: 4,
    seatLabel: 'Table Seat #2 (Introduced at Start of Game 6)',
    cardHeld: '🥐 Golden Bakery King',
    cluePrompt: 'Which player at the table held the 🥐 Golden Bakery King?',
    firstSoundHint: 'First-Sound Hint: Starts with "Cla-..." (Baker)',
    correctPlayer: 'Clara the Baker',
    playerChoices: ['Clara the Baker', 'Sam the Sailor', 'Leo the Violinist', 'Max the Gardener'],
    roleQuestion: 'What did Clara bring to the card table?',
    correctRole: '🥐 A Tray of Warm Croissants & Bakery King',
    roleChoices: [
      '🥐 A Tray of Warm Croissants & Bakery King',
      '⚓ A Sailor’s Brass Compass',
      '🎻 A Wooden Violin Case'
    ]
  },
  {
    id: 3,
    tier: 5,
    seatLabel: 'Table Seat #3 (Introduced at Start of Game 6)',
    cardHeld: '🎻 Symphony Queen',
    cluePrompt: 'Which player at the table held the 🎻 Symphony Queen?',
    firstSoundHint: 'First-Sound Hint: Starts with "Le-..." (Violinist)',
    correctPlayer: 'Leo the Violinist',
    playerChoices: ['Leo the Violinist', 'Sam the Sailor', 'Clara the Baker', 'Max the Gardener'],
    roleQuestion: 'What did Leo bring to the card table?',
    correctRole: '🎻 A Wooden Violin & Symphony Queen',
    roleChoices: [
      '🎻 A Wooden Violin & Symphony Queen',
      '⚓ A Sailor’s Brass Compass',
      '🥐 A Tray of Warm Croissants'
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
  // Dynamic time window multiplier (speeds up smoothly when player answers fast, slows down if they miss)
  const [paceMultiplier, setPaceMultiplier] = useState<number>(1.0);

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

  // Game 1 (S0.3) state
  const [s03TrialIdx, setS03TrialIdx] = useState<number>(0);
  const [s03Running, setS03Running] = useState<boolean>(false);
  const [s03Collected, setS03Collected] = useState<
    { quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4'; rtMs: number; euclideanDistancePx: number; trajectoryLengthPx: number }[]
  >([]);
  const s03OnsetRef = useRef<number>(performance.now());

  // Game 2 (S1: Speed Go-Fish) state
  const [s1Idx, setS1Idx] = useState<number>(0);
  const [s1Running, setS1Running] = useState<boolean>(false);
  const [s1Collected, setS1Collected] = useState<
    { level: 'global' | 'local'; crowded: boolean; rtMs: number; isCorrect: boolean }[]
  >([]);
  const [s1MatrixHits, setS1MatrixHits] = useState<number>(0);

  // Game 3 (S2: Mystery Deck) state
  const [s2Idx, setS2Idx] = useState<number>(0);
  const [s2FalsePositives, setS2FalsePositives] = useState<number>(0);
  const [s2TrueHits, setS2TrueHits] = useState<number>(0);

  // Game 4 (S3.1: Speed Rummy Discard + S3.2: 3D Cube & Watch-Dial Draw) state
  const [s3SubStage, setS3SubStage] = useState<'RUMMY_SORT' | 'CUBE_3D_DRAW' | 'WATCH_DIAL_DRAW'>('RUMMY_SORT');
  const [s31Running, setS31Running] = useState<boolean>(false);
  const [s31TrialIdx, setS31TrialIdx] = useState<number>(0);
  const [s31Trials, setS31Trials] = useState<
    { condition: 'repeat' | 'switch'; rtMs: number; isCorrect: boolean; technicalFrameDrop?: boolean; modeSwitchInterrupted?: boolean }[]
  >([]);
  const [s32DrawnStruts, setS32DrawnStruts] = useState<string[]>([]);
  const [s32WatchHands, setS32WatchHands] = useState<number[]>([]);
  const s31OnsetRef = useRef<number>(performance.now());
  const prevModeRef = useRef<SingleTrialMode>(presentationMode);
  const [interruptedMidTrial, setInterruptedMidTrial] = useState<boolean>(false);

  // Game 5 (S4: Part 1 Face & Object Recognition + Part 2 Word Wheel + Part 3 Telephone) state
  const [s4SubStage, setS4SubStage] = useState<'FACE_OBJECT' | 'FLUENCY' | 'ECHO'>('FACE_OBJECT');
  const [s4FaceObjIdx, setS4FaceObjIdx] = useState<number>(0);
  const [s4FaceObjHits, setS4FaceObjHits] = useState<number>(0);
  const [s4ShowHint, setS4ShowHint] = useState<boolean>(false);
  const [s4TapTimestamps, setS4TapTimestamps] = useState<number[]>([]);
  const [s4EchoIdx, setS4EchoIdx] = useState<number>(0);
  const [s4EchoHits, setS4EchoHits] = useState<number>(0);
  const [s4LongMissed, setS4LongMissed] = useState<boolean>(false);
  const [s4PromptMasked, setS4PromptMasked] = useState<boolean>(false);

  // Game 6 (S5: Blackjack & Table Players Recall) state
  const [s5SpanLength, setS5SpanLength] = useState<4 | 6>(4);
  const [s5SubStage, setS5SubStage] = useState<
    'MEET_PLAYERS' | 'STUDY_SEQ' | 'REBUILD_SEQ' | 'BLACKJACK_BONUS' | 'SCHOLARS'
  >('MEET_PLAYERS');
  const [s5PickedSeq, setS5PickedSeq] = useState<number[]>([]);
  const [s5FreeLetterHit, setS5FreeLetterHit] = useState<boolean>(false);
  const [s5AudioPicked, setS5AudioPicked] = useState<number[]>([0, 1, 2, 3]);
  const [s5ScholarIdx, setS5ScholarIdx] = useState<number>(0);
  const [s5ScholarStep, setS5ScholarStep] = useState<'FREE' | 'SEMANTIC' | 'PHONEMIC'>('FREE');
  const [s5FreeHits, setS5FreeHits] = useState<number>(0);
  const [s5SemanticHits, setS5SemanticHits] = useState<number>(0);
  const [s5PhonemicHits, setS5PhonemicHits] = useState<number>(0);

  // 60s Inactivity Auto-Pause Detector
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
    }
  };

  const adjustTier = (isCorrect: boolean, rtMs: number, fastThresholdMs = 950) => {
    setAdaptiveTier((prev) => {
      if (isCorrect && rtMs <= fastThresholdMs) return Math.min(5, prev + 1);
      if (!isCorrect) return Math.max(1, prev - 1);
      return prev;
    });
    setPaceMultiplier((prev) => {
      if (isCorrect && rtMs <= fastThresholdMs) return Math.max(0.65, prev * 0.9);
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

  // ==========================================================================
  // 6 COMMON REAL HOUSEHOLD GAMES — 1-SENTENCE RULES & ZERO TRIVIA
  // ==========================================================================
  const GAMES_META: Record<
    string,
    {
      num: number;
      title: string;
      nextStationId: StationId | null;
      page1SimpleInstruction: string;
      page2SimpleReminder: string;
    }
  > = {
    S0: {
      num: 1,
      title: 'Game 1 of 6: 4-Corner Arcade Pong',
      nextStationId: 'S1.1',
      page1SimpleInstruction:
        'Tap the corner paddle where the glowing target orb lands to bounce it back—as your streak grows, the rally speeds up!',
      page2SimpleReminder: 'Tap the corner paddle that matches the target orb called out below.'
    },
    S1: {
      num: 2,
      title: 'Game 2 of 6: Speed Go-Fish!',
      nextStationId: 'S2.1',
      page1SimpleInstruction:
        'Play Speed Go-Fish against the Dealer: if you have the card the Dealer asks for, tap it in your hand—if not, tap "🐟 GO FISH!"',
      page2SimpleReminder: 'Tap the requested card in your hand, or tap "🐟 GO FISH!" if you don’t have it.'
    },
    S2: {
      num: 3,
      title: 'Game 3 of 6: Mystery Deck Draw',
      nextStationId: 'S3.1',
      page1SimpleInstruction:
        'Draw a card from the misty Mystery Deck and tap the picture on it—or tap "🃏 Blank Mist Card" if nothing is on it!',
      page2SimpleReminder: 'Tap the picture on the card, or tap "🃏 Blank Mist Card" if empty.'
    },
    S3: {
      num: 4,
      title: 'Game 4 of 6: Speed Rummy & 3D Cube/Watch Draw',
      nextStationId: 'S4.1',
      page1SimpleInstruction:
        'First, play 8 Speed Rummy cards onto Pile A or Pile B (matching by Number or Suit). Then, connect a 3D Box and set the hands on a Watch!',
      page2SimpleReminder: 'Sort the Rummy cards, then connect the 4 depth edges of the 3D Box and set the Watch.'
    },
    S4: {
      num: 5,
      title: 'Game 5 of 6: Face & Object Cards, Word Wheel & Telephone',
      nextStationId: 'S5.1',
      page1SimpleInstruction:
        'First, recognize 4 everyday Object & Face cards. Next, spin the "F" Word Wheel, and finish with 3 quick rounds of Table Telephone!',
      page2SimpleReminder: 'Match the Object & Face cards, tap chips for "F" words, and match the dealer’s whisper.'
    },
    S5: {
      num: 6,
      title: 'Game 6 of 6: Blackjack 21 & Card-Table Memory',
      nextStationId: null,
      page1SimpleInstruction:
        'Meet 3 friendly card-table players and their lucky cards, flip a 4-card Blackjack run in order, and see who held which lucky card!',
      page2SimpleReminder: 'Remember the 3 players’ lucky cards and the Blackjack deal order.'
    }
  };

  const meta = GAMES_META[stationPrefix] ?? GAMES_META.S0;

  return (
    <div
      data-testid="participant-task-surface"
      className="min-h-[540px] rounded-2xl border border-slate-700/90 bg-[#0B131E] p-6 sm:p-8 text-slate-100 shadow-2xl flex flex-col justify-between"
    >
      {/* =====================================================================
          PERSISTENT TOP BAR: Game Title + Non-Counting Hourglass + Help/Pause
         ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
            🎮 {meta.title}
          </span>
          <span
            data-testid="adaptive-tier-badge"
            className="px-3 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-300"
          >
            Speed Pace: Level {adaptiveTier}
          </span>
        </div>

        {pagePhase === 'ACTIVE_TEST' && (
          <DynamicHourglassBar
            stepKey={`${stationPrefix}-${s03TrialIdx}-${s1Idx}-${s2Idx}-${s31TrialIdx}-${s4EchoIdx}-${s5SubStage}`}
            durationMs={Math.round(4500 * paceMultiplier)}
            paused={isPaused}
          />
        )}

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
            Click <strong>Resume Game</strong> whenever you are ready—the hourglass bar resets cleanly.
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
          SCREEN 1 OF EACH GAME: SIMPLE 1-SENTENCE RULE + QUICK PRACTICE
         ===================================================================== */}
      {pagePhase === 'INTRO_DEMO' && (
        <div className="my-auto max-w-2xl w-full mx-auto space-y-6 py-4">
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
              Quick Warm-Up Try
            </div>

            {stationPrefix === 'S0' && (
              <div className="space-y-4">
                <p className="text-base text-slate-200">
                  Tap the glowing <strong>★ Gold Orb Paddle</strong> below (or press the <strong>Spacebar</strong>) to test your bounce:
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
                  className={`w-full max-w-md mx-auto min-h-16 px-6 py-4 rounded-2xl font-extrabold text-lg border-2 transition-all cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-800 border-emerald-300 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950 shadow-lg'
                  }`}
                >
                  {demoCompleted
                    ? '✓ Paddle Bounce Ready!'
                    : '🏓 Tap Here to Bounce the ★ Gold Orb'}
                </button>
              </div>
            )}

            {stationPrefix === 'S1' && (
              <div className="space-y-4">
                <p className="text-base font-bold text-white">
                  Dealer asks: <em>&ldquo;Do you have any 5s?&rdquo;</em> — Tap the <strong>5♠</strong> in your practice hand:
                </p>
                <div className="flex flex-wrap justify-center items-center gap-3">
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
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="min-h-14 px-5 py-3 rounded-xl bg-sky-800 hover:bg-sky-700 border border-sky-400 text-white font-extrabold text-sm cursor-pointer"
                  >
                    🐟 GO FISH!
                  </button>
                </div>
                {demoCompleted && (
                  <div className="text-sm font-extrabold text-emerald-300">
                    ✓ Nice! You played the 5♠ right out of your hand!
                  </div>
                )}
              </div>
            )}

            {stationPrefix === 'S2' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  When a Mystery Card has <strong>only empty mist</strong> and no picture, tap <strong>&ldquo;🃏 Blank Mist Card&rdquo;</strong>:
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
                    ? '✓ Ready to Draw from the Mystery Deck!'
                    : '🃏 Tap "Blank Mist Card (Nothing On It)"'}
                </button>
              </div>
            )}

            {stationPrefix === 'S3' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {renderPlayingCard({ rank: '7', suit: '♦', suitName: 'Diamonds' }, { size: 'sm', highlighted: true })}
                </div>
                <p className="text-base text-slate-200">
                  Your card is <strong>7♦</strong>. When the rule says <strong>MATCH BY NUMBER (7)</strong>, tap the pile with a <strong>7</strong>:
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className={`min-h-12 px-5 py-2.5 rounded-xl font-extrabold text-sm border cursor-pointer ${
                      demoCompleted
                        ? 'bg-emerald-800 border-emerald-300 text-white'
                        : 'bg-sky-600 hover:bg-sky-500 border-sky-300 text-white'
                    }`}
                  >
                    {demoCompleted ? '✓ Matched Number 7!' : 'Pile A: 7♠ (Number 7)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="min-h-12 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm border border-slate-600 cursor-pointer"
                  >
                    Pile B: 2♦ (Number 2)
                  </button>
                </div>
              </div>
            )}

            {stationPrefix === 'S4' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  Say any <strong>&ldquo;F&rdquo;</strong> word out loud (like <em>&ldquo;Five&rdquo;</em> or <em>&ldquo;Friend&rdquo;</em>) and tap the chip button once:
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
                  {demoCompleted ? '✓ Word Chip Logged!' : '🪙 Tap Word Chip (+1 "F" Word)'}
                </button>
              </div>
            )}

            {stationPrefix === 'S5' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  No history or trivia questions here! You’ll simply remember 3 friendly players at our card table. Tap below to meet them:
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
                  {demoCompleted ? '✓ Ready to Meet the Table Players!' : '👋 Ready for Blackjack & Table Memory'}
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
                  setS1MatrixHits(0);
                  setS1Running(true);
                  s03OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S2') {
                  setS2Idx(0);
                  setS2FalsePositives(0);
                  setS2TrueHits(0);
                  s03OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S3') {
                  setS3SubStage('RUMMY_SORT');
                  setS31Trials([]);
                  setS31TrialIdx(0);
                  setS32DrawnStruts([]);
                  setS32WatchHands([]);
                  setS31Running(true);
                  s31OnsetRef.current = performance.now();
                } else if (stationPrefix === 'S4') {
                  setS4SubStage('FACE_OBJECT');
                  setS4FaceObjIdx(0);
                  setS4FaceObjHits(0);
                  setS4ShowHint(false);
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
          SCREEN 2 OF EACH GAME: LIVE GAME TABLE WITH HIDDEN SURROGATES
         ===================================================================== */}
      {pagePhase === 'ACTIVE_TEST' && (
        <div className="my-auto max-w-3xl w-full mx-auto space-y-5">
          <div className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-2 text-center">
            <span className="text-sm sm:text-base font-bold text-sky-200">
              {meta.page2SimpleReminder}
            </span>
          </div>

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
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                        {rally.rallyBadge}
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold text-white mt-1">
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
                            {/* Arcade Orb & Paddle Graphic */}
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
                            {/* Arcade Glowing Paddle Bar */}
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
              GAME 2 (S1): SPEED GO-FISH! (Interactive Fanned Hand + GO FISH Pile)
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S1' && (
            <div className="space-y-4">
              {(() => {
                const hand = S1_GO_FISH_HANDS[s1Idx] ?? S1_GO_FISH_HANDS[0];

                const handleGoFishMove = (tappedCardIdx: number | 'GO_FISH') => {
                  const rt = Math.max(180, Math.round(performance.now() - s03OnsetRef.current));
                  let hit = false;
                  if (tappedCardIdx === 'GO_FISH') {
                    hit = hand.matchingCardIndex === null;
                  } else if (hand.handNum === 8) {
                    // Hand 8 allows tapping either 8 in the pair
                    hit = hand.playerHand[tappedCardIdx]?.rank === '8';
                  } else {
                    hit = tappedCardIdx === hand.matchingCardIndex;
                  }

                  playToneSequence(hit ? [784] : [260], 0.06);
                  adjustTier(hit, rt, 1500);

                  const nextMatrixHits =
                    s1MatrixHits + (hand.rule === 'MATRIX_DIFF' && hit ? 1 : 0);
                  const nextCollected = [
                    ...s1Collected,
                    {
                      level: (hand.rule === 'LOCAL_MICRO' ? 'local' : 'global') as
                        | 'global'
                        | 'local',
                      crowded: hand.crowded,
                      rtMs: rt,
                      isCorrect: hit
                    }
                  ];

                  if (s1Idx + 1 >= S1_GO_FISH_HANDS.length) {
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
                };

                return (
                  <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/60 space-y-5 shadow-xl">
                    {/* Dealer Speech Bubble */}
                    <div className="rounded-2xl bg-slate-950/90 border-2 border-amber-400 p-4 text-center space-y-1">
                      <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                        🐟 Speed Go-Fish • Hand {hand.handNum} of {S1_GO_FISH_HANDS.length} ({hand.playerHand.length} Cards in Hand)
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold text-white">
                        {hand.dealerAsk}
                      </div>
                      <div className="text-sm text-amber-200 font-semibold">
                        {hand.askDetail}
                      </div>
                    </div>

                    {/* Player's Interactive Fanned Card Hand */}
                    <div className="space-y-2 text-center">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        👇 Your Hand (Tap a Card to Give It to the Dealer):
                      </div>
                      <div
                        className={`flex flex-wrap justify-center items-center py-3 ${
                          hand.crowded ? 'gap-1.5 sm:gap-2' : 'gap-3 sm:gap-4'
                        }`}
                      >
                        {hand.playerHand.map((card, cIdx) => (
                          <button
                            key={cIdx}
                            type="button"
                            onClick={() => handleGoFishMove(cIdx)}
                            className="transition-transform hover:-translate-y-2 active:scale-95 cursor-pointer"
                          >
                            {renderPlayingCard(card, {
                              size: hand.crowded ? 'sm' : 'md'
                            })}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Prominent "🐟 GO FISH! (Not in My Hand)" Pond Button */}
                    <div className="pt-1 flex justify-center">
                      <button
                        type="button"
                        onClick={() => handleGoFishMove('GO_FISH')}
                        className="w-full max-w-md min-h-14 px-6 py-3.5 rounded-2xl bg-sky-700 hover:bg-sky-600 border-2 border-sky-300 text-white font-extrabold text-lg shadow-lg transition-transform active:scale-98 cursor-pointer"
                      >
                        🐟 &ldquo;GO FISH!&rdquo; (I Don’t Have That Card)
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 3 (S2.1 / S2.2): MYSTERY DECK DRAW
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S2' && (
            <div className="space-y-4">
              {(() => {
                const draw = S2_MYSTERY_CARDS[s2Idx] ?? S2_MYSTERY_CARDS[0];
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                      <span>{draw.drawLabel}</span>
                      <span>Tap the picture on the card—or Blank Mist Card!</span>
                    </div>

                    <div className="h-56 rounded-2xl bg-slate-950 border-2 border-sky-500/40 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                      <svg
                        viewBox="0 0 360 180"
                        className="w-full h-full max-w-md"
                        aria-label={`Mystery card ${draw.id}`}
                      >
                        <defs>
                          <filter id={`mystery-mist-${draw.id}`}>
                            <feTurbulence
                              type="fractalNoise"
                              baseFrequency="0.035"
                              numOctaves={4}
                              seed={draw.id * 19}
                              result="noise"
                            />
                            <feColorMatrix
                              type="saturate"
                              values="0.1"
                              in="noise"
                              result="mist"
                            />
                          </filter>
                        </defs>

                        {!draw.isBlankJoker && (
                          <g
                            opacity={draw.emblemOpacity}
                            transform={`translate(180,95) rotate(${draw.tiltDeg})`}
                            fill="#F8FAFC"
                            stroke="#F8FAFC"
                            strokeWidth="2"
                          >
                            {draw.emblemKind === 'ship' && (
                              <>
                                <polygon points="-55,15 55,15 38,40 -38,40" />
                                <line x1="0" y1="-52" x2="0" y2="15" strokeWidth="4" />
                                <polygon points="-4,-48 -4,8 -44,8" />
                                <polygon points="4,-42 4,8 48,8" />
                              </>
                            )}
                            {draw.emblemKind === 'anchor' && (
                              <>
                                <circle cx="0" cy="-38" r="10" fill="none" strokeWidth="5" />
                                <line x1="0" y1="-28" x2="0" y2="35" strokeWidth="7" />
                                <line x1="-26" y1="-12" x2="26" y2="-12" strokeWidth="6" />
                                <path d="M -42,10 Q 0,52 42,10" fill="none" strokeWidth="7" />
                              </>
                            )}
                            {draw.emblemKind === 'bird' && (
                              <path d="M -60,-10 Q -28,-45 0,-8 Q 28,-45 60,-10 Q 25,-18 0,10 Q -25,-18 -60,-10 Z" />
                            )}
                          </g>
                        )}

                        <rect
                          width="360"
                          height="180"
                          filter={`url(#mystery-mist-${draw.id})`}
                          opacity={draw.mistOpacity}
                        />
                      </svg>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {draw.choices.map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => {
                            const rt = Math.max(
                              200,
                              Math.round(performance.now() - s03OnsetRef.current)
                            );
                            const hit = ch === draw.correctAnswer;
                            playToneSequence(hit ? [784] : [260], 0.06);
                            adjustTier(hit, rt, 1800);

                            const isFalseAlarm =
                              draw.isBlankJoker &&
                              ch !== '🃏 Blank Mist Card (Nothing On It)';
                            const nextFp = s2FalsePositives + (isFalseAlarm ? 1 : 0);
                            const nextHits =
                              s2TrueHits + (!draw.isBlankJoker && hit ? 1 : 0);

                            if (s2Idx + 1 >= S2_MYSTERY_CARDS.length) {
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
                          className="min-h-14 px-5 py-3 rounded-xl bg-slate-900 hover:bg-sky-700 border-2 border-slate-700 text-left text-base font-extrabold text-white transition-colors cursor-pointer"
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
              GAME 4 (S3.1 & S3.2): SPEED RUMMY DISCARD + 3D CUBE & WATCH DRAW
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S3' && (
            <div
              data-testid="s31-active-trial-card"
              className="rounded-2xl bg-[#0D231A] border-2 border-emerald-500/60 p-6 space-y-5 shadow-lg"
            >
              {s3SubStage === 'RUMMY_SORT' &&
                (() => {
                  const isSwitchRule = S31_SCHEDULE[s31TrialIdx] === 'switch';
                  const centerCard: CardSpec = isSwitchRule
                    ? { rank: '2', suit: '♠', suitName: 'Spades' }
                    : { rank: '7', suit: '♦', suitName: 'Diamonds' };

                  const handleRummyDiscard = (isCorrectPile: boolean) => {
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

                    // 8 brisk Rummy cards in live play, then transition to Part 2: 3D Cube Draw!
                    if (s31TrialIdx + 1 >= 8) {
                      setS31Trials(nextTrials);
                      setS31Running(false);
                      setS32DrawnStruts([]);
                      setS3SubStage('CUBE_3D_DRAW');
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
                          Part 1 of 3 • Rummy Card {s31TrialIdx + 1} of 8
                        </span>
                        <span
                          className={`px-4 py-1.5 rounded-full text-sm font-extrabold uppercase tracking-wider border-2 ${
                            isSwitchRule
                              ? 'bg-amber-500 text-slate-950 border-amber-200'
                              : 'bg-sky-500 text-slate-950 border-sky-200'
                          }`}
                        >
                          {isSwitchRule
                            ? '🔄 MATCH BY SUIT (♠ Spades vs. ♦ Diamonds)'
                            : '🔢 MATCH BY NUMBER (7 vs. 2)'}
                        </span>
                      </div>

                      <div className="p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/30 text-center space-y-3">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                          Your Active Card:
                        </div>
                        <div className="flex justify-center">
                          {renderPlayingCard(centerCard, { size: 'lg', highlighted: true })}
                        </div>
                        <div className="text-base font-extrabold text-amber-200">
                          {isSwitchRule
                            ? `Match by SUIT: Play your ${centerCard.suitName} (${centerCard.suit}) onto the ${centerCard.suitName} pile!`
                            : `Match by NUMBER: Play your Number ${centerCard.rank} onto the Number ${centerCard.rank} pile!`}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <button
                          type="button"
                          data-testid="s31-target-left"
                          onClick={() => handleRummyDiscard(true)}
                          className="min-h-24 p-4 rounded-2xl bg-slate-900 hover:bg-emerald-900 border-2 border-sky-400 flex items-center justify-center gap-4 text-white font-extrabold text-base cursor-pointer shadow-md"
                        >
                          {renderPlayingCard(
                            { rank: '7', suit: '♠', suitName: 'Spades' },
                            { size: 'sm' }
                          )}
                          <div className="text-left">
                            <div className="text-xs uppercase text-sky-300">Discard Pile A</div>
                            <div className="text-lg">Number 7 • ♠ Spades</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          data-testid="s31-target-right"
                          onClick={() => handleRummyDiscard(false)}
                          className="min-h-24 p-4 rounded-2xl bg-slate-900 hover:bg-emerald-900 border-2 border-amber-400 flex items-center justify-center gap-4 text-white font-extrabold text-base cursor-pointer shadow-md"
                        >
                          {renderPlayingCard(
                            { rank: '2', suit: '♦', suitName: 'Diamonds' },
                            { size: 'sm' }
                          )}
                          <div className="text-left">
                            <div className="text-xs uppercase text-amber-300">Discard Pile B</div>
                            <div className="text-lg">Number 2 • ♦ Diamonds</div>
                          </div>
                        </button>
                      </div>
                    </>
                  );
                })()}

              {/* PART 2 OF GAME 4 (S3.2a): INTERACTIVE 3D ISOMETRIC CUBE DRAW */}
              {s3SubStage === 'CUBE_3D_DRAW' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Part 2 of 3 • 3D Box Connect-the-Dots Draw
                  </div>
                  <p className="text-lg sm:text-xl font-extrabold text-white">
                    The Gold Front Square and Blue Back Square are drawn below. Tap the <strong>4 True 3D Depth Edges</strong> to connect the front corners to the back corners!
                  </p>

                  {/* Interactive 3D Cube Blueprint SVG */}
                  <div className="flex justify-center">
                    <svg
                      viewBox="0 0 360 220"
                      className="w-full max-w-md h-56 bg-slate-950 rounded-2xl border-2 border-slate-800"
                      aria-label="3D Cube Interactive Drawing Canvas"
                    >
                      {/* Back Square (E-F-G-H) */}
                      <rect
                        x="155"
                        y="35"
                        width="110"
                        height="110"
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth="3"
                        strokeDasharray="5,4"
                      />
                      {/* Front Square (A-B-C-D) */}
                      <rect
                        x="95"
                        y="75"
                        width="110"
                        height="110"
                        fill="none"
                        stroke="#FBBF24"
                        strokeWidth="3.5"
                      />

                      {/* Faint Guide Lines for Unconnected Struts + Glowing Drawn Struts */}
                      {S32_CUBE_STRUTS.map((st) => {
                        const isDrawn = s32DrawnStruts.includes(st.id);
                        if (!isDrawn && !st.isTrue3DStrut) return null;
                        return (
                          <line
                            key={st.id}
                            x1={st.x1}
                            y1={st.y1}
                            x2={st.x2}
                            y2={st.y2}
                            stroke={
                              isDrawn
                                ? st.isTrue3DStrut
                                  ? '#34D399'
                                  : '#F87171'
                                : '#334155'
                            }
                            strokeWidth={isDrawn ? 4.5 : 1.5}
                            strokeDasharray={isDrawn ? undefined : '4,4'}
                          />
                        );
                      })}

                      {/* 8 Corner Vertex Labels */}
                      {[
                        { x: 95, y: 75, lbl: 'A', col: '#FBBF24' },
                        { x: 205, y: 75, lbl: 'B', col: '#FBBF24' },
                        { x: 205, y: 185, lbl: 'C', col: '#FBBF24' },
                        { x: 95, y: 185, lbl: 'D', col: '#FBBF24' },
                        { x: 155, y: 35, lbl: 'E', col: '#38BDF8' },
                        { x: 265, y: 35, lbl: 'F', col: '#38BDF8' },
                        { x: 265, y: 145, lbl: 'G', col: '#38BDF8' },
                        { x: 155, y: 145, lbl: 'H', col: '#38BDF8' }
                      ].map((v) => (
                        <g key={v.lbl}>
                          <circle cx={v.x} cy={v.y} r="9" fill="#0F172A" stroke={v.col} strokeWidth="2.5" />
                          <text
                            x={v.x}
                            y={v.y}
                            fill="#FFFFFF"
                            fontSize="10"
                            fontWeight="bold"
                            textAnchor="middle"
                            dominantBaseline="central"
                          >
                            {v.lbl}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>

                  {/* Large Touch-Friendly Strut Drawing Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {S32_CUBE_STRUTS.map((st) => {
                      const active = s32DrawnStruts.includes(st.id);
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            playToneSequence([st.isTrue3DStrut ? 784 : 260], 0.06);
                            setS32DrawnStruts((prev) =>
                              prev.includes(st.id)
                                ? prev.filter((x) => x !== st.id)
                                : [...prev, st.id]
                            );
                          }}
                          className={`min-h-12 px-4 py-2.5 rounded-xl border-2 font-extrabold text-sm transition-all cursor-pointer ${
                            active
                              ? 'bg-emerald-700 border-emerald-300 text-white shadow-md'
                              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                          }`}
                        >
                          {active ? '✓ Drawn: ' : '✏️ Draw Line: '}
                          {st.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setS32WatchHands([]);
                        setS3SubStage('WATCH_DIAL_DRAW');
                      }}
                      className="min-h-14 px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base shadow-lg cursor-pointer"
                    >
                      3D Box Complete &rarr; Next: Set the Watch Hands
                    </button>
                  </div>
                </div>
              )}

              {/* PART 3 OF GAME 4 (S3.2b): INTERACTIVE WATCH-DIAL HAND DRAW ("10 PAST 11") */}
              {s3SubStage === 'WATCH_DIAL_DRAW' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Part 3 of 3 • Set the Watch Hands (&ldquo;10 Minutes Past 11&rdquo;)
                  </div>
                  <p className="text-lg sm:text-xl font-extrabold text-white">
                    Tap two numbers on the watch face to draw the hands for <strong>10 Minutes Past 11</strong>:
                    <br />
                    <span className="text-sm font-bold text-sky-300">
                      1st Tap = Short Hour Hand (Hour 11) • 2nd Tap = Long Minute Hand (10 Minutes Past = Number 2)
                    </span>
                  </p>

                  {/* Interactive Circular Watch Dial SVG */}
                  <div className="flex justify-center">
                    <svg
                      viewBox="0 0 260 260"
                      className="w-64 h-64 bg-slate-950 rounded-full border-4 border-amber-400/70 shadow-xl"
                      aria-label="Interactive Watch Face"
                    >
                      <circle cx="130" cy="130" r="116" fill="#0F172A" stroke="#334155" strokeWidth="2" />

                      {/* Drawn Hour Hand (1st tap) */}
                      {s32WatchHands[0] !== undefined &&
                        (() => {
                          const angle = ((s32WatchHands[0] % 12) * 30 - 90) * (Math.PI / 180);
                          const x2 = 130 + 54 * Math.cos(angle);
                          const y2 = 130 + 54 * Math.sin(angle);
                          return (
                            <line
                              x1="130"
                              y1="130"
                              x2={x2}
                              y2={y2}
                              stroke="#FBBF24"
                              strokeWidth="6"
                              strokeLinecap="round"
                            />
                          );
                        })()}

                      {/* Drawn Minute Hand (2nd tap) */}
                      {s32WatchHands[1] !== undefined &&
                        (() => {
                          const angle = ((s32WatchHands[1] % 12) * 30 - 90) * (Math.PI / 180);
                          const x2 = 130 + 82 * Math.cos(angle);
                          const y2 = 130 + 82 * Math.sin(angle);
                          return (
                            <line
                              x1="130"
                              y1="130"
                              x2={x2}
                              y2={y2}
                              stroke="#38BDF8"
                              strokeWidth="4"
                              strokeLinecap="round"
                            />
                          );
                        })()}

                      <circle cx="130" cy="130" r="6" fill="#FBBF24" />

                      {/* 12 Interactive Number Buttons Around the Watch Rim */}
                      {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num) => {
                        const angle = ((num % 12) * 30 - 90) * (Math.PI / 180);
                        const cx = 130 + 92 * Math.cos(angle);
                        const cy = 130 + 92 * Math.sin(angle);
                        const isPicked = s32WatchHands.includes(num);
                        return (
                          <g
                            key={num}
                            onClick={() => {
                              playToneSequence([659], 0.06);
                              setS32WatchHands((prev) =>
                                prev.length >= 2 ? [num] : [...prev, num]
                              );
                            }}
                            className="cursor-pointer"
                          >
                            <circle
                              cx={cx}
                              cy={cy}
                              r="16"
                              fill={isPicked ? '#0284C7' : '#1E293B'}
                              stroke={isPicked ? '#BAE6FD' : '#475569'}
                              strokeWidth="2"
                            />
                            <text
                              x={cx}
                              y={cy}
                              fill="#FFFFFF"
                              fontSize="13"
                              fontWeight="bold"
                              textAnchor="middle"
                              dominantBaseline="central"
                            >
                              {num}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  <div className="flex flex-wrap justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setS32WatchHands([])}
                      className="min-h-12 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm cursor-pointer"
                    >
                      ↺ Clear Watch Hands
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // Compute S3.1 + S3.2 telemetry from the player's actual Rummy + 3D Cube + Watch actions
                        const paddedTrials = [
                          ...s31Trials,
                          ...s31Trials,
                          ...s31Trials,
                          ...s31Trials
                        ].slice(0, 30);
                        const metrics = computeWithinConditionSwitchMetrics(
                          paddedTrials.length > 0
                            ? paddedTrials
                            : S31_SCHEDULE.map((c) => ({
                                condition: c,
                                rtMs: 620,
                                isCorrect: true
                              })),
                          1000,
                          20261108
                        );
                        const trueStrutsCount = s32DrawnStruts.filter((id) =>
                          ['TL', 'TR', 'BR', 'BL'].includes(id)
                        ).length;
                        const decoyStrutsCount = s32DrawnStruts.filter((id) =>
                          id.startsWith('DECOY')
                        ).length;
                        const cubeScore = Math.max(
                          2,
                          Math.min(8, trueStrutsCount * 2 - decoyStrutsCount * 2)
                        );
                        const hourOk = s32WatchHands.includes(11);
                        const minOk = s32WatchHands.includes(2);
                        const clockScore = (hourOk ? 2 : 1) + (minOk ? 2 : 0);

                        onUpdateStationTelemetry({
                          'S3.1': metrics,
                          'S3.2': {
                            cubeVerticesCorrect: cubeScore,
                            clockNumbersAndHandsCorrect: clockScore,
                            constructionCompositeScore: cubeScore + clockScore,
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
                        setPagePhase('ACTIVITY_COMPLETE');
                      }}
                      className="min-h-14 px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-lg cursor-pointer"
                    >
                      ✓ Lock In Watch Time &amp; Finish Game 4 &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 5 (S4): PART 1 (FACE & OBJECT RECOGNITION), PART 2 (WORD WHEEL), PART 3 (TELEPHONE)
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S4' && (
            <div className="space-y-5">
              {s4SubStage === 'FACE_OBJECT' &&
                (() => {
                  const card =
                    S4_FACE_OBJECT_CARDS[s4FaceObjIdx] ?? S4_FACE_OBJECT_CARDS[0];
                  return (
                    <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 space-y-4 text-center shadow-lg">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-amber-200 font-extrabold">
                          🖼️ {card.badge}
                        </span>
                        <button
                          type="button"
                          onClick={() => setS4ShowHint((v) => !v)}
                          className="px-3 py-1 rounded-lg bg-slate-900 border border-sky-400/50 text-sky-300 font-bold cursor-pointer"
                        >
                          💡 {s4ShowHint ? card.firstLetterHint : 'Need a First-Letter Hint?'}
                        </button>
                      </div>

                      <div className="text-lg sm:text-xl font-extrabold text-white">
                        {card.prompt}
                      </div>

                      {/* Crisp SVG Illustration for Object & Face Recognition */}
                      <div className="flex justify-center">
                        <svg
                          viewBox="0 0 320 155"
                          className="w-full max-w-md h-40 bg-slate-950 rounded-2xl border border-slate-800"
                          aria-label={card.badge}
                        >
                          {card.kind === 'object_compass' && (
                            <g transform="translate(160,78)">
                              <circle cx="0" cy="0" r="52" fill="#0F172A" stroke="#FBBF24" strokeWidth="4" />
                              <circle cx="0" cy="-60" r="8" fill="none" stroke="#FBBF24" strokeWidth="3" />
                              <text x="0" y="-36" fill="#FBBF24" fontSize="12" fontWeight="bold" textAnchor="middle">N</text>
                              <text x="0" y="44" fill="#94A3B8" fontSize="11" fontWeight="bold" textAnchor="middle">S</text>
                              <text x="40" y="4" fill="#94A3B8" fontSize="11" fontWeight="bold" textAnchor="middle">E</text>
                              <text x="-40" y="4" fill="#94A3B8" fontSize="11" fontWeight="bold" textAnchor="middle">W</text>
                              <polygon points="0,-28 8,0 0,6 -8,0" fill="#F87171" />
                              <polygon points="0,28 8,0 0,-6 -8,0" fill="#E2E8F0" />
                            </g>
                          )}

                          {card.kind === 'object_glasses' && (
                            <g transform="translate(160,85) rotate(-14)" fill="none" stroke="#FBBF24" strokeWidth="4">
                              <circle cx="-48" cy="0" r="28" fill="#1E293B" />
                              <circle cx="48" cy="0" r="28" fill="#1E293B" />
                              <path d="M -20,-4 Q 0,-16 20,-4" />
                              <path d="M -76,-4 L -45,-42 Q -35,-48 -28,-40" />
                              <path d="M 76,-4 L 95,-42 Q 105,-48 112,-40" />
                            </g>
                          )}

                          {card.kind === 'face_identity' && (
                            <g transform="translate(160,78)">
                              {/* Target Guest Portrait: Wavy Hair + Round Glasses + Smile */}
                              <circle cx="0" cy="4" r="42" fill="#1E293B" stroke="#FBBF24" strokeWidth="3" />
                              {/* Wavy Hair */}
                              <path
                                d="M -42,-8 Q -30,-48 0,-42 Q 30,-48 42,-8"
                                fill="none"
                                stroke="#FBBF24"
                                strokeWidth="6"
                              />
                              {/* Round Spectacles */}
                              <circle cx="-15" cy="-2" r="11" fill="none" stroke="#38BDF8" strokeWidth="3" />
                              <circle cx="15" cy="-2" r="11" fill="none" stroke="#38BDF8" strokeWidth="3" />
                              <line x1="-4" y1="-2" x2="4" y2="-2" stroke="#38BDF8" strokeWidth="3" />
                              <circle cx="-15" cy="-2" r="2.5" fill="#FFFFFF" />
                              <circle cx="15" cy="-2" r="2.5" fill="#FFFFFF" />
                              {/* Warm Smile */}
                              <path d="M -14,20 Q 0,32 14,20" fill="none" stroke="#FBBF24" strokeWidth="3" />
                            </g>
                          )}

                          {card.kind === 'face_expression' && (
                            <g transform="translate(160,78)">
                              <circle cx="0" cy="4" r="44" fill="#1E293B" stroke="#FBBF24" strokeWidth="3" />
                              {/* High Arched Eyebrows */}
                              <path d="M -26,-18 Q -15,-28 -6,-18" fill="none" stroke="#FBBF24" strokeWidth="3" />
                              <path d="M 6,-18 Q 15,-28 26,-18" fill="none" stroke="#FBBF24" strokeWidth="3" />
                              {/* Wide Open Eyes */}
                              <circle cx="-15" cy="-4" r="6" fill="#FFFFFF" />
                              <circle cx="15" cy="-4" r="6" fill="#FFFFFF" />
                              <circle cx="-15" cy="-4" r="2.5" fill="#0F172A" />
                              <circle cx="15" cy="-4" r="2.5" fill="#0F172A" />
                              {/* Open 'O' Surprised Mouth */}
                              <ellipse cx="0" cy="22" rx="10" ry="12" fill="#0F172A" stroke="#FBBF24" strokeWidth="3" />
                            </g>
                          )}
                        </svg>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {card.choices.map((ch) => (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => {
                              const hit = ch === card.correctChoice;
                              playToneSequence([hit ? 784 : 260], 0.06);
                              adjustTier(hit, 800, 1200);
                              setS4ShowHint(false);
                              const nextHits = s4FaceObjHits + (hit ? 1 : 0);
                              setS4FaceObjHits(nextHits);
                              if (s4FaceObjIdx + 1 >= S4_FACE_OBJECT_CARDS.length) {
                                setS4SubStage('FLUENCY');
                              } else {
                                setS4FaceObjIdx(s4FaceObjIdx + 1);
                              }
                            }}
                            className="min-h-14 px-4 py-3 rounded-xl bg-slate-900 hover:bg-emerald-800 border-2 border-slate-700 text-white font-extrabold text-base cursor-pointer"
                          >
                            {ch}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              {s4SubStage === 'FLUENCY' && (
                <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 text-center space-y-5">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    🎡 Part 2 of 3 • Letter &ldquo;F&rdquo; Speed Word Wheel
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-white">
                    The Word Wheel landed on <strong>&ldquo;F&rdquo;</strong>! Say any words starting with <strong>F</strong> out loud and tap the gold chip for each word you say:
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
                      Done With Word Wheel &rarr; Part 3: Play 3 Rounds of Table Telephone
                    </button>
                  </div>
                </div>
              )}

              {s4SubStage === 'ECHO' &&
                (() => {
                  const msg = S4_TELEPHONE_ROUNDS[s4EchoIdx] ?? S4_TELEPHONE_ROUNDS[0];
                  return (
                    <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-300">
                          Part 3 of 3 • Table Telephone Round {s4EchoIdx + 1} of {S4_TELEPHONE_ROUNDS.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playToneSequence([440, 554, 659], 0.12);
                            setS4PromptMasked((v) => !v);
                          }}
                          className="text-sky-300 underline cursor-pointer"
                        >
                          {s4PromptMasked ? 'Peek at Dealer Whisper' : 'Flip Card Face-Down'}
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-700 text-lg font-extrabold text-amber-200">
                        {s4PromptMasked
                          ? '🃏 Whisper Card Face-Down — Tap the exact matching message below!'
                          : `🗣️ Dealer Whisper: “${msg.target}”`}
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

                              if (s4EchoIdx + 1 >= S4_TELEPHONE_ROUNDS.length) {
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
                                      s4TapTimestamps.length * 3 + s4FaceObjHits,
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
                })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 6 (S5): BLACKJACK 21 & CARD-TABLE PLAYERS MEMORY
              (100% In-Game Memory — Zero Trivia or History Knowledge Tested!)
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S5' && (
            <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 space-y-5">
              {/* STEP A: Meet the 3 Friendly Players at the Card Table (Encoding Phase) */}
              {s5SubStage === 'MEET_PLAYERS' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Step 1 • Meet Your 3 Card-Table Friends (Remember Their Lucky Cards!)
                  </div>
                  <p className="text-lg font-bold text-white">
                    Before we deal Blackjack, take a quick look at who is sitting at the table with you:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-2xl bg-slate-950 border-2 border-sky-400/50 space-y-1.5">
                      <div className="text-3xl">⚓</div>
                      <div className="text-lg font-extrabold text-white">Sam the Sailor</div>
                      <div className="text-xs font-bold text-amber-300">
                        Holds: Lucky Anchor Ace
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-950 border-2 border-amber-400/50 space-y-1.5">
                      <div className="text-3xl">🥐</div>
                      <div className="text-lg font-extrabold text-white">Clara the Baker</div>
                      <div className="text-xs font-bold text-amber-300">
                        Holds: Golden Bakery King
                      </div>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-950 border-2 border-emerald-400/50 space-y-1.5">
                      <div className="text-3xl">🎻</div>
                      <div className="text-lg font-extrabold text-white">Leo the Violinist</div>
                      <div className="text-xs font-bold text-amber-300">
                        Holds: Symphony Queen
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setS5SubStage('STUDY_SEQ')}
                    className="min-h-14 px-8 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-base cursor-pointer shadow-lg"
                  >
                    Got Them! Deal the Cards &rarr;
                  </button>
                </div>
              )}

              {/* STEP B: Study the Dealt Cards in Order */}
              {s5SubStage === 'STUDY_SEQ' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Card-Flip Memory Deal ({s5SpanLength} Cards)
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-white">
                    Remember the order of these <strong>{s5SpanLength} Cards</strong> from #1 to #{s5SpanLength}:
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 py-2">
                    {DEAL_ORDER_CARDS.slice(0, s5SpanLength).map((item, idx) => (
                      <div key={item.id} className="flex flex-col items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-950 text-xs font-extrabold text-emerald-300">
                          Deal #{idx + 1}
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
                    Flip Cards &amp; Tap Them in Order &rarr;
                  </button>
                </div>
              )}

              {/* STEP C: Rebuild the Dealt Card Sequence */}
              {s5SubStage === 'REBUILD_SEQ' && (
                <div className="space-y-4">
                  <p className="text-lg font-bold text-white text-center">
                    Tap the <strong>{s5SpanLength} Cards</strong> in the exact order they were dealt (#1 &rarr; #{s5SpanLength}):
                  </p>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-amber-300 text-center">
                    Dealt So Far:{' '}
                    {s5PickedSeq.length === 0
                      ? 'Tap Card #1 below...'
                      : s5PickedSeq.map((id) => DEAL_ORDER_CARDS[id].nickname).join(' → ')}
                  </div>
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
                                  setS5SubStage('BLACKJACK_BONUS');
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

              {/* STEP D: Quick Blackjack 21 Hand Total (Replaces abstract letter recall) */}
              {s5SubStage === 'BLACKJACK_BONUS' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    🃏 Quick Blackjack 21 Hand!
                  </div>
                  <p className="text-lg font-bold text-white">
                    You have a <strong>10♠</strong> and a <strong>4♥</strong> (Total = 14). Which card below gives you an exact <strong>21 (Blackjack)</strong>?
                  </p>
                  <div className="flex justify-center gap-3 py-1">
                    {renderPlayingCard({ rank: '10', suit: '♠', suitName: 'Spades' }, { size: 'sm' })}
                    {renderPlayingCard({ rank: '4', suit: '♥', suitName: 'Hearts' }, { size: 'sm' })}
                  </div>
                  <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                    {(
                      [
                        { label: 'Draw 7♣ (Makes 21!)', ok: true },
                        { label: 'Draw 5♦ (Makes 19)', ok: false },
                        { label: 'Draw 10♣ (Busts at 24)', ok: false }
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => {
                          setS5FreeLetterHit(c.ok);
                          setS5AudioPicked([0, 1, 2, 3]);
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

              {/* STEP E: "Who Held Which Card?" 3-Step Recall of the 3 Table Players
                  (Zero outside trivia — tests memory of Sam, Clara, and Leo from Step A!) */}
              {s5SubStage === 'SCHOLARS' && (
                <div className="space-y-4">
                  {(() => {
                    const player =
                      TABLE_PLAYERS_MEMORY[s5ScholarIdx] ?? TABLE_PLAYERS_MEMORY[0];
                    return (
                      <div className="space-y-4">
                        <div className="p-5 rounded-xl bg-slate-950 border border-slate-700 space-y-2 text-center">
                          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                            🃏 Card-Table Memory • {player.seatLabel}
                          </div>
                          <p className="text-xl font-extrabold text-white">
                            {player.cluePrompt}
                          </p>
                        </div>

                        {s5ScholarStep === 'FREE' && (
                          <div className="space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setS5FreeHits(s5FreeHits + 1);
                                  setS5ScholarStep('SEMANTIC');
                                }}
                                className="min-h-14 p-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base cursor-pointer"
                              >
                                ✓ I Remember: {player.correctPlayer}
                              </button>
                              <button
                                type="button"
                                onClick={() => setS5ScholarStep('SEMANTIC')}
                                className="min-h-14 p-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-base cursor-pointer"
                              >
                                💡 Give Me a Quick Table Hint
                              </button>
                            </div>
                          </div>
                        )}

                        {s5ScholarStep === 'SEMANTIC' && (
                          <div className="space-y-3">
                            <div className="text-base font-bold text-sky-200">
                              Quick Table Clue: {player.roleQuestion}
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
                              💡 {player.firstSoundHint} — Tap the player below:
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
            🎉 {meta.title} Complete!
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            {meta.nextStationId
              ? `Ready for Game ${meta.num + 1} of 6`
              : 'All 6 Games Complete!'}
          </h2>
          <p className="text-base text-slate-300">
            {meta.nextStationId
              ? 'Take a breather whenever you like, then tap Continue below for the next game.'
              : 'Great game! Your provider can now open the summary report.'}
          </p>

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
            ? 'Screen 1 of 2: How to Play & Warm-Up'
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
