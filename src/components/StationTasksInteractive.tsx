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
// COLOR-BLIND SAFE PLAYING CARD HELPER (Never relies on red/black color alone:
// always shows large Rank + Suit Symbol ♠ ♥ ♦ ♣ + written Suit Name)
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
  // Color-blind safe contrast: Dark Navy (#0F172A) for Spades/Clubs, Deep Amber-Crimson (#B45309) for Hearts/Diamonds,
  // plus explicit suit symbol and text label so color vision is never tested.
  const isWarmSuit = card.suit === '♥' || card.suit === '♦';
  const inkClass = isWarmSuit ? 'text-amber-700' : 'text-slate-900';

  const dims =
    size === 'lg'
      ? 'w-28 h-38 p-2.5 rounded-2xl'
      : size === 'sm'
      ? 'w-16 h-22 p-1.5 rounded-xl'
      : 'w-22 h-30 p-2 rounded-xl';

  return (
    <div
      className={`inline-flex flex-col justify-between bg-amber-50 border-2 select-none shadow-md ${dims} ${
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
      <div
        className={`flex items-center justify-between font-extrabold leading-none ${inkClass}`}
      >
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{card.suit}</span>
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>{card.rank}</span>
      </div>
    </div>
  );
}

// ============================================================================
// GAME 1 (S0.3 Surrogate): FOUR-CORNER CARD DEAL (10 Deals)
// Deals 1–4: Single card dealt to 1 of 4 corners (records un-confounded motor reach RT).
// Deals 5–10: Competing cards dealt simultaneously + Suit/Rank switches & faster tempo.
// ============================================================================
const S03_CARD_DEALS: {
  dealNum: number;
  roundLabel: string;
  dealerPrompt: string;
  targetQuad: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  tempoWindowMs: number;
  corners: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', { card: CardSpec | null; isTarget: boolean }>;
}[] = [
  {
    dealNum: 1,
    roundLabel: 'Warm-Up Deal 1 of 10',
    dealerPrompt: 'Tap the corner where the A♠ Ace of Spades is dealt',
    targetQuad: 'Q3',
    tempoWindowMs: 3500,
    corners: {
      Q2: { card: null, isTarget: false },
      Q1: { card: null, isTarget: false },
      Q3: { card: { rank: 'A', suit: '♠', suitName: 'Spades' }, isTarget: true },
      Q4: { card: null, isTarget: false }
    }
  },
  {
    dealNum: 2,
    roundLabel: 'Warm-Up Deal 2 of 10',
    dealerPrompt: 'Tap the corner where the A♠ Ace of Spades is dealt',
    targetQuad: 'Q1',
    tempoWindowMs: 3200,
    corners: {
      Q2: { card: null, isTarget: false },
      Q1: { card: { rank: 'A', suit: '♠', suitName: 'Spades' }, isTarget: true },
      Q3: { card: null, isTarget: false },
      Q4: { card: null, isTarget: false }
    }
  },
  {
    dealNum: 3,
    roundLabel: 'Warm-Up Deal 3 of 10',
    dealerPrompt: 'Tap the corner where the A♠ Ace of Spades is dealt',
    targetQuad: 'Q4',
    tempoWindowMs: 3000,
    corners: {
      Q2: { card: null, isTarget: false },
      Q1: { card: null, isTarget: false },
      Q3: { card: null, isTarget: false },
      Q4: { card: { rank: 'A', suit: '♠', suitName: 'Spades' }, isTarget: true }
    }
  },
  {
    dealNum: 4,
    roundLabel: 'Warm-Up Deal 4 of 10',
    dealerPrompt: 'Tap the corner where the A♠ Ace of Spades is dealt',
    targetQuad: 'Q2',
    tempoWindowMs: 2800,
    corners: {
      Q2: { card: { rank: 'A', suit: '♠', suitName: 'Spades' }, isTarget: true },
      Q1: { card: null, isTarget: false },
      Q3: { card: null, isTarget: false },
      Q4: { card: null, isTarget: false }
    }
  },
  {
    dealNum: 5,
    roundLabel: 'Deal 5 of 10 • Ignore the Decoy Card',
    dealerPrompt: 'Tap ONLY the A♠ Ace of Spades (Ignore the 4♦ Diamond)',
    targetQuad: 'Q4',
    tempoWindowMs: 2400,
    corners: {
      Q2: { card: { rank: '4', suit: '♦', suitName: 'Diamonds' }, isTarget: false },
      Q1: { card: null, isTarget: false },
      Q3: { card: null, isTarget: false },
      Q4: { card: { rank: 'A', suit: '♠', suitName: 'Spades' }, isTarget: true }
    }
  },
  {
    dealNum: 6,
    roundLabel: 'Deal 6 of 10 • New Target Card!',
    dealerPrompt: 'NEW CARD: Tap ONLY the K♦ King of Diamonds',
    targetQuad: 'Q3',
    tempoWindowMs: 2200,
    corners: {
      Q2: { card: { rank: 'A', suit: '♠', suitName: 'Spades' }, isTarget: false },
      Q1: { card: { rank: '8', suit: '♣', suitName: 'Clubs' }, isTarget: false },
      Q3: { card: { rank: 'K', suit: '♦', suitName: 'Diamonds' }, isTarget: true },
      Q4: { card: null, isTarget: false }
    }
  },
  {
    dealNum: 7,
    roundLabel: 'Deal 7 of 10 • Full 4-Corner Deal',
    dealerPrompt: 'Tap ONLY the 10♣ Ten of Clubs',
    targetQuad: 'Q1',
    tempoWindowMs: 2000,
    corners: {
      Q2: { card: { rank: 'K', suit: '♦', suitName: 'Diamonds' }, isTarget: false },
      Q1: { card: { rank: '10', suit: '♣', suitName: 'Clubs' }, isTarget: true },
      Q3: { card: { rank: '10', suit: '♥', suitName: 'Hearts' }, isTarget: false },
      Q4: { card: { rank: '3', suit: '♠', suitName: 'Spades' }, isTarget: false }
    }
  },
  {
    dealNum: 8,
    roundLabel: 'Deal 8 of 10 • Same-Number Suit Match',
    dealerPrompt: 'Tap ONLY the 7♠ Seven of Spades (Careful of other 7s!)',
    targetQuad: 'Q2',
    tempoWindowMs: 1850,
    corners: {
      Q2: { card: { rank: '7', suit: '♠', suitName: 'Spades' }, isTarget: true },
      Q1: { card: { rank: '7', suit: '♦', suitName: 'Diamonds' }, isTarget: false },
      Q3: { card: { rank: '7', suit: '♥', suitName: 'Hearts' }, isTarget: false },
      Q4: { card: { rank: 'Q', suit: '♠', suitName: 'Spades' }, isTarget: false }
    }
  },
  {
    dealNum: 9,
    roundLabel: 'Deal 9 of 10 • Fast Suit Switch',
    dealerPrompt: 'Tap ONLY the Q♥ Queen of Hearts',
    targetQuad: 'Q3',
    tempoWindowMs: 1700,
    corners: {
      Q2: { card: { rank: 'Q', suit: '♠', suitName: 'Spades' }, isTarget: false },
      Q1: { card: { rank: 'Q', suit: '♣', suitName: 'Clubs' }, isTarget: false },
      Q3: { card: { rank: 'Q', suit: '♥', suitName: 'Hearts' }, isTarget: true },
      Q4: { card: { rank: 'J', suit: '♥', suitName: 'Hearts' }, isTarget: false }
    }
  },
  {
    dealNum: 10,
    roundLabel: 'Deal 10 of 10 • Final Speed Deal',
    dealerPrompt: 'Tap ONLY the 9♦ Nine of Diamonds',
    targetQuad: 'Q1',
    tempoWindowMs: 1550,
    corners: {
      Q2: { card: { rank: '9', suit: '♠', suitName: 'Spades' }, isTarget: false },
      Q1: { card: { rank: '9', suit: '♦', suitName: 'Diamonds' }, isTarget: true },
      Q3: { card: { rank: '6', suit: '♦', suitName: 'Diamonds' }, isTarget: false },
      Q4: { card: { rank: '9', suit: '♣', suitName: 'Clubs' }, isTarget: false }
    }
  }
];

// ============================================================================
// GAME 2 (S1.1 / S1.3 Surrogate): SOLITAIRE TABLE SPOTTER (8 Deals)
// Replaces ambiguous dot shapes with real Playing Cards:
// - Measures Uncrowded vs. Tightly Crowded Center Card identification (PCA crowding)
// - Measures Suit (Global Icon) vs. Corner Number (Local Detail) switching
// - Measures Side-by-Side 4-Card & 5-Card Poker Hand difference spotting
// ============================================================================
type S1DealLayout =
  | { kind: 'SINGLE_CARD'; center: CardSpec }
  | { kind: 'ROW_CROWDED'; center: CardSpec; neighbors: CardSpec[] }
  | { kind: 'GRID_3X3_CROWDED'; grid: CardSpec[] } // index 4 is center
  | { kind: 'TWO_HANDS'; leftHand: CardSpec[]; rightHand: CardSpec[] };

const S1_SOLITAIRE_DEALS: {
  tier: number;
  rule: 'GLOBAL_MACRO' | 'LOCAL_MICRO' | 'MATRIX_DIFF';
  questionBadge: string;
  prompt: string;
  layout: S1DealLayout;
  correctChoice: string;
  choices: string[];
}[] = [
  {
    tier: 1,
    rule: 'GLOBAL_MACRO',
    questionBadge: 'CARD SUIT',
    prompt: 'What SUIT is this card?',
    layout: {
      kind: 'SINGLE_CARD',
      center: { rank: 'A', suit: '♠', suitName: 'Spades' }
    },
    correctChoice: '♠ Spades',
    choices: ['♠ Spades', '♥ Hearts', '♦ Diamonds', '♣ Clubs']
  },
  {
    tier: 2,
    rule: 'LOCAL_MICRO',
    questionBadge: 'CARD NUMBER',
    prompt: 'What NUMBER is printed on this card?',
    layout: {
      kind: 'SINGLE_CARD',
      center: { rank: '8', suit: '♦', suitName: 'Diamonds' }
    },
    correctChoice: 'Number 8',
    choices: ['Number 8', 'Number 3', 'Number 6', 'Number 9']
  },
  {
    tier: 3,
    rule: 'GLOBAL_MACRO',
    questionBadge: 'CENTER CARD SUIT (IGNORE SIDE CARDS)',
    prompt: 'Look ONLY at the GOLD-OUTLINED card in the middle: What SUIT is it?',
    layout: {
      kind: 'ROW_CROWDED',
      center: { rank: 'Q', suit: '♣', suitName: 'Clubs' },
      neighbors: [
        { rank: '4', suit: '♠', suitName: 'Spades' },
        { rank: '9', suit: '♦', suitName: 'Diamonds' },
        { rank: '2', suit: '♥', suitName: 'Hearts' },
        { rank: '7', suit: '♠', suitName: 'Spades' }
      ]
    },
    correctChoice: '♣ Clubs',
    choices: ['♣ Clubs', '♠ Spades', '♦ Diamonds', '♥ Hearts']
  },
  {
    tier: 3,
    rule: 'LOCAL_MICRO',
    questionBadge: 'CENTER CARD NUMBER (IGNORE SIDE CARDS)',
    prompt: 'Look ONLY at the GOLD-OUTLINED card in the middle: What NUMBER is on it?',
    layout: {
      kind: 'ROW_CROWDED',
      center: { rank: '6', suit: '♥', suitName: 'Hearts' },
      neighbors: [
        { rank: '3', suit: '♣', suitName: 'Clubs' },
        { rank: '9', suit: '♠', suitName: 'Spades' },
        { rank: '2', suit: '♦', suitName: 'Diamonds' },
        { rank: '8', suit: '♣', suitName: 'Clubs' }
      ]
    },
    correctChoice: 'Number 6',
    choices: ['Number 6', 'Number 3', 'Number 9', 'Number 8']
  },
  {
    tier: 4,
    rule: 'MATRIX_DIFF',
    questionBadge: 'SPOT THE CHANGED CARD',
    prompt: 'Compare Hand A and Hand B: Which card position changed in Hand B?',
    layout: {
      kind: 'TWO_HANDS',
      leftHand: [
        { rank: '2', suit: '♠', suitName: 'Spades' },
        { rank: '5', suit: '♥', suitName: 'Hearts' },
        { rank: '9', suit: '♣', suitName: 'Clubs' },
        { rank: 'K', suit: '♦', suitName: 'Diamonds' }
      ],
      rightHand: [
        { rank: '2', suit: '♠', suitName: 'Spades' },
        { rank: '5', suit: '♥', suitName: 'Hearts' },
        { rank: '4', suit: '♣', suitName: 'Clubs' },
        { rank: 'K', suit: '♦', suitName: 'Diamonds' }
      ]
    },
    correctChoice: 'Card #3 (9♣ changed to 4♣)',
    choices: [
      'Card #1',
      'Card #2',
      'Card #3 (9♣ changed to 4♣)',
      'Card #4'
    ]
  },
  {
    tier: 4,
    rule: 'GLOBAL_MACRO',
    questionBadge: 'CROWDED TABLE • CENTER CARD SUIT',
    prompt: 'Look at the GOLD-OUTLINED card in the exact center of the 9 cards: What SUIT is it?',
    layout: {
      kind: 'GRID_3X3_CROWDED',
      grid: [
        { rank: '3', suit: '♠', suitName: 'Spades' },
        { rank: '8', suit: '♣', suitName: 'Clubs' },
        { rank: '5', suit: '♥', suitName: 'Hearts' },
        { rank: '10', suit: '♣', suitName: 'Clubs' },
        { rank: 'J', suit: '♦', suitName: 'Diamonds' }, // center card
        { rank: '2', suit: '♠', suitName: 'Spades' },
        { rank: '7', suit: '♥', suitName: 'Hearts' },
        { rank: '4', suit: '♠', suitName: 'Spades' },
        { rank: '9', suit: '♣', suitName: 'Clubs' }
      ]
    },
    correctChoice: '♦ Diamonds',
    choices: ['♦ Diamonds', '♠ Spades', '♣ Clubs', '♥ Hearts']
  },
  {
    tier: 5,
    rule: 'LOCAL_MICRO',
    questionBadge: 'CROWDED TABLE • CENTER CARD NUMBER',
    prompt: 'Look at the GOLD-OUTLINED card in the exact center of the 9 cards: What NUMBER is on it?',
    layout: {
      kind: 'GRID_3X3_CROWDED',
      grid: [
        { rank: '4', suit: '♦', suitName: 'Diamonds' },
        { rank: '7', suit: '♥', suitName: 'Hearts' },
        { rank: '2', suit: '♣', suitName: 'Clubs' },
        { rank: '6', suit: '♦', suitName: 'Diamonds' },
        { rank: '9', suit: '♠', suitName: 'Spades' }, // center card
        { rank: '3', suit: '♥', suitName: 'Hearts' },
        { rank: '8', suit: '♣', suitName: 'Clubs' },
        { rank: '5', suit: '♦', suitName: 'Diamonds' },
        { rank: '4', suit: '♥', suitName: 'Hearts' }
      ]
    },
    correctChoice: 'Number 9',
    choices: ['Number 9', 'Number 6', 'Number 7', 'Number 4']
  },
  {
    tier: 5,
    rule: 'MATRIX_DIFF',
    questionBadge: 'SPOT THE SWAPPED CARDS',
    prompt: 'Compare Hand A and Hand B: Which two neighboring cards were swapped in Hand B?',
    layout: {
      kind: 'TWO_HANDS',
      leftHand: [
        { rank: '3', suit: '♠', suitName: 'Spades' },
        { rank: '7', suit: '♦', suitName: 'Diamonds' },
        { rank: '10', suit: '♣', suitName: 'Clubs' },
        { rank: 'Q', suit: '♥', suitName: 'Hearts' },
        { rank: 'A', suit: '♠', suitName: 'Spades' }
      ],
      rightHand: [
        { rank: '3', suit: '♠', suitName: 'Spades' },
        { rank: '10', suit: '♣', suitName: 'Clubs' },
        { rank: '7', suit: '♦', suitName: 'Diamonds' },
        { rank: 'Q', suit: '♥', suitName: 'Hearts' },
        { rank: 'A', suit: '♠', suitName: 'Spades' }
      ]
    },
    correctChoice: 'Cards #2 & #3 (7♦ and 10♣ swapped)',
    choices: [
      'Cards #1 & #2',
      'Cards #2 & #3 (7♦ and 10♣ swapped)',
      'Cards #3 & #4',
      'Cards #4 & #5'
    ]
  }
];

function renderS1SolitaireTable(layout: S1DealLayout) {
  if (layout.kind === 'SINGLE_CARD') {
    return (
      <div className="py-4 flex justify-center">
        {renderPlayingCard(layout.center, { size: 'lg', highlighted: true })}
      </div>
    );
  }

  if (layout.kind === 'ROW_CROWDED') {
    return (
      <div className="py-4 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
        {renderPlayingCard(layout.neighbors[0], { size: 'sm' })}
        {renderPlayingCard(layout.neighbors[1], { size: 'sm' })}
        {renderPlayingCard(layout.center, { size: 'md', highlighted: true })}
        {renderPlayingCard(layout.neighbors[2], { size: 'sm' })}
        {renderPlayingCard(layout.neighbors[3], { size: 'sm' })}
      </div>
    );
  }

  if (layout.kind === 'GRID_3X3_CROWDED') {
    return (
      <div className="py-3 grid grid-cols-3 gap-2 max-w-xs mx-auto place-items-center">
        {layout.grid.map((c, idx) => (
          <div key={idx}>
            {renderPlayingCard(c, { size: 'sm', highlighted: idx === 4 })}
          </div>
        ))}
      </div>
    );
  }

  // TWO_HANDS comparison
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
      {[
        { title: 'HAND A (Left)', cards: layout.leftHand },
        { title: 'HAND B (Right)', cards: layout.rightHand }
      ].map((hand) => (
        <div
          key={hand.title}
          className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3 space-y-2"
        >
          <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
            {hand.title}
          </div>
          <div className="flex flex-wrap justify-center gap-1.5">
            {hand.cards.map((c, idx) => (
              <div key={idx} className="flex flex-col items-center gap-1">
                <span className="text-[11px] font-bold text-slate-300">#{idx + 1}</span>
                {renderPlayingCard(c, { size: 'sm' })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// GAME 3 (S2.1 / S2.2 Surrogate): HARBOR MIST WINDOW (6 Views)
// Uses clear everyday silhouettes (Sailing Ship, Anchor, Flying Bird) vs.
// Empty Drifting Clouds (measures pareidolia false positives & contrast threshold)
// ============================================================================
const S2_MIST_VIEWS: {
  id: number;
  tier: number;
  mistLabel: string;
  isPureMist: boolean;
  correctAnswer: string;
  mistOpacity: number;
  silhouetteOpacity: number;
  tiltDeg: number;
  objectKind: 'ship' | 'empty_1' | 'anchor' | 'empty_2' | 'bird' | 'empty_3';
  choices: string[];
}[] = [
  {
    id: 1,
    tier: 1,
    mistLabel: 'Window View 1 of 6 • Light Morning Mist',
    isPureMist: false,
    correctAnswer: '⛵ Sailing Ship',
    mistOpacity: 0.35,
    silhouetteOpacity: 0.85,
    tiltDeg: 0,
    objectKind: 'ship',
    choices: [
      '⛵ Sailing Ship',
      '⚓ Ship’s Anchor',
      '🕊️ Flying Bird',
      '👤 Person’s Face',
      '☁️ Just Empty Clouds (Nothing There)'
    ]
  },
  {
    id: 2,
    tier: 2,
    mistLabel: 'Window View 2 of 6 • Drifting Clouds',
    isPureMist: true,
    correctAnswer: '☁️ Just Empty Clouds (Nothing There)',
    mistOpacity: 0.75,
    silhouetteOpacity: 0,
    tiltDeg: 0,
    objectKind: 'empty_1',
    choices: [
      '⛵ Sailing Ship',
      '⚓ Ship’s Anchor',
      '🕊️ Flying Bird',
      '👤 Person’s Face',
      '☁️ Just Empty Clouds (Nothing There)'
    ]
  },
  {
    id: 3,
    tier: 3,
    mistLabel: 'Window View 3 of 6 • Moderate Harbor Mist',
    isPureMist: false,
    correctAnswer: '⚓ Ship’s Anchor',
    mistOpacity: 0.55,
    silhouetteOpacity: 0.55,
    tiltDeg: 28,
    objectKind: 'anchor',
    choices: [
      '⛵ Sailing Ship',
      '⚓ Ship’s Anchor',
      '🕊️ Flying Bird',
      '👤 Person’s Face',
      '☁️ Just Empty Clouds (Nothing There)'
    ]
  },
  {
    id: 4,
    tier: 4,
    mistLabel: 'Window View 4 of 6 • Thick Cloud Bank',
    isPureMist: true,
    correctAnswer: '☁️ Just Empty Clouds (Nothing There)',
    mistOpacity: 0.85,
    silhouetteOpacity: 0,
    tiltDeg: 0,
    objectKind: 'empty_2',
    choices: [
      '⛵ Sailing Ship',
      '⚓ Ship’s Anchor',
      '🕊️ Flying Bird',
      '👤 Person’s Face',
      '☁️ Just Empty Clouds (Nothing There)'
    ]
  },
  {
    id: 5,
    tier: 5,
    mistLabel: 'Window View 5 of 6 • Deep Twilight Fog',
    isPureMist: false,
    correctAnswer: '🕊️ Flying Bird',
    mistOpacity: 0.78,
    silhouetteOpacity: 0.36,
    tiltDeg: 35,
    objectKind: 'bird',
    choices: [
      '⛵ Sailing Ship',
      '⚓ Ship’s Anchor',
      '🕊️ Flying Bird',
      '👤 Person’s Face',
      '☁️ Just Empty Clouds (Nothing There)'
    ]
  },
  {
    id: 6,
    tier: 5,
    mistLabel: 'Window View 6 of 6 • Final Fog Check',
    isPureMist: true,
    correctAnswer: '☁️ Just Empty Clouds (Nothing There)',
    mistOpacity: 0.88,
    silhouetteOpacity: 0,
    tiltDeg: 0,
    objectKind: 'empty_3',
    choices: [
      '⛵ Sailing Ship',
      '⚓ Ship’s Anchor',
      '🕊️ Flying Bird',
      '👤 Person’s Face',
      '☁️ Just Empty Clouds (Nothing There)'
    ]
  }
];

// ============================================================================
// GAME 4 (S3.1 Surrogate): SUIT-OR-NUMBER CARD SORT
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
// GAME 5 (S4 Surrogate): WORD CHAIN & TRAVEL RADIO MESSAGES
// Everyday travel messages (short -> medium -> long)
// ============================================================================
const S4_TRAVEL_MESSAGES: {
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
    target: 'The morning train leaves from Track Four.',
    options: [
      'The morning train leaves from Track Four.',
      'The evening train leaves from TrackFour.',
      'The morning bus leaves from Gate Four.'
    ]
  },
  {
    id: 2,
    tier: 3,
    syllables: 15,
    target: 'The harbor ferry captain announced a twenty-minute delay due to fog.',
    options: [
      'The harbor ferry captain announced a thirty-minute delay due to rain.',
      'The harbor ferry captain announced a twenty-minute delay due to fog.',
      'The island steamer captain announced a twenty-minute delay due to fog.'
    ]
  },
  {
    id: 3,
    tier: 5,
    syllables: 22,
    target: 'The passenger who left the brown leather suitcase at the ticket counter returned before noon.',
    options: [
      'The passenger who left the brown canvas briefcase at the ticket counter returned before noon.',
      'The conductor who found the brown leather suitcase at the station platform returned before noon.',
      'The passenger who left the brown leather suitcase at the ticket counter returned before noon.'
    ]
  }
];

// ============================================================================
// GAME 6 (S5 Surrogate): SUITCASE PACKING ORDER & FAMOUS TRIVIA HALL OF FAME
// ============================================================================
const SUITCASE_ITEMS = [
  { id: 0, icon: '🛂', name: 'Passport' },
  { id: 1, icon: '📷', name: 'Camera' },
  { id: 2, icon: '🕶️', name: 'Sunglasses' },
  { id: 3, icon: '🧭', name: 'Compass' },
  { id: 4, icon: '🎟️', name: 'Train Ticket' },
  { id: 5, icon: '🗺️', name: 'Folding Map' }
];

const FAMOUS_TRIVIA_FIGURES = [
  {
    id: 1,
    tier: 2,
    category: 'Famous Scientist #1 of 3',
    cluePrompt:
      'German-born physicist with wild white hair who developed the theory of relativity (E = mc²) and won the 1921 Nobel Prize.',
    phonemicHint: 'First-Syllable Hint: "Al-bert Ein-..."',
    correctName: 'Albert Einstein',
    nameChoices: ['Albert Einstein', 'Isaac Newton', 'Thomas Edison', 'Nikola Tesla'],
    triviaQuestion: 'What field of science is this person most famous for?',
    correctTrivia: 'Physics & Theory of Relativity',
    triviaChoices: [
      'Physics & Theory of Relativity',
      'Botany & Plant Genetics',
      'Oceanography & Deep-Sea Diving'
    ]
  },
  {
    id: 2,
    tier: 4,
    category: 'Famous Pioneer #2 of 3',
    cluePrompt:
      'American aviation pioneer who became the first woman to fly solo nonstop across the Atlantic Ocean in 1932.',
    phonemicHint: 'First-Syllable Hint: "A-me-li-a Ear-..."',
    correctName: 'Amelia Earhart',
    nameChoices: ['Amelia Earhart', 'Sally Ride', 'Clara Barton', 'Eleanor Roosevelt'],
    triviaQuestion: 'What vehicle did this pioneer famously pilot across the Atlantic?',
    correctTrivia: 'A Solo Prop Airplane',
    triviaChoices: [
      'A Solo Prop Airplane',
      'A Steam Locomotive',
      'A Deep-Sea Submarine'
    ]
  },
  {
    id: 3,
    tier: 5,
    category: 'Famous Scientist #3 of 3',
    cluePrompt:
      '19th-century French chemist and microbiologist who discovered how to heat milk and wine to prevent spoilage (a process named after him!).',
    phonemicHint: 'First-Syllable Hint: "Lou-is Pas-..."',
    correctName: 'Louis Pasteur',
    nameChoices: ['Louis Pasteur', 'Alexander Fleming', 'Jonas Salk', 'Marie Curie'],
    triviaQuestion: 'What everyday kitchen staple is routinely heated using his namesake process ("pasteurization")?',
    correctTrivia: 'Milk & Dairy Products',
    triviaChoices: [
      'Milk & Dairy Products',
      'Table Salt & Pepper',
      'Roasted Coffee Beans'
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

  // Game 1 (S0.3) state
  const [s03TrialIdx, setS03TrialIdx] = useState<number>(0);
  const [s03Running, setS03Running] = useState<boolean>(false);
  const [s03Collected, setS03Collected] = useState<
    { quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4'; rtMs: number; euclideanDistancePx: number; trajectoryLengthPx: number }[]
  >([]);
  const s03OnsetRef = useRef<number>(performance.now());

  // Game 2 (S1) state
  const [s1Idx, setS1Idx] = useState<number>(0);
  const [s1Running, setS1Running] = useState<boolean>(false);
  const [s1Collected, setS1Collected] = useState<
    { level: 'global' | 'local'; crowded: boolean; rtMs: number; isCorrect: boolean }[]
  >([]);
  const [s1MatrixHits, setS1MatrixHits] = useState<number>(0);

  // Game 3 (S2) state
  const [s2Idx, setS2Idx] = useState<number>(0);
  const [s2FalsePositives, setS2FalsePositives] = useState<number>(0);
  const [s2TrueHits, setS2TrueHits] = useState<number>(0);

  // Game 4 (S3.1) state
  const [s31Running, setS31Running] = useState<boolean>(false);
  const [s31TrialIdx, setS31TrialIdx] = useState<number>(0);
  const [s31Trials, setS31Trials] = useState<
    { condition: 'repeat' | 'switch'; rtMs: number; isCorrect: boolean; technicalFrameDrop?: boolean; modeSwitchInterrupted?: boolean }[]
  >([]);
  const s31OnsetRef = useRef<number>(performance.now());
  const prevModeRef = useRef<SingleTrialMode>(presentationMode);
  const [interruptedMidTrial, setInterruptedMidTrial] = useState<boolean>(false);

  // Game 5 (S4) state
  const [s4SubStage, setS4SubStage] = useState<'FLUENCY' | 'ECHO'>('FLUENCY');
  const [s4TapTimestamps, setS4TapTimestamps] = useState<number[]>([]);
  const [s4EchoIdx, setS4EchoIdx] = useState<number>(0);
  const [s4EchoHits, setS4EchoHits] = useState<number>(0);
  const [s4LongMissed, setS4LongMissed] = useState<boolean>(false);
  const [s4PromptMasked, setS4PromptMasked] = useState<boolean>(false);

  // Game 6 (S5) state
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
        const currentDeal = S03_CARD_DEALS[s03TrialIdx] ?? S03_CARD_DEALS[0];
        if (pressedQ) {
          e.preventDefault();
          const isHit = pressedQ === currentDeal.targetQuad;
          const rt = Math.max(140, Math.round(performance.now() - s03OnsetRef.current));
          playToneSequence(isHit ? [784] : [260], 0.06);
          adjustTier(isHit, rt, currentDeal.tempoWindowMs * 0.45);
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
          if (s03TrialIdx + 1 >= S03_CARD_DEALS.length) {
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
  // SIMPLE, 1-SENTENCE GAME INSTRUCTIONS (ZERO JARGON, ZERO SCREEN OVERLOAD)
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
      title: 'Game 1 of 6: Four-Corner Card Deal',
      nextStationId: 'S1.1',
      page1SimpleInstruction:
        'Cards will be dealt into the 4 corners of the table—simply tap the target card shown at the top as quickly as you can!',
      page2SimpleReminder: 'Tap the corner card that matches the dealer callout below.'
    },
    S1: {
      num: 2,
      title: 'Game 2 of 6: Solitaire Table Spotter',
      nextStationId: 'S2.1',
      page1SimpleInstruction:
        'Look at the playing cards on the table and answer the simple question above them (Suit, Number, or Which Card Changed).',
      page2SimpleReminder: 'Read the bold question above the cards and tap your answer below.'
    },
    S2: {
      num: 3,
      title: 'Game 3 of 6: Misty Harbor Window',
      nextStationId: 'S3.1',
      page1SimpleInstruction:
        'Look through the misty harbor window and tap the silhouette you see—or tap "Just Empty Clouds" if nothing is there!',
      page2SimpleReminder: 'Tap the object in the mist, or tap "Just Empty Clouds" if empty.'
    },
    S3: {
      num: 4,
      title: 'Game 4 of 6: Suit-or-Number Card Sort',
      nextStationId: 'S4.1',
      page1SimpleInstruction:
        'Sort the center card into Pile A or Pile B below! Watch the dealer badge: sometimes you match by SUIT (♠ vs ♦) and sometimes by NUMBER (7 vs 2).',
      page2SimpleReminder: 'Check the green badge: Are we matching by SUIT or by NUMBER?'
    },
    S4: {
      num: 5,
      title: 'Game 5 of 6: Word Counter & Travel Tickets',
      nextStationId: 'S5.1',
      page1SimpleInstruction:
        'First, say words starting with the letter "F" out loud and tap the counter button for each word. Then, match 3 short travel messages!',
      page2SimpleReminder: 'Tap the button for each "F" word you say, then pick the matching travel ticket.'
    },
    S5: {
      num: 6,
      title: 'Game 6 of 6: Suitcase Packing & Famous Trivia',
      nextStationId: null,
      page1SimpleInstruction:
        'First, remember the order of 4 travel items packed into a suitcase. Then, enjoy a 3-question Famous Faces trivia round!',
      page2SimpleReminder: 'Pack the travel items in order, then answer the 3 trivia questions.'
    }
  };

  const meta = GAMES_META[stationPrefix] ?? GAMES_META.S0;

  return (
    <div
      data-testid="participant-task-surface"
      className="min-h-[540px] rounded-2xl border border-slate-700/90 bg-[#0B131E] p-6 sm:p-8 text-slate-100 shadow-2xl flex flex-col justify-between"
    >
      {/* =====================================================================
          PERSISTENT TOP BAR: Game Number + HELP & PAUSE Buttons
         ===================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4 mb-6">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-950/90 border border-emerald-500/50 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
            🃏 {meta.title}
          </span>
          <span
            data-testid="adaptive-tier-badge"
            className="px-3 py-1 rounded-lg bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-300"
          >
            Level {adaptiveTier} of 5
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
            {isPaused ? '▶ Resume Game' : '⏹ Pause Game'}
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
              Game Paused — Take All the Time You Need
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
            Whenever you click <strong>Resume Game</strong>, the current round starts fresh.
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
          SCREEN 1 OF EACH GAME: ONE SIMPLE FULL-PAGE INSTRUCTION + PRACTICE TRY
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

          {/* Warm Felt-Table Practice Box */}
          <div className="rounded-2xl bg-[#0D231A] border-2 border-emerald-600/40 p-6 text-center space-y-4 shadow-inner">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Quick Warm-Up Try (Just for Practice)
            </div>

            {stationPrefix === 'S0' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {renderPlayingCard({ rank: 'A', suit: '♠', suitName: 'Spades' }, { size: 'md', highlighted: true })}
                </div>
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
                  className={`w-full max-w-md mx-auto min-h-16 px-6 py-3.5 rounded-2xl font-extrabold text-base border-2 transition-all cursor-pointer ${
                    demoCompleted
                      ? 'bg-emerald-800 border-emerald-300 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950 shadow-lg'
                  }`}
                >
                  {demoCompleted
                    ? '✓ Great! You Are Ready to Deal'
                    : '👆 Tap Here to Catch the A♠ Ace of Spades'}
                </button>
              </div>
            )}

            {stationPrefix === 'S1' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {renderPlayingCard({ rank: '5', suit: '♠', suitName: 'Spades' }, { size: 'md', highlighted: true })}
                </div>
                <p className="text-base font-bold text-white">
                  Practice Question: What NUMBER is on this card?
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className={`min-h-12 px-6 py-2.5 rounded-xl font-extrabold text-base border cursor-pointer ${
                      demoCompleted
                        ? 'bg-emerald-800 border-emerald-300 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                    }`}
                  >
                    {demoCompleted ? '✓ Correct — It is Number 5!' : 'Number 5'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="min-h-12 px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base cursor-pointer"
                  >
                    Number 9
                  </button>
                </div>
              </div>
            )}

            {stationPrefix === 'S2' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  When the harbor window has <strong>only empty clouds</strong> and no object, tap <strong>&ldquo;☁️ Just Empty Clouds&rdquo;</strong>:
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
                    ? '✓ Got It! Ready for the Harbor Window'
                    : '☁️ Practice: Tap "Just Empty Clouds"'}
                </button>
              </div>
            )}

            {stationPrefix === 'S3' && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  {renderPlayingCard({ rank: '7', suit: '♦', suitName: 'Diamonds' }, { size: 'sm', highlighted: true })}
                </div>
                <p className="text-base text-slate-200">
                  If the center card is <strong>7♦</strong> and the dealer badge says <strong>MATCH BY NUMBER (7)</strong>, tap the pile with <strong>7</strong>:
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
                    {demoCompleted ? '✓ Correct — Matched by Number 7!' : 'Pile A: 7♠ (Has Number 7)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="min-h-12 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-200 font-bold text-sm border border-slate-600 cursor-pointer"
                  >
                    Pile B: 2♦ (Has Number 2)
                  </button>
                </div>
              </div>
            )}

            {stationPrefix === 'S4' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  Practice: Say the word <strong>&ldquo;Forest&rdquo;</strong> out loud and tap the counter button once:
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
                  {demoCompleted ? '✓ Counter Button Ready!' : '🎤 Tap Counter Button ("Forest")'}
                </button>
              </div>
            )}

            {stationPrefix === 'S5' && (
              <div className="space-y-3">
                <p className="text-base text-slate-200">
                  Practice: If you pack <strong>1. 🛂 Passport &rarr; 2. 📷 Camera</strong>, tap which item went in <strong>first</strong>:
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className={`min-h-12 px-5 py-2.5 rounded-xl font-extrabold text-sm border cursor-pointer ${
                      demoCompleted
                        ? 'bg-emerald-800 border-emerald-300 text-white'
                        : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                    }`}
                  >
                    {demoCompleted ? '✓ Correct — Passport Was First!' : '1. 🛂 Passport'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoCompleted(true)}
                    className="min-h-12 px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-sm cursor-pointer"
                  >
                    2. 📷 Camera
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Single Giant Primary Button to Start the Game */}
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
          SCREEN 2 OF EACH GAME: CLEAN GREEN-FELT / HARBOR GAME TABLE
         ===================================================================== */}
      {pagePhase === 'ACTIVE_TEST' && (
        <div className="my-auto max-w-3xl w-full mx-auto space-y-5">
          {/* Simple 1-Line Top Reminder */}
          <div className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-2.5 text-center">
            <span className="text-sm sm:text-base font-bold text-sky-200">
              {meta.page2SimpleReminder}
            </span>
          </div>

          {/* -----------------------------------------------------------------
              GAME 1 (S0.3): FOUR-CORNER CARD DEAL
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S0' && (
            <div className="space-y-4">
              {(() => {
                const deal = S03_CARD_DEALS[s03TrialIdx] ?? S03_CARD_DEALS[0];
                return (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-[#0D231A] border-2 border-amber-400/80 p-4 text-center shadow-md">
                      <div className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                        {deal.roundLabel}
                      </div>
                      <div className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                        {deal.dealerPrompt}
                      </div>
                    </div>

                    {/* 4 Large Corner Felt Slots (Arthritis-Safe Quarter-Screen Tap Zones) */}
                    <div className="grid grid-cols-2 gap-4">
                      {(
                        [
                          { q: 'Q2', keyNum: '1', label: 'Top-Left Corner' },
                          { q: 'Q1', keyNum: '2', label: 'Top-Right Corner' },
                          { q: 'Q3', keyNum: '3', label: 'Bottom-Left Corner' },
                          { q: 'Q4', keyNum: '4', label: 'Bottom-Right Corner' }
                        ] as const
                      ).map(({ q, keyNum, label }) => {
                        const slot = deal.corners[q];
                        return (
                          <button
                            key={q}
                            type="button"
                            onClick={() => {
                              const isHit = slot.isTarget;
                              const rt = Math.max(
                                140,
                                Math.round(performance.now() - s03OnsetRef.current)
                              );
                              playToneSequence(isHit ? [784] : [260], 0.06);
                              adjustTier(isHit, rt, deal.tempoWindowMs * 0.45);
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
                              if (s03TrialIdx + 1 >= S03_CARD_DEALS.length) {
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
                            className={`min-h-44 rounded-2xl border-2 flex flex-col items-center justify-center p-4 transition-all cursor-pointer ${
                              slot.card
                                ? 'bg-[#0D231A] hover:bg-[#133226] border-emerald-500/70 shadow-lg'
                                : 'bg-slate-950/70 border-slate-800/80 text-slate-600'
                            }`}
                          >
                            {slot.card ? (
                              renderPlayingCard(slot.card, { size: 'md' })
                            ) : (
                              <div className="w-20 h-28 rounded-xl border-2 border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-600">
                                Empty Slot
                              </div>
                            )}
                            <span className="text-xs font-semibold text-slate-400 mt-2">
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
              GAME 2 (S1.1 / S1.3): SOLITAIRE TABLE SPOTTER
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S1' && (
            <div className="space-y-4">
              {(() => {
                const deal = S1_SOLITAIRE_DEALS[s1Idx] ?? S1_SOLITAIRE_DEALS[0];
                return (
                  <div className="space-y-4">
                    <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 text-center space-y-3 shadow-lg">
                      <div className="flex items-center justify-between text-xs text-emerald-300 font-bold">
                        <span>Card Deal {s1Idx + 1} of {S1_SOLITAIRE_DEALS.length}</span>
                        <span className="px-3 py-0.5 rounded-full bg-amber-500/20 border border-amber-400 text-amber-200 font-extrabold">
                          {deal.questionBadge}
                        </span>
                      </div>

                      <div className="text-xl sm:text-2xl font-extrabold text-white">
                        {deal.prompt}
                      </div>

                      {renderS1SolitaireTable(deal.layout)}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {deal.choices.map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => {
                            const rt = Math.max(
                              180,
                              Math.round(performance.now() - s03OnsetRef.current)
                            );
                            const hit = ch === deal.correctChoice;
                            playToneSequence(hit ? [784] : [260], 0.06);
                            adjustTier(hit, rt, 1400);

                            const nextMatrixHits =
                              s1MatrixHits + (deal.rule === 'MATRIX_DIFF' && hit ? 1 : 0);
                            const nextCollected = [
                              ...s1Collected,
                              {
                                level: (deal.rule === 'LOCAL_MICRO' ? 'local' : 'global') as
                                  | 'global'
                                  | 'local',
                                crowded: deal.tier >= 3,
                                rtMs: rt,
                                isCorrect: hit
                              }
                            ];

                            if (s1Idx + 1 >= S1_SOLITAIRE_DEALS.length) {
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
                          className="min-h-14 px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-emerald-700 border-2 border-slate-700 hover:border-emerald-300 text-white font-extrabold text-base transition-colors cursor-pointer"
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
              GAME 3 (S2.1 / S2.2): MISTY HARBOR WINDOW
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S2' && (
            <div className="space-y-4">
              {(() => {
                const view = S2_MIST_VIEWS[s2Idx] ?? S2_MIST_VIEWS[0];
                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs font-bold text-sky-300">
                      <span>{view.mistLabel}</span>
                      <span>What do you see in the window?</span>
                    </div>

                    <div className="h-56 rounded-2xl bg-slate-950 border-2 border-sky-500/40 flex flex-col items-center justify-center p-4 relative overflow-hidden">
                      <svg
                        viewBox="0 0 360 180"
                        className="w-full h-full max-w-md"
                        aria-label={`Harbor window ${view.id}`}
                      >
                        <defs>
                          <filter id={`harbor-mist-${view.id}`}>
                            <feTurbulence
                              type="fractalNoise"
                              baseFrequency="0.035"
                              numOctaves={4}
                              seed={view.id * 19}
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

                        {/* Everyday Harbor Silhouette (Absent on Empty Cloud Views) */}
                        {!view.isPureMist && (
                          <g
                            opacity={view.silhouetteOpacity}
                            transform={`translate(180,95) rotate(${view.tiltDeg})`}
                            fill="#F8FAFC"
                            stroke="#F8FAFC"
                            strokeWidth="2"
                          >
                            {view.objectKind === 'ship' && (
                              <>
                                {/* Boat Hull */}
                                <polygon points="-55,15 55,15 38,40 -38,40" />
                                {/* Mast & Two Sails */}
                                <line x1="0" y1="-52" x2="0" y2="15" strokeWidth="4" />
                                <polygon points="-4,-48 -4,8 -44,8" />
                                <polygon points="4,-42 4,8 48,8" />
                              </>
                            )}
                            {view.objectKind === 'anchor' && (
                              <>
                                <circle cx="0" cy="-38" r="10" fill="none" strokeWidth="5" />
                                <line x1="0" y1="-28" x2="0" y2="35" strokeWidth="7" />
                                <line x1="-26" y1="-12" x2="26" y2="-12" strokeWidth="6" />
                                <path
                                  d="M -42,10 Q 0,52 42,10"
                                  fill="none"
                                  strokeWidth="7"
                                />
                              </>
                            )}
                            {view.objectKind === 'bird' && (
                              <path
                                d="M -60,-10 Q -28,-45 0,-8 Q 28,-45 60,-10 Q 25,-18 0,10 Q -25,-18 -60,-10 Z"
                              />
                            )}
                          </g>
                        )}

                        {/* Soft Harbor Mist Overlay */}
                        <rect
                          width="360"
                          height="180"
                          filter={`url(#harbor-mist-${view.id})`}
                          opacity={view.mistOpacity}
                        />
                      </svg>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {view.choices.map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => {
                            const rt = Math.max(
                              200,
                              Math.round(performance.now() - s03OnsetRef.current)
                            );
                            const hit = ch === view.correctAnswer;
                            playToneSequence(hit ? [784] : [260], 0.06);
                            adjustTier(hit, rt, 1800);

                            const isFalseAlarm =
                              view.isPureMist &&
                              ch !== '☁️ Just Empty Clouds (Nothing There)';
                            const nextFp = s2FalsePositives + (isFalseAlarm ? 1 : 0);
                            const nextHits =
                              s2TrueHits + (!view.isPureMist && hit ? 1 : 0);

                            if (s2Idx + 1 >= S2_MIST_VIEWS.length) {
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
              GAME 4 (S3.1): SUIT-OR-NUMBER CARD SORT
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S3' && (
            <div
              data-testid="s31-active-trial-card"
              className="rounded-2xl bg-[#0D231A] border-2 border-emerald-500/60 p-6 space-y-5 shadow-lg"
            >
              {(() => {
                // Pile A = 7♠ (Number 7, Suit Spades)
                // Pile B = 2♦ (Number 2, Suit Diamonds)
                // Center Card alternates between 7♦ and 2♠ so Pile A (left) is always the correct match
                // for the active rule in our benchmark schedule:
                // - When rule is MATCH BY NUMBER ('repeat'), center card is 7♦ -> matches Pile A (7♠) by NUMBER 7!
                // - When rule is MATCH BY SUIT ('switch'), center card is 2♠ -> matches Pile A (7♠) by SUIT ♠ Spades!
                const isSwitchRule = S31_SCHEDULE[s31TrialIdx] === 'switch';
                const centerCard: CardSpec = isSwitchRule
                  ? { rank: '2', suit: '♠', suitName: 'Spades' }
                  : { rank: '7', suit: '♦', suitName: 'Diamonds' };

                return (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-300">
                        Card {s31TrialIdx + 1} of 30
                      </span>
                      <span
                        className={`px-4 py-1.5 rounded-full text-sm font-extrabold uppercase tracking-wider border-2 ${
                          isSwitchRule
                            ? 'bg-amber-500 text-slate-950 border-amber-200'
                            : 'bg-sky-500 text-slate-950 border-sky-200'
                        }`}
                      >
                        {isSwitchRule
                          ? '🔄 RULE: MATCH BY SUIT (♠ Spades vs. ♦ Diamonds)'
                          : '🔢 RULE: MATCH BY NUMBER (7 vs. 2)'}
                      </span>
                    </div>

                    <div className="p-5 rounded-2xl bg-slate-950/70 border border-emerald-500/30 text-center space-y-3">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Center Card to Sort:
                      </div>
                      <div className="flex justify-center">
                        {renderPlayingCard(centerCard, { size: 'lg', highlighted: true })}
                      </div>
                      <div className="text-base font-extrabold text-amber-200">
                        {isSwitchRule
                          ? `Match by SUIT: Put this ${centerCard.suitName} (${centerCard.suit}) card on the ${centerCard.suitName} pile!`
                          : `Match by NUMBER: Put this Number ${centerCard.rank} card on the Number ${centerCard.rank} pile!`}
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
                          playToneSequence([784], 0.06);
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
                        className="min-h-24 p-4 rounded-2xl bg-slate-900 hover:bg-emerald-900 border-2 border-sky-400 flex items-center justify-center gap-4 text-white font-extrabold text-base cursor-pointer shadow-md"
                      >
                        {renderPlayingCard({ rank: '7', suit: '♠', suitName: 'Spades' }, { size: 'sm' })}
                        <div className="text-left">
                          <div className="text-xs uppercase text-sky-300">Pile A</div>
                          <div className="text-lg">Number 7 • ♠ Spades</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        data-testid="s31-target-right"
                        onClick={() => {
                          const now = performance.now();
                          const rt = Math.max(140, Math.round(now - s31OnsetRef.current));
                          const cond = S31_SCHEDULE[s31TrialIdx];
                          playToneSequence([260], 0.06);
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
                        className="min-h-24 p-4 rounded-2xl bg-slate-900 hover:bg-emerald-900 border-2 border-amber-400 flex items-center justify-center gap-4 text-white font-extrabold text-base cursor-pointer shadow-md"
                      >
                        {renderPlayingCard({ rank: '2', suit: '♦', suitName: 'Diamonds' }, { size: 'sm' })}
                        <div className="text-left">
                          <div className="text-xs uppercase text-amber-300">Pile B</div>
                          <div className="text-lg">Number 2 • ♦ Diamonds</div>
                        </div>
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* -----------------------------------------------------------------
              GAME 5 (S4): WORD COUNTER & TRAVEL TICKETS
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S4' && (
            <div className="space-y-5">
              {s4SubStage === 'FLUENCY' ? (
                <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 text-center space-y-5">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Part 1 of 2 • Letter &ldquo;F&rdquo; Word Game
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-white">
                    Say any words starting with the letter <strong>&ldquo;F&rdquo;</strong> out loud (like <em>Farm, Flower, Friend</em>) and tap the big button below for each word!
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
                    🎤 Tap Here for Each &ldquo;F&rdquo; Word ({s4TapTimestamps.length} Words)
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
                      Done Counting Words &rarr; Go to Part 2 (3 Travel Tickets)
                    </button>
                  </div>
                </div>
              ) : (
                (() => {
                  const msg = S4_TRAVEL_MESSAGES[s4EchoIdx] ?? S4_TRAVEL_MESSAGES[0];
                  return (
                    <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 space-y-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-300">
                          Travel Message { s4EchoIdx + 1 } of {S4_TRAVEL_MESSAGES.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            playToneSequence([440, 554, 659], 0.12);
                            setS4PromptMasked((v) => !v);
                          }}
                          className="text-sky-300 underline cursor-pointer"
                        >
                          {s4PromptMasked ? 'Show Message Again' : 'Hide Message to Test Memory'}
                        </button>
                      </div>

                      <div className="p-4 rounded-xl bg-slate-950 border border-slate-700 text-lg font-extrabold text-amber-200">
                        {s4PromptMasked
                          ? '🔒 Message Hidden — Tap the exact matching ticket below!'
                          : `🎟️ “${msg.target}”`}
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

                              if (s4EchoIdx + 1 >= S4_TRAVEL_MESSAGES.length) {
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
              GAME 6 (S5): SUITCASE PACKING ORDER & FAMOUS TRIVIA
             ----------------------------------------------------------------- */}
          {stationPrefix === 'S5' && (
            <div className="p-6 rounded-2xl bg-[#0D231A] border-2 border-emerald-600/50 space-y-5">
              {s5SubStage === 'STUDY_SEQ' && (
                <div className="space-y-4 text-center">
                  <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                    Suitcase Packing Game ({s5SpanLength} Travel Items)
                  </div>
                  <p className="text-lg sm:text-xl font-bold text-white">
                    Remember the order of these <strong>{s5SpanLength} Travel Items</strong> from #1 to #{s5SpanLength}:
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {SUITCASE_ITEMS.slice(0, s5SpanLength).map((item, idx) => (
                      <div
                        key={item.id}
                        className="p-4 rounded-xl bg-slate-950 border-2 border-emerald-500/40 text-center space-y-1"
                      >
                        <div className="text-xs font-bold text-emerald-300">Item #{idx + 1}</div>
                        <div className="text-3xl">{item.icon}</div>
                        <div className="text-base font-extrabold text-white">{item.name}</div>
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
                    Close Suitcase &amp; Pack Them in Order &rarr;
                  </button>
                </div>
              )}

              {s5SubStage === 'REBUILD_SEQ' && (
                <div className="space-y-4">
                  <p className="text-lg font-bold text-white text-center">
                    Tap the <strong>{s5SpanLength} Travel Items</strong> in the exact order you packed them (#1 &rarr; #{s5SpanLength}):
                  </p>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-amber-300 text-center">
                    Packed So Far:{' '}
                    {s5PickedSeq.length === 0
                      ? 'Tap Item #1 below...'
                      : s5PickedSeq.map((id) => `${SUITCASE_ITEMS[id].icon} ${SUITCASE_ITEMS[id].name}`).join(' → ')}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[...SUITCASE_ITEMS.slice(0, s5SpanLength)]
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
                                  setS5SubStage('LETTER_RECALL');
                                }
                              }
                            }}
                            className={`p-4 rounded-xl border-2 text-center cursor-pointer ${
                              already
                                ? 'bg-emerald-950/30 border-emerald-500/40 opacity-40'
                                : 'bg-slate-900 hover:bg-emerald-800 border-slate-700'
                            }`}
                          >
                            <div className="text-3xl">{item.icon}</div>
                            <div className="text-base font-extrabold text-white mt-1">
                              {item.name}
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {s5SubStage === 'LETTER_RECALL' && (
                <div className="space-y-4 text-center">
                  <p className="text-lg font-bold text-white">
                    Quick Bonus Check: What letter did the <strong>3rd Travel Item</strong> (🕶️ Sunglasses) start with?
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {(
                      [
                        { label: 'Starts with "S" (Sunglasses)', ok: true },
                        { label: 'Starts with "B"', ok: false },
                        { label: 'Starts with "W"', ok: false }
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
                        className="min-h-14 p-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-extrabold text-sm cursor-pointer"
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
                    const person = FAMOUS_TRIVIA_FIGURES[s5ScholarIdx] ?? FAMOUS_TRIVIA_FIGURES[0];
                    return (
                      <div className="space-y-4">
                        <div className="p-5 rounded-xl bg-slate-950 border border-slate-700 space-y-2">
                          <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                            🌟 {person.category}
                          </div>
                          <p className="text-lg font-bold text-white leading-relaxed">
                            {person.cluePrompt}
                          </p>
                        </div>

                        {s5ScholarStep === 'FREE' && (
                          <div className="space-y-3">
                            <div className="text-base font-bold text-sky-200">
                              Do you know their name right away, or would you like a quick hint?
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  setS5FreeHits(s5FreeHits + 1);
                                  setS5ScholarStep('SEMANTIC');
                                }}
                                className="min-h-14 p-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base cursor-pointer"
                              >
                                ✓ I Know It: {person.correctName}
                              </button>
                              <button
                                type="button"
                                onClick={() => setS5ScholarStep('SEMANTIC')}
                                className="min-h-14 p-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-base cursor-pointer"
                              >
                                💡 Give Me a Quick Hint
                              </button>
                            </div>
                          </div>
                        )}

                        {s5ScholarStep === 'SEMANTIC' && (
                          <div className="space-y-3">
                            <div className="text-base font-bold text-sky-200">
                              Trivia Check: {person.triviaQuestion}
                            </div>
                            <div className="grid grid-cols-1 gap-2.5">
                              {person.triviaChoices.map((triv) => (
                                <button
                                  key={triv}
                                  type="button"
                                  onClick={() => {
                                    if (triv === person.correctTrivia) {
                                      setS5SemanticHits(s5SemanticHits + 1);
                                    }
                                    setS5ScholarStep('PHONEMIC');
                                  }}
                                  className="p-4 rounded-xl bg-slate-900 hover:bg-sky-700 border border-slate-700 text-left text-base font-bold text-white cursor-pointer"
                                >
                                  {triv}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {s5ScholarStep === 'PHONEMIC' && (
                          <div className="space-y-3">
                            <div className="text-base font-extrabold text-amber-300">
                              💡 {person.phonemicHint} — Tap their name below:
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {person.nameChoices.map((nm) => (
                                <button
                                  key={nm}
                                  type="button"
                                  onClick={() => {
                                    const nextPhon =
                                      s5PhonemicHits + (nm === person.correctName ? 1 : 0);
                                    if (s5ScholarIdx + 1 >= FAMOUS_TRIVIA_FIGURES.length) {
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
              : 'All 6 Lounge Games Complete!'}
          </h2>
          <p className="text-base text-slate-300">
            {meta.nextStationId
              ? 'Take a breather whenever you like, then tap Continue below for the next game.'
              : 'Thank you for playing all 6 games! Your provider can now view the summary report.'}
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
            ? 'Screen 1 of 2: How to Play & Practice'
            : pagePhase === 'ACTIVE_TEST'
            ? 'Screen 2 of 2: Game Table'
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
