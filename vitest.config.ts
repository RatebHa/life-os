import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/lib/**', 'src/store/**', 'src/components/**'],
      exclude: ['src/test/**'],
    },
  },
  resolve: {
    alias: {
      // Stub out Tauri invoke so tests never hit the native bridge
      '@tauri-apps/api/core': path.resolve(__dirname, 'src/test/__mocks__/tauri.ts'),
    },
  },
});
