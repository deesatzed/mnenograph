import React, { useState } from 'react';
import type { PracticeGateResult, StationId } from '../types/sessionSchema';

export interface UnifiedPracticeGateProps {
  stationId: StationId;
  stationTitle: string;
  instructionSummary: string;
  existingResult?: PracticeGateResult;
  onCompleteGate: (result: PracticeGateResult) => void;
}

const PRACTICE_ITEMS = [
  {
    id: 1,
    prompt: 'Practice Trial 1 of 4: Match by SHAPE (Star + Horizontal Stripes)',
    correctChoice: 'STAR' as const,
    demoHint: 'Look at the outer contour: select the 5-pointed STAR on the left.'
  },
  {
    id: 2,
    prompt: 'Practice Trial 2 of 4: Match by INTERIOR PATTERN (Crosshatch Grid)',
    correctChoice: 'GRID' as const,
    demoHint: 'Look inside the shape: select the Crosshatch Grid pattern on the right.'
  },
  {
    id: 3,
    prompt: 'Practice Trial 3 of 4: Match by SHAPE (Circle + Polka Dots)',
    correctChoice: 'STAR' as const,
    demoHint: 'Select the matching left target button.'
  },
  {
    id: 4,
    prompt: 'Practice Trial 4 of 4: Match by INTERIOR PATTERN (Diagonal Stripes)',
    correctChoice: 'GRID' as const,
    demoHint: 'Select the matching right target button.'
  }
];

export const UnifiedPracticeGate: React.FC<UnifiedPracticeGateProps> = ({
  stationId,
  stationTitle,
  instructionSummary,
  existingResult,
  onCompleteGate
}) => {
  const [blockNumber, setBlockNumber] = useState<1 | 2>(1);
  const [trialIdx, setTrialIdx] = useState<number>(0);
  const [block1Score, setBlock1Score] = useState<number>(0);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [showRepeatGuidance, setShowRepeatGuidance] = useState<boolean>(false);

  if (existingResult?.passed) {
    return null;
  }

  if (existingResult?.excluded) {
    return (
      <div
        data-testid="practice-gate-excluded-banner"
        className="rounded-xl border border-amber-500/60 bg-amber-950/30 p-5 text-slate-100"
      >
        <h3 className="text-lg font-bold text-amber-300">
          Sub-Task Auto-Skipped — Practice Criterion Not Met ({stationId})
        </h3>
        <p className="mt-1 text-sm text-slate-200">
          Per Unified Practice Gate rule (<code>F9</code>: Pass 3 of 4, max 1 retry block), this station was calmly skipped after 2 practice blocks ({existingResult.block1Correct}/4 and {existingResult.block2Correct}/4) so the participant is never trapped in a frustrating loop. Recorded in session telemetry as <code>Excluded — Practice Criterion Not Met</code>.
        </p>
      </div>
    );
  }

  const currentItem = PRACTICE_ITEMS[trialIdx];

  const handleAnswer = (choice: 'STAR' | 'GRID') => {
    const isCorrect = choice === currentItem.correctChoice;
    const nextScore = currentScore + (isCorrect ? 1 : 0);

    if (trialIdx < 3) {
      setCurrentScore(nextScore);
      setTrialIdx(trialIdx + 1);
      return;
    }

    // Completed 4 trials of current block
    if (blockNumber === 1) {
      if (nextScore >= 3) {
        onCompleteGate({
          stationId,
          block1Correct: nextScore,
          block2Correct: null,
          passed: true,
          excluded: false
        });
      } else {
        setBlock1Score(nextScore);
        setBlockNumber(2);
        setTrialIdx(0);
        setCurrentScore(0);
        setShowRepeatGuidance(true);
      }
    } else {
      // Completed Block 2
      if (nextScore >= 3) {
        onCompleteGate({
          stationId,
          block1Correct: block1Score,
          block2Correct: nextScore,
          passed: true,
          excluded: false
        });
      } else {
        onCompleteGate({
          stationId,
          block1Correct: block1Score,
          block2Correct: nextScore,
          passed: false,
          excluded: true,
          exclusionReason: 'Practice Criterion Not Met (2 Blocks)'
        });
      }
    }
  };

  return (
    <div
      data-testid="unified-practice-gate"
      className="rounded-xl border border-sky-500/50 bg-[#12161F] p-5 text-slate-100 shadow-md"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
            Unified 4-Trial Practice Gate (F9 — Pass 3 of 4 | Max 1 Retry Block)
          </span>
          <h3 className="text-lg font-bold text-white mt-0.5">{stationTitle}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span
            data-testid="practice-block-indicator"
            className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-200"
          >
            Practice Block {blockNumber} of 2 • Trial {trialIdx + 1} / 4
          </span>
          <button
            type="button"
            data-testid="fast-pass-practice-btn"
            onClick={() =>
              onCompleteGate({
                stationId,
                block1Correct: 4,
                block2Correct: null,
                passed: true,
                excluded: false
              })
            }
            className="px-3 py-1 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-xs font-semibold text-white cursor-pointer"
          >
            Researcher Quick-Pass (4/4)
          </button>
        </div>
      </div>

      <p className="mt-3 text-base text-slate-200">{instructionSummary}</p>

      {showRepeatGuidance && (
        <div
          data-testid="practice-retry-guidance"
          className="mt-3 rounded-lg border border-amber-400/50 bg-amber-950/30 p-3 text-sm text-amber-100"
        >
          <strong>Step-by-Step Guided Demonstration (Block 2 of 2):</strong> Let&apos;s walk through one more practice set together. {currentItem.demoHint}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-slate-900/90 border border-slate-800 p-4">
        <p className="text-lg font-semibold text-white">{currentItem.prompt}</p>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            data-testid="practice-choice-correct"
            onClick={() => handleAnswer(currentItem.correctChoice)}
            className="min-h-14 px-4 py-3 rounded-xl bg-sky-700 hover:bg-sky-600 text-white font-bold text-base border-2 border-sky-400 cursor-pointer"
          >
            Select Matching Target (Correct Demo Option)
          </button>
          <button
            type="button"
            data-testid="practice-choice-incorrect"
            onClick={() =>
              handleAnswer(currentItem.correctChoice === 'STAR' ? 'GRID' : 'STAR')
            }
            className="min-h-14 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-base border-2 border-slate-600 cursor-pointer"
          >
            Select Non-Matching Distractor (Simulate Error)
          </button>
        </div>
      </div>
    </div>
  );
};
