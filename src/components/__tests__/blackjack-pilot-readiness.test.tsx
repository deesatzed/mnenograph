import React, { act } from 'react';
import { describe, expect, it } from 'vitest';
import ReactDOMClient from 'react-dom/client';
import BlackjackFiveMinGame, {
  isActionMathematicallySound,
  type BlackjackCard
} from '../BlackjackFiveMinGame';
import { evaluateTwoLayerSyndromeRouter } from '../../psychometrics/psychometrics';
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

    clickButtonByText(container, 'Sit at Blackjack Table');

    for (let h = 1; h <= 6; h++) {
      clickButtonByText(container, 'Tap to Bet');

      // Flip any 180° upside-down card on the felt (simulating a fast eagle-eye player!)
      const rotatedCardBtn = Array.from(container.querySelectorAll('button')).find((b) =>
        b.getAttribute('style')?.includes('rotate(180deg)')
      );
      if (rotatedCardBtn) {
        act(() => {
          rotatedCardBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        });
      }

      // Play basic sound action without clicking Peek Discard
      if (container.textContent?.includes('Claim Blackjack 21!')) {
        clickButtonByText(container, 'Claim Blackjack 21!');
      } else {
        // Hit once if total might be <= 11 on random hand, or Stand on Anchor #2/#6 (Soft 18)
        if (h === 2 || h === 6) {
          clickButtonByText(container, 'Stand (Hold)');
        } else {
          // Inspect card ranks on player side to avoid standing on <= 11
          clickButtonByText(container, 'Hit (Draw Card)');
          if (container.textContent?.includes('Stand (Hold)')) {
            clickButtonByText(container, 'Stand (Hold)');
          }
        }
      }

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

    unmount();
  });
});
