// Import the defineConfig helper from Vite.
import { defineConfig } from 'vite';
// Import the React plugin for Vite.
import react from '@vitejs/plugin-react';

// Export Vite configuration object.
export default defineConfig({
  // Register plugins list.
  plugins: [react()],
  // Configure development server options.
  server: {
    // Port number for local Vite dev server.
    port: 5173,
    // Strict port enforcement.
    strictPort: true
  },
  // Base public path for Electron asset resolution.
  base: './'
});
