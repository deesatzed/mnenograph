import React, { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import ReactDOMClient from 'react-dom/client';
import BlackjackFiveMinGame, {
  isActionMathematicallySound,
  type BlackjackCard
} from '../BlackjackFiveMinGame';
import {
  computeDemographicNormedScore,
  evaluateTwoLayerSyndromeRouter
} from '../../psychometrics/psychometrics';
import { getCanonicalProtocolManifest } from '../../registry/protocolRegistry';
import type { StationTelemetryMap } from '../../types/sessionSchema';

function mountComponent(element: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = ReactDOMClient.createRoot(container);
  act(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    }
  };
}

function clickButtonByText(container: HTMLElement, substring: string) {
  const btns = Array.from(container.querySelectorAll('button'));
  const match = btns.find((b) => b.textContent?.includes(substring));
  if (!match) {
    throw new Error(`Button containing "${substring}" not found`);
  }
  act(() => {
    match.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('Blackjack Human Pilot UX & Outcome Data Integrity Safeguards', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('1. Separates cautious novice risk-aversion (Stand 14 vs 7) from true arithmetic errors (Hit 19, Stand 10)', () => {
    const ten: BlackjackCard = { id: '1', rank: '10', suit: '♠', suitName: 'Spades', value: 10 };
    const four: BlackjackCard = { id: '2', rank: '4', suit: '♥', suitName: 'Hearts', value: 4 };
    const nine: BlackjackCard = { id: '3', rank: '9', suit: '♦', suitName: 'Diamonds', value: 9 };
    const six: BlackjackCard = { id: '4', rank: '6', suit: '♣', suitName: 'Clubs', value: 6 };
    const seven: BlackjackCard = { id: '5', rank: '7', suit: '♠', suitName: 'Spades', value: 7 };

    // Novice/Casual family member cautiously standing on Hard 14 vs Dealer 7 is NOT graded as dyscalculic
    expect(isActionMathematicallySound([ten, four], seven, 'STAND', 'LOW')).toBe(true);
    expect(isActionMathematicallySound([ten, four], seven, 'STAND', 'MODERATE')).toBe(true);

    // Unambiguous numerical summation errors ARE caught across all familiarity levels
    expect(isActionMathematicallySound([ten, nine], seven, 'HIT', 'LOW')).toBe(false);
    expect(isActionMathematicallySound([four, six], seven, 'STAND', 'LOW')).toBe(false);
  });

  it('2. Auto-collapses clinical setup bar, enforces target quadrant corner, and hides pre-computed sums during live play', () => {
    let latestTelemetry: StationTelemetryMap = {};
    const { container, unmount } = mountComponent(
      <BlackjackFiveMinGame
        presentationMode="PLAIN_STATIC_2D"
        onAppendTrialEvent={() => {}}
        onUpdateStationTelemetry={(patch) => {
          latestTelemetry = { ...latestTelemetry, ...patch };
        }}
        onFinishSession={() => {}}
      />
    );

    // Setup bar starts expanded on Warmup Intro, then auto-collapses when sitting at the table
    expect(container.textContent).toContain('Player Setup:');
    clickButtonByText(container, 'Sit at Blackjack Table');
    expect(container.textContent).toContain('Seated at Table:');
    expect(container.textContent).not.toContain('Player Setup:');

    // Off-target dim corner click must NOT deal cards
    clickButtonByText(container, 'Top-Right Chip Spot');
    expect(container.textContent).toContain('Tap the glowing gold chip stack');

    // Illuminated target corner click deals Hand #1
    clickButtonByText(container, 'Tap to Bet');

    // During PLAYER_TURN, pre-computed numeric sum must NOT be leaked on the Stand button or header
    if (!container.textContent?.includes('NATURAL 21!')) {
      expect(container.textContent).toContain('Cards on Felt');
      expect(container.textContent).toContain('Stand (Hold)');
      expect(container.textContent).not.toContain('Final Total:');
      clickButtonByText(container, 'Stand (Hold)');
    } else {
      clickButtonByText(container, 'Claim Blackjack 21!');
    }

    // Immediately upon HAND_RESULT, exact totals ARE revealed for crisp casino feedback
    expect(container.textContent).toContain('Final Total:');
    unmount();
  });

  it('3. Produces clean PROFILE_0_UNIMPAIRED (zero false-positive PCA or Amnestic flags) for a healthy 6-hand player who flips 180° cards fast and never peeks', () => {
    let accumulatedTelemetry: StationTelemetryMap = {};
    const { container, unmount } = mountComponent(
      <BlackjackFiveMinGame
        presentationMode="PLAIN_STATIC_2D"
        onAppendTrialEvent={() => {}}
        onUpdateStationTelemetry={(patch) => {
          accumulatedTelemetry = { ...accumulatedTelemetry, ...patch };
        }}
        onFinishSession={() => {}}
      />
    );

    // Helper that reads the 2 dealt player cards on the felt and plays sound Blackjack (Stand on >=15, Hit on <=14)
    const playSoundHandDecision = () => {
      if (container.textContent?.includes('Claim Blackjack 21!')) {
        clickButtonByText(container, 'Claim Blackjack 21!');
        return;
      }
      const cardBtns = Array.from(
        container.querySelectorAll('button[title*="Eagle-Eye Bonus"]')
      );
      // Last 2 card buttons belong to Player's Hand (first 1 belongs to Dealer Up-Card)
      const playerCardBtns = cardBtns.slice(-2);
      const parseCardVal = (txt: string) => {
        const clean = txt.trim();
        if (clean.startsWith('10') || clean.startsWith('J') || clean.startsWith('Q') || clean.startsWith('K')) return 10;
        if (clean.startsWith('A')) return 11;
        return parseInt(clean[0], 10) || 7;
      };
      let sum = playerCardBtns.reduce((acc, b) => acc + parseCardVal(b.textContent ?? ''), 0);
      if (sum === 22) sum = 12; // Two Aces
      if (sum <= 14) {
        clickButtonByText(container, 'Hit (Draw Card)');
        if (container.textContent?.includes('Stand (Hold)')) {
          clickButtonByText(container, 'Stand (Hold)');
        }
      } else {
        clickButtonByText(container, 'Stand (Hold)');
      }
    };

    clickButtonByText(container, 'Sit at Blackjack Table');

    for (let h = 1; h <= 6; h++) {
      clickButtonByText(container, 'Tap to Bet');

      // Progressive Ramp-Up Check: Hands #1-#3 hide Discard Tray & Side-Pot; Hand #4 unlocks Discard Tray; Hand #5 unlocks Side-Pot!
      if (h <= 3) {
        expect(container.textContent).not.toContain('Discard Tray:');
        expect(container.textContent).not.toContain('Side-Pot:');
      } else if (h === 4) {
        expect(container.textContent).toContain('Discard Tray:');
        expect(container.textContent).not.toContain('Side-Pot:');
      } else if (h >= 5) {
        expect(container.textContent).toContain('Discard Tray:');
        expect(container.textContent).toContain('Side-Pot:');
      }

      // Flip any 180° upside-down card on the felt (simulating a fast eagle-eye player!)
      const rotatedCardBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.getAttribute('style')?.includes('rotate(180deg)')
      );
      if (rotatedCardBtn) {
        act(() => {
          rotatedCardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
      }

      playSoundHandDecision();

      if (h < 6) {
        clickButtonByText(container, 'Deal Next Hand');
        // After Hand #4, complete the brisk 5-tap Pit Boss Noon Clock Bonus!
        if (h === 4 && container.textContent?.includes('Place the 4 Main Clock Numbers')) {
          const clockSvg = container.querySelector('svg.cursor-crosshair') as SVGSVGElement;
          expect(clockSvg).not.toBeNull();
          // Mock 260x260 bounding box so taps land accurately at 12, 3, 6, 9, and Noon
          clockSvg.getBoundingClientRect = () =>
            ({
              left: 0,
              top: 0,
              width: 260,
              height: 260,
              right: 260,
              bottom: 260,
              x: 0,
              y: 0,
              toJSON: () => ({})
            }) as DOMRect;
          const tapClock = (cx: number, cy: number) => {
            act(() => {
              clockSvg.dispatchEvent(
                new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy })
              );
            });
          };
          tapClock(130, 20);  // 12 o'clock (0°)
          tapClock(240, 130); // 3 o'clock (90°)
          tapClock(130, 240); // 6 o'clock (180°)
          tapClock(20, 130);  // 9 o'clock (270°)
          tapClock(130, 30);  // Hands to Noon (0°)
          clickButtonByText(container, 'Lock In Pit Clock');
        }
      }
    }

    // Verify balanced 3 upright vs 3 rotated opportunities in 6 hands and zero false-positive syndrome flags
    expect(accumulatedTelemetry['S2.1']?.totalNoisePlates).toBe(3);
    expect(accumulatedTelemetry['S2.1']?.trueObjectHitCount).toBe(3);

    const manifest = getCanonicalProtocolManifest();
    const routerResult = evaluateTwoLayerSyndromeRouter(accumulatedTelemetry, true, manifest);
    expect(routerResult.primaryLayer1Profile).toBe('PROFILE_0_UNIMPAIRED');

    // Finish Run 1 (6 hands < 12) -> verify Low-N tail gate is active before pooling!
    clickButtonByText(container, 'Cash Out & See Outcome');
    expect(container.textContent).toContain('Low-N (6/12)');
    expect(container.textContent).toContain('τ Gated');
    expect(accumulatedTelemetry['S0.3']?.quadrantKruskalWallisH).toBeNull();

    // Start Run 2 for the SAME player and play 6 more hands (6 + 6 = 12 pooled hands!)
    clickButtonByText(container, 'Start Another Run');
    clickButtonByText(container, 'Sit at Blackjack Table');
    for (let h = 1; h <= 6; h++) {
      clickButtonByText(container, 'Tap to Bet');
      playSoundHandDecision();
      if (h < 6) {
        clickButtonByText(container, 'Deal Next Hand');
        if (h === 4 && container.textContent?.includes('Skip Happy Hour')) {
          clickButtonByText(container, 'Skip Happy Hour');
        }
      }
    }

    clickButtonByText(container, 'Cash Out & See Outcome');
    // Multi-Run Pooling (6 + 6 = 12 hands) unlocks Pooled N=12 Tail Moments, 4-Quadrant KW H, AND S1.1 GLDI/Crowding!
    expect(container.textContent).toContain('Pooled N=12');
    expect(container.textContent).toContain('REPRODUCIBLE SIGNAL');
    expect(accumulatedTelemetry['S0.3']?.quadrantKruskalWallisH).not.toBeNull();
    expect(accumulatedTelemetry['S1.1']?.gldiRatio).not.toBeNull();
    expect(
      evaluateTwoLayerSyndromeRouter(accumulatedTelemetry, true, manifest).primaryLayer1Profile
    ).toBe('PROFILE_0_UNIMPAIRED');

    unmount();
  });

  it('4. Adjusts expected RT for Trackpad vs Touch latency, shrinks Low-N tail weight, and tags Exploratory Literature Priors', () => {
    const touchNorm = computeDemographicNormedScore(
      { ageYears: 70, educationYears: 16, gameFamiliarity: 'MODERATE', inputDevice: 'TOUCH' },
      {
        medianRtMs: 1200,
        exGaussianTauMs: 380,
        bowleySkewness: 0.35,
        mathOptimalRatePct: 90,
        upsideDownDetectionRatePct: 100,
        validSampleCount: 6
      }
    );
    const trackpadNorm = computeDemographicNormedScore(
      { ageYears: 70, educationYears: 16, gameFamiliarity: 'MODERATE', inputDevice: 'TRACKPAD' },
      {
        medianRtMs: 1200,
        exGaussianTauMs: 380,
        bowleySkewness: 0.35,
        mathOptimalRatePct: 90,
        upsideDownDetectionRatePct: 100,
        validSampleCount: 6
      }
    );

    expect(trackpadNorm.expectedMedianRtMs - touchNorm.expectedMedianRtMs).toBe(150);
    expect(touchNorm.normSourceTag).toBe('SYNTHETIC_LITERATURE_PRIOR');
    expect(touchNorm.tailWeightApplied).toBe(0.12); // Down-weighted from 0.30 because N=6 < 12
    expect(touchNorm.normativeSummaryText).toContain('Exploratory Literature Prior');
  });
});
