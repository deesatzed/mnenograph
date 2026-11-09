// Configure React 19 act() environment and headless jsdom stubs for Three.js / xrblocks@0.24.0
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

if (typeof window !== 'undefined' && !window.AudioContext) {
  class JSDOMAudioContext {
    createGain() {
      return {
        connect() {},
        disconnect() {},
        gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }
      };
    }
    createPanner() {
      return { connect() {}, disconnect() {} };
    }
    get destination() {
      return {};
    }
    get listener() {
      return {
        positionX: { value: 0, setValueAtTime() {} },
        positionY: { value: 0, setValueAtTime() {} },
        positionZ: { value: 0, setValueAtTime() {} },
        forwardX: { value: 0, setValueAtTime() {} },
        forwardY: { value: 0, setValueAtTime() {} },
        forwardZ: { value: -1, setValueAtTime() {} },
        upX: { value: 0, setValueAtTime() {} },
        upY: { value: 1, setValueAtTime() {} },
        upZ: { value: 0, setValueAtTime() {} }
      };
    }
    get currentTime() {
      return 0;
    }
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = JSDOMAudioContext;
}
