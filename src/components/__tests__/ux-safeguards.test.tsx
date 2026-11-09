import React, { act } from 'react';
import { describe, expect, it } from 'vitest';
import ReactDOMClient from 'react-dom/client';
import App from '../../App';
import { UnifiedPracticeGate } from '../PracticeGateAndModals';
import type { PracticeGateResult } from '../../types/sessionSchema';

// Lightweight DOM test helper using React 19 createRoot + act (zero extra testing-library dependency required)
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

function clickElement(el: Element | null) {
  if (!el) throw new Error('Target element not found for click');
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

describe('PostCircECD UX, Accessibility & Regulatory Safeguards (F2, F3, F7, F8, F9)', () => {
  it('1. Enforces Unified 4-Trial Practice Gate (>= 3/4 pass, max 1 retry block, auto-skip on 2nd failure — F9)', () => {
    let finalResult: PracticeGateResult | null = null;
    const { container, unmount } = mountComponent(
      <UnifiedPracticeGate
        stationId="S3.1"
        stationTitle="S3.1 DCCS Practice"
        instructionSummary="Match by shape or pattern"
        onCompleteGate={(res) => {
          finalResult = res;
        }}
      />
    );

    // Block 1: Fail all 4 trials (0/4) -> should advance to Block 2 with guided retry banner
    for (let i = 0; i < 4; i++) {
      const wrongBtn = container.querySelector('[data-testid="practice-choice-incorrect"]');
      clickElement(wrongBtn);
    }
    expect(finalResult).toBeNull();
    const blockIndicator = container.querySelector('[data-testid="practice-block-indicator"]');
    expect(blockIndicator?.textContent).toContain('Practice Block 2 of 2');
    expect(container.querySelector('[data-testid="practice-retry-guidance"]')).not.toBeNull();

    // Block 2: Fail 2 trials and pass 2 trials (2/4 < 3/4) -> must auto-skip with excluded: true!
    clickElement(container.querySelector('[data-testid="practice-choice-correct"]'));
    clickElement(container.querySelector('[data-testid="practice-choice-correct"]'));
    clickElement(container.querySelector('[data-testid="practice-choice-incorrect"]'));
    clickElement(container.querySelector('[data-testid="practice-choice-incorrect"]'));

    expect(finalResult).not.toBeNull();
    expect(finalResult!.passed).toBe(false);
    expect(finalResult!.excluded).toBe(true);
    expect(finalResult!.block1Correct).toBe(0);
    expect(finalResult!.block2Correct).toBe(2);
    unmount();
  });

  it('2. Renders Intended-Use banner, Plain Static Mode toggle, and mandatory SIMULATED watermarks on persona presets (F2, F3, F7)', () => {
    const { container, unmount } = mountComponent(<App />);

    // Verify Intended Use Banner is always visible (F3)
    const intendedBanner = container.querySelector('[data-testid="intended-use-banner"]');
    expect(intendedBanner?.textContent).toContain(
      'RESEARCH & EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE'
    );

    // In default Live Participant mode, SIMULATED watermark is absent and Normative Status shows Raw Telemetry Only (F2)
    expect(container.querySelector('[data-testid="global-simulated-watermark"]')).toBeNull();
    const normBadge = container.querySelector('[data-testid="normative-status-badge"]');
    expect(normBadge?.textContent).toContain('Raw Telemetry Only');

    // Toggle to Plain Static Mode (F7) and verify presentation mode updates cleanly
    const modeBtn = container.querySelector('[data-testid="toggle-presentation-mode-btn"]');
    clickElement(modeBtn);
    const viewport = container.querySelector('[data-testid="observatory-viewport"]');
    expect(viewport?.getAttribute('data-presentation-mode')).toBe('PLAIN_STATIC_2D');
    expect(container.querySelector('[data-testid="plain-static-surface-banner"]')).not.toBeNull();

    // Select a Synthetic Persona Preset (PERSONA_PCA_DORSAL) and verify SIMULATED watermarks render in Header, Viewport, and HUD (F3)
    const selectEl = container.querySelector(
      '[data-testid="persona-preset-select"]'
    ) as HTMLSelectElement;
    act(() => {
      selectEl.value = 'PERSONA_PCA_DORSAL';
      selectEl.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(container.querySelector('[data-testid="global-simulated-watermark"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="viewport-simulated-watermark"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="hud-simulated-watermark"]')).not.toBeNull();

    // Verify Pause / Resume modal banner works cleanly on Participant surface (F9)
    const pauseBtn = container.querySelector('[data-testid="participant-pause-resume-btn"]');
    clickElement(pauseBtn);
    expect(container.querySelector('[data-testid="pause-modal-banner"]')).not.toBeNull();
    clickElement(pauseBtn);
    expect(container.querySelector('[data-testid="pause-modal-banner"]')).toBeNull();

    unmount();
  });
});
