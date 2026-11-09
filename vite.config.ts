import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2022',
    rollupOptions: {
      external: [
        '@pmndrs/uikit/webgpu',
        /^lit($|\/)/,
        '@google/genai',
        '@litertjs/core',
        '@mediapipe/tasks-audio',
        '@mediapipe/tasks-vision',
        '@sparkjsdev/spark',
        'openai',
        'three-mesh-bvh',
        'three-pathfinding'
      ]
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/testSetup.ts']
  }
});
