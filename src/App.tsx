import React, { useMemo, useState } from 'react';
import type {
  PracticeGateResult,
  ResearchProtocolManifest,
  SensoryChecks,
  SessionRecord,
  SingleTrialMode,
  StationId,
  StationTelemetryMap,
  TrialEvent
} from './types/sessionSchema';
import {
  computeManifestSha256,
  getCanonicalProtocolManifest
} from './registry/protocolRegistry';
import {
  appendTrialEvent,
  resolveSessionPresentationMode
} from './eventLog/trialEventLog';
import {
  buildPresetSessionRecord,
  PERSONA_PRESETS,
  type PersonaPresetId
} from './presets/syntheticPersonas';
import { CelestialObservatory3D } from './components/CelestialObservatory3D';
import { StationTasksInteractive } from './components/StationTasksInteractive';
import { ResearcherTelemetryHud } from './components/ResearcherTelemetryHud';
import { evaluateTwoLayerSyndromeRouter } from './psychometrics/psychometrics';

export const App: React.FC = () => {
  const [lockedManifest] = useState<ResearchProtocolManifest>(() =>
    getCanonicalProtocolManifest()
  );
  const [sandboxManifest, setSandboxManifest] = useState<ResearchProtocolManifest>(() =>
    getCanonicalProtocolManifest()
  );

  const [selectedPreset, setSelectedPreset] = useState<PersonaPresetId>('LIVE_PARTICIPANT');
  const [singleTrialMode, setSingleTrialMode] = useState<SingleTrialMode>(
    'OBSERVATORY_3D_SPOTLIGHT_LOCK'
  );
  const [spotlightLocked, setSpotlightLocked] = useState<boolean>(false);
  const [activeStation, setActiveStation] = useState<StationId>('S3.1');
  const [showResearcherHud, setShowResearcherHud] = useState<boolean>(true);

  const [session, setSession] = useState<SessionRecord>(() =>
    buildPresetSessionRecord('LIVE_PARTICIPANT', lockedManifest)
  );

  const activePersonaMeta = useMemo(
    () => PERSONA_PRESETS.find((p) => p.id === selectedPreset) ?? PERSONA_PRESETS[0],
    [selectedPreset]
  );

  const handleSelectPersona = (presetId: PersonaPresetId) => {
    setSelectedPreset(presetId);
    const nextRecord = buildPresetSessionRecord(presetId, lockedManifest);
    nextRecord.presentationMode = resolveSessionPresentationMode(
      nextRecord.trialEventLog,
      singleTrialMode
    );
    nextRecord.motionOff = singleTrialMode === 'PLAIN_STATIC_2D' || spotlightLocked;
    setSession(nextRecord);
  };

  const handleTogglePresentationMode = () => {
    const nextMode: SingleTrialMode =
      singleTrialMode === 'OBSERVATORY_3D_SPOTLIGHT_LOCK'
        ? 'PLAIN_STATIC_2D'
        : 'OBSERVATORY_3D_SPOTLIGHT_LOCK';
    setSingleTrialMode(nextMode);
    setSession((prev) => ({
      ...prev,
      presentationMode: resolveSessionPresentationMode(prev.trialEventLog, nextMode),
      motionOff: nextMode === 'PLAIN_STATIC_2D' || spotlightLocked
    }));
  };

  const handleUpdateSensoryChecks = (checks: SensoryChecks) => {
    setSession((prev) => {
      const twoLayer = evaluateTwoLayerSyndromeRouter(
        prev.stationTelemetry,
        checks.hearingCheckPassed,
        sandboxManifest
      );
      return {
        ...prev,
        sensoryChecks: checks,
        routingLog: twoLayer.triggeredRules,
        twoLayerClassification: twoLayer
      };
    });
  };

  const handleUpdatePracticeGate = (res: PracticeGateResult) => {
    setSession((prev) => ({
      ...prev,
      practiceGates: {
        ...prev.practiceGates,
        [res.stationId]: res
      }
    }));
  };

  const handleAppendTrialEvent = (
    ev: Omit<TrialEvent, 'eventId' | 'trialIndex' | 'technicalFrameDrop'>
  ) => {
    setSession((prev) => {
      const nextLog = [...appendTrialEvent(prev.trialEventLog, ev)];
      return {
        ...prev,
        trialEventLog: nextLog,
        presentationMode: resolveSessionPresentationMode(nextLog, singleTrialMode)
      };
    });
  };

  const handleUpdateStationTelemetry = (next: Partial<StationTelemetryMap>) => {
    setSession((prev) => {
      const merged: StationTelemetryMap = {
        ...prev.stationTelemetry,
        ...next
      };
      const twoLayer = evaluateTwoLayerSyndromeRouter(
        merged,
        prev.sensoryChecks.hearingCheckPassed,
        sandboxManifest
      );
      return {
        ...prev,
        stationTelemetry: merged,
        routingLog: twoLayer.triggeredRules,
        twoLayerClassification: twoLayer
      };
    });
  };

  return (
    <div className="min-h-screen bg-[#070A12] text-slate-100 flex flex-col">
      {/* Mandatory Non-Removable Intended-Use & Privacy Banner (F3) */}
      <div
        data-testid="intended-use-banner"
        className="bg-slate-900 border-b border-slate-800 px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-500/50 text-sky-300 font-bold uppercase">
            RESEARCH & EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE
          </span>
          <span className="text-slate-300">
            100% Local Deterministic Browser Execution by Default (Zero External PHI/Audio/Drawing Transmission • FDA Jan 2026 CDS & Gemini Mar 2026 Terms Compliant)
          </span>
        </div>
        <span className="text-slate-400 font-mono">
          Manifest SHA-256: {computeManifestSha256(lockedManifest).slice(0, 12)}
        </span>
      </div>

      {/* Persistent Global SIMULATED Watermark Header when a Synthetic Persona is loaded (F3) */}
      {session.isSimulatedPreset && (
        <div
          data-testid="global-simulated-watermark"
          className="bg-amber-500/20 border-b border-amber-400/60 px-4 py-2 text-center text-xs font-extrabold tracking-widest text-amber-200 uppercase"
        >
          {session.simulatedWatermark} — FOR GOOGLE SCIENCE & RESEARCH DEMONSTRATION ONLY
        </div>
      )}

      {/* Main Header & Controls */}
      <header className="max-w-7xl w-full mx-auto px-4 pt-4 pb-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            PostCircECD: <span className="text-sky-400">The Celestial Observatory</span>
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            Dual-Mode 3D Spatial (`xrblocks@0.24.0` + Three.js) & Deterministic Psychometric Platform for Early/Atypical Cognitive Decline (PCA, DLB, lvPPA, High-Reserve MCI)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Persona Preset Selector */}
          <select
            aria-label="Select Live Mode or Synthetic Persona Preset"
            data-testid="persona-preset-select"
            value={selectedPreset}
            onChange={(e) => handleSelectPersona(e.target.value as PersonaPresetId)}
            className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-semibold text-white cursor-pointer"
          >
            {PERSONA_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>

          {/* 1-Click Plain Static Mode vs 3D Observatory [Spotlight Lock] Comparator Toggle (F7) */}
          <button
            type="button"
            data-testid="toggle-presentation-mode-btn"
            onClick={handleTogglePresentationMode}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
              singleTrialMode === 'PLAIN_STATIC_2D'
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                : 'bg-sky-950/90 border-sky-400 text-sky-200'
            }`}
          >
            {singleTrialMode === 'PLAIN_STATIC_2D'
              ? 'Mode: Plain Static Mode [Zero Motion] (Switch to 3D)'
              : 'Mode: 3D Observatory [Spotlight Lock] (Switch to Plain Static)'}
          </button>

          {/* Toggle Researcher HUD visibility (Participant Zero-Score-Anxiety Protection) */}
          <button
            type="button"
            data-testid="toggle-researcher-hud-btn"
            onClick={() => setShowResearcherHud((v) => !v)}
            className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 cursor-pointer"
          >
            {showResearcherHud ? 'Hide Researcher HUD (Participant-Only View)' : 'Show Researcher / Judge HUD'}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl w-full mx-auto px-4 py-3 space-y-4 flex-1">
        {/* Clinical Vignette / Persona Summary Banner */}
        <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-4 py-2.5 text-xs text-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <strong className="text-sky-300">{activePersonaMeta.label}:</strong>{' '}
            {activePersonaMeta.clinicalVignette}
          </div>
        </div>

        {/* 1. 3D Celestial Observatory / Plain Static Viewport */}
        <CelestialObservatory3D
          activeStation={activeStation}
          presentationMode={singleTrialMode}
          spotlightLocked={spotlightLocked}
          isSimulatedPreset={session.isSimulatedPreset}
          onSelectStation={(st) => setActiveStation(st)}
        />

        {/* 2. Interactive Participant Station Surface (Zero Score-Anxiety View) */}
        <StationTasksInteractive
          activeStation={activeStation}
          presentationMode={singleTrialMode}
          sensoryChecks={session.sensoryChecks}
          practiceGates={session.practiceGates}
          stationTelemetry={session.stationTelemetry}
          onUpdateSensoryChecks={handleUpdateSensoryChecks}
          onUpdatePracticeGate={handleUpdatePracticeGate}
          onAppendTrialEvent={handleAppendTrialEvent}
          onUpdateStationTelemetry={handleUpdateStationTelemetry}
          onSetSpotlightLocked={setSpotlightLocked}
          onSelectStation={setActiveStation}
        />

        {/* 3. Researcher / Judge Telemetry HUD */}
        {showResearcherHud && (
          <ResearcherTelemetryHud
            session={session}
            lockedManifest={lockedManifest}
            sandboxManifest={sandboxManifest}
            activePersonaMeta={activePersonaMeta}
            onUpdateSandboxManifest={setSandboxManifest}
            onResetSandboxManifest={() =>
              setSandboxManifest(getCanonicalProtocolManifest())
            }
          />
        )}
      </main>
    </div>
  );
};

export default App;
