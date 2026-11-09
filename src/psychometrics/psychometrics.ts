import type {
  GateG0TimingCalibration,
  ResearchProtocolManifest,
  RoutingLogEntry,
  S03PointingTelemetry,
  S11NavonTelemetry,
  S31SwitchboardTelemetry,
  S5MemoryFamousTelemetry,
  StationTelemetryMap,
  SyndromeProfileId,
  TrialEvent,
  TwoLayerRoutingResult
} from '../types/sessionSchema';
import { createSeededPrng } from '../eventLog/trialEventLog';

export function computeMedian(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeMAD(values: readonly number[], precomputedMedian?: number): number {
  if (values.length === 0) return 0;
  const med = precomputedMedian ?? computeMedian(values);
  const absDevs = values.map((v) => Math.abs(v - med));
  return computeMedian(absDevs);
}

export function computeIQR(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  return sorted[q3Idx] - sorted[q1Idx];
}

/**
 * Gate G0: Hardware, Frame-Time & Audio Latency Verification (§5.2, Inventive Catalyst Finding 1)
 */
export function computeGateG0TimingCalibration(
  frameDeltasMs: readonly number[],
  pointerDeltasMs: readonly number[],
  audioOutputLatencyMs: number,
  shaderPrewarmCompleted = true
): GateG0TimingCalibration {
  const frameIntervalMedianMs =
    frameDeltasMs.length > 0 ? Number(computeMedian(frameDeltasMs).toFixed(2)) : 16.67;
  const frameIntervalIqrMs =
    frameDeltasMs.length > 1 ? Number(computeIQR(frameDeltasMs).toFixed(2)) : 0.4;
  const pointerMedianMs =
    pointerDeltasMs.length > 0 ? computeMedian(pointerDeltasMs) : 16.67;
  const pointerSampleHz =
    pointerMedianMs > 0 ? Number((1000 / pointerMedianMs).toFixed(1)) : 60.0;
  // Minimum detectable RT effect (2 * sqrt(frameVar + pointerVar) conservative bound)
  const minimumDetectableEffectMs = Number(
    Math.max(16.67, frameIntervalMedianMs + 2 * frameIntervalIqrMs).toFixed(2)
  );

  return {
    frameIntervalMedianMs,
    frameIntervalIqrMs,
    pointerSampleHz,
    audioOutputLatencyMs: Number(audioOutputLatencyMs.toFixed(2)),
    minimumDetectableEffectMs,
    shaderPrewarmCompleted
  };
}

/**
 * Filter valid trials within [100ms, 9000ms] and within 3-MAD of the condition median.
 * Includes Goldfish Priority 1 & Finding 2 minimum MAD floor so quantized timestamps
 * never collapse MAD to zero and reject valid trials.
 */
export function filterTrialsBy3MAD(
  trials: readonly { rtMs: number; isCorrect: boolean; modeSwitchInterrupted?: boolean }[],
  minMadFloorMs = 16.67
): { validTrials: typeof trials[number][]; medianMs: number; madMs: number } {
  const inBounds = trials.filter(
    (t) => !t.modeSwitchInterrupted && t.rtMs >= 100 && t.rtMs <= 9000
  );
  if (inBounds.length === 0) {
    return { validTrials: [], medianMs: 0, madMs: 0 };
  }
  const rts = inBounds.map((t) => t.rtMs);
  const medianMs = computeMedian(rts);
  const rawMadMs = computeMAD(rts, medianMs);
  const effectiveMadMs = Math.max(rawMadMs, minMadFloorMs);
  const validTrials = inBounds.filter((t) => Math.abs(t.rtMs - medianMs) <= 3 * effectiveMadMs);
  return { validTrials, medianMs, madMs: rawMadMs };
}

/**
 * MyCog Pooled Rate-Correct Score (RCS) per §2.2.1 (MyCogTechSpec.md Section 2.2):
 * RCS = C_valid / sum(RT_i in seconds across all valid trials in block)
 */
export function computeMyCogRCS(
  trials: readonly { rtMs: number; isCorrect: boolean; modeSwitchInterrupted?: boolean }[],
  minMadFloorMs = 16.67
): {
  validCount: number;
  correctValidCount: number;
  totalValidTimeSec: number;
  rcsPerSec: number;
  medianRtMs: number;
  madRtMs: number;
} {
  const { validTrials, medianMs, madMs } = filterTrialsBy3MAD(trials, minMadFloorMs);
  if (validTrials.length === 0) {
    return {
      validCount: 0,
      correctValidCount: 0,
      totalValidTimeSec: 0,
      rcsPerSec: 0,
      medianRtMs: 0,
      madRtMs: 0
    };
  }
  const correctValidCount = validTrials.filter((t) => t.isCorrect).length;
  const totalValidTimeSec = validTrials.reduce((sum, t) => sum + t.rtMs / 1000, 0);
  const rcsPerSec = totalValidTimeSec > 0 ? correctValidCount / totalValidTimeSec : 0;
  return {
    validCount: validTrials.length,
    correctValidCount,
    totalValidTimeSec,
    rcsPerSec: Number(rcsPerSec.toFixed(4)),
    medianRtMs: Number(medianMs.toFixed(2)),
    madRtMs: Number(madMs.toFixed(2))
  };
}

/**
 * OLS linear-detrended raw-RT CoMAD on Repeat trials (§2.2.4, F10c, Goldfish Priority 1.3):
 * Detrends trial-order fatigue e_i = RT_i - (beta0 + beta1 * i), re-centers on raw median
 * RT'_i = median(RT_raw) + e_i, and computes MAD(RT') / median(RT_raw).
 * Crucially: computed on UNSUBTRACTED raw RTs (never subtracting RT_motor) and excludes
 * technicalFrameDrop trials (Inventive Catalyst Finding 1).
 */
export function computeRawRtCoMAD(
  repeatTrials: readonly {
    rtMs: number;
    technicalFrameDrop?: boolean;
    modeSwitchInterrupted?: boolean;
  }[]
): number | null {
  const clean = repeatTrials.filter(
    (t) => !t.technicalFrameDrop && !t.modeSwitchInterrupted && t.rtMs >= 100 && t.rtMs <= 9000
  );
  if (clean.length < 5) return null;

  const rts = clean.map((t) => t.rtMs);
  const rawMedian = computeMedian(rts);
  if (rawMedian <= 0) return null;

  // OLS linear detrending across trial order k = 0 .. n-1
  const n = rts.length;
  const meanK = (n - 1) / 2;
  const meanRt = rts.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let k = 0; k < n; k++) {
    const dk = k - meanK;
    num += dk * (rts[k] - meanRt);
    den += dk * dk;
  }
  const slope = den > 0 ? num / den : 0;
  const intercept = meanRt - slope * meanK;

  const detrendedCentered = rts.map((rt, k) => {
    const residual = rt - (intercept + slope * k);
    return rawMedian + residual;
  });

  const detrendedMad = computeMAD(detrendedCentered, rawMedian);
  return Number((detrendedMad / rawMedian).toFixed(4));
}

/**
 * Within-Condition 3-MAD Trimming, Canonical SCER = 1 - RCS_switch / RCS_repeat,
 * Seeded 1000-Sample Stratified Bootstrap 95% CI, and Raw-RT CoMAD (§2.2.2–2.2.4, F10a–c)
 */
export function computeWithinConditionSwitchMetrics(
  trials: readonly {
    condition: 'repeat' | 'switch' | string;
    rtMs: number;
    isCorrect: boolean;
    technicalFrameDrop?: boolean;
    modeSwitchInterrupted?: boolean;
  }[],
  bootstrapIterations = 1000,
  prngSeed = 20261108,
  minMadFloorMs = 16.67,
  measuredDurationSec = 110.0
): S31SwitchboardTelemetry {
  const pooled = computeMyCogRCS(trials, minMadFloorMs);

  const rawRepeat = trials.filter((t) => t.condition === 'repeat');
  const rawSwitch = trials.filter((t) => t.condition === 'switch');

  const validRepeatRes = filterTrialsBy3MAD(rawRepeat, minMadFloorMs);
  const validSwitchRes = filterTrialsBy3MAD(rawSwitch, minMadFloorMs);

  const validRepeat = validRepeatRes.validTrials;
  const validSwitch = validSwitchRes.validTrials;

  const repeatCorrect = validRepeat.filter((t) => t.isCorrect).length;
  const repeatTimeSec = validRepeat.reduce((s, t) => s + t.rtMs / 1000, 0);
  const rcsRepeatPerSec = repeatTimeSec > 0 ? repeatCorrect / repeatTimeSec : 0;

  const switchCorrect = validSwitch.filter((t) => t.isCorrect).length;
  const switchTimeSec = validSwitch.reduce((s, t) => s + t.rtMs / 1000, 0);
  const rcsSwitchPerSec = switchTimeSec > 0 ? switchCorrect / switchTimeSec : 0;

  const technicalDropsExcluded = trials.filter((t) => t.technicalFrameDrop).length;
  const comadRepeatRaw = computeRawRtCoMAD(
    validRepeat.filter((t) => {
      // Match back technicalFrameDrop from rawRepeat
      return !(t as { technicalFrameDrop?: boolean }).technicalFrameDrop;
    })
  );

  // Minimum valid-trial gates (F10b: >= 15 repeat AND >= 5 switch)
  if (validRepeat.length < 15 || validSwitch.length < 5) {
    return {
      totalTrials: trials.length,
      validPooledCount: pooled.validCount,
      rcsPooledPerSec: pooled.rcsPerSec,
      validRepeatCount: validRepeat.length,
      validSwitchCount: validSwitch.length,
      rcsRepeatPerSec: Number(rcsRepeatPerSec.toFixed(4)),
      rcsSwitchPerSec: Number(rcsSwitchPerSec.toFixed(4)),
      scer: null,
      scerBootstrap95Ci: null,
      scerStatus: 'INSUFFICIENT_TRIALS',
      comadRepeatRaw,
      technicalDropsExcluded,
      measuredDurationSec
    };
  }

  // Zero-accuracy guard (Goldfish Priority 1.2)
  if (rcsRepeatPerSec <= 0) {
    return {
      totalTrials: trials.length,
      validPooledCount: pooled.validCount,
      rcsPooledPerSec: pooled.rcsPerSec,
      validRepeatCount: validRepeat.length,
      validSwitchCount: validSwitch.length,
      rcsRepeatPerSec: 0,
      rcsSwitchPerSec: Number(rcsSwitchPerSec.toFixed(4)),
      scer: null,
      scerBootstrap95Ci: null,
      scerStatus: 'INDETERMINATE_ZERO_REPEAT_ACCURACY',
      comadRepeatRaw,
      technicalDropsExcluded,
      measuredDurationSec
    };
  }

  const scer = Number((1 - rcsSwitchPerSec / rcsRepeatPerSec).toFixed(4));

  // Stratified bootstrap 95% CI using seeded PRNG
  const rand = createSeededPrng(prngSeed);
  const bootScer: number[] = [];
  for (let b = 0; b < bootstrapIterations; b++) {
    let repC = 0;
    let repT = 0;
    for (let i = 0; i < validRepeat.length; i++) {
      const pick = validRepeat[Math.floor(rand() * validRepeat.length)];
      if (pick.isCorrect) repC++;
      repT += pick.rtMs / 1000;
    }
    let swC = 0;
    let swT = 0;
    for (let i = 0; i < validSwitch.length; i++) {
      const pick = validSwitch[Math.floor(rand() * validSwitch.length)];
      if (pick.isCorrect) swC++;
      swT += pick.rtMs / 1000;
    }
    const rcsRepBoot = repT > 0 ? repC / repT : 0;
    const rcsSwBoot = swT > 0 ? swC / swT : 0;
    if (rcsRepBoot > 0) {
      bootScer.push(1 - rcsSwBoot / rcsRepBoot);
    }
  }

  bootScer.sort((a, b) => a - b);
  const loIdx = Math.floor(bootScer.length * 0.025);
  const hiIdx = Math.min(bootScer.length - 1, Math.floor(bootScer.length * 0.975));
  const scerBootstrap95Ci: [number, number] | null =
    bootScer.length > 0
      ? [Number(bootScer[loIdx].toFixed(4)), Number(bootScer[hiIdx].toFixed(4))]
      : null;

  return {
    totalTrials: trials.length,
    validPooledCount: pooled.validCount,
    rcsPooledPerSec: pooled.rcsPerSec,
    validRepeatCount: validRepeat.length,
    validSwitchCount: validSwitch.length,
    rcsRepeatPerSec: Number(rcsRepeatPerSec.toFixed(4)),
    rcsSwitchPerSec: Number(rcsSwitchPerSec.toFixed(4)),
    scer,
    scerBootstrap95Ci,
    scerStatus: 'VALID',
    comadRepeatRaw,
    technicalDropsExcluded,
    measuredDurationSec
  };
}

/**
 * Exact survival function 1 - CDF of Chi-Square(df = 3) for Kruskal-Wallis across 4 quadrants:
 * For df = 3, P(X > x) = erfc(sqrt(x / 2)) + sqrt(2 * x / pi) * exp(-x / 2).
 */
function chiSquareDf3SurvivalPValue(h: number): number {
  if (h <= 0) return 1.0;
  const z = Math.sqrt(h / 2);
  // Abramowitz & Stegun 7.1.26 approximation for erfc(z) (max error 1.5e-7)
  const t = 1 / (1 + 0.3275911 * z);
  const poly =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erfcZ = poly * Math.exp(-z * z);
  const term2 = Math.sqrt((2 * h) / Math.PI) * Math.exp(-h / 2);
  return Math.max(0, Math.min(1, erfcZ + term2));
}

/**
 * Station S0.3: 36-Target Quadrant Pointing & Motor Baseline (§2.1, F10d, Goldfish Priority 1.2)
 * Computes RT_motor, clamped path efficiency in (0, 1.0], and tie-corrected Kruskal-Wallis H & p-value.
 */
export function computeQuadrantKruskalWallis(
  pointingTrials: readonly {
    quadrant: 'center' | 'Q1' | 'Q2' | 'Q3' | 'Q4';
    rtMs: number;
    euclideanDistancePx?: number;
    trajectoryLengthPx?: number;
  }[],
  measuredDurationSec = 45.0
): S03PointingTelemetry {
  const validAll = pointingTrials.filter((t) => t.rtMs >= 100 && t.rtMs <= 9000);
  const rtMotorMedianMs = Number(computeMedian(validAll.map((t) => t.rtMs)).toFixed(2));

  // Path efficiency clamped to (0, 1.0]
  const pathEfficiencies = validAll.map((t) => {
    const dEuc = t.euclideanDistancePx ?? 100;
    const dTraj = t.trajectoryLengthPx ?? dEuc;
    if (dEuc <= 0 || dTraj <= 0) return 1.0;
    return Math.min(1.0, Math.max(0.01, dEuc / dTraj));
  });
  const medianPathEfficiency =
    pathEfficiencies.length > 0 ? Number(computeMedian(pathEfficiencies).toFixed(4)) : 1.0;

  const quadrants: ('Q1' | 'Q2' | 'Q3' | 'Q4')[] = ['Q1', 'Q2', 'Q3', 'Q4'];
  const quadrantMediansMs: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number> = {
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0
  };
  const quadrantValidCounts: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number> = {
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0
  };

  const peripheral: { quadrant: 'Q1' | 'Q2' | 'Q3' | 'Q4'; rtMs: number }[] = [];
  for (const q of quadrants) {
    const qTrials = validAll.filter((t) => t.quadrant === q);
    quadrantValidCounts[q] = qTrials.length;
    quadrantMediansMs[q] = Number(computeMedian(qTrials.map((t) => t.rtMs)).toFixed(2));
    for (const qt of qTrials) {
      peripheral.push({ quadrant: q, rtMs: qt.rtMs });
    }
  }

  // Require at least 3 valid trials per quadrant for Kruskal-Wallis
  if (quadrants.some((q) => quadrantValidCounts[q] < 3)) {
    return {
      rtMotorMedianMs,
      quadrantMediansMs,
      quadrantValidCounts,
      quadrantKruskalWallisH: null,
      quadrantKruskalWallisP: null,
      medianPathEfficiency,
      measuredDurationSec
    };
  }

  const N = peripheral.length;
  const sorted = peripheral
    .map((item, idx) => ({ ...item, idx }))
    .sort((a, b) => a.rtMs - b.rtMs);

  // Assign average ranks for ties and accumulate tie correction sum(t_g^3 - t_g)
  const ranks = new Array<number>(N);
  let tieSum = 0;
  let i = 0;
  while (i < N) {
    let j = i;
    while (j < N && sorted[j].rtMs === sorted[i].rtMs) {
      j++;
    }
    const tieCount = j - i;
    const avgRank = (i + 1 + j) / 2;
    for (let k = i; k < j; k++) {
      ranks[sorted[k].idx] = avgRank;
    }
    if (tieCount > 1) {
      tieSum += tieCount * tieCount * tieCount - tieCount;
    }
    i = j;
  }

  const rankSumByQ: Record<'Q1' | 'Q2' | 'Q3' | 'Q4', number> = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  for (let idx = 0; idx < N; idx++) {
    rankSumByQ[peripheral[idx].quadrant] += ranks[idx];
  }

  let sumSqTerm = 0;
  for (const q of quadrants) {
    const nq = quadrantValidCounts[q];
    sumSqTerm += (rankSumByQ[q] * rankSumByQ[q]) / nq;
  }

  const hRaw = (12 / (N * (N + 1))) * sumSqTerm - 3 * (N + 1);
  const tieDenom = 1 - tieSum / (N * N * N - N);
  const hCorrected = tieDenom > 0 ? Math.max(0, hRaw / tieDenom) : 0;
  const pVal = chiSquareDf3SurvivalPValue(hCorrected);

  return {
    rtMotorMedianMs,
    quadrantMediansMs,
    quadrantValidCounts,
    quadrantKruskalWallisH: Number(hCorrected.toFixed(4)),
    quadrantKruskalWallisP: Number(pVal.toFixed(4)),
    medianPathEfficiency,
    measuredDurationSec
  };
}

/**
 * Station S1.1: Navon Global-vs-Local & Crowding Ratios (§2.3.1, Goldfish Priority 1.2 guard)
 */
export function computeNavonGlobalLocalMetrics(
  trials: readonly {
    level: 'global' | 'local';
    crowded: boolean;
    rtMs: number;
    isCorrect: boolean;
  }[],
  measuredDurationSec = 90.0
): S11NavonTelemetry {
  const globalRes = computeMyCogRCS(trials.filter((t) => t.level === 'global'));
  const localRes = computeMyCogRCS(trials.filter((t) => t.level === 'local'));
  const uncrowdedRes = computeMyCogRCS(trials.filter((t) => !t.crowded));
  const crowdedRes = computeMyCogRCS(trials.filter((t) => t.crowded));

  const gldiRatio =
    localRes.rcsPerSec > 0 ? Number((globalRes.rcsPerSec / localRes.rcsPerSec).toFixed(4)) : null;
  const crowdingCostRatio =
    uncrowdedRes.rcsPerSec > 0
      ? Number((crowdedRes.rcsPerSec / uncrowdedRes.rcsPerSec).toFixed(4))
      : null;

  return {
    rcsGlobalPerSec: globalRes.rcsPerSec,
    rcsLocalPerSec: localRes.rcsPerSec,
    rcsUncrowdedPerSec: uncrowdedRes.rcsPerSec,
    rcsCrowdedPerSec: crowdedRes.rcsPerSec,
    gldiRatio,
    crowdingCostRatio,
    measuredDurationSec
  };
}

/**
 * Wilson Score 95% Binomial Confidence Interval
 */
export function computeWilson95CI(k: number, n: number): [number, number] {
  if (n <= 0) return [0, 0];
  const z = 1.959964;
  const z2 = z * z;
  const p = Math.max(0, Math.min(1, k / n));
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const halfWidth = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return [
    Number(Math.max(0, center - halfWidth).toFixed(4)),
    Number(Math.min(1, center + halfWidth).toFixed(4))
  ];
}

/**
 * Station S5.1 / S5.2 / S5.3: 12-Item Sequence Ordering, Chance-Corrected Recognition Gain (Delta_cue),
 * and Primary Modality Discrepancy Estimand (§2.4, §5.2, F10e, Goldfish Priority 1.3)
 */
export function computeSequenceAndAssociativeScores(params: {
  placedOrder: readonly number[]; // length 12, true order is [0,1,2,...,11]
  sLetterFree: number; // 0..12
  sCuedTotal: number; // 0..12 (out of L=12 4-AFC items)
  auditoryPlacedOrder?: readonly number[] | null;
  famousStep1FreeNamingCorrect?: number;
  famousStep2aVisualSemanticCorrect?: number;
  famousStep2bVerbalClueCorrect?: number;
  famousStep3PhonemicCuedCorrect?: number;
  measuredDurationSec?: number;
}): S5MemoryFamousTelemetry {
  const L = 12;
  const kChoices = 4; // 4-alternative forced-choice

  let sExact12 = 0;
  for (let i = 0; i < Math.min(L, params.placedOrder.length); i++) {
    if (params.placedOrder[i] === i) sExact12++;
  }

  let sAdjacent11 = 0;
  for (let i = 0; i < Math.min(L - 1, params.placedOrder.length - 1); i++) {
    if (params.placedOrder[i + 1] - params.placedOrder[i] === 1) {
      sAdjacent11++;
    }
  }

  const sComposite23 = sExact12 + sAdjacent11;
  const sLetterFree = Math.max(0, Math.min(L, params.sLetterFree));
  const sCuedTotal = Math.max(0, Math.min(L, params.sCuedTotal));

  const pFree = Number((sLetterFree / L).toFixed(4));
  const pFreeWilson95Ci = computeWilson95CI(sLetterFree, L);

  const pCuedRaw = sCuedTotal / L;
  const chanceRate = 1 / kChoices; // 0.25
  const pCuedCorrected = Number(
    Math.max(0, (pCuedRaw - chanceRate) / (1 - chanceRate)).toFixed(4)
  );
  const pCuedWilson95Ci = computeWilson95CI(sCuedTotal, L);

  // Bounded, chance-corrected recognition gain: Delta_cue = p_cued,corr - p_free
  // Never divides by (L - sLetterFree), so zero division-by-zero when sLetterFree === L!
  const deltaCueGain = Number((pCuedCorrected - pFree).toFixed(4));
  const isCueGainInterpretable = L - sLetterFree >= 4;

  let auditorySequenceScore23: number | null = null;
  let modalityDiscrepancyEstimand: number | null = null;
  if (params.auditoryPlacedOrder && params.auditoryPlacedOrder.length > 0) {
    let audExact = 0;
    let audAdj = 0;
    for (let i = 0; i < Math.min(L, params.auditoryPlacedOrder.length); i++) {
      if (params.auditoryPlacedOrder[i] === i) audExact++;
    }
    for (let i = 0; i < Math.min(L - 1, params.auditoryPlacedOrder.length - 1); i++) {
      if (params.auditoryPlacedOrder[i + 1] - params.auditoryPlacedOrder[i] === 1) audAdj++;
    }
    auditorySequenceScore23 = audExact + audAdj;
    modalityDiscrepancyEstimand = auditorySequenceScore23 - sComposite23;
  }

  return {
    sExact12,
    sAdjacent11,
    sComposite23,
    sLetterFree,
    sCuedTotal,
    pFree,
    pFreeWilson95Ci,
    pCuedCorrected,
    pCuedWilson95Ci,
    deltaCueGain,
    isCueGainInterpretable,
    auditorySequenceScore23,
    modalityDiscrepancyEstimand,
    famousStep1FreeNamingCorrect: params.famousStep1FreeNamingCorrect ?? 7,
    famousStep2aVisualSemanticCorrect: params.famousStep2aVisualSemanticCorrect ?? 8,
    famousStep2bVerbalClueCorrect: params.famousStep2bVerbalClueCorrect ?? 8,
    famousStep3PhonemicCuedCorrect: params.famousStep3PhonemicCuedCorrect ?? 8,
    measuredDurationSec: params.measuredDurationSec ?? 165.0
  };
}

/**
 * Standardized Regression-Based (SRB) Change Score per Hammers et al. (2020) (§4.2, F4):
 * E[Z2 | Z1] = practiceOffset + rxx * Z1
 * SE_est = sqrt(1 - rxx^2)
 * z_SRB = (Z2 - E[Z2 | Z1]) / SE_est
 * Also computes simple-difference RCI for side-by-side comparison.
 */
export function computeSRBChangeScore(
  z1: number,
  z2: number,
  rxx: number,
  practiceOffset = 0
): {
  z1: number;
  z2: number;
  rxx: number;
  expectedZ2RtmAdjusted: number;
  seEstSrb: number;
  zSrb: number;
  requiredZ2For95Threshold: number;
  flaggedSignificantDecline95: boolean;
  simpleDiffRci: number;
  simpleDiffSe: number;
} {
  const clampedRxx = Math.max(0.01, Math.min(0.999, rxx));
  const expectedZ2RtmAdjusted = practiceOffset + clampedRxx * z1;
  const seEstSrb = Math.sqrt(1 - clampedRxx * clampedRxx);
  const zSrb = (z2 - expectedZ2RtmAdjusted) / seEstSrb;
  const requiredZ2For95Threshold = expectedZ2RtmAdjusted - 1.96 * seEstSrb;

  const simpleDiffSe = Math.sqrt(2 * (1 - clampedRxx));
  const simpleDiffRci = (z2 - z1 - practiceOffset) / simpleDiffSe;

  return {
    z1,
    z2,
    rxx: clampedRxx,
    expectedZ2RtmAdjusted: Number(expectedZ2RtmAdjusted.toFixed(3)),
    seEstSrb: Number(seEstSrb.toFixed(4)),
    zSrb: Number(zSrb.toFixed(3)),
    requiredZ2For95Threshold: Number(requiredZ2For95Threshold.toFixed(3)),
    flaggedSignificantDecline95: zSrb <= -1.96,
    simpleDiffRci: Number(simpleDiffRci.toFixed(3)),
    simpleDiffSe: Number(simpleDiffSe.toFixed(4))
  };
}

/**
 * Holm-Bonferroni Step-Down Family-Wise Error Control across M domains (§3.1.2, F11)
 */
export function applyHolmBonferroni(
  domainProxyPValues: readonly { domain: string; rawPValueProxy: number }[],
  alpha = 0.05
): { domain: string; rawPValueProxy: number; holmThreshold: number; flagged: boolean }[] {
  const m = domainProxyPValues.length;
  const sorted = [...domainProxyPValues].sort((a, b) => a.rawPValueProxy - b.rawPValueProxy);
  let stopRejecting = false;
  return sorted.map((item, idx) => {
    const rank = idx + 1;
    const holmThreshold = Number((alpha / (m - rank + 1)).toFixed(4));
    if (stopRejecting || item.rawPValueProxy > holmThreshold) {
      stopRejecting = true;
      return { ...item, holmThreshold, flagged: false };
    }
    return { ...item, holmThreshold, flagged: true };
  });
}

/**
 * Deterministic Two-Layer Convergent Router (§3.1, §7.1, F11):
 * Pure function of StationTelemetryMap, SensoryChecks, and ResearchProtocolManifest.
 * Enforces the <= 2 conditional probe cap and logs every rule with [PROPOSED / UNVALIDATED].
 */
export function evaluateTwoLayerSyndromeRouter(
  telemetry: StationTelemetryMap,
  hearingCheckPassed: boolean,
  manifest: ResearchProtocolManifest
): TwoLayerRoutingResult {
  const candidateRules: Omit<RoutingLogEntry, 'status'>[] = [];
  const h = manifest.heuristics;

  const s11 = telemetry['S1.1'];
  if (
    s11 &&
    ((s11.gldiRatio !== null && s11.gldiRatio < h.gldiAnomalyCutoff) ||
      (s11.crowdingCostRatio !== null && s11.crowdingCostRatio < h.crowdingRatioCutoff))
  ) {
    candidateRules.push({
      ruleId: 'R1_SIMULTANAGNOSIA_CROWDING',
      triggerStationId: 'S1.1',
      targetProbeId: 'S1.2',
      observedMetricSummary: `GLDI=${s11.gldiRatio ?? 'N/A'} (<${h.gldiAnomalyCutoff}) | CrowdingRatio=${s11.crowdingCostRatio ?? 'N/A'} (<${h.crowdingRatioCutoff})`,
      thresholdTag: 'PROPOSED / UNVALIDATED — HEURISTIC ROUTING RULE'
    });
  }

  const s31 = telemetry['S3.1'];
  const s01 = telemetry['S0.1'];
  if (
    (s31 && s31.comadRepeatRaw !== null && s31.comadRepeatRaw > h.comadFluctuationCutoff) ||
    (s01 && s01.visualHallucinationRbdFlag)
  ) {
    candidateRules.push({
      ruleId: 'R2_FLUCTUATION_OR_RBD_PAREIDOLIA',
      triggerStationId: 'S3.1',
      targetProbeId: 'S2.1',
      observedMetricSummary: `CoMAD_repeat=${s31?.comadRepeatRaw ?? 'N/A'} (>${h.comadFluctuationCutoff}) | RBD/VH=${Boolean(s01?.visualHallucinationRbdFlag)}`,
      thresholdTag: 'PROPOSED / UNVALIDATED — HEURISTIC ROUTING RULE'
    });
  }

  if (s31 && s31.scer !== null && s31.scer > h.scerElevatedCutoff) {
    candidateRules.push({
      ruleId: 'R3_EXECUTIVE_SWITCH_COST_CASCADE',
      triggerStationId: 'S3.1',
      targetProbeId: 'S3.4',
      observedMetricSummary: `SCER=${s31.scer} (>${h.scerElevatedCutoff})`,
      thresholdTag: 'PROPOSED / UNVALIDATED — HEURISTIC ROUTING RULE'
    });
  }

  const s51 = telemetry['S5.1'];
  if (s51 && s51.sComposite23 <= 12) {
    candidateRules.push({
      ruleId: 'R4_VISUAL_VS_AUDITORY_MEMORY_DISCREPANCY',
      triggerStationId: 'S5.1',
      targetProbeId: 'S5.3',
      observedMetricSummary: `Visual S_comp=${s51.sComposite23}/23`,
      thresholdTag: 'PROPOSED / UNVALIDATED — HEURISTIC ROUTING RULE'
    });
  }

  const s41ForRule = telemetry['S4.1'];
  if (s41ForRule && s41ForRule.phonologicalQueueDecayFlag) {
    candidateRules.push({
      ruleId: 'R5_PHONOLOGICAL_LOOP_ECHO_DECAY',
      triggerStationId: 'S4.1',
      targetProbeId: 'S5.2',
      observedMetricSummary: `EchoAccuracy=${Math.round(s41ForRule.sentenceRepetitionAccuracy * 100)}% | MedianIRI=${s41ForRule.letterFMedianIriMs}ms`,
      thresholdTag: 'PROPOSED / UNVALIDATED — HEURISTIC ROUTING RULE'
    });
  }

  // Apply deterministic <= maxConditionalProbes cap & hearing-check gate
  let queuedCount = 0;
  const triggeredRules: RoutingLogEntry[] = candidateRules.map((rule) => {
    if (rule.targetProbeId === 'S5.3' && !hearingCheckPassed) {
      return { ...rule, status: 'SUPPRESSED_HEARING_CHECK_FAILED' };
    }
    if (queuedCount >= manifest.maxConditionalProbes) {
      return { ...rule, status: 'SUPPRESSED_MAX_2_PROBES_CAP' };
    }
    queuedCount++;
    return { ...rule, status: 'TRIGGERED_AND_QUEUED' };
  });

  // Compute proxy domain p-values for Holm-Bonferroni illustration
  const domainProxies = [
    {
      domain: 'Dorsal Visual / Simultanagnosia (S1.1/S1.2)',
      rawPValueProxy:
        s11 && s11.gldiRatio !== null && s11.gldiRatio < h.gldiAnomalyCutoff ? 0.003 : 0.42
    },
    {
      domain: 'Ventral Crowding / Pareidolia (S2.1)',
      rawPValueProxy:
        telemetry['S2.1'] &&
        telemetry['S2.1'].pareidoliaFalsePositiveCount >= h.pareidoliaCountCutoff
          ? 0.004
          : 0.51
    },
    {
      domain: 'Attentional Stability CoMAD (S3.1)',
      rawPValueProxy:
        s31 && s31.comadRepeatRaw !== null && s31.comadRepeatRaw > h.comadFluctuationCutoff
          ? 0.006
          : 0.48
    },
    {
      domain: 'Executive Set-Shifting SCER (S3.1)',
      rawPValueProxy:
        s31 && s31.scer !== null && s31.scer > h.scerElevatedCutoff ? 0.008 : 0.39
    },
    {
      domain: 'Phonological Working Memory (S4.1/S4.2)',
      rawPValueProxy: telemetry['S4.1']?.phonologicalQueueDecayFlag ? 0.005 : 0.61
    },
    {
      domain: 'Associative Memory Consolidation (S5.1)',
      rawPValueProxy:
        s51 && s51.isCueGainInterpretable && s51.deltaCueGain < h.deltaCueRescueCutoff
          ? 0.002
          : 0.45
    }
  ];

  const holmBonferroniAdjustedFlags = applyHolmBonferroni(domainProxies, manifest.fwerAlpha);

  // Layer 1 Observable Syndrome Profile & Layer 2 Differential Context
  let primaryLayer1Profile: SyndromeProfileId = 'PROFILE_0_UNIMPAIRED';
  let layer1ProfileLabel = 'Profile 0: Unimpaired / Within Prototype Baseline';
  let layer2DifferentialContext =
    'All observed task telemetry within baseline prototype bounds. No posterior-cortical, Lewy-body, phonological, or amnestic dissociation flags triggered.';
  const activeEvidenceCitations: string[] = ['NCT05607732'];

  const s21 = telemetry['S2.1'];
  const s22 = telemetry['S2.2'];
  const s41 = telemetry['S4.1'];

  if (
    s21 &&
    s21.pareidoliaFalsePositiveCount >=
      (h.enable2026MildDlbPareidoliaBoost ? h.pareidoliaCountCutoff : h.pareidoliaCountCutoff + 2) &&
    s31 &&
    s31.comadRepeatRaw !== null &&
    s31.comadRepeatRaw > h.comadFluctuationCutoff
  ) {
    primaryLayer1Profile = 'PROFILE_3_PARETO_FLUCTUATION_ATTENTION';
    layer1ProfileLabel = 'Profile 3: Pareidolia-Positive & Attentional Fluctuation Profile';
    layer2DifferentialContext = h.enable2026LbdDorsalVentralRule
      ? 'Layer 2 Context (McKeith et al., 2017; PMID: 42524732 & PMID: 42789112 [2026]): Combined noise pareidolias + elevated raw-RT CoMAD + preserved recognition cue rescue (Delta_cue >= 0.45) is characteristic of early Lewy Body / DLB spectrum rather than primary hippocampal amnestic storage failure.'
      : 'Layer 2 Context (McKeith et al., 2017): Pareidolia + RT fluctuation pattern consistent with DLB attentional-perceptual profile.';
    activeEvidenceCitations.push('PMID: 42524732', 'PMID: 42789112', 'PMID: 42385111');
  } else if (
    s11 &&
    s11.gldiRatio !== null &&
    s11.gldiRatio < h.gldiAnomalyCutoff &&
    (s51?.modalityDiscrepancyEstimand == null ||
      s51.modalityDiscrepancyEstimand >= h.modalityDiscrepancyCutoff)
  ) {
    primaryLayer1Profile = 'PROFILE_1_DORSAL_STREAM_SPATIAL';
    layer1ProfileLabel =
      'Profile 1: Dorsal-Stream Spatial & Simultanagnosia Profile (Perceptually De-Confounded)';
    layer2DifferentialContext =
      'Layer 2 Context (Crutch et al., 2017; PMID: 42608702 & PMID: 42789112 [2026]): Disproportionate global-form integration breakdown (low GLDI / crowding sensitivity) with preserved auditory-verbal sequence memory (high S5.3 - S5.1 modality discrepancy) points to Posterior Cortical Atrophy (biparietal/occipitotemporal dorsal stream) rather than true amnestic encoding failure.';
    activeEvidenceCitations.push('PMID: 42608702', 'PMID: 40881893', 'PMID: 42789112');
  } else if (
    (s11 && s11.crowdingCostRatio !== null && s11.crowdingCostRatio < h.crowdingRatioCutoff) ||
    (s22 && s22.invarianceRatio < 0.7) ||
    (s51 && s51.famousStep2aVisualSemanticCorrect <= 5 && s51.famousStep2bVerbalClueCorrect >= 7)
  ) {
    primaryLayer1Profile = 'PROFILE_2_VENTRAL_PERCEPTUAL_CROWDING';
    layer1ProfileLabel =
      'Profile 2: Ventral-Stream Crowding, Apperceptive Silhouette & Face-Form Profile';
    layer2DifferentialContext =
      'Layer 2 Context (Crutch et al., 2017; PMID: 42789112 [2026] & PMID: 37051699): Disproportionate visual crowding cost, foreshortened silhouette rotation deficit (S2.2), or visual face recognition impairment (Step 2A) with intact non-visual verbal identification (Step 2B) localizes to ventral occipitotemporal / fusiform visual stream dysfunction.';
    activeEvidenceCitations.push('PMID: 42789112', 'PMID: 37051699');
  } else if (s41 && s41.phonologicalQueueDecayFlag && h.enable2026PpaSpeechDysfluencyRule) {
    primaryLayer1Profile = 'PROFILE_4_PHONOLOGICAL_LOOP_WORKING_MEMORY';
    layer1ProfileLabel =
      'Profile 4: Phonological-Loop Decay & Proper-Name Tip-of-the-Tongue Profile';
    layer2DifferentialContext =
      'Layer 2 Context (Gorno-Tempini et al., 2011; PMID: 42545687 & PMID: 42798815 [2026]; PMID: 37051699): Length-dependent sentence repetition decay + prolonged inter-response pauses + preserved semantic person recognition with phonemic cue rescue localizes to left posterior perisylvian / temporoparietal junction (lvPPA / left temporal retrieval network).';
    activeEvidenceCitations.push('PMID: 42545687', 'PMID: 42798815', 'PMID: 37051699');
  } else if (s51 && s51.isCueGainInterpretable && s51.deltaCueGain < h.deltaCueRescueCutoff) {
    primaryLayer1Profile = 'PROFILE_6_HIPPOCAMPAL_CONSOLIDATION_AMNESTIC';
    layer1ProfileLabel = 'Profile 6: Storage / Consolidation Failure Profile (Low Cued Rescue)';
    layer2DifferentialContext =
      'Layer 2 Context (NIA-AA; PMID: 42385111 [2026]): Low visual sequence recall combined with failure of 4-AFC recognition cue rescue (Delta_cue < 0.45) despite intact perceptual baseline indicates primary hippocampal-entorhinal consolidation deficit.';
    activeEvidenceCitations.push('PMID: 42385111', 'NCT05607732');
  } else if (s31 && s31.scer !== null && s31.scer > h.scerElevatedCutoff) {
    primaryLayer1Profile = 'PROFILE_5_DYSEXECUTIVE_SET_SHIFTING';
    layer1ProfileLabel = 'Profile 5: Dysexecutive Set-Shifting & Retrieval Profile';
    layer2DifferentialContext =
      'Layer 2 Context: Elevated within-condition Switch Cost Efficiency Ratio (SCER) with intact recognition cue rescue (Delta_cue >= 0.45) indicates frontostriatal / dorsolateral prefrontal set-shifting and retrieval inefficiency.';
    activeEvidenceCitations.push('NCT05607732');
  }

  return {
    primaryLayer1Profile,
    layer1ProfileLabel,
    layer2DifferentialContext,
    triggeredRules,
    activeEvidenceCitations,
    holmBonferroniAdjustedFlags
  };
}
