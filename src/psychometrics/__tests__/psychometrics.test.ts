import { describe, expect, it } from 'vitest';
import {
  computeGateG0TimingCalibration,
  computeMyCogRCS,
  computeNavonGlobalLocalMetrics,
  computeQuadrantKruskalWallis,
  computeRawRtCoMAD,
  computeSequenceAndAssociativeScores,
  computeSRBChangeScore,
  computeWithinConditionSwitchMetrics,
  evaluateTwoLayerSyndromeRouter
} from '../psychometrics';
import {
  appendTrialEvent,
  computeEventLogSha256,
  resolveSessionPresentationMode
} from '../../eventLog/trialEventLog';
import {
  computeManifestSha256,
  getCanonicalProtocolManifest
} from '../../registry/protocolRegistry';

describe('PostCircECD Psychometric & Statistical Engine (F4, F10, F11, F13, Goldfish Edge Cases)', () => {
  it('1. Computes MyCog 3-MAD trimming and RCS accurately and guards against zero-MAD quantized RTs', () => {
    // 20 quantized trials at 500ms + 3 trials at 510ms + 1 extreme 4500ms outlier
    const quantizedTrials = [
      ...Array.from({ length: 20 }, () => ({ rtMs: 500, isCorrect: true })),
      { rtMs: 510, isCorrect: true },
      { rtMs: 512, isCorrect: true },
      { rtMs: 492, isCorrect: true },
      { rtMs: 4500, isCorrect: true } // should be trimmed by 3 * 16.67ms floor
    ];
    const res = computeMyCogRCS(quantizedTrials, 16.67);
    // Without the MAD floor, raw MAD = 0 and the 510/512/492ms valid trials would be falsely rejected!
    expect(res.validCount).toBe(23);
    expect(res.correctValidCount).toBe(23);
    expect(res.rcsPerSec).toBeCloseTo(2.0, 1);
  });

  it('2. Separates within-condition 3-MAD trimming for Repeat vs. Switch (F10a) and enforces trial & zero-accuracy gates (F10b)', () => {
    // 23 fast repeat trials (~550ms) and 7 slower switch trials (~1250ms)
    const repeatTrials = Array.from({ length: 23 }, (_, i) => ({
      condition: 'repeat' as const,
      rtMs: 530 + (i % 5) * 10,
      isCorrect: true
    }));
    const switchTrials = Array.from({ length: 7 }, (_, i) => ({
      condition: 'switch' as const,
      rtMs: 1200 + (i % 4) * 25,
      isCorrect: i < 6 // 6 of 7 correct
    }));
    const combined = [...repeatTrials, ...switchTrials];

    // Under pooled trimming, median is ~550ms and MAD is ~20ms, so 550 + 3*20 = 610ms would trim ALL 7 switch trials!
    const pooled = computeMyCogRCS(combined, 16.67);
    expect(pooled.validCount).toBe(23); // Pooled trimming wiped out all 7 switch trials!

    // Under within-condition trimming, all 23 repeat and all 7 switch trials are preserved!
    const within = computeWithinConditionSwitchMetrics(combined, 1000, 20261108);
    expect(within.validRepeatCount).toBe(23);
    expect(within.validSwitchCount).toBe(7);
    expect(within.scerStatus).toBe('VALID');
    expect(within.scer).not.toBeNull();
    expect(within.scer!).toBeGreaterThan(0.5);
    expect(within.scerBootstrap95Ci).not.toBeNull();

    // Verify deterministic seeded bootstrap CI
    const withinRepeatRun = computeWithinConditionSwitchMetrics(combined, 1000, 20261108);
    expect(withinRepeatRun.scerBootstrap95Ci).toEqual(within.scerBootstrap95Ci);

    // Verify minimum trial gate (< 5 switch trials)
    const insufficientSwitch = computeWithinConditionSwitchMetrics(
      [...repeatTrials, ...switchTrials.slice(0, 4)],
      500,
      20261108
    );
    expect(insufficientSwitch.scerStatus).toBe('INSUFFICIENT_TRIALS');
    expect(insufficientSwitch.scer).toBeNull();

    // Verify zero-repeat-accuracy guard (Goldfish Priority 1.2)
    const zeroAccuracyRepeat = repeatTrials.map((t) => ({ ...t, isCorrect: false }));
    const zeroAccRes = computeWithinConditionSwitchMetrics(
      [...zeroAccuracyRepeat, ...switchTrials],
      500,
      20261108
    );
    expect(zeroAccRes.scerStatus).toBe('INDETERMINATE_ZERO_REPEAT_ACCURACY');
    expect(zeroAccRes.scer).toBeNull();
  });

  it('3. Computes raw-RT CoMAD cleanly without motor-baseline subtraction distortion (F10c) and excludes technicalFrameDrop trials', () => {
    const baseRepeat = [
      { rtMs: 600 },
      { rtMs: 640 },
      { rtMs: 580 },
      { rtMs: 710 },
      { rtMs: 590 },
      { rtMs: 660 },
      { rtMs: 620 },
      { rtMs: 630 }
    ];
    const comadRaw = computeRawRtCoMAD(baseRepeat);
    expect(comadRaw).not.toBeNull();

    // Injecting a single hardware GC spike (3500ms) marked technicalFrameDrop: true must not inflate CoMAD!
    const withHardwareDrop = [
      ...baseRepeat,
      { rtMs: 3500, technicalFrameDrop: true }
    ];
    expect(computeRawRtCoMAD(withHardwareDrop)).toBe(comadRaw);
  });

  it('4. Computes 36-target S0.3 Kruskal-Wallis H with tie correction and clamps path efficiency (F10d)', () => {
    // Balanced 8 trials per quadrant with identical tied RTs -> H = 0, p = 1
    const balancedTied = (['Q1', 'Q2', 'Q3', 'Q4'] as const).flatMap((q) =>
      Array.from({ length: 8 }, () => ({
        quadrant: q,
        rtMs: 350,
        euclideanDistancePx: 120,
        trajectoryLengthPx: 100 // trajectory shorter than Euclidean should clamp to 1.0
      }))
    );
    const resBalanced = computeQuadrantKruskalWallis(balancedTied);
    expect(resBalanced.quadrantKruskalWallisH).toBe(0);
    expect(resBalanced.quadrantKruskalWallisP).toBe(1);
    expect(resBalanced.medianPathEfficiency).toBe(1.0);

    // Severe left hemispace (Q2/Q3) slowing vs Q1/Q4 -> significant H > 11.34 (p < 0.01)
    const asymmetric = [
      ...Array.from({ length: 8 }, (_, i) => ({ quadrant: 'Q1' as const, rtMs: 320 + i * 5 })),
      ...Array.from({ length: 8 }, (_, i) => ({ quadrant: 'Q4' as const, rtMs: 330 + i * 5 })),
      ...Array.from({ length: 8 }, (_, i) => ({ quadrant: 'Q2' as const, rtMs: 780 + i * 10 })),
      ...Array.from({ length: 8 }, (_, i) => ({ quadrant: 'Q3' as const, rtMs: 810 + i * 10 }))
    ];
    const resAsym = computeQuadrantKruskalWallis(asymmetric);
    expect(resAsym.quadrantKruskalWallisH!).toBeGreaterThan(15);
    expect(resAsym.quadrantKruskalWallisP!).toBeLessThan(0.005);
  });

  it('5. Computes chance-corrected recognition gain Delta_cue with zero division-by-zero at ceiling (F10e) and Modality Discrepancy', () => {
    // Ceiling performer: S_letter = 12/12, S_cued = 12/12 (formerly caused 0/0 NaN in RSI!)
    const ceilingRes = computeSequenceAndAssociativeScores({
      placedOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      sLetterFree: 12,
      sCuedTotal: 12,
      auditoryPlacedOrder: null
    });
    expect(Number.isNaN(ceilingRes.deltaCueGain)).toBe(false);
    expect(ceilingRes.deltaCueGain).toBe(0);
    expect(ceilingRes.isCueGainInterpretable).toBe(false);
    expect(ceilingRes.sComposite23).toBe(23);
    expect(ceilingRes.modalityDiscrepancyEstimand).toBeNull();

    // PCA profile: poor visual sequence (5/23), high auditory sequence (21/23), high cued rescue
    const pcaModalityRes = computeSequenceAndAssociativeScores({
      placedOrder: [0, 2, 1, 5, 4, 3, 7, 6, 9, 8, 10, 11],
      sLetterFree: 4,
      sCuedTotal: 11,
      auditoryPlacedOrder: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    });
    expect(pcaModalityRes.isCueGainInterpretable).toBe(true);
    expect(pcaModalityRes.deltaCueGain).toBeGreaterThan(0.5);
    expect(pcaModalityRes.modalityDiscrepancyEstimand).toBeGreaterThan(10);
  });

  it('6. Matches Table §4.2 SRB Change Score (z_SRB) across all 6 reliability levels to 3 decimal places (F4)', () => {
    const z1 = 2.0;
    const z2 = 0.4;

    const r49 = computeSRBChangeScore(z1, z2, 0.49, 0);
    expect(r49.expectedZ2RtmAdjusted).toBeCloseTo(0.98, 3);
    expect(r49.seEstSrb).toBeCloseTo(0.8717, 4);
    expect(r49.zSrb).toBeCloseTo(-0.665, 3);
    expect(r49.flaggedSignificantDecline95).toBe(false);

    const r61 = computeSRBChangeScore(z1, z2, 0.61, 0);
    expect(r61.expectedZ2RtmAdjusted).toBeCloseTo(1.22, 3);
    expect(r61.seEstSrb).toBeCloseTo(0.7924, 4);
    expect(r61.zSrb).toBeCloseTo(-1.035, 3);
    expect(r61.flaggedSignificantDecline95).toBe(false);

    const r71 = computeSRBChangeScore(z1, z2, 0.71, 0);
    expect(r71.expectedZ2RtmAdjusted).toBeCloseTo(1.42, 3);
    expect(r71.seEstSrb).toBeCloseTo(0.7042, 4);
    expect(r71.zSrb).toBeCloseTo(-1.448, 3);
    expect(r71.flaggedSignificantDecline95).toBe(false);

    const r78 = computeSRBChangeScore(z1, z2, 0.78, 0);
    expect(r78.expectedZ2RtmAdjusted).toBeCloseTo(1.56, 3);
    expect(r78.seEstSrb).toBeCloseTo(0.6258, 4);
    expect(r78.zSrb).toBeCloseTo(-1.854, 3);
    expect(r78.flaggedSignificantDecline95).toBe(false);

    const r85 = computeSRBChangeScore(z1, z2, 0.85, 0);
    expect(r85.expectedZ2RtmAdjusted).toBeCloseTo(1.7, 3);
    expect(r85.seEstSrb).toBeCloseTo(0.5268, 4);
    expect(r85.zSrb).toBeCloseTo(-2.468, 3);
    expect(r85.flaggedSignificantDecline95).toBe(true);

    const r92 = computeSRBChangeScore(z1, z2, 0.92, 0);
    expect(r92.expectedZ2RtmAdjusted).toBeCloseTo(1.84, 3);
    expect(r92.seEstSrb).toBeCloseTo(0.3919, 4);
    expect(r92.zSrb).toBeCloseTo(-3.674, 3);
    expect(r92.flaggedSignificantDecline95).toBe(true);
  });

  it('7. Enforces immutable trialEventLog, SHA-256 content-hash locking, and <= 2 conditional probe cap (F11)', () => {
    const manifest = getCanonicalProtocolManifest();
    const hash1 = computeManifestSha256(manifest);
    expect(hash1).toHaveLength(64);

    // Modifying a single rule in a cloned manifest produces a distinct SHA-256 digest without mutating the original
    const modified = structuredClone(manifest);
    modified.heuristics.enable2026LbdDorsalVentralRule = false;
    const hash2 = computeManifestSha256(modified);
    expect(hash2).not.toBe(hash1);
    expect(computeManifestSha256(manifest)).toBe(hash1);

    // Append trial events and verify MIXED_MODES detection
    let log = appendTrialEvent([], {
      stationId: 'S3.1',
      condition: 'repeat',
      practiceMode: false,
      presentationMode: 'OBSERVATORY_3D_SPOTLIGHT_LOCK',
      stimulusOnsetMs: 100,
      responseMs: 620,
      rtMs: 520,
      isCorrect: true,
      maxFrameDeltaMs: 16.7,
      modeSwitchInterrupted: false
    });
    expect(resolveSessionPresentationMode(log, 'OBSERVATORY_3D_SPOTLIGHT_LOCK')).toBe(
      'OBSERVATORY_3D_SPOTLIGHT_LOCK'
    );
    log = appendTrialEvent(log, {
      stationId: 'S3.1',
      condition: 'switch',
      practiceMode: false,
      presentationMode: 'PLAIN_STATIC_2D',
      stimulusOnsetMs: 800,
      responseMs: 1700,
      rtMs: 900,
      isCorrect: true,
      maxFrameDeltaMs: 64.0, // > 50ms -> technicalFrameDrop: true
      modeSwitchInterrupted: false
    });
    expect(log[1].technicalFrameDrop).toBe(true);
    expect(resolveSessionPresentationMode(log, 'PLAIN_STATIC_2D')).toBe('MIXED_MODES');
    expect(computeEventLogSha256(log)).toHaveLength(64);

    // Verify router <= 2 conditional probe cap & hearing-check suppression
    const routerRes = evaluateTwoLayerSyndromeRouter(
      {
        'S1.1': {
          rcsGlobalPerSec: 0.45,
          rcsLocalPerSec: 1.1,
          rcsUncrowdedPerSec: 1.05,
          rcsCrowdedPerSec: 0.55,
          gldiRatio: 0.41,
          crowdingCostRatio: 0.52,
          measuredDurationSec: 90
        },
        'S3.1': {
          totalTrials: 30,
          validPooledCount: 30,
          rcsPooledPerSec: 0.9,
          validRepeatCount: 23,
          validSwitchCount: 7,
          rcsRepeatPerSec: 1.1,
          rcsSwitchPerSec: 0.6,
          scer: 0.45,
          scerBootstrap95Ci: [0.3, 0.6],
          scerStatus: 'VALID',
          comadRepeatRaw: 0.39,
          technicalDropsExcluded: 0,
          measuredDurationSec: 110
        },
        'S5.1': {
          sExact12: 3,
          sAdjacent11: 2,
          sComposite23: 5,
          sLetterFree: 3,
          sCuedTotal: 10,
          pFree: 0.25,
          pFreeWilson95Ci: [0.09, 0.53],
          pCuedCorrected: 0.78,
          pCuedWilson95Ci: [0.55, 0.95],
          deltaCueGain: 0.53,
          isCueGainInterpretable: true,
          auditorySequenceScore23: 20,
          modalityDiscrepancyEstimand: 15,
          famousStep1FreeNamingCorrect: 7,
          famousStep2aVisualSemanticCorrect: 8,
          famousStep2bVerbalClueCorrect: 8,
          famousStep3PhonemicCuedCorrect: 8,
          measuredDurationSec: 160
        }
      },
      false, // hearingCheckPassed = false -> suppresses S5.3
      manifest
    );

    const queued = routerRes.triggeredRules.filter((r) => r.status === 'TRIGGERED_AND_QUEUED');
    const capped = routerRes.triggeredRules.filter(
      (r) => r.status === 'SUPPRESSED_MAX_2_PROBES_CAP'
    );
    const hearingSuppressed = routerRes.triggeredRules.filter(
      (r) => r.status === 'SUPPRESSED_HEARING_CHECK_FAILED'
    );
    expect(queued.length).toBe(2);
    expect(capped.length).toBe(1);
    expect(hearingSuppressed.length).toBe(1);

    // Also verify Profile 2 (Ventral Perceptual / Prosopagnosia Step 2A < Step 2B) branch is reachable
    const profile2Res = evaluateTwoLayerSyndromeRouter(
      {
        'S2.2': {
          canonicalAccuracy: 8,
          foreshortenedAccuracy: 4,
          invarianceRatio: 0.5,
          measuredDurationSec: 60
        }
      },
      true,
      manifest
    );
    expect(profile2Res.primaryLayer1Profile).toBe('PROFILE_2_VENTRAL_PERCEPTUAL_CROWDING');
  });

  it('8. Computes Gate G0 hardware timing calibration and Navon GLDI zero-division guard', () => {
    const g0 = computeGateG0TimingCalibration([16.6, 16.7, 16.8, 16.5], [16.6, 16.7], 18.2);
    expect(g0.frameIntervalMedianMs).toBeCloseTo(16.65, 1);
    expect(g0.shaderPrewarmCompleted).toBe(true);

    const navonZeroLocal = computeNavonGlobalLocalMetrics([
      { level: 'global', crowded: false, rtMs: 600, isCorrect: true },
      { level: 'local', crowded: false, rtMs: 600, isCorrect: false }
    ]);
    expect(navonZeroLocal.gldiRatio).toBeNull();
  });
});
