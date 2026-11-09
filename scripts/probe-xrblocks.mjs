import fs from 'node:fs';
import path from 'node:path';

const pkgJsonPath = path.resolve(process.cwd(), 'node_modules/xrblocks/package.json');
const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));

// Inspect the built entry & d.ts or runtime module exports of xrblocks@0.24.0
const indexDtsPath = path.resolve(process.cwd(), 'node_modules/xrblocks/build/xrblocks.d.ts');
const dtsExists = fs.existsSync(indexDtsPath);

// Provide minimally polyfilled globals so Three/WebXR module evaluation succeeds in Node
globalThis.location ??= { search: '', href: 'http://localhost/', hostname: 'localhost' };
globalThis.window ??= globalThis;
globalThis.window.location ??= globalThis.location;
globalThis.self ??= globalThis;
globalThis.document ??= {
  createElement: () => ({ getContext: () => ({}), style: {} }),
  body: { appendChild: () => {} },
  addEventListener: () => {}
};
globalThis.navigator ??= { userAgent: 'node', xr: null };
globalThis.HTMLElement ??= class HTMLElement {};
globalThis.HTMLVideoElement ??= class HTMLVideoElement {};
globalThis.HTMLCanvasElement ??= class HTMLCanvasElement {};
globalThis.CustomEvent ??= class CustomEvent {};
globalThis.AudioContext ??= class AudioContext {
  createGain() { return { connect() {}, gain: { value: 1 } }; }
  createOscillator() { return { connect() {}, start() {}, stop() {}, frequency: { value: 440 } }; }
  get destination() { return {}; }
};
globalThis.window.AudioContext = globalThis.AudioContext;

let runtimeKeys = [];
let coreExportCheck = {};

try {
  const xb = await import('xrblocks');
  runtimeKeys = Object.keys(xb).sort();
  coreExportCheck = {
    hasScript: 'Script' in xb && typeof xb.Script === 'function',
    hasUICard: 'UICard' in xb && typeof xb.UICard === 'function',
    hasUIPanel: 'UIPanel' in xb && typeof xb.UIPanel === 'function',
    hasSpatialPanel: 'SpatialPanel' in xb && typeof xb.SpatialPanel === 'function',
    hasCore: 'core' in xb || 'Core' in xb,
    hasInit: 'init' in xb && typeof xb.init === 'function',
    hasOptions: 'Options' in xb && typeof xb.Options === 'function',
    hasRegistry: 'Registry' in xb && typeof xb.Registry === 'function',
    // Verify F5 hallucinated APIs are absent:
    hasHallucinatedSerializeContext: 'serializeContext' in xb,
    hasHallucinatedUiblocks: 'uiblocks' in xb,
    hasHallucinatedPanel: 'Panel' in xb
  };
} catch (err) {
  coreExportCheck = { importError: String(err) };
}

let aiSubmoduleKeys = [];
try {
  const dtsDirs = fs.readdirSync(path.resolve(process.cwd(), 'node_modules/xrblocks/build'));
  aiSubmoduleKeys = dtsDirs.sort();
} catch {
  aiSubmoduleKeys = [];
}

const report = [
  `# PostCircECD Live Probe of xrblocks@${pkgJson.version} (Mitigates F5 & F6)`,
  `Probe Timestamp: ${new Date().toISOString()}`,
  `Package Name: ${pkgJson.name}`,
  `Package Version: ${pkgJson.version}`,
  `Package Main / Module: ${pkgJson.main || pkgJson.module || JSON.stringify(pkgJson.exports)}`,
  `Type Declarations Present (build/xrblocks.d.ts): ${dtsExists}`,
  ``,
  `## 1. Verified Core API Export Check (F5 & F6)`,
  JSON.stringify(coreExportCheck, null, 2),
  ``,
  `## 2. Build Directory Contents (node_modules/xrblocks/build)`,
  JSON.stringify(aiSubmoduleKeys, null, 2),
  ``,
  `## 3. Top-Level Runtime Exports (${runtimeKeys.length} symbols)`,
  runtimeKeys.join(', ')
].join('\n');

fs.mkdirSync(path.resolve(process.cwd(), 'docs'), { recursive: true });
fs.writeFileSync(path.resolve(process.cwd(), 'docs/xrblocks-probe.txt'), report + '\n', 'utf8');
console.log(report);
