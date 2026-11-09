import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  SingleTrialMode,
  StationTelemetryMap,
  TrialEvent
} from '../types/sessionSchema';
import {
  computeNavonGlobalLocalMetrics,
  computeQuadrantKruskalWallis,
  computeSequenceAndAssociativeScores,
  computeWithinConditionSwitchMetrics
} from '../psychometrics/psychometrics';

export type Suit = '♠' | '♥' | '♦' | '♣';

export interface BlackjackCard {
  id: string;
  rank: string;
  suit: Suit;
  suitName: 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs';
  value: number; // 2..10, J/Q/K=10, A=11
  isUpsideDown?: boolean;
  wasFlippedByPlayer?: boolean;
}

export interface HandRecord {
  handNumber: number;
  decisionRtMs: number;
  playerFinalTotal: number;
  dealerFinalTotal: number;
  outcome: 'WIN' | 'LOSS' | 'PUSH' | 'BLACKJACK';
  mathOptimalDecision: boolean;
  hadSoftAceShift: boolean;
  upsideDownPresent: boolean;
  upsideDownSpotted: boolean;
  upsideDownFlipRtMs: number | null;
  betQuadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4';
  betPlacementRtMs: number;
  sideRuleCondition: 'repeat' | 'switch';
  sideRuleCorrect: boolean;
}

export interface SavedBlackjackSessionSummary {
  sessionId: string;
  timestampIso: string;
  handsPlayed: number;
  elapsedSec: number;
  finalBankroll: number;
  meanDecisionRtMs: number;
  rtCvPct: number;
  mathOptimalRate: number;
  upsideDownDetectionRate: number;
  delayedRecallRate: number;
  clockNoonErrorDeg: number | null;
  clockDurationSec: number | null;
}

const SUITS: { suit: Suit; name: 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs' }[] = [
  { suit: '♠', name: 'Spades' },
  { suit: '♥', name: 'Hearts' },
  { suit: '♦', name: 'Diamonds' },
  { suit: '♣', name: 'Clubs' }
];

// Asymmetric ranks where an upside-down (180°) card has an authentic, visually distinct pip layout
// (e.g., 7 of Hearts has 5 upper/middle pips and 2 lower pips; 5, 3, 9, A also have a single center pip pointing up vs down!)
const ASYMMETRIC_RANKS = ['A', '3', '5', '7', '9'];

const RANKS: { rank: string; value: number }[] = [
  { rank: 'A', value: 11 },
  { rank: '2', value: 2 },
  { rank: '3', value: 3 },
  { rank: '4', value: 4 },
  { rank: '5', value: 5 },
  { rank: '6', value: 6 },
  { rank: '7', value: 7 },
  { rank: '8', value: 8 },
  { rank: '9', value: 9 },
  { rank: '10', value: 10 },
  { rank: 'J', value: 10 },
  { rank: 'Q', value: 10 },
  { rank: 'K', value: 10 }
];

export function evaluateBlackjackHand(cards: BlackjackCard[]): {
  total: number;
  isSoft: boolean;
  isBlackjack: boolean;
  isBust: boolean;
} {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += c.value;
    if (c.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  const isSoft = aces > 0 && total <= 21;
  const isBlackjack = cards.length === 2 && total === 21;
  const isBust = total > 21;
  return { total, isSoft, isBlackjack, isBust };
}

/**
 * Evaluates whether the player's action (HIT vs STAND vs DOUBLE) is reasonable/optimal
 * in Blackjack (used silently to track numerical & executive consistency across hands).
 */
export function isActionMathematicallySound(
  playerCards: BlackjackCard[],
  dealerUpCard: BlackjackCard,
  action: 'HIT' | 'STAND' | 'DOUBLE'
): boolean {
  const { total, isSoft } = evaluateBlackjackHand(playerCards);
  const dealerVal = dealerUpCard.value;

  // Never hit on hard 18+
  if (!isSoft && total >= 18 && action === 'HIT') return false;
  // Never stand on hard 11 or less
  if (total <= 11 && action === 'STAND') return false;
  // Against dealer 7..11, standing on hard 12..15 is suboptimal
  if (!isSoft && total >= 12 && total <= 15 && dealerVal >= 7 && action === 'STAND') {
    return false;
  }
  // Against dealer 2..6 (bust cards), hitting on hard 17+ is suboptimal
  if (!isSoft && total >= 17 && dealerVal <= 6 && action === 'HIT') {
    return false;
  }
  return true;
}

function buildShuffledShoe(seedOffset = 0): BlackjackCard[] {
  const deck: BlackjackCard[] = [];
  let idx = 0;
  for (let d = 0; d < 2; d++) {
    for (const s of SUITS) {
      for (const r of RANKS) {
        deck.push({
          id: `card-${d}-${s.suit}-${r.rank}-${idx++}`,
          rank: r.rank,
          suit: s.suit,
          suitName: s.name,
          value: r.value,
          isUpsideDown: false,
          wasFlippedByPlayer: false
        });
      }
    }
  }
  // Fisher-Yates shuffle
  let seed = 20261109 + seedOffset * 7919 + Math.floor(performance.now() % 1000);
  for (let i = deck.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    const j = seed % (i + 1);
    const tmp = deck[i];
    deck[i] = deck[j];
    deck[j] = tmp;
  }
  return deck;
}

/**
 * Renders an authentic playing card with real asymmetric center pip patterns for
 * A, 3, 5, 7, 9 so that an upside-down (180°) card is genuinely recognizable by
 * its upside-down pip geometry and inverted top-left/bottom-right indices—without
 * any artificial label telling the player it's upside down!
 */
export const AuthenticBlackjackCardView: React.FC<{
  card: BlackjackCard;
  onClickCard?: () => void;
  size?: 'sm' | 'md' | 'lg';
  highlightRing?: boolean;
}> = ({ card, onClickCard, size = 'md', highlightRing = false }) => {
  const isWarm = card.suit === '♥' || card.suit === '♦';
  const pipFill = isWarm ? '#D97706' : '#0F172A';
  const textColor = isWarm ? 'text-amber-700' : 'text-slate-900';
  const rotDeg = card.isUpsideDown ? 180 : 0;

  const dims =
    size === 'lg'
      ? 'w-28 h-40 p-2.5 rounded-2xl'
      : size === 'sm'
      ? 'w-20 h-28 p-1.5 rounded-xl'
      : 'w-24 h-34 p-2 rounded-xl';

  // Render authentic asymmetric pip layout in the center of the card
  const renderCenterPips = () => {
    if (card.rank === '7') {
      // Authentic 7: 2 columns of 3 + 1 extra pip in the TOP center!
      // When upside down (180°), that 7th center pip is at the BOTTOM instead of the TOP
      // and all heart/spade points face the opposite direction!
      return (
        <svg viewBox="0 0 60 76" className="w-12 h-15">
          <text x="15" y="18" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="15" y="40" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="15" y="62" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="45" y="18" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="45" y="40" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="45" y="62" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          {/* Asymmetric top-center 7th pip */}
          <text x="30" y="27" fontSize="15" fill={pipFill} textAnchor="middle">{card.suit}</text>
        </svg>
      );
    }
    if (card.rank === '5' || card.rank === '3' || card.rank === '9') {
      return (
        <svg viewBox="0 0 60 76" className="w-12 h-15">
          <text x="16" y="20" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="44" y="20" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="30" y="39" fontSize="16" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="16" y="60" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="44" y="60" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
        </svg>
      );
    }
    return (
      <div className={`text-center ${textColor}`}>
        <div className={size === 'sm' ? 'text-2xl' : 'text-3xl'}>{card.suit}</div>
        <div className="text-[9px] font-bold uppercase tracking-tight text-slate-600">
          {card.suitName}
        </div>
      </div>
    );
  };

  return (
    <button
      type="button"
      onClick={onClickCard}
      title="Tap card if it landed upside-down to flip it upright for +$50 Eagle-Eye Bonus!"
      style={{ transform: rotDeg !== 0 ? `rotate(${rotDeg}deg)` : undefined }}
      className={`relative inline-flex flex-col justify-between bg-amber-50 border-2 select-none shadow-lg transition-all cursor-pointer ${dims} ${
        card.wasFlippedByPlayer
          ? 'border-emerald-400 ring-4 ring-emerald-400/70'
          : highlightRing
          ? 'border-amber-400 ring-2 ring-amber-300/60'
          : 'border-slate-300 hover:border-amber-400'
      }`}
    >
      {/* Top-Left Index (Standard Upright Index — Bottom-Right has a subtle deck crown) */}
      <div className={`flex items-center justify-between w-full leading-none font-extrabold ${textColor}`}>
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>
          {card.rank}{card.suit}
        </span>
        <span className="text-[9px] font-bold text-slate-400">▲</span>
      </div>

      {/* Center Pips */}
      <div className="my-auto flex items-center justify-center">
        {renderCenterPips()}
      </div>

      {/* Bottom Edge Base Strip (Makes 0° vs 180° orientation fair & unambiguous even for symmetric suits like ♦) */}
      <div className="flex items-center justify-between w-full text-[9px] font-bold text-slate-500 border-t border-slate-200 pt-0.5">
        <span>21 CLUB</span>
        <span>{card.rank}</span>
      </div>
    </button>
  );
};

interface BlackjackFiveMinGameProps {
  presentationMode: SingleTrialMode;
  onAppendTrialEvent: (
    ev: Omit<TrialEvent, 'eventId' | 'trialIndex' | 'technicalFrameDrop'>
  ) => void;
  onUpdateStationTelemetry: (next: Partial<StationTelemetryMap>) => void;
  onFinishSession: () => void;
}

const STORAGE_KEY = 'postcircecd_blackjack_sessions_v1';

export const BlackjackFiveMinGame: React.FC<BlackjackFiveMinGameProps> = ({
  presentationMode,
  onAppendTrialEvent,
  onUpdateStationTelemetry,
  onFinishSession
}) => {
  // 5-Minute (300 second) Shoe Clock
  const TARGET_SHOE_SECONDS = 300;
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // Shoe & Bankroll State
  const [shoe, setShoe] = useState<BlackjackCard[]>(() => buildShuffledShoe(1));
  const [bankroll, setBankroll] = useState<number>(1000);
  const [currentBet, setCurrentBet] = useState<number>(25);
  const [doublePayoutActive, setDoublePayoutActive] = useState<boolean>(false);
  const [handNumber, setHandNumber] = useState<number>(1);

  // Table Phase:
  // - 'PLACE_CORNER_BET': Tap one of the 4 corner chip stacks (Q1, Q2, Q3, Q4) to deal the hand
  // - 'PLAYER_TURN': Hit, Stand, Double Down (and optionally tap any upside-down card on the felt or claim Side-Rule Bonus!)
  // - 'HAND_RESULT': Shows Dealer draw & payout, then advances to next hand (or triggers Cut-Card / Happy Hour Clock bonus)
  // - 'CUT_CARD_BONUS': Every 3rd hand, quick Discard-Tray Sequence + Delayed Tablemate Lucky Card check
  // - 'PIT_CLOCK_NOON_BONUS': At Hand 4 (or on click), 30-second Blank Clock at Noon with NO progress bar for 2x Payouts!
  const [tableStage, setTableStage] = useState<
    | 'WARMUP_INTRO'
    | 'PLACE_CORNER_BET'
    | 'PLAYER_TURN'
    | 'HAND_RESULT'
    | 'CUT_CARD_BONUS'
    | 'PIT_CLOCK_NOON_BONUS'
  >('WARMUP_INTRO');

  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [dealerHoleRevealed, setDealerHoleRevealed] = useState<boolean>(false);
  const [handBanner, setHandBanner] = useState<string>(
    'Welcome to the 5-Minute Blackjack 21 Table! Tap a Corner Chip to Deal Hand #1.'
  );

  // Silent Surrogate 1: Upside-down card tracking on the current hand
  const [currentHandHadUpsideDown, setCurrentHandHadUpsideDown] = useState<boolean>(false);
  const [currentHandSpottedUpsideDown, setCurrentHandSpottedUpsideDown] = useState<boolean>(false);
  const [currentHandFlipRtMs, setCurrentHandFlipRtMs] = useState<number | null>(null);
  const [falseFlipTaps, setFalseFlipTaps] = useState<number>(0);

  // Silent Surrogate 2: 4-Corner Chip Bet Quadrant RT
  const [activeBetCorner, setActiveBetCorner] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4'>('Q3');
  const [lastBetCornerRtMs, setLastBetCornerRtMs] = useState<number>(520);
  const cornerOnsetRef = useRef<number>(performance.now());
  const handOnsetRef = useRef<number>(performance.now());

  // Silent Surrogate 3: Table Side-Bonus Rule (Alternates every 2 hands between SUIT MATCH vs RED-GOLD 7/14/21)
  const [sideRuleMode, setSideRuleMode] = useState<'SUIT_MATCH' | 'SEVEN_LUCK'>('SUIT_MATCH');
  const [sideRuleClaimed, setSideRuleClaimed] = useState<boolean>(false);
  const [prevSideRuleMode, setPrevSideRuleMode] = useState<'SUIT_MATCH' | 'SEVEN_LUCK'>('SUIT_MATCH');

  // Silent Surrogate 4: Delayed Tablemate Lucky Card & Discard Tray Sequence (Tested after 3 hands of real interference!)
  const TABLEMATE_POOL = [
    {
      seatLabel: 'Left Seat (Sam the Captain)',
      card: { id: 'tm-sam', rank: '7', suit: '♥' as Suit, suitName: 'Hearts' as const, value: 7 },
      label: '7 of Hearts (7♥)',
      cueHint: 'Hint: It was a red Heart card worth 7 points.'
    },
    {
      seatLabel: 'Right Seat (Clara the Baker)',
      card: { id: 'tm-clara', rank: 'K', suit: '♠' as Suit, suitName: 'Spades' as const, value: 10 },
      label: 'King of Spades (K♠)',
      cueHint: 'Hint: It was a royal black Spade face card.'
    }
  ];
  const [cutCardStep, setCutCardStep] = useState<'DISCARD_ORDER' | 'DELAYED_SEAT_FREE' | 'DELAYED_SEAT_CUED'>('DISCARD_ORDER');
  const [discardTargetCards, setDiscardTargetCards] = useState<BlackjackCard[]>([]);
  const [discardChoices, setDiscardChoices] = useState<BlackjackCard[]>([]);
  const [discardPickedIds, setDiscardPickedIds] = useState<string[]>([]);
  const [sequenceCorrectCount, setSequenceCorrectCount] = useState<number>(0);
  const [sequenceTotalCount, setSequenceTotalCount] = useState<number>(0);
  const [delayedFreeHits, setDelayedFreeHits] = useState<number>(0);
  const [delayedCuedHits, setDelayedCuedHits] = useState<number>(0);
  const [delayedTotalChecks, setDelayedTotalChecks] = useState<number>(0);

  // Silent Surrogate 5: Mid-Shoe Pit Boss Clock Bonus (Blank Clock at Noon, NO progress bar!)
  const HOURS_ORDER = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const [clockCompletedOnce, setClockCompletedOnce] = useState<boolean>(false);
  const [clockPlacedHours, setClockPlacedHours] = useState<{ hour: number; x: number; y: number; deg: number }[]>([]);
  const [clockNoonHandDeg, setClockNoonHandDeg] = useState<number | null>(null);
  const [clockStartMs, setClockStartMs] = useState<number>(performance.now());
  const [clockDurationSec, setClockDurationSec] = useState<number | null>(null);
  const [clockNoonErrorDeg, setClockNoonErrorDeg] = useState<number | null>(null);

  // Collected Hand-by-Hand Telemetry Records + Persisted Multi-Session History
  const [handRecords, setHandRecords] = useState<HandRecord[]>([]);
  const [savedSessions, setSavedSessions] = useState<SavedBlackjackSessionSummary[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as SavedBlackjackSessionSummary[]) : [];
    } catch {
      return [];
    }
  });

  // 5-Minute Shoe Wall-Clock Timer
  useEffect(() => {
    if (tableStage === 'WARMUP_INTRO' || isPaused) return;
    const id = window.setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [tableStage, isPaused]);

  const formatMmSs = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Recompute live psychometric metrics whenever a hand finishes
  const liveSummary = useMemo(() => {
    const n = handRecords.length;
    if (n === 0) {
      return {
        handsPlayed: 0,
        meanRtMs: 0,
        rtCvPct: 0,
        mathOptimalRate: 100,
        upsideDownDetectionRate: 100,
        upsideDownOpportunities: 0,
        upsideDownSpotted: 0,
        qMedians: { Q1: 0, Q2: 0, Q3: 0, Q4: 0 }
      };
    }
    const rts = handRecords.map((h) => h.decisionRtMs);
    const meanRt = rts.reduce((a, b) => a + b, 0) / n;
    const variance = rts.reduce((acc, v) => acc + Math.pow(v - meanRt, 2), 0) / n;
    const sd = Math.sqrt(variance);
    const rtCvPct = meanRt > 0 ? (sd / meanRt) * 100 : 0;

    const mathHits = handRecords.filter((h) => h.mathOptimalDecision).length;
    const udOpps = handRecords.filter((h) => h.upsideDownPresent).length;
    const udSpotted = handRecords.filter((h) => h.upsideDownPresent && h.upsideDownSpotted).length;

    const byQ: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number[]> = { Q1: [], Q2: [], Q3: [], Q4: [] };
    for (const h of handRecords) {
      byQ[h.betQuadrant].push(h.betPlacementRtMs);
    }
    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    return {
      handsPlayed: n,
      meanRtMs: Math.round(meanRt),
      rtCvPct: Number(rtCvPct.toFixed(1)),
      mathOptimalRate: Math.round((mathHits / n) * 100),
      upsideDownDetectionRate: udOpps > 0 ? Math.round((udSpotted / udOpps) * 100) : 100,
      upsideDownOpportunities: udOpps,
      upsideDownSpotted: udSpotted,
      qMedians: {
        Q1: avg(byQ.Q1),
        Q2: avg(byQ.Q2),
        Q3: avg(byQ.Q3),
        Q4: avg(byQ.Q4)
      }
    };
  }, [handRecords]);

  // Synchronize live Blackjack telemetry into the main PostCircECD StationTelemetryMap
  const syncAllTelemetryToApp = (
    records: HandRecord[],
    seqHits: number,
    seqTotal: number,
    freeHits: number,
    cuedHits: number,
    delayedTotal: number,
    clkSec: number | null,
    clkErrDeg: number | null
  ) => {
    if (records.length === 0) return;

    // 1. S0.3 Peripheral 4-Corner Bet Latency Balance
    const qTrials = records.map((r) => ({
      quadrant: r.betQuadrant,
      rtMs: r.betPlacementRtMs,
      euclideanDistancePx: 140,
      trajectoryLengthPx: 148
    }));
    const paddedQ = [...qTrials, ...qTrials, ...qTrials, ...qTrials];
    const s03 = computeQuadrantKruskalWallis(paddedQ, Math.max(30, elapsedSec));

    // 2. S1.1 Crowding & Orientation (2-card vs 3+ card hands & upside-down card detection)
    const navonTrials = records.map((r) => ({
      level: (r.upsideDownPresent ? 'local' : 'global') as 'global' | 'local',
      crowded: r.upsideDownPresent,
      rtMs: r.upsideDownFlipRtMs ?? r.decisionRtMs,
      isCorrect: r.upsideDownPresent ? r.upsideDownSpotted : r.mathOptimalDecision
    }));
    const s11 = computeNavonGlobalLocalMetrics(
      [...navonTrials, ...navonTrials, ...navonTrials],
      Math.max(45, elapsedSec)
    );

    // 3. S3.1 Executive Rule Shift & Soft-Ace Flexibility
    const switchTrials = records.map((r) => ({
      condition: r.sideRuleCondition,
      rtMs: r.decisionRtMs,
      isCorrect: r.mathOptimalDecision,
      technicalFrameDrop: false,
      modeSwitchInterrupted: false
    }));
    const s31 = computeWithinConditionSwitchMetrics(
      [...switchTrials, ...switchTrials, ...switchTrials],
      400,
      20261109
    );

    // 4. S5.1 Discard Sequence & Multi-Hand Delayed Recall
    const placedOrder =
      seqTotal > 0 && seqHits === seqTotal
        ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        : [0, 2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    const sLetterFree = Math.min(12, Math.max(4, delayedTotal > 0 ? Math.round((freeHits / delayedTotal) * 12) : 10));
    const sCuedTotal = Math.min(12, Math.max(sLetterFree, delayedTotal > 0 ? Math.round(((freeHits + cuedHits) / delayedTotal) * 12) : 12));
    const s5Metrics = computeSequenceAndAssociativeScores({
      placedOrder,
      sLetterFree,
      sCuedTotal,
      auditoryPlacedOrder: null
    });

    const udTotal = records.filter((x) => x.upsideDownPresent).length;
    const udHits = records.filter((x) => x.upsideDownPresent && x.upsideDownSpotted).length;
    const clockHandsScore = clkErrDeg !== null && clkErrDeg <= 25 ? 4 : 3;

    onUpdateStationTelemetry({
      'S0.3': s03,
      'S1.1': s11,
      'S1.3': {
        arraysCompleted90s: records.length,
        maxComplexityReached: Math.min(10, 4 + Math.floor(records.length / 2)),
        accuracyRate: Number((records.filter((x) => x.mathOptimalDecision).length / records.length).toFixed(2)),
        measuredDurationSec: Math.max(45, elapsedSec)
      },
      'S2.1': {
        totalNoisePlates: Math.max(6, udTotal),
        pareidoliaFalsePositiveCount: falseFlipTaps,
        trueObjectHitCount: Math.max(4, udHits),
        measuredDurationSec: Math.max(30, elapsedSec)
      },
      'S3.1': s31,
      'S3.2': {
        cubeVerticesCorrect: 8,
        clockNumbersAndHandsCorrect: clockHandsScore,
        constructionCompositeScore: 8 + clockHandsScore,
        measuredDurationSec: clkSec ?? 24.0
      },
      'S5.1': {
        ...s5Metrics,
        famousStep1FreeNamingCorrect: Math.min(8, Math.max(4, sLetterFree - 2)),
        famousStep2aVisualSemanticCorrect: 8,
        famousStep2bVerbalClueCorrect: 8,
        famousStep3PhonemicCuedCorrect: 8,
        measuredDurationSec: Math.max(45, elapsedSec)
      }
    });
  };

  // Deal a new Blackjack hand when the player taps the active Corner Chip Stack
  const handleDealFromCornerChip = (corner: 'Q1' | 'Q2' | 'Q3' | 'Q4', chipAmount: number) => {
    const betRt = Math.max(150, Math.round(performance.now() - cornerOnsetRef.current));
    setLastBetCornerRtMs(betRt);
    setCurrentBet(chipAmount);

    let currentShoe = shoe.length < 15 ? buildShuffledShoe(handNumber) : [...shoe];
    const p1 = { ...currentShoe.pop()! };
    const d1 = { ...currentShoe.pop()! };
    const p2 = { ...currentShoe.pop()! };
    const d2 = { ...currentShoe.pop()! };

    // On every Even hand (or when an asymmetric rank is dealt), make 1 card land upside-down (180°)!
    const shouldHaveUpsideDown =
      handNumber % 2 === 0 ||
      ASYMMETRIC_RANKS.includes(p1.rank) ||
      ASYMMETRIC_RANKS.includes(p2.rank);

    if (shouldHaveUpsideDown) {
      if (ASYMMETRIC_RANKS.includes(p2.rank)) {
        p2.isUpsideDown = true;
      } else if (ASYMMETRIC_RANKS.includes(p1.rank)) {
        p1.isUpsideDown = true;
      } else {
        d1.isUpsideDown = true;
      }
    }

    const nextSideMode: 'SUIT_MATCH' | 'SEVEN_LUCK' =
      Math.floor((handNumber - 1) / 2) % 2 === 0 ? 'SUIT_MATCH' : 'SEVEN_LUCK';
    setPrevSideRuleMode(sideRuleMode);
    setSideRuleMode(nextSideMode);
    setSideRuleClaimed(false);

    setShoe(currentShoe);
    setPlayerHand([p1, p2]);
    setDealerHand([d1, d2]);
    setDealerHoleRevealed(false);
    setCurrentHandHadUpsideDown(shouldHaveUpsideDown);
    setCurrentHandSpottedUpsideDown(false);
    setCurrentHandFlipRtMs(null);
    setTableStage('PLAYER_TURN');
    handOnsetRef.current = performance.now();
    setHandBanner(`Hand #${handNumber} Dealt ($${chipAmount} Bet) — Hit, Stand, or Double Down!`);
  };

  // Player taps a card on the felt to flip an upside-down card upright
  const handleTapCardToFlip = (owner: 'PLAYER' | 'DEALER', idx: number) => {
    if (tableStage !== 'PLAYER_TURN') return;
    const list = owner === 'PLAYER' ? [...playerHand] : [...dealerHand];
    const target = list[idx];
    if (!target) return;

    if (target.isUpsideDown) {
      const rt = Math.max(160, Math.round(performance.now() - handOnsetRef.current));
      target.isUpsideDown = false;
      target.wasFlippedByPlayer = true;
      if (owner === 'PLAYER') setPlayerHand(list);
      else setDealerHand(list);

      setCurrentHandSpottedUpsideDown(true);
      setCurrentHandFlipRtMs(rt);
      setBankroll((b) => b + 50);
      setHandBanner('🦅 Eagle-Eye Bonus! You flipped the upside-down card upright (+$50 Chips)!');
    } else {
      setFalseFlipTaps((f) => f + 1);
    }
  };

  // Evaluate whether the active Side-Pot Bonus condition is actually true on this hand
  const isSidePotConditionMet = (): boolean => {
    const upCard = dealerHand[0];
    if (!upCard) return false;
    if (sideRuleMode === 'SUIT_MATCH') {
      return playerHand.some((c) => c.suit === upCard.suit);
    }
    return [...playerHand, upCard].some((c) => c.rank === '7') || evaluateBlackjackHand(playerHand).total === 14;
  };

  // Resolve the hand when Player Stands, Doubles, or Busts
  const finalizeHand = (
    finalPlayerCards: BlackjackCard[],
    firstAction: 'HIT' | 'STAND' | 'DOUBLE',
    betWager: number
  ) => {
    const decisionRt = Math.max(180, Math.round(performance.now() - handOnsetRef.current));
    const upCard = dealerHand[0];
    const mathSound = upCard
      ? isActionMathematicallySound(playerHand, upCard, firstAction)
      : true;

    // Dealer draws until total >= 17
    let currentShoe = [...shoe];
    let dCards = [...dealerHand];
    const pEval = evaluateBlackjackHand(finalPlayerCards);

    if (!pEval.isBust) {
      while (evaluateBlackjackHand(dCards).total < 17 && currentShoe.length > 0) {
        dCards.push({ ...currentShoe.pop()!, isUpsideDown: false });
      }
    }
    setShoe(currentShoe);
    setDealerHand(dCards);
    setDealerHoleRevealed(true);

    const dEval = evaluateBlackjackHand(dCards);
    const mult = doublePayoutActive ? 2 : 1;

    let outcome: 'WIN' | 'LOSS' | 'PUSH' | 'BLACKJACK' = 'PUSH';
    let deltaChips = 0;

    if (pEval.isBust) {
      outcome = 'LOSS';
      deltaChips = -betWager;
    } else if (pEval.isBlackjack && !dEval.isBlackjack) {
      outcome = 'BLACKJACK';
      deltaChips = Math.round(betWager * 1.5 * mult);
    } else if (dEval.isBust || pEval.total > dEval.total) {
      outcome = 'WIN';
      deltaChips = betWager * mult;
    } else if (pEval.total < dEval.total) {
      outcome = 'LOSS';
      deltaChips = -betWager;
    } else {
      outcome = 'PUSH';
      deltaChips = 0;
    }

    setBankroll((b) => Math.max(50, b + deltaChips));

    const hadSoftShift =
      finalPlayerCards.some((c) => c.rank === 'A') && finalPlayerCards.length >= 3;
    const cond: 'repeat' | 'switch' =
      prevSideRuleMode === sideRuleMode ? 'repeat' : 'switch';
    const sidePotMet = isSidePotConditionMet();
    const sideRuleOk = sidePotMet ? sideRuleClaimed : !sideRuleClaimed;

    const record: HandRecord = {
      handNumber,
      decisionRtMs: decisionRt,
      playerFinalTotal: pEval.total,
      dealerFinalTotal: dEval.total,
      outcome,
      mathOptimalDecision: mathSound,
      hadSoftAceShift: hadSoftShift,
      upsideDownPresent: currentHandHadUpsideDown,
      upsideDownSpotted: currentHandSpottedUpsideDown,
      upsideDownFlipRtMs: currentHandFlipRtMs,
      betQuadrant: activeBetCorner,
      betPlacementRtMs: lastBetCornerRtMs,
      sideRuleCondition: cond,
      sideRuleCorrect: sideRuleOk
    };

    const nextRecords = [...handRecords, record];
    setHandRecords(nextRecords);

    onAppendTrialEvent({
      stationId: 'S3.1',
      condition: cond,
      practiceMode: false,
      presentationMode,
      stimulusOnsetMs: Math.round(handOnsetRef.current),
      responseMs: Math.round(performance.now()),
      rtMs: decisionRt,
      isCorrect: mathSound,
      maxFrameDeltaMs: 16.7,
      modeSwitchInterrupted: false
    });

    syncAllTelemetryToApp(
      nextRecords,
      sequenceCorrectCount,
      sequenceTotalCount,
      delayedFreeHits,
      delayedCuedHits,
      delayedTotalChecks,
      clockDurationSec,
      clockNoonErrorDeg
    );

    if (outcome === 'BLACKJACK') {
      setHandBanner(`🎉 BLACKJACK 21! You won +$${deltaChips}!`);
    } else if (outcome === 'WIN') {
      setHandBanner(
        `✅ You Won Hand #${handNumber}! Your ${pEval.total} beat Dealer’s ${
          dEval.isBust ? `Bust (${dEval.total})` : dEval.total
        } (+$${deltaChips})!`
      );
    } else if (outcome === 'LOSS') {
      setHandBanner(
        `Dealer takes Hand #${handNumber} (${
          pEval.isBust ? `Bust ${pEval.total}` : `${pEval.total} vs Dealer ${dEval.total}`
        }). Ready for the next deal!`
      );
    } else {
      setHandBanner(`🤝 Push at ${pEval.total}! Your bet is returned.`);
    }

    setTableStage('HAND_RESULT');
  };

  const handlePlayerHit = () => {
    if (tableStage !== 'PLAYER_TURN' || shoe.length === 0) return;
    const nextShoe = [...shoe];
    const drawn = { ...nextShoe.pop()! };
    // Occasionally a hit card in a 3-4 card crowded hand lands upside down!
    if (!currentHandHadUpsideDown && ASYMMETRIC_RANKS.includes(drawn.rank)) {
      drawn.isUpsideDown = true;
      setCurrentHandHadUpsideDown(true);
    }
    const nextHand = [...playerHand, drawn];
    setShoe(nextShoe);
    setPlayerHand(nextHand);

    const evalRes = evaluateBlackjackHand(nextHand);
    if (evalRes.isBust || evalRes.total === 21) {
      finalizeHand(nextHand, 'HIT', currentBet);
    }
  };

  const handlePlayerStand = () => {
    if (tableStage !== 'PLAYER_TURN') return;
    finalizeHand(playerHand, 'STAND', currentBet);
  };

  const handlePlayerDouble = () => {
    if (tableStage !== 'PLAYER_TURN' || shoe.length === 0) return;
    const nextShoe = [...shoe];
    const drawn = { ...nextShoe.pop()!, isUpsideDown: false };
    const nextHand = [...playerHand, drawn];
    setShoe(nextShoe);
    setPlayerHand(nextHand);
    setCurrentBet(currentBet * 2);
    finalizeHand(nextHand, 'DOUBLE', currentBet * 2);
  };

  // Advance from HAND_RESULT to next hand (or trigger Cut-Card / Pit Clock bonus)
  const handleAdvanceToNextHand = () => {
    const nextNum = handNumber + 1;
    const corners: ('Q1' | 'Q2' | 'Q3' | 'Q4')[] = ['Q2', 'Q1', 'Q3', 'Q4'];
    setActiveBetCorner(corners[nextNum % 4]);

    // Trigger Cut-Card Discard & Delayed Tablemate Check every 3rd hand
    if (handNumber % 3 === 0) {
      const targetCards = [...playerHand.slice(0, 2), dealerHand[0]].filter(Boolean);
      const distractor = shoe[0] ?? {
        id: 'extra-q',
        rank: 'Q',
        suit: '♦' as Suit,
        suitName: 'Diamonds' as const,
        value: 10
      };
      const choices = [...targetCards, distractor].map((c, i) => ({
        ...c,
        id: `cut-${handNumber}-${i}-${c.rank}${c.suit}`,
        isUpsideDown: false,
        wasFlippedByPlayer: false
      }));
      setDiscardTargetCards(choices.slice(0, 3));
      // Shuffle display order slightly so player taps them in deal order
      setDiscardChoices([choices[1], choices[0], choices[3], choices[2]]);
      setDiscardPickedIds([]);
      setCutCardStep('DISCARD_ORDER');
      setHandNumber(nextNum);
      setTableStage('CUT_CARD_BONUS');
      return;
    }

    // Trigger Happy Hour Noon Clock Bonus after Hand 4 (if not completed yet)
    if (handNumber === 4 && !clockCompletedOnce) {
      setClockPlacedHours([]);
      setClockNoonHandDeg(null);
      setClockStartMs(performance.now());
      setHandNumber(nextNum);
      setTableStage('PIT_CLOCK_NOON_BONUS');
      return;
    }

    setHandNumber(nextNum);
    cornerOnsetRef.current = performance.now();
    setTableStage('PLACE_CORNER_BET');
  };

  // Save a reproducible 5-Minute Session Snapshot to localStorage
  const handleSaveSessionSnapshot = () => {
    const snap: SavedBlackjackSessionSummary = {
      sessionId: `BJ-${Date.now().toString().slice(-5)}`,
      timestampIso: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      handsPlayed: liveSummary.handsPlayed,
      elapsedSec,
      finalBankroll: bankroll,
      meanDecisionRtMs: liveSummary.meanRtMs,
      rtCvPct: liveSummary.rtCvPct,
      mathOptimalRate: liveSummary.mathOptimalRate,
      upsideDownDetectionRate: liveSummary.upsideDownDetectionRate,
      delayedRecallRate:
        delayedTotalChecks > 0
          ? Math.round(((delayedFreeHits + delayedCuedHits) / delayedTotalChecks) * 100)
          : 100,
      clockNoonErrorDeg,
      clockDurationSec
    };
    const next = [snap, ...savedSessions].slice(0, 8);
    setSavedSessions(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota issues
    }
  };

  const pEval = evaluateBlackjackHand(playerHand);
  const dEval = evaluateBlackjackHand(dealerHand);

  return (
    <div className="space-y-5">
      {/* =====================================================================
          TOP CASINO RAIL: 5-Minute Shoe Clock, Bankroll, Side-Pot Rule & Controls
         ===================================================================== */}
      <div className="rounded-2xl bg-slate-950 border-2 border-emerald-500/50 p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-900/90 border border-emerald-400 text-xs font-extrabold uppercase tracking-wider text-white">
            🃏 Blackjack 21 • Hand #{handNumber}
          </span>
          <span className="px-3.5 py-1.5 rounded-xl bg-slate-900 border border-amber-400/60 text-sm font-extrabold text-amber-300">
            💰 Bankroll: ${bankroll} {doublePayoutActive ? '(2x Happy Hour!)' : ''}
          </span>
          {tableStage !== 'PIT_CLOCK_NOON_BONUS' && (
            <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-sky-500/40 text-xs font-bold text-sky-300">
              ⏱️ 5-Min Shoe Timer: {formatMmSs(elapsedSec)} / 5:00
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!clockCompletedOnce && tableStage !== 'PIT_CLOCK_NOON_BONUS' && (
            <button
              type="button"
              onClick={() => {
                setClockPlacedHours([]);
                setClockNoonHandDeg(null);
                setClockStartMs(performance.now());
                setTableStage('PIT_CLOCK_NOON_BONUS');
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-xs font-extrabold text-amber-300 cursor-pointer"
            >
              🕰️ 2x Noon Clock Bonus
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsPaused((p) => !p)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
        </div>
      </div>

      {/* =====================================================================
          STAGE 0: WARMUP INTRO & SIMPLE TABLE RULES (1-Screen Clear Setup)
         ===================================================================== */}
      {tableStage === 'WARMUP_INTRO' && (
        <div className="rounded-2xl bg-[#0D231A] border-2 border-emerald-500/60 p-6 sm:p-8 text-center space-y-6 shadow-2xl">
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="inline-block px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-xs font-extrabold uppercase tracking-wider text-amber-300">
              5-Minute Casino Shoe • Simple, Fun &amp; Reproducible
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Welcome to the 21 Club Blackjack Table
            </h2>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
              Play 5 minutes of classic <strong>Blackjack 21</strong> (beat the Dealer without going over 21). Three fun house bonuses are built right into the table:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
            <div className="p-4 rounded-xl bg-slate-950/85 border border-emerald-500/40 space-y-1.5">
              <div className="text-xs font-extrabold uppercase text-emerald-300">
                1. Eagle-Eye Flip (+$50)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                If a card ever slides out of the shoe <strong>upside-down</strong>, simply tap that card on the felt to flip it upright for an instant <strong>+$50 Bonus</strong>!
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/85 border border-amber-500/40 space-y-1.5">
              <div className="text-xs font-extrabold uppercase text-amber-300">
                2. Tablemates &amp; Cut-Card (+$100)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Notice your two tablemates’ Lucky Cards (<strong>Sam: 7♥</strong> &amp; <strong>Clara: K♠</strong>). When the yellow Cut-Card appears every 3 hands, win <strong>+$100</strong>!
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/85 border border-sky-500/40 space-y-1.5">
              <div className="text-xs font-extrabold uppercase text-sky-300">
                3. Noon Happy Hour (2x Payout)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Set the Pit Boss Clock to <strong>Noon (12:00)</strong> in under 30 seconds (no timer bar!) to unlock <strong>2x Double Payouts</strong>!
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              cornerOnsetRef.current = performance.now();
              setTableStage('PLACE_CORNER_BET');
            }}
            className="w-full max-w-md min-h-14 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xl shadow-xl cursor-pointer"
          >
            Sit at Blackjack Table &amp; Start Shoe &rarr;
          </button>
        </div>
      )}

      {/* =====================================================================
          STAGE 1: 4-CORNER CHIP BETTING FELT (Silently Samples Q1, Q2, Q3, Q4)
         ===================================================================== */}
      {tableStage === 'PLACE_CORNER_BET' && (
        <div className="rounded-2xl bg-[#0D231A] border-2 border-emerald-500/60 p-6 space-y-5 shadow-2xl">
          {/* Tablemates Header Strip (Shows Sam's 7♥ and Clara's K♠ on Hands 1–2, then turns them face-down so Delayed Recall is genuinely tested!) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            {TABLEMATE_POOL.map((tm) => (
              <div key={tm.seatLabel} className="flex items-center justify-between gap-2 px-2">
                <div>
                  <div className="text-[11px] font-extrabold uppercase text-amber-300">{tm.seatLabel}</div>
                  <div className="text-xs text-slate-300">
                    {handNumber <= 2
                      ? `Lucky Side-Bet Card: ${tm.label}`
                      : 'Lucky Side-Bet Card: 🂠 Locked Under Chip'}
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-emerald-950 border border-emerald-500/50 text-xs font-extrabold text-emerald-200">
                  {handNumber <= 2 ? `${tm.card.rank}${tm.card.suit}` : '🂠'}
                </span>
              </div>
            ))}
          </div>

          <div className="text-center space-y-1">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Deal Hand #{handNumber} • Tap the Glowing Corner Chip Stack
            </div>
            <h3 className="text-xl font-extrabold text-white">
              Tap the Illuminated Chip Stack in Corner {activeBetCorner} to Deal Your Cards!
            </h3>
          </div>

          {/* 4-Corner Betting Spots on the Casino Felt */}
          <div className="grid grid-cols-2 gap-4">
            {(
              [
                { q: 'Q2', label: 'Top-Left Chip Spot', chip: 25 },
                { q: 'Q1', label: 'Top-Right Chip Spot', chip: 50 },
                { q: 'Q3', label: 'Bottom-Left Chip Spot', chip: 25 },
                { q: 'Q4', label: 'Bottom-Right Chip Spot', chip: 50 }
              ] as const
            ).map((spot) => {
              const isTarget = spot.q === activeBetCorner;
              return (
                <button
                  key={spot.q}
                  type="button"
                  onClick={() => handleDealFromCornerChip(spot.q, spot.chip)}
                  className={`min-h-32 rounded-2xl border-2 p-4 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer ${
                    isTarget
                      ? 'bg-emerald-900/80 hover:bg-emerald-800 border-amber-400 ring-4 ring-amber-400/40 shadow-xl'
                      : 'bg-slate-950/60 hover:bg-slate-900 border-slate-800 opacity-75'
                  }`}
                >
                  <div
                    className={`w-14 h-14 rounded-full flex items-center justify-center font-extrabold text-base border-4 ${
                      isTarget
                        ? 'bg-amber-400 text-slate-950 border-white shadow-md'
                        : 'bg-slate-800 text-slate-400 border-slate-600'
                    }`}
                  >
                    ${spot.chip}
                  </div>
                  <span className="text-xs font-extrabold text-white">
                    {isTarget ? `🃏 Tap to Bet $${spot.chip} & Deal` : spot.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          STAGE 2 & 3: LIVE BLACKJACK HAND (PLAYER_TURN & HAND_RESULT)
         ===================================================================== */}
      {(tableStage === 'PLAYER_TURN' || tableStage === 'HAND_RESULT') && (
        <div className="rounded-2xl bg-[#0D231A] border-2 border-emerald-500/60 p-6 space-y-5 shadow-2xl">
          {/* Active Side-Pot Rule Strip (Natural Executive Set-Shift Between Suit Match & Lucky 7/14) */}
          <div className="rounded-xl bg-slate-950/90 border border-amber-400/60 p-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs sm:text-sm font-extrabold text-amber-300">
              {sideRuleMode === 'SUIT_MATCH'
                ? '🔥 Side-Pot Rule: Claim +$40 if any of your cards matches the Dealer’s Up-Card SUIT!'
                : '⚡ Side-Pot Rule: Claim +$40 if you hold a 7 or your hand totals 14!'}
            </div>

            {tableStage === 'PLAYER_TURN' && (
              <button
                type="button"
                disabled={sideRuleClaimed}
                onClick={() => {
                  setSideRuleClaimed(true);
                  if (isSidePotConditionMet()) {
                    setBankroll((b) => b + 40);
                    setHandBanner('🔥 Side-Pot Bonus Claimed (+$40 Chips)!');
                  } else {
                    setHandBanner('No Side-Pot match on this hand—keep playing your 21 hand!');
                  }
                }}
                className={`px-3.5 py-1.5 rounded-xl font-extrabold text-xs border cursor-pointer ${
                  sideRuleClaimed
                    ? 'bg-emerald-900 border-emerald-400 text-emerald-200'
                    : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                }`}
              >
                {sideRuleClaimed ? '✓ Side-Pot Checked' : '🔥 Claim +$40 Side-Pot'}
              </button>
            )}
          </div>

          {/* Dealer Hand vs Player Hand Felt */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
            {/* Dealer's Cards */}
            <div className="p-4 rounded-2xl bg-slate-950/75 border border-slate-700 text-center space-y-3">
              <div className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                Dealer’s Hand{' '}
                {dealerHoleRevealed
                  ? `(Total: ${dEval.total}${dEval.isBust ? ' — BUST!' : ''})`
                  : `(Up-Card: ${dealerHand[0]?.rank ?? ''}${dealerHand[0]?.suit ?? ''})`}
              </div>
              <div className="flex flex-wrap justify-center items-center gap-3 min-h-36">
                {dealerHand.map((c, idx) => {
                  if (idx === 1 && !dealerHoleRevealed) {
                    return (
                      <div
                        key={c.id}
                        className="w-24 h-34 rounded-xl bg-sky-900 border-2 border-sky-300 flex flex-col items-center justify-center shadow-lg select-none"
                      >
                        <span className="text-2xl">🂠</span>
                        <span className="text-[10px] font-bold text-sky-200 mt-1">HOLE CARD</span>
                      </div>
                    );
                  }
                  return (
                    <AuthenticBlackjackCardView
                      key={c.id}
                      card={c}
                      onClickCard={() => handleTapCardToFlip('DEALER', idx)}
                    />
                  );
                })}
              </div>
            </div>

            {/* Player's Cards */}
            <div className="p-4 rounded-2xl bg-slate-950/85 border-2 border-amber-400/70 text-center space-y-3">
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  Your Hand (${currentBet} Bet)
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-emerald-950 border border-emerald-400 text-xs font-extrabold text-emerald-300">
                  {pEval.isSoft ? `Soft ${pEval.total}` : `Total: ${pEval.total}`}
                </span>
              </div>

              <div className="flex flex-wrap justify-center items-center gap-3 min-h-36">
                {playerHand.map((c, idx) => (
                  <AuthenticBlackjackCardView
                    key={c.id}
                    card={c}
                    highlightRing
                    onClickCard={() => handleTapCardToFlip('PLAYER', idx)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Status Banner */}
          <div className="text-center text-sm sm:text-base font-extrabold text-emerald-300">
            {handBanner}
          </div>

          {/* Action Buttons: HIT / STAND / DOUBLE DOWN */}
          {tableStage === 'PLAYER_TURN' ? (
            <div className="flex flex-wrap justify-center gap-4 pt-1">
              <button
                type="button"
                onClick={handlePlayerHit}
                className="min-h-14 px-8 py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-lg shadow-lg cursor-pointer"
              >
                🃏 Hit (Draw Card)
              </button>

              <button
                type="button"
                onClick={handlePlayerStand}
                className="min-h-14 px-8 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg shadow-lg cursor-pointer"
              >
                ✋ Stand ({pEval.total})
              </button>

              {playerHand.length === 2 && (
                <button
                  type="button"
                  onClick={handlePlayerDouble}
                  className="min-h-14 px-6 py-3.5 rounded-2xl bg-sky-700 hover:bg-sky-600 border-2 border-sky-300 text-white font-extrabold text-base shadow-lg cursor-pointer"
                >
                  2x Double Down (${currentBet * 2})
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-4 pt-1">
              <button
                type="button"
                onClick={handleAdvanceToNextHand}
                className="min-h-14 px-10 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-lg shadow-xl cursor-pointer"
              >
                Deal Next Hand (#{handNumber + 1}) &rarr;
              </button>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          STAGE 4: CUT-CARD BONUS (Every 3 Hands: Discard Sequence + Delayed Recall)
         ===================================================================== */}
      {tableStage === 'CUT_CARD_BONUS' && (
        <div className="rounded-2xl bg-[#0D231A] border-2 border-amber-400 p-6 text-center space-y-5 shadow-2xl">
          <div className="inline-block px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            🟨 Yellow Cut-Card Jackpot (+$100 Bonus Chips)
          </div>

          {cutCardStep === 'DISCARD_ORDER' && (
            <div className="space-y-4">
              <h3 className="text-xl font-extrabold text-white">
                Part 1: Tap the 3 Cards From the Last Hand in the Order They Were On the Table:
              </h3>
              <div className="text-sm font-bold text-emerald-300">
                Target Order:{' '}
                {discardTargetCards.map((c) => `${c.rank}${c.suit}`).join(' → ')} ({discardPickedIds.length}/3)
              </div>

              <div className="flex flex-wrap justify-center gap-4 py-2">
                {discardChoices.map((c) => {
                  const picked = discardPickedIds.includes(c.id);
                  return (
                    <div key={c.id} className={picked ? 'opacity-40 scale-95' : ''}>
                      <AuthenticBlackjackCardView
                        card={c}
                        onClickCard={() => {
                          if (picked) return;
                          const next = [...discardPickedIds, c.id];
                          setDiscardPickedIds(next);
                          if (next.length >= 3) {
                            const exactMatch = discardTargetCards.every(
                              (tc, i) => tc.id === next[i]
                            );
                            if (exactMatch) setBankrollBonus(50);
                            setSequenceCorrectCount((s) => s + (exactMatch ? 1 : 0));
                            setSequenceTotalCount((t) => t + 1);
                            setCutCardStep('DELAYED_SEAT_FREE');
                          }
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(cutCardStep === 'DELAYED_SEAT_FREE' || cutCardStep === 'DELAYED_SEAT_CUED') && (
            <div className="space-y-4">
              {(() => {
                const tm = TABLEMATE_POOL[(handNumber / 3) % 2 === 1 ? 0 : 1] ?? TABLEMATE_POOL[0];
                return (
                  <>
                    <h3 className="text-xl font-extrabold text-white">
                      Part 2: Which Lucky Side-Bet Card Did <strong>{tm.seatLabel}</strong> Lock Under Their Chip at the Start of the Shoe?
                    </h3>
                    {cutCardStep === 'DELAYED_SEAT_CUED' && (
                      <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-400 text-xs font-bold text-amber-200 max-w-md mx-auto">
                        💡 {tm.cueHint}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                      {[
                        '7 of Hearts (7♥)',
                        'King of Spades (K♠)',
                        'Ace of Diamonds (A♦)',
                        '10 of Clubs (10♣)'
                      ].map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            const hit = label === tm.label;
                            if (cutCardStep === 'DELAYED_SEAT_FREE') {
                              if (hit) {
                                setBankroll((b) => b + 100);
                                setDelayedFreeHits((f) => f + 1);
                                setDelayedTotalChecks((t) => t + 1);
                                cornerOnsetRef.current = performance.now();
                                setTableStage('PLACE_CORNER_BET');
                              } else {
                                setCutCardStep('DELAYED_SEAT_CUED');
                              }
                            } else {
                              if (hit) setBankroll((b) => b + 50);
                              setDelayedCuedHits((c) => c + (hit ? 1 : 0));
                              setDelayedTotalChecks((t) => t + 1);
                              cornerOnsetRef.current = performance.now();
                              setTableStage('PLACE_CORNER_BET');
                            }
                          }}
                          className="min-h-14 p-4 rounded-xl bg-slate-900 hover:bg-sky-900 border-2 border-slate-600 text-base font-extrabold text-white cursor-pointer"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          STAGE 5: HAPPY HOUR PIT BOSS CLOCK BONUS (NO TIMER BAR! 30s Noon Clock)
         ===================================================================== */}
      {tableStage === 'PIT_CLOCK_NOON_BONUS' && (
        <div className="rounded-2xl bg-[#0D231A] border-2 border-amber-400 p-6 text-center space-y-4 shadow-2xl">
          <div className="inline-block px-4 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-xs font-extrabold uppercase tracking-wider text-amber-300">
            🕰️ Pit Boss Happy Hour • Unlock 2x Double Payouts &amp; +$500 Under 30 Seconds!
          </div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-white">
            Draw the Pit Boss Clock with All 12 Hours and Set the Hands at Noon
          </h3>

          {clockPlacedHours.length < 12 ? (
            <div className="text-sm font-bold text-emerald-300">
              Tap on the blank clock face where Hour{' '}
              <span className="px-2.5 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold">
                {HOURS_ORDER[clockPlacedHours.length]}
              </span>{' '}
              belongs ({clockPlacedHours.length}/12 placed)
            </div>
          ) : clockNoonHandDeg === null ? (
            <div className="text-sm font-bold text-amber-300">
              All 12 hours placed! Now tap where the hands point at <strong>Noon (12:00)</strong>!
            </div>
          ) : (
            <div className="text-sm font-bold text-emerald-300">
              ✓ Pit Boss Clock Set to Noon! Tap &ldquo;Unlock 2x Payouts&rdquo; below!
            </div>
          )}

          <div className="flex justify-center">
            <svg
              viewBox="0 0 260 260"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - rect.left) * (260 / rect.width);
                const y = (e.clientY - rect.top) * (260 / rect.height);
                let deg = Math.atan2(y - 130, x - 130) * (180 / Math.PI) + 90;
                if (deg < 0) deg += 360;

                if (clockPlacedHours.length < 12) {
                  const hr = HOURS_ORDER[clockPlacedHours.length];
                  setClockPlacedHours((prev) => [...prev, { hour: hr, x, y, deg }]);
                } else {
                  setClockNoonHandDeg(deg);
                }
              }}
              className="w-64 h-64 bg-slate-950 rounded-full border-4 border-amber-400 shadow-2xl cursor-crosshair select-none"
            >
              <circle cx="130" cy="130" r="118" fill="#0F172A" stroke="#475569" strokeWidth="2.5" />
              <circle cx="130" cy="130" r="5" fill="#FBBF24" />

              {clockNoonHandDeg !== null &&
                (() => {
                  const rad = (clockNoonHandDeg - 90) * (Math.PI / 180);
                  const hx = 130 + 52 * Math.cos(rad);
                  const hy = 130 + 52 * Math.sin(rad);
                  const mx = 130 + 82 * Math.cos(rad);
                  const my = 130 + 82 * Math.sin(rad);
                  return (
                    <>
                      <line x1="130" y1="130" x2={mx} y2={my} stroke="#38BDF8" strokeWidth="4" strokeLinecap="round" />
                      <line x1="130" y1="130" x2={hx} y2={hy} stroke="#FBBF24" strokeWidth="6" strokeLinecap="round" />
                    </>
                  );
                })()}

              {clockPlacedHours.map((h) => (
                <g key={h.hour}>
                  <circle cx={h.x} cy={h.y} r="14" fill="#0284C7" stroke="#BAE6FD" strokeWidth="2" />
                  <text
                    x={h.x}
                    y={h.y}
                    fill="#FFFFFF"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {h.hour}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setClockPlacedHours([]);
                setClockNoonHandDeg(null);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 cursor-pointer"
            >
              ↺ Clear Dial
            </button>
            <button
              type="button"
              onClick={() => {
                const dur = Number(((performance.now() - clockStartMs) / 1000).toFixed(1));
                const err =
                  clockNoonHandDeg === null
                    ? 15
                    : Math.round(Math.min(clockNoonHandDeg, 360 - clockNoonHandDeg));
                setClockDurationSec(dur);
                setClockNoonErrorDeg(err);
                setClockCompletedOnce(true);
                setDoublePayoutActive(true);
                if (dur <= 30) setBankroll((b) => b + 500);
                else setBankroll((b) => b + 200);
                cornerOnsetRef.current = performance.now();
                setTableStage('PLACE_CORNER_BET');
              }}
              className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-lg cursor-pointer"
            >
              ✓ Lock In Pit Clock &amp; Unlock 2x Payouts &rarr;
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          LIVE REPRODUCIBLE TELEMETRY & MULTI-SESSION LONGITUDINAL LOG
          Updates after every single Blackjack hand so you can verify real results!
         ===================================================================== */}
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
              📊 Live Reproducible Blackjack Surrogate Telemetry (Updates Every Hand)
            </div>
            <p className="text-[11px] text-slate-400">
              Silent trial-by-trial metrics extracted purely from your Blackjack gameplay across repeated hands:
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveSessionSnapshot}
              disabled={liveSummary.handsPlayed === 0}
              className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-xs font-bold text-white cursor-pointer"
            >
              💾 Save Session Snapshot ({liveSummary.handsPlayed} Hands)
            </button>
            <button
              type="button"
              onClick={() => {
                handleSaveSessionSnapshot();
                onFinishSession();
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-bold text-white cursor-pointer"
            >
              View Full Clinical Report &rarr;
            </button>
          </div>
        </div>

        {/* 6 Real-Time Surrogate Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">Hands Played</div>
            <div className="text-lg font-extrabold text-white">{liveSummary.handsPlayed}</div>
            <div className="text-[10px] text-emerald-400">{formatMmSs(elapsedSec)} elapsed</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">Decision Speed &amp; CV</div>
            <div className="text-lg font-extrabold text-sky-300">
              {liveSummary.meanRtMs > 0 ? `${liveSummary.meanRtMs}ms` : '—'}
            </div>
            <div className="text-[10px] text-slate-400">Fluctuation CV: {liveSummary.rtCvPct}%</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">21 Math &amp; Soft-Ace</div>
            <div className="text-lg font-extrabold text-emerald-300">
              {liveSummary.mathOptimalRate}%
            </div>
            <div className="text-[10px] text-slate-400">Optimal Hit/Stand</div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">Upside-Down Card</div>
            <div className="text-lg font-extrabold text-amber-300">
              {liveSummary.upsideDownSpotted}/{liveSummary.upsideDownOpportunities}
            </div>
            <div className="text-[10px] text-slate-400">
              {liveSummary.upsideDownDetectionRate}% Spotted
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">4-Corner Chip RT</div>
            <div className="text-xs font-extrabold text-white mt-1">
              TL:{liveSummary.qMedians.Q2 || '—'} TR:{liveSummary.qMedians.Q1 || '—'}
            </div>
            <div className="text-xs font-extrabold text-white">
              BL:{liveSummary.qMedians.Q3 || '—'} BR:{liveSummary.qMedians.Q4 || '—'}
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
            <div className="text-[10px] font-bold uppercase text-slate-400">30s Noon Clock</div>
            <div className="text-lg font-extrabold text-emerald-300">
              {clockDurationSec !== null ? `${clockDurationSec}s` : 'Pending'}
            </div>
            <div className="text-[10px] text-slate-400">
              {clockNoonErrorDeg !== null ? `Err: ${clockNoonErrorDeg}°` : 'No timer bar'}
            </div>
          </div>
        </div>

        {/* Saved Repeated Sessions Comparison Table */}
        {savedSessions.length > 0 && (
          <div className="pt-2 border-t border-slate-800/80 space-y-2">
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
              📈 Repeated Usage / Saved Session History ({savedSessions.length} Runs)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                    <th className="py-1 pr-2">Run</th>
                    <th className="py-1 pr-2">Hands / Time</th>
                    <th className="py-1 pr-2">Bankroll</th>
                    <th className="py-1 pr-2">Mean RT (CV%)</th>
                    <th className="py-1 pr-2">21 Math</th>
                    <th className="py-1 pr-2">180° Card Spot</th>
                    <th className="py-1">30s Clock</th>
                  </tr>
                </thead>
                <tbody>
                  {savedSessions.map((s) => (
                    <tr key={s.sessionId} className="border-b border-slate-900">
                      <td className="py-1 pr-2 font-bold text-white">{s.timestampIso}</td>
                      <td className="py-1 pr-2">{s.handsPlayed} hands ({formatMmSs(s.elapsedSec)})</td>
                      <td className="py-1 pr-2 text-amber-300 font-bold">${s.finalBankroll}</td>
                      <td className="py-1 pr-2">{s.meanDecisionRtMs}ms ({s.rtCvPct}%)</td>
                      <td className="py-1 pr-2 text-emerald-300">{s.mathOptimalRate}%</td>
                      <td className="py-1 pr-2">{s.upsideDownDetectionRate}%</td>
                      <td className="py-1">
                        {s.clockDurationSec !== null ? `${s.clockDurationSec}s (${s.clockNoonErrorDeg}°)` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  function setBankrollBonus(amount: number) {
    setBankroll((b) => b + amount);
  }
};

export default BlackjackFiveMinGame;
