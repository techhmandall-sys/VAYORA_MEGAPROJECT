import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // Libraries change less often than the app: separate files download in parallel and stay
        // cached across releases. Each translation table and the map are fetched only when used.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('node_modules/framer-motion/')) return 'motion';
          if (id.includes('node_modules/@tanstack/')) return 'data';
          // Forms are on a few screens only, so the front page does without them.
          if (/node_modules\/(zod|react-hook-form|@hookform)\//.test(id)) return 'forms';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.tsx'],
    // Room for the longest walks through a screen when the machine is busy; see setup.tsx.
    testTimeout: 20_000,
  },
});
