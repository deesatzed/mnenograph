// Lightweight browser-safe stubs for optional peer dependencies of xrblocks@0.24.0
// (e.g. lit simulator web components, optional AI/ML SDKs) so both `npm run dev` (esbuild
// optimizeDeps) and `npm run build` (Rollup) bundle cleanly without missing-module errors.

export class LitElement extends (typeof HTMLElement !== 'undefined' ? HTMLElement : class {}) {}
export const css = (..._args: unknown[]) => '';
export const html = (..._args: unknown[]) => '';
export const customElement = (_tagName: string) => (target: unknown) => target;
export const property = (_options?: unknown) => (_target: unknown, _key?: unknown) => {};
export const state = (_options?: unknown) => (_target: unknown, _key?: unknown) => {};
export const classMap = (_classes?: unknown) => '';
export const createRef = () => ({ value: null });
export const ref = (_refObj?: unknown) => '';

export class GoogleGenAI {}
export class OpenAI {}
export class SparkRenderer {}
export class Pathfinding {}
export class PathfindingHelper {}
export const MeshBVH = class {};
export const acceleratedRaycast = () => {};
export const computeBoundsTree = () => {};
export const disposeBoundsTree = () => {};
export const FilesetResolver = { forVisionTasks: async () => ({}), forAudioTasks: async () => ({}) };
export const HandLandmarker = { createFromOptions: async () => ({}) };
export const FaceDetector = { createFromOptions: async () => ({}) };
export const ObjectDetector = { createFromOptions: async () => ({}) };
export const ImageSegmenter = { createFromOptions: async () => ({}) };
export const AudioClassifier = { createFromOptions: async () => ({}) };
export const loadLiteRt = async () => ({});

export default {};
