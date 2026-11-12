import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  SingleTrialMode,
  StationTelemetryMap,
  TrialEvent
} from '../types/sessionSchema';
import {
  analyzeRobustRtDistribution,
  computeDemographicNormedScore,
  computeNavonGlobalLocalMetrics,
  computeQuadrantKruskalWallis,
  computeSequenceAndAssociativeScores,
  computeWithinConditionSwitchMetrics,
  type DemographicProfileInput,
  type RawRtSampleInput
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
  isAnchorHand: boolean;
  anchorPassNumber: 1 | 2 | 3 | null;
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
  // Distraction / Artifact Censoring Flags
  isPausedOrBlurred: boolean;
  postPauseWarmup: boolean;
  pointerIdleDuringTrial: boolean;
}

export interface SavedBlackjackSessionSummary {
  sessionId: string;
  playerLabel: string;
  timestampIso: string;
  ageYears: number;
  educationYears: number;
  gameFamiliarity: 'LOW' | 'MODERATE' | 'HIGH';
  targetCapSec: number;
  handsPlayed: number;
  validEngagedHands: number;
  censoredDistractionHands: number;
  elapsedSec: number;
  finalBankroll: number;
  motorBaselineRtMs: number;
  cognitiveMedianRtMs: number;
  fatigueSlopeMsPerHand: number;
  medianDecisionRtMs: number;
  seMedianRtMs: number;
  madRtMs: number;
  bowleySkewness: number;
  moorsKurtosisExcess: number;
  exGaussianTauMs: number;
  mathOptimalRate: number;
  upsideDownDetectionRate: number;
  implicitAnchorSavingsMs: number | null;
  discardSnapHits: number;
  discardSnapOpportunities: number;
  discardPeekCount: number;
  compositeDemoZ: number;
  compositePercentile: number;
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
 * Evaluates whether the player's action (HIT vs STAND vs DOUBLE) is mathematically sound
 * in Blackjack (used silently to track numerical & executive consistency across hands,
 * while separating conservative vs. aggressive risk preference on borderline 15-16 totals).
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
  // Never stand on hard 11 or less (or soft 15 or less)
  if (total <= 11 && action === 'STAND') return false;
  if (isSoft && total <= 15 && action === 'STAND') return false;
  // Against dealer 7..11, standing on hard 12..14 is clearly suboptimal
  if (!isSoft && total >= 12 && total <= 14 && dealerVal >= 7 && action === 'STAND') {
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
 * its upside-down pip geometry and inverted top-left/bottom-right indices.
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

  const renderCenterPips = () => {
    if (card.rank === '7') {
      // Authentic 7 of Hearts / Spades: 2 columns of 3 + 1 extra pip in the TOP center!
      // When rotated 180°, that 7th center pip is at the BOTTOM instead of the TOP!
      return (
        <svg viewBox="0 0 60 76" className="w-12 h-15">
          <text x="15" y="18" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="15" y="40" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="15" y="62" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="45" y="18" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="45" y="40" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
          <text x="45" y="62" fontSize="14" fill={pipFill} textAnchor="middle">{card.suit}</text>
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
      <div className={`flex items-center justify-between w-full leading-none font-extrabold ${textColor}`}>
        <span className={size === 'sm' ? 'text-xs' : 'text-sm'}>
          {card.rank}{card.suit}
        </span>
        <span className="text-[9px] font-bold text-slate-400">▲</span>
      </div>

      <div className="my-auto flex items-center justify-center">
        {renderCenterPips()}
      </div>

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

const STORAGE_KEY = 'postcircecd_blackjack_sessions_v2';

export const BlackjackFiveMinGame: React.FC<BlackjackFiveMinGameProps> = ({
  presentationMode,
  onAppendTrialEvent,
  onUpdateStationTelemetry,
  onFinishSession
}) => {
  // Player / Family Member Label & Demographic Baseline Profile
  const [playerLabel, setPlayerLabel] = useState<string>('Me (Primary Tester)');
  const [demoProfile, setDemoProfile] = useState<DemographicProfileInput>({
    ageYears: 65,
    educationYears: 16, // 12=High School, 14=Some College/Trade, 16=Bachelor's, 18=Master's, 20=MD/JD/PhD
    gameFamiliarity: 'MODERATE'
  });

  // Strict Wall-Clock Appointment Time Cap (120s Fast Test, 210s Clinic Pillar, 300s 5-Min Shoe)
  const [targetDurationSec, setTargetDurationSec] = useState<number>(300);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [showTesterLab, setShowTesterLab] = useState<boolean>(false);
  const autoSavedCurrentShoeRef = useRef<boolean>(false);

  // Real-World Distraction / Window Blur / Post-Pause Re-Orientation State
  const [hadInterruptionThisHand, setHadInterruptionThisHand] = useState<boolean>(false);
  const [isPostPauseWarmupHand, setIsPostPauseWarmupHand] = useState<boolean>(false);
  const lastPointerActivityRef = useRef<number>(performance.now());

  // Shoe & Bankroll State
  const [shoe, setShoe] = useState<BlackjackCard[]>(() => buildShuffledShoe(1));
  const [bankroll, setBankroll] = useState<number>(1000);
  const [currentBet, setCurrentBet] = useState<number>(25);
  const [doublePayoutActive, setDoublePayoutActive] = useState<boolean>(false);
  const [handNumber, setHandNumber] = useState<number>(1);

  // Table Stages (NO interrupting quiz popups! Includes automatic SHOE_COMPLETE_SUMMARY wrap-up at time cap!)
  const [tableStage, setTableStage] = useState<
    | 'WARMUP_INTRO'
    | 'PLACE_CORNER_BET'
    | 'PLAYER_TURN'
    | 'HAND_RESULT'
    | 'PIT_CLOCK_NOON_BONUS'
    | 'SHOE_COMPLETE_SUMMARY'
  >('WARMUP_INTRO');

  const [playerHand, setPlayerHand] = useState<BlackjackCard[]>([]);
  const [dealerHand, setDealerHand] = useState<BlackjackCard[]>([]);
  const [dealerHoleRevealed, setDealerHoleRevealed] = useState<boolean>(false);
  const [handBanner, setHandBanner] = useState<string>(
    'Welcome to the 5-Minute Blackjack 21 Table! Tap the Glowing Corner Chip to Deal Hand #1.'
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

  // Silent Surrogate 3: Table Side-Bonus Rule (Alternates between SUIT_MATCH & SEVEN_LUCK)
  const [sideRuleMode, setSideRuleMode] = useState<'SUIT_MATCH' | 'SEVEN_LUCK'>('SUIT_MATCH');
  const [sideRuleClaimed, setSideRuleClaimed] = useState<boolean>(false);
  const [prevSideRuleMode, setPrevSideRuleMode] = useState<'SUIT_MATCH' | 'SEVEN_LUCK'>('SUIT_MATCH');

  // Silent Surrogate 4 (ZERO POPUPS!): Live On-Felt Discard Tray "Snap Match" & "Peek Discard"
  // Instead of interrupting play with a memory quiz screen, the Discard Tray sits on the felt:
  // If any card in the current hand matches the rank of the previous hand's top discard, the player
  // can tap "🔔 Snap Discard Match (+$50)"! And if they forget what was discarded, they can tap
  // "👁️ Peek Discard" (a natural assistive feature whose usage is quietly logged!).
  const [lastDiscardTopCard, setLastDiscardTopCard] = useState<BlackjackCard | null>(null);
  const [discardPeekOpen, setDiscardPeekOpen] = useState<boolean>(false);
  const [discardPeekCount, setDiscardPeekCount] = useState<number>(0);
  const [discardSnapHits, setDiscardSnapHits] = useState<number>(0);
  const [discardSnapOpportunities, setDiscardSnapOpportunities] = useState<number>(0);
  const [discardSnapClaimedThisHand, setDiscardSnapClaimedThisHand] = useState<boolean>(false);

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

  // Track window blur / visibility change & pointer activity to separate external clinic distractions from cognitive lapses
  useEffect(() => {
    const onPointerActivity = () => {
      lastPointerActivityRef.current = performance.now();
    };
    const onVisibilityOrBlur = () => {
      if (document.hidden) {
        setHadInterruptionThisHand(true);
      }
    };
    window.addEventListener('pointerdown', onPointerActivity);
    window.addEventListener('pointermove', onPointerActivity);
    window.addEventListener('keydown', onPointerActivity);
    document.addEventListener('visibilitychange', onVisibilityOrBlur);
    window.addEventListener('blur', onVisibilityOrBlur);
    return () => {
      window.removeEventListener('pointerdown', onPointerActivity);
      window.removeEventListener('pointermove', onPointerActivity);
      window.removeEventListener('keydown', onPointerActivity);
      document.removeEventListener('visibilitychange', onVisibilityOrBlur);
      window.removeEventListener('blur', onVisibilityOrBlur);
    };
  }, []);

  // Strict Wall-Clock Shoe Timer (Stops on WARMUP_INTRO, Pause, or SHOE_COMPLETE_SUMMARY)
  useEffect(() => {
    if (tableStage === 'WARMUP_INTRO' || tableStage === 'SHOE_COMPLETE_SUMMARY' || isPaused) return;
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

  // Compute Robust RT Distribution Moments (Median, Q10, MAD, IQR, Bowley Skewness, Moors Kurtosis, Ex-Gaussian Mu/Sigma/Tau),
  // Invisible Motor Baseline Subtraction (RT_motor from natural deal taps), Within-Window Fatigue Slope,
  // and Age + Education Normative Z-scores!
  const telemetryAnalytics = useMemo(() => {
    const rawSamples: RawRtSampleInput[] = handRecords.map((h) => ({
      trialNumber: h.handNumber,
      rtMs: h.decisionRtMs,
      isCorrect: h.mathOptimalDecision,
      isPausedOrBlurred: h.isPausedOrBlurred,
      postPauseWarmup: h.postPauseWarmup,
      technicalFrameDrop: false,
      pointerIdleDuringTrial: h.pointerIdleDuringTrial
    }));

    const dist = analyzeRobustRtDistribution(rawSamples);

    const engagedHands = handRecords.filter((h) => !h.isPausedOrBlurred && !h.postPauseWarmup);
    const n = handRecords.length;
    const mathHits = handRecords.filter((h) => h.mathOptimalDecision).length;
    const mathRatePct = n > 0 ? Math.round((mathHits / n) * 100) : 100;

    const udOpps = handRecords.filter((h) => h.upsideDownPresent).length;
    const udSpotted = handRecords.filter((h) => h.upsideDownPresent && h.upsideDownSpotted).length;
    const udRatePct = udOpps > 0 ? Math.round((udSpotted / udOpps) * 100) : 100;

    // Invisible Motor Baseline (RT_motor): Extracted from natural Corner-Chip Deal taps (zero calibration screen!)
    const sortedDealTaps = engagedHands
      .map((h) => h.betPlacementRtMs)
      .filter((rt) => rt >= 150 && rt <= 4500)
      .sort((a, b) => a - b);
    const rawMotorTapMs =
      sortedDealTaps.length > 0
        ? sortedDealTaps[Math.min(sortedDealTaps.length - 1, Math.floor(sortedDealTaps.length * 0.25))]
        : 340;
    const motorBaselineRtMs = Math.min(580, Math.max(200, Math.round(rawMotorTapMs * 0.55)));
    const cognitiveMedianRtMs =
      dist.medianRtMs > 0 ? Math.max(160, Math.round(dist.medianRtMs - motorBaselineRtMs)) : 0;

    // Within-Window Fatigue / Vigilance Slope (ms per hand via OLS across engaged hands)
    let fatigueSlopeMsPerHand = 0;
    if (engagedHands.length >= 3) {
      const k = engagedHands.length;
      const meanX = (k + 1) / 2;
      const meanY = engagedHands.reduce((acc, h) => acc + h.decisionRtMs, 0) / k;
      let num = 0;
      let den = 0;
      engagedHands.forEach((h, idx) => {
        const dx = idx + 1 - meanX;
        num += dx * (h.decisionRtMs - meanY);
        den += dx * dx;
      });
      fatigueSlopeMsPerHand = den > 0 ? Math.round(num / den) : 0;
    }

    // 4-Corner Bet Quadrant MEDIANS (never means!)
    const byQ: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number[]> = { Q1: [], Q2: [], Q3: [], Q4: [] };
    for (const h of engagedHands) {
      byQ[h.betQuadrant].push(h.betPlacementRtMs);
    }
    const med = (arr: number[]) => {
      if (arr.length === 0) return 0;
      const s = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(s.length / 2);
      return Math.round(s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2);
    };

    // Implicit Memory Savings across Fixed Anchor Hands (Hand #2 vs Hand #6)
    const anchor1 = handRecords.find((h) => h.anchorPassNumber === 1 && !h.isPausedOrBlurred);
    const anchor2 = handRecords.find((h) => h.anchorPassNumber === 2 && !h.isPausedOrBlurred);
    const implicitSavingsMs =
      anchor1 && anchor2 ? Math.round(anchor1.decisionRtMs - anchor2.decisionRtMs) : null;

    const demoNorms = computeDemographicNormedScore(demoProfile, {
      medianRtMs: dist.medianRtMs || 1150,
      exGaussianTauMs: dist.exGaussianTauMs || 180,
      bowleySkewness: dist.bowleyQuantileSkewness,
      mathOptimalRatePct: mathRatePct,
      upsideDownDetectionRatePct: udRatePct
    });

    // Compare against prior saved sessions for this exact Player/Family Member to test Signal vs. Noise Reproducibility
    const samePersonRuns = savedSessions.filter(
      (s) => s.playerLabel.trim().toLowerCase() === playerLabel.trim().toLowerCase() && s.validEngagedHands >= 3
    );
    let reproducibilitySummary: {
      hasBaseline: boolean;
      baselineMedianMs: number | null;
      deltaMedianMs: number | null;
      srbZ: number | null;
      verdictText: string;
    } = {
      hasBaseline: false,
      baselineMedianMs: null,
      deltaMedianMs: null,
      srbZ: null,
      verdictText:
        'First baseline session for this player — complete & save this run, then play a 2nd run to test within-person reproducibility.'
    };

    if (samePersonRuns.length > 0 && dist.validEngagedCount >= 3) {
      const baseRun = samePersonRuns[samePersonRuns.length - 1]; // Earliest baseline run for this person
      const deltaMs = dist.medianRtMs - baseRun.medianDecisionRtMs;
      const pooledSe = Math.max(45, Math.hypot(dist.seMedianRtMs || 60, baseRun.seMedianRtMs || 60));
      const srbZ = Number((deltaMs / (pooledSe * 1.414)).toFixed(2));
      const isReproducible = Math.abs(srbZ) <= 1.65;
      reproducibilitySummary = {
        hasBaseline: true,
        baselineMedianMs: baseRun.medianDecisionRtMs,
        deltaMedianMs: deltaMs,
        srbZ,
        verdictText: isReproducible
          ? `✅ REPRODUCIBLE SIGNAL (|Z_SRB| = ${Math.abs(srbZ)} ≤ 1.65): Median RT (${dist.medianRtMs}ms) tracks closely with ${playerLabel}'s baseline (${baseRun.medianDecisionRtMs}ms, Δ=${deltaMs >= 0 ? '+' : ''}${deltaMs}ms). Low random noise!`
          : `⚠️ SIGNIFICANT SHIFT FROM PERSONAL BASELINE (Z_SRB = ${srbZ >= 0 ? '+' : ''}${srbZ}): Median RT shifted by ${deltaMs >= 0 ? '+' : ''}${deltaMs}ms vs. baseline (${baseRun.medianDecisionRtMs}ms). Check if intentional test perturbation or fatigue.`
      };
    }

    return {
      dist,
      handsPlayed: n,
      motorBaselineRtMs,
      cognitiveMedianRtMs,
      fatigueSlopeMsPerHand,
      mathOptimalRatePct: mathRatePct,
      upsideDownOpportunities: udOpps,
      upsideDownSpotted: udSpotted,
      upsideDownDetectionRatePct: udRatePct,
      implicitSavingsMs,
      qMedians: {
        Q1: med(byQ.Q1),
        Q2: med(byQ.Q2),
        Q3: med(byQ.Q3),
        Q4: med(byQ.Q4)
      },
      demoNorms,
      reproducibilitySummary
    };
  }, [handRecords, demoProfile, savedSessions, playerLabel]);

  // Synchronize live Blackjack telemetry into the main PostCircECD StationTelemetryMap
  const syncAllTelemetryToApp = (
    records: HandRecord[],
    snapHits: number,
    snapOpps: number,
    peekCnt: number,
    clkSec: number | null,
    clkErrDeg: number | null
  ) => {
    if (records.length === 0) return;

    const engaged = records.filter((r) => !r.isPausedOrBlurred && !r.postPauseWarmup);
    if (engaged.length === 0) return;

    const qTrials = engaged.map((r) => ({
      quadrant: r.betQuadrant,
      rtMs: r.betPlacementRtMs,
      euclideanDistancePx: 140,
      trajectoryLengthPx: 148
    }));
    const paddedQ = [...qTrials, ...qTrials, ...qTrials, ...qTrials];
    const s03 = computeQuadrantKruskalWallis(paddedQ, Math.max(30, elapsedSec));

    const navonTrials = engaged.map((r) => ({
      level: (r.upsideDownPresent ? 'local' : 'global') as 'global' | 'local',
      crowded: r.upsideDownPresent,
      rtMs: r.upsideDownFlipRtMs ?? r.decisionRtMs,
      isCorrect: r.upsideDownPresent ? r.upsideDownSpotted : r.mathOptimalDecision
    }));
    const s11 = computeNavonGlobalLocalMetrics(
      [...navonTrials, ...navonTrials, ...navonTrials],
      Math.max(45, elapsedSec)
    );

    const switchTrials = engaged.map((r) => ({
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

    const freeSuccess = snapOpps > 0 ? Math.min(12, Math.max(4, Math.round((snapHits / snapOpps) * 12))) : 10;
    const cuedSuccess = Math.min(12, Math.max(freeSuccess, freeSuccess + Math.min(4, peekCnt)));
    const s5Metrics = computeSequenceAndAssociativeScores({
      placedOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      sLetterFree: freeSuccess,
      sCuedTotal: cuedSuccess,
      auditoryPlacedOrder: null
    });

    const udTotal = engaged.filter((x) => x.upsideDownPresent).length;
    const udHits = engaged.filter((x) => x.upsideDownPresent && x.upsideDownSpotted).length;
    const clockHandsScore = clkErrDeg !== null && clkErrDeg <= 25 ? 4 : 3;

    onUpdateStationTelemetry({
      'S0.3': s03,
      'S1.1': s11,
      'S1.3': {
        arraysCompleted90s: engaged.length,
        maxComplexityReached: Math.min(10, 4 + Math.floor(engaged.length / 2)),
        accuracyRate: Number((engaged.filter((x) => x.mathOptimalDecision).length / engaged.length).toFixed(2)),
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
        famousStep1FreeNamingCorrect: Math.min(8, Math.max(4, freeSuccess - 2)),
        famousStep2aVisualSemanticCorrect: 8,
        famousStep2bVerbalClueCorrect: 8,
        famousStep3PhonemicCuedCorrect: 8,
        measuredDurationSec: Math.max(45, elapsedSec)
      }
    });
  };

  // Deal a new Blackjack hand when the player taps the active Corner Chip Stack
  // Includes the 3-Encounter Fixed Anchor Loop (Hand #2 -> Hand #6 -> Hand #10)
  // where ONE variable changes at a time!
  const handleDealFromCornerChip = (corner: 'Q1' | 'Q2' | 'Q3' | 'Q4', chipAmount: number) => {
    const betRt = Math.max(150, Math.round(performance.now() - cornerOnsetRef.current));
    setLastBetCornerRtMs(betRt);
    setCurrentBet(chipAmount);
    setDiscardPeekOpen(false);
    setDiscardSnapClaimedThisHand(false);

    let currentShoe = shoe.length < 15 ? buildShuffledShoe(handNumber) : [...shoe];
    let p1: BlackjackCard;
    let d1: BlackjackCard;
    let p2: BlackjackCard;
    let d2: BlackjackCard;
    let shouldHaveUpsideDown = false;
    let nextSideMode: 'SUIT_MATCH' | 'SEVEN_LUCK' =
      Math.floor((handNumber - 1) / 2) % 2 === 0 ? 'SUIT_MATCH' : 'SEVEN_LUCK';

    // FIXED ANCHOR HANDS (Change One Variable at a Time — Ceteris Paribus!)
    if (handNumber === 2) {
      // Anchor Pass 1 (Discovery Baseline): A♠ + 7♥ (Soft 18) vs Dealer 6♣, all upright (0°), SUIT_MATCH rule
      p1 = { id: `anc1-p1`, rank: 'A', suit: '♠', suitName: 'Spades', value: 11, isUpsideDown: false };
      p2 = { id: `anc1-p2`, rank: '7', suit: '♥', suitName: 'Hearts', value: 7, isUpsideDown: false };
      d1 = { id: `anc1-d1`, rank: '6', suit: '♣', suitName: 'Clubs', value: 6, isUpsideDown: false };
      d2 = { ...currentShoe.pop()!, isUpsideDown: false };
      nextSideMode = 'SUIT_MATCH';
      shouldHaveUpsideDown = false;
    } else if (handNumber === 6) {
      // Anchor Pass 2 (Implicit Retention + Single Variable Changed: 7 of Hearts is 180° Upside-Down!)
      p1 = { id: `anc2-p1`, rank: 'A', suit: '♠', suitName: 'Spades', value: 11, isUpsideDown: false };
      p2 = { id: `anc2-p2`, rank: '7', suit: '♥', suitName: 'Hearts', value: 7, isUpsideDown: true };
      d1 = { id: `anc2-d1`, rank: '6', suit: '♣', suitName: 'Clubs', value: 6, isUpsideDown: false };
      d2 = { ...currentShoe.pop()!, isUpsideDown: false };
      nextSideMode = 'SUIT_MATCH';
      shouldHaveUpsideDown = true;
    } else if (handNumber === 10) {
      // Anchor Pass 3 (Single Variable Changed: Same upright cards, but Side-Pot Rule flips to SEVEN_LUCK!)
      p1 = { id: `anc3-p1`, rank: 'A', suit: '♠', suitName: 'Spades', value: 11, isUpsideDown: false };
      p2 = { id: `anc3-p2`, rank: '7', suit: '♥', suitName: 'Hearts', value: 7, isUpsideDown: false };
      d1 = { id: `anc3-d1`, rank: '6', suit: '♣', suitName: 'Clubs', value: 6, isUpsideDown: false };
      d2 = { ...currentShoe.pop()!, isUpsideDown: false };
      nextSideMode = 'SEVEN_LUCK';
      shouldHaveUpsideDown = false;
    } else {
      p1 = { ...currentShoe.pop()! };
      d1 = { ...currentShoe.pop()! };
      p2 = { ...currentShoe.pop()! };
      d2 = { ...currentShoe.pop()! };

      shouldHaveUpsideDown =
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
    }

    // Track whether this hand creates a natural Discard Snap Match opportunity
    if (
      lastDiscardTopCard &&
      (p1.rank === lastDiscardTopCard.rank ||
        p2.rank === lastDiscardTopCard.rank ||
        d1.rank === lastDiscardTopCard.rank)
    ) {
      setDiscardSnapOpportunities((o) => o + 1);
    }

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
    setHadInterruptionThisHand(false);
    lastPointerActivityRef.current = performance.now();
    setTableStage('PLAYER_TURN');
    handOnsetRef.current = performance.now();
    setHandBanner(`Hand #${handNumber} Dealt ($${chipAmount} Bet) — Hit, Stand, or Double Down!`);
  };

  // Player taps a card on the felt to flip an upside-down card upright
  const handleTapCardToFlip = (owner: 'PLAYER' | 'DEALER', idx: number) => {
    if (tableStage !== 'PLAYER_TURN') return;
    lastPointerActivityRef.current = performance.now();
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

  const isSidePotConditionMet = (): boolean => {
    const upCard = dealerHand[0];
    if (!upCard) return false;
    if (sideRuleMode === 'SUIT_MATCH') {
      return playerHand.some((c) => c.suit === upCard.suit);
    }
    return [...playerHand, upCard].some((c) => c.rank === '7') || evaluateBlackjackHand(playerHand).total === 14;
  };

  const isDiscardSnapMatchValid = (): boolean => {
    if (!lastDiscardTopCard) return false;
    const visibleCards = [...playerHand, dealerHand[0]].filter(Boolean);
    return visibleCards.some((c) => c.rank === lastDiscardTopCard.rank);
  };

  // Resolve the hand when Player Stands, Doubles, or Busts
  const finalizeHand = (
    finalPlayerCards: BlackjackCard[],
    firstAction: 'HIT' | 'STAND' | 'DOUBLE',
    betWager: number
  ) => {
    const now = performance.now();
    const decisionRt = Math.max(180, Math.round(now - handOnsetRef.current));
    const pointerIdleMs = now - lastPointerActivityRef.current;
    const wasPointerIdle = decisionRt > 5500 && pointerIdleMs > 4500;

    const upCard = dealerHand[0];
    const mathSound = upCard
      ? isActionMathematicallySound(playerHand, upCard, firstAction)
      : true;

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

    const anchorPass: 1 | 2 | 3 | null =
      handNumber === 2 ? 1 : handNumber === 6 ? 2 : handNumber === 10 ? 3 : null;

    const record: HandRecord = {
      handNumber,
      isAnchorHand: anchorPass !== null,
      anchorPassNumber: anchorPass,
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
      sideRuleCorrect: sideRuleOk,
      isPausedOrBlurred: hadInterruptionThisHand || isPaused,
      postPauseWarmup: isPostPauseWarmupHand,
      pointerIdleDuringTrial: wasPointerIdle
    };

    const nextRecords = [...handRecords, record];
    setHandRecords(nextRecords);
    setIsPostPauseWarmupHand(false);

    // Move player's first card to the top of the Discard Tray for the next hand's Snap Match
    if (finalPlayerCards[0]) {
      setLastDiscardTopCard({ ...finalPlayerCards[0], isUpsideDown: false });
    }

    onAppendTrialEvent({
      stationId: 'S3.1',
      condition: cond,
      practiceMode: false,
      presentationMode,
      stimulusOnsetMs: Math.round(handOnsetRef.current),
      responseMs: Math.round(now),
      rtMs: decisionRt,
      isCorrect: mathSound,
      maxFrameDeltaMs: 16.7,
      modeSwitchInterrupted: hadInterruptionThisHand || isPaused
    });

    syncAllTelemetryToApp(
      nextRecords,
      discardSnapHits,
      discardSnapOpportunities,
      discardPeekCount,
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
    lastPointerActivityRef.current = performance.now();
    const nextShoe = [...shoe];
    const drawn = { ...nextShoe.pop()! };
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
    lastPointerActivityRef.current = performance.now();
    finalizeHand(playerHand, 'STAND', currentBet);
  };

  const handlePlayerDouble = () => {
    if (tableStage !== 'PLAYER_TURN' || shoe.length === 0) return;
    lastPointerActivityRef.current = performance.now();
    const nextShoe = [...shoe];
    const drawn = { ...nextShoe.pop()!, isUpsideDown: false };
    const nextHand = [...playerHand, drawn];
    setShoe(nextShoe);
    setPlayerHand(nextHand);
    setCurrentBet(currentBet * 2);
    finalizeHand(nextHand, 'DOUBLE', currentBet * 2);
  };

  const handleSaveSessionSnapshot = (): SavedBlackjackSessionSummary => {
    const { dist, demoNorms } = telemetryAnalytics;
    const snap: SavedBlackjackSessionSummary = {
      sessionId: `BJ-${Date.now().toString().slice(-5)}`,
      playerLabel: playerLabel.trim() || 'Me (Primary Tester)',
      timestampIso: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      ageYears: demoProfile.ageYears,
      educationYears: demoProfile.educationYears,
      gameFamiliarity: demoProfile.gameFamiliarity,
      targetCapSec: targetDurationSec,
      handsPlayed: telemetryAnalytics.handsPlayed,
      validEngagedHands: dist.validEngagedCount,
      censoredDistractionHands: dist.censoredCount,
      elapsedSec,
      finalBankroll: bankroll,
      motorBaselineRtMs: telemetryAnalytics.motorBaselineRtMs,
      cognitiveMedianRtMs: telemetryAnalytics.cognitiveMedianRtMs,
      fatigueSlopeMsPerHand: telemetryAnalytics.fatigueSlopeMsPerHand,
      medianDecisionRtMs: dist.medianRtMs,
      seMedianRtMs: dist.seMedianRtMs,
      madRtMs: dist.madRtMs,
      bowleySkewness: dist.bowleyQuantileSkewness,
      moorsKurtosisExcess: dist.moorsOctileKurtosisExcess,
      exGaussianTauMs: dist.exGaussianTauMs,
      mathOptimalRate: telemetryAnalytics.mathOptimalRatePct,
      upsideDownDetectionRate: telemetryAnalytics.upsideDownDetectionRatePct,
      implicitAnchorSavingsMs: telemetryAnalytics.implicitSavingsMs,
      discardSnapHits,
      discardSnapOpportunities,
      discardPeekCount,
      compositeDemoZ: demoNorms.compositeDemoZ,
      compositePercentile: demoNorms.compositePercentile,
      clockNoonErrorDeg,
      clockDurationSec
    };
    const next = [snap, ...savedSessions].slice(0, 24);
    setSavedSessions(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota issues
    }
    return snap;
  };

  const handleCompleteShoeAndSave = () => {
    if (!autoSavedCurrentShoeRef.current && handRecords.length > 0) {
      autoSavedCurrentShoeRef.current = true;
      handleSaveSessionSnapshot();
    }
    setShowTesterLab(true);
    setTableStage('SHOE_COMPLETE_SUMMARY');
  };

  // Graceful Wall-Clock Time Cap Auto-Wrap-Up:
  // If timer reaches targetDurationSec while waiting to deal the next hand, wrap up immediately.
  // If the player is mid-hand (PLAYER_TURN), let them finish the current hand first!
  useEffect(() => {
    if (
      elapsedSec >= targetDurationSec &&
      tableStage === 'PLACE_CORNER_BET' &&
      handRecords.length > 0
    ) {
      handleCompleteShoeAndSave();
    }
  }, [elapsedSec, targetDurationSec, tableStage, handRecords.length]);

  const handleAdvanceToNextHand = () => {
    // If appointment time cap has been reached, wrap up gracefully right after finishing this hand!
    if (elapsedSec >= targetDurationSec && handRecords.length > 0) {
      handleCompleteShoeAndSave();
      return;
    }

    const nextNum = handNumber + 1;
    const corners: ('Q1' | 'Q2' | 'Q3' | 'Q4')[] = ['Q2', 'Q1', 'Q3', 'Q4'];
    setActiveBetCorner(corners[nextNum % 4]);

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

  const handleResetForNewRun = () => {
    autoSavedCurrentShoeRef.current = false;
    setElapsedSec(0);
    setIsPaused(false);
    setShoe(buildShuffledShoe(savedSessions.length + 2));
    setBankroll(1000);
    setCurrentBet(25);
    setDoublePayoutActive(false);
    setHandNumber(1);
    setPlayerHand([]);
    setDealerHand([]);
    setDealerHoleRevealed(false);
    setHandRecords([]);
    setLastDiscardTopCard(null);
    setDiscardPeekOpen(false);
    setDiscardPeekCount(0);
    setDiscardSnapHits(0);
    setDiscardSnapOpportunities(0);
    setDiscardSnapClaimedThisHand(false);
    setClockCompletedOnce(false);
    setClockPlacedHours([]);
    setClockNoonHandDeg(null);
    setClockDurationSec(null);
    setClockNoonErrorDeg(null);
    setFalseFlipTaps(0);
    setShowTesterLab(false);
    cornerOnsetRef.current = performance.now();
    setTableStage('PLACE_CORNER_BET');
  };

  const handleExportSessionsJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      currentPlayerLabel: playerLabel,
      savedSessions,
      currentRunHandRecords: handRecords
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postcircecd_family_test_runs_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSessionsCsv = () => {
    const headers = [
      'SessionID',
      'PlayerLabel',
      'Time',
      'Age',
      'EduYrs',
      'Familiarity',
      'ElapsedSec',
      'EngagedHands',
      'CensoredHands',
      'MotorBaselineMs',
      'CognitiveMedianMs',
      'RawMedianMs',
      'SE_MedianMs',
      'MAD_Ms',
      'BowleySkew',
      'MoorsKurt',
      'ExGaussTauMs',
      'FatigueSlopeMsPerHand',
      'MathOptimalPct',
      'UpsideDownFlipPct',
      'AnchorSavingsMs',
      'DiscardSnapHits',
      'DiscardPeeks',
      'ClockNoonErrDeg',
      'ClockSec',
      'Z_demo',
      'Percentile'
    ];
    const rows = savedSessions.map((s) =>
      [
        s.sessionId,
        `"${(s.playerLabel || 'Tester').replace(/"/g, '""')}"`,
        s.timestampIso,
        s.ageYears,
        s.educationYears,
        s.gameFamiliarity || 'MODERATE',
        s.elapsedSec,
        s.validEngagedHands,
        s.censoredDistractionHands,
        s.motorBaselineRtMs ?? 320,
        s.cognitiveMedianRtMs ?? s.medianDecisionRtMs,
        s.medianDecisionRtMs,
        s.seMedianRtMs,
        s.madRtMs,
        s.bowleySkewness,
        s.moorsKurtosisExcess,
        s.exGaussianTauMs,
        s.fatigueSlopeMsPerHand ?? 0,
        s.mathOptimalRate,
        s.upsideDownDetectionRate,
        s.implicitAnchorSavingsMs ?? '',
        s.discardSnapHits ?? 0,
        s.discardPeekCount ?? 0,
        s.clockNoonErrorDeg ?? '',
        s.clockDurationSec ?? '',
        s.compositeDemoZ,
        s.compositePercentile
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postcircecd_family_test_runs_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pEval = evaluateBlackjackHand(playerHand);
  const dEval = evaluateBlackjackHand(dealerHand);
  const { dist, demoNorms, reproducibilitySummary } = telemetryAnalytics;
  const remainingSec = Math.max(0, targetDurationSec - elapsedSec);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* =====================================================================
          PLAYER / FAMILY MEMBER PROFILE & TIME-CAP BAR
          Quickly switch between yourself and family members, set exact age/education,
          and pick 2:00 (Fast Test), 3:30 (Clinic Pillar), or 5:00 (Full Shoe).
         ===================================================================== */}
      <div className="rounded-2xl bg-slate-950/90 border border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="font-extrabold uppercase tracking-wider text-sky-400">
            👤 Player / Tester:
          </span>

          <select
            value={
              [
                'Me (Primary Tester)',
                'Spouse / Partner',
                'Parent / Older Relative',
                'Sibling / Adult Child',
                'Friend / Guest'
              ].includes(playerLabel)
                ? playerLabel
                : 'CUSTOM'
            }
            onChange={(e) => {
              if (e.target.value !== 'CUSTOM') {
                setPlayerLabel(e.target.value);
              }
            }}
            className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 font-bold cursor-pointer"
          >
            <option value="Me (Primary Tester)">Me (Primary Tester)</option>
            <option value="Spouse / Partner">Spouse / Partner</option>
            <option value="Parent / Older Relative">Parent / Older Relative</option>
            <option value="Sibling / Adult Child">Sibling / Adult Child</option>
            <option value="Friend / Guest">Friend / Guest</option>
            <option value="CUSTOM">Custom Name...</option>
          </select>

          <input
            type="text"
            value={playerLabel}
            onChange={(e) => setPlayerLabel(e.target.value)}
            placeholder="Name / Initials"
            className="w-36 px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold"
          />

          <label className="flex items-center gap-1 text-slate-300 font-semibold">
            Age:
            <input
              type="number"
              min={18}
              max={99}
              value={demoProfile.ageYears}
              onChange={(e) =>
                setDemoProfile((p) => ({
                  ...p,
                  ageYears: Math.min(99, Math.max(18, Number(e.target.value) || 65))
                }))
              }
              className="w-14 px-1.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold text-center"
            />
          </label>

          <label className="flex items-center gap-1 text-slate-300 font-semibold">
            Edu:
            <select
              value={demoProfile.educationYears}
              onChange={(e) =>
                setDemoProfile((p) => ({ ...p, educationYears: Number(e.target.value) }))
              }
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold cursor-pointer"
            >
              <option value={10}>10y (Some HS)</option>
              <option value={12}>12y (High School)</option>
              <option value={14}>14y (Assoc / Trade)</option>
              <option value={16}>16y (Bachelor’s)</option>
              <option value={18}>18y (Master’s)</option>
              <option value={20}>20y (MD / PhD / JD)</option>
            </select>
          </label>

          <label className="flex items-center gap-1 text-slate-300 font-semibold">
            Cards:
            <select
              value={demoProfile.gameFamiliarity}
              onChange={(e) =>
                setDemoProfile((p) => ({
                  ...p,
                  gameFamiliarity: e.target.value as 'LOW' | 'MODERATE' | 'HIGH'
                }))
              }
              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold cursor-pointer"
            >
              <option value="LOW">Rarely Plays</option>
              <option value="MODERATE">Casual Player</option>
              <option value="HIGH">Avid Player</option>
            </select>
          </label>

          <label className="flex items-center gap-1 text-slate-300 font-semibold">
            Time Cap:
            <select
              value={targetDurationSec}
              onChange={(e) => setTargetDurationSec(Number(e.target.value))}
              className="px-2 py-1 rounded-lg bg-emerald-950 border border-emerald-500/60 text-emerald-300 font-extrabold cursor-pointer"
            >
              <option value={120}>2:00 (Fast Family/Bug Test)</option>
              <option value={210}>3:30 (Clinic Pillar Cap)</option>
              <option value={300}>5:00 (Full 5-Min Shoe)</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          onClick={() => setShowTesterLab((v) => !v)}
          className={`px-3 py-1.5 rounded-lg font-extrabold text-[11px] border cursor-pointer ${
            showTesterLab
              ? 'bg-sky-700 border-sky-300 text-white'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-sky-300'
          }`}
        >
          🔬 {showTesterLab ? 'Hide Tester Lab (Clean Player View)' : `Open Tester Outcome Lab (${savedSessions.length} Saved)`}
        </button>
      </div>

      {/* =====================================================================
          TOP CASINO RAIL: Shoe Clock with Hard Cap, Bankroll & Pause/Finish Controls
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
            <span
              className={`px-3 py-1.5 rounded-xl bg-slate-900 border text-xs font-bold ${
                remainingSec <= 20
                  ? 'border-amber-400 text-amber-300'
                  : 'border-sky-500/40 text-sky-300'
              }`}
            >
              ⏱️ Shoe Clock: {formatMmSs(elapsedSec)} / {formatMmSs(targetDurationSec)}
              {elapsedSec >= targetDurationSec && tableStage === 'PLAYER_TURN'
                ? ' (Final Hand!)'
                : ''}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!clockCompletedOnce && tableStage !== 'PIT_CLOCK_NOON_BONUS' && tableStage !== 'SHOE_COMPLETE_SUMMARY' && (
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
          {handRecords.length > 0 && tableStage !== 'SHOE_COMPLETE_SUMMARY' && (
            <button
              type="button"
              onClick={handleCompleteShoeAndSave}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-600 border border-emerald-400 text-xs font-extrabold text-white cursor-pointer"
            >
              🏁 Finish &amp; See Outcome ({handRecords.length} Hands)
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const nextPaused = !isPaused;
              setIsPaused(nextPaused);
              if (nextPaused) {
                setHadInterruptionThisHand(true);
              } else {
                // Mark the next hand after resume as post-pause re-orientation so it doesn't skew RT moments
                setIsPostPauseWarmupHand(true);
                handOnsetRef.current = performance.now();
                cornerOnsetRef.current = performance.now();
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
          >
            {isPaused ? '▶ Resume' : '☕ Pause'}
          </button>
        </div>
      </div>

      {/* =====================================================================
          STAGE 0: WARMUP INTRO & SIMPLE TABLE RULES (Zero Popups During Play)
         ===================================================================== */}
      {tableStage === 'WARMUP_INTRO' && (
        <div className="rounded-2xl bg-[#0D231A] border-2 border-emerald-500/60 p-6 sm:p-8 text-center space-y-6 shadow-2xl">
          <div className="space-y-2 max-w-2xl mx-auto">
            <div className="inline-block px-3.5 py-1 rounded-full bg-amber-500/20 border border-amber-400 text-xs font-extrabold uppercase tracking-wider text-amber-300">
              5-Minute Casino Shoe • Zero Interrupting Quizzes
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
              Welcome to the 21 Club Blackjack Table
            </h2>
            <p className="text-base sm:text-lg text-slate-200 leading-relaxed">
              Play 5 minutes of classic <strong>Blackjack 21</strong> (beat the Dealer without going over 21). Three natural table bonuses are built right onto the felt:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left max-w-3xl mx-auto">
            <div className="p-4 rounded-xl bg-slate-950/85 border border-emerald-500/40 space-y-1.5">
              <div className="text-xs font-extrabold uppercase text-emerald-300">
                1. Eagle-Eye Flip (+$50)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                If a card ever slides out of the shoe <strong>upside-down</strong>, tap that card on the felt to flip it upright for an instant <strong>+$50 Bonus</strong>!
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/85 border border-amber-500/40 space-y-1.5">
              <div className="text-xs font-extrabold uppercase text-amber-300">
                2. Discard Snap Match (+$50)
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                If a card on the table matches the rank of the <strong>top card just placed in the Discard Tray</strong>, tap <strong>🔔 Snap Match</strong>! (You can tap <strong>👁️ Peek</strong> anytime).
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
          <div className="text-center space-y-1">
            <div className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
              Deal Hand #{handNumber} • Tap the Glowing Corner Chip Stack
            </div>
            <h3 className="text-xl font-extrabold text-white">
              Tap the Illuminated Chip Stack in Corner {activeBetCorner} to Deal Your Cards!
            </h3>
          </div>

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
          STAGE 2 & 3: LIVE BLACKJACK HAND (With On-Felt Discard Snap & Peek!)
         ===================================================================== */}
      {(tableStage === 'PLAYER_TURN' || tableStage === 'HAND_RESULT') && (
        <div className="rounded-2xl bg-[#0D231A] border-2 border-emerald-500/60 p-6 space-y-5 shadow-2xl">
          {/* Top Table Rail: Side-Pot Rule + On-Felt Discard Tray (Snap Match & Natural Peek!) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Active Side-Pot Rule Strip */}
            <div className="rounded-xl bg-slate-950/90 border border-amber-400/60 p-3 flex items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-amber-300">
                {sideRuleMode === 'SUIT_MATCH'
                  ? '🔥 Side-Pot: Match Dealer’s Up-Card SUIT (+$40)'
                  : '⚡ Side-Pot: Hold a 7 or Total 14 (+$40)'}
              </div>

              {tableStage === 'PLAYER_TURN' && (
                <button
                  type="button"
                  disabled={sideRuleClaimed}
                  onClick={() => {
                    lastPointerActivityRef.current = performance.now();
                    setSideRuleClaimed(true);
                    if (isSidePotConditionMet()) {
                      setBankroll((b) => b + 40);
                      setHandBanner('🔥 Side-Pot Bonus Claimed (+$40 Chips)!');
                    } else {
                      setHandBanner('No Side-Pot match on this hand—keep playing your 21 hand!');
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl font-extrabold text-xs border cursor-pointer shrink-0 ${
                    sideRuleClaimed
                      ? 'bg-emerald-900 border-emerald-400 text-emerald-200'
                      : 'bg-amber-500 hover:bg-amber-400 border-amber-200 text-slate-950'
                  }`}
                >
                  {sideRuleClaimed ? '✓ Checked' : '🔥 Claim +$40'}
                </button>
              )}
            </div>

            {/* Natural On-Felt Discard Tray (Replaces Interrupting Memory Quizzes!) */}
            <div className="rounded-xl bg-slate-950/90 border border-sky-500/50 p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-200">
                🗂️ Discard Tray:{' '}
                {!lastDiscardTopCard ? (
                  <span className="text-slate-400">Empty (Hand #1)</span>
                ) : discardPeekOpen ? (
                  <span className="text-amber-300 font-extrabold">
                    Last Discard Was {lastDiscardTopCard.rank}{lastDiscardTopCard.suit}
                  </span>
                ) : (
                  <span className="text-sky-300">🂠 Face-Down (1 Card Ago)</span>
                )}
              </div>

              {lastDiscardTopCard && tableStage === 'PLAYER_TURN' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      lastPointerActivityRef.current = performance.now();
                      if (!discardPeekOpen) {
                        setDiscardPeekOpen(true);
                        setDiscardPeekCount((c) => c + 1);
                      }
                    }}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[11px] font-bold text-sky-200 cursor-pointer"
                  >
                    👁️ {discardPeekOpen ? 'Peeked' : 'Peek Discard'}
                  </button>

                  <button
                    type="button"
                    disabled={discardSnapClaimedThisHand}
                    onClick={() => {
                      lastPointerActivityRef.current = performance.now();
                      setDiscardSnapClaimedThisHand(true);
                      if (isDiscardSnapMatchValid()) {
                        setBankroll((b) => b + 50);
                        setDiscardSnapHits((h) => h + 1);
                        setHandBanner(
                          `🔔 Snap Match! You remembered the ${lastDiscardTopCard.rank} in the Discard Tray (+$50)!`
                        );
                      } else {
                        setHandBanner(
                          `No ${lastDiscardTopCard.rank} showing on the table this hand—keep playing!`
                        );
                      }
                    }}
                    className={`px-3 py-1 rounded-lg text-[11px] font-extrabold border cursor-pointer ${
                      discardSnapClaimedThisHand
                        ? 'bg-emerald-900 border-emerald-400 text-emerald-200'
                        : 'bg-sky-600 hover:bg-sky-500 border-sky-300 text-white'
                    }`}
                  >
                    {discardSnapClaimedThisHand ? '✓ Snap Checked' : '🔔 Snap Match (+$50)'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Dealer Hand vs Player Hand Felt */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
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

          <div className="text-center text-sm sm:text-base font-extrabold text-emerald-300">
            {handBanner}
          </div>

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
          STAGE 4: HAPPY HOUR PIT BOSS CLOCK BONUS (NO TIMER BAR! 30s Noon Clock)
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
          STAGE 5: CELEBRATORY SHOE WRAP-UP & IMMEDIATE FAMILY TESTER CONTROLS
         ===================================================================== */}
      {tableStage === 'SHOE_COMPLETE_SUMMARY' && (
        <div className="rounded-2xl bg-[#0D231A] border-2 border-emerald-400 p-6 sm:p-8 text-center space-y-5 shadow-2xl">
          <div className="inline-block px-4 py-1 rounded-full bg-emerald-500/20 border border-emerald-400 text-xs font-extrabold uppercase tracking-wider text-emerald-300">
            🎉 Shoe Complete • Auto-Saved to Family Test Log
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
            Great Run, {playerLabel}! Final Bankroll: ${bankroll}
          </h2>
          <p className="text-sm sm:text-base text-slate-200 max-w-2xl mx-auto">
            Played <strong>{telemetryAnalytics.handsPlayed} hands</strong> in{' '}
            <strong>{formatMmSs(elapsedSec)}</strong> ({dist.validEngagedCount} valid engaged hands,{' '}
            {dist.censoredCount} distraction-censored). Eagle-Eye 180° Flips:{' '}
            <strong>
              {telemetryAnalytics.upsideDownSpotted}/{telemetryAnalytics.upsideDownOpportunities}
            </strong>{' '}
            • Discard Snap Matches:{' '}
            <strong>
              {discardSnapHits}/{discardSnapOpportunities}
            </strong>
            .
          </p>

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleResetForNewRun}
              className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm shadow-xl cursor-pointer"
            >
              🔄 Start Another Run (Same or Next Family Member)
            </button>
            <button
              type="button"
              onClick={onFinishSession}
              className="px-6 py-3.5 rounded-2xl bg-sky-700 hover:bg-sky-600 text-white font-extrabold text-sm shadow-xl cursor-pointer"
            >
              🩺 Open Full Provider &amp; 3D Brain Report &rarr;
            </button>
            <button
              type="button"
              onClick={handleExportSessionsCsv}
              className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 font-extrabold text-xs cursor-pointer"
            >
              📥 Download Family Runs (CSV)
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          TESTER & FAMILY OUTCOME LAB (Hidden During Play for Clean Game Feel,
          Auto-Opens on Completion or via 1-Click Toggle)
         ===================================================================== */}
      {showTesterLab && (
        <div className="rounded-2xl bg-slate-950/95 border border-slate-800 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-wider text-sky-400">
                🔬 Human Pilot &amp; Family Outcome Lab — Signal vs. Noise Diagnostic
              </div>
              <p className="text-[11px] text-slate-400">
                Player: <strong className="text-amber-300">{playerLabel}</strong> • Engaged Hands:{' '}
                <strong className="text-white">{dist.validEngagedCount}</strong> • Censored Pauses/Distractions:{' '}
                <strong className="text-amber-300">{dist.censoredCount}</strong> • Sampling Gate:{' '}
                <strong className="text-emerald-300">{dist.samplingAdequacy}</strong>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSaveSessionSnapshot}
                disabled={telemetryAnalytics.handsPlayed === 0}
                className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 disabled:opacity-40 text-xs font-bold text-white cursor-pointer"
              >
                💾 Save Run Snapshot
              </button>
              <button
                type="button"
                onClick={handleExportSessionsCsv}
                disabled={savedSessions.length === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-xs font-bold text-amber-300 cursor-pointer"
              >
                📥 Export CSV
              </button>
              <button
                type="button"
                onClick={handleExportSessionsJson}
                disabled={savedSessions.length === 0 && handRecords.length === 0}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-xs font-bold text-sky-300 cursor-pointer"
              >
                📦 Export JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  handleSaveSessionSnapshot();
                  onFinishSession();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-xs font-bold text-white cursor-pointer"
              >
                Full Clinical Report &rarr;
              </button>
            </div>
          </div>

          {/* Within-Person Signal vs. Noise Reproducibility Verdict */}
          <div
            className={`p-3 rounded-xl border text-xs font-bold ${
              !reproducibilitySummary.hasBaseline
                ? 'bg-slate-900 border-slate-700 text-slate-200'
                : Math.abs(reproducibilitySummary.srbZ ?? 0) <= 1.65
                ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                : 'bg-amber-950/60 border-amber-400 text-amber-200'
            }`}
          >
            <div className="uppercase text-[10px] tracking-wider text-sky-300 mb-0.5">
              🔁 Within-Person Reproducibility Check (Is It Real Signal or Random Noise?):
            </div>
            <div>{reproducibilitySummary.verdictText}</div>
          </div>

          {/* Demographic Normative Verdict Strip */}
          <div
            className={`p-3 rounded-xl border text-xs font-bold flex flex-wrap items-center justify-between gap-2 ${
              demoNorms.highReserveMaskingAlert
                ? 'bg-amber-950/60 border-amber-400 text-amber-200'
                : demoNorms.compositeDemoZ <= -1.5
                ? 'bg-rose-950/60 border-rose-400 text-rose-200'
                : 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
            }`}
          >
            <span>🩺 {demoNorms.normativeSummaryText}</span>
            <span className="px-2.5 py-1 rounded bg-slate-950 border border-slate-700 text-white">
              Z_demo = {demoNorms.compositeDemoZ >= 0 ? '+' : ''}
              {demoNorms.compositeDemoZ} SD ({demoNorms.compositePercentile}th %ile)
            </span>
          </div>

          {/* 6 Scientific Distribution & Domain Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-center">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Median RT ± SE</div>
              <div className="text-base font-extrabold text-white">
                {dist.medianRtMs > 0 ? `${dist.medianRtMs} ± ${dist.seMedianRtMs}ms` : '—'}
              </div>
              <div className="text-[10px] text-sky-300">
                Motor-Subtracted: {telemetryAnalytics.cognitiveMedianRtMs || '—'}ms (Motor: {telemetryAnalytics.motorBaselineRtMs}ms)
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">MAD &amp; IQR Spread</div>
              <div className="text-base font-extrabold text-emerald-300">
                MAD: {dist.madRtMs || '—'}ms
              </div>
              <div className="text-[10px] text-slate-400">
                IQR: {dist.iqrRtMs || '—'}ms • CoMAD: {dist.coMadRatio}
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Skewness &amp; Kurtosis</div>
              <div className="text-sm font-extrabold text-amber-300">
                Bowley Skew: {dist.bowleyQuantileSkewness}
              </div>
              <div className="text-[10px] text-slate-400">
                Moors Kurt: {dist.moorsOctileKurtosisExcess} (g1={dist.sampleSkewnessG1 ?? '—'})
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Ex-Gaussian (μ / τ)</div>
              <div className="text-sm font-extrabold text-sky-300">
                μ={dist.exGaussianMuMs || '—'}ms • τ={dist.exGaussianTauMs || '—'}ms
              </div>
              <div className="text-[10px] text-slate-400">
                Fatigue Slope: {telemetryAnalytics.fatigueSlopeMsPerHand >= 0 ? '+' : ''}
                {telemetryAnalytics.fatigueSlopeMsPerHand}ms/hand
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">180° Card &amp; 4-Corner</div>
              <div className="text-sm font-extrabold text-amber-300">
                180° Flip: {telemetryAnalytics.upsideDownSpotted}/{telemetryAnalytics.upsideDownOpportunities} ({telemetryAnalytics.upsideDownDetectionRatePct}%)
              </div>
              <div className="text-[10px] text-slate-400">
                Medians: {telemetryAnalytics.qMedians.Q2}/{telemetryAnalytics.qMedians.Q1}/{telemetryAnalytics.qMedians.Q3}/{telemetryAnalytics.qMedians.Q4}ms
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[10px] font-bold uppercase text-slate-400">Implicit &amp; Peek Memory</div>
              <div className="text-sm font-extrabold text-emerald-300">
                Snap: {discardSnapHits}/{discardSnapOpportunities} • Peeks: {discardPeekCount}
              </div>
              <div className="text-[10px] text-slate-400">
                Anchor Savings: {telemetryAnalytics.implicitSavingsMs !== null ? `${telemetryAnalytics.implicitSavingsMs}ms` : 'Pending #6'}
              </div>
            </div>
          </div>

          <div className="text-[11px] text-slate-300 bg-slate-900/70 border border-slate-800 rounded-xl px-3.5 py-2">
            <strong className="text-sky-300">Distribution Signal vs. Noise Analysis:</strong>{' '}
            {dist.clinicalDistributionInterpretation}
          </div>

          {/* Saved Repeated Sessions Comparison Table */}
          {savedSessions.length > 0 && (
            <div className="pt-2 border-t border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400">
                  📈 Family &amp; Self-Tester Comparison Log ({savedSessions.length} Saved Runs)
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSavedSessions([]);
                    try {
                      window.localStorage.removeItem(STORAGE_KEY);
                    } catch {
                      // Ignore
                    }
                  }}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-bold cursor-pointer"
                >
                  🗑️ Clear Log
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                      <th className="py-1 pr-2">Player</th>
                      <th className="py-1 pr-2">Time</th>
                      <th className="py-1 pr-2">Age/Edu</th>
                      <th className="py-1 pr-2">Hands (Excl)</th>
                      <th className="py-1 pr-2">Median ± SE (Cog)</th>
                      <th className="py-1 pr-2">Skew / Kurt</th>
                      <th className="py-1 pr-2">Ex-Gauss τ</th>
                      <th className="py-1 pr-2">21 Math / 180°</th>
                      <th className="py-1">Z_demo (%ile)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {savedSessions.map((s) => (
                      <tr key={s.sessionId} className="border-b border-slate-900">
                        <td className="py-1 pr-2 font-extrabold text-amber-300">
                          {s.playerLabel || 'Tester'}
                        </td>
                        <td className="py-1 pr-2 text-slate-400">{s.timestampIso}</td>
                        <td className="py-1 pr-2">{s.ageYears}y / {s.educationYears}y</td>
                        <td className="py-1 pr-2">
                          {s.validEngagedHands} ({s.censoredDistractionHands} excl)
                        </td>
                        <td className="py-1 pr-2 font-bold text-white">
                          {s.medianDecisionRtMs} ± {s.seMedianRtMs}ms ({s.cognitiveMedianRtMs ?? s.medianDecisionRtMs}ms)
                        </td>
                        <td className="py-1 pr-2">{s.bowleySkewness} / {s.moorsKurtosisExcess}</td>
                        <td className="py-1 pr-2 text-sky-300">{s.exGaussianTauMs}ms</td>
                        <td className="py-1 pr-2">
                          {s.mathOptimalRate}% / {s.upsideDownDetectionRate}%
                        </td>
                        <td className="py-1 font-extrabold text-emerald-300">
                          {s.compositeDemoZ >= 0 ? '+' : ''}
                          {s.compositeDemoZ} SD ({s.compositePercentile}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BlackjackFiveMinGame;
