import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const stubPath = path.resolve(__dirname, 'src/xrblocksOptionalPeerStub.ts');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true
  },
  preview: {
    port: 5174
  },
  resolve: {
    alias: [
      { find: '@pmndrs/uikit/webgpu', replacement: stubPath },
      { find: /^lit(\/.*)?$/, replacement: stubPath },
      { find: /^@google\/genai(\/.*)?$/, replacement: stubPath },
      { find: /^@litertjs\/core(\/.*)?$/, replacement: stubPath },
      { find: /^@mediapipe\/tasks-audio(\/.*)?$/, replacement: stubPath },
      { find: /^@mediapipe\/tasks-vision(\/.*)?$/, replacement: stubPath },
      { find: /^@sparkjsdev\/spark(\/.*)?$/, replacement: stubPath },
      { find: /^openai(\/.*)?$/, replacement: stubPath },
      { find: /^three-mesh-bvh(\/.*)?$/, replacement: stubPath },
      { find: /^three-pathfinding(\/.*)?$/, replacement: stubPath }
    ]
  },
  build: {
    target: 'esnext'
  },
  esbuild: {
    target: 'esnext'
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testSetup.ts']
  }
});
