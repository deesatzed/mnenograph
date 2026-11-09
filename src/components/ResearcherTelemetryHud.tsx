import React, { useMemo, useState } from 'react';
import type {
  ResearchProtocolManifest,
  SessionRecord
} from '../types/sessionSchema';
import {
  computeSRBChangeScore,
  evaluateTwoLayerSyndromeRouter
} from '../psychometrics/psychometrics';
import {
  computeManifestSha256
} from '../registry/protocolRegistry';
import { computeEventLogSha256 } from '../eventLog/trialEventLog';
import type { PersonaPresetMeta } from '../presets/syntheticPersonas';

export interface ResearcherTelemetryHudProps {
  session: SessionRecord;
  lockedManifest: ResearchProtocolManifest;
  sandboxManifest: ResearchProtocolManifest;
  activePersonaMeta: PersonaPresetMeta;
  onUpdateSandboxManifest: (next: ResearchProtocolManifest) => void;
  onResetSandboxManifest: () => void;
}

const SRB_RELIABILITY_LEVELS = [
  { rxx: 0.49, source: 'Arranging Pictures (MyCog §3.3)' },
  { rxx: 0.61, source: 'MyCog Mobile Lower Bound (§4.3)' },
  { rxx: 0.71, source: 'MyCog Mobile Upper Bound (§4.3)' },
  { rxx: 0.78, source: 'NIH Toolbox PSM (§3.1)' },
  { rxx: 0.85, source: 'PostCircECD Target Composite' },
  { rxx: 0.92, source: 'NIH Toolbox DCCS / MyCog 2.0 Split-Half (§4.3)' }
];

export const ResearcherTelemetryHud: React.FC<ResearcherTelemetryHudProps> = ({
  session,
  lockedManifest,
  sandboxManifest,
  activePersonaMeta,
  onUpdateSandboxManifest,
  onResetSandboxManifest
}) => {
  const [activeTab, setActiveTab] = useState<'TELEMETRY' | 'SRB_LONGITUDINAL' | 'LIVING_EVIDENCE' | 'EVENT_LOG'>('TELEMETRY');
  const [srbZ1, setSrbZ1] = useState<number>(2.0);
  const [srbZ2, setSrbZ2] = useState<number>(0.4);
  const [srbPracticeOffset, setSrbPracticeOffset] = useState<number>(0.0);

  const lockedSha256 = useMemo(() => computeManifestSha256(lockedManifest), [lockedManifest]);
  const sandboxSha256 = useMemo(() => computeManifestSha256(sandboxManifest), [sandboxManifest]);
  const eventLogSha256 = useMemo(() => computeEventLogSha256(session.trialEventLog), [session.trialEventLog]);

  // Pure dual-manifest evaluation (Inventive Catalyst Finding 4)
  const lockedEvaluation = useMemo(
    () =>
      evaluateTwoLayerSyndromeRouter(
        session.stationTelemetry,
        session.sensoryChecks.hearingCheckPassed,
        lockedManifest
      ),
    [session.stationTelemetry, session.sensoryChecks.hearingCheckPassed, lockedManifest]
  );

  const sandboxEvaluation = useMemo(
    () =>
      evaluateTwoLayerSyndromeRouter(
        session.stationTelemetry,
        session.sensoryChecks.hearingCheckPassed,
        sandboxManifest
      ),
    [session.stationTelemetry, session.sensoryChecks.hearingCheckPassed, sandboxManifest]
  );

  const s03 = session.stationTelemetry['S0.3'];
  const s11 = session.stationTelemetry['S1.1'];
  const s21 = session.stationTelemetry['S2.1'];
  const s31 = session.stationTelemetry['S3.1'];
  const s41 = session.stationTelemetry['S4.1'];
  const s51 = session.stationTelemetry['S5.1'];

  const isManifestModified = lockedSha256 !== sandboxSha256;

  return (
    <div
      data-testid="researcher-telemetry-hud"
      className="rounded-xl border border-slate-700/90 bg-slate-950/95 p-5 text-slate-100 shadow-xl space-y-4"
    >
      {/* Mandatory SIMULATED watermark in HUD when synthetic preset is active (F3) */}
      {session.isSimulatedPreset && (
        <div
          data-testid="hud-simulated-watermark"
          className="rounded-lg bg-amber-500/20 border border-amber-400/60 px-4 py-2 text-center text-xs font-bold tracking-wider text-amber-200 uppercase"
        >
          {session.simulatedWatermark} — HEURISTIC WEIGHTS (UNVALIDATED)
        </div>
      )}

      {/* HUD Header & Normative Status Badge (F2) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-400">
              Researcher / Judge Telemetry & Psychometric HUD
            </span>
            <span
              data-testid="normative-status-badge"
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                session.isSimulatedPreset
                  ? 'bg-amber-950/70 border-amber-400/60 text-amber-200'
                  : 'bg-emerald-950/70 border-emerald-400/60 text-emerald-200'
              }`}
            >
              {session.isSimulatedPreset
                ? 'Normative Status: SIMULATED / SYNTHETIC DEMO — HEURISTIC WEIGHTS (UNVALIDATED)'
                : 'Normative Status: Raw Telemetry Only — No Normative Database Loaded (Prototype)'}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Locked Session Manifest SHA-256: <code className="text-sky-300">{lockedSha256.slice(0, 16)}...</code> • Event Log SHA-256: <code className="text-emerald-300">{eventLogSha256.slice(0, 16)}...</code> • Mode: <code className="text-purple-300">{session.presentationMode}</code>
          </p>
        </div>

        {/* HUD Tab Switcher */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('TELEMETRY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              activeTab === 'TELEMETRY'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
            }`}
          >
            1. Raw Telemetry & 2-Layer Router
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SRB_LONGITUDINAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              activeTab === 'SRB_LONGITUDINAL'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
            }`}
          >
            2. Multi-Visit z_SRB & Burst Explorer (`F4`)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('LIVING_EVIDENCE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              activeTab === 'LIVING_EVIDENCE'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
            }`}
          >
            3. Living Evidence & Protocol Registry (`§7`)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EVENT_LOG')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
              activeTab === 'EVENT_LOG'
                ? 'bg-sky-600 text-white'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
            }`}
          >
            4. Immutable Event Log & JSON Export
          </button>
        </div>
      </div>

      {/* TAB 1: RAW TELEMETRY & TWO-LAYER SYNDROME ROUTER */}
      {activeTab === 'TELEMETRY' && (
        <div className="space-y-4">
          {/* Gate G0 Hardware Calibration Summary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400">Gate G0 Frame Interval</div>
              <div className="text-base font-bold text-white mt-0.5">
                {session.gateG0TimingCalibration.frameIntervalMedianMs} ms (IQR {session.gateG0TimingCalibration.frameIntervalIqrMs} ms)
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400">Gate G0 Min Detectable RT</div>
              <div className="text-base font-bold text-emerald-300 mt-0.5">
                MDE = {session.gateG0TimingCalibration.minimumDetectableEffectMs} ms
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400">S0.3 Motor Baseline & KW Test</div>
              <div className="text-base font-bold text-sky-300 mt-0.5">
                {s03 ? `${s03.rtMotorMedianMs} ms | H=${s03.quadrantKruskalWallisH ?? 'N/A'} (p=${s03.quadrantKruskalWallisP ?? 'N/A'})` : 'Not Run Yet'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400">S3.1 Pooled MyCog RCS</div>
              <div className="text-base font-bold text-emerald-300 mt-0.5">
                {s31 ? `${s31.rcsPooledPerSec} correct/s (n=${s31.validPooledCount})` : 'Not Run Yet'}
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
              <div className="text-slate-400">S3.1 Within-Cond SCER & CoMAD</div>
              <div className="text-base font-bold text-amber-300 mt-0.5">
                {s31
                  ? `SCER=${s31.scer ?? s31.scerStatus} | CoMAD=${s31.comadRepeatRaw ?? 'N/A'}`
                  : 'Not Run Yet'}
              </div>
              {s31?.scerBootstrap95Ci && (
                <div className="text-[11px] text-slate-400">
                  95% Bootstrap CI: [{s31.scerBootstrap95Ci[0]}, {s31.scerBootstrap95Ci[1]}]
                </div>
              )}
            </div>
          </div>

          {/* Primary Modality Discrepancy Estimand & Key Domain Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="font-bold text-purple-300 uppercase">
                S1.1 Navon GLDI & S2.1 Pareidolia Count
              </div>
              <div className="mt-1.5 space-y-1 text-slate-200">
                <div>
                  Global/Local Ratio (GLDI):{' '}
                  <strong>{s11?.gldiRatio ?? 'Not Recorded'}</strong> | Crowding Ratio:{' '}
                  <strong>{s11?.crowdingCostRatio ?? 'Not Recorded'}</strong>
                </div>
                <div>
                  Mamiya Pareidolia False-Positives (`S2.1`):{' '}
                  <strong>{s21 ? `${s21.pareidoliaFalsePositiveCount} / 12 noise plates` : 'Not Recorded'}</strong>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="font-bold text-indigo-300 uppercase">
                S5.1 Sequence, Chance-Corrected Δ_cue & Primary Estimand
              </div>
              <div className="mt-1.5 space-y-1 text-slate-200">
                <div>
                  Visual Sequence (S_comp):{' '}
                  <strong>{s51 ? `${s51.sComposite23} / 23` : 'Not Recorded'}</strong> | Auditory (`S5.3`):{' '}
                  <strong>{s51?.auditorySequenceScore23 != null ? `${s51.auditorySequenceScore23} / 23` : 'N/A'}</strong>
                </div>
                <div>
                  Primary Modality Discrepancy (S_aud - S_vis):{' '}
                  <strong className="text-sky-300">
                    {s51?.modalityDiscrepancyEstimand != null ? `${s51.modalityDiscrepancyEstimand >= 0 ? '+' : ''}${s51.modalityDiscrepancyEstimand}` : 'N/A'}
                  </strong>
                </div>
                <div>
                  Chance-Corrected Gain (Δ_cue):{' '}
                  <strong className="text-emerald-300">
                    {s51 ? `${s51.deltaCueGain} (Interpretable: ${s51.isCueGainInterpretable ? 'Yes' : 'Ceiling'})` : 'N/A'}
                  </strong>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <div className="font-bold text-rose-300 uppercase">
                S4 Fluency/Echo & S5.2 3-Step Famous Archival Photos
              </div>
              <div className="mt-1.5 space-y-1 text-slate-200">
                <div>
                  Letter-F Count: <strong>{s41?.letterFValidCount ?? 'N/A'}</strong> | Median IRI:{' '}
                  <strong>{s41 ? `${s41.letterFMedianIriMs} ms` : 'N/A'}</strong>
                </div>
                <div>
                  Famous Archival Cascade (`S5.2` `F12`):{' '}
                  <strong>
                    {s51
                      ? `Step1 Free ${s51.famousStep1FreeNamingCorrect}/8 -> Step2A VisSem ${s51.famousStep2aVisualSemanticCorrect}/8 | Step2B Verbal ${s51.famousStep2bVerbalClueCorrect}/8 -> Step3 Cued ${s51.famousStep3PhonemicCuedCorrect}/8`
                      : 'Not Recorded'}
                  </strong>
                </div>
              </div>
            </div>
          </div>

          {/* Two-Layer Syndrome Profile & Heuristic Routing Log (F11) */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-sky-300 uppercase tracking-wider">
                Two-Layer Convergent Router & Holm-Bonferroni FWER Output (`F11`)
              </h3>
              <span className="text-xs px-2.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-amber-200 font-semibold">
                [PROPOSED / UNVALIDATED — DESIGN TARGET]
              </span>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
              <div className="text-sm font-bold text-white">
                Layer 1 (Observable Syndrome Profile):{' '}
                <span className="text-sky-300">{sandboxEvaluation.layer1ProfileLabel}</span>
              </div>
              <p className="text-xs text-slate-300">{sandboxEvaluation.layer2DifferentialContext}</p>
              <div className="text-xs text-emerald-300 pt-1">
                Active Literature Citations Backing Profile:{' '}
                <code>{sandboxEvaluation.activeEvidenceCitations.join(', ')}</code>
              </div>
            </div>

            {/* Routing Log Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-1.5 pr-3">Rule ID</th>
                    <th className="py-1.5 pr-3">Trigger -&gt; Probe</th>
                    <th className="py-1.5 pr-3">Observed Telemetry</th>
                    <th className="py-1.5 pr-3">Validation Tag (`F2`)</th>
                    <th className="py-1.5">Router Cap Status (&le; 2 Max)</th>
                  </tr>
                </thead>
                <tbody>
                  {sandboxEvaluation.triggeredRules.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 text-slate-500">
                        No conditional convergent probes triggered yet. Run a station or select a synthetic persona preset above.
                      </td>
                    </tr>
                  ) : (
                    sandboxEvaluation.triggeredRules.map((r) => (
                      <tr key={r.ruleId} className="border-b border-slate-900">
                        <td className="py-1.5 pr-3 font-mono text-sky-300">{r.ruleId}</td>
                        <td className="py-1.5 pr-3 font-semibold">
                          {r.triggerStationId} &rarr; {r.targetProbeId}
                        </td>
                        <td className="py-1.5 pr-3 text-slate-300">{r.observedMetricSummary}</td>
                        <td className="py-1.5 pr-3 text-amber-300 font-semibold">{r.thresholdTag}</td>
                        <td className="py-1.5 font-semibold text-emerald-300">{r.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-VISIT z_SRB LONGITUDINAL & MESO-SCALE BURST INSPECTOR (F4, F13) */}
      {activeTab === 'SRB_LONGITUDINAL' && (
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
            <h3 className="text-sm font-bold text-sky-300 uppercase tracking-wider">
              Standardized Regression-Based Change (z_SRB) vs. Simple-Difference RCI Explorer (Hammers et al., 2020; `F4`)
            </h3>
            <p className="text-xs text-slate-300">
              Models regression to the mean (E[Z2] = μ_practice + r_xx * Z1, SE_est = sqrt(1 - r_xx^2)). Demonstrates mathematically why detecting a drop from Z1 = +2.00 to Z2 = +0.40 at the 95% level (z_SRB &le; -1.96) requires test-retest reliability r_xx &ge; 0.797.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <label className="block text-slate-400">Baseline Standardized Score (Z1):</label>
                <input
                  type="number"
                  step={0.1}
                  value={srbZ1}
                  onChange={(e) => setSrbZ1(Number(e.target.value))}
                  className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold"
                />
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <label className="block text-slate-400">Follow-Up Standardized Score (Z2):</label>
                <input
                  type="number"
                  step={0.1}
                  value={srbZ2}
                  onChange={(e) => setSrbZ2(Number(e.target.value))}
                  className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold"
                />
              </div>
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <label className="block text-slate-400">Practice Offset (μ_practice):</label>
                <input
                  type="number"
                  step={0.05}
                  value={srbPracticeOffset}
                  onChange={(e) => setSrbPracticeOffset(Number(e.target.value))}
                  className="mt-1 w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-bold"
                />
              </div>
            </div>

            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-1.5 pr-3">Reliability r_xx</th>
                    <th className="py-1.5 pr-3">Benchmark Source (`MyCogTechSpec.md`)</th>
                    <th className="py-1.5 pr-3">Expected E[Z2] = r_xx * Z1 (RTM)</th>
                    <th className="py-1.5 pr-3">SE_est = sqrt(1 - r_xx^2)</th>
                    <th className="py-1.5 pr-3">Repaired z_SRB</th>
                    <th className="py-1.5 pr-3">Required Z2 for &le; -1.96</th>
                    <th className="py-1.5">Flagged (p &lt; 0.05)?</th>
                  </tr>
                </thead>
                <tbody>
                  {SRB_RELIABILITY_LEVELS.map((row) => {
                    const calc = computeSRBChangeScore(srbZ1, srbZ2, row.rxx, srbPracticeOffset);
                    return (
                      <tr key={row.rxx} className="border-b border-slate-900">
                        <td className="py-1.5 pr-3 font-mono font-bold text-sky-300">
                          {row.rxx.toFixed(2)}
                        </td>
                        <td className="py-1.5 pr-3 text-slate-300">{row.source}</td>
                        <td className="py-1.5 pr-3 font-mono">
                          {calc.expectedZ2RtmAdjusted >= 0 ? `+${calc.expectedZ2RtmAdjusted.toFixed(3)}` : calc.expectedZ2RtmAdjusted.toFixed(3)}
                        </td>
                        <td className="py-1.5 pr-3 font-mono">{calc.seEstSrb.toFixed(4)}</td>
                        <td className="py-1.5 pr-3 font-mono font-bold text-amber-300">
                          {calc.zSrb.toFixed(3)}
                        </td>
                        <td className="py-1.5 pr-3 font-mono">
                          &le; {calc.requiredZ2For95Threshold.toFixed(3)}
                        </td>
                        <td className="py-1.5 font-bold">
                          {calc.flaggedSignificantDecline95 ? (
                            <span className="text-rose-400">YES (Significant Decline)</span>
                          ) : (
                            <span className="text-slate-400">No (Within RTM / Noise)</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Multi-Visit K >= 3 Trajectory & Meso-Scale 5-Day Burst Learning Slope (F13) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="font-bold text-sky-300 uppercase">
                Macro-Scale Trajectory ($K = {activePersonaMeta.visitTrajectoryZ.length}$ Visits • IRT-Equated Alternate Forms A/B/C)
              </div>
              <div className="space-y-1.5">
                {activePersonaMeta.visitTrajectoryZ.map((v) => (
                  <div
                    key={v.visit}
                    className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800"
                  >
                    <span>
                      Visit {v.visit} (Month {v.month}) • <strong>{v.formId}</strong>
                    </span>
                    <span className="font-mono font-bold text-emerald-300">
                      Z = {v.zComposite >= 0 ? `+${v.zComposite.toFixed(2)}` : v.zComposite.toFixed(2)} SD
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
              <div className="font-bold text-purple-300 uppercase">
                Meso-Scale 5-Day Burst Multi-Day Learning Curve (`F13`)
              </div>
              <p className="text-slate-300">
                Uses fixed-form stimuli across 5 consecutive days to measure presence vs. absence of the multi-day practice/consolidation curve (distinct from Macro-Scale IRT-equated alternate forms):
              </p>
              <div className="flex items-center gap-2 pt-1">
                {activePersonaMeta.mesoBurst5DaySlope.map((val, idx) => (
                  <div
                    key={idx}
                    className="flex-1 p-2 rounded bg-slate-950 border border-slate-800 text-center"
                  >
                    <div className="text-[10px] text-slate-400">Day {idx + 1}</div>
                    <div className="font-mono font-bold text-white mt-0.5">{val.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LIVING EVIDENCE & DYNAMIC PROTOCOL MANAGER (§7, Inventive Catalyst Finding 4) */}
      {activeTab === 'LIVING_EVIDENCE' && (
        <div className="space-y-4">
          {/* Dual-Manifest SHA-256 Differential Comparison Banner (Inventive Catalyst Finding 4) */}
          <div
            data-testid="dual-manifest-diff-banner"
            className="rounded-xl bg-slate-900 border border-sky-500/40 p-4 space-y-2 text-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold text-sky-300 uppercase tracking-wider">
                Content-Hash–Locked Protocol Registry vs. Live Research Sandbox (`§7.1`)
              </span>
              {isManifestModified && (
                <button
                  type="button"
                  onClick={onResetSandboxManifest}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold cursor-pointer"
                >
                  Reset Sandbox to Locked Session Manifest
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                <div className="text-slate-400">
                  Locked Session Manifest (`sha256:{lockedSha256.slice(0, 12)}...`)
                </div>
                <div className="font-bold text-white mt-0.5">
                  {lockedEvaluation.layer1ProfileLabel}
                </div>
              </div>
              <div className="p-2.5 rounded bg-slate-950 border border-sky-500/40">
                <div className="text-sky-300">
                  Candidate Sandbox Manifest (`sha256:{sandboxSha256.slice(0, 12)}...`){' '}
                  {isManifestModified ? '• MODIFIED' : '• IDENTICAL'}
                </div>
                <div className="font-bold text-emerald-300 mt-0.5">
                  {sandboxEvaluation.layer1ProfileLabel}
                </div>
              </div>
            </div>
          </div>

          {/* Toggleable 2026 Literature Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                data-testid="toggle-2026-lbd-rule"
                checked={sandboxManifest.heuristics.enable2026LbdDorsalVentralRule}
                onChange={(e) => {
                  const next = structuredClone(sandboxManifest);
                  next.heuristics.enable2026LbdDorsalVentralRule = e.target.checked;
                  onUpdateSandboxManifest(next);
                }}
                className="mt-0.5 w-4 h-4 accent-sky-400"
              />
              <span>
                <strong>2026 LBD Dorsal+Ventral Stream Rule (`PMID: 42789112`):</strong> Couple ventral + dorsal visuoperceptual deficits with Visual-vs-Auditory memory de-confounding.
              </span>
            </label>

            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                data-testid="toggle-2026-pareidolia-rule"
                checked={sandboxManifest.heuristics.enable2026MildDlbPareidoliaBoost}
                onChange={(e) => {
                  const next = structuredClone(sandboxManifest);
                  next.heuristics.enable2026MildDlbPareidoliaBoost = e.target.checked;
                  onUpdateSandboxManifest(next);
                }}
                className="mt-0.5 w-4 h-4 accent-amber-400"
              />
              <span>
                <strong>2026 Early DLB Minor Hallucination & Pareidolia Rule (`PMID: 42524732`):</strong> Weight noise pareidolias (&ge; 2) + intact memory cue rescue for mild-stage DLB vs. AD differentiation.
              </span>
            </label>
          </div>

          {/* Primary Literature & ClinicalTrials.gov Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {sandboxManifest.evidenceItems.map((ev) => (
              <div
                key={ev.id}
                className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold text-sky-300">
                    {ev.pmid ? `PMID: ${ev.pmid} (${ev.pmcid})` : `ClinicalTrials.gov: ${ev.nctId}`}
                  </span>
                  <span className="text-slate-400">{ev.journalOrRegistry}</span>
                </div>
                <div className="font-bold text-white">{ev.title}</div>
                <div className="text-slate-400">Sample: {ev.sampleDescription}</div>
                <p className="text-slate-300">{ev.keyFindingSummary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: IMMUTABLE TRIAL EVENT LOG & WATERMARKED JSON EXPORTER */}
      {activeTab === 'EVENT_LOG' && (
        <div className="space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-bold text-emerald-300 uppercase">
                Append-Only TrialEventLog ({session.trialEventLog.length} recorded trials) • SHA-256: {eventLogSha256.slice(0, 20)}...
              </span>
            </div>
          </div>
          <pre
            data-testid="exported-session-json"
            className="max-h-80 overflow-auto rounded-xl bg-slate-900 border border-slate-800 p-4 font-mono text-[11px] text-slate-200"
          >
            {JSON.stringify(session, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
