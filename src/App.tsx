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
import { AssessmentResultsReport } from './components/AssessmentResultsReport';
import { evaluateTwoLayerSyndromeRouter } from './psychometrics/psychometrics';

export type AppViewMode = 'PATIENT_TOUR' | 'PROVIDER_PORTAL';

export const App: React.FC = () => {
  const [lockedManifest] = useState<ResearchProtocolManifest>(() =>
    getCanonicalProtocolManifest()
  );
  const [sandboxManifest, setSandboxManifest] = useState<ResearchProtocolManifest>(() =>
    getCanonicalProtocolManifest()
  );

  const [viewMode, setViewMode] = useState<AppViewMode>('PATIENT_TOUR');
  const [selectedPreset, setSelectedPreset] = useState<PersonaPresetId>('LIVE_PARTICIPANT');
  const [singleTrialMode, setSingleTrialMode] = useState<SingleTrialMode>(
    'OBSERVATORY_3D_SPOTLIGHT_LOCK'
  );
  const [spotlightLocked, setSpotlightLocked] = useState<boolean>(false);
  const [activeStation, setActiveStation] = useState<StationId>('S0.3');
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
    if (presetId !== 'LIVE_PARTICIPANT') {
      setViewMode('PROVIDER_PORTAL');
    } else {
      setActiveStation('S0.3');
    }
  };

  const handleStartNewGuidedTest = () => {
    setSelectedPreset('LIVE_PARTICIPANT');
    const freshRecord = buildPresetSessionRecord('LIVE_PARTICIPANT', lockedManifest);
    freshRecord.presentationMode = singleTrialMode;
    freshRecord.motionOff = singleTrialMode === 'PLAIN_STATIC_2D' || spotlightLocked;
    setSession(freshRecord);
    setActiveStation('S0.3');
    setViewMode('PATIENT_TOUR');
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
      {/* Mandatory Non-Removable Intended-Use & Privacy Banner */}
      <div
        data-testid="intended-use-banner"
        className="bg-slate-900 border-b border-slate-800 px-4 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-500/50 text-sky-300 font-bold uppercase">
            RESEARCH &amp; EDUCATIONAL PROTOTYPE — NOT FOR CLINICAL DIAGNOSTIC USE
          </span>
          <span className="text-slate-400">
            100% Local Browser Execution • Zero External PHI Transmission
          </span>
        </div>
        <span className="text-slate-500 font-mono">
          Manifest SHA-256: {computeManifestSha256(lockedManifest).slice(0, 12)}
        </span>
      </div>

      {/* Persistent Global SIMULATED Watermark Header when a Synthetic Persona is loaded */}
      {session.isSimulatedPreset && (
        <div
          data-testid="global-simulated-watermark"
          className="bg-amber-500/20 border-b border-amber-400/60 px-4 py-2 text-center text-xs font-extrabold tracking-widest text-amber-200 uppercase"
        >
          {session.simulatedWatermark} — FOR GOOGLE SCIENCE &amp; RESEARCH DEMONSTRATION ONLY
        </div>
      )}

      {/* Main Header with Primary Two-Mode Switcher (Patient Tour vs. Provider & Judge Portal) */}
      <header className="max-w-7xl w-full mx-auto px-4 pt-4 pb-3 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">
            PostCircECD: <span className="text-sky-400">The Celestial Observatory</span>
          </h1>
          <p className="text-xs text-slate-300 mt-0.5">
            {viewMode === 'PATIENT_TOUR'
              ? '🌟 Patient Mode: Calm, game-like 6-Wing Observatory Tour (all clinical scores & telemetry hidden from view)'
              : '🩺 Provider & Science Judge Portal: 6-Domain Clinical Results Report, Simulated Case Library & Psychometric Telemetry'}
          </p>
        </div>

        {/* Primary 2-Mode Switcher Pills + Display Mode Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-900 p-1 border border-slate-700">
            <button
              type="button"
              data-testid="switch-to-patient-tour-btn"
              onClick={() => setViewMode('PATIENT_TOUR')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === 'PATIENT_TOUR'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🌟 1. Patient Observatory Tour (Game)
            </button>
            <button
              type="button"
              data-testid="switch-to-provider-portal-btn"
              onClick={() => setViewMode('PROVIDER_PORTAL')}
              className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                viewMode === 'PROVIDER_PORTAL'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🩺 2. Provider &amp; Judge Results Portal
            </button>
          </div>

          <button
            type="button"
            data-testid="toggle-presentation-mode-btn"
            onClick={handleTogglePresentationMode}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
              singleTrialMode === 'PLAIN_STATIC_2D'
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200'
                : 'bg-sky-950/90 border-sky-400 text-sky-200'
            }`}
          >
            {singleTrialMode === 'PLAIN_STATIC_2D'
              ? 'Display: Plain Static 2D (Switch to 3D)'
              : 'Display: 3D Observatory (Switch to Static 2D)'}
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl w-full mx-auto px-4 py-4 space-y-5 flex-1">
        {/* =====================================================================
            VIEW 1: PATIENT OBSERVATORY TOUR (Calm, Game-Like, Zero Clinical Noise)
           ===================================================================== */}
        <div className={viewMode === 'PATIENT_TOUR' ? 'space-y-5' : 'hidden'}>
          {/* 3D Celestial Observatory Ring */}
          <CelestialObservatory3D
            activeStation={activeStation}
            presentationMode={singleTrialMode}
            spotlightLocked={spotlightLocked}
            isSimulatedPreset={session.isSimulatedPreset}
            onSelectStation={(st) => setActiveStation(st)}
          />

          {/* Interactive Stargazer Game Surface (Zero Number Inputs, Zero Medical Jargon) */}
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
            onFinishAssessment={() => setViewMode('PROVIDER_PORTAL')}
          />
        </div>

        {/* =====================================================================
            VIEW 2: PROVIDER & SCIENCE JUDGE PORTAL (Results Report, Cases & HUD)
           ===================================================================== */}
        <div className={viewMode === 'PROVIDER_PORTAL' ? 'space-y-5' : 'hidden'}>
          {/* Provider Case Selector & Quick Actions Bar */}
          <div className="rounded-2xl bg-slate-900/90 border border-emerald-500/40 p-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                🩺 Provider &amp; Science Judge Case Selector
              </div>
              <p className="text-xs text-slate-300">
                Inspect the live patient’s completed Observatory Tour or load one of the 4 pre-recorded synthetic clinical personas below:
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Select Live Mode or Synthetic Persona Preset"
                data-testid="persona-preset-select"
                value={selectedPreset}
                onChange={(e) => handleSelectPersona(e.target.value as PersonaPresetId)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white cursor-pointer"
              >
                {PERSONA_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                data-testid="start-new-test-btn"
                onClick={handleStartNewGuidedTest}
                className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                + Launch New Patient Tour (Wing 0 &rarr; V)
              </button>

              <button
                type="button"
                data-testid="toggle-researcher-hud-btn"
                onClick={() => setShowResearcherHud((v) => !v)}
                className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-semibold text-slate-200 cursor-pointer"
              >
                {showResearcherHud ? 'Hide Deep-Dive Telemetry HUD' : 'Show Deep-Dive Telemetry HUD'}
              </button>
            </div>
          </div>

          {/* Clinical Vignette / Persona Summary Banner */}
          <div className="rounded-xl bg-slate-900/70 border border-slate-800 px-4 py-3 text-xs text-slate-200">
            <strong className="text-sky-300">{activePersonaMeta.label}:</strong>{' '}
            {activePersonaMeta.clinicalVignette}
          </div>

          {/* Plain-English 6-Domain Assessment Results Report */}
          <AssessmentResultsReport
            session={session}
            manifest={sandboxManifest}
            onStartNewTest={handleStartNewGuidedTest}
            onReviewStation={(st) => {
              setActiveStation(st);
              setViewMode('PATIENT_TOUR');
            }}
            onToggleResearcherHud={() => setShowResearcherHud((v) => !v)}
            showResearcherHud={showResearcherHud}
          />

          {/* Advanced Researcher / Judge Telemetry HUD */}
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
        </div>
      </main>
    </div>
  );
};

export default App;
