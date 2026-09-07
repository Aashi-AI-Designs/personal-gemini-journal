import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // local dev: point /api at the Functions emulator
      "/api": "http://localhost:5001/YOUR_PROJECT_ID/us-central1/api",
    },
  },
});
