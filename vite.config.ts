import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "three-engine": ["three"],
          "rapier-physics": ["@dimforge/rapier3d-compat"],
        },
      },
    },
  },
  server: { host: "0.0.0.0" },
  preview: { host: "0.0.0.0" },
});
