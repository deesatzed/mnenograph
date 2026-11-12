import React from 'react';
import type {
  ResearchProtocolManifest,
  SessionRecord,
  StationId
} from '../types/sessionSchema';
import { evaluateTwoLayerSyndromeRouter } from '../psychometrics/psychometrics';
import { BarChart3, CheckCircle2, FileJson, Play, RotateCcw, ShieldAlert, Sparkles } from 'lucide-react';

export interface AssessmentResultsReportProps {
  session: SessionRecord;
  manifest: ResearchProtocolManifest;
  onStartNewTest: () => void;
  onReviewStation: (stationId: StationId) => void;
  onToggleResearcherHud: () => void;
  showResearcherHud: boolean;
}

export const AssessmentResultsReport: React.FC<AssessmentResultsReportProps> = ({
  session,
  manifest,
  onStartNewTest,
  onReviewStation,
  onToggleResearcherHud,
  showResearcherHud
}) => {
  const evaluation = evaluateTwoLayerSyndromeRouter(
    session.stationTelemetry,
    session.sensoryChecks.hearingCheckPassed,
    manifest
  );

  const s03 = session.stationTelemetry['S0.3'];
  const s11 = session.stationTelemetry['S1.1'];
  const s21 = session.stationTelemetry['S2.1'];
  const s31 = session.stationTelemetry['S3.1'];
  const s41 = session.stationTelemetry['S4.1'];
  const s51 = session.stationTelemetry['S5.1'];

  const completedCount = Object.keys(session.stationTelemetry).length;

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postcircecd-session-${session.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-testid="assessment-results-report"
      className="rounded-2xl border border-slate-700/80 bg-[#111622] p-6 text-slate-100 shadow-xl space-y-6"
    >
      {/* Top Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
            <span>Observatory Assessment Results Report</span>
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            Session ID: <code className="text-sky-300">{session.sessionId}</code> •{' '}
            {completedCount} Station Telemetry Blocks Recorded •{' '}
            {session.trialEventLog.length} Individual Timed Trials Logged
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            data-testid="results-new-test-btn"
            onClick={onStartNewTest}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm shadow-sm cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Start New Guided Assessment</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-semibold text-sm cursor-pointer"
          >
            <FileJson className="w-4 h-4 text-sky-300" />
            <span>Download Session JSON</span>
          </button>
        </div>
      </div>

      {/* Primary Two-Layer Syndrome Profile Synthesis */}
      <div className="rounded-xl bg-slate-900/90 border border-sky-500/40 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-sky-400" />
            <span>{evaluation.layer1ProfileLabel}</span>
          </h3>
          <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold text-amber-200">
            {session.isSimulatedPreset
              ? 'Simulated Case Trajectory (Heuristic Sandbox)'
              : 'Live Telemetry • Exploratory Priors (Use Repeat-Run Z_SRB as Primary Reference)'}
          </span>
        </div>

        <p className="text-sm text-slate-200 leading-relaxed max-w-4xl">
          {evaluation.layer2DifferentialContext}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-300">
          <span className="font-semibold text-slate-400">Primary Evidence Grounding:</span>
          {evaluation.activeEvidenceCitations.map((cit) => (
            <span
              key={cit}
              className="px-2.5 py-0.5 rounded-md bg-slate-950 border border-slate-800 font-mono text-sky-300"
            >
              {cit}
            </span>
          ))}
        </div>
      </div>

      {/* 6 Domain Result Cards in Plain Language */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Wing 0 */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sky-300">1. Motor &amp; Quadrant Symmetry (S0)</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {s03 ? 'Completed' : 'Not Run'}
              </span>
            </div>
            {s03 ? (
              <div className="mt-2 space-y-1 text-sm text-slate-200">
                <div>
                  Median Pointing Speed: <strong>{s03.rtMotorMedianMs} ms</strong>
                </div>
                <div>
                  Path Efficiency: <strong>{Math.round(s03.medianPathEfficiency * 100)}%</strong>
                </div>
                <div className="text-xs text-slate-400">
                  {s03.quadrantKruskalWallisH != null
                    ? `Quadrant Asymmetry Test: H = ${s03.quadrantKruskalWallisH} (p = ${s03.quadrantKruskalWallisP ?? 1})`
                    : 'Quadrant Asymmetry: Needs ≥3 deals/corner (≥12 hands) for Kruskal-Wallis p-value'}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Measures baseline pointing speed and visual field symmetry across all 4 quadrants.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onReviewStation('S0.3')}
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> {s03 ? 'Re-run Wing 0 Calibration' : 'Run Wing 0 Now'}
          </button>
        </div>

        {/* Wing I */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-purple-300">2. Dorsal Visual &amp; Crowding (S1)</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {s11 ? 'Completed' : 'Not Run'}
              </span>
            </div>
            {s11 ? (
              <div className="mt-2 space-y-1 text-sm text-slate-200">
                <div>
                  Global-vs-Local Ratio (GLDI):{' '}
                  <strong className={s11.gldiRatio && s11.gldiRatio < 0.55 ? 'text-amber-300' : 'text-emerald-300'}>
                    {s11.gldiRatio ?? 'N/A'}
                  </strong>
                </div>
                <div>
                  Crowding Resilience:{' '}
                  <strong>{s11.crowdingCostRatio ?? 'N/A'}</strong>
                </div>
                <div className="text-xs text-slate-400">
                  Global RCS: {s11.rcsGlobalPerSec}/s • Local RCS: {s11.rcsLocalPerSec}/s
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Tests whether compound shapes and crowded arrays disrupt global visual synthesis (PCA screen).
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onReviewStation('S1.1')}
            className="text-xs font-semibold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> {s11 ? 'Re-run Wing I Visual Loom' : 'Run Wing I Now'}
          </button>
        </div>

        {/* Wing II */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-amber-300">3. Pareidolia &amp; Viewpoint (S2)</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {s21 ? 'Completed' : 'Not Run'}
              </span>
            </div>
            {s21 ? (
              <div className="mt-2 space-y-1 text-sm text-slate-200">
                <div>
                  Noise Pareidolias:{' '}
                  <strong className={s21.pareidoliaFalsePositiveCount >= 2 ? 'text-amber-300' : 'text-emerald-300'}>
                    {s21.pareidoliaFalsePositiveCount} illusory responses
                  </strong>
                </div>
                <div>
                  True Embedded Hits:{' '}
                  <strong>
                    {s21.trueObjectHitCount} / {s21.totalNoisePlates ?? 8}
                  </strong>
                </div>
                <div className="text-xs text-slate-400">
                  Mamiya et al. (2016) &amp; PMID: 42524732 (2026) protocol
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Checks for illusory face/object perception in nebula noise plates and foreshortened silhouettes.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onReviewStation('S2.1')}
            className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> {s21 ? 'Re-run Wing II Pareidolia' : 'Run Wing II Now'}
          </button>
        </div>

        {/* Wing III */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-emerald-300">4. Executive Switchboard (S3)</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {s31 ? 'Completed' : 'Not Run'}
              </span>
            </div>
            {s31 ? (
              <div className="mt-2 space-y-1 text-sm text-slate-200">
                <div>
                  Rate-Correct Score (RCS): <strong>{s31.rcsPooledPerSec} correct/s</strong>
                </div>
                <div>
                  Switch Cost (SCER):{' '}
                  <strong>{s31.scer != null ? `${Math.round(s31.scer * 100)}%` : s31.scerStatus}</strong>
                </div>
                <div className="text-xs text-slate-400">
                  Attentional Fluctuation (CoMAD): {s31.comadRepeatRaw ?? 'N/A'}
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Measures cognitive flexibility (rule switching) and trial-to-trial attentional stability.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onReviewStation('S3.1')}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> {s31 ? 'Re-run Wing III Switchboard' : 'Run Wing III Now'}
          </button>
        </div>

        {/* Wing IV */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-rose-300">5. Fluency &amp; Echo Relay (S4)</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {s41 ? 'Completed' : 'Not Run'}
              </span>
            </div>
            {s41 ? (
              <div className="mt-2 space-y-1 text-sm text-slate-200">
                <div>
                  Letter-F Word Count: <strong>{s41.letterFValidCount} words</strong>
                </div>
                <div>
                  Median Inter-Word Pause: <strong>{s41.letterFMedianIriMs} ms</strong>
                </div>
                <div className="text-xs text-slate-400">
                  Sentence Echo Accuracy: {Math.round(s41.sentenceRepetitionAccuracy * 100)}%
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Evaluates phonological working-memory span and word-retrieval latency (lvPPA screen).
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onReviewStation('S4.1')}
            className="text-xs font-semibold text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> {s41 ? 'Re-run Wing IV Echo Spire' : 'Run Wing IV Now'}
          </button>
        </div>

        {/* Wing V */}
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-indigo-300">6. Memory &amp; Famous Faces (S5)</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                {s51 ? 'Completed' : 'Not Run'}
              </span>
            </div>
            {s51 ? (
              <div className="mt-2 space-y-1 text-sm text-slate-200">
                <div>
                  Visual Sequence: <strong>{s51.sComposite23} / 23</strong> • Auditory:{' '}
                  <strong>{s51.auditorySequenceScore23 ?? 'N/A'} / 23</strong>
                </div>
                <div>
                  Modality Discrepancy (Aud - Vis):{' '}
                  <strong className="text-sky-300">
                    {s51.modalityDiscrepancyEstimand != null
                      ? `${s51.modalityDiscrepancyEstimand >= 0 ? '+' : ''}${s51.modalityDiscrepancyEstimand}`
                      : 'N/A'}
                  </strong>
                </div>
                <div className="text-xs text-slate-400">
                  Cued Rescue (Δ_cue): {s51.deltaCueGain} • Famous Free/Cued: {s51.famousStep1FreeNamingCorrect}/8 &rarr; {s51.famousStep3PhonemicCuedCorrect}/8
                </div>
              </div>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                Separates visual perceptual bottlenecks from true memory consolidation failure and proper-name retrieval.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onReviewStation('S5.1')}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" /> {s51 ? 'Re-run Wing V Archive Vault' : 'Run Wing V Now'}
          </button>
        </div>
      </div>

      {/* Footer Toggle for Advanced Researcher HUD */}
      <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldAlert className="w-4 h-4 text-sky-400" />
          <span>
            Want to inspect the raw trial timestamps, longitudinal z_SRB regression table, or toggle 2026 Europe PMC rules?
          </span>
        </div>
        <button
          type="button"
          onClick={onToggleResearcherHud}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-sky-300 cursor-pointer"
        >
          <BarChart3 className="w-4 h-4" />
          <span>
            {showResearcherHud
              ? 'Hide Advanced Researcher / Judge Telemetry HUD'
              : 'Open Advanced Researcher / Judge Telemetry HUD'}
          </span>
        </button>
      </div>
    </div>
  );
};
