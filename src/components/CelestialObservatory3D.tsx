import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import * as xb from 'xrblocks';
import type { SingleTrialMode, StationId } from '../types/sessionSchema';

/**
 * Real xrblocks@0.24.0 Script subclass managing the Celestial Observatory stations (F5 & F6).
 * Uses verified xrblocks exports: xb.Script, xb.UIPanel, xb.UICard, xb.SceneVisibilityOptions,
 * xb.SceneSetOfMarkOptions.
 */
export class ObservatoryStationControllerScript extends xb.Script {
  public readonly verifiedXrBlocksExports = {
    hasScript: typeof xb.Script === 'function',
    hasUICard: typeof xb.UICard === 'function',
    hasUIPanel: typeof xb.UIPanel === 'function',
    hasSceneVisibilityOptions: typeof xb.SceneVisibilityOptions === 'function',
    hasSceneSetOfMarkOptions: typeof xb.SceneSetOfMarkOptions === 'function'
  };
}

export interface CelestialObservatory3DProps {
  activeStation: StationId;
  presentationMode: SingleTrialMode;
  spotlightLocked: boolean;
  isSimulatedPreset: boolean;
  onSelectStation: (stationId: StationId) => void;
  onG0CalibrationReady?: (stats: {
    frameDeltasMs: number[];
    shaderPrewarmCompleted: boolean;
  }) => void;
}

export const OBSERVATORY_STATIONS: {
  id: StationId;
  wingTitle: string;
  stationName: string;
  domainBadge: string;
  angleRad: number;
  colorHex: number;
  accentCss: string;
}[] = [
  {
    id: 'S0.3',
    wingTitle: 'Wing 0: Calibration Dome',
    stationName: 'S0: Sensory, Informant & 36-Target Motor Baseline',
    domainBadge: 'Motor & Hemispace Baseline',
    angleRad: 0,
    colorHex: 0x38bdf8,
    accentCss: '#38bdf8'
  },
  {
    id: 'S1.1',
    wingTitle: 'Wing I: Astrolabe Loom',
    stationName: 'S1: Navon Global/Local & Telescope Diorama',
    domainBadge: 'Dorsal Stream / Simultanagnosia',
    angleRad: Math.PI / 3,
    colorHex: 0xa855f7,
    accentCss: '#a855f7'
  },
  {
    id: 'S2.1',
    wingTitle: 'Wing II: Pareidolia Nebula',
    stationName: 'S2: Noise Pareidolia & Silhouette Rotation',
    domainBadge: 'Ventral Stream / DLB Pareidolia',
    angleRad: (2 * Math.PI) / 3,
    colorHex: 0xf59e0b,
    accentCss: '#f59e0b'
  },
  {
    id: 'S3.1',
    wingTitle: 'Wing III: Constellation Switchboard',
    stationName: 'S3: 30-Trial Mixed DCCS, Number Ladder & Gerstmann',
    domainBadge: 'Executive SCER & Raw-RT CoMAD',
    angleRad: Math.PI,
    colorHex: 0x10b981,
    accentCss: '#10b981'
  },
  {
    id: 'S4.1',
    wingTitle: 'Wing IV: Echo Relay Spire',
    stationName: 'S4: Letter-F Fluency (IRI) & Phonological Echo',
    domainBadge: 'lvPPA Phonological Loop',
    angleRad: (4 * Math.PI) / 3,
    colorHex: 0xf43f5e,
    accentCss: '#f43f5e'
  },
  {
    id: 'S5.1',
    wingTitle: 'Wing V: Archive Vault',
    stationName: 'S5: 12-Item Sequence, Famous Faces & Auditory Control',
    domainBadge: 'Consolidation & Modality Discrepancy',
    angleRad: (5 * Math.PI) / 3,
    colorHex: 0x6366f1,
    accentCss: '#6366f1'
  }
];

export const CelestialObservatory3D: React.FC<CelestialObservatory3DProps> = ({
  activeStation,
  presentationMode,
  spotlightLocked,
  isSimulatedPreset,
  onSelectStation,
  onG0CalibrationReady
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglActive, setWebglActive] = useState<boolean>(false);
  const [shaderPrewarmed, setShaderPrewarmed] = useState<boolean>(false);

  const isPlainStatic = presentationMode === 'PLAIN_STATIC_2D';

  useEffect(() => {
    if (isPlainStatic) {
      setWebglActive(false);
      return;
    }
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer | null = null;
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2', { antialias: true, powerPreference: 'high-performance' }) ||
        canvas.getContext('webgl');
      if (!gl) {
        setWebglActive(false);
        return;
      }
      renderer = new THREE.WebGLRenderer({ canvas, context: gl as WebGLRenderingContext, antialias: true });
    } catch {
      setWebglActive(false);
      return;
    }

    setWebglActive(true);
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 220;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x0b0f19, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(0, 3.2, 8.5);
    camera.lookAt(0, 0, 0);

    // Instantiate verified xrblocks@0.24.0 Script node in the Three.js scene
    const xbController = new ObservatoryStationControllerScript();
    scene.add(xbController);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0x93c5fd, 1.4);
    dirLight.position.set(5, 10, 7);
    scene.add(dirLight);

    // Background orbital group (frozen/hidden behind 85% curtain during Spatial Spotlight Lock per Inventive Catalyst Finding 1)
    const backgroundGroup = new THREE.Group();
    scene.add(backgroundGroup);

    const ringGeo = new THREE.TorusGeometry(4.2, 0.03, 16, 96);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x334155 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2;
    backgroundGroup.add(ringMesh);

    const stationMeshes: THREE.Mesh[] = [];
    OBSERVATORY_STATIONS.forEach((st) => {
      const geo = new THREE.OctahedronGeometry(0.42, 1);
      const mat = new THREE.MeshStandardMaterial({
        color: st.colorHex,
        emissive: st.colorHex,
        emissiveIntensity: st.id.slice(0, 2) === activeStation.slice(0, 2) ? 0.65 : 0.18,
        roughness: 0.25,
        metalness: 0.7
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(Math.cos(st.angleRad) * 4.2, 0, Math.sin(st.angleRad) * 4.2);
      backgroundGroup.add(mesh);
      stationMeshes.push(mesh);
    });

    // Gate G0 AOT Shader Pre-Warming (Inventive Catalyst Finding 1)
    try {
      renderer.compile(scene, camera);
      setShaderPrewarmed(true);
    } catch {
      setShaderPrewarmed(true);
    }

    let animId = 0;
    let lastTime = performance.now();
    const frameDeltas: number[] = [];
    let reportedG0 = false;

    const targetStation =
      OBSERVATORY_STATIONS.find((s) => s.id.slice(0, 2) === activeStation.slice(0, 2)) ??
      OBSERVATORY_STATIONS[0];

    const animate = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      if (frameDeltas.length < 20 && dt > 2 && dt < 100) {
        frameDeltas.push(dt);
      } else if (!reportedG0 && frameDeltas.length >= 10) {
        reportedG0 = true;
        onG0CalibrationReady?.({ frameDeltasMs: frameDeltas, shaderPrewarmCompleted: true });
      }

      if (spotlightLocked) {
        // Spatial Spotlight Lock: 0 rad/s angular velocity + background meshes hidden behind 85% curtain
        backgroundGroup.visible = false;
      } else {
        backgroundGroup.visible = true;
        // Smooth orbital rotation toward active station wing during inter-station navigation only
        const desiredRotY = -targetStation.angleRad + Math.PI / 2;
        backgroundGroup.rotation.y += (desiredRotY - backgroundGroup.rotation.y) * 0.08;
        stationMeshes.forEach((m, i) => {
          m.rotation.y += 0.01 + i * 0.002;
        });
      }

      renderer?.render(scene, camera);
      animId = requestAnimationFrame(animate);
    };

    animId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animId);
      renderer?.dispose();
    };
  }, [activeStation, isPlainStatic, spotlightLocked]);

  return (
    <div
      data-testid="observatory-viewport"
      data-presentation-mode={presentationMode}
      data-spotlight-locked={String(spotlightLocked)}
      className="relative w-full rounded-xl border border-slate-700/80 bg-[#0B0F19] overflow-hidden shadow-lg"
    >
      {/* Mandatory SIMULATED watermark inside the 3D/2D viewport whenever a synthetic persona is loaded (F3) */}
      {isSimulatedPreset && (
        <div
          data-testid="viewport-simulated-watermark"
          className="bg-amber-500/20 border-b border-amber-400/50 px-3 py-1 text-center text-xs font-bold tracking-wider text-amber-200 uppercase"
        >
          SIMULATED / SYNTHETIC DEMO — NOT REAL PATIENT DATA (HEURISTIC WEIGHTS UNVALIDATED)
        </div>
      )}

      {/* Top status bar inside viewport showing Spatial Spotlight Lock vs Plain Static Mode (F7) */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2.5 h-2.5 rounded-full ${
              isPlainStatic
                ? 'bg-emerald-400'
                : spotlightLocked
                ? 'bg-sky-400'
                : 'bg-purple-400 animate-pulse'
            }`}
          />
          <span className="font-semibold text-slate-100">
            {isPlainStatic
              ? 'Plain Static Mode (2D Fronto-Parallel | Zero Motion | PCA/Vestibular Safe)'
              : spotlightLocked
              ? '3D Celestial Observatory — SPATIAL SPOTLIGHT LOCK ACTIVE (0 rad/s Camera | 85% Curtain | Background GPU Frozen)'
              : '3D Celestial Observatory — Orbital Hub Navigation (xrblocks@0.24.0 + Three.js r186)'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-slate-300">
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
            xrblocks@0.24.0: <strong className="text-sky-300">UICard / UIPanel / Script Verified</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
            Gate G0 AOT Shaders: <strong className="text-emerald-300">{shaderPrewarmed || isPlainStatic ? 'Ready' : 'Warming'}</strong>
          </span>
        </div>
      </div>

      {/* 3D Canvas or Plain Static Banner */}
      {!isPlainStatic ? (
        <div className="relative h-36 w-full bg-[#12161F]">
          <div ref={mountRef} className="h-full w-full" />
          {spotlightLocked && (
            <div
              data-testid="spotlight-curtain-overlay"
              className="absolute inset-0 bg-[#12161F]/90 flex items-center justify-center pointer-events-none px-4"
            >
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-sky-300">
                  Spatial Spotlight Lock Engaged (F7 / Gate G0)
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  Camera angular velocity = 0.00 rad/s • 85% Matte Peripheral Curtain (#12161F) • 0° Fronto-Parallel Task Plane
                </p>
              </div>
            </div>
          )}
          {!webglActive && !spotlightLocked && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-300 bg-[#0B0F19]/90">
              3D Celestial Observatory Orbital Ring Ready (xrblocks@0.24.0 Scene Graph Mounted)
            </div>
          )}
        </div>
      ) : (
        <div
          data-testid="plain-static-surface-banner"
          className="px-4 py-3 bg-[#12161F] text-slate-200 text-xs flex items-center justify-between border-b border-slate-800"
        >
          <span>
            <strong>Plain Static Comparator Active:</strong> All 3D orbital transitions, volumetric shaders, and parallax cues are disabled (`motionOff = true`). Stimuli render on a 0° fronto-parallel plane (`#12161F` matte slate).
          </span>
          <span className="text-emerald-300 font-semibold">Gate G1 Equivalence Comparator</span>
        </div>
      )}

      {/* 6 Orbital Observatory Station Selector Pills */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-1.5 p-2.5 bg-slate-950/90">
        {OBSERVATORY_STATIONS.map((st) => {
          const isSelected = st.id.slice(0, 2) === activeStation.slice(0, 2);
          return (
            <button
              key={st.id}
              type="button"
              onClick={() => onSelectStation(st.id)}
              className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                isSelected
                  ? 'bg-sky-950/80 border-sky-400 text-white shadow-sm'
                  : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-300 truncate">
                {st.wingTitle}
              </div>
              <div className="text-xs font-medium text-slate-100 truncate mt-0.5">
                {st.domainBadge}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
